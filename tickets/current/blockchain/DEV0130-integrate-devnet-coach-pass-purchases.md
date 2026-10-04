# Ticket DEV0130: Integrate Devnet coach-pass purchases

- Status: Draft
- Created: 2026-10-04
- Last updated: 2026-10-04
- Milestone: Marketplace M5 Devnet pass integration
- Coordination: [COR0010 — Coach-pass and group-funded marketplace MVP](../organisatory/COR0010-group-funded-coach-marketplace-mvp.md)
- Related records: depends on completed [DEV0127](../../archive/blockchain/DEV0127-implement-coach-client-credit-ledger.md), personal-wallet work in DEV0047 and hosted infrastructure under COR0004; supplies transaction adapters to [DEV0128](../backend/DEV0128-persist-credit-backed-private-bookings.md) and [DEV0129](../frontend/DEV0129-present-coach-passes-bookings-and-client-cards.md)

## Objective and context

Connect the local coach-pass program to recoverable official Devnet test-USDC purchases with server-authoritative preparation, simulation, wallet approval, optional bounded fee sponsorship and finalized pair-ledger verification.

## Scope and non-goals

- In scope: deployable program/upgrade identity; Devnet configuration; prepare/simulate/sign/submit/verify/recover operations; token-account readiness; pair-ledger indexing; first/subsequent purchase recovery; public Explorer evidence.
- Out of scope: UI composition, booking rules, mainnet, arbitrary tokens, production custody, Kora migration or real-money claims.

## Expected behavior and edge cases

Every approval identifies Devnet, test USDC, coach, exact price, purchased credits, destination and fee payer. A lost response is recovered from the pair PDA and expected purchase nonce. Wallet rejection, insufficient balance, missing token account, stale blockhash or RPC ambiguity never causes a blind repeat.

## Assumptions, decisions, and dependencies

The DEV0127 account/instruction contract must be stable. Credentialed RPC, sponsor and upgrade material remain server/operator secrets. Automation may not sign or send a transaction without explicit user approval.

## Implementation plan

1. Freeze deployment/configuration and operation records.
2. Implement first/subsequent purchase preparation and simulation.
3. Implement submit/finalize/verify/recover plus projection indexing.
4. Rehearse public and restricted offers on Devnet with public evidence.

## Acceptance criteria

- [ ] AC1: First and later exact test-USDC purchases finalize with verified pair-ledger balances.
- [ ] AC2: Rejection and ambiguous outcomes recover without duplicate payment.
- [ ] AC3: Secrets remain server-only and sponsorship cannot buy credits without the client wallet authority.
- [ ] AC4: Real Devnet transaction/account evidence and applicable server/client tests pass.

## Validation plan

Focused RPC/verifier/recovery tests, mocked failure cases, real wallet approval/rejection and public Devnet account/signature verification.

## Implementation record

Not started.

## Validation results

Not run — dependency incomplete.

## Risks, limitations, and follow-ups

Devnet and RPC availability can interrupt rehearsal. Provider failure must remain distinguishable from program rejection.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: Planning self-review only.
- Deployment or release: None.
