# Ticket DEV0132: Make coach-pass operations platform-funded

- Status: Draft
- Created: 2026-10-04
- Last updated: 2026-10-04
- Milestone: Marketplace M2 platform-funded coach-pass program
- Coordination: [COR0010 — Coach-pass and group-funded marketplace MVP](../organisatory/COR0010-group-funded-coach-marketplace-mvp.md)
- Related records: changes the completed local contracts from [DEV0127](../../archive/blockchain/DEV0127-implement-coach-client-credit-ledger.md) and [DEV0131](../../archive/blockchain/DEV0131-implement-coach-credit-booking-lifecycle.md) without rewriting their history; blocks Devnet pass integration in [DEV0130](DEV0130-integrate-devnet-coach-pass-operations.md); establishes the payer boundary that [DEV0121](DEV0121-implement-group-event-funding-program.md) and [DEV0122](DEV0122-integrate-devnet-group-event-funding.md) must follow for group funding

## Objective and context

Make the MovX platform pay every Solana transaction fee and every rent-exempt account deposit in the MVP so a client, coach or participant never needs test SOL. Preserve the marketplace value and authority boundaries: clients still pay pass prices and seat contributions in test USDC, and the required client, coach or participant wallet still signs each business action.

The completed local coach-pass program currently charges the client or coach for rent when `purchase_first_offer`, `initialize_coach_authority` or `create_offer` creates an account. `reserve_booking_credit` already separates its account payer from its client authority. This ticket updates the local program and generated client to use one consistent platform-payer role before DEV0130 deploys or integrates the contract on Devnet.

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

DEV0127 and DEV0131 remain accurate completed history for the earlier local contract. DEV0132 owns the forward program/client compatibility change. DEV0128 may continue independently because the pair-ledger and reservation account layouts, PDA seeds and finalized evidence fields do not change. DEV0130 must wait for the regenerated instruction interface before implementing Devnet transaction preparation. DEV0121 must adopt the same platform-payer rule when designing EventPool, Contribution, vault and token-account creation.

## Implementation plan

1. Update `initialize_coach_authority`, `create_offer` and `purchase_first_offer` to debit an explicit platform payer for account creation; normalize `reserve_booking_credit` to the same account-role naming without changing PDA seeds or stored layouts.
2. Keep user, recovery and coach signature constraints unchanged, and confirm non-account-creating instructions work with the platform as the outer transaction fee payer.
3. Regenerate the Anchor IDL and Codama Solana Kit client, then update focused helper/codec tests for the new account interface.
4. Extend the embedded Surfpool lifecycle with distinct platform, recovery, coach, client and attacker signers; assert fee/rent balance deltas, exact client test-USDC movement and sponsor-only authorization failures.
5. Run the Solana program autofixer, Rust checks, IDL/client parity, focused and repository tests, static checks and build; record exact evidence before completion.

## Acceptance criteria

- [ ] AC1: `CoachAuthority`, `Offer`, first-purchase `CoachClientCredits` and booking `CreditReservation` creation debit the distinct platform payer for rent rather than the coach or client.
- [ ] AC2: Every tested coach-pass transaction uses the platform as transaction fee payer, and the coach/client paths require no test SOL while retaining their required signatures.
- [ ] AC3: Sponsorship cannot initialize or rotate coach authority, manage an offer, spend client test USDC, reserve/return/consume a credit or otherwise replace the required business signer.
- [ ] AC4: A successful purchase still transfers the exact offer price from the client's official test-USDC token account to the immutable coach recipient; platform balances cover only SOL fees/rent and never the purchase amount.
- [ ] AC5: Existing PDA seeds, account layouts, nonce/replay rules, reservation receipts and credit arithmetic remain compatible; the IDL, generated client and application helpers match the revised instruction accounts.
- [ ] AC6: Rust, generated-client, adversarial compiled-SBF Surfpool, program-autofixer, static and production-build checks pass with explicit platform/user balance evidence.

## Validation plan

Use Rust unit tests for unchanged authority and state invariants, generated-codec tests for the revised instruction accounts and an embedded Surfpool lifecycle with separate in-memory platform, recovery, coach, client and attacker signers. Record lamport balances before and after each account-creation path, prove the platform pays fees/rent, prove coach/client lamports do not decrease, and separately assert the exact client/coach test-USDC delta for purchases. Exercise sponsor-only, missing-authority, replay and invalid-account failures and confirm rollback. Run `NO_DNA=1 cargo fmt --all -- --check`, `NO_DNA=1 cargo clippy -p movx-coach-pass --all-targets -- -D warnings`, `NO_DNA=1 cargo test -p movx-coach-pass`, Anchor build/IDL parity, Codama regeneration, the focused TypeScript tests, `npm run test:coach-pass:integration`, applicable repository tests, typecheck, lint, formatting, production build and the required Solana program autofixer.

Devnet signing, sponsor-policy enforcement and real Explorer evidence are intentionally deferred to DEV0130. Browser checks are not applicable because this ticket changes the local program/client contract without adding interface behavior.

## Implementation record

Planning completed on 2026-10-04. The confirmed platform-payer decision is now reflected in the current product contract, coordination map and affected downstream ticket plans. No program, generated client or runtime code has changed under this ticket; implementation remains pending.

### Changes and rationale

The planning record replaces the earlier optional network-fee sponsorship assumption with mandatory platform payment of every MVP transaction fee and rent deposit. It keeps marketplace value and authority separate: users still supply exact test USDC and required wallet signatures. The planned coach-pass change is isolated here because the completed DEV0127/DEV0131 records must remain historical; future group-event tickets adopt the same product rule within their own implementation boundaries.

### Affected files

| File or component                                                                                                                                 | Change and purpose                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| [MVP specification](../../../docs/mvp-spec.md) and [README](../../../README.md)                                                                   | Record the confirmed platform-payer value, authority and no-user-test-SOL contract.                         |
| [Environment example](../../../.env.example)                                                                                                      | Clarify that the existing server-only sponsor variables represent a dedicated fees-and-rent platform payer. |
| [Ticket index](../../README.md) and [COR0010](../organisatory/COR0010-group-funded-coach-marketplace-mvp.md)                                      | Register DEV0132, its coordination membership, dependency order and corrected affected milestone labels.    |
| [DEV0121](DEV0121-implement-group-event-funding-program.md) and [DEV0122](DEV0122-integrate-devnet-group-event-funding.md)                        | Require the future group-funding program/integration to follow the confirmed payer rule.                    |
| [DEV0130](DEV0130-integrate-devnet-coach-pass-operations.md) and [DEV0129](../frontend/DEV0129-present-coach-passes-bookings-and-client-cards.md) | Make Devnet pass integration depend on DEV0132 and require truthful platform-payer presentation.            |
| Program, generated client, helpers and tests                                                                                                      | Not changed; these remain the pending implementation described above.                                       |

### Decisions and deviations

- 2026-10-04: Adopted platform payment of all Solana fees and rent deposits while retaining user payment of exact test-USDC marketplace value and all existing business-authority signatures.
- 2026-10-04: Kept the sponsor, recovery and deployment/upgrade authorities as separate operational roles so fee payment grants no recovery or program-control capability.

### Contracts, configuration, and operations

Planned contract change: account-creating coach-pass instructions gain or normalize a platform-payer signer in the IDL/generated client. No PDA seed or stored account layout is intended to change. No new environment variable or secret is introduced in this local contract ticket; DEV0130 owns the configured Devnet sponsor and its bounded operating policy.

## Validation results

Planning-document validation passed on 2026-10-04:

- `npx --no-install prettier --check` on the nine changed Markdown records passed; `git diff --check` also passed.
- A repository-local Node link check resolved every relative Markdown link in those nine files with no missing target.
- Identifier/index review found exactly one `# Ticket DEV0132` record, one matching current-index row, reciprocal COR0010 membership and no reference to the superseded draft filename.
- A focused terminology search found no remaining optional-sponsorship, client-pays-pair-rent or old DEV0130 M5 wording in current product/record files.
- Program, generated-client, application and Surfpool checks were not run because implementation has not started; AC1–AC6 remain open.

| Criterion | Evidence                                 | Result  |
| --------- | ---------------------------------------- | ------- |
| AC1–AC6   | No implementation or validation has run. | Not run |

## Risks, limitations, and follow-ups

The platform sponsor becomes an availability dependency and must be protected by allowlisting, transaction reconstruction/validation, per-operation limits, monitoring and rate limits in DEV0130/DEV0122. A malicious or unavailable sponsor can refuse service but must not gain user authority. The program intentionally does not hard-code one sponsor address, so the off-chain adapter and deployment configuration must prove that the configured platform key paid each sponsored transaction.

DEV0130 owns Devnet pass sponsorship, associated token-account readiness, signing order, stale-blockhash recovery and public evidence. DEV0121/DEV0122 own the same payer rule for EventPool and Contribution creation. DEV0129 owns truthful user-facing text that users need test USDC but not test SOL.

## Completion and review references

- Completed: Not completed.
- Commit: Planning contract recorded in `[DEV0128] [DEV0132] [DEV0133] Reconcile booking and platform-payer records`; implementation commit not created.
- Review: Planning self-review only; no independent review.
- Deployment or release: None.
