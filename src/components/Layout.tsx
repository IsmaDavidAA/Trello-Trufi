import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const navClass = ({ isActive }: { isActive: boolean }) =>
  `relative px-3 py-2 text-sm font-semibold tracking-tight transition ${
    isActive
      ? 'text-ink after:absolute after:inset-x-3 after:bottom-0 after:h-px after:bg-ink'
      : 'text-mute hover:text-ink'
  }`

export function Layout() {
  const { profile, isAdmin, signOut } = useAuth()
  const initials = (profile?.full_name || profile?.email || '?')
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-40 border-b border-line/70 bg-canvas/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] items-center gap-6 px-4 py-3.5 sm:px-6">
          <Link to="/" className="group flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-ink text-[11px] font-bold tracking-wider text-white">
              TB
            </span>
            <span className="font-display text-xl font-semibold text-ink">
              Trufi Board
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            <NavLink to="/" end className={navClass}>
              Tableros
            </NavLink>
            <NavLink to="/gantt" className={navClass}>
              Gantt
            </NavLink>
            <NavLink to="/data" className={navClass}>
              Datos
            </NavLink>
            <NavLink to="/teams" className={navClass}>
              Equipos
            </NavLink>
            {isAdmin && (
              <NavLink to="/admin/users" className={navClass}>
                Usuarios
              </NavLink>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <Link
              to="/profile"
              className="flex items-center gap-3 rounded-lg transition hover:opacity-80"
              title="Mi perfil"
            >
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold leading-tight text-ink">
                  {profile?.full_name || 'Mi perfil'}
                </p>
                <p className="text-[11px] uppercase tracking-[0.14em] text-mute">
                  {isAdmin ? 'Admin' : 'Miembro'}
                </p>
              </div>
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-neutral-200 text-xs font-bold text-ink">
                {initials}
              </div>
            </Link>
            <button type="button" onClick={() => void signOut()} className="btn-ghost !py-2">
              Salir
            </button>
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto border-t border-line/60 px-4 py-1 md:hidden">
          <NavLink to="/" end className={navClass}>
            Tableros
          </NavLink>
          <NavLink to="/gantt" className={navClass}>
            Gantt
          </NavLink>
          <NavLink to="/data" className={navClass}>
            Datos
          </NavLink>
          <NavLink to="/teams" className={navClass}>
            Equipos
          </NavLink>
          {isAdmin && (
            <NavLink to="/admin/users" className={navClass}>
              Usuarios
            </NavLink>
          )}
          <NavLink to="/profile" className={navClass}>
            Perfil
          </NavLink>
        </nav>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}
