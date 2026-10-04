# MovX Club

**Find a coach. Buy a pass. Book the session that fits.**

MovX Club is a two-sided hackathon marketplace for martial-arts clients and coaches. The primary flow lets a client buy one or ten coach-specific credits with test USDC on Solana Devnet and reserve an open calendar session. A coach controls the early-cancellation cutoff and decides later requests. The secondary flow lets participants conditionally fund a group event; its program-controlled pool pays the coach only when the published minimum is reached and otherwise permits exact refunds. Profiles, locations, schedules, bookings, requests, proposals, event descriptions, follows and posts remain in the application layer.

The former multi-gym membership product is superseded. Relevant evidence remains in retained reusable foundation and cleanup records, additive migrations, the [reserved legacy-identifier register](tickets/README.md#pruned-legacy-product-identifiers) and Git history; 61 older product records were pruned under [DEV0112](tickets/archive/organisatory/DEV0112-prune-superseded-product-tickets.md). Membership runtime was removed under [DEV0101](tickets/archive/backend/DEV0101-retire-multigym-membership-runtime.md). The earlier private-pass work map was cancelled under [COR0009](tickets/archive/organisatory/COR0009-coach-first-training-package-mvp.md), but a new smaller pass design is now explicitly planned under current tickets rather than reopening that history. Current delivery is coordinated under [COR0010](tickets/current/organisatory/COR0010-group-funded-coach-marketplace-mvp.md); do not infer that every target flow is already implemented.

Start with the [MVP specification](docs/mvp-spec.md). It is the single current product contract, including authority boundaries, milestones, acceptance scenarios and the judge demo.

## Repository guide

| Location                                             | Responsibility                                             |
| ---------------------------------------------------- | ---------------------------------------------------------- |
| [docs/mvp-spec.md](docs/mvp-spec.md)                 | Current marketplace behavior and delivery contract.        |
| [AGENTS.md](AGENTS.md)                               | Contributor workflow, ticket, validation and commit rules. |
| [tickets/README.md](tickets/README.md)               | Current and archived development/coordination records.     |
| [docs/archive/2026-09-18/](docs/archive/2026-09-18/) | Superseded product drafts retained for context only.       |
| [supabase/README.md](supabase/README.md)             | Local database and hosted migration operations.            |

## Current foundation

Delivered reusable foundations include the responsive Next.js application shell, local Supabase/PostgreSQL workflow, server-only database boundary, email-code accounts, protected application profiles, self-service coaching activation, Phantom discovery through Wallet Standard and Cloudflare staging tooling. The optional personal-wallet proof flow is implemented locally under [DEV0047](tickets/current/backend/DEV0047-personal-wallet-linking-and-replacement.md), but remains in progress pending its required real-Phantom and signed-in responsive-keyboard evidence.

Persistent self-declared coach profiles, coach-selected public locations and list-based coach discovery are implemented under [DEV0096](tickets/archive/backend/DEV0096-persist-coach-profiles-and-discovery.md); the protected coach workspace and explicit-slot baseline are implemented under [DEV0104](tickets/archive/backend/DEV0104-publish-weekly-coach-availability.md); [DEV0114](tickets/archive/backend/DEV0114-persist-recurring-coach-availability.md) adds exact one-hour recurring rules plus durable seven-day occurrences; and [DEV0115](tickets/archive/frontend/DEV0115-add-coach-schedule-calendar.md) supplies the responsive coach working-week editor and dated public schedule. One-way follows, coach-only posts, public recent posts and the chronological Following feed are implemented under [DEV0100](tickets/archive/backend/DEV0100-coach-follows-and-chronological-posts.md). Mapbox operational validation remains open under DEV0108. [DEV0127](tickets/archive/blockchain/DEV0127-implement-coach-client-credit-ledger.md) implements and adversarially tests the local pair-ledger purchase contract; [DEV0131](tickets/archive/blockchain/DEV0131-implement-coach-credit-booking-lifecycle.md) adds the local deterministic booking-credit reserve, return and consume lifecycle; [DEV0132](tickets/archive/blockchain/DEV0132-make-coach-pass-operations-platform-funded.md) makes every local coach-pass fee and account-rent charge platform-funded without replacing user authority; and [DEV0128](tickets/archive/backend/DEV0128-persist-credit-backed-private-bookings.md) supplies capacity-one booking persistence, cancellation decisions and actor-scoped credit projections. The client-card interface and Devnet proof remain open under DEV0129 and DEV0130. Requests/proposals and group events remain under DEV0118–DEV0125. Retired gym/membership routes are not current product surfaces.

## Run locally

Use Node.js 24.21.0 LTS and npm 11. The supported Node range is enforced by `package.json` and `.nvmrc`.

```sh
npm ci
npm run db:start
npm run db:reset
npm run db:runtime
```

Create an ignored `.env.local` from [`.env.example`](.env.example) and set the restricted local database connection:

```text
DATABASE_URL=postgresql://repx_runtime_login:postgres@127.0.0.1:55322/postgres
```

For the standard application:

```sh
npm run dev
# or
npm run build
npm run start
```

Both standard modes use [localhost:3100](http://localhost:3100). Development mode compiles routes on demand; the production preview is better for performance review.

## Local email sign-in

Public browsing does not require sign-in. To exercise email identity, stop the database-only profile and start the Auth-enabled local stack:

```sh
npm run db:stop
npm run auth:start
npm run auth:status
npm run db:runtime
```

Copy the printed public `API_URL` and `PUBLISHABLE_KEY` (or legacy `ANON_KEY`) to `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local`. Keep `NEXT_PUBLIC_SITE_URL=http://localhost:3100`. Never expose the service-role/secret key.

Open `/sign-in`, request a code and read it from local Mailpit at [127.0.0.1:55324](http://127.0.0.1:55324). The first verified login creates an application profile, then offers Find a coach or Offer coaching as starting paths. Offer coaching immediately records owner-scoped activation without administrator approval and opens coach-profile setup; it does not publish or verify the coach. Subsequent codes restore the same account. Optional personal-wallet linking is a separate signed-message proof and connecting Phantom alone does not authenticate or activate coaching.

To exercise owner flows as the five existing fictional coaches, provision their passwordless local accounts after `auth:start` and `db:reset`:

```sh
npm run auth:provision:coaches
```

Use `daniel.park@coaches.movx.test`, `sam.lee@coaches.movx.test`, `nora.klein@coaches.movx.test`, `idris.malik@coaches.movx.test` or `elif.demir@coaches.movx.test` on `/sign-in`; request each code normally and read it from Mailpit. These reserved `.test` addresses are fictional identifiers, not credentials. The command refuses non-loopback Auth/database targets, supplies or exposes no password, and converts only the matching seeded local profiles to owner-managed demo records. It is safe to rerun. `npm run db:reset` removes the disposable local accounts and is the supported rollback; this workflow does not create hosted accounts.

## Mapbox configuration

Explore remains a usable server-backed coach list without Mapbox. To enable the synchronized map and coach location picker, set `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` in the ignored environment file before building. Next.js embeds this public value in the browser bundle at build time.

Create separate non-default public (`pk`) tokens for local, staging and production use. Grant only the public scopes required by the configured map style and Geocoding API (`styles:read` and `fonts:read` are required for the map), then restrict each token to its approved browser origin. Include `http://localhost:3100` explicitly for local development; use `https://staging.movx.club` for staging. Never place a secret (`sk`) token in `NEXT_PUBLIC_*`, source files, logs or tickets.

Independent-place search uses an explicit Mapbox Geocoding v6 request with `permanent=true` and `autocomplete=false`; it does not use temporary Search Box results or request device location. Permanent storage requires an eligible Mapbox account with a valid payment method or enterprise agreement. Confirm that eligibility before persisting a searched location. Existing fictional gym coordinates and manual fallback coordinates do not call Mapbox geocoding.

## Solana configuration

Current and planned chain work is Devnet-only. The MovX platform pays every MVP transaction fee and rent-exempt account deposit, so clients, coaches and participants need test USDC for marketplace value but no test SOL. `.env.example` documents the public browser RPC, private server RPC and bounded platform-payer variable names. Credentialed RPC URLs and sponsor keypairs are server-only and must never use a `NEXT_PUBLIC_` prefix or enter committed configuration.

Both payment loops use official Devnet test USDC. Users still authorize and supply the exact pass price or seat contribution; platform sponsorship supplies only SOL fees and account rent and grants no client, coach, participant, recovery or upgrade authority. A pass offer freezes one/ten credits, exact price, coach recipient, authority epoch, purchase window and optional client restriction. The first purchase creates one `CoachClientCredits` program-derived account (PDA) for that coach/client pair; later purchases reuse it. A separate EventPool PDA freezes each group event's price, capacity, deadline and recipient, with deterministic payout or pull-refund behavior. The removed multi-gym EURC contract is not reusable product configuration. No mainnet transaction, production custody, attendance guarantee, dispute resolution or real-money claim is supported.

## Cloudflare staging

The vinext toolchain targets the staging Worker `movx-club-staging` while standard Next.js commands remain available:

```sh
npm run dev:vinext
npm run build:vinext
npm run start:vinext
```

Vinext uses [localhost:3102](http://localhost:3102). Generated `dist/`, `.vinext/` and `.wrangler/` output stays untracked.

The guarded staging workflow reads approved values from ignored `.env.staging.local`, validates the staging project/origin, and refuses a real deployment from a dirty worktree:

```sh
npm run deploy:staging:check
npm run deploy:staging:dry-run
npm run deploy:staging
```

Never commit database URLs, private RPC credentials, Supabase service-role keys, mail credentials or fee-sponsor keypairs.

## Database operations

```sh
npm run db:start
npm run db:reset
npm run db:runtime
npm run db:test
npm run test:db
npm run db:lint
```

The local stack uses port `55322`. `db:reset` recreates only the disposable local database from checked-in migrations/seeds; never run a linked reset against hosted data. Legacy multi-gym tables remain in additive migration history until a separate retention ticket explicitly reviews hosted data and rollback requirements.

## Checks

```sh
npm test
npm run test:auth
npm run test:coach-availability
npm run test:wallet-auth
npm run lint
npm run typecheck
npm run format:check
npm run build
npm run test:e2e
```

`test:auth`, `test:coach-availability` and `test:wallet-auth` require the configured Auth-enabled local stack and an already-running application on port 3100. The coach-availability rehearsal creates a disposable local account and coach profile, then publishes, edits and withdraws one slot while checking its public projection. Database checks require the isolated local database. Playwright starts its own production server on port 3101 and writes ignored evidence to `test-results/`.

## Application structure

- `src/app/`: thin App Router pages, route handlers and shared styles.
- `src/features/`: capability-owned browser behavior and screens.
- `src/domain/`: framework-independent validation and state rules, including future marketplace and event-funding rules.
- `src/auth/` and `src/server/auth/`: browser/server Supabase identity boundaries.
- `src/server/identity/` and `src/server/wallet/`: application profile and personal-wallet proof services.
- `src/server/db/`: server-only PostgreSQL configuration, schema mappings and narrow repositories; request/proposal and group-event persistence arrive under DEV0118 and DEV0120.
- Mapbox remains a browser-side rendering/selection adapter behind a client-only lazy boundary; provider-neutral coach and slot location snapshots remain in PostgreSQL, and list discovery works without Mapbox.
- `src/solana/`: shared chain contracts plus browser-safe Wallet Standard clients; the local coach-pass purchase contract is complete under DEV0127, local booking-credit transitions are complete under DEV0131, platform-funded fees/rent are complete under DEV0132, Devnet integration continues under DEV0130, and group-event funding remains under DEV0121/DEV0122.
- `supabase/`: sole additive SQL migration history, deterministic seeds and database tests.
- `tests/`: unit, integration and browser validation.
- `public/`: local illustrative assets only; no real coach or venue affiliation is implied.

Keep product requirements in the specification, workflow rules in `AGENTS.md`, and implementation evidence in development tickets.
