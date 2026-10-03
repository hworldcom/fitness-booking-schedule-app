# Ticket DEV0085: Add the member check-in interface

- Status: Completed
- Created: 2026-09-27
- Last updated: 2026-09-28
- Milestone: M3 check-ins, member-price access and allocation
- Coordination: [COR0008 — Membership reservations and check-ins](../organisatory/COR0008-membership-reservations-and-checkins.md)
- Related records: consumes arrival/attendance from completed [DEV0084 — Persist included membership check-ins](../backend/DEV0084-persist-included-membership-checkins.md), consumes upcoming reservations from completed [DEV0087 — Add the member class reservation interface](DEV0087-member-class-reservation-interface.md), depends transitively on completed [DEV0086 — Persist included class reservations](../backend/DEV0086-persist-included-class-reservations.md), and extends the active membership view delivered through [DEV0081](../blockchain/DEV0081-devnet-membership-activation.md); the original broad DEV0085 plan is preserved in commit `f6bde9f`

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

- Completed DEV0084 supplies the stable private request/read contract and completed DEV0087 supplies the upcoming reservation presentation this screen extends.
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

- [x] AC1: An active member can request arrival only for an eligible upcoming reservation or selected-core-gym open access; non-core/inactive/terminal cases expose no valid code.
- [x] AC2: The interface displays one server-issued QR/fallback code, exact gym/class context and 15-minute expiry without embedding personal or financial data.
- [x] AC3: Starting or repeating an action resumes one request and explicitly says gym confirmation is required.
- [x] AC4: Confirmed allowance and history change only after attendance; an open-gym request visibly holds daily access until confirmation, cancellation or expiry, and failure never appears completed.
- [x] AC5: Basic distinguishes held reservation/open-gym claims from confirmed usage; Classic shows no numerical allowance and does show the daily rule.
- [x] AC6: Same-browser reload/retry recovers the same pending/confirmed request without duplicate codes, history or automatic replacement submission; a lost raw value has an explicit cancel/expiry recovery path.
- [x] AC7: Member-safe history exposes no payment, wallet, staff-private or monetary-allocation data.
- [x] AC8: The full request/pending/confirmed/expired/error flow is keyboard usable and responsive at representative mobile/desktop widths with accessible status announcements.
- [x] AC9: Focused tests, full unit checks, lint, typecheck, formatting, production build and relevant browser checks pass.

## Validation plan

Use delivered fixtures for reservation-backed and open-gym arrival, too-early/valid/expired windows, Basic held/final/exhausted states, Classic available/same-day-used state, confirmed history and service failure. Verify repeated clicks/reloads preserve one operation, open-gym arrival holds and releases daily access correctly, and only confirmation changes confirmed usage. Exercise QR fallback, countdown/status announcements and controls by keyboard at mobile and desktop widths.

Run focused unit/component tests, `npm test`, lint, typecheck, formatting, the documented Webpack build, `git diff --check` and focused browser tests. Mock-only behavior cannot complete the ticket without DEV0084's persistent contract.

## Implementation record

The original committed plan mixed reservation discovery with arrival. Review moved schedule/reserve/cancel to DEV0087 and retained only the member arrival/attendance presentation here. The completed interface now consumes DEV0084's private snapshot and mutations on `/my-access`, while the server remains authoritative for eligibility, expiry and attendance.

### Changes and rationale

- `/my-access` loads the private check-in snapshot alongside membership and class-reservation state, then gives one client boundary the active policy, selected core gyms and current reservations.
- Active members can start an open-gym arrival for a selected gym or see the arrival state for a reserved class. The interface never offers an included action for an unknown/non-core venue, an inactive membership or a class outside the client-visible arrival window; DEV0084 still performs every authoritative check.
- The first successful creation renders the server-issued 43-character opaque value as an SVG QR and selectable fallback code. The QR payload is exactly that value: it contains no member, class, venue, payment or wallet metadata.
- The browser stores only the bounded presentation record in `sessionStorage`. Reload restores the same request and code; a missing value explains the cancel/expiry path instead of submitting a replacement. Polling reads status only and cancellation uses the existing explicit mutation.
- Pending, confirmed, expired and cancelled states use accessible live status text. Basic shows available, held and confirmed counts separately; Classic describes uncapped period access and the one-per-venue-local-day rule without inventing a balance. History contains confirmed attendance only.
- The completed DEV0087 schedule notifies the arrival panel after reservation mutations, so a newly reserved class appears without a full-page reload. This is a presentation bridge only; reservation ownership remains in DEV0087.
- The integrated rehearsal provisions disposable member/staff data, creates and reloads one QR, cancels it and proves the hold is released, creates another request and confirms it through the real same-venue database function, then proves private history/Basic usage and the existing reservation flow.

### Affected files

| File or component                               | Change and purpose                                                                                                                                                 |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/app/my-access/page.tsx`                    | Loads the server-side initial member check-in snapshot in parallel with the existing membership, catalogue and class schedule reads.                               |
| `src/features/membership/my-membership.tsx`     | Mounts the arrival panel for an active period and shares refreshed reservation state with it.                                                                      |
| `src/features/membership/member-checkin.tsx`    | Implements selected-gym/reserved-class actions, QR/fallback presentation, countdown, polling, cancellation, terminal states, plan policy and confirmed history.    |
| `src/features/membership/checkin-client.ts`     | Strictly validates private responses and owns same-origin requests, bounded `sessionStorage` recovery, arrival-window helpers and terminal reconciliation.         |
| `src/features/membership/class-schedule.tsx`    | Emits refreshed schedule state after reservation mutations without moving reservation logic into DEV0085.                                                          |
| `src/app/membership.css`                        | Adds responsive desktop/mobile layout, visible focus-compatible controls, QR card, policy, recovery, terminal and history styles.                                  |
| `tests/membership-checkin-client.test.ts`       | Covers strict parsing, first-response-only code handling, exact browser storage, time/terminal helpers and static privacy/presentation boundaries.                 |
| `scripts/rehearse-local-class-reservations.mjs` | Extends the real Auth/database/Chrome rehearsal across arrival creation, reload, cancel, staff confirmation, history, allowance, keyboard and responsive behavior. |
| `package.json` and `package-lock.json`          | Pin `qrcode.react@4.2.0` and expose the integrated rehearsal as `npm run test:checkins`.                                                                           |

### Decisions and deviations

- 2026-09-27: Preserve DEV0085 because its planning record was already committed; narrow it to arrival code, pending confirmation, allowance and history under COR0008.
- 2026-09-28: Show DEV0086's shared daily-access claim as held for a reservation or pending open-gym arrival; only staff confirmation turns it into confirmed usage.
- 2026-09-28: DEV0087 completed the upcoming selected-gym schedule and persistent reservation controls. DEV0085 remains Draft only on DEV0084's arrival/attendance contract and will extend the delivered My Membership component boundary.
- 2026-09-28: DEV0084 completed the server-generated presentation-code, member snapshot/create/cancel and same-venue staff-confirmation contract. DEV0085 is now Ready; its browser must retain `presentationCode` only from the first `created` response and use `sessionStorage` for same-tab recovery.
- 2026-09-28: Implementation started after reviewing the delivered DEV0084/DEV0087 contracts and Next.js 16's server/client boundary. The server-rendered page will supply the initial private snapshot; one narrowly scoped Client Component will own browser mutations, countdown/polling and `sessionStorage` recovery.
- 2026-09-28: Use the small ISC-licensed `qrcode.react` package, pinned to version `4.2.0`, to render the opaque 43-character presentation value as an accessible SVG QR. Its upstream documentation recommends SVG for flexibility and supports a required four-module quiet margin plus a title. The dependency encodes only the already-present browser value; it performs no network request and receives no member, venue, class, wallet or payment metadata.
- 2026-09-28: The active membership snapshot identifies selected gyms by slug while DEV0084 creates requests with persistent venue UUIDs. The interface resolves those IDs only from the private selected-gym schedule already delivered by DEV0087. Every seeded demo core gym is represented; if that private venue data is unavailable, the button is disabled instead of guessing an identifier.
- 2026-09-28: Client time gates the obvious reserved-class button state and countdown for usability, but it grants no authority. The create/read endpoints apply server time, expiry, reservation and daily-access rules, so clock skew can only lead to a refused action or a conservative disabled button.

### Contracts, configuration, and operations

No migration, secret or API-contract changed. The browser consumes DEV0084's private member contract. `qrcode.react@4.2.0` is the only new runtime dependency; it renders a local SVG from the opaque presentation code and does not persist or transmit that value. The only browser persistence is one versioned `sessionStorage` record containing the request ID, operation ID, raw presentation code and expiry; it is explicitly cleared at terminal state.

## Validation results

| Criterion     | Evidence                                                                                                                                                                                                                                                                                                                                                                                                 | Result |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1–AC7       | `node --import tsx --test tests/membership-checkin-client.test.ts`: 5/5 passed. Strict response/storage tests reject expanded or malformed state; static presentation checks preserve held/confirmed language and private history boundaries.                                                                                                                                                            | Passed |
| AC1–AC8       | `npm run test:checkins`: passed against local Supabase Auth/database and compiled Next.js in Chrome. The disposable flow created one open-gym request by keyboard, displayed QR/fallback/countdown, recovered the same code after reload, cancelled and released its hold, created a different code, confirmed it as same-venue staff, updated Basic from held to confirmed, and showed private history. | Passed |
| AC1, AC4, AC8 | The same integrated rehearsal reserved, reloaded and cancelled a future included class after the arrival changes; it also verified keyboard activation and no horizontal overflow at 1440×1040 and 393×852. QR-panel screenshots `test-results/dev0085-desktop-qr.png` and `test-results/dev0085-mobile-qr.png` were visually reviewed; generated files remain ignored.                                  | Passed |
| AC9           | `npm test`: 92/92 passed.                                                                                                                                                                                                                                                                                                                                                                                | Passed |
| AC9           | `npm run lint`; `npm run typecheck`; `npm run format:check`; `git diff --check`: passed.                                                                                                                                                                                                                                                                                                                 | Passed |
| AC9           | `npm run build`: production Next.js 16 build passed and emitted `/my-access` plus the member/staff check-in routes.                                                                                                                                                                                                                                                                                      | Passed |

## Risks, limitations, and follow-ups

The code helps staff find the correct request but does not prove presence by itself; the interface states this explicitly. Actual confirmation remains a same-venue staff action, and a polished staff scanner/workspace is a later COR0007 ticket. The demo schedule supplies persistent venue IDs for all selected seeded gyms; if the schedule service is unavailable, open-gym creation is deliberately disabled rather than deriving or exposing internal IDs from public catalogue data.

## Completion and review references

- Completed: 2026-09-28.
- Commit: Initial broad planning record committed in `f6bde9f`; split revision committed in `25d4842`; implementation committed in `b65ae5a` together with the overlapping DEV0090 follow-up.
- Review: Implementation self-review and responsive visual review completed; no independent review.
- Deployment or release: None.
