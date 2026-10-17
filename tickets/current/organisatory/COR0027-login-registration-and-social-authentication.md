# Coordination COR0027: Login, registration and social authentication

- Status: In progress
- Created: 2026-10-17
- Last updated: 2026-10-17
- Milestone: Authentication quality before user acceptance testing (UAT)
- Converted from: Retired DEV0283 — Redesign login and registration for UAT; converted before runtime implementation or any commit.
- Tracked development tickets: [DEV0285 — Define the multi-method authentication contract](DEV0285-define-multi-method-authentication-contract.md), [DEV0286 — Implement password authentication and recovery](../backend/DEV0286-implement-password-authentication-and-recovery.md), [DEV0287 — Integrate Google and Apple authentication](../backend/DEV0287-integrate-google-and-apple-authentication.md), [DEV0288 — Redesign multi-method login and registration](../frontend/DEV0288-redesign-multi-method-login-and-registration.md) and [DEV0289 — Rehearse multi-method authentication for UAT](../backend/DEV0289-rehearse-multi-method-authentication-for-uat.md).
- Related records: historical email identity [DEV0046](../../archive/backend/DEV0046-email-otp-registration-and-application-profiles.md) and athlete/coach authority [DEV0147](../../archive/backend/DEV0147-separate-client-onboarding-and-verified-coach-access.md); public shell/accessibility [COR0017](../../archive/organisatory/COR0017-public-marketplace-redesign.md); adjacent private-workspace redesign [COR0018](COR0018-authenticated-workspace-redesign.md); downstream invitation consumer [COR0024](COR0024-email-invitations-and-shareable-links.md); external hosted-environment foundation [COR0026](COR0026-separate-hosted-dev-and-production.md).

## Objective and boundaries

Coordinate a professional MovX registration/login experience with **email and password, Continue with Google and Continue with Apple**, including verification, recovery, existing-account continuity and actual UAT evidence. The user selected these methods on 17 October 2026 after clarifying that familiar consumer-style login/registration was intended. Those product references describe familiarity, not an instruction to copy another service's exact screens or authority model.

This record coordinates peer development work and does not implement runtime authentication. The current application still uses email codes. The [specification](../../../docs/mvp-spec.md#41-register-as-an-athlete-or-apply-to-coach) distinguishes that delivered behavior from the selected target. The recommended implementation is to retain existing Supabase Auth, which documents password, Google and Apple support; moving to another identity vendor is not a user-selected requirement.

Preserve the existing application profile, server-derived athlete/coach capabilities, explicit coach approval, original private data and safe sign-in returns. Signup/provider authentication never books, sends messages or accepts invitations. Exact targeted-invitation email matching remains a separate consent boundary. Password recovery and existing-code-account setup are required parts of the target, not optional later polish.

Native SDK implementation, new identity vendors, custom password/identity storage, phone/passkeys, new profile fields, invitation runtime, production operations and deployment are outside this work map.

## Direct development work

| Implementation part                      | Development ticket                                                              | Owned deliverable                                                                                                                                                                                                     | Start condition or dependency                                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Account contract and planning conversion | [DEV0285](DEV0285-define-multi-method-authentication-contract.md)               | Selected target, exact verification/recovery/linking/transition/return rules, specification and this complete flat work map.                                                                                          | Planning in progress; remaining operating details must be adopted before runtime starts.                        |
| Password and shared session foundation   | [DEV0286](../backend/DEV0286-implement-password-authentication-and-recovery.md) | Password signup/login/recovery, verified-email enrollment, existing-user password setup, common server-rendered callback/session interfaces and password-specific local/hosted-dev settings/templates/rollback/proof. | Adopted DEV0285 contract and concrete local/dev prerequisites.                                                  |
| Google and Apple integration             | [DEV0287](../backend/DEV0287-integrate-google-and-apple-authentication.md)      | Provider setup/readiness, supported web flows using shared sessions, provider-specific callback handling, linking/relay/name cases, real provider proof and Apple renewal handoff.                                    | DEV0285 contract and DEV0286 session interface; credentials/provider administration are explicit prerequisites. |
| Professional public authentication UI    | [DEV0288](../frontend/DEV0288-redesign-multi-method-login-and-registration.md)  | All login/registration/provider/confirmation/recovery/setup/onboarding views, accessible state feedback, safe navigation and responsive visual proof.                                                                 | Adopted contract; final integration depends on DEV0286/DEV0287 services.                                        |
| Integrated UAT evidence                  | [DEV0289](../backend/DEV0289-rehearse-multi-method-authentication-for-uat.md)   | Combined real local/hosted-dev scenarios, preserved-account/data checks, responsive recovery, exact fixture cleanup and truthful UAT handoff.                                                                         | Every other peer meets its own criteria and required origin/mail/provider access exists.                        |

All required direct tickets exist and link back here. Work is flat; dependencies do not create ticket hierarchies. Shared callback/session authority belongs to DEV0286; DEV0287 extends it only for provider-specific handling, and DEV0288 consumes it rather than implementing competing authority.

## Other relationships

- **Independent modularity/recovery follow-ups:** [DEV0291](../../archive/organisatory/DEV0291-adopt-provider-boundaries-and-recovery-requirements.md) owns the audit/requirement refinement, [DEV0292](../backend/DEV0292-isolate-profile-image-storage-adapter.md) the Storage adapter and [DEV0293](../backend/DEV0293-rehearse-database-auth-and-file-recovery.md) the complete restore rehearsal. They are not direct members. Auth modularity remains owned by DEV0286's application gateway/shared verification adapter, DEV0287's concrete provider operations and DEV0288's SDK-free UI consumption. DEV0289 proves the final Auth flows; operational backup restoration is independently owned and does not replace password-reset tests.

- **External prerequisite:** COR0026 supplies the existing hosted dev/project/origin foundation. Password-specific configuration is DEV0286's responsibility; Google/Apple configuration is DEV0287's. No new project or production rollout is hidden here.
- **Downstream consumer:** COR0024 consumes the adopted verified identity and safe-return contract. Invitation review still matches the exact verified invited address and requires explicit acceptance. Apple relay or a different Google address grants no connection merely because the person opened an invitation.
- **Historical baselines:** DEV0046 and DEV0147 establish existing account IDs, minimal enrollment and separate coach approval. Their completed records are preserved; this stream owns future changes rather than reopening history.
- **Adjacent interfaces:** COR0017 supplies public chrome and accessibility defaults; COR0018 owns private workspace presentation. Neither is a direct member or a blocker merely because its records are linked.

## Delivery sequence and completion conditions

1. DEV0285 adopts exact account/password/callback/linking/transition rules and settles provider-managed same-email linking against the existing no-automatic-account-merge requirement. Retaining Supabase is a recommendation based on the current integration, not permission to assume every default is compatible.
2. DEV0286 establishes verified-email password/recovery and shared session interfaces. DEV0287 may prepare provider requirements independently after contract adoption, then integrate against the stable session interface. DEV0288 may develop visual components after route/state contracts are concrete; working integration waits for both service peers.
3. Each runtime peer proves its own required real flow. Missing Google/Apple credentials, Developer access, consent configuration, callback origins or email delivery remain explicit blockers; simulated provider buttons do not satisfy the selected outcome.
4. DEV0289 performs the combined actual local-email and hosted-dev password/Google/Apple proof, preserved identity/data comparisons, mobile/desktop/keyboard recovery and exact cleanup. Fix defects in their owner rather than implementing missing peers inside the proof ticket.
5. Complete this COR only when every direct DEV is Completed or explicitly cancelled/replaced and combined evidence passes. Both social providers are required. A deferred provider is an incomplete outcome unless the user changes scope. Deployment and production validation remain separate claims.

## Progress and integration record

- 2026-10-17 modularity/recovery refinement: the user confirmed modular code and actual recovery testing. Added explicit gateway/SDK-boundary criteria to existing Auth peers without changing membership. Storage adapter and disaster recovery are independent implementation tickets; current coupling and unperformed recovery remain explicit. Exact recovery-time/data-loss targets are still to be selected, not a promised service level.

- 2026-10-17 initial DEV0283 planning: the user asked for professional UAT login/registration. The initial proposed default retained email one-time passwords (OTP), excluded new providers and treated the work as a single frontend slice. Its seven acceptance areas were coherent stage presentation, new/returning enrollment, code/retry recovery, safe navigation/authority, responsive accessibility, product-language errors and actual validation/handoff.
- Initial planning validation: 238 local links/anchors, 194 unique DEV/COR records, DEV0283 indexed once as an independent Draft, next IDs DEV0284/COR0027, required template sections and AC1–AC7 passed a scoped Python validator; focused Prettier and diff checks passed. No application, browser, provider or deployment validation was performed. These are historical documentation results only.
- Later clarification: the user explicitly selected familiar email/password login and registration. The Draft was revised to include confirmed signup, password recovery, existing-code-account password setup and necessary narrow session/configuration work. No runtime implementation or commit occurred. Password-only planning was still being reconciled when the user additionally requested Google/Apple.
- Latest scope: Google and Apple are selected alongside email/password. Provider setup, account continuity, interface and integrated proof now require separate reviewable implementation boundaries. Converted the pre-implementation DEV0283 planning record into COR0027, retired its DEV ID and created fresh peer DEV0285–DEV0289. Independent DEV0284 was allocated meanwhile and is preserved; it is not an authentication member.
- Research: reviewed official Supabase password, Google, Apple and identity-linking docs plus Clerk/Auth0/Firebase alternatives. Supabase already has the project's identity/session integration, so retaining it is recommended. Google requires owned client/consent/redirect setup. Apple web OAuth requires Developer/Services ID/signing setup and expiring client-secret maintenance. Supabase's same-email linking and Apple's relay/missing-name cases require explicit contract decisions and proof.
- Current handoff: planning and selected-target documentation only. DEV0285 In progress; DEV0286–DEV0289 Draft. Exact password policy, callbacks/routes, provider-managed linking/old-account transition and credentials/readiness remain unfinished. Current email-code runtime, accounts, provider settings, SMTP and deployment are unchanged.

## Validation results

2026-10-17 planning conversion checks passed under DEV0285: 11 scoped documents, 377 local links, 52 anchors and 200 unique DEV/COR records; DEV0283 retirement/no active reuse, five reciprocal direct memberships, one index row per record, status/template consistency and next IDs DEV0290/COR0028 were verified. Focused Prettier and scoped diff checks passed. Self-review confirmed each deliverable has one owner, external invitation/environment records are not direct members and selected targets remain distinct from delivered email-code behavior. Peer runtime acceptance criteria have not run; these documentation checks do not replace actual Auth/provider/browser proof.

## Risks, limitations, and follow-ups

- Supabase automatically resolves some same-email provider identities. Review that behavior before rollout instead of assuming it is compatible with the historical no-automatic-merge constraint. Different emails/Apple relay identities never become equivalent through unverified application guesses.
- Apple web setup includes expiring client credentials and may return no display name; identify the renewal owner and a valid minimal-profile fallback. Google test-audience/branding state and both providers' actual callback origins matter for UAT.
- Existing code users need verified password setup with unchanged subjects/profiles/private data before the old default entry flow is retired. Existing browser-control/rendering problems may impede required evidence and cannot be counted as passes.

## Completion and review references

- Completed: Not completed.
- Direct development tickets: DEV0285 In progress; DEV0286–DEV0289 Draft.
- Commit: Planning included in this user-authorized workspace checkpoint under DEV0285. COR0027 is never a commit subject identifier; retired DEV0283 is unavailable for future commits.
- Review: Planning/research self-review only; no independent or implementation review.
- Deployment or release: None.
