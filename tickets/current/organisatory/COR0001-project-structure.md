# Coordination COR0001: Project structure organisation

- Status: In progress
- Created: 2026-09-20
- Last updated: 2026-10-07
- Milestone: Cross-cutting application foundation
- Converted from: Not applicable — created as a coordination record
- Tracked development tickets: completed [DEV0030 — Frontend screen module boundaries](../../archive/frontend/DEV0030-frontend-screen-module-boundaries.md), completed [DEV0031 — Preview data and domain boundaries](../../archive/frontend/DEV0031-preview-data-and-domain-boundaries.md), completed [DEV0015 — Database foundation](../../archive/backend/DEV0015-supabase-database-foundation.md), completed [DEV0025 — Next.js backend boundary](../../archive/backend/DEV0025-nextjs-backend-boundary.md), and completed [DEV0027 — Phantom wallet connection foundation](../../archive/blockchain/DEV0027-phantom-wallet-connection-foundation.md); dedicated server-Solana verification and Anchor/program-client foundation tickets are still required
- Related records: completed structural peers are listed below; cancelled identity/wallet coordination is preserved by [COR0003](../../archive/organisatory/COR0003-account-first-identity-and-wallet-linking.md), completed Vercel readiness is recorded by [DEV0138](../../archive/backend/DEV0138-prepare-vercel-deployment.md), retired Cloudflare delivery is preserved by [COR0004](../../archive/organisatory/COR0004-hosted-staging-deployment.md), cancelled marketplace delivery is preserved by [COR0010](../../archive/organisatory/COR0010-group-funded-coach-marketplace-mvp.md), and completed scheduling-only delivery is recorded by [COR0011](../../archive/organisatory/COR0011-scheduling-only-product.md)

## Objective and context

Coordinate the repository's gradual move from a frontend-preview layout into the agreed modular structure for frontend, Next.js backend, database, and Solana program work. Keep one Next.js/TypeScript package for the MVP, introduce boundaries only when real modules need them, and make file ownership and dependency direction clear enough that future developers can locate behavior without reconstructing prior conversations.

The current app has thin route files under `src/app`, capability-owned screens under `src/features`, reusable interface modules under `src/components`, pure contracts and rules under `src/domain`, explicitly non-authoritative fixture/local-state adapters under `src/features/preview`, a database boundary under `src/server/db`, a browser wallet boundary under `src/solana/client`, and local database artifacts under `supabase`. There is no `src/server/solana`, `src/solana/generated` or `programs` implementation yet. This coordination record owns the cross-ticket structure map only; peer development tickets own actual feature behavior, dependencies, migrations and program code.

## Scope and non-goals

- In scope: maintain the target directory map and dependency direction; inventory current modules before moves; plan bounded frontend/shared-module relocations; coordinate the real `src/server`, `src/solana`, `supabase`, and `programs` boundaries introduced by their owning development tickets; keep README and work records aligned with the structure that actually exists; maintain a flat work map that distinguishes direct delivery, downstream, dependency and historical relationships.
- Out of scope: directly implementing any source, configuration, migration, test or product behavior; a single large refactor; empty scaffolding; moving the Next.js app into an `apps/web` workspace; adding a separate backend service; creating directories that no executable module uses; or introducing another coordination/child hierarchy.

## Expected behavior and edge cases

The target is a modular monolith with four execution environments and one shared pure-code boundary. These are trust and responsibility boundaries, not four repositories or four mutually exclusive top-level folders. A feature may cross them through explicit adapters, but each file and implementation deliverable has one owner.

### Delivered baseline and pending boundaries

The repository must be described from its actual state rather than the final diagram alone:

| Source boundary                                                | Current state                                                                                                                                                                                                                | Owner or next action                                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/app`, `src/features`, `src/components`                    | Present. Routes are thin adapters, complete screens have capability ownership, and reusable UI remains shared.                                                                                                               | Completed [DEV0030 — Frontend screen module boundaries](../../archive/frontend/DEV0030-frontend-screen-module-boundaries.md). Treat this as the frontend baseline; do not move it again merely to make the tree symmetrical.                                                                     |
| `src/domain`, `src/features/discovery`, `src/features/preview` | Present. Pure contracts/rules, discovery operations and non-authoritative preview data/state now have explicit owners; `src/lib` is absent.                                                                                  | Completed [DEV0031 — Preview data and domain boundaries](../../archive/frontend/DEV0031-preview-data-and-domain-boundaries.md). Preserve its injected-data and browser-only adapter boundaries for later persistence work.                                                                       |
| `src/server`, `supabase`                                       | DEV0015 now provides local configuration, migration/seed/tests and `src/server/db` configuration/client/mappings; DEV0025 adds tested server-only/import guards. No feature repository or product database mode exists yet.  | Completed [DEV0015 — Database foundation](../../archive/backend/DEV0015-supabase-database-foundation.md) owns database artifacts/access modules; completed [DEV0025 — Next.js backend boundary](../../archive/backend/DEV0025-nextjs-backend-boundary.md) owns enforcement around those modules. |
| `src/solana`                                                   | Present as a browser-only `src/solana/client` Wallet Standard slice. It owns the compile-time Devnet/Phantom client and connection presentation; no RPC, server verification, generated binding or program directory exists. | Completed [DEV0027 — Phantom wallet connection foundation](../../archive/blockchain/DEV0027-phantom-wallet-connection-foundation.md) owns this first browser-safe client slice and records its real-extension rehearsal.                                                                         |
| `src/server/solana`                                            | Not yet present and not owned by an existing direct ticket.                                                                                                                                                                  | Create a dedicated server verification/projection ticket before adding it.                                                                                                                                                                                                                       |
| `programs`, generated program bindings                         | Not yet present and not owned by an existing direct ticket.                                                                                                                                                                  | Create a dedicated Anchor/program-client foundation ticket before adding them.                                                                                                                                                                                                                   |

### Runtime, trust, and authority boundaries

| Boundary               | Source locations                                                                                            | Responsibility and authority                                                                                                                        | Explicit limit                                                                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Browser frontend       | `src/app/**/page.tsx`, client portions of layouts, `src/features`, `src/components`, `src/features/preview` | Render screens, collect input, maintain browser-only preview state, initiate server or wallet operations and present confirmed results.             | Browser state is not authentication, durable shared state, payment proof, chain finality or server authorization.                 |
| Shared pure domain     | `src/domain`                                                                                                | Define framework-independent values, response contracts and deterministic rules shared by browser and server.                                       | Owns no persistence or runtime authority and performs no browser, database, network, framework or RPC I/O.                        |
| Next.js server         | `src/app/**/route.ts`, Server Actions and server-only modules under `src/server`                            | Authenticate actors, authorize actions, orchestrate workflows, call repositories/external adapters and map trusted results into response contracts. | Thin request adapters do not contain business transitions or raw SQL; the server cannot override on-chain authority.              |
| PostgreSQL/Supabase    | Deployed PostgreSQL plus source-controlled `supabase` migrations, policies and seeds                        | Authoritative durable off-chain state, relational constraints, row security and query integrity.                                                    | Database rows are storage shapes, not UI/domain contracts; schema code does not own application workflows or on-chain settlement. |
| Browser Solana adapter | `src/solana/client` and browser transaction modules                                                         | Establish Phantom Wallet Standard connection state, use public Devnet configuration, construct transactions and request user signatures.            | A wallet connection or submitted signature is not application authentication, ownership binding, finality or settlement.          |
| Server Solana adapter  | `src/server/solana`                                                                                         | Verify signatures, accounts and finality; project confirmed chain events; reconcile chain and database state.                                       | Never prompts a user wallet or handles user private keys; verification does not replace program-side authorization.               |
| Solana program         | `programs`                                                                                                  | Authoritative on-chain accounts, instructions, signer checks and settlement invariants.                                                             | Does not depend on Next.js, PostgreSQL or browser implementation details.                                                         |

### Target source structure

Create a path only with the first executable module or source artifact that uses it:

```text
src/
  app/                    Next.js framework adapters
    **/page.tsx           UI route composition
    **/route.ts           Thin server request/response adapters when needed
  features/               User-facing capability modules
    preview/              Explicit browser-only fixtures and local persistence
  components/             Reusable UI and layout primitives
  domain/                 Pure shared contracts, values and deterministic rules
  server/                 Code that must never enter a browser bundle
    auth/                 Authentication and authorization primitives
    services/             Application workflows
    db/                   Foundation configuration/mappings and feature-owned repositories
    solana/               Trusted chain verification, projection and reconciliation
  solana/                 Browser-safe and runtime-neutral Solana modules
    client/               Wallet discovery, public RPC configuration and transactions
    generated/            Generated program codecs/clients without browser or server secrets
supabase/                 Sole SQL migration history, policies, configuration and seeds
programs/                 Anchor/Rust workspace and on-chain program tests
tests/                    Unit, integration and browser evidence as coverage grows
```

`src/app` is a Next.js framework boundary rather than a synonym for frontend. A `page.tsx` normally composes frontend modules; a `route.ts` is a backend adapter. A Server Component may call an explicit `src/server` query service, but it must not import a repository or database driver directly.

`src/domain` is shared code rather than a fifth deployment. It standardizes values and pure behavior without becoming an authority. PostgreSQL rows and Solana account/event data are mapped into domain or response contracts at their adapters.

`src/solana/generated` is runtime-neutral generated source. Its future Anchor/program-client ticket owns the generation contract. Browser transaction code and server verification may consume those bindings without sharing wallet state, credentials or authority.

### Dependency and import rules

| Source                                      | May depend on                                                                               | Must not depend on or claim                                                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `src/domain`                                | Other pure domain modules                                                                   | React, Next.js, browser APIs, preview fixtures, database/RPC clients, `src/server`, or data authority.                          |
| `src/components`                            | `src/domain` and other shared UI modules                                                    | Complete feature screens, `src/server`, database drivers or feature-specific authority.                                         |
| `src/features`                              | `src/components`, `src/domain`, explicit preview modules and browser-safe `src/solana` APIs | `src/server`, raw database types, server secrets or cross-feature imports; compose multiple features in route adapters instead. |
| `src/app/**/page.tsx` and layouts           | Features/components/domain; explicit server query services only while remaining server-only | Repositories, raw SQL, database drivers or business transitions in route files. Client modules cannot import `src/server`.      |
| Route Handlers and Server Actions           | `src/server` services and domain input/output contracts                                     | Raw SQL, duplicated authorization or core workflow logic in the framework adapter.                                              |
| `src/server/services` and `src/server/auth` | Domain contracts plus repository and external-adapter interfaces                            | React, browser storage, wallet-provider state or trusting browser-supplied identity/role claims.                                |
| `src/server/db`                             | Domain contracts, validated server configuration and database libraries                     | UI/feature modules, browser APIs or exposing database rows as public contracts.                                                 |
| `src/solana/client`                         | Domain values, runtime-neutral generated bindings and browser wallet/RPC libraries          | `src/server`, database code, privileged credentials or claims of verified finality.                                             |
| `src/server/solana`                         | Domain values, runtime-neutral generated bindings, server configuration and RPC libraries   | React, wallet prompts, user signing keys or unverified data as authoritative activity.                                          |
| `supabase` and `programs`                   | Their native migration/program toolchains                                                   | Imports from the Next.js application; integration occurs through database and generated/RPC adapters.                           |

### Direct development work

The records below are flat peers. Each structural deliverable has one owner even when tickets start together or validate a shared integration point. COR0001 coordinates them but does not implement their work.

| Structural deliverable                        | Single owning development ticket                                                                                                     | Concrete ownership                                                                                                                                                                        | Integration relationship                                                                                                    |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Frontend screen ownership                     | Completed [DEV0030 — Frontend screen module boundaries](../../archive/frontend/DEV0030-frontend-screen-module-boundaries.md)         | Delivered capability-owned screens, reusable shared UI and thin Search/How-it-works route adapters under the existing `src/app`, `src/features` and `src/components` boundaries.          | Completed baseline. Later tickets consume it without reopening the move.                                                    |
| Pure domain, discovery and preview separation | Completed [DEV0031 — Preview data and domain boundaries](../../archive/frontend/DEV0031-preview-data-and-domain-boundaries.md)       | Delivered the exact `src/lib` export moves into `src/domain`, `src/features/discovery` and `src/features/preview`, including automated boundary rules and behavior-preservation evidence. | Completed after DEV0030; database-backed features can map into the resulting contracts without importing preview data.      |
| Database schema and access foundation         | Completed [DEV0015 — Supabase database foundation](../../archive/backend/DEV0015-supabase-database-foundation.md)                    | Owns database dependencies, `supabase` configuration/migrations/policies/seeds, server database environment/client modules, Drizzle table mappings and database integration evidence.     | Delivered with DEV0025 but creates no feature repository; DEV0039–DEV0040 and later capability tickets own those consumers. |
| Next.js server boundary enforcement           | Completed [DEV0025 — Next.js backend boundary](../../archive/backend/DEV0025-nextjs-backend-boundary.md)                             | Owns server-only/import enforcement, the service/repository dependency contract, boundary checks and documented thin-adapter rules applied to real server modules.                        | Delivered with DEV0015; validates placement without owning schema, connection, mappings or feature repositories.            |
| Browser wallet/Solana client foundation       | Completed [DEV0027 — Phantom wallet connection foundation](../../archive/blockchain/DEV0027-phantom-wallet-connection-foundation.md) | Delivered the first `src/solana/client` Devnet Wallet Standard connection-state slice and Phantom UI integration.                                                                         | Completed independently of database work; DEV0038 can consume the normalized wallet account.                                |
| Trusted server Solana verification            | Future dedicated server-Solana ticket                                                                                                | Will own `src/server/solana`, finality/account verification, projection and reconciliation boundaries.                                                                                    | **Not yet ticketed.** Create it before the first trusted server chain module.                                               |
| Anchor program and generated-client contract  | Future dedicated Anchor foundation ticket                                                                                            | Will own `programs`, Anchor workspace configuration/tests and the reproducible `src/solana/generated` contract.                                                                           | **Not yet ticketed.** Create it before program or generated-client work.                                                    |

The following records are downstream consumers. They implement product behavior inside established boundaries and are not direct owners of COR0001's structural foundation:

| Downstream ticket                                                                                                         | Relationship to the structure                                                                             |
| ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| [DEV0038 — Phantom Supabase Web3 authentication](../../archive/backend/DEV0038-phantom-supabase-web3-authentication.md)   | Uses DEV0027's browser wallet plus the server boundary to establish and verify the Supabase Auth session. |
| [DEV0039 — Prepared identity and wallet bindings](../../archive/backend/DEV0039-prepared-identity-and-wallet-bindings.md) | Adds prepared identity and wallet-binding mappings and repositories over DEV0015's database boundary.     |
| [DEV0040 — Protected access and database context](../../archive/backend/DEV0040-protected-access-and-database-context.md) | Added the verified transaction-local database context and guarded server/frontend adapters.               |
| [COR0010 — Group-funded coach marketplace MVP](../../archive/organisatory/COR0010-group-funded-coach-marketplace-mvp.md)  | Historical downstream marketplace coordination that used the retained structural boundaries.              |
| [COR0011 — Scheduling-only product branch](../../archive/organisatory/COR0011-scheduling-only-product.md)                 | Completed downstream coordination using the retained frontend/server/database scheduling boundaries.      |

Recommended sequence:

1. Preserve completed DEV0030 as the frontend screen baseline.
2. Preserve completed DEV0031 as the domain/discovery/preview baseline before persistence work replaces preview adapters.
3. Preserve completed DEV0027 as the browser wallet/Solana client baseline.
4. Preserve completed DEV0015 and DEV0025 with separate file ownership and evidence: DEV0015 created the real database artifacts/access modules; DEV0025 supplied and validated the server boundary rules around them.
5. DEV0038 → DEV0039 → DEV0040 completed after DEV0015 and DEV0027. DEV0046 then completed account-first email Auth under COR0003; DEV0047 remains the current personal-wallet owner.
6. Do not restore the pruned club/membership runtime under this coordination record.
7. COR0010 historically owned server-Solana/program/client boundaries; COR0011 now removes those runtime boundaries and retains the scheduling architecture.
8. Complete COR0001 only after every direct structural ticket is completed or explicitly replaced/cancelled and the final tree, import, client-bundle and integration review passes.

Generated Playwright output under `test-results/` is reproducible validation output rather than source or durable review evidence. The root [`.gitignore`](../../../.gitignore) ignores it, and owning tickets retain the observations needed for review.

Directory categories organize ownership; they do not erase cross-boundary flows. Browser modules cannot import `src/server`. Database rows and program accounts do not become UI contracts. User-controlled Phantom wallets sign only after user approval; server verification and the program establish trusted outcomes. Existing files move only through their owning prepared DEV ticket with exact maps and regression evidence.

## Assumptions, decisions, and dependencies

The adopted architecture remains a modular monolith: one root Next.js package, Supabase PostgreSQL/Auth, and a separate Anchor/Rust program boundary. Frontend, backend, database and blockchain describe responsibility and authority rather than four repositories. Introduce an npm workspace only when a second JavaScript runtime or independently consumed package exists.

DEV0015 and DEV0025 completed together with distinct ownership. DEV0015 created database artifacts, environment/connection modules and Drizzle table mappings. DEV0025 created and validated server-only dependency enforcement around them. DEV0015 deliberately created no feature repository: DEV0039 owns prepared identity/binding repositories, DEV0040 owns the verified transaction context, and later capability tickets own product repositories and services. DEV0027 establishes browser-safe Phantom Wallet Standard modules with one normalized connection boundary. Separate delivery tickets own the server-Solana verification and Anchor/program-client work required by current coach packages.

This coordination record does not replace development-ticket plans or evidence and never authorizes implementation. Before any structural implementation edit, create or update the owning peer development ticket, link it here, and record the exact before/after file map. Start structural work through that ticket rather than creating the complete target tree in advance.

## Coordination plan

1. Maintain the reviewed current-to-target inventory above as development tickets refine or deliver it. Record any ownership deviation before moving files.
2. Preserve DEV0030's delivered route/feature/shared-UI boundary and DEV0031's delivered preview/domain/discovery split without reopening either completed move.
3. Apply database foundation ownership through DEV0015: `supabase` contains the sole schema history/policies/seeds and `src/server/db` gains only validated environment/connection modules plus Drizzle table mappings. Add repositories later through their owning capability tickets, beginning with DEV0039/DEV0040 and the scheduling peers coordinated by COR0011.
4. Apply backend-boundary enforcement through DEV0025 around DEV0015's real modules. Later backend tickets add services/authentication/request adapters inside that direction without direct browser-to-database access.
5. Apply browser Solana structure through DEV0027 and later transaction tickets. Keep Wallet Standard/Phantom browser client code under `src/solana/client`, with the Solana Kit wallet plugin as the single connection authority; reserve `src/server/solana` for a future trusted-verification ticket and `src/solana/generated` plus `programs` for a future Anchor/program-client ticket.
6. Apply ticket DEV0032's contributor rule so future coordination records name their direct development tickets, distinguish other relationship types, state delivery order, remain one level deep and never supply commit references.
7. Organise tests when each owning slice adds evidence, update README to describe only directories that exist, validate import direction and build/browser behavior, and maintain this coordination record with development-ticket status and deviations.

## Acceptance criteria

- [ ] AC1: The current-to-target, runtime/authority, source ownership and import maps remain accurate; every structural deliverable has exactly one direct DEV owner or is explicitly blocked on a missing ticket.
- [x] AC2: DEV0030's completed route/feature/shared-UI boundary remains stable; DEV0031 delivers pure-domain, discovery and preview separation without changing public routes, fixture values or storage behavior.
- [x] AC3: Database artifacts, connection modules and table mappings belong to DEV0015; feature repositories belong to their capability tickets; backend-boundary enforcement belongs to DEV0025. Real server modules follow the documented service/repository direction and no privileged dependency enters a client bundle.
- [ ] AC4: Browser Solana, trusted server verification and the Anchor program/generated-client contract remain separate. Their owning tickets deliver only their paths and authority, with source inputs documented and generated/build artifacts ignored.
- [ ] AC5: README, record links and validation commands match the actual repository tree; linked development tickets contain exact move maps, contracts, tests and limitations. Lint, typecheck, build, relevant domain/integration/browser checks, and boundary checks pass for implemented slices.

## Validation plan

Each development ticket validates its own moves and behavior. This coordination record reviews the final repository tree, import graph/boundary enforcement, duplicate domain definitions, Next.js route stability, client bundle isolation, README accuracy, record links and accumulated integration evidence. Do not claim the target structure complete because empty directories exist. Application checks are selected by each affected slice; the final review runs the full established lint, typecheck, build, domain and browser suite plus available database/program checks.

## Progress and integration record

Created on 2026-09-20 to make the previously discussed project-structure plan durable before backend, wallet and program modules are added. The target modular-monolith map, dependency direction, flat development-ticket work map, non-goals and final-review expectations are now recorded here. The [MVP specification](../../../docs/mvp-spec.md), [repository README](../../../README.md), and [ticket index](../../README.md) link this coordination record.

Coordination started on 2026-09-20. The source and test inventory now assigns every existing module to its intended boundary. Completed [DEV0030](../../archive/frontend/DEV0030-frontend-screen-module-boundaries.md) owns screen/route moves, and completed [DEV0031](../../archive/frontend/DEV0031-preview-data-and-domain-boundaries.md) owns the former mixed `src/lib` separation. The related ticket-area work was delivered separately by [DEV0029](../../archive/organisatory/DEV0029-ticket-area-archive-organisation.md).

DEV0030 delivered the first frontend structural slice. Complete Feed, Explore/discovery, Challenge, Event, Class and Profile screens now live under `src/features`; Search and How-it-works routes are thin adapters; shared shell/interface/discovery controls remain under `src/components`. The final import audit found no shared-to-feature or cross-capability feature imports. Eighteen unit tests and 28 desktop/mobile browser scenarios passed, as did lint, typecheck, formatting and a webpack production build; the ticket records the restricted environment's Turbopack IPC limitation.

DEV0031 delivered the second frontend structural slice without moving DEV0030's screens. Catalogue/event contracts and deterministic rules now live under `src/domain`; search and filtering live under Discovery; fixtures, derived preview data, local state and browser storage live under `src/features/preview`; presentation formatters and state-free shared controls remain under `src/components`; and `src/lib` is gone. An automated import-boundary test plus restricted-domain-global lint rules enforce the direction. Nineteen unit/boundary checks and all 28 desktop/mobile browser scenarios passed, along with lint, typecheck, formatting and a webpack production build; the standard Turbopack build again hit the restricted environment's local port-binding limitation. COR0001 remains In progress for its database, server, wallet and unticketed Solana/program deliverables.

The implementation is recorded by commit `[DEV0030] Organize frontend screen modules`; the one-time preceding DEV0035 baseline commit made the previously ignored ticket system durable without mixing application files into that repository-maintenance change.

The root `.gitignore` already contains `/test-results/`. `git ls-files test-results` returned no tracked files, and `git check-ignore -v test-results test-results/example.png` matched that rule. No ignore-file edit was necessary: Playwright screenshots, traces and last-run metadata are reproducible output, while durable observations remain in the owning ticket records.

The DEV0036 architecture refinement changed no source directory, dependency, import, runtime configuration, database, wallet integration, program, application test or deployment. DEV0030 and DEV0031 are now the delivered structural slices; their application changes and evidence stay in those tickets. Link each later development ticket's delivered file map and summarize only cross-ticket integration evidence here.

The repository [README](../../../README.md) links to the detailed specification and describes only the current product at a navigation level. Superseded product-specific work records were pruned under DEV0112 without changing the structural boundaries coordinated here.

The work breakdown assigns each structural deliverable to one owner. DEV0015 owns database artifacts, connection modules and table mappings; DEV0025 owns server-boundary enforcement around those modules. DEV0038–DEV0040 and later backend capability tickets own repositories/services rather than extending a generic foundation repository. DEV0030 and DEV0031 retain their frontend/domain boundaries; DEV0027's wallet boundary is historical on this branch. COR0011's development tickets are the current downstream product consumers.

[Ticket DEV0032](../../archive/organisatory/DEV0032-flat-coordination-record-workflow.md) replaces the earlier parent/child wording with a flat record model. This file is now named and headed as Coordination COR0001; every implementation part maps to one peer development ticket; dependencies, downstream consumers, follow-ups and historical baselines remain separate; and the coordination ID cannot be used in commit subjects. Development tickets retain their own implementation/validation evidence, while this record keeps progress and integration evidence. This workflow change alters no product or runtime contract.

[Ticket DEV0033](../../archive/organisatory/DEV0033-prefixed-work-record-identifiers.md) later introduced separate identifier namespaces. It preserved the numeric portion of every development ticket under a `DEV` prefix and migrated this record from legacy Coordination 0028 to `COR0001`. Current navigation and links now use the prefixed IDs; preserved historical prose may still name the earlier number when it describes work performed before the migration.

[Ticket DEV0034](../../archive/organisatory/DEV0034-explicit-coordination-membership.md) made direct coordination ownership reciprocal and visible in each DEV record's opening metadata. DEV0015, DEV0025, DEV0027, DEV0030 and DEV0031 link directly to this record. This record also declares that it was created as coordination rather than converted from a development ticket.

[Ticket DEV0036](../../archive/organisatory/DEV0036-explicit-architecture-boundaries.md) separates execution location, source ownership, data authority, import direction and ticket ownership. It preserves completed DEV0030, removes joint DEV0015/DEV0025 ownership, distinguishes browser/server/on-chain Solana paths and records the two missing foundation tickets. No application file or runtime behavior changed.

DEV0015's 2026-09-20 pre-implementation refinement fixes its historical ten-table schema, constraints, indexes, seed boundary, roles and default-deny RLS contract. It also supersedes the earlier broad foundation-repository assignment: DEV0015 stops at its SQL, connection modules and Drizzle mappings; DEV0039–DEV0040 and later capability tickets own subsequent feature data and repositories/services. DEV0025 enforces that direction without owning either side's implementation files.

DEV0015/DEV0025 are completed. The real `supabase` migration/seed/test tree and `src/server/db` configuration/client/mappings exist, while automated checks enforce the server-only and preview boundaries. No feature repository or endpoint was pulled into the foundation. The database-only local start, clean CLI reset, second same-database seed, 23-check pgTAP suite, 5-check Drizzle suite, forced-RLS/role checks, lint, typecheck, webpack production build, client-asset inspection and 28-scenario browser regression all passed. No hosted project or product database mode is claimed.

DEV0027 is completed. Its implementation started with the wallet toolchain's Node prerequisite: the repository and local shell now target Node.js 24.21.0 LTS, Node type declarations are aligned, and the unit, lint, type, format, webpack build, Drizzle integration and browser suites pass under that runtime. The first `src/solana/client` slice uses the pinned Solana Kit wallet plugin as the single Phantom/Wallet Standard connection authority, exposes only `solana:devnet`, and integrates accessible loading, missing-wallet, connected and disconnect states into the existing shell. The user completed the real extension rehearsal with no message or transaction signature request; changing Phantom accounts safely disconnected the prior authorization and explicit reconnection selected the new address. No RPC endpoint, balance, application authentication, signature or transaction exists.

## Validation results

- **Planning links/status — passed:** the repository Markdown/ticket validator found 27 unique indexed tickets, 11 current and 16 archived records, and valid file/heading targets across all 45 Markdown files after indexing DEV0030 and DEV0031.
- **Record formatting — passed:** Prettier formatted this record, both direct frontend development tickets and the ticket index; the final check passed.
- **Generated-result ignore check — passed:** `.gitignore` contains the root-scoped `/test-results/` rule; `git ls-files test-results` produced no output, and `git check-ignore -v test-results test-results/example.png` identified `.gitignore:25` for both paths.
- **README description — passed:** Prettier accepted the updated README; the repository Markdown validator resolved its local targets; and a manual comparison against the specification's project status and C01–C03, C07, C09, C13, C16 and C19 confirmed the overview distinguishes the implemented preview from planned backend and on-chain behavior.
- **Work-breakdown clarity — passed:** manually compared the direct and downstream relationships with tickets DEV0015, DEV0025, DEV0027 and DEV0030–DEV0031. Scheduling-only work is assigned through COR0011 rather than this structural coordination; cancelled COR0010 remains historical.
- **Flat coordination policy — passed:** completed [ticket DEV0032](../../archive/organisatory/DEV0032-flat-coordination-record-workflow.md) renamed this record and path, converted its work map to flat peer development tickets, added separate templates, restricted commits to development-ticket IDs and validated 28 indexed records plus all links across 47 Markdown files.
- **Prefixed identifier migration — passed:** completed [ticket DEV0033](../../archive/organisatory/DEV0033-prefixed-work-record-identifiers.md) migrated 28 development records to DEV IDs and this coordination record to COR0001. The final validator found 29 records with matching types, paths and index entries, and resolved links across all 48 Markdown files.
- **Explicit coordination membership — passed:** completed [ticket DEV0034](../../archive/organisatory/DEV0034-explicit-coordination-membership.md) added reciprocal metadata for the five direct DEV members and explicit independent status for all other DEV records. Validation found 29 DEV records with exactly one coordination field and confirmed that this record's tracked-development list matches every direct member.
- **DEV0030 frontend screen boundary — passed:** the completed ticket records the exact move map, clean import direction, successful 18-test unit suite, lint/type/format checks, webpack production build, 28-scenario desktop/mobile browser suite and representative visual review. Public routes and preview behavior remained stable.
- **Explicit architecture boundary review — passed:** completed [DEV0036](../../archive/organisatory/DEV0036-explicit-architecture-boundaries.md) compared this map with the actual post-DEV0030 tree and the four direct draft tickets. Runtime/authority, target-path and import tables now distinguish intentional adapters from conflicting ownership; every existing structural deliverable has one owner, while server-Solana and Anchor/program-client work remain visibly unticketed.
- **DEV0031 domain/preview boundary — passed:** the completed ticket records the exact export map, explicit discovery inputs, preview storage contract, shared-component prop adapters, automated import/global restrictions, successful 19-test unit/boundary suite, lint/type/format checks, webpack production build and 28-scenario desktop/mobile browser suite. Fixture values, public routes and local storage behavior remained stable.
- **Remaining implementation checks — partially run:** completed DEV0015/DEV0025 passed clean database replay, repeated seed, SQL/Drizzle/RLS, unit/boundary, type, lint, webpack production-build, client-asset inspection and browser-regression checks. Completed DEV0027 passed its Node 24 prerequisite, Wallet Standard source/UI, 25-test unit/boundary suite, production build, 30-scenario desktop/mobile browser suite and real Phantom extension rehearsal. The missing server-Solana/Anchor tickets have not delivered their boundaries, so COR0001's AC1, AC4 and AC5 are not complete.

## Risks, limitations, and follow-ups

A large mechanical move would create conflicts and obscure behavioral changes, so remaining implementation must stay incremental after completed DEV0030. The exact Anchor/generated-client layout depends on the selected current toolchain, and a separate worker/package depends on demonstrated runtime needs. Create the server-Solana and Anchor/program-client tickets before their respective paths.

## Completion and review references

- Completed: Not completed.
- Commit: Not applicable — coordination-record IDs are not used in commit subjects. Relevant commits will reference their owning development tickets.
- Review: Planning self-review only; no independent implementation review.
- Deployment: None.
