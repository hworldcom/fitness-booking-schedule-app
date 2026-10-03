# Ticket DEV0068: Revise subscription and pass-resale contract

- Status: Completed
- Created: 2026-09-25
- Last updated: 2026-09-25
- Milestone: M0 frozen product contracts
- Coordination: None — independent development ticket
- Related records: revises the contract frozen by [DEV0066 — Freeze membership product rules](DEV0066-freeze-membership-product-rules.md); affects completed [DEV0067 — Add membership catalogue schema](../backend/DEV0067-membership-catalogue-schema.md), [COR0006 — Persistent access catalogue](./COR0006-persistent-access-catalogue.md), and later-cancelled [DEV0018 — Class-pass reservations and confirmed visits](../backend/DEV0018-class-pass-reservations-and-confirmed-visits.md)

## Objective and context

Correct the initial prepaid-only interpretation of MovX memberships and add the confirmed resale model for unused multi-entry passes. Annual Unlimited is a fixed 12-month subscription paid in monthly installments: when transferred, the recipient receives the exact remaining term and assumes its future installments. A transferable multi-entry pass may instead be resold as one whole remaining balance at its original per-entry value, with a fixed 10-EURC fee paid economically by the seller to the issuing fitness business.

This ticket updates the authoritative [MVP specification](../../../docs/mvp-spec.md) and affected current plans. It does not retrofit the already completed catalogue migration or implement billing, entitlement, resale, payment-routing, program or interface behavior.

## Scope and non-goals

- In scope: define the Annual Unlimited billing schedule and transfer of future payment obligations; preserve its original price, end date and already-paid period; define business-selected pass resale eligibility, whole-remainder resale, deterministic pro-rata price, seller-paid 10-EURC gym fee, atomic settlement, immutable prior redemptions and unchanged expiry; update MVP scope, milestones, acceptance scenarios and affected current work records; identify schema/runtime follow-ups.
- Out of scope: exact gym subscription prices; automatic card/bank debits; production legal terms; arbitrary seller pricing, markup, discount, partial pass splitting or membership resale proceeds; database migrations; Solana accounts/instructions; checkout or marketplace UI; resolution of the general pass refund policy P01.

## Expected behavior and edge cases

Annual Unlimited remains one 365-day contract with a fixed monthly price and twelve scheduled installments. The initial installment activates access. An accepted transfer changes the holder and future payer without changing the price, original end date, next scheduled billing date or number of remaining installments. The sender keeps no access and owes no later installment after successful acceptance; the recipient is not charged again for an already-paid current billing period. An overdue subscription cannot transfer or redeem until its payment state is resolved. The recipient pays the existing 10-EURC gym transfer fee in addition to assuming later installments. There is no seller payout and no automatic renewal after the original term.

For an eligible pass package, resale moves every remaining entry and the unchanged expiry to one accepting recipient. The gross resale price is `original amount paid × remaining entries ÷ original entries`; the seller cannot choose another price. Settlement atomically routes the fixed 10-EURC fee to the issuing gym and the remainder to the seller. For example, five entries left from a ten-entry pass bought for 200 EURC produces a 100-EURC buyer payment, split into 90 EURC seller proceeds and 10 EURC gym fee. Resale is unavailable when no entry remains, the pass is expired/cancelled/non-resellable, another offer exists, a redemption races the sale, or gross value is not greater than the fee.

## Assumptions, decisions, and dependencies

- “Subscription” means a fixed 12-month commitment with monthly installments, not indefinite auto-renewal.
- Devnet EURC remains the MVP payment asset. Unattended wallet debit is not assumed; the payment/program ticket must define explicit wallet approval, authorization and recovery for scheduled installments.
- Subscription transfer is assignment of access and future payment obligations, not resale; the outgoing holder receives no money.
- Pass resale is issuer-enabled and bounded. It is not an open marketplace: only the whole remainder moves at the deterministic original unit value.
- The 30-day held and strictly-more-than-30-days-remaining gates remain membership-transfer rules and do not automatically apply to pass resale.
- DEV0067 accurately records the former prepaid contract and remains historical evidence. A new backend ticket must revise the current catalogue schema before subscription or pass products are published.

## Implementation plan

1. Add confirmed decisions for fixed-term subscription billing/assignment and issuer-enabled pass resale, replacing prepaid-only and no-resale statements.
2. Rewrite the membership purchase, transfer, cancellation and recovery contract around twelve scheduled installments without changing the existing holder/time-gate rules.
3. Extend the pass contract with whole-remainder resale, pro-rata valuation, seller-paid fee routing, acceptance, concurrency and failure behavior.
4. Reconcile MVP scope, architecture sequence, definition of done, milestones, acceptance matrix and demo script.
5. Update COR0006 and DEV0018 to expose the schema/payment/refund dependencies without implementing them.
6. Run focused terminology/link consistency checks and `git diff --check`; application/database tests are not applicable to this documentation-only revision.

## Acceptance criteria

- [x] AC1: Annual Unlimited is consistently defined as a 365-day fixed-term subscription with twelve monthly installments and no end-of-term auto-renewal.
- [x] AC2: A successful membership transfer preserves price, expiry and the paid current period, releases the sender from future installments and makes the recipient the holder/future payer after explicit acceptance without seller proceeds.
- [x] AC3: An issuer-enabled multi-entry pass can be resold only as its whole remainder at deterministic original per-entry value, retaining its expiry and immutable use history.
- [x] AC4: Pass settlement sends 10 EURC from seller proceeds to the issuing gym and the balance to the seller atomically; invalid, concurrent or unfulfilled resale retains no fee or ownership change.
- [x] AC5: The specification and current plans distinguish subscription assignment, pass resale and excluded open-market behavior, and identify the existing prepaid catalogue schema as requiring a follow-up rather than claiming implementation.
- [x] AC6: Documentation terminology, repository-local links and whitespace checks pass; no runtime, migration, deployment or legal-readiness claim is made.

## Validation plan

Search current documentation for contradictory prepaid-only membership, no-resale, sender-receives-nothing and one-time purchase statements. Review decision tables, sections 1/3/5–8 and definition-of-done/milestone/acceptance/demo sections as one contract. Check current ticket relationships and local Markdown links, then run `git diff --check`. Runtime, database and browser tests are not applicable because this ticket changes documentation only.

## Implementation record

Completed the documentation-only contract revision on 2026-09-25.

### Changes and rationale

The specification no longer treats every membership as one prepaid purchase. Annual Unlimited is now a fixed 365-day commitment with twelve monthly Devnet-EURC installments, a frozen original end date and no automatic renewal. Six-Month Flex 12 remains the prepaid membership alternative. Activation, later installments, overdue suspension and issuer-cancellation recovery now distinguish billing state from access state.

Membership transfer remains a whole-remainder assignment with the existing 30-day gates and recipient-paid 10-EURC gym fee. For Annual Unlimited, acceptance also assigns the unchanged future installment schedule and payer role. The already-paid current period is not charged twice, the recipient owes only future unpaid installments, and the outgoing holder receives no proceeds and is released from later installments only after finalized acceptance.

The pass contract now permits business-selected resale of an entire unused multi-entry balance. Gross value is derived from the actual original payment and remaining-entry ratio, rounded down to the EURC base unit. The buyer pays that gross amount once; settlement sends 10 EURC to the gym from seller proceeds and the remainder to the seller while moving the unchanged expiry/balance. One pending offer, explicit acceptance, current-holder checks and serialization with redemption prevent stale or split balances.

MVP scope, fixtures, architecture sequence, definition of done, milestones, acceptance scenarios and demo steps now use these distinctions. COR0006 blocks publication on an additive billing-model schema revision, and DEV0018 now validates current pass ownership and exposes the resale/redemption concurrency dependency without absorbing resale settlement into its scope.

### Affected files

| File or component                                                                 | Change and purpose                                                                                                                                                      |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/mvp-spec.md`                                                                | Replaces the prepaid-only Annual Unlimited interpretation, defines holder/payer assignment and adds bounded pro-rata pass resale throughout the authoritative contract. |
| `tickets/README.md`                                                               | Registers and completes DEV0068.                                                                                                                                        |
| `tickets/current/organisatory/COR0006-persistent-access-catalogue.md`             | Adds the required additive billing-model schema peer and blocks publication of DEV0067 drafts until it lands.                                                           |
| `tickets/current/backend/DEV0018-class-pass-reservations-and-confirmed-visits.md` | Requires current-holder evidence and resale/redemption serialization while keeping payment/resale settlement separately owned.                                          |

### Decisions and deviations

- 2026-09-25: The user clarified that Annual Unlimited is a subscription whose remaining term and payment obligation transfer to the recipient, replacing DEV0066's prepaid-only interpretation.
- 2026-09-25: The user added pro-rata resale of unused pass entries with a 10-EURC seller-paid gym fee; this replaces the prior blanket exclusion of paid peer-to-peer resale for this bounded product behavior.
- 2026-09-25: Kept Flex 12 as the prepaid membership alternative and kept subscription assignment distinct from pass resale: membership senders receive no proceeds, while pass sellers receive the computed gross value minus the gym fee.
- 2026-09-25: Defined scheduled Devnet installments as explicitly wallet-authorized rather than claiming unattended bank/card debit. Production collection and statutory termination remain outside the hackathon contract.

### Contracts, configuration, and operations

Documentation contract only. No runtime code, database relation, migration, Solana account/instruction, dependency, environment variable or deployment changed. The completed DEV0067 tables still store a single optional price and no installment schedule; their private drafts must remain unpublished until a new additive migration introduces explicit billing-model terms. Pass catalogue/ownership/resale storage and settlement also require separately ticketed implementation.

## Validation results

Validated on 2026-09-25 as documentation-only work.

- `git diff --check` — passed with no whitespace errors.
- `npm run format:check` — passed for all repository files covered by the existing Prettier script.
- Repository-local Markdown link audit — passed for 89 Markdown files.
- Focused terminology search across `docs`, `README.md` and `tickets/current` found only intentional historical references to DEV0066/DEV0067 and the valid distinction that membership assignment has no seller proceeds.
- Reviewed C20–C27, P01/P09–P14, scope, fixtures, architecture, membership/pass contracts, definition of done, milestones, A05–A13/A24–A25 and the demo script as one contract.
- Application, database, browser and deployment checks were not run because this ticket changes documentation and planning records only.

| Criterion | Evidence                                                           | Result |
| --------- | ------------------------------------------------------------------ | ------ |
| AC1–AC4   | Cross-section contract review plus focused contradiction search    | Passed |
| AC5       | COR0006/DEV0018 relationship and publication-blocker review        | Passed |
| AC6       | Markdown link audit, `git diff --check`, and existing format check | Passed |

## Risks, limitations, and follow-ups

The existing membership catalogue stores one price and no installment schedule; it must not publish Annual Unlimited under the revised contract. Exact subscription prices, calendar-month schedule construction, installment authorization/recovery and post-resale P01 refund allocation remain follow-up concerns. Production subscription assignment and resale require legal, tax, consumer-protection and payment-provider review outside this Devnet hackathon contract.

## Completion and review references

- Completed: 2026-09-25 — revised the authoritative subscription-assignment and bounded pass-resale contract and reconciled current plans.
- Commit: Not created; use `[DEV0068] Revise subscription and pass-resale contract` when authorized.
- Review: Documentation consistency self-review completed; no independent review.
- Deployment or release: Documentation only; none.
