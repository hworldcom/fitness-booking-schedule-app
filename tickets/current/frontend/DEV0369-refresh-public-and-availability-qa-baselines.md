# Ticket DEV0369: Refresh public and availability QA baselines

- Status: Draft
- Created: 2026-10-19
- Last updated: 2026-10-19
- Milestone: QA follow-up
- Coordination: None — independent development ticket
- Related records: Evidence and dependency: [DEV0367 responsive QA](../../archive/organisatory/DEV0367-audit-athlete-coach-responsive-journeys.md).

## Objective and context

The configured Chrome suite ended at 17 passed, 35 failed and 10 skipped. Failures include obsolete five-coach fixtures, old coach titles/URLs and empty-state copy, removed Demonstration data, ambiguous Become a coach and discipline selectors, exact legacy return URLs, and navigation deadlines shorter than observed response times. The isolated availability rehearsal also stops at an absent Bookings fixture link after its weekly/date scenarios pass.

The typed-session real UI runner's existing database wrapper stops migrations at 009, so the current owner group page initially failed on missing Events-media functions. A QA-only ignored wrapper replayed the current migration set; the unchanged UI rehearsal then passed all 14 checks and cleaned its two Auth identities and disposable database. Repair the maintained UI setup without silently replacing the intentional old-schema upgrade fixture used by database tests.

## Scope and non-goals

Refresh existing public and availability test fixtures/assertions against delivered requirements. Isolate owned data, distinguish timing and rapid-navigation behavior from stale assertions, and preserve useful keyboard/map/privacy coverage. Exclude product behavior changes and merely increasing timeouts to hide performance issues.

## Expected behavior and edge cases

Tests must exercise the current supported controls with isolated fixtures and stable user-visible outcomes. Wrong selectors, missing capabilities and short navigation deadlines must be identified separately from real behavior failures; data counts must derive from the fixture rather than retained demo assumptions.

## Assumptions, decisions, and dependencies

The user requested a full QA audit. This record preserves its findings; implementation has not started. Retained accounts/content and unrelated workspace edits must be preserved. Draft findings need the stated investigation before a repair scope is adopted; Ready is not an additional approval gate.

## Implementation plan

1. Map each failing assertion to the current specification and runtime.
2. Correct stale assertions and deterministic fixture/capability setup, splitting unrelated test work if needed.
3. Await completed discipline navigation before testing retained hidden inputs, while adding a separate rapid-submit investigation if the interaction is a product defect.
4. Run both viewport projects and the availability rehearsal; document honest skips.

## Acceptance criteria

- [ ] AC1: Every old failure is classified with its replacement assertion or a linked product defect.
- [ ] AC2: Maintained tests cover current guest counts, username links, public navigation, mobile map recovery and availability draft recovery using deterministic data.

## Validation plan

Use specification sections 4.2, 11, 18 and 19. Run npm run test:e2e against a correctly configured production build and node scripts/rehearse-availability-editor-ui.mjs. Do not treat current QA fixture count seven as a new fixed expectation.

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
