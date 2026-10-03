# Ticket DEV0101: Retire the multi-gym membership runtime

- Status: Completed
- Created: 2026-10-02
- Last updated: 2026-10-03
- Milestone: Coach-first legacy runtime cleanup
- Coordination: [COR0009 — Coach-first private-class booking MVP](../../current/organisatory/COR0009-coach-first-training-package-mvp.md)
- Related records: depends on the coach-first contract adoption portion of [DEV0094](../organisatory/DEV0094-adopt-coach-first-training-package-mvp.md) and must preserve payment-boundary evidence for [DEV0098](../../current/blockchain/DEV0098-purchase-training-packages-with-devnet-usdc.md); DEV0095/DEV0096 provide later replacement presentation and discovery; preserves completed COR0007/COR0008 history and the partial evidence of DEV0081/DEV0082/DEV0089/DEV0092

## Objective and context

Remove the superseded multi-gym membership runtime after the coach-first contract is adopted. The repository currently exposes four-gym plan selection, Basic/Classic activation, membership-pool payment, class reservations, member arrival/check-in, gym usage state and an experimental wallet-visible membership-card rehearsal. Those capabilities no longer belong to the coach-first product and should not remain reachable or maintained as a second live product.

This is a dedicated cleanup ticket because DEV0095 owns public copy/navigation only, while DEV0096–DEV0100 own new coach capabilities. Mixing broad legacy deletion into those feature tickets would obscure ownership, risk deleting reusable wallet/payment infrastructure and make the pivot difficult to review.

## Scope and non-goals

- In scope: inventory and remove inactive multi-gym membership routes and API handlers; remove membership navigation and replace old member URLs with an explicit safe unavailable/not-found behavior until coach-first replacements ship; remove unreferenced membership setup/activation/draft, reservation, class-schedule, arrival/check-in and wallet-card rehearsal feature modules; remove their server services, repositories, domain contracts, scripts and tests when no longer consumed; retire EURC membership-pool-specific Solana construction/verification; remove product-only environment variables and dependencies after confirming no coach-first consumer; and prove that no current UI or API can create or mutate a multi-gym membership.
- In scope with an explicit preserve-first rule: extract and retain genuinely generic Wallet Standard, RPC, transaction-simulation, bounded fee-sponsorship and recovery utilities needed by DEV0097–DEV0099 before deleting membership-specific wrappers.
- Out of scope: deleting or rewriting historical migrations, archived tickets, transaction evidence or completed test records; dropping hosted database tables with live/historical data; implementing coach profiles, offers, package purchase, redemption or social behavior; changing generic email identity/personal-wallet security; and deleting user work before its owning ticket records and preserves the evidence.

## Expected behavior and edge cases

After completion, visitors and authenticated users cannot reach the old membership setup, My Membership, Basic/Classic activation, reservation, arrival/check-in or membership-card rehearsal flows. Old bookmarked URLs resolve predictably without exposing a half-working mutation path. No old `/api/membership/**` endpoint accepts or mutates state.

Removing the runtime must not erase historical database rows, migrations, Devnet signatures or archived implementation evidence. Existing schema may remain dormant until a separately reviewed data-retention/drop ticket decides its fate. Generic wallet connection, personal-wallet linking, configured RPC access and reviewed fee-sponsor primitives remain available for the coach-package flow, but names and contracts tied specifically to membership-pool EURC must not masquerade as reusable abstractions.

If an old module is still consumed by DEV0097–DEV0099, this ticket records the dependency and extracts a narrowly named generic primitive before deletion. It must not copy the same logic into parallel old/new implementations. The uncommitted DEV0092 membership-card work visible when this ticket was drafted must first be reconciled by DEV0094 and its implementation record; this ticket does not overwrite it.

## Assumptions, decisions, and dependencies

- DEV0094 must make the coach-first specification authoritative before runtime deletion begins. Its detailed superseded-record reconciliation may finish alongside this cleanup because the user explicitly prioritized removal first.
- DEV0095/DEV0096 provide the later full public story and coach discovery. Until then, removed private/member routes may resolve to a truthful unavailable/not-found state rather than preserving obsolete behavior.
- DEV0098 decides which payment/sponsor/recovery primitives are generic enough to retain. Membership-pool recipient, EURC amount/plan logic and four-gym activation state are not generic.
- Additive migration history is preserved. A later database-retention ticket may archive or drop dormant tables only after hosted data and rollback requirements are reviewed.
- The primary area is backend because API, service and persistence retirement is the central boundary; frontend and blockchain file removals are part of this one cross-cutting cleanup rather than duplicate tickets.

## Implementation plan

1. Build a route/import/config/test inventory for the multi-gym membership, reservation/check-in and membership-card families; classify each item as remove, temporarily retain, or extract as a generic coach-first dependency.
2. Update the ticket before deletion with the exact retained generic contracts and their consumers in DEV0097–DEV0099.
3. Remove legacy navigation, UI routes and `/api/membership/**` mutations; use truthful unavailable/not-found behavior until DEV0095/DEV0096 replace the public experience.
4. Remove unused domain/features/services/repositories/Solana wrappers, scripts, tests, dependencies and environment variables; preserve migrations and historical evidence.
5. Run import/dead-route/config searches, relevant unit/static/build/browser validation and negative HTTP checks proving legacy mutations are unavailable.

## Acceptance criteria

- [x] AC1: No current navigation or reachable product screen exposes four-gym selection, Basic/Classic activation, multi-gym reservation/check-in or membership-card rehearsal behavior.
- [x] AC2: Superseded membership API endpoints cannot read or mutate private membership state and return an intentional safe response or no longer exist.
- [x] AC3: Membership-specific client, server, domain, Solana, script and test code has been removed unless an exact temporary retention reason and owner are recorded.
- [x] AC4: Reused wallet/RPC/simulation/sponsorship/recovery behavior is extracted under truthful generic contracts, remains covered by tests and contains no EURC pool, four-gym or Basic/Classic authority.
- [x] AC5: Historical migrations, archived tickets, transaction references and reconciled DEV0092 evidence remain intact; no destructive hosted-data change occurs.
- [x] AC6: Link/import/config searches, unit/static/build checks and focused legacy-route browser/HTTP checks pass.

## Validation plan

Before and after removal, use `rg` and import-graph/build failures to inventory every membership/reservation/check-in/card reference. Exercise old public and authenticated URLs plus every former membership API family and confirm intentional redirects/not-found responses with no mutations. Run relevant unit tests for retained generic Solana/wallet helpers, lint, typecheck, production build and focused browser checks. Database migration tests are required only if an additive compatibility migration is introduced; dropping historical tables is not authorized here.

## Implementation record

Implementation started after the user explicitly selected cleanup as the first pivot step. The first attempt stopped after planning; on 2026-10-03 the user asked to run the cleanup again. Inventory and contract adoption precede deletion; existing membership-card work is recorded before removal rather than overwritten silently.

### Changes and rationale

The removal inventory is now fixed before deletion:

- Remove the old member routes (`/membership/setup`, `/my-access`) and the unlinked Devnet membership-card rehearsal route, plus all `/api/membership/**`, `/api/membership-card/**` and membership-specific staff check-in handlers.
- Remove membership draft/activation/reservation/check-in/card domain, feature, service, repository, Solana, program, fixture, script, asset and test families.
- Remove the gym-operator sign-in and club-wallet runtime because the coach-first contract uses a coach's linked personal wallet rather than a separate gym wallet. Historical organization/wallet schema and migrations remain untouched.
- Remove obsolete package scripts, browser expectations, boundary assertions, CSS imports and the QR-code dependency after their last consumer disappears.
- Preserve the additive Supabase migration history, SQL migration tests and archived tickets. Remove the legacy public gym catalogue, Explore/Search/How-it-works screens and fixture adapters as part of the same runtime retirement; use a truthful coach-first early-access home until DEV0095/DEV0096 deliver the full public story and coach directory.
- Retain the generic Wallet Standard client, personal-wallet proof lifecycle, RPC failure diagnostics and Solana Kit/token dependencies needed by DEV0097–DEV0099. Extract the bounded fee-sponsor keypair parser/configuration from membership naming to generic `fee-sponsor` contracts with focused tests. Do not retain the EURC pool recipient, Basic/Classic quote, payment memo/reference, transaction builder, reconciliation or membership-card program.

### Affected files

Removed route families include `/membership/setup`, `/my-access`, `/membership-card/**`, `/clubs/sign-in`, `/explore`, `/search`, `/how-it-works`, `/users/[id]`, `/api/membership/**`, `/api/membership-card/**`, `/api/staff/check-ins/**` and `/api/wallet/club/**`. Their membership, reservation, check-in, club-wallet, public catalogue, discovery and preview modules were removed from `src/{app,components,domain,features,server,solana}` together with the `programs/movx-membership-card` prototype, associated scripts/assets and focused tests. `src/solana/fee-sponsor.ts` and `src/server/solana/fee-sponsor-config.ts` now preserve only the generic server-side sponsor parser/configuration with `tests/fee-sponsor.test.ts`. `src/components/shell.tsx`, `src/app/page.tsx`, `src/features/waitlist/coming-soon.tsx` and `src/features/profile/profile.tsx` provide the truthful transitional coach-first surface.

### Decisions and deviations

- 2026-10-02: Cleanup was separated from DEV0095 because public positioning and broad runtime retirement have different dependencies and validation risks.
- 2026-10-02: Historical migrations and data are preserve-only in this ticket; runtime removal does not authorize destructive schema cleanup.
- 2026-10-02: The user chose legacy removal before replacement features. DEV0094 still adopts the coach-first contract first, but DEV0101 no longer waits for DEV0095/DEV0096; obsolete member routes may become intentionally unavailable during the transition.
- 2026-10-03: The existing club-wallet authority was classified as gym-specific rather than generic wallet infrastructure. Coach authority will use the retained personal-wallet proof boundary; the club API/UI/service is removed while its migrations remain historical.
- 2026-10-03: The fee-sponsor keypair parser is the only membership payment helper extracted now. The exact EURC membership quote, token-account preparation, payment reference, verification and recovery pipeline encodes the superseded pool contract and is removed; DEV0098 will implement USDC package purchase against on-chain Offer terms.
- 2026-10-03: Review showed the old public catalogue and discovery screens were also a reachable second product, so the cleanup expanded within the ticket's retirement objective to remove them. DEV0095/DEV0096 now start from a truthful early-access state rather than a legacy gym preview.
- 2026-10-03: Archived implementation records still referenced source files removed by this cleanup. Their claims and exact repository-relative paths were preserved as inline historical paths, while work-record links were retargeted to their archive/current locations, so documentation navigation contains no dead local links.

### Contracts, configuration, and operations

The membership-pool, EURC and membership-card environment contracts were removed from the checked-in example and runtime consumers. The generic fee sponsor continues to use the existing server-only `SOLANA_FEE_SPONSOR_KEYPAIR_BASE64` secret contract; no secret value is stored in the repository. Package scripts for membership/card/club rehearsals and the unused QR dependency were removed. No migration, hosted table or on-chain account was deleted.

## Validation results

- `npm test` — passed, 41/41 unit and boundary tests after removing obsolete suites and adding negative legacy-path assertions.
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run format:check` — passed.
- `npm run build` — passed; the emitted application routes contain only Home, Coming Soon, Sign in, Profile, authentication APIs and personal-wallet APIs.
- `npx playwright test tests/browser/authorization.spec.ts tests/browser/waitlist.spec.ts tests/browser/profile.spec.ts` — passed, 8/8 across desktop and mobile. The suite confirms retired membership, card, club-wallet, Explore, Search, How-it-works and public-user routes/API mutations return 404 and the transitional coach-first waitlist/profile flows remain usable.
- Repository-local Markdown link check — passed across 125 Markdown files with zero missing local targets. Work-record lifecycle/index validation found 103 unique records, 103 matching index rows and zero path/status errors.

| Criterion | Evidence                                                                                                     | Result |
| --------- | ------------------------------------------------------------------------------------------------------------ | ------ |
| AC1–AC2   | Production route manifest plus desktop/mobile negative-route tests                                           | Passed |
| AC3       | Source/package inventory and successful lint/typecheck/build after removal                                   | Passed |
| AC4       | Generic `fee-sponsor` extraction and focused unit/boundary coverage                                          | Passed |
| AC5       | Supabase migrations, archived records and cited Devnet evidence retained; no database/deployment command run | Passed |
| AC6       | Unit, static, production-build, formatting and focused browser commands above                                | Passed |

## Risks, limitations, and follow-ups

Dormant multi-gym tables and historical seed/migration definitions remain intentionally. Removing hosted data would be destructive and needs a separately reviewed retention/migration ticket after the coach schema is designed. Shared styles still contain some unused legacy selectors; DEV0095 owns the visual-system rewrite and can prune them with its replacement UI. DEV0097/DEV0098 must implement and validate the new Offer/TrainingPass and test-USDC transaction contracts rather than assuming the retired EURC membership path is reusable.

## Completion and review references

- Completed: 2026-10-03.
- Commit: This commit — `[DEV0093][DEV0094][DEV0095][DEV0101][DEV0103] Adopt coach-first pivot`.
- Review: Self-reviewed against AC1–AC6; no independent review.
- Deployment or release: None.
