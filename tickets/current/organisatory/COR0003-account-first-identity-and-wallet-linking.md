# Coordination COR0003: Account-first identity and wallet linking

- Status: In progress
- Created: 2026-09-21
- Last updated: 2026-09-25
- Milestone: Prioritized identity and onboarding
- Converted from: Not applicable — created after DEV0046 already had planning commit history
- Tracked development tickets: completed [DEV0046 — Email OTP registration and application profiles](../../archive/backend/DEV0046-email-otp-registration-and-application-profiles.md) and [DEV0047 — Personal wallet linking and replacement](../backend/DEV0047-personal-wallet-linking-and-replacement.md)
- Related records: follows completed [DEV0038](../../archive/backend/DEV0038-phantom-supabase-web3-authentication.md), [DEV0039](../../archive/backend/DEV0039-prepared-identity-and-wallet-bindings.md) and [DEV0040](../../archive/backend/DEV0040-protected-access-and-database-context.md); completed [DEV0048 — Remove gym membership access](../../archive/backend/DEV0048-remove-gym-membership-access.md) is an independent product cleanup; [DEV0041 — Club wallet authorization](../../archive/backend/DEV0041-club-wallet-authorization.md) later consumes the shared challenge boundary

## Objective and boundaries

Coordinate the accepted change from wallet-first prepared authentication to open email-OTP application accounts with optional personal-wallet ownership. Account login/profile creation and wallet proof/replacement are separate security boundaries and direct peer development tickets.

This coordination record implements no runtime behavior and is never used in a commit subject. DEV0046 owns account/profile behavior and its validation; DEV0047 owns wallet proof/binding lifecycle and its validation.

## Direct development work

| Implementation part                   | Development ticket                                                                                                                            | Owned deliverable                                                                                                                         | Start condition or dependency                                             |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Email account and application profile | [DEV0046 — Email OTP registration and application profiles](../../archive/backend/DEV0046-email-otp-registration-and-application-profiles.md) | Open email-OTP Auth, minimal user profile, ordinary dataset participation, wallet-independent actor context and local reset/cutover.      | Completed 2026-09-21 with automated database/Auth/browser evidence.       |
| Optional personal-wallet ownership    | [DEV0047 — Personal wallet linking and replacement](../backend/DEV0047-personal-wallet-linking-and-replacement.md)                            | Shared one-time challenges, personal link/unlink/replace lifecycle, recent reauthentication and honest wallet state without wallet login. | In progress after DEV0046 delivered the account/session/profile contract. |

Every implementation part is assigned exactly once. No implementation may be performed under COR0003 as a substitute for its direct DEV owner.

## Other relationships

- DEV0038–DEV0040 are completed historical baselines. DEV0046 deliberately replaces their wallet-dependent login/enrollment/actor assumptions while preserving verified sessions, server-derived authority, row-level security and transaction-local isolation.
- DEV0048 removed the separate gym-membership capability and does not belong to this identity coordination. DEV0046 can now start without accidentally creating the removed entitlement.
- Cancelled DEV0041 remains historical COR0002 evidence only. DEV0047 owns the shared challenge schema for personal linking; no current coach-first flow extends it with organization-wallet authority.
- Cancelled [DEV0037](../../archive/blockchain/DEV0037-phantom-embedded-wallet-onboarding.md) is optional embedded-wallet history. Embedded wallet creation is not part of the focused MVP and never becomes the application account authority.

## Delivery sequence and completion conditions

1. Completed prerequisite: DEV0048 removed gym-membership access.
2. Deliver DEV0046 and prove two email accounts can register, reload isolated profiles, recover through email and access protected data without wallets.
3. Deliver DEV0047 and prove one account can link/replace/unlink one personal Phantom wallet through message-only proof without changing account login.
4. Complete COR0003 only when both direct tickets are Completed or explicitly cancelled/replaced, their coordination fields agree, account/wallet collision and recovery integration scenarios pass, and current specification/setup documentation matches the delivered result.

## Progress and integration record

Created on 2026-09-21 after the user accepted email OTP, open registration, minimal profiles, optional one-wallet ownership, email-protected replacement, no automatic merging and local reset rather than production migration. DEV0046 already had planning commit `4250c8e`, so its identity/history was preserved and a separate coordination record plus peer DEV0047 were created instead of converting or retiring it.

DEV0046 completed on 2026-09-21. It replaced wallet-first personal login and the prepared Anna roster with open email OTP, idempotent minimal-profile enrollment and wallet-independent protected actors. Its clean migration replay, 66 database assertions, 9 driver tests, 38 unit/boundary checks, two-account real local Auth rehearsal, configured route checks and configuration-free browser regression passed. DEV0047 is now In progress with its challenge, personal binding, HTTP and wallet-settings implementation present; its final clean migration replay, database suites and local Auth/HTTP rehearsals passed. Real Phantom and signed-in responsive keyboard evidence remain before DEV0047 and COR0003 can complete.

## Validation results

The work map, reciprocal coordination fields and lifecycle links were reviewed after DEV0046 completion. DEV0046's owning record contains its exact application evidence. DEV0047 implementation evidence remains outstanding.

## Risks, limitations, and follow-ups

Changing the Auth subject model affects every protected actor consumer. DEV0046 removed wallet dependence without weakening server-derived profile/dataset checks. DEV0047 must not make a connected address equivalent to ownership or account login. Hosted email delivery and production recovery operations remain later deployment concerns.

## Completion and review references

- Completed: Not completed.
- Direct development tickets: DEV0046 Completed; DEV0047 In progress.
- Commit: Not applicable — coordination-record IDs are not used in commit subjects.
- Review: Requirements reviewed with the user; no independent integration review.
- Deployment or release: None.
