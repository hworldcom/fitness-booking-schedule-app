# Ticket DEV0370: Investigate group scheduling contention proof

- Status: Draft
- Created: 2026-10-19
- Last updated: 2026-10-19
- Milestone: QA follow-up
- Coordination: None — independent development ticket
- Related records: Evidence and dependency: [DEV0367 responsive QA](../../archive/organisatory/DEV0367-audit-athlete-coach-responsive-journeys.md).

## Objective and context

The first isolated broad run passed group/private races, but two correct-postgres-owner runs failed the overlapping-publication scenario with SQLSTATE 40001 (coach schedule changed; retry operation). Seven subsequent subtests/parent reported eight failures after cleanup at the end of the first failing subtest was skipped; a duplicate recurrence key appeared later. No successful double booking was observed. The repository maps this guard error to GroupSessionConflictError; whether the assertion, retry boundary or product recovery needs correction is unresolved.

The final full correctly owned database run passed 208 tests with zero failures and one intentional pre-migration-only skip, including this contention scenario. Preserve the two earlier failures as intermittent load/recovery evidence; the later pass neither reproduces a corruption defect nor resolves the earlier failure classification.

## Scope and non-goals

Reproduce group/private contention without retained-data changes, separate the first failure from cascade failures, and establish the intended authoritative conflict/retry outcome. Exclude unrelated scheduling redesign and weakening overlap constraints.

## Expected behavior and edge cases

At most one conflicting occupation succeeds. A losing caller receives a recoverable conflict without partial writes, can retry through the supported service, and does not contaminate the next independent test scenario. Cancellation releases only its own reservation.

## Assumptions, decisions, and dependencies

The user requested a full QA audit. This record preserves its findings; implementation has not started. Retained accounts/content and unrelated workspace edits must be preserved. Draft findings need the stated investigation before a repair scope is adopted; Ready is not an additional approval gate.

## Implementation plan

1. Run group-scheduling alone on correctly owned fresh migrations without concurrent QA load.
2. Inspect the first contention failure and service recovery, including exact retries.
3. Ensure scenario cleanup does not depend on prior assertion success.
4. Record a focused fix plan before changing runtime or assertions.

## Acceptance criteria

- [ ] AC1: The original failing interleaving is reproducible or bounded with explicit evidence.
- [ ] AC2: Concurrent successful publications/private bookings never overlap, losing callers receive a documented recoverable result, and independent scenarios do not inherit failed-test state.

## Validation plan

Use specification sections 10, 15.5 and 18. Run QA_GROUP=dev0336 QA_TESTS=application-auth,group-scheduling node scripts/rehearse-full-qa-database.mjs; validate conflict translation and actual owner recovery separately from SQL integrity.

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
