# Ticket DEV0298: Preview a photographic Home banner

2026-10-20 artifact retirement: the owner removed standalone design previews under [DEV0390](../organisatory/DEV0390-remove-unneeded-design-previews.md). The record below preserves the original design/validation history; backticked preview paths identify retired artifacts. Runtime images/code are retained, with banner source/prompt provenance in public/images/retained-banner-provenance.json.

- Status: Completed
- Created: 2026-10-17
- Last updated: 2026-10-20
- Milestone: M3 — Public discovery design exploration
- Coordination: None — independent development ticket
- Related records: delivered Home [DEV0228](../../archive/frontend/DEV0228-build-home-coach-grid-with-discipline-filter.md); public accessibility [DEV0201](../../archive/frontend/DEV0201-polish-public-marketplace-accessibility.md)

## Objective and context

Create a standalone test page for a proposed photographic MovX Home banner inspired by the wide photograph and prominent white headline in the user's pasted Everfit marketplace HTML. The user explicitly said not to implement the banner yet, then asked for a more social photograph reflecting group training and challenges. The [current Home contract](../../../docs/mvp-spec.md#42-discover-a-coach-and-time) remains unchanged; this ticket records a design proposal, not adopted product behavior.

## Scope and non-goals

In scope: one source-verified photograph of a real Berlin public place, the existing Home slogan “Find your coach. Make time to train.” as selectable text, a responsive independent test page with MovX typography/colors, and enough existing search/grid context to judge the banner. Clearly label illustrative coach cards and local-only controls. Keep the preview and asset together in a task-owned directory.

Out of scope: changes to application routes/components/styles, production assets, database/Auth/settings, new search behavior, real coaches or bookings, copied Everfit photography, publishing, deployment or a commit without a further request.

## Expected behavior and edge cases

Use a licensed photograph of a real Berlin location, edited as authorized to add a nearby group of three runners, remove the person on the right and lighten the color treatment. The existing two-sentence slogan appears centered over the photograph with a restrained contrast overlay; discipline/location search and a single coach grid follow it. Preserve a readable mobile crop and heading wrapping at 375/430 px, with desktop verification at 1440 px. Failed image loading leaves a readable color fallback. Standalone controls affect only fictional preview content and never call application services. All layout navigation is local to the test page; no login, email, booking or tracking requests.

## Assumptions, decisions, and dependencies

Confirmed: preview only, inspired by the supplied banner, using MovX's own slogan; the photo should feel social, with people training together. The user permits editing a real Berlin photograph and requests closer runners, removal of the person on the right, and an airy blue treatment. Adopted preview defaults: reuse the live Home headline rather than propose new marketing copy; select a real photograph of Tempelhofer Feld with its runway, open space and ordinary public activity; retain the forest/lime/off-white visual language. Challenges inform the photograph's shared-effort mood only and authorize no challenge feature or product-contract amendment. Any final layout, photograph, crop and copy remain subject to user review. The original reference image is for visual inspection only and will not be shipped. The final preview is an AI-assisted edit of a licensed location photograph, with source/author/license credit and changes disclosed. The added runners are illustrative, not actual MovX participants.

## Implementation plan

1. Inspect the supplied banner markup and its image, and the existing Home visual language without changing application source.
2. Source and inspect one authentic Berlin photograph, verify reuse terms, preserve the original, and edit the requested runners, removal and tonal treatment using built-in imagegen. Save the derivative and prompt with source/author/license provenance.
3. Build the standalone test page with centered slogan, responsive banner, current discipline/location search context and explicitly fictional sample cards.
4. Inspect the page at mobile/desktop widths and with keyboard navigation, image fallback and local interactions. Document actual results and delivery path. Finish/archive only after required preview checks pass.

## Acceptance criteria

- [x] AC1: The standalone page shows the authorized edit of a real Berlin photograph, a closer social running group and the exact existing slogan as real, readable text in MovX styling.
- [x] AC2: Mobile/desktop crops, contrast, keyboard use, image fallback and local preview interactions are verified without overflow.
- [x] AC3: The artifact opens independently, declares fictional preview content, and leaves application source, services and current product requirements unchanged.

## Validation plan

Use Playwright/Chrome on the standalone file or an owned local static server at 375/430/768/1440 px. Inspect screenshots, check horizontal overflow, exercise keyboard controls/local filters and image fallback, and verify no application-service network requests. Validate local links and changed-file scope. Application/database tests and Next builds are not applicable because no application code or runtime contract changes.

## Implementation record

Delivered a standalone banner test page and local assets. No application implementation is authorized by this record.

### Changes and rationale

The existing Home remains unchanged. The independent test page places MovX's current slogan over an edited photograph of Tempelhofer Feld. Three nearby runners occupy the left third as a friendly group, the original person on the right is removed, and a softer blue color treatment follows the supplied reference. A restrained central overlay preserves white heading contrast without darkening the runners as heavily. Mobile separates the full group photo from the forest-colored slogan panel; desktop keeps the centered heading over a panoramic crop.

Full width / Inset buttons compare banner framing. Discipline chips, typed discipline/location search, an empty state and reset work on five explicitly fictional cards. They make the surrounding layout reviewable without connecting to real data. Boxing selects the two Boxing cards rather than also selecting Kickboxing; BJJ maps to Brazilian jiu-jitsu. The mobile result-count live region remains available to assistive technology. Sign-in, Events and coach signup show a local preview notice. Header section links and keyboard skip navigation remain within the document.

Tony Webster's original licensed photograph is preserved beside the final derivative. The page footer and supporting README identify the source, CC BY 2.0 license and edits. The Everfit reference and rejected drafts are not distributed as preview assets. Fonts/icons reuse existing installed packages with their licenses; no dependency was installed.

### Affected files

- Preview page (retired artifact: `previews/home-banner/index.html`): self-contained HTML/CSS/local JavaScript for layout, framing, sample filters, accessible controls and image fallback.
- Final banner (retired artifact: `previews/home-banner/assets/tempelhofer-feld-social-banner-v2.png`): 1746 × 901 pixel built-in imagegen edit of the real location photograph.
- Unaltered base photograph (retired artifact: `previews/home-banner/assets/tempelhofer-feld-tony-webster.jpg`): 1920 × 988 pixel Wikimedia derivative retained for provenance.
- Preview README (retired artifact: `previews/home-banner/README.md`) and executed edit prompt (retired artifact: `previews/home-banner/image-edit-prompt.txt`): launch instructions, source/author/license, edit disclosure and exact final generation instructions/mode.
- `previews/home-banner/assets/`: local Manrope/Bricolage Grotesque fonts and font/Lucide license files.
- This development record and [ticket index](../../README.md): scope, refinements, validation and completion. No `src`, database, environment or product-specification edits belong to DEV0298; concurrent account/settings changes remain separate.

### Decisions and deviations

2026-10-17: User clarified “dont implement it yet, send me maybe a test page” before any application edit. Limit delivery to an independent preview.

2026-10-17 reference inspection: the supplied banner uses a single athlete on the left, open blue sky and a centered white headline. Keep this airy outdoor mood in an original adult martial-arts warm-up image, with the athlete at the left and room for text in the center/right. Use a restrained overlay for text contrast. The requested deliverable is a standalone test page, so use a normal independent page rather than an in-conversation visualization fragment.

Preview-only framing control: allow switching between a full-width banner (default, closest to the reference structure) and an inset rounded banner, so the user can compare framing without changing any application behavior. Use only local assets/fonts and fictional filterable card examples; no external resources are needed to open the finished preview.

2026-10-17 user refinement, before completion: the first original solo warm-up photograph was generated and integrated into a draft preview. The user requested something more social to reflect group training/challenges. Replace the draft photo with a newly generated small-group outdoor training scene, preserve the slogan and independent-page scope, and verify that the crop still conveys a group at mobile and desktop widths. The first image remains a discarded design exploration, not the final asset.

Social-image layout refinement: the original group photograph clusters five adults at the left, so desktop copy occupies the open right half to keep faces clear. On narrow screens, place the complete group crop above a forest-colored copy panel rather than cropping the group down to one person. Keep the existing H1 verbatim; proposed supporting copy becomes “Train together · Berlin” and “Coaches and group training across Berlin.” No challenge capability is represented as delivered.

2026-10-17 second user refinement, before verification/completion: the generated group photograph felt too obviously artificial. The user prefers a real Berlin location in nature or the city. Replace generated photography with an authentic, source-verifiable photograph of Tempelhofer Feld (or another identifiable real Berlin public place if composition is unsuitable). Check the source's reuse terms, preserve required attribution, and label the actual place. Generated images are discarded explorations only. No image retouching or invented local scene is needed; normal page cropping/contrast treatment may adapt the real photograph.

2026-10-17 final image direction before completion: the user explicitly permits modifying the real location photograph and asks to include a subtle person/group doing sport. Keep Tony Webster's actual Tempelhofer Feld runway photograph as the edit target; add only a small distant group of runners, mostly seen from behind. Preserve the real runway, skyline, sky, existing incidental visitors and lighting. Use built-in image editing rather than compositing in code. Credit the source under CC BY 2.0 and disclose the added runners/AI-assisted alteration; do not present the final asset as an unaltered documentary photograph. Keep the real scene dominant and avoid large synthetic faces or posed foreground athletes.

2026-10-17 latest confirmed refinements: remove the existing person at the far right, lighten the image toward the reference's soft airy blue mood, and bring the three runners closer so the group spirit is visible. Keep them naturally grouped in the left third, mostly viewed from behind/three-quarter rear, with open space for the slogan. Preserve the recognizable real runway/skyline/markings, use a photographic rather than glossy advertising treatment, and disclose person removal, added runners and color treatment. For the reference-like preview, simplify the banner to the existing two-line H1 over a shallower panoramic crop; keep other copy outside the image.

Crop adjustment before integration: the closer runners need more vertical room than the reference's very shallow strip. Use a responsive 320–410 px panoramic desktop banner and a separate mobile photo/copy stack, so all three bodies stay visible; remove the extra eyebrow/subtitle from the photo. Preview validation also found that the illustrative Boxing chip matched Kickboxing through substring matching; use exact discipline matching for these local sample cards. Neither adjustment changes application behavior.

### Contracts, configuration, and operations

No application/data/dependency/environment changes. No Auth, email, migration or deployment operation. An owned static preview server may be started for visual verification.

## Validation results

2026-10-17, standalone page served with `python3 -m http.server 3188 --bind 127.0.0.1 --directory previews/home-banner`. Browser verification used installed headless Chrome through Playwright because the computer-use tool exposed no available browser. No application server, database or authentication session was used.

- `node work/dev0298/check-preview.mjs` — passed after the final image/layout and mobile live-region adjustment. This task-local verification script exercised 375/430/768/1440 px with Full width and Inset framing, exact slogan, loaded image dimensions, no horizontal overflow, Boxing/MMA-empty/reset/BJJ/location filters, keyboard Tab/Enter skip navigation, disconnected Sign in and blocked-image fallback. There were zero JavaScript errors; all 28 observed requests were local GETs, with zero external, service or mutation requests. The earlier run correctly exposed Boxing also matching Kickboxing; exact discipline matching fixed it before the successful run.
- Visual self-review of `work/dev0298/evidence/banner-{375,430,768,1440}.png` and `banner-{375,1440}-inset.png` — passed. All three runners and their feet remain in view, the headline is clear against its overlay or solid mobile panel, and search/cards fit without horizontal page overflow. The right-hand person is absent from the edited asset. The source location remains recognizable. This is visual contrast review, not a formal accessibility certification.
- `node_modules/.bin/prettier --check previews/home-banner/index.html previews/home-banner/README.md tickets/archive/frontend/DEV0298-preview-photographic-home-banner.md` — passed on the final artifact/record.
- `python3 work/dev0298/check-links.py` — passed after archiving; preview assets, Markdown/HTML/font references, fragments and ticket/index links resolve. The check caught and corrected a stale specification anchor before completion. `git diff --check` — passed. Reviewed the task-owned files against scope; unrelated shared-workspace changes were preserved.
- Application lint/type checks, unit/database tests and Next builds — not applicable: this deliverable is an independent static design proposal with no application code, dependency or runtime contract change.

| Criterion | Evidence                                                                                                                                              | Result |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Source/license provenance, final asset inspection, four-width screenshots and exact selectable H1 assertions.                                         | Passed |
| AC2       | Eight viewport/framing combinations, six inspected screenshots, local filter/error/reset flows, keyboard skip, image failure and overflow assertions. | Passed |
| AC3       | Owned static server, all-local GET request audit, fictional-content labels, local asset/link checks and changed-file scope review.                    | Passed |

## Risks, limitations, and follow-ups

The test page is a proposal and does not prove real inventory or scheduling functionality. Added runners and incidental public visitors are not represented as actual MovX coaches or participants. The final image is an AI-assisted concept derived from a real Berlin photograph, not an unaltered scene. Application adoption requires a separate user request and implementation ticket; no production integration, performance optimization or deployment is claimed.

## Completion and review references

- Completed: 2026-10-17 — preview artifact and required local verification complete.
- Commit: User authorized committing on 2026-10-17; included in `[DEV0298][DEV0300][DEV0301][DEV0302][DEV0303][DEV0304][DEV0305][DEV0306][DEV0307][DEV0308][DEV0309][DEV0310] Refine Home banners and compact coach discovery`.
- Review: Visual self-review completed at mobile/tablet/desktop widths; user design review remains open and does not imply adoption.
- Deployment or release: None — standalone preview only.
