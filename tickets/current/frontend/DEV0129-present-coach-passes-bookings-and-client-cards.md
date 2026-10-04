# Ticket DEV0129: Present coach passes, bookings and client cards

- Status: Draft
- Created: 2026-10-04
- Last updated: 2026-10-04
- Milestone: Marketplace M4 coach-pass experience
- Coordination: [COR0010 — Coach-pass and group-funded marketplace MVP](../organisatory/COR0010-group-funded-coach-marketplace-mvp.md)
- Related records: depends on completed [DEV0127](../../archive/blockchain/DEV0127-implement-coach-client-credit-ledger.md), completed [DEV0131](../../archive/blockchain/DEV0131-implement-coach-credit-booking-lifecycle.md), the platform-payer contract in [DEV0132](../blockchain/DEV0132-make-coach-pass-operations-platform-funded.md), completed [DEV0128](../../archive/backend/DEV0128-persist-credit-backed-private-bookings.md), [DEV0130](../blockchain/DEV0130-integrate-devnet-coach-pass-operations.md) and personal-wallet work in DEV0047

## Objective and context

Provide the client flow for buying one or ten coach credits and booking a calendar session, plus a coach workspace that renders one useful card per paying client from chain balances joined with authorized application data.

## Scope and non-goals

- In scope: offer selection; transaction summary/pending/recovery states; remaining/reserved credit display; booking/cancellation states; coach policy explanation; responsive coach client cards and empty/error/privacy states.
- Out of scope: implementing financial authority in the browser, group-event funding UI, messaging, reviews, hidden pricing or exposing wallet addresses as the primary human identity.

## Expected behavior and edge cases

The interface clearly distinguishes email account, linked wallet, Devnet/test USDC and coach-specific credits. Every approval explains that MovX pays SOL fees/rent while the user supplies the exact test-USDC value and required wallet signature, so no user test SOL is required. Coach cards show the authorized client's display identity, available/reserved credits and relevant bookings while using the wallet/PDA only as a verifiable reference. Rejection, stale balance, reload and provider failure remain recoverable and never invent a purchase or booking.

## Assumptions, decisions, and dependencies

The browser consumes server/chain contracts owned by DEV0127, DEV0131, DEV0128 and DEV0130. It does not scan unrestricted chain history or decide cancellation eligibility locally.

## Implementation plan

1. Add accessible offer and payment/recovery states.
2. Connect pass balance to the existing public coach calendar and booking actions.
3. Add early/late cancellation explanations and coach decisions.
4. Add coach client-card list/detail states.
5. Validate responsive, keyboard, error and two-account flows.

## Acceptance criteria

- [ ] AC1: A client can understand and initiate one/ten-credit purchase with exact Devnet terms, including platform-funded SOL fees/rent and user-funded test-USDC value.
- [ ] AC2: A client can book and cancel with truthful credit/cutoff outcomes.
- [ ] AC3: A coach can view authorized client cards with accurate balances and booking state.
- [ ] AC4: Mobile, desktop, keyboard, rejection, pending, empty and reload states pass.

## Validation plan

Component/unit tests plus real responsive browser rehearsal with client and coach accounts after dependencies complete.

## Implementation record

Not started.

## Validation results

Not run — dependencies incomplete.

## Risks, limitations, and follow-ups

Wallet addresses are public but should not replace human labels. The interface must not claim mainnet value, attendance proof or production consumer protection.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: Planning self-review only.
- Deployment or release: None.
