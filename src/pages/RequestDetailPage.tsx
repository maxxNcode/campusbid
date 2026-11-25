import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { useAuth } from '../lib/auth-context'
import { formatManilaDateTime } from '../lib/format'
import { formatPeso } from '../lib/listing-rules'
import { fetchListing, fetchMemberNames } from '../lib/listings'
import RequestActions from '../components/RequestActions'
import { fetchRequest } from '../lib/requests'
import { EmptyState, ErrorNotice, ListingStatusBadge, Loading, PageHeader, RequestStatusBadge } from '../components/ui'
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

  if (state.kind === 'loading') return <Loading>Loading the request…</Loading>
  if (state.kind === 'error') return <ErrorNotice>Could not load this request. Check your connection and reload.</ErrorNotice>
  if (state.kind === 'missing') {
    return (
      <EmptyState title="Request not found" action={<Link to="/my-requests" className="btn btn-primary">Back to My Requests</Link>}>
        This request does not exist, or it is not yours to see.
      </EmptyState>
    )
  }

  const { request, listing, buyerName, sellerName } = state.details
  const userId = session?.user.id
  const isBuyer = request.buyer_id === userId
  const priceChanged = listing !== null && Number(listing.price) !== Number(request.price_seen)
  const steps = timeline(request, isBuyer)

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
      <Link to={isBuyer ? '/my-requests' : '/requests-received'} className="cb-back">
        ← {isBuyer ? 'My Requests' : 'Requests Received'}
      </Link>

      <PageHeader title={<>Request for {listing ? listing.title : 'an item'}</>}>
        <span className="d-inline-flex flex-wrap align-items-center gap-2">
          <span>Request status:</span> <RequestStatusBadge status={request.status} />
          {listing && (
            <>
              <span className="ms-sm-2">Listing:</span> <ListingStatusBadge status={listing.status} />
            </>
          )}
        </span>
      </PageHeader>

      <div className="row g-4">
        <div className="col-lg-7 d-grid gap-3 align-content-start">
          <section className="cb-card cb-card-body cb-meetup" aria-labelledby="meetup-heading">
            <h2 id="meetup-heading" className="cb-card-title mb-2">Meetup</h2>
            <p className="fs-5 fw-semibold mb-0">{request.meetup_place}</p>
            <p className="mb-2">{formatManilaDateTime(request.meetup_at)} (Manila time)</p>
            <p className="small cb-muted mb-0">
              Payment and handover happen in person, outside CampusBid. Inspect the item before you pay.
            </p>
          </section>

          <section className="cb-card cb-card-body" aria-labelledby="request-details-heading">
            <h2 id="request-details-heading" className="cb-card-title">Details</h2>
            <dl className="cb-specs">
              <div>
                <dt>Item</dt>
                <dd>{listing ? <Link to={`/listings/${listing.id}`}>{listing.title}</Link> : 'No longer visible to you'}</dd>
              </div>
              <div>
                <dt>Price the buyer saw</dt>
                <dd>
                  <span className="cb-price">{formatPeso(request.price_seen)}</span>
                  {priceChanged && listing && (
                    <span className="d-block small cb-muted">
                      The listing price is now {formatPeso(listing.price)}. Confirm the price before you pay.
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt>Buyer</dt>
                <dd>{isBuyer ? 'You' : buyerName}</dd>
              </div>
              <div>
                <dt>Seller</dt>
                <dd>{isBuyer ? sellerName : 'You'}</dd>
              </div>
              {request.note && (
                <div>
                  <dt>Buyer's note</dt>
                  <dd className="listing-description">{request.note}</dd>
                </div>
              )}
              {request.closed_reason && (
                <div>
                  <dt>Reason given</dt>
                  <dd>{request.closed_reason}</dd>
                </div>
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
          </section>
        </div>

        <div className="col-lg-5">
          <section className="cb-card cb-card-body" aria-labelledby="timeline-heading">
            <h2 id="timeline-heading" className="cb-card-title">What has happened</h2>
            <ol className="cb-timeline">
              {steps.map((step) => (
                <li key={step.label} className={step.state}>
                  <strong>{step.label}</strong>
                  <span className="visually-hidden">
                    {step.state === 'done' ? ' (done)' : step.state === 'stopped' ? ' (ended here)' : ' (not yet)'}
                  </span>
                  <span className="cb-when">{step.when}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </article>
  )
}

type Step = { label: string; when: string; state: 'done' | 'stopped' | 'next' }

// The request's history in words, oldest first, with the next step when one is due.
function timeline(request: PurchaseRequest, isBuyer: boolean): Step[] {
  const steps: Step[] = [{ label: 'Request sent', when: formatManilaDateTime(request.created_at), state: 'done' }]
  if (request.accepted_at) {
    steps.push({ label: 'Accepted by the seller', when: formatManilaDateTime(request.accepted_at), state: 'done' })
  }
  switch (request.status) {
    case 'pending':
      steps.push({
        label: 'Seller accepts or declines',
        when: isBuyer ? 'Waiting for the seller.' : 'Waiting for you.',
        state: 'next',
      })
      break
    case 'accepted':
      steps.push({
        label: 'Meet, inspect and pay in person',
        when: `At ${request.meetup_place}, ${formatManilaDateTime(request.meetup_at)}. The seller then marks it as handed over.`,
        state: 'next',
      })
      break
    case 'completed':
      steps.push({
        label: 'Handed over; item sold',
        when: request.completed_at ? formatManilaDateTime(request.completed_at) : '',
        state: 'done',
      })
      break
    case 'declined':
      steps.push({
        label: 'Declined by the seller',
        when: request.closed_at ? formatManilaDateTime(request.closed_at) : '',
        state: 'stopped',
      })
      break
    case 'cancelled':
      steps.push({
        label: 'Cancelled',
        when: request.closed_at ? formatManilaDateTime(request.closed_at) : '',
        state: 'stopped',
      })
      break
  }
  return steps
}
