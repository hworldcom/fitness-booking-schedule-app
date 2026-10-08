# MovX Club

**Find a coach. Pick a time. Book your session.**

MovX Club is a focused scheduling application for martial-arts clients and coaches. Guests discover fictional coaches and real published availability. Email-authenticated clients reserve one capacity-one private session directly. Coaches manage their public profile, location, recurring one-hour availability and booked schedule.

This standalone scheduling repository intentionally excludes blockchain, wallets, passes, credits, token payments, group events and social/feed behavior. Historical records and migrations may describe those superseded features, but they do not define the current product or runtime. The separate [fitness-booking-social-app](https://github.com/hworldcom/fitness-booking-social-app) repository preserves the Solana hackathon product.

Start with the [MVP specification](docs/mvp-spec.md), the single current product contract. The scheduling-product split is recorded by completed [COR0011](tickets/archive/organisatory/COR0011-scheduling-only-product.md); hosted deployment and rehearsal remain separate operational work.

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
- email-code accounts, protected profiles and separate client/coach onboarding;
- platform-reviewed coach applications with verified or demo trust labels;
- owner-scoped coach profiles with one public provider-neutral location;
- list-first coach discovery with optional Mapbox enhancement;
- recurring one-hour availability, deterministic dated occurrences and a responsive coach calendar.

Direct scheduling-only booking and runtime cleanup were delivered under COR0011. The former membership, wallet, payment, group-event and social features are not current product surfaces.

## Run locally

Prerequisites are Node.js 24.21.0 LTS, npm 11 and a running Docker engine. The supported Node range is recorded in `package.json` and `.nvmrc`.

```sh
nvm use
npm ci
npm run dev:local
```

`npm run dev:local` is the complete local-development command. It:

- starts or reuses the repository's Supabase PostgreSQL, Auth, Storage and Mailpit services;
- applies pending local migrations without resetting existing local data;
- prepares the restricted application database login;
- idempotently provisions the ordinary local test account `hoang@users.movx.test` without changing its saved avatar;
- derives and injects the loopback database/Auth configuration without writing it to a file;
- starts Next.js at [localhost:3100](http://localhost:3100).

Captured local sign-in emails appear in [Mailpit at 127.0.0.1:55324](http://127.0.0.1:55324). Press `Ctrl-C` to stop Next.js. The reusable Supabase containers stay running; stop them explicitly with `npm run db:stop`.

No `.env.local` is required for the core local application. Create an ignored one from [`.env.example`](.env.example) only for optional settings such as the Mapbox public token. The local command overrides database/Auth/site values with the repository's loopback configuration, so it cannot accidentally start against hosted services.

For a configuration-free production-mode public preview:

```sh
npm run build
npm run start
```

Both modes use [localhost:3100](http://localhost:3100). Development compiles routes on demand; the production preview is better for performance review. A separately started production preview needs the documented `.env.local` values to enable Auth/database behavior because the one-command development values are intentionally not persisted. `npm run db:reset` remains a separate, intentionally destructive command for recreating disposable local data.

## Local email sign-in

Public browsing does not require sign-in. `npm run dev:local` already starts the Auth-enabled stack required for identity and booking. The individual component commands remain available for troubleshooting or custom workflows:

```sh
npm run auth:start
npm run auth:status
npm run db:runtime
npm run dev
```

The one-command workflow reads the local public `API_URL` and `PUBLISHABLE_KEY` (or legacy `ANON_KEY`) internally and does not print or persist private CLI status values. For a manual workflow, copy only those public values to their matching `NEXT_PUBLIC_*` names in `.env.local`, keep `NEXT_PUBLIC_SITE_URL=http://localhost:3100`, and never expose the service-role/secret key.

Open `/sign-in`, request a code and read it from local Mailpit at [127.0.0.1:55324](http://127.0.0.1:55324). The first verified login creates one application profile. `Find a coach` continues as a client; `Become a coach` submits a coach application on the same account. Applicants may prepare a hidden coach profile, but only platform-approved coaches may publish or manage availability.

For ordinary-client testing, sign in with `hoang@users.movx.test`. `npm run dev:local` creates this exact local-only account automatically and preserves its profile and private avatar on later starts. It has no password and no coach authority: request a one-time code on `/sign-in`, then open the message in Mailpit. You can also repair/provision it explicitly with `npm run auth:provision:test-user`. A deliberate `npm run db:reset` recreates the identity on the next start but cannot restore a deleted uploaded image.

To exercise owner flows as the five fictional coaches:

```sh
npm run auth:provision:coaches
```

Use `daniel.park@coaches.movx.test`, `sam.lee@coaches.movx.test`, `nora.klein@coaches.movx.test`, `idris.malik@coaches.movx.test` or `elif.demir@coaches.movx.test` on `/sign-in`. These reserved `.test` addresses are fictional identifiers, not credentials. The command refuses non-loopback targets and is safe to rerun. `npm run db:reset` removes disposable local accounts.

The fictional seed profiles display `Demo coach`; they are never promoted to `Verified coach` by provisioning. Real approval is an owner-operated process until the separate admin-panel ticket is delivered.

## Coach application review

Set `COACH_REVIEW_DATABASE_URL` only in an ignored operator environment or shell to a direct, owner-privileged PostgreSQL connection. Do not add it to Vercel or expose it through `NEXT_PUBLIC_*`; the ordinary `DATABASE_URL` runtime login is intentionally unable to review applications.

Before approving under `movx-identity-application-v1`, the operator must confirm out of band that the applicant controls the email-backed account, the identity evidence matches the applicant and the completed hidden profile has a reasonable display name, bio, discipline and location. This review does not certify licensing, background checks, competence or safety. Do not store identity documents in this database.

Run the command without `--apply` first. It prints a bounded target summary and makes no change:

```sh
npm run coach:review -- \
  --profile-id 00000000-0000-4000-8000-000000000000 \
  --expected pending \
  --decision approved \
  --reason "Identity and completed application reviewed" \
  --reviewer "operator-reference"
```

After checking the exact profile and current status, repeat it with both `--apply` and the exact target confirmation:

```sh
npm run coach:review -- \
  --profile-id 00000000-0000-4000-8000-000000000000 \
  --expected pending \
  --decision approved \
  --reason "Identity and completed application reviewed" \
  --reviewer "operator-reference" \
  --apply \
  --confirm 00000000-0000-4000-8000-000000000000
```

Use `pending → rejected` when the application cannot be approved and `approved → suspended` when existing coach authority must be removed. A rejected applicant may resubmit as a new revision. Exact retries of an applied decision are idempotent; stale or contradictory transitions fail closed. Review events are append-only, so corrections use a valid forward transition rather than deleting or editing evidence.

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
npm run coach:review -- --help
```

The local stack uses port `55322`. `db:reset` recreates only the disposable local database from checked-in migrations/seeds; never run a linked reset against hosted data. Historical tables remain in additive migration history until a separate retention ticket reviews data and rollback requirements.

## Checks

```sh
npm test
npm run test:auth
npm run test:coach-availability
npm run test:profile-images
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
