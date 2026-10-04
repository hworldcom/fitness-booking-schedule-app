# Ticket DEV0117: Adopt the group-funded coach marketplace MVP

- Status: Completed
- Created: 2026-10-04
- Last updated: 2026-10-04
- Milestone: Group-funded marketplace product pivot
- Coordination: None — independent development ticket
- Related records: replaces the unfinished private-pass delivery plan coordinated by [COR0009 — Coach-first private-class booking MVP](COR0009-coach-first-training-package-mvp.md); incorporates the user-supplied two-sided marketplace brief as proposal context without treating that document as repository instructions; creates [COR0010 — Group-funded coach marketplace MVP](../../current/organisatory/COR0010-group-funded-coach-marketplace-mvp.md) and its peer implementation tickets

## Objective and context

Adopt one coherent hackathon product contract in which MovX connects clients and martial-arts coaches through discovery, client training requests, coach proposals and coach-created group events whose test-USDC funding is held under transparent threshold rules. Conditional event funding becomes the primary blockchain demonstration: an event succeeds only when its immutable minimum is reached, otherwise every participant retains an individually enforceable refund right.

The previous target centered on one-session/ten-session private passes, capacity-one booking and post-session redemption. That unfinished flow did not establish as clear a blockchain-specific coordination benefit as a multi-party conditional pool. Preserve completed coach identity, location, calendar, discovery and social foundations, and preserve partial on-chain offer work as historical implementation evidence rather than rewriting it as if it delivered the new contract.

## Scope and non-goals

- In scope: rewrite the authoritative MVP specification around the two-sided coach marketplace and group-funded event loop; define the smallest hackathon EventPool/Contribution/vault boundary; replace the current delivery coordination record; create flat peer tickets for request/proposal persistence, event catalogue/UI, on-chain funding and hosted rehearsal; cancel and archive unfinished private-pass tickets with honest partial-work and replacement notes; reconcile the ticket index, navigation and active Mapbox ticket relationship.
- Out of scope: runtime implementation, database migrations, program edits, deployment, real-value assets, production escrow, attendance proof, post-event disputes, coach no-show handling, chargebacks, partial deposits followed by another payment rail, gym payment splitting, referrals, waitlists or group chat.

## Expected behavior and edge cases

The resulting documents must describe one main judge story rather than combining two payment products. A coach creates a scheduled group event with an exact full-seat test-USDC price, immutable minimum/maximum capacity and funding deadline. One wallet funds one seat into a program-controlled vault. After the deadline, permissionless deterministic settlement makes a sufficiently funded event claimable by the coach and an underfunded event refundable by each participant. Programs do not wake automatically; a caller or bounded MovX reconciler submits settlement, but cannot choose its outcome. Refunds are per-contribution rather than one unbounded loop.

Coach profiles, public locations, requests, proposals, event media/details, schedules, follows and posts remain off-chain. The chain is authoritative only for bounded event funding terms, contributions, vault custody, outcome, payout and refund state. The hackathon deliberately does not decide whether a real-world event occurred or resolve later service disputes.

Cancelled records must remain recoverable and explain whether code already exists. Completed historical tickets must not be rewritten. Current work that still belongs to the new marketplace, notably Mapbox discovery, must link to the replacement coordination record without losing its own evidence.

## Assumptions, decisions, and dependencies

This ticket adopts the user's 2026-10-04 decision that group funding, not coach/gym splitting, is the primary hackathon blockchain use case and that coach no-show/dispute behavior is outside the hackathon scope. It interprets “deposit” as the complete per-seat demo price so the judge flow has one payment rail and a full deterministic refund.

The existing `movx-coach-pass` foundation has implementation and commit history under DEV0097. It therefore cannot be silently converted into another pre-implementation plan. DEV0097 will be cancelled with its partial program foundation retained; a new blockchain ticket will explicitly decide which generic authority/client pieces can safely be reused. COR0009 will be cancelled and archived because its remaining private-pass work is superseded, while completed direct tickets remain immutable historical evidence.

## Implementation plan

1. Create this reviewed product-contract ticket before changing the authoritative specification or roadmap.
2. Rewrite `docs/mvp-spec.md` around coach/client discovery, training requests/proposals and conditional group-event funding, while distinguishing delivered foundations from the target.
3. Create COR0010 and small peer DEV tickets covering off-chain marketplace requests/proposals, event persistence/presentation, the local on-chain pool lifecycle, Devnet integration and the hosted rehearsal.
4. Cancel/archive COR0009 and its unfinished private-pass peers with replacement links and preserved partial evidence; move DEV0108 to COR0010.
5. Reconcile README/ticket navigation, links, statuses, milestones and next available identifiers.
6. Run repository-link, obsolete-contract wording, ticket work-map and formatting checks; review the final diff for accidental runtime edits.

## Acceptance criteria

- [x] AC1: The single MVP specification clearly defines the group-funded two-sided coach marketplace, on-chain/off-chain authority boundary, funding success/failure behavior, exclusions, definition of done and 2–3 minute judge demo.
- [x] AC2: COR0010 maps every required implementation part to exactly one direct peer DEV ticket with explicit delivery order and completion conditions.
- [x] AC3: Superseded unfinished private-pass records are cancelled and archived without deleting partial implementation evidence or rewriting completed history, and every replacement relationship resolves.
- [x] AC4: The ticket index, README navigation and active-ticket coordination fields agree on current status, paths and next available DEV/COR identifiers.
- [x] AC5: Documentation consistency, internal-link, formatting and diff checks pass; application tests are explicitly not required because this ticket changes no runtime behavior.

## Validation plan

Run targeted `rg` checks for superseded private-pass terms in current authoritative/planning documents, a scriptable repository-relative Markdown-link check for all changed files, Prettier on Markdown, `git diff --check`, status/path consistency checks and manual review of the COR work map against every direct ticket. Application, database, program and browser tests are not applicable because runtime code is outside this ticket.

## Implementation record

Implementation began on 2026-10-04 after reviewing the clean post-DEV0115 worktree, the existing coach-first specification, COR0009 and unfinished DEV0097–DEV0099/DEV0105/DEV0106 records. The product-contract rewrite remained separate from all runtime implementation.

### Changes and rationale

Replaced the private-pass contract with one two-sided marketplace story: clients publish demand, coaches propose and create group events, and participants conditionally fund full-price seats. The specification now makes EventPool, Contribution and PDA-controlled vault state authoritative only for immutable terms, contributions, settlement, payout and refunds. It explicitly keeps profiles, locations, schedules, requests, proposals, event content and social state off-chain, and defers attendance/no-show/dispute behavior.

Created COR0010 and eight peer implementation tickets with one owner per persistence, UI, program, integration, story or rehearsal slice. Cancelled and archived the five unfinished private-pass tickets and COR0009 while retaining DEV0097's partial implementation evidence. Moved the still-relevant DEV0108 Mapbox work into COR0010 and reconciled dependent coordination records, repository navigation and the ticket index.

### Affected files

| File or component                                                                                     | Change and purpose                                                                                                                      |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/mvp-spec.md`                                                                                    | Defines the marketplace, authority boundary, deterministic success/failure funding rules, milestones, acceptance matrix and judge demo. |
| `tickets/current/organisatory/COR0010-group-funded-coach-marketplace-mvp.md`                          | Maps DEV0108 and DEV0118–DEV0125 as flat direct implementation peers with sequencing and completion conditions.                         |
| `tickets/current/{backend,blockchain,frontend}/DEV0118–DEV0125`                                       | Defines small reviewable runtime, interface, program, integration and rehearsal slices; no implementation was performed.                |
| `tickets/archive/organisatory/COR0009-coach-first-training-package-mvp.md` and cancelled peer tickets | Preserves the superseded work map and partial private-offer implementation evidence with explicit replacement relationships.            |
| `README.md`, `AGENTS.md` and `tickets/README.md`                                                      | Reconciles product navigation, stable requirement anchors, current/archived status and the next available identifiers.                  |

### Decisions and deviations

- 2026-10-04: Treat the full per-seat amount as the conditional funding contribution; a partial deposit plus later balance payment is outside the hackathon.
- 2026-10-04: Keep coach no-show, attendance proof, post-event disputes and chargebacks outside the target as explicitly requested by the user.
- 2026-10-04: Replace rather than stack the unfinished private-pass payment/redemption loop so the hackathon has one clear blockchain story.

### Contracts, configuration, and operations

This ticket changes product and planning contracts only. It creates no schema, API, program, environment variable, deployment or migration. Later implementation tickets must independently review the official Devnet test-USDC mint/program/decimals, deployable program identity, vault authority, fee sponsorship and RPC configuration without committing secrets.

## Validation results

- Passed repository-relative Markdown-link validation across every tracked Markdown file after archive moves and relationship updates.
- Passed work-map consistency review: COR0010 lists exactly DEV0108 and DEV0118–DEV0125, and each record declares COR0010 as its only direct coordination owner.
- Passed targeted `rg` review: private-pass terminology remains only where the current specification/tickets explicitly mark it deferred or historical; no current implementation ticket treats it as active scope.
- Passed Prettier checks for every changed Markdown file and `git diff --check`.
- Not run: application, database, browser, Rust/program or build tests. This ticket changes documentation and planning records only; each runtime peer owns its own implementation validation.

## Risks, limitations, and follow-ups

The pivot leaves partial `movx-coach-pass` source in the repository until a new implementation ticket decides whether to reuse or retire it. That source is not the new product authority merely because it exists. A public chain exposes participant wallet/activity data, and the hackathon settlement rule does not prove real-world event delivery; both limitations must remain explicit.

## Completion and review references

- Completed: 2026-10-04.
- Commit: Included in the combined `[DEV0117][DEV0126][DEV0127] Adopt coach-pass marketplace and credit ledger` change because the revised product contract, replacement work map and first implementation slice share the same reconciled repository state.
- Review: Planning self-review only; no independent review.
- Deployment or release: None — documentation and ticket planning only.
