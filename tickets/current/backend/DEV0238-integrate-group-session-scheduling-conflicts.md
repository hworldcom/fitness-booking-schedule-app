# Ticket DEV0238: Integrate group sessions with coach scheduling

- Status: Draft
- Created: 2026-10-15
- Last updated: 2026-10-15
- Milestone: M7 — Group training and events
- Coordination: [COR0021 — Group training and events](../organisatory/COR0021-group-training-and-events.md)
- Related records: contract owner [DEV0233](../../archive/organisatory/DEV0233-define-group-training-and-events-growth-scope.md); peer dependencies and independent visual baselines are listed below and in COR0021

## Objective and context

Own the guarded draft-to-published transition and active group time reservations across all of a coach's locations. Integrate publication, recurring occurrence materialization, explicit private occurrence writes/reopening and private booking acceptance with one shared database schedule-concurrency boundary. Implement against the [group contract](../../../docs/mvp-spec.md#15-group-training-and-events), [M7 milestone](../../../docs/mvp-spec.md#12-delivery-milestones) and [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix). The user confirmed free/pay-at-session pricing and direct joining with manual coach confirmation. Adopted implementation defaults are labelled separately in the contract.

## Scope and non-goals

- In scope: Own the guarded draft-to-published transition and active group time reservations across all of a coach's locations. Integrate publication, recurring occurrence materialization, explicit private occurrence writes/reopening and private booking acceptance with one shared database schedule-concurrency boundary.
- Out of scope: Event registration/capacity implementation owned by DEV0237, new calendar/map interface, automatic closing of private availability, athlete-wide calendar conflicts, payment or external calendar providers.

## Expected behavior and edge cases

Publication rejects overlap with nonwithdrawn private occurrences/bookings or another active group session. The coach explicitly closes conflicting private occurrences first; publication never deletes bookings or closes private requests silently. Active group sessions block future overlapping private materialization/mutations. Missed-deadline expiry or cancellation releases only the group reservation; previously withdrawn private occurrences stay withdrawn. Adjacent half-open intervals do not overlap, and primary-location changes never move session snapshots.

## Assumptions, decisions, and dependencies

DEV0237's stable group records/lifecycle. It may be investigated now but implementation starts after those contracts exist. No coach/public event UI may publish before this boundary passes.

This is one peer implementation boundary, not a parent of other development tickets. No runtime implementation has started under this record. Significant implementation choices and deviations must be recorded before they are implemented.

## Implementation plan

1. Inspect current coach schedule locks and recurrence/closure/reopening functions; add the group reservation and publication guard using the same actor and coach scope.
2. Serialize publish-versus-publish, publish-versus-private creation/acceptance/reopen and recurrence materialization; fail closed without partial publication or overwritten private history.
3. Integrate cancellation/expiry reservation release and truthful bounded conflict results consumed by DEV0239; preserve recurring-rule templates and withdrawn-date identity.
4. Add real database race, venue, recurrence-window and cancellation/history regressions; validate migrations and current private-session flows.

## Acceptance criteria

- [ ] AC1: Only a currently approved/demo visible coach publishes a future draft at an owned active location after all schedule checks; no bypass exists.
- [ ] AC2: All cross-location group/private overlap races resolve with one valid reservation or explicit conflict, never double-booked coach time.
- [ ] AC3: Future recurring materialization respects group reservations; release does not resurrect withdrawn occurrences or old private requests.
- [ ] AC4: Meaningful race/recurrence tests, migration/constraint checks, existing booking regressions and applicable static/build checks pass.

## Validation plan

Use isolated local database integration tests with concurrent connections for publication/private-acceptance/materialization/reopen/release races. Run focused pgTAP/driver checks, `npm run db:test`, `npm run test:db`, `npm run db:lint`, `npm test`, lint/type/format/build and document checks. DEV0241 owns combined browser proof.

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

DEV0237's stable group records/lifecycle. It may be investigated now but implementation starts after those contracts exist. No coach/public event UI may publish before this boundary passes. Free/pay-at-session registration proves neither payment nor attendance. No unrelated scope or unmet criterion may be delegated to a follow-up to claim completion.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: Planning self-review only; runtime/independent review not performed.
- Deployment or release: None.
