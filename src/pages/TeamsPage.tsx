import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Modal } from '../components/Modal'
import { Markdown } from '../components/Markdown'
import type { Profile, Team, TeamMember } from '../lib/types'

export function TeamsPage() {
  const { profile } = useAuth()
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
    const { data, error: err } = await supabase
      .from('teams')
      .insert({
        name: name.trim(),
        description_md: description,
        created_by: profile?.id,
      })
      .select('*')
      .single()
    if (err) {
      setError(err.message)
      return
    }
    if (profile && data) {
      await supabase.from('team_members').insert({
        team_id: (data as Team).id,
        user_id: profile.id,
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-moss-deep">Equipos</h1>
          <p className="mt-1 text-sm text-ink/60">
            Organiza grupos con descripción en Markdown y asígnalos a tableros.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-xl bg-moss px-4 py-2.5 text-sm font-semibold text-white hover:bg-moss-deep"
        >
          Nuevo equipo
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {teams.map((t) => (
          <article
            key={t.id}
            className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <Link to={`/teams/${t.id}`} className="font-display text-xl text-moss-deep hover:underline">
                {t.name}
              </Link>
              <button
                type="button"
                onClick={() => void removeTeam(t.id)}
                className="text-xs text-coral/80 hover:text-coral"
              >
                Borrar
              </button>
            </div>
            <div className="mt-3 max-h-40 overflow-hidden">
              <Markdown source={t.description_md} />
            </div>
          </article>
        ))}
        {!teams.length && (
          <p className="text-sm text-ink/50">Aún no hay equipos. Crea el primero.</p>
        )}
      </div>

      {open && (
        <Modal title="Nuevo equipo" onClose={() => setOpen(false)} wide>
          <form className="space-y-3" onSubmit={createTeam}>
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
              Descripción (Markdown)
              <textarea
                rows={8}
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

  if (!team) return <p className="text-ink/50">Cargando…</p>

  return (
    <div className="space-y-6">
      <Link to="/teams" className="text-sm text-moss hover:underline">
        ← Equipos
      </Link>
      <h1 className="font-display text-3xl text-moss-deep">{team.name}</h1>

      <section className="rounded-2xl border border-ink/10 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl">Descripción</h2>
          <button
            type="button"
            className="text-sm text-moss underline"
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
            className="w-full rounded-xl border border-ink/15 px-3 py-2 font-mono text-xs"
          />
        ) : (
          <Markdown source={team.description_md} />
        )}
      </section>

      <section className="rounded-2xl border border-ink/10 bg-white p-5">
        <h2 className="mb-3 font-display text-xl">Miembros</h2>
        <ul className="space-y-2 text-sm">
          {members.map((m) => (
            <li key={m.user_id} className="flex items-center justify-between gap-2">
              <span>
                {m.profile?.full_name || m.user_id}{' '}
                <span className="text-ink/45">({m.role})</span>
              </span>
              <button
                type="button"
                className="text-coral/80"
                onClick={() => void removeMember(m.user_id)}
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <select
            value={addUserId}
            onChange={(e) => setAddUserId(e.target.value)}
            className="rounded-xl border border-ink/15 px-3 py-2 text-sm"
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
          <button
            type="button"
            onClick={() => void addMember()}
            className="rounded-xl bg-moss px-3 py-2 text-sm font-semibold text-white"
          >
            Agregar
          </button>
        </div>
      </section>
    </div>
  )
}
