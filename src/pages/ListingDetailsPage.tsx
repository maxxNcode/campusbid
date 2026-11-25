import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { useAuth } from '../lib/auth-context'
import { formatManilaDateTime } from '../lib/format'
import { CONDITION_LABELS, LISTING_STATUS_LABELS, formatPeso } from '../lib/listing-rules'
import { fetchCategories, fetchListing, fetchMemberNames, signedPhotoUrls } from '../lib/listings'
import { fetchMyRequestForListing } from '../lib/requests'
import { EmptyState, ErrorNotice, ListingStatusBadge, Loading, RequestStatusBadge } from '../components/ui'
import ListingPhoto from '../components/ListingPhoto'
import RequestForm from '../components/RequestForm'
import type { Listing, PurchaseRequest } from '../types/database'

type Details = {
  listing: Listing
  categoryName: string
  sellerName: string
  photoUrl?: string
  myRequest: PurchaseRequest | null
}

type LoadState = { kind: 'loading' } | { kind: 'missing' } | { kind: 'error' } | { kind: 'ready'; details: Details }

export default function ListingDetailsPage() {
  const { id } = useParams()
  const listingId = Number(id)
  const { session } = useAuth()
  const location = useLocation()
  const saved = (location.state as { saved?: string } | null)?.saved
  const [state, setState] = useState<LoadState>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const listing = Number.isInteger(listingId) ? await fetchListing(listingId) : null
        if (!listing) {
          if (!cancelled) setState({ kind: 'missing' })
          return
        }
        const userId = session?.user.id
        const [categories, names, urls, myRequest] = await Promise.all([
          fetchCategories(),
          fetchMemberNames([listing.seller_id]),
          signedPhotoUrls(listing.photo_path ? [listing.photo_path] : []),
          userId && listing.seller_id !== userId ? fetchMyRequestForListing(listing.id, userId) : Promise.resolve(null),
        ])
        if (cancelled) return
        setState({
          kind: 'ready',
          details: {
            listing,
            categoryName: categories.find((category) => category.id === listing.category_id)?.name ?? 'Uncategorised',
            sellerName: names.get(listing.seller_id) ?? 'A CampusBid member',
            photoUrl: listing.photo_path ? urls.get(listing.photo_path) : undefined,
            myRequest,
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
  }, [listingId, session?.user.id])


  if (state.kind === 'loading') return <Loading>Loading the listing…</Loading>
  if (state.kind === 'error') return <ErrorNotice>Could not load this listing. Check your connection and reload.</ErrorNotice>
  if (state.kind === 'missing') {
    return (
      <EmptyState title="Listing not found" action={<Link to="/" className="btn btn-primary">Back to Browse</Link>}>
        This listing does not exist or is no longer open to browse.
      </EmptyState>
    )
  }

  const { listing, categoryName, sellerName, photoUrl, myRequest } = state.details
  const isOwner = listing.seller_id === session?.user.id
  const defects = listing.known_defects.trim()

  return (
    <article>
      {saved && (
        <p className="alert alert-success" role="status">
          {saved === 'created' ? 'Your listing is published.' : 'Your changes are saved.'}
        </p>
      )}
      <Link to="/" className="cb-back">← Back to Browse</Link>

      <div className="row g-4">
        <div className="col-lg-5">
          <div className="cb-card overflow-hidden">
            <ListingPhoto url={photoUrl} title={listing.title} />
          </div>
        </div>
        <div className="col-lg-7">
          <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
            <ListingStatusBadge status={listing.status} />
            <span className="cb-chip">{categoryName}</span>
          </div>
          <h1 className="h3 mb-1">{listing.title}</h1>
          <p className="cb-price fs-3 mb-3">{formatPeso(listing.price)}</p>

          <section className="cb-card cb-card-body mb-3" aria-labelledby="condition-heading">
            <h2 id="condition-heading" className="cb-card-title mb-2">
              Condition: {CONDITION_LABELS[listing.condition]}
            </h2>
            <div className="cb-defects">
              <strong className="d-block small">Known defects</strong>
              <span className="text-break-anywhere">{defects || 'None stated.'}</span>
            </div>
          </section>

          <section className="cb-card cb-card-body mb-3" aria-labelledby="details-heading">
            <h2 id="details-heading" className="cb-card-title">Details</h2>
            <dl className="cb-specs">
              <div>
                <dt>Status</dt>
                <dd>{LISTING_STATUS_LABELS[listing.status]}</dd>
              </div>
              <div>
                <dt>Category</dt>
                <dd>{categoryName}</dd>
              </div>
              <div>
                <dt>Program</dt>
                <dd>{listing.program}</dd>
              </div>
              {listing.model_or_edition && (
                <div>
                  <dt>Model or edition</dt>
                  <dd>{listing.model_or_edition}</dd>
                </div>
              )}
              {listing.included_parts && (
                <div>
                  <dt>Included or missing parts</dt>
                  <dd>{listing.included_parts}</dd>
                </div>
              )}
              <div>
                <dt>Seller</dt>
                <dd>{isOwner ? 'You' : sellerName}</dd>
              </div>
              <div>
                <dt>Listed</dt>
                <dd>{formatManilaDateTime(listing.created_at)}</dd>
              </div>
            </dl>
            <h3 className="h6 mt-3">Description</h3>
            <p className="listing-description text-break-anywhere mb-0">{listing.description}</p>
          </section>

          {isOwner ? (
            <div className="cb-card cb-card-body">
              <h2 className="cb-card-title mb-2">This is your listing</h2>
              {listing.status === 'active' ? (
                <div className="d-flex flex-wrap gap-2">
                  <Link to={`/listings/${listing.id}/edit`} className="btn btn-primary">Edit listing</Link>
                  <Link to="/my-listings" className="btn btn-outline-secondary">Go to My Listings</Link>
                </div>
              ) : (
                <p className="cb-muted mb-0">Only available listings can be edited.</p>
              )}
            </div>
          ) : myRequest ? (
            <div className="cb-card cb-card-body">
              <h2 className="cb-card-title mb-2">You already requested this item</h2>
              <p className="mb-3">
                Request status: <RequestStatusBadge status={myRequest.status} />
              </p>
              <Link to={`/requests/${myRequest.id}`} className="btn btn-outline-primary">View your request</Link>
            </div>
          ) : listing.status === 'active' ? (
            <RequestForm listingId={listing.id} priceText={formatPeso(listing.price)} />
          ) : (
            <p className="cb-card cb-card-body mb-0">
              This item is not open for new requests. Status: <strong>{LISTING_STATUS_LABELS[listing.status]}</strong>.
            </p>
          )}
        </div>
      </div>
    </article>
  )
}
