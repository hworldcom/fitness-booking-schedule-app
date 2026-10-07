# Ticket DEV0139: Retire Cloudflare deployment path

- Status: Completed
- Created: 2026-10-07
- Last updated: 2026-10-07
- Milestone: Hosted runtime consolidation
- Coordination: None — independent development ticket
- Related records: [DEV0138 — Prepare Vercel deployment](../../archive/backend/DEV0138-prepare-vercel-deployment.md), [DEV0054 — Cloudflare Workers runtime foundation](../../archive/backend/DEV0054-cloudflare-workers-runtime-foundation.md), [DEV0056 — Staging release and domain rehearsal](../../archive/backend/DEV0056-staging-release-and-domain-rehearsal.md), [DEV0093 — Reduce Cloudflare authentication and render CPU](../../archive/backend/DEV0093-reduce-cloudflare-auth-render-cpu.md), [COR0004 — Hosted staging deployment](../../archive/organisatory/COR0004-hosted-staging-deployment.md)

## Objective and context

Remove the repository's active Cloudflare Workers deployment path now that the user has selected Vercel as the immediate hosting target. The application currently carries a second build/runtime toolchain through vinext, Vite, Wrangler and Hyperdrive, plus deployment scripts, tests and current work records. Keeping both paths creates ambiguous operational ownership, retains adapter-only dependencies and leaves current requirements pointing at a host the user no longer wants to maintain.

This ticket consolidates the repository on standard Next.js plus the Vercel readiness contract delivered by DEV0138. It updates the [application and infrastructure boundary](../../../docs/mvp-spec.md#6-application-and-infrastructure-boundaries) without changing marketplace behavior or the [M7 hosted rehearsal outcome](../../../docs/mvp-spec.md#12-delivery-milestones).

## Scope and non-goals

- In scope:
  - Remove vinext, Vite/Cloudflare plugin and Wrangler dependencies, commands and configuration.
  - Remove the guarded Cloudflare staging deployment script and its Cloudflare-specific tests.
  - Remove the Worker/Hyperdrive database branch and retain the standard server-only `DATABASE_URL` path used by Next.js/Vercel.
  - Remove Cloudflare-generated-output lint/ignore settings that no longer have a producer.
  - Reconcile README, Supabase operations guidance and the MVP specification around the Vercel/standard Next.js hosting path.
  - Cancel and archive unfinished Cloudflare-only development/coordination records while preserving their historical evidence; keep hosted Supabase work independent and usable by the Vercel path.
  - Update future-facing references in current marketplace records so hosted validation no longer depends on Cloudflare Workers.
  - Update the npm lockfile and validate that the remaining application builds and tests cleanly.
- Out of scope:
  - Deleting or modifying the live Cloudflare Worker, Cloudflare account, zone, DNS records, Access policies, Hyperdrive object or stored secrets.
  - Deploying to Vercel, changing `staging.movx.club`, or migrating external credentials.
  - Rewriting archived Cloudflare ticket history or erasing prior deployment evidence.
  - Changing application routes, user behavior, database schema, authentication rules or Solana contracts.

## Expected behavior and edge cases

- `package.json` and the lockfile contain no direct vinext, Vite adapter, Cloudflare plugin or Wrangler dependency and expose no Cloudflare build/deploy command.
- Standard `npm run dev`, `npm run build`, `npm run start` and the guarded Vercel build remain available.
- Server database access always reads the server-only `DATABASE_URL`; no `cloudflare:workers` module, `MOVX_DATABASE` binding or Hyperdrive-specific transport branch remains.
- Removing Cloudflare configuration does not expose or delete ignored local secret files and does not mutate any external deployment or DNS state.
- Historical archived records retain factual evidence about past Workers releases. Current records distinguish that history from the newly adopted Vercel path.
- The hosted Supabase project remains a valid independent non-production data/Auth environment; only its deployment-provider ownership changes.

## Assumptions, decisions, and dependencies

- DEV0138 supplies the retained Vercel build/configuration contract and passed both configuration-free and configured Next.js builds.
- The standard PostgreSQL configuration already sets one connection, disables prepared statements and requires Transport Layer Security for hosted endpoints, so deleting Hyperdrive does not require a replacement data-access implementation.
- `staging.movx.club`, Cloudflare DNS and the previously released Worker are external state. Repository removal alone does not undeploy them; external teardown requires a separately reviewed destructive operation.
- DEV0055's Supabase work has independent value and will remain current with no direct coordination membership. DEV0056, DEV0093 and COR0004 are Cloudflare-specific and will be cancelled/archived with explicit replacement context.
- Historical references in archived tickets are preserved. Only active product requirements, current plans and links to removed live files are reconciled.

## Implementation plan

1. Remove Cloudflare/vinext/Wrangler source, config, scripts, tests and package scripts/dependencies; regenerate the npm lockfile.
2. Simplify the database environment boundary and focused tests to the standard Next.js/Vercel path.
3. Update current README/specification/Supabase guidance and future-facing current-ticket references.
4. Make DEV0055 independent; cancel/archive DEV0056, DEV0093 and COR0004 with durable reasons and replacement links.
5. Run focused database/deployment tests, the full unit/server suite, lint, type checking, formatting, dependency audit and both standard/Vercel production builds. Record unrelated remaining audit advisories rather than broadening this hosting cleanup into a framework/toolchain upgrade.
6. Self-review the final diff, complete this implementation record and archive DEV0139 only when its acceptance criteria pass.

## Acceptance criteria

- [x] AC1: No live Cloudflare/vinext/Wrangler configuration, package script, direct dependency, deployment script/test, Worker type declaration or Hyperdrive database branch remains in application/runtime code.
- [x] AC2: Standard Next.js and guarded Vercel workflows remain documented and build successfully in their supported configured and public-preview modes.
- [x] AC3: Current product, operations and work records identify Vercel/standard Next.js as the hosted path; Cloudflare-only open records are cancelled/archived without rewriting historical evidence.
- [x] AC4: Hosted Supabase work remains current and independent, using the transaction pooler through `DATABASE_URL` without a Cloudflare binding requirement.
- [x] AC5: Relevant tests, lint, type checking, formatting and production builds pass after the dependency and runtime removal; the dependency audit is run and any unrelated remaining advisories are documented.

## Validation plan

- Search non-historical runtime/source/config files for Cloudflare, vinext, Wrangler, Hyperdrive and `MOVX_DATABASE` references.
- Run focused database configuration and Vercel deployment tests.
- Run `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm audit --omit=dev`, `npm run build` and the configuration-free `npm run build:vercel` command.
- Check Markdown links and ticket-index/current/archive consistency.
- No browser-width, keyboard, database migration or live provider check applies because no interface, schema or external account state changes.

## Implementation record

### Changes and rationale

- Removed the alternative Cloudflare delivery toolchain from `package.json` and the lockfile: vinext, the vinext Cloudflare adapter, Vite and its React/RSC plugins, Wrangler, the Cloudflare Vite plugin and the direct React Server Components webpack package are no longer direct dependencies. The Cloudflare build, preview, validation and deployment commands were removed while the native Next.js and guarded Vercel commands remain.
- Deleted the Worker configuration, adapter configuration, release script, deployment contract test, Worker binding declaration and Hyperdrive environment adapter. Database access now has one explicit server path through `DATABASE_URL`, preserving the existing local-versus-hosted Transport Layer Security behavior and request-owned connection lifecycle.
- Removed obsolete generated-output ignores for `.vinext`, `.wrangler` and `dist`. Existing generated `dist` and `.wrangler` directories were moved to the operating-system Trash so the repository no longer carries ignored Cloudflare output while keeping the cleanup recoverable.
- Reconciled the README, Supabase runbook and MVP architecture contract around native Next.js on Vercel. Current delivery records now point future hosted validation to Vercel; archived records retain the factual Cloudflare commands and release evidence that were true when those tickets were completed.
- Cancelled and archived unfinished Cloudflare-only DEV0056, DEV0093 and COR0004. DEV0055 remains current as independent hosted Supabase work because its project, Auth and database setup are reusable by Vercel.

### Affected files

| File or component                                                                                                   | Change and purpose                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`, `package-lock.json`, `.gitignore`, `eslint.config.mjs`                                              | Remove Cloudflare/vinext/Vite/Wrangler commands, dependencies and generated-output handling while retaining native Next.js/Vercel scripts.                      |
| Deleted `vite.config.ts`, `wrangler.jsonc`, `scripts/deploy-staging-worker.mjs`, `tests/staging-deployment.test.ts` | Remove the adapter, Worker manifest, guarded Wrangler release command and its obsolete contract test.                                                           |
| `src/server/db/client.ts`, `src/server/db/config.ts`, `src/server/db/env.ts`                                        | Collapse runtime database configuration onto server-only `DATABASE_URL`; remove request-scoped Hyperdrive parsing and `cloudflare:workers` detection.           |
| Deleted `src/server/db/cloudflare-env.ts`, `src/types/cloudflare-workers.d.ts`                                      | Remove the `MOVX_DATABASE` Worker binding adapter and ambient Cloudflare declaration.                                                                           |
| `tests/database-config.test.ts`, `tests/boundaries.test.ts`                                                         | Retain standard database/TLS and request-owned connection coverage, remove Hyperdrive-only cases and assert that the removed runtime identifiers do not return. |
| `README.md`, `docs/mvp-spec.md`, `supabase/README.md`                                                               | Make Vercel/native Next.js the sole current hosted path and document the Supabase transaction-pooler `DATABASE_URL` boundary.                                   |
| `tickets/README.md` and affected current/archive work records                                                       | Reconcile ownership and forward-looking hosted validation; cancel/archive Cloudflare-only open work without deleting its historical evidence.                   |

### Decisions and deviations

- 2026-10-07: Pre-implementation review confirmed that the adapter, runtime branch, deployment records and documentation form one atomic hosting-path retirement and do not require separate implementation tickets.
- 2026-10-07: External Cloudflare resources were deliberately left unchanged. Removing a Worker, domain route, Domain Name System record, Access policy, Hyperdrive object or provider-side secret is destructive external work and was not implied by a request to remove repository settings and deployment support.
- 2026-10-07: The production-only audit completed with two high advisories in retained transitive dependencies (`sharp` below 0.35.5 through Next.js and `source-map-js` through Tailwind/PostCSS). They are unrelated to the removed Cloudflare graph, do not make the builds fail, and are recorded instead of expanding this ticket into dependency upgrades. The original broad expectation that every dependency check would be clean was narrowed explicitly in AC5 before completion.

### Contracts, configuration, and operations

- Removed commands: `dev:vinext`, `build:vinext`, `start:vinext`, `deploy:vinext`, `deploy:staging:check`, `deploy:staging:dry-run` and `deploy:staging`.
- Removed runtime/configuration contract: `MOVX_DATABASE`, the Hyperdrive connection object and the `cloudflare:workers` module declaration. `DATABASE_URL` is now the only application database connection input; hosted Vercel configuration continues to require the Supabase transaction pooler on port 6543 through DEV0138's validator.
- No route, browser interface, database schema, migration, authentication rule, Solana contract or public data shape changed.
- No provider-side Worker, route, DNS record, Access policy, Hyperdrive configuration or secret was viewed, changed or deleted. Operators must treat external teardown as a separate task.
- The removed generated `dist` and `.wrangler` directories are recoverable from `/Users/hoangdeveloper/.Trash/fitness-booking-social-app-cloudflare-dist-2026-10-07` and `/Users/hoangdeveloper/.Trash/fitness-booking-social-app-wrangler-state-2026-10-07`.

## Validation results

- Date and environment: 2026-10-07, local macOS workspace, Node.js 24.21.0 and npm 11.19.0.
- `npx tsx --test tests/database-config.test.ts tests/boundaries.test.ts tests/vercel-deployment.test.ts` — passed 16/16 focused tests.
- `npm test` — passed 129 root tests and 28 server tests, 157 total, with zero failures/skips/cancellations.
- `npm run lint`, `npm run typecheck`, `npm run format:check` and `git diff --check` — passed. Route type generation and TypeScript completed without errors.
- `npm run build` — passed the configured native Next.js 16.3.8 production build and generated all 34 listed application/API routes.
- Configuration-free `npm run build:vercel` with all application variables explicitly empty and `VERCEL_ENV=preview` — validator reported `public-preview` with Mapbox and Devnet transactions disabled, then the Next.js build passed.
- Guarded `npm run build:vercel` after parsing the ignored `.env.staging.local` through `@next/env` and setting `VERCEL_ENV=preview` — validator reported `hosted-runtime` with Mapbox and Devnet transactions configured without printing values, then the build passed.
- `npm ls vinext @vinext/cloudflare wrangler @cloudflare/vite-plugin @vitejs/plugin-react @vitejs/plugin-rsc react-server-dom-webpack --depth=0` — returned an empty dependency tree. A source/config search found no live Cloudflare, vinext, Wrangler, Hyperdrive or `MOVX_DATABASE` integration; only an intentional negative test assertion remains outside historical records.
- `npm audit --omit=dev` — completed with two retained high advisories: `sharp <0.35.5` and `source-map-js <=1.2.1`. No removed Cloudflare/vinext package appears in the result; remediation is outside this ticket's hosting-path scope.
- A local checker validated 385 relative Markdown link targets across the 20 changed documentation/work-record files; all targets exist.
- Manual steps and observed outcomes: Not applicable — no external Cloudflare or Vercel state changes are authorized by this repository cleanup.
- Failed, blocked, or not-run checks and reasons: `npm audit --omit=dev` exits nonzero for the two unrelated retained advisories above. Browser, database migration and live provider validation were not run because no interface/schema/provider state changed. An intentional check using `.env.local` was rejected because its loopback database is invalid for Vercel, confirming the guard before the hosted environment file was used.

| Criterion | Evidence                                                                                                                                                                                                                | Result |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Removed all listed configs, scripts, runtime adapters, declarations and direct dependencies; dependency/source searches confirm no live integration remains.                                                            | Passed |
| AC2       | README/specification document native Next.js/Vercel; standard, public-preview and hosted-runtime production builds passed.                                                                                              | Passed |
| AC3       | DEV0056, DEV0093 and COR0004 are cancelled in the archive; current marketplace records point future hosted proof at Vercel while archived release evidence remains intact.                                              | Passed |
| AC4       | DEV0055 remains current and independent; application and operations guidance use the Supabase transaction pooler through `DATABASE_URL` only.                                                                           | Passed |
| AC5       | Focused/full tests, lint, type checking, formatting, link checks and all production-build modes passed. The audit ran and its two unrelated retained high advisories are explicitly recorded as allowed by revised AC5. | Passed |

## Risks, limitations, and follow-ups

- The last deployed Worker and Cloudflare-managed DNS can continue serving until an operator intentionally tears them down or repoints the hostname. Repository cleanup must not be mistaken for external undeployment.
- Vercel readiness is locally proven but no Vercel project/domain/hosted rehearsal exists yet; DEV0125 continues to own the integrated M7 proof.
- Two unrelated high-severity transitive dependency advisories remain in `sharp` and `source-map-js`; a focused dependency-maintenance ticket should update them without forcing the audit's proposed Next.js ESLint downgrade.

## Completion and review references

- Completed: 2026-10-07.
- Commit: This commit — `[DEV0138][DEV0139] Prepare Vercel and retire Cloudflare deployment`.
- Review: Self-reviewed against all five acceptance criteria; no independent review or pull request created.
- Deployment or release: No external deployment change; repository cleanup only.
