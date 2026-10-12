# Ticket DEV0204: Redesign client My sessions

- Status: Draft
- Created: 2026-10-12
- Last updated: 2026-10-12
- Milestone: Scheduling interface authenticated-workspace follow-up
- Coordination: [COR0018 — Authenticated workspace redesign](../organisatory/COR0018-authenticated-workspace-redesign.md)
- Related records: completed contract [DEV0202 — Adopt the authenticated workspace redesign contract](../../archive/organisatory/DEV0202-adopt-authenticated-workspace-redesign-contract.md), shell dependency [DEV0203 — Introduce the authenticated workspace shell](DEV0203-introduce-authenticated-workspace-shell.md), client request baseline [DEV0190 — Add the client booking-request flow](../../archive/frontend/DEV0190-add-client-booking-request-flow.md) and portrait baseline [DEV0173 — Show coach portraits in client sessions](../../archive/frontend/DEV0173-show-coach-portraits-in-client-sessions.md)

## Objective and context

Recompose `/sessions` using the approved authenticated design so pending requests, confirmed upcoming sessions and retained history are easy to scan and no longer look like the legacy interface. Keep every projection and action actor-scoped and truthful.

## Scope and non-goals

- In scope: page heading/summary, pending request hierarchy, upcoming/history grouping, coach identity, status/date/location presentation, cancellation/withdrawal actions and empty/unavailable states.
- Out of scope: coach-owned requests/bookings, session notes, new data fields, fabricated training titles/messages, route or policy changes.

## Expected behavior and edge cases

- Client-owned pending requests and confirmed sessions are visually distinct; pending never reads as booked or reserved.
- Coach portrait/initial and full identity remain linked to the public coach profile.
- Coach actors receive a concise explanation that these are sessions requested as a client and can reach Coach workspace separately.
- Empty, terminal, unavailable and busy/action-result states remain complete at desktop/mobile widths.

## Assumptions, decisions, and dependencies

- DEV0203 supplies the authenticated frame.
- Existing request and booking projections remain authoritative; the concept's training titles, messages and notes controls are not available data.
- Current action semantics and Berlin time presentation remain unchanged.

## Implementation plan

1. Build one client-session page hierarchy around existing request and booking components.
2. Adapt cards/groups/statuses to the approved authenticated visual language without merging request and booking state.
3. Add ordinary-client and coach-as-client browser coverage for ready/empty/unavailable/action states.
4. Validate responsiveness, keyboard actions and all relevant static/build checks.

## Acceptance criteria

- [ ] AC1: Pending, upcoming confirmed and history content is clearly separated and uses only authoritative actor-scoped data.
- [ ] AC2: Coach identity/profile navigation, withdrawal/cancellation and pending-versus-confirmed language remain correct.
- [ ] AC3: Empty/unavailable/busy/result states remain actionable and responsive for client and coach actors.
- [ ] AC4: Relevant tests, lint, type-check, formatting and build pass.

## Validation plan

- Extend component tests for hierarchy/status and coach-as-client explanation.
- Run authenticated Playwright at 375, 430 and desktop widths for populated, empty and failure states plus keyboard actions.
- Run application tests and static/build checks.

## Implementation record

Pending implementation.

### Changes and rationale

Pending implementation.

### Affected files

| File or component | Change and purpose |
| ----------------- | ------------------ |
| Pending           | Pending.           |

### Decisions and deviations

None yet.

### Contracts, configuration, and operations

No data/API/schema/environment/dependency/migration change is planned.

## Validation results

Pending validation.

| Criterion | Evidence | Result  |
| --------- | -------- | ------- |
| AC1       | Pending  | Not run |
| AC2       | Pending  | Not run |
| AC3       | Pending  | Not run |
| AC4       | Pending  | Not run |

## Risks, limitations, and follow-ups

- Request and booking records must remain separate even when presented on one page.
- Session collaboration remains owned by COR0015.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: No review created.
- Deployment or release: Not deployed or released.
