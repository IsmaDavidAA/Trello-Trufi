import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function ResetPasswordPage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [email, setEmail] = useState<string | null>(null)
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!token) return
    void (async () => {
      const { data, error: err } = await supabase.rpc('get_password_reset_by_token', {
        reset_token: token,
      })
      const row = Array.isArray(data) ? data[0] : data
      if (err || !row) {
        setError('Enlace inválido o expirado.')
      } else {
        setEmail((row as { email: string }).email)
        setFullName((row as { full_name: string }).full_name || '')
      }
      setLoading(false)
    })()
  }, [token])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!token) return
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.rpc('complete_password_reset', {
      reset_token: token,
      new_password: password,
    })
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    setDone(true)
    setTimeout(() => navigate('/login', { replace: true }), 1500)
  }

  if (loading) {
    return <p className="p-10 text-center text-mute">Validando enlace…</p>
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-[#f5f5f5] px-4 py-12">
      <div className="animate-fade-up w-full max-w-md rounded-xl border border-line bg-white p-8">
        <h1 className="font-display text-3xl font-semibold text-ink">
          Nueva contraseña
        </h1>
        {email && !done && (
          <p className="mt-2 text-sm text-mute">
            Cuenta de <strong className="text-ink">{fullName || email}</strong>
          </p>
        )}

        {done ? (
          <p className="mt-6 text-sm text-ink">Contraseña actualizada. Redirigiendo al login…</p>
        ) : email ? (
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <label className="block text-sm font-medium">
              Nueva contraseña
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field"
              />
            </label>
            <label className="block text-sm font-medium">
              Confirmar
              <input
                type="password"
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="field"
              />
            </label>
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{error}</p>
            )}
            <button type="submit" disabled={busy} className="btn-primary w-full !py-3">
              {busy ? 'Guardando…' : 'Guardar contraseña'}
            </button>
          </form>
        ) : (
          <p className="mt-4 text-danger">{error || 'Enlace no válido.'}</p>
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
