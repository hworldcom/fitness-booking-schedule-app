# Ticket DEV0305: Refine the diagonal banner gap

2026-10-20 artifact retirement: the owner removed standalone design previews under [DEV0390](../organisatory/DEV0390-remove-unneeded-design-previews.md). The record below preserves the original design/validation history; backticked preview paths identify retired artifacts. Runtime images/code are retained, with banner source/prompt provenance in public/images/retained-banner-provenance.json.

- Status: Completed
- Created: 2026-10-17
- Last updated: 2026-10-20
- Milestone: M3 — Public discovery design exploration
- Coordination: None — independent development ticket
- Related records: original photo concepts [DEV0304](../../archive/frontend/DEV0304-preview-photo-collage-banners.md); actual Home [DEV0303](../../archive/frontend/DEV0303-adopt-compact-photographic-home.md)

## Objective and context

Initially interpreted “first banner” as the diagonal concept A and began two gap refinements: fill its open space with another supplied training photograph, or use a purposeful central slogan area. The user subsequently clarified that the preferred first banner was the light curved collage, and explicitly authorized finishing these diagonal variants as well; [DEV0306](DEV0306-refine-light-collage-banner-gap.md) owns that clarified light direction. This ticket retains the already-started diagonal pair. Carry forward “Find your coach. Achieve your goals.” The adopted [Home contract](../../../docs/mvp-spec.md#42-discover-a-coach-and-time) remains unchanged.

## Scope and non-goals

In scope: two non-destructive built-in imagegen edits of A; a linked two-option comparison page using existing preview controls/fonts; complete prompts/provenance and responsive/keyboard/fallback validation.

Out of scope: actual application/banner replacement, changing earlier PNGs or completed ticket history, database/Auth/calendar work, commits and publication. No new claim about depicted people or locations. Existing uncommitted application and authentication-planning changes are outside this ticket.

## Expected behavior and edge cases

A1 fills the collage edge to edge using an additional supplied coach/pad-training picture, with any slogan shown over a subtle photographic lower gradient. A2 arranges A's existing training scenes around a central dark diagonal message area occupied by the exact slogan as editable HTML. No banner text is baked into either raster. Treat “gap” as the unused/open canvas rather than changing thin seams between source photos. Preserve recognizable faces/poses and the photographic style; keep the original concepts accessible. Phone crops retain visible athletes and a readable headline; failed images keep readable dark fallback. All comparison requests/interactions remain local.

## Assumptions, decisions, and dependencies

Confirmed: finish the diagonal photo-filled/slogan-filled variants, then supply the clarified light direction under DEV0306. A was the initial interpretation, not the user's confirmed preference. Adopted defaults: new versioned assets and a dedicated `first-banner.html` diagonal refinement page linked from the original comparison; reuse existing local controls and the approved slogan. The extra source photo is the supplied `declan-sun-KrTGzQUmTBY-unsplash.jpg` coaching pair, selected to strengthen the coach/athlete relationship. Inputs are inspected local files. Built-in imagegen only; no API/CLI fallback. No product-contract adoption is implied by creating these previews.

## Implementation plan

1. Inspect A and the additional photo; persist complete prompts before two independent imagegen edits.
2. Inspect/copy the two outputs as new assets and record source/output hashes.
3. Add a two-option refinement page, extend shared preview selection data and scope new layout rules to A1/A2. Link it from the existing comparison/guide.
4. Verify both versions at desktop/phone widths, keyboard/copy/download controls, image failure/recovery and the unchanged original comparison. Check formatting, JavaScript syntax, repository links and source boundaries; finish/archive the record after checks pass.

## Acceptance criteria

- [x] AC1: Two inspected, locally saved A refinements clearly compare a photographic fill with a central slogan treatment; original assets remain intact and prompts/provenance are recorded.
- [x] AC2: Linked comparison displays the exact editable slogan without covering key faces, supports keyboard/phone/download controls and readable image fallback, and has no overflow or external service calls.
- [x] AC3: Original A/B/C comparison still works; actual application/data and unrelated edits remain outside this change; ticket/index/guide evidence is complete.

## Validation plan

Use the existing independent static preview server on 3189 or start only that server if necessary. Inspect generated images and desktop/phone screenshots. Run focused installed Chrome/Playwright checks for both new options at 375/393/430/768/1024/1440 widths, device/copy controls, local downloads, no-JavaScript visibility, forced image failure/recovery and original A/B/C regression. Run scoped Prettier, `node --check`, SHA-256 and repository-link checks, and `git diff --check`. Application/unit/database/build tests are not applicable to this independent static preview.

## Implementation record

### Changes and rationale

Delivered two independent edits of the original A image using built-in imagegen. A1 adds the supplied pad-coaching photograph across the previously open wedge; A2 redistributes the original scenes around a central dark message area. Both outputs are saved unchanged at 2171 × 724 (one pixel narrower than the 2172 px source). The original A/B/C PNGs and user photographs are preserved.

The dedicated diagonal comparison defaults to A2 and supplies both options, exact editable HTML copy, phone/desktop views, copy toggle and raw background downloads. A1 uses a single lower desktop line, naturally wrapping on phones, to clear the central athlete's face. The clarified light preference is prominently linked separately and owned by DEV0306.

### Affected files

- Diagonal comparison (retired artifact: `previews/home-banner-collages/first-banner.html`): two native-selectable options, contextual header/search and accessible downloads; no application service behavior.
- Shared selection script (retired artifact: `previews/home-banner-collages/preview.js`) and scoped styles (retired artifact: `previews/home-banner-collages/styles.css`): A1/A2 entries, photographic lower text, central message placement and responsive/fallback/focus behavior. Light additions remain DEV0306's scope.
- Refinement guide (retired artifact: `previews/home-banner-collages/REFINEMENTS.md`) and manifest (retired artifact: `previews/home-banner-collages/provenance-a-refinements.json`): local artwork links, complete A1/A2 prompts, source roles, dimensions and source/output SHA-256 records. Original comparison/README link to refinements without overwriting earlier assets.
- Ticket/index: documented the initial interpretation, explicit user clarification and authorized preservation of the diagonal alternatives. No `src/`, public application asset, app configuration or data change under this ticket.

### Decisions and deviations

2026-10-17: Preserve the original A image and keep comparison changes separate from actual Home. Use HTML text for both variants to guarantee exact copy and allow the existing Show slogan control to reveal the image composition.

Clarification during implementation: the user's intended first banner is the light curved collage, not A's dark diagonal collage. They asked to finish this pair and repeat the treatments for the light concept. Preserve that distinction in the guide/navigation; DEV0306 owns the preferred light pair. The lower A1 slogan uses one desktop line (natural wrapping on phones) after review found a two-line overlay crossed the central boxer's lower face. No raster regeneration was needed for that presentation adjustment.

### Contracts, configuration, and operations

No application, dependency, data, environment or migration contract changes. No original input/output image is overwritten. Static local preview only.

## Validation results

2026-10-17, local static preview on `127.0.0.1:3189`, installed Chrome/Playwright. Built-in imagegen completed both saved edit prompts successfully; input/output composition and desktop/phone renders were inspected.

- Final `node work/dev0305/check-a-refinements.mjs`: **passed**, exit 0. Both 2171 × 724 images decode at 375, 393, 430, 768, 1024 and 1440 px widths (12 combinations). The exact slogan stays inside the banner, no horizontal overflow occurs, and the 390 px Phone control uses a 160 px hero. Native keyboard selection/device switching, copy toggle and focused downloads pass; concept/device targets are at least 44 px.
- Forced A1 image failure retains readable white copy on forest fallback; switching to A2 restores the image. JavaScript-disabled rendering retains both thumbnails/direct downloads. Zero page JavaScript errors and zero requests outside the static preview origin; no Auth/database/booking/service calls.
- Final original comparison regression `node work/dev0304/check-preview.mjs`: **passed** (18 concept/viewport combinations plus keyboard, copy/device, downloads, no-JavaScript, image failure/recovery and local-request checks). DEV0306's final light checks also pass; no shared-control regression remains.
- Visual inspection found/fixed the A1 two-line lower-face overlap before completion. Final center crops explicitly override inherited right-aligned phone crops for refinement pages. Inspected final A1 desktop and A2 desktop/phone renderings; local evidence is in ignored `work/dev0305/evidence/`.
- Scoped Prettier and `node --check previews/home-banner-collages/preview.js`: passed. Seven-artwork checksum validation passed, including the three unchanged original PNGs; manifests/guide links and `git diff --check` pass. Final archive-link consistency is checked during completion housekeeping.
- App tests/lint/types/build/database checks: **not run — not applicable**, because only independent preview/work-record files changed under this ticket. No commit, publication or product-contract adoption; unrelated existing work was preserved.

| Criterion | Evidence                                                                                             | Result |
| --------- | ---------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Two inspected versioned PNGs, exact prompts and source/output manifest; original checksums retained. | Passed |
| AC2       | 12 viewport combinations, keyboard/device/copy/download, no-JavaScript and failure/recovery checks.  | Passed |
| AC3       | Original comparison regression passed; source-boundary and navigation/guide/index review.            | Passed |

## Risks, limitations, and follow-ups

AI-assisted edits can reinterpret fine details and phone crops show fewer source scenes. No single real event, Berlin venue or MovX endorsement is claimed. Production adoption needs a separate implementation request/ticket.

## Completion and review references

- Completed: 2026-10-17 — retained diagonal photo-filled and central-slogan alternatives.
- Commit: User authorized committing on 2026-10-17; included in `[DEV0298][DEV0300][DEV0301][DEV0302][DEV0303][DEV0304][DEV0305][DEV0306][DEV0307][DEV0308][DEV0309][DEV0310] Refine Home banners and compact coach discovery`.
- Review: Visual/responsive/keyboard/fallback self-review and recorded automated checks passed; no independent review.
- Deployment or release: None.
