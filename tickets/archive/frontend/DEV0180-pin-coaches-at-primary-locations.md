# Ticket DEV0180: Pin coaches at primary locations

- Status: Completed
- Created: 2026-10-09
- Last updated: 2026-10-10
- Milestone: Scheduling-only multi-location follow-up
- Coordination: [COR0014 — Multi-location coach scheduling](../organisatory/COR0014-multi-location-coach-scheduling.md)
- Related records: depends on completed [DEV0175 — Adopt the multi-location coach scheduling contract](../organisatory/DEV0175-adopt-multi-location-coach-scheduling-contract.md), [DEV0176 — Persist coach training locations](../backend/DEV0176-persist-coach-training-locations.md) and [DEV0177 — Bind availability to training locations](../backend/DEV0177-bind-availability-to-training-locations.md); consumes completed profile presentation from [DEV0178 — Manage coach training locations](DEV0178-manage-coach-training-locations.md) and map infrastructure from [DEV0174 — Decouple location services](DEV0174-decouple-location-services.md)

## Objective and context

Keep each approved/demo visible coach discoverable on Explore through exactly one map marker at the coach-selected primary training location. Marker eligibility and position do not depend on today's open availability. The coach card and selected-coach map detail show today's actual open times or an explicit no-availability-today state, but never claim that the primary marker is a live or session location. This delivers the Explore behavior in [MVP specification section 4.2](../../../docs/mvp-spec.md#42-discover-and-book-a-coach) and the [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix) for the [M3 scheduling-interface milestone](../../../docs/mvp-spec.md#12-delivery-milestones).

## Scope and non-goals

- In scope: one server-side directory projection containing each coach, the validated active primary location and a bounded today open-slot summary; one marker per visible coach at the primary coordinates; primary-location copy/accessibility; today/no-today status using actual slot venues; coach list/map consistency; same-coordinate handling; loading/map-failure/manual-list fallback; responsive and browser tests.
- Out of scope: choosing/editing primary (DEV0178), assigning schedule locations (DEV0179), availability-dependent marker removal or movement, a date selector, live tracking, directions/distance ranking, route optimization, marker positions for every secondary gym or native map work.

## Expected behavior and edge cases

- Every approved/demo visible coach with a valid primary location appears once on the map even with zero open slots today.
- The marker coordinates and primary label always come from the current active primary location, not from an arbitrary profile location or today's occurrence.
- The coach card and selected-coach map detail label the marker anchor `Primary training location`. They separately show chronological open times with their actual venue labels for today or `No availability today`.
- If today's open session is at a secondary location, the primary marker does not move; the availability row explicitly names the secondary venue.
- `Today` means the current local calendar date in that coach's current IANA scheduling timezone, evaluated from the same database statement time. Only still-future `open` occurrences whose start is on that local date are included; an occurrence is assigned to the date on which it starts.
- Hidden, suspended, invalid or unpublished coaches do not appear. The backend invariant prevents a visible coach without one primary; malformed projections fail boundedly.
- Multiple coaches sharing coordinates retain one focusable marker each. The renderer applies deterministic visual separation around the shared geographic anchor, while the provider-neutral point retains the exact primary coordinates and the complete accessible list remains authoritative.
- Map/render-provider failure leaves the complete coach list usable. Search/filter behavior never depends only on clicking the map.
- Booking the last open slot changes today's availability status after revalidation but does not remove the visible coach's primary marker.

## Assumptions, decisions, and dependencies

- Confirmed user constraint, 2026-10-09: a visible coach remains on the Explore map all the time according to the coach-selected primary location.
- Adopted during readiness review, 2026-10-10: Explore has no date selector in this delivery. `Today` uses the coach-local start date and excludes elapsed or non-open occurrences. The directory projects at most 64 chronological open occurrences per coach as a defensive bound that accommodates the existing 30-minute minimum duration and longer daylight-saving days; overflow fails boundedly rather than silently truncating a truthful state.
- DEV0176 supplies a single validated public primary location and all-active-locations profile projection. DEV0177 supplies actual slot snapshots for today's summary.
- Reuse `src/location/` renderer contracts; discovery code supplies provider-neutral marker data and does not depend directly on MapLibre/OpenFreeMap implementation details.
- Adopted during readiness review, 2026-10-10: keep the existing filtered visible-coach set regardless of today availability. Resolve the primary location explicitly from `primaryLocationId` plus the active locations collection instead of building new behavior on the temporary singleton compatibility aliases.
- Fetch and synchronize matched coach availability server-side in a bounded database operation, then load all matched today summaries in one bulk query. Do not add per-card browser requests or a client-side live subscription. The existing booking action already revalidates `/explore`; this ticket consumes that boundary.
- The current renderer has no provider-neutral popup contract. Keep provider-specific popup behavior out of `src/location/`: selection drives an accessible detail panel owned by the discovery feature, and selecting a marker continues to focus its corresponding coach card.
- For equal coordinate pairs, order coach markers by stable profile identity and calculate collision presentation inside the renderer. This does not alter stored coordinates, map bounds, marker eligibility or list order.
- Primary-marker language must remain distinct from live location and actual booked venue throughout visual and accessible copy.
- Readiness decision, 2026-10-10: the work remains one cohesive vertical slice rather than a new coordination split. All persistence, availability and renderer dependencies are complete; the data boundary, collision behavior, failure behavior and validation path are concrete without another product decision.

## Implementation plan

1. Add a directory-entry contract that pairs the existing coach projection with its explicitly resolved active primary location and immutable today availability snapshots; keep public profile availability behavior unchanged.
2. Extend the public directory repository to synchronize the matched public coaches, select future open occurrences whose start date is today in each coach timezone and return a single bounded server-side result with no per-card requests.
3. Build exactly one provider-neutral point per entry from the resolved primary location. In the renderer, detect coincident coordinates and apply deterministic visual offsets while preserving the exact geographic anchor, stable selection and one keyboard-focusable marker per coach.
4. Update cards and an Explore-owned selected-coach map detail panel to label `Primary training location`, show chronological today time/actual-venue rows or `No availability today`, and keep list/map selection synchronized.
5. Preserve filter/list usability and current map-failure behavior. Rely on the existing booking action's `/explore` revalidation so booking/cancellation refreshes presentation without changing marker eligibility.
6. Add query/domain/component/browser tests for coach-local day boundaries, primary versus actual venue, no availability, last-slot booking/cancellation, hidden/suspended coaches, shared coordinates, provider failure and portrait/initial fallback.
7. Verify desktop/mobile layout, keyboard access, marker/list navigation, lint, type checking, database integration and the production build.

## Acceptance criteria

- [x] AC1: Every valid approved/demo visible coach has exactly one Explore marker built from the explicitly resolved active primary location regardless of today's availability; hidden, suspended, invalid and unpublished coaches remain excluded.
- [x] AC2: Cards, marker accessible names and the selected-coach map detail identify `Primary training location` rather than live presence. Today rows include only future open starts on the coach-local current date and name each occurrence snapshot's actual venue, including a secondary venue, or show `No availability today`.
- [x] AC3: Booking the final today slot changes the revalidated presentation to `No availability today` without removing or moving the coach marker; cancelling an eligible booking can restore its actual-venue row through the same revalidation boundary.
- [x] AC4: Coaches sharing exact coordinates retain separate focusable/selectable markers with deterministic visual separation, while map failure and keyboard/mobile use retain access to every matching coach through the complete list.
- [x] AC5: The directory loads its bounded coach/today data server-side without per-card browser requests and fails closed on malformed data or database failure; query/domain/component/browser, lint, type, database and build validation passes without coupling discovery to a concrete map/search provider.

## Validation plan

Create database fixtures for a coach whose primary and today venue match, one whose today venue is secondary, one with no remaining today availability, two sharing coordinates and hidden/suspended coaches. Cover coach-local dates near a UTC day boundary, future-only/open-only filtering, immutable actual-location snapshots and the 64-row safety bound. Verify marker count/exact coordinates, deterministic collision presentation, primary/detail copy, list consistency, final-slot booking/cancellation revalidation and renderer failure. Exercise desktop/mobile widths plus keyboard marker/list navigation.

Run focused tests while iterating, then record exact results for `npm test`, `npm run test:db`, `npm run db:test`, `npm run db:lint`, `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build` and the configured desktop/mobile `npm run test:e2e`. Use an authenticated local rehearsal for final-slot booking/cancellation when the browser fixtures can establish the required identities; otherwise leave the ticket In progress and record the exact blocker.

## Implementation record

Completed on 2026-10-10. Explore now treats the coach-selected primary location as the permanent discovery anchor while presenting today's actual open-session venues as separate scheduling facts. The list remains the complete fallback when the map provider cannot render.

### Changes and rationale

- Replaced the directory's coach-only result with immutable entries containing the validated explicit primary location and a bounded chronological `todaySlots` projection. The repository synchronizes all matched coaches and loads their coach-local, future, open occurrences in one bulk query; it requests one overflow row and fails closed above the 64-slot contract instead of silently truncating.
- Evaluates and displays today times in the coach's current scheduling timezone. A still-open explicit slot may retain an older immutable timezone snapshot after a profile timezone change, so that valid state is not rejected; only its actual venue snapshot remains authoritative for the location row.
- Built map points only from `primaryLocationId` resolved against the active primary entity. Cards, accessible marker names and the selected-coach detail consistently say `Primary training location`, while availability rows use immutable occurrence names/labels and an explicit `No availability today` state.
- Added deterministic renderer-owned pixel offsets for markers with exactly equal stored coordinates. Provider-neutral points and map bounds keep their real primary coordinates, and every coach retains an independently focusable/selectable button plus the complete list fallback.
- Kept the existing booking/cancellation revalidation boundary. Database lifecycle coverage now proves booking removes an eligible slot from the directory summary, cancellation restores its prior inclusion and the primary marker identity remains unchanged.

### Affected files

| File or component                                                                                                                                                                                   | Change and purpose                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/domain/coaches.ts`, `src/server/coaches/service.ts` and `src/server/db/coaches/repository.ts`                                                                                                  | Define the directory-entry contract, resolve the explicit active primary and load synchronized bounded coach-local today slots server-side.                                                |
| `src/server/db/coaches/availability-repository.ts`                                                                                                                                                  | Shares the existing validated public-slot mapping/select list so directory availability uses the same snapshot contract as public coach schedules.                                         |
| `src/features/coaches/coach-explore-results.tsx` and `src/features/coaches/coach-today-availability.tsx`                                                                                            | Build primary map points, render truthful actual-venue today summaries and expose an accessible selected-coach map detail without provider-specific popups.                                |
| `src/location/contracts.ts`, `src/location/marker-layout.ts`, `src/location/index.ts` and `src/location/components/location-results-map.tsx`                                                        | Add provider-neutral marker labels and deterministic same-coordinate visual separation while preserving exact geographic anchors.                                                          |
| `src/app/coach-discovery.css`                                                                                                                                                                       | Styles responsive card summaries and selected-coach map details at desktop and mobile sizes.                                                                                               |
| `tests/coach-directory.test.ts`, `tests/database/coaches.test.ts`, `tests/database/coach-availability.test.ts`, `tests/database/coach-bookings.test.ts` and `tests/browser/coach-discovery.spec.ts` | Cover primary resolution, actual secondary venues, empty state, collision stability, coach-local query inclusion, booking/cancellation projection changes and responsive browser behavior. |

### Decisions and deviations

The readiness decisions were implemented without changing the confirmed MVP behavior. The location module owns only renderer presentation offsets; scheduling authority remains in database-backed primary and occurrence snapshots. Current coach timezone controls the today boundary and displayed time even when an older explicit slot retains its original timezone snapshot. The selected detail is deliberately ordinary Explore markup rather than a MapLibre popup, which keeps provider-specific APIs out of feature code and preserves keyboard/list access.

### Contracts, configuration, and operations

Consumes existing provider-neutral location configuration and `/explore` revalidation. No schema migration, dependency, map token, environment variable, setup step, persistence provider or public-profile contract changed. The internal server directory response now uses `entries` containing `coach`, `primaryLocation` and at most 64 `todaySlots`; `LocationMapPoint` adds an explicit provider-neutral `ariaLabel`. This is an internal web contract change with no database migration or rollback requirement.

## Validation results

- `npm test`: passed 100 unit tests plus 7 React-server tests. This includes explicit-primary resolution, invalid marker data, stable same-coordinate offsets, singleton exact anchors and secondary actual-venue/empty-state rendering.
- `npm run test:db`: final full run passed 37/37 database integration tests. The new coverage verifies coach-local directory inclusion and booking/cancellation removal/restoration while primary identity remains stable. One earlier full run exposed a pre-existing timestamp-format-sensitive concurrency assertion; its isolated rerun and the final full rerun passed without code changes.
- `npm run db:test`: passed all 184 pgTAP assertions against the freshly seeded local schema. An initial run correctly failed because the development database contained Daniel's user-created second location and ten slots, while migration tests intentionally assert pristine post-seed counts. See the local-environment note below.
- `npm run db:lint`: passed with no schema errors.
- `npm run lint`, `npm run typecheck`, `npm run format:check`, focused ticket formatting and `git diff --check`: passed.
- Configured `npm run build`: passed with local database/Auth values under the repository's Node.js 24.21.0 runtime.
- Configured `npm run test:e2e`: final run passed all 28 desktop/mobile tests after restoring the documented runtime login. The discovery browser test verified five independent markers, portrait/initial fallback, primary copy, Nora/Idris collision offsets, selected detail, filtering and map-failure list fallback. Desktop and mobile selected-map screenshots were inspected and showed readable cards, detail and map layout. The first post-reset run failed four discovery assertions only because the regenerated runtime database password had not yet been prepared; `npm run db:runtime` restored it before the passing run.
- Authenticated local rehearsal: signed in as `hoang@users.movx.test`, observed Daniel's sole today slot and five primary markers, booked it from the public profile, observed `No availability today` with the same five markers and unchanged Daniel marker offset, cancelled it from My sessions, and observed the actual 17:30–18:30 Tempelhofer Feld row restored. Both booked/restored desktop screenshots were inspected; the exact rehearsal booking and slot were then removed without touching other local records.

| Criterion | Evidence                                                                                                                       | Result |
| --------- | ------------------------------------------------------------------------------------------------------------------------------ | ------ |
| AC1       | Explicit-primary domain/database assertions plus five-marker desktop/mobile browser checks                                     | Passed |
| AC2       | Coach-local query test, secondary-venue component test and primary/no-today browser copy                                       | Passed |
| AC3       | Database lifecycle plus authenticated final-slot booking/cancellation, `/explore` revalidation and unchanged marker evidence   | Passed |
| AC4       | Deterministic collision unit/browser checks, keyboard-accessible markers, responsive screenshots and provider-failure fallback | Passed |
| AC5       | Bulk-query review, malformed-data guards, boundary tests and complete command matrix                                           | Passed |

## Risks, limitations, and follow-ups

Users may still infer that a map marker is today's venue, so the primary label remains adjacent to marker-related details and every actual availability venue is named. The 64-row bound is deliberately defensive; exceeding it fails the directory boundedly. A future availability-location map or date selector requires a new explicit product decision rather than overloading this marker contract.

During validation, `supabase db reset --db-url ...` unexpectedly targeted the main local project rather than the intended disposable database. It removed local-only schedule/location changes and reloaded deterministic seed data. The runtime database login, documented ordinary user and five coach Auth accounts were restored successfully under Node.js 24.21.0, but Daniel's prior manually created second location and ten local availability slots had no backup and were not fabricated or restored. This affects local development data only, not repository source or a hosted environment.

## Completion and review references

- Completed: 2026-10-10.
- Commit: This commit — `[DEV0180] Pin coaches at primary locations`.
- Review: No review created.
- Deployment or release: Not deployed.
