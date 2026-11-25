import { useState } from 'react'
import { useNavigate } from 'react-router'
import { demoAccounts, demoCurrentUserId, resetDemoData, switchDemoAccount } from '../lib/demo'
import { useAuth } from '../lib/auth-context'
import { useConfirm } from './use-confirm'

// Shown on every page in offline demo mode (npm run demo), so it cannot be
// mistaken for the real app.
export default function DemoBanner() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const [message, setMessage] = useState('')
  const [confirm, dialog] = useConfirm()
  const accounts = demoAccounts()
  const current = session ? demoCurrentUserId() ?? '' : ''

  function handleSwitch(userId: string) {
    switchDemoAccount(userId || null)
    setMessage('')
    navigate(userId ? '/' : '/sign-in', { replace: true })
  }

  async function handleReset() {
    const ok = await confirm({
      title: 'Reset the demo data?',
      body: <p>Everything made in this demo is removed and the example data comes back.</p>,
      confirmLabel: 'Reset demo data',
      danger: true,
    })
    if (!ok) return
    resetDemoData()
    setMessage('Demo data reset. Sign in again.')
    navigate('/sign-in', { replace: true })
  }

  return (
    <div className="demo-banner" role="region" aria-label="Offline demo mode">
      {dialog}
      <div className="container d-flex flex-wrap align-items-center gap-2 py-2 small">
        <strong className="me-auto">
          Offline demo mode: data is saved only in this browser, not in the CampusBid database.
        </strong>
        <label htmlFor="demo-account" className="visually-hidden">
          Switch demo account
        </label>
        <select
          id="demo-account"
          className="form-select form-select-sm w-auto mw-100"
          value={current}
          onChange={(event) => handleSwitch(event.target.value)}
        >
          <option value="">Switch account: signed out</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} ({account.email}, {account.status})
            </option>
          ))}
        </select>
        <button type="button" className="btn btn-sm btn-dark" onClick={handleReset}>
          Reset demo data
        </button>
        {message && (
          <span role="status" className="w-100">
            {message}
          </span>
        )}
      </div>
    </div>
  )
}
