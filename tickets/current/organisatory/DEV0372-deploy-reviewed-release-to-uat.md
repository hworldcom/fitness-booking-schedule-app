# Ticket DEV0372: Deploy reviewed release to UAT

- Status: Blocked
- Created: 2026-10-19
- Last updated: 2026-10-19
- Milestone: Hosted user acceptance testing (UAT)
- Coordination: None — independent development ticket
- Related records: Audit dependency [DEV0367](../../archive/organisatory/DEV0367-audit-athlete-coach-responsive-journeys.md); existing environment boundary [COR0026](COR0026-separate-hosted-dev-and-production.md); authentication readiness follow-up [DEV0286](../backend/DEV0286-implement-password-authentication-and-recovery.md). This operation does not complete those records or the open QA findings.

## Objective and context

The user explicitly requested committing the reviewed QA work and deploying the application to `https://uat.movx.club` on 19 October 2026. The QA checkpoint is `c65b850` (`[DEV0367] Record athlete and coach responsive QA`). UAT means the hosted nonproduction application used for user acceptance testing. The requested origin replaces the formerly planned `test.movx.club`; production remains separate. Follow [infrastructure boundaries](../../../docs/mvp-spec.md#6-application-and-infrastructure-boundaries), [data integrity](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity) and [definition of done](../../../docs/mvp-spec.md#11-definition-of-done).

Read-only preflight found the existing Vercel `movx-club-staging` project serving `staging.movx.club`, with historical production-scoped settings. No UAT alias exists, and UAT DNS currently resolves to Porkbun parking rather than Vercel. The designated hosted-dev Supabase project is `mdzidiqosxbghmfyxphb`; production is `yltijwebedkraypgkqmc` and is excluded.

## Scope and non-goals

Create a dedicated Vercel UAT project/preview deployment from an exact committed source snapshot, configure its restricted hosted-dev runtime and exact origin, reconcile required forward migrations and Auth redirect/template settings, assign UAT DNS/TLS/domain and perform deployed smoke checks. Record exact operations, preservation evidence and rollback references. Update current environment guidance/specification to the user-confirmed UAT origin.

Exclude product feature repairs, enabling unfinished Google integration, demo provisioning, retained-account/content/credential edits, database resets/seeds, production/staging changes, unrelated existing workspace edits and a full replacement for hosted authentication acceptance.

## Expected behavior and edge cases

UAT serves the committed Next.js application at the exact HTTPS origin with hosted-dev public/Auth/database settings at build and runtime. Private routes require authentication; guest private times stay protected. Pending schema dependencies must be reviewed before publication. No local secrets, operator tokens or service-role key enter Git or application settings. Existing accounts, history and media survive additive rollout. Preserve local and old staging processes/configuration. DNS or provider access failures leave a concrete deployment and accurate handoff, not a false completion claim.

## Assumptions, decisions, and dependencies

- User authorization covers the commit, UAT provisioning/configuration and deployment; no additional permission gate is introduced.
- Adopt a dedicated `movx-club-uat` Vercel project with Preview/UAT settings because the existing build guard maps Preview to hosted dev and Production to the isolated production database. Assign only the requested UAT custom domain; preserve existing staging.
- Use the existing hosted-dev restricted login through private operator files. Migration/admin access remains operator-only.
- Inspect the actual hosted ledger/settings and exact forward SQL first. Apply only compatible reviewed missing migrations with preservation evidence; do not infer initialization from missing markers.
- Outstanding DEV0368–DEV0371 findings are acknowledged by the request following the audit; UAT publication is not an all-green release sign-off.

## Implementation plan

1. Commit only DEV0367-owned changes, preserving unrelated pre-existing specification/browser/index edits (completed as `c65b850`).
2. Inspect hosted-dev ledger, runtime grants, Auth origins/templates/provider settings and retained row fingerprints. Review required migration effects and record any material plan change before writes.
3. Prepare current origin documentation and dedicated project/environment, source snapshot and build; inspect DNS access and add only UAT's record.
4. Apply the reviewed nonproduction forward rollout as needed, configure exact Auth redirects and deploy the committed snapshot near Frankfurt. Preserve rollback deployment/settings identifiers without secrets.
5. Assign UAT, verify TLS, public routes, real hosted reads, sign-in/provider truthfulness, protected APIs and desktop/phone layout. Check preservation and absence of temporary data.
6. Finish validation/limitations, archive this ticket, update links/index and commit its operation record. No push is needed for CLI deployment from the exact commit.

## Acceptance criteria

- [x] AC1: The QA checkpoint and release source are committed with correct DEV subjects; unrelated changes remain outside the commits/deployment.
- [x] AC2: UAT uses only hosted-dev restricted settings and reviewed compatible migrations/Auth configuration, with exact retained-data preservation evidence.
- [ ] AC3: `https://uat.movx.club` resolves with valid TLS to the intended successful Vercel deployment and current application.
- [ ] AC4: Public/guest/private-route smoke and responsive checks are recorded with actual results; remaining QA/provider limitations and rollback path are explicit.

## Validation plan

Use exact committed-source lint/type/build validation (reuse unchanged DEV0367 unit/server/database evidence), hosted runtime verifier, migration-ledger/owner/grant checks and before/after retained row hashes. Verify UAT HTTP/TLS, actual guest counts/privacy and route protection, then native desktop/phone public/sign-in navigation. Do not send real-user email or alter retained accounts for a smoke check. A new synthetic account is permitted only if necessary with exact owned cleanup; its evidence does not substitute for live Google or full hosted Auth acceptance.

## Implementation record

### Changes and rationale

QA is committed as `c65b850`. Dedicated Vercel UAT project and four Preview variables are configured. All twenty reviewed missing hosted-dev migrations applied; an exact final dry-run has no pending migrations/seeds/roles. All old-field fingerprints of 64 original rows across 42 tables matched; six retained demo coaches remain hidden. Auth templates/origin/password settings were narrowly updated and verified, preserving SMTP and disabled Google. Provider HTTP 402 refused the managed time box and leaked-password check on the Free plan; no subscription or plan change was made. The release preparation is committed as `351b5f3`. Exact-source lint/typecheck passed. Vercel CLI 64.3.1 built a READY Preview deployment in hosted-runtime mode at `movx-club-j26zoy12h-hoangworldcoms-projects.vercel.app` (`dpl_9iCAdz7gGLhUqU7WHwHPHUvgg5XB`), with release SHA metadata and actual function region `fra1`. DNS/TLS/custom-alias and final smoke remain in progress.

### Affected files

This ticket/index; current origin references in README/specification/database guide; any further configuration files will be recorded before implementation. Application source is unchanged.

### Decisions and deviations

19 October: Dedicated Preview/UAT project preserves old staging and the dev/production build guard. Local CLI is authenticated as `hworldcom`; Vercel Node 24 and Supabase CLI access exist. DNS is authoritative at Cloudflare, so Vercel DNS changes alone cannot activate the hostname.

Preflight rollout review: hosted dev has exactly baseline/effective-availability/owner-calendar plus the already applied Fitness migration (`20261016000100`, `20261016000200`, `20261016000300`, `20261018000500`). Twenty unchanged committed forward migrations are missing: all ten `20261017000100`–`20261017001000`, `20261018000100`–`20261018000400`, `20261018000600`–`20261018001000`, and `20261019000100`. The private manifest records each SHA-256. Applying all twenty together inside an actual hosted transaction, checking final preview EXECUTE/privacy and forced session RLS, then rolling back passed. This is a necessary additive deployment dependency, not new product implementation. The reviewed push will use an isolated CLI workdir, `--include-all --skip-vault`, no seed/role options, and must match exactly those files. Existing row fingerprints project the pre-rollout columns so added null/default columns do not falsely imply an account edit; counts and all previous field values must match.

Actual Auth still has six-character passwords, old code-only confirmation, default recovery, the planned test origin, no password-change notification and no managed session time box. Before exposing signup, narrowly PATCH only the exact UAT/local confirmation/callback allow-list (preserving existing entries), eight-character/no-mixture passwords, existing 3600-second proof/JWT expiry and 60-second resend, secure password change, repository confirmation/recovery/magic-link/password-notification templates and notification enablement. Attempt the specified 30-day managed session time box and breached-password check only if supported without a paid-plan change; explicitly record provider refusals. Preserve SMTP credentials, email cap, disabled Google and other settings. No email or retained-account change is authorized by this configuration operation.

The dedicated Vercel project `movx-club-uat` has been created. Cloudflare is signed out; the user was informed that Vercel hosts the app while DNS must route UAT to it. Continue the build/deployment independently of DNS access.

### Contracts, configuration, and operations

Four core application variables are server-only `DATABASE_URL` plus public Supabase URL/publishable key and `NEXT_PUBLIC_SITE_URL=https://uat.movx.club`. Operator/admin values are excluded. No retained-data or product behavior change is intended. Roll back by reassigning UAT to a known compatible deployment; additive migrations remain in place rather than restoring old account state.

## Validation results

- QA scoped ESLint and staged whitespace checks passed before `c65b850`.
- Existing Vercel project/domain/environment inventory and actual UAT/staging DNS inspected read-only.
- Exact-source lint/typecheck, actual hosted build, 20 runtime checks, 16 meaningful deployed HTTP probes and 16 JS asset checks passed. UAT DNS/TLS and native UAT responsive checks remain blocked, not passed.

| Criterion | Evidence | Result |
| --- | --- | --- |
| AC1 | QA `c65b850`, release `351b5f3`; exact committed export and metadata; unrelated edits preserved | Passed |
| AC2 | 20 migrations installed, 24-version exact ledger, 20 runtime checks, original 64-row/42-table preservation and Auth patch verification; paid limits explicitly recorded | Passed for bounded rollout; full hosted Auth acceptance remains separate |
| AC3 | Vercel READY; alias/certificate attempt failed while DNS still points to parking | Blocked — authoritative DNS record required |
| AC4 | 16 meaningful deployed HTTP smoke checks and 16 referenced JS chunks passed; no DB credential in served HTML/chunks; native UAT and real-host TLS pending | Partial — finish after DNS |

## Risks, limitations, and follow-ups

Known local QA findings remain open; no production readiness, live Google, physical-device or full hosted authentication claim. The current blocker is authoritative DNS access: Cloudflare is signed out, while Porkbun is the registrar and the domain delegates DNS to Cloudflare. Add only an unproxied/DNS-only `A` record `uat → 76.76.21.21`; do not switch nameservers or alter unrelated records. Then rerun the final alias command, verify actual UAT DNS/TLS and native desktop/phone routes, repeat preservation checks and complete/archive this ticket. The READY source/configuration and all completed checks remain usable; no rebuild is needed unless source or build-time settings change.

## Completion and review references

- Completed: Not completed.
- Commit: QA dependency `c65b850`; deployed release `351b5f3` (`[DEV0372] Prepare the hosted UAT release`). This final handoff is committed separately as `[DEV0372] Record Vercel release and DNS blocker`. No remote Git push was performed; deployment uploaded the exact committed snapshot through the CLI.
- Review: Initial scope/self-review; no independent review.
- Deployment or release: Vercel Preview READY at [the inspected release](https://vercel.com/hoangworldcoms-projects/movx-club-uat/9iCAdz7gGLhUqU7WHwHPHUvgg5XB). `uat.movx.club` activation remains Blocked on DNS/TLS; do not claim the requested hostname is live.

## Deployment journal — 19 October 2026

- QA commit: `c65b850`; release-source commit: `351b5f3eb4aead6e638ca840bd466f3710698337`. The release is an exact `git archive` of that commit at `/private/tmp/movx-dev0372-release-kxdydaif`; no populated environment file, ignored evidence or unrelated worktree edit was uploaded.
- Exact-source `npm run lint` and `npm run typecheck` passed. Unchanged application behavior retains DEV0367's local 406 unit/server and 208 database passes with recorded failures/limits; a new all-green browser claim is not made.
- The installed CLI 48.1.6 initialized this new project's first deployment as Production despite the Preview request, with no Production variables and therefore public-preview mode. It did not connect to a database. This is not the accepted UAT deployment. CLI 64.3.1 from the official npm package then produced the correctly configured READY Preview above; the guard explicitly logged `Validated preview Vercel build in hosted-runtime mode`. A redundant same-source Preview request from CLI 48 also exists but is not selected for the UAT alias. The repository's dependencies/CLI installation and runtime source were not changed.
- Vercel project ID: `prj_CPYcoaAzkLOxWrb6Q9lOaDgtQQPA`, team `team_nyqiT81rIoWAGMpA5SnTvtSm`, Node 24.x, four Preview variables, function region `fra1`. Existing Vercel authentication remains on generated URLs (`all_except_custom_domains`); no protection was disabled.
- `vercel domains add uat.movx.club --cwd <private-link-dir>` registered the hostname on the UAT project. The final CLI alias request reached certificate issuance but returned `Response Error`; the chosen deployment still had no alias at inspection. Public `uat` resolves to Porkbun parking. Both live Vercel discovery and a direct `dig NS movx.club +time=2 +tries=1 +short` report `art.ns.cloudflare.com` and `erin.ns.cloudflare.com`. No nameserver or unrelated DNS record was changed. The concrete required record is `A uat 76.76.21.21` in the authoritative zone. Cloudflare is signed out; the user was asked to add this record or sign in, with registrar/DNS/hosting responsibilities explained.
- Hosted migration evidence: private SHA manifest, rollback-only candidate result, reviewed dry-run/apply/final empty dry-run, 24-version ledger and five selected installed owner/SECURITY DEFINER/runtime-grant/anon-denial checks under ignored `work/dev0372/`. All 64 original rows across 42 existing tables matched on their original fields; bucket additions are only private `coach-banners` and `event-banners`. Existing Auth identities, profile content, history and object bytes were not modified. Six retained demo coaches remain hidden.
- Narrow Auth configuration was reread and matched the exact patch. SMTP host/user/password/sender/port, email cap, confirmation requirement and disabled Google matched their before values. Managed session time-box and leaked-password settings each returned HTTP 402 (Pro required), leaving them unchanged. No email, account reset or plan upgrade occurred. Full hosted authentication readiness remains separate.

### Final smoke and handoff

Final record review checked all 481 relative links in the release guidance/specification/index/ticket, staged whitespace and the exact two-file handoff scope. Pre-existing specification edits (apart from the authorized origin replacement), browser-test deletions and unrelated index edits still match the initial QA snapshot and remain uncommitted. This ticket stays under `current/` with status Blocked because AC3 and native UAT proof are unfinished; next IDs remain DEV0373/COR0031.

`npx --yes vercel@64.3.1 curl <path> --deployment https://movx-club-j26zoy12h-hoangworldcoms-projects.vercel.app -- <curl-options>` ran from the exact release directory using the CLI's authenticated protection access. Seven public/Auth routes (Home, Explore, Events, How it works, Sign in, Register, Forgot password) returned 200; four private pages (Account, Coach, My sessions, Messages) returned 307 to the expected sign-in destination; five valid protected API probes returned 401 signed-out (session types, Messages, Auth methods, detailed private times and booking options). An initial malformed booking-detail query returned 400; it did not test time privacy, which the corrected `/api/coaches/daniel-park/session-types?typeId=…&locationId=…&date=2026-10-20` probe subsequently verified. The first smoke wrapper failed because placing global `--cwd` after the curl subcommand passed it to curl; running the command with the child process's working directory fixed the harness without product changes.

Rendered Explore and Events showed truthful empty inventory rather than hidden fictional coaches or an unavailable fallback; Sign in explicitly reported Google unavailable. Sixteen unique Next.js immutable client chunks referenced by these pages downloaded with HTTP 200. Actual restricted database connection/password strings were absent from the rendered responses and these chunks. No broader bundle or provider certification is inferred. Local supporting evidence: `work/dev0372/smoke-results.json`, `supplement-smoke-results.json`, `asset-results.json`, private HTTP responses/headers and provider inventories.

The final independent data comparison again passed: 64 original rows across 42 existing tables, all previous fields unchanged, seven retained Auth users and zero temporary accounts created. Only the two intended private banner buckets were added. No local server was started or original server stopped; old staging, production, nameservers, other DNS records and retained logins/content remain unchanged. Native UAT desktop/phone and actual hostname TLS checks are not run while the hostname resolves to parking. Preserve DEV0368–DEV0371 and the provider HTTP-402 limitations; this is not an all-green QA or full hosted authentication sign-off.

Resume command after the DNS record is active: `npx --yes vercel@64.3.1 alias set movx-club-j26zoy12h-hoangworldcoms-projects.vercel.app uat.movx.club --cwd /private/tmp/movx-dev0372-release-kxdydaif`. Verify final certificate/alias via actual HTTPS and Vercel inspection, then native responsive navigation and the fixed 42-table fingerprint projection. Rollback before activation is to leave/remove only this new UAT alias/domain; do not repoint old staging or roll back the additive schema/credential state. After activation, use a tested compatible deployment retaining the new application-session authority; this project has no earlier hosted-runtime production release to treat as a known-good rollback. Rebuilding `351b5f3` with the same reviewed Preview settings is the reproducible release baseline.
