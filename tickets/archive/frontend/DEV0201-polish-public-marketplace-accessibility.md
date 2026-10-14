# Ticket DEV0201: Polish public marketplace accessibility

- Status: Completed
- Created: 2026-10-12
- Last updated: 2026-10-14
- Milestone: [M3 — Scheduling interface](../../../docs/mvp-spec.md#12-delivery-milestones) public-marketplace follow-up
- Coordination: [COR0017 — Public marketplace redesign](../organisatory/COR0017-public-marketplace-redesign.md)
- Related records: completed integration dependencies [DEV0196 — Introduce the public marketplace shell](DEV0196-introduce-public-marketplace-shell.md), [DEV0197 — Share public marketplace search](DEV0197-share-public-marketplace-search.md), [DEV0198 — Build the search-first marketplace home](DEV0198-build-search-first-marketplace-home.md), [DEV0199 — Redesign desktop coach Explore](DEV0199-redesign-desktop-coach-explore.md) and [DEV0200 — Add mobile Explore map/list state](DEV0200-add-mobile-explore-map-list-state.md); separate private-interface follow-up [COR0018 — Authenticated workspace redesign](../../current/organisatory/COR0018-authenticated-workspace-redesign.md)

## Objective and context

Perform the final cross-surface accessibility, responsive and failure-state pass after the public shell, homepage and Explore redesign tickets satisfy their own acceptance criteria. This ticket owns integration-level corrections and final browser evidence, not deferred implementation from incomplete peer tickets. It implements the current [public scheduling behavior](../../../docs/mvp-spec.md#9-scheduling-behavior-and-permissions) and validates the [definition of done](../../../docs/mvp-spec.md#11-definition-of-done) and [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix).

## Scope and non-goals

- In scope:
  - Review semantic headings/regions, labels, alt behavior, visible focus, focus order, reduced motion and live/status announcements across public routes.
  - Resolve cross-surface overflow, sticky-header/map obstruction, tap-target, long-text and breakpoint defects.
  - Verify ready, empty, unavailable, map-loading/failure, missing-image and signed-out/signed-in states.
  - Consolidate redundant public marketplace styles only where behavior and ticket ownership are already stable.
- Out of scope:
  - New search/data features, analytics, visual rebranding, backend behavior or product-policy changes.
  - Repairing unmet peer acceptance criteria under a different ticket; those return to the owning peer first.

## Expected behavior and edge cases

- Public Home, Explore, coach profiles, How it works and sign-in have one logical heading/focus structure and no duplicate navigation landmarks.
- Keyboard users can search, use chips, select coach cards/pins, switch mobile view and reach profile/request destinations with visible focus.
- Approximately 375 px, 430 px, 768 px, 1024 px and 1440 px layouts have no horizontal overflow, clipped controls, obscured content or unusable sticky elements.
- Reduced-motion users do not receive forced smooth scrolling or nonessential movement.
- Failure/empty states preserve the next truthful action and never expose fabricated data.

## Assumptions, decisions, and dependencies

- DEV0195 supplies the adopted public/private navigation, search-first data and responsive Explore acceptance contract.
- DEV0196-DEV0200 must each meet their own acceptance criteria before this ticket starts.
- Independent Home follow-ups [DEV0226](DEV0226-remove-home-coach-focus-search.md) and [DEV0228](DEV0228-build-home-coach-grid-with-discipline-filter.md) remove coach/focus search, then introduce one Home grid with typed/scrollable disciplines, Home discipline/location URLs and 15-item expanded-page navigation. Review the delivered Home controls, native validity, pagination/focus and Explore's retained full query search against the current specification; their implementation scope does not transfer into integration polish.
- Existing MovX tokens, Bricolage Grotesque display type and Manrope body type remain the visual foundation.
- Automated accessibility checks assist but do not replace manual keyboard, responsive and screen-reader-oriented semantic review.

### Adopted audit and isolation plan — 2026-10-14, before implementation

- The user authorized starting DEV0201. Completed DEV0196–DEV0200 and independent DEV0226/DEV0228 satisfy the public baseline. This remains one bounded integration/accessibility slice; existing scheduling, search, map, identity and provider contracts are unchanged. Record concrete defects before implementing material fixes.
- Audit Home, Explore list/map, a public coach profile, How it works and sign-in at 375/430/768/1024/1440 px. Cover landmark/heading/label structure, first-Tab skip navigation, visible unobscured focus, keyboard selection/navigation, 44 px primary touch controls, long labels, portrait/initials, contrast, reduced motion, ready/empty/unavailable/loading/map-failure and signed-out/signed-in public navigation.
- Use installed axe-core only as a supporting browser audit, not a claim of assistive-technology certification. Combine automated rules with explicit behavior/viewport tests and visual/keyboard review. No new dependency is planned.
- DEV0223 actively changes private routes, shared connection actions/controllers and tagged local rehearsal fixtures. Preserve its working tree and stage nothing from it. Use a detached temporary worktree based on committed `233dfca`, a shared read-only node_modules link and separate build/server/output directories. Apply only this ticket’s public changes to that validation checkout; never restart the active app or reset/reseed its local services.
- Prefer isolated public fixture adapters for deterministic large/empty/error directories, long text and missing images without modifying shared database inventory. Use the actual public route/components and committed service baseline, keep adapters/configuration confined to temporary QA hosting, and verify ordinary signed-out/signed-in public navigation without creating business mutations. Any additional fixture design is recorded before use.
- Scope runtime fixes to public components and public selectors. Inspect installed Next.js 16.3.8 accessibility/Link/Form/CSS guides before framework integration changes. Changes to shared primitives or global behavior require an explicit narrowly scoped plan and regression evidence; connection/private work remains outside this ticket.
- Validation in the isolated checkout uses unit/server tests, public browser flows plus meaningful integration regressions, lint, typecheck, formatting and production builds. Configuration-free and local-data/actor cases are distinguished. Coordinate browser/build processes through a dedicated port and outputs rather than the active session’s server/cache. Database/migration/payment rehearsals do not apply to presentation-only fixes.
- Finish this ticket’s implementation and validation record, then archive it and update links/index. COR0017 can complete only when all direct members and its integration criteria pass; DEV0201 supplies the final public-flow evidence, not private-workspace completion.

### Confirmed baseline defects and correction plan — 2026-10-14

- Axe at 375/1440 px found the public demo strip outside landmarks, How it works skipping from h1 to h3, and insufficient contrast in neutral preview labels, Home initials, Explore metadata/location/map hints, profile map/location hints and How it works paragraphs. Preserve the palette while darkening these public-only text selectors; give the public demo strip a named region and allow the story grid to use h2 on How it works (Home keeps h3 beneath its section h2).
- Public header/demo/footer links, Explore discipline chips and 43 px form controls fall below the adopted 44 px touch-control target. Add public-scoped control sizing and visible-focus rules, keeping the private shell and shared primitives unchanged.
- Explore overflows at 375 px. Constrain the public search/grid children and scrollable discipline track rather than hiding document overflow.
- Home's selected Wrestling shortcut lies outside the narrow strip after navigation. The wrapper key remounts the strip and loses keyboard focus. Move the canonical reset key to the form only; retain the navigation links, reveal the active shortcut with horizontal instant scrolling on filter changes, and keep native URL/GET/history behavior.
- Explore explicitly requests smooth scroll for card/map-detail selection even with reduced motion. Respect the browser preference for both selection paths; MapLibre's existing preference-aware recentering remains unchanged.
- The skip link currently focuses main at viewport y=0 behind the 86 px sticky header. Apply public document scroll padding (92 px desktop, 148 px narrow) and recheck focus against the enlarged header. Rechecks also identify undersized result/sign-in links, the 30 px public preview-dialog close control, and profile location-list address contrast; include these public-only selectors. Map attribution links remain provider text links rather than primary touch controls.
- Verify skip-link and focused result visibility against the sticky header and add public-only scroll offsets if needed. Avoid broad global restyling: put public overrides in one final stylesheet imported by the root layout, with selectors rooted in the public shell. No private connection files, shared modal behavior, service contracts or provider SDK code are changed.
- Temporary webpack aliases did not replace the service, so early unavailable-state scans were not ready-state evidence. The isolated checkout now swaps only the two public read exports for deterministic fixtures (31 coaches and empty/unavailable variants); the original service is saved for restoration before the real production build. Fixture adapters and audit reports stay outside the repository. Extend fixtures with long public labels, multiple active venues and explicit image failure for the state matrix; never insert them into the shared database.

### State-fixture refinement — 2026-10-14

- Representative signed-in public shell states will use isolated read-only session/actor fixtures for an athlete, approved coach, pending/rejected applicant and unavailable session. These exercise the actual session/actor providers and Shell with matching client actor responses and real link destinations. This avoids starting login/email or business mutations alongside DEV0223 rehearsals. These are interface projection checks, not a new authentication/database rehearsal; existing authorization tests remain required.
- Include a long unbroken coach name within the 80-character coach-profile contract, long public venue name/address, two distinct active venues, a broken public portrait and explicit requestable/booked public slot projections. The public fixture remains visibly fictional and temporary. No requests are submitted. Check the guest sign-in destination and unchanged pending-confirmation explanation using these states.
- Public dialog recheck found the exit CTA is also 43 px. Include both public dialog buttons in the 44 px correction; private dialogs remain unchanged.

- Runtime route-navigation warnings exposed Next.js 16's opt-in scroll override: the existing global smooth CSS needs `data-scroll-behavior="smooth"` on html for instant framework route transitions. Read the installed version-16 scroll guide and adopt that attribute; existing reduced-motion CSS and explicit selection preferences still govern in-page movement. Include public/private route regression evidence for this root integration correction.

- Signed-in mobile screenshots show the existing header truncating “Coach workspace” to “Coach work…”. Remove that public-only span cap while keeping the responsive header layout; verify full labels fit for athlete/coach/applicant states at all five widths.

- The broken-portrait fixture reproduces an early image failure before React hydration: Avatar relies only on onError, so an already failed server-rendered image remains instead of initials. Add a narrowly scoped image ref check for `complete && naturalWidth === 0` when the image attaches, preserving the existing per-URL failure state, alt/ARIA semantics, successful images and URL replacement behavior. This is the only shared primitive correction; add a real early-image-failure browser regression and include private shell regression evidence. No connection-controller changes are required.

- Record the public accessibility implementation baseline in specification section 9 (keyboard/landmarks/focus, 44 px primary controls, contrast, reduced motion and failure fallbacks). This is a delivered implementation default, not a newly inferred client decision or a changed search/booking contract.

- The production long-venue profile exposes implicit minimum sizing in its header identity/place grid. Constrain those public header children and wrap their complete public name/address, and inherit wrapping throughout the profile so repeated coach names and published-hour venue text cannot expand later sections; do not conceal document overflow or truncate the authoritative place text. The same fixture checks published-slot text contrast and map detail content.

- Axe's dense 31-coach synthetic map reports partially overlapped pin targets at 1024 px despite each marker being 44 px. Keep every keyboard marker reachable and raise selected/focused pins above neighbors. The complete list's 44 px “Show on map” controls perform the same selection and satisfy the equivalent-control target-size exception described by [W3C SC 2.5.8 guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html); retain this automated finding with manual rationale rather than claim zero violations or introduce unrelated clustering. Extend contrast corrections to published-slot availability hints and today's address text found only when real slot projections are present.

## Implementation plan

1. Build a public-route/state/viewport validation matrix and audit semantic/navigation duplication.
2. Run automated accessibility and responsive browser checks, then manually verify keyboard/focus and reduced-motion behavior.
3. Apply only integration-level CSS/markup/test corrections and route peer-owned regressions back to their ticket records.
4. Run the complete relevant unit/browser/build suite and record cross-ticket evidence in COR0017.

## Acceptance criteria

- [x] AC1: All public redesign routes pass the documented keyboard, landmark, label, focus and reduced-motion review.
- [x] AC2: The five target viewport widths pass without horizontal overflow, sticky obstruction, clipped text or undersized primary controls.
- [x] AC3: Ready, empty, unavailable, map-failure, missing-image and representative actor states preserve truthful usable actions.
- [x] AC4: Relevant application/browser checks, lint, type-check, formatting and production build pass, and COR0017 receives final integration evidence.

## Validation plan

- Add or extend Playwright coverage for the public route/state/viewport matrix and use automated accessibility tooling already present in the repository, if any.
- Manually tab through the complete guest search-to-profile/request-entry path and representative signed-in public/private transitions.
- Emulate `prefers-reduced-motion`, map failure, missing images and narrow/long-content cases.
- Run `npm test`, the complete relevant Playwright projects, `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build` and `git diff --check`.

## Implementation record

Implementation/audit started on 2026-10-14 after dependency/scope review. The adopted plan above precedes implementation edits.

2026-10-14 downstream handoff from DEV0226: Home now has an explicit shared-form configuration that omits coach/focus input and query-bearing links, while Explore retains its default query contract. DEV0226 owns focused keyboard/responsive/submission validation. At that handoff this ticket remained Draft; the broader public integration review now starts under the adopted plan.

### Changes and rationale

- Public navigation, search, result links, map zoom controls and preview-dialog actions now provide at least 44 px targets. Explore's narrow discipline row is bounded and horizontally scrollable instead of widening the document. Full signed-in header destination names remain readable.
- Named demonstration-data region and h2 steps on How it works repair landmark/heading order. Public muted labels, initials and map/venue hints use darker existing-palette text; private workspace colors remain untouched.
- Public document scroll padding keeps the skip target and scrolled selections below the sticky header. The root html opts into Next.js 16's documented instant route-transition override for the existing smooth-scroll CSS. Explore card/detail selection explicitly uses instant scrolling under reduced motion.
- Home keys only the form by canonical filters, preserving discipline links/focus across filter navigation while resetting native form values. The strip reveals its selected link horizontally on initial render and filter changes. Existing Home URLs, 15-item expansion, query exclusion and Explore q contract remain unchanged.
- Avatar detects a server-rendered image that has already failed before hydration, retaining initials through the existing per-URL failure state. Successful images, replacement URLs and existing image/ARIA contracts are preserved.
- Permanent browser regressions cover the five breakpoint route matrix, named landmarks/logical headings, unobscured skip focus, target sizes, selected-discipline focus, public dialog focus trapping/return, reduced-motion map selection and early portrait failure. Fixture-only map/portrait cases explicitly skip when the ordinary test environment has no directory.

### Affected files

| File or component                                                                                                                                                                        | Change and purpose                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| [public-marketplace-accessibility.css](../../../src/app/public-marketplace-accessibility.css)                                                                                            | Public-only contrast, controls, focus, scroll offset, wrapping and bounded discipline-row integration overrides. |
| [layout.tsx](../../../src/app/layout.tsx)                                                                                                                                                | Imports those final public styles and declares Next's existing smooth-scroll integration.                        |
| [shell.tsx](../../../src/components/shell.tsx)                                                                                                                                           | Gives the public demonstration disclosure a named region; private markup is unchanged.                           |
| [coach-story.tsx](../../../src/features/public/coach-story.tsx)                                                                                                                          | Allows h2 steps on How it works while Home keeps h3 beneath its h2.                                              |
| [home-marketplace-search.tsx](../../../src/features/coaches/home-marketplace-search.tsx), [home-discipline-navigation.tsx](../../../src/features/coaches/home-discipline-navigation.tsx) | Reset the form without remounting the discipline strip; reveal selected shortcuts without vertical movement.     |
| [coach-explore-results.tsx](../../../src/features/coaches/coach-explore-results.tsx)                                                                                                     | Respects reduced motion when selection scrolls result/detail focus into view.                                    |
| [ui.tsx](../../../src/components/ui.tsx)                                                                                                                                                 | Preserves initials when a portrait failed before hydration.                                                      |
| [mvp-spec.md](../../../docs/mvp-spec.md#9-scheduling-behavior-and-permissions)                                                                                                           | Records the delivered public accessibility presentation baseline as implementation defaults.                     |
| [public-accessibility.spec.ts](../../../tests/browser/public-accessibility.spec.ts)                                                                                                      | Behavioral integration regressions for keyboard, breakpoints, dialog, motion and images.                         |

### Decisions and deviations

- Public overrides are isolated instead of consolidating stable peer CSS, keeping this audit focused and avoiding private DEV0223 conflicts.
- Two temporary QA assertions initially expected the wrong Load more focus destination (the actual first new card identity is intentional) and implicit list URL (recovery correctly uses `view=list`); another expected “Sign in” instead of truthful “Check sign-in” for an unavailable session. Corrected these harness expectations without altering product behavior. Initial control and early-image failures led to the fixes above.
- Representative signed-in navigation uses matching interface fixtures, not a new backend/email-login rehearsal. Deterministic empty/failure/long-content fixtures remain confined to the detached validation checkout; no runtime test flags or fabricated application inventory were added.

### Contracts, configuration, and operations

No data, API, schema, provider, dependency or environment contract changed. No migration, seed, hosted setup or rollback operation is required. The root html declares Next.js 16’s scroll integration; public CSS/semantics and Avatar's early-failure presentation change only. Reverting this ticket's runtime changes restores the previous presentation without touching persisted data. The specification now records the delivered accessibility defaults separately from confirmed client decisions.

## Validation results

Validation completed on 2026-10-14 in a detached checkout of committed `233dfca` plus only DEV0201 runtime/tests. The concurrent DEV0223 working tree, its active app/database and tagged rehearsal fixtures were not restarted or modified. Installed Node 24.21.0, Next.js 16.3.8, Chrome/Playwright 1.63.0 and existing axe-core 4.13.0 were used. All commands below exited 0 unless explicitly labelled as an earlier diagnostic run.

- **Application checks:** `npm test` passed **135 unit + 14 server tests**, no skips/failures. `npm run lint`, `npm run typecheck`, `npm run format:check` and `npm run build -- --webpack` passed after restoring the original public/authorization services and removing temporary fixture code/configuration. Webpack was used for the isolated node_modules-symlink checkout; no bundler setting was added to the application. A check of compiled server JavaScript found no temporary actor/long-name fixture tokens. Database, email-login, hosted deployment and payment rehearsals were not run: this ticket changes presentation only and never submits requests or changes persisted data.
- **Ready/state production browser matrix:** `./node_modules/.bin/playwright test --config qa/playwright.config.ts public-accessibility.spec.ts public-story.spec.ts dev0201-state-review.spec.ts` passed **25 checks**, with **5 intentional skips**. The three temporary state cases ran only in the desktop project but explicitly iterated narrow/tablet/desktop widths; the other two skips are existing duplicate mobile breakpoint/no-JavaScript cases. The permanent desktop and touch-enabled mobile projects both passed discipline focus, dialog, reduced-motion selection and early-portrait failure checks. The temporary config used only port 3121 and `/tmp/dev0201-playwright-results`.
- **Ready/state observations:** all five widths showed 15 initial entries, then 30 and 31 via Load more, restored scroll and focus on the first new card, and removed Load more at exhaustion. An 80-character unbroken coach name, long public venue/address, requestable and booked slot projections, two active profile venues and a missing portrait retained usable text/actions without document overflow. Empty/reader-unavailable directories and unavailable profiles stayed explicit. Holding the lazy map chunks preserved a loading announcement and complete list; aborting the map style returned mobile `view=map` to filter-preserving `view=list`, kept every result/profile link and retained both profile venues and guest request-entry links. The guest request link kept the exact coach return destination; booked hours offered no request action. No booking mutation occurred.
- **Actor projection observations:** signed-out, athlete, approved-coach, pending/rejected-applicant and unavailable-session fixtures passed at every width. Every authorized projection retained My sessions and personal Profile; among these projections, the approved coach had Coach workspace while athlete/pending/rejected actors did not; other authorized actors kept coach-application entry. Full header labels and 44 px links fit, the public header remained separate from private chrome, and an unavailable session offered “Check sign-in”. These matching provider/Shell projections are not evidence of a new real authentication rehearsal.
- **Original-services production browser matrix:** after saving/removing all temporary service/session/state fixtures, `./node_modules/.bin/playwright test --config /tmp/dev0201-real-playwright.config.mjs public-accessibility.spec.ts public-story.spec.ts auth.spec.ts` passed **22 checks**, with **6 intentional skips**: four map/portrait cases need configured directory data and were already proven by the ready fixtures, plus two existing duplicate mobile cases. Verified genuine configuration-free unavailable discovery, sign-in/provider guidance, private-route guards, public navigation, native GET without JavaScript, filter canonicalization/history, landmarks/headings, skip focus, touch sizes and preview-dialog focus trapping/return.
- **Supporting accessibility audit:** `node /tmp/dev0201-audit-final.mjs` checked Home, Explore, Coach 001, How it works and sign-in at 375/430/768/1024/1440 px (**25 route/width cases**) using WCAG 2 A/AA, 2.1 A/AA, 2.2 AA and best-practice axe tags. No horizontal overflow, undersized primary control, contrast, heading or landmark violation remained. Wrestling's selected shortcut was entirely inside the 375 px strip. Dense synthetic Explore maps still produced only `target-size` overlap findings at 1024/1440 px; all pins are 44 px, focused/selected pins rise above neighbors, and the same page's 44 px list buttons offer equivalent selection. This is a manually reviewed equivalent/essential-map-position case under [W3C SC 2.5.8 guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), not a claim that axe returned zero violations. Image/background/canvas-dependent incomplete rules were reviewed against labelled native controls, visible focus, complete text/location lists and screenshots; this is not assistive-technology certification.
- **Dialog and visual/keyboard review:** `node /tmp/dev0201-dialog-audit.mjs` returned no violations for the actual public preview dialog at 375/1440 px. Reviewed mobile/desktop Home/profile/actor screenshots and source/DOM semantics: one main/h1, named public navigation/disclosure regions, explicit form labels, decorative versus informative portrait alt/initials, distinct numbered/text venue cues, keyboard activation, unobscured skip/selection focus and truthful pending-confirmation language. Browser keyboard flows reached filtered results, map selection and the profile/sign-in destination; reduced motion recorded instant selection scrolling and no smooth calls. No real screen-reader product certification is claimed.
- **Diagnostic failures and correction:** initial scans exposed low contrast, uncontained disclosure content, heading skips, small controls, Explore overflow and hidden selected shortcuts. Subsequent production states exposed pre-hydration image failure and long profile/header/slot/name overflow, which were corrected and rechecked. Three incorrect temporary harness expectations were corrected as recorded above; a held-chunk route handler was retained after release to avoid double-handling. An earlier development-mode combined run timed out during recompilation and was interrupted; final evidence uses stable production runs, not that incomplete run.
- **Evidence and reproducibility:** the permanent regressions and fixture factory are repository files; the state adapter used the existing `tests/fixtures/coach-directory.ts`, 31 alphabetical entries, explicit unavailable/empty filters, two venues and matching actor/session projections. Temporary fixture sources/config/state script are saved in `/tmp/dev0201-fixture-kit`; browser artifacts are in `/tmp/dev0201-playwright-results` and `/tmp/dev0201-real-browser-results`; supporting reports include `/tmp/dev0201-final-audit-results.json`, `/tmp/dev0201-complete-browser.log`, `/tmp/dev0201-real-browser.log`, `/tmp/dev0201-unit-server.log` and `/tmp/dev0201-real-build.log`. These are local supporting artifacts, not application inventory or hosted/release evidence. This ticket supplies the durable observations above.
- **Documentation checks:** `python3 /tmp/dev0201-check-links.py` passed 67 moved/affected links plus specification anchors, unique completed archive/index records and all seven reciprocal completed memberships. Prettier accepted all 14 Markdown files whose links moved, the specification and owned runtime/test files; `git diff --check` passed. Unrelated historical broken links recorded under DEV0225 remain outside this change.

| Criterion | Evidence                                                                                                            | Result |
| --------- | ------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Public keyboard/dialog, route semantics, reduced-motion and axe/manual review above.                                | Passed |
| AC2       | Five widths, long name/place/slot text, header labels, 44 px controls, zero document overflow and unobscured focus. | Passed |
| AC3       | Ready/empty/unavailable, map-loading/failure, early image failure, guest request entry and actor projections above. | Passed |
| AC4       | 135 unit + 14 server tests, production browser matrices, static checks/build and final COR0017 evidence.            | Passed |

## Risks, limitations, and follow-ups

- Dense neighboring map pins may overlap; list selection and keyboard controls remain the complete alternatives. Clustering/visual decluttering is outside this presentation correction. Signed-in browser evidence uses explicit interface fixtures; hosted identity/booking acceptance remains owned by its existing delivery records.
- Legal footer content remains limited to routes/content that actually exist; this ticket does not invent legal policies.

## Completion and review references

- Completed: 2026-10-14. AC1–AC4 passed; runtime implementation and review record are complete.
- Commit: The earlier planning record was committed under DEV0195–DEV0201. Implementation, validation evidence and archival are included in `[DEV0201] Polish public marketplace accessibility`; the commit hash is available in Git history. Committing was authorized by the user on 2026-10-14.
- Review: Self-reviewed against AC1–AC4 and the current specification; no independent review created.
- Deployment or release: Not deployed or released.
