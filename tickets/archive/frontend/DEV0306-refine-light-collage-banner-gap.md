# Ticket DEV0306: Refine the light collage banner gap

2026-10-20 artifact retirement: the owner removed standalone design previews under [DEV0390](../organisatory/DEV0390-remove-unneeded-design-previews.md). The record below preserves the original design/validation history; backticked preview paths identify retired artifacts. Runtime images/code are retained, with banner source/prompt provenance in public/images/retained-banner-provenance.json.

- Status: Completed
- Created: 2026-10-17
- Last updated: 2026-10-20
- Milestone: M3 — Public discovery design exploration
- Coordination: None — independent development ticket
- Related records: original light collage [DEV0304](../../archive/frontend/DEV0304-preview-photo-collage-banners.md); parallel diagonal refinements [DEV0305](DEV0305-refine-diagonal-banner-gap.md); actual Home [DEV0303](../../archive/frontend/DEV0303-adopt-compact-photographic-home.md)

## Objective and context

The user clarified that their preferred “first banner” is the **light collage with curved photo windows and the pale central gap**, originally labelled B in the comparison page. They explicitly asked to finish the ongoing diagonal refinements and do the same two treatments for this light concept. Create a photo-filled center and a slogan-filled center while preserving its curved/airy visual language. The adopted [Home contract](../../../docs/mvp-spec.md#42-discover-a-coach-and-time) remains unchanged.

## Scope and non-goals

In scope: two versioned built-in imagegen edits of the light collage, a dedicated light-refinement page using shared local controls, prominent links/default entry guidance to the corrected preferred concept, full prompts/provenance and focused browser/visual checks. Keep original concepts and the completed diagonal comparison accessible.

Out of scope: live Home replacement, app/data/Auth/calendar changes, rewriting completed history, removing original assets, publication or commits. Do not treat photographed people/locations as MovX inventory.

## Expected behavior and edge cases

B1 fills the pale center with another supplied outdoor training photograph while preserving the organic photo-window style. Use `michael-demoya-qZFDRMRr1ak-unsplash.jpg` as an additional coaching/training source, crop close enough to retain human detail and avoid a new empty central panel. If the slogan is shown, place it over a lower photographic gradient rather than a face. B2 deliberately frames a clean light central message space with photos on either side, occupied by the exact editable HTML slogan “Find your coach. Achieve your goals.” No words are baked into the pixels. At phone sizes preserve text/faces with a deliberate crop; failed images retain suitable contrast. All controls/requests remain local, with usable native downloads and JavaScript-free option thumbnails.

## Assumptions, decisions, and dependencies

Confirmed in an explicit answer: the intended first banner is the light curved collage. Earlier numbering was ambiguous because image results and comparison labels could be perceived in different orders; use visual descriptions and clear B1/B2 labels from now on. The user also authorized finishing the diagonal work, so DEV0305 remains its owner and this ticket owns the distinct light refinement. Both use the same small static preview workspace without touching application code. Original files and existing generated outputs remain intact. Built-in imagegen only; no API-key/CLI fallback.

## Implementation plan

1. Inspect the light collage and additional source; persist two exact edit prompts and generate independently from the original B image.
2. Inspect/save versioned outputs and record their hashes/source roles without changing prior artifacts.
3. Add `light-banner.html`, two shared concept entries and scoped light/refinement styles. Point the original comparison prominently to this preferred direction and retain clear navigation to diagonal/history.
4. Verify both light options at six desktop/phone widths, device/copy/download/keyboard behavior, image-failure recovery, no external calls and original/diagonal regressions. Check syntax/formatting/assets/links/diffs and complete the record.

## Acceptance criteria

- [x] AC1: Two inspected light/curved refinements clearly demonstrate photo-filled versus slogan-filled center; local artwork, prompts/provenance and original preservation are recorded.
- [x] AC2: The preferred light comparison shows exact editable copy and usable responsive/keyboard/download/fallback states without overflow or app/external service calls.
- [x] AC3: Original and diagonal alternatives remain accessible and functional; actual Home/unrelated work remains unchanged by this ticket; guide/index/handoff reflect the user's clarified preference.

## Validation plan

Use the independent static server at 3189, installed Chrome/Playwright and visual inspection at 375/393/430/768/1024/1440 widths. Exercise both light options, Phone mode, native keyboard selection, copy toggle, direct download, failed image and recovery, and no-JavaScript cards. Reuse original and diagonal preview checks as shared-script/style regression proof. Run scoped Prettier, `node --check`, source/output hash and repository-link checks, and `git diff --check`. App/unit/database/build checks are not applicable to this isolated preview-only change.

## Implementation record

### Changes and rationale

Delivered two independent built-in imagegen edits of the preferred light collage, saved at 2172 × 724. B1 fills the center with the additional supplied outdoor coaching photograph while retaining curved photo windows. B2 balances the photos around a deliberate pale message area, occupied by the exact dark-green HTML slogan. Neither raster has baked words. Original source photos and the three original generated concepts remain intact.

The dedicated light comparison defaults to B2 and retains native option/device controls, editable copy toggle, background downloads and noninteractive header/search context. The original comparison prominently links to the light refinements first; light, diagonal and original pages link to one another so the user's clarified preference is no longer hidden behind ambiguous numbering.

### Affected files

- Light comparison (retired artifact: `previews/home-banner-collages/light-banner.html`): preferred two-option page, default central slogan, desktop/phone controls and downloads.
- Shared selection script (retired artifact: `previews/home-banner-collages/preview.js`) and scoped styles (retired artifact: `previews/home-banner-collages/styles.css`): B1/B2 configuration, shared lower photo-fill headline, pale/green central treatment and explicit centered mobile crops for refinement pages.
- Refinement guide (retired artifact: `previews/home-banner-collages/REFINEMENTS.md`) and light manifest (retired artifact: `previews/home-banner-collages/provenance-b-refinements.json`): four local refinement assets/prompt links, clear light-first preference, source roles and exact B output/input hashes. The original comparison, diagonal page and README retain clear cross-navigation.
- Ticket/index: record the user-confirmed visual target and independent completed preview scope. No application code, public Home asset, configuration or persistent-data work was performed under this ticket.

### Decisions and deviations

2026-10-17: Correct the visual target before further generation based on the user's explicit answer. Keep the already-authorized diagonal deliverable rather than discarding it. Slogan remains editable HTML on both branches.

Visual review exposed an inherited right-aligned phone crop that displaced the pale center despite passing geometric text-bounds checks. Explicitly center refinement-page crops with sufficient CSS specificity and inspect screenshots again. Move the desktop B2 copy slightly right within its irregular pale area and cap it at 40 px so the headline clears both photo boundaries. Phone copy remains centered at 20/21 px. These are preview-only presentation adjustments; generated pixels and actual Home remain unchanged.

### Contracts, configuration, and operations

No app/data/API/dependency/environment/migration changes. Independent local static preview; original inputs/outputs remain unchanged.

## Validation results

2026-10-17, existing independent static server `127.0.0.1:3189`, installed Chrome/Playwright. Both saved built-in imagegen edit prompts completed successfully. Inspected full outputs against source photos and final desktop/phone banner renders.

- Final `node work/dev0306/check-b-refinements.mjs`: **passed**, exit 0. Both 2172 × 724 outputs decode at 375, 393, 430, 768, 1024 and 1440 px widths (12 combinations). Exact slogan bounds stay inside the banner and no horizontal overflow occurs. Phone mode is at most 390 px wide with a 160 px banner; native keyboard option/device controls, copy visibility, focused download and at-least-44 px concept/device buttons pass.
- Forced B1 image failure retains readable white copy on the dark fallback; switching to B2 restores the decoded image and pale/green treatment. Both images/direct downloads remain available with JavaScript disabled. Zero page JavaScript errors and zero requests outside the local preview origin; no app/Auth/database/map/tracking calls.
- Final regressions: `node work/dev0305/check-a-refinements.mjs` **passed** (12 diagonal combinations plus interaction/recovery checks); `node work/dev0304/check-preview.mjs` **passed** (18 original combinations plus interaction/recovery checks). Across these three checks there are **42 concept/viewport combinations**, followed by dedicated device/keyboard/no-JavaScript/fallback assertions; these are browser scenarios, not unit-test counts.
- Inspected final B1 desktop/phone and B2 desktop/phone screenshots after the documented crop/text-placement fixes. All text is editable HTML; B2 uses its pale center and B1's lower line clears main faces. Local supporting screenshots/results are under ignored `work/dev0306/evidence/`.
- Scoped Prettier, `node --check previews/home-banner-collages/preview.js`, all seven artwork SHA-256 comparisons (including unchanged original concepts), repository guide links and `git diff --check`: passed. Final archive-link consistency is checked during completion housekeeping.
- App tests/lint/types/build/database checks: **not run — not applicable**, because this ticket changes only independent preview/work-record files. Current Home and unrelated authentication planning were preserved. No commit, deployment, product-contract adoption or independent review occurred.

| Criterion | Evidence                                                                                                    | Result |
| --------- | ----------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Two inspected 2172 × 724 outputs, exact edit prompts and source/output manifest; original hashes preserved. | Passed |
| AC2       | 12 light viewport combinations plus visual/keyboard/device/copy/download/no-JavaScript/fallback proof.      | Passed |
| AC3       | Original and diagonal regressions, light-first navigation/guide and source-boundary review passed.          | Passed |

## Risks, limitations, and follow-ups

AI-assisted edits can reinterpret details; no single-event, venue or coach endorsement claim is made. Phone crops show fewer source scenes. Production selection/adoption is a separate request and implementation ticket.

## Completion and review references

- Completed: 2026-10-17 — preferred light/curved photo-fill and central-slogan refinements with verified local comparison.
- Commit: User authorized committing on 2026-10-17; included in `[DEV0298][DEV0300][DEV0301][DEV0302][DEV0303][DEV0304][DEV0305][DEV0306][DEV0307][DEV0308][DEV0309][DEV0310] Refine Home banners and compact coach discovery`.
- Review: Visual/responsive/keyboard/recovery self-review and recorded browser/static checks passed; no independent review.
- Deployment or release: None.
