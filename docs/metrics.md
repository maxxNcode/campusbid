# Metrics

Demo and seed activity is excluded from every metric. All `@example.test` accounts are demo data, as are actions taken during the panel demo. A pilot count must filter out those accounts (and any other account the team marks as a tester).

| Metric | Definition | Target | Current result | Data source and collection method |
| --- | --- | --- | --- | --- |
| Completed exchanges | Accepted requests marked completed after a real reported handover. User-reported, not payment-verified | 5 during a later 7-day pilot, with at least 5 unique buyers and 3 unique sellers | Not yet measurable: the request flow is built, but no pilot has run and the app has not run on a real project | Count `purchase_requests` rows with status `completed` in the pilot window, excluding `@example.test` accounts; count distinct `buyer_id` and distinct listing sellers |
| Listing sell-through | Eligible real pilot listings marked sold within 14 days, divided by that cohort's listings | Establish a baseline; no percentage is claimed | Not yet measurable: a 14-day window cannot fit in the build days | Take real listings created in the pilot window, excluding demo accounts; after 14 days divide those with status `sold` by the cohort size. Report the cohort size next to the percentage |
| Unaided task success | Users who complete the assigned buyer or seller flow without step-by-step help, divided by users who tried | At least 4 of 5 in Week 6; early sessions reported separately | Not measured: no session has happened (T01 to T03 are blank) | Record each real session in `docs/feedback-template.md` (task given, success yes/no, where they were confused, consent kept outside Git). Count successes over participants |

Checkpoint 1 proposed a ten-user usability check with eight successes. A five-user Week 6 round uses a four-of-five target and does not satisfy the original ten-person sample.

The Checkpoint 1 classroom responses (U01 to U05) are design inputs. They are not usability sessions and are not counted in any metric above.
