import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Invite } from '../lib/types'

export function InvitePage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { acceptInvite } = useAuth()
  const [invite, setInvite] = useState<Invite | null>(null)
  const [loading, setLoading] = useState(true)
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!token) return
    void (async () => {
      const { data, error: err } = await supabase.rpc('get_invite_by_token', {
        invite_token: token,
      })
      const row = Array.isArray(data) ? data[0] : data
      if (err || !row) setError('Invitación inválida o ya usada.')
      else {
        setInvite(row as Invite)
        setFullName((row as Invite).full_name || '')
      }
      setLoading(false)
    })()
  }, [token])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!invite) return
    setBusy(true)
    setError(null)
    const err = await acceptInvite(invite.email, password, fullName.trim())
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    navigate('/', { replace: true })
  }

  if (loading) {
    return <p className="p-8 text-center text-ink/60">Cargando invitación…</p>
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-sand px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-ink/10 bg-white p-8 shadow-lg">
        <h1 className="font-display text-3xl text-moss-deep">Activar cuenta</h1>
        {invite ? (
          <>
            <p className="mt-2 text-sm text-ink/65">
              Invitación para <strong>{invite.email}</strong>
            </p>
            <form className="mt-6 space-y-4" onSubmit={onSubmit}>
              <label className="block text-sm">
                <span className="mb-1 block text-ink/70">Nombre</span>
                <input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-xl border border-ink/15 px-3 py-2.5 outline-none ring-moss focus:ring-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-ink/70">Contraseña</span>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-ink/15 px-3 py-2.5 outline-none ring-moss focus:ring-2"
                />
              </label>
              {error && (
                <p className="rounded-lg bg-coral/10 px-3 py-2 text-sm text-coral">{error}</p>
              )}
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-moss px-4 py-3 text-sm font-semibold text-white hover:bg-moss-deep disabled:opacity-50"
              >
                {busy ? 'Creando…' : 'Crear cuenta'}
              </button>
            </form>
          </>
        ) : (
          <p className="mt-4 text-coral">{error || 'Invitación no válida.'}</p>
        )}
        <p className="mt-5 text-center text-sm">
          <Link to="/login" className="text-moss underline">
            Ir al login
          </Link>
        </p>
      </div>
    </div>
  )
}
