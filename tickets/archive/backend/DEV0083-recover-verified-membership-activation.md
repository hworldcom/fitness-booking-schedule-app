# Ticket DEV0083: Recover verified membership activation

- Status: Completed
- Created: 2026-09-27
- Last updated: 2026-09-27
- Milestone: M2 membership period and activation
- Coordination: [COR0007 — Core multi-gym membership MVP](../organisatory/COR0007-core-multigym-membership-mvp.md)
- Related records: follows the finalized verifier in [DEV0081 — Activate memberships with Devnet EURC](../blockchain/DEV0081-devnet-membership-activation.md), the sponsored rehearsal and parser correction in [DEV0082 — Sponsor membership network fees](../blockchain/DEV0082-sponsor-membership-network-fees.md), and the archived persistence foundation in [DEV0080 — Persist membership activation foundation](DEV0080-membership-activation-foundation.md)

## Objective and context

Recover an actor-owned activation whose real Devnet EURC payment finalized correctly but whose operation was previously marked `verification-failed` by an application-verifier defect. The current reconciliation service returns immediately for every failed operation, and the database permits only `submitted -> confirmed`, so correcting the verifier cannot create the membership and the interface keeps showing that no membership was created.

The recovery must reuse the same stored transaction and authoritative quote. It must never ask the member to pay again, trust a browser assertion, or reopen cancellation, execution failure or superseded operations. This closes the retry/recovery requirement in the specification's [activation contract](../../../docs/mvp-spec.md#73-activation) and [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix).

## Scope and non-goals

- In scope: recognize only a submitted-payment operation in `failed / verification-failed` as reconciliation-recoverable; rerun the existing finalized Solana verification against its immutable quote and stored signature; permit the internal verified-completion boundary to atomically transition that exact state to `confirmed`; clear stale failure evidence; preserve one-period idempotence and concurrency controls; add migration, repository/database and service-boundary tests; apply the migration locally without resetting the already-paid operation.
- Out of scope: browser- or administrator-forced confirmation, accepting unverified transaction data, reopening `wallet-cancelled`, `transaction-rejected` or `superseded` operations, changing the transaction signature or quote, refunding EURC, creating another payment, mainnet behavior, or generic failed-operation editing.

## Expected behavior and edge cases

When the current actor reconciles an operation with status `failed`, failure reason `verification-failed`, a stored submission timestamp and transaction signature, the server runs the same finalized Devnet verification used for a submitted operation. A verified result enters the internal completion boundary. The database locks the actor's operation, rechecks every immutable payment field, permits only this narrow recovery transition, clears `failed_at` and `failure_reason`, records confirmation evidence and creates one membership period with the same four gym snapshots.

A missing or mismatched transaction, wrong actor, different quote, wrong failure reason, cancellation, on-chain execution failure, superseded operation, overlapping active membership or concurrent conflicting completion must still fail closed. Repeating successful recovery returns the existing membership. Concurrent recovery attempts create exactly one period.

## Assumptions, decisions, and dependencies

- The finalized chain transaction remains the authoritative payment evidence; a previous local classification is not sufficient for recovery.
- Recovery uses the existing actor-scoped reconciliation route and server-only verifier. No public API or browser payload is expanded.
- The stored transaction signature and quote are immutable after submission. Recovery cannot replace either.
- A new forward migration is required because the local database already contains the failed operation and must be preserved.
- DEV0082's corrected verifier must be present before recovery is attempted.

## Implementation plan

1. Add a forward migration that permits only `failed / verification-failed -> confirmed` when the internal verified completion function receives the same stored payment evidence, clearing failure fields atomically.
2. Let the reconciliation service continue past its failed-state guard only for a verification-failed operation with stored payment evidence and a transaction signature.
3. Add database coverage for recovery, idempotence, concurrent attempts and terminal non-recoverable failure reasons; retain deterministic verifier coverage for rejected evidence.
4. Apply the migration to the existing local database, run the full database/static suites, then reconcile operation `bfaa7024-ca8c-45c0-b69e-07d79b47c1e6` and confirm one active membership without another transaction.

## Acceptance criteria

- [x] AC1: Reconciliation re-verifies the stored finalized transaction before attempting recovery; the browser cannot request confirmation with different payment evidence.
- [x] AC2: Only a submitted-payment operation in `failed / verification-failed` can transition to `confirmed`, and the transition clears stale failure fields.
- [x] AC3: Wallet cancellation, transaction rejection, superseded state, missing submission evidence and mismatched verified evidence remain terminal and create no membership.
- [x] AC4: Recovery is idempotent and concurrency-safe: repeated or concurrent attempts return one membership period.
- [x] AC5: The existing paid local operation becomes one active membership through reconciliation without signing or sending another transaction.
- [x] AC6: Migration replay, database integration tests, unit/static checks and the production build pass.

## Validation plan

Apply the forward migration with the local Supabase migration command so the existing failed row is preserved. Extend the database integration test to prepare, submit, fail with `verification-failed`, recover through the internal verified boundary twice/concurrently, and assert one period plus cleared failure fields. Add negative assertions for every other failure reason and mismatched evidence. Run `npm run test:db`, `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build -- --webpack` and `git diff --check`. Finally use the actor-owned reconciliation path and inspect only bounded application state plus the public transaction signature.

## Implementation record

Implementation started after the corrected DEV0082 verifier successfully replayed the finalized public transaction but the interface continued returning the old failure. A read-only local database check confirmed the operation was `failed / verification-failed`, retained its submitted transaction signature and could not reach the verifier. The completed recovery re-verified that same finalized transaction, confirmed exactly one membership period and rendered the active Basic membership in the signed-in browser without another wallet approval or transaction.

### Changes and rationale

The activation domain now identifies only a failed operation with reason `verification-failed`, a stored transaction signature and a submission timestamp as recoverable. Reconciliation sends that operation through the existing finalized-chain verifier instead of returning the stale local failure. All other failed states remain terminal.

Migration `20260927000100` narrows the database transition accordingly. The update trigger and verified-completion function accept `failed -> confirmed` only for the recoverable state and only after the caller supplies the exact stored wallet, destination, mint, token program, token decimals, reference, signature and amount. Completion clears `failed_at` and `failure_reason`, retains advisory locking and exclusion constraints, and returns the existing period on an idempotent retry.

During the real recovery, the verifier exposed a second independent defect: the configured expected Devnet genesis hash omitted its final characters. The full public Devnet hash is now a shared constant with a focused predicate test, so the configured Devnet RPC is no longer falsely classified as another cluster.

The paid operation was re-verified at finalized slot `504802995`, completed once and rendered in `/my-access` as an active Basic membership with 10 included check-ins and the original four frozen gyms. No transaction was signed or sent during recovery.

### Affected files

| File or component                                                                                                                                                                                                                                                                                                                 | Change and purpose                                                                                                                                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`supabase/migrations/20260927000100_recover_verified_membership_activation.sql`](../../../supabase/migrations/20260927000100_recover_verified_membership_activation.sql)                                                                                                                                                         | Adds the narrow recoverable lifecycle transition and exact verified-completion rules without resetting existing activation evidence.                                     |
| `src/domain/membership-activation.ts` (historical path `src/domain/membership-activation.ts`), `src/server/membership/service.ts` (historical path `src/server/membership/service.ts`)                                                                                                                                            | Classifies only submitted `verification-failed` operations as recoverable and routes them through finalized reconciliation before internal completion.                   |
| `src/solana/membership-payment.ts` (historical path `src/solana/membership-payment.ts`), `src/server/solana/membership-payment-reconciliation.ts` (historical path `src/server/solana/membership-payment-reconciliation.ts`)                                                                                                      | Defines and checks the full Solana Devnet genesis hash so a valid configured endpoint is not rejected as the wrong cluster.                                              |
| `tests/database/membership-activation.test.ts` (historical path `tests/database/membership-activation.test.ts`), `tests/membership-activation.test.ts` (historical path `tests/membership-activation.test.ts`), `tests/membership-payment-verification.test.ts` (historical path `tests/membership-payment-verification.test.ts`) | Covers exact recovery, concurrent idempotence, terminal neighboring failures, recovery classification and full/truncated/wrong genesis hashes.                           |
| [`docs/mvp-spec.md`](../../../docs/mvp-spec.md)                                                                                                                                                                                                                                                                                   | Records the confirmed rule that a stored `verification-failed` payment may recover only after full finalized-chain re-verification of the immutable quote and signature. |

### Decisions and deviations

- 2026-09-27: Use a narrow verified-payment recovery transition instead of resetting local data or asking for another test payment. This preserves the original audit trail and exercises the product's intended recovery behavior.
- 2026-09-27: Recovery exposed a separate fail-closed defect in the existing reconciliation adapter: its expected Devnet genesis hash was truncated, so the real Devnet endpoint was always classified as the wrong cluster. Correct the constant to the full public genesis hash and add a regression assertion before retrying recovery.
- 2026-09-27: A validation attempt using `supabase db reset --db-url` unexpectedly reset the main disposable local database rather than remaining isolated. No on-chain state was affected. Restore the local account relationship and original operation from the cached local session plus public finalized evidence, re-run authoritative verification, and replace that validation method with a manually created temporary database. The temporary database was removed after the full pgTAP pass.

### Contracts, configuration, and operations

A forward PostgreSQL migration refines the activation lifecycle. Existing deployments must apply it before they can recover a stored `verification-failed` operation. No environment variables, browser request fields or on-chain transaction contracts change. The Devnet genesis-hash constant is corrected but no RPC configuration field changes.

## Validation results

- Date and environment: 2026-09-27, Node 24.21.0, Next.js 16.3.5, local Supabase/PostgreSQL and public Solana Devnet RPC.
- Forward migration: applied to the local database without a planned application-data reset.
- `npm run test:db`: passed 25/25 database integration tests, including mismatched evidence, terminal transaction rejection and concurrent recovery producing one period.
- Isolated migration/seed replay plus all six pgTAP files: passed 141/141 assertions. The manually created temporary database was deleted after validation.
- `npm test`: passed 78/78 unit and boundary tests.
- `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run db:lint` and `git diff --check`: passed.
- `npm run build -- --webpack`: passed; all application and activation API routes compiled.
- Public Devnet replay: the application verifier returned `verified` for the original 80,000,000-base-unit EURC transaction at finalized slot `504802995` with the expected source token account.
- Recovery state: operation `bfaa7024-ca8c-45c0-b69e-07d79b47c1e6` is `confirmed`, has no failure reason or `failed_at`, records slot `504802995`, and owns exactly one active period.
- Native Chrome verification: `/my-access` displays “Your active membership,” Basic, 10 of 10 included check-ins, the four frozen gyms, 80 test EURC and slot `504802995`.

| Criterion | Evidence                                                                                          | Result |
| --------- | ------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Service recovery guard plus live finalized Devnet replay before completion                        | Passed |
| AC2–AC3   | Migration trigger/function checks and negative database integration cases                         | Passed |
| AC4       | Concurrent completion test and exact one-period local state                                       | Passed |
| AC5       | Original public signature recovered to one active membership; no new signature or send            | Passed |
| AC6       | Clean isolated 141-assertion replay, 25 integration tests, 78 unit tests, static checks and build | Passed |

## Risks, limitations, and follow-ups

Recovery remains intentionally narrower than a generic failed-operation reopen and depends on the configured server RPC being available for finalized re-verification. It cannot repair a missing operation or replace immutable quote/signature evidence. The active-membership view also exposed a pre-existing locale-sensitive date hydration warning in development; it does not affect persisted membership state and is outside this ticket.

## Completion and review references

- Completed: 2026-09-27.
- Commit: Not created.
- Review: Self-review completed against all acceptance criteria; no independent review.
- Deployment or release: None.
