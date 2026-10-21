# Ticket DEV0403: Bound weekly availability loading

- Status: Completed
- Created: 2026-10-21
- Last updated: 2026-10-21
- Milestone: M10 UAT booking recovery
- Coordination: [COR0034](../organisatory/COR0034-repair-weekly-availability-performance.md)
- Related records: Diagnosis [DEV0401](../../archive/backend/DEV0401-investigate-slow-empty-week-availability.md); external SQL dependency [DEV0396](../../archive/backend/DEV0396-avoid-repeated-timezone-catalog-scans.md). Peer ownership and release order are mapped in COR0034.

## Objective and context

Prevent a slow or unresolved availability promise from leaving the signed-in week permanently on Checking. Follow the [weekly booking contract](../../../docs/mvp-spec.md#196-cards-username-urls-and-scheduling-compatibility), [duration-aware availability](../../../docs/mvp-spec.md#186-session-types-and-flexible-bookings) and retained-data boundary. The user authorized this repair on 2026-10-21.

## Scope and non-goals

- In scope: 15-second client weekly-read deadline, abort plus independent late-result fence, truthful unavailable/Retry state and filter preservation; meaningful stalled/late/retry tests, native desktop/phone/keyboard QA and specification amendment.
- Out of scope: SQL optimization/budgets, request-mutation timeout semantics, live rollout, account/data changes.

## Expected behavior and edge cases

A stalled week becomes unavailable with Retry within 15 seconds. A late response cannot replace the timed-out or retried view, even if transport ignores abort. Success before deadline displays actual empty/positive results; timers clear on completion/view/account changes. Existing request UUID/unknown-outcome handling is unchanged.

## Assumptions, decisions, and dependencies

- Deadline default 15 seconds is an adopted recovery limit, not a new user booking policy. Compatible server SQL limit is owned by peer DEV0402.
- Never timeout/retry a write as though it were known to have failed. This deadline applies only to availability reads.
- Existing fixture transports stay test-only; deploy no dummy route or env variable.

## Implementation plan

1. Mark In progress before edits and inspect existing effect/fixture/tests.
2. Add deadline to the existing effect, independently fence late values, retain class/place and explicit Retry.
3. Add hanging and late-response fixture scenarios; verify deadline, late concealment, fresh retry, existing races/privacy, keyboard and desktop/phone layouts. Update the current specification.
4. Run relevant/full tests, canonical lint/types/build and native responsive/error recovery. Finalize/archive only when evidence passes.

## Acceptance criteria

- [x] AC1: Stalled and abort-ignoring late reads stop loading at 15 seconds without stale/false-empty results.
- [x] AC2: Retry and filter/account/week transitions remain correct; keyboard/desktop/mobile error and recovery checks pass.
- [x] AC3: Relevant tests/static/build and current contract/implementation record pass.

## Validation plan

Extend the existing disposable production interface rehearsal with controlled stalled/late reads and clock advancement for the real component. Check actual desktop/375px error/Retry via native Safari and run existing response-race/request/guest checks. App/unit lint/types/build apply; SQL migration tests belong to DEV0402.

## Implementation record

### Changes and affected files

[Typed booking effect](../../../src/features/session-types/public-booking.tsx) starts a 15-second timer for each weekly read. On deadline it marks the view unavailable, aborts the read and independently fences it with `active=false`. Late transport responses cannot become success or zero even if abort is ignored. Success/rejection clears the timer, and context/account/unmount cleanup clears it and aborts. Existing Try again increments the attempt and makes a fresh read while retaining actual class/place. Mutation UUID/unknown-outcome handling is unchanged.

[Fixture harness](../../../tests/fixtures/seven-day-booking-harness.tsx) adds never-settling and 16-second late read scenarios, deliberately ignoring abort. [Production interface rehearsal](../../../scripts/rehearse-public-coach-schedule-ui.mjs) advances the real component clock across 15 seconds and verifies unavailable, no false zero, no late success, keyboard Retry and successful new reads. It also pauses stdin after serve-mode cleanup so completed fixture runners exit. [Specification](../../../docs/mvp-spec.md#196-cards-username-urls-and-scheduling-compatibility) records the adopted finite recovery limit and preserves booking/privacy authority.

### Decisions and contracts

15 seconds is the adopted read-recovery deadline; SQL execution budget is eight seconds under DEV0402. Timed-out reads use the existing unavailable copy/Retry; zero is shown only after a verified empty response. No dependency, env, payload, schema, account, write-retry or payment contract changed. Fixtures are injected only in the disposable source copy. No material deviation from the plan. Rollback is source-only, with no data operation.


## Validation results

2026-10-21, Node 24.21.0 / Next.js 16.3.8:

- `node scripts/rehearse-public-coach-schedule-ui.mjs --production --serve`: **13 groups passed**, zero page exceptions, optimized build/type checks and interfaces at 1440/320/375/430 px. New hanging/abort-ignoring late scenarios reach unavailable at 15 seconds, retain em dash/no time controls, discard later success, permit keyboard Retry and preserve filters. Existing request/UUID/concurrency fences, class/place/history changes, thirty-date/final page, legacy pending/withdrawal, guest privacy/no-JavaScript, keyboard focus/dialog and mobile controls all pass. Evidence remains ignored under `test-results/dev0399-schedule/`; final run log `work/dev0403/ui.log`.
- Native Safari at desktop (~1230px) and 375×844: hanging read became the unavailable panel, showing no false zero and retaining Boxing foundations/Chimosa. Mobile error text and Try again fit visibly within the page. Desktop transient failure → Try again restored 18 fixture starts with the same class/place. Native UI used only fictional in-memory transports; no real account or request write. This is distinct from DEV0404 hosted evidence.
- `npm test`: **438 passed**, zero failed/skipped. Canonical `npm run lint`, `npm run typecheck`, `NEXT_TELEMETRY_DISABLED=1 npm run build -- --webpack` passed. Final canonical lint/types passed again after backend fixture-only adjustments; snapshots were removed. No global test/type ignore changes. Final file/link/index/diff checks passed.
- No schema change is owned here; real SQL regressions (68) are recorded by DEV0402. Hosted deployment and real authenticated timing are owned by DEV0404.


## Risks, limitations, and follow-ups

Local acceptance is complete. Hosted rollout remains DEV0404; no independent review. No retained or production operation was performed by this ticket. Deadlines cannot turn unavailable reads into verified empty schedules.

## Completion and review references

- Completed: 2026-10-21 — local acceptance and required validation passed.
- Commit: Recorded with the implementation on `work/weekly-availability-repair`, as authorized by the user on 2026-10-21; subject `[DEV0403] Bound weekly availability loading and support retry`.
- Review: Source/evidence/acceptance self-review passed; no independent review.
- Deployment or release: Owned by DEV0404; local completion is not deployment.
