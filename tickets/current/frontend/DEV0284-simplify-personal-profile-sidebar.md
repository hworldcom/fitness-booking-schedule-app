# Ticket DEV0284: Simplify personal Profile sidebar

- Status: Blocked
- Created: 2026-10-17
- Last updated: 2026-10-17
- Milestone: Authenticated workspace refinement
- Coordination: None — independent development ticket
- Related records: Sidebar baseline [DEV0275](../../archive/frontend/DEV0275-simplify-my-sessions-sidebar.md); private-header refinement [DEV0282](DEV0282-remove-private-header-help-link.md).

## Objective and context

Personal `/profile` still shows public Explore, Events and How it works in its left sidebar after the user enters the private account workspace. Apply the same three omissions already used by My sessions and coach workspace. Follow the [private navigation contract](../../../docs/mvp-spec.md#9-scheduling-behavior-and-permissions).

## Scope and non-goals

Extend the existing sidebar filter to the personal Profile route family. Preserve Home, My sessions, actor-authorized Coach workspace and Profile links, upper-right Messages/account access, public navigation and current mobile bottom navigation. No profile content, image permission, authentication, data, dependency or configuration changes.

## Expected behavior and edge cases

On `/profile` and nested profile routes, the left sidebar omits Explore, Events and How it works. Segment matching must not match `/profile-other` or `/profiles`. Coach Profile retains its existing rule. An unauthorized actor never receives private account links. The mobile menu keeps its existing independent destination rules, as this request concerns the left panel.

## Assumptions, decisions, and dependencies

Confirmed on 2026-10-17: remove the three named links from personal Profile's left panel. Reuse the existing segment-aware matcher and sidebar filter. No unresolved product question or blocking dependency. This is one small frontend change, independent of the broader workspace accessibility and messaging validation work.

## Implementation plan

1. Include the account Profile route family in the existing sidebar omissions.
2. Update existing navigation boundary/capability/mobile checks and the specification.
3. Run relevant existing tests, lint/type/format/link checks and inspect desktop/mobile/keyboard behavior with native browser control. No new implementation-mirroring tests, database checks or production build are needed for this static navigation change.

## Acceptance criteria

- [x] AC1: Personal Profile's sidebar omits the three public links while retaining Home and authorized account links.
- [x] AC2: Similar prefixes, public routes, coach routes, unauthorized actors and mobile menus retain the correct destinations; automated checks pass.
- [ ] AC3: Desktop/mobile/keyboard presentation and the implementation/specification/index record are verified.

## Validation plan

Run `node --import tsx --test tests/shell-navigation.test.ts tests/profile-navigation.test.ts tests/message-shell.test.ts`, focused ESLint/Prettier, `npm run typecheck`, link/consistency checks and `git diff --check`. Inspect the local personal Profile at desktop and phone widths; keyboard navigation must skip the removed items. No account mutation is needed. Keep required unverified browser evidence open.

## Implementation record

### Changes and rationale

Extended the existing segment-aware sidebar filter from coach/My sessions routes to the account Profile route family. Personal Profile now omits Explore, Events and How it works from the left panel. This uses the same filter and existing capability checks; no duplicated menu or CSS hiding was added. The separate mobile-menu path handling preserves its existing destinations.

### Affected files

- [Shell](../../../src/components/shell.tsx): includes `/profile` in the existing three-item sidebar omission using `isNavigationHrefActive`.
- [Existing navigation tests](../../../tests/shell-navigation.test.ts): exercises `/profile` and a nested profile path, excludes `/profile-other` and `/profiles` from the rule, checks unauthorized callers and unchanged mobile destinations.
- [Specification](../../../docs/mvp-spec.md#9-scheduling-behavior-and-permissions): records personal Profile sidebar scope and unchanged mobile/public behavior.
- [Ticket index](../../README.md): allocates DEV0284 and tracks current validation.

### Decisions and deviations

None beyond the adopted scope above.

### Contracts, configuration, and operations

Sidebar presentation only. No data/API, environment, dependency, migration or deployment change.

## Validation results

- 2026-10-17, Node 24.21.0 and installed Next 16.3.8. Read bundled usePathname documentation before editing the route filter.
- Passed `node --import tsx --test tests/shell-navigation.test.ts tests/profile-navigation.test.ts tests/message-shell.test.ts`: all 16 checks. Updated existing route-boundary and mobile cases instead of adding a static implementation-mirroring test.
- Passed `node_modules/.bin/eslint src/components/shell.tsx tests/shell-navigation.test.ts`, `npm run typecheck`, focused `node_modules/.bin/prettier --check src/components/shell.tsx tests/shell-navigation.test.ts tickets/current/frontend/DEV0284-simplify-personal-profile-sidebar.md` and `git diff --check`.
- Live native Chrome desktop, 1390×768: local `/profile` rendered as fictional Max. Main navigation contains Home, My sessions and Profile with Profile selected; no Explore, Events or How it works. Upper-right Messages/account and account-summary/avatar controls remain visible. No data/account/image actions were submitted.
- Cleanup: closed only the task-created Profile test tab and observed return to the original selected browser tab. Existing tabs were retained; no responsive-emulation change was confirmed.
- Blocked browser checks: native coordinate input returned `noWindowsAvailable`. Keyboard Tab reached My sessions once, but subsequent Tab actions did not produce a confirmed next focus target; a DevTools shortcut produced no confirmed responsive controls. Later fresh AX state still showed the desktop Profile sidebar and focus on My sessions. Mobile layout and complete keyboard traversal remain unverified. No database tests or production build needed for this unchanged-data, static sidebar extension.

| Criterion | Evidence                                                                                                                     | Result  |
| --------- | ---------------------------------------------------------------------------------------------------------------------------- | ------- |
| AC1       | Live desktop Profile sidebar has Home, My sessions and Profile, with the three public links absent.                          | Passed  |
| AC2       | All 16 existing checks, including updated profile-prefix, unauthorized and unchanged-mobile cases; lint/types/format passed. | Passed  |
| AC3       | Desktop screenshot and specification/index record verified; phone-width and complete keyboard traversal remain unavailable.  | Blocked |

### Commit preparation on 2026-10-17

Reviewed the unchanged shell/test diff against the previously passed 16 navigation checks, lint/type/format results and live desktop evidence. Commit scope is the shell, existing navigation tests, this ticket and only its specification/index updates. The index also reserves independently allocated DEV0285–DEV0289 and advances the next available DEV ID to DEV0290; those authentication-planning records are excluded. Mobile/keyboard evidence remains blocked, so the ticket stays current.

## Risks, limitations, and follow-ups

The requested sidebar change is implemented and desktop-verified. Required mobile and keyboard evidence is blocked by native input failures, so this record stays current. Next action: when native control responds, inspect personal Profile at phone width, verify its unchanged bottom menu, and Tab from Home through My sessions to Profile without the removed links. Complete/archive after those observations pass. No data/account mutations or hosted changes were performed. The user-authorized local commit preserves the current validation limits. Preserve unrelated planning edits.

## Completion and review references

- Completed: Not completed.
- Commit: `[DEV0284] Simplify personal Profile sidebar` — user-authorized local commit on 2026-10-17.
- Review: Self-reviewed scope, route boundaries, navigation/capability checks and specification consistency. No independent review; required UI remainder stays open.
- Deployment or release: None.
