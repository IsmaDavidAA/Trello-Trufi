import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/Modal'
import type { Board, Card, Column, Profile, Team } from '../lib/types'
import { initialsOf } from '../lib/urls'

type GanttTask = {
  id: string
  title: string
  boardId: string
  boardName: string
  teamId: string | null
  teamName: string | null
  done: boolean
  color: string | null
  start: Date
  end: Date
  dueDate: string | null
  assigneeIds: string[]
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

function daysBetween(a: Date, b: Date) {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000)
}

function formatDay(d: Date) {
  return d.toLocaleDateString('es', { day: '2-digit', month: 'short' })
}

function parseDateOnly(s: string) {
  // YYYY-MM-DD or ISO
  const day = s.slice(0, 10)
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function GanttPage() {
  const [boards, setBoards] = useState<Board[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [tasks, setTasks] = useState<GanttTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [boardId, setBoardId] = useState('')
  const [teamId, setTeamId] = useState('')
  const [userId, setUserId] = useState('')
  const [status, setStatus] = useState<'all' | 'open' | 'done'>('all')
  const [onlyDue, setOnlyDue] = useState(true)
  const [rangeFrom, setRangeFrom] = useState('')
  const [rangeTo, setRangeTo] = useState('')

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [
        { data: boardRows },
        { data: teamRows },
        { data: profileRows },
        { data: columnRows },
        { data: cardRows },
        { data: assignRows },
      ] = await Promise.all([
        supabase.from('boards').select('*').order('name'),
        supabase.from('teams').select('*').order('name'),
        supabase.from('profiles').select('*').order('full_name'),
        supabase.from('columns').select('*'),
        supabase.from('cards').select('*'),
        supabase.from('card_assignees').select('card_id, user_id'),
      ])

      const boardList = (boardRows as Board[]) || []
      const teamList = (teamRows as Team[]) || []
      const cols = (columnRows as Column[]) || []
      const cards = (cardRows as Card[]) || []
      const assigns = (assignRows as { card_id: string; user_id: string }[]) || []

      const boardById = Object.fromEntries(boardList.map((b) => [b.id, b]))
      const teamById = Object.fromEntries(teamList.map((t) => [t.id, t]))
      const colById = Object.fromEntries(cols.map((c) => [c.id, c]))
      const assigneesByCard: Record<string, string[]> = {}
      for (const a of assigns) {
        if (!assigneesByCard[a.card_id]) assigneesByCard[a.card_id] = []
        assigneesByCard[a.card_id].push(a.user_id)
      }

      const built: GanttTask[] = []
      for (const card of cards) {
        const col = colById[card.column_id]
        if (!col) continue
        const board = boardById[col.board_id]
        if (!board) continue

        const created = parseDateOnly(card.created_at)
        const due = card.due_date ? parseDateOnly(card.due_date) : null
        let start = created
        let end = due ?? addDays(created, 1)
        if (end < start) {
          start = end
          end = created > end ? created : addDays(end, 1)
        }

        built.push({
          id: card.id,
          title: card.title,
          boardId: board.id,
          boardName: board.name,
          teamId: board.team_id,
          teamName: board.team_id ? teamById[board.team_id]?.name ?? null : null,
          done: card.done,
          color: card.color || board.color || '#525252',
          start: startOfDay(start),
          end: startOfDay(end),
          dueDate: card.due_date,
          assigneeIds: assigneesByCard[card.id] || [],
        })
      }

      built.sort((a, b) => a.start.getTime() - b.start.getTime() || a.title.localeCompare(b.title))
      setBoards(boardList)
      setTeams(teamList)
      setProfiles((profileRows as Profile[]) || [])
      setTasks(built)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando Gantt')
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (onlyDue && !t.dueDate) return false
      if (boardId && t.boardId !== boardId) return false
      if (teamId && t.teamId !== teamId) return false
      if (userId && !t.assigneeIds.includes(userId)) return false
      if (status === 'open' && t.done) return false
      if (status === 'done' && !t.done) return false
      if (rangeFrom) {
        const from = parseDateOnly(rangeFrom)
        if (t.end < from) return false
      }
      if (rangeTo) {
        const to = parseDateOnly(rangeTo)
        if (t.start > to) return false
      }
      return true
    })
  }, [tasks, boardId, teamId, userId, status, onlyDue, rangeFrom, rangeTo])

  const timeline = useMemo(() => {
    if (!filtered.length) {
      const today = startOfDay(new Date())
      return { start: addDays(today, -7), end: addDays(today, 21), days: 29 }
    }
    let min = filtered[0].start
    let max = filtered[0].end
    for (const t of filtered) {
      if (t.start < min) min = t.start
      if (t.end > max) max = t.end
    }
    // padding
    min = addDays(min, -2)
    max = addDays(max, 3)
    const days = Math.max(daysBetween(min, max) + 1, 14)
    return { start: min, end: max, days }
  }, [filtered])

  const dayWidth = timeline.days > 60 ? 18 : timeline.days > 40 ? 22 : 28
  const chartWidth = timeline.days * dayWidth
  const labelWidth = 260

  const monthTicks = useMemo(() => {
    const ticks: { left: number; label: string; width: number }[] = []
    let cursor = timeline.start
    while (cursor <= timeline.end) {
      const monthStart = cursor
      const nextMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
      const end = nextMonth > timeline.end ? addDays(timeline.end, 1) : nextMonth
      const w = daysBetween(monthStart, end) * dayWidth
      ticks.push({
        left: daysBetween(timeline.start, monthStart) * dayWidth,
        width: Math.max(w, 0),
        label: monthStart.toLocaleDateString('es', { month: 'short', year: 'numeric' }),
      })
      cursor = nextMonth
    }
    return ticks
  }, [timeline, dayWidth])

  const profilesById = useMemo(() => {
    const m: Record<string, Profile> = {}
    for (const p of profiles) m[p.id] = p
    return m
  }, [profiles])

  function clearFilters() {
    setBoardId('')
    setTeamId('')
    setUserId('')
    setStatus('all')
    setOnlyDue(true)
    setRangeFrom('')
    setRangeTo('')
  }

  return (
    <div>
      <PageHeader
        title="Gantt"
        subtitle="Todas las tareas en línea de tiempo. Filtra por tablero, equipo, persona o fechas."
      />

      <div className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface p-4">
        <label className="text-xs font-semibold text-mute">
          Tablero
          <select
            value={boardId}
            onChange={(e) => setBoardId(e.target.value)}
            className="field !mt-1 min-w-[140px]"
          >
            <option value="">Todos</option>
            {boards.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-mute">
          Equipo
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="field !mt-1 min-w-[140px]"
          >
            <option value="">Todos</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-mute">
          Asignado
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="field !mt-1 min-w-[160px]"
          >
            <option value="">Cualquiera</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name || p.email}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-mute">
          Estado
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as 'all' | 'open' | 'done')}
            className="field !mt-1 min-w-[120px]"
          >
            <option value="all">Todos</option>
            <option value="open">Abiertos</option>
            <option value="done">Done</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-mute">
          Desde
          <input
            type="date"
            value={rangeFrom}
            onChange={(e) => setRangeFrom(e.target.value)}
            className="field !mt-1"
          />
        </label>
        <label className="text-xs font-semibold text-mute">
          Hasta
          <input
            type="date"
            value={rangeTo}
            onChange={(e) => setRangeTo(e.target.value)}
            className="field !mt-1"
          />
        </label>
        <label className="mb-2.5 flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={onlyDue}
            onChange={(e) => setOnlyDue(e.target.checked)}
          />
          Solo con fecha límite
        </label>
        <button type="button" onClick={clearFilters} className="btn-ghost mb-0.5">
          Limpiar
        </button>
      </div>

      {loading && <p className="text-sm text-mute">Cargando diagrama…</p>}
      {error && <p className="text-sm text-danger">{error}</p>}

      {!loading && !error && (
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-4 py-3 text-sm">
            <span className="font-semibold text-ink">
              {filtered.length} tarea{filtered.length === 1 ? '' : 's'}
            </span>
            <span className="text-mute">
              {formatDay(timeline.start)} → {formatDay(timeline.end)}
            </span>
          </div>

          {!filtered.length ? (
            <p className="p-8 text-sm text-mute">
              No hay tareas con estos filtros. Prueba desactivar “Solo con fecha límite” o
              ampliar el rango.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <div style={{ minWidth: labelWidth + chartWidth }} className="relative">
                {/* header months */}
                <div className="sticky top-0 z-20 flex border-b border-line bg-neutral-50">
                  <div
                    className="sticky left-0 z-30 shrink-0 border-r border-line bg-neutral-50 px-3 py-2 text-xs font-semibold text-mute"
                    style={{ width: labelWidth }}
                  >
                    Tarea
                  </div>
                  <div className="relative" style={{ width: chartWidth, height: 36 }}>
                    {monthTicks.map((m) => (
                      <div
                        key={`${m.left}-${m.label}`}
                        className="absolute top-0 flex h-full items-center border-r border-line px-2 text-[11px] font-semibold uppercase tracking-wide text-mute"
                        style={{ left: m.left, width: m.width }}
                      >
                        {m.label}
                      </div>
                    ))}
                  </div>
                </div>

                {/* day grid + rows */}
                <div className="relative">
                  {filtered.map((task) => {
                    const left = daysBetween(timeline.start, task.start) * dayWidth
                    const width = Math.max(
                      (daysBetween(task.start, task.end) + 1) * dayWidth - 4,
                      dayWidth * 0.7,
                    )
                    const assignees = task.assigneeIds
                      .map((id) => profilesById[id])
                      .filter(Boolean)
                    return (
                      <div
                        key={task.id}
                        className="flex border-b border-line/80 hover:bg-neutral-50/80"
                        style={{ height: 48 }}
                      >
                        <div
                          className="sticky left-0 z-10 flex shrink-0 flex-col justify-center border-r border-line bg-surface px-3"
                          style={{ width: labelWidth }}
                        >
                          <Link
                            to={`/boards/${task.boardId}`}
                            className="truncate text-sm font-semibold text-ink hover:underline"
                            title={task.title}
                          >
                            {task.title}
                          </Link>
                          <p className="truncate text-[11px] text-mute">
                            {task.boardName}
                            {task.teamName ? ` · ${task.teamName}` : ''}
                            {task.done ? ' · done' : ''}
                          </p>
                        </div>
                        <div className="relative" style={{ width: chartWidth }}>
                          {/* vertical day lines */}
                          <div
                            className="pointer-events-none absolute inset-0"
                            style={{
                              backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent ${dayWidth - 1}px, #ececec ${dayWidth - 1}px, #ececec ${dayWidth}px)`,
                            }}
                          />
                          <Link
                            to={`/boards/${task.boardId}`}
                            className="absolute top-1/2 flex h-7 -translate-y-1/2 items-center gap-1.5 overflow-hidden rounded-md px-2 text-[11px] font-semibold text-white shadow-sm"
                            style={{
                              left: left + 2,
                              width,
                              background: task.done
                                ? '#a3a3a3'
                                : task.color || '#404040',
                              opacity: task.done ? 0.75 : 1,
                            }}
                            title={`${task.title}${task.dueDate ? ` · vence ${task.dueDate}` : ''}`}
                          >
                            <span className="truncate">{task.title}</span>
                            {assignees.length > 0 && (
                              <span className="ml-auto flex shrink-0 gap-0.5">
                                {assignees.slice(0, 3).map((p) => (
                                  <span
                                    key={p.id}
                                    className="grid h-4 w-4 place-items-center rounded-full bg-white/25 text-[8px]"
                                  >
                                    {initialsOf(p.full_name || p.email)}
                                  </span>
                                ))}
                              </span>
                            )}
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
