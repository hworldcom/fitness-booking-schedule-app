# Ticket DEV0290: Add account navigation dropdown

- Status: Blocked
- Created: 2026-10-17
- Last updated: 2026-10-17
- Milestone: Authenticated navigation refinement
- Coordination: None — independent development ticket
- Related records: [DEV0281](DEV0281-show-message-avatars-and-header-entry.md) owns existing Messages entry/photo refinement; [DEV0284](DEV0284-simplify-personal-profile-sidebar.md) owns the personal sidebar omission; [COR0027](../organisatory/COR0027-login-registration-and-social-authentication.md) is independent authentication planning, not a dependency or implementation owner here.

## Objective and context

The user requested an Everfit Marketplace style dropdown behind the upper-right profile control, with MOVX destinations Account and My sessions. They additionally requested a three-line menu icon like Airbnb to make the control obvious. Existing avatar controls directly navigate to personal Profile. Follow the [account navigation and private workspace contract](../../../docs/mvp-spec.md#9-scheduling-behavior-and-permissions).

## Scope and non-goals

- Reuse one account dropdown in public, private workspace and dedicated Messages headers, with a three-line icon beside the existing avatar/initials.
- Account opens `/profile`; My sessions opens `/sessions` for every authorized actor, including coaches. Move the public header's standalone My sessions link into this menu; retain Messages, authorized coach workspace, private sidebars and mobile bottom navigation.
- Keep current AuthStatusLink/sign-in management behavior, avatar privacy/fallback, route authority and profile editing unchanged. No copied branding/assets, new logout/authentication behavior, third menu item, new dependency, database or configuration change.

## Expected behavior and edge cases

The control is a button with an accessible name and expanded state. Click, Enter or Space toggles the dropdown; Tab reaches its two ordinary links. Escape closes and restores trigger focus; outside pointer/focus and choosing a link close it. Route or actor changes reset open state. Closed content is hidden from focus/accessibility. Unauthorized/preview/unavailable actors get no private dropdown. Menu sizing and touch targets fit phone widths and do not clip behind the header or message canvas. Account always means personal Profile, including for a coach whose main sidebar Profile opens coach Profile.

## Assumptions, decisions, and dependencies

Confirmed: Account and My sessions dropdown, and a three-line trigger icon. Defaults: apply consistently to all three existing upper-right avatar surfaces; move the public My sessions shortcut instead of duplicating it, keeping header width bounded; preserve existing sign-in/account-status control because it owns current session management. Use a disclosure with ordinary links, not application-menu roles that imply different keyboard behavior. Installed Next 16.3.8 Link documentation was inspected. This is one small frontend slice; no coordination split or unresolved product choice is needed.

## Implementation plan

1. Create the shared actor-bound disclosure with avatar fallback, controlled visibility and outside/Escape/focus dismissal.
2. Integrate the three headers and remove only the duplicate public My sessions shortcut; add shared responsive styles.
3. Update current specification and existing navigation/message-shell tests; add meaningful authorized/unauthorized and personal-account presentation coverage.
4. Verify focused/full tests, lint/types/format, isolated production build and desktop/mobile keyboard/dismissal/navigation behavior using native browser control. Record any missing required evidence accurately.

## Acceptance criteria

- [ ] AC1: Authorized profile/menu button has three lines plus avatar and opens exactly Account and My sessions with correct destinations in each header.
- [ ] AC2: Click/keyboard, Escape/focus restoration, outside dismissal and route/actor resets work; closed links are not focusable.
- [x] AC3: Unauthorized users gain no private controls; personal/coach separation, avatar privacy, Messages/coach access and mobile navigation remain correct.
- [ ] AC4: Desktop/mobile and error/fallback presentation, automated checks and implementation/specification/index records are verified.

## Validation plan

Use existing navigation/profile/message-shell tests plus bounded rendering tests for unauthorized actor exclusion, exactly two personal destinations and safe avatar/initials presentation. Native browser checks cover opening, both destinations, Escape/outside/Tab, route changes and narrow viewports. Run relevant tests, focused ESLint/Prettier, `npm run typecheck`, a configuration-free isolated production build and local link/diff checks. No database checks are needed because permissions, storage and data are unchanged. Never submit forms, messages or external account actions while reviewing references.

## Implementation record

### Changes and rationale

Added one shared AccountMenu disclosure to all three upper-right signed-in header surfaces. A rounded button combines the requested three-line icon and existing avatar/initials; the panel contains ordinary Account and My sessions links. Account always opens personal `/profile`, including for approved coaches; My sessions opens `/sessions`. Public-header My sessions now lives in the dropdown, avoiding a duplicate and making room for the wider icon/avatar trigger. Messages, authorized Coach workspace, sidebars, mobile bottom navigation and existing sign-in/session management remain.

The button exposes its expanded state and controlled panel ID. Native hidden content keeps closed links out of focus and accessibility. Enter/Space use normal button semantics; pointer/focus outside closes the panel, Escape closes and restores trigger focus, and choosing a link closes/restores focus before navigation (including same-route selection). A route/actor-scoped child key resets open state on navigation or account/dataset change. These transitions are implemented but final live interaction evidence is blocked below.

### Affected files

| File                                                                                                                | Change and purpose                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Account menu](../../../src/components/account-menu.tsx)                                                            | Shared authorized-only disclosure, two destinations, actor/route reset, focus/outside/Escape handlers and existing avatar preference.                                                           |
| [Shell](../../../src/components/shell.tsx)                                                                          | Replaces all three direct header avatar links with the shared menu and removes only the standalone public My sessions shortcut.                                                                 |
| [Styles](../../../src/app/account-menu.css), [root layout](../../../src/app/layout.tsx)                             | Shared rounded trigger/panel, 44px targets, visible focus, bounded viewport size and global style import.                                                                                       |
| [Messages styles](../../../src/features/messages/messages.css)                                                      | Removes obsolete direct-avatar-only messages-account styling; dedicated shell behavior otherwise remains.                                                                                       |
| [Account menu tests](../../../tests/account-menu.test.ts)                                                           | Proves unauthorized exclusion, exactly two personal destinations across all coach states, initially hidden controls, private-avatar preference, portrait/initial fallback and escaped identity. |
| [Shell tests](../../../tests/shell-navigation.test.ts), [message-shell tests](../../../tests/message-shell.test.ts) | Align public shortcuts and preserve coach return/personal account separation with the two-link dropdown.                                                                                        |
| [Specification](../../../docs/mvp-spec.md#9-scheduling-behavior-and-permissions), [index](../../README.md)          | Records adopted dropdown/three-line cue, two routes, retained navigation and current delivery evidence.                                                                                         |

### Decisions and deviations

Reference review on 2026-10-17: the live Everfit Marketplace accessibility tree showed an initials button and an open compact list containing My Account and other reference-only actions. Only the two user-selected MOVX destinations and requested three-line cue are adopted. Screenshot capture returned a blank page, so no exact visual reproduction is claimed.

2026-10-17 subsequent user request: [DEV0294](DEV0294-add-separate-account-settings.md) owns a separate `/account` destination, superseding this record's initial Account → `/profile` routing choice. This record preserves its original implementation history; the shared dropdown remains the integration baseline and its outstanding interaction evidence remains open.

### Contracts, configuration, and operations

Presentation/navigation contract only. Existing route permissions and image contracts remain. No data, environment, dependency, migration or deployment changes.

## Validation results

2026-10-17 combined checkpoint: DEV0294 changes the Account item to its actual `/account` destination; the original menu implementation/blocked interaction evidence remains below. Current application/server checks pass 244 tests, lint/format/type/build checks pass, and Account settings SQL passes 30 rollback-only assertions. This does not close the outstanding dropdown/browser criteria.

- Environment: 2026-10-17, Node 24.21.0, Next 16.3.8, local app on localhost:3100. No external account action or form submission.
- Passed `node --import tsx --test tests/account-menu.test.ts tests/shell-navigation.test.ts tests/profile-navigation.test.ts tests/message-shell.test.ts`: 19 focused tests.
- Passed `npm test` with the existing tsx IPC permission: 214 application and 24 server tests (238 total). These are rendering/authority/navigation checks, not proof of live dropdown interactions.
- Passed `npm run typecheck`, focused ESLint on the new component/shell/layout and three affected tests, focused Prettier on all changed implementation/tests and this ticket, and `git diff --check`.
- Passed isolated production build with explicit Node 24 and `node_modules/next/dist/bin/next build --webpack` in `/var/folders/97/qxdkjfmj0_l4w87jnk_rsq6w0000gq/T/movx-dev0290-build-hw9aind0`: compile, TypeScript, all 16 static pages and traces. Database/Auth/site/map settings were empty; no populated environment files copied and the live development `.next` was not used for this build.
- Desktop native Chrome at 1390×768: after an explicit Reload, local fictional Max’s Profile showed the three-line icon plus initials in a rounded upper-right control, beside retained Messages and existing Account/sign-in management. The cleaned sidebar and Profile content remained. A screenshot confirmed the trigger presentation. The reference Everfit menu was read through its already-open accessibility tree; its screenshot was blank.
- Cleanup: closed only the task-created local Profile tab and observed return to the previously selected reference tab. Existing tabs and accounts were retained; no responsive-mode change was confirmed.
- **Blocked interactions/mobile:** native AX click and Return attempts on the visible Account menu button did not produce a reliably changed open state. A fresh AX tree continued showing only the trigger; later screenshots were blank. Direct pointer input failed with `noWindowsAvailable`, and `cua.listBrowsers()` returned no direct browser provider. Browser state sometimes reported user activity changes. Consequently opening/closing, Escape focus, outside dismissal, destination transitions, actor reset, public/Messages live layouts and phone-width checks remain unverified. Do not report attempted input as passed behavior. The new controlled disclosure uses standard React/button/link mechanics; no production fault was established from failed native input.
- Not run: database tests because no database, authorization or Storage behavior changed. Hosted deployment and independent review were not performed.

| Criterion | Evidence                                                                                                                                                         | Result  |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| AC1       | Desktop three-line/avatar trigger observed; all header integrations/two correct personal links verified in source/render tests. Live opening remains unverified. | Partial |
| AC2       | Dismissal/reset/hidden semantics implemented and reviewed; SSR proves initially hidden content, but live state transitions/focus remain unavailable.             | Blocked |
| AC3       | Unauthorized exclusion, all coach capabilities, image preference/fallback and retained mobile/coach navigation pass automated checks.                            | Passed  |
| AC4       | 238 tests, lint/types/format and isolated build passed; desktop trigger confirmed. Mobile/error/dismissal browser proof remains.                                 | Partial |

## Risks, limitations, and follow-ups

Implementation and automated/build evidence are present, but this record stays current/Blocked because final live interaction and responsive evidence is missing. Next action with functioning native browser input: open the control, verify Account/My sessions navigation in public/private/Messages shells, Enter/Space/Tab/Escape, outside pointer/focus, same-route selection and account/route resets; inspect phone widths and a broken/missing image fallback. Complete/archive only after those checks pass. No new dependencies, authentication behavior, deployment or commit were introduced. Preserve unrelated authentication, invitation, note and calendar work.

## Completion and review references

- Completed: Not completed.
- Commit: This user-authorized workspace checkpoint includes the dropdown implementation/evidence (subject includes DEV0290). Live interaction/mobile criteria remain Blocked; commitment is not completion or deployment.
- Review: Self-reviewed source, capability/media boundaries, two-link scope, navigation/reset/dismissal mechanics and validation limits. No independent review; required UI proof remains open.
- Deployment or release: None.
