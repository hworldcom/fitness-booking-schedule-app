# Ticket DEV0125: Rehearse the hosted marketplace loops

- Status: Cancelled
- Created: 2026-10-04
- Last updated: 2026-10-07
- Milestone: Marketplace M7 hosted rehearsal
- Coordination: [COR0010 — Coach-pass and group-funded marketplace MVP](../organisatory/COR0010-group-funded-coach-marketplace-mvp.md)
- Related records: integrates every retained COR0010 runtime peer after completion, including the completed EURC compatibility contract in [DEV0134](../../archive/blockchain/DEV0134-adopt-eurc-for-marketplace-payments.md) and two-loop scope consolidation in [DEV0135](../../archive/organisatory/DEV0135-narrow-marketplace-mvp-to-two-loops.md); depends on Vercel readiness from [DEV0138](../../archive/backend/DEV0138-prepare-vercel-deployment.md) and the hosted Supabase environment in [DEV0055](../../current/backend/DEV0055-hosted-supabase-staging-environment.md), while the retired Cloudflare path remains historical under [COR0004](../../archive/organisatory/COR0004-hosted-staging-deployment.md)

## Objective and context

Deploy and prove the primary coach-pass/calendar-booking loop and secondary conditional group-funding loop on staging and Solana Devnet with repeatable public evidence suitable for a concise hackathon demonstration.

## Scope and non-goals

- In scope: peer-completion/configuration audit; one live exact pass purchase; one booking and cancellation-policy proof; coach client-card consistency; deterministic fictional event setup; prepared funded wallets/pools; one live threshold-completing contribution; success payout; failed-pool refund; reload/recovery; Explorer/database/view consistency; desktop/mobile smoke; secret-safe reset/rollback evidence.
- Out of scope: finishing peer work, client-authored training requests, coach proposals, any third marketplace loop, production/mainnet, real participants, attendance/disputes, external monitoring guarantees or CI/CD.

## Expected behavior and edge cases

The primary path purchases a fictional coach's pass, reloads the same pair ledger, books one open occurrence and shows the matching coach client card. Prepared early/late cancellation states demonstrate the coach policy. The secondary path opens an event at `2 / 3`, adds one live finalized contribution, settles/pays once, then demonstrates one failed-pool refund. No manual database or chain edit occurs during the timed path; prepared state comes only from a documented bounded setup command.

## Assumptions, decisions, and dependencies

Every owning runtime ticket for the two retained loops must be Completed before rehearsal. Cancelled request/proposal work is not a rehearsal dependency. Exact Devnet program/mint/RPC/sponsor, deploy/upgrade authority and funding provenance must be documented without secrets. Prepared wallets are acceptable; private keys are never committed or included in evidence.

## Implementation plan

1. Audit peer completion, staging/database/program/RPC/Mapbox/Auth compatibility and secret placement.
2. Add bounded deterministic demo preparation/reset commands where owning contracts permit.
3. Deploy a clean reviewed revision and verify readiness.
4. Run and time the pass/booking/client-card path and the successful/failed pool paths plus social framing.
5. Verify finalized chain, database projections, reload, authorization and failure behavior.
6. Record public references, revision, commands, limitations, rollback and repeat instructions in this ticket and COR0010.

## Acceptance criteria

- [ ] AC1: A clean reviewed revision deploys with correct least-privilege staging and Devnet configuration and no secret leakage.
- [ ] AC2: The hosted primary path completes an exact pass purchase, reload recovery, one credit-backed booking, cancellation-policy demonstration and matching coach client card without manual repair.
- [ ] AC3: The hosted group path completes one live threshold contribution, exact one-time coach payout and one underfunded-pool refund while replay/conflict paths fail.
- [ ] AC4: Browser, database index and finalized chain views converge after reload/lost-response recovery; Mapbox failure preserves list discovery.
- [ ] AC5: Redacted evidence includes exact commands/results, public account/signature links, timing, deployment revision, prerequisites and reset/rollback steps.

## Validation plan

Run all peer-required tests against the integrated revision, guarded Vercel deployment checks, hosted desktop/mobile flows with prepared accounts/wallets, public RPC/Explorer verification, function logs and bounded provider/wallet rejection/recovery cases.

## Implementation record

Not started.

### Changes and rationale

Pending implementation.

### Affected files

Planned: bounded demo setup/reseed/rehearsal scripts, hosted checks and this ticket/COR integration evidence.

### Decisions and deviations

- 2026-10-07: DEV0139 retired the Cloudflare runtime/deployment path. The hosted rehearsal will use native Next.js on Vercel while retaining the same M7 marketplace, Supabase and Devnet evidence requirements.

### Contracts, configuration, and operations

No new product contract; integrates peer-owned configuration and documents only public identifiers plus secret placement requirements.

## Validation results

Not run — dependencies incomplete.

## Risks, limitations, and follow-ups

Devnet, RPC, Vercel or other hosted-provider outages can block the rehearsal. Record environmental blockers honestly and never fabricate settlement or relax authorization to fit the demo.

## Scheduling-only branch disposition

Cancelled on 2026-10-07 before implementation because the pass/payment and group-funding loops no longer exist on this branch. Hosted scheduling rehearsal is now the M4 outcome in the current specification and requires a future focused ticket after COR0011 runtime work completes.

## Completion and review references

- Completed: Cancelled on 2026-10-07 before implementation; no hosted marketplace evidence is claimed.
- Commit: Not created.
- Review: Planning self-review only.
- Deployment or release: None.
