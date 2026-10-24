import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './auth/AuthContext.jsx'
import AppShell from './components/AppShell.jsx'
import { LoadingScreen } from './components/Ui.jsx'

const LandingPage = lazy(() => import('./pages/LandingPage.jsx'))
const AuthPage = lazy(() => import('./pages/AuthPage.jsx'))
const UserDashboard = lazy(() => import('./pages/UserDashboard.jsx'))
const ProjectsPage = lazy(() => import('./pages/ProjectsPage.jsx'))
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard.jsx'))
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage.jsx'))
const AdminLogsPage = lazy(() => import('./pages/AdminLogsPage.jsx'))
const AdminSettingsPage = lazy(() => import('./pages/AdminSettingsPage.jsx'))

function destination(user) {
  return user?.role === 'ADMIN' ? '/admin' : '/app'
}

function PublicOnly() {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (user) return <Navigate to={destination(user)} replace />
  return <Outlet />
}

function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

function RequireRole({ role }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== role) return <Navigate to={destination(user)} replace />
  return <Outlet />
}

function AppRoutes() {
  return <Suspense fallback={<LoadingScreen />}><Routes>
    <Route path="/" element={<LandingPage />} />
    <Route element={<PublicOnly />}>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
    </Route>
    <Route element={<RequireAuth />}>
      <Route element={<RequireRole role="USER" />}>
        <Route path="/app" element={<AppShell />}>
          <Route index element={<UserDashboard />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route element={<RequireRole role="ADMIN" />}>
        <Route path="/admin" element={<AppShell admin />}>
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="logs" element={<AdminLogsPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
        </Route>
      </Route>
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></Suspense>
}

export default function App() {
  return <BrowserRouter><AppRoutes /></BrowserRouter>
}
