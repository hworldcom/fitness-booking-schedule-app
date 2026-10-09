# Ticket DEV0180: Pin coaches at primary locations

- Status: Draft
- Created: 2026-10-09
- Last updated: 2026-10-09
- Milestone: Scheduling-only multi-location follow-up
- Coordination: [COR0014 — Multi-location coach scheduling](../organisatory/COR0014-multi-location-coach-scheduling.md)
- Related records: depends on completed [DEV0175 — Adopt the multi-location coach scheduling contract](../../archive/organisatory/DEV0175-adopt-multi-location-coach-scheduling-contract.md), [DEV0176 — Persist coach training locations](../../archive/backend/DEV0176-persist-coach-training-locations.md) and [DEV0177 — Bind availability to training locations](../backend/DEV0177-bind-availability-to-training-locations.md); consumes profile presentation from [DEV0178 — Manage coach training locations](DEV0178-manage-coach-training-locations.md) and map infrastructure from [DEV0174 — Decouple location services](../../archive/frontend/DEV0174-decouple-location-services.md)

## Objective and context

Keep each approved/demo visible coach discoverable on Explore through exactly one map marker at the coach-selected primary training location. Marker eligibility and position do not depend on today's open availability. The popup and coach card may show today's actual open times or an explicit no-availability-today state, but must not claim that the primary marker is a live or session location.

## Scope and non-goals

- In scope: public discovery projection of primary location plus today's open-slot summaries; one marker per visible coach at the primary coordinates; primary-location copy/accessibility; today/no-today status using actual slot venues; coach list/map consistency; same-coordinate handling; loading/map-failure/manual-list fallback; responsive and browser tests.
- Out of scope: choosing/editing primary (DEV0178), assigning schedule locations (DEV0179), availability-dependent marker removal or movement, a date selector, live tracking, directions/distance ranking, route optimization, marker positions for every secondary gym or native map work.

## Expected behavior and edge cases

- Every approved/demo visible coach with a valid primary location appears once on the map even with zero open slots today.
- The marker coordinates and primary label always come from the current active primary location, not from an arbitrary profile location or today's occurrence.
- The popup labels the marker `Primary training location`. It separately shows actual open times and venue labels for today or `No availability today`.
- If today's open session is at a secondary location, the primary marker does not move; the availability row explicitly names the secondary venue.
- Hidden, suspended, invalid or unpublished coaches do not appear. The backend invariant prevents a visible coach without one primary; malformed projections fail boundedly.
- Multiple coaches sharing coordinates remain discoverable through marker grouping/selection and the accessible list; no coach silently disappears behind another marker.
- Map/render-provider failure leaves the complete coach list usable. Search/filter behavior never depends only on clicking the map.
- Booking the last open slot changes today's availability status after revalidation but does not remove the visible coach's primary marker.

## Assumptions, decisions, and dependencies

- Confirmed user constraint, 2026-10-09: a visible coach remains on the Explore map all the time according to the coach-selected primary location.
- Explore has no date selector in this delivery. `Today` is evaluated under the current coach scheduling timezone contract and is presentation data, not marker eligibility.
- DEV0176 supplies a single validated public primary location and all-active-locations profile projection. DEV0177 supplies actual slot snapshots for today's summary.
- Reuse `src/location/` renderer contracts; discovery code supplies provider-neutral marker data and does not depend directly on MapLibre/OpenFreeMap implementation details.
- Proposed default: keep the existing visible-coach list regardless of today availability and annotate availability state so map and list do not expose contradictory coach sets.
- Primary-marker language must remain distinct from live location and actual booked venue throughout visual and accessible copy.

## Implementation plan

1. Extend public coach discovery queries/types with exactly one primary location and bounded today open-slot summaries grouped by actual venue.
2. Build one provider-neutral marker per visible coach from the primary location, with stable coach identity and same-coordinate handling.
3. Update popups/cards to label the primary training location and separately present today's actual times/venues or explicit empty state.
4. Preserve filter/list usability and map failure behavior; revalidate today summaries after booking without changing marker eligibility.
5. Add query/domain/component/browser tests for primary versus actual venue, no availability, last-slot booking, hidden/suspended coaches, shared coordinates and renderer failure.
6. Verify desktop/mobile layout, keyboard access, marker/list navigation, lint, type checking and builds.

## Acceptance criteria

- [ ] AC1: Every valid approved/demo visible coach has exactly one Explore marker at the active primary location regardless of today's availability.
- [ ] AC2: Marker and popup language identifies a primary training base rather than live presence, while today's times show their actual location or an explicit no-availability state.
- [ ] AC3: Booking the final today slot updates availability presentation without removing or moving the coach marker; hidden/suspended/invalid coaches remain excluded.
- [ ] AC4: Shared coordinates, map failure and keyboard/mobile use retain access to every visible coach through the provider-neutral map/list interface.
- [ ] AC5: Query/domain/component/browser, lint, type and build validation passes without coupling discovery to a concrete map/search provider.

## Validation plan

Create fixtures for a coach whose primary and today venue match, one whose today venue is secondary, one with no today availability, two sharing coordinates and hidden/suspended coaches. Verify the public query, marker count/coordinates, popup copy, list consistency, booking revalidation and renderer failure. Exercise desktop/mobile widths and keyboard/list navigation, then run focused unit/browser suites plus lint, type checking and builds.

## Implementation record

Pending implementation.

### Changes and rationale

Pending implementation.

### Affected files

| File or component                                  | Change and purpose                                             |
| -------------------------------------------------- | -------------------------------------------------------------- |
| Public coach repository/domain projections         | Planned primary marker and bounded today-summary fields.       |
| `src/features/coaches/coach-explore-results.tsx`   | Planned list/map availability presentation.                    |
| `src/location/components/location-results-map.tsx` | Planned one-primary-marker rendering and accessible selection. |
| Explore styles and focused/browser tests           | Planned responsive, failure and behavior evidence.             |

### Decisions and deviations

None yet.

### Contracts, configuration, and operations

Consumes existing provider-neutral location configuration. No new map token, environment variable or persistence provider is planned.

## Validation results

Pending validation.

| Criterion | Evidence                                   | Result  |
| --------- | ------------------------------------------ | ------- |
| AC1       | Marker eligibility/coordinate tests        | Not run |
| AC2       | Primary/actual-venue copy review           | Not run |
| AC3       | Booking revalidation/visibility tests      | Not run |
| AC4       | Shared-coordinate/failure/responsive tests | Not run |
| AC5       | Command matrix and coupling review         | Not run |

## Risks, limitations, and follow-ups

Users may still infer that a map marker is today's venue. Keep the primary label adjacent to the marker title and name every actual availability venue. A future availability-location map would require a new explicit product decision rather than overloading this marker contract.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: No review created.
- Deployment or release: Not deployed.
