# Ticket DEV0216: Present the group-event marketplace

- Status: Draft
- Created: 2026-10-12
- Last updated: 2026-10-12
- Milestone: Hackathon H5 event experience
- Coordination: [COR0019 — Hackathon Solana group events](../organisatory/COR0019-hackathon-solana-group-events.md)
- Related records: depends on [DEV0212](DEV0212-connect-phantom-wallets.md), [DEV0213](../backend/DEV0213-persist-group-event-catalogue.md) and [DEV0215](../blockchain/DEV0215-integrate-sponsored-devnet-funding.md); historical interface baseline [DEV0123](../../archive/frontend/DEV0123-present-group-event-creation-and-funding.md)

## Objective and context

Restore and adapt the Events product surface to the redesigned public and authenticated application so coaches can create/manage threshold-funded group events and clients can discover, fund and recover them with truthful chain-derived status.

## Scope and non-goals

- In scope: public `Events` navigation, catalogue and event detail; coach-workspace Events destination; draft creation/edit/review/publish/withdraw controls allowed by DEV0210; event time/location/price/threshold/capacity/deadline; funding progress; connect/link gate; simulated transaction review; contribution, settlement, payout and refund controls; Explorer links; pending/recovery/unavailable/error states; mobile/desktop/keyboard coverage.
- Out of scope: persistence/program internals, wallet custody, attendance, messages, reviews, waitlists, transfers, fiat, private-session payment changes or fabricated demo funding.

## Expected behavior and edge cases

Guests can browse published group events without a wallet. Financial controls require the correct authenticated and linked actor. A coach creates a draft from an owned confirmed location, reviews immutable pool terms, signs creation and publishes only after finalized verification. A participant sees the exact Devnet token price and conditional nature, reviews the complete transaction and funds one spot. The interface shows submitted, finalized, successful, paid, failed and refunded states only from authoritative data. Full, late, duplicate, own-coach, wrong-wallet, insufficient-token, rejected, expired, RPC-unavailable and recovery states are explicit and do not imply success.

## Assumptions, decisions, and dependencies

Use shared public/authenticated shell components and add Events as a route-aware destination without regressing Explore, My sessions, Profile or Coach workspace. Event location is a stable snapshot from the coach's confirmed locations. The list/detail remains usable when wallet or RPC integration is unavailable, but financial progress must be labelled unavailable if not current. Transaction controls consume DEV0215's exact prepare/review/sign/submit/recover contract and never construct arbitrary value transfers in the browser. Commit `d385bdd` is the recoverable route/component/test baseline; implementation ports it into the current redesigned shells rather than reviving its obsolete surrounding marketplace UI.

## Implementation plan

1. Add route-aware public and coach-workspace Events navigation consistent with the redesigned desktop/mobile shells.
2. Build bounded coach draft and immutable pool-review flows from DEV0213 services.
3. Build public catalogue/detail/progress views with list-first failure behavior and no participant identity leakage.
4. Add a reusable DEV0215 operation reviewer for create, fund, settle, payout and refund with honest pending/recovery states.
5. Add component, authorization and Playwright coverage across guest/client/coach roles, mobile/desktop widths, keyboard use and wallet/RPC failures; run static/build checks.

## Acceptance criteria

- [ ] AC1: Public navigation exposes an Events catalogue/detail that accurately describes conditional funding without requiring login or wallet connection.
- [ ] AC2: An approved coach can create and manage an owned event through the exact frozen terms and finalized publication boundary.
- [ ] AC3: An eligible linked participant can fund one spot after reviewing exact value/recipient/token/fee-payer/cluster, and reload converges to finalized state.
- [ ] AC4: Success/payout and failure/refund views expose only eligible actions and never reveal another participant's identity or contribution details.
- [ ] AC5: Responsive, keyboard, authorization, unavailable/rejected/recovery, component, browser, static and build checks pass.

## Validation plan

Add pure presentation/action-matrix tests, component tests and Playwright guest, unlinked client, linked client, owning coach and unrelated coach scenarios. Cover narrow and desktop layouts, persistent mobile navigation, keyboard operation, wallet absence/rejection/account switch, RPC/database unavailable, stale projections, full/late/duplicate funding, success/payout and failure/refund. Run relevant unit/database tests plus lint, typecheck, format check and build. DEV0217 owns final real-Phantom Devnet proof.

## Implementation record

Pending implementation.

### Changes and rationale

Pending.

### Affected files

| File or component                  | Change and purpose                                          |
| ---------------------------------- | ----------------------------------------------------------- |
| Public/coach routes and navigation | Events catalogue, detail and coach management destinations. |
| Group-event feature components     | Draft, status, progress and operation-review interface.     |
| Domain/action derivation           | Role, lifecycle and current-data eligibility rules.         |
| Browser/component tests            | Responsive, accessible and failure-state evidence.          |

### Decisions and deviations

None yet.

### Contracts, configuration, and operations

Consumes DEV0212/DEV0213/DEV0215 interfaces and public Devnet configuration; introduces no secret. Exact route names and component boundaries remain pending implementation but must preserve the existing shell contracts.

## Validation results

Pending validation.

- Date and environment: Not run.
- Exact commands and outcomes: Not run.
- Manual steps and observed outcomes: Not run.
- Failed, blocked, or not-run checks and reasons: Blocked from Ready by its wallet, persistence and transaction-operation dependencies.

| Criterion | Evidence                                     | Result  |
| --------- | -------------------------------------------- | ------- |
| AC1       | Guest catalogue/detail browser tests         | Not run |
| AC2       | Coach creation/publication tests             | Not run |
| AC3       | Participant transaction flow tests           | Not run |
| AC4       | Role/privacy/lifecycle tests                 | Not run |
| AC5       | Responsive/accessibility/static/build checks | Not run |

## Risks, limitations, and follow-ups

The UX must distinguish interest, a funded contribution and a successfully scheduled event. The adopted contract uses a participant-signed, platform-sponsored claim, so the UI must present `Refund available` and an explicit refund action rather than promise an automatic refund.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: No independent review or pull request.
- Deployment or release: Not deployed.
