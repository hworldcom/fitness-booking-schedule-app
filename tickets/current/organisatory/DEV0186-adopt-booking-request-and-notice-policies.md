# Ticket DEV0186: Adopt booking-request and notice policies

- Status: Ready
- Created: 2026-10-10
- Last updated: 2026-10-11
- Milestone: Scheduling-only booking-policy follow-up
- Coordination: [COR0016 — Coach-confirmed booking requests](COR0016-coach-confirmed-booking-requests.md)
- Related records: implementation peers [DEV0187 — Enforce booking-request eligibility](../backend/DEV0187-enforce-booking-request-eligibility.md), [DEV0188 — Persist multi-candidate booking requests](../backend/DEV0188-persist-multi-candidate-booking-requests.md), [DEV0189 — Add the coach booking-request queue](../frontend/DEV0189-add-coach-booking-request-queue.md) and [DEV0190 — Add the client booking-request flow](../frontend/DEV0190-add-client-booking-request-flow.md); conversation contract [DEV0182 — Adopt the session-notes contract](DEV0182-adopt-session-notes-contract.md)

## Objective and context

Adopt an authoritative contract that replaces immediate confirmation with coach-approved booking requests. The [MVP specification](../../../docs/mvp-spec.md#43-book-a-private-session) currently guarantees that selecting an open occurrence immediately creates a confirmed booking. The user now wants every coach to review potential clients for a time and select one, while each client receives a saved pending request and a clear decision deadline.

## Scope and non-goals

- In scope:
  - Define approval as the only booking path for every coach and occurrence.
  - Define a fixed 24-hour minimum notice, with the current seven-day occurrence horizon remaining the maximum advance boundary.
  - Define multiple independent pending requests per occurrence, one active request per client/occurrence at a time, no pending candidate cap and exactly one accepted request.
  - Define request, acceptance, decline, withdrawal, 12-hour expiry, automatic non-selection, repeat-request and coach occurrence-closure behavior.
  - Define client language, privacy, coach access, deadlines, concurrency and unavailable-state acceptance scenarios.
  - Reconcile the pending-request relationship with COR0015 without moving conversation implementation into this coordination.
- Out of scope:
  - Schema, server or interface implementation.
  - Instant booking, coach-configurable notice/deadline values, attendance reconfirmation, candidate ranking, waitlists, payments, email/push notification delivery, general messaging or configurable publication horizons beyond seven days.

## Expected behavior and edge cases

- Every eligible scheduling action creates a pending request; no occurrence is confirmed directly.
- A client may request only while the occurrence starts at least 24 hours after the authoritative database time. Each saved request has a deadline exactly 12 hours after submission, which is therefore no later than 12 hours before training.
- Multiple pending requests do not change the occurrence from open/requestable to booked. The same client retry returns the same active request.
- The coach may decline requests individually or accept one. Acceptance atomically confirms that client, marks the occurrence booked and closes every other pending request as not selected.
- Clients see only their own request. The saved state reads `Request saved`, `Awaiting coach confirmation`, `This session is not confirmed yet` and a concrete decision deadline; it does not mention or count other candidates.
- A client may withdraw a pending request. Expired, withdrawn, declined and not-selected attempts are terminal and never consume capacity, but the same client may create a new request while the occurrence remains open and before its 24-hour cutoff.
- The coach may close one occurrence without choosing a client when no longer available. That atomic action makes the occurrence unavailable to new requests and closes all of its pending requests; it does not alter the recurring rule or revive earlier requests later.
- Cancelling a confirmed booking does not revive earlier closed requests. If the occurrence reopens before the cutoff, interested clients must create new requests.
- Request lists have no product-level candidate cap, but coach projections and interfaces use bounded pagination.
- Minimum-notice and response-deadline checks use database instants. The first-release service area is Berlin, so deadlines display in `Europe/Berlin` while persistence and comparison remain timezone-safe.

## Assumptions, decisions, and dependencies

- The user confirmed the multi-candidate selection model on 2026-10-10 and explicitly rejected competition-oriented client copy.
- On 2026-10-11 the user chose approval-only booking, a fixed 24-hour minimum notice and a deadline exactly 12 hours after each request. Configurable values may be reconsidered later but are not part of this delivery.
- On 2026-10-11 the user chose no maximum pending-request count, allowed another request after an explicit coach decline, and approved automatic closure of other requests when one client is selected.
- On 2026-10-11 the user added coach-controlled closure of a specific occurrence and confirmed Berlin as the only current service area while retaining timezone-safe storage and calculations.
- `client` remains the current product term for the user's `student` concept.

## Implementation plan

1. Add the confirmed booking-policy, multi-candidate and client-copy decisions to the specification.
2. Extend booking journeys and state diagrams with pending-request, repeat-attempt, selection and occurrence-closure transitions separate from the confirmed-booking lifecycle.
3. Fix the 24-hour notice, 12-hour response deadline, unlimited-candidate pagination boundary, repeat-request rules and Berlin display-time behavior.
4. Update permissions, definition of done, milestones, acceptance matrix and demo scenarios.
5. Reconcile COR0015's request-conversation dependency and validate documentation links/consistency.

## Acceptance criteria

- [ ] AC1: The specification replaces direct confirmation with coach-approved requests for every coach and contains no instant-mode or policy-switch behavior.
- [ ] AC2: Multiple pending clients, non-exclusive capacity, exactly-one acceptance, automatic non-selection and terminal request states are explicit and testable.
- [ ] AC3: The fixed 24-hour notice, seven-day maximum horizon, 12-hour deadline, repeat-request behavior, Berlin display timezone and coach occurrence closure are unambiguous.
- [ ] AC4: Client copy confirms persistence without claiming confirmation or disclosing other candidate presence/count/identity.
- [ ] AC5: COR0015 and COR0016 have non-overlapping implementation ownership and explicit integration dependencies.

## Validation plan

- Run Prettier and `git diff --check` across changed contract/work-record files.
- Validate affected relative links, unique identifiers and reciprocal COR0016 membership.
- Add targeted assertions for decision register, state model, permissions, definition of done, acceptance matrix and the absence of prohibited competition-oriented client copy.
- Application/database tests are not applicable because this ticket changes only the product contract and work records.

## Implementation record

Pending implementation.

### Changes and rationale

Pending implementation.

### Affected files

| File or component | Change and purpose |
| ----------------- | ------------------ |
| Pending           | Pending.           |

### Decisions and deviations

- 2026-10-10: Planned approval as multi-candidate selection rather than a first-request hold because the coach must be able to choose one client.
- 2026-10-11: Replaced optional instant/approval modes with approval-only booking. Removed coach policy switching, configurable notice values and candidate caps from the planned first release.
- 2026-10-11: Adopted repeat requests after any terminal unsuccessful attempt while still eligible, coach-controlled closure of one occurrence, automatic non-selection on acceptance, in-app-only status and timezone-safe Berlin presentation.

### Contracts, configuration, and operations

This ticket will change the product contract only. It adds no migration, dependency, environment variable or runtime operation.

## Validation results

Pending validation.

- Planning revision checks on 2026-10-11 passed for Prettier, relative Markdown links, unique COR0016/DEV0186-DEV0190 headings, removal of superseded ticket paths and `git diff --check`. These checks validate the revised work records only; the MVP specification changes and DEV0186 acceptance criteria have not been implemented or validated.
- Date and environment: Not run.
- Exact commands and outcomes: Not run.
- Manual steps and observed outcomes: Not run.
- Failed, blocked, or not-run checks: Runtime checks are not applicable to this documentation-only ticket.

| Criterion | Evidence | Result  |
| --------- | -------- | ------- |
| AC1       | Pending  | Not run |
| AC2       | Pending  | Not run |
| AC3       | Pending  | Not run |
| AC4       | Pending  | Not run |
| AC5       | Pending  | Not run |

## Risks, limitations, and follow-ups

- The fixed cutoff/deadline combination gives the coach at least 12 hours before training after the decision deadline, including a request made exactly at the 24-hour cutoff.
- Approval without notification delivery depends on coaches checking their in-app queue. Do not claim email or push behavior.
- A future attendance-reconfirmation feature must use separate status/timestamps rather than overloading pending booking requests.

## Completion and review references

- Completed: Not completed.
- Commit: Planning record included in this commit — `[DEV0182][DEV0183][DEV0184][DEV0185][DEV0186][DEV0187][DEV0188][DEV0189][DEV0190] Plan session collaboration and booking requests`; implementation not started.
- Review: No review created.
- Deployment or release: Documentation only; not deployed or released.
