# Ticket DEV0128: Persist credit-backed private bookings

- Status: Completed
- Created: 2026-10-04
- Last updated: 2026-10-04
- Milestone: Marketplace M3 pass-backed booking
- Coordination: [COR0010 — Coach-pass and group-funded marketplace MVP](../../current/organisatory/COR0010-group-funded-coach-marketplace-mvp.md)
- Related records: depends on completed [DEV0127](../blockchain/DEV0127-implement-coach-client-credit-ledger.md), completed [DEV0131](../blockchain/DEV0131-implement-coach-credit-booking-lifecycle.md) and completed coach availability under [DEV0114](DEV0114-persist-recurring-coach-availability.md); supplies booking/client-card projections to [DEV0129](../../current/frontend/DEV0129-present-coach-passes-bookings-and-client-cards.md) and hosted evidence to [DEV0125](../../current/backend/DEV0125-rehearse-hosted-marketplace-loops.md)

## Objective and context

Persist capacity-one calendar bookings that reserve and consume a client's coach-specific pass credits while applying the coach's published early-cancellation cutoff and explicit late-cancellation decision.

## Scope and non-goals

- In scope: a coach-owned cancellation policy; a 10-minute capacity-one slot hold while a wallet operation is pending; booking, cancellation-decision and settlement state; idempotent reserve/return/consume operation records; finalized credit-ledger and reservation projections supplied by a trusted server verifier; automatic early-return preparation; coach approve/deny late cancellation; client booking reads; and coach-side client-card projections joining finalized chain balance with authorized profile/booking data.
- Out of scope: UI composition, group events, disputes after completion, no-show adjudication, arbitrary session lengths, recurring subscriptions or private contact-data exposure.

## Expected behavior and edge cases

A client with a currently linked wallet and an indexed available coach credit can prepare one booking for one open one-hour occurrence. Preparation holds that slot for 10 minutes and creates one deterministic application booking UUID plus one prepared reserve operation; it does not keep a PostgreSQL transaction open while the wallet is asked to approve. A finalized matching reservation confirms the booking and marks the occurrence booked. A rejected or expired operation releases the hold only after the server-side chain adapter has established that the deterministic reservation is absent.

Early cancellation at or before the snapshotted cutoff prepares one return operation. A later pre-session request becomes `CancellationRequested`; the coach may approve the same return path or deny the request. A denied request remains chain-reserved until the scheduled start, when the coach may finalize consumption. A normally delivered session follows the same post-start consume path. Booking states are `Pending | Confirmed | CancellationRequested | Cancelled | Completed | Denied | Expired`; chain-operation states are independently `Prepared | Submitted | Finalized | Failed | Expired` so an application decision never masquerades as chain finality.

Concurrent booking, cancel, approval, retry and reload operations must converge on one lifecycle without oversubscribing a slot, promising the same projected credit to two pending bookings, double-returning a credit or overwriting a newer finalized balance projection with stale evidence.

## Assumptions, decisions, and dependencies

PostgreSQL owns scheduling, occurrence capacity and cancellation workflow. The Solana pair ledger and deterministic booking receipt own aggregate credit quantities and reserve/consume/return finality under DEV0131. The default early-cancellation cutoff is 24 hours and coaches may configure a bounded minute value; each booking freezes the value that applied when it was prepared. The 10-minute hold is an implementation default for P0 and is separate from the coach's cancellation policy.

DEV0128 accepts only normalized evidence returned by a trusted server verifier and checks that its program, coach authority, client wallet, pair ledger, booking UUID, reservation account, scheduled start, cutoff and terminal state match the prepared database snapshot. DEV0130 owns RPC reads, transaction construction/simulation/submission, commitment checks, account owner/discriminator validation and creation of that verified evidence. No browser payload or database row alone may create, return or consume a credit. Client cards expose only the client's display identity, wallet/ledger balance projection and bookings for the current coach; email and unrelated profile data remain private.

## Implementation plan

1. Add the bounded cancellation policy, credit projection, booking and chain-operation schema with row-level security, capacity/idempotency constraints and protected slot transitions.
2. Add domain contracts and server repositories for projection reconciliation, booking preparation/hold release, cancellation request/decision, post-start consumption and submitted/finalized operation recovery.
3. Require exact immutable-snapshot matching before finalized evidence may move a booking or balance projection, while keeping RPC verification and transaction submission behind the DEV0130 boundary.
4. Add client-booking and coach-client-card queries that expose only actor-authorized rows.
5. Validate policy boundaries, duplicate/concurrent preparation, stale evidence, exact reserve/return/consume transitions, reload recovery and cross-actor privacy.

## Acceptance criteria

- [x] AC1: One open one-hour slot and one finalized available coach-specific credit projection produce one held booking and, only after exact finalized `Reserved` evidence, exactly one confirmed booking.
- [x] AC2: Cancellation at the frozen cutoff prepares one idempotent return; later pre-session cancellation records one coach decision, with approval returning the credit and denial preserving it for post-start consumption.
- [x] AC3: Duplicate/concurrent preparation, cancellation, decision and finalization cannot oversubscribe a slot, promise one projected credit to two holds, or reserve/return/consume twice; rejected, expired and ambiguous operations recover to the same durable state.
- [x] AC4: A client sees only their bookings. A coach client card exposes only that coach's finalized balance projection plus relevant display identity and booking history, without another coach's relationship or private contact data.
- [x] AC5: DEV0128 performs no RPC trust decision or transaction submission; finalized changes require an exact normalized evidence contract that DEV0130 must populate after owner/discriminator/commitment verification.

## Validation plan

Database migration/constraint/repository tests, trusted-verifier fixture tests aligned with DEV0131 account projections, authorization/concurrency tests and a local multi-account database rehearsal. The real RPC/program rehearsal remains DEV0130.

## Implementation record

Implementation started on 2026-10-04 after reviewing the completed DEV0131 account/instruction contract and separating database workflow authority from DEV0130's RPC and transaction authority.

### Changes and rationale

Added a forward-only booking schema that keeps PostgreSQL responsible for capacity-one scheduling and human workflow while treating the DEV0131 Solana ledger/reservation as credit authority. Booking preparation now creates a stable application booking UUID, derives its deterministic reservation program-derived address (PDA), holds the selected occurrence for ten minutes and records a prepared reserve operation without keeping a database transaction open during wallet approval.

The database accepts finalized reserve, return and consume evidence only when every immutable field matches preparation: operation, booking, program, coach authority, client wallet, pair ledger, reservation PDA, scheduled start, frozen cutoff and expected terminal reservation state. A newer observed slot may advance the balance projection; stale evidence may finish its matching operation but cannot roll the projection backward, and conflicting equal-slot evidence is rejected. Submitted operations and exact finalized retries are idempotent.

Coaches now have a bounded early-cancellation policy, defaulting to 1,440 minutes. Each booking freezes that cutoff. An early client cancellation prepares one return operation; a later request waits for one durable coach approval or denial. Approval uses the return path, while denial leaves the credit reserved for the coach's post-start consume operation. A prepared/submitted reserve can release its slot immediately after a local wallet or simulation failure, or after the ten-minute hold only when the future verifier reports the reservation absent.

Added actor-scoped client booking reads and coach client cards. Cards contain the client's display name, linked wallet, pair-ledger address, finalized balances and only bookings for that coach-client relationship; they do not expose email or unrelated relationships. Direct runtime writes remain revoked and mutations run through authorization-aware security-definer functions.

### Affected files

| File or component                                                                                                                                                       | Change and purpose                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| [`src/domain/coach-bookings.ts`](../../../src/domain/coach-bookings.ts)                                                                                                 | Defines bounded booking, operation and normalized verifier-evidence contracts plus structural validation.                             |
| [`src/domain/coaches.ts`](../../../src/domain/coaches.ts)                                                                                                               | Exposes the coach's bounded early-cancellation policy in authoritative projections.                                                   |
| [`src/server/db/schema/bookings.ts`](../../../src/server/db/schema/bookings.ts)                                                                                         | Maps credit projections, private bookings and operation records with foreign keys, balance/state checks and idempotency indexes.      |
| [`src/server/db/schema/coaches.ts`](../../../src/server/db/schema/coaches.ts)                                                                                           | Maps the cancellation-policy column and the composite availability key needed by booking ownership constraints.                       |
| [`src/server/db/schema/index.ts`](../../../src/server/db/schema/index.ts)                                                                                               | Exports the new booking schema.                                                                                                       |
| [`src/server/db/coaches/booking-repository.ts`](../../../src/server/db/coaches/booking-repository.ts)                                                                   | Implements reservation-PDA derivation, protected lifecycle mutations, evidence finalization and actor-scoped projections.             |
| [`src/server/coaches/booking-service.ts`](../../../src/server/coaches/booking-service.ts)                                                                               | Provides authenticated server boundaries with stable saved/conflict outcomes and the combined booking/client-card workspace.          |
| [`src/server/db/coaches/repository.ts`](../../../src/server/db/coaches/repository.ts)                                                                                   | Reads and validates the cancellation policy with the existing coach projection.                                                       |
| [`supabase/migrations/20261004000200_create_credit_backed_private_bookings.sql`](../../../supabase/migrations/20261004000200_create_credit_backed_private_bookings.sql) | Adds tables, constraints, indexes, row-level security, least-privilege grants and lifecycle functions.                                |
| [`tests/coach-bookings.test.ts`](../../../tests/coach-bookings.test.ts)                                                                                                 | Covers bounded policy and normalized evidence validation.                                                                             |
| [`tests/database/coach-bookings.test.ts`](../../../tests/database/coach-bookings.test.ts)                                                                               | Exercises multi-actor reserve/return/deny/consume, retries, stale evidence, expiry, privacy and concurrency against local PostgreSQL. |
| [`tests/coach-schedule.test.ts`](../../../tests/coach-schedule.test.ts)                                                                                                 | Keeps the existing schedule fixture aligned with the expanded coach projection.                                                       |

### Decisions and deviations

- 2026-10-04: Used one ten-minute database hold instead of a long transaction across wallet approval. This gives a recoverable capacity boundary without pretending that a submitted transaction is finalized.
- 2026-10-04: Kept RPC reads, account owner/discriminator validation, transaction preparation and submission out of this ticket. DEV0130 must create the normalized evidence consumed here after real Devnet verification.
- 2026-10-04: Early cancellation prepares an idempotent return operation; it does not claim a credit was returned until exact finalized chain evidence arrives. This is the truthful interpretation of “automatic” under a user-authorized on-chain return.
- 2026-10-04: Full-suite validation exposed PostgreSQL's alternate `40P01` outcome for an existing concurrent availability exclusion race. The separate completed DEV0133 normalizes that repository error without expanding this booking ticket.

### Contracts, configuration, and operations

Migration `20261004000200_create_credit_backed_private_bookings.sql` adds `coach_profiles.early_cancellation_minutes`, a composite availability key and three application-owned projection/workflow tables. It grants runtime reads under actor row-level security and execute access only to bounded mutation functions; direct runtime writes remain revoked. The migration was validated from a clean local reset. It has not been applied to hosted staging, and it is forward-only; rollback would require an explicit reviewed migration because dropping booking history is destructive.

The server contract gains `VerifiedCoachCreditProjection` and `VerifiedBookingCreditOperation`. These values are normalized verifier output, not trusted browser input. No environment variable, secret, package dependency, API route or browser surface was added. `CoachProjection` now includes `earlyCancellationMinutes`, so downstream projections must retain that field. DEV0129 consumes the read/mutation shapes; DEV0130 supplies real RPC verification and transaction orchestration.

## Validation results

- Date and environment: 2026-10-04, local macOS workspace with local Supabase/PostgreSQL and Node.js project toolchain.
- `npm run db:reset` passed and replayed every migration plus deterministic seed from an empty local database. The reset intentionally removed the loopback runtime credential; `npm run db:runtime` restored it before integration tests.
- Focused `tests/database/coach-bookings.test.ts` passed 2/2 scenarios, including three actors, exact reserve/return/consume evidence, cross-actor rejection, duplicate finalization/cancellation, stale projection protection, late approve/deny, post-start consumption, hold expiry and concurrent slot contention.
- `npm run test:db` passed 29/29 database tests after DEV0133 normalized the existing availability exclusion race's `40P01` result.
- `npm test` passed 78/78 unit and source-boundary tests.
- `npm run typecheck`, `npm run lint`, `npm run db:lint`, `npm run format:check` and `git diff --check` passed without errors or warnings.
- `npm run build` passed with Next.js 16.3.8. `npm run build:vinext` passed for the Cloudflare/Vite target; it retained the existing informational large-client-chunk warning and static-analysis route-classification notice.
- A repository-local Markdown link check resolved all links across 97 files; focused Prettier checks for the changed project/ticket records and `git diff --check` also passed after archival.
- Browser checks were not run because this ticket adds no route or interface; DEV0129 owns responsive and keyboard interaction validation. No Devnet transaction was sent because DEV0130 owns RPC, signing, submission and Explorer evidence.

| Criterion | Evidence                                                                                                                                                                         | Result |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Focused database lifecycle confirms a held slot only becomes booked after matching `reserved` evidence; exact retry remains one booking.                                         | Passed |
| AC2       | Database lifecycle covers early idempotent return, late approval/return, late denial and post-start consume.                                                                     | Passed |
| AC3       | Concurrent two-client test yields one hold; rejected and expired holds reopen the slot; submitted/finalized retries and stale evidence converge safely.                          | Passed |
| AC4       | Three-actor projections show each client only their bookings and the coach only relationship-scoped cards without email.                                                         | Passed |
| AC5       | Source review and import-boundary tests confirm no RPC client or transaction sender in the domain/repository/service; finalization requires the exact normalized evidence shape. | Passed |

## Risks, limitations, and follow-ups

DEV0131 owns the completed exact reserve/consume/return program contract. This ticket must not duplicate those transitions in PostgreSQL; it persists only workflow state and finalized projections. DEV0130 must still implement the real verifier/transaction adapter and Devnet evidence, so fixture-backed finalized evidence in this ticket is not deployment proof.

The local test uses a privileged, transaction-scoped timestamp adjustment to exercise post-start consumption and hold expiry without waiting in real time; it does not fabricate chain finality in application code. Hosted migration, wallet prompts, Devnet transactions and interface behavior remain intentionally unverified here and are explicit DEV0130/DEV0129 follow-ups.

## Completion and review references

- Completed: 2026-10-04 — local booking persistence, recovery and authorized projections satisfy all acceptance criteria.
- Commit: Not created.
- Review: Self-review completed against the ticket acceptance criteria; no independent review created.
- Deployment or release: Not deployed; the migration and server code were validated locally only.
