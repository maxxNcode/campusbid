// Checks 3, 11 and 12 from the handoff:
//   3. A seller cannot edit another seller's listing.
//  11. Invalid uploads and negative prices are rejected (invalid meetup dates
//      belong to the purchase requests in Phase 3).
//  12. Search and combined filters return the intended available listings.
// The Supabase suites need a migrated and seeded project in .env and remove
// every row and file they create in afterAll. The form-check suite at the end
// runs without a project.

import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  anonClient,
  createTestApplicant,
  deleteTestUser,
  serviceClient,
  signedInClient,
  supabaseConfigured,
  type CampusBidClient,
} from './supabase-clients.ts'
import { searchListings, keywordWords, type ListingFilters } from '../src/lib/listing-search.ts'
import { MAX_PHOTO_BYTES, generatedPhotoPath, photoProblem, priceProblem } from '../src/lib/listing-rules.ts'

const BUCKET = 'listing-photos'
// Smallest valid PNG (1x1 pixel).
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

type Member = { client: CampusBidClient; userId: string }

describe.skipIf(!supabaseConfigured)('listings, photos and search', () => {
  let service: CampusBidClient
  let buyer: Member
  let seller: Member
  let applicant: Member
  let calculatorsId: number
  let draftingId: number
  const createdListingIds: number[] = []
  const createdPhotoPaths: string[] = []

  const baseListing = {
    program: 'BS Information Technology',
    description: 'Temporary row created by the listing tests.',
    condition: 'good' as const,
    known_defects: 'None known',
  }

  beforeAll(async () => {
    service = serviceClient()
    buyer = await signedInClient('buyer@example.test')
    seller = await signedInClient('seller@example.test')
    applicant = await createTestApplicant(service)

    const { data: categories, error } = await service.from('categories').select('id, slug')
    if (error) throw new Error(`No categories: ${error.message}. Run npm run seed.`)
    calculatorsId = categories.find((category) => category.slug === 'calculators')?.id ?? 0
    draftingId = categories.find((category) => category.slug === 'drafting-tools')?.id ?? 0
    if (!calculatorsId || !draftingId) throw new Error('Seeded categories missing. Run npm run seed.')
  })

  afterAll(async () => {
    if (createdListingIds.length > 0) {
      await service.from('purchase_requests').delete().in('listing_id', createdListingIds)
      await service.from('listings').delete().in('id', createdListingIds)
    }
    if (createdPhotoPaths.length > 0) {
      await service.storage.from(BUCKET).remove(createdPhotoPaths)
    }
    if (applicant) await deleteTestUser(service, applicant.userId)
  })

  // Check 3
  describe('listing ownership', () => {
    let listingId: number

    beforeAll(async () => {
      const { data, error } = await seller.client
        .from('listings')
        .insert({ ...baseListing, category_id: calculatorsId, title: 'Test listing for ownership', price: 500 })
        .select()
        .single()
      if (error) throw new Error(`Seller could not create a listing: ${error.message}`)
      createdListingIds.push(data.id)
      listingId = data.id
      expect(data.seller_id).toBe(seller.userId)
      expect(data.status).toBe('active')
    })

    async function currentRow() {
      const { data } = await service.from('listings').select('*').eq('id', listingId).single()
      return data
    }

    it('does not let another member edit the listing', async () => {
      const { data } = await buyer.client.from('listings').update({ price: 1 }).eq('id', listingId).select()
      expect(data ?? []).toEqual([])
      expect(Number((await currentRow())?.price)).toBe(500)
    })

    it('does not let a member create a listing in another seller\'s name', async () => {
      const { error } = await buyer.client
        .from('listings')
        .insert({ ...baseListing, seller_id: seller.userId, category_id: calculatorsId, title: 'Posing as seller', price: 10 })
      expect(error).not.toBeNull()
    })

    it('does not let the seller set the status or hand the listing over directly', async () => {
      const statusChange = await seller.client.from('listings').update({ status: 'sold' }).eq('id', listingId)
      expect(statusChange.error).not.toBeNull()
      const ownerChange = await seller.client.from('listings').update({ seller_id: buyer.userId }).eq('id', listingId)
      expect(ownerChange.error).not.toBeNull()
      const row = await currentRow()
      expect(row?.status).toBe('active')
      expect(row?.seller_id).toBe(seller.userId)
    })

    it('lets the seller edit their own available listing', async () => {
      const { data, error } = await seller.client.from('listings').update({ price: 450.5 }).eq('id', listingId).select()
      expect(error).toBeNull()
      expect(data).toHaveLength(1)
      expect(Number((await currentRow())?.price)).toBe(450.5)
    })

    it('does not let another member withdraw the listing', async () => {
      const { error } = await buyer.client.rpc('withdraw_listing', { target_listing_id: listingId })
      expect(error).not.toBeNull()
      expect((await currentRow())?.status).toBe('active')
    })

    it('withdraws for the seller, cancels pending requests and keeps them', async () => {
      const { error: requestError } = await service.from('purchase_requests').insert({
        listing_id: listingId,
        buyer_id: buyer.userId,
        meetup_place: 'Main library lobby',
        meetup_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      })
      expect(requestError).toBeNull()

      const { data, error } = await seller.client.rpc('withdraw_listing', { target_listing_id: listingId })
      expect(error).toBeNull()
      expect(data?.status).toBe('withdrawn')

      const { data: requests } = await service.from('purchase_requests').select('*').eq('listing_id', listingId)
      expect(requests).toHaveLength(1)
      expect(requests?.[0].status).toBe('cancelled')
      expect(requests?.[0].closed_reason).toBeTruthy()
    })

    it('refuses a second withdrawal and any edit of the withdrawn listing', async () => {
      const again = await seller.client.rpc('withdraw_listing', { target_listing_id: listingId })
      expect(again.error).not.toBeNull()
      const { data } = await seller.client.from('listings').update({ price: 1 }).eq('id', listingId).select()
      expect(data ?? []).toEqual([])
    })
  })

  // Check 11
  describe('price and upload validation', () => {
    it('rejects a negative or zero price', async () => {
      for (const price of [-5, 0]) {
        const { error } = await seller.client
          .from('listings')
          .insert({ ...baseListing, category_id: calculatorsId, title: 'Bad price listing', price })
        expect(error, `price ${price}`).not.toBeNull()
      }
    })

    it('rejects a listing without a known-defects disclosure', async () => {
      const { error } = await seller.client
        .from('listings')
        .insert({ ...baseListing, known_defects: ' ', category_id: calculatorsId, title: 'No disclosure', price: 50 })
      expect(error).not.toBeNull()
    })

    it('accepts a small PNG under a generated name in the seller\'s folder', async () => {
      const path = generatedPhotoPath(seller.userId, 'image/png')
      const { error } = await seller.client.storage.from(BUCKET).upload(path, TINY_PNG, { contentType: 'image/png' })
      expect(error).toBeNull()
      createdPhotoPaths.push(path)

      const forBuyer = await buyer.client.storage.from(BUCKET).createSignedUrl(path, 60)
      expect(forBuyer.error).toBeNull()
      const forApplicant = await applicant.client.storage.from(BUCKET).createSignedUrl(path, 60)
      expect(forApplicant.error).not.toBeNull()
      const forVisitor = await anonClient().storage.from(BUCKET).createSignedUrl(path, 60)
      expect(forVisitor.error).not.toBeNull()
    })

    it('rejects a file that is not an allowed image type', async () => {
      const path = `${seller.userId}/${randomUUID()}.png`
      const { error } = await seller.client.storage
        .from(BUCKET)
        .upload(path, Buffer.from('#!/bin/sh\necho hi\n'), { contentType: 'application/x-sh' })
      if (!error) createdPhotoPaths.push(path)
      expect(error).not.toBeNull()
    })

    it('rejects a file over the size limit', async () => {
      const path = generatedPhotoPath(seller.userId, 'image/png')
      const { error } = await seller.client.storage
        .from(BUCKET)
        .upload(path, Buffer.alloc(MAX_PHOTO_BYTES + 1024), { contentType: 'image/png' })
      if (!error) createdPhotoPaths.push(path)
      expect(error).not.toBeNull()
    })

    it('rejects uploads into another member\'s folder or under a chosen name', async () => {
      const intoOtherFolder = generatedPhotoPath(seller.userId, 'image/png')
      const other = await buyer.client.storage.from(BUCKET).upload(intoOtherFolder, TINY_PNG, { contentType: 'image/png' })
      if (!other.error) createdPhotoPaths.push(intoOtherFolder)
      expect(other.error).not.toBeNull()

      const chosenName = `${seller.userId}/my-calculator.png`
      const named = await seller.client.storage.from(BUCKET).upload(chosenName, TINY_PNG, { contentType: 'image/png' })
      if (!named.error) createdPhotoPaths.push(chosenName)
      expect(named.error).not.toBeNull()
    })

    it('rejects uploads from a pending applicant', async () => {
      const path = generatedPhotoPath(applicant.userId, 'image/png')
      const { error } = await applicant.client.storage.from(BUCKET).upload(path, TINY_PNG, { contentType: 'image/png' })
      if (!error) createdPhotoPaths.push(path)
      expect(error).not.toBeNull()
    })

    it('rejects a listing that points at another member\'s photo', async () => {
      const { error } = await buyer.client.from('listings').insert({
        ...baseListing,
        category_id: calculatorsId,
        title: 'Borrowed photo',
        price: 10,
        photo_path: `${seller.userId}/${randomUUID()}.png`,
      })
      expect(error).not.toBeNull()
    })
  })

  // Check 12
  describe('search and filters', () => {
    // A random word that appears only in this run's listings.
    const token = `zq${randomUUID().replace(/-/g, '').slice(0, 10)}`
    const titles: Record<string, number> = {}

    async function addListing(
      key: string,
      fields: { title: string; category_id: number; program: string },
      status: 'active' | 'reserved' | 'sold' | 'withdrawn' = 'active',
    ) {
      const { data, error } = await service
        .from('listings')
        .insert({ ...baseListing, ...fields, seller_id: seller.userId, price: 100 })
        .select('id')
        .single()
      if (error) throw new Error(`Could not create ${key}: ${error.message}`)
      createdListingIds.push(data.id)
      titles[key] = data.id
      if (status !== 'active') {
        const update = await service.from('listings').update({ status }).eq('id', data.id)
        if (update.error) throw new Error(update.error.message)
      }
    }

    const filters = (overrides: Partial<ListingFilters>): ListingFilters => ({
      keyword: token,
      categoryId: null,
      program: null,
      includeReserved: false,
      page: 1,
      ...overrides,
    })
    const ids = (listings: { id: number }[]) => listings.map((listing) => listing.id)

    beforeAll(async () => {
      // Inserted one after another, so later ones are newer.
      await addListing('calcCivil', { title: `${token} scientific calculator`, category_id: calculatorsId, program: 'BS Civil Engineering' })
      await addListing('calcIt', { title: `${token} graphing calculator`, category_id: calculatorsId, program: 'BS Information Technology' })
      await addListing('compassCivil', { title: `${token} drafting compass`, category_id: draftingId, program: 'BS Civil Engineering' })
      await addListing('calcCivilSold', { title: `${token} sold calculator`, category_id: calculatorsId, program: 'BS Civil Engineering' }, 'sold')
      await addListing('calcCivilWithdrawn', { title: `${token} withdrawn calculator`, category_id: calculatorsId, program: 'BS Civil Engineering' }, 'withdrawn')
      await addListing('calcCivilReserved', { title: `${token} reserved calculator`, category_id: calculatorsId, program: 'BS Civil Engineering' }, 'reserved')
    })

    it('returns available matches newest first, without sold, withdrawn or reserved ones', async () => {
      const result = await searchListings(buyer.client, filters({}))
      expect(ids(result.listings)).toEqual([titles.compassCivil, titles.calcIt, titles.calcCivil])
      expect(result.total).toBe(3)
    })

    it('combines keyword, category and program filters', async () => {
      const result = await searchListings(
        buyer.client,
        filters({ categoryId: calculatorsId, program: 'BS Civil Engineering' }),
      )
      expect(ids(result.listings)).toEqual([titles.calcCivil])
    })

    it('adds reserved listings only when asked', async () => {
      const result = await searchListings(
        buyer.client,
        filters({ categoryId: calculatorsId, program: 'BS Civil Engineering', includeReserved: true }),
      )
      expect(ids(result.listings)).toEqual([titles.calcCivilReserved, titles.calcCivil])
    })

    it('requires every keyword word to match', async () => {
      const result = await searchListings(buyer.client, filters({ keyword: `${token} compass` }))
      expect(ids(result.listings)).toEqual([titles.compassCivil])
    })

    it('treats punctuation in the keyword as plain text', async () => {
      const result = await searchListings(buyer.client, filters({ keyword: `${token}, (compass)*` }))
      expect(ids(result.listings)).toEqual([titles.compassCivil])
    })

    it('returns an empty page past the last one', async () => {
      const result = await searchListings(buyer.client, filters({ page: 5 }))
      expect(result.listings).toEqual([])
      expect(result.pastEnd).toBe(true)
    })

    it('shows nothing to a pending applicant', async () => {
      const result = await searchListings(applicant.client, filters({}))
      expect(result.total).toBe(0)
    })
  })
})

// Form-side checks that run without a Supabase project. The bucket and the
// database enforce the same rules again on the server.
describe('listing form checks', () => {
  it('accepts JPEG, PNG and WebP photos up to 5 MB only', () => {
    expect(photoProblem({ type: 'image/jpeg', size: 1000 })).toBeNull()
    expect(photoProblem({ type: 'image/webp', size: MAX_PHOTO_BYTES })).toBeNull()
    expect(photoProblem({ type: 'image/gif', size: 1000 })).not.toBeNull()
    expect(photoProblem({ type: 'application/x-msdownload', size: 1000 })).not.toBeNull()
    expect(photoProblem({ type: 'image/png', size: MAX_PHOTO_BYTES + 1 })).not.toBeNull()
  })

  it('generates photo names instead of using the uploaded file name', () => {
    const path = generatedPhotoPath('3f1c2a4e-0000-4000-8000-000000000001', 'image/webp')
    expect(path).toMatch(/^3f1c2a4e-0000-4000-8000-000000000001\/[0-9a-f-]{36}\.webp$/)
  })

  it('rejects negative, zero, malformed and over-precise prices', () => {
    for (const bad of ['-5', '0', '0.00', 'abc', '1e3', '12.345', '123456789']) {
      expect(priceProblem(bad), bad).not.toBeNull()
    }
    for (const good of ['1', '450', '450.5', '450.50', '99999999.99']) {
      expect(priceProblem(good), good).toBeNull()
    }
  })

  it('keeps only letters, digits and hyphens in search words', () => {
    expect(keywordWords('  fx-991ES, (calculator)* ')).toEqual(['fx-991ES', 'calculator'])
    expect(keywordWords('%,.()')).toEqual([])
  })
})
