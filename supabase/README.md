# Scheduling database operations

This directory contains MovX Club's checked-in Supabase PostgreSQL history. Files under `migrations/` are the active migration source of truth for new databases. Drizzle mirrors current runtime tables for typed server queries and does not own a second migration journal.

## Migration baseline and history

The user-authorized [DEV0265](../tickets/archive/backend/DEV0265-baseline-completed-database-migrations.md) transition replaces 53 completed active files through `20261016000100` with [`20261016000100_baseline.sql`](migrations/20261016000100_baseline.sql). Their immutable originals and checksums remain in [migration-history](migration-history/README.md). The baseline preserves their final tables/functions/constraints, comments, owners, row-level security, grants/default privileges and project Storage policies; it explicitly creates the required avatar/portrait buckets and application roles/extensions. It retains historical wallet/payment/social/event tables as compatibility objects without exposing new runtime features. Demo rows remain in `seed.sql`, separately from required bootstrap configuration.

New forward migrations retain later versions in `migrations/`. The calendar migration `20261016000200` is independent work beyond this cutoff, locally validated under [DEV0252](../tickets/archive/backend/DEV0252-persist-effective-coach-availability.md); shared/hosted rollout remains separate. Do not alter archived originals or regenerate this frozen baseline to absorb later changes. Use reviewed forward migrations for subsequent corrections.

### Fresh databases

Only a new/empty application schema consumes the baseline. It refuses an existing `app` schema before applying bootstrap changes. Apply active migrations, then the complete seed where demonstration data is intended, and provision the environment-specific restricted runtime login. Production seed/data selection and new hosted setup remain separate operational work; this cleanup creates no hosted project and copies no users or files.

The local `db:reset` command below is for an explicitly disposable stack. A retained database with old history entries must use the existing-environment handoff instead.

### Existing databases

Existing local and hosted databases keep their schemas, accounts, files and old migration ledger untouched by this repository change. The CLI compares recorded migration versions with active files, so it may reject an old ledger after the packaging transition. Do not run the baseline over existing data or clear/mark old history entries merely to suppress that mismatch.

Keep the prior repository revision or archived original chain for the retained environment while its transition is reviewed. [DEV0232](../tickets/current/organisatory/DEV0232-restore-local-migration-continuity.md) still owns branch-only versions and local continuity; this baseline does not resolve their provenance. A retained environment needs schema/history comparison, a restorable data/file backup and a specific transition plan before changing its ledger or importing into a new project. Schema baseline files do not transfer Auth identities, passwords, Storage objects, SMTP/provider settings or redirect URLs.

### Reproduce baseline validation

Use the installed Node.js dependencies, Docker and the local Supabase database container. From the repository root:

```sh
node scripts/database-baseline.mjs verify
node scripts/rehearse-database-baseline.mjs
```

The rehearsal reads only the shared database's schema infrastructure, creates `dev0265_replay` and `dev0265_fresh`, replays the immutable originals versus the active baseline, runs the complete seed and compares definitions/security/Storage setup. It proves existing-schema refusal and deliberately altered CHECK/function-grant detection, then verifies repeated seeding preserves ordinary/claimed accounts. It refuses pre-existing scratch database names and normally removes only the databases it created. No source account/application/file rows are copied.

`BASELINE_DATABASE_CONTAINER` overrides the local container name. `BASELINE_KEEP_DATABASES=1` retains only the owned rehearsal databases for further checks; the documented local database port is `55322`. To run the current full suite after that frozen-baseline rehearsal, apply completed forward migrations in version order to the owned `dev0265_fresh` database first. At this revision the additional migration is DEV0252:

```sh
docker exec -i supabase_db_fitness-booking-social-app psql -X -U postgres -d dev0265_fresh -v ON_ERROR_STOP=1 --single-transaction < supabase/migrations/20261016000200_effective_coach_availability.sql
docker exec -i supabase_db_fitness-booking-social-app psql -X -U postgres -d dev0265_fresh -v ON_ERROR_STOP=1 --single-transaction < supabase/seed.sql
```

Run driver fixtures before data-sensitive pgTAP checks:

```sh
DATABASE_TEST_URL=postgresql://postgres:postgres@127.0.0.1:55322/dev0265_fresh node --import tsx --conditions=react-server --test --test-concurrency=1 tests/database/*.test.ts
./node_modules/.bin/supabase test db --db-url postgresql://postgres:postgres@127.0.0.1:55322/dev0265_fresh
./node_modules/.bin/supabase db lint --db-url postgresql://postgres:postgres@127.0.0.1:55322/dev0265_fresh --schema app --fail-on warning
```

Those complete-suite commands must match the source revision represented by the target schema. Future forward work requires its separately validated migrations and tests; the baseline rehearsal intentionally excludes post-cutoff migrations. Compare the two frozen rehearsal databases before applying any forward migration, since a later schema should differ from the original cutoff. Remove retained scratch databases explicitly afterward using `docker exec <local-container> dropdb -U supabase_admin <exact-owned-name>`.

Maintainer reproduction of the frozen artifact is `node scripts/database-baseline.mjs generate dev0265_replay`, followed by `verify` and `compare dev0265_replay dev0265_fresh`. Generation reads an explicit `dev0265_*` reference and writes only the baseline/checksum; it must use the original replay with `postgres` as migration owner. Managed infrastructure restore uses `supabase_admin`. PostgreSQL normalizes associative CHECK expressions when parsing a restored dump: the comparer checks them through temporary empty tables in rolled-back transactions while comparing other definitions, comments/ACLs/owners and enforcement flags exactly. Supabase's generic squash omits DML; explicit Storage bootstrap here closes that gap.

Rollback before any database transition is a repository revision rollback; no retained data/ledger changes need undoing. Once a new database uses this baseline, continue with forward fixes rather than replaying the archived chain over it. This maintenance scope does not authorize destructive rollback or old-ledger repair.

## Local workflow

Prerequisites are Node.js 24.21.x, the locked npm dependencies and a running Docker-compatible container runtime. This repository uses PostgreSQL port `55322`.

```sh
npm ci
npm run db:start
npm run db:reset
npm run db:runtime
npm run db:test
npm run test:db
npm run db:lint
```

`db:reset` recreates an explicitly disposable local database from the active baseline/forward migrations and then runs the complete `seed.sql`. The seed omits the unused incompatible funding-event fixture and preserves claimed coach disciplines and cleared portraits. `db:runtime` provisions the loopback-only `repx_runtime_login`, which inherits the restricted `app_runtime` role. Local application routes use:

```dotenv
DATABASE_URL=postgresql://repx_runtime_login:postgres@127.0.0.1:55322/postgres
```

The local integration suite connects as the disposable PostgreSQL administrator so it can create and clean fixtures, then exercises application repositories through the restricted runtime login. Browser code never receives `DATABASE_URL`.

## Local email Auth

Switch from the database-only profile to the Auth-enabled profile before rehearsing sign-in:

```sh
npm run db:stop
npm run auth:start
npm run auth:status
npm run db:runtime
```

Copy the printed public API URL and publishable key into the variables documented in `.env.example`. The command deliberately omits secret/service-role keys. Open `http://localhost:3100/sign-in`, request a one-time code, and read it from Mailpit at `http://127.0.0.1:55324`.

With the application running on port `3100`, `npm run test:auth` rehearses account creation, invalid-code handling, isolated profiles, sign-out and returning-account login. `npm run test:coach-availability` rehearses recurring availability. Neither flow requires payment or external identity tooling.

## Runtime authority

- Supabase Auth establishes email identity.
- Transaction-local actor context binds an Auth user to one application profile and demo run.
- Every enrolled account retains client capability. `app.submit_owned_coach_application()` records coach intent but cannot grant coach authority.
- Pending or rejected applicants may own only a hidden coach-profile draft. Current `approved` state is required to publish, manage availability or receive new bookings.
- `app.review_coach_application(uuid,text,text,text,text,text)` is owner-only, expected-state guarded and appends immutable review evidence atomically. It is never executable by `app_runtime` or browser roles.
- `app.coach_trust_kind(uuid,boolean)` derives the bounded public trust label: current real approvals are `verified`; fictional seed profiles are `demo`.
- `app.replace_owned_coach_availability_rules(jsonb, jsonb)` atomically replaces one coach's complete working week after checking the editor's persisted baseline, then synchronizes dated occurrences once.
- `app.book_direct_private_session(uuid)` atomically creates or recovers one confirmed booking and marks its occurrence booked.
- `app.cancel_direct_private_booking(uuid)` allows the booking client or coach to cancel a future confirmed booking and reopen its occurrence.
- `app.complete_direct_private_booking(uuid)` allows only the owning coach to complete an elapsed confirmed booking.
- `app.current_direct_private_bookings()` returns the bounded private projection only to the booking client or coach.
- Capacity-one enforcement and lifecycle constraints live in PostgreSQL, not browser state.

The migration connection owns objects through the `NOLOGIN` role `app_owner`. The `NOLOGIN` role `app_runtime` cannot bypass row-level security (RLS), cannot write scheduling tables directly and can execute only bounded functions. Browser-facing `anon`, `authenticated` and `service_role` roles have no `app` schema usage.

The interim `npm run coach:review` command uses a separate `COACH_REVIEW_DATABASE_URL` owner connection, defaults to dry-run and requires `--apply --confirm <exact-profile-id>` before changing state. Its policy checklist and examples are documented in the root README. This credential is an operator secret, not a runtime deployment variable. Historical `coaching_activated_at` values remain for continuity but no longer authorize coaching.

## Hosted runtime login

Hosted environments use a dedicated generated login that inherits only `app_runtime`. Store its password in the deployment provider's encrypted server-only settings; do not put it in a migration or prefix it with `NEXT_PUBLIC_`.

Use the Supabase transaction pooler on port `6543`. The username must include the project-reference suffix required by the shared pooler. Verify the assembled URL without printing it:

```sh
npm run db:verify:hosted-runtime
```

The verifier checks pooler use, role attributes, `app_runtime` membership, absence of `app_owner` membership, direct-write restrictions, direct-booking function access and browser-role isolation. It loads an ignored `.env.staging.local` when present and otherwise supports the project's existing macOS Keychain item.

The guarded Vercel build requires the complete database/Auth group whenever hosted runtime mode is enabled. Keep the Vercel function region close to the Supabase project and measure hosted connection behavior before changing the request-owned connection model in `src/server/db/client.ts`.

## Hosted changes and recovery

Review `npx supabase db push --linked --dry-run` before applying a hosted migration. Never run a linked reset against a project with user or booking data. Confirm a restorable provider backup before a risky forward migration, apply it in a bounded maintenance window, and rerun database/runtime verification afterward.

The scheduling-only migrations are additive: historical rows and tables remain, while new bookings leave the historical credit reference null. The coach-application migration retains historical activation/profile/booking data, marks known fictional coaches as demo records and moves prior user-created coach profiles to hidden pending state rather than silently verifying them. Rollback is application rollback plus a reviewed forward correction; do not delete historical provider or review data merely because the current runtime no longer reads it.
