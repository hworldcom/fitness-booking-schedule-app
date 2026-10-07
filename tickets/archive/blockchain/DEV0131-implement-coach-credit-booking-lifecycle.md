# Ticket DEV0131: Implement the coach-credit booking lifecycle

- Status: Completed
- Created: 2026-10-04
- Last updated: 2026-10-04
- Milestone: Marketplace M3 local booking-credit program
- Coordination: [COR0010 — Coach-pass and group-funded marketplace MVP](../../archive/organisatory/COR0010-group-funded-coach-marketplace-mvp.md)
- Related records: extends the completed pair ledger in [DEV0127](DEV0127-implement-coach-client-credit-ledger.md); supplies authoritative credit mutations to completed [DEV0128](../backend/DEV0128-persist-credit-backed-private-bookings.md), [DEV0129](../../archive/frontend/DEV0129-present-coach-passes-bookings-and-client-cards.md) and [DEV0130](../../archive/blockchain/DEV0130-integrate-devnet-coach-pass-operations.md)

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

- [x] AC1: A valid client reservation atomically moves exactly one credit from available to reserved and creates one deterministic booking receipt without changing total purchased.
- [x] AC2: A valid return atomically moves exactly one credit from reserved to available under the early-client or coach-authorized rule; invalid time/signers and retries leave all state unchanged.
- [x] AC3: A valid coach consume atomically removes exactly one reserved credit only at or after the scheduled start; invalid time/signers and retries leave all state unchanged.
- [x] AC4: One booking UUID cannot reserve or reach more than one terminal outcome, and unrelated coach/client/ledger/account substitutions are rejected.
- [x] AC5: IDL, generated client and helper contracts expose deterministic reservation derivation and all lifecycle states/events without requiring PostgreSQL data on chain.
- [x] AC6: Rust, generated-codec and embedded-Surfpool tests prove successful and adversarial multi-booking transitions against the compiled program; no Devnet transaction is required for this local ticket.

## Validation plan

Use Rust unit tests for checked arithmetic, status transitions, time rules, account sizing and rollback-before-mutation. Use TypeScript codec/derivation tests for the generated account/instructions/events. Extend the existing embedded Surfpool lifecycle with in-memory client, coach, sponsor and attacker signers; purchase credits, reserve distinct booking UUIDs, exercise every valid resolution path, and assert PDA/ledger state after wrong signer, wrong pair, duplicate reference, pre-start consume, post-cutoff client return and replay attempts. Run `NO_DNA=1 cargo test -p movx-coach-pass`, clippy with denied warnings, Rust formatting, `NO_DNA=1 anchor build --skip-lint`, IDL parity/Codama generation, focused and repository TypeScript tests, typecheck, lint, format and production build. Run the configured Solana program autofixer after program edits. DEV0130 owns later Devnet evidence and explicit wallet approval.

## Implementation record

Implemented and validated locally on 2026-10-04. The program now binds each credit reservation to one deterministic booking receipt, applies checked aggregate balance transitions and retains the terminal receipt so ambiguous responses and retries can be recovered without repeating the operation.

### Changes and rationale

- Added a fixed-size, versioned `CreditReservation` account derived from the coach-client ledger and 16-byte booking UUID. It snapshots the coach, client, scheduled start and early-return cutoff and moves only from `Reserved` to `Returned` or `Consumed`.
- Added `reserve_booking_credit`, `return_booking_credit` and `consume_booking_credit`. Reservation requires the client signature but permits a separate fee payer; return accepts the client through the frozen cutoff or the coach's current wallet at any time; consume accepts only the current coach at or after the frozen start.
- Added checked pair-ledger helpers. Reserve changes `available - 1, reserved + 1`; return changes `reserved - 1, available + 1`; consume changes `reserved - 1`; purchase totals and nonces remain unchanged. Validation completes before mutation, and Solana transaction rollback protects account creation/event failures.
- Retained terminal receipts instead of closing them. This uses one rent-exempt account per real booking but supplies deterministic replay prevention and recovery without an unbounded list in the pair ledger.
- Regenerated the Anchor IDL and Codama Solana Kit client. Browser/server-safe helpers now derive the receipt PDA, round-trip canonical UUIDs and reject reservation projections whose version, ledger, coach, client or booking does not match the prepared application snapshot.
- Extended the embedded Surfpool scenario from purchases into three bookings: early client return, post-cutoff coach return and post-start coach consumption. Adversarial checks cover duplicate reservation, early consume, late client return, unauthorized return/consume, substituted ledger and repeated terminal resolution, with ledger and receipt state checked after failures.

### Affected files

| File or component                                                                                         | Change and purpose                                                                                                           |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `programs/movx-coach-pass/src/state/credit_reservation.rs`                                                | Defines the fixed-size receipt, terminal status machine, frozen schedule/cutoff and authority/time validation.               |
| `programs/movx-coach-pass/src/state/coach_client_credits.rs`                                              | Adds checked reserve, return and consume arithmetic while preserving purchase totals.                                        |
| `programs/movx-coach-pass/src/instructions/*booking_credit.rs`                                            | Implements client reservation, client/coach return and coach consumption with exact PDA/account relationships and event CPI. |
| `programs/movx-coach-pass/src/{lib.rs,constants.rs,errors.rs,events.rs,state/mod.rs,instructions/mod.rs}` | Registers entrypoints, seeds, bounded errors, structured events and modules.                                                 |
| `idl/movx_coach_pass.json` and `clients/js/src/generated/`                                                | Expose the new account, enum, events, errors and instruction builders through the generated public program contract.         |
| `src/solana/coach-pass.ts`                                                                                | Adds deterministic receipt derivation, UUID round-trip and strict prepared-snapshot projection validation.                   |
| `tests/coach-pass-client.test.ts` and `tests/coach-pass-surfpool.integration.ts`                          | Prove generated codecs/PDAs and valid/adversarial compiled-program transitions across multiple bookings.                     |

### Decisions and deviations

- 2026-10-04: Added DEV0131 as a separate blockchain peer instead of putting program instructions inside backend DEV0128. This preserves one primary implementation area per ticket and keeps PostgreSQL from becoming credit authority.
- 2026-10-04: Chose one retained fixed-size reservation PDA per actual booking over an unbounded map or aggregate counters alone. The extra rent deposit is accepted for P0 in exchange for deterministic recovery and replay-safe terminal receipts.
- 2026-10-04: Kept booking existence, capacity, cancellation reasons and idempotent workflow in PostgreSQL. The program intentionally validates only the signed credit authority, immutable receipt snapshot, time boundary and balance transition; the application must compare finalized receipt fields before confirming its row.
- 2026-10-04: Surfpool's `absoluteTimestamp` cheatcode accepts milliseconds while Solana's `Clock::unix_timestamp` and instruction snapshots use seconds. Tests make that conversion explicitly instead of weakening program time checks.

### Contracts, configuration, and operations

The public program contract adds one `CreditReservation` account, `CreditReservationStatus`, three instructions, three event families and bounded errors. The account allocates 200 bytes including the Anchor discriminator and reserves 44 bytes for compatible future fields. Its address is derived from `['credit-reservation', coach_client_credits, booking_uuid]`; the receipt is intentionally retained after resolution.

Existing `CoachAuthority`, `Offer` and `CoachClientCredits` addresses and layouts are unchanged. No environment variable, secret, database migration, deployment or Devnet transaction is included. Downstream DEV0128 must persist the exact UUID/time/cutoff snapshot and reconcile finalized fields; DEV0130 must deploy this generated interface and implement transaction preparation, verification and recovery.

## Validation results

- Date and environment: 2026-10-04, macOS arm64, Anchor/Agave toolchain with `NO_DNA=1`, embedded offline Surfpool, Node/Next.js repository toolchain.
- `NO_DNA=1 cargo fmt --all -- --check`: passed.
- `NO_DNA=1 cargo clippy -p movx-coach-pass --all-targets -- -D warnings`: passed.
- `NO_DNA=1 cargo test -p movx-coach-pass`: passed, 20 Rust tests including account size, checked arithmetic, authority/time rules and terminal replay prevention.
- `NO_DNA=1 anchor build --skip-lint`: passed. It retained the known platform-tools warnings about the crate's `cdylib`/`lib` combination and post-processing's unrecognized syscall list; the resulting SBF executed successfully under Surfpool.
- `NO_DNA=1 anchor idl build -p movx_coach_pass --skip-lint -o idl/movx_coach_pass.json`, `NO_DNA=1 anchor codama generate -l js -p clients idl/movx_coach_pass.json` and `cmp -s target/idl/movx_coach_pass.json idl/movx_coach_pass.json`: passed; generated sources and checked-in IDL are reproducible and identical to the build IDL.
- `node --import tsx --test tests/coach-pass-client.test.ts`: passed, 8 focused generated-codec, PDA, projection and metadata tests.
- `npm run test:coach-pass:integration`: passed, 1 compiled-program Surfpool lifecycle including valid and adversarial purchase/reservation/return/consume cases.
- `npm test`: passed, 75 tests.
- `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build` and `git diff --check`: passed; the Next.js production build generated all application routes successfully.
- Focused Markdown Prettier checks passed for every changed narrative/ticket document governed by the formatter. A repository-local link check resolved 780 links across 95 tracked project Markdown files with no missing target; the ticket index contains DEV0131 exactly once under the archive with matching `Completed` status.
- Solana program autofixer: detected Anchor, reported no issues or suggestions and required no second pass.
- Manual security review: confirmed every writable state account is seed-bound, receipt relationships are checked, reserve requires the ledger's client, terminal actions require the reviewed current authority/time, arithmetic is checked before mutation and rejected Surfpool transactions leave balances/receipt status unchanged.
- Not run: browser tests are not applicable because DEV0131 adds no interface or browser route. Devnet signing/deployment is intentionally deferred to DEV0130 and was not authorized by this local ticket.

| Criterion | Evidence                                                                                                             | Result |
| --------- | -------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Surfpool purchase then reserve asserted `20/0 -> 19/1`, unchanged total/purchase fields and matching receipt fields. | Passed |
| AC2       | Early client return and post-cutoff coach return passed; late/unauthorized/replayed returns preserved state.         | Passed |
| AC3       | Pre-start/wrong-signer consume failed; post-start coach consume passed once and replay preserved state.              | Passed |
| AC4       | Duplicate UUID, substituted ledger, unauthorized actors and both terminal replay paths were rejected.                | Passed |
| AC5       | IDL parity, Codama output and 8 helper/codec tests passed.                                                           | Passed |
| AC6       | 20 Rust tests and the compiled-SBF multi-booking Surfpool lifecycle passed.                                          | Passed |

## Risks, limitations, and follow-ups

Retaining one receipt PDA per booking locks a small rent-exempt deposit until a separately designed archival/closure mechanism exists. The chain cannot prove that the off-chain occurrence or cancellation reason is truthful; the application must verify the exact snapshot before confirming a booking, while the program guarantees only authority and credit arithmetic. Wallet replacement does not migrate an existing pair ledger or its reservations and remains a separate product/security decision. The current program has passed static review and adversarial local execution but has not had an independent audit or Devnet deployment.

DEV0128 owns the database state machine and two-phase recovery around these operations. DEV0130 owns Devnet deployment, transaction preparation/simulation/verification and public evidence for purchases plus booking-credit transitions. DEV0129 owns the human-facing wallet, booking, cancellation and client-card states.

## Completion and review references

- Completed: 2026-10-04.
- Commit: Planning contract is in `[DEV0131] Define coach-credit booking lifecycle`; implementation is recorded in `[DEV0131] Implement coach-credit booking lifecycle`.
- Review: Self-review plus the required Solana program autofixer; no independent audit or code review.
- Deployment or release: None — DEV0130 owns Devnet deployment and evidence.
