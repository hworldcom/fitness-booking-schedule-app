# Ticket DEV0273: Remove coach workspace help links

- Status: Completed
- Created: 2026-10-16
- Last updated: 2026-10-17
- Milestone: Authenticated workspace refinement
- Coordination: None — independent development ticket
- Related records: [current workspace specification](../../../docs/mvp-spec.md#9-scheduling-behavior-and-permissions); completed calendar integration [DEV0256](../../archive/backend/DEV0256-rehearse-calendar-and-availability.md) is a historical baseline, not implementation to repeat.

## Objective and context

Remove the redundant “How it works” links from the coach workspace's left sidebar and upper-right header, as requested by the user. Keep the workspace focused on coaching tasks. This is one small presentation change to the shared shell.

## Scope and non-goals

- In scope: Hide both help links on `/coach`, its nested owner routes (including Events details), and `/profile/coach` with nested coach-profile routes; update the specification and ticket index, and verify desktop/mobile navigation.
- Out of scope: Other sidebar/header controls, public navigation, other private routes, account access, scheduling actions, layout redesign, data or migrations.

## Expected behavior and edge cases

Coach workspace Profile/Schedule/Bookings query variants and `/coach/events/...` all omit the two links. The path boundary must not match public `/coaches/...` profiles or personal account `/profile`. Coach Profile is part of the workspace even though it uses `/profile/coach`. Navigation into and out of the coach workspace updates both locations without a reload. Public How it works and other private routes keep their current navigation. Account access and mobile navigation remain usable.

## Assumptions, decisions, and dependencies

Interpret “once I go to coach workspace” as all existing workspace tabs, including the separate `/profile/coach` route family, rather than every private destination. Reuse the shell's existing pathname and segment-aware active-route predicate. Installed Next.js 16.3.8 `usePathname` documentation was inspected before implementation. No new dependency or product decision is required. Unrelated local startup, notes and invitation work must be preserved.

## Implementation plan

1. Filter the existing sidebar navigation only in the coach route family and conditionally omit the header help link using the same route condition, including the existing coach Profile destination.
2. Record the adopted navigation refinement in the current specification.
3. Run the existing navigation tests and relevant lint/type/format checks; inspect desktop/mobile and keyboard navigation with real rendered UI. Do not add implementation-mirroring tests or rerun the full scheduling rehearsal for this link removal.

## Acceptance criteria

- [x] AC1: Both help links are absent throughout the coach workspace, including nested Events routes.
- [x] AC2: Public and other private help links, remaining workspace/account controls and route transitions retain their intended behavior.
- [x] AC3: Desktop/mobile/keyboard checks and relevant existing navigation/static validation pass; the implementation record is complete.

## Validation plan

Use existing shell-navigation tests for capability-aware destinations and route boundaries, focused ESLint/Prettier and full TypeScript checking. Inspect affected desktop and mobile rendered states and keyboard navigation. Existing scheduling/Auth authority is unchanged; no database or scheduling integration rehearsal is necessary. Record any local browser limitations accurately.

## Implementation record

Completed as one small frontend change. Both links are omitted from the shared shell whenever the current pathname belongs to the coach workspace or coach Profile route family. Query-selected Schedule and Bookings views share this condition; nested routes inherit it through segment-aware matching.

### Changes and rationale

Previously the coach workspace repeated the public onboarding link in its sidebar and header. The shell now filters the sidebar item and conditionally omits the header link using one route condition. This removes both visible links and their keyboard focus stops while preserving the remaining navigation and account controls. The current specification records the requested navigation behavior.

### Affected files

- [Shared shell](../../../src/components/shell.tsx): reuses the existing segment-aware route predicate for `/coach` and `/profile/coach`, filters the sidebar help item and conditionally renders the header help link.
- [Current specification](../../../docs/mvp-spec.md#9-scheduling-behavior-and-permissions): records where the two links are omitted and where help remains available.
- [Ticket index](../../README.md): allocates DEV0273 and records completion and the archived record.

### Decisions and deviations

2026-10-16: Initially planned `/coach` routes only. Browser review showed the existing workspace Profile tab uses `/profile/coach` while retaining the same workspace frame. Updated scope before implementation to include that route family, keeping help absent throughout all workspace tabs. Personal account Profile and public coaches remain outside the condition. Reuse existing route-boundary matching.

### Contracts, configuration, and operations

No data/API, authorization, environment, dependency, migration or deployment change.

## Validation results

- Passed: `node --import tsx --test tests/shell-navigation.test.ts tests/profile-navigation.test.ts` — all 13 tests passed, covering capability-aware destinations, coach/public route boundaries and mobile navigation.
- Passed: `node_modules/.bin/eslint src/components/shell.tsx` and `npm run typecheck` — no lint or TypeScript errors.
- Passed: focused Prettier checking of the shared shell and this ticket, relative-link/index consistency checks, and `git diff --check`.
- AC1/AC2 browser proof: used the running local app at `localhost:3100` with an existing fictional coach. The Calendar, Events and coach Profile pages showed neither link. The shared condition covers nested owner routes; code review confirmed the boundary does not match public `/coaches/...`. Personal `/profile` retained both help links, and public `/how-it-works` retained its navigation and explanatory content. No account or scheduling records were edited.
- AC2/AC3 responsive and keyboard proof: inspected the rendered Events page at 1412-pixel desktop width and 375- and 430-pixel mobile widths. Account controls, workspace tabs and mobile navigation remained usable with no visible horizontal overflow. Tab from the Coach workspace navigation link focused Profile, and Return navigated to the coach Profile tab; both links were absent after the final change. Returned the browser to the user's original Calendar tab and restored the prior viewport settings after testing.
- Self-review: the change is limited to link rendering and specification/ticket evidence; no scheduling, permissions, data or configuration behavior changed. Existing navigation tests and live browser checks provide meaningful coverage for this reversible presentation change. No new implementation-mirroring tests, production build or database/calendar integration rehearsal was needed.

## Risks, limitations, and follow-ups

No remaining acceptance work or known product dependency. Deployment and independent review are not part of this local change.

## Completion and review references

- Completed: 2026-10-16.
- Commit: `[DEV0273] Remove coach workspace help links` — user-authorized local commit on 2026-10-17; scope excludes independent local-development, invitation and session-note work.
- Review: Self-review against all three acceptance criteria passed; no independent review.
- Deployment or release: None.
