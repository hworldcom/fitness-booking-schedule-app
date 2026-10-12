# Ticket DEV0213: Persist the group-event catalogue

- Status: Ready
- Created: 2026-10-12
- Last updated: 2026-10-12
- Milestone: Hackathon H2 event catalogue
- Coordination: [COR0019 — Hackathon Solana group events](../organisatory/COR0019-hackathon-solana-group-events.md)
- Related records: depends on completed [DEV0210](../../archive/organisatory/DEV0210-adopt-hackathon-group-event-contract.md); historical baseline [DEV0120](../../archive/backend/DEV0120-persist-group-event-catalogue-and-projections.md); supplies persistence to [DEV0215](../blockchain/DEV0215-integrate-sponsored-devnet-funding.md) and [DEV0216](../frontend/DEV0216-present-group-event-marketplace.md)

## Objective and context

Restore and adapt the previously implemented coach-owned group-event descriptions and actor-scoped chain projections while preserving a strict boundary: PostgreSQL owns catalogue metadata and recovery records, and finalized Solana accounts own funding terms and financial outcomes.

## Scope and non-goals

- In scope: additive event/draft schema; coach and confirmed-location snapshots; start/end and funding deadline; bounded descriptive fields/media; draft/published/withdrawn lifecycle; unique pool binding; finalized pool and contribution projections; operation/recovery identifiers required by DEV0215; authorization/RLS; public and actor-scoped reads; deterministic fixtures.
- Out of scope: program instructions, wallet UI, signing/sponsorship, fabricated funding progress, attendance, private-session booking changes, chat, waitlists, transfers or disputes.

## Expected behavior and edge cases

Only an approved coach manages owned drafts at an owned active location. Binding freezes schedule, location and chain terms so later profile edits cannot relocate or reprice the event. Publication requires verified matching finalized pool evidence. Duplicate pool addresses, cross-coach or cross-dataset identifiers, stale/equal-slot conflicts, immutable-term changes, lifecycle regression and direct runtime writes fail closed. Public reads show pending or unavailable when current chain verification is absent rather than presenting cached financial state as live.

## Assumptions, decisions, and dependencies

DEV0210 freezes editable fields, bound-pool immutability, numeric bounds and no coach cancellation after pool creation. The pool address is the durable join key. Participant projections are private to the participant and owning coach only where the contract explicitly permits; public aggregate progress must never expose participant identity. Monotonic finalized evidence and an operation journal serve different purposes and should not overwrite one another.

The complete catalogue/projection/operation migration chain survived the scheduling split: `20261004000300`, `20261004000400`, `20261004000500`, `20261005000200` and `20261005000300`. Commits `8defb6c` and `12e8ccc` are the recoverable repository/service/test baselines. Implementation must reconcile those migrations with the current coach-approval and multi-location schema, restore only compatible runtime modules and add forward corrections rather than duplicating or rewriting applied history.

## Implementation plan

1. Compare the surviving event/projection/operation migrations and recoverable commits with current coach approval/location contracts and DEV0214's restored client.
2. Reuse compatible tables, indexes, RLS and protected mutations; add only forward migrations needed for current profiles, location ownership and C40 replacement guards, with rollback notes.
3. Restore/adapt owner/public/actor-scoped repositories and services with strict input bounds.
4. Add trusted finalized projection upserts with slot, immutable-term, authority and liability validation.
5. Validate clean/repeat/upgrade migrations, authorization, concurrency, replay and static/build behavior.

## Acceptance criteria

- [ ] AC1: An approved coach can manage only owned event drafts with immutable coach/location schedule snapshots at the correct lifecycle boundary.
- [ ] AC2: One published event binds one verified matching pool; off-chain metadata cannot override financial terms or terminal outcome.
- [ ] AC3: Public and actor-scoped reads reveal only allowed aggregate/own data and distinguish current, pending and unavailable projections honestly.
- [ ] AC4: Migration/RLS, repository/service, replay/concurrency, static and build checks pass.

## Validation plan

Run database migration replay and lint, pgTAP/RLS checks, two-coach/two-client authorization tests, duplicate-binding and concurrent-state tests, stale/equal-slot/reordered projection tests, public privacy tests, unit/service tests, lint, typecheck, format check and build.

## Implementation record

Pending implementation.

### Changes and rationale

Pending.

### Affected files

| File or component                        | Change and purpose                                                 |
| ---------------------------------------- | ------------------------------------------------------------------ |
| Supabase migrations/tests                | Event, projection, operation and authorization contracts.          |
| Domain/schema/repository/service modules | Validated catalogue and actor-scoped read/write boundaries.        |
| Fixtures/tests                           | Deterministic event discovery and adversarial projection evidence. |

### Decisions and deviations

None yet.

### Contracts, configuration, and operations

Expected to add PostgreSQL tables/functions and application data shapes without new secrets. Exact migration and rollback requirements remain pending implementation.

## Validation results

Pending validation.

- Date and environment: Not run.
- Exact commands and outcomes: Not run.
- Manual steps and observed outcomes: Not run.
- Failed, blocked, or not-run checks and reasons: Not run — implementation has not started; DEV0210 and the recoverable DEV0121 account contract supply the stable lifecycle/interface needed to begin alongside DEV0214.

| Criterion | Evidence                       | Result  |
| --------- | ------------------------------ | ------- |
| AC1       | Owner/location lifecycle tests | Not run |
| AC2       | Pool binding/projection tests  | Not run |
| AC3       | Public/private read tests      | Not run |
| AC4       | Database/static/build checks   | Not run |

## Risks, limitations, and follow-ups

Projection freshness is an availability concern, not permission to guess chain state. Historical event tables may still exist in additive migration history after runtime removal; implementation must inspect and migrate or safely reuse them rather than assume a clean database.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: No independent review or pull request.
- Deployment or release: Not deployed.
