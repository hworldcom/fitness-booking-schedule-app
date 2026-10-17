# Ticket DEV0308: Adopt the curved training collage Home banner

- Status: Completed
- Created: 2026-10-17
- Last updated: 2026-10-17
- Milestone: M3 — Public discovery refinement
- Coordination: None — independent development ticket
- Related records: selected B3 preview [DEV0307](../../archive/frontend/DEV0307-preview-curved-banner-with-ropes-and-kick.md); compact Home baseline [DEV0303](../../archive/frontend/DEV0303-adopt-compact-photographic-home.md)

## Objective and context

The user approved the curved B3 collage for the actual website after reviewing it. Replace Home's earlier rooftop image with that exact artwork: battle ropes in the center, dark-green “Find your coach. Achieve your goals.” over the bright opening, and the kick replacing the high-knees group. Preserve the compact Home and first visible coach profiles. Update the current [Home contract](../../../docs/mvp-spec.md#42-discover-a-coach-and-time); completed preview records remain history.

## Scope and non-goals

In scope: copy the selected PNG into public assets, update Home image/accessible description and scoped responsive copy/crop/fallback colors, document adoption/provenance and validate the actual page.

Out of scope: generating or editing artwork, changing search/data/booking/auth/calendar behavior, redesigning other routes, removing historical assets, committing or publishing.

## Expected behavior and edge cases

Actual Home displays the selected curved photo windows with ropes in the middle and the exact selectable HTML slogan over the bright photographic area. Use the existing Next.js optimized responsive image path, eager loading and stable banner sizing. Desktop remains at most 280 px high; small screens use a 160 px banner and stacked copy placed over the light opening. A failed image retains readable dark text on a pale fallback. Search remains compact and accessible; first actual coach names remain visible at the adopted desktop/phone review sizes when directory entries exist. Truthful empty/unavailable states remain unchanged.

## Assumptions, decisions, and dependencies

Confirmed: use the immediately preceding B3 preview on the website. No new slogan or artwork is needed. Adopt the preview's crops/positioning with Home-only CSS and a versioned production filename so cached old image URLs cannot obscure the change. Keep earlier rooftop and preview artifacts as history. Installed Next.js is 16.3.8; inspect bundled Image/getImageProps and CSS documentation before changes. No auth or database development overlap is needed.

## Implementation plan

1. Copy the approved B3 bytes to a new public asset and record provenance.
2. Update Home's image/alt and CSS to match the bright curved preview while keeping its compact search/discovery layout.
3. Update C44, the Home specification and asset/preview handoff guides to record this explicit adoption.
4. Verify actual Home at mobile/tablet/desktop widths, initial coach visibility, image failure, keyboard search and native filter behavior. Run relevant existing browser checks, lint/type/build and applicable unit checks; inspect screenshots and finish the ticket/index after acceptance.

## Acceptance criteria

- [x] AC1: Actual Home uses the exact approved B3 asset with correct accessible description, editable exact slogan over its bright center and readable desktop/mobile/error states.
- [x] AC2: Compact hero/search and first actual coach profiles remain in the initial view at 1440 × 900, 375 × 812 and 393 × 852; responsive overflow, keyboard and search/filter recovery checks pass.
- [x] AC3: Current product contract and provenance/adoption guides match; relevant validation passes and unrelated work/history is preserved.

## Validation plan

Inspect actual page screenshots at 375, 393, 430, 768, 1024 and 1440 px, plus 375 × 667 and image-failure states. Reuse existing public-story responsive/filter/no-JavaScript checks and local focused UI measurement script. Run relevant unit checks, lint, typecheck, isolated production build, scoped formatting, source-copy hash/link/diff checks. Preserve the user's running app and database: no restarts/resets/migrations/provisioning; ordinary public reads may invoke existing availability synchronization. Use an owned server/build output if needed and record actual limitations.

## Implementation record

### Changes and rationale

Actual Home now uses the exact approved 2170 × 725 B3 artwork in a new production asset. The old rooftop URL/description and dark gradient are replaced by the curved training collage, accurate image description, pale fallback and dark-green HTML slogan positioned over the ropes photograph's bright opening. The banner remains at most 280 px on desktop and 160 px below 761 px; stacked 16 px phone copy preserves the bright area and keeps faces clear. The 64 px search form and discovery behavior are unchanged.

### Affected files

- [Home story](../../../src/features/public/coach-story.tsx): new local image URL and accessible description, retaining the documented Next.js `getImageProps` responsive/eager-loading integration and exact HTML slogan.
- [Home CSS](../../../src/app/coach-story.css): scoped bright-area copy placement, top/center crop, dark-green text, pale fallback and compact phone layout; removes old rooftop-only grid, overlay and phone crop.
- [Production artwork](../../../public/images/home-training-collage.png) and [asset guide](../../../public/images/README.md): byte-identical selected image and complete preview/prompt/provenance links; earlier rooftop image retained as history.
- [Specification C44 and section 4.2](../../../docs/mvp-spec.md#42-discover-a-coach-and-time): current selected curved visual, preserving the established search/grid and truthful inventory requirements.
- [Preview guide](../../../previews/home-banner-collages/README.md) and [refinement handoff](../../../previews/home-banner-collages/REFINEMENTS.md): record subsequent B3 adoption without rewriting archived preview records or removing alternatives.
- This ticket and the root index track the adoption. No unrelated authentication planning or app/DB scheduling files are changed by this ticket.

### Decisions and deviations

2026-10-17: User approval supersedes the selected B3 preview's earlier exploration-only scope for actual Home. Reuse the saved artifact rather than generating or altering it. Keep a new asset filename to avoid stale optimized-image caches and preserve old artwork. Use scoped Home styles rather than importing the preview stylesheet.

Keep the existing browser suites and focused local measurement check; no new tests that merely assert image filenames or CSS declarations. Next.js 16's bundled upgrade guide confirms separate `.next/dev` output, so the owned production build/server can run alongside the user's development server. No server restart, dependency/configuration change or database setup was necessary.

### Contracts, configuration, and operations

Public Home presentation changes only. No data/API/dependency/environment/migration changes. The copied asset SHA-256 is `243bca5cc00d3e0e40da7c11e38fc45b7dfa01e6969315bfe3ffbdb8e07bb275`, matching the approved source/provenance manifest exactly. Next.js continues serving optimized responsive sources. The owned production rehearsal uses existing loopback Supabase settings through repository helpers; no credentials are printed/persisted and no services/migrations/provisioning are performed. Ordinary public reads retain the application's existing availability synchronization.

## Validation results

2026-10-17, Next.js 16.3.8, installed Chrome/Playwright, running app at `localhost:3100` and an owned production server at `127.0.0.1:3134`.

- `node work/dev0308/check-home-ui.mjs`: **passed**, seven actual Home sizes (1440 × 900, 375 × 812, 393 × 852, 375 × 667, 430 × 900, 768 × 900, 1024 × 900). No horizontal overflow; search stays 64 px and fields/button remain 44 px. First two real coach names end at y=792.98 on 1440 px desktop and y=662.17 on 375/393 px phones, within the requested initial view, including 375 × 667.
- Inspected actual Home screenshots at desktop, phone and tablet widths: the selected curved scenes and bright-area slogan are visible; names/portraits and truthful Demo labels remain. Forced image failures at desktop/phone retain green `rgb(25,49,38)` text on pale `rgb(243,241,232)`. Footer information dialog keyboard open/Escape/focus restoration passed; zero page JavaScript errors. Local measurement/results/screenshots are under ignored `work/dev0308/evidence/`.
- `npm run lint`: **passed**. `npm run typecheck`: **passed**. `npm test`: **passed**, 227 general/unit checks and 25 server-boundary checks, zero failures/skips.
- `node --import tsx work/dev0308/start-production.mjs` runs guarded `npm run build` with existing loopback settings: **passed**, then owned production server ready on 3134. User's development server remains running. No app/config changes were needed for the rehearsal.
- `npx playwright test tests/browser/public-story.spec.ts --config work/dev0308/playwright.config.mjs --grep 'home presents|home marketplace|Home filters|Home typed'`: **passed**, 6 browser tests, 2 expected skips, 0 failures (2.3 minutes) on the owned production server. Desktop/mobile public navigation and profile return, six review-width bounds/keyboard checks, filter submission/shortcuts/reload/back/forward/clear/canonical recovery and JavaScript-free Home/Explore submission pass. The multi-width and no-JavaScript tests intentionally run in the desktop project; their mobile-project duplicates are skipped, while actual mobile widths are exercised. Reused the existing extended local navigation/assertion budgets because database-backed public reads retain the previously observed latency; this is not a performance improvement claim.
- Scoped Prettier, byte-copy SHA-256, 66 affected local-link checks and `git diff --check`: passed. Final archive references are checked again during completion housekeeping. No schema/reset/account/booking/message mutations or deployment rehearsal apply to this presentation-only change.

| Criterion | Evidence                                                                                                                           | Result |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Exact approved asset hash, actual screenshot/copy inspection and readable desktop/phone image-failure states.                      | Passed |
| AC2       | Seven actual Home viewports with measured initial names/controls and existing keyboard/filter/history/no-JavaScript browser proof. | Passed |
| AC3       | Updated contract/provenance, lint/type/252 unit-server checks/build/browser/static review; unrelated work preserved.               | Passed |

## Risks, limitations, and follow-ups

The approved AI-assisted collage combines separate source scenes; it is not a published coach/venue or one documented event. Phone crops retain fewer scenes. This change does not deploy the website.

## Completion and review references

- Completed: 2026-10-17 — approved curved B3 artwork and bright-area slogan adopted on actual Home; compact discovery and responsive/keyboard/failure/search checks passed.
- Commit: User authorized committing on 2026-10-17; included in `[DEV0298][DEV0300][DEV0301][DEV0302][DEV0303][DEV0304][DEV0305][DEV0306][DEV0307][DEV0308][DEV0309][DEV0310] Refine Home banners and compact coach discovery`.
- Review: Visual, responsive, keyboard, filter/failure and code/static self-review passed; no independent review.
- Deployment or release: None.
