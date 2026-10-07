# Ticket DEV0055: Hosted Supabase staging environment

- Status: In progress
- Created: 2026-09-23
- Last updated: 2026-10-07
- Milestone: M0 hosted integration environment
- Coordination: None — independent development ticket
- Related records: [DEV0015 — Supabase database foundation](../../archive/backend/DEV0015-supabase-database-foundation.md), [DEV0040 — Protected access and database context](../../archive/backend/DEV0040-protected-access-and-database-context.md), [DEV0046 — Email OTP registration and application profiles](../../archive/backend/DEV0046-email-otp-registration-and-application-profiles.md), [DEV0047 — Personal wallet linking and replacement](DEV0047-personal-wallet-linking-and-replacement.md), [DEV0138 — Prepare Vercel deployment](../../archive/backend/DEV0138-prepare-vercel-deployment.md), and historical coordination under [COR0004 — Hosted staging deployment](../../archive/organisatory/COR0004-hosted-staging-deployment.md)

## Objective and context

Create a dedicated, non-production Supabase staging environment that can support the current MovX Club email-account, application-profile and protected-database flows from `https://staging.movx.club`. The current repository proves these boundaries locally, but no hosted project is linked, migrated or accepted.

This ticket applies the specification's [architecture boundary](../../../docs/mvp-spec.md#6-architecture-and-delivery-boundaries) and [identity, wallet and demo-integrity rules](../../../docs/mvp-spec.md#9-asset-wallet-and-demo-integrity) without treating a hosted service dashboard as a substitute for recorded migration and authorization evidence.

## Scope and non-goals

- In scope:
  - Select or confirm one EU-region Supabase project used only for staging.
  - Link the Supabase command-line interface (CLI) safely and dry-run/apply the checked-in migration history without resetting hosted data.
  - Seed the blank staging dataset only after confirming the seed is intended and idempotent.
  - Provision a generated-password login outside migrations and grant only the checked-in `app_runtime` role.
  - Use the Supabase transaction pooler with TLS, prepared statements disabled and the application's bounded pool.
  - Keep the `app` schema outside browser-facing data APIs and ensure no service-role or database secret reaches client code.
  - Configure email OTP site/redirect URLs, the checked-in token template, custom SMTP, bounded rate limits and a reviewed staging abuse boundary.
  - Record the public URL/publishable-key and private runtime/migration variable names and storage locations without recording their values.
  - Verify migration state, role restrictions, Auth email delivery and two distinct account/profile enrollments.
- Out of scope:
  - Application-host adaptation or deployment.
  - Domain Name System (DNS) provider changes and custom-domain binding.
  - Production Supabase, production users, production backups or production billing commitments.
  - Service-role use by the application, browser access to business tables, password login, social login or passkeys.
  - Fabricating club membership or granting organization roles through open signup.

## Expected behavior and edge cases

- A first email OTP login creates exactly one ordinary profile and active dataset participation; retrying enrollment returns the same identity without duplicates.
- A second email account remains isolated from the first account's profile and protected data.
- Browser clients receive only the project URL and publishable key. The runtime database password and any administrative/migration credential remain server-side and outside Git.
- The runtime login cannot own/create schemas, bypass row-level security or obtain migration privileges.
- Hosted migration uses dry-run/review before apply and never uses `supabase db reset` against the linked project.
- OTP messages use the MovX Club template and a selected custom SMTP sender. Supabase's demonstration sender is not accepted for the public staging hostname.
- Site and allowed redirect values match `https://staging.movx.club` and the exact sign-in path; unexpected redirects are rejected.
- Staging uses the adopted bounded Supabase Auth email/request limits as its low-volume abuse boundary. CAPTCHA remains disabled until the browser flow supplies the selected provider's client token.
- Reapplying migrations/seed/runtime-role provisioning is either idempotent or fails safely with a documented recovery path.

## Assumptions, decisions, and dependencies

- The user has or will create the Supabase project and provide access through local authenticated tooling; credentials are never pasted into this record.
- Adopt a separate staging project rather than reusing local or future production data.
- Use the transaction pooler on port 6543 for the hosted serverless runtime and an appropriate migration/session connection for schema work.
- The existing `.env.example` contract remains authoritative unless validation finds a necessary new variable.
- Custom SMTP may use Porkbun only if its current service terms and sending limits support transactional OTP delivery; otherwise select a transactional mail provider. Purchasing an address alone is not assumed to establish a suitable Auth sender.
- External references: [Supabase environment management](https://supabase.com/docs/guides/deployment/managing-environments), [database connections](https://supabase.com/docs/guides/database/connecting-to-postgres), [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp), and [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).

## Implementation plan

1. Confirm the staging project, EU region and non-production label; record project identifiers only where they are safe and operationally useful.
2. Link the CLI, compare local/remote migration state, run a dry run and apply reviewed migrations. Include the deterministic demonstration seed only for the confirmed blank staging dataset.
3. Provision the least-privilege runtime login with a user-controlled generated secret, grant `app_runtime`, and form the TLS transaction-pooler `DATABASE_URL` in the deployment secret manager. Keep creation manual in the Supabase SQL editor so neither the secret nor a privileged connection is embedded in a migration, repository command, or agent transcript; use the user's macOS Keychain as the local source of truth.
4. Add and run a secret-safe hosted-runtime verification command that reads the staging password from Keychain (with `DATABASE_URL` as a non-macOS/CI fallback) and checks transaction-pooler configuration, role attributes, membership and selected privilege boundaries without printing the connection URL or password.
5. Verify schema exposure and row-level-security boundaries with the runtime role.
6. Configure email signup, exact site/redirect URLs, token-based OTP template, custom SMTP and bounded rate limits.
7. Select and record the staging access/abuse boundary before public use. Do not enable CAPTCHA until the application supplies the required client token.
8. Exercise first/returning login, a second isolated account, profile enrollment and sign-out against staging, recording only redacted evidence.
9. Document migration, rollback/recovery and credential-rotation operations for later maintainers.
10. Reconcile the 2026-09-28 staging drift found during the first persistent-catalogue release: apply the reviewed idempotent fictional seed to the still-empty hosted dataset, change only the hosted email OTP length from eight to the six-digit application contract, and verify both states without pushing unrelated local configuration.

## Acceptance criteria

- [x] AC1: One dedicated EU staging project has the repository's complete reviewed migration history and intended idempotent demonstration seed, with no destructive remote reset.
- [x] AC2: A distinct generated-secret runtime login connects through the transaction pooler and has only the `app_runtime` capabilities required by the application.
- [ ] AC3: Browser-facing keys cannot access private `app` data directly, and no administrative/service-role/database secret is present in Git or a browser bundle.
- [x] AC4: Hosted Auth uses the exact staging origin/redirect contract, MovX Club OTP template and working custom SMTP rather than Supabase's demonstration sender.
- [ ] AC5: The adopted staging access/abuse boundary is implemented and documented before the custom hostname is considered publicly usable.
- [ ] AC6: Two real staging email accounts can enroll independently, return to the same profiles and sign out without cross-account data access.
- [ ] AC7: Migration state, runtime restrictions, Auth configuration, recovery/rotation steps and redacted validation evidence are durable in repository documentation and this ticket.

## Validation plan

- Run `supabase migration list --linked`, a reviewed `supabase db push --dry-run`, the non-destructive apply command, and a second migration/seed idempotency check where supported.
- Connect using the runtime pooler URL and run the repository database/authorization checks that do not mutate unrelated hosted state.
- Inspect grants, role attributes, exposed schemas and row-level-security enforcement with safe catalogue queries.
- Send and redeem real staging OTPs through custom SMTP for two test addresses; verify first enrollment, returning login, isolation and sign-out.
- Inspect the built browser assets or deployment configuration to ensure private credentials are absent.
- Record checks that cannot run before a Vercel application deployment as explicit handoff items rather than marking them passed.

## Implementation record

Implementation started by reviewing the checked-in hosted-environment contract, then linking the repository to the dedicated `movx-club-staging` project in Frankfurt. The complete checked-in migration history has now been applied without a remote reset, the restricted runtime login has passed the hosted transaction-pooler and privilege checks, and a real custom-SMTP email sign-in has succeeded with the reviewed MovX Club six-digit-code template. Two-account validation remains in progress.

### Changes and rationale

The Supabase CLI was authenticated with a locally stored access token and linked to project ref `qaluvzwudsqrchdwxcsb`. The project reported PostgreSQL 17 in `eu-central-1` with `ACTIVE_HEALTHY` status. The remote migration history was initially empty, the dry run listed exactly the seven checked-in migrations, and the non-destructive push applied those migrations in order. No separate seed or roles file was present, and a repository search found no hardcoded Anna/demo seed rows in the migrations.

On 2026-09-28, the repository's expanded history through `20260928000200_create_class_reservations.sql` was already applied, but a runtime-role query proved the hosted catalogue remained empty. A reviewed `--include-seed --dry-run` named only `supabase/seed.sql`; the apply populated one active demo run, two published plan records, seven fictional participating gyms and twelve plan-eligibility rows. A second include-seed push reported the remote database up to date, proving the hosted operation is repeatable without a reset.

The same rehearsal found an eight-digit code in a real hosted email. A read-only configuration diff confirmed hosted `auth.email.otp_length = 8` against the six-digit application contract. A minimal temporary config declared only `auth.email.otp_length = 6`; its preflight showed one update and nineteen remote-only properties. The push changed exactly that Auth property, sent no secrets, and the follow-up diff reported zero declared updates while preserving all nineteen hosted-only settings.

A hosted-runtime verifier and runbook now define the secret-safe provisioning and validation flow. It loads an ignored `.env.staging.local` file when present; otherwise, on macOS it reads the password from the `movx-club-staging-database` Keychain item and constructs the transaction-pooler URL only in memory. It requires port `6543`, connects with TLS, one client connection and prepared statements disabled, and checks the runtime login's attributes, group memberships and selected privilege boundaries without printing the URL or password.

### Affected files

| File or component                            | Change and purpose                                                                                                                                                                                                                                   |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase staging project                     | Linked `movx-club-staging` in `eu-central-1`, applied all seven checked-in migrations, provisioned the restricted `movx_staging_runtime_login`, and configured the hosted Auth/SMTP contract. Remaining security and two-account checks are pending. |
| `scripts/verify-hosted-runtime-database.mjs` | Adds a credential-redacting hosted connection and least-privilege verifier with direct macOS Keychain lookup.                                                                                                                                        |
| `package.json`                               | Adds `npm run db:verify:hosted-runtime`, loading the ignored staging environment fallback when it exists.                                                                                                                                            |
| `supabase/templates/email-otp.html`          | Provides the hosted-ready, code-only MovX Club email using email-safe inline styles and the existing paper, ink and lime palette.                                                                                                                    |
| `tests/supabase-auth-config.test.ts`         | Guards the single-token, no-magic-link template contract and MovX Club contact identity.                                                                                                                                                             |
| `supabase/README.md`                         | Records the staging project, Keychain and ignored-file secret flows, custom-login SQL, exact transaction-pooler username rule, Auth template application, validation, rotation and retirement steps.                                                 |
| `.env.example`                               | Unchanged: its existing `DATABASE_URL` contract already covers the hosted runtime URL.                                                                                                                                                               |
| Hosted demonstration dataset                 | Applied the current idempotent `supabase/seed.sql` after a linked dry run; no migration reset, real-business identity or fabricated membership ownership was introduced.                                                                             |
| Hosted Auth email OTP                        | Corrected only the email OTP length from eight to six digits so issued tokens match the frontend and checked-in template; unrelated hosted origins, SMTP, rate limits and service settings were left unchanged.                                      |

### Decisions and deviations

- 2026-09-23: Prepared this as a separate peer from Cloudflare runtime work because hosted database/Auth operations have independent credentials, rollback and security evidence.
- 2026-09-23: Proposed Cloudflare Access as the initial staging exposure control. It was temporarily adopted for all Worker traffic during the controlled domain rehearsal, then superseded by the public-staging decision recorded below.
- 2026-09-23: Implementation began with a secret-safe audit of the checked-in migrations, private `app` schema, public Auth variables and server-only transaction-pooler requirement before creating or linking any hosted project.
- 2026-09-23: Confirmed the new account sees only `movx-club-staging`; linked by project ref without putting the access token or database password in the repository.
- 2026-09-23: Treated the absence of a checked-in `supabase/seed.sql` and the absence of hardcoded demo-row inserts as intentional. No staging seed was fabricated.
- 2026-09-23: Applied migrations only after `supabase migration list --linked`, `supabase db push --linked --dry-run`, and a destructive-statement/demo-data review. The expected legacy `drop table app.membership_entitlements` ran as part of the ordered history on the blank project.
- 2026-09-23: Kept hosted login creation outside migrations and adopted `movx_staging_runtime_login` as the environment-specific login. Its password is user-generated and stored in macOS Keychain; the repository contains only a verifier and placeholder instructions. Direct Keychain lookup superseded the initial ignored-env-file-only verification proposal so the local secret does not need a duplicate plaintext file.
- 2026-09-23: Adopted the checked-in email-OTP contract for hosted staging: site URL `https://staging.movx.club`, exact allowed redirect `https://staging.movx.club/sign-in`, email signup enabled, anonymous/manual-linking disabled, no separate confirmation step, six-digit tokens, one-hour expiry and a 60-second same-address resend interval.
- 2026-09-23: Selected the existing Porkbun-hosted `hello@movx.club` mailbox for low-volume staging SMTP using `smtp.porkbun.com`, port `587` and STARTTLS. Its mailbox password is an external secret and is never recorded in the repository. Use sender name `MovX Club`, retain the current default IP-based sign-in/verification limits, and cap project-wide Auth emails at 10 per hour.
- 2026-09-23: The initial hosted email requests timed out because the SMTP port had been entered as `570`. Correcting it to Porkbun's STARTTLS port `587` made the next request complete successfully and deliver a working sign-in email.
- 2026-09-23: Kept the hosted email code-only rather than retaining Supabase's default magic link because the application verifies a six-digit token. The template uses email-safe inline styles and text branding rather than a remotely hosted logo. Supabase Free-plan attribution outside the custom content is acceptable and is not treated as a failed staging requirement.
- 2026-09-23: With user approval, assigned the remaining browser-bundle, access-boundary and two-account rehearsal to the integrated staging deployment in DEV0056. DEV0055 remains responsible for recording and accepting that evidence; it no longer blocks the controlled `workers.dev` deployment needed to produce it.
- 2026-09-24: The user chose a public stable staging site rather than a second Cloudflare login. Worker-level Access now protects previews only; `staging.movx.club` is public. The 10-email-per-hour project cap, 60-second same-address resend interval and default IP-based Auth limits are the adopted low-volume staging abuse boundary. CAPTCHA remains a later hardening option if traffic or abuse warrants it.
- 2026-09-28: The first catalogue deployment exposed two hosted-state gaps. All sixteen migrations are present, but runtime-safe counts showed zero demo runs, products, versions, participating gyms and eligibility rows because the seed introduced after the original environment setup had never been applied. A read-only `supabase config diff` also proved hosted `auth.email.otp_length` is eight while the application, local Auth configuration and checked-in email template require six. The user authorized the fix. Apply only the reviewed idempotent seed and a narrow OTP-length update; do not use a full `supabase config push`, because the diff contains intentional staging/local differences for origins, SMTP, rate limits and other services.
- 2026-10-07: The user retired the Cloudflare deployment path under DEV0139. This ticket keeps the hosted Supabase database/Auth work as an independent provider-neutral environment and moves its remaining browser evidence to the native Next.js/Vercel deployment path from DEV0138. Historical Worker/Access observations below remain evidence of what was previously verified, not a current dependency.

### Contracts, configuration, and operations

The environment continues to use the existing variable names and schema contracts. The Supabase access token remains in the CLI's local credential storage; no token or database password was added to the repository. Project ref `qaluvzwudsqrchdwxcsb`, the pooler hostname, Keychain item name and expected custom role name are non-secret operational identifiers. Hosted validation used `.env.staging.local`, confirmed ignored by `.gitignore` and restricted to mode `600`; its contents were not printed or inspected. The populated `DATABASE_URL` belongs in the encrypted server-only settings for the matching Vercel environment.

## Validation results

- 2026-09-28 `npx supabase db push --linked --include-seed --dry-run` listed only `supabase/seed.sql`; the apply passed without a reset, and the immediate repeat returned `Remote database is up to date`.
- 2026-09-28 restricted runtime counts passed with one visible demo run, two products, two versions, seven participating gyms and twelve eligibility rows. Class sessions remain hidden without actor context by design.
- 2026-09-28 a minimal-config `supabase config diff` showed exactly one declared update (`auth.email.otp_length`, remote eight/local six). The narrow push updated only that property; the follow-up diff showed zero declared updates and retained nineteen remote-only properties.

| Criterion | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Result                                          |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| AC1       | Initial setup applied seven migrations without reset. On 2026-09-28 the local/remote journals matched all sixteen versions through `20260928000200`; an include-seed dry run listed only the current idempotent seed, the apply populated the fictional dataset, and the immediate repeat reported the remote database up to date.                                                                                                                                                                                             | Passed for current migrations and intended seed |
| AC2       | The user created `movx_staging_runtime_login` with a generated secret. `npm run db:verify:hosted-runtime` loaded the ignored fallback, connected through the port-6543 transaction pooler and passed all role checks: login plus `app_runtime` inheritance, no superuser/database-create/role-create/replication/RLS-bypass/schema-create/`app_owner` capability, the intended bounded functions, and no direct wallet-binding access.                                                                                         | Passed                                          |
| AC3       | The hosted verifier confirmed that `anon`, `authenticated` and `service_role` lack `app` schema usage. Data API settings and the later browser bundle still require inspection.                                                                                                                                                                                                                                                                                                                                                | Partial                                         |
| AC4       | A read-only request to `/auth/v1/settings` returned `200` with the email provider enabled, signup allowed and mailer autoconfirm enabled. The first requests timed out while the SMTP port was incorrectly set to `570`; correction to `587` restored delivery. After applying the reviewed Magic Link/OTP template, a fresh `signInWithOtp` request completed in 2.8 seconds. The user confirmed the received message had the correct MovX Club sender, subject, styled design and six-digit code rather than a sign-in link. | Passed                                          |
| AC5       | DEV0056 first verified Worker-level Access, then narrowed it to temporary previews after the user selected public staging. The stable origin returned `200` without a Cloudflare redirect. The hosted Auth configuration retains a 10-email-per-hour project cap, 60-second same-address resend interval and default IP-based sign-in/verification limits.                                                                                                                                                                     | Passed                                          |
| AC6       | Two-account hosted rehearsal not yet run.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Not run                                         |
| AC7       | `npx supabase db lint --linked` connected to the hosted project, linted `app`, `extensions` and `public`, and reported `No schema errors found`. A final `npm run db:verify:hosted-runtime` passed all 20 configuration and permission checks; `npm test` passed 49 tests, and `git diff --check`, `npm run lint` and `npm run format:check` also passed. The runbook now covers connection verification and credential rotation/retirement; final Auth and recovery evidence remain pending.                                  | Partial                                         |

## Risks, limitations, and follow-ups

- SMTP sending limits, sender verification and DNS propagation can delay Auth validation.
- Supabase's free project availability/backups are insufficient evidence for production readiness.
- Hosted tests create real non-production Auth/profile rows and require a documented cleanup policy that does not use remote reset.
- Next action: deploy the reviewed native Next.js revision through Vercel, inspect its browser bundle for secrets and complete the two-account enrollment, returning-login, isolation and sign-out rehearsal on the exact stable origin.

## Completion and review references

- Completed: Not completed.
- Commit: `6f42206` records the initial hosted staging foundation; the hosted template update is committed separately under DEV0055.
- Review: No pull request or independent review exists.
- Deployment or release: Database migrations are present on Supabase staging, but the environment is not yet accepted; DEV0125 owns the integrated Vercel release evidence after this ticket completes.
