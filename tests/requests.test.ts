// Checks 4 to 10 and the meetup-date part of check 11 from the handoff:
//   4. A buyer cannot request their own item or send a second request.
//   5. Only the listing owner can accept or decline.
//   6. Accepting reserves the item and blocks another accept (two parallel
//      accepts from two connections: exactly one wins).
//   7. A failed transition leaves every row unchanged.
//   8. Cancelling an accepted request makes the item available again.
//   9. Completing marks the right request completed and the item sold.
//  10. Unrelated members cannot read or change requests.
//  11. Meetup times in the past, too far ahead or outside the hours are refused.
// Needs a migrated and seeded Supabase project in .env. Every row and user the
// suite creates is removed in afterAll.

import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createTestApplicant,
  deleteTestUser,
  serviceClient,
  signedInClient,
  supabaseConfigured,
  type CampusBidClient,
} from './supabase-clients.ts'
import { manilaLocalToIso } from '../src/lib/request-rules.ts'

type Member = { client: CampusBidClient; userId: string }

const PLACE = 'Library entrance, in the open area'

// A Manila-local meetup time `days` from now at the given hour.
function meetupAt(days: number, hour = 10): string {
  const manilaNow = new Date(Date.now() + 8 * 3600 * 1000 + days * 86400 * 1000)
  const date = manilaNow.toISOString().slice(0, 10)
  return manilaLocalToIso(`${date}T${String(hour).padStart(2, '0')}:00`) as string
}

describe.skipIf(!supabaseConfigured)('purchase requests and meetups', () => {
  let service: CampusBidClient
  let seller: Member
  let buyer: Member
  let buyer2: Member
  let outsider: Member
  const extraUserIds: string[] = []
  const listingIds: number[] = []

  async function approvedMember(): Promise<Member> {
    const created = await createTestApplicant(service)
    extraUserIds.push(created.userId)
    const { error } = await service.from('profiles').update({ approval_status: 'approved' }).eq('id', created.userId)
    if (error) throw new Error(error.message)
    return { client: created.client, userId: created.userId }
  }

  async function newListing(): Promise<number> {
    const { data: category } = await service.from('categories').select('id').limit(1).single()
    const { data, error } = await service
      .from('listings')
      .insert({
        seller_id: seller.userId,
        category_id: category!.id,
        program: 'BS Information Technology',
        title: `Request test item ${randomUUID().slice(0, 8)}`,
        description: 'Temporary row created by the request tests.',
        price: 400,
        condition: 'good',
        known_defects: 'None known',
        photo_path: `${seller.userId}/${randomUUID()}.jpg`,
      })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    listingIds.push(data.id)
    return data.id
  }

  const send = (m: Member, listingId: number, when = meetupAt(3), place = PLACE) =>
    m.client.rpc('send_purchase_request', { target_listing_id: listingId, request_note: 'Test request', place, meetup_time: when })

  const listingStatus = async (id: number) =>
    (await service.from('listings').select('status').eq('id', id).single()).data?.status
  const requestStatus = async (id: number) =>
    (await service.from('purchase_requests').select('status').eq('id', id).single()).data?.status

  beforeAll(async () => {
    service = serviceClient()
    seller = await signedInClient('seller@example.test')
    buyer = await signedInClient('buyer@example.test')
    buyer2 = await approvedMember()
    outsider = await approvedMember()
  })

  afterAll(async () => {
    if (listingIds.length > 0) {
      await service.from('purchase_requests').delete().in('listing_id', listingIds)
      await service.from('listings').delete().in('id', listingIds)
    }
    for (const id of extraUserIds) await deleteTestUser(service, id)
  })

  it('check 4: refuses a request on your own item and a second request on the same item', async () => {
    const id = await newListing()
    const own = await send(seller, id)
    expect(own.error?.message).toMatch(/own/i)
    const first = await send(buyer, id)
    expect(first.error).toBeNull()
    expect(first.data?.price_seen).toBe(400)
    const again = await send(buyer, id)
    expect(again.error?.message).toMatch(/one request per item/i)
    const { count } = await service.from('purchase_requests').select('id', { count: 'exact', head: true }).eq('listing_id', id)
    expect(count).toBe(1)
  })

  it('check 5: only the listing owner can accept or decline', async () => {
    const id = await newListing()
    const req = (await send(buyer, id)).data!
    for (const who of [buyer, buyer2, outsider]) {
      expect((await who.client.rpc('accept_purchase_request', { target_request_id: req.id })).error).not.toBeNull()
      expect((await who.client.rpc('decline_purchase_request', { target_request_id: req.id, decline_reason: null })).error).not.toBeNull()
    }
    expect(await requestStatus(req.id)).toBe('pending')
    expect(await listingStatus(id)).toBe('active')
    expect((await seller.client.rpc('decline_purchase_request', { target_request_id: req.id, decline_reason: 'Sold elsewhere' })).error).toBeNull()
    expect(await requestStatus(req.id)).toBe('declined')
  })

  it('check 6: accepting reserves the item, declines the others and blocks a second accept', async () => {
    const id = await newListing()
    const a = (await send(buyer, id)).data!
    const b = (await send(buyer2, id)).data!
    expect((await seller.client.rpc('accept_purchase_request', { target_request_id: a.id })).error).toBeNull()
    expect(await listingStatus(id)).toBe('reserved')
    expect(await requestStatus(a.id)).toBe('accepted')
    const other = await service.from('purchase_requests').select('status, closed_reason').eq('id', b.id).single()
    expect(other.data?.status).toBe('declined')
    expect(other.data?.closed_reason).toMatch(/no longer available/i)
    const second = await seller.client.rpc('accept_purchase_request', { target_request_id: b.id })
    expect(second.error?.message).toMatch(/no longer pending/i)
  })

  it('check 6: two parallel accepts from two connections give exactly one winner', async () => {
    const id = await newListing()
    const a = (await send(buyer, id)).data!
    const b = (await send(buyer2, id)).data!
    const second = await signedInClient('seller@example.test')
    const results = await Promise.all([
      seller.client.rpc('accept_purchase_request', { target_request_id: a.id }),
      second.client.rpc('accept_purchase_request', { target_request_id: b.id }),
    ])
    expect(results.filter((r) => r.error === null)).toHaveLength(1)
    expect(results.filter((r) => r.error !== null)).toHaveLength(1)
    const { data } = await service.from('purchase_requests').select('status').eq('listing_id', id)
    expect(data?.filter((r) => r.status === 'accepted')).toHaveLength(1)
    expect(await listingStatus(id)).toBe('reserved')
  })

  it('check 7: a failed transition changes nothing', async () => {
    const id = await newListing()
    const req = (await send(buyer, id)).data!
    const before = await service.from('purchase_requests').select('*').eq('id', req.id).single()
    expect((await seller.client.rpc('complete_purchase_request', { target_request_id: req.id })).error).not.toBeNull()
    expect((await buyer.client.rpc('cancel_purchase_request', { target_request_id: req.id, cancel_reason: 'x' })).error).not.toBeNull()
    const after = await service.from('purchase_requests').select('*').eq('id', req.id).single()
    expect(after.data).toEqual(before.data)
    expect(await listingStatus(id)).toBe('active')
  })

  it('check 8: cancelling an accepted request reopens the item; declined requests stay declined', async () => {
    const id = await newListing()
    const a = (await send(buyer, id)).data!
    const b = (await send(buyer2, id)).data!
    await seller.client.rpc('accept_purchase_request', { target_request_id: a.id })
    expect((await buyer.client.rpc('cancel_purchase_request', { target_request_id: a.id, cancel_reason: 'My plans changed' })).error).toBeNull()
    expect(await requestStatus(a.id)).toBe('cancelled')
    expect(await requestStatus(b.id)).toBe('declined')
    expect(await listingStatus(id)).toBe('active')
    const replay = await buyer.client.rpc('cancel_purchase_request', { target_request_id: a.id, cancel_reason: 'Again' })
    expect(replay.error).not.toBeNull()
  })

  it('check 9: completing marks the request completed and the item sold', async () => {
    const id = await newListing()
    const a = (await send(buyer, id)).data!
    await seller.client.rpc('accept_purchase_request', { target_request_id: a.id })
    expect((await buyer.client.rpc('complete_purchase_request', { target_request_id: a.id })).error).not.toBeNull()
    expect((await seller.client.rpc('complete_purchase_request', { target_request_id: a.id })).error).toBeNull()
    expect(await requestStatus(a.id)).toBe('completed')
    expect(await listingStatus(id)).toBe('sold')
    expect((await seller.client.rpc('complete_purchase_request', { target_request_id: a.id })).error).not.toBeNull()
  })

  it('check 10: unrelated members cannot read or change requests', async () => {
    const id = await newListing()
    const req = (await send(buyer, id)).data!
    const read = await outsider.client.from('purchase_requests').select('id').eq('id', req.id)
    expect(read.data).toEqual([])
    const write = await outsider.client.from('purchase_requests').update({ status: 'accepted' }).eq('id', req.id).select()
    expect(write.data ?? []).toEqual([])
    expect((await outsider.client.rpc('cancel_purchase_request', { target_request_id: req.id, cancel_reason: 'Not mine' })).error).not.toBeNull()
    expect(await requestStatus(req.id)).toBe('pending')
    const sellerView = await seller.client.from('purchase_requests').select('id').eq('id', req.id)
    expect(sellerView.data).toHaveLength(1)
  })

  it('review fixes: a pending cancel needs no reason, and an expired pending request cannot be accepted', async () => {
    const id = await newListing()
    const req = (await send(buyer, id)).data!
    await service.from('purchase_requests').update({ meetup_at: new Date(Date.now() - 3600 * 1000).toISOString() }).eq('id', req.id)
    const accept = await seller.client.rpc('accept_purchase_request', { target_request_id: req.id })
    expect(accept.error?.message).toMatch(/has already passed/i)
    expect(await requestStatus(req.id)).toBe('pending')
    expect(await listingStatus(id)).toBe('active')
    const cancel = await buyer.client.rpc('cancel_purchase_request', { target_request_id: req.id, cancel_reason: '' })
    expect(cancel.error).toBeNull()
    expect(await requestStatus(req.id)).toBe('cancelled')
  })

  it('check 11: refuses meetup times in the past, beyond 30 days, or outside 07:00 to 20:00 Manila', async () => {
    const id = await newListing()
    const cases = [meetupAt(-1), meetupAt(45), meetupAt(3, 5), meetupAt(3, 22)]
    for (const when of cases) {
      const result = await send(buyer, id, when)
      expect(result.error, when).not.toBeNull()
    }
    const badPlace = await send(buyer, id, meetupAt(3), 'Somewhere not on the list')
    expect(badPlace.error).not.toBeNull()
    const { count } = await service.from('purchase_requests').select('id', { count: 'exact', head: true }).eq('listing_id', id)
    expect(count).toBe(0)
    expect((await send(buyer, id, meetupAt(3, 9))).error).toBeNull()
  })
})
