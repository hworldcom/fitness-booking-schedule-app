# Ticket DEV0094: Adopt the coach-first training-package MVP

- Status: Completed
- Created: 2026-10-02
- Last updated: 2026-10-03
- Milestone: Coach-first product pivot
- Coordination: [COR0009 — Coach-first private-class booking MVP](../../current/organisatory/COR0009-coach-first-training-package-mvp.md)
- Related records: supersedes the current multi-gym contract coordinated by COR0007; preserves completed multi-gym implementation as historical evidence; precedes DEV0095–DEV0101

## Objective and context

Replace the current users-to-gyms multi-gym product contract with one focused users-to-coaches hackathon product. Independent martial-arts coaches publish prepaid session packages, clients discover a coach and buy a package with configured Devnet test USDC, coaches redeem completed sessions, and both sides see the remaining entitlement. A small coach-led follow and chronological-post feed supplies the network wedge.

The user approved this direction after reviewing the trainer-first blueprint on 2026-10-02. The current [MVP specification](../../../docs/mvp-spec.md), README and open work records still define Basic/Classic plans, four selected gyms, membership-pool activation, venue reservations/check-ins, provisional gym allocation and a wallet-visible membership card. This ticket owns the product-document and backlog reconciliation before new runtime implementation begins.

## Scope and non-goals

- In scope: rewrite the current MVP specification and README around coach discovery, coach profiles, configurable prepaid packages, Devnet test-USDC purchase, non-transferable session entitlements, coach-authorized redemption and coach-led social posts; define confirmed decisions, deferred work, milestones, acceptance scenarios and demo path; reconcile open multi-gym DEV/COR records; preserve completed and partially implemented history accurately; and make COR0009 plus DEV0095–DEV0101 the actionable product backlog.
- Out of scope: application, database or Solana-program implementation; deleting completed tickets or migrations; rewriting historical evidence; deploying; choosing production payments, fees, refunds, subscriptions, scheduling or gym revenue sharing.

## Expected behavior and edge cases

After this ticket, one current product contract describes a guest discovering a coach, an authenticated client purchasing one coach-created package with test USDC, a coach redeeming sessions and a follower seeing coach posts. It must clearly state that the first payment asset is test-only Devnet USDC, that the program account stores a client association rather than becoming a transferable token, and that PostgreSQL/offchain services remain authoritative for profiles, media and the social graph while the Solana program is authoritative for offer terms, payment-coupled pass creation and remaining sessions.

The contract must include a real cold-start coach discovery surface rather than treating an already-followed feed as discovery. It must define coach onboarding, immutable offer payment recipient, recoverable/idempotent purchase operations, unilateral coach redemption with immutable history, and explicit fee-payer responsibility. `Cancelled` must not appear as a pass state unless a corresponding authority and instruction are defined.

Completed multi-gym tickets remain archived evidence. Open records with implementation history are finalized as cancelled/superseded without hiding what passed or deleting their code. Draft records that directly contradict the new contract are cancelled and replaced. General identity, wallet-linking, hosted staging and runtime-reliability work is retained when still applicable.

## Assumptions, decisions, and dependencies

- Public terminology uses **coach** consistently; internal legacy identifiers may remain until an owning implementation ticket changes them.
- The initial niche is independent martial-arts coaches offering private or small-group sessions.
- The configured hackathon asset is official Devnet test USDC. Production money movement remains unresolved.
- Package transfer, resale, subscriptions, scheduling, messages, reviews, refunds and coach/gym payment splitting are deferred. A two-recipient coach/gym split may be reconsidered only after the core flow is stable.
- This documentation ticket is the start condition for the other COR0009 peers. It does not authorize their runtime scope before the contract and work-record reconciliation are complete.

## Implementation plan

1. Rewrite `docs/mvp-spec.md` with confirmed coach-first rules, authority boundaries, milestones, acceptance matrix and a 2–3 minute demo path.
2. Update the root README to describe the new product and distinguish delivered reusable infrastructure from superseded multi-gym runtime.
3. Review every current DEV and COR record. Cancel/archive superseded unfinished multi-gym work with honest partial evidence, retain generally applicable identity/staging work and update reciprocal links/statuses.
4. Finalize COR0009's work map and DEV0095–DEV0101 against the adopted specification, removing overlap and recording delivery order.
5. Run documentation link, identifier, status and consistency checks; record every changed contract and intentionally preserved limitation.

## Acceptance criteria

- [x] AC1: The current MVP specification and README describe only the coach-first package product and clearly distinguish delivered infrastructure from planned runtime.
- [x] AC2: Coach discovery, onboarding, offer/payment recipient, test-USDC purchase recovery, fee responsibility, redemption authority, social scope and deferred scheduling/refunds are explicit and non-contradictory.
- [x] AC3: Every superseded open multi-gym ticket/coordination record is preserved with an accurate final status or an explicit retained dependency; completed historical records are not rewritten.
- [x] AC4: COR0009 maps every required coach-first implementation boundary to exactly one reciprocal DEV0095–DEV0101 ticket, with start conditions and no unowned runtime scope.
- [x] AC5: Repository links, record IDs, statuses and the ticket index are consistent, and no current document promotes both products simultaneously.

## Validation plan

Use `rg` and link/path checks to find remaining current-product claims for four gyms, Basic/Classic, membership pool, provisional allocation, non-core visits and wallet-visible membership cards. Review every match as retained history, reusable implementation evidence or an error. Verify reciprocal COR/DEV links and unique identifiers across current/archive records. Documentation-only work does not require application tests; record that explicitly unless implementation files unexpectedly change.

## Implementation record

The coach-first contract, navigation documentation and actionable peer backlog now replace the multi-gym product. Superseded unfinished records were preserved as Cancelled history before DEV0101 removed their runtime; completed records and additive migrations remain intact.

### Changes and rationale

Rewrote the authoritative specification and README for coach discovery, coach-created prepaid packages, Devnet test-USDC purchase, non-transferable TrainingPass state, coach redemption and a coach-led social loop. Created COR0009 and DEV0095–DEV0101 as the flat delivery map. Cancelled and archived unfinished multi-gym records without erasing their partial implementation evidence, and retained generally applicable email identity, personal-wallet and staging work.

### Affected files

| File or component                                                          | Change and purpose                                                                                                                          |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/mvp-spec.md`                                                         | Replaced the multi-gym contract with the coach-first decisions, flows, authority boundaries, milestones, acceptance matrix and demo path.   |
| `README.md`                                                                | Describes delivered foundation versus planned coach runtime and no longer promotes the retired product.                                     |
| `AGENTS.md`                                                                | Retargets contributor requirement links from removed multi-gym sections to coach packages and purchase/redemption.                          |
| `tickets/current/organisatory/COR0009-coach-first-training-package-mvp.md` | Added the flat work map, sequence and integration completion conditions.                                                                    |
| `tickets/current/{frontend,backend,blockchain}/DEV0095–DEV0101`            | Added seven runtime peer plans for public story, discovery, offers, purchase, redemption, social delivery and legacy membership retirement. |
| `tickets/README.md` and superseded DEV/COR records                         | Indexed the new records, archived cancelled multi-gym work and preserved partial evidence and replacement links.                            |

### Decisions and deviations

- 2026-10-02: The coach-first blueprint was accepted as the basis for ticket planning, subject to adding cold-start discovery, coach onboarding, immutable payment recipients, purchase recovery and a defined redemption boundary.
- 2026-10-02: Added DEV0101 as the explicit owner for removing the superseded multi-gym runtime while preserving migrations, historical evidence and generic wallet/payment primitives.
- 2026-10-03: DEV0023, DEV0041, DEV0081, DEV0082, DEV0089, DEV0092 and COR0002/COR0006/COR0007 were cancelled and archived. Completed delivery stays historical; unfinished validation is not relabelled as passed.

### Contracts, configuration, and operations

The product contract now uses test USDC, coach Offer accounts and non-transferable TrainingPass accounts instead of EURC pool membership activation. DEV0101 separately removed the obsolete runtime and environment examples; this documentation ticket introduced no database migration, deployment or secret.

## Validation results

2026-10-03 final validation:

- `git diff --check` passed for the working tree.
- A repository-local Markdown link check covered 125 current/archived Markdown files after reconciliation with zero missing local targets; moved work-record targets resolve and removed runtime paths are retained as historical inline paths rather than dead links.
- Work-record lifecycle/index validation found 103 unique ticket/coordination files, 103 matching index rows and zero path/status errors.
- Manual work-map review confirmed reciprocal COR0009 membership for DEV0094–DEV0101 and one primary implementation area per DEV ticket.
- Application tests are owned by DEV0101 because that peer changed runtime code; this ticket's documentation acceptance is covered by the consistency/link review.

| Criterion | Evidence                                                                        | Result |
| --------- | ------------------------------------------------------------------------------- | ------ |
| AC1–AC3   | Current specification/README review and cancelled-record archive reconciliation | Passed |
| AC4       | COR0009 maps DEV0094–DEV0101 with reciprocal links and explicit dependencies    | Passed |
| AC5       | Index/status/path review plus repository-local Markdown link check              | Passed |

## Risks, limitations, and follow-ups

Completed multi-gym migrations and archived evidence remain intentionally. Dormant hosted tables require a separate, destructive-data review; they are not evidence of a second live product. DEV0093 remains independent runtime-reliability work and needs its own terminology update before implementation.

## Completion and review references

- Completed: 2026-10-03.
- Commit: This commit — `[DEV0093][DEV0094][DEV0095][DEV0101][DEV0103] Adopt coach-first pivot`.
- Review: Self-reviewed against AC1–AC5; no independent review.
- Deployment or release: None.
