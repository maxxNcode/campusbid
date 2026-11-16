# Known issues

| Issue | Impact | Workaround | Owner | Next action |
| --- | --- | --- | --- | --- |
| Integration tests and seed script have not run against Supabase | Access rules, the photo bucket limits and search are checked only offline or with stubs; behaviour on hosted Supabase is unconfirmed | None | Team (create the project) | Create the Supabase project, apply migrations, seed, run `npm test` |
| The photo bucket's size and type limits are enforced by Supabase Storage, not Postgres | The offline checks only confirm the bucket settings, not that uploads are refused | The form checks type and size first | Team | Confirmed by `npm test` (check 11) once the project exists |
| `src/types/database.ts` was written by hand in the generated format | Could drift from the real schema | Keep it in step with migrations | Nicholas (proposed) | Regenerate with `supabase gen types` once the project exists |
| A rejected applicant cannot reapply with the same email | They must ask an admin | An admin resets the profile in the Supabase dashboard | Team | Decide whether reapplication is needed |
| Screens use plain Bootstrap styling | Not the final design | None | Lance (proposed) | Apply the team's design when supplied |
| Purchase requests are not built | The item page explains this; the request half of the demo cannot be shown yet | None | Team | Phase 3 |
| A withdrawn listing cannot be made available again | The seller must list the item again | Create a new listing | Team | Decide whether "relist" is needed |
| Keyword search uses `ilike` on title, description and model/edition, without an index | Fine for a pilot with hundreds of listings; slower with many thousands | None needed now | Team | Add a trigram or full-text index if the pilot grows |
| Browser Back after a search updates the results but not the text in the search form | The form can briefly show the previous filter values | Press Search or Clear | Team | Fix when the final design is applied |
| `meetup_at` in the future and a reason on cancelled accepted requests are not checked by table constraints | Could allow invalid requests once request writes exist | Clients have no write access to requests yet | Team | Enforce in the Phase 3 request functions |

Closed on 2026-11-16: approved members could read each other's full profile rows (Day 1 review, minor item 5). Members now read only their own row; other members' names come from `member_names()`, which returns id and full name only.
