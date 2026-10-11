# Ticket DEV0189: Add the coach booking-request queue

- Status: Ready
- Created: 2026-10-10
- Last updated: 2026-10-11
- Milestone: Scheduling-only booking-policy follow-up
- Coordination: [COR0016 — Coach-confirmed booking requests](../organisatory/COR0016-coach-confirmed-booking-requests.md)
- Related records: completed eligibility dependency [DEV0187 — Enforce booking-request eligibility](../../archive/backend/DEV0187-enforce-booking-request-eligibility.md), completed request dependency [DEV0188 — Persist multi-candidate booking requests](../../archive/backend/DEV0188-persist-multi-candidate-booking-requests.md), conversation interface [DEV0184 — Add the coach session workspace](DEV0184-add-coach-session-workspace.md)

## Objective and context

Give coaches a private queue for deciding approval requests and a way to close one occurrence when they are no longer available. Existing Coach workspace confirms every client immediately and has no candidate-selection interface.

## Scope and non-goals

- In scope:
  - Add a Pending requests section in Bookings with client identity, occurrence time/location, request/deadline status and accept/decline actions.
  - Add an explicit close-occurrence action that explains it will make that one session unavailable and close all pending requests without changing the recurring schedule.
  - Paginate request groups/results so the interface stays bounded without a product-level candidate cap.
  - Clearly distinguish requests from confirmed bookings and preserve existing confirmed booking actions.
  - Handle version conflicts, concurrent selection, expiry, unavailable state and responsive keyboard use.
- Out of scope:
  - Shared/private conversation controls owned by DEV0184.
  - Client request/status UI owned by DEV0190.
  - Candidate ranking, recommendation, bulk acceptance, notifications or attendance confirmation.

## Expected behavior and edge cases

- The queue explains that requests do not reserve the session and only the selected client becomes confirmed.
- The pending queue never appears in Schedule or public views. It groups requests by occurrence without implying that any pending client owns the time.
- Accepting one request updates it to confirmed and removes/closes the others after refresh. A stale concurrent accept reports that the slot/request changed rather than claiming success.
- Declining one request leaves other requests and the occurrence available. Expired/terminal requests are read-only history or omitted according to the bounded projection.
- Closing an occurrence requires clear confirmation, closes all pending requests and removes that occurrence from requestable availability. A concurrent accept/close conflict reports the authoritative result.
- Request conversations, when DEV0184 is delivered, remain isolated per candidate.

## Assumptions, decisions, and dependencies

- DEV0187 and DEV0188 are complete; this ticket is Ready to consume their authoritative eligibility, participant projection and mutation contracts.
- Reuse Coach workspace Bookings for request decisions; do not add a policy form or a fourth coach tab.
- Client private avatars remain unavailable for pending requests unless the authoritative contract explicitly changes the confirmed-booking media boundary; stable initials are sufficient.
- DEV0184 owns note composition and may enhance each request detail after this ticket establishes the queue.

## Implementation plan

1. Review delivered policy/request contracts and relevant bundled Next.js documentation.
2. Add paginated pending-request grouping plus accept/decline controls to Bookings.
3. Add the guarded one-occurrence close action and explanatory confirmation.
4. Add accessible responsive states, conflict recovery and truthful terminal/unavailable presentation.
5. Add component/browser tests and authenticated multi-candidate desktop/mobile rehearsal.

## Acceptance criteria

- [ ] AC1: Every requestable occurrence uses approval; the coach interface exposes no instant/approval or notice configuration.
- [ ] AC2: The owning coach can inspect multiple pending requests per occurrence without any one appearing confirmed or reserved.
- [ ] AC3: Accept, decline and close-occurrence actions present atomic backend outcomes truthfully and preserve existing confirmed-booking actions.
- [ ] AC4: Suspended/unrelated actors, stale actions, expiry and database failure expose no unauthorized candidate data or false success.
- [ ] AC5: Keyboard and responsive desktop/mobile validation passes for the paginated request queue and its decision/closure controls.

## Validation plan

- Add component/unit tests for pagination, grouping, close confirmation and action results.
- Add Playwright coverage for a coach accepting one of multiple requests, declining one while another remains and closing an occurrence with pending requests.
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

- 2026-10-11: Removed the policy settings form after approval became the only booking mode. Added bounded pagination and coach-controlled closure of a specific occurrence.

### Contracts, configuration, and operations

This ticket consumes DEV0187/DEV0188 interfaces and adds no migration, environment variable or external dependency.

## Validation results

Pending validation.

- Date and environment: Not run.
- Exact commands and outcomes: Not run.
- Manual steps and observed outcomes: Not run.
- Failed, blocked, or not-run checks: Backend dependencies are complete; checks await implementation.

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
