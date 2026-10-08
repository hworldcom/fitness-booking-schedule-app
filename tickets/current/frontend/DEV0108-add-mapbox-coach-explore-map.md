# Ticket DEV0108: Add the Mapbox coach Explore map

- Status: In progress
- Created: 2026-10-03
- Last updated: 2026-10-08
- Milestone: Coach-first M1 location discovery
- Coordination: None — independent development ticket
- Related records: transferred from cancelled [COR0009 — Coach-first private-class booking MVP](../../archive/organisatory/COR0009-coach-first-training-package-mvp.md) because coach/location discovery remains reusable; depends on provider-neutral coach-location persistence and optional gym affiliation from [DEV0096 — Persist coach profiles and discovery](../../archive/backend/DEV0096-persist-coach-profiles-and-discovery.md), backed by the simplified fictional gyms from [DEV0109 — Retire membership schema and preserve gyms](../../archive/backend/DEV0109-retire-membership-schema-and-preserve-gyms.md); consumes stable slot-location projections from [DEV0104 — Publish weekly coach availability](../../archive/backend/DEV0104-publish-weekly-coach-availability.md); contract adopted by [DEV0107 — Adopt the Mapbox coach-discovery contract](../../archive/organisatory/DEV0107-adopt-mapbox-coach-discovery-contract.md); consumes optional public coach portraits delivered by [DEV0156 — Upload and present profile images](../../archive/frontend/DEV0156-upload-and-present-profile-images.md) and the shared fallback behavior completed by [DEV0168 — Detect profile images in account icons](../../archive/frontend/DEV0168-detect-profile-images-in-account-icons.md)

## Objective and context

Add an accessible `/explore` experience where guests see the same filtered coach results as a list and on one interactive Mapbox map. Provide a coach-facing Mapbox search/pin-confirmation component for choosing one public discovery location, either from an eligible fictional gym association or as an independent training location. The location is coach-selected public profile data, not live tracking, browser/device location or a claim that the coach is currently present or available.

Mapbox is the confirmed P0 provider because delivery speed is the current priority. PostgreSQL remains authoritative for the confirmed location snapshot supplied by DEV0096; Mapbox renders and helps select it but is not queried to reconstruct stored profiles on every read.

## Scope and non-goals

- In scope: install and configure the reviewed Mapbox GL JS version; one client-only lazy-loaded Explore map; provider adapter and bounded configuration states; responsive list/map layout; portrait-aware coach pins synchronized with accessible coach cards and optional fictional gym labels, with initials retained for missing/failed images; filters supplied by discovery; empty/loading/unavailable states; gym-location selection or explicit permanent-geocoding search results plus draggable pin confirmation integrated with DEV0096's owner form; an accessible manual fallback when Mapbox is unavailable; visible attribution; least-scope URL-restricted public-token setup; load/quota safeguards; focused browser/unit/static/build tests.
- Out of scope: public gym-directory pins independent of coaches, gym accounts/classes/memberships/check-ins, collecting browser/device geolocation, live tracking, background location, directions/navigation, distance-from-me sorting, route matrices, multiple coach locations, travel radius, per-slot venue choice, custom tilesets, 3D maps, offline maps, self-hosted tiles, changing Mapbox billing/account settings automatically or implementing coach/slot persistence owned by DEV0096/DEV0104.

## Expected behavior and edge cases

Explore first renders a usable coach list from DEV0096. When a valid Mapbox public token and browser support are available, one map initializes lazily and shows one pin for each visible coach with a confirmed public location. A pin renders that coach's optional public portrait when available and retains bounded initials when no portrait exists or image loading fails; its accessible selection label remains text-based. A gym-associated coach may show the fictional gym name, but the pin remains a coach result rather than a gym marketplace listing. Selecting a card focuses its pin; selecting a pin identifies and focuses the corresponding accessible card without replacing navigation to the coach profile. Filters update list and pins from one result set. The interface explicitly labels pins as coach-selected training locations; “available” appears only when authoritative DEV0104 slots exist.

The owning coach may select an eligible fictional gym and reuse its already reviewed stored public location, or enter an independent location query, review suggestions, select a candidate, adjust the pin if necessary and explicitly confirm the public label and coordinates before DEV0096 persists them. Temporary suggestion responses remain in memory only. A newly persisted Mapbox-derived independent location must be produced through a Mapbox mode that permits permanent storage; selecting an existing gym must not geocode or duplicate provider data unnecessarily. The server rejects malformed/out-of-bounds coordinates, ineligible gym references and browser-supplied provider labels that lack the adopted verification/confirmation contract.

Missing configuration, token rejection, quota exhaustion, network/CSP/WebGL failure and map initialization errors show a bounded map-unavailable message while the list, filters and profile navigation continue to work. No fixture pin substitutes for unavailable database data. The map never requests current device location.

## Assumptions, decisions, and dependencies

- Confirmed by the user on 2026-10-03: use Mapbox for P0 and do not implement live tracking; each coach chooses where the public pin appears.
- Use a dedicated `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` public token with only required public scopes and approved local/staging/production URL restrictions. Public `pk` tokens are intentionally browser-visible; Mapbox `sk` tokens are prohibited from client code and committed files.
- Current [Mapbox Search Box documentation](https://docs.mapbox.com/api/search/search-box/) says `/suggest` and `/retrieve` results are temporary-use only. They may assist the active selection session but cannot be stored. A selected provider result persisted by MovX must be resolved through the [Geocoding API](https://docs.mapbox.com/api/search/geocoding/) with permanent storage enabled, or replaced by another documented storage-permitted flow after terms review.
- The current Geocoding API requires `permanent=true` and an account with a valid payment method or enterprise agreement for indefinite result storage. Implementation must verify the contemporary rule before enabling persistence.
- Follow Mapbox's [token security guidance](https://docs.mapbox.com/help/dive-deeper/how-to-use-mapbox-securely/): do not use the unrestricted default token for deployment, grant only needed public scopes and restrict approved web origins.
- Stored location fields are provider-neutral and do not require Mapbox to render the coach list. DEV0109 supplies reviewed fictional gym locations; DEV0096 owns coach affiliation, schema, authorization and service persistence; DEV0104 owns slot snapshots; this ticket owns Mapbox UI/provider integration. Choosing an existing gym reuses its stored location, while independent Mapbox-derived locations follow the permanent-result rule.
- Before implementation, inspect the installed Next.js documentation for client-only third-party libraries, dynamic loading and environment exposure, and inspect the installed/current Mapbox package documentation.
- Reviewed on 2026-10-04: installed Next.js 16.3.8 documentation requires `ssr: false` to be declared from a Client Component for browser-only dependencies, and `NEXT_PUBLIC_` values are frozen into the browser bundle at build time. The implementation therefore keeps the server-rendered discovery result boundary and nests Mapbox behind one client-owned dynamic import.
- Reviewed on 2026-10-04: current official Mapbox documentation identifies Mapbox GL JS 3.32.0, requires `styles:read` and `fonts:read` for browser maps, recommends a non-default public token with approved-origin restrictions, restricts Search Box results to temporary use, and permits indefinite Geocoding v6 storage only with `permanent=true` plus eligible billing. The user is obtaining tokens in parallel, so local implementation and deterministic fallback validation may proceed while token-backed browser/staging evidence remains pending.

## Implementation plan

1. Add exact Mapbox GL JS 3.32.0 and checked-in placeholder/setup documentation for a non-default `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`; never commit a token value.
2. Define pure browser-configuration and Geocoding v6 response contracts. Use explicit submit-driven `permanent=true`/`autocomplete=false` forward-geocoding requests instead of Search Box so no temporary provider result can enter persistence.
3. Build the client-only lazy map boundary, synchronized portrait-or-initials coach pins and filter projection while retaining the server-backed list, profile navigation and bounded missing/invalid/provider/image-failure states.
4. Replace raw-coordinate-first independent setup with an accessible search/select/drag/confirm picker when configured, retain an explicit manual fallback, and narrow permanent provider validation to confirmed Mapbox input through DEV0096's existing owner mutation.
5. Add deterministic unit/browser/static coverage and run lint, typecheck, formatting plus standard Next.js and guarded Vercel builds. Keep the ticket `In progress` until a real restricted token proves the configured map/picker flow and staging usage monitoring.

## Acceptance criteria

- [ ] AC1: `/explore` shows one accessible, filterable coach list and—when configured—one synchronized Mapbox map using the same authorized result set.
- [ ] AC2: A coach can select an eligible fictional gym location or independently search, position and explicitly confirm one public location without browser geolocation or live tracking; only the owner can persist it through DEV0096.
- [ ] AC3: No temporary Search Box result is stored; every persisted Mapbox-derived label/coordinate uses a contemporaneously verified permanent-storage flow.
- [ ] AC4: A missing/invalid token, quota/network/CSP/WebGL/provider failure or absent coach location degrades to the working list and bounded messages without fabricated pins or lost navigation.
- [ ] AC5: The browser token has only public scopes, is URL-restricted per approved origin, is absent from committed values, and no secret-scope Mapbox token enters client bundles/logs.
- [ ] AC6: Map attribution remains visible, map initialization is lazy and singular, and mobile/desktop keyboard/screen-reader-oriented interactions do not make the map the only discovery path.
- [ ] AC7: Focused unit/browser tests, lint, typecheck, formatting and production builds pass; staging smoke evidence records origin restrictions, map/list behavior and usage monitoring without exposing tokens.
- [x] AC8: A configured Explore map shows each available public coach portrait inside that coach's accessible pin and uses initials when the portrait is missing or fails, without changing card/pin synchronization.

## Validation plan

Use deterministic adapter tests for successful map state, invalid configuration and provider failures; service/authorization tests owned with DEV0096 for confirmed location mutation; browser tests at mobile/desktop widths for list-first rendering, portrait/initials markers, image-error fallback, filter synchronization, card/pin selection, keyboard navigation and graceful map failure; static scans for secret tokens, multiple map initialization and prohibited geolocation APIs. Run relevant unit, lint, typecheck, formatting, standard Next.js and guarded Vercel builds. On staging, verify the URL-restricted token, attribution, selected-location persistence through the permanent flow and Mapbox usage dashboard/alerts without recording the token.

## Implementation record

Implementation started on 2026-10-04. The application work, fallback verification and configured local Explore-map verification are complete. The ticket remains `In progress` because permanent-geocoding account eligibility and picker behavior, token-origin restrictions, provider failure states and staging usage evidence have not yet been verified.

### Changes and rationale

- Added exact Mapbox GL JS 3.32.0 and a small provider module that validates browser configuration without logging token values, builds explicit Geocoding v6 requests with `permanent=true` and `autocomplete=false`, and maps bounded provider responses and failures into application-owned states. The persistable flow does not call Search Box, so temporary-use Search Box results cannot enter coach-profile persistence.
- Kept `/explore` list-first and server-backed, then placed Mapbox behind a Client Component dynamic import with `ssr: false`. The resulting list and map share the same filtered coach projection; cards and coach pins synchronize selection/focus, while missing/invalid/provider configuration leaves filtering and profile navigation available.
- Added a coach-facing location picker. Configured independent locations require an explicit search, candidate selection, optional marker drag and confirmation before submission. Existing fictional gyms still reuse their reviewed stored coordinates. Missing configuration exposes a labeled manual-coordinate fallback with the same explicit confirmation requirement rather than fabricating a provider result.
- Tightened the owner mutation/domain boundary so independent locations require confirmation and a permanently geocoded value is accepted only when its provider is exactly `mapbox`. The existing owner authorization, eligible-gym validation and provider-neutral persisted fields remain unchanged.
- Added responsive list/map and picker styling, imported the provider stylesheet once at the application root, and retained visible provider attribution and map navigation controls. No browser/device geolocation API is requested.
- Made each coach pin use the same optional public `portraitUrl` as the discovery card. A hidden initials layer remains underneath the portrait and becomes visible if the URL is absent or the browser reports an image error. Marker construction now restores `role="button"` after Mapbox's custom-marker setup replaces it with `role="img"`, so portrait pins retain their text label, pressed state and selection behavior.
- Documented local/deployment token setup and made the staging deployment helper require a public `pk` token with a valid-looking shape before uploading its value. The validation rejects secret/malformed values without printing them.
- Added unit, static, deployment, domain and browser coverage for configuration, permanent request construction, response parsing, secret/geolocation/Search Box exclusions, confirmation validation, missing-token degradation and the existing discovery flow.

### Affected files

- `package.json` and `package-lock.json`: pin Mapbox GL JS 3.32.0.
- `src/mapbox/provider.ts`: own public-token validation, permanent Geocoding v6 URL construction, bounded candidate parsing and provider-error classification.
- `src/features/coaches/coach-explore-results.tsx` and `src/features/coaches/mapbox-coach-map.tsx`: provide the client-only lazy map boundary, portrait-or-initials pins, accessible list/pin synchronization and bounded unavailable states.
- `src/features/coaches/coach-location-picker.tsx` and `src/features/coaches/mapbox-location-picker-map.tsx`: provide independent-location search, selection, draggable pin, explicit confirmation and manual fallback.
- `src/features/coaches/coach-discovery.tsx`, `src/features/coaches/coach-profile-editor.tsx`, `src/app/explore/page.tsx`, `src/app/profile/coach/page.tsx`, `src/app/profile/coach/actions.ts` and `src/domain/coaches.ts`: connect the new result/picker surfaces to existing discovery and owner-only persistence contracts and enforce confirmation/provider rules.
- `src/app/layout.tsx` and `src/app/coach-discovery.css`: load Mapbox CSS once and define responsive accessible list/map/picker presentation, including circular cropped marker portraits and initials fallback.
- `.env.example`, `README.md`, `scripts/validate-vercel-environment.mjs` and `vercel.json`: document and validate required environment/deployment configuration without committing a value. DEV0139 removed the earlier Cloudflare-only script/configuration after the hosting change.
- `tests/mapbox.test.ts`, `tests/coaches.test.ts`, `tests/staging-deployment.test.ts` and `tests/browser/coach-discovery.spec.ts`: cover provider contracts, domain validation, deployment secret handling and tokenless desktop/mobile behavior.
- No schema, migration or persisted data shape changed. DEV0096's provider-neutral location fields and owner mutation remain authoritative.

### Decisions and deviations

- 2026-10-03: Mapbox was selected over MapLibre/MapTiler and Google Maps for the P0 because implementation speed is the current priority. Provider-neutral persistence preserves a later migration path.
- 2026-10-04: Retained DEV0108 as one reviewable vertical slice. Explore rendering and coach location confirmation share the same provider/configuration adapter, token boundary, stored location contract and failure states; splitting them would duplicate the Mapbox boundary rather than isolate independent delivery.
- 2026-10-04: Use Mapbox GL JS 3.32.0, the current version in official documentation at review time.
- 2026-10-04: Do not call Search Box for the persistable coach-location flow because official terms restrict all Search Box results to temporary use. Explicit user-submitted Geocoding v6 requests use `permanent=true` and `autocomplete=false`; returned candidates may be stored under an eligible Mapbox account, avoid per-keystroke requests and require explicit selection/confirmation.
- 2026-10-04: Preserve a clearly labeled manual-coordinate fallback for missing/invalid provider configuration. This retains the existing provider-neutral coach-profile capability while Mapbox keys are pending and never fabricates a provider result.
- 2026-10-04: Keep the ticket open after the configured local Explore map passed. Local evidence now proves tiles, coach pins, attribution and card-to-map selection, but it does not prove live permanent geocoding, marker adjustment, origin restrictions, quota/CSP/WebGL failure recovery or provider usage monitoring.
- 2026-10-07: COR0011 adopted the scheduling-only branch. Mapbox discovery remains reusable but independent because the authoritative coach/time list must work without a map; cancelled COR0010 is historical context only.
- 2026-10-08: The standalone scheduling repository intentionally did not inherit ignored environment files, so its otherwise-complete Mapbox integration rendered the bounded missing-configuration state. Reuse only the existing restricted public `pk` token from the original project's ignored local environment in this repository's ignored `.env.local`; do not copy retired Solana or unrelated application configuration, and do not record the token value in source, logs or this ticket.
- 2026-10-08: Reuse `CoachProjection.portraitUrl` directly for map pins instead of adding a marker-only image request or storage contract. Initials stay in the marker DOM as the deterministic fallback. Mapbox overwrites custom marker semantics during construction, so the implementation explicitly restores the interactive button role after constructing each marker.

### Contracts, configuration, and operations

`NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` is now the public build-time configuration contract. Use distinct non-default, least-scope URL-restricted tokens for development, staging and production. The browser token requires public `styles:read` and `fonts:read` scopes; a `pk` token is intentionally browser-visible, but real values remain ignored deployment configuration and `sk` tokens are rejected. The guarded Vercel build validates the token shape when Mapbox is enabled.

The application adds `mapbox-gl@3.32.0`. Independent provider searches call Geocoding v6 forward geocoding only on explicit submission with `permanent=true`, `autocomplete=false`, a five-result limit and Germany/Berlin-biased request parameters. Search responses remain in component state until explicit confirmation. Mapbox account billing or enterprise eligibility for permanent storage, provider quotas and alerts still require release evidence.

The existing provider-neutral database shape is unchanged. Newly confirmed permanent-geocoding input recognizes only `mapbox`; manual input remains explicitly identified as manual. There are no new setup migrations, rollback steps or compatibility changes for existing coach/gym records. Removing the public token restores the bounded manual/list-first fallback rather than preventing application startup.

## Validation results

- Passed `npm test`: 63 tests, including provider URL/response/configuration coverage, coach-location validation and staging token rejection.
- Passed `DATABASE_TEST_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres node --conditions=react-server --import tsx --test --test-concurrency=1 tests/database/coaches.test.ts`: 3 owner/location database tests.
- Passed `npm run typecheck` and `npm run lint`.
- Passed `npm run build` for the Next.js production build with no public Mapbox token configured.
- Passed `npm run build` again with an ignored `.env.local` containing a valid public-token shape. Next.js loaded the local environment and completed the production build without exposing the token value.
- Historical validation passed `npm run build:vinext` before DEV0139 retired that adapter path. Current completion validation uses the standard Next.js and guarded Vercel builds; Mapbox remains isolated behind the dynamic client boundary.
- Passed `npm run format:check`, the targeted ticket/README Prettier check and `git diff --check`.
- Passed `npx playwright test tests/browser/coach-discovery.spec.ts`: 10/10 desktop/mobile discovery tests after resetting the documented disposable local database to its canonical seed.
- Passed the same focused browser suite again against the configured production build after making its map-state assertion valid for both configured and unconfigured developer environments: 10/10 desktop/mobile tests. The configured branch rendered five coach pins and visible attribution.
- Passed `npm run test:e2e`: 28/28 desktop/mobile browser tests on the canonical seed. An earlier full run was 26/28 because authenticated manual rehearsals had added discoverable coach records and invalidated the fixed five-record fixture assertion; the documented `npm run db:reset && npm run db:runtime` restored the test fixture and the unchanged suite then passed.
- Passed `npm run test:coach-availability` against a temporary canonical production server at `http://localhost:3102`.
- Passed an authenticated desktop/mobile manual-fallback rehearsal at `http://localhost:3102`: the owner entered independent coordinates, explicitly confirmed them, reached the confirmation control by keyboard before activation, persisted the profile and produced no page errors or mobile horizontal overflow. The first ad hoc script attempted to focus the confirmation button after it had correctly become disabled and was corrected as a test-step error.
- Visually inspected missing-token `/explore` and the authenticated manual picker at desktop and mobile widths. The coach list remained primary, the unavailable state was bounded and the picker/form remained usable.
- Passed an additional configured-map browser rehearsal at desktop and mobile widths: five database-backed coach pins and five `Show on map` controls rendered, Mapbox attribution was visible, card-to-map selection set the selected control, no horizontal overflow occurred and no page errors were observed. The user separately confirmed that the local map worked.
- Restored the standalone scheduling repository's ignored local Mapbox configuration on 2026-10-08 by copying only the existing validated public `pk` token from the original project's ignored environment into `.env.local`. The target contains only `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`, is ignored by `.gitignore`, has mode `0600`, and no token value was printed or added to the patch.
- Restarted the complete local stack with Node.js 24.21.0 through `npm run dev:local`; Next.js reported `.env.local`, the database-backed Explore page returned its canonical five coaches and the browser initialized Mapbox. A direct Chrome rehearsal at 1440 × 1040 and 393 × 852 observed the map canvas, five coach markers and visible attribution with zero missing-configuration messages, horizontal overflow or page errors.
- Passed `DATABASE_URL=postgresql://repx_runtime_login:postgres@127.0.0.1:55322/postgres npx playwright test tests/browser/coach-discovery.spec.ts --grep "guest browses and filters"`: 2/2 desktop/mobile configured-map checks. The suite verified Daniel Park's public portrait, Sam Lee's initials-only marker, selected-pin state, an induced portrait-load failure returning to `DP`, visible attribution, filtering and no horizontal overflow. The first assertion run identified that Mapbox had changed the native marker button to `role="img"`; restoring `role="button"` after marker construction fixed that accessibility defect and the rerun passed.
- Passed the current `npm test` (80 general tests and 2 React-server tests), `npm run typecheck`, `npm run lint` and `npm run build` with Node.js 24.21.0 after the portrait-marker change.
- The pre-commit scan detected that the public token had also been copied into tracked `.env.example`. The populated value was replaced with the documented placeholder before commit, `.env.local` remained ignored, and the staged patch was rescanned for realistic Mapbox token shapes. Rotate the exposed public token even though browser tokens are intentionally visible, then keep the replacement URL-restricted.
- Historical `npm audit --omit=dev --audit-level=high` reported seven findings through the former vinext dependency path. DEV0139 later removed that direct adapter chain; this ticket still must record the audit result from its final dependency graph.
- Not run: pin-to-card selection, live permanent-geocoding search, marker drag/confirmation, proof that the Mapbox account permits permanent result storage, rejected-token/quota/network/CSP/WebGL runtime states, configured-origin restriction checks, staging behavior and provider usage/alert review. These outstanding checks keep AC1-AC7 unchecked and the ticket `In progress`.

## Risks, limitations, and follow-ups

Provider terms, pricing, browser rendering support and token misuse can change. The list-first architecture limits outages and lock-in, but replacing Mapbox still requires a later frontend provider ticket. Coach-selected locations can be misleading or unsafe without moderation; real-coach onboarding needs reporting and location-precision policy beyond the fictional MVP.

The Explore map now has local live-provider evidence, but the configured location picker and operational controls do not. Before completion, verify the account may store permanent Geocoding results, prove approved-origin restrictions, exercise the remaining configured map/picker and failure interactions in staging, and inspect Mapbox usage/alerts. Use the active Vercel deployment contract rather than restoring the retired adapter path.

## Completion and review references

- Completed: Not completed.
- Commit: Planning commit — `[DEV0107][DEV0108] Adopt Mapbox coach discovery`; runtime implementation — this commit, `[DEV0108] Add Mapbox coach discovery`.
- Review: Local self-review against the ticket; no independent review.
- Deployment or release: None.
