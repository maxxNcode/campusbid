import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../lib/auth-context'
import { formatManilaDateTime } from '../lib/format'
import { LISTING_STATUS_LABELS, formatPeso, type ListingStatus } from '../lib/listing-rules'
import { fetchMyListings, withdrawListing } from '../lib/listings'
import type { Listing } from '../types/database'

const STATUS_ORDER: ListingStatus[] = ['active', 'reserved', 'sold', 'withdrawn']

type LoadState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; listings: Listing[] }

export default function MyListingsPage() {
  const { session } = useAuth()
  const userId = session?.user.id ?? ''
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [statusFilter, setStatusFilter] = useState<ListingStatus | 'all'>('all')
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetchMyListings(userId).then(
      (listings) => {
        if (!cancelled) setState({ kind: 'ready', listings })
      },
      () => {
        if (!cancelled) setState({ kind: 'error' })
      },
    )
    return () => {
      cancelled = true
    }
  }, [userId, reloadKey])

  async function handleWithdraw(listing: Listing) {
    const confirmed = window.confirm(
      `Withdraw "${listing.title}"? It leaves Browse, any pending purchase requests on it are cancelled, ` +
        'and it cannot be made available again. Its history is kept.',
    )
    if (!confirmed) return
    setMessage('')
    setErrorMessage('')
    setBusyId(listing.id)
    try {
      await withdrawListing(listing.id)
      setMessage(`"${listing.title}" is withdrawn.`)
    } catch {
      setErrorMessage(`"${listing.title}" could not be withdrawn. It may no longer be available; the list has been refreshed.`)
    }
    setBusyId(null)
    setReloadKey((key) => key + 1)
  }

  if (state.kind === 'loading') return <p>Loading your listings…</p>
  if (state.kind === 'error') return <p role="alert">Could not load your listings. Check your connection and reload.</p>

  const shown = statusFilter === 'all' ? state.listings : state.listings.filter((listing) => listing.status === statusFilter)
  const countFor = (status: ListingStatus) => state.listings.filter((listing) => listing.status === status).length

  return (
    <section>
      <div className="d-flex flex-wrap align-items-center gap-3 mb-3">
        <h1 className="h3 mb-0 me-auto">My Listings</h1>
        <Link to="/sell" className="btn btn-primary">Sell an item</Link>
      </div>

      {message && <p className="alert alert-success" role="status">{message}</p>}
      {errorMessage && <p className="alert alert-danger" role="alert">{errorMessage}</p>}

      {state.listings.length === 0 ? (
        <p>You have not listed anything yet.</p>
      ) : (
        <>
          <div className="mb-3 form-narrow">
            <label htmlFor="my-listings-status" className="form-label">Show</label>
            <select id="my-listings-status" className="form-select" value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as ListingStatus | 'all')}>
              <option value="all">All ({state.listings.length})</option>
              {STATUS_ORDER.map((status) => (
                <option key={status} value={status}>{LISTING_STATUS_LABELS[status]} ({countFor(status)})</option>
              ))}
            </select>
          </div>

          {shown.length === 0 ? (
            <p>None of your listings are {LISTING_STATUS_LABELS[statusFilter as ListingStatus].toLowerCase()}.</p>
          ) : (
            <ul className="list-group">
              {shown.map((listing) => (
                <li key={listing.id} className="list-group-item d-flex flex-wrap align-items-center gap-2">
                  <div className="me-auto">
                    <Link to={`/listings/${listing.id}`} className="fw-semibold">{listing.title}</Link>
                    <div>
                      {formatPeso(listing.price)} · Status: <strong>{LISTING_STATUS_LABELS[listing.status]}</strong>
                    </div>
                    <div className="small text-body-secondary">Listed {formatManilaDateTime(listing.created_at)}</div>
                  </div>
                  {listing.status === 'active' && (
                    <div className="d-flex gap-2">
                      <Link to={`/listings/${listing.id}/edit`} className="btn btn-outline-primary btn-sm">Edit</Link>
                      <button type="button" className="btn btn-outline-danger btn-sm" disabled={busyId === listing.id}
                        onClick={() => handleWithdraw(listing)}>
                        {busyId === listing.id ? 'Withdrawing…' : 'Withdraw'}
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
