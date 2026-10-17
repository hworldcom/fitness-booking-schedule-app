# Ticket DEV0279: Open a dedicated messaging workspace

- Status: Blocked
- Created: 2026-10-17
- Last updated: 2026-10-17
- Milestone: M8 messaging interface refinement
- Coordination: None — independent development ticket
- Related records: [DEV0276](../../archive/backend/DEV0276-unify-established-coach-conversations.md) delivers normal chat; [DEV0278](../../archive/backend/DEV0278-allow-unlimited-coach-messages.md) delivers unlimited volume; [DEV0248](../../archive/frontend/DEV0248-add-shared-session-titles-and-message-filtering.md) delivers session titles/filtering. These are dependencies/historical baselines, not coordination membership.

## Objective and context

The user requested a messaging-only window like Everfit and Airbnb. Currently `/messages` is a card inside the ordinary private workspace, surrounded by the global sidebar, role/location header, demo banner, footer and mobile navigation. The page introduction and fixed panel heights further reduce room for the conversation. Deliver a focused full-viewport messaging destination under the existing route and [section 16 contract](../../../docs/mvp-spec.md#16-private-messages-and-session-notes).

## Scope and non-goals

- In scope: dedicated Messages shell with compact home/account/return controls; edge-to-edge desktop conversation list and thread; independent list/history scrolling; bottom composer; session details as an optional desktop side panel and narrow-screen detail view; mobile list/thread/back behavior; keyboard/focus, draft, empty/loading/error and route-boundary verification.
- Out of scope: new browser pop-up/tab requirements, inbox search, new messaging capabilities, notifications, attachments, approvals/quotas, provider integrations, branding/assets copied from either service, new database migrations, unrelated workspace/navigation changes or hosted deployment.

## Expected behavior and edge cases

All existing Messages entries and contact/conversation/pair links use `/messages` in the current browser tab. It opens only the compact messaging shell, list, selected chat and optional details; no global sidebar, marketing/help links, demo strip, footer or mobile bottom navigation. Home, personal Profile/account access and an actor-authorized return to My sessions or Coach workspace remain available in the small header. Preview/unavailable states remain accessible inside this route's shell; no guest gains private content.

Desktop list and message history scroll independently with the composer visible at the bottom. Mobile shows the list first, then the selected conversation with Back; details are an alternate view with a labelled close/back control. Details opening/closing preserves the mounted composer/draft and restores keyboard focus. Existing session filtering, read scope, context guards, consent/block behavior, retries and actor switching remain authoritative. No message is sent merely by opening or navigating.

## Assumptions, decisions, and dependencies

- Confirmed: messaging-only window inspired by Everfit and Airbnb. Adopted implementation: a dedicated full-height route, not a browser pop-up; desktop panes become one view at a time on narrow screens. Retain MOVX's branding and existing messaging behavior.
- Reference review on 2026-10-17: the already-open Everfit Marketplace Inbox and Airbnb guest Messages both show a compact top bar, left conversation pane and remaining message canvas. Both inspected accounts were empty; no populated thread layout was claimed. Airbnb's official [Messages guide](https://www.airbnb.com/resources/hosting-homes/a/getting-the-most-out-of-the-messages-tab-678) documents on-demand Details. No reference-service messages were sent or private conversation content copied.
- Installed Next.js 16.3.8: read bundled `usePathname` and layouts/pages documentation before changing the client shell. Keep existing providers and protected page access; use an exact `/messages` shell branch without restructuring every route.
- Review: one frontend slice owns the dedicated shell, responsive mailbox presentation and evidence. No coordination split or unresolved product choice is needed. Preserve all existing uncommitted work.

## Implementation plan

Commit preparation review on 2026-10-17 also checks the integrated messaging acceptance matrix against the delivered All/Unread interface. Correct obsolete approval wording without changing the independently owned DEV0280 runtime. Keep the specification/index staging limited to these messaging/navigation records; reserve separately allocated DEV0277/DEV0283 without including their planning scope.

1. Amend the current specification and navigation/acceptance exceptions before implementation.
2. Add a compact reusable message-shell component and render it from the existing shell only for `/messages`, preserving providers and protection.
3. Move Messages heading into the list pane, make the workspace fill the available viewport, keep pane scroll/composer usable and place optional session details beside the conversation on wide screens or in an alternate view on narrower screens. Preserve drafts and focus when toggling details.
4. Add meaningful shell render checks for actor-bound return/profile/guest states; run existing message/navigation checks, lint/type/format and an isolated production build.
5. Inspect real local desktop, 375/430 px, keyboard, long history, details/filter/draft, empty/loading/error and navigation transitions using the enabled computer-use tool. Do not send messages to existing users. Complete the implementation record and archive only after required checks pass.

## Acceptance criteria

- [x] AC1: Messages opens a dedicated full-window destination with compact escape/account controls and no ordinary workspace chrome, across normal and direct-contact/conversation entries.
- [ ] AC2: Desktop/mobile panels and composer remain usable without horizontal overflow; keyboard and detail-view focus/back navigation work.
- [ ] AC3: Existing message/context/read/draft/retry/privacy behavior remains; signed-out/unavailable states and other application routes keep their authority/navigation.
- [ ] AC4: Focused automated checks, production build, desktop/mobile/error/keyboard evidence and final contract/index/link review pass.

## Validation plan

Use static shell rendering to verify protected presentation and actor-authorized return/profile destinations without copying implementation details into tests. Run existing message/navigation tests, appropriate lint/type/format checks and `npm test`; build an isolated source copy with no populated environment files so the running development output remains untouched. Native browser review checks `/messages`, a real existing conversation and an unsent contact draft, session details/filter focus, local keyboard/draft behavior, list/history scrolling and 375/430 px layouts. Verify Home/workspace/Profile transitions and a safe unavailable/guest state. No database policy changed, so repeating the unchanged database suite or applying migrations is unnecessary.

## Implementation record

Implemented locally and uncommitted. Automated checks and the production build pass. Desktop and 375 px native-browser checks pass for the observed flows. Remaining planned interface validation is blocked by repeated computer-use service timeouts; this record is intentionally current and unfinished.

### Changes and rationale

Messages now uses a dedicated viewport shell instead of the ordinary authenticated sidebar/header/banner/footer/bottom-navigation shell. A compact MOVX header keeps Home, personal account access and an actor-authorized return to My sessions or Coach workspace. Existing protected-page access and providers remain; only the exact `/messages` path selects this presentation.

The Messages heading and filters live in the conversation list. List and history have independent scroll regions; the bottom composer remains visible. Optional request/session details occupy a 300 px side pane on wide screens and replace the chat view below 1150 px, retaining the mounted composer/draft. Close/Escape restores the original Details button; Back to conversations restores the selected list button or heading and clears stale contact/pair URL state. Session-history controls appear only when actual session contexts exist. Plain message/retry/read/block/consent data and endpoints are unchanged.

The shell listens to `visualViewport` resize at normal scale to fit its height when available, with a dynamic-viewport CSS fallback. Actual phone software-keyboard testing has not been performed.

### Affected files

| File                                                                             | Change and purpose                                                                                                                                                               |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Application shell](../../../src/components/shell.tsx)                           | Adds the compact `MessageShell`, exact Messages route selection, actor-authorized return/personal Profile presentation and viewport fitting. Other route branches remain.        |
| [Mailbox](../../../src/features/messages/mailbox.tsx)                            | Moves the heading into the list, groups list scrolling, adds details/list focus restoration, preserves the mounted draft during details and reduces irrelevant session controls. |
| [Messaging CSS](../../../src/features/messages/messages.css)                     | Full-window pane layout, independent scroll/composer sizing, responsive one-panel flow, side details and visible focus. Existing shared contact/title styles remain.             |
| [Message-shell tests](../../../tests/message-shell.test.ts)                      | Verifies athlete/applicant versus approved/demo/suspended return destinations, personal Profile access, guest/unavailable presentation and absence of ordinary chrome.           |
| [Specification](../../../docs/mvp-spec.md#16-private-messages-and-session-notes) | C40, shell/mobile acceptance exceptions and the dedicated-window behavior.                                                                                                       |
| [Ticket index](../../README.md)                                                  | Allocates DEV0279 and records the validation blocker.                                                                                                                            |

### Decisions and deviations

2026-10-17 commit review: one acceptance-matrix row still described recipient approval after its retirement. Align that interface scenario with normal first contact and no approval controls. This is a documentation correction for the integrated mailbox, not a new outreach permission. The seven fixes share shell/mailbox/specification/test hunks, so the user-authorized commit includes all seven DEV IDs and retains incomplete UI tickets as Blocked.

2026-10-17: Adopted a dedicated route in the current tab, matching both observed inboxes without adding pop-ups. Copied the layout pattern with MOVX branding; no reference assets, search, media or message features were imported. Preserved the same protected route/query contracts.

During mobile keyboard review, Back initially returned focus to the document. Added selected-row/heading restoration and cleared the contact/pair query on Back as part of this navigation refinement. The final code passes lint/type/focused tests/build; native confirmation of this last Back change remains pending.

The computer-use service subsequently timed out on the Unread-state action, then on state recovery and fresh Chrome binding after a kernel reset. No approved alternative browser-control tool was available. Retained required remaining checks and marked the ticket Blocked instead of claiming completion.

### Contracts, configuration, and operations

Interface/layout amendment only. Existing routes/query shapes, database state, message permissions, dependencies and environment variables remain. No migration or hosted deployment is required/performed by this ticket. Rollback restores the ordinary shell/mailbox presentation without deleting messages. The isolated build used explicit empty database/Auth/site/map settings and copied no populated environment files.

## Validation results

- Environment/date: 2026-10-17, Node.js 24.21.0, Next.js 16.3.8, existing loopback development app and native Chrome. No populated environment file or secret was read or printed.
- Passed: `npm test` — 209 application tests (including three new message-shell cases) plus 20 server tests, zero failures. After the final Back/focus refinement, `node --import tsx --test tests/message-shell.test.ts tests/private-messages.test.ts tests/shell-navigation.test.ts` passed all 15 focused checks.
- Passed on final source: `node_modules/.bin/eslint src/components/shell.tsx src/features/messages/mailbox.tsx tests/message-shell.test.ts`, `npm run typecheck`, focused Prettier and `git diff --check`. The first lint run rejected a children prop in a test fixture; corrected it to React's additional child argument and reran successfully.
- Passed on final source: isolated production build using `/Users/hoangdeveloper/.local/node/24.21.0/bin/node node_modules/next/dist/bin/next build --webpack` in `/var/folders/97/qxdkjfmj0_l4w87jnk_rsq6w0000gq/T/movx-dev0279-build-s5kmdzir`. Copied source/public/scripts and build configuration only, symlinked installed dependencies and explicitly emptied database/Auth/site/Geoapify settings. Compilation, TypeScript, 16 static pages and tracing passed. Rebuilt after the Back/focus amendment. The running app's `.next` was untouched.
- Passed: anonymous HTTP checks against that isolated production build on `127.0.0.1:3279` for `/messages`, a contact link and a conversation link: all returned 200 with the dedicated shell, sign-in CTA/return target and no ordinary navigation/banner/footer. `/sessions` retained its ordinary authenticated shell. The configuration-free server was stopped afterward; no fixture/Auth/database mutation occurred.
- Desktop native browser: `/messages` showed only the compact home/My sessions/account header, left list and message canvas. Opened the existing authorized conversation: header, history, optional session controls and bottom composer fit the window; no sidebar/banner/footer/bottom navigation remained. Details opened alongside the chat, Close/Escape returned focus to Details and an unsent `Unsent layout check` stayed intact. Keyboard Tab reached the session filter action; attempting it with a typed draft showed the existing guard without moving the draft/context. Cleared that draft.
- 375 × 829 px at 75% emulation: conversation had no visible horizontal overflow and kept header, session controls and Send/composer visible. Details replaced the conversation; closing restored the Details button and retained `Unsent mobile draft`. Keyboard Tab reached the composer with a visible outline. Cleared the draft and Back restored the full conversation list. No Send or block/consent decision was invoked; normal read acknowledgments may advance when existing history is displayed.
- Not completed: 430 px review, final Back-focus verification after its amendment, explicit empty/failed inbox and unavailable-thread recovery, direct-contact unsent composition and live Home/Profile/workspace return transitions. The Unread empty-state click timed out; its final browser state is unknown. Physical phone software-keyboard behavior is unverified. Existing message read/retry/context logic was preserved and covered by existing tests, but no new full two-account browser rehearsal was run.
- Not run: database tests/migrations, because no database policy/data changed. Hosted deployment and independent review were not performed.

| Criterion | Evidence                                                                                                                                         | Result  |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| AC1       | Live dedicated desktop/375 px Messages and direct conversation; actor render tests; anonymous contact/conversation route isolation               | Passed  |
| AC2       | Desktop/375 px composer, details/draft/focus proof passed; 430 px and final Back-focus check remain                                              | Partial |
| AC3       | Existing message/navigation tests, live draft guard and anonymous protection passed; remaining failure/contact/return browser cases are blocked  | Partial |
| AC4       | 229 application/server tests, 15 final focused checks, lint/type/format and final production build passed; required browser remainder is blocked | Partial |

### 2026-10-17 commit verification

`npm test` passed all 211 application and 24 server cases. `node scripts/database-baseline.mjs verify` confirmed all 53 immutable originals and generated baseline unchanged. Previously recorded checks and explicit validation limits remain applicable; no implementation or SQL changed during commit preparation. The integrated acceptance matrix was aligned with the already-delivered approval-free mailbox under DEV0279. The seven fixes share shell/mailbox/specification/test hunks and are committed together with every owning DEV ID. Independent note, invitation, calendar and authentication-planning edits are excluded. This commit does not complete missing UI evidence or deploy hosted migrations.

## Risks, limitations, and follow-ups

2026-10-17 follow-up under [DEV0280](../../archive/backend/DEV0280-retire-message-request-approvals.md): native access briefly recovered. The updated All/Unread list and existing conversation were observed at 375 px and desktop; the desktop Unread empty state and keyboard filter/list entry also passed. Responsive pointer/stepper actions remained unreliable, so 430 px and the other remaining DEV0279 scenarios are still unverified. The task-owned DevTools window and local test tab were closed after disabling emulation; closing the tab discarded the final unsent draft. Original tabs were retained. Do not use the older cleanup state below as the current browser state.

Blocker: native computer-use service repeatedly stops responding, including after kernel reset and fresh app selection. Resume with a fresh browser inventory once it is responsive; finish the remaining browser scenarios above, restore the original 1412 × 829 responsive dimensions and close only this task's DevTools/test tab, then complete and archive the record. Last confirmed test state was this task's local Messages list at 375 × 829 / 75%, with the unsent draft cleared; a later Unread click has no confirmed result. Original user tabs remain open. The task-owned undocked DevTools window could not be closed after the service failed.

No search, message editing or new reference-product messaging capability is included. Actual physical phone software-keyboard behavior remains a stated limitation. Preserve unrelated local navigation, normal/unlimited-chat, invitation, notes and calendar work.

## Completion and review references

- Completed: Not completed.
- Commit: `[DEV0275][DEV0276][DEV0278][DEV0279][DEV0280][DEV0281][DEV0282] Refine workspace navigation and messaging` — user-authorized local commit on 2026-10-17.
- Review: Source/contract and final focused/build self-review passed; required interface validation remains. Independent review not performed.
- Deployment or release: Available in the running local development app; not deployed or committed.
