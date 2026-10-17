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
docker exec -i supabase_db_movx-club-local psql -X -U postgres -d dev0265_fresh -v ON_ERROR_STOP=1 --single-transaction < supabase/migrations/20261016000200_effective_coach_availability.sql
docker exec -i supabase_db_movx-club-local psql -X -U postgres -d dev0265_fresh -v ON_ERROR_STOP=1 --single-transaction < supabase/seed.sql
```

Run driver fixtures before data-sensitive pgTAP checks:

```sh
DATABASE_TEST_URL=postgresql://postgres:postgres@127.0.0.1:55322/dev0265_fresh node --import tsx --conditions=react-server --test --test-concurrency=1 tests/database/*.test.ts
./node_modules/.bin/supabase test db --db-url postgresql://postgres:postgres@127.0.0.1:55322/dev0265_fresh
./node_modules/.bin/supabase db lint --db-url postgresql://postgres:postgres@127.0.0.1:55322/dev0265_fresh --schema app --fail-on warning
```

Those complete-suite commands must match the source revision represented by the target schema. The current owner-calendar SQL tests also require `20261016000300_owner_coach_calendar.sql`, validated on hosted dev under [DEV0271](../tickets/archive/backend/DEV0271-apply-hosted-dev-calendar-migration.md); apply that forward file to the owned disposable database after `20261016000200` before running the current complete suite. This SQL rollout does not complete DEV0254's interface evidence. Future forward work requires its separately validated migrations and tests; the baseline rehearsal intentionally excludes post-cutoff migrations. Compare the two frozen rehearsal databases before applying any forward migration, since a later schema should differ from the original cutoff. Remove retained scratch databases explicitly afterward using `docker exec <local-container> dropdb -U supabase_admin <exact-owned-name>`.

Maintainer reproduction of the frozen artifact is `node scripts/database-baseline.mjs generate dev0265_replay`, followed by `verify` and `compare dev0265_replay dev0265_fresh`. Generation reads an explicit `dev0265_*` reference and writes only the baseline/checksum; it must use the original replay with `postgres` as migration owner. Managed infrastructure restore uses `supabase_admin`. PostgreSQL normalizes associative CHECK expressions when parsing a restored dump: the comparer checks them through temporary empty tables in rolled-back transactions while comparing other definitions, comments/ACLs/owners and enforcement flags exactly. Supabase's generic squash omits DML; explicit Storage bootstrap here closes that gap.

Rollback before any database transition is a repository revision rollback; no retained data/ledger changes need undoing. Once a new database uses this baseline, continue with forward fixes rather than replaying the archived chain over it. This maintenance scope does not authorize destructive rollback or old-ledger repair.

## Local development and database tests

Normal local application development uses Docker-backed Supabase through `npm run dev` (aliases `dev:local` and `dev:docker`). It requires Node.js 24.21.x, the locked npm dependencies and a running Docker-compatible container runtime. The fresh project `movx-club-local` uses PostgreSQL port `55322`, Auth/API port `55321` and Mailpit port `55324`. Initial startup applies the accepted baseline/forward migrations and seed; subsequent startup preserves data and applies pending migrations. The retired `fitness-booking-social-app` volumes are never mounted by this project. Their legacy transition remains DEV0232. [Hosted dev](#separate-hosted-environments) is explicit `npm run dev:hosted` and remains UAT's database.

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

Normal `npm run dev` already prepares the Auth-enabled services and restricted login. If you previously selected the database-only profile, switch to the Auth-enabled profile before rehearsing sign-in:

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
node --env-file=.env.development.local scripts/verify-hosted-runtime-database.mjs --environment dev
```

The verifier requires an explicit `--environment dev|prod` plus `DATABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL`. It checks the selected project/runtime-role pair before connecting, then role attributes, `app_runtime` membership, absence of `app_owner` membership, direct-write restrictions, current booking-request/acceptance function access and browser-role isolation. It never loads the old staging file or reads a default Keychain credential. `npm run db:verify:hosted-runtime -- --environment dev` works when the required values are already exported into the process.

## Separate hosted environments

The user confirmed these independent Supabase projects on 16 October 2026; [public environment metadata](../config/supabase-environments.json) is shared by the startup, verifier and Vercel guards. Actual target setup and remaining evidence belong to [DEV0267 dev](../tickets/archive/backend/DEV0267-connect-new-hosted-dev-environment.md) and [DEV0268 prod](../tickets/current/backend/DEV0268-prepare-isolated-production-environment.md).

| Use                    | Application origin                                           | Project reference                    | Dedicated runtime login   |
| ---------------------- | ------------------------------------------------------------ | ------------------------------------ | ------------------------- |
| Local app and UAT/test | `http://localhost:3100` and planned `https://test.movx.club` | `mdzidiqosxbghmfyxphb` (`movx-dev`)  | `movx_dev_runtime_login`  |
| Production             | Planned `https://movx.club`                                  | `yltijwebedkraypgkqmc` (`movx-prod`) | `movx_prod_runtime_login` |

Both projects are in Frankfurt (`eu-central-1`). They have separate Auth users, Storage and database state. Local and UAT intentionally share dev data; production receives no development demonstration seed or copied test accounts. New authentication providers and old-data transfer are separate work. Keep the old staging and retained Docker environments unchanged during new dev setup.

The local hosted mode reads the ignored `.env.development.local`; its [checked-in example](../.env.development.local.example) contains placeholders only. Use the provider's actual shared transaction-pooler host from the Connect dialog, with username `<runtime-login>.<project-reference>`, URL-encoded password and port `6543`, database `postgres`, without query options. Do not infer the pooler index from the region. The application uses TLS and disables prepared statements. Only the restricted runtime password belongs in this file; migration-owner and CLI credentials do not.

```sh
node --env-file=.env.development.local scripts/start-hosted-development.mjs --check
npm run dev
```

`dev:hosted` uses guarded hosted startup. It validates the dev target, a public `sb_publishable_` key and an exact `http://localhost:<unprivileged-port>` origin (normally `http://localhost:3100`) before launching Next.js. It starts/creates no Docker database and runs no migrations, seeds or automatic test-account provisioning. Missing or wrong hosted settings stop startup without a local fallback.

Ordinary `dev`, `dev:local` and the `dev:docker` alias use the isolated local stack. The local launcher overrides the four database/Auth/site settings in its child environment, including when the hosted settings file exists, and removes privileged operator variables. DEV0232 still owns the retired stack's old-history transition. Existing app processes must be restarted to adopt a different target. No existing hosted configuration or retained volume is changed by switching commands.

Vercel Development and Preview/UAT use the dev project's four application settings; Vercel Production uses prod's. Each deployment's `NEXT_PUBLIC_SITE_URL` must be that application's exact HTTPS origin and match its Supabase Auth URL configuration. Hosted Vercel builds reject swapped projects, owner roles or mismatched runtime suffixes. Environment-free public-preview builds remain available. Public Auth values are embedded at build time, so changing projects requires a fresh build with the right values. Domain assignment and live publishing remain separate operator work.

New-project setup first inspects actual schema/history/Auth/Storage state and reviews a dry-run of the accepted baseline/forward files. It never runs the baseline over an existing application schema. UAT's exact origin and SMTP/provider configuration need actual verification; project existence and local configuration checks do not imply working email delivery or deployment. The current email-code sign-in contract remains unchanged.

Dev's baseline/effective-availability setup through `20261016000200`, complete fictional seed, private-image buckets and restricted login were verified under DEV0267. [DEV0271](../tickets/archive/backend/DEV0271-apply-hosted-dev-calendar-migration.md) subsequently applied the unchanged owner-calendar migration `20261016000300` to this dev project after rollback-only SQL validation. Its exact three-version ledger, function body/owner/ACL and no-pending-migration state are verified; all 39 existing application-table fingerprints and Auth/Storage counts were preserved. Ignored mode-0600 `.env.development.local` contains the working local application connection. Dev Auth has site URL `https://test.movx.club` and exact redirects `http://localhost:3100/sign-in` and `https://test.movx.club/sign-in`, with six-digit, one-hour codes and a 60-second resend interval. Neither domain is deployed by this setup, and production remains unmodified.

The calendar SQL rollout passed eight permission assertions and 21 successful/negative runtime assertions before and after installation. Its reproducible [owner-operated validator](../scripts/sql/verify-coach-calendar-rollout.sql) creates only tagged transaction-local fixtures and ends with rollback. To verify the installed function deliberately, with an authorized Supabase CLI login and an explicit dev target:

```sh
./node_modules/.bin/supabase db query --linked --project-ref mdzidiqosxbghmfyxphb --file scripts/sql/verify-coach-calendar-rollout.sql --output json
```

This is an explicit operator test, never part of app startup. It requires owner/role-switch authority and the dev fixture catalogue, sends no email and leaves no fixture accounts/rows behind. The original supplied pgTAP assertions were additionally enforced in the rollout's rollback transaction; pgTAP was not left installed. [DEV0254](../tickets/archive/frontend/DEV0254-add-private-and-group-coach-calendar.md) subsequently completed real Auth/browser and original-detail integration against this hosted target; that frontend proof is separate from the SQL assertions.

The explicit [hosted calendar browser rehearsal](../scripts/rehearse-hosted-coach-calendar.mjs) requires the existing dev app settings, an authorized Supabase CLI login and Chrome:

```sh
node --env-file=.env.development.local scripts/rehearse-hosted-coach-calendar.mjs
```

It creates only uniquely tagged temporary Auth/application fixtures, generates test OTPs without email delivery, and runs unchanged routes/services with the restricted application login in an owned temporary source copy. Its operator Auth key stays in process memory and is excluded from Next.js. It removes exact fixtures and verifies baseline non-temporary records while preserving concurrent peer fixtures. If interrupted, rerun the same command with `--cleanup` to use its ignored exact-ID manifest; a normal run refuses an existing manifest. It never runs on app startup and does not reset, seed, migrate or start Docker.

Dev uses the existing Porkbun SMTP service (`smtp.porkbun.com`, STARTTLS port 587, sender `MovX Club <hello@movx.club>`), a 10-email-per-hour project cap and the checked-in code-only body for both signup-confirmation and returning-user magic-link templates. Hosted email confirmation and other security defaults remain enabled. The ignored mode-0600 `.env.supabase-smtp.local` is an operator input only, never an application/Vercel setting. The user authorized one sign-in test: the email arrived, its code verified, and the actual local app recognized the session while correctly requiring profile onboarding. The test session was signed out and temporary code removed. This verifies one new-account email/session path; returning-user browser onboarding, real-user scheduling and deployed UAT remain separate evidence. DEV0267 records the commands, settings and limits.

The guarded Vercel build requires the complete database/Auth group whenever hosted runtime mode is enabled. Keep the Vercel function region close to the Supabase project and measure hosted connection behavior before changing the request-owned connection model in `src/server/db/client.ts`.

## Hosted changes and recovery

### Established coach conversations (DEV0276)

The forward migration `20261017000100_normal_coach_conversations.sql` allows ordinary messages in an existing inquiry/request/booking conversation while the coach is enabled and the pair unblocked. It replaces one private permission function and preserves message/consent records, ownership and privileges. Install it before deploying the simplified composer; its legacy `canSendGeneral` response field now includes this conversation grant. The frozen baseline/history remains unchanged. Rollback requires a reviewed forward correction restoring the earlier function and compatible composer; do not delete or rewrite retained messages.

On 17 October 2026, the isolated local stack advanced from the exact three-version baseline/availability/calendar ledger to include this fourth version. The migration and its ledger entry were installed in one transaction after rollback-only permission tests passed. Fingerprints for all 39 application tables, Auth users and both Storage tables (42 total) and function owner/ACL/security/search-path metadata were identical before and after. Hosted dev/production remain unchanged and still require their separately reviewed rollout.

### Unlimited coach messages (DEV0278)

The subsequent `20261017000200_unlimited_coach_messages.sql` removes per-conversation, per-actor and new-counterpart quotas. It retains `app.mail_rate` as a private compatibility no-op; the original send entry points still enforce authentication, participant/dataset scope, message length, exact retries and blocking. DEV0276's normal-conversation migration remains required first. No message/history/consent data, function privileges, payloads or environment variables change. Legacy consent-request decisions are retained and do not gate ordinary established chat. Apply this forward migration before claiming unlimited messages on an environment. Rollback requires a reviewed forward correction restoring the quota helper; never delete retained messages. Local installation evidence is recorded in [DEV0278](../tickets/archive/backend/DEV0278-allow-unlimited-coach-messages.md); hosted dev/production rollout remains separate.

On 17 October 2026, this fifth local ledger version and its exact SQL were installed atomically after the rollback-only messaging suite passed. Fingerprints for the same 42 data tables and the quota helper's owner/privileges/security/search path were unchanged. No reset or seed was performed; hosted environments were untouched.

### Retired message approvals (DEV0280)

`20261017000300_retire_message_requests.sql` follows those two messaging migrations. It replaces two private helpers: historical contact qualifies for normal chat under existing coach/block checks, and only actual incoming message entries drive unread. The compatible `canRequestGeneral` field is always false. Original consent audit rows and pending opening text remain; the app displays that text passively and rejects obsolete request/decision commands and requests filtering. Install this migration before publishing the approval-free interface/API. Private database compatibility routines remain; this is not a history-deletion migration.

The sixth local ledger version and its exact SQL were installed atomically on 17 October 2026 after rollback-only upgrade checks passed. All 42 app/Auth/Storage table fingerprints and both helpers' ownership, privileges, security mode and search path matched before/after. No reset or seed was used. Hosted rollout remains separate; rollback requires compatible app behavior and a reviewed forward helper correction without deleting contact history. See [DEV0280](../tickets/archive/backend/DEV0280-retire-message-request-approvals.md).

### Private account settings

`20261017000500_private_account_settings.sql` follows `20261017000400_message_counterpart_media.sql` and is required before publishing the editable `/account` page. It adds the owner-only `app.account_personal_details` table and bounded current-account read/save functions. The optional birthdate/gender fields never join existing public, coach, message or booking projections. Personal name changes retain the identity, avatar, separate coach name and authority; compare-and-swap revisions protect edits and exact previous-revision retries recover the saved result. Runtime retains no direct profile/personal-details write privilege. No Auth, Storage, environment or dependency changes are needed.

The exact migration and its eighth local ledger entry were installed atomically on 17 October 2026 after 30 rollback-only database checks passed; all 42 existing app/Auth/Storage table fingerprints were unchanged. The 30 checks passed again against the installed schema. No reset, seed or hosted operation was performed. See [DEV0294](../tickets/current/frontend/DEV0294-add-separate-account-settings.md) for account UI and validation evidence. Roll back the interface if needed and retain stored personal fields; any schema rollback needs a reviewed forward correction, not a destructive table drop.

Review `npx supabase db push --linked --dry-run` before applying a hosted migration. Never run a linked reset against a project with user or booking data. Confirm a restorable provider backup before a risky forward migration, apply it in a bounded maintenance window, and rerun database/runtime verification afterward.

The scheduling-only migrations are additive: historical rows and tables remain, while new bookings leave the historical credit reference null. The coach-application migration retains historical activation/profile/booking data, marks known fictional coaches as demo records and moves prior user-created coach profiles to hidden pending state rather than silently verifying them. Rollback is application rollback plus a reviewed forward correction; do not delete historical provider or review data merely because the current runtime no longer reads it.
