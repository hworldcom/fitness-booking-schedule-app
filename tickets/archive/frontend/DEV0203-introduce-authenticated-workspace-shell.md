# Ticket DEV0203: Introduce the authenticated workspace shell

- Status: Completed
- Created: 2026-10-12
- Last updated: 2026-10-12
- Milestone: Scheduling interface authenticated-workspace follow-up
- Coordination: [COR0018 — Authenticated workspace redesign](../../current/organisatory/COR0018-authenticated-workspace-redesign.md)
- Related records: completed contract dependency [DEV0202 — Adopt the authenticated workspace redesign contract](../organisatory/DEV0202-adopt-authenticated-workspace-redesign-contract.md), completed public shell baseline [DEV0196 — Introduce the public marketplace shell](DEV0196-introduce-public-marketplace-shell.md) and capability baseline [DEV0153 — Separate client and coach navigation](DEV0153-separate-client-and-coach-navigation.md)

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
3. Add actor, active-route, touch-target, overflow, keyboard and public-shell non-regression coverage, and refresh the local email-auth rehearsal's outdated session empty-state assertion so it can exercise the real client shell.
4. Run relevant unit/browser/static/build checks and complete the ticket record.

## Acceptance criteria

- [x] AC1: Private routes use one coherent modern desktop/mobile shell without changing authorized destinations or Profile routing.
- [x] AC2: Public routes and their compact header remain behaviorally and visually isolated from private shell changes.
- [x] AC3: Mobile navigation is persistent, safe-area aware, keyboard reachable and unobstructive at 375/430 pixels.
- [x] AC4: Representative client/coach actor tests, lint, type-check, formatting and build pass.

## Validation plan

- Extend shell unit/static tests for actor destinations and active states.
- Use Playwright with ordinary-client and coach actors at mobile/desktop widths; verify keyboard focus, touch sizes, no overflow and public non-regression.
- Run `npm test`, lint, type-check, format, build and `git diff --check`.

## Implementation record

Implementation started on 2026-10-12 after DEV0202 completed the authenticated presentation contract and confirmed that existing actor-derived destinations and Profile routing remain unchanged.

### Changes and rationale

- Replaced the visually legacy private sidebar/topbar framing with a forest workspace sidebar, compact authenticated context header, restrained demo disclosure and account card while leaving the separate public marketplace header untouched.
- Derived the mobile destination set from the existing actor-aware navigation rather than maintaining a second permission list. The mobile bar omits public Home and How it works links to stay usable at narrow widths, while retaining Explore, My sessions, the capability-gated Coach workspace and the actor-correct Profile destination.
- Added client/coach role context without treating presentation as authorization. Approved/demo coaches read as `Coach and client`; ordinary clients and limited/pending coach states retain distinct truthful labels.
- Added safe-area-aware private content/footer spacing and a persistent mobile navigation with bounded labels and at least 44-pixel controls. The desktop sidebar keeps every existing destination so no route or permission contract changed.
- Extended pure navigation tests, configuration-free public/private shell browser coverage and the local email-auth rehearsal. The rehearsal's previous `No sessions booked yet.` assertion predated the confirmed-session empty-state copy; it now asserts the current `No confirmed sessions yet.` contract and captures signed-in client shell evidence.

### Affected files

| File or component | Change and purpose |
| ----------------- | ------------------ |
| `src/components/shell.tsx` | Introduces the scoped private shell markup, capability-derived mobile destinations and truthful account-role labels while preserving public chrome and Profile routing. |
| `src/app/authenticated-workspace.css` | Supplies private-only desktop/mobile layout, navigation, focus-compatible controls, safe-area spacing and responsive presentation. |
| `src/app/layout.tsx` | Loads the authenticated shell stylesheet after the established global theme. |
| `tests/shell-navigation.test.ts` | Proves ordinary-client versus approved-coach mobile destinations and role-label resolution. |
| `tests/browser/public-story.spec.ts` | Proves public/private shell isolation plus private overflow, keyboard focus, touch size and footer clearance at 375, 430 and 1440 pixels. |
| `scripts/rehearse-local-email-auth.mjs` | Exercises the real signed-in ordinary-client shell at desktop/mobile widths and updates the stale confirmed-session empty-state expectation. |
| `tickets/README.md` and `tickets/current/organisatory/COR0018-authenticated-workspace-redesign.md` | Track the implementation lifecycle and workstream progress. |

### Decisions and deviations

- The approved preview was used as visual direction, not as authority to replace current navigation. Desktop retains Home, Explore, My sessions, How it works, the capability-gated Coach workspace and actor-aware Profile. Mobile intentionally keeps only the primary private destinations to avoid an overcrowded fixed bar.
- Page-specific My sessions, Schedule, Bookings and Profile composition remains in DEV0204-DEV0207. This ticket removes the legacy transition at the shared-shell level without absorbing those independently testable surfaces.

### Contracts, configuration, and operations

No server, data shape, API, schema, environment variable, dependency, setup, migration or rollback contract changed. Existing actor snapshots and route authorization continue to determine which links render.

## Validation results

Validated locally on 2026-10-12 with the repository's production build and Chrome-backed Playwright. The Auth-enabled rehearsal used local Supabase Auth, PostgreSQL and Mailpit on their documented loopback ports.

| Criterion | Evidence | Result |
| --------- | -------- | ------ |
| AC1 | `tests/shell-navigation.test.ts` proves client/coach destinations and the signed-in email-auth rehearsal reached `/sessions` with the new shell at desktop/mobile widths. Existing account-avatar and Profile links remain unchanged. | Passed |
| AC2 | Focused Playwright visited the public marketplace and private Profile shell in both projects; four tests passed and asserted that the two chrome variants do not leak into each other. | Passed |
| AC3 | Playwright exercised private chrome at 375 and 430 pixels, verified no horizontal overflow, keyboard focus, controls at least 44 pixels and footer content above the persistent navigation. Safe-area padding is explicit in the private stylesheet. | Passed |
| AC4 | Navigation unit tests cover ordinary-client and approved-coach actors. `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build`, focused Playwright, the local email-auth rehearsal and `git diff --check` passed. | Passed |

- `npm test` — passed: 121 unit tests and 9 React-server tests.
- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm run build` — passed; Next.js emitted the existing Node 20 Supabase deprecation warning, which does not affect this change.
- `npx playwright test tests/browser/public-story.spec.ts --project=desktop --project=mobile --grep='public routes use|private routes retain'` — passed: 4 tests.
- `npm run test:auth` — first run failed only because the rehearsal still expected obsolete `No sessions booked yet.` text; after updating it to the current `No confirmed sessions yet.` copy and adding shell assertions, the rerun passed.
- `npm run format:check` and `git diff --check` — passed.

## Risks, limitations, and follow-ups

- Shared shell CSS can affect every route; public and private selectors must stay explicitly scoped.
- Page interiors intentionally remain unchanged until DEV0204-DEV0207.

## Completion and review references

- Completed: 2026-10-12.
- Commit: This completed record is included with the implementation commit whose subject references DEV0203.
- Review: No review created.
- Deployment or release: Not deployed or released.
