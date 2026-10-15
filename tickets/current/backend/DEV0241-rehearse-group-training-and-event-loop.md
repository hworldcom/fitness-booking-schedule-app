# Ticket DEV0241: Rehearse the group-training and event loop

- Status: Draft
- Created: 2026-10-15
- Last updated: 2026-10-15
- Milestone: M7 — Group training and events
- Coordination: [COR0021 — Group training and events](../organisatory/COR0021-group-training-and-events.md)
- Related records: contract owner [DEV0233](../../archive/organisatory/DEV0233-define-group-training-and-events-growth-scope.md); peer dependencies and independent visual baselines are listed below and in COR0021

## Objective and context

Own reproducible local cross-interface validation and guarded fixture cleanup for the complete coach-create/publish/manual-decision and athlete-discover/join/withdraw loop, including private-scheduling compatibility, privacy and concurrency. Document delivered setup/check commands and truthful product delivery status after evidence passes. Implement against the [group contract](../../../docs/mvp-spec.md#15-group-training-and-events), [M7 milestone](../../../docs/mvp-spec.md#12-delivery-milestones) and [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix). The user confirmed free/pay-at-session pricing and direct joining with manual coach confirmation. Adopted implementation defaults are labelled separately in the contract.

## Scope and non-goals

- In scope: Own reproducible local cross-interface validation and guarded fixture cleanup for the complete coach-create/publish/manual-decision and athlete-discover/join/withdraw loop, including private-scheduling compatibility, privacy and concurrency. Document delivered setup/check commands and truthful product delivery status after evidence passes.
- Out of scope: Feature delivery already owned by peer tickets, unrelated fixes, destructive reset/hosted data changes, real payment/Devnet transactions, attendance certification and publishing or deployment.

## Expected behavior and edge cases

One approved/demo coach, at least two athletes and an unrelated account exercise a real free session and a priced pay-at-session session. Minimum reached never auto-confirms; coach confirms explicitly; another undecided session becomes Not confirmed at deadline. Full/last-seat, duplicate/withdraw/rejoin, post-confirmation count drop, coach cancellation, cross-product time conflict and actor/dataset isolation have recorded results. No payment or attendance is fabricated.

## Assumptions, decisions, and dependencies

DEV0237–DEV0240 completed. Earlier backend/unit/UI results are prerequisites and do not substitute for this integrated proof.

This is one peer implementation boundary, not a parent of other development tickets. No runtime implementation has started under this record. Significant implementation choices and deviations must be recorded before they are implemented.

## Implementation plan

1. Provision tagged loopback-only identities and isolated event/private scheduling fixtures without resetting existing user data or printing configuration values.
2. Exercise both real web interfaces and meaningful concurrent service/database actions; include free/paid wording, manual decisions, deadline and released-schedule recovery.
3. Review mobile/desktop and keyboard screenshots, unavailable/error/auth-return/native GET behavior and retained Home/Explore/private-session regressions.
4. Add a guarded reproducible rehearsal/cleanup command if needed, update README operation/navigation evidence and the specification's delivery status, and finish every result before COR0021 completion.

## Acceptance criteria

- [ ] AC1: Reproducible real local free and pay-at-session journeys prove reservation, manual confirmation, cancellation and missed-deadline outcomes with multiple exact actors.
- [ ] AC2: Concurrency, privacy, registration history and group/private scheduling conflicts pass without oversubscription, implicit confirmation or private-data leakage.
- [ ] AC3: Mobile/desktop/keyboard/unavailable/retry and existing Home/Explore/private-session regression evidence passes.
- [ ] AC4: Tagged cleanup, documented commands, required automated checks and a durable integration record pass; no payment, attendance or deployment claim is made.

## Validation plan

Run the new guarded local rehearsal after both frontend peers pass, with current Auth-enabled local services and restricted app database credentials. Include meaningful SQL/driver races and browser screenshots; then required `npm test`, database checks, relevant browser checks, lint/type/format/build and document checks. Hosted deployment is separate operational work and does not gate this local integration ticket.

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

DEV0237–DEV0240 completed. Earlier backend/unit/UI results are prerequisites and do not substitute for this integrated proof. Free/pay-at-session registration proves neither payment nor attendance. No unrelated scope or unmet criterion may be delegated to a follow-up to claim completion.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: Planning self-review only; runtime/independent review not performed.
- Deployment or release: None.
