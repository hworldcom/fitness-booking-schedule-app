# Ticket DEV0269: Default local startup to hosted dev

- Status: Completed
- Created: 2026-10-16
- Last updated: 2026-10-16
- Milestone: Hosted environment separation
- Coordination: [COR0026 — Separate hosted dev and production](../../current/organisatory/COR0026-separate-hosted-dev-and-production.md)
- Related records: completed target guards [DEV0266](../../archive/backend/DEV0266-guard-hosted-environment-selection.md) and actual dev provisioning [DEV0267](../../archive/backend/DEV0267-connect-new-hosted-dev-environment.md); independent retained Docker continuity [DEV0232](../../current/organisatory/DEV0232-restore-local-migration-continuity.md).

## Objective and context

The user confirms that normal local application startup must use hosted Supabase dev and must not create/start a Docker database. Currently `dev:hosted` is guarded, `dev:local` starts/migrates/provisions Docker and plain `dev` starts Next.js without explicit target validation. Make the ordinary and existing local commands consistently select confirmed hosted dev under [specification section 6](../../../docs/mvp-spec.md#6-application-and-infrastructure-boundaries).

## Scope and non-goals

- In scope: route `dev`, `dev:local` and `dev:hosted` through the existing hosted-dev launcher; expose the retained Docker app workflow only as explicit `dev:docker`; meaningful npm-entrypoint regression checks; update current setup/specification/coordination guidance and evidence.
- Out of scope: new database/schema/Auth/email writes, production setup, deleting or stopping retained Docker services/data, interrupting another running app/rehearsal, calendar migrations/features, raw Next.js CLI restrictions and changing isolated database/browser test targets.

## Expected behavior and edge cases

All three usual development commands load ignored `.env.development.local` and validate the confirmed dev project, restricted login, public Auth key and localhost origin before launching Next.js. They invoke no Docker/Supabase startup, migration, seed or account provisioning. Missing settings and loopback/prod/owner targets fail without fallback or secrets in diagnostics. Each entrypoint retains map-worker preparation. Explicit `dev:docker` preserves the old guarded loopback workflow and requires Docker; database test/operator commands remain deliberate opt-ins. An already running process keeps its original environment until restarted; this change does not silently retarget or kill it.

## Assumptions, decisions, and dependencies

DEV0266 supplies the shared validated launcher; DEV0267 supplied and verified the ignored dev connection. Adopt `dev:local` as a compatibility name for the locally running app with hosted data so old habits cannot start Docker. Keep explicit `dev:docker` for isolated/retained tests because calendar work is using those services; no container deletion is requested. Inspected Next.js 16.3.8 bundled environment-variable documentation before changing startup configuration. This is one small command-selection task and does not need another coordination record.

## Implementation plan

1. Preserve shared package edits and change only app startup entries: all normal commands call the existing Node/env-file launcher, while `predev:docker`/`dev:docker` preserve the former Docker sequence.
2. Add isolated subprocess checks using actual npm script definitions, synthetic settings and a recording Next.js executable. Prove normal startup selects dev without Docker calls; missing or wrong settings refuse startup without fallback/secret output.
3. Update README/database guidance and the specification's operational default; add this direct peer to COR0026 with clear delivery order and boundaries.
4. Run focused startup/location/environment regressions, relevant lint/types/format and documentation/index/membership checks; verify the actual existing hosted runtime read-only. No UI, schema, destructive database or email test is needed.
5. Finish the implementation record and archive after acceptance passes. Preserve current processes and unrelated calendar/invitation/session-note work.

## Acceptance criteria

- [x] AC1: `npm run dev`, `npm run dev:local` and `npm run dev:hosted` validate and launch the confirmed hosted-dev mode without Docker/database setup; invalid/missing settings fail before application startup without fallback or credential output.
- [x] AC2: Docker startup is available only through explicit `dev:docker` among app development entries; existing isolated database/rehearsal commands and retained services/data are unchanged.
- [x] AC3: Regression/static/documentation checks and actual read-only hosted-runtime verification pass; setup/defaults and running-process/migration limitations are documented accurately.

## Validation plan

Use a temporary fixture containing actual npm entry definitions and the shared launcher/validator with fake credentials, sentinel Docker/Supabase commands and a recording Next.js child. Exercise all normal entrypoints and negative configurations with real npm subprocesses and no network. Run focused existing hosted/local/Vercel/location tests plus relevant ESLint/type/Prettier and local links/namespace/status/COR checks. Real hosted verification uses the already ignored runtime file and existing least-privilege verifier; no mail or database mutation. Browser viewport and migration/build checks are not required for a command-only change unless source checks identify a new concern; DEV0266 already verified the shared launcher and public-preview build.

## Implementation record

### Changes and rationale

Plain `dev` previously launched Next.js directly and `dev:local` started Docker, migrations and test-account provisioning. Both now run the existing guarded hosted-dev launcher, as does `dev:hosted`. Normal app startup uses the confirmed dev project and fails on missing/incorrect settings, with no Docker or database setup fallback. The former Docker command is preserved only under explicit `dev:docker`; map-worker preparation remains available before each app mode.

### Affected files

- [`package.json`](../../../package.json): ordinary/local app entries now use `node --env-file=.env.development.local scripts/start-hosted-development.mjs`; new `predev:docker`/`dev:docker` preserve the former Docker workflow. Other shared package changes belong to their existing tickets.
- [`tests/development-startup.test.ts`](../../../tests/development-startup.test.ts): actual npm entrypoint subprocesses in disposable fixtures, synthetic dev settings, recording Next.js child and blocked Docker/Supabase/legacy startup commands. Checks all three normal starts plus missing/loopback/prod refusal and credential-safe output.
- [`README.md`](../../../README.md#run-locally), [`supabase/README.md`](../../../supabase/README.md#separate-hosted-environments) and [specification section 6](../../../docs/mvp-spec.md#6-application-and-infrastructure-boundaries): hosted default and explicit Docker testing/setup, compatibility meaning of `dev:local`, no automatic database setup, and existing-process restart requirement.
- This ticket, [`tickets/README.md`](../../README.md) and COR0026: scope, direct ownership, index/namespace and verified handoff.

Shared launchers, target validator/registry, database/rehearsal scripts, credentials and SQL files were reused unchanged by this task.

### Decisions and deviations

2026-10-16: retained `dev:local` as a compatibility entry for the local application using hosted dev; dropping it would leave existing habits ambiguous, while keeping its Docker behavior would contradict the user's clarified default. Kept per-command map hooks and reused one shared launcher instead of adding another target selector. Npm subprocess tests skip lifecycle hooks because existing location tests already cover map preparation; a real repository `npm run dev -- --check` additionally ran that hook successfully. No departure from the planned behavior, new framework dependency, app interface or database migration. Existing servers and Docker tests were not interrupted.

### Contracts, configuration, and operations

`npm run dev` is the normal startup command; `dev:local` and `dev:hosted` are equivalent guarded entrypoints. `dev:local` changes meaning from a Docker-backed app to a locally running app with hosted dev data. The previous behavior requires deliberate `npm run dev:docker`. No environment name, credential, dependency, data shape or migration changed. The ignored `.env.development.local` retains the existing restricted dev connection and public Auth/site values. Process environment overrides are still checked, so stale exported loopback/prod/owner settings refuse startup rather than selecting another backend. Stop/restart a pre-existing app in its own terminal to adopt the new mode. No running app, container, retained account or database was removed. Rollback is restoring the prior script selection; it makes no database change and would restore the old Docker default.

## Validation results

- AC1/AC2: `node --import tsx --test tests/development-startup.test.ts tests/hosted-environment.test.ts tests/local-development.test.ts tests/vercel-deployment.test.ts tests/location-services.test.ts` passed all 22 tests. The new tests run the real definitions of all three npm commands with a recording Next.js executable and database-command sentinels; no sentinel ran. Nine missing-file/loopback/prod attempts refused startup, launched no Next.js child and exposed no synthetic password. Existing target/redaction/Docker-loopback/Vercel/public-preview/map-hook checks also passed.
- AC1 actual configuration: `npm run dev -- --check` passed using the existing ignored dev file, including `predev` map-worker preparation, without launching the app or starting Docker/database setup.
- AC3 real hosted connection: `node --env-file=.env.development.local scripts/verify-hosted-runtime-database.mjs --environment dev` passed all 20 checks, including actual `movx_dev_runtime_login`, no create-db/create-role/bypass-RLS/owner authority, bounded request/acceptance grants and browser-role isolation. This operation was read-only and sent no email.
- AC3 static checks: `npm run typecheck` (`next typegen && tsc --noEmit`) and `eslint tests/development-startup.test.ts` passed. Installed Prettier checked the new test, package metadata and affected documentation. `python3 /tmp/dev0269-check-docs.py` passed local links/anchors, unique IDs/next IDs, index/status, four direct peers' reciprocal COR membership and public target mapping; rechecked after archival. `git diff --check` passed. A repository search found no incoming links to the renamed setup headings.
- Final source review confirms only the planned startup/default documentation and test changes for this ticket; the old Docker launcher and database/test command bodies remain unchanged. No new full build, UI viewport check, destructive database suite or mail test was needed for a command-selection change. The shared launcher/build and real email/session evidence remain in DEV0266/DEV0267; concurrent unfinished calendar/UI code is not certified by these checks. Temporary test fixtures were removed by each test's cleanup.

## Risks, limitations, and follow-ups

An already running server must be restarted by its owner to adopt the selected environment. Calendar's uncommitted owner migration remains a separate validated hosted rollout under DEV0254; this startup change does not apply it. DEV0268 owns production. Retained Docker migration continuity remains DEV0232.

## Completion and review references

- Completed: 2026-10-16; all three criteria passed.
- Commit: Included with user-authorized `[DEV0266][DEV0267][DEV0269] Use hosted Supabase dev for local development`; see Git history for the hash. The adopted default depends on the same guarded launcher and shared setup documents.
- Review: Scope/source self-review; no independent review.
- Deployment or release: None; no hosted mutation.
