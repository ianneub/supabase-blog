import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../context/auth-context'

export default function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <p className="muted">Loading…</p>
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />

  return <Outlet />
}
