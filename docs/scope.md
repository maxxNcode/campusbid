# Scope and status

Status values: Done (works and checked on Supabase), Partly done, Not started, Cut.

No feature is marked Done yet, because nothing has run against a Supabase project. "Partly done" below means built and checked offline (PGlite SQL checks, stubbed screen runs), with the integration tests written but not run.

| Promised feature | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Register, sign in, sign out (Supabase Auth) | Partly done | Screens built; checked with stubbed responses | Not yet run against a Supabase project |
| Manual student-status approval with pending/approved states | Partly done | Migration, admin page, offline SQL checks | Integration tests written, not yet run |
| Seeded approved buyer, seller, admin and pending applicant | Partly done | `scripts/seed.ts` | Not yet run |
| Marketplace with search, filters, pagination, empty states | Partly done | `src/pages/MarketplacePage.tsx`, `src/lib/listing-search.ts`, `tests/listings.test.ts` | Available items only by default; reserved on request |
| Create, view, edit listings with photo and condition disclosure | Partly done | `ListingFormPage`, `ListingDetailsPage`, listing and storage policies | Photo bucket limits are enforced by Storage, so only checked once the project exists |
| My Listings and withdraw | Partly done | `MyListingsPage`, `withdraw_listing()` | |
| Seeded demo listings (10, with placeholder photos) | Partly done | `scripts/demo-listings.ts`, `scripts/seed-photos/` | Not yet run |
| Purchase requests: send, accept, decline, cancel, complete | Partly done | Migrations `20261120*`, `RequestForm`, `RequestActions`, 166 offline SQL checks, stubbed screen run | Integration tests in `tests/requests.test.ts` written, not yet run. A withdrawn listing is not reopened (see below) |
| Incoming and outgoing request views | Partly done | My Requests, Requests Received, request detail | Same caveat |
| One-step setup check and development-only demo reset | Partly done | `npm run setup:check`, `npm run reset:demo`, `tests/setup-scripts.test.ts` (local stub server) | Checked against a stub, not a real project |
| Admin approval page | Partly done | `src/pages/AdminApprovalsPage.tsx` | Same caveat as the approval flow |

Outside this release (unchanged): auctions, payments and fees, chat and notifications, ratings, multiple campuses, native apps, AI recommendations, maps.

Decision (Day 3, student choice): a withdrawn listing cannot be reopened. The seller lists the item again. Each request also records the price the buyer saw when sending it (`price_seen`), and the request pages show it.
