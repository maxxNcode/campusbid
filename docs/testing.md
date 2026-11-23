# Testing record

Only checks that actually ran are marked as passed.

## Supabase integration tests (`npm test`)

**Status: written, not yet run against Supabase.** The team's Supabase project did not exist on 2026-11-12 or 2026-11-16, so the suite reports its 39 Supabase tests as skipped (17 from Day 1, 22 from Day 2).

`tests/account-access.test.ts` covers handoff checks 1 and 2. It signs in as the seeded buyer, seller and admin and as a throwaway applicant, each in its own client, and checks that:

- A sign-up that sends `is_admin: true` and `approval_status: approved` still gets a pending, non-admin profile.
- A pending applicant reads no listings, sees only their own profile and cannot insert a listing, while an approved buyer can read the test listing.
- An anonymous visitor reads no profiles or listings.
- An applicant cannot set their own `approval_status` or `is_admin` by direct update, but can change their name.
- An approved member cannot change another member's profile.
- `review_account()` fails for the applicant, an approved non-admin and an anonymous visitor, and `pending_accounts()` fails for a non-admin.
- The admin can approve, the reviewer and time are recorded, and a second review of the same account is refused.

The suite creates one listing and two auth users and deletes them afterwards.

`tests/listings.test.ts` covers handoff checks 3, 11 and 12:

- Check 3: another member cannot edit or withdraw a listing, or create one in someone else's name; the seller cannot set the status directly; the seller can edit their own available listing; withdraw cancels pending requests but keeps them, and a withdrawn listing cannot be withdrawn again or edited.
- Check 11: the database rejects a zero or negative price and a missing defects disclosure; a small PNG under a generated name in the seller's folder is accepted; a disallowed file type, a file over 5 MB, an upload into another member's folder or under a chosen name, and an upload from a pending applicant are refused; a listing cannot point at another member's photo.
- Check 12: available matches come newest first without sold, withdrawn or reserved ones; keyword, category and program filters combine; reserved listings appear only when asked; every keyword word must match; punctuation is treated as plain text; a page past the last is empty; a pending applicant sees nothing.

Four checks need no project and ran and passed: allowed photo types and size, generated photo names, price format, and search-word cleaning.

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

## Checks run on 2026-11-16 (Day 2, about 19:31)

| Check | Command or method | Result |
| --- | --- | --- |
| TypeScript | `npm run typecheck` | Passed, no errors |
| Lint | `npm run lint` | Passed, no warnings |
| Production build | `npm run build` | Passed |
| Tests | `npm test` | 4 passed (form checks), 39 skipped: no Supabase project |
| Offline SQL checks | `npm run test:offline` (all seven migrations) | 69 of 69 passed |
| Screens with stubbed Supabase responses | Browser run at 1280 px and 360 px wide | See below |

The 40 new offline checks cover listing insert and edit rules (own seller id, active status, descriptive columns only, no edits once reserved), the photo bucket settings and storage policies (approved read, own-folder upload with a generated name, own-folder delete), `member_names()` (approved callers only, names of approved members only, id and name only), the narrower profile read rule and `withdraw_listing()` (owner only, available only, pending requests cancelled with a reason and kept).

The first Day 2 commit (1bf32c5) had four checks for a second pending applicant that passed without the applicant existing: an earlier check that is expected to fail had rolled back the insert. Commit 9ffbfab creates the applicant in its own setup block, and those checks now run against a real row.

Screens checked with stubbed responses: the Sell form's validation messages (input kept), publishing and the success banner, editing, the blocked page for someone else's or a reserved listing, Browse with search, filters, pagination and each empty state, and My Listings with the status filter and a confirmed Withdraw. No horizontal scrolling at 360 px.

Not run: the integration tests, the seed (ten demo listings with placeholder photos) and any upload to real Storage, so the bucket's size and type limits have not been seen refusing a file.

## Checks run on 2026-11-16 after the Day 2 review (about 19:45)

| Check | Command or method | Result |
| --- | --- | --- |
| TypeScript | `npm run typecheck` | Passed, no errors |
| Lint | `npm run lint` | Passed, no warnings |
| Production build | `npm run build` | Passed |
| Tests | `npm test` | 4 passed, 41 skipped: no Supabase project |
| Offline SQL checks | `npm run test:offline` (eight migrations) | 80 of 80 passed |

Changes to the offline harness: the stand-in grants now copy Supabase's defaults as they are set for the `postgres` and `supabase_admin` roles, the harness refuses to run unless migrations run as `postgres`, and `SKIP_MIGRATION=<part of a file name>` leaves one migration out. The pg_trgm extension is loaded so a check can create it.

New offline checks (11):

- A function created after the migrations has no EXECUTE for `anon`, `authenticated` or PUBLIC (`has_function_privilege` and the function's ACL), but `service_role` keeps it.
- Control: a function created by `supabase_admin` still gets the stand-in grants, so the model is live and the check above can fail.
- With pg_trgm created after the revoke, a trigram index still serves an `ilike` search for a signed-in member; calling `similarity()` directly is not allowed without a grant. The app does not call it.
- A listing without a photo is refused, and an edit cannot remove the photo.
- A seller cannot delete the photo of their own available or sold listing, or point a sold listing at a new photo; they can delete an upload of their own that no listing uses.

Every existing check that inserts a listing now sends a valid photo path, so the checks expected to fail still fail for their own reason (seller, status, price, defects, approval), and the run output shows each error message.

Mutation runs: with `SKIP_MIGRATION=revoke_default_function` five checks fail (both "not callable" checks, the new privilege check, the `similarity()` check and "member_names is not callable by anon"). With `SKIP_MIGRATION=keep_listing_photos` four fail (both missing-photo checks and both photo-delete checks).

New integration tests (not run, no project): a listing without a photo is refused, and the seller cannot delete or remove the photo of their withdrawn listing. Every listing insert in the suites now sends a photo path.

## Checks run on 2026-11-20 (Day 3)

| Check | Command or method | Result |
| --- | --- | --- |
| TypeScript, lint, build | `npm run typecheck`, `npm run lint`, `npm run build` | Passed |
| Offline SQL checks | `npm run test:offline` | 155 of 155 passed at the time (75 new: sending, validation, one-request limit, accept, decline, cancel, complete, replays, unrelated users, anon) |
| Request screens | Playwright with stubbed Supabase, 1280 and 360 px | Form errors, send, accept, cancel with reason, stale accept message, complete; no horizontal scroll |
| `npm test` | Vitest | 4 passed, 50 skipped: no `.env` or Supabase project |

Not run: `tests/requests.test.ts` (checks 4 to 10 and the meetup part of 11), the seed, and the real two-connection double-accept. The offline database (PGlite) is one connection, so a parallel race cannot run there; replays and stale clicks are tested one after another instead.

## Setup checklist once the project exists

1. Apply all migrations in `supabase/migrations/` in filename order. They also create the private `listing-photos` bucket.
2. Turn off "Confirm email" in Supabase Auth. The migrations and seed cannot set this. If it stays on, registration shows "Check your email" and new accounts cannot sign in until they confirm, and the sign-up test in `npm test` gets no session.
3. Set `CAMPUSBID_ENVIRONMENT=development` in `.env` and run `npm run seed`.
4. Run `npm test` and record the real result here.
5. In the SQL editor, list the functions in `public` that visitors can call. The expected answer is no rows:
   `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute');`
6. Sign in as each demo account in two browser sessions and approve the pending applicant.

### After the Day 3 review (2026-11-20)

| Check | Result |
| --- | --- |
| TypeScript, lint, build | Passed |
| `npm run test:offline` | 166 of 166 passed. The earlier "155" was right at the time (155 `-- CHECK` blocks); 11 were added for the review fixes. Skipping the new migration makes 6 of them fail, so they do test it |
| `npm test` | 4 passed, 51 skipped (one new integration test); no `.env` |

New offline checks: a meetup at exactly 20:00:00 is accepted and 20:00:01 refused, pending cancel with no reason works and a 1-character reason is still refused, an expired request cannot be accepted but can be declined, and cancelling an accepted request on a non-reserved listing raises and leaves the request accepted. The stubbed screen run was not repeated after these small UI changes. The parallel double-accept still has not run.

## Checks run on 2026-11-23 (Phase 4 part A)

| Check | Command or method | Result |
| --- | --- | --- |
| TypeScript, lint, build | `npm run typecheck`, `npm run lint`, `npm run build` | Passed |
| Offline SQL checks | `npm run test:offline` | 166 of 166 passed |
| `npm test` | Vitest | 10 passed, 51 skipped. The 6 new passing tests cover the setup check and the demo-reset guard against a local stub server; the 51 skipped need a Supabase project |
| Usability pass | Playwright with stubbed Supabase, 360 and 1280 px | Labels, names, focus ring, no horizontal scroll, not-found and empty states: no problems found. A check on scaffolding, not evidence |

Not run: the seed, `reset:demo` against a real project, the 51 Supabase integration tests, the real two-connection race, and real screenshots.

## Checks run on 2026-11-23 (offline demo mode)

| Check | Command or method | Result |
| --- | --- | --- |
| TypeScript, lint, build | `npm run typecheck`, `npm run lint`, `npm run build` | Passed |
| Offline SQL checks | `npm run test:offline` | 166 of 166 passed |
| `npm test` | Vitest | 24 passed, 51 skipped. The 14 new tests (`tests/demo-store.test.ts`) cover the demo store: approval gate, ownership, one request per buyer per item, accept reserves and declines the others, expired pending cannot be accepted, meetup place and time rules, cancel-accepted reopens, complete sells, only active listings editable, withdraw cancels pending |
| Section 4 flow in demo mode | Playwright on `npm run demo`, two tabs, 1280 and 360 px | Seller signs in, lists an item with a photo, buyer finds it by keyword and category, sends a request, seller accepts (reserved), buyer sees the meetup, seller completes (sold); then the account switcher, an admin approval and the reset. Banner on every page, no horizontal scroll, no console errors, no request left the local server |

These check the demo mode only. They are not evidence of the real app and say nothing about Supabase.

