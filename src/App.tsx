import type { ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { InvitePage } from './pages/InvitePage'
import { BoardsPage } from './pages/BoardsPage'
import { BoardPage } from './pages/BoardPage'
import { TeamsPage, TeamDetailPage } from './pages/TeamsPage'
import { AdminUsersPage } from './pages/AdminUsersPage'
import { GanttPage } from './pages/GanttPage'
import { DataPage } from './pages/DataPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'

function Protected({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) {
    return <p className="p-10 text-center text-mute">Cargando…</p>
  }
  if (!session) return <Navigate to="/login" replace />
  return children
}

function TeamDetailRoute() {
  const { teamId } = useParams()
  if (!teamId) return <Navigate to="/teams" replace />
  return <TeamDetailPage teamId={teamId} />
}

export default function App() {
  // HashRouter evita 404 al recargar en GitHub Pages
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/invite/:token" element={<InvitePage />} />
          <Route path="/reset/:token" element={<ResetPasswordPage />} />
          <Route
            element={
              <Protected>
                <Layout />
              </Protected>
            }
          >
            <Route path="/" element={<BoardsPage />} />
            <Route path="/boards/:boardId" element={<BoardPage />} />
            <Route path="/gantt" element={<GanttPage />} />
            <Route path="/data" element={<DataPage />} />
            <Route path="/teams" element={<TeamsPage />} />
            <Route path="/teams/:teamId" element={<TeamDetailRoute />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}
