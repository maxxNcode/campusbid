import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import RequestActions from '../components/RequestActions'
import { useAuth } from '../lib/auth-context'
import { formatManilaDateTime } from '../lib/format'
import { formatPeso } from '../lib/listing-rules'
import { fetchMemberNames } from '../lib/listings'
import { fetchMyRequests, fetchRequestsReceived } from '../lib/requests'
import { REQUEST_STATUS_LABELS, type RequestStatus } from '../lib/request-rules'
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
  if (state.kind === 'loading') return <p>Loading…</p>
  if (state.kind === 'error') return <p role="alert">Could not load your requests. Check your connection and reload.</p>

  const { requests, listings, names } = state
  const shown = filter === 'all' ? requests : requests.filter((request) => request.status === filter)
  const counts = (status: RequestStatus | 'all') =>
    status === 'all' ? requests.length : requests.filter((request) => request.status === status).length

  return (
    <section>
      <h1 className="h3">{title}</h1>
      <p className="text-body-secondary">
        {role === 'seller'
          ? 'Requests from buyers on your listings. Accept one to reserve the item.'
          : 'Requests you sent to sellers. Each item allows one request per buyer.'}
      </p>
      {outcome && (
        <p className={`alert ${outcome.ok ? 'alert-success' : 'alert-danger'}`} role={outcome.ok ? 'status' : 'alert'}>
          {outcome.message}
        </p>
      )}

      <div className="mb-3">
        <label htmlFor="request-filter" className="form-label">Show</label>
        <select
          id="request-filter"
          className="form-select form-select-sm w-auto"
          value={filter}
          onChange={(event) => setFilter(event.target.value as RequestStatus | 'all')}
        >
          {FILTERS.map((status) => (
            <option key={status} value={status}>
              {status === 'all' ? 'All requests' : REQUEST_STATUS_LABELS[status]} ({counts(status)})
            </option>
          ))}
        </select>
      </div>

      {shown.length === 0 ? (
        <p className="border rounded p-3">
          {requests.length === 0
            ? role === 'seller'
              ? 'No one has sent a request on your listings yet.'
              : 'You have not sent any requests yet. Open an available item in Browse to send one.'
            : 'No requests with this status.'}
        </p>
      ) : (
        <ul className="list-unstyled d-grid gap-3">
          {shown.map((request) => {
            const listing = listings.get(request.listing_id)
            const itemTitle = listing?.title ?? 'An item'
            const other = role === 'seller' ? names.get(request.buyer_id) : listing ? names.get(listing.seller_id) : undefined
            return (
              <li key={request.id} className="border rounded p-3">
                <h2 className="h5 mb-1">
                  <Link to={`/requests/${request.id}`}>{itemTitle}</Link>
                </h2>
                <p className="mb-1">
                  Request status: <strong>{REQUEST_STATUS_LABELS[request.status]}</strong>
                  {' · '}Price seen: {formatPeso(request.price_seen)}
                </p>
                <p className="mb-1">
                  {role === 'seller' ? 'Buyer' : 'Seller'}: {other ?? 'A CampusBid member'}
                </p>
                <p className="mb-1">
                  Meetup: {request.meetup_place}, {formatManilaDateTime(request.meetup_at)}
                </p>
                {request.closed_reason && <p className="mb-1">Reason: {request.closed_reason}</p>}
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
