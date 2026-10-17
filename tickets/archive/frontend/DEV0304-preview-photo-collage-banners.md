# Ticket DEV0304: Preview photo collage banners

- Status: Completed
- Created: 2026-10-17
- Last updated: 2026-10-17
- Milestone: M3 — Public discovery design exploration
- Coordination: None — independent development ticket
- Related records: current Home baseline [DEV0303](../../archive/frontend/DEV0303-adopt-compact-photographic-home.md); earlier banner exploration [DEV0301](../../archive/frontend/DEV0301-preview-coached-boxing-banner.md)

## Objective and context

The user supplied sixteen Unsplash photographs and asked to combine/crop them into a banner, with a few versions to compare. Create three distinct photo-composite concepts and a standalone comparison page using the existing “Find your coach. Achieve your goals.” slogan. The adopted [Home contract](../../../docs/mvp-spec.md#42-discover-a-coach-and-time) remains the application baseline until a replacement is selected.

## Scope and non-goals

In scope: inspect supplied images, choose complementary coaching/group-training subjects, create three wide raster compositions with built-in imagegen, preserve prompts/provenance, and show selectable HTML copy over each in a responsive standalone page. Provide original image downloads and mobile/desktop comparison controls.

Out of scope: replacing the live Home asset, application/source/database/Auth changes, identifying pictured people or asserting a Berlin location/MovX endorsement, external publication and commits. Do not treat the pictured people as directory coaches. No new product behavior or specification change is adopted by this exploration.

## Expected behavior and edge cases

Offer three visibly different compositions: an energetic diagonal photo collage, an airy social/coaching collage, and an editorial training strip. Use a curated subset per version rather than forcing all sixteen photos into an unreadable shallow banner. Preserve natural faces, athletic poses and photographic texture; keep subjects separate where different settings cannot blend honestly. Reserve readable space for the unchanged slogan as HTML, not baked image text. At narrow widths provide a deliberate crop and retain readable headline/controls. Image failure keeps readable fallback content. All comparison interactions remain local and keyboard accessible; no app services or tracking are contacted.

## Assumptions, decisions, and dependencies

Confirmed: creative freedom to combine/crop the supplied photographs and make multiple versions for comparison. Adopted defaults: three initial concepts, preview only, preserve current live Home and its compact height/search, and carry forward the previously approved slogan. Source files are available in the user's Downloads; use their filenames/photo IDs for provenance without claiming a separately verified license or people/venue release. Generated composites are AI-assisted design concepts, not documentary photos of a single event. Built-in imagegen is the selected image tool; no CLI/API-key fallback.

## Implementation plan

1. Inspect the candidate source images and record selected source roles and complete prompts before generation.
2. Produce three wide composites, inspect them, and copy deliverables into a new `previews/home-banner-collages/` folder without overwriting existing assets.
3. Build a local comparison page with side-by-side concept summaries, an adjustable full-size banner stage, desktop/mobile views and image downloads. Reuse local project fonts where appropriate.
4. Validate decoded assets, natural composition/text readability, responsive layout, keyboard controls, fallback and absence of service requests. Check formatting/repository links/diffs and finish the ticket record.

## Acceptance criteria

- [x] AC1: Three distinct wide banner concepts visibly combine the supplied photos and are saved locally with exact prompts and source provenance.
- [x] AC2: A standalone comparison page shows the existing slogan over each concept, supports desktop/mobile comparison and keyboard selection/download, and has no overflow or unreadable fallback.
- [x] AC3: The application Home/source/data remain unchanged by this ticket; implementation, validation and index records accurately describe preview-only delivery.

## Validation plan

Inspect input/output images and desktop/phone screenshots. Serve only the standalone preview on an owned local port; use installed Chrome/Playwright to verify all three assets, selection, mobile layout, keyboard focus and failed-image behavior, with no requests outside local preview assets. Run scoped Prettier, repository-link validation, asset checks and `git diff --check`. Application unit/server/database/build checks are not applicable because this ticket changes only independent preview artifacts and work records; earlier DEV0303 application validation remains recorded separately.

## Implementation record

### Changes and rationale

Created three separate 2172 × 724 raster backgrounds using the built-in imagegen tool, each with four explicit source-photo inputs. Ten of the sixteen supplied photographs appear across the concepts. A uses diagonal source sections and a dark copy area; B frames a light central message with agility, coaching, group movement and a helping hand; C uses a mostly monochrome editorial training sequence. Outputs were inspected against the supplied photos. The original files were read only, and generated pixels were copied unchanged into the preview.

The comparison page defaults to B, with all three options visible below a full-size banner stage. Select a concept with pointer or keyboard, switch Desktop/Phone, toggle the editable HTML slogan or download the background PNG. A noninteractive header/search supplies layout context without suggesting directory inventory or sending app requests. The current application Home remains the DEV0303 version.

### Affected files

- [Comparison page](../../../previews/home-banner-collages/index.html): semantic native controls, banner stage, all three concept cards and direct image downloads, including a JavaScript-free comparison path.
- [Preview styles](../../../previews/home-banner-collages/styles.css): local project fonts, shallow desktop crops, deliberate phone crops, readable dark/light fallback, focus rings and responsive layout.
- [Local interactions](../../../previews/home-banner-collages/preview.js): concept/device selection, slogan visibility, asset download target and failed-image recovery; no persistence or external services.
- [Artwork and provenance guide](../../../previews/home-banner-collages/README.md): links to the three local PNGs, complete prompt files, font licenses and selected source IDs. [Provenance manifest](../../../previews/home-banner-collages/provenance.json) records the exact input order and source/output hashes.
- Ticket index: reserved DEV0304 before image/page implementation and records its preview-only completion. No application files, database records, other planning tickets or old preview assets were edited under this ticket.

### Decisions and deviations

2026-10-17: Treat the request for a few versions first as design exploration. Retain the previously adopted actual Home while the user compares alternatives. Review confirmed that this is one small preview deliverable and does not require a coordination record.

Visual tuning: all three generated composites are 2172 × 724. Keep their pixels unchanged; use top-aligned upper-body crops in shallow desktop banners to retain faces. The light concept needs a narrower, slightly smaller headline within its irregular ivory center, rather than the generic half-width overlay that crossed a coach. Allow the unchanged slogan to wrap onto four lines in its narrow phone copy area. Dark concepts keep the right-side headline. These are preview presentation defaults, not adopted Home changes.

Further crop review: right-align A/C on phones so their dark copy area remains visible and the headline clears the main visible athlete faces. Keep B centered and use its pale central copy area. No additional raster generation or pixel-editing script was needed after the first three built-in tool calls. Two focused browser passes verified the initial and final tuned presentations; no acceptance failures remained.

### Contracts, configuration, and operations

No application/data/interface/dependency/environment/migration contract changes. Inputs remain intact. Standalone preview assets are locally served, not published.

## Validation results

2026-10-17, installed headless Chrome with Playwright, independent Python static server at `http://127.0.0.1:3189/`.

- Built-in imagegen: three successful compositing calls, one per saved prompt/concept. `file previews/home-banner-collages/assets/banner-*.png`: all three are 2172 × 724 RGB PNGs. Outputs and source-photo identities/poses were visually compared; these remain AI-assisted composites, not guaranteed pixel-identical source crops.
- `node work/dev0304/inspect-preview.mjs`: captured initial desktop/phone comparison screenshots and headline bounds. Review found that the generic B headline extended onto a coaching photo, and shallow center crops cut some upper faces. The documented CSS tuning corrected placement and aligned upper-body crops.
- Final `node work/dev0304/check-preview.mjs`: **passed**, exit 0, after the last crop change. All three concepts decode at 1440, 1024, 768, 430, 393 and 375 px widths (18 combinations), with the exact slogan inside the banner and no horizontal overflow. Additional checks passed for the 390 px Phone mode, 160 px phone hero, native Enter/Space concept/device selection, slogan toggle, focused download link and at-least-44 px concept/device buttons.
- The same check passed forced A-image failure (readable white slogan on forest fallback), recovery after switching to B (decoded image and dark text/light fallback), zero page JavaScript errors and zero requests outside the local preview origin. A JavaScript-disabled context decoded all three thumbnails and retained direct downloads. No Auth, booking, database, map, tracking or external-font calls occurred.
- Inspected final desktop B/C and phone A/B/C banner screenshots plus Phone-mode B, confirming readable text, deliberately separate photo settings and visible coaching/athlete faces in the chosen crops. Local screenshots/results are under ignored `work/dev0304/evidence/`.
- `node --check previews/home-banner-collages/preview.js`: passed. Scoped `prettier --write` / `--check`, repository links, three output SHA-256 checks and `git diff --check` passed. Source/output hashes and photo IDs are durable in the manifest; the original Downloads files remain intact.
- Application unit/server/database tests, lint/type checks and production build: **not run — not applicable**, because there are no application/dependency/data changes in this ticket. DEV0303's earlier application validation is not claimed as validation of these new concepts. No commit, publication, product-contract adoption or independent review occurred.

| Criterion | Evidence                                                                                                               | Result |
| --------- | ---------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Three inspected local PNGs; complete prompts, ten selected photo records and source/output hashes.                     | Passed |
| AC2       | 18 viewport/concept combinations plus Phone mode, keyboard, fallback/recovery, no-JavaScript and local-request checks. | Passed |
| AC3       | Preview-only file review, truthful README/ticket/index and unchanged actual Home/services.                             | Passed |

## Risks, limitations, and follow-ups

AI-assisted compositing can reinterpret small details; no pixel-identical source-photo preservation is claimed. Phone crops intentionally show fewer source photos than full-width backgrounds, and B's copy wraps onto four lines. Preview selection is not application adoption or a documentary venue/coach claim. Final implementation, if requested, needs a new linked ticket; this ticket does not reopen DEV0303. The static preview server remains available on port 3189 for comparison, separate from the current app.

## Completion and review references

- Completed: 2026-10-17 — three photo-composite concepts and the verified standalone comparison page.
- Commit: User authorized committing on 2026-10-17; included in `[DEV0298][DEV0300][DEV0301][DEV0302][DEV0303][DEV0304][DEV0305][DEV0306][DEV0307][DEV0308][DEV0309][DEV0310] Refine Home banners and compact coach discovery`.
- Review: Input/output visual review and desktop/mobile/keyboard/fallback self-review passed; no independent review.
- Deployment or release: None.
