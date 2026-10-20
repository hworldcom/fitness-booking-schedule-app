# Ticket DEV0393: Control public directory cache freshness

- Status: Draft
- Created: 2026-10-20
- Last updated: 2026-10-20
- Milestone: M3 public discovery performance maintenance
- Coordination: None — independent development ticket
- Related records: Profiling dependency: [DEV0368](DEV0368-investigate-public-availability-read-latency.md). Separate image delivery: [DEV0392](../../archive/frontend/DEV0392-optimize-public-background-image-delivery.md). Events-read dependency: [DEV0394](../../archive/backend/DEV0394-restore-uat-events-directory-reads.md). Existing calendar profiling, outside this scope: [DEV0277](DEV0277-profile-and-reduce-coach-calendar-latency.md).

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
- Before implementing a persistent cache, use DEV0368's profiling outcome to identify the reusable cost and record the exact data boundary, acceptable freshness, keys, invalidation events and measurement target here and in the specification. This unresolved boundary keeps the ticket Draft.
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

Planning only. Existing dynamic pages, mutation refresh calls, API cache headers and all data remain unchanged.

### Affected files

| File or component                                                                                                                            | Role to inspect before implementation                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| [Home](../../../src/app/page.tsx), [Explore](../../../src/app/explore/page.tsx), [Events](../../../src/app/events/page.tsx)                  | Request-time public page boundaries.                                      |
| [Coach service](../../../src/server/coaches/service.ts), [Events directory service](../../../src/server/group-sessions/directory-service.ts) | Public data composition and candidate reusable work.                      |
| [Coach profile actions](../../../src/app/profile/coach/actions.ts), [Events actions](../../../src/app/coach/events/actions.ts)               | Examples of existing invalidation; not the complete mutation inventory.   |
| [Specification](../../../docs/mvp-spec.md)                                                                                                   | Adopt actual freshness and invalidation behavior with the implementation. |

### Decisions and deviations

2026-10-20: Keep this distinct from the existing latency profiling ticket and from background-image caching. Do not assume ISR is the appropriate mechanism or allow stale scheduling data to obtain a faster benchmark. No implementation deviation yet.

### Contracts, configuration, and operations

No changes made. The eventual cache policy is a behavior contract and must include invalidation/rollback and operational mutation instructions. No new provider, credentials, schema or blanket public media caching is assumed.

## Validation results

Source inspection and live UAT HTTP probes established the current dynamic/no-store baseline on 2026-10-20. No proposed caching or invalidation acceptance test has run.

2026-10-20 planning checks: Python local-link/anchor and record-consistency validation passed for all three new tickets and the index (376 references, unique IDs, required sections and matching Draft entries). `prettier --check` passed for the three new records; `git diff --check` passed. Application tests/build and new live browser checks were not run because this change creates planning documents only.

| Criterion | Evidence                                                    | Result  |
| --------- | ----------------------------------------------------------- | ------- |
| AC1–AC5   | Policy boundary, implementation and required checks pending | Not run |

## Risks, limitations, and follow-ups

TTL alone cannot satisfy immediate visibility/revocation requirements. Missing an operational mutation path or mixing guest/authenticated projections can violate the product contract. A cache is not a substitute for fixing expensive database reads. Next action: use DEV0368 profiling and the mutation inventory to resolve the safe reuse boundary and proposed duration before implementation.

## Completion and review references

- Completed: Not completed.
- Commit: Planning record included in the user-requested checkpoint subject `[DEV0392][DEV0393][DEV0394] Save background caching and UAT recovery`; implementation remains pending.
- Review: Draft scope reviewed against privacy, visibility and scheduling requirements; no independent review.
- Deployment or release: Not performed.
