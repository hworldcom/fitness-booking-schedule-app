# Coordination COR0016: Coach-confirmed booking requests

- Status: Ready
- Created: 2026-10-10
- Last updated: 2026-10-10
- Milestone: Scheduling-only booking-policy follow-up
- Converted from: Not applicable — created as a coordination record
- Tracked development tickets: ready [DEV0186 — Adopt booking-request and notice policies](DEV0186-adopt-booking-request-and-notice-policies.md); draft [DEV0187 — Persist coach booking policies](../backend/DEV0187-persist-coach-booking-policies.md), [DEV0188 — Persist multi-candidate booking requests](../backend/DEV0188-persist-multi-candidate-booking-requests.md), [DEV0189 — Add coach booking-request controls](../frontend/DEV0189-add-coach-booking-request-controls.md) and [DEV0190 — Add the client booking-request flow](../frontend/DEV0190-add-client-booking-request-flow.md)
- Related records: direct-booking baseline [DEV0141 — Persist direct private bookings](../../archive/backend/DEV0141-persist-direct-private-bookings.md), availability baseline [DEV0177 — Bind availability to training locations](../../archive/backend/DEV0177-bind-availability-to-training-locations.md), request-conversation integration [COR0015 — Session notes and training plans](COR0015-session-notes-and-training-plans.md)

## Objective and boundaries

Coordinate coach-selectable booking behavior. A coach may retain instant booking or require approval; approval mode lets multiple signed-in clients submit independent requests for the same open occurrence without reserving it for any one candidate. The coach accepts at most one request, creating the capacity-one confirmed booking atomically and closing all other pending requests. Coaches also choose how far before training clients must book or request.

The client experience must confirm that the request was saved while clearly labelling it `Awaiting coach confirmation`. It must not mention, count or identify other requests. The first delivery keeps the current seven-day occurrence horizon as the maximum advance window and does not add payments, waitlists, ranking, automated candidate selection, attendance reconfirmation, notification delivery or general messaging.

COR0015 separately owns shared request/session conversation content. This record owns booking policy, eligibility, request lifecycle, selection and status interfaces; it does not implement runtime behavior.

## Direct development work

| Implementation part | Development ticket                                                                                                   | Owned deliverable                                                                                                                                                        | Start condition or dependency     |
| ------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| Product contract    | [DEV0186 — Adopt booking-request and notice policies](DEV0186-adopt-booking-request-and-notice-policies.md)          | Define coach modes, minimum notice, multi-candidate semantics, deadlines, lifecycle, client copy, privacy and acceptance behavior.                                       | Ready; first delivery step.       |
| Policy persistence  | [DEV0187 — Persist coach booking policies](../backend/DEV0187-persist-coach-booking-policies.md)                     | Add versioned coach policy storage, current-behavior backfill, public eligibility projection and atomic enforcement for instant bookings and requests.                   | Starts after DEV0186 completes.   |
| Request persistence | [DEV0188 — Persist multi-candidate booking requests](../backend/DEV0188-persist-multi-candidate-booking-requests.md) | Add independent per-client requests, bounded pending capacity, deadlines, accept/decline/withdraw/expiry transitions and atomic winner selection.                        | Starts after DEV0186 and DEV0187. |
| Coach interface     | [DEV0189 — Add coach booking-request controls](../frontend/DEV0189-add-coach-booking-request-controls.md)            | Add booking-policy settings and a private pending-request queue with accept/decline decisions, deadlines and responsive failure states.                                  | Starts after DEV0187 and DEV0188. |
| Client interface    | [DEV0190 — Add the client booking-request flow](../frontend/DEV0190-add-client-booking-request-flow.md)              | Add policy-aware Book/Request actions, saved pending status, withdrawal, decision history and truthful notice/cutoff presentation without candidate information leakage. | Starts after DEV0187 and DEV0188. |

All required confirmation/policy implementation parts have direct development tickets. COR0015's DEV0183-DEV0185 remain peer work under their own coordination and own request/session conversation content rather than duplicating that implementation here.

## Other relationships

- DEV0141 supplies the current capacity-one confirmed booking and terminal lifecycle. Approval mode creates that same booking only after coach acceptance; it does not redefine capacity.
- DEV0177 supplies the one-hour location-aware occurrence and seven-day publication horizon. Minimum-notice eligibility is evaluated against the immutable occurrence start instant and does not move its venue or time.
- COR0015 consumes pending-request identity so each candidate can have an isolated conversation that continues only for the selected client's booking. Confirmation can operate without a general inbox, and conversation data does not influence database selection authority.

## Delivery sequence and completion conditions

1. Complete DEV0186 first to make policy defaults, request states, response-deadline behavior, selection privacy and terminology authoritative.
2. Complete DEV0187 to expose and enforce versioned coach policies while preserving instant/no-notice behavior for existing coaches.
3. Complete DEV0188 to add the concurrent request queue and atomic selection lifecycle.
4. DEV0189 and DEV0190 may proceed in parallel after the backend contracts exist; integrate with COR0015's conversation surfaces without taking ownership of their content model.
5. Complete this coordination only when all five direct tickets are Completed or explicitly cancelled/replaced; instant mode remains backward-compatible; approval mode accepts multiple isolated requests without holding the occurrence; exactly one request can become confirmed; other requests close atomically; notice/deadline limits are authoritative; and responsive two-account browser/database validation passes.

## Progress and integration record

- 2026-10-10: The user requested optional coach confirmation and a minimum amount of advance time before a client may book training.
- 2026-10-10: The user chose a multi-candidate model: pending requests do not hold the occurrence, the coach may review several clients and select one, and capacity is assigned only on acceptance.
- 2026-10-10: The user approved client copy that says `Request saved` and `Awaiting coach confirmation` with a decision deadline, while removing any reference to the coach reviewing other requests.
- 2026-10-10: Created the flat DEV0186-DEV0190 work map. DEV0186 is Ready; runtime peers remain Draft until the contract is complete.

## Validation results

- Planning validation completed on 2026-10-10: Prettier accepted the ticket index and all eleven current COR0015/COR0016 records; a targeted checker validated relative links in twelve affected files and reciprocal membership for all nine DEV records; repository search found one heading for each new ID; prohibited competition-oriented client copy was absent; `git diff --check` passed.
- Runtime validation is owned by DEV0187-DEV0190 and has not started.

## Risks, limitations, and follow-ups

- `Request saved` must never be paired with confirmed-booking language. Pending clients need certainty that their request persisted without a false promise that capacity is theirs.
- Accepting one request and closing the rest is one database transaction. Partial selection could double-book the occurrence or leave misleading pending states.
- Candidate names, messages and counts are private to the coach; clients see only their own request and no competition-oriented copy.
- Without notifications, coaches must actively check their request queue. Email/push delivery remains a separate follow-up rather than an implied part of this delivery.
- Attendance reconfirmation for an already confirmed session is a different lifecycle and remains out of scope.

## Completion and review references

- Completed: Not completed.
- Direct development tickets: DEV0186 Ready; DEV0187-DEV0190 Draft.
- Commit: Not applicable — coordination-record IDs are not used in commit subjects.
- Review: No integration review created.
- Deployment or release: Not deployed or released.
