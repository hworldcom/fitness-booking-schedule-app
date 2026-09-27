# Ticket DEV0085: Add the member check-in interface

- Status: Draft
- Created: 2026-09-27
- Last updated: 2026-09-27
- Milestone: M3 check-ins, member-price access and allocation
- Coordination: [COR0007 — Core multi-gym membership MVP](../organisatory/COR0007-core-multigym-membership-mvp.md)
- Related records: consumes the persistent operation and read contracts from [DEV0084 — Persist included membership check-ins](../backend/DEV0084-persist-included-membership-checkins.md), extends the active membership view delivered through [DEV0081 — Activate memberships with Devnet EURC](../blockchain/DEV0081-devnet-membership-activation.md), and precedes the separate gym-operations interface and [DEV0023 — Minimal shared activity feed](../backend/DEV0023-minimal-shared-activity-feed.md)

## Objective and context

Make an activated membership understandable and usable from the existing `/my-access` compatibility route. A member should see where included access is valid, request a check-in at one selected gym, understand that attendance is waiting for gym confirmation, and see accurate remaining allowance, daily availability and confirmed history after the backend records the visit.

This ticket owns the member-facing portion of [the My Membership screen](../../../docs/mvp-spec.md#5-roles-screens-and-fixtures), [included check-ins](../../../docs/mvp-spec.md#74-included-check-ins), M3 and acceptance scenarios A05–A11/A22/A24. It must not present a member click as verified attendance.

## Scope and non-goals

- In scope: active-period allowance summary; selected-core-gym access cards; a member check-in request/resume action; pending/confirmed/rejected/expired states; clear gym-confirmation language; Basic remaining uses; Classic uncapped-period and daily-limit language; venue-local daily availability; private confirmed history; reload/retry recovery; bounded loading/empty/unavailable states; responsive and keyboard-accessible behavior.
- Out of scope: gym-staff confirmation UI; reservations/class discovery; direct €15 non-core checkout; social sharing controls/feed publication; final/provisional gym payout presentation; membership activation/payment changes; editing selected gyms; transfers; passes; events; challenges; reactions; and notifications.

## Expected behavior and edge cases

An active member sees the frozen period, plan, four selected gyms and accurate usage state. Basic reads, for example, “9 of 10 included check-ins remaining” after one confirmed visit. Classic says that included visits are uncapped for the period while clearly retaining the one-included-check-in-per-venue-local-day rule; it never displays a made-up numerical balance.

Selecting an eligible core gym creates or resumes one backend operation and displays “Waiting for gym confirmation.” Reloading or repeating the action recovers that operation rather than producing another attendance attempt. Only a server-confirmed result moves into history or changes allowance. Rejected, expired, wrong-day and unavailable states explain what happened without claiming a visit.

Non-core gyms do not show the included check-in action. A stale catalogue, inactive membership, backend failure or conflicting pending request fails honestly and preserves previously confirmed history. The interface exposes no payment details, private wallet data or provisional gym allocation.

## Assumptions, decisions, and dependencies

- DEV0084 owns the source of truth and must stabilize its bounded member read/mutation contract before this ticket moves to Ready.
- `/my-access` remains the route; renaming it is unrelated scope.
- The member initiates a gym-level access request. Optional session/reservation selection is shown only if DEV0084 returns a capacity-managed requirement; the UI does not restore the removed Classes product.
- Pending attendance remains private. Social sharing belongs to DEV0023 and can only consume confirmed evidence later.
- Status refresh may use explicit refresh or bounded polling based on the delivered server contract. It must stop after a terminal state and must never create replacement operations automatically.

## Implementation plan

1. Review DEV0084's delivered member snapshot and operation contract; move this ticket to Ready after its fields and recovery semantics are stable.
2. Extend the active `/my-access` screen with allowance/daily-policy presentation, selected-gym actions and honest pending/terminal states while preserving the current activation evidence.
3. Add a bounded browser client for create/resume/read behavior and reload recovery; keep confirmed server data authoritative over local UI state.
4. Add a private check-in history with gym, service date and confirmation state, excluding financial and staff-private fields.
5. Add focused component/domain tests and desktop/mobile keyboard browser coverage, then run the full static/unit/build validation appropriate to the touched interface.

## Acceptance criteria

- [ ] AC1: An active Basic member sees an accurate remaining count out of ten; an active Classic member sees no numerical monthly allowance and does see the daily rule.
- [ ] AC2: Exactly the four frozen core gyms expose included-access actions; non-core, inactive or ineligible gyms cannot start an included check-in.
- [ ] AC3: Starting or repeating an action creates or resumes one stable operation and shows a pending state that explicitly requires gym confirmation.
- [ ] AC4: Allowance and history change only after the backend returns confirmed attendance; rejection, expiry, conflict and service-unavailable states never appear as a completed visit.
- [ ] AC5: Reload and retry recover the same pending/confirmed operation without duplicate visible history or automatic replacement submission.
- [ ] AC6: Confirmed private history shows only member-safe gym/date/status information and exposes no payment details, wallet data, staff-private data or provisional allocation.
- [ ] AC7: The complete active/pending/confirmed/error flow is usable by keyboard and at representative mobile and desktop widths without overflow, hidden controls or inaccessible status changes.
- [ ] AC8: Focused tests, full unit checks, lint, typecheck, formatting, production build and relevant browser checks pass.

## Validation plan

Use deterministic DEV0084 fixtures for Basic 10/10, Basic 1/10, Basic exhausted, Classic available, same-day unavailable, pending, confirmed, rejected, expired and service-unavailable states. Verify repeat clicks/reloads retain one operation, history keys remain unique and only confirmation changes the displayed allowance. Exercise all controls and status announcements by keyboard at mobile and desktop widths. Confirm a signed-out visitor still receives the existing protected-access behavior.

Run focused unit/component tests, `npm test`, lint, typecheck, formatting, the documented Webpack production build, `git diff --check` and focused browser tests. Record DEV0084 as a blocking dependency if its contract or fixtures are not yet available; mocked success alone cannot complete the ticket.

## Implementation record

Pending implementation. DEV0085 remains Draft until DEV0084 stabilizes the member operation/snapshot contract.

### Changes and rationale

No implementation changes yet.

### Affected files

| File or component                              | Change and purpose                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------------------ |
| Pending `/my-access` feature/client/test files | Present and recover the persistent included-check-in lifecycle for the member. |

### Decisions and deviations

- 2026-09-27: Keep staff confirmation out of the member interface. The member requests access; the gym remains the attendance authority.
- 2026-09-27: Keep the current `/my-access` route to avoid an unrelated compatibility migration.

### Contracts, configuration, and operations

No data migration, secret or new dependency is planned. The browser contract will consume DEV0084's private member endpoints and will be recorded exactly during implementation.

## Validation results

Pending validation.

| Criterion | Evidence                                       | Result  |
| --------- | ---------------------------------------------- | ------- |
| AC1–AC8   | Blocked on DEV0084 contract and implementation | Not run |

## Risks, limitations, and follow-ups

Without the later staff workspace, a real user-facing pending request still needs a service/API rehearsal to receive confirmation. This ticket must not add a demo-only self-confirm button because that would undermine attendance authority. Direct non-core visits and explicit social sharing remain separate follow-ups.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: Planning self-review completed; no independent review.
- Deployment or release: None.
