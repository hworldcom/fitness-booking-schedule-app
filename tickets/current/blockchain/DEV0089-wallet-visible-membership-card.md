# Ticket DEV0089: Add a wallet-visible membership card

- Status: Draft
- Created: 2026-09-28
- Last updated: 2026-09-28
- Milestone: M2–M3 wallet-visible membership projection
- Coordination: [COR0007 — Core multi-gym membership MVP](../organisatory/COR0007-core-multigym-membership-mvp.md)
- Related records: projects the active period delivered through [DEV0080 — Persist membership activation foundation](../../archive/backend/DEV0080-membership-activation-foundation.md) and [DEV0081 — Activate memberships with Devnet EURC](DEV0081-devnet-membership-activation.md), follows confirmed usage from [DEV0084 — Persist included membership check-ins](../../archive/backend/DEV0084-persist-included-membership-checkins.md), depends on the personal-wallet lifecycle in [DEV0047 — Personal wallet linking and replacement](../backend/DEV0047-personal-wallet-linking-and-replacement.md), and may reuse the fee-payer boundary from [DEV0082 — Sponsor membership network fees](DEV0082-sponsor-membership-network-fees.md) without reusing its authority

## Objective and context

Make each verified Devnet membership period visible in the member's linked Solana wallet as a clearly branded, non-transferable membership card. A Basic card shows the fixed allowance and current remaining visits; a Classic card shows `Unlimited · one included visit per day` rather than a fabricated balance or an unqualified unlimited promise. Plan, validity and status should remain understandable when the member views the asset in Phantom or Solflare.

The current application activates membership access in PostgreSQL after verifying a Devnet-EURC payment. It does not mint an NFT, token or other wallet-visible membership object. This ticket adds a public on-chain **projection** of the private membership state; it does not move access authority out of PostgreSQL and does not make the card a transferable or speculative product. It implements [C31 and the activation projection contract](../../../docs/mvp-spec.md#73-activation) within the [asset and wallet integrity rules](../../../docs/mvp-spec.md#9-asset-wallet-and-demo-integrity).

## Scope and non-goals

- In scope: one idempotently created Devnet membership card per verified period; ownership by the period's reviewed linked member wallet; enforced non-transferability; Basic plan/validity/total/used/remaining presentation; Classic plan/validity/`Unlimited · one included visit per day` presentation; active/expired or superseded projection state; no personal identity, selected gyms, reservation or attendance detail; durable asset identifier, projection version, synchronization state and public transaction evidence; server-authorized create/update transactions; fee-payer separation; retry/reconciliation after chain/RPC/indexer failure; wallet rendering in Phantom and Solflare; automated boundary tests and real Devnet rehearsal.
- Out of scope: using the asset as access or attendance authority; transferable membership, resale, marketplace or financial value; achievement badges; mainnet minting; custom program state unless the reviewed standard cannot meet the accepted behavior; storing personal data or the four selected gyms in public metadata; wallet-native check-in; production renewal/cancellation/refund policy; production legal/privacy approval; embedded-wallet delivery; arbitrary operator minting; several wallet-visible cards for one period.

## Expected behavior and edge cases

After an activation is finalized and exactly one membership period exists, the application creates or resumes one projection operation for that period. A successful projection produces one non-transferable asset owned by the exact personal wallet snapshotted for activation. Replaying activation, retrying the projection or recovering a lost response returns/reconciles the same asset instead of minting another.

For Basic, public card metadata communicates `10 visits included`, confirmed usage and the derived number remaining. A confirmed check-in changes the database first and then advances the wallet projection to the new immutable projection version. For Classic, metadata says `Unlimited · one included visit per day` and never fabricates a large allowance or hides the daily rule. Both plans show their validity end and a truthful active/expired state. The wallet card contains no member name/email, selected-gym list, reservation, check-in location or check-in history.

PostgreSQL remains authoritative for activation and check-ins. Mint or metadata-update failure cannot roll back or invalidate an otherwise valid membership/check-in. Instead the projection remains `pending` or `update_required`, is visibly non-authoritative in MovX, and can be retried against the same expected version. An old wallet rendering may be temporarily stale because wallet/indexer caches are outside MovX control; the application must continue to show the live authoritative balance and disclose the latest confirmed projection state.

The implementation must not silently decide what happens after a protected personal-wallet replacement. Before this ticket becomes Ready, choose and document either controlled revoke/burn plus reissue to the newly proven wallet or retention on the original activation wallet with explicit UI disclosure. The chosen flow must not let a caller redirect an asset by submitting a wallet address.

Expiry, duplicate jobs, RPC timeouts, stale blockhash, dropped/finalized transactions, temporarily unavailable metadata, authority mismatch and partial database/chain completion must converge through reconciliation without a second asset or decreasing the authoritative allowance twice. A failed projection is never presented as proof that access failed.

## Assumptions, decisions, and dependencies

Confirmed product decisions:

- The card is visible in the member's wallet and shows plan, validity and the applicable visit allowance/remaining value.
- It is non-transferable and has no resale, marketplace or access-authority role.
- PostgreSQL remains authoritative; the on-chain object is a public projection.
- Classic is displayed as `Unlimited · one included visit per day`. Public metadata excludes identity, selected gyms and attendance details.

Working implementation defaults requiring readiness review:

- Start with one zero-decimal, supply-one Token-2022 asset per period using the NonTransferable, Metadata/Metadata Pointer and Group/Group Pointer extensions. Phantom documents Token-2022 fungible/non-fungible and metadata/group rendering, but the exact MovX combination must be proven on Devnet in both required wallets before adoption.
- Use concise on-chain fields plus versioned off-chain JSON/image metadata so the remaining Basic count is visible even when a wallet does not render arbitrary metadata attributes. Treat cache refresh timing as a display limitation, not an entitlement transition.
- Use a dedicated server-only projection authority. The DEV0082 sponsor may pay network fees, but fee-payer authority and mint/update authority remain distinct roles and secrets.
- Persist an outbox-like expected projection version derived from the authoritative membership period and confirmed usage. A background or explicitly invoked reconciler may retry a missing/stale chain update without changing membership state.

Unresolved before `Ready`:

1. Compare the exact Token-2022 design against a Metaplex Core asset with `PermanentFreezeDelegate` and attributes, then select the smallest design that renders reliably in current Phantom and Solflare Devnet modes.
2. Define projection-authority creation, staging secret delivery, rotation and loss recovery without committing or returning private key material.
3. Resolve the DEV0047 active-period wallet-replacement behavior and its reissue/revoke evidence.
4. Decide how expiry synchronization runs when the member does not reopen MovX, and set an acceptable wallet-cache freshness expectation.
5. Confirm whether displaying plan/allowance publicly is automatic for this Devnet demonstration or requires an explicit member acknowledgement before minting.

## Implementation plan

1. Run a bounded Devnet compatibility spike for Token-2022 and Metaplex Core: mint one non-transferable sample, update a remaining-visits value and record Phantom/Solflare rendering, transfer rejection, update latency, rent and transaction shape. Resolve the five readiness questions above before implementation continues.
2. Add additive persistence for one actor-owned projection per membership period, expected/applied version, asset/mint address, lifecycle, public signatures and bounded failure/reconciliation state. Keep authoritative allowance and private membership data in the existing membership tables.
3. Add server-only configuration and a chain adapter that constructs, simulates, signs and submits only exact MovX projection create/update operations. Validate Devnet genesis, program/account owners, member wallet, update authority, fee payer, asset uniqueness and finalized outcome.
4. Enqueue idempotent projection creation after verified activation and a new version after confirmed Basic usage or period status changes. Do not place external RPC submission inside the membership/check-in database transaction.
5. Serve minimal versioned public metadata/media without identity, gym or attendance leakage. Make Basic remaining visits and Classic unlimited access legible in wallets while labeling Devnet/demo status.
6. Add bounded reconciliation for pending, ambiguous and stale projections plus the reviewed wallet-replacement and expiry behavior. Expose private projection status in My Membership without treating it as access state.
7. Add unit, database, transaction-boundary, retry/concurrency and metadata privacy tests; rehearse mint, update, transfer rejection, expiry/reconciliation and wallet rendering on Devnet in Phantom and Solflare.

## Acceptance criteria

- [ ] AC1: Exactly one non-transferable Devnet membership card is created for one verified active membership period in the exact reviewed member wallet; activation/recovery/retry cannot produce a duplicate or redirect it.
- [ ] AC2: Phantom and Solflare display a recognizable MovX card with plan and validity; Basic visibly shows ten total, confirmed usage and correct remaining visits, while Classic visibly says `Unlimited · one included visit per day` without a fabricated numerical allowance.
- [ ] AC3: A confirmed Basic check-in advances the expected projection once and a finalized update shows the new remaining value; duplicate/replayed confirmations cannot decrement or update it twice.
- [ ] AC4: PostgreSQL remains authoritative. Mint/update/RPC/indexer/metadata failure leaves valid activation and attendance intact, records bounded reconciliation state and can converge to the same asset/version later.
- [ ] AC5: On-chain metadata and media expose no email, profile/name, selected gyms, reservations, attendance locations/history, payment balance or other private data; the UI explains that the displayed plan/allowance is public Devnet data.
- [ ] AC6: The selected standard enforces transfer rejection on chain, not only in the MovX UI, and the card cannot be presented as a transferable membership, marketplace asset or access credential.
- [ ] AC7: Projection authority and optional fee payer are distinct, server-only roles; no private key enters Git, client bundles, HTTP responses or logs, and staging uses the reviewed encrypted-secret path.
- [ ] AC8: The reviewed personal-wallet replacement and expiry policies complete without duplicate active cards or misleading current status, and failed/ambiguous operations remain recoverable.
- [ ] AC9: Focused unit/database/chain-boundary tests, lint, typecheck, formatting, production build and `git diff --check` pass; real Devnet evidence covers wallet rendering, one Basic update and rejected transfer in Phantom and Solflare.

## Validation plan

Use generated local/Devnet-only authorities and fixture memberships; never print or persist secret material in tests or ticket evidence. Test deterministic metadata derivation, projection version monotonicity, one-period uniqueness, create/update replay, concurrent jobs, wrong actor/wallet/cluster/program/authority, stale blockhash, ambiguous submission, expired periods, Classic representation, privacy allowlists and failed reconciliation.

Run the focused unit and database suites, the full `npm test`, database replay/lint when schema changes, `npm run lint`, `npm run typecheck`, `npm run format:check`, the production build and `git diff --check`. The manual Devnet rehearsal must record only public asset/transaction addresses and screenshots or observations of Phantom/Solflare rendering, updated Basic remaining visits, non-transferability and expiry/replacement behavior. It must not record authority or sponsor secrets.

## Implementation record

Pending implementation. The product outcome is confirmed, but the ticket remains Draft until the asset standard, authority custody, wallet replacement, expiry synchronization and public-display acknowledgement decisions are reviewed.

### Changes and rationale

Planning only. No runtime, schema, dependency, configuration, transaction or deployment change has been implemented.

### Affected files

| File or component | Change and purpose                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------- |
| Pending review    | Final affected components depend on the selected asset standard and synchronization design. |

### Decisions and deviations

- 2026-09-28: The user added a wallet-visible membership card showing available/remaining visits. The card is a non-transferable public projection rather than access authority; C31 narrows the former no-collectibles decision C10.
- 2026-09-28: Token-2022 is recorded only as a working default. Current wallet documentation supports its NFT/metadata/group surface, while exact non-transferable rendering and updates still require a two-wallet Devnet spike.

### Contracts, configuration, and operations

No implementation contract has changed yet. Expected future contracts include additive projection persistence, public metadata/media, a dedicated server-only projection authority, an optional separate fee payer and Devnet reconciliation. Exact environment-variable and migration names remain intentionally undecided until readiness review. Never place actual keys or recovery material in this record.

## Validation results

Planning-document validation only; application and Devnet checks have not run.

- Date and environment: 2026-09-28, repository documentation review.
- Exact commands and outcomes: `npx prettier --check docs/mvp-spec.md tickets/README.md tickets/current/blockchain/DEV0089-wallet-visible-membership-card.md tickets/current/organisatory/COR0007-core-multigym-membership-mvp.md` passed; `git diff --check` passed; each repository-relative ticket/spec target named in this record was confirmed to exist.
- Manual steps and observed outcomes: Not run — implementation has not started.
- Failed, blocked, or not-run checks and reasons: all runtime/Devnet acceptance checks await readiness decisions and implementation.

| Criterion | Evidence                        | Result  |
| --------- | ------------------------------- | ------- |
| AC1–AC9   | Implementation has not started. | Not run |

## Risks, limitations, and follow-ups

Wallets and their indexers may cache metadata or render extension/plugin fields differently, so exact live remaining visits cannot be promised before the Devnet spike. Every public wallet asset exposes its metadata and ownership graph; production privacy/consent needs validation. Server-authorized updates introduce authority custody, rotation and operational retry obligations. A permanently non-transferable card complicates wallet replacement. If reliable Phantom/Solflare display, secure reissue or bounded synchronization requires several independently deployable components, convert this pre-implementation DEV record to a coordination record before coding and create fresh peer tickets as required by `AGENTS.md`.

## Completion and review references

- Completed: Not completed.
- Commit: This change — `[DEV0084][DEV0089] Persist check-ins and plan wallet card`.
- Review: Product outcome accepted; technical readiness review pending.
- Deployment or release: None.
