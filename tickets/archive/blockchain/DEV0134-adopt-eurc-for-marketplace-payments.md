# Ticket DEV0134: Adopt EURC for marketplace payments

- Status: Completed
- Created: 2026-10-04
- Last updated: 2026-10-05
- Milestone: Marketplace payment-asset compatibility
- Coordination: [COR0010 — Coach-pass and group-funded marketplace MVP](../../current/organisatory/COR0010-group-funded-coach-marketplace-mvp.md)
- Related records: changes the forward contract delivered by completed [DEV0127](DEV0127-implement-coach-client-credit-ledger.md), completed [DEV0132](DEV0132-make-coach-pass-operations-platform-funded.md) and completed [DEV0120](../backend/DEV0120-persist-group-event-catalogue-and-projections.md) without rewriting their history; unblocked completed [DEV0121](DEV0121-implement-group-event-funding-program.md) and current [DEV0122](../../current/blockchain/DEV0122-integrate-devnet-group-event-funding.md), [DEV0123](../../current/frontend/DEV0123-present-group-event-creation-and-funding.md), [DEV0124](../../current/frontend/DEV0124-present-coach-pass-and-group-funded-story.md), [DEV0125](../../current/backend/DEV0125-rehearse-hosted-marketplace-loops.md), [DEV0129](../../current/frontend/DEV0129-present-coach-passes-bookings-and-client-cards.md) and [DEV0130](../../current/blockchain/DEV0130-integrate-devnet-coach-pass-operations.md)

## Objective and context

Adopt Circle's official Solana Devnet EURC mint as the only payment asset for the current coach-pass and group-funded marketplace before either program is integrated on Devnet. The completed local coach-pass contract, generated client, group-event projection boundary and current product documentation use official Devnet test USDC. The user selected EURC on 2026-10-04 while preserving the existing economic boundary: clients and participants supply only the exact published EURC price or contribution, while the MovX platform automatically pays all SOL transaction fees and rent deposits.

This change updates the current product contract without reopening or rewriting completed historical tickets. It implements the asset compatibility prerequisite for the [marketplace state model](../../../docs/mvp-spec.md#marketplace-state-model), [event funding and recovery](../../../docs/mvp-spec.md#event-funding-and-recovery), [asset, wallet and demo integrity](../../../docs/mvp-spec.md#asset-wallet-and-demo-integrity) and Marketplace M5–M7 milestones.

## Scope and non-goals

- In scope: replace the current marketplace's official Devnet USDC mint with Circle's official Solana Devnet EURC mint `HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr`; retain the legacy SPL Token program and six-decimal checked-transfer contract; rename USDC-specific coach-pass instruction, account, event and generated-client fields to EURC; update application constants and current user-facing copy; add an additive database migration that changes the group-event finalized-projection mint constraint without relabelling historical chain evidence; update current specification, ticket dependencies and coordination records; regenerate the Anchor interface description language (IDL) and Codama client; update focused and integration tests.
- Out of scope: Devnet deployment or transaction submission; sponsor, recovery or upgrade key creation/custody; remote procedure call (RPC) credentials; wallet adapters; EURC faucet automation or platform-funded pass value; price conversion; new fees; refunds of purchased EURC; mainnet; changes to credit arithmetic, program-derived account (PDA) seeds, account byte layouts, booking rules, event settlement rules or archived ticket history.

## Expected behavior and edge cases

New coach offers freeze EURC as their payment mint and expose `price_eurc_base_units`. First and later purchases accept only the official Devnet EURC mint, require its six decimals, transfer the exact offer price from the client to the immutable coach recipient and leave platform sponsorship limited to SOL fees and rent. Official Devnet USDC and arbitrary lookalike mints fail the same mint constraint.

Group-event finalized projections accept only the official Devnet EURC mint plus the legacy SPL Token program. The additive database migration must not rewrite an existing USDC projection to appear as EURC evidence. If an upgraded database contains any existing group-event pool projection, migration must fail with an actionable message so the operator can preserve or deliberately clear the obsolete non-production projection before retrying.

Existing local coach-pass accounts created under the USDC contract are incompatible test fixtures and must be recreated. No marketplace program has been deployed under the current contract, so no Devnet account migration is required. Completed multi-gym EURC records remain historical and do not supply current configuration.

## Assumptions, decisions, and dependencies

- Circle's current address registry identifies `HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr` as Solana Devnet EURC. A read-only Devnet lookup on 2026-10-04 confirmed that it is an initialized six-decimal mint owned by the legacy SPL Token program `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`.
- EURC test tokens have no financial value. Client/participant fixture funding may use Circle's public testnet faucet or deliberate fixture transfers, but MovX does not add an in-application faucet in this ticket.
- “Platform-funded” continues to mean automatic server-side payment of SOL fees and rent. It does not add an EURC service/cancellation fee and does not let the platform signer replace client, coach or participant authority.
- The existing generic database amount and mint-address fields remain suitable. The pass program's USDC-specific public field names change before Devnet deployment; their serialized `u64` layout position does not change.
- DEV0130 and DEV0122 own real Devnet token-account preparation, signing, submission, finality and recovery after this compatibility migration completes.

## Implementation plan

1. Change the coach-pass constant, six-decimal checked-transfer references and public price field/event names from Devnet USDC to Devnet EURC without changing account sizes, PDA seeds, credit arithmetic or authority checks.
2. Regenerate the Anchor IDL and Codama Solana Kit client, then update the application helper and unit/Surfpool fixtures to assert the official EURC address and reject USDC.
3. Change the group-event domain/schema mint contract and add an additive, fail-closed database migration for the finalized-projection constraint; update database/domain tests.
4. Reconcile README, environment guidance, current specification, current tickets, coordination work map and existing public copy with EURC while preserving archived records as historical evidence.
5. Run the Solana program autofixer, Rust/IDL/client checks, compiled-SBF Surfpool lifecycle, database migration/tests, repository tests, static checks and production builds. Review the final diff against this ticket before completion.

## Acceptance criteria

- [x] AC1: The coach-pass program and generated client hard-code the official six-decimal Devnet EURC mint and reject official Devnet USDC or any other mint without changing PDA seeds, account sizes, credit arithmetic or required business signers.
- [x] AC2: Offer instruction/account/event interfaces consistently expose EURC base-unit names, and first/later purchases still transfer exactly the published amount from client to coach while the platform alone pays SOL fees/rent.
- [x] AC3: Group-event domain validation and the database finalized-projection constraint accept only official Devnet EURC plus the legacy SPL Token program. The additive migration refuses to relabel existing projections.
- [x] AC4: Current specification, README, environment guidance, current tickets and implemented user-facing copy describe EURC consistently; archived records remain unchanged as history.
- [x] AC5: Focused Rust, generated-client, domain, database and compiled-SBF integration checks pass, along with applicable repository lint, type, format and production-build checks.
- [x] AC6: No real transaction is signed or submitted and no Devnet deployment, key material, RPC credential or mainnet behavior is introduced.

## Validation plan

Run the Solana program autofixer on every modified Anchor Rust module until no critical/high issue requires another pass. Run `NO_DNA=1 cargo fmt --all -- --check`, `NO_DNA=1 cargo clippy -p movx-coach-pass --all-targets -- -D warnings`, `NO_DNA=1 cargo test -p movx-coach-pass`, Anchor IDL generation/parity, Codama generation, the focused generated-client tests and `npm run test:coach-pass:integration`. Confirm the Surfpool lifecycle uses an EURC fixture mint at the official address, preserves exact token deltas and rejects a USDC mint.

Replay the Supabase migrations from clean state, upgrade an existing pre-DEV0134 database, verify the migration rejects a populated legacy projection rather than rewriting it, and run pgTAP plus TypeScript database/domain tests. Finish with `npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`, the applicable Vinext build and `git diff --check`. Browser interaction is limited to copy regression tests because DEV0134 adds no new interaction. Real Devnet signing/deployment is not run under this ticket.

## Implementation record

Completed as one compatibility slice across the program, generated interface, projection boundary and current product contract. The repository now has one current marketplace asset: Circle's official six-decimal Solana Devnet EURC mint. Deployment and RPC integration remain separate under DEV0130/DEV0122.

### Changes and rationale

The coach-pass program now freezes the EURC mint on new offers and names its public price fields `price_eurc_base_units`. Both purchase instructions still perform one exact checked transfer from the client to the immutable coach recipient and keep the platform payer limited to SOL fees and rent. The generated Anchor IDL and Codama client reflect the same address and names, while the compiled-SBF Surfpool lifecycle proves exact token deltas, business signatures, zero-user-SOL operation and explicit rejection of the former official Devnet USDC mint.

The group-event application and database boundary now accept only official Devnet EURC through the legacy SPL Token program. The first migration refuses to proceed when any prior pool projection exists, so historical USDC evidence cannot be relabelled. It then separates address syntax from the exact token constraint. The second migration updates the trusted finalized-projection verifier that was found during database integration testing; without that replacement, the function would reject EURC before the new table constraint could accept it.

README, environment guidance, the product specification, current marketplace tickets and implemented preview copy now describe EURC. Completed and cancelled records retain their original USDC wording as historical evidence.

### Affected files

| File or component                                                                                                                                                                                                                                                                                           | Change and purpose                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`programs/movx-coach-pass/src/`](../../../programs/movx-coach-pass/src/)                                                                                                                                                                                                                                   | Replaced the Devnet USDC constant with official Devnet EURC, renamed offer/instruction/event price fields, and preserved checked-transfer, payer, PDA, authority and credit behavior. |
| [`idl/movx_coach_pass.json`](../../../idl/movx_coach_pass.json) and [`clients/js/src/generated/`](../../../clients/js/src/generated/)                                                                                                                                                                       | Regenerated the public IDL and Solana Kit client so account defaults, codecs and event shapes expose the EURC contract.                                                               |
| [`src/solana/coach-pass.ts`](../../../src/solana/coach-pass.ts), [`tests/coach-pass-client.test.ts`](../../../tests/coach-pass-client.test.ts) and [`tests/coach-pass-surfpool.integration.ts`](../../../tests/coach-pass-surfpool.integration.ts)                                                          | Updated application helpers and source/compiled-program tests; the old official USDC mint is retained only as an explicit rejected fixture.                                           |
| [`src/domain/group-events.ts`](../../../src/domain/group-events.ts) and [`src/server/db/schema/group-events.ts`](../../../src/server/db/schema/group-events.ts)                                                                                                                                             | Changed domain and Drizzle validation to the official EURC mint while preserving generic amount and evidence shapes.                                                                  |
| [`supabase/migrations/20261004000400_adopt_marketplace_eurc.sql`](../../../supabase/migrations/20261004000400_adopt_marketplace_eurc.sql) and [`supabase/migrations/20261004000500_update_group_event_eurc_verifier.sql`](../../../supabase/migrations/20261004000500_update_group_event_eurc_verifier.sql) | Added a fail-closed projection upgrade and aligned the security-definer verifier with EURC without rewriting a completed migration.                                                   |
| [`supabase/tests/database/group-events.test.sql`](../../../supabase/tests/database/group-events.test.sql), [`tests/database/group-events.test.ts`](../../../tests/database/group-events.test.ts) and [`tests/group-events.test.ts`](../../../tests/group-events.test.ts)                                    | Prove accepted EURC evidence, rejected USDC evidence and the authorized projection path.                                                                                              |
| [`README.md`](../../../README.md), [`.env.example`](../../../.env.example), [`docs/mvp-spec.md`](../../../docs/mvp-spec.md), current ticket records and preview components                                                                                                                                  | Reconciled current operational guidance, requirements, dependencies and user-facing test-token language while preserving archived records.                                            |

### Decisions and deviations

- 2026-10-04: The user selected EURC and confirmed that platform sponsorship remains automatic SOL fee/rent payment rather than an EURC fee charged to the user.
- 2026-10-04: Retain one DEV ticket because every affected layer enforces the same payment-asset compatibility boundary and a partial rollout would leave the product internally inconsistent.
- 2026-10-04: Database integration exposed a second enforcement boundary in `app.record_verified_group_event_pool_projection`. A second sequential migration replaces that existing security-definer function while preserving its signature, owner and grants. Keeping both additive migrations makes the discovered correction explicit; the first migration leaves writes fail-closed if an operator stops between them.

### Contracts, configuration, and operations

The official marketplace payment mint changed from Devnet USDC to Devnet EURC. Coach-pass Rust/IDL fields changed from `price_usdc_base_units` to `price_eurc_base_units`, with the generated TypeScript form changing from `priceUsdcBaseUnits` to `priceEurcBaseUnits`. This is a source-interface change before Devnet deployment; the serialized `u64` position, account size, instruction discriminator and PDA seeds are unchanged. Existing local coach-pass fixtures must be recreated.

Database amount and mint columns remain generic. Upgrading a database with any existing group-event pool projection now fails before constraints change; an operator must preserve or deliberately clear that obsolete non-production evidence and retry. No dependency, secret, environment-variable name or mainnet contract changed. `.env.example` changes comments only.

## Validation results

All acceptance criteria passed by 2026-10-05. The local Supabase project was upgraded in place without deleting application data. Separate explicitly named temporary databases were used for the clean replay and populated-projection guard checks and were dropped afterward.

| Criterion     | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Result |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1, AC2      | Read-only `spl-token display HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr --url https://api.devnet.solana.com --output json` confirmed an initialized six-decimal legacy SPL mint. Solana program autofixer reported zero issues for all eight modified Rust modules. `NO_DNA=1 cargo fmt --all -- --check`, `NO_DNA=1 cargo clippy -p movx-coach-pass --all-targets -- -D warnings` and `NO_DNA=1 cargo test -p movx-coach-pass` passed; 20 Rust tests passed. | Passed |
| AC1, AC2      | `NO_DNA=1 anchor idl build -p movx_coach_pass --skip-lint -o idl/movx_coach_pass.json`, `NO_DNA=1 anchor codama generate -l js -p clients idl/movx_coach_pass.json` and IDL parity comparison passed. `npx --no-install tsx --test tests/coach-pass-client.test.ts tests/group-events.test.ts` passed 12 tests.                                                                                                                                                 | Passed |
| AC1, AC2, AC6 | `npm run test:coach-pass:integration` passed the one compiled-SBF Surfpool lifecycle, including exact EURC balances, platform fee/rent debits, zero-lamport user wallets and rejected USDC. Anchor emitted the existing `cdylib`/LTO and Surfpool syscall-table warnings, but program execution and assertions passed. No Devnet transaction or deployment ran.                                                                                                 | Passed |
| AC3           | `NO_DNA=1 npx --no-install supabase migration up --local` applied both migrations to the existing local database. A clean migration replay in the isolated `movx_dev0134_clean_replay` database produced the EURC constraint and verifier; the database was dropped afterward.                                                                                                                                                                                  | Passed |
| AC3           | An isolated pre-migration database containing one legacy projection rejected migration `20261004000400` with the expected `P0001` preservation message and was dropped afterward. `npm run db:lint`, `npm run db:test` and `npm run test:db` passed with no schema errors, 165 pgTAP assertions and 32 TypeScript database tests.                                                                                                                               | Passed |
| AC4, AC5      | `npm test` passed 82 tests. `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`, `npm run build:vinext` and `git diff --check` passed. Vinext retained its existing chunk-size and route-classification warnings.                                                                                                                                                                                                                      | Passed |
| AC4           | `npx --no-install playwright test tests/browser/public-story.spec.ts tests/browser/waitlist.spec.ts tests/browser/profile.spec.ts` passed all 8 desktop/mobile copy-regression checks. Current-file searches found USDC only in migration context, explicit rejection fixtures and clearly labelled historical records.                                                                                                                                         | Passed |

## Risks, limitations, and follow-ups

Circle faucet limits may constrain manual rehearsal balances; DEV0130/DEV0122 must choose fixture prices and funding preparation that fit available test EURC without weakening exact-value verification. This ticket does not prove a real Devnet transaction, deployed-program compatibility, wallet rendering, hosted sponsor custody or remote procedure call reliability. Existing local USDC fixtures are intentionally incompatible and must not be treated as current evidence.

## Completion and review references

- Completed: 2026-10-05.
- Commit: Implementation and this completion record are committed together under `[DEV0134] Adopt EURC for marketplace payments`.
- Review: Final self-review against AC1–AC6 completed; no independent review.
- Deployment or release: None.
