import { useEffect, useState } from 'react'
import { fetchPendingAccounts, reviewAccount } from '../lib/accounts'
import { formatManilaDateTime } from '../lib/format'
import type { PendingAccount } from '../types/database'

type Decision = 'approved' | 'rejected'

export default function AdminApprovalsPage() {
  const [accounts, setAccounts] = useState<PendingAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [busyAccountId, setBusyAccountId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchPendingAccounts()
      .then((pendingAccounts) => {
        if (!cancelled) setAccounts(pendingAccounts)
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load pending accounts. Check your connection and reload.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleDecision(account: PendingAccount, decision: Decision) {
    const verb = decision === 'approved' ? 'Approve' : 'Reject'
    if (!window.confirm(`${verb} ${account.full_name} (${account.email})?`)) return

    setBusyAccountId(account.id)
    setActionMessage('')
    setActionError('')
    try {
      await reviewAccount(account.id, decision)
      setActionMessage(
        `${account.full_name} was ${decision === 'approved' ? 'approved' : 'rejected'}.`,
      )
    } catch (error) {
      setActionError(
        error instanceof Error && /already been reviewed/.test(error.message)
          ? `${account.full_name} was already reviewed by another admin.`
          : `Could not save the decision for ${account.full_name}. Try again.`,
      )
    }
    // Reload so a reviewed account disappears, including one reviewed elsewhere.
    try {
      setAccounts(await fetchPendingAccounts())
    } catch {
      setLoadError('Could not reload pending accounts. Reload the page.')
    }
    setBusyAccountId(null)
  }

  return (
    <section>
      <h1 className="h3">Account approvals</h1>
      <p>
        Approve an applicant only after confirming in person that they are a current UC Main Campus
        student and that the name and program below match. Do not collect or keep student ID photos
        or student numbers. Your name and the time are recorded with each decision.
      </p>

      {actionMessage && (
        <p className="text-success" role="status">
          {actionMessage}
        </p>
      )}
      {actionError && (
        <p className="text-danger" role="alert">
          {actionError}
        </p>
      )}

      {loading && <p>Loading pending accounts…</p>}
      {loadError && (
        <p className="text-danger" role="alert">
          {loadError}
        </p>
      )}
      {!loading && !loadError && accounts.length === 0 && <p>No accounts are waiting for approval.</p>}

      {accounts.length > 0 && (
        <ul className="list-unstyled">
          {accounts.map((account) => (
            <li key={account.id} className="border rounded p-3 mb-3">
              <p className="mb-1">
                <strong>{account.full_name}</strong>
              </p>
              <p className="mb-1">{account.email}</p>
              <p className="mb-1">
                {account.program}, Year {account.year_level}
              </p>
              <p className="mb-2 text-body-secondary">
                Registered {formatManilaDateTime(account.created_at)}
              </p>
              <div className="d-flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={busyAccountId !== null}
                  onClick={() => handleDecision(account, 'approved')}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm"
                  disabled={busyAccountId !== null}
                  onClick={() => handleDecision(account, 'rejected')}
                >
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
