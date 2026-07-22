import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Modal } from '../components/Modal'
import { Markdown } from '../components/Markdown'
import type { Board, Team } from '../lib/types'

export function BoardsPage() {
  const { profile } = useAuth()
  const [boards, setBoards] = useState<Board[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState(
    '## Tablero\n\nLinks útiles:\n- [Docs](https://)\n',
  )
  const [color, setColor] = useState('#0f766e')
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
    const { data, error: err } = await supabase
      .from('boards')
      .insert({
        name: name.trim(),
        description_md: description,
        color,
        team_id: teamId || null,
        created_by: profile?.id,
        position: boards.length,
      })
      .select('*')
      .single()
    if (err) {
      setError(err.message)
      return
    }
    const board = data as Board
    // columnas iniciales tipo Trello
    await supabase.from('columns').insert([
      { board_id: board.id, title: 'Backlog', position: 0 },
      { board_id: board.id, title: 'En progreso', position: 1 },
      { board_id: board.id, title: 'Hecho', position: 2 },
    ])
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-moss-deep">Tableros</h1>
          <p className="mt-1 text-sm text-ink/60">
            Estilo Vikunja/Trello: varios tableros, equipos y Kanban.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-xl bg-moss px-4 py-2.5 text-sm font-semibold text-white hover:bg-moss-deep"
        >
          Nuevo tablero
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {boards.map((b) => {
          const team = teams.find((t) => t.id === b.team_id)
          return (
            <article
              key={b.id}
              className="overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-sm"
            >
              <div className="h-2" style={{ background: b.color }} />
              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    to={`/boards/${b.id}`}
                    className="font-display text-xl text-ink hover:text-moss"
                  >
                    {b.name}
                  </Link>
                  <button
                    type="button"
                    onClick={() => void removeBoard(b.id)}
                    className="text-xs text-coral/80"
                  >
                    Borrar
                  </button>
                </div>
                {team && (
                  <p className="mt-1 text-xs font-medium uppercase tracking-wide text-moss">
                    {team.name}
                  </p>
                )}
                <div className="mt-3 max-h-28 overflow-hidden">
                  <Markdown source={b.description_md} />
                </div>
              </div>
            </article>
          )
        })}
        {!boards.length && (
          <p className="text-sm text-ink/50">Crea tu primer tablero para empezar.</p>
        )}
      </div>

      {open && (
        <Modal title="Nuevo tablero" onClose={() => setOpen(false)} wide>
          <form className="space-y-3" onSubmit={createBoard}>
            <label className="block text-sm">
              Nombre
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              Equipo (opcional)
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2"
              >
                <option value="">Sin equipo (visible a miembros con acceso)</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Color
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="mt-1 h-10 w-full cursor-pointer rounded-xl border border-ink/15 bg-white px-2"
              />
            </label>
            <label className="block text-sm">
              Descripción (Markdown)
              <textarea
                rows={6}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2 font-mono text-xs"
              />
            </label>
            {error && <p className="text-sm text-coral">{error}</p>}
            <button
              type="submit"
              className="w-full rounded-xl bg-moss py-2.5 text-sm font-semibold text-white"
            >
              Crear tablero
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}
