# Ticket DEV0129: Present coach passes, bookings and client cards

- Status: In progress
- Created: 2026-10-04
- Last updated: 2026-10-05
- Milestone: Marketplace M4 coach-pass experience
- Coordination: [COR0010 — Coach-pass and group-funded marketplace MVP](../organisatory/COR0010-group-funded-coach-marketplace-mvp.md)
- Related records: depends on completed [DEV0127](../../archive/blockchain/DEV0127-implement-coach-client-credit-ledger.md), completed [DEV0131](../../archive/blockchain/DEV0131-implement-coach-credit-booking-lifecycle.md), completed platform-payer contract [DEV0132](../../archive/blockchain/DEV0132-make-coach-pass-operations-platform-funded.md), completed [DEV0128](../../archive/backend/DEV0128-persist-credit-backed-private-bookings.md), completed EURC contract [DEV0134](../../archive/blockchain/DEV0134-adopt-eurc-for-marketplace-payments.md), [DEV0130](../blockchain/DEV0130-integrate-devnet-coach-pass-operations.md) and personal-wallet work in DEV0047

## Objective and context

Provide the client flow for buying one or ten coach credits and booking a calendar session, plus a coach workspace that renders one useful card per paying client from chain balances joined with authorized application data.

## Scope and non-goals

- In scope: offer selection; transaction summary/pending/recovery states; remaining/reserved credit display; booking/cancellation states; coach policy explanation; responsive coach client cards and empty/error/privacy states.
- Out of scope: implementing financial authority in the browser, group-event funding UI, messaging, reviews, hidden pricing or exposing wallet addresses as the primary human identity.

## Expected behavior and edge cases

The interface clearly distinguishes email account, linked wallet, Devnet/test EURC and coach-specific credits. Every approval explains that MovX pays SOL fees/rent while the user supplies the exact test-EURC value and required wallet signature, so no user test SOL is required. Coach cards show the authorized client's display identity, available/reserved credits and relevant bookings while using the wallet/PDA only as a verifiable reference. Rejection, stale balance, reload and provider failure remain recoverable and never invent a purchase or booking.

## Assumptions, decisions, and dependencies

The browser consumes server/chain contracts owned by DEV0127, DEV0131, DEV0128 and DEV0130. It does not scan unrestricted chain history or decide cancellation eligibility locally. DEV0130's exact preparation/signing/recovery interface is committed and stable enough for local interface work; its remaining public Devnet rehearsal does not block implementing honest unavailable and pending states.

Public offer discovery is server-owned rather than a browser-supplied or coach-specific configuration value. A bounded finalized `getProgramAccounts` query filters by the reviewed program, account allocation, discriminator and coach identity, then validates every decoded authority and offer before returning eligible public one/ten-credit terms. The browser still sends the selected addresses back through DEV0130's strict preparation boundary, which re-reads and validates them before simulation. This adds no database migration and does not overlap DEV0122's group-event operation files.

## Implementation plan

1. Add the bounded server offer catalogue plus accessible offer and payment/recovery states.
2. Expose actor-scoped client credit projections and connect them to the existing public coach calendar and booking actions.
3. Add client booking history, early/late cancellation explanations and coach decisions using DEV0128's existing state transitions.
4. Add coach client-card list/detail states without exposing unrelated contact or relationship data.
5. Validate pure presentation/state logic, server/client boundaries, responsive/keyboard/error states and the available local two-account flow.

## Acceptance criteria

- [ ] AC1: A client can understand and initiate one/ten-credit purchase with exact Devnet terms, including platform-funded SOL fees/rent and user-funded test-EURC value.
- [ ] AC2: A client can book and cancel with truthful credit/cutoff outcomes.
- [ ] AC3: A coach can view authorized client cards with accurate balances and booking state.
- [ ] AC4: Mobile, desktop, keyboard, rejection, pending, empty and reload states pass.

## Validation plan

Component/unit tests plus real responsive browser rehearsal with client and coach accounts after dependencies complete.

## Implementation record

Implementation started on 2026-10-05 after DEV0130's adapter and deployment-evidence commits stabilized the browser/server operation contract. Work proceeded in parallel with DEV0122 only across disjoint coach-pass/booking interface files; the already-dirty shared ticket index must be staged by hunk when DEV0129 is committed.

### What and where

- [The public coach route](../../../src/app/coaches/[slug]/page.tsx), [coach profile presentation](../../../src/features/coaches/coach-discovery.tsx) and [marketplace client](../../../src/features/coaches/coach-marketplace.tsx) now join a visible coach to eligible public Devnet offers, the signed-in client's own credit projection/bookings and database-backed open slots. Missing offers, balances or providers remain explicit empty/unavailable states rather than fixture prices or addresses.
- [The bounded offer catalogue](../../../src/server/coaches/pass-catalogue.ts), [read-only chain configuration](../../../src/server/solana/coach-pass-read-config.ts) and [public coach repository](../../../src/server/db/coaches/repository.ts) filter program accounts by fixed allocation, discriminator and coach identity, then verify owners, decoded data, Program Derived Address (PDA) seeds/bumps, current wallet epoch, official Devnet EURC mint, recipient, active status, expiry and unrestricted one/ten-credit terms before exposing them. This read path never loads sponsor key material.
- [Marketplace actions](../../../src/app/coach-marketplace-actions.ts), [the transaction review](../../../src/features/coaches/coach-pass-operation-review.tsx) and [marketplace styles](../../../src/app/coach-discovery.css) connect existing DEV0128 booking/cancellation transitions to DEV0130 prepare/simulate/sign/submit/recover endpoints. The wallet opens only after an exact review; reload stores only the durable operation ID/stage in session storage, while the server journal remains authoritative. Submitted ambiguity tells the actor to recover rather than retry.
- [Client credit queries](../../../src/server/db/coaches/booking-repository.ts), [the booking service](../../../src/server/coaches/booking-service.ts) and [shared marketplace presentation types](../../../src/domain/coach-marketplace.ts) expose only the current actor's coach-specific balance and relevant bookings. Exact EURC formatting uses integer strings rather than floating-point arithmetic.
- [The coach route](../../../src/app/coach/page.tsx), [workspace panel](../../../src/features/coaches/coach-availability-panel.tsx), [client-card interface](../../../src/features/coaches/coach-client-cards.tsx) and [workspace styles](../../../src/app/coach-workspace.css) show the authorized client's display name first, available/reserved/total credits, shortened verifiable wallet/ledger references and only that coach's bookings. Coaches can approve/deny late cancellation requests and prepare post-start credit consumption; unavailable and zero-client states disclose no unrelated identity data.
- [Marketplace unit tests](../../../tests/coach-marketplace.test.ts), [catalogue tests](../../../tests/server/coach-pass-catalogue.test.ts) and [booking database tests](../../../tests/database/coach-bookings.test.ts) cover exact amount/cutoff copy, strict offer eligibility/seed validation, sponsor-free reads and actor-isolated client credit projections.

### Decisions, contracts and compatibility

- Public discovery uses finalized read-only RPC data, but all mutations still re-read confirmed state and pass through DEV0130's strict simulation and sponsorship boundary. A public offer response is discovery data, not transaction authority.
- No schema or migration changed. `currentPrivateBookingWorkspace()` adds `clientCredits`; this is an internal server projection consumed by the new interface. The new read-only catalogue uses the existing `SOLANA_CLUSTER`, `SOLANA_RPC_URL` and `NEXT_PUBLIC_SOLANA_COACH_PASS_PROGRAM_ID` values and deliberately does not require `SOLANA_FEE_SPONSOR_KEYPAIR_BASE64`.
- The UI labels Devnet and test EURC, names the exact user-funded value, and states that MovX pays SOL fees/rent. Wallet and PDA values remain secondary verification references rather than human identity.
- No group-event file owned by DEV0122 was changed for this ticket.

## Validation results

- Passed `npm test`: 116 root unit/source tests and 26 React-server tests, including the new marketplace and catalogue cases.
- Passed `npm run test:db`: 35 PostgreSQL integration tests, including actor-isolated client credit projections and existing booking/client-card lifecycle coverage.
- Passed `npm run typecheck`, `npm run lint`, `npm run build` and `git diff --check` against the combined working tree. A targeted Prettier check passed for every DEV0129 source, test and ticket file. The latest repository-wide `npm run format:check` reaches five concurrently edited DEV0130 bootstrap files that are not formatted yet; it reports no DEV0129 file.
- Passed focused checks: `npx tsx --test tests/coach-marketplace.test.ts tests/coach-schedule.test.ts tests/coach-pass-client.test.ts` (14/14) and `npx tsx --conditions=react-server --test tests/server/coach-pass-catalogue.test.ts` (3/3).
- Local browser rehearsal at desktop and a 581-pixel responsive viewport passed for signed-in Tom. `/coaches/tom-c5cf60924b39` showed 12 real database-backed slots, an honest no-published-offer/no-credit state, Devnet/test-EURC/platform-fee copy and disabled `Pass required` booking controls. `/coach#client-cards` showed the responsive zero-client privacy state and exact one-day cancellation policy. Keyboard navigation reached the client-card anchor, and the coach workspace produced no application console error after reload.
- Not run: a real offer purchase, credit-backed booking, cancellation signature or populated two-account client card. The reviewed Devnet program currently has no eligible Tom offer/credit ledger for this local UI session, and this ticket did not sign or send a transaction without a separate explicit request.

## Risks, limitations, and follow-ups

Wallet addresses are public but do not replace human labels. The interface does not claim mainnet value, attendance proof or production consumer protection.

AC1–AC3 are implemented but remain open pending a populated Devnet rehearsal: initialize Tom's reviewed `CoachAuthority`, publish eligible one/ten-credit offers, give the linked client test EURC, then exercise purchase, booking, early return, late approval/denial and consumption through this interface. AC4 has passed responsive, keyboard and empty/error presentation checks; wallet rejection, submitted ambiguity and reload recovery still need the same populated operation rehearsal. That evidence belongs here for interface acceptance and also feeds DEV0130/DEV0125 operational completion.

## Completion and review references

- Completed: Not completed.
- Commit: `[DEV0129] Present coach passes and client cards`.
- Review: Planning self-review only.
- Deployment or release: None.
