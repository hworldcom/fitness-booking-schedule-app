# Ticket DEV0282: Remove private header help link

- Status: Blocked
- Created: 2026-10-17
- Last updated: 2026-10-17
- Milestone: Authenticated workspace refinement
- Coordination: None — independent development ticket
- Related records: Historical baselines [DEV0273](../../archive/frontend/DEV0273-remove-coach-workspace-help-links.md) and [DEV0275](../../archive/frontend/DEV0275-simplify-my-sessions-sidebar.md); independent Messages refinement [DEV0281](DEV0281-show-message-avatars-and-header-entry.md).

## Objective and context

The upper-right private header hides How it works only on coach routes, so athletes still see it in My sessions and personal Profile. The user requests no How it works in the workspace header. Apply the same omission to every private shell route, as specified in [scheduling behavior and permissions](../../../docs/mvp-spec.md#9-scheduling-behavior-and-permissions).

## Scope and non-goals

Remove the private header help link and its unused icon/route condition. Keep public help navigation and its page, Messages/account controls, existing sidebar/mobile rules, and the dedicated Messages layout. No scheduling, authentication, data, dependency or configuration changes.

## Expected behavior and edge cases

My sessions, its nested Group sessions, personal Profile and all coach workspace routes show no upper-right help link at any width. Public Home, Explore, coach/event profiles, How it works and sign-in keep their existing public navigation, including for signed-in users. Removing the link also removes its keyboard stop; remaining controls keep their order. Messages already has a compact header without help.

## Assumptions, decisions, and dependencies

Confirmed on 2026-10-17: omit How it works throughout the workspace header. Use the existing public/private shell split instead of adding route exceptions. No blocking dependency; preserve the unrelated uncommitted messaging changes. This small rendering change does not require a coordination record.

## Implementation plan

1. Remove the link from the private header and unused CircleHelp import/local condition.
2. Update the current specification, superseding earlier wording that retained athlete header help.
3. Run existing shell/profile/message-shell checks, focused lint/format/type checks and inspect desktop/mobile/keyboard behavior where native browser control permits. Do not add a test mirroring this static deletion; no production build or database tests are needed for the removed link.

## Acceptance criteria

- [x] AC1: The private upper-right header has no How it works link, including athlete/personal routes; public help remains available.
- [x] AC2: Existing account/Messages/navigation behavior remains correct and relevant automated checks pass.
- [ ] AC3: Desktop/mobile and keyboard presentation are verified, with accurate specification/index/evidence.

## Validation plan

Run `node --import tsx --test tests/shell-navigation.test.ts tests/profile-navigation.test.ts tests/message-shell.test.ts`, focused ESLint/Prettier, `npm run typecheck`, local link/consistency checks and `git diff --check`. Use native browser control on the local app for private/public headers and a narrow viewport; no messages or account records need changing. Any missing required browser evidence keeps the record open.

## Implementation record

### Changes and rationale

The private topbar previously conditionally hid help only for `/coach` and `/profile/coach`. Removed that link from the private-header branch entirely, so My sessions, Group sessions and personal Profile follow the same rule. This also removes the obsolete icon import and local coach-route boolean. The separate public header still renders its original How it works item. The remaining private header is Messages, account status and personal avatar; its DOM order is unchanged apart from the removed help stop.

### Affected files

- [Shared shell](../../../src/components/shell.tsx): removes only the private header help link, its icon import and now-unused local variable. Public navigation, sidebar/mobile helpers and dedicated MessageShell remain intact.
- [Current specification](../../../docs/mvp-spec.md#9-scheduling-behavior-and-permissions): records the workspace-wide header omission and replaces the earlier My sessions header-help exception. Archived DEV0273/DEV0275 remain historical records.
- [Index](../../README.md): allocates DEV0282 and records implementation with outstanding browser evidence.

### Decisions and deviations

None beyond the confirmed scope above.

### Contracts, configuration, and operations

Presentation contract only: all private headers omit help. No API/data/schema, environment, dependency, migration or deployment changes.

## Validation results

- 2026-10-17, Node 24.21.0, installed Next 16.3.8. Consulted the bundled Link documentation before changing the shell.
- Passed `node --import tsx --test tests/shell-navigation.test.ts tests/profile-navigation.test.ts tests/message-shell.test.ts`: all 16 tests, including public/private route boundaries, actor capability navigation, bounded mobile menus and the dedicated Messages header.
- Passed `node_modules/.bin/eslint src/components/shell.tsx`, `npm run typecheck`, focused `node_modules/.bin/prettier --check src/components/shell.tsx tickets/current/frontend/DEV0282-remove-private-header-help-link.md`, and `git diff --check`.
- Source review confirmed the private branch contains no `/how-it-works` link or CircleHelp reference; publicHeaderNavigation retains the item. No new test was added for a static deletion; no database checks or production build are needed for this presentation-only removal.
- Browser attempt: the existing task-owned Chrome My sessions tab at `localhost:3100/sessions` displayed a blank white content area at 1390×768. Native reload and a subsequent AX/screenshot inspection still showed no rendered HTML content. A credential-free `curl --max-time 15 --silent --output /dev/null --write-out 'HTTP %{http_code}; total %{time_total}s\n' http://localhost:3100/sessions` returned the expected signed-out HTTP 307 in 0.085s; this confirms only the unauthenticated server response, not authenticated rendering. The cause of the blank signed-in tab was not established. No account, booking or message actions were taken.
- **Blocked:** desktop visual confirmation, mobile viewport and keyboard flow could not be verified because the local page did not render in the controlled browser. Do not interpret source/unit checks as browser evidence. The record remains current rather than archived.

| Criterion | Evidence                                                                                                 | Result                                                             |
| --------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| AC1       | Private header link removed unconditionally; public header item preserved; route/navigation checks pass. | Passed by source/automated review; visual confirmation remains AC3 |
| AC2       | All 16 existing tests, ESLint and TypeScript pass; account/Messages markup unchanged.                    | Passed                                                             |
| AC3       | Specification/index updated; desktop tab stayed blank after reload. Mobile and keyboard checks remain.   | Blocked                                                            |

### 2026-10-17 commit verification

`npm test` passed all 211 application and 24 server cases. `node scripts/database-baseline.mjs verify` confirmed all 53 immutable originals and generated baseline unchanged. Previously recorded checks and explicit validation limits remain applicable; no implementation or SQL changed during commit preparation. The integrated acceptance matrix was aligned with the already-delivered approval-free mailbox under DEV0279. The seven fixes share shell/mailbox/specification/test hunks and are committed together with every owning DEV ID. Independent note, invitation, calendar and authentication-planning edits are excluded. This commit does not complete missing UI evidence or deploy hosted migrations.

## Risks, limitations, and follow-ups

The requested implementation is present in the user-authorized local commit. Next action: when the local signed-in page renders, inspect My sessions and personal/coach Profile headers at desktop and phone widths, Tab through the retained Messages/account controls and confirm public Home still offers How it works. No speculative app-server restart, sign-out, migration or account mutation was performed to work around the blank page. DEV0281 owns its independent missing message-photo validation. No deployment or independent review is claimed.

## Completion and review references

- Completed: Not completed.
- Commit: `[DEV0275][DEV0276][DEV0278][DEV0279][DEV0280][DEV0281][DEV0282] Refine workspace navigation and messaging` — user-authorized local commit on 2026-10-17.
- Review: Self-reviewed the small removal and specification consistency; no independent review. Required UI evidence remains incomplete.
- Deployment or release: None.
