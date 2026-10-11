# Ticket DEV0200: Add mobile Explore map/list state

- Status: Draft
- Created: 2026-10-12
- Last updated: 2026-10-12
- Milestone: Scheduling interface public-marketplace follow-up
- Coordination: [COR0017 — Public marketplace redesign](../organisatory/COR0017-public-marketplace-redesign.md)
- Related records: contract dependency [DEV0195 — Adopt the public marketplace redesign contract](../organisatory/DEV0195-adopt-public-marketplace-redesign-contract.md), Explore dependency [DEV0199 — Redesign desktop coach Explore](DEV0199-redesign-desktop-coach-explore.md), shell dependency [DEV0196 — Introduce the public marketplace shell](DEV0196-introduce-public-marketplace-shell.md) and final integration [DEV0201 — Polish public marketplace accessibility](DEV0201-polish-public-marketplace-accessibility.md)

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

- DEV0195 must adopt URL-backed mobile view state; DEV0196 and DEV0199 must complete before implementation.
- Selected coach identity may remain client component state. Only `view` becomes a public URL contract in this slice.
- List content remains mounted or recoverable so switching view never triggers a new search or loses filter results.

## Implementation plan

1. Extend bounded Explore query/view parsing and canonical URL construction without weakening coach filters.
2. Add accessible mobile list/map controls and responsive composition around the DEV0199 result/map components.
3. Build the selected-coach map preview from the existing bounded directory entry.
4. Handle provider loading/failure, browser navigation, rotation/resizing, safe areas and focus transitions.
5. Add desktop non-regression and mobile browser coverage.

## Acceptance criteria

- [ ] AC1: Mobile users can switch between list and map with canonical `view` state while all supported filters remain intact.
- [ ] AC2: Back/forward, reload, invalid view values and map failure resolve predictably without losing the usable coach list.
- [ ] AC3: Pin selection exposes an accessible truthful coach preview and profile link without initiating a booking.
- [ ] AC4: Map/list controls and content avoid safe-area, attribution, keyboard and public-header obstruction at tested mobile widths.

## Validation plan

- Add query-state unit tests for list default, map value, invalid values and filter-preserving URL construction.
- Add Playwright checks at 375 px and 430 px for toggle, filters, selection, profile navigation, reload/back/forward and forced provider failure.
- Include keyboard and touch-sized-control review plus orientation/resize smoke.
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

Adds one bounded public `view` query parameter after DEV0195 adoption. No schema, API, provider, dependency, environment or migration change is planned.

## Validation results

Pending validation.

| Criterion | Evidence | Result  |
| --------- | -------- | ------- |
| AC1       | Pending  | Not run |
| AC2       | Pending  | Not run |
| AC3       | Pending  | Not run |
| AC4       | Pending  | Not run |

## Risks, limitations, and follow-ups

- Updating search parameters must not reset selected state unnecessarily or create history loops.
- Mobile map height must be measured against the actual public header rather than hard-coded to a mockup.

## Completion and review references

- Completed: Not completed.
- Commit: Planning record included in the commit whose subject references DEV0195-DEV0201; implementation not started.
- Review: No review created.
- Deployment or release: Not deployed or released.
