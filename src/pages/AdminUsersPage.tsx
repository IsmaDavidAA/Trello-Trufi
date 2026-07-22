import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Modal, PageHeader } from '../components/Modal'
import { appOriginBase, inviteUrl } from '../lib/urls'
import type { Invite, Profile, Role } from '../lib/types'

function resetPasswordUrl(token: string) {
  return `${appOriginBase()}/#/reset/${token}`
}

export function AdminUsersPage() {
  const { profile, isAdmin } = useAuth()
  const [invites, setInvites] = useState<Invite[]>([])
  const [users, setUsers] = useState<Profile[]>([])
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<Role>('member')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [createdLink, setCreatedLink] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

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
    setNotice('Invitación creada.')
    setEmail('')
    setFullName('')
    setOpen(false)
    await load()
  }

  async function changeRole(user: Profile, next: Role) {
    if (user.id === profile?.id) {
      setNotice('No puedes cambiar tu propio rol aquí.')
      return
    }
    setBusyId(user.id)
    setNotice(null)
    const { error: err } = await supabase
      .from('profiles')
      .update({ role: next })
      .eq('id', user.id)
    setBusyId(null)
    if (err) {
      setNotice(err.message)
      return
    }
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role: next } : u)))
    setNotice(`Rol de ${user.email} → ${next}`)
  }

  async function deleteUser(user: Profile) {
    if (user.id === profile?.id) {
      setNotice('No puedes borrarte a ti mismo.')
      return
    }
    if (!confirm(`¿Borrar permanentemente a ${user.email}? Se eliminará su cuenta.`)) return
    setBusyId(user.id)
    setNotice(null)
    const { error: err } = await supabase.rpc('admin_delete_user', { target_id: user.id })
    setBusyId(null)
    if (err) {
      setNotice(
        err.message.includes('function') || err.message.includes('schema cache')
          ? 'Falta ejecutar supabase/admin_users.sql en Supabase.'
          : err.message,
      )
      return
    }
    setUsers((prev) => prev.filter((u) => u.id !== user.id))
    setNotice(`Usuario ${user.email} eliminado.`)
  }

  async function createPasswordLink(user: Profile) {
    setBusyId(user.id)
    setNotice(null)
    setCreatedLink(null)
    const { data, error: err } = await supabase.rpc('admin_create_password_reset', {
      target_id: user.id,
    })
    setBusyId(null)
    if (err) {
      setNotice(
        err.message.includes('function') || err.message.includes('schema cache')
          ? 'Falta ejecutar supabase/admin_users.sql en Supabase.'
          : err.message,
      )
      return
    }
    const link = resetPasswordUrl(String(data))
    setCreatedLink(link)
    void navigator.clipboard.writeText(link)
    setNotice(`Link de contraseña para ${user.email} (copiado).`)
  }

  async function deleteInvite(inv: Invite) {
    if (!confirm(`¿Borrar invitación de ${inv.email}?`)) return
    setBusyId(inv.id)
    const { error: err } = await supabase.from('invites').delete().eq('id', inv.id)
    setBusyId(null)
    if (err) {
      setNotice(err.message)
      return
    }
    setInvites((prev) => prev.filter((i) => i.id !== inv.id))
    setNotice('Invitación borrada.')
  }

  return (
    <div>
      <PageHeader
        title="Usuarios"
        subtitle="Gestiona roles, borrados, renovación de contraseña e invitaciones."
        action={
          <button type="button" onClick={() => setOpen(true)} className="btn-primary">
            Nueva invitación
          </button>
        }
      />

      {(createdLink || notice) && (
        <div className="animate-fade-up mb-6 rounded-xl border border-line bg-neutral-50 p-4 text-sm">
          {notice && <p className="font-semibold text-ink">{notice}</p>}
          {createdLink && (
            <>
              <p className="mt-1 text-mute">Copia y envía este enlace:</p>
              <code className="mt-2 block break-all rounded-lg bg-white px-3 py-2 text-ink">
                {createdLink}
              </code>
            </>
          )}
        </div>
      )}

      <section className="mb-8">
        <h2 className="mb-3 font-display text-xl font-semibold">Equipo activo</h2>
        <div className="overflow-x-auto overflow-hidden rounded-2xl border border-line bg-surface/90">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-canvas text-mute">
              <tr>
                <th className="px-4 py-3 font-semibold">Nombre</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Rol</th>
                <th className="px-4 py-3 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === profile?.id
                const busy = busyId === u.id
                return (
                  <tr key={u.id} className="border-t border-line">
                    <td className="px-4 py-3 font-medium">
                      {u.full_name}
                      {isSelf && <span className="ml-1 text-xs text-mute">(tú)</span>}
                    </td>
                    <td className="px-4 py-3 text-mute">{u.email}</td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        disabled={isSelf || busy}
                        onChange={(e) => void changeRole(u, e.target.value as Role)}
                        className="rounded-md border border-line bg-white px-2 py-1 text-xs font-semibold uppercase tracking-wide"
                      >
                        <option value="member">member</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          className="text-xs font-semibold text-ink hover:underline disabled:opacity-40"
                          onClick={() => void createPasswordLink(u)}
                        >
                          Link contraseña
                        </button>
                        {!isSelf && (
                          <button
                            type="button"
                            disabled={busy}
                            className="text-xs font-semibold text-danger hover:underline disabled:opacity-40"
                            onClick={() => void deleteUser(u)}
                          >
                            Borrar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
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
              <div className="flex flex-wrap items-center gap-3 text-right">
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
                      setNotice('Enlace de invitación copiado.')
                    }}
                  >
                    Copiar enlace
                  </button>
                )}
                <button
                  type="button"
                  disabled={busyId === inv.id}
                  className="font-semibold text-danger hover:underline disabled:opacity-40"
                  onClick={() => void deleteInvite(inv)}
                >
                  Borrar
                </button>
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
                onChange={(e) => setRole(e.target.value as Role)}
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
