# Ticket DEV0206: Redesign coach Bookings

- Status: Completed
- Created: 2026-10-12
- Last updated: 2026-10-12
- Milestone: Scheduling interface authenticated-workspace follow-up
- Coordination: [COR0018 — Authenticated workspace redesign](../organisatory/COR0018-authenticated-workspace-redesign.md)
- Related records: completed contract [DEV0202 — Adopt the authenticated workspace redesign contract](../../archive/organisatory/DEV0202-adopt-authenticated-workspace-redesign-contract.md), completed coach-frame dependency [DEV0205 — Redesign coach Schedule](../../archive/frontend/DEV0205-redesign-coach-schedule.md), request baseline [DEV0189 — Add the coach booking-request queue](../../archive/frontend/DEV0189-add-coach-booking-request-queue.md) and booking-avatar baseline [DEV0169 — Show client avatars in coach bookings](../../archive/frontend/DEV0169-show-client-avatars-in-coach-bookings.md)

## Objective and context

Redesign the coach Bookings tab around the approved authenticated hierarchy so pending decisions, recent terminal request history and confirmed bookings are easier to scan without weakening request isolation or booking authority.

## Scope and non-goals

- In scope: Bookings active-tab framing, occurrence/request groups, decision deadlines/statuses, accept/decline/close controls, recent request history, confirmed booking cards and completion/cancellation states.
- Out of scope: policy/persistence changes, candidate messages, unbounded request loading, schedule editing, session notes or client-side candidate visibility.

## Expected behavior and edge cases

- Pending requests remain grouped by exact occurrence with private avatar/initial, Berlin deadline and separate accept/decline controls.
- Closing one occurrence, accepting one candidate and terminal history remain visually distinct and use existing concurrency/error handling.
- Confirmed booked schedule stays only in Bookings and exposes only the owning coach's authorized client data.
- Empty, suspended, unavailable, paginated and action-busy/result states remain usable.

## Assumptions, decisions, and dependencies

- DEV0205 supplies shared coach frame/navigation styling.
- Existing request/booking services and bounded pagination remain unchanged.
- The concept's free-text client messages are not available and will not be fabricated.

## Implementation plan

1. Recompose existing request queue and coach booking cards within the shared coach frame.
2. Apply clear status/deadline/action hierarchy and responsive group/card layouts.
3. Extend actor/privacy/action/failure browser and component coverage.
4. Run relevant test, static and build checks.

## Acceptance criteria

- [x] AC1: Bookings presents pending decisions, recent request history and confirmed bookings as distinct truthful sections.
- [x] AC2: Accept/decline/close/cancel/complete behavior and actor-scoped client identity remain unchanged.
- [x] AC3: Pagination, empty/unavailable/suspended/busy states remain accessible at mobile and desktop widths.
- [x] AC4: Relevant tests, lint, type-check, formatting and build pass.

## Validation plan

- Extend component tests for section/status hierarchy and existing action boundaries.
- Run authenticated coach Playwright for multiple requests, one acceptance, decline/close, history, booking actions, mobile/desktop and failure states.
- Run application tests and static/build checks.

## Implementation record

Implementation started and completed on 2026-10-12 after DEV0205 established and validated the shared coach heading, truthful publication summary and stable Profile/Schedule/Bookings tabs. Signed-in review confirmed that Bookings inherited that new frame while its request queue, history and booked-client panels retained the older boxed presentation.

### Changes and rationale

- Added one scoped Bookings workspace boundary beneath the shared coach heading/tabs so request and booked-session presentation can use the new hierarchy without altering Schedule, application gates or public pages.
- Reworked the request queue into an unboxed section with a clear `Booking requests` heading, light occurrence summaries, full-width candidate rows, separate requested/deadline information and 44px pill actions. Decline is visually secondary and Accept remains the primary action.
- Retained exact occurrence grouping, Berlin decision deadlines, bounded pagination, explicit close-occurrence confirmation and terminal recent-history disclosure. History keeps client avatars/initials and status text without exposing it outside the owning coach's existing authenticated projection.
- Reworked booked sessions from a two-column legacy card grid into full-width rows that align client avatar/name/location, scheduled time, lifecycle status and the currently authorized cancel or completion action.
- Added responsive single-column request and booked-session rows while preserving text status identity, full-width mobile actions, keyboard focus and no-horizontal-overflow behavior.
- Strengthened the authenticated browser rehearsal to wait for hydration, assert the new shared/section headings, require a 44px mobile Accept control, verify an accepted client receives a cancellable confirmed booking card and capture the completed history/booking result.

### Affected files

| File or component                                                   | Change and purpose                                                                                                                                                          |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/coach/page.tsx`                                            | Groups request and booking sections under a scoped Bookings presentation boundary while retaining the existing parallel server reads and suspended-coach handoff.           |
| `src/features/coaches/coach-booking-request-queue.tsx`              | Refines section copy and candidate-row hierarchy, separates requested/deadline information and reorders secondary/primary decision controls without changing their actions. |
| `src/features/coaches/coach-client-cards.tsx`                       | Presents actor-scoped client identity, location, session time, lifecycle state and available cancel/complete action as responsive booking rows.                             |
| `src/app/coach-workspace.css`                                       | Adds scoped desktop/tablet/mobile Bookings layout, modern surfaces, status hierarchy and 44px action targets.                                                               |
| `tests/coach-schedule.test.ts`                                      | Keeps Schedule/Bookings content isolation assertions aligned with the renamed Booked sessions section.                                                                      |
| `scripts/rehearse-local-coach-booking-requests.mjs`                 | Extends live evidence for new hierarchy, hydration, mobile target size and confirmed-booking continuity.                                                                    |
| `tickets/archive/frontend/DEV0206-redesign-coach-bookings.md`       | Records implementation, decisions, validation and limitations for this slice.                                                                                               |
| `tickets/current/organisatory/COR0018-*.md` and `tickets/README.md` | Advance the authenticated redesign workstream from Bookings to Profiles.                                                                                                    |

### Decisions and deviations

- Kept recent terminal request history inside the existing disclosure. This prevents a long historical list from dominating the default decision queue while still making immutable outcomes and client avatars inspectable.
- Kept request occurrence summaries and candidate rows instead of adopting fabricated client messages from the concept. The application has no candidate-message contract.
- Retained all bookings in one truthful section because cancelled and completed records are part of coach history; the section is named `Booked sessions`, not `Confirmed sessions`, so its title does not mislabel terminal records.
- The visual action order is Decline then Accept to place the primary action at the row edge. Action functions, busy keys, concurrency refresh and authority checks are unchanged.

### Contracts, configuration, and operations

No schema, API, data shape, environment variable, dependency, migration or deployment operation changed. Existing request/avatar/booking projections and server actions remain authoritative and actor-scoped.

## Validation results

- `npm test` passed with 122 unit/component tests and 9 server tests under Node 24.21.0.
- `npm run lint`, `npm run typecheck`, `npm run format:check` and `git diff --check` passed.
- `npm run build` completed successfully with Next.js 16.3.8 and generated all application routes.
- `npm run test:coach-requests` passed against local Supabase Auth/PostgreSQL and the Node 24 development server. The 24-request fixture verified initial bounded pagination, three occurrence groups, client identity rendering, mobile 44px Accept control, keyboard focus/activation, explicit close confirmation, decline, accept, closure, immutable Accepted/Declined/Not selected/Occurrence closed history, confirmed-booking continuity, cancel availability and no horizontal overflow or browser page error.
- Manual screenshot review passed for `test-results/coach-request-rehearsal/coach-request-queue-desktop.png`, `coach-request-queue-mobile.png` and `coach-request-workflow-complete-desktop.png`.
- Database migration/RLS tests were not run because no data, authorization or persistence contract changed; the live rehearsal exercised the unchanged server mutations and actor-scoped reads.

| Criterion | Evidence                                                                                                                                                                                                | Result |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Screenshot/live review shows separate request decisions, disclosed terminal history and booked-session rows with distinct headings, counts and lifecycle labels.                                        | Passed |
| AC2       | The live 24-request flow completed decline, accept and closure and produced a cancellable confirmed booking; existing unit/server tests preserved cancel/complete and bounded identity contracts.       | Passed |
| AC3       | Bounded load-more behavior, explicit close confirmation, busy refresh, empty/unavailable component branches, 393px no-overflow, 44px action and keyboard checks passed; suspended routing is unchanged. | Passed |
| AC4       | 131 automated application tests, lint, type generation/TypeScript, formatting, diff check, production build and authenticated request rehearsal passed under the required Node release.                 | Passed |

## Risks, limitations, and follow-ups

- A deliberately extreme 24-request rehearsal produces a long page after every bounded page is loaded; the default remains capped at 20 and terminal history stays collapsed. Virtualization is not justified for the current bounded queue.
- Visual grouping does not imply that requests reserve capacity and does not change client visibility. Candidate comparison exists only in the owning coach's private workspace.
- Session collaboration remains owned by COR0015; this ticket adds no notes/message controls.

## Completion and review references

- Completed: 2026-10-12.
- Commit: Included with the implementation commit whose subject references DEV0206.
- Review: No review created.
- Deployment or release: Not deployed or released.
