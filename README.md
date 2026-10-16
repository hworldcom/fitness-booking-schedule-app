# MovX Club

**Find a coach. Pick a time. Request your session.**

MovX Club is a focused scheduling application for martial-arts athletes and coaches. Guests discover fictional coaches and real published availability. Email-authenticated athletes request one capacity-one private session, and the coach confirms one athlete before a booking exists. Coaches manage their public profile, training locations, location-aware recurring one-hour availability, request queue and booked schedule.

The delivered application includes private scheduling and the public/athlete group-session interface. The [group-training contract](docs/mvp-spec.md#15-group-training-and-events) is coordinated under [COR0021](tickets/current/organisatory/COR0021-group-training-and-events.md). [DEV0240](tickets/archive/frontend/DEV0240-add-group-event-discovery-and-joining.md) delivers Events discovery, direct seat registration/withdrawal and private Group sessions history with local browser validation. Coach event management and the final combined rehearsal remain DEV0239/DEV0241; deployment is separate. This repository excludes blockchain, wallets, passes, credits, in-app payments, group funding and social/feed behavior. Completed SQL history is preserved in an immutable archive with an equivalent baseline for fresh databases; see [database baseline and existing-environment guidance](supabase/README.md#migration-baseline-and-history). Dedicated excluded-product documents and evidence were pruned under [DEV0225](tickets/archive/organisatory/DEV0225-remove-blockchain-historical-evidence.md); retained scheduling and contributor records remain historical context. The separate [fitness-booking-social-app](https://github.com/hworldcom/fitness-booking-social-app) repository preserves the Solana hackathon product.

The adopted [calendar and effective-availability extension](docs/mvp-spec.md#18-coach-calendar-and-effective-availability) is planned under [COR0023](tickets/current/organisatory/COR0023-coach-calendar-and-availability.md); its runtime is not delivered yet.

Start with the [MVP specification](docs/mvp-spec.md), the single current product contract. The scheduling-product split is recorded by completed [COR0011](tickets/archive/organisatory/COR0011-scheduling-only-product.md); hosted deployment and rehearsal remain separate operational work.

## Repository guide

| Location                                 | Responsibility                                             |
| ---------------------------------------- | ---------------------------------------------------------- |
| [docs/mvp-spec.md](docs/mvp-spec.md)     | Current scheduling behavior and delivery contract.         |
| [AGENTS.md](AGENTS.md)                   | Contributor workflow, ticket, validation and commit rules. |
| [tickets/README.md](tickets/README.md)   | Current and archived development/coordination records.     |
| [supabase/README.md](supabase/README.md) | Local database and hosted migration operations.            |

## Current foundation

Delivered reusable foundations include:

- a responsive Next.js application shell and native Vercel build;
- local/hosted Supabase PostgreSQL with a server-only database boundary;
- email-code accounts, protected profiles and separate athlete/coach onboarding;
- platform-reviewed coach applications with verified or demo trust labels;
- owner-scoped coach profiles with multiple provider-neutral training locations, one active primary base and safe deactivation;
- list-first coach discovery with an OpenFreeMap-backed interactive map;
- location-bound recurring one-hour availability, deterministic dated occurrences and a responsive compatibility calendar pending its location selector.

Direct scheduling-only booking and runtime cleanup were delivered under COR0011. The approval-only request lifecycle, separate coach/athlete interfaces and atomic conversion of one accepted request into the confirmed booking are delivered under completed [COR0016](tickets/archive/organisatory/COR0016-coach-confirmed-booking-requests.md). The former membership, wallet, payment, group-event and social features are not current product surfaces.

The delivered contract permits multiple coach training locations, one coach-selected primary Explore marker and actual-location availability assignments. Profile location management, the location-aware calendar and primary-marker discovery are integrated under completed [COR0014](tickets/archive/organisatory/COR0014-multi-location-coach-scheduling.md).

## Run locally

Prerequisites are Node.js 24.21.0 LTS and npm 11. The supported Node range is recorded in `package.json` and `.nvmrc`.

### Hosted dev (default)

The local application and UAT/test share the confirmed hosted dev project; production uses a separate project. Follow [hosted environment setup](supabase/README.md#separate-hosted-environments) for the dedicated runtime connection and public Auth settings. If setup has not already created the ignored file, copy the placeholder example without replacing existing credentials:

```sh
cp -n .env.development.local.example .env.development.local
nvm use
npm ci
npm run dev
```

Fill the example's placeholders before startup. `npm run dev`, `npm run dev:local` and `npm run dev:hosted` all use the same guarded hosted-dev launcher. They validate the dev project, dedicated runtime login and localhost origin before starting Next.js, with no Docker startup or database creation. Missing or wrong settings fail without falling back to local services. Schema migrations, seeding and account provisioning remain explicit setup operations. An already running server keeps its original settings until its owner restarts it with one of these commands. Dev database connectivity, one real sign-in email and server session verification passed. See the [environment rollout](tickets/current/organisatory/COR0026-separate-hosted-dev-and-production.md) for provisioning status and limits of that check. Planned UAT is `https://test.movx.club`; planned production is `https://movx.club`.

### Explicit Docker test workflow

The separate Docker workflow requires a running Docker engine. Retained databases with older migration history need the [DEV0232 continuity work](tickets/current/organisatory/DEV0232-restore-local-migration-continuity.md); the baseline cleanup does not repair that history automatically.

```sh
nvm use
npm ci
npm run dev:docker
```

`npm run dev:docker` explicitly selects the retained Docker workflow for local integration testing. It:

- starts or reuses the repository's Supabase PostgreSQL, Auth, Storage and Mailpit services;
- applies pending local migrations without resetting existing local data;
- prepares the restricted application database login;
- idempotently provisions the ordinary local test account `hoang@users.movx.test` without changing its saved avatar;
- derives and injects the loopback database/Auth configuration without writing it to a file;
- starts Next.js at [localhost:3100](http://localhost:3100).

Captured local sign-in emails appear in [Mailpit at 127.0.0.1:55324](http://127.0.0.1:55324). Press `Ctrl-C` to stop Next.js. The reusable Supabase containers stay running; stop them explicitly with `npm run db:stop`.

No `.env.local` is required for the core Docker application or the OpenFreeMap-backed Explore map. Create an ignored one from [`.env.example`](.env.example) only for optional settings such as the Geoapify public search key. The Docker command overrides database/Auth/site values with the repository's loopback configuration, so it cannot accidentally start against hosted services.

For a configuration-free production-mode public preview:

```sh
npm run build
npm run start
```

Both modes use [localhost:3100](http://localhost:3100). Development compiles routes on demand; the production preview is better for performance review. A separately started production preview needs the documented `.env.local` values to enable Auth/database behavior because the one-command development values are intentionally not persisted. `npm run db:reset` remains a separate, intentionally destructive command for recreating disposable local data.

## Local email sign-in

Public browsing does not require sign-in. Normal development uses the hosted dev project's configured email Auth. The Docker-specific test instructions below use local Mailpit and require the explicit Docker workflow:

```sh
npm run dev:docker
```

The explicit Docker command reads the local public `API_URL` and `PUBLISHABLE_KEY` (or legacy `ANON_KEY`) internally, injects loopback settings for that process and does not print or persist private CLI status values. Keep the shared hosted-dev file unchanged; never copy local test or service-role/secret keys into it.

Open `/sign-in`, request a code and read it from local Mailpit at [127.0.0.1:55324](http://127.0.0.1:55324). The first verified login creates one application profile. `Find a coach` continues as an athlete; `Become a coach` submits a coach application on the same account. Applicants may prepare a hidden coach profile, but only platform-approved coaches may publish or manage availability.

For Docker athlete-account testing, sign in with `hoang@users.movx.test`. Only `npm run dev:docker` creates this exact local-only account automatically and preserves its profile and private avatar on later starts. It has no password and no coach authority: request a one-time code on `/sign-in`, then open the message in Mailpit. You can also repair/provision it explicitly with `npm run auth:provision:test-user`. A deliberate `npm run db:reset` recreates the identity on the next Docker start but cannot restore a deleted uploaded image. These reserved `.test` accounts are not provisioned on hosted dev.

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

## Map and location-search configuration

Explore uses MapLibre GL JS with OpenFreeMap's public style and requires no map API key. The server-backed coach list remains authoritative and usable if map tiles, WebGL or the provider are unavailable.

To enable coach-facing gym, dojo, sports-club and public-place search, set `NEXT_PUBLIC_GEOAPIFY_API_KEY` in the ignored environment file before building. Create separate browser keys for local, preview and production use and restrict each key to the approved origins in Geoapify. Public browser keys are intentionally visible; never commit a populated value or record it in logs or tickets.

One explicit search checks Geoapify's Geocoding and Places APIs for bounded Berlin-biased address/place matches and named fitness facilities. MovX stores only the result the coach explicitly selects and confirms; Geoapify permits storage with required attribution. Search consumes the account's daily credits, while map browsing uses OpenFreeMap independently. Existing fictional gym coordinates and manual fallback coordinates call neither search API.

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

`NEXT_PUBLIC_SITE_URL` is the same-origin boundary for sign-in and scheduling mutations. Generated preview URLs remain configuration-free unless that exact origin has matching Vercel values and Supabase Auth allow-list entries. OpenFreeMap needs no environment value; Geoapify search remains optional and uses a separately origin-restricted public key.

Choose a Vercel function region near the hosted Supabase database. Before import or redeploy, reproduce the public-preview guard locally:

```sh
env \
  DATABASE_URL= \
  NEXT_PUBLIC_SUPABASE_URL= \
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= \
  NEXT_PUBLIC_SITE_URL= \
  NEXT_PUBLIC_GEOAPIFY_API_KEY= \
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

The local stack uses port `55322`. `db:reset` recreates only an explicitly disposable local database from the active baseline/forward migrations and complete seed; never run a linked reset against hosted data. Retained databases with old migration ledgers require the [documented transition review](supabase/README.md#existing-databases). Historical tables remain compatible schema objects until a separate retention ticket reviews data and rollback requirements. `node scripts/rehearse-database-baseline.mjs` validates the frozen baseline and full seed in its own disposable databases.

## Checks

```sh
npm test
npm run test:auth
npm run test:coach-availability
npm run test:coach-availability-hosted -- --environment dev --check
npm run test:coach-locations
npm run test:coach-requests
npm run test:coach-connections
npm run test:athlete-connections
npm run test:private-messages
npm run test:group-discovery
npm run test:coach-events-ui
npm run test:client-requests
npm run test:profile-images
npm run lint
npm run typecheck
npm run format:check
npm run build
npm run test:e2e
```

`test:coach-availability-hosted -- --environment dev --check` checks the hosted-dev ledger and restricted runtime and refuses another rehearsal's temporary accounts. `--run` verifies the real weekly/date editor and 30-day public request flow using at most five new tagged Auth accounts, admin-generated OTPs without email, Chrome and a private app snapshot on localhost port 3146. It requires the ignored hosted-dev configuration and a logged-in Supabase CLI. It applies no migrations, restores no Docker stack and touches no existing accounts. Success requires exact fixture cleanup and unchanged existing-data fingerprints; cleanup failure retains a private UUID-only recovery manifest. Evidence is written under ignored `test-results/dev0253-hosted/<run-id>/`. This command replaces the retired local availability/request rehearsals for DEV0253/DEV0255 live validation; its current results remain recorded in those tickets.

`test:coach-events-ui` runs the DEV0239 coach Events screens and actual Server Actions in an isolated temporary app snapshot with explicit service/account fixtures. It requires Node.js 24, installed Chrome and free loopback port 3139. It loads no environment files, creates no database, makes no hosted Auth/database calls and runs no migration; its fixture results do not prove real persistence or authorization. Screenshots are ignored under `test-results/dev0239-ui/`. Required live multi-account validation remains recorded in the DEV0239 ticket.

`test:group-discovery` requires the running repository Supabase Auth/PostgreSQL containers, the restricted runtime login prepared by `npm run db:runtime`, Node.js 24 and local Chrome; port 3113 must be free. It starts its own temporary app snapshot, creates a uniquely named disposable database and tagged DEV0240 Auth accounts, and checks real Events filtering/paging, reservations/withdrawals, confirmation, privacy, unavailable/retry and responsive/no-JavaScript flows. It never resets, migrates or seeds the shared development database. It removes only its owned database, app snapshot and exact temporary accounts afterward. Screenshots are ignored under `test-results/group-discovery-rehearsal/`.

`test:private-messages` requires the Auth-enabled local app at `http://localhost:3100` with the M8 migrations applied. It creates only tagged DEV0247 accounts and fixtures, verifies inquiry/reply, polling, consent, request/booking cards, retry/privacy/block behavior and responsive layouts, then removes those accounts and their message/scheduling records. Use `--cleanup` for its own tagged leftovers. Screenshots are ignored under `test-results/private-messages-rehearsal/`; no message drafts or private CLI configuration are saved. The current behavior is defined in [specification section 16](docs/mvp-spec.md#16-private-messages-and-session-notes).

`test:coach-connections` requires the running Auth-enabled local app at `http://localhost:3100`. It creates tagged temporary coach/athlete accounts and private scheduling fixtures, exercises real coach connection actions, reconnect history, pagination, media fallback and responsive keyboard use, then removes only those exact accounts/images/records. This coach-focused check uses actor-checked counterpart operations; `test:athlete-connections` additionally exercises both coach and athlete web interfaces, including full retained history, visibility, coach-as-athlete, retry/conflict, desktop/mobile and keyboard flows. Both commands share tagged loopback-only fixture and cleanup helpers. For an isolated local preview, `CONNECTION_TEST_SITE_URL=http://localhost:3113` is the only alternate target; it changes no deployment setting. `--cleanup` removes only their own ticket-tagged leftovers. Screenshots are ignored under `test-results/coach-connections-rehearsal/`; no private CLI configuration is printed or saved.

`test:auth`, `test:coach-availability`, `test:coach-locations`, `test:coach-requests` and `test:client-requests` require the configured Auth-enabled local stack and a running application on port 3100. The availability rehearsal creates an approved local coach with two reviewed gyms; verifies local assignment, explicit keep/move/remove, one request per save, inactive-location conflict recovery, actual occurrence venues and responsive keyboard use; then removes only its exact `dev0104-coach-*` local accounts. The location rehearsal requires the provisioned Daniel Park coach account; it exercises add/edit/conflict/primary/public/deactivation flows, captures responsive evidence and removes only its unreferenced `DEV0178 …` local locations afterward. The coach-request rehearsal also uses the provisioned Daniel account, creates isolated `dev0189-client-*` local identities and authorized requests, validates pagination, decisions, closure, history, keyboard and responsive behavior, then removes those identities and their exact scheduling records. The athlete-request rehearsal uses the provisioned Hoang and Daniel accounts plus one isolated competitor; it validates request persistence, withdrawal and retry, coach decline and retry, acceptance, closure, expiry, candidate privacy, confirmed-session continuity, keyboard use and responsive layout, then removes only its three fixed occurrences, related records and isolated competitor. Database checks require isolated local PostgreSQL. Playwright starts a production server on port 3101 and writes ignored evidence to `test-results/`.

## Application structure

- `src/app/`: thin App Router pages, server actions and shared styles.
- `src/features/`: capability-owned screens and browser behavior.
- `src/domain/`: framework-independent coach, availability and booking rules.
- `src/auth/` and `src/server/auth/`: browser/server Supabase identity boundaries.
- `src/server/identity/` and `src/server/coaches/`: application profile and scheduling services.
- `src/server/db/`: server-only PostgreSQL configuration, schema mappings and narrow actor-scoped repositories.
- `src/location/`: provider-neutral map/search contracts, isolated MapLibre/OpenFreeMap/Geoapify adapters and generic browser map components; the authoritative list works without them.
- `supabase/`: additive SQL migration history, deterministic seeds and database tests.
- `tests/`: unit, database and browser validation.
- `public/`: local illustrative assets only; no real coach or venue affiliation is implied.

Keep product requirements in the specification, workflow rules in `AGENTS.md`, and implementation evidence in development tickets.
