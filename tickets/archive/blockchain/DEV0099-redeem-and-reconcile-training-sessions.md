# Ticket DEV0099: Redeem and reconcile training sessions

- Status: Cancelled
- Created: 2026-10-02
- Last updated: 2026-10-04
- Milestone: Coach-first M5 completed-class consumption
- Coordination: [COR0009 — Coach-first private-class booking MVP](../organisatory/COR0009-coach-first-training-package-mvp.md)
- Related records: historical plan under cancelled [COR0009](../organisatory/COR0009-coach-first-training-package-mvp.md); superseded by deterministic group-event settlement/payout/refund in completed [DEV0121](DEV0121-implement-group-event-funding-program.md) and current [DEV0122](../../current/blockchain/DEV0122-integrate-devnet-group-event-funding.md), not by an attendance-redemption equivalent

## Objective and context

Let the authoritative offer coach redeem one completed booked private class from a valid TrainingPass while both coach and client retain a consistent booking history and remaining balance. This replaces the venue arrival/staff-confirmation model and consumes only a class that DEV0105 previously confirmed against the same coach/client/pass lineage.

## Scope and non-goals

- In scope: coach-only `redeem_session` initiated from one eligible confirmed booking after its scheduled class; bounded booking reference in the redemption operation/event; active/not-expired/remaining checks; exact decrement without underflow; exhausted transition; structured redemption event; offchain booking/history reconciliation with replay protection; coach booking list and completion/redeem action; client booking/pass balance/history refresh; fee sponsorship and explicit pending/confirmed/error states.
- Out of scope: client co-signature, undo/reversal, disputes, refunds, slot creation or booking/cancellation mutation, no-show charging, recurring sessions, pass cancellation, staff delegation, transfer/resale or social sharing of attendance.

## Expected behavior and edge cases

Only the coach authority stored through the offer/pass lineage can redeem. The application accepts one completion operation only for a matching confirmed booking after the scheduled class and binds its stable booking reference to submission/reconciliation. A confirmed redemption decrements once, emits one identifiable event and moves the booking to completed. The final session changes the pass to Exhausted. Cancelled, already completed, completion-pending, expired-pass, exhausted-pass, wrong-coach, wrong-pass and duplicate/replayed requests leave the balance unchanged.

The MVP deliberately permits unilateral coach attestation and wallet redemption after a booking. The interface must identify that trust boundary, require confirmation and show the scheduled booking plus immutable transaction/history evidence. The program verifies coach/pass authority and the bounded reference but cannot independently prove that a real-world class occurred. Lost responses and RPC/index delays keep the booking completion-pending/recoverable rather than causing a second decrement. Booking cancellation remains an off-chain state owned by DEV0105; there is no pass `Cancelled` state or reversal instruction.

## Assumptions, decisions, and dependencies

The coach wallet—not merely an application role—authorizes the onchain decrement, while the email account and linked-wallet match protect application routes. MovX may sponsor bounded Devnet network fees. The TrainingPass account is authoritative for remaining sessions; indexed events supply history but cannot override balance.

## Implementation plan

1. Freeze redemption instruction/event, stable booking-reference binding, operation identity and exhaustion semantics.
2. Implement authorization, expiry, underflow, replay and concurrency tests locally.
3. Add sponsor/submission/reconciliation/index services and protected coach/client booking/pass read models.
4. Implement coach completed-class confirmation/redeem action and client booking/balance/history presentation.
5. Rehearse one Devnet redemption and reload/recovery from full balance to one less.

## Acceptance criteria

- [ ] AC1: The authoritative coach redeems one eligible completed booking and remaining sessions decrease exactly once with a matching bounded booking reference.
- [ ] AC2: Wrong coach, expired/exhausted pass, duplicate/replay and concurrent last-session attempts cannot underflow or double-decrement.
- [ ] AC3: The final session produces Exhausted state, and both coach/client views reconcile the same completed booking, authoritative balance and immutable event history.
- [ ] AC4: Lost response/RPC delay can recover the existing redemption without sending another mutation.
- [ ] AC5: Local program/index/authorization/browser checks and a real Devnet redemption rehearsal pass.

## Validation plan

Use program tests for every state/authority/concurrency branch, event-index replay tests, two-user protected service tests and desktop/mobile keyboard browser checks. Verify one Devnet signature, pass account state, indexed history and reload convergence independently.

## Implementation record

Cancelled before implementation on 2026-10-04 when completed-session redemption left the hackathon target.

### Changes and rationale

No runtime change was made. The current product deliberately does not prove or redeem real-world attendance; its blockchain rule ends at group-funding success/payout or failure/refund.

### Affected files

Planned: package program redemption instruction/event, operation/index schema and services, coach/client dashboard components and focused tests.

### Decisions and deviations

- 2026-10-04: Cancelled without a one-for-one replacement because attendance proof, no-show and post-event disputes are explicitly outside the new MVP.

### Contracts, configuration, and operations

No new payment asset is planned. Redemption operation/event and possibly sponsor policy extend DEV0098's configuration.

## Validation results

Not applicable — cancelled before implementation. Documentation/replacement links are validated by DEV0117.

## Risks, limitations, and follow-ups

Unilateral coach attestation/redemption requires product trust and a future no-show, dispute and reversal policy before production. The booking reference improves traceability but is not cryptographic proof that the real-world class occurred; the hackathon interface must not imply otherwise.

## Completion and review references

- Completed: Cancelled on 2026-10-04 before runtime implementation.
- Commit: Not created.
- Review: Planning self-review only.
- Deployment or release: None.
