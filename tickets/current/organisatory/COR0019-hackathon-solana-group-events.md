# Coordination COR0019: Hackathon Solana group events

- Status: In progress
- Created: 2026-10-12
- Last updated: 2026-10-12
- Milestone: Hackathon Solana group-event track
- Converted from: Not applicable — created as a coordination record
- Tracked development tickets: [DEV0210](../../archive/organisatory/DEV0210-adopt-hackathon-group-event-contract.md), [DEV0211](../backend/DEV0211-persist-personal-wallet-bindings.md), [DEV0212](../frontend/DEV0212-connect-phantom-wallets.md), [DEV0213](../backend/DEV0213-persist-group-event-catalogue.md), [DEV0214](../blockchain/DEV0214-implement-threshold-funding-program.md), [DEV0215](../blockchain/DEV0215-integrate-sponsored-devnet-funding.md), [DEV0216](../frontend/DEV0216-present-group-event-marketplace.md), and [DEV0217](../backend/DEV0217-rehearse-hackathon-event-loop.md)
- Related records: historical baseline [COR0010 — Coach-pass and group-funded marketplace MVP](../../archive/organisatory/COR0010-group-funded-coach-marketplace-mvp.md); current scheduling baseline [COR0011 — Scheduling-only product branch](../../archive/organisatory/COR0011-scheduling-only-product.md)

## Objective and boundaries

Coordinate a hackathon-only extension of the latest scheduling application with Phantom wallet support and coach-created, threshold-funded group events. A coach sets an event time, location, seat price, minimum participant threshold, maximum capacity and funding deadline. Participants fund one spot; the coach is paid only when the threshold succeeds, while failed events preserve an exact refund entitlement for every participant. A separate platform wallet pays Solana transaction fees and account rent without replacing coach or participant authorization or contributing the seat value.

This branch deliberately diverges from the scheduling-only product contract. It reuses the current email identity, coach approval, profiles, locations, public marketplace, authenticated workspace and Vercel/Supabase foundation. It does not reintroduce training passes, private-session token payments, social feeds or the full historical marketplace. This coordination record implements no runtime behavior.

## Direct development work

| Implementation part                  | Development ticket                                                                                                               | Owned deliverable                                                                                                      | Start condition or dependency                                             |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Product and architecture contract    | [DEV0210 — Adopt the hackathon group-event contract](../../archive/organisatory/DEV0210-adopt-hackathon-group-event-contract.md) | Authoritative specification, confirmed decisions, non-goals, milestones and acceptance matrix                          | Completed; archived decisions are reconciled into the branch contract     |
| Wallet ownership and account binding | [DEV0211 — Persist personal wallet bindings](../backend/DEV0211-persist-personal-wallet-bindings.md)                             | Server-verified signed-message ownership, one active personal wallet per account and replacement/replay rules          | After DEV0210 freezes identity and cluster boundaries                     |
| Browser wallet experience            | [DEV0212 — Connect Phantom wallets](../frontend/DEV0212-connect-phantom-wallets.md)                                              | Wallet Standard connection, linking/replacement UI and mobile/desktop wallet states                                    | After DEV0211 exposes the proof contract                                  |
| Event catalogue and projections      | [DEV0213 — Persist the group-event catalogue](../backend/DEV0213-persist-group-event-catalogue.md)                               | Coach-owned metadata, immutable location snapshots, pool binding and authoritative finalized projections               | After DEV0210; may proceed alongside DEV0211 and DEV0214                  |
| On-chain threshold escrow            | [DEV0214 — Implement the threshold-funding program](../blockchain/DEV0214-implement-threshold-funding-program.md)                | Anchor program, PDA vaults, one-way lifecycle, payout/refund liabilities, generated client and local adversarial proof | After DEV0210 freezes the asset, state machine and refund contract        |
| Sponsored Devnet transactions        | [DEV0215 — Integrate sponsored Devnet funding](../blockchain/DEV0215-integrate-sponsored-devnet-funding.md)                      | Server-side fee sponsorship, prepare/review/sign/submit/recover flow and finalized projection ingestion                | After DEV0211, DEV0213 and DEV0214 contracts are stable                   |
| Public and coach event interface     | [DEV0216 — Present the group-event marketplace](../frontend/DEV0216-present-group-event-marketplace.md)                          | Events navigation, coach creation/management, discovery/detail/funding/refund UX and honest failure states             | After DEV0212 and DEV0213; implement transaction controls against DEV0215 |
| Integrated hackathon proof           | [DEV0217 — Rehearse the hackathon event loop](../backend/DEV0217-rehearse-hackathon-event-loop.md)                               | Reproducible local, Devnet and Vercel-oriented rehearsal evidence for success and failure paths                        | Last, after DEV0211–DEV0216 meet their acceptance criteria                |

All required implementation parts have direct development tickets. No direct ticket is a child of another development ticket.

## Other relationships

- Completed [DEV0120](../../archive/backend/DEV0120-persist-group-event-catalogue-and-projections.md) and [DEV0121](../../archive/blockchain/DEV0121-implement-group-event-funding-program.md) are historical implementation baselines. New tickets may reuse reviewed concepts or recover code from Git history, but the archived records remain unchanged and do not define this branch.
- Cancelled [DEV0122](../../archive/blockchain/DEV0122-integrate-devnet-group-event-funding.md), [DEV0123](../../archive/frontend/DEV0123-present-group-event-creation-and-funding.md) and [DEV0125](../../archive/backend/DEV0125-rehearse-hosted-marketplace-loops.md) document incomplete historical integration evidence. Their unmet criteria must be re-proved by the new tickets rather than treated as delivered.
- Completed [DEV0132](../../archive/blockchain/DEV0132-make-coach-pass-operations-platform-funded.md) is a historical fee-payer separation baseline; this coordination does not revive coach passes.
- Current public and authenticated redesign records remain independent work. This coordination must integrate with their delivered route and shell contracts without claiming ownership of those redesigns.

## Delivery sequence and completion conditions

1. Review and complete DEV0210 before any runtime edit so the hackathon specification expressly supersedes the scheduling-only exclusions on this branch.
2. Build wallet ownership, event persistence and the local program as parallel peers once their shared contract is frozen.
3. Integrate the browser wallet with the ownership proof, then integrate the program with the database and server-only sponsor.
4. Add the event-facing interface only against stable actor, projection and transaction-operation contracts.
5. Run DEV0217 last. It must prove one successful threshold/payout path and one failed threshold/refund path with separate coach, participant and sponsor identities.

COR0019 completes only when DEV0210–DEV0217 are Completed or explicitly Cancelled/replaced, reciprocal work-map links are correct, the branch specification and README describe the delivered scope, and the integrated application passes the development-ticket checks plus the real Devnet rehearsal. Local simulation alone is insufficient for the final coordination result. Mainnet deployment is not a completion condition.

## Progress and integration record

- 2026-10-12: Created on branch `hackathon/solana-group-events` from schedule-app commit `e14966c`. No blockchain runtime or transaction was added by this planning change.
- 2026-10-12: Confirmed the branch intent: Phantom support, coach-created threshold-funded group events, participant refunds when the threshold fails and a distinct platform fee sponsor.
- 2026-10-12: The user directed the branch to reuse previously clarified historical decisions. DEV0210 therefore adopts official Devnet EURC, deadline-only deterministic settlement, participant-signed independent refunds, bound-pool immutability and the previously tested numeric limits rather than reopening those questions.
- 2026-10-12: DEV0210 completed the branch contract and made DEV0211, DEV0213 and DEV0214 Ready. No application, database or program runtime was restored by that documentation ticket.

## Validation results

The 2026-10-12 DEV0210 contract pass checked 261 local links across the 12 changed Markdown files, 167 unique DEV/COR record IDs, reciprocal DEV0210–DEV0217 membership, ticket-index statuses, the seven historical recovery commits and the `hackathon/solana-group-events` branch base. Formatting and `git diff --check` passed. Application, database, Solana and browser tests remain owned by the implementation tickets and did not apply to this documentation-only contract slice.

## Risks, limitations, and follow-ups

- A blockchain cannot execute automatically at a wall-clock deadline. The adopted contract permits any caller to submit deterministic settlement and uses participant-signed independent refunds; DEV0215 must make those actions reliably sponsored and recoverable without implying an automatic chain scheduler.
- Fee sponsorship spends the platform's SOL. DEV0215 must add authenticated intent validation, transaction allowlisting, rate limits, bounded rent/fee policy and operational monitoring before exposing the sponsor.
- Holding participant tokens creates security and product risk even on Devnet. DEV0214 requires explicit lifecycle invariants, liability accounting, adversarial tests and a documented upgrade-authority policy.
- The hackathon branch remains Devnet-only until separately reviewed. No ticket in this coordination authorizes mainnet, real-value assets or production custody.

## Completion and review references

- Completed: Not completed.
- Direct development tickets: DEV0210 is Completed; DEV0211, DEV0213 and DEV0214 are Ready; DEV0212, DEV0215, DEV0216 and DEV0217 are Draft pending their recorded dependencies.
- Commit: Not applicable — coordination-record IDs are not used in commit subjects.
- Review: No commit or pull request created.
- Deployment or release: Not deployed.
