# Ticket DEV0372: Deploy reviewed release to UAT

- Status: In progress
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

- [ ] AC1: The QA checkpoint and release source are committed with correct DEV subjects; unrelated changes remain outside the commits/deployment.
- [ ] AC2: UAT uses only hosted-dev restricted settings and reviewed compatible migrations/Auth configuration, with exact retained-data preservation evidence.
- [ ] AC3: `https://uat.movx.club` resolves with valid TLS to the intended successful Vercel deployment and current application.
- [ ] AC4: Public/guest/private-route smoke and responsive checks are recorded with actual results; remaining QA/provider limitations and rollback path are explicit.

## Validation plan

Use exact committed-source lint/type/build validation (reuse unchanged DEV0367 unit/server/database evidence), hosted runtime verifier, migration-ledger/owner/grant checks and before/after retained row hashes. Verify UAT HTTP/TLS, actual guest counts/privacy and route protection, then native desktop/phone public/sign-in navigation. Do not send real-user email or alter retained accounts for a smoke check. A new synthetic account is permitted only if necessary with exact owned cleanup; its evidence does not substitute for live Google or full hosted Auth acceptance.

## Implementation record

### Changes and rationale

QA is committed as `c65b850`. Dedicated Vercel UAT project and four Preview variables are configured. All twenty reviewed missing hosted-dev migrations applied; an exact final dry-run has no pending migrations/seeds/roles. All old-field fingerprints of 64 original rows across 42 tables matched; six retained demo coaches remain hidden. Auth templates/origin/password settings were narrowly updated and verified, preserving SMTP and disabled Google. Provider HTTP 402 refused the managed time box and leaked-password check on the Free plan; no subscription or plan change was made. Deployment/DNS/smoke remains in progress.

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
- Remaining checks pending.

| Criterion | Evidence | Result |
| --- | --- | --- |
| AC1 | QA checkpoint `c65b850`; release operation pending | In progress |
| AC2 | Hosted inventory pending | Not run |
| AC3 | Parking DNS, no alias at preflight | Not run |
| AC4 | Deployed smoke pending | Not run |

## Risks, limitations, and follow-ups

Known local QA findings remain open; no production readiness, live Google, physical-device or full hosted authentication claim. If access is missing, preserve the successful prepared result and identify the exact remaining operator action. Next action: hosted ledger/Auth read-only inspection and UAT DNS access.

## Completion and review references

- Completed: Not completed.
- Commit: QA dependency `c65b850`; this ticket's release commits pending.
- Review: Initial scope/self-review; no independent review.
- Deployment or release: Not yet deployed.
