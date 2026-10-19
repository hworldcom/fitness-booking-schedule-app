# Ticket DEV0357: Manage group-session banners

- Status: Blocked
- Created: 2026-10-18
- Last updated: 2026-10-19
- Milestone: Public group-session discovery
- Coordination: [COR0030 — Events cards, banners and map](../organisatory/COR0030-events-cards-banners-and-map.md)
- Related records: Peer boundaries and historical dependencies are mapped by COR0030; existing group lifecycle remains [DEV0240](../../archive/frontend/DEV0240-add-group-event-discovery-and-joining.md).

## Objective and context

Let an owning coach upload, preview, replace and remove the optional banner on a saved draft or future published group session. Consume the stable DEV0356 authority rather than changing session terms.

## Scope and non-goals

In scope: owner event detail/edit image control, immediate separate save/revision and preview, invalid/conflict/unavailable/actor-change recovery, accessibility and native validation. Out of scope: persistence/API/migrations (DEV0356), public card/map/paging (DEV0358), changing frozen terms or retained demo records.

## Expected behavior and edge cases

New unsaved sessions first use Save draft; uploads attach only after a real session exists. Clearly label this optional event-specific banner and its immediate save boundary. Removing it restores the coach-banner fallback on public cards. Keep a preview, source limits and accessible file label; disable overlapping mutations, preserve useful local selection/retry guidance on errors, reload latest on stale saves and never silently overwrite. Terminal/past/suspended/foreign sessions have no edit control; backend authority remains definitive. Upload changes must not submit or reset the session terms form.

## Assumptions, decisions, and dependencies

DEV0356 must stabilize owner snapshot/upload/remove/read signatures before implementation. The user confirmed event image with coach-banner fallback; separate immediate save and a saved-session prerequisite are adopted defaults. Reuse the existing banner uploader pattern where possible and preserve parallel coach-profile editor work.

## Implementation plan

1. Review DEV0356 contract and existing coach-banner control; record any necessary integration decisions before edits.
2. Add saved-session owner banner controls, immediate upload/remove feedback and latest-state recovery separate from draft/terms submission.
3. Integrate only on appropriate owner event screens and communicate fallback/permissions accurately.
4. Run meaningful control/state regressions, scoped lint/type/build and native desktop/375 px keyboard, upload/remove/reload/error checks using isolated records.
5. Finish implementation evidence; DEV0358 owns the combined public discovery rehearsal.

## Acceptance criteria

- [x] AC1: An eligible owner can upload/replace/remove and reload the event banner without changing session terms; fallback and separate-save boundaries are clear.
- [ ] AC2: Unsaved/terminal/past/foreign or changed-actor access cannot edit; keyboard/phone controls and invalid/stale/unavailable recovery remain usable.
- [ ] AC3: Relevant tests/lint/type/build and native owner checks pass with only isolated disposable records; links and implementation record complete.

## Validation plan

Use isolated tagged fixture records/accounts and the real DEV0356 endpoints/Storage; preserve retained data and other browser work. Verify actual upload, reload, replacement, removal and refusal states at desktop/375 px with keyboard. Tests should prove state/permission/recovery behavior, not markup/CSS snapshots. No browser automation execution; use native CUA. Peer DEV0358 adds combined public evidence.

## Implementation record

Owner controls and the desktop upload/reload/replace/remove/invalid/keyboard-removal flow are verified. Remaining phone and stale/unavailable recovery acceptance is blocked by computer-control failures.

### Changes and rationale

Saved-session detail and draft edit screens now load an actor-checked EventBanner snapshot and render a separate immediate-save uploader. It supports upload, preview, replacement, removal and Load latest. Conflicts and unknown outcomes disable mutations until reconciliation; selected bytes remain in memory for explicit retry. New unsaved forms explain the saved-session prerequisite. Read-only snapshots have no picker/remove control.

### Affected files

- [Banner client](../../../src/features/coach-events/banner-client.ts): bounded raw-file requests with independent If-Match revision; validates event identity/status and does not automatically retry.
- [Banner editor](../../../src/features/coach-events/banner-editor.tsx): preview, limits, immediate-save boundary, permission/read-only state and explicit recovery.
- [Owner detail](../../../src/app/coach/events/[id]/page.tsx), [draft editor](../../../src/app/coach/events/[id]/edit/page.tsx), [screens](../../../src/features/coach-events/screens.tsx) and [forms](../../../src/features/coach-events/forms.tsx): only load after existing authority succeeds; keep banner controls outside term forms.
- [Scoped styles](../../../src/features/coach-events/coach-events.css) and [control tests](../../../tests/event-banner-editor.test.ts): responsive accessible controls and malformed/private/foreign/readonly response handling.

### Decisions and deviations

None so far.

### Contracts, configuration, and operations

Consumes DEV0356 EventBannerResult and GET/POST/DELETE /api/coach/events/[id]/banner, raw source bytes and If-Match media revision; private preview uses the versioned owner card route. The owner detail/edit routes load the initial result only after their existing event authority succeeds. CoachEventsAccess retains actor-change hiding; requests discard late responses after unmount. Images save immediately and never submit the session-terms form. New draft forms explain that the banner is added after Save draft. Conflicts/unknown outcomes require Load latest before retry; retain the selected File in memory for an explicit retry. No schema/API/dependency/environment changes in this frontend peer.

## Validation results

### Supplemental responsive audit — 19 October 2026

[DEV0367](../../archive/organisatory/DEV0367-audit-athlete-coach-responsive-journeys.md) adds native Firefox evidence at 375 px using a fresh tagged coach and published group. The native picker uploaded a synthetic PNG, the saved 8:3 preview survived a full reload, and an unauthenticated image read returned HTTP 200 with an 800×300 WebP. Native removal restored fallback wording and the same version URL returned 404. Exact SQL checks retained the group's open status, Free price and 1–2 capacity. The temporary identity, group and media were removed; the final full 55-record preservation comparison passed.

This supersedes the missing phone upload/reload/remove observation below for Firefox. Phone replacement, invalid/stale/unavailable recovery and the remaining keyboard/Chrome-specific cases were not repeated; AC2/AC3 and Blocked status remain open. DEV0367 is independent QA evidence, not a direct member of COR0030. No runtime implementation changed.

2026-10-19 commit verification: the exact staged source passed 51 frontend/domain and 16 backend regressions on Node 24.21.0, scoped ESLint/Prettier, isolated typecheck and production webpack build. Shared contract/index changes exclude unrelated work; 655 local links resolve, with the two intentionally private credential-journal links excluded from version control. DEV0358 records commands, snapshot and remaining native acceptance; committing does not complete DEV0357/DEV0358 or deploy the feature.

2026-10-19 Chrome retry: user requested the outstanding checks in Chrome. A fresh native-control connection and separate Incognito window are available. Resume only the tagged temporary-fixture owner desktop/375 px file-picker/reload/replace/remove/invalid/stale/unavailable/keyboard cases; preserve earlier results and blockers as history until superseded by observed evidence.

Chrome results: normal sign-in with a newly tagged disposable coach reached its real owner detail. The native macOS picker uploaded `event.png`; “Event banner saved” and the green EVENT BANNER preview appeared. Reload retained it. Native replacement with `replacement.png` saved the orange REPLACEMENT preview; DEV0358 observed both versions on the corresponding public card. Selecting a corrupt `invalid.png` retained the saved preview and showed the precise image limits, with retry/remove/picker still usable. Load latest recovered the current image; keyboard Tab/Shift-Tab reached Remove event banner and Return removed it with explicit coach-fallback feedback. The public card then showed COACH FALLBACK. Companion reads confirmed media revisions advanced independently while published session revision 2, time, price and capacity remained unchanged.

At 375 px, the owner banner copy wrapped inside the phone layout and the native upload control opened its picker. That picker then stayed open with a selected valid PNG and disabled Open; native actions/keyboard did not complete the upload, and format-menu actions repeatedly returned “The user changed '/Applications/Google Chrome.app'” with stale state. A native-control reset did not resolve it. Cancel safely returned to the unchanged owner panel. Phone upload/replacement/removal, stale revision/load-latest/retry and unavailable-outcome UI checks are not newly passed. Later native observations omitted page content even while the preview answered HTTP 200 in 133 ms. These precise remaining checks keep AC2/AC3 open. This retry changed no application source, dependencies, configuration or retained accounts.

Cleanup completed: the companion printed `Exact fixture cleanup and 24 retained-row fingerprints passed`, and port 3158 no longer had a listener. Its interactive controller retained stdin and was interrupted only after successful cleanup. The final window-close action and subsequent observation both returned computer-control `timeoutReached`; closing the dedicated two-tab Incognito window is unverified and it may remain open. No attempt was made to close another Chrome window. Remaining work is the native acceptance above, then review/completion; existing automated checks and the fresh production build/API proof do not substitute for it.

2026-10-18 rerun: user requested retry of the outstanding native checks. Recreate only tagged temporary fixtures in the production-mode preview; resume owner desktop/375 px file-picker, reload/replace/remove/recovery plus public keyboard/filter-reset checks. Earlier blocker/evidence stays below until superseded by observed results.

Rerun outcome: the isolated production preview built successfully and its real Auth/Storage/API checks passed again (see DEV0358). Normal Firefox sign-in with the new disposable owner reached the exact owner-event URL and “Manage group session” title. Native control then returned a stale sign-in screenshot and an accessibility tree without page content or banner controls, even after selecting the exact test window through Firefox's Window menu. Coordinates also switched to the pre-existing Welcome window. The file picker, owner 375 px, keyboard and recovery cases therefore remain unverified; no acceptance criterion is newly completed. Closed only the test window and preserved the Welcome window/parallel browser work. Exact fixture cleanup and all 24 retained-row fingerprints passed. Next action: finish these cases when the native controller returns live, correctly targeted page content, or perform them manually; the application/API checks do not replace that evidence.

- `node --import tsx --test tests/event-banner-editor.test.ts tests/coach-events.test.ts`: 10 passed. Covers bounded source bytes, separate revision/header, no automatic retry, malformed/private/foreign/mismatched acknowledgements, read-only/unavailable controls and existing draft/form boundaries. `/private/tmp/dev0357-tests.log`.
- Scoped ESLint passed (`/private/tmp/dev0357-lint.log`). Combined isolated typecheck passed after DEV0358 integration (`/private/tmp/dev0358-types-final.log`); final build/native evidence still being finalized.
- Real API integration passed for upload/reload/replace/remove, invalid/stale refusals, revoked public bytes and unchanged entire group-session row; see DEV0358 and `/private/tmp/movx-dev0358-ktwyzL/evidence/production-api-proof.json`. Native normal sign-in reached the owner detail, and the desktop screenshot showed the correctly labelled saved-session uploader and its independent-save/format/fallback copy.
- Required native file-picker actions, owner 375 px, keyboard and stale/unavailable UI recovery were not completed. After reconnects and a computer-tool kernel reset, native control returned `AXError.cannotComplete`, `noWindowsAvailable`, clipboard/application timeouts and missing page accessibility content. This is a validation blocker, not a passed check. No browser automation fallback was used. The test window was closed safely; the exact fixture cleanup and all 24 retained fingerprints passed. Next action: rerun `node --import tsx --conditions=react-server scripts/rehearse-local-event-directory.ts` in its new production-mode default when native control is usable, then perform the recorded owner cases. Do not edit retained accounts to obtain evidence.

## Risks, limitations, and follow-ups

Blocked on phone replacement, stale/unavailable UI recovery and remaining phone keyboard/Chrome-specific coverage. Desktop file-picker, reload/replacement/removal, invalid feedback and keyboard removal have observed Chrome evidence; the supplemental audit adds Firefox phone upload/reload/remove. Finish the remaining cases before completing or archiving. This supplemental audit includes no commit or deployment.

## Completion and review references

- Completed: Not completed.
- Commit: Included with this record in the user-authorized DEV0350–DEV0358 public-discovery/Events commit; see Git history for this ticket.
- Review: Initial scope/work-map self-review; independent review not performed.
- Deployment or release: None.
