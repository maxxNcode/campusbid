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

Next: the team creates the Supabase project, then the migrations, seed and tests are run for real. Phase 2 (listings) waits for review.
