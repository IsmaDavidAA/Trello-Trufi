import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Modal, PageHeader } from '../components/Modal'
import { inviteUrl } from '../lib/urls'
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
    return <p className="text-danger">Solo administradores.</p>
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
    const link = inviteUrl((data as Invite).token)
    setCreatedLink(link)
    setEmail('')
    setFullName('')
    setOpen(false)
    await load()
  }

  return (
    <div>
      <PageHeader
        title="Usuarios"
        subtitle="Solo el admin crea cuentas. Genera un enlace de invitación y compártelo."
        action={
          <button type="button" onClick={() => setOpen(true)} className="btn-primary">
            Nueva invitación
          </button>
        }
      />

      {createdLink && (
        <div className="animate-fade-up mb-6 rounded-xl border border-line bg-neutral-50 p-4 text-sm">
          <p className="font-semibold text-ink">Enlace listo — cópialo y envíalo:</p>
          <code className="mt-2 block break-all rounded-lg bg-white px-3 py-2 text-ink">
            {createdLink}
          </code>
        </div>
      )}

      <section className="mb-8">
        <h2 className="mb-3 font-display text-xl font-semibold">Equipo activo</h2>
        <div className="overflow-hidden rounded-2xl border border-line bg-surface/90">
          <table className="w-full text-left text-sm">
            <thead className="bg-canvas text-mute">
              <tr>
                <th className="px-4 py-3 font-semibold">Nombre</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Rol</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-line">
                  <td className="px-4 py-3 font-medium">{u.full_name}</td>
                  <td className="px-4 py-3 text-mute">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-canvas px-2 py-0.5 text-xs font-bold uppercase tracking-wide">
                      {u.role}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl font-semibold">Invitaciones</h2>
        <div className="space-y-2">
          {invites.map((inv) => (
            <div
              key={inv.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface/90 px-4 py-3 text-sm"
            >
              <div>
                <p className="font-semibold">
                  {inv.full_name || inv.email}{' '}
                  <span className="text-mute">({inv.role})</span>
                </p>
                <p className="text-mute">{inv.email}</p>
              </div>
              <div className="text-right">
                {inv.used_at ? (
                  <span className="text-ok">Usada</span>
                ) : (
                  <button
                    type="button"
                    className="font-semibold text-ink hover:underline"
                    onClick={() => {
                      const link = inviteUrl(inv.token)
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
          {!invites.length && <p className="text-sm text-mute">Sin invitaciones aún.</p>}
        </div>
      </section>

      {open && (
        <Modal title="Nueva invitación" onClose={() => setOpen(false)}>
          <form className="space-y-4" onSubmit={createInvite}>
            <label className="block text-sm font-medium">
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field"
              />
            </label>
            <label className="block text-sm font-medium">
              Nombre
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="field"
              />
            </label>
            <label className="block text-sm font-medium">
              Rol
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'admin' | 'member')}
                className="field"
              >
                <option value="member">member</option>
                <option value="admin">admin</option>
              </select>
            </label>
            {error && <p className="text-sm text-danger">{error}</p>}
            <button type="submit" className="btn-primary w-full">
              Crear invitación
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}
