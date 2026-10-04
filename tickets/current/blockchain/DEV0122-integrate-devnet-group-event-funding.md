# Ticket DEV0122: Integrate Devnet group-event funding

- Status: Draft
- Created: 2026-10-04
- Last updated: 2026-10-04
- Milestone: Marketplace M6 Devnet funding integration
- Coordination: [COR0010 — Coach-pass and group-funded marketplace MVP](../organisatory/COR0010-group-funded-coach-marketplace-mvp.md)
- Related records: depends on [DEV0121 — Implement the group-event funding program](DEV0121-implement-group-event-funding-program.md), [DEV0120 — Persist group-event catalogue and projections](../backend/DEV0120-persist-group-event-catalogue-and-projections.md), the platform-payer boundary in [DEV0132](DEV0132-make-coach-pass-operations-platform-funded.md) and personal-wallet authority from [DEV0047](../backend/DEV0047-personal-wallet-linking-and-replacement.md); supplies contracts to [DEV0123](../frontend/DEV0123-present-group-event-creation-and-funding.md) and evidence to [DEV0125](../backend/DEV0125-rehearse-hosted-marketplace-loops.md)

## Objective and context

Connect the local EventPool contract to recoverable official Devnet test-USDC operations—coach creation, participant funding, permissionless settlement, coach payout and participant refund—without requiring test SOL in coach or participant wallets.

## Scope and non-goals

- In scope: server-authoritative transaction preparation; readiness and token-account checks; simulation; wallet plus bounded platform-payer signing; platform payment of every fee and rent deposit; idempotent operation/reference records; submission/finalized verification; lost-response recovery; chain indexing into DEV0120 projections; deploy/configuration documentation; real Devnet success and failure rehearsals.
- Out of scope: final page composition, mainnet, automatic attendance/disputes, production keeper guarantees, Kora migration, fiat onramp or arbitrary tokens.

## Expected behavior and edge cases

Every approval clearly identifies Devnet, test USDC, amount, authority, vault/destination and the MovX platform payer. The platform pays every fee and rent deposit; coaches and participants still sign their actions and participants supply exact test-USDC contributions. Browser values never define financial terms. Rejection, insufficient balance, missing account, stale blockhash, RPC timeout or ambiguous response remains recoverable and cannot duplicate value movement. Settlement may be initiated by any caller, while payout/refund authority remains program-enforced.

## Assumptions, decisions, and dependencies

Pin/verify official Devnet mint, program and decimals plus deployable program/upgrade authority before use. Credentialed RPC and platform-payer material stay server-only and remain separate from recovery/deployment authority. Reuse generic transaction/recovery patterns only after reviewing their current dependencies and Cloudflare resource behavior.

## Implementation plan

1. Freeze environment and operation contracts plus deployment/upgrade procedure.
2. Implement prepare/simulate/sign/submit/verify/recover boundaries for every instruction.
3. Implement finalized account/event indexing and idempotent projection reconciliation.
4. Add client-facing operation adapters for DEV0123.
5. Deploy/rehearse one success/payout and one failure/refund on Devnet with public evidence.

## Acceptance criteria

- [ ] AC1: Coach creation and exact participant funding complete through reviewed simulated transactions and finalized verified accounts.
- [ ] AC2: Permissionless settlement plus authorized payout/refund produce the exact mutually exclusive finalized outcomes.
- [ ] AC3: Rejection, missing balance/account, RPC ambiguity and reload recover without duplicate contribution, payout or refund.
- [ ] AC4: Secrets stay server-only, sponsorship cannot grant business authority and every indexed projection matches finalized state.
- [ ] AC5: Every fee and rent deposit is paid by the configured platform payer, while exact event contributions still come from the authorizing participant's test-USDC account.
- [ ] AC6: Focused server/client/index tests and real public Devnet success/failure evidence pass.

## Validation plan

Run deterministic transaction/verifier/recovery tests, mocked RPC adversarial responses, projection replay tests, browser wallet approval/rejection/reload checks and real Devnet account/balance/signature verification. Record configuration without secrets.

## Implementation record

Not started.

### Changes and rationale

Pending implementation.

### Affected files

Planned: deployment/env contract, server transaction/verification/index services, browser wallet adapter and focused tests.

### Decisions and deviations

None yet.

### Contracts, configuration, and operations

Expected public program ID/browser RPC plus server-only credentialed RPC and mandatory bounded platform-payer configuration. Exact names are frozen during implementation.

## Validation results

Not run — dependencies incomplete.

## Risks, limitations, and follow-ups

Devnet RPC/faucet availability and Cloudflare limits can interrupt rehearsal; distinguish provider failure from program failure without weakening verification.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: Planning self-review only.
- Deployment or release: None.
