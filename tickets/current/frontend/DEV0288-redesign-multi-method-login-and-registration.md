# Ticket DEV0288: Redesign multi-method login and registration

- Status: In progress
- Created: 2026-10-17
- Last updated: 2026-10-17
- Milestone: Authentication quality before user acceptance testing (UAT)
- Coordination: [COR0027 — Login, registration and social authentication](../organisatory/COR0027-login-registration-and-social-authentication.md)
- Related records: Direct peer/dependency boundaries and external consumers are mapped by COR0027. Historical identity foundations: [DEV0046](../../archive/backend/DEV0046-email-otp-registration-and-application-profiles.md) and [DEV0147](../../archive/backend/DEV0147-separate-client-onboarding-and-verified-coach-access.md).

## Objective and context

Build professional MovX login and registration views with email/password and Continue with Google, plus confirmation, recovery, existing-user setup and onboarding suitable for UAT.

Use the current [registration contract](../../../docs/mvp-spec.md#41-register-as-an-athlete-or-apply-to-coach), [identity/privacy rules](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity), [definition of done](../../../docs/mvp-spec.md#11-definition-of-done), [milestones](../../../docs/mvp-spec.md#12-delivery-milestones) and [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix). The local application now uses the implemented password-first flow below; real Google and hosted/combined UAT readiness remain pending.

## Scope and non-goals

Provider-boundary refinement, 17 October 2026: the finished screens consume DEV0286's typed application Auth gateway and DEV0287's provider operations. Remove the current sign-in screen's direct browser Auth client/SDK calls as part of wiring these views. UI tests use the gateway's application results rather than Supabase-specific errors or event types; authorization remains server-derived.

In scope: separate login/registration presentation, password manager/autofill and show/hide controls, provider controls, verification/resend, forgot/set password, existing-user setup, profile/coach continuation, accessible loading/error/ready states, public navigation/return integration and the focused Account → Login & security method/password/sign-out controls. Out of scope: owning provider credentials or Auth policy, duplicating password/callback services, new profile fields, deferred Apple controls/setup/proof, broader private-workspace/Account redesign, editable email, manual provider connect/disconnect, username login/URLs, invitations, fictitious endorsements and deployment.

## Expected behavior and edge cases

Login offers email/password plus Google. Registration offers email/password plus the same provider choices; social choices can create or recover the account through the managed provider and collect only any missing minimal profile. Returning users skip completed onboarding. Ordinary password login sends no code; verification/recovery and transitional password setup have distinct explanations. Existing /sign-in entries and sanitized return/coach intent remain compatible. Keep public browsing available and preserve explicit coach review. All states use product language, without terminal commands or environment/database instructions.

## Assumptions, decisions, and dependencies

Use the adopted [password/email policy](../../../docs/mvp-spec.md#412-password-email-verification-and-recovery), [route/name/return table](../../../docs/mvp-spec.md#413-routes-profile-completion-and-returns) and [Account/session interfaces](../../../docs/mvp-spec.md#414-sessions-account-security-and-environments), DEV0286 services and DEV0287 provider readiness. Labels describe the user-confirmed 8-character minimum without mandatory character mixtures. Signup requires no legal name, birthdate, gender or username; the existing presentation-name step remains separate and repeat logins preserve completed data. The committed DEV0295 Account model is the compatibility baseline, not a reason to reimplement name/username persistence here.

Adopt existing MovX brand, one focused primary form, quiet desktop support and a single-column phone layout; final visual/copy details stay within that contract. Email/password and Google are required for initial UAT; Apple is deferred and absent from active sign-in controls; unavailable provider states stay truthful. The user authorized implementation after checkpoint `1314f20`; this UI peer is In progress against DEV0286's implemented password/recovery interfaces, with DEV0287 provider readiness still pending. Screens cannot substitute a browser flag for DEV0286's recovery/verification gates.

This is one direct peer under a flat coordination record. Dependencies do not create child tickets. Record material scope/behavior changes before implementation and split/consolidate through the repository policy if this boundary proves too broad. Ready is not an additional approval gate.

## Implementation plan

1. Map final routes and every login/registration/confirmation/recovery/onboarding/error state to the adopted service contracts; update the specification for adopted presentation details.
2. Build shared branded forms and provider controls with narrow styles, password-manager support, clear pending/recovery and safe state clearing on identity changes.
3. Wire real services and return/onboarding transitions without duplicating authority or sending any scheduling/message/invitation mutation.
4. Review desktop/mobile/keyboard/zoom/error behavior and update meaningful UI/browser regressions; record screenshots and real-flow boundaries.

### Integration start — 17 October 2026

The user requested continuing signup/recovery implementation. Start functional branded routes against DEV0286's server operation/result and continuation contracts: `/sign-in`, `/register`, `/check-email`, `/forgot-password`, `/reset-password`, `/auth/confirm`, `/complete-profile` and focused Account password controls. Reuse MovX components/styles. Callback proof stays in a removed URL fragment and POST body; loading the page alone consumes nothing. Email-code fallback becomes existing-account-only with an explicit entry. Retain coach intent/safe returns and collect the existing presentation name only. Google controls remain truthfully unavailable until DEV0287 supplies actual readiness; Apple is absent. This start does not complete backend/provider/combined proof dependencies.

## Acceptance criteria

- [ ] AC1: The adopted routes expose distinct branded login/registration, truthful Google readiness with no active Apple entry, confirmation/resend, recovery and existing-user setup with the 8-character/no-mixture guidance and generic account-safe outcomes. Focused Account security controls use the same services and preserve current optional username/name settings.
- [ ] AC2: New/returning/missing-name, `intent=client|coach`, default My sessions and protected-return flows follow the adopted precedence and services. Recovery cannot navigate into protected behavior before update; hostile/looping returns fail safely. No duplicate profile, legal-name assertion, automatic booking/message/invitation action or coach approval is introduced.
- [ ] AC3: All in-scope steps work at 375/430/768/1024/1440 px with keyboard, password-manager/autofill/paste, 200% zoom, reduced motion, long text, visible focus, announced errors, contrast and at least 44 px primary controls.
- [x] AC4: Normal/error/unavailable copy is concise and user-facing; relevant component/browser regressions, lint/typecheck/format/build and visual review pass without public/private shell regressions.
- [x] AC5: Authentication views use only application-owned Auth operation/result contracts and contain no direct provider SDK/client calls or vendor-specific session/error types; the strengthened boundary checks pass.

## Validation plan

Use meaningful component/browser state checks and actual local password/confirmation/recovery flows. Inspect login, registration, provider return/cancel, missing-profile, coach continuation and unavailable states at all five widths with keyboard/zoom. Run npm test, relevant tests/browser/auth.spec.ts, authorization.spec.ts and public-story.spec.ts, lint, typecheck, format:check and build. Mocked provider/failure states support UI coverage only; real social proof belongs to DEV0287 and combined proof to DEV0289.

## Implementation record

### Changes and rationale

2026-10-17: replaced the code-only sign-in screen with branded separate password login/registration, check-email/resend, forgot/reset password, email-proof confirmation and minimal-profile routes. At the initial implementation checkpoint existing users could choose email codes. The later user-directed DEV0322 change removes that fallback; passwordless users use verified recovery/setup, and new accounts use registration. The new dark-green desktop support panel becomes a focused single-column phone card. Forms support named/autocomplete fields, preserved pasted passwords, show/hide controls, disabled pending/pre-hydration inputs, visible keyboard focus and focused announced errors. Apple is absent. Google is disabled with truthful unavailable copy until DEV0287 supplies actual readiness.

The callback strips its proof fragment before explicit confirmation; GET alone consumes nothing. Recovery views use the server's restricted state and offer reset/sign-out. Signup/name completion and safe returns use DEV0286's verified results. Existing completed profiles are reused; coach intent exposes an explicit application action and never grants approval. Account → Login & security now shows a server-derived Set/Change password action, current-password change form, recovery link and current-device sign-out without changing optional username/legal-name persistence. The pure Account view receives its interactive Auth section as a slot, keeping existing rendering tests independent of Next router context.

### Affected files

- [Stage-based Auth screen](../../../src/features/auth/sign-in.tsx) and [shared route wrapper](../../../src/app/_auth/auth-page.tsx): focused forms, safe continuation and server-result state transitions.
- [Sign in](../../../src/app/sign-in/page.tsx), [registration](../../../src/app/register/page.tsx), [check email](../../../src/app/check-email/page.tsx), [forgot](../../../src/app/forgot-password/page.tsx), [reset](../../../src/app/reset-password/page.tsx), [confirmation](../../../src/app/auth/confirm/page.tsx), [profile completion](../../../src/app/complete-profile/page.tsx): distinct metadata/no-index/no-referrer routes. Future Google callback remains DEV0287 scope.
- [Auth styles](../../../src/app/authentication.css), [layout import](../../../src/app/layout.tsx) and [public shell routes](../../../src/components/shell.tsx): responsive brand presentation and consistent public navigation across Auth stages.
- [Account controls](../../../src/features/auth/account-authentication-controls.tsx) and [Account view](../../../src/features/account/account-settings.tsx): real method/password/sign-out controls, retaining existing private details and username behavior.
- [Browser Auth tests](../../../tests/browser/auth.spec.ts), [route-access regression](../../../tests/browser/authorization.spec.ts), [shell tests](../../../tests/shell-navigation.test.ts), [Account view checks](../../../tests/account-settings.test.ts): new entry/navigation/presentation regression coverage. The old access test incorrectly classified delivered `/events` and `/coach/events` as removed; those stale expectations were corrected without changing the routes.

### Decisions and deviations

2026-10-17 later user decision: [DEV0322](../../archive/backend/DEV0322-remove-email-code-login.md) removes the code-login entry, state and application operations before registration testing. The previous transitional fallback is superseded; confirmation/reset links remain.

2026-10-17 later scope change under DEV0311: initial delivery is email/password and Google; the user deferred Apple account/setup. Apple controls and live provider proof are excluded from this peer and preserved in independent DEV0312. Earlier three-method planning history below is retained. Runtime remains Draft; no implementation/provider operation occurred.

2026-10-17 contract alignment under DEV0285: updated this peer's scope/criteria to consume the adopted specification, including the confirmed 8-character/no-mixture policy and its relevant linking, profile, recovery/session, route and Account boundaries. This is documentation alignment only; runtime remains Draft/on hold and all implementation acceptance evidence is pending.

2026-10-17: Created as a fresh direct peer when retired DEV0283 expanded from presentation to password and Google/Apple authentication. No runtime implementation deviation; confirmed method choices are distinct from proposed implementation details.

### Contracts, configuration, and operations

This peer consumes DEV0286's closed operation/session/continuation results and private method status; its backend/config/migration ownership stays in DEV0286. No dependency, secret, environment variable or additional profile/private data field is introduced here. Success clears form secrets and navigates through safe application destinations. Password-update status uses a harmless `notice=password-updated` marker; credentials never enter query strings. Google is unavailable and Apple absent; no provider account/settings or deployment operation occurred.

## Validation results

- 2026-10-17: `npm run test:auth` passed the seven real local Auth/Mailpit phases recorded in DEV0286, including actual registration/confirmation/name completion, keyboard mobile password login, Account change-password error/success, recovery-only access, notification, global revocation and existing code-account/private-data continuity. Exact fixtures were cleaned and existing profiles preserved. Screenshots/result are under ignored `tmp/email-auth-rehearsal/dev0286-99dfefc9-14ec-46b1-88cd-dd96a0cee1ea/`.
- `node /tmp/dev0288-ui-check.mjs`: all seven Auth routes rendered without horizontal overflow at **375, 430, 768, 1024 and 1440 px**. Registration weak-password errors receive focus, show/hide is keyboard operable, reduced-motion mode works, and credentials stay disabled before hydration with JavaScript disabled. A 720-CSS-pixel/2× density case proves the reflow equivalent of 200% on a 1440-pixel screen; native browser-zoom/manual screen-reader proof is not claimed. Screenshots under ignored `tmp/dev0288-presentation/` were visually inspected at phone/desktop widths.
- `npx playwright test tests/browser/auth.spec.ts tests/browser/authorization.spec.ts tests/browser/public-story.spec.ts`: **18 passed, 4 intentional skips** in production public-preview mode. Two configured-guest cases require Auth configuration and skip in the public preview; two repeated mobile cases are desktop-only coverage. New Auth controls/routes, keyboard recovery, missing-link states, public browsing and retained private/public route guards pass. DEV0286's actual configured local rehearsal separately checks private authorization.
- `npm test`: **241 unit + 27 server tests passed (268 total)**. `npm run lint`, `npm run typecheck`, `npm run format:check` passed. `env DATABASE_URL= NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= NEXT_PUBLIC_SITE_URL= NEXT_PUBLIC_GEOAPIFY_API_KEY= npm run build`: final current-source production build passed without hosted access.
- Final current-build rerun: `npx playwright test tests/browser/auth.spec.ts tests/browser/authorization.spec.ts` passed 6 with 2 configured-guest skips. `npm run test:auth -- --cleanup tmp/email-auth-rehearsal/dev0286-99dfefc9-14ec-46b1-88cd-dd96a0cee1ea/recovery-ids.json` confirmed idempotent exact-account/hash cleanup.
- Remaining: DEV0287's actual ready Google button/callback/provider return/cancel and integration; final long-text/autofill/native zoom/screen-reader review, live coach-intent and invitation-return scenarios, and DEV0289 hosted/combined UAT proof. Apple is not required. No external provider, deployment or independent review is claimed.

| Criterion | Evidence | Result |
| --- | --- | --- |
| AC1 | All password/email/setup/Account stages implemented and genuinely exercised; Google truthfully unavailable, final ready provider callback pending. | Partial |
| AC2 | Signup/name/returning identity, safe destinations and recovery gates pass; broader coach/invitation/provider-return proof remains. | Partial |
| AC3 | Five widths, keyboard/error focus, show/hide, reduced motion, no-JS readiness and 200% equivalent reflow pass; full native zoom/autofill/assistive review remains. | Partial |
| AC4 | Current normal/error/unavailable copy, actual local flows, regression tests, formatting/lint/types/build and desktop/mobile visual inspection pass. | Passed locally |
| AC5 | Views call only application Auth interfaces; SDK/import boundary checks pass. | Passed |

## Risks, limitations, and follow-ups

Working local password screens are available now. The ticket remains In progress for real Google integration and the outstanding accessibility/combined scenario evidence above. DEV0286 owns hosted/session/breach/rollback readiness; DEV0287 owns provider credentials/callback; DEV0289 owns complete UAT proof. Preserve the current Account private-name/username and explicit coach/invitation contracts. No hosted or production release is implied.

## Completion and review references

- Completed: Not completed.
- Commit: Planning checkpoint `1314f20`; this DEV0286/DEV0288 continuation contains local UI implementation and its records. Full peer acceptance remains open.
- Review: Implementation self-review, local real-flow and desktop/mobile visual validation; no independent or hosted/provider review.
- Deployment or release: None.
