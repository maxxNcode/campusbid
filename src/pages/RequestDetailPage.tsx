import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { useAuth } from '../lib/auth-context'
import { formatManilaDateTime } from '../lib/format'
import { LISTING_STATUS_LABELS, formatPeso } from '../lib/listing-rules'
import { fetchListing, fetchMemberNames } from '../lib/listings'
import RequestActions from '../components/RequestActions'
import { fetchRequest } from '../lib/requests'
import { REQUEST_STATUS_LABELS } from '../lib/request-rules'
import type { Listing, PurchaseRequest } from '../types/database'

type Details = { request: PurchaseRequest; listing: Listing | null; buyerName: string; sellerName: string }
type LoadState = { kind: 'loading' } | { kind: 'missing' } | { kind: 'error' } | { kind: 'ready'; details: Details }

export default function RequestDetailPage() {
  const { id } = useParams()
  const requestId = Number(id)
  const { session } = useAuth()
  const location = useLocation()
  const sent = (location.state as { sent?: boolean } | null)?.sent
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [outcome, setOutcome] = useState<{ ok: boolean; message: string } | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        // Row level security returns a request only to its buyer and the
        // listing's seller, so a guessed id looks the same as a missing one.
        const request = Number.isInteger(requestId) ? await fetchRequest(requestId) : null
        if (!request) {
          if (!cancelled) setState({ kind: 'missing' })
          return
        }
        const listing = await fetchListing(request.listing_id)
        const names = await fetchMemberNames([request.buyer_id, ...(listing ? [listing.seller_id] : [])])
        if (cancelled) return
        setState({
          kind: 'ready',
          details: {
            request,
            listing,
            buyerName: names.get(request.buyer_id) ?? 'A CampusBid member',
            sellerName: listing ? (names.get(listing.seller_id) ?? 'A CampusBid member') : 'The seller',
          },
        })
      } catch {
        if (!cancelled) setState({ kind: 'error' })
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [requestId, reloadKey])

  if (state.kind === 'loading') return <p>Loading…</p>
  if (state.kind === 'error') return <p role="alert">Could not load this request. Check your connection and reload.</p>
  if (state.kind === 'missing') {
    return (
      <section>
        <h1 className="h3">Request not found</h1>
        <p>This request does not exist, or it is not yours to see.</p>
        <Link to="/my-requests">Back to My Requests</Link>
      </section>
    )
  }

  const { request, listing, buyerName, sellerName } = state.details
  const userId = session?.user.id
  const isBuyer = request.buyer_id === userId
  const priceChanged = listing !== null && Number(listing.price) !== Number(request.price_seen)

  return (
    <article>
      {sent && (
        <p className="alert alert-success" role="status">
          Your request is sent. The seller can accept or decline it.
        </p>
      )}
      {outcome && (
        <p className={`alert ${outcome.ok ? 'alert-success' : 'alert-danger'}`} role={outcome.ok ? 'status' : 'alert'}>
          {outcome.message}
        </p>
      )}
      <p>
        <Link to={isBuyer ? '/my-requests' : '/requests-received'}>
          ← {isBuyer ? 'My Requests' : 'Requests Received'}
        </Link>
      </p>
      <h1 className="h3">Request for {listing ? listing.title : 'an item'}</h1>
      <p>
        Request status: <strong>{REQUEST_STATUS_LABELS[request.status]}</strong>
        {listing && <> · Listing status: <strong>{LISTING_STATUS_LABELS[listing.status]}</strong></>}
      </p>

      <dl className="row">
        <dt className="col-sm-4">Item</dt>
        <dd className="col-sm-8">
          {listing ? <Link to={`/listings/${listing.id}`}>{listing.title}</Link> : 'No longer visible to you'}
        </dd>
        <dt className="col-sm-4">Price the buyer saw</dt>
        <dd className="col-sm-8">
          {formatPeso(request.price_seen)}
          {priceChanged && listing && (
            <span className="d-block text-body-secondary">
              The listing price is now {formatPeso(listing.price)}. Confirm the price before you pay.
            </span>
          )}
        </dd>
        <dt className="col-sm-4">Buyer</dt>
        <dd className="col-sm-8">{isBuyer ? 'You' : buyerName}</dd>
        <dt className="col-sm-4">Seller</dt>
        <dd className="col-sm-8">{isBuyer ? sellerName : 'You'}</dd>
        <dt className="col-sm-4">Meetup place</dt>
        <dd className="col-sm-8">{request.meetup_place}</dd>
        <dt className="col-sm-4">Meetup time</dt>
        <dd className="col-sm-8">{formatManilaDateTime(request.meetup_at)} (Manila time)</dd>
        {request.note && (
          <>
            <dt className="col-sm-4">Buyer's note</dt>
            <dd className="col-sm-8 listing-description">{request.note}</dd>
          </>
        )}
        <dt className="col-sm-4">Sent</dt>
        <dd className="col-sm-8">{formatManilaDateTime(request.created_at)}</dd>
        {request.accepted_at && (
          <>
            <dt className="col-sm-4">Accepted</dt>
            <dd className="col-sm-8">{formatManilaDateTime(request.accepted_at)}</dd>
          </>
        )}
        {request.completed_at && (
          <>
            <dt className="col-sm-4">Completed</dt>
            <dd className="col-sm-8">{formatManilaDateTime(request.completed_at)}</dd>
          </>
        )}
        {request.closed_at && (
          <>
            <dt className="col-sm-4">{request.status === 'declined' ? 'Declined' : 'Cancelled'}</dt>
            <dd className="col-sm-8">
              {formatManilaDateTime(request.closed_at)}
              {request.closed_reason && <span className="d-block">Reason: {request.closed_reason}</span>}
            </dd>
          </>
        )}
      </dl>
      <RequestActions
        request={request}
        role={isBuyer ? 'buyer' : 'seller'}
        itemTitle={listing ? listing.title : 'this item'}
        onDone={(result) => {
          setOutcome(result)
          setReloadKey((key) => key + 1)
        }}
      />
      <p className="text-body-secondary mt-3">
        Payment and handover happen in person, outside CampusBid. Inspect the item before you pay.
      </p>
    </article>
  )
}
