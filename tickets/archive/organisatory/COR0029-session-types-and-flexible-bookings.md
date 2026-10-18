# Coordination COR0029: Session types and flexible bookings

- Status: Completed
- Created: 2026-10-18
- Last updated: 2026-10-18
- Milestone: M11 — Session types and flexible bookings
- Converted from: Not applicable — DEV0257 already has planning implementation/commit history and remains the contract owner.
- Tracked development tickets: DEV0257 and DEV0340–DEV0346 below.
- Related records: historical calendar COR0023; external group lifecycle COR0021; current website/URL work COR0028; retained-demo integrity DEV0337. None is a direct member.

## Objective and boundaries

Coordinate coach-owned session types, 60/75/90-minute athlete requests, coach manual booking/individual overrides, removable default Private/Group types and preserved history. This record implements no runtime behavior. See [the current contract](../../../docs/mvp-spec.md#186-session-types-and-flexible-bookings).

## Direct development work

| Implementation part                              | Development ticket                                                                 | Owned deliverable                                                                                                                                                                                 | Start condition                                                                     |
| ------------------------------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Contract and adopted choices                     | [DEV0257](DEV0257-define-reusable-session-types.md)                                | Specification, choices and flat ownership                                                                                                                                                         | User decisions received; existing planning history retained.                        |
| Persist coach session types                      | [DEV0340](../backend/DEV0340-persist-coach-session-types.md)                       | Catalogue schema, strict domain/API contracts, owner revisions, archival and new-coach Private/Group defaults.                                                                                    | DEV0257 contract adopted; independent of public/calendar UI.                        |
| Manage coach session types                       | [DEV0341](../frontend/DEV0341-manage-coach-session-types.md)                       | Owner create/edit/remove/restore interface, explicit defaults for existing coaches and entry link from Schedule.                                                                                  | DEV0340 persistence/API.                                                            |
| Book duration-aware session types                | [DEV0342](../backend/DEV0342-book-duration-aware-session-types.md)                 | Type/venue-bound availability candidates, 15-minute starts, 60/75/90-minute requests/acceptance, direct coach booking and per-booking override, snapshots and cross-format coach-time protection. | DEV0340; existing one-hour/request/group locks and durable message/booking history. |
| Select session types and available times         | [DEV0343](../frontend/DEV0343-select-session-types-and-available-times.md)         | Coach type/venue availability assignment and athlete type-first time selection/request, truthful duration and archive/unavailable recovery.                                                       | DEV0341 and DEV0342; preserve current public URL ownership.                         |
| Manage individual coach bookings                 | [DEV0344](../frontend/DEV0344-manage-individual-coach-bookings.md)                 | Coach books for an accepted athlete and changes one future booking time/duration/active venue with explicit review and revision conflict recovery.                                                | DEV0342 and existing athlete/booking routes.                                        |
| Integrate session types with groups and calendar | [DEV0345](../frontend/DEV0345-integrate-session-types-with-groups-and-calendar.md) | Type snapshot integration in group drafts/public selection/registration and calendar labels/filter; type removal blocks new use while preserving existing sessions.                               | DEV0340/DEV0342; group lifecycle and calendar remain separate formats.              |
| Rehearse session types and flexible bookings     | [DEV0346](../backend/DEV0346-rehearse-session-types-and-flexible-bookings.md)      | Combined disposable-dataset proof, fresh/retained-schema upgrade compatibility, scoped deployment readiness and final documentation evidence.                                                     | DEV0340–DEV0345 completed.                                                          |

Every required deliverable has one direct peer above; no missing implementation ticket and no DEV child hierarchy. Backend ownership in DEV0342 includes shared duration/coach-time authority; group template/registration/calendar integration belongs only to DEV0345.

## Other relationships

COR0023 is a completed historical baseline and is not reopened. COR0021 owns existing group lifecycle rules; this work integrates them without taking over min/max/manual decisions. COR0028 owns public branding/pricing/reviews/username routing and is an external consumer/integration boundary. DEV0337 is a retained-data prerequisite: no startup seeding, marker-based reset or retained-account fixture changes.

## Delivery sequence and completion conditions

Adopt DEV0257, then implement DEV0340. DEV0341 may proceed after catalogue authority is stable; DEV0342 can proceed in parallel with that owner UI without shared schema edits. DEV0343/DEV0344 follow duration authority. DEV0345 follows catalogue and time guards; keep group/calendar source changes sequential with their owners. DEV0346 runs last against the integrated result. No other peer's status substitutes for a required direct deliverable. Close this COR only after all direct tickets complete/cancel with explicit replacement and the combined type/create/edit/remove, private/group selection, booking/override, history/privacy and preservation proof passes.

## Progress and integration record

2026-10-18: User selected 60/75/90-minute offerings, type-first athlete selection, coach booking/individual overrides and removable default Private/Group types. Existing DEV0257 retained as contract owner; runtime split into flat peers. Initial implementation starts with DEV0340. Nothing here implies an installed schema, deployed interface or rewritten historical data.

## Validation results

DEV0257 completed reciprocal membership/link/namespace review. Runtime evidence belongs to each peer and final combined proof to DEV0346.

## Risks, limitations, and follow-ups

One-hour generation, acceptance checks and overlap constraints must change together. No type field can promise 75/90-minute booking until the authority and public flow ship. Archive/edit snapshots and existing untyped appointments remain retained. Current profile/navigation/public-page edits are integration boundaries, not permission to overwrite them.

## Completion and review references

- Completed: 2026-10-18 — all eight direct peers completed and combined local criteria passed.
- Direct development tickets: DEV0257 and DEV0340–DEV0346 Completed.
- Commit: Not applicable — COR identifiers are not commit subjects.
- Review: Reciprocal scope/ownership and integration self-review complete; no independent review.
- Deployment or release: Local schema only; no hosted rollout.

### Implementation checkpoint

DEV0340–DEV0346 are In progress. Catalog and duration-aware private/group authority are implemented with disposable database proof; owner/public/coach booking/group/calendar interfaces are implemented and undergoing combined browser/static/build verification. DEV0348 independently owns pre-migration public-profile compatibility and is preserved as an external integration boundary. Retained local/hosted databases have not been migrated by this task. Required completion remains all seven runtime peers and the combined proof; no runtime release is claimed by this checkpoint.

### Final integration review — 18 October 2026

All eight direct peers are Completed. DEV0346 owns fresh/upgrade/pre-extension compatibility, 359 unit/server tests, final lint/type/production-build proof and 14 real browser checkpoints at desktop/375/430px, including lost-response retry, stale save, keyboard removal/restoration and original confirmed-session access. Combined database proof covers full-fit durations, horizon/DST, one-winner overlaps, manual booking/override/audit, pending-request closure, group publication/registration retention and filtered calendar paging. Local migrations 007–009 passed all 50 retained application/Auth-table fingerprints and created no retained-coach defaults. No required deliverable is unowned or deferred to an external ticket. DEV0348 remains the separate public-profile compatibility owner; COR0021/COR0028 remain external integration boundaries. Hosted rollout and independent review are not claimed.

2026-10-18 commit checkpoint: the completed peers and external DEV0348 compatibility repair are included together in the user-authorized, isolated-index checkpoint. DEV0346 records the exact candidate tests/build and scope checks; active Auth/directory work remains excluded. No hosted rollout or independent review.
