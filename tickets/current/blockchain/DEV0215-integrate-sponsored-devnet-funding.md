# Ticket DEV0215: Integrate sponsored Devnet funding

- Status: Draft
- Created: 2026-10-12
- Last updated: 2026-10-12
- Milestone: Hackathon H4 sponsored Devnet integration
- Coordination: [COR0019 — Hackathon Solana group events](../organisatory/COR0019-hackathon-solana-group-events.md)
- Related records: depends on [DEV0211](../backend/DEV0211-persist-personal-wallet-bindings.md), [DEV0213](../backend/DEV0213-persist-group-event-catalogue.md) and [DEV0214](DEV0214-implement-threshold-funding-program.md); historical integration baseline [DEV0122](../../archive/blockchain/DEV0122-integrate-devnet-group-event-funding.md) and fee-payer baseline [DEV0132](../../archive/blockchain/DEV0132-make-coach-pass-operations-platform-funded.md); supplies operations to [DEV0216](../frontend/DEV0216-present-group-event-marketplace.md)

## Objective and context

Restore and adapt the previously implemented integration between authenticated MovX actors, finalized event projections and the reviewed Devnet funding program through a server-controlled fee sponsor. The platform pays approved SOL fees and rent, while Phantom users retain the required coach/participant signatures and supply the seat token value.

## Scope and non-goals

- In scope: Devnet configuration validation; server-only RPC and sponsor signer boundary; create/fund/settle/payout/refund operation journal; exact transaction preparation; simulation and human-readable review summary; Wallet Standard partial signature round trip; server allowlist/revalidation/sponsor signature; broadcast/confirmation/finalization; idempotent recovery; finalized account ingestion; rate and spend bounds; settlement/refund worker behavior selected by DEV0210; Explorer evidence.
- Out of scope: browser page composition, wallet custody, arbitrary transaction sponsorship, raw secret exposure, mainnet, exchange/faucet automation, production treasury management or treating submitted/confirmed callbacks as finalized financial truth.

## Expected behavior and edge cases

The authenticated actor requests one bounded operation by event ID, never arbitrary instructions or financial terms. The server re-derives accounts and terms from verified actor/database/chain state, constructs and simulates the complete Devnet message with the platform fee payer, and returns exact bytes plus recipient/amount/token/cluster/fee-payer summary. Phantom signs only the expected business-authority slot. The server rejects message, signer, account, instruction, blockhash, cluster or signature drift before adding its sponsor signature and broadcasting. Ambiguous timeout, expired blockhash, duplicate submission, already-finalized state, RPC lag and retry recover from the journal and chain state without blind double-spend.

## Assumptions, decisions, and dependencies

Sponsor and user signatures are distinct: paying fees never grants the sponsor coach or participant authority. The sponsor address may be public; its signing material is server-only and must not be logged or returned. Production-style Vercel signing should prefer a dedicated key-management service; if a base64/environment key is used for Devnet hackathon speed, document it as a restricted temporary limitation with rotation and spend controls.

Prepared messages must include an explicit compute budget so the wallet does not modify them. Confirm settlement from decoded finalized accounts and token balances, not a client callback or log parser. Store unique operation intent/recovery IDs for idempotency and audit. Commit `12e8ccc` is the recoverable prepare/simulate/sign/submit/recover baseline, including the PDA-versus-payout-wallet correction and exact message verification. The previously deployed combined program address `GvZdpXGX6N25xfHipgzh3Td3NZBkt7e36AougHi4v1MU` is a reuse candidate only after read-only program-data, upgrade-authority, binary-hash and generated-interface verification; this ticket must fail closed and document a new deployment if it no longer matches. No real transaction may be submitted during implementation without the user first seeing and approving recipient, amount, token, fee payer and Devnet cluster.

## Implementation plan

1. Inspect installed Solana/Next.js versions and freeze the prepare/sign/submit/recover contracts against the generated DEV0214 client.
2. Add strict environment validation and isolated server RPC/sponsor modules with address, instruction, signer and spend allowlists.
3. Implement durable actor-scoped operations for create, fund, settle, payout and refund, including simulation summaries and wallet rejection.
4. Add finalization/recovery projection ingestion and the bounded deadline/refund submission mechanism selected by DEV0210.
5. Add adversarial unit/server/database/Surfpool tests, then perform separately approved Devnet rehearsal steps and record Explorer-visible evidence.

## Acceptance criteria

- [ ] AC1: Every allowed operation is server-derived, simulated and presented with exact value/recipient/token/fee-payer/cluster before wallet signing.
- [ ] AC2: The platform pays SOL transaction fees and approved rent, while the correct linked coach/participant signature and exact participant seat value remain mandatory.
- [ ] AC3: Message/signer/account/instruction/signature drift, arbitrary sponsorship, overspend and unauthorized actors fail before sponsor signature or broadcast.
- [ ] AC4: Submitted, expired, ambiguous, duplicate and already-finalized attempts converge idempotently from chain evidence into actor-scoped projections.
- [ ] AC5: Local/Surfpool tests and an explicitly approved Devnet create/fund/settle/payout/refund rehearsal pass without exposing sponsor key material.

## Validation plan

Test exact serialized messages, required signer sets, allowlisted instructions/accounts, signature verification, simulation failure, rate/spend bounds, rejection, blockhash expiry, duplicate/recovery and finalized account decoding. Use embedded Surfpool for success and failure loops. Run database suites, unit/server tests, lint, typecheck, format check and build. For real Devnet, stop before each transaction until the user explicitly approves the displayed transaction summary; record public addresses/signatures only, never keys.

## Implementation record

Pending implementation.

### Changes and rationale

Pending.

### Affected files

| File or component                | Change and purpose                                                 |
| -------------------------------- | ------------------------------------------------------------------ |
| Server Solana modules/API routes | Prepare, verify, sponsor, submit and recover bounded operations.   |
| Event operation persistence      | Idempotent intent, attempt and finalized-evidence journal.         |
| Configuration/runbooks           | Devnet RPC/program/sponsor validation and safe operator steps.     |
| Tests                            | Transaction mutation, authorization, recovery and lifecycle proof. |

### Decisions and deviations

None yet.

### Contracts, configuration, and operations

Expected variables include public Devnet RPC/program identifiers and server-only RPC/sponsor configuration. Exact names, signing backend, rotation and spending limits remain pending implementation. Secret values and key material must never be committed, printed or recorded.

## Validation results

Pending validation.

- Date and environment: Not run.
- Exact commands and outcomes: Not run.
- Manual steps and observed outcomes: Not run.
- Failed, blocked, or not-run checks and reasons: Not run — DEV0211, DEV0213 and DEV0214 must deliver stable ownership, projection and generated-program interfaces before this ticket becomes Ready.

| Criterion | Evidence                              | Result  |
| --------- | ------------------------------------- | ------- |
| AC1       | Prepare/simulation summary tests      | Not run |
| AC2       | Distinct signer/value tests           | Not run |
| AC3       | Mutation/authorization/spend tests    | Not run |
| AC4       | Recovery/projection tests             | Not run |
| AC5       | Surfpool and approved Devnet evidence | Not run |

## Risks, limitations, and follow-ups

A publicly reachable sponsor is an abuse target. Authentication alone is insufficient; exact intent allowlisting, operation idempotency, per-actor limits, global spending limits and monitoring are mandatory. Devnet reliability and faucet availability can delay rehearsal without weakening safety checks.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: No independent security review or pull request.
- Deployment or release: No program or application deployed.
