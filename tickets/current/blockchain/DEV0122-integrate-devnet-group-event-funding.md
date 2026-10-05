# Ticket DEV0122: Integrate Devnet group-event funding

- Status: In progress
- Created: 2026-10-04
- Last updated: 2026-10-05
- Milestone: Marketplace M6 Devnet funding integration
- Coordination: [COR0010 — Coach-pass and group-funded marketplace MVP](../organisatory/COR0010-group-funded-coach-marketplace-mvp.md)
- Related records: depends on completed [DEV0121 — Implement the group-event funding program](../../archive/blockchain/DEV0121-implement-group-event-funding-program.md), completed [DEV0120 — Persist group-event catalogue and projections](../../archive/backend/DEV0120-persist-group-event-catalogue-and-projections.md), the completed platform-payer boundary in [DEV0132](../../archive/blockchain/DEV0132-make-coach-pass-operations-platform-funded.md), the completed EURC contract in [DEV0134](../../archive/blockchain/DEV0134-adopt-eurc-for-marketplace-payments.md) and personal-wallet authority from [DEV0047](../backend/DEV0047-personal-wallet-linking-and-replacement.md); supplies contracts to [DEV0123](../frontend/DEV0123-present-group-event-creation-and-funding.md), finalized pool-state evidence to [DEV0136 — Integrate coach wallet replacement](DEV0136-integrate-coach-wallet-replacement.md), and evidence to [DEV0125](../backend/DEV0125-rehearse-hosted-marketplace-loops.md)

## Objective and context

Connect the local EventPool contract to recoverable official Devnet test-EURC operations—coach creation, participant funding, permissionless settlement, coach payout and participant refund—without requiring test SOL in coach or participant wallets.

## Scope and non-goals

- In scope: server-authoritative transaction preparation; readiness and token-account checks; simulation; wallet plus bounded platform-payer signing; platform payment of every fee and rent deposit; idempotent operation/reference records; submission/finalized verification; lost-response recovery; correction of the DEV0120 projection verifier's PDA-versus-wallet mapping; chain indexing into DEV0120 projections; deploy/configuration documentation; real Devnet success and failure rehearsals.
- Out of scope: final page composition, mainnet, automatic attendance/disputes, production keeper guarantees, Kora migration, fiat onramp or arbitrary tokens.

## Expected behavior and edge cases

Every approval clearly identifies Devnet, test EURC, amount, authority, vault/destination and the MovX platform payer. The platform pays every fee and rent deposit; coaches and participants still sign their actions and participants supply exact test-EURC contributions. A coach's creation choices are server-validated against the stored schedule and program bounds; later browser requests cannot redefine the immutable financial terms read from the chain. Rejection, insufficient balance, missing account, stale blockhash, RPC timeout or ambiguous response remains recoverable and cannot duplicate value movement. Settlement may be initiated by any caller, while payout/refund authority remains program-enforced.

The indexed pool contract distinguishes the `CoachAuthority` PDA from its current coach wallet and from the immutable payout recipient captured when a pool is created. A `Funding` or `Succeeded` pool remains a wallet-replacement blocker; `Failed` and `Paid` do not. Indexing or verifier failure must expose unavailable/stale evidence rather than authorizing rotation or comparing the coach wallet to the PDA.

## Assumptions, decisions, and dependencies

Pin/verify official Devnet mint, program and decimals plus deployable program/upgrade authority before use. Credentialed RPC and platform-payer material stay server-only and remain separate from recovery/deployment authority. Reuse generic transaction/recovery patterns only after reviewing their current dependencies.

The user confirmed on 2026-10-05 that the remaining DEV0122 testing will run through the local application and local database because current Cloudflare issues make hosted rehearsal unreliable. The local application still targets the real deployed Solana Devnet program and official test EURC, so public chain evidence remains required. This sequencing decision does not treat local execution as proof of Cloudflare Worker compatibility; the hosted integrated rehearsal remains separately owned by DEV0125 after the platform issue is resolved.

Before trusting the completed DEV0120 projection, correct its known verifier mismatch: on-chain `EventPool.coach_authority` is the PDA, while `payout_recipient` is the coach wallet frozen at creation. The current database comparison of the saved coach wallet to verified `coach_authority` and its same-value test fixture are not valid evidence. DEV0122 owns this cross-cutting database correction as part of its finalized indexing boundary; the ticket remains primarily blockchain work because verified chain interpretation and reconciliation are its central deliverable.

## Implementation plan

1. Freeze environment and operation contracts plus deployment/upgrade procedure.
2. Implement prepare/simulate/sign/submit/verify/recover boundaries for every instruction.
3. Correct and test the projection's PDA-versus-wallet mapping, then implement finalized account/event indexing and idempotent projection reconciliation with explicit `Funding`/`Succeeded` replacement-blocker evidence for DEV0136.
4. Add client-facing operation adapters for DEV0123.
5. From the locally running application and database, rehearse one success/payout and one failure/refund against Devnet with public evidence; defer Cloudflare-hosted repetition to DEV0125.

## Acceptance criteria

- [ ] AC1: Coach creation and exact participant funding complete through reviewed simulated transactions and finalized verified accounts.
- [ ] AC2: Permissionless settlement plus authorized payout/refund produce the exact mutually exclusive finalized outcomes.
- [ ] AC3: Rejection, missing balance/account, RPC ambiguity and reload recover without duplicate contribution, payout or refund.
- [x] AC4: Secrets stay server-only, sponsorship cannot grant business authority and every indexed projection matches finalized state.
- [x] AC5: Every fee and rent deposit is paid by the configured platform payer, while exact event contributions still come from the authorizing participant's test-EURC account.
- [ ] AC6: Focused server/client/index tests and real public Devnet success/failure evidence pass.
- [x] AC7: Projection verification stores/compares the actual `CoachAuthority` PDA separately from the immutable payout-recipient wallet, and finalized pool state supplies fail-closed replacement-blocker evidence to DEV0136.

## Validation plan

Run deterministic transaction/verifier/recovery tests, mocked RPC adversarial responses, projection replay tests, local-browser wallet approval/rejection/reload checks and real Devnet account/balance/signature verification through the local application and database. Add a regression fixture whose coach wallet differs from the derived `CoachAuthority` PDA and assert the verified payout recipient remains the wallet. Cover all pool statuses plus stale/unavailable evidence for DEV0136. Record configuration without secrets. Do not require a Cloudflare deployment for DEV0122; preserve hosted Worker validation for DEV0125 rather than claiming the local run proves it.

## Implementation record

Implementation started on 2026-10-05 after the readiness review confirmed that DEV0121 supplies the stable local program/client contract and DEV0132 supplies the bounded platform-payer pattern. DEV0130 subsequently deployed the same combined MovX program after a reviewed transaction summary and explicit approval, so DEV0122 reuses that deployment rather than paying for or risking a redundant upgrade. Group-event wallet approval and real Devnet submission remain separate evidence steps and will not occur without their own reviewed transaction summaries and explicit approval.

### Changes and rationale

- Corrected the DEV0120 finalized-pool verifier so `group_events.coach_wallet_address_snapshot` is compared with the on-chain immutable `payout_recipient`, while the distinct `EventPool.coach_authority` PDA is stored and compared independently. The regression fixture now uses different valid addresses and rejects a substituted payout wallet, so the old same-value fixture can no longer mask the mismatch.
- Added deterministic transaction preparation for `create_event_pool`, `fund_event`, permissionless `settle_event`, `claim_event_payout` and `claim_event_refund`. Every legacy transaction freezes the reviewed program, official Devnet EURC mint, legacy SPL Token program, platform fee payer, business signer, exact PDAs, amount/terms and blockhash lifetime in a JSON-safe approval summary. Coach/participant wallets remain required signers but never pay SOL.
- Added strict server-only account reads. Program, mint, CoachAuthority, EventPool, Contribution, vault and user token accounts are checked for exact address, owner, executable state, allocation, discriminator, mint, authority, initialization and liability coverage before use. A vault may contain unsolicited surplus EURC because the program deliberately ignores surplus, but an underfunded liability fails closed.
- Added byte-for-byte wallet-message verification and bounded platform countersigning. The sponsor must be the prepared fee payer, the signer set must contain exactly sponsor plus business authority, the business Ed25519 signature must be valid and the sponsor slot must still be empty. Countersigning does not broadcast or grant event authority.
- Added one actor-scoped operation journal for exact preparations, simulation evidence, deterministic signatures, ambiguous sends, rejection, expiry and finalized observations. Row-level security (RLS), active linked-wallet checks, one active attempt per actor/event/kind and security-definer transitions prevent direct runtime writes or duplicate active value operations. The signature is saved before the one send attempt, so a timeout recovers by signature/finalized state instead of blind resubmission.
- Added finalized recovery and indexing. Recovery accepts only the exact prepared pool/contribution state, maps every pool lifecycle and participant contribution lifecycle into DEV0120's monotonic projections, marks projection evidence unavailable on submitted-operation RPC outages and then closes the durable operation. Create/fund/settle/payout/refund evidence rejects identity, amount, count, outcome or terminal-state drift.
- Added four same-origin server routes plus a browser-safe Wallet Standard adapter. The browser receives only serializable approval/status data, signs the exact simulated bytes with the simulation slot and returns only the wallet-signed transaction; RPC credentials and sponsor material never cross the server boundary.
- Documented the reviewed program identity and explicit Devnet deployment/upgrade procedure. The shared program is deployed at `GvZdpXGX6N25xfHipgzh3Td3NZBkt7e36AougHi4v1MU`; its upgrade authority remains distinct from the platform payer, recovery authorities and user wallets. DEV0122 reuses that deployment and DEV0130's sponsor configuration instead of introducing another program or sponsor.

### Affected files

- [`src/solana/group-event.ts`](../../../src/solana/group-event.ts), [`src/solana/group-event-transaction.ts`](../../../src/solana/group-event-transaction.ts) and [`src/solana/group-event-operation.ts`](../../../src/solana/group-event-operation.ts) own deterministic nonces, PDA/transaction preparation, approval summaries and request/response validation.
- [`src/server/solana/group-event-rpc.ts`](../../../src/server/solana/group-event-rpc.ts), [`src/server/solana/group-event-sponsor.ts`](../../../src/server/solana/group-event-sponsor.ts) and [`src/server/solana/group-event-service.ts`](../../../src/server/solana/group-event-service.ts) own strict account reads, simulation, exact countersigning, submission, finalized recovery and projection evidence.
- [`src/server/db/solana/group-event-repository.ts`](../../../src/server/db/solana/group-event-repository.ts), [`src/server/db/schema/group-events.ts`](../../../src/server/db/schema/group-events.ts) and [`20261005000300_integrate_group_event_operations.sql`](../../../supabase/migrations/20261005000300_integrate_group_event_operations.sql) own the recoverable actor-scoped operation journal and authorized transitions.
- [`20261005000200_correct_group_event_authority_verifier.sql`](../../../supabase/migrations/20261005000200_correct_group_event_authority_verifier.sql) owns the PDA-versus-wallet correction without rewriting archived DEV0120 history.
- [`src/app/api/solana/group-events`](../../../src/app/api/solana/group-events), [`src/server/solana/group-event-http.ts`](../../../src/server/solana/group-event-http.ts) and [`src/solana/client/group-event-client.ts`](../../../src/solana/client/group-event-client.ts) expose the bounded same-origin server/browser contract for DEV0123.
- [`tests/group-event-operation.test.ts`](../../../tests/group-event-operation.test.ts), [`tests/group-event-transaction.test.ts`](../../../tests/group-event-transaction.test.ts), [`tests/server/group-event-rpc.test.ts`](../../../tests/server/group-event-rpc.test.ts), [`tests/server/group-event-service.test.ts`](../../../tests/server/group-event-service.test.ts), [`tests/server/group-event-sponsor.test.ts`](../../../tests/server/group-event-sponsor.test.ts) and [`tests/database/group-events.test.ts`](../../../tests/database/group-events.test.ts) cover preparation, wallet boundaries, adversarial account reads, recovery evidence, persistence, authorization and projection reconciliation.
- [`README.md`](../../../README.md) records the reviewed program identity, build/identity checks and explicit deploy/upgrade-authority separation.

### Decisions and deviations

The adapter uses the same reviewed program, Devnet/RPC configuration and server-only platform payer as DEV0130; a separate sponsor or secret namespace would weaken the shared authority boundary. Transactions remain legacy format for current Phantom compatibility. Payout/refund preparation includes idempotent associated-token-account creation paid by MovX, so a missing destination account does not force the user to obtain SOL.

Each application event maps deterministically to an unsigned 64-bit pool nonce using the first eight bytes of its random UUID. That keeps reload/retry derivation stable without trusting a browser-selected nonce. Creation is the one operation where the coach necessarily chooses price, capacity and deadline; the server validates those choices against the stored event schedule and program bounds before simulation. Later funding, settlement, payout and refund requests carry only the event ID and derive every financial term from verified database/chain state.

The operation journal is a separate table because group events have no existing business-operation row suitable for pre-creation and permissionless settlement. Finalized pool/contribution projections remain the product read model; the journal is an audit/recovery boundary and does not replace chain authority. A valid vault is required to cover recorded liabilities, not equal them, because unsolicited surplus must neither alter the outcome nor block a valid payout/refund under the specification.

### Contracts, configuration, and operations

No new environment variable is introduced. DEV0122 reuses `SOLANA_CLUSTER`, `NEXT_PUBLIC_SOLANA_RPC_URL`, `SOLANA_RPC_URL`, `NEXT_PUBLIC_SOLANA_COACH_PASS_PROGRAM_ID`, `SOLANA_FEE_SPONSOR_ADDRESS` and `SOLANA_FEE_SPONSOR_KEYPAIR_BASE64`; only the program ID and browser RPC are public. The four new POST endpoints are `/api/solana/group-events/{prepare,submit,recover,reject}` and return private, no-store status envelopes.

Migration `20261005000200` replaces only the finalized-pool verification function. Migration `20261005000300` adds `app.group_event_chain_operations`, RLS/policies, indexes and narrow preparation/submission/failure/finalization functions; it requires no backfill. Rollback after real use must preserve operation audit rows and reconcile pending/finalized projections before removing the table or functions. No new secret or deployed address was introduced, and no group-event transaction was submitted during implementation.

## Validation results

- Passed `npm test` again immediately before the implementation checkpoint commit: 147 unit/server tests (120 repository tests and 27 server-condition tests). The DEV0122 subset covers request/response guards, exact browser bytes, all five transaction builders, signer/account allowlists, message mutation, early/terminal/wrong-authority/seed-drift rejection, strict RPC decoding, insufficient EURC, surplus/underfunded vault behavior, exact recovery evidence and sponsor signature tampering.
- Passed `npm run test:db`: 35 serial database integration tests. The group-event tests prove the distinct coach PDA/payout wallet, immutable verifier rejection, actor-only operation visibility, active-attempt uniqueness, linked-wallet enforcement, submitted/finalized transitions and runtime direct-write denial.
- Passed `npm run db:lint`, `npm run lint`, `npm run typecheck`, `npm run format:check`, `git diff --check` and `npm run build`. Next.js compiled all four `/api/solana/group-events/*` dynamic routes.
- Passed `npm run test:group-event:integration`: the compiled SBF program completed platform-funded successful-threshold payout and failed-threshold pull-refund lifecycles in Surfpool. The evidence included zero-SOL business wallets, platform-paid pool/vault/contribution rent and successful create/fund/settle/refund/payout instructions. The existing Anchor post-processing warning about functions absent from its known-syscall table remained visible, but all exercised PDA, clock and SPL Token CPI paths completed.
- Passed targeted experimental coverage runs. `src/solana/group-event-transaction.ts` reported 98.16% line/100% function coverage, `src/solana/group-event-operation.ts` 84.44% line/100% function coverage, `src/server/solana/group-event-rpc.ts` 76.84% line/82.35% function coverage and `src/server/solana/group-event-sponsor.ts` 88.35% line/100% function coverage. Generated Codama files appear in the raw report but are not coverage targets; they have separate codec/instruction and compiled-program tests.
- Applied both DEV0122 migrations additively to the running local database, re-applied the final preparation-function revision directly, and verified them without resetting local data.
- Passed read-only Devnet deployment-reuse verification on 2026-10-05. The finalized program account reports ProgramData `E5QDaYjL5uThmprctAm5Bema8T9ELZu9pYBYce9DWYVS`, upgrade authority `7cAWtBVrDD4ZXBizVeXaQaR9PpnzrwP5ckxwLAqVM8rc`, deployment slot `507758833` and data length `541304`; the configured sponsor is the distinct address `9cqyePPcDeauArWYbryj482taedRrErMN2fh2ghCrhf1`. A fresh `solana program dump` was byte-identical to `target/deploy/movx_coach_pass.so`, with SHA-256 `6a8b71d3a021b07ef7209568623ce6b2736c37c5d70dbe9646716fb4d305ceff`, and deployment signature `ukLV47ibr54qS6eiD9FxZZiXEyeFhHcnhSaT4QiTjx9TyixoCZW2xTFUdsqriW5nLRs16SUnFz87Kj1uAJNWrQu` remains finalized. The matching source and generated interface expose all five group-event instructions.
- Passed secret-safe local/staging configuration verification: both environments select Devnet, the deployed program and the same configured sponsor, while only the presence—not the value—of server signing material was reported. The dedicated sponsor had `1.93946988 SOL` at verification time.
- Passed the local-rehearsal readiness check on 2026-10-05. The local Supabase services were healthy, migrations `20261005000200` and `20261005000300` were present in the applied migration ledger, the existing Next.js server responded on `http://localhost:3100`, and an unauthenticated request reached the group-event preparation route and failed closed with HTTP 403 as expected. The local application and server RPC configuration both target Devnet.
- The same readiness check confirmed that Tom's local coach profile is active and visible, but the local database currently has no active personal-wallet binding for Tom or any other user. The connected browser wallet therefore cannot be treated as marketplace authority until its owner completes DEV0047's local proof-and-link flow. This is an actor-preparation prerequisite, not a program, sponsor, migration or RPC failure; no transaction was prepared or signed from the unverified browser state.
- Tom subsequently completed the local DEV0047 proof flow. The database now records one active `user-proof` binding for Tom at `84g1vMUWb2umWbyEHSkaxpGtqyPDu3RsBnGzRsXfjuCt`, backed by a consumed ownership challenge. A finalized Devnet read found `120` test EURC in the wallet's initialized six-decimal legacy SPL Token account for the official mint. Group-event preparation still waits for Tom's CoachAuthority bootstrap and separately linked participant actors; no group-event transaction has been prepared or signed.
- Not run: real group-event wallet approval/rejection or success/payout and failure/refund transaction evidence. No DEV0122 marketplace transaction was signed, sponsored or sent during this deployment-reuse check. The user subsequently selected a local-app/local-database Devnet rehearsal because of current Cloudflare issues; hosted projection rehearsal is intentionally deferred to DEV0125 and is no longer part of the remaining DEV0122 validation sequence.

## Risks, limitations, and follow-ups

Devnet RPC/faucet availability can interrupt rehearsal; provider failure remains distinct from program rejection and marks submitted projection evidence unavailable rather than authorizing from stale state. The reviewed shared program is deployed and RPC/sponsor/operator separation is verified, but DEV0122 cannot complete until Tom's CoachAuthority bootstrap is finalized, the rehearsal participants have verified local personal-wallet bindings and selected test-EURC accounts, and both successful payout plus failed refund paths have public finalized evidence through the local application. DEV0123 still owns page composition and wallet-flow user experience; DEV0136 consumes the corrected finalized blocker evidence. Cloudflare-specific runtime behavior remains unverified by this local path and stays with DEV0125. Every remaining wallet-authorized group-event transaction remains gated on a reviewed summary plus explicit approval.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: Local implementation self-review completed; independent review not yet recorded.
- Deployment or release: Reuses the finalized shared Devnet program deployed under DEV0130 at `GvZdpXGX6N25xfHipgzh3Td3NZBkt7e36AougHi4v1MU`; no redundant DEV0122 deployment was sent.
