import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { useAuth } from '../lib/auth-context'
import { formatManilaDateTime } from '../lib/format'
import { CONDITION_LABELS, LISTING_STATUS_LABELS, formatPeso } from '../lib/listing-rules'
import { fetchCategories, fetchListing, fetchMemberNames, signedPhotoUrls } from '../lib/listings'
import ListingPhoto from '../components/ListingPhoto'
import type { Listing } from '../types/database'

type Details = {
  listing: Listing
  categoryName: string
  sellerName: string
  photoUrl?: string
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
        const [categories, names, urls] = await Promise.all([
          fetchCategories(),
          fetchMemberNames([listing.seller_id]),
          signedPhotoUrls(listing.photo_path ? [listing.photo_path] : []),
        ])
        if (cancelled) return
        setState({
          kind: 'ready',
          details: {
            listing,
            categoryName: categories.find((category) => category.id === listing.category_id)?.name ?? 'Uncategorised',
            sellerName: names.get(listing.seller_id) ?? 'A CampusBid member',
            photoUrl: listing.photo_path ? urls.get(listing.photo_path) : undefined,
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
  }, [listingId])

  if (state.kind === 'loading') return <p>Loading…</p>
  if (state.kind === 'error') return <p role="alert">Could not load this listing. Check your connection and reload.</p>
  if (state.kind === 'missing') {
    return (
      <section>
        <h1 className="h3">Listing not found</h1>
        <p>This listing does not exist or is no longer open to browse.</p>
        <Link to="/">Back to Browse</Link>
      </section>
    )
  }

  const { listing, categoryName, sellerName, photoUrl } = state.details
  const isOwner = listing.seller_id === session?.user.id

  return (
    <article>
      {saved && (
        <p className="alert alert-success" role="status">
          {saved === 'created' ? 'Your listing is published.' : 'Your changes are saved.'}
        </p>
      )}
      <p><Link to="/">← Back to Browse</Link></p>

      <div className="row g-4">
        <div className="col-md-5">
          <ListingPhoto url={photoUrl} title={listing.title}/>
        </div>
        <div className="col-md-7">
          <h1 className="h3">{listing.title}</h1>
          <p className="fs-4 mb-1">{formatPeso(listing.price)}</p>
          <p>
            Status: <strong>{LISTING_STATUS_LABELS[listing.status]}</strong>
          </p>

          <dl className="row">
            <dt className="col-sm-4">Condition</dt>
            <dd className="col-sm-8">{CONDITION_LABELS[listing.condition]}</dd>
            <dt className="col-sm-4">Known defects</dt>
            <dd className="col-sm-8">{listing.known_defects}</dd>
            <dt className="col-sm-4">Category</dt>
            <dd className="col-sm-8">{categoryName}</dd>
            <dt className="col-sm-4">Program</dt>
            <dd className="col-sm-8">{listing.program}</dd>
            {listing.model_or_edition && (
              <>
                <dt className="col-sm-4">Model or edition</dt>
                <dd className="col-sm-8">{listing.model_or_edition}</dd>
              </>
            )}
            {listing.included_parts && (
              <>
                <dt className="col-sm-4">Included or missing parts</dt>
                <dd className="col-sm-8">{listing.included_parts}</dd>
              </>
            )}
            <dt className="col-sm-4">Seller</dt>
            <dd className="col-sm-8">{isOwner ? 'You' : sellerName}</dd>
            <dt className="col-sm-4">Listed</dt>
            <dd className="col-sm-8">{formatManilaDateTime(listing.created_at)}</dd>
          </dl>

          <h2 className="h5">Description</h2>
          <p className="listing-description">{listing.description}</p>

          {isOwner ? (
            <div className="d-flex flex-wrap gap-2">
              {listing.status === 'active' ? (
                <Link to={`/listings/${listing.id}/edit`} className="btn btn-outline-primary">Edit listing</Link>
              ) : (
                <p className="text-body-secondary">Only available listings can be edited.</p>
              )}
            </div>
          ) : (
            <p className="border rounded p-3">
              Purchase requests are added in the next build phase. For now you can view the item details only.
            </p>
          )}
        </div>
      </div>
    </article>
  )
}
