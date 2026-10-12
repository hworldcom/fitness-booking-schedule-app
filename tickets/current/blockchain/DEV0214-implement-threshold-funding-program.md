# Ticket DEV0214: Implement the threshold-funding program

- Status: Ready
- Created: 2026-10-12
- Last updated: 2026-10-12
- Milestone: Hackathon H3 local funding program
- Coordination: [COR0019 — Hackathon Solana group events](../organisatory/COR0019-hackathon-solana-group-events.md)
- Related records: depends on completed [DEV0210](../../archive/organisatory/DEV0210-adopt-hackathon-group-event-contract.md); historical program baseline [DEV0121](../../archive/blockchain/DEV0121-implement-group-event-funding-program.md) and asset baseline [DEV0134](../../archive/blockchain/DEV0134-adopt-eurc-for-marketplace-payments.md); supplies the chain contract to [DEV0215](DEV0215-integrate-sponsored-devnet-funding.md)

## Objective and context

Recover and locally re-prove the previously implemented Solana EventPool contract that escrows exact seat contributions under immutable group-event threshold rules, then permits one successful coach payout or exact failed-event refunds without trusting the application database for financial outcomes.

## Scope and non-goals

- In scope: reviewed program identity and upgrade policy; Anchor workspace; `EventPool` and per-wallet `Contribution` program-derived accounts (PDAs); per-event token vault; separate payer and business authorities; create, fund, settle, payout and refund instructions; immutable bounded terms; structured events/errors; liability accounting independent of raw vault balance; IDL and Codama Kit client; LiteSVM/Mollusk and embedded Surfpool tests; security/autofixer review.
- Out of scope: UI, PostgreSQL, Devnet deployment, sponsor API, mainnet, production assets, attendance/disputes, secondary transfers, partial deposits, multi-seat wallets, waitlists or unbounded participant loops.

## Expected behavior and edge cases

The coach authority creates one pool with immutable mint, token program, price, minimum, maximum, deadline, event schedule and payout recipient. Each participant wallet can fund one exact spot before the cutoff and capacity. Any permitted submitter can settle once after the contract-defined boundary. Success makes the exact recorded funded liability payable once to the frozen coach recipient and disables refunds. Failure disables payout and makes each recorded contribution independently refundable exactly once to its fixed participant destination. Wrong signer, account owner, PDA, bump, mint, token program, source/destination, amount, time, state, capacity, duplicate, overflow, donation, underfunded vault and replay paths fail atomically.

## Assumptions, decisions, and dependencies

DEV0210 freezes official Devnet EURC, deadline-only settlement, no bound-pool cancellation, participant-signed independent refunds and the previously tested bounds. Commit `3e5146d` supplies the completed EventPool implementation; `6671383` supplies platform-payer separation; `7815539` supplies the EURC compatibility change; and `12e8ccc` supplies integration-facing corrections. The scheduling split removed `Anchor.toml`, Rust program sources, IDL and generated client, so this ticket restores the reviewed combined program artifacts from Git history and exposes only group-event product behavior in this branch. It does not redesign the contract or restore pass/credit application surfaces unless a documented current-toolchain incompatibility requires a scoped correction.

Use Anchor 1.1.x and the compatible Solana toolchain after inspecting current documentation. Preserve fixed-size state with reserved bytes, explicit enum transitions, canonical bumps, checked arithmetic, typed legacy SPL Token accounts/program IDs, one contribution PDA per event/wallet and recorded-liability accounting. Separate `payer` from coach/participant authority so DEV0215 can sponsor SOL costs.

No transaction or key generation is authorized by this ticket until implementation begins under explicit branch work. Any later real Devnet submission requires user approval after recipient, amount, token, fee payer and cluster are shown.

## Implementation plan

1. Recover the exact reviewed program, IDL/client and tests from commits `3e5146d`, `6671383`, `7815539` and `12e8ccc`; inventory any dependency or repository-boundary drift before editing behavior.
2. Rebuild the Anchor program with current compatible tooling and preserve explicit account validation, checked transitions, cross-program-invocation safety, structured events and bounded errors; document any necessary deviation before making it.
3. Regenerate and check in the IDL and Codama `@solana/kit` client; prove parity with the restored account layouts, discriminators, PDA helpers and deployed interface.
4. Add unit and embedded-Surfpool success/failure/payout/refund/time/adversarial tests with separate zero-SOL business wallets and payer.
5. Run the required Solana program autofixer until no critical/high rerun remains, then format, clippy, SBF build, client parity and compute/rent checks.

## Acceptance criteria

- [ ] AC1: Valid creation/funding creates immutable pool, vault and one exact contribution per participant wallet with distinct payer and authority roles.
- [ ] AC2: The success path pays the frozen coach recipient exactly once and cannot refund; the failure path cannot pay the coach and preserves every exact refund independently.
- [ ] AC3: Wrong, duplicate, late, full, overflow, early, donation, underfunded, account-substitution and replay paths fail without value loss or lifecycle regression.
- [ ] AC4: IDL/Codama parity, unit, compiled-program Surfpool, security/autofixer, format, clippy and SBF build checks pass with recorded rent/compute evidence.

## Validation plan

Use pure state-transition tests plus LiteSVM or Mollusk for fast instruction failures and embedded Surfpool for compiled SBF token CPI lifecycles. Time-travel across the funding deadline. Assert exact pre/post token balances, distinct signer roles, PDA derivation, account owners, canonical bumps, recorded liabilities and replay failure. Run `NO_DNA=1` for agent-executed Anchor/Surfpool/Solana CLI commands, the Solana program autofixer, Rust format/clippy/build, generated-client tests and repository static checks.

## Implementation record

Pending implementation.

### Changes and rationale

Pending.

### Affected files

| File or component              | Change and purpose                                          |
| ------------------------------ | ----------------------------------------------------------- |
| Anchor program workspace       | Threshold escrow accounts, instructions, events and errors. |
| Generated IDL/Codama client    | Typed application-neutral chain interface.                  |
| Program unit/integration tests | Adversarial state/value proof and compute evidence.         |

### Decisions and deviations

None yet.

### Contracts, configuration, and operations

Expected contracts include a deployable program ID, exact mint/program IDs, PDA seeds, account layouts and instruction codecs. No keypair or secret may be committed. DEV0210 requires deployment/upgrade authority to remain separate from the public fee sponsor; the exact retained or replacement authority and rollback procedure must be recorded during implementation review.

## Validation results

Pending validation.

- Date and environment: Not run.
- Exact commands and outcomes: Not run.
- Manual steps and observed outcomes: Not run.
- Failed, blocked, or not-run checks and reasons: Not run — implementation has not started; DEV0210 resolved the asset and lifecycle decisions required to begin.

| Criterion | Evidence                           | Result  |
| --------- | ---------------------------------- | ------- |
| AC1       | Create/fund compiled-program tests | Not run |
| AC2       | Success/failure lifecycle tests    | Not run |
| AC3       | Adversarial matrix                 | Not run |
| AC4       | Client/security/build evidence     | Not run |

## Risks, limitations, and follow-ups

This program controls tokens and requires a higher validation bar than ordinary UI work. Pull-style or fixed-recipient independent refunds avoid an unbounded all-participant transaction, but the user-visible delivery guarantee depends on DEV0215's sponsor/worker reliability. A hackathon proof is not an audit or mainnet readiness claim.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: No independent security review or pull request.
- Deployment or release: No program deployed.
