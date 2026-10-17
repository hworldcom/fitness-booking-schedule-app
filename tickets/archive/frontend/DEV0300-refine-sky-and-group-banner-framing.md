# Ticket DEV0300: Refine sky and group banner framing

- Status: Completed
- Created: 2026-10-17
- Last updated: 2026-10-17
- Milestone: M3 — Public discovery design exploration
- Coordination: None — independent development ticket
- Related records: historical preview baseline [DEV0298](../../archive/frontend/DEV0298-preview-photographic-home-banner.md)

## Objective and context

Refine the standalone banner proposal after the user preferred the latest sky and requested a closer view of the people, similar to the earlier second image. The preview currently crops much of the sky out of the desktop banner. Create a sky-led composition with a nearer social running group, while preserving the user's preview-only instruction. The [Home product contract](../../../docs/mvp-spec.md#42-discover-a-coach-and-time) remains unchanged.

## Scope and non-goals

In scope: one sibling image edit of the existing Tempelhofer Feld concept, a matching crop/overlay in the independent test page, and updated prompt/provenance and validation records. Preserve the previous asset, prompt and archived ticket as history.

Out of scope: application source, production assets, data/settings/calendar, new discovery functionality, publishing, deployment or committing.

## Expected behavior and edge cases

The soft blue sky and warm cloud detail dominate the background, with a narrow real-location horizon/runway strip. Three nearby friends run together at the left, with a closer natural upper-body/three-quarter crop rather than tiny full-body figures. Keep the right-hand person removed and leave room for the existing selectable slogan. Adapt the preview framing so the sky remains prominent on desktop and the group remains visible on mobile. Preserve readable text and image-failure fallback. Existing fictional filters and local-only controls keep working.

## Assumptions, decisions, and dependencies

Confirmed: the latest sky is preferred; focus on the sky and bring the people closer; prior preview-only authorization persists. Adopted interpretation of “second picture”: use its closer group framing as reference, without restoring the rejected glossy posed appearance, extra people or equipment. Keep three runners, natural rear/three-quarter views, and candid interaction. Recompose the lower part rather than zooming the entire image and losing the sky. Continue to credit Tony Webster's CC BY 2.0 base photograph and disclose the AI-assisted people, removal, tonal and framing changes. This edited concept does not document an actual MovX event.

## Implementation plan

1. Inspect the latest image and earlier closer-group reference; reserve a new record rather than rewriting completed DEV0298.
2. Use built-in imagegen to create a wide sky-led sibling variant, preserving the approved sky mood and recognizable Berlin runway.
3. Update only the independent page's asset/crop/contrast and supporting provenance; retain previous image/prompt.
4. Inspect mobile/desktop screenshots, verify framing, text, keyboard and failed-image behavior, and check local links and change scope. Complete/archive after required evidence passes.

## Acceptance criteria

- [x] AC1: The new variant prominently shows the approved sky mood with a noticeably closer three-person running group at the left; the right-hand person remains removed.
- [x] AC2: The standalone page keeps the slogan readable, the sky/group visible and no horizontal overflow at mobile/desktop widths; keyboard, local controls and image fallback remain usable.
- [x] AC3: The prior asset/prompt are preserved, the new asset/prompt and attribution are documented, and the application/current product contract remain unchanged.

## Validation plan

Use installed Chrome through Playwright on the owned static server at 375/430/768/1440 px with both page framings. Inspect mobile/desktop screenshots and run focused checks for heading/image/overflow, local sample filters, keyboard skip, disconnected controls, image fallback and absence of external/service/mutation requests. Check task-local links and formatting. No application/database tests or Next build apply to this standalone static proposal.

## Implementation record

### Changes and rationale

Created a 2172 × 724 pixel sibling edit with the preferred soft blue sky and peach-lit clouds dominating the background. The three runners now appear in a near foreground crop with natural side/rear interaction; the horizon and real runway occupy a narrow lower strip. The right-hand person remains absent. The older v2 asset and its exact prompt remain untouched.

The standalone page now loads the wider v3 image. Its desktop heading occupies the open right-hand sky rather than covering the larger group. A localized blue contrast overlay leaves the left-hand image brighter. Tablet and mobile use left-aligned crops to retain all three heads and upper bodies; mobile retains the separate forest-colored slogan panel. The existing slogan, fictional discovery examples and local-only controls are unchanged. The footer and README now disclose the additional reframing.

### Affected files

- [Preview page](../../../previews/home-banner/index.html): v3 asset reference, actual dimensions/alt text, desktop text placement, responsive crop/overlay and updated edit disclosure.
- [Sky/group image](../../../previews/home-banner/assets/tempelhofer-feld-sky-group-v3.png): new built-in imagegen derivative; the previous [v2 image](../../../previews/home-banner/assets/tempelhofer-feld-social-banner-v2.png) is retained.
- [Executed v3 prompt](../../../previews/home-banner/image-edit-prompt-v3.txt): complete instructions and input roles, alongside the unchanged [previous prompt](../../../previews/home-banner/image-edit-prompt.txt).
- [Preview README](../../../previews/home-banner/README.md): current/previous version links, source/license and edit provenance, viewing instructions and validation handoff.
- This record and [ticket index](../../README.md): scope, evidence and archived completion. No source/application, product specification, database, environment or dependency changes belong to DEV0300.

### Decisions and deviations

2026-10-17: Continue the built-in imagegen workflow; the previous archived ticket remains historical. A panoramic image tailored to the banner should avoid the previous crop's loss of the approved sky. The earlier second image is a proximity reference only.

The final edit's closer group occupies approximately the left 40–45% rather than a strict left third. A 46%/54% desktop column split gives the existing slogan clear space to the right while retaining the requested close view. The approved blue/warm-cloud mood remains visible across the backdrop; no large frontal portrait or extra equipment was introduced. These are preview composition choices, not adopted application design.

### Contracts, configuration, and operations

No application/data/dependency/environment/migration changes. The existing owned static server serves only the preview folder. No deployment or commit requested.

## Validation results

2026-10-17, owned static preview at `http://127.0.0.1:3188/`, installed headless Chrome through Playwright. The page uses no application server, database or authenticated session.

- `node work/dev0300/check-preview.mjs` — passed. Reused the task-local preview verification with the new image/dimensions and evidence directory. Checked 375/430/768/1440 px with Full width and Inset framing; exact selectable H1; loaded 2172-pixel image; no horizontal overflow; Boxing/MMA empty/reset/BJJ/location filters; Tab/Enter skip navigation; disconnected Sign in; blocked-image fallback. Zero JavaScript errors and zero external/service/mutation requests; all 28 observed requests were local GETs.
- Visual self-review of `work/dev0300/evidence/banner-{375,430,768,1440}.png` and `banner-{375,1440}-inset.png` — passed. The sky remains prominent, all three heads/upper bodies are visible, the low horizon remains present, and the heading remains readable without covering faces. Foreground lower-body cropping is intentional. This is visual contrast review, not formal accessibility certification.
- `python3 work/dev0300/check-links.py` — passed after archiving: task-local file/font references, Markdown/HTML fragments and the new archived ticket/index entry resolve. Previous image/prompt and the historical DEV0298 record remain available.
- `node_modules/.bin/prettier --check previews/home-banner/index.html previews/home-banner/README.md tickets/archive/frontend/DEV0300-refine-sky-and-group-banner-framing.md` and `git diff --check` — passed on the final artifact/record. Reviewed only task-owned preview/record changes; concurrent account/settings work was preserved.
- Application lint/type checks, unit/database tests and Next builds — not applicable to this static proposal; no application runtime code or contract changed. No production deployment or user acceptance is inferred from these checks.

| Criterion | Evidence                                                                                                               | Result |
| --------- | ---------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Generated asset and six inspected screenshots show the sky-led backdrop, closer group and no right-hand person.        | Passed |
| AC2       | Eight viewport/framing combinations and local/keyboard/fallback checks; readable screenshots and no overflow.          | Passed |
| AC3       | Sibling asset/prompt, previous files retained, attribution and local-link checks, request audit and task-scope review. | Passed |

## Risks, limitations, and follow-ups

An illustrative AI-assisted edit of a real Berlin photograph; no claim of actual MovX participants. Design acceptance and any application implementation remain separate.

## Completion and review references

- Completed: 2026-10-17 — refined preview delivered and required local checks complete.
- Commit: User authorized committing on 2026-10-17; included in `[DEV0298][DEV0300][DEV0301][DEV0302][DEV0303][DEV0304][DEV0305][DEV0306][DEV0307][DEV0308][DEV0309][DEV0310] Refine Home banners and compact coach discovery`.
- Review: Visual self-review complete; user design review remains open. No independent review.
- Deployment or release: None — standalone preview only.
