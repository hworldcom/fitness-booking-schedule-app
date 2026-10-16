# Ticket DEV0272: Restore isolated local Supabase development

- Status: Completed
- Created: 2026-10-16
- Last updated: 2026-10-17
- Milestone: Development infrastructure
- Coordination: None — independent development ticket
- Related records: historical hosted defaults [DEV0269](DEV0269-default-local-startup-to-hosted-dev.md), retained-resource cleanup [DEV0270](DEV0270-remove-retired-local-supabase-containers.md), hosted calendar rollout [DEV0271](DEV0271-apply-hosted-dev-calendar-migration.md); external hosted rollout [COR0026](../../current/organisatory/COR0026-separate-hosted-dev-and-production.md); independent legacy continuity [DEV0232](../../current/organisatory/DEV0232-restore-local-migration-continuity.md).

## Objective and context

The user adopts local Supabase for development and automated database tests, hosted dev for shared UAT/integration, and separate hosted production. This revises the earlier hosted-default choice. Restore a working local stack from the accepted baseline/forward migrations without mounting, resetting or relabelling the retained historical volumes. Follow [infrastructure boundaries](../../../docs/mvp-spec.md#6-application-and-infrastructure-boundaries) and preserve ongoing feature work.

## Scope and non-goals

- In scope: fresh Docker project identity; ordinary local startup defaults; explicit hosted startup; compatible local operator/test container references; local environment isolation and non-starting preflight; setup-only validation mode; actual fresh/repeated startup, SQL/runtime/Auth/browser verification; current setup/specification/index handoff.
- Out of scope: legacy ledger repair or old-volume reuse/deletion, account/file transfer, hosted migrations/settings/data changes, real email delivery, production/UAT deployment, calendar performance fixes, unrelated feature work and automatic commits.

## Expected behavior and edge cases

`npm run dev`, `dev:local` and the compatibility alias `dev:docker` use a new `movx-club-local` Supabase project on the existing loopback ports 55321/55322/55324. Fresh startup applies the baseline and every accepted forward migration plus the seed. Later startup applies only pending local migrations, never resets data, prepares the restricted runtime login and preserves/provisions the ordinary local test account. Coach-account provisioning remains explicit. `dev:hosted` keeps the guarded hosted-dev path and existing ignored settings.

The local launcher injects local database/Auth/origin settings before Next.js can load the hosted `.env.development.local` file. It removes privileged operator settings from child processes. Wrong project IDs/ports and unknown flags fail before mutation. `--check` validates configuration without starting services; `--setup-only` prepares local services and accounts without starting Next.js. A failed local startup never falls back to hosted dev. Existing unrelated application processes are not silently retargeted.

## Assumptions, decisions, and dependencies

Read-only preflight found no remaining old app containers, the two retained old volumes, and 23 unrelated stopped containers. Use the new project identity rather than changing their history. Keep the installed Supabase CLI 2.120.0 and Node 24.21.0; no dependency update is needed. The active migration stream has baseline, effective availability and owner calendar. Local Auth captures mail in Mailpit; hosted SMTP credentials are unnecessary. Next.js 16.3.8 bundled environment documentation confirms existing process variables override dotenv files. New local data is independent of hosted and retained data.

## Implementation plan

1. Review configuration, startup helpers, local tests and installed CLI/Next.js documentation. Allocate this ticket and update the index before implementation.
2. Change only the local project ID and its three maintained container defaults; route ordinary npm development commands to the existing local launcher. Add bounded configuration/flag checks, setup-only mode and child-environment isolation with meaningful tests.
3. Start the exact new stack, verify the three-version ledger, seed and restricted login, and provision only local test accounts. Re-run setup to prove persistence. Preserve old-volume identity and unrelated Docker state; make no hosted call for setup.
4. Run focused/full source checks and relevant real local SQL/Auth/browser checks. Verify hosted configuration preflight still passes without a hosted write. Record failures and exact remaining evidence.
5. Update the current specification, setup guidance and external coordination handoff. Review scope, finish evidence and archive only when all acceptance criteria pass. Leave changes uncommitted unless requested.

## Acceptance criteria

- [x] AC1: Ordinary development commands select fresh local Supabase; hosted dev remains explicit. Config/flag/environment guards prevent accidental hosted use or legacy-volume reuse.
- [x] AC2: Fresh and repeated local setup succeed with the accepted migrations, seed, restricted runtime and persistent local test identity; old volumes and unrelated containers are preserved.
- [x] AC3: Actual local SQL/permissions and Auth/application flows pass, along with relevant regression/type/lint checks. Hosted preflight remains valid without changing hosted state.
- [x] AC4: Current requirements/setup/index describe the revised arrangement, exact commands, limitations and recovery, with valid links and complete implementation evidence.

## Validation plan

Test launcher flag rejection, exact local project/port checks, environment precedence and privileged-variable stripping. Record Docker metadata before/after; inspect only bounded local migration/seed/runtime metadata, never private keys. Exercise fresh and repeated `npm run dev -- --setup-only`, the full local database driver/pgTAP suites where prerequisites permit, and real local sign-in/session recognition with captured email. Run `npm test`, typecheck, focused lint/format and documentation consistency. No product interface design changes require a new responsive visual suite; existing screens are used to prove the infrastructure switch. A production build is required if environment/runtime changes affect bundling; avoid conflicting with peer development output by using an owned temporary source copy when necessary.

## Implementation record

### Changes and rationale

Ordinary development commands now prepare and run the isolated Docker stack instead of loading hosted settings. The local project identity prevents mounting the retired volumes. A read-only preflight and setup-only mode support review and provisioning without an app process; existing loopback values take precedence over hosted dotenv input. Real local sign-in, including captured email and returning-account recovery, passed.

### Affected files

- [`package.json`](../../../package.json): `dev`/`dev:local` use the local launcher; `dev:docker` remains its alias and `dev:hosted` remains guarded/explicit. The independent Events rehearsal script entry was preserved.
- [`supabase/config.toml`](../../../supabase/config.toml): new `movx-club-local` project and five-minute initial database health window, with existing application/Auth/Mailpit ports and Auth contract retained.
- [`local project guard`](../../../scripts/lib/local-supabase-project.mjs): shared database-container name and literal project/API/database/mail-port checks; [`local launcher`](../../../scripts/start-local-development.ts): validate flags/config before mutation, support `--check`/`--setup-only`, preserve normal non-resetting setup order.
- [`local environment helper`](../../../scripts/lib/local-development.ts): inject the restricted loopback runtime/Auth/origin and exclude operator database/Auth/SMTP settings from the app child.
- [`baseline tooling`](../../../scripts/database-baseline.mjs), [`baseline rehearsal`](../../../scripts/rehearse-database-baseline.mjs) and [`group-discovery rehearsal`](../../../scripts/rehearse-local-group-discovery.ts): share the new default container; explicit baseline-container overrides still work.
- [`local helper tests`](../../../tests/local-development.test.ts) and [`npm startup tests`](../../../tests/development-startup.test.ts): wrong project/ports, environment precedence, operator exclusion, flag handling, real local orchestration with isolated command fixtures, and explicit hosted refusal/no-Docker behavior.
- [`README`](../../../README.md#run-locally), [`database guide`](../../../supabase/README.md#local-development-and-database-tests), [`hosted example`](../../../.env.development.local.example), specification section 6, index and external COR0026: current operating contract, commands and historical-decision handoff. No applied migration, dependency or populated environment file changed.

### Decisions and deviations

2026-10-16: User explicitly adopted the recommended fresh local development stack. Existing hosted setup remains available; this ticket supersedes its startup-default decision without rewriting completed historical records. Configuration and validation are one bounded infrastructure slice.

During validation, update the existing npm startup integration tests to expect local service preparation for ordinary commands and retain hosted-only rejection checks on `dev:hosted`. First cold database initialization exceeded the existing two-minute health timeout and became healthy immediately afterward; allow five minutes, retry only the new project, and inspect actual schema/seed state before declaring bootstrap success. Preserve the partial new volume rather than resetting any retained data. The first configuration guard also used an outdated email section name; corrected it to the installed configuration's `local_smtp` before any successful Docker start.

SQL validation adjustment before implementation: all 247 pgTAP assertions passed, but the generic `db:lint` command also linted pgTAP's installed third-party helpers, reporting dynamic-test-state/type diagnostics while exiting zero. Scope the maintained command to MovX's `app` schema and fail on warnings, matching the existing baseline runbook. Keep the original diagnostic evidence; exclude vendor extension internals without suppressing application findings.

### Contracts, configuration, and operations

Local Docker project/container/volume names change to `movx-club-local`; existing loopback URLs and restricted role remain. Existing `.env.development.local` remains the explicit hosted input. No secret or hosted setting is copied into the local configuration. Recovery is stopping only the new project and choosing `dev:hosted`; retained volumes remain independently available for DEV0232.

## Validation results

2026-10-16, Node 24.21.0, Supabase CLI 2.120.0, Docker 24.0.6. Preflight saved only bounded Docker resource metadata under ignored `test-results/dev0272-local/`; no container environment or credential was printed.

- Initial guard validation failed before Docker because the email config section is `local_smtp`, then passed after correction. Typecheck exposed a missing `ProcessEnv` annotation/required `NODE_ENV` in synthetic tests; fixed both. Initial sandboxed npm/tsx commands could not create their IPC socket; rerun with the required local execution permission succeeded. No automatic approval review rejection occurred.
- First cold `npm run dev -- --setup-only` downloaded the required images but exceeded the old two-minute health window. Docker failed to stop the new container and left stale running state after PostgreSQL shutdown; retry/restart reported OCI namespace errors and no exit event. Confirmed the other 23 containers were stopped, quit/reopened Docker Desktop, and resumed only the new project. No volume/image was deleted. Health timeout is now five minutes.
- Recovered startup applied exactly `20261016000100`, `20261016000200`, `20261016000300`. Because interruption occurred before first seeding, inspected the new database and confirmed zero application runs, profiles and Auth users. `npm run db:seed` then initialized only this known-empty local database. `npm run dev -- --setup-only` completed with no pending migration, restricted runtime setup and ordinary local account creation. This was an interrupted bootstrap with explicit seed recovery, not an uninterrupted one-command fresh-start result.
- A real second `npm run dev -- --setup-only` passed, preserving the ordinary Auth/profile UUIDs and creation times, avatar reference and an independently inserted probe row. The owned `public.dev0272_startup_probe` table was removed after the assertion. Ignored `repeat-result.json` records success.
- `node --import tsx --test tests/local-development.test.ts tests/hosted-environment.test.ts` passed 11 checks; npm startup integration passed 3 checks using actual entrypoints and isolated command fixtures. The earlier full run failed the two superseded hosted-default expectations; after updating them, `npm test` passed **204 application + 20 server tests**.
- `npm run typecheck` and `npm run lint` passed. Focused ESLint and Prettier passed. `npm run build -- --webpack` passed in an owned environment-free source copy; compilation, TypeScript, generation and tracing succeeded. That owned copy was removed. No UAT/production build or deployment occurred.
- `npm run dev:hosted -- --check` passed using the existing ignored hosted settings, without a hosted call or write. `npm run dev` now serves the real local application at `http://localhost:3100`; its logs show dotenv discovery, while actual browser traffic uses the injected local Auth/database values.
- `npm run test:auth` passed actual captured-email OTP verification, invalid/replayed-code handling, separate athlete/pending-coach onboarding, returning identity, profile isolation, sign-out and responsive keyboard/overflow checks. Mail remained in local Mailpit. No real SMTP provider or hosted Auth setting changed.
- `npm run test:db` passed **124 database integration tests**, including effective availability, authorization, retries, concurrency, connections, messages and repeated-seed preservation. `npm run db:test` passed **247 SQL assertions across 15 files**. These ran only on the new local database; no Docker reset or hosted database suite was run.
- Initial generic `npm run db:lint` reported only third-party `extensions`/pgTAP helper diagnostics despite exit zero. After the recorded command change, `npm run db:lint` passed with `--local --schema app --fail-on warning`, an empty findings array and no application schema errors. This is the meaningful application SQL lint result.
- `npm run auth:provision:coaches` passed explicitly after SQL validation. All five existing fictional coaches now have local email-code logins and remain demo coaches. The maintained Auth browser runner leaves its two fictional onboarding accounts in this disposable local dataset for inspection; signed-in browser contexts were closed. No hosted account was created or real mail sent.
- Docker preservation comparison passed: both old named volumes retain identical Name/Driver/CreatedAt/Mountpoint/Scope/Labels, all 23 unrelated IDs/names/states/images match the baseline, all five new project containers are healthy, and none mounts either old volume. Saved bounded result is `docker-after-result.json`.
- Final review: syntax/config guards, source/record scope, 333 local links and 33 anchors, unique namespaces and archive/status/index checks passed. `node scripts/database-baseline.mjs verify` passed all 53 archived checksums and the baseline checksum; all three active migration files match HEAD byte-for-byte; targeted Prettier and `git diff --check` passed. The staging area is empty. The owned build copy/probe table were removed, while the requested local services and app at localhost:3100 remain running. No populated environment file, hosted setting, migration source or dependency version changed.

| Criterion | Evidence                                                                                                                        | Result |
| --------- | ------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Local/helper/npm entrypoint tests, real local startup and explicit hosted preflight                                             | Passed |
| AC2       | Initialized fresh project with recorded interruption/seed recovery, repeat persistence probe and Docker preservation comparison | Passed |
| AC3       | 224 source tests, 124 driver tests, 247 SQL assertions, clean app SQL lint, actual Auth/browser and type/lint/build             | Passed |
| AC4       | Current requirements/setup/coordination handoff, archive/index/link/format review and this implementation record                | Passed |

## Risks, limitations, and follow-ups

Docker requires local disk/memory and image downloads. Local performance cannot certify hosted latency; the calendar read-path performance defect remains separate. DEV0232 still owns old-ledger compatibility. Concurrent feature rehearsals may continue against hosted dev through explicit commands. The first cold initialization required Docker Desktop recovery and explicit seeding of the confirmed empty new database; the exact sequence is recorded above. Future interrupted initialization should inspect state before choosing a bounded recovery. The five-minute health window accommodates slower initial startup. Local PostgreSQL uses the CLI-selected major-17 image; hosted performance remains a separate benchmark. Old local or hosted accounts/uploads were not imported.

2026-10-17 pre-commit review: `node --import tsx --test tests/local-development.test.ts tests/hosted-environment.test.ts tests/development-startup.test.ts` passed all 14 focused checks. Targeted ESLint/Prettier passed. These checks use isolated command fixtures and make no database or hosted change. The prior full SQL/Auth/build evidence above remains dated 16 October; ongoing messaging/navigation changes are excluded from this commit. Staged file/link/credential and whitespace review passed before commit.

## Completion and review references

- Completed: 2026-10-16; all four criteria passed with actual local services, SQL and Auth/browser evidence.
- Commit: Included in the user-authorized `[DEV0272] Restore isolated local Supabase development` commit on 2026-10-17.
- Review: Source, live-operation, data-preservation and acceptance self-review; no independent review.
- Deployment or release: No hosted deployment or change authorized by this task.
