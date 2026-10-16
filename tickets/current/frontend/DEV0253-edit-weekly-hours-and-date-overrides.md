# Ticket DEV0253: Edit weekly hours and date overrides

- Status: Draft
- Created: 2026-10-16
- Last updated: 2026-10-16
- Milestone: M9 — Coach calendar and effective availability
- Coordination: [COR0023 — Coach calendar and availability](../organisatory/COR0023-coach-calendar-and-availability.md)
- Related records: contract owner [DEV0251](../../archive/organisatory/DEV0251-define-coach-calendar-and-availability.md); peer dependencies and external M7 relationships are mapped in COR0023.

## Objective and context

Replace individual weekly-cell editing with a compact location-aware range editor and whole-date override workflow inside coach Schedule → Availability, consuming DEV0252 authority.

Implement against [specification section 18](../../../docs/mvp-spec.md#18-coach-calendar-and-effective-availability), [M9](../../../docs/mvp-spec.md#12-delivery-milestones) and the [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix). Confirmed choices and adopted operating defaults are distinguished in the specification; reference Everfit controls are not additional requirements.

## Scope and non-goals

- In scope: Weekday switches, multiple location-bound ranges, deliberate copy replacement, local complete drafts and explicit Save; date selection/custom hours/all-day unavailable, override list/edit/removal/restoration preview; saved-result warnings, pending closure counts, retry/conflict and dirty-draft recovery; editor actions using DEV0252.
- Out of scope: Scheduling SQL authority; dated private/group calendar feed or grid; public coach date navigation; booking cancellation/rescheduling, group editing, service templates or changing one-hour private sessions.

## Expected behavior and edge cases

One date off replaces every venue. Retained private bookings and published groups stay visible with warnings even when outside the new hours; an occupied hour cannot appear requestable. Local invalid ranges and server stale/venue errors retain the draft. Restore previews use the current week, preserve manual closures, and never revive old requests. Multi-date batches are all-or-nothing; no automatic stale resubmit. Today edits only future hours; past dates are read-only.

## Assumptions, decisions, and dependencies

DEV0252 must stabilize and validate revision/save/warning/restoration contracts before live mutation integration. DEV0254 owns Schedule view/date navigation and shared calendar styles; agree the secondary Calendar/Availability selection and deep-link contract first. Reuse the existing coach frame and shared venue controls.

Scope review: this record owns one delivery boundary under a flat coordination. No runtime implementation has started. Keep Draft until the listed dependencies and concrete interface/validation prerequisites permit starting; Ready is not an extra approval gate. Inspect actual versions/bundled documentation before framework or SDK integration changes and update this plan before material deviations.

## Implementation plan

1. Inspect installed Next.js form/action/client guidance and existing location-aware draft/save tests; document the agreed DEV0252 action shapes and DEV0254 view/date integration before editing.
2. Build weekly day/range/location controls and accessible copy review as one complete local draft with explicit atomic save and meaningful pending/saved feedback.
3. Add date override selection/editor/list/edit/remove flow with explicit whole-day scope, retained-session warning/detail links and closure/restoration preview; keep booking/group actions in their own destinations.
4. Verify real local coach saves, reload, fresh/uncertain retries, stale baseline and inactive-location recovery plus desktop/mobile/keyboard and dirty-draft behavior; record evidence against each criterion.

## Acceptance criteria

- [ ] AC1: The owner composes multiple nonoverlapping venue ranges, day switches and deliberate copies locally and persists the complete week through one explicit save.
- [ ] AC2: Whole-date custom/day-off overrides save across venues and survive reload; edit/removal previews correctly describe retained sessions, pending closures and eligible current-week restoration.
- [ ] AC3: Validation, stale revision, inactive venue, unavailable/lost-response and navigation states preserve the proper draft and provide explicit recovery without false save success.
- [ ] AC4: Real local actions, desktop and 375/430 px layouts, keyboard/focus and relevant regression/static/build checks pass; unauthorised/suspended actors gain no editor authority.

## Validation plan

Extend meaningful existing schedule-draft/component coverage and the authenticated coach availability rehearsal for real range/copy/date saves, retained sessions, pending closures, restoration and conflict/retry. Check desktop and 375/430 px with keyboard, long venues, unavailable actions and dirty navigation. Run relevant tests, npm run test:coach-availability, npm run lint, npm run typecheck, npm run format:check and npm run build against the local stack. DEV0256 owns the final combined two-account rehearsal.

## Implementation record

Runtime implementation has not started. This is a planning record created by DEV0251.

### Changes and rationale

Allocated one peer with explicit ownership and dependencies so the full extension cannot be implemented under its documentation ticket or overlap existing M7 work.

### Affected files

Planned: src/features/coaches/coach-availability-panel.tsx, coach-schedule-draft.ts or their capability-owned replacements, src/app/coach/actions.ts, scoped styles and meaningful editor/rehearsal tests. Reuse existing frame/venue components; record exact files during implementation.

### Decisions and deviations

2026-10-16: Created from the confirmed feature scope and section 18 operating defaults. No runtime decisions/deviations or implementation evidence yet.

### Contracts, configuration, and operations

No runtime contract, dependency, environment variable, schema, migration or deployment changed by creating this record. The planned capability boundary is described above; record concrete data/API/setup/migration/rollback changes during implementation. Never record secrets.

## Validation results

Planning-document validation is recorded by DEV0251; it does not satisfy runtime criteria. Application/database/browser/static/build checks for this peer have not run because its runtime implementation has not started.

| Criterion | Evidence                                                      | Result  |
| --------- | ------------------------------------------------------------- | ------- |
| AC1–AC4   | Implementation and required peer-specific validation pending. | Not run |

## Risks, limitations, and follow-ups

Copy and date removal can affect many open hours. The preview/result must distinguish removed availability and closed pending requests from retained booked commitments; drafts must not silently cross actors or dates.

Handoff: the planned scope and validation exist; no runtime code or evidence exists under this record. Next action: satisfy the stated dependencies, inspect the affected current implementation and finalize its interface/migration details before marking In progress.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: Planning self-review only; no independent/runtime review.
- Deployment or release: None.
