# Architecture

CampusBid is a single-page React application (TypeScript, Vite, React Router) that talks directly to one hosted Supabase project through `supabase-js`. There is no separate API server.

```text
Browser (React SPA)  --supabase-js-->  Supabase
                                         Auth      email and password accounts
                                         Postgres  tables, RLS policies, functions
                                         Storage   listing photos (private bucket)
```

The browser is untrusted. It holds only the project URL and the anon key, so every rule is enforced in Postgres:

- **Row Level Security** on every table decides which rows each signed-in user can read or change.
- **Column privileges** limit what a user may write. On `profiles`, users may change only their name, program and year level. On `listings`, they may write the descriptive fields only; `seller_id` comes from its default (`auth.uid()`) and `status` starts as `active`, and neither column can be sent by a client.
- **Triggers.** `handle_new_user` creates a pending, non-admin profile for every new auth user and ignores any approval or admin values sent from the form. `protect_profile_review_fields` raises an error if a signed-in user tries to change approval or admin fields directly.
- **Functions** for actions that need checks or touch several rows. `review_account()` checks that the caller is an approved admin, locks the target row, and records the reviewer and time. `withdraw_listing()` locks the listing row, checks the caller owns it and that it is still available, cancels its pending requests with a reason and marks it withdrawn. The request status changes in Phase 3 (accept, cancel, complete) will follow the same pattern and lock order: the listing row first, then its requests.
- **Narrow read function.** Members read only their own profile row. Seller names come from `member_names()`, which returns just the id and full name of approved members to an approved caller.

## Listing photos

Photos live in the private `listing-photos` bucket. The bucket allows JPEG, PNG and WebP up to 5 MB; Storage refuses anything else. Storage policies let approved members read photos, and let them upload only into a folder named after their own user id under a generated name (`<user id>/<random uuid>.<jpg|png|webp>`), so the uploader's file name is never used. A listing's `photo_path` must point into the seller's own folder. The browser shows photos through signed links that expire after an hour. The form checks type and size before uploading, for a clear message.

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
src/lib/              Supabase client, data functions, listing rules and search
src/types/            database types
supabase/migrations/  tables, indexes, RLS policies, functions
scripts/              seed script and demo data (service-role key, local only)
scripts/seed-photos/  plain labelled placeholder images for the demo listings
tests/                Vitest integration tests against the real project
tests/offline/        SQL checks of the migrations on in-memory Postgres
docs/
```
