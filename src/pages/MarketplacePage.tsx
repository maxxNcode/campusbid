import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { supabase } from '../lib/supabase'
import { demo, demoMode } from '../lib/demo'
import { PROGRAMS } from '../lib/programs'
import { CONDITION_LABELS, formatPeso } from '../lib/listing-rules'
import { PAGE_SIZE, searchListings, type ListingFilters, type ListingPage } from '../lib/listing-search'
import { fetchCategories, fetchMemberNames, signedPhotoUrls } from '../lib/listings'
import ListingPhoto from '../components/ListingPhoto'
import { EmptyState, ErrorNotice, ListingStatusBadge, Loading, PageHeader } from '../components/ui'
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

  function search(next: ListingFilters) {
    setState({ kind: 'loading' })
    setSearchParams(paramsFromFilters(next))
  }

  function clearFilters() {
    setState({ kind: 'loading' })
    setSearchParams({})
  }

  function goToPage(page: number) {
    search({ ...filters, page })
    window.scrollTo(0, 0)
  }

  const filtering =
    filters.keyword.trim() !== '' || filters.categoryId !== null || filters.program !== null || filters.includeReserved
  const categoryName = (id: number) => categories.find((category) => category.id === id)?.name ?? ''

  return (
    <section>
      <PageHeader title="Browse">
        Items for sale from approved students. Prices are fixed and in pesos; you pay in person at the meetup.
      </PageHeader>

      {/* Keyed on the address so Back and Forward show the search that matches the results. */}
      <FilterForm
        key={filterKey}
        filters={filters}
        categories={categories}
        filtering={filtering}
        onSearch={search}
        onClear={clearFilters}
      />

      {state.kind === 'loading' && <Loading>Loading listings…</Loading>}
      {state.kind === 'error' && <ErrorNotice>Could not load listings. Check your connection and reload.</ErrorNotice>}
      {state.kind === 'ready' && (
        <BrowseResults
          results={state.results}
          filtering={filtering}
          page={filters.page}
          categoryName={categoryName}
          onPage={goToPage}
          onClear={clearFilters}
        />
      )}
    </section>
  )
}

type FilterFormProps = {
  filters: ListingFilters
  categories: Category[]
  filtering: boolean
  onSearch: (filters: ListingFilters) => void
  onClear: () => void
}

function FilterForm({ filters, categories, filtering, onSearch, onClear }: FilterFormProps) {
  const [keyword, setKeyword] = useState(filters.keyword)
  const [categoryId, setCategoryId] = useState(filters.categoryId === null ? '' : String(filters.categoryId))
  const [program, setProgram] = useState(filters.program ?? '')
  const [includeReserved, setIncludeReserved] = useState(filters.includeReserved)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSearch({
      keyword,
      categoryId: categoryId ? Number(categoryId) : null,
      program: program || null,
      includeReserved,
      page: 1,
    })
  }

  return (
    <form className="cb-card cb-filters" onSubmit={submit} role="search" aria-label="Search listings">
      <div className="row g-2 align-items-end">
        <div className="col-12 col-lg-4">
          <label htmlFor="browse-keyword" className="form-label">Keyword</label>
          <input
            id="browse-keyword"
            type="search"
            className="form-control"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="e.g. fx-991ES, drafting"
            maxLength={100}
          />
        </div>
        <div className="col-12 col-sm-6 col-lg-3">
          <label htmlFor="browse-category" className="form-label">Category</label>
          <select
            id="browse-category"
            className="form-select"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </div>
        <div className="col-12 col-sm-6 col-lg-3">
          <label htmlFor="browse-program" className="form-label">Program</label>
          <select id="browse-program" className="form-select" value={program} onChange={(event) => setProgram(event.target.value)}>
            <option value="">All programs</option>
            {PROGRAMS.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
        <div className="col-12 col-lg-2 d-grid">
          <button type="submit" className="btn btn-primary">Search</button>
        </div>
      </div>
      <div className="d-flex flex-wrap align-items-center gap-3 mt-3">
        <div className="form-check mb-0">
          <input
            id="browse-reserved"
            type="checkbox"
            className="form-check-input"
            checked={includeReserved}
            onChange={(event) => setIncludeReserved(event.target.checked)}
          />
          <label htmlFor="browse-reserved" className="form-check-label">Also show reserved items</label>
        </div>
        {filtering && (
          <button type="button" className="btn btn-link p-0 ms-sm-auto" onClick={onClear}>
            Clear search and filters
          </button>
        )}
      </div>
    </form>
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
      <EmptyState
        title={`There is nothing on page ${page}.`}
        action={<button type="button" className="btn btn-outline-primary" onClick={() => onPage(1)}>Go to the first page</button>}
      >
        The listings may have changed since this link was made.
      </EmptyState>
    )
  }
  if (results.total === 0) {
    return filtering ? (
      <EmptyState
        title="No listings match your search."
        action={<button type="button" className="btn btn-outline-primary" onClick={onClear}>Clear search and filters</button>}
      >
        Try a shorter keyword, another category, or include reserved items.
      </EmptyState>
    ) : (
      <EmptyState title="No listings are available yet." action={<Link to="/sell" className="btn btn-primary">Sell an item</Link>}>
        When approved students post items for sale, they show up here.
      </EmptyState>
    )
  }

  const first = (page - 1) * PAGE_SIZE + 1
  const last = first + results.listings.length - 1

  return (
    <>
      <p className="cb-muted mb-3" aria-live="polite">
        Showing {first}–{last} of {results.total} {results.total === 1 ? 'listing' : 'listings'}, newest first.
      </p>
      <ul className="row g-3 list-unstyled mb-4">
        {results.listings.map((listing) => (
          <li key={listing.id} className="col-12 col-sm-6 col-lg-4">
            <article className="cb-card cb-item">
              <ListingPhoto url={listing.photo_path ? results.photoUrls.get(listing.photo_path) : undefined} title={listing.title} />
              <div className="cb-item-body">
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <ListingStatusBadge status={listing.status} />
                  <span className="cb-chip">{categoryName(listing.category_id)}</span>
                </div>
                <h2 className="cb-item-title">
                  <Link to={`/listings/${listing.id}`}>{listing.title}</Link>
                </h2>
                <p className="cb-price cb-item-price mb-0">{formatPeso(listing.price)}</p>
                <p className="mb-0">
                  <span className="cb-muted">Condition:</span> {CONDITION_LABELS[listing.condition]}
                </p>
                <p className="cb-item-meta mb-0">
                  {listing.program}
                  {results.sellerNames.has(listing.seller_id) && <> · Seller: {results.sellerNames.get(listing.seller_id)}</>}
                </p>
              </div>
            </article>
          </li>
        ))}
      </ul>
      {results.pageCount > 1 && (
        <nav className="d-flex flex-wrap align-items-center justify-content-center gap-3" aria-label="Pages">
          <button type="button" className="btn btn-outline-secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            ← Previous
          </button>
          <span aria-current="page">
            Page <strong>{page}</strong> of {results.pageCount}
          </span>
          <button
            type="button"
            className="btn btn-outline-secondary"
            disabled={page >= results.pageCount}
            onClick={() => onPage(page + 1)}
          >
            Next →
          </button>
        </nav>
      )}
    </>
  )
}
