import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import RequestActions from '../components/RequestActions'
import { useAuth } from '../lib/auth-context'
import { formatManilaDateTime } from '../lib/format'
import { formatPeso } from '../lib/listing-rules'
import { fetchMemberNames } from '../lib/listings'
import { fetchMyRequests, fetchRequestsReceived } from '../lib/requests'
import { REQUEST_STATUS_LABELS, type RequestStatus } from '../lib/request-rules'
import { EmptyState, ErrorNotice, Loading, PageHeader, RequestStatusBadge } from '../components/ui'
import type { Listing, PurchaseRequest } from '../types/database'

type Props = { role: 'buyer' | 'seller' }
type LoadState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; requests: PurchaseRequest[]; listings: Map<number, Listing>; names: Map<string, string> }

const FILTERS: (RequestStatus | 'all')[] = ['all', 'pending', 'accepted', 'declined', 'cancelled', 'completed']

// My Requests (role buyer) and Requests Received (role seller) share one layout.
export default function RequestListPage({ role }: Props) {
  const { session } = useAuth()
  const userId = session?.user.id ?? ''
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [filter, setFilter] = useState<RequestStatus | 'all'>('all')
  const [outcome, setOutcome] = useState<{ ok: boolean; message: string } | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { requests, listings } = await (role === 'seller' ? fetchRequestsReceived(userId) : fetchMyRequests(userId))
        const people = role === 'seller'
          ? requests.map((request) => request.buyer_id)
          : [...listings.values()].map((listing) => listing.seller_id)
        const names = await fetchMemberNames(people)
        if (!cancelled) setState({ kind: 'ready', requests, listings, names })
      } catch {
        if (!cancelled) setState({ kind: 'error' })
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [role, userId, reloadKey])

  const title = role === 'seller' ? 'Requests Received' : 'My Requests'
  const intro =
    role === 'seller'
      ? 'Requests from buyers on your listings. Accepting one reserves the item for that buyer.'
      : 'Requests you sent to sellers. You can send one request per item.'

  if (state.kind === 'loading') {
    return (
      <section>
        <PageHeader title={title}>{intro}</PageHeader>
        <Loading>Loading requests…</Loading>
      </section>
    )
  }
  if (state.kind === 'error') {
    return (
      <section>
        <PageHeader title={title}>{intro}</PageHeader>
        <ErrorNotice>Could not load your requests. Check your connection and reload.</ErrorNotice>
      </section>
    )
  }

  const { requests, listings, names } = state
  const shown = filter === 'all' ? requests : requests.filter((request) => request.status === filter)
  const counts = (status: RequestStatus | 'all') =>
    status === 'all' ? requests.length : requests.filter((request) => request.status === status).length

  return (
    <section>
      <PageHeader title={title}>{intro}</PageHeader>
      {outcome && (
        <p className={`alert ${outcome.ok ? 'alert-success' : 'alert-danger'}`} role={outcome.ok ? 'status' : 'alert'}>
          {outcome.message}
        </p>
      )}

      {requests.length > 0 && (
        <div className="cb-tabs" role="group" aria-label="Filter by request status">
          {FILTERS.map((status) => (
            <button
              key={status}
              type="button"
              className="cb-tab"
              aria-pressed={filter === status}
              onClick={() => setFilter(status)}
            >
              {status === 'all' ? 'All' : REQUEST_STATUS_LABELS[status]} <span className="cb-count">({counts(status)})</span>
            </button>
          ))}
        </div>
      )}

      {requests.length === 0 ? (
        role === 'seller' ? (
          <EmptyState title="No requests yet." action={<Link to="/my-listings" className="btn btn-outline-primary">Go to My Listings</Link>}>
            When a buyer requests one of your available items, it shows up here for you to accept or decline.
          </EmptyState>
        ) : (
          <EmptyState title="You have not sent any requests yet." action={<Link to="/" className="btn btn-primary">Browse items</Link>}>
            Open an available item in Browse and choose a meetup place and time to send a request.
          </EmptyState>
        )
      ) : shown.length === 0 ? (
        <EmptyState title={`No ${REQUEST_STATUS_LABELS[filter as RequestStatus].toLowerCase()} requests.`}>
          Choose another status above to see the rest.
        </EmptyState>
      ) : (
        <ul className="list-unstyled d-grid gap-3 mb-0">
          {shown.map((request) => {
            const listing = listings.get(request.listing_id)
            const itemTitle = listing?.title ?? 'An item'
            const other = role === 'seller' ? names.get(request.buyer_id) : listing ? names.get(listing.seller_id) : undefined
            return (
              <li key={request.id} className="cb-card cb-card-body">
                <div className="d-flex flex-wrap align-items-start gap-2 mb-2">
                  <h2 className="cb-row-title mb-0 me-auto">
                    <Link to={`/requests/${request.id}`}>{itemTitle}</Link>
                  </h2>
                  <RequestStatusBadge status={request.status} />
                </div>
                <dl className="cb-facts">
                  <div>
                    <dt>Price seen</dt>
                    <dd className="cb-price">{formatPeso(request.price_seen)}</dd>
                  </div>
                  <div>
                    <dt>{role === 'seller' ? 'Buyer' : 'Seller'}</dt>
                    <dd>{other ?? 'A CampusBid member'}</dd>
                  </div>
                  <div>
                    <dt>Meetup</dt>
                    <dd>
                      {request.meetup_place}, {formatManilaDateTime(request.meetup_at)}
                    </dd>
                  </div>
                  {request.closed_reason && (
                    <div>
                      <dt>Reason</dt>
                      <dd className="text-break-anywhere">{request.closed_reason}</dd>
                    </div>
                  )}
                </dl>
                <RequestActions
                  request={request}
                  role={role}
                  itemTitle={itemTitle}
                  onDone={(result) => {
                    setOutcome(result)
                    setReloadKey((key) => key + 1)
                  }}
                />
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
