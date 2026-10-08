# Ticket DEV0170: Separate coach Schedule and Bookings tabs

- Status: Completed
- Created: 2026-10-08
- Last updated: 2026-10-08
- Milestone: Scheduling-only M3 interface follow-up
- Coordination: None — independent development ticket
- Related records: follows [DEV0145 — Show booking clients to coaches](../../archive/frontend/DEV0145-show-booking-clients-to-coaches.md) and [DEV0169 — Show client avatars in coach bookings](../../archive/frontend/DEV0169-show-client-avatars-in-coach-bookings.md)

## Objective and context

Make the coach workspace Schedule and Bookings controls behave as distinct views. The current Bookings control only jumps to a booked-schedule section rendered on the Schedule page, and the dated occurrence list repeats the booked client's identity. This makes the same booking content appear under both labels. The requested outcome is for detailed booking content to live only in Bookings while Schedule remains focused on recurring availability and dated capacity. This refines the coach behavior in [scheduling behavior and permissions](../../../docs/mvp-spec.md#9-scheduling-behavior-and-permissions) and the [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix).

## Scope and non-goals

- In scope: add URL-backed Schedule and Bookings views on `/coach`; mark only the selected control active; render availability editing and dated slot status only in Schedule; render the booked-session cards, client identity/avatar and terminal actions only in Bookings; stop projecting booking details into Schedule; preserve protected coach access and suspended-coach access to existing bookings; update specification and tests.
- Out of scope: changing booking persistence, authorization, avatar access, cancellation/completion rules, recurring availability behavior, the separate coach Profile route, client-facing My sessions, or adding realtime updates.

## Expected behavior and edge cases

- `/coach` is the default Schedule view and contains the working-week editor plus dated occurrences, including whether an occurrence is open or booked, but no client name/avatar and no detailed booking cards.
- `/coach?view=bookings` is the Bookings view and contains the complete protected booked schedule with client identity/avatar and permitted booking actions, but no availability editor or dated-occurrence duplicate.
- The navigation exposes ordinary links, carries `aria-current="page"` only on the selected view and remains usable without client-side state.
- Unknown, repeated or array-valued `view` parameters fail to the Schedule view rather than exposing additional data.
- Signed-out and forbidden behavior remains unchanged. A suspended coach retains the existing bounded booking-history presentation and does not regain scheduling authority.

## Assumptions, decisions, and dependencies

- Use a query-backed view on the existing protected `/coach` route rather than introduce a second route with duplicate authentication and coach-access branching. Next.js 16 supplies page search parameters asynchronously, so the page will await the framework-provided `searchParams` promise.
- A booked occurrence remains visible as capacity state on Schedule because coaches must know that the hour is occupied; only client identity, avatar and detailed booking controls move exclusively to Bookings.
- Fetch the private booking workspace only for the Bookings view where practical. The Schedule view does not need private booking projection data after client details are removed from occurrences.

## Implementation plan

1. Update the current specification to distinguish the Schedule availability view from the Bookings detail view.
2. Parse the bounded coach-workspace view in the server page and load private bookings only for Bookings, without weakening existing access-state handling.
3. Make the workspace navigation reflect the active view, render one view at a time and remove private booking projection logic from dated occurrences.
4. Update focused rendering tests for tab exclusivity, active semantics, occupied-slot presentation and invalid-view fallback; run relevant unit, type, lint, formatting, build and responsive browser checks.

## Acceptance criteria

- [x] AC1: The default Schedule view shows availability controls and dated open/booked status but no booked-schedule cards, client name/avatar or booking actions.
- [x] AC2: The Bookings view shows the complete protected booked schedule with client identity/avatar and applicable actions but no working-week editor or dated-occurrence duplicate.
- [x] AC3: Schedule and Bookings are keyboard-accessible links with correct selected semantics, and an invalid view value safely resolves to Schedule.
- [x] AC4: Existing signed-out, forbidden, unavailable and suspended-coach boundaries remain intact without schema, authorization or booking-lifecycle changes.
- [x] AC5: Focused automated checks, lint, type checking, formatting, production build and responsive authenticated browser verification pass.

## Validation plan

Add pure view-resolution coverage and update server-rendered coach-workspace tests to prove mutual exclusivity, active navigation and the booked-without-client Schedule state. Exercise the authenticated Daniel Park workspace at desktop and mobile widths by switching between Schedule and Bookings and verifying the URL, selected control and exclusive content. Run `npm test`, relevant database tests only if server data behavior changes, `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build` and `git diff --check`. Database migration/lint checks are not expected because this is a presentation/query-selection change with no data contract change.

## Implementation record

Completed on 2026-10-08. The protected coach route now resolves a bounded Schedule or Bookings view from the URL. Schedule owns the working-week editor and dated capacity list without receiving private booking projections; Bookings owns the client cards, avatars and booking actions without rendering schedule-management content.

### Changes and rationale

- Added a small pure resolver for the optional `view` query. Only the exact scalar value `bookings` selects Bookings; absent, unknown or repeated values safely select Schedule.
- Changed the coach page to await the Next.js 16 search-parameter promise and request the private booking workspace only for the Bookings view. Existing authentication, unavailable-state and coach-capability branches remain server-owned.
- Made the workspace header, selected navigation state and content conditional on the resolved view. `/coach` shows Schedule and `/coach?view=bookings` shows Bookings as ordinary keyboard-accessible links.
- Removed private booking lookup, client names and avatars from dated occurrences. A booked Schedule occurrence retains its authoritative `booked` status and the neutral `Reserved hour` label so coaches can still understand capacity without duplicating booking details.
- Kept suspended coaches out of scheduling while adding an explicit link to their bounded Bookings view; the existing booking-history content renders only at that URL.
- Updated Bookings copy for the standalone view and corrected the singular/plural count (`1 booking`, otherwise `N bookings`). Removed schedule-only client-avatar CSS that became unreachable.
- Updated the current product contract and focused tests for exclusive rendering, active-link semantics, safe query fallback and suspended access.

### Affected files

| File or component | Change and purpose |
| ----------------- | ------------------ |
| [MVP specification](../../../docs/mvp-spec.md) | Defines Schedule as availability/capacity and Bookings as the sole detailed client-booking view. |
| [Coach page](../../../src/app/coach/page.tsx) | Resolves the URL-backed view, conditionally loads booking data and preserves access-state handling. |
| [Workspace view resolver](../../../src/features/coaches/coach-workspace-view.ts) | Provides the bounded scalar-query contract and safe Schedule fallback. |
| [Availability panel](../../../src/features/coaches/coach-availability-panel.tsx) | Renders one selected workspace view at a time and removes client identity from booked occurrences. |
| [Booking cards](../../../src/features/coaches/coach-client-cards.tsx) | Uses Bookings-specific explanatory copy and a grammatically correct booking count. |
| [Coach application gate](../../../src/features/coaches/coach-application-gate.tsx) | Routes suspended coaches to their existing sessions through Bookings only. |
| [Coach workspace styles](../../../src/app/coach-workspace.css) | Removes the obsolete booked-occurrence client presentation selectors. |
| [Coach schedule tests](../../../tests/coach-schedule.test.ts) | Covers exclusive content, occupied status, active links, invalid query values and suspended-booking access. |

### Decisions and deviations

- 2026-10-08: Keep booked occurrences visible as occupied capacity in Schedule, but move all client-identifying and actionable booking detail exclusively into Bookings.
- 2026-10-08: Use `?view=bookings` rather than a second route. This keeps one protected server entry point and avoids duplicating identity/capability branching while still providing a bookmarkable and reload-stable view.
- 2026-10-08: Read the installed Next.js 16.3.8 page/search-parameter documentation before implementation and use the required asynchronous page prop rather than relying on an older synchronous API.

### Contracts, configuration, and operations

- URL contract: `/coach` selects Schedule; `/coach?view=bookings` selects Bookings. Any other scalar value or any repeated/array value selects Schedule.
- Presentation contract: private booking DTOs are requested and rendered only for Bookings. Schedule continues to show the occurrence's non-identifying capacity status.
- No database schema, authorization policy, booking/avatar contract, dependency, environment variable, setup command or deployment configuration changed. No migration or operational action is required.

## Validation results

| Criterion | Evidence | Result |
| --------- | -------- | ------ |
| AC1 | Focused static-render tests verify Schedule contains the editor, dated occurrence, `booked` status and `Reserved hour`, while excluding the injected booking card, client name and image URL. Authenticated desktop/mobile rehearsal confirmed no `BOOKED SCHEDULE` section on `/coach`. | Passed |
| AC2 | Focused tests verify Bookings contains the injected booking content while excluding `Your working week`, `Dated class times` and `Save schedule`. Daniel Park's authenticated rehearsal showed the real Hoang booking card and visible avatar only at `/coach?view=bookings`. | Passed |
| AC3 | Resolver tests cover absent, exact, unknown and array values. Static rendering proves one `aria-current="page"` link. Browser rehearsal switched both links, checked the URL and active state, focused Schedule by keyboard and found no horizontal overflow at `393x852`. | Passed |
| AC4 | Suspended-gate tests verify Schedule links to Bookings without history and Bookings renders supplied history without scheduling authority. Anonymous `HEAD /coach?view=bookings` returned the existing `307` sign-in redirect; forbidden/unavailable branches were not changed. | Passed |
| AC5 | `npm test` passed 83 application tests and 2 server tests; `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build` and `git diff --check` passed. The authenticated Chrome rehearsal passed at `1440x1040` and `393x852` with no page errors. | Passed |

Manual screenshots were written to the ignored local directory `test-results/coach-workspace-tabs/`: `schedule-desktop.png`, `bookings-desktop.png`, `schedule-mobile.png` and `bookings-mobile.png`. Database suites were not run because no query contract, mutation, schema or authorization policy changed; the page only skips an unnecessary private-booking read in Schedule.

## Risks, limitations, and follow-ups

Regular links deliberately cause a server navigation so authorization and data selection remain server-owned. Schedule still lists booked hours as capacity state, which is intentional and is not a duplicate of the detailed booked schedule. Realtime cross-session changes remain out of scope.

## Completion and review references

- Completed: 2026-10-08; Schedule and Bookings now render mutually exclusive coach-workspace content with responsive authenticated evidence.
- Commit: Not created.
- Review: No independent review or pull request created.
- Deployment or release: None.
