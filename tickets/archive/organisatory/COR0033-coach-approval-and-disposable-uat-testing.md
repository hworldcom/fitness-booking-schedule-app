# Coordination COR0033: Coach approval and disposable UAT testing

- Status: Completed
- Created: 2026-10-20
- Last updated: 2026-10-20
- Milestone: UAT coach approval and acceptance testing
- Converted from: Not applicable — created directly
- Tracked development tickets: [DEV0386](../../archive/backend/DEV0386-approve-hoang-uat-coach.md), [DEV0387](../../archive/frontend/DEV0387-rehearse-and-clean-up-disposable-uat-users.md)
- Related records: [DEV0385](../../archive/frontend/DEV0385-separate-coach-identity-from-banner.md) (runtime baseline)

## Objective and boundaries

Approve the exact requested Hoang application, then prove core UAT coach/athlete interactions with disposable users and remove their full test footprint. No production/reset/retained-content repair or automatic product fixes.

## Direct development work

| Deliverable                                                                                              | Direct development ticket                                                               | Start condition                                                                                                 |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Exact real-account approval, immutable review and preserved original data                                | [DEV0386](../../archive/backend/DEV0386-approve-hoang-uat-coach.md)                     | Unique confirmed identity/readiness checked; approve first                                                      |
| Tagged dummy cohort, coach/athlete HTTP/native tests, exact cleanup and post-approval preservation proof | [DEV0387](../../archive/frontend/DEV0387-rehearse-and-clean-up-disposable-uat-users.md) | Read-only investigation may start independently; fixture writes wait for approval/baseline and prepared cleanup |

Both required peers exist; no deeper hierarchy or independent agent/branch delegation. Product fixes discovered during QA are separate follow-ups, not hidden scope under this coordination.

## Delivery order and completion conditions

Finish real approval before capturing QA preservation baseline. Run fixture setup, product tests and finally cleanup in that order. Complete coordination only when both peers complete, Hoang is approved with unchanged hidden profile/content and audit evidence, the recorded UAT interaction matrix is finished, and all disposable Auth/business/Storage/session rows are absent with preserved original-data fingerprints.

## Progress and integration record

2026-10-20: Read-only exact-email lookup found confirmed active Hoang, pending revision 1, complete hidden profile with three disciplines and two active training locations. Allocate separate ownership for administrative approval and disposable testing/cleanup before mutations.

2026-10-20: DEV0386 completed. Exact real application is approved, remains hidden, one audit verified, 57-table preservation passed. DEV0387 captures its baseline after this intentional change.

## Validation results

Both direct development records are complete. DEV0386 independently verifies one real approval with hidden visibility and preserved original content. DEV0387 records actual desktop/375×568 coach/athlete interactions and exact fixture cleanup: three functional-cohort users plus three prior setup-attempt users removed, zero remaining temporary Auth/profiles/sessions/Storage, all 57 original table fingerprints match the post-approval baseline, and deployment/environment metadata are unchanged. The test run found one actual booking override failure, recorded in independent [DEV0388](../backend/DEV0388-preserve-accepted-requests-when-rescheduling.md); product fixes are explicitly outside this work map. Completing coordination therefore means approval/testing/cleanup are delivered, not that all product features pass. All 22 affected record links/anchors and four unique paths passed final consistency checks; unrelated workspace changes were preserved. No physical-device/exhaustive QA or final real-account page screenshot is claimed. Native automation became unavailable after the final phone cancellation; committed cancellation and data cleanup were verified separately. Peer records contain detailed results and limitations.

## Risks, limitations, and follow-ups

Do not remove real approval/audit during cleanup or publish the hidden real profile for testing. Disposable users need exact ownership tags/recovery identifiers before creation.

## Completion and review references

- Completed: 2026-10-20 — both direct peers and integrated cleanup/preservation passed.
- Commit: Not applicable — coordination IDs are never commit subjects.
- Review: Integration self-review complete; no independent review requested.
- Deployment or release: Existing UAT only.
