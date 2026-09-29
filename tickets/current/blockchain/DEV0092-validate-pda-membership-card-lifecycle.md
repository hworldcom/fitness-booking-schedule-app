# Ticket DEV0092: Validate the PDA-backed membership card lifecycle

- Status: Ready
- Created: 2026-09-28
- Last updated: 2026-09-29
- Milestone: M2–M3 wallet-visible membership projection readiness
- Coordination: None — independent development ticket
- Related records: readiness dependency for [DEV0089 — Add a wallet-visible membership card](DEV0089-wallet-visible-membership-card.md); uses active-period data delivered by [DEV0080 — Persist membership activation foundation](../../archive/backend/DEV0080-membership-activation-foundation.md), confirmed usage delivered by [DEV0084 — Persist included membership check-ins](../../archive/backend/DEV0084-persist-included-membership-checkins.md), and the protected personal-wallet lifecycle planned in [DEV0047 — Personal wallet linking and replacement](../backend/DEV0047-personal-wallet-linking-and-replacement.md)

## Objective and context

Validate a small Solana design in which one stable program-derived address (PDA) records a continuing public membership-card lineage across sequential verified membership periods and identifies exactly one current wallet-visible asset. The PDA is derived from an opaque persisted lineage identifier rather than a period identifier or wallet address, so a same-wallet renewal updates the existing PDA and card instead of creating another pair. PostgreSQL retains each immutable membership period and its history. The asset presents the current or most recent period in Phantom or Solflare, while the PDA records which asset generation is current. On a reviewed wallet replacement, MovX keeps the previous asset, updates its recognized metadata to `Inactive`, creates a new non-transferable asset for the new wallet and advances the same PDA to the new asset and generation.

Standard wallets do not execute MovX logic or automatically compare an asset address with an arbitrary PDA. The spike must therefore prove how recognized asset metadata is updated and rendered, rather than claiming that an NFT can read the PDA. It resolves the asset-standard and lifecycle questions that currently keep [DEV0089](DEV0089-wallet-visible-membership-card.md) in Draft under the [activation projection contract](../../../docs/mvp-spec.md#73-activation) and [asset integrity rules](../../../docs/mvp-spec.md#9-asset-wallet-and-demo-integrity).

## Scope and non-goals

- In scope: define the minimal stable public PDA state and opaque lineage seed/version conventions; compare the relevant Metaplex Core and Token-2022 capabilities; prototype one non-transferable current card reused across sequential same-wallet periods and one retained inactive predecessor; prove authorized metadata updates; prove current-asset validation; define renewal versus wallet-replacement behavior; measure transaction shape, non-refundable network fees, rent-exempt account deposits, update latency and Phantom/Solflare cache behavior; document the selected standard, sponsored payer boundary and exact boundary consumed by DEV0089.
- Out of scope: production membership-card persistence or jobs; changing the PostgreSQL access/check-in authority; backend outbox and reconciliation implementation; production authority custody; mainnet; embedded wallets; access or attendance based on asset possession; burning historical cards; user-facing replacement UI; publishing personal identity, selected gyms, reservations or attendance history.

## Expected behavior and edge cases

The prototype initializes one PDA for a fixture membership-card lineage. Its public state includes a schema version, opaque lineage identifier, projection status, current period projection identifier/version, current member wallet, current asset address, asset generation, validity range, plan presentation and projection version. Basic may include public total/used/remaining values; Classic uses `Unlimited · one included visit per day`. It contains no name, email, profile identifier, raw database membership-period identifier, selected-gym list, reservation, attendance location/history or payment balance.

The first verified period creates or resumes the stable PDA and creates the first wallet-visible asset. A later non-overlapping period in the same reviewed wallet updates the same PDA and asset with the new period's plan, validity, status and usage projection. A lapse may leave the card expired until a later verified period reactivates the same lineage; time passing alone does not submit a Solana transaction. Database period records remain separate and immutable even though the public card is reused.

The first wallet-visible asset is non-transferable and displays a recognizable MovX Devnet membership. A verifier accepts it as current only when its address equals the PDA's `current_asset`, its generation matches, the PDA projection status is active and the expected program/standard owns the relevant accounts. Asset possession alone never proves access.

For a reviewed wallet replacement, the old asset is retained rather than burned. MovX updates its standard metadata to an unmistakable inactive presentation, creates a new non-transferable asset for the replacement wallet and advances the PDA's `current_wallet`, `current_asset`, generation and projection version. The transition must either be atomic or use an explicit recoverable intermediate state that cannot leave two assets accepted as current. If the old asset's displayed metadata is stale or its update fails, PDA validation still rejects it; the ticket must record that wallets may temporarily cache an obsolete image or label.

A renewal or later verified period in the same linked wallet updates the existing stable PDA, current asset and projection version instead of creating another PDA or minting another asset. A new asset is reserved for a reviewed wallet replacement or a separately justified future lifecycle. Replays, RPC ambiguity and retries cannot create a second accepted current asset, create a second lineage for the same continuing membership or decrease the authoritative PostgreSQL allowance.

MovX's Devnet sponsor is the working payer, while the projection authority remains a distinct role. Initializing the PDA and first card requires a transaction fee plus the rent-exempt balances needed by the newly created accounts. Ordinary usage, status and same-wallet period updates pay only the transaction fee when they do not create or resize accounts. Wallet replacement pays a transaction fee and the deposit for the new asset but reuses the PDA; keeping the predecessor means its existing storage deposit remains locked until a future authorized close or burn policy. Failed submitted transactions still consume their network fee, while atomic failed account creation must not leave a partly initialized lineage. Reads incur no on-chain transaction fee, although an RPC provider may have off-chain service charges.

## Assumptions, decisions, and dependencies

Confirmed decisions:

- The historical asset is not burned during wallet replacement. It remains in the old wallet and is presented as inactive.
- The PDA records the current asset address and generation. Current-card validation requires an exact match with that state.
- The wallet-visible asset cannot read arbitrary PDA data. MovX must update metadata recognized by the chosen asset standard, and wallet/indexer caching is an explicit display limitation.
- PostgreSQL remains authoritative for membership access and confirmed check-ins. The PDA is authoritative only for the public on-chain card lineage and current-asset relationship; the asset itself is a presentation layer.
- There is at most one accepted current asset for a stable membership-card lineage, although wallet replacement can leave retained inactive historical assets.
- Sequential PostgreSQL membership periods remain distinct. Same-wallet renewal updates the stable PDA and current asset; it does not create another PDA or mint an additional card by default.
- A PDA address itself is free to derive. SOL is required only when the PDA is initialized as an on-chain data account, when another account is created or resized, and when a transaction is submitted.
- For the Devnet demonstration, MovX sponsors both network fees and required account-creation deposits. The fee payer must remain distinct from the projection/update authority even if one bounded service coordinates both signers.

Dependencies and unresolved technical choices:

1. Select Metaplex Core or Token-2022 only after testing non-transferability, authorized metadata updates and recognizable rendering in current Phantom and Solflare Devnet modes.
2. Determine whether replacement can update the old asset, create the new asset and advance the PDA in one transaction. If not, define durable phases, idempotency keys and reconciliation order for DEV0089.
3. Define a dedicated projection authority that can update retained assets without the old wallet's signature. It must be separate from the member wallet and from any network-fee sponsor.
4. Measure wallet/indexer refresh behavior and define truthful UI copy for an old card that can remain visually stale after its on-chain authority state changes.
5. DEV0047 remains responsible for proving that the replacement wallet belongs to the authenticated member. This spike uses fixture wallets and must not create a second wallet-replacement policy.
6. Query the active cluster for exact rent-exempt minimums and estimate the complete first-activation, normal-update and wallet-replacement payer deltas. Current documentation values are illustrative only: the Solana base fee is currently 5,000 lamports per signature plus any priority fee, and a minimal Metaplex Core asset is documented at approximately 0.0029 SOL of account rent. Runtime RPC estimates and measured balance deltas are the acceptance evidence.

## Implementation plan

1. Inspect the installed Solana/Metaplex client versions and record the exact Devnet programs, account ownership, extensions/plugins and authority roles required by each candidate standard.
2. Specify the stable PDA seeds, discriminator/schema version, opaque lineage identifier, bounded public fields, status/generation invariants and authorized instructions. Keep period history and private membership facts in PostgreSQL; do not derive the PDA from the member wallet or an individual period.
3. Implement the smallest local test program and client needed to initialize the projection, bind the current asset, advance its projection version and replace the current asset without accepting two generations.
4. Build the leading standard's fixture card and, where documentation alone cannot settle compatibility, the alternative fixture. Exercise first-period creation, confirmed-usage update, expiry, a later same-wallet period using the same PDA/card, prohibited transfer and wallet replacement with a retained inactive asset.
5. Test failure boundaries: duplicate/replayed replacement, wrong authority/member/PDA/asset/standard, stale generation, partial transition, ambiguous RPC response and failed old-metadata refresh.
6. Rehearse the selected path on Devnet in Phantom and Solflare. Record only public addresses, signatures, screenshots/observations, refresh latency, exact fee-payer balance deltas, queried rent-exempt minimums and transaction shape. Separate non-refundable transaction fees from recoverable account-storage deposits.
7. Update DEV0089 with the selected standard, state/authority contract, atomic or reconciled replacement sequence and evidence. Do not begin DEV0089 runtime integration until this ticket completes.

## Acceptance criteria

- [ ] AC1: One stable, versioned fixture PDA derived from an opaque lineage identifier permits exactly one current non-transferable membership asset and rejects an asset with the wrong address, generation, owner, program or projection status; it is not keyed by wallet or membership-period identifier.
- [ ] AC2: A reviewed fixture-wallet replacement retains the old asset, makes it invalid through the PDA immediately, gives it a recognized inactive metadata presentation and establishes exactly one new current asset without requiring the old wallet to sign.
- [ ] AC3: Retry, replay, timeout and partial-failure tests demonstrate an atomic transition or a documented idempotent state machine that cannot leave two accepted current assets.
- [ ] AC4: A later verified period in the same wallet updates the same PDA and current asset rather than creating either again, while PostgreSQL retains both period records and an inactive historical asset cannot become current without a separately authorized replacement transition.
- [ ] AC5: Phantom and Solflare Devnet evidence records whether the active and inactive cards render recognizably, how quickly updates appear and what stale-cache limitation remains.
- [ ] AC6: The selected standard rejects ordinary owner transfer on chain and preserves a dedicated update path for the server-controlled projection authority; the projection authority and fee payer are distinct roles. Evidence separates the initial PDA/card deposits, normal update fees and replacement-asset deposit, and proves that same-wallet period updates require no new account deposit when account sizes are unchanged.
- [ ] AC7: PDA state and asset metadata expose no identity, selected gyms, reservations, attendance locations/history or payment details, and possession of either asset is not treated as membership access.
- [ ] AC8: DEV0089 is updated with the selected standard, exact PDA/asset/authority contracts, replacement and renewal sequences, recovery boundary and public Devnet evidence required before it becomes Ready.
- [ ] AC9: Focused program/client tests, formatting, lint/type checks applicable to the prototype and `git diff --check` pass; any omitted repository-wide build is explicitly justified.

## Validation plan

Use generated local and Devnet-only fixture authorities. Never read, print, commit or request a production key, recovery phrase or personal wallet keypair. Simulate every Devnet transaction before requesting any wallet signature, and record the cluster, fee payer, authority, asset/PDA addresses and intended state transition.

Run focused program tests with LiteSVM, Mollusk or Surfpool as appropriate, plus client tests for deterministic stable-PDA derivation, opaque-lineage uniqueness, account owner/discriminator validation, generation monotonicity, cross-period reuse, idempotency and recovery. Exercise current, expired, inactive, wrong-generation, wrong-authority and stale-metadata cases. Run the applicable lint, typecheck and formatting commands and `git diff --check`.

The manual Devnet matrix covers first creation, usage/status update, later same-wallet period reuse, prohibited transfer and replacement across Phantom and Solflare. Record public transaction/asset addresses, fee-payer balance deltas and rendering observations without recording authority secrets. Distinguish transaction fees from account deposits and on-chain finality from wallet/indexer refresh time.

## Implementation record

Pending implementation. This reviewed ticket records the accepted lifecycle and a bounded compatibility/program spike; no Solana program, asset, transaction, schema, dependency, environment variable or runtime integration has been created by this planning change.

### Changes and rationale

Planning only. The ticket separates technical validation of the PDA/asset lifecycle from DEV0089's production projection persistence and synchronization work. The current specification and DEV0089 now record the confirmed stable-lineage, same-wallet period-reuse, retained-inactive replacement and sponsored-cost behavior without selecting an untested asset standard.

### Affected files

| File or component                                      | Change and purpose                                                                                                                                    |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`docs/mvp-spec.md`](../../../docs/mvp-spec.md)        | Clarifies one stable card lineage across sequential periods, retained inactive predecessors, sponsored fee timing and the unchanged access authority. |
| [`DEV0089`](DEV0089-wallet-visible-membership-card.md) | Records DEV0092 as a readiness dependency and aligns period reuse, replacement, sponsorship and acceptance criteria with the confirmed lifecycle.     |
| [`tickets/README.md`](../../README.md)                 | Summarizes the stable-lineage validation scope while preserving DEV0092 as Ready.                                                                     |
| Pending spike                                          | Final implementation files depend on the reviewed program scaffold and selected asset standard.                                                       |

### Decisions and deviations

- 2026-09-28: The user chose retained inactive historical assets rather than mandatory burning. A replacement advances the PDA to a new current asset; stale wallet display does not restore validity.
- 2026-09-28: The PDA is deliberately authoritative only for public asset lineage. Existing PostgreSQL membership and attendance state remains the access authority required by the MVP contract.
- 2026-09-29: Replaced the awkward one-PDA-per-period default with one stable opaque membership-card lineage. Sequential periods remain immutable in PostgreSQL, while same-wallet activation/renewal reuses the PDA and card.
- 2026-09-29: MovX sponsors Devnet projection transactions and account-creation deposits. Initial creation and wallet replacement require deposits; fixed-size usage, status and period updates pay transaction fees only. Fee payer and projection authority remain separate roles.

### Contracts, configuration, and operations

No runtime contract or configuration has changed. Expected future outputs are a versioned stable public PDA layout, opaque lineage seed contract, instruction/authority contract, payer-cost model and selected asset-standard contract. Exact rent must be queried from the target cluster rather than hard-coded. Actual environment-variable names and secret delivery remain outside this spike until the standard and authority model are validated.

## Validation results

Planning-document checks only; program, client, Devnet and wallet tests have not run.

- `npx prettier --check docs/mvp-spec.md tickets/README.md tickets/current/blockchain/DEV0089-wallet-visible-membership-card.md tickets/current/blockchain/DEV0092-validate-pda-membership-card-lifecycle.md tickets/current/organisatory/COR0007-core-multigym-membership-mvp.md` passed on 2026-09-29.
- `git diff --check` passed on 2026-09-29.
- Targeted wording searches found no remaining one-PDA-per-period contract in the current specification or DEV0089/DEV0092/COR0007 records.
- Every repository-relative specification, ticket and dependency target named by this planning change exists.
- Application, program and Devnet checks were not run because this change edits planning/product-contract Markdown only; AC1–AC9 remain implementation work.

| Criterion | Evidence                        | Result  |
| --------- | ------------------------------- | ------- |
| AC1–AC9   | Implementation has not started. | Not run |

## Risks, limitations, and follow-ups

Wallets may cache metadata and may render the same standard differently, so `Inactive` cannot be treated as an immediate visual guarantee. Retaining historical assets can clutter the old wallet, but preserves an auditable replacement trail and works when the old wallet is unavailable. A custom program adds deployment, upgrade-authority, testing and audit responsibilities that DEV0089 did not previously require. If the spike reveals multiple independently deployable production components, DEV0089 must remain intact because it already has planning commit history; create a separate coordination record and fresh peer implementation tickets instead of expanding it silently.

## Completion and review references

- Completed: Not completed.
- Commit: Initial planning committed as `[DEV0091] [DEV0092] Reconcile records and plan PDA card lifecycle`; the 2026-09-29 stable-lineage and payer-cost revision is not yet committed.
- Review: Scope reviewed against DEV0089 and the current MVP authority boundary; technical evidence pending.
- Deployment or release: None.
