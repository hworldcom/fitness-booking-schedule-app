# Ticket DEV0179: Edit a location-aware working week

- Status: Completed
- Created: 2026-10-09
- Last updated: 2026-10-10
- Milestone: Scheduling-only multi-location follow-up
- Coordination: [COR0014 — Multi-location coach scheduling](../organisatory/COR0014-multi-location-coach-scheduling.md)
- Related records: depends on completed [DEV0177 — Bind availability to training locations](../backend/DEV0177-bind-availability-to-training-locations.md) and [DEV0178 — Manage coach training locations](DEV0178-manage-coach-training-locations.md); extends [DEV0146 — Save weekly schedule in one action](DEV0146-save-weekly-schedule-in-one-action.md) and preserves [DEV0170 — Separate coach Schedule and Bookings tabs](DEV0170-separate-coach-schedule-and-bookings-tabs.md)

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
- Adopted: extend the delivered `Map<weekday|time, versioned location assignment>` compatibility draft rather than introducing another client representation. Filter the selector to active locations, default it to the active primary location and never mutate existing cells merely because the selected tool changes.
- Adopted: clicking an empty cell assigns the selected location; clicking a cell already assigned to that location removes it; clicking a cell assigned elsewhere opens an explicit local `Keep`, `Move to selected location` or `Remove` decision without saving or silently overwriting it.
- Adopted: derive a deterministic visual cue from stable location identity and pair it with visible location text, full accessible names and a legend. Color remains supplementary. Mobile keeps the location selector above the selected day and shows the assigned location text on every selected hour.
- Adopted: DEV0177's structured expected/requested rule sets and single authorized action remain the mutation boundary. No schema or new server endpoint is expected; a bounded conflict continues to cover stale rules, changed/deactivated locations and overlaps while retaining the local draft.
- Retain one coach scheduling timezone and the existing one-hour/next-seven-day contract.

## Implementation plan

1. Extract and test the existing location-aware draft/serialization behavior so empty assignment, same-location removal and explicit cross-location decisions remain immutable and deterministic.
2. Add the active-location selector, non-color-only legend and cell assignment/removal/reassignment behavior.
3. Keep all changes local until one save action and preserve the draft across bounded conflict/unavailable responses.
4. Update mobile day/hour presentation, keyboard controls, focus behavior and accessible names for assigned locations.
5. Update the upcoming occurrence list to emphasize the actual location snapshot while preserving Schedule/Bookings separation.
6. Add component/domain/action/browser tests at desktop and mobile widths, including stale/inactive location and cross-location overlap paths.

## Acceptance criteria

- [x] AC1: A coach can choose an active location and assign multiple weekly cells to it locally; every assigned cell exposes the location through text/accessibility as well as color.
- [x] AC2: A cell has at most one location and can be removed or deliberately reassigned without an intermediate database mutation.
- [x] AC3: One explicit save atomically submits the complete draft; successful, stale, overlap, inactive-location and unavailable outcomes preserve truthful state.
- [x] AC4: Schedule shows actual occurrence locations and occupied status while Bookings remains the sole detailed client-booking view.
- [x] AC5: Desktop/mobile, keyboard, accessibility, component/action/browser, lint, type and build validation passes.

## Validation plan

Add focused editor-state and serialization tests plus browser scenarios with at least two active locations. Select/reassign/remove cells, switch mobile day/location controls, verify no request occurs before save, save/reload assignments, simulate stale and inactive-location conflicts, attempt same-time cross-location assignments and inspect upcoming booked/open rows. Verify desktop and mobile widths and keyboard-only operation, then run unit, lint, type and build suites.

## Implementation record

Completed on 2026-10-10. The coach Schedule now exposes an active-location assignment tool, stable text-plus-color legend and location-labelled weekly cells. Empty cells take the selected location locally; a same-location click removes the hour; a cross-location click pauses for an explicit keep, move or remove choice. One Save schedule action remains the only mutation and retains the local draft on bounded conflicts.

### Changes and rationale

- Extracted the calendar draft into framework-independent immutable helpers. Assignment, same-location removal, cross-location decision and deterministic serialization now have focused tests and never mutate the saved baseline map.
- Filters the assignment selector to active locations and initially selects the coach's active primary location. Changing the selector affects only subsequent empty-cell assignments and closes an unresolved decision without rewriting existing cells.
- Presents each active location in a stable legend and derives a deterministic palette from its stable location ID. Every assigned cell also displays the location name and exposes the full venue, time and action through its accessible name, so color is never the only cue.
- Makes a cross-location cell click non-mutating until the coach explicitly chooses `Keep`, `Move to …` or `Remove hour`. Focus moves to the first decision control, and Save schedule remains disabled while the decision is unresolved.
- Reuses DEV0177's structured requested/expected payload and authorized atomic action without a new endpoint or schema. Successful saves advance the local baseline once; invalid, conflict and unavailable responses retain the controlled draft and truthful dirty state.
- Keeps actual immutable venue names in the dated-occurrence list and keeps client details exclusively in Bookings. Updated copy makes the actual occurrence venue explicit without treating the primary location as live presence.
- Expanded the authenticated local rehearsal to create two reviewed locations, exercise keep/move/remove and keyboard focus, prove zero per-cell requests and one request per save, show both actual venues publicly, then deactivate a location in another page and observe a recoverable stale conflict. The rehearsal now removes only its exact local `dev0104-coach-*` identities and related scheduling records, restoring the deterministic fixture baseline.

### Affected files

| File or component                                           | Change and purpose                                                                                                                                                       |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/features/coaches/coach-schedule-draft.ts`              | Owns immutable versioned assignment creation, stable serialization, non-mutating decision detection and explicit keep/move/remove resolution.                            |
| `src/features/coaches/coach-availability-panel.tsx`         | Adds the active-location tool and legend, location-labelled cells, deliberate reassignment panel, unresolved-decision save guard and actual-venue occurrence copy.       |
| `src/app/coach-workspace.css`                               | Adds deterministic location palette surfaces plus responsive selector, legend, decision and readable desktop/mobile cell presentation.                                   |
| `tests/coach-schedule-draft.test.ts`                        | Proves immutable add/remove, mandatory cross-location decision, explicit resolutions and insertion-order-independent serialization.                                      |
| `tests/coach-schedule.test.ts`                              | Verifies primary-default selection, all-location legend, full accessible cell actions, location-aware payload preservation and the unchanged Schedule/Bookings boundary. |
| `tests/server/coach-availability-actions.test.ts`           | Verifies malformed and duplicate-location schedule drafts are rejected by the server action before any mutation can begin.                                               |
| `scripts/rehearse-local-coach-availability.mjs`             | Rehearses two-location assignment/save/public/conflict/mobile/keyboard behavior and performs bounded loopback-only account/data cleanup.                                 |
| `README.md`, ticket index and `COR0014` coordination record | Documents the stronger rehearsal and records lifecycle, validation and downstream readiness.                                                                             |

### Decisions and deviations

- 2026-10-10: Readiness review adopted the already-delivered versioned assignment map and server action rather than adding a new backend contract. Cross-location clicks require a deliberate three-choice decision, and stable visible text accompanies every deterministic color cue.
- 2026-10-10: Kept six deterministic palette choices as supplementary cues without limiting the number of valid locations. Palette collisions are acceptable because the full visible and accessible location name remains authoritative.
- 2026-10-10: Disabled the save control while a cross-location decision is open. Saving the otherwise-valid draft while presenting an unresolved move/remove question would be technically consistent but misleading.
- 2026-10-10: The configured action's existing `conflict` outcome remains intentionally bounded rather than distinguishing stale rules, a changed/deactivated location and overlap. The rehearsal proved that the draft survives a real concurrent deactivation and the server publishes no partial replacement.

### Contracts, configuration, and operations

Consumes DEV0177's versioned rule-set action and DEV0178's ordered owner location projection. No application data shape, database schema, server endpoint, provider, application environment variable, migration or deployment service changed. `COACH_AVAILABILITY_TEST_DATABASE_URL` is an optional rehearsal-only override; cleanup rejects any non-loopback target or port other than `55322`. The existing action state remains `idle | saved | invalid | conflict | unavailable`.

## Validation results

All required validation passed on 2026-10-10 under Node.js `24.21.0`, npm `11.19.0`, Next.js `16.3.8`, the local Supabase PostgreSQL/Auth/Mailpit stack and Chrome through Playwright.

- `npm run test:coach-availability` passed with two reviewed gyms. It exercised primary-default selection, local assignment, explicit keep/move/remove, decision focus, the unresolved-decision save guard, zero POST requests before save, exactly one POST per save, two actual occurrence/public venues, desktop and 393 × 852 mobile layouts, a location deactivated from another page, a retained unsaved draft after conflict and successful recovery. Cleanup left zero matching rehearsal identities.
- `npm test` passed 93 unit/component tests plus 7 server tests. The three new pure draft tests cover immutable assignment/removal, mandatory cross-location decisions, all explicit resolutions and stable serialization; direct action coverage rejects malformed and duplicate-location drafts before mutation; component coverage checks 161 keyboard-operable cells, visible legend text, full accessible actions, structured location identity and Schedule/Bookings separation.
- `npm run test:db` passed 37 serialized database integration tests, including complete-rule replacement, stale baselines, cross-location overlap, deactivation and immutable location history. `npm run db:test` passed all 184 pgTAP assertions after the rehearsal cleanup restored the exact fixture counts; `npm run db:lint` reported no schema errors.
- `npm run lint`, `npm run typecheck`, `npm run format:check` and `git diff --check` passed.
- The fully configured local `npm run build` passed, followed by `npm run test:e2e` with 28/28 desktop/mobile browser tests. An earlier configuration-free browser run passed 22 public-shell tests, skipped 2 configured-authorization tests and correctly failed closed for 4 database-backed discovery expectations; it is not counted as final evidence.
- Visual review of `coach-availability-desktop.png`, `coach-availability-mobile.png` and `coach-public-schedule.png` confirmed two distinct text-plus-color cell assignments, readable selector/legend layout, actual venue rows and no horizontal overflow.

| Criterion | Evidence                                                                                                                                                        | Result |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Authenticated two-location selector/assignment rehearsal; text-plus-color cells and legend; full accessible cell actions; component coverage                    | Passed |
| AC2       | Pure immutable helper tests and browser keep/move/remove flow; zero per-cell POST requests; unresolved-decision save guard                                      | Passed |
| AC3       | One POST per explicit save; real concurrent deactivation returns bounded conflict with draft retained; 37 database tests cover stale/overlap/atomic replacement | Passed |
| AC4       | Two actual occurrence/public venue assertions; component Schedule/Bookings privacy boundary and occupied-status coverage                                        | Passed |
| AC5       | Keyboard focus, desktop/mobile visual and overflow review, 28 browser tests, 100 unit/server tests, lint, type, format and production build                     | Passed |

## Risks, limitations, and follow-ups

The six-color palette can repeat when a coach has many locations, but visible/full accessible names remain authoritative and valid data is never capped. A very large active-location list may eventually benefit from search or legend collapsing. Conflicts deliberately remain bounded, so the coach must refresh to learn whether rules, location metadata or active state changed. Travel feasibility between adjacent venues, arbitrary durations and cross-timezone editing remain out of scope.

## Completion and review references

- Completed: 2026-10-10 — all five acceptance criteria and the required responsive, database, browser and build validation passed.
- Commit: This commit — `[DEV0179] Add location-aware schedule editing`.
- Review: Self-review against the ticket scope and acceptance matrix completed; no independent review or pull request created.
- Deployment or release: Not deployed or released.
