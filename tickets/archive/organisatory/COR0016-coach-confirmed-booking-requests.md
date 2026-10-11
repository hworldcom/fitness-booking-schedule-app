# Coordination COR0016: Coach-confirmed booking requests

- Status: Completed
- Created: 2026-10-10
- Last updated: 2026-10-11
- Milestone: Scheduling-only booking-policy follow-up
- Converted from: Not applicable — created as a coordination record
- Tracked development tickets: completed [DEV0186 — Adopt booking-request and notice policies](../organisatory/DEV0186-adopt-booking-request-and-notice-policies.md), [DEV0187 — Enforce booking-request eligibility](../backend/DEV0187-enforce-booking-request-eligibility.md), [DEV0188 — Persist multi-candidate booking requests](../backend/DEV0188-persist-multi-candidate-booking-requests.md), [DEV0189 — Add the coach booking-request queue](../frontend/DEV0189-add-coach-booking-request-queue.md) and [DEV0190 — Add the client booking-request flow](../frontend/DEV0190-add-client-booking-request-flow.md)
- Related records: direct-booking baseline [DEV0141 — Persist direct private bookings](../backend/DEV0141-persist-direct-private-bookings.md), availability baseline [DEV0177 — Bind availability to training locations](../backend/DEV0177-bind-availability-to-training-locations.md), request-conversation integration [COR0015 — Session notes and training plans](../../current/organisatory/COR0015-session-notes-and-training-plans.md)

## Objective and boundaries

Coordinate an approval-only booking flow. Every eligible client submits an independent request for an open future occurrence without reserving it for any one candidate. The coach accepts at most one request, creating the capacity-one confirmed booking atomically and closing all other pending requests. For the first release, there is no minimum-notice interval: requests remain open until training starts. The decision deadline is the earlier of 12 hours after submission or the occurrence start, and these rules are global rather than coach-configurable.

The client experience must confirm that the request was saved while clearly labelling it `Awaiting coach confirmation`. It must not mention, count or identify other requests. The first delivery keeps the current seven-day occurrence horizon as the maximum advance window, imposes no pending-request count limit and supports in-app status only. It does not add payments, waitlists, ranking, automated candidate selection, attendance reconfirmation, email/push notification delivery, general messaging or coach-configurable timing.

COR0015 separately owns shared request/session conversation content. This record owns booking policy, eligibility, request lifecycle, selection and status interfaces; it does not implement runtime behavior.

## Direct development work

| Implementation part | Development ticket                                                                                                          | Owned deliverable                                                                                                                                                            | Start condition or dependency |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Product contract    | [DEV0186 — Adopt booking-request and notice policies](../organisatory/DEV0186-adopt-booking-request-and-notice-policies.md) | Define approval-only request semantics, lifecycle, repeat requests, client copy, privacy and acceptance/closure behavior; DEV0187 records the later timing correction.       | Completed 2026-10-11.         |
| Request eligibility | [DEV0187 — Enforce booking-request eligibility](../backend/DEV0187-enforce-booking-request-eligibility.md)                  | Replace immediate booking eligibility with server-derived future-start boundaries and truthful public projections while keeping the seven-day horizon.                       | Completed 2026-10-11.         |
| Request persistence | [DEV0188 — Persist multi-candidate booking requests](../backend/DEV0188-persist-multi-candidate-booking-requests.md)        | Add independent per-client requests without a candidate cap, start-capped 12-hour deadlines, repeat attempts after terminal outcomes and atomic acceptance/closure.          | Completed 2026-10-11.         |
| Coach interface     | [DEV0189 — Add the coach booking-request queue](../frontend/DEV0189-add-coach-booking-request-queue.md)                     | Add a private paginated pending-request queue with accept/decline and close-occurrence actions, deadlines and responsive failure states.                                     | Completed 2026-10-11.         |
| Client interface    | [DEV0190 — Add the client booking-request flow](../frontend/DEV0190-add-client-booking-request-flow.md)                     | Replace direct Book actions with Request actions, saved pending status, withdrawal/retry, decision history and truthful availability presentation without candidate leakage. | Completed 2026-10-11.         |

All required confirmation/policy implementation parts have direct development tickets. COR0015's DEV0183-DEV0185 remain peer work under their own coordination and own request/session conversation content rather than duplicating that implementation here.

## Other relationships

- DEV0141 supplies the current capacity-one confirmed booking and terminal lifecycle. Coach acceptance creates that same booking; the new request lifecycle does not redefine capacity.
- DEV0177 supplies the one-hour location-aware occurrence and seven-day publication horizon. Request eligibility is evaluated against the immutable occurrence start instant and does not move its venue or time.
- COR0015 consumes pending-request identity so each candidate can have an isolated conversation that continues only for the selected client's booking. Confirmation can operate without a general inbox, and conversation data does not influence database selection authority.

## Delivery sequence and completion conditions

1. DEV0186 completed the initial approval-request contract; DEV0187 records the later no-minimum-notice correction while preserving that archived history.
2. DEV0187 completed the approval-only future-start eligibility boundary and disabled direct booking.
3. DEV0188 completed the concurrent request persistence and atomic selection lifecycle.
4. DEV0189 completed the coach queue. DEV0190 completed the client request flow without taking ownership of COR0015's conversation content.
5. Complete this coordination only when all five direct tickets are Completed or explicitly cancelled/replaced; every booking begins as an approval request; multiple isolated requests can coexist without holding the occurrence; exactly one request can become confirmed; accepting one or closing the occurrence terminalizes all other pending requests atomically; future-start eligibility and the start-capped 12-hour decision deadline are authoritative; and responsive two-account browser/database validation passes.

## Progress and integration record

- 2026-10-10 (historical, superseded): The user initially requested optional coach confirmation and a minimum amount of advance time before a client may book training. The final approval-only rule has no minimum-notice interval.
- 2026-10-10: The user chose a multi-candidate model: pending requests do not hold the occurrence, the coach may review several clients and select one, and capacity is assigned only on acceptance.
- 2026-10-10: The user approved client copy that says `Request saved` and `Awaiting coach confirmation` with a decision deadline, while removing any reference to the coach reviewing other requests.
- 2026-10-10: Created the flat DEV0186-DEV0190 work map. DEV0186 is Ready; runtime peers remain Draft until the contract is complete.
- 2026-10-11 (historical, superseded later the same day): The user removed instant booking and coach-configurable policy from the first release. The initial timing choice closed requests 24 hours before training and expired each request 12 hours after submission.
- 2026-10-11: Before runtime delivery, the user removed the 24-hour minimum notice because coach approval already protects availability. Requests now remain eligible until occurrence start; a late request's deadline is capped at that start so no pending decision survives the session it targets.
- 2026-10-11: The user chose no pending-request cap, allowed a client to submit a new request after withdrawal, expiry or explicit coach decline while the occurrence remains eligible, and approved automatic closure of other pending requests when one is accepted.
- 2026-10-11: The user added a coach action to close one occurrence when no longer available. Closing marks that occurrence unavailable to new requests and atomically closes its pending requests; it does not silently edit the recurring availability rule.
- 2026-10-11: The first release serves Berlin only. Deadlines remain stored and compared as database instants and are presented in `Europe/Berlin`; broader timezone behavior remains a future concern rather than being discarded.
- 2026-10-11: DEV0186 completed and archived after making the approval-only lifecycle authoritative in the MVP specification and aligning the README product summary. DEV0187 is now Ready as the next runtime step.
- 2026-10-11: DEV0187 completed and archived after delivering database-time future-start eligibility, bounded public status and stale direct-call rejection. DEV0188 is Ready next.
- 2026-10-11: DEV0188 implementation started after confirming its completed eligibility and booking dependencies.
- 2026-10-11: DEV0188 completed with a private row-level-security request relation, actor-scoped mutations, bounded participant projections, read-time expiry reconciliation and atomic selection/closure. Multiple requests do not hold capacity, exactly one accepted request links to the confirmed booking, and millisecond-stable keyset pagination prevents burst-created candidates from being skipped. DEV0189 and DEV0190 are Ready.
- 2026-10-11: DEV0189 implementation started with an explicit coach-only read boundary, pending-first presentation, immutable recent request history and isolated authorized multi-client fixtures for browser validation.
- 2026-10-11: DEV0189 completed with a server-rendered coach-only first page, bounded reauthorized pagination, occurrence grouping, accept/decline/closure controls and immutable terminal history. An authenticated 24-client rehearsal passed desktop/mobile, keyboard, confirmed-booking continuity and cleanup checks. DEV0190 remains the only unfinished direct ticket.
- 2026-10-11: DEV0190 implementation started. Its client surfaces use client-only booking/request reads and add an exact actor-owned request projection so saved confirmation and recovered pending state never depend on browser time or first-page history position.
- 2026-10-11: DEV0190 completed with exact and bounded actor-owned request projections, live request/withdraw/retry controls, paginated neutral client history and accepted-to-Upcoming continuity. The authenticated Hoang/Daniel rehearsal covered decline/retry, acceptance, closure, expiry, privacy, keyboard and responsive behavior, completing every mapped COR0016 deliverable.

## Validation results

- Planning validation completed on 2026-10-10: Prettier accepted the ticket index and all eleven current COR0015/COR0016 records; a targeted checker validated relative links in twelve affected files and reciprocal membership for all nine DEV records; repository search found one heading for each new ID; prohibited competition-oriented client copy was absent; `git diff --check` passed.
- Planning amendment validation completed on 2026-10-11: Prettier accepted the eight affected index/work-record files; all relative Markdown links resolved; one heading exists for COR0016 and each of DEV0186-DEV0190; no reference to either superseded DEV0187/DEV0189 filename remains; and `git diff --check` passed. Application/database checks remain owned by the implementation tickets and were not run for this planning-only revision.
- DEV0186 contract validation completed on 2026-10-11 against the then-current 24-hour policy: Prettier and `git diff --check` passed; a targeted checker confirmed C19-C24, all six request transitions, cutoff/deadline, cancellation recovery, decision concurrency, prohibited-copy removal, links and archive/status consistency. No runtime validation was claimed. DEV0187 owns and validates the later no-minimum-notice correction.
- DEV0187 completed on 2026-10-11 after 107 application/server tests, 39 database tests, database lint, lint, type-check, formatting, production build and 14 focused desktop/mobile browser checks passed. Upgrade migration preserved local data; an isolated Supabase-shaped database then applied all 42 migrations and verified the new boundary before removal.
- DEV0188 completed on 2026-10-11 after 109 application/server tests, 46 database integration tests and 12 direct pgTAP assertions passed. Database lint, lint, type-check, formatting, production build and diff checks passed; upgrade validation preserved local data, and a disposable Supabase-shaped database applied all 43 migrations and verified grants, privacy, the exact accepted-booking link and cursor precision before removal. The Docker pgTAP wrapper stalled while inspecting its image, so the exact SQL suite was executed directly against the same local database.
- DEV0189 completed on 2026-10-11 after 113 application/server tests, 46 database integration tests, lint, type-check, formatting and the production build passed on Node 24.21.0. Its authenticated Chrome rehearsal paginated 24 temporary requests, exercised decline, acceptance, occurrence closure, terminal history, confirmed-booking continuity, keyboard and responsive layout, reported no page errors and removed all exact fixtures.
- DEV0190 completed on 2026-10-11 after 115 application/server tests, 47 database integration tests, database lint, lint, type-check, formatting, a production build and fresh-create migration rehearsal passed. Its two-context Chrome rehearsal exercised the entire client/coach lifecycle, verified client DOM/action-response candidate privacy, reported no page errors or horizontal mobile overflow and removed all exact fixtures.
- COR0016 integration is complete: every direct ticket is archived; PostgreSQL owns eligibility, deadlines, capacity and atomic request decisions; coach and client surfaces use separate bounded private reads; acceptance produced one confirmed Upcoming booking; and responsive two-account validation covered both participant roles.

## Risks, limitations, and follow-ups

- `Request saved` must never be paired with confirmed-booking language. Pending clients need certainty that their request persisted without a false promise that capacity is theirs.
- Accepting one request and closing the rest is one database transaction. Partial selection could double-book the occurrence or leave misleading pending states.
- Candidate names, messages and counts are private to the coach; clients see only their own request and no competition-oriented copy.
- Without notifications, coaches must actively check their request queue. Email/push delivery remains a separate follow-up rather than an implied part of this delivery.
- Unlimited pending requests are a product choice, not an instruction to return unbounded result sets; the coach queue must use bounded pagination.
- Approval-only delivery intentionally removes policy-switch races. Acceptance, decline, withdrawal, expiry and occurrence closure still need deterministic locks and idempotent outcomes.
- Attendance reconfirmation for an already confirmed session is a different lifecycle and remains out of scope.

## Completion and review references

- Completed: 2026-10-11.
- Direct development tickets: DEV0186-DEV0190 Completed.
- Commit: Not applicable — coordination-record IDs are not used in commit subjects.
- Review: No integration review created.
- Deployment or release: Not deployed or released.
