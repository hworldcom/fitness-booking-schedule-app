# Ticket DEV0027: Phantom wallet connection foundation

- Status: Completed
- Created: 2026-09-20
- Last updated: 2026-09-20
- Milestone: M0 wallet foundation / M2 prerequisite
- Coordination: [COR0001 — Project structure](../../current/organisatory/COR0001-project-structure.md)
- Related tickets: supersedes the implementation choice from [DEV0006 — Simple devnet demo wallet](DEV0006-simple-devnet-demo-wallet.md) while retaining the EURC and personal/company separation from [DEV0007 — EURC-only wallet contract](DEV0007-eurc-only-wallet-contract.md); enables [COR0002 — Phantom authentication and demo access](../organisatory/COR0002-phantom-auth-and-demo-access.md), converted from retired DEV0016; [DEV0037 — Phantom embedded-wallet onboarding](DEV0037-phantom-embedded-wallet-onboarding.md) was later cancelled as optional post-MVP work

## Objective and context

Add the browser-side foundation for connecting a standard Phantom wallet on Solana Devnet. A user with the Phantom browser extension can connect, see the selected public address, reload with honest reconnection state, react to account changes and disconnect without the application claiming authentication or a financial transaction.

The ticket briefly changed to embedded-first Phantom Connect on 2026-09-20. During setup, Phantom Portal reported that new developer sign-ups were paused, so the required Portal account and App ID could not be obtained. The user chose to continue the hackathon MVP with their prepared Phantom extension and retain embedded onboarding as DEV0037 rather than blocking wallet delivery. The Node 24 prerequisite and evaluated Solana Kit wallet packages remain applicable.

This ticket owns Wallet Standard discovery, connection state and accessible browser UI. [COR0002](../organisatory/COR0002-phantom-auth-and-demo-access.md) now coordinates the fresh tickets that separately own Sign-In With Solana, the Supabase/application session, profile/run enrollment and wallet bindings after the original DEV0016 plan was split. A visible address or approved wallet connection does not grant an application profile, company role, protected access, balance or payment status.

## Scope and non-goals

- In scope: inspect and pin compatible Solana Kit Wallet Standard packages; add a browser-safe Devnet wallet client under `src/solana/client`; discover only the Phantom wallet; connect and disconnect; restore connection state honestly; display a shortened public address and explicit `Solana Devnet · Test funds` context; respond to wallet account/disconnect changes; handle discovery, missing-extension, locked/rejected wallet and repeated-request failures; preserve public browsing and preview data; add focused state/browser tests and a real extension rehearsal; document official Phantom installation guidance.
- Out of scope: Phantom Portal, Phantom Connect, embedded/social wallets, OAuth callbacks, email/SMS/password login, automatic account linking, wallet key import/export or recovery, `src/server/solana`, programs/generated bindings, Supabase sessions and authorization, balances, transaction construction/signing/simulation/submission, Sign-In With Solana signatures, EURC transfers, challenge actions, production mobile deep links, auto-confirm, server delegation or fee sponsorship.

## Expected behavior and edge cases

The header offers `Connect Phantom`. While Wallet Standard discovery or silent reconnection is settling, the wallet control exposes a neutral loading state instead of flashing a false disconnected state. If Phantom is available, choosing connect opens Phantom's own approval surface. Success shows an abbreviated address with `External wallet · Solana Devnet · Test funds`; it must also say that the wallet is connected but the user is not yet signed in to RepX Club. Disconnect clears only wallet-connection state and preserves preview data.

If Phantom is absent, the UI links only to the official `https://phantom.com/download` page and explains that desktop Chrome is the supported demo path. The responsive missing-wallet state remains usable at mobile widths; a real mobile connection is not an acceptance requirement for this extension-first slice. Phantom's mobile in-app browser may expose Wallet Standard, but production mobile universal/deep links remain a later decision.

Locked or rejected connection prompts, a wallet that authorizes no account, discovery delay, rapid repeated clicks, provider disconnect and account changes return to a usable state without false success. A successful account change updates the public address and clears no unrelated preview data. Wallet changes cannot select a demo persona, merge application users or classify an address as personal/company authority.

The chain is a compile-time `solana:devnet` constant and mainnet selection is not exposed. No recovery phrase, private key, signing key, provider credential, privileged RPC credential or wallet secret enters source control, logs, fixtures, tests or application-owned persistence. This ticket requests neither a message signature nor a transaction signature.

## Assumptions, decisions, and dependencies

P08 now selects the prepared external Phantom wallet for the hackathon MVP because new Phantom Portal developer sign-ups are paused. Personal participants and the organizer use separately prepared Phantom accounts; each financially active company still uses a distinct company wallet under C14. Embedded Google/Apple onboarding remains the desired later experience, but DEV0037 cannot start until Portal access and a public App ID are available.

Use `@solana/kit` plus `@solana/kit-plugin-wallet` for Wallet Standard discovery and normalized Phantom connection state, with its React hooks from `@solana/kit-plugin-wallet/react`. Keep `@solana/react` only because those action hooks use it. Do not introduce the legacy Solana wallet adapters, direct `window.phantom` state, `@solana/web3.js`, a second connection store or `@phantom/react-sdk`. No RPC package or endpoint is required until a later balance/transaction ticket owns a concrete read or send.

Node.js 24.21.0 LTS is adopted before wallet implementation. The repository and the user's local shell already target that version, and Node 20 remains installed only as a recovery option. This ticket has no database dependency and can run independently of completed DEV0015/DEV0025. It must finish before the authentication work now coordinated by COR0002 consumes the normalized Phantom account. Mocked states prove deterministic presentation, but completion requires one real prepared Phantom extension connect/reload/account-change/disconnect rehearsal. No signature or transaction is authorized by this ticket.

## Implementation plan

1. Preserve the completed Node.js 24.21.0 prerequisite. Inspect installed Next.js/React and wallet-package documentation, retain the compatible pinned `@solana/kit`, `@solana/kit-plugin-wallet` and `@solana/react` versions, and avoid adding Phantom Connect or an RPC dependency.
2. Add a browser-safe, Devnet-only Wallet Standard client and small application-owned presentation/error helpers under `src/solana/client`. Filter discovery to Phantom and give wallet persistence an application-specific public storage key.
3. Replace the wallet preview in the existing shell with reusable accessible connection controls. Expose discovery, missing, connecting, connected, reconnecting, disconnecting and recoverable error states; keep connection distinct from RepX Club authentication.
4. Add unit coverage for pure state/presentation rules and Playwright coverage for wallet-free public browsing, keyboard operation and responsive missing-wallet behavior. Preserve preview persistence and existing routes.
5. Rehearse the real Phantom extension on Devnet: connect, reload/reconnect, change account and disconnect. Confirm that no message or transaction signature occurs, then update README and this record with exact files and observed results.

## Acceptance criteria

- [x] AC1: In desktop Chrome with the prepared Phantom extension, connect approval exposes the selected shortened address with `External wallet · Solana Devnet · Test funds`; reload/reconnection and disconnect behave honestly without a message or transaction signature.
- [x] AC2: Discovery/loading, missing extension, locked/rejected/no-account error, repeated click, provider disconnect and account change states remain usable and never display a false wallet connection or RepX Club authentication state.
- [x] AC3: Public routes and the local preview remain usable without Phantom. The wallet UI is keyboard accessible and responsive at desktop/mobile widths, and server rendering/hydration does not expose a stale or fabricated address.
- [x] AC4: Configuration is Devnet-only. No private key, recovery phrase, provider credential, privileged RPC credential or application-owned wallet secret is recorded. No Sign-In With Solana, transaction signature, balance, payment, database identity or protected access is claimed.
- [x] AC5: Focused unit/browser checks, lint, typecheck and production build pass; exact package versions and the real Phantom connect/reload/account-change/disconnect observations are recorded.

## Validation plan

Test pure presentation/error helpers for connecting, connected, missing, rejected, disconnected and account-change inputs. Add browser checks for direct public navigation with no installed wallet, keyboard operation, narrow/desktop layouts, official-install guidance, explicit signed-out/Devnet labels and unchanged preview persistence. Inspect production output/configuration for secrets and unsupported cluster paths. Run existing unit tests, lint, typecheck, formatting, production build and Playwright regression.

Separately use the user's prepared Phantom extension in desktop Chrome on Devnet. Connect, reload, select another prepared account, return to the first account and disconnect. Reject one connection attempt if practical. Confirm the app never requests a message or transaction signature and public pages remain usable. Mocked checks cannot replace this interoperability evidence.

## Implementation record

Created on 2026-09-20 by splitting browser connection concerns from the then-current DEV0016 before wallet source implementation. DEV0016 initially retained Supabase sign-in, replay-resistant proof, identity/run enrollment, personal/company bindings and protected access; it was later retired and converted to COR0002 with fresh implementation tickets.

Implementation started with the Node runtime prerequisite. The official macOS arm64 Node.js 24.21.0 archive matched Node's published SHA-256 value `6239d4cf92d864487ec8cd3615038f7b67e7f58b77b21cd2f09ea9fbd68065fe` before extraction to the user-local `~/.local/node/24.21.0` directory. The existing Node 20 installation was retained. A fresh interactive shell resolves Node `v24.21.0` and npm `11.19.0`. Repository changes are `.nvmrc`, the `package.json` engine range `>=24.21.0 <25`, `@types/node` 24.13.6, the regenerated lockfile and updated README setup.

Initial dependency evaluation placed `@solana/kit` 8.3.0, `@solana/kit-plugin-wallet` 0.20.0 and `@solana/react` 8.3.0 in the uncommitted working tree. These now match the extension-first architecture: the wallet plugin owns Wallet Standard discovery/connection state and its React hooks use `@solana/react`. No RPC endpoint, source module, connection, signature or transaction existed at that point.

The user briefly selected embedded-first Phantom Connect after comparing the extension onboarding with Polymarket. The specification and dependent tickets were revised before provider source implementation. On 2026-09-20, the actual Phantom Portal showed `New sign ups are paused`, preventing creation of the required developer account/App ID. The user explicitly returned the MVP to the normal Phantom wallet and asked to retain embedded onboarding for later. DEV0037 preserves the deferred provider work; DEV0027 now has no Portal, OAuth or `@phantom/react-sdk` dependency. This second material approach change was recorded before wallet source implementation.

The extension-first implementation now uses the evaluated packages rather than adding another provider: `@solana/kit` 8.3.0 creates the client, `@solana/kit-plugin-wallet` 0.20.0 owns Wallet Standard discovery/connection/reconnection, and `@solana/react` 8.3.0 supplies the plugin action-hook dependency. The client filters discovery to the wallet name `Phantom`, fixes its chain to `solana:devnet`, and persists only the plugin's selected public account reference under `repx-club:phantom-wallet`. There is no RPC client or environment variable.

The existing shell wallet preview became a real connection surface. Its first server/client render is deliberately neutral through `useSyncExternalStore`, preventing a discovery result from creating a hydration mismatch. It then exposes missing-wallet guidance, connect approval, an abbreviated/full public address, external-wallet/Devnet/test-fund labels, honest RepX Club signed-out copy, recoverable bounded errors and disconnect. It never calls the plugin's message-signing or transaction methods. Public browsing and preview persistence remain independent.

| File or component                                                             | Change and purpose                                                                                                                                                         |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.nvmrc`, `package.json`, `package-lock.json`                                 | Pin Node 24.21.0, compatible Node types and the three Solana Kit wallet packages; no Phantom Connect or RPC package.                                                       |
| `src/solana/client/wallet-client.ts`                                          | Defines the only browser wallet client, compile-time Devnet chain, Phantom filter, public persistence key and official download URL.                                       |
| `src/solana/client/wallet-presentation.ts`                                    | Shortens public addresses and maps untrusted provider errors into bounded actionable copy without echoing arbitrary wallet output.                                         |
| `src/solana/client/wallet-connection.tsx`                                     | Implements hydration-safe header and dialog states for discovery, missing wallet, connect, connected context, recoverable errors and disconnect.                           |
| `src/components/shell.tsx`, `src/app/globals.css`                             | Replaces the static wallet preview with the accessible connection UI and responsive visual treatment.                                                                      |
| `src/features/discovery/how-it-works.tsx`, `src/features/profile/profile.tsx` | Keeps product guidance and sample-balance labels honest now that connection exists but authentication/balances do not.                                                     |
| `tests/wallet-presentation.test.ts`, `tests/browser/wallet.spec.ts`           | Covers address/error presentation and wallet-free desktop/mobile guidance, focus-safe dialog behavior and preserved public navigation.                                     |
| `tests/boundaries.test.ts`, existing browser specs                            | Protects the browser-Solana/server boundary and updates established keyboard/copy assertions without weakening prior regression checks.                                    |
| README, MVP specification and work records                                    | Records extension-first behavior, the Portal blocker, DEV0037 follow-up later cancelled by the focused-MVP audit, actual structure and remaining real-extension rehearsal. |

No data shape, database schema, hosted service, environment variable, RPC endpoint or migration changed. Rollback is removal of the three wallet packages/client UI and restoration of the static preview; it does not require data migration. The wallet plugin may retain its public connection reference in local storage, while Phantom remains the authority for connection approval and key material.

## Validation results

- **Planning structure and links — previously passed:** the local ticket/link validator found unique indexed ticket IDs, correct status/directory placement and valid Markdown targets for the ticket set before DEV0037.
- **Node 24 runtime upgrade — passed:** the downloaded archive checksum matched Node's official manifest; a fresh interactive shell resolved Node 24.21.0 and npm 11.19.0 from the user-local installation.
- **Runtime regression — passed before wallet source changes:** under Node 24, `npm test` passed 23/23 checks, `npm run lint`, `npm run typecheck` and `npm run format:check` passed, `npx next build --webpack` generated all 14 routes, `npm run test:db` passed 5/5 checks and `npm run test:e2e` passed all 28 desktop/mobile scenarios.
- **Direction change — confirmed external blocker:** the user observed Phantom Portal's `New sign ups are paused` notice and directed the project to continue with their prepared extension. No Portal credential or App ID exists.
- **Unit/boundary checks — passed:** `npm test` passed 25/25 tests under Node 24.21.0, including address shortening, rejected/locked/no-account/aborted provider-error mapping and the browser-Solana/server import boundary.
- **Static checks — passed:** `npm run lint`, `npm run typecheck`, the affected-file Prettier check and `git diff --check` passed. The repository contains no Phantom App ID/secret or RPC configuration; the wallet chain is the literal `solana:devnet` and no mainnet selector exists.
- **Production build — passed:** `npx next build --webpack` compiled, type-checked and generated all 14 application routes with Next.js 16.3.5.
- **Browser regression — passed after one fix:** the first `npm run test:e2e` run exposed React hydration error 418 because browser wallet discovery could settle before hydration. The header now gates its dynamic label with hydration-aware `useSyncExternalStore`. A rebuilt rerun passed all 30 desktop/mobile Chrome scenarios with no console errors, overflow or route/preview regression.
- **Focused responsive/visual check — passed:** `npx playwright test tests/browser/wallet.spec.ts` passed 2/2 desktop/mobile cases and captured the missing-wallet dialog. Manual inspection found the dialog readable, contained and action-complete at 1440×1040 and 393×852; keyboard focus returns to the header control and the official-download link is the last focusable action.
- **Documentation/ticket integrity — passed:** Prettier and `git diff --check` passed; a local link checker resolved repository-relative targets across all 15 active Markdown files. The ticket index allocates DEV0038 next and records DEV0037 as blocked rather than making it a hidden DEV0027 requirement.
- **Real Phantom rehearsal — passed:** the user exercised the prepared Phantom extension in desktop Chrome and reported the flow working as expected with no message-signature or transaction-signature request. Changing the selected Phantom account disconnected the application; explicit reconnection then selected the new account/address. This is Phantom's expected account-specific authorization behavior and prevents the prior account from remaining falsely connected. Reload/reconnection and explicit disconnect were accepted as behaving correctly, and public preview access remained available.
- **Completion/archive integrity — passed:** after recording the real-wallet evidence, Prettier and `git diff --check` passed; a repository-wide local-link check resolved targets across all 53 Markdown files, and the ticket validator found 33 unique records with correct current/archive status placement and index paths.
- **Database checks after wallet source — not run:** no schema, database configuration or server repository changed. The prior Node 24 `npm run test:db` result remains 5/5; repeating it would not exercise this browser-only slice.

## Risks, limitations, and follow-ups

An extension-first demo adds an installation/setup step and generic mobile browsers do not inject the desktop extension. Official Phantom guidance currently recommends Chrome for the extension; use only `phantom.com/download` for installation. DEV0037 retains embedded onboarding without blocking this MVP and must reassess SDK/API/Supabase compatibility when Portal access becomes available.

A wallet connection does not prove RepX Club authentication, company authority, funds, token-account compatibility or transaction success. COR0002's implementation tickets and later focused blockchain/payment tickets own those boundaries.

## Completion and review references

- Completed: 2026-09-20. Delivered and validated an extension-first, Devnet-only Phantom connection foundation with honest hydration/reconnection, account-change and disconnect behavior; deferred embedded onboarding to DEV0037 because Portal registration is unavailable.
- Commit: Not created.
- Review: Implementation self-review completed against every acceptance criterion; the user completed the real-wallet rehearsal. No independent code review.
- Deployment: None.
