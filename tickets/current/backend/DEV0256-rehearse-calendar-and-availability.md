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

- In scope: A dedicated localhost app using explicitly selected hosted dev, exact tagged rehearsal fixtures/cleanup and a reproducible command; combined private/group/calendar/editor/public-date/request flows; actual concurrency/recovery/privacy assertions and desktop/mobile/keyboard evidence; README command documentation and durable integration handoff.
- Out of scope: Implementing missing peer features under a test ticket, resetting shared data, hosted deployment, repeating independent M7 lifecycle implementation, external calendar/provider setup or simulating away required real application/database flows.

## Expected behavior and edge cases

Use at least one approved coach with two venues, two athletes, pending and confirmed private sessions, policy/manual closures and real published groups. Include group time beyond the old seven-day horizon, cancellation on a retained day off, restored new occurrence identities, month overflow and no coach visit on horizon advancement. Unavailable/uncertain/stale responses must show honest recovery; private responses must not contain unrelated athletes or coach-private metadata.

## Assumptions, decisions, and dependencies

DEV0252–DEV0255 must complete their required checks. DEV0271 has applied the unchanged owner-calendar migration to the adopted hosted-dev project, whose expected ledger is baseline/effective-availability/owner-calendar. DEV0239 has completed its real group-owner checks, and DEV0254 has completed actual calendar-to-original-detail Auth/browser evidence; their archived records supply these prerequisites. DEV0253/DEV0255 must still finish their own live criteria before this combined rehearsal. Discover current namespace/migration/fixture state before setup. Existing M7 and note/application work remain independent; final rehearsal cannot silently omit group links or overwrite their fixtures. Do not recreate the retired Docker stack or apply another migration under this proof ticket.

Scope review: this record owns one delivery boundary under a flat coordination. No runtime implementation has started. Keep Draft until the listed dependencies and concrete interface/validation prerequisites permit starting; Ready is not an extra approval gate. Inspect actual versions/bundled documentation before framework or SDK integration changes and update this plan before material deviations.

## Implementation plan

1. Map section 18 scenarios to exact completed peer evidence. Reuse their maintained hosted fixture/guard helpers where appropriate; define one explicit `--environment dev --check|--run` command, private source snapshot and dedicated localhost app. Require the confirmed dev project, restricted runtime, exact migration ledger, real Auth OTP sessions without email, independently tagged accounts and no shared-data reset. Refuse production, existing-account enrollment, foreign cleanup and provider changes.
2. Exercise weekly copy/range saves, custom/day-off override, retained private/group warnings, pending closure, reload and explicit restoration; follow original request/booking/group links and verify history/new request identities.
3. Exercise all calendar views/filters/overflow and complete public 30-day navigation/requests with time-boundary and concurrency evidence. Combine relevant existing M7/M8 authorization/card/race suites rather than inventing browser-only authority checks.
4. Capture desktop/375/430 px and keyboard/error-state outcomes, stop owned processes and verify exact fixture cleanup plus preservation of pre-existing application/Auth/Storage records. Retain private UUID-only recovery IDs if cleanup fails; do not restore fingerprints by overwriting data. Document the actual command in README and resolve failures in their owning peers. Complete only after all required scenarios pass.

## Acceptance criteria

- [ ] AC1: A documented explicit-dev command serves its own localhost app against the confirmed hosted-dev environment, exercises real integrated flows and cleans up only its exact tagged records/accounts while preserving existing data.
- [ ] AC2: Combined proof covers 30-day public eligibility, mixed Day/Week/Month calendar, whole-date replacement, retained-session warnings, pending closure, fresh restoration and cancellation without reopening day-off capacity.
- [ ] AC3: Actor/media/roster/candidate privacy and request-card/history integrity survive stale/retry/concurrent scheduling/group operations without overlapping coach time.
- [ ] AC4: Desktop/mobile/keyboard/overflow/unavailable checks and required existing regression/static/build results are recorded against scenarios; no missing group/runtime dependency is labelled a pass.

## Validation plan

Run the new documented command against the adopted hosted-dev Auth/PostgreSQL environment, with an owned localhost app and exact tagged cleanup. Do not run legacy destructive Docker rehearsals unchanged. Reuse completed peer database race/migration evidence, and run npm test plus relevant maintained availability/request/group/public/browser suites, lint, typecheck, format:check and build where applicable. Inspect final desktop and 375/430 px rendered states and keyboard focus, not just action attempts. Record failed, blocked and not-run evidence explicitly; hosted dev validation is separate from UAT/production deployment.

## Implementation record

Runtime implementation has not started. This is a planning record created by DEV0251.

### Changes and rationale

Allocated one peer with explicit ownership and dependencies so the full extension cannot be implemented under its documentation ticket or overlap existing M7 work.

### Affected files

Planned: a capability-owned explicit-dev rehearsal command, reusable fixture/cleanup helpers and appropriate tests, README command/prerequisite navigation and this evidence record. Screenshots/logs remain ignored unless specifically approved for durable inclusion.

### Decisions and deviations

2026-10-16: Created from the confirmed feature scope and section 18 operating defaults. No runtime decisions/deviations or implementation evidence yet.

2026-10-16 planning correction: hosted dev is now the repository's adopted local-app database/Auth target, and DEV0270 removed the old Docker services. Updated this still-Draft plan and AC1 before any runtime edit. DEV0271 supplies the required migration rollout. DEV0253/DEV0255 are currently validating their own live flows, while DEV0254/DEV0239 retain their independent acceptance work. This change authorizes no missing peer implementation and does not mark the combined rehearsal started or passed.

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
