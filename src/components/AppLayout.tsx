import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '../lib/auth-context'
import { signOut } from '../lib/accounts'
import { Wordmark } from './ui'

const NAV_ITEMS = [
  { to: '/', label: 'Browse', end: true },
  { to: '/sell', label: 'Sell an Item' },
  { to: '/my-listings', label: 'My Listings' },
  { to: '/my-requests', label: 'My Requests' },
  { to: '/requests-received', label: 'Requests Received' },
]

function initials(name: string | undefined) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

export default function AppLayout() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [signOutError, setSignOutError] = useState('')
  const [signingOut, setSigningOut] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const accountRef = useRef<HTMLDivElement>(null)

  // Close the account menu on Escape or a click outside it.
  useEffect(() => {
    if (!accountOpen) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setAccountOpen(false)
    }
    function onClick(event: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) setAccountOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [accountOpen])

  function closeMenus() {
    setMenuOpen(false)
    setAccountOpen(false)
  }

  async function handleSignOut() {
    setSignOutError('')
    setSigningOut(true)
    try {
      await signOut()
      navigate('/sign-in', { replace: true })
    } catch {
      setSignOutError('Sign out failed. Check your connection and try again.')
      setSigningOut(false)
    }
  }

  const navClass = ({ isActive }: { isActive: boolean }) => `cb-nav-link${isActive ? ' active' : ''}`

  return (
    <>
      <header className="cb-header">
        <div className="container cb-header-bar">
          <Link to="/" className="cb-brand" onClick={closeMenus} aria-label="CampusBid, go to Browse">
            <Wordmark by />
          </Link>
          <button
            type="button"
            className="btn btn-outline-secondary cb-menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="main-nav"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
              <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Menu
          </button>
          <nav id="main-nav" className={`cb-nav${menuOpen ? ' open' : ''}`} aria-label="Main">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={navClass} onClick={closeMenus}>
                {item.label}
              </NavLink>
            ))}
            {profile?.is_admin && (
              <NavLink to="/admin/approvals" className={navClass} onClick={closeMenus}>
                Admin
              </NavLink>
            )}
            <div className="cb-account" ref={accountRef}>
              <button
                type="button"
                className="cb-account-button"
                aria-expanded={accountOpen}
                aria-controls="account-menu"
                onClick={() => setAccountOpen((open) => !open)}
              >
                <span className="cb-avatar" aria-hidden="true">
                  {initials(profile?.full_name)}
                </span>
                <span className="d-none d-xl-inline">{profile?.full_name}</span>
                <span className="visually-hidden">Account menu for {profile?.full_name}</span>
              </button>
              <div id="account-menu" className="cb-account-menu" hidden={!accountOpen}>
                <div className="cb-account-who">
                  <div className="fw-semibold">{profile?.full_name}</div>
                  <div className="small cb-muted">
                    {profile?.program}
                    {profile?.year_level ? `, year ${profile.year_level}` : ''}
                    {profile?.is_admin ? ' · Admin' : ''}
                  </div>
                </div>
                <button
                  type="button"
                  className="cb-nav-link btn btn-link text-start w-100 text-decoration-none"
                  onClick={handleSignOut}
                  disabled={signingOut}
                >
                  {signingOut ? 'Signing out…' : 'Sign out'}
                </button>
              </div>
            </div>
          </nav>
        </div>
        {signOutError && (
          <p className="container text-danger mb-2" role="alert">
            {signOutError}
          </p>
        )}
      </header>
      <main className="container cb-main">
        <Outlet />
      </main>
      <SiteFooter />
    </>
  )
}

export function SiteFooter() {
  return (
    <footer className="cb-footer">
      <div className="container py-3 d-flex flex-wrap gap-2 justify-content-between">
        <span>
          <strong>CampusBid</strong> by Ctrl+Alt Build. A student project, not an official university service.
        </span>
        <span>Payment and handover happen in person, outside CampusBid. Inspect the item before you pay.</span>
      </div>
    </footer>
  )
}
