# Ticket DEV0109: Retire membership schema and preserve gyms

- Status: Completed
- Created: 2026-10-03
- Last updated: 2026-10-03
- Milestone: Coach-first M0 database cleanup
- Coordination: [COR0009 — Coach-first private-class booking MVP](../../current/organisatory/COR0009-coach-first-training-package-mvp.md)
- Related records: follows completed runtime retirement in [DEV0101 — Retire the multi-gym membership runtime](DEV0101-retire-multigym-membership-runtime.md); provides the simplified gym boundary consumed by [DEV0096 — Persist coach profiles and discovery](../../current/backend/DEV0096-persist-coach-profiles-and-discovery.md), [DEV0104 — Publish weekly coach availability](../../current/backend/DEV0104-publish-weekly-coach-availability.md) and [DEV0108 — Add the Mapbox coach Explore map](../../current/frontend/DEV0108-add-mapbox-coach-explore-map.md); hosted application depends on [DEV0055 — Hosted Supabase staging environment](../../current/backend/DEV0055-hosted-supabase-staging-environment.md)

## Objective and context

Remove the dormant PostgreSQL model for multi-gym memberships, gym-managed classes, reservations, access claims, arrivals and check-ins while preserving gyms as simple public training-location records. DEV0101 removed the reachable runtime but deliberately left its applied migration history and hosted tables intact. The coach-first implementation should not be built beside a second obsolete access model or reuse tables whose constraints encode membership plans, group capacity, EURC pricing, venue staff or check-in authority.

The retained gym concept is deliberately narrow. A fictional gym supplies public location information that a coach may optionally select through DEV0096. A gym has no application login, wallet authority, membership catalogue, class schedule, check-in staff or booking authority in this MVP. Independent coaches remain valid without a gym.

## Scope and non-goals

- In scope: read-only hosted/local dependency and row-count preflight; a forward migration creating a simplified `gyms` location table and preserving eligible fictional gym/location records; explicit removal of legacy membership products/versions/eligibility, participating-gym join state, activation operations and gym snapshots, membership periods/core gyms, daily access claims, class reservations, arrival requests, check-ins, group class sessions, trainer affiliations, venue staff and their dedicated functions/triggers/policies/grants; replacement of the old organization/venue hierarchy with the simplified gym model; removal of the unused organization-wallet authority branch while preserving personal wallet linking; updated Drizzle mappings, seeds and database tests; rollback/backup and hosted-application instructions.
- Out of scope: coach profiles or `coach_gym_affiliations` owned by DEV0096; coach availability owned by DEV0104; holds/bookings owned by DEV0105; gym accounts, administrators, branches, memberships, access control, managed classes, check-ins, payments, revenue splitting, public gym discovery UI, real gym data or migration squashing/resetting applied history.

## Expected behavior and edge cases

A clean database reaches one coach-first foundation after applying all historical migrations followed by this cleanup migration. The resulting schema retains application profiles, demo-run isolation and personal wallet proof/binding behavior. It contains simple demo-safe gym locations but no table, policy or callable function that can create or mutate a membership product, membership period, gym class reservation, access claim, arrival request or check-in.

Only fictional gym/venue records that satisfy the new bounded gym-location contract may be copied before legacy tables are dropped. Unexpected active organization wallet authorities, non-demo organization data, unresolved foreign-key dependencies or malformed gym locations abort the migration/preflight rather than being silently discarded. Personal wallet bindings and personal link/replace challenges must survive unchanged.

The `gyms` table stores a stable identifier, demo-run boundary, slug, name, bounded description, public location label, city/area/country, IANA timezone, provider-neutral coordinates and provenance/status fields. It does not store class schedules, prices, membership eligibility or wallet authority. Later coach affiliation is optional and does not make a gym authoritative for a coach's offers, slots, bookings or TrainingPasses.

## Assumptions, decisions, and dependencies

- Confirmed by the user on 2026-10-03: remove every membership, gym-class, reservation, access-claim, arrival and check-in structure; retain gyms because coaches are likely to be associated with them.
- P0 remains coach-first. A coach may select zero or one public gym association through DEV0096 or use an independent confirmed public location. Multiple public venues and gym-operated workflows remain deferred.
- Preserve additive migration files as historical evidence. Use a new explicit forward migration rather than editing applied migrations or using an unbounded `drop ... cascade`.
- Staging is not assumed disposable. Capture safe counts/dependencies and document backup/rollback steps before hosted application. Applying the destructive hosted migration is a separate operational action after local review.
- DEV0096 owns the optional coach-to-gym relationship so this cleanup does not invent a coach schema ahead of its owning ticket.

## Implementation plan

1. Inventory local and hosted legacy tables, functions, triggers, policies, grants, foreign-key dependencies and row counts without exposing user data; classify rows that may populate `gyms`.
2. Freeze the simplified gym-location columns, validation, demo-run isolation, personal-wallet compatibility and explicit legacy-object drop order.
3. Add a forward migration that creates/seeds or migrates `gyms`, removes obsolete functions/policies/triggers before their tables, simplifies organization-only wallet/challenge state, and explicitly drops the legacy hierarchy and membership/class/check-in tables without broad cascade.
4. Replace the current organization/venue/class Drizzle mappings with `gyms`; update deterministic fictional seeds and keep personal wallet repositories/tests working.
5. Validate clean and repeat migration paths, preservation of personal identity/wallet state, absence of every retired object, fictional gym data, row-level security and rollback/hosted runbooks. Apply to staging only through the separately reviewed migration operation.

## Acceptance criteria

- [x] AC1: A clean migration run retains profiles, demo-run participation and personal wallet linking while exposing one row-level-secured `gyms` location table with only bounded fictional data.
- [x] AC2: Membership products/versions/eligibility, participating-gym state, activation operations/snapshots, periods/core gyms, daily access claims, class reservations, arrival requests, check-ins, class sessions, trainer affiliations and venue-staff mutation surfaces are absent after migration.
- [x] AC3: The old organization/venue and organization-wallet authority paths are removed or transformed without deleting or weakening personal wallet bindings and link/replace challenges.
- [x] AC4: Unexpected non-demo data, active organization authority or unresolved dependencies fail the preflight/migration safely; the implementation does not rely on broad cascade or silently discard unreviewed rows.
- [x] AC5: DEV0096 can attach a coach optionally to a gym without recreating gym membership, classes, check-ins or gym authority, and independent coaches remain supported.
- [x] AC6: Clean/repeat migration, schema-drift, RLS, seed, personal-wallet regression, lint, typecheck, formatting and production-build checks pass; hosted application/rollback instructions are complete and secret-safe.

## Validation plan

Run the migration suite against a clean database and a representative pre-cleanup database containing fictional gyms plus personal wallet state. Assert exact retained/dropped relations and callable functions through PostgreSQL catalog queries. Exercise personal wallet link/replace database tests before and after migration, gym RLS/constraint/seed tests, schema export/Drizzle parity and relevant unit, lint, typecheck, format and build commands. Record hosted preflight separately; do not claim staging cleanup until the migration is deliberately applied and post-migration counts are verified.

## Implementation record

The local implementation and review are complete. The forward migration, simplified schema mappings, fictional gym seed, read-only preflight, database tests and recovery runbook are ready for a separate implementation commit. Completion records a reviewed migration artifact; it does not claim that the destructive migration was applied to hosted staging.

### Changes and rationale

- Added `20261003000100_retire_membership_schema_preserve_gyms.sql`, an explicit transactional forward migration. It hashes retained profile, demo-participant, personal-wallet and personal-challenge state before teardown; copies eligible fictional participating venues into `app.gyms` with their stable venue identifiers; removes legacy policies, triggers and functions in dependency order; converts wallet challenges/bindings to personal-only shapes; verifies the retained-state hashes; and drops the obsolete tables without `CASCADE`.
- Replaced the organization, venue, staff, trainer and group-class Drizzle mappings with the bounded `gyms` mapping. The identity mappings now match the personal-only wallet/challenge contract and contain no organization target or session-authority columns.
- Replaced the membership/class seed with eleven deterministic profiles/participants and seven fictional Berlin gym locations. The seed remains repeatable and does not create coach affiliations, availability, offers, bookings or real partnership claims.
- Replaced obsolete membership, club-wallet, reservation and check-in pgTAP suites with an exact coach-foundation contract. The new assertions cover the retained six-table `app` schema, removed objects, columns, constraints, indexes, ownership, forced row-level security (RLS), grants, discovery policies and runtime write denial. Node database tests now exercise the gym Drizzle projection and coordinate constraints while the existing personal-wallet integration suite remains authoritative for link/replace behavior.
- Added a standalone preflight with local and linked-hosted modes. Hosted mode uses Supabase's read-only Management API path and the existing CLI login or a scoped `database_read` token; it never reuses or widens the restricted application login and prints counts/object names rather than row data.
- Rewrote the Supabase runbook around the coach-first foundation, linked preflight, reviewed dry run, backup requirement and restore-only rollback for a successfully applied destructive migration.

### Affected files

- [`supabase/migrations/20261003000100_retire_membership_schema_preserve_gyms.sql`](../../../supabase/migrations/20261003000100_retire_membership_schema_preserve_gyms.sql) owns the guarded data transformation and explicit legacy teardown.
- [`src/server/db/schema/foundation.ts`](../../../src/server/db/schema/foundation.ts) and [`src/server/db/schema/identity.ts`](../../../src/server/db/schema/identity.ts) expose the resulting gym and personal-wallet schema to server code.
- [`supabase/seed.sql`](../../../supabase/seed.sql) supplies the deterministic coach-first foundation fixtures.
- [`scripts/preflight-coach-schema-cleanup.mjs`](../../../scripts/preflight-coach-schema-cleanup.mjs) and [`package.json`](../../../package.json) provide local and hosted read-only inventory commands.
- [`supabase/tests/database/foundation.test.sql`](../../../supabase/tests/database/foundation.test.sql) and [`tests/database/foundation.test.ts`](../../../tests/database/foundation.test.ts) verify the exact SQL/Drizzle contracts. The retired catalogue, activation, club-wallet, reservation and check-in test files were deleted with the surfaces they described.
- [`supabase/README.md`](../../../supabase/README.md) documents the retained foundation and safe hosted workflow. DEV0096 still owns coach profiles and the optional coach-to-gym association.

### Decisions and deviations

- 2026-10-03: The cleanup preserves gyms as informational public locations but removes the membership, group-class, reservation, arrival and check-in model. The old organization/venue abstraction is not retained because the hackathon does not need branches, gym staff, gym wallets or gym administration.
- 2026-10-03: A stable migrated gym keeps the former venue UUID and demo-run boundary so later coach affiliations do not need identity remapping. The public location label is a reviewed snapshot, not live tracking or proof that a coach is present.
- 2026-10-03: All organization wallet authorities, bindings and challenges block cleanup, including expired/revoked history, because silently discarding authority evidence would be unsafe. Personal bindings and link/replace challenges are preserved byte-for-byte across the migration and then constrained to the personal-only shape.
- 2026-10-03: The hosted preflight uses the Supabase read-only Management API because the least-privilege staging runtime login correctly cannot inspect private authority tables. Its permissions were not widened.

### Contracts, configuration, and operations

The migration is destructive to dormant legacy tables and must be backed by a restorable hosted backup plus explicit preflight evidence. There is no down migration: recovery after a successful hosted application restores the reviewed backup into an isolated recovery project before controlled staging recovery. Historical migration files remain unchanged and migration squashing is deferred.

`app.gyms` adds stable `id`/`run_id`, slug, name, bounded description/public label/area/city/country, IANA timezone, numeric latitude/longitude, provider-neutral location provenance, confirmation time, status, record source and audit timestamps. Only active gyms in the active public demo run are selectable through the read-only runtime policy. Gyms have no login, wallet, offer, schedule, booking or check-in authority.

`app.auth_challenges` and `app.wallet_bindings` remove `owner_type`, `organization_id` and organization-session authority fields after the migration proves that no organization wallet state exists. Personal identifiers, proof hashes, lifecycle fields and replacement links remain stable. No application secret or new required environment variable was added. The optional hosted preflight variables are `SUPABASE_ACCESS_TOKEN` with `database_read` scope and `SUPABASE_PROJECT_REF` when the repository is not linked; on macOS the existing Supabase CLI Keychain login is used instead.

## Validation results

- `npm run db:start` from a removed local volume: passed all historical migrations, DEV0109 and `supabase/seed.sql` on a clean PostgreSQL 17 database.
- Representative upgrade rehearsal: reset locally through `20260928000400` without seed, inserted one fictional organization/venue/participating gym plus one claimed profile, active demo participation, personal link challenge and active user-proof binding, ran `npm run db:preflight:coach-cleanup:local`, then `npx supabase migration up --local`. Exact post-migration queries confirmed all five retained identity/wallet records, the stable migrated gym UUID and absence of `organizations` and `membership_products`.
- `npm run db:preflight:coach-cleanup:local`: passed post-cleanup with 11 profiles, 11 participants, zero wallet records in the clean seed and seven gyms.
- `npm run db:seed && npm run db:seed`: passed; fixture application is repeatable.
- `npm run db:test`: passed 3 SQL files and all 74 pgTAP assertions.
- `npm run db:runtime && npm run test:db`: passed all 11 database integration tests, including atomic personal-wallet link/replace challenge behavior and runtime write denial.
- `npm run db:lint`: passed with no schema errors.
- `npx supabase db diff --local --schema app`: passed with `No schema changes found`, proving the clean local schema matches migration history.
- `npm run format:check`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` and `git diff --check`: passed; unit tests reported 43/43 and Next.js 16.3.5 produced the production route build.
- `npm run db:preflight:coach-cleanup:hosted`: correctly failed closed without mutation. Staging is pre-cleanup and contains 2 membership activation operations, 8 activation-gym snapshots, 1 membership period and 4 period-core-gym snapshots. It also contains 13 profiles/participants, 2 personal challenges/bindings and seven eligible participating gyms; organization-wallet authority count is zero. These counts are operational evidence only and do not authorize deletion.
- `npx supabase migration list --linked`: showed staging through `20260928000200`; check-in and re-reservation migrations plus DEV0109 remain local-only. `npx supabase db push --linked --dry-run` confirmed those three migrations would be considered and did not modify staging.

## Risks, limitations, and follow-ups

Hosted staging must not receive DEV0109 yet. Its two activation operations, one membership period and dependent snapshots require an explicit retain/export/disposition decision and a verified backup before a separately authorized migration operation. The current migration will reject that state transactionally rather than delete it. Staging is also two migrations behind local; the reviewed dry run must be repeated after the historical-data decision.

The Supabase Management API read-only query endpoint is currently beta, so the local database mode remains the deterministic fallback for migration review. Gym moderation, real partner onboarding, branch ownership and coach/gym commercial relationships remain outside this ticket.

## Completion and review references

- Completed: 2026-10-03.
- Commit: This commit — `[DEV0109] Retire legacy membership schema`. Commit `b60fc47` (`[DEV0095][DEV0109] Present coach story and plan schema cleanup`) records the earlier planning/In-progress boundary only.
- Review: Implementation self-review against all acceptance criteria; no independent review.
- Deployment or release: Not deployed. Hosted staging was inspected read-only and intentionally left unchanged because the preflight found historical membership state requiring a separate decision and authorization.
