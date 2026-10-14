# Ticket DEV0231: Correct pgTAP runtime assumptions

- Status: Completed
- Created: 2026-10-14
- Last updated: 2026-10-14
- Milestone: Database validation maintenance
- Coordination: None — independent development ticket
- Related records: validation consumer [DEV0221](DEV0221-persist-coach-athlete-connections.md); multi-location baseline [COR0014](../organisatory/COR0014-multi-location-coach-scheduling.md)

## Objective and context

Correct the existing SQL test suite so it verifies the [current scheduling contract](../../../docs/mvp-spec.md#9-scheduling-behavior-and-permissions) on a retained local dataset. DEV0221 validation exposed nine failures across five older files: a fixed app-table count, global availability/discipline/location counts, a colliding invalid-gym fixture order and a requirement that every active recurring rule use the primary location. The current contract permits saved fixture edits, multiple coach locations and rules assigned to any active owned location. New connection tables also legitimately extend the app schema.

## Scope and non-goals

- In scope: focused SQL assertions in foundation, coach-profile, coach-availability, training-location and location-aware scheduling tests; deterministic fixture scoping and stronger ownership/lineage invariants.
- Out of scope: runtime/schema/seed changes, resetting user data, changing coach disciplines/locations, permission relaxation or branch migration-history repair.

## Expected behavior and edge cases

- Required known application tables must exist; every app table remains owned by app_owner with forced row-level security. Additional preserved migration tables must not invalidate a fixed total.
- Public-read assertions compare the exact fixture IDs or a transaction-local expected authorised set, preserving hidden/out-of-horizon denial and occupied-capacity visibility without exposing private booking detail or counting unrelated saved inventory.
- A coach may retain multiple locations; test one active primary and correct owner/lineage rather than one total location.
- Active rules may use any active owned location with matching timezone; changing the primary marker does not move those rules.
- Invalid-gym tests must reach the foreign-key check without colliding with an unrelated existing ordering key.

## Assumptions, decisions, and dependencies

Use rollback-only pgTAP transactions and preserve all saved records. DEV0221 owns new connection-specific tests; this independent ticket owns corrections to older suite assumptions. No product change is adopted.

## Implementation plan

1. Inspect failed assertions and map each to the current permissions/location contract.
2. Replace brittle totals and primary-only requirements with bounded fixture/ownership assertions; isolate the invalid-gym fixture.
3. Run the complete SQL suite, app-schema lint, diff and documentation checks; record exact evidence.

## Acceptance criteria

- [x] AC1: Existing public/private read assertions remain meaningful with saved extra availability, disciplines and locations; hidden/invalid/out-of-horizon records still fail.
- [x] AC2: Schema ownership/RLS and active-location lineage are checked without obsolete table totals or primary-only rules.
- [x] AC3: Full pgTAP suite and relevant app-schema lint pass; no runtime/schema/seed or existing user data change is made.

## Validation plan

Run `npm run db:test`, `node_modules/.bin/supabase db lint --local --schema app`, Markdown checks and `git diff --check`. Application/browser/build tests are not needed for SQL-test-only edits; DEV0221 already runs its runtime regressions independently.

## Implementation record

Started 2026-10-14 after reading the five affected SQL files and current specification. Initial full-suite result: 206 tests, nine failures. New DEV0221 connection checks passed.

### Changes and rationale

Replaced the obsolete table total with an explicit required-table set and all-table ownership checks. Availability reads compare exact eligible fixture IDs, including occupied capacity and excluding the out-of-horizon row. Mutable demo provenance/gym choices and public discipline/location results use bounded lineage and independent eligibility snapshots. The invalid-gym fixture picks an unused valid ordering key, and active rules may use any active owned location with matching timezone. No runtime, seed or stored user record was changed.

### Affected files

| File                                                                                                                      | Change and purpose                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [foundation.test.sql](../../../supabase/tests/database/foundation.test.sql)                                               | Required retained objects and ownership invariant rather than fixed table totals.                  |
| [coach-availability.test.sql](../../../supabase/tests/database/coach-availability.test.sql)                               | Exact fixture capacity states and horizon boundary independent of unrelated saved inventory.       |
| [coach-profiles.test.sql](../../../supabase/tests/database/coach-profiles.test.sql)                                       | Mutable demo/gym/discipline data and independently scoped public read expectations.                |
| [coach-training-locations.test.sql](../../../supabase/tests/database/coach-training-locations.test.sql)                   | Multiple retained locations, public eligibility snapshot and a collision-free foreign-key fixture. |
| [location-aware-coach-availability.test.sql](../../../supabase/tests/database/location-aware-coach-availability.test.sql) | Any active owned location with matching timezone; preserve snapshot/lineage checks.                |

### Decisions and deviations

Use the existing contract as authority; never overwrite persisted fixture data to reproduce historical counts.

2026-10-14 refinement before further SQL edits: claimed demo coaches retain `is_demo` while their mutable record source/location choices can become user data. The current public slot policy intentionally exposes occupied capacity states inside seven days; assert the exact eligible fixture IDs rather than expecting open-only raw rows. The first corrected rerun also exposed an erroneous test-query reference to a nonexistent gym visibility column; public dataset visibility belongs to demo_runs. Run the final SQL suite after synthetic HTTP/database fixtures are cleaned to avoid concurrent baseline changes.

### Contracts, configuration, and operations

Test-only change. No API, schema, dependency, environment setting, migration or setup change.

## Validation results

- `npm run db:test`: final result: all 206 checks passed across 11 SQL files. Initial run failed nine checks; an intermediate correction run failed due a nonexistent gym visibility column, mutable demo provenance/location assumptions and a concurrent fixture snapshot; those failures were corrected and the final suite ran after fixture cleanup.
- `node_modules/.bin/supabase db lint --local --schema app`: no schema errors, empty findings.
- SQL diff review retained role mutation denial, forced RLS, current parent/foreign-key constraints, public visibility and out-of-horizon checks. All SQL fixtures remain transactionally rolled back.
- `python3 /tmp/movx-dev0221-check-docs.py --complete` and `git diff --check`: passed for links, index/statuses, record identity and scoped SQL review. Application/browser/build commands are not applicable to these SQL-test-only edits; DEV0221 owns its separate runtime checks.

| Criterion | Evidence                                                                                                 | Result |
| --------- | -------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Exact fixture capacity states, mutable provenance and independent public eligibility snapshots reviewed. | Passed |
| AC2       | Required object set, all-table ownership/RLS and active owned timezone lineage reviewed.                 | Passed |
| AC3       | 206 SQL checks and app-schema lint passed; no runtime/schema/seed edit.                                  | Passed |

## Risks, limitations, and follow-ups

Saved local data may differ from the original seed. Assertions must prove permissions rather than merely compare two identical unrestricted queries. Branch-only migration ledger continuity remains separate work.

## Completion and review references

- Completed: 2026-10-14.
- Commit: Included in `[DEV0221][DEV0231][DEV0232] Add coach-athlete connections and database follow-ups`; grouped with its validation consumer and linked local-workflow plan so the committed records and links remain complete.
- Review: Self-review against all acceptance criteria, scoped source/SQL diff and contract boundaries passed; no independent review created.
- Deployment or release: Not applicable — SQL-test maintenance.
