# Ticket DEV0228: Build a Home coach grid with a discipline filter

- Status: Draft
- Created: 2026-10-14
- Last updated: 2026-10-14
- Milestone: M3 — Scheduling interface follow-up
- Coordination: None — independent development ticket
- Related records: preceding search simplification [DEV0226](../../archive/frontend/DEV0226-remove-home-coach-focus-search.md); independent future coach/focus search [DEV0227](DEV0227-reintroduce-home-search-after-client-feedback.md); historical Home [DEV0198](../../archive/frontend/DEV0198-build-search-first-marketplace-home.md) and shared-search [DEV0197](../../archive/frontend/DEV0197-share-public-marketplace-search.md) baselines; downstream public integration review [DEV0201](DEV0201-polish-public-marketplace-accessibility.md) under [COR0017](../organisatory/COR0017-public-marketplace-redesign.md)

## Objective and context

Give Home an easy-to-scan coach listing structure inspired by Airbnb's image-led cards while preserving a prominent search area. On 2026-10-14 the user chose **one grid with a discipline filter**, with **all disciplines included by default**. The user then confirmed keeping the discipline/location search area while removing only the `Search coach or focus` text field.

These are confirmed design decisions, including an initial limit of 15 matching coaches and a conditional Load more button. The precise layout, subsequent batch size and filter application behavior below are proposed implementation defaults. This ticket records the discussion and does not authorize or claim runtime delivery. The [current discovery contract](../../../docs/mvp-spec.md#42-discover-a-coach-and-time), C27 in the [decision register](../../../docs/mvp-spec.md#2-confirmed-target-and-decisions), [definition of done](../../../docs/mvp-spec.md#11-definition-of-done) and [M3 milestone](../../../docs/mvp-spec.md#12-delivery-milestones) still describe the existing three-coach preview and must be reconciled in the implementation change.

## Scope and non-goals

- In scope: one responsive coach grid, an All disciplines default, a typeable discipline picker and horizontally scrollable discipline shortcuts controlling the same filter, a compact prominent discipline/location search area above listings, scan-friendly public coach cards, honest directory states, and corresponding specification/tests.
- Out of scope: separate coach-listing rows or coach-card carousels per discipline, removing the search area, restoring the coach/focus text field, redesigning Explore/maps, ratings, pricing, favorites, photo galleries, ranking, new availability filters, or changes to booking authority.

## Expected behavior and edge cases

- Home shows one coach grid. Its default discipline state is labelled `All disciplines` and imposes no discipline restriction. Each visible coach appears once, including coaches who teach several disciplines.
- Show up to 15 matching coaches initially, regardless of responsive column count. Show `Load more` below that same grid only while undisplayed matching coaches remain; append results without duplicates and hide the button when exhausted. Filtering or reset starts again at the initial limit. Fewer than 15 matches do not create blank cards or filler inventory.
- Selecting a discipline narrows the same grid to matching coaches; returning to All disciplines removes that restriction. An empty category shows a truthful no-results state and a usable reset action.
- Typing a discipline shows supported discipline suggestions. The typeable picker and horizontal shortcut row share one selected discipline and remain synchronized after search, shortcut selection and reset. The shortcut row supports touch scrolling, arrow buttons and keyboard access without overflowing the page.
- A prominent search area remains above the grid and supports discipline and location. The coach/focus field stays absent as delivered by DEV0226.
- Coach cards emphasize public portraits or stable initials, name, disciplines and primary training place. Cards open public profiles and their published schedules; they do not directly create bookings.
- A concise introduction precedes discovery; explanatory and coach-application content follows it. Public navigation, demo/verified labels, missing-image fallback and pending-confirmation wording remain intact.
- Database failure preserves an explicit unavailable state. Do not fill empty results or portrait gaps with fabricated coaches, photos, places or times.
- Explore's existing query/location/discipline URLs, map/list state and public profile destinations remain compatible.

## Assumptions, decisions, and dependencies

- Confirmed: one grid, a discipline filter, All disciplines by default, and a retained discipline/location search area with no coach/focus text field.
- Confirmed preview follow-up on 2026-10-14: the user requested Superprof-style typeable discipline search and a horizontally scrollable discipline row. Both control one shared filter. This supersedes the earlier proposal to avoid a separate discipline row; it does not restore coach/focus text search.
- Confirmed result bound on 2026-10-14: initially show 15 coaches, followed by `Load more` only if more matches exist. This caps coaches rather than rows; five desktop columns yield three initial rows, and narrower layouts use more rows.
- Proposed placement: a compact search bar below the public header and short introduction, the discipline shortcut row below search, and the one coach grid below both.
- Proposed: one selected discipline at a time, using existing supported disciplines and normalization. Invalid or absent discipline values recover to All disciplines.
- Proposed: apply discipline/location values to the Home grid through a JavaScript-free GET form and reload-safe URL state. Review the interaction before implementation: DEV0226 deliberately preserves the current submission to Explore, whereas this later ticket may change Home's filter destination.
- Proposed: retain alphabetical directory order and append the next 15 matching coaches per Load more action. Initial limit and conditional button are confirmed; subsequent batch size and reload-safe pagination state remain implementation defaults for review.
- DEV0226 owns removal of the named text field and should complete first. DEV0228 owns the later grid/search-area composition and any adopted Home filter-routing change. DEV0227 is a future follow-up, not a completion dependency. No new coordination level is needed for these separate tasks.
- No new dependency, provider, database schema or environment setting is proposed. Draft remains appropriate while layout, filter interaction and pagination-state defaults are reviewed during the discussion.
- Later location-search discussion: street/postcode input plus a distance selector is an option, not yet an adopted implementation scope. The user confirmed the matching rule for that option: include a coach when **any active training venue** matches, rather than only the primary base. Proposed presentation: show the nearest matching venue and one coach card. Radius presets, straight-line versus travel distance, Berlin origin validation, geocoding and filtered-map/profile behavior still need a separate proximity-search plan before implementation; they do not enter this ticket's current acceptance criteria.
- Reference review on 2026-10-14: the [Superprof homepage](https://www.superprof.de/) pairs subject and address/city input, subject shortcuts and portrait-led profile cards. Its [official search guide](https://www.superprof.de/hilfe/schuelerinnen-schueler/eine-lehrkraft-finden/nach-einer-lehrkraft-suchen/4/) confirms subject/city search followed by filters, and its [Berlin boxing directory](https://www.superprof.de/unterrichtsangebot/boxen/berlin/) provides a comparable training-profile destination. This is design input, not a replacement MovX contract. Superprof's internal distance calculation and multi-location matching were not established by this review.

## Implementation plan

1. Review and settle the proposed search placement, filter application/URL behavior, card content and pagination mechanics around the confirmed initial limit. Update this ticket before implementation and confirm it remains one bounded Home discovery task.
2. Read the installed Next.js documentation for page search parameters and request-time rendering. Reuse the authoritative directory service, discipline normalization and public portrait boundary.
3. Reconcile the specification's C27, discovery flow, scheduling behavior, definition of done, M3 wording and Home acceptance row with the adopted grid and retained search area; preserve Explore's contract.
4. Adapt [Home route](../../../src/app/page.tsx), [Home composition](../../../src/features/public/coach-story.tsx), [discovery section](../../../src/features/coaches/home-coach-discovery.tsx), [public cards](../../../src/features/coaches/compact-coach-card.tsx), existing search modules and their styles only as required by the adopted plan. Keep Home-specific presentation from changing Explore unintentionally.
5. Update meaningful component/browser checks for default, filtered, reset, multi-discipline, empty, unavailable and missing-image states. Verify responsive and keyboard use, then record results and the downstream integration handoff.

## Acceptance criteria

- [ ] AC1: Home presents one grid with All disciplines selected by default; typed discipline selection, scrollable shortcuts and reset stay synchronized and yield the correct visible coaches without duplicate multi-discipline entries.
- [ ] AC2: The prominent discipline/location search area remains above listings, omits coach/focus search, and follows the adopted filter application and reload-safe URL behavior with keyboard and JavaScript-free use.
- [ ] AC3: Cards show authoritative public identity/location data and usable profile/schedule links; portrait fallback, empty/unavailable states and demo/confirmation disclosure remain truthful; Explore behavior is preserved.
- [ ] AC4: The adopted card/grid composition works at mobile and desktop widths; relevant tests, browser checks, lint, type checks, formatting and build pass; specification and ticket evidence describe the delivered behavior.
- [ ] AC5: Initially show at most 15 matching coaches; Load more appears only when further matches exist, appends results in stable order without duplicates, disappears when exhausted, and resets pagination when filters change. Fewer than 15 matches remain truthful at every width.

## Validation plan

- Extend [Home tests](../../../tests/home-marketplace.test.ts) with the default all-discipline grid, one selected discipline, reset, multi-discipline deduplication and honest data states. Use fixtures with known matching and nonmatching coaches.
- Cover 0, fewer than 15, exactly 15 and more than 15 matches, append/exhaustion, stable order and pagination reset after discipline/location changes; verify both keyboard activation and JavaScript-free pagination recovery in the eventual application.
- Adapt [shared-search coverage](../../../tests/marketplace-search.test.ts) only where contracts change, and [public browser checks](../../../tests/browser/public-story.spec.ts) for Home filter application, reload/back/forward and JavaScript-free submission. Retain Explore query and map/list regressions.
- Inspect 375, 430, 768, 1024 and 1440 px layouts for card readability, portrait crop, initials, overflow and visible keyboard focus. Review ready and unavailable views using existing local fixtures and configuration-free preview as appropriate.
- Run `npm test`, relevant Playwright flows, `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build`, Markdown format/link checks and `git diff --check`.
- Migration and payment rehearsals are not applicable; persistence, identity and booking rules are unchanged by the proposed scope.

## Implementation record

Application implementation has not started. This record captures confirmed preferences and clearly labelled proposals from the design discussion.

2026-10-14 preview follow-up plan: create a separate interactive discussion preview at `work/design-previews/movx-discovery-preview.html`. Use preset Berlin location suggestions and explicitly illustrative venue distances to demonstrate the proposed radius controls and any-active-venue matching without a live geocoder or application/database changes. Preserve the earlier disabled-distance preview as prior evidence. Check default/filter/reset/empty states, secondary-venue inclusion, inactive-venue exclusion, keyboard selection and responsive layout before presenting it. Prototype interaction does not adopt a proximity-search implementation contract or satisfy this ticket's application acceptance criteria.

2026-10-14 pagination preview plan: demonstrate the confirmed 15-coach initial limit and conditional Load more action in the existing fragment. Add explicitly fictional examples so the prototype can exercise more than 15 results; keep application inventory untouched. Append the next 15 in the prototype, reset its limit when filters change, and verify exhausted/small/empty results, deduplication, keyboard activation and mobile/desktop layout. Keep this ticket Draft and application acceptance pending.

Pagination validation adjustment: the standalone host echoes saved widget state back to the fragment. Ignore unchanged state echoes rather than rebuilding the grid, so Load more retains existing card nodes and keyboard focus on the first appended card. External state changes still restore the preview.

### Changes and rationale

Created an independent grid plan rather than expanding DEV0226's small search-field removal. Kept the search area explicitly in scope after the user's clarification; only its coach/focus input is deferred.

### Affected files

| File or component                                                           | Change and purpose                                                                                                                                                                     |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| This record                                                                 | Captures confirmed grid/search decisions and proposed implementation/validation details.                                                                                               |
| [DEV0226](../../archive/frontend/DEV0226-remove-home-coach-focus-search.md) | Links the later grid task and records that retaining search does not cancel the text-field removal.                                                                                    |
| [DEV0227](DEV0227-reintroduce-home-search-after-client-feedback.md)         | Links the planned grid as a later baseline for any future text-search decision.                                                                                                        |
| [Ticket index](../../README.md)                                             | Lists this Draft and advances the next development identifier.                                                                                                                         |
| `work/design-previews/movx-home-search-grid.html`                           | Discussion preview with one grid, discipline/location controls and an optional, disabled distance field; uses illustrative local data and the existing fictional Daniel portrait.      |
| `work/design-previews/movx-home-search-grid-preview.html` and preview PNGs  | Standalone visual-review wrapper and desktop/mobile screenshots; response evidence, not application routes or deployed assets.                                                         |
| `work/design-previews/movx-discovery-preview.html` and its browser wrapper  | Interactive discussion preview for typed/scrollable disciplines, preset-location/radius scenarios, the initial 15-coach limit and conditional Load more. Uses fictional examples only. |

### Decisions and deviations

2026-10-14: The user chose one grid over discipline rows and clarified All disciplines as the default. The subsequent instruction to keep search was clarified explicitly: retain discipline/location search and remove coach/focus search. Runtime scope remains planning only.

2026-10-14 interactive preview follow-up: created `work/design-previews/movx-discovery-preview.html` with preset Berlin location suggestions, illustrative active-venue distances, radius filtering, coach-profile dialogs and default/filter/reset/empty states. Its browser wrapper is `work/design-previews/movx-discovery-preview-browser.html`; screenshots use `movx-discovery-*.png` in the same directory. The source has no geocoding/network request and saves only preset scenario choices, not arbitrary address text. These files are discussion response content; application code, configuration and product requirements were not changed.

2026-10-14 discipline preview follow-up: replaced the prototype's native discipline select with a typeable suggestion picker for the six supported disciplines and All disciplines. Added a horizontal icon-and-label shortcut row beneath search, with touch scrolling, previous/next buttons and native keyboard access. Both controls use one canonical discipline value; Search applies a typed selection, shortcuts apply immediately, and reset restores All disciplines. Those application timing choices are prototype defaults for review. The picker accepts aliases such as `BJJ`, rejects unsupported text with a useful prompt, and saves only the canonical selection. The row remains a bounded selector above one coach grid. No coach/focus query field or application implementation was added.

2026-10-14 pagination preview follow-up: added 14 explicitly fictional MMA examples to the original five-coach scenario, making 19 total. The preview initially renders 15 cards in the same grid, reports `Showing 15 of 19 coaches`, and exposes Load more. Activating it appends the remaining four, hides the exhausted button and moves keyboard focus to the first appended card without scrolling the page. Filters/reset restore the initial 15-coach limit; exactly 15, small and empty result sets omit Load more. Identical saved-state echoes are ignored to preserve appended nodes/focus. Actual application inventory, routes, dependencies, database and product runtime are unchanged.

### Contracts, configuration, and operations

None changed in this planning update. The future implementation must adopt the confirmed initial 15-coach bound and conditional Load more behavior; Home filter/pagination URL mechanics remain proposals requiring plan review. Explore URLs, data authority, dependencies, environments and migrations remain unaffected.

## Validation results

Planning and preview validation completed on 2026-10-14:

- `python3 /tmp/movx-grid-ticket-check.py` passed 243 relative-link checks, 19 section-anchor checks, uniqueness checks for 170 DEV/COR records, required template/metadata fields for DEV0226–DEV0228 and matching index statuses/next identifiers. An earlier run caught a concurrent duplicate DEV0226 allocation; that other work now uses DEV0229, and this change retained its original IDs.
- A later index note explicitly reserves DEV0226–DEV0228 for these existing Home plans. The checker initially misclassified that ownership note as an ID conflict; restricting its exclusion check to retired/pruned IDs and the separate branch's reserved range fixed the false positive. The final uniqueness, record-location and index checks passed without changing any record ID.
- `./node_modules/.bin/prettier --check tickets/current/frontend/DEV0226-remove-home-coach-focus-search.md tickets/current/frontend/DEV0227-reintroduce-home-search-after-client-feedback.md tickets/current/frontend/DEV0228-build-home-coach-grid-with-discipline-filter.md` and `git diff --check` passed.
- `python3 /Users/hoangdeveloper/.codex/plugins/cache/openai-bundled/visualize/1.0.38/skills/visualize/scripts/render.py /Users/hoangdeveloper/fitness-booking-schedule-app/work/design-previews/movx-home-search-grid.html /Users/hoangdeveloper/fitness-booking-schedule-app/work/design-previews/movx-home-search-grid-preview.html --force` generated the standalone preview wrapper. The fragment remains the inline source and has no external data requests.
- `node /tmp/movx-design-preview-check.mjs` passed against the isolated preview: five illustrative coaches with All disciplines initially selected, two Boxing matches, location narrowing, Enter submission, honest empty results, reset to All disciplines, no JavaScript errors, and no horizontal overflow at 393 and 320 px. The sandbox initially blocked Chromium's process startup; the approved isolated-browser rerun passed.
- Visual review inspected 1024 px desktop and 393 px mobile screenshots. Search controls and the one-grid composition remained readable. The distance field is deliberately disabled because the preview has no geocoding or radius filtering; no measured distance is presented as real data.
- The earlier sketch was in browser-test output and was cleared by a parallel test run. The replacement lives in the separate `work/design-previews/` directory so normal browser-test cleanup does not remove it.

Application unit/browser tests, lint, type checks and production build were not run for this planning/response-only change. All application acceptance criteria remain not run. Discussion previews are illustrative response content and do not establish application delivery or authoritative coach/distance data.

Interactive preview follow-up validation on 2026-10-14:

- Rendered the new fragment with `python3 /Users/hoangdeveloper/.codex/plugins/cache/openai-bundled/visualize/1.0.38/skills/visualize/scripts/render.py /Users/hoangdeveloper/fitness-booking-schedule-app/work/design-previews/movx-discovery-preview.html /Users/hoangdeveloper/fitness-booking-schedule-app/work/design-previews/movx-discovery-preview-browser.html --force`.
- `node /tmp/movx-discovery-preview-check.mjs` passed against the isolated browser preview: All disciplines and five example coaches by default; discipline narrowing; mouse/keyboard selection of preset Berlin locations; 2/5 km result changes; inclusion through a secondary active venue; exclusion of an inactive venue; one card per coach; profile dialog opening/closing; empty, invalid-location and reset states; and 393/320 px layouts without horizontal overflow or script errors.
- Initial preview checks caught a missing JavaScript object brace and ambiguous select labels. Corrected the script and associated each select explicitly with its visible label; the final full preview check passed.
- Inspected desktop, mobile and 2 km search screenshots: search controls, portraits/initials, nearest matching venue details and pending-confirmation explanation were readable.
- Started `python3 -m http.server 3102 --bind 127.0.0.1 --directory /Users/hoangdeveloper/fitness-booking-schedule-app/work/design-previews` and opened `http://127.0.0.1:3102/movx-discovery-preview-browser.html` in a new Chrome tab. Native browser state and screenshot confirmed the default one-grid preview was visibly loaded. This is a local preview server, not a deployment, and avoids the file-URL access issue seen in the user's browser.
- The new radius behavior is a scenario simulation using fixed example distances. Live Berlin geocoding, actual venue-distance computation and production search remain unimplemented. This evidence does not close AC1–AC4.

Discipline preview follow-up validation on 2026-10-14:

- Re-rendered `movx-discovery-preview-browser.html` from the updated fragment with the same `render.py` command above. A JavaScript parse check using Node's `new Function` passed.
- Updated and ran `node /tmp/movx-discovery-preview-check.mjs` in an approved isolated Chromium process. Passed typed discipline suggestions by keyboard and mouse, `BJJ` alias selection, exact typed values, unsupported-text validation, shared shortcut/input/result selection, All disciplines reset, horizontal arrow scrolling and keyboard activation at 393/320 px. Existing location, 2/5 km radius, secondary active-venue, inactive-venue, profile-dialog and empty-state checks also passed. No outer-page horizontal overflow or script errors occurred.
- The first scrolling check found that initial scroll snapping landed four pixels past the start, leaving Previous enabled. Added matching scroll padding; the complete rerun passed with Previous disabled at the start.
- Inspected the refreshed 1024 px desktop and 393 px mobile screenshots. Discipline shortcuts and arrows fit above the one grid, search fields remained readable, and portrait/initials fallbacks stayed visible. The strip is intentionally scrollable; the page itself does not overflow horizontally.
- `node /tmp/movx-discovery-preview-check.mjs http://127.0.0.1:3102/movx-discovery-preview-browser.html` passed the same checks against the served page. Chrome briefly showed a blank page during reload; reopening the local preview with `?disciplines=2` loaded the updated controls. Native accessibility state and screenshot confirmed the typeable Discipline input and scrollable shortcut row were visible.
- A focused Python check passed 21 relative links/anchors and Draft/index consistency for this ticket, plus fragment boundaries, size, absence of remote data calls and absence of a coach/focus input. Prettier formatting and `git diff --check` passed.
- Application acceptance criteria remain pending. These are preview checks using fictional coaches and fixed distances, not production search validation.

Pagination preview validation on 2026-10-14:

- Re-rendered the standalone wrapper with the `render.py` command above; the fragment's JavaScript parse check passed.
- `node /tmp/movx-discovery-preview-check.mjs` passed initial 15-of-19 display, keyboard Load more, append/exhaustion without duplicate or rebuilt cards, focus continuity, exactly 15 MMA matches with no button, fewer-than-15 and empty results with no button, and pagination reset after filtering. Existing typed-discipline, shortcut, location, radius, active-venue and dialog checks also passed.
- The first append/focus check failed because the standalone host echoes saved widget state and the preview rebuilt the grid on every echo. Added an equality guard while retaining restoration for externally changed state. The complete rerun passed.
- Checked 1024 px desktop and 393/320 px mobile layout and pagination. No outer-page horizontal overflow or script errors occurred. Inspected the desktop screenshot with three initial five-card rows and the button below the grid.
- A focused Python check passed 21 ticket links/anchors, Draft/index decision consistency, and fragment/no-external-data checks. The initial index format check flagged only padding on the changed DEV0228 row; corrected that row with Prettier. Final ticket/index formatting and `git diff --check` passed.
- Application tests/build are not applicable to this response-only prototype update; production acceptance AC1–AC5 remains pending. The 19 examples and fixed venue distances are illustrative, not newly published coach records.

| Criterion | Evidence                                                                             | Result  |
| --------- | ------------------------------------------------------------------------------------ | ------- |
| AC1–AC5   | Pending adopted implementation details, application changes and required validation. | Not run |

## Risks, limitations, and follow-ups

An image-led grid needs a readable initials fallback because most current fictional coaches lack a public portrait. Existing card/search modules also serve Explore, so Home changes need an explicit boundary. Review filter application and pagination-state proposals before starting; the confirmed initial limit is 15 coaches, not unlimited loading. Future coach/focus search remains [DEV0227](DEV0227-reintroduce-home-search-after-client-feedback.md).

Commit handoff on 2026-10-14: the user authorized committing these interlinked planning records. Include DEV0226, DEV0227, DEV0228 and only their ticket-index entries. Keep all runtime criteria open and retain the existing Ready/Draft statuses. The response previews remain local under the ignored `work/` directory; do not force-add them or include the separate `.gitignore`/connection changes.

Commit-preparation validation: `python3 /tmp/movx-home-plan-commit-check.py` passed 52 relative-link checks, 12 section-anchor checks, metadata/index-status consistency for DEV0226–DEV0228 and uniqueness checks for 171 DEV/COR records. Targeted `prettier --check` for the three tickets and `tickets/README.md` and `git diff --check` passed. Staged whitespace/scope review accompanies the commit; earlier preview validation remains recorded in DEV0228. No application tests/build are needed for committing planning documents without runtime changes.

## Completion and review references

- Completed: Not completed — planning only.
- Commit: Planning records included in `[DEV0226] [DEV0227] [DEV0228] Record Home discovery plans`; application implementation remains pending.
- Review: Planning self-review; no independent review created.
- Deployment or release: No application change or deployment.
