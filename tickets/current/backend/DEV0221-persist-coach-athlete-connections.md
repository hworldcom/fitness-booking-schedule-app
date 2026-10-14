# Ticket DEV0221: Persist coach–athlete connections

- Status: Draft
- Created: 2026-10-14
- Last updated: 2026-10-14
- Milestone: M6 — Athlete terminology and coach–athlete connections
- Coordination: [COR0020 — Athlete terminology and coach–athlete connections](../organisatory/COR0020-athlete-terminology-and-connections.md)
- Related records: contract dependency [DEV0219 — Adopt athlete terminology and connection contract](../../archive/organisatory/DEV0219-adopt-athlete-connections-contract.md); coach consumer [DEV0222](../frontend/DEV0222-add-coach-my-athletes.md); athlete consumer [DEV0223](../frontend/DEV0223-add-athlete-my-coaches.md); account-retention follow-up [DEV0165](DEV0165-implement-account-deletion-lifecycle.md)

## Objective and context

Add server-authoritative mutual connection requests and accepted relationships for existing coach/athlete pairs, including explicit connection-scoped private athlete-media access. Implement against the [current specification](../../../docs/mvp-spec.md#49-connect-after-a-confirmed-session); this ticket is a plan, not evidence of delivered behavior.

## Scope and non-goals

- In scope: additive persistence, one active relationship per coach/athlete pair, bounded participant projections, send/accept/decline/withdraw/remove actions, qualifying-booking checks, concurrency/retry authority, connection-scoped avatar delivery, complete paginated shared request/booking-history references across reconnection and database/service tests.
- Out of scope: interface implementation, public athlete directory, goals/bio fields, chat, notifications, session-note persistence, account deletion and legacy schema removal.

## Expected behavior and edge cases

- Send and accept derive the actor and recheck one shared confirmed/completed booking; pending requests and cancelled-only history fail. New actions require approved/demo coach authority; existing removal/decline/withdraw/read actions remain bounded after suspension.
- Only the recipient accepts/declines and only the sender withdraws. Either accepted participant disconnects. Repeating the same operation returns its authoritative result; stale old requests cannot accept a newer relationship. Disconnecting never cascades into deleting/resetting shared requests, bookings or conversation content.
- Crossed pending requests return the existing pending state and require explicit recipient acceptance; sending does not silently accept.
- Cancellation racing with acceptance is serialized so the qualifying-booking check and relationship write reflect one authoritative outcome. Existing accepted relationships survive later cancellation/completion.
- Accepted projections show bounded participant presentation and a complete paginated catalogue of shared request/booking references for the exact pair, including pending/accepted/declined/withdrawn/expired/not-selected requests and confirmed/completed/cancelled bookings. The coach receives only the athlete name and a bounded opaque avatar URL. Removal revokes connection-derived media/history access; independent booking/request permissions remain intact.
- A fresh eligible request and explicit acceptance restore that catalogue using original request/booking identifiers and statuses, across repeated disconnect/reconnect cycles. Link an accepted request to its resulting booking without duplicating the continuing conversation. Pagination exposes all retained history; a display page limit cannot silently discard older records.
- COR0015 owns shared conversation/plan/note persistence and rendering. This ticket provides stable authorised history references and never copies or resets content on reconnection; conversation-body recovery is verified jointly after COR0015 delivery. Coach-private content never enters the shared catalogue.
- Self, cross-dataset, unrelated-account and malformed operations fail without mutation; ordinary athletes never receive private coach notes or unrelated sessions.

## Assumptions, decisions, and dependencies

- DEV0219 supplies the contract; inspect existing session verification, actor-scoped repositories, scheduling locks and media routes before design.
- Proposed defaults (not additional user decisions): terminal request attempts, explicit crossed-request acceptance and one active pair identity with request-attempt history.
- Record exact schema, action result shapes, bounded pagination and proposed retry/resend limits before schema edits. No new dependency is assumed.

## Implementation plan

1. Review installed database/Next.js integration versions and documentation; define pair identity, status/attempt versions, grants and lock order shared with booking cancellation.
2. Add forward-safe migrations and exact actor-checked functions for eligibility, requests, acceptance and removal.
3. Add server/domain services, bounded list/history projections and authenticated connection-scoped normalized-avatar delivery with revocable caching. Define cursor-complete request/booking-history references independent of connection-attempt identity; preserve selected-request/booking continuity and terminal status. Conversation persistence/rendering remains COR0015.
4. Add authority, fresh/upgrade migration, concurrency, media and unavailable-provider validation; document forward recovery.

## Acceptance criteria

- [ ] AC1: Only either participant in a qualifying confirmed/completed pair can send; only the recipient can accept; sending and acceptance both enforce booking and coach eligibility.
- [ ] AC2: Database uniqueness and concurrent/crossed/replayed decisions never create duplicate relationships, implicit consent or stale-request acceptance; cancellation races are authoritative.
- [ ] AC3: Only accepted participants receive bounded pair data, and athlete avatar bytes are coach-scoped; removal immediately revokes connection-derived access while independent permissions survive.
- [ ] AC4: Decline, withdrawal, either-participant disconnection, accepted-connection survival, empty/unavailable state and pagination behave deterministically without altering scheduling. Fresh accepted reconnection restores all retained shared request/booking references, including unsuccessful/cancelled history and older pages, with original identifiers/statuses, no deletion/reset and no duplicate accepted-request thread.
- [ ] AC5: Fresh/upgrade migration, database authorization/concurrency, media/service tests, existing regressions, lint, type-check and build pass with recorded evidence.

## Validation plan

Create multi-page exact-pair history spanning unsuccessful request states and cancelled/completed/confirmed bookings; disconnect from each side and mutually reconnect more than once. Compare retained IDs/statuses and complete cursor traversal, check fresh eligibility after cancelled-only history, selected-request/booking de-duplication, stale attempt denial and unrelated/private-data exclusion. COR0015 owns conversation bytes and author/status permissions; combined conversation recovery is a later integration check rather than fabricated evidence here.

Use pgTAP/runtime-role and service tests for unrelated actors, role states, pending-only/cancelled-only/confirmed/completed bookings, dataset boundaries, self requests, duplicate/crossed sends, stale attempts, retries and acceptance/cancellation/removal races. Test connection-scoped image bytes before acceptance, during acceptance and after removal, including an independently authorized booking route and Storage failure. Validate fresh replay and additive upgrade on disposable local databases; never reset hosted data. Run `npm test`, `npm run test:db`, `npm run db:test`, `npm run db:lint`, lint, type-check, formatting, build and diff checks.

## Implementation record

Pending implementation.

### Changes and rationale

Pending implementation.

### Affected files

| File or component | Change and purpose                                                             |
| ----------------- | ------------------------------------------------------------------------------ |
| Pending           | Record actual repository-relative files and their roles during implementation. |

### Decisions and deviations

2026-10-14: [DEV0230](../../archive/organisatory/DEV0230-adopt-reconnection-history-recovery.md) records the user-confirmed full shared-history requirement. Reconnection recovers retained request/booking references independently of connection attempt; future conversations remain owned by COR0015 and keep original permissions.

### Contracts, configuration, and operations

New additive connection persistence, bounded projections/mutations and a connection-scoped media contract are planned. Exact schema/API/rollback notes must be recorded before implementation. Reuse existing server-only database/Auth/Storage configuration; no new secret or dependency is planned.

## Validation results

Pending validation; all runtime checks are not run.

| Criterion | Evidence               | Result  |
| --------- | ---------------------- | ------- |
| AC1       | Pending implementation | Not run |
| AC2       | Pending implementation | Not run |
| AC3       | Pending implementation | Not run |
| AC4       | Pending implementation | Not run |
| AC5       | Pending implementation | Not run |

## Risks, limitations, and follow-ups

Consent must not be inferred from a crossed request or button state. Media/cache revocation and lock ordering against booking cancellation require real database tests. Account deletion/retention remains DEV0165; no retention period is invented here. Next action: design the exact persistence and locking contract after DEV0219.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: No independent review created.
- Deployment or release: Not deployed or released.
