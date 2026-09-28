# Ticket DEV0090: Allow class re-reservation after cancellation

- Status: Completed
- Created: 2026-09-28
- Last updated: 2026-09-28
- Milestone: M3 reservations and check-ins
- Coordination: None — independent development ticket
- Related records: changes one completed behavior from [DEV0086 — Persist included class reservations](../../archive/backend/DEV0086-persist-included-class-reservations.md) and [DEV0087 — Add the member class reservation interface](../../archive/frontend/DEV0087-member-class-reservation-interface.md); follows the completed integration boundary in [COR0008 — Membership reservations and check-ins](../../archive/organisatory/COR0008-membership-reservations-and-checkins.md)

## Objective and context

A member can currently cancel a future class, but the latest cancelled reservation keeps that class in a disabled `member-cancelled` presentation and the database returns `state-conflict` for every fresh reservation operation on the same session. The user requested a less restrictive hackathon policy: after a member cancellation, the same active member may reserve the same future class again if it is still otherwise eligible.

This ticket changes the cancellation/retry behavior in [the membership reservation contract](../../../docs/mvp-spec.md#8-reservations-and-member-priced-visits) without reopening the completed DEV0086 or DEV0087 historical records.

## Scope and non-goals

- In scope: preserve each cancelled reservation and released daily-access claim as immutable history; allow a fresh operation to create a new active reservation/claim for the same future scheduled class; return the class to the ordinary available/full/conflict/allowance presentation after member cancellation; clear the browser's old operation identifier after successful cancellation; migration, database/unit/browser-rehearsal coverage and specification/index updates.
- Out of scope: reviving or mutating a cancelled row; rebooking a gym-cancelled, started, ended, checked-in or no-show class; cancellation penalties, cut-off changes, waitlists, capacity changes, notifications, staff UI or production policy.

## Expected behavior and edge cases

After cancelling before class start, the member sees the class evaluated normally again. If a seat and included daily access remain available, pressing reserve uses a new operation ID and inserts a new `reserved` row with a new held claim. The prior reservation remains `cancelled` with its member reason and its prior claim remains `released`.

The same operation ID remains idempotent and never creates a second reservation. Concurrent fresh attempts for the same member/session still produce at most one active reservation because the existing partial uniqueness and member advisory lock remain authoritative. A class that filled after cancellation returns `full`; a conflicting same-day visit, exhausted Basic allowance, inactive membership, non-core class, cancelled session or class that already started remains unavailable under the existing rules. Cancelling and rebooking do not create attendance or confirmed usage.

## Assumptions, decisions, and dependencies

- A rebooking is a new reservation, not a state reversal. This preserves the immutable reservation identity and terminal-state guards delivered by DEV0086.
- Only `cancelled` with member reason becomes rebookable indirectly through the still-scheduled future session. A session cancellation remains unavailable because the session itself is not scheduled.
- Existing capacity, one-active-member/session, one-included-visit-per-local-day and Basic allowance constraints require no relaxation.
- A follow-up migration replaces the two database functions used to project and create reservations; previously applied migrations remain untouched.

## Implementation plan

1. Update the current product specification to distinguish terminal reservation history from eligibility for a new reservation.
2. Add a forward migration that ignores terminal reservations when projecting/creating a new active reservation, while preserving same-operation idempotency and all existing locks/constraints.
3. Clear the client operation ID after successful cancellation and present the refreshed class as eligible under the server projection.
4. Extend database and browser-rehearsal coverage through cancel → rebook → reload, including distinct reservation/claim history and unchanged concurrency/eligibility behavior.
5. Run clean migration replay, database/unit/static/build checks and the real local Auth/database/Chrome rehearsal.

## Acceptance criteria

- [x] AC1: Cancelling a future class releases its seat and daily-access claim, and the member can reserve the same class again with a fresh operation while both historical records remain intact.
- [x] AC2: Rebooking creates at most one active reservation and one held claim under retries/concurrency; the original operation remains idempotent and cannot silently create a replacement.
- [x] AC3: Rebooking still enforces active membership, selected gym, future scheduled session, capacity, daily conflict and Basic allowance rules; session-cancelled, started, checked-in and no-show cases do not reopen.
- [x] AC4: After cancellation the UI refreshes to the server-derived eligible or blocked state, uses a new operation ID, and can complete reserve/reload/cancel behavior accessibly without implying attendance.
- [x] AC5: The specification, migration/setup contract, tests and durable ticket record explain the revised behavior without rewriting archived DEV0086/DEV0087 history.
- [x] AC6: Focused database/browser tests, full unit/database checks, lint, typecheck, formatting, production build and `git diff --check` pass.

## Validation plan

Extend the database reservation integration test to reserve, cancel and reserve the same session with a fresh operation. Assert distinct reservation and claim IDs, one cancelled plus one active row, released plus held claims, unchanged availability counts, same-operation idempotency and no confirmed usage. Preserve the existing concurrency and terminal-state tests.

Extend the disposable Chrome rehearsal so the cancelled card becomes reservable again, the second reservation has a different ID, reload recovers it, and final cancellation cleans the hold. Run a clean local database reset/migration replay, `npm test`, `npm run test:db`, lint, typecheck, formatting, production build and `git diff --check`.

## Implementation record

Implementation completed as one backend-primary vertical slice. A member cancellation remains a terminal historical reservation with a released claim; only the eligibility to create a new reservation for the same still-scheduled future class changed.

### Changes and rationale

- Replaced the member schedule projection in a forward migration so only active `reserved`, `checked_in` and `no_show` reservations control the current class state. A member-cancelled historical row no longer forces the disabled `member-cancelled` presentation; the session is evaluated again against capacity, daily access and allowance rules.
- Replaced reservation creation in the same migration so a fresh operation ignores terminal cancelled/no-show history when checking for a same-session conflict. The original operation remains idempotent, while advisory locks and the partial unique index still converge concurrent fresh attempts on one active row and one held claim.
- Removed the completed operation ID from the browser map after cancellation. The next click therefore submits a fresh operation instead of retrying the operation that owns the cancelled row. The confirmation copy now explains that the class may be reserved again while available.
- Added a stable, non-secret class-session identifier to each schedule card so the browser rehearsal can follow the exact session across state changes and reloads rather than relying on non-unique recurring class names.
- Extended database and real-browser coverage through reserve, cancel, concurrent rebook, reload, second cancellation and accessible keyboard rebooking. Tests verify distinct immutable rows/claims and preservation of the original operation's idempotent result.
- Updated the current product contract to distinguish terminal cancellation history from the member's eligibility to create a new reservation.

### Affected files

| File or component                                                                                                           | Change and purpose                                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`20260928000400_allow_class_rereservation.sql`](../../../supabase/migrations/20260928000400_allow_class_rereservation.sql) | Replaces the current-schedule and reservation functions so terminal member cancellations do not block a fresh eligible reservation.                           |
| [`class-schedule.tsx`](../../../src/features/membership/class-schedule.tsx)                                                 | Clears the old operation identifier after cancellation, presents the rebooking notice and identifies the exact session card for durable browser verification. |
| [`class-reservations.test.ts`](../../../tests/database/class-reservations.test.ts)                                          | Proves history preservation, old-operation idempotency and one replacement under concurrent fresh operations.                                                 |
| [`rehearse-local-class-reservations.mjs`](../../../scripts/rehearse-local-class-reservations.mjs)                           | Rehearses cancel/rebook/reload/cancel and mobile keyboard rebooking against local Auth and PostgreSQL.                                                        |
| [`mvp-spec.md`](../../../docs/mvp-spec.md) and [`tickets/README.md`](../../README.md)                                       | Records the adopted cancellation/rebooking contract and work-record lifecycle.                                                                                |

### Decisions and deviations

- 2026-09-28: The user requested immediate re-registration after a member cancellation for the hackathon. Adopt a new reservation/claim rather than reviving the terminal row so the existing audit and transition invariants remain intact.
- 2026-09-28: Keep session cancellation, check-in and no-show terminal. This change applies only when the member cancelled and the underlying session is still scheduled in the future.
- 2026-09-28: Do not reset the populated local browser-test database merely to obtain a clean replay. Apply the forward migration in place, run its relevant pgTAP files and the complete driver suite, and preserve the user's local rehearsal data.

### Contracts, configuration, and operations

A forward database migration is required in every environment before the UI can expose the revised state. It replaces two `app` functions without changing table shapes, API response fields, dependencies, secrets or environment variables. The migration was applied to the existing local Supabase database; it has not been applied to staging or production.

## Validation results

| Criterion | Evidence                                                                                                                                                                                                                               | Result |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1–AC3   | `npx supabase migration up --local` applied the forward migration without resetting data. `npm run test:db` passed 35/35, including concurrent same-class rebooking, immutable history and all prior eligibility/terminal-state cases. | Passed |
| AC1–AC3   | `npx supabase test db --local supabase/tests/database/class-reservations.test.sql supabase/tests/database/membership-checkins.test.sql` passed 22 relevant pgTAP assertions.                                                           | Passed |
| AC4       | `npm run test:checkins` passed against real local Supabase Auth/PostgreSQL and Chrome: reserve → reload → cancel → rebook with a distinct ID → reload → cancel → reload → keyboard rebook at mobile width.                             | Passed |
| AC4–AC5   | `npm test` passed 92/92 bounded client/domain/architecture tests; the specification and ticket/index consistency were reviewed after implementation.                                                                                   | Passed |
| AC6       | `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build` and `git diff --check` passed. The production build generated all application and API routes successfully.                                                | Passed |

The all-files `npm run db:test` pgTAP invocation reported 167 passing assertions and one unrelated catalogue-foundation assertion because the intentionally preserved local database already contains browser-test membership ownership. The two pgTAP files relevant to this change passed in isolation, and the complete 35-test driver suite passed against that same migrated database. A destructive clean reset was not performed.

## Risks, limitations, and follow-ups

Repeated member cancellations remain free for the hackathon; production cancellation cut-offs, penalties or abuse controls are deliberately unresolved. Historical cancellation rows will accumulate by design and may later need a bounded member-history view. The migration remains pending outside the local environment.

## Completion and review references

- Completed: 2026-09-28.
- Commit: Implemented in `b65ae5a` together with the overlapping DEV0085 member check-in interface.
- Review: Scope and changed-file self-review completed; no independent review.
- Deployment or release: Local migration and rehearsal only; no staging or production release.
