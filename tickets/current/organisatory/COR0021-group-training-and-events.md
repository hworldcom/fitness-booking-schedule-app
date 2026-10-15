# Coordination COR0021: Group training and events

- Status: In progress
- Created: 2026-10-15
- Last updated: 2026-10-15
- Milestone: M7 — Group training and events
- Converted from: Not applicable — DEV0233 already has committed planning evidence and retains its identity/scope
- Tracked development tickets: [DEV0233](../../archive/organisatory/DEV0233-define-group-training-and-events-growth-scope.md), [DEV0237](../backend/DEV0237-persist-group-session-registration.md), [DEV0238](../backend/DEV0238-integrate-group-session-scheduling-conflicts.md), [DEV0239](../frontend/DEV0239-add-coach-group-session-management.md), [DEV0240](../frontend/DEV0240-add-group-event-discovery-and-joining.md), [DEV0241](../backend/DEV0241-rehearse-group-training-and-event-loop.md)
- Related records: independent Explore preview [DEV0235](../frontend/DEV0235-preview-home-aligned-explore.md), independent Explore implementation [DEV0236](../../archive/frontend/DEV0236-align-explore-with-home-discovery.md); existing private scheduling and connection contracts are compatibility baselines, not group implementation

## Objective and boundaries

Coordinate the [group-training contract](../../../docs/mvp-spec.md#15-group-training-and-events): coaches create single-date Free or EUR pay-at-session activities; athletes join directly and reserve one seat; the owning coach confirms or cancels manually. Reaching a minimum never silently confirms the activity. Group participation creates no payment/attendance proof, private booking or coach–athlete connection.

This record implements no runtime behavior. The contract owner distinguishes the user's confirmed choices from adopted implementation defaults. Backend schedule guards must exist before any coach/public interface can publish events.

## Direct development work

| Implementation part                | Development ticket                                                                             | Owned deliverable                                                                                                                                                          | Start condition or dependency                                            |
| ---------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Product contract and work map      | [DEV0233](../../archive/organisatory/DEV0233-define-group-training-and-events-growth-scope.md) | Scope, confirmed/default decisions, lifecycle/privacy/conflict contract, M7 and acceptance scenarios, README navigation and flat ticket ownership                          | Finish before runtime work                                               |
| Group domain and registration      | [DEV0237](../backend/DEV0237-persist-group-session-registration.md)                            | New nonfinancial data, owner drafts, direct one-seat joining/withdrawal, manual confirmation/cancellation, deadline reconciliation and bounded projections/tests           | Completed DEV0233 contract; publication unavailable until DEV0238        |
| Cross-product time authority       | [DEV0238](../backend/DEV0238-integrate-group-session-scheduling-conflicts.md)                  | Guarded publication, coach-wide time reservations, private occurrence/materialization/reopen compatibility and real concurrency tests                                      | Stable DEV0237 records/lifecycle                                         |
| Coach event interface              | [DEV0239](../frontend/DEV0239-add-coach-group-session-management.md)                           | Coach Events navigation, draft/review/publish, private roster and explicit confirmation/cancellation/conflict recovery                                                     | DEV0237 and DEV0238 completed                                            |
| Public and athlete event interface | [DEV0240](../frontend/DEV0240-add-group-event-discovery-and-joining.md)                        | Public Events navigation/list/detail, filters/share links, direct join/withdraw and own Group sessions destination                                                         | DEV0237 and DEV0238 completed; sequence shared visual edits with DEV0236 |
| Integrated local proof             | [DEV0241](../backend/DEV0241-rehearse-group-training-and-event-loop.md)                        | Reproducible multi-account free/paid-at-session web rehearsal, privacy/concurrency/scheduling and responsive recovery evidence, guarded cleanup and delivery documentation | DEV0237–DEV0240 completed                                                |

All required implementation tickets exist and are peers. Detailed evidence belongs to each DEV record. No part is implemented under this coordination record or under DEV0235/DEV0236.

## Other relationships

- DEV0235 is an illustrative Explore preview. Its blocked standalone browser validation is not a group backend dependency and cannot be claimed as group UI evidence.
- DEV0236 owns Home-aligned Explore components/styles and canonical coach discovery. DEV0240 may reuse stable delivered components and follows it where shared files are involved; group data/routes and Events navigation remain DEV0240. DEV0236 delivers no required group outcome and is not a direct member.
- Existing private scheduling and connections remain authoritative. DEV0238 alone owns group/private time integration; group attendance/registration does not qualify a connection or grant private-session/media access. COR0015 session collaboration and later account-retention work remain separate.
- The separate hackathon branch and pruned funding records are historical context only. This work reads no legacy funding data and requires no blockchain, wallet or real-payment rehearsal.

## Delivery sequence and completion conditions

1. Complete DEV0233's documentation contract and reciprocal work map, preserving its committed identifier rather than converting it.
2. Implement DEV0237, then DEV0238. No publication bypass or externally reachable group UI ships between them.
3. DEV0239 and DEV0240 are independent frontend peers after both backend tickets pass. Sequence DEV0240's shared visual/navigation edits after the active DEV0236 work to avoid conflicting edits; backend and coach management can proceed independently of that Explore work.
4. Run DEV0241 last with multiple real local accounts, free and pay-at-session cases, manual confirmation and missed-deadline behavior, group/private collisions and UI privacy/recovery.
5. Complete this coordination only when every direct DEV is Completed or explicitly cancelled/replaced, reciprocal links/statuses agree, the current contract's group acceptance scenarios and integrated local proof pass, and the delivered-versus-planned documentation is accurate. Runtime proof is still required even when contract planning is complete. Hosted deployment is separately authorized operational work.

## Progress and integration record

- 2026-10-15: Compared DEV0233 with DEV0235/DEV0236 and found separate owned outcomes. Created a flat work map while preserving the existing committed DEV0233. The user selected direct joining with manual coach confirmation/cancellation after having selected free/pay-at-session pricing.
- 2026-10-15: Adopted implementation defaults for explicit decision deadlines, no implicit confirmation, missed-decision expiry, withdrawal, immutable published terms, privacy and coach scheduling conflicts. Exact behavior is in the specification, not duplicated as a second product contract here.
- Runtime implementation has not started. No group capability is claimed delivered from ticket creation or the existing Explore work.

## Validation results

2026-10-15: DEV0233 completed the adopted contract and work map. `python3 /tmp/dev0233-check-growth-contract.py` passed 257 relative links, 33 anchors, 147 unique records, six reciprocal direct DEV members, unique work-map rows and metadata/index/retained-Explore checks. Targeted Prettier and `git diff --check` passed; the checks are repeated after contract archival. Integrated runtime evidence remains DEV0241 and is not run.

After archival, the same checker passed 270 links and 34 anchors across all eleven affected Markdown files, including the DEV0225 link repair; record/member/ownership checks and formatting/whitespace checks also passed. DEV0233 is Completed, DEV0237 is Ready and all later runtime peers retain their dependency gates.

## Risks, limitations, and follow-ups

Manual decisions and status are in-app only; no email/push delivery is promised. Pay-at-session registration proves neither attendance nor payment, and confirmed sessions can lose participants through withdrawal. Coach time must be reserved across locations and recurring materialization, not only checked in the browser. Runtime tickets remain open and block coordination completion.

## Completion and review references

- Completed: Not completed — runtime delivery and integration pending.
- Direct development tickets: DEV0233 Completed; DEV0237 Ready; DEV0238–DEV0241 Draft pending dependencies.
- Commit: Not applicable — coordination IDs are not used in commit subjects.
- Review: Planning self-review only; no independent or runtime review.
- Deployment or release: None.
