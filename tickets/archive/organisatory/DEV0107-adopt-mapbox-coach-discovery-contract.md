# Ticket DEV0107: Adopt the Mapbox coach-discovery contract

- Status: Completed
- Created: 2026-10-03
- Last updated: 2026-10-03
- Milestone: Coach-first location-discovery correction
- Coordination: [COR0009 — Coach-first private-class booking MVP](COR0009-coach-first-training-package-mvp.md)
- Related records: refines coach discovery in [DEV0096](../backend/DEV0096-persist-coach-profiles-and-discovery.md), weekly slot location in [DEV0104](../backend/DEV0104-publish-weekly-coach-availability.md), historical booking presentation in cancelled [DEV0105](../backend/DEV0105-book-private-classes-with-pass-credits.md), and creates [DEV0108 — Add the Mapbox coach Explore map](../../current/frontend/DEV0108-add-mapbox-coach-explore-map.md)

## Objective and context

Adopt the user's decision to prioritize implementation speed by using Mapbox for the P0 Explore map. Coaches choose the public location at which they want to appear; MovX does not collect or display live location. The current coach-first contract has location text but no map-provider, persistence, privacy, slot-location or failure-mode boundary.

This ticket owns the product/work-record correction before map integration begins. It does not implement Mapbox, schema, routes or interfaces.

## Scope and non-goals

- In scope: define one coach-selected public discovery point for P0; choose Mapbox GL JS and Mapbox-hosted maps/geocoding; retain provider-neutral stored location fields; distinguish a discovery pin from live presence and weekly availability; bind slots/bookings to stable location snapshots; define persistent-geocoding, public-token, attribution, cost-guard and list-fallback requirements; revise affected COR0009 peers; create a focused frontend implementation ticket; update the specification, README, COR0009 and ticket index.
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
2. Correct DEV0095, DEV0096, DEV0104, DEV0105 and DEV0106 so public navigation, persistence, slot snapshots, booking display and hosted evidence have explicit non-overlapping ownership.
3. Create a focused frontend ticket for the Mapbox location picker and accessible list/map Explore experience, including token/configuration, permanent-result and fallback boundaries.
4. Add the new peers and delivery order to COR0009 and the root ticket index; update README's target-status summary without claiming implementation.
5. Run Markdown formatting, local-link, unique-ID/index, reciprocal coordination, terminology and whitespace checks.

## Acceptance criteria

- [x] AC1: The current specification distinguishes a coach-chosen public location from live location and slot availability, adopts Mapbox for P0, and keeps list discovery functional without the map.
- [x] AC2: Current work records assign location persistence, stable slot/booking snapshots and Mapbox interface/provider work to exactly one owner each.
- [x] AC3: The implementation ticket prohibits storage of temporary Search Box results, requires storage-permitted permanent geocoding for persisted provider results, and defines least-scope URL-restricted public-token handling.
- [x] AC4: COR0009 and the ticket index include the Mapbox Explore deliverable with explicit dependencies, and repository-local links, IDs, statuses, formatting and terminology checks pass.
- [x] AC5: No application, schema, dependency, token, account, environment or deployment change occurs under this documentation ticket.

## Validation plan

Review official Mapbox access-token, Search Box and Geocoding API documentation; search the specification and current work records for live/current location, exact distance, map, geocoding, Explore and slot-location claims. Run Prettier, `git diff --check`, repository-local Markdown target validation, unique record/index validation, current/archive status validation and reciprocal COR0009 membership validation. Runtime and Mapbox account tests are not applicable because this ticket changes documentation and planning only.

## Implementation record

Completed the Mapbox location-discovery contract and work-map correction without changing application code, dependencies, configuration or provider accounts.

### Changes and rationale

- Adopted Mapbox as the P0 provider while keeping an accessible list as the reliable discovery baseline.
- Defined one coach-selected public location without device geolocation or live/current-presence claims, plus provider-neutral stored fields and stable slot/booking location snapshots.
- Recorded the current Mapbox storage boundary: Search Box results are temporary-use data; a persisted Mapbox-derived result requires a storage-permitted permanent Geocoding API flow.
- Defined non-default least-scope URL-restricted public tokens, visible attribution, singular lazy map initialization, graceful provider failure and usage monitoring as implementation requirements.
- Revised DEV0095, DEV0096 and DEV0104–DEV0106 and created DEV0108 so public story, persistence, slots, booking, Mapbox interface and hosted evidence have explicit owners.

### Affected files

- `docs/mvp-spec.md` owns the Mapbox/location decisions, Explore flow, data/authority model, definition of done, milestone, acceptance matrix and judge path.
- `README.md` names coach-selected locations and the planned list/Mapbox Explore view without claiming delivery.
- DEV0095 and DEV0096 separate truthful public navigation from provider-neutral coach/location persistence.
- DEV0104 and DEV0105 preserve location through slot snapshots and booking presentation; DEV0106 owns hosted provider/fallback evidence.
- `tickets/current/frontend/DEV0108-add-mapbox-coach-explore-map.md` owns Mapbox GL JS, the picker, Explore list/map UI, provider rules and operational validation.
- COR0009 and `tickets/README.md` record the new work boundary, dependency order and next identifiers.

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
- Passed post-archive lifecycle validation across 18 current and 92 archived records; all 14 direct COR0009 DEV records have reciprocal membership.
- Confirmed the diff contains only README, the specification and work records. Application, database, browser, Mapbox account and deployment checks were not run because this ticket changes documentation/planning only.

## Risks, limitations, and follow-ups

Map availability and geocoding are external dependencies; the list must remain the reliable discovery baseline. Persisting temporary provider search results would violate the intended provider contract. Location precision, moderation and misleading coach-selected pins require later operational policy before real-coach onboarding.

## Completion and review references

- Completed: 2026-10-03.
- Commit: This commit — `[DEV0107][DEV0108] Adopt Mapbox coach discovery`.
- Review: Product decision confirmed by the user; documentation/work-map self-review completed.
- Deployment or release: None.
