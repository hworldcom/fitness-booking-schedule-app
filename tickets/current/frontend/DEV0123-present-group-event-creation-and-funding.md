# Ticket DEV0123: Present group-event creation and funding

- Status: Draft
- Created: 2026-10-04
- Last updated: 2026-10-05
- Milestone: Marketplace M3/M5 group-event experience
- Coordination: [COR0010 — Coach-pass and group-funded marketplace MVP](../organisatory/COR0010-group-funded-coach-marketplace-mvp.md)
- Related records: depends on completed [DEV0120 — Persist group-event catalogue and projections](../../archive/backend/DEV0120-persist-group-event-catalogue-and-projections.md), [DEV0122 — Integrate Devnet group-event funding](../blockchain/DEV0122-integrate-devnet-group-event-funding.md) and completed EURC contract [DEV0134](../../archive/blockchain/DEV0134-adopt-eurc-for-marketplace-payments.md); consumes coach/location/calendar foundations and supplies the primary browser flow to DEV0125

## Objective and context

Give coaches and clients an understandable interface for creating, discovering and conditionally funding group events, including successful payout and failed-pool refund states.

## Scope and non-goals

- In scope: coach draft/create review; event list/detail; funding progress and deadline; wallet readiness/simulation summary; contribution pending/success/recovery; settlement control; coach payout; participant refund; Explorer links; responsive/keyboard/error states.
- Out of scope: persistence/program implementation, attendance/check-in, disputes, no-show handling, waitlists, multi-seat purchases, chat or fiat.

## Expected behavior and edge cases

The interface explains that the full seat price is conditional, identifies Devnet/test EURC and shows the exact minimum, maximum, deadline, vault-backed state and refund rule. It never calls an unfinalized transaction successful. Only eligible coach/participant actions render, while permissionless settlement remains available without implying caller control over outcome.

## Assumptions, decisions, and dependencies

Use server/chain-derived terms and status. The accessible event list remains useful without Mapbox or wallet connection. Prepared demo pools must be labeled demonstration data.

## Implementation plan

1. Add coach event draft/review/create surfaces.
2. Add accessible event discovery/detail/progress views.
3. Connect funding, settlement, payout and refund operation states.
4. Add recovery, unavailable, rejected, insufficient-balance and stale-state UX.
5. Verify desktop/mobile/keyboard and public/protected role flows.

## Acceptance criteria

- [ ] AC1: Coach creation presents and signs exactly the reviewed immutable pool terms.
- [ ] AC2: A participant can discover and fund one seat with accurate progress and finalized recovery state.
- [ ] AC3: Successful pool/payout and failed pool/refund views expose only authorized actions and converge after reload.
- [ ] AC4: Map/wallet/RPC/unavailable/rejected states remain honest and accessible at mobile/desktop widths.
- [ ] AC5: Component, browser, authorization, static and build checks pass.

## Validation plan

Run focused components, mocked operation transitions, Playwright guest/client/coach/unrelated flows, real-wallet Devnet rehearsal inherited from DEV0122, desktop/mobile keyboard checks, lint, typecheck, formatting and builds.

## Implementation record

Not started.

### Changes and rationale

Pending implementation.

### Affected files

Planned: coach workspace/event routes, marketplace/event features, shared styles and browser tests.

### Decisions and deviations

None yet.

### Contracts, configuration, and operations

Consumes DEV0120/DEV0122; no additional secrets expected.

## Validation results

Not run — dependencies incomplete.

## Risks, limitations, and follow-ups

Funding language must not imply real-money guarantees, automatic background execution or proof that the offline event occurred.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: Planning self-review only.
- Deployment or release: None.
