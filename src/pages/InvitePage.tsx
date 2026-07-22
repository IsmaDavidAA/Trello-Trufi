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
    return <p className="p-10 text-center text-mute">Cargando invitación…</p>
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-[#f5f5f5] px-4 py-12">
      <div className="animate-fade-up w-full max-w-md rounded-xl border border-line bg-white p-8">
        <h1 className="font-display text-3xl font-semibold text-ink">
          Activar cuenta
        </h1>
        {invite ? (
          <>
            <p className="mt-2 text-sm text-mute">
              Invitación para <strong className="text-ink">{invite.email}</strong>
            </p>
            <form className="mt-6 space-y-4" onSubmit={onSubmit}>
              <label className="block text-sm font-medium">
                Nombre
                <input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="field"
                />
              </label>
              <label className="block text-sm font-medium">
                Contraseña
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="field"
                />
              </label>
              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{error}</p>
              )}
              <button type="submit" disabled={busy} className="btn-primary w-full !py-3">
                {busy ? 'Creando…' : 'Crear cuenta'}
              </button>
            </form>
          </>
        ) : (
          <p className="mt-4 text-danger">{error || 'Invitación no válida.'}</p>
        )}
        <p className="mt-6 text-center text-sm">
          <Link to="/login" className="font-semibold text-ink hover:underline">
            Ir al login
          </Link>
        </p>
      </div>
    </div>
  )
}
