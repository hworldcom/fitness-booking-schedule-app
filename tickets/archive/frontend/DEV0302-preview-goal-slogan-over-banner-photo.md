# Ticket DEV0302: Preview a goal slogan over the banner photo

2026-10-20 artifact retirement: the owner removed standalone design previews under [DEV0390](../../current/organisatory/DEV0390-remove-unneeded-design-previews.md). The record below preserves the original design/validation history; backticked preview paths identify retired artifacts. Runtime images/code are retained, with banner source/prompt provenance in public/images/retained-banner-provenance.json.

- Status: Completed
- Created: 2026-10-17
- Last updated: 2026-10-20
- Milestone: M3 — Public discovery design exploration
- Coordination: None — independent development ticket
- Related records: historical warm banner [DEV0301](../../archive/frontend/DEV0301-preview-coached-boxing-banner.md); original preview [DEV0298](../../archive/frontend/DEV0298-preview-photographic-home-banner.md)

## Objective and context

The user likes the warm rooftop banner and proposes “Find your coach. Achieve your goals.” while inviting alternatives. They also request that the slogan sit on the photo like the Everfit reference. The current standalone page overlays the desktop headline but uses a separate solid panel on tablet/mobile. Preview the proposed copy over the image at every size. The [current Home contract](../../../docs/mvp-spec.md#42-discover-a-coach-and-time) remains unchanged; no application implementation is authorized.

## Scope and non-goals

In scope: update only the standalone page's selectable headline, responsive overlay/crop/contrast and supporting preview documentation. Retain the existing approved warm image. Record copy alternatives as proposals, not adopted product requirements.

Out of scope: app source, product specification, production marketing copy, new generated images, discovery functionality, data/settings/calendar, dependency/config changes, publishing, deployment or commits.

## Expected behavior and edge cases

Use “Find your coach.” and “Achieve your goals.” as two selectable headline lines. Place the heading over the photograph at desktop, tablet and mobile widths. Keep the people/faces visible and text readable with a localized contrast overlay. A taller mobile crop may place the heading over the upper sky above the faces; retain the shallow desktop banner. Failed image loading leaves the heading readable against the existing color fallback. Existing local-only controls and fictional content remain unchanged.

## Assumptions, decisions, and dependencies

Confirmed: the user likes the current photograph, proposes the goal-focused line and asks for text on the picture. Adopted preview default: use their proposed wording now, pending copy selection; do not change the photograph. Suggested alternative “Find your coach. Make progress together.” emphasizes the social/human coaching concept and remains a proposal only. The prior Everfit reference's white text over a wide image is already inspected; no new source research is needed for this creative copy/layout change.

## Implementation plan

1. Inspect current responsive banner rules and reserve this follow-up without reopening archived records.
2. Replace the preview H1 text, keep overlay presentation on tablet, and introduce a readable mobile overlay above the faces rather than a separate copy panel.
3. Update preview documentation to distinguish proposed copy and current product behavior.
4. Verify image/headline placement, crops/contrast, overflow, keyboard/local controls and image fallback at mobile/tablet/desktop sizes; check links/formatting and finish/archive after evidence passes.

## Acceptance criteria

- [x] AC1: The proposed “Find your coach. Achieve your goals.” is selectable text over the photo at mobile, tablet and desktop widths; no separate slogan panel remains.
- [x] AC2: Text remains readable, faces visible, no horizontal page overflow, and keyboard/local controls/image fallback still work in both Full width/Inset framings.
- [x] AC3: The existing photo remains unchanged; documentation identifies copy as a preview proposal and no application/product-contract change is introduced.

## Validation plan

Use installed headless Chrome through Playwright on the owned static preview at 375/430/768/1440 px and both framings. Assert exact H1 and that its bounds lie within the actual photo bounds, loaded image, no overflow and retained wide desktop ratio. Inspect screenshots for readable text/faces. Reuse local-filter/keyboard/disconnected-control/failed-image/network checks. Check task-local links and formatting. App/DB tests and Next build are not applicable to this independent static preview.

## Implementation record

### Changes and rationale

Changed the standalone H1 from “Find your coach. Make time to train.” to the user's proposed “Find your coach. Achieve your goals.” as two selectable lines. Desktop keeps its existing white overlay on the wide photograph. Tablet now retains the overlay instead of a separate solid panel; mobile uses a taller crop and positions the headline over the upper sky, above both faces. A localized top gradient supports white text while keeping the people visible. The same existing photograph is used without modifying its bytes.

The README now describes the all-screen overlay and explicitly marks both the displayed slogan and the suggested social alternative as preview proposals. The actual application's slogan and product contract remain unchanged. Existing fictional cards, local filters and disconnected controls are retained.

### Affected files

- Preview page (retired artifact: `previews/home-banner/index.html`): new H1 wording and responsive overlay/crop rules; removes tablet/mobile solid copy panels and adds the mobile contrast gradient.
- Preview README (retired artifact: `previews/home-banner/README.md`): proposed copy/alternative, responsive display description and validation handoff.
- This record and [ticket index](../../README.md): plan, evidence and completion. The existing rooftop asset (retired artifact: `previews/home-banner/assets/rooftop-coach-athlete-banner-v8.png`) is unchanged. No application, product-specification, image, data or configuration edits belong to DEV0302.

### Decisions and deviations

2026-10-17: Use the user's proposed wording for review; suggest the social alternative separately. Desktop retains the current wide photo, tablet uses a slightly fuller overlay crop, and mobile may use a taller crop with the headline in the upper sky to keep faces unobscured. These are preview design choices.

### Contracts, configuration, and operations

No application/data/dependency/environment/migration changes. Reuse the existing folder-only static server; no deployment or commit requested.

## Validation results

2026-10-17, existing folder-only static server at `http://127.0.0.1:3188/`, installed headless Chrome through Playwright; no application server/database/authenticated session involved.

- `node work/dev0302/check-preview.mjs` — passed. Verified 375/430/768/1440 px with Full width and Inset framing, exact proposed H1, headline bounds inside the actual photograph bounds in all eight combinations, loaded image and retained 4.5:1 desktop ratio, no page overflow, local Boxing/MMA empty/reset/BJJ/location filters, Tab/Enter skip navigation, disconnected Sign in and blocked-image fallback. Zero JavaScript errors; all 28 observed requests were local GETs, with zero external/service/mutation requests.
- Visual self-review of `work/dev0302/evidence/banner-{375,430,768,1440}.png`, `banner-{375,1440}-inset.png` and `rooftop-banner.png` — passed. The H1 is over the photo at each size, both faces remain clear, and white text is readable against the localized overlay. No separate copy panel remains. This is visual contrast review, not formal accessibility certification.
- `shasum -a 256 previews/home-banner/assets/rooftop-coach-athlete-banner-v8.png` before and after the change returned the same `7072b19d6bfe749bd67d45d5fdaa84826a92031315d9a00ec216a47dd0d9a45f` digest, confirming unchanged photo bytes.
- `python3 work/dev0302/check-links.py` — passed after archiving: task-local file/font references, Markdown/HTML fragments and the new archive/index entry resolve.
- `node_modules/.bin/prettier --check previews/home-banner/index.html previews/home-banner/README.md tickets/archive/frontend/DEV0302-preview-goal-slogan-over-banner-photo.md` and `git diff --check` — passed on the final artifact/record. Reviewed task-owned scope; no app or product-contract edits.
- Application lint/type checks, unit/database tests and Next build — not applicable to this standalone static copy/layout proposal. No production integration or deployment is claimed.

| Criterion | Evidence                                                                                                                      | Result |
| --------- | ----------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Exact copy assertions and photo-contained headline bounds in eight viewport/framing combinations, plus inspected screenshots. | Passed |
| AC2       | Visual face/contrast checks, no overflow, keyboard/local-control and failed-image checks.                                     | Passed |
| AC3       | Unchanged photo digest, explicit proposed-copy documentation, local-link and changed-file scope review.                       | Passed |

## Risks, limitations, and follow-ups

Creative copy and layout remain proposed. The original generated rooftop is fictional, not an actual venue or MovX session. Any application adoption needs a separate user request and implementation ticket.

## Completion and review references

- Completed: 2026-10-17 — proposed copy/all-screen photo overlay delivered and locally verified.
- Commit: User authorized committing on 2026-10-17; included in `[DEV0298][DEV0300][DEV0301][DEV0302][DEV0303][DEV0304][DEV0305][DEV0306][DEV0307][DEV0308][DEV0309][DEV0310] Refine Home banners and compact coach discovery`.
- Review: Visual self-review complete; user copy/design selection remains open. No independent review.
- Deployment or release: None — standalone preview only.
