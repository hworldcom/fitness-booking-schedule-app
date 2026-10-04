# Ticket DEV0130: Integrate Devnet coach-pass operations

- Status: Draft
- Created: 2026-10-04
- Last updated: 2026-10-04
- Milestone: Marketplace M5 Devnet pass integration
- Coordination: [COR0010 — Coach-pass and group-funded marketplace MVP](../organisatory/COR0010-group-funded-coach-marketplace-mvp.md)
- Related records: depends on completed [DEV0127](../../archive/blockchain/DEV0127-implement-coach-client-credit-ledger.md) and [DEV0131](../../archive/blockchain/DEV0131-implement-coach-credit-booking-lifecycle.md), personal-wallet work in DEV0047 and hosted infrastructure under COR0004; supplies transaction adapters to [DEV0128](../backend/DEV0128-persist-credit-backed-private-bookings.md) and [DEV0129](../frontend/DEV0129-present-coach-passes-bookings-and-client-cards.md)

## Objective and context

Connect the complete local coach-pass program to recoverable Devnet purchases and booking-credit operations with server-authoritative preparation, simulation, wallet approval, optional bounded fee sponsorship and finalized pair-ledger/reservation verification.

## Scope and non-goals

- In scope: deployable program/upgrade identity; Devnet configuration; prepare/simulate/sign/submit/verify/recover operations; token-account readiness; pair-ledger and reservation indexing; first/subsequent purchase recovery; reserve/consume/return recovery; public Explorer evidence.
- Out of scope: UI composition, booking rules, mainnet, arbitrary tokens, production custody, Kora migration or real-money claims.

## Expected behavior and edge cases

Every purchase approval identifies Devnet, test USDC, coach, exact price, purchased credits, destination and fee payer. Every booking-credit approval identifies the pair ledger, booking reference, scheduled time/cutoff, exact transition, authority and fee payer. A lost response is recovered from the pair PDA, purchase nonce or deterministic reservation receipt. Wallet rejection, insufficient balance, missing token account, stale blockhash or RPC ambiguity never causes a blind repeat.

## Assumptions, decisions, and dependencies

The DEV0127 purchase contract and DEV0131 reservation contract must be stable before deployment. Credentialed RPC, sponsor and upgrade material remain server/operator secrets. Automation may not sign or send a transaction without explicit user approval.

## Implementation plan

1. Freeze deployment/configuration and operation records after DEV0131 completes.
2. Implement first/subsequent purchase plus reserve/consume/return preparation and simulation.
3. Implement submit/finalize/verify/recover plus pair-ledger/reservation projection indexing.
4. Rehearse public/restricted purchases and each booking-credit terminal path on Devnet with public evidence.

## Acceptance criteria

- [ ] AC1: First and later exact test-USDC purchases finalize with verified pair-ledger balances.
- [ ] AC2: Reserve, consume and return operations finalize with verified pair-ledger/reservation state.
- [ ] AC3: Rejection and ambiguous outcomes recover without duplicate payment, reservation or terminal resolution.
- [ ] AC4: Secrets remain server-only and sponsorship cannot buy or mutate credits without the required client/coach authority.
- [ ] AC5: Real Devnet transaction/account evidence and applicable server/client tests pass.

## Validation plan

Focused RPC/verifier/recovery tests, mocked purchase and booking-operation failure cases, real wallet approval/rejection and public Devnet account/signature verification.

## Implementation record

Not started.

## Validation results

Not run — the local DEV0131 contract is complete, but this Devnet integration ticket has not started.

## Risks, limitations, and follow-ups

Devnet and RPC availability can interrupt rehearsal. Provider failure must remain distinguishable from program rejection.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: Planning self-review only.
- Deployment or release: None.
