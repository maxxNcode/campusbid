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
| Purchase requests: accept, decline, cancel, complete | Not started | Table exists | Phase 3 |
| Incoming and outgoing request views | Not started | | Phase 3 |
| Admin approval page | Partly done | `src/pages/AdminApprovalsPage.tsx` | Same caveat as the approval flow |

Outside this release (unchanged): auctions, payments and fees, chat and notifications, ratings, multiple campuses, native apps, AI recommendations, maps.
