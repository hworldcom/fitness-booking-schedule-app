# Ticket DEV0128: Persist credit-backed private bookings

- Status: Draft
- Created: 2026-10-04
- Last updated: 2026-10-04
- Milestone: Marketplace M3 pass-backed booking
- Coordination: [COR0010 — Coach-pass and group-funded marketplace MVP](../organisatory/COR0010-group-funded-coach-marketplace-mvp.md)
- Related records: depends on completed [DEV0127](../../archive/blockchain/DEV0127-implement-coach-client-credit-ledger.md) and completed coach availability under DEV0114; supplies booking/client-card projections to [DEV0129](../frontend/DEV0129-present-coach-passes-bookings-and-client-cards.md) and hosted evidence to DEV0125

## Objective and context

Persist capacity-one calendar bookings that reserve and consume a client's coach-specific pass credits while applying the coach's published early-cancellation cutoff and explicit late-cancellation decision.

## Scope and non-goals

- In scope: coach cancellation policy; booking lifecycle and concurrency; authoritative operation/idempotency records; credit reservation/settlement integration; automatic early return; coach approve/deny late cancellation; coach-side client-card projection joining chain balance with authorized profile/booking data.
- Out of scope: UI composition, group events, disputes after completion, no-show adjudication, arbitrary session lengths, recurring subscriptions or private contact-data exposure.

## Expected behavior and edge cases

A client with available coach credits can reserve one open calendar occurrence once. Early cancellation before the coach's cutoff returns the credit. A later request remains pending until the coach approves a return or denies it and the credit remains consumed. Concurrent booking, cancel, approval, retry and reload operations converge on one lifecycle without double-spending or double-returning a credit.

## Assumptions, decisions, and dependencies

PostgreSQL owns scheduling, occurrence capacity and cancellation workflow. The Solana pair ledger owns aggregate credit quantities, with reviewed reservation/consume/return instructions added before this ticket begins if DEV0127 intentionally limits itself to purchase. Client cards expose only data the coach is authorized to see.

## Implementation plan

1. Freeze the booking and cancellation state machine plus chain-operation boundary.
2. Add migrations, constraints, repositories and authorization.
3. Integrate idempotent credit reservation/consume/return operations and finalized projection recovery.
4. Add coach-client projection queries.
5. Validate concurrency, authorization, policy edges and reload recovery.

## Acceptance criteria

- [ ] AC1: One available slot and one available coach-specific credit produce exactly one confirmed booking.
- [ ] AC2: Early cancellation returns one credit automatically; late cancellation requires the recorded coach decision.
- [ ] AC3: Duplicate/concurrent actions cannot oversubscribe a slot or spend/return a credit twice.
- [ ] AC4: Coach client projections expose correct balances and booking history without leaking unrelated client data.

## Validation plan

Database constraint/repository tests, mocked and local program-operation recovery tests, authorization/concurrency tests and a local two-account rehearsal.

## Implementation record

Not started.

## Validation results

Not run — dependencies incomplete.

## Risks, limitations, and follow-ups

The exact reserve/consume/return instruction contract must be reviewed before implementation; it may require a dedicated blockchain peer if it cannot remain small and atomic.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: Planning self-review only.
- Deployment or release: None.
