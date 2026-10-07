# Ticket DEV0126: Adopt the coach-pass and group-funding contract

- Status: Completed
- Created: 2026-10-04
- Last updated: 2026-10-04
- Milestone: Marketplace M0 product contract
- Coordination: [COR0010 — Coach-pass and group-funded marketplace MVP](../../archive/organisatory/COR0010-group-funded-coach-marketplace-mvp.md)
- Related records: supersedes the group-funding-only product boundary recorded by [DEV0117](../../archive/organisatory/DEV0117-adopt-group-funded-coach-marketplace-mvp.md) without rewriting that history; restores a new implementation path from the partial historical [DEV0097](../../archive/blockchain/DEV0097-create-coach-package-offers.md)

## Objective and context

Update the single current product contract after the user confirmed two hackathon features: first, clients buy one-session or ten-session coach passes and spend credits on calendar bookings; second, coaches may create threshold-funded group events. The previous group-funding-only specification incorrectly deferred the newly confirmed primary pass flow.

## Scope and non-goals

- In scope: reconcile the MVP specification, repository navigation and COR0010 work map; define the authority split among immutable coach offers, one coach-client credit ledger, off-chain bookings and later EventPool funding; preserve completed coach/profile/calendar/social work and historical records.
- Out of scope: runtime program, database or interface implementation; rewriting archived evidence; production funds, disputes, private pricing discovery or coach/gym payment splitting.

## Expected behavior and edge cases

The current documentation must state that one or ten credits are bought atomically with official Devnet test USDC, one pair ledger exists per coach and client, booking reserves/spends a credit, early cancellation returns it automatically according to the coach's published cutoff, and late cancellation requires the coach's explicit decision. Custom client pricing remains possible through an offer restricted to one wallet. Group-event funding remains the second blockchain demonstration rather than replacing passes.

## Assumptions, decisions, and dependencies

One large coach account containing an unbounded client map is rejected. A stable `CoachAuthority` PDA identifies the coach, while each paying relationship gets its own `CoachClientCredits` PDA. The application may render coach-side client cards by joining those public balances with authorized off-chain profile and booking data. Credits do not expire in P0; an offer's validity window controls how long that price can be purchased. Existing partial `CoachAuthority` and `Offer` code may be extended only by the new blockchain ticket.

## Implementation plan

1. Update the confirmed-decision register, user flows, state model, milestones and acceptance matrix.
2. Expand COR0010 with explicit pass-ledger, booking, interface and Devnet integration owners.
3. Update navigation/status language without claiming unfinished runtime behavior.
4. Run repository-link and consistency checks and record the result.

## Acceptance criteria

- [x] AC1: The specification makes coach passes/calendar booking the first feature and conditional group-event funding the second.
- [x] AC2: The specification distinguishes one per-coach authority PDA, one per-pair credits PDA, off-chain booking records and coach client-card projections.
- [x] AC3: COR0010 maps every restored pass deliverable to exactly one direct DEV ticket, with consistent links and statuses.
- [x] AC4: Historical cancelled tickets remain historical and no documentation claims the new runtime is already complete.

## Validation plan

Check repository-relative links, search for contradictory group-funding-only/private-pass-deferred statements in current navigation/specification records, and review the COR/DEV coordination fields for exact membership agreement. Application tests are not applicable because this ticket changes product and work-record documentation only.

## Implementation record

Completed on 2026-10-04.

### Changes and rationale

The MVP specification and README now lead with coach-specific one/ten-credit purchase and calendar booking, retain conditional group events as the second blockchain demonstration and explicitly distinguish implemented foundations from open runtime work. COR0010 was expanded rather than replaced so the request/proposal and group-funding peers retain their direct coordination membership. DEV0127–DEV0130 separately own the new ledger, booking, interface and Devnet boundaries.

### Affected files

`docs/mvp-spec.md` owns the revised decisions, authority split, flows, state, definition of done and demo. `README.md` provides truthful navigation/status. COR0010 maps all direct work. DEV0127–DEV0130 record the executable pass slices. `tickets/README.md` indexes the new records and preserves next-ID allocation.

### Decisions and deviations

The user restored passes as the primary feature after DEV0117 had replaced them with group funding. A new ticket preserves the earlier completed historical record instead of rewriting it.

### Contracts, configuration, and operations

This ticket changes the product contract and delivery map only. It introduces no environment variable, migration or deployed behavior. No rollback operation is required; a future product change needs a new ticket and dated specification update.

## Validation results

- 2026-10-04, repository documentation: targeted search found no current statement that private passes remain deferred or superseded; occurrences of “group-funding-only” describe the preserved historical decision.
- Coordination-field review found every direct COR0010 member linked to the renamed `Coach-pass and group-funded marketplace MVP` record.
- `npx --no-install prettier --write` completed for the changed documentation and ticket files; `git diff --check` passed after the full implementation update.
- Application/runtime tests are not applicable to this documentation-only ticket. Runtime proof belongs to DEV0127–DEV0130 and remains explicitly unfinished.

| Criterion | Evidence                                                                | Result |
| --------- | ----------------------------------------------------------------------- | ------ |
| AC1       | Specification introduction, decision register, flows and milestones     | Pass   |
| AC2       | Specification state model and DEV0127–DEV0129 boundaries                | Pass   |
| AC3       | COR0010 direct-work table and matching DEV coordination fields          | Pass   |
| AC4       | Archived DEV0117/DEV0097 retained; current docs use unfinished language | Pass   |

## Risks, limitations, and follow-ups

The primary risk is documentation getting ahead of runtime implementation. DEV0127–DEV0130 own those concrete changes and remain open until independently validated.

## Completion and review references

- Completed: 2026-10-04 — adopted and reconciled the two-loop product contract and flat work map.
- Commit: Included in the combined `[DEV0117][DEV0126][DEV0127] Adopt coach-pass marketplace and credit ledger` change because this contract revision directly defines the ledger implemented by DEV0127.
- Review: Planning self-review only.
- Deployment or release: None.
