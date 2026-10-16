# Ticket DEV0274: Simplify coach workspace discovery navigation

- Status: Completed
- Created: 2026-10-17
- Last updated: 2026-10-17
- Milestone: Authenticated workspace refinement
- Coordination: None — independent development ticket
- Related records: [DEV0273](../../archive/frontend/DEV0273-remove-coach-workspace-help-links.md) is the preceding help-link refinement; [current specification](../../../docs/mvp-spec.md#9-scheduling-behavior-and-permissions) defines the shared navigation contract.

## Objective and context

Remove the redundant public Explore and Events shortcuts from Coach workspace navigation. The user already uses Home to return to public discovery. These links currently leave the private workspace for public pages; they are distinct from the coach's Events management tab.

## Scope and non-goals

- In scope: the shared shell on `/coach`, its nested routes and `/profile/coach` with nested routes; retain Home in the desktop sidebar and use Home instead of Explore in mobile navigation; update specification and validation evidence.
- Out of scope: public Explore/Events routes or their header, other private routes, coach Events management, redirects, data, permissions, availability and session types.

## Expected behavior and edge cases

Coach workspace navigation contains Home, authorized private destinations and Profile without public Explore/Events shortcuts or the previously removed help links. Mobile retains the same number of destinations by replacing Explore with Home. The workspace's own Events tab still opens `/coach/events`. Navigation updates immediately between private route families; `/coaches/...`, personal `/profile`, `/sessions` and public routes retain their current navigation. Unauthorized actors gain no private destinations.

## Assumptions, decisions, and dependencies

2026-10-17: Interpret “the same” in the preceding coach-workspace cleanup context. Retain the public discovery features and coach Events management. Home replaces Explore on mobile so the coach retains an explicit public return action. Reuse existing segment-aware route matching and actor capability rules. Installed Next.js 16.3.8 bundled `usePathname` documentation was read; no framework integration change is needed. Unrelated workspace changes must be preserved.

## Implementation plan

1. Make the existing actor navigation helpers accept optional route context and share coach-workspace matching with the shell header condition. Filter the two public shortcuts only for that route family; keep Home on mobile there.
2. Update current navigation requirements and acceptance examples. Extend existing route/capability navigation assertions for the changed behavior without adding a separate test harness.
3. Run focused navigation tests, ESLint, type checking, formatting/link checks and desktop/mobile/keyboard browser checks with the existing local fictional coach. Review this small shared-shell change as one ticket.

## Acceptance criteria

- [x] AC1: Coach sidebar omits public Explore/Events, retains Home, and coach Events management remains reachable.
- [x] AC2: Coach mobile navigation uses Home; private destinations, profile/access rules, route boundaries and other public/private navigation remain correct.
- [x] AC3: Focused static/tests and desktop/mobile/keyboard verification pass with an accurate implementation record.

## Validation plan

Run existing shell/profile navigation tests, focused ESLint and Prettier, `npm run typecheck`, relative-link/index checks and `git diff --check`. Inspect desktop and 375/430-pixel mobile coach routes, keyboard Home navigation, coach Events/Profile routes and the unchanged public header/other private shell. Read-only browser inspection uses the existing local fictional account; no fixture writes are needed. Full builds, migration checks and scheduling rehearsals are not necessary for this navigation-only change.

## Implementation record

Completed the route-aware shared-shell refinement and verified the local browser flow with the existing fictional coach. No application records were edited.

### Changes and rationale

Previously the coach sidebar exposed public Explore and Events beside Home, and the mobile bar exposed Explore as its discovery destination. The existing navigation helpers now accept route context and remove the two shortcuts throughout the coach workspace. Mobile retains Home there. One segment-aware coach route predicate also preserves DEV0273's help-link removal across Schedule, Bookings, Events and coach Profile. Other routes keep their existing navigation; the coach's Events management tab remains separate and functional.

### Affected files

- [Shared shell](../../../src/components/shell.tsx): centralizes coach-workspace route matching and passes pathname context into desktop/mobile actor navigation.
- [Existing shell navigation tests](../../../tests/shell-navigation.test.ts): extends route-boundary and mobile assertions for nested coach routes, public/personal boundaries, signed-out access and approved/demo/suspended coach destinations.
- [Specification](../../../docs/mvp-spec.md#9-scheduling-behavior-and-permissions): records the request and updates the mobile decision/acceptance example consistently.
- [Ticket index](../../README.md): allocates DEV0274 and records its completed archive location.

### Decisions and deviations

2026-10-17: No deviation from the plan. Investigation confirmed Explore and Events are public pages, rather than aliases redirected to Home. The user-visible issue was leaving the workspace for discovery; no redirect change was needed. Home replaces Explore only in the coach workspace's mobile bar, preserving a public return action and the existing destination count.

### Contracts, configuration, and operations

The internal exported `navigationForActor` and `mobileNavigationForActor` helpers accept an optional pathname; omitting it preserves their previous output for existing callers. The shell supplies its current pathname. Only the navigation presentation contract changes. No schema, server API, environment, dependency, authentication, migration or deployment change.

## Validation results

- Date/environment: 2026-10-17; installed Next.js 16.3.8, running local app at `localhost:3100`, native Chrome and the existing fictional Daniel Park coach account.
- Passed: `node --import tsx --test tests/shell-navigation.test.ts tests/profile-navigation.test.ts` — 13 tests, zero failures. Extended assertions cover coach/nested Events/Profile paths, unchanged personal/public boundaries, signed-out capability limits and mobile profile differences for approved/demo/suspended coaches.
- Passed: `node_modules/.bin/eslint src/components/shell.tsx tests/shell-navigation.test.ts` and `npm run typecheck` — no errors.
- Passed: focused Prettier checking, ticket relative-link/index/status checks and `git diff --check`.
- AC1 browser proof: desktop Calendar sidebar displayed Home, My sessions, Messages, Coach workspace and Profile without public Explore/Events/help shortcuts. Clicking the workspace Events tab opened `/coach/events` with its group-management actions intact. Coach Profile at `/profile/coach` showed the same simplified sidebar and retained workspace tabs.
- AC2/AC3 browser proof: Events at 375- and 430-pixel widths retained the five mobile destinations with Home replacing Explore and no visible horizontal overflow. Tab advanced through workspace tabs/actions to Home; Return opened public Home. Its public header still exposed Explore and Events. Personal `/profile` retained its Explore/Events/help links. No scheduling, profile, account or email mutations were performed. Restored the original 1412-by-829 responsive dimensions, closed only the test tab/tools and returned to the user's original Home tab.
- Self-review: changed files match the ticket; prior DEV0273 and unrelated edits were preserved. No new test harness, build, migration or scheduling rehearsal was run because this change only selects existing navigation links.

| Criterion | Evidence                                                                                              | Result |
| --------- | ----------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Desktop Calendar/Profile inspection and actual coach Events tab navigation                            | Passed |
| AC2       | Route/capability tests, two mobile widths, keyboard Home activation, public/personal route inspection | Passed |
| AC3       | 13 navigation tests, lint, type, format/link/whitespace checks and self-review                        | Passed |

## Risks, limitations, and follow-ups

No remaining acceptance work. Session types remain separate DEV0257 planning work. This local change has not been deployed or independently reviewed.

## Completion and review references

- Completed: 2026-10-17.
- Commit: `[DEV0274] Simplify coach workspace discovery navigation` — user-authorized local commit on 2026-10-17; scope excludes independent local-development, invitation and session-note work.
- Review: Self-review against all three acceptance criteria passed; no independent review.
- Deployment or release: None.
