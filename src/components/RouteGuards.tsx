import { Navigate, Outlet } from 'react-router'
import { useAuth } from '../lib/auth-context'

function LoadingNotice() {
  return <p className="container py-4">Loading…</p>
}

// Pages that need a signed-in user.
export function RequireSignedIn() {
  const { session, loading } = useAuth()
  if (loading) return <LoadingNotice />
  if (!session) return <Navigate to="/sign-in" replace />
  return <Outlet />
}

// Sign-in and registration pages: signed-in users go to the app instead.
export function RequireSignedOut() {
  const { session, loading } = useAuth()
  if (loading) return <LoadingNotice />
  if (session) return <Navigate to="/" replace />
  return <Outlet />
}
