# Ticket DEV0098: Purchase training packages with Devnet USDC

- Status: Draft
- Created: 2026-10-02
- Last updated: 2026-10-03
- Milestone: Coach-first M3 package purchase
- Coordination: [COR0009 — Coach-first private-class booking MVP](../organisatory/COR0009-coach-first-training-package-mvp.md)
- Related records: depends on [DEV0097 — Create coach package offers](DEV0097-create-coach-package-offers.md), linked-wallet authority from [DEV0047](../backend/DEV0047-personal-wallet-linking-and-replacement.md), and reuses reviewed transaction/recovery patterns from superseded DEV0081–DEV0083 without inheriting their EURC pool contract; supplies eligible passes and purchase recovery to [DEV0105 — Book private classes with pass credits](../backend/DEV0105-book-private-classes-with-pass-credits.md)

## Objective and context

Let a client buy an active coach one-session or ten-session offer in one recoverable Devnet transaction: transfer the exact configured test-USDC amount to the offer's immutable coach recipient and create a non-transferable TrainingPass associated with that client. Purchase may begin independently on a coach profile or while DEV0105 holds a selected private-class slot. The current EURC membership-pool activation cannot simply be relabelled because its asset, recipient, database state and product invariants differ.

## Scope and non-goals

- In scope: configured official Devnet test-USDC mint/program/decimals; one-session/ten-session TrainingPass initialization; repeat-purchase-safe pass nonce/PDA; atomic `purchase_offer`; server-constructed authoritative quote; optional restricted-client enforcement; client signature plus bounded fee sponsorship; simulation before approval; exact amount/mint/source/destination checks; idempotent operation/reference and lost-response recovery; indexed pass read model; a bounded purchase-completion contract consumable by DEV0105; offer-detail purchase states and My Passes active/exhausted/expired presentation.
- Out of scope: real/mainnet USDC, cards/SEPA/cash, custody/delegated spending, recurring billing, refunds/chargebacks, transfers/resale, partial payment, gym split, availability/hold/booking persistence or session redemption.

## Expected behavior and edge cases

The client reviews coach, one-session/ten-session pass size, validity, exact test-USDC amount, recipient and network before signing. Purchase succeeds only for an active matching Offer, the configured mint and correct restriction. USDC transfer and TrainingPass creation succeed or fail together. The pass is program-owned state associated with the client wallet; it is not a freely transferable token.

The same client may buy the same offer again through a new authoritative purchase nonce. Retrying or reloading one operation cannot charge twice or create two passes. Wallet rejection, insufficient token balance, missing token account, deactivated offer, wrong client, simulation failure, stale blockhash, RPC timeout and lost sign-and-send response yield bounded recovery and no invented entitlement. A finalized purchase remains a full reusable pass even if a selected booking hold expires or database confirmation fails.

## Assumptions, decisions, and dependencies

Before implementation, this ticket must pin and independently verify the exact official Devnet USDC mint, token program and decimals in server/deployment configuration; DEV0094 confirmed the asset choice but did not supply those identifiers. Stablecoin selection is never browser authority. The offer's frozen payment recipient determines destination. MovX sponsors only the bounded network fee for the hackathon; the client remains the USDC authority. PostgreSQL indexes/reconciles but does not create or decrement the pass independently.

## Implementation plan

1. Freeze TrainingPass layout/status (`Active` or `Exhausted`, with expiry derived at purchase), purchase nonce and operation/reference contract.
2. Implement atomic transfer-and-create instruction plus adversarial local program tests.
3. Adapt server quote, sponsor, simulation, submission, finalized verification and recovery boundaries to the package program and USDC recipient.
4. Add Offer Detail purchase UI, selected-slot purchase context handoff and My Passes read/recovery states without implementing booking persistence.
5. Rehearse exact funded Devnet approval, wallet rejection and lost-response recovery; record transaction and pass addresses.

## Acceptance criteria

- [ ] AC1: A valid client purchase transfers the exact configured test-USDC amount to the frozen coach recipient and creates exactly one matching pass atomically.
- [ ] AC2: Wrong mint/amount/recipient/client, deactivated offer, duplicate operation and unauthorized transaction attempts create neither valid payment attribution nor pass.
- [ ] AC3: Repeat purchase works with a new pass identity; retries/reloads of one operation converge without double charge or duplicate pass.
- [ ] AC4: The client signs only the reviewed bounded transaction, MovX sponsors only the network fee, and secrets remain server-only.
- [ ] AC5: Offer Detail and My Passes show accurate pending/success/failure/recovery states, and a successful purchase exposes one idempotent completion result that DEV0105 can confirm or leave reusable without another charge.

## Validation plan

Cover atomicity and adversarial program cases locally, deterministic quote/sponsor/verifier/recovery tests, database idempotency and client parsing. Run browser approval/rejection/reload checks. Complete a real official Devnet test-USDC rehearsal and verify balances, recipients, pass state and explorer evidence independently.

## Implementation record

Not started.

### Changes and rationale

Pending implementation.

### Affected files

Planned: pass-program purchase instruction, server/client Solana boundaries, pass operation/index schema, protected routes, Offer Detail/My Passes UI and focused tests.

### Decisions and deviations

None yet.

### Contracts, configuration, and operations

New configured mint/program/decimals, package program ID and sponsor policy are expected. Credentialed RPC URLs and sponsor keys remain secret; the public browser RPC must contain no provider credential.

## Validation results

Not run — no implementation.

## Risks, limitations, and follow-ups

Test-USDC faucet/provider availability and Cloudflare RPC limits can block rehearsal. Production custody, compliance, taxes, refunds and coach withdrawals are explicitly unresolved.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: Planning self-review only.
- Deployment or release: None.
