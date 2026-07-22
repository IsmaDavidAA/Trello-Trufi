import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Modal } from '../components/Modal'
import type { Invite, Profile } from '../lib/types'

export function AdminUsersPage() {
  const { profile, isAdmin } = useAuth()
  const [invites, setInvites] = useState<Invite[]>([])
  const [users, setUsers] = useState<Profile[]>([])
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<'admin' | 'member'>('member')
  const [error, setError] = useState<string | null>(null)
  const [createdLink, setCreatedLink] = useState<string | null>(null)

  const base = useMemo(() => {
    const b = import.meta.env.BASE_URL || '/'
    return `${window.location.origin}${b.endsWith('/') ? b.slice(0, -1) : b}`
  }, [])

  async function load() {
    const [{ data: inv }, { data: prof }] = await Promise.all([
      supabase.from('invites').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    ])
    setInvites((inv as Invite[]) || [])
    setUsers((prof as Profile[]) || [])
  }

  useEffect(() => {
    if (isAdmin) void load()
  }, [isAdmin])

  if (!isAdmin) {
    return <p className="text-coral">Solo administradores.</p>
  }

  async function createInvite(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setCreatedLink(null)
    const { data, error: err } = await supabase
      .from('invites')
      .insert({
        email: email.trim().toLowerCase(),
        full_name: fullName.trim(),
        role,
        created_by: profile?.id,
      })
      .select('*')
      .single()
    if (err) {
      setError(err.message)
      return
    }
    const link = `${base}/invite/${(data as Invite).token}`
    setCreatedLink(link)
    setEmail('')
    setFullName('')
    setOpen(false)
    await load()
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-moss-deep">Usuarios</h1>
          <p className="mt-1 text-sm text-ink/60">
            Solo el admin crea cuentas. Genera una invitación y comparte el enlace.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-xl bg-moss px-4 py-2.5 text-sm font-semibold text-white hover:bg-moss-deep"
        >
          Nueva invitación
        </button>
      </div>

      {createdLink && (
        <div className="rounded-2xl border border-moss/30 bg-white p-4 text-sm">
          <p className="font-medium text-moss-deep">Enlace listo — cópialo y envíalo:</p>
          <code className="mt-2 block break-all rounded-lg bg-sand px-3 py-2">{createdLink}</code>
        </div>
      )}

      <section>
        <h2 className="mb-3 font-display text-xl">Equipo activo</h2>
        <div className="overflow-hidden rounded-2xl border border-ink/10 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-sand/80 text-ink/60">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Rol</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-ink/5">
                  <td className="px-4 py-3">{u.full_name}</td>
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3">{u.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl">Invitaciones</h2>
        <div className="space-y-2">
          {invites.map((inv) => (
            <div
              key={inv.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm"
            >
              <div>
                <p className="font-medium">
                  {inv.full_name || inv.email}{' '}
                  <span className="text-ink/45">({inv.role})</span>
                </p>
                <p className="text-ink/55">{inv.email}</p>
              </div>
              <div className="text-right">
                {inv.used_at ? (
                  <span className="text-moss">Usada</span>
                ) : (
                  <button
                    type="button"
                    className="text-moss underline"
                    onClick={() => {
                      const link = `${base}/invite/${inv.token}`
                      void navigator.clipboard.writeText(link)
                      setCreatedLink(link)
                    }}
                  >
                    Copiar enlace
                  </button>
                )}
              </div>
            </div>
          ))}
          {!invites.length && <p className="text-sm text-ink/50">Sin invitaciones aún.</p>}
        </div>
      </section>

      {open && (
        <Modal title="Nueva invitación" onClose={() => setOpen(false)}>
          <form className="space-y-3" onSubmit={createInvite}>
            <label className="block text-sm">
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              Nombre
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              Rol
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'admin' | 'member')}
                className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2"
              >
                <option value="member">member</option>
                <option value="admin">admin</option>
              </select>
            </label>
            {error && <p className="text-sm text-coral">{error}</p>}
            <button
              type="submit"
              className="w-full rounded-xl bg-moss py-2.5 text-sm font-semibold text-white"
            >
              Crear invitación
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}
