# Coordination COR0020: Athlete terminology and coach–athlete connections

- Status: In progress
- Created: 2026-10-14
- Last updated: 2026-10-14
- Milestone: M6 — Athlete terminology and coach–athlete connections
- Converted from: Not applicable — created as a coordination record
- Tracked development tickets: [DEV0219 — Adopt athlete terminology and connection contract](../../archive/organisatory/DEV0219-adopt-athlete-connections-contract.md), [DEV0220 — Use athlete terminology on the website](../../archive/frontend/DEV0220-use-athlete-website-terminology.md), [DEV0221 — Persist coach–athlete connections](../backend/DEV0221-persist-coach-athlete-connections.md), [DEV0222 — Add coach My athletes](../frontend/DEV0222-add-coach-my-athletes.md) and [DEV0223 — Add athlete My coaches](../frontend/DEV0223-add-athlete-my-coaches.md)
- Related records: completed scheduling dependency [COR0016](../../archive/organisatory/COR0016-coach-confirmed-booking-requests.md); independent session collaboration [COR0015](COR0015-session-notes-and-training-plans.md); downstream native planning [COR0013](COR0013-native-ios-application.md); downstream account retention [DEV0165](../backend/DEV0165-implement-account-deletion-lifecycle.md)

## Objective and boundaries

Coordinate athlete website terminology and a lasting private coach–athlete connection established by explicit mutual acceptance after a qualifying confirmed session. Either participant may initiate and remove the relationship. My coaches and My athletes contain accepted connections, separately from requests and booking history. This record owns sequence and integration evidence only; the [specification](../../../docs/mvp-spec.md#49-connect-after-a-confirmed-session) owns behavior and direct DEV tickets own implementation.

Runtime scope excludes general messaging, notifications, public athlete profiles, new goals/bio fields, instant rebooking, session-note implementation and native screens. Existing request/session collaboration remains independently participant-scoped whether or not its coach and athlete connect.

## Direct development work

| Implementation part                             | Development ticket                                                                  | Owned deliverable                                                                                                                                                    | Start condition or dependency                                |
| ----------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Product vocabulary and consent/privacy contract | [DEV0219](../../archive/organisatory/DEV0219-adopt-athlete-connections-contract.md) | Adopt the agreed target, lifecycle, media access, acceptance checks and this work map.                                                                               | Completed 2026-10-14.                                        |
| Existing website terminology                    | [DEV0220](../../archive/frontend/DEV0220-use-athlete-website-terminology.md)        | Replace participant-facing vocabulary without changing internal identifiers or capabilities.                                                                         | Completed 2026-10-14; independent of connection persistence. |
| Persistence, authority and private media        | [DEV0221](../backend/DEV0221-persist-coach-athlete-connections.md)                  | Own pair identity, qualifying-booking checks, requests/acceptance/removal, bounded projections, concurrency and revocable connection-scoped athlete-avatar delivery. | After DEV0219; independent of terminology implementation.    |
| Coach connection interface                      | [DEV0222](../frontend/DEV0222-add-coach-my-athletes.md)                             | Own coach request controls and accepted My athletes list with shared-session links.                                                                                  | After DEV0220 and DEV0221.                                   |
| Athlete connection interface                    | [DEV0223](../frontend/DEV0223-add-athlete-my-coaches.md)                            | Own athlete request controls and accepted My coaches list with safe coach/profile/session shortcuts.                                                                 | After DEV0220 and DEV0221.                                   |

All five direct records are flat peers, each with reciprocal membership. Every required part has exactly one owner; no required ticket is missing.

## Other relationships

- COR0016 supplies confirmed bookings, actor identity and cancellation/completion. Connection actions recheck qualifying booking state rather than treating a pending booking request as consent.
- COR0015 independently owns request/session plans and notes. Connections neither gate those participant permissions nor merge content across sessions; it is not required for COR0020 completion.
- COR0013 is a downstream platform consumer. DEV0159 must explicitly decide native connection release membership before native implementation; this web contract does not silently expand TestFlight scope.
- DEV0165 is a downstream retention/deletion consumer; it must account for relationships and authored requests when its contract is adopted. It does not block this web delivery.
- DEV0201/DEV0208 remain independent redesign integration work, with no connection implementation transferred to them.

## Delivery sequence and completion conditions

1. Complete DEV0219 and its documentation validation.
2. DEV0220 and DEV0221 may start independently; each owns its own evidence.
3. Deliver DEV0222 and DEV0223 after the backend and terminology dependencies. They can proceed independently if shared style/action changes remain owned and coordinated.
4. Complete this record only when all direct DEVs are Completed or explicitly cancelled/replaced, and a real persisted two-account mobile/desktop/keyboard rehearsal proves both request directions, explicit acceptance, My coaches/My athletes, confirmed/completed eligibility at sending and acceptance, cancellation invalidation, crossed requests, reload, removal, privacy and accepted-connection survival.
5. Database race and media revocation evidence belongs to DEV0221; interface rehearsals belong to DEV0222/DEV0223. Summarize their integrated result here without duplicating records.

## Progress and integration record

- 2026-10-14: DEV0220 completed athlete website vocabulary, compatible technical identifiers and truthful request/acceptance wording. Application/static/build, real Auth/request, readonly desktop/mobile and 44-pass browser validation completed. Independent DEV0229 corrected existing browser expectations; connection persistence and both interfaces remain Draft.

- 2026-10-14: DEV0220 started website vocabulary implementation after the user reviewed its scope. Connection persistence/interfaces remain separate planned work.

- 2026-10-14: The user chose mutual acceptance and adopted athlete website terminology, either-participant initiation/removal, one pair relationship, accepted-connection survival and bounded name/photo/shared-session visibility.
- 2026-10-14: The user confirmed at least confirmed sessions are required. The contract counts confirmed/completed sessions at both sending and acceptance; cancelled-only history does not qualify.
- 2026-10-14: DEV0219 completed the target contract and documentation checks. Created the flat DEV0219–DEV0223 plan. No connection or terminology runtime code is delivered by this planning change.

## Validation results

DEV0219 completed on 2026-10-14: fifteen-document formatting, local link/anchor/identifier/index/contract checks and diff review passed. Runtime integration is not run and cannot be claimed from contract completion.

## Risks, limitations, and follow-ups

- Connection acceptance adds a private athlete-avatar access boundary; removal must revoke it without weakening independent booking/request permissions.
- Existing approved/demo/suspended capabilities and discovery visibility remain authoritative for actions and rebooking.
- Decline/resend limits, exact schema and UI placement are implementation choices to record before their owning tickets start.

## Completion and review references

- Completed: Not completed.
- Direct development tickets: DEV0219 and DEV0220 Completed; DEV0221–DEV0223 Draft.
- Commit: Not applicable — coordination IDs are not commit subjects.
- Review: No independent review created.
- Deployment or release: Not implemented, deployed or released.
