import { useState } from 'react'
import {
  acceptPurchaseRequest,
  cancelPurchaseRequest,
  completePurchaseRequest,
  declinePurchaseRequest,
  requestErrorMessage,
} from '../lib/requests'
import { reasonProblem } from '../lib/request-rules'
import type { PurchaseRequest } from '../types/database'
import { useConfirm } from './use-confirm'

type Props = {
  request: PurchaseRequest
  role: 'buyer' | 'seller'
  itemTitle: string
  // Called after every attempt, so the page reloads and shows the real state
  // even when the click was stale. The message is shown above the list.
  onDone: (outcome: { ok: boolean; message: string }) => void
}

export default function RequestActions({ request, role, itemTitle, onDone }: Props) {
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState('')
  const [busy, setBusy] = useState<'' | 'accept' | 'decline' | 'complete' | 'cancel'>('')
  const [openedAt] = useState(() => Date.now())
  const [confirm, dialog] = useConfirm()
  const fieldId = `reason-${request.id}`

  async function run(kind: typeof busy, action: () => Promise<unknown>, success: string) {
    setBusy(kind)
    try {
      await action()
      setReason('')
      onDone({ ok: true, message: success })
    } catch (error) {
      onDone({ ok: false, message: requestErrorMessage(error as { code?: string; message: string }) })
    } finally {
      setBusy('')
    }
  }

  async function accept() {
    const ok = await confirm({
      title: 'Accept this request?',
      body: (
        <p>
          “{itemTitle}” becomes reserved for this buyer, and your other pending requests for it are declined.
        </p>
      ),
      confirmLabel: 'Accept request',
    })
    if (ok) run('accept', () => acceptPurchaseRequest(request.id), 'Request accepted. The item is reserved.')
  }

  async function decline() {
    if (reasonProblem(reason) && reason.trim() !== '') {
      setReasonError(reasonProblem(reason) ?? '')
      return
    }
    setReasonError('')
    const ok = await confirm({
      title: 'Decline this request?',
      body: <p>The buyer cannot send another request for “{itemTitle}”.</p>,
      confirmLabel: 'Decline request',
      danger: true,
    })
    if (ok) run('decline', () => declinePurchaseRequest(request.id, reason), 'Request declined.')
  }

  async function cancel() {
    // Only an accepted arrangement needs a reason; a pending request can be
    // cancelled without one, but a reason that is typed must still be valid.
    const needsReason = request.status === 'accepted'
    const problem = needsReason || reason.trim() !== '' ? reasonProblem(reason) : null
    setReasonError(problem ?? '')
    if (problem) return
    const accepted = request.status === 'accepted'
    const ok = await confirm({
      title: accepted ? 'Cancel this arrangement?' : 'Cancel your request?',
      body: accepted ? (
        <p>The meetup is called off and “{itemTitle}” becomes available again.</p>
      ) : (
        <p>You cannot send another request for “{itemTitle}”.</p>
      ),
      confirmLabel: accepted ? 'Cancel arrangement' : 'Cancel request',
      cancelLabel: 'Keep it',
      danger: true,
    })
    if (ok) run('cancel', () => cancelPurchaseRequest(request.id, reason), 'Request cancelled.')
  }

  async function complete() {
    const ok = await confirm({
      title: 'Mark as handed over?',
      body: (
        <p>
          Do this only after the buyer has the item and you have been paid. The request is completed and “{itemTitle}”
          is marked sold. This cannot be undone.
        </p>
      ),
      confirmLabel: 'Yes, handed over',
    })
    if (ok) run('complete', () => completePurchaseRequest(request.id), 'Handover recorded. The item is sold.')
  }

  const buyerCanCancel = role === 'buyer' && (request.status === 'pending' || request.status === 'accepted')
  const sellerPending = role === 'seller' && request.status === 'pending'
  const sellerAccepted = role === 'seller' && request.status === 'accepted'
  if (!buyerCanCancel && !sellerPending && !sellerAccepted) return null

  const meetupPassed = sellerPending && new Date(request.meetup_at).getTime() <= openedAt
  const reasonLabel = sellerPending
    ? 'Reason for declining (optional)'
    : request.status === 'pending'
      ? 'Reason for cancelling (optional)'
      : 'Reason for cancelling (needed to cancel)'
  const label = (kind: typeof busy, idle: string, working: string) => (busy === kind ? working : idle)

  return (
    <div className="cb-actions">
      {dialog}
      {meetupPassed && (
        <p className="alert alert-warning py-2" role="note">
          The meetup time for this request has passed, so it cannot be accepted. Decline it and ask the buyer for new times.
        </p>
      )}
      <div className="cb-actions-row">
      <div className="cb-reason">
        <label htmlFor={fieldId} className="form-label mb-1">{reasonLabel}</label>
        <input
          id={fieldId}
          type="text"
          maxLength={500}
          className={`form-control${reasonError ? ' is-invalid' : ''}`}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          aria-describedby={reasonError ? `${fieldId}-error` : undefined}
        />
        {reasonError && <div id={`${fieldId}-error`} className="invalid-feedback d-block">{reasonError}</div>}
      </div>
      <div className="d-flex flex-wrap gap-2">
        {sellerPending && (
          <>
            {!meetupPassed && (
              <button type="button" className="btn btn-primary" onClick={accept} disabled={busy !== ''}>
                {label('accept', 'Accept request', 'Accepting…')}
              </button>
            )}
            <button type="button" className="btn btn-outline-danger" onClick={decline} disabled={busy !== ''}>
              {label('decline', 'Decline request', 'Declining…')}
            </button>
          </>
        )}
        {sellerAccepted && (
          <button type="button" className="btn btn-primary" onClick={complete} disabled={busy !== ''}>
            {label('complete', 'Mark as handed over', 'Saving…')}
          </button>
        )}
        {(buyerCanCancel || sellerAccepted) && (
          <button type="button" className="btn btn-outline-danger" onClick={cancel} disabled={busy !== ''}>
            {label('cancel', role === 'seller' ? 'Cancel arrangement' : 'Cancel request', 'Cancelling…')}
          </button>
        )}
      </div>
      </div>
    </div>
  )
}
