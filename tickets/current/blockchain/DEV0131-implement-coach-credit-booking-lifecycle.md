# Ticket DEV0131: Implement the coach-credit booking lifecycle

- Status: Ready
- Created: 2026-10-04
- Last updated: 2026-10-04
- Milestone: Marketplace M3 local booking-credit program
- Coordination: [COR0010 — Coach-pass and group-funded marketplace MVP](../organisatory/COR0010-group-funded-coach-marketplace-mvp.md)
- Related records: extends the completed pair ledger in [DEV0127](../../archive/blockchain/DEV0127-implement-coach-client-credit-ledger.md); supplies authoritative credit mutations to [DEV0128](../backend/DEV0128-persist-credit-backed-private-bookings.md), [DEV0129](../frontend/DEV0129-present-coach-passes-bookings-and-client-cards.md) and [DEV0130](DEV0130-integrate-devnet-coach-pass-operations.md)

## Objective and context

Add the missing on-chain lifecycle that turns one purchased coach credit into one recoverable calendar booking reservation and then resolves that reservation exactly once. DEV0127 intentionally stopped at purchase and aggregate `available_credits`/`reserved_credits`; the current MVP also requires atomic reserve, consume and return transitions before PostgreSQL can safely coordinate capacity-one bookings under [the purchase and booking recovery contract](../../../docs/mvp-spec.md#purchase-and-redemption).

## Scope and non-goals

- In scope: one bounded `CreditReservation` PDA per actual booking; deterministic booking-reference seeds; `reserve_booking_credit`, `consume_booking_credit` and `return_booking_credit` instructions; checked aggregate balance transitions; client/coach authority and cutoff-time checks; immutable booking time/cutoff snapshots; terminal reservation receipts; structured events/errors; interface description language (IDL), generated Solana Kit client, derivation/projection helpers and adversarial local Surfpool tests.
- Out of scope: PostgreSQL booking/slot mutations, interface work, Devnet deployment, wallet transaction preparation, fee-sponsor policy, arbitrary session quantities, recurring subscriptions, attendance proof, coach/client disputes, pass transfer, wallet migration, reservation-account closure or group-event funding.

## Expected behavior and edge cases

The lifecycle is deliberately small:

1. A purchase leaves credits in `available_credits` on the existing coach-client pair ledger.
2. Booking preparation chooses one immutable application booking UUID, scheduled start and early-return cutoff. The client signs `reserve_booking_credit`; the program creates the deterministic reservation PDA, subtracts one available credit and adds one reserved credit atomically.
3. While the reservation is `Reserved`, exactly one terminal transition is permitted:
   - the client may return the credit at or before the snapshotted early-return cutoff;
   - the coach's current authority wallet may return it at any time, covering an approved late cancellation or coach cancellation; or
   - the coach's current authority wallet may consume it at or after the scheduled start, covering a previously denied late cancellation or session completion.
4. Return subtracts one reserved credit and restores one available credit. Consume subtracts one reserved credit without changing available credits. `total_purchased` never changes, so spent credits remain derivable as `total_purchased - available_credits - reserved_credits`.
5. The terminal `Returned | Consumed` reservation account remains as a bounded receipt in P0. Repeating reserve with the same booking UUID, resolving twice, using the wrong pair ledger, signer, coach authority or time window, or underflowing/overflowing a balance must fail without partial mutation.

PostgreSQL remains authoritative for whether a calendar occurrence exists, is capacity-one and matches the immutable reservation snapshot. A client can construct an unrelated reservation for their own credits, but the application must never confirm a booking unless the finalized PDA contains the expected coach, client, UUID, time and cutoff. An ambiguous submission is recovered by reading that PDA and the pair ledger before offering another transaction.

## Assumptions, decisions, and dependencies

Use one fixed-size `CreditReservation` PDA derived from `['credit-reservation', coach_client_credits, booking_uuid]`. The account stores version, pair-ledger address, coach authority, client wallet, 16-byte booking UUID, scheduled start, early-return cutoff, `Reserved | Returned | Consumed` status, reserve/resolve timestamps, bump and reserved layout space. Keeping a terminal receipt costs one rent-exempt account deposit per booking but gives simple replay protection and recovery without an unbounded list inside the pair ledger; account closure and compact archival are explicitly deferred.

The client wallet is the reserve authority. Return accepts either that client before the cutoff or the coach's current authority wallet at any time. Consume requires the coach's current authority wallet and is unavailable before the scheduled start. A denied late cancellation therefore remains reserved until the scheduled start, when it may be consumed; PostgreSQL records the earlier decision. A separate fee payer may fund network fees or account rent but never substitutes for either authority. The chain records only the credit result; PostgreSQL records whether a coach return meant an approved late cancellation or coach cancellation, and whether consumption meant completion or an earlier denial. Solana does not prove attendance.

DEV0127's `CoachAuthority`, `Offer` and `CoachClientCredits` seeds/layouts remain compatible. The existing aggregate ledger already has available and reserved counters, so this ticket adds a separate reservation account rather than an unbounded collection or a new ledger per booking. DEV0130 must integrate these instructions with purchases before the program is treated as Devnet-complete.

## Implementation plan

1. Add the reservation seed/version/status/account plus checked pure transition helpers and account-size tests.
2. Add reserve, consume and return instructions with exact PDA, relationship, signer, clock and balance constraints; emit structured events and bounded errors.
3. Extend the program entrypoints, IDL, generated Kit client and browser/server-safe derivation/projection helpers.
4. Extend the embedded Surfpool suite through purchase, multiple reservations, early client return, coach return and coach consume, including adversarial signer/time/replay/account-substitution/rollback cases.
5. Run Rust unit/clippy/format checks, Anchor build and IDL parity, generated-codec and repository tests, type/lint/build checks, the required program autofixer and a focused security review. Record exact evidence before completion.

## Acceptance criteria

- [ ] AC1: A valid client reservation atomically moves exactly one credit from available to reserved and creates one deterministic booking receipt without changing total purchased.
- [ ] AC2: A valid return atomically moves exactly one credit from reserved to available under the early-client or coach-authorized rule; invalid time/signers and retries leave all state unchanged.
- [ ] AC3: A valid coach consume atomically removes exactly one reserved credit only at or after the scheduled start; invalid time/signers and retries leave all state unchanged.
- [ ] AC4: One booking UUID cannot reserve or reach more than one terminal outcome, and unrelated coach/client/ledger/account substitutions are rejected.
- [ ] AC5: IDL, generated client and helper contracts expose deterministic reservation derivation and all lifecycle states/events without requiring PostgreSQL data on chain.
- [ ] AC6: Rust, generated-codec and embedded-Surfpool tests prove successful and adversarial multi-booking transitions against the compiled program; no Devnet transaction is required for this local ticket.

## Validation plan

Use Rust unit tests for checked arithmetic, status transitions, time rules, account sizing and rollback-before-mutation. Use TypeScript codec/derivation tests for the generated account/instructions/events. Extend the existing embedded Surfpool lifecycle with in-memory client, coach, sponsor and attacker signers; purchase credits, reserve distinct booking UUIDs, exercise every valid resolution path, and assert PDA/ledger state after wrong signer, wrong pair, duplicate reference, pre-start consume, post-cutoff client return and replay attempts. Run `NO_DNA=1 cargo test -p movx-coach-pass`, clippy with denied warnings, Rust formatting, `NO_DNA=1 anchor build --skip-lint`, IDL parity/Codama generation, focused and repository TypeScript tests, typecheck, lint, format and production build. Run the configured Solana program autofixer after program edits. DEV0130 owns later Devnet evidence and explicit wallet approval.

## Implementation record

Pending implementation. The ticket is ready because the account, authority and transition contract is now explicit; no program source has been changed under DEV0131.

### Changes and rationale

Not implemented yet. Planning selects one bounded receipt per actual booking because aggregate counters alone cannot prove which booking was reserved or stop a resolved booking from being replayed.

### Affected files

| File or component                                                      | Change and purpose                                                     |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Planned `programs/movx-coach-pass/` state/instructions/events/errors   | Add the reservation receipt and three checked lifecycle transitions.   |
| Planned `idl/`, `clients/js/` and `src/solana/coach-pass.ts` contracts | Regenerate and expose deterministic typed client boundaries.           |
| Planned Rust, generated-client and Surfpool tests                      | Prove transition invariants, authority, replay rejection and rollback. |

### Decisions and deviations

- 2026-10-04: Added DEV0131 as a separate blockchain peer instead of putting program instructions inside backend DEV0128. This preserves one primary implementation area per ticket and keeps PostgreSQL from becoming credit authority.
- 2026-10-04: Chose one retained fixed-size reservation PDA per actual booking over an unbounded map or aggregate counters alone. The extra rent deposit is accepted for P0 in exchange for deterministic recovery and replay-safe terminal receipts.

### Contracts, configuration, and operations

Planned additions are one program account, one status enum, three instructions, three event families, errors and generated client types. No environment variable, secret, database migration or deployment is part of this ticket. Existing pair-ledger addresses remain stable; new reservation addresses are deterministic from the pair ledger and application booking UUID.

## Validation results

Planning/document validation passed; runtime checks have not run because implementation has not started.

- Date and environment: 2026-10-04, repository documentation.
- Exact commands and outcomes: a read-only Node link check validated every repository-relative Markdown link in the nine changed documents; targeted `rg` found no reference to the retired DEV0130 filename; Prettier passed for the eight changed prose/ticket documents governed by the repository formatter; `git diff --check` passed. `tickets/README.md` was checked through its exact new rows and link validation rather than bulk-reformatting unrelated historical table rows.
- Manual steps and observed outcomes: reviewed DEV0127 state, the MVP booking contract and DEV0128/DEV0130 boundaries; confirmed aggregate counters alone do not identify or terminally resolve a particular booking.
- Failed, blocked, or not-run checks and reasons: program/application tests are not run for ticket creation; they are required before this ticket can complete.

| Criterion | Evidence                   | Result  |
| --------- | -------------------------- | ------- |
| AC1–AC6   | Implementation not started | Not run |

## Risks, limitations, and follow-ups

Retaining one receipt PDA per booking locks a small rent-exempt deposit until a separately designed archival/closure mechanism exists. The chain cannot prove that the off-chain occurrence or cancellation reason is truthful; the application must verify the exact snapshot before confirming a booking, while the program guarantees only authority and credit arithmetic. Wallet replacement does not migrate an existing pair ledger or its reservations and remains a separate product/security decision.

DEV0128 owns the database state machine and two-phase recovery around these operations. DEV0130 owns Devnet deployment, transaction preparation/simulation/verification and public evidence for purchases plus booking-credit transitions. DEV0129 owns the human-facing wallet, booking, cancellation and client-card states.

## Completion and review references

- Completed: Not completed.
- Commit: Planning contract included in `[DEV0131] Define coach-credit booking lifecycle`; implementation will require a later DEV0131 commit before completion.
- Review: Planning self-review only; no independent review.
- Deployment or release: None.
