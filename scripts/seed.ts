// Seeds categories, the fictional example.test demo accounts and their demo
// listings with placeholder photos.
// Run with: npm run seed   (reads .env; development project only)
// Requires CAMPUSBID_ENVIRONMENT=development in .env, so demo accounts with a
// shared password are never created on a production project by accident.
//
// Safe to run more than once: existing demo accounts get their password,
// details and approval state reset to the values below, so the pending
// applicant is pending again after each run. The demo accounts' listings,
// requests and photos are deleted and created again; nothing else is touched.

import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { CATEGORIES, DEMO_ACCOUNTS, DEMO_EMAIL_DOMAIN, type DemoAccount } from './demo-accounts.ts'
import { DEMO_LISTINGS } from './demo-listings.ts'

const PHOTO_BUCKET = 'listing-photos'
const photoDir = new URL('./seed-photos/', import.meta.url)

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const demoPassword = process.env.DEMO_ACCOUNT_PASSWORD

if (!supabaseUrl || !serviceRoleKey || !demoPassword) {
  console.error('Set VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DEMO_ACCOUNT_PASSWORD in .env first.')
  process.exit(1)
}
if (process.env.CAMPUSBID_ENVIRONMENT !== 'development') {
  console.error(
    'Refusing to create demo accounts: set CAMPUSBID_ENVIRONMENT=development in .env ' +
      'only for a development Supabase project.',
  )
  process.exit(1)
}
if (demoPassword.length < 8) {
  console.error('DEMO_ACCOUNT_PASSWORD must be at least 8 characters.')
  process.exit(1)
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function seedCategories() {
  const { error } = await admin.from('categories').upsert(CATEGORIES, { onConflict: 'slug' })
  if (error) throw new Error(`Categories: ${error.message}`)
  console.log(`Categories ready (${CATEGORIES.length}).`)
}

async function findDemoUserIds(client: SupabaseClient): Promise<Map<string, string>> {
  const idsByEmail = new Map<string, string>()
  for (let page = 1; ; page++) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`Listing users: ${error.message}`)
    for (const user of data.users) {
      if (user.email?.endsWith(`@${DEMO_EMAIL_DOMAIN}`)) idsByEmail.set(user.email, user.id)
    }
    if (data.users.length < 1000) break
  }
  return idsByEmail
}

async function upsertDemoUser(account: DemoAccount, existingId: string | undefined): Promise<string> {
  const metadata = {
    full_name: account.fullName,
    program: account.program,
    year_level: account.yearLevel,
  }

  if (existingId) {
    const { error } = await admin.auth.admin.updateUserById(existingId, {
      password: demoPassword,
      user_metadata: metadata,
    })
    if (error) throw new Error(`${account.email}: ${error.message}`)
    return existingId
  }

  // email_confirm marks the address as confirmed, since example.test cannot receive mail.
  const { data, error } = await admin.auth.admin.createUser({
    email: account.email,
    password: demoPassword,
    email_confirm: true,
    user_metadata: metadata,
  })
  if (error) throw new Error(`${account.email}: ${error.message}`)
  return data.user.id
}

async function setProfile(account: DemoAccount, profileId: string, reviewerId: string | null) {
  const approved = account.approvalStatus === 'approved'
  const { error } = await admin
    .from('profiles')
    .update({
      full_name: account.fullName,
      program: account.program,
      year_level: account.yearLevel,
      is_admin: account.isAdmin,
      approval_status: account.approvalStatus,
      reviewed_by: approved ? reviewerId : null,
      reviewed_at: approved ? new Date().toISOString() : null,
    })
    .eq('id', profileId)
  if (error) throw new Error(`Profile for ${account.email}: ${error.message}`)
}

async function seedAccounts(): Promise<Map<DemoAccount['key'], string>> {
  const ids = new Map<DemoAccount['key'], string>()
  const existingIds = await findDemoUserIds(admin)

  // The admin goes first so it can be recorded as the reviewer of the others.
  const adminAccount = DEMO_ACCOUNTS.find((account) => account.isAdmin)
  if (!adminAccount) throw new Error('No demo admin defined.')
  const adminId = await upsertDemoUser(adminAccount, existingIds.get(adminAccount.email))
  await setProfile(adminAccount, adminId, null)
  ids.set(adminAccount.key, adminId)
  console.log(`Account ready: ${adminAccount.email} (admin)`)

  for (const account of DEMO_ACCOUNTS) {
    if (account === adminAccount) continue
    const profileId = await upsertDemoUser(account, existingIds.get(account.email))
    await setProfile(account, profileId, adminId)
    ids.set(account.key, profileId)
    console.log(`Account ready: ${account.email} (${account.approvalStatus})`)
  }
  return ids
}

async function removeDemoListings(demoIds: string[]) {
  const { data: listings, error } = await admin.from('listings').select('id').in('seller_id', demoIds)
  if (error) throw new Error(`Finding demo listings: ${error.message}`)
  const listingIds = listings.map((listing) => listing.id)
  if (listingIds.length > 0) {
    const requests = await admin.from('purchase_requests').delete().in('listing_id', listingIds)
    if (requests.error) throw new Error(`Removing demo requests: ${requests.error.message}`)
    const removed = await admin.from('listings').delete().in('id', listingIds)
    if (removed.error) throw new Error(`Removing demo listings: ${removed.error.message}`)
  }
  for (const id of demoIds) {
    const { data: files, error: listError } = await admin.storage.from(PHOTO_BUCKET).list(id, { limit: 1000 })
    if (listError) throw new Error(`Listing demo photos: ${listError.message}`)
    if (files.length > 0) {
      const { error: removeError } = await admin.storage.from(PHOTO_BUCKET).remove(files.map((file) => `${id}/${file.name}`))
      if (removeError) throw new Error(`Removing demo photos: ${removeError.message}`)
    }
  }
}

async function seedListings(ids: Map<DemoAccount['key'], string>) {
  await removeDemoListings([...ids.values()])

  const { data: categories, error } = await admin.from('categories').select('id, slug')
  if (error) throw new Error(`Categories: ${error.message}`)
  const categoryIds = new Map(categories.map((category) => [category.slug, category.id]))
  const buyerId = ids.get('buyer')
  if (!buyerId) throw new Error('No demo buyer defined.')

  for (const item of DEMO_LISTINGS) {
    const sellerId = ids.get(item.seller)
    const categoryId = categoryIds.get(item.categorySlug)
    if (!sellerId || !categoryId) throw new Error(`${item.title}: unknown seller or category`)

    const photoPath = `${sellerId}/${randomUUID()}.png`
    const upload = await admin.storage
      .from(PHOTO_BUCKET)
      .upload(photoPath, readFileSync(new URL(`${item.photo}.png`, photoDir)), { contentType: 'image/png' })
    if (upload.error) throw new Error(`${item.title} photo: ${upload.error.message}`)

    // Every listing starts active, as in the app; sold and withdrawn are set below.
    const { data: listing, error: insertError } = await admin
      .from('listings')
      .insert({
        seller_id: sellerId,
        category_id: categoryId,
        program: item.program,
        title: item.title,
        description: item.description,
        price: item.price,
        condition: item.condition,
        model_or_edition: item.modelOrEdition,
        included_parts: item.includedParts,
        known_defects: item.knownDefects,
        photo_path: photoPath,
      })
      .select('id')
      .single()
    if (insertError) throw new Error(`${item.title}: ${insertError.message}`)

    if (item.status === 'sold') {
      const handover = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const request = await admin.from('purchase_requests').insert({
        listing_id: listing.id,
        buyer_id: buyerId,
        note: 'Demo request.',
        meetup_place: 'Main library lobby',
        meetup_at: handover,
        status: 'completed',
        accepted_at: handover,
        completed_at: handover,
      })
      if (request.error) throw new Error(`${item.title} request: ${request.error.message}`)
    }
    if (item.status !== 'active') {
      const update = await admin.from('listings').update({ status: item.status }).eq('id', listing.id)
      if (update.error) throw new Error(`${item.title} status: ${update.error.message}`)
    }
  }
  console.log(`Demo listings ready (${DEMO_LISTINGS.length}, with placeholder photos).`)
}

try {
  await seedCategories()
  const ids = await seedAccounts()
  await seedListings(ids)
  console.log('Seed finished. All demo accounts use DEMO_ACCOUNT_PASSWORD from .env.')
} catch (error) {
  console.error('Seed failed:', error instanceof Error ? error.message : error)
  process.exit(1)
}
