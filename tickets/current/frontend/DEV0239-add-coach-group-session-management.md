# Ticket DEV0239: Add coach group-session management

- Status: Draft
- Created: 2026-10-15
- Last updated: 2026-10-15
- Milestone: M7 — Group training and events
- Coordination: [COR0021 — Group training and events](../organisatory/COR0021-group-training-and-events.md)
- Related records: contract owner [DEV0233](../../archive/organisatory/DEV0233-define-group-training-and-events-growth-scope.md); peer dependencies and independent visual baselines are listed below and in COR0021

## Objective and context

Add Coach workspace → Events at `/coach/events`: owner drafts, actual venue/date/start/end/deadline, minimum/maximum, Free or EUR per-person pay-at-session price, explicit publication review, private roster, manual confirmation and cancellation. Implement against the [group contract](../../../docs/mvp-spec.md#15-group-training-and-events), [M7 milestone](../../../docs/mvp-spec.md#12-delivery-milestones) and [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix). The user confirmed free/pay-at-session pricing and direct joining with manual coach confirmation. Adopted implementation defaults are labelled separately in the contract.

## Scope and non-goals

- In scope: Add Coach workspace → Events at `/coach/events`: owner drafts, actual venue/date/start/end/deadline, minimum/maximum, Free or EUR per-person pay-at-session price, explicit publication review, private roster, manual confirmation and cancellation.
- Out of scope: Group backend/migrations, public Events/athlete UI, changing Home/Explore or private booking policy, new calendar overlay, notifications, payments, waitlists and private avatar exposure.

## Expected behavior and edge cases

The owner sees clear Draft, Waiting for coach confirmation, Confirmed, Cancelled, Not confirmed and elapsed presentation. Publishing freezes terms and reports scheduling conflicts with recovery to the existing Bookings/Schedule tools. Reaching the minimum never confirms automatically. Confirm requires minimum and deadline eligibility; retry/stale/unauthorized/expired actions show the winning state. Suspended coaches may read/cancel existing sessions but cannot publish or confirm.

## Assumptions, decisions, and dependencies

DEV0237 and DEV0238 completed with stable guarded services. Preserve independent DEV0236 styling work; this ticket owns coach event navigation and screens only.

This is one peer implementation boundary, not a parent of other development tickets. No runtime implementation has started under this record. Significant implementation choices and deviations must be recorded before they are implemented.

## Implementation plan

1. Inspect installed Next.js documentation and current capability-aware coach shell; add thin routes and event feature modules using the stable services.
2. Build accessible draft fields and a review/publish flow with immutable published terms, actual venue, truthful payment wording and bounded conflict recovery.
3. Build paginated private roster/counts and explicit manual confirm/cancel controls; keep private athlete media/email absent.
4. Verify mobile/desktop, keyboard, no-JavaScript mutation recovery and meaningful service-backed browser flows; record exact evidence.

## Acceptance criteria

- [ ] AC1: Approved/demo owners can draft/review/publish only their valid sessions; applicant/unrelated actors cannot operate them.
- [ ] AC2: Free/paid-at-session terms, location/date/deadline/minimum/capacity and frozen published terms are clear at review and afterward.
- [ ] AC3: Roster privacy, manual minimum/deadline decisions, cancel/retry/stale/conflict/unavailable/suspended states reflect actual backend results.
- [ ] AC4: Representative mobile/desktop and keyboard flows, meaningful browser tests and applicable test/lint/type/format/build checks pass.

## Validation plan

Use real local approved/demo owner and unrelated/applicant/athlete fixtures. Verify 375/430/768/1440 widths, keyboard/focus, invalid fields, publication conflicts, stale decision/deadline and unavailable states. Run focused component/browser tests, `npm test`, lint/type/format/build and affected document checks. DEV0241 owns final cross-interface rehearsal.

## Implementation record

Pending implementation.

### Changes and rationale

Not implemented — this record defines one boundary in the adopted delivery plan.

### Affected files

Planned capability-owned domain/server or feature modules and tests as described above. Record exact repository-relative file links and roles during implementation; no application file changed when this ticket was created.

### Decisions and deviations

2026-10-15: Created as a peer under COR0021. No deviation from the contract or plan.

### Contracts, configuration, and operations

Planned contracts are owned as described in Scope. No current runtime/schema/dependency/environment/migration/deployment changed when creating this record. Do not import the legacy funding runtime or record secrets.

## Validation results

Ticket-format/link/ownership planning checks are recorded under DEV0233 and COR0021. Runtime checks are not run because implementation has not started.

| Criterion | Evidence                                               | Result  |
| --------- | ------------------------------------------------------ | ------- |
| AC1–AC4   | Runtime implementation and required validation pending | Not run |

## Risks, limitations, and follow-ups

DEV0237 and DEV0238 completed with stable guarded services. Preserve independent DEV0236 styling work; this ticket owns coach event navigation and screens only. Free/pay-at-session registration proves neither payment nor attendance. No unrelated scope or unmet criterion may be delegated to a follow-up to claim completion.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: Planning self-review only; runtime/independent review not performed.
- Deployment or release: None.
