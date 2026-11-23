// Offline checks for the setup and reset scripts. A small local HTTP server
// stands in for a Supabase project, so no real project, key or data is used.
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { readdirSync, readFileSync } from 'node:fs'
import { afterAll, describe, expect, it } from 'vitest'
import { EXPECTED_FUNCTIONS, EXPECTED_TABLES, runSetupChecks } from '../scripts/setup-check-lib.ts'
import { developmentGuardProblem } from '../scripts/env-guard.ts'

type Options = { missingTables?: string[]; missingFunctions?: string[]; confirmEmail?: boolean; publicBucket?: boolean; badServiceKey?: boolean }

function stubProject(options: Options): Promise<{ server: Server; url: string }> {
  const server = createServer((req, res) => {
    const path = (req.url ?? '').split('?')[0]
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(body))
    }
    if (path === '/auth/v1/settings') return send(200, { mailer_autoconfirm: options.confirmEmail !== true })
    if (options.badServiceKey && req.headers.apikey === 'service-key') return send(401, { message: 'Invalid API key' })
    const table = path.match(/^\/rest\/v1\/(\w+)$/)
    if (table) {
      if (options.missingTables?.includes(table[1])) return send(404, { code: 'PGRST205' })
      return send(200, table[1] === 'meetup_places' ? [{ id: 1 }, { id: 2 }] : [])
    }
    const fn = path.match(/^\/rest\/v1\/rpc\/(\w+)$/)
    if (fn) {
      if (options.missingFunctions?.includes(fn[1])) return send(404, { code: 'PGRST202' })
      return send(403, { code: '42501', message: 'Only approved members can do this.' })
    }
    if (path === '/storage/v1/bucket/listing-photos') {
      return send(200, {
        public: options.publicBucket ?? false,
        file_size_limit: 5242880,
        allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp'],
      })
    }
    return send(404, {})
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}` }))
  })
}

const envFor = (url: string) => ({
  VITE_SUPABASE_URL: url,
  VITE_SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  DEMO_ACCOUNT_PASSWORD: 'local-demo-pass',
  CAMPUSBID_ENVIRONMENT: 'development',
})

describe('setup check', () => {
  const servers: Server[] = []
  async function run(options: Options) {
    const { server, url } = await stubProject(options)
    servers.push(server)
    return runSetupChecks(envFor(url))
  }
  afterAll(() => servers.forEach((server) => server.close()))

  it('passes against a complete project', async () => {
    const results = await run({})
    expect(results.filter((r) => !r.ok)).toEqual([])
    expect(results.length).toBeGreaterThan(EXPECTED_TABLES.length + Object.keys(EXPECTED_FUNCTIONS).length)
  })

  it('lists what is missing and never prints a key', async () => {
    const results = await run({ missingTables: ['meetup_places'], missingFunctions: ['accept_purchase_request'], confirmEmail: true, publicBucket: true })
    const failed = results.filter((r) => !r.ok).map((r) => r.name)
    expect(failed).toEqual(expect.arrayContaining(['Table meetup_places', 'Function accept_purchase_request', 'Confirm email is off', 'Bucket listing-photos']))
    const text = JSON.stringify(results)
    expect(text).not.toContain('service-key')
    expect(text).not.toContain('anon-key')
  })

  it('reports a rejected service key and missing environment values', async () => {
    const rejected = await run({ badServiceKey: true })
    expect(rejected.some((r) => r.name === 'Service role key' && !r.ok)).toBe(true)
    const none = await runSetupChecks({})
    expect(none).toHaveLength(1)
    expect(none[0].detail).toContain('VITE_SUPABASE_URL')
  })

  it('reports an unreachable project', async () => {
    const results = await runSetupChecks({ ...envFor('http://127.0.0.1:1') })
    expect(results.find((r) => r.name === 'Project reachable')?.ok).toBe(false)
  })

  it('expects every table and function the migrations create', () => {
    const dir = new URL('../supabase/migrations/', import.meta.url)
    const sql = readdirSync(dir).map((file) => readFileSync(new URL(file, dir), 'utf8')).join('\n')
    const tables = [...sql.matchAll(/create table public\.(\w+)/g)].map((m) => m[1])
    const functions = [...sql.matchAll(/create (?:or replace )?function public\.(\w+)/g)].map((m) => m[1])
    // Trigger functions cannot be called through the API, so they are not probed.
    const triggerOnly = ['set_updated_at', 'handle_new_user', 'protect_profile_review_fields', 'test_at']
    expect([...new Set(tables)].sort()).toEqual([...EXPECTED_TABLES].sort())
    expect([...new Set(functions)].filter((name) => !triggerOnly.includes(name)).sort()).toEqual(Object.keys(EXPECTED_FUNCTIONS).sort())
  })
})

describe('demo reset guard', () => {
  const good = { VITE_SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k', DEMO_ACCOUNT_PASSWORD: 'long-enough-pw', CAMPUSBID_ENVIRONMENT: 'development' }
  it('allows only an explicit development environment', () => {
    expect(developmentGuardProblem(good)).toBeNull()
    expect(developmentGuardProblem({ ...good, CAMPUSBID_ENVIRONMENT: 'production' })).toMatch(/Refusing/)
    expect(developmentGuardProblem({ ...good, CAMPUSBID_ENVIRONMENT: undefined })).toMatch(/Refusing/)
    expect(developmentGuardProblem({ ...good, CAMPUSBID_ENVIRONMENT: 'Development' })).toMatch(/Refusing/)
    expect(developmentGuardProblem({ ...good, DEMO_ACCOUNT_PASSWORD: 'short' })).toMatch(/8 characters/)
    expect(developmentGuardProblem({})).toMatch(/Set VITE_SUPABASE_URL/)
  })
})
