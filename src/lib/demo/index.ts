// Offline demo mode (npm run demo). The lib functions in accounts.ts,
// listings.ts and requests.ts call the matching function here instead of
// Supabase when demoMode is true. Pages and components are unchanged.
//
// - The data (accounts, listings, requests, uploaded photos) is saved in this
//   browser's localStorage, so every tab of the same browser sees it.
// - Who is signed in is kept per tab (sessionStorage), so one tab can be the
//   seller and another the buyer. A private window has its own storage and
//   does not see the same data.
// - The rules live in store.ts and copy the database functions.
import type { Session } from '@supabase/supabase-js'
import * as store from './store'
import type { DemoData, ListingColumns } from './store'
import type { ListingFilters } from '../listing-search'
import type { ApprovalStatus } from '../../types/database'

export const demoMode = import.meta.env.VITE_DEMO_MODE === 'true'

const DATA_KEY = 'campusbid-demo-data'
const SESSION_KEY = 'campusbid-demo-session'

// The same grey placeholder images the seed script uploads.
const seedPhotos = import.meta.glob('../../../scripts/seed-photos/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

let cache: DemoData | null = null

function load(): DemoData {
  if (cache) return cache
  try {
    const saved = localStorage.getItem(DATA_KEY)
    const parsed = saved ? (JSON.parse(saved) as DemoData) : null
    if (parsed && parsed.version === store.DEMO_DATA_VERSION) cache = parsed
  } catch {
    cache = null
  }
  if (!cache) {
    cache = store.seedDemoData()
    save(cache)
  }
  return cache
}

function save(data: DemoData) {
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(data))
  } catch {
    throw new store.DemoError('This browser has no room left for demo data. Use "Reset demo data" in the banner.')
  }
}

// Runs one store change and saves it. If the rule check throws, the saved
// copy is reloaded, so a half-made change is never kept (like a rollback).
function change<T>(run: (data: DemoData) => T): T {
  const data = load()
  try {
    const result = run(data)
    save(data)
    return result
  } catch (error) {
    cache = null
    throw error
  }
}

// Another tab changed the data: read it again on the next call.
if (demoMode) {
  window.addEventListener('storage', (event) => {
    if (event.key === DATA_KEY) cache = null
  })
}

// ---- session (per tab) ----------------------------------------------------

type Listener = (session: Session | null) => void
const listeners = new Set<Listener>()

function currentUserId(): string | null {
  return sessionStorage.getItem(SESSION_KEY)
}

function sessionFor(userId: string | null): Session | null {
  if (!userId) return null
  const user = load().users.find((candidate) => candidate.id === userId)
  if (!user) return null
  // Only session.user.id and email are read by the app.
  return { user: { id: user.id, email: user.email } } as Session
}

function setUser(userId: string | null) {
  if (userId) sessionStorage.setItem(SESSION_KEY, userId)
  else sessionStorage.removeItem(SESSION_KEY)
  const session = sessionFor(userId)
  for (const listener of listeners) listener(session)
}

// Same shape as supabase.auth, so AuthProvider can use either.
export const demoAuth = {
  async getSession() {
    return { data: { session: sessionFor(currentUserId()) } }
  },
  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    const listener: Listener = (session) => callback(session ? 'SIGNED_IN' : 'SIGNED_OUT', session)
    listeners.add(listener)
    return { data: { subscription: { unsubscribe: () => void listeners.delete(listener) } } }
  },
}

export function demoAccounts() {
  const data = load()
  return data.users.map((user) => {
    const profile = data.profiles.find((candidate) => candidate.id === user.id)
    return { id: user.id, email: user.email, name: profile?.full_name ?? '', status: profile?.approval_status ?? 'pending' }
  })
}

export function demoCurrentUserId() {
  return currentUserId()
}

export function switchDemoAccount(userId: string | null) {
  setUser(userId)
}

export function resetDemoData() {
  cache = store.seedDemoData()
  save(cache)
  setUser(null)
}

// ---- the functions the lib files call --------------------------------------

const me = () => currentUserId()

export const demo = {
  signIn(email: string) {
    setUser(store.demoSignIn(load(), email))
  },
  signOut() {
    setUser(null)
  },
  register(details: { email: string; fullName: string; program: string; yearLevel: number }) {
    const id = change((data) => store.demoRegister(data, details))
    setUser(id)
    return { user: { id }, session: sessionFor(id) }
  },
  fetchProfile: (userId: string) => store.demoProfile(load(), me(), userId),
  fetchPendingAccounts: () => store.demoPendingAccounts(load(), me()),
  reviewAccount: (profileId: string, decision: ApprovalStatus) =>
    change((data) => store.demoReviewAccount(data, me(), profileId, decision)),

  fetchCategories: () => [...load().categories].sort((a, b) => a.name.localeCompare(b.name)),
  fetchListing: (id: number) => store.demoListing(load(), me(), id),
  fetchMemberNames: (ids: string[]) => store.demoMemberNames(load(), me(), ids),
  fetchMyListings: () => store.demoMyListings(load(), me()),
  searchListings: (filters: ListingFilters) => store.demoSearchListings(load(), me(), filters),
  withdrawListing: (id: number) => change((data) => store.demoWithdrawListing(data, me(), id)),
  createListing: (columns: ListingColumns) => change((data) => store.demoCreateListing(data, me(), columns)),
  updateListing: (id: number, columns: ListingColumns) => change((data) => store.demoUpdateListing(data, me(), id, columns)),

  async uploadListingPhoto(path: string, file: File) {
    const url = await shrinkPhoto(file)
    change((data) => {
      data.photos[path] = url
    })
  },
  removeListingPhoto(path: string) {
    change((data) => {
      delete data.photos[path]
    })
  },
  signedPhotoUrls(paths: string[]) {
    const data = load()
    const urls = new Map<string, string>()
    for (const path of paths) {
      const url = path.startsWith(store.SEED_PHOTO_PREFIX)
        ? seedPhotos[`../../../scripts/seed-photos/${path.slice(store.SEED_PHOTO_PREFIX.length)}`]
        : data.photos[path]
      if (url) urls.set(path, url)
    }
    return urls
  },

  fetchMeetupPlaces: () => store.demoMeetupPlaces(load()),
  fetchMyRequestForListing: (listingId: number) => store.demoMyRequestForListing(load(), me(), listingId),
  fetchRequest: (id: number) => store.demoRequest(load(), me(), id),
  sendPurchaseRequest: (listingId: number, note: string, place: string, meetupIso: string) =>
    change((data) => store.demoSendRequest(data, me(), listingId, note, place, meetupIso)),
  acceptPurchaseRequest: (id: number) => change((data) => store.demoAcceptRequest(data, me(), id)),
  declinePurchaseRequest: (id: number, reason: string) => change((data) => store.demoDeclineRequest(data, me(), id, reason)),
  cancelPurchaseRequest: (id: number, reason: string) => change((data) => store.demoCancelRequest(data, me(), id, reason)),
  completePurchaseRequest: (id: number) => change((data) => store.demoCompleteRequest(data, me(), id)),
  fetchRequestsReceived: () => store.demoRequestsReceived(load(), me()),
  fetchMyRequests: () => store.demoMyRequests(load(), me()),
}

// Uploaded photos are kept as data URLs. They are scaled down to at most
// 800 px so a few of them fit in the browser's storage (about 5 MB).
async function shrinkPhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 800 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.8)
}
