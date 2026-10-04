# Ticket DEV0105: Book private classes with pass credits

- Status: Draft
- Created: 2026-10-03
- Last updated: 2026-10-03
- Milestone: Coach-first M4 private-class booking
- Coordination: [COR0009 — Coach-first private-class booking MVP](../organisatory/COR0009-coach-first-training-package-mvp.md)
- Related records: depends on the explicit-slot baseline from [DEV0104 — Publish weekly coach availability](../../archive/backend/DEV0104-publish-weekly-coach-availability.md), durable recurring occurrences from [DEV0114 — Persist recurring coach availability](../../archive/backend/DEV0114-persist-recurring-coach-availability.md), eligible one-session/ten-session passes from [DEV0098 — Purchase training packages with Devnet USDC](../blockchain/DEV0098-purchase-training-packages-with-devnet-usdc.md), and supplies completed-booking context to [DEV0099 — Redeem and reconcile training sessions](../blockchain/DEV0099-redeem-and-reconcile-training-sessions.md)

## Objective and context

Let a client book one open private-class slot with an eligible coach-specific TrainingPass. A client without a pass can hold the selected slot while buying either a one-session or ten-session pass; a client with an eligible pass books directly. Cancelling a future booking releases the reserved session credit for another booking. A client-cancelled, still-valid slot reopens; a coach-cancelled slot is withdrawn.

## Scope and non-goals

- In scope: bounded purchase-time slot holds; hold expiry; pass-backed confirmed bookings; coach/client/pass/slot eligibility; off-chain reservation of future session credits; atomic capacity and credit checks; client and coach booking views showing the stable slot-location label and optional fictional gym name; future-booking cancellation by either party with credit retained; payment/booking recovery; booking states needed for later completion/redemption; idempotent operations; responsive accessible UI and authorization/concurrency tests.
- Out of scope: creating or editing recurrence rules/occurrences owned by DEV0114; gym-managed classes, memberships, access claims or check-ins; group capacity; waitlists; automatic USDC refunds; pass transfer; booking fees; late-cancellation/no-show charges; disputes; reminders; external calendars; direct messaging or on-chain calendar accounts.

## Expected behavior and edge cases

A signed-in client selects an open slot after seeing its scheduled time and stable public-location label, including the fictional gym name when the coach selected one. If the client has an eligible active pass that remains valid through the scheduled slot and has an unreserved session, one database transaction confirms the booking, closes the slot and reserves one future credit. Bookable credit equals the latest verified finalized on-chain remaining balance minus active confirmed or completion-pending bookings that have not yet produced a matching redemption. Booking views read the slot snapshot rather than mutable coach or gym records.

If the client must purchase, MovX creates one short-lived capacity hold before wallet approval. Successful finalized purchase creates a one-session or ten-session pass through DEV0098, after which the same operation confirms the held slot. Wallet rejection or failed payment releases or expires the hold. If payment succeeds but the response or booking confirmation is interrupted, reconciliation never charges again: it confirms the still-valid hold when possible or leaves the full purchased pass available to book another eligible slot.

Client or coach cancellation before the scheduled start changes the booking to cancelled and releases the reserved credit. Client cancellation reopens a still-valid future slot; coach cancellation withdraws the slot because the coach is no longer offering that time. The TrainingPass on-chain remaining balance is unchanged, including for a one-session pass. Completed, redemption-pending or redeemed bookings cannot be cancelled. Concurrent holds/bookings for one slot and concurrent last-credit bookings for one pass must produce at most one success.

## Assumptions, decisions, and dependencies

Confirmed by the user on 2026-10-03: cancellation keeps the class available to the purchaser. This means the entitlement is a reusable coach-specific credit, not payment for an irrevocable timestamp. No automatic USDC refund is created.

PostgreSQL owns recurring availability rules, concrete dated occurrences, holds, bookings and future-credit reservation state. DEV0105 accepts only a durable DEV0114 occurrence as booking inventory; it never books an abstract recurrence rule. Solana owns pass existence, coach/client lineage, expiry and remaining sessions. Booking services must refresh or verify finalized pass state at security-sensitive transitions and cannot increase entitlement from a cache. The exact hold duration is an implementation default to adopt before work; ten minutes is the proposed starting value.

## Implementation plan

1. Freeze hold, booking, cancellation, credit-reservation, expiry and idempotent operation contracts.
2. Add additive booking/hold schema, exclusion/uniqueness constraints, row-level security and actor-scoped database operations.
3. Add verified pass-read and purchase-completion integration without moving pass authority into PostgreSQL.
4. Implement slot selection, use-existing-pass, buy-then-book, cancellation and coach/client booking views.
5. Validate capacity, last-credit, expiry, cancellation, payment-success/booking-failure recovery and two-user authorization races.

## Acceptance criteria

- [ ] AC1: A client with one eligible unreserved session can confirm exactly one open capacity-one slot, and coach/client views show the same booking time, stable location label and optional fictional gym name.
- [ ] AC2: A client without a pass can hold a slot, buy a one-session or ten-session pass and converge on one confirmed booking without double payment or double booking.
- [ ] AC3: Client or coach cancellation before start releases the reservation while the authoritative pass balance remains unchanged and reusable; a client-cancelled, still-valid slot reopens, while a coach-cancelled slot is withdrawn.
- [ ] AC4: Concurrent slot claims, concurrent last-credit claims, expired holds, ineligible coach/pass, a pass expiring before the slot, and replayed operations fail or recover without fabricated capacity or entitlement.
- [ ] AC5: A finalized purchase followed by lost response or failed confirmation preserves the purchased pass and either recovers the intended booking or permits another eligible booking.
- [ ] AC6: Database, service, authorization, concurrency, recovery, responsive browser, static and build checks pass.

## Validation plan

Run database constraints/RLS and transaction-race tests for slot and last-credit contention; service tests with owner, other user and anonymous actors; deterministic purchase-completion and lost-response reconciliation tests; cancellation/rebooking and expiry scenarios; and desktop/mobile keyboard browser flows. Run relevant unit, database, lint, typecheck, formatting and production-build commands. Reuse DEV0098's real Devnet purchase evidence and record one integrated purchase-to-book rehearsal here once dependencies are ready.

## Implementation record

Not started.

### Changes and rationale

Pending implementation.

### Affected files

Planned: additive hold/booking migration, Drizzle mappings, repositories/services/routes, booking and cancellation interfaces with slot-location presentation, chain-read integration and focused tests.

### Decisions and deviations

None yet.

### Contracts, configuration, and operations

New off-chain hold, booking, reservation and operation contracts are planned. No new payment asset or automatic refund instruction is planned.

## Validation results

Not run — no implementation.

## Risks, limitations, and follow-ups

Database reservations and on-chain balance cannot commit atomically. The recovery contract must fail closed, preserve a successfully purchased pass and never infer chain entitlement from booking state. No-show, late-cancellation and dispute policy require later product decisions.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: Planning self-review only.
- Deployment or release: None.
