# Ticket DEV0086: Persist included class reservations

- Status: Ready
- Created: 2026-09-27
- Last updated: 2026-09-27
- Milestone: M3 check-ins, member-price access and allocation
- Coordination: [COR0008 — Membership reservations and check-ins](../organisatory/COR0008-membership-reservations-and-checkins.md)
- Related records: builds on active periods from [DEV0080 — Persist membership activation foundation](../../archive/backend/DEV0080-membership-activation-foundation.md), supplies upcoming reservations to [DEV0087 — Add the member class reservation interface](../frontend/DEV0087-member-class-reservation-interface.md), and defines the held-entitlement transition consumed by [DEV0084 — Persist included membership check-ins](DEV0084-persist-included-membership-checkins.md); cancelled [DEV0018](../../archive/backend/DEV0018-class-pass-reservations-and-confirmed-visits.md) is historical class-pass context only

## Objective and context

Allow an active Basic or Classic member to reserve an eligible scheduled class in advance at one of the four gyms frozen into the membership period. Reservation must atomically hold one seat and, for Basic, one still-available included use without claiming attendance or decrementing confirmed usage. Cancellation and no-show release that hold under the bounded hackathon policy.

This ticket owns the backend reservation part of [the reservation contract](../../../docs/mvp-spec.md#8-reservations-and-member-priced-visits), M3 and acceptance scenarios A05–A10/A24–A25. DEV0084 separately proves physical presence and converts a valid reservation into confirmed attendance.

## Scope and non-goals

- In scope: member-scoped class-session reads for the four selected gyms; stable idempotent reservation operations; scheduled-session, period, selected-gym and service-date validation; atomic capacity; one active reservation per member/session; one active included reservation per membership/service date; Basic allowance holds; Classic daily conflict without a numerical hold balance; `reserved`, `cancelled`, `checked_in`, `no_show` and `expired` lifecycle support; pre-start member cancellation; deterministic post-window no-show/expiry reconciliation; private upcoming/history reads; routes, migrations and concurrency tests.
- Out of scope: physical attendance confirmation; arrival QR/code; staff interface; public class marketplace; non-core paid visits; cancellation fees or allowance penalties; waitlists; recurring schedules; monetary allocation; social publication; notification delivery; and production refund/no-show economics.

## Expected behavior and edge cases

The server derives the current actor and active membership. A member may reserve a scheduled class only when its venue is one of that period's four selected gyms and the entire session falls within the active period. The venue timezone determines its service date. Membership access applies to scheduled classes at a selected participating gym; this MVP does not reintroduce a separate `membership_eligible` flag.

Reservation atomically takes one available seat. Basic additionally holds one of the ten included uses, so `confirmed check-ins + active Basic holds` cannot exceed ten. Classic has no monthly numerical hold but is still limited to one active included reservation/check-in per membership per venue-local service date. Repeating the same operation returns the existing reservation. Concurrent final-seat, final-Basic-use and same-day attempts produce at most one success.

A member may cancel before the class starts. Cancellation releases the seat and Basic hold and creates no attendance. A reservation not confirmed during the session's check-in window reconciles to `no_show` after the session; it also releases the allowance hold and creates no attendance, allocation input or fee. `checked_in` is terminal and may be set only through DEV0084's authorized attendance boundary. Cancelled, expired and no-show reservations cannot later check in.

## Assumptions, decisions, and dependencies

- The existing persistent `class_sessions` relation remains an internal schedule source even though the old public Classes product was removed.
- All scheduled classes at a selected participating core gym are included under the current membership contract. A future class-specific exclusion requires a separate product decision.
- Reservation eligibility uses the snapshotted membership-period terms, not a later catalogue version.
- One included reservation/check-in per membership per service date applies across all four selected gyms, not once per gym.
- The initial cancellation policy has no cutoff fee or consumed allowance. This is a hackathon simplification, not a production promise.
- No background worker is required: bounded reconciliation may occur when reservation state is read or mutated, provided concurrent callers converge on one result.

## Implementation plan

1. Define reservation operation, reservation lifecycle and Basic hold invariants against membership periods, selected gyms and existing class sessions.
2. Add additive schema/Drizzle mappings and atomic database functions for create/resume, cancel and temporal reconciliation with capacity, daily and allowance serialization.
3. Add actor-scoped scheduled-class and reservation repositories/services/routes that accept only bounded class/operation identifiers.
4. Expose private upcoming/history projections including class, gym, local time, reservation status and whether one Basic use is held.
5. Add migration, database, domain, authorization and concurrency coverage; replay migrations/seed cleanly and run static/build validation.

## Acceptance criteria

- [ ] AC1: An active member can reserve a scheduled class only at a gym frozen into that membership period and only when the full session lies within the period.
- [ ] AC2: Reservation holds one seat atomically; duplicate/member-session and concurrent final-seat attempts cannot overbook.
- [ ] AC3: Basic confirmed usage plus active holds never exceeds ten; concurrent final-use reservations produce at most one success.
- [ ] AC4: Basic and Classic allow at most one active included reservation/check-in across the membership on one venue-local service date; Classic has no fabricated monthly allowance.
- [ ] AC5: Retrying one operation returns the same reservation without an additional seat or allowance hold.
- [ ] AC6: Pre-start cancellation and post-window no-show/expiry release the seat/Basic hold and create no attendance, fee or allocation input.
- [ ] AC7: Only DEV0084's authorized boundary can transition `reserved` to `checked_in`; terminal reservations cannot be revived or reassigned.
- [ ] AC8: Member reads expose only the actor's eligible classes/reservations and no other member's private state.
- [ ] AC9: Forward/clean migration replay, authorization/concurrency/database tests, unit tests, lint, typecheck, formatting, database lint and production build pass.

## Validation plan

Use Basic periods with zero, one and ten confirmed/held uses plus Classic periods around venue-local midnight. Exercise foreign/non-core venues, sessions outside the period, cancelled sessions, duplicate operations, same-day classes at different selected gyms, cancellation boundaries, no-show reconciliation and concurrent final seat/use. Assert rejected attempts leave capacity, holds and history unchanged.

Run forward migration, clean migration/seed replay, pgTAP or equivalent constraints, focused database integration tests, the full unit suite, lint, typecheck, formatting, database lint, production build and `git diff --check`. Browser evidence belongs to DEV0087.

## Implementation record

Pending implementation.

### Changes and rationale

No implementation changes yet.

### Affected files

| File or component                                 | Change and purpose                                                |
| ------------------------------------------------- | ----------------------------------------------------------------- |
| Pending reservation migration/domain/server files | Add the reviewed class reservation and held-entitlement boundary. |

### Decisions and deviations

- 2026-09-27: Created as a fresh peer after the committed DEV0084 plan was split. Reservation owns capacity and entitlement holds; it does not own attendance.
- 2026-09-27: Treat all scheduled classes at selected participating gyms as included instead of restoring the deleted class-level membership flag.

### Contracts, configuration, and operations

An additive database and private HTTP contract is planned. No new secret, wallet key, payment or public catalogue mutation is required. Exact migration and rollback details will be recorded during implementation.

## Validation results

Pending validation.

| Criterion | Evidence            | Result  |
| --------- | ------------------- | ------- |
| AC1–AC9   | Not yet implemented | Not run |

## Risks, limitations, and follow-ups

The no-penalty cancellation/no-show policy is intentionally simplified. It can encourage unused reservations and must be revisited before production. DEV0084 must consume the reservation hold and capacity state through the delivered atomic transition rather than duplicating reservation logic.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: Planning self-review completed; no independent review.
- Deployment or release: None.
