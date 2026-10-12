# Ticket DEV0211: Persist personal wallet bindings

- Status: Ready
- Created: 2026-10-12
- Last updated: 2026-10-12
- Milestone: Hackathon H1 wallet ownership
- Coordination: [COR0019 — Hackathon Solana group events](../organisatory/COR0019-hackathon-solana-group-events.md)
- Related records: historical wallet-proof baseline [DEV0047](../../archive/backend/DEV0047-personal-wallet-linking-and-replacement.md); consumes the authority contract from completed [DEV0210](../../archive/organisatory/DEV0210-adopt-hackathon-group-event-contract.md); supplies ownership state to [DEV0212](../frontend/DEV0212-connect-phantom-wallets.md) and [DEV0215](../blockchain/DEV0215-integrate-sponsored-devnet-funding.md)

## Objective and context

Restore and adapt the previously implemented email-account-owned personal Solana wallet boundary so server operations can require proof that the signed-in MovX actor controls the coach or participant address used in an event transaction. The additive wallet migrations survived the scheduling split, while their application/server/browser runtime was removed.

## Scope and non-goals

- In scope: additive personal-wallet schema; one active binding per MovX account; short-lived origin/cluster/account-bound challenges; Wallet Standard message-signature verification; idempotent linking; explicit replacement; audit timestamps; actor-scoped reads; replay, expiry and cross-account protection; local fixtures and tests.
- Out of scope: browser wallet components, transaction signing, custody, seed phrases, fee-sponsor secrets, coach payout policy, event persistence or chain settlement.

## Expected behavior and edge cases

A signed-in account requests a one-use challenge, signs the exact message in its wallet and submits the proof. The server validates the authenticated actor, expected origin, Devnet chain, address, nonce, issue/expiry times and signature before binding. Exact retries recover idempotently. Replayed, expired, modified, wrong-origin, wrong-cluster and already-bound-to-another-account proofs fail without changing either account. Replacement requires proof from the new wallet and preserves an audit trail; the active address changes atomically.

## Assumptions, decisions, and dependencies

DEV0210 confirms that email identity remains authoritative and freezes C40's replacement blockers. Reuse the delivered DEV0047 contract: one active binding per account and wallet; a five-minute single-use challenge with 32 random bytes; SHA-256 nonce/message hashes rather than plaintext retention; a versioned human-readable message binding MovX, link/replace purpose, email, origin, challenge ID, `solana:devnet`, address, issue/expiry and no-transaction warning; exact Ed25519 verification; and ten-minute recent email-OTP reauthentication for unlink/replacement. Raw private keys, seed phrases and wallet secret material never enter the browser bundle, database, logs or tickets.

Commit `63490d9` is the recoverable runtime baseline. Existing migrations `20260922000100_create_personal_wallet_linking.sql` and later identity cleanup remain in the current schema history; implementation must inspect their compatibility and restore/adapt service/UI code rather than duplicate the tables blindly. C40 adds event-liability guards that the old scheduling split never delivered.

## Implementation plan

1. Inspect the current identity/schema boundary, surviving migrations and recoverable `63490d9` runtime; update this ticket before any material design change.
2. Reuse the surviving schema when compatible and add only the smallest forward migration needed for C40 event-liability guards; restore row-level security and repository/service operations for challenges, active bindings and replacement history.
3. Implement strict signed-message encoding and verification with one-use expiry/replay handling.
4. Add actor, cross-account, origin, cluster, expiry, replay and concurrency tests.
5. Document contract and migration/rollback effects; run database, unit, lint, type, format and build checks.

## Acceptance criteria

- [ ] AC1: A signed-in MovX account can bind one proved Devnet wallet and read only its own binding.
- [ ] AC2: Duplicate, replayed, expired, mutated, cross-origin, cross-cluster and cross-account attempts fail without partial mutation.
- [ ] AC3: Replacement is explicit, atomic and auditable, with open-event implications matching DEV0210.
- [ ] AC4: Migration/RLS, service, concurrency, static and build validation pass without exposing secret material.

## Validation plan

Run clean/repeat/upgrade database migrations, pgTAP or equivalent policy checks, server/unit tests for the exact challenge codec and signature verifier, two-account authorization and concurrent-link tests, then `npm test`, relevant database suites, lint, typecheck, format check and production build. Test against local Auth; no real Devnet transaction is required.

## Implementation record

Pending implementation.

### Changes and rationale

Pending.

### Affected files

| File or component              | Change and purpose                                   |
| ------------------------------ | ---------------------------------------------------- |
| Supabase migrations/tests      | Wallet challenge, binding and ownership constraints. |
| Server identity/wallet modules | Actor-scoped proof and replacement service boundary. |
| Domain/tests                   | Exact challenge encoding and validation rules.       |

### Decisions and deviations

None yet.

### Contracts, configuration, and operations

Expected to add database contracts only; no private-key environment variable belongs to this ticket. Exact schema and rollback notes remain pending implementation.

## Validation results

Pending validation.

- Date and environment: Not run.
- Exact commands and outcomes: Not run.
- Manual steps and observed outcomes: Not run.
- Failed, blocked, or not-run checks and reasons: Not run — implementation has not started; DEV0210 resolved the authority and replacement decisions required to begin.

| Criterion | Evidence                      | Result  |
| --------- | ----------------------------- | ------- |
| AC1       | Actor-owned link tests        | Not run |
| AC2       | Adversarial proof tests       | Not run |
| AC3       | Replacement/concurrency tests | Not run |
| AC4       | Database/static/build checks  | Not run |

## Risks, limitations, and follow-ups

Wallet ownership is not app authentication and must not grant coach authority. A wallet involved in an immutable on-chain contribution may remain relevant after the user replaces the active UI binding; DEV0210 and DEV0215 must preserve recovery access rather than rewriting chain history.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: No independent review or pull request.
- Deployment or release: Not deployed.
