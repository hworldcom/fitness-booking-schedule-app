# Ticket DEV0082: Sponsor membership network fees

- Status: In progress
- Created: 2026-09-27
- Last updated: 2026-09-27
- Milestone: M2 membership period and activation
- Coordination: [COR0007 — Core multi-gym membership MVP](../organisatory/COR0007-core-multigym-membership-mvp.md)
- Related records: extends the activation transaction and recovery flow in [DEV0081 — Activate memberships with Devnet EURC](DEV0081-devnet-membership-activation.md), reuses the persisted operation authority from [DEV0080 — Persist membership activation foundation](../../archive/backend/DEV0080-membership-activation-foundation.md), recovered the false-negative real payment through [DEV0083 — Recover verified membership activation](../../archive/backend/DEV0083-recover-verified-membership-activation.md), and depends on the linked member-wallet boundary in [DEV0047 — Personal wallet linking and replacement](../backend/DEV0047-personal-wallet-linking-and-replacement.md)

## Objective and context

Remove the need for a member to hold test SOL when activating a MovX membership on Solana Devnet. MovX supplies a dedicated Devnet fee-payer account that pays the network fee, while the member's connected and linked wallet still authorizes the exact 80- or 150-EURC token transfer. This refines [the activation contract](../../../docs/mvp-spec.md#73-activation) without changing the membership price, pool destination, finality requirements or member-wallet ownership model.

DEV0081 currently makes the member both token authority and transaction fee payer. This ticket changes only the fee payer and the safe transaction-construction boundary. The browser must never receive the sponsor private key, and the server must never sign transaction bytes supplied by the browser.

## Scope and non-goals

- In scope: server-only sponsor configuration; strict parsing of one base64-encoded 64-byte Solana CLI keypair; public-address/keypair consistency checks; server construction of the exact operation-authoritative checked EURC transfer; sponsor partial signing; server-side token-account validation and pre-approval simulation; a bounded same-origin actor-owned sponsorship route; browser decoding of the partially signed transaction; member sign-and-send through Phantom; explicit UI disclosure that MovX pays the Devnet network fee; local/staging configuration and deployment validation; deterministic adapter, route, boundary and configuration tests; one real Devnet approval rehearsal after the user reviews the transaction summary.
- Out of scope: mainnet, production key custody, production gas infrastructure, Kora or another relayer, arbitrary transaction sponsorship, browser-side sponsor secrets, pool withdrawals, recurring authorization, EURC-price changes, non-core-visit sponsorship, refunds, automatic retries that can cause a second payment, or claiming the demo sponsor policy as the final production business model.

## Expected behavior and edge cases

After an authenticated member prepares an activation operation, the browser requests sponsorship by operation ID only. The server reloads that actor's pending operation, derives the exact member source and fixed pool destination token accounts, creates a fresh legacy transaction with the existing unique reference and memo, sets the configured sponsor as fee payer, simulates it on Devnet, signs only the sponsor slot and returns bounded public transaction evidence. Phantom then adds the member signature for the EURC authority and broadcasts the already sponsor-signed transaction. Finalized server verification remains the only path that creates a membership.

Solana RPC may describe the reference-bearing single-authority `transferChecked` instruction using its multisig-shaped parsed form: the expected member wallet appears as `multisigAuthority` and the appended reference appears in the `signers` array even though the transaction account metadata proves that the member signed and the reference did not. Verification must accept this representation only when it exactly matches that known shape. It must retain the independent transaction-signer, read-only/non-signer reference, quote-field and pre/post token-balance checks; genuine or ambiguous multisig evidence remains rejected.

Missing, malformed or non-64-byte sponsor material, an address/keypair mismatch, a non-Devnet cluster, unavailable RPC, missing token accounts, insufficient member EURC, insufficient sponsor test SOL, destination mismatch, stale blockhash, simulation failure, non-owned operation, submitted/failed/confirmed operation or connected-wallet mismatch must fail closed without opening Phantom or creating membership. Wallet cancellation creates no payment. An ambiguous Wallet Standard response preserves the existing operation-reference recovery behavior and must not automatically request a replacement sponsored transaction.

The route never accepts a transaction, instruction, amount, mint, destination, wallet address, blockhash or fee-payer override from the browser. Repeated sponsorship requests may refresh an expired blockhash only while the same actor-owned operation remains pending; the UI holds at most one prepared transaction and clears it after any approval attempt.

## Assumptions, decisions, and dependencies

- The user chose a MovX-paid network fee for the Devnet demonstration. Production fee policy remains unresolved.
- `SOLANA_FEE_SPONSOR_ADDRESS` is public configuration used for an explicit consistency check. `SOLANA_FEE_SPONSOR_KEYPAIR_BASE64` is an ignored/server-secret value containing the raw 64 bytes from a dedicated Devnet Solana CLI keypair, encoded once as base64. Neither value is trusted from browser input.
- The sponsor account is distinct from the membership pool recipient. Sponsorship authorizes only the SOL network fee; it cannot authorize or redirect the member's EURC.
- The member and sponsor both sign the same immutable transaction message. Changing any amount, account, instruction or blockhash invalidates the sponsor signature.
- Direct server-side key loading is acceptable only for this bounded Devnet hackathon path. Production must use reviewed secret custody or a purpose-built policy relayer such as Kora before mainnet use.
- Installed `@solana/kit@8.3.0` provides partial signing and Wallet Standard sign-and-send support; no new dependency is required.

## Implementation plan

1. Add fail-closed sponsor configuration that parses the keypair without logging it and verifies the derived public address.
2. Add a server sponsorship adapter that rebuilds the exact authoritative transfer, validates accounts/balances, simulates it and returns only the sponsor-signed wire transaction plus bounded public metadata. Make finalized verification recognize the exact RPC-parsed shape produced by its appended read-only reference without treating arbitrary multisig evidence as a member-authorized payment.
3. Add a same-origin authenticated activation route accepting only `operationId`, and a browser client that decodes the returned transaction before Phantom adds the member signature and broadcasts.
4. Update activation UI copy/state, staging secret allowlists, example configuration and project documentation.
5. Add focused tests for configuration, exact-construction boundaries, partial-signature preservation, route inputs, failure mapping and absence of browser-secret imports; then run static, unit, build and manual Devnet checks.

## Acceptance criteria

- [ ] AC1: A correctly configured dedicated Devnet sponsor is the transaction fee payer, while the linked member wallet remains the sole EURC transfer authority and the existing pool token account remains the destination.
- [ ] AC2: The server signs only a transaction it constructs from an authenticated actor-owned pending activation operation; the route accepts no caller-supplied transaction fields or bytes.
- [ ] AC3: Missing, malformed or mismatched sponsor configuration and account/RPC/simulation failures return bounded errors, expose no secret material and do not open Phantom.
- [ ] AC4: The sponsor private key is server-only, ignored by Git, absent from client bundles/responses/logs, and delivered to staging only through the existing encrypted-secret deployment path.
- [ ] AC5: The interface clearly says MovX pays the Devnet SOL network fee, shows the exact test-EURC amount and still requires explicit Phantom approval before any send.
- [ ] AC6: Cancellation creates no transaction or membership; an ambiguous send remains recoverable by the existing operation reference without automatic duplicate payment.
- [ ] AC7: Deterministic tests prove sponsor parsing/address matching, exact transaction construction, both required signatures, existing sponsor-signature preservation through Wallet Standard, route/boundary validation, canonical activation verification and the exact reference-bearing RPC parser representation observed on Devnet. Nearby wrong-authority, extra-signer and wrong-reference variants fail closed.
- [ ] AC8: A real Devnet rehearsal shows the configured sponsor paying the network fee for one exact-price EURC activation, followed by finalized server reconciliation and one active membership; a separate rejected approval produces no transfer or membership.

## Validation plan

Use generated test-only keypairs and RPC fixtures; never load or print the configured sponsor secret in automated test output. Run focused sponsor/client/route/boundary tests, the full `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check`, the documented Webpack production build and `git diff --check`. Run staging configuration validation only through its redacted success/failure output.

For the manual check, validate only presence, length and address consistency before starting the app. Display the exact 80/150 test-EURC summary, membership pool, member wallet, public sponsor address and Devnet cluster before Phantom approval. After the user approves, record only public explorer evidence: both signer addresses, fee payer, transfer amount/mint/destination, network fee, finality and resulting membership state. Never record the keypair, recovery phrase or environment value.

## Implementation record

Implementation started after the user configured a dedicated Devnet sponsor and asked to try the flow. The local server now exposes the bounded sponsorship route, the browser can consume a sponsor-partially-signed transaction, and the automated/static production checks pass. A real 80-EURC sponsored transaction finalized with the intended two signatures and balance movement. That first reconciliation hit a false negative caused by Solana RPC's parser representation; the verifier now accepts the exact observed shape and rejects neighboring ambiguous variants. DEV0083 subsequently re-verified and recovered that exact payment into one active membership without another transfer. This ticket remains In progress only because the separate rejected-approval rehearsal has not run.

### Changes and rationale

Membership payment preparation moved from browser-side transaction construction to one authenticated server operation. The browser sends only the pending activation operation ID. The server reloads the current actor's authoritative quote, validates the member and pool token accounts, constructs the checked transfer/reference/memo transaction, sets the configured MovX account as fee payer, simulates it and signs only the sponsor slot. The returned wire transaction contains the sponsor signature and an empty member signature; Phantom adds the member signature and broadcasts it through Wallet Standard.

The client rejects responses unless the exact authoritative amount is echoed, the public fields parse, there are exactly two required signers in sponsor/member order, the sponsor signature exists and the member signature is still absent. Final membership reconciliation is unchanged and continues to verify the exact finalized transfer independently.

Finalized verification now supports both the canonical single-authority `transferChecked` representation and the exact alternate representation emitted by `jsonParsed` when the instruction carries the appended payment reference. The alternate is accepted only when `multisigAuthority` is the expected member wallet and `signers` contains exactly the expected reference. Independent message-account checks still require the member to be a transaction signer and the reference to be read-only and non-signing; exact quote fields and two-sided token-balance deltas remain mandatory.

The initially configured public address `AjrQdXjR9y7B4oniU5TT7PTuiqubySQuvEDJaabkJP8C` did not match the supplied Solana CLI keypair. Secret-safe validation derived `E9nRXgYvxR3ACYzLtCzBjHuhkgVK9v1M9CrfWCesouWf`; a read-only Devnet lookup showed that account already held 1 test SOL. The ignored local/staging public-address settings were aligned to the keypair-controlled account without printing or changing the secret.

### Affected files

| File or component                                                                                                                                                                                                                                                                                                                        | Change and purpose                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`src/solana/membership-fee-sponsor.ts`](../../../src/solana/membership-fee-sponsor.ts), [`src/server/solana/membership-fee-sponsor-config.ts`](../../../src/server/solana/membership-fee-sponsor-config.ts)                                                                                                                             | Parse exactly one 64-byte base64 CLI keypair, import it as a non-extractable signer, zero the temporary decoded bytes and fail closed unless its derived public address matches the configured address. Only the server config reads the secret variable. |
| [`src/server/solana/membership-payment-sponsorship.ts`](../../../src/server/solana/membership-payment-sponsorship.ts)                                                                                                                                                                                                                    | Rebuild the exact quote-controlled checked EURC transfer on the server, validate both token accounts and balance, set/sign the sponsor fee-payer slot, simulate on Devnet and return bounded public wire evidence.                                        |
| [`src/solana/membership-payment-verification.ts`](../../../src/solana/membership-payment-verification.ts), [`tests/membership-payment-verification.test.ts`](../../../tests/membership-payment-verification.test.ts)                                                                                                                   | Accept the exact reference-bearing `jsonParsed` authority shape observed on the finalized rehearsal while rejecting a wrong authority, extra parsed signer, mixed canonical/multisig fields, or reference that actually signed.                         |
| [`src/server/membership/service.ts`](../../../src/server/membership/service.ts), [`src/app/api/membership/activation/sponsor/route.ts`](../../../src/app/api/membership/activation/sponsor/route.ts)                                                                                                                                     | Require an authenticated actor-owned pending activation and accept exactly one browser field, `operationId`; submitted, failed, confirmed, foreign and malformed operations cannot obtain a sponsored transaction.                                        |
| [`src/features/membership/activation-client.ts`](../../../src/features/membership/activation-client.ts), [`src/solana/client/membership-payment-client.ts`](../../../src/solana/client/membership-payment-client.ts)                                                                                                                     | Request operation-bound sponsorship, validate/decode the partial transaction and pass it to Phantom without replacing the existing sponsor signature. Cancellation and ambiguous Wallet Standard results retain DEV0081 recovery behavior.                |
| [`src/features/membership/setup.tsx`](../../../src/features/membership/setup.tsx)                                                                                                                                                                                                                                                        | Explain that MovX pays the test-SOL network fee while the linked wallet authorizes only the exact EURC transfer, and map bounded sponsor failures without opening Phantom.                                                                                |
| [`.env.example`](../../../.env.example), [`wrangler.jsonc`](../../../wrangler.jsonc), [`scripts/deploy-staging-worker.mjs`](../../../scripts/deploy-staging-worker.mjs), [`README.md`](../../../README.md)                                                                                                                               | Document and allowlist the public sponsor address and server-only keypair secret; keep staging delivery inside the existing owner-only temporary Wrangler secrets file.                                                                                   |
| [`tests/membership-fee-sponsor.test.ts`](../../../tests/membership-fee-sponsor.test.ts), [`tests/membership-payment-client.test.ts`](../../../tests/membership-payment-client.test.ts), [`tests/boundaries.test.ts`](../../../tests/boundaries.test.ts), [`tests/staging-deployment.test.ts`](../../../tests/staging-deployment.test.ts) | Cover key parsing/mismatch, operation-only requests, partial-signature preservation, secret import boundaries, exact route input and staging allowlists.                                                                                                  |
| [`docs/mvp-spec.md`](../../../docs/mvp-spec.md), [`tickets/README.md`](../../README.md), [`COR0007`](../organisatory/COR0007-core-multigym-membership-mvp.md)                                                                                                                                                                            | Confirm the Devnet-only sponsor policy, retain production fee economics as unresolved and register this peer slice.                                                                                                                                       |

### Decisions and deviations

- 2026-09-27: Use server construction plus partial signing instead of accepting a browser-created transaction. This makes the signing policy structurally narrow: the sponsor can pay only for the exact actor-owned activation quote the server already controls.
- 2026-09-27: Keep the member as the Wallet Standard sending signer. Phantom adds the token-authority signature and broadcasts the same transaction containing the server's sponsor signature.
- 2026-09-27: Correct the configured public sponsor from the originally proposed Phantom address to the address actually controlled by the supplied CLI keypair. Both public accounts were funded on Devnet, but only the derived `E9nR…ouWf` account can be signed by the available secret.
- 2026-09-27: The first real sponsored 80-EURC transaction finalized successfully, with the sponsor paying the network fee and the member authorizing the transfer, but membership reconciliation rejected it. Solana RPC exposed the appended read-only reference through the parser's multisig-shaped fields instead of the canonical `authority` field. Extend verification only for that exact representation and preserve every independent signer, reference, quote and balance check.

### Contracts, configuration, and operations

Adds server-only `SOLANA_FEE_SPONSOR_ADDRESS` and `SOLANA_FEE_SPONSOR_KEYPAIR_BASE64`. The second value must be the single base64 encoding of the raw 64-byte Solana CLI JSON keypair; an array literal is not accepted. Local values stay in ignored `.env.local`; staging values stay in ignored `.env.staging.local` and enter the Worker only as Wrangler secrets. No database, public response, product-price or reconciliation-evidence migration is required. Rollback removes the sponsor route/config and restores the DEV0081 member fee payer.

## Validation results

- Date and environment: 2026-09-27, Node 24.21.0, Next.js 16.3.5, Solana Kit 8.3.0, local Next development/production builds and public Solana Devnet RPC.
- `npm test`: passed 76/76, including three keypair parser/address-consistency cases, operation-only sponsor preparation, sponsor-signature preservation, secret-source boundaries, staging binding checks and the reference-bearing RPC parser regression.
- `npm run lint`: passed with no errors.
- `npm run typecheck`: passed after route type generation.
- `npm run build -- --webpack`: passed; the production build compiled and generated the new dynamic `/api/membership/activation/sponsor` route.
- `npm run format:check` and `git diff --check`: passed.
- Secret-safe local validation: passed after aligning the public address; it reported only that the address matched the keypair. No secret or private-key bytes were printed.
- Read-only Devnet RPC at slot `504765019`: the original public account held 5 SOL and the keypair-controlled sponsor held 1 SOL. This check used only public addresses.
- Restarted `npm run dev`: passed; `/` and `/membership/setup` returned `200`, and an unauthenticated same-origin sponsor request returned `401`.
- Native Chrome rehearsal: Phantom approved and broadcast one sponsored 80-EURC activation. Devnet finalized it with the configured sponsor as fee payer, the linked member as token authority and the fixed pool token account receiving the exact amount. The pre-fix verifier rejected the RPC parser shape, so no membership was persisted.
- Focused payment-verification test: passed 5/5 after adding the observed RPC representation and four nearby fail-closed variants.
- Post-fix `npm run lint`, `npm run typecheck`, `npm run format:check` and `git diff --check`: passed.
- Public Devnet replay: the application-equivalent Solana Kit RPC decoder loaded finalized signature `4J34…fdTb`, and the corrected verifier returned `verified` at slot `504802995` for the expected 80,000,000 base-unit EURC movement. Only public transaction data was read.
- DEV0083 recovery rehearsal: the same finalized signature was re-verified against its immutable operation quote and atomically produced one active Basic membership. Native Chrome then showed `/my-access` with the four frozen gyms, 10/10 included check-ins remaining and verification slot `504802995`; no replacement payment was requested or broadcast.
- `npm run deploy:staging:check`: not run to completion because the existing ignored `.env.staging.local` lacks the previously required `SOLANA_CLUSTER`; sponsor presence/format was not the reported failure. No deployment was attempted.

| Criterion | Evidence                                                                                                    | Result                                                        |
| --------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| AC1–AC2   | Server construction/service/route implementation; operation-only tests; finalized transaction has the sponsor fee payer and member authority signatures | Passed locally and on Devnet                                  |
| AC3–AC4   | Parser failure cases, one-source secret boundary, ignored env use and bounded route responses               | Passed locally                                                |
| AC5       | Updated summary/disclosure copy and real Phantom approval of the exact sponsored 80-EURC payment             | Passed locally and on Devnet                                  |
| AC6       | Existing cancellation/ambiguous-response tests pass                                                         | Passed deterministically; manual rejection pending            |
| AC7       | 76 unit/boundary tests, exact public-transaction replay, lint, types, format and build                        | Passed                                                        |
| AC8       | Sponsored 80-EURC transfer finalized, passed corrected verification and persisted one active membership; rejected approval remains | Partial                                                       |

## Risks, limitations, and follow-ups

A direct environment-held key is intentionally limited to a funded Devnet test account. Endpoint abuse can spend test SOL, and repeated independently approved transfers can still move EURC more than once even though only one operation can activate; same-origin authentication, exact server construction, one-operation UI state and no automatic retry reduce but do not eliminate that hackathon-only risk. Production requires hardened custody, policy/rate limits and an explicit fee model.

[DEV0083](../../archive/backend/DEV0083-recover-verified-membership-activation.md) now supplies the deliberately narrow exception to the otherwise-terminal lifecycle: only an operation already submitted with immutable payment evidence and failed specifically as `verification-failed` may be re-verified and atomically confirmed. The real sponsored payment has been recovered and displayed as an active membership. AC8 remains open solely for the separate manual rejected-approval rehearsal.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: Self-review pending implementation and real-wallet evidence; no independent review.
- Deployment or release: None.
