# Ticket DEV0287: Integrate Google authentication

- Status: Blocked
- Created: 2026-10-17
- Last updated: 2026-10-19
- Milestone: Authentication quality before user acceptance testing (UAT)
- Coordination: [COR0027 — Login, registration and social authentication](../organisatory/COR0027-login-registration-and-social-authentication.md)
- Related records: Scope amendment [DEV0311](../../archive/organisatory/DEV0311-defer-apple-from-initial-authentication-rollout.md); independent deferred Apple [DEV0312](DEV0312-integrate-deferred-apple-authentication.md). Direct peer/dependency boundaries and external consumers are mapped by COR0027. Historical identity foundations: [DEV0046](../../archive/backend/DEV0046-email-otp-registration-and-application-profiles.md) and [DEV0147](../../archive/backend/DEV0147-separate-client-onboarding-and-verified-coach-access.md).

## Objective and context

Enable real Google web authentication through the existing managed Auth boundary, with one authorized MovX identity and compatible onboarding/return behavior.

Use the current [registration contract](../../../docs/mvp-spec.md#41-register-as-an-athlete-or-apply-to-coach), [identity/privacy rules](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity), [definition of done](../../../docs/mvp-spec.md#11-definition-of-done), [milestones](../../../docs/mvp-spec.md#12-delivery-milestones) and [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix). The local password-first flow is implemented; DEV0322 removes the former email-code fallback at the user’s request. Real Google and hosted/combined UAT readiness remain pending.

## Scope and non-goals

2026-10-18 frontend completion boundary: the user explicitly confirmed closing DEV0288 with Google clearly unavailable while keeping activation and UAT sign-off open here and in DEV0289. This ticket owns the remaining provider-specific UI wiring: replace the disabled state only when the real gateway operation/readiness and callback exist, reuse DEV0288's branded controls and accessible feedback, then prove actual Google success/cancel/failure. It must not enable a cosmetic button or export SDK types into the view. DEV0288's completion does not establish Google readiness.

Provider-boundary refinement, 17 October 2026: implement Google operations inside the Auth adapter interface owned by DEV0286. Translate provider errors/results there; do not introduce SDK calls or provider claim types into feature views, business services or the domain layer. Apply the same verified identity-resolution contract across every login method.

In scope: Google provider configuration, narrowly scoped callback integration using the shared session foundation, provider readiness/results for the UI, same/different verified-email cases, missing-name fallback, denial/cancellation/retry, hosted-dev setup/rotation/rollback guidance and real provider proof. Out of scope: password/recovery implementation, application-profile redesign, custom OAuth/identity storage, arbitrary account merging, extra provider data scopes, deferred Apple setup/UI/proof, native app SDKs, new projects and production deployment.

## Expected behavior and edge cases

Continue with Google creates or recovers a provider-verified account and then follows ordinary minimal-profile/onboarding/coach authority. Repeated provider login uses the same subject/profile. Provider cancellation and callback failure return useful recovery without false sign-in. Apply DEV0285’s reviewed linking policy; never merge different-email accounts by matching names or treating an Apple relay as the invited address. No provider profile metadata grants coach roles or replaces a private avatar automatically.

## Assumptions, decisions, and dependencies

Use the adopted [same-email/relay policy](../../../docs/mvp-spec.md#411-methods-and-account-resolution), [name/route/return contract](../../../docs/mvp-spec.md#413-routes-profile-completion-and-returns) and [application Auth interface](../../../docs/mvp-spec.md#415-application-authentication-interfaces), then integrate against DEV0286's common session interface. Same verified-email linking restores the original identity; different addresses/Apple relay remain separate. Manual provider connection/removal and merging separate MovX accounts are excluded. Existing names/settings/private media are never overwritten from provider metadata.

Google requires Cloud/Auth client/consent configuration, appropriate test audience and exact allowed origins/redirects. Apple account/setup, signing/renewal and integration are deferred to independent [DEV0312](DEV0312-integrate-deferred-apple-authentication.md) and do not block this peer. Missing provider credentials/approvals are explicit blockers, not grounds for fake working buttons. Supabase is the adopted implementation default. The user authorized starting Auth implementation after checkpoint `1314f20`; DEV0286's gateway/password foundation is In progress. The shared gateway/session foundation is now usable. On 18 October the user authorized continuing this peer; Google account/client configuration is unknown (user answered “Not sure”). Coding can proceed independently; real provider and hosted proof remain blocked until configuration and controlled test accounts are available. No provider administration has been performed.

This is one direct peer under a flat coordination record. Dependencies do not create child tickets. Record material scope/behavior changes before implementation and split/consolidate through the repository policy if this boundary proves too broad. Ready is not an additional approval gate.

## Implementation plan

1. Inspect official Google and installed Supabase docs; inventory required owned credentials, test users, origins, callbacks and Google consent/branding readiness without exposing secrets.
2. Prepare exact local/hosted-dev provider setup and rollback, minimal scopes and tested readiness interface.
3. Implement supported web provider flows/callback integration and ordinary server verification/onboarding; wire actual provider readiness/start/results into the existing branded login/registration views, and handle absent names, provider errors and unsupported Apple requests. Follow the current required registration fields in specification section 4.1.3; do not revive the superseded name-only form.
4. Prove Google new/returning/cancelled flows with controlled accounts, same/different-email linking and return cases and private-data continuity; record environment gaps accurately.

### 2026-10-19 commit recovery

The user requested committing before Google account/provider setup. The earlier `/private/tmp/movx-dev0287-google-auth` directory is missing; Git retains only its branch/base and stale worktree metadata, not its uncommitted source. A read-only search found no remaining source/patch backup. Preserve the 18 October checks as historical evidence; they cannot certify reconstructed source bytes.

Before committing, reconstruct the bounded Google implementation from the recorded patches in a new isolated checkout, rerun unit/server tests, lint, formatting, typecheck and build, and record the new results. Keep the shared app/database and concurrent Events/public changes untouched. Commit the isolated runtime branch to durable Git objects, then commit only the Google setup/handoff and existing DEV0289 preflight documentation in the primary checkout using partial staging. Do not include unrelated public/Events edits, credentials or retained coach data. Live Google and mobile proof stay open; this checkpoint does not activate the provider, merge the runtime into main, or authorize provider administration.

### 2026-10-18 implementation continuation

Use an isolated worktree from checkpoint `e590da8` because Events/public-page edits, shared documentation and browser/database services are active in the primary checkout. Own only Auth gateway/adapter, provider routes, provider-focused tests, non-secret setup guidance and this record. Do not restart shared services, reset/seed databases, touch retained users or alter the concurrent Events/schema/storage files. Reconcile shared documentation by narrow patches when integration is ready; separate worktrees do not isolate a shared database or browser.

- Adopted implementation defaults: Google starts through an adapter-owned same-origin form POST so the server can set PKCE (Proof Key for Code Exchange) cookies and redirect without exposing vendor redirect URLs to views. The application command/result remains SDK-free. Reject cross-origin starts and caller-supplied provider/identity claims.
- Native validation refinement: strict Origin-only checking rejected the browser navigation POST. Browser referrer policies can produce `Origin: null` for form navigation (MDN Origin guidance); retain the no-referrer responses and handle that case narrowly. Permit this case only when browser-controlled `Sec-Fetch-Site` is exactly `same-origin`; missing/cross-site/same-site metadata with null Origin stays forbidden. Exact canonical Origin remains accepted, and an explicit foreign Origin is always rejected. Cover the combinations before applying the route adjustment. This replaces the initial strict-Origin-only implementation, which native Chrome rejected.
- Require both an explicit server activation flag and the managed Auth settings endpoint reporting Google enabled. Missing configuration/outages leave the branded control disabled; this technical availability check is not evidence of a completed live Google rehearsal.
- Bind each ten-minute continuation to a random browser cookie and callback value. Use the installed SDK's stable PKCE support, with an isolated server-only Google verifier cookie; the newest browser flow replaces the older flow. Callback cancellation/failure returns bounded notice copy and a sanitized continuation, never provider error text or proof values. Recovery-purpose and changed-browser-session flows cannot become ordinary sessions through an old callback.
- Reuse existing server verification, application session grants and profile/coach routing. Google metadata does not write profiles, names, avatars, usernames, roles or invitations. Managed Auth owns supported same-email linking; actual identity/data-continuity proof remains mandatory.
- Implement focused deterministic start/callback/authorization checks, run lint/typecheck/build, then inspect the disabled and failure UI in an owned non-seeding app. Leave live Google criteria open if credentials/test users are unavailable; do not report this ticket or UAT as complete.

## Acceptance criteria

- [ ] AC1: Google completes real web sign-in and first-time onboarding through server-verified confirmed-email sessions; new users complete the required unique username, private full name and display name form, with the optional picture step, and repeated login preserves original subject/profile, names/settings and coach approval without redundant confirmation emails.
- [ ] AC2: Provider denial/cancellation, missing display name, invalid callback/session and unavailable configuration recover safely without a false authenticated/ready state.
- [ ] AC3: Actual password-first then same-email provider login, provider-first then verified password setup, repeated provider login and different-Google-email cases match the adopted policy and preserve original private data. Unconfirmed/conflicting identities gain no protected authority; no arbitrary merge, invitation acceptance or expanded media/role permission occurs.
- [ ] AC4: Provider-specific settings, dev/prod separation, scopes, Google test/branding state and rollback are documented; meaningful automated checks and real hosted-dev provider smoke pass.

## Validation plan

Run focused provider/callback/session/authorization tests plus lint/typecheck/build. Rehearse actual Google with controlled test users on an allowed hosted-dev/UAT origin, including cancellation, repeat login, absent name, same verified email and a distinct Google email. Compare exact subject/profile/data before/after and distinguish real provider proof from mocked callback/error tests. Missing real Google evidence keeps the peer open; no Apple live evidence is required.

## Implementation record

### Changes and rationale

2026-10-17 scope amendment under DEV0311: the user deferred Apple account/setup and selected Google as the only initial social provider. Narrowed this existing ticket and renamed its file/title without changing its ID; future Apple ownership is independent DEV0312. Original three-method planning history below is retained. No runtime/provider operation occurred.

2026-10-18 preflight: core Auth files have no overlap with concurrent Events/public-page edits. Installed Next 16.3.8 route/cookie guidance and Supabase SSR 0.12.7 / JS 2.116.0 PKCE implementation were inspected alongside official Google/Supabase documentation. The three ignored local environment files expose no Google/OAuth variable names, and local Supabase config has no enabled Google block. This does not establish whether a Google client exists externally. No secret values were printed and no external setting/identity changed. Runtime implementation begins after the continuation plan above.

### Affected files

**Working-copy boundary, corrected 19 October:** the earlier `/private/tmp/movx-dev0287-google-auth` working copy is missing. Runtime changes are reconstructed on branch `dev0287-google-auth` in `/private/tmp/movx-dev0287-commit`, based on `e590da8`, and committed as `ebc36af` for the user-requested checkpoint. The reconstruction follows the recorded patches; byte identity with the missing source cannot be established. Runtime is still isolated from main and Google remains gated off. Primary-checkout changes are documentation/handoff only. New-file paths below describe this isolated branch until integration; the shared application keeps its existing runtime. A temporary workspace backup of the reconstructed source is retained under ignored `tmp/auth-presentation/dev0287/restored-source.tar.gz` until the commit is confirmed.

- [Application command/result](../../../src/auth/operations.ts), [gateway](../../../src/auth/gateway.ts) and [browser adapter](../../../src/auth/client/supabase-auth-adapter.ts): bounded `start-google` command and `redirecting` state; no vendor URL, claims or SDK types in views. New `src/auth/client/google-authentication.ts` owns readiness fetch and same-origin navigation POST transport.
- New `src/server/auth/google.ts`: managed settings/readiness, bound expiring continuation, Google SDK start/exchange, confirmed server identity verification, application session grants, previous browser-grant retirement and bounded failure destinations. It never creates/updates profile, username, private names, avatars, coach roles or invitation records; the existing services retain ownership.
- [Server Auth client](../../../src/server/auth/client.ts): isolated HttpOnly Google PKCE verifier cookie, ten-minute lifetime and existing ordinary session-cookie compatibility. New `src/server/auth/continuation.ts` extracts the existing routing behavior from [password/email operations](../../../src/server/auth/supabase-operations.ts) so both methods use the same Home/profile/coach decisions.
- New routes `src/app/auth/google/start/route.ts`, `src/app/auth/callback/route.ts` and `src/app/api/auth/google/route.ts`: bounded same-origin POST, code exchange/clean redirect and a public boolean availability response. Callback responses explicitly clear inherited fragments. The [credential JSON endpoint](../../../src/app/api/auth/operations/route.ts) keeps its strict Origin/closed-payload checks and does not start Google.
- [Auth page](../../../src/app/_auth/auth-page.tsx) and [screen](../../../src/features/auth/sign-in.tsx): activate the existing Google control only after availability, keep it disabled during navigation, and show allowlisted cancellation/failure/unavailable notices with email/recovery alternatives.
- [Next config](../../../next.config.ts) suppresses callback incoming-request URLs in development only; [.env.example](../../../.env.example) documents the false-by-default server flag. [Google setup](../../../docs/google-auth-setup.md) covers owned credentials, exact Google-versus-application callbacks, test audience/scopes, infrastructure query redaction and rollback. No populated environment file changed.
- New `tests/server/google-authentication.test.ts` covers provider readiness, nonce/expiry, recovery/session switching, failed/mismatched/unconfirmed proof, minimal scopes, previous-grant ordering, continuation sanitization and cross-origin/body violations. [Command tests](../../../tests/authentication-operations.test.ts), [presentation tests](../../../tests/authentication-presentation.test.ts) and [boundary guard](../../../tests/boundaries.test.ts) cover the new SDK-free interface, retry notices and exact provider adapter boundary.

### Decisions and deviations

2026-10-18 implementation: completed the independent code and deterministic checks in the isolated checkout. Native Chrome caught the strict-Origin navigation rejection; the narrowly bounded Fetch Metadata case above now passes native keyboard cancellation. The actual installed SDK protocol check also verifies cookie isolation. No live Google result is claimed. The newest browser flow replaces an older pending Google flow rather than opting into the installed SDK's experimental multi-flow API. The ten-minute continuation/Google verifier is separate from the existing one-hour email proof.

2026-10-17 later user decision: remove email-code login now, superseding the previously planned through-UAT fallback. [DEV0322](../../archive/backend/DEV0322-remove-email-code-login.md) owns this application/contract change. Earlier code-login evidence below remains historical; confirmation and recovery email links remain required.

2026-10-17 contract alignment under DEV0285: updated this peer's scope/criteria to consume the adopted specification, including the confirmed 8-character/no-mixture policy and its relevant linking, profile, recovery/session, route and Account boundaries. This is documentation alignment only; runtime remains Draft/on hold and all implementation acceptance evidence is pending.

2026-10-17: Created as a fresh direct peer when retired DEV0283 expanded from presentation to password and Google/Apple authentication. No runtime implementation deviation; confirmed method choices are distinct from proposed implementation details.

### Contracts, configuration, and operations

Isolated runtime API additions: application `start-google`/`redirecting`, navigation POST `/auth/google/start`, callback GET `/auth/callback`, availability GET `/api/auth/google` returning only `{ available: boolean }`, and allowlisted `notice=google-cancelled|google-failed|google-unavailable`. The credential JSON endpoint rejects starting Google through that transport. New server-only `MOVX_GOOGLE_AUTH_ENABLED` defaults false; a true gate still requires the managed settings response to enable Google. The public project URL/key/site origin remain the existing configuration. OAuth client secrets belong only to managed Auth/ignored local server configuration, never browser variables. Google flow and renamed verifier cookies are HttpOnly/SameSite=Lax, Secure on HTTPS, and expire after ten minutes. No schema/migration, package/dependency, populated credential, provider setting, user/media/history or email-template change occurred. Rollback is gate-off/provider-disable without deleting identities; hosting query-log redaction remains externally unverified. Shared-checkout integration and production rollout are separate pending steps.

## Validation results

19 October primary-checkout documentation checkpoint: four Auth/setup/coordination documents pass scoped formatting and **80 local link checks**; both current/index statuses are Blocked and all eight acceptance criteria remain open. `git diff --check` passes. The commit is restricted to seven Auth documentation paths; application checks are the separately validated isolated DEV0287 checkpoint, with no new main runtime change.

### 19 October reconstruction checkpoint

Reconstructed source was reviewed against the recorded gateway, callback, cookie isolation, required-profile routing and recovery behavior on the original `e590da8` base. Exact original source bytes cannot be recovered from Git because they were never staged or committed. This is a newly validated checkpoint, not a claim that the missing checkout was recovered byte-for-byte.

- `PATH=/Users/hoangdeveloper/.local/node/24.21.0/bin:$PATH npm test`: passed, **380 checks** (313 unit/presentation plus 67 server), zero failures. Includes nine Google readiness/start/callback/CSRF cases and the Auth SDK boundary guard.
- With the same Node 24.21.0 PATH, `npm run lint`, `npm run format:check`, `npm run build -- --webpack` and `npm run typecheck`: all passed. Build and type generation were serialized in the isolated checkout; no app process or database was started.
- Documentation checks passed: 101 repository links resolve; 2 existing ignored local-output links were excluded without reading credentials. `git diff --check` passes; staged paths are checked against an explicit Auth-only manifest before commit. Native desktop/mobile and the installed-SDK HTTP protocol rehearsal were not rerun; their 18 October observations remain historical only. Actual Google/provider/hosted operations are not run. All four acceptance criteria stay open.
- Runtime commit `ebc36af` durably preserves the isolated implementation on `dev0287-google-auth`. The shared app/database, concurrent runtime edits, retained users and populated environment files are untouched; main gets only setup, checkpoint/handoff and the existing DEV0289 preflight documentation.

### 18 October historical evidence

Historical 18 October evidence (original working copy now missing; not certification of reconstructed bytes), isolated checkout at `e590da8` plus DEV0287 changes, Node 24.21.0, installed Next 16.3.8 / Supabase SSR 0.12.7 / JS 2.116.0:

- Final `PATH=/Users/hoangdeveloper/.local/node/24.21.0/bin:$PATH npm test`: **380 passed** (313 unit/presentation, 67 server), zero failures. The first broad run found the new adapter missing from the architectural allow-list and a sandbox-denied tsx IPC pipe; the exact adapter boundary was registered and the existing synthetic startup test passed outside the sandbox. A new notice assertion initially expected `/messages` with no Auth config; corrected it to respect the existing Home fallback and reran the full suite successfully. No application check is waived.
- `npm run lint`, `npm run format:check`, `npm run typecheck`, and `npm run build -- --webpack`: **passed**. The build uses the isolated source, not the concurrent Events/public-page edits. No deployment or combined-checkout build is implied.
- Actual installed-SDK protocol rehearsal: `/Users/hoangdeveloper/.local/node/24.21.0/bin/node /private/tmp/dev0287-check-protocol.mjs`, using an isolated Next app on 3127 and local managed-Auth protocol fixture on 3128, **passed**. Its generated PKCE challenge matches the HttpOnly Google verifier; rejected exchange clears only Google flow/verifier, preserves a separate pending email verifier, retains safe coach/return context, emits no-store/no-referrer and an explicit empty fragment, and grants no application authority. This fixture has no users/credentials/database and is not Google success/linking proof. The initial cookie-deletion assertion was corrected to accept Next's epoch Expires representation. A build/dev cache collision caused one failed callback response; the owned test services/cache were restarted and the complete check passed. Final build and dev are serialized.
- Native Chrome, owned private window, desktop: observed disabled Google with unavailable managed settings, then enabled control after the isolated settings fixture reports Google. Shift+Tab from email visibly focused Google; Enter submitted the adapter POST, disabled duplicate controls, and the controlled denial returned to sign-in with “Google sign-in was cancelled. Try again or use email.” and preserved `/messages`. No Google account/credential was used. The initial Origin rejection was fixed and retried successfully.
- Remaining mobile/native review **not passed**: Chrome inspection became empty after trying responsive controls; reset/rebind did not recover it, Safari timed out and the native service ultimately returned “Sky Computer Use service startup request failed.” This is an explicit remaining validation gap. No alternative UI automation was used. The owned database-free services were stopped; private-window cleanup could not be confirmed after the native service failure.
- Documentation handoff checks: 128 local setup/ticket/coordination links resolve across both copies; four acceptance criteria remain open. `git diff --check` passes. The primary checkout retains 36 pre-existing concurrent files and 13 existing Auth/config/test files byte-for-byte at the starting checkpoint; its index remains empty. Temporary dependency symlink was removed from the isolated checkout after validation; recreate it to the primary `node_modules` or install the lockfile before resuming local checks.
- No database/Auth/Storage fixture or retained identity was changed. No shared service restart, seed/reset, provider administration, mail send or hosted operation occurred. Real Google success, same/different-email account continuity, Google-first password setup, consent/branding and hosted callback/logging checks remain **not run**.

| Criterion | Evidence and remaining requirement                                                                                                                                              | Result |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Server-confirmed proof/grant and shared profile routing deterministic checks pass; real Google success/onboarding and retained profile proof pending.                           | Open   |
| AC2       | Callback/readiness/security tests, actual SDK rejected exchange and native desktop denial pass; mobile/real-provider failure review pending.                                    | Open   |
| AC3       | Mocked identity mismatch/recovery/previous-grant checks pass; actual both-method orders, same/different email and private-data fingerprints require controlled Google accounts. | Open   |
| AC4       | Setup/rollback and automated checks delivered in isolation; external client/audience/settings and hosted real smoke remain unverified.                                          | Open   |

Historical planning validation, 2026-10-17: 11 documents, 377 local links, 52 anchors, retired IDs/reciprocal membership/index and formatting checks passed under DEV0285; those checks never established runtime acceptance.

## Risks, limitations, and follow-ups

Blocked for completion by unconfirmed Google Cloud/Supabase provider configuration and controlled real Google test accounts; the user answered “Not sure” about an existing client. The shared gateway foundation is usable and no longer a coding blocker. See [setup and access check](../../../docs/google-auth-setup.md#check-existing-access-first). Native mobile review is additionally incomplete after the service failure. Next: identify the owned existing Web application client/provider settings, configure/rehearse on the approved dev origin without exposing secrets, finish mobile review, then integrate the isolated change after the concurrent checkout/build work is safe. Keep Google gated off until configured. DEV0286 retains hosted password/SMTP/session capability readiness; DEV0289 retains combined UAT proof. Apple remains deferred to DEV0312. All four acceptance criteria remain open. No independent review, production readiness or live-provider success is claimed.

## Completion and review references

- Completed: Not completed.
- Commit: Planning record is in the earlier DEV0285 checkpoint; 19 October runtime checkpoint: `ebc36af` — `[DEV0287] Preserve gated Google authentication checkpoint` on `dev0287-google-auth`; main receives the setup/handoff documentation separately. No merge, push or runtime acceptance is claimed.
- Review: Implementation self-review against all four open criteria; no independent review.
- Deployment or release: None.
