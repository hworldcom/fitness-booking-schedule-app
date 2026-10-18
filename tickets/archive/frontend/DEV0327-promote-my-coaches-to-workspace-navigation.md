# Ticket DEV0327: Promote My coaches to workspace navigation

- Status: Completed
- Created: 2026-10-17
- Last updated: 2026-10-18
- Milestone: M3 — Authenticated navigation refinement
- Coordination: None — independent development ticket
- Related records: menu/profile baseline [DEV0326](../../archive/frontend/DEV0326-separate-profile-from-workspace-navigation.md); connection UI baseline [DEV0223](../../archive/frontend/DEV0223-add-athlete-my-coaches.md)

## Objective and context

The user requested My sessions above Account settings in the upper-right dropdown, and My coaches moved out of My sessions into a separate left-navigation destination. The current shared connection component renders both confirmed sessions and connection lists on /sessions. Implement one navigation/presentation slice against [specification section 9](../../../docs/mvp-spec.md#9-scheduling-behavior-and-permissions), preserving existing relationship authority and history.

## Scope and non-goals

In scope: dropdown order Profile → My sessions → Account settings; an authenticated /my-coaches route and primary workspace item; separate session/connection views of the existing component; functional cross-page session/history/connection links and revalidation; specification/index and matching tests. Out of scope: database/schema/auth changes, new connection semantics, My athletes restructuring, public discovery, media processing and deployment. Preserve concurrent authentication work and uncommitted DEV0326.

## Expected behavior and edge cases

All authorized actors, including coaches acting as athletes, receive My coaches after My sessions in workspace navigation. Mobile includes the same destination with the short visible label Coaches; existing Profile/other shortcuts remain. The new page contains accepted coaches, separate incoming/outgoing/previous connection requests, current retry/pagination/history/disconnect/reconnect and public-coach/message actions. My sessions contains requests and confirmed/history session cards, retaining per-booking Connection options but no embedded coach lists or My coaches section tab. View My coaches on a session goes to /my-coaches; shared-history View session returns to /sessions#athlete-booking-ID. Coach-side history anchors and My athletes placement remain unchanged. Account route/current-state behavior is retained. Signed-out/forbidden/unavailable/empty data states remain truthful, with actor-scoped reads and no invented data. New route families use exact segment boundaries and the same workspace-sidebar omissions as My sessions.

## Assumptions, decisions, and dependencies

Confirmed: menu reorder and separate My coaches left-navigation tab. Adopted defaults: /my-coaches as the canonical independent URL; preserve mobile Profile access and add the coaches shortcut, verifying at least 44 px targets and no overflow; reuse the existing server-verified session workspace for identity/bookings and the existing connection-page actions for relationship data. A view prop separates presentation without duplicating mutation/history logic. Use one H1 on My coaches through the shared list heading. Installed Next.js 16.3.8 page/layout/pathname and redirect guides have been inspected. This is one reviewable navigation slice and needs no coordination split.

## Implementation plan

1. Reorder the shared dropdown and add authorized My coaches desktop/mobile navigation with correct current states and route boundaries.
2. Add session-only/connection-only presentation to ConnectionWorkspace, keeping coach defaults intact. Mount the connection-only view under the protected new route; render its shared title as H1.
3. Remove the embedded My coaches tab/lists from My sessions; update booking/history/group-session links and successful mutation revalidation to the new route.
4. Update current contract and relevant navigation/connection/rehearsal assertions. Verify actual components/routes at desktop/mobile widths, keyboard access, preserved connection controls/history, errors and fresh signed-out redirects; run scoped regression/lint/type/build checks.

## Acceptance criteria

- [x] AC1: Authorized dropdowns order Profile, My sessions, Account settings, with unchanged destinations/current states and keyboard behavior.
- [x] AC2: My coaches is a separate authorized primary destination; its desktop/mobile navigation is reachable, current and usable without overflow or lost Profile access.
- [x] AC3: Sessions and connection lists render on their separate pages without losing existing connection controls, shared history or cross-page links; coach-side combined presentation remains compatible.
- [x] AC4: Protected/empty/unavailable presentation, relevant regressions/static/build validation and a complete implementation record pass.

## Validation plan

Update existing menu/shell/connection presentation tests and verify separated workspace modes with actual components. Use an isolated local source snapshot with explicit actor, session/connection data and service-action fixtures while authentication is changing; distinguish UI fixture evidence from persistence proof. Exercise athlete/coach desktop/tablet/375/430 phone navigation, keyboard Enter/Tab/Escape, current links, session/connection transitions, history destinations and empty/unavailable/retry states. Check real signed-out redirects read-only against the running app where available. Run npm test, npm run lint, npm run typecheck and an isolated production build; check changed-script syntax, links and git diff --check. No shared database reset, accounts, real connection mutations or deployment.

## Implementation record

### Changes and rationale

The dropdown now orders Profile, My sessions and Account settings. The new protected /my-coaches destination follows My sessions in workspace left navigation for every authorized athlete-capable account. Mobile adds a Coaches shortcut with the full accessible name My coaches and retains Profile and existing destinations.

My sessions now renders booking requests and confirmed/history session cards without its My coaches section tab or embedded connection lists. Per-booking Connection options remain. My coaches renders the existing accepted/incoming/outgoing/previous lists and shared history, with one H1 and the same server-projected actions, empty states, retries and pagination. The existing coach-side combined booking/My athletes interface remains the default view.

Booking View My coaches links now use the canonical route; athlete shared-history View session links return to the exact original /sessions#athlete-booking-ID. Group-session navigation no longer says My coaches is embedded in private sessions. Successful connection and scheduling changes invalidate the new route as well as existing destinations.

### Affected files

- [Shared dropdown](../../../src/components/account-menu.tsx) and [primary shell navigation](../../../src/components/shell.tsx): requested ordering, authorized independent destination, exact route-family omissions and mobile label.
- [New route](../../../src/app/my-coaches/page.tsx): existing protected-page/actor-scoped workspace and connection reads, actor-keyed remount, current source-version boundary and truthful preview/unavailable handling.
- [Sessions page](../../../src/app/sessions/page.tsx) and [group-session navigation](../../../src/app/sessions/groups/page.tsx): remove the embedded list/tab and outdated combined label while retaining booking controls.
- [Connection workspace](../../../src/features/connections/connection-workspace.tsx), [lists](../../../src/features/connections/connection-lists.tsx) and [styles](../../../src/features/connections/connections.css): sessions/connections/all presentation modes, existing state/mutation/history handlers and standalone H1/spacing.
- [Booking entry](../../../src/features/connections/booking-connection-options.tsx) and [history links](../../../src/features/connections/connection-history.tsx): canonical list entry and cross-page exact-booking return; coach anchors unchanged.
- [Connection actions](../../../src/app/connections/actions.ts) and [scheduling actions](../../../src/app/coach-marketplace-actions.ts): invalidate /my-coaches after successful relationship/session changes without changing commands or authority.
- [Menu tests](../../../tests/account-menu.test.ts), [navigation tests](../../../tests/shell-navigation.test.ts), [connection tests](../../../tests/coach-connections.test.ts), [guest route checks](../../../tests/browser/authorization.spec.ts) and [athlete rehearsal](../../../scripts/rehearse-local-athlete-connections.ts): new order, route/role boundaries, original session links and separated-page navigation. The mutative legacy rehearsal was updated/syntax-checked, not rerun.
- [Specification](../../../docs/mvp-spec.md) and [index](../../README.md): adopted current placement/order and ticket lifecycle; archived DEV0326 remains historical.

### Decisions and deviations

2026-10-17: A view prop reuses one connection state/mutation implementation instead of duplicating lists or booking controls. The new page reuses the existing server-verified session workspace for actor scope and known booking IDs; a separate data adapter is unnecessary for this navigation change. Scheduling mutations must also invalidate /my-coaches because eligibility/history can change after cancellation or completion. Existing mobile Profile is retained rather than silently replaced by Coaches. No product-scope deviation.

Signed-in UI checks use explicit isolated actor/data/action fixtures while authentication is being changed independently. The actual routes/components and page authorization branches run, but these fixtures do not prove real persistence or grant real permissions. A separate read-only signed-out request against the real running app verifies its redirect.

### Contracts, configuration, and operations

Adds the canonical private /my-coaches URL and view/heading props to existing presentation components. Existing data shapes, services, actor authority, connection commands, schema, environment and dependencies are unchanged. No setup or migration is required. Temporary source snapshots contain no environment files and do not change shared accounts, database data, uploads or the user's development process. Generated application links now use the new URL; the section ID remains on its destination for canonical /my-coaches#my-coaches links.

## Validation results

2026-10-17, Node 24.21.0, Next.js 16.3.8, installed Chrome/Playwright.

- `node --import tsx --test tests/account-menu.test.ts tests/shell-navigation.test.ts tests/coach-connections.test.ts`: **passed**, 27 focused tests covering role/navigation boundaries, revised dropdown order, accepted-list behavior and canonical/original-session links.
- `npm test`: **passed**, 243 general/unit and 28 server tests (271 total). Existing consent/qualification/authority and coach-side behavior checks remain green.
- `npm run lint`, `npm run typecheck`: **passed**. Final scoped ESLint and Prettier checks for all owned application/test/rehearsal paths also passed. `node --check scripts/rehearse-local-athlete-connections.ts` passed without running the mutative rehearsal.
- `node work/dev0327/build.mjs`: **passed**, ordinary `npm run build` with Turbopack in an isolated current-source snapshot without environment files; /my-coaches is registered. Dependencies were cloned into the snapshot so no build artifacts or running development state were replaced.
- `node work/dev0327/check-ui.mjs`: **eight responsive navigation cases passed**, athlete/approved coach × 1440/768/430/375. Actual /sessions and /my-coaches page/component composition showed only the intended cards/lists, correct active navigation, preserved mobile Profile, dropdown Enter/Tab/Escape/focus/order/current state, booking Connection options → My coaches and shared history → the exact original session. There was no horizontal overflow; mobile targets remained at least 44 px. Desktop/phone screenshots were visually inspected.
- `DEV0327_ONLY_STATES=1 node work/dev0327/check-ui.mjs`: **passed** the remaining focused empty/unavailable/read-retry, acceptance presentation and signed-out/forbidden/unavailable/preview page branches, retaining the eight already-passed layout results in the combined report. Fake action acceptance moved the incoming projection into the accepted list. These are explicit actor/data/action fixtures in an owned local snapshot, not real connection mutations or persistence proof. Final report has no page JavaScript errors or external requests.
- Initial browser attempts exposed cold dev compilation, pre-hydration button clicks and measurements before styles settled. The harness now waits for interactive/stylesheet readiness and retries only its fixture reads/idempotent fixture actions. No production logic was changed to bypass these checks. Evidence is ignored under work/dev0327/evidence; the combined report distinguishes fixture limits.
- Fresh read-only requests to the actual running app at localhost:3100 returned **307 → /sign-in** for /my-coaches with returnTo=/my-coaches, and for /profile with returnTo=/profile. Initial cold requests timed out; the warmed repeat succeeded. No signed-in account, Auth setting, database data or uploaded image was changed.
- Final local-link, unique-ID/archive, owned-source/build consistency and git diff --check review passed at handoff.
- Not run: the real mutative connection rehearsal, database migration checks and hosted UAT. This change adds no schema or connection-command behavior; the legacy rehearsal's route transitions/selectors were updated and syntax/type checked without claiming a new real multi-account consent/privacy proof.

| Criterion | Evidence | Result |
| --- | --- | --- |
| AC1 | Ordered href regression and keyboard/current-state browser checks | Passed |
| AC2 | Authorized/exact-prefix navigation tests and eight responsive cases with usable mobile targets | Passed |
| AC3 | Separate actual page composition, booking-entry/shared-history round trips, retained consent/coach-side regressions | Passed |
| AC4 | Empty/unavailable/retry/guard cases; real signed-out redirect; 271 tests, lint/types/build and review | Passed |

### Commit isolation review — 2026-10-18

Prepared a clean HEAD snapshot containing only DEV0326/DEV0327/DEV0333/DEV0334 and their shared navigation prerequisites, excluding concurrent authentication, coach website, session-type, preview and operational changes. Shared shell/menu/connection modules require one combined prerequisite commit; DEV0339 follows separately. Repository-relative Markdown links resolved in the isolated snapshot, and reserved identifiers for excluded work remain unavailable for reuse.

Fresh validation: `node --import tsx --test --test-concurrency=2 tests/*.test.ts` passed 281 tests; `node --import tsx --conditions=react-server --test --test-concurrency=2 tests/server/*.test.ts` passed 45 tests (326 total). `npm run lint` passed. `npm run typecheck` passed with the temporary copy's compiler process limited by `NODE_OPTIONS=--max-old-space-size=1024`; repository package/compiler configuration is unchanged. Logs: `/tmp/dev0339/commit-prerequisites-{unit-serial,server-serial,lint-serial,types-bounded}.log`. Initial sandboxed `npm test` could not open its local IPC socket; parallel unrestricted retries timed out in four existing startup/rehearsal-runner checks under resource pressure. The two-worker retries all passed. Stopped the stalled unrestricted typechecker and reran with the memory cap successfully. No application source change was needed. Existing recorded browser/build evidence remains applicable; no database, provisioning or mutation rehearsal was rerun for this commit.

## Risks, limitations, and follow-ups

Signed-in fixture checks do not establish real persistence or hosted UAT. Old /sessions#my-coaches bookmarks are not server-redirected because URL fragments are not sent to the server; all application-generated links now use /my-coaches, whose original section ID remains available. No required work remains for this navigation slice. Concurrent authentication and DEV0326 changes are preserved; no commit or deployment was made.

## Completion and review references

- Completed: 2026-10-17 — reordered dropdown and separate protected My coaches navigation/page, with cross-page continuity and responsive/error proof.
- Commit: Included in `[DEV0326][DEV0327][DEV0333][DEV0334] Complete workspace navigation foundations`; these completed prerequisites share the shell, menu and connection-view modules required by DEV0339.
- Review: Source, responsive visual, keyboard, data-state and regression self-review passed; no independent review.
- Deployment or release: None.
