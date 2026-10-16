# Ticket DEV0190: Add the client booking-request flow

- Status: Completed
- Created: 2026-10-10
- Last updated: 2026-10-11
- Milestone: Scheduling-only booking-policy follow-up
- Coordination: [COR0016 — Coach-confirmed booking requests](../organisatory/COR0016-coach-confirmed-booking-requests.md)
- Related records: completed eligibility dependency [DEV0187 — Enforce booking-request eligibility](../backend/DEV0187-enforce-booking-request-eligibility.md), completed request dependency [DEV0188 — Persist multi-candidate booking requests](../backend/DEV0188-persist-multi-candidate-booking-requests.md), conversation interface [DEV0185 — Add client session collaboration](../../current/frontend/DEV0185-add-client-session-collaboration.md), client-history baseline [DEV0144 — Show client booking history](DEV0144-show-client-booking-history.md)

## Objective and context

Replace immediate booking with a saved coach-approval request for every eligible occurrence. A client must feel that their action persisted while remaining clearly aware that a pending request is not a confirmed reservation.

## Scope and non-goals

- In scope:
  - Present `Request session` for every eligible occurrence; expose no instant-booking action.
  - Present server-derived elapsed/unavailable state without relying on the browser for authority.
  - Add a My sessions Requests group with pending, accepted/confirmed, declined, not-selected, withdrawn and expired outcomes.
  - Add client-only bounded request reads plus an exact actor-owned request projection so submission can return the authoritative occurrence snapshot and decision deadline without browser-time calculation or history-page assumptions.
  - Use the approved `Request saved` / `Awaiting coach confirmation` / `This session is not confirmed yet` / decision-deadline language.
  - Let the requesting client withdraw a pending request and recover from stale/unavailable results.
  - Allow a new request after withdrawal, expiry, explicit coach decline or non-selection when the occurrence remains open and future.
  - Ensure no candidate count, identity, status or competition-oriented copy reaches the client.
- Out of scope:
  - Shared request conversation UI owned by DEV0185.
  - Coach request-selection and occurrence-closure UI owned by DEV0189.
  - Calendar invitations, notifications, candidate ranking, waitlists or attendance confirmation.

## Expected behavior and edge cases

- An eligible occurrence creates one persisted pending request and never shows confirmed-booking language until accepted.
- The same signed-in client reopening that occurrence sees `Requested` and can open or withdraw the existing request rather than create a duplicate.
- The saved confirmation names the exact time/location, says the session is not confirmed and shows the decision deadline. It does not mention other requests.
- Elapsed or otherwise unavailable occurrences remain truthful with a disabled action and a specific explanation where the public projection supplies one.
- Accepted requests move into the confirmed Upcoming schedule; terminal unsuccessful requests remain bounded history and consume no session capacity.
- An occurrence closed by the coach is shown as unavailable/not confirmed. It does not imply rejection of the client personally and cannot receive another request.
- A new request after a terminal unsuccessful attempt creates a distinct attempt rather than rewriting history, provided the occurrence remains eligible.
- Database/auth failure shows no optimistic request or booking that PostgreSQL did not persist.

## Assumptions, decisions, and dependencies

- DEV0187 and DEV0188 are complete; this ticket consumes their authoritative eligibility, participant projection and mutation contracts.
- Reuse My sessions with a distinct Requests group rather than create a global inbox.
- The phrase `reserved` is avoided for pending state. The completed action is a saved request, not assigned capacity.
- The first release is Berlin-only. Show the concrete deadline in `Europe/Berlin` while consuming the server-provided instant; do not compute authority from the browser clock.
- DEV0185 later adds the isolated request conversation to the same detail; this ticket owns status and withdrawal only.
- The coach profile and My sessions use client-only booking/request services. They do not fetch coach-owned candidate queues merely because an approved coach also retains client capability.

## Implementation plan

1. Review delivered public/request contracts and relevant bundled Next.js documentation.
2. Add a participant-only exact-request database projection, client-only read services and bounded server actions for request history.
3. Replace coach-profile booking actions with approval requests and add authoritative unavailable/self/existing-request presentation.
4. Add request success, exact deadline, existing-request and withdrawal states.
5. Add the My sessions Requests group and status-to-confirmed transition presentation.
6. Add privacy, accessibility, responsive and two-account browser validation.

## Acceptance criteria

- [x] AC1: Every future eligible occurrence exposes an accurate Request action with no fixed minimum-notice interval, no instant Book action remains, and unavailable actions are truthful.
- [x] AC2: Request creation persists across reload and uses the approved pending copy without confirmed/reserved or other-candidate language.
- [x] AC3: Clients can see and withdraw only their own pending requests, can retry any terminal unsuccessful attempt while still eligible, and see all outcomes truthfully without assigned capacity.
- [x] AC4: Accepted requests become one confirmed upcoming booking, while stale/racing/unavailable results never show false success.
- [x] AC5: Serialized projections, DOM assertions and responsive two-account tests contain no other-candidate identity/count/status data.

## Validation plan

- Add focused component/unit tests for action mode, future/unavailable copy, request statuses, withdrawal and result handling.
- Add Playwright coverage at desktop/mobile widths for request/reload, withdrawal and retry, decline and retry, coach closure, acceptance transition and terminal outcomes.
- Inspect client network/action responses and DOM for prohibited candidate data and language.
- Run configured test, lint, type-check, format and production-build commands.

## Implementation record

Implemented and validated on 2026-10-11.

- 2026-10-11: Implementation started after DEV0189 completed. Review found that paginated history alone cannot guarantee the newly created or recovered pending request is on its first page. The ticket therefore adds an exact participant read so confirmation always uses the database deadline and immutable occurrence/location snapshot.

### Changes and rationale

- Replaced the disabled public-profile placeholder with `Request session`. Signed-in clients receive the database-backed occurrence, location and Berlin decision deadline with `Request saved`, `Awaiting coach confirmation` and explicit not-confirmed language. Reloaded pending occurrences show `Requested` and a withdrawal control; signed-out, unavailable, non-requestable and self-coach states remain distinct.
- Added client-only marketplace and My sessions workspaces. Approved coaches using their retained client capability no longer cause these surfaces to fetch their coach-owned candidate queue.
- Added exact actor-owned and bounded displayed-slot database projections. They reconcile elapsed deadlines, return no unrelated actor row and let submission return the exact persisted request rather than searching a potentially unrelated first history page.
- Added a paginated Booking requests section before confirmed sessions. It separates pending attempts from bounded history, links each coach, presents accepted requests as `Confirmed`, uses neutral unsuccessful labels and refreshes authoritative state after withdrawal.
- Added a repeatable two-account Chrome rehearsal. It drives the Hoang client and Daniel coach interfaces, seeds one isolated competing request for privacy assertions and removes its three fixed occurrences, all related scheduling records and the competitor identity afterward.

### Affected files

| File or component                                                                                     | Change and purpose                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `supabase/migration-history/20261016000100/20261011000300_add_client_booking_request_projections.sql` | Adds exact and bounded actor-owned client projections with deadline reconciliation and runtime-only execution grants.                                                    |
| `src/server/db/coaches/booking-request-repository.ts`                                                 | Validates exact IDs and unique bounded occurrence selections, maps only the existing client-safe projection and rejects malformed database state.                        |
| `src/server/coaches/booking-request-service.ts`                                                       | Adds client-only marketplace, history-page and sessions workspaces; request creation returns its exact actor-owned persisted projection in the same transaction.         |
| `src/app/coach-marketplace-actions.ts`                                                                | Adds validated client pagination, returns exact saved-request details and removes the obsolete instant-booking alias.                                                    |
| `src/app/coaches/[slug]/page.tsx`, `src/features/coaches/coach-marketplace.tsx`                       | Load only client-owned state and render request, reload, deadline, withdrawal, self-coach, signed-out, unavailable and confirmed-booking states.                         |
| `src/app/sessions/page.tsx`, `src/features/profile/client-booking-requests.tsx`                       | Server-render the first client request page and provide bounded loading, withdrawal, neutral outcomes and confirmed-transition presentation before the booking timeline. |
| `src/features/profile/client-booking-request-model.ts`, `client-sessions.tsx`                         | Provide deterministic merging/status copy and clarify that the existing timeline contains confirmed sessions rather than pending requests.                               |
| `src/app/coach-discovery.css`, `src/app/globals.css`                                                  | Add accessible desktop/mobile request controls, cards, status pills and layouts consistent with the existing marketplace and session workspace.                          |
| `tests/client-booking-requests.test.ts`, `tests/server/coach-booking-request-actions.test.ts`         | Cover client ordering/deduplication/copy and forged client pagination cursors.                                                                                           |
| `tests/database/coach-bookings.test.ts`                                                               | Proves exact and displayed-slot projections are actor-owned, reconcile expiry and reject invalid selections.                                                             |
| `scripts/rehearse-local-client-booking-requests.mjs`, `package.json`, `README.md`                     | Add and document the authenticated two-context browser rehearsal, its prerequisites, bounded fixtures and cleanup behavior.                                              |

### Decisions and deviations

- 2026-10-11: Removed the instant-booking branch, added repeat requests after terminal unsuccessful attempts and adopted Berlin deadline presentation from server-provided instants.
- 2026-10-11: Removed minimum-notice and cutoff presentation; the client may request any future open occurrence and sees the server-provided deadline, which may be shorter than 12 hours when training starts sooner.
- 2026-10-11: Kept the existing request-history cursor instead of adding a second list contract. Exact post-mutation reads and bounded displayed-slot reads solve current-state recovery without assuming a new request appears on the first 20-row history page.
- 2026-10-11: Retained all terminal attempts in Request history. Accepted requests also appear in the existing Upcoming booking timeline because request outcome and confirmed-session lifecycle are deliberately separate records.

### Contracts, configuration, and operations

This ticket consumes DEV0187/DEV0188 interfaces and adds one additive migration with `app.current_client_coach_booking_request(uuid)` and `app.current_client_pending_coach_booking_requests(uuid[])`. Both are security-definer, actor-context-validated projections owned by `app_owner`; direct public/Auth/service-role execution is revoked and only `app_runtime` receives execute permission. The array contract accepts 1–200 unique canonical occurrence IDs. The request action now optionally serializes the exact client-safe request, and client pagination uses the existing validated `{ createdAt, id }` cursor with a 20-row page. Rollback drops the two additive functions after removing application callers. No environment variable or external dependency is added.

## Validation results

Validated on 2026-10-11 on macOS with Node 24.21.0, local PostgreSQL/Auth/Mailpit and Chrome.

- `npm test` passed 106 application tests and 9 server-action tests.
- `npm run test:db` passed all 47 serialized database integration tests, including new actor-isolated exact/batch selection, invalid selections and expiry reconciliation.
- `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run db:lint` and `git diff --check` passed.
- `npm run build` completed the optimized Next.js 16.3.8 production build and all 12 static pages.
- `npm run test:client-requests` passed in separate authenticated Hoang-client and Daniel-coach Chrome contexts. It verified request/reload, keyboard withdrawal and retry, decline and retry, acceptance into Upcoming, occurrence closure, expiry, client DOM/action-response privacy, no mobile horizontal overflow and exact fixture cleanup. It captured and visually reviewed 1440 × 1040 and 393 × 852 full-page evidence.
- `npx supabase migration up --local` applied the additive migration without resetting data. After correcting an array-alias ambiguity found by the first integration run, a transaction dropped both functions, replayed the final migration file with fresh `create function` statements, exercised exact and array calls, and rolled back; the final database and lint suites passed.
- Early checks found and fixed the qualified PostgreSQL alias, one browser selector that matched the persistent client's older Daniel bookings, and a plain-`npm run dev` preview-mode rehearsal setup. These were validation/setup failures, not accepted limitations. No required check remains failed, blocked or not run.

| Criterion | Evidence                                                                                                                                                     | Result |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| AC1       | Public-profile Request controls, self/unavailable states, no instant-book alias, existing future-start database tests and authenticated browser flow.        | Passed |
| AC2       | Exact saved projection plus reload rehearsal displayed the approved pending copy, immutable occurrence/location and server-provided Berlin deadline.         | Passed |
| AC3       | Actor-isolation database tests and browser withdrawal/retry, decline/retry, closure, expiry and neutral bounded history checks.                              | Passed |
| AC4       | Atomic backend suites plus browser acceptance showed one `Confirmed` request and one Daniel booking in Upcoming; conflict branches never return saved state. | Passed |
| AC5       | Client-safe projection shapes, seeded-competitor database isolation, DOM/captured-action assertions, responsive screenshots and no-overflow check.           | Passed |

## Risks, limitations, and follow-ups

- Request persistence and booking confirmation must use visibly different success language.
- Without notifications, the client learns decisions when revisiting the app; do not promise email or push alerts.
- Calendar export of tentative or confirmed sessions remains separate future work.
- Request history loads 20 records at a time. No search/filter controls or push/email decision notification is included.

## Completion and review references

- Completed: 2026-10-11.
- Commit: Planning record was included in `[DEV0182][DEV0183][DEV0184][DEV0185][DEV0186][DEV0187][DEV0188][DEV0189][DEV0190] Plan session collaboration and booking requests`; implementation is committed with this completed record under `[DEV0190] Add client booking request flow`.
- Review: No review created.
- Deployment or release: Not deployed or released.
