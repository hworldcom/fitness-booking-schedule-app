# Ticket DEV0193: Map public coach training locations

- Status: Completed
- Created: 2026-10-11
- Last updated: 2026-10-12
- Milestone: Multi-location public-profile follow-up
- Coordination: None — independent development ticket
- Related records: extends completed [DEV0174 — Decouple location services](DEV0174-decouple-location-services.md), [DEV0178 — Manage coach training locations](DEV0178-manage-coach-training-locations.md) and [DEV0181 — Distinguish schedule location colors](DEV0181-distinguish-schedule-location-colors.md)

## Objective and context

Public coach profiles list every active confirmed training location under `Confirmed places`, but a visitor cannot see their geographic relationship without returning to Explore, which maps only the coach's primary base. Add one provider-neutral map to the profile's Training locations section, pin every active location and use a distinct matching color for each marker and list entry. This extends the public-profile behavior in [the MVP coach profile and training-location contract](../../../docs/mvp-spec.md#coach-profile-and-training-locations).

## Scope and non-goals

- In scope:
  - Render one lazy MapLibre/OpenFreeMap map inside the public Training locations section using the already-authorized active-location projection.
  - Fit all valid active location coordinates, including coincident locations, and select the primary location initially.
  - Give every displayed location a distinct color and numeric marker, repeat that color/number in the list, and preserve location names and addresses as the authoritative non-color labels.
  - Synchronize marker and list selection with accessible button names and visible selection treatment while keeping every marker in the fitted map view.
  - Keep the complete list usable while the map loads or if WebGL, provider or network startup fails.
  - Extend the provider-neutral map contract and focused automated/browser coverage without exposing inactive location history.
- Out of scope:
  - Changing Explore's primary-location-only policy, coach location editing, availability venues, persistence, geocoding, live location or location authorization.
  - Adding a new map/search provider, database migration, environment variable or dependency.

## Expected behavior and edge cases

- A public coach profile with one or more active confirmed locations shows all of them as map markers and as matching colored list entries. The primary base is selected on first render and retains its text badge.
- Selecting a marker identifies the same colored list row; selecting a list row highlights that marker without hiding the other fitted locations. Color and numeric labels are redundant cues, so the relationship does not depend on color perception.
- Locations sharing identical coordinates remain individually selectable through the existing deterministic marker-offset layout.
- If the map cannot initialize, the visitor sees a clear unavailable state and can still read every active location name, address and primary label in the list.
- Inactive locations never enter the client map props or public list.

## Assumptions, decisions, and dependencies

- The existing public coach projection already supplies bounded active locations with confirmed provider-neutral coordinates; no additional read or client request is needed.
- Keep MapLibre GL JS and OpenFreeMap details inside `src/location/`. The coach feature may provide generic point data and marker presentation values but must not import provider code.
- Use deterministic, collision-resolved palette assignment over the displayed active location identifiers. Generate a separate accent for every displayed location rather than relying on a fixed six-color schedule palette; adding or removing a location may reassign presentation colors and has no persisted meaning.
- Continue the established client-only dynamic import because MapLibre depends on browser APIs. The surrounding list and loading/error state remain server-renderable and list-first.

## Implementation plan

1. Update the public-profile product contract and acceptance matrix for the all-location map, redundant color/number legend and list-first failure behavior.
2. Extend the provider-neutral map-point/rendering contract with optional marker accents and reusable accessibility labels while preserving existing Explore behavior.
3. Add a narrow client component for profile location mapping, deterministic colors, synchronized selection, lazy loading and failure fallback; replace the static profile list with it.
4. Add responsive styles plus pure/component/browser assertions for all active markers, distinct matching colors, primary selection, inactive omission and map fallback.
5. Run focused tests, the existing application suite, lint, type-check, formatting, production build and desktop/mobile browser rehearsal.

## Acceptance criteria

- [x] AC1: The public coach profile maps every active confirmed training location and omits inactive history.
- [x] AC2: Every displayed location has a distinct marker color plus matching list color and numeric label; name/address text remains available without relying on color.
- [x] AC3: Marker and list selection stay synchronized, the primary location is selected initially and coincident coordinates remain individually selectable.
- [x] AC4: Map loading/provider failure leaves the complete accessible Training locations list usable and does not block the schedule.
- [x] AC5: Existing Explore map behavior remains compatible, and focused tests plus lint, type-check, formatting and production build pass.
- [x] AC6: The profile map and list are verified at desktop and mobile widths with keyboard-accessible controls and no horizontal overflow.

## Validation plan

- Add pure coverage for deterministic distinct color assignment and optional marker presentation contracts.
- Extend the public profile component test with multiple active and one inactive location to verify map/list inputs, distinct matching cues, primary state and inactive omission.
- Extend the configured coach-discovery browser scenario to verify the map region/fallback boundary, keyboard selection and responsive layout; use a multi-location local fixture when available.
- Run `npm test`, the focused browser suite, `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build` and `git diff --check` under the repository's supported Node.js version.
- Database tests and migrations are not required because the authorized public projection and persistence contract do not change.

## Implementation record

Public coach profiles now render one lazy OpenFreeMap-backed map inside `Training locations`. Every active location becomes a numbered marker and a matching colored list row, with the primary location selected and labelled initially. The map fits all points and keeps them visible as selection changes; the complete text list renders independently and remains available if map initialization fails.

### Changes and rationale

- Added a narrow client component around the existing server-projected active locations. It owns only presentation and selection state; no additional request, public data or persistence boundary was introduced.
- Reused the provider-neutral MapLibre renderer with optional marker appearance, canvas/item accessibility labels and a profile-specific no-recenter selection mode. Explore retains its original portrait markers and recenter-on-selection behavior.
- Assigned deterministic collision-resolved palette indexes over the current active location identifiers, then generated a distinct accent/tint/ink triple for every displayed place. Matching numeric labels, names and addresses make color a redundant aid rather than the sole identifier.
- Kept the primary location selected initially while fitting the entire point set. An initial browser rehearsal found that the shared selection effect ran before marker creation; adding map readiness to that effect made the selected marker state truthful. A later visual check found camera recentering hid the other pin, so the profile opts out while Explore remains unchanged.
- Added a dedicated loading and provider-failure state inside the map region. The list and session schedule remain rendered, and location selection buttons become disabled only when the map is unavailable.
- Updated the current product contract and acceptance matrix with the all-location public-profile behavior.

### Affected files

| File or component | Change and purpose |
| ----------------- | ------------------ |
| `docs/mvp-spec.md` | Adds the confirmed all-location profile map, redundant color/number legend and list-first failure contract. |
| `src/location/contracts.ts` | Adds optional provider-neutral marker appearance values to map points. |
| `src/location/components/location-results-map.tsx` | Applies optional marker colors, reusable accessibility labels, readiness-aware initial selection and configurable camera recentering. |
| `src/features/coaches/coach-profile-location-colors.ts` | Deterministically assigns one distinct generated color triple per displayed location without a fixed palette cap. |
| `src/features/coaches/coach-profile-locations.tsx` | Renders the lazy map, synchronized numbered/color legend, primary selection and map-unavailable fallback. |
| `src/features/coaches/coach-discovery.tsx` | Replaces the static active-location list with the bounded profile locations component. |
| `src/app/coach-discovery.css` | Styles responsive map/loading states, custom markers and matching selected list rows at desktop and mobile widths. |
| `tests/coach-location-palette.test.ts` and `tests/coach-trust.test.ts` | Cover unbounded deterministic distinct colors, matching public legend cues, initial primary state and inactive omission. |
| `tests/browser/coach-discovery.spec.ts` | Verifies map/list color matching, keyboard selection, mobile/desktop layout and forced OpenFreeMap failure fallback. |

### Decisions and deviations

- 2026-10-12: The profile disables camera recentering when a marker/list row is selected. The first implementation reused Explore's camera focus and caused the primary selection to hide another active marker; keeping the fitted view better serves the requested all-location comparison while selection remains visually and semantically synchronized.
- 2026-10-12: Generated HSL colors replace reuse of the schedule's six-entry palette. Public profiles have no six-location product limit, so every currently displayed identifier receives a distinct presentation value; the colors are intentionally not persisted and can change when the active set changes.

### Contracts, configuration, and operations

`LocationMapPoint` gains optional `markerAppearance` colors, and `LocationResultsMap` gains optional canvas label, coincident-item label and recenter-on-selection inputs. All additions are backward-compatible defaults, so Explore callers preserve their existing behavior. The public coach projection and routes do not change. No schema, migration, dependency, environment variable, setup or deployment configuration changed.

## Validation results

- Date and environment: 2026-10-12, macOS local Supabase runtime, OpenFreeMap public style and Node.js 24.21.0.
- `npm test`: passed, 107 application tests and 9 React-server tests.
- `npm run lint`: passed.
- `npm run typecheck`: passed after Next.js route type generation.
- `npm run format:check`: passed for the configured application/script/test files.
- `npm run build`: passed with Next.js 16.3.8 and the version-matched same-origin MapLibre worker. The final build used the explicit loopback runtime database and public Auth values required by the configured production-browser fixture; no value was printed or persisted.
- `npx playwright test tests/browser/coach-discovery.spec.ts --grep "coach profile"`: passed six checks across the configured 1440 × 1040 desktop and 393 × 852 mobile projects. This covered the live map, matching list/marker color, initial primary selection, keyboard activation, no horizontal overflow, schedule continuity and a forced OpenFreeMap failure with the complete list retained.
- Manual multi-location rehearsal: opened Daniel Park's local public profile with Tempelhofer Feld and Chimosa. Desktop and mobile screenshots showed both green/red numbered pins together in one fitted view, matching list rows, Chimosa selected and labelled as primary, readable attribution and no horizontal overflow. Selecting either map/list control retained both pins.
- `git diff --check`: passed after implementation; repeated after the completed ticket/index update.
- Database tests and migrations: not run/not applicable because this ticket changes no database object, query, authorization or stored contract.
- Resolved failures: the first production browser attempt intentionally lacked local runtime configuration and stopped at the existing unavailable-profile state; it passed once the documented loopback configuration was supplied. The next run exposed the readiness-order bug described above, and all affected browser checks passed after the fix. No failure remains.

| Criterion | Evidence | Result |
| --------- | -------- | ------ |
| AC1 | Multi-location component fixture and Daniel browser rehearsal showed every active place while the inactive fixture stayed absent. | Passed |
| AC2 | Pure color test proved 12 distinct deterministic accents; component/browser checks matched numbered marker and list colors. | Passed |
| AC3 | Readiness-aware selection, existing coincident-offset tests and browser keyboard checks proved truthful primary and synchronized selection. | Passed |
| AC4 | Forced OpenFreeMap request failure passed at desktop/mobile with name, address, primary list and schedule still usable. | Passed |
| AC5 | Full application/server suite, Explore-compatible defaults, lint, type-check, formatting and production build passed. | Passed |
| AC6 | Automated desktop/mobile projects and two-location visual screenshots passed without horizontal overflow. | Passed |

## Risks, limitations, and follow-ups

- OpenFreeMap remains a public best-effort tile/style service without an uptime guarantee; the public list is the required fallback.
- Location colors are presentation-only and may change when the active-location set changes. Names, addresses, primary labels and marker numbers remain the durable cues.

## Completion and review references

- Completed: 2026-10-12. All-location map, distinct matching legend and list-first fallback delivered and validated.
- Commit: Included in the implementation commit whose subject references DEV0192, DEV0193 and DEV0194; see repository history.
- Review: No review created.
- Deployment or release: Not deployed or released.
