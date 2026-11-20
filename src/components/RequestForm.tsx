import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { fetchMeetupPlaces, requestErrorMessage, sendPurchaseRequest } from '../lib/requests'
import {
  MAX_NOTE_LENGTH,
  manilaLocalToIso,
  requestDraftProblems,
  type RequestDraft,
  type RequestDraftErrors,
} from '../lib/request-rules'
import type { MeetupPlace } from '../types/database'

type Props = { listingId: number; priceText: string }

export default function RequestForm({ listingId, priceText }: Props) {
  const navigate = useNavigate()
  const [places, setPlaces] = useState<MeetupPlace[] | null>(null)
  const [placesFailed, setPlacesFailed] = useState(false)
  const [draft, setDraft] = useState<RequestDraft>({ note: '', place: '', meetupAt: '' })
  const [errors, setErrors] = useState<RequestDraftErrors>({})
  const [formError, setFormError] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    fetchMeetupPlaces().then(setPlaces, () => setPlacesFailed(true))
  }, [])

  function change(field: keyof RequestDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setFormError('')
    const problems = requestDraftProblems(draft)
    setErrors(problems)
    if (Object.keys(problems).length > 0) return
    const iso = manilaLocalToIso(draft.meetupAt)
    if (!iso) return
    setSending(true)
    try {
      const request = await sendPurchaseRequest(listingId, draft.note, draft.place, iso)
      navigate(`/requests/${request.id}`, { state: { sent: true } })
    } catch (error) {
      setFormError(requestErrorMessage(error as { code?: string; message: string }))
      setSending(false)
    }
  }

  if (placesFailed) return <p role="alert">Could not load the meetup places. Reload the page.</p>
  if (!places) return <p>Loading the request form…</p>

  return (
    <form onSubmit={submit} noValidate className="border rounded p-3" aria-labelledby="request-heading">
      <h2 className="h5" id="request-heading">Request this item</h2>
      <p className="text-body-secondary">
        The seller sees the price you saw ({priceText}). Payment and handover happen in person, outside the app.
        You can send one request per item.
      </p>
      {formError && <p className="alert alert-danger" role="alert">{formError}</p>}

      <div className="mb-3">
        <label htmlFor="request-place" className="form-label">Meetup place</label>
        <select
          id="request-place"
          className={`form-select${errors.place ? ' is-invalid' : ''}`}
          value={draft.place}
          onChange={(event) => change('place', event.target.value)}
          aria-describedby="request-place-help request-place-error"
        >
          <option value="">Choose a place…</option>
          {places.map((place) => (
            <option key={place.id} value={place.name}>{place.name}</option>
          ))}
        </select>
        <div id="request-place-help" className="form-text">
          These are only suggestions for a public spot on campus. Check the item before you pay.
        </div>
        {errors.place && <div id="request-place-error" className="invalid-feedback d-block">{errors.place}</div>}
      </div>

      <div className="mb-3">
        <label htmlFor="request-time" className="form-label">Meetup date and time (Manila time)</label>
        <input
          id="request-time"
          type="datetime-local"
          className={`form-control${errors.meetupAt ? ' is-invalid' : ''}`}
          value={draft.meetupAt}
          onChange={(event) => change('meetupAt', event.target.value)}
          aria-describedby="request-time-help request-time-error"
        />
        <div id="request-time-help" className="form-text">Start between 7:00 AM and 8:00 PM (8:00 PM is the latest start), within the next 30 days.</div>
        {errors.meetupAt && <div id="request-time-error" className="invalid-feedback d-block">{errors.meetupAt}</div>}
      </div>

      <div className="mb-3">
        <label htmlFor="request-note" className="form-label">Note to the seller (optional)</label>
        <textarea
          id="request-note"
          rows={3}
          maxLength={MAX_NOTE_LENGTH + 50}
          className={`form-control${errors.note ? ' is-invalid' : ''}`}
          value={draft.note}
          onChange={(event) => change('note', event.target.value)}
          aria-describedby="request-note-error"
        />
        {errors.note && <div id="request-note-error" className="invalid-feedback d-block">{errors.note}</div>}
      </div>

      <button type="submit" className="btn btn-primary" disabled={sending}>
        {sending ? 'Sending…' : 'Send request'}
      </button>
    </form>
  )
}
