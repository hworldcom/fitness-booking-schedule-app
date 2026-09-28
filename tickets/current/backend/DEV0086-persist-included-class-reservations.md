# Ticket DEV0086: Persist included class reservations

- Status: Ready
- Created: 2026-09-27
- Last updated: 2026-09-28
- Milestone: M3 check-ins, member-price access and allocation
- Coordination: [COR0008 — Membership reservations and check-ins](../organisatory/COR0008-membership-reservations-and-checkins.md)
- Related records: builds on active periods from [DEV0080 — Persist membership activation foundation](../../archive/backend/DEV0080-membership-activation-foundation.md) and the fictional schedule delivered by completed [DEV0088 — Seed fictional demo class schedules](../../archive/backend/DEV0088-seed-fictional-demo-class-schedules.md), supplies upcoming reservations to [DEV0087 — Add the member class reservation interface](../frontend/DEV0087-member-class-reservation-interface.md), and defines the shared daily-access claim consumed by [DEV0084 — Persist included membership check-ins](DEV0084-persist-included-membership-checkins.md); cancelled [DEV0018](../../archive/backend/DEV0018-class-pass-reservations-and-confirmed-visits.md) is historical class-pass context only

## Objective and context

Allow an active Basic or Classic member to reserve an eligible scheduled class in advance at one of the four gyms frozen into the membership period. Reservation must atomically hold one seat and, for Basic, one still-available included use without claiming attendance or decrementing confirmed usage. Cancellation and no-show release that hold under the bounded hackathon policy.

This ticket owns the backend reservation part of [the reservation contract](../../../docs/mvp-spec.md#8-reservations-and-member-priced-visits), M3 and acceptance scenarios A05–A10/A24–A25. DEV0084 separately proves physical presence and converts a valid reservation into confirmed attendance.

## Scope and non-goals

- In scope: member-scoped class-session reads for the four selected gyms; stable idempotent reservation operations; future scheduled-session, period, selected-gym and immutable service-date validation; atomic capacity; one active reservation per member/session; a shared daily-access claim with `held`, `consumed` and `released` states; Basic allowance holds; Classic daily conflict without a numerical hold balance; reservation states `reserved`, `cancelled`, `checked_in` and `no_show`; member-versus-session cancellation reason; pre-start cancellation; deterministic end-of-session no-show reconciliation; private upcoming/history reads; routes, migrations and concurrency tests.
- Out of scope: physical attendance confirmation; arrival QR/code; staff interface; public class marketplace; non-core paid visits; cancellation fees or allowance penalties; waitlists; recurring schedules; monetary allocation; social publication; notification delivery; and production refund/no-show economics.

## Expected behavior and edge cases

The server derives the current actor and active membership. A member may reserve only before a scheduled class starts, when its venue is one of that period's four selected gyms and the entire session falls within the active period. At reservation time, the venue timezone and class start determine an immutable service date stored with the reservation and daily-access claim. Membership access applies to scheduled classes at a selected participating gym; this MVP does not reintroduce a separate `membership_eligible` flag.

Reservation atomically takes one available seat and creates one `held` daily-access claim. A database-enforced partial uniqueness rule permits at most one `held` or `consumed` claim for the membership/service date across all four selected gyms, while historical `released` claims do not block a later same-day reservation. Basic additionally counts every held claim against the ten-use availability check, so `confirmed check-ins + held claims` cannot exceed ten. Classic has no monthly numerical hold but uses the same daily claim. Repeating the same operation returns the existing reservation. Concurrent final-seat, final-Basic-use and same-day reservation/open-gym attempts produce at most one success.

A member may cancel before the class starts. Cancellation sets the reservation to `cancelled` with reason `member`, releases the seat and daily-access claim, and creates no attendance. If the underlying class is cancelled, reconciliation produces the same terminal status with reason `session`. A reservation still unconfirmed when the class ends becomes `no_show` and releases its claim without attendance, allocation input, fee or allowance penalty. `checked_in` is terminal and may be set only through DEV0084's authorized attendance boundary, which atomically changes the claim from `held` to `consumed`. Cancelled and no-show reservations cannot later check in. `expired` belongs to DEV0084's arrival request and is not a reservation status.

## Assumptions, decisions, and dependencies

- The existing persistent `class_sessions` relation remains an internal schedule source even though the old public Classes product was removed.
- All scheduled classes at a selected participating core gym are included under the current membership contract. A future class-specific exclusion requires a separate product decision.
- Reservation eligibility uses the snapshotted membership-period terms, not a later catalogue version.
- One included reservation/check-in per membership per service date applies across all four selected gyms, not once per gym.
- The shared daily-access claim is the database serialization boundary for class reservations and open-gym arrival. DEV0086 creates the general claim contract and reservation-backed claims; DEV0084 later creates open-gym claims and performs the only `held -> consumed` transition.
- The planned `membership_daily_access_claims` relation has an immutable membership period and service date, a monotonic `held -> consumed|released` state, and a partial unique constraint on `(run_id, membership_period_id, service_date)` for `held`/`consumed` rows. The reservation references its claim; DEV0084's arrival record will use the same contract.
- The initial cancellation policy has no cutoff fee or consumed allowance. This is a hackathon simplification, not a production promise.
- No background worker is required: bounded reconciliation may occur when reservation state is read or mutated, provided concurrent callers converge on one result.
- Completed DEV0088 supplies 42 user-requested fictional sessions, active trainer affiliations and the fixed 2026-09-28 hackathon anchor. The reservation implementation may rely on those stable fixture identities and dates.

## Implementation plan

1. Define reservation operations, the four-state reservation lifecycle and the shared daily-access claim against membership periods, selected gyms and DEV0088's stable class sessions.
2. Add additive schema/Drizzle mappings and atomic database functions for create/resume, member/session cancel and end-of-session no-show reconciliation with capacity, daily-claim and allowance serialization.
3. Add actor-scoped scheduled-class and reservation repositories/services/routes that accept only bounded class/operation identifiers.
4. Expose private upcoming/history projections including class, gym, local time, reservation status, cancellation reason and whether one Basic use is held.
5. Add migration, database, domain, authorization and concurrency coverage; replay migrations/seed cleanly and run static/build validation.

## Acceptance criteria

- [ ] AC1: An active member can reserve only a future scheduled class at a gym frozen into that membership period and only when the full session lies within the period.
- [ ] AC2: Reservation holds one seat atomically; duplicate/member-session and concurrent final-seat attempts cannot overbook.
- [ ] AC3: Basic confirmed usage plus `held` daily-access claims never exceeds ten; concurrent final-use reservations produce at most one success.
- [ ] AC4: A partial uniqueness constraint permits at most one `held` or `consumed` daily-access claim across the membership on one immutable venue-local service date; a `released` claim permits another same-day attempt and Classic has no fabricated monthly allowance.
- [ ] AC5: Retrying one operation returns the same reservation without an additional seat or daily-access claim.
- [ ] AC6: Member or session cancellation before start records the correct reason, while an unconfirmed reservation becomes `no_show` after class end; each releases the seat/claim and creates no attendance, fee, allocation input or allowance loss.
- [ ] AC7: Only DEV0084's authorized boundary can atomically transition the reservation `reserved -> checked_in` and its claim `held -> consumed`; terminal reservations and released claims cannot be revived or reassigned.
- [ ] AC8: Member reads expose only the actor's eligible classes/reservations and no other member's private state.
- [ ] AC9: Forward/clean migration replay, authorization/concurrency/database tests, unit tests, lint, typecheck, formatting, database lint and production build pass.

## Validation plan

Use Basic periods with zero, one and ten confirmed/held uses plus Classic periods around venue-local midnight. Exercise foreign/non-core venues, past and out-of-period sessions, member and session cancellation, duplicate operations, same-day classes at different selected gyms, cancellation boundaries, post-end no-show reconciliation and concurrent final seat/use/daily claims. Assert rejected attempts leave capacity, claims and history unchanged, and prove a released claim permits a replacement same-day reservation.

Run forward migration, clean migration/seed replay, pgTAP or equivalent constraints, focused database integration tests, the full unit suite, lint, typecheck, formatting, database lint, production build and `git diff --check`. Browser evidence belongs to DEV0087.

## Implementation record

Pending implementation.

### Changes and rationale

No implementation changes yet.

### Affected files

| File or component                                 | Change and purpose                                                         |
| ------------------------------------------------- | -------------------------------------------------------------------------- |
| Pending reservation migration/domain/server files | Add the reviewed class reservation and shared daily-access-claim boundary. |

### Decisions and deviations

- 2026-09-27: Created as a fresh peer after the committed DEV0084 plan was split. Reservation owns capacity and entitlement holds; it does not own attendance.
- 2026-09-27: Treat all scheduled classes at selected participating gyms as included instead of restoring the deleted class-level membership flag.
- 2026-09-28: Remove `expired` from the reservation lifecycle. Keep `reserved`, `cancelled`, `checked_in` and `no_show`; record member/session cancellation reason and reconcile no-show only after class end.
- 2026-09-28: Adopt a shared daily-access claim with `held`, `consumed` and `released` states as the atomic boundary between reservation and DEV0084 attendance. Held claims count against Basic availability but do not count as confirmed usage.
- 2026-09-28: Move the ticket back to Draft until the user supplies the intended class/trainer fixture data and its reservable date strategy is recorded.
- 2026-09-28: The user supplied public schedule references; DEV0088 now owns transforming them into original fixtures with a fixed current anchor. DEV0086 remains Draft until that prerequisite completes.
- 2026-09-28: DEV0088 completed 42 original fictional sessions across all seven gyms and validated the fixed schedule window. DEV0086 is now Ready.

### Contracts, configuration, and operations

An additive reservation relation, `membership_daily_access_claims` relation and private HTTP contract are planned. The claim's active-state partial uniqueness is shared with DEV0084. No new secret, wallet key, payment or public catalogue mutation is required. Exact migration and rollback details will be recorded during implementation.

## Validation results

Pending validation.

| Criterion | Evidence            | Result  |
| --------- | ------------------- | ------- |
| AC1–AC9   | Not yet implemented | Not run |

## Risks, limitations, and follow-ups

The no-penalty cancellation/no-show policy is intentionally simplified. It can encourage unused reservations and must be revisited before production. DEV0084 must consume or release the shared claim through the delivered atomic transition rather than duplicating daily or allowance logic. DEV0088's fixed hackathon schedule is a prerequisite, not a recurring production schedule.

## Completion and review references

- Completed: Not completed.
- Commit: Initial split planning record created in `25d4842`; the lifecycle/daily-claim revision is not yet committed.
- Review: Planning self-review completed; no independent review.
- Deployment or release: None.
