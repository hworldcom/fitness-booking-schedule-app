# Ticket DEV0237: Persist group sessions and registration

- Status: Ready
- Created: 2026-10-15
- Last updated: 2026-10-15
- Milestone: M7 — Group training and events
- Coordination: [COR0021 — Group training and events](../organisatory/COR0021-group-training-and-events.md)
- Related records: contract owner [DEV0233](../../archive/organisatory/DEV0233-define-group-training-and-events-growth-scope.md); peer dependencies and independent visual baselines are listed below and in COR0021

## Objective and context

Persist the new nonfinancial group-session and registration domain, approved owner drafts, bounded public/participant/roster projections, direct one-seat joins, withdrawal, manual confirmation, cancellation and deadline reconciliation. Published terms and venue snapshots are immutable. Publication and cross-product schedule reservations are owned by DEV0238. Implement against the [group contract](../../../docs/mvp-spec.md#15-group-training-and-events), [M7 milestone](../../../docs/mvp-spec.md#12-delivery-milestones) and [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix). The user confirmed free/pay-at-session pricing and direct joining with manual coach confirmation. Adopted implementation defaults are labelled separately in the contract.

## Scope and non-goals

- In scope: Persist the new nonfinancial group-session and registration domain, approved owner drafts, bounded public/participant/roster projections, direct one-seat joins, withdrawal, manual confirmation, cancellation and deadline reconciliation. Published terms and venue snapshots are immutable. Publication and cross-product schedule reservations are owned by DEV0238.
- Out of scope: Publication/scheduling conflict integration, frontend routes, payment collection/tracking, wallets, recurring events, waitlists, notifications, connections, attendance and legacy-event restoration.

## Expected behavior and edge cases

A join reserves one seat and recovers exact retries; one active registration per account/session and database locking prevent oversubscription. Only the owner confirms, only with the minimum met before the deadline. No decision expires to Not confirmed, never automatic confirmation. Withdrawal before start preserves registration history and never reverses confirmed status. Coach cancellation releases active registrations once. Guests receive aggregate counts only; the owner gets a paginated name/initials roster without email/private-avatar access.

## Assumptions, decisions, and dependencies

The adopted DEV0233 contract. This ticket exposes no unguarded publication path; published fixture records are isolated test data until DEV0238 provides the publication boundary.

This is one peer implementation boundary, not a parent of other development tickets. No runtime implementation has started under this record. Significant implementation choices and deviations must be recorded before they are implemented.

## Implementation plan

1. Inspect installed database/server conventions; add additive new scheduling-owned tables and actor-checked functions without reading legacy funding tables.
2. Implement draft and registration/lifecycle repositories, domain validation and services. Leave publication inaccessible until DEV0238 completes; do not ship a bypass for testing.
3. Add meaningful SQL/driver/server tests for exact actors, privacy, retries, concurrent last-seat joins, confirm/withdraw/deadline races, terminal history and demo-dataset isolation.
4. Validate fresh and preserved-data migrations, constraints and current private scheduling regressions; finish the record before archival.

## Acceptance criteria

- [ ] AC1: New session/registration records follow the specification, preserve venue/price terms and reveal only authorized projections; old funding tables remain unused.
- [ ] AC2: Concurrent joins cannot exceed capacity, duplicate retries recover one registration, and withdrawal/rejoin history is stable.
- [ ] AC3: Manual minimum/deadline confirmation, owner cancellation and missed-deadline reconciliation return one atomic outcome; no automatic confirmation exists.
- [ ] AC4: Migrations, meaningful database/server/private-session regression tests and applicable static/build checks pass; publication remains protected by DEV0238.

## Validation plan

Run focused pgTAP and database integration/server tests, then `npm test`, `npm run db:test`, `npm run test:db`, `npm run db:lint`, `npm run lint`, `npm run typecheck`, `npm run format:check` and `npm run build` as applicable. Use only isolated local fixtures; validate clean and preserved-data migration paths. Browser validation belongs to the UI peers and DEV0241.

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

The adopted DEV0233 contract. This ticket exposes no unguarded publication path; published fixture records are isolated test data until DEV0238 provides the publication boundary. Free/pay-at-session registration proves neither payment nor attendance. No unrelated scope or unmet criterion may be delegated to a follow-up to claim completion.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: Planning self-review only; runtime/independent review not performed.
- Deployment or release: None.
