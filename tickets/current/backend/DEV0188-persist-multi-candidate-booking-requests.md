# Ticket DEV0188: Persist multi-candidate booking requests

- Status: Draft
- Created: 2026-10-10
- Last updated: 2026-10-10
- Milestone: Scheduling-only booking-policy follow-up
- Coordination: [COR0016 — Coach-confirmed booking requests](../organisatory/COR0016-coach-confirmed-booking-requests.md)
- Related records: contract dependency [DEV0186 — Adopt booking-request and notice policies](../organisatory/DEV0186-adopt-booking-request-and-notice-policies.md), policy dependency [DEV0187 — Persist coach booking policies](DEV0187-persist-coach-booking-policies.md), conversation consumer [DEV0183 — Persist authorized session notes](DEV0183-persist-authorized-session-notes.md), direct-booking baseline [DEV0141 — Persist direct private bookings](../../archive/backend/DEV0141-persist-direct-private-bookings.md)

## Objective and context

Persist independent client requests for approval-required occurrences and let the owning coach select exactly one client. Unlike a hold, a pending request does not consume occurrence capacity: several eligible clients may request the same time, and only an atomic coach acceptance creates the existing capacity-one confirmed booking.

## Scope and non-goals

- In scope:
  - Add booking-request identity, actor/occurrence relationships, immutable policy/deadline snapshots, statuses and transition evidence.
  - Add idempotent request creation, client withdrawal, coach decline, bounded expiry reconciliation and coach acceptance.
  - Enforce one active request per client/occurrence and the contract's bounded pending candidate count.
  - On acceptance, atomically create/recover the one confirmed booking, mark the occurrence booked, accept the selected request and close all remaining pending requests as not selected.
  - Add separate coach/client projections that never reveal other candidate data to a client.
- Out of scope:
  - Shared/private request conversation content owned by COR0015/DEV0183.
  - Policy settings owned by DEV0187 and interfaces owned by DEV0189/DEV0190.
  - Automated scoring/ranking, waitlist promotion, payments, notifications or attendance confirmation.

## Expected behavior and edge cases

- A request is accepted only for an open future occurrence whose coach requires approval and whose minimum-notice/candidate/deadline checks pass.
- Repeating the same client/occurrence request returns the active request. A sixth request at a five-candidate bound fails without revealing why to unrelated clients.
- Pending requests leave the occurrence requestable. Instant booking cannot bypass an approval-required policy.
- Coach acceptance locks the occurrence and relevant active requests. Concurrent accepts produce exactly one confirmed booking and one accepted request.
- Decline closes one request while leaving the occurrence and other requests open. Withdrawal is client-only. Deadline reconciliation expires pending requests without creating a booking.
- Acceptance closes other pending requests as not selected with no coach-facing reason exposed to those clients.
- Switching coach policy later does not rewrite existing request snapshots or terminal history.

## Assumptions, decisions, and dependencies

- DEV0186 and DEV0187 must complete before this ticket becomes Ready.
- Use a dedicated request relation rather than overloading the capacity-one booking row; an accepted request links to the created booking.
- Expiry may be reconciled transactionally on public/participant reads and mutations for the first release; a background scheduler is not required unless validation proves bounded reconciliation insufficient.
- Request projections contain stable coach/client display identity, scheduled time/location snapshot, own status, created/decision timestamps and deadline. Client projections contain no other request IDs/counts/statuses.

## Implementation plan

1. Add request schema, constraints, indexes, grants and audit-safe transition fields.
2. Implement actor-aware request/withdraw/decline/accept/reconcile database functions with deterministic locks.
3. Add domain, repository, service and server-action contracts with distinct coach/client projections.
4. Test idempotency, candidate bounds, deadlines, policy snapshots, concurrent selection, rollback and privacy.
5. Run complete database/application validation before handing the contract to DEV0189/DEV0190 and DEV0183.

## Acceptance criteria

- [ ] AC1: Multiple clients can hold independent pending requests for one open occurrence without changing its capacity state.
- [ ] AC2: Same-client retries are idempotent; candidate bounds, notice/deadline and actor checks fail closed.
- [ ] AC3: Accepting one request atomically creates one confirmed booking and closes every other pending request as not selected.
- [ ] AC4: Decline, withdrawal and expiry are authorized terminal transitions that never consume capacity.
- [ ] AC5: Client projections contain only that client's request while coach projections contain only the coach's requests; unrelated/cross-run actors receive nothing.
- [ ] AC6: Fresh/upgrade migration, concurrency, database, unit, lint, type and build validation pass.

## Validation plan

- Run fresh and upgrade migrations plus database lint.
- Add pgTAP/database tests for constraints, grants, idempotency, five-candidate bound, deadline reconciliation, concurrent accepts and complete transactional rollback.
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

No implementation decisions or deviations recorded yet.

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

## Completion and review references

- Completed: Not completed.
- Commit: Planning record included in this commit — `[DEV0182][DEV0183][DEV0184][DEV0185][DEV0186][DEV0187][DEV0188][DEV0189][DEV0190] Plan session collaboration and booking requests`; implementation not started.
- Review: No review created.
- Deployment or release: Not deployed or released.
