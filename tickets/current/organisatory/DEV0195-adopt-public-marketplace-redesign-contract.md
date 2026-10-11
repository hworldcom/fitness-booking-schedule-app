# Ticket DEV0195: Adopt the public marketplace redesign contract

- Status: Draft
- Created: 2026-10-12
- Last updated: 2026-10-12
- Milestone: Scheduling interface public-marketplace follow-up
- Coordination: [COR0017 — Public marketplace redesign](COR0017-public-marketplace-redesign.md)
- Related records: implementation peers [DEV0196 — Introduce the public marketplace shell](../frontend/DEV0196-introduce-public-marketplace-shell.md), [DEV0197 — Share public marketplace search](../frontend/DEV0197-share-public-marketplace-search.md), [DEV0198 — Build the search-first marketplace home](../frontend/DEV0198-build-search-first-marketplace-home.md), [DEV0199 — Redesign desktop coach Explore](../frontend/DEV0199-redesign-desktop-coach-explore.md), [DEV0200 — Add mobile Explore map/list state](../frontend/DEV0200-add-mobile-explore-map-list-state.md) and [DEV0201 — Polish public marketplace accessibility](../frontend/DEV0201-polish-public-marketplace-accessibility.md)

## Objective and context

Adopt an authoritative product contract for the proposed search-first public marketplace before changing shared navigation or discovery interfaces. The current [MVP specification](../../../docs/mvp-spec.md#4-primary-user-flows) truthfully defines coach discovery, primary map locations and coach-confirmed requests but does not require a search-first homepage, route-specific public shell or mobile map/list view state.

The user asked to review the redesign proposal and create tickets; that authorizes planning, not silently accepting every open design choice. This ticket must distinguish adopted decisions from proposed defaults and give DEV0196-DEV0201 one testable interface contract.

## Scope and non-goals

- In scope:
  - Update the confirmed decision register, guest flow, discovery permissions, definition of done, M3 interface milestone and acceptance matrix for the adopted public information architecture.
  - Define which routes use public top navigation and which retain capability-aware workspace navigation.
  - Define homepage data sources, truthful ordering/labels, supported search fields and empty/unavailable behavior.
  - Define desktop split-map and mobile list/map behavior without changing primary-location or map-fallback semantics.
  - Explicitly decide the proposed defaults recorded below.
- Out of scope:
  - Runtime components, CSS, APIs, schema, map providers, analytics or booking-rule changes.
  - `When`, weekly aggregation, proximity, prices, ratings, reviews, live location and gym-marketplace behavior.

## Expected behavior and edge cases

- Public pages prioritize working discovery controls and real inventory while preserving demo disclosure and pending-request language.
- Every displayed search control has existing end-to-end semantics; absent contracts do not appear as disabled or decorative controls.
- Signed-in users retain clear routes to private destinations even though public pages no longer use the workspace sidebar.
- Public map pins remain coach-selected primary training bases, not live positions or availability guarantees.
- Database or map failure produces explicit unavailable/fallback content and never substitutes fabricated coaches, times or locations.

## Assumptions, decisions, and dependencies

- Confirmed: the redesign remains within the scheduling-only product and retains current MovX identity rather than copying another brand.
- Confirmed: no booking, confirmation, map-authority or fictional-data rule changes are part of this initiative.
- Proposed default pending explicit adoption: the homepage reads real public directory data and shows a bounded alphabetical `Discover coaches` preview rather than a static link-only facade or `Near you` claim.
- Proposed default pending explicit adoption: first delivery exposes only existing `q`, `discipline` and `location` semantics. It omits `When` and `Available this week` until a separate occurrence-query contract exists.
- Proposed default pending explicit adoption: public mobile routes use one compact header/menu and no persistent bottom navigation; private workspace routes retain capability-aware navigation.
- No runtime ticket may start until these defaults are confirmed or replaced and this ticket becomes Ready/Completed.

## Implementation plan

1. Record the adopted public-shell routes and actor-aware navigation guarantees.
2. Specify search-first homepage ordering, server-backed preview data, supported filters and honest empty/unavailable states.
3. Specify compact Explore presentation, desktop sticky split map and URL-backed mobile view state while preserving filter and map contracts.
4. Add definition-of-done and acceptance scenarios for signed-out/signed-in navigation, search links, map failure, responsive view switching and truthful request language.
5. Reconcile COR0017 and all direct ticket boundaries, then run Markdown formatting, link and consistency checks.

## Acceptance criteria

- [ ] AC1: The specification clearly distinguishes public and workspace navigation without weakening capability-aware private routes.
- [ ] AC2: Homepage and Explore data/search behavior is explicit, uses only authoritative sources and excludes unsupported `When`, proximity, price, rating and review claims.
- [ ] AC3: Desktop/mobile map presentation preserves primary-location meaning, filter state, list fallback and coach-confirmation language.
- [ ] AC4: COR0017 and DEV0195-DEV0201 agree on decisions, ownership, sequence and acceptance scenarios without duplicating implementation scope.

## Validation plan

- Run Prettier against every changed Markdown file and `git diff --check`.
- Validate affected relative links, unique IDs, reciprocal COR0017 membership and the ticket index next-ID values.
- Use targeted text checks to confirm the decision register, guest flow, permissions, definition of done, milestone and acceptance matrix contain the adopted contract with no contradictory navigation/search language.
- Application tests are not applicable because this ticket changes only product/documentation contracts.

## Implementation record

Pending implementation.

### Changes and rationale

Pending implementation.

### Affected files

| File or component | Change and purpose |
| ----------------- | ------------------ |
| Pending           | Pending.           |

### Decisions and deviations

- 2026-10-12: Recorded the three unresolved proposal choices as proposed defaults rather than confirmed user decisions.

### Contracts, configuration, and operations

This ticket will change the product/interface contract but adds no runtime interface, schema, dependency, environment variable or migration.

## Validation results

Pending validation.

| Criterion | Evidence | Result  |
| --------- | -------- | ------- |
| AC1       | Pending  | Not run |
| AC2       | Pending  | Not run |
| AC3       | Pending  | Not run |
| AC4       | Pending  | Not run |

## Risks, limitations, and follow-ups

- Public navigation and homepage preview choices materially affect several runtime tickets, so this ticket must not be bypassed as “visual-only” planning.
- Future availability/date search requires a separate contract that defines date, range, timezone, open-state and stale-result semantics.

## Completion and review references

- Completed: Not completed.
- Commit: Planning record included in the commit whose subject references DEV0195-DEV0201; implementation not started.
- Review: No review created.
- Deployment or release: Documentation only; not deployed or released.
