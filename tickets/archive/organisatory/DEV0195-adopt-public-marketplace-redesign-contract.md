# Ticket DEV0195: Adopt the public marketplace redesign contract

- Status: Completed
- Created: 2026-10-12
- Last updated: 2026-10-12
- Milestone: Scheduling interface public-marketplace follow-up
- Coordination: [COR0017 — Public marketplace redesign](../../current/organisatory/COR0017-public-marketplace-redesign.md)
- Related records: implementation peers [DEV0196 — Introduce the public marketplace shell](../frontend/DEV0196-introduce-public-marketplace-shell.md), [DEV0197 — Share public marketplace search](../frontend/DEV0197-share-public-marketplace-search.md), [DEV0198 — Build the search-first marketplace home](../frontend/DEV0198-build-search-first-marketplace-home.md), [DEV0199 — Redesign desktop coach Explore](../frontend/DEV0199-redesign-desktop-coach-explore.md), [DEV0200 — Add mobile Explore map/list state](../../current/frontend/DEV0200-add-mobile-explore-map-list-state.md) and [DEV0201 — Polish public marketplace accessibility](../../current/frontend/DEV0201-polish-public-marketplace-accessibility.md)

## Objective and context

Adopt an authoritative product contract for the proposed search-first public marketplace before changing shared navigation or discovery interfaces. The current [MVP specification](../../../docs/mvp-spec.md#4-primary-user-flows) truthfully defines coach discovery, primary map locations and coach-confirmed requests but does not require a search-first homepage, route-specific public shell or mobile map/list view state.

The user asked to review the redesign proposal and create tickets; that authorizes planning, not silently accepting every open design choice. This ticket must distinguish adopted decisions from proposed defaults and give DEV0196-DEV0201 one testable interface contract.

## Scope and non-goals

- In scope:
  - Update the confirmed decision register, guest flow, discovery permissions, definition of done, M3 interface milestone and acceptance matrix for the adopted public information architecture.
  - Define which routes use public top navigation and which retain capability-aware workspace navigation.
  - Define homepage data sources, truthful ordering/labels, supported search fields and empty/unavailable behavior.
  - Define desktop split-map and mobile list/map behavior without changing primary-location or map-fallback semantics.
  - Record the approved defaults reviewed through the public and authenticated interface previews.
- Out of scope:
  - Runtime components, CSS, APIs, schema, map providers, analytics or booking-rule changes.
  - `When`, weekly aggregation, proximity, prices, ratings, reviews, live location and gym-marketplace behavior.

## Expected behavior and edge cases

- Public pages prioritize working discovery controls and real inventory while preserving demo disclosure and pending-request language.
- Every displayed search control has existing end-to-end semantics; absent contracts do not appear as disabled or decorative controls.
- Signed-in users retain clear routes to private destinations even though public pages no longer use the workspace sidebar.
- Public map pins remain coach-selected primary training bases, not live positions or availability guarantees.
- Database or map failure produces explicit unavailable/fallback content and never substitutes fabricated coaches, times or locations.

## Assumptions, decisions, and dependencies

- Confirmed: the redesign remains within the scheduling-only product and retains current MovX identity rather than copying another brand.
- Confirmed: no booking, confirmation, map-authority or fictional-data rule changes are part of this initiative.
- Confirmed through the reviewed redesign previews: the homepage reads real public directory data and shows a bounded alphabetical `Discover coaches` preview rather than a static link-only facade or `Near you` claim.
- Confirmed through the reviewed redesign previews: first delivery exposes only existing `q`, discipline and location semantics. It omits `When` and `Available this week` until a separate occurrence-query contract exists.
- Confirmed through the reviewed redesign previews: public mobile routes use one compact top header and no public bottom bar. Private signed-in routes retain actor-aware navigation with a persistent mobile bottom bar that remains visible while page content scrolls.
- Confirmed through the reviewed redesign previews: desktop Explore uses the complete list beside the primary-location map; mobile Explore defaults to list and uses canonical `view=list|map` state with filter/history preservation and list recovery.

## Implementation plan

1. Record the adopted public-shell routes and actor-aware navigation guarantees.
2. Specify search-first homepage ordering, server-backed preview data, supported filters and honest empty/unavailable states.
3. Specify compact Explore presentation, desktop sticky split map and URL-backed mobile view state while preserving filter and map contracts.
4. Add definition-of-done and acceptance scenarios for signed-out/signed-in navigation, search links, map failure, responsive view switching and truthful request language.
5. Reconcile COR0017 and all direct ticket boundaries, then run Markdown formatting, link and consistency checks.

## Acceptance criteria

- [x] AC1: The specification clearly distinguishes public and workspace navigation without weakening capability-aware private routes.
- [x] AC2: Homepage and Explore data/search behavior is explicit, uses only authoritative sources and excludes unsupported `When`, proximity, price, rating and review claims.
- [x] AC3: Desktop/mobile map presentation preserves primary-location meaning, filter state, list fallback and coach-confirmation language.
- [x] AC4: COR0017 and DEV0195-DEV0201 agree on decisions, ownership, sequence and acceptance scenarios without duplicating implementation scope.

## Validation plan

- Run Prettier against every changed Markdown file and `git diff --check`.
- Validate affected relative links, unique IDs, reciprocal COR0017 membership and the ticket index next-ID values.
- Use targeted text checks to confirm the decision register, guest flow, permissions, definition of done, milestone and acceptance matrix contain the adopted contract with no contradictory navigation/search language.
- Application tests are not applicable because this ticket changes only product/documentation contracts.

## Implementation record

Implementation, validation and archival completed on 2026-10-12.

### Changes and rationale

- Added C26-C28 to the confirmed decision register so public route chrome, authenticated mobile navigation, search-first Home data boundaries and responsive Explore composition are authoritative rather than inferred from concept images.
- Expanded the discovery flow, permissions, definition of done, M3 milestone and acceptance matrix with testable public/private navigation, search/data and list/map behavior.
- Reconciled COR0017 and DEV0196-DEV0201 with the adopted choices so runtime work no longer depends on unresolved proposed defaults.
- Kept the authenticated page-content redesign outside COR0017. This contract preserves and clarifies private navigation, including the persistent mobile bar, but does not authorize redesigning My sessions, Profile or Coach workspace content under public-marketplace tickets.

### Affected files

| File or component                                                                                                                                         | Change and purpose                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| [MVP specification](../../../docs/mvp-spec.md)                                                                                                            | Owns the adopted C26-C28 decisions, discovery flow, permissions, definition of done, M3 wording and acceptance scenarios. |
| [COR0017](../../current/organisatory/COR0017-public-marketplace-redesign.md)                                                                              | Records the resolved decisions, active coordination status and delivery readiness.                                        |
| [DEV0196](../frontend/DEV0196-introduce-public-marketplace-shell.md)–[DEV0201](../../current/frontend/DEV0201-polish-public-marketplace-accessibility.md) | Align dependencies and assumptions with the adopted contract; DEV0196 and DEV0197 become ready to start.                  |
| [Ticket index](../../README.md)                                                                                                                           | Reflects active coordination, completed contract work and runtime-ticket readiness.                                       |

### Decisions and deviations

- 2026-10-12: Initially recorded the three unresolved proposal choices as proposed defaults rather than confirmed user decisions.
- 2026-10-12: Adopted real bounded alphabetical directory previews; `q`/discipline/location-only search; public header-only mobile navigation; persistent private mobile bottom navigation; and responsive desktop/mobile Explore composition after the user reviewed and approved the public and authenticated previews.
- 2026-10-12: Clarified that private navigation behavior is part of this contract, while redesigning the private page bodies remains a separate future work map.

### Contracts, configuration, and operations

This ticket changes the product/interface contract but adds no runtime interface, schema, dependency, environment variable or migration. It adopts one new bounded public query parameter, `view=list|map`, for mobile Explore presentation; existing search parameters remain backward compatible.

## Validation results

- `npx prettier --check docs/mvp-spec.md tickets/current/organisatory/DEV0195-adopt-public-marketplace-redesign-contract.md tickets/current/organisatory/COR0017-public-marketplace-redesign.md tickets/current/frontend/DEV0196-introduce-public-marketplace-shell.md tickets/current/frontend/DEV0197-share-public-marketplace-search.md tickets/current/frontend/DEV0198-build-search-first-marketplace-home.md tickets/current/frontend/DEV0199-redesign-desktop-coach-explore.md tickets/current/frontend/DEV0200-add-mobile-explore-map-list-state.md tickets/current/frontend/DEV0201-polish-public-marketplace-accessibility.md` passed before archival; the final archived paths were checked again after the move.
- `git diff --check` passed before archival and was repeated against the final tree.
- A targeted Node.js Markdown-link checker resolved every relative link in the specification, index, COR0017 and DEV0195-DEV0201.
- Targeted text checks found C26-C28 plus the required Home, public/private navigation, desktop/mobile Explore, M3 and acceptance-matrix clauses.
- Application tests, type-check and production build are not applicable: DEV0195 changes documentation contracts and ticket records only, with no runtime source or dependency change.

| Criterion | Evidence                                                                                                                                                                                                                                         | Result |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| AC1       | C26, scheduling permissions, definition of done and the mobile-workspace acceptance row distinguish public top chrome from persistent actor-aware private navigation while retaining C14 Profile/account behavior.                               | Passed |
| AC2       | C27, discovery flow and Home acceptance row require the authoritative bounded alphabetical preview and normalized `q`/discipline/location search while excluding unsupported marketplace claims.                                                 | Passed |
| AC3       | C28, discovery flow and Explore acceptance rows preserve primary-location semantics, complete-list fallback, canonical list/map state, supported filters and profile-only selection behavior.                                                    | Passed |
| AC4       | COR0017 records the adopted decisions and sequence; DEV0196-DEV0201 assumptions now cite the completed contract, and DEV0196/DEV0197 are Ready while dependency-bound peers remain Draft. Relative-link and reciprocal membership checks passed. | Passed |

## Risks, limitations, and follow-ups

- Public navigation and homepage preview choices materially affect several runtime tickets, so this ticket must not be bypassed as “visual-only” planning.
- Future availability/date search requires a separate contract that defines date, range, timezone, open-state and stale-result semantics.

## Completion and review references

- Completed: 2026-10-12.
- Commit: Not committed in this turn; no commit was requested.
- Review: The user approved the public and authenticated previews that resolved the contract defaults; repository consistency review passed.
- Deployment or release: Documentation only; not deployed or released.
