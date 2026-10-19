# Ticket DEV0378: Broaden Berlin facility search

- Status: Completed
- Created: 2026-10-19
- Last updated: 2026-10-19
- Milestone: UAT coach onboarding
- Coordination: None — independent development ticket
- Related records: Historical search baseline [DEV0377](../../archive/frontend/DEV0377-separate-berlin-gym-and-address-search.md); preserved UAT catalog [DEV0376](../../archive/backend/DEV0376-curate-uat-reviewed-gym-catalog.md). Neither is reopened or changed by this ticket.

## Objective and context

The user reports gym search is still not useful and explicitly requests switching to any facility. Current lookup calls category-limited Geoapify Places and filters out non-fitness results. Broaden the first option to named facilities of any category in Berlin, retaining separate Own address/manual entry and explicit confirmation. Update [C10 and the location boundary](../../../docs/mvp-spec.md#6-application-and-infrastructure-boundaries) with this superseding user decision.

## Scope and non-goals

Replace the fitness-category request/filter with Geoapify's documented named-place/amenity geocoding, update provider-neutral transient candidate labels and picker copy, meaningful tests and current spec/setup guidance, commit and deploy the verified source to the existing UAT Preview project. Preserve the Berlin city/country/coordinate checks, attribution, bounded results, errors/cancellation, manual fallback and explicit owner confirmation.

Do not alter the reviewed gym catalog (Chimosa remains its sole active option), saved profiles/locations, schema, seeds, Auth, keys, provider account, staging/production or unrelated worktree changes. No new SDK or paid service. This change does not promise that every real facility is present in provider data.

## Expected behavior and edge cases

The first option is Facility search, accepting named non-fitness facilities as well as gyms. Own address remains distinct and available for missing facilities. Both provider searches stay Berlin-limited. Facility results must be actual named points of interest rather than an arbitrary city/street substitute; check actual response shapes before adopting the parser condition. Reject outside-Berlin or malformed data, deduplicate/cap results, propagate abort and preserve honest empty/configuration/quota/provider states. Search and selection alone never save a coach location.

## Assumptions, decisions, and dependencies

The user's latest request supersedes the fitness-only part of DEV0377; Berlin scope and Own address remain adopted constraints. Inspect current official Geoapify documentation and probe real named facilities before changing integration. Prefer `type=amenity` geocoding to an expanding category allowlist, because it can find facilities across provider categories. Record the observed response shapes and adopted request/parser before implementation. Installed Next.js 16.3.8 client guidance was read. Existing UAT commit/deploy authorization covers this corrective iteration; keep its Preview/fra1 target and all five settings.

## Implementation plan

1. Probe amenity geocoding for real Berlin gyms and a non-fitness facility, using the existing key without logging it. Confirm the broadened path actually improves the reported behavior.
2. Adopt the verified request/parser, remove obsolete category-only runtime helpers, rename the transient search mode/copy to Facility search, and preserve separate address/manual recovery.
3. Update meaningful tests for non-fitness acceptance, missing facility metadata, geographic/coordinate rejection, correct request mode and existing error/abort behavior. Update the current specification and README without including unrelated edits.
4. Run focused/full unit/server tests, scoped format and clean-source lint/typecheck (workspace-wide ignored evidence interference is known under DEV0371). Review only owned diffs, commit with this DEV ID, and export exact source for the existing UAT project.
5. Build a hosted Preview explicitly in fra1; verify READY/source/configuration, then move only the UAT alias. Verify real facility lookup/selection and Own address/manual recovery at desktop/375 px phone widths, including keyboard and empty/error state. Use a separate QA window and never Save the user's profile.
6. Record release/rollback, validation and limitations, complete/archive this ticket and update affected links/index only after criteria pass.

## Acceptance criteria

- [x] AC1: Facility mode returns named Berlin facilities beyond fitness categories; real provider probes prove both gym and non-fitness matches.
- [x] AC2: Picker labels/defaults, keyboard, geographic filtering, empty/error/cancellation and Own address/manual recovery remain truthful and usable at desktop/phone widths, without a profile save.
- [x] AC3: Relevant tests, clean-source lint/types, scoped formatting and actual hosted build pass; specification/setup and preservation review agree.
- [x] AC4: Exact-source UAT Preview/fra1 is live and verified; existing five settings, catalog/user data and unrelated edits remain unchanged, with a documented rollback target.

## Validation plan

Actual Geoapify probes, meaningful location tests, existing unit/server suite, scoped Prettier, isolated clean-source lint/typecheck, actual Vercel hosted build, native desktop/375×568 phone search/select/address/manual/empty checks, UAT public/protected HTTPS smoke, environment/deployment/alias metadata and exact unrelated-edit comparison. No migration or DB integration suite applies to this provider/client change; no database writes or fixture creation are needed.

## Implementation record

### Changes and rationale

Replaced fitness-only POST Places with a single GET Geocoding request using type=amenity for named facilities across categories. The transient mode/candidate is now facility, shown as Facility search with a building icon and honest generic result label. Removed unused gym-category helpers/exports. Both modes retain the Berlin boundary and country/city/coordinate defenses; facility results additionally require a name and amenity classification. Own address uses ordinary geocoding and retains its manual path. Nothing in persistence, catalog or server authority changed.

### Affected files

[Geoapify adapter](../../../src/location/providers/geoapify.ts), [transient contracts](../../../src/location/contracts.ts), [exports](../../../src/location/index.ts), [picker](../../../src/features/coaches/coach-location-picker.tsx), [tests](../../../tests/location-services.test.ts), [specification](../../../docs/mvp-spec.md), [README](../../../README.md), this record/index.

### Decisions and deviations

2026-10-19 preflight: adopt GET Geocoding with `type=amenity`, the existing Berlin administrative filter/DE and proximity ordering. Real UAT-origin responses returned 5 McFIT, 5 FitX, 5 Holmes Place, 1 Chimosa and 4 Futurium candidates, all named amenity results in Berlin. This improves coverage over the previous Places path without a category allowlist. Facility parsing will require a nonempty name and `result_type=amenity`; general addresses remain in the separate existing path. No deviation from the planned provider approach.

### Contracts, configuration, and operations

Transient search kind changed from gym to facility; buildGeoapifyFacilitySearchUrl replaces buildGeoapifyGymSearchRequest and the category constant was removed; the existing picker/test callers were updated. persisted location shapes remain unchanged. No environment, dependency, schema, Auth or catalog mutation. Prior UAT deployment dpl_HStLKxxxqj5iwbpXvdioSxUsU8iC is the alias rollback target. Source must be committed/exported separately from the user's pre-existing specification/index/browser-test edits and independent uncommitted DEV0374/DEV0375 records.

## Validation results

2026-10-19: Real provider preflight and integrated-adapter probes passed for short names McFIT (5 Berlin results), FitX (5), Holmes Place (5), Chimosa (1) and Futurium (1). The broader named-amenity path finds missing gym branches and non-fitness facilities. `node --import tsx --test tests/location-services.test.ts tests/vercel-deployment.test.ts` passed 16/16. `npm test` passed 346 unit + 64 server tests, 410 total, zero failures/skips. `npm run lint` and `npm run typecheck` passed in an isolated exact-HEAD source export overlaid with only this ticket’s five source/test files. This avoids the already-recorded ignored tmp/work evidence interference in DEV0371 without changing validation configuration or unrelated files. Hosted build and live responsive validation passed as detailed below.

| Criterion | Evidence | Result |
| --- | --- | --- |
| AC1 | Real short-name probes and meaningful non-fitness/unnamed/geographic parser tests | Passed |
| AC2 | Real desktop McFIT/non-fitness result and keyboard selection; 375×568 McFIT selection, blank-query validation and Own address/manual fields | Passed |
| AC3 | 410 unit/server + 16 focused tests, clean-source lint/types, scoped format, actual hosted build and preservation review | Passed |
| AC4 | READY exact-source fra1 Preview/alias, unchanged five settings/eight catalog rows, route/privacy smoke and recorded rollback | Passed |

## Risks, limitations, and follow-ups

Facility coverage remains dependent on third-party data. Broader facilities are owner-selected meeting places, not platform-reviewed gyms or an endorsement. Own address/manual entry covers absent facilities. Native checks use Chrome responsive emulation, not physical-device/Safari coverage.

## Completion and review references

- Completed: 2026-10-19 — all four criteria passed.
- Commit: bb15aee0558cd334fdcd2ed79f01a26dd8e0863f — `[DEV0378] Search named Berlin facilities across categories`; final evidence/archive in a following documentation checkpoint.
- Review: Self-review against acceptance criteria, exact source/settings/catalog, real provider coverage and desktop/phone behavior; no independent review.
- Deployment or release: Live at https://uat.movx.club on dpl_AhxLs4HkvAD3WQptoTg4ZNu5u7Hw, Preview/fra1, source bb15aee.

### Exact hosted release and native validation — 19 October 2026

Exported only committed source bb15aee0558cd334fdcd2ed79f01a26dd8e0863f into a private release directory, with the dedicated UAT project link. `npx --yes vercel@64.3.1 deploy --yes --no-wait --target preview --regions fra1 --meta releaseCommit=bb15aee0558cd334fdcd2ed79f01a26dd8e0863f --meta releaseTicket=DEV0378` and `vercel inspect ... --logs --wait` passed the actual Next.js 16.3.8/Turbopack hosted-runtime build. Logs confirmed the existing Geoapify configuration without printing values. An early metadata probe still reported BUILDING; the alias stayed on the old release until a subsequent API read confirmed READY, Preview, fra1 and exact source metadata.

Deployment dpl_AhxLs4HkvAD3WQptoTg4ZNu5u7Hw is https://movx-club-ipt0h2rd1-hoangworldcoms-projects.vercel.app. `vercel alias set ... uat.movx.club` succeeded and the alias API agrees. All five Preview settings retain exact IDs/types/targets/update timestamps. Runtime/source rollback is an alias reassignment to dpl_HStLKxxxqj5iwbpXvdioSxUsU8iC; it changes neither data nor environment values. The repository's separate staging link, production, provider account and credentials are unchanged; no Git source push was performed.

Native Chrome desktop 1390×775: Independent place defaults to Facility search, with Own address as the separate second option. McFIT + Enter returns five real Berlin branches, each labelled Facility with its own address/coordinates. Futurium returns a real non-fitness facility at Alexanderufer 2 (52.523912, 13.374325). Tab navigation reaches its result button and Enter selects it, showing exact label/coordinates, Geoapify provenance, map controls and an enabled public-location confirmation action. This proves broader results rather than merely relabelling the old gym request.

Native Chrome responsive emulation explicitly showed Width 375, Height 568, display zoom 50% to fit the tool window. In this phone layout, blank Search displays the three-character validation message; actual McFIT lookup returns five Berlin branches and selecting Leipziger Straße 46/47 displays 52.510648/13.397428, Geoapify provenance and the confirmation action. Own address remains a distinct Berlin address search; Enter coordinates manually exposes editable public label/latitude/longitude. Existing address lookup, malformed/outside-Berlin data, error mapping and abort recovery are additionally covered by the focused tests. This is responsive Chrome evidence, not physical iOS/Android or Safari validation.

QA used one separately created single-tab window and never submitted/confirmed a coach profile. Initial concurrent Chrome activity was detected before opening that window; the user then confirmed a short pause. An initial keyboard attempt reached the attribution link rather than the result; it was not counted as successful selection. Returned to the temporary form and then explicitly verified the result focus before Enter. One transient native capture failure recovered on reacquiring Chrome. Phone AX clicks sometimes scrolled/focused without activation, so visible input clicks were used; failed selector attempts were not counted as catalog UI evidence. The temporary window was closed without saving, leaving the original user's draft intact.

Final `node work/dev0378/live-check.mjs`: 7/7 expected HTTPS outcomes (Home/Explore/Events/Sign in 200, guest Coach Profile 307, private times/Messages APIs 401); staging remains 200. `node work/dev0378/check-assets.mjs`: four public HTML pages and 16 referenced immutable JS chunks served successfully and contain neither the actual runtime database URL nor password. No new private value was added; the existing browser key remains intentionally public.

Read-only `supabase db query --linked --project-ref mdzidiqosxbghmfyxphb --file work/dev0376/verify.sql -o json` reread all eight gym rows. Every field equals the previous accepted DEV0376 snapshot, with Chimosa the only active choice; no catalog write occurred. No profile/location/account seed, test fixture, migration or other database write was performed by this ticket. Database integration tests are not applicable to this provider/client-only change.

`prettier --check` passed for all five changed TypeScript files. Exact comparisons against this task's private starting snapshots prove pre-existing README/spec/index/browser-test edits are unchanged after removing only the owned additions. Relative-link and whitespace checks pass. Supporting provider/build/alias/route/privacy/catalog evidence remains ignored under work/dev0378; this record contains the reviewable results without secrets. Shared-workspace ignored-evidence lint/type limitations remain independently tracked in DEV0371; both checks passed for the clean source delivered here.
