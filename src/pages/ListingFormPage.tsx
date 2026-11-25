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
import { ErrorNotice, Loading, PageHeader } from '../components/ui'
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
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
    const problem = file ? photoProblem(file) : null
    setPhoto(file)
    setErrors((current) => ({ ...current, photo: problem ?? undefined }))
    setPreviewUrl(null)
    // Show the chosen photo before it is uploaded.
    if (file && !problem) {
      const reader = new FileReader()
      reader.onload = () => setPreviewUrl(typeof reader.result === 'string' ? reader.result : null)
      reader.readAsDataURL(file)
    }
  }

  if (loadState.kind === 'loading') return <Loading />
  if (loadState.kind === 'blocked') {
    return (
      <section>
        <PageHeader title={editingId === null ? 'Sell an item' : 'Edit listing'} />
        <ErrorNotice>{loadState.message}</ErrorNotice>
        <Link to="/my-listings" className="btn btn-outline-primary">Back to My Listings</Link>
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
      <PageHeader title={existing ? 'Edit listing' : 'Sell an item'}>
        Fixed price in Philippine pesos. Buyers pay you in person at the handover; CampusBid does not handle payment.
      </PageHeader>

      <form onSubmit={handleSubmit} noValidate>
        <fieldset className="cb-card cb-form-section">
          <legend>The item</legend>
          <p className="cb-section-hint">What it is and who it is useful for. Buyers search these words.</p>
          <div className="mb-3">
            <label htmlFor="listing-title" className="form-label">Title</label>
            <input id="listing-title" className={fieldClass('title')} value={draft.title} onChange={update('title')}
              maxLength={120} placeholder="e.g. Casio fx-991ES Plus scientific calculator" aria-describedby="listing-title-error" />
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

          <div className="mb-3">
            <label htmlFor="listing-modelOrEdition" className="form-label">Model or edition (optional)</label>
            <input id="listing-modelOrEdition" className={fieldClass('modelOrEdition')} value={draft.modelOrEdition}
              onChange={update('modelOrEdition')} maxLength={200} placeholder="e.g. fx-991ES Plus, or 10th edition"
              aria-describedby="listing-modelOrEdition-error" />
            {errorText('modelOrEdition')}
          </div>

          <div>
            <label htmlFor="listing-description" className="form-label">Description</label>
            <textarea id="listing-description" className={fieldClass('description')} rows={4} value={draft.description}
              onChange={update('description')} maxLength={2000} aria-describedby="listing-description-hint listing-description-error" />
            <div id="listing-description-hint" className="form-text">How long you used it, why you are selling, anything a buyer should know.</div>
            {errorText('description')}
          </div>
        </fieldset>

        <fieldset className="cb-card cb-form-section">
          <legend>Price and condition</legend>
          <p className="cb-section-hint">Be honest here. Buyers check the item at the meetup before they pay.</p>
          <div className="row g-3 mb-3">
            <div className="col-sm-6">
              <label htmlFor="listing-price" className="form-label">Price</label>
              <div className="input-group has-validation">
                <span className="input-group-text" aria-hidden="true">₱</span>
                <input id="listing-price" className={fieldClass('price')} inputMode="decimal" value={draft.price}
                  onChange={update('price')} placeholder="450.00" aria-describedby="listing-price-hint listing-price-error" />
                {errorText('price')}
              </div>
              <div id="listing-price-hint" className="form-text">Fixed price, up to two decimal places.</div>
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

          <div>
            <label htmlFor="listing-includedParts" className="form-label">Included or missing parts (optional)</label>
            <textarea id="listing-includedParts" className={fieldClass('includedParts')} rows={2} value={draft.includedParts}
              onChange={update('includedParts')} maxLength={1000} placeholder="e.g. with cover; manual missing"
              aria-describedby="listing-includedParts-error" />
            {errorText('includedParts')}
          </div>
        </fieldset>

        <fieldset className="cb-card cb-form-section">
          <legend>Photo</legend>
          <p className="cb-section-hint">One clear photo of the actual item. JPEG, PNG or WebP, up to 5 MB.</p>
          <div className="row g-3 align-items-start">
            <div className="col-sm-5">
              {previewUrl ? (
                <img src={previewUrl} alt="Preview of the new photo" className="listing-photo cb-photo-preview" />
              ) : existing ? (
                <ListingPhoto url={loadState.currentPhotoUrl} title={existing.title} className="cb-photo-preview" />
              ) : (
                <div className="listing-photo listing-photo-missing cb-photo-preview" aria-hidden="true">
                  <span>No photo chosen yet</span>
                </div>
              )}
              <p className="small cb-muted mt-1 mb-0">
                {previewUrl ? 'New photo, saved when you submit.' : existing ? 'Current photo.' : 'The preview shows here.'}
              </p>
            </div>
            <div className="col-sm-7">
              <label htmlFor="listing-photo" className="form-label">{existing ? 'Replace photo (optional)' : 'Choose a photo'}</label>
              <input id="listing-photo" type="file" className={fieldClass('photo')} accept={PHOTO_ACCEPT}
                onChange={handlePhotoChange} aria-describedby="listing-photo-error" />
              {errorText('photo')}
            </div>
          </div>
        </fieldset>

        {errorMessage && <ErrorNotice>{errorMessage}</ErrorNotice>}

        <div className="cb-form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />}
            {saving ? 'Saving…' : existing ? 'Save changes' : 'Publish listing'}
          </button>
          <Link to={existing ? `/listings/${existing.id}` : '/'} className="btn btn-outline-secondary">Cancel</Link>
        </div>
      </form>
    </section>
  )
}
