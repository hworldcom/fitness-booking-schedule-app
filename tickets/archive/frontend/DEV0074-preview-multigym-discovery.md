# Ticket DEV0074: Preview multi-gym discovery

- Status: Completed
- Created: 2026-09-25
- Last updated: 2026-09-26
- Milestone: M1 frontend membership discovery preview
- Coordination: [COR0007 — Core multi-gym membership MVP](../organisatory/COR0007-core-multigym-membership-mvp.md)
- Related records: depends on completed [DEV0072](DEV0072-remove-legacy-product-ui.md); complements completed public story [DEV0073](DEV0073-rewrite-multigym-public-story.md); supplies discovery contracts to completed [DEV0075](DEV0075-preview-membership-selection.md); future persistence is coordinated by [COR0006](../organisatory/COR0006-persistent-access-catalogue.md)

## Objective and context

Replace the interim gym-only Explore state with a clear frontend preview of the participating multi-gym network and the two membership plans. Use typed fictional fixtures and an explicit preview adapter so the interface can be reviewed before the persistent catalogue schema is redesigned.

This ticket owns discovery presentation and frontend read contracts, not catalogue authority. Future COR0006 services will replace the preview adapter without redesigning the screen or treating fixtures as live data.

## Scope and non-goals

- In scope: versioned frontend plan-summary contract; gym-summary/detail contract; Basic €80/ten and Classic €150/unlimited cards; seven clearly fictional participating gym fixtures; plan/gym eligibility labels; gym list/detail presentation; useful location/activity filtering; loading/empty/error-ready component states; explicit preview labeling; responsive/keyboard behavior; focused tests; and real Berlin public-landmark map anchors with coordinates for later Google Maps use.
- Out of scope: selecting the four core gyms, activating or owning a membership, class/pass/event inventory, real availability, payment, database/API calls, authorized catalogue editing, real gym names/logos/venue addresses/prices, check-ins, allocation and deployment.

## Expected behavior and edge cases

Guests can compare both plans and browse seven fictional gyms. Every gym identifies supported activities, its Berlin area, whether it participates in Basic/Classic and whether the illustrative €15 non-core member price is supported. Plan copy consistently explains the daily rule and never represents Classic with a fabricated large allowance.

Each fixture uses a real public cultural address only as an explicitly labelled map anchor. The interface must not represent that address as the fictional gym's premises or imply a partnership with the institution at that address. Northside Combat and the fictional MMA/grappling and kickboxing gyms use three Kreuzberg anchors whose greatest pairwise straight-line distance is approximately 0.86 km.

Filters operate deterministically on the injected preview data. Empty results are recoverable. Missing or malformed preview data produces an honest error/empty state rather than silently inventing a venue. No control offers buying, joining, activating or owning a membership; the available next action leads to Coming Soon and its waitlist until DEV0075 supplies the preview-only membership setup.

## Assumptions, decisions, and dependencies

- All gym identities and content are fictional; do not reuse the actual gyms previously researched or the current `Kru Tiger` name.
- The user requested seven gyms: the existing combat, strength and yoga concepts plus fictional MMA/grappling, kickboxing, massage/wellness and music-and-light boutique concepts. All business identities, descriptions and eligibility data are original fictional composites with no external fitness-business attribution.
- Public map anchors are non-gym locations and must be labelled `Illustrative map anchor — not the gym's address`. The three combat fixtures use Blücherplatz 1, Lindenstraße 9–14 and Alte Jakobstraße 124–128; calculated pairwise distances are approximately 0.67 km, 0.86 km and 0.24 km. Other anchors remain in Berlin and use public museum or cultural-institution addresses.
- Preview fixtures live behind a typed adapter and are not authorization, inventory, payment or partnership evidence.
- Completed DEV0072 removed the class/event Explore implementation, and completed DEV0073 established the public terminology and current €15 non-core member price.
- COR0006 will later own additive persistent gym/plan data and safe public services; integration needs a separate direct DEV ticket.

## Implementation plan

1. Define minimal plan/gym public read contracts that express current product terms without copying database row shapes.
2. Add seven fictional gyms and two versioned plan summaries through an explicit preview adapter, including labelled public map anchors and coordinates.
3. Build plan comparison, gym discovery/detail and bounded filters with loading/empty/error-ready states.
4. Connect truthful navigation toward membership setup/Coming Soon without creating ownership.
5. Validate contract rules, filters, fictional-data policy, accessibility, responsive layouts and the standard frontend suite.

## Acceptance criteria

- [x] AC1: Explore presents exactly the current Basic €80/ten and Classic €150/unlimited demo terms, including one included check-in per day and four required core gyms.
- [x] AC2: Seven fictional gyms are discoverable with useful activity/location and plan-eligibility information; no actual gym identity or partnership claim appears.
- [x] AC2a: Every address is labelled as a non-venue public map anchor, and Northside Combat plus the MMA/grappling and kickboxing fixtures use coordinates no more than 1 km apart pairwise.
- [x] AC3: Discovery contracts and preview adapters are distinct from database rows and financial/access authority; no interaction creates membership, payment, reservation or attendance state.
- [x] AC4: Filters, empty results, malformed/missing data and navigation have honest, accessible behavior at mobile and desktop widths.
- [x] AC5: Domain/fixture tests, content assertions, lint, typecheck, format, a production build and focused keyboard/browser checks pass.

## Validation plan

Test plan invariants, unique fictional gym IDs/slugs, eligibility combinations and filter behavior without mirroring component implementation. Search fixtures for known real gym names and removed products. Exercise plan comparison, gym details, filter reset, empty/error-ready states and navigation at desktop/mobile widths with keyboard use. Run `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build` and affected `npm run test:e2e` cases.

## Implementation record

Completed a frontend-only plan and gym discovery preview over versioned, validated fixtures. No database, membership, payment or attendance state is created.

### Changes and rationale

- Replaced the three-card interim Explore view with a plan-first discovery page. Basic shows €80 and ten included check-ins; Classic shows €150 and no numerical allowance. Both show four core gyms, the one-included-check-in-per-day rule and the separate illustrative €15 non-core visit.
- Added seven fictional Berlin gym concepts: Northside Combat, Fabrik Training, Studio Vela, Groundline MMA, Kiezstrike Club, Quiet Current Recovery and Nightshift Athletic Club. Each has activity, area, plan eligibility and non-core eligibility metadata.
- Added activity, area and plan filters; recoverable empty results; guarded loading/empty/error states; keyboard-restoring gym details; and a Coming Soon/waitlist handoff that creates no membership.
- Added a clearly separated public map anchor to every gym detail. Each dialog says the anchor is not the fictional gym's address and does not imply affiliation, then offers a coordinate-based Google Maps link.
- Expanded the artwork system for MMA/grappling, recovery and evening boutique concepts while preserving the existing visual language.

### Affected files

- `src/domain/catalogue.ts` (historical path `src/domain/catalogue.ts`) defines storage-independent plan, money, access, gym, map-anchor and catalogue-result read contracts.
- `src/features/preview/catalogue.ts` (historical path `src/features/preview/catalogue.ts`) contains the two versioned plan summaries, seven fictional gym fixtures and the validating preview adapter.
- `src/domain/discovery.ts` (historical path `src/domain/discovery.ts`), `src/features/discovery/filters.ts` (historical path `src/features/discovery/filters.ts`) and `src/components/discovery-filters.tsx` (historical path `src/components/discovery-filters.tsx`) define and apply activity, area and plan filters.
- `src/features/discovery/explore.tsx` (historical path `src/features/discovery/explore.tsx`) renders plan comparison, gym cards/details, safe map-anchor links, state fallbacks and waitlist navigation. `src/app/explore/page.tsx` (historical path `src/app/explore/page.tsx`) supplies accurate page metadata.
- [`src/components/ui.tsx`](../../../src/components/ui.tsx) and [`src/app/globals.css`](../../../src/app/globals.css) provide the new artwork variants and responsive presentation.
- `tests/explore.test.ts` (historical path `tests/explore.test.ts`), `tests/discovery.test.ts` (historical path `tests/discovery.test.ts`) and `tests/browser/preview.spec.ts` (historical path `tests/browser/preview.spec.ts`) verify contracts, fixtures, distance, search, filters, dialogs, maps and desktop/mobile behavior.
- [`docs/mvp-spec.md`](../../../docs/mvp-spec.md) now records seven current preview gyms without making seven an infrastructure limit.

### Decisions and deviations

- 2026-09-25: The user chose to validate the frontend concept before redesigning the database. Preview data remains clearly non-authoritative so later persistence can replace the adapter cleanly.
- 2026-09-26: Expanded the preview target from five to seven fictional gyms. Real Berlin addresses are used only as labelled public map anchors because assigning a fictional business to an unrelated occupied address would mislead users. The two referenced fitness sites inform categories only.
- 2026-09-26: Basic eligibility is demonstrated by five gyms; Classic eligibility is demonstrated by all seven. Nightshift does not offer the non-core member price, proving that core-plan and paid-non-core eligibility are distinct frontend fields rather than inferred from one another.
- 2026-09-26: Coordinates, rather than third-party place identifiers or an API key, build the optional Google Maps search URL. Persistent location ownership and an embedded map remain COR0006 follow-up work.

### Contracts, configuration, and operations

Added frontend-only `MembershipPlanSummary`, `GymSummary`, `PublicMapAnchor`, `PublicCatalogue` and discriminated `PublicCatalogueResult` read contracts. Plan configuration carries an explicit version, prices in EUR, the access-model union, daily limit, four-gym count and non-core price. Gym fixtures carry explicit plan/non-core eligibility and public map-anchor coordinates. These are not database rows and grant no authority.

No server API, database schema, environment variable, migration, wallet transaction, external map API key or deployment changed. COR0006 must replace the fixture adapter with a safe public service rather than importing these fixtures into persistence.

## Validation results

- `npm test` — passed 49 unit/domain tests, including exact plan terms, seven unique fictional gyms, forbidden real-gym identity checks, preview-adapter rejection/empty behavior and all three combat anchors at or below 1 km pairwise.
- `npm run lint` — passed.
- `npm run typecheck` — passed after Next.js route type generation.
- `npm run format:check` — passed.
- `npm exec next build -- --webpack` — passed the production Next.js build and route generation. The default `npm run build` Turbopack attempt could not bind its internal sandbox port (`EPERM`); this was an environment restriction, not a source failure.
- `npm run build:vinext` — completed all five Workers/Vite build stages. Wrangler emitted a non-fatal sandbox warning when it could not write a user-library debug log.
- `npm run test:e2e -- tests/browser/preview.spec.ts tests/browser/redesign.spec.ts` — passed 12 desktop/mobile checks; two preview-store checks were skipped because this environment is not in browser preview-auth mode.
- Final `npm run test:e2e -- tests/browser/preview.spec.ts` after the call-to-action visual correction — passed 6 applicable desktop/mobile checks; the same two preview-auth-only checks were skipped.
- Manual screenshot review covered all seven cards, both plan cards, filters and the corrected visible waitlist action at 1440 × 1040 and 393 × 852. No horizontal overflow or clipped required control was observed.
- `git diff --check` — passed before completion review.

## Risks, limitations, and follow-ups

The public landmark addresses are map anchors, not venue locations, and may need maintenance if an institution moves. They must be replaced by authorized gym coordinates during COR0006 persistence work. The current adapter is synchronous fixture data; its loading/error shapes exist for the future service boundary but do not simulate latency. DEV0075 can now use the stable plan and gym identifiers for browser-local selection.

## Completion and review references

- Completed: 2026-09-26.
- Commit: This implementation is included with the privacy correction under subject `[DEV0074] [DEV0077] Add seven-gym discovery preview`.
- Review: Self-reviewed against every acceptance criterion, with automated contract/browser coverage and desktop/mobile screenshot inspection. No independent review was performed.
- Deployment or release: Not deployed. The earlier DEV0073/DEV0076 commit is local because the repository security gate requires explicit approval for the named remote and branch before pushing.
