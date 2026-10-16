# Ticket DEV0109: Retire membership schema and preserve gyms

- Status: Completed
- Created: 2026-10-03
- Last updated: 2026-10-14
- Milestone: Coach-first M0 database cleanup
- Coordination: None — independent development ticket
- Related records: follows completed runtime retirement in [DEV0101 — Retire the multi-gym membership runtime](DEV0101-retire-multigym-membership-runtime.md); provides the simplified gym boundary consumed by [DEV0096 — Persist coach profiles and discovery](DEV0096-persist-coach-profiles-and-discovery.md), [DEV0104 — Publish weekly coach availability](DEV0104-publish-weekly-coach-availability.md) and [DEV0108 — Add the Mapbox coach Explore map](../frontend/DEV0108-add-mapbox-coach-explore-map.md); hosted application depends on [DEV0055 — Hosted Supabase staging environment](../../current/backend/DEV0055-hosted-supabase-staging-environment.md)

> Documentary pruning — 2026-10-14, [DEV0225](../organisatory/DEV0225-remove-blockchain-historical-evidence.md): superseded feature evidence and deleted-reference details were removed at the user’s request. Retained text records the independent outcome at its original date. Code/data fragments are historical excerpts, not complete current contracts; aggregate test totals remain totals of the original runs, not new retained-only validation. Original completion dates remain unchanged. Earlier revisions remain in Git history.

## Objective and context

Remove the dormant PostgreSQL model for multi-gym memberships, gym-managed classes, reservations, access claims, arrivals and check-ins while preserving gyms as simple public training-location records. DEV0101 removed the reachable runtime but deliberately left its applied migration history and hosted tables intact.

The retained gym concept is deliberately narrow. A fictional gym supplies public location information that a coach may optionally select through DEV0096. Independent coaches remain valid without a gym.

## Scope and non-goals

- Retained scope: introduce bounded fictional gym locations, retire obsolete membership/class/access structures through an explicit forward migration, preserve retained coach references and provide safe preflight/rollback guidance.
- Non-goals: coach profiles/availability, managed gym operations, real gym data, migration squashing or unreviewed hosted deletion.

## Expected behavior and edge cases

A clean database reaches one coach-first foundation after applying all historical migrations followed by this cleanup migration. It contains simple demo-safe gym locations but no table, policy or callable function that can create or mutate a membership product, membership period, gym class reservation, access claim, arrival request or check-in.

Only fictional gym/venue records that satisfy the new bounded gym-location contract may be copied before legacy tables are dropped.

The `gyms` table stores a stable identifier, demo-run boundary, slug, name, bounded description, public location label, city/area/country, IANA timezone, provider-neutral coordinates and provenance/status fields. Later coach affiliation is optional and does not make a gym authoritative for a coach's offers, slots, bookings .

## Assumptions, decisions, and dependencies

- Confirmed by the user on 2026-10-03: remove every membership, gym-class, reservation, access-claim, arrival and check-in structure; retain gyms because coaches are likely to be associated with them.
- P0 remains coach-first. A coach may select zero or one public gym association through DEV0096 or use an independent confirmed public location. Multiple public venues and gym-operated workflows remain deferred.
- Preserve additive migration files as historical evidence. Use a new explicit forward migration rather than editing applied migrations or using an unbounded `drop ... cascade`.
- Staging is not assumed disposable. Capture safe counts/dependencies and document backup/rollback steps before hosted application. Applying the destructive hosted migration is a separate operational action after local review.
- DEV0096 owns the optional coach-to-gym relationship so this cleanup does not invent a coach schema ahead of its owning ticket.

## Implementation plan

1. Inventory local and hosted legacy tables, functions, triggers, policies, grants, foreign-key dependencies and row counts without exposing user data; classify rows that may populate `gyms`.
2. Apply to staging only through the separately reviewed migration operation.

## Acceptance criteria

- [x] AC2: Membership products/versions/eligibility, participating-gym state, activation operations/snapshots, periods/core gyms, daily access claims, class reservations, arrival requests, check-ins, class sessions, trainer affiliations and venue-staff mutation surfaces are absent after migration.
- [x] AC4: Unexpected non-demo data, active organization authority or unresolved dependencies fail the preflight/migration safely; the implementation does not rely on broad cascade or silently discard unreviewed rows.
- [x] AC5: DEV0096 can attach a coach optionally to a gym without recreating gym membership, classes, check-ins or gym authority, and independent coaches remain supported.

## Validation plan

Assert exact retained/dropped relations and callable functions through PostgreSQL catalog queries. Record hosted preflight separately; do not claim staging cleanup until the migration is deliberately applied and post-migration counts are verified.

## Implementation record

The local implementation and review are complete. The forward migration, simplified schema mappings, fictional gym seed, read-only preflight, database tests and recovery runbook are ready for a separate implementation commit. Completion records a reviewed migration artifact; it does not claim that the destructive migration was applied to hosted staging.

### Changes and rationale

- Replaced the membership/class seed with eleven deterministic profiles/participants and seven fictional Berlin gym locations. The seed remains repeatable and does not create coach affiliations, availability, offers, bookings or real partnership claims.
- Added a standalone preflight with local and linked-hosted modes. Hosted mode uses Supabase's read-only Management API path and the existing CLI login or a scoped `database_read` token; it never reuses or widens the restricted application login and prints counts/object names rather than row data.
- Rewrote the Supabase runbook around the coach-first foundation, linked preflight, reviewed dry run, backup requirement and restore-only rollback for a successfully applied destructive migration.

### Affected files

- [`supabase/migration-history/20261016000100/20261003000100_retire_membership_schema_preserve_gyms.sql`](../../../supabase/migration-history/20261016000100/20261003000100_retire_membership_schema_preserve_gyms.sql) owns the guarded data transformation and explicit legacy teardown.
- [`supabase/seed.sql`](../../../supabase/seed.sql) supplies the deterministic coach-first foundation fixtures.
- `scripts/preflight-coach-schema-cleanup.mjs` (historical path; absent from this checkout) and [`package.json`](../../../package.json) provide local and hosted read-only inventory commands.
- [`supabase/README.md`](../../../supabase/README.md) documents the retained foundation and safe hosted workflow. DEV0096 still owns coach profiles and the optional coach-to-gym association.

### Decisions and deviations

- 2026-10-03: A stable migrated gym keeps the former venue UUID and demo-run boundary so later coach affiliations do not need identity remapping. The public location label is a reviewed snapshot, not live tracking or proof that a coach is present.
- 2026-10-03: The hosted preflight uses the Supabase read-only Management API because the least-privilege staging runtime login correctly cannot inspect private authority tables. Its permissions were not widened.

### Contracts, configuration, and operations

The migration is destructive to dormant legacy tables and must be backed by a restorable hosted backup plus explicit preflight evidence. There is no down migration: recovery after a successful hosted application restores the reviewed backup into an isolated recovery project before controlled staging recovery. Historical migration files remain unchanged and migration squashing is deferred.

`app.gyms` adds stable `id`/`run_id`, slug, name, bounded description/public label/area/city/country, IANA timezone, numeric latitude/longitude, provider-neutral location provenance, confirmation time, status, record source and audit timestamps. Only active gyms in the active public demo run are selectable through the read-only runtime policy.

Personal identifiers, proof hashes, lifecycle fields and replacement links remain stable. No application secret or new required environment variable was added. The optional hosted preflight variables are `SUPABASE_ACCESS_TOKEN` with `database_read` scope and `SUPABASE_PROJECT_REF` when the repository is not linked; on macOS the existing Supabase CLI Keychain login is used instead.

## Validation results

- `npm run db:start` from a removed local volume: passed all historical migrations, DEV0109 and `supabase/seed.sql` on a clean PostgreSQL 17 database.
- `npm run db:seed && npm run db:seed`: passed; fixture application is repeatable.
- `npm run db:test`: passed 3 SQL files and all 74 pgTAP assertions.
- `npm run db:lint`: passed with no schema errors.
- `npx supabase db diff --local --schema app`: passed with `No schema changes found`, proving the clean local schema matches migration history.
- `npm run format:check`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` and `git diff --check`: passed; unit tests reported 43/43 and Next.js 16.3.5 produced the production route build.
- `npx supabase migration list --linked`: showed staging through `20260928000200`; check-in and re-reservation migrations plus DEV0109 remain local-only. `npx supabase db push --linked --dry-run` confirmed those three migrations would be considered and did not modify staging.

## Risks, limitations, and follow-ups

Hosted staging must not receive DEV0109 yet. Its two activation operations, one membership period and dependent snapshots require an explicit retain/export/disposition decision and a verified backup before a separately authorized migration operation. The current migration will reject that state transactionally rather than delete it. Staging is also two migrations behind local; the reviewed dry run must be repeated after the historical-data decision.

The Supabase Management API read-only query endpoint is currently beta, so the local database mode remains the deterministic fallback for migration review. Gym moderation, real partner onboarding, branch ownership and coach/gym commercial relationships remain outside this ticket.

## Completion and review references

- Completed: 2026-10-03.
- Commit: This commit — `[DEV0109] Retire legacy membership schema`.
- Review: Implementation self-review against all acceptance criteria; no independent review.
- Deployment or release: Not deployed. Hosted staging was inspected read-only and intentionally left unchanged because the preflight found historical membership state requiring a separate decision and authorization.
