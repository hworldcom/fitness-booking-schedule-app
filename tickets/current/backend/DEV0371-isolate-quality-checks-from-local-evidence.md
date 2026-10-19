# Ticket DEV0371: Isolate quality checks from local evidence

- Status: Draft
- Created: 2026-10-19
- Last updated: 2026-10-19
- Milestone: QA follow-up
- Coordination: None — independent development ticket
- Related records: Evidence and dependency: [DEV0367 responsive QA](../../archive/organisatory/DEV0367-audit-athlete-coach-responsive-journeys.md).

## Objective and context

Root npm run lint and npm run typecheck fail on ignored scratch evidence, while a clean source copy passes. ESLint reports six no-explicit-any errors in tmp/dev0366/recover-first.ts and recover-second.ts. TypeScript scans incomplete copied modules under work/dev0336/commit-files because tsconfig includes every TypeScript file and excludes only node_modules. This makes routine verification depend on unrelated local evidence.

## Scope and non-goals

Exclude repository-local generated evidence/scratch trees from root lint and typecheck while preserving checks for application, maintained scripts, tests, config and Next.js generated route types. Exclude deletion of user evidence, weakening source checks, dependency updates and product behavior changes.

## Expected behavior and edge cases

Ignored generated scratch copies must not affect maintained-source lint/type checks. Tracked source, tests, scripts and generated route types remain checked. Existing evidence stays untouched, including partial copies that intentionally cannot compile on their own.

## Assumptions, decisions, and dependencies

The user requested a full QA audit. This record preserves its findings; implementation has not started. Retained accounts/content and unrelated workspace edits must be preserved. Repair implementation remains outside the audit; the scope is recorded for a future task.

## Implementation plan

1. Inspect existing ignore rules and identify only generated evidence directories.
2. Update ESLint global ignores and TypeScript exclusions consistently.
3. Verify checks in the existing dirty evidence workspace and a clean copy.
4. Confirm maintained scripts/tests still participate and document the boundary.

## Acceptance criteria

- [ ] AC1: npm run lint and npm run typecheck pass with the existing ignored scratch files preserved.
- [ ] AC2: Application, maintained script/test/config and Next route type checking remain enabled.

## Validation plan

Run root and clean-copy lint/typecheck. Inspect the resolved TypeScript file set and ESLint configuration for representative maintained files. No application UI test is necessary for a tooling-only exclusion change.

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
