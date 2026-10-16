# Ticket DEV0256: Rehearse calendar and availability

- Status: Draft
- Created: 2026-10-16
- Last updated: 2026-10-16
- Milestone: M9 — Coach calendar and effective availability
- Coordination: [COR0023 — Coach calendar and availability](../organisatory/COR0023-coach-calendar-and-availability.md)
- Related records: contract owner [DEV0251](../../archive/organisatory/DEV0251-define-coach-calendar-and-availability.md); peer dependencies and external M7 relationships are mapped in COR0023.

## Objective and context

Prove the complete adopted calendar/availability flow with real local coach and athlete accounts, authoritative database outcomes and responsive recovery after all M9 runtime peers deliver.

Implement against [specification section 18](../../../docs/mvp-spec.md#18-coach-calendar-and-effective-availability), [M9](../../../docs/mvp-spec.md#12-delivery-milestones) and the [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix). Confirmed choices and adopted operating defaults are distinguished in the specification; reference Everfit controls are not additional requirements.

## Scope and non-goals

- In scope: Tagged loopback-only rehearsal fixtures/cleanup and a reproducible command; combined private/group/calendar/editor/public-date/request flows; actual concurrency/recovery/privacy assertions and desktop/mobile/keyboard evidence; README command documentation and durable integration handoff.
- Out of scope: Implementing missing peer features under a test ticket, resetting shared data, hosted deployment, repeating independent M7 lifecycle implementation, external calendar/provider setup or simulating away required real application/database flows.

## Expected behavior and edge cases

Use at least one approved coach with two venues, two athletes, pending and confirmed private sessions, policy/manual closures and real published groups. Include group time beyond the old seven-day horizon, cancellation on a retained day off, restored new occurrence identities, month overflow and no coach visit on horizon advancement. Unavailable/uncertain/stale responses must show honest recovery; private responses must not contain unrelated athletes or coach-private metadata.

## Assumptions, decisions, and dependencies

DEV0252–DEV0255 must complete their required checks. DEV0238 completed isolated guard/publication validation, but its migration still needs the documented local rollout before the real rehearsal; the group owner detail flow needed by DEV0254 remains a separate delivery prerequisite. Discover current namespace/migration/fixture state before setup. Existing M7 and note/application work remain independent; final rehearsal cannot silently omit group links or overwrite their fixtures.

Scope review: this record owns one delivery boundary under a flat coordination. No runtime implementation has started. Keep Draft until the listed dependencies and concrete interface/validation prerequisites permit starting; Ready is not an extra approval gate. Inspect actual versions/bundled documentation before framework or SDK integration changes and update this plan before material deviations.

## Implementation plan

1. Map the section 18 acceptance scenarios to exact peer evidence and define isolated tagged local fixtures/cleanup, prerequisites and one reproducible command. Record real app/stack versions and forbid non-loopback targets.
2. Exercise weekly copy/range saves, custom/day-off override, retained private/group warnings, pending closure, reload and explicit restoration; follow original request/booking/group links and verify history/new request identities.
3. Exercise all calendar views/filters/overflow and complete public 30-day navigation/requests with time-boundary and concurrency evidence. Combine relevant existing M7/M8 authorization/card/race suites rather than inventing browser-only authority checks.
4. Capture desktop/375/430 px and keyboard/error-state outcomes, verify exact fixture cleanup, document the actual command in README and resolve failures in their owning peers. Complete only after all required scenarios pass.

## Acceptance criteria

- [ ] AC1: A documented loopback-only command creates its own fixtures, exercises the real integrated flows and cleans up only those exact tagged records/accounts.
- [ ] AC2: Combined proof covers 30-day public eligibility, mixed Day/Week/Month calendar, whole-date replacement, retained-session warnings, pending closure, fresh restoration and cancellation without reopening day-off capacity.
- [ ] AC3: Actor/media/roster/candidate privacy and request-card/history integrity survive stale/retry/concurrent scheduling/group operations without overlapping coach time.
- [ ] AC4: Desktop/mobile/keyboard/overflow/unavailable checks and required existing regression/static/build results are recorded against scenarios; no missing group/runtime dependency is labelled a pass.

## Validation plan

Run the new documented rehearsal command against the real Auth-enabled local stack with exact tagged cleanup. Reuse completed peer database race/migration evidence, run npm test plus relevant availability/request/group/mail/public/browser suites, lint, typecheck, format:check and build where applicable. Inspect final desktop and 375/430 px rendered states and keyboard focus, not just action attempts. Keep failed, blocked and not-run evidence explicit; no hosted rehearsal is implied.

## Implementation record

Runtime implementation has not started. This is a planning record created by DEV0251.

### Changes and rationale

Allocated one peer with explicit ownership and dependencies so the full extension cannot be implemented under its documentation ticket or overlap existing M7 work.

### Affected files

Planned: a capability-owned scripts/rehearse-local-… command, fixture/cleanup helpers and appropriate tests, README command/prerequisite navigation and this evidence record. Screenshots/logs remain ignored unless specifically approved for durable inclusion.

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

Static calendar rendering or simulated data cannot establish effective-availability authority. Missing M7 integration, cleanup or real two-account recovery leaves this ticket and COR0023 incomplete.

Handoff: the planned scope and validation exist; no runtime code or evidence exists under this record. Next action: satisfy the stated dependencies, inspect the affected current implementation and finalize its interface/migration details before marking In progress.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: Planning self-review only; no independent/runtime review.
- Deployment or release: None.
