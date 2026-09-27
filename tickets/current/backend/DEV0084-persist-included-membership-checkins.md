# Ticket DEV0084: Persist included membership check-ins

- Status: Ready
- Created: 2026-09-27
- Last updated: 2026-09-27
- Milestone: M3 check-ins, member-price access and allocation
- Coordination: [COR0007 — Core multi-gym membership MVP](../organisatory/COR0007-core-multigym-membership-mvp.md)
- Related records: builds on the membership-period foundation in [DEV0080 — Persist membership activation foundation](../../archive/backend/DEV0080-membership-activation-foundation.md), consumes the active membership produced through [DEV0081 — Activate memberships with Devnet EURC](../blockchain/DEV0081-devnet-membership-activation.md), depends on the gym-staff authority boundary in [DEV0041 — Club wallet authorization](DEV0041-club-wallet-authorization.md), supplies the read/mutation contract for [DEV0085 — Add the member check-in interface](../frontend/DEV0085-member-checkin-interface.md), and replaces the relevant access assumptions from cancelled [DEV0018 — Class-pass reservations and confirmed visits](../../archive/backend/DEV0018-class-pass-reservations-and-confirmed-visits.md)

## Objective and context

Turn an active Basic or Classic membership into usable included gym access. A member needs a stable request for one of the four gyms frozen into the active period, but participation and allowance must change only after an authorized representative of that gym confirms the member's presence. The backend must enforce the frozen plan terms atomically and expose private member history plus transparent provisional-allocation inputs.

This ticket owns the persistent domain and server boundary described by [included check-ins](../../../docs/mvp-spec.md#74-included-check-ins), [provisional allocation](../../../docs/mvp-spec.md#75-provisional-allocation), M3 and acceptance scenarios A05–A13/A24. It does not make a browser action or reservation alone count as attendance.

## Scope and non-goals

- In scope: stable actor-owned included-check-in operations; active-period and selected-gym validation; optional capacity-managed session/reservation linkage; venue-local service dates; authorized same-gym staff confirmation; Basic ten-use enforcement; Classic uncapped-period usage without a fabricated allowance; the shared one-included-check-in-per-local-day rule; duplicate, expiry and concurrency protection; immutable confirmed attendance evidence; member-scoped check-in history and allowance state; gym-scoped attendance/allocation read models; deterministic provisional-allocation inputs and unresolved pool value; migrations, repository/services, bounded routes and database/domain tests.
- Out of scope: the member browser interface owned by DEV0085; the staff workspace UI; direct €15 non-core visits; social sharing/feed publication; final or claimable gym payout; pool withdrawal; refunds; production economics; catalogue editing; a new public class marketplace; and generic manual mutation of confirmed attendance.

## Expected behavior and edge cases

A signed-in member with one active period can create or resume one stable check-in request for one of that period's four selected gyms. The request is private and pending until staff authority is derived by the server and an authorized representative for that same gym confirms presence. A request associated with a capacity-managed session must hold a valid reservation and consume at most one seat; an ordinary gym-access request has no invented class reservation.

Confirmation uses the gym's configured IANA timezone to derive the service date. Basic confirmation increments usage once and rejects an eleventh included visit. Classic records each valid visit without creating or decrementing a synthetic monthly balance. Both plans reject a second included check-in on the same venue-local calendar day. An expired membership, wrong gym, wrong staff authority, stale/expired reservation, exhausted Basic period, duplicate identifier or concurrent conflicting attempt changes neither usage nor allocation.

Successful confirmation creates immutable attendance evidence and one allocation input for the confirmed gym. Member reads show pending and confirmed check-ins, remaining Basic allowance or the Classic daily policy, and daily availability. Gym reads are restricted to that gym. Provisional allocation identifies its period, distributable test pool and usage scope; zero-use and unused value remain unresolved and are never labeled revenue, payout or claimable balance.

## Assumptions, decisions, and dependencies

- The snapshotted membership-period terms, not the current catalogue version, determine plan limits.
- PostgreSQL is the transactional authority for the hackathon check-in lifecycle. Authenticated, persisted staff confirmation supplies the attendance proof; this ticket does not add a Solana transaction for every gym visit.
- A check-in operation receives a stable UUID before external retry. Retries return the existing state and cannot double-count attendance, allowance, capacity or allocation.
- Gym and membership identifiers come from actor-scoped server state. Browser input may identify the target selected gym and a bounded optional session, but cannot assert staff role, plan, allowance, price, period owner or confirmation time.
- DEV0041's implemented server authority contract is required for real staff confirmation. Missing or expired club authority fails closed; it does not block schema/domain work or deterministic tests.
- The existing session schema may support optional capacity-bound attendance, but this ticket does not restore the removed public Classes product. Any incompatible legacy shape must be adapted by an additive migration rather than reviving class passes.

## Implementation plan

1. Define the included-check-in operation, status transitions, attendance evidence and allocation-input contract against existing membership-period, venue, optional session/reservation and organization-authority data.
2. Add additive migrations and Drizzle mappings with actor/gym scoping, immutable confirmation evidence, unique daily/operation constraints and atomic confirmation functions that serialize final-seat and final-Basic-use races.
3. Add member request/current/history services and routes plus an internal staff-confirmation boundary that derives the authorized gym from server state.
4. Add member and gym read projections for allowance, daily availability, attendance and explicitly provisional allocation inputs/unresolved value; do not expose another member's or gym's private data.
5. Add database integration and domain/boundary coverage for Basic, Classic, timezone, capacity, idempotence, authorization and concurrency cases; replay migrations and seed data cleanly.

## Acceptance criteria

- [ ] AC1: An active member can create or resume an idempotent pending included-check-in request only for one of the four gyms frozen into that membership period.
- [ ] AC2: Only server-derived authorized staff for the requested gym can confirm presence; member action, wrong-gym staff, stale authority, an expired period or an invalid reservation cannot create attendance.
- [ ] AC3: Basic confirms at most ten included check-ins and rejects an eleventh without changing usage, capacity or allocation; concurrent final-use attempts produce at most one success.
- [ ] AC4: Classic records valid check-ins without a numerical monthly allowance, while Basic and Classic both reject a second included check-in on the same venue-local service date.
- [ ] AC5: Optional capacity-managed reservations are unique and atomic; stale, cancelled, expired, full-session and concurrent final-seat attempts cannot overbook or confirm invalid attendance.
- [ ] AC6: A successful confirmation creates exactly one immutable attendance record and one gym allocation input; retries and duplicate identifiers return the existing result without double effects.
- [ ] AC7: Member reads expose only that actor's pending/history/allowance state, gym reads expose only that gym's attendance/allocation state, and unshared check-ins remain absent from social queries.
- [ ] AC8: Provisional allocation inputs reconcile to a declared period/pool/scope, retain unused value as unresolved and make no final-payout, revenue or withdrawal claim.
- [ ] AC9: Forward and clean migration replay, database/domain/authorization/concurrency tests, lint, typecheck, formatting and the production build pass.

## Validation plan

Use deterministic clocks around venue-local midnight and separate actor/staff contexts. Exercise Basic uses one through eleven, repeated and concurrent operation IDs, Classic across and within local service dates, wrong/non-core gyms, expired periods, wrong-gym staff, authority expiry, optional reservation state and final-seat races. Assert both the successful row set and the absence of partial usage/allocation/capacity mutations for every rejection. Verify row-level and service-level member/gym isolation with at least two members and two gyms.

Run forward local migration, clean migration/seed replay, pgTAP or equivalent constraint checks, focused database integration tests, the full unit suite, lint, typecheck, formatting, database lint, production build and `git diff --check`. Browser checks are not required for this backend ticket; DEV0085 and the later staff-interface ticket own responsive interaction evidence.

## Implementation record

Pending implementation. The ticket was reviewed as one backend vertical slice because its operation state, allowance mutation, attendance evidence and allocation input must commit atomically. Member presentation and gym-staff presentation remain separate frontend peers.

### Changes and rationale

No implementation changes yet.

### Affected files

| File or component                     | Change and purpose                                                                 |
| ------------------------------------- | ---------------------------------------------------------------------------------- |
| Pending migration/domain/server files | Add the reviewed persistent included-check-in and provisional-allocation boundary. |

### Decisions and deviations

- 2026-09-27: Keep confirmation off-chain for the hackathon and rely on server-derived gym authority plus immutable PostgreSQL evidence. Activation and direct payments retain their separate Solana verification boundaries.
- 2026-09-27: Permit an optional capacity-managed session rather than requiring every gym visit to pretend to be a class reservation. This preserves the current gym-access product while still enforcing capacity atomically when a session is present.

### Contracts, configuration, and operations

Planned additive database and private HTTP contracts are described above. No new secret, wallet key or public catalogue mutation is planned. Exact migration and rollback implications will be recorded during implementation.

## Validation results

Pending validation.

| Criterion | Evidence            | Result  |
| --------- | ------------------- | ------- |
| AC1–AC9   | Not yet implemented | Not run |

## Risks, limitations, and follow-ups

Provisional allocation is an explanatory accounting view, not a settlement system. Staff UI remains unimplemented until a later frontend ticket, so DEV0084 can prove its confirmation boundary through service/database integration before the full operator flow exists. DEV0085 may start its read/pending states after the bounded member contract stabilizes, but it cannot claim confirmed end-to-end attendance until DEV0084 is delivered.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: Planning self-review completed; no independent review.
- Deployment or release: None.
