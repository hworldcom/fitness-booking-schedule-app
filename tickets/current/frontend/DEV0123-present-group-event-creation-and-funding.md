# Ticket DEV0123: Present group-event creation and funding

- Status: In progress
- Created: 2026-10-04
- Last updated: 2026-10-05
- Milestone: Marketplace M3/M5 group-event experience
- Coordination: [COR0010 — Coach-pass and group-funded marketplace MVP](../organisatory/COR0010-group-funded-coach-marketplace-mvp.md)
- Related records: depends on completed [DEV0120 — Persist group-event catalogue and projections](../../archive/backend/DEV0120-persist-group-event-catalogue-and-projections.md), [DEV0122 — Integrate Devnet group-event funding](../blockchain/DEV0122-integrate-devnet-group-event-funding.md) and completed EURC contract [DEV0134](../../archive/blockchain/DEV0134-adopt-eurc-for-marketplace-payments.md); consumes coach/location/calendar foundations and supplies the primary browser flow to DEV0125

## Objective and context

Give coaches and clients an understandable interface for creating, discovering and conditionally funding group events, including successful payout and failed-pool refund states.

## Scope and non-goals

- In scope: coach draft/create review; event list/detail; funding progress and deadline; wallet readiness/simulation summary; contribution pending/success/recovery; settlement control; coach payout; participant refund; Explorer links; responsive/keyboard/error states.
- Out of scope: persistence/program implementation, attendance/check-in, disputes, no-show handling, waitlists, multi-seat purchases, chat or fiat.

## Expected behavior and edge cases

The interface explains that the full seat price is conditional, identifies Devnet/test EURC and shows the exact minimum, maximum, deadline, vault-backed state and refund rule. It never calls an unfinalized transaction successful. Only eligible coach/participant actions render, while permissionless settlement remains available without implying caller control over outcome.

## Assumptions, decisions, and dependencies

Use server/chain-derived terms and status. The accessible event list remains useful without Mapbox or wallet connection. Prepared demo pools must be labeled demonstration data.

DEV0122's committed local browser/server contract is stable enough for interface implementation: it exposes prepare, submit, recover and reject operations for create, fund, settle, payout and refund. DEV0122's remaining real-wallet success/payout and failure/refund rehearsal is validation evidence rather than an interface blocker. DEV0123 may implement and test honest unavailable, rejected, pending and recovered states now, but it cannot complete until the wallet-driven Devnet lifecycle is exercised through this interface.

Keep the frontend slice separate from the coach-pass bootstrap and DEV0130 operation files. Prefer dedicated group-event routes, actions, components and styles; integrate shared coach or discovery pages only through narrow links or summaries. The existing DEV0129 pass/booking surfaces remain authoritative for the primary marketplace loop.

## Implementation plan

1. Add bounded server actions for coach draft/update/publish/withdraw behavior and dedicated coach event-management surfaces.
2. Add accessible public event catalogue/detail/progress routes that stay useful without a wallet or Mapbox.
3. Add one reusable transaction-review client over DEV0122's prepare/sign/submit/recover/reject contract for create, fund, settle, payout and refund. Freeze an explicit compute-unit limit and zero-priority-fee instruction in every prepared message so the wallet reviews and signs the same complete transaction shape used by the working coach-pass flow.
4. Add recovery, unavailable, rejected, insufficient-balance, stale-state and role-ineligible UX without treating browser or unfinalized state as success. Preserve a bounded validation reason when a wallet-signed transaction is rejected before platform sponsorship so a real-wallet rehearsal can distinguish malformed bytes, message drift, signer-layout drift and signature failure without exposing transaction bytes. Verify the event vault against the EventPool PDA authority actually declared by the deployed program before projecting a finalized operation.
5. Add focused domain/component tests plus desktop/mobile/keyboard and public/protected browser coverage, then run static and production builds.

## Acceptance criteria

- [x] AC1: Coach creation presents and signs exactly the reviewed immutable pool terms.
- [x] AC2: A participant can discover and fund one seat with accurate progress and finalized recovery state.
- [ ] AC3: Successful pool/payout and failed pool/refund views expose only authorized actions and converge after reload.
- [ ] AC4: Map/wallet/RPC/unavailable/rejected states remain honest and accessible at mobile/desktop widths.
- [x] AC5: Component, browser, authorization, static and build checks pass.

## Validation plan

Run focused components, mocked operation transitions, Playwright guest/client/coach/unrelated flows, real-wallet Devnet rehearsal inherited from DEV0122, desktop/mobile keyboard checks, lint, typecheck, formatting and builds.

## Implementation record

Implementation started on 2026-10-05 after DEV0122's local operation adapter and DEV0130's remaining work were committed. The repository was clean at start. DEV0123 uses dedicated group-event presentation files and the existing DEV0120/DEV0122 interfaces; real Devnet transaction evidence remains deferred until the local interface is ready for a separately approved wallet rehearsal.

### Changes and rationale

- Added public `/events` and `/events/[slug]` surfaces with verified fixed-price, participant threshold/capacity, deadline, funding progress, lifecycle, contribution, payout/refund rule and Solana Explorer evidence. Guests can browse without Mapbox or a wallet; unavailable projections, unpublished slugs and actor-read failures expose no financial controls.
- Added `/coach/events` with coach-owned draft creation/update/withdraw, explicit coach-timezone conversion, immutable pool-term review and post-finalization publication. Pool preparation fixes exact test-EURC price, minimum, maximum and deadline before the wallet opens. A coach without a verified on-chain CoachAuthority sees an explicit setup gate instead of a fabricated address.
- Added one reusable group-event transaction launcher/review for create, fund, permissionless settle, coach payout and participant refund. It consumes DEV0122's simulated prepared bytes, requires the exact linked wallet, records wallet rejection, keeps the durable operation ID and bounded original request in session storage, recovers submitted/ambiguous state without blind resubmission and calls a transaction successful only after finalized account verification. Every review states that MovX pays SOL fees/rent while the user retains business authority.
- Added allowlisted pre-sponsorship rejection reasons after the first Phantom rehearsal exposed an unhelpful generic `invalid-request`. The server now distinguishes malformed submit payloads, sponsor drift, invalid transaction bytes, reviewed-message drift, signer-layout drift, an unexpected sponsor signature and missing/invalid user signatures. The browser translates only those stable codes into actionable copy and never receives raw signed bytes or internal exception details.
- Added an explicit 200,000 compute-unit limit and zero-micro-lamport priority price to every prepared group-event message, matching the already rehearsed coach-pass transaction shape. These instructions precede application and associated-token-account instructions, remain covered by the exact reviewed-message comparison and prevent an omitted compute budget from being supplied implicitly during wallet review.
- Corrected finalized pool recovery to verify the vault's SPL Token authority against the EventPool PDA, matching the deployed program's `token::authority = event_pool` constraint. The verifier previously expected the separate EventAuthority PDA, causing a successful creation to remain journaled as `submitted`; token-program ownership, exact EURC mint, derived vault address, initialized state and liability conservation remain strict.
- Added an actor-scoped read model that reveals only whether the viewer owns the coach profile plus that viewer's own contribution. UI action derivation uses the finalized pool lifecycle, deadline, coach ownership and private contribution lifecycle: coaches cannot fund their own pool, any eligible signed-in actor may settle after the deadline, only the coach sees payout and only the contributing participant sees refund.
- Added exact, float-free EURC parsing, bounded pool-term validation, daylight-saving-time-safe local-time conversion and role/lifecycle action derivation as pure tested domain helpers. The database integration fixture now uses a collision-free participant wallet while preserving a distinct CoachAuthority PDA and payout wallet.
- Added responsive group-event styling and narrow navigation links from the global shell and coach workspace. The public empty catalogue was visually checked at 1440×1000 and 390×844; both layouts retained readable hierarchy and no horizontal overflow.

### Affected files

- [`src/app/coach/events`](../../../src/app/coach/events) owns the protected coach route and bounded draft/publish/withdraw Server Actions; authorization and ownership are rechecked server-side for every mutation.
- [`src/app/events`](../../../src/app/events) owns the public catalogue/detail routes and fail-closed loading/not-found states. [`src/app/group-events.css`](../../../src/app/group-events.css) supplies desktop/mobile presentation, focus-compatible native controls and operation-state styling.
- [`src/features/group-events`](../../../src/features/group-events) owns catalogue/detail presentation, coach draft/pool management, eligible-action rendering and exact prepared-transaction review/recovery.
- [`src/domain/group-event-marketplace.ts`](../../../src/domain/group-event-marketplace.ts) owns timezone conversion, exact EURC/pool-term parsing, progress and the role/lifecycle action matrix.
- [`src/server/db/group-events/repository.ts`](../../../src/server/db/group-events/repository.ts) and [`src/server/group-events/service.ts`](../../../src/server/group-events/service.ts) add the fail-closed current-actor projection without exposing another participant's contribution.
- [`src/server/solana/group-event-rpc.ts`](../../../src/server/solana/group-event-rpc.ts) verifies finalized EventPool and vault state against the deployed program's account constraints; [`tests/server/group-event-rpc.test.ts`](../../../tests/server/group-event-rpc.test.ts) now models the EventPool-owned vault and rejects the previously assumed EventAuthority owner.
- [`src/components/shell.tsx`](../../../src/components/shell.tsx), [`src/features/coaches/coach-availability-panel.tsx`](../../../src/features/coaches/coach-availability-panel.tsx) and [`src/app/layout.tsx`](../../../src/app/layout.tsx) add the narrow public/coach navigation and stylesheet integration.
- [`tests/group-event-marketplace.test.ts`](../../../tests/group-event-marketplace.test.ts), [`tests/group-event-presentation.test.ts`](../../../tests/group-event-presentation.test.ts), [`tests/database/group-events.test.ts`](../../../tests/database/group-events.test.ts) and [`tests/browser/group-events.spec.ts`](../../../tests/browser/group-events.spec.ts) cover exact terms, DST gaps, role actions, honest copy, actor privacy and responsive public/protected routing.

### Decisions and deviations

The interface resolves a coach's existing CoachAuthority through the verified public coach-pass catalogue rather than accepting a manually entered program-derived address. This reuses the combined program and DEV0130 bootstrap without changing its operation files; an authority with no active verified public offer currently presents the same setup gate, which is acceptable for the two-feature MVP but remains a coupling to revisit after the first rehearsal.

Event `datetime-local` values are interpreted in the coach profile timezone and converted to an exact ISO instant before the Server Action revalidates the complete draft. Missing daylight-saving times fail explicitly instead of shifting silently. Pool terms use integer EURC base units throughout and are re-derived again by DEV0122 before simulation.

No Mapbox dependency was added: event location and timezone are immutable snapshots from the existing reviewed coach profile. The public event page remains list-first and usable when the map or wallet is unavailable.

The first Phantom creation rehearsal returned only the generic `invalid-request` result for recovery ID `3a2afe77-d659-48ae-873f-61dd04d60d8f`. A finalized Devnet read showed that the derived EventPool account did not exist and had no signatures, proving rejection occurred before broadcast. The implementation is therefore being refined to return only an allowlisted validation category from the sponsor boundary; raw signed bytes, signatures, internal errors and key material remain undisclosed.

The next prepared creation, recovery ID `06da5e23-50ec-43ef-ae19-38ceed96319b`, returned the new `wallet-message-mismatch` category: Phantom supplied a valid transaction envelope but its message bytes no longer matched the exact reviewed message, so the server correctly refused sponsorship and broadcast. Comparison with DEV0130's working transaction builder found that coach-pass messages explicitly contain a 200,000 compute-unit limit and zero-micro-lamport priority price, while group-event messages left both implicit. The group-event builder now adopts the same explicit MVP budget before application instructions. Wallet normalization of an omitted budget is the leading diagnosis, but remains an inference until a fresh real-wallet retry passes; exact message equality remains mandatory and will not be weakened.

The corrected transaction for operation `0f25f996-668f-4ade-8592-6900eb6b3d4a` finalized successfully at Devnet slot `507845832` and created EventPool `65WQM2zbgLf8yai9335yLJ7Bz2zVEAkCc4Hji7W9kfav`. Recovery nevertheless left the database operation `submitted`: a direct strict read reproduced `EURC token account has an unexpected owner or mint`. The deployed program initializes the vault with `token::authority = event_pool`, and the finalized vault confirms that owner, while the server verifier and its fixture incorrectly expected the separate EventAuthority PDA. Recovery will be corrected to verify the EventPool PDA as vault token authority; it will retain the existing token-program, EURC mint, address, initialization and liability checks.

### Contracts, configuration, and operations

Adds three application routes (`/events`, `/events/[slug]` and `/coach/events`) and two private Server Actions for draft persistence/transitions. The browser operation contract remains DEV0122's existing `/api/solana/group-events/{prepare,submit,recover,reject}` interface. Its `invalid-request` result has an additive optional, allowlisted `reason` field for pre-sponsorship diagnostics. Fresh prepared transaction bytes now include the explicit compute-budget instructions described above; old prepared operations are not rewritten and must be rejected or expire before preparing a replacement. No endpoint, program, migration or environment variable changed.

The actor read contract returns only `isCoach` and the current actor's contribution address, wallet, exact amount, lifecycle, latest signature and finalized timestamp. The operation recovery hint uses `movx:group-event-operation:<event-id>` in session storage and contains the operation ID plus the validated original request needed to reopen the same exact review; the server journal remains authoritative for operation state. There are no secrets in browser state. Deployment/rollback requires no database step; removing the routes/components would leave all persisted drafts, pools and operation records intact.

## Validation results

- Passed `npm test`: 157 unit/server-condition tests (129 default-condition plus 28 React-server-condition tests). New coverage proves exact timezone/DST conversion, six-decimal EURC and pool bounds, the funding/settlement/payout/refund role matrix, threshold progress, public conditional-funding copy, non-final operation wording, reload recovery of the exact reviewed request without cross-event reuse, bounded pre-sponsorship failure classification and explicit compute-budget decoding across creation, funding, settlement, payout and refund messages.
- Passed the focused local database run for `tests/database/group-events.test.ts`: 4/4 tests. The added assertions prove that a coach sees `isCoach: true` without another participant's private contribution, while the participant sees only their exact contribution projection.
- Passed `npm run lint`, `npm run typecheck`, `npm run build`, `npm run format:check` and `git diff --check`. The production build includes dynamic `/events`, `/events/[slug]` and `/coach/events` routes.
- Passed a direct finalized Devnet read of EventPool `65WQM2zbgLf8yai9335yLJ7Bz2zVEAkCc4Hji7W9kfav` after correcting the verifier. At observed slot `507847285`, the derived vault was initialized under the SPL Token program, owned by that exact EventPool PDA, used the official Devnet EURC mint, held zero units for zero current liability, and decoded as a funding pool with zero participants.
- Passed `npx playwright test tests/browser/group-events.spec.ts`: 6/6 desktop/mobile checks covering the public empty catalogue, keyboard-reachable navigation, no horizontal overflow, protected coach route and unpublished-slug fail-closed behavior. Playwright screenshots and separate 1440×1000/390×844 local screenshots confirmed the empty public state visually.
- The full `npm run test:db` run completed 31/35 tests. All four group-event integration tests passed; four pre-existing `tests/database/coach-bookings.test.ts` cases failed during their shared setup because the already provisioned local database owns wallet `3idZ…kPFe`. That external fixture collision is outside DEV0123 and does not affect the isolated group-event result; no booking source or fixture was changed under this ticket.
- The authenticated Phantom creation for operation `0f25f996-668f-4ade-8592-6900eb6b3d4a` finalized successfully on Devnet, recovered through the corrected strict verifier, and was explicitly published. Two separate participant funding operations (`651bea98-8553-48f3-a0bb-cfa1dfbd869a` and `4cac9676-043d-40b5-bcbb-26c3a8cced86`) also finalized and projected. The published event is `current` with minimum 2, maximum 12, participant count 2 and lifecycle `funding`, proving that reaching the minimum does not close funding. Recovery ID `06da5e23-50ec-43ef-ae19-38ceed96319b` remains a safely rejected pre-broadcast attempt. Successful settlement/payout and failed settlement/refund remain unrun, so AC3 and DEV0123 completion remain open.

## Risks, limitations, and follow-ups

Funding language does not imply real-money guarantees, automatic background execution or proof that the offline event occurred. The interface uses Devnet/test-EURC labels and explains that settlement must be initiated.

The local catalogue now contains one published finalized pool with two finalized participant contributions. The required remaining wallet-driven rehearsal must verify insufficient test-EURC, submitted-response ambiguity, successful settlement/payout and failed settlement/refund after reload. The program and UI both allow additional distinct participants after the minimum and stop at the maximum, but the integration suite does not yet contain an explicit `minimum + 1` funding case when maximum is larger. Until the lifecycle evidence is complete this ticket stays `In progress`, and the interface must not be described as deployed or fully complete.

Coach event creation currently discovers CoachAuthority from the ready pass-offer catalogue. If the first rehearsal needs a coach authority without public pass offers, add a linked follow-up to expose a verified authority-only read rather than accepting a browser-entered PDA.

## Completion and review references

- Completed: Not completed.
- Commit: `[DEV0123] Present group-event creation and funding` (this change).
- Review: Implementation self-review completed; independent review not recorded.
- Deployment or release: None.
