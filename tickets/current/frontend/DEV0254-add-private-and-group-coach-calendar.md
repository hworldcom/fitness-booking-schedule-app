# Ticket DEV0254: Add the private and group coach calendar

- Status: Draft
- Created: 2026-10-16
- Last updated: 2026-10-16
- Milestone: M9 — Coach calendar and effective availability
- Coordination: [COR0023 — Coach calendar and availability](../organisatory/COR0023-coach-calendar-and-availability.md)
- Related records: contract owner [DEV0251](../../archive/organisatory/DEV0251-define-coach-calendar-and-availability.md); peer dependencies and external M7 relationships are mapped in COR0023.

## Objective and context

Deliver the coach-facing Day/Week/Month calendar with Week as default, combining truthful dated private and published group records and linking their original authorized detail workflows.

Implement against [specification section 18](../../../docs/mvp-spec.md#18-coach-calendar-and-effective-availability), [M9](../../../docs/mvp-spec.md#12-delivery-milestones) and the [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix). Confirmed choices and adopted operating defaults are distinguished in the specification; reference Everfit controls are not additional requirements.

## Scope and non-goals

- In scope: Actor-scoped read-only period projection/service and cursor paging for at most 42 local dates; Calendar/Availability secondary view and canonical period/filter state; Day/Week/Month and agenda, navigation/current-time marker, venue/type/history filters, month overflow and original-ID detail links. This ticket owns calendar-read integration as part of its frontend vertical slice.
- Out of scope: Effective availability or write SQL owned by DEV0252; weekly/date editor owned by DEV0253; private/group booking decisions, group publication/roster/editor, athlete-wide conflict guarantees, public date controls or external synchronization.

## Expected behavior and edge cases

Open groups reserve time but are not Confirmed; group drafts are absent. A pending private request is a coach-only count rather than a reserved event. Confirmed past private bookings do not auto-complete. Keep actual snapshot venues through primary changes/deactivation. Cancelled/withdrawn history cannot appear as free capacity. Outside-horizon cells show no invented private availability, while real future groups remain visible. All paged results remain reachable without exposing athlete identities/photos or private notes in the calendar feed.

## Assumptions, decisions, and dependencies

DEV0252 provides effective dated inventory; DEV0238 externally provides stable group reservation/lifecycle behavior. Coordinate existing/planned DEV0239 owner group-detail links without implementing that ticket. Final actionable group links require its authorized destination to exist; do not claim a complete mixed flow with an inert placeholder. DEV0253 shares view/date integration and styles.

Scope review: this record owns one delivery boundary under a flat coordination. No runtime implementation has started. Keep Draft until the listed dependencies and concrete interface/validation prerequisites permit starting; Ready is not an extra approval gate. Inspect actual versions/bundled documentation before framework or SDK integration changes and update this plan before material deviations.

## Implementation plan

1. Inspect installed Next.js server-data/navigation docs and inventory existing request/booking/group projections and original-ID destinations. Specify a bounded owner period DTO and canonical date/view/type/venue/history parameters before implementing the feed.
2. Implement the read-only actor/dataset-scoped period projection, complete cursor traversal and truthful lifecycle summaries using DEV0252 inventory and existing group authority; recheck current access on each page.
3. Build Day/Week/Month, default Week, Today/previous/next, filters, current-time marker and complete agenda. Month shows three summaries plus exact More count opening a full day agenda; preserve URL/back/reload/focus.
4. Integrate selected-date availability links with DEV0253 and original private/group details without creating implicit sessions. Verify real mixed data, paging/overflow, history, mobile/keyboard, access failures and existing private-workspace regressions.

## Acceptance criteria

- [ ] AC1: All three views show real actor-scoped private/group dates, kinds, actual venues and states; Week is default and request counts remain coach-only.
- [ ] AC2: Period queries are bounded/paged and every result remains reachable; filters, More/day agenda, browser navigation and dates beyond the private horizon behave truthfully.
- [ ] AC3: Selections reach real authorized original details/editor contexts; no implicit booking, request decision, group publication or athlete-data grant occurs.
- [ ] AC4: Desktop/375/430 px, keyboard, crowded-month, long venue/history, dirty-editor transition and unavailable/access-state checks plus relevant projection/privacy/static/build tests pass.

## Validation plan

Use meaningful period projection tests for actor/dataset isolation, mixed lifecycle, exact venue snapshots, 42-date bounds, paging and private-field absence. Run real local coach browser checks through Day/Week/Month/agenda, type/venue/history filters, selected-date editor and existing private/group details with back/reload. Cover month overflow, groups beyond 30 dates, 375/430 px, keyboard, suspended/hidden/unavailable states; run relevant tests, lint, typecheck, format:check and build. DEV0256 owns final combined closure/restoration/public recovery proof.

## Implementation record

Runtime implementation has not started. This is a planning record created by DEV0251.

### Changes and rationale

Allocated one peer with explicit ownership and dependencies so the full extension cannot be implemented under its documentation ticket or overlap existing M7 work.

### Affected files

Planned: src/app/coach/page.tsx and capability-owned calendar components/styles; narrow server/domain calendar read projection; original-ID detail links and focused projection/browser tests. Preserve existing booking identity/media/note permissions.

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

A combined visual calendar can mislabel tentative groups or pending requests as confirmed capacity, or silently truncate a busy month. Exact state labels, cursor completion and original detail permissions are acceptance requirements.

Handoff: the planned scope and validation exist; no runtime code or evidence exists under this record. Next action: satisfy the stated dependencies, inspect the affected current implementation and finalize its interface/migration details before marking In progress.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: Planning self-review only; no independent/runtime review.
- Deployment or release: None.
