# Ticket DEV0087: Add the member class reservation interface

- Status: Completed
- Created: 2026-09-27
- Last updated: 2026-09-28
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

The member may cancel before the class begins, releasing the hold. A class cancelled by its venue also releases the hold and is distinguished from a member cancellation. Full, cancelled, same-day-conflicting, past, out-of-period or service-unavailable classes cannot appear reserved. A post-class `no_show` result is shown honestly after server reconciliation and never appears as attendance. `Expired` belongs to the short-lived DEV0085 arrival code, not a class reservation.

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

- [x] AC1: An active member sees only eligible scheduled classes from the four frozen core gyms with authoritative local time and capacity state.
- [x] AC2: Reserve/resume creates one durable visible reservation and clearly labels its seat and Basic allowance as held, not consumed.
- [x] AC3: Classic shows the daily conflict policy without a numerical monthly allowance.
- [x] AC4: Member/session cancellation before start releases the visible hold and shows the correct reason; full, cancelled, conflicting, past, no-show and unavailable outcomes remain honest and cannot look reserved.
- [x] AC5: Reload/retry recovers one reservation without duplicate cards, capacity claims or automatic replacement submission.
- [x] AC6: Reservation UI never claims physical attendance, allocation, payment or staff confirmation.
- [x] AC7: Schedule, reserve and cancel flows are usable by keyboard and at representative mobile/desktop widths with accessible status announcements.
- [x] AC8: Focused tests, full unit checks, lint, typecheck, formatting, production build and relevant browser checks pass.

## Validation plan

Use DEV0086 fixtures for available/full/cancelled/past/out-of-period sessions, Basic available/final/exhausted holds, Classic same-day conflicts, reserved/member-cancelled/session-cancelled/no-show states and service failure. Exercise repeated actions, reloads, keyboard use and mobile/desktop layouts. Confirm signed-out and inactive-member states retain the existing access boundary.

Run focused unit/component tests, `npm test`, lint, typecheck, formatting, the documented Webpack build, `git diff --check` and focused browser tests. Mock-only behavior cannot complete the ticket without DEV0086's persistent contract.

## Implementation record

Completed the selected-gym class schedule and persistent reservation controls inside the authenticated My Membership experience.

### Changes and rationale

My Membership now server-loads DEV0086's actor-scoped schedule and groups classes by authoritative venue-local service date. Each card shows discipline, local time, selected gym, trainer, remaining capacity and expandable details. Bounded reserve/cancel requests refresh the canonical server state; terminal, conflict, full and unavailable states never offer an active reservation control.

The plan summary separates Basic available, held and confirmed counts. Classic explains its one-included-visit-per-day rule without inventing a monthly balance. Reserved cards and live announcements state that the seat/access is held and that attendance still requires staff confirmation. Explicit refresh, empty and failure states preserve the last known state without fabricating success.

### Affected files

| File or component                                                            | Change and purpose                                                                                                                                   |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/my-access/page.tsx` and `src/features/membership/my-membership.tsx` | Load the private schedule with membership state and mount it only for an active period; use deterministic membership dates to avoid hydration drift. |
| `src/features/membership/class-schedule.tsx`                                 | Adds date groups, class cards, capacity/status presentation, accessible reserve/cancel/refresh actions and held-versus-attended copy.                |
| `src/features/membership/reservation-client.ts`                              | Strictly parses schedule responses and provides same-origin reserve/cancel clients with bounded unavailable fallbacks.                               |
| `src/app/membership.css`                                                     | Adds responsive two-column desktop and single-column mobile schedule layouts plus visible status/feedback treatment.                                 |
| `tests/class-reservations.test.ts`                                           | Covers the response parser, bounded lifecycle and server-rendered held-access presentation.                                                          |
| `scripts/rehearse-local-class-reservations.mjs` and `package.json`           | Add a disposable real Auth/database/Chrome rehearsal for reserve, reload, cancel, keyboard use and mobile/desktop rendering.                         |

### Decisions and deviations

- 2026-09-27: Created as the frontend reservation peer after splitting advance booking from arrival check-in.
- 2026-09-28: Align the interface with DEV0086's four reservation states; only arrival requests expire, and reservation cancellation identifies member versus session cancellation.
- 2026-09-28: DEV0086's member-scoped schedule and idempotent reserve/cancel responses passed focused database validation. The user asked to add the fictional schedules to the UI, so implementation starts in the existing authenticated My Membership experience.
- 2026-09-28: Kept schedule discovery inside My Membership instead of restoring a public Classes route. The interface uses explicit refresh after mutations and on demand; it does not poll or submit automatic replacement reservations.
- 2026-09-28: The browser rehearsal exposed locale-dependent membership-period rendering on the same client screen. Dates now specify `en-GB` and UTC so server and browser hydration agree.

### Contracts, configuration, and operations

The browser consumes DEV0086's private schedule/reservation contract. It sends only generated operation/class identifiers or an owned reservation identifier; it never supplies plan, period, gym, capacity or allowance authority. No new schema, dependency, secret, wallet or environment variable was added by this ticket. `npm run test:reservations` requires the Auth-enabled local stack, restricted runtime database, captured mailbox, configured app on port 3100 and installed Chrome.

## Validation results

| Criterion | Evidence                                                                                                                                                                                | Result |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1–AC6   | Component/domain tests plus the real actor-scoped browser flow show selected-gym classes, persistent reserve/reload/cancel state, honest held-use accounting and no attendance claim    | Passed |
| AC7       | `npm run test:reservations` passed at 1440×1040 and 393×852, including Enter-key reservation, no horizontal overflow, live feedback and reviewed screenshots in ignored `test-results/` | Passed |
| AC8       | `npm test` (82/82), `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build`, `npm run test:reservations` and `git diff --check`                                    | Passed |

## Risks, limitations, and follow-ups

Capacity displayed in the browser is advisory until the atomic reserve response succeeds. A user can lose the final seat between viewing and submitting; the interface reports the server conflict without inventing a reservation. The fixed two-week demo schedule makes the page intentionally long and is not a production browsing or pagination design. Arrival/check-in controls and confirmed history remain DEV0085. No hosted deployment was performed.

## Completion and review references

- Completed: 2026-09-28.
- Commit: Implementation commit pending; initial split planning record is `25d4842`.
- Review: Implementation self-review against AC1–AC8 plus desktop/mobile screenshot review completed; no independent review.
- Deployment or release: None.
