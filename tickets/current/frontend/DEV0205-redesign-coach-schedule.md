# Ticket DEV0205: Redesign coach Schedule

- Status: Draft
- Created: 2026-10-12
- Last updated: 2026-10-12
- Milestone: Scheduling interface authenticated-workspace follow-up
- Coordination: [COR0018 — Authenticated workspace redesign](../organisatory/COR0018-authenticated-workspace-redesign.md)
- Related records: completed contract [DEV0202 — Adopt the authenticated workspace redesign contract](../../archive/organisatory/DEV0202-adopt-authenticated-workspace-redesign-contract.md), shell dependency [DEV0203 — Introduce the authenticated workspace shell](DEV0203-introduce-authenticated-workspace-shell.md), schedule baseline [DEV0179 — Edit a location-aware working week](../../archive/frontend/DEV0179-edit-location-aware-working-week.md) and color baseline [DEV0181 — Distinguish schedule location colors](../../archive/frontend/DEV0181-distinguish-schedule-location-colors.md)

## Objective and context

Bring the coach Schedule view into the approved authenticated visual system while retaining the efficient local multi-slot draft and one explicit save. Improve hierarchy around publication state, location legend, working week and dated capacity without changing schedule semantics.

## Scope and non-goals

- In scope: shared coach heading/navigation frame, Profile/Schedule/Bookings tabs, schedule instructions/status, location selector/legend, working-week grid, save feedback and dated occurrence summary.
- Out of scope: request queue/booking cards, profile/location editing, schedule persistence changes or new calendar behavior.

## Expected behavior and edge cases

- Schedule is the active middle tab in stable `Profile → Schedule → Bookings` navigation.
- Coaches choose location and multiple cells locally, then save once; selected cells retain text plus distinct color cues.
- Occupied, pending-request, closed, unavailable, stale-save and no-location states remain truthful and accessible.
- Suspended/pending/rejected access behavior remains unchanged.

## Assumptions, decisions, and dependencies

- DEV0203 supplies private shell framing.
- Existing schedule draft, palette and server actions remain authoritative.
- Preview dates/counts are illustrative and will not be introduced as fixtures.

## Implementation plan

1. Extract/refine the shared coach page heading/navigation boundary as needed.
2. Recompose schedule controls, legend, grid and states with scoped responsive styles.
3. Extend static/browser coverage for selection/save, location identity, unavailable/conflict states and breakpoints.
4. Run relevant tests and static/build checks.

## Acceptance criteria

- [ ] AC1: Schedule uses the authenticated hierarchy and stable coach navigation without moving Bookings/Profile content into the view.
- [ ] AC2: Location-aware multi-selection and one-save semantics remain unchanged and accessible.
- [ ] AC3: Occupied/request/closed/error and narrow-screen states retain text identity and usable controls.
- [ ] AC4: Relevant tests, lint, type-check, formatting and build pass.

## Validation plan

- Extend schedule component tests and authenticated Playwright at mobile/desktop widths.
- Rehearse select/change/save plus failure/conflict recovery against local runtime data.
- Run application tests and static/build checks.

## Implementation record

Pending implementation.

### Changes and rationale

Pending implementation.

### Affected files

| File or component | Change and purpose |
| ----------------- | ------------------ |
| Pending           | Pending.           |

### Decisions and deviations

None yet.

### Contracts, configuration, and operations

No schema/API/environment/dependency/migration change is planned.

## Validation results

Pending validation.

| Criterion | Evidence | Result  |
| --------- | -------- | ------- |
| AC1       | Pending  | Not run |
| AC2       | Pending  | Not run |
| AC3       | Pending  | Not run |
| AC4       | Pending  | Not run |

## Risks, limitations, and follow-ups

- The dense week grid must remain usable without shrinking touch targets or hiding location names.
- DEV0206 owns booking/request presentation even where dated schedule cells summarize capacity.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: No review created.
- Deployment or release: Not deployed or released.
