import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/Modal'
import type { Board, Card, Column, Profile, Team } from '../lib/types'
import { parsePriority } from '../lib/types'
import {
  TASK_CSV_HEADERS,
  downloadCsv,
  parseCsv,
  toCsv,
} from '../lib/csv'

function parseBool(v: string) {
  const s = v.trim().toLowerCase()
  return s === '1' || s === 'true' || s === 'yes' || s === 'si' || s === 'sí'
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10)
}

export function DataPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ total: number; sample: string[] } | null>(null)
  const [pendingRows, setPendingRows] = useState<Record<string, string>[] | null>(null)

  async function exportTasks() {
    setExporting(true)
    setError(null)
    setMessage(null)
    try {
      const [
        { data: boards },
        { data: teams },
        { data: columns },
        { data: cards },
        { data: assigns },
        { data: profiles },
      ] = await Promise.all([
        supabase.from('boards').select('*'),
        supabase.from('teams').select('*'),
        supabase.from('columns').select('*'),
        supabase.from('cards').select('*').order('position'),
        supabase.from('card_assignees').select('card_id, user_id'),
        supabase.from('profiles').select('*'),
      ])

      const boardById = Object.fromEntries(((boards as Board[]) || []).map((b) => [b.id, b]))
      const teamById = Object.fromEntries(((teams as Team[]) || []).map((t) => [t.id, t]))
      const colById = Object.fromEntries(((columns as Column[]) || []).map((c) => [c.id, c]))
      const profileById = Object.fromEntries(((profiles as Profile[]) || []).map((p) => [p.id, p]))
      const assigneesByCard: Record<string, string[]> = {}
      for (const a of (assigns as { card_id: string; user_id: string }[]) || []) {
        if (!assigneesByCard[a.card_id]) assigneesByCard[a.card_id] = []
        const email = profileById[a.user_id]?.email
        if (email) assigneesByCard[a.card_id].push(email)
      }

      const rows: Array<Array<string | boolean | null>> = []
      for (const card of (cards as Card[]) || []) {
        const col = colById[card.column_id]
        if (!col) continue
        const board = boardById[col.board_id]
        if (!board) continue
        const team = board.team_id ? teamById[board.team_id] : null
        rows.push([
          board.name,
          col.title,
          card.title,
          card.description_md || '',
          card.color || '',
          card.priority || '',
          card.due_date || '',
          card.done ? 'true' : 'false',
          (assigneesByCard[card.id] || []).join('; '),
          team?.name || '',
        ])
      }

      const csv = toCsv([...TASK_CSV_HEADERS], rows)
      downloadCsv(`trufi-tasks-${todayStamp()}.csv`, csv)
      setMessage(`Exportadas ${rows.length} tareas.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al exportar')
    } finally {
      setExporting(false)
    }
  }

  function downloadTemplate() {
    const csv = toCsv([...TASK_CSV_HEADERS], [
      [
        'Marketing',
        'Backlog',
        'Diseñar landing',
        '## Notas\nDetalles en markdown',
        '#525252',
        'high',
        '2026-08-01',
        'false',
        'ana@ejemplo.com; luis@ejemplo.com',
        'Growth',
      ],
    ])
    downloadCsv('trufi-tasks-plantilla.csv', csv)
  }

  function onFileSelected(file: File | null) {
    setError(null)
    setMessage(null)
    setPreview(null)
    setPendingRows(null)
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = String(reader.result || '')
        const { headers, rows } = parseCsv(text)
        const required = ['board', 'column', 'title']
        const missing = required.filter((h) => !headers.includes(h))
        if (missing.length) {
          setError(`CSV incompleto. Faltan columnas: ${missing.join(', ')}`)
          return
        }
        const usable = rows.filter((r) => r.board && r.column && r.title)
        if (!usable.length) {
          setError('El CSV no tiene filas válidas (board, column, title).')
          return
        }
        setPendingRows(usable)
        setPreview({
          total: usable.length,
          sample: usable.slice(0, 5).map((r) => `${r.board} / ${r.column} / ${r.title}`),
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo leer el CSV')
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

  async function runImport() {
    if (!pendingRows?.length) return
    setImporting(true)
    setError(null)
    setMessage(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Sesión no válida')

      const [
        { data: boardsData },
        { data: teamsData },
        { data: columnsData },
        { data: profilesData },
      ] = await Promise.all([
        supabase.from('boards').select('*'),
        supabase.from('teams').select('*'),
        supabase.from('columns').select('*'),
        supabase.from('profiles').select('*'),
      ])

      let boards = (boardsData as Board[]) || []
      let teams = (teamsData as Team[]) || []
      let columns = (columnsData as Column[]) || []
      const profiles = (profilesData as Profile[]) || []
      const profileByEmail = Object.fromEntries(
        profiles.map((p) => [p.email.toLowerCase(), p]),
      )

      const boardKey = (name: string) => name.trim().toLowerCase()
      const teamKey = (name: string) => name.trim().toLowerCase()
      const colKey = (boardId: string, title: string) =>
        `${boardId}::${title.trim().toLowerCase()}`

      const boardsByName = new Map(boards.map((b) => [boardKey(b.name), b]))
      const teamsByName = new Map(teams.map((t) => [teamKey(t.name), t]))
      const colsByKey = new Map(columns.map((c) => [colKey(c.board_id, c.title), c]))
      const cardCountByCol = new Map<string, number>()
      for (const c of columns) cardCountByCol.set(c.id, 0)

      // Approximate positions from existing cards
      const { data: existingCards } = await supabase.from('cards').select('column_id')
      for (const c of (existingCards as { column_id: string }[]) || []) {
        cardCountByCol.set(c.column_id, (cardCountByCol.get(c.column_id) || 0) + 1)
      }

      let createdBoards = 0
      let createdColumns = 0
      let createdTeams = 0
      let createdCards = 0
      let linkedAssignees = 0
      const warnings: string[] = []

      for (const row of pendingRows) {
        const boardName = row.board.trim()
        const columnTitle = row.column.trim()
        const title = row.title.trim()
        if (!boardName || !columnTitle || !title) continue

        // Team (optional): create if named and missing
        let teamId: string | null = null
        const teamName = (row.team || '').trim()
        if (teamName) {
          let team = teamsByName.get(teamKey(teamName))
          if (!team) {
            const { data, error: tErr } = await supabase
              .from('teams')
              .insert({
                name: teamName,
                description_md: '',
                created_by: user.id,
              })
              .select('*')
              .single()
            if (tErr) {
              warnings.push(`Equipo "${teamName}": ${tErr.message}`)
            } else {
              team = data as Team
              teams = [...teams, team]
              teamsByName.set(teamKey(team.name), team)
              createdTeams += 1
              await supabase.from('team_members').insert({
                team_id: team.id,
                user_id: user.id,
                role: 'lead',
              })
            }
          }
          teamId = team?.id ?? null
        }

        // Board
        let board = boardsByName.get(boardKey(boardName))
        if (!board) {
          const { data, error: bErr } = await supabase
            .from('boards')
            .insert({
              name: boardName,
              description_md: '',
              color: '#525252',
              team_id: teamId,
              created_by: user.id,
              position: boards.length,
            })
            .select('*')
            .single()
          if (bErr) {
            warnings.push(`Tablero "${boardName}": ${bErr.message}`)
            continue
          }
          board = data as Board
          boards = [...boards, board]
          boardsByName.set(boardKey(board.name), board)
          createdBoards += 1
        } else if (teamId && !board.team_id) {
          await supabase.from('boards').update({ team_id: teamId }).eq('id', board.id)
          board = { ...board, team_id: teamId }
          boardsByName.set(boardKey(board.name), board)
        }

        // Column
        let col = colsByKey.get(colKey(board.id, columnTitle))
        if (!col) {
          const sameBoardCols = columns.filter((c) => c.board_id === board!.id)
          const { data, error: cErr } = await supabase
            .from('columns')
            .insert({
              board_id: board.id,
              title: columnTitle,
              position: sameBoardCols.length,
            })
            .select('*')
            .single()
          if (cErr) {
            warnings.push(`Columna "${columnTitle}" en ${boardName}: ${cErr.message}`)
            continue
          }
          col = data as Column
          columns = [...columns, col]
          colsByKey.set(colKey(board.id, col.title), col)
          cardCountByCol.set(col.id, 0)
          createdColumns += 1
        }

        const due = (row.due_date || '').trim()
        const position = cardCountByCol.get(col.id) || 0
        const { data: cardData, error: cardErr } = await supabase
          .from('cards')
          .insert({
            column_id: col.id,
            title,
            description_md: row.description_md || '',
            color: row.color?.trim() || null,
            priority: parsePriority(row.priority),
            due_date: due || null,
            done: parseBool(row.done || ''),
            position,
            created_by: user.id,
          })
          .select('*')
          .single()

        if (cardErr) {
          warnings.push(`Tarea "${title}": ${cardErr.message}`)
          continue
        }

        const card = cardData as Card
        cardCountByCol.set(col.id, position + 1)
        createdCards += 1

        const emails = (row.assignees || '')
          .split(/[;,]/)
          .map((e) => e.trim().toLowerCase())
          .filter(Boolean)
        for (const email of emails) {
          const profile = profileByEmail[email]
          if (!profile) {
            warnings.push(`Asignado no encontrado: ${email} (${title})`)
            continue
          }
          const { error: aErr } = await supabase.from('card_assignees').insert({
            card_id: card.id,
            user_id: profile.id,
          })
          if (!aErr) linkedAssignees += 1
        }
      }

      const parts = [
        `${createdCards} tareas`,
        createdBoards ? `${createdBoards} tableros` : null,
        createdColumns ? `${createdColumns} columnas` : null,
        createdTeams ? `${createdTeams} equipos` : null,
        linkedAssignees ? `${linkedAssignees} asignaciones` : null,
      ].filter(Boolean)

      setMessage(`Importación lista: ${parts.join(', ')}.`)
      if (warnings.length) {
        setError(
          `${warnings.length} aviso(s):\n` + warnings.slice(0, 8).join('\n') +
            (warnings.length > 8 ? `\n… y ${warnings.length - 8} más` : ''),
        )
      }
      setPendingRows(null)
      setPreview(null)
      if (fileRef.current) fileRef.current.value = ''
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al importar')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Datos"
        subtitle="Exporta e importa tareas en CSV. Útil para backups, migraciones o carga masiva."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="font-display text-xl font-semibold text-ink">Exportar</h2>
          <p className="mt-1 text-sm text-mute">
            Descarga todas las tareas visibles en un CSV con tablero, columna, fecha,
            estado, equipo y asignados (emails).
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary"
              disabled={exporting}
              onClick={() => void exportTasks()}
            >
              {exporting ? 'Exportando…' : 'Exportar tareas CSV'}
            </button>
            <button type="button" className="btn-ghost" onClick={downloadTemplate}>
              Descargar plantilla
            </button>
          </div>
          <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-neutral-50 p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-mute">
              Columnas del CSV
            </p>
            <code className="text-xs text-ink">{TASK_CSV_HEADERS.join(', ')}</code>
          </div>
        </section>

        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="font-display text-xl font-semibold text-ink">Importar</h2>
          <p className="mt-1 text-sm text-mute">
            Crea tareas nuevas. Si el tablero, columna o equipo no existen, se crean.
            Los asignados se resuelven por email (deben existir en la app).
          </p>
          <div className="mt-4">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="block w-full text-sm text-mute file:mr-3 file:rounded-lg file:border-0 file:bg-ink file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
              onChange={(e) => onFileSelected(e.target.files?.[0] ?? null)}
            />
          </div>

          {preview && (
            <div className="mt-4 rounded-lg border border-line bg-neutral-50 p-3 text-sm">
              <p className="font-semibold text-ink">
                {preview.total} fila{preview.total === 1 ? '' : 's'} listas para importar
              </p>
              <ul className="mt-2 space-y-1 text-mute">
                {preview.sample.map((s) => (
                  <li key={s} className="truncate">
                    · {s}
                  </li>
                ))}
                {preview.total > preview.sample.length && (
                  <li>… y {preview.total - preview.sample.length} más</li>
                )}
              </ul>
              <button
                type="button"
                className="btn-primary mt-3"
                disabled={importing}
                onClick={() => void runImport()}
              >
                {importing ? 'Importando…' : 'Confirmar importación'}
              </button>
            </div>
          )}
        </section>
      </div>

      {message && (
        <p className="mt-5 whitespace-pre-wrap rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-3 whitespace-pre-wrap rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <section className="mt-6 rounded-xl border border-line bg-surface p-5 text-sm text-mute">
        <h3 className="font-semibold text-ink">Notas</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <code className="text-ink">assignees</code>: emails separados por{' '}
            <code>;</code> o <code>,</code>
          </li>
          <li>
            <code className="text-ink">done</code>: <code>true</code>/<code>false</code>,{' '}
            <code>1</code>/<code>0</code>, <code>sí</code>/<code>no</code>
          </li>
          <li>
            <code className="text-ink">priority</code>: <code>low</code>, <code>medium</code>,{' '}
            <code>high</code>, <code>urgent</code> (o baja/media/alta/urgente)
          </li>
          <li>
            <code className="text-ink">due_date</code>: formato <code>YYYY-MM-DD</code>
          </li>
          <li>La importación siempre agrega tareas; no sobrescribe existentes.</li>
        </ul>
      </section>
    </div>
  )
}
