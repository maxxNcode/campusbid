# Testing record

Only checks that actually ran are marked as passed.

## Supabase integration tests (`npm test`)

**Status: written, not yet run against Supabase.** The team's Supabase project did not exist on 2026-11-12, so the suite reported its 17 tests as skipped.

`tests/account-access.test.ts` covers handoff checks 1 and 2. It signs in as the seeded buyer, seller and admin and as a throwaway applicant, each in its own client, and checks that:

- A sign-up that sends `is_admin: true` and `approval_status: approved` still gets a pending, non-admin profile.
- A pending applicant reads no listings, sees only their own profile and cannot insert a listing, while an approved buyer can read the test listing.
- An anonymous visitor reads no profiles or listings.
- An applicant cannot set their own `approval_status` or `is_admin` by direct update, but can change their name.
- An approved member cannot change another member's profile.
- `review_account()` fails for the applicant, an approved non-admin and an anonymous visitor, and `pending_accounts()` fails for a non-admin.
- The admin can approve, the reviewer and time are recorded, and a second review of the same account is refused.

The suite creates one listing and two auth users and deletes them afterwards.

## Checks run on 2026-11-12

### First pass (about 21:00)

| Check | Command or method | Result |
| --- | --- | --- |
| TypeScript | `npm run typecheck` | Passed, no errors |
| Lint | `npm run lint` | Passed, no warnings |
| Production build | `npm run build` | Passed |
| Integration tests | `npm test` | Skipped: no Supabase project (17 skipped) |
| Migrations and access rules, offline | The first two migrations applied to PGlite (Postgres compiled to WebAssembly) with small stand-ins for Supabase's `auth` schema and roles, then 20 SQL assertions | 20 of 20 passed. Same rules as the integration tests, plus: the trigger alone blocks self-approval even if a column grant were added by mistake, an admin cannot review their own account, and a negative price is rejected. |
| Screens at 1280px and 360px wide | Playwright against `npm run dev`, with Supabase HTTP responses stubbed | Sign in, registration validation (input kept after errors), pending page, approved Browse page, admin approve flow with confirmation and success message all render and work. A pending user is redirected from Browse to the pending page; a non-admin is redirected away from the admin page. No horizontal scrolling at 360px. |

### After the Day 1 review fixes (21:11)

| Check | Command or method | Result |
| --- | --- | --- |
| TypeScript | `npm run typecheck` | Passed, no errors |
| Lint | `npm run lint` | Passed, no warnings |
| Production build | `npm run build` | Passed |
| Integration tests | `npm test` | Skipped again: no Supabase project (17 skipped) |
| Offline SQL checks | `npm run test:offline` (all four migrations) | 29 of 29 passed |
| Seed environment guard | `node scripts/seed.ts` with `CAMPUSBID_ENVIRONMENT` unset, then `production`, then `development` (dummy URL) | Refused, refused, then went on to connect (and failed only on the dummy URL) |

The 9 new offline assertions cover: a buyer still sees a sold listing they requested; an approved member without a request does not; the buyer can join their request to its sold listing without policy recursion; the seller still sees their sold listing and its request; a function created after the migrations cannot be called by `anon` or `authenticated` until it is granted explicitly. With the default-privileges migration removed, the two "cannot be called" assertions failed, so they do test that migration. The stand-ins copy Supabase's default grants to `anon` and `authenticated` on new functions; whether the hosted project behaves the same is confirmed only when `npm test` runs there.

Screens were not changed by the fixes and were not re-shot.

Limitations: the offline Postgres check and the stubbed screen check do not prove behaviour on hosted Supabase. The offline harness is now in the repository (`tests/offline/`) and can be re-run with `npm run test:offline`. The seed script has not run against a project.

## Setup checklist once the project exists

1. Apply all migrations in `supabase/migrations/` in filename order.
2. Turn off "Confirm email" in Supabase Auth. The migrations and seed cannot set this. If it stays on, registration shows "Check your email" and new accounts cannot sign in until they confirm, and the sign-up test in `npm test` gets no session.
3. Set `CAMPUSBID_ENVIRONMENT=development` in `.env` and run `npm run seed`.
4. Run `npm test` and record the real result here.
5. Sign in as each demo account in two browser sessions and approve the pending applicant.
