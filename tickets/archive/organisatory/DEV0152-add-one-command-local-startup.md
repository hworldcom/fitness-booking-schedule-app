# Ticket DEV0152: Add one-command local startup

- Status: Completed
- Created: 2026-10-08
- Last updated: 2026-10-08
- Milestone: Standalone scheduling developer experience
- Coordination: None — independent development ticket
- Related records: [DEV0151 — Publish standalone scheduling repository](DEV0151-publish-standalone-scheduling-repository.md), [DEV0046 — Email OTP registration and application profiles](../backend/DEV0046-email-otp-registration-and-application-profiles.md)

## Objective and context

Give a new contributor one documented command that starts every local component needed for the scheduling application: Supabase PostgreSQL/Auth/Mailpit, pending local migrations, the restricted runtime database login and the Next.js development server. The README currently requires several commands plus copying local public Auth values into `.env.local`, which makes the complete local path easy to miss.

## Scope and non-goals

- In scope:
  - add one package command for the complete Auth-enabled local development stack;
  - derive public local Auth values from the local Supabase CLI without printing or persisting credentials;
  - force the known loopback runtime database/site configuration for the spawned application process;
  - apply pending local migrations without resetting or deleting existing local data;
  - document prerequisites, first-run install, the one-command workflow, Mailpit and shutdown behavior;
  - add focused parser/configuration tests and validate the real startup path.
- Out of scope:
  - starting Docker Desktop itself or installing Node/npm/Docker dependencies;
  - resetting the local database on every run;
  - provisioning fictional coach Auth accounts automatically;
  - changing hosted, Vercel or production environment handling;
  - adding a process supervisor or running the hackathon project simultaneously.

## Expected behavior and edge cases

- After `npm ci`, `npm run dev:local` starts or reuses the local Supabase Auth stack, applies pending migrations, prepares the restricted loopback login and keeps the Next.js server in the foreground on `http://localhost:3100`.
- The command passes local `DATABASE_URL`, Supabase URL/publishable key and site URL directly to the child process. It does not write `.env.local`, print private CLI status values or use hosted settings accidentally.
- Optional Mapbox configuration may still come from `.env.local`; it is not required for the list-first application.
- Missing Docker/Supabase startup, incomplete CLI status, non-loopback endpoints, migration failure or runtime-role failure stops before Next.js starts with an actionable bounded error.
- Ctrl-C stops the foreground application; the reusable local Supabase containers remain available until `npm run db:stop`.

## Assumptions, decisions, and dependencies

- Adopted user decision, 2026-10-08: the main README must provide one command to start the app and every required local component.
- Docker must already be running and dependencies must already be installed with `npm ci`; a repository command should not install host software implicitly.
- Reuse the pinned Supabase CLI and existing `auth:start`, runtime-role and status parsing boundaries instead of introducing another dependency.
- Local migrations must be additive/non-destructive during ordinary startup. `db:reset` remains an explicit separate command because it deletes disposable local data.
- Pre-implementation review found one small repository tooling/documentation slice and no need for a coordination record or ticket split.

## Implementation plan

1. Inspect the pinned Supabase CLI's non-destructive local migration command after dependency installation.
2. Extend the existing bounded local-status parser to return the public publishable/legacy-anon key needed by the app, with loopback validation and focused tests.
3. Add a TypeScript startup orchestrator that runs the existing stack/runtime steps, applies pending migrations, injects local-only application values and forwards termination to the foreground dev server.
4. Add `npm run dev:local` and make it the primary README workflow while retaining explicit component commands for troubleshooting and database operations.
5. Run focused/unit tests, type checking, lint, formatting, production build, a real local-start smoke and `git diff --check`; complete/archive the ticket only after all acceptance criteria pass.

## Acceptance criteria

- [x] AC1: README prominently documents `npm run dev:local` as the one command that starts all required local application services after installation.
- [x] AC2: The command starts/reuses Auth-enabled Supabase, applies pending migrations non-destructively, prepares the restricted runtime login and launches Next.js on port 3100.
- [x] AC3: Local Auth/database values are loopback-validated, injected only into the app child process and neither persisted nor printed by the orchestrator.
- [x] AC4: Failure before application startup is bounded/actionable, and Ctrl-C does not leave an orphaned Next.js child.
- [x] AC5: Relevant tests, type, lint, format, build, real startup smoke and diff checks pass with a complete implementation record.

## Validation plan

- Unit-test CLI-status parsing for publishable-key and legacy-anon-key formats, missing values and non-loopback targets.
- Exercise `npm run dev:local` against the local Docker stack, wait for `/api/auth/actor` and Mailpit, then terminate it and confirm the application port closes while Supabase remains healthy.
- Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build` and `git diff --check`.
- No database integration suite is required because schema/functions do not change; the real startup smoke proves migration and runtime-role orchestration.

## Implementation record

`npm run dev:local` is now the primary local-development entry point. It checks the repository's Node release, starts or reuses the pinned Auth-enabled Supabase stack, applies only pending local migrations, creates/verifies the restricted runtime login, reads the CLI status without echoing it, validates the expected loopback ports, injects the existing application environment names into the child process and runs Next.js in the foreground. The README now leads with this command after `npm ci` and explains service URLs, optional configuration, teardown and manual troubleshooting commands.

### Changes and rationale

- Added a small TypeScript orchestrator instead of a shell chain so status values can be parsed without printing, hosted values can be overridden safely and signals can be forwarded to the exact Next.js child.
- Extended the existing local Supabase status parser to accept the current publishable key or legacy anon key while retaining the service-role value solely for the existing guarded provisioning command.
- Added pure local-environment and Node-version validation so the app cannot be launched through this command against hosted or unexpected-port endpoints.
- Used `supabase migration up --local`, verified against the pinned CLI help, to apply pending migrations without the data loss caused by `db:reset`.
- Kept Mapbox optional and removed the need to persist core local Auth/database values in `.env.local` for development.

### Affected files

| File or component | Change and purpose |
| ----------------- | ------------------ |
| `scripts/start-local-development.ts` | Orchestrates local services, non-destructive migrations, runtime-role preparation, bounded status reading, child environment and signal forwarding. |
| `scripts/lib/local-development.ts` | Defines the exact loopback application configuration and validates the required Node version and Supabase ports. |
| `scripts/lib/local-coach-accounts.ts` | Extends the shared bounded CLI-status parser with the publishable/legacy-anon application key and generalizes loopback failure copy. |
| `package.json` | Adds `dev:local` as the one-command local startup entry point. |
| `README.md` | Makes the complete command prominent and documents prerequisites, services, optional configuration, production-preview distinction, troubleshooting and teardown. |
| `tests/local-development.test.ts`, `tests/local-coach-accounts.test.ts` | Cover bounded child values, hosted/unexpected-port rejection, supported Node releases and both public-key status formats. |

### Decisions and deviations

- 2026-10-08: Keep local Supabase running after the foreground app exits so repeated development starts stay fast; `npm run db:stop` remains the explicit teardown.
- 2026-10-08: Use the pinned CLI's `supabase migration up --local` after startup; unlike `db:reset`, it applies pending history without deleting local accounts or bookings.
- 2026-10-08: Fail before touching Docker when Node is outside `>=24.21.0 <25`, with an explicit `nvm use` recovery instruction.

### Contracts, configuration, and operations

The package-command contract adds `npm run dev:local`. It supplies the existing `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `NEXT_PUBLIC_SITE_URL` names to the Next.js child only, removes any inherited coach-review/service-role/secret-key values from that child and writes no environment file.

No hosted configuration, database schema, migration, dependency or application API changed. Docker, Node/npm and `npm ci` remain explicit prerequisites. The rollback is removal of the package command/orchestrator and restoration of the prior multi-command README workflow; no data conversion is involved.

## Validation results

| Criterion | Evidence | Result |
| --------- | -------- | ------ |
| AC1 | README's `Run locally` section now leads with `nvm use`, `npm ci`, then the single `npm run dev:local` command and enumerates every managed component. | Passed |
| AC2 | A real run reused the local Auth stack, reported no pending migrations, prepared the restricted login and started Next.js 16.3.8 on port 3100. HTTP checks returned 200 for `/`, 401 with `{status: signed-out}` for `/api/auth/actor`, and 200 for Mailpit. | Passed |
| AC3 | Unit tests proved the exact four-value child environment and rejected hosted or wrong-port status. Real startup output contained service progress/URLs but no CLI keys; no `.env.local` was created. | Passed |
| AC4 | Running through Node 20 exited before Supabase startup with the bounded `Node.js 24.21.x ... Run nvm use` instruction. Sending Ctrl-C to the real Node 24 run closed port 3100; port 55321 remained healthy for reuse. | Passed |
| AC5 | Under Node 24.21.0, `npm test` passed 70/70; `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build` and `git diff --check` passed. The production build completed all 16 routes. | Passed |

`npm run test:db` was not run because no schema, migration or database authorization behavior changed. The real startup smoke executed the pinned CLI's migration path and runtime-role preparation against the local database.

## Risks, limitations, and follow-ups

- Docker must be running and the pinned npm dependencies installed before the command can manage the local stack.
- The scheduling and hackathon projects currently reserve overlapping local ports, so they cannot run simultaneously without a separate port-allocation change.

## Completion and review references

- Completed: 2026-10-08.
- Commit: Included in `[DEV0152] Add one-command local startup`.
- Review: Self-review completed against AC1–AC5; no independent review or pull request created.
- Deployment or release: Not deployed.
