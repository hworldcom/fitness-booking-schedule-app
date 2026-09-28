# Ticket DEV0092: Validate the PDA-backed membership card lifecycle

- Status: Ready
- Created: 2026-09-28
- Last updated: 2026-09-28
- Milestone: M2–M3 wallet-visible membership projection readiness
- Coordination: None — independent development ticket
- Related records: readiness dependency for [DEV0089 — Add a wallet-visible membership card](DEV0089-wallet-visible-membership-card.md); uses active-period data delivered by [DEV0080 — Persist membership activation foundation](../../archive/backend/DEV0080-membership-activation-foundation.md), confirmed usage delivered by [DEV0084 — Persist included membership check-ins](../../archive/backend/DEV0084-persist-included-membership-checkins.md), and the protected personal-wallet lifecycle planned in [DEV0047 — Personal wallet linking and replacement](../backend/DEV0047-personal-wallet-linking-and-replacement.md)

## Objective and context

Validate a small Solana design in which one program-derived address (PDA) records the public membership-card lineage for a verified membership period and identifies exactly one current wallet-visible asset. The asset presents the membership in Phantom or Solflare, while the PDA records which asset generation is current. On a reviewed wallet replacement, MovX keeps the previous asset, updates its recognized metadata to `Inactive`, creates a new non-transferable asset for the new wallet and advances the PDA to the new asset and generation.

Standard wallets do not execute MovX logic or automatically compare an asset address with an arbitrary PDA. The spike must therefore prove how recognized asset metadata is updated and rendered, rather than claiming that an NFT can read the PDA. It resolves the asset-standard and lifecycle questions that currently keep [DEV0089](DEV0089-wallet-visible-membership-card.md) in Draft under the [activation projection contract](../../../docs/mvp-spec.md#73-activation) and [asset integrity rules](../../../docs/mvp-spec.md#9-asset-wallet-and-demo-integrity).

## Scope and non-goals

- In scope: define the minimal public PDA state and seed/version conventions; compare the relevant Metaplex Core and Token-2022 capabilities; prototype one non-transferable current card and one retained inactive predecessor; prove authorized metadata updates; prove current-asset validation; define renewal versus wallet-replacement behavior; measure transaction shape, rent, update latency and Phantom/Solflare cache behavior; document the selected standard and the exact boundary consumed by DEV0089.
- Out of scope: production membership-card persistence or jobs; changing the PostgreSQL access/check-in authority; backend outbox and reconciliation implementation; production authority custody; mainnet; embedded wallets; access or attendance based on asset possession; burning historical cards; user-facing replacement UI; publishing personal identity, selected gyms, reservations or attendance history.

## Expected behavior and edge cases

The prototype initializes one PDA for a fixture membership period. Its public state includes a schema version, projection status, current member wallet, current asset address, asset generation, validity range, plan presentation and projection version. Basic may include public total/used/remaining values; Classic uses `Unlimited · one included visit per day`. It contains no name, email, profile identifier, selected-gym list, reservation, attendance location/history or payment balance.

The first wallet-visible asset is non-transferable and displays a recognizable MovX Devnet membership. A verifier accepts it as current only when its address equals the PDA's `current_asset`, its generation matches, the PDA projection status is active and the expected program/standard owns the relevant accounts. Asset possession alone never proves access.

For a reviewed wallet replacement, the old asset is retained rather than burned. MovX updates its standard metadata to an unmistakable inactive presentation, creates a new non-transferable asset for the replacement wallet and advances the PDA's `current_wallet`, `current_asset`, generation and projection version. The transition must either be atomic or use an explicit recoverable intermediate state that cannot leave two assets accepted as current. If the old asset's displayed metadata is stale or its update fails, PDA validation still rejects it; the ticket must record that wallets may temporarily cache an obsolete image or label.

A renewal in the same linked wallet updates the existing current asset and projection version instead of minting another asset. A new asset is reserved for a reviewed wallet replacement or a separately justified future lifecycle. Replays, RPC ambiguity and retries cannot create a second accepted current asset or decrease the authoritative PostgreSQL allowance.

## Assumptions, decisions, and dependencies

Confirmed decisions:

- The historical asset is not burned during wallet replacement. It remains in the old wallet and is presented as inactive.
- The PDA records the current asset address and generation. Current-card validation requires an exact match with that state.
- The wallet-visible asset cannot read arbitrary PDA data. MovX must update metadata recognized by the chosen asset standard, and wallet/indexer caching is an explicit display limitation.
- PostgreSQL remains authoritative for membership access and confirmed check-ins. The PDA is authoritative only for the public on-chain card lineage and current-asset relationship; the asset itself is a presentation layer.
- There is at most one accepted current asset for a membership period, although wallet replacement can leave retained inactive historical assets.
- Same-wallet renewal updates the current asset; it does not mint an additional card by default.

Dependencies and unresolved technical choices:

1. Select Metaplex Core or Token-2022 only after testing non-transferability, authorized metadata updates and recognizable rendering in current Phantom and Solflare Devnet modes.
2. Determine whether replacement can update the old asset, create the new asset and advance the PDA in one transaction. If not, define durable phases, idempotency keys and reconciliation order for DEV0089.
3. Define a dedicated projection authority that can update retained assets without the old wallet's signature. It must be separate from the member wallet and from any network-fee sponsor.
4. Measure wallet/indexer refresh behavior and define truthful UI copy for an old card that can remain visually stale after its on-chain authority state changes.
5. DEV0047 remains responsible for proving that the replacement wallet belongs to the authenticated member. This spike uses fixture wallets and must not create a second wallet-replacement policy.

## Implementation plan

1. Inspect the installed Solana/Metaplex client versions and record the exact Devnet programs, account ownership, extensions/plugins and authority roles required by each candidate standard.
2. Specify the PDA seeds, discriminator/schema version, bounded public fields, status/generation invariants and authorized instructions. Keep private membership facts in PostgreSQL.
3. Implement the smallest local test program and client needed to initialize the projection, bind the current asset, advance its projection version and replace the current asset without accepting two generations.
4. Build the leading standard's fixture card and, where documentation alone cannot settle compatibility, the alternative fixture. Exercise create, metadata update, prohibited transfer, same-wallet renewal and wallet replacement with a retained inactive asset.
5. Test failure boundaries: duplicate/replayed replacement, wrong authority/member/PDA/asset/standard, stale generation, partial transition, ambiguous RPC response and failed old-metadata refresh.
6. Rehearse the selected path on Devnet in Phantom and Solflare. Record only public addresses, signatures, screenshots/observations, refresh latency, rent and transaction shape.
7. Update DEV0089 with the selected standard, state/authority contract, atomic or reconciled replacement sequence and evidence. Do not begin DEV0089 runtime integration until this ticket completes.

## Acceptance criteria

- [ ] AC1: A versioned fixture PDA permits exactly one current non-transferable membership asset and rejects an asset with the wrong address, generation, owner, program or projection status.
- [ ] AC2: A reviewed fixture-wallet replacement retains the old asset, makes it invalid through the PDA immediately, gives it a recognized inactive metadata presentation and establishes exactly one new current asset without requiring the old wallet to sign.
- [ ] AC3: Retry, replay, timeout and partial-failure tests demonstrate an atomic transition or a documented idempotent state machine that cannot leave two accepted current assets.
- [ ] AC4: Same-wallet renewal updates the existing current asset rather than minting another asset, while an inactive historical asset cannot become current without a separately authorized replacement transition.
- [ ] AC5: Phantom and Solflare Devnet evidence records whether the active and inactive cards render recognizably, how quickly updates appear and what stale-cache limitation remains.
- [ ] AC6: The selected standard rejects ordinary owner transfer on chain and preserves a dedicated update path for the server-controlled projection authority; the projection authority and fee payer are distinct roles.
- [ ] AC7: PDA state and asset metadata expose no identity, selected gyms, reservations, attendance locations/history or payment details, and possession of either asset is not treated as membership access.
- [ ] AC8: DEV0089 is updated with the selected standard, exact PDA/asset/authority contracts, replacement and renewal sequences, recovery boundary and public Devnet evidence required before it becomes Ready.
- [ ] AC9: Focused program/client tests, formatting, lint/type checks applicable to the prototype and `git diff --check` pass; any omitted repository-wide build is explicitly justified.

## Validation plan

Use generated local and Devnet-only fixture authorities. Never read, print, commit or request a production key, recovery phrase or personal wallet keypair. Simulate every Devnet transaction before requesting any wallet signature, and record the cluster, fee payer, authority, asset/PDA addresses and intended state transition.

Run focused program tests with LiteSVM, Mollusk or Surfpool as appropriate, plus client tests for deterministic PDA derivation, account owner/discriminator validation, generation monotonicity, idempotency and recovery. Exercise current, inactive, wrong-generation, wrong-authority and stale-metadata cases. Run the applicable lint, typecheck and formatting commands and `git diff --check`.

The manual Devnet matrix covers create, update, prohibited transfer, same-wallet renewal and replacement across Phantom and Solflare. Record public transaction/asset addresses and rendering observations without recording authority secrets. Distinguish on-chain finality from wallet/indexer refresh time.

## Implementation record

Pending implementation. This reviewed ticket records the accepted lifecycle and a bounded compatibility/program spike; no Solana program, asset, transaction, schema, dependency, environment variable or runtime integration has been created by this planning change.

### Changes and rationale

Planning only. The ticket separates technical validation of the PDA/asset lifecycle from DEV0089's production projection persistence and synchronization work. The current specification and DEV0089 now record the confirmed retained-inactive/current-PDA behavior without selecting an untested asset standard.

### Affected files

| File or component                                      | Change and purpose                                                                                                                      |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| [`docs/mvp-spec.md`](../../../docs/mvp-spec.md)        | Clarifies one current card, retained inactive predecessors and the PDA/metadata replacement boundary without changing access authority. |
| [`DEV0089`](DEV0089-wallet-visible-membership-card.md) | Records DEV0092 as a readiness dependency and aligns replacement scope and acceptance criteria with the confirmed lifecycle.            |
| [`tickets/README.md`](../../README.md)                 | Registers DEV0092 as Ready and advances the next available DEV identifier.                                                              |
| Pending spike                                          | Final implementation files depend on the reviewed program scaffold and selected asset standard.                                         |

### Decisions and deviations

- 2026-09-28: The user chose retained inactive historical assets rather than mandatory burning. A replacement advances the PDA to a new current asset; stale wallet display does not restore validity.
- 2026-09-28: The PDA is deliberately authoritative only for public asset lineage. Existing PostgreSQL membership and attendance state remains the access authority required by the MVP contract.

### Contracts, configuration, and operations

No runtime contract or configuration has changed. Expected future outputs are a versioned public PDA layout, instruction/authority contract and selected asset-standard contract. Actual environment-variable names and secret delivery remain outside this spike until the standard and authority model are validated.

## Validation results

Planning-document checks only; program, client, Devnet and wallet tests have not run.

- `npx prettier --check` passed for all currently changed ticket/specification files.
- `git diff --check` passed.
- Targeted identifier and wording searches confirmed DEV0092 is unique, the next available identifier is DEV0093 and current DEV0089/COR0007 records link to the new dependency.
- Repository-relative links introduced by this planning change were checked against the filesystem.

| Criterion | Evidence                        | Result  |
| --------- | ------------------------------- | ------- |
| AC1–AC9   | Implementation has not started. | Not run |

## Risks, limitations, and follow-ups

Wallets may cache metadata and may render the same standard differently, so `Inactive` cannot be treated as an immediate visual guarantee. Retaining historical assets can clutter the old wallet, but preserves an auditable replacement trail and works when the old wallet is unavailable. A custom program adds deployment, upgrade-authority, testing and audit responsibilities that DEV0089 did not previously require. If the spike reveals multiple independently deployable production components, DEV0089 must remain intact because it already has planning commit history; create a separate coordination record and fresh peer implementation tickets instead of expanding it silently.

## Completion and review references

- Completed: Not completed.
- Commit: Planning change — `[DEV0091] [DEV0092] Reconcile records and plan PDA card lifecycle`.
- Review: Scope reviewed against DEV0089 and the current MVP authority boundary; technical evidence pending.
- Deployment or release: None.
