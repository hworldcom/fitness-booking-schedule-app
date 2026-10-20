# Ticket DEV0393: Control public directory cache freshness

- Status: In progress
- Created: 2026-10-20
- Last updated: 2026-10-20
- Milestone: M3 public discovery performance maintenance
- Coordination: None — independent development ticket
- Related records: Profiling dependency: [DEV0368](../../archive/backend/DEV0368-investigate-public-availability-read-latency.md). Separate image delivery: [DEV0392](../../archive/frontend/DEV0392-optimize-public-background-image-delivery.md). Events-read dependency: [DEV0394](../../archive/backend/DEV0394-restore-uat-events-directory-reads.md). Measured prerequisite repair: [DEV0396](../../archive/backend/DEV0396-avoid-repeated-timezone-catalog-scans.md). Existing calendar profiling, outside this scope: [DEV0277](DEV0277-profile-and-reduce-coach-calendar-latency.md).

## Objective and context

The user requested explicit control over cache freshness after discussing ISR (Incremental Static Regeneration), browser reuse and public directory performance. Home, Explore and Events currently produce request-time pages with database reads. Live UAT responses on 2026-10-20 used `private, no-cache, no-store, max-age=0, must-revalidate`; no route revalidation interval, persistent `use cache`/`unstable_cache` wrapper or tagged public-directory data cache was found. The React `cache()` helper for coach metadata is request-scoped and does not reuse profiles across visitors.

Define a testable freshness/invalidation policy and apply a small public-data cache only where profiling shows useful savings and the current contract permits reuse. Follow [discovery](../../../docs/mvp-spec.md#42-discover-a-coach-and-time), [security/failure invariants](../../../docs/mvp-spec.md#10-security-and-failure-invariants), [Events authority](../../../docs/mvp-spec.md#15-group-training-and-events), [availability](../../../docs/mvp-spec.md#18-coach-calendar-and-effective-availability) and [public content/visibility](../../../docs/mvp-spec.md#192-public-content-and-template).

## Scope and non-goals

- In scope: a documented cache matrix for public directory reads; measured selection of reusable public metadata; explicit keys, duration and mutation-driven invalidation; fresh eligibility/visibility/availability checks; navigation freshness verification across the affected Home/Explore/Events reads.
- Out of scope: blanket ISR of authenticated layouts/pages, a global page refresh timer, caching booking writes or private API responses, changing scheduling/privacy rules, image optimization, new infrastructure providers, or reimplementing DEV0368 profiling and DEV0277 calendar optimization.

## Expected behavior and edge cases

Reusable presentation data has a bounded documented lifetime and complete cache keys, including relevant environment/dataset, filters and pagination. Cached content cannot leak private fields or become visible for a hidden/ineligible coach, unpublished session or inactive dataset. Guest projections cannot reuse authenticated individual private schedules. Requestability, current availability/counts, capacity, deadlines and all booking/registration decisions retain their authoritative current checks. Cached errors cannot masquerade as successful empty results.

Supported edits invalidate the affected public projections across routes and application instances. Cover owner saves and platform/operational changes, not just one browser's `router.refresh()`. Record how externally performed changes are detected or invalidated; exclude a field from caching if its required freshness cannot be enforced. A duration expiring makes data eligible to refresh on a request; it does not schedule a background reload of every open tab. Browser Back/Forward restoration and other users' already-open pages must be described separately from server cache invalidation.

## Assumptions, decisions, and dependencies

- Confirmed: the user wants tickets for the discussed improvements. No new data-cache policy, stale-data allowance or TTL (time to live, the period cached data may be reused) has been selected.
- Proposed default: a short shared cache for safe public presentation data, with targeted invalidation, while scheduling and authorization remain current. Do not treat a suggested duration such as 30 seconds as a confirmed requirement.
- Before implementing a persistent cache, use DEV0368's profiling outcome to identify the reusable cost and record the exact data boundary, acceptable freshness, keys, invalidation events and measurement target here and in the specification. Policy investigation is now In progress; no persistent cache may be introduced until that boundary and its measured benefit are resolved.
- DEV0394 restored UAT public Events reads on 2026-10-20, supplying the baseline for Events performance/invalidation acceptance. Policy analysis can proceed independently. DEV0392 is independent and has no data-cache dependency.
- Inspect installed Next.js 16.3.8 bundled caching and revalidation documentation; `cacheComponents` is not currently enabled. Do not enable it globally merely to adopt a cache helper.

## Implementation plan

1. Map public read paths and every mutation affecting their visibility, profile metadata, reviews, locations, availability, group publication and capacity. Record current browser/server cache behavior and reuse DEV0368 profiling evidence.
2. Adopt a narrow cache policy before code changes: cacheable fields, TTL, keys, refresh/failure semantics, per-instance behavior and invalidation coverage. Update this scope and the specification in the implementation change. If the investigation requires multiple independent repairs, split the Draft under the repository workflow before implementation.
3. Cache only the selected safe public data and connect all required invalidations. Keep live eligibility and scheduling authority outside reusable stale projections.
4. Verify stale-hit versus post-mutation behavior across routes, filters, page cursors, actors and instances, including operational mutation paths. Measure cold/warm response time and database work without changing fixtures or cache states between comparisons.
5. Document what refreshes automatically, on mutation, on navigation and on explicit reload; record deployment-specific proof separately.

## Acceptance criteria

- [ ] AC1: The specification and implementation record define each affected cache's scope, exact lifetime/key, refresh trigger, failure behavior and invalidation owner; proposed choices are resolved before caching code is introduced.
- [ ] AC2: Reuse is restricted to the adopted safe public fields, with isolation across environments/datasets, filters, pagination and guest/authenticated projections.
- [ ] AC3: Owner and platform/operational mutations invalidate or bypass stale content as required across Home, Explore, Events and related public pages; hidden/ineligible/unpublished data cannot remain accessible through cache reuse.
- [ ] AC4: Availability, capacity, booking/registration authority, guest schedule privacy, unavailable-versus-empty states and uploaded-media revocation remain consistent with the existing contract under concurrent changes.
- [ ] AC5: Comparable before/after measurements prove the adopted reduction in redundant work; targeted correctness regressions, lint, type checks, build and desktop/mobile navigation checks pass.

## Validation plan

Use a configured production build and disposable, uniquely tagged fixtures. Exercise cold/warm hits, expiry, mutation invalidation, different filters/cursors, two visitors and separate instances where the implementation shares a cache. Test coach hide/review status, website/location changes, session publish/unpublish, capacity exhaustion, booking/availability changes and failure recovery against relevant existing server/database tests. Verify guest versus authenticated outputs and current media revocation. Check desktop/mobile navigation, Back/Forward and keyboard recovery without claiming that other users' open tabs receive pushed updates. Run relevant `npm test`/database regressions, lint, typecheck and production build. Preserve retained records and clean exact temporary fixtures. Do not add implementation-mirroring TTL tests instead of state-transition and invalidation coverage.

## Implementation record

### Changes and rationale

2026-10-20: Started the policy/read-path investigation after completing DEV0392. Existing dynamic pages, mutation refresh calls, API cache headers and retained data remain unchanged. The first task is to compare authoritative query/synchronization cost with candidate presentation reuse in a disposable local database, then adopt the smallest useful boundary. A populated catalog is required because the live UAT catalog is currently empty. No persistent cache or stale-data allowance has been selected.

2026-10-20 first measurements: three complete populated-directory calls took 7.565 / 7.231 / 7.746 seconds. Their availability SQL took 7.475 / 6.990 / 7.641 seconds, while the primary metadata query took 20 / 30 / 28 ms. Separate public path/card/review calls were 19–72 ms (connection included). All three directory results were ready with six entries. This is local disposable-copy evidence, not a hosted latency estimate. The initial diagnostic count for arrays/maps used a method's arity by mistake; the actual complete-service entry count was six and query timings are unaffected. Deeper attribution belongs to DEV0368, not a new cache implementation. All 57 retained app/Auth-user/Storage table hashes matched and the exact scratch database/source copy were removed.

### Affected files

| File or component                                                                                                                            | Role to inspect before implementation                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| [Home](../../../src/app/page.tsx), [Explore](../../../src/app/explore/page.tsx), [Events](../../../src/app/events/page.tsx)                  | Request-time public page boundaries.                                      |
| [Coach service](../../../src/server/coaches/service.ts), [Events directory service](../../../src/server/group-sessions/directory-service.ts) | Public data composition and candidate reusable work.                      |
| [Coach profile actions](../../../src/app/profile/coach/actions.ts), [Events actions](../../../src/app/coach/events/actions.ts)               | Examples of existing invalidation; not the complete mutation inventory.   |
| [Specification](../../../docs/mvp-spec.md)                                                                                                   | Adopt actual freshness and invalidation behavior with the implementation. |

### Current cache and mutation inventory — 2026-10-20

| Read surface                                               | Existing reuse/lifetime                                                                                                                                                               | Current invalidation or refresh authority                                                                                                                 | Eligibility for a new shared cache                                                                              |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Three public background photographs                        | Content-hashed optimizer URL; UAT one-year immutable browser responses                                                                                                                | Source-byte change/build produces a new URL; eviction/variant change can download again                                                                   | Already delivered by DEV0392; no directory data is included                                                     |
| Home/Explore coach directory                               | Request-time `publicCoachDirectory`; no persistent data cache                                                                                                                         | Every server read rechecks RLS/coach publication/primary location and synchronizes current availability before composing paths, website cards and reviews | Complete result is excluded: contains live availability and publication decisions                               |
| Public coach profile/schedule                              | Request-time services; any React `cache()` metadata helper is render-scoped only                                                                                                      | Current profile and schedule SQL, database time, typed duration/ownership gates                                                                           | Schedule/guest projections excluded; presentation reuse needs a separately proven revision/eligibility boundary |
| Events page and `/api/events` Load more                    | Force-dynamic; API `Cache-Control: no-store`; component keeps its currently loaded pages in memory                                                                                    | New server/API request rechecks publication, eligible coach, capacity, deadlines and current media; inconsistent cross-read batches return unavailable    | Complete result excluded: live seats/deadlines/publication/cursors and revocable media                          |
| Auth actor/identity/session and private account/owner APIs | `private, no-store`; auth provider fetches use no-store                                                                                                                               | Current session registry, verified provider identity and transaction-local actor context                                                                  | Excluded from public/shared caches                                                                              |
| Uploaded portrait/account/banner bytes                     | Separate authorization/reference/version checks; private/no-store response paths                                                                                                      | Current publication/sharing/reference is checked again around Storage reads; replacement/removal revokes old references                                   | Excluded; static-background cache rules must not be copied here                                                 |
| Browser navigation and loaded React state                  | No custom `staleTimes`; installed Next.js default is dynamic page 0 seconds, static/full-prefetch 5 minutes; shared layouts and Back/Forward restoration have separate reuse behavior | New navigation/server fetch, `router.refresh`, explicit reload and applicable Server Action revalidation; open tabs have no pushed update/timer           | A server TTL cannot refresh other already-open pages or replace write-time authority                            |

Mutation coverage found before any shared-cache adoption:

- Coach profile/location actions revalidate Explore, owner and public coach routes, but currently omit Home. Website/media APIs often refresh the editing client rather than globally invalidating public paths. Handle/account/starting-rate APIs include Home/Explore/public paths. These differences do not define a complete future shared-cache invalidation scheme.
- Review publication/moderation goes through current database functions and private/no-store HTTP responses without shared tags. Coach approval/suspension, dataset retirement and direct operator SQL can occur outside Next.js entirely. A tag-only cache tied to web saves would miss these operations.
- Availability/date exceptions, typed sessions, booking/rescheduling/cancellation, group publication/registration and database-time deadlines affect authoritative public state. Their current transaction checks and queries must remain live. Time passing also changes eligibility without an owner mutation.
- A future shared presentation cache must either observe an authoritative database revision on every read (including operational writes), or explicitly prove complete invalidation and acceptable staleness for its selected fields. No such boundary or permitted delay is established by this inventory. Missing invalidations are design prerequisites, not reported runtime stale-cache bugs, because no persistent directory data cache exists today.

### Decisions and deviations

2026-10-20: Keep this distinct from the existing latency profiling ticket and from background-image caching. Do not assume ISR is the appropriate mechanism or allow stale scheduling data to obtain a faster benchmark. Investigation phase only: preserve fresh data while measuring. No cache implementation has started.

### Contracts, configuration, and operations

No runtime/schema/environment/cache-policy changes made under this ticket. The eventual cache policy is a behavior contract and must include invalidation/rollback and operational mutation instructions. No new provider, credentials, schema or blanket public media caching is assumed.

## Validation results

Source inspection and live UAT HTTP probes established the current dynamic/no-store baseline on 2026-10-20. No proposed caching or invalidation acceptance test has run.

2026-10-20 planning checks: Python local-link/anchor and record-consistency validation passed for all three new tickets and the index (376 references, unique IDs, required sections and matching Draft entries). `prettier --check` passed for the three new records; `git diff --check` passed. Application tests/build and new live browser checks were not run because this change creates planning documents only.

2026-10-20 investigation handoff: the cache/read/mutation matrix above is now recorded, and DEV0368/DEV0396 contain the completed attribution and locally verified prerequisite repair. This ticket still has no adopted persistent-data boundary, lifetime or mutation-invalidation implementation, so its cache acceptance criteria remain unfinished. Python link/status/source checks passed for 470 references across eight affected documents; the application/database commands belong to DEV0396 and do not count as stale-hit/invalidation proof here. Current handoff: review the remaining small presentation costs and hosted behavior after a separate migration rollout before selecting further cache implementation.

| Criterion | Evidence                                                    | Result  |
| --------- | ----------------------------------------------------------- | ------- |
| AC1–AC5   | Policy boundary, implementation and required checks pending | Not run |

## Risks, limitations, and follow-ups

TTL alone cannot satisfy immediate visibility/revocation requirements. Missing an operational mutation path or mixing guest/authenticated projections can violate the product contract. A cache is not a substitute for fixing expensive database reads. DEV0368 now identifies the dominant repeated timezone-catalog validation, and DEV0396 locally repairs it with identical public results. The dedicated six-coach local comparison is 8,450 → 94 ms median without shared caching. This does not justify choosing a stale-data window by itself. Next action: evaluate the remaining 10–20 ms presentation reads and hosted behavior after a separately reviewed DEV0396 rollout, then adopt an explicit revision/invalidation boundary only if measured savings justify it. Cache implementation/acceptance remains unfinished; no new data cache or automatic tab-reload timer is deployed.

## Completion and review references

- Completed: Not completed.
- Commit: Planning record included in `cc0328e` (`[DEV0392][DEV0393][DEV0394] Save background caching and UAT recovery`). Investigation checkpoint: `[DEV0393] Record public cache freshness analysis` (resolve the unique subject in Git history). Cache implementation remains pending.
- Review: Read-path/cache/mutation inventory and measured dependency reviewed against privacy, visibility and scheduling requirements; no independent review.
- Deployment or release: Not performed.
