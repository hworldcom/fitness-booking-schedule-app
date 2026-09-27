# Ticket DEV0087: Add the member class reservation interface

- Status: Draft
- Created: 2026-09-27
- Last updated: 2026-09-27
- Milestone: M3 check-ins, member-price access and allocation
- Coordination: [COR0008 — Membership reservations and check-ins](../organisatory/COR0008-membership-reservations-and-checkins.md)
- Related records: consumes [DEV0086 — Persist included class reservations](../backend/DEV0086-persist-included-class-reservations.md), supplies upcoming reservation context to [DEV0085 — Add the member check-in interface](DEV0085-member-checkin-interface.md), and extends the active membership view delivered through [DEV0081 — Activate memberships with Devnet EURC](../blockchain/DEV0081-devnet-membership-activation.md)

## Objective and context

Let an active member browse scheduled classes at the four gyms frozen into the membership, reserve an available class in advance, cancel it before the session and understand the held-seat/held-allowance state. The interface must distinguish a reservation from staff-confirmed attendance.

This ticket owns the member presentation for [reservations](../../../docs/mvp-spec.md#8-reservations-and-member-priced-visits), M3 and the reservation portions of A05–A10/A22/A24–A25. Arrival proof and check-in history remain DEV0085.

## Scope and non-goals

- In scope: selected-core-gym class schedule; local date/time, activity, trainer and remaining-capacity presentation supplied by the server; reserve/resume/cancel actions; Basic held-use explanation; Classic daily-policy explanation; upcoming and terminal reservation states; reload/retry recovery; bounded loading/empty/unavailable states; responsive keyboard-accessible behavior.
- Out of scope: public all-Berlin class marketplace; classes at non-core gyms; payment; arrival code/QR; staff confirmation; attendance history; allocation; waitlists; notifications; recurring schedule editing; cancellation fees; social sharing; and staff operations.

## Expected behavior and edge cases

An active member sees only eligible scheduled classes at the four selected gyms. Reserving shows a durable `Reserved` state and explains that a seat—and for Basic one included use—is held but not yet consumed. Classic shows no numerical balance. A repeated click or page reload recovers the same reservation.

The member may cancel before the class begins, releasing the hold. Full, cancelled, same-day-conflicting, out-of-period or service-unavailable classes cannot appear reserved. No-show and expired results are shown honestly after server reconciliation and never appear as attendance. DEV0085 later exposes the short-lived arrival action for an eligible upcoming reservation.

## Assumptions, decisions, and dependencies

- DEV0086 must stabilize its schedule/reservation contract before this ticket moves to Ready.
- Schedule discovery belongs within the authenticated membership experience; this ticket does not restore the removed public Classes navigation.
- Server timestamps and venue timezone labels are authoritative. The browser does not calculate eligibility or availability from local time.
- Status refresh may use explicit refresh or bounded polling, but never creates replacement reservations automatically.

## Implementation plan

1. Review DEV0086's delivered schedule/reservation contract and move this ticket to Ready when fields and recovery semantics are stable.
2. Add selected-gym schedule and upcoming-reservation sections to the authenticated membership experience without obscuring active-plan/payment state.
3. Add a bounded browser client for reserve/resume/cancel and terminal reconciliation.
4. Present capacity and Basic hold/Classic daily-policy language without claiming attendance or monetary allocation.
5. Add focused unit/component and desktop/mobile keyboard browser coverage plus static/build validation.

## Acceptance criteria

- [ ] AC1: An active member sees only eligible scheduled classes from the four frozen core gyms with authoritative local time and capacity state.
- [ ] AC2: Reserve/resume creates one durable visible reservation and clearly labels its seat and Basic allowance as held, not consumed.
- [ ] AC3: Classic shows the daily conflict policy without a numerical monthly allowance.
- [ ] AC4: Cancellation before start releases the visible hold; full, cancelled, conflicting, expired and unavailable outcomes remain honest and cannot look reserved.
- [ ] AC5: Reload/retry recovers one reservation without duplicate cards, capacity claims or automatic replacement submission.
- [ ] AC6: Reservation UI never claims physical attendance, allocation, payment or staff confirmation.
- [ ] AC7: Schedule, reserve and cancel flows are usable by keyboard and at representative mobile/desktop widths with accessible status announcements.
- [ ] AC8: Focused tests, full unit checks, lint, typecheck, formatting, production build and relevant browser checks pass.

## Validation plan

Use DEV0086 fixtures for available/full/cancelled/out-of-period sessions, Basic available/final/exhausted holds, Classic same-day conflicts, reserved/cancelled/no-show/expired states and service failure. Exercise repeated actions, reloads, keyboard use and mobile/desktop layouts. Confirm signed-out and inactive-member states retain the existing access boundary.

Run focused unit/component tests, `npm test`, lint, typecheck, formatting, the documented Webpack build, `git diff --check` and focused browser tests. Mock-only behavior cannot complete the ticket without DEV0086's persistent contract.

## Implementation record

Pending implementation. DEV0087 remains Draft until DEV0086 stabilizes its contract.

### Changes and rationale

No implementation changes yet.

### Affected files

| File or component                                     | Change and purpose                                      |
| ----------------------------------------------------- | ------------------------------------------------------- |
| Pending membership schedule/reservation feature files | Present the delivered persistent reservation lifecycle. |

### Decisions and deviations

- 2026-09-27: Created as the frontend reservation peer after splitting advance booking from arrival check-in.

### Contracts, configuration, and operations

No schema, secret or dependency change is planned. The browser consumes DEV0086's private member contract.

## Validation results

Pending validation.

| Criterion | Evidence                                       | Result  |
| --------- | ---------------------------------------------- | ------- |
| AC1–AC8   | Blocked on DEV0086 contract and implementation | Not run |

## Risks, limitations, and follow-ups

Capacity displayed in the browser is advisory until the atomic reserve response succeeds. A user can lose the final seat between viewing and submitting; the interface must show that conflict without inventing a reservation.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: Planning self-review completed; no independent review.
- Deployment or release: None.
