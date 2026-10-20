# MovX Club

**Find a coach. Pick a time. Request your session.**

MovX Club is a focused scheduling application for martial-arts athletes and coaches. Guests discover fictional coaches and real published availability. Email-authenticated athletes request one capacity-one private session, and the coach confirms one athlete before a booking exists. Coaches manage their public profile, training locations, location-aware recurring one-hour availability, request queue and booked schedule.

The delivered application includes private scheduling and the public/athlete group-session interface. The [group-training contract](docs/mvp-spec.md#15-group-training-and-events) is coordinated under [COR0021](tickets/current/organisatory/COR0021-group-training-and-events.md). [DEV0240](tickets/archive/frontend/DEV0240-add-group-event-discovery-and-joining.md) delivers Events discovery, direct seat registration/withdrawal and private Group sessions history with local browser validation. [DEV0239](tickets/archive/frontend/DEV0239-add-coach-group-session-management.md) delivers coach Events draft/review/publication, private roster and manual decisions with real hosted-dev browser validation. DEV0241 remains the final combined rehearsal; deployment is separate. This repository excludes blockchain, wallets, passes, credits, in-app payments, group funding and social/feed behavior. Completed SQL history is preserved in an immutable archive with an equivalent baseline for fresh databases; see [database baseline and existing-environment guidance](supabase/README.md#migration-baseline-and-history). Dedicated excluded-product documents and evidence were pruned under [DEV0225](tickets/archive/organisatory/DEV0225-remove-blockchain-historical-evidence.md); retained scheduling and contributor records remain historical context. The separate [fitness-booking-social-app](https://github.com/hworldcom/fitness-booking-social-app) repository preserves the Solana hackathon product.

The [calendar and effective-availability extension](docs/mvp-spec.md#18-coach-calendar-and-effective-availability) is complete under [COR0023](tickets/archive/organisatory/COR0023-coach-calendar-and-availability.md): mixed calendar, weekly/date editing, thirty-date public requests and the real combined hosted-dev rehearsal. Completion does not imply UAT/production deployment; response-time limitations are recorded in DEV0256.

Reusable session types and duration-aware booking are specified in [section 18.6](docs/mvp-spec.md#186-session-types-and-flexible-bookings), with implementation and validation tracked in [COR0029](tickets/archive/organisatory/COR0029-session-types-and-flexible-bookings.md). Existing coaches can open **Schedule → Session types** and explicitly create their offerings or add the two defaults; startup never fills an existing coach's catalog. Hosted rollout is separate.

Start with the [MVP specification](docs/mvp-spec.md), the single current product contract. The scheduling-product split is recorded by completed [COR0011](tickets/archive/organisatory/COR0011-scheduling-only-product.md); hosted deployment and rehearsal remain separate operational work.

## Repository guide

| Location                                 | Responsibility                                             |
| ---------------------------------------- | ---------------------------------------------------------- |
| [docs/mvp-spec.md](docs/mvp-spec.md)     | Current scheduling behavior and delivery contract.         |
| [AGENTS.md](AGENTS.md)                   | Contributor workflow, ticket, validation and commit rules. |
| [tickets/README.md](tickets/README.md)   | Current and archived development/coordination records.     |
| [supabase/README.md](supabase/README.md) | Local database and hosted migration operations.            |

Google sign-in activation and remaining live checks: [provider setup](docs/google-auth-setup.md).

## Current foundation

Delivered reusable foundations include:

- a responsive Next.js application shell and native Vercel build;
- local/hosted Supabase PostgreSQL with a server-only database boundary;
- password registration/login with confirmed email, verified password setup/recovery, protected profiles and separate athlete/coach onboarding (local delivery; hosted readiness remains under DEV0286);
- platform-reviewed coach applications with verified or demo trust labels;
- owner-scoped coach profiles with multiple provider-neutral training locations, one active primary base and safe deactivation;
- list-first coach discovery with an OpenFreeMap-backed interactive map;
- location-bound recurring one-hour availability, deterministic dated occurrences and a responsive compatibility calendar pending its location selector.

Direct scheduling-only booking and runtime cleanup were delivered under COR0011. The approval-only request lifecycle, separate coach/athlete interfaces and atomic conversion of one accepted request into the confirmed booking are delivered under completed [COR0016](tickets/archive/organisatory/COR0016-coach-confirmed-booking-requests.md). The former membership, wallet, payment, group-event and social features are not current product surfaces.

The delivered contract permits multiple coach training locations, one coach-selected primary Explore marker and actual-location availability assignments. Profile location management, the location-aware calendar and primary-marker discovery are integrated under completed [COR0014](tickets/archive/organisatory/COR0014-multi-location-coach-scheduling.md).

## Run locally

Prerequisites are Node.js 24.21.0 LTS and npm 11. The supported Node range is recorded in `package.json` and `.nvmrc`.

### Local Supabase (default)

Start Docker, then run:

```sh
nvm use
npm ci
npm run dev
```

`npm run dev`, `dev:local` and `dev:docker` start the local Supabase PostgreSQL, Auth, Storage and Mailpit services, apply pending local migrations, prepare the restricted application login, preserve/provision `hoang@users.movx.test`, and launch the application while preserving existing demo-coach data. Demo accounts on a fresh installation use the explicit setup command below. The app opens at [localhost:3100](http://localhost:3100); captured sign-in email is available in [Mailpit](http://127.0.0.1:55324).

The fresh Docker project is `movx-club-local`. Initial image downloads and database initialization can take several minutes. First startup builds its database from the accepted baseline/forward migrations and seed; later startups preserve its data and apply only pending migrations. The older `fitness-booking-social-app` database/upload volumes remain separate and untouched. Their optional historical transition remains [DEV0232](tickets/current/organisatory/DEV0232-restore-local-migration-continuity.md).

No environment file is required for local database/Auth access. The launcher injects loopback settings before Next.js reads dotenv files, so the existing hosted `.env.development.local` does not select the local application's database. Optional map search settings may still come from ignored environment files. Local startup never falls back to hosted dev.

```sh
npm run dev -- --check
npm run dev -- --setup-only
```

`--check` validates the local project/ports without starting services. `--setup-only` prepares local services/accounts without starting Next.js. Press `Ctrl-C` to stop Next.js; the local services remain available until `npm run db:stop`. Database integration commands and explicit disposable resets are described in [the database guide](supabase/README.md#local-development-and-database-tests).

### Hosted dev (explicit)

UAT/test uses the hosted dev project; production uses its separate hosted project. For deliberate local integration checks against hosted dev, follow [hosted environment setup](supabase/README.md#separate-hosted-environments). If needed, create the ignored settings file without replacing existing credentials:

```sh
cp -n .env.development.local.example .env.development.local
npm run dev:hosted
```

Fill the placeholder values before startup. `dev:hosted` validates the dev project, dedicated runtime login and localhost origin. It starts no Docker services and performs no migrations or broad database seed. It launches the application without demo provisioning or administrative account-setup credentials. Existing demo accounts and content are preserved. Missing or wrong hosted settings fail without a fallback. An existing app process keeps its target until restarted. The user-confirmed UAT target is `https://uat.movx.club`; planned production is `https://movx.club`. Provisioning status remains in [COR0026](tickets/current/organisatory/COR0026-separate-hosted-dev-and-production.md).

For a configuration-free production-mode public preview:

```sh
npm run build
npm run start
```

The preview uses [localhost:3100](http://localhost:3100). Development compiles routes on demand; a production build is appropriate for performance review. An independently started production server needs explicit database/Auth settings for signed-in behavior; the local launcher's settings exist only in its child process.

### Session-type validation

With local Supabase running and dependencies installed, run the isolated schema/booking rehearsal:

```sh
node scripts/rehearse-typed-sessions-database.mjs
```

It creates disposable fresh and upgrade databases, checks retained-row fingerprints and legacy compatibility, exercises type management/private bookings/group integration, and removes its own databases afterward. It does not reset or seed the retained application database. [DEV0346](tickets/archive/backend/DEV0346-rehearse-session-types-and-flexible-bookings.md) records the separate browser-copy setup and final evidence.

Run `node scripts/rehearse-public-coach-schedule-ui.mjs --production` for the [seven-day booking refinement](docs/mvp-spec.md#196-cards-username-urls-and-scheduling-compatibility). It builds an isolated source copy and checks typed/legacy booking with explicit interface fixtures, without environment files, real accounts or database writes. Add `--serve` to keep its loopback review server on port 3199 after the checks; enter `cleanup` to stop it and remove only its temporary checkout. Set `PUBLIC_SCHEDULE_UI_PORT` to another unused port from 3100–3999 if necessary. The normal application routes and Auth checks are not replaced outside that temporary copy.

For the accepted-request rescheduling regression, run `node scripts/rehearse-request-booking-rescheduling-database.mjs`. It checks the current migration chain in fresh and upgrade scratch databases, including an accepted request created before the fix, exact retained-row hashes and existing typed/legacy suites, then removes its own databases. It never migrates or resets the retained local or hosted database.

### Events banners and directory validation

Group-session banners, public card fallbacks, cursor Load more and the loaded-session venue map follow [the Events contract](docs/mvp-spec.md#151-confirmed-choices-and-implementation-defaults). The local launcher applies the additive event-banner migration while preserving existing sessions; hosted rollout is separate. Coaches add an optional event image from a saved group session’s detail or draft editor.

`node scripts/rehearse-event-banners-database.mjs` proves fresh/upgrade media boundaries in disposable databases. With local Supabase running, `node --import tsx --conditions=react-server scripts/rehearse-local-event-directory.ts` starts a separate preview on port 3158 with newly tagged temporary coaches, sessions and synthetic images for native browser checks. It prints fixture-only sign-in details and accepts `cleanup` on stdin to remove its own records and stop its preview; it never provisions or changes retained accounts. See [DEV0358](tickets/current/frontend/DEV0358-redesign-events-cards-and-map.md) for required checks and evidence.

## Local registration and sign-in

Public browsing does not require sign-in. Normal development uses local Supabase Auth and captures email in Mailpit:

```sh
npm run dev
```

The local launcher reads the local public `API_URL` and `PUBLISHABLE_KEY` (or legacy `ANON_KEY`) internally, injects loopback settings for that process and does not print or persist private CLI status values. Keep the shared hosted-dev file unchanged; never copy local test or service-role/secret keys into it.

Open `/register` to create an email/password account, open the captured confirmation email in the same browser and choose a unique username, private full name and display name. You can then add an optional private account picture or choose **Do this later**; it remains editable from personal Profile. Returning users use `/sign-in`; existing passwordless accounts use **Forgot password?** to set a password on the same account. Read confirmation/reset messages from local Mailpit at [127.0.0.1:55324](http://127.0.0.1:55324). **Forgot password?** sends the password reset/setup email. After changing a password, sign in again on your devices. Google is truthfully unavailable until DEV0287 configures and proves it. See [Auth rollout and recovery](supabase/README.md#password-authentication-rollout) before using these flows on hosted dev. `Find a coach` continues as an athlete; `Become a coach` submits a coach application on the same account. Applicants may prepare a hidden coach profile, but only platform-approved coaches may publish or manage availability.

For Docker athlete-account testing, sign in with `hoang@users.movx.test`. `npm run dev`, `dev:local` and `dev:docker` create this exact local-only account automatically and preserve its profile and private avatar on later starts. It starts without a user-set password and has no coach authority: choose **Forgot password?** on `/sign-in`, open the reset link in Mailpit in that same browser and set a password. Later startups preserve the password you set. You can also repair/provision it explicitly with `npm run auth:provision:test-user`. A deliberate `npm run db:reset` recreates the identity on the next Docker start but cannot restore a deleted uploaded image. This athlete test account and the six fictional coach accounts below are local-only.

To exercise owner flows as the six fictional coaches:

```sh
npm run auth:provision:coaches
```

Use `daniel.park@coaches.movx.test`, `sam.lee@coaches.movx.test`, `nora.klein@coaches.movx.test`, `idris.malik@coaches.movx.test`, `elif.demir@coaches.movx.test` or `jake.miller@coaches.movx.test` on `/sign-in`. Existing accounts keep their current data and passwords. For a fresh seeded database, run the explicit command above to create missing demo logins. Fresh accounts receive fictional portraits, coaching biographies and unique initial passwords. Open the ignored private [local login file](work/demo-coaches/local.json) for email/password pairs. Do not commit or publish it. These accounts remain **Demo coaches** and retain their existing scheduling identities.

`npm run demo:setup:local` prepares only the exact loopback project. Fictional test coaches are local-only; UAT at `uat.movx.club` uses real coaches through normal registration, applications and platform approval. The obsolete `demo:setup:dev` and `demo:urls:dev` aliases explicitly refuse before loading hosted credentials or contacting Supabase. Normal development launchers and deployment build/start never provision demo coaches. See [the current environment policy](docs/mvp-spec.md#8-identity-data-and-demo-integrity).

Existing Auth accounts are never upgraded, reinitialized or assigned new passwords by setup, even when their initialization markers or private credential file are missing. Their profile, media and website data stays unchanged. Setup creates only missing accounts for untouched fresh fixtures; incomplete/conflicting existing bindings require a separately scoped repair. The bulk `--reset-passwords` flag is rejected. Use the existing **Forgot password?** flow for a deliberate individual password change. Saved initial passwords can be stale after an owner changes their password.

The complete SQL seed bootstraps a new foundation dataset only. Replaying it against an existing dataset preserves that dataset, including edits and removed content. A deliberate `npm run db:reset` still recreates a disposable database; creating its demo logins then requires the explicit setup command. Keep the private credential files, and check any interrupted `work/demo-coaches/<environment>.lock` before removing that exact lock directory. See [data preservation](docs/mvp-spec.md#8-identity-data-and-demo-integrity) and [DEV0337](tickets/archive/backend/DEV0337-preserve-existing-demo-coach-data.md) for the current contract. DEV0335 records the historical one-time replacement; it is not the current setup policy.

Fresh local demo account creation also assigns fixed public usernames under [DEV0347](tickets/archive/backend/DEV0347-preserve-test-coach-public-urls.md). Their local pages are [Daniel](http://localhost:3100/@daniel_park), [Sam](http://localhost:3100/@sam_lee), [Nora](http://localhost:3100/@nora_klein), [Idris](http://localhost:3100/@idris_malik), [Elif](http://localhost:3100/@elif_demir) and [Jake](http://localhost:3100/@jake_miller). The private local login entries include `publicUrl`. Public username migration `20261018000600` is required before creating missing local demo accounts with these defaults.

For the separately authorized URL additions to existing local test coaches, run `npm run demo:urls:local`. Add `-- --check` to inspect target/identity/schema readiness without changing data or tester files. URL-only mode never creates Auth accounts or changes passwords/content. It preserves later owner renames and their reserved aliases, refuses conflicting/private custom handles, and keeps existing visibility gates. Normal setup never reinitializes existing accounts; startup and seed replay do not publish URLs. Recreating a fresh disposable local database reproduces the defaults; deleting a published owner while retaining its tombstone does not release that handle.

[DEV0349](tickets/archive/backend/DEV0349-restrict-fictional-coaches-to-local-development.md) owns the exact historical hosted-fixture retirement. The operator command `npm run demo:retire:uat -- --check` inspects only the allowlisted dev project; explicit `-- --apply` hides the six reserved fictional coaches and revokes their application participation while preserving real users, the shared active dataset, Auth records and history. It never deletes/reset accounts or runs a seed. Historical [dev tester credentials](work/demo-coaches/dev.json) remain private archival data, not UAT login instructions; they are not rewritten. New hosted environments require their reviewed real-dataset setup rather than the local fictional seed.

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

To enable coach-facing facility and separate own-address search, set `NEXT_PUBLIC_GEOAPIFY_API_KEY` in the ignored environment file before building. Create separate browser keys for local, preview and production use and restrict each key to the approved origins in Geoapify. Public browser keys are intentionally visible; never commit a populated value or record it in logs or tickets.

UAT search is enabled on the dedicated `movx-club-uat` Preview deployment. [DEV0375](tickets/archive/backend/DEV0375-enable-uat-gym-and-place-search.md) records the build-time configuration repair and real desktop/phone search proof. Changing this public setting requires rebuilding the Preview before reassigning the UAT alias.

Facility search is the first option and calls Geoapify Geocoding for named amenities across categories, including gyms and other facilities. Own address separately looks up a Berlin meeting address and offers manual coordinate entry. Both queries use Berlin’s administrative boundary; returned city/country/coordinates are checked, and facility results need a name and amenity classification. [DEV0378](tickets/archive/frontend/DEV0378-broaden-berlin-facility-search.md) records the broader lookup and UAT validation. MovX stores only the result the coach explicitly selects and confirms; Geoapify permits storage with required attribution. Search consumes the account's daily credits, while map browsing uses OpenFreeMap independently. Existing fictional gym coordinates and manual fallback coordinates call neither search API.

## Vercel deployment

[UAT is live](https://uat.movx.club) on the dedicated Vercel `movx-club-uat` Preview project using hosted dev. [DEV0372](tickets/archive/organisatory/DEV0372-deploy-reviewed-release-to-uat.md) records the release, responsive smoke, preservation proof and remaining QA/Auth limitations. Vercel now manages DNS; the former root/survey sites are retired from the new routing, with cache propagation documented in [DEV0373](tickets/archive/organisatory/DEV0373-move-domain-dns-to-vercel.md); Porkbun remains the registrar and email provider.

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
npm run test:coach-events-hosted -- --environment dev --check
npm run test:client-requests
npm run test:profile-images
npm run test:profile-storage
npm run test:shared-coach-picture
npm run test:coach-website-db
npm run test:coach-website
npm run test:coach-starting-rates-db
npm run test:coach-starting-rates
npm run test:coach-public-urls-db
npm run test:coach-public-urls
npm run lint
npm run typecheck
npm run format:check
npm run build
npm run test:e2e
```

`npm run test:calendar-hosted -- --environment dev --check` checks the same exact hosted-dev ledger/runtime without fixtures. `--run` serves a pinned committed-source production build at localhost port 3156 and reuses the full availability/public suite with independently tagged DEV0256 accounts. The same coach/athlete/group records are checked in Day/Week/Month before and after custom hours, a day off/cancellation and restoration, including original destinations, exact Month/More, privacy, concurrency and desktop/375/430 layouts. It sends no email, migration or reset. Success requires exact own-fixture cleanup and preservation of existing application/Auth/Storage row hashes. Evidence is under ignored `test-results/dev0256-hosted/<run-id>/`; recover only its private manifest with `npm run test:calendar-hosted -- --environment dev --cleanup /absolute/private/recovery-ids.json`. Results and performance limitations are recorded in [DEV0256](tickets/archive/backend/DEV0256-rehearse-calendar-and-availability.md).

`test:coach-availability-hosted -- --environment dev --check` checks the hosted-dev ledger and restricted runtime, recognizing only the independent DEV0254/DEV0239 peer fixtures and refusing another DEV0253 run or unknown temporary accounts. `--run` verifies the real weekly/date editor and 30-day public request flow using at most five new tagged Auth accounts, admin-generated OTPs without email, Chrome and a production build of a private committed-source snapshot on localhost port 3146. Compilation has no database URL; the running app receives only restricted/public runtime configuration. It requires the ignored hosted-dev configuration and a logged-in Supabase CLI. Success requires exact fixture cleanup and preservation of all original non-temporary application/Auth/Storage row hashes; independent additions are permitted. A failure retains a private UUID-only recovery manifest and row-hash baseline when available. Recover only that manifest with `npm run test:coach-availability-hosted -- --environment dev --cleanup /absolute/private/recovery-ids.json`. Evidence is written under ignored `test-results/dev0253-hosted/<run-id>/`. This command replaces the retired local availability/request rehearsals for DEV0253/DEV0255 live validation; current results remain recorded in those tickets. The focused review/save venue race uses `npm run test:coach-availability-hosted -- --environment dev --run --scenario inactive-venue` with the same guards and cleanup. The focused stale-hour request and native-navigation/responsive/access replays use the same command with `--scenario closed-selection` and `--scenario public-access` respectively; every case also remains in the full run.

`test:coach-events-hosted -- --environment dev --check` verifies the confirmed hosted-dev project/runtime and CLI admin access without creating fixture accounts or application rows. The live version is `npm run test:coach-events-hosted -- --environment dev --run`: it requires the ignored hosted-dev configuration, a logged-in Supabase CLI, Node 24, Chrome and free localhost port 3143. It creates at most five exactly tagged temporary accounts, verifies admin-generated OTPs through real Auth without sending email, and runs the committed coach Events screens against the real restricted runtime. It never restores Docker or applies migrations. Exact fixture cleanup and protected non-test data fingerprints gate success; another administratively tagged rehearsal's rows are excluded from preservation comparisons and never restored or deleted. Cleanup failure retains a private UUID-only recovery manifest. Production, existing accounts and SMTP settings are outside the run.

`npm run test:profile-storage` validates the DEV0292 image Storage boundary against the existing local Docker/Auth/Storage stack and the running app at `localhost:3100`. It uses three tagged temporary accounts authenticated through the current password gateway, verifies normalized private/public bytes, wrong-actor denial, request/booking/connection media and disconnect revocation, then checks desktop/phone rendering. It refuses hosted targets and leftover DEV0292 accounts, cleans its own test cohort, and checks original profile/coach/Storage row hashes. CLI credentials stay in memory; private UUID-only recovery manifests, results and screenshots are ignored under `test-results/dev0292-storage/`. This is local proof, not migration, restore, hosted rollout or deployment. The older `test:profile-images` script retains retired email-code UI assumptions and is not the DEV0292 validation command.

`npm run test:shared-coach-picture` checks the [explicit shared-picture contract](docs/mvp-spec.md#profile-images) against the existing local Supabase stack. It builds an owned source copy on `localhost:3182`, uses exact tagged temporary accounts, checks real private/public Storage, replacement/removal/revocation and unchanged original records, then stops its server. It never resets, migrates or provisions retained accounts. Apply the repository migrations first; diagnostics are under the printed owned preview path and ignored `test-results/dev0382-shared-picture/`.

`npm run test:coach-website-db` builds two new disposable local databases from schema-only infrastructure and the accepted migrations/seed. It checks fresh and preserved-data website migrations, restricted-runtime ownership, revisions and private banner policies, then removes those databases. It copies no retained user rows or tokens and does not migrate/reset the shared database. `npm run test:coach-website` requires the migrated local Docker stack and app at `localhost:3100`; it checks the real content/banner APIs, private applicant drafts, public bytes, competing saves, hide/removal recovery and exact three-account/banner cleanup with original-data hashes. Its UUID-only recovery manifests/results are ignored under `tmp/dev0321-website/`, separate from Playwright's cleared output directory. See [the website contract](docs/mvp-spec.md#192-public-content-and-template); owner editor and card/page layouts are separate work.

`npm run test:coach-starting-rates-db` creates two disposable local databases and checks the fresh/retained-data migration boundary through DEV0313, owner/dataset permissions, exact money, concurrent edits, hidden-rate privacy and existing booking/message/group flows. It excludes later peer migrations and removes its databases. Run database rehearsal commands serially because baseline migrations also inspect/update shared PostgreSQL roles. `npm run test:coach-starting-rates` requires that migration and the running local app at `localhost:3100` (or the existing approved `CONNECTION_TEST_SITE_URL=http://localhost:3113` preview override); it checks the real owner/public APIs, website/card projections and HTTP HTML/RSC output after hiding, then removes only its three temporary accounts/rates and verifies original-data hashes. UUID-only recovery/results stay ignored under `tmp/dev0313-starting-rates/`. See [starting prices and disclosure](docs/mvp-spec.md#193-starting-prices-and-public-disclosure) for the contract; owner forms and public layouts belong to their frontend tickets.

`test:coach-events-ui` runs the DEV0239 coach Events screens and actual Server Actions in an isolated temporary app snapshot with explicit service/account fixtures. It requires Node.js 24, installed Chrome and free loopback port 3139. It loads no environment files, creates no database, makes no hosted Auth/database calls and runs no migration; its fixture results do not prove real persistence or authorization. Screenshots are ignored under `test-results/dev0239-ui/`. The separate real multi-account validation and the limits of fixture evidence are recorded in DEV0239.

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

Fitness category and sixth fictional coach Jake Miller are recorded in [DEV0336](tickets/archive/backend/DEV0336-add-fitness-and-sixth-demo-coach.md). His reserved local/dev tester login is `jake.miller@coaches.movx.test`; use the corresponding private login file above. Existing tester passwords are preserved.
