# Ticket DEV0326: Separate Profile from workspace navigation

- Status: Completed
- Created: 2026-10-17
- Last updated: 2026-10-18
- Milestone: M3 — Authenticated navigation refinement
- Coordination: None — independent development ticket
- Related records: account-menu baseline [DEV0290](../../current/frontend/DEV0290-add-account-navigation-dropdown.md); settings baseline [DEV0294](../../current/frontend/DEV0294-add-separate-account-settings.md); workspace design [COR0018](../../current/organisatory/COR0018-authenticated-workspace-redesign.md)

## Objective and context

The user requested Profile above Account settings in the upper-right dropdown, removal of Profile from the workspace's left side and an independent Profile page. Currently the dropdown has Account/My sessions, both left navigation and its account card link to Profile, and coach Profile carries scheduling-workspace chrome. Update the [navigation contract](../../../docs/mvp-spec.md#9-scheduling-behavior-and-permissions) without changing profile data or authority.

## Scope and non-goals

In scope: shared signed-in dropdown, workspace sidebar Profile links/card, standalone personal/coach profile framing, coach view navigation and matching specification/tests. Out of scope: profile content redesign, public coach websites, authentication, database/media operations, new routes and deployment. Concurrent authentication/coach-website edits are independent and must be preserved.

## Expected behavior and edge cases

Dropdown order is Profile, Account settings, My sessions. Profile retains the existing capability-aware destination: approved/demo coaches use /profile/coach; other authorized accounts use /profile. Account settings remains /account. Unauthorized actors receive no personal dropdown. Both profile routes use a compact independent header/main with no workspace sidebar/footer/mobile bar. Profile is absent from the left navigation and bottom-left account card; scheduling tabs contain Schedule, Bookings and Events, while profile editing has its own title and an approved/demo owner return to Coach workspace (pending/rejected drafts return to personal Profile). Existing mobile workspace Profile shortcuts remain and open the independent page. Exact route boundaries prevent /profile-other from receiving profile framing. Existing privacy, forms, drafts, unavailable states and keyboard disclosure behavior remain.

## Assumptions, decisions, and dependencies

Confirmed: requested menu placement/wording, left-side removal and page independence. Adopted defaults: use conventional plural “Account settings”; preserve actor-aware Profile destination and mobile shortcuts; remove coach Profile from scheduling view tabs so the editor is independent there too; reuse the compact Account shell rather than duplicate a header. No permission or data-contract changes. Installed Next.js 16.3.8 layout/usePathname bundled guides inspected before route-dependent changes. This is one small navigation/presentation slice; no coordination split needed.

## Implementation plan

1. Add capability-aware Profile before renamed Account settings in the shared dropdown; preserve disclosure/focus handling.
2. Remove desktop sidebar Profile links/account card and separate profile routes through the existing compact shell with route-aware current states, skip link and bounded content.
3. Give coach Profile its own heading/return instead of scheduling tabs; retain publication information and all editor controls. Remove Profile from coach workspace tabs.
4. Update the current specification and relevant regression assertions. Verify athlete/coach desktop/mobile navigation, keyboard menu/focus, route/direct access, error presentation and unaffected Account/Messages/workspace destinations; run applicable unit, lint, type and build checks.

## Acceptance criteria

- [x] AC1: Every authorized header dropdown exposes Profile, Account settings and My sessions in that order with correct destinations/current states; unauthorized states expose no private links.
- [x] AC2: Workspace left navigation/account card omit Profile; coach scheduling tabs omit Profile. Existing sessions, Messages, workspace and mobile shortcut destinations remain available.
- [x] AC3: Personal and coach Profile render independently at desktop/mobile widths with usable forms/header, correct skip/current-link behavior and return navigation; access/error boundaries remain intact.
- [x] AC4: Applicable regression/static checks pass and the specification/record explain delivered behavior and limitations.

## Validation plan

Update existing menu/navigation/shell/coach-view regression checks; exercise actual components in a local browser at 1440, 768, 430 and 375 px with athlete/coach actor states, keyboard Enter/Tab/Escape and unauthorized/unavailable rendering. Prefer isolated presentation fixtures if active auth changes prevent stable signed-in integration; distinguish fixture proof from real server authority. Use existing app/read-only routes where safe. Run focused unit checks, npm run lint, npm run typecheck and an isolated build if needed; no shared database reset, account provisioning or private writes. Link checks and git diff --check complete the review.

## Implementation record

### Changes and rationale

The shared signed-in menu now lists Profile, Account settings and My sessions in that order. Approved/demo coaches open /profile/coach; other authorized actors open /profile. Both profile route families reuse the compact Account header and a centered paper-background main rather than workspace chrome. Personal photo editing and coach publication/media/location forms remain intact. The desktop Profile navigation item and bottom-left account card are removed; mobile workspace Profile shortcuts remain.

Coach editing has a Profile title/publication summary and an eligible owner return to Coach workspace, without the scheduling view tabs. Pending/rejected drafts return to personal Profile. Workspace tabs are Schedule, Bookings and Events. The menu resets its disclosure on route, identity or coach-capability changes and retains its existing keyboard/outside-dismissal behavior.

### Affected files

- [Shared dropdown](../../../src/components/account-menu.tsx): ordered destinations, settings wording/icon, capability-aware Profile target and disclosure reset.
- [Route shell](../../../src/components/shell.tsx): exact Profile segment classification, independent framing and desktop Profile/card removal while preserving mobile destinations.
- [Compact page shell](../../../src/components/account-shell.tsx) and [styles](../../../src/app/account-settings.css): route-aware skip/current states, bounded standalone spacing and existing Messages/menu header.
- [Coach editor](../../../src/features/coaches/coach-profile-editor.tsx), [header](../../../src/features/coaches/coach-workspace-header.tsx) and [tabs](../../../src/features/coaches/coach-workspace-navigation.tsx): independent title/return and scheduling-only tabs without changing editor operations.
- [Menu tests](../../../tests/account-menu.test.ts), [shell navigation tests](../../../tests/shell-navigation.test.ts), [message-shell tests](../../../tests/message-shell.test.ts), [coach-view tests](../../../tests/coach-schedule.test.ts) and [browser profile framing](../../../tests/browser/public-story.spec.ts): destination/authority, exact prefix, publication/return and standalone regressions.
- [Profile-image rehearsal](../../../scripts/rehearse-local-profile-images.mjs) and [availability rehearsal](../../../scripts/rehearse-local-coach-availability.mjs): update old sidebar/header-avatar and Profile-tab selectors to current menu/framing; these mutative rehearsals were not rerun.
- [Specification](../../../docs/mvp-spec.md), [ticket index](../../README.md) and downstream note in [COR0018](../../current/organisatory/COR0018-authenticated-workspace-redesign.md): current contract, lifecycle and earlier design relationship.

### Decisions and deviations

2026-10-17: Kept existing mobile workspace Profile shortcuts because the user requested removal from the left side; the destination itself is independent at every width. Removed coach Profile from scheduling tabs to avoid a second workspace presentation of the same page. Reused the existing compact shell rather than introducing another header. Applicant return stays personal so the new return action does not imply scheduling capability.

Browser validation uses explicit isolated actor/page fixtures because concurrent authentication work is active. Actual menu/shell/personal Profile/coach editor components are exercised, with all writes blocked and API requests unavailable. This proves presentation/navigation, not real authentication, media saving or persistence. Separate fresh signed-out requests against the real running app additionally verify unchanged redirects.

### Contracts, configuration, and operations

No data/API/schema/dependency/environment changes, setup steps or migrations. Existing URLs, server authorization, private/public image boundaries and saves remain authoritative. The compact shell accepts an optional pathname (default /account), and the shared coach heading accepts a profile variant/return. Temporary source snapshots contain no environment files; no shared database, account, booking, uploaded image or running development process was changed. No commit or deployment.

## Validation results

2026-10-17, Node 24.21.0, Next.js 16.3.8 and installed Chrome/Playwright.

- `npm test`: **passed**, 243 general/unit and 28 server checks (271 total), including the final applicant return and Profile route boundary. Initial sandbox invocation failed before tests because the runner could not open its local IPC socket; the same command passed with local IPC access.
- `node --import tsx --test tests/account-menu.test.ts tests/shell-navigation.test.ts tests/message-shell.test.ts tests/coach-schedule.test.ts`: **passed**, 26 focused checks.
- `npm run lint`, `npm run typecheck`: **passed**. A temporary validation helper's unused import warning was removed before the final lint rerun.
- `node work/dev0326/final-build.mjs`: **passed** ordinary `npm run build` with Turbopack in an isolated copy of the current source without environment files. The initial snapshot dependency symlink was rejected as outside Turbopack's root; cloning dependencies into the snapshot resolved the environment issue. The final build includes the final return/menu files; the user's app build/state was not replaced.
- `node work/dev0326/check-ui.mjs`: **passed** 20 actor/viewport combinations (ordinary athlete, approved coach, pending, rejected, suspended × 1440/768/430/375). Verified ordered links/destinations, active states, actual profile form visibility, retained unsaved coach name through menu use, no Profile sidebar/card or editor scheduling tabs, retained mobile Profile, workspace return, Account/Messages headers, no horizontal overflow, keyboard Enter/Tab/Escape/focus restoration/skip link, same-route close, outside dismissal, exact prefix and signed-out/unavailable presentation. No page JavaScript errors or writes. External map requests were blocked and the existing map fallback remained usable. Initial harness runs needed a longer first-compilation timeout and an outside-click target outside the open menu; the corrected final run passed.
- Screenshots of the actual personal/coach components at desktop/phone widths were visually inspected. Evidence/metrics are ignored under work/dev0326/evidence. Fixtures use no real identity or private data and are not imported by application code.
- Fresh read-only requests to the real running app at localhost:3100 returned **307** to /sign-in for /profile and /profile/coach, retaining the exact returnTo; /account retained its canonical /account?section=personal-details return. No signed-in account was changed.
- Scoped Prettier, JavaScript syntax checks for the two updated rehearsal scripts, local Markdown links and git diff --check pass during final review.
- Not run: database/media mutation rehearsals and hosted UAT; persistence/authorization operations did not change. The updated legacy rehearsal selectors were reviewed/syntax-checked, without claiming a new end-to-end upload/calendar proof.

| Criterion | Evidence | Result |
| --- | --- | --- |
| AC1 | Capability-aware menu/unit assertions and all 20 browser combinations; unauthorized dropdown absent | Passed |
| AC2 | Sidebar/card and scheduling-tab checks plus desktop/mobile route tests | Passed |
| AC3 | Actual profile forms/header, keyboard, draft, error/boundary checks; real signed-out redirects | Passed |
| AC4 | 271 tests, focused 26, lint/types/build, formatting/link/scope review and updated specification | Passed |

### Commit isolation review — 2026-10-18

Prepared a clean HEAD snapshot containing only DEV0326/DEV0327/DEV0333/DEV0334 and their shared navigation prerequisites, excluding concurrent authentication, coach website, session-type, preview and operational changes. Shared shell/menu/connection modules require one combined prerequisite commit; DEV0339 follows separately. Repository-relative Markdown links resolved in the isolated snapshot, and reserved identifiers for excluded work remain unavailable for reuse.

Fresh validation: `node --import tsx --test --test-concurrency=2 tests/*.test.ts` passed 281 tests; `node --import tsx --conditions=react-server --test --test-concurrency=2 tests/server/*.test.ts` passed 45 tests (326 total). `npm run lint` passed. `npm run typecheck` passed with the temporary copy's compiler process limited by `NODE_OPTIONS=--max-old-space-size=1024`; repository package/compiler configuration is unchanged. Logs: `/tmp/dev0339/commit-prerequisites-{unit-serial,server-serial,lint-serial,types-bounded}.log`. Initial sandboxed `npm test` could not open its local IPC socket; parallel unrestricted retries timed out in four existing startup/rehearsal-runner checks under resource pressure. The two-worker retries all passed. Stopped the stalled unrestricted typechecker and reran with the memory cap successfully. No application source change was needed. Existing recorded browser/build evidence remains applicable; no database, provisioning or mutation rehearsal was rerun for this commit.

## Risks, limitations, and follow-ups

Signed-in browser validation uses isolated actor/data fixtures, not live server authority or persistence. Existing media/form services and unavailable states remain; no hosted deployment is claimed. Concurrent authentication/coach-website changes remain separate. No required work remains for this presentation slice.

## Completion and review references

- Completed: 2026-10-17 — ordered Profile/settings dropdown and independent profile framing with desktop/mobile/keyboard proof.
- Commit: Included in `[DEV0326][DEV0327][DEV0333][DEV0334] Complete workspace navigation foundations`; these completed prerequisites share the shell, menu and connection-view modules required by DEV0339.
- Review: Source, visual, responsive, keyboard/error and test self-review passed; no independent review.
- Deployment or release: None.
