# Ticket DEV0200: Add mobile Explore map/list state

- Status: Completed
- Created: 2026-10-12
- Last updated: 2026-10-12
- Milestone: Scheduling interface public-marketplace follow-up
- Coordination: [COR0017 — Public marketplace redesign](../../current/organisatory/COR0017-public-marketplace-redesign.md)
- Related records: completed contract dependency [DEV0195 — Adopt the public marketplace redesign contract](../organisatory/DEV0195-adopt-public-marketplace-redesign-contract.md), completed Explore dependency [DEV0199 — Redesign desktop coach Explore](DEV0199-redesign-desktop-coach-explore.md), completed shell dependency [DEV0196 — Introduce the public marketplace shell](DEV0196-introduce-public-marketplace-shell.md) and final integration [DEV0201 — Polish public marketplace accessibility](../../current/frontend/DEV0201-polish-public-marketplace-accessibility.md)

## Objective and context

Give mobile Explore an explicit list/map switch instead of squeezing both panels into one narrow page. The selected map coach should have a compact preview that links to the full profile, while supported search filters and browser navigation remain stable.

## Scope and non-goals

- In scope:
  - Add bounded `view=list|map` URL state with list as the default for absent/invalid values.
  - Keep DEV0197 filter parameters when switching view and preserve the selected coach while the Explore component remains mounted.
  - Present a mostly viewport-height map with a selected-coach preview and an obvious return-to-list control.
  - Respect public-header, safe-area, on-screen keyboard and provider-failure boundaries.
- Out of scope:
  - Shareable selected-coach URL state, viewport persistence, clustering, map pan search, geolocation or desktop map hiding.
  - New coach/location/availability projections.

## Expected behavior and edge cases

- Mobile Explore opens in list mode unless a canonical `view=map` URL is requested.
- Toggling views preserves `q`, discipline and location values and produces understandable back/forward behavior.
- Pin selection shows a bounded coach preview with name, portrait/initial, primary base, truthful availability summary and profile link.
- If the map cannot load, the interface returns/remains in usable list mode with an explanation and no toggle trap.
- Controls remain reachable above safe areas and do not cover map attribution or selected content.

## Assumptions, decisions, and dependencies

- DEV0195 adopted list-default canonical `view=list|map` mobile state with filter/history preservation and list recovery; DEV0196 and DEV0199 must complete before implementation.
- Selected coach identity may remain client component state. Only `view` becomes a public URL contract in this slice.
- List content remains mounted or recoverable so switching view never triggers a new search or loses filter results.

## Implementation plan

1. Extend bounded Explore query/view parsing and canonical URL construction without weakening coach filters.
2. Add accessible mobile list/map controls and responsive composition around the DEV0199 result/map components.
3. Build the selected-coach map preview from the existing bounded directory entry.
4. Handle provider loading/failure, browser navigation, rotation/resizing, safe areas and focus transitions.
5. Add desktop non-regression and mobile browser coverage.

## Acceptance criteria

- [x] AC1: Mobile users can switch between list and map with canonical `view` state while all supported filters remain intact.
- [x] AC2: Back/forward, reload, invalid view values and map failure resolve predictably without losing the usable coach list.
- [x] AC3: Pin selection exposes an accessible truthful coach preview and profile link without initiating a booking.
- [x] AC4: Map/list controls and content avoid safe-area, attribution, keyboard and public-header obstruction at tested mobile widths.

## Validation plan

- Add query-state unit tests for list default, map value, invalid values and filter-preserving URL construction.
- Add Playwright checks at 375 px and 430 px for toggle, filters, selection, profile navigation, reload/back/forward and forced provider failure.
- Include keyboard and touch-sized-control review plus orientation/resize smoke.
- Run application tests, lint, type-check, format, build and `git diff --check`.

## Implementation record

Implementation started and completed on 2026-10-12 after confirming that DEV0199 supplies the shared result/map boundary and that the view state can extend the existing canonical Explore query contract without changing directory data.

### Changes and rationale

- Extended the canonical Explore URL contract with bounded `view=list|map` state. Missing state remains a backward-compatible list default; invalid, repeated or unknown state redirects to the same normalized coach filters without carrying an invalid value.
- Added a mobile-only segmented List/Map control that keeps query, discipline and location filters in both destinations. Link navigation supplies native browser history and reload behavior while desktop continues to show the list and map together.
- Added a mobile card-to-map transition and selected-coach preview. Selecting `Show on map` retains the client selection while navigating to map view; selecting a map marker focuses the preview, which shows only existing portrait/initial, primary training location, current-day availability and the full-profile destination.
- Added bounded mobile map sizing, a 44-pixel return control, touch-sized view controls, safe-area spacing and visible preview focus. The map renderer now responds to container resizing, which corrects a MapLibre canvas initialized while the list view keeps its panel hidden.
- Added map-provider recovery that clears stale selection, replaces a failed mobile map history entry with filter-preserving list state, keeps every coach/profile link available and removes the failed Map control to avoid a navigation trap.
- Added URL unit coverage and responsive browser coverage for 375-pixel, 430-pixel and landscape layouts, map/list history, reload, invalid state, card/marker selection, truthful empty availability, map sizing/attribution and provider failure. Desktop composition and the broader public marketplace story received explicit regression checks.

### Affected files

| File or component                                     | Change and purpose                                                                                                                                                                              |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/coaches/marketplace-search-contract.ts` | Defines bounded Explore view state, emits filter-preserving list/map URLs and includes an explicit valid view in canonical-query comparison.                                                    |
| `src/app/explore/page.tsx`                            | Parses/defaults view state, rejects invalid or repeated values through canonical redirect and passes the normalized view into the directory.                                                    |
| `src/features/coaches/coach-discovery.tsx`            | Threads the current normalized filters and responsive view into the shared Explore result boundary while retaining list as the default for existing callers.                                    |
| `src/features/coaches/coach-explore-results.tsx`      | Adds mobile view navigation, card-to-map selection, focused selected-coach detail, back-to-list behavior and provider-failure history recovery without changing desktop result/map composition. |
| `src/location/components/location-results-map.tsx`    | Observes map-container resizing and asks MapLibre to resize when a previously hidden responsive panel is shown.                                                                                 |
| `src/app/coach-discovery.css`                         | Supplies mobile-only segmented controls, list/map composition, viewport-relative map height, safe-area spacing, preview focus and recovery presentation.                                        |
| `tests/marketplace-search.test.ts`                    | Verifies filter-preserving view URLs, list defaults and rejection of invalid/repeated view state.                                                                                               |
| `tests/browser/coach-discovery.spec.ts`               | Verifies mobile history/selection/failure/layout behavior plus desktop and shared public-flow regressions.                                                                                      |

### Decisions and deviations

- Explicit `view=list` and `view=map` values are canonical. An absent value remains the backward-compatible list default; invalid or repeated values redirect to the same filters without a `view` value.
- Mobile map failure replaces the failed history entry with explicit `view=list`, preserves filters and shows a recovery explanation. The unavailable map control is removed so the user cannot immediately re-enter a known failed state.
- The desktop composition continues to render list and map together regardless of `view`; the parameter controls only the responsive mobile presentation.
- The map renderer will respond to container-size changes so a map initialized in the hidden mobile panel lays itself out correctly when shown.

### Contracts, configuration, and operations

Adds the bounded public `view=list|map` query parameter after DEV0195 adoption. Existing URLs without `view` remain compatible and render list mode on mobile. The parameter changes responsive presentation only: desktop continues to render both result surfaces. No schema, server API, provider, dependency, environment variable, setup step or migration changed. The internal `CoachExploreResults` component now receives normalized directory filters and view state; the existing `LocationResultsMap` provider contract is unchanged.

## Validation results

- `npm test` passed all 119 unit tests and 9 React-server tests, including the new canonical view-state cases.
- `npm run lint`, `npm run typecheck`, `npm run format:check` and `git diff --check` passed.
- `npm run build` passed with Next.js 16.3.8; `/explore` remains dynamically server-rendered.
- With the restricted loopback runtime database prepared, `DATABASE_URL=<redacted-loopback-runtime-url> npx playwright test tests/browser/coach-discovery.spec.ts --project=mobile --grep='mobile Explore preserves|mobile card selection|mobile map failure'` passed 3/3. It covered 375- and 430-pixel portrait viewports, 667-by-375 landscape, preserved filters/history/reload, invalid state, 44-pixel controls, selected previews, marker activation, map failure and horizontal overflow.
- `DATABASE_URL=<redacted-loopback-runtime-url> npx playwright test tests/browser/coach-discovery.spec.ts --project=desktop --grep='guest browses|bounded 60/40|both result surfaces|every coach'` passed 4/4, proving that desktop keeps both result surfaces and its complete provider-failure list even when a mobile `view` value is present.
- `DATABASE_URL=<redacted-loopback-runtime-url> npx playwright test tests/browser/public-story.spec.ts` passed 12 checks with two deliberate duplicate mobile cases skipped by the suite. Home/search and public/private shell behavior remained compatible in both projects.
- Browser measurements proved the unselected mobile map exceeds 50% of viewport height, the selected map exceeds 45%, map attribution remains visible, selected detail does not overlap the canvas, and view controls meet the 44-pixel minimum. The 375-pixel map and 430-pixel selected-preview screenshots were inspected without horizontal overflow or obstructed content.
- An initial selected-marker rehearsal expected Sam Lee to remain on-screen after the map correctly recentered and zoomed for Daniel Park. The test was corrected to zoom out through the visible map control and prove the target marker is inside the canvas before selection; the rerun passed. A later desktop failure was a strict-locator ambiguity between the new hidden mobile fallback label and the desktop map status; scoping the assertion to the map panel resolved the test-only ambiguity, and all four checks passed.

| Criterion | Evidence                                                                                                                                                                                                                                                   | Result |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Unit tests proved bounded/filter-preserving URLs; mobile Playwright switched list/map at 375 and 430 pixels while retaining Boxing and confirmed both 48-pixel segmented targets.                                                                          | Passed |
| AC2       | Mobile Playwright covered reload, back navigation through explicit and absent list state, invalid-state canonical redirect, and provider-failure replacement to a complete filter-preserving list with the failed Map link removed.                        | Passed |
| AC3       | Card selection retained Daniel Park into map view and focused a truthful detail region with primary base/profile link and no booking action; map selection focused Sam Lee and truthfully showed no availability today.                                    | Passed |
| AC4       | Portrait/landscape checks found no horizontal overflow; measured maps exceeded the ticket thresholds, selected detail did not overlap the canvas, attribution remained visible, back control measured at least 44 pixels and safe-area spacing is applied. | Passed |

## Risks, limitations, and follow-ups

- Selected coach identity intentionally remains component state, so a fresh reload or shared map URL does not select a coach. Shareable selected-coach state remains out of scope.
- External OpenFreeMap tile availability remains outside the application. List recovery is the supported failure path; clustering, viewport search and geolocation remain separate future work.
- DEV0201 owns the final cross-surface accessibility and reduced-motion integration pass after this ticket's view-specific criteria.

## Completion and review references

- Completed: 2026-10-12.
- Commit: This completed record is included with the implementation commit whose subject references DEV0200.
- Review: No review created.
- Deployment or release: Not deployed or released.
