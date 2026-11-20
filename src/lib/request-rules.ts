// Request labels and the meetup form check, shared by the screens and the tests.
// The database repeats every rule; this file only gives faster messages.
// The tests load this file too, hence the .ts extension on imports.
import type { Database } from '../types/database.ts'

export type RequestStatus = Database['public']['Enums']['request_status']

// Request status names shown to people. Listing labels are separate.
export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  declined: 'Declined',
  cancelled: 'Cancelled',
  completed: 'Completed',
}

export const MAX_NOTE_LENGTH = 500
export const MEETUP_WINDOW_DAYS = 30
export const MEETUP_FIRST_HOUR = 7
export const MEETUP_LAST_HOUR = 20

// A <input type="datetime-local"> value such as "2026-11-22T10:00" is Manila
// time. The Philippines has no daylight saving, so the offset is always +08:00.
export function manilaLocalToIso(localValue: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(localValue)) return null
  const date = new Date(`${localValue}:00+08:00`)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function meetupProblem(localValue: string, now: Date = new Date()): string | null {
  const iso = manilaLocalToIso(localValue)
  if (!iso) return 'Choose a meetup date and time.'
  const when = new Date(iso)
  if (when.getTime() <= now.getTime()) return 'The meetup time must be in the future.'
  if (when.getTime() > now.getTime() + MEETUP_WINDOW_DAYS * 24 * 60 * 60 * 1000) {
    return `Choose a meetup within the next ${MEETUP_WINDOW_DAYS} days.`
  }
  const minutes = Number(localValue.slice(11, 13)) * 60 + Number(localValue.slice(14, 16))
  if (minutes < MEETUP_FIRST_HOUR * 60 || minutes > MEETUP_LAST_HOUR * 60) {
    return 'Choose a start time between 7:00 AM and 8:00 PM, the latest start (Manila time).'
  }
  return null
}

export type RequestDraft = { note: string; place: string; meetupAt: string }
export type RequestDraftErrors = Partial<Record<keyof RequestDraft, string>>

export function requestDraftProblems(draft: RequestDraft, now: Date = new Date()): RequestDraftErrors {
  const errors: RequestDraftErrors = {}
  if (draft.note.trim().length > MAX_NOTE_LENGTH) errors.note = `Keep the note under ${MAX_NOTE_LENGTH} characters.`
  if (!draft.place) errors.place = 'Choose a meetup place.'
  const meetup = meetupProblem(draft.meetupAt, now)
  if (meetup) errors.meetupAt = meetup
  return errors
}

export function reasonProblem(reason: string): string | null {
  const trimmed = reason.trim()
  if (trimmed.length < 3) return 'Give a short reason (at least 3 characters).'
  if (trimmed.length > 500) return 'Keep the reason under 500 characters.'
  return null
}
