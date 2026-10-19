# Ticket DEV0352: Simplify Home discovery and Explore search

- Status: Completed
- Created: 2026-10-18
- Last updated: 2026-10-19
- Milestone: Public marketplace discovery refinement
- Coordination: None — independent development ticket
- Related records: [DEV0351 banner/search alignment](DEV0351-align-explore-banner-and-search-with-home.md), [DEV0316 directory cards](DEV0316-redesign-coach-directory-cards.md), [DEV0228 original Home grid](DEV0228-build-home-coach-grid-with-discipline-filter.md).

## Objective and context

The user requests a simpler Home: keep the discipline shortcuts, remove the search bar and Explore with a map link, and replace Load more with Explore more opening Explore. On Explore, replace the typed discipline/dropdown field with Search coach or focus. Amend [public discovery](../../../docs/mvp-spec.md#42-discover-a-coach-and-time), preserving the supplied banners and truthful server-backed results.

## Scope and non-goals

- In scope: discipline-only Home controls/canonical URLs, fixed four-coach preview, Explore more destination carrying the chosen discipline, Explore query/location primary form with discipline shortcuts and hidden selected discipline, regression coverage and current specification.
- Out of scope: banner/photo changes, map/provider behavior, result authority/order, coaching data, account/authentication changes, migrations, commits or deployment.

## Expected behavior and edge cases

Home shows only the scrollable discipline strip below its banner, at most four matching coaches and Explore more below discovery. It has no search form, location field, map shortcut or expanding page link. Discipline changes/clear remain ordinary links. Old Home location/page/query parameters canonicalize to the same discipline-only Home preview; no hidden location filter or expanded grid survives reload. Explore more preserves the chosen discipline and opens the default Explore view, where users can refine query/location and switch map/list.

Explore's first visible field is Search coach or focus, followed by Where in Berlin? and the existing submit button. There is no typed discipline/datalist or duplicate secondary query field. Discipline shortcuts still filter; a selected discipline is submitted as a hidden field with query/location and explicit view. Clear/empty/unavailable states stay truthful. Explore more remains available below Home discovery even with a short/empty/unavailable preview; it does not imply extra matching inventory.

## Assumptions, decisions, and dependencies

Confirmed: retain Home discipline element only, remove search/map shortcut, Explore more replaces Load more, and coach/focus replaces Explore's discipline input. Defaults: retain four Home preview cards; carry the selected discipline into Explore; retire unsupported Home location/page parameters by canonicalizing to the remaining Home discipline URL. The discipline element means the existing scrollable shortcuts, consistent with the instruction to remove search. Existing Next.js 16.3.8 Form documentation was reviewed: string action provides enhanced native GET submission. No unresolved product question blocks this slice. Preserve unrelated shared edits and never read populated environment files or private coach journals.

## Implementation plan

1. Update this ticket/index and the current discovery contract.
2. Reduce Home search wrapper to discipline navigation, use a fixed bounded preview and a normal Explore more link, and simplify Home canonicalization.
3. Move Explore query into the primary form in place of the discipline input. Retain selected discipline/view through hidden fields and remove the secondary query styling.
4. Update meaningful URL/preview/form regression tests, then run focused tests, scoped lint/format, isolated typecheck/build and link checks.
5. Verify desktop/375 px Home and Explore, keyboard discipline/Explore more/query submission and relevant empty/unavailable states without data edits; finish/archive only after acceptance passes.

## Acceptance criteria

- [x] AC1: Home has discipline shortcuts, no search/map shortcut and no Load more; at most four real matching coaches and Explore more linking to Explore with the selected discipline.
- [x] AC2: Home query normalization cannot retain hidden location filters or expand the preview through old page URLs; empty/unavailable states remain truthful.
- [x] AC3: Explore has one query/location search form with no typed discipline input; selected discipline, query, location and view survive submission/shortcuts/clear as appropriate.
- [x] AC4: Relevant tests/lint/format/type/build, native desktop/phone keyboard/state checks and specification/link evidence pass.

## Validation plan

Update existing Home marketplace/search tests for four-card bounds, canonical discipline-only URLs, filter-preserving Explore links, absence of retired controls, and hidden discipline plus the single query input. Include existing fitness/card regressions. Run scoped ESLint/Prettier and clean-copy typecheck/production build without touching shared `.next`. Native Safari desktop/375 px must show both routes and a keyboard flow from Home discipline selection through Explore more to query submission; inspect empty/unavailable using existing real routes or a clearly isolated configuration-free preview. No database/migration/mutating rehearsals apply.

## Implementation record

Implemented and verified locally on 2026-10-18.

### Changes and rationale

Home now has only its existing discipline shortcut strip below the unchanged banner. Its server-backed directory preview is capped at four entries, preserving alphabetical order and truthful counts. Explore more replaces expanding pagination, remains available with short/empty/unavailable previews, and carries the selected discipline to Explore without implying extra matching inventory. The map shortcut and all Home search fields are absent.

Home normalization and URL generation retain only discipline. The previous location/page/query parameters cannot create a hidden filter or expand the grid; for example, `/?discipline=Boxing&location=Berlin&page=2` redirects to `/?discipline=Boxing`. Case/alias normalization and ordinary shortcut/clear links still work without JavaScript.

Explore now has one visible coach/focus input followed by location and the submit button. The typed discipline/datalist and secondary query field are removed. Shortcut selection supplies a hidden discipline; explicit List/Map state remains hidden in the same GET form. Hidden field order follows the existing query/discipline/location/view URL convention. Banners, map inventory, card content and booking/account authority are unchanged.

Existing Home URL/preview/form tests were revised to prove the new bounds and navigation contract. Directly affected browser-spec selectors were updated from retired typed fields to shortcut/hidden-field behavior; unrelated historical browser expectations were not rewritten.

### Affected files

| File | Change and purpose |
| --- | --- |
| [Home route](../../../src/app/page.tsx), [Home contract](../../../src/features/coaches/home-marketplace-contract.ts) | Discipline-only normalization/canonical redirect and a fixed immutable four-entry preview. |
| [Home controls](../../../src/features/coaches/home-marketplace-search.tsx), [discovery](../../../src/features/coaches/home-coach-discovery.tsx), [Explore more](../../../src/features/coaches/home-load-more.tsx), [Home story](../../../src/features/public/coach-story.tsx) | Remove Home form/map/pagination and page props; retain shortcuts/counts and link to full Explore. The historical load-more source path now exports the simple `HomeExploreMore` link. |
| [Explore form](../../../src/features/coaches/public-marketplace-search.tsx), [public theme](../../../src/app/public-page-theme.css) | Query replaces typed discipline, selected discipline stays hidden, secondary-field styles retire, Home strip has a clean banner gap. |
| [Home tests](../../../tests/home-marketplace.test.ts), [search tests](../../../tests/marketplace-search.test.ts), [Fitness regression](../../../tests/fitness.test.ts) | Fixed preview/canonical URLs, filter-preserving destination, one query input and selected hidden discipline. |
| [Public story](../../../tests/browser/public-story.spec.ts), [Explore](../../../tests/browser/explore-redesign.spec.ts), [unavailable](../../../tests/browser/explore-unavailable.spec.ts), [coach discovery](../../../tests/browser/coach-discovery.spec.ts), [accessibility](../../../tests/browser/public-accessibility.spec.ts) | Replace assertions/interactions for removed typed/Home search fields with current shortcuts/GET behavior; specs typecheck/lint but were not browser-executed. |
| [Current specification](../../../docs/mvp-spec.md), [ticket index](../../README.md) | Align decision register, defaults, discovery flow, definition of done, milestone, acceptance matrix and current card contract with this amendment; archived records retain history. |

### Decisions and deviations

No material scope deviation. Four-card bounds, discipline-preserving navigation and legacy-parameter stripping are implementation defaults recorded before edits. The initial regression run exposed one old Fitness assertion expecting the removed discipline option; it now checks the selected hidden Fitness value and existing shortcut/owner rules. The final form moves its hidden discipline between query and location to keep native GET parameter order consistent; values and keyboard order are unchanged.

Native Safari first supplied real desktop/phone and Home-to-Explore evidence. Another editor/Auth rehearsal later changed its active window to a separate private sign-in page at port 3113. No credentials were entered and that test was left alone. A separate Chrome window supplied the final-build form keyboard evidence; later browser interference was not treated as passing evidence or used to alter accounts. Reversible incidental scroll/focus actions changed no data.

### Contracts, configuration, and operations

Home URLs become discipline-only; legacy location/page inputs are removed by canonical redirects. Internal Home pagination props/helpers become fixed-preview props/helpers. Explore's URL/data contract is unchanged; the selected discipline is an ordinary hidden form value. No data/schema/dependency/environment changes or migrations. No account/coach edits, provisioning, reset or mutating rehearsals were performed; populated configuration/private coach journals were not read. Rollback is a code revert. Temporary build/preview files stay outside the repository/shared `.next`.

## Validation results

2026-10-19 commit verification: the exact staged source passed 51 frontend/domain and 16 backend regressions on Node 24.21.0, scoped ESLint/Prettier, isolated typecheck and production webpack build. Shared contract/index changes exclude unrelated work; 655 local links resolve, with the two intentionally private credential-journal links excluded from version control. DEV0358 records commands, snapshot and remaining native acceptance; committing does not complete DEV0357/DEV0358 or deploy the feature.

Environment: 2026-10-18, Node 24.21.0 at `/Users/hoangdeveloper/.local/node/24.21.0/bin/node`, Next.js 16.3.8. Existing local app on port 3100; isolated snapshot `/private/tmp/movx-dev0352-7uhiaka7` copies source/public/scripts/tests and build configuration, symlinks installed dependencies, and excludes populated environment files/private journals.

- `node --import tsx --test tests/home-marketplace.test.ts tests/marketplace-search.test.ts tests/coach-directory-cards.test.ts tests/fitness.test.ts`: **25 passed**, no failures/skips, repeated after final form ordering. Log `/private/tmp/dev0352-tests.log`. First run had 24 passes/one obsolete option assertion; the corrected Fitness regression passes. Existing image-quality warnings occur when static tests do not load Next config; runtime still allows quality 95.
- `node node_modules/eslint/bin/eslint.js src/app/page.tsx src/features/public/coach-story.tsx src/features/coaches/home-marketplace-search.tsx src/features/coaches/home-coach-discovery.tsx src/features/coaches/home-marketplace-contract.ts src/features/coaches/home-load-more.tsx src/features/coaches/public-marketplace-search.tsx tests/home-marketplace.test.ts tests/marketplace-search.test.ts tests/fitness.test.ts tests/browser/public-story.spec.ts tests/browser/explore-redesign.spec.ts tests/browser/explore-unavailable.spec.ts tests/browser/coach-discovery.spec.ts tests/browser/public-accessibility.spec.ts`: **passed**. Final reordered form was checked again directly.
- `node node_modules/prettier/bin/prettier.cjs --check src/app/page.tsx src/features/public/coach-story.tsx src/features/coaches/home-marketplace-search.tsx src/features/coaches/home-coach-discovery.tsx src/features/coaches/home-marketplace-contract.ts src/features/coaches/home-load-more.tsx src/features/coaches/public-marketplace-search.tsx src/app/public-page-theme.css tests/home-marketplace.test.ts tests/marketplace-search.test.ts tests/fitness.test.ts tests/browser/public-story.spec.ts tests/browser/explore-redesign.spec.ts tests/browser/explore-unavailable.spec.ts tests/browser/coach-discovery.spec.ts tests/browser/public-accessibility.spec.ts`: **passed**, with the final reordered form checked again directly.
- Snapshot `npm run typecheck`: **passed**; `/private/tmp/dev0352-types.log`. `node node_modules/next/dist/bin/next build --webpack`: **passed**, including the final repeat after the hidden-field ordering adjustment; `/private/tmp/dev0352-build-final.log`. Shared `.next` was not overwritten.
- Native Safari desktop and **375 × 844**: **passed**. Home shows the supplied banner, discipline strip, four real cards and no search/map shortcut/Load more. Boxing selection gives the actual two-coach preview; Explore more is visible below it and opens `/explore?discipline=Boxing` with the correct selected shortcut and two actual coaches. Explore's phone primary bar contains coach/focus and location, with no dropdown/duplicate query. Layout, banners and actions remain readable without horizontal clipping.
- Native legacy URL replay on port 3100: `/?discipline=Boxing&location=Berlin&page=2` reached `/?discipline=Boxing`, with two actual matches and the correct Explore more destination. Configuration-free production response independently returned **307**, `Location: /?discipline=Boxing`; `/private/tmp/dev0352-legacy.headers`.
- Native Chrome final-build preview: query text entry, **Tab** to location with a visible purple focus outline, location entry and **Enter** produced all four values: `q=Daniel`, `location=Berlin`, `discipline=Boxing`, `view=list`. Shortcut and Clear search links retained their documented filters/view. This checked native form integration without application data; final hidden-field reordering only changes serialization order and was regression/build checked separately.
- Configuration-free production preview at port 3159 with database/Auth/SMTP settings removed: Home **200 / 31,649 bytes**, Explore with Boxing **200 / 27,984 bytes**. Home retains unavailable/retry/Explore more with no retired form/map/pagination controls; Explore retains its unavailable heading/explanation/retry and selected shortcut/search. Native Chrome also exposed the unavailable heading/retry in its accessibility tree. Files `/private/tmp/dev0352-{home,explore}-unavailable.html`. Temporary preview server stopped after checks. This is recovery presentation, not a real database outage/recovery rehearsal.
- Empty versus unavailable behavior is covered by the existing Home/Explore static-render regressions, including zero cards and truthful recovery, without adding test accounts or hiding retained coaches. Native real flow used existing records; no database edits were needed.
- Browser specs above were updated/typechecked/linted but **not executed with Playwright**; native CUA checks supplied the selected UI evidence. Existing unrelated fixture/media assumptions in those broader specs are outside this slice. No broad browser-suite pass is claimed.
- All **16 affected source/test files** match the final passing build snapshot byte-for-byte. Local ticket links/anchors and `git diff --check` on owned changes **passed**, repeated after archival/index-link updates. Database/migration tests are not applicable to this discovery-only change.

| Criterion | Evidence | Result |
| --- | --- | --- |
| AC1 | Four-card bounds/markup tests and native desktop/phone discipline/Explore more flow. | Passed locally |
| AC2 | Canonicalization/empty/unavailable regressions, actual browser redirect and independent 307/HTML preview. | Passed locally |
| AC3 | One query input/hidden discipline regressions, native phone form and Chrome keyboard combined GET values. | Passed locally |
| AC4 | 25 tests, scoped lint/format, typecheck/final build, native reviews and consistent links/specification/build sources. | Passed locally |

## Risks, limitations, and follow-ups

No unmet acceptance criteria remain. Native control overlapped a separate ongoing browser test; only explicitly observed destinations/states count as evidence. No independent review or deployment is claimed. Prior banner/theme and parallel authentication/editor work remains preserved. Full historical browser suites were not run; this ticket uses focused regressions plus native flow evidence. The configuration-free preview verifies recovery presentation and form integration, not a real service outage/recovery.

## Completion and review references

- Completed: 2026-10-18 — all four acceptance criteria passed locally.
- Commit: Included with this record in the user-authorized DEV0350–DEV0358 public-discovery/Events commit; see Git history for this ticket.
- Review: Scope/implementation self-review, native checks and final source/link consistency completed; no independent review.
- Deployment or release: None.
