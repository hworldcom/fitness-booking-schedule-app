# Coordination COR0010: Coach-pass and group-funded marketplace MVP

- Status: In progress
- Created: 2026-10-04
- Last updated: 2026-10-04
- Milestone: Coach-pass and group-funded marketplace MVP
- Converted from: Not applicable — created as a coordination record
- Tracked development tickets: DEV0108, DEV0118–DEV0131
- Related records: group-funding-only contract previously adopted by [DEV0117](../../archive/organisatory/DEV0117-adopt-group-funded-coach-marketplace-mvp.md) and expanded by [DEV0126](../../archive/organisatory/DEV0126-adopt-coach-pass-and-group-funding-contract.md); replaces cancelled [COR0009](../../archive/organisatory/COR0009-coach-first-training-package-mvp.md) without reopening it; consumes the identity, coach, availability, social and staging foundations listed below

## Objective and boundaries

Coordinate two complementary hackathon loops. The primary loop lets clients buy one-session or ten-session coach credits with Devnet test USDC, reserve a calendar session and receive the coach's published early/late cancellation outcome. The second loop lets coaches create public group events whose participants conditionally fund seats, after which the reviewed program pays a successful pool or permits individual refunds from a failed pool. This record owns sequencing and cross-ticket integration only; it does not authorize or implement runtime behavior.

Profiles, locations, calendars, bookings, cancellation requests, requests, proposals, event media and social state remain application data. `CoachAuthority`, immutable offers, per-coach-client credit ledgers, EventPool, Contribution, vault, exact value movement and funding outcome are authoritative on Solana. Coach no-show, service disputes, hidden commercial terms and real-value production escrow are outside this coordination boundary.

## Direct development work

| Implementation part          | Development ticket                                                                                                                             | Owned deliverable                                                                                | Start condition or dependency                                                             |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Mapbox Explore completion    | [DEV0108 — Add the Mapbox coach Explore map](../frontend/DEV0108-add-mapbox-coach-explore-map.md)                                              | Finish operational/provider validation for list-first coach discovery and location selection     | Already in progress; independent of funding work                                          |
| Request/proposal persistence | [DEV0118 — Persist training requests and coach proposals](../backend/DEV0118-persist-training-requests-and-coach-proposals.md)                 | Authorized request/proposal schema, services, projections and lifecycle                          | May start from completed identity/coach foundations                                       |
| Request/proposal interface   | [DEV0119 — Present training requests and coach proposals](../frontend/DEV0119-present-training-requests-and-coach-proposals.md)                | Accessible client and coach marketplace workflow through proposal selection                      | After DEV0118 contracts stabilize                                                         |
| Group-event catalogue        | [DEV0120 — Persist group-event catalogue and projections](../backend/DEV0120-persist-group-event-catalogue-and-projections.md)                 | Coach-owned off-chain event metadata plus chain-address/index projection boundary                | May start independently; consumes coach/location contracts                                |
| Local EventPool program      | [DEV0121 — Implement the group-event funding program](../blockchain/DEV0121-implement-group-event-funding-program.md)                          | EventPool/Contribution/vault instructions, generated client and adversarial Surfpool lifecycle   | May start after DEV0117 contract adoption; review DEV0097 only as historical partial work |
| Devnet funding integration   | [DEV0122 — Integrate Devnet group-event funding](../blockchain/DEV0122-integrate-devnet-group-event-funding.md)                                | Simulation, wallet/sponsor transactions, operation recovery, finalized verification and indexing | After DEV0121 account/instruction contracts and DEV0120 projection key settle             |
| Group-event interface        | [DEV0123 — Present group-event creation and funding](../frontend/DEV0123-present-group-event-creation-and-funding.md)                          | Responsive coach creation and client funding/outcome/payout/refund experiences                   | After DEV0120 and DEV0122 provide stable interfaces                                       |
| Public product story         | [DEV0124 — Present the coach-pass and group-funded story](../frontend/DEV0124-present-coach-pass-and-group-funded-story.md)                    | Home, How it works and navigation aligned with passes first and group funding second             | May start from the adopted specification; final copy checks against DEV0123               |
| Hosted integrated proof      | [DEV0125 — Rehearse the hosted marketplace loops](../backend/DEV0125-rehearse-hosted-marketplace-loops.md)                                     | Staging/Devnet proof for pass booking plus successful-pool payout and failed-pool refund         | After every runtime peer completes and COR0004 staging prerequisites are ready            |
| Product-contract revision    | [DEV0126 — Adopt the coach-pass and group-funding contract](../../archive/organisatory/DEV0126-adopt-coach-pass-and-group-funding-contract.md) | Current specification, navigation and work map for both hackathon loops                          | Completed; supplies the shared contract                                                   |
| Local coach-credit ledger    | [DEV0127 — Implement the coach-client credit ledger](../../archive/blockchain/DEV0127-implement-coach-client-credit-ledger.md)                 | Atomic one/ten-credit test-USDC purchases and one bounded PDA per coach-client pair              | Completed after DEV0126; supplies the aggregate ledger extended by DEV0131                |
| Booking-credit lifecycle     | [DEV0131 — Implement the coach-credit booking lifecycle](../../archive/blockchain/DEV0131-implement-coach-credit-booking-lifecycle.md)         | Deterministic booking receipt plus atomic reserve, consume and return transitions                | Completed after DEV0127; stable generated contract now unblocks DEV0128/DEV0130           |
| Credit-backed bookings       | [DEV0128 — Persist credit-backed private bookings](../backend/DEV0128-persist-credit-backed-private-bookings.md)                               | Capacity-one bookings, cancellation policy, credit lifecycle and coach client projections        | After DEV0131 freezes and validates its generated account/instruction contract            |
| Pass and client-card UI      | [DEV0129 — Present coach passes, bookings and client cards](../frontend/DEV0129-present-coach-passes-bookings-and-client-cards.md)             | Purchase, booking/cancellation and authorized coach client-card experience                       | After DEV0128/DEV0130 interfaces stabilize                                                |
| Devnet pass integration      | [DEV0130 — Integrate Devnet coach-pass operations](../blockchain/DEV0130-integrate-devnet-coach-pass-operations.md)                            | Deploy, prepare, simulate, recover, verify and index purchases plus booking-credit transitions   | After DEV0131; also consumes DEV0047 and hosted/RPC foundations                           |

Every direct ticket links back to COR0010. Completed foundation tickets below are dependencies or historical baselines, not direct members.

## Other relationships

- [DEV0047](../backend/DEV0047-personal-wallet-linking-and-replacement.md) supplies personal-wallet proof and remains directly coordinated by COR0003.
- [DEV0055](../backend/DEV0055-hosted-supabase-staging-environment.md), [DEV0056](../backend/DEV0056-staging-release-and-domain-rehearsal.md) and [COR0004](COR0004-hosted-staging-deployment.md) own the hosted platform, not the marketplace runtime.
- Completed [DEV0096](../../archive/backend/DEV0096-persist-coach-profiles-and-discovery.md), [DEV0104](../../archive/backend/DEV0104-publish-weekly-coach-availability.md), [DEV0100](../../archive/backend/DEV0100-coach-follows-and-chronological-posts.md), [DEV0114](../../archive/backend/DEV0114-persist-recurring-coach-availability.md), [DEV0115](../../archive/frontend/DEV0115-add-coach-schedule-calendar.md) and [DEV0116](../../archive/backend/DEV0116-provision-local-seeded-coach-accounts.md) supply coach identity/discovery, availability/calendar, social behavior and local seeded accounts.
- Cancelled DEV0097 preserves committed `CoachAuthority`/`Offer` implementation history. Completed DEV0127 extends that source under the current contract; DEV0121 may still review generic patterns but does not own pass behavior.
- Cancelled DEV0098, DEV0099, DEV0105 and DEV0106 remain historical plans. DEV0127–DEV0131 are new implementation records and do not silently relabel their unfinished evidence.

## Delivery sequence and completion conditions

DEV0126 freezes the shared contract, and DEV0127 supplies the completed aggregate purchase ledger. DEV0131 extends that ledger with local booking-credit receipts and transitions. DEV0108, DEV0118, DEV0120, DEV0121 and DEV0124 can otherwise proceed independently. DEV0119 follows the request/proposal service contract. DEV0122 follows both the local group-funding program and event projection key. DEV0123 follows the event catalogue plus Devnet integration. DEV0128 and DEV0130 both follow DEV0131 and may then proceed in parallel; DEV0129 follows their stable booking and Devnet adapters. DEV0125 must be revised before rehearsal so it proves both the primary pass/booking loop and the secondary group-funding loop.

Complete COR0010 only when each direct ticket is Completed or explicitly Cancelled/replaced, the current specification's definition of done and acceptance matrix pass, and DEV0125 records a repeatable hosted rehearsal with: an exact one/ten-credit purchase, one calendar booking, both cancellation-policy branches, one coach client card, one coach EventPool, a successful threshold/payout, a failed pool/refund, reload-consistent application views and public Explorer evidence.

## Progress and integration record

- 2026-10-04: The user adopted group funding instead of coach/gym splitting as the primary hackathon blockchain justification and explicitly deferred coach no-show details. DEV0117 replaced the authoritative private-pass target while preserving completed work and partial program history.
- 2026-10-04: DEV0108 moved from the cancelled private-pass coordination record because list-first coach/location discovery remains part of the group-event marketplace.
- 2026-10-04: The user restored simple one/ten-credit calendar booking as the first feature and kept group funding as the second. DEV0126–DEV0131 now own the new pass contract and implementation rather than reopening cancelled records.
- 2026-10-04: DEV0126 completed the reconciled product contract. DEV0127 then completed the pair-ledger source, exact token-transfer constraints, IDL/generated client and adversarial embedded-Surfpool lifecycle. The platform-tools syscall-table warning remains visible but did not prevent the built SBF program from executing its PDA, event CPI and legacy SPL Token CPI paths locally.
- 2026-10-04: DEV0131 was added after review showed that aggregate available/reserved counters alone could not bind a terminal result to one booking. It owns a bounded reservation receipt and local reserve/consume/return transitions before DEV0128 or DEV0130 starts.
- 2026-10-04: DEV0131 completed the fixed-size booking receipt, checked reserve/return/consume instructions, generated client and adversarial compiled-SBF Surfpool lifecycle. DEV0128 and DEV0130 are no longer blocked by the local chain contract and may proceed independently.

## Validation results

DEV0117 records initial specification/work-map/link consistency validation, and DEV0126 records the later pass-first contract revision. DEV0127 records passing source/unit/IDL/build checks plus successful and adversarial local-runtime purchase transactions. DEV0131 records passing Rust/static/generated-client/build checks plus successful and adversarial multi-booking reserve/return/consume transactions against the compiled SBF program in embedded Surfpool. Database, browser, Devnet and hosted evidence remain owned by the remaining direct development tickets.

## Risks, limitations, and follow-ups

The main risks are coupling scheduling to value movement without idempotency, putting an unbounded client map in one coach account, confusing off-chain projections with chain balances, leaving USDC in a vault after ambiguous operations and trying to refund every event participant in one transaction. Pair PDAs, monotonic operations, deterministic settlement and pull refunds keep those boundaries explicit. Production consumer protection, legal/compliance review and audit are follow-ups, not hidden completion criteria.

## Completion and review references

- Completed: Not completed.
- Direct development tickets: DEV0126, DEV0127 and DEV0131 completed; DEV0108, DEV0118–DEV0125 and DEV0128–DEV0130 remain open.
- Commit: Not applicable — coordination-record IDs are not used in commit subjects.
- Review: Planning self-review only; no independent review.
- Deployment or release: None.
