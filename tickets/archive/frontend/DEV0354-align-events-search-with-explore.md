# Ticket DEV0354: Align Events search with Explore

- Status: Completed
- Created: 2026-10-18
- Last updated: 2026-10-19
- Milestone: Public marketplace visual polish
- Coordination: None — independent development ticket
- Related records: [DEV0353 Events banner](DEV0353-add-face-free-events-banner.md), [DEV0352 discovery search](DEV0352-simplify-home-discovery-and-explore-search.md).

## Objective and context

The user requests that Events search align positionally with Explore search and that Explore omit its redundant Back to Home link. Events currently puts a navigation row before a wider, taller filter panel. Follow [coach discovery](../../../docs/mvp-spec.md#42-discover-a-coach-and-time) and [Events discovery](../../../docs/mvp-spec.md#151-confirmed-choices-and-implementation-defaults).

## Scope and non-goals

- In scope: matching centered search position/width, shared compact search layout, retained native Events discipline/place submission and recovery/navigation, removal of Explore's directory Back to Home link, specification and validation evidence.
- Out of scope: banner dimensions/crops, discovery authority, new filters, event detail/private-history changes, data/account edits, migrations, commits and deployment.

## Expected behavior and edge cases

Events and Explore search start 12 px below their equally sized banners, centered at a maximum 880 px with 36 px desktop/18 px phone side gutters. Reuse the existing compact two-field/button layout and responsive sizing. Events keeps a native discipline select and place field, the same GET names/limits, session-type hidden value and Find sessions accessible name. Clear filters and My group sessions remain below the bar so neither displaces it; a session-type explanation also follows the bar. Results retain their 1180 px maximum. Explore keeps public header Home navigation but loses only the directory Back to Home link; coach-profile Back to coaches remains. Empty, invalid and unavailable states retain usable controls and recovery.

## Assumptions, decisions, and dependencies

Confirmed: positional alignment and removal of Back to Home. Implementation default: reuse the shared search bar styling, including its mobile icon button with an accessible name, to keep the controls' geometry consistent. Keep Events filter semantics rather than replacing disciplines with coach search. Installed Next.js 16.3.8 CSS ordering/scoping documentation was reviewed. Existing DEV0352/DEV0353 local changes are the baseline. Preserve unrelated work and the parallel coach-editor rehearsal; use a separate native browser window and no database or account mutation.

## Implementation plan

1. Record the ticket/index and current specification amendment before implementation.
2. Move Events search directly after its hero; share Explore's centering/spacing rules and existing compact search classes, adding scoped native-select sizing. Place clear/group navigation and session-type notice below it, then retain bounded results.
3. Remove only Explore's Back to Home block. Preserve other navigation and query contracts.
4. Run existing Events/search/Home regressions, scoped lint/format, isolated typecheck/production build and link checks. Review desktop and 375 px search alignment, keyboard Events submission/clear, real empty/invalid and configuration-free unavailable states without changing data.
5. Complete the implementation/review record and archive only after all required evidence passes.

### 2026-10-18 reset correction

Native keyboard/clear review exposed an existing uncontrolled-select issue: client navigation to `/events` restored unfiltered results but left Boxing selected. Before continuing implementation, key the search form by its applied, cursor-free filter URL so route filter changes remount its default-valued controls. This is necessary for the retained Clear filters contract; it adds no filter or data authority. Repeat the actual selection, GET and clear flow, then rerun affected checks/build on the final source.

## Acceptance criteria

- [x] AC1: Events and Explore search bars share the same centered width and banner-relative position at desktop and phone widths; controls fit and remain readable.
- [x] AC2: Events discipline/place/session-type/clear/group-navigation contracts and result/recovery states remain usable, including keyboard submission.
- [x] AC3: Explore has no directory Back to Home link, with its search/discipline/view and other public navigation preserved.
- [x] AC4: Relevant tests, lint/format/type/build, native responsive/keyboard/state checks and documentation/link review pass.

## Validation plan

Existing Events, marketplace search and Home tests cover query/state contracts; avoid new CSS-mirroring tests for this reversible layout change. Compare both actual pages in a separate native browser window at desktop and 375 px, using shared hero/search geometry and visible controls. Exercise read-only GET submission, clear/reset and empty/invalid states; use an isolated configuration-free final build for unavailable rendering. Run scoped ESLint/Prettier, typecheck and build in a snapshot outside the repository to preserve shared .next. No migration/authentication/registration rehearsals apply.

## Implementation record

Implemented and verified locally on 2026-10-18; no commit or deployment.

### Changes and rationale

Events search now follows its hero directly, sharing Explore's centered maximum 880 px, 12 px top gap, responsive gutters and existing compact two-field/button layout. A scoped native select matches the input sizing; phone uses the shared 44 px icon button with an explicit Find sessions accessible name. Clear filters and My group sessions occupy a wrapping navigation row below the bar, followed by any session-type explanation. The existing 1180 px result boundary and banner crop/dimensions remain.

The form retains native GET discipline/location/sessionType names and validation limits. Its key now follows the applied cursor-free filter URL so client-side clear/navigation resets its default-valued select and input. This corrects the stale Boxing selection observed during review; cursor-only pagination does not unnecessarily remount the controls. Empty/invalid/unavailable components, registration authority and result content are unchanged.

Explore loses only the directory Back to Home block. Header Home, coach-profile Back to coaches, search, discipline shortcuts and List/Map URLs remain.

### Affected files

| File | Change and purpose |
| --- | --- |
| [Events route](../../../src/app/events/page.tsx) | Search directly below hero, retained GET fields, mobile accessible action, relocated navigation/notice and applied-filter form reset. |
| [Public theme](../../../src/app/public-page-theme.css) | One grouped centering/spacing rule for Events/Explore, shared label padding and scoped Events select/button/navigation sizing. |
| [Coach discovery](../../../src/features/coaches/coach-discovery.tsx) | Removes the redundant directory Home link; public profile navigation is retained. |
| [Specification](../../../docs/mvp-spec.md#42-discover-a-coach-and-time), [Events contract](../../../docs/mvp-spec.md#151-confirmed-choices-and-implementation-defaults), [index](../../README.md) | Adopted alignment/navigation requirements and completed record. |

### Decisions and deviations

The dated reset correction above was recorded before implementation. Otherwise no material deviation. Reusing existing search classes keeps responsive geometry shared rather than independently recreating it. The Events discipline selector remains native; long values fit within their bounded control and remain fully available in its chooser.

The first newly opened Safari tab displayed blank paint; opening the comparison tab and switching back restored the actual page. Blank paint was not counted as a pass. Safari responsive mode was enabled on each comparison tab separately. Only the dedicated review window was operated/closed; the parallel coach-editor rehearsal and original public browser window were preserved.

### Contracts, configuration, and operations

No schema/API/dependency/environment changes or migrations. Native GET names and validation remain. The form key is an internal React state-reset boundary, not a URL/API change. Rollback is a code revert; no data rollback. No account/coach/registration edits, provisioning, reset or mutating rehearsals were performed; populated environment files and private coach journals were not read. The isolated snapshot/build/preview preserved shared `.next` and the running app.

## Validation results

2026-10-19 commit verification: the exact staged source passed 51 frontend/domain and 16 backend regressions on Node 24.21.0, scoped ESLint/Prettier, isolated typecheck and production webpack build. Shared contract/index changes exclude unrelated work; 655 local links resolve, with the two intentionally private credential-journal links excluded from version control. DEV0358 records commands, snapshot and remaining native acceptance; committing does not complete DEV0357/DEV0358 or deploy the feature.

Environment: 18 October 2026, Node 24.21.0 (`/Users/hoangdeveloper/.local/node/24.21.0/bin/node`), Next.js 16.3.8, actual local app on port 3100. Checks below were repeated after the form reset correction where applicable.

- `node --import tsx --test tests/events.test.ts tests/marketplace-search.test.ts tests/home-marketplace.test.ts`: **24 passed**, none skipped/failed. Final log `/private/tmp/dev0354-tests-final.log`. Existing tests cover Events query/cursor/state and Explore query/discipline/view contracts; no CSS-mirroring tests added.
- `node node_modules/eslint/bin/eslint.js src/app/events/page.tsx src/features/coaches/coach-discovery.tsx`: **passed** on final source.
- `node node_modules/prettier/bin/prettier.cjs --check src/app/events/page.tsx src/features/coaches/coach-discovery.tsx src/app/public-page-theme.css`: **passed** on final source.
- Snapshot `/private/tmp/movx-dev0354-c8zyoybe` copies source/public/scripts/tests/build configuration without populated environment files/private journals and symlinks installed dependencies. `npm run typecheck`: **passed**; `node node_modules/next/dist/bin/next build --webpack`: **passed**, sequentially after the reset correction. Final logs `/private/tmp/dev0354-types-final.log`, `/private/tmp/dev0354-build-final.log`. All three owned source files match the passing snapshot byte-for-byte.
- Native Safari actual app, desktop approximately 1233 px and **375 × 844**: **passed**. Both pages' equally sized hero ends and centered search bar top/side edges align; search starts 12 px below the hero. Phone fields/button fit without horizontal overflow, and Clear filters/My group sessions remain readable below Events search. Events retains its face-free crop and actual Daniel Park event. Explore shows six real coach entries with discipline/List/Map controls and header Home; no directory Back to Home appears.
- Native phone keyboard: with valid `sessionType=10000000-0000-4000-8000-000000000001` and `discipline=Boxing` applied, enter `DEV0354-no-match` in Training place, Option-Tab to the visibly focused Find sessions icon and Return. The resulting URL preserves **all three** sessionType/discipline/location fields; real empty-state recovery and the type notice remain readable. The arbitrary valid type ID is a read-only nonexistent filter, not a created record. **Passed**.
- The first client-side Clear filters review exposed stale Boxing after its URL/results cleared; this failed check prompted the recorded form-key correction. Final replay of the filtered route and Clear filters returns `/events`, **All disciplines**, empty Training place, no session-type notice and the actual unfiltered event. **Passed**; the stale-select attempt is not counted as success.
- Final production build served separately on loopback port 3159 with database/Auth/SMTP variables removed: `/events` **HTTP 200 / 21,030 bytes**, `/explore` **HTTP 200 / 26,735 bytes**. Saved HTML inspection confirms native Events GET markup, search-before-navigation/results ordering, each actual unavailable component, retained header Home and absence of Explore's Back to Home. Final native **375 × 844** comparison confirms matching search geometry under production CSS as well as readable unavailable explanations/retry links. `/events?discipline=Unsupported` shows the complete invalid message/reset; activating Reset search returns `/events` with the unavailable component and empty defaults. **Passed**. This does not claim a real database outage/recovery rehearsal.
- Initial sandbox preview bind failed `EPERM`, and restricted curl could not reach loopback; neither is counted as success. Authorized loopback-only execution/read checks above passed. Both temporary server runs were stopped; the dedicated review window was closed without changing other windows.
- Source comparison against the prior DEV0353 snapshot confirms only the planned Events layout/reset, Explore link removal and scoped CSS changes. Final local links/anchors and `git diff --check`: **passed**. Database/migration/authentication rehearsals are not applicable; this slice does not change those contracts or event detail/private-history code.

| Criterion | Evidence | Result |
| --- | --- | --- |
| AC1 | Grouped 880 px/12 px/gutter rules; actual desktop/375 comparison and final production phone comparison. | Passed locally |
| AC2 | Actual event/empty state, keyboard three-field GET, corrected clear/default replay, invalid/reset and actual configuration-free unavailable component. | Passed locally |
| AC3 | Actual desktop/phone and production HTML omit only the directory Home link; retained navigation and existing Explore regression contracts. | Passed locally |
| AC4 | 24 tests, lint/format/type/final build, native keyboard/responsive/recovery checks, source review and consistent links/specification. | Passed locally |

## Risks, limitations, and follow-ups

No unmet acceptance criteria remain. Long native-select/input values are bounded within compact phone fields; full choices remain available through the native chooser. Unavailable presentation was checked in a configuration-free final build without interrupting the real database. Independent review, hosted deployment and broad performance/map testing are outside this ticket. Unrelated shared-worktree changes remain preserved.

## Completion and review references

- Completed: 2026-10-18 — all acceptance criteria passed locally.
- Commit: Included with this record in the user-authorized DEV0350–DEV0358 public-discovery/Events commit; see Git history for this ticket.
- Review: Scope/source self-review and native responsive/keyboard/recovery review completed; no independent review.
- Deployment or release: None.
