# Ticket DEV0206: Redesign coach Bookings

- Status: Draft
- Created: 2026-10-12
- Last updated: 2026-10-12
- Milestone: Scheduling interface authenticated-workspace follow-up
- Coordination: [COR0018 — Authenticated workspace redesign](../organisatory/COR0018-authenticated-workspace-redesign.md)
- Related records: completed contract [DEV0202 — Adopt the authenticated workspace redesign contract](../../archive/organisatory/DEV0202-adopt-authenticated-workspace-redesign-contract.md), coach-frame dependency [DEV0205 — Redesign coach Schedule](DEV0205-redesign-coach-schedule.md), request baseline [DEV0189 — Add the coach booking-request queue](../../archive/frontend/DEV0189-add-coach-booking-request-queue.md) and booking-avatar baseline [DEV0169 — Show client avatars in coach bookings](../../archive/frontend/DEV0169-show-client-avatars-in-coach-bookings.md)

## Objective and context

Redesign the coach Bookings tab around the approved authenticated hierarchy so pending decisions, recent terminal request history and confirmed bookings are easier to scan without weakening request isolation or booking authority.

## Scope and non-goals

- In scope: Bookings active-tab framing, occurrence/request groups, decision deadlines/statuses, accept/decline/close controls, recent request history, confirmed booking cards and completion/cancellation states.
- Out of scope: policy/persistence changes, candidate messages, unbounded request loading, schedule editing, session notes or client-side candidate visibility.

## Expected behavior and edge cases

- Pending requests remain grouped by exact occurrence with private avatar/initial, Berlin deadline and separate accept/decline controls.
- Closing one occurrence, accepting one candidate and terminal history remain visually distinct and use existing concurrency/error handling.
- Confirmed booked schedule stays only in Bookings and exposes only the owning coach's authorized client data.
- Empty, suspended, unavailable, paginated and action-busy/result states remain usable.

## Assumptions, decisions, and dependencies

- DEV0205 supplies shared coach frame/navigation styling.
- Existing request/booking services and bounded pagination remain unchanged.
- The concept's free-text client messages are not available and will not be fabricated.

## Implementation plan

1. Recompose existing request queue and coach booking cards within the shared coach frame.
2. Apply clear status/deadline/action hierarchy and responsive group/card layouts.
3. Extend actor/privacy/action/failure browser and component coverage.
4. Run relevant test, static and build checks.

## Acceptance criteria

- [ ] AC1: Bookings presents pending decisions, recent request history and confirmed bookings as distinct truthful sections.
- [ ] AC2: Accept/decline/close/cancel/complete behavior and actor-scoped client identity remain unchanged.
- [ ] AC3: Pagination, empty/unavailable/suspended/busy states remain accessible at mobile and desktop widths.
- [ ] AC4: Relevant tests, lint, type-check, formatting and build pass.

## Validation plan

- Extend component tests for section/status hierarchy and existing action boundaries.
- Run authenticated coach Playwright for multiple requests, one acceptance, decline/close, history, booking actions, mobile/desktop and failure states.
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

No schema/API/environment/dependency/migration change is planned.

## Validation results

Pending validation.

| Criterion | Evidence | Result  |
| --------- | -------- | ------- |
| AC1       | Pending  | Not run |
| AC2       | Pending  | Not run |
| AC3       | Pending  | Not run |
| AC4       | Pending  | Not run |

## Risks, limitations, and follow-ups

- Visual grouping must not imply that pending requests reserve capacity or reveal other candidates to clients.
- Session collaboration remains owned by COR0015.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: No review created.
- Deployment or release: Not deployed or released.
