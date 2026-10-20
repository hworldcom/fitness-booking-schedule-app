# Ticket DEV0359: Preview athlete and coach How it works

2026-10-20 artifact retirement: the owner removed standalone design previews under [DEV0390](../organisatory/DEV0390-remove-unneeded-design-previews.md). The record below preserves the original design/validation history; backticked preview paths identify retired artifacts. Runtime images/code are retained, with banner source/prompt provenance in public/images/retained-banner-provenance.json.

- Status: Completed
- Created: 2026-10-19
- Last updated: 2026-10-20
- Milestone: Public marketplace design review
- Coordination: None — independent development ticket
- Related records: Independently queued palette DEV0350 in the [reservation register](../../README.md#reserved-identifiers); historical standalone preview [DEV0338](DEV0338-preview-a-personal-coach-page.md); commit packaging [DEV0364](DEV0364-isolate-group-minimum-styles-for-commit.md).

## Objective and context

The user requests a visual preview of a friendlier How it works page before adopting the design. Explain private and group training separately for athletes and coaches, with easy section navigation and the recently adopted white/purple colors. The user explicitly retains the existing maximum of 100 group participants. Follow the [public presentation contract](../../../docs/mvp-spec.md#42-discover-a-coach-and-time), [group lifecycle](../../../docs/mvp-spec.md#15-group-training-and-events) and [session-type contract](../../../docs/mvp-spec.md#186-session-types-and-flexible-bookings). The current page focuses on internal scheduling terms and does not explain the group experience.

## Scope and non-goals

- In scope: standalone responsive preview under `previews/how-it-works/`, existing local fonts, white surfaces, muted purple and a small pale green accent; athlete and coach explanations for both formats; section links, truthful confirmation copy, FAQs and local-only action dialogs; loopback static server and usage guide.
- Out of scope: replacing `/how-it-works`, live navigation/Auth/booking/group changes, new participant limits, database/account/demo edits, new dependencies, generated assets, deployment or committing.

## Expected behavior and edge cases

The page gives athletes and coaches clear starting links and keeps both explanations available. Private sessions are one-to-one and require coach acceptance. Group joining reserves a seat, but the group requires explicit coach confirmation; an already confirmed group stays confirmed. Small-group benefits are framed as a choice within variable class sizes, never a universal capacity promise. A FAQ explains coach-selected limits up to 100. Browsing needs no account, while requests/registration need sign-in. Buttons that would leave this preview open a labelled local dialog and send/store nothing. Native FAQ disclosures, anchors and dialogs work by keyboard, including Escape/focus return. Phone and desktop remain readable; reduced motion and unavailable local assets retain usable text.

## Assumptions, decisions, and dependencies

- Confirmed by user: create a preview using the new colors; retain the 100-person cap for now.
- Proposed design: one long page with prominent athlete/coach jump links, compact section navigation, two training cards, three-step journeys and FAQ. Design adoption remains pending user feedback.
- Reuse the exact public colors in `src/app/public-page-theme.css`: purple `#61417b`, ink `#2d2933`, muted text `#625c69`, border `#e3dce9`. Use the existing Manrope/Bricolage font files without editing them.
- Dependencies: Node.js and existing local font assets. No running application, database or external service is needed.

## Implementation plan

1. Create this record and allocate DEV0359 in the root index before preview implementation.
2. Build semantic HTML, responsive scoped CSS and local-only JavaScript. Use code-native illustrations instead of new raster assets.
3. Add an exact-file loopback server on port 3191 and README with preview boundaries and launch instructions.
4. Inspect desktop and phone renderings, section navigation, FAQs, keyboard dialogs/focus and no-overflow behavior. Check formatting, syntax, server allowlist and asset/error handling.
5. Review every criterion, record evidence, archive the completed preview ticket and deliver the running preview for feedback.

## Acceptance criteria

- [x] AC1: A labelled local preview shows athlete and coach paths, both training formats, three-step guidance, FAQs and the adopted palette without replacing the application page.
- [x] AC2: Copy distinguishes private acceptance, group registration/confirmation and variable group sizes up to 100 without inventing service behavior.
- [x] AC3: Desktop and phone renderings are readable, without page overflow; section links, FAQs and dialogs work with keyboard/Escape/focus return and reduced motion.
- [x] AC4: Preview assets/actions stay local, server exposes only its exact allowlist, writes/unknown paths fail, and launch/validation/proposal boundaries are documented.

## Validation plan

Use browser rendering at desktop, 768 px, 390 px and 375 px; inspect screenshots, keyboard jumps/disclosures/dialogs, viewport overflow and reduced-motion behavior. Verify syntax, scoped formatting, local links, content copy and exact server routes, including missing assets and rejected writes/traversal. Application/database tests and a Next build are not applicable because no application or database implementation changes. No live booking or service-unavailable state is introduced; the preview has local-only action dialogs instead.

## Implementation record

### Changes and rationale

Created a separate How it works design proposal. A short introduction offers athlete/coach jump links and two code-native training illustrations. Sticky section navigation keeps athletes, coaches and common questions reachable. Athletes compare one-to-one and group training cards, then read three practical steps. Coaches see both formats, approval/setup/management steps and a clear application action. Five native FAQ disclosures explain accounts, confirmation, variable class size, payment and cancellation. A final discovery action completes the page.

The design reuses the adopted white/purple palette and installed local fonts, with a pale green group accent. Browser review increased body/step/FAQ text sizes for readability. Small-group benefits are conditional on choosing a smaller class; the FAQ explicitly retains coach-selected limits up to 100. Private acceptance and group registration/confirmation remain distinct. All actions that would navigate to the app open local explanatory dialogs. No live application route was replaced.

### Affected files

| File                                                      | Role                                                                                                                             |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| index.html (retired artifact: `previews/how-it-works/index.html`)   | Labelled proposal, native section links, audience journeys, both formats, FAQs and local modal.                                  |
| styles.css (retired artifact: `previews/how-it-works/styles.css`)   | Exact current palette, reused fonts, original illustrations, responsive layouts, keyboard focus and reduced-motion overrides.    |
| preview.js (retired artifact: `previews/how-it-works/preview.js`)   | Local action messages, native modal close/Escape support and explicit trigger-focus restoration. No requests or persisted state. |
| serve.mjs (retired artifact: `previews/how-it-works/serve.mjs`)     | Loopback-only server for six exact routes; rejects unknown paths and write methods.                                              |
| Preview guide (retired artifact: `previews/how-it-works/README.md`) | Launch/stop instructions, font provenance, local-action boundaries and proposal status.                                          |
| This record and [root index](../../README.md)             | Scope, validation evidence and completed archive entry.                                                                          |

### Decisions and deviations

2026-10-19 commit annotation under DEV0364: the user authorized committing the preview/refinements and group-minimum change. DEV0350 is independent queued palette work, so its context link points to the reservation register rather than a record excluded from this commit. The preview captures its own explicit colors and reuses tracked fonts; the original design/validation evidence below remains historical.

2026-10-19: preview only, following the repository's standalone coach-page precedent. Group-size restrictions remain unchanged. Increased body typography after desktop inspection. This is a presentation refinement within the original scope; no material deviations or additional product decisions.

### Contracts, configuration, and operations

No product/schema/dependency/environment/migration changes. Start with `node previews/how-it-works/serve.mjs` and open `http://127.0.0.1:3191/`; stop with Ctrl-C. The process binds only to loopback and serves HTML under `/` and `/index.html`, CSS, JavaScript and two existing fonts. Reads use an exact allowlist; unsupported writes return 405 and unknown paths return 404. Content policy blocks service connections and form actions. The server reads no environment/account data. Removing this preview requires no application or data rollback. No specification update is needed because this remains a proposed design and retains existing product behavior.

## Validation results

- Date/environment: 2026-10-19, Node 24.21.0, native Safari on macOS. Normal desktop window plus Responsive Design Mode at 1440×844, 768×844, 390×844 and 375×844. Browser screenshots/accessibility state confirmed the hero, athlete/coach sections, readable stacked phone cards, section navigation and FAQs. No page-level clipping or horizontal scrollbar was observed; no programmatic DOM overflow measurement is claimed.
- `npx prettier --check previews/how-it-works`, `node --check previews/how-it-works/preview.js`, `node --check previews/how-it-works/serve.mjs` and task-scoped `git diff --check`: passed. Final repository-relative links and fragment targets checked separately.
- `node /private/tmp/movx-dev0359-static.mjs`: **23 checks passed** against the running loopback server. Six allowed routes matched exact local file bytes/content types and no-store/content-policy headers. Eight missing/app/environment/traversal paths returned 404; POST/PUT/DELETE returned 405; HEAD returned no body. IDs/fragment targets were valid; no service calls, external asset URLs, cookies or browser storage existed in the preview sources. Copy assertions confirmed variable sizes up to 100, private acceptance and group registration versus confirmation. Palette tokens and reduced-motion CSS were present.
- Native phone interactions: athlete/coach links updated the exact URL fragment and scrolled to the matching content. A keyboard Tab/Return sequence opened the native account FAQ. The group-size FAQ opened at 375 px with the retained 100-person explanation visible; Return closed it. Opened Become a coach, observed the local application explanation, closed with Escape and observed focus on the original button; Space reopened the same dialog. Modal and text stayed within the phone viewport.
- Native desktop interactions: coach link showed both format explanations and three management steps; final 1440 px athlete review showed side-by-side cards with readable text and complete actions. Exited responsive mode and left the preview at its top-level URL with disclosures reset.
- Reduced motion and font failure: source review confirmed `scroll-behavior: auto` plus disabled transitions/animations under the media query, and fallback sans-serif fonts. No OS preference change or browser media/font-failure emulation was performed. Unknown-asset error handling was exercised by HTTP validation.
- Earlier attempts: the sandbox initially rejected listening on loopback with EPERM; the authorized loopback-only retry started successfully. Sandboxed curl could not connect; the approved Node loopback checks passed. Chrome control timed out, and initial Safari attachment was slow; actual UI checks subsequently succeeded in Safari. The first static content assertion incorrectly treated formatted line breaks as spaces; normalizing HTML whitespace fixed the checker and all 23 checks passed. These were environment/checker issues, not product failures.
- Not applicable: application/unit/database suites, lint/type/build of the Next application, actual Auth/booking/payment/service recovery, migration or hosted tests. This change contains only a disconnected standalone preview and work records; it does not validate runtime product delivery.

| Criterion | Evidence                                                                                                                           | Result |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Actual desktop/tablet/phone renderings and accessible audience/format content; palette checked against current tokens.             | Passed |
| AC2       | Source review, static copy checks and actual 375 px group-size FAQ; no app/data edits.                                             | Passed |
| AC3       | Native responsive/anchor/FAQ/modal checks, Escape and restored-button Space activation; reduced-motion cascade reviewed in source. | Passed |
| AC4       | 23 HTTP/static checks, syntax/format/link checks and exact-file local server/guide.                                                | Passed |

## Risks, limitations, and follow-ups

Design and copy remain proposals pending user feedback. Live route adoption is a separate user-directed change. Local action dialogs demonstrate destinations without integration; a future runtime ticket must use the real app routes and run its own application/accessibility/error-state checks. Browser rendering was verified in Safari; Chrome rendering was not verified because its control connection timed out. No production or hosted delivery is claimed. The loopback process remains running for review.

## Completion and review references

- Completed: 2026-10-19 — standalone preview and required local checks passed; user design acceptance remains pending.
- Commit: User-authorized checkpoint with subject `[DEV0359][DEV0361][DEV0362][DEV0364] Add How it works preview and group minimums`.
- Review: Local scope/content/source/visual/keyboard self-review completed; no independent review.
- Deployment or release: None; local preview only.
