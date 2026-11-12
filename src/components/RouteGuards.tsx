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

// Browsing and trading pages: the account must be approved by an admin.
export function RequireApproved() {
  const { profile } = useAuth()
  if (profile?.approval_status !== 'approved') return <Navigate to="/pending" replace />
  return <Outlet />
}

// Admin-only pages.
export function RequireAdmin() {
  const { profile } = useAuth()
  if (!profile?.is_admin) return <Navigate to="/" replace />
  return <Outlet />
}
