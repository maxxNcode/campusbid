import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAuth } from '../lib/auth-context'
import { PROGRAMS } from '../lib/programs'
import {
  CONDITION_LABELS,
  PHOTO_ACCEPT,
  listingDraftProblems,
  photoProblem,
  type ListingDraft,
  type ListingDraftErrors,
} from '../lib/listing-rules'
import {
  ListingNotEditableError,
  createListing,
  fetchCategories,
  fetchListing,
  removeListingPhoto,
  signedPhotoUrls,
  updateListing,
  uploadListingPhoto,
} from '../lib/listings'
import ListingPhoto from '../components/ListingPhoto'
import type { Category, Listing } from '../types/database'

const EMPTY_DRAFT: ListingDraft = {
  title: '',
  description: '',
  categoryId: '',
  program: '',
  price: '',
  condition: '',
  modelOrEdition: '',
  includedParts: '',
  knownDefects: '',
}

function draftFromListing(listing: Listing): ListingDraft {
  return {
    title: listing.title,
    description: listing.description,
    categoryId: String(listing.category_id),
    program: listing.program,
    price: Number(listing.price).toFixed(2),
    condition: listing.condition,
    modelOrEdition: listing.model_or_edition ?? '',
    includedParts: listing.included_parts ?? '',
    knownDefects: listing.known_defects,
  }
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; existing: Listing | null; currentPhotoUrl?: string }
  | { kind: 'blocked'; message: string }

// Create a listing at /sell, or edit an owned active listing at /listings/:id/edit.
export default function ListingFormPage() {
  const { id } = useParams()
  const editingId = id ? Number(id) : null
  const { session } = useAuth()
  const userId = session?.user.id ?? ''
  const navigate = useNavigate()

  const [categories, setCategories] = useState<Category[]>([])
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'loading' })
  const [draft, setDraft] = useState<ListingDraft>(EMPTY_DRAFT)
  const [photo, setPhoto] = useState<File | null>(null)
  const [errors, setErrors] = useState<ListingDraftErrors>({})
  const [errorMessage, setErrorMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const loadedCategories = await fetchCategories()
        if (editingId === null) {
          if (!cancelled) {
            setCategories(loadedCategories)
            setLoadState({ kind: 'ready', existing: null })
          }
          return
        }
        const listing = Number.isInteger(editingId) ? await fetchListing(editingId) : null
        if (cancelled) return
        setCategories(loadedCategories)
        if (!listing || listing.seller_id !== userId) {
          setLoadState({ kind: 'blocked', message: 'This listing was not found, or it is not yours to edit.' })
          return
        }
        if (listing.status !== 'active') {
          setLoadState({
            kind: 'blocked',
            message: 'Only available listings can be edited. Reserved, sold and withdrawn listings stay as they are.',
          })
          return
        }
        const urls = listing.photo_path ? await signedPhotoUrls([listing.photo_path]) : new Map<string, string>()
        if (cancelled) return
        setDraft(draftFromListing(listing))
        setLoadState({
          kind: 'ready',
          existing: listing,
          currentPhotoUrl: listing.photo_path ? urls.get(listing.photo_path) : undefined,
        })
      } catch {
        if (!cancelled) setLoadState({ kind: 'blocked', message: 'Could not load the form. Check your connection and reload.' })
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [editingId, userId])

  function update(field: keyof ListingDraft) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setDraft((current) => ({ ...current, [field]: event.target.value }))
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    setPhoto(file)
    setErrors((current) => ({ ...current, photo: file ? (photoProblem(file) ?? undefined) : undefined }))
  }

  if (loadState.kind === 'loading') return <p>Loading…</p>
  if (loadState.kind === 'blocked') {
    return (
      <section>
        <h1 className="h3">{editingId === null ? 'Sell an item' : 'Edit listing'}</h1>
        <p role="alert">{loadState.message}</p>
        <Link to="/">Back to Browse</Link>
      </section>
    )
  }

  const existing = loadState.existing

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    const found = listingDraftProblems(draft)
    if (photo) {
      const problem = photoProblem(photo)
      if (problem) found.photo = problem
    } else if (!existing) {
      found.photo = 'Add a photo of the item.'
    }
    setErrors(found)
    if (Object.keys(found).length > 0) {
      setErrorMessage('Some details need fixing. Check the highlighted fields.')
      return
    }

    setSaving(true)
    let newPhotoPath: string | null = null
    try {
      if (photo) newPhotoPath = await uploadListingPhoto(userId, photo)
      const saved = existing
        ? await updateListing(existing.id, draft, newPhotoPath ?? existing.photo_path)
        : await createListing(draft, newPhotoPath as string)
      // The old photo is no longer used once a replacement is saved.
      if (existing?.photo_path && newPhotoPath) await removeListingPhoto(existing.photo_path)
      navigate(`/listings/${saved.id}`, { state: { saved: existing ? 'updated' : 'created' } })
    } catch (error) {
      if (newPhotoPath) await removeListingPhoto(newPhotoPath)
      setSaving(false)
      if (error instanceof ListingNotEditableError) {
        setErrorMessage('This listing is no longer available, so it can no longer be edited.')
      } else if (error instanceof Error && /mime|size|exceeded|too large/i.test(error.message)) {
        setErrorMessage('The photo was refused. Use a JPEG, PNG or WebP image of 5 MB or less.')
      } else {
        setErrorMessage('Saving failed. Your details are still here; check your connection and try again.')
      }
    }
  }

  const fieldClass = (field: keyof ListingDraftErrors, base = 'form-control') =>
    `${base}${errors[field] ? ' is-invalid' : ''}`
  const errorText = (field: keyof ListingDraftErrors) => (
    <div id={`listing-${field}-error`} className="invalid-feedback">
      {errors[field]}
    </div>
  )

  return (
    <section className="form-wide">
      <h1 className="h3">{existing ? 'Edit listing' : 'Sell an item'}</h1>
      <p className="text-body-secondary">
        Fixed price in Philippine pesos. Buyers pay you in person at the handover; the app does not handle payment.
      </p>

      <form onSubmit={handleSubmit} noValidate>
        <div className="mb-3">
          <label htmlFor="listing-title" className="form-label">Title</label>
          <input id="listing-title" className={fieldClass('title')} value={draft.title} onChange={update('title')}
            maxLength={120} aria-describedby="listing-title-error" />
          {errorText('title')}
        </div>

        <div className="row g-3 mb-3">
          <div className="col-sm-6">
            <label htmlFor="listing-categoryId" className="form-label">Category</label>
            <select id="listing-categoryId" className={fieldClass('categoryId', 'form-select')} value={draft.categoryId}
              onChange={update('categoryId')} aria-describedby="listing-categoryId-error">
              <option value="">Choose…</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
            {errorText('categoryId')}
          </div>
          <div className="col-sm-6">
            <label htmlFor="listing-program" className="form-label">Program it is for</label>
            <select id="listing-program" className={fieldClass('program', 'form-select')} value={draft.program}
              onChange={update('program')} aria-describedby="listing-program-error">
              <option value="">Choose…</option>
              {PROGRAMS.map((program) => (
                <option key={program} value={program}>{program}</option>
              ))}
            </select>
            {errorText('program')}
          </div>
        </div>

        <div className="row g-3 mb-3">
          <div className="col-sm-6">
            <label htmlFor="listing-price" className="form-label">Price (₱)</label>
            <input id="listing-price" className={fieldClass('price')} inputMode="decimal" value={draft.price}
              onChange={update('price')} placeholder="450.00" aria-describedby="listing-price-error" />
            {errorText('price')}
          </div>
          <div className="col-sm-6">
            <label htmlFor="listing-condition" className="form-label">Condition</label>
            <select id="listing-condition" className={fieldClass('condition', 'form-select')} value={draft.condition}
              onChange={update('condition')} aria-describedby="listing-condition-error">
              <option value="">Choose…</option>
              {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            {errorText('condition')}
          </div>
        </div>

        <div className="mb-3">
          <label htmlFor="listing-knownDefects" className="form-label">Known defects</label>
          <textarea id="listing-knownDefects" className={fieldClass('knownDefects')} rows={2} value={draft.knownDefects}
            onChange={update('knownDefects')} maxLength={1000} aria-describedby="listing-knownDefects-hint listing-knownDefects-error" />
          <div id="listing-knownDefects-hint" className="form-text">
            Required. Scratches, missing pages, weak battery… If you know of none, write “None known”.
          </div>
          {errorText('knownDefects')}
        </div>

        <div className="mb-3">
          <label htmlFor="listing-description" className="form-label">Description</label>
          <textarea id="listing-description" className={fieldClass('description')} rows={4} value={draft.description}
            onChange={update('description')} maxLength={2000} aria-describedby="listing-description-error" />
          {errorText('description')}
        </div>

        <div className="mb-3">
          <label htmlFor="listing-modelOrEdition" className="form-label">Model or edition (if any)</label>
          <input id="listing-modelOrEdition" className={fieldClass('modelOrEdition')} value={draft.modelOrEdition}
            onChange={update('modelOrEdition')} maxLength={200} placeholder="e.g. fx-991ES Plus, or 10th edition"
            aria-describedby="listing-modelOrEdition-error" />
          {errorText('modelOrEdition')}
        </div>

        <div className="mb-3">
          <label htmlFor="listing-includedParts" className="form-label">Included or missing parts (if any)</label>
          <textarea id="listing-includedParts" className={fieldClass('includedParts')} rows={2} value={draft.includedParts}
            onChange={update('includedParts')} maxLength={1000} placeholder="e.g. with cover; manual missing"
            aria-describedby="listing-includedParts-error" />
          {errorText('includedParts')}
        </div>

        <div className="mb-3">
          <label htmlFor="listing-photo" className="form-label">{existing ? 'Replace photo (optional)' : 'Photo'}</label>
          {existing && (
            <div className="mb-2">
              <ListingPhoto url={loadState.currentPhotoUrl} title={existing.title} className="listing-photo-small" />
            </div>
          )}
          <input id="listing-photo" type="file" className={fieldClass('photo')} accept={PHOTO_ACCEPT}
            onChange={handlePhotoChange} aria-describedby="listing-photo-hint listing-photo-error" />
          <div id="listing-photo-hint" className="form-text">JPEG, PNG or WebP, up to 5 MB.</div>
          {errorText('photo')}
        </div>

        {errorMessage && <p className="text-danger" role="alert">{errorMessage}</p>}

        <div className="d-flex flex-wrap gap-2">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : existing ? 'Save changes' : 'Publish listing'}
          </button>
          <Link to={existing ? `/listings/${existing.id}` : '/'} className="btn btn-outline-secondary">Cancel</Link>
        </div>
      </form>
    </section>
  )
}
