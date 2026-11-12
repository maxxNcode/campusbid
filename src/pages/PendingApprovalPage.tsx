import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useAuth } from '../lib/auth-context'
import { signOut } from '../lib/accounts'

export default function PendingApprovalPage() {
  const { profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [checking, setChecking] = useState(false)
  const [checkedAgain, setCheckedAgain] = useState(false)

  if (profile?.approval_status === 'approved') {
    return <Navigate to="/" replace />
  }

  async function handleCheckAgain() {
    setChecking(true)
    await refreshProfile()
    setChecking(false)
    setCheckedAgain(true)
  }

  async function handleSignOut() {
    await signOut().catch(() => undefined)
    navigate('/sign-in', { replace: true })
  }

  let heading = 'Account status unavailable'
  let explanation = 'We could not load your account. Check your connection and try again.'
  if (profile?.approval_status === 'pending') {
    heading = 'Your account is waiting for approval'
    explanation =
      'An admin confirms in person that you are a current UC Main Campus student. ' +
      'You can browse and trade once your account is approved. ' +
      'Do not send a student ID photo or student number through this site.'
  } else if (profile?.approval_status === 'rejected') {
    heading = 'Your account was not approved'
    explanation =
      'An admin could not confirm your student status. Speak to a CampusBid admin if you think this is a mistake.'
  }

  return (
    <main className="container py-4 form-narrow">
      <h1 className="h3">{heading}</h1>
      {profile && (
        <p>
          Status: <strong>{profile.approval_status === 'pending' ? 'Pending' : 'Not approved'}</strong>
        </p>
      )}
      <p>{explanation}</p>
      {checkedAgain && profile?.approval_status === 'pending' && (
        <p role="status">Still pending. Please check again later.</p>
      )}
      <div className="d-flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" onClick={handleCheckAgain} disabled={checking}>
          {checking ? 'Checking…' : 'Check again'}
        </button>
        <button type="button" className="btn btn-outline-secondary" onClick={handleSignOut}>
          Sign out
        </button>
      </div>
    </main>
  )
}
