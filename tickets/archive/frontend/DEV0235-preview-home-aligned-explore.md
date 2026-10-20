# Ticket DEV0235: Preview Home-aligned Explore

2026-10-20 artifact retirement: the owner removed standalone design previews under [DEV0390](../organisatory/DEV0390-remove-unneeded-design-previews.md). The record below preserves the original design/validation history; backticked preview paths identify retired artifacts. Runtime images/code are retained, with banner source/prompt provenance in public/images/retained-banner-provenance.json.

- Status: Cancelled
- Created: 2026-10-15
- Last updated: 2026-10-20
- Milestone: Discovery design exploration
- Coordination: None — independent development ticket
- Related records: Home baseline [DEV0228](DEV0228-build-home-coach-grid-with-discipline-filter.md); Explore baseline [DEV0199](DEV0199-redesign-desktop-coach-explore.md); independent deferred Home coach/focus search [DEV0227](../../current/frontend/DEV0227-reintroduce-home-search-after-client-feedback.md)

## Objective and context

The user finds Explore less polished than the new Home page and requested an exemplary HTML preview before deciding on an application redesign. Show how the Home visual language can extend to focused list/map discovery. The [current discovery contract](../../../docs/mvp-spec.md#42-discover-a-coach-and-time) remains authoritative; this preview is a proposal, not adopted product behavior.

## Scope and non-goals

- In scope: one self-contained, offline HTML design preview in `docs/previews/`, with a compact heading, Home-style search/discipline navigation/cards, desktop list/map composition, mobile list/map selection and local sample filtering/coach selection.
- Out of scope: changing application routes, search contracts, real maps/data/auth/bookings, dependencies, Home search reintroduction or publishing. The user later authorized a commit checkpoint; the blocked validation status remains unchanged.

## Expected behavior and edge cases

Open the HTML directly in a browser. Label the five existing fictional coaches and schematic map as illustrative, with no invented availability or distance claims. Search and discipline controls filter the same sample cards/pins; clearing restores them and no matches show a useful empty state. Coach/pin selection synchronizes the preview. Mobile defaults to list and permits map selection. Keyboard actions and visible focus work. Public coach portrait/initials follow the existing fixture convention. Application navigation and scheduling links are represented only as labelled preview interactions.

## Assumptions, decisions, and dependencies

- Confirmed: the user requested a standalone HTML example to review.
- Proposed: reuse Home typography, colors, discipline shortcuts and card simplicity while preserving Explore's coach/focus search and desktop list/map distinction. This is not a confirmed redesign decision.
- Use only local embedded font/portrait assets and an inline schematic map so the file works without a running app or remote services. Installed asset licenses remain authoritative.
- Scope review: this is one bounded preview, requiring no coordination split. Runtime adoption requires a new development ticket and specification review.

## Implementation plan

1. Record this preview scope and reserve its ID in the index before creating the HTML.
2. Build one responsive standalone document, embedding the installed Home fonts and existing public fictional portrait. Add local filtering, selection, empty state and mobile views, plus a local 375-pixel mobile preview frame for convenient review without resizing the user's browser.
3. Open the file and inspect desktop/mobile, keyboard and interaction states. Check inline JavaScript syntax, self-containment, document links and formatting.
4. Record actual evidence, complete/archive the ticket if its criteria pass, and deliver the HTML path for review.

## Acceptance criteria

- [ ] AC1: A self-contained HTML file opens directly and visually demonstrates the proposed Home-aligned Explore, with clear fictional-data/schematic-map disclosure.
- [ ] AC2: Search, discipline selection, clear/empty states, coach/pin selection and mobile list/map controls work locally without network or application mutations.
- [ ] AC3: Desktop/mobile and keyboard review, JavaScript syntax, self-containment, formatting and affected documentation checks pass; limitations are recorded.

## Validation plan

Use the native browser for visual/keyboard interaction review at desktop and a narrow viewport. Check inline JavaScript with `node --check`, inspect external resource/request references, format the HTML/ticket/index with installed Prettier and validate local documentation links/IDs/statuses plus `git diff --check`. Application tests/lint/type/build and database checks are not applicable: no application or data code changes. Do not create permanent tests that merely mirror this disposable proposal.

## Implementation record

The standalone HTML is implemented and available for user review. Required final mobile/keyboard interaction validation remains blocked by the native browser-control environment; this record stays current and is not marked Completed.

### Changes and rationale

Created one self-contained HTML proposal rather than modifying the runtime Explore route. It shows a compact forest-colored heading, Home-style pill search and icon discipline shortcuts, two-column portrait/initial cards beside a sticky schematic map on desktop, and list/map views on narrow screens. Local example filtering updates the same cards/pins and handles empty results. Selecting a card/map pin previews that coach; profile, sign-in and other application links show a local preview-only dialog. The footer's mobile viewer loads the same document in a 375-pixel inline frame without fetching resources.

Embedded Manrope and Bricolage Grotesque from the installed project packages, their copyright/license notices, and the existing public Daniel Park fictional portrait. Other coaches use initials. Five example records reuse existing fictional names/venues; map positions and neighborhood labels are illustrative and no current inventory, availability, distances, price or ratings are asserted.

### Affected files

| File or component                                                   | Change and purpose                                                                                          |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| This ticket and [index](../../README.md)                            | Own the bounded preview and reserve its development identifier.                                             |
| Explore preview (retired artifact: `docs/previews/movx-explore-preview.html`) | Offline HTML, embedded assets/licenses, local filters and selection, responsive list/map and mobile viewer. |

### Decisions and deviations

2026-10-15: No adopted application-design change. A schematic map avoids remote provider dependencies and unverified location/availability claims. Add a preview-only mobile viewer in the footer so the user can inspect the narrow layout inside the same HTML; it is not proposed application navigation.

### Contracts, configuration, and operations

No application contract, environment variable, dependency, schema, migration or configuration changes. Installed Next.js layout/page guidance was inspected; the artifact is plain HTML outside the route tree.

## Validation results

2026-10-15, local Node.js 24 and native Chrome:

- Native browser opened the HTML file directly. Viewed the compact heading, search/discipline controls, Home-style portrait/initial cards and adjacent schematic map at the 1388-pixel desktop window width. The visible preview disclosure labels fictional examples, an illustrative map and no live availability.
- Selecting Boxing visibly changed the discipline input, active shortcut, count to two example coaches, cards to Daniel Park/Sam Lee and matching pins. An Elif selection was also observed with the highlighted card/pin and correct selected-coach name/place. These observations precede the final mobile-viewer addition; final mobile behavior is not claimed from them.
- `node --check /tmp/dev0235-preview.js`: final inline JavaScript syntax passed. The script is extracted from the HTML by the checker below.
- `python3 /tmp/dev0235-check-preview.py`: offline assets/license notices, unique HTML IDs, resolved anchors/element references, no external resource/network APIs, local Markdown links/anchors, ticket ID reservation and diff checks passed.
- `npx --no-install prettier --check docs/previews/movx-explore-preview.html tickets/current/frontend/DEV0235-preview-home-aligned-explore.md tickets/README.md` and `git diff --check`: passed after final formatting.
- Blocked manual checks: complete search/empty/clear flow, profile modal keyboard return, final map selection and mobile list/map/viewer/overflow/focus review. Native controls repeatedly returned `noWindowsAvailable`, stale state or user-change errors. After Reload, the browser observation remained blank with no page accessibility content; reconnecting/resetting did not recover the observation, and the Safari fallback timed out. Do not infer passed behavior from attempted keyboard input or a changed accessibility value when the corresponding rendered result was absent.
- Application tests/lint/type/build, live provider/database/auth checks and hosted deployment were not run: the runtime, dependencies, environment and persistent data are unchanged. Static checks and earlier desktop observations do not replace the remaining native mobile/keyboard review.

| Criterion | Evidence                                                                                                                          | Result             |
| --------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| AC1       | Offline artifact/assets/disclosures checked; earlier desktop rendering viewed. Final reload observation could not be recovered.   | Partially verified |
| AC2       | Boxing filtering and selected-coach state observed; remaining form, modal and mobile interactions await reliable browser control. | Partially verified |
| AC3       | Final syntax/self-containment/link/ID/format/diff checks passed; final mobile and keyboard review remains blocked.                | Partially verified |

## Risks, limitations, and follow-ups

The map is a schematic illustration and the records are local examples. Real inventory, map-provider behavior, current availability, canonical URLs and persisted state require application integration in a separately scoped ticket after design review. Handoff: the artifact exists, static checks and earlier desktop observations passed, but required final browser checks remain incomplete. Next action is to reopen the HTML in a reliable browser surface, exercise form/empty/clear/selection/modal and the 375-pixel mobile viewer with keyboard focus, then complete/archive this record only if those criteria pass.

## Completion and review references

2026-10-15 commit checkpoint: the user requested committing all current changes. `python3 /tmp/dev0235-check-preview.py` passed JavaScript syntax, 52 unique HTML IDs/anchors/references, embedded font/portrait/license and offline checks for the 188,939-byte artifact, 180 local documentation links/anchors and current identifier reservations. Targeted Prettier and whitespace checks pass. This is an unfinished preview checkpoint; the blocked mobile/keyboard/native-browser criteria above are not claimed complete. Its commit owns only the HTML, this record and its index entry.

- Completed: Cancelled 2026-10-20 — owner retired the standalone artifact under DEV0390. Unfinished mobile/keyboard acceptance was not completed and is not claimed passed.
- Commit: User-authorized checkpoint — `[DEV0235] Checkpoint the Home-aligned Explore preview`.
- Review: Static/source and earlier desktop self-review performed; final manual checks pending. No independent review.
- Deployment or release: Not applicable — local design preview only.

2026-10-20 cancellation: DEV0390 removes this unneeded offline proposal at the owner’s request. The earlier partial observations and unmet acceptance criteria remain historical evidence; no runtime Explore behavior is changed.
