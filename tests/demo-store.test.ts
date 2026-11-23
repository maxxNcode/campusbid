// The offline demo store must apply the same rules as the database functions.
// No database or browser needed: the store is a plain object and the clock is fixed.
import { describe, expect, it } from 'vitest'
import {
  demoAcceptRequest,
  demoCancelRequest,
  demoCompleteRequest,
  demoCreateListing,
  demoDeclineRequest,
  demoListing,
  demoMyRequests,
  demoPendingAccounts,
  demoProfile,
  demoRegister,
  demoReviewAccount,
  demoSearchListings,
  demoSendRequest,
  demoSignIn,
  demoUpdateListing,
  demoWithdrawListing,
  seedDemoData,
  type DemoData,
} from '../src/lib/demo/store.ts'

// 2026-11-23 09:00 Manila (01:00 UTC).
const NOW = new Date('2026-11-23T01:00:00Z')
const LATER = new Date('2026-11-23T02:00:00Z')
const TOMORROW_10AM = '2026-11-24T10:00:00+08:00'
const PLACE = 'Canteen seating area'
const SELLER = 'demo-seller'
const BUYER = 'demo-buyer'
const ADMIN = 'demo-admin'
const PENDING = 'demo-pending'

function fresh() {
  const data = seedDemoData(NOW)
  const listing = data.listings.find((item) => item.seller_id === SELLER && item.status === 'active')!
  return { data, listing }
}

// A second approved buyer, so two buyers can compete for one item.
function secondBuyer(data: DemoData): string {
  const id = demoRegister(data, { email: 'second@example.test', fullName: 'Second Buyer', program: 'BS IT', yearLevel: 2 }, NOW)
  demoReviewAccount(data, ADMIN, id, 'approved', NOW)
  return id
}

describe('demo store: seed and accounts', () => {
  it('seeds the fictional accounts and listings', () => {
    const { data } = fresh()
    expect(data.users.map((user) => user.email)).toContain('seller@example.test')
    expect(data.listings).toHaveLength(10)
    expect(data.requests.filter((request) => request.status === 'completed')).toHaveLength(2)
    expect(data.listings.every((listing) => listing.photo_path)).toBe(true)
  })

  it('signs in only known demo emails, and new accounts start pending', () => {
    const { data } = fresh()
    expect(demoSignIn(data, ' Buyer@Example.test ')).toBe(BUYER)
    expect(() => demoSignIn(data, 'nobody@example.test')).toThrow('Invalid login credentials')
    const id = demoRegister(data, { email: 'new@example.test', fullName: 'New Member', program: 'BS IT', yearLevel: 1 }, NOW)
    expect(demoProfile(data, id, id)?.approval_status).toBe('pending')
    expect(() => demoRegister(data, { email: 'new@example.test', fullName: 'X', program: 'BS IT', yearLevel: 1 }, NOW)).toThrow(
      'already registered',
    )
  })

  it('keeps the approval gate: pending members see no listings; only an admin reviews', () => {
    const { data, listing } = fresh()
    expect(demoListing(data, PENDING, listing.id)).toBeNull()
    expect(demoSearchListings(data, PENDING, { keyword: '', categoryId: null, program: null, includeReserved: false, page: 1 }).total).toBe(0)
    expect(() => demoPendingAccounts(data, SELLER)).toThrow('Only an approved admin')
    expect(() => demoReviewAccount(data, ADMIN, ADMIN, 'approved', NOW)).toThrow('their own account')
    demoReviewAccount(data, ADMIN, PENDING, 'approved', NOW)
    expect(() => demoReviewAccount(data, ADMIN, PENDING, 'rejected', NOW)).toThrow('already been reviewed')
    expect(demoListing(data, PENDING, listing.id)?.id).toBe(listing.id)
  })
})

describe('demo store: listings', () => {
  it('lets only the owner edit, and only while active', () => {
    const { data, listing } = fresh()
    const columns = { ...listing, title: 'Changed title' }
    expect(demoUpdateListing(data, BUYER, listing.id, columns, NOW)).toBeNull()
    expect(demoUpdateListing(data, SELLER, listing.id, columns, NOW)?.title).toBe('Changed title')
    demoWithdrawListing(data, SELLER, listing.id, NOW)
    expect(demoUpdateListing(data, SELLER, listing.id, columns, NOW)).toBeNull()
  })

  it('needs an approved member and a photo to create a listing', () => {
    const { data, listing } = fresh()
    expect(() => demoCreateListing(data, PENDING, { ...listing }, NOW)).toThrow()
    expect(() => demoCreateListing(data, SELLER, { ...listing, photo_path: null }, NOW)).toThrow('photo')
    expect(demoCreateListing(data, SELLER, { ...listing }, NOW).status).toBe('active')
  })

  it('withdraw cancels pending requests and cannot be undone', () => {
    const { data, listing } = fresh()
    const request = demoSendRequest(data, BUYER, listing.id, '', PLACE, TOMORROW_10AM, NOW)
    expect(() => demoWithdrawListing(data, BUYER, listing.id, NOW)).toThrow('not yours')
    demoWithdrawListing(data, SELLER, listing.id, NOW)
    const after = demoMyRequests(data, BUYER).requests.find((row) => row.id === request.id)!
    expect(after.status).toBe('cancelled')
    expect(after.closed_reason).toBe('The seller withdrew the listing.')
    expect(() => demoWithdrawListing(data, SELLER, listing.id, NOW)).toThrow('Only an available listing')
  })
})

describe('demo store: requests', () => {
  it('allows one request per buyer per listing, and none on your own item', () => {
    const { data, listing } = fresh()
    const request = demoSendRequest(data, BUYER, listing.id, 'Is it still there?', PLACE, TOMORROW_10AM, NOW)
    expect(request.price_seen).toBe(listing.price)
    expect(() => demoSendRequest(data, SELLER, listing.id, '', PLACE, TOMORROW_10AM, NOW)).toThrow('your own item')
    demoCancelRequest(data, BUYER, request.id, '', NOW)
    expect(() => demoSendRequest(data, BUYER, listing.id, '', PLACE, TOMORROW_10AM, NOW)).toThrow('one request per item')
  })

  it('checks the meetup place and time like the database', () => {
    const { data, listing } = fresh()
    const send = (place: string, when: string) => () => demoSendRequest(data, BUYER, listing.id, '', place, when, NOW)
    expect(send('My dorm', TOMORROW_10AM)).toThrow('listed meetup places')
    expect(send(PLACE, '2026-11-23T08:00:00+08:00')).toThrow('in the future')
    expect(send(PLACE, '2027-01-10T10:00:00+08:00')).toThrow('next 30 days')
    expect(send(PLACE, '2026-11-24T06:59:00+08:00')).toThrow('between 7:00 AM and 8:00 PM')
    expect(send(PLACE, '2026-11-24T20:01:00+08:00')).toThrow('between 7:00 AM and 8:00 PM')
    expect(send(PLACE, '2026-11-24T20:00:00+08:00')()).toMatchObject({ status: 'pending' })
  })

  it('accept reserves the item and declines the other pending requests', () => {
    const { data, listing } = fresh()
    const other = secondBuyer(data)
    const first = demoSendRequest(data, BUYER, listing.id, '', PLACE, TOMORROW_10AM, NOW)
    const second = demoSendRequest(data, other, listing.id, '', PLACE, TOMORROW_10AM, NOW)
    expect(() => demoAcceptRequest(data, BUYER, first.id, NOW)).toThrow('not for your listing')
    expect(demoAcceptRequest(data, SELLER, first.id, NOW).status).toBe('accepted')
    expect(demoListing(data, SELLER, listing.id)?.status).toBe('reserved')
    const declined = data.requests.find((row) => row.id === second.id)!
    expect(declined.status).toBe('declined')
    expect(declined.closed_reason).toContain('the seller accepted another request')
    expect(() => demoAcceptRequest(data, SELLER, second.id, NOW)).toThrow('no longer pending. It is now declined.')
  })

  it('refuses to accept a pending request whose meetup time has passed', () => {
    const { data, listing } = fresh()
    const request = demoSendRequest(data, BUYER, listing.id, '', PLACE, '2026-11-23T09:30:00+08:00', NOW)
    expect(() => demoAcceptRequest(data, SELLER, request.id, LATER)).toThrow('already passed')
    expect(demoDeclineRequest(data, SELLER, request.id, '', LATER).closed_reason).toBeNull()
  })

  it('cancelling an accepted request needs a reason and reopens the item', () => {
    const { data, listing } = fresh()
    const request = demoSendRequest(data, BUYER, listing.id, '', PLACE, TOMORROW_10AM, NOW)
    demoAcceptRequest(data, SELLER, request.id, NOW)
    expect(() => demoCancelRequest(data, BUYER, request.id, '', NOW)).toThrow('at least 3 characters')
    expect(demoCancelRequest(data, SELLER, request.id, 'Item broke', NOW).closed_reason).toBe('Item broke')
    expect(demoListing(data, SELLER, listing.id)?.status).toBe('active')
  })

  it('a pending cancel needs no reason, but a typed one must be valid; the seller declines instead', () => {
    const { data, listing } = fresh()
    const request = demoSendRequest(data, BUYER, listing.id, '', PLACE, TOMORROW_10AM, NOW)
    expect(() => demoCancelRequest(data, SELLER, request.id, 'No thanks', NOW)).toThrow('only an accepted request')
    expect(() => demoCancelRequest(data, BUYER, request.id, 'no', NOW)).toThrow('or leave it empty')
    expect(demoCancelRequest(data, BUYER, request.id, '', NOW).status).toBe('cancelled')
  })

  it('complete marks the item sold, only from an accepted request', () => {
    const { data, listing } = fresh()
    const request = demoSendRequest(data, BUYER, listing.id, '', PLACE, TOMORROW_10AM, NOW)
    expect(() => demoCompleteRequest(data, SELLER, request.id, NOW)).toThrow('Only an accepted request')
    demoAcceptRequest(data, SELLER, request.id, NOW)
    expect(() => demoCompleteRequest(data, BUYER, request.id, NOW)).toThrow('not for your listing')
    expect(demoCompleteRequest(data, SELLER, request.id, NOW).status).toBe('completed')
    expect(demoListing(data, SELLER, listing.id)?.status).toBe('sold')
    expect(demoListing(data, BUYER, listing.id)?.status).toBe('sold')
  })

  it('a reserved item stays out of Browse unless asked, and others cannot request it', () => {
    const { data, listing } = fresh()
    const other = secondBuyer(data)
    const request = demoSendRequest(data, BUYER, listing.id, '', PLACE, TOMORROW_10AM, NOW)
    demoAcceptRequest(data, SELLER, request.id, NOW)
    const filters = { keyword: '', categoryId: null, program: null, includeReserved: false, page: 1 }
    expect(demoSearchListings(data, other, filters).listings.some((row) => row.id === listing.id)).toBe(false)
    expect(demoSearchListings(data, other, { ...filters, includeReserved: true }).listings.some((row) => row.id === listing.id)).toBe(true)
    expect(() => demoSendRequest(data, other, listing.id, '', PLACE, TOMORROW_10AM, NOW)).toThrow('no longer available')
  })
})
