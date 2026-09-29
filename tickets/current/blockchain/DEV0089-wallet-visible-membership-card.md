# Ticket DEV0089: Add a wallet-visible membership card

- Status: Draft
- Created: 2026-09-28
- Last updated: 2026-09-29
- Milestone: M2–M3 wallet-visible membership projection
- Coordination: [COR0007 — Core multi-gym membership MVP](../organisatory/COR0007-core-multigym-membership-mvp.md)
- Related records: projects the active period delivered through [DEV0080 — Persist membership activation foundation](../../archive/backend/DEV0080-membership-activation-foundation.md) and [DEV0081 — Activate memberships with Devnet EURC](DEV0081-devnet-membership-activation.md), follows confirmed usage from [DEV0084 — Persist included membership check-ins](../../archive/backend/DEV0084-persist-included-membership-checkins.md), depends on the personal-wallet lifecycle in [DEV0047 — Personal wallet linking and replacement](../backend/DEV0047-personal-wallet-linking-and-replacement.md), requires the bounded [DEV0092 PDA/card lifecycle spike](DEV0092-validate-pda-membership-card-lifecycle.md), and may reuse the fee-payer boundary from [DEV0082 — Sponsor membership network fees](DEV0082-sponsor-membership-network-fees.md) without reusing its authority

## Objective and context

Make the member's current or most recent verified Devnet membership period visible in the linked Solana wallet as a clearly branded, non-transferable membership card. One stable PDA-backed card lineage survives sequential membership periods: when the reviewed wallet is unchanged, a later period updates the existing PDA and asset rather than creating another pair. A Basic card shows the fixed allowance and current remaining visits; a Classic card shows `Unlimited · one included visit per day` rather than a fabricated balance or an unqualified unlimited promise. Plan, validity and status should remain understandable when the member views the asset in Phantom or Solflare.

The current application activates membership access in PostgreSQL after verifying a Devnet-EURC payment. It does not mint an NFT, token or other wallet-visible membership object. This ticket adds a public on-chain **projection** of the private membership state; it does not move access authority out of PostgreSQL and does not make the card a transferable or speculative product. It implements [C31 and the activation projection contract](../../../docs/mvp-spec.md#73-activation) within the [asset and wallet integrity rules](../../../docs/mvp-spec.md#9-asset-wallet-and-demo-integrity).

## Scope and non-goals

- In scope: one idempotently established stable Devnet membership-card lineage that projects the current or most recent verified period; same-wallet reuse of its PDA and asset across sequential periods; retained explicitly inactive predecessors after reviewed wallet replacement; ownership of the current card by the period's reviewed linked member wallet; enforced non-transferability; Basic plan/validity/total/used/remaining presentation; Classic plan/validity/`Unlimited · one included visit per day` presentation; active/expired or superseded projection state; no personal identity, selected gyms, reservation or attendance detail; durable opaque lineage identifier, current-period projection version, asset generation, synchronization state and public transaction evidence; server-authorized create/update transactions; sponsored fee-payer separation and cost evidence; retry/reconciliation after chain/RPC/indexer failure; wallet rendering in Phantom and Solflare; automated boundary tests and real Devnet rehearsal.
- Out of scope: using an asset as access or attendance authority; transferable membership, resale, marketplace or financial value; achievement badges; mainnet minting; storing personal data or the four selected gyms in public metadata; wallet-native check-in; production renewal/cancellation/refund policy; production legal/privacy approval; embedded-wallet delivery; arbitrary operator minting; several simultaneously current wallet-visible cards for one period; mandatory burning of inactive historical cards.

## Expected behavior and edge cases

After a member's first activation is finalized, the application creates or resumes one stable card-lineage operation and projects that period. A successful projection produces one current non-transferable asset owned by the exact personal wallet snapshotted for activation. A later non-overlapping period in the same reviewed wallet reuses the lineage PDA and current asset while advancing the period and projection versions. Replaying activation, retrying either projection or recovering a lost response reconciles the same lineage and asset instead of creating another. Only a separately verified wallet-replacement transition may retain that asset as inactive and establish a new current generation.

For Basic, public card metadata communicates `10 visits included`, confirmed usage and the derived number remaining. A confirmed check-in changes the database first and then advances the wallet projection to the new immutable projection version. For Classic, metadata says `Unlimited · one included visit per day` and never fabricates a large allowance or hides the daily rule. Both plans show their validity end and a truthful active/expired state. The wallet card contains no member name/email, selected-gym list, reservation, check-in location or check-in history.

PostgreSQL remains authoritative for activation and check-ins. Mint or metadata-update failure cannot roll back or invalidate an otherwise valid membership/check-in. Instead the projection remains `pending` or `update_required`, is visibly non-authoritative in MovX, and can be retried against the same expected version. An old wallet rendering may be temporarily stale because wallet/indexer caches are outside MovX control; the application must continue to show the live authoritative balance and disclose the latest confirmed projection state.

After a protected personal-wallet replacement, the previous asset remains in the old wallet and is presented as inactive; it is not burned. A newly created non-transferable asset becomes the sole current card in the replacement wallet, and the existing stable PDA advances its exact current-asset address and generation. Standard wallets do not compare arbitrary PDA data themselves, so MovX must also update metadata recognized by the selected asset standard. A stale visual label never restores validity: current-card validation requires an exact PDA address/generation match. The flow must not let a caller redirect an asset by submitting a wallet address. DEV0092 must validate the atomic or recoverable transition before this ticket becomes Ready.

The configured MovX Devnet sponsor pays projection transaction fees and any account-creation deposits; the member does not need SOL for these server-authorized projection operations. First creation pays the PDA and asset rent-exempt balances plus the network fee. Confirmed-usage, expiry/status and later same-wallet period updates normally pay only a network fee when account sizes do not change. Wallet replacement reuses the PDA but pays for the new asset; retaining the predecessor leaves its existing storage deposit locked. The projection authority remains distinct from the fee payer, exact costs are estimated from the active cluster, and failed submitted transactions may still consume their network fee.

Expiry, duplicate jobs, RPC timeouts, stale blockhash, dropped/finalized transactions, temporarily unavailable metadata, authority mismatch and partial database/chain completion must converge through reconciliation without a second asset or decreasing the authoritative allowance twice. A failed projection is never presented as proof that access failed.

## Assumptions, decisions, and dependencies

Confirmed product decisions:

- The card is visible in the member's wallet and shows plan, validity and the applicable visit allowance/remaining value.
- It is non-transferable and has no resale, marketplace or access-authority role.
- PostgreSQL remains authoritative; the on-chain object is a public projection.
- Classic is displayed as `Unlimited · one included visit per day`. Public metadata excludes identity, selected gyms and attendance details.

Working implementation defaults requiring readiness review:

- Start with one non-transferable asset per current wallet within a stable membership-card lineage. Compare a Metaplex Core asset with a zero-decimal, supply-one Token-2022 asset using the NonTransferable, Metadata/Metadata Pointer and Group/Group Pointer extensions; adopt neither until the exact MovX combination is proven on Devnet in both required wallets.
- Use concise on-chain fields plus versioned off-chain JSON/image metadata so the remaining Basic count is visible even when a wallet does not render arbitrary metadata attributes. Treat cache refresh timing as a display limitation, not an entitlement transition.
- Use a dedicated server-only projection authority. The DEV0082 sponsor may pay network fees, but fee-payer authority and mint/update authority remain distinct roles and secrets.
- Persist one opaque lineage identifier and an outbox-like expected projection version derived from the current authoritative membership period and confirmed usage. A background or explicitly invoked reconciler may retry a missing/stale chain update without changing membership state.
- Reuse the bounded DEV0082 Devnet sponsor pattern for payment, but not authority: the projection fee payer funds network fees and rent-exempt account deposits, while a dedicated projection authority alone may change the PDA/card state.

Unresolved before `Ready`:

1. Complete DEV0092's PDA-backed Token-2022/Metaplex Core compatibility and lifecycle spike, then adopt the smallest design that renders reliably in current Phantom and Solflare Devnet modes.
2. Define projection-authority creation, staging secret delivery, rotation and loss recovery without committing or returning private key material.
3. Translate DEV0092's retained-inactive/reissue design into DEV0047's protected wallet-replacement evidence without allowing client-directed ownership changes.
4. Decide how expiry synchronization runs when the member does not reopen MovX, and set an acceptable wallet-cache freshness expectation.
5. Confirm whether displaying plan/allowance publicly is automatic for this Devnet demonstration or requires an explicit member acknowledgement before minting.

## Implementation plan

1. Complete DEV0092's bounded PDA/card lifecycle spike: validate one current asset, retained inactive predecessor, metadata updates, transfer rejection, update latency, rent and transaction shape in Phantom/Solflare. Resolve the remaining readiness questions above before implementation continues.
2. Add additive persistence for one actor-owned stable card lineage, its opaque public lineage identifier, current period, expected/applied version, current asset/mint address, generation, lifecycle, public signatures and bounded failure/reconciliation state. Keep each authoritative period, allowance and private membership fact in the existing membership tables.
3. Add server-only configuration and a chain adapter that constructs, simulates, signs and submits only exact MovX projection create/update operations. Validate Devnet genesis, program/account owners, member wallet, update authority, distinct fee payer, lineage/asset uniqueness and finalized outcome. Estimate account deposits from the target cluster and record payer deltas without hard-coded SOL assumptions.
4. Enqueue idempotent lineage/card creation after a member's first verified activation, reuse after later same-wallet activations and a new version after confirmed Basic usage or period status changes. Do not place external RPC submission inside the membership/check-in database transaction.
5. Serve minimal versioned public metadata/media without identity, gym or attendance leakage. Make Basic remaining visits and Classic unlimited access legible in wallets while labeling Devnet/demo status.
6. Add bounded reconciliation for pending, ambiguous and stale projections plus the reviewed wallet-replacement and expiry behavior. Expose private projection status in My Membership without treating it as access state.
7. Add unit, database, transaction-boundary, retry/concurrency and metadata privacy tests; rehearse mint, update, transfer rejection, expiry/reconciliation and wallet rendering on Devnet in Phantom and Solflare.

## Acceptance criteria

- [ ] AC1: Exactly one stable PDA-backed lineage and one non-transferable Devnet card are accepted as current for a member's current period in the exact reviewed wallet; later same-wallet periods reuse them, activation/recovery/retry cannot produce a second lineage or current card, and a reviewed wallet replacement may retain an explicitly inactive historical card.
- [ ] AC2: Phantom and Solflare display a recognizable MovX card with plan and validity; Basic visibly shows ten total, confirmed usage and correct remaining visits, while Classic visibly says `Unlimited · one included visit per day` without a fabricated numerical allowance.
- [ ] AC3: A confirmed Basic check-in advances the expected projection once and a finalized update shows the new remaining value; duplicate/replayed confirmations cannot decrement or update it twice.
- [ ] AC4: PostgreSQL remains authoritative. Mint/update/RPC/indexer/metadata failure leaves valid activation and attendance intact, records bounded reconciliation state and can converge to the same asset/version later.
- [ ] AC5: On-chain metadata and media expose no email, profile/name, selected gyms, reservations, attendance locations/history, payment balance or other private data; the UI explains that the displayed plan/allowance is public Devnet data.
- [ ] AC6: The selected standard enforces transfer rejection on chain, not only in the MovX UI, and the card cannot be presented as a transferable membership, marketplace asset or access credential.
- [ ] AC7: Projection authority and sponsored fee payer are distinct, server-only roles; no private key enters Git, client bundles, HTTP responses or logs, and staging uses the reviewed encrypted-secret path. First creation, fixed-size update and wallet-replacement evidence distinguishes non-refundable transaction fees from account deposits and confirms the member needs no SOL.
- [ ] AC8: The reviewed personal-wallet replacement retains the old card as inactive, establishes one new PDA-matched current card without requiring the old wallet to sign, and remains recoverable after failed or ambiguous metadata/chain operations; stale wallet rendering is disclosed and never grants access.
- [ ] AC9: Focused unit/database/chain-boundary tests, lint, typecheck, formatting, production build and `git diff --check` pass; real Devnet evidence covers wallet rendering, one Basic update and rejected transfer in Phantom and Solflare.

## Validation plan

Use generated local/Devnet-only authorities and fixture memberships; never print or persist secret material in tests or ticket evidence. Test deterministic stable-PDA derivation from opaque lineage identifiers, projection version monotonicity, one-lineage uniqueness, later-period reuse, create/update replay, concurrent jobs, wrong actor/wallet/cluster/program/authority, stale blockhash, ambiguous submission, expired periods, Classic representation, privacy allowlists and failed reconciliation.

Run the focused unit and database suites, the full `npm test`, database replay/lint when schema changes, `npm run lint`, `npm run typecheck`, `npm run format:check`, the production build and `git diff --check`. The manual Devnet rehearsal must record only public asset/transaction addresses and screenshots or observations of Phantom/Solflare rendering, updated Basic remaining visits, non-transferability and expiry/replacement behavior. It must not record authority or sponsor secrets.

## Implementation record

Pending implementation. The product outcome is confirmed, but the ticket remains Draft until the asset standard, authority custody, wallet replacement, expiry synchronization and public-display acknowledgement decisions are reviewed.

### Changes and rationale

Planning only. No runtime, schema, dependency, configuration, transaction or deployment change has been implemented.

### Affected files

| File or component                                                                                               | Change and purpose                                                                                                   |
| --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| [`docs/mvp-spec.md`](../../../docs/mvp-spec.md)                                                                 | Replaces one card/PDA per period with one stable lineage and records the proposed sponsored fee/deposit lifecycle.   |
| [`DEV0092`](DEV0092-validate-pda-membership-card-lifecycle.md)                                                  | Expands the readiness spike to prove cross-period reuse, opaque derivation and exact first/update/replacement costs. |
| [`tickets/README.md`](../../README.md) and [`COR0007`](../organisatory/COR0007-core-multigym-membership-mvp.md) | Keep the current queue and coordination work map aligned with the revised lifecycle.                                 |
| Pending runtime implementation                                                                                  | Final source/schema/configuration components still depend on the selected asset standard and synchronization design. |

### Decisions and deviations

- 2026-09-28: The user added a wallet-visible membership card showing available/remaining visits. The card is a non-transferable public projection rather than access authority; C31 narrows the former no-collectibles decision C10.
- 2026-09-28: Token-2022 is recorded only as a working default. Current wallet documentation supports its NFT/metadata/group surface, while exact non-transferable rendering and updates still require a two-wallet Devnet spike.
- 2026-09-28: The user chose a PDA-tracked current asset and retained inactive historical assets for protected wallet replacement. DEV0092 owns the technical proof; PostgreSQL remains access/check-in authority, while the PDA governs only the public card lineage and current address/generation.
- 2026-09-29: The user rejected one PDA per membership period as awkward. The planned contract now uses one opaque stable card-lineage PDA across sequential periods and reuses the current asset when the reviewed wallet is unchanged; immutable period history remains in PostgreSQL.
- 2026-09-29: The MovX Devnet sponsor is the planned payer for projection network fees and account deposits, but not the projection authority. Initial creation and wallet replacement require account deposits; fixed-size usage, status and later-period updates ordinarily require only transaction fees.

### Contracts, configuration, and operations

No runtime contract has changed yet. Expected future contracts include additive stable-lineage persistence, public metadata/media, a dedicated server-only projection authority, a distinct sponsored fee payer, target-cluster fee/deposit estimation and Devnet reconciliation. Exact environment-variable and migration names remain intentionally undecided until readiness review. Never place actual keys or recovery material in this record.

## Validation results

Planning-document validation only; application and Devnet checks have not run.

- Date and environment: 2026-09-29, repository documentation review.
- Exact commands and outcomes: `npx prettier --check docs/mvp-spec.md tickets/README.md tickets/current/blockchain/DEV0089-wallet-visible-membership-card.md tickets/current/blockchain/DEV0092-validate-pda-membership-card-lifecycle.md tickets/current/organisatory/COR0007-core-multigym-membership-mvp.md` passed; `git diff --check` passed; each repository-relative ticket/spec target named in this record was confirmed to exist.
- Manual steps and observed outcomes: Not run — implementation has not started.
- Failed, blocked, or not-run checks and reasons: application, program and Devnet checks were not applicable to this planning-only revision; all runtime acceptance checks await DEV0092 evidence and implementation.

| Criterion | Evidence                        | Result  |
| --------- | ------------------------------- | ------- |
| AC1–AC9   | Implementation has not started. | Not run |

## Risks, limitations, and follow-ups

Wallets and their indexers may cache metadata or render extension/plugin fields differently, so exact live remaining visits cannot be promised before the Devnet spike. Every public wallet asset exposes its metadata and ownership graph; production privacy/consent needs validation. Server-authorized updates introduce authority custody, rotation and operational retry obligations. A permanently non-transferable card complicates wallet replacement. If reliable Phantom/Solflare display, secure reissue or bounded synchronization requires several independently deployable components, convert this pre-implementation DEV record to a coordination record before coding and create fresh peer tickets as required by `AGENTS.md`.

## Completion and review references

- Completed: Not completed.
- Commit: Initial planning committed in `867bc76` — `[DEV0084][DEV0089] Persist check-ins and plan wallet card`; the first PDA lifecycle refinement was committed as `[DEV0091] [DEV0092] Reconcile records and plan PDA card lifecycle`; the 2026-09-29 stable-lineage and payer-cost revision is not yet committed. No runtime implementation commit exists.
- Review: Product outcome accepted; technical readiness review pending.
- Deployment or release: None.
