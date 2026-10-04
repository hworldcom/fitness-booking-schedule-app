# Ticket DEV0106: Rehearse the hosted coach booking loop

- Status: Draft
- Created: 2026-10-03
- Last updated: 2026-10-04
- Milestone: Coach-first M7 hosted rehearsal
- Coordination: [COR0009 — Coach-first private-class booking MVP](../organisatory/COR0009-coach-first-training-package-mvp.md)
- Related records: integrates DEV0095–DEV0100, DEV0104–DEV0105, [DEV0108 — Add the Mapbox coach Explore map](../frontend/DEV0108-add-mapbox-coach-explore-map.md), [DEV0114 — Persist recurring coach availability](DEV0114-persist-recurring-coach-availability.md), [DEV0115 — Add the coach schedule calendar](../frontend/DEV0115-add-coach-schedule-calendar.md) and the reviewed migration outcome of [DEV0109 — Retire membership schema and preserve gyms](../../archive/backend/DEV0109-retire-membership-schema-and-preserve-gyms.md) after their completion; depends on the staging foundation coordinated by [COR0004 — Hosted staging deployment](../organisatory/COR0004-hosted-staging-deployment.md), including DEV0055/DEV0056; does not replace their infrastructure ownership

## Objective and context

Deploy and rehearse the complete coach-first private-class loop on the existing staging foundation: accessible list/Mapbox coach discovery, repeating coach availability with dated capacity-one occurrences at stable coach-selected locations, one-session/ten-session offers, exact test-USDC purchase, pass-backed booking, cancellation with credit retained, rebooking, completed-class redemption and chronological coach content. This ticket supplies the integration and release evidence required to complete COR0009; no coordination record can substitute for it.

## Scope and non-goals

- In scope: integrate completed peer migrations/configuration/program addresses and URL-restricted Mapbox public-token setup into staging; verify DEV0109's reviewed schema cleanup and fictional gym preservation; guarded Worker deployment; deterministic fictional coach/gym-or-independent-location/offer/availability setup; funded Devnet coach/client/sponsor prerequisites; one 2–3 minute primary judge path plus focused map-fallback and cancellation/recovery evidence; chain/database/view consistency checks; secret-safe logs; mobile/desktop smoke checks; rollback/reseed instructions; public transaction/account references and ticket evidence.
- Out of scope: production release, mainnet assets, production availability guarantees, real coach/gym onboarding, performing or repairing DEV0109's destructive cleanup inside the rehearsal ticket, CI/CD, refunds, disputes, no-show policy, group bookings or expanding unfinished peer scope during rehearsal.

## Expected behavior and edge cases

The selected committed revision deploys through the guarded staging workflow with exact origin, restricted database access, one origin-restricted public Mapbox token and server-only secrets. A coach creates repeating weekly availability and the application projects the expected dated occurrences without duplicates. A guest uses the list/map Explore view to find that fictional coach at a coach-selected public location and sees an open occurrence with the same stable location label; a signed-in client sees the same schedule. The client links/connects the intended Devnet wallet, selects the occurrence, buys or uses an eligible one-session/ten-session pass and receives one confirmed booking. Client cancellation releases the reserved credit, reopens the still-valid occurrence and permits rebooking without changing the pass balance. Coach cancellation instead withdraws the occurrence while preserving the credit for a different eligible time. After the scheduled demonstration state is advanced through the reviewed fixture/rehearsal boundary, the coach confirms completion and one redemption changes the authoritative balance exactly once.

No manual database repair, ad hoc chain account edit or second charge may be needed during the primary path. A bounded setup/reseed command may prepare fictional data and funded test wallets before the timed demo. Failures must remain honest and recoverable, and no credential, keypair, email code or private RPC URL may enter evidence.

## Assumptions, decisions, and dependencies

Every owning implementation ticket must be Completed before this rehearsal starts; this ticket integrates rather than silently finishing peer acceptance criteria. DEV0109 must already have recorded the reviewed hosted migration state; this ticket verifies it but does not own destructive repair. DEV0055/DEV0056 provide the Supabase/Cloudflare/Auth/domain foundation but their historical multi-gym observations do not prove the coach booking loop. Exact official Devnet test-USDC mint/program/decimals, funding source, sponsor policy, program ID and upgrade authority must already be documented by DEV0097/DEV0098.

The judge price must fit the repeatable test-USDC funding procedure. Prepared test wallets are acceptable if their provenance and reset steps are documented without storing secrets.

## Implementation plan

1. Audit peer completion, staging state, schema/program/Mapbox configuration compatibility and secret placement.
2. Add or revise bounded deterministic coach/recurring-schedule/offer/occurrence demo preparation and reset operations owned by the relevant runtime contracts.
3. Deploy a reviewed clean commit to staging and verify route, Auth, database, RPC, sponsor and program readiness.
4. Run the primary map/list-discovery-to-book-to-redeem path and the cancellation/rebooking path; reconcile browser, database and finalized chain evidence.
5. Run mobile/desktop, authorization, failure/recovery and legacy-route smoke checks plus static/build suites.
6. Record timings, public references, limitations, rollback and repeat instructions; update COR0009 integration evidence.

## Acceptance criteria

- [ ] AC1: A clean reviewed coach-first revision is deployed to staging with correct origin, database, program, RPC, mint, sponsor and least-scope URL-restricted Mapbox public-token configuration and no browser/committed secret leakage.
- [ ] AC2: The hosted primary path creates a repeating weekly schedule, projects the expected dated occurrences and completes list/map discovery, stable-location occurrence selection, one exact test-USDC purchase, one TrainingPass, one confirmed booking and one completed-class redemption from `N` to `N - 1` without manual repair.
- [ ] AC3: Hosted client cancellation releases the reservation, reopens the still-valid slot, preserves the full pass credit and permits rebooking without another payment; hosted coach cancellation withdraws the slot while preserving that credit for another eligible slot.
- [ ] AC4: Coach/client views reload to the same finalized pass balance and booking history; retry/reconciliation cannot duplicate payment, booking or redemption.
- [ ] AC5: Follow/post behavior, mobile/desktop access, Mapbox failure with working list fallback, authorization failures and other unavailable states remain correct; retired membership/class/check-in routes and database mutation objects remain unavailable while fictional gym locations still resolve.
- [ ] AC6: Redacted evidence includes exact commands/results, public chain references, deployment revision, prerequisites, reset/rollback procedure and all remaining limitations.

## Validation plan

Run all peer-required unit/database/program/static/build/browser suites against the integrated revision, guarded staging checks and deployment, hosted desktop/mobile browser flows with two accounts and wallets, public RPC/explorer verification of Offer/TrainingPass/transfer/redemption state, Mapbox origin/usage checks, database projections and Worker logs. Exercise map-provider failure, wallet rejection, cancellation/rebooking and one bounded lost-response recovery without exposing tokens or secrets.

## Implementation record

Not started.

### Changes and rationale

Pending implementation.

### Affected files

Planned: bounded rehearsal/setup scripts, staging configuration only where peers require it, focused hosted tests, this ticket and COR0009 integration evidence.

### Decisions and deviations

None yet.

### Contracts, configuration, and operations

No new product contract is planned. Staging program/mint/RPC/sponsor identifiers and preparation/reset operations must be documented without secret values.

## Validation results

Not run — dependencies are incomplete.

## Risks, limitations, and follow-ups

Devnet faucet/RPC availability and Worker limits can block a rehearsal without invalidating local logic. The ticket must distinguish environmental blockage from application failure and must not weaken authorization or fabricate completion to fit the demo.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: Planning self-review only.
- Deployment or release: None.
