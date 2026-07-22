import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { PageHeader } from '../components/Modal'
import { initialsOf } from '../lib/urls'

export function ProfilePage() {
  const { profile, refreshProfile, isAdmin } = useAuth()
  const [fullName, setFullName] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setFullName(profile?.full_name || '')
  }, [profile])

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!profile) return
    setSaving(true)
    setError(null)
    setMessage(null)
    const name = fullName.trim()
    if (!name) {
      setError('El nombre no puede estar vacío.')
      setSaving(false)
      return
    }
    const { error: err } = await supabase
      .from('profiles')
      .update({ full_name: name })
      .eq('id', profile.id)
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    await refreshProfile()
    setMessage('Perfil actualizado.')
  }

  if (!profile) {
    return <p className="text-mute">Cargando perfil…</p>
  }

  const initials = initialsOf(profile.full_name || profile.email)

  return (
    <div>
      <PageHeader
        title="Mi perfil"
        subtitle="Así te ven en tableros, asignaciones y el equipo."
      />

      <div className="max-w-lg rounded-xl border border-line bg-surface p-6">
        <div className="mb-6 flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-xl bg-neutral-200 text-lg font-bold text-ink">
            {initials}
          </div>
          <div>
            <p className="font-display text-xl font-semibold text-ink">
              {profile.full_name || 'Sin nombre'}
            </p>
            <p className="text-sm text-mute">{profile.email}</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-mute">
              {isAdmin ? 'Admin' : 'Miembro'}
            </p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={save}>
          <label className="block text-sm font-medium">
            Nombre para mostrar
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Tu nombre y apellido"
              className="field"
            />
          </label>
          <label className="block text-sm font-medium">
            Correo
            <input
              value={profile.email}
              disabled
              className="field opacity-70"
            />
            <span className="mt-1 block text-xs text-mute">
              El correo no se puede cambiar desde aquí.
            </span>
          </label>

          {error && <p className="text-sm text-danger">{error}</p>}
          {message && <p className="text-sm text-ink">{message}</p>}

          <button type="submit" className="btn-primary w-full !py-3" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar perfil'}
          </button>
        </form>
      </div>
    </div>
  )
}
