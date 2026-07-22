import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Modal, PageHeader } from '../components/Modal'
import { Markdown } from '../components/Markdown'
import type { Board, Team } from '../lib/types'

export function BoardsPage() {
  const [boards, setBoards] = useState<Board[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState(
    '## Tablero\n\nLinks útiles:\n- [Docs](https://)\n',
  )
  const [color, setColor] = useState('#525252')
  const [teamId, setTeamId] = useState('')
  const [error, setError] = useState<string | null>(null)

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

  async function createBoard(e: FormEvent) {
    e.preventDefault()
    setError(null)
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
    setOpen(false)
    setName('')
    await load()
  }

  async function removeBoard(id: string) {
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
          <button type="button" onClick={() => setOpen(true)} className="btn-primary">
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
                    className="font-display text-2xl font-bold tracking-tight text-ink hover:opacity-70"
                  >
                    {b.name}
                  </Link>
                  <button
                    type="button"
                    onClick={() => void removeBoard(b.id)}
                    className="text-xs font-medium text-mute opacity-0 transition group-hover:opacity-100 hover:text-danger"
                  >
                    Borrar
                  </button>
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
            onClick={() => setOpen(true)}
            className="animate-fade-up flex min-h-48 flex-col items-start justify-center rounded-xl border border-dashed border-neutral-300 bg-white p-6 text-left transition hover:border-neutral-400"
          >
            <span className="font-display text-xl font-bold text-ink">Crea tu primer tablero</span>
            <span className="mt-2 text-sm text-mute">
              Empieza con columnas Backlog → En progreso → Hecho.
            </span>
          </button>
        )}
      </div>

      {open && (
        <Modal title="Nuevo tablero" onClose={() => setOpen(false)} wide>
          <form className="space-y-4" onSubmit={createBoard}>
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
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="field !h-12 !cursor-pointer !p-1"
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
            <button type="submit" className="btn-primary w-full !py-3">
              Crear tablero
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}
