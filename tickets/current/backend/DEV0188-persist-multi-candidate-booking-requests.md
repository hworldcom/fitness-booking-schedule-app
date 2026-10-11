# Ticket DEV0188: Persist multi-candidate booking requests

- Status: Draft
- Created: 2026-10-10
- Last updated: 2026-10-11
- Milestone: Scheduling-only booking-policy follow-up
- Coordination: [COR0016 — Coach-confirmed booking requests](../organisatory/COR0016-coach-confirmed-booking-requests.md)
- Related records: completed contract dependency [DEV0186 — Adopt booking-request and notice policies](../../archive/organisatory/DEV0186-adopt-booking-request-and-notice-policies.md), eligibility dependency [DEV0187 — Enforce booking-request eligibility](DEV0187-enforce-booking-request-eligibility.md), conversation consumer [DEV0183 — Persist authorized session notes](DEV0183-persist-authorized-session-notes.md), direct-booking baseline [DEV0141 — Persist direct private bookings](../../archive/backend/DEV0141-persist-direct-private-bookings.md)

## Objective and context

Persist independent client requests for every eligible occurrence and let the owning coach select exactly one client or close the occurrence when no longer available. Unlike a hold, a pending request does not consume occurrence capacity: several eligible clients may request the same time, and only an atomic coach acceptance creates the existing capacity-one confirmed booking.

## Scope and non-goals

- In scope:
  - Add booking-request identity, actor/occurrence relationships, immutable timing/deadline snapshots, statuses and transition evidence.
  - Add idempotent request creation, client withdrawal, coach decline, bounded expiry reconciliation and coach acceptance.
  - Enforce one active request per client/occurrence while allowing a new attempt after withdrawal, expiry, coach decline or non-selection if the occurrence remains eligible; impose no product-level pending candidate cap.
  - On acceptance, atomically create/recover the one confirmed booking, mark the occurrence booked, accept the selected request and close all remaining pending requests as not selected.
  - Let the owning coach atomically close one occurrence without accepting a request, preventing new requests and closing every pending request as unavailable without editing the recurring rule.
  - Add separate coach/client projections that never reveal other candidate data to a client.
- Out of scope:
  - Shared/private request conversation content owned by COR0015/DEV0183.
  - Fixed request eligibility owned by DEV0187 and interfaces owned by DEV0189/DEV0190.
  - Automated scoring/ranking, waitlist promotion, payments, notifications or attendance confirmation.

## Expected behavior and edge cases

- A request is created only for an open occurrence whose start is at least 24 hours away. Its decision deadline is exactly 12 hours after the database submission instant.
- Repeating the same client/occurrence request returns the active request. After a terminal unsuccessful attempt, including an explicit coach decline, the client may create a new request before the occurrence cutoff.
- Pending requests leave the occurrence requestable. There is no instant-booking path and no pending candidate cap.
- Coach acceptance locks the occurrence and relevant active requests. Concurrent accepts produce exactly one confirmed booking and one accepted request.
- Decline closes one request while leaving the occurrence and other requests open. Withdrawal is client-only. Deadline reconciliation expires pending requests without creating a booking.
- Acceptance closes other pending requests as not selected with no coach-facing reason exposed to those clients.
- Closing the occurrence and its pending requests is one transaction. A concurrent acceptance, close or second acceptance produces exactly one consistent winner/outcome.
- Cancelling an accepted booking never revives older request attempts; a reopened occurrence requires new requests.

## Assumptions, decisions, and dependencies

- DEV0186 and DEV0187 must complete before this ticket becomes Ready.
- Use a dedicated request relation rather than overloading the capacity-one booking row; an accepted request links to the created booking.
- Expiry may be reconciled transactionally on public/participant reads and mutations for the first release; a background scheduler is not required unless validation proves bounded reconciliation insufficient.
- Request projections contain stable coach/client display identity, scheduled time/location snapshot, own status, created/decision timestamps and deadline. Client projections contain no other request IDs/counts/statuses. Coach list projections use bounded pagination even though the product imposes no candidate cap.
- Store and compare instants independently of local time. The Berlin-only first release displays deadlines in `Europe/Berlin`.

## Implementation plan

1. Add request schema, constraints, indexes, grants and audit-safe transition fields.
2. Implement actor-aware request/withdraw/decline/accept/reconcile database functions with deterministic locks.
3. Add domain, repository, service and server-action contracts with distinct coach/client projections.
4. Test active-request idempotency, repeat attempts, unlimited-candidate pagination, deadlines, concurrent accept/close outcomes, rollback and privacy.
5. Run complete database/application validation before handing the contract to DEV0189/DEV0190 and DEV0183.

## Acceptance criteria

- [ ] AC1: Multiple clients can hold independent pending requests for one open occurrence without changing its capacity state.
- [ ] AC2: Same-active-request retries are idempotent; a later eligible attempt after any terminal unsuccessful outcome succeeds; notice/deadline and actor checks fail closed.
- [ ] AC3: Accepting one request atomically creates one confirmed booking and closes every other pending request as not selected.
- [ ] AC4: Decline, withdrawal, expiry and coach occurrence closure are authorized terminal transitions that never consume capacity; closure also prevents new requests.
- [ ] AC5: Client projections contain only that client's request while coach projections contain only the coach's requests; unrelated/cross-run actors receive nothing.
- [ ] AC6: Fresh/upgrade migration, concurrency, database, unit, lint, type and build validation pass.

## Validation plan

- Run fresh and upgrade migrations plus database lint.
- Add pgTAP/database tests for constraints, grants, idempotency, repeat attempts, more than five simultaneous candidates, deadline reconciliation, concurrent accept/close operations and complete transactional rollback.
- Add repository/service/action tests for distinct projections and all result states.
- Run configured application tests, lint, type-check, format and production build. Browser flows remain DEV0189/DEV0190 responsibility.

## Implementation record

Pending implementation.

### Changes and rationale

Pending implementation.

### Affected files

| File or component | Change and purpose |
| ----------------- | ------------------ |
| Pending           | Pending.           |

### Decisions and deviations

- 2026-10-11: Removed instant-mode/policy branches and the five-candidate cap. Added repeat attempts after coach decline and atomic coach closure of an unavailable occurrence.

### Contracts, configuration, and operations

Expected changes are one additive request migration and new bounded domain/server contracts. No external service or environment-variable change is planned.

## Validation results

Pending validation.

- Date and environment: Not run.
- Exact commands and outcomes: Not run.
- Manual steps and observed outcomes: Not run.
- Failed, blocked, or not-run checks: All checks await DEV0186/DEV0187 and implementation.

| Criterion | Evidence | Result  |
| --------- | -------- | ------- |
| AC1       | Pending  | Not run |
| AC2       | Pending  | Not run |
| AC3       | Pending  | Not run |
| AC4       | Pending  | Not run |
| AC5       | Pending  | Not run |
| AC6       | Pending  | Not run |

## Risks, limitations, and follow-ups

- Lock ordering must prevent two concurrent coach actions from accepting different clients.
- Request history must remain separate from confirmed booking capacity and from other candidates' private conversation content.
- Reconciliation without a background job must be triggered by every path that could otherwise present or mutate stale pending state.
- No candidate cap requires bounded indexes and pagination so storage/query behavior is not unbounded per response.

## Completion and review references

- Completed: Not completed.
- Commit: Planning record included in this commit — `[DEV0182][DEV0183][DEV0184][DEV0185][DEV0186][DEV0187][DEV0188][DEV0189][DEV0190] Plan session collaboration and booking requests`; implementation not started.
- Review: No review created.
- Deployment or release: Not deployed or released.
