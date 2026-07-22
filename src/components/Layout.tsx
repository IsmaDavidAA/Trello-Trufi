import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition ${
    isActive ? 'bg-moss text-white' : 'text-ink/70 hover:bg-white/70 hover:text-ink'
  }`

export function Layout() {
  const { profile, isAdmin, signOut } = useAuth()

  return (
    <div className="min-h-full bg-sand">
      <header className="sticky top-0 z-40 border-b border-ink/10 bg-sand/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="font-display text-2xl tracking-tight text-moss-deep">
            Trufi Board
          </Link>
          <nav className="flex flex-wrap items-center gap-1">
            <NavLink to="/" end className={linkClass}>
              Tableros
            </NavLink>
            <NavLink to="/teams" className={linkClass}>
              Equipos
            </NavLink>
            {isAdmin && (
              <NavLink to="/admin/users" className={linkClass}>
                Usuarios
              </NavLink>
            )}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-ink/60 sm:inline">
              {profile?.full_name || profile?.email}
              {isAdmin ? ' · admin' : ''}
            </span>
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-lg border border-ink/15 px-3 py-1.5 hover:bg-white"
            >
              Salir
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
