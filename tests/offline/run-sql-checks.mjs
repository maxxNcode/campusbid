// Offline check: applies the migrations to PGlite (Postgres in WebAssembly) with
// small stand-ins for Supabase's auth schema, roles and default grants,
// then runs the assertions in access-checks.sql. Not a substitute for npm test
// against hosted Supabase. Run with: npm run test:offline
//
// SKIP_MIGRATION=<part of a file name> leaves that migration out, to confirm
// that the checks covering it fail without it.
import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const migrationsDir = fileURLToPath(new URL('../../supabase/migrations', import.meta.url))
const defaultChecksFile = fileURLToPath(new URL('./access-checks.sql', import.meta.url))
const db = new PGlite({ extensions: { pg_trgm } })
const skipMigration = process.env.SKIP_MIGRATION ?? ''

const stubs = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
-- Hosted Supabase also has supabase_admin, which owns objects that migrations do
-- not create (for example some extension functions).
create role supabase_admin nologin;
create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb default '{}'::jsonb
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
-- Supabase's default grants: objects that postgres (which runs migrations) or
-- supabase_admin create in public are granted to the API roles. On top of these,
-- Postgres itself grants EXECUTE on every new function to PUBLIC.
alter default privileges for role postgres in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges for role supabase_admin in schema public grant all on functions to anon, authenticated, service_role;
grant create on schema public to supabase_admin;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated, service_role;
grant all on storage.objects to anon, authenticated, service_role;
grant select on storage.buckets to anon, authenticated, service_role;
create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name, '/') $$;
`
await db.exec(stubs)

if ((await db.query('select current_user as name')).rows[0].name !== 'postgres') {
  throw new Error('The stand-ins expect migrations to run as postgres, as on Supabase.')
}

for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
  if (skipMigration && file.includes(skipMigration)) {
    console.log('skipped', file)
    continue
  }
  try {
    await db.exec(readFileSync(join(migrationsDir, file), 'utf8'))
    console.log('applied', file)
  } catch (error) {
    console.log('FAILED', file, error.message)
    process.exit(1)
  }
}

const checksFile = process.argv[2] ?? defaultChecksFile
if (checksFile && existsSync(checksFile)) {
  const blocks = readFileSync(checksFile, 'utf8').split(/^-- CHECK /m).slice(1)
  let failures = 0
  for (const block of blocks) {
    const [titleLine, ...rest] = block.split('\n')
    const expectError = titleLine.includes('[error]')
    const sql = rest.join('\n')
    let outcome
    try {
      const results = await db.exec(sql)
      const last = results[results.length - 1]
      outcome = { ok: true, rows: last?.rows }
    } catch (error) {
      outcome = { ok: false, message: error.message }
    }
    await db.exec('reset role; select set_config(\'request.jwt.claim.sub\', \'\', false);').catch(() => {})
    const passed = expectError ? !outcome.ok : outcome.ok && JSON.stringify(outcome.rows).includes('"pass":true')
    if (!passed) failures++
    console.log(passed ? 'PASS' : 'FAIL', titleLine.trim(), outcome.ok ? JSON.stringify(outcome.rows) : outcome.message)
  }
  console.log(failures === 0 ? `all ${blocks.length} checks passed` : `${failures} of ${blocks.length} checks failed`)
  if (failures > 0) process.exit(1)
}
