// Development-only reset: removes the fictional example.test demo accounts'
// data (their listings, requests, requests they sent to others, and photos),
// then runs the seed to create it again. Real members' rows are never matched,
// because every query is limited to ids of accounts ending in @example.test.
// Run with: npm run reset:demo   (needs CAMPUSBID_ENVIRONMENT=development)
import { spawnSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { DEMO_EMAIL_DOMAIN } from './demo-accounts.ts'
import { developmentGuardProblem } from './env-guard.ts'

const problem = developmentGuardProblem(process.env)
if (problem) {
  console.error(problem)
  process.exit(1)
}

const admin = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const demoIds: string[] = []
for (let page = 1; ; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
  if (error) throw new Error(`Listing users: ${error.message}`)
  for (const user of data.users) if (user.email?.endsWith(`@${DEMO_EMAIL_DOMAIN}`)) demoIds.push(user.id)
  if (data.users.length < 1000) break
}

if (demoIds.length > 0) {
  // Requests the demo accounts sent, wherever they were sent. The seed then
  // removes the demo sellers' listings, the requests on them and their photos.
  const sent = await admin.from('purchase_requests').delete().in('buyer_id', demoIds)
  if (sent.error) throw new Error(`Removing demo requests: ${sent.error.message}`)
  console.log(`Cleared requests sent by ${demoIds.length} demo account(s).`)
} else {
  console.log('No demo accounts found yet; the seed will create them.')
}

const seed = spawnSync(process.execPath, ['scripts/seed.ts'], { stdio: 'inherit', env: process.env })
process.exit(seed.status ?? 1)
