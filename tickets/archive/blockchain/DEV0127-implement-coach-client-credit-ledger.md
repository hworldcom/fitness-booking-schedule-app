# Ticket DEV0127: Implement the coach-client credit ledger

- Status: Completed
- Created: 2026-10-04
- Last updated: 2026-10-04
- Milestone: Marketplace M2 local coach-pass program
- Coordination: [COR0010 — Coach-pass and group-funded marketplace MVP](../../current/organisatory/COR0010-group-funded-coach-marketplace-mvp.md)
- Related records: implements the chain boundary adopted by [DEV0126](../organisatory/DEV0126-adopt-coach-pass-and-group-funding-contract.md); extends the committed partial foundation preserved in cancelled [DEV0097](DEV0097-create-coach-package-offers.md); supplies contracts to [DEV0128](../../current/backend/DEV0128-persist-credit-backed-private-bookings.md), [DEV0129](../../current/frontend/DEV0129-present-coach-passes-bookings-and-client-cards.md), [DEV0130](../../current/blockchain/DEV0130-integrate-devnet-coach-pass-operations.md) and [DEV0131](../../current/blockchain/DEV0131-implement-coach-credit-booking-lifecycle.md)

## Objective and context

Turn the existing immutable one-session/ten-session coach offers into an atomic test-USDC purchase contract. Each coach-client relationship gets one bounded program-derived account (PDA) containing aggregate credit balances; the coach does not get one unbounded map account and the client does not get a new program account for every purchase.

## Scope and non-goals

- In scope: `CoachClientCredits` state keyed by coach authority and client wallet; first-purchase initialization and later-purchase update instructions; exact legacy SPL Token `transfer_checked` payment to the coach's current wallet; public and client-restricted offers; offer purchase windows; monotonic purchase nonce; structured purchase events/errors; Anchor interface description language (IDL), generated Solana Kit client, derivation helpers and focused unit/codec tests.
- Out of scope: booking/reservation/cancellation mutations, coach client-card UI, database indexing, RPC recovery, fee sponsorship, Devnet deployment, group-event pools, refunds, transfers, expiry of purchased credits, arbitrary tokens, mainnet or production money.

## Expected behavior and edge cases

The first valid purchase creates exactly one PDA for `(coach_authority, client_wallet)`, moves the offer's exact official Devnet test-USDC price to a token account owned by the offer's current coach recipient, and adds exactly one or ten available credits. Later purchases reuse that PDA. The caller supplies the ledger's next purchase nonce; a stale/replayed nonce fails before value movement. A successful transaction is atomic, so payment and credits cannot diverge.

Inactive, expired, stale-authority, stale-recipient, wrong-mint, wrong-token-owner, restricted-client mismatch, invalid decimal, overflow and replay attempts fail without payment or balance change. If a successful first purchase response is lost, the caller recovers by deriving and reading the pair PDA rather than retrying value movement blindly.

## Assumptions, decisions, and dependencies

Use the existing Anchor 1.1.2 program and its stable `CoachAuthority`/`Offer` layouts and seed contracts. The historical `Dfpqc…` local address was deliberately created without a private key and cannot be deployed; local runtime validation therefore uses the generated `GvZdp…` program keypair and regenerates every address-bearing artifact against that local-only identity. DEV0130 still owns selection and custody of a separate Devnet deployment identity. Use separate first and subsequent purchase instructions instead of `init_if_needed`, removing reinitialization ambiguity. P0 purchased credits do not expire; `validity_seconds` is the offer's purchase window from `created_at`, with zero meaning the price remains available until deactivated or authority rotation. Only the official Devnet test-USDC mint with six decimals and the legacy SPL Token program is accepted.

The client funds pair-account rent on the first purchase; later fee sponsorship may pay transaction fees without acquiring business authority. A restricted offer gives one client a custom public-on-chain price; private commercial secrecy is not claimed.

## Implementation plan

1. Add the pair-ledger layout, seeds, checked state transitions, exact purchase-window validation and errors/events.
2. Add separate atomic first/subsequent purchase instructions with strict mint, token-account authority and recipient constraints plus checked transfer CPI.
3. Regenerate the Anchor IDL and Codama/Solana Kit client, then add PDA and coach-card projection helpers.
4. Add Rust invariant tests and TypeScript codec/helper tests for first purchase, accumulation, restriction, expiry, replay and overflow.
5. Add a local-only Surfpool transaction suite that deploys the compiled program, creates deterministic coach and offer state, seeds the fixed test-USDC mint/token accounts, executes first and later purchases, and proves replay/account-validation failures preserve token and ledger state.
6. Run program autofixer, formatting, unit tests, clippy, IDL/client parity and applicable repository checks; record any remaining environment limitation honestly.

## Acceptance criteria

- [x] AC1: A valid first purchase atomically transfers the exact offer price and creates one pair PDA with exactly one or ten available credits.
- [x] AC2: A valid later purchase reuses the same PDA, accumulates credits/totals and advances one monotonic purchase nonce.
- [x] AC3: Public and wallet-restricted offers behave as specified; inactive, expired, stale-authority/recipient and wrong-client offers cannot move value.
- [x] AC4: Wrong mint, decimals, token owner/program, destination, nonce, overflow and replay fail without payment or ledger mutation.
- [x] AC5: The IDL, generated client and application helpers expose deterministic pair-PDA derivation and balances suitable for later coach client cards.
- [x] AC6: Rust, TypeScript, program autofixer, clippy, format, SBF, Surfpool and applicable repository build checks pass.

## Validation plan

Use Rust unit tests for ledger arithmetic, nonce/replay, offer restriction/window and account sizing. Use generated-codec tests for new accounts/instructions/events and deterministic pair-PDA derivation. Run a Surfpool integration suite against the compiled local program with in-memory test signers and locally seeded test-USDC accounts; assert exact token balance deltas, pair-PDA creation/reuse, nonce advancement and rollback after rejected purchases. Run `NO_DNA=1 cargo test -p movx-coach-pass`, clippy with denied warnings, Rust formatting, focused TypeScript tests, repository unit/type checks as applicable, Anchor IDL build/parity, Codama regeneration and the required Solana program autofixer. A real Devnet transaction belongs to DEV0130 and is not evidence for this local contract ticket.

## Implementation record

Implementation started on 2026-10-04 after the contract review split database booking and interface delivery into peer tickets.

### Changes and rationale

The program now stores one fixed-size `CoachClientCredits` PDA for each coach-authority/client-wallet pair. Its balances distinguish available and reserved credits, retain aggregate purchase totals, and expose a monotonic next-purchase nonce. Checked arithmetic computes a complete transition before mutating the account so replay and overflow errors do not partially update the ledger.

Two explicit instructions implement the purchase boundary. `purchase_first_offer` initializes the pair PDA with nonce zero and charges its rent to the client. `purchase_offer` requires the already-derived PDA and its exact next nonce. Both validate the live coach authority, immutable offer, public or restricted client, purchase window, official Devnet test-USDC mint, six decimals, client-owned source token account and offer-recipient-owned destination token account before issuing an exact legacy SPL Token `transfer_checked` cross-program invocation. Solana transaction atomicity then makes the token movement, ledger update and `CreditsPurchased` event succeed or roll back together.

The Anchor interface description language (IDL) and Codama-generated Solana Kit client now expose both instructions, the pair account and event. Application helpers derive the pair address and project only bounded balance/history fields for the later coach client-card interface. Focused Rust and TypeScript tests cover accumulation, replay, arithmetic overflow, offer restriction/expiry/self-purchase, deterministic derivation, generated codecs and projection identity checks. An embedded Surfpool suite deploys the built SBF program on dynamic local ports and executes real legacy SPL Token transfers with in-memory signers. It proves successful pair creation/reuse as well as transaction rollback after account-validation, replay, authorization and insufficient-funds failures.

### Affected files

- [`programs/movx-coach-pass/src/state/coach_client_credits.rs`](../../../programs/movx-coach-pass/src/state/coach_client_credits.rs) defines and unit-tests the fixed 200-byte pair ledger and checked purchase transition.
- [`programs/movx-coach-pass/src/state/offer.rs`](../../../programs/movx-coach-pass/src/state/offer.rs) validates current authority/recipient, active status, optional client restriction, self-purchase rejection and the purchase window.
- [`programs/movx-coach-pass/src/instructions/purchase_first_offer.rs`](../../../programs/movx-coach-pass/src/instructions/purchase_first_offer.rs), [`purchase_offer.rs`](../../../programs/movx-coach-pass/src/instructions/purchase_offer.rs) and [`purchase_common.rs`](../../../programs/movx-coach-pass/src/instructions/purchase_common.rs) own first/later account constraints and the checked token transfer. Large Anchor accounts are heap-backed with `Box` so the generated SBF entrypoints remain below the 4 KiB stack-frame limit.
- [`programs/movx-coach-pass/src/constants.rs`](../../../programs/movx-coach-pass/src/constants.rs), [`errors.rs`](../../../programs/movx-coach-pass/src/errors.rs), [`events.rs`](../../../programs/movx-coach-pass/src/events.rs), [`instructions/mod.rs`](../../../programs/movx-coach-pass/src/instructions/mod.rs), [`state/mod.rs`](../../../programs/movx-coach-pass/src/state/mod.rs) and [`lib.rs`](../../../programs/movx-coach-pass/src/lib.rs) expose the new seed, version, errors, event, accounts and instructions.
- [`programs/movx-coach-pass/Cargo.toml`](../../../programs/movx-coach-pass/Cargo.toml) and the root [`Cargo.lock`](../../../Cargo.lock) add the version-aligned `anchor-spl` token dependency.
- [`idl/movx_coach_pass.json`](../../../idl/movx_coach_pass.json) and [`clients/js/src/generated/`](../../../clients/js/src/generated/) are regenerated from the program contract.
- [`src/solana/coach-pass.ts`](../../../src/solana/coach-pass.ts) derives and validates pair projections; [`tests/coach-pass-client.test.ts`](../../../tests/coach-pass-client.test.ts) verifies the generated browser-side contract.
- [`tests/coach-pass-surfpool.integration.ts`](../../../tests/coach-pass-surfpool.integration.ts) deploys the local program, seeds the fixed test-USDC mint and accounts, executes first/later purchases, and verifies rejected transactions leave balances and pair state unchanged. [`package.json`](../../../package.json) exposes it as `npm run test:coach-pass:integration`, with the matching Surfpool Kit development dependencies recorded in [`package-lock.json`](../../../package-lock.json).
- [`Anchor.toml`](../../../Anchor.toml), [`programs/movx-coach-pass/src/lib.rs`](../../../programs/movx-coach-pass/src/lib.rs), the IDL, generated client and application helper now agree on the deployable local-only `GvZdp…` identity.

### Decisions and deviations

Separate first/subsequent purchase instructions replace an `init_if_needed` design to make initialization and replay behavior explicit. The ledger stores aggregate credit state rather than an unbounded client map or one account per purchase. Offer `validity_seconds` is interpreted as a purchase deadline only; successfully purchased credits do not expire in this slice. A value of zero keeps the offer purchasable until deactivation or authority rotation.

The instruction account structs initially exceeded the SBF 4 KiB stack-frame limit after adding token accounts. Heap-backing the large deserialized accounts fixed that program defect without changing the IDL. The original `Dfpqc…` address could not be deployed because DEV0097 intentionally derived it without a private key. On 2026-10-04 the local program identity was synchronized to the existing generated `GvZdp…` keypair and every address-bearing artifact was regenerated. This is a local testing identity only; DEV0130 still owns the user-managed Devnet identity.

The installed platform tools continue to emit an empty-syscall-table post-processing warning. The warning was retained rather than hidden, but it is no longer treated as a blocker: the resulting SBF binary deployed and executed PDA creation, event CPI and legacy SPL Token CPI successfully in embedded Surfpool.

### Contracts, configuration, and operations

The pair address is derived from `b"coach_client_credits"`, the stable `CoachAuthority` address and the client wallet. The serialized account is fixed at 200 bytes including the Anchor discriminator and reserves 46 bytes for compatible additions. The first purchase nonce is `0`; every successful purchase increments `next_purchase_nonce` by one. `CreditsPurchased` supplies the pair/authority/offer/client/recipient identifiers, exact base-unit price, purchased/available/reserved/total credits, purchase count and timestamp.

The program continues to accept only the configured official Devnet test-USDC mint through the legacy SPL Token program with six decimals. The local program address changed from a non-deployable placeholder to `GvZdpXGX6N25xfHipgzh3Td3NZBkt7e36AougHi4v1MU`; this changes local PDA addresses and requires regeneration after any future local identity change. `@solana/surfpool`, `@solana/kit-plugin-rpc` and `@solana/kit-plugin-signer` are pinned development-only dependencies for the isolated transaction suite. No secret, environment variable, database migration, Devnet deployment or external transaction is part of this ticket. Application/database indexing, booking credit mutations, fee sponsorship and Devnet recovery remain owned by DEV0128 and DEV0130.

## Validation results

- Passed `NO_DNA=1 cargo test -p movx-coach-pass`: 13 Rust tests passed, including pair-ledger accumulation/replay/overflow and offer purchase validation.
- Passed `NO_DNA=1 cargo clippy -p movx-coach-pass --all-targets -- -D warnings` and `NO_DNA=1 cargo fmt --all -- --check`.
- Passed `npm test`: 73 tests passed, including generated first/later purchase codecs, deterministic pair derivation, the 200-byte ledger codec and bounded client-card projection.
- Passed `npm run typecheck`, `npm run lint`, `npm run format:check` and `npm run build`; Next.js compiled and generated all current routes successfully.
- Passed `NO_DNA=1 anchor idl build -p movx_coach_pass --skip-lint -o idl/movx_coach_pass.json` followed by byte-for-byte `cmp` against `target/idl/movx_coach_pass.json`.
- Passed `NO_DNA=1 anchor codama generate -l js -p clients idl/movx_coach_pass.json`; the checked-in generated client contains the new account, event and instructions.
- Passed `npm run test:coach-pass:integration`: Anchor rebuilt the SBF program and one embedded Surfpool lifecycle test passed. It created an 80 test-USDC/ten-credit first purchase, reused the same pair PDA for a second purchase, and preserved token/ledger state after wrong destination, wrong source owner, wrong token program, wrong mint, five-decimal mint, replay, insufficient-funds and restricted-client failures. The test used dynamic local ports, in-memory signers and no external cluster.
- Passed `NO_DNA=1 cargo build-sbf --manifest-path programs/movx-coach-pass/Cargo.toml` after heap-backing the large accounts; the previous 4 KiB stack-frame errors are gone. The local SDK still emits its known unknown-syscall post-processing warning, but the same binary executed successfully under Surfpool.
- Passed the required Solana program autofixer after the final Rust/program-ID change: no issues or suggestions remained and no further autofixer call was requested.
- Passed `git diff --check`.
- Not run by design: Devnet deployment and transactions remain DEV0130 scope. No external transaction was signed or sent.

## Risks, limitations, and follow-ups

Aggregate credits deliberately omit per-purchase expiry and financial history receipts. Finalized transaction history plus the pair nonce provides hackathon recovery evidence; production accounting would need a reviewed index/receipt retention policy. Booking reservations and returned/consumed credits remain DEV0128 work. DEV0130 must repeat the exact token constraints, atomic rollback, lost-response recovery and pair reuse on Devnet before any hosted flow treats them as externally proven.

Follow-up clarification, 2026-10-04: [DEV0131](../../current/blockchain/DEV0131-implement-coach-credit-booking-lifecycle.md) now owns the on-chain reservation/consume/return instructions that were intentionally excluded here; DEV0128 retains the PostgreSQL booking workflow. This does not change DEV0127's delivered purchase scope or evidence.

## Completion and review references

- Completed: 2026-10-04 — local program contract, generated client and adversarial Surfpool purchase lifecycle passed.
- Commit: Included in the combined `[DEV0117][DEV0126][DEV0127] Adopt coach-pass marketplace and credit ledger` change alongside the two prerequisite product-contract records.
- Review: Implementation self-review and required program autofixer passed; no independent review was created.
- Deployment or release: None.
