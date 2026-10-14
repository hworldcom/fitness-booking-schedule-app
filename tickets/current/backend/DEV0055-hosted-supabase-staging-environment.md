# Ticket DEV0055: Hosted Supabase staging environment

- Status: In progress
- Created: 2026-09-23
- Last updated: 2026-10-14
- Milestone: M4 — Hosted rehearsal
- Coordination: None — independent development ticket
- Related records: completed foundations [DEV0015](../../archive/backend/DEV0015-supabase-database-foundation.md), [DEV0040](../../archive/backend/DEV0040-protected-access-and-database-context.md) and [DEV0046](../../archive/backend/DEV0046-email-otp-registration-and-application-profiles.md); Vercel build preparation [DEV0138](../../archive/backend/DEV0138-prepare-vercel-deployment.md); current scheduling baseline [COR0016](../../archive/organisatory/COR0016-coach-confirmed-booking-requests.md); documentation refresh [DEV0224](../../archive/organisatory/DEV0224-refresh-scheduling-ticket-backlog.md); separate historical pruning [DEV0225](../../archive/organisatory/DEV0225-remove-blockchain-historical-evidence.md)

## Objective and context

Finish accepting the non-production Supabase staging database/Auth environment for the native Next.js application hosted through Vercel. Earlier work provisioned a dedicated Frankfurt project, restricted runtime login and working email-code sender; it did not complete the current hosted identity/scheduling rehearsal. Dated provisioning results below describe the revision tested at that time and do not prove current migration, grant, browser-bundle or scheduling state.

Apply the specification's [application and infrastructure boundaries](../../../docs/mvp-spec.md#6-application-and-infrastructure-boundaries), [identity/data integrity](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity), [security invariants](../../../docs/mvp-spec.md#10-security-and-failure-invariants) and [M4 hosted rehearsal](../../../docs/mvp-spec.md#12-delivery-milestones). DEV0138 delivered build preparation; DEV0055 retains ownership of hosted environment evidence. Cancelled marketplace-release tickets do not own this handoff.

## Scope and non-goals

- In scope:
  - Compare the current reviewed migration/seed revision with hosted state, apply only reviewed non-destructive changes where needed and record exact versions and replay/idempotency evidence.
  - Verify the restricted application login, transaction-pooler/TLS configuration, schema exposure, current grants and actor-scoped authorization without revealing secrets.
  - Verify code-only email Auth, custom sender, exact stable Vercel origin/redirects and the adopted bounded email/request limits.
  - Validate the four hosted application settings defined in README, with no private value in Git, browser assets or evidence.
  - Complete two-account first/returning-login/isolation/sign-out checks and the current two-athlete/coach scheduling rehearsal on one stable origin.
  - Record current runbook, recovery/rotation steps, tested revision, prerequisites and cleanup for disposable accounts.
- Out of scope:
  - Framework-host adaptation, domain purchase/binding, production billing/backups or general administration.
  - Runtime feature changes, native app implementation, new notification delivery, public signup roles or historical-document deletion.
  - Remote database resets, destructive seed replacement or use of the database owner as the application login.

## Expected behavior and edge cases

- Verified email identity creates or recovers the same ordinary application profile; first/returning sign-in and sign-out do not leak another account's data or grant coach authority.
- Runtime database access uses the dedicated `app_runtime` login through the port-6543 transaction pooler with TLS and prepared statements disabled; browser roles cannot read private `app` data directly.
- `DATABASE_URL` is server-only. Browser configuration contains only public Supabase URL/publishable values and the exact approved site origin; deployment/bundle evidence never prints secrets.
- `https://staging.movx.club` remains the historically adopted stable origin. Confirm its actual Vercel assignment and matching Auth redirect entries before rehearsal; no current assignment is assumed by this refresh.
- The code-only Auth template, SMTP sender and adopted resend/project/IP limits are checked for the current environment. Historical Cloudflare/Workers access proof does not establish the current Vercel exposure boundary.
- The scheduling rehearsal proves guest discovery, two independent athlete requests, one coach acceptance, neutral non-selection, cancellation/new-request recovery and coach availability/completion with stored actual venues and no manual database repair.
- Empty/unavailable/provider/conflict outcomes stay truthful. Hosted disposable-account cleanup targets exact test records and never resets unrelated data.

## Assumptions, decisions, and dependencies

- The initial staging project and least-privilege login were provisioned; the current accepted state still requires fresh evidence. Do not describe the project as absent or a dated migration journal as current.
- Native Next.js/Vercel is the current hosting path. DEV0138 is the build/configuration baseline, while retired Workers evidence is historical context only.
- Read [README deployment guidance](../../../README.md#vercel-deployment) and [the database runbook](../../../supabase/README.md) before live operations. The documentation refresh itself performs none.
- Existing `.env.example` names remain the setup contract; secrets stay in approved ignored/operator or encrypted host settings and never enter tickets.
- Use ordinary athlete accounts and approved/demo coach capability according to the specification; an athlete cannot self-approve as coach.
- Earlier supplied access remains subject to the current operator environment; missing credentials/origin assignment is a specific handoff dependency to record when rehearsal starts.

## Implementation plan

1. Record the exact application commit, stable origin, reviewed local migration versions and intended seed; compare remote state safely before any apply.
2. Apply only reviewed pending migrations/seed or narrow Auth corrections when needed; retain dated preflight, repeatability and recovery evidence without resetting hosted data.
3. Run `npm run db:verify:hosted-runtime`, current exposed-schema/grant checks and safe actor-scope probes without printing connection values.
4. Confirm the exact Vercel settings and matching Auth origin/redirect/code-template/sender/rate-limit contract; inspect current browser assets for private configuration.
5. Rehearse two real test-email accounts through enrollment, returning login, isolation and sign-out; then use two athletes and one authorized coach for the specification's scheduling flow.
6. Record current results by criterion, clean only exact disposable fixtures and finish the runbook/recovery evidence. Keep the ticket open until current acceptance, not just historical provisioning, passes.

## Acceptance criteria

- [x] AC1: Initial dedicated EU staging provisioning, reviewed migration baseline and intended idempotent seed were recorded without a destructive remote reset. This historical baseline requires current-revision verification under AC8.
- [x] AC2: A distinct generated-secret runtime login was provisioned and passed its recorded least-privilege pooler checks. Current grants/configuration are rechecked under AC8.
- [ ] AC3: Browser-facing keys cannot access private `app` data directly, and the current Git/browser build contains no administrative/service-role/database secret.
- [x] AC4: The recorded initial hosted Auth setup established matching origin/code template and working custom SMTP. Current Auth/account behavior is rechecked under AC6/AC8.
- [ ] AC5: The current stable Vercel origin and adopted exposure/abuse boundary are verified and documented; historical Worker access proof is insufficient.
- [ ] AC6: Two real staging email accounts enroll independently, return to the same profiles and sign out without cross-account data access on the current origin.
- [ ] AC7: Current migration/grant/Auth state, tested revision, recovery/rotation and exact disposable-account cleanup evidence are durable in the runbook and ticket.
- [ ] AC8: The current reviewed Vercel/Supabase revision passes migration/seed/grant/Auth checks and the specification's two-athlete/coach request, selection, cancellation/retry, availability and completion rehearsal without manual database repair.

## Validation plan

- Use `supabase migration list --linked`, a reviewed `supabase db push --dry-run` and non-destructive apply only if required; check repeatability against the exact intended current migration/seed revision.
- Run `npm run db:verify:hosted-runtime`, safe current grant/exposed-schema queries and actor-isolation probes through the restricted login; redact evidence.
- Rehearse code-only email delivery, first/returning identity, account separation/sign-out and the [current target demo](../../../docs/mvp-spec.md#14-demo) on the stable Vercel origin.
- Inspect current browser build/configuration for private values; record code revision, operator prerequisites, expected-state mutations, exact fixture cleanup and failures/not-run checks.
- Separate dated historical evidence below from current acceptance. No hosted check was run merely by refreshing this ticket.

## Implementation record

The foundation results in this section were recorded in September 2026 and the hosting handoff changed on 2026-10-07. Their migration counts, provider observations and test totals describe those dated revisions. The 2026-10-14 DEV0224 refresh changes current requirements only; it performs no fresh hosted operation and leaves AC3/AC5–AC8 unfinished.

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

- 2026-10-14: DEV0224 refreshed this active record to the current M4 Vercel/Supabase identity and coach-confirmed scheduling target, corrected specification links, separated initial provisioning from current acceptance and removed cancelled marketplace release ownership from the current handoff. Historical evidence is preserved for separate DEV0225 pruning; no hosted state was read or changed.

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

The entries and table below are historical foundation evidence. AC1/AC2/AC4 remain proven as initial setup only; AC5's earlier Worker result does not satisfy the current Vercel criterion. Current AC8 has not run. Documentation checks for the 2026-10-14 refresh are recorded in DEV0224, not reported as hosted acceptance.

- 2026-09-28 `npx supabase db push --linked --include-seed --dry-run` listed only `supabase/seed.sql`; the apply passed without a reset, and the immediate repeat returned `Remote database is up to date`.
- 2026-09-28 restricted runtime counts passed with one visible demo run, two products, two versions, seven participating gyms and twelve eligibility rows. Class sessions remain hidden without actor context by design.
- 2026-09-28 a minimal-config `supabase config diff` showed exactly one declared update (`auth.email.otp_length`, remote eight/local six). The narrow push updated only that property; the follow-up diff showed zero declared updates and retained nineteen remote-only properties.

| Criterion | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Result                                               |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| AC1       | Initial setup applied seven migrations without reset. On 2026-09-28 the local/remote journals matched all sixteen versions through `20260928000200`; an include-seed dry run listed only the current idempotent seed, the apply populated the fictional dataset, and the immediate repeat reported the remote database up to date.                                                                                                                                                                                             | Passed historical baseline; AC8 pending              |
| AC2       | The user created `movx_staging_runtime_login` with a generated secret. `npm run db:verify:hosted-runtime` loaded the ignored fallback, connected through the port-6543 transaction pooler and passed all role checks: login plus `app_runtime` inheritance, no superuser/database-create/role-create/replication/RLS-bypass/schema-create/`app_owner` capability, the intended bounded functions.                                                                                                                              | Passed historical setup; current checks pending      |
| AC3       | The hosted verifier confirmed that `anon`, `authenticated` and `service_role` lack `app` schema usage. Data API settings and the later browser bundle still require inspection.                                                                                                                                                                                                                                                                                                                                                | Partial                                              |
| AC4       | A read-only request to `/auth/v1/settings` returned `200` with the email provider enabled, signup allowed and mailer autoconfirm enabled. The first requests timed out while the SMTP port was incorrectly set to `570`; correction to `587` restored delivery. After applying the reviewed Magic Link/OTP template, a fresh `signInWithOtp` request completed in 2.8 seconds. The user confirmed the received message had the correct MovX Club sender, subject, styled design and six-digit code rather than a sign-in link. | Passed historical setup; current checks pending      |
| AC5       | DEV0056 first verified Worker-level Access, then narrowed it to temporary previews after the user selected public staging. The stable origin returned `200` without a Cloudflare redirect. The hosted Auth configuration retains a 10-email-per-hour project cap, 60-second same-address resend interval and default IP-based sign-in/verification limits.                                                                                                                                                                     | Historical Worker pass; current Vercel check not run |
| AC6       | Two-account hosted rehearsal not yet run.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Not run                                              |
| AC7       | `npx supabase db lint --linked` connected to the hosted project, linted `app`, `extensions` and `public`, and reported `No schema errors found`. A final `npm run db:verify:hosted-runtime` passed all 20 configuration and permission checks; `npm test` passed 49 tests, and `git diff --check`, `npm run lint` and `npm run format:check` also passed. The runbook now covers connection verification and credential rotation/retirement; final Auth and recovery evidence remain pending.                                  | Partial                                              |
| AC8       | No current-revision hosted migration/grant/Auth and full coach-confirmed scheduling rehearsal recorded.                                                                                                                                                                                                                                                                                                                                                                                                                        | Not run                                              |

## Risks, limitations, and follow-ups

- SMTP sending limits, sender verification and DNS propagation can delay Auth validation.
- Supabase's free project availability/backups are insufficient evidence for production readiness.
- Hosted tests create real non-production Auth/profile rows and require a documented cleanup policy that does not use remote reset.
- Next action: compare current reviewed migration/seed state with hosted state, prepare the exact stable Vercel revision/origin, verify current grants/Auth/browser configuration and run AC6/AC8 with isolated test accounts. Record actual access/deployment blockers when encountered; historical provisioning does not establish present acceptance.

## Completion and review references

- Completed: Not completed.
- Commit: `6f42206` records the initial hosted staging foundation; the hosted template update is committed separately under DEV0055.
- Review: No pull request or independent review exists.
- Deployment or release: The historically provisioned Supabase staging environment is not accepted for the current revision. DEV0055 owns the remaining current environment/rehearsal evidence after the Vercel path is available; DEV0138 records build preparation, not a hosted release. This documentation refresh performed no deployment.

Documentary correction — 2026-10-14, [DEV0225](../../archive/organisatory/DEV0225-remove-blockchain-historical-evidence.md): removed the superseded identity-table privilege subclaim from the historical AC2 setup row. The remaining recorded runtime-role checks and every current hosted scheduling acceptance requirement remain unchanged; no hosted connection or runtime verification was performed by this pruning.
