# Ticket DEV0080: Persist membership activation foundation

- Status: Completed
- Created: 2026-09-26
- Last updated: 2026-09-26
- Milestone: M2 membership period and activation
- Coordination: [COR0007 — Core multi-gym membership MVP](../organisatory/COR0007-core-multigym-membership-mvp.md)
- Related records: consumes the persistent catalogue delivered by [DEV0078](DEV0078-revise-multigym-catalogue-schema.md) and [DEV0079](DEV0079-serve-persistent-public-catalogue.md), follows the preview review flow from [DEV0075](../frontend/DEV0075-preview-membership-selection.md), reuses actor protection from [DEV0040](DEV0040-protected-access-and-database-context.md), depends on the personal-wallet authority being completed in [DEV0047](../../current/backend/DEV0047-personal-wallet-linking-and-replacement.md) before a real payment handoff, and supplies a later blockchain-primary Devnet-EURC activation/reconciliation ticket plus the included-check-in peer

## Objective and context

Create the persistent off-chain contract for turning a reviewed membership choice into one auditable activation operation and, only after separately verified payment evidence, one active membership period. Before this ticket, DEV0075 stored a browser-local plan/four-gym draft and deliberately stopped at a Coming Soon handoff; no server-owned activation intent, membership ownership or My Membership read model existed.

This ticket establishes the database and server boundary needed by the later Devnet transaction adapter. It snapshots the accepted published plan version and exactly four eligible gyms, makes retries idempotent, prevents overlapping active periods, and exposes only the signed-in member's activation/membership state. It implements the persistence half of [M2](../../../docs/mvp-spec.md#m2--membership-period-and-activation) and the state required by [A02–A04 and A24](../../../docs/mvp-spec.md#12-acceptance-matrix), without claiming that wallet payment or activation is usable yet.

## Scope and non-goals

- In scope: actor-owned activation-operation persistence; server validation of a published plan and exactly four distinct active plan-eligible gyms; immutable snapshots of the selected plan terms, price, membership-window policy and selected gyms; stable idempotency keys; pending/submitted/confirmed/failed operation states; atomic creation of at most one active fixed membership period from a confirmed operation; frozen core-gym rows; member-scoped pending/active/history read models; row-level security, database constraints, migrations and focused tests.
- Out of scope: constructing, signing or sending a Phantom transaction; Devnet EURC recipient/program choice; RPC confirmation or payment verification; exposing a browser endpoint that can self-assert payment confirmation; changing the current Coming Soon checkout handoff; automatic renewal, production billing, cancellation/refunds, transfers, standalone passes, check-ins, reservations, allocation, non-core visits, gym operations or social activity.

## Expected behavior and edge cases

A signed-in member can prepare one activation operation from a currently published Basic or Classic plan and exactly four eligible gyms. The server derives the actor and authoritative catalogue terms; client-supplied labels, price, allowance, ownership, payment status or internal identifiers cannot override them. A stable client operation identifier makes an exact retry return the same operation, while reuse with different inputs fails without creating another intent.

The prepared operation freezes the accepted plan version, EURC amount, fixed-period policy and four gym identifiers so later catalogue edits cannot rewrite the purchase under review. Draft selection can still change before an operation is prepared; the snapshot cannot change afterward. A new operation may supersede an unsubmitted preparation through an explicit failure/supersession path, but submitted or confirmed operations remain auditable.

An operation can move forward only through valid monotonic states. A failed or wallet-cancelled attempt creates no active period. A future trusted Devnet verifier will record submitted and verified-payment evidence through an internal server boundary; only the verified completion path may atomically mark the operation confirmed and create its membership period. Replaying completion returns the same period and cannot duplicate access. There is no browser-callable `mark paid` or `activate` shortcut in this ticket.

One member cannot hold overlapping active MovX membership periods in the MVP. The resulting period has explicit start/end timestamps, no automatic renewal, immutable terms and exactly four frozen core gyms. Member reads return only their own pending operation, active period and bounded history; missing, failed or expired state is represented honestly and never inferred from the browser draft.

## Assumptions, decisions, and dependencies

- Confirmed product rules come from the current specification: Basic is an illustrative 80 EURC with ten included check-ins, Classic is 150 EURC without a numerical period allowance, both use exactly four core gyms and the demo creates one fixed monthly period with no automatic renewal. Catalogue rows remain authoritative rather than duplicating hardcoded product defaults in application code.
- DEV0078/DEV0079 provide the published versioned catalogue and explicit plan eligibility. Preparation must fail closed when any selected plan/gym is missing, inactive, unpublished, duplicated or ineligible.
- DEV0040 supplies the verified actor context. The database trusts neither a browser member identifier nor direct browser database access.
- DEV0047 supplies the optional personal-wallet link needed by the later real payment handoff. DEV0080 may implement and test persistence independently, but it must not advertise real activation while DEV0047's real Phantom rehearsal or the blockchain adapter is incomplete.
- `pending`, `submitted`, `confirmed` and `failed` are the durable external-operation states required by the specification. Wallet cancellation is represented as a failed operation with a bounded reason so it cannot be mistaken for membership ownership.
- Implementation default: one member cannot hold overlapping active MovX periods in the hackathon flow. This keeps access and check-in attribution unambiguous; supporting advance renewal or overlapping products requires a later product decision.
- The implemented demo-period default starts at verified completion and ends at the same instant one calendar month later. Payment recipient/program design, Devnet transaction construction and RPC finality remain owned by the later blockchain-primary peer. This ticket stores explicit timestamps and a bounded payment-evidence shape but does not invent or verify chain evidence.
- The backend-primary scope is one cohesive foundation: schema, actor-scoped commands and member read projection must agree before the transaction adapter or check-in service can safely consume them.

## Implementation plan

1. Add forward-only schema for activation operations, immutable selected-gym snapshots, membership periods and period core gyms, with explicit operation/status checks, four-distinct-gym constraints, one-period-per-confirmed-operation and non-overlap protection for active member periods.
2. Add actor-scoped database functions/repository methods to prepare or safely retry an operation, record bounded submission evidence, atomically complete an already verified operation, fail an operation and read the current member state. Keep completion inaccessible to direct browser roles.
3. Add a server service that validates the current persistent catalogue, derives the actor and authoritative plan/gym snapshot, enforces idempotency and maps only bounded member-safe results. Define the internal handoff the later blockchain verifier must call without implementing that verifier.
4. Add the My Membership server read model for pending operations, the active period, frozen core gyms, Basic remaining-policy inputs or Classic unlimited policy, and bounded history. Do not replace the truthful current frontend state until the payment peer can create real activation.
5. Add pgTAP, database integration, service and boundary coverage for eligibility, snapshot immutability, operation transitions, retries, concurrency, cross-account denial, failed/cancelled operations and duplicate/overlapping period prevention. Run a clean migration replay plus relevant lint, type, format and build checks.

## Acceptance criteria

- [x] AC1: Preparing an operation derives the signed-in actor and current published catalogue data, accepts exactly four distinct active plan-eligible gyms, and rejects stale, duplicate, inactive, unpublished or ineligible input without partial state.
- [x] AC2: The operation immutably snapshots the accepted plan version, EURC amount, period policy and four gyms; subsequent catalogue changes do not mutate that snapshot.
- [x] AC3: A stable operation identifier makes exact retries idempotent, rejects conflicting reuse and prevents concurrent requests from creating duplicate confirmed operations or periods.
- [x] AC4: Pending/submitted/confirmed/failed transitions are monotonic; failure or wallet cancellation creates no membership, while replaying a trusted confirmed completion returns the same single period.
- [x] AC5: A confirmed operation creates one fixed, non-renewing membership period with exactly four frozen core gyms, and database constraints prevent overlapping active periods for the same member.
- [x] AC6: The member read model exposes only the current actor's bounded pending/active/history state; browser roles cannot read private rows directly or self-assert submission, payment confirmation or activation.
- [x] AC7: The current checkout handoff remains honest about unavailable payment, and no Phantom transaction, RPC verification, check-in, allocation or non-core-visit behavior is claimed by this ticket.
- [x] AC8: Clean migration replay, database/service tests, authorization and concurrency coverage, lint, type, format and production-build checks pass with exact evidence recorded.

## Validation plan

Run `npm run db:reset`, `npm run db:runtime`, `npm run db:test`, `npm run test:db`, `npm run db:lint`, focused service/unit tests, `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build` (or the documented equivalent production builder when the sandbox blocks Turbopack) and `git diff --check`.

Use at least two authenticated DEV0046 accounts and concurrent database requests. Cover all plan/gym eligibility failures, exact and conflicting idempotent retries, invalid state transitions, operation failure/cancellation, catalogue changes after preparation, duplicate completion, overlapping-period attempts and cross-account reads. Verify through source/boundary tests that no public route or browser role can provide trusted payment evidence or call completion directly. Browser transaction rehearsal is not applicable because the Devnet adapter is explicitly deferred; the existing Coming Soon handoff needs only regression coverage if touched.

## Implementation record

Implementation started on 2026-09-26 after the user deferred DEV0047's manual Phantom rehearsal and asked to continue with the activation foundation. DEV0080 remains limited to durable backend state and the internal verified-completion boundary; it does not add the later transaction adapter.

### Changes and rationale

Added a private membership-activation state machine and fixed-period entitlement foundation. A verified member can now prepare an idempotent operation against the published catalogue, snapshot exactly four eligible gyms, record bounded submission evidence from their linked Devnet wallet, fail the attempt safely and read only their own pending/active/history state. A server-only trusted completion boundary atomically turns independently verified evidence into one fixed period; no application route invokes it, so the current Coming Soon handoff remains truthful.

The database freezes accepted Basic/Classic terms and gym names, enforces monotonic operation states, prevents one transaction signature from being reused and prevents overlapping member periods. Confirmation starts a period at the database statement timestamp and ends it one calendar month later. Failed or cancelled attempts never create access, exact retries converge, and simultaneous completion calls return the same period.

### Affected files

| File or component                                                                                                                                                           | Change and purpose                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`supabase/migrations/20260926000300_create_membership_activation_foundation.sql`](../../../supabase/migrations/20260926000300_create_membership_activation_foundation.sql) | Creates the four private activation/period tables, immutable snapshot and lifecycle constraints, non-overlap exclusion, forced RLS policies and bounded actor-checked database functions. |
| `src/server/db/schema/membership.ts` (historical path `src/server/db/schema/membership.ts`)                                                                                 | Mirrors the new SQL tables, constraints, indexes and relationships in the server-only Drizzle schema.                                                                                     |
| `src/domain/membership-activation.ts` (historical path `src/domain/membership-activation.ts`)                                                                               | Defines bounded public read shapes plus operation, four-gym, Solana-address, signature, amount and failure-reason validation.                                                             |
| `src/server/db/membership/repository.ts` (historical path `src/server/db/membership/repository.ts`)                                                                         | Wraps the five bounded database functions and rejects inconsistent database results.                                                                                                      |
| `src/server/membership/service.ts` (historical path `src/server/membership/service.ts`)                                                                                     | Applies verified actor context, maps private records into the member read model and exposes the internal verified-completion seam without adding a route.                                 |
| [`supabase/tests/database/membership-activation.test.sql`](../../../supabase/tests/database/membership-activation.test.sql)                                                 | Verifies ownership, forced RLS, grants, policies, bounded functions, non-overlap/uniqueness constraints and an empty ownership seed.                                                      |
| `tests/database/membership-activation.test.ts` (historical path `tests/database/membership-activation.test.ts`)                                                             | Exercises eligibility, idempotency, immutable snapshots, wallet binding, failure, account isolation, transaction reuse, concurrent confirmation and active-period overlap rejection.      |
| `tests/membership-activation.test.ts` (historical path `tests/membership-activation.test.ts`), [`tests/boundaries.test.ts`](../../../tests/boundaries.test.ts)              | Covers transport validation, server-only placement and the absence of any application-route import of trusted completion.                                                                 |
| [`docs/mvp-spec.md`](../../../docs/mvp-spec.md), [`README.md`](../../../README.md), [`supabase/README.md`](../../../supabase/README.md)                                     | Distinguish the completed persistence foundation from unavailable user-facing payment/activation and record the exact fixed-period default and local database contract.                   |

### Decisions and deviations

- 2026-09-26: Keep off-chain activation persistence in DEV0080 and give transaction construction, Devnet-EURC verification and reconciliation to a separate blockchain-primary peer. This prevents an infrastructure ticket from claiming a working payment flow and keeps each commit reviewable.
- 2026-09-26: Start the demo period at verified completion and end it one calendar month later. This implements proposed default P15 without inventing production renewal, billing or cancellation behavior.
- 2026-09-26: Keep all four ownership tables inaccessible through direct runtime or browser-role table grants. Actor-checked security-definer functions are the only runtime path, and trusted completion is additionally kept out of application routes until the blockchain verifier exists.
- 2026-09-26: Store catalogue terms and selected-gym names as immutable snapshots while retaining restrictive foreign keys. Historical purchase meaning survives catalogue edits, and deletion of referenced catalogue rows fails rather than orphaning active audit evidence.

### Contracts, configuration, and operations

The forward-only migration adds `membership_activation_operations`, `membership_activation_operation_gyms`, `membership_periods` and `membership_period_core_gyms`, plus a three-column unique key on catalogue versions for referential integrity. It also requires PostgreSQL's existing `btree_gist` extension for the per-member time-range exclusion constraint. Clean replay is required; reverting this migration would remove all activation and membership ownership data created from it.

The runtime contract is five database functions: prepare, record submission, fail, complete verified activation and read current membership state. Only `app_runtime` may execute them; browser-facing roles have neither schema/table access nor function execution. Completion accepts already verified Devnet evidence and does not itself contact RPC or prove mint, finality or destination policy. No dependency or environment variable was added, and current routes/UI/storage remain compatible and unchanged.

## Validation results

All required backend checks passed on the local Supabase stack. The default Turbopack build was also attempted, but its CSS worker could not bind its internal sandbox port (`Operation not permitted`) even after an elevated retry; the documented Webpack production builder then compiled and generated all routes successfully. No browser rehearsal was required because the ticket deliberately changed no route or interface.

| Criterion | Evidence                                                                                                                                                                                                                                                                                                                               | Result                                  |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| AC1–AC5   | `npm run test:db` exercised 24 database integration tests, including five activation scenarios for invalid selection, stable/conflicting retry, catalogue snapshot immutability, linked-wallet submission, concurrent duplicate completion, failed activation, cross-account isolation, transaction reuse and active-period rejection. | Passed                                  |
| AC5–AC7   | `npm run db:test` passed 140 pgTAP assertions across six files; the activation contract verifies table ownership, forced RLS, grants, bounded functions, policies, exact-four triggers, signature uniqueness, non-overlap and no seeded ownership. `npm run db:lint` reported no schema errors.                                        | Passed                                  |
| AC6–AC7   | `npm test` passed 59 tests, including server-only boundary checks and proof that no application route imports trusted completion. The unchanged UI still ends at Coming Soon; browser testing was not applicable.                                                                                                                      | Passed                                  |
| AC8       | `npm run db:reset` replayed every migration and deterministic seed; `npm run db:runtime` reprovisioned the restricted runtime; `npm run lint`, `npm run typecheck`, `npm run format:check` and `git diff --check` passed.                                                                                                              | Passed                                  |
| AC8       | `npm run build` was blocked by the restricted Turbopack worker-port environment on two attempts; `npx next build --webpack` compiled, type-checked and generated all listed routes successfully.                                                                                                                                       | Passed with documented builder fallback |

## Risks, limitations, and follow-ups

The largest remaining boundary risk is accidentally letting unverified client input become payment evidence. Completion remains internal and requires the later verifier's reviewed evidence contract. The Devnet recipient/program, mint/finality verification, reconciliation and transaction construction are intentionally absent. DEV0047's real Phantom rehearsal also remains required before the full member payment journey can be considered complete.

Required follow-ups are the blockchain-primary Devnet activation/reconciliation ticket and the backend included-check-in/allocation ticket mapped by COR0007.

## Completion and review references

- Completed: 2026-09-26.
- Commit: Not created.
- Review: Scope, implementation and acceptance-criteria self-review completed; no independent review.
- Deployment or release: None.
