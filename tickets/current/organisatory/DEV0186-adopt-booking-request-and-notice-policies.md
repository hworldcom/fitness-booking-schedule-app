# Ticket DEV0186: Adopt booking-request and notice policies

- Status: Ready
- Created: 2026-10-10
- Last updated: 2026-10-10
- Milestone: Scheduling-only booking-policy follow-up
- Coordination: [COR0016 — Coach-confirmed booking requests](COR0016-coach-confirmed-booking-requests.md)
- Related records: implementation peers [DEV0187 — Persist coach booking policies](../backend/DEV0187-persist-coach-booking-policies.md), [DEV0188 — Persist multi-candidate booking requests](../backend/DEV0188-persist-multi-candidate-booking-requests.md), [DEV0189 — Add coach booking-request controls](../frontend/DEV0189-add-coach-booking-request-controls.md) and [DEV0190 — Add the client booking-request flow](../frontend/DEV0190-add-client-booking-request-flow.md); conversation contract [DEV0182 — Adopt the session-notes contract](DEV0182-adopt-session-notes-contract.md)

## Objective and context

Adopt an authoritative contract for optional coach approval and advance-booking limits before changing the current immediate-confirmation runtime. The [MVP specification](../../../docs/mvp-spec.md#43-book-a-private-session) currently guarantees that selecting an open occurrence immediately creates a confirmed booking. The user now wants some coaches to review multiple potential clients for a time and select one, while clients receive a saved pending request and a clear decision deadline.

## Scope and non-goals

- In scope:
  - Define coach-selectable `instant` and `approval required` modes.
  - Define coach-configurable minimum notice, with the current seven-day occurrence horizon remaining the maximum advance boundary.
  - Define multiple independent pending requests per occurrence, one active request per client/occurrence, a bounded candidate count and exactly one accepted request.
  - Define request, acceptance, decline, withdrawal, expiry, automatic non-selection, retry and policy-change behavior.
  - Define client language, privacy, coach access, deadlines, concurrency and unavailable-state acceptance scenarios.
  - Reconcile the pending-request relationship with COR0015 without moving conversation implementation into this coordination.
- Out of scope:
  - Schema, server or interface implementation.
  - Attendance reconfirmation, candidate ranking, waitlists, payments, notification delivery, general messaging or configurable publication horizons beyond seven days.

## Expected behavior and edge cases

- Existing coaches retain instant booking with zero minimum notice unless they explicitly save another policy.
- Instant mode confirms the first eligible atomic booking as today, subject to the coach's minimum-notice cutoff.
- Approval mode records multiple pending requests without changing the occurrence from open/requestable to booked. The same client retry returns the same active request.
- The coach may decline requests individually or accept one. Acceptance atomically confirms that client, marks the occurrence booked and closes every other pending request as not selected.
- Clients see only their own request. The saved state reads `Request saved`, `Awaiting coach confirmation`, `This session is not confirmed yet` and a concrete decision deadline; it does not mention or count other candidates.
- A client may withdraw a pending request. Expired, withdrawn, declined and not-selected requests are terminal and never consume capacity.
- Minimum-notice and response-deadline checks use database instants. Policy edits apply to new attempts and do not rewrite existing pending requests or confirmed bookings.

## Assumptions, decisions, and dependencies

- The user confirmed the multi-candidate selection model on 2026-10-10 and explicitly rejected competition-oriented client copy.
- Proposed first-release minimum-notice options are none, 2, 6, 12, 24 and 48 hours. Approval mode requires enough time for a future decision deadline; DEV0186 must make the exact response formula authoritative before backend implementation.
- Proposed response deadline is the earlier of 24 hours after request or one hour before training. A request whose computed deadline is not future is ineligible.
- Proposed pending cap is five active requests per occurrence. Reaching it returns an unavailable result without revealing the count or identities to another client.
- `client` remains the current product term for the user's `student` concept.

## Implementation plan

1. Add the confirmed booking-policy, multi-candidate and client-copy decisions to the specification.
2. Extend booking journeys and state diagrams with pending-request and selection transitions separate from the confirmed-booking lifecycle.
3. Fix minimum-notice options, response-deadline computation, candidate bound, retry and policy-change behavior.
4. Update permissions, definition of done, milestones, acceptance matrix and demo scenarios.
5. Reconcile COR0015's request-conversation dependency and validate documentation links/consistency.

## Acceptance criteria

- [ ] AC1: The specification distinguishes instant booking from coach-approved requests and preserves backward-compatible existing-coach defaults.
- [ ] AC2: Multiple pending clients, non-exclusive capacity, exactly-one acceptance, automatic non-selection and terminal request states are explicit and testable.
- [ ] AC3: Minimum notice, seven-day maximum horizon, deterministic response deadlines and policy-edit behavior are unambiguous.
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

### Contracts, configuration, and operations

This ticket will change the product contract only. It adds no migration, dependency, environment variable or runtime operation.

## Validation results

Pending validation.

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

- The response formula must give a real decision interval near the minimum-notice cutoff; DEV0186 cannot complete with that boundary unresolved.
- Approval without notification delivery depends on coaches checking their in-app queue. Do not claim email or push behavior.
- A future attendance-reconfirmation feature must use separate status/timestamps rather than overloading pending booking requests.

## Completion and review references

- Completed: Not completed.
- Commit: Planning record included in this commit — `[DEV0182][DEV0183][DEV0184][DEV0185][DEV0186][DEV0187][DEV0188][DEV0189][DEV0190] Plan session collaboration and booking requests`; implementation not started.
- Review: No review created.
- Deployment or release: Documentation only; not deployed or released.
