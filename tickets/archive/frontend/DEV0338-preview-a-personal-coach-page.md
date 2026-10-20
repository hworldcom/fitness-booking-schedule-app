# Ticket DEV0338: Preview a personal coach page

2026-10-20 artifact retirement: the owner removed standalone design previews under [DEV0390](../../current/organisatory/DEV0390-remove-unneeded-design-previews.md). The record below preserves the original design/validation history; backticked preview paths identify retired artifacts. Runtime images/code are retained, with banner source/prompt provenance in public/images/retained-banner-provenance.json.

- Status: Completed
- Created: 2026-10-18
- Last updated: 2026-10-20
- Milestone: M10 design review before coach website editing
- Coordination: None — independent development ticket
- Related records: Downstream editor [DEV0315](DEV0315-edit-and-preview-coach-websites.md), cards [DEV0316](DEV0316-redesign-coach-directory-cards.md), full public page [DEV0317](DEV0317-build-shareable-personal-coach-websites.md); context [COR0028](../../current/organisatory/COR0028-coach-marketplace-cards-and-personal-websites.md). Historical standalone design approach: [DEV0304](../../archive/frontend/DEV0304-preview-photo-collage-banners.md).

## Objective and context

The user authorized starting the coach website editor but explicitly requested an example coach page first. Provide a concrete standalone visual proposal for review before editing the live editor/page. Follow [specification section 19](../../../docs/mvp-spec.md#19-coach-marketplace-cards-and-personal-websites); this preview does not adopt a new product contract or deliver DEV0315/DEV0317 runtime scope.

## Scope and non-goals

- In scope: local responsive HTML/CSS/JavaScript example with existing MOVX typography/colors, illustrative banner/portrait, coach introduction, approach/experience, current one-hour private format, optional starting price, locations, public reviews, FAQs and availability/contact actions. Add local-only comparison controls for hidden price, missing media and unavailable reviews so error/empty states can be reviewed.
- Out of scope: live routes/editor, backend/Storage/Auth APIs, real booking/message/share mutations, migrations, changes to retained demo-coach data, invented service types/durations, gallery/video/premium decisions and final design adoption.

## Expected behavior and edge cases

A clear concept notice labels all identity/content/pricing/times/reviews as fictional. Public-facing content remains readable on phone and desktop; section links, FAQ disclosure and demo dialogs work with keyboard/Escape/focus return. Availability/contact controls explain that no request/message is sent. An undisclosed price disappears; missing banner/portrait and unavailable/empty reviews remain distinct. No form submits, external requests or persisted settings occur. Optional visual examples do not imply real verified credentials or attendance.

## Assumptions, decisions, and dependencies

Adopt a first proposal using a wide training banner, prominent portrait/introduction, unobstructive sticky section links and a desktop availability/contact card that becomes normal-flow content on phones. Reuse unchanged application-owned fictional artwork and local font files through an exact-path loopback asset server; serve no environment files or repository-wide directory. All sample values are design fixtures, not a read or rewrite of existing Daniel Park data. Public page implementation remains after cards under the existing plan. DEV0315 stays Draft while this requested design review is prepared; no extra approval policy is introduced.

## Implementation plan

1. Reserve this ticket and index entry; record the user's preview-first direction in DEV0315 before implementation edits.
2. Create `previews/coach-page/` with a self-contained page, scoped styling and local-only presentation interactions, reusing existing unchanged images/fonts.
3. Add a small loopback server with an exact static-file allowlist and a concise preview guide; avoid exposing the repository or service credentials.
4. Inspect phone/desktop layouts and keyboard navigation/dialog/fallback states in the browser; run syntax/format/static checks appropriate to a standalone prototype.
5. Record actual evidence and limitations, archive this preview ticket only when its checks pass, and deliver the example link for design feedback. Editor/public runtime tickets retain their own criteria.

## Acceptance criteria

- [x] AC1: A locally openable, clearly fictional coach-page proposal demonstrates the agreed public sections without implementing live product flows or changing retained data.
- [x] AC2: Desktop and phone layouts remain readable, with keyboard section links, FAQs and local demo dialogs, Escape/focus return, and usable primary actions.
- [x] AC3: Hidden price, missing banner/portrait and empty/unavailable review examples are truthful, and all controls remain local with no API/persistence effects.
- [x] AC4: Existing image/font bytes remain unchanged, the loopback server exposes only its exact allowlist, and commands/observations/proposal boundaries are documented.

## Validation plan

Use native browser inspection at desktop and phone widths, including section navigation, keyboard score/FAQ/buttons as relevant, demo-dialog focus/Escape, long text, hidden-price/media/review switches and no horizontal overflow. Verify JavaScript/server syntax, scoped formatting, exact local asset links/server routes, rejected path traversal and unsupported writes. Hash the reused source assets before/after. App tests, database tests and a Next build are not needed because this standalone proposal edits no application/runtime/database source; document that limit explicitly. Do not infer product validation from a design preview.

## Implementation record

### Changes and rationale

Added an independently served coach-page proposal for fictional Alex Rivera. It follows the existing MOVX palette/typefaces and shows a training banner, overlapping portrait, introduction, current one-hour private format, coach approach/experience, all example locations, availability, sample reviews and native FAQ disclosures. The desktop availability/contact card overlaps the banner’s unused right side so the primary action is visible in the first viewport; on phones it moves into normal flow and a bottom action bar keeps availability accessible. Native section anchors and a sticky section strip support browsing the long page.

The preview uses existing unchanged image/font files rather than generating or uploading assets. All text/rating/time values are fixtures, clearly labelled as a concept and examples. Local options compare disclosed/hidden price, absent banner/portrait and sample/empty/unavailable reviews. Sample time/contact/share/account/group actions only open explanatory dialogs; no booking/message/account/publication is changed. The two example ratings are both five, matching the displayed fictional mean of 5.0. No gallery/video allowance or variable-duration decision was added.

### Affected files

| File | Role |
| --- | --- |
| index.html (retired artifact: `previews/coach-page/index.html`) | Semantic, explicitly fictional public coach-page composition, local controls and native dialogs/FAQ disclosures. |
| styles.css (retired artifact: `previews/coach-page/styles.css`) | Existing local font references, cream/forest styling, responsive layout, sticky navigation/actions, focus and reduced-motion support. |
| preview.js (retired artifact: `previews/coach-page/preview.js`) | Local-only state comparisons, sample day/time selection, dialog/focus return and section highlighting; no API or persistent storage. |
| serve.mjs (retired artifact: `previews/coach-page/serve.mjs`) | Loopback-only exact eight-route static allowlist, restrictive content policy, rejected writes and no repository directory serving. |
| Preview guide (retired artifact: `previews/coach-page/README.md`) | Launch command, source-image/font provenance, disconnected controls and proposal boundaries. |
| This record, [ticket index](../../README.md) and [DEV0315](DEV0315-edit-and-preview-coach-websites.md) | Plan, evidence, archive and the explicit preview-first/editor-later handoff. |

### Decisions and deviations

2026-10-18: user requested an example before editor implementation. This independent design ticket owns the proposal; it is a downstream design input, not a new direct COR deliverable or premature live-page implementation. All design choices remain proposals pending feedback.

Browser review moved the desktop contact card upward to expose its primary action above the fold and moved decorative banner copy out of its way. Phone inspection found and corrected a missing space when the card title’s line break is suppressed, an icon-only Messages button label and the concept notice’s phone visibility. The visual banner fallback is also hidden from accessibility when the image is present. No material departure from the preview-only plan occurred.

### Contracts, configuration, and operations

No product interface, schema, dependency, environment, provider, migration or retained-record changes. Start from the repository root with `node previews/coach-page/serve.mjs`, then visit `http://127.0.0.1:3190/`; Ctrl-C stops that process. It binds only to loopback and serves eight exact static routes; HEAD is supported, writes return 405, unknown/traversal paths return 404. Content policy forbids service connections and form submission. The server does not read environment files or any database/account. All example actions remain disconnected and presentation changes reset on reload. Removing this preview requires no application/data rollback. No secrets belong in the preview or record.

## Validation results

- Environment: 2026-10-18, Node 24.21.0, native Chrome desktop 1390×768 and Safari responsive mode 390×844. Both browsers loaded the existing local images/fonts. Desktop screenshot inspection showed the primary availability action beside the identity/hero; phone inspection showed readable single-column content and persistent bottom availability action without observed page-level clipping. Section navigation intentionally scrolls horizontally on narrow screens; no programmatic DOM measurements are claimed.
- `node --check previews/coach-page/preview.js` and `node --check previews/coach-page/serve.mjs`: passed. `npx prettier --check previews/coach-page`: passed. Task-local `git diff --check` and relative links/HTML fragment targets passed.
- A direct Node HTTP/static validation against the loopback preview passed **25 checks**: eight allowed pages/assets byte-for-byte, no-store/content-policy protections, eight unknown/traversal/app/environment-looking routes rejected with 404, POST/PUT/DELETE rejected with 405, HEAD with no body, four original image/font bytes equal their committed versions, and no fetch/socket/beacon/browser-storage use in preview interaction source. Evidence: `/tmp/movx-dev0338-static.log` and ignored `work/dev0338/static-validation.json` (source hashes only).
- Original asset SHA256 values: banner `7072b19d6bfe749bd67d45d5fdaa84826a92031315d9a00ec216a47dd0d9a45f`; portrait `e25cfbd6b168523cf850ee5431123e6b9cf107e42d146af81492912bfe468f3a`; Manrope `a30ddcd349703aff7464c34bef3fffdff405ee50c113440d7c8693c02d210972`; Bricolage `a756882d8a7802ebd4663b4544a62ebedafc7227c1c159ab95eea61393af3f8e`. The server reads these exact existing files; no duplicate binaries or artwork changes were introduced.
- Native Chrome: opened the concept separately from the user’s workspace; toggled price/banner/portrait off and observed a contact-for-pricing message, readable banner fallback and portrait initials. The No reviews yet selection removed the sample score. Later user activity interrupted Chrome selections; verification continued in Safari without operating the live workspace.
- Native Safari phone: used the fixed Available times link to reach the calendar, selected Tuesday by keyboard and opened 10:00–11:00. The local dialog showed the chosen day/time/location and explicitly confirmed no request was sent. Escape closed it; Return reopened the same time, proving focus returned to its trigger. FAQ disclosure opened with the native control and Return closed it.
- Native Safari fallbacks: selected unavailable reviews by keyboard, saw a distinct error with no sample score, and Retry example restored only the local sample. Hidden price removed the numeric price from the visible phone page/action bar; missing media retained identity/contact/fallback. Reload restored initial sample values/images and reset presentation-only changes. Exited responsive mode and left the default concept open at the top of its own Safari tab.
- Earlier environment/check attempts: the first loopback launch approval review timed out; its permitted retry started successfully. The first static asset comparison hit the command runner’s default 1 MiB output buffer for the existing 1.8 MiB banner; reran with a bounded 4 MiB buffer and all 25 checks passed. Neither failure changed assets/data. Browser observations above distinguish actual checks from interrupted selections.
- Not applicable: application/unit/database suites, Next build, real Auth/Storage/booking/message flows, hosted rollout and full runtime multi-viewport acceptance. This change edits no application/database code; the standalone prototype is design evidence only.

| Criterion | Evidence | Result |
| --- | --- | --- |
| AC1 | Standalone page, explicit fictional labels, local-only dialogs/source and exact allowlist; no app/data edits. | Passed |
| AC2 | Actual desktop/390 px phone inspection, availability navigation/time dialog, Escape/focus return and keyboard FAQ. | Passed |
| AC3 | Actual hidden-price/media and empty/unavailable/retry review comparisons; reload reset; no connections/storage in source and restrictive policy. | Passed |
| AC4 | Four source assets match committed bytes; 25 server/static checks, syntax/format/link checks and launch/proposal guide. | Passed |

## Risks, limitations, and follow-ups

The preview’s implementation/validation is complete; design acceptance is still pending. Runtime editing, true availability/reviews, publication gates and metadata/sharing stay in DEV0315–DEV0319. Gallery/video decisions remain deferred until cards complete. The static example’s sample prices/reviews do not prove production privacy or review authority. The temporary loopback process remains available for review and can be stopped with Ctrl-C. Next action: collect feedback on this example before changing the live editor or adopting its layout.

## Completion and review references

- Completed: 2026-10-18 — standalone proposal and required local checks passed; no design acceptance or live feature delivery is claimed.
- Commit: User requested the standalone design checkpoint on 2026-10-18. Commit subject: `[DEV0338] Add the coach page design example`. This reference update preserves the original proposal/validation history; subsequent design approval and runtime work are recorded in DEV0315.
- Review: Local scope/visual/keyboard/static self-review; no independent review or user design acceptance.
- Deployment or release: None; local design preview only.
