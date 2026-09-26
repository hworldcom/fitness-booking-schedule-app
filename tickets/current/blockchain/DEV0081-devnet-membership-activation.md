# Ticket DEV0081: Activate memberships with Devnet EURC

- Status: Ready
- Created: 2026-09-26
- Last updated: 2026-09-26
- Milestone: M2 membership period and activation
- Coordination: [COR0007 — Core multi-gym membership MVP](../organisatory/COR0007-core-multigym-membership-mvp.md)
- Related records: completes the user-visible payment half of [DEV0080 — Persist membership activation foundation](../../archive/backend/DEV0080-membership-activation-foundation.md), replaces the Coming Soon handoff delivered by [DEV0075 — Preview membership selection](../../archive/frontend/DEV0075-preview-membership-selection.md), depends on the personal-wallet authority and pending real-Phantom evidence in [DEV0047 — Personal wallet linking and replacement](../backend/DEV0047-personal-wallet-linking-and-replacement.md), and reuses the Wallet Standard connection from [DEV0027 — Phantom wallet connection foundation](../../archive/blockchain/DEV0027-phantom-wallet-connection-foundation.md)

## Objective and context

Replace the membership review page's intentional `Continue to Coming Soon` handoff with the smallest real hackathon activation flow. A signed-in member reviews the authoritative Basic or Classic terms and four selected gyms, pays the exact amount in configured test EURC through their linked Phantom wallet on Solana Devnet, and receives exactly one active fixed membership period only after independent server verification and reconciliation.

DEV0075 currently saves a browser-local draft and truthfully creates no access. DEV0080 now supplies private actor-owned activation operations, immutable plan/four-gym snapshots, monotonic pending/submitted/confirmed/failed state, transaction-signature uniqueness, fixed non-overlapping periods and a bounded member read model. This ticket connects that foundation to an actual Devnet token transfer and the visible setup/My Membership journey required by [activation](../../../docs/mvp-spec.md#73-activation), [asset and wallet integrity](../../../docs/mvp-spec.md#8-asset-wallet-and-demo-integrity), [M2](../../../docs/mvp-spec.md#m2--membership-period-and-activation) and acceptance scenarios A02–A04, A22–A24.

## Scope and non-goals

- In scope: signed-in review and activation states; server preparation of an authoritative DEV0080 operation; an exact Devnet/test-EURC payment quote; configured membership-pool destination; linked-and-connected personal-wallet checks; source/destination associated token account resolution; checked token-transfer construction; a stable operation reference; pre-signature simulation; explicit transaction summary and Phantom approval; submission persistence; server-only RPC verification; finalized reconciliation; safe cancellation, retry, timeout and reload behavior; active/pending/failed My Membership presentation; Devnet explorer evidence; configuration, dependency, schema-contract and test updates required by that vertical slice.
- Out of scope: mainnet or real funds; production billing, renewal, cancellation, refunds or chargebacks; recurring wallet authority; delegated spending; gas sponsorship; custody of member private keys; arbitrary tokens or mock EURC presented as EURC; included check-ins, reservations or gym allocation; non-core gym payments; final gym payouts; pool-wallet authentication, administration or withdrawals; partner onboarding; multiple simultaneous membership periods; transfers, passes, events or expanded social behavior.
- A new custom Anchor program is not part of the default first slice. The confirmed design uses one direct checked SPL Token transfer into a dedicated Devnet membership-pool associated token account. If a program-controlled vault is later required for acceptance or safe operation, revise this ticket before implementation rather than silently expanding it.

## Expected behavior and edge cases

A guest may build and review a local plan/four-gym draft but must sign in before activation. The safe return path preserves or reconstructs that draft without placing plan terms, wallet authority or payment evidence in the URL. A signed-in member without a durable linked wallet is guided through DEV0047's explicit message-only link flow. A connected address that differs from the account's linked address cannot pay or activate.

For this ticket, **browser** means the frontend JavaScript running on the member's device, while **server** means MovX's backend route/service code. A Solana RPC endpoint is an external node API used by either side; it is not part of the browser or MovX backend. The browser owns wallet connection, transaction presentation, simulation, Phantom approval and signed-transaction broadcast. The server owns the authoritative activation operation, payment expectations, recovery and finalized verification. Phantom alone holds the member's signing key; neither the MovX browser code nor backend receives or stores it.

Before any transaction prompt, the screen shows the server-derived plan/version, exact EURC amount, four gyms, one-calendar-month period, linked source wallet, clearly named membership-pool destination, `Solana Devnet`, `test EURC`, test-SOL network-fee responsibility and a no-real-funds statement. The user makes one explicit activation choice after reviewing that summary. The server first creates the operation, authoritative payment expectation and unique reference address. The browser then obtains a fresh blockhash, builds one legacy checked token-transfer transaction from that bounded server response, includes the reference plus optional versioned memo, and simulates the exact unsigned transaction through its configured public Devnet RPC. A failed simulation prevents the Phantom prompt. A successful simulation is shown as a preflight result, not proof of payment, before Phantom receives the explicit approval request.

Receiving a signature is not activation. The browser broadcasts the Phantom-signed transaction, records the returned signature against the same operation and shows a pending state. If that response is lost, the server searches the unique reference address, fetches candidate transactions and applies the same verification rather than preparing or sending another payment. A server-only verifier reads the Devnet transaction and may call DEV0080's trusted completion boundary only when all of the following match authoritative configuration and the operation snapshot:

- cluster is Solana Devnet and the transaction reached the required finality with no execution error;
- the configured official EURC mint, expected token program and on-chain decimals match;
- the linked member wallet signed and owns the debited source token account;
- the configured membership-pool owner and derived destination token account match;
- the destination received exactly the operation's snapshotted base-unit amount;
- the transaction carries the expected stable operation reference; and
- the signature has not already been attributed to another operation.

An exact replay returns the existing operation/period. Wallet rejection fails the operation as `wallet-cancelled` and creates no membership. A simulation failure, insufficient test EURC/SOL, missing token account, stale blockhash or dropped transaction produces bounded recovery guidance and no active period. A stale blockhash before submission may be rebuilt for the same operation. Once a signature is submitted, an RPC timeout or unknown finality remains pending and is reconciled; it must not trigger a second payment or be mislabeled as a definitive failure.

Reloading setup or My Membership resumes the same pending operation and reconciliation. The browser draft is cleared only after confirmed activation. On success, setup routes to My Membership, which renders DEV0080's active period, selected gyms, dates, payment status, Basic's ten available included check-ins or Classic's daily-uncapped policy, and a Devnet explorer link without exposing private RPC data. An existing unexpired membership blocks another activation.

Malformed RPC data, an unsupported transaction version, wrong mint/program/decimals/source/destination/amount/reference, failed transaction, reused signature or actor mismatch never creates access. On-chain names, memos, logs and RPC error text are untrusted and cannot become executable content or unbounded user-facing copy.

## Assumptions, decisions, and dependencies

- Confirmed product rules remain unchanged: Basic is 80 EURC with ten included check-ins, Classic is 150 EURC without a numerical period allowance, both use four core gyms, and a confirmed period lasts one calendar month without automatic renewal.
- The repository already pins `@solana/kit` 8.3.0, `@solana/kit-plugin-wallet` 0.20.0 and `@solana/react` 8.3.0. Implementation must inspect those installed APIs before changing the client. The repository does not currently install the token or memo instruction packages and has no RPC/payment environment contract.
- Confirmed Devnet payment configuration: [Circle's official EURC address register](https://developers.circle.com/stablecoins/eurc-contract-addresses) identifies `HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr` for Solana Devnet; it is an initialized classic SPL Token mint owned by `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA` with six decimals. Circle documents its [faucet](https://faucet.circle.com/) as the source of testnet EURC. Pin these values through reviewed configuration and never accept a mint, token program or decimals from browser input. If official test EURC becomes unavailable, block the rehearsal rather than relabeling another token as EURC.
- The user designated `3AX3T287yKvEahS9dThua27dSmby8UV7DdVWtK8BgwDL` as the fixed Devnet membership-pool owner. `@solana/kit` accepted it as a valid address and Devnet `getAccountInfo` at slot `504526985` returned a non-executable, zero-data account owned by the System Program. Its canonical EURC associated token account is `BQjoA2qcxpBF6sNCLvz8XwyiEaUnAW3osnyF76BBDtJ8`; Kit derivation and Devnet RPC at slot `504528271` confirmed that this initialized classic SPL Token account has the configured pool owner and EURC mint. The application sends only to this configured token account and verifies it again during payment reconciliation.
- The pool wallet is a recipient, not an application actor. It never connects to MovX, authenticates, signs the member's activation or exposes signing authority to the application. The MVP therefore requires no cryptographic pool-control proof or pool admin interface. Custody proof, withdrawals, refunds and production treasury operations require a separate future ticket before they enter product scope. No seed phrase, private key or keypair file enters the application or repository.
- Confirmed RPC boundary: `SOLANA_CLUSTER=devnet` fixes the intended network, `NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com` is the deliberately public browser endpoint, and `SOLANA_RPC_URL=https://api.devnet.solana.com` is the separately configured server endpoint for the initial hackathon deployment. The public endpoint is an acceptable rate-limited Devnet default, not a production reliability promise. A private provider URL or credential may later replace only the server value and must never use the `NEXT_PUBLIC_` prefix or reach browser bundles, responses or logs. Configuration fails closed on missing values, a non-Devnet server endpoint or cluster disagreement; there is no silent cluster fallback.
- The browser RPC obtains blockhashes, simulates the exact unsigned transaction and broadcasts the Phantom-signed transaction. The server RPC independently reads finality and full transaction evidence, searches by reference during recovery and is authoritative for membership activation. The initial flow requires HTTP RPC plus bounded polling only; no WebSocket subscription is required.
- Confirmed transaction shape: use one legacy transaction containing `TransferChecked`, the linked member wallet as token authority and fee payer, a unique Solana Pay-style reference address as a read-only non-signer account and an optional short memo `movx-membership:v1:<operation-uuid>`. Legacy format is sufficient for this small instruction set and avoids unnecessary versioned-transaction complexity. The memo is human-readable diagnostic evidence only and is never sufficient proof of payment.
- The server generates a fresh random reference address while preparing each operation and persists only the public address as its durable lookup key; the address is never funded or used as a signer and no reference signing material is retained. The normal path records the browser-returned transaction signature. If that response is lost, server recovery uses `getSignaturesForAddress(reference)`, fetches bounded candidates with an explicit supported transaction version and accepts only one that passes the complete authoritative verifier. A reference match alone never activates a membership.
- Confirmed finality rule: display `submitted` while the transaction is visible but activate only after `finalized`. RPC absence, timeout or disagreement is an unknown/pending state, not proof of failure or success. Polling and reconciliation are bounded, idempotent and never trigger a second payment automatically.
- DEV0080 owns authoritative operation and period persistence. This ticket may extend its evidence shape with mint, token-program, reference, slot/finality or reconciliation metadata, but must preserve its actor isolation, immutable snapshots and internal-only completion boundary.
- DEV0047's automated wallet-linking contract exists, but its real Phantom link/disconnect/reconnect/replace and responsive keyboard evidence is still incomplete. Transaction implementation may start with deterministic adapters after this ticket becomes Ready, but this ticket cannot complete until the applicable real-wallet authority path and the activation transaction rehearsal both pass.
- Official Solana guidance requires deriving and validating associated token accounts, using a checked token transfer, treating signature receipt as non-final and validating settlement server-side. The implementation must recheck current primary documentation and installed package APIs immediately before coding.

### Confirmed readiness decisions

1. The frontend/browser and backend/server are separate RPC callers with different trust roles even when both initially point to Solana's public Devnet endpoint. Browser-visible configuration supports preflight and broadcast; server-only configuration supports authoritative verification and recoverable reconciliation.
2. Every activation operation receives a unique on-chain reference address. The browser-returned signature is the normal correlation path; reference lookup is the recovery path after disconnect or a lost response. The optional memo improves explorer readability but is not an authority or lookup dependency.
3. The first slice uses a legacy `TransferChecked` transaction, finalized server verification and bounded HTTP polling. No custom program, WebSocket dependency, pool signer or retained reference key is needed.

## Implementation plan

1. Inspect the installed Kit/wallet APIs, pin only the required compatible token/memo packages, and implement the confirmed public-browser/server-only RPC, cluster, mint and pool configuration with startup validation and secret-safe documentation.
2. Extend DEV0080's payment-evidence contract as required for configured mint/program/reference/finality and reconciliation audit data. Preserve forward-only migrations, forced row-level security, idempotency, transaction-signature uniqueness and the internal completion boundary.
3. Add actor-protected, same-origin, private/no-store activation HTTP contracts for prepare/quote, submission, current state and reconcile. Derive actor, plan terms, amount, linked wallet, mint and pool destination server-side; never accept them as authority from the browser.
4. Add a bounded browser Solana adapter that derives and validates source/destination token accounts, obtains a fresh blockhash, builds the exact legacy checked transfer plus operation reference and optional memo, simulates it through the public RPC before approval, sends it through the existing Wallet Standard Phantom connection, and maps wallet/network errors without leaking raw RPC responses.
5. Add a server-only Devnet verifier and reference-recovery path that query the server RPC, fetch an explicit supported transaction version, validate finality and complete token movement against the quote/snapshot, record reconciliation evidence, and call `completeVerifiedMembershipActivation` exactly once. Keep ambiguous outcomes pending and make polling plus manual/request-driven retry safe.
6. Replace only the membership review's Coming Soon CTA with accessible signed-out, wallet-link-required, wallet-mismatch, review, simulating, awaiting approval, submitted, reconciling, confirmed and recoverable-error states. Keep other unrelated Coming Soon links unchanged. Render pending/active membership state in My Membership and clear the local draft only on confirmation.
7. Add deterministic adapter, service, database, concurrency, boundary and browser tests. Finish with a real Phantom Devnet test-EURC rehearsal covering approval, rejection, reload/reconciliation and explorer evidence without exposing or storing key material.

## Acceptance criteria

- [ ] AC1: The membership review no longer redirects a ready signed-in member to Coming Soon; it shows authoritative Basic/Classic terms, four gyms, fixed period, linked wallet, Devnet/test-EURC amount, membership-pool destination and network-fee notice before an explicit approval action.
- [ ] AC2: Signed-out, unlinked, disconnected and connected-wallet-mismatch states cannot prepare or send payment and provide a safe recovery path without turning wallet connection into application identity.
- [ ] AC3: The flow records one DEV0080 activation operation and unique public reference address before submission, builds and simulates one exact legacy checked transfer using the configured official Devnet EURC mint, and asks Phantom for no transaction until the member explicitly confirms the summary and simulation succeeds.
- [ ] AC4: Server reconciliation independently verifies finalized outcome, expected mint/token program/decimals, linked source owner/signature, exact destination token account, exact base-unit amount and operation reference before creating exactly one active period.
- [ ] AC5: Wallet rejection, simulation failure, insufficient funds/fees, blockhash expiry, transaction failure and verification mismatch create no membership. Unknown or timed-out submitted results remain pending and do not send a second payment automatically.
- [ ] AC6: Exact retry, concurrent reconcile calls and reload converge on the same operation, transaction signature and membership period. If the browser loses the submitted signature, bounded server lookup by the stored reference finds and fully verifies the finalized transaction without duplicate payment or access; the optional memo is never accepted as recovery evidence by itself.
- [ ] AC7: Confirmed activation clears the matching local draft and My Membership shows the active dates, four frozen gyms, confirmed Devnet evidence and the correct Basic remaining allowance or Classic policy; financial copy never implies production funds or finalized gym payout.
- [ ] AC8: Browser/database roles cannot call trusted completion, choose the mint/source/destination/amount/finality or inject payment authority. RPC/on-chain data is validated and bounded. Server RPC configuration and credentials never reach browser code, while the browser RPC is explicitly non-secret. The application has no pool-wallet authentication or signing path, and no private key, seed phrase, retained reference key, service credential or pool signing authority reaches browser code, logs, fixtures or the repository.
- [ ] AC9: Deterministic unit, adapter, database, authorization, concurrency, route-boundary and responsive keyboard/browser tests pass, along with clean migration replay, lint, type, format and production builds.
- [ ] AC10: A real Phantom Devnet rehearsal transfers official test EURC, records the submitted signature, survives reload/reconciliation and produces one active membership; a separate rejected-approval rehearsal produces no transfer or membership. Evidence records recipient, amount, token, fee payer and cluster without recording secrets.

## Validation plan

Use deterministic RPC fixtures for successful finalized transfer, wallet rejection, simulation error, insufficient EURC, insufficient SOL, stale blockhash, dropped/failed transaction, unsupported version, wrong mint/program/decimals/source/destination/amount/reference, malformed RPC data, reused signature, timeout/unknown status and delayed finalization. Cover missing or inconsistent cluster/RPC configuration, prove that simulation failure prevents the Phantom request, and recover a lost browser signature through bounded reference lookup. Unit tests must prove quote/transaction/verifier parsing independently rather than asserting only mocked happy-path output.

Run a clean local database replay and the full pgTAP/database integration suites. Use at least two authenticated members and concurrent reconcile requests to prove actor isolation and at-most-one completion. Route/boundary tests must prove same-origin/no-store behavior, bounded bodies/responses, server-only RPC verification and the absence of a browser-accessible trusted-completion shortcut.

Browser coverage must exercise setup and My Membership at representative desktop/mobile widths and with keyboard navigation across signed-out, link-required, wallet mismatch, approval pending, rejected, submitted/reloaded, confirmed and recoverable failure states. Existing public browsing and unrelated Coming Soon routes must remain intact.

Run `npm run db:reset`, `npm run db:runtime`, `npm run db:test`, `npm run test:db`, `npm run db:lint`, focused adapter/server tests, `npm test`, affected Playwright projects, `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build` or the documented production-builder fallback, and `git diff --check`.

For the final manual rehearsal, show the transaction summary and require explicit user approval before Phantom signs or sends. Use only the user's linked Phantom account on Solana Devnet; never request private key material. Record the configured official mint/token program/decimals, pool destination token account, member source wallet, exact test-EURC amount, fee payer, explorer signature, finality, resulting one-period identifier and observed reload behavior. Also cancel a separate wallet approval and confirm no signature, balance change or active period. A different token, fabricated signature or deterministic fixture does not satisfy AC10.

## Implementation record

Pending implementation. The ticket was created after the user confirmed that the current membership review still redirects to Coming Soon and asked to begin the user-visible activation ticket. The official mint, fixed pool token-account destination, browser/server RPC boundary and operation-reference recovery design are now recorded. The ticket is Ready; implementation has not started.

### Changes and rationale

Not implemented. The planned change is one coherent vertical slice from reviewed plan/four-gym draft through a real verified Devnet test-EURC transfer to the existing persistent active-period read model.

### Affected files

| File or component | Change and purpose |
| ----------------- | ------------------ |
| Pending | Exact configuration, migrations, Solana adapters, API routes, UI and tests will be recorded during implementation. |

### Decisions and deviations

- 2026-09-26: Keep this as one blockchain-primary vertical slice because transaction construction, independent verification, reconciliation and visible activation must agree to replace the Coming Soon handoff honestly. Included check-ins and allocation remain separate backend work.
- 2026-09-26: Prefer a direct checked SPL Token payment to a dedicated membership-pool associated token account for the first hackathon slice. A new custody program is not justified unless the readiness review identifies a concrete invariant the direct verified transfer cannot satisfy.
- 2026-09-26: Require finalized verification before access, while preserving submitted/unknown state for recovery. Signature receipt or a client callback alone never creates membership.
- 2026-09-26: The user designated `3AX3T287yKvEahS9dThua27dSmby8UV7DdVWtK8BgwDL` as the Devnet membership-pool owner. Circle documentation, local Kit derivation and read-only Devnet RPC checks verified the official EURC mint, classic token program, six decimals and canonical destination token account `BQjoA2qcxpBF6sNCLvz8XwyiEaUnAW3osnyF76BBDtJ8`.
- 2026-09-26: Corrected the pool-wallet boundary after user review. The pool is a fixed configured recipient, not an authenticated application actor; control proof, signing, administration and withdrawals are outside this MVP and must not be added to DEV0081.
- 2026-09-26: Confirmed that browser means MovX frontend code on the member's device, server means MovX backend route/service code, and RPC means an external Solana node API either side may call. The browser owns simulation, Phantom approval and broadcast; the server owns authoritative payment expectations, recovery and finalized verification.
- 2026-09-26: Adopted separate public-browser and server-only Devnet RPC settings even though both initially use Solana's public Devnet endpoint. This keeps credentials and verification authority out of the browser and allows the server endpoint to move to a private provider without changing the frontend contract.
- 2026-09-26: Adopted one unique Solana Pay-style public reference address per activation operation, with signature callback as the normal path and server lookup by reference as disconnect recovery. The optional versioned memo is diagnostic only. A legacy `TransferChecked` transaction and bounded HTTP polling are sufficient for the hackathon slice.

### Contracts, configuration, and operations

Planned additions include `SOLANA_CLUSTER=devnet`, deliberately public `NEXT_PUBLIC_SOLANA_RPC_URL`, server-only `SOLANA_RPC_URL`, and the confirmed EURC mint, token program, decimals, pool owner and pool token-account configuration. The two RPC URLs initially use `https://api.devnet.solana.com`; only the server setting may later contain a private provider credential. The ticket is expected to add pinned token/memo instruction dependencies and may add forward-only public-reference/finality/reconciliation columns to DEV0080's schema. It does not create, store or use pool-wallet private keys or persistent reference signing keys.

## Validation results

Pending implementation validation; no DEV0081 payment transaction has been performed. Planning validation has confirmed the official Devnet EURC and fixed pool destination as described below.

| Criterion | Evidence | Result |
| --------- | -------- | ------ |
| Pool-owner readiness | `@solana/kit` `address(...)`; Devnet `getAccountInfo` at slot `504526985` | Public-key parsing passed and RPC returned a System Program-owned, non-executable, zero-data account suitable as the fixed ATA owner. Application-level control proof is not required because the pool never signs or authenticates. |
| EURC mint readiness | Circle's official EURC address documentation; finalized Devnet `getAccountInfo` at slot `504528159` | `HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr` was confirmed as an initialized six-decimal mint owned by the classic SPL Token Program. |
| Pool destination readiness | Kit canonical ATA derivation; finalized Devnet `getTokenAccountsByOwner` at slot `504528271` | `BQjoA2qcxpBF6sNCLvz8XwyiEaUnAW3osnyF76BBDtJ8` was confirmed as the initialized canonical token account for the configured pool owner and EURC mint. |
| RPC/reference readiness | User-reviewed frontend/backend boundary and Solana Pay-style reference recovery design | Separate public-browser/server-only RPC responsibilities, legacy transaction shape, pre-approval simulation, finalized verification and lookup-by-reference recovery were accepted; ticket moved to Ready. |
| AC1–AC10 | Not run | Not run |

## Risks, limitations, and follow-ups

The highest risks are paying an incorrectly configured destination, trusting a client callback, activating on the wrong token, losing reconciliation after a response timeout, or treating a public RPC as authoritative without validation. Fail closed on configuration and mismatched evidence, but preserve ambiguous submitted transactions for retry so safety does not become double payment.

The membership pool is test infrastructure, not gym revenue or a production custody design. Refunds, pool withdrawal authority, final allocation/payout, accounting, taxes, disputes and production key management remain unresolved and must not be implied by the activation UI. Included check-ins/allocation and non-core direct payments require separate COR0007 peer tickets.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: Initial scope, mint/pool readiness and RPC/reference design review complete; implementation review remains.
- Deployment or release: None.
