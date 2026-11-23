import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { supabase } from '../lib/supabase'
import { demo, demoMode } from '../lib/demo'
import { PROGRAMS } from '../lib/programs'
import { CONDITION_LABELS, LISTING_STATUS_LABELS, formatPeso } from '../lib/listing-rules'
import { PAGE_SIZE, searchListings, type ListingFilters, type ListingPage } from '../lib/listing-search'
import { fetchCategories, fetchMemberNames, signedPhotoUrls } from '../lib/listings'
import ListingPhoto from '../components/ListingPhoto'
import type { Category } from '../types/database'

type Results = ListingPage & {
  sellerNames: Map<string, string>
  photoUrls: Map<string, string>
}

type LoadState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; results: Results }

// The filters live in the address bar, so Back, reload and shared links keep them.
function filtersFromParams(params: URLSearchParams): ListingFilters {
  const category = Number(params.get('category'))
  const page = Number(params.get('page'))
  return {
    keyword: params.get('q') ?? '',
    categoryId: Number.isInteger(category) && category > 0 ? category : null,
    program: params.get('program') || null,
    includeReserved: params.get('reserved') === '1',
    page: Number.isInteger(page) && page > 0 ? page : 1,
  }
}

function paramsFromFilters(filters: ListingFilters): Record<string, string> {
  const params: Record<string, string> = {}
  if (filters.keyword.trim()) params.q = filters.keyword.trim()
  if (filters.categoryId !== null) params.category = String(filters.categoryId)
  if (filters.program) params.program = filters.program
  if (filters.includeReserved) params.reserved = '1'
  if (filters.page > 1) params.page = String(filters.page)
  return params
}

export default function MarketplacePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = filtersFromParams(searchParams)
  const filterKey = searchParams.toString()

  const [categories, setCategories] = useState<Category[]>([])
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  // Form fields, applied when the form is submitted.
  const [keyword, setKeyword] = useState(filters.keyword)
  const [categoryId, setCategoryId] = useState(filters.categoryId === null ? '' : String(filters.categoryId))
  const [program, setProgram] = useState(filters.program ?? '')
  const [includeReserved, setIncludeReserved] = useState(filters.includeReserved)

  useEffect(() => {
    fetchCategories().then(setCategories, () => setCategories([]))
  }, [])

  useEffect(() => {
    let cancelled = false
    const current = filtersFromParams(new URLSearchParams(filterKey))
    async function load() {
      try {
        const page = demoMode ? demo.searchListings(current) : await searchListings(supabase, current)
        const photoPaths = page.listings.flatMap((listing) => (listing.photo_path ? [listing.photo_path] : []))
        const [sellerNames, photoUrls] = await Promise.all([
          fetchMemberNames(page.listings.map((listing) => listing.seller_id)),
          signedPhotoUrls(photoPaths),
        ])
        if (!cancelled) setState({ kind: 'ready', results: { ...page, sellerNames, photoUrls } })
      } catch {
        if (!cancelled) setState({ kind: 'error' })
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [filterKey])

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setState({ kind: 'loading' })
    setSearchParams(
      paramsFromFilters({
        keyword,
        categoryId: categoryId ? Number(categoryId) : null,
        program: program || null,
        includeReserved,
        page: 1,
      }),
    )
  }

  function clearFilters() {
    setKeyword('')
    setCategoryId('')
    setProgram('')
    setIncludeReserved(false)
    setState({ kind: 'loading' })
    setSearchParams({})
  }

  function goToPage(page: number) {
    setState({ kind: 'loading' })
    setSearchParams(paramsFromFilters({ ...filters, page }))
    window.scrollTo(0, 0)
  }

  const filtering =
    filters.keyword.trim() !== '' || filters.categoryId !== null || filters.program !== null || filters.includeReserved
  const categoryName = (id: number) => categories.find((category) => category.id === id)?.name ?? ''

  return (
    <section>
      <h1 className="h3">Browse</h1>

      <form className="row g-2 align-items-end mb-4" onSubmit={applyFilters} role="search">
        <div className="col-12 col-md-4">
          <label htmlFor="browse-keyword" className="form-label">Keyword</label>
          <input id="browse-keyword" type="search" className="form-control" value={keyword}
            onChange={(event) => setKeyword(event.target.value)} placeholder="e.g. fx-991ES, drafting" maxLength={100} />
        </div>
        <div className="col-12 col-sm-6 col-md-3">
          <label htmlFor="browse-category" className="form-label">Category</label>
          <select id="browse-category" className="form-select" value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </div>
        <div className="col-12 col-sm-6 col-md-3">
          <label htmlFor="browse-program" className="form-label">Program</label>
          <select id="browse-program" className="form-select" value={program} onChange={(event) => setProgram(event.target.value)}>
            <option value="">All programs</option>
            {PROGRAMS.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
        <div className="col-12 col-md-2 d-grid">
          <button type="submit" className="btn btn-primary">Search</button>
        </div>
        <div className="col-12 d-flex flex-wrap align-items-center gap-3">
          <div className="form-check mb-0">
            <input id="browse-reserved" type="checkbox" className="form-check-input" checked={includeReserved}
              onChange={(event) => setIncludeReserved(event.target.checked)} />
            <label htmlFor="browse-reserved" className="form-check-label">Also show reserved items</label>
          </div>
          {filtering && (
            <button type="button" className="btn btn-link p-0" onClick={clearFilters}>Clear search and filters</button>
          )}
        </div>
      </form>

      {state.kind === 'loading' && <p>Loading listings…</p>}
      {state.kind === 'error' && <p role="alert">Could not load listings. Check your connection and reload.</p>}
      {state.kind === 'ready' && (
        <BrowseResults results={state.results} filtering={filtering} page={filters.page}
          categoryName={categoryName} onPage={goToPage} onClear={clearFilters} />
      )}
    </section>
  )
}

type BrowseResultsProps = {
  results: Results
  filtering: boolean
  page: number
  categoryName: (id: number) => string
  onPage: (page: number) => void
  onClear: () => void
}

function BrowseResults({ results, filtering, page, categoryName, onPage, onClear }: BrowseResultsProps) {
  if (results.pastEnd) {
    return (
      <p>
        There is nothing on page {page}.{' '}
        <button type="button" className="btn btn-link p-0 align-baseline" onClick={() => onPage(1)}>Go to the first page</button>
      </p>
    )
  }
  if (results.total === 0) {
    return filtering ? (
      <div>
        <p>No available listings match your search.</p>
        <button type="button" className="btn btn-outline-secondary" onClick={onClear}>Clear search and filters</button>
      </div>
    ) : (
      <div>
        <p>No listings are available yet.</p>
        <Link to="/sell" className="btn btn-outline-primary">Sell an item</Link>
      </div>
    )
  }

  const first = (page - 1) * PAGE_SIZE + 1
  const last = first + results.listings.length - 1

  return (
    <>
      <p className="text-body-secondary" aria-live="polite">
        Showing {first}–{last} of {results.total} {results.total === 1 ? 'listing' : 'listings'}, newest first.
      </p>
      <ul className="row g-3 list-unstyled">
        {results.listings.map((listing) => (
          <li key={listing.id} className="col-12 col-sm-6 col-lg-4">
            <div className="card h-100">
              <ListingPhoto
                url={listing.photo_path ? results.photoUrls.get(listing.photo_path) : undefined}
                title={listing.title}
                className="card-img-top"
              />
              <div className="card-body">
                <h2 className="h6 card-title">
                  <Link to={`/listings/${listing.id}`} className="stretched-link">{listing.title}</Link>
                </h2>
                <p className="fs-5 mb-1">{formatPeso(listing.price)}</p>
                <p className="mb-1">
                  <strong>{LISTING_STATUS_LABELS[listing.status]}</strong> · {CONDITION_LABELS[listing.condition]}
                </p>
                <p className="mb-0 text-body-secondary small">
                  {categoryName(listing.category_id)} · {listing.program}
                  {results.sellerNames.has(listing.seller_id) && <> · Seller: {results.sellerNames.get(listing.seller_id)}</>}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {results.pageCount > 1 && (
        <nav className="d-flex align-items-center gap-3" aria-label="Pages">
          <button type="button" className="btn btn-outline-secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            Previous
          </button>
          <span>Page {page} of {results.pageCount}</span>
          <button type="button" className="btn btn-outline-secondary" disabled={page >= results.pageCount}
            onClick={() => onPage(page + 1)}>
            Next
          </button>
        </nav>
      )}
    </>
  )
}
