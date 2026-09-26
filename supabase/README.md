# Local database operations

This directory owns MovX Club's checked-in Supabase PostgreSQL history. The SQL files under `migrations/` are the only applied migration source of truth; Drizzle mirrors them for typed server queries and must not create a second migration journal.

## Local workflow

Prerequisites are Node.js 24.21.x, the locked npm dependencies and a running Docker-compatible container runtime. MovX Club's database uses port `55322` so it can coexist with another project using Supabase's default `5432x` range. The DEV0015 `db:start` command remains a lean PostgreSQL-only workflow. The `auth:start` profile also starts Auth, its API gateway and a local captured mailbox while continuing to exclude unrelated services.

```sh
npm ci
npm run db:start
npm run db:reset
npm run db:runtime
npm run db:test
npm run test:db
npm run db:lint
```

`db:reset` is destructive only to this repository's disposable local database: it recreates the database from `migrations/` and then runs `seed.sql`. Run `npm run db:seed` again against the same local database to verify that fixture inserts remain idempotent. That script uses Postgres.js and a fixed loopback-only development URL because Supabase CLI 2.117.0 no longer applies general SQL through `supabase seed --local`; it cannot target a hosted database. Stop this repository's stack with `npm run db:stop`.

The local integration test uses Supabase's disposable `postgres` credential on `127.0.0.1:55322`; it is not an application credential. The catalogue-backed application routes use the separate restricted `DATABASE_URL` described below; browser code never receives that value or initializes a database client.

`npm run db:runtime` idempotently provisions the loopback-only `repx_runtime_login` used by the Next.js application and grants it only the non-bypass `app_runtime` group role. DEV0049 preserves this legacy infrastructure identifier so existing local credentials keep working after the MovX Club brand rename. Its fixed `postgres` password is acceptable only for this disposable database bound to the local Supabase port; hosted environments must use a generated secret and the environment-specific login described below. For local application enrollment, set `DATABASE_URL=postgresql://repx_runtime_login:postgres@127.0.0.1:55322/postgres`. Open email registration no longer uses a prepared-person or wallet roster.

## Local email Auth profile

Stop a running database-only profile before switching to the Auth profile, then inspect its public values:

```sh
npm run db:stop
npm run auth:start
npm run auth:status
npm run db:runtime
```

The status command prints only `API_URL` and the public `PUBLISHABLE_KEY` or legacy `ANON_KEY`; copy them into the corresponding public variables documented in `.env.example`. It deliberately omits `SECRET_KEY` and `SERVICE_ROLE_KEY`. Build or restart the app after changing its environment, then open exactly `http://localhost:3100/sign-in`. Enter an email, open Mailpit at `http://127.0.0.1:55324`, read the six-digit code and complete a display name on first login. The flow never needs a wallet connection or signature.

The local profile permits 30 captured messages per hour and applies Supabase's verification-attempt limits. It intentionally has no CAPTCHA on loopback. A hosted rollout must configure reviewed origins, the checked-in OTP template, abuse controls and a custom SMTP provider; Supabase's default sender is not a production delivery plan.

The normal `db:start` path still excludes Auth. `auth:start` retains the same database and migrations while adding only the services needed for email authentication and capture. Missing configuration or a stopped Auth service must never prevent public preview browsing. `npm run db:stop` stops either profile; `npm run db:reset` remains destructive to all disposable local database, Auth users and application profiles. The old local wallet-first account is intentionally not migrated because no hosted users exist.

With the Auth stack, runtime role and configured production app already running on port `3100`, run `npm run test:auth` to rehearse two new accounts, an invalid-code retry, isolated profile creation, sign-out and returning-account login. The script reads one-time codes from Mailpit but does not print or persist them.

## Roles and runtime connection

- The migration connection creates objects and transfers their ownership to `app_owner`.
- `app_owner` is `NOLOGIN` and owns the `app` schema objects.
- `app_runtime` is `NOLOGIN`, cannot bypass row-level security (RLS), and has only the data privileges that forced RLS permits.
- `anon`, `authenticated` and `service_role` have no `app` schema usage. The `app` schema is absent from the local Data API schema list.

## Read-only membership catalogue

DEV0067 created the initial `app.membership_products` identities and immutable `app.membership_product_versions`. DEV0078 preserves that migration history and adds the current platform-scoped monthly contract: published Basic at 80 EURC with ten included check-ins, published Classic at 150 EURC with daily-uncapped included access, four required core gyms, one included check-in per venue-local day and the 15-EURC eligible non-core visit amount. The obsolete single-gym fixture drafts are not part of the revised seed.

`app.participating_gyms` adds catalogue metadata over canonical venue identities; `app.membership_product_gym_eligibility` maps stable plan products to those venues. The deterministic seed contains seven fictional Berlin gyms, five Basic eligibility rows and seven Classic rows. These tables describe catalogue configuration only: they do not create a partnership claim, member selection, purchased entitlement, payment, reservation or check-in.

All four catalogue tables are owned by `app_owner` and force row-level security. DEV0079 gives only `app_runtime` narrow read policies over the active public demo run, active platform products, published plan versions, active participating gyms and active eligibility. The server joins those records to active participating venues and maps them into a public shape without internal UUIDs or lifecycle fields. `anon`, `authenticated` and `service_role` retain no direct `app` schema access, and `app_runtime` has no insert, update or delete privilege on catalogue tables. For the hackathon, catalogue changes remain migration/seed managed; operator mutation APIs and administration screens are deferred. Shared migration history is not squashed.

For local development, `npm run db:runtime` provisions the legacy `repx_runtime_login` described above. Hosted environments use a distinct login outside migrations so a password rotation never rewrites schema history.

## Hosted staging runtime login

The hosted staging project is `movx-club-staging` (`qaluvzwudsqrchdwxcsb`) in `eu-central-1`. Store its runtime password in macOS Keychain so local verification does not require a duplicate plaintext environment file.

Generate a 64-character hexadecimal password directly to the clipboard without printing it:

```bash
openssl rand -hex 32 | tr -d '\n' | pbcopy
```

Open **Keychain Access**, press **Command-N** to create a password item, and use these exact values:

- Keychain Item Name: `movx-club-staging-database`
- Account Name: `movx_staging_runtime_login`
- Password: paste the generated value

Save the item. To copy it later, open the item, select **Show password**, authenticate with the Mac login or Touch ID, and copy the value. Create the database login once in the Supabase SQL editor by replacing only the placeholder below. Run the query without saving it as a reusable dashboard query:

```sql
create role movx_staging_runtime_login
  login password '<generated-secret>'
  nosuperuser nocreatedb nocreaterole inherit noreplication nobypassrls;
grant app_runtime to movx_staging_runtime_login;
```

Do not put this SQL in a migration: the password is an environment secret, and rerunning `create role` should fail visibly rather than silently replace an existing credential. In the project's **Connect** dialog, select the shared **Transaction pooler** connection. Keep its exact host, database and port, replace the `postgres` username with `movx_staging_runtime_login`, and include the project-ref suffix required by the shared pooler. The resulting username is `movx_staging_runtime_login.qaluvzwudsqrchdwxcsb`, and the port must be `6543`.

Clear the clipboard after creating the login, then run the secret-safe verification. The command first loads an existing ignored `.env.staging.local` fallback; when that file is absent, macOS may ask whether Terminal or Node may access the Keychain item, in which case choose **Allow Once**:

```bash
printf '' | pbcopy
npm run db:verify:hosted-runtime
```

The verifier reads the URL from the ignored fallback file when present, or otherwise reads the password from Keychain and constructs the pooler URL only in process memory; it never prints either value. It confirms transaction-pooler use, TLS-compatible runtime settings, role attributes, `app_runtime` membership, absence of `app_owner` membership, selected direct-access restrictions and the browser-facing roles' lack of `app` schema usage.

For a non-macOS environment or when Keychain lookup is unavailable, `.env.staging.local` may contain the same two variables shown below. This file matches the repository's `.env.*` ignore rule and must have owner-only permissions:

```dotenv
DATABASE_URL=postgresql://movx_staging_runtime_login.qaluvzwudsqrchdwxcsb:<generated-secret>@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
EXPECTED_DATABASE_USER=movx_staging_runtime_login
```

Run `chmod 600 .env.staging.local` before verification. Never pass the populated URL directly in shell history.

After validation, put the assembled `DATABASE_URL` in the Cloudflare staging secret store during DEV0056; never prefix it with `NEXT_PUBLIC_` or commit the populated value. The application connection in `src/server/db/client.ts` already enforces one client connection per warm instance, TLS for non-local hosts and disabled prepared statements.

Rotate the login without changing its grants by running `alter role movx_staging_runtime_login password '<new-generated-secret>';`, updating the deployment secret, redeploying, and rerunning the verifier. Supavisor may cache the previous password briefly, so retry with a bounded delay before treating an immediate authentication failure as persistent. To retire this login, remove it from every deployment first, then run `revoke app_runtime from movx_staging_runtime_login;` and `drop role movx_staging_runtime_login;`.

## Hosted staging Auth and SMTP

Configure `movx-club-staging` through the Supabase Dashboard. These values intentionally mirror the checked-in local OTP contract while keeping the hosted origin exact:

| Dashboard area                                | Setting                                   | Staging value                                                                     |
| --------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------- |
| Authentication → URL Configuration            | Site URL                                  | `https://staging.movx.club`                                                       |
| Authentication → URL Configuration            | Redirect URLs                             | `https://staging.movx.club/sign-in` only                                          |
| Authentication → Sign In / Providers → Email  | Email provider and signup                 | Enabled                                                                           |
| Authentication → Sign In / Providers → Email  | Confirm email                             | Disabled; entering the emailed OTP is the verification step                       |
| Authentication → Sign In / Providers          | Anonymous sign-ins / manual linking       | Disabled                                                                          |
| Authentication → Email Templates → Magic Link | Subject                                   | `Your MovX Club sign-in code`                                                     |
| Authentication → Email Templates → Magic Link | Body                                      | Contents of `supabase/templates/email-otp.html`, including `{{ .Token }}`         |
| Authentication → Email settings               | OTP length / expiry / resend interval     | 6 digits / 3600 seconds / 60 seconds                                              |
| Authentication → SMTP Settings                | Sender name / address                     | `MovX Club` / `hello@movx.club`                                                   |
| Authentication → SMTP Settings                | Host / port / encryption                  | `smtp.porkbun.com` / `587` / STARTTLS                                             |
| Authentication → SMTP Settings                | Username                                  | `hello@movx.club`                                                                 |
| Authentication → SMTP Settings                | Password                                  | Porkbun mailbox password; never the Porkbun account password                      |
| Authentication → Rate Limits                  | Auth emails                               | 10 per hour for access-restricted staging                                         |
| Authentication → Rate Limits                  | Sign-ins/signups / verification / refresh | Keep the current 30 per 5 minutes / 30 per 5 minutes / 150 per 5 minutes defaults |

Keep CAPTCHA disabled until the browser flow supplies the selected provider's client token. After saving SMTP, send one Dashboard test email before attempting the two-account application rehearsal. Porkbun documents `smtp.porkbun.com:587` with STARTTLS and the full hosted email address as the username.

The hosted **Magic Link** template deliberately contains `{{ .Token }}` and no confirmation URL because the application presents a six-digit code field and verifies that code with Supabase. Paste the complete contents of `supabase/templates/email-otp.html` into that template and save it with the subject shown above. Supabase's Free plan may add provider attribution outside this content; removing that attribution is not a staging acceptance requirement.

## Hosted changes and recovery

The staging project is linked locally and has the repository's reviewed migration history. Disable the unused Data API integration (or at minimum keep `app` unexposed), and continue to apply hosted migrations only after reviewing `supabase db push --linked --dry-run`. Never run a linked reset against a project containing user, receipt or pending-operation data.

Do not rewrite an applied migration. Correct or roll forward the schema with a new migration, and document the compatibility and recovery steps in its owning feature ticket. The exact foundation decision and validation record remains in [DEV0015](../tickets/archive/backend/DEV0015-supabase-database-foundation.md).
