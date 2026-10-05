# Ticket DEV0130: Integrate Devnet coach-pass operations

- Status: In progress
- Created: 2026-10-04
- Last updated: 2026-10-05
- Milestone: Marketplace M6 Devnet pass integration
- Coordination: [COR0010 — Coach-pass and group-funded marketplace MVP](../organisatory/COR0010-group-funded-coach-marketplace-mvp.md)
- Related records: depends on completed [DEV0127](../../archive/blockchain/DEV0127-implement-coach-client-credit-ledger.md), completed [DEV0131](../../archive/blockchain/DEV0131-implement-coach-credit-booking-lifecycle.md), completed platform-payer contract [DEV0132](../../archive/blockchain/DEV0132-make-coach-pass-operations-platform-funded.md), completed EURC compatibility contract [DEV0134](../../archive/blockchain/DEV0134-adopt-eurc-for-marketplace-payments.md), personal-wallet work in DEV0047 and hosted infrastructure under COR0004; supplies transaction adapters to completed [DEV0128](../../archive/backend/DEV0128-persist-credit-backed-private-bookings.md) and [DEV0129](../frontend/DEV0129-present-coach-passes-bookings-and-client-cards.md)

## Objective and context

Connect the complete local coach-pass program to recoverable Devnet purchases and booking-credit operations with server-authoritative preparation, simulation, wallet approval, bounded platform payment of every transaction fee and rent deposit, and finalized pair-ledger/reservation verification.

## Scope and non-goals

- In scope: deployable program/upgrade identity; Devnet configuration; prepare/simulate/sign/submit/verify/recover operations; token-account readiness; pair-ledger and reservation indexing; first/subsequent purchase recovery; reserve/consume/return recovery; public Explorer evidence.
- Out of scope: UI composition, booking rules, mainnet, arbitrary tokens, production custody, Kora migration or real-money claims.

## Expected behavior and edge cases

Every purchase approval identifies Devnet, test EURC, coach, exact price, purchased credits, destination and the MovX platform payer. Every booking-credit approval identifies the pair ledger, booking reference, scheduled time/cutoff, exact transition, authority and platform payer. Clients and coaches need no test SOL; the client still supplies the exact purchase price in test EURC and every business action still requires its client or coach signature. A lost response is recovered from the pair PDA, purchase nonce or deterministic reservation receipt. Wallet rejection, insufficient balance, missing token account, stale blockhash or RPC ambiguity never causes a blind repeat.

## Assumptions, decisions, and dependencies

The DEV0127 purchase contract, DEV0131 reservation contract and DEV0132 platform-payer instruction/client change are complete and stable for deployment. Credentialed RPC, platform-payer, recovery and upgrade material remain separate server/operator secrets. The sponsor signs only an allowlisted transaction reconstructed and validated by the server; it cannot replace the required client or coach authority. Automation may not sign or send a user-authorized transaction without that user's explicit approval.

## Implementation plan

1. Freeze deployment/configuration, bounded platform-payer policy and operation records against DEV0132's completed interface.
2. Implement first/subsequent purchase plus reserve/consume/return preparation and simulation.
3. Implement submit/finalize/verify/recover plus pair-ledger/reservation projection indexing.
4. Rehearse public/restricted purchases and each booking-credit terminal path on Devnet with public evidence.

## Acceptance criteria

- [ ] AC1: First and later exact test-EURC purchases finalize with verified pair-ledger balances.
- [ ] AC2: Reserve, consume and return operations finalize with verified pair-ledger/reservation state.
- [ ] AC3: Rejection and ambiguous outcomes recover without duplicate payment, reservation or terminal resolution.
- [x] AC4: Every transaction fee and rent deposit is paid by the configured platform payer, users need no test SOL, secrets remain server-only and sponsorship cannot buy or mutate credits without the required client/coach authority.
- [ ] AC5: Real Devnet transaction/account evidence and applicable server/client tests pass.

## Validation plan

Focused RPC/verifier/recovery tests, mocked purchase and booking-operation failure cases, real wallet approval/rejection and public Devnet account/signature verification.

## Implementation record

Implementation started on 2026-10-05 after DEV0121 committed the complete shared program/IDL/generated-client contract as `3e5146d`. The ticket remains one vertical integration slice: deployment identity, bounded sponsorship, transaction preparation, finalized verification, recovery and projection indexing share one security boundary and one Devnet rehearsal. Splitting those parts would leave an unauditable handoff between the transaction the platform countersigns and the state it later accepts as finalized.

The deterministic server/client adapters and tests may proceed while DEV0047's real-Phantom rehearsal remains open. Real wallet approval, program deployment and transaction submission remain explicit validation steps; automation will not sign or send a Devnet transaction without a reviewed transaction summary and separate user approval.

### Changes and rationale

- Added deterministic legacy-transaction preparation for first and later EURC offer purchases, booking-credit reservation, authorized return and coach consume. Preparation derives every program-derived address (PDA), associated token account and Anchor event authority from reviewed inputs; rejects stale offer/authority/ledger/reservation data; freezes the recent blockhash; and produces an exact JSON-safe Devnet approval summary.
- Added a server-only countersigning boundary. It decodes the wallet response, requires its compiled message to match the prepared message byte for byte, requires exactly the expected platform and business-authority signers, verifies the client/coach Ed25519 signature and only then adds the platform-payer signature. It returns a fully signed transaction and its deterministic fee-payer signature but does not broadcast it.
- Added strict runtime configuration parsing that pins `devnet`, HTTPS RPC endpoints and the reviewed `GvZdpXGX6N25xfHipgzh3Td3NZBkt7e36AougHi4v1MU` program identity while continuing to load the fee-sponsor secret only through the existing server-only source.
- Added strict Devnet RPC reads for the executable program, EURC mint and token accounts, coach authority, offer, pair ledger and reservation receipt. Every accepted program account is checked against the expected owner, fixed allocation and discriminator before decoding; token accounts are checked against the legacy SPL Token program, official EURC mint and expected wallet owner. Purchase preparation also rejects insufficient client EURC before a wallet prompt.
- Added actor-scoped persistence for exact prepared messages, simulations, blockhash lifetimes, deterministic signatures, ambiguous submissions and finalized evidence. Purchase attempts use a dedicated table because no booking exists before the first purchase; reserve/return/consume extend DEV0128's existing operation rows instead of creating a second booking state machine. Row-level security (RLS), security-definer functions, active-wallet checks and purchase rate limiting keep mutations behind the authorized server path.
- Added a server execution service and four same-origin authenticated routes for prepare, submit, recover and reject. The service performs RPC work outside database transactions, rechecks the actor before each write, stores the deterministic signature before broadcasting, treats a send error as ambiguous, and recovers only from finalized account state or safe blockhash expiry. Finalized purchase state updates the DEV0128 pair projection atomically with the purchase attempt; booking state uses DEV0128's existing verified transition.
- Added a browser adapter that converts the prepared base64 transaction to exact wallet bytes, passes the simulated context slot to the Wallet Standard signer and returns only the wallet-signed bytes to the bounded server submit route. It never gives the browser access to the platform sponsor or RPC credential.

### Affected files

- [`src/solana/coach-pass.ts`](../../../src/solana/coach-pass.ts) now derives the Anchor event-authority PDA used by every generated instruction.
- [`src/solana/coach-pass-transaction.ts`](../../../src/solana/coach-pass-transaction.ts) owns exact transaction preparation, serializable approval summaries and message comparison for all five coach-pass operation variants.
- [`src/server/solana/coach-pass-sponsor.ts`](../../../src/server/solana/coach-pass-sponsor.ts) owns business-signature validation and bounded platform countersigning without submission.
- [`src/server/solana/coach-pass-config.ts`](../../../src/server/solana/coach-pass-config.ts) owns the Devnet/program/RPC/sponsor runtime contract.
- [`src/server/solana/coach-pass-rpc.ts`](../../../src/server/solana/coach-pass-rpc.ts), [`src/server/solana/coach-pass-service.ts`](../../../src/server/solana/coach-pass-service.ts) and [`src/server/db/solana/coach-pass-repository.ts`](../../../src/server/db/solana/coach-pass-repository.ts) own strict chain reads, simulation, submission/recovery decisions and actor-scoped durable writes.
- [`src/solana/coach-pass-operation.ts`](../../../src/solana/coach-pass-operation.ts), [`src/solana/client/coach-pass-client.ts`](../../../src/solana/client/coach-pass-client.ts) and [`src/app/api/solana/coach-pass`](../../../src/app/api/solana/coach-pass) define and expose the bounded browser/server contract.
- [`supabase/migrations/20261005000100_integrate_coach_pass_operations.sql`](../../../supabase/migrations/20261005000100_integrate_coach_pass_operations.sql) and [`src/server/db/schema/bookings.ts`](../../../src/server/db/schema/bookings.ts) add recoverable purchase attempts plus preparation/submission metadata to booking-credit operations.
- [`tests/coach-pass-transaction.test.ts`](../../../tests/coach-pass-transaction.test.ts), [`tests/coach-pass-operation.test.ts`](../../../tests/coach-pass-operation.test.ts), [`tests/server/coach-pass-config.test.ts`](../../../tests/server/coach-pass-config.test.ts), [`tests/server/coach-pass-rpc.test.ts`](../../../tests/server/coach-pass-rpc.test.ts), [`tests/server/coach-pass-service.test.ts`](../../../tests/server/coach-pass-service.test.ts), [`tests/server/coach-pass-sponsor.test.ts`](../../../tests/server/coach-pass-sponsor.test.ts) and [`tests/database/coach-bookings.test.ts`](../../../tests/database/coach-bookings.test.ts) cover transaction allowlists, browser boundaries, exact account verification, recovery evidence, persistence, authorization, idempotency and failure cleanup.
- [`package.json`](../../../package.json) now includes all `tests/server/*.test.ts` files in the standard `npm test` gate under the required React Server condition, so sponsor/configuration and existing wallet-signature checks cannot be omitted from routine unit validation.
- [`scripts/deploy-staging-worker.mjs`](../../../scripts/deploy-staging-worker.mjs), [`wrangler.jsonc`](../../../wrangler.jsonc) and [`tests/staging-deployment.test.ts`](../../../tests/staging-deployment.test.ts) make the reviewed public coach-pass program address a required, pinned staging runtime binding and reject deployment configuration that points at another program.

### Decisions and deviations

Transaction messages use the legacy format for current Phantom compatibility. Purchase preparation always includes an idempotent coach EURC associated-token-account instruction so MovX can pay its rent if absent; the client EURC account remains the exact canonical account that supplies the purchase value. Approval fields that may exceed JavaScript's safe integer range cross the server/browser boundary as decimal strings. The submit route stores the deterministic signature before its one broadcast attempt, so a timeout is recovered by signature and finalized state instead of blindly resending.

The continuation keeps DEV0128's booking-operation rows as the durable business-operation boundary and adds only the prepared-message, blockhash-expiry and submission metadata that chain execution requires. Pass purchases receive a separate actor-scoped operation table because no booking exists before the first purchase. A server-only execution service owns RPC reads, account validation, simulation, countersigning, submission, finalized recovery and projection evidence; HTTP routes remain thin authenticated adapters and the browser receives only serializable approval/status data. This avoids a second booking state machine while keeping purchase and booking recovery idempotent.

### Contracts, configuration, and operations

The program interface did not change; the adapter consumes the completed generated client. The database now persists one actor-scoped row per purchase attempt and the exact preparation/submission metadata on DEV0128 booking operations. Deploying the migration requires no backfill because existing booking preparations may keep the new fields null until DEV0130 prepares a real transaction. There is no destructive rollback once purchase attempts exist; rollback would first require draining or preserving those audit rows.

The standard `npm test` command now runs both root unit tests and server-only unit tests; database and Surfpool integration suites remain explicit commands because they have separate runtime prerequisites. The environment names remain `SOLANA_CLUSTER`, `NEXT_PUBLIC_SOLANA_RPC_URL`, `SOLANA_RPC_URL`, `NEXT_PUBLIC_SOLANA_COACH_PASS_PROGRAM_ID`, `SOLANA_FEE_SPONSOR_ADDRESS` and `SOLANA_FEE_SPONSOR_KEYPAIR_BASE64`. `NEXT_PUBLIC_SOLANA_COACH_PASS_PROGRAM_ID` is a public program address, not a credential; RPC credentials and sponsor key bytes remain server-only. Current local/staging configuration does not yet set the deployed program ID, and the reviewed address is not deployed on Devnet; no secret value was printed or persisted.

## Validation results

- Passed `npm run typecheck`, `npm run lint`, `npm run format:check` and `npm run build`; Next.js compiled all four new dynamic API routes.
- Passed `npx tsx --test tests/coach-pass-transaction.test.ts`: 9 tests cover first/later exact terms and instruction/account allowlists, message equality, stale or wrong state, canonical PDA bumps, serializable output, and reserve/return/consume authority, replay and timing constraints.
- Passed the focused browser/RPC/recovery/configuration/sponsor tests. They cover bounded request/response validation, exact wallet bytes, same-origin request shape, owner/size/discriminator checks, EURC mint/account validation, insufficient EURC, monotonic purchase evidence, reservation terminal evidence, malformed transactions, message tampering, signer drift, invalid business signatures, pre-signed sponsor rejection and sponsor separation.
- Passed `npx tsx --test --experimental-test-coverage tests/coach-pass-transaction.test.ts` and `npx tsx --conditions=react-server --test --experimental-test-coverage tests/server/coach-pass-config.test.ts tests/server/coach-pass-sponsor.test.ts`: `src/solana/coach-pass-transaction.ts` and `src/server/solana/coach-pass-sponsor.ts` report 100% line, branch and function coverage; `src/server/solana/coach-pass-config.ts` reports 100% line/function and 96.43% branch coverage. Generated client files are included in the raw report but are not used as coverage targets because they are separately codec- and runtime-tested.
- Passed `npm test`: 114 repository unit tests, comprising 100 root tests plus 14 server-only tests under the React Server condition. The root suite includes staging validation that accepts the reviewed program identity and rejects a substituted program address.
- Passed `npm run test:db`: 34 serial database tests, including exact preparation persistence, row-level actor isolation, deterministic submission identity, atomic purchase projection/finalization, active booking authority checks and reserve failure/slot cleanup.
- Applied `20261005000100_integrate_coach_pass_operations.sql` to the running local database, applied the two final function revisions directly without resetting user data, and passed `npm run db:lint`. A destructive fresh local reset was intentionally not run.
- Passed `NO_DNA=1 npm run test:coach-pass:integration`: the compiled SBF program completed one Surfpool lifecycle covering first/later EURC purchases, three reservation terminal paths, exact platform-paid account rent/fees and zero-SOL user wallets. The existing Anchor post-processing warning about functions not present in its known-syscall table remained visible, but the exercised PDA, event and SPL Token CPI paths completed successfully.
- Read-only Devnet preflight found the reviewed program address absent and the official EURC mint present under the legacy SPL Token program. No deployment, signing, simulation or transaction submission was attempted.
- `npm run deploy:staging:check` did not reach the complete staging validation because `.env.staging.local` does not currently provide the pre-existing required `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`. This is an environment prerequisite rather than a coach-pass test failure; no staging deployment was attempted.

## Risks, limitations, and follow-ups

Devnet and RPC availability can interrupt rehearsal. Provider failure must remain distinguishable from program rejection. The platform payer is an availability and abuse-control boundary, so the adapter must allowlist exact instructions/accounts, cap spend and rate, validate the wallet-signed message before countersigning and never reuse sponsor authority as recovery or upgrade authority.

The implementation work is complete enough for real Devnet rehearsal. Still required before this ticket can complete: deploy the reviewed program identity, configure the public program address and separate server-only RPC/sponsor material, verify the sponsor is not the recovery or upgrade authority, provision test EURC, apply the migration to the target environment, wire DEV0129's interface to the browser adapter, and collect real wallet rejection plus first/later purchase and reserve/return/consume Explorer evidence. The program deployment and every real transaction remain gated on a reviewed summary plus explicit user approval.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: Implementation self-review completed; independent review not yet recorded.
- Deployment or release: None.
