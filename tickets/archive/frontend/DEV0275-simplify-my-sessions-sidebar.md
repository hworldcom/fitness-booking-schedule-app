# Ticket DEV0275: Simplify My sessions sidebar

- Status: Completed
- Created: 2026-10-17
- Last updated: 2026-10-17
- Milestone: Authenticated workspace refinement
- Coordination: None — independent development ticket
- Related records: [DEV0274](../../archive/frontend/DEV0274-simplify-coach-workspace-discovery-navigation.md) is the completed coach-navigation baseline; [current specification](../../../docs/mvp-spec.md#9-scheduling-behavior-and-permissions) owns the navigation contract.

## Objective and context

Apply the user's requested sidebar cleanup to My sessions: remove public Events, Explore and How it works after entering the athlete session area. Home already provides a public return action. This is one small shared-shell change, separate from session types or unrelated local-development work.

## Scope and non-goals

- In scope: desktop sidebar on `/sessions` and nested routes, including `/sessions/groups`; preserve actor-aware private links and Home; update specification and ticket evidence.
- Out of scope: My sessions mobile navigation or header help, other private/public route families, session content, authorization, data, migrations, configuration and commits.

## Expected behavior and edge cases

The My sessions sidebar contains Home, My sessions, Messages and the existing Profile destination, plus Coach workspace only for an eligible coach acting as an athlete. Events, Explore and How it works are absent. Nested Group sessions and future nested session routes use the same segment-aware boundary; similar prefixes such as `/sessions-other` do not match. Mobile retains its existing Explore return action and the upper-right help link retains its current behavior. Existing coach-workspace refinements and other routes remain correct; a route name never grants private destinations to an unauthorized actor.

## Assumptions, decisions, and dependencies

2026-10-17: The user explicitly named the left panel after entering My sessions. Limit this change to that sidebar and preserve mobile/header behavior. Reuse the existing route-aware navigation helpers, segment matching and actor rules. Installed Next.js 16.3.8 `usePathname` documentation has been inspected. No unresolved product decision or external dependency blocks this small change.

## Implementation plan

1. Extend desktop navigation filtering to the My sessions route family. Keep mobile navigation's existing coach-only route refinement independent of the desktop change.
2. Update specification behavior and extend existing navigation assertions for athlete/coach capabilities, nested routes, prefix boundaries and unchanged mobile output.
3. Run focused navigation tests, ESLint, type, formatting/link/whitespace checks and read-only desktop/mobile/keyboard browser validation. Preserve unrelated workspace edits.

## Acceptance criteria

- [x] AC1: My sessions and nested Group sessions omit the three public sidebar shortcuts while retaining Home and authorized account links.
- [x] AC2: Mobile/header behavior, other route families, existing coach cleanup and capability boundaries remain correct.
- [x] AC3: Relevant tests/static checks and desktop/mobile/keyboard verification pass; the implementation record is complete.

## Validation plan

Run `node --import tsx --test tests/shell-navigation.test.ts tests/profile-navigation.test.ts`, focused ESLint and Prettier, `npm run typecheck`, ticket links/index/status and `git diff --check`. Inspect the running local app's My sessions/Group sessions sidebar, Home keyboard access, mobile navigation and a personal/public route boundary. Existing fictional coach-as-athlete browser access exercises the shared session shell; tests additionally cover ordinary athlete and unauthorized destinations. No data writes, new fixtures, production build or database/calendar rehearsal is necessary for this presentation-only change.

## Implementation record

Completed the desktop sidebar refinement and verified the local My sessions and nested Group sessions pages. No account or session records were edited.

### Changes and rationale

The existing desktop navigation filter now recognizes `/sessions` and its segment-delimited descendants in addition to the coach workspace. It removes Events, Explore and How it works from those sidebars while retaining Home and actor-authorized account destinations. Mobile passes coach-specific route context only, preserving its existing Explore destination in My sessions. The header condition is unchanged.

### Affected files

- [Shared shell](../../../src/components/shell.tsx): extends sidebar filtering to My sessions while preserving the existing mobile and header behavior.
- [Existing navigation tests](../../../tests/shell-navigation.test.ts): extends route/capability assertions for ordinary athletes, coaches, signed-out states, nested session paths, similar prefixes and unchanged mobile output.
- [Specification](../../../docs/mvp-spec.md#9-scheduling-behavior-and-permissions): records the requested sidebar boundary and an athlete acceptance example, keeping prior coach refinements consistent.
- [Ticket index](../../README.md): allocates DEV0275 and records its completed archive location.

### Decisions and deviations

2026-10-17: Scope stayed limited to the requested left panel. The browser already had an ordinary athlete signed in, so validation used that account instead of the initially assumed coach acting as an athlete. This directly verified the athlete-only sidebar; existing tests cover eligible coach destinations. No authentication or test-account change was made.

### Contracts, configuration, and operations

The existing navigation helpers keep their signatures. Their desktop output changes for the My sessions route family; mobile continues applying only its existing coach-specific context. No server API, schema, environment, dependency, authorization, migration or deployment change.

## Validation results

- Date/environment: 2026-10-17, installed Next.js 16.3.8, running local app at `localhost:3100`, native Chrome with an existing ordinary athlete account.
- Passed: `node --import tsx --test tests/shell-navigation.test.ts tests/profile-navigation.test.ts` — 13 tests, zero failures. Assertions verify ordinary-athlete and coach destinations, signed-out restrictions, nested My sessions paths, nonmatching similar prefixes and unchanged mobile behavior. Existing coach/public/profile navigation assertions also pass.
- Passed: `node_modules/.bin/eslint src/components/shell.tsx tests/shell-navigation.test.ts` and `npm run typecheck` — no lint or TypeScript errors.
- Passed: focused Prettier checking of the shared shell, navigation tests and this ticket; ticket relative-link/index/status consistency; `git diff --check`.
- AC1 browser proof: desktop `/sessions` and `/sessions/groups` both showed Home, My sessions, Messages and Profile in the left panel. None of the three public shortcuts appeared there. The upper-right How it works link remained present, as scoped.
- AC2/AC3 browser proof: Tab from the page reached Skip to content, the brand Home link and the sidebar Home link in order. Return on Home opened public discovery with Explore, Events and How it works in its public header. At 375-by-829 pixels, Group sessions retained the existing four mobile destinations: Explore, My sessions, Messages and Profile, with no visible horizontal overflow after layout settled. Restored the original 1412-by-829 responsive dimensions and closed only the test tab/tools, returning to the user's original public-coach tab.
- Browser-control clipboard/focus retries were resolved with explicit field selection and individual keyboard input. These were tooling input failures; final navigation/layout observations passed. No forms, bookings, requests, profile fields or email were changed by validation.
- Self-review: four implementation lines change only shared navigation selection; specification/ticket updates match the request and unrelated local changes were preserved. Full application builds, database/calendar rehearsals and new fixtures were not run because this presentation-only change affects no route, data or scheduling authority.

| Criterion | Evidence                                                                                  | Result |
| --------- | ----------------------------------------------------------------------------------------- | ------ |
| AC1       | Desktop ordinary-athlete My sessions and Group sessions inspection                        | Passed |
| AC2       | Route/capability/mobile assertions, unchanged header and public Home inspection           | Passed |
| AC3       | 13 tests, lint/type/format/link/whitespace checks, mobile and keyboard proof, self-review | Passed |

### 2026-10-17 commit verification

`npm test` passed all 211 application and 24 server cases. `node scripts/database-baseline.mjs verify` confirmed all 53 immutable originals and generated baseline unchanged. Previously recorded checks and explicit validation limits remain applicable; no implementation or SQL changed during commit preparation. The integrated acceptance matrix was aligned with the already-delivered approval-free mailbox under DEV0279. The seven fixes share shell/mailbox/specification/test hunks and are committed together with every owning DEV ID. Independent note, invitation, calendar and authentication-planning edits are excluded. This commit does not complete missing UI evidence or deploy hosted migrations.

## Risks, limitations, and follow-ups

No remaining acceptance work. Session types remain separately planned under DEV0257. This local change is uncommitted and has not been deployed or independently reviewed.

## Completion and review references

- Completed: 2026-10-17.
- Commit: `[DEV0275][DEV0276][DEV0278][DEV0279][DEV0280][DEV0281][DEV0282] Refine workspace navigation and messaging` — user-authorized local commit on 2026-10-17.
- Review: Self-review against all three acceptance criteria passed; no independent review.
- Deployment or release: None.
