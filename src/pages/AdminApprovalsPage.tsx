import { useEffect, useState } from 'react'
import { fetchPendingAccounts, reviewAccount } from '../lib/accounts'
import { formatManilaDateTime } from '../lib/format'
import type { PendingAccount } from '../types/database'
import { EmptyState, ErrorNotice, Loading, PageHeader } from '../components/ui'
import { useConfirm } from '../components/use-confirm'

type Decision = 'approved' | 'rejected'

export default function AdminApprovalsPage() {
  const [accounts, setAccounts] = useState<PendingAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [busyAccountId, setBusyAccountId] = useState<string | null>(null)
  const [confirm, dialog] = useConfirm()

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
    const approve = decision === 'approved'
    const ok = await confirm({
      title: approve ? `Approve ${account.full_name}?` : `Reject ${account.full_name}?`,
      body: (
        <p>
          {account.email}, {account.program}, year {account.year_level}.{' '}
          {approve
            ? 'They can buy and sell on CampusBid straight away.'
            : 'They cannot use CampusBid with this account.'}
        </p>
      ),
      confirmLabel: approve ? 'Approve' : 'Reject',
      danger: !approve,
    })
    if (!ok) return

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
      {dialog}
      <PageHeader title="Account approvals">
        Approve an applicant only after confirming in person that they are a current UC Main Campus student and that
        the name and program below match. Do not collect or keep student ID photos or student numbers. Your name and
        the time are recorded with each decision.
      </PageHeader>

      {actionMessage && (
        <p className="alert alert-success" role="status">
          {actionMessage}
        </p>
      )}
      {actionError && <ErrorNotice>{actionError}</ErrorNotice>}

      {loading && <Loading>Loading pending accounts…</Loading>}
      {loadError && <ErrorNotice>{loadError}</ErrorNotice>}
      {!loading && !loadError && accounts.length === 0 && (
        <EmptyState title="No accounts are waiting for approval.">New registrations show up here until an admin reviews them.</EmptyState>
      )}

      {accounts.length > 0 && (
        <>
          <p className="cb-muted mb-2">
            {accounts.length} {accounts.length === 1 ? 'account is' : 'accounts are'} waiting, oldest first.
          </p>
          <ul className="list-unstyled d-grid gap-3 mb-0">
            {accounts.map((account) => (
              <li key={account.id} className="cb-card cb-card-body">
                <div className="d-flex flex-wrap align-items-start gap-2 mb-2">
                  <h2 className="cb-row-title mb-0 me-auto">{account.full_name}</h2>
                  <span className="cb-badge cb-badge--amber">Pending</span>
                </div>
                <dl className="cb-facts mb-3">
                  <div>
                    <dt>Email</dt>
                    <dd className="text-break-anywhere">{account.email}</dd>
                  </div>
                  <div>
                    <dt>Program and year</dt>
                    <dd>
                      {account.program}, year {account.year_level}
                    </dd>
                  </div>
                  <div>
                    <dt>Registered</dt>
                    <dd>{formatManilaDateTime(account.created_at)}</dd>
                  </div>
                </dl>
                <div className="d-flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busyAccountId !== null}
                    onClick={() => handleDecision(account, 'approved')}
                  >
                    {busyAccountId === account.id ? 'Saving…' : 'Approve'}
                    <span className="visually-hidden"> {account.full_name}</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-danger"
                    disabled={busyAccountId !== null}
                    onClick={() => handleDecision(account, 'rejected')}
                  >
                    Reject<span className="visually-hidden"> {account.full_name}</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
