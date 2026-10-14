# Ticket DEV0208: Polish authenticated workspace accessibility

- Status: Ready
- Created: 2026-10-12
- Last updated: 2026-10-12
- Milestone: Scheduling interface authenticated-workspace follow-up
- Coordination: [COR0018 — Authenticated workspace redesign](../organisatory/COR0018-authenticated-workspace-redesign.md)
- Related records: completed integration dependencies [DEV0203 — Introduce the authenticated workspace shell](../../archive/frontend/DEV0203-introduce-authenticated-workspace-shell.md), [DEV0204 — Redesign client My sessions](../../archive/frontend/DEV0204-redesign-client-my-sessions.md), [DEV0205 — Redesign coach Schedule](../../archive/frontend/DEV0205-redesign-coach-schedule.md), [DEV0206 — Redesign coach Bookings](../../archive/frontend/DEV0206-redesign-coach-bookings.md) and [DEV0207 — Redesign account and coach Profiles](../../archive/frontend/DEV0207-redesign-account-and-coach-profiles.md); public integration peer [DEV0201 — Polish public marketplace accessibility](../../archive/frontend/DEV0201-polish-public-marketplace-accessibility.md)

## Objective and context

Perform the final cross-page accessibility, responsive and failure-state pass for the authenticated redesign after each owning page ticket meets its criteria. Remove residual legacy inconsistencies without absorbing missing peer implementation.

## Scope and non-goals

- In scope: landmarks/headings, focus order/visibility, live states, reduced motion, touch targets, mobile safe areas, long text, overflow, navigation/content obstruction and representative actor/state integration.
- Out of scope: new data/features, backend changes, public marketplace implementation owned by COR0017 or unmet page-ticket criteria.

## Expected behavior and edge cases

- My sessions, Coach Profile/Schedule/Bookings and account Profile form one coherent keyboard- and screen-reader-oriented private workspace.
- 375, 430, 768, 1024 and 1440 pixel layouts have no clipped controls, hidden content, horizontal overflow or bottom-navigation obstruction.
- Ordinary, approved, pending/rejected and suspended actors see only authorized destinations/actions.
- Empty, unavailable, conflict, missing-image, map/search-failure and action-result states retain truthful next steps.

## Assumptions, decisions, and dependencies

- DEV0203-DEV0207 must meet their own acceptance criteria first.
- Automated checks supplement rather than replace manual keyboard/responsive review.
- Integration fixes must remain small; larger page defects return to the owning ticket.

## Implementation plan

1. Build the authenticated route/actor/state/viewport matrix.
2. Run automated and manual keyboard, semantics, reduced-motion and responsive audits.
3. Apply bounded integration fixes and consolidate redundant styles only where safe.
4. Run the complete relevant application/browser/build matrix and update COR0018.

## Acceptance criteria

- [ ] AC1: Representative authenticated routes pass documented landmark, keyboard, focus and reduced-motion review.
- [ ] AC2: All five target widths pass without overflow, obstruction, clipped text or undersized primary controls.
- [ ] AC3: Representative actor and ready/empty/unavailable/failure states preserve correct destinations and actions.
- [ ] AC4: Relevant full tests, browser projects, lint, type-check, formatting and production build pass with integration evidence recorded in COR0018.

## Validation plan

- Add/extend Playwright across client/coach/applicant/suspended states and target viewports.
- Manually tab through each primary private route, action boundary and public/private transition with reduced motion.
- Run `npm test`, relevant database/auth rehearsals, complete authenticated Playwright projects, lint, type-check, format, build and `git diff --check`.

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

No data/API/schema/provider/environment/migration change is planned. Any new accessibility dependency requires a ticket update before installation.

## Validation results

Pending validation.

| Criterion | Evidence | Result  |
| --------- | -------- | ------- |
| AC1       | Pending  | Not run |
| AC2       | Pending  | Not run |
| AC3       | Pending  | Not run |
| AC4       | Pending  | Not run |

## Risks, limitations, and follow-ups

- Local authenticated browser coverage depends on Supabase Auth/PostgreSQL and provisioned representative actors.
- This ticket must not become a catch-all for backend or session-collaboration work.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: No review created.
- Deployment or release: Not deployed or released.
