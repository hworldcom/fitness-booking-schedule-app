# Ticket DEV0065: Rename demo-run participants

- Status: Completed
- Created: 2026-09-24
- Last updated: 2026-10-14
- Milestone: M0 identity and schema clarity
- Coordination: None — independent development ticket
- Related records: follows the database foundation in [DEV0015](DEV0015-supabase-database-foundation.md), protected actor context in [DEV0040](DEV0040-protected-access-and-database-context.md), email identity in [DEV0046](DEV0046-email-otp-registration-and-application-profiles.md), and the consumer-membership removal in DEV0048

> Documentary pruning — 2026-10-14, [DEV0225](../organisatory/DEV0225-remove-blockchain-historical-evidence.md): superseded feature evidence and deleted-reference details were removed at the user’s request. Retained text records the independent outcome at its original date. Code/data fragments are historical excerpts, not complete current contracts; aggregate test totals remain totals of the original runs, not new retained-only validation. Original completion dates remain unchanged. Earlier revisions remain in Git history.

## Objective and context

Rename the internal `app.demo_run_memberships` relation to `app.demo_run_participants` so application dataset participation is not confused with customer fitness memberships.

The relation records that an application profile participates in one isolated demonstration dataset with a base application role. It is not a gym membership product, purchased entitlement or organization role. Consumer memberships will return later through a separate reviewed contract.

## Scope and non-goals

- In scope: add one forward migration that renames the live table and its own constraints, index, trigger and policies; update stored identity/actor functions that refer to the old relation; update the Drizzle mapping, seed, local scripts, database tests and current planning terminology; prove the old relation name is absent after a clean migration replay.
- Out of scope: changing participant columns, roles or authorization behavior; renaming `organization_memberships`; adding customer membership products or entitlements; rewriting already-applied historical migrations; squashing migration history; applying the migration to hosted staging or deploying the application.

## Expected behavior and edge cases

Existing participant rows, foreign keys, ownership, grants and row-level-security behavior survive the rename. A clean database replay creates the historical relation first and renames it in the new forward migration; an already-migrated database applies the same rename without data copy or deletion.

The old `app.demo_run_memberships` name must not remain as a compatibility view or alias because that would preserve the ambiguity. Historical migration files and archived tickets retain the old name as an accurate record of what was previously applied.

## Assumptions, decisions, and dependencies

- The table is internal dataset participation, so `demo_run_participants` is the adopted name.
- Preserve the columns and the base role values `member` and `operator`; renaming the role vocabulary would be a separate authorization change.
- Use a new forward migration because the seven existing migrations have already been applied to hosted staging. Do not edit or delete those migration files.
- Recreate the three current stored functions that contain the old relation name by replacing only their checked-in qualified relation reference. Foreign keys continue to target the renamed relation through PostgreSQL object identity.
- Migration squashing is evaluated separately. It is not required for this rename and must not silently rewrite linked staging migration history.

## Implementation plan

1. Add a forward migration that renames the table and its participant-owned database object names, then refreshes the three current stored function definitions.
2. Rename the Drizzle export/table metadata and update all active seed, script and test queries to participant terminology.
3. Update current planning documentation while preserving historical migrations and archived records.
4. Replay the local database, run SQL and driver validation, and run relevant unit, lint, type and formatting checks.
5. Record whether hosted application and deployment remain follow-up work; do not claim staging application without explicitly applying it.

## Acceptance criteria

- [x] AC1: A clean database exposes `app.demo_run_participants` with all existing rows/columns, constraints, ownership, grants, row-level security and participant-owned object names, and exposes no `app.demo_run_memberships` relation.
- [x] AC2: Email enrollment/current-identity and protected actor validation use the renamed relation and retain their existing authorization, idempotency and isolation behavior.
- [x] AC4: Active application mappings, seed, scripts, tests and current planning use dataset-participant terminology; historical migrations and archived tickets remain unchanged.
- [x] AC5: Local migration replay, SQL/database checks, focused driver tests, unit tests, lint, typecheck and formatting pass, with any environment-blocked checks recorded precisely.

## Validation plan

Inspect the final catalogue for the new table, renamed participant-owned objects, preserved foreign keys and absence of the old relation. Run `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check` and `git diff --check`.

## Implementation record

Implementation started after confirming that the old name appears in stored identity/authorization functions, policies, the server mapping, seeds, scripts and tests. The existing migrations are already linked to staging, so this ticket uses a forward rename rather than rewriting migration history.

### Changes and rationale

Added a forward-only migration that renames `app.demo_run_memberships` to `app.demo_run_participants` without copying or deleting data. The migration also renames the relation-owned constraints, lookup index, update trigger and row-level-security policies so schema inspection uses participant terminology consistently.

Three stored identity/authorization functions contained the old qualified relation name in their stored source. The migration refreshes exactly those checked-in functions through `pg_get_functiondef`, asserts that each contains the expected old reference, and replaces only that qualified relation reference. Their ownership, signatures and grants remain unchanged. A table comment now states explicitly that these rows are application-dataset participants rather than customer fitness memberships.

Current DEV0018 planning uses the new terminology. Historical migrations and archived tickets retain the old name because they record the schema that was actually applied at that point in time.

### Affected files

| File or component                                                                                                     | Change and purpose                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/20260924000100_rename_demo_run_participants.sql`                                                 | Renames the relation and its owned object names, refreshes stored function references and documents the final meaning without rewriting prior migrations. |
| `src/server/db/schema/foundation.ts`, `src/server/db/schema/identity.ts`, `src/server/db/authorization/repository.ts` | Map and query the final database relation through the `demoRunParticipants` export while preserving every existing foreign key and actor rule.            |
| `tickets/current/backend/DEV0018-class-pass-reservations-and-confirmed-visits.md`, `tickets/README.md`                | Use participant terminology in current planning and register this development ticket.                                                                     |

### Decisions and deviations

- 2026-09-24: Kept migration squashing outside this ticket because a squash changes migration-history operations, while this ticket is a behavior-preserving schema rename.
- 2026-09-24: The first disposable replay exposed invalid schema-qualified `position(...)` syntax in the function-refresh guard. Replaced it with `pg_catalog.strpos(...)`; the next complete replay and all schema tests passed.

### Contracts, configuration, and operations

The database relation name changes from `app.demo_run_memberships` to `app.demo_run_participants`. Columns, row values, base roles, privileges and environment variables remain unchanged. Historical migrations remain the reproducible pre-rename chain. Hosted staging requires a coordinated release: apply the forward migration and deploy the matching application revision together because the currently deployed build still queries the old name.

## Validation results

Validated on 2026-09-24 against the disposable local Supabase PostgreSQL 17 stack.

- `npm run db:reset` — passed after the syntax correction; replayed all eight migrations in order, seeded `app.demo_run_participants` and restarted the local stack.
- `npm run db:test` — passed 89 PostgreSQL assertions across four files. Durable checks prove the old relation and old participant-owned object names are absent, stored identity/actor functions contain no legacy relation reference, and all authorization behavior still passes.
- `npm run db:lint` — passed with no schema errors.
- `npm test` — passed all 51 unit/boundary tests.
- `npm run lint`, `npm run typecheck`, `npm run format:check`, and `git diff --check` — passed.
- `npm run build` — the standard Turbopack build remained blocked by the host environment while its CSS loader attempted to create an internal process and bind a port (`Operation not permitted`). `npx --no-install next build --webpack`, the established repository fallback for this host restriction, compiled successfully, completed TypeScript and generated all 13 static pages.
- Repository terminology audit — active source, scripts, seed, current tickets and tests contain the old relation name only in negative assertions proving its absence. Historical migrations, archived tickets and this migration/record retain it where necessary to describe or transform history.

| Criterion | Evidence                                                            | Result |
| --------- | ------------------------------------------------------------------- | ------ |
| AC1       | Clean eight-migration replay plus foundation catalogue assertions   | Passed |
| AC2       | Identity/authorization SQL tests and driver integration tests       | Passed |
| AC4       | Active-file terminology audit and reviewed historical exclusions    | Passed |
| AC5       | SQL 89/89, driver 13/13, unit 51/51, lint/type/format/schema checks | Passed |

## Risks, limitations, and follow-ups

The code and database migration must be released together because pre-migration code queries the old name and post-change code queries the new name. Hosted migration and application deployment were not authorized by this local schema request and remain a controlled follow-up. A future customer-membership ticket must not reuse this participant relation.

## Completion and review references

- Completed: 2026-09-24 — renamed dataset participation throughout the final schema and active application without changing authority or data behavior.
- Commit: `[DEV0065] Rename demo-run participants` (the implementation commit containing this completed record).
- Review: Implementation self-review completed; no independent review exists.
- Deployment or release: Not deployed; hosted staging still has the old relation name until the forward migration is applied.
