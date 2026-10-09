# Ticket DEV0176: Persist coach training locations

- Status: Draft
- Created: 2026-10-09
- Last updated: 2026-10-09
- Milestone: Scheduling-only multi-location follow-up
- Coordination: [COR0014 — Multi-location coach scheduling](../organisatory/COR0014-multi-location-coach-scheduling.md)
- Related records: depends on completed [DEV0175 — Adopt the multi-location coach scheduling contract](../../archive/organisatory/DEV0175-adopt-multi-location-coach-scheduling-contract.md); supplies [DEV0177 — Bind availability to training locations](DEV0177-bind-availability-to-training-locations.md), [DEV0178 — Manage coach training locations](../frontend/DEV0178-manage-coach-training-locations.md) and [DEV0180 — Pin coaches at primary locations](../frontend/DEV0180-pin-coaches-at-primary-locations.md); preserves the provider-neutral baseline from [DEV0174](../../archive/frontend/DEV0174-decouple-location-services.md)

## Objective and context

Replace the singleton location stored directly on each coach profile with an owner-scoped collection of confirmed training locations. Preserve every existing coach by migrating the current location into one active primary record, expose bounded public and owner projections, and enforce that a visible coach has exactly one active primary location.

The location entity represents a gym or independent training place chosen for a coach profile. It may reference a reviewed `app.gyms` row or contain a provider-neutral snapshot; it is not a global point-of-interest record and grants no gym or account authority.

## Scope and non-goals

- In scope: PostgreSQL/Drizzle schema and additive migration for coach training locations; owner/public row-level security; primary, active/inactive, provenance, coordinate, ordering and same-run constraints; backfill from every current coach profile; authorized create/update/set-primary/deactivate primitives; multi-location domain/repository/service projections; publication validation; focused database and server tests.
- Out of scope: attaching availability rules or occurrence generation to locations (DEV0177), profile/calendar/map controls (DEV0178-DEV0180), global Geoapify result persistence, hard deletion of referenced locations, cross-timezone calendar behavior or removing immutable location snapshots from slots/bookings.

## Expected behavior and edge cases

- Every existing coach receives one active primary training-location row with the same kind, gym reference, label, coordinates, source/provider, confirmation timestamp and scheduling timezone as the current profile.
- A coach owner may create or update only locations under their own run/profile through bounded server mutations; direct browser table mutation and cross-coach identifiers fail closed.
- At most one active location is primary through a database constraint. Authorized profile publication requires exactly one confirmed active primary location.
- Setting a new primary demotes the previous primary atomically. The operation cannot leave two primaries or a visible coach without one.
- A primary location cannot be deactivated without selecting a valid replacement in the same authorized operation.
- Referenced locations are soft-deactivated. Public projections omit inactive locations, while owner/history paths retain the bounded records required by downstream scheduling.
- A gym reference must belong to the same run and remain location-only; independent/provider snapshots retain validated provider provenance and coordinates.
- Database or stale-state failure returns a conflict/unavailable outcome and does not partially update the location set.

## Assumptions, decisions, and dependencies

- DEV0175 must complete before implementation so schema names and publication semantics follow the adopted contract.
- Proposed table name: `app.coach_training_locations`. The implementation may choose another clear name only after updating this ticket and the contract references before code changes.
- Proposed fields include stable UUID identity, run/profile owner, kind, optional reviewed gym reference, public name/label, coordinates, source/provider, confirmation time, timezone, status, primary flag, sort order and audit timestamps.
- Reuse the existing profile-management security-definer pattern and actor context; do not expose privileged database credentials or trust client-supplied ownership.
- Keep legacy singleton profile fields through the additive transition if DEV0177-DEV0180 still require compatibility. Final removal belongs to this ticket only if all consumers migrate safely in the same delivery; otherwise create a cleanup follow-up.
- The first release uses the coach scheduling timezone for all owned locations. A stored location timezone may be retained for future display/provenance, but it must not silently change rule interpretation.

## Implementation plan

1. Add the training-location table, constraints, indexes, triggers, row-level policies and Drizzle mirror.
2. Backfill one primary active row for each current coach and verify data/provenance equivalence.
3. Add owner-scoped security-definer mutations for create/update, primary replacement and safe deactivation with optimistic/stale protection where needed.
4. Add public and owner repository projections and update coach domain/service contracts to return locations plus `primaryLocationId` without leaking private drafts.
5. Update profile publication checks from singleton columns to the active-primary invariant while maintaining a safe additive deployment path.
6. Add migration, authorization, constraint, mapping and rollback/compatibility tests.

## Acceptance criteria

- [ ] AC1: An additive migration gives every existing coach one equivalent active primary training location without losing location provenance or visibility.
- [ ] AC2: Authorized owners can manage multiple locations and atomically change primary; cross-owner, invalid, stale and direct-table mutations fail without partial state.
- [ ] AC3: A visible coach has exactly one confirmed active primary location, and the primary cannot be deactivated without a valid replacement.
- [ ] AC4: Public projections expose only active confirmed locations while owner/history paths preserve required inactive references and no gym association grants authority.
- [ ] AC5: Database and server tests prove constraints, row-level authorization, backfill compatibility and provider-neutral mapping.

## Validation plan

Apply migrations to a fresh local database and an upgraded database containing the current fixtures/accounts. Run database suites for coach profiles/foundation plus new training-location tests, server/domain tests, lint, type checking and the relevant build. Inspect backfilled records against the prior singleton columns and rehearse owner, unrelated actor, hidden/draft, primary replacement and deactivation failure paths. Record rollback/forward-fix behavior for the additive migration.

## Implementation record

Pending implementation.

### Changes and rationale

Pending implementation.

### Affected files

| File or component                                            | Change and purpose                                                   |
| ------------------------------------------------------------ | -------------------------------------------------------------------- |
| `supabase/migrations/`                                       | Planned additive location schema, backfill and authorized lifecycle. |
| `src/server/db/schema/coaches.ts`                            | Planned Drizzle model and constraints.                               |
| `src/domain/coaches.ts`                                      | Planned multi-location coach projections and validation.             |
| `src/server/db/coaches/` and `src/server/coaches/service.ts` | Planned owner/public location queries and mutations.                 |
| `supabase/tests/database/` and `tests/`                      | Planned migration, authorization and mapping evidence.               |

### Decisions and deviations

None yet.

### Contracts, configuration, and operations

Planned PostgreSQL and TypeScript contract changes are additive first. No new environment variable or external provider dependency is expected. Exact migration/rollback requirements must be recorded during implementation.

## Validation results

Pending validation.

| Criterion | Evidence                                    | Result  |
| --------- | ------------------------------------------- | ------- |
| AC1       | Fresh/upgrade migration and data comparison | Not run |
| AC2       | Owner/cross-owner/stale mutation tests      | Not run |
| AC3       | Primary/publication constraint tests        | Not run |
| AC4       | Public/owner projection and authority tests | Not run |
| AC5       | Database/server command matrix              | Not run |

## Risks, limitations, and follow-ups

Historical slot snapshots may differ from the coach's current singleton profile location. This ticket must not falsely attach those historical rows to the backfilled primary; DEV0177 owns safe rule/slot lineage migration. Keep the transition additive until all readers stop assuming one profile location.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: No review created.
- Deployment or release: Not deployed.
