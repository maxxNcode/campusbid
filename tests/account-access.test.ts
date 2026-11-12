// Checks 1 and 2 from the handoff:
//   1. Pending users are blocked from trading; approved users can proceed.
//   2. Non-admins cannot approve accounts, including through a direct request.
// Needs a migrated and seeded Supabase project in .env. Every row created here
// is removed in afterAll.

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

describe.skipIf(!supabaseConfigured)('account approval and access', () => {
  let service: CampusBidClient
  const createdUserIds: string[] = []
  let createdListingId: number | null = null

  let buyer: CampusBidClient
  let seller: { client: CampusBidClient; userId: string }
  let adminUser: { client: CampusBidClient; userId: string }
  let applicant: { client: CampusBidClient; userId: string }

  beforeAll(async () => {
    service = serviceClient()
    buyer = (await signedInClient('buyer@example.test')).client
    seller = await signedInClient('seller@example.test')
    adminUser = await signedInClient('admin@example.test')
    applicant = await createTestApplicant(service)
    createdUserIds.push(applicant.userId)

    // A listing owned by the seeded seller, created directly because listing
    // creation is not part of this phase.
    const { data: category, error: categoryError } = await service
      .from('categories')
      .select('id')
      .limit(1)
      .single()
    if (categoryError) throw new Error(`No category found: ${categoryError.message}. Run npm run seed.`)

    const { data: listing, error: listingError } = await service
      .from('listings')
      .insert({
        seller_id: seller.userId,
        category_id: category.id,
        program: 'BS Information Technology',
        title: 'Test listing for access checks',
        description: 'Temporary row created by the account access tests.',
        price: 100,
        condition: 'good',
        known_defects: 'None known',
      })
      .select('id')
      .single()
    if (listingError) throw new Error(`Could not create test listing: ${listingError.message}`)
    createdListingId = listing.id
  })

  afterAll(async () => {
    if (createdListingId !== null) {
      await service.from('listings').delete().eq('id', createdListingId)
    }
    for (const userId of createdUserIds) {
      await deleteTestUser(service, userId)
    }
  })

  async function readProfile(userId: string) {
    const { data, error } = await service.from('profiles').select('*').eq('id', userId).single()
    if (error) throw error
    return data
  }

  describe('check 1: pending users are blocked, approved users can proceed', () => {
    it('starts every new registration as pending and non-admin, whatever the form sends', async () => {
      const email = `test-signup-${crypto.randomUUID()}@example.test`
      const { data, error } = await anonClient().auth.signUp({
        email,
        password: crypto.randomUUID(),
        options: {
          data: {
            full_name: 'Test Sign Up',
            program: 'BS Information Technology',
            year_level: 1,
            is_admin: true,
            approval_status: 'approved',
          },
        },
      })
      expect(error).toBeNull()
      expect(data.user).not.toBeNull()
      createdUserIds.push(data.user!.id)

      const profile = await readProfile(data.user!.id)
      expect(profile.approval_status).toBe('pending')
      expect(profile.is_admin).toBe(false)
      expect(profile.reviewed_by).toBeNull()
    })

    it('hides listings from a pending applicant', async () => {
      const { data, error } = await applicant.client.from('listings').select('id')
      expect(error).toBeNull()
      expect(data).toEqual([])
    })

    it('shows the listing to an approved buyer', async () => {
      const { data, error } = await buyer.from('listings').select('id').eq('id', createdListingId!)
      expect(error).toBeNull()
      expect(data).toEqual([{ id: createdListingId }])
    })

    it('reports approval status correctly to the database helpers', async () => {
      const pendingResult = await applicant.client.rpc('current_user_is_approved')
      const approvedResult = await buyer.rpc('current_user_is_approved')
      expect(pendingResult.data).toBe(false)
      expect(approvedResult.data).toBe(true)
    })

    it('lets a pending applicant see only their own profile', async () => {
      const { data, error } = await applicant.client.from('profiles').select('id')
      expect(error).toBeNull()
      expect(data).toEqual([{ id: applicant.userId }])
    })

    it('stops a pending applicant from creating a listing', async () => {
      const { data, error } = await applicant.client
        .from('listings')
        .insert({
          category_id: 1,
          program: 'BS Civil Engineering',
          title: 'Should not be saved',
          description: 'A pending applicant must not be able to list items.',
          price: 50,
          condition: 'good',
          known_defects: 'None known',
        })
        .select('id')
      expect(error).not.toBeNull()
      expect(data).toBeNull()
    })

    it('gives anonymous visitors no profile or listing data', async () => {
      const visitor = anonClient()
      const profiles = await visitor.from('profiles').select('id')
      const listings = await visitor.from('listings').select('id')
      expect(profiles.data ?? []).toEqual([])
      expect(listings.data ?? []).toEqual([])
    })
  })

  describe('check 2: only admins can approve accounts', () => {
    it('rejects a direct update of approval_status by the applicant', async () => {
      const { error } = await applicant.client
        .from('profiles')
        .update({ approval_status: 'approved' })
        .eq('id', applicant.userId)
      expect(error).not.toBeNull()
      expect((await readProfile(applicant.userId)).approval_status).toBe('pending')
    })

    it('rejects a direct update of is_admin by the applicant', async () => {
      const { error } = await applicant.client
        .from('profiles')
        .update({ is_admin: true })
        .eq('id', applicant.userId)
      expect(error).not.toBeNull()
      expect((await readProfile(applicant.userId)).is_admin).toBe(false)
    })

    it('still lets the applicant correct their own name', async () => {
      const { error } = await applicant.client
        .from('profiles')
        .update({ full_name: 'Test Applicant Renamed' })
        .eq('id', applicant.userId)
      expect(error).toBeNull()
      expect((await readProfile(applicant.userId)).full_name).toBe('Test Applicant Renamed')
    })

    it('does not let an approved member change another member profile', async () => {
      const before = await readProfile(seller.userId)
      await buyer.from('profiles').update({ full_name: 'Changed by buyer' }).eq('id', seller.userId)
      expect((await readProfile(seller.userId)).full_name).toBe(before.full_name)
    })

    it('rejects review_account from the applicant on their own account', async () => {
      const { error } = await applicant.client.rpc('review_account', {
        target_profile_id: applicant.userId,
        decision: 'approved',
      })
      expect(error?.message).toMatch(/Only an approved admin/)
      expect((await readProfile(applicant.userId)).approval_status).toBe('pending')
    })

    it('rejects review_account from an approved non-admin', async () => {
      const { error } = await buyer.rpc('review_account', {
        target_profile_id: applicant.userId,
        decision: 'approved',
      })
      expect(error?.message).toMatch(/Only an approved admin/)
      expect((await readProfile(applicant.userId)).approval_status).toBe('pending')
    })

    it('rejects review_account from an anonymous visitor', async () => {
      const { error } = await anonClient().rpc('review_account', {
        target_profile_id: applicant.userId,
        decision: 'approved',
      })
      expect(error).not.toBeNull()
      expect((await readProfile(applicant.userId)).approval_status).toBe('pending')
    })

    it('hides the pending account list from non-admins', async () => {
      const { error } = await buyer.rpc('pending_accounts')
      expect(error).not.toBeNull()
    })

    it('lets the admin approve and records the reviewer and time', async () => {
      const pending = await adminUser.client.rpc('pending_accounts')
      expect(pending.error).toBeNull()
      expect(pending.data?.some((account) => account.id === applicant.userId)).toBe(true)

      const { error } = await adminUser.client.rpc('review_account', {
        target_profile_id: applicant.userId,
        decision: 'approved',
      })
      expect(error).toBeNull()

      const profile = await readProfile(applicant.userId)
      expect(profile.approval_status).toBe('approved')
      expect(profile.reviewed_by).toBe(adminUser.userId)
      expect(profile.reviewed_at).not.toBeNull()
    })

    it('refuses a second review of the same account', async () => {
      const { error } = await adminUser.client.rpc('review_account', {
        target_profile_id: applicant.userId,
        decision: 'rejected',
      })
      expect(error?.message).toMatch(/already been reviewed/)
      expect((await readProfile(applicant.userId)).approval_status).toBe('approved')
    })
  })
})
