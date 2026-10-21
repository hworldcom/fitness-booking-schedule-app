# Ticket DEV0402: Prune private time candidates

- Status: Completed
- Created: 2026-10-21
- Last updated: 2026-10-21
- Milestone: M10 UAT booking recovery
- Coordination: [COR0034](../organisatory/COR0034-repair-weekly-availability-performance.md)
- Related records: Diagnosis [DEV0401](../../archive/backend/DEV0401-investigate-slow-empty-week-availability.md); external SQL dependency [DEV0396](../../archive/backend/DEV0396-avoid-repeated-timezone-catalog-scans.md). Peer ownership and release order are mapped in COR0034.

## Objective and context

Reduce empty/populated typed availability work while preserving the current results. DEV0401 measured a real empty week at 30,689 ms. Follow the [weekly booking contract](../../../docs/mvp-spec.md#196-cards-username-urls-and-scheduling-compatibility), [duration-aware availability](../../../docs/mvp-spec.md#186-session-types-and-flexible-bookings) and retained-data boundary. The user authorized this repair on 2026-10-21.

## Scope and non-goals

- In scope: additive SQL migration driven by actual effective hours/venue; retain existing full-fit checks/order/lock/visibility; bound weekly SQL statements; scratch fresh/upgrade equivalence, cancellation and row/function-contract checks.
- Out of scope: client timeout, hosted rollout, data/cache/scheduling policy changes, historical migration edits.

## Expected behavior and edge cases

No configured hours produces zero candidates immediately. Adjacent hours, gaps, different venues, 60/75/90-minute classes, DST, overrides, conflicts, disabled/hidden/own-coach boundaries and result ordering stay authoritative. Weekly SQL execution has an 8-second statement budget and 1-second lock wait; failures propagate as unavailable, never empty.

## Assumptions, decisions, and dependencies

- Exact SQL fast-branch dependency DEV0396 remains locally delivered. New migration is `20261021000100_prune_private_session_time_candidates.sql`; no schema/table shape change.
- Installed Next.js 16.3.8; inspect bundled route-handler docs and installed Postgres.js transaction API before edits.
- Use one reviewable backend slice; the existing slot-fit function keeps authority. No new cached eligibility result or hardcoded timezone offset.
- Apply no retained database migration during local rehearsal.

## Implementation plan

1. Inspect actual SQL/installed database driver and bundled Next docs; preserve original function contract.
2. Add next forward migration replacing only public daily candidate enumeration with distinct actual-hours quarter-hour starts and unchanged full-fit checks. Add scoped weekly transaction statement/lock budgets.
3. Add a disposable rehearsal/reference-function comparison and regression tests including empty/populated/multi-venue/duration/DST, retained-row/function identity preservation and lock cancellation.
4. Run relevant/full tests, canonical lint/types/build, migration history check, record results and archive only after local acceptance.

## Acceptance criteria

- [x] AC1: Empty days avoid whole-day candidate enumeration; original/new results agree for meaningful populated/empty cases.
- [x] AC2: Function owner/identity/ACL/security/configuration and rows remain unchanged across fresh/upgrade migration; existing scheduling/concurrency regressions pass.
- [x] AC3: Weekly SQL/lock budgets fail closed and close connections; relevant tests/static/build and durable records pass.

## Validation plan

Use isolated local scratch databases only, preserving before/after retained-local fingerprints. Save the original public function as a scratch-only reference and compare results and timed calls before/after. Run duration/availability/request regressions, server boundary tests and canonical app lint/types/build. No UI change here; visual QA belongs to DEV0403. No hosted migration here.

## Implementation record

### Changes and affected files

Added [forward migration](../../../supabase/migrations/20261021000100_prune_private_session_time_candidates.sql). `app.public_session_type_times` now obtains the selected venue's effective Berlin hours once, produces distinct quarter-hour candidates inside those hours, retains the original day boundary/order, and calls unchanged `typed_session_fits` for full-duration/clock/venue/conflict eligibility. No configured hours means no calls to fit validation. Visibility and the same transaction advisory lock remain. Existing `jit=off`, security-definer, empty search path, volatility, owner, OID, ACL and signature are preserved. Current effective hours are aligned to the supported hour grid, matching the existing guest-preview candidate construction.

[Weekly repository](../../../src/server/db/coaches/typed-session-repository.ts) now uses a transaction with `SET LOCAL statement_timeout='8s'` and `lock_timeout='1s'` before its database clock/availability reads. Errors still propagate to the existing unavailable/no-store API boundary. The ordinary-public connection remains separate from the caller's actor transaction, preventing owner overrides. Connection setup retains the existing driver's connection timeout; the 15-second visible deadline is DEV0403, not a promise that Auth/connect time is part of the eight-second SQL limit.

[New database rehearsal](../../../scripts/rehearse-session-week-database.mjs) creates only exact `dev0342_<tag>_dev0402_fresh|upgrade` loopback databases. It preserves retained-local fingerprints, installs all prior migrations plus a scratch-only original reference function, and validates the new forward migration's unchanged rows and function metadata. [Typed regressions](../../../tests/database/typed-sessions.test.ts) compare real results over thirty dates/DST, 60/75/90-minute offerings, unavailable venues, empty weeks and subsequent booking states. A real held advisory lock proves timeout and cleanup. [Rescheduling guard](../../../tests/database/request-booking-rescheduling.test.ts) permits only this additional exact scratch namespace; [server tests](../../../tests/server/session-week.test.ts) use the transaction boundary and still reject incomplete/malformed reads. [README](../../../README.md#session-type-validation) documents the actual command.

### Decisions, failures and contracts

PostgreSQL 17 [CREATE FUNCTION](https://www.postgresql.org/docs/17/sql-createfunction.html) and [statement/lock timeout](https://www.postgresql.org/docs/17/runtime-config-client.html) docs and installed Postgres.js transaction docs were inspected. A first SQL rehearsal caught missing parentheses around `AT TIME ZONE` in a BETWEEN bound. The metadata comparison then caught that the original function's later `jit=off` setting must be explicitly preserved by replacement. The scratch reference builder initially collapsed `$$` through JavaScript replacement semantics; using a replacement callback fixes it. Test probes also required an explicit integer date-offset cast and checking Drizzle's nested PostgreSQL lock-timeout code. All corrections were local; every failed scratch run cleaned itself and preserved retained rows. Final validation passed without relaxing result/permission criteria.

No API/data shape, dependencies, env variables or booking policy change. New migration must follow DEV0396 on retained/UAT installations; DEV0404 owns that rollout. Rollback is a reviewed forward restoration of the former public function body/settings and repository source; no row rollback. No retained database was migrated here.


## Validation results

2026-10-21, Node 24.21.0 / local PostgreSQL 17.6:

- `node scripts/rehearse-session-week-database.mjs`: **68 tests passed** (34 fresh + 34 upgrade), zero failures/skips. Both paths preserve all pre-migration app/Auth-user/Storage row hashes and full public-function metadata except intended body. Each path checks 60 original/new seed reads over thirty dates (120 total, including upcoming Berlin DST), empty week equivalence, 60/75/90-minute/wrong-venue equivalence, accepted-overlap exclusion and existing availability/DST/concurrent decision/rescheduling regressions. Held advisory lock triggers nested code `55P03`, with connection closure and subsequent tests working. Exact scratch databases removed; retained-local hashes unchanged. Logs: ignored `work/dev0402/database.log`.
- Empty-week diagnostic includes connection/transaction overhead: fresh optimized 368.7 ms versus reference 253.5 ms; upgrade optimized 39.9 ms versus reference 195.6 ms. These local samples already have DEV0396 installed and are not the UAT 30.7-second comparison or a universal speedup. Hosted timing belongs to DEV0404.
- `npm test`: **438 passed** (367 app/domain + 71 server), zero failures/skips, including weekly API privacy/whole-response validation and cleanup.
- Canonical source snapshot `npm run lint`, `npm run typecheck`, `NEXT_TELEMETRY_DISABLED=1 npm run build -- --webpack`: passed. After final database-test/harness corrections, canonical lint/typecheck and `node scripts/database-baseline.mjs verify` passed again (53 historical checksums plus baseline). Temporary snapshots removed. Canonical checks exclude ignored historical work copies under existing DEV0371 without changing repo rules. Evidence: `work/dev0403/canonical-*`, `final-*`, `app-tests.log`.
- No interface is changed by this backend ticket; desktop/phone proof belongs to DEV0403. Final link/index/diff review passed before archival.


## Risks, limitations, and follow-ups

Local acceptance is complete. Hosted rollout remains DEV0404; no independent review. No retained or production operation was performed by this ticket. Deadlines cannot turn unavailable reads into verified empty schedules.

## Completion and review references

- Completed: 2026-10-21 — local acceptance and required validation passed.
- Commit: Recorded with the implementation on `work/weekly-availability-repair`, as authorized by the user on 2026-10-21; subject `[DEV0402] Prune private availability candidates and bound SQL waits`.
- Review: Source/evidence/acceptance self-review passed; no independent review.
- Deployment or release: Owned by DEV0404; local completion is not deployment.
