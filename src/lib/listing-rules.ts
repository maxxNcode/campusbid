// Listing labels, limits and form checks shared by the screens and the
// tests. Nothing here talks to Supabase.
// The tests load this file too, hence the .ts extension on imports.
import type { Database } from '../types/database.ts'

export type ItemCondition = Database['public']['Enums']['item_condition']
export type ListingStatus = Database['public']['Enums']['listing_status']

export const CONDITION_LABELS: Record<ItemCondition, string> = {
  new: 'New',
  like_new: 'Like new',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
}

// Listing status names shown to people. "active" is shown as "Available".
export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  active: 'Available',
  reserved: 'Reserved',
  sold: 'Sold',
  withdrawn: 'Withdrawn',
}

// The same limit and types are set on the Storage bucket, which enforces them.
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024
export const PHOTO_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
export const PHOTO_ACCEPT = Object.keys(PHOTO_EXTENSIONS).join(',')

export function photoProblem(file: { type: string; size: number }): string | null {
  if (!(file.type in PHOTO_EXTENSIONS)) return 'Choose a JPEG, PNG or WebP image.'
  if (file.size > MAX_PHOTO_BYTES) return 'The photo must be 5 MB or smaller.'
  if (file.size === 0) return 'This file is empty.'
  return null
}

// Generated storage name: <user id>/<random uuid>.<ext>. The bucket policy
// refuses any other shape, so the uploader's own file name is never used.
export function generatedPhotoPath(userId: string, mimeType: string): string {
  return `${userId}/${crypto.randomUUID()}.${PHOTO_EXTENSIONS[mimeType]}`
}

// Prices are kept as text with at most two decimals and passed to Postgres
// numeric(10,2) unchanged; the app never does arithmetic on them.
const PRICE_PATTERN = /^\d{1,8}(\.\d{1,2})?$/

export function priceProblem(text: string): string | null {
  const trimmed = text.trim()
  if (!PRICE_PATTERN.test(trimmed)) return 'Enter a price in pesos, for example 450 or 450.50.'
  if (/^0+(\.0+)?$/.test(trimmed)) return 'The price must be more than ₱0.'
  return null
}

const pesoFormat = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })

export function formatPeso(price: number | string): string {
  return pesoFormat.format(Number(price))
}

export type ListingDraft = {
  title: string
  description: string
  categoryId: string
  program: string
  price: string
  condition: string
  modelOrEdition: string
  includedParts: string
  knownDefects: string
}

export type ListingDraftErrors = Partial<Record<keyof ListingDraft | 'photo', string>>

export function listingDraftProblems(draft: ListingDraft): ListingDraftErrors {
  const errors: ListingDraftErrors = {}
  const title = draft.title.trim()
  if (title.length < 3 || title.length > 120) errors.title = 'Enter a title of 3 to 120 characters.'
  const description = draft.description.trim()
  if (description.length < 10 || description.length > 2000) {
    errors.description = 'Describe the item in 10 to 2000 characters.'
  }
  if (!draft.categoryId) errors.categoryId = 'Choose a category.'
  if (!draft.program) errors.program = 'Choose the program this item is for.'
  const priceError = priceProblem(draft.price)
  if (priceError) errors.price = priceError
  if (!(draft.condition in CONDITION_LABELS)) errors.condition = 'Choose the condition.'
  const defects = draft.knownDefects.trim()
  if (defects.length < 2 || defects.length > 1000) {
    errors.knownDefects = 'Describe any defects, or write "None known".'
  }
  if (draft.modelOrEdition.trim().length > 200) errors.modelOrEdition = 'Keep this under 200 characters.'
  if (draft.includedParts.trim().length > 1000) errors.includedParts = 'Keep this under 1000 characters.'
  return errors
}
