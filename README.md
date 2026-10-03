# MovX Club

**Find the right coach. Book a private class. Train on your terms.**

MovX Club is a coach-first hackathon product for independent martial-arts coaches and their clients. Coaches choose one public discovery location, publish capacity-one availability for the coming week and offer one-session and ten-session passes. Clients explore coaches through an accessible list and planned Mapbox view, choose a private slot, buy or use a pass, and keep the credit when a future booking is cancelled. Pass purchase and completed-session balances use test USDC and a Solana Devnet program; profiles, locations, availability, bookings, follows and a small chronological coach feed live in the application layer.

The former multi-gym membership product is superseded. Its additive migrations and archived tickets remain historical evidence, but its membership activation, reservation, check-in, gym-wallet and wallet-card runtime was removed under [DEV0101](./tickets/archive/backend/DEV0101-retire-multigym-membership-runtime.md). The coach-first runtime is planned under [COR0009](tickets/current/organisatory/COR0009-coach-first-training-package-mvp.md); do not infer that every target flow is already implemented.

Start with the [MVP specification](docs/mvp-spec.md). It is the single current product contract, including authority boundaries, milestones, acceptance scenarios and the judge demo.

## Repository guide

| Location                                             | Responsibility                                              |
| ---------------------------------------------------- | ----------------------------------------------------------- |
| [docs/mvp-spec.md](docs/mvp-spec.md)                 | Current coach-first product behavior and delivery contract. |
| [AGENTS.md](AGENTS.md)                               | Contributor workflow, ticket, validation and commit rules.  |
| [tickets/README.md](tickets/README.md)               | Current and archived development/coordination records.      |
| [docs/archive/2026-09-18/](docs/archive/2026-09-18/) | Superseded product drafts retained for context only.        |
| [supabase/README.md](supabase/README.md)             | Local database and hosted migration operations.             |

## Current foundation

Delivered reusable foundations include the responsive Next.js application shell, local Supabase/PostgreSQL workflow, server-only database boundary, email-code accounts, protected application profiles, self-service coaching activation, optional personal-wallet proof flow, Phantom discovery through Wallet Standard and Cloudflare staging tooling.

Persistent self-declared coach profiles, coach-selected public locations and list-based coach discovery are implemented under DEV0096; explicit seven-day availability and the protected coach workspace are implemented under DEV0104. The Mapbox Explore view, one-session/ten-session Offer accounts, test-USDC purchase, TrainingPass state, private booking, completed-session redemption and coach posts are not complete until their COR0009 development tickets record implementation and validation. The public home and coach directory present a truthful coach-first early-access state while those later capabilities are built. Retired gym and membership routes return not found rather than exposing a second product.

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

## Solana configuration

Current and planned chain work is Devnet-only. `.env.example` documents the public browser RPC, private server RPC and bounded fee-sponsor variable names. Credentialed RPC URLs and sponsor keypairs are server-only and must never use a `NEXT_PUBLIC_` prefix or enter committed configuration.

The coach-pass implementation will use official Devnet test USDC. One-session and ten-session purchases create the same non-transferable TrainingPass contract with different initial balances. Booking and cancellation remain off-chain; only a completed booked class decrements the authoritative on-chain balance. The removed multi-gym EURC recipient, quote and card contracts are not reusable product configuration. No mainnet transaction, production custody or real-money claim is supported.

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
- `src/domain/`: framework-independent validation and state rules, including future slot/booking rules.
- `src/auth/` and `src/server/auth/`: browser/server Supabase identity boundaries.
- `src/server/identity/` and `src/server/wallet/`: application profile and personal-wallet proof services.
- `src/server/db/`: server-only PostgreSQL configuration, schema mappings and narrow repositories; availability and booking persistence arrives under DEV0104–DEV0105.
- Planned Mapbox integration remains a browser-side rendering/selection adapter; provider-neutral coach and slot location snapshots remain in PostgreSQL, and list discovery must work without Mapbox.
- `src/solana/`: shared chain contracts plus browser-safe Wallet Standard clients; coach-pass modules arrive under DEV0097–DEV0099.
- `supabase/`: sole additive SQL migration history, deterministic seeds and database tests.
- `tests/`: unit, integration and browser validation.
- `public/`: local illustrative assets only; no real coach or venue affiliation is implied.

Keep product requirements in the specification, workflow rules in `AGENTS.md`, and implementation evidence in development tickets.
