# Ticket DEV0108: Add the Mapbox coach Explore map

- Status: Draft
- Created: 2026-10-03
- Last updated: 2026-10-03
- Milestone: Coach-first M1 location discovery
- Coordination: [COR0009 — Coach-first private-class booking MVP](../organisatory/COR0009-coach-first-training-package-mvp.md)
- Related records: depends on provider-neutral coach-location persistence and public discovery from [DEV0096 — Persist coach profiles and discovery](../backend/DEV0096-persist-coach-profiles-and-discovery.md); consumes stable slot-location projections from [DEV0104 — Publish weekly coach availability](../backend/DEV0104-publish-weekly-coach-availability.md); contract adopted by [DEV0107 — Adopt the Mapbox coach-discovery contract](../../archive/organisatory/DEV0107-adopt-mapbox-coach-discovery-contract.md)

## Objective and context

Add an accessible `/explore` experience where guests see the same filtered coach results as a list and on one interactive Mapbox map. Provide a coach-facing Mapbox search/pin-confirmation component for choosing one public discovery location. The location is coach-selected public profile data, not live tracking, browser/device location or a claim that the coach is currently present or available.

Mapbox is the confirmed P0 provider because delivery speed is the current priority. PostgreSQL remains authoritative for the confirmed location snapshot supplied by DEV0096; Mapbox renders and helps select it but is not queried to reconstruct stored profiles on every read.

## Scope and non-goals

- In scope: install and configure the reviewed Mapbox GL JS version; one client-only lazy-loaded Explore map; provider adapter and bounded configuration states; responsive list/map layout; coach pins synchronized with accessible coach cards; filters supplied by discovery; empty/loading/unavailable states; coach address/place suggestions plus draggable pin confirmation integrated with DEV0096's owner form; storage-permitted final geocoding; visible attribution; least-scope URL-restricted public-token setup; load/quota safeguards; focused browser/unit/static/build tests.
- Out of scope: collecting browser/device geolocation, live tracking, background location, directions/navigation, distance-from-me sorting, route matrices, multiple coach locations, travel radius, per-slot venue choice, custom tilesets, 3D maps, offline maps, self-hosted tiles, changing Mapbox billing/account settings automatically or implementing coach/slot persistence owned by DEV0096/DEV0104.

## Expected behavior and edge cases

Explore first renders a usable coach list from DEV0096. When a valid Mapbox public token and browser support are available, one map initializes lazily and shows one pin for each visible coach with a confirmed public location. Selecting a card focuses its pin; selecting a pin identifies and focuses the corresponding accessible card without replacing navigation to the coach profile. Filters update list and pins from one result set. The interface explicitly labels pins as coach-selected training locations; “available” appears only when authoritative DEV0104 slots exist.

The owning coach enters a location query, reviews suggestions, selects a candidate, adjusts the pin if necessary and explicitly confirms the public label and coordinates before DEV0096 persists them. Temporary suggestion responses remain in memory only. The persisted final location must be produced through a Mapbox mode that permits permanent storage. The server rejects malformed/out-of-bounds coordinates and cannot trust a browser-supplied provider label without the adopted verification/confirmation contract.

Missing configuration, token rejection, quota exhaustion, network/CSP/WebGL failure and map initialization errors show a bounded map-unavailable message while the list, filters and profile navigation continue to work. No fixture pin substitutes for unavailable database data. The map never requests current device location.

## Assumptions, decisions, and dependencies

- Confirmed by the user on 2026-10-03: use Mapbox for P0 and do not implement live tracking; each coach chooses where the public pin appears.
- Use a dedicated `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` public token with only required public scopes and approved local/staging/production URL restrictions. Public `pk` tokens are intentionally browser-visible; Mapbox `sk` tokens are prohibited from client code and committed files.
- Current [Mapbox Search Box documentation](https://docs.mapbox.com/api/search/search-box/) says `/suggest` and `/retrieve` results are temporary-use only. They may assist the active selection session but cannot be stored. A selected provider result persisted by MovX must be resolved through the [Geocoding API](https://docs.mapbox.com/api/search/geocoding/) with permanent storage enabled, or replaced by another documented storage-permitted flow after terms review.
- The current Geocoding API requires `permanent=true` and an account with a valid payment method or enterprise agreement for indefinite result storage. Implementation must verify the contemporary rule before enabling persistence.
- Follow Mapbox's [token security guidance](https://docs.mapbox.com/help/dive-deeper/how-to-use-mapbox-securely/): do not use the unrestricted default token for deployment, grant only needed public scopes and restrict approved web origins.
- Stored location fields are provider-neutral and do not require Mapbox to render the coach list. DEV0096 owns schema, authorization and service persistence; DEV0104 owns slot snapshots; this ticket owns Mapbox UI/provider integration.
- Before implementation, inspect the installed Next.js documentation for client-only third-party libraries, dynamic loading and environment exposure, and inspect the installed/current Mapbox package documentation.

## Implementation plan

1. Freeze the provider adapter, permanent-result, public-token, map-state and accessible list/map interaction contracts after reviewing installed Next.js and current Mapbox documentation.
2. Add Mapbox GL JS and checked-in placeholder configuration documentation; create separate restricted public tokens operationally for approved origins without committing token values.
3. Build the client-only lazy map boundary, synchronized cards/pins and filter projection with list-first server rendering and bounded unavailable states.
4. Build the coach search/pin-confirmation component; keep suggestions ephemeral and send only a storage-permitted confirmed location through DEV0096's mutation contract.
5. Add deterministic provider mocks, accessibility/responsive browser scenarios, configuration/security assertions and one staging smoke check with usage monitoring.

## Acceptance criteria

- [ ] AC1: `/explore` shows one accessible, filterable coach list and—when configured—one synchronized Mapbox map using the same authorized result set.
- [ ] AC2: A coach can search, position and explicitly confirm one public location without any browser geolocation or live tracking; only the owner can persist it through DEV0096.
- [ ] AC3: No temporary Search Box result is stored; every persisted Mapbox-derived label/coordinate uses a contemporaneously verified permanent-storage flow.
- [ ] AC4: A missing/invalid token, quota/network/CSP/WebGL/provider failure or absent coach location degrades to the working list and bounded messages without fabricated pins or lost navigation.
- [ ] AC5: The browser token has only public scopes, is URL-restricted per approved origin, is absent from committed values, and no secret-scope Mapbox token enters client bundles/logs.
- [ ] AC6: Map attribution remains visible, map initialization is lazy and singular, and mobile/desktop keyboard/screen-reader-oriented interactions do not make the map the only discovery path.
- [ ] AC7: Focused unit/browser tests, lint, typecheck, formatting and production builds pass; staging smoke evidence records origin restrictions, map/list behavior and usage monitoring without exposing tokens.

## Validation plan

Use deterministic adapter tests for successful map state, invalid configuration and provider failures; service/authorization tests owned with DEV0096 for confirmed location mutation; browser tests at mobile/desktop widths for list-first rendering, filter synchronization, card/pin selection, keyboard navigation and graceful map failure; static scans for secret tokens, multiple map initialization and prohibited geolocation APIs. Run relevant unit, lint, typecheck, formatting, Next.js and Cloudflare builds. On staging, verify the URL-restricted token, attribution, selected-location persistence through the permanent flow and Mapbox usage dashboard/alerts without recording the token.

## Implementation record

Not started.

### Changes and rationale

Pending implementation.

### Affected files

Planned: `package.json`/lockfile, `.env.example`, Mapbox provider/config modules, Explore route/features/styles, coach location picker integration, operational setup documentation and focused tests. DEV0096 owns the schema/service mutation files and records them in its own implementation evidence.

### Decisions and deviations

- 2026-10-03: Mapbox was selected over MapLibre/MapTiler and Google Maps for the P0 because implementation speed is the current priority. Provider-neutral persistence preserves a later migration path.

### Contracts, configuration, and operations

Planned public configuration: `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`, using distinct least-scope URL-restricted tokens for development/staging/production. A public token is not a secret, but real values remain ignored deployment configuration. Provider dependency, CSP/resource origins, Mapbox account billing/permanent-geocoding eligibility, quotas and alerts require implementation/release evidence. No database contract is owned here.

## Validation results

Not run — implementation has not started.

## Risks, limitations, and follow-ups

Provider terms, pricing, browser rendering support and token misuse can change. The list-first architecture limits outages and lock-in, but replacing Mapbox still requires a later frontend provider ticket. Coach-selected locations can be misleading or unsafe without moderation; real-coach onboarding needs reporting and location-precision policy beyond the fictional MVP.

## Completion and review references

- Completed: Not completed.
- Commit: Planning commit: This commit — `[DEV0107][DEV0108] Adopt Mapbox coach discovery`; runtime implementation has not started.
- Review: Planning self-review only; no independent review.
- Deployment or release: None.
