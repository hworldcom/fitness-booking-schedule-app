# Ticket DEV0301: Preview a warm coached boxing banner

- Status: Completed
- Created: 2026-10-17
- Last updated: 2026-10-17
- Milestone: M3 — Public discovery design exploration
- Coordination: None — independent development ticket
- Related records: historical banner variants [DEV0298](../../archive/frontend/DEV0298-preview-photographic-home-banner.md) and [DEV0300](../../archive/frontend/DEV0300-refine-sky-and-group-banner-framing.md)

## Objective and context

Refine the independent banner proposal around coached boxing. The initial request introduced supervised boxing and rope activities; the user then simplified the people, requested a wider banner, and supplied a new warm rooftop coach/athlete reference. The current iteration creates an original scene with that atmosphere and setting. The user's earlier instruction remains preview only; the [current Home contract](../../../docs/mvp-spec.md#42-discover-a-coach-and-time) does not change.

## Scope and non-goals

In scope: a new original built-in imagegen concept based on the latest reference's warm coaching atmosphere, its exact prompt/provenance, and asset/crop/contrast changes in the existing standalone page. Retain earlier assets/prompts and completed records, including the intermediate activity edits.

Out of scope: application source, production integration, real coaches/events, discovery functionality, data/settings/calendar, publishing, deployment and commits.

## Expected behavior and edge cases

Create a warm candid moment between a fictional coach and boxing athlete in an outdoor rooftop ring, with natural upper-body/facial views, gentle evening light and a softly blurred city backdrop. Keep a wide shallow banner with the pair at the left and clear background for the existing selectable slogan. The reference guides atmosphere and setting, not exact people or a copied image. Do not identify the generated rooftop as an actual Berlin venue or attach the older photograph's author credit to the new scene. Preserve readable mobile/desktop framing, keyboard/local-only controls and image fallback; disclose the illustrative image.

## Assumptions, decisions, and dependencies

Confirmed latest direction: use the supplied rooftop boxing reference's atmosphere and setting; earlier wide-banner, upper-body and readable-faces preferences persist. Adopted preview interpretation: focus on one relaxed coach/athlete interaction, with warm light and soft urban background, rather than retain the earlier busier multi-activity arrangement. Exact count, clothing, identities and composition of this new reference-based concept are proposed design choices. Create different fictional adults and a new scene; do not remove watermarks from or distribute the reference photo. Keep the earlier licensed photo derivatives and their source/author/CC BY 2.0 attribution separate from the new generated asset.

## Implementation plan

1. Inspect the latest sky-led preview and reserve this follow-up ticket; preserve archived work.
2. Use built-in imagegen for the evolving proposal; after the latest reference, create an original warm rooftop coach/athlete scene with upper-body faces and a wide composition. Preserve earlier drafts as history.
3. Save a sibling asset and exact prompt; update only the standalone page and provenance, adapting crops if needed so both groups remain visible.
4. Inspect mobile/desktop results, verify local controls/keyboard/fallback/no overflow, check task-local links/formatting and finish/archive the record when all criteria pass.

## Acceptance criteria

- [x] AC1: The new original image conveys the supplied reference's warm, relaxed coach/boxing-athlete atmosphere and outdoor rooftop/city setting, with clear upper-body/facial views.
- [x] AC2: The page uses a wide shallow desktop banner, keeps people visible and the existing slogan readable at mobile/desktop widths, with no page overflow and working keyboard/local controls/image fallback.
- [x] AC3: Previous variants/prompts remain available; the new edit/prompt and attribution are recorded; no application or product-contract change is introduced.

## Validation plan

Use installed Chrome through Playwright on the owned static preview at 375/430/768/1440 px with Full width/Inset framings. Inspect desktop/mobile screenshots for faces, warm coaching atmosphere, clear slogan and the wide desktop ratio; check image/heading/overflow, existing local filters, keyboard skip, disconnected controls, failed-image fallback and local-only GET requests. Check local links and formatting. Application/DB tests and Next builds are not applicable to an independent static proposal.

## Implementation record

### Changes and rationale

The independent preview now shows an original warm rooftop scene: a coach and boxing athlete talking between rounds, with clear faces/gloves, soft evening light and an urban background. The user's latest reference superseded the earlier multi-activity drafts; those variants remain available as history. The supplied stock photograph is not distributed or cleaned for use, and the fictional generated rooftop is not represented as a documented Berlin venue.

The desktop banner uses a 4.5:1 display crop of a 2172 × 724 pixel source, with the pair on the left and the unchanged two-line slogan over open background on the right. The 4.5:1 ratio is close to the earlier requested Everfit shape and preserves both faces and the visible gloves. Tablet/mobile use fuller photo crops above a solid forest-colored slogan panel. The search bar now follows the banner rather than overlapping the photo. Existing fictional cards/local controls are retained; no real product behavior changed.

The footer identifies the current scene as an original generated concept and links to the image history. The README separates its provenance from Tony Webster's earlier licensed photograph derivatives and preserves the latter's attribution/license/edit disclosures. All fonts/icons remain local; no dependency was added.

### Affected files

- [Preview page](../../../previews/home-banner/index.html): new source/alt text, wide desktop composition, responsive photo/copy framing, contrast overlay, search spacing and accurate fictional-scene disclosure; removed the obsolete Tempelhofer Feld place label.
- [Current rooftop image](../../../previews/home-banner/assets/rooftop-coach-athlete-banner-v8.png): original generated scene with a subsequent framing edit; no stock-reference asset is shipped.
- [Original scene prompt](../../../previews/home-banner/image-prompt-rooftop-v7.txt) and [final framing prompt](../../../previews/home-banner/image-edit-prompt-rooftop-v8.txt): exact built-in generation/edit instructions and input roles.
- [Preview README](../../../previews/home-banner/README.md): current image provenance, native/display ratios, viewing instructions, retained draft links and separate earlier-photo attribution.
- Intermediate [v4 training](../../../previews/home-banner/assets/tempelhofer-feld-coached-training-v4.png), [v5 coaching pairs](../../../previews/home-banner/assets/tempelhofer-feld-coached-pairs-v5.png), their `image-edit-prompt-v4-initial.txt`, `image-edit-prompt-v4.txt`, `image-edit-prompt-v5.txt` files, and previous v2/v3/base assets are preserved in the same preview folder.
- This record and [ticket index](../../README.md): scope/refinement history, validation and completion. No application source, product specification, database, environment or dependency changes belong to DEV0301.

### Decisions and deviations

2026-10-17: Preserve the approved sky-led direction while replacing the activity. Use two coaches, one for each activity, as a reasonable interpretation of both groups being supervised. Keep this as an independent design preview.

2026-10-17 user refinement during implementation: the first boxing/rope edit felt fake and too crowded. Before integrating it, create a further edit with more breathing room between activities, irregular spacing and modest depth differences. Avoid the initial giant foreground pair versus small background figures, synchronized poses and lineup effect. Preserve both coaches, a readable rope, the preferred sky and the independent-page scope. Adjust text placement/crops to the actual wider group distribution rather than crowding people around the slogan.

Preview layout adjustment before integration: the looser training area spans most of the lower frame. Keep the heading in the open upper-right sky, use a mobile crop that retains both activities/coaches, and place the search bar below the image instead of overlapping the rope/feet. Move the small mobile place label to the open top-right sky. These changes apply only to the independent proposal.

2026-10-17 latest user refinement before completion: simplify to two coach/client pairs, bring them closer, show facial features and return to upper-body framing. Remove the two additional boxing athletes from the spread-out draft. The requested waist/upper-body crop supersedes the earlier full-body/complete-rope-loop preference; preserve readable gloves/pads, both rope handles and visible rope side arcs. Keep relaxed spacing between pairs, natural skin/detail and the preferred sky. The prior v4 browser check passed but describes a superseded draft, so verify the final v5 image/crop separately.

Final crop plan before v5 integration: the four larger figures occupy most of the left/center image. Use the clear far-right sky for a smaller desktop slogan; on tablet/mobile, separate photo and solid-color slogan panel so no face is obscured. Keep the entire panorama through tablet and a mild left-aligned mobile crop that retains all four faces and both activities. This resolves composition within the standalone test page only.

2026-10-17 latest framing request before completion: make the picture longer like the Everfit reference. Extend the two-pair concept horizontally toward a shallow 5:1 banner by adding matching sky/runway continuation to the right, preserving people proportions and upper-body views. Do not squeeze the people or achieve the shape by cutting their faces out. The reference's 4000 × 800 image is an aspect/layout guide only and is not distributed. Save a sibling wide asset/prompt, adapt the standalone banner to its actual ratio, and verify the final crop separately from the superseded v5 checks.

2026-10-17 new user visual direction before completion: the user supplied a stock-photo reference and asked for a similar atmosphere and setting. Adopt a new original scene inspired by its relaxed coach/athlete conversation, outdoor rooftop boxing ring, warm evening light, upper-body facial detail and softly blurred city backdrop. This supersedes the active-drill/rope arrangement and literal Tempelhofer Feld setting for the next concept. Use different fictional people and composition, not a cleaned copy of the watermarked reference. Keep the wide banner goal, clear coaching relationship and space for the existing slogan. Do not claim the generated rooftop is a documented real Berlin venue. Keep older real-photo variants and their provenance separate, and revise page labels/credits so Tony Webster's attribution is not attached to the new original image.

Final framing preparation: built-in generation returned a roughly 3:1 raster even when the prompt requested 5:1. Prepare the subjects within a shallower central strip, leaving extra headroom/background, then use a 5:1 desktop display crop without losing either face or the gloves. Keep a fuller responsive crop on smaller screens. This is page presentation of an original generated concept, not stretching or a deterministic image-file edit.

Final measured layout choice: use a 4.5:1 desktop display crop rather than a strict 5:1, to retain the coach's hair/face and the athlete's visible gloves. The source file remains 2172 × 724; its intrinsic ratio is not described as 5:1. The warmer rooftop reference now drives the current proposal; blue-sky/runway activity drafts are superseded and retained only for comparison/history.

### Contracts, configuration, and operations

No application/data/dependency/environment/migration change. Reuse the owned folder-only static server. No deployment or commit requested.

## Validation results

2026-10-17, owned folder-only static server at `http://127.0.0.1:3188/`, installed headless Chrome through Playwright. No application server, database or authenticated session was used.

- `node work/dev0301/check-preview.mjs` — passed for the final rooftop image/layout. Checked 375/430/768/1440 px with Full width and Inset framing; exact selectable H1; loaded 2172-pixel source; measured desktop banner ratio 4.5:1; no horizontal overflow; Boxing/MMA empty/reset/BJJ/location filters; Tab/Enter skip navigation; disconnected Sign in; blocked-image fallback. Zero JavaScript errors and zero external/service/mutation requests; all 28 observed requests were local GETs. Earlier v4/v5 runs passed but were superseded and are not used as proof of this final scene.
- Visual self-review of `work/dev0301/evidence/banner-{375,430,768,1440}.png`, `banner-{375,1440}-inset.png` and `rooftop-banner.png` — passed. Warm rooftop/ring setting and relaxed coaching interaction are clear; both faces and the boxing gloves remain visible; the slogan stays readable without covering people. Mobile/tablet show fuller framing. This is visual contrast review, not formal accessibility certification.
- `python3 work/dev0301/check-links.py` — passed after final archiving: task-local file/font references, Markdown/HTML fragments, current/earlier image/prompt links and the archived ticket/index entry resolve.
- `node_modules/.bin/prettier --check previews/home-banner/index.html previews/home-banner/README.md tickets/archive/frontend/DEV0301-preview-coached-boxing-banner.md` and `git diff --check` — passed on the final artifact/record. Reviewed task-owned preview/record changes against scope; application source and specification are unchanged by this work.
- Application lint/type checks, unit/database tests and Next builds — not applicable to this standalone static proposal. User acceptance, application adoption and production deployment are not inferred from these checks.

| Criterion | Evidence                                                                                                                                              | Result |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Original source and seven inspected page/banner screenshots show the new warm rooftop coaching concept.                                               | Passed |
| AC2       | Eight viewport/framing combinations, measured wide ratio, local filters, keyboard, fallback and overflow checks; readable inspected screenshots.      | Passed |
| AC3       | Previous versions retained, exact new prompts and separate provenance/attribution, task-local link checks, local-only request audit and scope review. | Passed |

## Risks, limitations, and follow-ups

The new image is an original generated concept, not an actual venue or MovX event; earlier Berlin-photo derivatives remain separately attributed. User design acceptance and any application adoption remain separate.

## Completion and review references

- Completed: 2026-10-17 — final warm rooftop preview and required local verification complete.
- Commit: User authorized committing on 2026-10-17; included in `[DEV0298][DEV0300][DEV0301][DEV0302][DEV0303][DEV0304][DEV0305][DEV0306][DEV0307][DEV0308][DEV0309][DEV0310] Refine Home banners and compact coach discovery`.
- Review: Visual self-review complete; user design review remains open. No independent review.
- Deployment or release: None — standalone preview only.
