# Coordination COR0008: Membership reservations and check-ins

- Status: Completed
- Created: 2026-09-27
- Last updated: 2026-09-28
- Milestone: M3 check-ins, member-price access and allocation
- Converted from: Not applicable — created after the committed DEV0084 planning record required multiple implementation boundaries
- Tracked development tickets: completed [DEV0084 — Persist included membership check-ins](../backend/DEV0084-persist-included-membership-checkins.md), completed [DEV0085 — Add the member check-in interface](../frontend/DEV0085-member-checkin-interface.md), completed [DEV0086 — Persist included class reservations](../backend/DEV0086-persist-included-class-reservations.md), completed [DEV0087 — Add the member class reservation interface](../frontend/DEV0087-member-class-reservation-interface.md), and completed [DEV0088 — Seed fictional demo class schedules](../backend/DEV0088-seed-fictional-demo-class-schedules.md)
- Related records: delivers the reservation/member-attendance slice required by [COR0007 — Core multi-gym membership MVP](./COR0007-core-multigym-membership-mvp.md); follows the active membership foundation in completed [DEV0080](../backend/DEV0080-membership-activation-foundation.md) and current [DEV0081](../blockchain/DEV0081-devnet-membership-activation.md); later gym operations, provisional monetary allocation, non-core visits and social publication remain outside this coordination record

## Objective and boundaries

Coordinate the member journey from an eligible class reservation through staff-confirmed attendance without conflating seat holding, allowance holding, physical presence or gym allocation. A member may reserve a scheduled class at one of the four gyms frozen into an active membership, then present a short-lived arrival code at the gym. Only authorized same-venue staff confirmation consumes the held Basic use or records Classic attendance.

This record excludes direct non-core payments, monetary allocation calculation, gym payout, the gym staff workspace, social sharing and production cancellation economics. Open-gym attendance may use DEV0084's venue-only arrival path without inventing a class reservation. Reservation and attendance records remain private until a later social ticket explicitly publishes confirmed evidence.

### Deeper coordination exception

COR0007 already coordinates the full multi-gym MVP. DEV0084 and DEV0085 were committed there as broad planning records before review exposed independent backend/frontend reservation and attendance boundaries. Repository policy therefore requires preserving those DEV records rather than converting or reusing their identifiers. COR0008 is the narrow second-level exception that owns the five peer tickets below; COR0007 treats the completed COR0008 outcome as one delivery dependency and does not duplicate their implementation ownership.

## Direct development work

| Implementation part                | Development ticket                                                                                                          | Owned deliverable                                                                                                                                 | Start condition or dependency                                                                        |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Demo schedule fixtures             | Completed [DEV0088 — Seed fictional demo class schedules](../backend/DEV0088-seed-fictional-demo-class-schedules.md)        | Original two-week class/session fixtures and fictional trainer affiliations across all seven participating gyms                                   | Delivered; validated fixture identities, activity taxonomy and current fixed schedule dates          |
| Reservation persistence and rules  | Completed [DEV0086 — Persist included class reservations](../backend/DEV0086-persist-included-class-reservations.md)        | Member-scoped scheduled-class reservation, atomic capacity, shared daily claims, cancellation/no-show and retry behavior                          | Delivered and validated against DEV0088's schedule                                                   |
| Member reservation interface       | Completed [DEV0087 — Add the member class reservation interface](../frontend/DEV0087-member-class-reservation-interface.md) | Eligible selected-gym class discovery, reserve/cancel actions and upcoming reservation state                                                      | Delivered against DEV0086 with desktop/mobile Auth/database rehearsal                                |
| Arrival and attendance persistence | Completed [DEV0084 — Persist included membership check-ins](../backend/DEV0084-persist-included-membership-checkins.md)     | Short-lived venue/reservation-bound arrival requests, same-venue staff confirmation, daily/allowance consumption and immutable private attendance | Delivered and validated over DEV0086's reservation/daily-claim transitions                           |
| Member arrival interface           | Completed [DEV0085 — Add the member check-in interface](../frontend/DEV0085-member-checkin-interface.md)                    | QR/code presentation, pending confirmation, confirmed history and accurate remaining allowance                                                    | Delivered with one integrated Auth/database/Chrome rehearsal across reservation and arrival behavior |

Each implementation boundary belongs to exactly one peer. DEV0086 owns reservation seats and the shared daily-access claim contract but never attendance. DEV0084 consumes or releases those claims and creates venue-only claims, but never creates a class reservation. DEV0087 never claims physical presence, and DEV0085 never grants staff authority.

## Other relationships

- [COR0007](./COR0007-core-multigym-membership-mvp.md) consumes this coordinated outcome as one M3 delivery dependency but does not directly own DEV0084–DEV0087.
- Completed [DEV0080](../backend/DEV0080-membership-activation-foundation.md) and current [DEV0081](../blockchain/DEV0081-devnet-membership-activation.md) supply the active membership period required before reservation or arrival.
- A later gym-operations ticket will present DEV0084's staff confirmation action; it will not redefine staff authority or attendance transitions.
- Provisional monetary allocation, direct non-core visits and optional social publication consume confirmed attendance later and remain outside this record.

## Delivery order and integration conditions

1. DEV0088 turns the user-supplied research into original, fictional trainer and class fixtures with a fixed current demo anchor.
2. DEV0086 then defines the reservation state machine and atomic capacity/daily-claim contract against those sessions.
3. DEV0087 may start after that member contract stabilizes. DEV0084 may start in parallel after the reservation transition used by check-in is fixed.
4. DEV0085 starts after DEV0084's arrival request/read shape is stable and integrates DEV0087's upcoming reservation state.
5. Integration proves one Basic reservation holds but does not consume access, same-venue staff confirmation consumes it exactly once, cancellation/no-show releases it without attendance, and Classic never gains a fabricated numerical allowance.

Complete COR0008 only when all five direct tickets are Completed or explicitly Cancelled/replaced and the integrated member flow preserves capacity, daily rules, allowance, privacy and retry safety. The later gym staff interface may drive the delivered confirmation endpoint, but it does not own or redefine these state transitions.

## Progress and integration record

- 2026-09-27: Review of committed DEV0084 found that advance reservation, arrival proof, attendance, member presentation and unresolved monetary allocation should not ship as one ticket.
- 2026-09-27: The user confirmed that classes must be reservable before arrival and accepted the separation between a durable advance reservation and a short-lived venue-bound arrival code.
- 2026-09-27: For the hackathon, cancelling before a session or reconciling a no-show releases the Basic allowance hold; neither creates attendance, allocation input or a fee. Production penalties remain unresolved.
- 2026-09-27: Monetary provisional allocation moved out of DEV0084. Confirmed attendance is an auditable future input, while allocation scope and Classic economics remain a later product decision.
- 2026-09-27: Attendance authority is the authenticated account plus an active same-venue `manager` or `check_in_staff` relation. Club-wallet proof is financial authority and is not required to confirm physical presence.
- 2026-09-28: Reservation uses only `reserved`, `cancelled`, `checked_in` and `no_show`; cancellation records member/session reason, while `expired` remains an arrival-request state.
- 2026-09-28: A shared `held`/`consumed`/`released` daily-access claim serializes class reservations and open-gym attendance. DEV0086 remains Draft pending user-supplied demo class/trainer data.
- 2026-09-28: The user supplied public schedule research. DEV0088 owns transforming its general cadence into original fictional fixtures; no real business identity or copied catalogue content enters tracked data.
- 2026-09-28: DEV0088 completed and validated 42 sessions, six per participating gym, with nine fictional trainer affiliations and no tracked source identities. DEV0086 is unblocked and Ready.
- 2026-09-28: DEV0086 completed the private capacity-safe reservation and shared daily-claim contract. DEV0087 completed the My Membership schedule with persistent reserve/reload/cancel behavior, honest Basic holds and responsive keyboard validation. Attendance remains deliberately unimplemented until DEV0084/DEV0085.
- 2026-09-28: DEV0084 readiness review adopted server-generated opaque arrival codes, a 15-minute code lifetime, lazy expiry and a hackathon class-arrival window from 30 minutes before start through class end. Backend implementation started.
- 2026-09-28: DEV0084 completed the private arrival/attendance boundary. Clean replay, 35 database integration checks, 168 pgTAP assertions, 87 unit tests and static/build validation pass; DEV0085 is unblocked and Ready.
- 2026-09-28: DEV0085 implementation started. Its browser boundary will receive the initial private server snapshot, render only the server-issued opaque value as a QR/fallback code, and poll the existing member read endpoint for confirmation or lazy expiry without adding staff authority.
- 2026-09-28: DEV0085 completed the member arrival interface. One disposable local Auth/database/Chrome rehearsal now spans short-lived QR creation, same-tab reload, cancellation/hold release, same-venue staff confirmation, Basic consumption/private history and the existing reserve/reload/cancel flow at desktop/mobile widths.

## Validation and integration evidence

Planning consistency checks must confirm reciprocal COR/DEV links, unique record IDs, explicit dependencies and no duplicated ownership in COR0007. Each DEV ticket owns its detailed implementation evidence. Final integration must cover reservation, cancellation, no-show, arrival-code expiry, wrong-venue staff, repeated confirmation, Basic final-use concurrency, Classic daily enforcement and reload/retry behavior.

DEV0086 records clean migration, 156 pgTAP assertions, 30 database integration checks, concurrency/terminal-state evidence and static/build validation. DEV0087 records 82 unit checks plus a disposable desktop/mobile Chrome rehearsal against real local Auth and persistence. DEV0084 records clean migration, 168 total pgTAP assertions, 35 database integration checks, 87 unit tests and atomic Basic/Classic staff-confirmation evidence. DEV0085 records 92 unit checks plus the final integrated local Auth/database/Chrome rehearsal: reservation holds remain distinct from attendance, cancelling an arrival releases its hold, same-venue staff confirmation consumes the Basic visit exactly once, only confirmed attendance enters private history, reload reuses the same opaque code, and the member interface remains keyboard usable and responsive.

## Risks, limitations, and follow-ups

The 15-minute arrival lifetime, 30-minute pre-class arrival window and no-penalty cancellation/no-show policy are bounded hackathon choices, not validated production policy. DEV0086 reconciles an untouched reservation to `no_show` after class end without requiring a background worker; DEV0084 similarly reconciles arrival expiry lazily. The gym-facing workspace is intentionally absent from this record, so the delivered backend authority precedes a polished staff interface.

## Completion and review references

- Completed: 2026-09-28. All five direct development tickets are Completed and the integrated member flow passed.
- Direct development tickets: DEV0084, DEV0085, DEV0086, DEV0087 and DEV0088 Completed.
- Commit: The initial split was recorded in development-ticket commit `25d4842`; coordination-record IDs are not used in commit subjects. The lifecycle/daily-claim revision is not yet committed.
- Review: Coordination and integration self-review completed; no independent review.
- Deployment or release: None.
