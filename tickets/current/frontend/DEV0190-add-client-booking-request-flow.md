# Ticket DEV0190: Add the client booking-request flow

- Status: Draft
- Created: 2026-10-10
- Last updated: 2026-10-10
- Milestone: Scheduling-only booking-policy follow-up
- Coordination: [COR0016 — Coach-confirmed booking requests](../organisatory/COR0016-coach-confirmed-booking-requests.md)
- Related records: policy dependency [DEV0187 — Persist coach booking policies](../backend/DEV0187-persist-coach-booking-policies.md), request dependency [DEV0188 — Persist multi-candidate booking requests](../backend/DEV0188-persist-multi-candidate-booking-requests.md), conversation interface [DEV0185 — Add client session collaboration](DEV0185-add-client-session-collaboration.md), client-history baseline [DEV0144 — Show client booking history](../../archive/frontend/DEV0144-show-client-booking-history.md)

## Objective and context

Give clients a policy-aware scheduling flow that distinguishes immediate booking from a saved coach-approval request. A client must feel that their action persisted while remaining clearly aware that a pending request is not a confirmed reservation.

## Scope and non-goals

- In scope:
  - Present `Book session` for eligible instant occurrences and `Request session` for eligible approval occurrences.
  - Present notice/cutoff ineligibility without relying on the browser for authority.
  - Add a My sessions Requests group with pending, accepted/confirmed, declined, not-selected, withdrawn and expired outcomes.
  - Use the approved `Request saved` / `Awaiting coach confirmation` / `This session is not confirmed yet` / decision-deadline language.
  - Let the requesting client withdraw a pending request and recover from stale/unavailable results.
  - Ensure no candidate count, identity, status or competition-oriented copy reaches the client.
- Out of scope:
  - Shared request conversation UI owned by DEV0185.
  - Coach policy/selection UI owned by DEV0189.
  - Calendar invitations, notifications, candidate ranking, waitlists or attendance confirmation.

## Expected behavior and edge cases

- An instant occurrence preserves the current booking flow and success language.
- An approval occurrence creates one persisted pending request and never shows confirmed-booking language until accepted.
- The same signed-in client reopening that occurrence sees `Requested` and can open or withdraw the existing request rather than create a duplicate.
- The saved confirmation names the exact time/location, says the session is not confirmed and shows the decision deadline. It does not mention other requests.
- Notice-ineligible occurrences remain truthful with a disabled action and specific timing explanation where the public projection supplies one.
- Accepted requests move into the confirmed Upcoming schedule; terminal unsuccessful requests remain bounded history and consume no session capacity.
- Database/auth failure shows no optimistic request or booking that PostgreSQL did not persist.

## Assumptions, decisions, and dependencies

- DEV0187 and DEV0188 must complete before this ticket becomes Ready.
- Reuse My sessions with a distinct Requests group rather than create a global inbox.
- The phrase `reserved` is avoided for pending state. The completed action is a saved request, not assigned capacity.
- DEV0185 later adds the isolated request conversation to the same detail; this ticket owns status and withdrawal only.

## Implementation plan

1. Review delivered public/request contracts and relevant bundled Next.js documentation.
2. Make coach-profile actions policy-aware and add notice/cutoff presentation.
3. Add request success, existing-request and withdrawal states.
4. Add the My sessions Requests group and status-to-confirmed transition presentation.
5. Add privacy, accessibility, responsive and two-account browser validation.

## Acceptance criteria

- [ ] AC1: Eligible instant and approval occurrences expose accurate Book/Request actions while notice-ineligible actions explain their cutoff.
- [ ] AC2: Request creation persists across reload and uses the approved pending copy without confirmed/reserved or other-candidate language.
- [ ] AC3: Clients can see and withdraw only their own pending requests; all terminal outcomes remain truthful and capacity-free.
- [ ] AC4: Accepted requests become one confirmed upcoming booking, while stale/racing/unavailable results never show false success.
- [ ] AC5: Serialized projections, DOM assertions and responsive two-account tests contain no other-candidate identity/count/status data.

## Validation plan

- Add focused component/unit tests for action mode, cutoff copy, request statuses, withdrawal and result handling.
- Add Playwright coverage at desktop/mobile widths for instant booking, approval request/reload, withdrawal, acceptance transition and terminal outcomes.
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

No implementation decisions or deviations recorded yet.

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
