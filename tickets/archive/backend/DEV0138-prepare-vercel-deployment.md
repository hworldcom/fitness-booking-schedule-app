# Ticket DEV0138: Prepare Vercel deployment

- Status: Completed
- Created: 2026-10-07
- Last updated: 2026-10-07
- Milestone: Marketplace M7 hosted rehearsal prerequisite
- Coordination: None — independent development ticket
- Related records: [DEV0054 — Cloudflare Workers runtime foundation](DEV0054-cloudflare-workers-runtime-foundation.md), [DEV0056 — Staging release and domain rehearsal](DEV0056-staging-release-and-domain-rehearsal.md), [DEV0125 — Rehearse the hosted marketplace loops](../../archive/backend/DEV0125-rehearse-hosted-marketplace-loops.md)

## Objective and context

Make the existing Next.js application straightforward and safe to build on Vercel before the broader application review and product changes begin. The standard Next.js 16 production build already passes locally, and Vercel supports the repository's Node.js 24 major version, but the repository has no Vercel-owned build contract or operator guidance. A deployment can therefore be created with partial, local-only or mismatched runtime variables and fail only when a request reaches authentication, PostgreSQL or Solana code.

This ticket adds deployment configuration, environment preflight validation and setup documentation without changing the product behavior in the [application and infrastructure boundaries](../../../docs/mvp-spec.md#6-application-and-infrastructure-boundaries). It is a prerequisite for, but does not perform, the [M7 hosted rehearsal](../../../docs/mvp-spec.md#12-delivery-milestones).

## Scope and non-goals

- In scope:
  - Add a version-controlled Vercel configuration that uses the native Next.js runtime and a repository-owned build command.
  - Validate Vercel deployment-mode and environment-variable invariants before the Next.js build without logging configured values.
  - Preserve a configuration-free public preview mode while requiring all core hosted runtime values together when database-backed identity is enabled.
  - Reject loopback/insecure hosted endpoints and incomplete Devnet transaction configuration.
  - Document Vercel project setup, environment scoping, Supabase transaction-pooler use, canonical-origin behavior and local verification.
  - Add focused automated coverage and run the relevant repository checks.
- Out of scope:
  - Creating or linking a Vercel account/project, changing DNS, assigning a production domain, or performing a deployment.
  - Provisioning Supabase, Mapbox, Solana RPC or wallet secrets.
  - Replacing the existing Cloudflare staging path or changing its configuration.
  - Changing product screens, application behavior, database schemas or Devnet program behavior.
  - Completing the hosted marketplace rehearsal owned by DEV0125.

## Expected behavior and edge cases

- Vercel recognizes the repository as a Next.js project and runs the guarded build command with the checked-in lockfile and Node.js 24.
- A deployment with none of the core hosted runtime variables builds in the existing public preview mode.
- When any core database/Auth value is supplied, all core values must be present and valid: a remote PostgreSQL URL, HTTPS Supabase URL, publishable key and exact HTTPS site origin.
- A partial core configuration, loopback database, HTTP hosted endpoint, URL containing credentials where none belong, or site URL with a path/query/hash fails before compilation with a variable-specific message that does not print secret values.
- Mapbox remains optional; when configured, it must be a public `pk` token rather than a secret token.
- Solana transaction support remains optional while its integration tickets are unfinished; when any transaction variable is configured, the complete Devnet-only set must be present and the fee sponsor must remain distinct from the recovery authority.
- `NEXT_PUBLIC_SITE_URL` remains an exact same-origin security boundary. Production variables belong on the stable production domain; arbitrary Vercel preview URLs must use public preview mode unless they receive their own exact origin and hosted-service allow-listing.

## Assumptions, decisions, and dependencies

- Vercel's native Next.js runtime is the target; no static export or third-party adapter is required.
- Vercel currently supports Node.js 24 and maps the `engines.node` range to the latest available 24.x runtime. The repository continues to use its existing local Node.js 24.21.0 baseline.
- The hosted PostgreSQL value uses Supabase's transaction pooler. The existing driver already caps each connection at one, disables prepared statements and requires Transport Layer Security (TLS) for non-local hosts.
- The Vercel configuration will not hardcode a function region because the hosted database region has not been supplied; the operator should colocate compute through project settings once that region is known.
- This ticket does not need direct membership in COR0004 because it creates an independent deployment option and does not replace or deliver the Cloudflare staging work map.

## Implementation plan

1. Add a Vercel environment preflight script and a focused test suite covering preview, complete hosted and unsafe/partial configurations.
2. Add a dedicated package build command and minimal `vercel.json` configuration using Vercel's native Next.js preset.
3. Add a Vercel deployment section to the README with setup, environment and validation instructions.
4. Run focused tests, the full unit/server suite, lint, type checking, formatting and production builds with both configuration-free and configured modes.
5. Self-review the diff against this ticket, complete the implementation record and archive the ticket only if every acceptance criterion passes.

## Acceptance criteria

- [x] AC1: A checked-in Vercel configuration selects native Next.js and runs an environment preflight before `next build` without requiring a Vercel-specific runtime adapter.
- [x] AC2: Automated tests prove that configuration-free public preview and complete safe hosted configurations pass, while partial, loopback, insecure and secret-leaking configurations fail without printing configured values.
- [x] AC3: Solana and Mapbox variables remain optional, but configured values are checked for the MVP's Devnet/public-token/authority-separation invariants.
- [x] AC4: The README gives a future operator enough information to import the repository, scope variables, use the Supabase transaction pooler, respect the exact site-origin boundary and verify the build without reconstructing this conversation.
- [x] AC5: Relevant tests, lint, type checking, formatting and Next.js production builds pass on Node.js 24; both configuration-free public preview mode and the developer's complete local runtime configuration compile.

## Validation plan

- Run the focused Vercel deployment test file and confirm accepted/rejected configurations plus secret-safe errors.
- Run `npm test`, `npm run lint`, `npm run typecheck` and `npm run format:check`.
- Run the new Vercel build command with environment values explicitly empty to model a clean public preview deployment.
- Run `npm run build` with the ignored complete local environment to retain the existing configured production-build proof.
- No browser-width, keyboard, database migration or live deployment check applies because this ticket does not change an interface, schema or external environment.

## Implementation record

The repository now has an explicit native Next.js Vercel build contract. It preserves the existing configuration-free public preview mode, but it rejects partial or unsafe hosted settings before Next.js compilation and documents the remaining operator-owned setup. No application route, product behavior, schema or external deployment changed.

### Changes and rationale

Previously, Vercel would infer `npm run build` and accept any environment shape, including a single database/Auth variable or a loopback database that could only fail at request time. `vercel.json` now selects native Next.js and routes builds through `npm run build:vercel`. That command validates complete groups and safe endpoint/authority invariants, reports only variable names and mode labels, and then runs the same `next build` used elsewhere.

The validator keeps Mapbox and Devnet operations optional. When present, a Mapbox value must be a public token; the Solana group must be complete, target Devnet and the reviewed program, use HTTPS endpoints, contain a valid matching 64-byte sponsor keypair and keep recovery authority separate. Core hosted mode similarly requires a dedicated Supabase transaction-pooler login whose project reference matches the configured Supabase URL. Omitting the entire core group intentionally retains the application's public preview state.

The README now separates repository readiness from live deployment and explains exact-origin preview limitations, least-privilege pooled database configuration, environment scoping, region selection and the local guarded-build command.

### Affected files

| File or component                                                                             | Change and purpose                                                                                                                                       |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`vercel.json`](../../../vercel.json)                                                         | Selects Vercel's native Next.js preset and the guarded repository build command without replacing framework defaults.                                    |
| [`package.json`](../../../package.json)                                                       | Adds `build:vercel` while preserving the standard Next.js build and Cloudflare commands.                                                                 |
| [`scripts/validate-vercel-environment.mjs`](../../../scripts/validate-vercel-environment.mjs) | Enforces complete, remote and secret-safe hosted configuration before compilation without printing values.                                               |
| [`tests/vercel-deployment.test.ts`](../../../tests/vercel-deployment.test.ts)                 | Covers public preview, complete hosted, partial, loopback, non-pooler, insecure-token and authority/keypair cases plus the build configuration contract. |
| [`README.md`](../../../README.md#vercel-deployment)                                           | Documents Vercel import settings, environment groups, exact-origin behavior, pooled PostgreSQL setup and local verification.                             |
| [`tickets/README.md`](../../README.md)                                                        | Allocates DEV0138, records completion and advances the available identifier.                                                                             |

### Decisions and deviations

- 2026-10-07: Pre-implementation review confirmed the configuration, validator, tests and documentation form one small deployment-readiness change and do not require splitting into peer tickets.
- 2026-10-07: Kept the Vercel configuration minimal and did not hardcode a function region. Region selection depends on the hosted database location, which is operator state rather than a safe repository default.
- 2026-10-07: Preserved configuration-free public previews rather than requiring hosted credentials for every Vercel build. Exact-origin protected behavior is enabled only when the complete hosted group is supplied for that deployment environment.
- No implementation scope deviations were required.

### Contracts, configuration, and operations

The new repository contract is `npm run build:vercel`, invoked by `vercel.json`; it runs the validator and then `next build`. The standard `npm run build`, Cloudflare scripts and runtime interfaces are unchanged. Hosted database/Auth variables are all-or-none, Mapbox is optional, and the seven documented Solana transaction values are all-or-none. Public `NEXT_PUBLIC_*` values remain build-time inputs; database/RPC/sponsor secrets remain server-only.

No dependency, lockfile, data shape, database schema, migration or product interface changed. No secret was added or printed. Rollback consists of removing `vercel.json`, the build script/validator/tests and the README section; it requires no data rollback.

## Validation results

- Date and environment: 2026-10-07, local macOS workspace, Node.js 24.21.0 and npm 11.19.0.
- Exact commands and outcomes:
  - `npx tsx --test tests/vercel-deployment.test.ts` passed 7/7 focused tests.
  - `npm test` passed 136 general tests and 28 React-server tests, 164 total with no failures.
  - `npm run lint` passed with no ESLint findings.
  - `npm run typecheck` generated route types and passed TypeScript after the test fixture was corrected to declare its required `NODE_ENV`; the first run identified only that fixture typing error.
  - `npm run format:check` passed for the repository's configured source set; targeted Prettier checks also passed for the new deployment files and record.
  - The documented empty-variable `npm run build:vercel` command passed the validator in `public-preview` mode and completed the Next.js 16.3.8 production build.
  - `npm run build` passed with the ignored complete local environment and produced all application routes.
  - `git diff --check` passed.
- Manual steps and observed outcomes: Started the configuration-free production artifact with `npm run start`; `/`, `/explore` and `/api/auth/actor` each returned HTTP 200, and the actor endpoint reported `{"status":"preview"}` as designed.
- Failed, blocked, or not-run checks and reasons: A live Vercel build/deployment, DNS assignment, hosted database/Auth check and Devnet transaction rehearsal were not run because they require external project state and are explicitly outside this ticket. Browser-width and keyboard checks and database migration tests do not apply because no interface or schema changed.

| Criterion | Evidence                                                                                     | Result |
| --------- | -------------------------------------------------------------------------------------------- | ------ |
| AC1       | `vercel.json`, package-script assertion and passing guarded build                            | Passed |
| AC2       | Seven focused tests cover accepted modes, unsafe failures and value redaction                | Passed |
| AC3       | Focused Mapbox and complete/authority/keypair Devnet cases                                   | Passed |
| AC4       | README Vercel section reviewed against the implemented contract                              | Passed |
| AC5       | 164 tests, lint, type check, formatting, two production builds and three-route runtime smoke | Passed |

## Risks, limitations, and follow-ups

- A passing local/Vercel build does not prove hosted Supabase Auth, database reachability, DNS or Devnet transactions; DEV0125 retains that integrated evidence.
- Arbitrary Vercel preview URLs cannot safely reuse a production `NEXT_PUBLIC_SITE_URL`; they remain public preview builds unless separately configured and allow-listed.
- The application currently opens and closes a one-connection Postgres.js client around each repository operation. This is bounded and compatible with the transaction pooler but may warrant performance measurement after real Vercel traffic exists.

## Completion and review references

- Completed: 2026-10-07 — native Vercel configuration, safe preflight, focused coverage, operator guidance and both build modes passed.
- Commit: This commit — `[DEV0138][DEV0139] Prepare Vercel and retire Cloudflare deployment`.
- Review: Self-reviewed against the ticket scope and acceptance criteria; no independent review or pull request created.
- Deployment or release: Not deployed; live Vercel project creation is out of scope.
