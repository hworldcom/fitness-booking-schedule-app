# Ticket DEV0199: Redesign desktop coach Explore

- Status: Draft
- Created: 2026-10-12
- Last updated: 2026-10-12
- Milestone: Scheduling interface public-marketplace follow-up
- Coordination: [COR0017 — Public marketplace redesign](../organisatory/COR0017-public-marketplace-redesign.md)
- Related records: completed contract dependency [DEV0195 — Adopt the public marketplace redesign contract](../../archive/organisatory/DEV0195-adopt-public-marketplace-redesign-contract.md), completed search dependency [DEV0197 — Share public marketplace search](../../archive/frontend/DEV0197-share-public-marketplace-search.md), completed card dependency [DEV0198 — Build the search-first marketplace home](../../archive/frontend/DEV0198-build-search-first-marketplace-home.md), mobile consumer [DEV0200 — Add mobile Explore map/list state](DEV0200-add-mobile-explore-map-list-state.md), map baselines [DEV0174 — Decouple location services](../../archive/frontend/DEV0174-decouple-location-services.md) and [DEV0194 — Stabilize selected map markers](../../archive/frontend/DEV0194-stabilize-selected-map-markers.md)

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

- [ ] AC1: At desktop width, compact authentic coach results and an interactive sticky map share the results section without obstruction or overflow.
- [ ] AC2: Card-to-pin and pin-to-card selection remains keyboard accessible and preserves primary-location semantics.
- [ ] AC3: Missing images, no availability, empty results and unavailable map/provider states retain a complete usable list.
- [ ] AC4: Existing `q`, discipline and location filters, result ordering and profile links remain behaviorally compatible.

## Validation plan

- Extend component tests for compact card data boundaries and selected result state.
- Add Playwright checks at 768 px, 1024 px and 1440 px for filters, sticky limits, bidirectional selection, coincident markers and map failure.
- Re-run existing coach profile/map browser scenarios to catch shared-style regressions.
- Run application tests, lint, type-check, format, build and `git diff --check`.

## Implementation record

Pending implementation.

### Changes and rationale

Pending implementation.

### Affected files

| File or component | Change and purpose |
| ----------------- | ------------------ |
| Pending           | Pending.           |

### Decisions and deviations

None yet.

### Contracts, configuration, and operations

No server, schema, provider, environment or migration change is planned. Existing public projections and query parameters remain compatible.

## Validation results

Pending validation.

| Criterion | Evidence | Result  |
| --------- | -------- | ------- |
| AC1       | Pending  | Not run |
| AC2       | Pending  | Not run |
| AC3       | Pending  | Not run |
| AC4       | Pending  | Not run |

## Risks, limitations, and follow-ups

- Sticky layout and programmatic scrolling can fight one another; focus must remain visible and reduced-motion preferences respected.
- Map clustering and “search this area” remain separate future work.

## Completion and review references

- Completed: Not completed.
- Commit: Planning record included in the commit whose subject references DEV0195-DEV0201; implementation not started.
- Review: No review created.
- Deployment or release: Not deployed or released.
