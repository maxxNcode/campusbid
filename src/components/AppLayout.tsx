import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '../lib/auth-context'
import { signOut } from '../lib/accounts'

export default function AppLayout() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [signOutError, setSignOutError] = useState('')

  async function handleSignOut() {
    setSignOutError('')
    try {
      await signOut()
      navigate('/sign-in', { replace: true })
    } catch {
      setSignOutError('Sign out failed. Check your connection and try again.')
    }
  }

  return (
    <>
      <header className="border-bottom">
        <nav className="container d-flex flex-wrap align-items-center gap-3 py-2" aria-label="Main">
          <NavLink to="/" className="fw-bold text-decoration-none me-auto">
            CampusBid
          </NavLink>
          <NavLink to="/" end>
            Browse
          </NavLink>
          {profile?.is_admin && <NavLink to="/admin/approvals">Account approvals</NavLink>}
          <span className="text-body-secondary">{profile?.full_name}</span>
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={handleSignOut}>
            Sign out
          </button>
        </nav>
        {signOutError && (
          <p className="container text-danger mb-2" role="alert">
            {signOutError}
          </p>
        )}
      </header>
      <main className="container py-4">
        <Outlet />
      </main>
    </>
  )
}
