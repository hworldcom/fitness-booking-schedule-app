# Ticket DEV0136: Integrate coach wallet replacement

- Status: Cancelled
- Created: 2026-10-05
- Last updated: 2026-10-07
- Milestone: Marketplace M6 wallet recovery integration
- Coordination: [COR0010 — Coach-pass and group-funded marketplace MVP](../organisatory/COR0010-group-funded-coach-marketplace-mvp.md)
- Related records: extends the message-proof and account-binding lifecycle in [DEV0047 — Personal wallet linking and replacement](../backend/DEV0047-personal-wallet-linking-and-replacement.md); consumes the finalized coach-pass operation boundary from [DEV0130 — Integrate Devnet coach-pass operations](DEV0130-integrate-devnet-coach-pass-operations.md) and the finalized EventPool state supplied by [DEV0122 — Integrate Devnet group-event funding](DEV0122-integrate-devnet-group-event-funding.md); uses the local `CoachAuthority` rotation contract delivered by [DEV0127 — Implement the coach-client credit ledger](../../archive/blockchain/DEV0127-implement-coach-client-credit-ledger.md)

## Objective and context

Let a coach replace the single personal wallet shown and used by MovX without requiring the coach to keep two user wallets. Coordinate the off-chain personal-wallet binding with the stable on-chain `CoachAuthority` account, while preserving immutable recipients and preventing a wallet change from stranding an unpaid EventPool payout at the old address.

DEV0047 already implements message-only replacement for the application binding and deliberately excludes transactions. The marketplace program separately supports `CoachAuthority` rotation through the configured recovery authority plus the replacement wallet. This ticket owns the missing chain-aware replacement workflow; it does not rewrite DEV0047's completed implementation history.

## Scope and non-goals

- In scope: detect whether the coach has a `CoachAuthority`; verify finalized EventPool blockers; keep the old application binding active while replacement is pending; collect the replacement wallet's proof and transaction signature; prepare, simulate, platform-fund, submit, verify and recover the authority-rotation operation; activate the new binding only after finalized `CoachAuthority.current_wallet` matches it; present bounded blocked/pending/recovered outcomes; test authorization, state ordering and ambiguity.
- In scope: block replacement while any EventPool bound to that `CoachAuthority` is `Funding` or `Succeeded`; allow replacement when all bound pools are `Failed` or `Paid`; fail closed when required pool state is unavailable or stale; never rewrite an EventPool's immutable payout recipient.
- Out of scope: multiple active user wallets, changing historical offer/payment/event recipients, migrating vault funds, mainnet, production custody, lost-recovery-authority administration, arbitrary payout redirection, or letting the platform payer act as the coach, recovery authority or replacement wallet.

## Expected behavior and edge cases

A coach normally connects and manages one personal wallet. The stable `CoachAuthority` program-derived address (PDA) is an internal marketplace identity, not a second wallet the coach must hold or fund.

For an account with no on-chain `CoachAuthority`, replacement remains DEV0047's message-only atomic binding change. For a coach with an authority account, MovX proves the new wallet, reads authoritative finalized pool state and starts a recoverable rotation operation. The old wallet binding remains active until the chain confirms the new current wallet; only then may the application revoke the old binding and activate the new one.

Replacement is refused when a bound pool is still `Funding`, because it may later owe its frozen recipient, or `Succeeded`, because its payout is still unpaid. The coach first settles a due funding pool and, when successful, claims its payout to the original immutable recipient. `Failed` pools do not block participant refunds, and `Paid` pools have no remaining coach payout, so those terminal states permit replacement. A pool that is past its deadline but still recorded as `Funding` remains a blocker until settlement records the outcome.

Rejected signatures and simulation or submission failures leave the old binding active. When an RPC response is ambiguous, the service reads finalized `CoachAuthority` state and the persisted operation before offering another mutation. It must not revoke the old binding merely because a signature exists or a browser reports success.

## Assumptions, decisions, and dependencies

The user adopted the one-wallet rule on 2026-10-05: coaches are not expected to keep a second user wallet; `Funding` and unpaid `Succeeded` EventPools block replacement; `Failed` and `Paid` pools do not; and rotation never changes a pool's frozen payout recipient.

The local program already requires both the recorded recovery authority and replacement wallet to sign `rotate_coach_authority`. Platform sponsorship remains separate: the payer may fund the network fee but gains no recovery, coach, payout or replacement authority. Before implementation, freeze who operates the recovery authority, how an authenticated replacement request authorizes that co-signature, its key storage/rotation procedure and its bounded signing policy. This proposed operational default is not yet a confirmed user decision.

DEV0130 must provide the deployed `CoachAuthority` identity and finalized operation/recovery primitives. DEV0122 must provide trustworthy finalized EventPool state keyed by the actual `coach_authority` PDA and now owns correction of the known database verifier comparison between the coach wallet and that PDA. Until DEV0122 supplies that evidence, this workflow must query authoritative chain state and fail closed rather than trust the mismatched projection.

## Implementation plan

1. Freeze the recovery-authority operator, policy, storage, audit and transaction-signing sequence separately from the platform payer.
2. Define one idempotent replacement operation that binds account, old/new wallet, `CoachAuthority`, authority epoch, cluster and expiry without storing secret material.
3. Read finalized `CoachAuthority` and all bound EventPool states; return a stable blocked result for `Funding`, `Succeeded`, stale or unavailable evidence.
4. Reuse DEV0047's recent email reauthentication and new-wallet message proof, then prepare and simulate the rotation transaction with the replacement wallet, recovery authority and platform payer in their distinct roles.
5. Submit and recover the operation from finalized authority state; revoke the old application binding and activate the new one only after the verified wallet and epoch transition match the prepared operation.
6. Add service, database, transaction and browser tests for allowed/blocked pool states, signer separation, rejection, concurrency, expiry, ambiguous results and reload.
7. Rehearse one Devnet replacement with no outstanding pool, plus refused `Funding` and `Succeeded` cases, and record public/non-secret evidence.

## Acceptance criteria

- [ ] AC1: The coach manages one user-facing personal wallet; the `CoachAuthority` PDA is presented as an internal stable marketplace identity, not a wallet the coach must maintain.
- [ ] AC2: A finalized bound EventPool in `Funding` or `Succeeded` blocks wallet replacement, including past-deadline `Funding`; `Failed` and `Paid` do not block it.
- [ ] AC3: Replacement never changes an Offer or EventPool's immutable historical recipient, and the interface explains the required settle/payout action without suggesting funds can be redirected.
- [ ] AC4: Recent application reauthentication and proof from the replacement wallet are required; the old wallet is not required and remains the active binding until finalized rotation succeeds.
- [ ] AC5: Recovery-authority, replacement-wallet and platform-payer signers remain distinct; sponsorship pays the fee but grants no coach, recovery, payout or replacement authority.
- [ ] AC6: Rejection, stale or unavailable pool evidence, RPC ambiguity, concurrent retries and reload cannot revoke the old binding, activate two bindings or rotate twice.
- [ ] AC7: Focused database/service/transaction/browser tests and one real Devnet rehearsal pass with exact finalized authority epoch/wallet evidence and no secret material recorded.

## Validation plan

Exercise coaches with no authority and with finalized `Funding`, past-deadline `Funding`, `Succeeded`, `Failed` and `Paid` pools. Assert blocker evaluation uses the actual `CoachAuthority` PDA and fails closed for unavailable, stale, malformed or wrong-program evidence. Test wrong recovery authority, wrong replacement signer, sponsor-only signing, replay, concurrent replacement, expired reauthentication/proof, user rejection, failed simulation and ambiguous submission. Verify the old binding remains active until a finalized matching rotation, historical recipients remain unchanged and retry recovers the same authority epoch. Run focused database and TypeScript tests, Rust/generated-client checks if the transaction interface changes, static/build/browser checks, and a Devnet replacement rehearsal.

## Implementation record

Not started.

### Changes and rationale

Pending implementation. The planning decision separates the invisible stable PDA from the coach's one user-facing wallet and protects old-address EventPool liabilities without introducing recipient migration.

### Affected files

Planned: wallet replacement service and operation persistence, finalized CoachAuthority/EventPool readers, sponsored transaction adapter, wallet settings presentation and focused tests. The program instruction is expected to remain unchanged unless implementation review finds a contract defect.

### Decisions and deviations

None yet beyond the adopted one-wallet and pool-blocker rules recorded above.

### Contracts, configuration, and operations

Expected to reuse the existing program ID, `rotate_coach_authority` instruction, DEV0047 binding/challenge records and the server-only platform-payer boundary. Recovery-authority configuration and signing policy must be named and documented without exposing its secret before implementation begins.

## Validation results

Not run — implementation has not started.

## Risks, limitations, and follow-ups

The replacement path is both an account-recovery and financial-authority boundary. A stale or incomplete EventPool scan could strand a payment at the old recipient, while premature off-chain revocation could leave application and chain authority inconsistent. The implementation must therefore fail closed, preserve the old binding through ambiguity and use finalized state rather than browser or unchecked projection claims.

This P0 rule may temporarily delay wallet recovery until a due pool is settled and, after success, paid. Changing that tradeoff later would require a separately reviewed recipient-migration or payout-recovery design.

## Scheduling-only branch disposition

Cancelled on 2026-10-07 before implementation because the scheduling-only product has no wallet or on-chain coach authority. No rotation behavior or acceptance criterion is claimed as delivered.

## Completion and review references

- Completed: Cancelled on 2026-10-07 before implementation.
- Commit: Not created.
- Review: Planning self-review only.
- Deployment or release: None.
