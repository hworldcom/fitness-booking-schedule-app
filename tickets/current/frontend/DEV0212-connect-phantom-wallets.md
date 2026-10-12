# Ticket DEV0212: Connect Phantom wallets

- Status: Draft
- Created: 2026-10-12
- Last updated: 2026-10-12
- Milestone: Hackathon H1 wallet experience
- Coordination: [COR0019 — Hackathon Solana group events](../organisatory/COR0019-hackathon-solana-group-events.md)
- Related records: depends on completed [DEV0210](../../archive/organisatory/DEV0210-adopt-hackathon-group-event-contract.md) and current [DEV0211](../backend/DEV0211-persist-personal-wallet-bindings.md); historical UI baseline [DEV0027](../../archive/blockchain/DEV0027-phantom-wallet-connection-foundation.md); supplies wallet controls to [DEV0216](DEV0216-present-group-event-marketplace.md)

## Objective and context

Restore and adapt the previously implemented Phantom wallet connection and ownership-linking experience to the current authenticated application without replacing email sign-in or spreading wallet-specific dependencies across unrelated scheduling screens.

## Scope and non-goals

- In scope: one client-only Solana provider boundary; Wallet Standard discovery with Phantom as the required target; connect/disconnect/account-change states; signed-message link/replacement flow; compact account navigation status; Devnet disclosure; desktop/mobile/keyboard/error coverage.
- Out of scope: event transaction construction, fee sponsorship, token balances, wallet custody, auto-connect without user intent, email authentication replacement, program code or mainnet.

## Expected behavior and edge cases

An authenticated user can connect Phantom, see the selected address and link it by approving the exact DEV0211 ownership message. Connection alone is visibly distinct from a verified MovX binding. Disconnecting the browser wallet does not sign out of MovX or delete the binding. Account changes, unsupported capabilities, rejection, missing extension, mobile handoff, stale challenge, service failure and a connected address different from the bound address receive actionable, non-success states.

## Assumptions, decisions, and dependencies

Use the current Solana Kit plugin path: `@solana/kit`, `@solana/kit-plugin-wallet`, `@solana/react` and Wallet Standard hooks, subject to installed-version review before implementation. Do not introduce legacy `@solana/wallet-adapter-*` for new code. Keep `use client` at leaf components and retain the existing server-rendered shell. Commit `63490d9` supplies the previous binding UI and earlier wallet commits supply the connection baseline; port them into the redesigned shell instead of recreating their state model. No transaction is sent in this ticket.

## Implementation plan

1. Read the installed Next.js and Solana package documentation and freeze exact compatible versions.
2. Add one typed wallet-enabled client/provider at the narrow application boundary.
3. Implement Phantom discovery, explicit connection/disconnection and DEV0211 challenge signing/linking/replacement states.
4. Integrate compact linked/connected/mismatch presentation into the authenticated shell without exposing private wallet state publicly.
5. Add focused component tests plus desktop/mobile/keyboard browser coverage and run static/build checks.

## Acceptance criteria

- [ ] AC1: Phantom is discovered through Wallet Standard and can connect/disconnect without affecting the email session.
- [ ] AC2: An authenticated user can link or replace a wallet through DEV0211's exact message-proof flow, and connected versus verified states are never conflated.
- [ ] AC3: missing, rejected, changed, mismatched, unsupported and unavailable states remain understandable and recoverable.
- [ ] AC4: Wallet UI is responsive and keyboard-accessible, and focused/static/build tests pass.

## Validation plan

Add unit/component coverage for state derivation and challenge handling. Run Playwright at desktop and mobile widths for missing-wallet, connect, rejection, account-change, disconnect and mismatch states using a controlled Wallet Standard test wallet. Perform one manual Phantom Devnet ownership-link rehearsal without sending a transaction. Run relevant tests, lint, typecheck, format check and build.

## Implementation record

Pending implementation.

### Changes and rationale

Pending.

### Affected files

| File or component            | Change and purpose                                |
| ---------------------------- | ------------------------------------------------- |
| App provider boundary        | One typed Wallet Standard-capable Solana client.  |
| Authenticated wallet feature | Connection, proof and account-state presentation. |
| Browser/unit tests           | Responsive and failure-state evidence.            |

### Decisions and deviations

None yet.

### Contracts, configuration, and operations

Expected public configuration is a Devnet RPC URL and chain label only. No fee-sponsor secret or private key may enter a `NEXT_PUBLIC_*` value or browser bundle. Exact dependencies remain pending installed-version review.

## Validation results

Pending validation.

- Date and environment: Not run.
- Exact commands and outcomes: Not run.
- Manual steps and observed outcomes: Not run.
- Failed, blocked, or not-run checks and reasons: Not run — DEV0211 must deliver the ownership-proof service contract before this ticket becomes Ready.

| Criterion | Evidence                               | Result  |
| --------- | -------------------------------------- | ------- |
| AC1       | Controlled wallet browser flow         | Not run |
| AC2       | Proof/link/replacement flow            | Not run |
| AC3       | Failure-state matrix                   | Not run |
| AC4       | Responsive, keyboard and static checks | Not run |

## Risks, limitations, and follow-ups

Wallet extensions may modify or reject transaction requests later; DEV0215 owns exact prepared-message verification. Mobile Phantom behavior must be tested on a supported browser path rather than inferred from desktop emulation alone.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: No independent review or pull request.
- Deployment or release: Not deployed.
