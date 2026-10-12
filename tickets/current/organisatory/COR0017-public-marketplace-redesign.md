# Coordination COR0017: Public marketplace redesign

- Status: In progress
- Created: 2026-10-12
- Last updated: 2026-10-12
- Milestone: Scheduling interface public-marketplace follow-up
- Converted from: Not applicable — created as a coordination record
- Tracked development tickets: completed [DEV0195 — Adopt the public marketplace redesign contract](../../archive/organisatory/DEV0195-adopt-public-marketplace-redesign-contract.md), completed [DEV0196 — Introduce the public marketplace shell](../../archive/frontend/DEV0196-introduce-public-marketplace-shell.md), completed [DEV0197 — Share public marketplace search](../../archive/frontend/DEV0197-share-public-marketplace-search.md), completed [DEV0198 — Build the search-first marketplace home](../../archive/frontend/DEV0198-build-search-first-marketplace-home.md), completed [DEV0199 — Redesign desktop coach Explore](../../archive/frontend/DEV0199-redesign-desktop-coach-explore.md), completed [DEV0200 — Add mobile Explore map/list state](../../archive/frontend/DEV0200-add-mobile-explore-map-list-state.md) and draft [DEV0201 — Polish public marketplace accessibility](../frontend/DEV0201-polish-public-marketplace-accessibility.md)
- Related records: public-story baseline [DEV0095 — Present the coach-first public story](../../archive/frontend/DEV0095-present-coach-first-public-story.md), public-navigation baseline [DEV0153 — Separate client and coach navigation](../../archive/frontend/DEV0153-separate-client-and-coach-navigation.md), map boundary [DEV0174 — Decouple location services](../../archive/frontend/DEV0174-decouple-location-services.md), primary-location Explore behavior [DEV0180 — Pin coaches at primary locations](../../archive/frontend/DEV0180-pin-coaches-at-primary-locations.md) and marker correction [DEV0194 — Stabilize selected map markers](../../archive/frontend/DEV0194-stabilize-selected-map-markers.md)

## Objective and boundaries

Coordinate a search-first redesign of the public homepage, coach discovery and public navigation while preserving MovX identity, truthful server-backed availability, coach-confirmed requests, existing map-provider isolation and usable list fallbacks. The redesign should help a visitor search and compare coaches before reading the longer product explanation, without changing scheduling authority or presenting demo coaches, locations or times as verified live inventory.

This record owns the cross-ticket work map, shared decisions, delivery order and integration evidence. It does not implement runtime behavior. The supplied October 2026 redesign proposal is design input rather than an authoritative repository instruction or product contract.

The first delivery excludes a `When` filter, weekly-availability carousel, proximity ordering, prices, ratings, reviews, analytics, geolocation, “search this area,” travel time, global gym catalogue and any booking-policy change. Those capabilities require separate truthful data/product contracts.

## Direct development work

| Implementation part  | Development ticket                                                                                                                           | Owned deliverable                                                                                                                                                            | Start condition or dependency                         |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Product contract     | [DEV0195 — Adopt the public marketplace redesign contract](../../archive/organisatory/DEV0195-adopt-public-marketplace-redesign-contract.md) | Reconcile the authoritative specification with the adopted public information architecture, truthful search/data boundaries, responsive navigation and acceptance scenarios. | Completed; adopted decisions unblock DEV0196-DEV0197. |
| Public shell         | [DEV0196 — Introduce the public marketplace shell](../../archive/frontend/DEV0196-introduce-public-marketplace-shell.md)                     | Add route-aware public top navigation while preserving capability-aware workspace navigation, account access and preview disclosure.                                         | Completed after DEV0195 contract completion.          |
| Shared search        | [DEV0197 — Share public marketplace search](../../archive/frontend/DEV0197-share-public-marketplace-search.md)                               | Extract one accessible GET-search surface and discipline links for the already-supported query, discipline and location URL contract.                                        | Completed after DEV0195; independent of DEV0196.      |
| Marketplace homepage | [DEV0198 — Build the search-first marketplace home](../../archive/frontend/DEV0198-build-search-first-marketplace-home.md)                   | Recompose `/` around compact positioning, working search, truthful server-backed coach previews, explanation and coach acquisition.                                          | Completed after DEV0196 and DEV0197.                  |
| Desktop Explore      | [DEV0199 — Redesign desktop coach Explore](../../archive/frontend/DEV0199-redesign-desktop-coach-explore.md)                                 | Deliver compact image-forward result cards and an accessible sticky desktop list/map split without changing filter or map semantics.                                         | Completed with unit/build/browser evidence.           |
| Mobile map/list      | [DEV0200 — Add mobile Explore map/list state](../../archive/frontend/DEV0200-add-mobile-explore-map-list-state.md)                           | Add explicit list/map view state, a large mobile map and selected-coach preview while retaining filters and fallback behavior.                                               | Completed with unit/build/browser evidence.           |
| Integration polish   | [DEV0201 — Polish public marketplace accessibility](../frontend/DEV0201-polish-public-marketplace-accessibility.md)                          | Resolve cross-surface responsive/accessibility defects and run the final public-flow browser matrix.                                                                         | Starts after DEV0196-DEV0200 meet their own criteria. |

All required first-delivery implementation parts have direct development tickets. The tickets are flat peers under this coordination record; their dependency order does not create a child development-ticket hierarchy.

## Other relationships

- DEV0095 supplies the current truthful explainer-first homepage. DEV0198 changes its hierarchy but must preserve its booking-confirmation and demo-disclosure language.
- DEV0153 supplies actor-aware private navigation. DEV0196 changes public chrome only and must not remove `My sessions`, `Coach workspace`, coach Profile routing or personal account access from authorized actors.
- DEV0174, DEV0180 and DEV0194 supply the provider-neutral map, permanent primary-location semantics, accessible list fallback and stable marker positioning. DEV0199-DEV0200 are presentation consumers, not new location providers or geospatial authorities.
- The existing coach-profile and request flows are downstream destinations. Their route behavior, authority and pending-versus-confirmed language remain unchanged.

## Delivery sequence and completion conditions

1. Complete DEV0195 with the adopted real database-backed homepage previews, no first-delivery `When`/weekly section, header-only public mobile navigation, persistent private mobile bottom navigation and canonical mobile Explore list/map state.
2. DEV0196 and DEV0197 may proceed independently once their contract decisions are fixed.
3. DEV0198 composes the shell/search work and establishes the compact coach-preview presentation that DEV0199 may reuse.
4. DEV0199 delivers the desktop directory before DEV0200 adds responsive view-state behavior to the same results/map boundary.
5. DEV0201 runs only after peer criteria pass; defects that violate a peer's acceptance criteria remain owned by that peer rather than being silently moved into polish.
6. Complete this coordination only when every direct ticket is Completed or explicitly cancelled/replaced, the authoritative specification and ticket boundaries agree, and the integrated public journey passes desktop/mobile, keyboard, empty/unavailable, map-failure, signed-out and signed-in validation without changing booking authority.

## Progress and integration record

- 2026-10-12: Reviewed the supplied redesign proposal against the current `main` implementation and MVP specification. The search-first hierarchy, public top navigation, compact coach comparison, desktop list/map split and mobile list/map switch fit the scheduling product.
- 2026-10-12: Created the flat DEV0195-DEV0201 work map. All records remain Draft because asking for tickets did not silently confirm every proposal choice.
- 2026-10-12: Recommended real server-backed homepage previews, the existing `q`/discipline/location filters only, and header-only public mobile navigation. These are proposed defaults pending the DEV0195 contract decision.
- 2026-10-12: The user reviewed and approved the public and authenticated interactive previews. DEV0195 adopted the proposed data/search defaults, public header-only mobile chrome, persistent signed-in mobile bottom navigation and responsive Explore list/map contract. COR0017 is now In progress; DEV0196 and DEV0197 are ready to start independently after DEV0195 validation.
- 2026-10-12: DEV0196 started its route-aware public-shell implementation; private actor capability and route behavior remain unchanged.
- 2026-10-12: DEV0196 completed the exact public-route shell, capability-aware public account controls and desktop/mobile keyboard and overflow validation. DEV0197 remains the next ready independent ticket.
- 2026-10-12: DEV0197 started the shared no-JavaScript GET search and canonical public-filter URL implementation.
- 2026-10-12: DEV0197 completed one shared Home/Explore GET form, discipline links, canonical filter URLs and history-safe server-derived control state. Its unit, static, build and focused desktop/mobile browser checks passed; DEV0198 is now unblocked for review.
- 2026-10-12: DEV0198 started the request-time, bounded alphabetical Home preview and search-first composition after confirming its shell and search dependencies.
- 2026-10-12: DEV0198 completed the request-time search-first Home, bounded three-coach alphabetical preview, reusable compact card, honest data states, three-step pending-confirmation explanation and coach CTA. Both configuration-free and local-database desktop/mobile browser checks passed; DEV0199 is unblocked for review.
- 2026-10-12: DEV0199 started after confirming the shared search/card dependencies and existing map boundary are sufficient. It will adapt the compact card for accessible desktop card/pin selection while leaving canonical mobile view state to DEV0200.
- 2026-10-12: DEV0199 completed the shared compact result card, keyboard-accessible card/pin synchronization, 60/40 bounded sticky desktop map and expanded complete-list provider fallback. Unit, server, build, public-story, breakpoint and map-regression checks passed; DEV0200 is unblocked.
- 2026-10-12: DEV0200 started with explicit canonical `view=list|map`, absent/invalid list fallback, filter-preserving history links, mobile-only presentation state and provider-failure history replacement. Desktop Explore remains unaffected by the view parameter.
- 2026-10-12: DEV0200 completed canonical filter-preserving mobile list/map navigation, selected-coach focus/detail, responsive MapLibre resizing and safe filter-preserving list recovery after provider failure. Mobile portrait/landscape, desktop non-regression and public-story checks passed; DEV0201 is ready for final integration review.

## Validation results

- Planning validation completed on 2026-10-12: Prettier accepted the ticket index and all eight new records; a targeted checker validated every relative Markdown link, exactly one heading for COR0017 and DEV0195-DEV0201, and all seven reciprocal coordination memberships; the index advances the next IDs to DEV0202 and COR0018; `git diff --check` passed.
- DEV0195 contract validation completed on 2026-10-12: Prettier, final-path relative-link checks, unique-ID/reciprocal-membership checks, targeted contract text checks and `git diff --check` passed. The completed ticket is archived; DEV0196 and DEV0197 are Ready.
- DEV0196 validation completed on 2026-10-12: 109 unit tests and 9 server tests, lint, typecheck, formatting, production build, diff checks and all 8 targeted desktop/mobile Playwright shell checks passed. Exploratory full-suite environment failures are recorded in DEV0196 and do not change its passing ticket-owned shell matrix.
- DEV0197 validation completed on 2026-10-12: 112 unit tests and 9 server tests, lint, typecheck, formatting, production build, diff checks and 11 focused Playwright checks passed; one duplicate mobile no-JavaScript case was intentionally skipped while the desktop no-JavaScript path passed.
- DEV0198 validation completed on 2026-10-12: 116 unit tests and 9 server tests, lint, typecheck, formatting, a dynamic production Home build and 12 configuration-free Playwright checks passed. Two database-backed desktop/mobile checks additionally verified real cards, initials fallback and profile navigation.
- DEV0199 validation completed on 2026-10-12: 118 unit tests and 9 server tests, lint, typecheck, formatting, production build, 12 configuration-free public-story checks, 3 database-backed ticket checks and 2 shared profile-map regressions passed. The ticket records the two intentional duplicate mobile skips and the non-blocking partial-Auth exploratory results.
- DEV0200 validation completed on 2026-10-12: 119 unit tests and 9 server tests, lint, typecheck, formatting, production build, 12 public-story checks, 3 mobile ticket checks and 4 desktop Explore regressions passed. Map sizing, attribution, touch targets, history, selection and provider-failure recovery were covered at the adopted mobile widths.
- Runtime validation has completed through DEV0200; DEV0201 retains the final integration validation responsibility.

## Risks, limitations, and follow-ups

- The route-aware shell is the highest regression risk because the current global shell carries public, client and coach navigation in one component.
- “Near you” is excluded because no user location or distance ordering exists. The first homepage should say `Discover coaches` and retain the service's truthful ordering.
- `When` and `Available this week` are excluded until an exact occurrence-filter/aggregation contract exists. Existing today summaries may be displayed only where already authoritative.
- The proposal names desktop/mobile concept images, but those files were not supplied with this review. Implementation must use repository tokens and ticket behavior rather than depending on unavailable mockups.
- Analytics remains out of scope because no consent, provider or event contract exists.

## Completion and review references

- Completed: Not completed.
- Direct development tickets: DEV0195-DEV0200 Completed; DEV0201 Draft.
- Commit: Not applicable — coordination-record IDs are not used in commit subjects.
- Review: Proposal review completed in planning; no implementation review created.
- Deployment or release: Not deployed or released.
