# Ticket DEV0047: Personal wallet linking and replacement

- Status: In progress
- Created: 2026-09-21
- Last updated: 2026-09-25
- Milestone: Prioritized identity and onboarding
- Coordination: [COR0003 — Account-first identity and wallet linking](../organisatory/COR0003-account-first-identity-and-wallet-linking.md)
- Related records: follows completed [DEV0046 — Email OTP registration and application profiles](../../archive/backend/DEV0046-email-otp-registration-and-application-profiles.md); reuses the wallet connection delivered by [DEV0027](../../archive/blockchain/DEV0027-phantom-wallet-connection-foundation.md), the binding foundation from [DEV0039](../../archive/backend/DEV0039-prepared-identity-and-wallet-bindings.md), and the actor boundary from [DEV0040](../../archive/backend/DEV0040-protected-access-and-database-context.md); cancelled [DEV0041 — Club wallet authorization](../../archive/backend/DEV0041-club-wallet-authorization.md) remains historical evidence and no longer consumes this challenge boundary

## Objective and context

Let a signed-in email account optionally prove and link one personal Phantom wallet for later wallet-required actions without turning that wallet into the application login method. Support explicit disconnect, unlink and replacement with clear recovery and ownership rules.

## Scope and non-goals

- In scope: one active personal wallet per account; server-issued short-lived, single-use message challenges; account/origin/cluster/address/purpose binding; atomic unique ownership; wallet settings; connection versus linked state; recent email reauthentication before unlink/replacement; new-wallet proof; audit history; collision-safe errors; tests and real Phantom rehearsal.
- Out of scope: account registration/profile creation owned by DEV0046; wallet login; automatic account merging; requiring the lost old wallet to approve replacement; several active personal wallets; club authority owned by DEV0041; embedded wallet creation (cancelled historical DEV0037); transactions, balances, payments, delegated signing, fee sponsorship or custody.

## Expected behavior and edge cases

Connecting Phantom exposes a selected address but creates no durable link. A signed-in person chooses `Link wallet`, reviews a message-only request and signs one challenge. The server consumes the exact unused challenge and creates the binding only when the current account, origin, Devnet cluster, address and `link-personal-wallet` purpose match.

The first delivery permits exactly one active personal wallet per account and one active application owner per wallet. A wallet already linked elsewhere fails with a generic conflict that reveals no account details. Concurrent or replayed proofs cannot create duplicate owners.

Provider disconnect preserves the durable link but disables live wallet-required actions. Explicit unlink or replacement requires application reauthentication within ten minutes. Replacement also requires a valid proof from the new wallet, but not from the old wallet so loss of the old device does not make recovery impossible. The old binding remains active until the replacement transaction succeeds, then becomes revoked audit history. Historical financial records must retain their original wallet addresses rather than following the current link.

## Assumptions, decisions, and dependencies

The user accepted these defaults on 2026-09-21: wallet linking is optional; exactly one active personal wallet is supported; connection and linking are different states; one message signature proves linking; no transaction is requested; email reauthentication protects unlink/replacement; the new wallet must prove control; automatic merging is forbidden.

Completed DEV0046 delivers wallet-independent email accounts, profiles and protected actors. DEV0047 owns the shared one-time `auth_challenges` schema for personal-wallet proof. The cancelled club-wallet product leaves its historical purpose mapping in additive migration history but creates no current runtime dependency.

Implementation defaults locked on 2026-09-22 after reviewing the installed Supabase Auth 2.116 and Solana Kit 8.3 / wallet-plugin 0.20 contracts:

- each wallet challenge lasts five minutes, is usable once and contains 32 cryptographically random bytes; PostgreSQL retains SHA-256 nonce and message hashes rather than the plaintext message or nonce;
- message version 1 visibly names MovX Club, the requested link/replace action, signed-in email, origin, immutable challenge ID, `solana:devnet`, wallet address, issue time, expiry and a no-transaction/no-funds warning;
- the browser transports the exact UTF-8 message and a bounded base64 signature; the Next.js server verifies the Ed25519 signature with the installed `@solana/kit` primitives before an atomic database function consumes the challenge and changes the binding;
- unlink and replacement accept only a detailed Supabase `amr` entry with method `otp` no more than ten minutes old. Missing, string-only, future-dated or stale authentication-method claims fail closed. The user obtains freshness by verifying another email OTP for the already signed-in email with account creation disabled; the verified subject and email must remain unchanged;
- revoked binding rows, their timestamps/reason and the verifying challenge supply the first-release audit history. The interface confirms the change in-app. A separate security-notification email is deferred until an application transactional-email capability exists; Porkbun custom SMTP for Supabase Auth does not itself provide that application service.

## Implementation plan

1. Review DEV0046's delivered account/session/actor contracts and lock the challenge lifetime, hashed nonce storage, message format, reauthentication timestamp and audit shape. Completed in the 2026-09-22 defaults above.
2. Add the shared challenge migration and update personal wallet bindings from prepared-only provenance to explicit user proof while preserving exclusive ownership and revocation history.
3. Add authenticated issue/verify/link/unlink/replace services and same-origin HTTP adapters. Keep database consumption and binding change atomic.
4. Add wallet settings and honest connected/unlinked/linked/disconnected/mismatched/proof-pending/error states using DEV0027's single wallet authority.
5. Test expiry, replay, collision, concurrency, cancellation, account/address/origin/cluster/purpose mismatch, reauthentication expiry and recovery; rehearse with real Phantom without requesting a transaction.

## Acceptance criteria

- [ ] AC1: A signed-in email account can link one selected Phantom wallet through exactly one explicit message signature and no transaction signature.
- [ ] AC2: Connection alone grants no link; disconnect preserves the durable link but removes live wallet authority.
- [x] AC3: Expired, replayed, consumed and wrong-account/address/origin/cluster/purpose proofs fail without partial changes.
- [x] AC4: One wallet cannot be actively linked to two accounts and one account cannot have two active personal wallets, including under concurrency, without exposing another owner.
- [x] AC5: Unlink/replacement requires email reauthentication within the locked window; replacement proves the new wallet, retains the old binding until success and then preserves it as revoked history.
- [x] AC6: Wallet linking never becomes account login, organization authority, payment evidence or automatic identity merging.
- [ ] AC7: Database/service/browser tests, responsive keyboard checks and a real Phantom link/disconnect/reconnect/replace rehearsal pass with exact evidence recorded.

## Validation plan

Use two DEV0046 accounts and at least two Phantom addresses. Exercise simultaneous claims, replay, collision, mismatch, expiry, cancellation, lost-old-wallet replacement and audit retention through PostgreSQL and services. Rehearse the real message-only flow on desktop and mobile-width UI; confirm no transaction prompt appears. Run focused tests plus lint, typecheck, formatting, build and affected browser regressions.

## Implementation record

Implementation started on 2026-09-22 after the final readiness review locked the security defaults. This peer was created when accepted requirements showed that account registration and wallet-proof lifecycle were independently reviewable security boundaries.

### Changes and rationale

Implementation is in progress. The database now has single-use personal-wallet challenges and durable binding history. A signed-in, enrolled account can request a five-minute message challenge, prove the exact connected Devnet address with Ed25519, and atomically link one wallet. The implementation distinguishes browser connection from the durable account link and never constructs, signs or sends a transaction.

Unlink and replacement require a detailed Supabase email-OTP authentication-method claim no more than ten minutes old. Replacement proves the new wallet, revokes the old row only in the same successful transaction and retains a deferred reference to the replacement row. Advisory locks serialize same-account and same-wallet races. Expected collision, stale/replayed proof and state-conflict responses are bounded and reveal no other account.

The global wallet dialog now presents signed-out, unlinked, linked-but-disconnected, linked-and-connected and mismatched-wallet states. Provider disconnect leaves the durable link intact. Unlink/replacement starts an email-code confirmation when the current session is not recent enough; the verified Auth subject and email must still match before the pending action resumes.

### Affected files

| File or component                                                                                                                                                | Change and purpose                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/20260922000100_create_personal_wallet_linking.sql`                                                                                          | Adds hashed one-time challenges, proof/audit columns, forced row-level-security policies and atomic current/issue/complete/unlink database functions.                                               |
| `src/server/db/schema/identity.ts`, `src/server/db/wallet/repository.ts`                                                                                         | Maps the challenge/binding contract and exposes only actor-scoped function calls to the server service.                                                                                             |
| `src/auth/reauthentication.ts`, `src/server/auth/session.ts`                                                                                                     | Extracts the latest detailed email OTP authentication time from verified claims and applies the ten-minute fail-closed window.                                                                      |
| `src/solana/personal-wallet.ts`, `src/server/wallet/signature.ts`, `src/server/wallet/service.ts`                                                                | Defines the bounded message/result contract, validates canonical Solana addresses, UUIDs and base64 signatures, verifies exact Ed25519 bytes and coordinates authorization with atomic persistence. |
| `src/app/api/wallet/personal/**`, `src/solana/client/personal-wallet-client.ts`                                                                                  | Adds private no-store, same-origin current/challenge/proof/unlink HTTP adapters and browser response validation.                                                                                    |
| `src/solana/client/wallet-connection.tsx`, `src/solana/client/wallet-presentation.ts`                                                                            | Adds honest link/connection/mismatch states, message-only proof, disconnect, protected unlink/replacement, email-code confirmation and bounded errors.                                              |
| `tests/personal-wallet.test.ts`, `tests/server/wallet-signature.test.ts`, `tests/database/personal-wallet.test.ts`, `scripts/rehearse-local-personal-wallet.mjs` | Covers message/transport rules, exact signature verification, database authorization/lifecycle/concurrency and the real local Auth/HTTP path.                                                       |
| `package.json`, `tests/auth.test.ts`, `tests/boundaries.test.ts`                                                                                                 | Registers the local rehearsal and expands reauthentication and architecture-boundary coverage.                                                                                                      |

### Decisions and deviations

On 2026-09-22 the planned notification risk was bounded to an immediate in-app result plus durable audit history. Out-of-band application security email is not claimed because no transactional-email service exists; adding one would require a separate ticket and delivery/retry/privacy contract.

The binding row uses its verifying challenge UUID as its own UUID. Replacement uses a deferred self-reference so the old active row can be revoked and point to the new row before the new active row is inserted, while all uniqueness and audit checks still commit atomically. Expected invalid, replayed or expired proofs return a bounded result from PostgreSQL instead of raising an exception that aborts the surrounding actor transaction.

### Contracts, configuration, and operations

The new contract adds `app.auth_challenges`, extends `app.wallet_bindings` with proof, reauthentication, revocation-reason and replacement references, and grants the restricted runtime role execute access only to four actor-scoped functions. Challenges retain SHA-256 nonce/message hashes, not plaintext messages, signatures or OTPs. The browser/server JSON contract is bounded to current state, challenge issue, proof completion and unlink results. No new environment variable or secret is required. Hosted Supabase credentials were not changed during local validation.

## Validation results

The user explicitly approved resetting the disposable local Supabase database on 2026-09-22. `npm run db:reset` then replayed all migrations, including the final bounded `invalid-proof` behavior, from an empty local database. After recreating the restricted runtime login, all database, authentication and wallet-proof rehearsals passed. Hosted Supabase data and `.env.local` were not changed.

| Criterion | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Result                                                                                     |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| AC1, AC6  | `npm test` passed 42/42, including exact message fields and a source assertion that the flow uses `useSignMessage` and contains no transaction signing/sending API. `node --conditions=react-server --import tsx --test tests/server/wallet-signature.test.ts` passed 1/1 for exact Ed25519 verification. The first unit invocation was blocked only by the restricted runner denying `tsx`'s local IPC socket; the identical approved retry passed.                                                                                                                                                       | Passed locally; the real Phantom prompt remains part of AC1/AC7 evidence.                  |
| AC2       | Connection and durable binding are separate client/API states. `npm run test:e2e -- tests/browser/wallet.spec.ts tests/browser/auth.spec.ts` passed 6/6 across desktop and mobile projects, including keyboard-reachable email sign-in and safe wallet-free behavior.                                                                                                                                                                                                                                                                                                                                      | Automated presentation passed; real Phantom disconnect/reconnect remains.                  |
| AC3–AC5   | The final `npm run db:reset` passed, `npm run test:db` passed 10/10 for authorization, expiry, replay, mismatch, collision, concurrency, reauthentication, replacement audit and unlink, and `npm run db:test` passed 66/66 pgTAP assertions. `npm run db:lint` reported `No schema errors found`. `npm run test:auth` passed two-account OTP, returning-account, invalid/replayed-code, isolation and sign-out scenarios. `npm run test:wallet-auth` passed same-origin protection, exact-message proof, replay rejection, replacement, cross-account collision and unlink using generated local signers. | Passed against a clean local Supabase installation.                                        |
| AC7       | `npm run typecheck`, `npm run lint`, `npm run format:check`, `git diff --check`, and `npx --no-install next build --webpack` passed. The production build was checked once with temporary local Supabase overrides for the HTTP rehearsal and again with the unchanged hosted `.env.local`. Default Turbopack previously could not bind its internal worker port in this environment; the webpack build compiled all routes.                                                                                                                                                                               | Automated checks passed; real Phantom and signed-in responsive keyboard rehearsal pending. |

## Risks, limitations, and follow-ups

Wallet replacement is an account-takeover target. Bind and consume challenges atomically, require recent application authentication, show the result immediately and retain its audit history. A later transactional-email capability should add out-of-band security notifications. One active wallet is intentional first-release scope; multiple wallets require a new product decision.

Before completion, run the prepared real Phantom link/disconnect/reconnect/replace flow and signed-in responsive keyboard checks. Record the observed message prompts, cancellation recovery and confirmation that Phantom never requests a transaction. Local rehearsal users and wallet data are disposable; the hosted project still needs this migration applied through the normal deployment process before hosted testing.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: Requirements reviewed with the user; no independent implementation review.
- Deployment or release: None.
