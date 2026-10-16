# Ticket DEV0188: Persist multi-candidate booking requests

- Status: Completed
- Created: 2026-10-10
- Last updated: 2026-10-11
- Milestone: Scheduling-only booking-policy follow-up
- Coordination: [COR0016 — Coach-confirmed booking requests](../organisatory/COR0016-coach-confirmed-booking-requests.md)
- Related records: completed contract dependency [DEV0186 — Adopt booking-request and notice policies](../organisatory/DEV0186-adopt-booking-request-and-notice-policies.md), completed eligibility dependency [DEV0187 — Enforce booking-request eligibility](DEV0187-enforce-booking-request-eligibility.md), conversation consumer [DEV0183 — Persist authorized session notes](../../current/backend/DEV0183-persist-authorized-session-notes.md), direct-booking baseline [DEV0141 — Persist direct private bookings](DEV0141-persist-direct-private-bookings.md)

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

- A request is created only for an open occurrence whose start remains in the future. There is no fixed minimum notice. Its decision deadline is the earlier of 12 hours after the database submission instant or the occurrence start.
- Repeating the same client/occurrence request returns the active request. After a terminal unsuccessful attempt, including an explicit coach decline, the client may create a new request while the occurrence remains open and future.
- Pending requests leave the occurrence requestable. There is no instant-booking path and no pending candidate cap.
- Coach acceptance locks the occurrence and relevant active requests. Concurrent accepts produce exactly one confirmed booking and one accepted request.
- Decline closes one request while leaving the occurrence and other requests open. Withdrawal is client-only. Deadline reconciliation expires pending requests without creating a booking.
- Acceptance closes other pending requests as not selected with no coach-facing reason exposed to those clients.
- Closing the occurrence and its pending requests is one transaction. A concurrent acceptance, close or second acceptance produces exactly one consistent winner/outcome.
- Cancelling an accepted booking never revives older request attempts; a reopened occurrence requires new requests.

## Assumptions, decisions, and dependencies

- DEV0186 and DEV0187 completed on 2026-10-11; this ticket is Ready to implement the approved request lifecycle over the delivered eligibility boundary.
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

- [x] AC1: Multiple clients can hold independent pending requests for one open occurrence without changing its capacity state.
- [x] AC2: Same-active-request retries are idempotent; a later eligible attempt after any terminal unsuccessful outcome succeeds; future-start/deadline and actor checks fail closed.
- [x] AC3: Accepting one request atomically creates one confirmed booking and closes every other pending request as not selected.
- [x] AC4: Decline, withdrawal, expiry and coach occurrence closure are authorized terminal transitions that never consume capacity; closure also prevents new requests.
- [x] AC5: Client projections contain only that client's request while coach projections contain only the coach's requests; unrelated/cross-run actors receive nothing.
- [x] AC6: Fresh/upgrade migration, concurrency, database, unit, lint, type and build validation pass.

## Validation plan

- Run fresh and upgrade migrations plus database lint.
- Add pgTAP/database tests for constraints, grants, idempotency, repeat attempts, more than five simultaneous candidates, deadline reconciliation, concurrent accept/close operations and complete transactional rollback.
- Add repository/service/action tests for distinct projections and all result states.
- Run configured application tests, lint, type-check, format and production build. Browser flows remain DEV0189/DEV0190 responsibility.

## Implementation record

Implementation started and completed on 2026-10-11.

### Changes and rationale

- Added a dedicated, row-level-security-protected booking-request relation. Pending requests snapshot occurrence time and venue, remain independent from capacity, and use the earlier of 12 hours after submission or the occurrence start as their decision deadline.
- Added actor-scoped PostgreSQL functions for idempotent creation, withdrawal, decline, acceptance and coach occurrence closure. Acceptance uses deterministic locks, creates the existing capacity-one confirmed booking and marks other pending candidates `not-selected` in one transaction. Closing an occurrence makes it unavailable and marks its pending requests `occurrence-closed` without changing the recurring rule.
- Added bounded client and coach projections with keyset pagination and read-time expiry reconciliation. Clients receive only their own request and coach identity; coaches receive only requests addressed to them and client identity. The runtime role cannot read the raw relation.
- Added domain, repository and service boundaries plus thin server actions. The legacy action name now delegates to request creation so no server-action path can restore direct booking; DEV0189 and DEV0190 own the visible queue and client flow.
- Extended database, application and server-action coverage for six simultaneous candidates, stable pagination, retries, deadlines, privacy, authorization, atomic races, rollback, cancellation recovery and coach suspension.

### Affected files

| File or component                                                                             | Change and purpose                                                                                                                                                  |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/migration-history/20261016000100/20261011000200_persist_coach_booking_requests.sql` | Adds the private request schema, exact booking/location relationships, constraints, indexes, actor mutations, closure triggers and bounded participant projections. |
| `src/domain/coach-booking-requests.ts`                                                        | Defines the approved lifecycle states and distinct client/coach projection contracts.                                                                               |
| `src/server/db/coaches/booking-request-repository.ts`                                         | Maps actor-scoped PostgreSQL functions into validated, bounded application records without exposing raw rows.                                                       |
| `src/server/coaches/booking-request-service.ts`                                               | Reauthorizes client and coach operations and supplies participant workspaces.                                                                                       |
| `src/app/coach-marketplace-actions.ts`                                                        | Exposes request, withdrawal, decision and occurrence-closure actions while preserving a safe compatibility alias for the disabled direct-booking action.            |
| `tests/coach-bookings.test.ts` and `tests/server/coach-booking-request-actions.test.ts`       | Cover lifecycle-state parsing and malformed public action inputs.                                                                                                   |
| `tests/database/coach-bookings.test.ts`                                                       | Exercises complete request behavior, concurrency, privacy, rollback and integration with existing bookings.                                                         |
| `supabase/tests/database/coach-booking-requests.test.sql`                                     | Verifies grants, row-level security, indexes, exact relationships, constraints and trigger privacy with pgTAP.                                                      |
| `README.md`                                                                                   | Records the delivered backend lifecycle and remaining interface slices.                                                                                             |

### Decisions and deviations

- 2026-10-11: Removed instant-mode/policy branches and the five-candidate cap. Added repeat attempts after coach decline and atomic coach closure of an unavailable occurrence.
- 2026-10-11: Removed the 24-hour minimum notice. To preserve the 12-hour coach window without allowing a request to outlive its session, the deadline is `least(created_at + 12 hours, scheduled_start_at)`.
- 2026-10-11: Raw request rows are not selectable by the runtime role. Separate security-definer projections are the only read boundary, which makes client/coach privacy structural rather than dependent on application filtering.
- 2026-10-11: Read-time reconciliation processes at most 100 due rows and participant pages contain at most 50 records. This keeps the first release bounded without requiring a background scheduler.
- 2026-10-11: Request creation timestamps are stored at millisecond precision because JavaScript cursor values have millisecond precision. This preserves exact `(created_at, id)` keyset pagination when several requests arrive within one millisecond.

### Contracts, configuration, and operations

The change adds one forward-only migration, a new request-status/domain shape, participant projection functions and server-action contracts. It adds no package, external service, environment variable or setup step. Existing confirmed-booking rows require no backfill. Rollback would require first removing any request rows and their accepted-booking links, so normal operations should use forward migrations rather than destructive rollback.

## Validation results

Validated on 2026-10-11 against the local Supabase PostgreSQL stack and a disposable fresh database.

- `npm test` passed 101 application/domain tests and 8 server-action tests.
- `npm run test:db` passed all 46 database integration tests. The focused booking file passed all 15 cases after a final rerun caught and fixed microsecond-to-millisecond cursor truncation.
- Direct execution of `supabase/tests/database/coach-booking-requests.test.sql` passed all 12 pgTAP assertions. The repository's `npm run db:test` wrapper did not complete because Docker stalled while inspecting `public.ecr.aws/supabase/pg_prove:3.36`; it was stopped after more than two minutes. Running the exact SQL test directly against the same local database supplied the missing assertion evidence.
- `npm run db:lint`, `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build` and `git diff --check` passed. The build completed under the current Node 20 shell with the repository's existing warning that Node 24 is the supported target.
- Upgrade validation applied the migration to the existing local database without resetting its data. Fresh validation created a disposable Supabase-shaped database, applied all 43 migrations, verified the request table, runtime mutation grant, raw-table privacy, five-column accepted-booking relationship and millisecond cursor precision, then removed the database.
- Browser validation was not run because visible request surfaces belong to DEV0189 and DEV0190; this ticket adds no enabled browser control.

| Criterion | Evidence                                                                                                                             | Result |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| AC1       | Six-client integration case verifies independent pending rows and an unchanged open occurrence.                                      | Passed |
| AC2       | Idempotency, terminal retry, actor rejection, deadline and future-start cases pass.                                                  | Passed |
| AC3       | Concurrent acceptance creates exactly one accepted request and booking; peers become `not-selected`.                                 | Passed |
| AC4       | Withdrawal, decline, expiry, closure, cancellation recovery and rollback cases pass.                                                 | Passed |
| AC5       | Projection, row-level-security, unrelated-actor and client serialization assertions pass.                                            | Passed |
| AC6       | Upgrade/fresh migration and all listed automated quality gates pass; the pgTAP SQL passed directly despite the Docker wrapper stall. | Passed |

## Risks, limitations, and follow-ups

- Visible coach and client request interfaces are intentionally absent until DEV0189 and DEV0190; the new server actions and projections are backend contracts only.
- Expiry is reconciled by participant reads and mutations rather than a background scheduler. This is sufficient for authoritative state and bounded views, but no external notification is emitted at the instant a request expires.
- Conversation and training-plan content remains separate and is owned by COR0015/DEV0183.
- Email/push notifications, waitlists, ranking and attendance confirmation remain out of scope.

## Completion and review references

- Completed: 2026-10-11.
- Commit: Planning record was included in `[DEV0182][DEV0183][DEV0184][DEV0185][DEV0186][DEV0187][DEV0188][DEV0189][DEV0190] Plan session collaboration and booking requests`; the implementation commit has not yet been created.
- Review: No review created.
- Deployment or release: Not deployed or released.
