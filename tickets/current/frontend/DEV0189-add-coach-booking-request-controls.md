# Ticket DEV0189: Add coach booking-request controls

- Status: Draft
- Created: 2026-10-10
- Last updated: 2026-10-10
- Milestone: Scheduling-only booking-policy follow-up
- Coordination: [COR0016 — Coach-confirmed booking requests](../organisatory/COR0016-coach-confirmed-booking-requests.md)
- Related records: policy dependency [DEV0187 — Persist coach booking policies](../backend/DEV0187-persist-coach-booking-policies.md), request dependency [DEV0188 — Persist multi-candidate booking requests](../backend/DEV0188-persist-multi-candidate-booking-requests.md), conversation interface [DEV0184 — Add the coach session workspace](DEV0184-add-coach-session-workspace.md)

## Objective and context

Give coaches understandable control over instant versus approval-required scheduling and a private queue for deciding pending requests. Existing Coach workspace confirms every client immediately and has no advance-notice setting or candidate-selection interface.

## Scope and non-goals

- In scope:
  - Add a coach-level booking-policy form for confirmation mode and supported minimum-notice choices.
  - Add a Pending requests section in Bookings with client identity, occurrence time/location, request/deadline status and accept/decline actions.
  - Clearly distinguish requests from confirmed bookings and preserve existing confirmed booking actions.
  - Handle version conflicts, concurrent selection, expiry, unavailable state and responsive keyboard use.
- Out of scope:
  - Shared/private conversation controls owned by DEV0184.
  - Client request/status UI owned by DEV0190.
  - Candidate ranking, recommendation, bulk acceptance, notifications or attendance confirmation.

## Expected behavior and edge cases

- The policy form explains that approval mode can receive multiple requests and confirms only the coach's selected client.
- Policy save is explicit and one request; stale versions preserve the coach's draft with recoverable feedback.
- The pending queue never appears in Schedule or public views. It groups requests by occurrence without implying that any pending client owns the time.
- Accepting one request updates it to confirmed and removes/closes the others after refresh. A stale concurrent accept reports that the slot/request changed rather than claiming success.
- Declining one request leaves other requests and the occurrence available. Expired/terminal requests are read-only history or omitted according to the bounded projection.
- Request conversations, when DEV0184 is delivered, remain isolated per candidate.

## Assumptions, decisions, and dependencies

- DEV0187 and DEV0188 must complete before this ticket becomes Ready.
- Reuse Coach workspace Profile for policy configuration and Bookings for request decisions; do not add a fourth coach tab.
- Client private avatars remain unavailable for pending requests unless the authoritative contract explicitly changes the confirmed-booking media boundary; stable initials are sufficient.
- DEV0184 owns note composition and may enhance each request detail after this ticket establishes the queue.

## Implementation plan

1. Review delivered policy/request contracts and relevant bundled Next.js documentation.
2. Add the versioned policy form to the appropriate coach profile/settings region.
3. Add pending-request grouping and accept/decline controls to Bookings.
4. Add accessible responsive states, conflict recovery and truthful terminal/unavailable presentation.
5. Add component/browser tests and authenticated multi-candidate desktop/mobile rehearsal.

## Acceptance criteria

- [ ] AC1: An authorized coach can switch modes and minimum notice with one explicit, conflict-aware save.
- [ ] AC2: The owning coach can inspect multiple pending requests per occurrence without any one appearing confirmed or reserved.
- [ ] AC3: Accept/decline actions present atomic backend outcomes truthfully and preserve existing confirmed-booking actions.
- [ ] AC4: Suspended/unrelated actors, stale actions, expiry and database failure expose no unauthorized candidate data or false success.
- [ ] AC5: Keyboard and responsive desktop/mobile validation passes for settings and request decisions.

## Validation plan

- Add component/unit tests for form validation, draft preservation, grouping and action results.
- Add Playwright coverage for mode/notice saving and a coach accepting one of multiple requests or declining one while another remains.
- Perform authenticated desktop/mobile rehearsal using one coach and multiple local clients.
- Run configured test, lint, type-check, format and production-build commands.

## Implementation record

Pending implementation.

### Changes and rationale

Pending implementation.

### Affected files

| File or component | Change and purpose |
| ----------------- | ------------------ |
| Pending           | Pending.           |

### Decisions and deviations

No implementation decisions or deviations recorded yet.

### Contracts, configuration, and operations

This ticket consumes DEV0187/DEV0188 interfaces and adds no migration, environment variable or external dependency.

## Validation results

Pending validation.

- Date and environment: Not run.
- Exact commands and outcomes: Not run.
- Manual steps and observed outcomes: Not run.
- Failed, blocked, or not-run checks: All checks await backend dependencies and implementation.

| Criterion | Evidence | Result  |
| --------- | -------- | ------- |
| AC1       | Pending  | Not run |
| AC2       | Pending  | Not run |
| AC3       | Pending  | Not run |
| AC4       | Pending  | Not run |
| AC5       | Pending  | Not run |

## Risks, limitations, and follow-ups

- Dense candidate queues must remain scannable without exposing one client's content inside another candidate's detail.
- No notification delivery exists; copy must direct coaches to check Bookings without claiming external alerts.

## Completion and review references

- Completed: Not completed.
- Commit: Planning record included in this commit — `[DEV0182][DEV0183][DEV0184][DEV0185][DEV0186][DEV0187][DEV0188][DEV0189][DEV0190] Plan session collaboration and booking requests`; implementation not started.
- Review: No review created.
- Deployment or release: Not deployed or released.
