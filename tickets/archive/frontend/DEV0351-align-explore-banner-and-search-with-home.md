# Ticket DEV0351: Align Explore banner and search with Home

- Status: Completed
- Created: 2026-10-18
- Last updated: 2026-10-19
- Milestone: Public marketplace visual polish
- Coordination: None — independent development ticket
- Related records: [DEV0350 public theme/Home banner](DEV0350-soften-public-page-colors-and-replace-home-banner.md), [DEV0316 directory cards](DEV0316-redesign-coach-directory-cards.md), [DEV0236 Explore discovery](DEV0236-align-explore-with-home-discovery.md).

## Objective and context

The user requests a photographic Explore banner using the supplied black-and-white training image, matching Home's banner dimensions and search size/placement. Explore currently has an inset text header and a wider three-field search. Follow [public discovery](../../../docs/mvp-spec.md#42-discover-a-coach-and-time); retain its separate coach/focus query, filters and List/Map behavior.

## Scope and non-goals

- In scope: exact supplied photo as a static Explore asset, shared Home/Explore hero sizing and optimized image rendering, full-width Explore framing, matching primary discipline/location search and shortcut geometry, an accessible secondary coach/focus refinement, current specification and provenance.
- Out of scope: discovery/query authority, map-provider changes, coach/account records, new filters, migrations, authentication, commits and deployment.

## Expected behavior and edge cases

Both routes start the hero directly under the same public header, use `clamp(210px, 24vw, 340px)` above 760 px and 160 px below, then place the centered search 12 px below it with an 880 px maximum and matching responsive gutters. Explore retains its heading as selectable HTML over the photo with readable contrast and one page heading. Its shared discipline/location controls and shortcuts align with Home; coach/focus stays available below those common controls, participates in the same GET submission, and preserves explicit view/filters. Empty/unavailable results keep the banner/search and truthful recovery. Missing images leave readable text. Photos are illustrative, not published MovX coaches/venues.

## Assumptions, decisions, and dependencies

Confirmed: supplied photo, equal banner size and aligned search components. Implementation default: keep Explore's existing extra coach/focus field as a secondary refinement below the common controls so matching their geometry does not remove functionality. Keep existing Explore heading/description and Back to Home action in the appropriate hero/refinement area. The matching 5240 × 3493 source `grace-anne-bobadilla-nH3Nkhu-C1Y-unsplash.jpg` was located in Downloads and visually inspected against the attachment. Copy unchanged bytes; no generation. Next.js 16.3.8 installed image/CSS documentation was reviewed. Preserve all unrelated shared worktree changes and do not read populated configuration or private coach journals.

## Implementation plan

1. Record the adopted design in the specification/index and copy the exact source with hash/provenance.
2. Extract Home's optimized hero into a shared component; use it on Explore with route-specific crop and readable text. Remove Explore's outer inset while keeping bounded results.
3. Align primary search and discipline shortcuts with Home. Preserve the coach/focus query in one accessible GET form, filter values, clear action and explicit view.
4. Run focused existing discovery/search/card tests, scoped lint/format, isolated typecheck/build, links and source/hash checks. Verify desktop/phone Home-versus-Explore geometry, keyboard query/filter submission and empty/unavailable rendering without database writes.
5. Record exact evidence and archive only after all criteria pass.

## Acceptance criteria

- [x] AC1: Explore shows the exact supplied photo at the same banner width/height/starting position as Home at desktop, tablet and phone widths, with readable heading and no stretching.
- [x] AC2: Common search fields/button/shortcuts match Home's size and placement; Explore's query/filter/view/clear behavior remains usable by keyboard and native GET submission.
- [x] AC3: Real results, empty/unavailable states and existing Home presentation remain usable; no retained account/coach data changes.
- [x] AC4: Relevant tests/lint/format/type/build and desktop/phone keyboard reviews pass; provenance, specification, links and ticket evidence are complete.

## Validation plan

Use existing Home marketplace, marketplace search and directory-card tests. Add meaningful coverage only for the changed form association/submission contract if needed; avoid CSS-mirroring tests. Compare asset bytes/hash/dimensions and use existing image optimization. Review native browser at desktop, 768 px and 375 px with equivalent Home/Explore framing, actual results and filtered empty results; inspect an isolated actual unavailable component if a real outage is not present. Verify focus and query Enter/search-button GET submission without writing records. Run scoped ESLint/Prettier and a clean-copy production build/typecheck without overwriting the shared `.next` directory. Database tests/migrations are not applicable to this presentation change.

## Implementation record

Implemented and verified locally on 2026-10-18.

### Changes and rationale

Explore's inset text heading is now a full-width photographic hero, using the exact supplied black-and-white source, 5240 × 3493 and 2,928,622 bytes. SHA-256: `ffd2d73e4156b6a7a56b89fde482d5a9279a8b35815100ac61454ff6b90ceddc`. The heading/description remain HTML over a white left fade; a higher `center 10%` crop keeps the central athletes' faces recognizable. The alt describes the scene without identifying a MovX coach/place.

Home and Explore use one optimized hero component and the existing height rules: `clamp(210px, 24vw, 340px)` above 760 px, 160 px on phone. Home's photograph, slogan, framing and loading/quality settings remain. Explore's shell gets a route-only full-width class; its results remain bounded to the previous 1180 px maximum. Removing the inherited directory maximum was necessary to make the hero reach both edges.

Explore's centered primary form now matches Home's discipline/location grid, responsive gutters, 880 px maximum, 12 px top gap, icon/text button and compact horizontal discipline shortcuts. The coach/focus query remains below those shared controls, explicitly associated with the same form through native HTML `form="explore-search-form"`. Both Enter in that input and the main search button submit all fields. Clear links and explicit List/Map state retain their existing URL contract. Back to Home remains below search, and no result/map/booking authority is changed.

### Affected files

| File | Change and purpose |
| --- | --- |
| [marketplace-hero.tsx](../../../src/features/public/marketplace-hero.tsx), [coach-story.tsx](../../../src/features/public/coach-story.tsx) | Shared responsive optimized hero; Home retains its existing photo/title and sizing. |
| [coach-discovery.tsx](../../../src/features/coaches/coach-discovery.tsx), [shell.tsx](../../../src/components/shell.tsx) | Explore hero and bounded results, with a full-width route-only shell class. |
| [public-marketplace-search.tsx](../../../src/features/coaches/public-marketplace-search.tsx), [public-page-theme.css](../../../src/app/public-page-theme.css) | Matching common controls/shortcuts and retained form-associated coach query; scoped crop, contrast and responsive geometry. |
| [marketplace-search.test.ts](../../../tests/marketplace-search.test.ts) | Verifies that the secondary query remains associated with the GET form, alongside existing filter/view/clear contracts. |
| [explore-training.jpg](../../../public/images/explore-training.jpg), [asset provenance](../../../public/images/README.md) | Exact unedited source, dimensions/hash and illustrative-image record. |
| [specification](../../../docs/mvp-spec.md#42-discover-a-coach-and-time), [index](../../README.md) | Adopted Explore banner/search design and completed work tracking. |

### Decisions and deviations

Secondary-query placement is an implementation default, not a user-selected product change. Native desktop review exposed the inherited 1180 px directory maximum retaining side margins on the new banner; the final route-only override removes that limit while preserving it on results. Safari sometimes retained the earlier paint after hot reload; Reload Page From Origin and final responsive replays confirmed the corrected source. No material scope deviation.

### Contracts, configuration, and operations

No schema/API/dependency/environment changes or migrations. No account/coach edits, provisioning, reset or mutating test flows were performed. Temporary previews stayed outside the repository and shared `.next`; they did not replace the development server. Rollback is a code/static-asset revert. Native GET forms retain their query parameters; the external query input's form association is the only markup integration change.

## Validation results

2026-10-19 commit verification: the exact staged source passed 51 frontend/domain and 16 backend regressions on Node 24.21.0, scoped ESLint/Prettier, isolated typecheck and production webpack build. Shared contract/index changes exclude unrelated work; 655 local links resolve, with the two intentionally private credential-journal links excluded from version control. DEV0358 records commands, snapshot and remaining native acceptance; committing does not complete DEV0357/DEV0358 or deploy the feature.

Environment: 2026-10-18, Node 24.21.0, Next.js 16.3.8, existing local app on port 3100. Node commands used `/Users/hoangdeveloper/.local/node/24.21.0/bin/node`; populated environment files/private coach journals were not read.

- `node --import tsx --test tests/home-marketplace.test.ts tests/marketplace-search.test.ts tests/coach-directory-cards.test.ts`: **23 passed**, none skipped/failed. Log `/private/tmp/dev0351-tests.log`. Existing static-render image-quality warnings occur when Next config is not loaded; the real config/hero keep quality 95.
- `node node_modules/eslint/bin/eslint.js src/features/public/marketplace-hero.tsx src/features/public/coach-story.tsx src/features/coaches/coach-discovery.tsx src/features/coaches/public-marketplace-search.tsx src/components/shell.tsx tests/marketplace-search.test.ts`: **passed**.
- `node node_modules/prettier/bin/prettier.cjs --check src/features/public/marketplace-hero.tsx src/features/public/coach-story.tsx src/features/coaches/coach-discovery.tsx src/features/coaches/public-marketplace-search.tsx src/components/shell.tsx src/app/public-page-theme.css tests/marketplace-search.test.ts public/images/README.md`: **passed**.
- Isolated snapshot `/private/tmp/movx-dev0351-y_81250z` copies source/public/scripts/tests and build configuration without populated environment files/journals. `npm run typecheck`: **passed**. `node node_modules/next/dist/bin/next build --webpack`: **passed**, repeated after the final width correction. Logs `/private/tmp/dev0351-types.log` and `/private/tmp/dev0351-build-final.log`. Eight affected source/test/asset files match the final passing build byte-for-byte; shared `.next` was not overwritten.
- Source/public image comparison: **identical bytes/hash**, metadata 5240 × 3493. Native responsive delivery shows the correct photograph without stretching; historical Home assets remain. Existing height stylesheet has no change.
- Native Safari at desktop, **768 × 844** and **375 × 844**: **passed**. Both pages' banner starts/ends and primary search/shortcuts line up at the same widths. Home retains its readable two-line slogan, photo and real four-card discovery. Explore has a readable title/description and recognizable athletes, with no horizontal clipping; its real six-coach list/map and filtered Daniel result remain present.
- Keyboard coach-query Enter on the real app reached `/explore?q=Daniel`, with one actual Daniel Park result and retained query/clear controls: **passed**. Purple query focus was visible. Phone primary-button Option-Tab/Return after setting location to Berlin reached `/explore?q=DEV0351-no-match&location=Berlin&view=list`: **passed**, proving the secondary query, location and explicit view submit together. The phone icon-only button retains the accessible Search coaches name.
- Real phone empty state at the nonmatching query: **passed**, with complete message and recovery links retaining `view=list`. Existing tests independently cover unavailable versus empty results and explicit map/list preservation.
- Final production build served separately at port 3159 with database/Auth/SMTP settings removed: `/explore` returned **HTTP 200 / 29,149 bytes** with its actual unavailable state. Native 375 px review showed the unchanged banner/search, full unavailable explanation and readable Try again action: **passed**. This is configuration-free recovery presentation, not a claimed database outage/recovery rehearsal. The temporary server was stopped; Safari was returned to normal desktop mode and real Explore.
- Earlier shared-app curl (45 seconds) and initial restricted-runtime preview curl (20 seconds) timed out without a response and were **not counted as passes**. The existing app subsequently loaded and all real native query/geometry checks above passed; configuration-free preview supplied final unavailable evidence. No server reset or account repair was used.
- Local link/anchor checks and `git diff --check` on owned changes: **passed**. Completed ticket/index/provenance links were updated during archival. Database/migration tests are not applicable to this presentation-only slice.

| Criterion | Evidence | Result |
| --- | --- | --- |
| AC1 | Exact photo/hash, shared hero/height rules, native desktop/768/375 comparison. | Passed locally |
| AC2 | Matched primary geometry/shortcuts, focused form regression and real keyboard query/button URLs. | Passed locally |
| AC3 | Real six-coach/one-coach/empty states, actual configuration-free unavailable state and Home comparison; no data-edit workflow. | Passed locally |
| AC4 | 23 tests, lint/format/type/final build, native reviews and consistent provenance/specification/links. | Passed locally |

## Risks, limitations, and follow-ups

No unmet acceptance criteria remain. The unavailable state was reviewed in a configuration-free final-build preview, not by interrupting the real database. Local development had intermittent slow responses/stale paint; final native checks used verified destinations and refreshed styling. Normal panoramic cropping is intentional. Parallel authentication/editor work and DEV0350 changes remain preserved. Hosted deployment, independent review and broader map-provider rehearsals are outside this ticket.

## Completion and review references

- Completed: 2026-10-18 — all acceptance criteria passed locally.
- Commit: Included with this record in the user-authorized DEV0350–DEV0358 public-discovery/Events commit; see Git history for this ticket.
- Review: Scope/implementation self-review and native responsive/keyboard/state checks completed; independent review not performed.
- Deployment or release: None.
