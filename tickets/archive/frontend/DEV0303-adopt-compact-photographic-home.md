# Ticket DEV0303: Adopt the compact photographic Home

2026-10-20 artifact retirement: the owner removed standalone design previews under [DEV0390](../organisatory/DEV0390-remove-unneeded-design-previews.md). The record below preserves the original design/validation history; backticked preview paths identify retired artifacts. Runtime images/code are retained, with banner source/prompt provenance in public/images/retained-banner-provenance.json.

- Status: Completed
- Created: 2026-10-17
- Last updated: 2026-10-20
- Milestone: M3 — Public discovery refinement
- Coordination: None — independent development ticket
- Related records: approved banner/copy previews [DEV0301](../../archive/frontend/DEV0301-preview-coached-boxing-banner.md) and [DEV0302](../../archive/frontend/DEV0302-preview-goal-slogan-over-banner-photo.md); existing Home grid [DEV0228](../../archive/frontend/DEV0228-build-home-coach-grid-with-discipline-filter.md)

## Objective and context

Implement the user's approved rooftop coaching banner and “Find your coach. Achieve your goals.” on the actual Home page. Remove the shared DEMO WORLD/scheduling-preview strip and Home's extra eyebrow/confirmation introduction so users see the first coaches without scrolling. The user additionally asks for the search box to be at least about 30–40% shorter. Update the [Home product contract](../../../docs/mvp-spec.md#42-discover-a-coach-and-time) in the same change; earlier standalone previews remain history.

## Scope and non-goals

In scope: local production banner asset using the approved existing picture; selectable photo-overlay slogan; compact responsive Home spacing, search and discipline shortcuts; remove the shared demo strip and move its existing fictional-profile information control to the public footer; remove the requested Home eyebrow, introductory confirmation note/link and redundant descriptive line; update relevant browser expectations and product requirements.

Out of scope: new image generation, real coach data/portraits, database/Auth/calendar/booking changes, new search behavior, Explore redesign, deployment, publication or commits without a further request. Preserve truthful coach Demo/Verified badges and confirmation explanation in How it works/booking flows and lower Home content.

## Expected behavior and edge cases

Home leads with the approved warm coaching photo and two-line “Find your coach. Achieve your goals.” as HTML text over the photo. Its height/crop adapt to leave room for discovery, with readable text and visible faces. A failed image retains readable fallback colors. Discipline/location filtering, scrollable shortcuts, canonical URLs, initial 15 results and conditional Load more retain their existing behavior.

Reduce the rendered search form height by at least 30% at desktop review width relative to the measured baseline, with an approximately 30–40% desktop target. Mobile may save more space by keeping fields in a single row. Preserve accessible field labels, 44 px controls, native GET submission and 16 px phone input text. The first row's portraits/initials and coach names should be visible in the initial viewport at desktop 1440 × 900 and phone 375 × 812 / 393 × 852 when actual directory entries exist; also inspect 375 × 667. Never invent inventory to fill an empty/unavailable directory.

## Assumptions, decisions, and dependencies

Confirmed: approve the pictured rooftop coaching banner and goal slogan for the page; remove DEMO WORLD/preview banner, the “PRIVATE MARTIAL-ARTS COACHING · BERLIN” eyebrow and introductory pending/instant-booking note/how-link; show initial coach profiles without scrolling; make the search materially shorter. Adopted defaults: remove the shared banner at its source, retaining the fictional-profile modal via a compact footer control and per-coach trust labels; retain actual scheduling semantics elsewhere. Use Home-only layout rules so Explore and private workspaces keep their layout. Use the existing generated asset, not the stock reference or older licensed location derivatives.

Installed Next.js is 16.3.8. Read its bundled CSS/image guides and Image API before implementation; use its responsive image support for the local banner. No provider/network SDK change is required.

## Implementation plan

1. Capture actual Home/search baseline measurements at desktop/mobile widths without changing existing data or server processes.
2. Adopt the approved asset/H1 and remove introductory clutter; update the shared strip/footer and Home container spacing.
3. Compact the search controls, horizontal discipline shortcuts and discovery heading/card spacing while retaining labels, keyboard use and filter behavior. Tune using actual browser measurements.
4. Update the product contract and affected existing browser expectations, adding focused visual bounds assertions for the requested initial-viewport result and over-photo headline.
5. Run relevant browser/functional checks, lint, types, unit tests, formatting and production build; inspect mobile/desktop/error states. Finish/archive only after acceptance evidence is complete.

## Acceptance criteria

- [x] AC1: Actual Home shows the approved local banner and exact goal slogan over the photo, with readable responsive/error states and no requested introductory eyebrow/note/how-link.
- [x] AC2: Shared DEMO WORLD/preview strip is removed; fictional-profile information remains reachable from the public footer, coach trust badges remain truthful and confirmation behavior/explanations remain intact elsewhere.
- [x] AC3: Search is at least 30% shorter than its desktop baseline, with accessible fields/buttons and retained keyboard, filtering, reload/history and no-JavaScript behavior.
- [x] AC4: Actual first coach portraits/initials and names are visible without scrolling at the target desktop/phone viewports when directory data exists; no overflow or fabricated inventory, with empty/unavailable recovery intact.
- [x] AC5: Product contract, relevant browser expectations and implementation/validation records match the final change; relevant checks pass without resets, schema changes or booking/account mutations.

## Validation plan

Measure before/after search/card bounds and inspect desktop/mobile screenshots with installed headless Chrome on the running local app or an isolated owned server. Cover 375/393/430/768/1024/1440 widths, keyboard use, image failure, footer modal, truthful directory states and real existing public-profile navigation. Reuse existing public-story/filter/no-JavaScript/Explore tests as appropriate. Run `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` and scoped Prettier/link/diff checks; isolate build output if required to avoid disrupting another running server. No DB migration/reset or mutation rehearsal is applicable.

## Implementation record

### Changes and rationale

Actual Home now leads with the approved rooftop coach/athlete picture and selectable two-line goal slogan. The requested eyebrow, redundant introductory line and pending-confirmation note/link are removed. Home uses a shallow, full-width hero; discovery content remains centered. The shared DEMO WORLD strip is removed at its source, and its existing fictional-profile information dialog remains accessible through a public-footer button. Per-coach Demo/Verified labels and the lower Home/How it works confirmation explanation remain intact.

The Home search is a single 64 px row with visible field labels, 44 px controls and an explicitly named submit button. Phones use an icon-only visual button with the same accessible name. Compact horizontal discipline shortcuts, a short phone Map label and Home-only portrait/spacing rules bring the actual first coach names into the initial viewport. Filtering, URL construction, pagination, profile destinations and data services are unchanged.

### Affected files

- [Home story](../../../src/features/public/coach-story.tsx) renders the approved image through Next.js `getImageProps` and the HTML headline.
- [Home CSS](../../../src/app/coach-story.css) scopes the full-width hero, compact form/shortcuts, phone crop and initial-row density to Home. [Global CSS](../../../src/app/globals.css) styles the footer disclosure control.
- [Shared shell](../../../src/components/shell.tsx) removes the strip, adds the Home container class and relocates its existing information dialog trigger to the public footer.
- [Home search](../../../src/features/coaches/home-marketplace-search.tsx) retains native submission and labels while allowing the phone search icon. [Home discovery](../../../src/features/coaches/home-coach-discovery.tsx) retains the map destination and accessible name with a shorter phone label.
- [Production asset/provenance](../../../public/images/README.md) identifies the unchanged approved PNG and its fictional illustrative purpose. Preview handoff (retired artifact: `previews/home-banner/README.md`) distinguishes retained design history from adopted Home behavior.
- [Public-story browser checks](../../../tests/browser/public-story.spec.ts) cover new copy/chrome, hero bounds, compact search, initial coach names and existing public/filter/keyboard behavior. [Explore checks](../../../tests/browser/explore-redesign.spec.ts) and [Auth checks](../../../tests/browser/auth.spec.ts) only update their expected Home headline.
- [MVP specification](../../../docs/mvp-spec.md#42-discover-a-coach-and-time) records the adopted Home contract and C44; the ticket index tracks this independent implementation. No data services/schema changes.

### Decisions and deviations

2026-10-17: The user's implementation request supersedes earlier preview-only limitations for this selected Home banner/copy. Earlier artifacts and archived records remain unchanged. Compactness applies to actual Home; persistent search semantics and other route layouts remain boundaries.

Baseline investigation on the running local app found five actual directory entries. At 1440 × 900 the search is 94.59 px tall and the first coach name ends at y=958.88, outside the viewport. At 375/393 px it is 236.19 px tall and the first name ends at y=1169.33. Target a roughly 64 px single-row form, keeping 44 px controls; this is about 32% shorter on desktop and a larger reduction on phones. Retain both visible labels; hide only the mobile button's visual text while preserving its accessible name. Compact icon/text discipline shortcuts and the Home map link to remove vertical gaps without removing filters or map access.

Density tuning: use a 160 px phone banner and 130 px phone portraits, while desktop keeps a shallow responsive banner and existing card sizing. The approved source image remains unchanged and uses Next.js Image optimization. Update the preview README only to hand off its now-selected image/copy to this implementation; archived preview records remain untouched. Existing public-story tests also contained pre-M7 assumptions that Events was absent; correct those navigation expectations to the already-delivered Events link while updating the shared-shell assertions.

Image rendering adjustment before completion: the initial `next/image` default component works in the application, but the repository's native ESM static-render unit test receives its CommonJS module wrapper and fails with an invalid React element (226/227 unit checks passed). Use Next.js's documented `getImageProps` API with a native image element instead; it retains optimized responsive sources, eager/high-priority loading and stable fill sizing without a test-only component mock or a production import-unwrapping hack. Recheck units and the actual production image after this change.

Browser environment adjustment: direct use of the busy development server caused navigation/assertion and 30-second whole-test timeouts in the existing production-oriented browser suites. Run their final proof on an owned production server using the repository's guarded local-environment helpers. Read existing local Supabase status privately, inject only the bounded local app settings for build/start, and perform no service start, migration, account provisioning or data reset. Keep the user's development process running; do not persist or print credentials.

Further investigation reproduced the same timeout class in production: initial directory reads take approximately 7–9 seconds and an actual profile navigation completes in 18.67 seconds with no page JavaScript errors. A read-only `pg_stat_activity` inspection found an active directory query calling the existing availability synchronization function, with no blocking locks. Do not change database/calendar code or speculative prefetch based on this visual ticket. Repeat the identical browser assertions using an ignored local config with 45-second assertion / 180-second whole-test budgets; keep the repository's default timeouts unchanged and record the local latency as a limitation, not a performance pass.

Validation wording clarification: normal public directory/schedule requests already invoke the existing availability synchronization function. The no-data-change boundary means no resets, schema changes, account provisioning or booking/message mutations; it cannot promise that ordinary browsing skips the application's existing synchronization. No synchronization implementation or policy changed here.

### Contracts, configuration, and operations

Public Home visual/copy contract changes; no data/API/dependency/environment/migration change. Existing generated rooftop asset is illustrative, not a documented real venue or directory coach. No deployment/commit authorized by this request.

## Validation results

Measured the existing local directory (five database coaches, including Daniel's existing portrait and the other coaches' initials) before and after implementation. The final production image decoded successfully; desktop/phone screenshots were inspected. No image edits, fake directory entries or new avatars were introduced.

| Viewport   | Search before → after           | First coach name bottom before → after | Result                                           |
| ---------- | ------------------------------- | -------------------------------------- | ------------------------------------------------ |
| 1440 × 900 | 94.59 → 64 px (32.34% shorter)  | 958.88 → 792.98 px                     | First row portraits/initials and names visible.  |
| 375 × 812  | 236.19 → 64 px (72.90% shorter) | 1169.33 → 662.17 px                    | First two identities visible.                    |
| 393 × 852  | 236.19 → 64 px (72.90% shorter) | 1169.33 → 662.17 px                    | First two identities visible.                    |
| 375 × 667  | Baseline not captured → 64 px   | Baseline not captured → 662.17 px      | First two identities fit the smaller phone view. |

- `node work/dev0303/measure-home.mjs baseline` / `after` / `final`: captured browser measurements/screenshots against the existing development app; final source image decoding explicitly awaited.
- `node work/dev0303/check-home-ui.mjs` on owned production `127.0.0.1:3133`: passed at 1440 × 900, 375 × 812, 393 × 852, 375 × 667, 430 × 900, 768 × 900 and 1024 × 900. All forms measure 64 px; input/submit targets measure 44 px; first two names fit; no horizontal overflow or page JavaScript errors. Keyboard Enter opens the footer disclosure dialog, Escape closes it and returns focus. Aborting banner requests at desktop/phone retains the visible white headline on the forest fallback (`rgb(25,49,38)`); no layout shift obscures discovery. Screenshots/JSON are local supporting evidence under ignored `work/dev0303/evidence/`.
- `node --import tsx --test tests/home-marketplace.test.ts`: 9/9 passed, including honest empty/unavailable state and pagination behavior. Full `npm test`: 227 unit + 25 server tests passed after the documented image import adjustment. No database mutation tests were needed for this presentation-only change.
- `npm run lint`: passed with zero warnings after making image `alt` explicit following the optimized props spread. `npm run typecheck`: passed. `npm run build`: passed, including the guarded local-environment production build used for browser checks.
- Scoped `prettier --check` on changed application/browser files, asset/preview READMEs and this ticket: passed. Approved asset byte comparison passed (SHA-256 `7072b19d6bfe749bd67d45d5fdaa84826a92031315d9a00ec216a47dd0d9a45f`). Scoped repository-link validation: 41 links passed; an initial naive checker treated an angle-bracketed external URL as local, then passed after correcting the checker. `git diff --check`: passed.
- Initial browser runs with default 5-second assertions/30-second whole-test budgets failed on slow local navigation; the development run had 6 passed / 3 skipped / 11 timed out or failed, and the isolated production run had 7 passed / 3 skipped / 10 timed out or failed. The local latency investigation and final-budget adjustment are recorded above.
- Final `node_modules/.bin/playwright test --config work/dev0303/playwright-production-slow-local.config.mjs tests/browser/public-story.spec.ts tests/browser/explore-redesign.spec.ts`: **17 passed, 3 skipped**, exit 0 (5.1 minutes). The ignored config retains all repository assertions/projects, targets the owned production server and changes only local timeout budgets/output paths. Skipped mobile duplicates are intentional in the existing tests: responsive widths and no-JavaScript flows are already exercised by desktop-project checks. Passed flows include native/JavaScript search, canonical discipline aliases, unsupported-value validation, history/reload, empty results/clear recovery, real profile navigation, public chrome/footer dialog and private route identity guards.
- `node_modules/.bin/playwright test --config work/dev0303/playwright-auth-return.config.mjs tests/browser/auth.spec.ts --grep 'sign-in explains the email/account boundary'`: **2 passed**, desktop/mobile, exit 0. The affected guest return to Home displays the new slogan without identity API requests; no email/account mutation was attempted.
- Final source review confirmed that application changes are limited to this ticket's presentation, approved asset and affected expectations. Concurrent authentication planning/specification changes were preserved and are outside this ticket's implementation. No commit, deployment or independent review was performed.
- Completion housekeeping: archived this record and repaired the specification/index/asset/preview links; 43 scoped repository links and final Prettier/diff checks passed. Stopped the owned production test server on 3133 and confirmed it no longer responds; the existing user development app on 3100 still returns HTTP 200 for its icon. Temporary screenshots/configs/logs remain ignored local evidence.

| Criterion | Evidence                                                                                                | Result |
| --------- | ------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Decoded production image, inspected responsive crop/headline and forced image failure.                  | Passed |
| AC2       | Public-route chrome, keyboard footer disclosure and retained trust/confirmation content.                | Passed |
| AC3       | 32.34% desktop reduction; 44 px controls; desktop/mobile filtering, history and native GET.             | Passed |
| AC4       | Measured real directory identities at seven viewports; existing empty/unavailable tests.                | Passed |
| AC5       | Updated contract/records, 252 unit/server tests, 19 browser passes, lint/types/build and scoped checks. | Passed |

## Risks, limitations, and follow-ups

Initial-viewport visibility depends on viewport dimensions and actual directory data; empty/unavailable states remain honest. Phone inputs retain native horizontal editing for long place/discipline values. The image is a fictional coaching illustration, not a real public venue or coach endorsement. Local directory/schedule reads remain slow enough to exceed the default browser budgets; functional checks passed with the documented longer waits, but this ticket makes no performance improvement claim and does not alter database/calendar implementation. Design adoption is local implementation, not deployment.

## Completion and review references

- Completed: 2026-10-17.
- Commit: User authorized committing on 2026-10-17; included in `[DEV0298][DEV0300][DEV0301][DEV0302][DEV0303][DEV0304][DEV0305][DEV0306][DEV0307][DEV0308][DEV0309][DEV0310] Refine Home banners and compact coach discovery`.
- Review: Self-review, desktop/mobile visual inspection, keyboard/error checks and the recorded automated validation passed; no independent review.
- Deployment or release: None.
