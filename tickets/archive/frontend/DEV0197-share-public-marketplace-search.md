# Ticket DEV0197: Share public marketplace search

- Status: Completed
- Created: 2026-10-12
- Last updated: 2026-10-12
- Milestone: Scheduling interface public-marketplace follow-up
- Coordination: [COR0017 — Public marketplace redesign](../organisatory/COR0017-public-marketplace-redesign.md)
- Related records: completed contract dependency [DEV0195 — Adopt the public marketplace redesign contract](../organisatory/DEV0195-adopt-public-marketplace-redesign-contract.md); completed homepage consumer [DEV0198 — Build the search-first marketplace home](DEV0198-build-search-first-marketplace-home.md); completed Explore consumer [DEV0199 — Redesign desktop coach Explore](DEV0199-redesign-desktop-coach-explore.md)

## Objective and context

Extract one reusable, accessible public search surface for the filters the application already supports end to end: coach/focus query, discipline and location. The current controls live inside `CoachDirectory`, while the proposed homepage needs to submit the same normalized URL contract without copying validation or introducing decorative `When` controls.

## Scope and non-goals

- In scope:
  - Reuse `CoachDirectoryFilters`, `COACH_DISCIPLINES` and the current `/explore` GET-query contract.
  - Provide responsive labelled search controls usable on both `/` and `/explore`.
  - Add discipline-chip links/actions backed by the exact supported discipline values.
  - Preserve supported filters through search submission and canonicalize invalid/blank values through the existing domain normalizer.
- Out of scope:
  - Date/time, availability range, distance, geolocation, map viewport, prices, ratings, autocomplete or provider place search.
  - Changing database query semantics or adding a new API.

## Expected behavior and edge cases

- Submitting homepage search navigates to `/explore` with only bounded supported parameters.
- Explore renders current values after reload and browser navigation; clearing values returns the unfiltered directory.
- A discipline chip has an understandable selected state and produces the same result as choosing that discipline in the form.
- Invalid, repeated, overlong or unknown query values fail into the existing bounded normalization rather than reaching UI/state unchecked.
- Controls remain useful without client JavaScript because the primary path is a GET form or ordinary links.

## Assumptions, decisions, and dependencies

- DEV0195 adopted `q`, discipline and location as the complete first-delivery search contract.
- Existing server normalization and directory service remain authoritative; UI components must not reimplement matching logic.
- `service=private-training` may be retained for compatibility only if it has current bounded meaning; otherwise the implementation record must explain its removal.

## Implementation plan

1. Extract the current filter form into a public marketplace search component with explicit compact/full presentation variants only if needed.
2. Add discipline-chip navigation using the domain discipline set and shared URL construction.
3. Use the component on Explore without changing current results behavior; expose it for DEV0198 homepage composition.
4. Add domain/component/browser tests for URL retention, clearing, invalid values, keyboard operation and no-JavaScript submission.

## Acceptance criteria

- [x] AC1: Homepage and Explore can share one working `q`/discipline/location search contract without duplicated filter logic.
- [x] AC2: Discipline chips use only supported domain values and preserve other applicable filters.
- [x] AC3: Reload, back/forward, clear and malformed-query behavior remain bounded and deterministic.
- [x] AC4: No unsupported `When`, proximity, price, rating or availability control is rendered.

## Validation plan

- Extend coach-filter domain tests for URL construction/normalization boundaries where needed.
- Add browser checks for homepage-to-Explore submission, discipline chips, clearing and keyboard operation at mobile/desktop widths.
- Run application tests, lint, type-check, format, build and `git diff --check`.
- Database tests are not applicable unless implementation changes repository query semantics, which is outside this ticket.

## Implementation record

Implementation started and completed on 2026-10-12 after reviewing the existing Explore GET form, domain normalizer, database query boundary, responsive styles and Next.js 16.3.8 server redirect guidance.

### Changes and rationale

- Extracted one server-rendered GET search component for Home and Explore. Both surfaces now use the same labelled `q`, `discipline` and `location` inputs, length bounds, supported discipline values and submit destination.
- Added ordinary discipline links for `All` and every value in `COACH_DISCIPLINES`. Links preserve the current query and location, expose the selected discipline through `aria-current`, and remain usable without client JavaScript.
- Centralized canonical Explore URL construction and checking. Blank, invalid, repeated, unknown, legacy and overlong inputs are normalized on the server and redirected to one bounded URL before the directory query runs.
- Keyed the uncontrolled search component by its canonical URL so reload and browser Back/Forward navigation restore the server-derived values rather than retaining stale DOM state.
- Added the working shared search below the existing Home hero as the first compositional consumer. DEV0198 still owns the broader homepage hierarchy and server-backed coach previews.
- Added responsive chip overflow behavior and visually reviewed the Home search at desktop and mobile widths. During validation, isolated Home heading styles replaced a colliding generic section class that compressed the mobile title.

### Affected files

| File or component                                                                             | Change and purpose                                                                                                                                             |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/coaches/marketplace-search-contract.ts`                                         | Builds canonical Explore URLs and detects non-canonical raw query input using the existing domain normalizer.                                                  |
| `src/features/coaches/public-marketplace-search.tsx`                                          | Renders the reusable labelled GET form, supported discipline links, selected state and clear action.                                                           |
| `src/features/coaches/coach-discovery.tsx` and `src/app/explore/page.tsx`                     | Replace the duplicated form and canonicalize raw search parameters before querying/rendering the directory.                                                    |
| `src/features/public/coach-story.tsx`                                                         | Adds the shared working search to Home without taking over the broader DEV0198 homepage redesign.                                                              |
| `src/app/coach-discovery.css` and `src/app/coach-story.css`                                   | Style the shared controls, bounded horizontal mobile chips and isolated responsive Home search heading.                                                        |
| `tests/marketplace-search.test.ts`                                                            | Verifies URL construction, normalization boundaries, supported links and absence of unsupported controls.                                                      |
| `tests/browser/public-story.spec.ts` and `tests/browser/coach-discovery.spec.ts`              | Exercise the shared contract, keyboard submit, history restoration, clearing, malformed URLs, no-JavaScript submit and the renamed Explore submission control. |
| `tickets/README.md` and `tickets/current/organisatory/COR0017-public-marketplace-redesign.md` | Keep the ticket lifecycle, dependency state and public-marketplace work map synchronized.                                                                      |

### Decisions and deviations

- Kept the existing domain normalizer as the source of bounded filter values and introduced only URL presentation/canonicalization helpers; database matching semantics did not move into the UI.
- Removed `service=private-training` from generated canonical URLs because every current coach profile is already constrained to that service mode. The existing parser still accepts the legacy value, then `/explore` redirects it away, preserving old inbound links without perpetuating redundant state.
- Used one full responsive presentation rather than compact/full variants because both current consumers can share identical controls without forking labels or behavior.

### Contracts, configuration, and operations

No API, database schema, provider, dependency, environment variable or migration changed. The canonical public URL contract now contains only normalized `q`, `discipline` and `location` parameters. Existing `service=private-training` links remain readable but redirect to the equivalent canonical URL without that redundant parameter.

## Validation results

Validation completed on 2026-10-12 with the repository Node.js release.

| Criterion | Evidence                                                                                                                                                                                                    | Result |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | `tests/marketplace-search.test.ts` verifies the single GET component and URL contract; the Playwright matrix submits the Home form by keyboard and restores the same values on Explore.                     | Passed |
| AC2       | Unit coverage counts exactly `All` plus the six domain disciplines and verifies a discipline URL preserves query/location; Playwright selects Boxing and observes the selected state and preserved filters. | Passed |
| AC3       | Desktop/mobile Playwright coverage passed reload, Back, Forward, clear and repeated/invalid/unknown query cleanup. Component keying corrected stale uncontrolled values found during the browser rehearsal. | Passed |
| AC4       | Unit and browser assertions confirm no `When`, proximity, price, rating or availability search control is exposed.                                                                                          | Passed |

Additional checks:

- `npm test` passed all 112 unit tests and 9 React-server tests.
- `npm run lint`, `npm run typecheck`, `npm run format:check` and `git diff --check` passed.
- `npm run build` passed in configuration-free public-preview mode. It emitted the existing Supabase Node-version and experimental JSON-module warnings but no build error.
- `npx playwright test tests/browser/public-story.spec.ts` passed 11 desktop/mobile checks and skipped one intentional duplicate mobile no-JavaScript case. The desktop no-JavaScript GET submission passed.
- Visual review covered the regenerated desktop and 393-pixel mobile full-page screenshots. The final mobile view has readable heading proportions, horizontally bounded discipline chips and no document overflow.
- Database tests were not applicable because repository query semantics and persistence did not change.

## Risks, limitations, and follow-ups

- Search remains intentionally limited to the three server-supported filters. Date/time, distance, price, rating and availability need their own truthful contracts before entering this component.
- DEV0198 owns the final search-first Home composition, and DEV0199 owns the desktop result/map redesign; this ticket supplies their shared search boundary only.

## Completion and review references

- Completed: 2026-10-12.
- Commit: `[DEV0197] Share public marketplace search` (this completed change).
- Review: No review created.
- Deployment or release: Not deployed or released.
