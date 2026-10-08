# Ticket DEV0146: Save weekly schedule in one action

- Status: Completed
- Created: 2026-10-08
- Last updated: 2026-10-08
- Milestone: Scheduling-only M3 interface follow-up
- Coordination: None — independent development ticket
- Related records: [DEV0115 — Add the coach schedule calendar](../../archive/frontend/DEV0115-add-coach-schedule-calendar.md), [DEV0114 — Persist recurring coach availability](../../archive/backend/DEV0114-persist-recurring-coach-availability.md), [DEV0143 — Present the scheduling-only experience](../../archive/frontend/DEV0143-present-scheduling-only-experience.md)

## Objective and context

The protected coach working-week editor currently submits a server action for every selected or deselected one-hour cell. Each click waits for an authenticated database transaction, occurrence synchronization, route revalidation and a fresh render, so composing a weekly schedule feels slow and prevents quick multi-selection.

Change the editor into a draft-and-save flow: cell clicks update only local browser state, while an explicit save persists the complete selected week in one authenticated request and one atomic database operation. This refines the coach availability behavior in the [scheduling permissions](../../../docs/mvp-spec.md#9-scheduling-behavior-and-permissions), [definition of done](../../../docs/mvp-spec.md#11-definition-of-done) and [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix).

## Scope and non-goals

- In scope:
  - let a coach select and deselect multiple whole-hour weekly cells without a network or database mutation per click;
  - show the draft selected-hour count and whether changes are unsaved;
  - provide an explicit `Save schedule` control that replaces the active weekly rule set in one server action;
  - validate the complete submitted grid server-side, preserve actor/profile authorization and reject stale concurrent edits without partial persistence;
  - withdraw only future open occurrences for removed rules, preserve held/booked occurrences, create new rules and synchronize the seven-day occurrence horizon once;
  - preserve accessible keyboard buttons and responsive desktop/mobile behavior;
  - update the specification, focused tests and durable ticket evidence.
- Out of scope:
  - changing one-hour granularity, the seven-day horizon, timezone/location snapshots or booking capacity;
  - one-off availability, drag selection, schedule templates, external calendar synchronization or auto-save;
  - changing coach visibility, booking, cancellation or completion behavior.

## Expected behavior and edge cases

- Selecting or deselecting a cell changes its pressed state and draft counts immediately without submitting the form.
- The save control is disabled until the draft differs from the persisted schedule and while a save is pending.
- Saving sends the bounded complete draft plus the schedule version the editor started from. The server validates every cell and atomically applies additions/removals for the authorized visible coach.
- A successful save refreshes authoritative rules and dated occurrences, clears the unsaved state and reports success.
- If the same schedule is submitted, no unnecessary rule or occurrence mutation is performed.
- If another tab changes the persisted week after editing began, saving reports a conflict and leaves both the authoritative database state and the local draft intact for review/retry.
- Invalid, duplicate, oversized, signed-out, forbidden, hidden-coach and unavailable requests fail closed with bounded messages and no partial state.
- Booked or held dated occurrences belonging to removed rules remain unchanged; only their future open siblings are withdrawn.

## Assumptions, decisions, and dependencies

- The confirmed product behavior remains recurring whole-hour availability in the coach timezone; only the editing/persistence interaction changes.
- The authoritative operation belongs in PostgreSQL as a security-definer function so rule replacement, open-occurrence withdrawal and one final synchronization share one atomic statement/transaction boundary.
- Optimistic concurrency uses the complete persisted rule-key set rendered with the page as the expected baseline. This avoids silently overwriting another tab's saved schedule without adding a schema version column.
- Existing authentication, actor context, visible-profile/location requirements and database constraints remain authoritative dependencies.
- Review found one cohesive vertical slice rather than separable deliverables: the local editor and atomic replacement endpoint must ship together to satisfy the requested experience, so no coordination split is required.

## Implementation plan

1. Add bounded domain parsing/validation for a complete weekly rule-key set and focused unit coverage.
2. Add an additive migration for one authorized atomic replacement function with stale-baseline detection, one synchronization pass and least-privilege grants; expose it through the repository/service boundary.
3. Replace per-cell submission with local draft toggles, hidden complete-set inputs and an explicit save control; keep counts, pending/error states and responsive keyboard behavior clear.
4. Update focused component/database/browser coverage and clarify the draft-and-save behavior in the specification.
5. Run focused tests, database validation, lint, type checking, formatting, production build and responsive manual/browser checks; review the final diff against this ticket.

## Acceptance criteria

- [x] AC1: A coach can toggle multiple weekly cells immediately without invoking the save action, and one explicit `Save schedule` control persists the complete draft.
- [x] AC2: The save operation atomically adds/removes the authorized coach's active rules, synchronizes occurrences once and preserves booked/held occurrences for removed rules.
- [x] AC3: Invalid, unauthorized or stale-baseline submissions fail without partially changing the persisted schedule, and the editor retains the unsaved draft after a recoverable failure.
- [x] AC4: Selected counts, dirty/pending/saved/error states and keyboard-operable controls remain usable at desktop and mobile widths.
- [x] AC5: The specification and ticket record describe the new explicit-save contract, and relevant automated/build checks pass.

## Validation plan

- Add domain tests for valid canonical sets plus malformed, duplicate and oversized payloads.
- Extend repository/database tests to prove multi-rule replacement, no-op saves, stale-baseline rejection, occurrence synchronization and booked/open removal behavior.
- Update component tests to prove cells are non-submit toggles and a disabled-by-default save control is present with draft guidance.
- Add or extend authenticated browser coverage when the local Auth/database harness supports the coach workspace; manually verify rapid multi-select, one save, success, reload, failure retention, keyboard operation and responsive layout at representative desktop/mobile widths.
- Run `npm test`, `npm run test:db`, `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build:vercel`, relevant Playwright checks and `git diff --check`. Record exact results and any environment limitation.

## Implementation record

### Changes and rationale

The prior working-week cells were submit buttons. Selecting one invoked `mutateCoachAvailabilityRuleAction`, opened an authenticated transaction, called one create/remove database function, synchronized occurrences and revalidated the page before the coach could continue. This made composing a week proportional to network/database latency.

The editor now initializes a browser-local set from authoritative active rules. Each accessible cell is a non-submit toggle that updates the selected count and an `Unsaved` state immediately. The explicit `Save schedule` control sits above the grid, is disabled when the draft matches the saved baseline, and submits the complete selected key set plus that baseline once. A successful response adopts the draft as the new baseline; conflict/unavailable responses retain it for review.

The server accepts only a bounded unique set of the 161 possible weekday/hour keys. PostgreSQL locks the coach schedule, verifies the submitted baseline, soft-removes omitted rules, withdraws only their future open occurrences, creates added rules, and performs one occurrence synchronization. A stale baseline returns a conflict sentinel without mutation. Existing actor context, visible-profile/location checks, restricted runtime grant and row-level security remain authoritative.

### Affected files

| File or component                                                                                                                                                                                                                     | Change and purpose                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`src/features/coaches/coach-availability-panel.tsx`](../../../src/features/coaches/coach-availability-panel.tsx)                                                                                                                     | Replaced per-cell submission with local multi-selection, draft/saved baselines, explicit save state and an above-grid save bar.                               |
| [`src/app/coach-workspace.css`](../../../src/app/coach-workspace.css)                                                                                                                                                                 | Styled the desktop/mobile save state and full-width mobile action without changing the responsive hour grid.                                                  |
| [`src/app/coach/actions.ts`](../../../src/app/coach/actions.ts), [`src/app/coach/page.tsx`](../../../src/app/coach/page.tsx)                                                                                                          | Replaced the single-cell action contract with one complete-week action and wired it into the coach workspace.                                                 |
| [`src/domain/coaches.ts`](../../../src/domain/coaches.ts)                                                                                                                                                                             | Added canonical weekly rule keys and bounded JSON set validation for all 7 × 23 supported cells.                                                              |
| [`src/server/coaches/service.ts`](../../../src/server/coaches/service.ts), [`src/server/db/coaches/availability-repository.ts`](../../../src/server/db/coaches/availability-repository.ts)                                            | Added the authorized complete-set service/repository boundary and mapped stale/conflicting replacement to the existing bounded outcome.                       |
| [`supabase/migrations/20261008000100_replace_recurring_coach_availability.sql`](../../../supabase/migrations/20261008000100_replace_recurring_coach_availability.sql)                                                                 | Added the security-definer atomic replacement function, optimistic baseline check, open-occurrence withdrawal, one-pass synchronization and restricted grant. |
| [`supabase/migrations/20261008000200_fix_weekly_schedule_coalesce.sql`](../../../supabase/migrations/20261008000200_fix_weekly_schedule_coalesce.sql)                                                                                 | Corrected the first migration's runtime-invalid schema qualification of SQL `COALESCE` through a forward migration after local application exposed it.        |
| [`tests/coaches.test.ts`](../../../tests/coaches.test.ts), [`tests/coach-schedule.test.ts`](../../../tests/coach-schedule.test.ts), [`tests/database/coach-availability.test.ts`](../../../tests/database/coach-availability.test.ts) | Covered set normalization/rejection, non-submit cells/save control and atomic/no-op/stale/preservation database behavior.                                     |
| [`scripts/rehearse-local-coach-availability.mjs`](../../../scripts/rehearse-local-coach-availability.mjs)                                                                                                                             | Updated the authenticated rehearsal for draft selection, one explicit save, current public copy and request counting.                                         |
| [`docs/mvp-spec.md`](../../../docs/mvp-spec.md), [`supabase/README.md`](../../../supabase/README.md), [`tickets/README.md`](../../README.md)                                                                                          | Recorded the explicit-save product/database contract and work status.                                                                                         |

### Decisions and deviations

- 2026-10-08: Initial review retained one independent vertical-slice ticket because browser-only drafting without an atomic complete-set save would not satisfy the requested latency or consistency outcome.
- 2026-10-08: The save control moved above the grid after responsive review showed that placing it after all 23 mobile rows made the primary action unnecessarily distant.
- 2026-10-08: The first new migration was already applied locally when execution exposed that `COALESCE` cannot be schema-qualified. A second forward correction preserves the applied history instead of resetting the local database or silently rewriting the applied step.

### Contracts, configuration, and operations

The client/server action contract changes from one `scheduleCell` intent to two JSON string fields: `selectedRules` is the complete desired key set and `expectedRules` is the editor's saved baseline. Each key is canonical `ISO_WEEKDAY|HH:00`; both sets are unique, bounded to 161 entries and validated server-side.

Two additive local migrations were applied with `npx supabase migration up --local`; no database reset occurred and existing accounts/bookings were preserved. Deployments must apply both migrations before the updated application. No environment variables, dependencies, table shapes or public route contracts changed. Rollback is an application rollback plus a reviewed forward database correction; the additive function can remain unused safely.

## Validation results

- Date and environment: 2026-10-08, macOS local workspace, Node.js 24.21.0, Next.js 16.3.8, Auth-enabled local Supabase/PostgreSQL and Chrome.
- `npm test`: passed 59/59 unit/static tests, including canonical complete-set validation and non-submit weekly cells with one save control.
- `npm run typecheck`: passed after Next route type generation.
- `npm run lint`: passed with no ESLint findings.
- `npm run format:check`: passed; all configured files matched Prettier.
- `npm run build:vercel`: passed in guarded public-preview mode; production compilation, TypeScript, page-data collection and all 11 static generations completed.
- `npm run db:lint`: passed with no schema errors after both forward migrations.
- `npm run test:db`: 28/29 passed. The new complete-week test passed multi-rule creation, a no-op save with stable rule IDs, booked-occurrence preservation, open-occurrence withdrawal, replacement materialization and stale-baseline rejection. The sole failure is the pre-existing shared-local-state foundation assertion (`6 !== 11`) caused by provisioned fixture coach accounts; no reset was used because the local database contains user booking/schedule data.
- `npm run test:coach-availability`: passed an authenticated desktop/mobile run for two draft selections, one save, two public occurrences, two draft removals, one save, keyboard focus and responsive layout. Later repeat attempts reached the local Auth email quota before sign-in and did not exercise the schedule; they do not contradict the completed passing run.
- `npm run test:e2e`: 26/28 passed. Both failures were the same discovery fixture-count assertion expecting exactly `5 coaches`; the shared local database had additional visible `DEV0104 Coach` profiles created by the authenticated rehearsal. All other desktop/mobile browser checks passed.
- `git diff --check`: passed.
- Live authenticated Chrome check with Daniel Park: the saved editor showed 16 hours and a disabled save action; selecting Saturday 10:00 and 11:00 changed the UI immediately to `18 selected hours · Unsaved` and enabled save. A direct PostgreSQL read still showed 16 active rules and zero persisted drafted Saturday rules. Reload discarded the draft and restored 16 saved hours. The test deliberately did not press save against the user's Daniel schedule.

| Criterion | Evidence                                                                                                                                                    | Result |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Static component coverage, passing authenticated rehearsal and live 16→18 draft check with unchanged PostgreSQL state.                                      | Passed |
| AC2       | Passing focused database replacement test covering atomic addition/removal, one resultant rule set and booked/open occurrence behavior.                     | Passed |
| AC3       | Domain malformed/duplicate/oversized tests plus database stale-baseline test; live unsaved draft survived local toggles and was safely discarded by reload. | Passed |
| AC4       | Component accessibility assertions, authenticated desktop/mobile screenshots/rehearsal, keyboard focus and live disabled/enabled save states.               | Passed |
| AC5       | Specification/database documentation updated; unit, lint, type, format, database-lint and Vercel build checks passed.                                       | Passed |

## Risks, limitations, and follow-ups

- The optimistic baseline detects another completed schedule save, but it does not merge two competing drafts; the later coach must refresh and reapply intended changes.
- Existing explicitly dated legacy availability remains outside the weekly rule editor and is intentionally not replaced.
- Shared local rehearsal profiles currently make the hard-coded five-coach discovery test fail until that disposable data is removed or the local database is reset; neither cleanup was performed because it is unrelated to this ticket and the user has active local data.

## Completion and review references

- Completed: 2026-10-08 — coaches now compose weekly availability locally and persist the complete validated week through one explicit atomic save.
- Commit: Included in `[DEV0146] Save weekly schedule in one action`.
- Review: Self-review completed against the ticket scope, final diff and acceptance criteria; no independent review or pull request exists.
- Deployment or release: Not deployed. Both new migrations are applied only to the local Supabase environment and the updated dev server is running on port 3100.
