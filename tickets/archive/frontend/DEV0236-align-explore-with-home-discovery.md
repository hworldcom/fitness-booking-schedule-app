# Ticket DEV0236: Align Explore with Home discovery

- Status: Completed
- Created: 2026-10-15
- Last updated: 2026-10-15
- Milestone: M3 — Scheduling interface / public discovery refinement
- Coordination: None — independent development ticket
- Related records: delivered Home baseline [DEV0228](DEV0228-build-home-coach-grid-with-discipline-filter.md); delivered desktop Explore [DEV0199](DEV0199-redesign-desktop-coach-explore.md) and mobile Explore [DEV0200](DEV0200-add-mobile-explore-map-list-state.md); illustrative proposal [DEV0235](../../current/frontend/DEV0235-preview-home-aligned-explore.md); independent deferred Home query search [DEV0227](../../current/frontend/DEV0227-reintroduce-home-search-after-client-feedback.md)

## Objective and context

The user reviewed the HTML proposal and authorized implementation on 2026-10-15: Home retains its current experience; Explore shares its visual styling, search and coach cards while retaining Explore-only coach/focus search, a desktop map beside results, and the mobile List/Map switch. Replace Explore's oversized dark hero and dense biography cards with focused discovery. Implement against the [discovery contract](../../../docs/mvp-spec.md#42-discover-a-coach-and-time), [M3 milestone](../../../docs/mvp-spec.md#12-delivery-milestones) and [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix); update the current specification in this change.

## Scope and non-goals

- In scope: compact Explore heading; Home-style pill search and typed/scrollable discipline controls through shared components; simple public portrait/initial cards in a desktop two-column grid beside the existing real map; responsive card/map/selected-preview styling; current truthful today/actual-venue summaries; filter/view/focus/recovery compatibility and meaningful regression validation.
- Out of scope: changing Home's presentation/search/pagination, public profile/scheduling behavior, backend/data/map providers, ranking/proximity/date/price/reviews, auth/connections/native work, adopting the preview's schematic data/map into the app or publishing. The user subsequently authorized committing the completed implementation.

## Expected behavior and edge cases

- Home keeps its current markup/presentation and discipline/location-only discovery. Explore retains coach/focus query, supported discipline/location normalization, alphabetical ordering and complete filtered inventory.
- Explore search, discipline shortcuts and clear links preserve the canonical mobile view and applied filters; reset only the intended filter. Typed discipline suggestions and invalid/alias/blank input have browser validation plus server normalization, including JavaScript-free GET submission and back/forward/reload recovery.
- Cards use current public portraits or initials, accurate trust labels and primary training place, with a compact truthful today/no-availability state. Full biographies remain on the public profile. Every displayed today time identifies its actual venue, independently of the primary marker.
- Desktop shows all cards beside a sticky bounded map. Mobile defaults to list and exposes canonical `view=list|map`; selecting a coach previews that exact coach, retains keyboard focus and never starts a booking. Provider failure clears selection and leaves the complete usable list/profile access; empty/unavailable directory states contain no invented inventory.
- Long names/venues, unavailable portrait, coincident map points, filtered-out selection, reduced motion and 375/430/768/1024/1440-pixel layouts remain usable without horizontal overflow.

## Assumptions, decisions, and dependencies

- Confirmed: implement the reviewed Home-aligned Explore direction; retain Home and Explore-only map/query distinction.
- Implementation defaults: share the existing typed discipline and scroll controls rather than duplicate them; scope Explore CSS so Home remains visually unchanged. Keep the existing real OpenFreeMap component and availability projections.
- Preserve canonical explicit mobile view across search/filter/clear navigation; no new public query parameter is introduced.
- DEV0235 is an illustrative source, not a runtime dependency. Its pending standalone browser checks do not block this separately validated application implementation.
- Scope review: one bounded frontend slice; no coordination split or backend/database work is required. Installed Next.js 16.3.8 Form/Link/layout guidance is inspected before integration changes.

## Implementation plan

1. Record this ticket/index and adopt the compact Explore presentation in the specification before runtime edits.
2. Extract reusable discipline input/navigation behind compatible Home wrappers; extend Explore search with Home-style form presentation and preserved filter/view URLs.
3. Replace Explore's hero with a compact heading, simplify result cards, and apply scoped grid/portrait/map/selected-preview/responsive styles while preserving map/list authority and actual-venue availability.
4. Update meaningful render/URL tests and existing public/browser discovery coverage for typed search, view/filter/history/focus, provider failure and Home regressions.
5. Run app/server tests, relevant browser flows at mobile/desktop with real local public directory and unavailable/JavaScript-free states, lint/type/format/build and document checks. Review actual screenshots, finish evidence and archive only when all applicable criteria pass.

## Acceptance criteria

- [x] AC1: Explore delivers the adopted compact Home-aligned search/cards with desktop real map and mobile List/Map; Home retains its current visual/search/pagination behavior.
- [x] AC2: Query/discipline/location/view, shortcuts/clear, reload/back/forward, aliases/invalid values and JavaScript-free submission preserve the documented canonical discovery contract.
- [x] AC3: Real profiles/portraits/initials/trust/primary places/today venues stay truthful; keyboard/reduced-motion selection, coincident markers, provider failure, empty/unavailable states and narrow/long-content layouts retain full list/profile recovery.
- [x] AC4: Meaningful tests and relevant browser checks, visual mobile/desktop review, lint/type/format/build and document checks pass, with exact implementation/validation evidence.

## Validation plan

Extend existing marketplace/Home static tests and `tests/browser/coach-discovery.spec.ts`/public discovery regressions. Use the local restricted runtime database for actual directory checks and configuration-free production preview for unavailable states; do not modify/reset existing accounts or migration data. Exercise 375/430/768/1024/1440 widths, keyboard navigation, no-JavaScript form and view-preserving filtering/history, profile links, real markers and forced provider failure. Run `npm test`, relevant Playwright tests, `npm run lint`, `npm run typecheck`, `npm run format:check`, configuration-free `npm run build`, affected Markdown formatting/link/ID/status checks and `git diff --check`. Database tests/migrations are not applicable unless scope changes: no data/authority code is planned.

## Implementation record

Implementation and required validation are complete. Existing DEV0235 preview and independent DEV0233/group-planning changes are preserved; group-record edits here repair only links to this archived ticket.

### Changes and rationale

Replaced the dark Explore hero with a compact heading and Home-style search/discipline shortcuts. Result cards now show public portraits/initials, trust, disciplines, primary place and compact actual-venue today states in two columns alongside the existing map. Full biographies remain on profile pages. Home keeps compatible wrapper components and its existing IDs, URLs, markup classes, search fields and pagination.

Shared discipline input/navigation and alias/pattern helpers prevent parallel Home/Explore control implementations. Explore forms, shortcuts, retries and clear links retain explicit `view=list|map`; typed aliases also normalize server-side when JavaScript is disabled. Public data, map coordinates/selection, occurrence authority and profile routes are unchanged. Duplicate identical name/address labels are rendered once, without removing distinct actual venue information.

### Affected files

| File or component                                                                                                                                                                                                                                                   | Change and purpose                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Explore route](../../../src/app/explore/page.tsx), [search contract](../../../src/features/coaches/marketplace-search-contract.ts)                                                                                                                                 | Normalize typed discipline aliases and pass the explicit view to search without adding an implicit URL parameter.                                                                                               |
| [Shared input](../../../src/features/coaches/marketplace-discipline-input.tsx), [shared navigation](../../../src/features/coaches/marketplace-discipline-navigation.tsx), [shared discipline contract](../../../src/features/coaches/discipline-search-contract.ts) | Reuse Home behavior with route-specific IDs and canonical links. Existing Home input/navigation wrappers and contract exports retain compatible use.                                                            |
| [Explore search](../../../src/features/coaches/public-marketplace-search.tsx), [directory](../../../src/features/coaches/coach-discovery.tsx)                                                                                                                       | Progressive GET form, compact heading, truthful recovery and view-preserving clear/retry navigation.                                                                                                            |
| [Result composition](../../../src/features/coaches/coach-explore-results.tsx), [shared card](../../../src/features/coaches/compact-coach-card.tsx), [today summary](../../../src/features/coaches/coach-today-availability.tsx)                                     | Keep real map authority/selection and actual venues while simplifying cards and heading hierarchy.                                                                                                              |
| [Scoped Explore stylesheet](../../../src/app/explore-discovery.css), [layout stylesheet import](../../../src/app/layout.tsx)                                                                                                                                        | Two-column portrait cards beside the bounded map; mobile form/cards/views, long-text wrapping, focus and readable availability. Home selectors remain scoped to their existing surface.                         |
| [Search tests](../../../tests/marketplace-search.test.ts), [Home/card tests](../../../tests/home-marketplace.test.ts), [redesign browser checks](../../../tests/browser/explore-redesign.spec.ts)                                                                   | Alias/URL/view/projection/privacy boundaries and real directory, history, JavaScript-free and responsive/keyboard flows. Existing public-story and coach-discovery tests use the adopted typed Explore control. |
| [Specification](../../../docs/mvp-spec.md), [ticket index](../../README.md)                                                                                                                                                                                         | Adopt C34 and discovery presentation and track this independently scoped implementation.                                                                                                                        |

### Decisions and deviations

2026-10-15: The user authorized runtime adoption of the shared visual direction. The example HTML remains illustrative; actual app data/map and existing scheduling permission boundaries remain authoritative.

2026-10-15: Share typed discipline aliases/patterns behind compatible Home exports. Explore's lower-case/alias values now canonicalize server-side as well as in the browser, allowing native GET recovery without changing the supported discipline set. Preserve explicit view across all filter actions while leaving the default implicit list URL omitted.

2026-10-15: Use an ignored, environment-file-free source snapshot for production builds/browser tests so the running local development server's `.next` output is not replaced. No local account or migration reset is performed. Native browser automation was unreliable during DEV0235; implementation verification uses the repository's maintained browser test commands and their screenshot evidence.

2026-10-15: Browser screenshots caught profile actions escaping narrow cards: the inherited mobile flex column combined with wrapping and a 100% flex basis created a second horizontal action column. Replace Explore actions with a single-column grid and wrap complete location text. Add card-bound action geometry checks; rerun landscape tap/view recovery and mobile screenshots before completion. Older regression selectors tied to result h2 headings and literal discipline punctuation were updated to the new h3 hierarchy and compact text.

### Contracts, configuration, and operations

C34 adopts the focused presentation. The existing Explore query/view URL keys and public projections remain compatible; typed discipline aliases gain the same canonicalization as Home. Shared components take a route destination/ID prefix and an optional explicit Explore view. Existing Home component names/exports remain available. No new dependency, environment variable, data shape, schema, migration or setup step is introduced.

## Validation results

Validation on 2026-10-15 with Node.js 24.21.0, Next.js 16.3.8 and Chrome through the maintained Playwright commands. The ignored production snapshot `test-results/dev0236-preview/` contains no environment files; changed source/test files were compared with the working tree. Database-backed checks use only the existing restricted loopback runtime login. No accounts, coach data, migrations or local services were reset.

- `npm test`: 144 application/model/render tests plus 15 server tests passed (159 total, zero failures); `/tmp/dev0236-tests-final.log`. New cases prove aliases/invalid values, explicit-view-preserving form/shortcut/clear contracts and distinct actual today venues versus primary places. Existing Home pagination/filter/projection checks remain intact.
- `npm run lint`, `npm run typecheck`, `npm run format:check`: passed on final sources; `/tmp/dev0236-lint-final.log`, `/tmp/dev0236-types-final.log`, `/tmp/dev0236-format-final.log`.
- `npm run build` in the isolated snapshot with DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SITE_URL and NEXT_PUBLIC_GEOAPIFY_API_KEY explicitly empty: passed; `/tmp/dev0236-build-final.log`. The existing development server's build output was preserved.
- With the restricted loopback DATABASE_URL and empty public Auth/provider settings, `npx --no-install playwright test tests/browser/explore-redesign.spec.ts tests/browser/coach-discovery.spec.ts tests/browser/public-story.spec.ts tests/browser/public-accessibility.spec.ts --grep 'Explore|explore|directory|Home|home|public|reduced motion|marketplace|narrow|mobile card|mobile map failure'`: 35 passed, nine deliberate duplicate/project-specific skips, zero failures; `/tmp/dev0236-browser-final.log`. This covers the actual five-coach directory, public portrait/initial fallback, coincident markers, both selection directions and original profile links, actual-venue today/no-availability presentation, explicit view/filter/clear/history/reload, typed and JavaScript-free submission, real map/provider failure, pre-hydration portrait failure, reduced motion/focus, mobile rotation and Home/shell regressions. Responsive checks cover 375/430/768/1024/1440 pixels, keyboard field order, long browser-only content and card-bound action geometry. New navigation tests serve a valid local background style to isolate URL/focus behavior from tile latency; existing selection tests exercise actual OpenFreeMap tiles and the real MapLibre engine.
- With DATABASE_URL and all optional public settings empty, `npx --no-install playwright test tests/browser/explore-unavailable.spec.ts`: two passed (desktop/mobile), zero failures; `/tmp/dev0236-unavailable.log`. Search/view/retry remain usable and no substitute coach, portrait or map inventory appears.
- Final screenshot review: `npx --no-install playwright test tests/browser/explore-redesign.spec.ts tests/browser/coach-discovery.spec.ts --grep 'shares Home|persistent coach directory' --output=/Users/hoangdeveloper/fitness-booking-schedule-app/test-results/dev0236-visual`, with the restricted loopback directory: three passed/one deliberate mobile duplicate skip; `/tmp/dev0236-visual.log`. Viewed the final 375-pixel card viewport, desktop real-map selected viewport and mobile unavailable screenshot. Portraits/initials, primary and actual today venues, wrapped location text, focused selection and both card actions are readable and contained. No profile action escapes into an adjacent column. Screenshots are retained in ignored `test-results/dev0236-visual/` and `test-results/dev0236-unavailable/`; full-page sticky-header placement is not substituted for the viewed viewport evidence.
- `curl --silent --show-error --max-time 45 http://localhost:3100/explore --output /tmp/dev0236-running-explore.html --write-out '%{http_code}\n'`: HTTP 200. The returned guest page has the adopted heading/search and no old hero. The shared development server remains running.
- `python3 /tmp/dev0236-check-docs.py`, affected Markdown Prettier checks and `git diff --check`: final link/anchor/ID/index/status/archive/contract consistency passed.
- Earlier failures were corrected and rerun: sandboxed tsx could not create its local IPC socket (authorized rerun passed); two assertions required a literal GET attribute whereas Next Form uses native GET by default (updated assertions plus real JavaScript-free proof); dot-all test regexes exceeded the TypeScript target (compatible expressions); older card h2/punctuation selectors (updated semantic hierarchy/text assertions); mobile wrapped flex actions escaped their cards and disturbed landscape clicks (one-column action grid, complete venue wrapping and passing geometry/rotation checks). The initial browser pass was 29 passed/seven skipped/four failed; none of those failures is counted as passing evidence.
- Database/migration checks are not applicable: no persistence, provider integration or scheduling/permission code changed. No hosted rehearsal, independent review or deployment was performed. The owned validation snapshot was removed after its browser servers stopped; supporting logs/screenshots and the shared development server were preserved.

| Criterion | Evidence                                                                                                                                                                       | Result |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| AC1       | Real directory composition, final mobile/desktop viewport review and unchanged Home presentation/search/pagination regressions.                                                | Passed |
| AC2       | Render/browser aliases, query/discipline/location/view, shortcuts/clear, reload/history and JavaScript-free GET checks.                                                        | Passed |
| AC3       | Public media/today/selection/coincident/provider-failure/empty/unavailable checks, reduced-motion/keyboard/rotation and long-content/action geometry plus final visual review. | Passed |
| AC4       | 159 app/server tests, 35 configured and two unavailable browser checks, final screenshot rehearsals, lint/type/format/build and documentation consistency.                     | Passed |

## Risks, limitations, and follow-ups

Map-provider availability remains external, with the complete list as recovery. DEV0227's future Home coach/focus search remains a separate Draft. All required implementation and validation are complete. The independent DEV0235 standalone preview remains a separate current record; this application completion does not claim its remaining native-browser checks passed.

## Completion and review references

2026-10-15 commit preparation: the user requested committing all current changes. The current combined working tree passes `npm test` (146 application/model/render plus 15 server tests; 161 total, zero failures), `npm run lint`, `npm run typecheck` and `npm run format:check`; logs are `/tmp/movx-commit-current-{tests,lint,types,format}.log`. The first sandboxed test attempt could not open the tsx IPC pipe; the authorized rerun passed. `python3 /tmp/dev0236-check-docs.py` passed affected links/anchors, 154 unique indexed/statused records and contract/archive consistency. The source keeps the scoped Explore stylesheet import and the existing Messages stylesheet after feature themes. Prior full build/browser/viewport evidence above remains applicable; no implementation change is introduced by this commit preparation. Stage only this ticket's source/tests, Explore specification amendments and index entry; preserve group adoption for DEV0233's separate commit.

- Completed: 2026-10-15; all acceptance criteria and required local checks passed.
- Commit: User-authorized implementation checkpoint — `[DEV0236] Align Explore with Home discovery`.
- Review: Source/contract, automated browser and actual viewport self-review passed. No independent review.
- Deployment or release: Not deployed or released.
