import type { FormEvent } from 'react'
import { useState } from 'react'
import { Navigate } from 'react-router-dom'
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
    <div className="relative flex min-h-full bg-[#f5f5f5]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'linear-gradient(#e5e5e5 1px, transparent 1px), linear-gradient(90deg, #e5e5e5 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 75%)',
        }}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col justify-center gap-12 px-6 py-16 lg:flex-row lg:items-center lg:gap-24">
        <div className="animate-fade-up max-w-md">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-mute">
            Equipo Trufi
          </p>
          <h1 className="mt-3 font-display text-5xl font-extrabold leading-[0.95] tracking-tight text-ink sm:text-6xl">
            Trufi
            <br />
            Board
          </h1>
          <p className="mt-5 text-sm leading-relaxed text-mute">
            Workspace minimalista para tableros, equipos y tareas. Acceso solo con
            invitación.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="animate-fade-up stagger-2 w-full max-w-md rounded-xl border border-line bg-surface p-7 sm:p-8"
        >
          <h2 className="font-display text-xl font-bold tracking-tight text-ink">
            Iniciar sesión
          </h2>
          <p className="mt-1 text-sm text-mute">Usa la cuenta asignada por el admin.</p>

          {!configured && (
            <p className="mt-4 rounded-lg bg-neutral-100 px-3 py-2 text-sm text-danger">
              Falta configurar las variables de Supabase en <code>.env</code>.
            </p>
          )}

          <label className="mt-6 block text-sm font-medium text-ink">
            Correo
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field"
              placeholder="tu@trufi.org"
            />
          </label>
          <label className="mt-4 block text-sm font-medium text-ink">
            Contraseña
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field"
              placeholder="••••••••"
            />
          </label>

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{error}</p>
          )}

          <button
            type="submit"
            disabled={busy || !configured}
            className="btn-primary mt-6 w-full !py-3"
          >
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
