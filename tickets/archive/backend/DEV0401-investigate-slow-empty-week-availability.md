# Ticket DEV0401: Investigate slow empty-week availability

- Status: Completed
- Created: 2026-10-21
- Last updated: 2026-10-21
- Milestone: M10 UAT booking performance diagnosis
- Coordination: None — independent development ticket
- Related records: Weekly UI/API [DEV0399](../../archive/frontend/DEV0399-implement-seven-day-athlete-booking.md), release [DEV0400](../../archive/organisatory/DEV0400-deploy-seven-day-booking-to-uat.md), locally completed database optimization [DEV0396](../../archive/backend/DEV0396-avoid-repeated-timezone-catalog-scans.md), historical profiling [DEV0368](../../archive/backend/DEV0368-investigate-public-availability-read-latency.md).

## Objective and context

On 2026-10-21 the user reported `Checking the week’s available times…` lingering on https://uat.movx.club/coaches/mas-09e85b618bf9 despite no configured slots. They clarified that data eventually appeared after a few minutes and requested an investigation into the delay. Identify the source using bounded read-only measurements and distinguish cache/state errors from database work. Follow the [weekly booking contract](../../../docs/mvp-spec.md#196-cards-username-urls-and-scheduling-compatibility) and [failure invariants](../../../docs/mvp-spec.md#10-security-and-failure-invariants).

## Scope and non-goals

- In scope: trace weekly client/server/database path, inspect actual guarded hosted-dev helper implementation, time the real empty-day/week query with explicit read-only transactions/deadlines, identify missing rollout and loading-state recovery, record evidence and concrete remedies.
- Out of scope: changing live functions/schema/configuration, applying migrations, live authenticated mutations, test users, retained data edits, committing or deploying new code, implementing general caching or a separate UI redesign.

## Expected behavior and edge cases

A verified empty week must resolve to zero rather than an unknown/loading state. Investigate without treating failed/timed-out reads as empty or exposing private times to guests. Query limits prevent the investigation holding a coach schedule lock indefinitely. Do not attribute end-to-end browser minutes to a database-only timing; report measured and inferred contributions separately.

## Assumptions, decisions, and dependencies

- Confirmed URL/environment and eventual completion come from the user. No fresh real-account authenticated browser session has been inspected.
- Explicit hosted-runtime target guard must select dev; production is out of scope. Use existing restricted runtime credentials without printing values. All diagnostic database calls use `READ ONLY`, a statement deadline and a short advisory-lock wait limit.
- Read-only investigation may precede this record; initial checks confirmed the fast timezone branch is absent, one real future day returns zero in 4,973 ms, and client/API both opt out of caching. No implementation edit occurred.
- A database migration is a separate operational action. DEV0396 was locally validated but DEV0400 expressly excluded migrations; do not silently deploy it during an investigation request.

## Implementation plan

1. Trace cache flags, weekly query fan-out, SQL candidate evaluation order and client pending/error transitions; inspect installed Next.js 16.3.8 route-handler documentation.
2. Verify actual UAT helper body through catalog metadata. Measure one empty day and the complete seven-date query with bounded read-only calls. Inspect pure PostgreSQL execution time for the timezone-name lookup and distinguish it from network/transaction overhead.
3. Record root cause, measured limits, the previously omitted rollout, missing loading deadline and concrete next fixes. Verify links/index/unique ID/whitespace; complete/archive this investigation record. No app/schema change is authorized by this record.

## Acceptance criteria

- [x] AC1: Cache/state/backend causes are evaluated against actual source and guarded UAT metadata.
- [x] AC2: Bounded read-only empty availability and timezone measurements are recorded without overstating user/browser timing or changing retained data.
- [x] AC3: Root cause, deployment gap, recovery limitation and concrete remediation are explained, with accurate scope/status and checked links/index.

## Validation plan

Use source review plus actual dev-only `postgres` calls in read-only transactions, short lock timeout and explicit statement timeouts. Record outputs/counts/timings rather than identities or credentials. Inspect exact cache headers/source and pending-response behavior. Check documentary links/anchors, identifier uniqueness/index and `git diff --check`. Application tests/build and responsive visual checks are not applicable to diagnosis-only documentation because no application, dependency or schema implementation changes.

## Implementation record

### Findings and rationale

This is expensive fresh database work, not an observed stale-cache result. The actual seven-date availability statement on hosted dev returned seven empty arrays in **30,689 ms**. The user's exact authenticated browser interval was not captured, so this measurement proves a roughly 31-second database contribution without claiming to reproduce every minute of their reported end-to-end delay.

The signed-in repository calls `app.public_session_type_times` separately for each of seven dates within one statement. That SQL function generates quarter-hour starts across the whole day (00:00 through 23:00), then calls `app.typed_session_fits` for each candidate. For future candidates, `typed_session_fits` checks start/end timezone ambiguity before checking whether any effective coach hours exist. Even a coach with no working hours therefore pays hundreds of expensive checks. Actual UAT function metadata confirms the previously completed DEV0396 known-zone fast branch is **not installed**. Its original helper repeatedly enumerates `pg_timezone_names`; pure PostgreSQL execution for one name lookup is about 24 ms.

The guest count-only preview uses a different, hours-driven candidate query: no effective hours means no candidates. That explains the fast live guest release smoke versus the slow authenticated read. DEV0399's authenticated fixture/read-shape tests and scratch database regressions passed, but the latter applied the DEV0396 optimization only to scratch databases; they were not timing proof for unchanged UAT SQL. DEV0400 explicitly deployed application source without migrations and checked live guest/privacy flows, not a real authenticated weekly request. The combination of seven sequential day evaluations and the omitted hosted optimization escaped those release checks.

`liveTransport.week` explicitly fetches with `cache: "no-store"`; the API route is force-dynamic and responds `private, no-store` with `Vary: Cookie`. Loading ends only when the promise resolves/rejects. The AbortController cancels a changed/unmounted view but has no elapsed-time deadline. A slow or unresolved read therefore keeps “Checking the week’s available times…” visible; it is not automatically retried or treated as verified zero.

### Affected files and functions reviewed

| File or function | Role and finding |
| --- | --- |
| [Typed booking](../../../src/features/session-types/public-booking.tsx), [day-card states](../../../src/features/coaches/seven-day-schedule.tsx) | Fresh fetch, response fence and loading/empty/error presentation; no elapsed-time loading deadline. |
| [API route](../../../src/app/api/coaches/[slug]/session-types/route.ts), [service](../../../src/server/coaches/typed-session-service.ts), [repository](../../../src/server/db/coaches/typed-session-repository.ts) | Authenticated no-store branch; one bounded statement still evaluates the old daily SQL function seven times. |
| [Typed SQL](../../../supabase/migrations/20261018000800_typed_private_sessions.sql) | Whole-day quarter-hour loop and timezone-before-hours evaluation order; immutable historical source was not edited. |
| [Guest preview](../../../supabase/migrations/20261019000100_private_schedule_preview.sql) | Existing hours-driven candidates avoid the expensive loop for an empty schedule. |
| [Prepared optimization](../../../supabase/migrations/20261020000200_fast_scheduling_timezone_validation.sql) | Existing known-zone repair, locally validated under DEV0396, absent from live UAT helper. |
| This ticket and [index](../../README.md) | Investigation evidence and concrete remediation; no runtime source changes. |

### Decisions and deviations

2026-10-21: Keep the user-requested investigation read-only. Do not apply DEV0396, introduce a new SQL function or deploy a client timeout without an implementation/release scope. Reuse the already guarded hosted-dev runtime connection; no privileged database connection, Auth login, new users or permission grants were needed. An initial direct invocation of the internal timezone helper was correctly denied by its existing execute permissions. Switched to its existing public availability caller plus public catalog/EXPLAIN queries; permissions were preserved.

### Contracts, configuration, and operations

No contracts, environment variables, dependencies, schema/functions, policies, accounts, stored data or hosting settings changed. All database work used explicit read-only transactions with statement timeouts; actual availability reads also set `lock_timeout='500ms'`. The complete weekly diagnostic had a 45-second statement ceiling. Connections closed after each probe. No migration/reset/provisioning/startup command ran. No rollback is needed for this documentation-only diagnosis.

### Concrete remediation

1. Perform a separately recorded, guarded hosted-dev rollout of the existing DEV0396 forward migration, preserving function owner/privileges and retained data. Repeat this exact empty-week measurement before/after; JavaScript/Vercel deployment alone cannot install it.
2. Make the typed daily candidate query start from actual effective hours/venue, following the existing guest preview's approach, while retaining the authoritative full-duration/conflict/clock checks. Empty schedules should not enumerate every quarter-hour of the day. This requires a new forward migration and populated/empty/DST/authorization equivalence regressions, not edits to historical migrations.
3. Bound the availability read's loading time and offer the existing unavailable/Retry state on deadline. Fence late results and preserve the selected class/place; a timeout must never claim zero availability. Set a compatible server/database execution budget so browser cancellation does not leave unbounded database work. Verify the real authenticated UAT path as part of release QA.

These remedies are recommendations and are not implemented or deployed by this investigation.

## Validation results

2026-10-21, Node 24.21.0, guarded hosted-dev transaction-pooler connection with `max:1`, `prepare:false`, TLS and 10-second connection limit. Credentials were loaded from the existing ignored local configuration and never printed.

- Source review: inspected installed Next.js **16.3.8** route-handler documentation and the exact client/service/repository/SQL code linked above. Dynamic/private/no-store behavior and missing elapsed-time deadline are explicit in source.
- Diagnostic command family: `PATH=/Users/hoangdeveloper/.local/node/24.21.0/bin:$PATH node --env-file=.env.development.local --input-type=module`, importing `postgres` and `hostedRuntimeConfiguration(process.env, "dev")`. Each probe uses `db.begin("read only", ...)` and closes the client in `finally`. This target guard rejects the production project/runtime. Probe output contains counts/timings and metadata only, no credentials or private session starts.
- Read-only metadata: `select position('when requested_timezone in' in prosrc)>0 as fast_branch from pg_catalog.pg_proc where oid='app.coach_local_time_is_unambiguous(timestamp,text)'::regprocedure` returned **false**. The actual public catalog contained one bookable private type and one venue. No guessed fixture IDs were passed into availability reads.
- Direct call to the internal helper: denied as expected by its execute privileges. The transaction rolled back and the connection closed. No permission workaround was introduced.
- One real next-day `app.public_session_type_times(slug,type_id,venue_id,date)` invocation, with `statement_timeout='5s'` and `lock_timeout='500ms'`, returned **0 starts in 4,973 ms**. This timing includes transaction/network overhead, not browser/Auth/render time.
- Exact seven-date repository statement, using the actual public type/venue and dates derived from the database Berlin clock, with `statement_timeout='45s'` and `lock_timeout='500ms'`, returned **7 days, counts `[0,0,0,0,0,0,0]`, in 30,689 ms**. The statement was `select to_char(day.date, 'YYYY-MM-DD') as date, app.public_session_type_times($1,$2::uuid,$3::uuid,day.date) as times from (values ($4::date), …, ($10::date)) as day(date) order by day.date`, matching the production repository's work. No timeout/lock error occurred.
- Three public timezone-name probes including transaction/network overhead took **139 / 130 / 190 ms**. To distinguish that overhead, `EXPLAIN (ANALYZE, FORMAT JSON) select exists(select 1 from pg_catalog.pg_timezone_names where name='Europe/Berlin')` ran three times in read-only transactions. PostgreSQL execution was **24.215 / 24.297 / 24.104 ms**, planning **0.065 / 0.068 / 0.068 ms**. Repeating this lookup for start/end of hundreds of otherwise empty candidates explains the measured main database cost; exact per-function attribution on UAT was not enabled or claimed.
- Documentary validation: relative file/section links, unique DEV/COR IDs, archive/index/next-ID agreement and `git diff --check` passed. App/unit/build/browser checks were not run because this ticket changes no app/UI/schema implementation. The user-reported authenticated browser minutes and any network/Auth/queue/advisory-lock contribution were not independently captured. Do not describe the 30.7-second SQL result as a complete browser benchmark.

| Criterion | Evidence | Result |
| --- | --- | --- |
| AC1 | Explicit source cache/loading/query trace plus actual missing-fast-branch metadata and guest/signed-in candidate comparison | Passed |
| AC2 | 4,973-ms empty day, 30,689-ms complete empty week and pure 24-ms PostgreSQL catalog scans, all bounded/read-only | Passed |
| AC3 | Cause/rollout/test gap and loading limitation recorded, three concrete remediation steps, documentary checks and accurate no-live-change status | Passed |

## Risks, limitations, and follow-ups

The exact reported multi-minute browser delay has not been independently timed with a real authenticated session. The actual query alone reproducibly takes about 31 seconds; network/Auth/queue/contention may add delay but were not measured or blamed. Pure SQL profiling beyond the lookup EXPLAIN was not enabled on UAT. Follow-up implementation/hosted migration and real authenticated empty/populated performance checks remain necessary; this completed investigation does not mark the runtime issue fixed. No dummy users were created or retained data changed.

## Completion and review references

- Completed: 2026-10-21 — slow empty-week database path, missing hosted optimization and loading/release-test gaps identified; bounded read-only evidence and remedies recorded.
- Commit: Recorded with this ticket on `work/weekly-availability-repair`, as authorized by the user on 2026-10-21; subject `[DEV0401] Record slow weekly availability diagnosis`.
- Review: Source/evidence self-review complete; no independent review.
- Deployment or release: None; UAT schema/configuration/data unchanged.
