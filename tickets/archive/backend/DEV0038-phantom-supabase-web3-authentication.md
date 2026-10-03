# Ticket DEV0038: Phantom Supabase Web3 authentication

- Status: Completed
- Created: 2026-09-20
- Last updated: 2026-09-20
- Milestone: M0 identity / M2 wallet prerequisite
- Coordination: None — former coordination record pruned under DEV0112; retained as a reusable authentication foundation
- Related records: depends on completed [DEV0015 — Supabase database foundation](DEV0015-supabase-database-foundation.md), [DEV0025 — Next.js backend boundary](DEV0025-nextjs-backend-boundary.md), and [DEV0027 — Phantom wallet connection foundation](../blockchain/DEV0027-phantom-wallet-connection-foundation.md); enables completed [DEV0039 — Prepared identity and wallet bindings](DEV0039-prepared-identity-and-wallet-bindings.md); DEV0037 — Phantom embedded-wallet onboarding was later cancelled as optional post-MVP work

## Objective and context

Prove the first real application-authentication slice: use DEV0027's selected Phantom Wallet Standard account to complete Supabase Auth's Solana Web3 sign-in, establish a server-verified session, reload it and sign out. The interface must distinguish an external wallet connection from a RepX Club session and must never imply profile, run, role or company authority before later tickets establish those mappings.

This was the first implementation ticket under its former coordination record. It implements the provider/session boundary under the current [actors and authority contract](../../../docs/mvp-spec.md#3-actors-and-authority) without adding application identity enrollment or protected product data.

## Scope and non-goals

- In scope: inspect the installed Next.js, Supabase and Solana Kit versions and current official integration guidance; enable the local Supabase Auth services/configuration needed for Solana Web3; add browser/server Supabase clients and verified server-side session refresh; adapt the normalized DEV0027 Phantom account to `signInWithWeb3`; add minimal accessible sign-in/sign-out/session-status UI; handle rejection, expiry, reload, disconnect and account mismatch honestly; configure a bounded local demo signup/rate-limit control; add focused unit, database/config and desktop/mobile browser tests; perform one real extension sign-in/reload/sign-out rehearsal.
- Out of scope: `wallet_bindings`, `auth_challenges`, prepared profile/run enrollment, roles, row-level security policies for product data, protected product routes, company-wallet proof, email/SMS/password or OAuth login, embedded wallets, transaction construction/signing/submission, balances or payments.

## Expected behavior and edge cases

A connected prepared Phantom account can open the dedicated `/sign-in` page, choose `Sign in to RepX Club`, review and approve a Sign-In With Solana message, and receive a Supabase session. The global shell links to this page instead of signing from an arbitrary route so the signed URI has one exact allow-listed origin/path. This is a message signature only: it moves no funds and requests no transaction signature. Reload restores the verified Supabase session; explicit sign-out clears it without disconnecting Phantom or deleting preview data.

Wallet-connected and application-signed-in states remain separate. Rejection, locked wallet, expired provider proof, invalid origin/domain, unavailable local Auth service, malformed provider response and rate limiting leave a usable connected-but-signed-out state. Rapid repeated requests produce one active attempt. Browser copy never echoes arbitrary provider text.

Disconnecting or selecting a different Phantom account must not silently transfer the existing session to that account. Until DEV0039/DEV0040 add application bindings and protected data, the UI marks the signer/session mismatch and prevents another sign-in attempt from merging subjects. Explicit company-wallet switching is not introduced here. Session cookies use current server-verified Supabase APIs and never treat editable Auth metadata as profile/run/role authority.

## Assumptions, decisions, and dependencies

Completed DEV0027 supplies the only Wallet Standard connection store. Reuse its Solana Kit account/signer and do not add legacy wallet adapters, `window.phantom`, `@solana/web3.js`, Phantom Connect or a second wallet store. Verify the adapter shape against the installed package versions and current official documentation before source changes.

Use local Supabase for implementation and validation. A hosted project, production origin, region and billing plan are not required for this ticket. Record every new public environment variable and setup step, but never record a service-role key, wallet secret, recovery phrase or private key. Supabase's verified Web3 subject is only an authentication subject; DEV0039 decides which prepared application actor it may claim.

Adopt the reviewed implementation defaults before source work:

- Pin `@supabase/supabase-js` 2.116.0 and `@supabase/ssr` 0.12.7. Keep the beta SSR integration behind small browser/server modules.
- Use `/sign-in` as the one canonical signing page and pass its exact URL to Supabase. Supabase Auth rejects insecure Web3 message URIs unless the hostname is the literal `localhost`, so the local application and allow-list use `http://localhost:3100/sign-in`; broad route wildcards are not needed. The existing `127.0.0.1:3101` browser-test server remains a separate unsigned test origin.
- Adapt the existing Kit wallet client without passing the Kit signer directly or accessing a Phantom browser global. Prefer Wallet Standard `solana:signIn` when the connected wallet advertises it so Supabase receives the wallet's exact `signedMessage` bytes and signature; retain the narrow `publicKey.toBase58()` plus `signMessage(message)` adapter as the fallback. In both paths, bind the proof to the selected normalized account and re-check the active account around approval.
- Use the newline-free statement `Sign in to RepX Club. This proves control of your wallet and does not authorize a transaction.` It records proof of wallet control, not terms acceptance or purchase authorization.
- Treat the verified Web3 identity identifier as the session wallet only for connection/session presentation. A disconnected or different connected wallet creates an explicit mismatch and cannot silently replace or merge the existing session. The Supabase subject remains the authentication identity; later application bindings remain owned by DEV0039.
- Keep `db:start` as the lean database-only command and add a separate Auth-enabled local workflow. Retain the local Web3 limit of 30 requests per five minutes. CAPTCHA is not required for loopback-only development, but a hosted/public rollout requires its own abuse-control decision before enabling signup.
- Refresh and validate server sessions with the current cookie-based SSR contract and `getClaims()`; never use `getSession()` as server authorization evidence. No protected product route or safe-return behavior is added in this ticket.

## Implementation plan

1. Inspect current package and bundled framework documentation plus current Supabase Solana Web3/SSR contracts. Record the exact compatibility decision before adding dependencies or configuration.
2. Enable the minimum local Supabase Auth configuration and add browser/server client factories with safe public configuration and server-verified cookie refresh.
3. Add a narrow adapter from DEV0027's normalized Phantom account to the wallet interface accepted by `signInWithWeb3`; keep provider-specific code at the browser authentication boundary.
4. Add accessible session controls and honest connected/signed-out/signed-in/mismatch/error states. Ensure rejection and sign-out preserve public browsing and preview data.
5. Add focused tests for adapter/session/error behavior, local Auth configuration, server verification, reload/sign-out, request de-duplication and desktop/mobile browser states. Rehearse the real prepared extension without requesting a transaction signature.

## Acceptance criteria

- [x] AC1: A real prepared Phantom account completes Supabase Solana Web3 sign-in on desktop, reloads the same server-verified session and signs out; only a message-signature prompt occurs.
- [x] AC2: Wallet connection alone remains visibly signed out. Rejection, locked wallet, invalid/expired proof, unavailable Auth and rate limiting never show a false RepX Club session.
- [x] AC3: Disconnect/account change cannot silently move or merge the session into the newly selected wallet. The mismatch is explicit and protected follow-up actions remain unavailable.
- [x] AC4: Server code verifies the current Supabase session using supported server APIs; client cookies or editable Auth metadata never grant profile, run, role or company authority.
- [x] AC5: Local Auth setup, public configuration, rate/signup boundary and recovery steps are documented without committing provider credentials or wallet secrets. Public browsing and preview persistence still work without Supabase or Phantom.
- [x] AC6: Focused tests, relevant local Supabase checks, lint, typecheck, formatting, production build and affected desktop/mobile browser regressions pass with exact results recorded.

## Validation plan

Run the local Supabase services required for Auth and prove sign-in with the user's prepared Phantom extension. Exercise approval, rejection, reload, sign-out, disconnect and account change; inspect the prompt to confirm it is a message signature and not a transaction. Use isolated browser contexts for session leakage checks.

Add unit tests around the signer adapter and state mapping, integration checks for verified versus forged/expired sessions, and Playwright coverage for wallet-only, signed-in, mismatch, error and responsive/keyboard states. Run database/config validation, existing unit/boundary tests, lint, typecheck, formatting, webpack production build and the affected browser suite. A hosted Supabase deployment is not required and must not be claimed.

## Implementation record

Implementation and validation are complete. The first real prepared-Phantom rehearsal exposed an adapter interoperability failure before any request reached Supabase Auth; after the adapter began preferring Phantom's advertised Wallet Standard structured sign-in result, the complete real-wallet rehearsal passed approval, session reload, local sign-out, cancellation and account-switch/disconnect behavior. The session never moved to another wallet, and no transaction prompt occurred. This ticket owns only provider/session proof. Later peer tickets own application identity, database authorization and company authority.

### Changes and rationale

- Added cookie-based browser and per-request server Supabase clients using pinned `@supabase/supabase-js` 2.116.0 and `@supabase/ssr` 0.12.7. Next.js `proxy.ts` calls `getClaims()` to refresh and verify tokens before rendering, while server session reads additionally call `getUser()` to retrieve the current Auth identity. Public requests remain available when configuration or Auth is absent.
- Added a structural Solana wallet adapter around DEV0027's one Wallet Standard client. The initial adapter exposed only the selected public key and `signMessage`; the real-wallet rehearsal showed that this path failed inside the browser before GoTrue received a request. The corrected boundary prefers `solana:signIn` when Phantom advertises it so the wallet-produced signed message and signature stay paired, retains the low-level message path as a compatibility fallback, re-checks the account before and after approval, and never constructs or requests a transaction.
- Corrected error attribution at the same boundary. A local Phantom signing failure no longer claims that Supabase rejected a signature; server errors carrying an HTTP status remain distinguishable from wallet feature, authorization and rejection failures without echoing provider text.
- Added a dedicated `/sign-in` screen and global session control. The interface distinguishes connection, signed-out, server-unavailable, matched session, disconnected signer and mismatched signer states; a mismatch cannot invoke another sign-in or merge accounts. Local-device sign-out clears the Supabase session without disconnecting Phantom or modifying preview storage.
- Enabled local Solana Web3 Auth and retained the 30-per-five-minute Web3 rate limit. Kept the existing PostgreSQL-only command and added an Auth/Kong profile plus a public-only status command. Public setup, recovery, local CAPTCHA limitation and the three required public environment variables are documented.
- Added pure adapter/config/identity/error/session tests, configuration enforcement and desktop/mobile browser coverage for the sign-in explanation, no-Phantom/configuration state, keyboard access and continued public browsing.

### Affected files

| File or component                                                                                                                                                                                                                                                              | Change and purpose                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`src/auth/config.ts`](../../../src/auth/config.ts), [`contracts.ts`](../../../src/auth/contracts.ts), historical `src/auth/web3-identity.ts`, `src/auth/wallet-adapter.ts` and `src/auth/presentation.ts`                                                                     | Define public configuration, the exact statement/route, serializable verified-session states, bounded Web3 identity extraction, account-stable message signing and non-echoing user errors.                         |
| [`src/auth/client/`](../../../src/auth/client/)                                                                                                                                                                                                                                | Create the singleton cookie-backed browser client, bind the existing Kit wallet to the narrow adapter, keep server-verified state in a React provider and expose the global session link.                           |
| [`src/server/auth/`](../../../src/server/auth/), [`src/proxy.ts`](../../../src/proxy.ts), [`src/app/api/auth/session/route.ts`](../../../src/app/api/auth/session/route.ts)                                                                                                    | Create request-scoped server clients, refresh cookies with `getClaims()`, fetch a current Auth identity with `getUser()`, and expose a private/no-store verified session snapshot without protecting public routes. |
| [`src/features/auth/sign-in.tsx`](../../../src/features/auth/sign-in.tsx), [`src/app/sign-in/page.tsx`](../../../src/app/sign-in/page.tsx), [`src/components/shell.tsx`](../../../src/components/shell.tsx), [`src/app/globals.css`](../../../src/app/globals.css)             | Add the accessible canonical sign-in flow, status/mismatch/sign-out states and responsive presentation; link it separately from the existing wallet connection control.                                             |
| [`src/solana/client/wallet-connection.tsx`](../../../src/solana/client/wallet-connection.tsx)                                                                                                                                                                                  | Update connected-wallet guidance and link to sign-in while retaining independent disconnect behavior.                                                                                                               |
| [`supabase/config.toml`](../../../supabase/config.toml), [`package.json`](../../../package.json), [`.env.example`](../../../.env.example), [`README.md`](../../../README.md), [`supabase/README.md`](../../../supabase/README.md)                                              | Enable local Web3 Auth, use the literal `localhost` signing origin, add separate Auth operations/dependencies and document public values and recovery.                                                              |
| [`tests/auth.test.ts`](../../../tests/auth.test.ts), [`tests/supabase-auth-config.test.ts`](../../../tests/supabase-auth-config.test.ts), [`tests/browser/auth.spec.ts`](../../../tests/browser/auth.spec.ts), [`tests/boundaries.test.ts`](../../../tests/boundaries.test.ts) | Cover configuration, signer account stability, identity parsing, mismatch mapping, bounded errors, server verification rules, architecture boundaries and responsive browser behavior.                              |

Replacement note, 2026-09-21: completed [DEV0046](DEV0046-email-otp-registration-and-application-profiles.md) removed the three historical wallet-login helper files named above when email OTP replaced personal Web3 login. Their names remain here as implementation history rather than live source links.

### Decisions and deviations

- The reviewed `127.0.0.1` signing URL was changed before application source work to `http://localhost:3100/sign-in`. The installed GoTrue implementation accepts insecure Web3 message URIs only for the literal `localhost`; the API itself remains loopback-only at `127.0.0.1:55321`.
- The browser receives the wallet address immediately from the signed Auth response, but the application session UI is refreshed from `/api/auth/session`, whose server path validates claims and fetches the current Auth identity. Neither the address nor editable Auth metadata is treated as application authorization.
- `signOut({ scope: "local" })` signs out this browser without disconnecting Phantom or revoking other device sessions. Global session management and account recovery are outside this local MVP slice.
- CAPTCHA remains disabled only for loopback development. The existing Web3 rate limit is enforced locally; public hosted signup is not authorized until a separate operational abuse-control decision is recorded.
- The default Turbopack build cannot bind its internal worker port in the agent sandbox. The planned webpack production build succeeds and is the recorded production evidence; no application workaround was added for the sandbox restriction.

### Contracts, configuration, and operations

- Public variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `NEXT_PUBLIC_SITE_URL`. All three must parse together; otherwise Auth is disabled safely. `NEXT_PUBLIC_SITE_URL` must be HTTPS outside local development, and plain HTTP is accepted only for `localhost`.
- Browser wallet contract: either Wallet Standard structured `signIn(input)` returning the wallet's account, exact `signedMessage` and signature, or the fallback `{ publicKey: { toBase58(): string }, signMessage(message: Uint8Array): Promise<Uint8Array> }`. The implementation selects only an advertised capability and checks the selected address on both sides of the prompt.
- Session response contract: `disabled`, `signed-out`, `unavailable`, or `signed-in` with the verified Supabase subject, provider identity address and optional JWT expiry. This is presentation/session evidence only, not a `profile_id`, `run_id`, membership or role.
- Local operations: `db:start` remains database-only; `auth:start` starts database, GoTrue and Kong while excluding unrelated services; `auth:status` prints only `API_URL` and `ANON_KEY`; `db:stop` stops either profile. No migration or product schema changed.
- An ignored `.env.local` was prepared for the current local rehearsal from the disposable stack's public values. No service-role key, provider credential, private key or recovery phrase was written to the repository.

## Validation results

| Criterion               | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Result                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| AC1                     | Auth-enabled application opened at exact `http://localhost:3100/sign-in`. After the structured Wallet Standard correction, the user observed `Signed in and wallet matched`; GoTrue recorded the Web3 token grant as `200`, authenticated user reads as `200`, and an aggregate query found one non-anonymous Auth user. Refresh preserved the matched session without another prompt. Local sign-out returned to `RepX Club signed out` while Phantom stayed connected. Only message approval was requested. | Passed                                |
| AC2–AC4                 | `npm test` passed 36/36, including structured signed-message preservation, before/after account-change rejection, identity parsing, mismatch state, bounded provider errors and server-verification assertions. In the real browser, cancellation stayed signed out with bounded copy. Switching Phantom accounts disconnected the signer while retaining and naming the existing application session, so the session was not reassigned or merged. `npm run typecheck` and `npm run lint` passed.            | Passed                                |
| AC5                     | `npm run auth:start` passed. Repository containers `supabase_db`, `supabase_auth` and `supabase_kong` reported healthy. `/auth/v1/health` returned GoTrue v2.196.0. A deliberately malformed Web3 grant returned `400 validation_failed: message is too short`, proving the provider is enabled without accepting a proof. `npm run auth:status` printed only public URL/anonymous-key values.                                                                                                                | Passed locally                        |
| AC5–AC6 public fallback | Configuration-free webpack build passed; `npm run test:e2e` passed all 34 desktop/mobile checks, including new sign-in, wallet-free, keyboard and public-navigation checks. Screenshots were visually reviewed at 1440×1040 and 393×852.                                                                                                                                                                                                                                                                      | Passed                                |
| AC6 configured build    | After the correction, `npm run build -- --webpack`, `npm run format:check`, lint and typecheck passed with `.env.local`. The freshly restarted production server returned `200` for `/sign-in` and `200 {"status":"signed-out"}` for `/api/auth/session`. The earlier configured `npm run test:e2e` run passed all 34 desktop/mobile cases.                                                                                                                                                                   | Passed                                |
| Environment-only check  | Plain `npm run build` hit Turbopack's `creating new process / binding to a port / EPERM` sandbox panic. The webpack build passed twice and is the required ticket check.                                                                                                                                                                                                                                                                                                                                      | Explained; not an application failure |

## Risks, limitations, and follow-ups

The real Phantom rehearsal is complete. Its account switch manifests as a wallet disconnect rather than an immediately connected different account; the application correctly keeps the existing Supabase session explicit and blocks wallet-bound follow-up actions until the matching wallet reconnects or the user signs out. The connected-different-wallet mismatch branch remains covered automatically.

`@supabase/ssr` remains a beta package and is pinned behind small client modules. Local Web3 Auth configuration and rate-limit behavior do not establish a hosted production posture; CAPTCHA, hosted origin, plan/region, monitoring and identity recovery remain later operational work.

DEV0039's authentication dependency is now satisfied, but DEV0039 must still finish its schema/roster planning before implementation. This ticket does not make a Supabase user an allowed RepX Club actor.

## Completion and review references

- Completed: 2026-09-20.
- Commit: Implementation `4fbab40` (`[DEV0038] Add Phantom Supabase authentication`); lifecycle completion is recorded in the current DEV0038 completion commit.
- Review: Implementation self-review and the complete real Phantom message-signature/session rehearsal passed.
- Deployment or release: None.
