# Ticket DEV0171: Unify coach Profile navigation

- Status: Completed
- Created: 2026-10-08
- Last updated: 2026-10-08
- Milestone: Scheduling-only M3 interface follow-up
- Coordination: None — independent development ticket
- Related records: follows [DEV0153 — Separate client and coach navigation](../../archive/frontend/DEV0153-separate-client-and-coach-navigation.md) and [DEV0170 — Separate coach Schedule and Bookings tabs](../../archive/frontend/DEV0170-separate-coach-schedule-and-bookings-tabs.md)

## Objective and context

Present one consistent coach sub-navigation across the coach Profile, Schedule and Bookings views, with Profile first and selected by default when an approved or demo coach chooses Profile in the main left navigation. The coach Profile editor currently shows only `Availability` and `Profile`, in a different order and vocabulary from the three controls on `/coach`. The main Profile item also opens the personal account profile for every actor, even though approved coaches have a distinct coach-profile editor. This change refines the capability-aware navigation contract in [identity and data integrity](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity) and the coach workspace behavior in [scheduling behavior and permissions](../../../docs/mvp-spec.md#9-scheduling-behavior-and-permissions).

## Scope and non-goals

- In scope: create one shared coach sub-navigation ordered Profile, Schedule, Bookings; use it in coach Profile and coach workspace views; select the correct item on each view; label the availability view consistently as Schedule; send the main Profile navigation item to `/profile/coach` for approved/demo coaches; keep ordinary, applicant and suspended accounts on `/profile`; retain `/profile` access through both signed-in avatar controls; update specification and tests.
- Out of scope: merging account and coach profile data; changing coach approval/suspension authority; changing booking/availability behavior; changing the Coach workspace main-navigation destination; moving image upload ownership; database or route migrations.

## Expected behavior and edge cases

- An approved or fictional demo coach choosing Profile in desktop or mobile main navigation lands on `/profile/coach`, sees the coach profile editor, and sees Profile selected as the first coach sub-navigation item.
- Coach Profile, Schedule and Bookings all show the same three links in the same order: Profile (`/profile/coach`), Schedule (`/coach`) and Bookings (`/coach?view=bookings`). Only the current view has `aria-current="page"`.
- The left-panel and mobile Profile item for regular clients, pending/rejected applicants and suspended coaches continues to open `/profile`, because those actors do not have editable approved coach-profile authority.
- The bottom-left signed-in account control and upper-right avatar continue to open `/profile` for every authorized actor, including coaches.
- Direct profile-draft access remains available to pending/rejected applicants without granting schedule or booking data authority.

## Assumptions, decisions, and dependencies

- `Profile` in the main navigation is capability-aware presentation, not a merger of the personal account profile and public coach profile. Approved/demo coaches default to the coach profile; their personal account profile remains explicitly reachable from the two avatar controls.
- Suspended coaches keep the personal account Profile destination because the existing `/profile/coach` route intentionally withholds public-profile editing during suspension. Their permitted existing-session actions remain under Coach workspace → Bookings.
- A shared rendered component is preferred over duplicating link order and labels in two feature components, preventing future drift.

## Implementation plan

1. Update the current specification with the approved-coach Profile destination and persistent account-avatar route distinction.
2. Add one shared coach workspace navigation component with Profile, Schedule and Bookings links in the required order and selected semantics.
3. Replace the duplicated navigation in the coach Profile editor and Schedule/Bookings panel; keep capability and route behavior unchanged.
4. Make shell Profile navigation capability-aware for approved/demo coaches while preserving account-avatar links and other actor states.
5. Add focused rendering and navigation tests, then run unit, lint, type, formatting, production-build and authenticated responsive browser validation.

## Acceptance criteria

- [x] AC1: Coach Profile, Schedule and Bookings render the same three-item sub-navigation in Profile → Schedule → Bookings order with exactly one selected item.
- [x] AC2: Approved/demo coaches selecting Profile in desktop or mobile main navigation land on `/profile/coach` with Profile selected and the coach editor visible.
- [x] AC3: Ordinary, pending/rejected and suspended actors retain `/profile` as their main Profile destination, and both coach avatar controls still link to the account profile.
- [x] AC4: No actor receives additional coach scheduling, booking or profile-mutation authority from the navigation change.
- [x] AC5: Focused tests, lint, type checking, formatting, production build and desktop/mobile authenticated browser checks pass.

## Validation plan

Extend shell-navigation tests across all coach-access states and add static rendering assertions for the shared sub-navigation order, destinations and selected state. Rehearse Daniel Park in Chrome at desktop and mobile widths: click main Profile, verify `/profile/coach`, Profile-first ordering and selected state, then visit Schedule and Bookings and confirm identical ordering with the appropriate selection. Check both avatar links still target `/profile`, keyboard focus and horizontal overflow. Run `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build` and `git diff --check`. Database tests are not applicable because no persistence or server authority changes.

## Implementation record

Completed on 2026-10-08. Approved and demo coaches now enter their editable coach Profile from the main Profile navigation item. Coach Profile, Schedule and Bookings render the same shared Profile-first navigation, while the existing bottom-left and upper-right account controls continue to open the separate personal account Profile.

### Changes and rationale

- Added a single shared `CoachWorkspaceNavigation` component whose stable order and destinations are Profile (`/profile/coach`), Schedule (`/coach`) and Bookings (`/coach?view=bookings`). Each consumer supplies only its active destination, which prevents the Profile and workspace views from drifting again.
- Replaced the two-item `Availability`/`Profile` navigation in the coach editor and the separately implemented Schedule/Bookings navigation with the shared component. `Schedule` is now the consistent label in every coach view.
- Made `navigationForActor` choose the main Profile destination by capability: approved/demo coaches receive `/profile/coach`; ordinary clients, pending/rejected applicants and suspended coaches retain `/profile`. The Coach workspace item and all underlying authority checks are unchanged.
- Kept the signed-in bottom-left account control and upper-right avatar hard-linked to `/profile`, preserving direct personal avatar/account management for coaches after the main Profile default changed.
- Updated the specification and tests for link ordering, selected semantics and every relevant coach-access state.

### Affected files

| File or component | Change and purpose |
| ----------------- | ------------------ |
| [MVP specification](../../../docs/mvp-spec.md) | Defines approved-coach Profile defaulting, the Profile-first coach navigation and retained personal-profile avatar routes. |
| [Shared coach navigation](../../../src/features/coaches/coach-workspace-navigation.tsx) | Owns the three destinations, stable order, labels, icons and `aria-current` selection. |
| [Coach availability panel](../../../src/features/coaches/coach-availability-panel.tsx) | Uses the shared navigation for both Schedule and Bookings views. |
| [Coach profile editor](../../../src/features/coaches/coach-profile-editor.tsx) | Replaces its inconsistent two-link navigation with the shared Profile-selected navigation. |
| [Application shell](../../../src/components/shell.tsx) | Selects coach Profile for approved/demo main navigation while retaining personal Profile for other actors and both account controls. |
| [Coach schedule tests](../../../tests/coach-schedule.test.ts) | Verifies the shared order, destinations, labels and exactly one selected item for all three coach views. |
| [Shell navigation tests](../../../tests/shell-navigation.test.ts) | Verifies approved/demo, suspended, unapproved and unauthorized Profile destinations without changing workspace visibility. |

### Decisions and deviations

- 2026-10-08: Treat the main Profile item as the coach-profile default only for approved/demo coaches. Keep account avatar controls as the stable personal-profile entry and keep suspended actors away from a route that intentionally blocks coach-profile editing.
- 2026-10-08: Keep Profile, Schedule and Bookings as ordinary links with `aria-current="page"` rather than client-only tab state. Each destination remains reloadable, bookmarkable and protected by its existing server authority boundary.
- 2026-10-08: The first browser script read selected state immediately after the URL changed and observed the prior view during the transition. The rehearsal was corrected to wait for each destination heading before asserting navigation state; no product defect or code change was required.

### Contracts, configuration, and operations

- Navigation contract: approved/demo actors' main `Profile` item changes from `/profile` to `/profile/coach`. Other actor states retain `/profile`; `Coach workspace` remains `/coach`; both signed-in avatar controls remain `/profile`.
- Coach-view contract: every editable coach Profile, Schedule and Bookings view exposes the same ordered three links with exactly one current page.
- No data shape, API, authorization policy, dependency, environment variable, setup command or deployment configuration changed. No migration or rollback operation is required; reverting restores only the former link targets and duplicated navigation markup.

## Validation results

| Criterion | Evidence | Result |
| --------- | -------- | ------ |
| AC1 | Static rendering iterated Profile, Schedule and Bookings as active destinations and proved Profile → Schedule → Bookings order, exact URLs, consistent `Schedule` label and one `aria-current="page"`. Authenticated browser navigation confirmed the same order on all three real views. | Passed |
| AC2 | Daniel Park desktop and mobile rehearsal selected the main Profile item, reached `/profile/coach`, displayed `Edit your public coach profile.` and selected the first Profile sub-navigation item. | Passed |
| AC3 | Shell tests keep `/profile` for ordinary, pending, rejected and suspended states. Browser assertions verified `.sidebar-profile` and `.header-avatar` still target `/profile`; mobile Profile targets `/profile/coach` only for the approved Daniel actor. | Passed |
| AC4 | Only presentation/link selection changed; route-level coach authority remains untouched. Existing status tests cover workspace visibility, and direct route services still perform their prior server authorization. | Passed |
| AC5 | `npm test` passed 85 application tests and 2 server tests; `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build` and `git diff --check` passed. Authenticated Chrome checks passed at `1440x1040` and `393x852` with keyboard focus, no horizontal overflow and no page errors. | Passed |

Manual screenshots were written to the ignored local directory `test-results/coach-profile-navigation/` as `profile-desktop.png` and `profile-mobile.png`. Database tests were not run because the ticket changes no persistence query, mutation, schema or authorization policy.

## Risks, limitations, and follow-ups

The word Profile refers to the coach profile in an approved/demo coach's main navigation but to the account profile when using either avatar control. The distinct destinations are intentional; a future information-architecture pass may make their labels more explicit if user testing finds the icon-based account route unclear.

## Completion and review references

- Completed: 2026-10-08; coach views now share one Profile-first navigation and approved/demo main Profile defaults to the coach editor without removing personal Profile access.
- Commit: Not created.
- Review: No independent review or pull request created.
- Deployment or release: None.
