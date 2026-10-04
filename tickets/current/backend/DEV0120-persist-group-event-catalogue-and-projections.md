# Ticket DEV0120: Persist group-event catalogue and projections

- Status: Ready
- Created: 2026-10-04
- Last updated: 2026-10-04
- Milestone: Marketplace M3 group-event catalogue
- Coordination: [COR0010 — Coach-pass and group-funded marketplace MVP](../organisatory/COR0010-group-funded-coach-marketplace-mvp.md)
- Related records: uses coach/profile/location identity from completed [DEV0096](../../archive/backend/DEV0096-persist-coach-profiles-and-discovery.md) and [DEV0110](../../archive/backend/DEV0110-activate-coaching-during-account-onboarding.md), may reference selected proposals from [DEV0118](DEV0118-persist-training-requests-and-coach-proposals.md), and supplies contracts to [DEV0122](../blockchain/DEV0122-integrate-devnet-group-event-funding.md) and [DEV0123](../frontend/DEV0123-present-group-event-creation-and-funding.md)

## Objective and context

Persist coach-owned group-event description and discovery data keyed to one authoritative EventPool address, while keeping all funding terms and outcomes subordinate to verified chain state.

## Scope and non-goals

- In scope: draft/published group-event metadata, stable coach/location snapshot, start/end, media reference, optional selected-proposal reference, EventPool binding, public catalogue/detail projection, indexed finalized pool/contribution projection tables or operation records, authorization/RLS and deterministic fixtures.
- Out of scope: Solana instructions, wallet signing, fabricated funding, attendance/check-in, ticket transfers, waitlists, chat or post-event disputes.

## Expected behavior and edge cases

Only the coach owner manages a draft. Publication as fundable requires one verified matching EventPool; metadata cannot override mint, price, capacity, deadline, recipient, count or result. Duplicate pool binding, cross-dataset/coach binding and stale/unverified projections fail closed. Public reads show honest pending/unavailable chain state rather than fixture values.

## Assumptions, decisions, and dependencies

The chain address is the durable join key. Store provider-neutral location snapshots so later profile edits do not relocate the event. DEV0122 owns finalized chain ingestion/reconciliation; this ticket owns the database shape and application authorization boundary it consumes.

## Implementation plan

1. Freeze metadata/projection/operation schema and lifecycle.
2. Add migration, RLS, mappings, seeds and constraints.
3. Add protected coach draft/bind/publish services plus public catalogue/detail reads.
4. Add projection upsert/replay boundary for DEV0122.
5. Validate migration, authorization, stale projection and deterministic discovery behavior.

## Acceptance criteria

- [ ] AC1: A coach manages only owned event drafts with stable schedule/location metadata.
- [ ] AC2: One published event binds exactly one verified matching EventPool, and off-chain fields cannot override financial state.
- [ ] AC3: Public catalogue/detail projections distinguish current finalized, pending and unavailable chain state without fabrication.
- [ ] AC4: Migration/RLS, repository/service, replay/idempotency, static and build checks pass.

## Validation plan

Run clean/repeat/upgrade migrations, pgTAP/RLS, two-coach authorization and duplicate-binding tests, projection replay/staleness tests, public-read fixtures, lint, typecheck, formatting and builds.

## Implementation record

Not started.

### Changes and rationale

Pending implementation.

### Affected files

Planned: additive SQL/mappings/repositories/services/actions, projection contracts, deterministic seed and focused tests.

### Decisions and deviations

None yet.

### Contracts, configuration, and operations

Expected additive event/projection/operation schema; no chain configuration is owned here.

## Validation results

Not run — no implementation.

## Risks, limitations, and follow-ups

Index lag must not be mistaken for failure or success. Finalized chain reads remain authoritative for value movement.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: Planning self-review only.
- Deployment or release: None.
