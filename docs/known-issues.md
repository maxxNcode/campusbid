# Known issues

| Issue | Impact | Workaround | Owner | Next action |
| --- | --- | --- | --- | --- |
| Integration tests and seed script have not run against Supabase | Access rules, the photo bucket limits and search are checked only offline or with stubs; behaviour on hosted Supabase is unconfirmed | None | Team (create the project) | Create the Supabase project, apply migrations, seed, run `npm test` |
| The photo bucket's size and type limits are enforced by Supabase Storage, not Postgres | The offline checks only confirm the bucket settings, not that uploads are refused | The form checks type and size first | Team | Confirmed by `npm test` (check 11) once the project exists |
| `src/types/database.ts` was written by hand in the generated format | Could drift from the real schema | Keep it in step with migrations | Nicholas (proposed) | Regenerate with `supabase gen types` once the project exists |
| A rejected applicant cannot reapply with the same email | They must ask an admin | An admin resets the profile in the Supabase dashboard | Team | Decide whether reapplication is needed |
| Screens use plain Bootstrap styling | Not the final design | None | Lance (proposed) | Apply the team's design when supplied |
| A withdrawn listing cannot be made available again | The seller must list the item again | Create a new listing | Team | Student decision on 2026-11-20: stays closed; the seller lists the item again |
| Keyword search uses `ilike` on title, description and model/edition, without an index | Fine for a pilot with hundreds of listings; slower with many thousands | None needed now | Team | Add a trigram or full-text index if the pilot grows |
| Browser Back after a search updates the results but not the text in the search form | The form can briefly show the previous filter values | Press Search or Clear | Team | Fix when the final design is applied |
| A seller can change the price or details of an available listing while a buyer's request is pending | The buyer may have asked at a different price | Closed on 2026-11-20 | Team | Each request stores `price_seen`; the request pages show it and note a later change |
| The photo bucket checks the declared file type, not the file contents | A non-image could be uploaded with an image type | Photos are only shown in `<img>` tags through short-lived signed links to approved members | Team | Revisit if photos are ever served another way |
| Functions owned by `supabase_admin` (for example some extension functions) keep Supabase's default grants; the revoke migration covers functions created by `postgres` only | An extension added later may expose functions to `anon` | Check new extension functions after adding one | Team | After the first hosted apply, list functions in `public` that `anon` can execute (query in `docs/testing.md`) |
| `meetup_at` in the future and a reason on cancelled accepted requests are not checked by table constraints | Could allow invalid requests once request writes exist | Enforced in the request functions (future time, within 30 days, 07:00 to 20:00 Manila, reason of 3 to 500 characters) | Team | Confirm on Supabase with `npm test` |

Closed on 2026-11-16: approved members could read each other's full profile rows (Day 1 review, minor item 5). Members now read only their own row; other members' names come from `member_names()`, which returns id and full name only.
| Offline checks cannot run two database sessions at once (PGlite is one connection) | A true parallel double-accept is not tested offline; only replays and stale clicks are, one after the other | The functions lock the listing row with `FOR UPDATE` | Team | `tests/requests.test.ts` runs two accepts in parallel on two connections once `.env` exists |
| Request integration tests (checks 4 to 10 and the meetup part of 11) have not run | Behaviour on hosted Supabase is unconfirmed | None | Team | Run `npm test` after the project exists |
| A buyer gets one request per item for good, even after a decline or cancel | A buyer whose request was declined cannot ask again for the same item | The buyer sees why in the message | Team | Decide whether a re-request is wanted |
