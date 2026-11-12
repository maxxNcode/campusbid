# Metrics

Demo and seed activity is excluded from every metric. All `@example.test` accounts are demo data, as are actions taken during the panel demo.

| Metric | Definition | Target | Current result | Data source |
| --- | --- | --- | --- | --- |
| Completed exchanges | Accepted requests marked completed after a real reported handover. User-reported, not payment-verified. | 5 during a later 7-day pilot, with at least 5 unique buyers and 3 unique sellers | Not yet measurable: the request flow is not built and no pilot has run | `purchase_requests` rows with status `completed`, excluding demo accounts |
| Listing sell-through | Eligible real pilot listings marked sold within 14 days, divided by that cohort's listings | Establish a baseline | Not yet measurable | `listings` created during the pilot window, excluding demo accounts |
| Unaided task success | Users who complete the assigned buyer or seller flow without step-by-step help, divided by users who tried | At least 4 of 5 in Week 6; early sessions reported separately | Not measured: no sessions yet | `docs/feedback-template.md` records |

Checkpoint 1 proposed a ten-user usability check with eight successes. A five-user Week 6 round uses a four-of-five target and does not satisfy the original ten-person sample.
