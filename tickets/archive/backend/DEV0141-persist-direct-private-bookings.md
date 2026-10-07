# Ticket DEV0141: Persist direct private bookings

- Status: Completed
- Created: 2026-10-07
- Last updated: 2026-10-07
- Milestone: Scheduling-only booking core
- Coordination: [COR0011 — Scheduling-only product branch](../organisatory/COR0011-scheduling-only-product.md)
- Related records: replaces the chain-coupled booking behavior implemented historically by [DEV0128](DEV0128-persist-credit-backed-private-bookings.md); consumes recurring availability from [DEV0114](DEV0114-persist-recurring-coach-availability.md)

## Objective and context

Make private scheduling authoritative in PostgreSQL so an email-authenticated client can reserve one future open coach occurrence without a pass, wallet, credit projection or blockchain transaction. Preserve capacity-one concurrency, actor authorization and durable cancellation/completion state.

## Scope and non-goals

- In scope:
  - Add a forward migration that permits scheduling-only bookings while preserving existing historical rows.
  - Replace chain-evidence domain/repository/service contracts with direct booking, client/coach cancellation and coach completion operations.
  - Expose client and coach booking projections containing only scheduling identity/time/location/status data.
  - Add focused unit and database tests for authorization, self-booking rejection, concurrency, idempotency and terminal transitions.
- Out of scope:
  - Payment, credits, cancellation fees, waitlists, group sessions, attendance disputes or calendar-provider sync.
  - Destructive removal of historical wallet/credit/event tables from existing databases.
  - Public route/component redesign owned by DEV0143.

## Expected behavior and edge cases

- A verified client can book one visible coach's future `open` one-hour occurrence; the booking immediately becomes `confirmed` and the slot becomes `booked` atomically.
- Repeating the same request by the same client returns the existing active booking; a competing client receives a conflict.
- Coaches cannot book their own occurrences; hidden coaches, elapsed/non-open slots and cross-run identifiers fail closed.
- The owning client or coach can cancel a confirmed future booking once; cancellation records the actor and reopens the occurrence when it is still future.
- The owning coach can mark a confirmed elapsed booking completed once. Wrong actors and invalid transitions cannot mutate it.

## Assumptions, decisions, and dependencies

- DEV0140 defines the authoritative scheduling behavior.
- Existing `coach_private_bookings` rows and chain columns remain readable history, but new scheduling rows use no credit projection or operation journal.
- UUID booking identity and the existing active-slot unique index provide stable idempotency/concurrency boundaries.

## Implementation plan

1. Add a forward migration for nullable historical credit linkage and direct booking/cancel/complete functions with actor-context authorization and cancellation-actor evidence.
2. Simplify Drizzle schema and booking domain projections to scheduling-only fields.
3. Replace booking repository/service methods and server actions.
4. Rewrite focused unit/database tests and relevant seed/runtime validation.
5. Run migration replay/database tests where available plus unit, lint, type and build checks.

## Acceptance criteria

- [x] AC1: Direct booking requires an authorized non-owner client and atomically enforces one active booking per open future slot.
- [x] AC2: Repeated same-client booking is idempotent while competing/invalid requests fail without partial state.
- [x] AC3: Client/coach cancellation and coach completion enforce ownership, time and lifecycle rules and survive reload.
- [x] AC4: Runtime booking projections contain no wallet, credit, token, transaction or chain reference.
- [x] AC5: Focused unit/database validation and repository static/build checks pass.

## Validation plan

Run focused booking tests, local Supabase migration replay and database tests if available, then the repository unit/server suite, lint, type checking and production build. Record any environment blocker precisely.

## Implementation record

Direct private scheduling is now authoritative in PostgreSQL. An authorized client books a future one-hour occurrence without any financial or chain state; the booking, cancellation and completion projection is bounded to its client and coach.

### Changes and rationale

- Added an additive migration that leaves historical credit-backed rows intact while permitting direct rows with a null historical credit reference.
- Added security-definer book, cancel and complete functions. They validate transaction-local actor context, lock the relevant state, preserve capacity one, reject self/cross-run/hidden/elapsed input and make retries idempotent.
- Added a bounded actor-scoped projection function because ordinary row-level policies intentionally hide booked availability from clients and unrelated client profiles from coaches.
- Replaced the runtime booking domain, repository, service and server actions with scheduling-only contracts. New projections contain only booking identities, participant display context, time, location and lifecycle evidence.
- Replaced chain-oriented booking tests with direct lifecycle, authorization, self-booking, hidden-coach, concurrency, cancellation and coach-completion coverage.

### Affected files

| File or component                                                                  | Change and purpose                                                                                               |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/20261007000100_adopt_scheduling_only_bookings.sql`            | Adds direct booking, cancellation, completion and bounded projection functions while preserving historical rows. |
| `src/domain/coach-bookings.ts`                                                     | Defines the three-state scheduling lifecycle and financial-reference-free projection.                            |
| `src/server/db/schema/bookings.ts`                                                 | Mirrors the additive nullable historical link and cancellation actor evidence.                                   |
| `src/server/db/coaches/booking-repository.ts`                                      | Owns validated direct mutations and actor-scoped projections.                                                    |
| `src/server/coaches/booking-service.ts` and `src/app/coach-marketplace-actions.ts` | Expose bounded authorization/conflict/unavailable outcomes to the interface.                                     |
| `tests/coach-bookings.test.ts` and `tests/database/coach-bookings.test.ts`         | Cover the scheduling contract and real database lifecycle/concurrency rules.                                     |

### Decisions and deviations

- 2026-10-07: Preserve old database rows and migrations rather than automatically dropping financial history; current runtime contracts will stop reading them.
- 2026-10-07: Return booking projections through a bounded security-definer function. Direct joins were rejected because forced row-level security correctly hides a booked slot from its client and an unrelated client's profile from the coach.

### Contracts, configuration, and operations

Hosted databases must apply the new forward migration before deploying this branch. No new environment variable, provider operation, destructive data migration or rollback script was introduced. Existing historical rows retain their non-null credit reference and old columns; new runtime rows leave that reference null.

## Validation results

| Criterion | Evidence                                                                                                                                                    | Result |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | `npm run db:reset` replayed all migrations and seed data; the focused booking suite passed 5/5 including self/hidden rejection and capacity one.            | Passed |
| AC2       | `tests/database/coach-bookings.test.ts` passed same-client retry and a concurrent two-client race with exactly one winner.                                  | Passed |
| AC3       | The same suite passed client cancellation, coach cancellation, occurrence reopening, unauthorized rejection and idempotent coach completion.                | Passed |
| AC4       | Unit projection-key coverage passed; repository queries filter direct rows and the application runtime has no financial/chain booking fields.               | Passed |
| AC5       | `npm run test:db` passed 28/28; `npm run db:test` passed 143 pgTAP checks; `npm run db:lint`, unit tests, lint, type checking and production builds passed. | Passed |

## Risks, limitations, and follow-ups

- Hosted databases require the new forward migration before the scheduling branch can accept bookings.
- Historical booking/payment tables remain in provider databases and migration replay by design; this ticket does not destroy financial history.

## Completion and review references

- Completed: 2026-10-07.
- Commit: Included in `[DEV0140][DEV0141][DEV0142][DEV0143][DEV0144][DEV0145] Adopt scheduling-only product`.
- Review: Implementation and acceptance-criteria self-review completed; no independent review or pull request created.
- Deployment or release: None.
