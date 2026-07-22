import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Modal, PageHeader } from '../components/Modal'
import { Markdown } from '../components/Markdown'
import type { Board, Team } from '../lib/types'
import { BOARD_COLORS } from '../lib/types'

const emptyForm = {
  name: '',
  description: '## Tablero\n\nLinks útiles:\n- [Docs](https://)\n',
  color: '#525252',
  teamId: '',
}

export function BoardsPage() {
  const { isAdmin } = useAuth()
  const [boards, setBoards] = useState<Board[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [mode, setMode] = useState<'create' | 'edit' | null>(null)
  const [editing, setEditing] = useState<Board | null>(null)
  const [name, setName] = useState(emptyForm.name)
  const [description, setDescription] = useState(emptyForm.description)
  const [color, setColor] = useState(emptyForm.color)
  const [teamId, setTeamId] = useState(emptyForm.teamId)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function load() {
    const [{ data: b }, { data: t }] = await Promise.all([
      supabase.from('boards').select('*').order('position').order('created_at', { ascending: false }),
      supabase.from('teams').select('*').order('name'),
    ])
    setBoards((b as Board[]) || [])
    setTeams((t as Team[]) || [])
  }

  useEffect(() => {
    void load()
  }, [])

  function openCreate() {
    setEditing(null)
    setName('')
    setDescription(emptyForm.description)
    setColor(emptyForm.color)
    setTeamId('')
    setError(null)
    setMode('create')
  }

  function openEdit(board: Board) {
    if (!isAdmin) return
    setEditing(board)
    setName(board.name)
    setDescription(board.description_md || '')
    setColor(board.color || '#525252')
    setTeamId(board.team_id || '')
    setError(null)
    setMode('edit')
  }

  function closeModal() {
    setMode(null)
    setEditing(null)
    setError(null)
  }

  async function createBoard(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setError('Sesión no válida. Vuelve a iniciar sesión.')
        return
      }
      const { data, error: err } = await supabase
        .from('boards')
        .insert({
          name: name.trim(),
          description_md: description,
          color,
          team_id: teamId || null,
          created_by: user.id,
          position: boards.length,
        })
        .select('*')
        .single()
      if (err) {
        setError(err.message)
        return
      }
      const board = data as Board
      const { error: colErr } = await supabase.from('columns').insert([
        { board_id: board.id, title: 'Backlog', position: 0 },
        { board_id: board.id, title: 'En progreso', position: 1 },
        { board_id: board.id, title: 'Hecho', position: 2 },
      ])
      if (colErr) {
        setError(`Tablero creado, pero columnas: ${colErr.message}`)
        await load()
        return
      }
      closeModal()
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function updateBoard(e: FormEvent) {
    e.preventDefault()
    if (!editing || !isAdmin) return
    setError(null)
    setSaving(true)
    try {
      const { error: err } = await supabase
        .from('boards')
        .update({
          name: name.trim(),
          description_md: description,
          color,
          team_id: teamId || null,
        })
        .eq('id', editing.id)
      if (err) {
        setError(err.message)
        return
      }
      closeModal()
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function removeBoard(id: string) {
    if (!isAdmin) return
    if (!confirm('¿Borrar tablero y todas sus tareas?')) return
    await supabase.from('boards').delete().eq('id', id)
    await load()
  }

  return (
    <div>
      <PageHeader
        title="Tableros"
        subtitle="Organiza el trabajo del equipo. Abre un tablero o crea uno nuevo."
        action={
          <button type="button" onClick={openCreate} className="btn-primary">
            Nuevo tablero
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {boards.map((b, i) => {
          const team = teams.find((t) => t.id === b.team_id)
          return (
            <article
              key={b.id}
              className={`animate-fade-up group relative overflow-hidden rounded-xl border border-line bg-surface transition duration-200 hover:border-neutral-400 stagger-${Math.min(i + 1, 3)}`}
            >
              <div
                className="absolute inset-y-0 left-0 w-1"
                style={{ background: b.color }}
              />
              <div className="p-5 pl-6">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    to={`/boards/${b.id}`}
                    className="font-display text-2xl font-semibold text-ink hover:opacity-70"
                  >
                    {b.name}
                  </Link>
                  {isAdmin && (
                    <div className="flex shrink-0 gap-2 opacity-0 transition group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => openEdit(b)}
                        className="text-xs font-medium text-mute hover:text-ink"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeBoard(b.id)}
                        className="text-xs font-medium text-mute hover:text-danger"
                      >
                        Borrar
                      </button>
                    </div>
                  )}
                </div>
                {team && (
                  <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-mute">
                    {team.name}
                  </p>
                )}
                <div className="mt-4 max-h-24 overflow-hidden">
                  <Markdown source={b.description_md} />
                </div>
                <Link
                  to={`/boards/${b.id}`}
                  className="mt-5 inline-flex text-sm font-semibold text-ink underline-offset-4 hover:underline"
                >
                  Abrir →
                </Link>
              </div>
            </article>
          )
        })}

        {!boards.length && (
          <button
            type="button"
            onClick={openCreate}
            className="animate-fade-up flex min-h-48 flex-col items-start justify-center rounded-xl border border-dashed border-neutral-300 bg-white p-6 text-left transition hover:border-neutral-400"
          >
            <span className="font-display text-xl font-semibold text-ink">Crea tu primer tablero</span>
            <span className="mt-2 text-sm text-mute">
              Empieza con columnas Backlog → En progreso → Hecho.
            </span>
          </button>
        )}
      </div>

      {mode && (
        <Modal
          title={mode === 'create' ? 'Nuevo tablero' : 'Editar tablero'}
          onClose={closeModal}
          wide
        >
          <form
            className="space-y-4"
            onSubmit={mode === 'create' ? createBoard : updateBoard}
          >
            <label className="block text-sm font-medium">
              Nombre
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="field"
              />
            </label>
            <label className="block text-sm font-medium">
              Equipo (opcional)
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="field"
              >
                <option value="">Sin equipo</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium">
              Color de acento
              <div className="mt-2 flex flex-wrap gap-2">
                {BOARD_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`h-8 w-8 rounded-lg ${
                      color === c ? 'ring-2 ring-offset-2 ring-ink' : ''
                    }`}
                    style={{ background: c }}
                  />
                ))}
              </div>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="field !mt-2 !h-12 !cursor-pointer !p-1"
              />
            </label>
            <label className="block text-sm font-medium">
              Descripción (Markdown)
              <textarea
                rows={6}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="field font-mono text-xs"
              />
            </label>
            {error && <p className="text-sm text-danger">{error}</p>}
            <button type="submit" className="btn-primary w-full !py-3" disabled={saving}>
              {saving
                ? 'Guardando…'
                : mode === 'create'
                  ? 'Crear tablero'
                  : 'Guardar cambios'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}
