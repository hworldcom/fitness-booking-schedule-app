# Ticket DEV0396: Avoid repeated time-zone catalog scans

- Status: Completed
- Created: 2026-10-20
- Last updated: 2026-10-20
- Milestone: M3 public discovery performance maintenance
- Coordination: None — independent development ticket
- Related records: Profiling dependency: [DEV0368](../../current/backend/DEV0368-investigate-public-availability-read-latency.md). Downstream cache-policy decision: [DEV0393](../../current/backend/DEV0393-control-public-directory-cache-freshness.md). Existing scheduling behavior is defined by the specification links below.

## Objective and context

The user requested continuing the next performance improvement after DEV0392. DEV0393's safe-cache investigation reproduced a 7-second directory call with six coaches in a disposable local copy. DEV0368 function-level profiling attributes 4,389 of 4,454 ms in a tracked availability statement to 160 calls of `app.coach_local_time_is_unambiguous`. Its first condition enumerates `pg_timezone_names` on every call before checking daylight-saving gaps/overlaps. JIT on/off samples did not remove the delay; the catalog enumeration is the measured target.

Reduce that redundant validation for the application's Europe/Berlin and retained UTC scheduling paths while preserving [effective availability](../../../docs/mvp-spec.md#18-coach-calendar-and-effective-availability), [typed booking](../../../docs/mvp-spec.md#186-session-types-and-flexible-bookings), [data integrity](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity) and [failure invariants](../../../docs/mvp-spec.md#10-security-and-failure-invariants). This is a query-cost repair, not shared caching or a permission to serve stale schedules.

## Scope and non-goals

- In scope: one additive migration replacing the existing time-validation helper with an explicit known-zone validity branch for exact `Europe/Berlin`/`UTC`, keeping the general catalog lookup for other zone names and retaining the existing round-trip/overlap checks. Focused daylight-saving/compatibility regressions, fresh/upgrade rehearsal, retained-row preservation, comparable before/after measurements and operating guidance.
- Out of scope: caching directory/schedule results, narrowing the existing timezone API, changing accepted booking hours/horizon/durations, rewriting synchronization or authorization, changing retained accounts or seeds, new providers/dependencies and unrelated connection pooling. Hosted rollout is separate from local completion.

## Expected behavior and edge cases

Berlin spring-gap and fall-overlap local times remain invalid; ordinary Berlin times and UTC remain valid. Null/unknown zone inputs and unsupported spellings retain their previous behavior. Other recognized zones keep the prior catalog-backed validation, including their gaps and non-hour overlaps. Source table contents, function identity/owner/privileges/stability/search path and transaction-local scheduling authority remain preserved. Invalid times are never accepted for speed. No successful/error result is persisted between requests.

## Assumptions, decisions, and dependencies

- The user authorizes the next performance work; this bounded repair follows the measured prerequisite to DEV0393 rather than adding an unproven data-cache lifetime.
- Adopt an explicit SQL `CASE` for the two known valid zone identifiers; continue to use PostgreSQL's current timezone rules for the actual conversions and ambiguity checks. Keep the original catalog fallback for every other name. Avoid an unconditional `OR` whose evaluation order is not a contract.
- Local PostgreSQL is 17.6. Inspect its official conditional/timezone documentation and the exact installed function before editing. Berlin and UTC are existing supported product/retained values, not a new list of all permitted zones.
- Do not edit the immutable baseline/history. Use migration `20261020000200_fast_scheduling_timezone_validation.sql`. Replacing the same signature preserves callers; verify metadata/privileges after fresh and upgrade paths.
- Disposable scratch databases may contain copied/synthetic data for measurement/tests and are removed exactly. Retained local/UAT/production records and schema are not migrated or reset by the rehearsal.

## Implementation plan

1. Record the function/profile baseline and a bounded expected-result matrix covering known/fallback zones, DST boundaries and invalid/null values.
2. Add the replacement-function migration with known-zone validity branching and unchanged ambiguity calculations. Add focused behavior tests; explicitly pass wall-clock inputs as text before the timestamp cast so the database, rather than the JavaScript driver's Date serializer, interprets them. Extend the existing request-origin test's strict loopback scratch-name guard to this rehearsal's exact DEV0396 prefix so it executes rather than skipping.
3. Add a local-only scratch-database rehearsal for fresh/current upgrades, before/after outputs and all app/Auth-user/Storage row hashes, function contracts and relevant existing scheduling/booking regressions. Refuse retained targets and remove only created scratch databases.
4. Repeat identical populated-directory/service and helper measurements before/after, reporting query/cache/environment conditions and limits. Test migration failure/rollback semantics through the database rehearsal where relevant; do not use time-based assertions in ordinary correctness tests.
5. Run relevant tests, lint, type checks, production build and documentation/link review in an isolated source snapshot (DEV0371). Record local versus any hosted proof explicitly. Archive only after all acceptance criteria pass.

## Acceptance criteria

- [x] AC1: Known-zone directory/helper measurements show a substantial reduction in the repeated work with comparable before/after data and fresh connections.
- [x] AC2: Focused DST/null/unknown/fallback-zone behavior and actual scheduling/booking regressions pass; no stale data or weaker authorization is introduced.
- [x] AC3: Fresh and upgrade migration paths preserve all retained row hashes and function identity/owner/privileges/configuration except the intended body change; scratch cleanup is exact.
- [x] AC4: Relevant tests, lint, typecheck, production build and documentation links pass; the record states actual deployment/commit status and remaining limits.

## Validation plan

Run a database-owned expected-result matrix (Berlin spring/fall edges, ordinary/fractional times, UTC, fallback New York/Lord Howe/Kathmandu, null/unknown names), compare pre/post outputs and existing effective/typed/legacy/request-booking tests in fresh and upgrade scratch databases. Compare all app/Auth-user/Storage table fingerprints across the migration before product tests run. Compare function OID/metadata within upgrades and schema contract after fresh creation. Compare fresh-client full-directory and helper query timings with the same six-coach clone and current database clock. Run `npm test`, `npm run lint`, `npm run typecheck` and `NEXT_TELEMETRY_DISABLED=1 npm run build -- --webpack` in an isolated source snapshot. No interface changes are planned, so new visual layout/keyboard checks are not applicable; public-service results and scheduling regressions provide the affected-flow evidence. Never claim empty UAT represents populated performance.

## Implementation record

### Changes and rationale

2026-10-20: Added a forward migration that keeps the same stable, invoker-rights SQL function and all existing ambiguity calculations. An explicit `CASE` recognizes exact `Europe/Berlin`/`UTC` as already valid names; every other name still uses the existing catalog lookup. PostgreSQL's conversions and the full ±180-minute overlap search remain unchanged. No directory result, timezone offset or eligibility decision is cached.

The source database and application JavaScript are unchanged. The repair reduces repeated reference-catalog work inside normal fresh synchronization, so bookings, visibility and availability retain their current database checks. No specification behavior or API/data shape changes; the existing product contract is preserved.

### Affected files

| File                                                                                                                                                     | Change and purpose                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Forward migration](../../../supabase/migrations/20261020000200_fast_scheduling_timezone_validation.sql)                                                 | Replaces only the validation helper body; retains general-zone fallback and all DST calculations.                                                                                                                                                               |
| [Focused database test](../../../tests/database/coach-local-time.test.ts)                                                                                | 24 explicit expected outcomes at Berlin spring/fall boundaries, fractional times, UTC, New York, Lord Howe, Kathmandu and invalid/null inputs.                                                                                                                  |
| [Database rehearsal](../../../scripts/rehearse-scheduling-timezone-database.mjs)                                                                         | Creates/removes only owned local scratch databases; compares 149 before/after outcomes, all row hashes/function metadata and actual scheduling/booking behavior for fresh/upgrade paths. Upgrade includes a synthetic claimed identity as well as seed coaches. |
| [Request-origin regression](../../../tests/database/request-booking-rescheduling.test.ts)                                                                | Permits the exact DEV0396 scratch-name pattern in addition to DEV0388; existing loopback/port restrictions and test assertions remain intact.                                                                                                                   |
| [Database guide](../../../supabase/README.md#scheduling-time-zone-validation-performance), [index](../../README.md)                                      | Describe the migration, local rehearsal, rollback and separate hosted rollout.                                                                                                                                                                                  |
| [DEV0368](../../current/backend/DEV0368-investigate-public-availability-read-latency.md), [DEV0393](../../current/backend/DEV0393-control-public-directory-cache-freshness.md) | Record attribution and the distinction between this repair and still-unselected shared caching.                                                                                                                                                                 |

### Decisions and deviations

2026-10-20: Prioritize the measured time-validation cost before persistent public-data reuse. No JIT tuning is adopted because controlled on/off samples remained slow. The first focused test run exposed a harness issue: Postgres.js serialized timestamp-typed string parameters through the host timezone before sending them. An explicit text-then-timestamp cast preserves the intended wall clock; direct before/after SQL already matched 149 cases. The request-origin test initially skipped because its guard accepted only DEV0388 scratch names; add the equally bounded DEV0396 names, preserving its port/loopback checks.

### Contracts, configuration, and operations

Same SQL function signature and supported zones; no new environment variables, dependencies, tables or data fields. Rollback is restoring the preceding function body from the immutable baseline in a reviewed forward operation, preserving identity/owner/ACLs. Deploying JavaScript alone does not apply this database migration. Hosted rollout is not included in local completion.

## Validation results

- Environment: Node 24.21.0, installed dependencies, local PostgreSQL 17.6. Inspected the actual stored helper, immutable migration definition, and official PostgreSQL 17 [conditional expressions](https://www.postgresql.org/docs/17/functions-conditional.html) / [timezone-name view](https://www.postgresql.org/docs/17/view-pg-timezone-names.html) documentation before editing. `CASE` keeps the fallback catalog work outside the known-zone path; timezone offsets are never hardcoded.
- Controlled six-coach comparison: `DEV0393_PROFILE_TEMPLATE=work/dev0396/compare-directory.ts DEV0393_REPORT_NAME=controlled-directory-comparison.json DEV0393_LOG_NAME=controlled-directory-comparison.log DEV0396_MIGRATION=/Users/hoangdeveloper/fitness-booking-schedule-app/supabase/migrations/20261020000200_fast_scheduling_timezone_validation.sql node work/dev0393/profile-read-paths.mjs`. The ignored helper created one exact local copy and source snapshot, called the actual complete directory service three times with fresh repository clients, applied only this migration in that copy, then called it three more times. The same application code, filters, PostgreSQL instance, dataset and statement-clock rules apply. No other validation job was running. Results below are service durations, not hosted-page/browser timings.

| Sample | Before total ms | After total ms | Before availability query ms | After availability query ms |
| ------ | --------------: | -------------: | ---------------------------: | --------------------------: |
| 1      |       9,416.001 |        151.387 |                    9,054.225 |                      63.410 |
| 2      |       8,450.098 |         88.822 |                    8,350.007 |                      55.703 |
| 3      |       4,589.274 |         94.471 |                    4,536.809 |                      56.387 |

Median complete service **8,450.098 → 94.471 ms (98.9% lower)**. All six calls returned ready with six entries and identical serialized response SHA-256 `dc9fca42aeb4f0e1086e4905f6b349952eff6f14b74625d34a487c581c38074c`. Cache policy did not change; every call performed the live directory/synchronization/path/card/review reads. The before distribution varies materially, so do not turn this local median into a universal speedup. The earlier exploratory after-only run overlapped validation and showed about 95–104 ms; the dedicated comparison above is the accepted paired evidence.

- `node scripts/rehearse-scheduling-timezone-database.mjs` passed fresh and upgrade paths: **149 identical pre/post results per path**, unchanged app/Auth-user/Storage hashes across migration, identical function OID/metadata except its intended body, and **29 database tests per path / 58 total**, zero failures/skips. The upgrade fixture includes a newly claimed synthetic Auth/profile/dataset identity before migration. Existing behavior covers effective hours/date overrides/DST/horizon, venue and booking snapshots, owner/outsider permissions, concurrent acceptance/override races, full-duration typed requests and accepted-request rescheduling/message history. Both exact scratch databases were removed, and all 57 retained local table hashes matched. The earlier passing run was repeated after adding the claimed-identity preservation fixture to cover that upgrade state explicitly. Its final mixed-zone matrix timings were fresh 4,263.5 → 365.9 ms and upgrade 4,219.5 → 367.7 ms; fallback-zone catalog checks intentionally remain in those matrices.
- The first focused run failed because a timestamp-typed Postgres.js parameter serialized the test string through the host timezone; a read-only comparison proved literal SQL was unchanged and the explicit text-to-timestamp test input fixed the harness. The same initial run skipped the request-origin test due to its old scratch-name guard; the bounded extension now executes it. No DST expectation was relaxed and no product failure was concealed.
- Isolated-source commands with Node 24.21.0 explicitly on PATH: `npm test` passed **363 unit + 68 server = 431**, zero failures/skips; `npm run lint`, `npm run typecheck`, and `NEXT_TELEMETRY_DISABLED=1 npm run build -- --webpack` passed. Snapshot isolation excludes ignored evidence copies under DEV0371 without changing lint/type rules. After the final synthetic-fixture-only script edit, `prettier` and focused `eslint` passed again and the database rehearsal was repeated; no application source changed after the successful build.
- `node scripts/database-baseline.mjs verify` passed all **53 archived migration checksums and the baseline checksum**. Original migration history is unchanged. No interface changes apply, so new visual/mobile/keyboard checks are not required; existing scheduling regressions and complete public-response equality validate the changed flow. No hosted benchmark, migration or JavaScript rollout was performed.
- Final documentary/source review: Prettier and `git diff --check` passed; Python validated 470 local file/anchor references in eight affected documents, matching work-record statuses and index placement, next DEV0397/COR0034 identifiers, and matching validated migration/test/script inputs. Required incoming archive links were repaired without changing historical outcomes. No retained or hosted schema/data was migrated. The user-requested commit checkpoints below record this follow-up; no push or deployment was performed.

| Criterion | Evidence                                                                                                               | Result |
| --------- | ---------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Controlled full-service comparison, live queries on both sides, identical six-entry response hashes                    | Passed |
| AC2       | 24 focused outcomes, 149 pre/post cases per path and 58 scheduling/booking checks                                      | Passed |
| AC3       | Fresh/upgrade row and function-contract equality, claimed upgrade identity, retained 57-table hashes and exact cleanup | Passed |
| AC4       | 431 tests, lint/types/build, immutable history verification and final link/source review; local-only status explicit   | Passed |

## Risks, limitations, and follow-ups

Fallback zones retain their existing catalog cost. Database timezone rules still determine actual conversions. A changed timezone-name validity list or simplified DST test would exceed this scope. DEV0393's shared-cache policy remains separate; no cache duration is selected here.

## Completion and review references

- Completed: 2026-10-20 — local implementation, all acceptance criteria and full validation passed; hosted rollout remains separate.
- Commit: Completion checkpoint `[DEV0396] Optimize scheduling timezone validation` (resolve the unique subject in Git history). The preceding image checkpoint is `9ac07c3`.
- Review: Self-reviewed the one-function migration, unchanged DST math, bounded test-target guard, exact cleanup, recorded measurements and all acceptance criteria; no independent review.
- Deployment or release: Not performed; retained local and hosted schemas remain untouched.
