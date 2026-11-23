# Progress log

Actual dated development sessions. Times are Asia/Manila (UTC+8).

## Stack change (decided 2026-11-09)

Checkpoint 1 proposed Laravel, Blade and MySQL. On 2026-11-09 the team decided to build CampusBid with React, TypeScript and Supabase (Postgres, Auth, Storage) instead. Reason: one hosted backend covers the database, sign-in and photo storage, Row Level Security lets the database enforce who may see and change each row, and the team does not have to run and host a PHP server for a three-day build. The build does not follow the Checkpoint 1 stack.

The Checkpoint 1 classroom responses (U01–U05) are design inputs, not usability sessions or proof of demand. Their dates are not development dates.

## 2026-11-12, Day 1: Phase 0 and Phase 1

Development started on 2026-11-12, about 20:50. The code in this session was drafted with AI assistance (see README) from the team's specification.

### Phase 0: environment check and plan

- Windows 11 Pro, Node.js 26.7.0, npm 11.19.0. Vite 8 requires Node `^20.19.0` or `>=22.12.0`, so no runtime change was needed.
- `C:\Users\Admin\Desktop\DEV\campusbid` held only the handoff documents. The app repository was created in its `app` subfolder so the handoff files stay outside Git.
- Git identity is the existing global one (maxxNcode). No repository-local identity is set.
- Blocker: the team's Supabase project does not exist yet, so nothing could be run against a real database.
- Plan: scaffold with `create-vite` (react-ts), write the migrations as SQL files, build the account screens, write the seed script and integration tests, and run the tests once the project exists.

### Phase 1: accounts and approval

| Commit | Change |
| --- | --- |
| 4d2b462 | Vite + React + TypeScript scaffold, sample content removed |
| f6aae74 | Schema: profiles, categories, listings, purchase_requests |
| 5ac34df | Row Level Security, sign-up trigger, approval guard trigger, `review_account()` |
| 0789419 | Supabase client, database types, `.env.example` |
| 5436217 | Registration, sign in, sign out, empty Browse page |
| 71e4bb5 | Pending approval gate |
| fc863d2 | Admin account approval page |
| 6dbee0a | Seed script for categories and demo accounts |
| a050284 | Integration tests for checks 1 and 2 |
| b187d24 | Registration message fix |
| d55df13 | README |

Decisions:

- `reviewed_by` / `reviewed_at` instead of `approved_by` / `approved_at`, because the same columns also record a rejection.
- The listing and request tables exist now, but clients can only read them. Write rules arrive with the listing and request features.
- A partial unique index allows only one accepted or completed request per listing, as a last guard against double reservation.
- Programs offered in forms: BS Information Technology, BS Civil Engineering, BS Mechanical Engineering and Other (only programs confirmed on the UC Main Campus list).

Verification done today is listed in `docs/testing.md`. The Supabase integration tests have not run yet.

### Day 1 review fixes (about 21:08–21:12)

The Day 1 review found no blockers and three should-fix items, all fixed:

| Commit | Change |
| --- | --- |
| a1be134 | Buyers keep seeing listings they requested after sale or withdrawal (security definer helper, no policy recursion) |
| 8b45030 | New database functions are no longer callable by `anon`/`authenticated` by default |
| 0fa221b | Seed runs only when `CAMPUSBID_ENVIRONMENT=development` is set explicitly |
| c856d18 | Offline SQL checks moved into the repository (`npm run test:offline`) |

Minor review items not changed: profile column exposure and the Phase 3 request checks are recorded in `docs/known-issues.md`; re-approving a rejected account is a team decision and stays documented; the raw error for malformed direct API sign-ups does not affect the app's form.

Next: the team creates the Supabase project, then the migrations, seed and tests are run for real. Phase 2 (listings) waits for review.

## 2026-11-16, Day 2: Phase 2 (listings)

Session from about 19:10 to 19:35. Still no Supabase project, so everything was checked offline (see `docs/testing.md`).

| Commit | Change |
| --- | --- |
| 1bf32c5 | Listing insert/edit rules, private photo bucket and its policies; Sell an Item form with photo upload; item details page |
| 9ffbfab | Browse: keyword search, category and program filters, reserved toggle, pagination, empty states; seller names through `member_names()`; profile rows no longer readable by other members |
| b6fc8d1 | `withdraw_listing()`; My Listings with a status filter and a confirmed Withdraw |
| d8912b8 | Seed: ten demo listings with placeholder photos (seven available, two sold, one withdrawn) |
| 23ac664 | Integration tests for checks 3, 11 and 12, plus form checks that run without a project |

Decisions:

- Clients send only the descriptive listing fields. The seller is always the signed-in user and every new listing starts as available; status changes go through database functions.
- Only available listings can be edited, so nothing changes under a buyer once a listing is reserved.
- Withdrawing cancels pending requests with a reason instead of deleting them, so the history stays. A withdrawn listing cannot be reopened.
- Browse shows available items only. "Also show reserved items" adds reserved ones; sold and withdrawn items appear only in the seller's My Listings and to buyers who requested them.
- Keyword search requires every word to appear in the title, description or model/edition. Punctuation is removed before the query is built.
- Photos are optional when editing (the current one is kept) but required when creating a listing, as the specification lists a photo among the listing fields.
- Request buttons are not shown. The item page says requests arrive in the next phase.

The offline checks found a mistake in their own setup: a Day 1 check that is expected to fail had rolled back the creation of a second pending applicant, so the first Phase 2 checks for that applicant passed without the user existing. The setup now creates the applicant in its own block (commit 9ffbfab). The Day 1 check "buyer cannot insert listing" became "pending user cannot insert listing", because approved members may now create listings.

## 2026-11-20, Day 3: Phase 3 (purchase requests and meetups)

| Commit | Change |
| --- | --- |
| 8db4f43 | Request sending, meetup places and price seen |
| 9992c4f | Accept and decline functions |
| 9474536 | Cancel and complete functions |
| 471a880 | Request pages with confirmed actions |
| c758d0b | Integration tests for requests |

Decisions:

- A withdrawn listing is not reopened; the seller lists the item again.
- Each request stores the price the buyer saw.
- Each transition is one database function that locks the listing row first, then the request, then re-checks approval, ownership and state.
- Review fixes (same day): expired pending requests cannot be accepted, a pending cancel needs no reason, an accepted cancel on a non-reserved listing raises, and My Requests loads listings in one query (commits b2d79e2, 8ba4980).
- Replays give a plain message instead of changing anything.

## 2026-11-23, Phase 4 part A: everything that does not need the database

No Supabase project exists yet, so the real screenshots, the seed, the 51 Supabase integration tests, the two-buyer race and the full two-session run are waiting. Done in this session:

| Commit | Change |
| --- | --- |
| e0bc4b5 | `npm run setup:check`, `npm run reset:demo`, offline tests for both, "Day of setup" in the README |

- `setup:check` reads `.env`, confirms the project answers, that every table and function from the migrations and the `listing-photos` bucket exist, that "Confirm email" is off, and lists what is missing. It never prints a key. A test keeps its list of tables and functions in step with the migration files.
- `reset:demo` refuses unless `CAMPUSBID_ENVIRONMENT=development`, deletes only the `@example.test` accounts' data and runs the seed. The refusal and the setup check are tested against a local stub server; the delete itself has not run against a real project.
- Usability pass at 360 and 1280 px with the stubbed browser run (a check, not evidence): every field has a label, buttons and links have names, the first Tab stop shows a focus ring, no page scrolls sideways, missing items show "not found" messages, and a failed photo shows "No photo available". No fix was needed.
- Records brought up to date: demo plan, metrics, contributions, scope, known issues, testing, and `docs/checkpoint2-evidence.md` for the PM.

Dates in this log are the real dates of the sessions (2026-11-12, 2026-11-16, 2026-11-20 and 2026-11-23). The stack change from the Checkpoint 1 plan (Laravel, Blade, MySQL) to React, TypeScript and Supabase was decided on 2026-11-09 and is explained at the top of this file.

