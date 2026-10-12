# Ticket DEV0217: Rehearse the hackathon event loop

- Status: Draft
- Created: 2026-10-12
- Last updated: 2026-10-12
- Milestone: Hackathon H6 integrated rehearsal
- Coordination: [COR0019 — Hackathon Solana group events](../organisatory/COR0019-hackathon-solana-group-events.md)
- Related records: depends on [DEV0211](DEV0211-persist-personal-wallet-bindings.md), [DEV0212](../frontend/DEV0212-connect-phantom-wallets.md), [DEV0213](DEV0213-persist-group-event-catalogue.md), [DEV0214](../blockchain/DEV0214-implement-threshold-funding-program.md), [DEV0215](../blockchain/DEV0215-integrate-sponsored-devnet-funding.md) and [DEV0216](../frontend/DEV0216-present-group-event-marketplace.md); historical rehearsal baseline [DEV0125](../../archive/backend/DEV0125-rehearse-hosted-marketplace-loops.md)

## Objective and context

Produce the final reproducible evidence that the latest scheduling application plus the hackathon extension works end to end: distinct email actors link Phantom wallets, a coach creates a group event, participants fund it with platform-sponsored fees, and both threshold outcomes recover correctly from finalized Devnet state.

## Scope and non-goals

- In scope: one-command local prerequisites where practical; deterministic non-secret fixtures; deployed Devnet program/configuration verification; separate coach, participants and sponsor; successful threshold/payout scenario; failed threshold/refund scenario; reload/recovery and duplicate safety; sponsor SOL accounting; responsive/keyboard browser evidence; Vercel configuration/runbook; README update; final COR0019 integration review.
- Out of scope: mainnet, real-value claims, production custody, public release, audit certification, load testing, attendance/disputes, private-session payments or unrelated open tickets.

## Expected behavior and edge cases

The rehearsal begins from documented prerequisites without database hand edits. Business wallets may start with no SOL; the platform sponsor covers only allowed fees/rent. Participants hold the selected Devnet seat token. The success event reaches its minimum, settles from finalized state and pays the frozen coach recipient once. The failure event misses its minimum and returns each exact contribution by the adopted refund path. Reloading during submission or after an ambiguous response recovers without duplicate payment, payout or refund. Explorer evidence agrees with the application projections and no key material appears in logs, screenshots, tickets or commits.

## Assumptions, decisions, and dependencies

All prerequisite tickets must be Completed, or an explicit replacement must be linked, before this ticket becomes Ready. Historical DEV0125 rehearsal planning and any earlier local/Devnet evidence are inputs only: the current branch must freshly prove its restored program, current application, separate actors, success/payout, failure/refund and recovery paths. Real Devnet transactions require step-by-step user approval after showing recipient, amount, token, fee payer and cluster. Hosted rehearsal may use a preview deployment, but deployment itself remains an operator action unless separately authorized. Public Devnet addresses and signatures are acceptable evidence; secrets are not.

## Implementation plan

1. Audit prerequisites, exact tool/package versions, environment categories and branch documentation; fail closed on missing or mainnet configuration.
2. Add bounded fixture/provisioning and rehearsal automation that never creates or prints private wallet material.
3. Run local unit/database/browser and compiled-program Surfpool suites from clean state.
4. With explicit transaction approvals, run real Phantom Devnet success/payout and failure/refund paths with reload/recovery and Explorer verification.
5. Validate the Vercel build/configuration path, update README and every DEV/COR implementation record, then complete the integration review.

## Acceptance criteria

- [ ] AC1: Documented local setup runs the application, database/Auth/Mailpit and Solana test dependencies without secret material in source or logs.
- [ ] AC2: A real Phantom Devnet success scenario proves coach creation, multiple participant funding, platform fee sponsorship, deterministic settlement and exact one-time payout.
- [ ] AC3: A real Phantom Devnet failure scenario proves deterministic failure and exact one-time refund delivery for every tested participant.
- [ ] AC4: Reload, ambiguity, rejection, expiry and duplicate retries recover without manual database repair or double value movement.
- [ ] AC5: Full relevant tests, lint, typecheck, formatting, production/Vercel build and responsive keyboard rehearsal pass, and COR0019 links/statuses/specification remain consistent.

## Validation plan

Run the complete relevant npm/database suite, Rust/program unit tests, `NO_DNA=1` Anchor/Surfpool checks, lint, typecheck, format check, Next.js build and Vercel configuration-free/public-preview guard. Use separate real Phantom Devnet wallets for coach and participants plus the distinct sponsor. Capture pool, vault, contribution and transaction addresses/signatures; reconcile exact token and sponsor SOL deltas. Exercise desktop and mobile widths plus keyboard navigation. Record every failed or skipped check precisely.

## Implementation record

Pending implementation.

### Changes and rationale

Pending.

### Affected files

| File or component                   | Change and purpose                                   |
| ----------------------------------- | ---------------------------------------------------- |
| Rehearsal scripts/tests             | Reproducible integrated success and failure proof.   |
| README/environment examples         | Safe local, Devnet and Vercel operator instructions. |
| DEV0211–DEV0217 and COR0019 records | Final validation and integration evidence.           |

### Decisions and deviations

None yet.

### Contracts, configuration, and operations

Expected to validate, not invent, the dependencies and environment variables delivered by earlier tickets. No wallet private key, seed phrase or sponsor key material may be stored in repository artifacts.

## Validation results

Pending validation.

- Date and environment: Not run.
- Exact commands and outcomes: Not run.
- Manual steps and observed outcomes: Not run.
- Failed, blocked, or not-run checks and reasons: All runtime dependencies are still Draft.

| Criterion | Evidence                                   | Result  |
| --------- | ------------------------------------------ | ------- |
| AC1       | Clean local startup evidence               | Not run |
| AC2       | Approved Devnet success/payout evidence    | Not run |
| AC3       | Approved Devnet failure/refund evidence    | Not run |
| AC4       | Recovery/idempotency evidence              | Not run |
| AC5       | Full integration/static/browser/doc checks | Not run |

## Risks, limitations, and follow-ups

Devnet, public RPCs, faucets and wallet extensions are external dependencies and may be temporarily unavailable. That can block rehearsal but never justifies weakening signature, source-of-truth or secret-handling checks. Completion proves a hackathon Devnet demonstration, not audit, production or mainnet readiness.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: No independent review or pull request.
- Deployment or release: Not deployed.
