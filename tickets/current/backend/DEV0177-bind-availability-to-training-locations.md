# Ticket DEV0177: Bind availability to training locations

- Status: Draft
- Created: 2026-10-09
- Last updated: 2026-10-09
- Milestone: Scheduling-only multi-location follow-up
- Coordination: [COR0014 — Multi-location coach scheduling](../organisatory/COR0014-multi-location-coach-scheduling.md)
- Related records: depends on completed [DEV0175 — Adopt the multi-location coach scheduling contract](../../archive/organisatory/DEV0175-adopt-multi-location-coach-scheduling-contract.md) and [DEV0176 — Persist coach training locations](DEV0176-persist-coach-training-locations.md); supplies [DEV0179 — Edit a location-aware working week](../frontend/DEV0179-edit-location-aware-working-week.md) and [DEV0180 — Pin coaches at primary locations](../frontend/DEV0180-pin-coaches-at-primary-locations.md); extends recurring availability from [DEV0114](../../archive/backend/DEV0114-persist-recurring-coach-availability.md) and atomic replacement from [DEV0146](../../archive/frontend/DEV0146-save-weekly-schedule-in-one-action.md)

## Objective and context

Make the actual training location an explicit part of every recurring availability rule. Replace the current behavior that copies the coach profile's one location into all generated occurrences. A complete calendar draft must save atomically, reject cross-location time overlaps and materialize each future slot with an immutable snapshot of its assigned location.

Bookings remain bound to capacity-one dated slots. They continue to read the slot snapshot, so changing the primary profile location or later editing/deactivating a training location cannot move an existing booked session.

## Scope and non-goals

- In scope: add owned training-location identity to recurring rules and new dated slots; migrate active existing rules to the backfilled primary; extend validation/repository/service/action contracts with location assignments; replace complete rule sets atomically with optimistic concurrency; update occurrence synchronization to snapshot the assigned location; coordinate safe deactivation consequences; preserve global per-coach overlap protection and booking projections; database/domain/server tests.
- Out of scope: location/profile controls (DEV0178), calendar presentation (DEV0179), primary marker presentation (DEV0180), different duration per rule, per-cell database writes, travel-time buffers, cross-timezone recurring interpretation, classes/waitlists or changing booking capacity.

## Expected behavior and edge cases

- A rule key includes one owned active `locationId`, weekday and local start time. Missing, inactive, cross-run or cross-coach locations fail closed.
- Saving a complete requested assignment compares the expected baseline and either replaces the active rule set plus synchronizes occurrences once or changes nothing.
- Two rules cannot produce overlapping active occurrences for the same coach even when their locations differ. The existing per-coach exclusion constraint remains authoritative.
- Existing active rules migrate to the coach's backfilled primary location. Existing dated slot snapshots and bookings keep their historical venue data.
- New occurrences copy the assigned location's name/label, gym reference, coordinates, provider provenance, confirmation time and coach scheduling timezone into immutable slot fields.
- Changing the coach's primary location never changes rule assignments. Editing a location affects only future generation under the contract-approved refresh semantics and never moves a booked occurrence.
- Deactivating a location atomically removes its active rules and withdraws its eligible future open occurrences; booked/held/terminal occurrences and bookings remain intact.
- A repeated identical save is idempotent. A stale baseline, concurrent location change or occurrence overlap returns a conflict without a partial schedule.

## Assumptions, decisions, and dependencies

- DEV0176 supplies stable owner-scoped location IDs, active/primary state and projections.
- Preserve one coach scheduling timezone. The location assignment selects venue, not a separate rule timezone in this delivery.
- Proposed wire shape is a bounded array of `{ locationId, isoWeekday, localStartTime }` objects rather than delimiter-dependent strings. Exact serialization may change only if domain validation remains explicit and this ticket is updated first.
- The current maximum complete rule count may remain bounded by the non-overlapping one-hour weekly grid; document and test the chosen limit instead of multiplying it by location count.
- `coach_location_id` on historical slots may remain nullable when a trustworthy lineage cannot be reconstructed. All new recurring rules and generated occurrences require non-null lineage while retaining full snapshots.
- Booking authorization and lifecycle do not depend on the location row remaining active; the slot snapshot is authoritative after publication.

## Implementation plan

1. Add location foreign keys/indexes to recurring rules and new-slot lineage with an additive migration and safe backfill.
2. Extend domain inputs, rule keys, mappings and owner workspace projections with location identity.
3. Replace the authorized complete-rule-set function with structured location-aware validation, optimistic comparison, global overlap protection and one synchronization pass.
4. Join each active rule to its owned active location during occurrence generation and write the immutable snapshot.
5. Integrate location deactivation with rule removal/open-slot withdrawal while preserving booked and historical data.
6. Update public/owner/booking projections only where location identity or today status is needed; retain bounded privacy.
7. Add migration, RLS, concurrent-save, cross-location overlap, deactivation, daylight-saving and booking-history tests.

## Acceptance criteria

- [ ] AC1: Every active recurring rule references exactly one active location owned by the same coach, and existing rules migrate to the preserved primary location.
- [ ] AC2: One explicit complete save atomically applies all location/time assignments or none; identical retry is idempotent and stale/concurrent input conflicts safely.
- [ ] AC3: Generated occurrences carry immutable actual-location snapshots, while primary/location edits and deactivation never move booked or terminal sessions.
- [ ] AC4: Per-coach time overlap remains impossible across different locations and unauthorized location IDs reveal no data or mutation capability.
- [ ] AC5: Database, domain and server tests cover migration, synchronization, deactivation, concurrency, timezone/DST and unchanged booking lifecycle behavior.

## Validation plan

Run fresh and upgrade migrations, all coach availability/recurrence/booking database suites, focused domain/server tests, lint, type checking and builds. Rehearse two-location rule saving, stale retry, cross-location overlap, location deactivation with open and booked occurrences, cancellation/reopening, completion and reload. Verify every booking continues to display the actual slot snapshot after primary and location metadata changes.

## Implementation record

Pending implementation.

### Changes and rationale

Pending implementation.

### Affected files

| File or component                                   | Change and purpose                                                  |
| --------------------------------------------------- | ------------------------------------------------------------------- |
| `supabase/migrations/`                              | Planned rule/slot lineage, synchronization and lifecycle migration. |
| `src/domain/coaches.ts`                             | Planned location-aware rule input, keys and projections.            |
| `src/server/db/coaches/availability-repository.ts`  | Planned structured atomic replacement and mappings.                 |
| `src/server/coaches/service.ts` and coach actions   | Planned owner authorization and save contract.                      |
| Availability/booking database and application tests | Planned concurrency, history and regression evidence.               |

### Decisions and deviations

None yet.

### Contracts, configuration, and operations

Planned schema and server-action payload changes require an additive database migration and coordinated frontend update. No new environment variable or third-party dependency is expected.

## Validation results

Pending validation.

| Criterion | Evidence                                   | Result  |
| --------- | ------------------------------------------ | ------- |
| AC1       | Migration/ownership tests                  | Not run |
| AC2       | Atomic save/idempotency/stale tests        | Not run |
| AC3       | Snapshot/deactivation/history tests        | Not run |
| AC4       | Cross-location overlap/authorization tests | Not run |
| AC5       | Database/application command matrix        | Not run |

## Risks, limitations, and follow-ups

Location metadata updates and rule synchronization can race. Mutations must lock a stable coach/location boundary and fail atomically. Historical rows without trustworthy lineage must keep their snapshots rather than being assigned to an incorrect current location.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: No review created.
- Deployment or release: Not deployed.
