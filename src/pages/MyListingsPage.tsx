import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../lib/auth-context'
import { formatManilaDateTime } from '../lib/format'
import { CONDITION_LABELS, LISTING_STATUS_LABELS, formatPeso, type ListingStatus } from '../lib/listing-rules'
import { fetchMyListings, signedPhotoUrls, withdrawListing } from '../lib/listings'
import ListingPhoto from '../components/ListingPhoto'
import { EmptyState, ErrorNotice, ListingStatusBadge, Loading, PageHeader } from '../components/ui'
import { useConfirm } from '../components/use-confirm'
import type { Listing } from '../types/database'

const STATUS_ORDER: ListingStatus[] = ['active', 'reserved', 'sold', 'withdrawn']

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; listings: Listing[]; photoUrls: Map<string, string> }

export default function MyListingsPage() {
  const { session } = useAuth()
  const userId = session?.user.id ?? ''
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [statusFilter, setStatusFilter] = useState<ListingStatus | 'all'>('all')
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [confirm, dialog] = useConfirm()

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const listings = await fetchMyListings(userId)
        const photoUrls = await signedPhotoUrls(listings.flatMap((listing) => (listing.photo_path ? [listing.photo_path] : [])))
        if (!cancelled) setState({ kind: 'ready', listings, photoUrls })
      } catch {
        if (!cancelled) setState({ kind: 'error' })
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [userId, reloadKey])

  async function handleWithdraw(listing: Listing) {
    const ok = await confirm({
      title: 'Withdraw this listing?',
      body: (
        <p>
          “{listing.title}” leaves Browse, any pending requests on it are cancelled, and it cannot be made available
          again. Its history is kept.
        </p>
      ),
      confirmLabel: 'Withdraw listing',
      cancelLabel: 'Keep it',
      danger: true,
    })
    if (!ok) return
    setMessage('')
    setErrorMessage('')
    setBusyId(listing.id)
    try {
      await withdrawListing(listing.id)
      setMessage(`“${listing.title}” is withdrawn.`)
    } catch {
      setErrorMessage(`“${listing.title}” could not be withdrawn. It may no longer be available; the list has been refreshed.`)
    }
    setBusyId(null)
    setReloadKey((key) => key + 1)
  }

  const header = (
    <PageHeader title="My Listings" actions={<Link to="/sell" className="btn btn-primary">Sell an item</Link>}>
      Everything you have put up for sale. Only available listings can be edited or withdrawn.
    </PageHeader>
  )

  if (state.kind === 'loading') {
    return (
      <section>
        {header}
        <Loading>Loading your listings…</Loading>
      </section>
    )
  }
  if (state.kind === 'error') {
    return (
      <section>
        {header}
        <ErrorNotice>Could not load your listings. Check your connection and reload.</ErrorNotice>
      </section>
    )
  }

  const shown = statusFilter === 'all' ? state.listings : state.listings.filter((listing) => listing.status === statusFilter)
  const countFor = (status: ListingStatus) => state.listings.filter((listing) => listing.status === status).length

  return (
    <section>
      {dialog}
      {header}

      {message && <p className="alert alert-success" role="status">{message}</p>}
      {errorMessage && <ErrorNotice>{errorMessage}</ErrorNotice>}

      {state.listings.length === 0 ? (
        <EmptyState title="You have not listed anything yet." action={<Link to="/sell" className="btn btn-primary">Sell an item</Link>}>
          Add a photo, a fixed price and the item's condition. It shows in Browse straight away.
        </EmptyState>
      ) : (
        <>
          <div className="cb-tabs" role="group" aria-label="Filter by listing status">
            <button type="button" className="cb-tab" aria-pressed={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
              All <span className="cb-count">({state.listings.length})</span>
            </button>
            {STATUS_ORDER.map((status) => (
              <button
                key={status}
                type="button"
                className="cb-tab"
                aria-pressed={statusFilter === status}
                onClick={() => setStatusFilter(status)}
              >
                {LISTING_STATUS_LABELS[status]} <span className="cb-count">({countFor(status)})</span>
              </button>
            ))}
          </div>

          {shown.length === 0 ? (
            <EmptyState title={`None of your listings are ${LISTING_STATUS_LABELS[statusFilter as ListingStatus].toLowerCase()}.`}>
              Choose another status above to see the rest.
            </EmptyState>
          ) : (
            <ul className="cb-card list-unstyled mb-0">
              {shown.map((listing) => (
                <li key={listing.id} className="cb-row">
                  <ListingPhoto
                    url={listing.photo_path ? state.photoUrls.get(listing.photo_path) : undefined}
                    title={listing.title}
                  />
                  <div className="min-w-0">
                    <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                      <ListingStatusBadge status={listing.status} />
                    </div>
                    <h2 className="cb-row-title mb-1">
                      <Link to={`/listings/${listing.id}`}>{listing.title}</Link>
                    </h2>
                    <p className="mb-0">
                      <span className="cb-price">{formatPeso(listing.price)}</span>
                      <span className="cb-muted"> · {CONDITION_LABELS[listing.condition]}</span>
                    </p>
                    <p className="small cb-muted mb-0">Listed {formatManilaDateTime(listing.created_at)}</p>
                  </div>
                  {listing.status === 'active' && (
                    <div className="cb-row-actions">
                      <Link to={`/listings/${listing.id}/edit`} className="btn btn-outline-primary btn-sm">
                        Edit<span className="visually-hidden"> {listing.title}</span>
                      </Link>
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm"
                        disabled={busyId === listing.id}
                        onClick={() => handleWithdraw(listing)}
                      >
                        {busyId === listing.id ? 'Withdrawing…' : 'Withdraw'}
                        <span className="visually-hidden"> {listing.title}</span>
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
