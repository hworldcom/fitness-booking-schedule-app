# Ticket DEV0377: Separate Berlin gym and address search

- Status: Completed
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
- [x] AC2: Responsive picker supports both modes, explicit confirmation, keyboard/error/empty/cancellation and manual recovery without incidental persistence.
- [x] AC3: Meaningful location tests and applicable lint/type/build checks pass; specification/setup guidance match the adopted behavior and unrelated edits remain preserved.
- [x] AC4: Exact-source UAT Frankfurt Preview is live; actual desktop and phone checks pass alongside Chimosa-only reviewed catalog, with release/rollback evidence recorded.

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

2026-10-19: Focused `node --import tsx --test tests/location-services.test.ts tests/vercel-deployment.test.ts` passed 16/16. `npm test` passed 346 pure/unit + 64 server tests, 410 total, zero failures/skips. Real adapter probes return Chimosa in gym mode, zero general Alexanderplatz gym results, Berlin Linienstraße address results in place mode and zero Potsdam results after defensive filtering. Initial typecheck found an old search-mode comparison and an incomplete Response mock in this change; both were fixed. Workspace-wide lint/typecheck also include ignored historical tmp/work scripts (known DEV0371), so they fail on unrelated evidence copies: lint reports 58 errors/2568 warnings; TypeScript reports stale imports/implicit types there. In an isolated exact-HEAD export overlaid with only this ticket’s three source/test files, `npm run lint` and `npm run typecheck` both pass. No global configuration or unrelated evidence file was changed to hide those failures. Final hosted build, native validation and release passed as detailed below.

| Criterion | Evidence | Result |
| --- | --- | --- |
| AC1 | Endpoint-isolation, geography/category/error/abort tests and actual provider probes | Passed |
| AC2 | Real UAT desktop/375×568 phone gym/address selection, keyboard, blank/empty retry and manual recovery | Passed |
| AC3 | 410 unit/server tests; 16 focused tests; clean-source lint/types; successful actual hosted Next build; exact unrelated-edit comparison | Passed |
| AC4 | READY Frankfurt Preview, exact commit/alias, both responsive flows, 7 HTTP probes and unchanged staging/configuration | Passed |

## Risks, limitations, and follow-ups

Provider POI coverage can omit real facilities; the user can use Own address. Manual coordinates remain owner-confirmed and do not claim provider verification or enforce a new Berlin storage rule. Preserve unsaved user drafts by using a separate QA window and not saving profile data.

## Completion and review references

- Completed: 2026-10-19 — all four acceptance criteria passed.
- Commit: c8fc13a032ecf8656699e44987526ed5d5caba94 — `[DEV0376] [DEV0377] Curate UAT gyms and separate Berlin location search`; final evidence/archive follows in a documentation checkpoint.
- Review: Self-review against criteria, real provider responses, exact source/configuration/alias and responsive interaction; no independent review.
- Deployment or release: Live at https://uat.movx.club on dpl_HStLKxxxqj5iwbpXvdioSxUsU8iC, Preview, fra1, exact source c8fc13a.

### Actual hosted release and responsive validation

`npx --yes vercel@64.3.1 deploy --yes --no-wait --target preview --regions fra1 --meta releaseCommit=c8fc13a032ecf8656699e44987526ed5d5caba94 --meta releaseTicket=DEV0377` deployed an isolated `git archive` of that commit, using the dedicated UAT project link. No unrelated dirty file, populated environment file or operator credential was uploaded. `vercel inspect ... --logs --wait` passed the actual native Next.js 16.3.8/Turbopack hosted-runtime build; the validator confirmed Geoapify configured without printing values. API readback verified READY, Preview target, fra1 and exact commit metadata before `vercel alias set ... uat.movx.club`.

Accepted deployment: dpl_HStLKxxxqj5iwbpXvdioSxUsU8iC, https://movx-club-dj18njt36-hoangworldcoms-projects.vercel.app. UAT alias readback agrees. All five Preview environment entries retain exact IDs/types/targets/update timestamps; no env/Auth/staging/production settings changed. The prior dpl_EaJenFw4MknjYor5RQm2bGmv8WnN remains available for alias rollback. Catalog rollback is independently documented in DEV0376; source rollback does not change catalog rows.

Native Chrome desktop 1390×775: opening Independent place defaults to Gym search. Typing Chimosa and Enter returns the real sports-facility candidate at 52.526682/13.389507, and selecting it exposes Geoapify provenance, the map pin and confirmation action. Own address clears the prior candidates and separately returns Linienstraße 127, Berlin. Tab navigation reaches the first address result and Enter selects it without submitting the parent profile. The selected address has its own coordinates and OpenFreeMap attribution. Enter coordinates manually retains the label/coordinates as editable manual fields.

Native Chrome device emulation verified Width 375, Height 568; display scaling fits the frame and does not change the declared CSS viewport. Actual phone Chimosa lookup/selection displays its pin and confirmation action. Own address is separately usable. Empty Search shows the three-character validation message. Hauptstraße 1, Potsdam returns the honest No address matched in Berlin state; retrying Linienstraße 127, Berlin returns/selects its real address. Manual recovery exposes editable label/latitude/longitude. Reviewed-gym dropdown shows only Choose a gym and Chimosa at both widths. No Confirm/Save profile action was needed to verify the candidate paths, and no profile was submitted.

The browser initially switched to the user's original window during phone automation. No stale/unsuccessful click was counted as validation; the user then confirmed a short Chrome pause. The owned single-tab window was selected explicitly, the phone cases completed, and that window was closed without saving. The original draft was neither reloaded nor submitted. Touch emulation sometimes scrolled to an AX control without activating/focusing it; visible coordinate clicks completed actual input actions. This is Chrome responsive emulation, not a physical iOS/Android or Safari rehearsal.

Final HTTPS smoke: Home/Explore/Events/Sign in 200, guest Coach Profile 307, private times and Messages API 401 (7/7 expected). Staging remains 200. Four public HTML pages and 16 referenced immutable JS chunks serve successfully and contain neither the actual runtime database URL nor password. The existing Geoapify browser key remains intentionally public. Evidence is private under work/dev0377, including build.log, deployment-fra1.json, live-check.json, asset-check.json and provider probes; no populated credential is committed.

No database integration suite/migration/reset applies to this adapter/client-only change; DEV0376 proves the separate data operation. Relevant format/whitespace/link checks and exact preservation comparisons of the original specification/index/browser-test changes complete the review. The shared-workspace lint/typecheck scratch-artifact limitation remains under DEV0371; clean-source checks and the actual hosted build pass without changing global validation configuration or unrelated files.

Final workspace typecheck repeated after the two owned corrections: all 38 remaining TypeScript diagnostics are in ignored tmp/work evidence copies, with none in the implemented source/tests. Clean-export lint/typecheck, scoped Prettier and the actual hosted build passed. All relative links in the affected README/specification/index/three records resolve; staged whitespace checks pass. Original user specification/index/browser-test edits compare exactly to the pre-QA snapshot after removing scoped additions.
