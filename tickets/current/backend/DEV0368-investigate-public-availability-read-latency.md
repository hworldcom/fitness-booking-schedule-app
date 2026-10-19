# Ticket DEV0368: Investigate public availability read latency

- Status: Draft
- Created: 2026-10-19
- Last updated: 2026-10-19
- Milestone: QA follow-up
- Coordination: None — independent development ticket
- Related records: Evidence and dependency: [DEV0367 responsive QA](../../archive/organisatory/DEV0367-audit-athlete-coach-responsive-journeys.md).

## Objective and context

Public Home, Explore and coach pages respond slowly with a small local catalog. During QA, development responses took 31.339/41.459/36.716 seconds; an otherwise idle configured production preview took 7.608/7.694/11.135 seconds. Seven visible coaches included one disposable QA coach with five dates of availability. This is an observed latency problem; synchronization cost is a profiling lead, not a proven root cause.

After removing that QA dataset, the same configured production preview still took 5.226 seconds for Home and 4.733 seconds for Explore with the six retained coaches. The removed QA coach URL returned 404 in 0.029 seconds. This distinguishes the retained-data baseline from the larger fixture observation; neither identifies the dominant cost without profiling.

## Scope and non-goals

Profile server/database work for public discovery and schedule previews; define one focused optimization after measuring. Preserve actual availability, guest count privacy, typed duration fitting and retained data. Exclude visual redesign and changing scheduling rules.

## Expected behavior and edge cases

Public reads must preserve accurate current counts, eligible full-duration starts, unavailable versus verified-zero states and guest privacy. Repeated reads must not require unnecessary work proportional to unrelated inventory. Cold/warm reads and concurrent visitors need distinct measurements.

## Assumptions, decisions, and dependencies

The user requested a full QA audit. This record preserves its findings; implementation has not started. Retained accounts/content and unrelated workspace edits must be preserved. Draft findings need the stated investigation before a repair scope is adopted; Ready is not an additional approval gate.

## Implementation plan

1. Reproduce cold/warm measurements with retained local data and disposable scale fixtures.
2. Attribute time to queries, synchronization, connection work and rendering.
3. Update the scope before a focused fix; split implementation if distinct causes require it.
4. Prove unchanged availability/privacy and record before/after timings.

## Acceptance criteria

- [ ] AC1: Reproducible timings and query-level attribution identify the dominant cost.
- [ ] AC2: A bounded repair plan states its files, correctness checks and measured improvement criteria before implementation.

## Validation plan

Use the current public contract in specification sections 4.2, 18 and 19. Run representative Home/Explore/coach requests and inspect query plans in disposable data; retain meaningful duration, override, concurrency and guest-time privacy checks.

## Implementation record

### Changes and rationale

No repair implemented. DEV0367 created this follow-up from current-working-tree evidence.

### Affected files

Pending investigation; the audit owns only this planning record and index entry.

### Decisions and deviations

2026-10-19: Preserve the observed failure separately from any inferred cause.

### Contracts, configuration, and operations

No changes made. Future implementation must record actual compatibility/configuration effects and exact cleanup.

## Validation results

DEV0367 supplies the baseline described above. This ticket's own acceptance checks have not run.

| Criterion | Evidence | Result |
| --- | --- | --- |
| AC1 | Repair/investigation pending | Not run |
| AC2 | Repair/investigation pending | Not run |

## Risks, limitations, and follow-ups

A failed QA assertion is not automatically a proven product defect. Preserve the initial evidence and distinguish test setup, expected conflicts and actual regressions. Next action: execute this ticket's first planning step.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: No independent review.
- Deployment or release: Not performed.
