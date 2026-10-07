# Ticket DEV0142: Retire blockchain and non-scheduling runtime

- Status: Completed
- Created: 2026-10-07
- Last updated: 2026-10-07
- Milestone: Scheduling-only runtime boundary
- Coordination: [COR0011 — Scheduling-only product branch](../organisatory/COR0011-scheduling-only-product.md)
- Related records: follows the scheduling-only contract in [DEV0140](../organisatory/DEV0140-adopt-scheduling-only-contract.md); preserves completed blockchain/social tickets as historical evidence

## Objective and context

Remove live blockchain, wallet, pass/payment, group-event and social/feed implementation from the scheduling-only branch. The current repository still contains Solana programs/generated clients, wallet providers and APIs, chain services, package dependencies, event/social routes, configuration and tests that are outside the requested product.

## Scope and non-goals

- In scope:
  - Remove Solana programs, IDL/generated clients, browser/server chain modules, wallet APIs/providers and chain-specific scripts/tests/configuration.
  - Remove group-event and follow/post runtime modules/routes plus their current schema exports.
  - Remove Solana and Surfpool npm dependencies/scripts and simplify Vercel/environment validation.
  - Keep email Auth, profiles, coach discovery/location, availability, direct booking, database and Vercel foundations.
- Out of scope:
  - Rewriting archived tickets or deleting historical migration files.
  - Dropping provider-side database tables, on-chain programs/accounts or wallet state.
  - Scheduling interface redesign owned by DEV0143.

## Expected behavior and edge cases

- No live route, component, source module, script, package dependency or build configuration imports Solana/wallet code.
- `/events`, `/following`, `/coach/events`, `/coach/posts`, `/devnet-bootstrap` and wallet/Solana API routes are absent.
- Auth and scheduling continue to build without chain environment variables.
- Historical migrations/tickets may contain blockchain terms but are not imported or presented as runtime features.

## Assumptions, decisions, and dependencies

- DEV0140 owns the product decision; DEV0141/DEV0143 own retained booking code and UI.
- Off-chain social is removed because the requested branch is scheduling-only, not merely token-free.
- Existing external Solana and database state is untouched.

## Implementation plan

1. Delete chain/wallet/event/social source routes/modules and program artifacts.
2. Remove related scripts, tests, package scripts/dependencies and regenerate the lockfile.
3. Simplify environment examples/validation and schema exports.
4. Repair retained import boundaries and tests after DEV0141/DEV0143 changes.
5. Search live code/config for blockchain/wallet/event/social references and run full static/build checks.

## Acceptance criteria

- [x] AC1: No live source/config/package dependency or route implements blockchain, wallet, payment/pass, group-event or social/feed behavior.
- [x] AC2: Solana program/client artifacts and chain-specific test/deployment tooling are absent from the branch.
- [x] AC3: Retained Auth, coach discovery, availability, booking and Vercel paths compile and test without blockchain environment values.
- [x] AC4: Historical records/migrations remain intact and no external state is mutated.
- [x] AC5: Dependency, unit/server, lint, type, format and production-build validation passes or records unrelated advisories explicitly.

## Validation plan

Search non-historical source/config/package files for removed boundaries; run `npm install`, `npm test`, lint, type checking, formatting, audit and native/Vercel builds. Database and browser behavior are validated by DEV0141/DEV0143.

## Implementation record

The live repository surface is now scheduling-only. Blockchain programs/generated clients, wallet and transaction APIs, chain services, pass/payment code, group events, follows/posts, obsolete routes and their dedicated tests/tooling were removed. Email Auth, coach profiles/location, list-first discovery, recurring availability, direct booking, PostgreSQL and native Vercel support remain.

### Changes and rationale

- Removed the Anchor/Rust workspace, IDL and generated Codama client plus all browser/server Solana and wallet modules.
- Removed pass/payment and group-event APIs, pages, services, schemas from current exports, social/feed pages and services, and chain-specific rehearsal/integration tests.
- Removed all Solana/Codama/Surfpool npm packages and scripts; the install removed 83 packages before safe transitive audit updates regenerated the lockfile.
- Reduced `.env.example` and Vercel validation to database/Auth plus optional Mapbox settings. Hosted database verification now checks direct-booking privilege instead of wallet-table privilege.
- Replaced runtime boundary assertions so removed routes/directories/dependencies cannot be reintroduced silently. Historical migrations and archived tickets were deliberately preserved.

### Affected files

| File or component                                                                                       | Change and purpose                                                                                |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `programs/`, `clients/`, `idl/`, `Anchor.toml`, `Cargo.toml`, `Cargo.lock`                              | Removed on-chain program/build/generated-client artifacts.                                        |
| `src/solana/`, `src/server/solana/`, wallet/Solana APIs and database adapters                           | Removed every live chain and wallet runtime boundary.                                             |
| Group-event and social routes/features/services/schemas                                                 | Removed non-scheduling product behavior and current schema exports.                               |
| `package.json` and `package-lock.json`                                                                  | Removed chain dependencies/scripts and refreshed safe transitive packages.                        |
| `.env.example`, `scripts/validate-vercel-environment.mjs`, `scripts/verify-hosted-runtime-database.mjs` | Define and verify only retained scheduling infrastructure.                                        |
| `tests/boundaries.test.ts` and obsolete chain/social tests                                              | Enforce the new runtime boundary while deleting tests for removed behavior.                       |
| `supabase/README.md`                                                                                    | Documents current scheduling database/Auth/runtime operations and historical-migration retention. |

### Decisions and deviations

- 2026-10-07: Historical SQL migrations remain replayable records even when they create tables unused by the current runtime; destructive table cleanup is not part of repository retirement.
- 2026-10-07: Removed off-chain follows/posts together with financial and event behavior because the requested branch is scheduling-only, not merely blockchain-free.
- 2026-10-07: Removed the obsolete one-time coach-schema cleanup preflight command; its applied migration remains historical, while current operations document migration replay and direct-booking verification.

### Contracts, configuration, and operations

The runtime no longer accepts or reads any Solana configuration. No external program, wallet, RPC, hosted database table or provider resource was changed. Existing databases may retain historical unused tables until a separately reviewed destructive cleanup.

## Validation results

| Criterion | Evidence                                                                                                                                                                                                                                                          | Result                        |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| AC1       | Boundary tests and source/import searches found no live removed route/module/package import; the production route manifest contains only Auth and scheduling routes.                                                                                              | Passed                        |
| AC2       | Program, generated client, IDL, chain scripts and dedicated chain test files are deleted; package metadata contains no Solana/Codama/Surfpool dependency.                                                                                                         | Passed                        |
| AC3       | Unit/server tests, lint, type checking, native build, guarded Vercel build and 28 desktop/mobile Playwright scenarios pass with no chain settings.                                                                                                                | Passed                        |
| AC4       | All historical migrations and archived tickets remain; only the disposable local Supabase database was reset for validation. No hosted/on-chain state was touched.                                                                                                | Passed                        |
| AC5       | Formatting and `git diff --check` pass; `npm audit --omit=dev` reports zero vulnerabilities. Full `npm audit` retains five high development-only `braces` findings whose offered force fix would downgrade `eslint-config-next` across a breaking major boundary. | Passed with recorded advisory |

## Risks, limitations, and follow-ups

- Historical SQL and archived records still contain removed terminology by design and are not runtime dependencies.
- Full development-dependency audit remains affected by the upstream `braces` advisory through Next's ESLint tooling; the production dependency audit is clean, and the offered breaking forced downgrade was not applied.

## Completion and review references

- Completed: 2026-10-07.
- Commit: Included in `[DEV0140][DEV0141][DEV0142][DEV0143][DEV0144][DEV0145] Adopt scheduling-only product`.
- Review: Implementation and boundary self-review completed; no independent review or pull request created.
- Deployment or release: None.
