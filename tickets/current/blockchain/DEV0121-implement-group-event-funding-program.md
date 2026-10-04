# Ticket DEV0121: Implement the group-event funding program

- Status: Ready
- Created: 2026-10-04
- Last updated: 2026-10-04
- Milestone: Marketplace M4 local EventPool program
- Coordination: [COR0010 — Coach-pass and group-funded marketplace MVP](../organisatory/COR0010-group-funded-coach-marketplace-mvp.md)
- Related records: reviews but does not inherit cancelled [DEV0097 — Create coach package offers on Devnet](../../archive/blockchain/DEV0097-create-coach-package-offers.md); supplies account/instruction/client contracts to [DEV0122](DEV0122-integrate-devnet-group-event-funding.md)

## Objective and context

Implement and locally prove the smallest Solana program that holds exact test-USDC seat contributions under immutable group-event threshold rules and permits exactly one successful payout or individual failed-pool refunds.

## Scope and non-goals

- In scope: reviewed deployable program identity strategy; `EventPool` and `Contribution` PDA layouts; PDA-controlled SPL Token vault; create, fund, settle, claim-payout and claim-refund instructions; immutable bounded price/capacity/deadline/schedule/recipient; exact official Devnet test-USDC contract; events/errors; Anchor IDL, Codama Solana Kit client and Surfpool/local adversarial lifecycle tests.
- Out of scope: application schema/UI, Devnet deployment/rehearsal, production assets, attendance proof, disputes, coach cancellation/no-show, partial deposits, multi-seat wallets, waitlists, payment splitting or automatic scheduler.

## Expected behavior and edge cases

One coach-authorized pool accepts at most one exact contribution per participant before deadline and maximum capacity. Anyone may settle after the deadline; the program deterministically chooses success or failure. Only the frozen coach recipient receives a successful pool exactly once. Only the recorded participant receives one exact refund after failure. Wrong signer/mint/program/vault/amount/recipient, early settlement, duplicate contribution, overflow and payout/refund replay fail atomically.

## Assumptions, decisions, and dependencies

Adopt exact numeric/time/account bounds before code. Use checked arithmetic and explicit SPL Token versus Token-2022 ownership. Review generic authority/client work from DEV0097, but do not repurpose its private Offer semantics or local-only nondeployable ID. No transaction may be sent by automation during implementation without explicit user approval.

## Implementation plan

1. Freeze state machine, layouts, seeds, bounds, authorities, token accounts, size/rent and upgrade policy.
2. Implement instructions, structured events and errors.
3. Generate/check in IDL and typed Kit client plus app-neutral derivation/codec helpers.
4. Add unit and Surfpool success/failure/refund/adversarial/time-travel tests.
5. Run autofixer/security review, clippy/static/build checks and record rent/compute behavior.

## Acceptance criteria

- [ ] AC1: Valid creation/funding produces exact EventPool, vault and one Contribution per wallet with immutable terms.
- [ ] AC2: Deterministic post-deadline success pays the frozen coach exactly once and makes refunds impossible.
- [ ] AC3: Deterministic failure makes coach payout impossible and lets every tested participant refund exactly once without an all-participant loop.
- [ ] AC4: Wrong/duplicate/late/full/overflow/early/replay and account-substitution paths fail without value loss.
- [ ] AC5: IDL/client, Rust/unit, Surfpool integration, security/autofixer, clippy/format/build and fee/rent/compute evidence pass.

## Validation plan

Use Rust unit tests plus Surfpool time travel/token setup for multiple participant wallets, minimum boundary, maximum capacity, success/payout, failure/refunds, duplicate/replay and account substitution. Run Anchor/Codama parity checks, program autofixer, clippy with warnings denied, formatting and SBF build/runtime validation.

## Implementation record

Not started.

### Changes and rationale

Pending implementation.

### Affected files

Planned: reviewed program workspace, IDL/generated Kit client, chain helpers and focused local integration tests.

### Decisions and deviations

None yet.

### Contracts, configuration, and operations

Requires a user-controlled deployable identity later; no private key may enter the repository. Devnet identifiers are not release evidence until DEV0122.

## Validation results

Not run — no implementation.

## Risks, limitations, and follow-ups

Vault authority and mutually exclusive payout/refund paths are the critical security boundary. Production use would require independent audit and legal/compliance review.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: Planning self-review only.
- Deployment or release: None.
