# Ticket DEV0377: Separate Berlin gym and address search

- Status: In progress
- Created: 2026-10-19
- Last updated: 2026-10-19
- Milestone: UAT coach onboarding
- Coordination: [COR0031 — Berlin training-location onboarding](../organisatory/COR0031-berlin-training-location-onboarding.md)
- Related records: Peer [DEV0376](../backend/DEV0376-curate-uat-reviewed-gym-catalog.md); historical [DEV0375](../../archive/backend/DEV0375-enable-uat-gym-and-place-search.md), [DEV0174](../../archive/frontend/DEV0174-decouple-location-services.md).

## Objective and context

Current independent-location search merges gym and arbitrary address results and only biases toward Berlin; gym search covers a 50 km circle. The user requested fitness facilities in the Berlin area and clarified: gym search first, adding an own-defined address second. Deliver explicit modes with gym search as the default and Berlin-limited queries/results, following [C10/C23](../../../docs/mvp-spec.md#2-confirmed-target-and-decisions) and [location boundaries](../../../docs/mvp-spec.md#6-application-and-infrastructure-boundaries).

## Scope and non-goals

Location adapter, picker labels/modes, focused tests, current specification/setup guidance and UAT release. Gym mode queries only the named fitness/dojo/sports-facility categories. Own address uses a separate Berlin address search and retains manual label/coordinate entry. Both provider searches must use a geographic constraint and reject non-Berlin results; fitness results also require an accepted category. Preserve bounded storage, explicit confirmation, legacy locations, map attribution, keyboard behavior, cancellation and failure recovery.

Exclude automatic global catalog insertion, schema/persistence/server authority changes, new providers/dependencies, enforcing new restrictions on already saved/manual locations, changing production/staging, profile saves during QA and unrelated open browser-test edits.

## Expected behavior and edge cases

New searches start with Gym search. Own address is a distinct second option; its manual path remains usable when search is unavailable. A gym lookup never calls general geocoding or displays arbitrary addresses. Address lookup does not merge gym results. Berlin spatial constraints plus country/city validation exclude other cities and general outside-area responses. Empty, malformed, missing-config, rejected-key, quota, provider and aborted requests have honest usable outcomes. Choosing another mode cancels obsolete requests. Nothing is persisted by search/selection alone.

## Assumptions, decisions, and dependencies

The user clarification was received before implementation. Retain existing Geoapify categories and public key. Prefer a provider-supported Berlin administrative boundary if actual probes work; otherwise use a documented Berlin bounding rectangle together with strict Berlin/DE result metadata, avoiding a large client geometry dependency. This is lookup scope, not a legal boundary or a new server constraint on manual data. Installed Next.js 16.3.8 client/environment guidance and current official Geoapify docs were inspected before integration changes. UAT deployment continues the user's authorized commit/release iteration; preserve the repository's separate staging project link.

## Implementation plan

1. Probe official Geoapify geographic filters against real Chimosa and a Berlin address; record the adopted filter before editing the adapter.
2. Give the search operation an explicit gym/address mode, one appropriate endpoint per request, Berlin spatial constraints and defensive category/city/coordinate parsing. Keep provider-neutral result shapes and errors.
3. Present Gym search first and Own address second, with address/manual recovery inside the latter. Update labels/placeholders/help/empty states and cancel obsolete requests without submitting the parent form.
4. Update meaningful unit tests for endpoint isolation, geography/category rejection, bounds/dedup, invalid input, errors and abort. Update specification and README consistently.
5. Run focused/full unit checks, lint, typecheck and hosted build; review owned diffs and preserve unrelated edits. Commit only scoped changes with DEV IDs, export the exact source to the dedicated UAT Preview project, explicitly select fra1, verify READY then switch only the UAT alias.
6. Native desktop/phone checks: reviewed Chimosa option, gym Chimosa selection, separate Berlin own-address selection, outside-Berlin/general-address negative gym lookup, empty/keyboard/manual recovery. Do not Save the existing user's profile. Record actual release, rollback and all results; complete/archive only after required checks pass.

## Acceptance criteria

- [x] AC1: Gym-first and own-address modes use separate endpoints, with geographic/city restrictions and fitness-only gym results.
- [ ] AC2: Responsive picker supports both modes, explicit confirmation, keyboard/error/empty/cancellation and manual recovery without incidental persistence.
- [ ] AC3: Meaningful location tests and applicable lint/type/build checks pass; specification/setup guidance match the adopted behavior and unrelated edits remain preserved.
- [ ] AC4: Exact-source UAT Frankfurt Preview is live; actual desktop and phone checks pass alongside Chimosa-only reviewed catalog, with release/rollback evidence recorded.

## Validation plan

Unit tests of requests/results/errors/cancellation; real provider probes; existing unit/server suite, lint/typecheck/build; native desktop/375 px phone UI including Enter and manual/empty paths; direct public/protected HTTPS routes and Vercel deployment/alias/environment metadata. No DB migration or broad DB suite applies because storage/authorization are unchanged. DEV0376 separately owns catalog preservation.

## Implementation record

### Changes and rationale

Replaced merged two-endpoint search with explicit gym (default) and place modes. Gym calls only Places; Own address calls only Geocoding. Both use Berlin’s administrative place filter and proximity ordering; parsing additionally requires Berlin/DE metadata and finite numeric coordinates inside the official Berlin outer bounds. Gym parsing also requires one of the existing accepted categories. Picker offers Gym search first, Own address second and manual entry within Own address; mode changes abort/clear obsolete queries/results, and late aborted errors are ignored. Explicit confirmation, map attribution and existing persistence shapes remain unchanged.

### Affected files

[Geoapify adapter](../../../src/location/providers/geoapify.ts), [picker](../../../src/features/coaches/coach-location-picker.tsx), [location tests](../../../tests/location-services.test.ts), [specification](../../../docs/mvp-spec.md), [README](../../../README.md), this record/index and owning coordination record.

### Decisions and deviations

2026-10-19: User chose gym-first plus own address rather than gym-only lookup. Adopt the actual Berlin administrative place filter returned by Geoapify city lookup (OSM relation 62422), with proximity bias retained. The place filter plus bias returns Chimosa; the first probe without bias unexpectedly returned no match. Both APIs accept the city-boundary filter; a Berlin address probe succeeds. Defensively require Berlin/DE metadata and coordinates within Berlin’s outer bounds, plus accepted categories for gym results. No large client polygon dataset is needed.

### Contracts, configuration, and operations

`searchLocations(query, apiKey, kind = "gym", signal?)` now selects one endpoint; its existing picker caller was updated. No persisted data-shape change. Existing manual/legacy locations stay readable. Existing five UAT Preview values remain unchanged; one rebuilt app release is needed. Alias rollback target is dpl_EaJenFw4MknjYor5RQm2bGmv8WnN. No key, provider account or schema change.

## Validation results

2026-10-19: Focused `node --import tsx --test tests/location-services.test.ts tests/vercel-deployment.test.ts` passed 16/16. `npm test` passed 346 pure/unit + 64 server tests, 410 total, zero failures/skips. Real adapter probes return Chimosa in gym mode, zero general Alexanderplatz gym results, Berlin Linienstraße address results in place mode and zero Potsdam results after defensive filtering. Initial typecheck found an old search-mode comparison and an incomplete Response mock in this change; both were fixed. Workspace-wide lint/typecheck also include ignored historical tmp/work scripts (known DEV0371), so they fail on unrelated evidence copies: lint reports 58 errors/2568 warnings; TypeScript reports stale imports/implicit types there. In an isolated exact-HEAD export overlaid with only this ticket’s three source/test files, `npm run lint` and `npm run typecheck` both pass. No global configuration or unrelated evidence file was changed to hide those failures. Final hosted build, native validation and release are pending.

| Criterion | Evidence | Result |
| --- | --- | --- |
| AC1 | Endpoint-isolation, geography/category/error/abort tests and actual provider probes | Passed |
| AC2 | Pending native UI | Not run |
| AC3 | Pending checks/review | Not run |
| AC4 | Existing release retained | Not run |

## Risks, limitations, and follow-ups

Provider POI coverage can omit real facilities; the user can use Own address. Manual coordinates remain owner-confirmed and do not claim provider verification or enforce a new Berlin storage rule. Preserve unsaved user drafts by using a separate QA window and not saving profile data.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: Planning self-review; final review pending.
- Deployment or release: Pending.
