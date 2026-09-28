# Ticket DEV0084: Persist included membership check-ins

- Status: Draft
- Created: 2026-09-27
- Last updated: 2026-09-28
- Milestone: M3 check-ins, member-price access and allocation
- Coordination: [COR0008 — Membership reservations and check-ins](../organisatory/COR0008-membership-reservations-and-checkins.md)
- Related records: builds on active periods from [DEV0080 — Persist membership activation foundation](../../archive/backend/DEV0080-membership-activation-foundation.md), consumes the shared daily-access claim from [DEV0086 — Persist included class reservations](DEV0086-persist-included-class-reservations.md), supplies [DEV0085 — Add the member check-in interface](../frontend/DEV0085-member-checkin-interface.md), and is deliberately distinct from the financial club-wallet authority in [DEV0041](DEV0041-club-wallet-authorization.md); the original broad DEV0084 plan is preserved in commit `f6bde9f`

## Objective and context

Turn an eligible arrival at one of the four gyms frozen into an active membership into immutable attendance only after authorized same-venue staff confirm physical presence. For a scheduled class, confirmation consumes DEV0086's held daily-access claim. For ordinary open-gym access, the same boundary first holds and then consumes a daily-access claim without inventing a class reservation.

This ticket owns the attendance portion of [included check-ins](../../../docs/mvp-spec.md#74-included-check-ins), M3 and acceptance scenarios A05–A11/A24. Advance reservation/capacity moved to DEV0086, monetary provisional allocation remains a later ticket, and member presentation remains DEV0085.

## Scope and non-goals

- In scope: one short-lived opaque arrival request bound to member, active period, selected venue and optional reservation/session; a 15-minute presentation token/code stored only as a hash; pending/confirmed/expired/cancelled lifecycle; authenticated email-account actor plus active same-venue `manager` or `check_in_staff` authorization; reservation/window validation; shared `membership_daily_access_claims` acquisition/consumption/release; immutable venue-local service date; Basic confirmed-use consumption; Classic attendance without a numerical allowance; duplicate/concurrency protection; immutable private attendance; member history/allowance reads; bounded staff-confirmation service/route; migrations and database/domain tests.
- Out of scope: class discovery/reservation/capacity owned by DEV0086/DEV0087; member UI owned by DEV0085; staff scanner/workspace UI; club-wallet proof; monetary allocation calculation or payout; direct non-core visits; social publication; penalties, refunds, notification delivery and production attendance hardware.

## Expected behavior and edge cases

Near arrival, a signed-in member creates or resumes one pending request for a selected gym. A reservation-backed request is also bound to the exact `reserved` class and opens only during its configured arrival window. A venue-only open-gym request needs no class. The browser generates a high-entropy opaque value, retains it only for the pending request and sends its hash in the authenticated create operation. The server persists only the hash and request metadata; no personal or financial data is embedded in the displayed value.

The code expires 15 minutes after creation and cannot be confirmed at another gym. Staff authenticate with their own email account; the server derives their profile and requires an active `venue_staff` relation with `manager` or `check_in_staff` for the exact venue. Club-wallet proof is unnecessary because confirming presence is not a financial signature.

Creating a reservation-backed arrival reuses its existing `held` claim. Creating a venue-only open-gym arrival atomically obtains a `held` claim for the venue-local service date; cancellation or expiry releases it. This prevents a class reservation and open-gym arrival from both reserving the same membership day.

Confirmation rechecks the active period, selected venue, code hash/expiry, staff scope, immutable service date, daily claim and the reservation when present. For Basic, it atomically changes the claim from `held` to `consumed` and increments confirmed usage exactly once. For Classic, it consumes the same daily claim without creating a synthetic balance. A reservation-backed confirmation also changes the reservation to `checked_in`; immutable attendance is written once and repeated confirmation returns the same result. Wrong venue/staff, expired code/period, terminal reservation, exhausted Basic allowance, released/consumed claim, second same-day attendance or concurrent conflict changes no usage or history.

The attendance record is an auditable future allocation input, but DEV0084 calculates no monetary share. Private check-ins do not enter social queries until DEV0023 explicitly consumes confirmed evidence.

## Assumptions, decisions, and dependencies

- DEV0086 must deliver the shared daily-access claim and reservation transition before this ticket moves to Ready; venue-only arrival design may proceed independently.
- Fifteen minutes applies to the arrival code, not the advance reservation. A different configurable window requires a recorded product change.
- The one-per-day rule is per membership/service date across all four gyms. The target venue's IANA timezone derives that date.
- PostgreSQL is the hackathon attendance authority. Activation and direct payments retain separate Solana verification boundaries.
- Raw presentation codes remain only in bounded browser session state and are never sent to persistent storage; the server stores their hash. A reload in the same browser resumes the raw value and existing request, while a lost value requires the member to cancel/expire that request before creating a replacement.
- The existing `venue_staff` relation, not DEV0041 club-wallet proof, supplies operational attendance authority.

## Implementation plan

1. Finalize the arrival operation/status/token contract and DEV0086's atomic reservation/daily-claim boundary.
2. Add additive schema/Drizzle mappings and database functions for create/resume, expire/cancel and same-venue staff confirmation with immutable attendance and daily/use serialization.
3. Add member request/history/allowance and staff confirmation repositories/services/routes with server-derived actor and venue authority.
4. Make the confirmed attendance projection safe for later member UI and allocation/social consumers without publishing private data or monetary claims.
5. Add migration, database, domain, authorization, expiry and concurrency coverage; replay migrations/seed cleanly and run static/build validation.

## Acceptance criteria

- [ ] AC1: An active member can create or resume one 15-minute arrival request only for a selected core gym and, when class-backed, one eligible `reserved` reservation; losing the raw browser-held value cannot silently create a second active request.
- [ ] AC2: The returned opaque code contains no personal/financial data, is stored only as a hash, is bound to the exact venue/request and cannot be used after expiry.
- [ ] AC3: Only a signed-in actor with active same-demo-dataset, same-venue `manager` or `check_in_staff` authority can confirm; club-wallet proof, member action, wrong-venue staff and stale authority cannot create attendance.
- [ ] AC4: Basic confirmation atomically changes exactly one daily-access claim from `held` to `consumed`, increments confirmed usage once and rejects an eleventh; concurrent final-use attempts produce at most one success.
- [ ] AC5: Classic consumes the same daily claim without a numerical monthly allowance, while both plans reject another held or consumed claim across the membership on the same venue-local service date.
- [ ] AC6: Reservation-backed confirmation atomically sets `checked_in`; venue-only arrival obtains and consumes the shared claim without a fabricated reservation; terminal reservations and released/consumed claims cannot confirm.
- [ ] AC7: Successful confirmation creates one immutable private attendance record; duplicate code/operation/confirmation retries return the existing result without double effects.
- [ ] AC8: Member reads expose only that actor's pending/history/allowance state, staff confirmation exposes only the bounded outcome, and unshared attendance remains absent from social queries.
- [ ] AC9: Forward/clean migration replay, authorization/concurrency/database tests, unit tests, lint, typecheck, formatting, database lint and production build pass.

## Validation plan

Use separate member, same-venue staff, wrong-venue staff and ordinary non-staff actors. Exercise valid/expired/replayed/tampered codes, reservation and open-gym arrivals, Basic uses one through eleven with active future holds, Classic around local midnight, same-day different-gym attempts, expired periods and concurrent confirmations. Assert every rejection leaves usage, reservation and attendance unchanged.

Run forward migration, clean migration/seed replay, pgTAP or equivalent constraints, focused database integration tests, the full unit suite, lint, typecheck, formatting, database lint, production build and `git diff --check`. Browser evidence belongs to DEV0085 and the later staff-interface ticket.

## Implementation record

Pending implementation. The original committed plan combined reservation, attendance and monetary allocation. Review split advance reservation into DEV0086/DEV0087, retained attendance under DEV0084/DEV0085 and deferred allocation economics. DEV0084 is Draft until DEV0086 delivers the reservation/daily-claim transition.

### Changes and rationale

No implementation changes yet.

### Affected files

| File or component                                        | Change and purpose                                                                 |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Pending arrival/attendance migration/domain/server files | Add the reviewed short-lived presentation and staff-confirmed attendance boundary. |

### Decisions and deviations

- 2026-09-27: Preserve DEV0084 because its planning record was already committed; narrow its implementation ownership to arrival and attendance under COR0008.
- 2026-09-27: Remove reservation/capacity and monetary allocation calculation. DEV0086 owns reservation; confirmed attendance merely supplies a future allocation input.
- 2026-09-27: Use email-authenticated `venue_staff` authority rather than the unrelated club-wallet proof.
- 2026-09-28: Consume DEV0086's shared daily-access claim for reservation-backed attendance. Venue-only arrival uses the same claim contract so reservation and open-gym flows cannot both use one membership day.

### Contracts, configuration, and operations

Additive arrival/attendance storage and private member/staff HTTP contracts are planned over DEV0086's `membership_daily_access_claims` relation. No new secret, wallet key, payment or public route is required. Exact migration and rollback details will be recorded during implementation.

## Validation results

Pending validation.

| Criterion | Evidence                                              | Result  |
| --------- | ----------------------------------------------------- | ------- |
| AC1–AC9   | Blocked on DEV0086's reservation/daily-claim contract | Not run |

## Risks, limitations, and follow-ups

A displayed arrival code can be shared during its short lifetime; same-venue staff still confirm physical presence, so the code is a lookup capability rather than proof by itself. The later gym workspace must prevent accidental confirmation and show member/session context without exposing private financial data.

## Completion and review references

- Completed: Not completed.
- Commit: Initial broad planning record committed in `f6bde9f`; split revision committed in `25d4842`; the daily-claim clarification is not yet committed.
- Review: Planning self-review completed; no independent review.
- Deployment or release: None.
