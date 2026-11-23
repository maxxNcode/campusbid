# CampusBid

CampusBid by Ctrl+Alt Build is a responsive web application where University of Cebu Main Campus students buy and sell secondhand academic materials (calculators, reference books, drafting tools, project kits) at fixed prices. Payment and handover happen in person, outside the app. Auctions are not part of this release.

Team: Mark Froilan Lendio (leader), John Nicholas De La Calzada, Rene James Aleonar, Lance Busico. BSIT 4C, Lean Startup Methodology / IT-FRELEAN. Faculty mentor: Christian Barral.

## Current status

Phases 1 to 3 of the build (accounts and approval, listings, then purchase requests with meetups) are implemented. The screens are temporary functional pages with plain Bootstrap styling; the team will supply the visual design. See `docs/progress.md` for the dated log and `docs/scope.md` for feature status.

What works now:

- Registration, sign in and sign out with email and password (Supabase Auth).
- New accounts start as pending. Pending and rejected users see a status page and cannot browse.
- An admin-only page lists pending applicants and approves or rejects them, recording who reviewed and when.
- Database tables, Row Level Security and the admin review function (`supabase/migrations/`).
- Approved members can list an item with a photo, price in pesos, condition, known defects, model or edition and included or missing parts, and edit it while it is available.
- Browse: keyword search, category and program filters, newest first, 12 per page, with empty states. Only available items show unless "Also show reserved items" is ticked.
- Item details page with the seller's name. Buyers send one purchase request per item with a note, a campus meetup place and a time.
- My Listings with Available, Reserved, Sold and Withdrawn filters, and a Withdraw that asks for confirmation and keeps request history.
- Photos are stored in a private bucket that only approved members can read; uploads get generated names and must be JPEG, PNG or WebP up to 5 MB.
- A seed script for categories, fictional demo accounts and ten demo listings.

## Stack and versions

The Checkpoint 1 plan proposed Laravel, Blade and MySQL. On 2026-11-09 the team switched to React, TypeScript and Supabase (see `docs/progress.md`).

| Tool | Version used |
| --- | --- |
| Node.js | 26.7.0 (Vite 8 needs `^20.19.0` or `>=22.12.0`) |
| npm | 11.19.0 |
| Vite | 8.3.8 |
| React / React DOM | 19.3.1 |
| TypeScript | 7.0.2 |
| React Router | 8.5.1 |
| @supabase/supabase-js | 2.119.0 |
| Bootstrap (CSS only, bundled from npm) | 5.3.9 |
| Vitest | 5.1.0 |
| oxlint | 1.93.0 |

Exact dependency versions are locked in `package-lock.json`.

## Setup

1. **Create a Supabase project** (free plan) for CampusBid only.
2. **Apply the migrations** in filename order. Either paste each file from `supabase/migrations/` into the Supabase SQL Editor and run it, or use the Supabase CLI:
   ```sh
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
3. **Turn off email confirmation:** Authentication > Sign In / Providers > Email > turn off "Confirm email". The `example.test` demo addresses cannot receive mail, and student status is checked separately by an admin.
4. **Create `.env`:**
   ```sh
   cp .env.example .env
   ```
   Fill in the project URL, anon (publishable) key and service-role key from Project Settings > API, and pick a local demo password. For a development project, uncomment `CAMPUSBID_ENVIRONMENT=development`: the seed script refuses to run unless it is set to exactly `development`. Never set it for a project that holds real users. The service-role key is used only by `scripts/` and `tests/`; it must never get a `VITE_` prefix or appear in browser code. Never commit `.env`.
5. **Install and seed:**
   ```sh
   npm install
   npm run seed
   ```
6. **Run the app:**
   ```sh
   npm run dev
   ```
   Open http://localhost:5173.

### Day of setup (checklist)

1. Create the free Supabase project (CampusBid only).
2. Apply every file in `supabase/migrations/` in order (SQL Editor, or `npx supabase db push`).
3. Turn off "Confirm email" (Authentication > Sign In / Providers > Email).
4. `cp .env.example .env` and fill in the URL, anon key, service-role key, a demo password and `CAMPUSBID_ENVIRONMENT=development` (development project only).
5. `npm install`, then `npm run setup:check`. It reads `.env` and lists anything missing: tables, functions, the `listing-photos` bucket (private, 5 MB, JPEG/PNG/WebP), "Confirm email" and the demo settings. It never prints your keys. Fix what it lists and run it again until it says everything is in place.
6. `npm run seed`, then `npm test` (the Supabase tests stop being skipped), then `npm run dev`.

Before a demo, `npm run reset:demo` puts the demo data back to its starting state. It deletes only the `@example.test` accounts' listings, requests (including ones they sent to others) and photos, then runs the seed. It refuses to run unless `CAMPUSBID_ENVIRONMENT=development`, so it cannot touch a project that holds real users.

### Demo accounts (local demo only)

`npm run seed` creates these fictional accounts. All use the `DEMO_ACCOUNT_PASSWORD` from your `.env`. They are demo data: exclude every `@example.test` account from pilot metrics, and do not create them on a project that holds real users (the seed refuses to run unless `CAMPUSBID_ENVIRONMENT=development`).

| Email | Name | Role |
| --- | --- | --- |
| admin@example.test | Rosa Villanueva | Admin, approved |
| seller@example.test | Paolo Santos | Approved student (BS IT, Year 4) |
| buyer@example.test | Carla Mendoza | Approved student (BS CE, Year 1) |
| pending@example.test | Miguel Tan | Pending applicant (BS ME, Year 3) |

Running the seed again resets these accounts, including putting the pending applicant back to pending, and replaces the demo listings.

### Demo listings

The seed adds ten fictional listings from the seller and buyer accounts: seven available, two sold (each with a completed request from the buyer) and one withdrawn. Their photos in `scripts/seed-photos/` are plain grey placeholders that read "PLACEHOLDER IMAGE" and "Demo listing. Not a photo of a real item." They are not photos of real items and are not pilot results.

### Regenerating database types

`src/types/database.ts` follows the shape of Supabase's generated types. After changing a migration, regenerate it:

```sh
npx supabase gen types typescript --project-id <your-project-ref> > src/types/database.ts
```

Then re-add the short type aliases at the bottom of the file.

## Checks

```sh
npm run typecheck   # TypeScript, app and scripts/tests
npm run lint        # oxlint
npm run build       # production build
npm test            # integration tests against the Supabase project in .env
npm run test:offline  # SQL access checks on a local in-memory Postgres (no project needed)
npm run setup:check # after .env exists: is the Supabase project ready?
npm run reset:demo  # development project only: reset the demo data
```

`npm test` signs in as the seeded users and calls the real project, so run `npm run seed` first. Without a configured `.env` the tests are reported as skipped. Results so far are in `docs/testing.md`.

## Main flow

Planned demo flow: a seller lists an item with a photo and details, a buyer finds it and sends a purchase request with a proposed campus meetup, the seller accepts (the listing becomes reserved), and after the handover the seller marks it completed (the listing becomes sold). Accounts, approval, listings and the full request flow exist. In the two-browser demo, buyer@example.test sends a request, seller@example.test accepts it under Requests Received, and marks the handover done.

## Known limitations

See `docs/known-issues.md`. In short: the integration tests and seed have not yet been run against a Supabase project.

## Credits

- [React](https://react.dev/), [Vite](https://vite.dev/), [TypeScript](https://www.typescriptlang.org/), [React Router](https://reactrouter.com/)
- [Supabase](https://supabase.com/) (Postgres, Auth, Storage) and `@supabase/supabase-js`
- [Bootstrap](https://getbootstrap.com/) CSS, MIT License
- [Vitest](https://vitest.dev/) and [oxlint](https://oxc.rs/)
- Project scaffold from `create-vite` (react-ts template), with its sample content removed

## Development tools and acknowledgments

AI tools were used during development and are disclosed here as required by the course:

- **Claude Code (Anthropic):** drafted the project setup, database migrations, access rules, React screens, seed script, tests and documentation from the team's written specification, under the team's review.
- **ChatGPT (OpenAI):** used by the team for planning, as a project-management aid and to review progress.

The team is responsible for reviewing, testing and explaining all code in this repository.
