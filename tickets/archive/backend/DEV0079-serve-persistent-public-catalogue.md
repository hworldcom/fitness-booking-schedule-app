# Ticket DEV0079: Serve the persistent public catalogue

- Status: Completed
- Created: 2026-09-26
- Last updated: 2026-09-26
- Milestone: M1 participating gym and membership-plan catalogue
- Coordination: [COR0006 — Persistent membership catalogue](../../current/organisatory/COR0006-persistent-access-catalogue.md)
- Related records: consumes completed [DEV0078](DEV0078-revise-multigym-catalogue-schema.md), replaces the runtime fixture adapters delivered by completed [DEV0074](../frontend/DEV0074-preview-multigym-discovery.md) and [DEV0075](../frontend/DEV0075-preview-membership-selection.md), and supplies the catalogue dependency for [COR0007](../../current/organisatory/COR0007-core-multigym-membership-mvp.md)

## Objective and context

Expose DEV0078's published Basic/Classic plans and active fictional participating gyms through a bounded server-only read service, then make Explore, public search, membership setup and My Membership consume that persistent result instead of importing preview plan/gym fixtures. Guests and authenticated users must see the same safe catalogue, while a database outage or inconsistent dataset produces an honest unavailable/empty state rather than silent fixture fallback.

Catalogue editing and operator mutations are explicitly deferred beyond the hackathon. The deterministic migration/seed workflow remains the only catalogue-management path for this ticket.

## Scope and non-goals

- In scope: additive row-level-security read policies for the restricted server runtime; server-only catalogue repository/service and strict database-to-public-contract mapping; one persistent catalogue result shared by Explore, search, setup and My Membership; dynamic browser-draft reconciliation against the served catalogue; loading/empty/error presentation; database/unit/browser coverage; current documentation and COR0006 updates.
- Out of scope: direct browser database access; a public JSON API; catalogue create/update/publish/retire operations; admin screens; membership ownership or activation; payment, reservation, check-in, allocation or social persistence; changing the reviewed seven-gym visual design; deployment.

## Expected behavior and edge cases

The server runtime can read only the active public demo run, active platform products, published plan versions, active participating venues and active plan eligibility. It maps EURC base units to the existing display contract, emits no internal UUID, organization relation, creator field or private lifecycle state, and produces stable public slugs plus a catalogue version suitable for draft reconciliation.

Explore and search work for signed-out visitors. Setup uses the same catalogue to enforce plan eligibility, and My Membership uses it to interpret the browser-local draft after the existing protected-page gate. A missing runtime configuration, database outage, zero published plans/gyms or structurally inconsistent partial result never falls back to `previewCatalogue`: users see a bounded unavailable or empty state and cannot create or review a draft against fabricated data. A saved draft keeps still-eligible selections and visibly reports removed/stale choices.

No table write is opened. `anon`, `authenticated` and `service_role` retain no `app` schema access; only the server's `app_runtime` role receives narrow row-level reads. Fictional gym labelling and illustrative landmark disclaimers remain visible.

## Assumptions, decisions, and dependencies

- DEV0078 is complete and supplies the authoritative persistent terms, gym metadata and eligibility.
- Next.js server components call a server-only service directly; no browser-facing API is required for these pages.
- Existing frontend `PublicCatalogue`/plan/gym shapes remain the presentation boundary, with their source changed from preview fixtures to persistent catalogue data. EURC has six decimal places and is rendered as display EUR only after exact integer conversion.
- The ticket is backend-primary because its authority and failure boundary are the repository/service and database policies, even though it replaces several frontend adapters as one vertical slice.
- 2026-09-26 user decision: catalogue administration is not part of the hackathon. COR0006 completion no longer depends on operator mutation APIs or an editor.

The readiness review found one cohesive vertical slice: a public read service is not useful until its current consumers stop importing plan/gym fixtures, and adapter replacement cannot be truthful without the restricted persistent read. Activation remains an independent COR0007 ticket.

## Implementation plan

1. Add a forward migration with narrow `app_runtime` select policies for the active public catalogue while preserving browser-role denial and all write denial; extend pgTAP/integration coverage.
2. Add a server-only repository and service that select, validate and map the persistent catalogue into the bounded public contract, distinguishing ready, empty and unavailable outcomes without leaking internal identifiers.
3. Change the catalogue contract/source and route adapters so Explore, Search, membership setup and My Membership receive the same server result; remove runtime plan/gym fixture fallback while retaining unrelated social preview people.
4. Parameterize the browser-local membership draft store by the served catalogue and preserve safe corruption/catalogue-change recovery.
5. Update status/setup documentation and run clean database replay, database suites, unit/lint/type/format/build checks and focused desktop/mobile browser flows including failure and empty states.

## Acceptance criteria

- [x] AC1: Signed-out and authenticated server rendering receives the same published Basic/Classic and seven-gym public projection through `app_runtime`, with no draft/inactive/private fields or internal UUIDs exposed.
- [x] AC2: Explore, Search, membership setup and My Membership use the persistent catalogue and no longer import plan/gym preview fixtures; filtering, gym details and exactly-four eligibility behavior remain intact.
- [x] AC3: Missing configuration, database failure, empty catalogue and inconsistent partial data fail honestly without fixture fallback or draft mutation against fabricated data.
- [x] AC4: Existing browser-local drafts are parsed against the current persistent catalogue, retain eligible selections and visibly recover when a plan/gym/eligibility disappears.
- [x] AC5: Browser-facing roles retain no direct schema access, `app_runtime` receives read-only catalogue rows and cannot insert/update/delete catalogue state.
- [x] AC6: Relevant database, unit, lint, type, format and production-build checks plus focused desktop/mobile keyboard and responsive browser scenarios pass with exact evidence.

## Validation plan

Run `npm run db:reset`, `npm run db:runtime`, `npm run db:test`, `npm run test:db`, `npm run db:lint`, `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build` and `git diff --check`. Add repository/service probes for exact mapping, inactive/draft omission, empty/inconsistent results, runtime read/write permissions and database failure. Run focused Playwright desktop/mobile coverage for Explore filters/details, Search, Basic/Classic selection, persisted My Membership draft, catalogue-change recovery and bounded unavailable/empty states against the local runtime database.

## Implementation record

Implementation started and completed after the user approved the read-only hackathon scope on 2026-09-26.

### Changes and rationale

- Added forced-RLS read policies that let only the restricted server runtime see the active public demo run, active platform products, published versions, active participating gyms/venues and active eligibility. Catalogue-table insert/update/delete privileges are explicitly revoked; browser-facing Supabase roles still have no `app` schema access.
- Added one server-only join and a strict mapper for the public catalogue. It validates the frozen €80 Basic, €150 Classic, €15 non-core price, plan/access rules, fictional gym metadata and eligibility; converts exact EURC base units; emits stable slugs rather than UUIDs; and returns distinct ready, empty or bounded error results without fixture fallback.
- Routed Explore, Search, membership setup and My Membership through that one service. The existing presentation and exactly-four selection remain, while unavailable/empty results show truthful waitlist states and expose no selectable fabricated data.
- Parameterized the browser-local draft store by the served catalogue and a version fingerprint containing plan versions plus gym eligibility. Stored drafts now re-parse automatically when eligibility changes and retain only still-valid choices.
- Removed the obsolete fixture-derived search adapter. Social preview people and the feed's illustrative references remain intentionally outside this catalogue ticket.
- Updated the specification and setup/operations guides: catalogue-backed routes now document their database dependency, while runtime catalogue management remains migration/seed-only for the hackathon.

### Affected files

- `supabase/migrations/20260926000200_serve_public_membership_catalogue.sql`: grants the restricted runtime only active-public catalogue reads and revokes catalogue writes.
- `src/server/db/catalogue/repository.ts` and `src/server/catalogue/service.ts`: own the bounded database projection, contract validation, EURC conversion, public mapping and failure boundary.
- `src/app/explore/page.tsx`, `src/app/search/page.tsx`, `src/app/membership/setup/page.tsx` and `src/app/my-access/page.tsx`: load the shared server result for each catalogue consumer.
- `src/features/discovery/explore.tsx`, `src/features/discovery/search.tsx` and `src/features/discovery/catalogue.ts`: render persistent plans/gyms, derive searchable public entries and show bounded unavailable/empty states. The obsolete `src/features/preview/discovery.ts` adapter was removed.
- `src/features/membership/setup.tsx`, `src/features/membership/my-membership.tsx` and `src/features/membership/draft-store.ts`: use the served catalogue for eligibility, display and browser-draft recovery.
- `src/domain/catalogue.ts`: exports the accepted discipline values and distinguishes fixture/test data from the persistent catalogue source.
- `supabase/tests/database/membership-catalogue.test.sql`, `tests/database/membership-catalogue.test.ts`, `tests/browser/catalogue-state.spec.ts`, `tests/discovery.test.ts` and `tests/boundaries.test.ts`: cover RLS/privileges, exact server projection, private-ID omission, failure/empty/inconsistent states, eligibility recovery and import boundaries.
- `README.md`, `supabase/README.md`, `docs/mvp-spec.md`, `tickets/README.md` and COR0006: record the runtime dependency, read-only management decision and delivery status.

### Decisions and deviations

- 2026-09-26: Defer all operator catalogue mutations and administration UI beyond the hackathon. Persistent migrations and deterministic seed data remain the management mechanism; DEV0079 exposes reads only.
- The public routes call the same actor-independent server service for every request; catalogue access is not expanded based on sign-in state. Protected My Membership performs its existing authorization gate before invoking that same service.
- The existing public contract keeps `fixture: true` to mean “fictional demonstration gym,” not “frontend fallback.” `source: persistent-catalogue` identifies the authority actually used at runtime.
- The catalogue version includes the run slug, plan version numbers and plan-to-gym eligibility fingerprint so a client-side draft snapshot cannot survive a relevant catalogue change unnoticed.

### Contracts, configuration, and operations

The existing server-only `DATABASE_URL` is now required by Explore, Search, membership setup and authorized My Membership rendering. No new dependency, environment variable, public API, write permission, secret or deployment was added. Public result objects contain no database UUID, organization relation, creator field or lifecycle field. There is no migration rollback requirement beyond reverting this additive policy migration before its consumers; local setup must run `npm run db:runtime` after a reset as before.

## Validation results

- Passed `npm run db:reset`: replayed every migration through `20260926000200` and the deterministic seed on the disposable local database.
- Passed `npm run db:runtime`: provisioned/verified the non-bypass loopback runtime login.
- Passed `npm run db:test`: 5 pgTAP files and 119 assertions, including exact public row counts, browser-role denial and catalogue write denial.
- Passed `npm run test:db`: 19 integration tests, including the exact 2-plan/7-gym service projection, absence of UUID/private field names, runtime read-only enforcement, empty/inconsistent mapping and missing-configuration failure.
- Passed `npm run db:lint`: no schema errors.
- Passed `npm test`: 55 tests.
- Passed `npm run lint`, `npm run typecheck`, `npm run format:check` and `git diff --check`.
- `npm run build` reached Turbopack compilation but the restricted execution environment denied an internal PostCSS worker port. The equivalent production build `npm run build -- --webpack` passed compilation, TypeScript, 13 static generations and all 21 application routes; this was an environment-specific build-runner limitation, not an application error.
- Passed focused Playwright coverage against the restricted local database on desktop and mobile: 28 passed and 4 pre-existing configured-guest scenarios skipped. The passing set covers persistent Explore/Search, plan filtering/details, Basic/Classic setup, corrupt/unavailable browser storage, responsive/keyboard behavior, empty publication, inconsistent-publication failure without fixtures and visible eligibility-change draft recovery. The skipped My Membership/social-preview scenarios require preview-mode authorization, which cannot coexist with the now-required database-only catalogue under the current all-or-nothing Auth configuration; the configured-guest redirect itself passed in retained navigation coverage.

## Risks, limitations, and follow-ups

This ticket serves fictional seeded demo data, not live partner inventory or availability. Database-backed browsing creates a runtime dependency for catalogue routes; its failure presentation is implemented, but hosted availability still depends on DEV0055/DEV0056 provisioning and deployment. The protected My Membership browser flow should be re-rehearsed with an authenticated local or hosted account when that environment is available. Catalogue editing remains migration/seed-only, and membership activation remains a separate COR0007 ticket.

## Completion and review references

- Completed: 2026-09-26.
- Commit: Not created.
- Review: Scope/readiness and final acceptance self-review completed; no independent implementation review.
- Deployment or release: None.
