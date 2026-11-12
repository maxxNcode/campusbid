# Known issues

| Issue | Impact | Workaround | Owner | Next action |
| --- | --- | --- | --- | --- |
| Integration tests and seed script have not run against Supabase | Access rules are checked only offline; behaviour on hosted Supabase is unconfirmed | None | Team (create the project) | Create the Supabase project, apply migrations, seed, run `npm test` |
| `src/types/database.ts` was written by hand in the generated format | Could drift from the real schema | Keep it in step with migrations | Nicholas (proposed) | Regenerate with `supabase gen types` once the project exists |
| A rejected applicant cannot reapply with the same email | They must ask an admin | An admin resets the profile in the Supabase dashboard | Team | Decide whether reapplication is needed |
| Screens use plain Bootstrap styling | Not the final design | None | Lance (proposed) | Apply the team's design when supplied |
| Listings, photos, search and purchase requests are not built | The main flow cannot be demonstrated yet | None | Team | Phases 2 and 3 |
| Any approved member can read every approved profile row, including `is_admin`, `reviewed_by` and `reviewed_at` | Minor information exposure between approved members | None needed yet: no screen shows other members' profiles | Team | When Phase 2 first shows seller names, expose other members through a narrow view (id, full name, program) |
| `meetup_at` in the future and a reason on cancelled accepted requests are not checked by table constraints | Could allow invalid requests once request writes exist | Clients have no write access to requests yet | Team | Enforce in the Phase 3 request functions |
