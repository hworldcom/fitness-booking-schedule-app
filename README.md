# MovX Club

**Flexible fitness access, built around people.**

MovX Club is testing one social multi-gym membership. A member chooses four participating gyms, uses included check-ins under a Basic or Classic plan, and can optionally share verified participation. Gyms gain a public discovery channel plus transparent usage evidence for a provisional share of membership revenue.

The current MVP deliberately focuses on that membership alone. Membership transfers, standalone passes and resale, ordinary and sponsored events, challenges and reactions are outside scope. The remaining social layer is small: one-way follows and chronological, explicitly shared verified check-ins. Payment, membership activation, gym selection, reservation, attendance, allocation and sharing remain separate states.

Solana provides the membership-state and test-payment layer for the hackathon demo. People create application accounts with email and later link a Phantom wallet for wallet-backed actions; financially active gyms use distinct club wallets operated by individually signed-in administrators. Devnet transactions use test EURC for membership activation and eligible visits to participating gyms outside a member's selected four; test SOL is used only for network/account costs. Product discovery, application identity, permissions and social data stay in the backend.

**Current status:** the responsive Next.js frontend, local Supabase foundation, server-only Drizzle boundary and verified protected-actor context are implemented. Email-code accounts exist, optional personal-wallet linking is in progress and prepared gym-wallet authority awaits its real-Phantom completion rehearsal. Home and How it works explain the focused four-gym Basic/Classic concept with illustrative €80, €150 and €15 demo pricing. Explore, Search, membership setup and My Membership use the same persistent catalogue. DEV0081 implements the local end-to-end activation path: an authoritative quote, simulation-before-approval Phantom transfer of official test EURC, server-only finalized verification/recovery and one fixed active period. Its real funded-Phantom rehearsal is still outstanding, so this is not yet release evidence. An active member can see the fictional schedules for the four frozen gyms and persistently reserve or cancel an included class with atomic capacity and daily-use holds. The backend now issues hashed short-lived arrival requests and lets authenticated same-venue staff atomically confirm private Basic/Classic attendance; the member QR/check-in interface still belongs to DEV0085. Allocation and member-priced non-core visits remain unimplemented under COR0007.

**Start with the [MVP specification](docs/mvp-spec.md).** It is the single current product document, including project status, scope, architecture, milestones, acceptance checks, and the demo script.

## Where information belongs

| Location                                             | Responsibility                                                                                                                                                                                           |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [docs/mvp-spec.md](docs/mvp-spec.md)                 | What we are building, how it should behave, and the delivery plan. Update this file when product/design decisions change.                                                                                |
| [AGENTS.md](AGENTS.md)                               | Contributor rules: ticket-first work, implementation records, validation, and commits.                                                                                                                   |
| [tickets/README.md](tickets/README.md)               | Work-record index and status. Current and archived records are grouped as `frontend`, `backend`, `blockchain`, or `organisatory`; separate templates cover development tickets and coordination records. |
| [docs/archive/2026-09-18/](docs/archive/2026-09-18/) | Superseded drafts retained for historical context. They do not define current requirements.                                                                                                              |

<a id="planned-backend-work"></a>

## Backend and wallet work

The [architecture and delivery boundary](docs/mvp-spec.md#6-architecture-and-delivery-boundaries) uses Supabase PostgreSQL and a bounded Anchor program. Completed [DEV0015](tickets/archive/backend/DEV0015-supabase-database-foundation.md) contains the local configuration, migrations, deterministic seed, database tests and server Drizzle mappings; completed [DEV0025](tickets/archive/backend/DEV0025-nextjs-backend-boundary.md) owns their server-only/import enforcement. Completed DEV0027 and DEV0038–DEV0040 preserve the prepared wallet/auth/protected-context foundation; completed DEV0046 owns open email-code accounts and minimal application profiles; in-progress [DEV0047](tickets/current/backend/DEV0047-personal-wallet-linking-and-replacement.md) adds optional personal-wallet linking. [DEV0041](tickets/current/backend/DEV0041-club-wallet-authorization.md) owns separate gym-wallet authority. [COR0006](tickets/current/organisatory/COR0006-persistent-access-catalogue.md) coordinates the read-only participating-gym and plan catalogue. Completed [DEV0080](tickets/archive/backend/DEV0080-membership-activation-foundation.md) adds the private activation-operation, fixed membership-period and bounded member-state foundation without exposing a payment shortcut. In-progress [DEV0081](tickets/current/blockchain/DEV0081-devnet-membership-activation.md) adds the checked Devnet-EURC transaction, finalized server verification and member-facing activation states; its real-wallet rehearsal remains open. [COR0007](tickets/current/organisatory/COR0007-core-multigym-membership-mvp.md) coordinates activation, check-ins, provisional allocation, gym/member views and the minimal social loop.

## Run locally

Use Node.js 24.21.0 LTS and npm 11. The Node version is pinned in `.nvmrc`, the supported major range is enforced by `package.json`, and dependency versions are pinned in `package-lock.json`. After opening a new terminal, verify `node --version` reports `v24.21.0` before installing dependencies.

The catalogue-backed Explore, Search and membership routes require the local database and restricted server login. Start Docker Desktop, install dependencies, then prepare the database:

```sh
npm ci
npm run db:start
npm run db:reset
npm run db:runtime
```

Put `DATABASE_URL=postgresql://repx_runtime_login:postgres@127.0.0.1:55322/postgres` in ignored `.env.local`, then use the optimized preview for browsing, review or demonstration:

To exercise membership activation, also copy the three Solana values from [`.env.example`](.env.example): `SOLANA_CLUSTER=devnet`, the public browser RPC URL and the separately named server RPC URL. Both RPC URLs may use Solana's public Devnet endpoint locally; never put a credentialed provider URL in `NEXT_PUBLIC_SOLANA_RPC_URL`.

```sh
npm run build
npm run start
```

Home, How it works and Coming soon remain usable without an account or wallet. Email sign-in uses the optional local Auth setup below.

The preview serves already-built pages, avoiding route compilation while you navigate. After changing application code, stop the preview, run `npm run build` again and restart `npm run start` to see the changes.

For active development with automatic updates as you edit:

```sh
npm run dev
```

Development mode compiles routes when first visited and recompiles after changes, so navigation can take several seconds and show Next.js's rendering indicator. This is development overhead; measure demo performance using the optimized preview. The investigation and local timings are recorded in [ticket DEV0021](tickets/archive/frontend/DEV0021-local-preview-navigation-performance.md).

Both modes use port 3100. Stop the existing server with Ctrl+C before switching modes, then refresh your browser once to load the new client. Switching modes on the same address preserves this browser's saved preview data.

## Cloudflare Workers compatibility

The additive vinext toolchain builds the existing Next.js application for Cloudflare Workers while the standard Next.js commands above remain available. It targets the staging-only Worker name `movx-club-staging`; no Worker or custom domain is deployed by the runtime-foundation work.

```sh
npm run dev:vinext
npm run build:vinext
npm run start:vinext
```

The vinext development and built-Worker servers use [localhost:3102](http://localhost:3102), avoiding the standard preview on 3100 and Playwright on 3101. Build the Worker before `start:vinext`; generated `dist/`, `.vinext/` and `.wrangler/` output stays untracked.

The initial staging configuration uses Cloudflare Images for the existing public artwork. Persistent application data/page caching and global route pre-rendering are deliberately disabled until dynamic Auth, profile and database behavior has been validated on the custom staging origin.

A hosted build requires `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, the exact `NEXT_PUBLIC_SITE_URL`, `SOLANA_CLUSTER=devnet` and the deliberately public `NEXT_PUBLIC_SOLANA_RPC_URL`. The staging Worker receives the `MOVX_DATABASE` Hyperdrive binding, independently configured server-only `SOLANA_RPC_URL`, public `SOLANA_FEE_SPONSOR_ADDRESS` and secret `SOLANA_FEE_SPONSOR_KEYPAIR_BASE64`. `DATABASE_URL` remains an ignored local/deployment input for direct development access and Hyperdrive origin validation; the guarded staging deploy does not upload it as a Worker environment binding. The fee sponsor is a dedicated Devnet-only account that pays the membership-activation network fee; the member still authorizes the EURC transfer. Never put the sponsor keypair, database URL, private RPC credentials, migration credentials, Supabase secret/service-role keys or mail credentials in browser-visible variables or committed Wrangler configuration. The current variable contract remains documented in [.env.example](.env.example); hosted Supabase provisioning and release remain separately gated.

The guarded staging deployment reads the approved database, Auth, site and Solana values from the ignored, owner-only `.env.staging.local`, validates the exact staging project/origin, transaction-pooler login and Devnet RPC contract, and passes only those approved names to Wrangler through a temporary owner-only secrets file that is removed after the command. Validation and dry-run modes do not create a Worker; a real deployment also refuses a dirty worktree so the release always identifies a commit:

```sh
npm run deploy:staging:check
npm run deploy:staging:dry-run
npm run deploy:staging
```

The first real release targets only the generated `workers.dev` hostname. Do not add a route or Custom Domain to `wrangler.jsonc`; DNS delegation, Cloudflare Access and `staging.movx.club` remain separate gated steps in DEV0056.

## Local database foundation

The local database is required for catalogue-backed preview routes. Start Docker Desktop and run:

```sh
npm run db:start
npm run db:reset
npm run db:runtime
npm run db:test
npm run test:db
npm run db:lint
```

The isolated local workflow uses database port `55322`, avoiding Supabase's default range. DEV0015's `db:start` launches PostgreSQL only; Auth, the Data API, Realtime, Storage and Studio remain disabled until their owning feature ticket needs them. `db:reset` recreates only this repository's disposable local database from checked-in SQL and seeds it. Do not use a linked reset on hosted data. Run `db:runtime` after each reset to create the restricted loopback application login used by DEV0039. `test:db` uses both the local test credential and that restricted login; application runtime credentials are supplied only through the server-side `DATABASE_URL` shown in `.env.example`. See [the database operations guide](supabase/README.md) for seed-idempotency, role and hosted-migration details.

## Local email sign-in

Sign-in is optional for public browsing. To exercise it, start Docker Desktop. If the database-only stack is already running, stop it first, then launch the Auth-enabled profile and print its public connection values:

```sh
npm run db:stop
npm run auth:start
npm run auth:status
npm run db:runtime
```

Create an ignored `.env.local` from `.env.example`. The status command intentionally prints only public values: copy `API_URL` to `NEXT_PUBLIC_SUPABASE_URL`, copy `PUBLISHABLE_KEY` (or the legacy `ANON_KEY`) to `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and keep `NEXT_PUBLIC_SITE_URL=http://localhost:3100`. Never substitute `SECRET_KEY` or `SERVICE_ROLE_KEY`. Set `DATABASE_URL` to the restricted loopback login documented in [the database operations guide](supabase/README.md). No prepared-person or wallet roster is needed.

Build or restart the app after changing environment variables, open [the exact sign-in route](http://localhost:3100/sign-in), enter an email and open [the local captured mailbox](http://127.0.0.1:55324) to read the six-digit code. The first verified login asks for a display name and atomically creates one user profile plus one ordinary participation row in the active application dataset. Returning codes restore the same profile. No wallet connection or signature is requested.

The local profile captures mail instead of sending it externally, permits 30 test emails per hour and limits code verification attempts. CAPTCHA is intentionally absent on loopback-only development; a public hosted rollout needs reviewed abuse controls, allowed origins, the same OTP template and a custom SMTP provider. The server verifies and refreshes cookie sessions, while the Auth account, application profile and optional future wallet binding stay separate. If Auth, the database or required variables are absent, authenticated state fails closed and public preview routes remain usable.

Recovery uses another code sent to the same verified email. Sign out in the application to clear this browser session. `npm run db:stop` stops the local stack; `npm run db:reset` deliberately removes local Auth users and application profiles, after which they can register again. No hosted project is linked by DEV0046.

## What you can try

The [frontend foundation ticket](tickets/archive/frontend/DEV0008-repx-club-frontend.md) records the original slice. You can explore Home, the focused How it works guide, the persistent fictional gym catalogue, My Membership and Profile, and follow demonstration people in preview mode. Membership setup first saves a versioned browser-local plan/four-gym draft. A signed-in member with the same linked and connected Phantom address can then prepare an authoritative Devnet quote, simulate the exact transfer before approval, submit it and resume finalized server verification after reload. Once active, **My Membership** shows only the included classes at the four frozen gyms; reserving holds a seat and the day's included access, while cancellation releases both. The interface deliberately labels that state as a hold rather than attendance. Membership choices can be cleared from **My Membership → Reset draft** before activation; older social-preview choices can be cleared with **Profile → Reset preview**.

The header wallet control discovers Phantom through Wallet Standard on Solana Devnet. It can connect, show the public address and disconnect without authenticating or linking the wallet. The separate `/sign-in` page uses email OTP for the application account. In-progress DEV0047 adds an explicit message-only proof for optional wallet linking; connection alone still grants no identity, role, payment evidence or automatic account merge.

This is a Devnet hackathon demo using fictional venues and test assets. The activation code can create a test membership only after a real official test-EURC payment is finalized and independently verified; its funded Phantom rehearsal remains outstanding. Class reservations remain demo data and do not prove attendance or create production access, real-money billing, gym allocation or non-core visits. See the [current implementation status](docs/mvp-spec.md) and its acceptance criteria.

## Checks

```sh
npm test
npm run test:auth
npm run test:wallet-auth
npm run test:reservations
npm run lint
npm run typecheck
npm run format:check
npm run build
npm run test:e2e
```

Domain tests cover validation, local state transitions, sharing privacy and storage recovery. `test:auth` requires the Auth-enabled local stack, Mailpit and an already-running configured app on port 3100; it creates disposable email accounts and proves new/returning login, invalid-code recovery, profile isolation and sign-out. `test:wallet-auth` requires that same app to use the local public Supabase values rather than hosted credentials; it creates two disposable accounts and generated test-only Solana keys to exercise the same-origin challenge/proof/link/replace/collision/unlink HTTP path. It never constructs a transaction and does not replace the required real Phantom interface rehearsal. `test:reservations` uses that same local Auth/database/app setup to create a disposable active Basic member, then proves persistent reserve/reload/cancel behavior, keyboard activation and responsive schedule layout before removing its data. Browser tests exercise desktop and mobile layouts and keyboard flows using **installed Google Chrome**. Reset and prepare the local database, export the restricted `DATABASE_URL`, then build; Playwright starts a separate production server on port 3101 and refuses to reuse an existing server, so another local project cannot be mistaken for MovX Club. Browser evidence and failure traces go to ignored `test-results/`. In restricted agent environments, the test runner, build worker and browser/server may require permission to use local IPC/ports.

The database commands above add SQL catalogue/constraint/RLS checks and Drizzle integration coverage. They require the isolated local stack and are intentionally separate from the configuration-free `npm test` preview suite.

## Application structure

- `src/app/`: thin Next.js App Router adapters, shared layout and visual styles.
- `src/features/`: capability-owned Home/feed, Explore/discovery, membership setup/My Membership and profile screens; no standalone event/class product modules remain.
- `src/domain/`: framework-independent gym catalogue and discovery rules; no browser, network or persistence authority.
- `src/features/preview/`: demonstration people and social browser persistence under the legacy compatibility key `repx-club-preview-v1`; never live inventory, authorization, payment proof or a financial ledger. DEV0049 retains that opaque key so the MovX Club rename does not discard existing browser choices.
- `src/solana/client/`: browser-safe, Devnet-only Phantom connection plus the bounded membership transaction builder, exact simulation and signed broadcast adapter; it is never authoritative for activation.
- `src/server/solana/`: server-only RPC configuration, finalized transaction verification and bounded reference recovery; private RPC values never enter client modules or responses.
- `src/auth/`: public Auth/identity response contracts, bounded email/code rules and the browser-side Supabase session/identity clients.
- `src/server/auth/`: server-only Supabase client and verified session boundary; `src/proxy.ts` refreshes session cookies without protecting public routes.
- `src/server/identity/`: server-only application-profile enrollment and lookup service.
- `src/server/catalogue/` and `src/server/db/catalogue/`: strict public catalogue mapping and the narrow read-only database projection.
- `src/server/reservations/` and `src/server/db/reservations/`: private actor-scoped selected-gym schedules plus idempotent, capacity-safe reserve/cancel operations.
- `src/server/db/`: server-only environment parsing, bounded Postgres.js connection, Drizzle mappings and narrow feature repositories.
- `src/components/`: application shell, presentation formatting and reusable accessible interface/discovery controls.
- `supabase/`: local configuration, the sole SQL migration history, deterministic seeds and database tests.
- `tests/`: domain checks and Playwright browser flows.
- `public/`: local branding and artwork. The running-club image was generated for the original preview on 19 September 2026 using OpenAI image generation and exported as WebP. Its people and setting are illustrative. Other graphics are CSS/SVG with Lucide icons. Manrope and Bricolage Grotesque are self-hosted through Fontsource; the app does not fetch external fonts or stock imagery. The [visual asset record](docs/design/DEV0043-assets.md) documents the illustrative studio photos and preferred redesign reference.

The staged frontend/backend/database/blockchain directory plan is tracked by [Coordination COR0001](tickets/current/organisatory/COR0001-project-structure.md). That non-implementation record maps focused peer development tickets and does not claim target directories exist before their owning code is delivered.

Keep product requirements in the specification, workflow rules in `AGENTS.md`, and implementation evidence in tickets. This README owns setup and repository navigation.
