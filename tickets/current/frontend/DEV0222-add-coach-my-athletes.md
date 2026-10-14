# Ticket DEV0222: Add coach My athletes

- Status: Draft
- Created: 2026-10-14
- Last updated: 2026-10-14
- Milestone: M6 — Athlete terminology and coach–athlete connections
- Coordination: [COR0020 — Athlete terminology and coach–athlete connections](../organisatory/COR0020-athlete-terminology-and-connections.md)
- Related records: contract dependency [DEV0219 — Adopt athlete terminology and connection contract](../../archive/organisatory/DEV0219-adopt-athlete-connections-contract.md); backend dependency [DEV0221](../backend/DEV0221-persist-coach-athlete-connections.md); terminology dependency [DEV0220](DEV0220-use-athlete-website-terminology.md); athlete peer [DEV0223](DEV0223-add-athlete-my-coaches.md)

## Objective and context

Give coaches an accessible My athletes list and connection request controls anchored to confirmed sessions. Implement against the [current specification](../../../docs/mvp-spec.md#49-connect-after-a-confirmed-session); this ticket is a plan, not evidence of delivered behavior.

## Scope and non-goals

- In scope: coach-side Connect/request status on eligible booking context, incoming/outgoing requests, accepted My athletes list, bounded identity/photo and shared-session links, removal and recoverable action states.
- Out of scope: athlete interface, persistence/media authority, editing athlete profiles, coach-private records across sessions, general messaging and notifications.

## Expected behavior and edge cases

- A coach can request, accept, decline or withdraw according to the exact server-derived actor/state permissions; sending never makes the pair connected.
- My athletes shows accepted relationships separately from incoming/outgoing requests and booked sessions. Missing photos retain initials.
- Shared-history links preserve pair scope. Removal clearly explains that sessions and their participant access remain intact.
- Suspended coaches retain permitted existing list/removal actions and receive no create/accept controls. A hidden coach's approved authority and existing sessions, not discovery visibility, determine connection eligibility.
- Cancellation or concurrent decisions can invalidate a pending control; the result refreshes authoritative state without false success.

## Assumptions, decisions, and dependencies

- DEV0219 and DEV0221 must establish requirements/actions; DEV0220 supplies athlete vocabulary.
- Proposed placement: a My athletes section reachable within existing Coach workspace → Bookings, preserving Profile → Schedule → Bookings navigation. Record exact layout before UI edits.
- Reuse existing shared workspace, Avatar and action-feedback components; inspect bundled Next.js guides before integration edits.

## Implementation plan

1. Review delivered coach projections and actor/status matrix.
2. Add eligible booking connection controls, request sections and the accepted relationship list with bounded pagination.
3. Add explicit acceptance/removal feedback, keyboard focus, initials, empty/unavailable/conflict states and mobile layout.
4. Rehearse two-account flows and record code, screenshots and exact validation.

## Acceptance criteria

- [ ] AC1: An owning coach can manage only its authorized incoming/outgoing requests and accepted connections, with truthful pending and eligible-session behavior.
- [ ] AC2: My athletes renders bounded athlete identity/photo and shared-session links, with removal preserving bookings and revoking connection-only UI access.
- [ ] AC3: Approved/demo/suspended/unrelated and missing-image/empty/unavailable/conflict states preserve server permissions and recoverable feedback.
- [ ] AC4: Keyboard and desktop/mobile flows plus meaningful browser/regression tests, lint, type-check, formatting and build pass.

## Validation plan

Rehearse coach-initiated and athlete-initiated connections using real local persisted bookings and accounts. Verify recipient acceptance, decline, sender withdrawal, crossed requests, cancellation invalidation, removal, pagination, suspended state, Storage failure and unrelated denial at mobile/desktop widths. Tab through actions and verify focus/status announcements. Run relevant existing application/browser/auth checks, lint, type-check, format, build and diff checks; DEV0221 owns database authority.

## Implementation record

Pending implementation.

### Changes and rationale

Pending implementation.

### Affected files

| File or component | Change and purpose                                                             |
| ----------------- | ------------------------------------------------------------------------------ |
| Pending           | Record actual repository-relative files and their roles during implementation. |

### Decisions and deviations

None yet; record adopted choices before material implementation changes.

### Contracts, configuration, and operations

Consumes DEV0221's projection/actions/media contract. No new schema, environment variable, dependency or coach capability is planned.

## Validation results

Pending validation; all runtime checks are not run.

| Criterion | Evidence               | Result  |
| --------- | ---------------------- | ------- |
| AC1       | Pending implementation | Not run |
| AC2       | Pending implementation | Not run |
| AC3       | Pending implementation | Not run |
| AC4       | Pending implementation | Not run |

## Risks, limitations, and follow-ups

Do not imply that all booked athletes are connected or that connecting grants new coaching authority. Integration with future session notes remains independent. Next action: review the delivered backend projection and settle the bounded Bookings layout.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: No independent review created.
- Deployment or release: Not deployed or released.
