# Scheduling database operations

This directory contains MovX Club's checked-in Supabase PostgreSQL history. Files under `migrations/` are the active migration source of truth for new databases. Drizzle mirrors current runtime tables for typed server queries and does not own a second migration journal.

## Migration baseline and history

The user-authorized [DEV0265](https://github.com/hworldcom/movx-work-records/blob/b49f60b2454b3de9345c395acbc08f324bcdabb3/originals/tickets/archive/backend/DEV0265-baseline-completed-database-migrations.md) transition replaces 53 completed active files through `20261016000100` with [`20261016000100_baseline.sql`](migrations/20261016000100_baseline.sql). Their immutable originals and checksums remain in [migration-history](migration-history/README.md). The baseline preserves their final tables/functions/constraints, comments, owners, row-level security, grants/default privileges and project Storage policies; it explicitly creates the required avatar/portrait buckets and application roles/extensions. It retains historical wallet/payment/social/event tables as compatibility objects without exposing new runtime features. Demo rows remain in `seed.sql`, separately from required bootstrap configuration.

New forward migrations retain later versions in `migrations/`. The calendar migration `20261016000200` is independent work beyond this cutoff, locally validated under [DEV0252](https://github.com/hworldcom/movx-work-records/blob/b49f60b2454b3de9345c395acbc08f324bcdabb3/originals/tickets/archive/backend/DEV0252-persist-effective-coach-availability.md); shared/hosted rollout remains separate. Do not alter archived originals or regenerate this frozen baseline to absorb later changes. Use reviewed forward migrations for subsequent corrections.

### Fresh databases

Only a new/empty application schema consumes the baseline. It refuses an existing `app` schema before applying bootstrap changes. Apply active migrations, then the complete seed where demonstration data is intended, and provision the environment-specific restricted runtime login. Production seed/data selection and new hosted setup remain separate operational work; this cleanup creates no hosted project and copies no users or files.

The local `db:reset` command below is for an explicitly disposable stack. A retained database with old history entries must use the existing-environment handoff instead.

### Existing databases

Existing local and hosted databases keep their schemas, accounts, files and old migration ledger untouched by this repository change. The CLI compares recorded migration versions with active files, so it may reject an old ledger after the packaging transition. Do not run the baseline over existing data or clear/mark old history entries merely to suppress that mismatch.

Keep the prior repository revision or archived original chain for the retained environment while its transition is reviewed. [DEV0232](https://linear.app/movx/issue/MOV-50/dev0232-restore-local-migration-continuity-on-main) still owns branch-only versions and local continuity; this baseline does not resolve their provenance. A retained environment needs schema/history comparison, a restorable data/file backup and a specific transition plan before changing its ledger or importing into a new project. Schema baseline files do not transfer Auth identities, passwords, Storage objects, SMTP/provider settings or redirect URLs.

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

Those complete-suite commands must match the source revision represented by the target schema. The current owner-calendar SQL tests also require `20261016000300_owner_coach_calendar.sql`, validated on hosted dev under [DEV0271](https://github.com/hworldcom/movx-work-records/blob/b49f60b2454b3de9345c395acbc08f324bcdabb3/originals/tickets/archive/backend/DEV0271-apply-hosted-dev-calendar-migration.md); apply that forward file to the owned disposable database after `20261016000200` before running the current complete suite. This SQL rollout does not complete DEV0254's interface evidence. Future forward work requires its separately validated migrations and tests; the baseline rehearsal intentionally excludes post-cutoff migrations. Compare the two frozen rehearsal databases before applying any forward migration, since a later schema should differ from the original cutoff. Remove retained scratch databases explicitly afterward using `docker exec <local-container> dropdb -U supabase_admin <exact-owned-name>`.

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

### Scheduling time-zone validation performance

[DEV0396](https://github.com/hworldcom/movx-work-records/blob/b49f60b2454b3de9345c395acbc08f324bcdabb3/originals/tickets/archive/backend/DEV0396-avoid-repeated-timezone-catalog-scans.md) adds `20261020000200_fast_scheduling_timezone_validation.sql`. It avoids repeated catalog enumeration for exact `Europe/Berlin`/`UTC` names while retaining the current daylight-saving gap/overlap checks and catalog-backed validation for all other names. It changes one function body, with no row/table/API or cache-policy change.

Run `node scripts/rehearse-scheduling-timezone-database.mjs` with the existing local Docker stack and runtime login. It creates uniquely named fresh/upgrade scratch databases, compares 149 pre/post time results, checks row/function-contract preservation and runs scheduling/booking regressions, then removes only its scratch databases. It never migrates, resets or seeds the retained local/hosted database. Local validation does not apply the migration to UAT; use the existing explicit hosted migration procedure for a reviewed rollout. Rollback restores the preceding function body from the immutable baseline through a reviewed forward operation, preserving its identity/owner/privileges. JavaScript deployment alone does not apply it.

### Group-session banner migration

`20261018001000_group_session_banners.sql` adds independently revisioned optional event images and the private `event-banners` bucket. Existing sessions receive no copied image or changed terms. Apply it after the preceding forward migrations, using the existing local/hosted migration procedure; deploy consumers only after its functions and Storage policies exist. The local database has been advanced through this migration with unchanged prior-row fingerprints; hosted rollout remains separate. Do not reset or reseed an existing environment. See [DEV0356](https://github.com/hworldcom/movx-work-records/blob/b49f60b2454b3de9345c395acbc08f324bcdabb3/originals/tickets/archive/backend/DEV0356-persist-group-session-banners.md) for ownership/current-reference policies, exact local evidence and rollback considerations. `node scripts/rehearse-event-banners-database.mjs` validates fresh and upgrade disposable databases without resetting retained data.

## Local email Auth

Normal `npm run dev` already prepares the Auth-enabled services and restricted login. If you previously selected the database-only profile, switch to the Auth-enabled profile before rehearsing sign-in:

```sh
npm run db:stop
npm run auth:start
npm run auth:status
npm run db:runtime
```

Copy the printed public API URL and publishable key into the variables documented in `.env.example`. The command deliberately omits secret/service-role keys. Open `http://localhost:3100/register` for confirmed password signup, or use **Forgot password?** at `/sign-in` to set a password on an existing passwordless account. Email-code login has been removed. Read captured email in Mailpit at `http://127.0.0.1:55324`. Confirmation/reset links require the requesting browser; loading the link alone consumes nothing.

With the application running on port `3100`, `npm run test:auth` rehearses real registration/confirmation, returning login, passwordless-account setup without code login, removed-command/legacy-proof rejection, reset/change, current-device/global revocation and exact fixture cleanup against loopback Auth/Mailpit. It refuses hosted endpoints and creates only tagged temporary `.test` users. Evidence and the private exact-account recovery manifest are under ignored `tmp/email-auth-rehearsal/<run-id>/`. After an interrupted process, use `npm run test:auth -- --cleanup tmp/email-auth-rehearsal/<run-id>/recovery-ids.json`; it checks each exact subject/address before removal. Run it separately from other data-mutating rehearsals. `npm run test:coach-availability` rehearses recurring availability. Neither flow requires payment or external identity tooling.

## Password authentication rollout

Registration profile collection additionally requires [20261017001000](migrations/20261017001000_registration_profile_details.sql) before the matching application release. It adds a bounded enrollment overload and reuses the existing private account fields and canonical username unique constraint; it does not backfill or reset existing accounts. New confirmed accounts choose username, private full name and visible display name, including initial chat presentation. The three values and profile are saved atomically; taken usernames return HTTP 409 without partial enrollment. Apply after reviewing the target ledger and rollback rehearsal. Roll back only with compatible frontend/server request contracts; the old display-only POST is no longer accepted. The legacy two-argument SQL helper remains for trusted internal fixtures, with no new public/browser grant. Local installation/data-preservation evidence belongs to DEV0325; hosted rollout remains separate.

DEV0286's forward migrations `20261017000700`, `20261017000800` and `20261017000900` add application email-flow/session records credential-change fences and password-method evidence. They preserve Auth users, application profiles, coach decisions and private data. Apply them only after the target ledger and rollback-only SQL rehearsal have been reviewed. The local launcher applies pending migrations without resetting data. Existing browser sessions need a fresh login after the session-authority cutover. A provider token alone no longer grants application access; every application service must retain the shared verified-session guard.

Local settings/templates are in [config.toml](config.toml) and [templates](templates/). Restart local services with `npm run db:stop` then `npm run auth:start` to load changed Auth settings; retained volumes are preserved. Do not run `db:reset` for an Auth upgrade. No new app secret/environment variable is required; the existing restricted database login needs the new bounded functions. A provider-generated random hash does not imply the user configured a password: the application records actual registration/update/successful password-login evidence. The two small PostgreSQL-owned managed-schema helpers isolate Auth session/password-presence reads; the runtime never receives password hashes or direct Auth-table access.

Before hosted dev rollout, inventory `movx-dev`'s actual migration ledger, Auth settings/templates, SMTP delivery, paid capabilities and allowed origins. Preserve the prior nonsecret settings/template snapshots privately for rollback. Do not infer hosted configuration from local TOML. Apply the exact reviewed forward migrations and restricted-role grants; configure confirmation, password-change notification and the same fragment-based templates before enabling signup. Use exact `/auth/confirm` and future Google `/auth/callback` redirect URLs on the selected local/UAT origins, never a wildcard. Verify the minimum of 8 characters/no mixture, 3600-second email proof/JWT expiry, 60-second resend spacing, secure password change, global refresh revocation, 30-day session time box and breached-password protection against the [current specification](../docs/mvp-spec.md#412-password-email-verification-and-recovery). Managed breached-password protection and session capability require actual plan verification; local password/rate tests cannot establish them. Test actual hosted email delivery and two-device reset before calling the environment ready. Google credentials/provider proof remain DEV0287; production is a separate target and receives no local test accounts.

Recovery during rollout: stop new Auth entry/mutations while investigating, preserve the new verified-session guard and session registry, and leave additive migrations/data in place. Roll back the failing operation/UI to a compatible revision that retains recovery restrictions, or restore the recorded Auth configuration while entry is disabled. A rollback to pre-registry authorization can make still-issued recovery tokens ordinary sessions: it requires a maintenance window, revocation of affected managed/application sessions and expiry of issued tokens before reopening. Never drop session/credential-fence records or revert signup confirmation while the new flows are in use. Reverting application code does not restore a user's previous password; affected users recover through fresh verified email. No automatic hosted rollback, account reset, seed or deletion is part of this change.

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

## Message notification runtime

`20261023000100_message_notifications.sql` adds recipient history and an email outbox for new incoming text only. Apply it after all preceding active migrations using the reviewed existing-environment rollout procedure; never reset or reseed retained data. The trigger preserves original messages and read positions and does no backfill. Install the SQL before deploying its consumers. This branch does not apply it to retained local, UAT or production databases.

Ordinary application logins retain only `app_runtime`. Provision a **separate login** inheriting only the NOLOGIN `app_notification_worker` role; do not grant it `app_runtime`, `app_owner`, superuser, bypass-RLS, create-role or create-database authority. The migration grants the worker role to the existing PostgreSQL migration/operator role for administration, never to the ordinary application login. Worker functions are app_owner-owned with a fixed empty search path. The message and booking private postgres-owned email helpers each read only an existing job's verified, active, nonbanned/nondeleted Auth recipient; neither runtime nor worker can execute it directly or read Auth/outbox tables. Worker startup verifies login role attributes/membership and rejects owner/admin/app logins before claiming work.

Store `NOTIFICATION_DATABASE_URL` and the dedicated Resend **sending-only, movx.club-restricted** `RESEND_API_KEY` in server-only settings. Keep existing `DATABASE_URL` and Auth/Porkbun SMTP unchanged. Select `NOTIFICATION_TRANSPORT=resend`, the intended `NEXT_PUBLIC_SITE_URL`, a random `CRON_SECRET` of at least 32 characters, and enable only with `NOTIFICATION_DELIVERY_ENABLED=true`. Defaults fail closed. The checked-in minute schedule calls `/api/internal/notifications/dispatch`; cron must run on the explicitly selected Vercel Production deployment with the secret/config present, and does not run just because a Preview or local browser is open. The old `.vercel/project.json` association is not authority for a UAT target. No credentials, hosted login, deployment or external send is created by these code changes.

For safe local capture explicitly select `NOTIFICATION_TRANSPORT=mailpit` and `NOTIFICATION_MAILPIT_URL=http://127.0.0.1:55324`; only HTTP loopback origins are accepted. Mailpit v1.31.3's documented `/api/v1/send` API captures the message without changing/restarting retained SMTP containers or relaying to a recipient. With operator configuration already supplied in the process, run `npm run notifications:dispatch`. An ignored mode-0600 `.env.notifications.local` can be loaded explicitly with `node --env-file=.env.notifications.local --import tsx --conditions=react-server scripts/dispatch-notifications.ts`; never commit its populated values. Do not put any worker/provider key under NEXT_PUBLIC_.

`npm run test:notifications-db` requires this repository's running local Docker DB and Mailpit. It imports schema infrastructure only into uniquely named `mov79_<tag>_fresh/upgrade` scratch databases, replays active migrations, checks old-row preservation/no backfill, uses temporary `mov79_worker_<tag>` logins and runs SQL/messaging/real-worker capture assertions. It deletes only its returned Mailpit capture IDs, drops its scratch databases/logins and compares retained app/Auth-user/Storage row hashes. Do not run database rehearsals concurrently because migrations inspect/create shared NOLOGIN roles. `npm run test:notifications-ui` is a separate isolated Auth/API fixture, not live authorization proof.

`npm run test:notifications-integration` supplies combined real browser/Auth/SQL/local-capture proof. It requires the existing retained local stack for read-only before/after hashes, Docker, local Chrome, dependencies, free ports 55420–55429/3169 and time for a production build plus the actual five-minute unread delay. It copies config/migrations/seed/templates into a new private temporary directory, selects a unique `mov68-notification-qa-<tag>` project and separate ports, and starts that project's disposable volumes. Only that new stack is migrated/seeded; no retained login, account, data or config is changed. Runtime uses separate ordinary/worker logins and Mailpit only, with no Resend credential inherited. Finally stops that exact project with `--no-backup`, checks retained application/Auth-user/Storage hashes and removes its temporary source. Ignored test-results/notifications-integration/<tag>/recovery.json records only the owned project/path/ports for interruption recovery; never use `supabase stop --all` or remove unrelated volumes. Results/logs/screenshots contain no session/provider credentials. This is local acceptance, not a hosted rollout or an external delivery test.

The disposable project pins database/Auth/Storage version metadata to the retained containers' installed image versions for parity; it copies no CLI linked-project files. Dependency copies preserve relative launchers so build and application use the same Next installation. The default is the normal Turbopack production build; `npm run test:notifications-integration -- --webpack` explicitly selects the alternative production bundler without a silent fallback.

Disable `NOTIFICATION_DELIVERY_ENABLED` to stop dispatch while preserving queued/history data. Jobs due after five minutes are leased in bounded batches; a read before eligibility/handoff suppresses them. Claimed leases expire after two minutes and can be reclaimed; possible-handoff Sending expiry becomes Unknown. HTTP 429 rejection backs off with at most five claims; terminal rejection fails and ambiguous/network/5xx/malformed-success outcomes become Unknown. Inspect Unknown using operator-only tools and provider evidence; never bulk-reset those jobs to Queued or assume a stable Message-ID/idempotency key gives indefinite exactly-once delivery. Resend keys expire from its idempotency cache after 24 hours; this worker does not automatically resend Unknown. Provider acceptance is not inbox placement.

For rollback disable the worker first and revert application consumers/schedule if necessary. Preserve notification/outbox/message history and use a reviewed forward corrective migration for SQL behavior; never drop populated tables or rewrite read-through as recovery. Actual external From/Reply-To authentication/recipient delivery still needs an explicitly scoped recipient test after credentials and the reviewed target are installed.

## Private booking notification extension

`20261023000200_private_booking_notifications.sql` follows the message migration. It adds forced-RLS event and per-recipient receipt tables and captures only new canonical private request/booking/revision transitions. Both participants receive email; coach-only bell records exclude self actions. Source/dataset/account authority is rechecked before delivery; booking receipts remain eligible after bell/chat reads. Request acceptance emits the confirmed booking event once. Existing rows are not backfilled and scheduling state/locks do not change.

Install the SQL before deploying new consumers: clients opt into `notification_command_v2` with the version2 header; absent/1 retains message-only HTTP lists/reads, and the worker uses kind-fenced bounded mixed claims. Original message-only commands/tables remain compatible for the preceding deployment; old workers leave new booking jobs queued. No new credential or broader worker/Auth grants are needed. A rollback preserves event/receipt/history rows, disables dispatch and uses compatible consumers or a reviewed forward SQL correction; never delete populated queues or reset Unknown jobs. Environment edits on Vercel require a new deployment to take effect. Immediate scheduler stop uses the project's Cron Jobs control.

`npm run test:booking-notifications-db` requires local Docker PostgreSQL and loopback Mailpit55324. It copies infrastructure only into uniquely named `mov85_<tag>_fresh/upgrade` databases, seeds only those targets before new event capture, and creates temporary restricted logins. Upgrade preserves an existing request/status-card history with no booking backfill. Real canonical lifecycle/concurrency/permissions, typed changes, two-recipient Mailpit messages and retry/lease/Unknown tests run there, then exact capture IDs/databases/logins are removed and retained app/Auth/Storage hashes compared. Run database rehearsals sequentially. This command never installs SQL on retained local, UAT or production targets; hosted rollout is separately scoped.

## Hosted runtime login

Hosted environments use a dedicated generated login that inherits only `app_runtime`. Store its password in the deployment provider's encrypted server-only settings; do not put it in a migration or prefix it with `NEXT_PUBLIC_`.

Use the Supabase transaction pooler on port `6543`. The username must include the project-reference suffix required by the shared pooler. Verify the assembled URL without printing it:

```sh
node --env-file=.env.development.local scripts/verify-hosted-runtime-database.mjs --environment dev
```

The verifier requires an explicit `--environment dev|prod` plus `DATABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL`. It checks the selected project/runtime-role pair before connecting, then role attributes, `app_runtime` membership, absence of `app_owner` membership, direct-write restrictions, current booking-request/acceptance function access and browser-role isolation. It never loads the old staging file or reads a default Keychain credential. `npm run db:verify:hosted-runtime -- --environment dev` works when the required values are already exported into the process.

## Separate hosted environments

The user confirmed these independent Supabase projects on 16 October 2026; [public environment metadata](../config/supabase-environments.json) is shared by the startup, verifier and Vercel guards. Actual target setup and remaining evidence belong to [DEV0267 dev](https://github.com/hworldcom/movx-work-records/blob/b49f60b2454b3de9345c395acbc08f324bcdabb3/originals/tickets/archive/backend/DEV0267-connect-new-hosted-dev-environment.md) and [DEV0268 prod](https://linear.app/movx/issue/MOV-13/dev0268-prepare-the-isolated-production-environment).

| Use                    | Application origin                                  | Project reference                    | Dedicated runtime login   |
| ---------------------- | --------------------------------------------------- | ------------------------------------ | ------------------------- |
| Local app and UAT/test | `http://localhost:3100` and `https://uat.movx.club` | `mdzidiqosxbghmfyxphb` (`movx-dev`)  | `movx_dev_runtime_login`  |
| Production             | Planned `https://movx.club`                         | `yltijwebedkraypgkqmc` (`movx-prod`) | `movx_prod_runtime_login` |

Both projects are in Frankfurt (`eu-central-1`). They have separate Auth users, Storage and database state. Local and UAT intentionally share dev data; production receives no development demonstration seed or copied test accounts. New authentication providers and old-data transfer are separate work. Keep the old staging and retained Docker environments unchanged during new dev setup.

The local hosted mode reads the ignored `.env.development.local`; its [checked-in example](../.env.development.local.example) contains placeholders only. Use the provider's actual shared transaction-pooler host from the Connect dialog, with username `<runtime-login>.<project-reference>`, URL-encoded password and port `6543`, database `postgres`, without query options. Do not infer the pooler index from the region. The application uses TLS and disables prepared statements. Only the restricted runtime password belongs in this file; migration-owner and CLI credentials do not.

```sh
node --env-file=.env.development.local scripts/start-hosted-development.mjs --check
npm run dev
```

`dev:hosted` uses guarded hosted startup. It validates the dev target, a public `sb_publishable_` key and an exact `http://localhost:<unprivileged-port>` origin (normally `http://localhost:3100`) before launching Next.js. It starts/creates no Docker database and runs no migrations or broad seed. Existing demo accounts and content remain unchanged; demo setup is a separate manual create-only command. Missing or wrong hosted settings stop startup without a local fallback.

Ordinary `dev`, `dev:local` and the `dev:docker` alias use the isolated local stack. The local launcher overrides the four database/Auth/site settings in its child environment, including when the hosted settings file exists, and removes privileged operator variables. DEV0232 still owns the retired stack's old-history transition. Existing app processes must be restarted to adopt a different target. No existing hosted configuration or retained volume is changed by switching commands.

Set `MOVX_HOSTED_ENVIRONMENT=dev` for the **movx-club-uat** Vercel project's Production environment, along with the dev project's four application settings and `NEXT_PUBLIC_SITE_URL=https://uat.movx.club`. Vercel's Production label identifies the project's live domain; it does not make UAT a production database. The actual production application uses `MOVX_HOSTED_ENVIRONMENT=prod` with the separate prod project/runtime pair. The guard retains its old label-based mapping when the explicit setting is absent, rejects a prod database in Preview, and rejects mismatched targets for the known UAT/production origins. Persist configuration in the intended Vercel project/environment; variables supplied only to one CLI deployment do not configure later Git deployments. Confirm the project before linking or publishing: a local `.vercel/project.json` can still point to an older staging project.

Keep Vercel functions near these Frankfurt databases. [The deployment configuration](../vercel.json) pins `regions: ["fra1"]`; the UAT project's function default must also be Frankfurt so a deployment without the repository override cannot silently inherit Washington, D.C. After changing placement, build a new deployment and verify its actual function region through deployment metadata and live `x-vercel-id` response headers; the build-machine location or nearest CDN location alone does not prove function placement. Prepare independent changes in separate source copies and build with `vercel deploy --prod --skip-domain` before promoting the verified candidate. Recheck the current UAT alias before promotion to preserve any newer independent release. [DEV0395](https://github.com/hworldcom/movx-work-records/blob/b49f60b2454b3de9345c395acbc08f324bcdabb3/originals/tickets/archive/backend/DEV0395-pin-uat-functions-to-frankfurt.md) records the region repair and comparison; future deployments of another project must recheck its database location before changing this pin.

Each deployment's `NEXT_PUBLIC_SITE_URL` must be that application's exact HTTPS origin and match its Supabase Auth URL configuration. Hosted Vercel builds reject swapped projects, owner roles or mismatched runtime suffixes. Missing/partial core settings fail Production and explicitly hosted builds instead of publishing an unavailable application. Environment-free public-preview builds remain available for non-production builds. Public Auth values are embedded at build time, so changing projects requires a fresh build with the right values. Domain assignment and live publishing remain separate operator work.

New-project setup first inspects actual schema/history/Auth/Storage state and reviews a dry-run of the accepted baseline/forward files. It never runs the baseline over an existing application schema. UAT's exact origin and SMTP/provider configuration need actual verification; project existence and local configuration checks do not imply working email delivery or deployment. The current email-code sign-in contract remains unchanged.

Dev's baseline/effective-availability setup through `20261016000200`, complete fictional seed, private-image buckets and restricted login were verified under DEV0267. [DEV0271](https://github.com/hworldcom/movx-work-records/blob/b49f60b2454b3de9345c395acbc08f324bcdabb3/originals/tickets/archive/backend/DEV0271-apply-hosted-dev-calendar-migration.md) subsequently applied the unchanged owner-calendar migration `20261016000300` to this dev project after rollback-only SQL validation. Its exact three-version ledger, function body/owner/ACL and no-pending-migration state are verified; all 39 existing application-table fingerprints and Auth/Storage counts were preserved. Ignored mode-0600 `.env.development.local` contains the working local application connection. Dev Auth has site URL `https://test.movx.club` and exact redirects `http://localhost:3100/sign-in` and `https://test.movx.club/sign-in`, with six-digit, one-hour codes and a 60-second resend interval. Neither domain is deployed by this setup, and production remains unmodified.

The calendar SQL rollout passed eight permission assertions and 21 successful/negative runtime assertions before and after installation. Its reproducible [owner-operated validator](../scripts/sql/verify-coach-calendar-rollout.sql) creates only tagged transaction-local fixtures and ends with rollback. To verify the installed function deliberately, with an authorized Supabase CLI login and an explicit dev target:

```sh
./node_modules/.bin/supabase db query --linked --project-ref mdzidiqosxbghmfyxphb --file scripts/sql/verify-coach-calendar-rollout.sql --output json
```

This is an explicit operator test, never part of app startup. It requires owner/role-switch authority and the dev fixture catalogue, sends no email and leaves no fixture accounts/rows behind. The original supplied pgTAP assertions were additionally enforced in the rollout's rollback transaction; pgTAP was not left installed. [DEV0254](https://github.com/hworldcom/movx-work-records/blob/b49f60b2454b3de9345c395acbc08f324bcdabb3/originals/tickets/archive/frontend/DEV0254-add-private-and-group-coach-calendar.md) subsequently completed real Auth/browser and original-detail integration against this hosted target; that frontend proof is separate from the SQL assertions.

The explicit [hosted calendar browser rehearsal](../scripts/rehearse-hosted-coach-calendar.mjs) requires the existing dev app settings, an authorized Supabase CLI login and Chrome:

```sh
node --env-file=.env.development.local scripts/rehearse-hosted-coach-calendar.mjs
```

It creates only uniquely tagged temporary Auth/application fixtures, generates test OTPs without email delivery, and runs unchanged routes/services with the restricted application login in an owned temporary source copy. Its operator Auth key stays in process memory and is excluded from Next.js. It removes exact fixtures and verifies baseline non-temporary records while preserving concurrent peer fixtures. If interrupted, rerun the same command with `--cleanup` to use its ignored exact-ID manifest; a normal run refuses an existing manifest. It never runs on app startup and does not reset, seed, migrate or start Docker.

Dev uses the existing Porkbun SMTP service (`smtp.porkbun.com`, STARTTLS port 587, sender `MovX Club <hello@movx.club>`), a 10-email-per-hour project cap and the checked-in code-only body for both signup-confirmation and returning-user magic-link templates. Hosted email confirmation and other security defaults remain enabled. The ignored mode-0600 `.env.supabase-smtp.local` is an operator input only, never an application/Vercel setting. The user authorized one sign-in test: the email arrived, its code verified, and the actual local app recognized the session while correctly requiring profile onboarding. The test session was signed out and temporary code removed. This verifies one new-account email/session path; returning-user browser onboarding, real-user scheduling and deployed UAT remain separate evidence. DEV0267 records the commands, settings and limits.

The guarded Vercel build requires the complete database/Auth group whenever hosted runtime mode is enabled. Keep the Vercel function region close to the Supabase project and measure hosted connection behavior before changing the request-owned connection model in `src/server/db/client.ts`.

## Hosted changes and recovery

### UAT rollout on 19 October 2026

[UAT is live](https://uat.movx.club), replacing the formerly planned test hostname. [DEV0372](https://github.com/hworldcom/movx-work-records/blob/b49f60b2454b3de9345c395acbc08f324bcdabb3/originals/tickets/archive/organisatory/DEV0372-deploy-reviewed-release-to-uat.md) owns the dedicated Vercel `movx-club-uat` Preview deployment, exact-origin Auth configuration, DNS/TLS and final smoke evidence. Preview intentionally uses `movx-dev`; production and the historical staging app remain separate. Public Supabase/site values must be supplied at build time as well as runtime. Startup and deployment create no demonstration accounts.

Hosted dev now has all 24 committed migration versions through `20261019000100`. The twenty previously missing forward migrations passed an actual rollback-only rehearsal and an exact dry-run before applying, without seed/role/vault work. All previous fields of 64 original rows across 42 tables matched after rollout; two new private banner buckets were the only intended reference additions. Six retained fictional coach profiles remain hidden. The existing runtime verifier passed all 20 least-privilege checks.

Auth now uses the repository confirmation/recovery/password-notification templates, password minimum eight with no mixture requirement, secure password change and exact UAT/local confirmation/callback redirects. Existing SMTP credentials, confirmation requirement, email cap and disabled Google were preserved. Existing sessions need a fresh application login after the application-session cutover. The provider refused managed 30-day session time-box and breached-password protection with HTTP 402 because this project is on the Free plan; no paid upgrade was made. Full hosted email/reset/two-device and Google acceptance remains under DEV0286/DEV0289, separate from deployment smoke. Earlier configuration paragraphs above describe the historical setup rather than the current rollout.

### Established coach conversations (DEV0276)

The forward migration `20261017000100_normal_coach_conversations.sql` allows ordinary messages in an existing inquiry/request/booking conversation while the coach is enabled and the pair unblocked. It replaces one private permission function and preserves message/consent records, ownership and privileges. Install it before deploying the simplified composer; its legacy `canSendGeneral` response field now includes this conversation grant. The frozen baseline/history remains unchanged. Rollback requires a reviewed forward correction restoring the earlier function and compatible composer; do not delete or rewrite retained messages.

On 17 October 2026, the isolated local stack advanced from the exact three-version baseline/availability/calendar ledger to include this fourth version. The migration and its ledger entry were installed in one transaction after rollback-only permission tests passed. Fingerprints for all 39 application tables, Auth users and both Storage tables (42 total) and function owner/ACL/security/search-path metadata were identical before and after. Hosted dev/production remain unchanged and still require their separately reviewed rollout.

### Unlimited coach messages (DEV0278)

The subsequent `20261017000200_unlimited_coach_messages.sql` removes per-conversation, per-actor and new-counterpart quotas. It retains `app.mail_rate` as a private compatibility no-op; the original send entry points still enforce authentication, participant/dataset scope, message length, exact retries and blocking. DEV0276's normal-conversation migration remains required first. No message/history/consent data, function privileges, payloads or environment variables change. Legacy consent-request decisions are retained and do not gate ordinary established chat. Apply this forward migration before claiming unlimited messages on an environment. Rollback requires a reviewed forward correction restoring the quota helper; never delete retained messages. Local installation evidence is recorded in [DEV0278](https://github.com/hworldcom/movx-work-records/blob/b49f60b2454b3de9345c395acbc08f324bcdabb3/originals/tickets/archive/backend/DEV0278-allow-unlimited-coach-messages.md); hosted dev/production rollout remains separate.

On 17 October 2026, this fifth local ledger version and its exact SQL were installed atomically after the rollback-only messaging suite passed. Fingerprints for the same 42 data tables and the quota helper's owner/privileges/security/search path were unchanged. No reset or seed was performed; hosted environments were untouched.

### Retired message approvals (DEV0280)

`20261017000300_retire_message_requests.sql` follows those two messaging migrations. It replaces two private helpers: historical contact qualifies for normal chat under existing coach/block checks, and only actual incoming message entries drive unread. The compatible `canRequestGeneral` field is always false. Original consent audit rows and pending opening text remain; the app displays that text passively and rejects obsolete request/decision commands and requests filtering. Install this migration before publishing the approval-free interface/API. Private database compatibility routines remain; this is not a history-deletion migration.

The sixth local ledger version and its exact SQL were installed atomically on 17 October 2026 after rollback-only upgrade checks passed. All 42 app/Auth/Storage table fingerprints and both helpers' ownership, privileges, security mode and search path matched before/after. No reset or seed was used. Hosted rollout remains separate; rollback requires compatible app behavior and a reviewed forward helper correction without deleting contact history. See [DEV0280](https://github.com/hworldcom/movx-work-records/blob/b49f60b2454b3de9345c395acbc08f324bcdabb3/originals/tickets/archive/backend/DEV0280-retire-message-request-approvals.md).

### Private account settings

`20261017000500_private_account_settings.sql` follows `20261017000400_message_counterpart_media.sql` and is required before publishing the editable `/account` page. It adds the owner-only `app.account_personal_details` table and bounded current-account read/save functions. The optional birthdate/gender fields never join existing public, coach, message or booking projections. Personal name changes retain the identity, avatar, separate coach name and authority; compare-and-swap revisions protect edits and exact previous-revision retries recover the saved result. Runtime retains no direct profile/personal-details write privilege. No Auth, Storage, environment or dependency changes are needed.

The exact migration and its eighth local ledger entry were installed atomically on 17 October 2026 after 30 rollback-only database checks passed; all 42 existing app/Auth/Storage table fingerprints were unchanged. The 30 checks passed again against the installed schema. No reset, seed or hosted operation was performed. See [DEV0294](https://linear.app/movx/issue/MOV-43/dev0294-add-separate-account-settings) for account UI and validation evidence. Roll back the interface if needed and retain stored personal fields; any schema rollback needs a reviewed forward correction, not a destructive table drop.

### Account names and reserved usernames

`20261017000600_account_names_and_usernames.sql` follows the private-account migration. It adds owner-only legal name, preferred-name override and globally unique optional username, plus a computed chat first-name column on profiles. It changes current Account reads and adds section-specific writes; deploy it before the matching application. New writes cannot smuggle username into Personal details or private names into Login & security. The original presentation name, public coach name, opaque identity, booking snapshots and image/authority contracts are preserved. Existing rows are not backfilled as legal identities.

Current authorized chat/contact projections use the computed preferred first name, or the first word of the retained presentation name before a person saves settings. No full legal-name or reserved-username data enters those projections. Username authentication and profile URLs remain explicitly deferred under [DEV0296](https://linear.app/movx/issue/MOV-53/dev0296-define-username-login-and-profile-url-contract).

The ninth local migration and its exact SQL ledger entry were installed atomically on 17 October 2026 after rollback-only privacy/revision/message checks. Original columns across 43 app/Auth/Storage table fingerprints were unchanged; all four new columns were null after installation. Existing changed helpers retained ownership, privileges, security mode, volatility and search paths. Local concurrent username and personal-save checks passed with exact own-fixture cleanup. See [DEV0295](https://linear.app/movx/issue/MOV-44/dev0295-refine-account-names-and-section-navigation). No reset/seed/hosted operation. A rollback requires a compatible Account API/read shape or reviewed forward correction; do not drop private fields or rewrite installed history. The older four-argument name routine remains private compatibility code and is no longer exposed by the current Account command contract.

Review `npx supabase db push --linked --dry-run` before applying a hosted migration. Never run a linked reset against a project with user or booking data. Confirm a restorable provider backup before a risky forward migration, apply it in a bounded maintenance window, and rerun database/runtime verification afterward.

The scheduling-only migrations are additive: historical rows and tables remain, while new bookings leave the historical credit reference null. The coach-application migration retains historical activation/profile/booking data, marks known fictional coaches as demo records and moves prior user-created coach profiles to hidden pending state rather than silently verifying them. Rollback is application rollback plus a reviewed forward correction; do not delete historical provider or review data merely because the current runtime no longer reads it.

### Local-only demo coach defaults

Fictional test coaches are local-only under [the current identity/data contract](../docs/mvp-spec.md#8-identity-data-and-demo-integrity). UAT at uat.movx.club uses real coaches via ordinary registration/application/approval. Normal startup and hosted deployment never provision demo accounts. Manual `npm run demo:setup:local` and `demo:urls:local` accept only the exact loopback project and preserve existing credentials/content; all hosted provisioning/publication flags and hosted credential-journal writes fail closed. Old hosted command aliases refuse without loading environment files or contacting Supabase.

The complete local seed initializes only a new foundation dataset and preserves an existing one, including edits, removed content, retired participation and scheduling/history. Never seed/reset hosted UAT. The existing active/public dataset remains available for real users; fresh hosted dataset initialization is a separate reviewed operation. Local private credentials stay ignored mode 0600, and repeated existing-account setup does not rewrite them. Historical dev tester files are preserved privately, not active UAT login instructions. [DEV0335](https://github.com/hworldcom/movx-work-records/blob/b49f60b2454b3de9345c395acbc08f324bcdabb3/originals/tickets/archive/backend/DEV0335-provision-nonproduction-demo-coaches.md) and [DEV0337](https://github.com/hworldcom/movx-work-records/blob/b49f60b2454b3de9345c395acbc08f324bcdabb3/originals/tickets/archive/backend/DEV0337-preserve-existing-demo-coach-data.md) retain their historical evidence.

[DEV0349](https://github.com/hworldcom/movx-work-records/blob/b49f60b2454b3de9345c395acbc08f324bcdabb3/originals/tickets/archive/backend/DEV0349-restrict-fictional-coaches-to-local-development.md) supplies `npm run demo:retire:uat -- --check` and explicit `-- --apply` for the exact allowlisted dev project only. It validates the six original fictional identities, hides those coach profiles and revokes only their dataset participation; it preserves real profiles, the shared dataset, passwords/Auth/Storage and booking/message/group history. Whole-row fingerprints inside the same transaction guard every field except the specifically authorized visibility/participation/timestamps. Repeat runs and seed replay preserve retirement. No production target, automatic account deletion, password reset or schema rollout is part of this operation.

[DEV0336](https://github.com/hworldcom/movx-work-records/blob/b49f60b2454b3de9345c395acbc08f324bcdabb3/originals/tickets/archive/backend/DEV0336-add-fitness-and-sixth-demo-coach.md) adds the forward `20261018000500_fitness_discipline.sql` migration. It updates three discipline CHECK constraints and three existing validators while preserving their installed security attributes/owners/grants; it contains no demo/Auth data. Apply before the application accepts Fitness. The exact additive Jake fixture remains a marked block in `seed.sql` for fresh bootstrap and explicitly scoped fixture maintenance. Normal startup/manual account setup does not replay it on retained datasets. It requires the existing active foundation dataset and confirmed fictional Fabrik gym and never resets existing profiles/passwords. Rollback to the former category contract requires removing or reclassifying Fitness rows first; never silently discard them. No production rollout occurred.

Validate the Fitness schema and fresh/preserved seeding in disposable local databases with `node scripts/rehearse-fitness-database.mjs`. Historical baseline/website/rate/review rehearsals exclude only the marked Fitness fixture when replaying schemas that predate its migration. Normal setup uses the complete current seed and refuses provisioning until the Fitness migration exists.

### Confirmed public coach usernames (DEV0331)

Apply `20261018000600_public_coach_usernames.sql` after the preceding forward migrations and before the username-route application. It adds the private published-handle registry, a canonical-claim trigger, owner confirmation and public visibility-filtered lookup functions, plus a rollback-safe wrapper around the existing Account updater. There is no backfill or new environment variable: existing saved usernames remain private until explicit owner confirmation. The migration was applied only to the local development database on 18 October 2026; Account data fingerprints matched and the new registry was empty. Hosted rollout remains separate.

Run `npm run test:coach-public-urls-db` for fresh/preserved-data migration, legacy-slug, concurrency, privacy and regression checks in disposable databases. With the existing local app on port 3100, run `npm run test:coach-public-urls` for tagged temporary users, real desktop/mobile consent/rename/redirect/privacy checks and exact cleanup. The latter removes only its exact test reservations after owner deletion; ordinary deleted owners leave reserved tombstones.

For rollback, keep the additive schema, claim trigger and published reservations. Existing slug readers, enrollment and Account entry points remain available. Roll back presentation independently and retain the username route/resolver compatibility layer once any URLs have been confirmed; deploying a router from before DEV0331 would remove those new routes. Never drop or empty the registry to roll back, because doing so permits takeover of previously shared links. Restore from the normal database backup or ship a reviewed forward correction if the registry is damaged. This slice changes no Auth identities, booking/review/message/group keys, Storage data, credentials or backup settings. See [DEV0331](https://github.com/hworldcom/movx-work-records/blob/b49f60b2454b3de9345c395acbc08f324bcdabb3/originals/tickets/archive/backend/DEV0331-enable-username-based-public-coach-urls.md) for the exact contracts, evidence and consumer handoff.

### Registration enrollment backend checkpoint (DEV0325)

`20261017001000_registration_profile_details.sql` adds the atomic username/full-name/display-name enrollment overload used by the later Auth interface and DEV0331 claim tests. Apply it before either consumer. The existing two-argument entry point, Auth/profile IDs and existing account data remain compatible; no environment variable or provider credential is added. `tests/database/registration-profile.test.ts` proves exact retries, simultaneous claims and preservation against an isolated local database. Keep retained private fields when rolling back a consumer. The [DEV0325 implementation record](https://github.com/hworldcom/movx-work-records/blob/b49f60b2454b3de9345c395acbc08f324bcdabb3/originals/tickets/archive/backend/DEV0325-collect-registration-names-and-unique-username.md) distinguishes the backend commit from the separately pending Auth interface.
