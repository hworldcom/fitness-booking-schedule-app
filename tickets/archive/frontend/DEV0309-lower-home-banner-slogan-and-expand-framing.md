# Ticket DEV0309: Lower the Home banner slogan and expand its framing

- Status: Completed
- Created: 2026-10-17
- Last updated: 2026-10-17
- Milestone: M3 — Public discovery refinement
- Coordination: None — independent development ticket
- Related records: selected artwork [DEV0307](../../archive/frontend/DEV0307-preview-curved-banner-with-ropes-and-kick.md); Home adoption [DEV0308](../../archive/frontend/DEV0308-adopt-curved-training-collage-home-banner.md)

## Objective and context

After viewing the adopted curved collage on Home, the user reports that the slogan blends into the kicking photo. They ask to move it down into the light area and suggest a slightly taller banner to give the lower-right scene and copy more room. Refine the actual [Home presentation](../../../docs/mvp-spec.md#42-discover-a-coach-and-time) while preserving the selected artwork, exact slogan and first visible coach profiles.

## Scope and non-goals

In scope: Home-only CSS for banner height, headline position and responsive framing; update the current design contract and validation record. Inspect actual desktop/phone output and error/keyboard states.

Out of scope: generating/editing image pixels, changing copy, search/data/booking/auth/calendar behavior, redesigning other routes, commits or deployment. Keep completed records and preview comparisons as history.

## Expected behavior and edge cases

The desktop/tablet banner gains modest height and the headline sits lower inside the ropes photograph's bright opening, clear of the kicker and adjacent photo edges. More of the lower-right coaching scene becomes visible. Phone placement must also stay readable without pushing the first coach names out of the adopted initial view. Failed images retain readable text on the existing pale fallback. Search labels, 44 px controls, native keyboard behavior and truthful inventory states remain.

## Assumptions, decisions, and dependencies

Confirmed: lower the slogan into the light area; a modest height increase is welcome to improve framing. Proposed implementation defaults: roughly 40–60 px more desktop height, a small left/down copy adjustment as needed to clear curved boundaries, and phone-specific placement/height chosen from actual screenshots. These dimensions are routine layout choices, not a user-specified size. Keep the approved B3 bytes unchanged. Existing Next.js 16.3.8 Image/CSS integration and bundled documentation were inspected under DEV0308; no framework integration change is needed.

## Implementation plan

1. Adjust Home hero height and headline position with breakpoint-specific CSS, keeping the approved asset and search layout.
2. Inspect actual desktop/tablet/phone screenshots; measure first coach names and text bounds, and tune within the requested modest change.
3. Update C44/Home design handoff for the refined spacing; preserve prior preview and completed-ticket history.
4. Run the focused existing UI/browser checks for responsive layout, keyboard and image failure, scoped formatting/lint and diff/link/artwork integrity. Finish/archive only after acceptance passes.

## Acceptance criteria

- [x] AC1: Actual desktop/tablet Home has a modestly taller banner with the exact slogan lower in the bright area, clear of the kicking photo; lower-right framing improves without changing the image bytes.
- [x] AC2: Phone copy remains readable, first two actual coach names fit at 1440 × 900, 375 × 812 and 393 × 852, and responsive overflow/controls/keyboard/image-failure checks pass. Inspect 375 × 667 as an additional compact-screen check.
- [x] AC3: Current contract and handoff match the result; relevant checks and implementation evidence are complete, with unrelated work/history preserved.

## Validation plan

Reuse the existing actual-Home measurement and failure check against `localhost:3100`, with screenshots at 375, 393, 430, 768, 1024 and 1440 px plus 375 × 667. Inspect visual clearance as well as numeric bounds. Reuse existing Home responsive/keyboard browser coverage with the established local latency budgets. Check scoped CSS formatting/lint, adopted image SHA-256, affected links and `git diff --check`. No new implementation-mirroring tests. Type/unit/database checks are not applicable to CSS-only positioning; a production build is optional if the CSS pipeline or browser evidence indicates a need.

## Implementation record

### Changes and rationale

The desktop banner increases from 280 to 340 px at 1440 px width, revealing more of the lower-right coaching scene. Its headline begins 162.81 px into the image instead of 104.81 px, about 58 px lower. A small leftward adjustment places the words inside the bright opening, away from the curved kicking window.

Tablet copy has slightly smaller type and a separate horizontal adjustment to clear both the kicker and ropes. Phones retain the 160 px banner and lower the text from 32 px to at least 38 px, scaling its top padding on wider phones to clear the roof edge. The exact slogan, artwork bytes and search/grid behavior remain unchanged.

### Affected files

- [Home CSS](../../../src/app/coach-story.css): taller desktop/tablet banner, lower copy and breakpoint tuning.
- [Current Home contract](../../../docs/mvp-spec.md#42-discover-a-coach-and-time): C44/section 4.2 and delivery reference describe the refined framing without changing discovery behavior.
- [Image handoff](../../../public/images/README.md): links this later CSS refinement; earlier preview/adoption records remain history.
- This ticket/root index record the change. No auth/calendar/database implementation or image files changed.

### Decisions and deviations

2026-10-17: Chose 60 px additional desktop height after inspecting actual Home; first coach names still fit in 900 px. Keep phone height because 375 × 667 already has limited space. These are adopted layout defaults, not user-specified pixel sizes. Visual inspection exposed tablet copy approaching a rope/kicker and wider-phone copy approaching the roof, despite passing text-bounds checks. Adjusted tablet type/position and scaled phone padding, then verified the final ten-size render. No material scope deviation or image editing.

### Contracts, configuration, and operations

Home presentation only; no image/data/API/dependency/environment/migration changes. B3 SHA-256 remains `243bca5cc00d3e0e40da7c11e38fc45b7dfa01e6969315bfe3ffbdb8e07bb275`. Existing Next.js rendering/optimization remains. The user's server stayed running; no service setup/reset/migration/account/booking mutation was performed. Public reads retain existing availability synchronization.

## Validation results

2026-10-17, actual app `localhost:3100`, installed Chrome/Playwright, Next.js 16.3.8.

- Final `node work/dev0309/check-home-ui.mjs`: **passed** at ten sizes: 1440 × 900, 375 × 812, 393 × 852, 375 × 667, 430 × 900, 560 × 900, 640 × 900, 760 × 900, 768 × 900 and 1024 × 900. Text stays within the hero; no horizontal overflow. Search remains 64 px, fields/button at least 44 px, and first two actual coach names fit in every viewport.
- Desktop coach names end at y=852.98 (under 900); 375/393 px phone names end at y=662.17, also fitting 375 × 667. Banner height is 340 px desktop, 210/245.75 px at 768/1024, and 160 px on phones. Inspected desktop/tablet/phone and 640/760 px breakpoint screenshots for actual photo/text clearance. Results/screenshots are under ignored `work/dev0309/evidence/`.
- Forced desktop/phone image failure retains green text on pale fallback. Footer dialog keyboard open/Escape/focus restoration passed; zero page JavaScript errors.
- `npx playwright test tests/browser/public-story.spec.ts --config work/dev0309/playwright.config.mjs --grep 'home marketplace remains usable'`: **passed**, 1 test and 1 expected mobile-project duplicate skip (1.4 minutes). The desktop test iterates six mobile/tablet/desktop widths and checks discipline → location → search-button keyboard focus, image loading, initial names and overflow. Final breakpoint font/padding tuning was additionally verified in the final ten-size run. Existing extended local navigation budgets accommodate known public-read latency; no performance claim.
- Scoped `npx prettier --check`, installed Lightning CSS `transform` parsing/minification via `node --input-type=module` (17,163 output bytes), artwork hash, local links and `git diff --check`: passed. Archive links are checked again during completion housekeeping.
- Full JS lint/type/unit/build/database suites: **not rerun — not applicable** to CSS-only positioning. Actual Next.js compilation, CSS parsing/style and targeted browser proof cover this change; no logic/configuration/dependency changed. DEV0308's broader checks remain historical evidence, not rerun claims.

| Criterion | Evidence                                                                                       | Result |
| --------- | ---------------------------------------------------------------------------------------------- | ------ |
| AC1       | Actual desktop/tablet visual comparison, lower copy measurements and unchanged artwork hash.   | Passed |
| AC2       | Final ten-size UI/failure check, initial-name/control measurements and keyboard browser proof. | Passed |
| AC3       | Updated contract/handoff, CSS parsing/style and link/diff/source-boundary review.              | Passed |

## Risks, limitations, and follow-ups

The shallow banner still crops different scenes at different widths; small-screen coach visibility limits vertical expansion. The unchanged collage remains illustrative. No deployment is performed by this change.

## Completion and review references

- Completed: 2026-10-17 — lower slogan and taller desktop/tablet framing; first-coach visibility and responsive/keyboard/failure checks passed.
- Commit: User authorized committing on 2026-10-17; included in `[DEV0298][DEV0300][DEV0301][DEV0302][DEV0303][DEV0304][DEV0305][DEV0306][DEV0307][DEV0308][DEV0309][DEV0310] Refine Home banners and compact coach discovery`.
- Review: Actual responsive/breakpoint visual, keyboard/failure and static self-review passed; no independent review. The user authorized a checkpoint, then requested image-quality work before committing. The completed preview and Home tickets share final artwork guides, specification/index entries and application files, so a combined checkpoint was prepared with every implemented DEV ID. After the DEV0310 quality correction passed validation, the user renewed commit authorization. The combined checkpoint includes DEV0310 and excludes concurrent authentication and coach-website planning changes.
- Deployment or release: None.
