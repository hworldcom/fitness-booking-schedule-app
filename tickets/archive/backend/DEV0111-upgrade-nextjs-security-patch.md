# Ticket DEV0111: Upgrade the Next.js security patch

- Status: Completed
- Created: 2026-10-03
- Last updated: 2026-10-03
- Milestone: Project maintenance and staging security
- Coordination: None — independent development ticket
- Related records: staging runtime baseline in [DEV0054 — Cloudflare Workers runtime foundation](DEV0054-cloudflare-workers-runtime-foundation.md), hosted release work in [DEV0056 — Staging release and domain rehearsal](../../current/backend/DEV0056-staging-release-and-domain-rehearsal.md), and runtime follow-up [DEV0093 — Reduce Cloudflare authentication and render CPU](../../current/backend/DEV0093-reduce-cloudflare-auth-render-cpu.md)

## Objective and context

Upgrade the pinned Next.js 16.3.5 runtime and matching ESLint configuration to the current 16.3.8 patch. On 2026-10-03, `npm audit --omit=dev` reported a critical Next.js advisory affecting 16.3.5 and identified 16.3.8 as the available fix. Repository search found no `next/og` or `ImageResponse` use, but the vulnerable framework version remains unsuitable for the next public staging rehearsal.

## Scope and non-goals

- In scope: update `next` and `eslint-config-next` from 16.3.5 to exactly 16.3.8; refresh the npm lockfile; verify the standard Next.js build, vinext build and current application checks; record the remaining audit state.
- Out of scope: application behavior changes, React or Solana dependency changes, automatic `npm audit fix --force`, and the larger vinext/@vinext Cloudflare adapter transition from pinned beta versions to 1.0.1.

## Expected behavior and edge cases

All existing routes, authentication boundaries, coach flows and build commands must behave as before. The lockfile must resolve the reviewed Next.js patch and its matching ESLint package. The critical Next.js audit finding must disappear. Any remaining transitive advisory must be recorded honestly and must not be hidden through an unreviewed breaking downgrade or major adapter update.

## Assumptions, decisions, and dependencies

The repository already uses Next.js 16 conventions and the installed 16.3.5 bundled documentation. The version-matched `node_modules/next/AGENTS.md`, Next.js 16 upgrade guide and installation guide were read before implementation. The npm registry reported 16.3.8 for both packages on 2026-10-03. This patch does not require a codemod. The current vinext 1.0.1 release is a separate compatibility decision because the repository pins 1.0.0-beta.11 and `@vinext/cloudflare` 1.0.0-beta.9.

## Implementation plan

1. Update the exact Next.js and ESLint configuration package versions with npm and inspect the lockfile-only dependency changes.
2. Run the production Next.js and vinext builds plus unit, lint, type and formatting checks.
3. Re-run the production dependency audit, record remaining advisories, review the focused diff and complete the ticket only if all acceptance criteria pass.

The scope review found one small implementation ticket sufficient: both direct packages move together as one framework patch, while the independent vinext adapter migration remains explicitly excluded.

## Acceptance criteria

- [x] AC1: `package.json` and `package-lock.json` resolve `next` and `eslint-config-next` at 16.3.8 with no unrelated direct dependency change.
- [x] AC2: `npm audit --omit=dev` no longer reports the critical Next.js advisory; any remaining advisory is recorded with its dependency boundary.
- [x] AC3: Unit, lint, type, formatting, standard production-build and vinext-build validation pass without an application behavior or configuration workaround.
- [x] AC4: The implementation record explains rollback, compatibility and remaining security limitations for the hosted staging path.

## Validation plan

Run `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build`, `npm run build:vinext`, `npm audit --omit=dev` and `git diff --check`. Database, Solana program and live browser rehearsals are not required unless the dependency patch changes their source or the static/build checks expose a relevant regression.

## Implementation record

Implementation started and completed on 2026-10-03 after the scope review confirmed that the critical framework patch could be isolated from the separate vinext adapter upgrade.

### Changes and rationale

Updated the exact `next` and `eslint-config-next` versions from 16.3.5 to 16.3.8 and regenerated the npm lockfile. This removes the critical Next.js production audit finding while preserving the existing React, application, Solana, database and Cloudflare adapter contracts. No source, route or configuration change was required.

### Affected files

| File or component                                 | Change and purpose                                                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| [`package.json`](../../../package.json)           | Pins Next.js and its matching ESLint configuration to 16.3.8.                                                      |
| [`package-lock.json`](../../../package-lock.json) | Resolves the 16.3.8 framework, ESLint plugin, environment package and platform-specific SWC packages.              |
| [`tickets/README.md`](../../README.md)            | Tracks DEV0111 through its implementation lifecycle and advances the next available development-ticket identifier. |

### Decisions and deviations

2026-10-03: Used the exact 16.3.8 patch rather than `latest` or a codemod because the project was already on Next.js 16.3 and the installed documentation identified manual package installation as sufficient. Kept vinext and `@vinext/cloudflare` at their pinned beta versions because moving both adapters to 1.0.1 is a distinct runtime/deployment compatibility change, not a safe audit autofix.

### Contracts, configuration, and operations

No product, data, environment-variable, database, Solana or external API contract changed. Next.js route generation and both production build paths retain their existing commands. Rollback is the exact package/lockfile reversal to 16.3.5, but that would restore the critical audit finding and is therefore not a safe staging-release state.

## Validation results

Validated on macOS with Node.js 24.21.0 and npm 11.19.0.

- `npm ls next eslint-config-next --depth=0` passed and resolved both direct packages at 16.3.8.
- `npm audit --omit=dev` no longer reports the critical Next.js advisory. It exits non-zero with seven remaining high-severity findings in the `@vinext/cloudflare` → `vinext` → `vite-plugin-commonjs`/`vite-plugin-dynamic-import` → `fast-glob`/`micromatch` → `braces` chain. The suggested forced fix would install a breaking vinext version and was not applied.
- `npm test` passed 57/57 unit and boundary tests.
- `npm run lint`, `npm run typecheck`, `npm run format:check` and `git diff --check` passed.
- `npm run build` passed with Next.js 16.3.8 and generated the complete application/API route table without an error.
- `npm run build:vinext` passed all five Vite/vinext build stages and emitted the existing static-analysis notice that some dynamic routes cannot yet be classified automatically.
- Database, Solana and live browser rehearsals were not rerun for this dependency-only patch because no application, schema, program or browser-flow source changed. The immediately preceding integrated-main validation passed 24/24 database integration tests, 129/129 pgTAP assertions and 9/9 Rust tests.

| Criterion | Evidence                                                                                                  | Result |
| --------- | --------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Direct dependency listing and focused package/lockfile diff                                               | Passed |
| AC2       | Production dependency audit removed the critical finding and retained seven documented vinext-chain highs | Passed |
| AC3       | 57 unit tests, lint, typecheck, formatting, Next.js build and vinext build                                | Passed |
| AC4       | Contracts, rollback and remaining advisory boundary recorded above                                        | Passed |

## Risks, limitations, and follow-ups

The vinext dependency chain still contributes seven high-severity production audit findings. Resolving that adapter boundary may require a beta-to-stable upgrade and staging compatibility work; this ticket does not claim those findings are fixed. No other limitation remains for this patch scope.

## Completion and review references

- Completed: 2026-10-03 — Next.js and its ESLint configuration now use 16.3.8, the critical production audit finding is removed, and both supported production builds pass.
- Commit: This commit — `[DEV0111] Upgrade Next.js security patch`.
- Review: Self-reviewed against the focused dependency diff and all acceptance criteria; no independent review.
- Deployment or release: None.
