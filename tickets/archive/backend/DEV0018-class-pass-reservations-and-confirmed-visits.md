# Ticket DEV0018: Class-pass reservations and confirmed visits

- Status: Cancelled
- Created: 2026-09-19
- Last updated: 2026-09-25
- Milestone: Superseded class-pass access plan
- Coordination: None — independent development ticket
- Related records: planned by [DEV0014](DEV0014-database-and-backend-plan.md); revised by [DEV0048](DEV0048-remove-gym-membership-access.md), [DEV0058](../organisatory/DEV0058-fitness-access-mvp-contract.md), [DEV0066](../organisatory/DEV0066-freeze-membership-product-rules.md) and [DEV0068](../organisatory/DEV0068-revise-subscription-and-pass-resale-contract.md); cancelled by completed [DEV0069](../organisatory/DEV0069-adopt-core-multigym-membership-mvp.md); replacement membership check-in work is mapped by [COR0007](../organisatory/COR0007-core-multigym-membership-mvp.md)

## Cancellation outcome

The user removed standalone passes and pass resale from the MVP on 25 September 2026 to focus delivery on one multi-gym membership. This ticket had no implementation, migration or commit, so its class-pass reservation/ownership/redemption outcome is cancelled rather than adapted into a different feature.

COR0007 identifies a fresh backend peer for capacity-aware reservations, authorized Basic/Classic check-ins and provisional usage allocation. That replacement must follow the current membership contract and must not inherit pass ownership, resale, refund or current-holder behavior from this record.

## Historical objective and scope

The original plan would have turned a verified paid class pass into a server-backed reservation path, then allowed assigned venue staff to confirm the resulting visit. It included atomic capacity handling, idempotent reservations, staff-scoped redemption, visit evidence and optional shared activity.

It deliberately did not own purchase/refund/resale transactions, seller proceeds, membership entitlement, event tickets, sponsorship funding, reactions or production staff onboarding. Later revisions added a requirement to serialize pass resale with reservation/redemption so a prior holder could not consume sold entries. None of this work started.

### Historical expected behavior and edge cases

- Only a valid current pass holder could reserve; concurrent final-seat requests could not oversell.
- Payment, reservation, sharing or no-show did not prove attendance; assigned venue staff remained the confirmation authority.
- Stale, cancelled, refunded, exhausted, wrong-venue and duplicate access failed without adding visits.
- Retries reused a stable result and conflicting idempotency payloads failed.
- Resale acceptance and redemption would have serialized so the same entry could not be sold and consumed.
- Personal activity required explicit sharing and did not expose receipt or wallet details.

## Historical implementation plan

1. Resolve the venue-local day/check-in window and verified payment/ownership boundary.
2. Add reservation, access, check-in, visit, activity, idempotency and outbox persistence with dataset ownership and concurrency constraints.
3. Implement atomic pass reservation, cancellation/refund-state handling and exact capacity release.
4. Implement staff confirmation and visit projection with resale/cancellation/check-in race protection.
5. Integrate optional verified activity plus restricted staff and member views.

## Historical acceptance criteria

- [ ] AC1: Only the valid current pass holder can reserve; final-seat/concurrent requests cannot oversell, overconsume or double-book.
- [ ] AC2: Retry, cancellation, refund and conflicting-idempotency races preserve consistent access/capacity evidence.
- [ ] AC3: Only authorized venue staff records valid access once; stale holder, wrong venue/dataset, self-confirmation, invalid access and duplicate attempts fail.
- [ ] AC4: Shared activity and hide/cancellation behavior preserve authorization without leaking receipt/wallet data or implying attendance.
- [ ] AC5: Database concurrency, role and timezone tests plus two-user responsive/keyboard flows pass.
- [ ] AC6: The ticket creates no fabricated membership eligibility or no-payment booking path.

These criteria were never run and are retained only to explain the cancelled plan. They are not requirements for the current multi-gym membership.

## Implementation record

Planning history: this ticket first proposed seeded gym-membership booking as a payment-free slice. On 21 September, DEV0048 removed that entitlement schema and preview behavior. On 24 September, DEV0058 restored a different membership direction and kept this record limited to verified class passes. DEV0068 then added pass resale, which expanded the planned concurrency boundary. On 25 September, DEV0069 removed standalone passes/resale entirely and made the old outcome unnecessary.

No runtime code, schema, migration, dependency, environment variable, test or deployment was created under DEV0018.

## Validation results

Not run — implementation never started. Cancellation was checked against the current specification and COR0007 work map; it does not satisfy the historical AC1–AC6.

## Risks, limitations, and follow-ups

The current product still needs reservation/check-in concurrency and staff authorization, but those behaviors must be designed around active multi-gym membership periods, Basic/Classic rules and the non-core direct-payment path. The required replacement DEV ticket has not yet been created.

## Completion and review references

- Completed: Cancelled and archived on 2026-09-25; standalone passes/resale left the MVP before implementation.
- Commit: Not created for the planned runtime work.
- Review: Cancellation reconciled under DEV0069; no independent implementation review.
- Deployment: None.
