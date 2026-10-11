# Ticket DEV0190: Add the client booking-request flow

- Status: Draft
- Created: 2026-10-10
- Last updated: 2026-10-11
- Milestone: Scheduling-only booking-policy follow-up
- Coordination: [COR0016 — Coach-confirmed booking requests](../organisatory/COR0016-coach-confirmed-booking-requests.md)
- Related records: eligibility dependency [DEV0187 — Enforce booking-request eligibility](../backend/DEV0187-enforce-booking-request-eligibility.md), request dependency [DEV0188 — Persist multi-candidate booking requests](../backend/DEV0188-persist-multi-candidate-booking-requests.md), conversation interface [DEV0185 — Add client session collaboration](DEV0185-add-client-session-collaboration.md), client-history baseline [DEV0144 — Show client booking history](../../archive/frontend/DEV0144-show-client-booking-history.md)

## Objective and context

Replace immediate booking with a saved coach-approval request for every eligible occurrence. A client must feel that their action persisted while remaining clearly aware that a pending request is not a confirmed reservation.

## Scope and non-goals

- In scope:
  - Present `Request session` for every eligible occurrence; expose no instant-booking action.
  - Present notice/cutoff ineligibility without relying on the browser for authority.
  - Add a My sessions Requests group with pending, accepted/confirmed, declined, not-selected, withdrawn and expired outcomes.
  - Use the approved `Request saved` / `Awaiting coach confirmation` / `This session is not confirmed yet` / decision-deadline language.
  - Let the requesting client withdraw a pending request and recover from stale/unavailable results.
  - Allow a new request after withdrawal, expiry, explicit coach decline or non-selection when the occurrence remains open and before its cutoff.
  - Ensure no candidate count, identity, status or competition-oriented copy reaches the client.
- Out of scope:
  - Shared request conversation UI owned by DEV0185.
  - Coach request-selection and occurrence-closure UI owned by DEV0189.
  - Calendar invitations, notifications, candidate ranking, waitlists or attendance confirmation.

## Expected behavior and edge cases

- An eligible occurrence creates one persisted pending request and never shows confirmed-booking language until accepted.
- The same signed-in client reopening that occurrence sees `Requested` and can open or withdraw the existing request rather than create a duplicate.
- The saved confirmation names the exact time/location, says the session is not confirmed and shows the decision deadline. It does not mention other requests.
- Notice-ineligible occurrences remain truthful with a disabled action and specific timing explanation where the public projection supplies one.
- Accepted requests move into the confirmed Upcoming schedule; terminal unsuccessful requests remain bounded history and consume no session capacity.
- An occurrence closed by the coach is shown as unavailable/not confirmed. It does not imply rejection of the client personally and cannot receive another request.
- A new request after a terminal unsuccessful attempt creates a distinct attempt rather than rewriting history, provided the occurrence remains eligible.
- Database/auth failure shows no optimistic request or booking that PostgreSQL did not persist.

## Assumptions, decisions, and dependencies

- DEV0187 and DEV0188 must complete before this ticket becomes Ready.
- Reuse My sessions with a distinct Requests group rather than create a global inbox.
- The phrase `reserved` is avoided for pending state. The completed action is a saved request, not assigned capacity.
- The first release is Berlin-only. Show the concrete deadline in `Europe/Berlin` while consuming the server-provided instant; do not compute authority from the browser clock.
- DEV0185 later adds the isolated request conversation to the same detail; this ticket owns status and withdrawal only.

## Implementation plan

1. Review delivered public/request contracts and relevant bundled Next.js documentation.
2. Replace coach-profile booking actions with approval requests and add notice/cutoff presentation.
3. Add request success, existing-request and withdrawal states.
4. Add the My sessions Requests group and status-to-confirmed transition presentation.
5. Add privacy, accessibility, responsive and two-account browser validation.

## Acceptance criteria

- [ ] AC1: Every eligible occurrence exposes an accurate Request action, no instant Book action remains, and notice-ineligible actions explain their cutoff.
- [ ] AC2: Request creation persists across reload and uses the approved pending copy without confirmed/reserved or other-candidate language.
- [ ] AC3: Clients can see and withdraw only their own pending requests, can retry any terminal unsuccessful attempt while still eligible, and see all outcomes truthfully without assigned capacity.
- [ ] AC4: Accepted requests become one confirmed upcoming booking, while stale/racing/unavailable results never show false success.
- [ ] AC5: Serialized projections, DOM assertions and responsive two-account tests contain no other-candidate identity/count/status data.

## Validation plan

- Add focused component/unit tests for action mode, cutoff copy, request statuses, withdrawal and result handling.
- Add Playwright coverage at desktop/mobile widths for request/reload, withdrawal and retry, decline and retry, coach closure, acceptance transition and terminal outcomes.
- Inspect client network/action responses and DOM for prohibited candidate data and language.
- Run configured test, lint, type-check, format and production-build commands.

## Implementation record

Pending implementation.

### Changes and rationale

Pending implementation.

### Affected files

| File or component | Change and purpose |
| ----------------- | ------------------ |
| Pending           | Pending.           |

### Decisions and deviations

- 2026-10-11: Removed the instant-booking branch, added repeat requests after terminal unsuccessful attempts and adopted Berlin deadline presentation from server-provided instants.

### Contracts, configuration, and operations

This ticket consumes DEV0187/DEV0188 interfaces and adds no migration, environment variable or external dependency.

## Validation results

Pending validation.

- Date and environment: Not run.
- Exact commands and outcomes: Not run.
- Manual steps and observed outcomes: Not run.
- Failed, blocked, or not-run checks: All checks await backend dependencies and implementation.

| Criterion | Evidence | Result  |
| --------- | -------- | ------- |
| AC1       | Pending  | Not run |
| AC2       | Pending  | Not run |
| AC3       | Pending  | Not run |
| AC4       | Pending  | Not run |
| AC5       | Pending  | Not run |

## Risks, limitations, and follow-ups

- Request persistence and booking confirmation must use visibly different success language.
- Without notifications, the client learns decisions when revisiting the app; do not promise email or push alerts.
- Calendar export of tentative or confirmed sessions remains separate future work.

## Completion and review references

- Completed: Not completed.
- Commit: Planning record included in this commit — `[DEV0182][DEV0183][DEV0184][DEV0185][DEV0186][DEV0187][DEV0188][DEV0189][DEV0190] Plan session collaboration and booking requests`; implementation not started.
- Review: No review created.
- Deployment or release: Not deployed or released.
