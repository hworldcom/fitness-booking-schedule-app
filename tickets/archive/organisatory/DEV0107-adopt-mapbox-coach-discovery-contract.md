# Ticket DEV0107: Adopt the Mapbox coach-discovery contract

- Status: Completed
- Created: 2026-10-03
- Last updated: 2026-10-14
- Milestone: Coach-first location-discovery correction
- Coordination: None — independent development ticket
- Related records: Independent retained outcome; superseded dependencies pruned under DEV0225.

> Documentary pruning — 2026-10-14, [DEV0225](DEV0225-remove-blockchain-historical-evidence.md): superseded feature evidence and deleted-reference details were removed at the user’s request. Retained text records the independent outcome at its original date. Code/data fragments are historical excerpts, not complete current contracts; aggregate test totals remain totals of the original runs, not new retained-only validation. Original completion dates remain unchanged. Earlier revisions remain in Git history.

## Objective and context

Adopt the user's decision to prioritize implementation speed by using Mapbox for the P0 Explore map. Coaches choose the public location at which they want to appear; MovX does not collect or display live location. The current coach-first contract has location text but no map-provider, persistence, privacy, slot-location or failure-mode boundary.

This ticket owns the product/work-record correction before map integration begins. It does not implement Mapbox, schema, routes or interfaces.

## Scope and non-goals

- Out of scope: installing Mapbox packages, creating tokens, editing environment files, schema/runtime implementation, browser geolocation, live tracking, proximity sorting from a client's location, directions/navigation, multiple coach venues, travel-radius polygons, per-slot venue selection, production launch or Mapbox account/billing changes.

## Expected behavior and edge cases

A coach chooses one public display location through an address/place search and pin confirmation flow. MovX persists a provider-neutral public label and longitude/latitude only after explicit confirmation. Explore remains useful as an accessible coach list; when Mapbox is configured and available, one lazy-loaded map presents the same filtered coaches as pins. A pin means “this coach chose to be discovered here,” not “the coach is here now” and not “the coach is available now.” Availability comes only from authoritative weekly slots.

New slots snapshot the coach's chosen public location so later profile edits cannot silently move an existing held or booked class. Existing open slots may change location only through DEV0104's explicit unbooked-slot edit rules. Booking views display the slot snapshot. P0 supports one public coach location; multiple venues and per-slot venue selection are deferred.

Mapbox Search Box `/suggest` and `/retrieve` responses are temporary-use data under the current service rules and cannot become stored profile coordinates. Any Mapbox geocoding result persisted by MovX must come from a storage-permitted permanent Geocoding API request; temporary suggestions remain ephemeral. Missing configuration, rejected tokens, quota exhaustion, network failure and map initialization failure preserve the list and expose a bounded map-unavailable state.

## Assumptions, decisions, and dependencies

- Confirmed by the user on 2026-10-03: Mapbox is the P0 mapping provider because delivery speed currently matters more than provider independence.
- Confirmed by the user on 2026-10-03: coaches choose the location where they are shown; no live tracking is wanted.
- The stored contract remains provider-neutral: public label, longitude, latitude, source/provider metadata and confirmation time. A provider feature ID is optional metadata, not the identity or authority of the coach location.
- The browser uses a dedicated least-scope Mapbox public token with URL restrictions for each approved origin. Secret-scope tokens never enter browser code or committed configuration.
- Mapbox attribution remains visible. One lazy-loaded map instance serves Explore; map loads are not multiplied per coach card. Usage alerts/limits and a list-only fallback are required.
- Current [Mapbox Geocoding API documentation](https://docs.mapbox.com/api/search/geocoding/) says permanent result storage requires `permanent=true` plus a valid payment method or enterprise agreement. Current [Search Box documentation](https://docs.mapbox.com/api/search/search-box/) limits returned data to temporary use unless Mapbox agrees otherwise. DEV0108 must recheck the installed SDK and contemporary terms before implementation.
- Mapbox documents public versus secret tokens and URL restrictions in its [access-token guide](https://docs.mapbox.com/help/dive-deeper/access-tokens/). The implementation must create a non-default token for the approved origins rather than reuse an unrestricted account default.

## Implementation plan

1. Update the MVP specification's decisions, discovery flow, data/authority model, definition of done, milestone and acceptance scenarios for coach-selected Mapbox locations.
2.
3. Create a focused frontend ticket for the Mapbox location picker and accessible list/map Explore experience, including token/configuration, permanent-result and fallback boundaries.
4.
5. Run Markdown formatting, local-link, unique-ID/index, reciprocal coordination, terminology and whitespace checks.

## Acceptance criteria

- [x] AC1: The current specification distinguishes a coach-chosen public location from live location and slot availability, adopts Mapbox for P0, and keeps list discovery functional without the map.
- [x] AC2: Current work records assign location persistence, stable slot/booking snapshots and Mapbox interface/provider work to exactly one owner each.
- [x] AC3: The implementation ticket prohibits storage of temporary Search Box results, requires storage-permitted permanent geocoding for persisted provider results, and defines least-scope URL-restricted public-token handling.

- [x] AC5: No application, schema, dependency, token, account, environment or deployment change occurs under this documentation ticket.

## Validation plan

Review official Mapbox access-token, Search Box and Geocoding API documentation; search the specification and current work records for live/current location, exact distance, map, geocoding, Explore and slot-location claims. Runtime and Mapbox account tests are not applicable because this ticket changes documentation and planning only.

## Implementation record

Completed the Mapbox location-discovery contract and work-map correction without changing application code, dependencies, configuration or provider accounts.

### Changes and rationale

- Adopted Mapbox as the P0 provider while keeping an accessible list as the reliable discovery baseline.
- Defined one coach-selected public location without device geolocation or live/current-presence claims, plus provider-neutral stored fields and stable slot/booking location snapshots.
- Recorded the current Mapbox storage boundary: Search Box results are temporary-use data; a persisted Mapbox-derived result requires a storage-permitted permanent Geocoding API flow.
- Defined non-default least-scope URL-restricted public tokens, visible attribution, singular lazy map initialization, graceful provider failure and usage monitoring as implementation requirements.

### Affected files

- `docs/mvp-spec.md` owns the Mapbox/location decisions, Explore flow, data/authority model, definition of done, milestone, acceptance matrix and judge path.
- `README.md` names coach-selected locations and the planned list/Mapbox Explore view without claiming delivery.

- `tickets/archive/frontend/DEV0108-add-mapbox-coach-explore-map.md` owns the historical Mapbox GL JS, picker, Explore list/map UI, provider rules and operational validation record.

### Decisions and deviations

- 2026-10-03: The user selected Mapbox for P0 because implementation speed is the priority and explicitly rejected live tracking.
- 2026-10-03: Adopted one provider-neutral public location per coach for P0 and deferred multiple venues/service areas. This keeps the first discovery and picker flow bounded without making the provider's feature identifier authoritative.
- 2026-10-03: Adopted a location snapshot on slot creation so a later profile edit cannot silently move an open, held or confirmed class. Explicit unbooked-slot edits remain with DEV0104.
- 2026-10-03: Required list-first discovery, permanent geocoding for stored Mapbox-derived results and a restricted non-default public token after review of the current official provider documentation.

### Contracts, configuration, and operations

Product and delivery contracts changed. No runtime dependency, environment value, provider token/account, database schema, route, migration or deployment changed. DEV0108 plans `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`; DEV0096/DEV0104 plan the provider-neutral schema and snapshots.

## Validation results

- Reviewed current official Mapbox access-token, token-security, Search Box and Geocoding API documentation on 2026-10-03 and linked it from the implementation ticket.
- Passed Prettier write/check across every changed Markdown file and `git diff --check` with no whitespace errors.
- Passed repository-local link validation across 132 Markdown files with zero missing targets.
- Passed work-record validation with 110 unique DEV/COR identifiers and every record indexed once.

- Confirmed the diff contains only README, the specification and work records. Application, database, browser, Mapbox account and deployment checks were not run because this ticket changes documentation/planning only.

## Risks, limitations, and follow-ups

Map availability and geocoding are external dependencies; the list must remain the reliable discovery baseline. Persisting temporary provider search results would violate the intended provider contract. Location precision, moderation and misleading coach-selected pins require later operational policy before real-coach onboarding.

## Completion and review references

- Completed: 2026-10-03.
- Commit: This commit — `[DEV0107][DEV0108] Adopt Mapbox coach discovery`.
- Review: Product decision confirmed by the user; documentation/work-map self-review completed.
- Deployment or release: None.
