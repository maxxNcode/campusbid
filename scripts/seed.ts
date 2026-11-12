// Seeds categories and the fictional example.test demo accounts.
// Run with: npm run seed   (reads .env; development project only)
//
// Safe to run more than once: existing demo accounts get their password,
// details and approval state reset to the values below, so the pending
// applicant is pending again after each run.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { CATEGORIES, DEMO_ACCOUNTS, DEMO_EMAIL_DOMAIN, type DemoAccount } from './demo-accounts.ts'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const demoPassword = process.env.DEMO_ACCOUNT_PASSWORD

if (!supabaseUrl || !serviceRoleKey || !demoPassword) {
  console.error('Set VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DEMO_ACCOUNT_PASSWORD in .env first.')
  process.exit(1)
}
if (process.env.CAMPUSBID_ENVIRONMENT === 'production') {
  console.error('Refusing to create demo accounts: CAMPUSBID_ENVIRONMENT is production.')
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

async function seedAccounts() {
  const existingIds = await findDemoUserIds(admin)

  // The admin goes first so it can be recorded as the reviewer of the others.
  const adminAccount = DEMO_ACCOUNTS.find((account) => account.isAdmin)
  if (!adminAccount) throw new Error('No demo admin defined.')
  const adminId = await upsertDemoUser(adminAccount, existingIds.get(adminAccount.email))
  await setProfile(adminAccount, adminId, null)
  console.log(`Account ready: ${adminAccount.email} (admin)`)

  for (const account of DEMO_ACCOUNTS) {
    if (account === adminAccount) continue
    const profileId = await upsertDemoUser(account, existingIds.get(account.email))
    await setProfile(account, profileId, adminId)
    console.log(`Account ready: ${account.email} (${account.approvalStatus})`)
  }
}

try {
  await seedCategories()
  await seedAccounts()
  console.log('Seed finished. All demo accounts use DEMO_ACCOUNT_PASSWORD from .env.')
} catch (error) {
  console.error('Seed failed:', error instanceof Error ? error.message : error)
  process.exit(1)
}
