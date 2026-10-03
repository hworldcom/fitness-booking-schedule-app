# Ticket DEV0025: Next.js backend boundary

- Status: Completed
- Created: 2026-09-20
- Last updated: 2026-09-20
- Milestone: M0 backend foundation
- Coordination: [COR0001 — Project structure](../../current/organisatory/COR0001-project-structure.md)
- Related tickets: DEV0014 — Database and backend plan; implemented with [DEV0015 — Supabase database foundation](DEV0015-supabase-database-foundation.md); establishes the boundary used by COR0002, converted from retired DEV0016, COR0006, converted from retired DEV0017, later-cancelled DEV0018, DEV0023, and later Solana integration tickets

## Objective and context

Keep the MVP application backend in the existing Next.js package while establishing a strict boundary between request adapters, application workflows, database access, and Solana verification. The current repository has a frontend preview and browser-local state but no server application layer. Define and enforce the boundary when the first real backend code is introduced so later authentication, persistence, booking, social, and chain work do not accumulate business logic in route files or client components.

This ticket implements the single-web-package [architecture and delivery boundary](../../../docs/mvp-spec.md#6-architecture-and-delivery-boundaries). It is deliberately paired with ticket DEV0015: start it as the first part of that database foundation, when `src/server` has real configuration and database modules to contain. Do not create an unused directory tree earlier, and do not postpone the boundary until feature endpoints have already been implemented.

## Scope and non-goals

- In scope: establish and enforce the server-only boundary around real `src/server` modules; own client/server import protection and boundary checks; define dependency direction for request adapters, services, repositories, shared domain contracts and external adapters; keep Next.js pages, Route Handlers and Server Actions thin; document where background reconciliation will run and the conditions that justify a separate worker.
- Out of scope: implementing or owning DEV0015's `supabase` schema/migrations/seeds, database configuration or Drizzle table mappings; implementing feature repositories owned by the then-current DEV0016 onward; authentication then owned by DEV0016 and now split under COR0002; persistent product flows owned by later tickets; creating placeholder modules for every future feature; introducing a separate API framework/service; selecting a hosting vendor; running continuous chain listeners; or implementing/deploying a Solana program.

## Expected behavior and edge cases

Server Components, Route Handlers, and Server Actions may adapt Next.js requests and responses, but authorization and business workflows call reusable application services. Database access occurs through server-only repositories; client components cannot import database drivers, privileged configuration, migration credentials, or reconciliation code. Public catalogue reads and protected mutations use explicit service entry points rather than direct browser database access. The existing local preview remains a clearly separate browser-only mode.

Wallet prompts and RPC calls never hold a SQL transaction open. User-controlled wallets continue to sign financial transactions. Browser-safe transaction construction and generated program clients may later live outside `src/server`, while finality checks, financial verification, projections, and reconciliation stay server-only. A lost response, retry, or background invocation must be able to call the same application workflow without duplicating business rules in an HTTP handler.

Short request/response work stays in Next.js. A server command or scheduled invocation may reuse the same services for bounded reconciliation. Create a separately deployed worker only when continuous polling, execution duration, independent scaling, or another runtime requirement is demonstrated and recorded in a follow-up ticket.

## Assumptions, decisions, and dependencies

The adopted MVP decision is one Next.js/TypeScript web package, Supabase PostgreSQL and Auth, and a separate Anchor/Rust program directory. “Backend in Next.js” means the HTTP and application-service layer shares the web package; PostgreSQL and Solana remain independent systems with their own authority. Business database operations go through the Next.js server layer. Browser Supabase usage is limited to the planned Auth integration.

Use `src/server` for modules that must never enter browser bundles. Keep shared, framework-independent value objects and response contracts outside that directory only when both browser and server need them. Do not expose Drizzle rows as the public UI contract. Inspect the installed Next.js version and its bundled/current documentation before choosing exact Server Action, Route Handler, caching, and server-only APIs.

Implementation was authorized on 2026-09-20 and begins together with DEV0015, before its first server configuration or Drizzle module is added. Starting DEV0025 later than DEV0015 would defeat its purpose; starting it without DEV0015 would produce scaffolding without executable behavior. Parallel timing does not create joint ownership: DEV0015 owns database artifacts, connection modules and table mappings, while this ticket owns the guards and dependency contract applied to them. The then-current DEV0016 and later feature tickets own the repositories/services that consume those mappings; COR0002 later split DEV0016's work among DEV0038–DEV0041 without changing this boundary.

## Implementation plan

1. At the start of DEV0015, inspect the installed Next.js version and confirm the supported server-only, Server Component, Route Handler, Server Action, and caching behavior used by the project.
2. As DEV0015 adds its real `src/server/db` environment, client and schema-mapping modules, add `server-only` protection plus an import rule or equivalent build-time check that prevents client modules from reaching server configuration, drivers, mappings or later repositories. Do not create or claim DEV0015's database modules in this ticket.
3. Establish dependency direction in code and documentation: Next.js adapters call application services; services call repositories and external adapters; repositories map PostgreSQL records; browser-safe domain/view contracts contain no secrets or database clients.
4. Keep any request adapter introduced by the paired work limited to input parsing, verified actor/context resolution, service invocation, and response mapping. Do not place business state transitions or raw SQL in `src/app`.
5. Define a callable server command/job entry point only when an owning financial or delivery ticket needs reconciliation. Record measurable extraction triggers before adding a separately deployed worker.
6. Update the README application structure and exact validation commands to describe the modules that actually exist. Record boundary-enforcement files and results here; keep schema, connection, mapping and database-test evidence in DEV0015, and repository evidence in each later owning feature ticket.

## Acceptance criteria

- [x] AC1: All server runtime code introduced by DEV0015 lives behind an explicit `src/server` boundary, each added module supports real database-foundation behavior rather than placeholder scaffolding, and file ownership remains recorded in DEV0015.
- [x] AC2: Client modules cannot import privileged environment parsing, database drivers/repositories, migration credentials, or future reconciliation modules; lint/type/build checks detect a boundary violation and no server secret is included in a browser bundle or log.
- [x] AC3: The implemented dependency direction is documented and observable: framework adapters depend on services, services depend on repositories/adapters, and shared UI contracts do not expose Drizzle row types or accept browser-supplied identity/role authority.
- [x] AC4: The existing explicit local preview still builds and runs without backend configuration. Database mode and server configuration fail clearly when required values are missing instead of silently returning fixtures.
- [x] AC5: README setup/structure and both tickets' implementation records state what exists, how it was verified, and when a separate worker would become necessary; no separate backend service or deployment is claimed.

## Validation plan

Add a focused boundary check that attempts or statically detects a client-to-server import, plus configuration tests that prove missing/malformed values fail without revealing secrets. Run ticket DEV0015's disposable database checks along with lint, typecheck, production build, existing domain tests, and the explicit preview smoke test. Inspect the production client output or framework build diagnostics for accidental server dependency/secret inclusion. If no request adapter or job exists in the foundation slice, record those parts as not applicable rather than adding a fake endpoint or worker solely for this ticket.

## Implementation record

Planning created on 2026-09-20 after reviewing the current frontend, specification, installed Next.js package, and tickets DEV0014–DEV0018. The decision is to keep the application backend in Next.js and introduce its code boundary with the first real backend slice, ticket DEV0015. No source directory, dependency, server endpoint, database connection, environment variable, worker, or deployment was added by this planning change.

Planning refinement, 2026-09-20 ([DEV0036](../organisatory/DEV0036-explicit-architecture-boundaries.md)): this ticket owns server-only/import enforcement, dependency-direction checks and thin-adapter rules. DEV0015 remains the sole owner of `supabase` artifacts and its concrete `src/server/db` foundation modules. The tickets start together but do not duplicate files or implementation evidence.

Planning refinement, 2026-09-20: DEV0015 now owns only database dependencies, migrations/seeds/roles, server environment/client modules, Drizzle table mappings and database tests. The then-current DEV0016 and later feature tickets own repositories/services for their capabilities. COR0002 later assigned DEV0016's planned authentication/access work to DEV0038–DEV0041. This ticket enforces the direction for all of them but implements none of those database files or repositories.

Implementation started on 2026-09-20 around DEV0015's real database modules. `src/server/db/env.ts`, `client.ts` and `schema/index.ts` carry Next.js's `server-only` marker; the environment parser remains separately testable and does not evaluate `DATABASE_URL` until database initialization is requested. No feature repository, request adapter, job or placeholder service was created.

`tests/boundaries.test.ts` now rejects direct client-to-server imports, feature/component imports of `src/server`, server imports of preview fixtures and database-driver imports outside `src/server/db`; it also verifies the privileged entry-point markers. `tests/database-config.test.ts` proves missing/malformed configuration fails with redacted messages, local connections disable TLS and hosted connections require it. README structure and `.env.example` preserve the configuration-free preview boundary.

## Validation results

- **Boundary/configuration tests — passed:** `npm test` passed 23/23 tests, including both server-boundary cases and three database configuration cases. The suite demonstrates current client modules cannot reach `src/server`, database packages stay inside `src/server/db`, server modules cannot depend on preview fixtures and malformed values do not disclose their input.
- **Type safety — passed:** `npm run typecheck` generated Next.js route types and completed `tsc --noEmit` with no errors against the real Drizzle/client modules.
- **Production boundary evidence — passed with a builder limitation:** `npm run lint` passed. Turbopack could not bind its internal CSS-worker port in this environment, so `npx next build --webpack` supplied the production evidence and generated all 14 routes successfully. `.next/static` contains no `DATABASE_URL`, PostgreSQL URL, app role, Drizzle or Postgres.js marker. `npm run test:e2e` passed all 28 desktop/mobile preview scenarios with no database configuration. A request adapter/job check is not applicable because neither was introduced.
- **Paired foundation integration — passed:** DEV0015's database-only start, clean reset, repeat seed, 23-check pgTAP suite, 5-check Drizzle suite and schema lint passed through the protected modules. The final outage check rejects through the real driver rather than falling back to preview fixtures; no endpoint, repository or worker was added to manufacture boundary evidence.

## Risks, limitations, and follow-ups

The exact hosting runtime and Supabase project remain unselected. Next.js request execution may not suit future continuous or long-running reconciliation; introduce a linked worker ticket when real duration, scheduling, or scaling evidence requires it. Solana program organization and generated client bindings require their own bounded M1 ticket before implementation.

## Completion and review references

- Completed: 2026-09-20.
- Commit: Not created.
- Review: Implementation self-review completed; no independent review.
- Deployment: None.
