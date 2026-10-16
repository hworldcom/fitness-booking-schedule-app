# Ticket DEV0266: Guard hosted environment selection

- Status: Completed
- Created: 2026-10-16
- Last updated: 2026-10-16
- Milestone: Hosted environment separation
- Coordination: [COR0026 — Separate hosted dev and production](../../current/organisatory/COR0026-separate-hosted-dev-and-production.md)
- Related records: peer [DEV0267](DEV0267-connect-new-hosted-dev-environment.md), downstream [DEV0268](../../current/backend/DEV0268-prepare-isolated-production-environment.md), historical [DEV0055](../../current/backend/DEV0055-hosted-supabase-staging-environment.md).

## Objective and context

Make local hosted startup, hosted runtime verification and Vercel hosted builds select the confirmed project explicitly. The verifier currently embeds the old staging project/role/Keychain fallback and its npm command loads `.env.staging.local`; the new-account setup must not silently use those values. Apply [infrastructure boundaries](../../../docs/mvp-spec.md#6-application-and-infrastructure-boundaries) and [identity/data integrity](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity).

## Scope and non-goals

- In scope: public dev/prod reference and runtime-role mapping; reusable target checks; explicit verifier environment with no old credential fallback; a hosted dev startup command that validates dev before Next.js without Docker/migrations/fixture provisioning; Vercel preview/development → dev and production → prod guards; placeholder examples and setup/spec navigation; focused tests.
- Out of scope: hosted database/role/Auth writes (DEV0267/DEV0268), secrets in Git, changing the current sign-in method, existing Docker startup/ledger repair, UI features and live deployment.

## Expected behavior and edge cases

Dev is `mdzidiqosxbghmfyxphb`, runtime role `movx_dev_runtime_login`; prod is `yltijwebedkraypgkqmc`, role `movx_prod_runtime_login`. Project references and role names are public metadata. Configured hosted runtime connections must use that environment's dedicated role/project suffix and transaction pooler/TLS, with the matching public Auth URL. Missing/partial, owner-login, swapped-project and wrong-port configurations fail before connecting/starting/building, without printing credentials. Existing environment-free public preview remains supported. The Docker-only `dev:local` remains available unchanged; hosted dev must not auto-migrate or seed a shared database on startup.

## Assumptions, decisions, and dependencies

The user confirmed project mapping on 2026-10-16. Adopted technical defaults: shared transaction pooler port 6543, separate least-privilege runtime logins inheriting `app_runtime`, ignored `.env.development.local` for the local hosted mode, explicit `--environment dev|prod` for verification. Keep `DATABASE_URL` server-only and do not introduce privileged app credentials. Read installed Next.js 16.3.8 environment-variable documentation and Supabase CLI 2.120.0 help; current official Supabase docs confirm separate environment projects, custom-role suffixes and no prepared statements in transaction mode. New runtime role provisioning belongs to DEV0267/DEV0268, not this code change.

## Implementation plan

1. Add public environment metadata and a small shared target-validation module.
2. Replace verifier defaults/automatic staging-file loading with explicit target selection and safe diagnostics, retaining current role/RLS checks and updating obsolete booking checks where appropriate.
3. Add hosted-local startup that validates the dev settings before spawning Next.js; guard configured Vercel builds by their deployment environment. Preserve existing Docker/public-preview modes.
4. Add focused target, startup/preflight and redaction tests; document settings and update the specification's operational mapping.
5. Run scoped checks plus applicable existing environment tests/static checks in an isolated source snapshot if concurrent UI edits prevent attributable whole-tree evidence. Finish the implementation record before completion.

## Acceptance criteria

- [x] AC1: Hosted verifier and local hosted startup reject incomplete/owner/wrong-project/wrong-port configuration before network/startup, with no implicit old staging selection or credential output.
- [x] AC2: Configured Vercel preview/development use dev and production uses prod; public preview and unchanged Docker-mode tests pass.
- [x] AC3: Focused positive/negative and redaction tests, applicable lint/types/format and documentation/coordination checks pass; environment/command changes and limitations are recorded.

## Validation plan

Meaningful unit and subprocess preflight tests, existing Auth/database/Vercel/local-development tests and applicable static checks. Use synthetic credentials in tests; hosted role verification is DEV0267/DEV0268 evidence. No UI or schema changes in this ticket, so browser viewport and migration execution checks are not applicable here.

## Implementation record

### Changes and rationale

Added an explicit public environment registry shared by hosted development, runtime verification and configured Vercel builds. The verifier no longer loads an old staging environment file or Keychain entry, and requires `--environment dev|prod`. It validates project/role/pooler/Auth consistency before opening a connection, then checks the existing restricted runtime grants. Obsolete direct-booking permission checks now use the current request/acceptance functions.

`dev:hosted` loads ignored dev settings and checks the dev target/public key/localhost origin before spawning Next.js; it does not start Docker, migrate, seed or provision accounts. Configured Vercel Preview/Development builds require dev and Production requires prod. Completely unconfigured public preview and Docker startup remain supported. Errors redact the runtime URL and encoded/decoded password.

### Affected files

- [`config/supabase-environments.json`](../../../config/supabase-environments.json): public project-reference/runtime-role mapping; no credentials.
- [`scripts/lib/hosted-environment.mjs`](../../../scripts/lib/hosted-environment.mjs): reusable explicit target, connection, localhost/public-key and redaction checks.
- [`scripts/start-hosted-development.mjs`](../../../scripts/start-hosted-development.mjs): credential-safe preflight, installed Next.js launch and signal forwarding; removes inherited migration/operator/service credentials from its child environment.
- [`scripts/verify-hosted-runtime-database.mjs`](../../../scripts/verify-hosted-runtime-database.mjs): explicit target and current bounded role/grant checks with TLS, one connection and prepared statements disabled.
- [`scripts/validate-vercel-environment.mjs`](../../../scripts/validate-vercel-environment.mjs): deployment-environment mapping after existing complete-group/origin/public-key validation.
- [`package.json`](../../../package.json): added `predev:hosted`/`dev:hosted` and removed implicit staging-env loading from `db:verify:hosted-runtime`; other command edits in the shared working tree are unrelated concurrent work.
- [`.env.development.local.example`](../../../.env.development.local.example), [`README.md`](../../../README.md#run-locally), [`supabase/README.md`](../../../supabase/README.md#separate-hosted-environments) and [specification section 6](../../../docs/mvp-spec.md#6-application-and-infrastructure-boundaries): placeholder setup, explicit commands/mapping, retained-Docker/history and deployment boundaries.
- [`tests/hosted-environment.test.ts`](../../../tests/hosted-environment.test.ts) and [`tests/vercel-deployment.test.ts`](../../../tests/vercel-deployment.test.ts): meaningful target mismatch/preflight/redaction/build guards and updated positive fixture.

### Decisions and deviations

No production write or automatic migration on startup is part of this ticket. Used a source snapshot of HEAD plus only this ticket's source changes for attributable full tests/lint/format/build while independent Events/calendar work continued in the shared tree. The snapshot's `node_modules` symlink uses the installed locked dependencies; no environment credentials were copied. Root typecheck additionally passed. A first typecheck found missing required `NODE_ENV` in synthetic subprocess test environments; setting it to `test` fixed that fixture typing. Prettier has no dotenv parser, so the example was reviewed as text and excluded from the explicit formatting invocation. No product UI or schema changed here.

### Contracts, configuration, and operations

`npm run dev:hosted` reads `.env.development.local` with the same four existing application variables. `DATABASE_URL` must target `postgres` through a Supabase transaction pooler at port 6543 with exact `<runtime-role>.<project-ref>` username, password and no URL options. Its public Auth URL must match the selected project. Hosted local mode additionally requires an `sb_publishable_` public key and exact `http://localhost:<unprivileged-port>` origin. `node --env-file=.env.development.local scripts/start-hosted-development.mjs --check` performs no network/startup.

`node --env-file=<matching-ignored-file> scripts/verify-hosted-runtime-database.mjs --environment dev|prod` selects a target explicitly; the npm verifier also works with exported values. Removed compatibility: automatic `.env.staging.local`/default Keychain selection, so old operators must now supply explicit matching settings. `VERCEL_ENV=production` selects prod; configured Preview/Development and local build validation select dev. Public values are embedded during the Next.js build and require rebuilding after a project change. No new runtime dependency, SQL migration or data-shape change. Rollback is reverting these scripts/config/docs and supplying the appropriate application environment; it performs no database rollback.

## Validation results

- AC1/AC2: `node --import tsx --test tests/hosted-environment.test.ts tests/vercel-deployment.test.ts tests/local-development.test.ts tests/auth.test.ts tests/database-config.test.ts` passed all 25 focused tests. Positive dev/prod mappings and rejected missing/swapped/owner/port/options/origin/secret-key configurations run with synthetic credentials. Subprocess tests prove rejection before connection/startup without secret diagnostics; URL/password redaction includes malformed percent escapes. Existing Docker-mode/public-preview regressions passed.
- AC3 source checks: isolated `npm test` passed 163 application tests and 16 server tests (179 total); isolated `npm run lint` and `npm run format:check` passed. Root `npm run typecheck` (`next typegen && tsc --noEmit`) passed. Focused ESLint and explicit supported-file Prettier checks passed. A configuration-free `VERCEL_ENV=preview` `npm run build:vercel`, with all database/Auth/site/Geoapify values explicitly empty, passed on Next.js 16.3.8 and generated the public-preview routes.
- `python3 /tmp/dev0266-check-docs.py` passed: eight documents, 320 local links, 36 anchors, 179 unique records, next-ID/index/status consistency, all three direct peers' reciprocal COR0026 membership and exact public dev/prod mapping. Rechecked after archive/link updates. Final owned-source review matches the ticket; unrelated shared UI/calendar/invitation changes remain outside this record. No UI viewport or migration execution check applies to this ticket's source-only change; actual dev schema/connection/Auth evidence belongs to DEV0267.

## Risks, limitations, and follow-ups

Public Auth values are fixed into Next.js browser builds; deployment values need to match the build environment. New-project connectivity, Auth/email settings and real deployment remain peers, not implied by tooling completion. Preserve unrelated calendar/Events/session-note/invitation edits.

## Completion and review references

- Completed: 2026-10-16; all three criteria passed. Local implementation completion does not imply hosted environment or deployment completion.
- Commit: Included with user-authorized `[DEV0266][DEV0267][DEV0269] Use hosted Supabase dev for local development`; see Git history for the hash. The environment guards, dev handoff and adopted startup default share configuration/setup documents and are committed together.
- Review: Source/planning self-review only.
- Deployment or release: None.
