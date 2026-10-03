# Ticket DEV0103: Adopt the private-class booking contract

- Status: Completed
- Created: 2026-10-03
- Last updated: 2026-10-03
- Milestone: Coach-first booking-contract correction
- Coordination: [COR0009 — Coach-first private-class booking MVP](../../current/organisatory/COR0009-coach-first-training-package-mvp.md)
- Related records: corrects the package-only contract adopted by [DEV0094 — Adopt the coach-first training-package MVP](../../archive/organisatory/DEV0094-adopt-coach-first-training-package-mvp.md); revises DEV0095–DEV0100 and creates direct COR0009 peers for weekly availability, private-class booking and hosted integration

## Objective and context

Correct the coach-first product contract after the user confirmed that private-class booking is a core feature rather than an external arrangement. A coach must publish availability for the coming week, a client must book one private slot, and the client must pay with test USDC by buying either a one-session or ten-session coach pass. Cancelling a booking keeps the purchased session available for another booking; only a completed class consumes one on-chain session.

The current specification explicitly excludes scheduling and says sessions are arranged outside MovX. That no longer represents the confirmed product. This ticket owns the contract, milestone and work-map correction before availability, booking or replacement package-program implementation begins.

## Scope and non-goals

- In scope: revise the MVP specification and README around coach-owned weekly availability, capacity-one private slots, one-session and ten-session offers, temporary slot holds during purchase, pass-backed confirmed bookings, cancellation without credit loss, completed-class redemption and honest cross-chain recovery; revise DEV0095–DEV0100 where their behavior or dependencies change; add direct COR0009 development tickets for availability, booking and the hosted end-to-end rehearsal; update COR0009 and the ticket index.
- Out of scope: implementing routes, database migrations, Solana instructions, wallet transactions, deployment or real scheduling behavior; adding group capacity, recurring calendar rules, no-show charges, refunds, disputes, messaging or production payments; rewriting completed DEV0094/DEV0101 history.

## Expected behavior and edge cases

The updated contract must describe one coherent flow. A guest discovers a coach and the coach's available private slots. A client selects an open slot and either uses an eligible existing pass or purchases a one-session or ten-session offer with test USDC. A purchase-time hold prevents ordinary double booking without treating an unfinalized payment as a confirmed booking. If chain payment finalizes but booking confirmation is interrupted, reconciliation preserves the purchased pass and either confirms the still-valid hold or leaves the session available for another slot.

A confirmed future booking reserves one pass session off-chain so a client cannot overbook the pass balance. Booking and cancellation do not decrement the authoritative on-chain remaining balance. Client or coach cancellation before the scheduled start releases the reservation while the pass credit remains available. A client-cancelled, still-valid slot reopens; a coach-cancelled slot is withdrawn. Only coach confirmation of a completed booked class invokes the on-chain redemption that decrements exactly one session.

## Assumptions, decisions, and dependencies

- Confirmed by the user on 2026-10-03: weekly coach availability and customer booking are core MVP behavior; clients may buy one-session or ten-session passes with test USDC; cancellation keeps the class/session credit available.
- MVP availability uses explicit capacity-one slots rather than recurring-rule expansion. The user-facing horizon is the coming week; the owning availability ticket must adopt exact rolling-window and timezone bounds before implementation.
- Passes are coach-specific. A one-session purchase creates the same kind of non-transferable TrainingPass as a ten-session purchase, with an initial balance of one rather than ten.
- PostgreSQL is authoritative for availability, temporary holds and bookings. Solana is authoritative for Offer terms, payment-coupled TrainingPass creation and remaining sessions.
- Confirmed bookings reserve credits off-chain against the latest finalized on-chain balance. Redemption occurs only after completion, so cancellation requires no on-chain refund or balance restoration.
- Existing wallet-replacement, coach-role, payment-recipient and test-USDC configuration findings remain separate decisions that must be resolved by their owning tickets before chain implementation.

## Implementation plan

1. Update the specification's confirmed decisions, actors, flows, state model, authority boundaries, definition of done, milestones, acceptance matrix and judge demo.
2. Update README product/status summaries so private-class booking is core and scheduling is no longer described as deferred.
3. Revise DEV0095–DEV0100 scope, dependencies and acceptance criteria where availability, booking, offer sizes or completed-booking redemption changes their contract.
4. Create peer tickets for weekly capacity-one availability, pass-backed private-class booking and the hosted integrated rehearsal, with reciprocal COR0009 links and non-overlapping ownership.
5. Update COR0009's work map, delivery sequence, completion conditions and progress record, then update the root ticket index.
6. Run formatting, local Markdown-link, identifier/status/index and terminology consistency checks; review the resulting work map against every required implementation boundary.

## Acceptance criteria

- [x] AC1: The current specification and README define weekly private-class discovery/booking, one-session and ten-session test-USDC passes, credit reservation, cancellation-with-credit-retained and completed-class redemption without contradictory scheduling exclusions.
- [x] AC2: DEV0095–DEV0100 reflect the corrected booking flow and retain focused, non-overlapping ownership.
- [x] AC3: Direct development tickets own weekly availability, pass-backed booking and the hosted integrated rehearsal, and COR0009 maps every delivery boundary with explicit dependencies.
- [x] AC4: Current work records distinguish authoritative on-chain pass balance from off-chain future-booking reservations and define safe payment/booking recovery without inventing refunds or entitlement.
- [x] AC5: Repository-local links, IDs, statuses, index rows, formatting and terminology checks pass with no runtime implementation change.

## Validation plan

Search current product documents and work records for scheduling, external arrangement, booking, class, cancellation, refund, one-session/ten-session and redemption claims. Check all local Markdown targets, unique DEV/COR IDs, reciprocal COR membership, current/archive placement and ticket-index rows. Run Prettier over changed Markdown and `git diff --check`. Application, database and Devnet tests are not applicable because this ticket changes only product and work-record documentation.

## Implementation record

Completed the product-contract and backlog correction without changing application, database or Solana runtime code.

### Changes and rationale

- Replaced the package-only, externally arranged session flow with coach-published capacity-one availability for the coming week and client booking inside MovX.
- Defined one-session and ten-session coach offers paid in test USDC, reusable coach-specific TrainingPass credits, purchase-time holds and safe payment/booking recovery.
- Made PostgreSQL authoritative for slots, holds, bookings and future-session reservations while retaining Solana authority for offers, pass terms and remaining balance. Booking reserves a credit; only completed-class redemption decrements it.
- Defined cancellation precisely: either party releases the reserved credit without an on-chain refund; a client-cancelled, still-valid slot reopens, while a coach-cancelled slot is withdrawn.
- Reworked COR0009's milestones and work map, corrected affected direct peers and added DEV0104–DEV0106 for availability, booking and hosted integration.

### Affected files

- `docs/mvp-spec.md` is the corrected product contract, authority model, lifecycle, milestone plan, acceptance matrix and judge flow.
- `README.md` presents the coach-first private-class product and points contributors to the new runtime boundaries; `AGENTS.md` uses the corrected requirement labels.
- `tickets/current/organisatory/COR0009-coach-first-training-package-mvp.md` maps all direct delivery work and sequencing; `tickets/README.md` indexes the revised and newly created records.
- DEV0095–DEV0100 align public positioning, coach identity, 1x/10x Offer state, purchase, completed-booking redemption and social milestones with the booking contract.
- DEV0104, DEV0105 and DEV0106 own weekly availability, pass-backed booking and hosted end-to-end rehearsal respectively.

### Decisions and deviations

- 2026-10-03: The user confirmed that a cancelled booking preserves the purchased class credit. This replaces the previous scheduling exclusion rather than adding an optional stretch feature.
- 2026-10-03: Explicit capacity-one slots are the MVP scheduling model; recurring rules, group capacity and calendar synchronization remain deferred.
- 2026-10-03: A confirmed future booking reserves an on-chain pass credit in PostgreSQL but does not consume it. This avoids a compensating on-chain refund on cancellation while requiring atomic off-chain reservation checks.
- 2026-10-03: Client cancellation reopens a still-valid slot. Coach cancellation withdraws the slot because preserving the client's credit does not imply that the coach still offers that time.
- 2026-10-03: A ten-minute purchase hold remains a proposed implementation default for DEV0105, not a confirmed product decision.

### Contracts, configuration, and operations

Product and delivery contracts change. No runtime interface, database schema, environment variable, dependency, migration or deployment changes in this ticket.

## Validation results

- Passed Prettier write/check over every changed product and ticket Markdown file.
- Passed `git diff --check` with no whitespace errors.
- Passed the repository-local Markdown target scan: 130 Markdown files checked, zero missing local targets.
- Passed the work-record scan: 108 unique DEV/COR identifiers, every record indexed once.
- Passed current/archive status placement checks across 17 current and 91 archived records after this ticket's archive move; COR0009 has 12 direct DEV records with reciprocal membership.
- Terminology review found no current product claim that private scheduling remains outside MovX. Historical mentions remain only where DEV0103 and COR0009 explain the corrected contract.
- Application, database, browser and Devnet tests were not run because DEV0103 changes only documentation and work records.

## Risks, limitations, and follow-ups

Booking introduces cross-system recovery and credit-reservation rules that must be explicit before implementation. Cancellation preserves credit but does not create an automatic USDC refund. No-show charging, late-cancellation policy, disputes, pass transfer and group capacity remain deferred.

## Completion and review references

- Completed: 2026-10-03.
- Commit: This commit — `[DEV0093][DEV0094][DEV0095][DEV0101][DEV0103] Adopt coach-first pivot`.
- Review: Product correction confirmed by the user; documentation and work-map self-review completed.
- Deployment or release: None.
