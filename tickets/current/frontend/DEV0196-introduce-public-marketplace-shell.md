# Ticket DEV0196: Introduce the public marketplace shell

- Status: Ready
- Created: 2026-10-12
- Last updated: 2026-10-12
- Milestone: Scheduling interface public-marketplace follow-up
- Coordination: [COR0017 — Public marketplace redesign](../organisatory/COR0017-public-marketplace-redesign.md)
- Related records: completed contract dependency [DEV0195 — Adopt the public marketplace redesign contract](../../archive/organisatory/DEV0195-adopt-public-marketplace-redesign-contract.md); navigation baselines [DEV0153 — Separate client and coach navigation](../../archive/frontend/DEV0153-separate-client-and-coach-navigation.md), [DEV0168 — Detect profile images in account icons](../../archive/frontend/DEV0168-detect-profile-images-in-account-icons.md) and [DEV0171 — Unify coach Profile navigation](../../archive/frontend/DEV0171-unify-coach-profile-navigation.md)

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

- [ ] AC1: Public routes use a top-navigation shell with no persistent left sidebar and no duplicate mobile navigation.
- [ ] AC2: Guest/client/coach/suspended actor links remain authorization-correct, and all existing private destinations remain reachable.
- [ ] AC3: Preview disclosure, skip navigation, account avatar/initial fallback and footer remain accessible on public pages.
- [ ] AC4: Public and workspace chrome pass keyboard and responsive browser checks without content obstruction or horizontal overflow.

## Validation plan

- Extend shell/navigation unit tests for route mode and each actor state.
- Add Playwright checks covering `/`, `/explore`, one coach profile and each representative private route at desktop and mobile widths.
- Exercise keyboard focus, long/initial account presentation and Auth-unavailable behavior.
- Run `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build` and `git diff --check` under the repository Node.js release.

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

No data, schema, dependency or environment change is planned. Public route chrome changes according to DEV0195; private route authority remains compatible.

## Validation results

Pending validation.

| Criterion | Evidence | Result  |
| --------- | -------- | ------- |
| AC1       | Pending  | Not run |
| AC2       | Pending  | Not run |
| AC3       | Pending  | Not run |
| AC4       | Pending  | Not run |

## Risks, limitations, and follow-ups

- Moving account controls can accidentally hide private destinations or produce duplicate mobile controls; actor/route matrices are required rather than screenshot-only review.

## Completion and review references

- Completed: Not completed.
- Commit: Planning record included in the commit whose subject references DEV0195-DEV0201; implementation not started.
- Review: No review created.
- Deployment or release: Not deployed or released.
