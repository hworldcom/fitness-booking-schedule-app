# Ticket DEV0194: Stabilize selected map markers

- Status: Completed
- Created: 2026-10-12
- Last updated: 2026-10-12
- Milestone: Public map correctness follow-up
- Coordination: None — independent development ticket
- Related records: corrects selected-marker presentation from completed [DEV0174 — Decouple location services](DEV0174-decouple-location-services.md) and [DEV0193 — Map public coach training locations](DEV0193-map-public-coach-training-locations.md)

## Objective and context

The custom `.location-map-marker` rule overrides MapLibre's required absolute marker positioning with `position: relative`, so marker buttons participate in document flow before MapLibre's coordinate translation is applied. Selection also adds CSS `scale: 1.18` directly to the same HTML element whose `transform` MapLibre owns. At wider zoom levels these two presentation rules make visual positions diverge from the geographic coordinates: nearby Berlin markers whose MapLibre translations differ by only a few pixels can render tens or hundreds of pixels apart, making selected Chimosa appear near Poland/Czechia instead of Berlin. Restore geographically stable selected markers on public coach-profile and Explore maps while retaining a clear selected state.

## Scope and non-goals

- In scope:
  - Restore absolute positioning on the MapLibre-owned marker element so markers do not accumulate normal-flow offsets.
  - Remove position-affecting scale animation from the MapLibre-owned marker element.
  - Retain the existing selected accent ring/background and keyboard focus treatment.
  - Add a browser regression that selects a marker, zooms out and proves nearby Berlin markers remain nearby and inside the map.
  - Verify the public profile map at desktop/mobile widths and preserve Explore compatibility.
- Out of scope:
  - Changing location coordinates, fit bounds, map providers, marker colors, selection semantics, persistence or map controls.

## Expected behavior and edge cases

- Selecting a marker changes only its visual ring/background; zooming or panning never changes the marker's geographic anchor.
- Nearby Berlin locations converge visually as the user zooms out rather than the selected marker drifting away from the others.
- Portrait-backed Explore pins, numbered profile pins, coincident marker offsets and keyboard focus remain visible and selectable.
- Provider failure continues to use the existing list-first fallback.

## Assumptions, decisions, and dependencies

- MapLibre requires its marker root to remain absolutely positioned and owns `transform` on `.location-map-marker`; custom layout or transform-like properties on that same element must not interfere with either contract.
- The existing selected box-shadow supplies sufficient redundant emphasis, so no nested wrapper or renderer contract change is needed for this focused correction.
- This restores the already-confirmed geographic pin contract and does not change the MVP specification.

## Implementation plan

1. Restore absolute marker-root positioning, then remove the marker-element scale transition and selected scale while retaining ring/background selection styles.
2. Add isolated browser coverage that selects and repeatedly zooms out, then compares nearby marker screen positions and map bounds without depending on today's schedule data.
3. Run focused desktop/mobile browser checks, application tests, lint, type-check, formatting, production build and diff validation.

## Acceptance criteria

- [x] AC1: A selected marker remains anchored to its location across repeated zoom-out operations.
- [x] AC2: Selected state remains visually obvious without applying `scale` or another transform-like property to the MapLibre-owned element.
- [x] AC3: Nearby Berlin locations remain nearby at wide zoom, and all tested markers remain within map bounds.
- [x] AC4: Existing profile/Explore selection, marker colors/portraits, keyboard behavior and fallback remain unchanged.
- [x] AC5: Focused browser regression, application tests, lint, type-check, formatting and production build pass.

## Validation plan

- Add a Playwright assertion for the reported Daniel public-profile scenario: select Chimosa marker `2`, zoom out five times and verify the marker root remains absolutely positioned, has no independent CSS scale, stays within the map and converges toward Daniel's other Berlin marker.
- Repeat the affected public profile browser scenarios at desktop and mobile widths, including the forced provider-failure case.
- Run `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build` and `git diff --check` under Node.js 24.21.x.
- Database tests and migrations are not applicable because this is a CSS positioning correction with no data or authorization change.

## Implementation record

The shared MapLibre marker root now retains the positioning contract expected by the library. Public-profile numbered pins and Explore portrait/initial pins are absolutely positioned, and selected state uses a colored ring and stronger shadow without changing the root element's scale. A browser regression reproduces the reported Daniel Park flow by selecting Chimosa marker `2`, zooming out five times and measuring it against Daniel's other Berlin location at desktop and mobile widths.

### Changes and rationale

- Restored `position: absolute` on `.location-map-marker`. The previous custom `position: relative` declaration overrode MapLibre's stylesheet, placed every marker in normal document flow and added an increasing layout offset before each geographic translation.
- Removed the selected marker's `scale` transition/property. MapLibre owns the root marker transform, so selection presentation must not add transform-like behavior to that element.
- Preserved clear selection by using the location color as a four-pixel ring plus a slightly stronger shadow. This works for profile location colors and the existing Explore marker treatment without changing marker markup or map interfaces.
- Added an isolated Playwright regression for the exact two-location Daniel/Chimosa case. Isolation avoids coupling geographic correctness to the date-dependent availability copy in the wider directory journey.

### Affected files

| File or component                       | Change and purpose                                                                                                          |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `src/app/coach-discovery.css`           | Restores MapLibre-compatible absolute marker positioning and replaces selection scaling with a non-positioning ring/shadow. |
| `tests/browser/coach-discovery.spec.ts` | Adds the desktop/mobile Chimosa zoom-out regression and visual evidence.                                                    |
| `tickets/README.md`                     | Tracks DEV0194 through its current and completed lifecycle.                                                                 |

### Decisions and deviations

- The initial diagnosis identified selected-root scaling as the cause. The isolated browser measurement then showed a second cause: MapLibre translations differed by only a few pixels, but marker roots had `position: relative` and sequential normal-flow offsets. The ticket scope and plan were updated before restoring absolute positioning.
- A nested visual wrapper was not added because the existing ring/shadow gives a clear selected state without introducing a new renderer contract. Any future size animation must use such an inner wrapper, not the marker root.

### Contracts, configuration, and operations

No data, API, schema, dependency, environment, setup, migration or deployment contract changed. The correction restores the positioning behavior already required by MapLibre and applies to both existing map consumers.

## Validation results

- Date and environment: 2026-10-12 on macOS, Node.js 24.21.x, local Supabase PostgreSQL/Auth services and the production Next.js server used by Playwright.
- `npx playwright test tests/browser/coach-discovery.spec.ts --grep "coach profile"`: passed all 8 desktop/mobile profile, provider-failure and identity-boundary scenarios, including the new zoom regression.
- `npm test`: passed 107 application tests and 9 React-server tests.
- `npm run lint`: passed with no findings.
- `npm run typecheck`: passed after generating Next.js route types.
- `npm run format:check`: passed.
- `npm run build`: passed; all application and API routes compiled under Next.js 16.3.8.
- `git diff --check`: passed during implementation and is repeated after record archival.
- Manual/browser measurement after five settled zoom-out operations: Tempelhofer Feld and Chimosa were 6.08 px apart on desktop and 4.12 px apart on mobile; both roots reported `position: absolute` and `scale: none`. The generated screenshots showed marker `2` over the Berlin area with the red selected ring at both widths.
- An initial combined browser run reached the pre-existing date-dependent directory assertion before the new regression and failed because Daniel currently has an open time rather than the expected `No availability today`. The geographic check was therefore made an independent test; the focused profile suite above passed. This did not block the marker correction and no production availability behavior was changed.
- Database tests and migrations were not run because this change has no data, authorization or persistence behavior.

| Criterion | Evidence                                                                                                                                                                                            | Result |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | The exact Chimosa regression passed after five zoom-out operations at desktop and mobile widths.                                                                                                    | Passed |
| AC2       | Computed-style assertions require `position: absolute` and `scale: none`; screenshots retain the colored selection ring.                                                                            | Passed |
| AC3       | The test requires both marker centers to remain inside the map and within 40 px; measured distances were 6.08 px desktop and 4.12 px mobile.                                                        | Passed |
| AC4       | Eight focused browser scenarios passed, including profile selection, colors, keyboard interaction, fallback and identity protection; Explore uses the same corrected root and was manually checked. | Passed |
| AC5       | Browser, application, lint, type-check, format and production build commands all passed.                                                                                                            | Passed |

## Risks, limitations, and follow-ups

- Future marker size animations must target an inner visual wrapper rather than the MapLibre-positioned root element.
- The unrelated date-dependent directory assertion described above remains outside this ticket; it does not affect map positioning or production behavior.

## Completion and review references

- Completed: 2026-10-12.
- Commit: Included in the implementation commit whose subject references DEV0192, DEV0193 and DEV0194; see repository history.
- Review: No review created.
- Deployment or release: Not deployed or released.
