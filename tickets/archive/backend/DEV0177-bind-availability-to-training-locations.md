# Ticket DEV0177: Bind availability to training locations

- Status: Completed
- Created: 2026-10-09
- Last updated: 2026-10-10
- Milestone: Scheduling-only multi-location follow-up
- Coordination: [COR0014 — Multi-location coach scheduling](../../current/organisatory/COR0014-multi-location-coach-scheduling.md)
- Related records: depends on completed [DEV0175 — Adopt the multi-location coach scheduling contract](../organisatory/DEV0175-adopt-multi-location-coach-scheduling-contract.md) and [DEV0176 — Persist coach training locations](DEV0176-persist-coach-training-locations.md); supplies completed [DEV0179 — Edit a location-aware working week](../frontend/DEV0179-edit-location-aware-working-week.md) and current [DEV0180 — Pin coaches at primary locations](../../current/frontend/DEV0180-pin-coaches-at-primary-locations.md); extends recurring availability from [DEV0114](DEV0114-persist-recurring-coach-availability.md) and atomic replacement from [DEV0146](../frontend/DEV0146-save-weekly-schedule-in-one-action.md)

## Objective and context

Make the actual training location an explicit part of every recurring availability rule. Replace the current behavior that copies the coach profile's one location into all generated occurrences. A complete calendar draft must save atomically, reject cross-location time overlaps and materialize each future slot with an immutable snapshot of its assigned location.

Bookings remain bound to capacity-one dated slots. They continue to read the slot snapshot, so changing the primary profile location or later editing/deactivating a training location cannot move an existing booked session.

## Scope and non-goals

- In scope: add owned training-location identity to recurring rules and new dated slots; migrate active existing rules to the backfilled primary; extend validation/repository/service/action contracts with versioned location assignments; replace complete rule sets atomically with optimistic concurrency; update occurrence synchronization to snapshot the assigned location; coordinate safe deactivation consequences; preserve global per-coach overlap protection and booking projections; keep the current single-location calendar operational through a narrow primary-location compatibility adapter until DEV0179; database/domain/server tests.
- Out of scope: location/profile controls (DEV0178), calendar presentation (DEV0179), primary marker presentation (DEV0180), different duration per rule, per-cell database writes, travel-time buffers, cross-timezone recurring interpretation, classes/waitlists or changing booking capacity.

## Expected behavior and edge cases

- A rule key includes one owned active `locationId`, weekday and local start time. Missing, inactive, cross-run or cross-coach locations fail closed.
- Saving a complete requested assignment compares the expected location-aware rule baseline and the exact opaque version of every referenced location, then either replaces the active rule set plus synchronizes occurrences once or changes nothing.
- Two rules cannot produce overlapping active occurrences for the same coach even when their locations differ. The existing per-coach exclusion constraint remains authoritative.
- Existing active rules migrate to the coach's backfilled primary location. Existing dated slot snapshots and bookings keep their historical venue data.
- New occurrences copy the assigned location's name/label, gym reference, coordinates, provider provenance, confirmation time and coach scheduling timezone into immutable slot fields.
- Changing the coach's primary location never changes rule assignments. Editing a location affects only future generation under the contract-approved refresh semantics and never moves a booked occurrence.
- Deactivating a location atomically removes its active rules and withdraws its eligible future open occurrences; booked/held/terminal occurrences and bookings remain intact.
- A repeated identical save is idempotent. A stale baseline, concurrent location change or occurrence overlap returns a conflict without a partial schedule.
- Until DEV0179 adds the visible location selector, the existing calendar preserves each loaded rule's location and assigns newly selected cells to the current primary location. It must not silently move an existing secondary assignment to primary.

## Assumptions, decisions, and dependencies

- DEV0176 supplies stable owner-scoped location IDs, active/primary state and projections.
- Preserve one coach scheduling timezone. The location assignment selects venue, not a separate rule timezone in this delivery.
- The adopted save wire shape is a JSON array of `{ locationId, locationUpdatedAt, isoWeekday, localStartTime }` objects for both the requested set and expected baseline. `locationUpdatedAt` is the exact PostgreSQL timestamp string exposed by DEV0176 and is treated as an opaque optimistic-concurrency token; it is not part of logical rule identity.
- A logical rule identity is `{ locationId, isoWeekday, localStartTime }`, while the unique calendar cell remains `{ isoWeekday, localStartTime }`. Assigning the same cell to two locations is invalid rather than two non-overlapping rules.
- Each requested or expected set is limited to 161 entries (7 weekdays multiplied by 23 valid one-hour starts) and 32 KiB of serialized JSON. Location count does not increase the cell limit. UUIDs, exact version tokens, weekdays and whole-hour times are validated explicitly before database access.
- Rule replacement and location update/deactivation use the same coach-scoped advisory lock before locking location and rule rows in stable identifier order. A location edit committed before the save is detected by its version token; an edit serialized after a successful save does not rewrite the already materialized occurrence snapshot.
- `coach_location_id` on historical slots may remain nullable when a trustworthy lineage cannot be reconstructed. All new recurring rules and generated occurrences require non-null lineage while retaining full snapshots.
- Booking authorization and lifecycle do not depend on the location row remaining active; the slot snapshot is authoritative after publication.
- DEV0177 may make the minimum client serialization adjustment needed to keep the existing calendar functional, but selectable-location controls, color/text presentation and multi-location editing behavior remain exclusively DEV0179 scope.

## Implementation plan

1. Add location foreign keys/indexes to recurring rules and new-slot lineage with an additive migration and safe backfill.
2. Extend domain inputs, rule keys, mappings and owner workspace projections with location identity plus the location's exact concurrency token; preserve a separate weekday/time cell key for the grid.
3. Replace the authorized complete-rule-set function with structured location-aware validation, 161-entry/32 KiB bounds, optimistic rule-and-location comparison, a common coach lock, global overlap protection and one synchronization pass.
4. Join each active rule to its owned active location during occurrence generation and write the immutable snapshot.
5. Integrate location deactivation with rule removal/open-slot withdrawal while preserving booked and historical data.
6. Update public/owner/booking projections only where location identity or today status is needed; retain bounded privacy. Adapt the current grid serialization so loaded assignments are preserved and new cells use primary until DEV0179 replaces that temporary behavior.
7. Add migration, RLS, payload-boundary, concurrent-save/location-edit, cross-location overlap, deactivation, daylight-saving, compatibility-grid and booking-history tests.

## Acceptance criteria

- [x] AC1: Every active recurring rule references exactly one active location owned by the same coach, and existing rules migrate to the preserved primary location.
- [x] AC2: One explicit complete save atomically applies all versioned location/time assignments or none; identical retry is idempotent and stale rule or location input conflicts safely within the 161-entry/32 KiB bounds.
- [x] AC3: Generated occurrences carry immutable actual-location snapshots, while primary/location edits and deactivation never move booked or terminal sessions.
- [x] AC4: Per-coach time overlap remains impossible across different locations and unauthorized location IDs reveal no data or mutation capability.
- [x] AC5: Database, domain, server and focused compatibility tests cover migration, bounded structured input, synchronization, deactivation, concurrent location edits, timezone/DST, the existing grid transition and unchanged booking lifecycle behavior.

## Validation plan

Run fresh and upgrade migrations, all coach availability/recurrence/booking database suites, focused domain/server tests, lint, type checking and builds. Rehearse two-location rule saving, maximum/oversized payloads, stale rule and stale location retries, a location edit racing a save, cross-location overlap, location deactivation with open and booked occurrences, cancellation/reopening, completion and reload. Verify every booking continues to display the actual slot snapshot after primary and location metadata changes, and verify the current calendar can add/remove/save/reload primary-backed cells without erasing a pre-existing secondary assignment.

## Implementation record

Completed on 2026-10-10. Recurring availability now carries an owned training-location assignment from the browser boundary through atomic database replacement and future occurrence generation. Existing active rules were backfilled to their coach's preserved primary location, while historical slots keep their prior snapshots and receive location lineage only when the migration can prove an exact match.

### Changes and rationale

- Added same-owner location lineage to recurring rules and dated slots. Active rules require a confirmed active location in the coach's scheduling timezone; generated occurrences copy that location's stable ID, public name and complete provider-neutral snapshot.
- Replaced string rule keys with bounded structured requested/expected JSON. A save accepts at most 161 unique weekday/time cells and 32 KiB, compares the exact current location-aware baseline and each referenced location's opaque `updated_at` token, then removes/adds rules and synchronizes once inside one transaction.
- Made schedule replacement, location metadata updates, primary changes and deactivation use the same coach-scoped advisory lock. A concurrent edit therefore has a serial result: the save either commits before the edit with an immutable old snapshot or returns a stale conflict after the edit; it cannot publish a mixed draft.
- Preserved the global per-coach occurrence exclusion constraint. The payload and active-rule uniqueness also reject assigning one weekday/time cell to two locations before occurrence generation.
- Extended location deactivation to retire its active rules and withdraw future open occurrences while leaving held/booked/history rows unchanged. Cancelling a booking tied to a removed or inactive rule withdraws its old occurrence and lets a current rule generate its own replacement rather than reopening obsolete inventory.
- On a coach timezone change, active rules are retired and recreated with new lineage IDs in the new timezone. This permits fresh occurrences for the same local date without rewriting or colliding with historical occurrence snapshots.
- Extended owner/public availability and private booking projections with training-location identity and immutable display name. Legacy/manual slots may retain nullable lineage, with their existing gym name or public label used as the bounded display-name fallback.
- Kept the pre-DEV0179 working-week grid operational: loaded secondary assignments remain attached to their locations, while newly toggled cells use the current primary location and one explicit Save remains the only database mutation.

### Affected files

| File or component | Change and purpose |
| --- | --- |
| `supabase/migrations/20261010000100_bind_availability_to_training_locations.sql` | Adds/backfills rule and slot lineage, immutable names, active-location enforcement, shared mutation locking, structured atomic replacement, assigned-location synchronization, timezone regeneration, deactivation/cancellation behavior and booking projection fields. |
| `src/server/db/schema/coaches.ts` | Mirrors the additive rule/slot columns, owner-scoped foreign keys, checks and lookup indexes in Drizzle. |
| `src/domain/coaches.ts` | Defines location-aware rule/snapshot shapes and validates exact four-field assignments, unique cells, UUIDs, version tokens, hour bounds, 161 entries and 32 KiB. |
| `src/server/db/coaches/availability-repository.ts` | Reads location identity/version, sends structured requested/expected sets and maps immutable occurrence names/lineage. The single-rule compatibility path now honors its requested location and exact version. |
| `src/domain/coach-bookings.ts` and `src/server/db/coaches/booking-repository.ts` | Carry the actual slot location ID and immutable name into coach/client booking views. |
| `src/features/coaches/coach-availability-panel.tsx` | Preserves loaded location assignments in the current grid, assigns new cells to primary and displays snapshot names without adding DEV0179's visible selector. |
| `src/features/coaches/coach-marketplace.tsx` and `src/features/profile/client-sessions.tsx` | Display the occurrence/booking's actual immutable location name rather than inferring a generic independent-place label. |
| `supabase/tests/database/*.test.sql` | Updates schema counts/signatures and adds 12 assertions for lineage, keys, triggers, grants, backfill and booking output. |
| `tests/coaches.test.ts`, `tests/coach-schedule.test.ts`, `tests/coach-bookings.test.ts` and `tests/database/coach-availability.test.ts` | Cover bounded structured input, secondary-assignment preservation, location-aware projections, stale/unauthorized IDs, immutable snapshots, primary changes, concurrency, deactivation, timezone/DST and overlap behavior. |

### Decisions and deviations

- The original plan described `coach_location_id`; the delivered schema uses `coach_training_location_id` consistently with DEV0176's entity name.
- The existing single-rule function remains as a compatibility surface, but its signature now includes `locationId` and `locationUpdatedAt`; silently falling back to primary would violate the caller's typed contract.
- Location update and primary-selection functions are wrapped behind private DEV0176 implementations so the shared schedule lock is acquired before any location row lock. This avoids opposite lock ordering without duplicating the already-tested lifecycle logic.
- Timezone changes create replacement rule IDs rather than updating active rules in place. The existing unique `(rule, local date)` occurrence lineage intentionally remains immutable, so retiring/recreating rules is the safe way to preserve the old row and materialize the new timezone occurrence.
- No visible multi-location selector or cell legend was added. That presentation and interaction remains exclusively DEV0179; this ticket supplies and tests its stable data/save boundary.

### Contracts, configuration, and operations

- Apply the forward migration before application code sends structured rule assignments. `app.create_owned_coach_availability_rule` changes from `(smallint, time)` to `(uuid, timestamptz, smallint, time)`, and `app.replace_owned_coach_availability_rules` retains its two-JSON-argument signature but now requires arrays of `{locationId, locationUpdatedAt, isoWeekday, localStartTime}` objects rather than string keys.
- `app.current_direct_private_bookings()` adds `coach_training_location_id` and `training_location_name`. TypeScript availability and booking snapshots add `trainingLocationId` and `name`; owner rules add `locationId` and exact `locationUpdatedAt`.
- Rule lineage is non-null for active rules and all newly generated recurring slots. Slot lineage remains nullable for historical or explicit inventory whose source cannot be proven; full historical snapshot columns remain authoritative.
- The migration is forward-only in practice after location-aware rules are saved. Rollback should use a reviewed forward fix so new assignments and booking history are not discarded.
- No environment variable, dependency, provider setting or external service changed.

## Validation results

All required checks passed on 2026-10-10 against local Supabase. The database was first reset through DEV0176 and the DEV0177 migration was applied separately to prove the upgrade path; a separate full reset proved the fresh path. The final reset removed local Auth rows, so the ordinary `hoang@users.movx.test` account and all five reserved coach accounts were provisioned again successfully.

| Criterion | Evidence | Result |
| --- | --- | --- |
| AC1 | Fresh and upgrade migration replays; 184 pgTAP assertions including same-owner foreign keys, active-rule backfill and active-location trigger; owner projections in `test:db`. | Passed |
| AC2 | Domain tests reject duplicate cells, malformed shapes, 162 entries and over-32-KiB input; integration tests pass identical retry, stale baseline, stale location and concurrent save/location-edit cases without partial state. | Passed |
| AC3 | Integration tests prove primary and metadata edits do not rewrite snapshots, timezone regeneration preserves old rows, deactivation withdraws open rows and keeps a booked row, and booking projections expose the actual immutable name/ID. | Passed |
| AC4 | Domain/database duplicate-cell checks, the retained per-coach exclusion constraint, explicit-inventory overlap test and cross-owner/inactive location conflict tests passed. | Passed |
| AC5 | `npm run db:test` (184 assertions), `npm run test:db` (37 tests), `npm test` (89 unit/component tests plus 2 server tests), `npm run lint`, `npm run typecheck`, `npm run db:lint`, `npm run format:check`, `git diff --check` and `npm run build` all passed. The component render test exercises all 161 keyboard controls and proves a loaded secondary assignment/version survives serialization. | Passed |

The build emitted only the existing warning that the interactive shell was using Node 20 while the repository declares Node 24; TypeScript compilation and static generation completed. Provisioning was deliberately run with Node 24.21.0. A separate desktop/mobile browser selector rehearsal is not applicable to this backend/compatibility slice because it adds no new responsive layout or selector; DEV0179 owns that visible interaction and its viewport evidence.

## Risks, limitations, and follow-ups

- Historical and one-off slots can legitimately have `trainingLocationId = null`; consumers must continue treating the immutable snapshot as authoritative.
- Metadata edits do not proactively replace already materialized open occurrences. They affect later materialization, while timezone changes explicitly retire/regenerate open recurring inventory. This preserves the confirmed no-retroactive-move contract.
- The temporary current-grid adapter supports continuity only. Coaches cannot yet choose or visually distinguish multiple locations in the calendar; DEV0179 owns that responsive selector, text/color legend and interaction rehearsal. DEV0178 owns location lifecycle controls, and DEV0180 owns primary-marker/today presentation.

## Completion and review references

- Completed: 2026-10-10.
- Commit: Not created.
- Review: No review created.
- Deployment or release: Not deployed.
