import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function LoginPage() {
  const { session, configured, signIn, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!loading && session) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const err = await signIn(email.trim(), password)
    setBusy(false)
    if (err) setError(err)
  }

  return (
    <div className="relative flex min-h-full items-center justify-center overflow-hidden px-4 py-10">
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 20% 10%, rgba(14,165,233,0.25), transparent 45%), radial-gradient(ellipse at 80% 0%, rgba(217,119,6,0.22), transparent 40%), linear-gradient(160deg, #0a4f4a 0%, #0c1f1a 55%, #12352e 100%)',
        }}
      />
      <div className="relative w-full max-w-md rounded-3xl bg-sand p-8 shadow-2xl">
        <p className="font-display text-4xl text-moss-deep">Trufi Board</p>
        <p className="mt-2 text-sm text-ink/65">
          Gestión del equipo Trufi. Acceso solo con cuenta creada por un admin.
        </p>

        {!configured && (
          <p className="mt-4 rounded-xl bg-coral/10 px-3 py-2 text-sm text-coral">
            Falta configurar <code>VITE_SUPABASE_URL</code> y{' '}
            <code>VITE_SUPABASE_ANON_KEY</code> en <code>.env</code>.
          </p>
        )}

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block text-sm">
            <span className="mb-1 block text-ink/70">Correo</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 outline-none ring-moss focus:ring-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-ink/70">Contraseña</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 outline-none ring-moss focus:ring-2"
            />
          </label>
          {error && (
            <p className="rounded-lg bg-coral/10 px-3 py-2 text-sm text-coral">{error}</p>
          )}
          <button
            type="submit"
            disabled={busy || !configured}
            className="w-full rounded-xl bg-moss px-4 py-3 text-sm font-semibold text-white hover:bg-moss-deep disabled:opacity-50"
          >
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
        <p className="mt-5 text-center text-xs text-ink/50">
          ¿Te invitaron? Usa el enlace del admin. <Link to="/">Inicio</Link>
        </p>
      </div>
    </div>
  )
}
