import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from '../lib/supabase'
import type { Profile } from '../lib/types'

type AuthState = {
  session: Session | null
  profile: Profile | null
  loading: boolean
  configured: boolean
  isAdmin: boolean
  refreshProfile: () => Promise<void>
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
  acceptInvite: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<string | null>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshProfile = useCallback(async () => {
    const uid = (await supabase.auth.getUser()).data.user?.id
    if (!uid) {
      setProfile(null)
      return
    }
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle()
    setProfile((data as Profile) ?? null)
  }, [])

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) void refreshProfile()
    else setProfile(null)
  }, [session, refreshProfile])

  const value = useMemo<AuthState>(
    () => ({
      session,
      profile,
      loading,
      configured: supabaseConfigured,
      isAdmin: profile?.role === 'admin',
      refreshProfile,
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return error?.message ?? null
      },
      async signOut() {
        await supabase.auth.signOut()
        setProfile(null)
      },
      async acceptInvite(email, password, fullName) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        })

        if (error) {
          const msg = error.message.toLowerCase()
          const code = (error as { code?: string }).code || ''
          if (
            code === 'over_email_send_rate_limit' ||
            msg.includes('rate limit') ||
            msg.includes('email rate')
          ) {
            return (
              'Límite de emails de Supabase alcanzado. En el Dashboard: Authentication → Providers → Email → desactiva “Confirm email”. ' +
              'Luego espera ~1 hora (o usa otro email de prueba) e inténtalo de nuevo.'
            )
          }
          if (msg.includes('already') || msg.includes('registered')) {
            const { error: signInErr } = await supabase.auth.signInWithPassword({
              email,
              password,
            })
            return signInErr
              ? 'Esa cuenta ya existe. Usa “Ir al login” con la misma contraseña, o pide una nueva invitación.'
              : null
          }
          return error.message
        }

        // Si “Confirm email” está activo, signup no deja sesión
        if (!data.session) {
          const { error: signInErr } = await supabase.auth.signInWithPassword({
            email,
            password,
          })
          if (signInErr) {
            return (
              'Cuenta creada, pero Auth pide confirmar el correo. Desactiva “Confirm email” en Supabase ' +
              '(Authentication → Providers → Email) para que las invitaciones funcionen sin email.'
            )
          }
        }

        return null
      },
    }),
    [session, profile, loading, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth fuera de AuthProvider')
  return ctx
}
