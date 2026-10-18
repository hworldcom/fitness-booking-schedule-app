# Ticket DEV0286: Implement password authentication and recovery

- Status: In progress
- Created: 2026-10-17
- Last updated: 2026-10-17
- Milestone: Authentication quality before user acceptance testing (UAT)
- Coordination: [COR0027 — Login, registration and social authentication](../organisatory/COR0027-login-registration-and-social-authentication.md)
- Related records: Direct peer/dependency boundaries and external consumers are mapped by COR0027. Historical identity foundations: [DEV0046](../../archive/backend/DEV0046-email-otp-registration-and-application-profiles.md) and [DEV0147](../../archive/backend/DEV0147-separate-client-onboarding-and-verified-coach-access.md).

## Objective and context

Deliver Supabase-managed email/password signup/login, confirmed-email application enrollment, password reset and verified password setup for existing email-code users while retaining their original application identity.

Use the current [registration contract](../../../docs/mvp-spec.md#41-register-as-an-athlete-or-apply-to-coach), [identity/privacy rules](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity), [definition of done](../../../docs/mvp-spec.md#11-definition-of-done), [milestones](../../../docs/mvp-spec.md#12-delivery-milestones) and [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix). The local password-first flow is implemented; DEV0322 removes the former email-code fallback at the user’s request. Real Google and hosted/combined UAT readiness remain pending.

## Scope and non-goals

Provider-boundary refinement, 17 October 2026: this peer also owns application-defined Auth operation/session/event/result contracts and the concrete Supabase adapter used by the login UI. Screens and business services must not call the SDK directly or depend on vendor session/error/event types. Extend meaningful boundary/contract tests to enforce that separation while preserving server-side verification and existing actor permission checks. This is part of this peer's Auth/session foundation, not an independently duplicated implementation under DEV0291.

In scope: password operations, common server-rendered session/callback foundation, verified-email profile/actor gates, server-enforced recovery-purpose restrictions and any narrow persistence needed for that authority, confirmation/recovery/password-notification templates and local settings, password-specific hosted-dev setting/rollback plan and actual bounded rollout proof, existing-code-account transition, Account password services and meaningful tests. Out of scope: Google provider setup, deferred Apple work, final branded views, custom password hashing/storage, general account merging, new infrastructure, production rollout and unrelated schema changes.

## Expected behavior and edge cases

2026-10-17 later request: [DEV0325](../../archive/backend/DEV0325-collect-registration-names-and-unique-username.md) supersedes name-only enrollment for new accounts with required canonical unique username, private full name and display name; the chosen display name initializes chat presentation. Existing identities/data and deferred username login/URLs are retained.

2026-10-17 later user request: completed [DEV0324](../../archive/frontend/DEV0324-default-authentication-return-to-home.md) changes the shared no-destination fallback to Home (`/`). Explicit internal returns and required verification/profile/coach/recovery continuations keep priority; already-issued email flows retain their saved destination.

New email/password registration requires email proof before an application profile or protected authority is granted. Returning password login sends no routine code. Recovery gives generic request outcomes and accepts only valid provider-issued ownership proof for the exact account; expired/used links recover safely. Existing passwordless users can set a password on their exact Auth subject and retain profile, coach status, bookings, media and messages. Ordinary navigation must not escape recovery before password update. Preserve existing sign-in query/return semantics and server-derived permissions.

## Assumptions, decisions, and dependencies

Implement the adopted [password/email policy](../../../docs/mvp-spec.md#412-password-email-verification-and-recovery), [routes/returns](../../../docs/mvp-spec.md#413-routes-profile-completion-and-returns), [sessions/Account settings](../../../docs/mvp-spec.md#414-sessions-account-security-and-environments) and [Auth interfaces](../../../docs/mvp-spec.md#415-application-authentication-interfaces). The user-confirmed minimum is 8 characters with no mandatory mixture; the earlier 15-character proposal is superseded. Supported verified same-email linking preserves the original account; separate-account merging stays excluded.

DEV0287 consumes this peer's shared session/callback interface; DEV0288 supplies the views and small Account security integration. At planning time local signup confirmation was disabled and only a code template existed. This continuation enables local confirmation/recovery/notification and records real proof below; hosted settings remain unverified. Check hosted capability for breached-password protection and the 30-day refresh-session time box; document the one-hour issued-token revocation bound and verify current-password/fresh-email-proof requirements. The later user-directed DEV0322 change removes code login before UAT; retain verified password setup for existing accounts without resetting accounts or dataset state. On 17 October the user subsequently requested committing the contract and starting implementation. The preceding sequencing hold is lifted for authentication work; external/provider readiness and acceptance evidence still require verification.

This is one direct peer under a flat coordination record. Dependencies do not create child tickets. Record material scope/behavior changes before implementation and split/consolidate through the repository policy if this boundary proves too broad. Ready is not an additional approval gate.

## Implementation plan

1. Inspect installed framework/Auth docs and agree common callback/session interfaces with provider/UI peers.
2. Implement narrow password/signup/recovery and verified-email authority gates, preserving stable Auth/profile identifiers.
3. Configure and validate local confirmation/recovery templates, provider password policy and supported redirects; update the guarded email rehearsal.
4. Prove real passwordless-user setup and recovery locally, document exact hosted-dev changes/rollback, then perform bounded authorized dev rollout and record evidence.

### Initial implementation sequence — 17 October 2026

The user authorized implementation after the documentation checkpoint `1314f20`. First establish the application-owned operation/event/result contract and shared Unicode/byte-aware password validation, move existing email-code/sign-out/event SDK calls behind a browser Auth adapter, and implement password signup/login primitives there. Keep the delivered email-code flow compatible during this foundation change; its existing auto-creation is removed when the new registration entry is integrated, before final acceptance. A browser probe found the email field accepted input before React handlers were ready while submission was still disabled: align both controls with canonical hydration readiness and validate the no-JavaScript and interactive cases. No recovery entry is enabled until its server restriction is implemented and proven. Provider account administration and redesigned views retain their existing peer ownership.

Concrete initial interfaces: `AuthenticationGateway` in `src/auth/gateway.ts` owns `requestEmailCode`, `verifyEmailCode`, `registerWithPassword`, `signInWithPassword`, `signOut` and `subscribe`; operations return bounded application statuses/message keys, never SDK users, sessions, errors or tokens. `createAuthenticationGateway(adapter, readVerifiedSession)` requires the existing server session endpoint to verify the same email before a login reports success; SDK success alone is insufficient. The browser adapter alone maps vendor calls/events, and feature/session consumers use this application contract. Shared `validateNewPassword` preserves input while enforcing eight Unicode characters and the 72 UTF-8-byte ceiling; sign-in accepts the original nonempty password without imposing new-password policy on legacy credentials. Callback/recovery, hosted settings, templates, existing-only transition and final flow evidence remain subsequent DEV0286 work, not completed by this first step.

### Server implementation continuation — 17 October 2026

The user authorized continuing the real signup/recovery slice. Implement one same-origin bounded JSON operation endpoint, with server-only Supabase operations and application-owned results. The browser adapter becomes HTTP transport plus SDK refresh/event integration; it cannot register/login/reset directly. Persist hashed email-flow secrets and browser bindings with server-owned purpose, one-hour expiry, single-use consumption and atomic per-email/purpose 60-second request spacing. Email callback credentials travel in the URL fragment, are removed before submission and are sent only in POST bodies; a GET/scanner does not consume the proof. A callback's supplied purpose cannot override the stored action. Missing original-browser binding recovers by requesting a fresh email in that browser.

A narrow application session registry binds a server-verified Auth subject/session ID to ordinary versus recovery-only authority. Unknown/provider-only sessions have no application access; recovery-only sessions cannot enroll profiles or access private APIs. Password reset/change revokes all application grants and provider refresh sessions before returning to ordinary sign-in. Current-password change verifies the exact original account independently before update. Provider/account identity and application data stay unchanged. Session grants expire within 30 days (recovery within one hour) and cannot be extended by replaying grant creation. Managed Auth-session deletion removes its application grant. Existing browser sessions require one fresh sign-in after this authority migration; existing accounts/profiles/data are preserved.

Password mutations serialize per account in a bounded database transaction, recheck live authority inside that lock, and record a credential-change timestamp from managed Auth. Managed sessions created before that timestamp cannot acquire or retain application grants, including a password login racing with reset. Provider logout runs after the application transaction commits to avoid foreign-key cascade deadlocks; it is also attempted after any acknowledged password update if later persistence fails.

Local continuity discovery: Supabase admin-created/passwordless email identities may already have an opaque generated password hash. Hash presence does not establish a user-configured password. Add a small application password-method marker, set by actual password registration, acknowledged password update or successful password login, while still checking that managed Auth has a hash. Existing code/Google accounts without that evidence offer verified password setup. This stores no password/hash and does not grant identity authority. Migration `20261017000900` owns this correction; earlier applied forward migrations remain unchanged.

DEV0288 owns the functional route/forms integration, including callback confirmation, password/reset screens and profile continuation; it may start once these concrete interfaces are written, while final provider integration/proof remains pending. DEV0286 owns the backend, local configuration/templates, SQL/authorization tests and guarded local rehearsal. Local Auth restart applies configuration without resetting data. Do not change hosted configuration until actual project/capability/readiness and rollback are inventoried; missing hosted evidence keeps the ticket open.

## Acceptance criteria

- [x] AC1: Real new signup remains unauthorized until confirmed email and the adopted minimal presentation-name completion; returning password login restores the same actor/roles without copying provider names into private legal-name fields.
- [ ] AC2: All password-setting paths enforce the adopted 8-character/no-mixture rules, including 7/8-character, spaces, Unicode and provider-byte-limit cases. One-hour/single-use proofs, 60-second resend spacing, generic unknown/duplicate/credential outcomes, provider rate limits and expired/used proofs pass without enumeration or secret logging. Recovery is restricted on the server until update; successful reset/change sends notification, revokes global refresh sessions and returns to sign-in, with old-password rejection and the documented access-token denial bound proven on a second session.
- [ ] AC3: Actual existing passwordless and Google-first fixtures set a password on the exact original subject/profile with representative private data unchanged; duplicate retries create no replacement account. The former code path is retired under DEV0322; existing passwordless accounts retain verified password setup without creating a replacement identity.
- [ ] AC4: The shared route/callback/session/return interfaces and current-device sign-out pass meaningful authorization tests; local and exact hosted-dev confirmation, password, email notification, breached-password/session capability, timing and rollback settings are documented and validated. A missing hosted capability stays a blocker rather than a false policy pass.
- [x] AC5: Auth SDK calls and vendor session/event/error types are confined to documented Auth adapters; feature views consume application-owned operation/session/results. Boundary and behavior tests prove unsupported/unavailable/expired/wrong-identity outcomes remain truthful and protected actors cannot bypass verification.

## Validation plan

Extend and run npm run test:auth against guarded local Supabase/Mailpit with tagged new/existing accounts. Verify email confirmation denial on the server, reset then old-password rejection, identity/data fingerprints and cleanup; identify deterministic expiry/rate-limit fixtures separately. Run relevant unit/server/database authorization checks, lint, typecheck and build. Record actual hosted-dev confirmation/login/recovery smoke; no local result substitutes for required hosted evidence.

## Implementation record

### Changes and rationale

#### Working password-flow continuation — 17 October 2026

Implemented real password registration/login, browser-bound email confirmation, existing-account-only code fallback, recovery/password setup and current-password change through one same-origin bounded operation API. New signup has no actor until email confirmation and minimal presentation-name completion. The original Auth subject/profile is retained. Password reset/change returns to ordinary sign-in, revokes application grants and managed refresh sessions globally, and sends the configured notification. Ordinary sign-out affects the current device only. Real recovery sessions cannot read Account/private actor data, enroll a profile or switch to ordinary login before reset/sign-out.

The application session registry checks a live managed session on every verified application request, with an ordinary/recovery purpose and bounded expiry. Credential fences deny a session created before a password change even if grant creation races with reset. Password mutations serialize per account; provider logout happens after the application transaction commits to avoid deletion-cascade deadlocks. Fresh login replaces the previous device grant. Older browser reads cannot overwrite a later recovery/login/logout state. Generated provider hashes are distinguished from actual configured-password evidence; otherwise a legacy code account incorrectly displays Change password.

Email flow IDs, browser bindings and email addresses are hashed in the database. The server owns purpose, expiry, continuation and atomic resend/consume checks. Proofs are removed from the URL fragment before explicit POST submission; scanner GETs consume nothing. Unknown/duplicate addresses and invalid credentials use bounded generic results. The shared adapter translates errors and the browser only sends application commands; no feature imports the Auth SDK.


#### Historical foundation checkpoint `9c755a1`

2026-10-17 initial foundation: replaced direct SDK calls in the delivered login screen and session provider with an application-owned gateway. Added password registration/login primitives, common new-password validation and bounded error/event mapping. Email-code and password login only report success after the existing server endpoint verifies the expected email; mismatch or unavailable server verification clears the attempted device session and returns a safe failure. Server actor/profile permission checks remain authoritative. No password/Google screen or recovery entry is advertised by this step.

Browser validation found an initial-render timing problem: the email field could accept text before React attached its input handler, although the submit button still awaited hydration. The field now uses the same canonical/hydrated readiness condition as submission. The no-JavaScript server render keeps both disabled, and desktop/mobile keyboard probes wait for readiness before entering the email.

Code request defaults to existing accounts. At that checkpoint the code-only screen explicitly retained legacy creation until the new registration flow is wired; AC3 is therefore still open. New signup primitives return a generic acknowledgement for new/duplicate addresses and reject an unexpected auto-confirming session rather than treating environment misconfiguration as a passed confirmation policy. This is unit/SDK-transport coverage, not actual signup readiness.

### Affected files

Continuation file map:

- [Server operations](../../../src/server/auth/supabase-operations.ts), [session verification](../../../src/server/auth/session.ts) and [Auth repository](../../../src/server/db/auth/repository.ts): managed operations, authority/recovery gates, password serialization and provider-specific reads.
- [Operation route](../../../src/app/api/auth/operations/route.ts), [method status](../../../src/app/api/auth/methods/route.ts), [command/result parser](../../../src/auth/operations.ts) and [browser adapter](../../../src/auth/client/supabase-auth-adapter.ts): bounded same-origin POST, private method presentation and application-owned HTTP/events. [Session refresh](../../../src/auth/client/session-refresh.ts) prevents stale responses from restoring authority.
- Forward migrations [007](../../../supabase/migrations/20261017000700_application_auth_sessions.sql), [008](../../../supabase/migrations/20261017000800_auth_credential_fences.sql) and [009](../../../supabase/migrations/20261017000900_application_password_methods.sql): forced-RLS flow/session/fence/method records and restricted functions. Existing Auth/profile/private data is preserved.
- [Local Auth config](../../../supabase/config.toml), [confirmation](../../../supabase/templates/confirmation.html), [recovery](../../../supabase/templates/recovery.html), [password notification](../../../supabase/templates/password-changed.html), [operations/rollback guide](../../../supabase/README.md#password-authentication-rollout) and root README: local settings, captured email and explicit hosted readiness/rollback procedure.
- [Real rehearsal](../../../scripts/rehearse-local-email-auth.mjs), [DB checks](../../../tests/database/application-auth.test.ts), focused Auth unit/server tests and [shared local fixture helper](../../../scripts/lib/local-connection-rehearsal.ts): real password/continuity proof and regression adaptation through the application login API. Broader pinned hosted/disposable rehearsals still need DEV0289 integration; raw SDK tokens alone no longer grant application authority.
- DEV0288 owns the routes/forms, branded styles, public shell integration and Account view controls listed in its peer record.


Historical foundation file map (some modules are refined by the continuation above):

- [Password policy](../../../src/auth/password.ts): eight Unicode code points, maximum 72 UTF-8 bytes, preserved spaces/case/normalization, and malformed Unicode rejection; existing-password sign-in does not apply the new-password minimum.
- [Gateway contracts and operations](../../../src/auth/gateway.ts): vendor-independent results, input validation, exact-address/server verification, local sign-out and application event subscription. [Browser composition](../../../src/auth/client/authentication-gateway.ts) supplies the adapter and verified session reader.
- [Supabase browser adapter](../../../src/auth/client/supabase-auth-adapter.ts): single cached SDK client, concrete operations, generic duplicate/unknown responses, safe failures and mapped events. Replaces the removed `src/auth/client/browser-client.ts`; callers cannot obtain its SDK client. [DEV0102](../../archive/backend/DEV0102-clarify-auth-service-unavailability.md) receives path maintenance for that moved diagnostic/client responsibility and its pre-existing stale architecture-section anchor; historical behavior/evidence is unchanged.
- [Session reader](../../../src/auth/client/session-client.ts), [session provider](../../../src/auth/client/session-provider.tsx) and [existing sign-in screen](../../../src/features/auth/sign-in.tsx): use application contracts and the existing server-verified session route without importing SDK types or invoking vendor operations.
- [Gateway behavior tests](../../../tests/authentication-gateway.test.ts), [installed-SDK transport tests](../../../tests/supabase-authentication-adapter.test.ts) and [boundary tests](../../../tests/boundaries.test.ts): password, identity, failure/privacy and source-dependency checks.
- [Specification](../../../docs/mvp-spec.md#414-sessions-account-security-and-environments), [COR0027](../organisatory/COR0027-login-registration-and-social-authentication.md), current peers and [index](../../README.md): record the authorized implementation start and exact remaining work. Independent Home/marketplace changes are preserved.

Remaining at the historical `9c755a1` checkpoint: server callback/recovery authority, local Auth configuration/templates, Account password services, real continuity proof and hosted readiness. The continuation above delivers the local parts; only its explicitly listed remaining evidence is current.

### Decisions and deviations

2026-10-17 later user decision: remove email-code login now, superseding the previously planned through-UAT fallback. [DEV0322](../../archive/backend/DEV0322-remove-email-code-login.md) owns this application/contract change. Earlier code-login evidence below remains historical; confirmation and recovery email links remain required.

2026-10-17 implementation start: the user explicitly requested committing and implementing after checkpoint `1314f20`; this supersedes the earlier sequencing hold. Delivered browser behavior is migrated through the gateway first, before the new UI consumes its password primitives. No recovery action is enabled before server restrictions exist. A successful browser SDK operation is checked against the existing server endpoint before it becomes application success. SDK rate-limit errors expose no verified retry duration, so the result uses `retryAfterSeconds: null` and generic wait guidance instead of inventing a countdown. Weak-password provider errors are bounded input failures, with no raw provider response.

2026-10-17 scope amendment under DEV0311: Google is the only initial social provider; Apple account/setup/integration is independent deferred DEV0312 and cannot block password/shared-session work. Existing password, verification, identity, recovery/session and provider-boundary requirements remain. Runtime is still Draft.

2026-10-17 contract alignment under DEV0285: updated this peer's scope/criteria to consume the adopted specification, including the confirmed 8-character/no-mixture policy and its relevant linking, profile, recovery/session, route and Account boundaries. This is documentation alignment only; runtime remains Draft/on hold and all implementation acceptance evidence is pending.

2026-10-17: Created as a fresh direct peer when retired DEV0283 expanded from presentation to password and Google/Apple authentication. No runtime implementation deviation; confirmed method choices are distinct from proposed implementation details.

### Contracts, configuration, and operations

Continuation: adds `/api/auth/operations` (closed POST commands), `/api/auth/methods` (private GET), `recovery-required` session/result states and bounded continuation results. No dependency, app secret or environment-variable addition. The runtime gets only the new bounded SQL functions, not direct Auth/password/table access. Local Auth has confirmation, 8 characters/no mixture, secure password change, 60-second send spacing, one-hour proof/JWT expiry, 30-day session time box and password notification enabled. Breached-password protection is a hosted capability to verify; it is not implemented by local minimum/length checks. Only the existing loopback services received migrations/restart/config changes. Existing browsers require one fresh login; existing profiles/data are not recreated.

Migrations were rehearsed in rollback-only transactions before applying locally. Keep the additive tables and shared session guard for rollback; do not revert to pre-registry authorization while recovery tokens can exist. The operations guide records maintenance/revocation requirements and the fact that code rollback does not restore an old password. No hosted migration, setting, email delivery, Google setup or deployment occurred.

Historical initial gateway checkpoint `9c755a1` (before this continuation):


New internal TypeScript interfaces and modules only; no HTTP endpoint, schema, dependency, environment variable, Auth setting/template or deployment changes in this initial step. The old browser-client module is removed after migrating its two consumers. `AuthenticationResult`/`AuthenticationEvent` are application shapes; adapter-local SDK types stay private. The browser still uses the configured Supabase public client and existing server verification. Password registration primitives target future `/auth/confirm`, but that route and visible password registration are not delivered yet.

Local browser validation used only the existing reserved `hoang@users.movx.test` identity and captured Mailpit email, created two device sessions and signed both out. No account/profile/private data was created or edited; no hosted service or external email/account/provider administration was used. Source rollback is the inverse of this gateway change; there is no database/configuration rollback in this step.

## Validation results

#### Password-flow continuation — 17 October 2026

- `npm run test:auth`: **passed all seven real Auth/Mailpit phases**. New signup is denied before confirmation/profile; wrong browser/purpose/replayed proofs fail; returning login keeps the exact subject/profile; desktop/mobile keyboard entry and current-device logout work. Recovery denies Account/profile/ordinary login, successful reset/change ends both devices, old passwords fail, the second device cannot refresh its old managed session and password-change mail arrives. Wrong current password preserves the session. A legacy code account sets a password with exactly one concurrent reset winner, retaining exact subject/profile, private personal details, private avatar bytes and a real inquiry/message. Unknown code requests create no Auth user; duplicate registration remains generic. The real shared per-address email-send cooldown was allowed to elapse, without disabling provider limits. Final evidence: ignored `tmp/email-auth-rehearsal/dev0286-99dfefc9-14ec-46b1-88cd-dd96a0cee1ea/result.json`, desktop/mobile screenshots and private recovery manifest. Exact new Auth/profile/account/message/Storage fixtures were removed; all 15 pre-existing profile fingerprints were preserved. Mailpit retains local captured test mail. This is local proof, not Google or hosted proof.
- `DATABASE_TEST_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres node --import tsx --conditions=react-server --test tests/database/application-auth.test.ts`: 5 passed. Covers browser/purpose/expiry/one-use constraints, per-purpose cooldown, role privileges, subject/session mismatch, recovery-upgrade denial, non-extending/expired grants, credential fences, managed-session cascade, concurrent resend/consume and generated-hash/method-marker privacy. Rollback-only migration probes for 007/008/009 passed before local `supabase migration up --local`; no reset was used.
- Whitelisted nonsecret running-container settings verified: minimum 8/no required mixture; `MAILER_AUTOCONFIRM=false`; secure password change; 3600-second JWT/OTP; `SMTP_MAX_FREQUENCY=1m0s`; `SESSIONS_TIMEBOX=720h0m0s`; password notification enabled with the custom template/subject. Hosted paid/session/breach capability is unverified.
- `npm test`: **241 unit + 27 server tests passed (268 total)**. Includes closed command/results, secret-free HTTP, invalid-origin/body/forged-authority guards, revoked-session versus outage distinction, stale-response denial and SDK boundaries. `npm run lint`, `npm run typecheck`, `npm run format:check` passed. Production build/visual evidence is shared with DEV0288 and recorded there.
- Resolved findings: revoked managed sessions initially appeared unavailable and now return signed-out; generated passwordless hashes initially appeared as user-set passwords and now require explicit method evidence. Test corrections included exact current response/notification contracts, scoped alerts, respecting provider cooldown and plain-array comparison of PostgreSQL results. Restarting the old Next dev process discovered new route files. An interrupted probe was cleaned using only its exact private account manifest; evidence now stays outside Playwright's cleared output directory. None of these failures was counted as passing evidence before correction.
- Final exact cleanup recovery command was rerun idempotently against the passing run manifest, including its known hash-only request fixtures; pre-existing profiles remained unchanged.
- Still required: actual hosted-dev ledger/settings/SMTP/templates/session/breach/rollback validation; Google-first and same/different-provider identity cases with real Google; wider representative coach approval/request/booking continuity and combined UAT proof under DEV0287/DEV0289. No actual 30-day waiting/native hosted expiry test or independent review is claimed.

| Criterion | Continuation evidence | Result |
| --- | --- | --- |
| AC1 | Real local confirmed signup, name completion and returning exact identity/actor pass. | Passed locally |
| AC2 | Local password boundaries, purpose/expiry/resend, generic results, restricted recovery, notification, old-password rejection and two-device access/refresh denial pass; hosted breach/session capability remains. | Partial |
| AC3 | Real existing code account preserves exact identity/profile/private details/avatar/message; real Google-first/combined private booking/approval continuity remain. | Partial |
| AC4 | Local routes/session/returns/current-device logout and actual settings pass; exact hosted readiness/rollback evidence remains. | Partial |
| AC5 | Server/browser SDK boundaries, closed results/events, wrong identity/session/outage/recovery behavior pass. | Passed |

Historical initial gateway evidence follows:


- Date/environment: 2026-10-17, Node 24.21.0, installed Next 16.3.8, Supabase JS 2.116.0 and SSR 0.12.7. Read the bundled Next route-handler/cookie guides and installed SDK signup/password/session implementations before edits, alongside the official [SSR guide](https://supabase.com/docs/guides/auth/server-side/creating-a-client) and [password guide](https://supabase.com/docs/guides/auth/passwords).
- `node --import tsx --test tests/authentication-gateway.test.ts tests/supabase-authentication-adapter.test.ts tests/auth.test.ts tests/boundaries.test.ts`: 24 passed. Covers 7/8 characters, Unicode versus byte limits, all-spaces/preserved secrets, malformed inputs, legacy short-password sign-in, default existing-only code requests, explicit legacy mode, generic duplicates, wrong identity, required server verification, rate/weak-password/transport errors, local sign-out and subscription cleanup. Installed-SDK tests use synthetic HTTP responses, not real password/provider accounts.
- `npm test`: 239 unit tests and 25 server tests passed (264 total). `npm run lint` and `npm run typecheck` passed.
- `env DATABASE_URL= NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= NEXT_PUBLIC_SITE_URL= NEXT_PUBLIC_GEOAPIFY_API_KEY= npm run build`: passed the production public-preview build without hosted data access. Concurrent independent Home changes were present; this result does not assign their ownership to this ticket.
- `node /tmp/dev0286-gateway-browser-smoke.mjs`: final actual local Auth/Mailpit browser checks at 1440×1040 and 393×852 passed, including keyboard email submission, fresh code verification, invalid/replayed code denial, stable original subject/email, no horizontal overflow and server-confirmed current-device sign-out. A JavaScript-disabled context also verified the email field stays disabled before hydration. The probe refused non-loopback Auth requests and used only the existing local fixture. Screenshots are under ignored `test-results/dev0286-gateway/legacy-1440.png` and `legacy-393.png`. Repeated after gateway server-verification and input-readiness changes.
- `python3 /tmp/dev0286-validate-handoff.py`: 8 scoped documents, 432 links, 58 anchors and 233 unique records passed; DEV0286 remains In progress with unchecked criteria and other runtime peers remain Draft. Focused `node_modules/.bin/prettier --check` and scoped `git diff --check` passed.
- Resolved validation failures: initial `tsx` execution hit sandbox IPC restrictions; `node --import tsx` and the permitted full `npm test` run succeeded. An SDK fixture omitted its API-version response header and failed duplicate-error decoding; correcting the fixture to the installed SDK/server contract resolved it. Combined browser probes sometimes entered the email before handlers were ready and timed out with “Enter a valid email address”; aligning field/submission readiness and waiting for that condition produced the final passing desktop/mobile/no-JavaScript run. The historical DEV0102 architecture anchor was repaired during scoped link checks. One automatic approval review timed out; the permitted retry succeeded. None of these checks establishes real password/Google readiness.
- Not run: real new password signup/confirmation, passwordless/Google-first password setup, reset/change/two-device revocation, actual resend/expiry/session/breached-password configuration and hosted-dev password/Google flows. No SQL migration changed; database migration tests are not applicable to this initial code-only boundary change.

| Criterion | Evidence and remaining work                                                                                                                                                                           | Result  |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| AC1       | Signup/login primitives and server-success check tested synthetically; real confirmation/profile and returning password flow remain.                                                                  | Partial |
| AC2       | Shared password boundaries and bounded errors tested; actual settings, recovery restriction, notification and revocation remain.                                                                      | Partial |
| AC3       | Gateway defaults existing-only, while the delivered legacy screen explicitly preserves creation pending registration cutover. Real password setup/data continuity remain.                             | Partial |
| AC4       | Actual legacy device sign-out and existing server verification passed desktop/mobile; callback/recovery/configuration/hosted proof remain.                                                            | Partial |
| AC5       | Browser SDK confinement, application results/events, server verification and unavailable/wrong-identity tests passed; new provider/recovery operations must preserve this boundary as they are added. | Partial |

## Risks, limitations, and follow-ups

Local password/confirmation/recovery/setup/change flows are implemented and genuinely rehearsed; the ticket remains In progress because hosted readiness and real Google-first continuity are not proven. Next inventory the actual hosted-dev ledger, SMTP/templates and paid session/breach capabilities, then perform the bounded rollout/rehearsal with preserved data. DEV0287 owns Google credentials/callback/real linking, DEV0288 final provider/UI completion and DEV0289 combined UAT plus broader rehearsal adaptation. New application authorization rejects raw provider-only/old pre-cutover sessions; existing users need one fresh login. Apple remains deferred. No production or independent review is claimed.

## Completion and review references

- Completed: Not completed.
- Commit: Auth contract checkpoint `1314f20` owns DEV0285/DEV0311. Initial gateway checkpoint `9c755a1`; this DEV0286/DEV0288 continuation owns the working password flows and remains partial against hosted/provider criteria.
- Review: Implementation self-review and actual local flow/DB/browser validation above; no independent or hosted/provider review.
- Deployment or release: None.
