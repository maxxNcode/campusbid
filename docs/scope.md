# Scope and status

Status values: Done (works and checked on Supabase), Partly done, Not started, Cut.

| Promised feature | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Register, sign in, sign out (Supabase Auth) | Partly done | Screens built; checked with stubbed responses | Not yet run against a Supabase project |
| Manual student-status approval with pending/approved states | Partly done | Migration, admin page, offline SQL checks | Integration tests written, not yet run |
| Seeded approved buyer, seller, admin and pending applicant | Partly done | `scripts/seed.ts` | Not yet run |
| Marketplace with search, filters, pagination, empty states | Not started | Empty Browse page only | Phase 2 |
| Create, view, edit listings with photo and condition disclosure | Not started | Table exists | Phase 2 |
| My Listings and withdraw | Not started | | Phase 2 |
| Purchase requests: accept, decline, cancel, complete | Not started | Table exists | Phase 3 |
| Incoming and outgoing request views | Not started | | Phase 3 |
| Admin approval page | Partly done | `src/pages/AdminApprovalsPage.tsx` | Same caveat as the approval flow |

Outside this release (unchanged): auctions, payments and fees, chat and notifications, ratings, multiple campuses, native apps, AI recommendations, maps.
