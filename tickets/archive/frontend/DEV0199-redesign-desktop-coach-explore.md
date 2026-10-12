# Ticket DEV0199: Redesign desktop coach Explore

- Status: Completed
- Created: 2026-10-12
- Last updated: 2026-10-12
- Milestone: Scheduling interface public-marketplace follow-up
- Coordination: [COR0017 — Public marketplace redesign](../../current/organisatory/COR0017-public-marketplace-redesign.md)
- Related records: completed contract dependency [DEV0195 — Adopt the public marketplace redesign contract](../organisatory/DEV0195-adopt-public-marketplace-redesign-contract.md), completed search dependency [DEV0197 — Share public marketplace search](DEV0197-share-public-marketplace-search.md), completed card dependency [DEV0198 — Build the search-first marketplace home](DEV0198-build-search-first-marketplace-home.md), mobile consumer [DEV0200 — Add mobile Explore map/list state](../../current/frontend/DEV0200-add-mobile-explore-map-list-state.md), map baselines [DEV0174 — Decouple location services](DEV0174-decouple-location-services.md) and [DEV0194 — Stabilize selected map markers](DEV0194-stabilize-selected-map-markers.md)

## Objective and context

Make desktop `/explore` a denser comparison surface with compact image-forward coach cards beside a sticky map. Preserve the current server-filtered list, primary-location pins, card/pin synchronization, map loading/failure states and profile links while reducing vertical card length and keeping filters easy to revisit.

## Scope and non-goals

- In scope:
  - Compose DEV0197 search near the top with result count and truthful ordering.
  - Reuse/adapt the compact coach presentation from DEV0198 for result density.
  - Implement an approximately 60/40 list/map desktop layout with bounded sticky behavior.
  - Preserve bidirectional accessible card/pin selection, selected coach detail, primary-location explanation and complete list fallback.
  - Show portrait/initial, name, disciplines, confirmed training base, concise biography and the next authoritative availability state.
- Out of scope:
  - Mobile view switching, new map provider/coordinates, clustering, viewport search, live location, price/rating/review data or a desktop map-hide toggle.
  - Changes to filter matching, coach ordering or profile/request behavior.

## Expected behavior and edge cases

- Desktop users can compare multiple coaches without scrolling through full profile-like cards.
- Selecting a result highlights its pin; selecting a pin focuses/scrolls the corresponding result without initiating booking.
- Coincident markers remain distinguishable and selected markers remain geographically anchored.
- Map load/provider failure removes no coaches, filters or profile links; the list expands usefully into available space.
- Long names, multiple disciplines, missing portraits, no availability today and unavailable directory state remain readable.

## Assumptions, decisions, and dependencies

- DEV0195 adopted the complete filtered list beside the provider-neutral primary-location map as the desktop Explore contract.
- DEV0197 and the reusable card boundary from DEV0198 must complete first.
- Existing `LocationResultsMap` remains the only map renderer; this ticket changes composition, not its provider contract.
- Sticky positioning must account for the public header height established by DEV0196 and stop within the results section/footer.

## Implementation plan

1. Refactor Explore result/card composition around the shared compact presentation without changing directory projections.
2. Add the desktop list/map grid and bounded sticky map styles at tested breakpoints.
3. Preserve/refine card refs, focus management, selected detail and provider-failure expansion.
4. Extend browser tests for filter results, card/pin selection, coincident points, marker portraits/initials and map failure.
5. Validate long/empty states, keyboard behavior and desktop/tablet viewport boundaries.

## Acceptance criteria

- [x] AC1: At desktop width, compact authentic coach results and an interactive sticky map share the results section without obstruction or overflow.
- [x] AC2: Card-to-pin and pin-to-card selection remains keyboard accessible and preserves primary-location semantics.
- [x] AC3: Missing images, no availability, empty results and unavailable map/provider states retain a complete usable list.
- [x] AC4: Existing `q`, discipline and location filters, result ordering and profile links remain behaviorally compatible.

## Validation plan

- Extend component tests for compact card data boundaries and selected result state.
- Add Playwright checks at 768 px, 1024 px and 1440 px for filters, sticky limits, bidirectional selection, coincident markers and map failure.
- Re-run existing coach profile/map browser scenarios to catch shared-style regressions.
- Run application tests, lint, type-check, format, build and `git diff --check`.

## Implementation record

Implementation started and completed on 2026-10-12 after confirming that DEV0197 and DEV0198 supply the shared search and compact-card boundaries and that the existing provider-neutral map contract needs no change.

### Changes and rationale

- Replaced the separate full-size Explore card markup with an Explore variant of the shared compact coach card. Result cards keep the authentic portrait or initials, trust label, disciplines, concise biography, primary training location, current-day availability and profile destination while fitting one dense comparison row.
- Preserved two-way map selection. Focusing or activating a result's native `Show on map` button selects the corresponding marker; selecting a marker sets and focuses the matching result without starting a booking action.
- Changed the desktop result composition to an approximately 60/40 list/map grid. The map clears the 76-pixel public header, has a viewport-bounded sticky panel, and reduces its canvas height when selected-coach detail is present.
- Added an explicit provider-unavailable layout state. The complete result list, initials, profile links, filters and ordering remain present, map controls disappear, stale selection clears, and the list receives more than 68% of the result width.
- Kept the existing stacked responsive behavior below 980 pixels. DEV0200 still owns explicit mobile list/map controls and canonical `view` URL state.

### Affected files

| File or component                                | Change and purpose                                                                                                                                                                                         |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/coaches/compact-coach-card.tsx`    | Extends the shared card with preview/result variants, concise result biography, result heading hierarchy, optional DOM ref/focus handling and an accessible pressed-state map control.                     |
| `src/features/coaches/coach-explore-results.tsx` | Composes all Explore results from the shared card, retains card refs and primary-location map points, clears stale selection on provider failure and exposes layout/selection state to presentation.       |
| `src/app/coach-discovery.css`                    | Supplies dense result-card areas, selected treatment, 60/40 desktop composition, public-header-aware bounded sticky behavior, provider-failure expansion and stacked tablet/mobile fallback.               |
| `tests/home-marketplace.test.ts`                 | Verifies the shared result-card projection, initials fallback, biography, primary location, no-availability state, profile link, pressed selection contract and explicit empty/unavailable Explore states. |
| `tests/browser/coach-discovery.spec.ts`          | Verifies keyboard card-to-pin selection, pin-to-card focus, filtered marker updates, coincident markers, portraits/initials, 768/1024/1440 layout boundaries and complete map-failure fallback.            |

### Decisions and deviations

- Reuse the compact coach card as the common presentation boundary, adding optional Explore-only selection and map controls instead of maintaining a second full-size coach-card implementation.
- Keep the existing stacked layout below the desktop breakpoint. Canonical mobile list/map view state remains owned by DEV0200.
- The existing database fixture currently gives Daniel Park one open time. Browser coverage follows that authoritative state and uses Elif Demir to prove the no-availability presentation instead of retaining a stale Daniel-specific assertion.

### Contracts, configuration, and operations

No server, schema, provider, environment variable, setup step or migration changed. Existing public projections, `q`/discipline/location query parameters, alphabetical ordering, profile routes and the `LocationResultsMap` provider contract remain compatible. The internal compact-card component accepts optional result-only focus, selection and map-control props; Home continues to use its default preview variant.

## Validation results

- `npm test` passed all 118 unit tests and 9 React-server tests. The new static component cases cover the result-card data/selection boundary and explicit empty/unavailable Explore states.
- `npm run lint`, `npm run typecheck`, `npm run format:check` and `git diff --check` passed.
- `npm run build` passed with Next.js 16.3.8; `/explore` remains dynamically server-rendered and no route/configuration contract changed.
- With the restricted loopback runtime database prepared, `DATABASE_URL=<redacted-loopback-runtime-url> npx playwright test tests/browser/coach-discovery.spec.ts --project=desktop --grep='guest browses|bounded 60/40|every coach and profile link'` passed 3/3. It covered the real five-coach directory, both selection directions, keyboard activation, filtered one-coach/one-marker state, 768/1024/1440 layout behavior, overflow, and forced OpenFreeMap failure with a complete expanded list.
- `DATABASE_URL=<redacted-loopback-runtime-url> npx playwright test tests/browser/coach-discovery.spec.ts --project=desktop --grep='selected coach profile|complete location list'` passed 2/2 shared map regressions, including geographically anchored selected markers and profile-map failure fallback.
- `npx playwright test tests/browser/public-story.spec.ts --project=desktop --project=mobile` passed 12 checks with the two deliberate duplicate mobile cases skipped by the suite. This covered shared-card Home regressions and public/private shell behavior in configuration-free mode.
- The first browser attempt had no runtime `DATABASE_URL` and correctly rendered the bounded unavailable directory. After `node scripts/prepare-local-runtime-database.mjs` and the explicit restricted database URL, all ticket-owned checks passed. An exploratory full coach-discovery run with only database configuration passed 6/8; its two Auth-sensitive checks rendered the expected bounded Auth-unavailable states because Auth variables were intentionally absent. Those unrelated checks were not used as completion evidence.
- The passing 1440-pixel selected and filtered screenshots were inspected: compact rows, selected styling, map detail, attribution, no-availability content and the one-result composition were readable without horizontal overflow.

| Criterion | Evidence                                                                                                                                                                                                                   | Result |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Playwright measured the list between 50% and 70% of the result width with sticky, header-clearing, bounded map behavior at 1024 and 1440 pixels; 768 pixels stacked without overflow. Screenshots were visually inspected. | Passed |
| AC2       | The focused native result button selected the marker; marker activation focused the selected card and retained primary-location copy. Coincident-marker and profile marker anchoring checks passed.                        | Passed |
| AC3       | Static and browser tests covered initials, current no-availability content, empty/unavailable server states, provider failure, all five cards and retained profile links; the failed-map list measured above 68% width.    | Passed |
| AC4       | The existing GET search produced the canonical Muay Thai URL, one alphabetical result and one marker; profile links and full test/build checks passed.                                                                     | Passed |

## Risks, limitations, and follow-ups

- DEV0200 still needs to replace the interim stacked small-screen composition with explicit canonical list/map view state and a selected-coach mobile preview.
- Map clustering, viewport search and “search this area” remain separate future work.
- External map tile availability remains outside the application; the complete list fallback is the supported recovery path.

## Completion and review references

- Completed: 2026-10-12.
- Commit: This completed record is included with the implementation commit whose subject references DEV0199.
- Review: No review created.
- Deployment or release: Not deployed or released.
