# Ticket DEV0130: Integrate Devnet coach-pass operations

- Status: Draft
- Created: 2026-10-04
- Last updated: 2026-10-05
- Milestone: Marketplace M6 Devnet pass integration
- Coordination: [COR0010 — Coach-pass and group-funded marketplace MVP](../organisatory/COR0010-group-funded-coach-marketplace-mvp.md)
- Related records: depends on completed [DEV0127](../../archive/blockchain/DEV0127-implement-coach-client-credit-ledger.md), completed [DEV0131](../../archive/blockchain/DEV0131-implement-coach-credit-booking-lifecycle.md), completed platform-payer contract [DEV0132](../../archive/blockchain/DEV0132-make-coach-pass-operations-platform-funded.md), completed EURC compatibility contract [DEV0134](../../archive/blockchain/DEV0134-adopt-eurc-for-marketplace-payments.md), personal-wallet work in DEV0047 and hosted infrastructure under COR0004; supplies transaction adapters to completed [DEV0128](../../archive/backend/DEV0128-persist-credit-backed-private-bookings.md) and [DEV0129](../frontend/DEV0129-present-coach-passes-bookings-and-client-cards.md)

## Objective and context

Connect the complete local coach-pass program to recoverable Devnet purchases and booking-credit operations with server-authoritative preparation, simulation, wallet approval, bounded platform payment of every transaction fee and rent deposit, and finalized pair-ledger/reservation verification.

## Scope and non-goals

- In scope: deployable program/upgrade identity; Devnet configuration; prepare/simulate/sign/submit/verify/recover operations; token-account readiness; pair-ledger and reservation indexing; first/subsequent purchase recovery; reserve/consume/return recovery; public Explorer evidence.
- Out of scope: UI composition, booking rules, mainnet, arbitrary tokens, production custody, Kora migration or real-money claims.

## Expected behavior and edge cases

Every purchase approval identifies Devnet, test EURC, coach, exact price, purchased credits, destination and the MovX platform payer. Every booking-credit approval identifies the pair ledger, booking reference, scheduled time/cutoff, exact transition, authority and platform payer. Clients and coaches need no test SOL; the client still supplies the exact purchase price in test EURC and every business action still requires its client or coach signature. A lost response is recovered from the pair PDA, purchase nonce or deterministic reservation receipt. Wallet rejection, insufficient balance, missing token account, stale blockhash or RPC ambiguity never causes a blind repeat.

## Assumptions, decisions, and dependencies

The DEV0127 purchase contract, DEV0131 reservation contract and DEV0132 platform-payer instruction/client change are complete and stable for deployment. Credentialed RPC, platform-payer, recovery and upgrade material remain separate server/operator secrets. The sponsor signs only an allowlisted transaction reconstructed and validated by the server; it cannot replace the required client or coach authority. Automation may not sign or send a user-authorized transaction without that user's explicit approval.

## Implementation plan

1. Freeze deployment/configuration, bounded platform-payer policy and operation records against DEV0132's completed interface.
2. Implement first/subsequent purchase plus reserve/consume/return preparation and simulation.
3. Implement submit/finalize/verify/recover plus pair-ledger/reservation projection indexing.
4. Rehearse public/restricted purchases and each booking-credit terminal path on Devnet with public evidence.

## Acceptance criteria

- [ ] AC1: First and later exact test-EURC purchases finalize with verified pair-ledger balances.
- [ ] AC2: Reserve, consume and return operations finalize with verified pair-ledger/reservation state.
- [ ] AC3: Rejection and ambiguous outcomes recover without duplicate payment, reservation or terminal resolution.
- [ ] AC4: Every transaction fee and rent deposit is paid by the configured platform payer, users need no test SOL, secrets remain server-only and sponsorship cannot buy or mutate credits without the required client/coach authority.
- [ ] AC5: Real Devnet transaction/account evidence and applicable server/client tests pass.

## Validation plan

Focused RPC/verifier/recovery tests, mocked purchase and booking-operation failure cases, real wallet approval/rejection and public Devnet account/signature verification.

## Implementation record

Not started.

## Validation results

Not run — the local DEV0131 contract and DEV0132 payer interface are complete, but this Devnet deployment/integration ticket has not started.

## Risks, limitations, and follow-ups

Devnet and RPC availability can interrupt rehearsal. Provider failure must remain distinguishable from program rejection. The platform payer is an availability and abuse-control boundary, so the adapter must allowlist exact instructions/accounts, cap spend and rate, validate the wallet-signed message before countersigning and never reuse sponsor authority as recovery or upgrade authority.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: Planning self-review only.
- Deployment or release: None.
