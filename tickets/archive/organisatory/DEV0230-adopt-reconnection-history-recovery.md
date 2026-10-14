# Ticket DEV0230: Adopt reconnection history recovery

- Status: Completed
- Created: 2026-10-14
- Last updated: 2026-10-14
- Milestone: M6 — Athlete terminology and coach–athlete connections
- Coordination: [COR0020 — Athlete terminology and coach–athlete connections](../../current/organisatory/COR0020-athlete-terminology-and-connections.md)
- Related records: historical contract baseline [DEV0219](DEV0219-adopt-athlete-connections-contract.md); persistence peer [DEV0221](../../current/backend/DEV0221-persist-coach-athlete-connections.md); interface peers [DEV0222](../../current/frontend/DEV0222-add-coach-my-athletes.md) and [DEV0223](../../current/frontend/DEV0223-add-athlete-my-coaches.md); independent conversation delivery [COR0015](../../current/organisatory/COR0015-session-notes-and-training-plans.md); account-retention follow-up [DEV0165](../../current/backend/DEV0165-implement-account-deletion-lifecycle.md)

## Objective and context

Make disconnect/reconnect history continuity explicit in the [current product contract](../../../docs/mvp-spec.md#49-connect-after-a-confirmed-session). The existing connection plan preserves bookings and independent session permissions but does not explicitly require a complete shared-history view after reconnecting. On 2026-10-14 the user confirmed that either participant can disconnect and that reconnecting must recover everything previously shared between the same coach and athlete, including conversations attached to declined or withdrawn booking requests.

This development ticket owns documentation changes only. A conversation is a shared request/session thread; it retains its original request or booking context. Conversation runtime remains separately owned by COR0015.

## Scope and non-goals

- In scope: update the confirmed decision register, connection flow/state/acceptance contract, COR0020 delivery map, DEV0221–DEV0223 scope and validation, and COR0015/DEV0182–DEV0185 preservation requirements; maintain the index and reciprocal membership.
- Out of scope: runtime implementation, migrations, new ongoing chat, message notifications, new navigation, retention-period decisions, account deletion and unrelated Home planning.

## Expected behavior and edge cases

- Either accepted participant may disconnect. The action ends the connection and revokes connection-derived access; it never deletes or resets shared request/booking records, conversations, shared plans or shared notes.
- A fresh mutually accepted connection, subject to current confirmed/completed-session and coach eligibility, restores the same pair's complete retained shared-history view. Old connection attempts remain terminal.
- History includes pending and accepted requests, declined/withdrawn/expired/not-selected requests and confirmed/completed/cancelled bookings. Request-to-booking continuity shows the selected thread once, without duplicating its content.
- Each entry keeps its stable request/booking identity, authors, timestamps and original status. Terminal request and cancelled-booking conversations remain read-only. Reconnection does not revive a cancelled booking or change another record's permissions.
- Complete history may be paginated; page size must not silently truncate older records. Coach-private notes, unrelated candidates/accounts and different datasets never enter shared recovery.
- Exact participant access remains available independently of the connection. Reconnection restores relationship-view access and navigation to retained content; it does not recreate stored content or invent conversations before COR0015 delivery. Separate account-deletion/retention policy remains DEV0165.

## Assumptions, decisions, and dependencies

- Confirmed by the user: either-participant disconnect; recovery of all previously shared history on reconnection; inclusion of declined/withdrawn request conversations; original request/booking context.
- Adopted planning default: expose a bounded history view grouped by original request/booking and preserve stable identifiers; exact placement, ordering and cursor contracts belong to DEV0221–DEV0223 before runtime edits.
- COR0020 owns connection authority and relationship-history navigation. COR0015 owns conversation persistence, author/status permissions and rendering. Full conversation recovery requires both deliveries; neither coordination may claim that combined outcome from documentation alone.

## Implementation plan

1. Record the confirmed rule in the specification without claiming delivered connection or conversation runtime.
2. Extend the flat COR0020 work map and connection tickets with complete bounded history, disconnect/reconnect continuity and acceptance tests.
3. Align COR0015's existing contract/persistence/interface tickets with preservation, original identifiers, shared-only recovery and unchanged lifecycle permissions.
4. Check Markdown formatting, links/anchors, identifiers, index/statuses, reciprocal membership, ownership and consistency; review the diff and preserve unrelated edits.

## Acceptance criteria

- [x] AC1: The specification explicitly requires either-participant disconnect and complete retained shared-history recovery after fresh mutual acceptance, including unsuccessful requests and cancelled bookings.
- [x] AC2: Current connection and conversation tickets assign preservation, bounded retrieval and interface recovery to their existing owners with testable criteria; conversation delivery remains distinguishable from connection delivery.
- [x] AC3: Fresh eligibility, unchanged record identities/statuses, terminal read-only behavior, private/candidate isolation and independent participant permissions remain explicit.
- [x] AC4: Formatting, local links/anchors, unique identifiers, reciprocal coordination membership, index/statuses and scope review pass; historical records and unrelated Home work are preserved.

## Validation plan

Run Prettier on affected Markdown, a targeted local link/anchor/identifier/index/ownership checker, contract consistency assertions and `git diff --check`. Review against the four criteria. Application tests, browser rehearsals, database checks and builds are not applicable to this documentation-only change; the updated runtime tickets own those checks.

## Implementation record

Started 2026-10-14 after reviewing the current specification, both coordination records, their development tickets and repository ID allocation. No runtime work has started.

### Changes and rationale

The specification now confirms complete retained shared-history recovery after either participant disconnects and the pair mutually reconnects. History includes unsuccessful requests and cancelled bookings, preserves original IDs/statuses/author permissions and continues the accepted request into one booking thread. Connection tickets own complete paginated references/navigation; conversation tickets own preserved original content and rendering. This makes recovery testable without moving conversation implementation into the connection backend or claiming delivered runtime.

### Affected files

| File or component                                                                                                                                                          | Change and purpose                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [docs/mvp-spec.md](../../../docs/mvp-spec.md)                                                                                                                              | Add confirmed decision C33, reconnect flow/state rules, definition-of-done integration boundary, M6 scope and acceptance scenario.                              |
| [DEV0221](../../current/backend/DEV0221-persist-coach-athlete-connections.md)                                                                                              | Plan stable, complete paginated request/booking history, no deletion/reset and reconnection authority tests; retain separate conversation ownership.            |
| [DEV0222](../../current/frontend/DEV0222-add-coach-my-athletes.md) and [DEV0223](../../current/frontend/DEV0223-add-athlete-my-coaches.md)                                 | Plan relationship-history navigation and either-side disconnect/reconnect rehearsals with original contexts/statuses.                                           |
| [DEV0182](../../current/organisatory/DEV0182-adopt-session-notes-contract.md) and [DEV0183](../../current/backend/DEV0183-persist-authorized-session-notes.md)             | Carry recovery into the pending conversation contract and persistence criteria, preserving shared data and original permissions.                                |
| [DEV0184](../../current/frontend/DEV0184-add-coach-session-workspace.md) and [DEV0185](../../current/frontend/DEV0185-add-client-session-collaboration.md)                 | Render original retained shared contexts reached through reconnection history; terminal/cancelled content remains read-only and private content stays separate. |
| [COR0020](../../current/organisatory/COR0020-athlete-terminology-and-connections.md) and [COR0015](../../current/organisatory/COR0015-session-notes-and-training-plans.md) | Map this contract amendment as a flat COR0020 peer and separate connection-only completion from combined conversation recovery.                                 |
| [tickets/README.md](../../README.md)                                                                                                                                       | Allocate DEV0230, advance the next DEV ID and update current scope/status summaries while preserving Home planning.                                             |

### Decisions and deviations

- 2026-10-14: The user clarified that booking-scoped conversations should all be recovered, including declined/withdrawn request threads. Preserve their distinct contexts and full shared history rather than resetting history on each connection attempt.

### Contracts, configuration, and operations

Product/planning contract only. No schema, API, dependency, environment variable or setup change. No data or account retention period is introduced.

## Validation results

- Date/environment: 2026-10-14, local main checkout; documentation only.
- `node_modules/.bin/prettier --check docs/mvp-spec.md tickets/README.md 'tickets/current/{backend,frontend,organisatory}/{DEV018[2-5],DEV022[1-3],COR0015,COR0020}-*.md' 'tickets/{current,archive}/organisatory/DEV0230-*.md'`: passed all twelve affected Markdown files. The initial explicit-path check reported four formatting warnings; formatting those files resolved them before completion.
- `python3 /tmp/movx-dev0230-check-docs.py`: passed twelve affected Markdown files, 306 local links/anchors, 171 unique/indexed records, statuses, six reciprocal COR0020 members and four COR0015 members, full recovery/privacy assertions and preserved Home work. A later preservation guard detected a concurrent external edit to DEV0228; this change did not write that file, retained the updated Home plan and reran the scoped checks successfully.
- `git diff --check`: passed.
- Self-review compared the affected contract/planning changes against AC1–AC4: all retained shared history is recoverable through original request/booking IDs, either participant can disconnect, fresh eligibility/mutual acceptance remain required, terminal status permissions stay intact, and conversation ownership remains COR0015.
- Runtime tests, browser/database rehearsals, lint/typecheck/build and hosted checks: not run — no runtime, schema, dependency, environment or setup change. Connection and conversation tickets explicitly own those required runtime checks.

| Criterion | Evidence                                                                                                                                                      | Result |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Specification C33, connection flow/state, M6 and acceptance scenario include unsuccessful requests/cancelled sessions and full shared-history recovery.       | Passed |
| AC2       | COR0020/COR0015 maps and seven runtime/contract plans assign reference/navigation and original conversation persistence/rendering separately.                 | Passed |
| AC3       | Fresh consent/eligibility, original IDs/statuses, private/candidate isolation, terminal read-only behavior and independent access were reviewed and asserted. | Passed |
| AC4       | Twelve-file formatting, 306 links/anchors, 171 unique/indexed records, reciprocal ownership and diff/preservation checks passed.                              | Passed |

## Risks, limitations, and follow-ups

Connection and conversation runtime are still planned. Exact schema/cursor/action contracts remain DEV0221 design work. Full conversation recovery requires COR0015 and COR0020 runtime plus a combined rehearsal; those deliveries remain Draft/In progress rather than completed here. Complete recovery means access to all retained shared records, not access to coach-private material or restoration of content removed under a separately adopted retention policy.

## Completion and review references

- Completed: 2026-10-14 — contract/ticket changes and documentation validation passed.
- Commit: `[DEV0230] Preserve shared history across reconnection` — includes the completed contract record and its validation evidence; separate Home planning remains outside the commit.
- Review: Self-reviewed against AC1–AC4; no independent review created.
- Deployment or release: Not applicable — documentation only.
