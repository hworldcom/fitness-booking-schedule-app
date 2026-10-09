# Ticket DEV0176: Persist coach training locations

- Status: Completed
- Created: 2026-10-09
- Last updated: 2026-10-09
- Milestone: Scheduling-only multi-location follow-up
- Coordination: [COR0014 — Multi-location coach scheduling](../../current/organisatory/COR0014-multi-location-coach-scheduling.md)
- Related records: depends on completed [DEV0175 — Adopt the multi-location coach scheduling contract](../organisatory/DEV0175-adopt-multi-location-coach-scheduling-contract.md); supplies [DEV0177 — Bind availability to training locations](../../current/backend/DEV0177-bind-availability-to-training-locations.md), [DEV0178 — Manage coach training locations](../../current/frontend/DEV0178-manage-coach-training-locations.md) and [DEV0180 — Pin coaches at primary locations](../../current/frontend/DEV0180-pin-coaches-at-primary-locations.md); preserves the provider-neutral baseline from [DEV0174](../frontend/DEV0174-decouple-location-services.md)

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

- [x] AC1: An additive migration gives every existing coach one equivalent active primary training location without losing location provenance or visibility.
- [x] AC2: Authorized owners can manage multiple locations and atomically change primary; cross-owner, invalid, stale and direct-table mutations fail without partial state.
- [x] AC3: A visible coach has exactly one confirmed active primary location, and the primary cannot be deactivated without a valid replacement.
- [x] AC4: Public projections expose only active confirmed locations while owner/history paths preserve required inactive references and no gym association grants authority.
- [x] AC5: Database and server tests prove constraints, row-level authorization, backfill compatibility and provider-neutral mapping.

## Validation plan

Apply migrations to a fresh local database and an upgraded database containing the current fixtures/accounts. Run database suites for coach profiles/foundation plus new training-location tests, server/domain tests, lint, type checking and the relevant build. Inspect backfilled records against the prior singleton columns and rehearse owner, unrelated actor, hidden/draft, primary replacement and deactivation failure paths. Record rollback/forward-fix behavior for the additive migration.

## Implementation record

The application now persists a bounded collection of confirmed training locations for every coach. The migration backfills the existing singleton snapshot as one active primary row, public and owner projections expose the appropriate active/history subsets, and owner-only database functions provide create, update, primary replacement and soft-deactivation operations with exact optimistic concurrency tokens. The current profile editor remains compatible because its legacy singleton fields are synchronized with the primary row in both directions.

### Changes and rationale

- Added `app.coach_training_locations` with stable UUID identity, same-run coach/gym references, provider-neutral location snapshots, single-timezone enforcement, active/inactive lifecycle, deterministic order, audit data and partial uniqueness for one active primary and one active reference to a reviewed gym.
- Backfilled all five existing coaches. The upgraded local database comparison found five coach profiles, five location rows and five exact matches across timezone, gym reference, kind, label, coordinates, source/provider and confirmation timestamp.
- Added forced row-level security (RLS): public runtime reads only active confirmed locations belonging to an otherwise public coach, owners retain their own inactive history, and the runtime has no direct table write privilege. Gym references remain labels/coordinates and add no authority.
- Added security-definer create/update/set-primary/deactivate functions. They bind ownership to verified actor context, lock the affected set, reject stale `updated_at` tokens, atomically demote/promote primary rows and require a valid replacement when deactivating the primary.
- Added deferred visible-primary validation plus a same-timezone trigger. A visible coach cannot commit without exactly one confirmed active primary, while every location remains on the coach's single scheduling timezone.
- Extended coach projections with `locations` and `primaryLocationId`. Public reads receive active confirmed rows only; owner reads include inactive rows. Existing `selectedGymId`, `gymName` and `location` fields are compatibility aliases derived from the primary row.
- Added domain validation and service/repository primitives for the future DEV0178 interface without adding a browser mutation surface in this ticket.

### Affected files

| File or component                                                           | Change and purpose                                                                                                                                      |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/20261009000100_create_coach_training_locations.sql`    | Creates/backfills the location entity, RLS and lifecycle functions; enforces primary, timezone and legacy-snapshot compatibility.                       |
| `src/server/db/schema/coaches.ts`                                           | Mirrors the complete table, foreign keys, checks, unique indexes and lookup indexes in Drizzle.                                                         |
| `src/domain/coaches.ts`                                                     | Adds provider-neutral location inputs, validation, owner/public location projections and primary identity.                                              |
| `src/server/db/coaches/repository.ts` and `src/server/coaches/service.ts`   | Maps RLS-filtered location sets, derives legacy aliases from primary and exposes bounded owner lifecycle operations.                                    |
| `supabase/tests/database/coach-training-locations.test.sql`                 | Proves the backfill, schema, RLS, grants, constraints, indexes and public visibility boundary with pgTAP.                                               |
| `tests/database/coaches.test.ts` and coach domain/presentation fixtures     | Proves owner/cross-owner/stale mutation behavior, atomic primary/deactivation flows, public versus owner projections and the additive TypeScript shape. |
| `supabase/tests/database/coach-profiles.test.sql` and `foundation.test.sql` | Updates the authoritative table count and profile source-of-truth description for the additive schema.                                                  |

### Decisions and deviations

- Adopt `app.coach_training_locations` as the stable owner-scoped location table. Each row stores a provider-neutral public name and location snapshot, optional same-run gym reference, the coach scheduling timezone, active/inactive state, primary state, stable ordering and audit timestamps.
- Keep the legacy singleton columns on `app.coach_profiles` during COR0014. The existing profile mutation synchronizes those columns into the active primary row so DEV0177-DEV0180 can migrate consumers incrementally without a mixed-version outage.
- Use `updated_at` as the optimistic concurrency token for update, primary replacement and deactivation operations. Primary replacement locks the owner's location set and changes both rows in one database statement boundary.
- Enforce the visible-profile primary invariant with deferred database constraint triggers, allowing the profile and its primary location to be created or changed atomically while rejecting a committed visible state with zero or multiple active primaries.
- Backfill an independent location's public name from its existing public label because the singleton schema did not previously store a separate place name. Gym-backed names come from the reviewed same-run gym row.
- Preserve PostgreSQL's exact timestamp text as the opaque `updated_at` token. Converting it to JavaScript ISO time truncated microseconds and caused freshly read state to be rejected as stale.
- Synchronize a profile timezone change across every owned location. Selecting or editing a location never introduces a second scheduling timezone.

### Contracts, configuration, and operations

The PostgreSQL and TypeScript contracts are additive. New database objects are `app.coach_training_locations`, four public owner lifecycle functions, bounded publication helpers and integrity triggers. `CoachProjection` now requires `primaryLocationId` and `locations`; its prior singleton fields remain as primary-derived compatibility aliases.

No dependency, environment variable, provider credential or setup command changed. Deploy by applying the forward migration before application code that requests the new projection. The migration is not safely reversible after new locations are created; rollback is a forward-fix operation while the retained profile columns provide compatibility for DEV0177-DEV0180.

## Validation results

All required automated validation passed on 2026-10-09 against local Supabase and Next.js 16.3.8.

| Criterion | Evidence                                                                                                                                                                                                                                                                                                                                                                      | Result |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | `npx supabase migration up --local` upgraded the prior local schema; a direct comparison returned 5 profiles, 5 rows and 5 exact primary matches. `npm run db:reset` then replayed every migration and seed from scratch.                                                                                                                                                     | Passed |
| AC2       | `npm run test:db` passed 35 integration tests, including direct-write denial, cross-owner denial, stale update rejection, atomic primary replacement and atomic primary deactivation with replacement.                                                                                                                                                                        | Passed |
| AC3       | `npm run db:test` passed 172 pgTAP assertions across 8 files, including the partial primary uniqueness constraint, deferred visible-primary trigger, function grants and primary deactivation behavior.                                                                                                                                                                       | Passed |
| AC4       | The coach integration suite proved owner projections retain two rows after soft deactivation while the public projection returns only the remaining active primary; same-run gym and provider-neutral checks passed.                                                                                                                                                          | Passed |
| AC5       | `npm run db:lint`, `npm run lint`, `npm run typecheck`, `npm test` (89 domain/application plus 2 server tests), `npm run format:check`, `git diff --check` and `npm run build` all passed. A focused audit resolved 208 local links across 9 changed records; the production build completed all 12 static pages and dynamic routes with only existing Node-version warnings. | Passed |

## Risks, limitations, and follow-ups

Historical slot snapshots intentionally remain unattached to the new primary: DEV0177 owns rule/occurrence lineage and must not infer it from matching coordinates. The legacy singleton columns and primary-derived TypeScript aliases remain until DEV0177-DEV0180 migrate all consumers. No multi-location management UI is included here; DEV0178 owns it.

## Completion and review references

- Completed: 2026-10-09.
- Commit: Not created yet; use DEV0176 in the subject when this completed implementation is committed.
- Review: No review created.
- Deployment or release: Not deployed.
