# Ticket DEV0307: Preview the curved banner with ropes and a kick

- Status: Completed
- Created: 2026-10-17
- Last updated: 2026-10-17
- Milestone: M3 — Public discovery design exploration
- Coordination: None — independent development ticket
- Related records: original collage [DEV0304](../../archive/frontend/DEV0304-preview-photo-collage-banners.md); preferred light refinements [DEV0306](../../archive/frontend/DEV0306-refine-light-collage-banner-gap.md); actual Home [DEV0303](../../archive/frontend/DEV0303-adopt-compact-photographic-home.md)

## Objective and context

The user wants another version of the light banner with curved photo windows: put the supplied battle-ropes photograph in the middle, place “Find your coach. Achieve your goals.” over its bright area, and replace the high-knees group window with the supplied outdoor kicking photograph. Create a reviewable local preview. The adopted [Home contract](../../../docs/mvp-spec.md#42-discover-a-coach-and-time) is unchanged by this exploration.

## Scope and non-goals

In scope: one versioned built-in imagegen composite (B3), a local comparison against B2, editable HTML slogan, responsive crops, source/output provenance, full prompt and validation evidence. Preserve earlier artwork and comparison pages.

Out of scope: live Home adoption, app/auth/database/calendar changes, editing original photographs, publication and commits.

## Expected behavior and edge cases

Keep the light organic photo-window design. The ropes photograph fills the central gap; its real bright area hosts the dark-green slogan while the athlete and ropes remain recognizable. The kicking photo replaces the high-knees group, retaining the kick, padded post and human detail. Preserve the agility athlete, coaching pair and helping-hand windows. No new people, fake location claim or baked text. Desktop and phone show readable copy; image failure retains a readable fallback. Native keyboard controls, copy toggle and direct downloads remain local and work as applicable without JavaScript.

## Assumptions, decisions, and dependencies

Confirmed: curved windows, central ropes image with slogan on its bright area, kicking image replacing the high-knees group. Implementation choice: add a dedicated B3/B2 comparison so earlier two-option pages remain intact. Source paths are the two user-supplied Downloads JPEGs; the original B PNG is the edit target. Built-in imagegen only. This is one small preview slice and does not need a coordination record or production-contract change.

## Implementation plan

1. Inspect original B and both supplied sources; save the exact edit prompt before generating B3.
2. Save a new PNG and source/output hashes without overwriting prior artwork.
3. Add a B3/B2 comparison, shared concept configuration and narrowly scoped layout styles; link it prominently from the preferred light page and guide.
4. Inspect desktop/phone renders; verify keyboard/device/copy/download/fallback/no-JavaScript behavior and existing light-page regression. Check syntax, formatting, links, hashes and diff, then finish this record.

## Acceptance criteria

- [x] AC1: Inspected B3 preserves curved windows, fills the middle with recognizable ropes photography and replaces the high-knees group with the kick; sources, prompt and original preservation are recorded.
- [x] AC2: The exact editable slogan sits over the ropes image's bright area and remains readable at desktop/phone widths; preview controls, downloads and failure recovery work without external app/service requests.
- [x] AC3: Earlier alternatives remain accessible; actual Home and unrelated work are preserved; guide/index and implementation evidence explain the result and limits.

## Validation plan

Use the local static server at 3189 with installed Chrome/Playwright at 375, 393, 430, 768, 1024 and 1440 px widths. Inspect actual screenshots for copy/photo placement, not just bounds. Exercise native Enter/Space, Phone mode, slogan toggle, downloads, image failure/recovery and JavaScript-free cards. Reuse the existing light comparison check for shared-file regression. Run scoped Prettier, JavaScript syntax, link/hash checks and `git diff --check`. Application lint/type/build/unit/database checks are not applicable to this independent static preview.

## Implementation record

### Changes and rationale

Generated one B3 composite using built-in imagegen with original B as the edit target and the two user-supplied JPEGs as explicit photo inputs. Ropes photography now fills the central gap; the kicker and red padded posts replace the high-knees group. The agility athlete, pad-coaching pair and helping-hand scene remain recognizable in organic curved windows. The output contains no baked words.

The new comparison defaults to B3 and includes unchanged B2 beside it. The exact HTML slogan uses the ropes photo's bright opening. Desktop uses two lines; phone sizes use smaller stacked copy, deliberately positioned to clear the roof and rope athlete. Native controls switch options/device widths, toggle the copy and download the background. New links from the original and preferred light pages make this refinement easy to find without replacing earlier comparisons.

### Affected files

- [B3 comparison](../../../previews/home-banner-collages/ropes-banner.html): new standalone B3/B2 comparison with editable slogan, native controls, preview context and downloads.
- [B3 artwork](../../../previews/home-banner-collages/assets/banner-b3-ropes-kick.png), [exact prompt](../../../previews/home-banner-collages/prompts/b3-ropes-kick.txt) and [provenance](../../../previews/home-banner-collages/provenance-b3-ropes-kick.json): versioned output, three ordered source roles/hashes and output metadata.
- [Shared script](../../../previews/home-banner-collages/preview.js): adds only the B3 concept configuration to existing behavior. [Shared styles](../../../previews/home-banner-collages/styles.css): B3-only copy position, bright fallback and responsive typography; earlier concept selectors retain their behavior.
- [Original comparison](../../../previews/home-banner-collages/index.html), [light comparison](../../../previews/home-banner-collages/light-banner.html), [README](../../../previews/home-banner-collages/README.md) and [refinement guide](../../../previews/home-banner-collages/REFINEMENTS.md): latest-version navigation, source boundaries and complete artifact/prompt references.
- This ticket and the root ticket index record the new preview slice. No application code, Home asset, auth record or database work is owned or changed by this ticket.

### Decisions and deviations

2026-10-17: Kept B3 on a separate page against B2 so prior comparisons and user choices stay reviewable. The tool returned 2170 × 725 rather than exactly 2172 × 724; retained the generated near-3:1 output without raster resampling and recorded the actual dimensions.

Visual inspection exposed three-line tablet copy and phone copy drifting into the athlete/roof area despite passing geometric bounds checks. Reduced the tablet minimum font size and positioned a fixed-width four-line phone block over the bright opening. Final screenshots were inspected again. No material scope deviation or production adoption.

### Contracts, configuration, and operations

No application/data/API/dependency/environment/migration changes. Independent static preview served by the existing local server at port 3189; the guide retains its exact startup command. Original source JPEGs and all earlier artwork remain intact. Downloads are backgrounds; the slogan remains editable page text.

## Validation results

2026-10-17, local static server `127.0.0.1:3189`, installed Chrome with Playwright.

- Final `node work/dev0307/check-ropes-banner.mjs`: **passed**, exit 0. B3 (2170 × 725) and B2 (2172 × 724) decode at 375, 393, 430, 768, 1024 and 1440 px (12 concept/viewport combinations). Exact slogan bounds stay inside the banner; no horizontal overflow. Phone mode uses a maximum 390 px frame and 160 px banner.
- Native Enter option selection, Space device/copy controls, pressed states, copy hide/show, download focus and Enter-triggered native download passed. Concept/device targets are at least 44 px. Forced B3 image failure retains dark-green text on its pale fallback; choosing B2 restores the image. JavaScript-free mode retains both decoded thumbnails and direct downloads. Zero page JavaScript errors and zero requests outside the local preview origin.
- Final regression `node work/dev0306/check-b-refinements.mjs`: **passed**, exit 0, 12 earlier-light concept/viewport combinations plus keyboard/device/copy/download/no-JavaScript/failure-recovery checks. No changes to original/diagonal concept logic or their CSS selectors; their completed validation remains in DEV0305/DEV0306.
- Inspected final B3 screenshots at 375, 768 and 1440 px and the 390 px Phone canvas. Ropes fill the middle, the red-post kick replaces high knees, and headline placement clears main faces while retaining the bright photographic center. Local check scripts/results/screenshots are under ignored `work/dev0307/`; previous-light regression evidence remains under `work/dev0306/`.
- Scoped `npx prettier --write` / final `--check`, `node --check previews/home-banner-collages/preview.js`, source/artwork SHA-256 and local-link checks, and `git diff --check`: passed. All eight artwork hashes across the four provenance manifests and all three current input hashes match, confirming preservation of prior artwork and sources.
- App lint/type/build/unit/database checks: **not run — not applicable** to this isolated static preview. No application routes, services or configuration changed. No publication, commit or independent review.

| Criterion | Evidence                                                                                                  | Result |
| --------- | --------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Inspected B3, exact saved prompt, ordered input provenance and eight artwork/three input hash checks.     | Passed |
| AC2       | 12 responsive combinations, visual crop/copy review and native interaction/fallback/no-JavaScript checks. | Passed |
| AC3       | Earlier light regression, linked guides, preserved source boundaries and final file review.               | Passed |

## Risks, limitations, and follow-ups

AI-assisted compositing can reinterpret details; these photos do not document one event or identify MovX coaches/venues. Phone crops show fewer scenes. Production adoption would need a separate request and ticket.

## Completion and review references

- Completed: 2026-10-17 — new curved collage with central ropes, slogan over the bright opening and a kick replacing high knees; local comparison verified.
- Commit: User authorized committing on 2026-10-17; included in `[DEV0298][DEV0300][DEV0301][DEV0302][DEV0303][DEV0304][DEV0305][DEV0306][DEV0307][DEV0308][DEV0309][DEV0310] Refine Home banners and compact coach discovery`.
- Review: Visual/responsive/keyboard/fallback and static self-review passed; no independent review.
- Deployment or release: None.
