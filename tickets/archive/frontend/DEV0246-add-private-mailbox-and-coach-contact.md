# Ticket DEV0246: Add private mailbox and coach contact

- Status: Completed
- Created: 2026-10-15
- Last updated: 2026-10-15
- Milestone: M8 private messages
- Coordination: [COR0022 — Private messaging and booking context](../organisatory/COR0022-private-messaging-and-booking-context.md)
- Related records: authority dependency [DEV0244](../backend/DEV0244-persist-private-message-authority.md); integrated action dependency [DEV0245](../backend/DEV0245-integrate-messages-with-scheduling-and-connections.md); proof consumer [DEV0247](../backend/DEV0247-rehearse-private-messaging-loop.md); independent design reference [DEV0242](../../current/frontend/DEV0242-preview-training-navigation-and-request-badges.md); separate note consumer [COR0015](../../current/organisatory/COR0015-session-notes-and-training-plans.md)

## Objective and context

Deliver the [M8 private interface](../../../docs/mvp-spec.md#166-interface-and-session-note-boundary) so athletes can contact coaches before selecting a session and both participants can follow messages/request cards in one ongoing conversation. Incoming work must appear in already-open pages without an undocumented reload.

## Scope and non-goals

- In scope: protected Messages routes, common private navigation/badge, public Message coach/sign-in return composition, list/selected conversation/Details, context composer, general-message request decisions, removal/block/unblock feedback, All/Unread/Message requests, bounded paging and visibility-aware refresh/read state.
- Out of scope: database permission logic, booking decisions duplicated inside chat, renaming My sessions to the DEV0242 proposal, runtime session-note editors, group messages, search, attachments, read receipts, reporting operations and notification delivery.

## Expected behavior and edge cases

Message coach opens composition and never sends from a link or sign-in. Unconnected inquiry/request service contact is distinct from general message consent. A selected conversation keeps one original pair/thread; request cards show actual state and authorized review/detail links. A pending message request offers explicit accept/decline and permits no additional general text before consent. Removal, blocking and fixed booking windows use server results and clear context labels, without hiding or overwriting retained history.

Desktop presents one active task with optional Details; mobile uses drill-down/back rather than squeezed columns. Refresh on entry/focus/visibility and every 30 seconds while visible, stopping while hidden. Stable response versions/identities prevent stale responses overwriting new state; soft refresh updates component data without resetting drafts/focus. Read only through displayed entries, preserving concurrent unseen work. Errors preserve authorized unsent drafts and distinguish unavailable from empty/zero; switching actors clears old content.

## Assumptions, decisions, and dependencies

- Start on DEV0244's validated projections; integration-dependent controls cannot complete before DEV0245. Use real actions rather than fake UI success.
- Preserve the existing workspace style, actor-aware Profile and My sessions/Coach workspace destinations. Coordinate shared shell files with independent M7/Explore work.
- Read the installed Next.js guides relevant to route/actions/cache refresh before implementation. Details use original authorized booking routes; no working notes editor is claimed before COR0015.

## Implementation plan

1. Inspect current shell, public coach profile, session/history entry points and delivered backend contracts; establish protected/canonical message/context navigation.
2. Build list/thread/Details, contact composition and consent/block controls with precise empty/unavailable/permission/status feedback.
3. Integrate paging, submission recovery, authoritative unread/read state, actor-bound reconciliation and visible-page refresh without draft/focus loss.
4. Add mobile/desktop/keyboard/screen-reader behavior and failure/race component/browser coverage; preserve existing scheduling controls.
5. Perform real two-account local UI review and record exact commands/results before completion; DEV0247 supplies broader combined proof.

## Acceptance criteria

- [x] AC1: A signed-in athlete contacts a visible coach before any request/connection; signed-out return-to-compose sends nothing automatically.
- [x] AC2: One ongoing pair conversation exposes real request/booking cards, exact service/general permissions and explicit consent/block decisions, without candidate/private-note data.
- [x] AC3: Already-open receiving pages show incoming work under the freshness policy; unread/read races, paging, actor switch and stale refreshes preserve correct state/drafts/focus.
- [x] AC4: Keyboard and mobile/desktop flows retain context, visible controls and truthful pending/error/unavailable results; original booking decisions/details work.
- [x] AC5: Focused component/browser, relevant existing regressions, lint/type/format/build checks and real local UI observations pass with accurate limitations.

## Validation plan

Run affected unit/component tests and `npm run test:e2e` scenarios with two already-open authenticated contexts; verify 375/430 px and desktop widths, keyboard-only navigation, read/consent/send races, hidden-tab refresh, errors and actor switching. Use actual backend permissions and inspect serialized responses for candidate/private-note isolation. Run `npm run lint`, `npm run typecheck`, `npm run format:check` and `npm run build`. Save observations/screenshots only as supporting evidence; the ticket must explain outcomes.

## Implementation record

### Changes and rationale

Delivered a protected Messages destination for both capabilities, a private unread-conversation badge, Message coach on public profiles and Message coach/athlete on accepted connections. Guest contact returns to composition after sign-in and never auto-sends. The desktop list/thread/optional Details layout becomes mobile drill-down with Back. All/Unread/Message requests filters, bounded older-page controls, explicit inquiry/session/general contexts, consent accept/decline/withdraw and block/unblock all use real server results.

### Affected files

- [Messages page](../../../src/app/messages/page.tsx), [client workspace](../../../src/features/messages/mailbox.tsx) and [styles](../../../src/features/messages/messages.css): protected navigation, conversation/history/Details, composer, retry/error/status feedback and responsive layout.
- [Private API](../../../src/app/api/messages/route.ts): verified server service, private/no-store GET, same-origin JSON POST and streamed 32-KiB envelope bounds. [Shared client](../../../src/messages/client.ts) and [unread hook](../../../src/messages/use-unread-messages.ts): bounded fetch timeouts, safe response parsing and actor-bound refresh.
- [Shell](../../../src/components/shell.tsx), [layout](../../../src/app/layout.tsx), [coach profile](../../../src/app/coaches/[slug]/page.tsx) and [connection actions](../../../src/features/connections/connection-lists.tsx): real entry points without renaming My sessions or replacing independent Explore styles.
- [Navigation checks](../../../tests/shell-navigation.test.ts) and [rehearsal](../../../scripts/rehearse-local-private-messages.ts): capability-aware navigation and real responsive flows.

### Decisions and deviations

Shared client/badge code lives outside feature modules to preserve the existing shell import boundary. Refreshes coalesce; queued reads and revision guards discard pre-mutation responses. They stop while hidden, resume on visibility/focus and run every 30 seconds while visible. Refresh preserves textarea state/focus. Composer context is chosen on initial load and then retained: a permission change cannot silently reattach an inquiry draft to a booking.

A lost acknowledgement retains the exact submission/body until retry reconciliation; a definitive conflict/rate rejection permits draft editing. Read markers use entries observed in the active visible history viewport, never the server's unseen latest sequence. Pending consent stays explicit even after reading. Actor-scoped component identity and access-loss handling clear old private state; drafts are not persisted in browser storage.

### Contracts, configuration, and operations

Uses DEV0244 DTOs and DEV0245 integration. No new product environment setting or provider. Text is rendered as React text, preserving line breaks without HTML interpretation. Details exposes verified original source facts and links to existing authorized workspace decisions/session history; older records may require that workspace's existing pagination. No note editor is fabricated and no booking action is duplicated in chat.

## Validation results

`node --import tsx --conditions=react-server scripts/rehearse-local-private-messages.ts` passed against the running local app. The documented `npm run test:private-messages` alias now invokes that exact command.

- `node --import tsx --test tests/*.test.ts`: 146 passed; `node --import tsx --conditions=react-server --test tests/server/*.test.ts`: 15 passed.
- `DATABASE_TEST_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres node --import tsx --conditions=react-server --test --test-concurrency=1 tests/database/*.test.ts`: 76 passed. The mailbox parent and 16 subtests contribute 17 checks; all fixtures roll back or use exact test-owned cleanup.
- `npm run db:test`: 11 files / 206 pgTAP checks passed. `npm run db:lint`: no schema errors or warnings after the explicit JSON cast.
- `npm run lint`, `npm run typecheck`, `npm run format:check` and `npm run build`: passed in the final standard-command run. `npx next build --webpack` also passed. The first sandboxed Turbopack process stalled and was stopped; the normal build succeeded outside that restriction.

`npm run test:private-messages` runs the real Auth-enabled local app with newly tagged accounts and exact cleanup. It verifies guest return-to-compose; pre-request literal-text inquiry/reply; two already-open recipients; focus and 30-second arrival; draft/focus preservation; lost-acknowledgement retry saving one text; explicit read failure/recovery; general-consent decisions; original request/booking Details; unrelated actor and hostile-Origin denial; 375px/430px athlete/coach and 1440px desktop layouts; block/unblock and explicit permitted booking context. The final rehearsal also passed hidden-page polling, visibility restoration, account switching and both coach/athlete mobile navigation. Ignored screenshots are under `test-results/private-messages-rehearsal/` and were visually reviewed.

AC1–AC5 passed. The final standard unit/server, lint/type/format/build commands and source review passed on 2026-10-15.

`python3 work/validate-dev0247-delivery.py` passed: 14 documentation files, 378 local links/anchors, 11 statuses/index paths, reciprocal flat work maps and reserved IDs. `git diff --check` passed. This local documentation checker is an ignored working artifact; the ticket records its checks/results rather than claiming it is a shipped application command.

## Risks, limitations, and follow-ups

This version polls; it does not promise instant delivery or send push/email notifications. No attachments, recipient read receipts, message edits/deletes, group messaging, reporting operations or session-note editor. Hosted delivery remains separate; notes/plans remain COR0015.

## Completion and review references

- Completed: 2026-10-15 — AC1–AC5 passed; implementation, validation and source review complete.
- Commit: Included in the user-authorized DEV0243–DEV0247 delivery commit; see Git history for its hash.
- Review: Local desktop/mobile visual and keyboard self-review, executable browser/database/static checks; no independent review.
- Deployment or release: Local running app only; not a hosted release.
