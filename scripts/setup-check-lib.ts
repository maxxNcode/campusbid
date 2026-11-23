// Checks that a Supabase project is ready for CampusBid: it answers, every
// migration's tables and functions exist, the listing-photos bucket has the
// expected limits, and "Confirm email" is off. It only reads, or calls a
// function with an id that cannot exist, so it changes nothing. It never
// prints a key: results carry plain sentences only.

export type CheckResult = { name: string; ok: boolean; detail: string }

export const EXPECTED_TABLES = ['profiles', 'categories', 'listings', 'purchase_requests', 'meetup_places']

// Every function the app calls, with arguments that match no real row. A
// function that exists answers with its own error ("not found", "not approved");
// a missing one answers PGRST202.
export const EXPECTED_FUNCTIONS: Record<string, Record<string, unknown>> = {
  current_user_is_approved: {},
  current_user_is_admin: {},
  current_user_has_request_on: { target_listing_id: -1 },
  listing_photo_path_is_own: { path: 'setup-check' },
  listing_photo_in_use: { path: 'setup-check' },
  member_names: { member_ids: [] },
  pending_accounts: {},
  review_account: { target_profile_id: '00000000-0000-0000-0000-000000000000', decision: 'approved' },
  withdraw_listing: { target_listing_id: -1 },
  send_purchase_request: { target_listing_id: -1, request_note: null, place: 'setup-check', meetup_time: '2000-01-01T00:00:00Z' },
  accept_purchase_request: { target_request_id: -1 },
  decline_purchase_request: { target_request_id: -1, decline_reason: null },
  cancel_purchase_request: { target_request_id: -1, cancel_reason: 'setup-check' },
  complete_purchase_request: { target_request_id: -1 },
}

export const PHOTO_BUCKET = 'listing-photos'
export const PHOTO_LIMIT_BYTES = 5242880
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']

type Env = Record<string, string | undefined>
type Fetch = typeof fetch

export function missingEnv(env: Env): string[] {
  return ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'].filter((key) => !env[key])
}

export async function runSetupChecks(env: Env, doFetch: Fetch = fetch): Promise<CheckResult[]> {
  const results: CheckResult[] = []
  const add = (name: string, ok: boolean, detail: string) => results.push({ name, ok, detail })

  const missing = missingEnv(env)
  if (missing.length > 0) {
    add('Environment', false, `Missing in .env: ${missing.join(', ')}. Copy .env.example to .env and fill it in.`)
    return results
  }
  const base = env.VITE_SUPABASE_URL!.replace(/\/+$/, '')
  const anon = env.VITE_SUPABASE_ANON_KEY!
  const service = env.SUPABASE_SERVICE_ROLE_KEY!
  const asService = { apikey: service, Authorization: `Bearer ${service}` }

  async function call(path: string, init: RequestInit = {}) {
    const response = await doFetch(`${base}${path}`, init)
    const text = await response.text()
    let body: unknown = null
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      body = text
    }
    return { status: response.status, body }
  }

  // 1. Reachable, and Confirm email.
  try {
    const settings = await call('/auth/v1/settings', { headers: { apikey: anon } })
    if (settings.status !== 200) {
      add('Project reachable', false, `The project answered ${settings.status} to the anon key. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.`)
    } else {
      add('Project reachable', true, 'The project answers and accepts the anon key.')
      const autoconfirm = (settings.body as { mailer_autoconfirm?: boolean } | null)?.mailer_autoconfirm
      add(
        'Confirm email is off',
        autoconfirm === true,
        autoconfirm === true
          ? 'Off, so the example.test demo accounts can sign in.'
          : 'Still on. Turn it off in Authentication > Sign In / Providers > Email.',
      )
    }
  } catch {
    add('Project reachable', false, 'Could not connect. Check VITE_SUPABASE_URL and your internet connection.')
    return results
  }

  // 2. The service role key works.
  const probe = await call('/rest/v1/categories?select=id&limit=1', { headers: asService })
  if (probe.status === 401 || probe.status === 403) {
    add('Service role key', false, 'The project rejected SUPABASE_SERVICE_ROLE_KEY. Copy it again from Project Settings > API.')
    return results
  }
  add('Service role key', true, 'Accepted.')

  // 3. Tables.
  for (const table of EXPECTED_TABLES) {
    const result = await call(`/rest/v1/${table}?select=*&limit=0`, { headers: asService })
    add(`Table ${table}`, result.status === 200, result.status === 200 ? 'Exists.' : 'Missing. Apply the migrations in supabase/migrations in order.')
  }

  // 4. Functions.
  for (const [name, args] of Object.entries(EXPECTED_FUNCTIONS)) {
    const result = await call(`/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { ...asService, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    })
    const code = (result.body as { code?: string } | null)?.code
    const missingFn = result.status === 404 || code === 'PGRST202'
    add(`Function ${name}`, !missingFn, missingFn ? 'Missing. Apply the migrations in supabase/migrations in order.' : 'Exists.')
  }

  // 5. Meetup places seeded by the migration.
  const places = await call('/rest/v1/meetup_places?select=id&is_active=eq.true', { headers: asService })
  const placeCount = Array.isArray(places.body) ? places.body.length : 0
  add('Meetup places', placeCount > 0, placeCount > 0 ? `${placeCount} active places.` : 'None found. The request migration adds five.')

  // 6. Photo bucket.
  const bucket = await call(`/storage/v1/bucket/${PHOTO_BUCKET}`, { headers: asService })
  if (bucket.status !== 200) {
    add(`Bucket ${PHOTO_BUCKET}`, false, 'Missing. The listings migration creates it.')
  } else {
    const info = bucket.body as { public?: boolean; file_size_limit?: number; allowed_mime_types?: string[] }
    const problems: string[] = []
    if (info.public !== false) problems.push('it is public (must be private)')
    if (info.file_size_limit !== PHOTO_LIMIT_BYTES) problems.push(`size limit is ${info.file_size_limit ?? 'unset'} (expected ${PHOTO_LIMIT_BYTES})`)
    const types = [...(info.allowed_mime_types ?? [])].sort().join(',')
    if (types !== [...PHOTO_TYPES].sort().join(',')) problems.push('allowed types differ from JPEG, PNG and WebP')
    add(`Bucket ${PHOTO_BUCKET}`, problems.length === 0, problems.length === 0 ? 'Private, 5 MB, JPEG/PNG/WebP.' : `Wrong: ${problems.join('; ')}.`)
  }

  // 7. Reminder rather than a check: the seed needs this to run.
  add(
    'Demo settings',
    Boolean(env.DEMO_ACCOUNT_PASSWORD && env.DEMO_ACCOUNT_PASSWORD.length >= 8) && env.CAMPUSBID_ENVIRONMENT === 'development',
    'The seed needs DEMO_ACCOUNT_PASSWORD (8+ characters) and CAMPUSBID_ENVIRONMENT=development, only for a development project.',
  )
  return results
}
