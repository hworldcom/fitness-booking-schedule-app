# Ticket DEV0196: Introduce the public marketplace shell

- Status: Completed
- Created: 2026-10-12
- Last updated: 2026-10-12
- Milestone: Scheduling interface public-marketplace follow-up
- Coordination: [COR0017 — Public marketplace redesign](../../current/organisatory/COR0017-public-marketplace-redesign.md)
- Related records: completed contract dependency [DEV0195 — Adopt the public marketplace redesign contract](../organisatory/DEV0195-adopt-public-marketplace-redesign-contract.md); navigation baselines [DEV0153 — Separate client and coach navigation](DEV0153-separate-client-and-coach-navigation.md), [DEV0168 — Detect profile images in account icons](DEV0168-detect-profile-images-in-account-icons.md) and [DEV0171 — Unify coach Profile navigation](DEV0171-unify-coach-profile-navigation.md)

## Objective and context

Replace the fixed left sidebar and mobile bottom bar on public marketplace routes with a compact MovX top header while preserving the current capability-aware navigation on private client/coach routes. The current global `Shell` renders one chrome model for every route, so this must be a route-aware separation rather than a cosmetic sidebar hide.

## Scope and non-goals

- In scope:
  - Add a public shell mode for `/`, `/explore`, `/coaches/[slug]`, `/how-it-works` and the sign-in journey as fixed by DEV0195.
  - Present logo, Explore, How it works, coach-application entry and actor/account controls in an accessible responsive header.
  - Retain a lower-prominence preview/demo disclosure, skip link, footer and current image/initial fallbacks.
  - Preserve existing private navigation and actor capability logic for `/sessions`, `/coach`, `/profile` and `/profile/coach`.
- Out of scope:
  - Homepage content, search controls, Explore cards/map layout or any authority/routing change behind existing links.
  - New account-menu capabilities, notification UI or rebranding.

## Expected behavior and edge cases

- Guests see an uncluttered public header and never see private destinations.
- Authorized clients and coaches on public pages can reach their existing account/private destinations without exposing unauthorized links.
- Private routes retain `My sessions`, `Coach workspace`, coach Profile defaults and personal Profile access exactly as defined today.
- Public mobile navigation uses one compact top header and no bottom bar. Private signed-in mobile routes retain one persistent capability-aware bottom bar that remains visible while page content scrolls.
- Long names, image failures, narrow widths and Auth-unavailable states do not overflow or hide the sign-in/account affordance.

## Assumptions, decisions, and dependencies

- DEV0195 adopted the public route set, compact top header, no public mobile bottom bar and persistent private signed-in mobile bottom navigation.
- Prefer explicit `PublicShell`/`WorkspaceShell` composition or a well-tested route-mode function; do not duplicate actor authorization logic.
- Public-shell presentation may differ, but server-derived actor capability remains the only source of private navigation.

## Implementation plan

1. Extract pure route-mode and actor-navigation decisions from the current shell where needed for direct tests.
2. Implement public header/demo disclosure/footer composition using existing brand tokens and account presentation.
3. Keep workspace sidebar/mobile navigation behavior isolated and unchanged on private routes.
4. Add unit and browser coverage for guest, client, approved/demo coach, suspended coach and unavailable Auth states across public/private routes.
5. Validate keyboard use, focus order, responsive overflow and route transitions at mobile/desktop widths.

## Acceptance criteria

- [x] AC1: Public routes use a top-navigation shell with no persistent left sidebar and no duplicate mobile navigation.
- [x] AC2: Guest/client/coach/suspended actor links remain authorization-correct, and all existing private destinations remain reachable.
- [x] AC3: Preview disclosure, skip navigation, account avatar/initial fallback and footer remain accessible on public pages.
- [x] AC4: Public and workspace chrome pass keyboard and responsive browser checks without content obstruction or horizontal overflow.

## Validation plan

- Extend shell/navigation unit tests for route mode and each actor state.
- Add Playwright checks covering `/`, `/explore`, one coach profile and each representative private route at desktop and mobile widths.
- Exercise keyboard focus, long/initial account presentation and Auth-unavailable behavior.
- Run `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build` and `git diff --check` under the repository Node.js release.

## Implementation record

Implementation started and completed on 2026-10-12 after confirming the DEV0195 contract dependency and reviewing the existing global shell, actor-aware navigation, responsive chrome and test coverage.

### Changes and rationale

- Added an explicit route classifier for the adopted public routes. `/`, `/explore`, `/how-it-works`, `/sign-in` and exactly one `/coaches/[slug]` segment now receive public chrome; private and unknown routes keep workspace chrome.
- Replaced the public sidebar and bottom navigation with a compact sticky header containing the MovX home mark, Explore, How it works, a capability-aware coach-application entry and safe account controls.
- Kept guests, preview visitors, forbidden actors and Auth-unavailable actors free of private links. Authorized clients receive `My sessions`; approved, demo and suspended coaches also receive `Coach workspace`; every authorized actor retains personal Profile access through the existing avatar/initial presentation.
- Preserved the workspace sidebar, top bar and persistent mobile bottom navigation without changing its actor rules or approved/demo coach Profile default.
- Retained the shared demo disclosure, keyboard skip link, preview modal and footer. Narrow public headers use a deliberate short `Coach` visual label while retaining the accessible `Become a coach` name.

### Affected files

| File or component                                                                             | Change and purpose                                                                                                                                                                                       |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/shell.tsx`                                                                    | Classifies public routes, selects public or workspace chrome, renders capability-aware public account links and retains shared disclosure/modal/footer behavior.                                         |
| `src/app/globals.css`                                                                         | Styles the full-width sticky public header, two-row narrow layout, account actions and public footer spacing while preserving the fixed private mobile navigation.                                       |
| `tests/shell-navigation.test.ts`                                                              | Covers the exact route boundary and public account destinations for preview, signed-out, forbidden, unavailable, client, approved, demo and suspended actors.                                            |
| `tests/browser/public-story.spec.ts`                                                          | Covers all adopted public routes, the representative private Profile route, desktop/mobile chrome separation, keyboard focus order, modal dismissal, sticky mobile presentation and horizontal overflow. |
| `tickets/README.md` and `tickets/current/organisatory/COR0017-public-marketplace-redesign.md` | Keep the ticket lifecycle and public-marketplace work map synchronized.                                                                                                                                  |

### Decisions and deviations

- Kept one global `Shell` with pure route and actor helpers instead of moving routes into layout groups. This preserves the established provider and authorization boundary while making the two chrome modes explicit and directly testable.
- Used direct private-destination links and the existing Profile avatar rather than inventing a new account menu, which keeps the ticket within its stated non-goal.
- Kept the public disclosure strip beneath the sticky header so fictional-data context remains visible without dominating the primary navigation.

### Contracts, configuration, and operations

No data, schema, dependency, environment variable, migration or operational contract changed. Public route chrome now follows DEV0195; existing private route authority and actor projections remain compatible.

## Validation results

Validation completed on 2026-10-12 with the repository Node.js release.

| Criterion | Evidence                                                                                                                                                                                                                                                                                                                     | Result |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | `tests/browser/public-story.spec.ts` visited Home, Explore, Daniel Park, How it works and sign-in in both Playwright projects; each exposed `.public-header` with no sidebar or mobile bottom navigation. The Profile route retained workspace chrome.                                                                       | Passed |
| AC2       | `npm test` passed 109 unit tests plus 9 server tests. The shell matrix verifies no unauthorized private links, client sessions-only controls and sessions/workspace controls for approved, demo and suspended coaches while the existing workspace-navigation tests remain green.                                            | Passed |
| AC3       | Desktop/mobile browser checks exercised the disclosure modal and Escape dismissal, verified the skip link is the first focus target, traversed the public header in DOM order, and retained the shared footer. Existing profile-presentation tests cover image-to-initial fallback; the public header reuses that component. | Passed |
| AC4       | Targeted `npx --no-install playwright test tests/browser/public-story.spec.ts` passed all 8 desktop/mobile checks, including narrow sticky presentation, private mobile navigation visibility and horizontal-overflow assertions. Visual review covered 1440×1040 and 393×852 screenshots.                                   | Passed |

Additional checks:

- `npm run lint` passed with no findings.
- `npm run typecheck` passed after Next.js route type generation.
- `npm run format:check` and `git diff --check` passed.
- `npm run build` passed in configuration-free public-preview mode. The build emitted the existing Supabase Node-version and experimental JSON-module warnings but no build error.
- An exploratory full `npm run test:e2e` run in configuration-free mode passed 24 tests, skipped 2 configured-Auth tests and failed 8 database-backed discovery checks because Playwright had no `DATABASE_URL`; screenshots confirmed the intended database-unavailable UI. A database-only rerun was not counted as a valid full-suite result because supplying only `DATABASE_URL` intentionally creates an unsupported partial Auth configuration and date-sensitive seeded availability also differs. The ticket-owned 8-test public/workspace shell matrix passed in its supported preview configuration.

## Risks, limitations, and follow-ups

- This ticket changes chrome only. Homepage composition, shared search and Explore presentation remain owned by DEV0197-DEV0200.
- The public account links are intentionally compact direct destinations, not a new menu. If the authenticated public header gains more actions later, it will need a separate information-architecture decision rather than silent overflow.

## Completion and review references

- Completed: 2026-10-12.
- Commit: `[DEV0196] Introduce public marketplace shell` (this completed change).
- Review: No independent review created.
- Deployment or release: Not deployed or released.
