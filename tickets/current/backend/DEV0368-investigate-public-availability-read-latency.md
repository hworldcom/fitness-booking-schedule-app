# Ticket DEV0368: Investigate public availability read latency

- Status: In progress
- Created: 2026-10-19
- Last updated: 2026-10-20
- Milestone: QA follow-up
- Coordination: None — independent development ticket
- Related records: Historical baseline: [DEV0367 responsive QA](../../archive/organisatory/DEV0367-audit-athlete-coach-responsive-journeys.md). Separate image delivery: [DEV0392](../../archive/frontend/DEV0392-optimize-public-background-image-delivery.md). Downstream cache policy: [DEV0393](DEV0393-control-public-directory-cache-freshness.md). Hosted configuration baseline: [DEV0394](../../archive/backend/DEV0394-restore-uat-events-directory-reads.md).

## Objective and context

Public Home, Explore and coach pages respond slowly with a small local catalog. During QA, development responses took 31.339/41.459/36.716 seconds; an otherwise idle configured production preview took 7.608/7.694/11.135 seconds. Seven visible coaches included one disposable QA coach with five dates of availability. This is an observed latency problem; synchronization cost is a profiling lead, not a proven root cause.

After removing that QA dataset, the same configured production preview still took 5.226 seconds for Home and 4.733 seconds for Explore with the six retained coaches. The removed QA coach URL returned 404 in 0.029 seconds. This distinguishes the retained-data baseline from the larger fixture observation; neither identifies the dominant cost without profiling.

## Scope and non-goals

Profile server/database work for public discovery and schedule previews; define one focused optimization after measuring. Preserve actual availability, guest count privacy, typed duration fitting and retained data. Exclude visual redesign and changing scheduling rules.

2026-10-20 scope update before recording findings: the user reports deployed UAT is slow across most pages and navigation. Include anonymous live UAT HTTP/browser timing, deployed function/database placement and read-only connection/query profiling. This investigation authorizes no runtime-source change, database mutation, project-setting change or deployment. Preserve the earlier populated-local-catalog investigation as outstanding work; the current empty UAT catalog cannot establish its synchronization cost.

## Expected behavior and edge cases

Public reads must preserve accurate current counts, eligible full-duration starts, unavailable versus verified-zero states and guest privacy. Repeated reads must not require unnecessary work proportional to unrelated inventory. Cold/warm reads and concurrent visitors need distinct measurements.

## Assumptions, decisions, and dependencies

The user originally requested a full QA audit and on 2026-10-20 requested investigation of current UAT slowness, identifying most pages/navigation as affected. Retained accounts/content and unrelated workspace edits must be preserved. This record owns read-only profiling, with no repair implementation; the separate completed DEV0395 owns the region repair. Initial configuration evidence and later measured before/after improvement remain distinct. Record separate repair scope and checks before implementing another repair.

## Implementation plan

1. Capture repeated anonymous UAT requests and actual desktop/phone navigation; inspect the exact aliased deployment, project function region and guarded hosted-dev database region.
2. Measure fresh versus reused database connections and read-only public Events SQL execution separately. Record the current catalog size and distinguish local-to-hosted samples from deployed function timings.
3. Reproduce the earlier populated-local-catalog measurements and attribute query, synchronization, connection and rendering costs without modifying retained data.
4. State a bounded repair plan, its evidence limits and correctness checks before a focused fix; split implementation if distinct causes require it.
5. For any later repair, prove unchanged availability/privacy and record comparable before/after timings.

## Acceptance criteria

- [ ] AC1: Reproducible timings and query-level attribution identify the dominant cost.
- [x] AC2: A bounded repair plan states its files, correctness checks and measured improvement criteria before implementation.

## Validation plan

Use the current public contract in specification sections 4.2, 18 and 19. Run representative Home/Explore/coach requests and inspect query plans in disposable data; retain meaningful duration, override, concurrency and guest-time privacy checks.

## Implementation record

### Changes and rationale

No repair implemented under this ticket. DEV0367 created this follow-up from current-working-tree evidence. The 2026-10-20 investigation adds live UAT evidence and the initial repair proposal while retaining the incomplete populated-local-catalog attribution. The dated follow-up below links the subsequently completed DEV0395.

At investigation time, UAT executed application functions in Washington, D.C. (`iad1`) while the hosted-dev database was in Frankfurt (`eu-central-1`). Requests entered Vercel in Frankfurt and executed in the US: repeated responses carried `x-vercel-id: fra1::iad1::...`. The exact alias API identified deployment `dpl_A2mr6L1QBKQKdsXewVgq6nsR75P6`; its deployment `regions` was `["iad1"]`, and the UAT project's `serverlessFunctionRegion` and `resourceConfig.functionDefaultRegions` both agreed. The original working UAT deployment `dpl_9iCAdz7gGLhUqU7WHwHPHUvgg5XB` reported `["fra1"]`. The repository's Vercel configuration did not pin a region. These established a placement regression; the subsequent controlled repair/comparison is recorded separately in DEV0395.

Supabase project metadata reports the allowlisted dev project in `eu-central-1`, `ACTIVE_HEALTHY`. The guarded local hosted-dev runtime URL uses the Frankfurt transaction pooler on port 6543. Three read-only samples found zero currently visible coaches and an empty public Events result. The public Events SQL execution took 0.277–0.443 ms. This empty UAT baseline is already slow without populated availability synchronization.

The shared database helper constructs a new Postgres.js client for each operation and closes it in `finally`. Three local-to-hosted measurements of the same options show 202/283/287 ms for fresh connection plus `select 1`, versus 16–25 ms for subsequent `select 1` calls on an open connection; close takes 15–20 ms. These measurements establish repeated connection overhead from this machine, not an exact share of US-function latency. The geographic separation plausibly amplifies each handshake and sequential query.

Public directory pages/API responses are dynamic, with no reusable page/data cache in the inspected paths. Home explicitly awaits `connection()` and directory services await database results. Signed-in layouts also await verified Auth/session purpose, application identity and authorized actor reads; the actor provider requests another current-actor snapshot after mounting. Those are source-level leads for authenticated slowness, not measured authenticated UAT timings. This investigation uses no account credentials.

### Affected files

| File or component                                                                                                                                                                                                                        | Finding or change                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| This record and [ticket index](../../README.md)                                                                                                                                                                                          | Only changed repository files for this investigation; scope, status, measurements, limits and proposed repair are recorded.         |
| [Vercel configuration](../../../vercel.json)                                                                                                                                                                                             | Inspected before DEV0395: no region was pinned. The ignored root Vercel link names old staging and must not select a repair target. |
| [Database helper](../../../src/server/db/client.ts)                                                                                                                                                                                      | Inspected only: creates/closes a client per operation, including independent repository calls.                                      |
| [Home](../../../src/app/page.tsx), [Explore](../../../src/app/explore/page.tsx), [Events service](../../../src/server/group-sessions/directory-service.ts)                                                                               | Inspected only: await uncached public directory reads.                                                                              |
| [Root layout](../../../src/app/layout.tsx), [session adapter](../../../src/server/auth/session.ts), [authorization service](../../../src/server/authorization/service.ts), [actor provider](../../../src/auth/client/actor-provider.tsx) | Inspected only: signed-in verification/identity/actor work and post-mount actor refresh require separate profiling.                 |

### Proposed first repair and validation boundary

1. Before implementation, record a focused development-ticket scope for pinning UAT to Frankfurt, either in the verified UAT project setting or `vercel.json` after checking its effect on other deployments. Preserve the correct explicit dev target and saved settings. Do not use the root staging link or change production's project/database.
2. Redeploy the same reviewed UAT source with only the region change, preserving unrelated pending image changes. Inspect both deployment metadata and live headers for `fra1` function execution. No database migration or data edit is needed; rollback is the preceding ready UAT deployment.
3. Repeat the six-route three-round HTTP matrix and desktop/phone navigation under comparable load/cache conditions. Target lower median directory response and navigation times; record actual before/after distributions, not a promised speedup. All public routes must remain 200, truthful empty/unavailable behavior must remain distinct and protected APIs must retain signed-out denial.
4. Measure the remaining connection cost after colocating functions/database. Treat connection reuse as a separate repair requiring transaction-local actor isolation, bounded serverless pooling, concurrency and recovery checks. Do not trade authorization checks or stale availability for speed. DEV0393 retains ownership of any later shared-cache policy.

### Decisions and deviations

2026-10-19: Preserve the observed failure separately from any inferred cause.

2026-10-20: The user's new UAT report extends the read-only investigation. Prioritize the confirmed region mismatch before changing queries/cache policy because the current empty catalog already reproduces the latency. No runtime/operational repair is included in this documentary change.

### Contracts, configuration, and operations

No API, schema, dependency, environment value, project setting, application source or deployed behavior changed. Only this record/index changed. Queries used the restricted dev runtime in explicit read-only transactions; no fixtures, sign-ins, resets, emails or retained-record changes were performed. Vercel API access was read-only and targeted the exact UAT alias/project. An attempted individual sensitive-variable inspection returned metadata without a usable value; no secret is recorded or needed for the region finding. Future implementation must record actual compatibility/configuration effects and exact cleanup.

## Validation results

DEV0367 supplies the populated-local-catalog baseline above. On 2026-10-20, three rounds of anonymous `curl` GETs ran against `https://uat.movx.club`, at most two concurrent requests. Each probe used `curl --max-time 25 -sS -o /dev/null -D - -w '\nMETRIC %{http_code} %{time_namelookup} %{time_connect} %{time_appconnect} %{time_starttransfer} %{time_total} %{size_download}\n' <url>`. All 18 requests returned 200/MISS. Values below are time to first response byte, excluding image downloads.

| Route           | Round 1 (s) | Round 2 (s) | Round 3 (s) |
| --------------- | ----------: | ----------: | ----------: |
| `/`             |       1.342 |       1.278 |       1.333 |
| `/explore`      |       1.325 |       1.291 |       1.331 |
| `/events`       |       1.445 |       1.378 |       1.293 |
| `/api/events`   |       1.612 |       1.313 |       1.302 |
| `/how-it-works` |       0.381 |       0.223 |       0.227 |
| `/sign-in`      |       0.470 |       0.218 |       0.213 |

DNS/TCP/TLS completed in about 0.04–0.05 s on the later probes; directory response bodies were only 26–36 KB and the Events API 96 bytes. This places the consistent wait before the page/image body transfer and rules out only-first-request cold start as the sole explanation.

- Actual Chrome navigation: `node --input-type=module` with `import { chromium } from '@playwright/test'`, `chromium.launch({channel:'chrome',headless:true})`, fresh contexts at 1440×1000 and 393×852, Home `goto`, actual exact-name Explore/Events link clicks and `waitForURL` on each destination. Explore/Events clicks took 1.352/1.523 s desktop and 1.427/1.605 s phone. These are fresh signed-out desktop/phone viewport checks, not physical-device or signed-in evidence. Request headers again report `fra1::iad1`.
- Read-only Vercel API checks: `GET /v4/aliases/uat.movx.club`, `GET /v13/deployments/<aliased-id>`, `GET /v9/projects/prj_CPYcoaAzkLOxWrb6Q9lOaDgtQQPA`, and the original deployment lookup. All region findings above come from returned metadata, not inference from build-machine location. Existing CLI authorization was used without printing tokens. [Vercel region documentation](https://vercel.com/docs/functions/configuring-functions/region) confirms new projects default to `iad1` and recommends colocating functions with the data source.
- Supabase metadata: `node --env-file=.env.development.local --input-type=module` validated `hostedRuntimeConfiguration(process.env,'dev')`; a captured `node_modules/.bin/supabase projects list --output json` was filtered to the one dev project before printing region/health only.
- Database timing: the same Node invocation imported `postgres`, created three clients with `{max:1,prepare:false,ssl:'require',connect_timeout:10,idle_timeout:5}`, measured first/reused `select 1`, then used `sql.begin('read only', ...)` for the visible-coach count, `select app.public_group_sessions('list','{}'::jsonb)` and `explain (analyze,format json) select app.public_group_sessions('list','{}'::jsonb)`. Each client closed after measurement. Public Events total on an open connection was 17–20 ms; PostgreSQL planning 0.016–0.025 ms and execution 0.277–0.443 ms. No row identities/content were output.
- Installed Next.js is 16.3.8. Inspected bundled fetching/streaming guidance and source; no framework integration was changed.
- Not run: authenticated UAT profiling, populated local-catalog SQL/synchronization attribution, a region-change before/after comparison or connection-reuse implementation tests. No application tests/build are required for this record-only change; documentary link/status/whitespace checks are recorded below after review.
- Documentation review: Python checked 345 local link targets across this record/index, unique DEV0368 placement under current and matching In progress status; passed. `git diff --check` passed. The first `node_modules/.bin/prettier --check tickets/current/backend/DEV0368-investigate-public-availability-read-latency.md` reported table-formatting differences; `prettier --write` corrected this record only and the repeated check passed. Self-review confirmed this task changes only this record and its existing index row; unrelated image/specification/source edits remain untouched.
- Commit-time review: validate links against the staged Git tree so the checkpoint does not depend on the independent image-ticket archive still awaiting its own commit. The initial checker treated directory navigation links as file blobs; a directory-aware check corrects that harness limitation. Only this record and its DEV0368 index row are included. Application tests/build are not rerun for this documentation-only checkpoint; recorded runtime evidence and the separate DEV0395 validation remain unchanged.

| Criterion | Evidence                                                                                                                                | Result                                                                                                                                                 |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AC1       | Repeated live timings, actual navigation, authoritative region metadata and read-only connection/Events SQL profiling                   | Partial: current empty UAT baseline attributed to network/connection path; populated-catalog costs and quantified region improvement remain unverified |
| AC2       | Proposed first repair above names configuration boundaries, isolated UAT deployment, correctness checks, rollback and comparison target | Passed for a proposed region repair; no implementation or measured improvement claimed                                                                 |

## Risks, limitations, and follow-ups

A failed QA assertion is not automatically a proven product defect. The investigated region mismatch and connection lifecycle are confirmed. Empty UAT SQL cannot explain the earlier populated-local-catalog slowdown. Keep this ticket In progress until that attribution passes; no cache TTL or stale-data allowance is selected.

Dated follow-up, 2026-10-20: independent [DEV0395](../../archive/backend/DEV0395-pin-uat-functions-to-frankfurt.md) completed the controlled same-source Frankfurt deployment and recorded substantially lower public response times. Its record owns the repair, release and before/after evidence. The UAT region repair is no longer pending; next action here is populated-catalog/connection attribution and, if separately scoped, authenticated-path profiling without altering retained accounts. The earlier investigation tables above retain their original measurement-time state rather than being rewritten as later evidence.

## Completion and review references

- Completed: Not completed — populated-catalog/remaining connection attribution is still open.
- Commit: `[DEV0368] Record UAT latency investigation` (investigation checkpoint; resolve its unique subject in Git history).
- Review: Investigation/evidence and documentary scope self-reviewed; no independent review.
- Deployment or release: None under this ticket; the completed DEV0395 owns the live Frankfurt release.
