# Ticket DEV0085: Add the member check-in interface

- Status: Draft
- Created: 2026-09-27
- Last updated: 2026-09-28
- Milestone: M3 check-ins, member-price access and allocation
- Coordination: [COR0008 — Membership reservations and check-ins](../organisatory/COR0008-membership-reservations-and-checkins.md)
- Related records: consumes arrival/attendance from [DEV0084 — Persist included membership check-ins](../backend/DEV0084-persist-included-membership-checkins.md), consumes upcoming reservations from completed [DEV0087 — Add the member class reservation interface](../../archive/frontend/DEV0087-member-class-reservation-interface.md), depends transitively on completed [DEV0086 — Persist included class reservations](../../archive/backend/DEV0086-persist-included-class-reservations.md), and extends the active membership view delivered through [DEV0081](../blockchain/DEV0081-devnet-membership-activation.md); the original broad DEV0085 plan is preserved in commit `f6bde9f`

## Objective and context

Let an active member present a short-lived arrival code for an upcoming class reservation or ordinary open-gym visit, understand that attendance is waiting for gym confirmation, and see accurate allowance and confirmed private history. Advance class discovery/reservation belongs to DEV0087; this ticket begins at arrival.

This ticket owns the member-facing portion of [included check-ins](../../../docs/mvp-spec.md#74-included-check-ins), M3 and attendance scenarios A05–A11/A22/A24. It must never present a reservation or member click as verified attendance.

## Scope and non-goals

- In scope: eligible upcoming-reservation arrival action; selected-gym open-access action; one-time QR plus human-readable fallback code; visible 15-minute expiry; pending/confirmed/expired/cancelled states; explicit gym-confirmation language; Basic remaining and held/confirmed distinction; Classic daily-policy language; daily availability; private confirmed history; reload/retry recovery; bounded loading/error states; responsive keyboard-accessible behavior.
- Out of scope: schedule discovery/reserve/cancel owned by DEV0087; gym staff scanner/confirmation UI; class capacity; direct €15 non-core visits; social sharing; monetary allocation; activation/payment changes; editing selected gyms; transfers, passes, events, challenges, reactions and notifications.

## Expected behavior and edge cases

An active member opens an upcoming reservation and requests its arrival code during the allowed window, or starts a venue-only open-gym arrival at a selected gym. The UI displays a QR and fallback code with an explicit expiration countdown and “Waiting for gym confirmation.” It identifies the gym and class when applicable but embeds no personal or financial text in the QR payload.

The browser keeps the server-bound opaque value only in bounded session state. Reloading in the same browser resumes the same unexpired request rather than generating multiple codes. If that local value is lost, the interface explains that the existing request must be cancelled or allowed to expire before a replacement can be created. A reservation-backed arrival shows its existing held daily access; an open-gym arrival creates a temporary held claim that disappears if the request is cancelled or expires. Only a server-confirmed result moves into history or changes Basic's confirmed remaining allowance. An expired, cancelled, wrong-window, terminal-reservation or unavailable result explains what happened without claiming attendance. Classic shows uncapped period access plus the one-per-local-day rule and never a made-up balance.

Upcoming reservation state comes from DEV0087/DEV0086. Non-core gyms do not expose included arrival actions. The interface shows no staff-private data, wallet/payment details or provisional allocation.

## Assumptions, decisions, and dependencies

- DEV0084 must stabilize its request/read contract before this ticket moves to Ready; completed DEV0087 supplies the upcoming reservation presentation this screen extends.
- `/my-access` remains the compatibility route.
- A visual QR may use an existing dependency-free browser representation or a reviewed small dependency; any dependency addition must be recorded before implementation.
- Expiry and eligibility use server timestamps. A client countdown is explanatory and cannot extend the request.
- The raw opaque value may use `sessionStorage` only for same-browser reload recovery; it must not enter server logs, database fields, analytics or durable cross-device storage.
- Pending attendance remains private. Social sharing belongs to DEV0023 after confirmation.

## Implementation plan

1. Review DEV0084's delivered member request/snapshot contract and DEV0087's upcoming-reservation component boundary.
2. Add reservation-backed and selected-gym open-access arrival actions to `/my-access` with clear preconditions.
3. Render the opaque QR/fallback code, server-derived expiry and accessible pending/terminal status; recover the same request across reloads.
4. Update allowance/daily-policy and private history only from confirmed server state.
5. Add focused component/client tests plus desktop/mobile keyboard browser coverage and static/build validation.

## Acceptance criteria

- [ ] AC1: An active member can request arrival only for an eligible upcoming reservation or selected-core-gym open access; non-core/inactive/terminal cases expose no valid code.
- [ ] AC2: The interface displays one server-issued QR/fallback code, exact gym/class context and 15-minute expiry without embedding personal or financial data.
- [ ] AC3: Starting or repeating an action resumes one request and explicitly says gym confirmation is required.
- [ ] AC4: Confirmed allowance and history change only after attendance; an open-gym request visibly holds daily access until confirmation, cancellation or expiry, and failure never appears completed.
- [ ] AC5: Basic distinguishes held reservation/open-gym claims from confirmed usage; Classic shows no numerical allowance and does show the daily rule.
- [ ] AC6: Same-browser reload/retry recovers the same pending/confirmed request without duplicate codes, history or automatic replacement submission; a lost raw value has an explicit cancel/expiry recovery path.
- [ ] AC7: Member-safe history exposes no payment, wallet, staff-private or monetary-allocation data.
- [ ] AC8: The full request/pending/confirmed/expired/error flow is keyboard usable and responsive at representative mobile/desktop widths with accessible status announcements.
- [ ] AC9: Focused tests, full unit checks, lint, typecheck, formatting, production build and relevant browser checks pass.

## Validation plan

Use delivered fixtures for reservation-backed and open-gym arrival, too-early/valid/expired windows, Basic held/final/exhausted states, Classic available/same-day-used state, confirmed history and service failure. Verify repeated clicks/reloads preserve one operation, open-gym arrival holds and releases daily access correctly, and only confirmation changes confirmed usage. Exercise QR fallback, countdown/status announcements and controls by keyboard at mobile and desktop widths.

Run focused unit/component tests, `npm test`, lint, typecheck, formatting, the documented Webpack build, `git diff --check` and focused browser tests. Mock-only behavior cannot complete the ticket without DEV0084's persistent contract.

## Implementation record

Pending implementation. The original committed plan mixed reservation discovery with arrival. Review moved schedule/reserve/cancel to DEV0087 and retained only the member arrival/attendance presentation here.

### Changes and rationale

No implementation changes yet.

### Affected files

| File or component                              | Change and purpose                                                |
| ---------------------------------------------- | ----------------------------------------------------------------- |
| Pending `/my-access` arrival/client/test files | Present and recover the delivered short-lived attendance request. |

### Decisions and deviations

- 2026-09-27: Preserve DEV0085 because its planning record was already committed; narrow it to arrival code, pending confirmation, allowance and history under COR0008.
- 2026-09-28: Show DEV0086's shared daily-access claim as held for a reservation or pending open-gym arrival; only staff confirmation turns it into confirmed usage.
- 2026-09-28: DEV0087 completed the upcoming selected-gym schedule and persistent reservation controls. DEV0085 remains Draft only on DEV0084's arrival/attendance contract and will extend the delivered My Membership component boundary.

### Contracts, configuration, and operations

No migration or secret is planned. The browser consumes DEV0084's private member contract. A QR dependency, if required, must be reviewed and recorded before implementation.

## Validation results

Pending validation.

| Criterion | Evidence                                    | Result  |
| --------- | ------------------------------------------- | ------- |
| AC1–AC9   | Blocked on DEV0084; DEV0087 integration dependency is delivered | Not run |

## Risks, limitations, and follow-ups

The code helps staff find the correct request but does not prove presence by itself. The UI must discourage screenshots/reuse without implying that a QR is biometric or location proof. Actual confirmation remains a same-venue staff action.

## Completion and review references

- Completed: Not completed.
- Commit: Initial broad planning record committed in `f6bde9f`; split revision committed in `25d4842`; the daily-claim clarification is not yet committed.
- Review: Planning self-review completed; no independent review.
- Deployment or release: None.
