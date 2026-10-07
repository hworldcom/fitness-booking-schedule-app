# Ticket DEV0054: Cloudflare Workers runtime foundation

- Status: Completed
- Created: 2026-09-23
- Last updated: 2026-09-23
- Milestone: M0 hosted integration environment
- Coordination: [COR0004 — Hosted staging deployment](../organisatory/COR0004-hosted-staging-deployment.md)
- Related records: [DEV0025 — Next.js backend boundary](../../archive/backend/DEV0025-nextjs-backend-boundary.md), [DEV0046 — Email OTP registration and application profiles](../../archive/backend/DEV0046-email-otp-registration-and-application-profiles.md), and DEV0053 — Distinct personal and club guide

## Objective and context

Make the existing Next.js 16 application buildable and runnable on Cloudflare Workers through vinext while retaining the established local Next.js development, build and test workflow. Cloudflare currently recommends vinext for Next.js Workers deployments, but vinext is beta and reimplements the Next.js application programming interface (API), so this repository must prove its own compatibility before deployment.

The user ran `vinext init` on 2026-09-23 before this ticket existed. It generated uncommitted dependency, script, ignore, Vite and Wrangler changes. This ticket owns review and correction of those generated files; their presence is not implementation evidence until validation passes.

Relevant product boundaries are the specification's current [architecture and delivery contract](../../../docs/mvp-spec.md#6-architecture-and-delivery-boundaries). This work changes deployment infrastructure, not product behavior.

## Scope and non-goals

- In scope:
  - Review and normalize the vinext-generated `package.json`, lockfile, Vite, Wrangler and ignore changes.
  - Pin added package versions in line with the repository's reproducible dependency policy.
  - Preserve standard Next.js commands while adding explicitly named vinext/Workers commands.
  - Keep vinext and Workers generated output outside source-control and lint input.
  - Configure the Workers Node.js compatibility runtime required by existing server code.
  - Use Cloudflare Images for the current `next/image` assets, with no application-owned image storage.
  - Keep data/page caching and build-time pre-render-all behavior disabled for the first staging release.
  - Verify public pages, route handlers, Supabase cookie/session plumbing, PostgreSQL client bundling and Solana message-verification code can build and execute in the local Workers runtime.
  - Document required build-time and runtime variable names without values.
- Out of scope:
  - Creating or migrating the hosted Supabase project.
  - Storing deployment credentials, database passwords or Supabase secret/service-role keys.
  - Deploying a Worker, changing DNS or binding `staging.movx.club`.
  - Enabling Hyperdrive, persistent incremental-static-regeneration caching, global prerendering or production deployment.
  - Changing user-facing behavior or resolving unrelated DEV0053 interface work.

## Expected behavior and edge cases

- Existing `npm run dev`, `npm run build`, `npm run start` and test commands continue to work as before.
- Namespaced vinext commands build and serve an equivalent application through the Workers runtime.
- Public routes remain available when hosted Auth/database variables are absent, while authenticated operations continue to fail closed.
- Dynamic account, cookie and database-backed responses are not globally cached or frozen at build time.
- `next/image` requests for the current local WebP artwork use the configured Cloudflare Images binding when running on Workers. Failure or plan limits must not expose private assets; all current sources are public local artwork.
- No committed configuration contains secret values. `DATABASE_URL` remains server-only; `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `NEXT_PUBLIC_SITE_URL` remain the only browser-visible deployment inputs.
- The generated Worker name and commands cannot accidentally imply or target a production release.

## Assumptions, decisions, and dependencies

- Adopted Cloudflare Workers as the deployment target, normal vinext runtime operation without application data/response caching, Cloudflare Images optimization, and no pre-render-all pass. These choices were confirmed during the initializer prompts on 2026-09-23.
- Keep the existing Next.js toolchain alongside vinext until hosted equivalence is demonstrated; migration is additive rather than an immediate replacement.
- Cloudflare's `nodejs_compat` mode is expected to cover current `node:crypto`, `Buffer`, Postgres.js and server-only dependencies, but validation rather than assumption determines acceptance.
- `@solana/kit-plugin-wallet` 0.20.0 publishes separate browser and Node/SSR exports but no `workerd` export. The vinext RSC and SSR environments therefore resolve its Node export under `nodejs_compat`; the browser environment continues to select the browser export. This preserves the package's inert server-rendering wallet snapshot instead of bundling browser wallet discovery into the Worker.
- DEV0053 is committed separately at `7038f2e`. This ticket uses that revision as its application baseline and must not rewrite or claim its interface implementation under DEV0054.
- External references: [Cloudflare Next.js Workers guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/) and [vinext Cloudflare integration](https://github.com/cloudflare/vinext#cloudflare-workers).

## Implementation plan

1. Review `npx vinext check` output and record every warning or compatibility gap.
2. Audit initializer changes against this ticket, pin dependency versions and keep command naming/ports unambiguous alongside the existing Next.js workflow.
3. Review `vite.config.ts` and `wrangler.jsonc` for Cloudflare target safety, Images binding, assets, compatibility date/flags and absence of secrets or premature custom-domain configuration.
4. Configure only the vinext RSC and SSR environments to recognize Node package exports required by browser-oriented packages that provide an explicit server-rendering implementation but omit a `workerd` condition.
5. Build with both Next.js and vinext, then exercise the built Worker locally across representative public and server routes.
6. Run focused unit, type, lint and browser checks required to detect adapter regressions. Record any tests that cannot run and why.
7. Add deployment-variable/setup documentation needed by DEV0056 without inserting environment-specific credentials.
8. Complete the implementation record only after reviewing the final diff against this ticket and unrelated working-tree changes.

## Acceptance criteria

- [x] AC1: The repository contains reviewed, version-pinned vinext/Cloudflare dependencies and minimal Workers configuration with no credentials.
- [x] AC2: Existing Next.js development/build/test commands remain available and pass their relevant regression checks.
- [x] AC3: The vinext production build succeeds and a local Wrangler Worker serves representative public pages and server routes without an unsupported-runtime crash.
- [x] AC4: Authentication/session, database-client and Solana signature-verification modules either pass focused Workers-runtime checks or have a concrete documented blocker that prevents completion.
- [x] AC5: The first staging configuration has no persistent application data/page cache, no global prerender-all pass and no production hostname or production release claim.
- [x] AC6: Required environment-variable names, build/runtime placement and Cloudflare Images behavior are documented without secret values.

## Validation plan

- Run the vinext compatibility scanner and record its complete result.
- Run `npm run build` and the introduced vinext build command.
- Start the built Worker locally with Wrangler and request representative public, sign-in, profile and API paths, including absent-configuration failure behavior.
- Run `npm test`, `npm run lint`, `npm run typecheck` and `npm run format:check`.
- Run focused authentication/wallet tests where their local Supabase prerequisites are available; distinguish adapter validation from tests still using the standard Next.js server.
- Run relevant Playwright browser coverage at desktop and mobile widths against the Workers build if the test harness can target it; otherwise record the missing harness as unfinished acceptance evidence.

## Implementation record

Implementation began with user-run vinext initialization before ticket creation. The generated foundation was reviewed and normalized, and the production Worker bundle builds successfully. The original macOS 13.1 validation host could not run Cloudflare `workerd`, but the user's upgrade to macOS 27.0 removed that environmental blocker. The built Worker now starts locally and passes representative route, API, image and responsive-browser smokes.

### Changes and rationale

- Added an additive vinext/Cloudflare toolchain while retaining the standard Next.js development, build and browser-test commands. The Worker-specific commands use port 3102 and the staging-only Worker name `movx-club-staging`.
- Pinned every added direct dependency, retained Cloudflare Images, `nodejs_compat`, static asset binding, disabled persistent response caching and left global pre-render-all behavior disabled.
- Added Node package-export conditions only to the vinext `rsc` and `ssr` environments. `@solana/kit-plugin-wallet` 0.20.0 provides an inert Node/SSR wallet snapshot and a browser implementation but no `workerd` export, so the default Worker conditions could not resolve either package entry. The browser environment remains unchanged and the complete vinext build now succeeds.
- Excluded generated vinext, Wrangler and `dist/` output from source control and lint traversal. Existing source files remain covered by ESLint.
- Documented the build/runtime variable boundary, local commands, Cloudflare Images decision and staging-only scope without adding values or deployment credentials.

### Affected files

| File or component                   | Change and purpose                                                                                                                                                                                                     |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`, `package-lock.json` | Add exact vinext, Vite, Cloudflare and React Server Components versions plus separate development, build, local-start and deploy commands. Existing Next.js and test scripts remain unchanged.                         |
| `.gitignore`, `eslint.config.mjs`   | Exclude `.vinext/`, `.wrangler/` and `dist/` generated output from version control and lint traversal while retaining source coverage.                                                                                 |
| `vite.config.ts`                    | Configure vinext, Cloudflare Workers, Cloudflare Images and the targeted RSC/SSR Node export condition needed by the wallet package's explicit server implementation.                                                  |
| `wrangler.jsonc`                    | Define the staging-only Worker name, 2026-09-22 compatibility date, `nodejs_compat`, generated server entry, public asset binding and Images binding; it contains no variables, routes, custom domains or credentials. |
| `README.md`                         | Document additive Workers commands, ports, generated output, initial cache/pre-render/Image choices and the public-versus-private environment-variable boundary.                                                       |
| `tickets/README.md` and COR0004     | Register this runtime task beside the separately owned hosted Supabase and integrated release tickets.                                                                                                                 |

### Decisions and deviations

- 2026-09-23: The ticket was created immediately after the interactive initializer changed files, rather than before the first edit. The generated diff is treated as unreviewed input so the ticket can restore a reviewable boundary before further implementation.
- 2026-09-23: Selected Cloudflare, disabled application caching, selected Cloudflare Images and declined pre-rendering all static routes for the initial staging path.
- 2026-09-23: Changed the initializer's generic Worker name from `movx-club` to `movx-club-staging` so this foundation cannot imply a production target.
- 2026-09-23: The first vinext build exposed the wallet package's missing `workerd` export condition. The package's explicit Node build is designed for server rendering and returns a non-operational wallet snapshot, so only the vinext RSC/SSR environments now recognize the `node` condition under Workers `nodejs_compat`; no Solana application logic changed.
- 2026-09-23: The repository-wide browser run found eight failures in pre-existing event/challenge draft controls, saved filters and wallet-modal focus. Those surfaces were not changed by DEV0054; the failure evidence is retained below rather than broadening deployment work into an unrelated interface repair.
- 2026-09-23: The user upgraded the validation host from macOS 13.1 to macOS 27.0, removing the documented `workerd` operating-system blocker. DEV0054 returned to In progress so the built-Worker request and focused browser smokes can resume on the supported host.

### Contracts, configuration, and operations

No schema, route, response or database contract changed. The new package/build contract is Node.js 24 plus the exact dependency versions and commands recorded in `package.json`. Worker builds require the existing public values `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `NEXT_PUBLIC_SITE_URL`; the running Worker additionally requires server-only `DATABASE_URL`. Values, hosted provider setup and deployment secrets remain outside Git and are owned by DEV0055/DEV0056. Rollback is removal of the additive vinext dependencies, scripts and configuration; standard Next.js operation does not depend on them.

## Validation results

Initial validation ran on Node.js 24.21.0 and macOS 13.1.0. Completion validation ran on the same Node.js version and macOS 27.0 with the repository's ignored local `.env.local`; no value was printed or recorded. Generated Worker output remained ignored.

| Criterion | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Result |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| AC1       | Reviewed `package.json`, lockfile, `vite.config.ts` and `wrangler.jsonc`; direct versions are exact, the Worker is named `movx-club-staging`, and configuration contains no variable values, route or custom domain. `npx vinext check` reported 100% compatibility: 6/6 imports, 1/1 config, 2/2 libraries, 14 supported routes and no issues.                                                                                                                                                                                                                                                                    | Passed |
| AC2       | Completion validation repeated `npm test` (49/49), `npm run lint`, `npm run typecheck` and `npm run format:check`; all passed. `npx --no-install next build --webpack` compiled, type-checked and generated all 13 static pages. The default Turbopack `npm run build` was also repeated but the restricted agent environment still denied its helper-process port; the supported webpack build proves the unchanged Next.js production path.                                                                                                                                                                      | Passed |
| AC3       | `npm run build:vinext` completed all five environments and listed the public/dynamic pages plus nine API routes. On macOS 27.0, `npm run start:vinext` started `workerd` on port 3102. `/`, `/explore`, `/challenges` and `/sign-in` returned branded `200` HTML; `/profile` returned the expected safe sign-in redirect; Auth/session, actor and identity APIs returned their bounded signed-out responses with `private, no-store`; and a rendered `/_next/image` request returned `200 image/*`.                                                                                                                | Passed |
| AC4       | The successful RSC/SSR build includes Supabase session code, Postgres.js and both wallet packages after the targeted export-condition fix. The running Worker evaluated and served the Auth/session, actor, identity and personal-wallet route modules; a validly shaped wallet-challenge request failed closed as `401 signed-out` with no transaction or signature request. `npm test` passed all Auth, database-configuration, personal-wallet and club-wallet contract checks. Signed-in hosted database and real-wallet integration remain correctly assigned to DEV0056 rather than this runtime foundation. | Passed |
| AC5       | Reviewed config retains no cache binding, no pre-render-all option, no route/custom domain and only the staging Worker name.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Passed |
| AC6       | README documents Workers commands, Cloudflare Images, disabled cache/pre-render choices and the four-variable build/runtime boundary without values.                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Passed |

Additional regression evidence: `npm run test:e2e` passed 42/50 tests across desktop and mobile. Both viewports passed Auth, authorization, club entry, discovery/guide, public rendering, profile, responsive redesign and wallet-free guidance. Eight tests failed on unchanged UI contracts: event draft save controls, saved challenge filters, challenge draft save controls and wallet-modal initial focus. The focused `tests/browser/discovery.spec.ts` run passed 10/10 after the terminology update owned by DEV0057.

The completion browser smoke launched installed Chrome against the running Worker at both 1440×1040 and 393×852. Both viewports returned `200` for home and Explore, displayed the MovX Club home link, had no horizontal overflow, followed `/profile` to the intended sign-in screen and reported no browser console or page errors.

## Risks, limitations, and follow-ups

- vinext is beta; a compatibility failure may require a reviewed OpenNext fallback rather than application behavior workarounds.
- Cloudflare Images currently has a free transformation allowance but remains an external quota. Staging must verify failure behavior and usage before production planning.
- Serverless PostgreSQL latency and connection reuse are not solved by this ticket. Hyperdrive is a follow-up only if measured staging behavior warrants it.
- The default Turbopack build cannot create its internal helper-process socket in the restricted agent environment; the supported webpack build succeeds, and this limitation is not reproduced in application or Worker execution.
- Wrangler emitted two `Network connection lost` messages when the headless Chrome contexts closed with image work in flight. The Worker remained available, the image requests returned `200`, and both browser passes reported zero console/page errors; no application failure was reproduced.
- The eight pre-existing browser failures need separate interface/test review; they are not evidence of a vinext bundle failure and were not changed under this ticket.
- Next action: complete DEV0055, then let DEV0056 deploy this reviewed runtime with the staging secrets/domain and perform the signed-in hosted rehearsal.

## Completion and review references

- Completed: 2026-09-23 after the macOS 27.0 Worker, API, image and responsive-browser smokes passed.
- Commit: `008be57` records the reviewed Workers runtime foundation; completion evidence will be committed separately under DEV0054.
- Review: No pull request or independent review exists.
- Deployment or release: Not deployed; DEV0056 owns the staging release.
