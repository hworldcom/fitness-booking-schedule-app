# Ticket DEV0120: Persist group-event catalogue and projections

- Status: Completed
- Created: 2026-10-04
- Last updated: 2026-10-04
- Milestone: Marketplace M3 group-event catalogue
- Coordination: [COR0010 — Coach-pass and group-funded marketplace MVP](../../current/organisatory/COR0010-group-funded-coach-marketplace-mvp.md)
- Related records: uses coach/profile/location identity from completed [DEV0096](DEV0096-persist-coach-profiles-and-discovery.md) and [DEV0110](DEV0110-activate-coaching-during-account-onboarding.md), may reference selected proposals from [DEV0118](../../current/backend/DEV0118-persist-training-requests-and-coach-proposals.md), and supplies contracts to [DEV0122](../../current/blockchain/DEV0122-integrate-devnet-group-event-funding.md) and [DEV0123](../../current/frontend/DEV0123-present-group-event-creation-and-funding.md)

## Objective and context

Persist coach-owned group-event description and discovery data keyed to one authoritative EventPool address, while keeping all funding terms and outcomes subordinate to verified chain state.

## Scope and non-goals

- In scope: draft/published group-event metadata, stable coach/location snapshot, start/end, media reference, optional selected-proposal reference, EventPool binding, public catalogue/detail projection, indexed finalized pool/contribution projection tables or operation records, authorization/RLS and deterministic fixtures.
- Out of scope: Solana instructions, wallet signing, fabricated funding, attendance/check-in, ticket transfers, waitlists, chat or post-event disputes.

## Expected behavior and edge cases

Only the coach owner manages a draft. Publication as fundable requires one verified matching EventPool; metadata cannot override mint, price, capacity, deadline, recipient, count or result. Duplicate pool binding, cross-dataset/coach binding and stale/unverified projections fail closed. Public reads show honest pending/unavailable chain state rather than fixture values.

## Assumptions, decisions, and dependencies

The chain address is the durable join key. Store provider-neutral location snapshots so later profile edits do not relocate the event. DEV0122 owns finalized chain ingestion/reconciliation; this ticket owns the database shape and application authorization boundary it consumes.

Implementation started on 2026-10-04. A draft snapshots the coach's public identity and confirmed location when it is created. Its descriptive fields remain editable only before a pool address is bound; after binding, schedule and location must remain identical to the verified pool contract. Public publication requires a matching finalized pool projection. A later `pending` or `unavailable` projection-availability label may hide stale financial details, but it cannot alter the last finalized projection or an on-chain lifecycle.

P0 database bounds are: title 3–120 characters, description 20–2,000 characters, optional HTTPS or root-relative media reference up to 1,024 characters, event duration 30 minutes–12 hours, capacity 2–50, positive seat price up to `9,000,000,000,000,000` base units, and one contribution per participant wallet/event. Pool and contribution updates reject lower observed slots, conflicting equal-slot evidence, immutable-term changes, decreasing participant counts and lifecycle regression. The optional proposal UUID is stored without a foreign key until DEV0118 owns the proposal table; it grants no financial authority.

Binding snapshots the coach's one active Devnet wallet, and verified EventPool evidence must use it as coach authority. The immutable payout recipient remains a separate coach-chosen chain field rather than an application-owned identity assumption. Evidence must also use the official Devnet USDC mint and legacy SPL Token program.

## Implementation plan

1. Freeze metadata/projection/operation schema and lifecycle.
2. Add migration, RLS, mappings, seeds and constraints.
3. Add protected coach draft/bind/publish services plus public catalogue/detail reads.
4. Add projection upsert/replay boundary for DEV0122.
5. Validate migration, authorization, stale projection and deterministic discovery behavior.

## Acceptance criteria

- [x] AC1: A coach manages only owned event drafts with stable schedule/location metadata.
- [x] AC2: One published event binds exactly one verified matching EventPool, and off-chain fields cannot override financial state.
- [x] AC3: Public catalogue/detail projections distinguish current finalized, pending and unavailable chain state without fabrication.
- [x] AC4: Migration/RLS, repository/service, replay/idempotency, static and build checks pass.

## Validation plan

Run clean/repeat/upgrade migrations, pgTAP/RLS, two-coach authorization and duplicate-binding tests, projection replay/staleness tests, public-read fixtures, lint, typecheck, formatting and builds.

## Implementation record

Completed on 2026-10-04.

### Changes and rationale

- Added an additive three-table group-event model: application-owned event descriptions and coach/location snapshots, finalized EventPool projections, and actor-scoped Contribution projections.
- Added owner-only draft creation, editing, one-way pool binding, publication and unbound-draft withdrawal through security-definer functions. Direct runtime writes remain denied and row-level security (RLS) limits private projections to the owning coach or contributing client.
- Added trusted server projection functions for DEV0122. They reject mismatched pool keys, schedule, coach authority, payout recipient, mint, token program, amount, capacity, immutable terms, stale slots, conflicting replays, count regression and lifecycle regression.
- Added public catalogue/detail reads that expose descriptions independently of funding availability. `current` exposes the last verified finalized financial projection; `pending` and `unavailable` hide those details rather than presenting stale values as live.
- Added one deterministic, explicitly unbound draft fixture. It contains no fabricated pool, contribution, price or funding outcome.

### Affected files

- [`supabase/migrations/20261004000300_create_group_event_catalogue.sql`](../../../supabase/migrations/20261004000300_create_group_event_catalogue.sql): tables, constraints, indexes, RLS policies and protected lifecycle/projection functions.
- [`supabase/seed.sql`](../../../supabase/seed.sql): one repeatable metadata-only group-event draft for the fictional fixture coach.
- [`src/domain/group-events.ts`](../../../src/domain/group-events.ts): bounded draft input and finalized pool/contribution evidence contracts.
- [`src/server/db/schema/group-events.ts`](../../../src/server/db/schema/group-events.ts) and [`src/server/db/schema/index.ts`](../../../src/server/db/schema/index.ts): Drizzle mappings for the three new tables.
- [`src/server/db/group-events/repository.ts`](../../../src/server/db/group-events/repository.ts): owner, public-read and trusted-projection persistence boundaries.
- [`src/server/group-events/service.ts`](../../../src/server/group-events/service.ts): authenticated owner results and server-only verifier/public service entry points.
- [`tests/group-events.test.ts`](../../../tests/group-events.test.ts), [`tests/database/group-events.test.ts`](../../../tests/database/group-events.test.ts) and [`supabase/tests/database/group-events.test.sql`](../../../supabase/tests/database/group-events.test.sql): domain, multi-actor integration and pgTAP coverage.
- [`supabase/tests/database/foundation.test.sql`](../../../supabase/tests/database/foundation.test.sql): updated expected application-table ownership/count coverage for the already-added booking tables and these three group-event tables.

### Decisions and deviations

- The original plan allowed either operation records or projections. The implementation uses monotonic finalized projections because DEV0122 already owns submission/recovery operation records and this ticket must not duplicate transaction orchestration.
- A bound or published event cannot be descriptively edited. An unbound draft may be withdrawn; a bound pool cannot be hidden by pretending its metadata never existed.
- Proposal references remain nullable UUID context without a foreign key until DEV0118 supplies an authoritative proposal table.
- No browser route or action was added. DEV0123 owns interface composition after the program and Devnet adapter contracts settle.

### Contracts, configuration, and operations

The migration is additive and requires no new environment variable. It introduces `app.group_events`, `app.group_event_pool_projections` and `app.group_event_contribution_projections` plus eight protected functions. The projection input contract pins official Devnet USDC (`4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`) and the legacy SPL Token program (`TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`); it does not pin the not-yet-implemented EventPool program ID. Rollback would require explicit deletion of dependent event/projection data and is not automated.

## Validation results

- Passed clean migration and seed: `npm run db:reset`, followed by `npm run db:seed` twice and `npm run db:runtime`.
- Passed representative upgrade from the previous migration: `npx supabase db reset --local --version 20261004000200 --no-seed`, `npx supabase migration up --local`, `npm run db:seed`, and `npm run db:runtime`.
- Passed `npm run db:test`: 164 pgTAP assertions across eight files.
- Passed `npm run test:db`: 32 database integration tests, including three group-event tests for owner isolation, pool publication, unavailable-state honesty, stale/equal-slot replay rejection, contribution privacy/idempotency, duplicate binding and direct-write denial.
- Passed `npm test`: 82 unit tests.
- Passed `npm run db:lint`: no schema errors.
- Passed `npm run lint`, `npm run format:check` and `npm run typecheck`.
- Passed `npm run build` and `npm run build:vinext`. Vinext retained its existing informational large-chunk warning and completed successfully.
- Browser testing was not applicable because this ticket adds no route or interface; DEV0123 owns responsive and keyboard validation.

## Risks, limitations, and follow-ups

DEV0121 must freeze and implement the EventPool/Contribution account layouts, including whether its immutable payout recipient is represented as an owner wallet or token account. DEV0122 must ingest only finalized verified state, own operation recovery and mark `pending`/`unavailable` honestly during RPC/index failure. DEV0123 still owns all browser behavior. PostgreSQL remains a projection and cannot authorize contributions, settlement, payout or refunds.

## Completion and review references

- Completed: 2026-10-04.
- Commit: This implementation commit (`[DEV0120] Persist group-event catalogue projections`).
- Review: Self-reviewed against all four acceptance criteria and the MVP authority/availability requirements; no independent review.
- Deployment or release: None — local database and build validation only.
