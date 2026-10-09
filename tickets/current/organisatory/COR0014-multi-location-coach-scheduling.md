# Coordination COR0014: Multi-location coach scheduling

- Status: In progress
- Created: 2026-10-09
- Last updated: 2026-10-10
- Milestone: Scheduling-only multi-location follow-up
- Converted from: Not applicable — created as a coordination record
- Tracked development tickets: completed [DEV0175 — Adopt the multi-location coach scheduling contract](../../archive/organisatory/DEV0175-adopt-multi-location-coach-scheduling-contract.md), [DEV0176 — Persist coach training locations](../../archive/backend/DEV0176-persist-coach-training-locations.md) and [DEV0177 — Bind availability to training locations](../../archive/backend/DEV0177-bind-availability-to-training-locations.md); current [DEV0178 — Manage coach training locations](../frontend/DEV0178-manage-coach-training-locations.md), [DEV0179 — Edit a location-aware working week](../frontend/DEV0179-edit-location-aware-working-week.md) and [DEV0180 — Pin coaches at primary locations](../frontend/DEV0180-pin-coaches-at-primary-locations.md)
- Related records: location-provider baseline [DEV0174 — Decouple location services](../../archive/frontend/DEV0174-decouple-location-services.md); atomic weekly-save baseline [DEV0146 — Save weekly schedule in one action](../../archive/frontend/DEV0146-save-weekly-schedule-in-one-action.md); scheduling-only contract [DEV0140 — Adopt the scheduling-only contract](../../archive/organisatory/DEV0140-adopt-scheduling-only-contract.md); downstream native consumers [COR0013 — Native iOS application](COR0013-native-ios-application.md)

## Objective and boundaries

Coordinate the change from one profile-level coach location to multiple coach-owned training locations. A coach selects exactly one active primary location for the always-present public Explore marker and assigns every recurring calendar hour to the actual location where that session is offered. Dated occurrences and bookings retain immutable actual-location snapshots; the primary map location is a public training base and never live tracking.

The initial delivery retains one coach scheduling timezone, the current rolling availability horizon and capacity-one direct bookings. It does not add travel-time calculation, cross-timezone calendar editing, date selection on Explore, a global point-of-interest catalogue, classes, waitlists, payments or mobile runtime work.

This record owns sequencing, boundaries and final integration evidence only. It does not authorize or implement runtime behavior.

## Direct development work

| Implementation part         | Development ticket                                                                                                                                   | Owned deliverable                                                                                                                                              | Start condition or dependency                                                      |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Product contract            | [DEV0175 — Adopt the multi-location coach scheduling contract](../../archive/organisatory/DEV0175-adopt-multi-location-coach-scheduling-contract.md) | Update the specification and affected downstream planning with confirmed multi-location, primary-marker and location-bound availability behavior.              | Completed 2026-10-09.                                                              |
| Location persistence        | [DEV0176 — Persist coach training locations](../../archive/backend/DEV0176-persist-coach-training-locations.md)                                      | Add owner-scoped training-location storage, lifecycle mutations, primary invariants, singleton backfill and multi-location service projections.                | Completed 2026-10-09 after DEV0175.                                                |
| Location-bound availability | [DEV0177 — Bind availability to training locations](../../archive/backend/DEV0177-bind-availability-to-training-locations.md)                        | Bind recurring rules to owned active locations, generate immutable actual-location occurrences and preserve booking/history/concurrency invariants.            | Completed 2026-10-10 after DEV0175 and DEV0176.                                   |
| Profile location interface  | [DEV0178 — Manage coach training locations](../frontend/DEV0178-manage-coach-training-locations.md)                                                  | Add coach and public profile interfaces for adding, editing, ordering, selecting a primary location and safely deactivating locations.                         | After DEV0176 exposes stable mutations/projections; may proceed alongside DEV0177. |
| Location-aware calendar     | [DEV0179 — Edit a location-aware working week](../frontend/DEV0179-edit-location-aware-working-week.md)                                              | Let coaches use a selected-location paint control, inspect assigned cells and save one complete location-aware draft without per-cell mutations.               | After DEV0177; integrates DEV0178's active locations.                              |
| Primary-location discovery  | [DEV0180 — Pin coaches at primary locations](../frontend/DEV0180-pin-coaches-at-primary-locations.md)                                                | Keep every visible coach on Explore at one primary marker regardless of today's availability while presenting truthful today status and actual session venues. | After DEV0176 and DEV0177; may proceed alongside DEV0179.                          |

All required implementation parts have direct development tickets. The tickets are flat peers under this coordination record; their dependency order does not create a child-ticket hierarchy.

## Other relationships

- DEV0174 supplies provider-neutral location search/rendering. COR0014 persists and presents domain data through that boundary but does not make MapLibre, OpenFreeMap or Geoapify authoritative for scheduling.
- DEV0146 supplies the local-draft/explicit-save interaction and optimistic concurrency baseline. DEV0179 extends it rather than reintroducing per-cell writes.
- COR0013 and its DEV0160/DEV0162/DEV0163/DEV0164 members are downstream consumers. They retain their existing COR0013 membership and do not block this web coordination unless DEV0175 explicitly changes the native coordination completion boundary.
- The shared `app.gyms` table remains an optional reviewed reference. Coach-owned provider snapshots do not create a global gym/point-of-interest catalogue under this coordination.

## Delivery sequence and completion conditions

1. Complete DEV0175 first so the distinction between primary discovery location and actual scheduled location becomes authoritative.
2. Complete DEV0176 to add the location entity, primary invariant, safe lifecycle and backward-compatible backfill.
3. Complete DEV0177 against that foundation. Its occurrence synchronization and atomic rule replacement must pass before location-aware calendar or today-status interfaces rely on them.
4. DEV0178 may begin after DEV0176 and proceed alongside DEV0177. DEV0179 waits for both the active-location projection and rule contract.
5. DEV0180 may proceed after DEV0176/DEV0177 and can integrate independently of DEV0179's interface polish.
6. Complete this coordination only when all six direct tickets are Completed or explicitly cancelled/replaced, links and statuses agree, existing coaches retain a primary marker, location assignments survive reload, overlapping cross-location time is rejected, bookings retain actual venue snapshots, map/list fallbacks remain usable and the integrated responsive browser/database suites pass.

## Progress and integration record

- 2026-10-09: The user confirmed multiple gyms, location-bound weekly hours and a location selector that assigns draft calendar cells before explicit save.
- 2026-10-09: The user replaced availability-driven marker placement with one coach-selected primary marker that remains present whenever the coach is otherwise publicly visible.
- 2026-10-09: Created the flat DEV0175-DEV0180 work map. DEV0175 was the first Ready implementation record; dependency-bound peers remained Draft.
- 2026-10-09: DEV0175 completed and was archived after adopting decisions C16-C18, reconciling the full scheduling contract and aligning downstream native planning. Runtime remains unchanged; DEV0176 is the next delivery step when authorized.
- 2026-10-09: DEV0176 completed and was archived after adding/backfilling owner-scoped locations, primary and timezone invariants, authorized lifecycle mutations and public/owner projections. DEV0177 and DEV0178 may now start under their recorded dependency boundaries.
- 2026-10-09: Reviewed DEV0177 against the delivered location and recurring-availability contracts and moved it to Ready. The review fixed the save boundary as versioned structured JSON with a 161-cell/32 KiB limit, required a shared coach lock for location/schedule races and added a narrow compatibility adapter so the current calendar remains usable until DEV0179.
- 2026-10-10: DEV0177 implementation started against the completed DEV0176 location contract.
- 2026-10-10: DEV0177 completed and was archived after binding versioned owned locations to rules, snapshots and booking projections; serializing location-edit/save races; preserving booked history during metadata, primary, timezone and deactivation changes; and keeping the current grid compatible until DEV0179.

## Validation results

- Planning validation completed on 2026-10-09: Prettier accepted all eight changed planning files; a targeted checker validated every relative link; a repository-wide heading check found 125 unique work-record IDs and confirmed reciprocal COR0014 membership for DEV0175-DEV0180; `git diff --check` passed.
- DEV0175 integration validation completed on 2026-10-09: formatting and 16 affected-document links passed; eight explicit contract assertions covered decisions C16-C18, primary-versus-actual location, one timezone, deactivation/history and acceptance behavior; the lifecycle check confirmed archived DEV0175 and this In-progress handoff. Runtime tests remain owned by DEV0176-DEV0180.
- Application, database and browser tests were not run for the planning records or DEV0175 documentation contract because neither changes runtime behavior. DEV0176-DEV0180 own later implementation and validation evidence.
- DEV0176 integration validation completed on 2026-10-09: upgrade and fresh migrations passed with five exact backfill matches; 172 pgTAP assertions, 35 database integration tests, database lint, application lint/type checks, 91 unit/server tests and the production build passed. DEV0177-DEV0180 still own location-bound availability and browser-interface evidence.
- DEV0177 integration validation completed on 2026-10-10: fresh and upgrade migrations, 184 pgTAP assertions, 37 database integration tests, database lint, 91 unit/server tests, application lint/type/format checks, compatibility rendering and the production build passed. DEV0178-DEV0180 still own the management, selector and primary-discovery interfaces plus responsive browser evidence.
- Coordination completion requires reciprocal membership/link checks plus the integrated database, service, browser, responsive and build evidence owned by the direct tickets.

## Risks, limitations, and follow-ups

- The primary marker can be mistaken for today's venue. Copy, accessibility names and data contracts must label it as the primary training location and separately identify actual availability venues.
- A location may be referenced by open, booked or terminal occurrences. Lifecycle operations must use deactivation and immutable snapshots rather than destructive cascades.
- Backward compatibility spans profile, recurring-rule, slot and booking projections. The migration must be additive and tested against the existing local dataset before legacy singleton fields are removed.
- Cross-timezone recurrence and travel buffers remain out of scope. They require a later contract if product needs expand.

## Completion and review references

- Completed: Not completed.
- Direct development tickets: DEV0175-DEV0177 Completed; DEV0178-DEV0180 remain Draft.
- Commit: Not applicable — coordination-record IDs are not used in commit subjects.
- Review: No integration review created.
- Deployment or release: Not deployed or released.
