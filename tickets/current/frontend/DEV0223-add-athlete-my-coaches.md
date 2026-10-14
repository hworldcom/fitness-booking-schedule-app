# Ticket DEV0223: Add athlete My coaches

- Status: Draft
- Created: 2026-10-14
- Last updated: 2026-10-14
- Milestone: M6 — Athlete terminology and coach–athlete connections
- Coordination: [COR0020 — Athlete terminology and coach–athlete connections](../organisatory/COR0020-athlete-terminology-and-connections.md)
- Related records: contract dependency [DEV0219 — Adopt athlete terminology and connection contract](../../archive/organisatory/DEV0219-adopt-athlete-connections-contract.md); backend dependency [DEV0221](../../archive/backend/DEV0221-persist-coach-athlete-connections.md); terminology dependency [DEV0220](../../archive/frontend/DEV0220-use-athlete-website-terminology.md); coach peer [DEV0222](../../archive/frontend/DEV0222-add-coach-my-athletes.md)

## Objective and context

Give athletes an accessible My coaches list and mutual connection controls after a qualifying confirmed session. Implement against the [current specification](../../../docs/mvp-spec.md#49-connect-after-a-confirmed-session); this ticket is a plan, not evidence of delivered behavior.

## Scope and non-goals

- In scope: eligible session Connect/request state, incoming/outgoing connection requests, accepted My coaches list, current public coach identity/portrait, complete paginated shared request/booking-history navigation, safe public-profile links, disconnection/reconnection and failure recovery.
- Out of scope: coach My athletes, backend authority, public athlete profiles, instant rebooking, chat, notifications and native runtime.

## Expected behavior and edge cases

- Either participant can disconnect without deleting/resetting shared history. Fresh mutually accepted reconnection restores a complete paginated history view for the same pair, including unsuccessful booking requests and cancelled sessions. Keep original identifiers/statuses and show the selected request/booking conversation once.
- Shared conversation/plan/note details remain owned by COR0015. History links reopen original contexts when those interfaces are delivered; terminal/cancelled content stays read-only and coach-private content never enters shared recovery. Existing exact-participant access survives disconnection.

- The athlete may send or withdraw its request and accept/decline a coach's incoming request according to server state. Coaches training as athletes use the same account and flow.
- My coaches separates accepted connections from incoming/outgoing requests and booking history. A coach is shown once per relationship regardless of session count.
- Another-session actions follow the existing public profile and approval-request flow. Hidden/suspended/unavailable coaches keep truthful retained relationship identity without exposing a rebooking action that cannot succeed.
- Removing a connection preserves bookings and their participant access; revoked connection-only data disappears after the authoritative result.
- Stale qualifying sessions, conflicts, unavailable services and missing portraits keep usable feedback and initials.

## Assumptions, decisions, and dependencies

- DEV0219 and DEV0221 establish the contract/actions; DEV0220 supplies athlete copy.
- Proposed placement: My coaches reachable within My sessions without introducing a new primary-navigation destination. Preserve mobile Explore/My sessions/Profile and capability-aware Coach workspace access.
- Reuse current public coach portrait/profile links; no athlete-side private-avatar permission is added.

## Implementation plan

1. Review delivered athlete list/actions and current My sessions hierarchy plus bundled framework guidance.
2. Add session-level connection controls, request sections and a paginated accepted My coaches list.
3. Add complete paginated shared request/booking-history and public-profile shortcuts, consent/disconnect/reconnect feedback and hidden/suspended/conflict recovery. Original conversation rendering stays DEV0185.
4. Rehearse both initiation directions, coach-as-athlete and negative actor states on desktop/mobile with keyboard use.

## Acceptance criteria

- [ ] AC1: An athlete sees only its own incoming/outgoing connection requests and accepted My coaches, with explicit recipient acceptance and current eligibility enforcement.
- [ ] AC2: Accepted relationships show truthful coach identity/portrait and complete paginated shared request/booking-history shortcuts, including unsuccessful/cancelled entries. Fresh accepted reconnection restores all retained history with original context/status and no duplicate accepted-request thread; request-another-session honors existing discovery/approval rules.
- [ ] AC3: Removal, cancellation invalidation, duplicate/crossed requests, hidden/suspended coaches and unavailable/missing-image states preserve history and truthful actions.
- [ ] AC4: Coach-as-athlete, unrelated-account denial, mobile/desktop and keyboard flows plus meaningful browser/regression tests, lint, type-check, formatting and build pass.

## Validation plan

Disconnect from each participant side, mutually reconnect, reload and traverse older history pages. Verify all retained exact-pair requests/bookings return with original status/identifiers, including declined/withdrawn/expired/not-selected requests and cancelled sessions; selected-request/booking continuity appears once. Record conversation-body recovery only after COR0015 interfaces are delivered and a combined two-account rehearsal passes.

Use persisted local two-account bookings to validate both initiation directions, pending-only/cancelled-only denial, confirmed/completed eligibility, crossed requests, removal, reload, pagination, coach-as-athlete and hidden/suspended coaches. Inspect responses for unrelated athlete/candidate/private-note data. Verify keyboard focus and mobile/desktop layout, then run relevant existing application/browser/auth checks, lint, type-check, format, build and diff checks.

## Implementation record

Pending implementation.

### Changes and rationale

Pending implementation.

### Affected files

| File or component | Change and purpose                                                             |
| ----------------- | ------------------------------------------------------------------------------ |
| Pending           | Record actual repository-relative files and their roles during implementation. |

### Decisions and deviations

2026-10-14: [DEV0230](../../archive/organisatory/DEV0230-adopt-reconnection-history-recovery.md) records full shared-history recovery after reconnection. This interface owns history navigation; COR0015 owns request/session conversation rendering and original status/author permissions.

### Contracts, configuration, and operations

Consumes DEV0221's bounded athlete projection/actions and existing public coach media. No new schema, dependency or environment variable is planned.

## Validation results

Pending validation; all runtime checks are not run.

| Criterion | Evidence               | Result  |
| --------- | ---------------------- | ------- |
| AC1       | Pending implementation | Not run |
| AC2       | Pending implementation | Not run |
| AC3       | Pending implementation | Not run |
| AC4       | Pending implementation | Not run |

## Risks, limitations, and follow-ups

A saved coach can become hidden or suspended; connecting never bypasses coach approval or booking eligibility. Next action: review the delivered backend projection and settle the My sessions list placement.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: No independent review created.
- Deployment or release: Not deployed or released.
