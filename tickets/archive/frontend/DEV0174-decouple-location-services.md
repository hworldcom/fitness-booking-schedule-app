# Ticket DEV0174: Decouple location services

- Status: Completed
- Created: 2026-10-09
- Last updated: 2026-10-09
- Milestone: Scheduling-only M3 interface follow-up
- Coordination: None — independent development ticket
- Related records: replaces the provider-specific unfinished delivery in [DEV0108 — Add the Mapbox coach Explore map](DEV0108-add-mapbox-coach-explore-map.md) after its already-committed implementation; preserves the provider-neutral persistence delivered by [DEV0096 — Persist coach profiles and discovery](../../archive/backend/DEV0096-persist-coach-profiles-and-discovery.md) and the list-first contract adopted by [DEV0107 — Adopt the Mapbox coach-discovery contract](../../archive/organisatory/DEV0107-adopt-mapbox-coach-discovery-contract.md)

## Objective and context

Replace the exhausted Mapbox trial dependency with MapLibre GL JS rendering, OpenFreeMap basemaps and Geoapify place search. Keep these concrete services behind a provider-neutral location module so coach discovery and profile features do not import vendor SDKs, endpoints or response shapes directly.

The current Explore map fails because the card-free Mapbox trial reached its usage cap and Mapbox disables every API until account upgrade. The user confirmed on 2026-10-09 that MovX should adopt the free alternative and specifically requested a module boundary to avoid coupling the rest of the application to another provider. This changes the product behavior described by the optional-map requirements in [the MVP specification](../../../docs/mvp-spec.md#2-confirmed-target-and-decisions) and the provider boundary in [application and infrastructure boundaries](../../../docs/mvp-spec.md#6-application-and-infrastructure-boundaries).

## Scope and non-goals

- In scope: create a provider-neutral `src/location/` module; render Explore and the coach pin editor with MapLibre GL JS and the OpenFreeMap public style; search Geoapify geocoding plus gym/dojo/fitness/sports-club place categories on explicit submission; return bounded application-owned candidates; persist an explicitly confirmed selected result as a provider-neutral location snapshot; retain manual entry and list-first failure behavior; preserve already stored Mapbox-derived snapshots; replace Mapbox dependencies, environment validation, documentation and tests; record required attribution and free-service limitations.
- Out of scope: device geolocation, live tracking, directions, reviews/ratings/photos, importing or persisting an entire gym directory, background autocomplete, multiple coach locations, database-schema changes, self-hosting map tiles, an uptime service-level agreement, or changing unrelated booking/profile behavior.

## Expected behavior and edge cases

Explore initializes one OpenFreeMap-backed MapLibre map without an API key and synchronizes the same authorized coach set with accessible list cards. A map/network/WebGL failure keeps the list, filtering and profile links usable. Coach portraits and initials retain their existing marker behavior.

When a Geoapify public key is configured, the coach location picker can find named gyms, fitness centres, dojos, sports centres and sport clubs as well as address/place matches around Berlin. Results expose only a bounded label, coordinates, stable candidate identifier and gym/place classification to the feature. The coach selects, optionally adjusts and explicitly confirms one public location before saving. Missing, rejected, exhausted or unavailable Geoapify configuration leaves manual coordinates usable; aborted searches do not surface an error.

Geoapify-derived snapshots store provider `geoapify`. Existing `mapbox` snapshots remain accepted for edit/save compatibility and render from their stored label and coordinates without calling Mapbox. Invalid coordinates, unconfirmed locations, unknown provider claims and malformed provider responses fail closed. Required OpenFreeMap/OpenStreetMap and Geoapify attribution remains visible.

## Assumptions, decisions, and dependencies

- Confirmed by the user on 2026-10-09: replace Mapbox with MapLibre GL JS, OpenFreeMap and Geoapify, and isolate the implementation behind a module.
- Adopt a `src/location/` boundary containing provider-neutral contracts, provider adapters and generic map components. Feature modules may import that public boundary but must not import `maplibre-gl`, OpenFreeMap URLs or Geoapify endpoints directly.
- Use the reviewed current `maplibre-gl` 6.13.0 package. The installed Next.js 16.3.8 lazy-loading guide still requires browser-only `ssr: false` imports to originate from Client Components; generic map components therefore remain dynamically loaded by client feature boundaries.
- The [OpenFreeMap public instance](https://openfreemap.org/quick_start/) currently permits commercial use without registration, keys or request limits, requires OpenStreetMap/OpenMapTiles attribution and provides no uptime guarantee. The existing list-first fallback remains mandatory.
- [Geoapify Places](https://apidocs.geoapify.com/docs/places/) currently permits free commercial production use, storage of results and 3,000 daily credits without a card when attribution is shown. Its browser key is public configuration and should be restricted to approved origins in the Geoapify dashboard.
- One explicit search may query both Geoapify geocoding and category-based Places endpoints, then deduplicate bounded candidates. This costs provider credits but avoids per-keystroke traffic and supports both named gyms and arbitrary public places.
- Existing database constraints already accept bounded provider identifiers for permanent-geocoding snapshots, so no migration is required. `mapbox` remains a legacy accepted provider while new provider-backed selections use `geoapify`.
- DEV0173 has completed but uncommitted changes in the shared worktree. This ticket must preserve those changes and avoid claiming or overwriting their implementation evidence.

## Implementation plan

1. Introduce provider-neutral location contracts/configuration plus isolated OpenFreeMap and Geoapify adapters with bounded parsing, error classification, gym categories and legacy-provider compatibility.
2. Replace Mapbox GL with exact MapLibre GL JS and move generic result/picker map components into `src/location/`; keep client-only lazy initialization, attribution, accessible markers and graceful failure.
3. Update Explore and coach-profile features to consume only the module boundary. Add explicit gym/place search, manual fallback, confirmation and `geoapify` persistence without changing the database shape.
4. Replace Mapbox environment/setup/deployment references with optional Geoapify search configuration and document that the basemap requires no key.
5. Update focused unit, domain, deployment and browser checks; run formatting, unit tests, lint, typecheck, build and responsive browser validation. After replacement validation passes, cancel/archive DEV0108 as superseded by this ticket without rewriting its implementation history.

## Acceptance criteria

- [x] AC1: `/explore` renders one synchronized OpenFreeMap-backed MapLibre map without an API key, while provider/WebGL/network failure leaves the accessible coach list fully usable.
- [x] AC2: `src/location/` exclusively owns MapLibre imports, OpenFreeMap configuration, Geoapify endpoints/response parsing and provider-specific errors; coach feature modules consume provider-neutral contracts/components.
- [x] AC3: With a valid Geoapify public key, an authorized coach can explicitly search named gyms/dojos/fitness or sports facilities and general places, choose or adjust one result and confirm it for provider-neutral persistence.
- [x] AC4: Missing/invalid/quota/provider search states retain manual confirmed-coordinate entry; no device location, background autocomplete or fabricated result is introduced.
- [x] AC5: New provider-derived saves use `geoapify`; legacy `mapbox` snapshots remain valid and renderable; malformed/unconfirmed/unknown-provider inputs remain rejected without a database migration.
- [x] AC6: Required attribution, optional-key setup, origin restriction guidance, free-tier limitations and list fallback are documented without committing a credential.
- [x] AC7: Focused unit/domain/deployment/browser tests, lint, typecheck, formatting and production build pass, including mobile and desktop map/list checks.

## Validation plan

Add pure tests for search-key configuration, Geoapify Geocoding/Places request construction, bounded/deduplicated response parsing, error classification and legacy/new provider validation. Update static tests to prove provider code is isolated in `src/location/` and excludes device geolocation. Update deployment validation for the optional Geoapify key without printing it. Exercise Explore in Chrome at desktop and mobile widths with no map key, including marker portraits/initials, card synchronization, attribution and induced map failure where deterministic. Exercise the coach picker with mocked Geoapify gym/address results plus missing/rejected/quota states and the manual fallback. Run `npm test`, relevant database tests if domain persistence changes require them, `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build`, focused Playwright and `git diff --check`.

## Implementation record

Implementation started and completed on 2026-10-09 after reviewing the current Mapbox code, provider-neutral persistence, installed Next.js 16.3.8 lazy-loading/environment guidance, current MapLibre package metadata and the official OpenFreeMap/Geoapify contracts.

### Changes and rationale

- Replaced Mapbox GL and its token-gated rendering with exact `maplibre-gl@6.13.0`, the public OpenFreeMap Liberty style and generic location-map components. Explore now starts without a map credential, maps the same authorized coach projection used by the cards, preserves portrait/initial markers and falls back to the authoritative list when rendering fails.
- Added a provider-neutral location boundary. Feature code consumes application-owned candidates, configuration, map points and components; only `src/location/` knows MapLibre, the OpenFreeMap style or Geoapify endpoints and response shapes. Domain-owned provider identifiers remain independent of browser/integration modules.
- Added explicit Geoapify search that issues one Geocoding request and one category-based Places request for supported gym, fitness-centre, dojo, sports-centre and sport-club categories around Berlin. Results are bounded, parsed, deduplicated with gym matches first and resilient when one successful endpoint returns usable data while its peer fails or is malformed.
- Updated the coach picker to distinguish gym/place results, show Geoapify attribution, allow selection and MapLibre pin adjustment, and require explicit confirmation. Missing, invalid, rejected, exhausted or unavailable search configuration keeps the manual-coordinate path; searches occur only on submission and never request device location.
- Kept new provider snapshots as `geoapify` while accepting existing `mapbox` snapshots for edit/save compatibility. Unknown provider claims and malformed or unconfirmed input still fail at the existing domain boundary; the database shape and owner authorization did not change.
- Made the version-matched MapLibre worker a same-origin generated asset prepared by the supported local and production build commands. This avoids a Turbopack worker-chunk resolution failure without checking a 496 KiB generated dependency artifact into source control.
- Replaced environment validation, setup documentation and tests for the retired Mapbox token with optional `NEXT_PUBLIC_GEOAPIFY_API_KEY` guidance. OpenFreeMap attribution is supplied by the style; Geoapify attribution appears beside search, and both list fallback and public-key origin restrictions are documented.

### Affected files

- `src/domain/locations.ts` owns the current `geoapify` and legacy `mapbox` persisted-provider contract; `src/domain/coaches.ts` validates confirmed current or legacy snapshots without importing integration code.
- `src/location/` owns provider-neutral contracts, the OpenFreeMap and Geoapify adapters, the MapLibre worker URL and generic result/picker map components.
- `src/features/coaches/coach-explore-results.tsx`, `coach-location-picker.tsx`, `coach-discovery.tsx` and `coach-profile-editor.tsx` adapt coach projections and form state to the location boundary without importing vendor SDKs or endpoints.
- `src/app/explore/page.tsx`, `src/app/profile/coach/page.tsx`, `src/app/layout.tsx`, `src/app/coach-discovery.css` and the location-related portion of `src/app/globals.css` connect the provider-neutral UI, stylesheet and optional search configuration.
- `scripts/prepare-maplibre-worker.mjs`, `package.json`, `.gitignore` and `eslint.config.mjs` prepare and exclude the generated same-origin worker for local development, standard production builds and Vercel builds.
- `scripts/validate-vercel-environment.mjs`, `.env.example`, `README.md` and `docs/mvp-spec.md` define the optional Geoapify configuration and current map/search product contract.
- `tests/location-services.test.ts`, `tests/coaches.test.ts`, `tests/vercel-deployment.test.ts` and `tests/browser/coach-discovery.spec.ts` cover provider isolation, requests, parsing, compatibility, configuration secrecy and responsive map behavior. The former Mapbox adapter/components/tests were removed.

### Decisions and deviations

- 2026-10-09: Kept the replacement as one vertical slice because renderer, place search, configuration and feature consumers share one location-module contract and require no schema migration. Splitting them would leave an unusable half-migration or duplicate compatibility work.
- 2026-10-09: Kept the map renderer independent of Geoapify. OpenFreeMap map browsing needs no key; only coach-facing gym/place search consumes Geoapify credits and can be disabled without removing Explore maps.
- 2026-10-09: Used Geoapify's supported structured Places `POST` body alongside Geocoding `GET`. One explicit user action therefore covers named fitness facilities and general addresses without background autocomplete.
- 2026-10-09: MapLibre's default worker URL resolved beside a Turbopack browser chunk that did not contain the worker. Supported commands now copy the exact installed worker into ignored `public/vendor/` output and set one same-origin URL before map creation.

### Contracts, configuration, and operations

`NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` is retired. Optional `NEXT_PUBLIC_GEOAPIFY_API_KEY` is a browser-visible, build-time value used only for explicit location search and must be restricted to approved origins; OpenFreeMap rendering requires no key. No credential value is committed or recorded.

The application dependency changes from `mapbox-gl@3.32.0` to `maplibre-gl@6.13.0`. Supported `npm run dev`, `npm run dev:local`, `npm run build` and `npm run build:vercel` lifecycles prepare the installed MapLibre worker for same-origin delivery. No schema, migration, stored-field or rollback operation is required. Existing `mapbox` provider labels remain read/write compatible; new provider-search selections use `geoapify`.

## Validation results

- Passed `npm test` after implementation: 88 general tests and 2 React-server tests, including location configuration, Geocoding/Places request construction, response bounds/deduplication, partial-endpoint resilience, provider isolation and current/legacy provider validation.
- Passed `npm run test:db`: 34 authorization, availability, booking, discovery, location-snapshot, identity and media database tests against local PostgreSQL. No migration was required.
- Passed `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`, the guarded `npm run build:vercel` public-preview build and `git diff --check` with Node.js 24.21.0. Both build lifecycles prepared the version-matched MapLibre worker. `npm audit --omit=dev --audit-level=high` reported zero vulnerabilities.
- Passed `npm run test:e2e -- tests/browser/coach-discovery.spec.ts` with the documented local database/Auth environment: 8/8 desktop/mobile production-browser checks. Explore rendered five synchronized markers, portrait/initial fallbacks and attribution; filters and protected/profile routes also remained valid with no horizontal overflow.
- Passed direct Chrome checks at 1440 × 1040 and 393 × 852 against the configured local application: OpenFreeMap rendered five markers with visible attribution, card/map selection and filtering worked, and no page errors or failed requests were observed. The initial live probe caught MapLibre's unresolved default worker URL; the same-origin worker lifecycle fixed it before completion.
- Passed an authenticated production-browser rehearsal with a test-shaped public key and intercepted provider responses: Daniel Park's editor issued one Geoapify Geocoding `GET` and one structured Places `POST`, displayed a gym candidate and Geoapify attribution, rendered the selected point on OpenFreeMap and required confirmation. The rehearsal did not save or alter the profile and consumed no external provider credits.
- Verified missing-key behavior in Daniel Park's editor: the provider-neutral note and label/latitude/longitude controls remained available, with no search call or fabricated provider claim.
- An initial focused Playwright run started its production server without the repository's local database variables, so data-backed assertions failed before map evaluation; a second attempt used an invalid `http://127.0.0.1` Auth site origin and correctly entered the unavailable state. Re-running with the documented complete `localhost` environment passed all eight checks. These were validation-environment errors, not product regressions.

| Criterion | Evidence                                                                                                                                                                         | Result |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Live local and production-browser desktop/mobile Explore checks rendered one map with five synchronized coach markers, visible attribution and list fallback.                    | Passed |
| AC2       | Isolation tests scan feature imports; provider SDK/URLs and response parsing exist only under `src/location/`, with provider identifiers in `src/domain/locations.ts`.           | Passed |
| AC3       | Authenticated mocked-provider rehearsal covered Geocoding plus named-gym Places search, candidate selection, map adjustment surface and explicit confirmation without saving.    | Passed |
| AC4       | Configuration/error tests plus the authenticated missing-key editor check retained manual coordinates; static scans exclude device-geolocation APIs and background autocomplete. | Passed |
| AC5       | Domain/unit/database checks accept new `geoapify` and legacy `mapbox` snapshots while rejecting unknown providers and preserving the existing database shape.                    | Passed |
| AC6       | Live OpenFreeMap and Geoapify attribution plus README/spec/environment guidance cover setup, origin restrictions, free-tier limitations and fallback without a credential.       | Passed |
| AC7       | Unit/server/database tests, lint, typecheck, formatting, audit, production build, responsive browser checks and diff validation passed.                                          | Passed |

## Risks, limitations, and follow-ups

OpenFreeMap has no uptime guarantee, and open-data gym coverage may omit or lag some businesses. The existing manual location flow and authoritative list mitigate both limitations. Geoapify attribution, origin restrictions and daily-credit monitoring remain operational responsibilities. This local delivery did not deploy or exercise a real project key. A future paid/SLA-backed provider should implement the same location-module contracts rather than leak into coach features.

## Completion and review references

- Completed: 2026-10-09.
- Commit: Not created.
- Review: Local self-review against the completed ticket; no independent review.
- Deployment or release: Not deployed.
