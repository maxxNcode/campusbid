# Five-minute demo plan

Status: the full flow is built (sign-in, approval, listings, requests, meetups, completion). It has been checked offline and with stubbed responses only. It has not run against a real Supabase project, so the live rehearsal is still to do.

## Script (about five minutes)

| Time | What to show | Proposed presenter |
| --- | --- | --- |
| 0:00–0:45 | The specific campus problem and the Checkpoint 1 classroom design inputs (U01–U05). Say these were design inputs, not usability findings | Mark |
| 0:45–3:45 | Seller lists an item with a photo (seller browser). Buyer searches "calculator", filters, opens the item and sends a request with a campus meetup place and time (buyer browser). Seller opens Requests Received and accepts; the item shows Reserved. Buyer opens My Requests and sees the accepted request and meetup. After the handover the seller marks it handed over; the item shows Sold | Lance, with Nicholas on the second session |
| 3:45–4:30 | Real feedback and the fix it led to, and one known limitation. If no session ran, say validation is pending (see `docs/feedback-template.md`) | Rene |
| 4:30–5:00 | Next test, deferred auctions and payments, and what the team needs from the mentor | Mark |

## Accounts

Fictional demo accounts, created by `npm run seed`; password is `DEMO_ACCOUNT_PASSWORD` from `.env`.

| Use | Account |
| --- | --- |
| Seller | seller@example.test |
| Buyer (second browser profile or private window) | buyer@example.test |
| Admin (approve the pending applicant, if asked) | admin@example.test |
| Pending applicant | pending@example.test |

## Setup before the slot

1. The Supabase project exists and has not paused (free projects pause after inactivity). Open the dashboard once to wake it.
2. `npm run setup:check` says everything is in place.
3. `npm run reset:demo` (development project only) to start from clean demo data.
4. `npm run dev`; sign in as the seller in one browser profile and the buyer in another.
5. Check that listing photos load and that no external CDN is needed (the app bundles its own styles).
6. Have the screenshot set ready. Screenshots come from the real running app; none exist yet.

Do not reset data or run migrations against a database that might hold real user work.

## If something fails

- Photos do not load: the page shows "No photo available" and the flow still works; say so.
- The project is paused or offline: show the backup recording and the screenshots, and say plainly that the live run could not happen.

## Offline demo mode (backup only)

If there is no internet or the Supabase project is unreachable, `npm run demo` runs the same screens on data kept in the browser (see "Offline demo mode" in the README). Use two tabs of the same browser for seller and buyer, or the account switcher in the yellow banner; a private window does not share the data. Press "Reset demo data" before starting.

Say out loud that this is the offline demo mode and not the real database. Demo mode screenshots are **not** Checkpoint 2 or final evidence: evidence comes only from the real app on the Supabase project.

## Backup recording

Not made yet. To make it after the first full real run, record one clean pass of the script above on the demo machine.
