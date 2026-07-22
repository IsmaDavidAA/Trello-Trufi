import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Modal, PageHeader } from '../components/Modal'
import { Markdown } from '../components/Markdown'
import type { Profile, Team, TeamMember } from '../lib/types'

export function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState(
    '## Equipo\n\n- Objetivo:\n- Canal: [Slack](https://)\n',
  )
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const { data } = await supabase.from('teams').select('*').order('created_at', { ascending: false })
    setTeams((data as Team[]) || [])
  }

  useEffect(() => {
    void load()
  }, [])

  async function createTeam(e: FormEvent) {
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
      .from('teams')
      .insert({
        name: name.trim(),
        description_md: description,
        created_by: user.id,
      })
      .select('*')
      .single()
    if (err) {
      setError(err.message)
      return
    }
    if (data) {
      await supabase.from('team_members').insert({
        team_id: (data as Team).id,
        user_id: user.id,
        role: 'lead',
      })
    }
    setOpen(false)
    setName('')
    await load()
  }

  async function removeTeam(id: string) {
    if (!confirm('¿Borrar este equipo?')) return
    await supabase.from('teams').delete().eq('id', id)
    await load()
  }

  return (
    <div>
      <PageHeader
        title="Equipos"
        subtitle="Grupos con descripción Markdown. Asígnanos a tableros para compartir acceso."
        action={
          <button type="button" onClick={() => setOpen(true)} className="btn-primary">
            Nuevo equipo
          </button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        {teams.map((t, i) => (
          <article
            key={t.id}
            className={`animate-fade-up rounded-xl border border-line bg-surface p-6 transition hover:border-neutral-400 stagger-${Math.min(i + 1, 3)}`}
          >
            <div className="flex items-start justify-between gap-3">
              <Link
                to={`/teams/${t.id}`}
                className="font-display text-2xl font-bold tracking-tight text-ink hover:opacity-70"
              >
                {t.name}
              </Link>
              <button
                type="button"
                onClick={() => void removeTeam(t.id)}
                className="text-xs font-medium text-mute hover:text-danger"
              >
                Borrar
              </button>
            </div>
            <div className="mt-4 max-h-36 overflow-hidden">
              <Markdown source={t.description_md} />
            </div>
            <Link
              to={`/teams/${t.id}`}
              className="mt-5 inline-flex text-sm font-semibold text-ink hover:underline"
            >
              Gestionar →
            </Link>
          </article>
        ))}
        {!teams.length && (
          <p className="animate-fade-up text-sm text-mute">Aún no hay equipos.</p>
        )}
      </div>

      {open && (
        <Modal title="Nuevo equipo" onClose={() => setOpen(false)} wide>
          <form className="space-y-4" onSubmit={createTeam}>
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
              Descripción (Markdown)
              <textarea
                rows={8}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="field font-mono text-xs"
              />
            </label>
            {error && <p className="text-sm text-danger">{error}</p>}
            <button type="submit" className="btn-primary w-full !py-3">
              Crear
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export function TeamDetailPage({ teamId }: { teamId: string }) {
  const [team, setTeam] = useState<Team | null>(null)
  const [members, setMembers] = useState<(TeamMember & { profile?: Profile })[]>([])
  const [users, setUsers] = useState<Profile[]>([])
  const [addUserId, setAddUserId] = useState('')
  const [description, setDescription] = useState('')
  const [editing, setEditing] = useState(false)

  async function load() {
    const [{ data: t }, { data: m }, { data: u }] = await Promise.all([
      supabase.from('teams').select('*').eq('id', teamId).maybeSingle(),
      supabase.from('team_members').select('*').eq('team_id', teamId),
      supabase.from('profiles').select('*'),
    ])
    setTeam((t as Team) || null)
    setDescription((t as Team)?.description_md || '')
    setUsers((u as Profile[]) || [])
    const list = ((m as TeamMember[]) || []).map((row) => ({
      ...row,
      profile: (u as Profile[] | null)?.find((p) => p.id === row.user_id),
    }))
    setMembers(list)
  }

  useEffect(() => {
    void load()
  }, [teamId])

  async function saveDescription() {
    await supabase.from('teams').update({ description_md: description }).eq('id', teamId)
    setEditing(false)
    await load()
  }

  async function addMember() {
    if (!addUserId) return
    await supabase.from('team_members').upsert({
      team_id: teamId,
      user_id: addUserId,
      role: 'member',
    })
    setAddUserId('')
    await load()
  }

  async function removeMember(userId: string) {
    await supabase.from('team_members').delete().eq('team_id', teamId).eq('user_id', userId)
    await load()
  }

  if (!team) return <p className="text-mute">Cargando…</p>

  return (
    <div className="animate-fade-up space-y-6">
      <Link to="/teams" className="text-sm font-semibold text-ink hover:underline">
        ← Equipos
      </Link>
      <h1 className="font-display text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
        {team.name}
      </h1>

      <section className="rounded-xl border border-line bg-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Descripción</h2>
          <button
            type="button"
            className="btn-ghost !py-1.5 !text-xs"
            onClick={() => (editing ? void saveDescription() : setEditing(true))}
          >
            {editing ? 'Guardar' : 'Editar'}
          </button>
        </div>
        {editing ? (
          <textarea
            rows={10}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="field font-mono text-xs"
          />
        ) : (
          <Markdown source={team.description_md} />
        )}
      </section>

      <section className="rounded-xl border border-line bg-surface p-6">
        <h2 className="mb-4 font-display text-xl font-bold">Miembros</h2>
        <ul className="divide-y divide-line">
          {members.map((m) => (
            <li key={m.user_id} className="flex items-center justify-between gap-2 py-3 text-sm">
              <span>
                <span className="font-semibold">{m.profile?.full_name || m.user_id}</span>
                <span className="ml-2 text-mute">({m.role})</span>
              </span>
              <button
                type="button"
                className="text-xs text-danger"
                onClick={() => void removeMember(m.user_id)}
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex flex-wrap gap-2">
          <select
            value={addUserId}
            onChange={(e) => setAddUserId(e.target.value)}
            className="field !mt-0 max-w-xs"
          >
            <option value="">Agregar usuario…</option>
            {users
              .filter((u) => !members.some((m) => m.user_id === u.id))
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.email})
                </option>
              ))}
          </select>
          <button type="button" onClick={() => void addMember()} className="btn-primary">
            Agregar
          </button>
        </div>
      </section>
    </div>
  )
}
