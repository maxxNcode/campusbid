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
  const [busy, setBusy] = useState(false)
  const fieldId = `reason-${request.id}`

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true)
    try {
      await action()
      setReason('')
      onDone({ ok: true, message: success })
    } catch (error) {
      onDone({ ok: false, message: requestErrorMessage(error as { code?: string; message: string }) })
    } finally {
      setBusy(false)
    }
  }

  function accept() {
    const confirmed = window.confirm(
      `Accept this request for "${itemTitle}"? The item becomes reserved and your other pending requests for it are declined.`,
    )
    if (confirmed) run(() => acceptPurchaseRequest(request.id), 'Request accepted. The item is reserved.')
  }

  function decline() {
    if (reasonProblem(reason) && reason.trim() !== '') {
      setReasonError(reasonProblem(reason) ?? '')
      return
    }
    setReasonError('')
    if (window.confirm(`Decline this request for "${itemTitle}"? The buyer cannot send another request for this item.`)) {
      run(() => declinePurchaseRequest(request.id, reason), 'Request declined.')
    }
  }

  function cancel() {
    const problem = reasonProblem(reason)
    setReasonError(problem ?? '')
    if (problem) return
    const warning =
      request.status === 'accepted'
        ? `Cancel the arrangement for "${itemTitle}"? The item becomes available again.`
        : `Cancel your request for "${itemTitle}"? You cannot send another request for this item.`
    if (window.confirm(warning)) run(() => cancelPurchaseRequest(request.id, reason), 'Request cancelled.')
  }

  function complete() {
    const confirmed = window.confirm(
      `Mark "${itemTitle}" as handed over? The request is completed and the item is marked sold. This cannot be undone.`,
    )
    if (confirmed) run(() => completePurchaseRequest(request.id), 'Handover recorded. The item is sold.')
  }

  const buyerCanCancel = role === 'buyer' && (request.status === 'pending' || request.status === 'accepted')
  const sellerPending = role === 'seller' && request.status === 'pending'
  const sellerAccepted = role === 'seller' && request.status === 'accepted'
  if (!buyerCanCancel && !sellerPending && !sellerAccepted) return null

  const reasonLabel = sellerPending ? 'Reason for declining (optional)' : 'Reason for cancelling'

  return (
    <div className="border rounded p-3 mt-3">
      <div className="mb-3">
        <label htmlFor={fieldId} className="form-label">{reasonLabel}</label>
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
            <button type="button" className="btn btn-primary" onClick={accept} disabled={busy}>Accept request</button>
            <button type="button" className="btn btn-outline-secondary" onClick={decline} disabled={busy}>Decline request</button>
          </>
        )}
        {sellerAccepted && (
          <button type="button" className="btn btn-primary" onClick={complete} disabled={busy}>Mark as handed over</button>
        )}
        {(buyerCanCancel || sellerAccepted) && (
          <button type="button" className="btn btn-outline-danger" onClick={cancel} disabled={busy}>
            {role === 'seller' ? 'Cancel arrangement' : 'Cancel request'}
          </button>
        )}
      </div>
    </div>
  )
}
