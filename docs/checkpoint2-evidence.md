# Checkpoint 2 evidence summary

Written 2026-11-23 from the repository, `git log` and `docs/testing.md`. No number below is estimated.

## Built (in code)

- Accounts: register, sign in and out, pending approval gate, admin approval page.
- Listings: create and edit with a required photo and condition disclosure, item page, browse with search, category and program filters and paging, My Listings, confirmed withdraw. A withdrawn listing stays closed (student decision).
- Purchase requests: one request per buyer per item with a note, a campus meetup place from a configurable list and a time checked on the server in Asia/Manila (future, within 30 days, 07:00 to 20:00). Seller accepts or declines; accepting reserves the item and declines the other pending requests; buyer or seller cancels with a reason; seller marks the handover done and the item becomes sold. Each request keeps the price the buyer saw. Pages: My Requests, Requests Received, request detail.
- Server rules: row level security, and every request change is one database function that locks the listing row first, then re-checks approval, ownership and state.
- Tooling: `npm run setup:check` (is the Supabase project ready), `npm run reset:demo` (development project only), a "Run it in the lab" and a "Day of setup" section in the README.

## Has run

| What | Result (2026-11-23) |
| --- | --- |
| Typecheck, lint, production build | Passed |
| `npm run test:offline` (in-memory Postgres, 12 migrations, access and request rules) | 166 of 166 passed |
| `npm test` | 10 passed, 51 skipped (the 51 need a Supabase project) |
| Setup check and demo-reset guard | Tested against a local stub server only |
| Browser run with stubbed responses at 360 and 1280 px | Request flow and a labels/focus/empty-state pass found no problems. This is a check on scaffolding, not evidence of the real app |

## Has not run

- Nothing has run against a real Supabase project: no project exists yet.
- The seed, `reset:demo` against a real project, and the 51 Supabase integration tests.
- The parallel double-accept on two real connections (the offline database is one connection; replays and stale clicks are tested one after another).
- Real screenshots of the running app, and the backup demo recording.
- Real feedback sessions T01 to T03 and mentor feedback: none received.
- Metrics: completed exchanges, sell-through and unaided task success are all "not yet measurable" or "not measured" (`docs/metrics.md`).

## Commits (Git author on all: maxxNcode)

- 2026-11-12, Phase 0 and 1: 4d2b462, f6aae74, 5ac34df, 0789419, 5436217, 71e4bb5, fc863d2, 6dbee0a, a050284, b187d24, d55df13, ec1c846, a1be134, 8b45030, 0fa221b, c856d18, 2b463fa.
- 2026-11-16, Phase 2: 1bf32c5, 9ffbfab, b6fc8d1, d8912b8, 23ac664, bf4ac61, f21cb61, c4a4633, 2c7763b.
- 2026-11-20, Phase 3: 8db4f43, 9992c4f, 9474536, 471a880, c758d0b, 29d3a1c, b2d79e2, 8ba4980, abc29a0.
- 2026-11-23, Phase 4 part A: e0bc4b5, 57b5194, b3bf61d, and the records commit that adds this file.

Code was drafted with an AI assistant and committed under Mark's identity (disclosed in the README). No commit by Nicholas, Lance or Rene exists yet.

## Open items, in order

1. Create the Supabase project (free, Singapore) and give the team's URL, anon key and service-role key to whoever runs the setup.
2. Apply the migrations, turn off "Confirm email", fill `.env`, run `npm run setup:check`, `npm run seed`, `npm test`. Record the real results in `docs/testing.md`.
3. Run the two-session main flow on the real project; take screenshots and a backup recording from it.
4. Apply the design the team supplies (the screens are plain Bootstrap).
5. Hold real feedback sessions T01 to T03 with consent, and ask the mentor the questions in `docs/contributions.md`.
6. Decide whether a buyer may send a new request after a decline or an expired meetup (`docs/known-issues.md`).
