# Ticket DEV0179: Edit a location-aware working week

- Status: Draft
- Created: 2026-10-09
- Last updated: 2026-10-10
- Milestone: Scheduling-only multi-location follow-up
- Coordination: [COR0014 — Multi-location coach scheduling](../organisatory/COR0014-multi-location-coach-scheduling.md)
- Related records: depends on completed [DEV0177 — Bind availability to training locations](../../archive/backend/DEV0177-bind-availability-to-training-locations.md) and [DEV0178 — Manage coach training locations](DEV0178-manage-coach-training-locations.md); extends [DEV0146 — Save weekly schedule in one action](../../archive/frontend/DEV0146-save-weekly-schedule-in-one-action.md) and preserves [DEV0170 — Separate coach Schedule and Bookings tabs](../../archive/frontend/DEV0170-separate-coach-schedule-and-bookings-tabs.md)

## Objective and context

Make Coach Workspace scheduling location-aware without restoring the old per-cell database delay. The coach chooses an active training location as the assignment tool, selects one or more weekly cells locally, sees the gym assigned to every selected hour, and explicitly saves the complete draft once.

One cell represents the coach's capacity for that hour and therefore belongs to at most one location. Schedule continues to show availability and occupied status; detailed client booking content remains in Bookings.

## Scope and non-goals

- In scope: selected-location toolbar; stable visual legend; location-labeled/color-coded cells; add/remove/reassign interactions; complete local draft and one atomic save; unsaved/stale/conflict recovery; all-location schedule overview; actual-location upcoming occurrence presentation; responsive mobile day/location controls; keyboard/accessibility tests.
- Out of scope: location creation/editing (DEV0178), persistence/synchronization (DEV0177), primary map behavior (DEV0180), one database write per cell, drag/paint gestures as a required interaction, travel-time enforcement, cross-timezone calendar conversion, variable recurring durations, external calendar sync or moving booking details back into Schedule.

## Expected behavior and edge cases

- The editor starts with one active location selected and labels the calendar timezone. Changing the selector affects subsequent empty-cell assignments only.
- Clicking an empty cell assigns the selected location in local state. Clicking a cell already assigned there removes it. Clicking a cell assigned elsewhere offers a clear reassign/remove choice rather than silently overwriting it.
- Selected cells display a stable location cue that is not color-only. The legend, accessible name and mobile row identify the assigned gym/location.
- No server mutation occurs until `Save schedule`. The save includes all desired location/time assignments and the baseline used for optimistic concurrency.
- A successful save updates the baseline once. Invalid, stale, overlapping or unavailable saves retain the local draft and show a bounded recovery message.
- One weekday/time cell cannot represent two locations. The server remains authoritative for overlap, ownership and active-location checks.
- Upcoming dated occurrences show their actual snapshot location. Booked cells remain recognizable without exposing client details in Schedule.
- If a location becomes inactive while the editor is open, save conflicts and prompts refresh/reassignment rather than publishing against stale state.

## Assumptions, decisions, and dependencies

- DEV0177 supplies a structured rule assignment containing `locationId`, weekday and local start time plus atomic expected/requested semantics.
- DEV0178 supplies ordered active locations and a primary marker; the primary may be the initial selector default but is not automatically assigned to every existing or new cell without explicit editor state.
- Confirmed user interaction direction, 2026-10-09: choose a gym, click Wednesday 10:00, see that gym assigned immediately, then save explicitly.
- Proposed implementation representation: replace the current `Set<weekday|time>` draft with a `Map<weekday|time, locationId>` or an equivalently explicit immutable structure.
- Proposed desktop presentation uses a compact selector and stable color/short-name legend. Mobile keeps the location control visible above the selected day and shows a text chip on each assigned hour.
- Retain one coach scheduling timezone and the existing one-hour/next-seven-day contract.

## Implementation plan

1. Extend the editor state and serialization from selected times to location assignments plus expected baseline.
2. Add the active-location selector, non-color-only legend and cell assignment/removal/reassignment behavior.
3. Keep all changes local until one save action and preserve the draft across bounded conflict/unavailable responses.
4. Update mobile day/hour presentation, keyboard controls, focus behavior and accessible names for assigned locations.
5. Update the upcoming occurrence list to emphasize the actual location snapshot while preserving Schedule/Bookings separation.
6. Add component/domain/action/browser tests at desktop and mobile widths, including stale/inactive location and cross-location overlap paths.

## Acceptance criteria

- [ ] AC1: A coach can choose an active location and assign multiple weekly cells to it locally; every assigned cell exposes the location through text/accessibility as well as color.
- [ ] AC2: A cell has at most one location and can be removed or deliberately reassigned without an intermediate database mutation.
- [ ] AC3: One explicit save atomically submits the complete draft; successful, stale, overlap, inactive-location and unavailable outcomes preserve truthful state.
- [ ] AC4: Schedule shows actual occurrence locations and occupied status while Bookings remains the sole detailed client-booking view.
- [ ] AC5: Desktop/mobile, keyboard, accessibility, component/action/browser, lint, type and build validation passes.

## Validation plan

Add focused editor-state and serialization tests plus browser scenarios with at least two active locations. Select/reassign/remove cells, switch mobile day/location controls, verify no request occurs before save, save/reload assignments, simulate stale and inactive-location conflicts, attempt same-time cross-location assignments and inspect upcoming booked/open rows. Verify desktop and mobile widths and keyboard-only operation, then run unit, lint, type and build suites.

## Implementation record

Pending implementation.

### Changes and rationale

Pending implementation.

### Affected files

| File or component                                          | Change and purpose                                               |
| ---------------------------------------------------------- | ---------------------------------------------------------------- |
| `src/features/coaches/coach-availability-panel.tsx`        | Planned location-aware draft/editor and occurrence presentation. |
| Coach schedule actions/domain contracts                    | Planned structured assignment serialization and result states.   |
| `src/app/coach-discovery.css` or extracted schedule styles | Planned responsive location legend/cell/mobile controls.         |
| Focused and browser tests                                  | Planned local-draft, save, conflict and accessibility evidence.  |

### Decisions and deviations

None yet.

### Contracts, configuration, and operations

Consumes DEV0177/DEV0178 contracts. No new environment variable, provider or deployment service is planned.

## Validation results

Pending validation.

| Criterion | Evidence                                | Result  |
| --------- | --------------------------------------- | ------- |
| AC1       | Multi-location assignment tests         | Not run |
| AC2       | Remove/reassign/no-request tests        | Not run |
| AC3       | Save/conflict/reload tests              | Not run |
| AC4       | Schedule/Bookings boundary review       | Not run |
| AC5       | Responsive/accessibility/command matrix | Not run |

## Risks, limitations, and follow-ups

Color alone is insufficient and too many locations can overwhelm the grid. Use short text cues and a legend, cap only visual clutter rather than valid data, and retain accessible full names. Travel feasibility between adjacent venues is not validated in this delivery.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: No review created.
- Deployment or release: Not deployed.
