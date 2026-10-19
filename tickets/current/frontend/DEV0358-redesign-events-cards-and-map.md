# Ticket DEV0358: Redesign Events cards and map

- Status: Blocked
- Created: 2026-10-18
- Last updated: 2026-10-19
- Milestone: Public group-session discovery
- Coordination: [COR0030 — Events cards, banners and map](../organisatory/COR0030-events-cards-banners-and-map.md)
- Related records: Peer boundaries and historical dependencies are mapped by COR0030; existing group lifecycle remains [DEV0240](../../archive/frontend/DEV0240-add-group-event-discovery-and-joining.md).

## Objective and context

Give public Events Home-like bordered media cards with the coach portrait, a responsive three-column list, Load more and a venue map on the right, preserving actual group-session authority and the newly aligned hero/search.

## Scope and non-goals

In scope: public event/coach media from DEV0356, bordered banner/small-portrait cards, responsive grid, displayed-session venue map/selection/mobile List–Map fallback, cursor-backed appended Load more/reset/retry/no-JavaScript continuation and final integration proof. Out of scope: upload authority/UI (DEV0356/DEV0357), public coach redesign, new filters/ranking/radius/live location or changed registration/confirmation rules.

## Expected behavior and edge cases

Show the event-specific image, otherwise coach banner, otherwise decorative cover; failed images fall through truthfully, with public coach portrait/initials kept small. Event title/banner open its actual detail; coach identity opens the public coach page. Keep date/time/Berlin venue/price/seats/trust/confirmation state readable. At suitable wide widths, three cards per row sit beside a sticky right map; use fewer columns at narrower sizes. Phone defaults to list with canonical List/Map controls like Explore and complete list fallback when the provider fails. Pins identify each displayed session at its immutable published venue snapshot; distinct sessions at one venue remain selectable. Label that the map represents loaded results. Load more appends the next authoritative cursor page, deduplicates IDs, updates pins, retains prior cards on failure, resets on filters and announces/focuses new content. Do not claim a total inventory count or load all pages eagerly. Ordinary GET continuation remains reachable without JavaScript.

## Assumptions, decisions, and dependencies

User confirmed separate event banner/coach fallback and requested Home-style coach identity, approximately three columns, Load more and a right-side map. Adopted defaults: loaded-results map, existing 20-item backend cursor batches, responsive 3/2/1 grid, mobile List/Map URLs and provider failure fallback. Reuse provider-neutral LocationResultsMap, public media and existing ordering/filter semantics; no private avatar or coach-base coordinates. DEV0356 projection must stabilize; complete upload/public integration after DEV0357.

## Implementation plan

1. Review stabilized media/query contracts and record exact pagination/view URLs and responsive layout before edits.
2. Implement semantic event cards using shared card-media/Avatar conventions, truthful media fallbacks and existing session details.
3. Add a client list/map selection view around server results, reuse provider-neutral map, preserve URL/history, keyboard and provider/no-JavaScript recovery.
4. Add bounded cursor Load more with reset/deduplication/error preservation, loaded-result markers and accessible status/focus.
5. Run meaningful paging/filter/state/map/media tests, scoped lint/type/build and native desktop/375 px real-data, collision, failure and keyboard checks. Own the combined isolated coach upload→public card→replace/remove/fallback rehearsal; preserve all retained records.
6. Complete this record and COR0030 integration checks only when all peers/evidence pass.

## Acceptance criteria

- [x] AC1: Cards use the actual event banner or coach/decorative fallback and small public portrait, retain truthful session details/links, and fit a wide three-column grid with right map and responsive layouts.
- [ ] AC2: Map selects displayed sessions at actual published venues, including co-located events; mobile List/Map, keyboard and provider failure preserve usable list/navigation.
- [ ] AC3: Load more appends/deduplicates an authoritative next cursor, updates pins, resets on filters and preserves existing cards/retry on failure; no-JavaScript continuation works.
- [ ] AC4: Tests/lint/type/build and real isolated upload/public/fallback/map/paging/desktop/phone/keyboard integration pass; all peer statuses and documentation links are consistent.

## Validation plan

Test paging races, invalid/altered cursor response, duplicate IDs, filter/view resets, failed append preservation, same-venue markers, image fallback and canonical view links with meaningful pure/control tests. Native CUA proof uses isolated tagged multi-session data, actual owner upload endpoints/Storage, desktop and 375 px, keyboard and provider unavailable/retry; verify no private media and exact cleanup/retained-data fingerprints. No-JavaScript continuation should be verified through ordinary GET HTML. Do not fabricate loaded events or real data through screenshots. Broad lifecycle/payment/auth rehearsals are outside scope.

## Implementation record

Public directory implementation and public native cases are verified; combined owner/native and final keyboard/filter acceptance is blocked by computer-control failures. Exact fixture cleanup passed.

### Changes and rationale

Events now reads a bounded authoritative group batch plus its public media projection, renders Home-like bordered 8:3 covers/small coach identity, and separates event-detail links from public coach links. Client accumulation uses the existing 20-item cursor batches; a failed request retains the current data. Loaded sessions supply map points at their published venue snapshots. The existing MapLibre/provider-neutral component supplies keyboard markers and distinct co-located session offsets. A mobile canonical List/Map switch preserves appended results; provider failure renders the full loaded list and retry. No-JavaScript output keeps the list and ordinary next-page anchor.

### Affected files

- [Events route](../../../src/app/events/page.tsx): unchanged hero/search geometry, strict presentation/core query split, server-loaded results and remount key for filter/cursor changes.
- [Directory contract](../../../src/features/events/directory-contract.ts): canonical view/filter/cursor URLs, strict bounded response/media validation, exact microsecond cursor comparison, deduplication and published-venue map points.
- [Directory service](../../../src/server/group-sessions/directory-service.ts) and [GET API](../../../src/app/api/events/route.ts): public no-store pages and current media, unavailable rather than fabricated results on inconsistent/unverified reads.
- [Results](../../../src/features/events/event-results.tsx): append/retry/live announcement, focus references, list/map selection/provider recovery and server-rendered list continuity.
- [Event card](../../../src/features/events/event-ui.tsx), [cover](../../../src/features/events/event-card-cover.tsx) and [scoped styles](../../../src/features/events/event-directory.css): distinct links, truthful coach/session details, failed-image chain, 3/2/1 grid and right map.
- [Directory tests](../../../tests/event-directory.test.ts): invalid/query/cursor/media, deduplication, real co-located marker layout, network failure and card fallback/link boundaries.
- [Native fixture companion](../../../scripts/rehearse-local-event-directory.ts) and [rehearsal helper](../../../scripts/lib/local-connection-rehearsal.ts): separate port 3158 preview, tagged new identities/sessions, synthetic images, exact cleanup and retained fingerprints. No browser automation.
- [README](../../../README.md#events-banners-and-directory-validation) and [database guidance](../../../supabase/README.md#group-session-banner-migration): setup/rehearsal navigation and local versus hosted migration status.

### Decisions and deviations

2026-10-19 commit preparation: the user requested committing the delivered public-discovery/Events work while native acceptance remains open. DEV0350–DEV0358 share the final hero, search, Events route and specification changes, so preserve that coherent final state in one commit with every implemented DEV ID in its subject. Keep unrelated Google authentication and DEV0365 How it works work outside it. For shared files, prepare index-only versions retaining the existing How it works implementation and unrelated navigation/Profile tests; stage only this delivery's Home test adjustments and retirement of obsolete Home typed-search flows. Do not overwrite the working copies used by parallel work. Recheck the exact staged source with focused regressions, lint, isolated typecheck/build and local-link checks; record the still-blocked native cases accurately.

2026-10-18 rerun harness correction before edits: current-time-based two-hour spacing produced a 23:xx→00:xx fixture and correctly failed the existing same-Berlin-date constraint. Replace only the disposable schedule with eight one-hour sessions per local date at 08:00 through 22:00, starting three dates ahead, using the existing Berlin local-time parser. Keep real product timing constraints and retained records unchanged. The failed attempt cleaned its exact fixture and preserved all 24 baseline fingerprints.

2026-10-18: Keep the established GroupSession display timestamp projection (milliseconds). Cursor timestamps retain database microseconds; validation compares cursor advancement exactly and matches its last ID/millisecond to the displayed batch without inventing ID order within a rounded millisecond. This avoids changing every existing GroupSession consumer. A session disappearing between group/media reads makes this batch unavailable rather than violating the existing fixed-size next-cursor contract.

Native fixture previews now default to production mode (optional `EVENT_DIRECTORY_MODE=development`) with only loopback public configuration derived in memory; repeated cold dev compilation caused minute-long route/API waits during this rehearsal. The active run switched its own server to the same-source production build on port 3158 while retaining only its existing tagged test records. Native checks use a dedicated Firefox window because the other browser rehearsal continues in Safari/Chrome. Faults are injected only into the disposable preview copy, then restored byte-for-byte; repository runtime code has no test fault switches.

### Contracts, configuration, and operations

Recorded before implementation: keep the existing core discipline/location/sessionType/afterAt/afterId query contract and add optional `view=list|map` only to the directory presentation URL. Strip view before the existing group-query parser; invalid/repeated view values show the existing invalid state. Native search preserves an explicit view through a hidden input. `/api/events` is a public, no-store GET that returns `{status:'ready',queryKey,page:{items,nextCursor},presentations}` or invalid/unavailable, where queryKey is the canonical cursor-free core filter URL and presentations contains only matching public event IDs/media. The client validates the whole response, query association and advancing cursor; it never accepts raw Storage paths or substitutes fixtures.

Load more intercepts its ordinary next-cursor anchor only for an unmodified primary click with JavaScript. It appends at most the existing 20-item batch, deduplicates by session ID, updates matching media/pins, announces new cards and focuses the first appended card. It creates no extra URL history entry; reload starts from the current URL's ordinary server batch. An explicit cursor URL and no-JavaScript continuation show that next batch with Back to first page. Filters/cursor navigation remount the accumulator; view changes preserve it. Failed/altered/repeated-cursor replies preserve existing cards and offer retry.

Layout default: widen only Events results to a 1600 px maximum so cards and map have room; at 1440 px and above use three cards with a 360 px right map, at intermediate desktop widths use two and a 300 px map, below 980 px use the mobile List/Map pattern and 2/1 card columns. Without JavaScript the list remains visible even for a map URL, with an explanatory fallback. Map points are the loaded session IDs/published venue snapshots, with the existing co-located marker layout; no full-inventory implication or coach-base/live position. No authority/schema changes in this peer; media storage is DEV0356.

## Validation results

### Supplemental responsive audit — 19 October 2026

[DEV0367](../../archive/organisatory/DEV0367-audit-athlete-coach-responsive-journeys.md) adds native Firefox phone proof with 24 published groups owned only by a tagged temporary coach. Northside/Boxing initially showed 20; Load more appended four without duplicates and focused the first new card. Selecting a newly appended session's Map link retained all 24 results and the venue filter. Keyboard Shift+Tab reached co-located markers; Enter selected another session and focused its correct preview. An empty venue filter removed old cards/markers; native browser Back restored Northside and its bounded first page. Desktop inspection showed cards beside the map. The configured Chrome suite separately passed mobile provider-failure full-list recovery.

The same audit records phone banner upload/reload/remove with real public image 200→404, exact session-term preservation, and complete temporary-data cleanup with 55 original fingerprints unchanged. These are supplemental observations, not a claim that every earlier Chrome/retry/replacement/recovery criterion has passed. AC2–AC4 and Blocked status remain open pending a focused review and the outstanding cases. DEV0367 is independent of COR0030; no runtime source changed.

2026-10-19 commit verification: the exact staged source passed 51 frontend/domain and 16 backend regressions on Node 24.21.0, scoped ESLint/Prettier, isolated typecheck and production webpack build. Shared contract/index changes exclude unrelated work; 655 local links resolve, with the two intentionally private credential-journal links excluded from version control. DEV0358 records commands, snapshot and remaining native acceptance; committing does not complete DEV0357/DEV0358 or deploy the feature.

2026-10-19 Chrome retry: user requested Chrome. Native control connected after a reset; use a separate Incognito window and new temporary fixtures in the production-mode port-3158 preview. Finish combined owner upload/public-card/fallback plus keyboard/filter-reset acceptance, then exact cleanup. No retained account changes, migration, commit or hosted rollout are included.

Chrome results: `node --import tsx --conditions=react-server scripts/rehearse-local-event-directory.ts` built the same-source production preview at `/private/tmp/movx-dev0358-PLQbDD`; all initial real Auth/Storage/API assertions passed again (20+3 authoritative paging, current public bytes, draft/foreign/stale refusals and ordinary GET continuation). Log `/private/tmp/dev0358-chrome-rerun.log`, build/server log in that preview, API summary under `evidence/api-summary.json`.

Native Chrome Incognito normal sign-in and real picker upload saved the first session's green EVENT BANNER. The public first card displayed that image, then the orange REPLACEMENT after owner replacement. Removal followed by an explicit fresh list URL displayed COACH FALLBACK; the second card kept its independent event image and the third retained decorative cover/initials. A wide Chrome screenshot showed three bordered cards beside the real co-located venue map. Load more appended 20→23, removed its exhausted continuation, updated marker descriptions to 23, announced “3 more sessions loaded” and focused the Class 21 article. Companion reads confirmed session revision/time/price/capacity unchanged while media advanced and was removed.

Keyboard navigation reached the first card's Show on map button, but its attempted activation was not observed, so complete keyboard selection is still open. After 23 cards, a no-match venue form submission reached the correct filter URL; native Chrome then returned a blank/stale page and omitted HTML accessibility content, preventing verification of reset, Clear filters and Back. A separate server GET of that exact URL returned HTTP 200 in 133 ms; this is liveness evidence, not a browser pass. Owner 375 px layout/control presence was observed, but the selected-image picker stalled; a tool reset did not fix subsequent native actions. Phone upload/replace/remove, stale/unavailable recovery, full map keyboard activation, filter-reset/Back and decorative fallback after removing the first coach banner remain incomplete. No runtime code changed in this retry. Preserve prior passed cases; do not mark AC2–AC4 complete.

Chrome retry cleanup: `Exact fixture cleanup and 24 retained-row fingerprints passed`. Port 3158 stopped; the controller retained stdin and was interrupted after that success rather than counted as an exit-zero full rehearsal. Closing the exact two-tab Incognito window and checking afterward both hit native-control `timeoutReached`, so that window may remain; other browser windows were not closed. Documentation consistency check resolved all 326 links in the changed index/peers/coordination, and `git diff --check` passed. The remaining blocker is the native acceptance listed above; no commit or hosted rollout occurred.

Final read-only local inventory confirmed zero DEV0358 tagged Auth accounts, zero rows matching this run's exact 24 session IDs and zero Storage objects under either exact temporary profile. This retry changed validation records only, so it did not repeat unchanged logic regressions; the fresh production build and real API assertions above ran against the current source snapshot. The blank/stale Chrome filter result must be rechecked in a working browser; the separate HTTP liveness check cannot establish its client behavior or rule out a browser-specific issue.

2026-10-18 rerun: user requested retry of the outstanding native checks. Recreate only tagged temporary fixtures in the production-mode preview; resume owner desktop/375 px file-picker, reload/replace/remove/recovery plus public keyboard/filter-reset checks. Earlier blocker/evidence stays below until superseded by observed results.

Rerun outcome: corrected the disposable schedule described above, then ran `EVENT_DIRECTORY_PREVIEW=/private/tmp/movx-dev0358-EDrjHo node --import tsx --conditions=react-server scripts/rehearse-local-event-directory.ts`. The same-source production build passed. Real API assertions passed for 20+3 paging, event/coach/decorative projections, public event image 200, foreign delete 403, stale delete 409, draft image 404 and ordinary GET continuation; evidence is `/private/tmp/movx-dev0358-EDrjHo/evidence/api-summary.json`. The focused 22-test command below passed again (`/private/tmp/dev0358-rerun-tests.log`); scoped fixture ESLint and Prettier passed. Build/server log: `/private/tmp/movx-dev0358-EDrjHo/server.log`.

Native Firefox normal sign-in reached the exact new owner-event URL and “Manage group session” title, but the controller continued showing the old sign-in screenshot and omitted all page accessibility content. Selecting the exact window from Firefox's Window menu did not restore live controls; coordinate clicks sometimes targeted the preserved Welcome window. No new file-picker, owner phone/keyboard/recovery or public keyboard/filter-reset pass is claimed. These remain the acceptance blocker. The test window was closed, leaving the original Welcome window and parallel Safari/Chrome work untouched. `cleanup` printed `Exact fixture cleanup and 24 retained-row fingerprints passed`; the port-3158 server stopped. The controller retained its interactive stdin handle after cleanup, so it was interrupted after that success rather than recorded as an exit-zero complete rehearsal. No retained accounts, hosted deployment or commit were changed by this rerun.

Final read-only inventory found zero DEV0358 tagged Auth users, fixture events or event-banner Storage objects owned by either exact fixture profile. All 326 local links in the updated index/peer/coordination records resolved; `git diff --check` passed. No migration was required for this rerun.

- `node --import tsx --test tests/event-directory.test.ts tests/events.test.ts tests/event-banner-editor.test.ts tests/coach-events.test.ts`: 22 passed, including unchanged public participation/term and owner draft-form contracts. Log `/private/tmp/dev0358-all-ui-tests.log`.
- `node --import tsx --conditions=react-server --test tests/server/event-banners.test.ts tests/server/coach-banner.test.ts tests/server/profile-image-storage.test.ts tests/server/coach-website-routes.test.ts`: 16 passed (`/private/tmp/dev0358-backend-regressions.log`).
- Scoped ESLint and Prettier checks passed (`/private/tmp/dev0358-lint-final.log`, `dev0358-fixture-lint.log`, `dev0358-format.log`). Isolated `npm run typecheck` and `node node_modules/next/dist/bin/next build --webpack` passed (`/private/tmp/dev0358-types-final.log`, `dev0358-build.log`). Build snapshot `/private/tmp/movx-dev0356-lk5sqvfy`; final source equality review remains.
- `EVENT_DIRECTORY_PREVIEW=/private/tmp/movx-dev0358-ktwyzL node --import tsx --conditions=react-server scripts/rehearse-local-event-directory.ts`: real local Auth/Storage companion is open for native checks. It created two new tagged coaches, 23 published sessions and one draft. API proof passed: 20+3 authoritative paging, event/coach/decorative media states, real public event bytes, foreign delete 403, stale delete 409, private draft 404, and ordinary GET next-page HTML with Back to first page. Evidence `/private/tmp/movx-dev0358-ktwyzL/evidence`; log `/private/tmp/dev0358-rehearsal.log`.
- Native Firefox: at 1600 px observed three bordered cards with a right venue map; at 1200 px observed two columns and full map. Verified separate event cover, coach fallback cover, decorative/initials fallback and small actual public portrait. All 20 co-located markers have distinct labels/positions; selecting Class 02 selects its card and its own preview. At 375 px verified a single readable card column, List/Map URLs, selected preview and preservation of all 23 appended sessions on the view change.
- Native pagination failure: temporary preview-only API 503 retained all 20 cards and the same Load more cursor with clear retry copy. Restoring the exact repository route and retrying appended three cards, updated the loaded count/pins to 23 and announced “3 more sessions loaded”; Load more disappeared at the end. No extra cursor history entry was created.
- Native provider failure: preview-only missing map style plus reload produced “Map unavailable” and a complete 20-card phone list on the map URL with Retry map and Load more. Restored provider source byte-for-byte; Retry map rendered the map again. The additional phone append/recovery request was delayed by cold development compilation; do not count its final 23-card state as observed.
- Harness-only failed attempts were corrected before this run: invalid synthetic venue source, wrong portrait fixture dimensions, and cold detail compilation exceeding a 60-second request timeout. Each attempt ran exact cleanup and all 24 retained-row fingerprints passed. Request timeout is now 120 seconds for cold compilation; tests use one representative detail route. No retained account repair, reset or seed occurred.
- Same-source production-mode build with derived loopback public configuration passed; its `/events` request returned 200 in 0.789 seconds for the isolated dataset. Production-mode API upload→reload→replace→remove/revocation proof passed with full group-row hashes unchanged; invalid source 400 and stale revision 409. The current fixture companion defaults to this production setup on future runs.
- Native normal sign-in reached the owner detail and its desktop uploader rendered. File-picker/owner 375 px/keyboard/error-recovery actions and remaining public keyboard/filter-reset proof could not be completed: repeated computer-control `AXError.cannotComplete`, `noWindowsAvailable`, missing page accessibility content and application/clipboard timeouts persisted after reconnects and a tool-kernel reset. No unsupported browser automation or cookie injection was used. This is the remaining acceptance blocker; AC2–AC4 are not complete.
- Fixture cleanup printed `Exact fixture cleanup and 24 retained-row fingerprints passed`; a final read-only inventory confirmed no DEV0358 Auth users/events/media/owned objects or DEV0356 databases remained. The manually replaced development child left the companion alive after cleanup, so it was stopped with SIGINT after that success; this is not recorded as an exit-zero full rehearsal. The separate production server closed port 3158 after graceful shutdown but remained draining an aborted destination stream. Its remaining process and rehearsal-controller parent were identified explicitly, its working directory matched the disposable preview, and only that child was terminated; the user’s port-3100 app remained running. The two-tab Firefox test window was closed, preserving its pre-existing Welcome window and the other rehearsal. A separate Safari test window may remain at the sign-in URL; it was not closed after its UUID could no longer be confirmed.
- Final automated checks, all 27 owned runtime-source byte comparisons, 507 repository documentation links, record uniqueness/status checks and `git diff --check` passed. After exact fixture cleanup, the user’s existing `http://localhost:3100/events` returned HTTP 200 in 3.563 seconds; no existing server restart was needed. No commit or hosted rollout. Next action: run the now production-mode fixture companion with working native control; finish owner upload/reload/replace/remove/error states at desktop/375 px plus public keyboard/filter reset, clean the fixture and then complete/archive DEV0357/DEV0358/COR0030.

### Commit verification environment and commands

On 19 October, exported the exact staged source to `/private/tmp/movx-public-events-review-3xys1i_5` without populated environment files or ignored work data. Retained the already committed DEV0365 page and unrelated public navigation/Profile browser tests in the index; working copies and Google-auth edits stayed separate. The nine owned DEV records accompany their implementation because the final hero/search/Events files share those changes.

All final checks explicitly used `/Users/hoangdeveloper/.local/node/24.21.0/bin/node`:

- `--import tsx --test tests/home-marketplace.test.ts tests/marketplace-search.test.ts tests/coach-directory-cards.test.ts tests/fitness.test.ts tests/event-directory.test.ts tests/events.test.ts tests/event-banner-editor.test.ts tests/coach-events.test.ts`: 51 passed (`/private/tmp/dev0358-commit-ui-tests-node24.log`).
- `--import tsx --conditions=react-server --test tests/server/event-banners.test.ts tests/server/coach-banner.test.ts tests/server/profile-image-storage.test.ts tests/server/coach-website-routes.test.ts`: 16 passed (`/private/tmp/dev0358-commit-server-tests-node24.log`).
- `node_modules/next/dist/bin/next typegen`, `node_modules/typescript/bin/tsc --noEmit`, then `node_modules/next/dist/bin/next build --webpack`: all passed (`dev0358-commit-typecheck-node24.log`, `dev0358-commit-build-node24.log`).
- Scoped `node_modules/eslint/bin/eslint.js` and `node_modules/prettier/bin/prettier.cjs --check` on all staged TypeScript/JavaScript/CSS files: passed (`dev0358-commit-lint-node24.log`, `dev0358-commit-format-node24.log`). Staged whitespace check passed. All 655 relative documentation links resolve in the index; README's two private tester-journal links intentionally point outside version control.

The first temporary-directory shell selected unsupported Node 20, causing one SDK-mock regression to fail. That build was interrupted and all tests/type/build/lint/format were repeated with explicit Node 24; no source workaround was made. Database SQL was unchanged since its recorded fresh/upgrade/local preservation proof, so no reset, migration or database rehearsal was repeated for this commit. No further browser pass is claimed. DEV0357/DEV0358 remain Blocked on the recorded phone/recovery/keyboard/filter cases.

## Risks, limitations, and follow-ups

Blocked only on the explicitly outstanding native acceptance cases above. Public desktop/phone layout, image fallbacks, pagination failure/retry and venue selection have observed evidence; they do not substitute for the missing owner/keyboard cases. No temporary database/Storage/Auth fixture remains. Hosted rollout and independent review are separate.

## Completion and review references

- Completed: Not completed.
- Commit: Included with this record in the user-authorized DEV0350–DEV0358 public-discovery/Events commit; see Git history for this ticket.
- Review: Initial scope/work-map self-review; independent review not performed.
- Deployment or release: None.
