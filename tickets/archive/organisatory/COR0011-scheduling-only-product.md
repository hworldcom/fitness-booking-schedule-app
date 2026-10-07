# Coordination COR0011: Scheduling-only product branch

- Status: Completed
- Created: 2026-10-07
- Last updated: 2026-10-07
- Milestone: Scheduling-only product split
- Converted from: Not applicable — created as a coordination record
- Tracked development tickets: DEV0140–DEV0143
- Related records: supersedes the branch's marketplace delivery under [COR0010 — Coach-pass and group-funded marketplace MVP](COR0010-group-funded-coach-marketplace-mvp.md); retains completed identity, coach-profile, discovery and availability foundations recorded by [COR0001 — Project structure](../../current/organisatory/COR0001-project-structure.md)

## Objective and boundaries

Coordinate a scheduling-only MovX branch from commit `52b2730`. The retained product lets guests discover coaches and open calendar times, lets email-authenticated clients book one capacity-one private session directly, and lets coaches publish availability and manage their schedule. The branch has no blockchain program, wallet connection, pass/credit purchase, token payment, group funding, event marketplace, social feed or follow/post workflow.

This record owns shared scope, sequence and integration evidence only. It does not authorize implementation or replace the detailed records in its direct development tickets. Historical migrations and archived tickets may describe removed features; they remain history and do not make those features part of the current runtime.

## Direct development work

| Implementation part                 | Development ticket                                                                                            | Owned deliverable                                                                                                                 | Start condition or dependency                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Product contract and work-map pivot | [DEV0140 — Adopt the scheduling-only contract](DEV0140-adopt-scheduling-only-contract.md)                     | Rewrite the current specification and reconcile incompatible current records before runtime changes                               | Completed; supplies the authoritative target                                                       |
| Direct scheduling persistence       | [DEV0141 — Persist direct private bookings](../backend/DEV0141-persist-direct-private-bookings.md)            | Replace credit-backed reservations with authorized capacity-one database bookings, cancellation and coach completion              | After DEV0140 freezes the scheduling behavior                                                      |
| Blockchain/runtime retirement       | [DEV0142 — Retire blockchain and non-scheduling runtime](../backend/DEV0142-retire-blockchain-runtime.md)     | Remove Solana/wallet/event/social runtime, artifacts, configuration and dependencies while preserving retained scheduling modules | After DEV0140; coordinate final dependency cleanup with DEV0141/DEV0143                            |
| Scheduling-only interface           | [DEV0143 — Present the scheduling-only experience](../frontend/DEV0143-present-scheduling-only-experience.md) | Reframe public, client and coach routes around discovery, availability, direct booking and schedule management                    | After DEV0141 exposes the direct booking contract; may remove obsolete UI in parallel with DEV0142 |

All four DEV records link directly to this coordination record. No other DEV is a direct COR0011 member.

## Other relationships

- DEV0108 retains optional Mapbox discovery validation as independent work. The scheduling list must remain usable without Mapbox, so it does not block this product split.
- DEV0138/DEV0139 remain the historical Vercel-readiness and Cloudflare-retirement baseline consumed by this branch.
- Completed identity, coach profile, recurring availability and calendar records remain historical implementation evidence. This coordination does not reopen them.
- COR0010 and its unfinished pass/group-funding peers were superseded, reconciled and archived under DEV0140.

## Delivery sequence and completion conditions

1. DEV0140 establishes the scheduling-only product contract and reconciles the ticket graph.
2. DEV0141 implements and validates direct database-backed booking transitions.
3. DEV0142 removes blockchain, wallet, event and social runtime/tooling after retained booking dependencies are explicit.
4. DEV0143 completes the public/client/coach experience against DEV0141 and removes obsolete navigation/copy.
5. Final integration runs unit/server tests, database tests when local Supabase is available, lint, type checking, formatting, native/Vercel builds and responsive browser checks for discovery, booking, cancellation and coach schedule management.

COR0011 completes only when DEV0140–DEV0143 are Completed or explicitly Cancelled/replaced, no live application or package dependency imports blockchain/wallet code, the scheduling acceptance flows pass, and this record contains the integration result.

## Progress and integration record

- 2026-10-07: The user requested a new branch containing only the scheduling system without blockchain. Branch `scheduling-only` was created from Vercel-ready commit `52b2730`.
- 2026-10-07: Scope interpretation retains email identity, coaching activation, coach profiles/locations, list-first discovery, recurring availability, dated capacity-one sessions, direct bookings, client cancellation and coach completion. Wallets, passes/credits, payments, group events and social/feed behavior are excluded so “only scheduling” has one coherent boundary.
- 2026-10-07: DEV0141 delivered actor-authorized capacity-one direct bookings, cancellation and coach completion. DEV0142 removed the chain/wallet/payment/event/social runtime, tooling and dependencies while preserving migration history. DEV0143 rebuilt the public, client and coach presentation around the retained schedule.
- 2026-10-07: Integration review found no live removed route or package import. The production route manifest contains only public/Auth/profile/coach scheduling routes; removed URLs return 404.

## Validation results

- Work-map review: DEV0140–DEV0143 completed their assigned deliverables and durable implementation records.
- Database: local migration replay and seed passed; 143 pgTAP checks, 28 database integration tests and database lint passed.
- Application: 56 unit/server tests, lint, type checking, formatting and the guarded native Vercel production build passed.
- Responsive browser: 28 Playwright scenarios passed across desktop and mobile, including scheduling story/navigation, discovery/profile, guest sign-in guidance, protected coach pages, keyboard focus and removed-route 404s.
- Dependency/security: production dependency audit reports zero vulnerabilities. Five high development-only `braces` findings remain through Next's ESLint dependency tree; the only offered automated fix is a breaking forced downgrade and was not applied.

## Risks, limitations, and follow-ups

- Existing deployed databases may contain historical wallet, credit and event tables. This branch will stop using them but will not destroy provider data automatically; destructive cleanup needs a separately reviewed migration/operation.
- Existing hosted databases still require the additive scheduling-only migration before this branch can accept direct bookings.
- No hosted Vercel/Supabase rehearsal or deployment was performed. Local integration validates the contract; release rehearsal remains a separate operational step and the specification's M4 milestone.
- Historical migrations/tickets still contain removed terms and unused tables by design. Destructive provider cleanup requires a separate reviewed operation.

## Completion and review references

- Completed: 2026-10-07.
- Direct development tickets: DEV0140–DEV0143 completed and archived.
- Commit: Not applicable — coordination-record IDs are not used in commit subjects.
- Review: Work-map, runtime boundary and integration evidence self-reviewed; no independent review or pull request created.
- Deployment or release: Not deployed.
