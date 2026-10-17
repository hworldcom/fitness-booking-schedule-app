# Ticket DEV0277: Profile and reduce coach calendar latency

- Status: Draft
- Created: 2026-10-17
- Last updated: 2026-10-17
- Milestone: Scheduling responsiveness before UAT
- Coordination: None — independent development ticket
- Related records: completed calendar [DEV0254](../../archive/frontend/DEV0254-add-private-and-group-coach-calendar.md), effective availability [DEV0252](../../archive/backend/DEV0252-persist-effective-coach-availability.md), integrated hosted proof [DEV0256](../../archive/backend/DEV0256-rehearse-calendar-and-availability.md), SQL rollout [DEV0271](../../archive/backend/DEV0271-apply-hosted-dev-calendar-migration.md) and local restoration [DEV0272](../../archive/backend/DEV0272-restore-isolated-local-supabase-development.md). Completed [COR0023](../../archive/organisatory/COR0023-coach-calendar-and-availability.md) is a historical delivery baseline, not this ticket's coordinator. Ongoing [DEV0276](../../archive/backend/DEV0276-unify-established-coach-conversations.md) owns messaging changes and its separate forward migration.

## Objective and context

Make coach calendar loading and date/view/filter/page navigation responsive while preserving the existing scheduling contract. The user rejected 9–14 second calendar loading as excessive and requested a dedicated performance ticket after committing local development restoration. Implement against [calendar/effective availability](../../../docs/mvp-spec.md#18-coach-calendar-and-effective-availability), [booking/recovery](../../../docs/mvp-spec.md#7-requests-booking-and-recovery), [identity/privacy](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity) and the [definition of done](../../../docs/mvp-spec.md#11-definition-of-done).

### Existing evidence and unproven causes

- DEV0254's dense hosted-dev browser rehearsal recorded roughly 9–14 second development-mode calendar requests. Warm server-log examples include a 10.4 second Month response with 10.3 seconds attributed to application work and only 6 milliseconds to Next.js. Compilation alone does not explain those warmed requests. Its fixture had about four private hours per day over the thirty-day horizon plus groups, bookings and history.
- DEV0256 independently recorded **14–27 second availability previews/saves and roughly 14 second private requests in a production-mode localhost app against hosted dev**. These are adjacent scheduling operations, not calendar-only measurements. They demonstrate a broader concern but do not establish one common cause.
- [The calendar SQL function](../../../supabase/migrations/20261016000300_owner_coach_calendar.sql) calls `app.synchronize_coach_availability_occurrences` before applying date/type/venue results, including group-only queries and subsequent pages. [Synchronization](../../../supabase/migrations/20261016000200_effective_coach_availability.sql) takes a coach-scoped transaction lock and checks recurring hours, venues, policy/history and overlaps across the rolling horizon. Repeated work is visible in source; its share of elapsed time and any actual lock waits remain unmeasured.
- [The route](../../../src/app/coach/page.tsx) first reads an authorized availability workspace **with occurrence loading disabled**, then reads the authorized calendar. Inspect repeated identity/profile work and actual Auth calls; do not claim that first workspace read performs another inventory synchronization. [The database client](../../../src/server/db/client.ts) opens/closes a client per owned operation; measure connection cost directly rather than treating its shutdown timeout as a fixed delay.

## Scope and non-goals

- In scope: one coach-calendar read path, including Day/Week/Month, selected date, type/venue/history filters, reload and Load more; bounded instrumentation and reproducible local/hosted benchmarks; the smallest measured backend/request-orchestration correction; correctness, authorization and recovery regression proof.
- Availability previews/saves and athlete requests provide comparison measurements and regression coverage. Independent optimizations to those flows require their own bounded follow-up scope; this ticket does not promise to solve every scheduling delay.
- Out of scope: interface redesign, unrelated messaging/navigation changes, provider upgrades or paid-plan purchases, speculative global caching/pooling, background-job architecture, real-user data migration, shared resets/seeding, existing-account enrollment, external email, production changes and deployment.

## Expected behavior and edge cases

The owner receives the same current redacted calendar items, exact counts/three previews, original identifiers, content version and complete cursor paging with less elapsed time. No loading indicator, prefetched stale response or local-only speedup substitutes for improved hosted response time. Empty and dense schedules, group-only filters, history and dates beyond the private horizon remain truthful.

Any reduced reconciliation must still publish the next eligible local date without requiring a coach visit, preserve the thirty-date horizon and daylight-saving rules, retain booked/group reservations and actual venues, respect manual closures, and restore policy-closed capacity using the existing successor-identity rules. Authoritative requests/acceptance must recheck current eligibility. Parallel reads, policy edits, group decisions and cancellations cannot introduce overlaps or stale capacity.

Authentication and actor/dataset authorization remain current. Reusing work within a request must not share an actor or transaction-local context across accounts, requests or pooled connections. Account switch, sign-out, suspension and transport/stale-page recovery retain their existing clearing and retry behavior. No roster, athlete identity, note or operator credential enters the calendar projection or timing output.

## Assumptions, decisions, and dependencies

- Confirmed user constraint: 9–14 second calendar loading is unacceptable. No numeric response-time service-level agreement has been confirmed.
- **Proposed engineering target for this Draft:** warmed Day/Week/Month navigation has an empirical p95 of at most **2 seconds** in the production-mode localhost-app/hosted-dev setup. Here p95 is the duration at or below which 95% of the recorded samples fall. Report browser completion and server duration separately, with at least 20 measured requests per core view after documented warm-up. Record first-load/compilation, filter/paging, empty-schedule and adjacent-operation measurements separately. Adopt or revise the target with a reason before implementation; this proposal does not change the product specification.
- Default local development remains Docker-backed under committed DEV0272 (`bbcf844`). Use it for profiling and regression first; hosted dev is required to prove the result under network/connection costs. A local-only benchmark cannot close this ticket. A localhost production app with hosted PostgreSQL is not a deployed UAT benchmark.
- Pin the tested source revision, dependency versions, ledger, app/database placement, fixture sizes and browser/cache/prefetch conditions. Benchmark accepted code, not an uncontrolled mix of concurrent DEV0276 changes. Reuse existing guarded fixture/rehearsal helpers rather than duplicate their Auth and cleanup machinery.
- Reviewed as one backend-primary calendar slice. If profiling reveals multiple independent deliverables or requires a larger reconciliation architecture, update ownership/scope before edits and apply the repository's DEV-to-COR split rule when applicable. Do not implement unrelated fixes under a generic performance umbrella.

## Implementation plan

1. Establish repeatable empty/dense baselines on local and exact hosted dev. Reuse tagged fictional owners/athletes, two venues, roughly 120 private hours, mixed published group/booking/history states, more than one 50-item page and a real group beyond the private horizon. Verify result equivalence while measuring actual browser completion, server work, verified Auth/identity, connection/transaction setup, SQL projection/reconciliation and observed lock waits. Keep warm-up, sample counts, timeouts and failures explicit; retain slow/error samples.
2. Attribute the dominant cost using scoped timings and bounded SQL plans/timing against owned fixtures. Calendar SQL can write through inventory reconciliation: run isolated operator SQL investigation in explicit rollback transactions with lock/statement timeouts. Avoid provider-wide monitoring changes and private query/body logging. Record findings and the concrete narrow correction in this ticket before implementation.
3. Implement only the measured correction. Candidates to evaluate include removing redundant request reads and avoiding unnecessary repeated whole-horizon work; neither is a predetermined solution. Any request reuse, database-client change or freshness/invalidation scheme must explain current authorization, date rollover, policy/group/cancellation changes, concurrency and failure recovery. A database correction uses a new forward migration allocated at implementation; baseline/effective/calendar applied files and DEV0276's migration stay unchanged.
4. Run affected model/service/SQL/privacy/recovery/concurrency checks and real owner navigation. Re-run the same production-build hosted benchmark with equivalent fixtures and conditions; report p50/p95/max, timeouts and phase timings before/after. Check adjacent preview/save/request paths for regressions without expanding their implementation scope. Preserve baseline nonfixture rows, remove exact owned fixtures and close owned test processes.
5. Finish the maintained benchmark command/usage, measured outcome, tradeoffs, migration/recovery requirements and remaining follow-ups. Review every criterion, update the index and archive only after required functional and hosted-performance evidence passes. UAT deployment remains separate.

## Acceptance criteria

- [ ] AC1: A reproducible pinned baseline separates browser, application, Auth/connection and measured database/reconciliation costs; empty/dense schedules and adjacent comparisons are recorded without asserting an unmeasured root cause.
- [ ] AC2: The adopted warm-navigation target is met on the paired hosted production-build benchmark, with at least 20 samples per Day/Week/Month, complete p50/p95/max/error reporting and equivalent returned data. Cold, filter/paging and local results remain separately identified.
- [ ] AC3: Exact paging/counts/history/identifiers/privacy, rolling dates/DST, closure/restoration, reservation conflicts, current actor authorization and stale/unavailable recovery pass meaningful regression checks; adjacent saves/requests do not regress or lose authority.
- [ ] AC4: The scoped implementation, reproducible developer command, before/after evidence, exact fixture cleanup/data preservation, applicable source/database/build checks and recovery/limitations are documented. No existing data, immutable migration or production environment is changed by validation.

## Validation plan

Use an optimized Next.js build with the real restricted runtime, not fixture-replaced authorization or development-server timings as the final benchmark. The hosted harness must explicitly select confirmed dev `mdzidiqosxbghmfyxphb`, refuse prod/unknown or mismatched settings and use only independently tagged temporary fixtures. Operator Auth material remains in the harness process, excluded from the app environment and logs; generate test OTPs without sending email. Snapshot nonfixture records, preserve concurrent peer fixtures and retain an exact-ID recovery manifest if cleanup fails. Do not reset or seed shared dev.

Run the tests selected by the measured change: existing calendar/action tests and integrated owner scenarios; effective-availability/request/group race and recovery cases for any SQL or reconciliation change; actor/dataset isolation for any request/connection reuse. Run `npm test`, relevant database driver/pgTAP/application-SQL lint checks, source lint/type/format and production build. For touched calendar behavior, verify desktop and 375/430 px, keyboard, Back/reload and visible loading/error recovery. Record exact commands/results, target/fixture/source identity and excluded checks. Review against section 18 before declaring improved speed safe.

## Implementation record

### Changes and rationale

Planning only on 2026-10-17: created this Draft and its index entry after committing local restoration. The scope makes calendar responsiveness the first optimization boundary and keeps broader scheduling symptoms as measured comparisons. No profiling instrumentation, runtime correction, migration or new benchmark has been implemented.

### Affected files

2026-10-17 checkpoint correction: repaired the DEV0276 link after its archive move. This planning review also owns the dated COR0023 documentation synchronization identifying DEV0239 as a completed external hosted-validation dependency and retaining the integration-entry sequence. It changes no calendar implementation, performance result or prior delivery acceptance.

This ticket and [`tickets/README.md`](../../README.md) only. Investigation candidates are the linked route/database client, [calendar service](../../../src/server/coaches/calendar-service.ts), [calendar repository](../../../src/server/db/coaches/calendar-repository.ts), [authorization](../../../src/server/authorization/service.ts) and [availability service](../../../src/server/coaches/service.ts). These are candidates, not a claim that every module needs changing. Existing migrations are read-only evidence; any SQL implementation is forward-only.

### Decisions and deviations

The 2-second target is a proposal rather than a user-confirmed product requirement. Root-cause attribution remains open. No deviation from the planned calendar-only implementation boundary.

### Contracts, configuration, and operations

None changed by this planning record. Potential database/client/freshness changes require an explicit compatibility and recovery record before implementation. Existing local/hosted commands and identity/settings remain unchanged.

## Validation results

Planning source/evidence review distinguishes DEV0254's development timings from DEV0256's adjacent production-mode timings. Inline Python validation passed **228 local links and 11 anchors** across this record/index, unique current/archive identifiers, Draft/index agreement, four unchecked criteria, independent coordination membership and next identifier DEV0278. `npx prettier --check` for this record/index and `git diff --check` passed. Runtime benchmarks and AC1–AC4 are **not run**; prior functional completion does not satisfy the new performance criteria. Application/database/browser tests are not repeated for a documentation-only Draft.

| Criterion | Evidence                                             | Result  |
| --------- | ---------------------------------------------------- | ------- |
| AC1–AC4   | Implementation and paired benchmark evidence pending | Not run |

## Risks, limitations, and follow-ups

Moving work out of calendar reads can break lazy date rollover or expose stale capacity; broad cache/client reuse can break authorization or transaction isolation. Preserve correctness before accepting a faster response. Hosted placement/network variability must be recorded, not conflated with deterministic SQL cost. Separate measured preview/save/request defects into linked work before implementing them. This Draft does not reopen completed M9 records, deploy UAT or claim a performance improvement.

## Completion and review references

- Completed: Not completed — preparation only.
- Commit: Planning included in this user-authorized checkpoint (subject includes DEV0277); no performance implementation/benchmark is claimed. Preceding local restoration remains `bbcf844` (`[DEV0272] Restore isolated local Supabase development`).
- Review: Planning/source/evidence self-review; no independent review.
- Deployment or release: None; no runtime or hosted change.
