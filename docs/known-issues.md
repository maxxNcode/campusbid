# Known issues

Open items first, then closed ones. Owners marked "proposed" are not confirmed by the team.

| Issue | Impact | Workaround | Owner | Next action |
| --- | --- | --- | --- | --- |
| No Supabase project exists yet, so the seed, the 51 Supabase integration tests and the full two-session run have never run | Access rules, photo bucket limits, search and the request flow are checked only offline (PGlite) or with stubbed responses; behaviour on hosted Supabase is unconfirmed | None | Team (create the project) | Follow "Day of setup" in the README: `npm run setup:check`, `npm run seed`, `npm test` |
| A true parallel double-accept has not run | The offline database is one connection, so only replays and stale clicks are tested, one after another | The functions lock the listing row with `FOR UPDATE` | Team | `tests/requests.test.ts` runs two accepts in parallel on two connections once `.env` exists |
| The photo bucket's size and type limits are enforced by Supabase Storage, not Postgres | The offline checks confirm only the bucket settings, not that uploads are refused | The form checks type and size first | Team | Confirmed by `npm test` (check 11) once the project exists; `npm run setup:check` confirms the bucket settings |
| The photo bucket checks the declared file type, not the file contents | A non-image could be uploaded with an image type | Photos are shown only in `<img>` tags through short-lived signed links to approved members | Team | Revisit if photos are ever served another way |
| `src/types/database.ts` was written by hand in the generated format | Could drift from the real schema | Keep it in step with migrations | Nicholas (proposed) | Regenerate with `supabase gen types` once the project exists |
| Functions owned by `supabase_admin` (some extension functions) keep Supabase's default grants; the revoke migration covers functions created by `postgres` only | An extension added later may expose functions to `anon` | Check new extension functions after adding one | Team | After the first hosted apply, list functions in `public` that `anon` can execute (query in `docs/testing.md`) |
| A buyer gets one request per item for good, even after a decline or cancel | A buyer whose request was declined or expired cannot ask again for the same item | The buyer sees why in the message | Team | Decide whether a re-request is wanted |
| An expired pending request (meetup time passed) can only be declined | The buyer must be told another way to arrange new times | The seller sees why and declines with a reason | Team | Same decision as the row above |
| A seller can change the price of an available listing after a request arrives and before accepting | The buyer may be accepted at a different price than the one they asked at | Each request stores `price_seen`; the request pages show it and a notice if the price differs | Team | Accepted as is for the pilot; revisit if the panel asks |
| Offline demo mode (`npm run demo`) copies the database rules in TypeScript, without real sign-in, locking or the photo bucket | It could drift from the migrations, and it proves nothing about Supabase | Clearly labelled banner on every page; its own unit tests | Team | Use only as a backup; never as evidence |
| A seller can mark a request completed before the meetup time | The handover may legitimately happen early, so it is allowed | None needed | Team | None |
| A rejected applicant cannot reapply with the same email | They must ask an admin | An admin resets the profile in the Supabase dashboard | Team | Decide whether reapplication is needed |
| Keyword search uses `ilike` on title, description and model/edition, without an index | Fine for hundreds of listings; slower with many thousands | None needed now | Team | Add a trigram or full-text index if the pilot grows |
| Browser Back after a search updates the results but not the text in the search form | The form can briefly show the previous filter values | Press Search or Clear | Team | Fix when the final design is applied |
| Screens use plain Bootstrap styling | Not the final design | None | Lance (proposed) | Apply the design the team supplies |
| No backup recording of the demo exists | If the live demo fails there is nothing to show | The screenshots, once taken from the real app | Team | Record after the first full real run |
| No real usability session (T01 to T03) has happened | Unaided task success is not measured | None | Rene (proposed) | Run and record sessions in `docs/feedback-template.md` |

## Closed

| Closed | Issue | How |
| --- | --- | --- |
| 2026-11-16 | Approved members could read each other's full profile rows | Members read only their own row; other names come from `member_names()` (id and name only) |
| 2026-11-20 | A seller could change an available listing while a request was pending, unnoticed | Each request records `price_seen`, and the request pages show it |
| 2026-11-20 | A withdrawn listing could not be reopened | Student decision: it stays closed and the seller lists the item again (`docs/scope.md`) |
| 2026-11-20 | Meetup time in the future and cancel reasons were not checked by the database | Enforced in the request functions: future time, within 30 days, 07:00 to 20:00 Manila (latest start 20:00:00), reason of 3 to 500 characters for an accepted cancel |
| 2026-11-20 | Cancelling an accepted request on a non-reserved listing skipped the reopen silently | It now raises and changes nothing |
| 2026-11-20 | An expired pending request could be accepted | Accept refuses it; the seller can still decline |
