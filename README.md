# MovX Club

**Find a coach. Pick a time. Book your session.**

MovX Club is a focused scheduling application for martial-arts clients and coaches. Guests discover fictional coaches and real published availability. Email-authenticated clients reserve one capacity-one private session directly. Coaches manage their public profile, location, recurring one-hour availability and booked schedule.

The `scheduling-only` branch intentionally excludes blockchain, wallets, passes, credits, token payments, group events and social/feed behavior. Historical records and migrations may describe those superseded features, but they do not define the current product or runtime.

Start with the [MVP specification](docs/mvp-spec.md), the single current product contract. The local scheduling-only branch delivery is recorded by completed [COR0011](tickets/archive/organisatory/COR0011-scheduling-only-product.md); hosted deployment and rehearsal remain separate operational work.

## Repository guide

| Location                                             | Responsibility                                             |
| ---------------------------------------------------- | ---------------------------------------------------------- |
| [docs/mvp-spec.md](docs/mvp-spec.md)                 | Current scheduling behavior and delivery contract.         |
| [AGENTS.md](AGENTS.md)                               | Contributor workflow, ticket, validation and commit rules. |
| [tickets/README.md](tickets/README.md)               | Current and archived development/coordination records.     |
| [docs/archive/2026-09-18/](docs/archive/2026-09-18/) | Superseded product drafts retained for context only.       |
| [supabase/README.md](supabase/README.md)             | Local database and hosted migration operations.            |

## Current foundation

Delivered reusable foundations include:

- a responsive Next.js application shell and native Vercel build;
- local/hosted Supabase PostgreSQL with a server-only database boundary;
- email-code accounts, protected profiles and self-service coaching activation;
- owner-scoped coach profiles with one public provider-neutral location;
- list-first coach discovery with optional Mapbox enhancement;
- recurring one-hour availability, deterministic dated occurrences and a responsive coach calendar.

Direct scheduling-only booking and runtime cleanup are active under COR0011. The former membership, wallet, payment, group-event and social features are not current product surfaces.

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

Run the standard application:

```sh
npm run dev
# or
npm run build
npm run start
```

Both modes use [localhost:3100](http://localhost:3100). Development compiles routes on demand; the production preview is better for performance review.

## Local email sign-in

Public browsing does not require sign-in. To exercise identity and booking, stop the database-only profile and start the Auth-enabled local stack:

```sh
npm run db:stop
npm run auth:start
npm run auth:status
npm run db:runtime
```

Copy the printed public `API_URL` and `PUBLISHABLE_KEY` (or legacy `ANON_KEY`) to `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local`. Keep `NEXT_PUBLIC_SITE_URL=http://localhost:3100`. Never expose the service-role/secret key.

Open `/sign-in`, request a code and read it from local Mailpit at [127.0.0.1:55324](http://127.0.0.1:55324). The first verified login creates an application profile and offers Find a coach or Offer coaching. Offer coaching records owner-scoped activation and opens setup; it does not publish or verify the coach.

To exercise owner flows as the five fictional coaches:

```sh
npm run auth:provision:coaches
```

Use `daniel.park@coaches.movx.test`, `sam.lee@coaches.movx.test`, `nora.klein@coaches.movx.test`, `idris.malik@coaches.movx.test` or `elif.demir@coaches.movx.test` on `/sign-in`. These reserved `.test` addresses are fictional identifiers, not credentials. The command refuses non-loopback targets and is safe to rerun. `npm run db:reset` removes disposable local accounts.

## Mapbox configuration

Explore remains a usable server-backed coach list without Mapbox. To enable the synchronized map and coach location picker, set `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` in the ignored environment file before building.

Create separate non-default public (`pk`) tokens for local, preview and production use. Grant only required public scopes and restrict each token to approved browser origins. Never place a secret (`sk`) token in `NEXT_PUBLIC_*`, source, logs or tickets.

Independent-place search uses Mapbox Geocoding v6 with `permanent=true` only after explicit submission and confirmation. Permanent result storage requires an eligible Mapbox account. Existing fictional gym coordinates and manual fallback coordinates do not call geocoding.

## Vercel deployment

[vercel.json](vercel.json) selects native Next.js and runs `npm run build:vercel`, which validates hosted settings without printing values before `next build`. Select Node.js 24.x in Vercel, keep the project root at the repository root and do not set a custom output directory.

A configuration-free deployment provides public preview pages. Hosted identity/scheduling requires all four values in the same environment:

```text
DATABASE_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL
```

Use the Supabase transaction pooler on port `6543` with a dedicated application login inheriting `app_runtime`; do not use the database owner. The server connection uses one client per operation, disables prepared statements and requires Transport Layer Security outside local development.

`NEXT_PUBLIC_SITE_URL` is the same-origin boundary for sign-in and scheduling mutations. Generated preview URLs remain configuration-free unless that exact origin has matching Vercel values and Supabase Auth allow-list entries. Mapbox remains optional and uses a separately restricted public token.

Choose a Vercel function region near the hosted Supabase database. Before import or redeploy, reproduce the public-preview guard locally:

```sh
env \
  DATABASE_URL= \
  NEXT_PUBLIC_SUPABASE_URL= \
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= \
  NEXT_PUBLIC_SITE_URL= \
  NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN= \
  npm run build:vercel
```

Project creation, domain assignment, hosted migrations and Auth redirect configuration remain explicit operator actions.

## Database operations

```sh
npm run db:start
npm run db:reset
npm run db:runtime
npm run db:test
npm run test:db
npm run db:lint
```

The local stack uses port `55322`. `db:reset` recreates only the disposable local database from checked-in migrations/seeds; never run a linked reset against hosted data. Historical tables remain in additive migration history until a separate retention ticket reviews data and rollback requirements.

## Checks

```sh
npm test
npm run test:auth
npm run test:coach-availability
npm run lint
npm run typecheck
npm run format:check
npm run build
npm run test:e2e
```

`test:auth` and `test:coach-availability` require the configured Auth-enabled local stack and a running application on port 3100. Database checks require isolated local PostgreSQL. Playwright starts a production server on port 3101 and writes ignored evidence to `test-results/`.

## Application structure

- `src/app/`: thin App Router pages, server actions and shared styles.
- `src/features/`: capability-owned screens and browser behavior.
- `src/domain/`: framework-independent coach, availability and booking rules.
- `src/auth/` and `src/server/auth/`: browser/server Supabase identity boundaries.
- `src/server/identity/` and `src/server/coaches/`: application profile and scheduling services.
- `src/server/db/`: server-only PostgreSQL configuration, schema mappings and narrow actor-scoped repositories.
- `src/mapbox/`: optional browser location adapter; the authoritative list works without it.
- `supabase/`: additive SQL migration history, deterministic seeds and database tests.
- `tests/`: unit, database and browser validation.
- `public/`: local illustrative assets only; no real coach or venue affiliation is implied.

Keep product requirements in the specification, workflow rules in `AGENTS.md`, and implementation evidence in development tickets.
