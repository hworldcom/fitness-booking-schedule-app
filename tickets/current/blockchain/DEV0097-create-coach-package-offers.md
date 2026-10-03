# Ticket DEV0097: Create coach package offers on Devnet

- Status: Draft
- Created: 2026-10-02
- Last updated: 2026-10-03
- Milestone: Coach-first M2 one-session/ten-session offers
- Coordination: [COR0009 — Coach-first private-class booking MVP](../organisatory/COR0009-coach-first-training-package-mvp.md)
- Related records: depends on [DEV0094](../../archive/organisatory/DEV0094-adopt-coach-first-training-package-mvp.md), applicable coach identity from [DEV0096](../backend/DEV0096-persist-coach-profiles-and-discovery.md) and linked-wallet authority from [DEV0047](../backend/DEV0047-personal-wallet-linking-and-replacement.md); supplies authoritative one-session/ten-session terms to DEV0098 and booking eligibility to DEV0105

## Objective and context

Create the smallest Solana program boundary in which a coach publishes or deactivates a one-session or ten-session private-training offer with immutable commercial terms. The current membership-card program is a non-authoritative public projection and must not be repurposed as the pass authority without an explicit replacement review.

## Scope and non-goals

- In scope: a dedicated reviewed pass program; coach-scoped Offer PDA derivation with repeat-safe nonce; coach authority; immutable Devnet test-USDC price, session count restricted to exactly one or ten, validity, optional restricted-client wallet and immutable payment recipient; active/deactivated state; `create_offer` and `deactivate_offer`; client codecs; coach create/deactivate interface; offchain title/description/service/image metadata bound to offer address; local validator/Surfpool and Devnet tests.
- Out of scope: purchase/TrainingPass creation, redemption, offer editing in place, payment splitting, refunds, availability or booking state, transfers, subscriptions, wallet-visible NFTs or production deployment.

## Expected behavior and edge cases

Only the linked and connected coach authority can create or deactivate its offer. Session count must be exactly `1` or `10`, price must be positive, validity must fit reviewed bounds, the configured mint/network contract must be explicit, and a restricted client/payment recipient must be valid addresses. Deactivation blocks future purchases but does not alter already purchased passes or confirmed bookings.

Commercial fields cannot be edited after creation; a coach replaces an offer by deactivating it and creating another nonce. Offchain metadata cannot change price, session count, validity, recipient, restriction or active state. A failed or rejected transaction creates no published active offer.

## Assumptions, decisions, and dependencies

Public UI says **coach**. Onchain state stores wallet authorities. `Offer` is a program-owned account whose fields are authoritative; the payment recipient is frozen into the offer so later application-profile or wallet changes cannot redirect it. Before implementation, this ticket must adopt how recipient control is proved and how unlink/replacement interacts with active offer and redemption authority; a merely valid arbitrary recipient and a replacement wallet that strands active passes are not acceptable silent defaults. The initial program should be separate from `movx-membership-card` unless implementation review proves a cleaner safe boundary and updates this ticket first.

## Implementation plan

1. Freeze account layout, PDA seeds, instruction data, recipient-control rule, wallet-replacement behavior, error surface, size/rent and upgrade authority.
2. Implement and test create/deactivate authorization and field invariants locally.
3. Add typed application clients plus server/read/index boundary for authoritative offers and approved metadata.
4. Add accessible coach offer controls with simulation, wallet approval, pending/success/error and reload recovery.
5. Deploy/rehearse on Devnet only after local tests and record addresses/signatures without secrets.

## Acceptance criteria

- [ ] AC1: An authorized coach creates one one-session or ten-session offer whose authoritative price, sessions, validity, restriction and payment recipient match the reviewed input.
- [ ] AC2: Unauthorized, malformed, unsupported-session-count, duplicate-nonce and invalid-term attempts fail without an active offer.
- [ ] AC3: Deactivation is coach-only, prevents later purchase eligibility and does not mutate existing passes.
- [ ] AC4: Offchain metadata cannot override chain terms, and reload recovers submitted offer state without duplicate creation.
- [ ] AC5: Program, client, local lifecycle, Devnet rehearsal, static and build validation pass with recorded fee/rent behavior.

## Validation plan

Use Rust unit/integration tests plus Surfpool/local lifecycle coverage for valid creation, authorization failures, bounds, nonce collision and deactivation. Test application codecs and metadata joins. Rehearse one create/deactivate flow with a funded Devnet coach wallet and record explorer evidence. Run relevant lint/clippy/type/build checks.

## Implementation record

Not started.

### Changes and rationale

Pending implementation.

### Affected files

Planned: a dedicated package program and workspace configuration, generated/typed clients, offer read/index services, coach offer interface and focused tests.

### Decisions and deviations

None yet.

### Contracts, configuration, and operations

New program/account/instruction and program-ID configuration are planned. No keypair or seed phrase may enter the repository. Upgrade-authority and deployment-key custody must be documented before Devnet deployment.

## Validation results

Not run — no implementation.

## Risks, limitations, and follow-ups

Raw manual Metaplex-style instruction encoding in the existing card experiment is not a substitute for a reviewed package contract. Account sizing, program rent and upgrade authority need explicit evidence before deployment.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: Planning self-review only.
- Deployment or release: None.
