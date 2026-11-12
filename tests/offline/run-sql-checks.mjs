// Offline check: applies the migrations to PGlite (Postgres in WebAssembly) with
// small stand-ins for Supabase's auth schema, roles and default grants,
// then runs the assertions in access-checks.sql. Not a substitute for npm test
// against hosted Supabase. Run with: npm run test:offline
import { PGlite } from '@electric-sql/pglite'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const migrationsDir = fileURLToPath(new URL('../../supabase/migrations', import.meta.url))
const defaultChecksFile = fileURLToPath(new URL('./access-checks.sql', import.meta.url))
const db = new PGlite()

const stubs = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
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
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name, '/') $$;
`
await db.exec(stubs)

for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
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
