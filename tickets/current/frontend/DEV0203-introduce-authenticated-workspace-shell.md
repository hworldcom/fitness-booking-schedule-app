# Ticket DEV0203: Introduce the authenticated workspace shell

- Status: Ready
- Created: 2026-10-12
- Last updated: 2026-10-12
- Milestone: Scheduling interface authenticated-workspace follow-up
- Coordination: [COR0018 — Authenticated workspace redesign](../organisatory/COR0018-authenticated-workspace-redesign.md)
- Related records: completed contract dependency [DEV0202 — Adopt the authenticated workspace redesign contract](../../archive/organisatory/DEV0202-adopt-authenticated-workspace-redesign-contract.md), completed public shell baseline [DEV0196 — Introduce the public marketplace shell](../../archive/frontend/DEV0196-introduce-public-marketplace-shell.md) and capability baseline [DEV0153 — Separate client and coach navigation](../../archive/frontend/DEV0153-separate-client-and-coach-navigation.md)

## Objective and context

Replace the legacy-looking private desktop/sidebar and mobile workspace chrome with the approved authenticated visual direction, so entering `My sessions`, `Coach workspace` or Profile feels like the same MovX product as the redesigned marketplace. Preserve all capability-aware destinations, active-route behavior and separate account-avatar access.

## Scope and non-goals

- In scope: private sidebar/topbar, shared content frame, actor-aware desktop links, persistent mobile bottom navigation, account presentation, preview disclosure and responsive/focus styling.
- Out of scope: page-specific session, schedule, booking or profile content redesign; public-header changes; new destinations or permissions.

## Expected behavior and edge cases

- Public routes keep the compact public header; private routes receive the modern authenticated shell without a transition back to legacy styling.
- Every authorized account sees Explore, My sessions and its existing Profile destination; coach-capable accounts additionally see Coach workspace.
- Account-avatar controls continue to open personal Profile even when the main Profile item opens coach Profile.
- Mobile bottom navigation remains persistent without covering content or safe areas; long names and missing images fall back safely.

## Assumptions, decisions, and dependencies

- DEV0202 is the authoritative contract dependency.
- Existing `navigationForActor`, `publicAccountNavigationForActor` and route-active semantics remain the authorization/presentation source.
- Shell modernization may extract shared components but will not change server actor contracts.

## Implementation plan

1. Refactor private shell markup into a clearly scoped authenticated frame while keeping public shell behavior intact.
2. Apply the approved MovX authenticated navigation/account styling and responsive bottom bar.
3. Add actor, active-route, touch-target, overflow, keyboard and public-shell non-regression coverage.
4. Run relevant unit/browser/static/build checks and complete the ticket record.

## Acceptance criteria

- [ ] AC1: Private routes use one coherent modern desktop/mobile shell without changing authorized destinations or Profile routing.
- [ ] AC2: Public routes and their compact header remain behaviorally and visually isolated from private shell changes.
- [ ] AC3: Mobile navigation is persistent, safe-area aware, keyboard reachable and unobstructive at 375/430 pixels.
- [ ] AC4: Representative client/coach actor tests, lint, type-check, formatting and build pass.

## Validation plan

- Extend shell unit/static tests for actor destinations and active states.
- Use Playwright with ordinary-client and coach actors at mobile/desktop widths; verify keyboard focus, touch sizes, no overflow and public non-regression.
- Run `npm test`, lint, type-check, format, build and `git diff --check`.

## Implementation record

Pending implementation.

### Changes and rationale

Pending implementation.

### Affected files

| File or component | Change and purpose |
| ----------------- | ------------------ |
| Pending           | Pending.           |

### Decisions and deviations

None yet.

### Contracts, configuration, and operations

No server, schema, environment, dependency or migration change is planned.

## Validation results

Pending validation.

| Criterion | Evidence | Result  |
| --------- | -------- | ------- |
| AC1       | Pending  | Not run |
| AC2       | Pending  | Not run |
| AC3       | Pending  | Not run |
| AC4       | Pending  | Not run |

## Risks, limitations, and follow-ups

- Shared shell CSS can affect every route; public and private selectors must stay explicitly scoped.
- Page interiors intentionally remain unchanged until DEV0204-DEV0207.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: No review created.
- Deployment or release: Not deployed or released.
