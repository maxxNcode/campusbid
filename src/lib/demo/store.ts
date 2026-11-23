// Offline demo store: the same rules as the database functions, applied to a
// plain object kept in this browser (see demo/index.ts for saving it).
// Nothing here talks to Supabase. Each function takes the signed-in user's id
// ("me") the way the database reads auth.uid(), and a clock, so the tests can
// fix the time. Messages and error codes are copied from the migrations, so
// the screens show the same text as with the real database.
// The tests load this file too, hence the .ts extension on imports.
import { CATEGORIES, DEMO_ACCOUNTS } from '../../../scripts/demo-accounts.ts'
import { DEMO_LISTINGS } from '../../../scripts/demo-listings.ts'
import { keywordWords, PAGE_SIZE, type ListingFilters, type ListingPage } from '../listing-search.ts'
import { MAX_NOTE_LENGTH, MEETUP_FIRST_HOUR, MEETUP_LAST_HOUR, MEETUP_WINDOW_DAYS } from '../request-rules.ts'
import type {
  ApprovalStatus,
  Category,
  Listing,
  MeetupPlace,
  PendingAccount,
  Profile,
  PurchaseRequest,
} from '../../types/database.ts'

export const DEMO_DATA_VERSION = 1

export type DemoData = {
  version: number
  users: { id: string; email: string }[]
  profiles: Profile[]
  categories: Category[]
  places: MeetupPlace[]
  listings: Listing[]
  requests: PurchaseRequest[]
  photos: Record<string, string> // uploaded photo path -> data URL
  nextId: number
}

// The listing columns the form sends (see draftToColumns in listings.ts).
export type ListingColumns = Pick<
  Listing,
  | 'title'
  | 'description'
  | 'category_id'
  | 'program'
  | 'price'
  | 'condition'
  | 'model_or_edition'
  | 'included_parts'
  | 'known_defects'
  | 'photo_path'
>

// Shaped like a database error, so requestErrorMessage shows the message.
export class DemoError extends Error {
  code: string
  constructor(message: string, code = 'P0001') {
    super(message)
    this.code = code
  }
}

export const SEED_PHOTO_PREFIX = 'demo-seed/'

const DAY = 24 * 60 * 60 * 1000

function nextId(data: DemoData): number {
  data.nextId += 1
  return data.nextId
}

export function seedDemoData(now: Date = new Date()): DemoData {
  const at = (msAgo: number) => new Date(now.getTime() - msAgo).toISOString()
  const data: DemoData = {
    version: DEMO_DATA_VERSION,
    users: [],
    profiles: [],
    categories: [],
    places: [],
    listings: [],
    requests: [],
    photos: {},
    nextId: 0,
  }
  const ids = new Map<string, string>()
  for (const account of DEMO_ACCOUNTS) {
    const id = `demo-${account.key}`
    ids.set(account.key, id)
    data.users.push({ id, email: account.email })
    data.profiles.push({
      id,
      full_name: account.fullName,
      program: account.program,
      year_level: account.yearLevel,
      is_admin: account.isAdmin,
      approval_status: account.approvalStatus,
      reviewed_by: account.approvalStatus === 'approved' ? 'demo-admin' : null,
      reviewed_at: account.approvalStatus === 'approved' ? at(30 * DAY) : null,
      created_at: at(31 * DAY),
      updated_at: at(30 * DAY),
    })
  }
  for (const category of CATEGORIES) {
    data.categories.push({ id: nextId(data), name: category.name, slug: category.slug, created_at: at(31 * DAY) })
  }
  ;[
    'Library entrance, in the open area',
    'Canteen seating area',
    'Engineering building lobby',
    'Student lounge, ground floor',
    'Main gate waiting area',
  ].forEach((name, index) => data.places.push({ id: nextId(data), name, is_active: true, sort_order: index + 1 }))

  DEMO_LISTINGS.forEach((item, index) => {
    // Listed in order, so the last one is the newest (one hour apart).
    const created = at((DEMO_LISTINGS.length - index) * 60 * 60 * 1000 + 2 * DAY)
    const listing: Listing = {
      id: nextId(data),
      seller_id: ids.get(item.seller)!,
      category_id: data.categories.find((category) => category.slug === item.categorySlug)!.id,
      program: item.program,
      title: item.title,
      description: item.description,
      price: Number(item.price),
      condition: item.condition,
      model_or_edition: item.modelOrEdition,
      included_parts: item.includedParts,
      known_defects: item.knownDefects,
      photo_path: `${SEED_PHOTO_PREFIX}${item.photo}.png`,
      status: item.status,
      created_at: created,
      updated_at: created,
    }
    data.listings.push(listing)
    if (item.status === 'sold') {
      const handover = at(DAY)
      data.requests.push({
        id: nextId(data),
        listing_id: listing.id,
        buyer_id: ids.get('buyer')!,
        note: 'Demo request.',
        status: 'completed',
        meetup_place: 'Library entrance, in the open area',
        meetup_at: handover,
        price_seen: listing.price,
        accepted_at: handover,
        completed_at: handover,
        closed_at: null,
        closed_reason: null,
        created_at: created,
        updated_at: handover,
      })
    }
  })
  return data
}

// ---- accounts -------------------------------------------------------------

function profileOf(data: DemoData, me: string | null): Profile | undefined {
  return me ? data.profiles.find((profile) => profile.id === me) : undefined
}

function isApproved(data: DemoData, me: string | null): boolean {
  return profileOf(data, me)?.approval_status === 'approved'
}

function isAdmin(data: DemoData, me: string | null): boolean {
  const profile = profileOf(data, me)
  return Boolean(profile?.is_admin && profile.approval_status === 'approved')
}

// Demo sign-in: any example.test account in the store, any password.
export function demoSignIn(data: DemoData, email: string): string {
  const user = data.users.find((candidate) => candidate.email.toLowerCase() === email.trim().toLowerCase())
  if (!user) throw new Error('Invalid login credentials')
  return user.id
}

export function demoRegister(
  data: DemoData,
  details: { email: string; fullName: string; program: string; yearLevel: number },
  now: Date = new Date(),
): string {
  const email = details.email.trim().toLowerCase()
  if (data.users.some((user) => user.email.toLowerCase() === email)) throw new Error('User already registered')
  const id = `demo-user-${nextId(data)}`
  data.users.push({ id, email })
  // As in handle_new_user(): every new account starts pending and not admin.
  data.profiles.push({
    id,
    full_name: details.fullName,
    program: details.program,
    year_level: details.yearLevel,
    is_admin: false,
    approval_status: 'pending',
    reviewed_by: null,
    reviewed_at: null,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  })
  return id
}

// Profiles policy: your own, all for an admin, approved ones for approved members.
export function demoProfile(data: DemoData, me: string | null, id: string): Profile | null {
  const profile = data.profiles.find((candidate) => candidate.id === id)
  if (!profile || !me) return null
  if (id === me || isAdmin(data, me) || (isApproved(data, me) && profile.approval_status === 'approved')) {
    return { ...profile }
  }
  return null
}

export function demoPendingAccounts(data: DemoData, me: string | null): PendingAccount[] {
  if (!isAdmin(data, me)) throw new DemoError('Only an approved admin can list pending accounts', '42501')
  return data.profiles
    .filter((profile) => profile.approval_status === 'pending')
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((profile) => ({
      id: profile.id,
      email: data.users.find((user) => user.id === profile.id)?.email ?? '',
      full_name: profile.full_name,
      program: profile.program,
      year_level: profile.year_level,
      created_at: profile.created_at,
    }))
}

export function demoReviewAccount(
  data: DemoData,
  me: string | null,
  id: string,
  decision: ApprovalStatus,
  now: Date = new Date(),
): void {
  if (!isAdmin(data, me)) throw new DemoError('Only an approved admin can review accounts', '42501')
  if (decision !== 'approved' && decision !== 'rejected') {
    throw new DemoError('Decision must be approved or rejected', '22023')
  }
  if (id === me) throw new DemoError('Admins cannot review their own account', '42501')
  const profile = data.profiles.find((candidate) => candidate.id === id)
  if (!profile) throw new DemoError('Account not found', 'P0002')
  if (profile.approval_status !== 'pending') throw new DemoError('This account has already been reviewed', '55000')
  profile.approval_status = decision
  profile.reviewed_by = me
  profile.reviewed_at = now.toISOString()
  profile.updated_at = now.toISOString()
}

export function demoMemberNames(data: DemoData, me: string | null, ids: string[]): Map<string, string> {
  const names = new Map<string, string>()
  if (!isApproved(data, me)) return names
  for (const profile of data.profiles) {
    if (ids.includes(profile.id) && profile.approval_status === 'approved') names.set(profile.id, profile.full_name)
  }
  return names
}

// ---- listings -------------------------------------------------------------

// Listings policy: approved members see available and reserved items, their
// own listings in any status, and listings they sent a request for.
function canSeeListing(data: DemoData, me: string | null, listing: Listing): boolean {
  if (!isApproved(data, me)) return false
  if (listing.seller_id === me) return true
  if (listing.status === 'active' || listing.status === 'reserved') return true
  return data.requests.some((request) => request.listing_id === listing.id && request.buyer_id === me)
}

const newestFirst = (a: { created_at: string; id: number }, b: { created_at: string; id: number }) =>
  b.created_at.localeCompare(a.created_at) || b.id - a.id

export function demoListing(data: DemoData, me: string | null, id: number): Listing | null {
  const listing = data.listings.find((candidate) => candidate.id === id)
  return listing && canSeeListing(data, me, listing) ? { ...listing } : null
}

export function demoMyListings(data: DemoData, me: string | null): Listing[] {
  if (!isApproved(data, me)) return []
  return data.listings.filter((listing) => listing.seller_id === me).sort(newestFirst).map((listing) => ({ ...listing }))
}

export function demoSearchListings(data: DemoData, me: string | null, filters: ListingFilters): ListingPage {
  const page = Math.max(1, Math.floor(filters.page))
  const words = keywordWords(filters.keyword).map((word) => word.toLowerCase())
  const statuses = filters.includeReserved ? ['active', 'reserved'] : ['active']
  const matches = data.listings
    .filter((listing) => statuses.includes(listing.status) && canSeeListing(data, me, listing))
    .filter((listing) =>
      words.every((word) =>
        [listing.title, listing.description, listing.model_or_edition ?? ''].some((text) =>
          text.toLowerCase().includes(word),
        ),
      ),
    )
    .filter((listing) => filters.categoryId === null || listing.category_id === filters.categoryId)
    .filter((listing) => !filters.program || listing.program === filters.program)
    .sort(newestFirst)
  const total = matches.length
  const pageCount = Math.ceil(total / PAGE_SIZE)
  const from = (page - 1) * PAGE_SIZE
  if (page > 1 && from >= total) return { listings: [], total: 0, pageCount: 0, pastEnd: true }
  return {
    listings: matches.slice(from, from + PAGE_SIZE).map((listing) => ({ ...listing })),
    total,
    pageCount,
    pastEnd: false,
  }
}

export function demoCreateListing(
  data: DemoData,
  me: string | null,
  columns: ListingColumns,
  now: Date = new Date(),
): Listing {
  // The insert policy: approved members only, seller is the caller, a photo is required.
  if (!isApproved(data, me)) throw new DemoError('new row violates row-level security policy for table "listings"', '42501')
  if (!columns.photo_path) throw new DemoError('A listing needs a photo.', '23502')
  const listing: Listing = {
    ...columns,
    id: nextId(data),
    seller_id: me!,
    status: 'active',
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  }
  data.listings.push(listing)
  return { ...listing }
}

// Returns null when the listing is not yours or no longer active, like the
// update that matches no row; listings.ts turns that into ListingNotEditableError.
export function demoUpdateListing(
  data: DemoData,
  me: string | null,
  id: number,
  columns: ListingColumns,
  now: Date = new Date(),
): Listing | null {
  const listing = data.listings.find((candidate) => candidate.id === id)
  if (!listing || !isApproved(data, me) || listing.seller_id !== me || listing.status !== 'active') return null
  Object.assign(listing, columns, { updated_at: now.toISOString() })
  return { ...listing }
}

export function demoWithdrawListing(data: DemoData, me: string | null, id: number, now: Date = new Date()): Listing {
  if (!isApproved(data, me)) throw new DemoError('Only approved members can withdraw listings.', '42501')
  const listing = data.listings.find((candidate) => candidate.id === id)
  if (!listing || listing.seller_id !== me) throw new DemoError('Listing not found, or it is not yours.', '42501')
  if (listing.status !== 'active') throw new DemoError('Only an available listing can be withdrawn.')
  for (const request of data.requests) {
    if (request.listing_id === listing.id && request.status === 'pending') {
      close(request, 'cancelled', 'The seller withdrew the listing.', now)
    }
  }
  listing.status = 'withdrawn'
  listing.updated_at = now.toISOString()
  return { ...listing }
}

// ---- requests -------------------------------------------------------------

export function demoMeetupPlaces(data: DemoData): MeetupPlace[] {
  return data.places
    .filter((place) => place.is_active)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    .map((place) => ({ ...place }))
}

// Requests policy: the buyer and the listing's seller can read a request.
function canSeeRequest(data: DemoData, me: string | null, request: PurchaseRequest): boolean {
  if (!isApproved(data, me)) return false
  if (request.buyer_id === me) return true
  return data.listings.find((listing) => listing.id === request.listing_id)?.seller_id === me
}

export function demoRequest(data: DemoData, me: string | null, id: number): PurchaseRequest | null {
  const request = data.requests.find((candidate) => candidate.id === id)
  return request && canSeeRequest(data, me, request) ? { ...request } : null
}

export function demoMyRequestForListing(data: DemoData, me: string | null, listingId: number): PurchaseRequest | null {
  const request = data.requests.find((candidate) => candidate.listing_id === listingId && candidate.buyer_id === me)
  return request && canSeeRequest(data, me, request) ? { ...request } : null
}

export function demoRequestsReceived(data: DemoData, me: string | null) {
  const listings = new Map(demoMyListings(data, me).map((listing) => [listing.id, listing]))
  const requests = data.requests
    .filter((request) => listings.has(request.listing_id))
    .sort(newestFirst)
    .map((request) => ({ ...request }))
  return { requests, listings }
}

export function demoMyRequests(data: DemoData, me: string | null) {
  const requests = data.requests
    .filter((request) => isApproved(data, me) && request.buyer_id === me)
    .sort(newestFirst)
    .map((request) => ({ ...request }))
  const listings = new Map<number, Listing>()
  for (const request of requests) {
    const listing = data.listings.find((candidate) => candidate.id === request.listing_id)
    if (listing) listings.set(listing.id, { ...listing })
  }
  return { requests, listings }
}

// Manila has no daylight saving: local time is UTC + 8 hours.
function manilaMinutes(iso: string): { minutes: number; seconds: number } {
  const local = new Date(new Date(iso).getTime() + 8 * 60 * 60 * 1000)
  return { minutes: local.getUTCHours() * 60 + local.getUTCMinutes(), seconds: local.getUTCSeconds() }
}

export function demoSendRequest(
  data: DemoData,
  me: string | null,
  listingId: number,
  note: string | null,
  place: string,
  meetupIso: string,
  now: Date = new Date(),
): PurchaseRequest {
  if (!isApproved(data, me)) throw new DemoError('Only approved members can send requests.', '42501')
  const listing = data.listings.find((candidate) => candidate.id === listingId)
  if (!listing) throw new DemoError('This listing was not found.', 'P0002')
  if (listing.seller_id === me) throw new DemoError('You cannot request your own item.')
  if (listing.status !== 'active') throw new DemoError('This item is no longer available for requests.')
  if (data.requests.some((request) => request.listing_id === listing.id && request.buyer_id === me)) {
    throw new DemoError(
      'You already sent a request for this item. Each buyer can send one request per item, even after it was declined or cancelled.',
    )
  }
  const cleanNote = (note ?? '').trim() || null
  if (cleanNote && cleanNote.length > MAX_NOTE_LENGTH) throw new DemoError('Keep the note under 500 characters.')
  const cleanPlace = place.trim()
  if (!data.places.some((candidate) => candidate.name === cleanPlace && candidate.is_active)) {
    throw new DemoError('Choose one of the listed meetup places.')
  }
  const when = new Date(meetupIso).getTime()
  if (Number.isNaN(when) || when <= now.getTime()) throw new DemoError('The meetup time must be in the future.')
  if (when > now.getTime() + MEETUP_WINDOW_DAYS * DAY) throw new DemoError('Choose a meetup within the next 30 days.')
  const local = manilaMinutes(meetupIso)
  const tooLate = local.minutes > MEETUP_LAST_HOUR * 60 || (local.minutes === MEETUP_LAST_HOUR * 60 && local.seconds > 0)
  if (local.minutes < MEETUP_FIRST_HOUR * 60 || tooLate) {
    throw new DemoError('Choose a meetup time between 7:00 AM and 8:00 PM (Manila time).')
  }
  const request: PurchaseRequest = {
    id: nextId(data),
    listing_id: listing.id,
    buyer_id: me!,
    note: cleanNote,
    status: 'pending',
    meetup_place: cleanPlace,
    meetup_at: new Date(when).toISOString(),
    price_seen: listing.price,
    accepted_at: null,
    completed_at: null,
    closed_at: null,
    closed_reason: null,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  }
  data.requests.push(request)
  return { ...request }
}

function close(request: PurchaseRequest, status: 'declined' | 'cancelled', reason: string | null, now: Date) {
  request.status = status
  request.closed_at = now.toISOString()
  request.closed_reason = reason
  request.updated_at = now.toISOString()
}

// The seller-side lookup shared by accept, decline and complete.
function sellerTarget(data: DemoData, me: string | null, id: number, notApproved: string) {
  if (!isApproved(data, me)) throw new DemoError(notApproved, '42501')
  const request = data.requests.find((candidate) => candidate.id === id)
  const listing = request && data.listings.find((candidate) => candidate.id === request.listing_id)
  if (!request || !listing || listing.seller_id !== me) {
    throw new DemoError('Request not found, or it is not for your listing.', '42501')
  }
  return { request, listing }
}

export function demoAcceptRequest(data: DemoData, me: string | null, id: number, now: Date = new Date()): PurchaseRequest {
  const { request, listing } = sellerTarget(data, me, id, 'Only approved members can answer requests.')
  if (request.status !== 'pending') throw new DemoError(`This request is no longer pending. It is now ${request.status}.`)
  if (listing.status !== 'active') throw new DemoError('This item is no longer available, so no request can be accepted.')
  if (new Date(request.meetup_at).getTime() <= now.getTime()) {
    throw new DemoError(
      'The meetup time for this request has already passed, so it cannot be accepted. Decline it and ask the buyer for new times.',
    )
  }
  request.status = 'accepted'
  request.accepted_at = now.toISOString()
  request.updated_at = now.toISOString()
  for (const other of data.requests) {
    if (other.listing_id === listing.id && other.id !== request.id && other.status === 'pending') {
      close(other, 'declined', 'The item is no longer available: the seller accepted another request.', now)
    }
  }
  listing.status = 'reserved'
  listing.updated_at = now.toISOString()
  return { ...request }
}

export function demoDeclineRequest(
  data: DemoData,
  me: string | null,
  id: number,
  reason: string | null,
  now: Date = new Date(),
): PurchaseRequest {
  const { request } = sellerTarget(data, me, id, 'Only approved members can answer requests.')
  if (request.status !== 'pending') throw new DemoError(`This request is no longer pending. It is now ${request.status}.`)
  const clean = (reason ?? '').trim() || null
  if (clean && clean.length > 500) throw new DemoError('Keep the reason under 500 characters.')
  close(request, 'declined', clean, now)
  return { ...request }
}

export function demoCancelRequest(
  data: DemoData,
  me: string | null,
  id: number,
  reason: string,
  now: Date = new Date(),
): PurchaseRequest {
  if (!isApproved(data, me)) throw new DemoError('Only approved members can cancel requests.', '42501')
  const request = data.requests.find((candidate) => candidate.id === id)
  const listing = request && data.listings.find((candidate) => candidate.id === request.listing_id)
  if (!request || !listing || (request.buyer_id !== me && listing.seller_id !== me)) {
    throw new DemoError('Request not found, or it is not yours.', '42501')
  }
  if (request.buyer_id === me) {
    if (request.status !== 'pending' && request.status !== 'accepted') {
      throw new DemoError(`This request can no longer be cancelled. It is now ${request.status}.`)
    }
  } else if (request.status !== 'accepted') {
    throw new DemoError(`You can cancel only an accepted request. It is now ${request.status}.`)
  }
  const wasAccepted = request.status === 'accepted'
  const clean = reason.trim()
  if (wasAccepted && clean.length < 3) throw new DemoError('Give a short reason (at least 3 characters).')
  if (clean !== '' && clean.length < 3) throw new DemoError('Give a short reason (at least 3 characters), or leave it empty.')
  if (clean.length > 500) throw new DemoError('Keep the reason under 500 characters.')
  if (wasAccepted && listing.status !== 'reserved') {
    throw new DemoError('The listing is not reserved, so this arrangement cannot be cancelled.')
  }
  close(request, 'cancelled', clean || null, now)
  if (wasAccepted) {
    listing.status = 'active'
    listing.updated_at = now.toISOString()
  }
  return { ...request }
}

export function demoCompleteRequest(data: DemoData, me: string | null, id: number, now: Date = new Date()): PurchaseRequest {
  const { request, listing } = sellerTarget(data, me, id, 'Only approved members can complete requests.')
  if (request.status !== 'accepted') {
    throw new DemoError(`Only an accepted request can be completed. This one is ${request.status}.`)
  }
  if (listing.status !== 'reserved') throw new DemoError('The listing is not reserved, so this request cannot be completed.')
  request.status = 'completed'
  request.completed_at = now.toISOString()
  request.updated_at = now.toISOString()
  listing.status = 'sold'
  listing.updated_at = now.toISOString()
  return { ...request }
}
