# Ticket DEV0121: Implement the group-event funding program

- Status: Completed
- Created: 2026-10-04
- Last updated: 2026-10-05
- Milestone: Marketplace M5 local EventPool program
- Coordination: [COR0010 — Coach-pass and group-funded marketplace MVP](../../archive/organisatory/COR0010-group-funded-coach-marketplace-mvp.md)
- Related records: reviews but does not inherit cancelled [DEV0097 — Create coach package offers on Devnet](DEV0097-create-coach-package-offers.md); adopts the platform-payer boundary completed by [DEV0132](DEV0132-make-coach-pass-operations-platform-funded.md) and the completed payment-asset contract in [DEV0134](DEV0134-adopt-eurc-for-marketplace-payments.md); supplies account/instruction/client contracts to [DEV0122](../../archive/blockchain/DEV0122-integrate-devnet-group-event-funding.md)

## Objective and context

Implement and locally prove the smallest Solana program that holds exact test-EURC seat contributions under immutable group-event threshold rules and permits exactly one successful payout or individual failed-pool refunds.

## Scope and non-goals

- In scope: reviewed deployable program identity strategy; `EventPool` and `Contribution` PDA layouts; PDA-controlled SPL Token vault; a distinct platform payer for all fees and account/token-account rent; create, fund, settle, claim-payout and claim-refund instructions; immutable bounded price/capacity/deadline/schedule/recipient; exact official Devnet test-EURC contract; events/errors; Anchor IDL, Codama Solana Kit client and Surfpool/local adversarial lifecycle tests.
- Out of scope: application schema/UI, Devnet deployment/rehearsal, production assets, attendance proof, disputes, coach cancellation/no-show, partial deposits, multi-seat wallets, waitlists, payment splitting or automatic scheduler.

## Expected behavior and edge cases

One coach-authorized pool accepts at most one exact contribution per participant before deadline and maximum capacity. The platform payer funds every transaction fee and rent deposit, while the participant signs and supplies the exact test-EURC contribution. Anyone may settle after the deadline; the program deterministically chooses success or failure. Only the frozen coach recipient receives a successful pool exactly once. Only the recorded participant receives one exact refund after failure. Wrong signer/mint/program/vault/amount/recipient, early settlement, duplicate contribution, overflow and payout/refund replay fail atomically.

## Assumptions, decisions, and dependencies

The group-event contract extends the existing deployable `movx-coach-pass` Anchor program rather than creating a second program. This reuses its stable `CoachAuthority`, program identity, exact Anchor 1.1.2/Solana 3.1.10 toolchain, generated-client pipeline and platform-payer boundary. The crate/program name remains unchanged for compatibility; a broader rename is not part of this ticket. DEV0121 performs only local execution and generates no new program keypair or Devnet transaction.

The on-chain contract is frozen as follows before implementation:

- `EventPool` is derived from `['event-pool', coach_authority, nonce_le_u64]`; its legacy SPL Token vault is derived from `['event-vault', event_pool]`; and one `Contribution` is derived from `['contribution', event_pool, participant_wallet]`. Anchor derives and stores canonical bumps.
- Price is `1..=9_000_000_000_000_000` EURC base units. Minimum participants are `2..=50`; maximum participants are between the minimum and `50`; and checked multiplication must prove `price * maximum` fits in `u64` before account creation.
- The funding deadline must be after creation and strictly before the event start. The event must start within 365 days of creation and last between 30 minutes and 12 hours. All timestamp subtraction and addition use checked arithmetic.
- Creation requires the current wallet recorded by the existing `CoachAuthority`. It freezes that authority account, the current wallet as immutable payout recipient, official Devnet EURC mint, exact seat price/capacity/deadline/schedule and a caller-selected nonce. The distinct platform payer funds `EventPool` and vault rent.
- `fund_event` accepts no amount argument: it reads the immutable seat price, requires the participant signature and exact participant-owned EURC source, creates one Contribution through the platform payer, transfers with legacy SPL `transfer_checked`, and increments count/recorded liabilities only through checked arithmetic. A second contribution from the same wallet/event cannot initialize.
- Permissionless `settle_event` requires only a submitting signer, is valid at or after the deadline and moves `Funding` exactly once to `Succeeded` or `Failed` from the recorded participant count.
- `claim_event_payout` requires the current wallet in the frozen CoachAuthority to sign and transfers exactly the recorded funded liability to a token account owned by the immutable payout recipient. It moves `Succeeded` to `Paid` exactly once; authority rotation cannot rewrite the recipient.
- `claim_event_refund` requires the recorded participant to sign and transfers exactly that Contribution's recorded amount to a token account owned by that participant. It marks only that Contribution refunded and advances a checked aggregate refunded counter, so contributors never depend on an all-participant transaction.
- Pool state is `Funding | Succeeded | Paid | Failed`; Contribution state is `Funded | Refunded`. Successful/refundable presentation is derived from the pool instead of duplicating mutable outcome state across every contribution.
- `EventPool` stores version, authority/recipient/mint/vault, nonce, immutable terms, current count, total funded and total refunded base units, status, creation/settlement/payout timestamps, canonical bumps and reserved bytes. `Contribution` stores version, pool, participant, exact amount, funded/refunded timestamps, status, bump and reserved bytes. Terminal accounts and the vault remain open in P0 for replay/recovery evidence.
- The program tracks liabilities independently of the raw vault balance. Payout and refunds transfer only recorded amounts, so an unsolicited direct token donation cannot alter participant count/outcome or block a legitimate claim; donated surplus is not recoverable in P0.

Use checked arithmetic and the concrete legacy SPL Token account/program types because the official Devnet EURC mint is a legacy SPL mint. The user confirmed that a distinct platform payer funds all fees and rent without replacing coach/participant authority or supplying marketplace test EURC. Review generic authority/client work from DEV0097, but do not repurpose its private Offer semantics. No transaction may be sent by automation during implementation without explicit user approval.

## Implementation plan

1. Freeze state machine, layouts, seeds, bounds, authorities, token accounts, size/rent and program-identity policy in this ticket.
2. Implement instructions, structured events and errors.
3. Generate/check in IDL and typed Kit client plus app-neutral derivation/codec helpers.
4. Add unit and Surfpool success/failure/refund/adversarial/time-travel tests.
5. Run autofixer/security review, clippy/static/build checks and record rent/compute behavior.

## Acceptance criteria

- [x] AC1: Valid creation/funding produces exact EventPool, vault and one Contribution per wallet with immutable terms.
- [x] AC2: Deterministic post-deadline success pays the frozen coach exactly once and makes refunds impossible.
- [x] AC3: Deterministic failure makes coach payout impossible and lets every tested participant refund exactly once without an all-participant loop.
- [x] AC4: Wrong/duplicate/late/full/overflow/early/replay and account-substitution paths fail without value loss.
- [x] AC5: Every lifecycle transaction and created program/token account is platform-funded in SOL while coach/participant signatures and exact participant test-EURC value remain mandatory.
- [x] AC6: IDL/client, Rust/unit, Surfpool integration, security/autofixer, clippy/format/build and fee/rent/compute evidence pass.

## Validation plan

Use Rust unit tests plus Surfpool time travel/token setup for multiple participant wallets, minimum boundary, maximum capacity, success/payout, failure/refunds, duplicate/replay and account substitution. Run Anchor/Codama parity checks, program autofixer, clippy with warnings denied, formatting and SBF build/runtime validation.

## Implementation record

Completed locally on 2026-10-05. The existing program now creates immutable coach-authorized EventPools and program-controlled EURC vaults, accepts one exact contribution per wallet, settles threshold outcomes deterministically, pays a successful pool once and lets failed-pool participants independently refund once.

### Changes and rationale

- Extended the existing `movx-coach-pass` program with fixed-size `EventPool` and `Contribution` accounts plus `create_event_pool`, `fund_event`, `settle_event`, `claim_event_payout` and `claim_event_refund`. The exact official Devnet EURC mint and legacy Token program are enforced through typed accounts and address/mint/owner/authority constraints.
- Added a PDA-owned token vault for each pool. User contributions use `transfer_checked` under the participant signature; payouts/refunds use the canonical EventPool PDA signer. The platform payer pays transaction fees and all new account/token-account rent but never satisfies coach or participant authority.
- Added checked pure state transitions before token movement and only applies state after a successful cross-program invocation. Pool lifecycle is one-way, participant count/capacity and aggregate liabilities use checked arithmetic, and retained terminal accounts prevent replay.
- Added structured creation/funding/settlement/payout/refund events and bounded program errors for every relevant authorization, time, capacity, mint, vault, arithmetic and terminal-state failure.
- Regenerated the Anchor interface description language (IDL) and Codama Solana Kit client. Added application-neutral deterministic PDA derivation and strict pool/contribution projection helpers that reject mismatched version, authority, vault, mint, amount or aggregate totals.
- Added unit/codec tests and a compiled-SBF embedded-Surfpool lifecycle. Two pools prove mutually exclusive outcomes: `2 / 3` settles failed and independently refunds both contributors; `2 / 2` settles succeeded and pays the immutable coach recipient. Adversarial cases cover missing coach authority, wrong mint/source/destination/participant, duplicate/late/full funding, early/duplicate settlement, invalid payout/refund, and replay.

### Affected files

| File or component                                                                                                                                   | Change and purpose                                                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `programs/movx-coach-pass/src/state/{event_pool,contribution}.rs`                                                                                   | Fixed-size versioned accounts, lifecycle enums, exact bounds and checked funding/settlement/payout/refund transitions.                            |
| `programs/movx-coach-pass/src/instructions/{create_event_pool,fund_event,settle_event,claim_event_payout,claim_event_refund,event_token_common}.rs` | Typed account validation, platform-funded creation, exact EURC movement and PDA-signed terminal claims.                                           |
| `programs/movx-coach-pass/src/{lib.rs,constants.rs,errors.rs,events.rs,state/mod.rs,instructions/mod.rs}`                                           | Registers public entrypoints, stable seeds/bounds, structured events/errors and modules in the existing program identity.                         |
| `idl/movx_coach_pass.json` and `clients/js/src/generated/`                                                                                          | Reproducibly expose accounts, enums, instructions, events and errors to Solana Kit callers.                                                       |
| `src/solana/group-event.ts`                                                                                                                         | Derives pool/vault/contribution PDAs and validates untrusted finalized projections against expected authority, vault, mint and amount invariants. |
| `tests/group-event-client.test.ts`                                                                                                                  | Covers deterministic derivation, generated account codecs, strict projection checks and distinct platform/business signer roles.                  |
| `tests/group-event-surfpool.integration.ts`                                                                                                         | Executes both compiled-program outcomes and adversarial cases with zero-SOL users, exact EURC deltas, time travel, rent and compute evidence.     |
| `package.json`                                                                                                                                      | Adds the reproducible `test:group-event:integration` command.                                                                                     |

### Decisions and deviations

The original ticket allowed a separate EventPool program. Reusing the reviewed existing program is smaller, preserves direct typed access to `CoachAuthority`, avoids cross-program authority parsing and avoids another deployment/upgrade key. Liability accounting intentionally ignores unsolicited vault surplus rather than requiring the raw vault balance to equal recorded funding, preventing donation-based denial of payout/refund.

### Contracts, configuration, and operations

Reuses the existing program identity; no private key may enter the repository. This ticket changes its IDL/generated-client contract but does not deploy it. Devnet identifiers are not release evidence until DEV0122 updates the deployed program and records public proof.

The public program contract adds two accounts, three enums/argument types, five instructions, five events and corresponding errors. `EventPool` occupies 292 bytes including its discriminator; `Contribution` occupies 136 bytes. Seeds and immutable bounds are recorded above. Existing coach-pass account layouts, seeds and instructions remain unchanged. No environment variable, database migration or browser route changed.

## Validation results

All required local checks passed on 2026-10-05:

- Solana program autofixer was run independently on every new/modified Anchor module and returned no issues or suggestions; every result reported `require_another_tool_call_after_fixing: false`.
- `NO_DNA=1 cargo fmt --all -- --check`, `NO_DNA=1 cargo clippy -p movx-coach-pass --all-targets -- -D warnings` and `NO_DNA=1 cargo test -p movx-coach-pass`: passed; 29 Rust tests passed.
- `NO_DNA=1 anchor build --skip-lint`: passed. Platform tools repeated the existing undefined-syscall-table warning; both compiled-SBF Surfpool suites then executed PDA, clock, event CPI and legacy SPL Token CPI paths successfully, so the warning did not represent a runtime failure in the tested artifact.
- `NO_DNA=1 anchor idl build -p movx_coach_pass --skip-lint -o idl/movx_coach_pass.json`, byte-for-byte parity with `target/idl/movx_coach_pass.json`, and `NO_DNA=1 anchor codama generate -l js -p clients idl/movx_coach_pass.json`: passed.
- `npx --no-install tsx --test tests/coach-pass-client.test.ts tests/group-event-client.test.ts tests/group-events.test.ts`: passed; 16 helper, generated-codec and domain tests passed.
- `npm run test:group-event:integration`: passed against the compiled program. EventPool plus vault rent was `4,962,480` lamports per pool with platform debits of `4,972,480`; each Contribution held `1,837,440` lamports with platform debits of `1,847,440`. Coach and participant wallets remained at zero lamports. Successful instruction compute ranged from `8,241`/`8,242` units for settlement to `26,909` units for the highest observed pool creation; funding peaked at `24,150`, refund used `20,645` and payout used `18,174` units.
- The Surfpool token assertions passed exact `30,000,000`-base-unit seat movements. The failed pool refunded `60,000,000` total independently to two participants; the successful pool paid exactly `60,000,000` to the immutable coach recipient, with both terminal vault balances zero.
- `npm run test:coach-pass:integration`: passed, proving the existing purchase and booking-credit lifecycle remains compatible with the enlarged program.
- `npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`, IDL parity and `git diff --check`: passed; the repository suite reported 86 tests and the Next.js production build completed every route.
- Browser, database and Devnet checks are not applicable: this ticket changes the local program/client contract only. DEV0122 owns deployment, RPC/sponsor policy, finalized indexing and real Explorer evidence.

| Criterion | Evidence                                                                                                                                     | Result |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Fixed-size account tests, generated codecs and four successful compiled-program contributions across two immutable pools.                    | Passed |
| AC2       | `2 / 2` success settlement, exact `60,000,000` payout, refund rejection and payout replay rejection.                                         | Passed |
| AC3       | `2 / 3` failure settlement, payout rejection and two independent exact refunds with replay rejection.                                        | Passed |
| AC4       | Unit overflow/bounds plus compiled wrong signer/mint/source/destination/participant, duplicate, late, full, early and terminal replay paths. | Passed |
| AC5       | Zero-lamport user assertions and measured platform rent/fee debits while exact test EURC came only from participant token accounts.          | Passed |
| AC6       | Autofixer, Rust, IDL/Codama, helper, compiled-SBF, regression, static and production-build checks plus rent/compute evidence.                | Passed |

## Risks, limitations, and follow-ups

The program is locally validated but not deployed by this ticket. DEV0122 must update the existing Devnet program, apply bounded sponsor policy, simulate transactions, verify finalized accounts and record public success/failure evidence. Retained terminal accounts and vaults continue to hold rent; closing/compaction and recovery of unsolicited vault surplus are deliberately deferred. Production use requires an independent audit plus legal/compliance and dispute/no-show design.

## Completion and review references

- Completed: 2026-10-05.
- Commit: Implementation and this completion record are committed together under `[DEV0121]`.
- Review: Implementation/security self-review against AC1–AC6 completed; no independent review.
- Deployment or release: None.
