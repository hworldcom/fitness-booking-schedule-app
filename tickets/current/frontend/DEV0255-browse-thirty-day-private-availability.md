# Ticket DEV0255: Browse thirty-day private availability

- Status: Draft
- Created: 2026-10-16
- Last updated: 2026-10-16
- Milestone: M9 — Coach calendar and effective availability
- Coordination: [COR0023 — Coach calendar and availability](../organisatory/COR0023-coach-calendar-and-availability.md)
- Related records: contract owner [DEV0251](../../archive/organisatory/DEV0251-define-coach-calendar-and-availability.md); peer dependencies and external M7 relationships are mapped in COR0023.

## Objective and context

Make the public coach schedule expose the complete adopted 30-local-date private horizon with usable date navigation and eligible requests, instead of retaining a seven-day interface over a larger backend inventory.

Implement against [specification section 18](../../../docs/mvp-spec.md#18-coach-calendar-and-effective-availability), [M9](../../../docs/mvp-spec.md#12-delivery-milestones) and the [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix). Confirmed choices and adopted operating defaults are distinguished in the specification; reference Everfit controls are not additional requirements.

## Scope and non-goals

- In scope: Public coach profile date groups/navigation/paging/canonical state, actual venue labels, eligible selection and authoritative empty/unavailable/beyond-horizon states; preserve guest browsing, sign-in return and existing request/approval behavior.
- Out of scope: Home/Explore date filters or coach search changes; scheduling authority/migrations; coach editor/calendar; group discovery/registration; new request lifecycle, minimum notice, variable durations or external calendar integration.

## Expected behavior and edge cases

Today excludes elapsed starts using server/database authority. The last included Berlin local date is available and the following date is not requestable, including DST/month boundaries. Override-removed/group-occupied times are absent; restoration exposes new eligible identities without reviving old attempts. Guest return URLs preserve the selected coach/date without accepting forged IDs. Empty is distinct from unavailable. No competitor count or private athlete/group roster leaks.

## Assumptions, decisions, and dependencies

DEV0252 must provide authoritative public effective inventory and horizon/eligibility. Reuse existing private-request actions/cards and the current public coach/location design. This ticket may proceed independently of coach calendar/editor UI once the backend contract passes.

Scope review: this record owns one delivery boundary under a flat coordination. No runtime implementation has started. Keep Draft until the listed dependencies and concrete interface/validation prerequisites permit starting; Ready is not an extra approval gate. Inspect actual versions/bundled documentation before framework or SDK integration changes and update this plan before material deviations.

## Implementation plan

1. Inspect installed Next.js search-param/navigation guidance and current public schedule/request components; document date/page parameters and bounded DEV0252 consumption before edits.
2. Replace hardcoded seven-day display assumptions with navigable date groups/pages across the authoritative 30-local-date horizon, maintaining venue labels, current public styling and usable no-JavaScript links/forms where existing flows support them.
3. Keep request selection/reload/sign-in return bound to real occurrence IDs and refresh stale/closed/occupied times using current server eligibility; do not create a second booking path.
4. Validate guest and real athlete use, horizon rollover without a coach visit, override/group/restoration changes, unavailable/empty states, back/reload and mobile/desktop/keyboard; record focused regression and static/build results.

## Acceptance criteria

- [ ] AC1: Guests and athletes can reach all published dates in the 30-local-date window through usable bounded public navigation with actual venues and stable URL/back/reload state.
- [ ] AC2: Requests use current authoritative occurrence IDs and eligibility; elapsed, outside-horizon, overridden or occupied time cannot be requested through stale/forged selections.
- [ ] AC3: Sign-in return, closed-time recovery and empty/unavailable states remain usable without candidate/athlete/roster leakage or invented inventory.
- [ ] AC4: Real guest/athlete mobile/desktop/keyboard and horizon/override/group/restoration scenarios plus relevant public/request/static/build checks pass.

## Validation plan

Extend existing public coach schedule and athlete request tests for first/last/outside-horizon dates, Berlin DST/rollover, new restored occurrence IDs, stale selection and privacy. Exercise real local guest/athlete navigation and sign-in return without opening coach Schedule, including mobile 375/430 px, desktop, keyboard and unavailable data. Run relevant public/browser/request suites, npm run test:client-requests, lint, typecheck, format:check and build; DEV0256 owns combined evidence.

## Implementation record

Runtime implementation has not started. This is a planning record created by DEV0251.

### Changes and rationale

Allocated one peer with explicit ownership and dependencies so the full extension cannot be implemented under its documentation ticket or overlap existing M7 work.

### Affected files

Planned: src/app/coaches/[slug]/page.tsx and its capability-owned public schedule/request components and tests. Reuse existing actual-venue grouping and request cards; record exact affected paths during implementation.

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

Expanding backend generation alone leaves late-window dates unreachable. Treat complete public navigation and forged/stale boundary denial as separate observable requirements, while preserving Explore without date filters.

Handoff: the planned scope and validation exist; no runtime code or evidence exists under this record. Next action: satisfy the stated dependencies, inspect the affected current implementation and finalize its interface/migration details before marking In progress.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: Planning self-review only; no independent/runtime review.
- Deployment or release: None.
