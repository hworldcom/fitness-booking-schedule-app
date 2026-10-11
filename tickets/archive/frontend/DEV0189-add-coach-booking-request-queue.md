# Ticket DEV0189: Add the coach booking-request queue

- Status: Completed
- Created: 2026-10-10
- Last updated: 2026-10-11
- Milestone: Scheduling-only booking-policy follow-up
- Coordination: [COR0016 — Coach-confirmed booking requests](../../current/organisatory/COR0016-coach-confirmed-booking-requests.md)
- Related records: completed eligibility dependency [DEV0187 — Enforce booking-request eligibility](../backend/DEV0187-enforce-booking-request-eligibility.md), completed request dependency [DEV0188 — Persist multi-candidate booking requests](../backend/DEV0188-persist-multi-candidate-booking-requests.md), conversation interface [DEV0184 — Add the coach session workspace](../../current/frontend/DEV0184-add-coach-session-workspace.md)

## Objective and context

Give coaches a private queue for deciding approval requests and a way to close one occurrence when they are no longer available. Existing Coach workspace confirms every client immediately and has no candidate-selection interface.

## Scope and non-goals

- In scope:
  - Add a Pending requests section in Bookings with client identity, occurrence time/location, request/deadline status and accept/decline actions.
  - Keep the read boundary coach-only: the coach page loads only requests addressed to the owning coach and does not fetch the same account's client-side request history.
  - Add an explicit close-occurrence action that explains it will make that one session unavailable and close all pending requests without changing the recurring schedule.
  - Paginate request groups/results so the interface stays bounded without a product-level candidate cap.
  - Clearly distinguish requests from confirmed bookings and preserve existing confirmed booking actions.
  - Handle version conflicts, concurrent selection, expiry, unavailable state and responsive keyboard use.
- Out of scope:
  - Shared/private conversation controls owned by DEV0184.
  - Client request/status UI owned by DEV0190.
  - Candidate ranking, recommendation, bulk acceptance, notifications or attendance confirmation.

## Expected behavior and edge cases

- The queue explains that requests do not reserve the session and only the selected client becomes confirmed.
- The pending queue never appears in Schedule or public views. It groups requests by occurrence without implying that any pending client owns the time.
- Accepting one request updates it to confirmed and removes/closes the others after refresh. A stale concurrent accept reports that the slot/request changed rather than claiming success.
- Declining one request leaves other requests and the occurrence available. Pending requests appear before terminal attempts. Accepted, declined, withdrawn, expired, not-selected and occurrence-closed attempts are immutable, read-only recent history; “terminal” means that request attempt has ended, not that the training session occurred.
- Closing an occurrence requires clear confirmation, closes all pending requests and removes that occurrence from requestable availability. A concurrent accept/close conflict reports the authoritative result.
- Request conversations, when DEV0184 is delivered, remain isolated per candidate.

## Assumptions, decisions, and dependencies

- DEV0187 and DEV0188 are complete; this ticket is Ready to consume their authoritative eligibility, participant projection and mutation contracts.
- Reuse Coach workspace Bookings for request decisions; do not add a policy form or a fourth coach tab.
- Client private avatars remain unavailable for pending requests unless the authoritative contract explicitly changes the confirmed-booking media boundary; stable initials are sufficient.
- DEV0184 owns note composition and may enhance each request detail after this ticket establishes the queue.
- The initial page is server-rendered from a coach-only service. A narrow client component appends bounded pages through a reauthorized server action and merges repeated occurrence groups without importing server-only code.
- Browser rehearsal creates isolated temporary clients, one occurrence and multiple requests through the authorized database functions, signs in only as the coach for this ticket's interface checks, and removes those fixtures afterward. Creating requests through the client interface remains DEV0190 scope.

## Implementation plan

1. Review delivered policy/request contracts and relevant bundled Next.js documentation.
2. Add a coach-only paginated read service and server action, then group appended request pages by occurrence in Bookings.
3. Add the guarded one-occurrence close action and explanatory confirmation.
4. Add accessible responsive states, conflict recovery and truthful terminal/unavailable presentation.
5. Add grouping/pagination/component tests and an authenticated desktop/mobile rehearsal backed by isolated multi-client request fixtures.

## Acceptance criteria

- [x] AC1: Every requestable occurrence uses approval; the coach interface exposes no instant/approval or notice configuration.
- [x] AC2: The owning coach can inspect multiple pending requests per occurrence without any one appearing confirmed or reserved.
- [x] AC3: Accept, decline and close-occurrence actions present atomic backend outcomes truthfully and preserve existing confirmed-booking actions.
- [x] AC4: Suspended/unrelated actors, stale actions, expiry and database failure expose no unauthorized candidate data or false success.
- [x] AC5: Keyboard and responsive desktop/mobile validation passes for the paginated request queue and its decision/closure controls.

## Validation plan

- Add component/unit tests for pagination, grouping, close confirmation and action results.
- Add Playwright coverage for a coach accepting one of multiple requests, declining one while another remains and closing an occurrence with pending requests.
- Perform authenticated desktop/mobile rehearsal using one coach and multiple local clients.
- Run configured test, lint, type-check, format and production-build commands.

## Implementation record

Implemented and validated on 2026-10-11.

### Changes and rationale

- Added a server-rendered request queue to Coach workspace Bookings. It groups candidates by occurrence, presents pending candidates before ended attempts, and keeps the existing confirmed private-session cards directly below the queue.
- Added a coach-only paginated read service and reauthorized server action. The first 20 records arrive with the page; `Load more requests` uses a validated keyset cursor and merges repeated occurrence groups without exposing the same account's client-side request history.
- Added per-request Accept and Decline controls plus a two-step Close occurrence control. Every successful or conflicting mutation reloads the authoritative first page before presenting its result; acceptance also refreshes the server-rendered confirmed-booking cards.
- Added explicit empty, unavailable, loading, conflict and immutable-history presentation. Pending candidates use names and initials only because pending-request avatar access is not authorized; terminal labels describe request outcomes rather than attendance.
- Added a repeatable authenticated browser rehearsal with 24 temporary clients across three occurrences. It proves bounded pagination, multiple candidates, accept/decline/closure transitions, history, confirmed-booking continuity, keyboard operation and desktop/mobile layout, then removes only the exact temporary identities and scheduling records.
- Replaced locale-dependent punctuation in the request and confirmed-booking timestamps with deterministic formatting. The rehearsal exposed the mismatch after acceptance; this prevents server/client hydration recovery while preserving the same date and time information.

### Affected files

| File or component                                           | Change and purpose                                                                                                                                                 |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/app/coach/page.tsx`                                    | Loads the bounded coach-only request page only for Bookings and composes it with confirmed bookings, including the suspended-coach resolution path.                |
| `src/features/coaches/coach-booking-request-queue.tsx`      | Renders grouped candidates, bounded pagination, decisions, close confirmation, terminal history and truthful failure states through an accessible client boundary. |
| `src/features/coaches/coach-booking-request-queue-model.ts` | Provides deterministic page merging, occurrence grouping, pending-first ordering and terminal status labels.                                                       |
| `src/app/coach-workspace.css`                               | Adds desktop/mobile queue, action, confirmation, history and status presentation without changing the shared workspace navigation.                                 |
| `src/app/coach-marketplace-actions.ts`                      | Adds the validated, reauthorized coach-page loader while reusing the delivered mutation actions.                                                                   |
| `src/server/coaches/booking-request-service.ts`             | Adds a coach-only read service so this interface does not fetch client request history.                                                                            |
| `src/domain/coach-booking-requests.ts`                      | Validates serialized keyset cursors before they cross the private read boundary.                                                                                   |
| `src/features/coaches/coach-client-cards.tsx`               | Uses deterministic timestamp punctuation so a newly accepted booking hydrates identically in Node and the browser.                                                 |
| `tests/coach-booking-request-queue.test.ts`                 | Covers page deduplication, occurrence grouping, pending-first ordering and every terminal label.                                                                   |
| `tests/server/coach-booking-request-actions.test.ts`        | Proves forged pagination cursors fail before private data is read.                                                                                                 |
| `scripts/rehearse-local-coach-booking-requests.mjs`         | Creates isolated multi-client local fixtures, drives the authenticated coach flow and cleans all exact fixtures.                                                   |
| `package.json`, `README.md`                                 | Expose and document `npm run test:coach-requests` and its local prerequisites/cleanup behavior.                                                                    |

### Decisions and deviations

- 2026-10-11: Removed the policy settings form after approval became the only booking mode. Added bounded pagination and coach-controlled closure of a specific occurrence.
- 2026-10-11: Adopted a coach-only read service rather than the combined client/coach workspace for this screen. Pending attempts are the primary queue; ended attempts remain immutable read-only recent history. Browser validation seeds multiple temporary clients through authorized database functions because DEV0190, not this ticket, owns client-side request creation.
- 2026-10-11: Reload the authoritative first request page after every decision instead of guessing the affected terminal states in browser memory. This also preserves truthful stale/conflict recovery while `router.refresh()` is reserved for acceptance, where the adjacent confirmed-booking projection must change.
- 2026-10-11: The rehearsal inserts disposable Auth identities directly into the explicitly guarded loopback database because the local CLI status process stalled while otherwise healthy services were running. Application enrollment and request creation still use their authoritative database functions; the script refuses any database target except loopback port 55322.

### Contracts, configuration, and operations

This ticket consumes DEV0187/DEV0188 interfaces and adds one serialized server-action contract: a validated `{ createdAt, id }` cursor returns at most 20 coach-owned request projections per page. It adds no migration, environment variable, external dependency or deployment step. The optional rehearsal requires the existing Auth-enabled local stack, the provisioned Daniel Park account, the app on port 3100 and local PostgreSQL on port 55322.

## Validation results

Validated on 2026-10-11 on macOS with Node 24.21.0, the Auth-enabled local Supabase stack, Daniel Park's provisioned coach identity and Chrome.

- `npm run lint` passed.
- `npm run typecheck` passed after Next.js generated route types.
- `npm test` passed all 104 application tests and 9 server-action tests.
- `npm run test:db` passed all 46 serialized database integration tests, including actor isolation, expiry, unlimited candidates, concurrent acceptance, closure, failure rollback and suspended-coach resolution.
- `npm run format:check` and `git diff --check` passed.
- `npm run build` completed the optimized Next.js 16.3.8 production build and all 12 static pages under Node 24.21.0.
- `npm run test:coach-requests` passed under Node 24.21.0. It loaded 24 requests in two pages, found eight candidates in each of three occurrence groups, declined one while leaving seven candidates, accepted one and found the resulting confirmed client card, closed another occurrence, verified all terminal labels, checked keyboard focus/Enter operation, asserted no horizontal mobile overflow, captured 1440 × 1040 and 393 × 852 full-page evidence, reported no browser page errors and removed every `dev0189-client-*` identity afterward.
- Visual review of both captured pages confirmed that occurrence headers, candidate actions, closure controls and confirmed-booking continuity remain readable at desktop and mobile widths.
- Early rehearsal runs exposed a decision-refresh race and locale-dependent hydration mismatch. Both were fixed; the final Node 24 run passed without browser errors. No required validation remains blocked or not run. Database lint and migration replay were not applicable because this ticket changes no database object.

| Criterion | Evidence                                                                                                                                                               | Result |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Queue copy/actions and browser DOM expose only approval decisions; application and database suites retain stale direct-booking rejection.                              | Passed |
| AC2       | The 24-client rehearsal rendered eight independent pending candidates per occurrence with no confirmed/reserved candidate state.                                       | Passed |
| AC3       | The rehearsal verified decline, atomic acceptance into the existing confirmed card, two-step closure and terminal history; database concurrency/rollback tests passed. | Passed |
| AC4       | Coach-only service/action boundaries, forged-cursor test, unavailable states and database authorization/expiry/suspension suites passed.                               | Passed |
| AC5       | Desktop/mobile screenshots, no-overflow assertion, focused Accept control and keyboard-opened closure confirmation passed.                                             | Passed |

## Risks, limitations, and follow-ups

- Dense candidate queues are bounded but remain intentionally compact; candidate ranking, filters and bulk actions remain out of scope.
- No notification delivery exists; coaches must revisit Bookings to see new requests.
- Pending candidates show generated initials rather than private profile images. The confirmed-booking avatar boundary remains unchanged.
- DEV0190 still owns the client request/reload/withdrawal/status interface, so the entire COR0016 feature is not complete yet.

## Completion and review references

- Completed: 2026-10-11.
- Commit: Planning record was included in `[DEV0182][DEV0183][DEV0184][DEV0185][DEV0186][DEV0187][DEV0188][DEV0189][DEV0190] Plan session collaboration and booking requests`; implementation is committed with this completed record under `[DEV0189] Add coach booking request queue`.
- Review: No review created.
- Deployment or release: Not deployed or released.
