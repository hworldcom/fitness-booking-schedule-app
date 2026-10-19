# Ticket DEV0378: Broaden Berlin facility search

- Status: In progress
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
- [ ] AC2: Picker labels/defaults, keyboard, geographic filtering, empty/error/cancellation and Own address/manual recovery remain truthful and usable at desktop/phone widths, without a profile save.
- [ ] AC3: Relevant tests, clean-source lint/types, scoped formatting and actual hosted build pass; specification/setup and preservation review agree.
- [ ] AC4: Exact-source UAT Preview/fra1 is live and verified; existing five settings, catalog/user data and unrelated edits remain unchanged, with a documented rollback target.

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

2026-10-19: Real provider preflight and integrated-adapter probes passed for short names McFIT (5 Berlin results), FitX (5), Holmes Place (5), Chimosa (1) and Futurium (1). The broader named-amenity path finds missing gym branches and non-fitness facilities. `node --import tsx --test tests/location-services.test.ts tests/vercel-deployment.test.ts` passed 16/16. `npm test` passed 346 unit + 64 server tests, 410 total, zero failures/skips. `npm run lint` and `npm run typecheck` passed in an isolated exact-HEAD source export overlaid with only this ticket’s five source/test files. This avoids the already-recorded ignored tmp/work evidence interference in DEV0371 without changing validation configuration or unrelated files. Hosted build and live responsive validation remain pending.

| Criterion | Evidence | Result |
| --- | --- | --- |
| AC1 | Real short-name probes and meaningful non-fitness/unnamed/geographic parser tests | Passed |
| AC2 | Pending native checks | Not run |
| AC3 | Pending tests/build/review | Not run |
| AC4 | Prior UAT release retained | Not run |

## Risks, limitations, and follow-ups

Facility coverage remains dependent on third-party data. Broader facilities are owner-selected meeting places, not platform-reviewed gyms or an endorsement. Own address/manual entry covers absent facilities. Native checks use Chrome responsive emulation, not physical-device/Safari coverage.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: Planning self-review; final acceptance review pending.
- Deployment or release: Pending.
