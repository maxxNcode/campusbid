// Shared helpers for the integration tests. Each signed-in user gets its own
// client, like a separate browser session, so RLS sees the real user.

import { existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database.ts'

if (existsSync('.env')) {
  process.loadEnvFile('.env')
}

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? ''
const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const demoPassword = process.env.DEMO_ACCOUNT_PASSWORD ?? ''

// Without a configured project the suites are reported as skipped, not passed.
export const supabaseConfigured = Boolean(supabaseUrl && anonKey && serviceRoleKey && demoPassword)

export type CampusBidClient = SupabaseClient<Database>

const noSession = { auth: { autoRefreshToken: false, persistSession: false } }

export function anonClient(): CampusBidClient {
  return createClient<Database>(supabaseUrl, anonKey, noSession)
}

// Bypasses RLS. Used only to arrange test data and to inspect the result.
export function serviceClient(): CampusBidClient {
  return createClient<Database>(supabaseUrl, serviceRoleKey, noSession)
}

export async function signedInClient(email: string, password = demoPassword) {
  const client = anonClient()
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) {
    throw new Error(`Could not sign in as ${email}: ${error.message}. Run npm run seed first.`)
  }
  return { client, userId: data.user.id }
}

// A throwaway pending applicant, deleted again by deleteTestUser().
export async function createTestApplicant(service: CampusBidClient) {
  const email = `test-applicant-${randomUUID()}@example.test`
  const password = randomUUID()
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Test Applicant', program: 'BS Civil Engineering', year_level: 2 },
  })
  if (error) throw new Error(`Could not create test applicant: ${error.message}`)
  const { client } = await signedInClient(email, password)
  return { client, userId: data.user.id, email }
}

export async function deleteTestUser(service: CampusBidClient, userId: string) {
  const { error } = await service.auth.admin.deleteUser(userId)
  if (error) throw new Error(`Could not delete test user ${userId}: ${error.message}`)
}
