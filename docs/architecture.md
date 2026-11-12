# Architecture

CampusBid is a single-page React application (TypeScript, Vite, React Router) that talks directly to one hosted Supabase project through `supabase-js`. There is no separate API server.

```text
Browser (React SPA)  --supabase-js-->  Supabase
                                         Auth      email and password accounts
                                         Postgres  tables, RLS policies, functions
                                         Storage   listing photos (Phase 2)
```

The browser is untrusted. It holds only the project URL and the anon key, so every rule is enforced in Postgres:

- **Row Level Security** on every table decides which rows each signed-in user can read or change.
- **Column privileges** limit what a user may update. On `profiles`, users may change only their name, program and year level.
- **Triggers.** `handle_new_user` creates a pending, non-admin profile for every new auth user and ignores any approval or admin values sent from the form. `protect_profile_review_fields` raises an error if a signed-in user tries to change approval or admin fields directly.
- **Functions** for actions that need checks or touch several rows. `review_account()` checks that the caller is an approved admin, locks the target row, and records the reviewer and time. Listing and request status changes (accept, cancel, complete) will also be functions, so each runs in one transaction with the listing row locked.

## Data

```text
auth.users 1──1 profiles
profiles   1──* listings           (listings.seller_id)
categories 1──* listings
listings   1──* purchase_requests  (one per buyer per listing)
profiles   1──* purchase_requests  (purchase_requests.buyer_id)
profiles   1──* profiles           (profiles.reviewed_by, the admin who reviewed)
```

- `profiles`: full_name, program, year_level, is_admin, approval_status (pending/approved/rejected), reviewed_by, reviewed_at. Email and password stay in Supabase's `auth.users`.
- `categories`: name, unique slug.
- `listings`: seller, category, program, title, description, price `numeric(10,2)` (above zero), condition, model_or_edition, included_parts, known_defects (required), photo_path, status (active/reserved/sold/withdrawn).
- `purchase_requests`: listing, buyer, note, status (pending/accepted/declined/cancelled/completed), meetup_place, meetup_at, accepted_at, completed_at, closed_at, closed_reason. The seller is not stored here; it is the listing's seller.

Times are stored as `timestamptz` and shown in Asia/Manila time (`src/lib/format.ts`).

## Code layout

```text
src/pages/            one component per screen
src/components/       layout, route guards, auth provider
src/lib/              Supabase client and small data functions
src/types/            database types
supabase/migrations/  tables, indexes, RLS policies, functions
scripts/              seed script (service-role key, local only)
tests/                Vitest integration tests against the real project
docs/
```
