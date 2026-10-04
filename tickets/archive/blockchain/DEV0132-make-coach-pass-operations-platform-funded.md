# Ticket DEV0132: Make coach-pass operations platform-funded

- Status: Completed
- Created: 2026-10-04
- Last updated: 2026-10-04
- Milestone: Marketplace M2 platform-funded coach-pass program
- Coordination: [COR0010 — Coach-pass and group-funded marketplace MVP](../../current/organisatory/COR0010-group-funded-coach-marketplace-mvp.md)
- Related records: changes the completed local contracts from [DEV0127](DEV0127-implement-coach-client-credit-ledger.md) and [DEV0131](DEV0131-implement-coach-credit-booking-lifecycle.md) without rewriting their history; supplies the completed payer interface to Devnet pass integration in [DEV0130](../../current/blockchain/DEV0130-integrate-devnet-coach-pass-operations.md); establishes the payer boundary that [DEV0121](../../current/blockchain/DEV0121-implement-group-event-funding-program.md) and [DEV0122](../../current/blockchain/DEV0122-integrate-devnet-group-event-funding.md) must follow for group funding

## Objective and context

Make the MovX platform pay every Solana transaction fee and every rent-exempt account deposit in the MVP so a client, coach or participant never needs test SOL. Preserve the marketplace value and authority boundaries: clients still pay pass prices and seat contributions in test USDC, and the required client, coach or participant wallet still signs each business action.

Before this ticket, the completed local coach-pass program charged the client or coach for rent when `purchase_first_offer`, `initialize_coach_authority` or `create_offer` created an account. `reserve_booking_credit` already separated its account payer from its client authority. This ticket updates the local program and generated client to use one consistent platform-payer role before DEV0130 deploys or integrates the contract on Devnet.

Relevant product requirements are the [confirmed decision register](../../../docs/mvp-spec.md#2-confirmed-target-and-decisions), [application and infrastructure boundaries](../../../docs/mvp-spec.md#6-application-and-infrastructure-boundaries), [recovery contract](../../../docs/mvp-spec.md#7-pass-purchase-booking-and-event-funding-recovery) and M2/M6 delivery milestones.

## Scope and non-goals

- In scope: add a distinct writable platform-payer signer to every coach-pass instruction that creates a program account; use it for `CoachAuthority`, `Offer`, `CoachClientCredits` and `CreditReservation` rent; preserve separate client/coach/recovery authorities; regenerate the Anchor interface description language (IDL) and Codama Solana Kit client; update application helpers where the account interface changes; prove locally that the platform payer covers fees/rent while user token value and authority remain unchanged; document the shared payer rule consumed by later pass and group-event integration.
- Out of scope: Devnet deployment, credentialed remote procedure call (RPC) integration, sponsor secret configuration, rate limiting, browser transaction presentation, associated token-account creation, Kora or another relayer, mainnet, subsidizing the test-USDC purchase/contribution amount, changing account layouts or program-derived account (PDA) seeds, and implementing the future EventPool program owned by DEV0121.

## Expected behavior and edge cases

The configured platform payer is the outer transaction fee payer for every coach-pass mutation and funds every new program account. A coach can initialize authority and create an offer without test SOL; a client can create the first pair ledger and reserve a booking without test SOL. The client still authorizes the exact test-USDC pass payment, the client still signs credit reservation and eligible early return, and the current coach still signs offer management, coach-authorized return and post-start consumption.

Platform sponsorship is not business authority. A sponsor-only transaction cannot initialize a coach, create or deactivate an offer, transfer a client's test USDC, reserve a client's credit, return a reservation, consume a session or rotate coach authority. Missing user authority, an invalid account relationship, user rejection or sponsor refusal leaves token and program state unchanged. Existing deterministic nonce and receipt recovery rules remain unchanged.

Instructions that create no account do not need a redundant payer account in their instruction data; their transaction message names the platform as fee payer. Account-creating instructions expose an explicit platform-payer signer because Anchor must debit that account for rent. The program does not hard-code one sponsor address, which permits operational key rotation; the server-side adapter must supply the configured platform payer and apply the bounded sponsorship policy.

## Assumptions, decisions, and dependencies

The user confirmed on 2026-10-04 that the platform, not clients, coaches or participants, pays all Solana transaction fees and rent-exempt account deposits. “Platform-funded” does not mean MovX pays the offer price or event contribution: those exact test-USDC amounts continue to come from the authorizing user wallet.

The fee-sponsor key is operationally distinct from the recovery authority and deployment/upgrade authority. Paying a transaction may make the sponsor a transaction signer, but no program instruction may accept that signature in place of its client, coach, participant or recovery signer. The implementation uses role-specific payer and identity signers rather than a client configuration that silently treats the payer as business identity.

DEV0127 and DEV0131 remain accurate completed history for the earlier local contract. DEV0132 owns the forward program/client compatibility change. DEV0128 continued independently because the pair-ledger and reservation account layouts, PDA seeds and finalized evidence fields did not change. DEV0130 may now consume the regenerated instruction interface for Devnet transaction preparation. DEV0121 must adopt the same platform-payer rule when designing EventPool, Contribution, vault and token-account creation.

## Implementation plan

1. Update `initialize_coach_authority`, `create_offer` and `purchase_first_offer` to debit an explicit platform payer for account creation; normalize `reserve_booking_credit` to the same account-role naming without changing PDA seeds or stored layouts.
2. Keep user, recovery and coach signature constraints unchanged, and confirm non-account-creating instructions work with the platform as the outer transaction fee payer.
3. Regenerate the Anchor IDL and Codama Solana Kit client, then update focused helper/codec tests for the new account interface.
4. Extend the embedded Surfpool lifecycle with distinct platform, recovery, coach, client and attacker signers; assert fee/rent balance deltas, exact client test-USDC movement and sponsor-only authorization failures.
5. Run the Solana program autofixer, Rust checks, IDL/client parity, focused and repository tests, static checks and build; record exact evidence before completion.

## Acceptance criteria

- [x] AC1: `CoachAuthority`, `Offer`, first-purchase `CoachClientCredits` and booking `CreditReservation` creation debit the distinct platform payer for rent rather than the coach or client.
- [x] AC2: Every tested coach-pass transaction uses the platform as transaction fee payer, and the coach/client paths require no test SOL while retaining their required signatures.
- [x] AC3: Sponsorship cannot initialize or rotate coach authority, manage an offer, spend client test USDC, reserve/return/consume a credit or otherwise replace the required business signer.
- [x] AC4: A successful purchase still transfers the exact offer price from the client's official test-USDC token account to the immutable coach recipient; platform balances cover only SOL fees/rent and never the purchase amount.
- [x] AC5: Existing PDA seeds, account layouts, nonce/replay rules, reservation receipts and credit arithmetic remain compatible; the IDL, generated client and application helpers match the revised instruction accounts.
- [x] AC6: Rust, generated-client, adversarial compiled-SBF Surfpool, program-autofixer, static and production-build checks pass with explicit platform/user balance evidence.

## Validation plan

Use Rust unit tests for unchanged authority and state invariants, generated-codec tests for the revised instruction accounts and an embedded Surfpool lifecycle with separate in-memory platform, recovery, coach, client and attacker signers. Record lamport balances before and after each account-creation path, prove the platform pays fees/rent, prove coach/client lamports do not decrease, and separately assert the exact client/coach test-USDC delta for purchases. Exercise sponsor-only, missing-authority, replay and invalid-account failures and confirm rollback. Run `NO_DNA=1 cargo fmt --all -- --check`, `NO_DNA=1 cargo clippy -p movx-coach-pass --all-targets -- -D warnings`, `NO_DNA=1 cargo test -p movx-coach-pass`, Anchor build/IDL parity, Codama regeneration, the focused TypeScript tests, `npm run test:coach-pass:integration`, applicable repository tests, typecheck, lint, formatting, production build and the required Solana program autofixer.

Devnet signing, sponsor-policy enforcement and real Explorer evidence are intentionally deferred to DEV0130. Browser checks are not applicable because this ticket changes the local program/client contract without adding interface behavior.

## Implementation record

Completed on 2026-10-04. Every account-creating coach-pass instruction now accepts a writable `platform_payer` signer and debits that account for rent while the coach/client/recovery signers retain their existing business-authority roles. The checked-in IDL and generated Solana Kit client expose the revised account contract, and the compiled Surfpool lifecycle proves the platform pays fees/rent while user wallets remain at zero lamports.

### Changes and rationale

`initialize_coach_authority`, `create_offer` and `purchase_first_offer` previously made the coach or client writable and charged that user for the new program account. They now keep the business signer read-only and charge an explicit writable `platform_payer`. `reserve_booking_credit` already separated its rent payer, so its `fee_payer` account was renamed to `platform_payer` for one consistent public interface.

The platform address is not hard-coded in the program. This permits operational key rotation while preserving a narrow on-chain boundary: paying does not satisfy any coach, client or recovery-authority constraint. Instructions that create no program account retain their existing account list and use the platform only as the outer transaction fee payer.

### Affected files

| File or component                                                                                                                                                                                                                                                                                                                                                                                                                     | Change and purpose                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`initialize_coach_authority.rs`](../../../programs/movx-coach-pass/src/instructions/initialize_coach_authority.rs), [`create_offer.rs`](../../../programs/movx-coach-pass/src/instructions/create_offer.rs), [`purchase_first_offer.rs`](../../../programs/movx-coach-pass/src/instructions/purchase_first_offer.rs) and [`reserve_booking_credit.rs`](../../../programs/movx-coach-pass/src/instructions/reserve_booking_credit.rs) | Separate program-account rent from business authority through the explicit `platform_payer` signer without changing handlers, state layouts or PDA derivations.                     |
| [`movx_coach_pass.json`](../../../idl/movx_coach_pass.json) and [`clients/js/src/generated/instructions/`](../../../clients/js/src/generated/instructions/)                                                                                                                                                                                                                                                                           | Publish the revised account lists, signer roles and `platformPayer` input through reproducibly generated interfaces.                                                                |
| [`coach-pass-client.test.ts`](../../../tests/coach-pass-client.test.ts)                                                                                                                                                                                                                                                                                                                                                               | Verify generated account ordering and that the platform payer is a distinct writable signer while coach/client authorities are read-only signers.                                   |
| [`coach-pass-surfpool.integration.ts`](../../../tests/coach-pass-surfpool.integration.ts)                                                                                                                                                                                                                                                                                                                                             | Run the compiled program with unfunded user wallets; assert platform fee/rent debits, exact test-USDC transfer, unchanged state after failures and sponsor/business-role isolation. |
| [README](../../../README.md), [ticket index](../../README.md), [COR0010](../../current/organisatory/COR0010-group-funded-coach-marketplace-mvp.md) and downstream tickets                                                                                                                                                                                                                                                             | Mark the local payer contract complete and point Devnet, group-funding and interface work at the archived contract.                                                                 |

### Decisions and deviations

- 2026-10-04: Adopted platform payment of all Solana fees and rent deposits while retaining user payment of exact test-USDC marketplace value and all existing business-authority signatures.
- 2026-10-04: Kept the sponsor, recovery and deployment/upgrade authorities as separate operational roles so fee payment grants no recovery or program-control capability.
- 2026-10-04: Did not hard-code or store the sponsor address on chain. The local lifecycle uses Surfpool's distinct pre-funded payer, while DEV0130 remains responsible for supplying and policy-checking the configured Devnet sponsor.
- 2026-10-04: Kept payer accounts off instructions that create no account; the transaction message's fee payer is sufficient and avoids granting or implying instruction-level authority.

### Contracts, configuration, and operations

The IDL/generated-client account contract changed as follows: `initializeCoachAuthority` adds `platformPayer` after `recoveryAuthority`; `createOffer` adds it after `coachWallet`; `purchaseFirstOffer` adds it after `clientWallet`; and `reserveBookingCredit` renames the account at index one from `feePayer` to `platformPayer`. Callers of those builders must supply the additional or renamed signer. The coach/client signer is now read-only where it no longer pays rent.

Instruction discriminators and data payloads, program IDs, PDA seeds, stored account layouts, purchase nonces, credit arithmetic and reservation receipts did not change. No dependency, environment variable, migration, secret or setup step changed. DEV0130 must deploy the regenerated interface before any Devnet integration and must keep platform-payer, recovery and upgrade keys separate.

## Validation results

All required local checks passed on 2026-10-04:

- Solana program autofixer on all four modified Anchor instruction modules: no issues or suggestions; `require_another_tool_call_after_fixing` was `false`.
- `NO_DNA=1 anchor idl build -p movx_coach_pass --skip-lint -o idl/movx_coach_pass.json` and `NO_DNA=1 anchor codama generate -l js -p clients idl/movx_coach_pass.json`: passed. `cmp -s target/idl/movx_coach_pass.json idl/movx_coach_pass.json` confirmed byte-for-byte IDL parity.
- `NO_DNA=1 cargo fmt --all -- --check`, `NO_DNA=1 cargo clippy -p movx-coach-pass --all-targets -- -D warnings` and `NO_DNA=1 cargo test -p movx-coach-pass`: passed; 20 Rust tests passed.
- `npx --no-install tsx --test tests/coach-pass-client.test.ts`: passed; 9 generated-client, PDA, codec and projection tests passed.
- `npm run test:coach-pass:integration`: passed against the rebuilt SBF program. All coach, recovery, client and attacker wallets stayed at `0` lamports. The platform debits versus created-account rent were `2,297,880 / 2,282,880` for `CoachAuthority`, `2,515,600 / 2,505,600` for `Offer`, `2,292,880 / 2,282,880` for `CoachClientCredits`, and `2,292,880 / 2,282,880` for each of three `CreditReservation` accounts. The difference is the platform-paid transaction fee.
- The same Surfpool lifecycle passed exact two-step test-USDC assertions: the client moved from `160,000,000` to `80,000,000` to `0` base units while the immutable coach recipient moved from `0` to `80,000,000` to `160,000,000`. Missing user signatures and sponsor attempts to rotate authority, create/deactivate offers, spend client tokens, reserve, return or consume all failed without partial program/token state changes.
- `npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build` and `git diff --check`: passed; the repository suite reported 79 passing tests and the Next.js production build completed all routes.
- Browser, database and Devnet checks are not applicable to this local program/client compatibility ticket. DEV0130 owns deployment, real RPC/sponsor policy and Explorer evidence.

| Criterion | Evidence                                                                                                                | Result |
| --------- | ----------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1–AC2   | Zero-lamport user wallets plus six recorded platform rent/fee debits in the compiled Surfpool lifecycle.                | Passed |
| AC3       | Missing-authority and sponsor substitution failures for initialization, offers, purchase, booking and recovery actions. | Passed |
| AC4       | Exact `80,000,000`-base-unit client-to-coach token deltas on both purchases; no platform-funded token value.            | Passed |
| AC5       | Stable PDA/codec/state tests, unchanged layouts/data discriminators and reproducible IDL/generated client.              | Passed |
| AC6       | Autofixer, Rust, generated-client, compiled-SBF, static, repository and production-build checks all passed.             | Passed |

## Risks, limitations, and follow-ups

The platform sponsor is an availability dependency and must be protected by allowlisting, transaction reconstruction/validation, per-operation limits, monitoring and rate limits in DEV0130/DEV0122. A malicious or unavailable sponsor can refuse service but cannot gain user authority. Because the program intentionally does not hard-code one sponsor address, the off-chain adapter and deployment configuration must prove that the configured platform key paid each sponsored transaction.

DEV0130 owns Devnet pass sponsorship, associated token-account readiness, signing order, stale-blockhash recovery and public evidence. DEV0121/DEV0122 own the same payer rule for EventPool and Contribution creation. DEV0129 owns truthful user-facing text that users need test USDC but not test SOL.

## Completion and review references

- Completed: 2026-10-04.
- Commit: Planning contract recorded in `9177d37` (`[DEV0128] [DEV0132] [DEV0133] Reconcile booking and platform-payer records`); implementation and this completion record are committed together under `[DEV0132] Make coach-pass operations platform-funded`.
- Review: Implementation self-review against AC1–AC6 completed; no independent review.
- Deployment or release: None.
