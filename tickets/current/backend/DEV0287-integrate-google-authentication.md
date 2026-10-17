# Ticket DEV0287: Integrate Google authentication

- Status: Draft
- Created: 2026-10-17
- Last updated: 2026-10-17
- Milestone: Authentication quality before user acceptance testing (UAT)
- Coordination: [COR0027 — Login, registration and social authentication](../organisatory/COR0027-login-registration-and-social-authentication.md)
- Related records: Scope amendment [DEV0311](../../archive/organisatory/DEV0311-defer-apple-from-initial-authentication-rollout.md); independent deferred Apple [DEV0312](DEV0312-integrate-deferred-apple-authentication.md). Direct peer/dependency boundaries and external consumers are mapped by COR0027. Historical identity foundations: [DEV0046](../../archive/backend/DEV0046-email-otp-registration-and-application-profiles.md) and [DEV0147](../../archive/backend/DEV0147-separate-client-onboarding-and-verified-coach-access.md).

## Objective and context

Enable real Google web authentication through the existing managed Auth boundary, with one authorized MovX identity and compatible onboarding/return behavior.

Use the current [registration contract](../../../docs/mvp-spec.md#41-register-as-an-athlete-or-apply-to-coach), [identity/privacy rules](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity), [definition of done](../../../docs/mvp-spec.md#11-definition-of-done), [milestones](../../../docs/mvp-spec.md#12-delivery-milestones) and [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix). The delivered application still uses email codes until these runtime peers pass.

## Scope and non-goals

Provider-boundary refinement, 17 October 2026: implement Google operations inside the Auth adapter interface owned by DEV0286. Translate provider errors/results there; do not introduce SDK calls or provider claim types into feature views, business services or the domain layer. Apply the same verified identity-resolution contract across every login method.

In scope: Google provider configuration, narrowly scoped callback integration using the shared session foundation, provider readiness/results for the UI, same/different verified-email cases, missing-name fallback, denial/cancellation/retry, hosted-dev setup/rotation/rollback guidance and real provider proof. Out of scope: password/recovery implementation, application-profile redesign, custom OAuth/identity storage, arbitrary account merging, extra provider data scopes, deferred Apple setup/UI/proof, native app SDKs, new projects and production deployment.

## Expected behavior and edge cases

Continue with Google creates or recovers a provider-verified account and then follows ordinary minimal-profile/onboarding/coach authority. Repeated provider login uses the same subject/profile. Provider cancellation and callback failure return useful recovery without false sign-in. Apply DEV0285’s reviewed linking policy; never merge different-email accounts by matching names or treating an Apple relay as the invited address. No provider profile metadata grants coach roles or replaces a private avatar automatically.

## Assumptions, decisions, and dependencies

Use the adopted [same-email/relay policy](../../../docs/mvp-spec.md#411-methods-and-account-resolution), [name/route/return contract](../../../docs/mvp-spec.md#413-routes-profile-completion-and-returns) and [application Auth interface](../../../docs/mvp-spec.md#415-application-authentication-interfaces), then integrate against DEV0286's common session interface. Same verified-email linking restores the original identity; different addresses/Apple relay remain separate. Manual provider connection/removal and merging separate MovX accounts are excluded. Existing names/settings/private media are never overwritten from provider metadata.

Google requires Cloud/Auth client/consent configuration, appropriate test audience and exact allowed origins/redirects. Apple account/setup, signing/renewal and integration are deferred to independent [DEV0312](DEV0312-integrate-deferred-apple-authentication.md) and do not block this peer. Missing provider credentials/approvals are explicit blockers, not grounds for fake working buttons. Supabase is the adopted implementation default. The user authorized starting Auth implementation after checkpoint `1314f20`; DEV0286's gateway/password foundation is In progress. This Google peer remains Draft pending its shared callback interface and actual Google access; no provider administration has been performed.

This is one direct peer under a flat coordination record. Dependencies do not create child tickets. Record material scope/behavior changes before implementation and split/consolidate through the repository policy if this boundary proves too broad. Ready is not an additional approval gate.

## Implementation plan

1. Inspect official Google and installed Supabase docs; inventory required owned credentials, test users, origins, callbacks and Google consent/branding readiness without exposing secrets.
2. Prepare exact local/hosted-dev provider setup and rollback, minimal scopes and tested readiness interface.
3. Implement supported web provider flows/callback integration and ordinary server verification/onboarding; handle absent names, provider errors and unsupported Apple requests.
4. Prove Google new/returning/cancelled flows with controlled accounts, same/different-email linking and return cases and private-data continuity; record environment gaps accurately.

## Acceptance criteria

- [ ] AC1: Google completes real web sign-in and first-time onboarding through server-verified confirmed-email sessions; missing names use the adopted presentation-name form, and repeated login preserves original subject/profile, names/settings and coach approval without redundant confirmation emails.
- [ ] AC2: Provider denial/cancellation, missing display name, invalid callback/session and unavailable configuration recover safely without a false authenticated/ready state.
- [ ] AC3: Actual password-first then same-email provider login, provider-first then verified password setup, repeated provider login and different-Google-email cases match the adopted policy and preserve original private data. Unconfirmed/conflicting identities gain no protected authority; no arbitrary merge, invitation acceptance or expanded media/role permission occurs.
- [ ] AC4: Provider-specific settings, dev/prod separation, scopes, Google test/branding state and rollback are documented; meaningful automated checks and real hosted-dev provider smoke pass.

## Validation plan

Run focused provider/callback/session/authorization tests plus lint/typecheck/build. Rehearse actual Google with controlled test users on an allowed hosted-dev/UAT origin, including cancellation, repeat login, absent name, same verified email and a distinct Google email. Compare exact subject/profile/data before/after and distinguish real provider proof from mocked callback/error tests. Missing real Google evidence keeps the peer open; no Apple live evidence is required.

## Implementation record

### Changes and rationale

2026-10-17 scope amendment under DEV0311: the user deferred Apple account/setup and selected Google as the only initial social provider. Narrowed this existing ticket and renamed its file/title without changing its ID; future Apple ownership is independent DEV0312. Original three-method planning history below is retained. No runtime/provider operation occurred.

Not started. Provider credentials, Developer accounts and readiness have not been inspected; no external setting or identity changed.

### Affected files

Planned: shared auth client/server callback adapters, provider configuration/readiness contract, ignored credential configuration and non-secret setup documentation, targeted Auth tests. DEV0288 owns the visible controls.

### Decisions and deviations

2026-10-17 contract alignment under DEV0285: updated this peer's scope/criteria to consume the adopted specification, including the confirmed 8-character/no-mixture policy and its relevant linking, profile, recovery/session, route and Account boundaries. This is documentation alignment only; runtime remains Draft/on hold and all implementation acceptance evidence is pending.

2026-10-17: Created as a fresh direct peer when retired DEV0283 expanded from presentation to password and Google/Apple authentication. No runtime implementation deviation; confirmed method choices are distinct from proposed implementation details.

### Contracts, configuration, and operations

Planning only so far: no runtime API/schema, dependencies, secrets, provider accounts/settings, mail sending or deployment changes. Future interfaces and exact configuration/rollback belong to the scope above; no application password store or provider migration is implied. Record any necessary change before applying it and preserve existing identities/data.

## Validation results

- Date/environment: 2026-10-17, repository planning.
- Documentation checks passed on 2026-10-17: scoped Python validation checked 11 documents, 377 local links, 52 anchors and 200 unique records; retirement, five reciprocal direct memberships, index/status/template consistency and next IDs DEV0290/COR0028 passed. Focused Markdown formatting and whitespace checks are recorded under DEV0285; these checks do not establish runtime acceptance.
- Runtime/application/provider/browser checks: not run — this is planning; all runtime criteria remain open.

| Criterion | Evidence                                                                                                    | Result  |
| --------- | ----------------------------------------------------------------------------------------------------------- | ------- |
| AC1–AC4   | No completed implementation/contract acceptance proof yet. Planning checks do not satisfy runtime criteria. | Not run |

## Risks, limitations, and follow-ups

Current password/Google contract decisions are adopted; the DEV0286 callback foundation and actual Google access remain prerequisites. Apple is deferred to DEV0312 and is not a completion blocker. No claim of registration, identity linking or Google readiness before real evidence.

## Completion and review references

- Completed: Not completed.
- Commit: Planning record included in the user-authorized workspace checkpoint under DEV0285; no runtime implementation commit or completed acceptance is claimed.
- Review: Planning self-review only; no independent or implementation review.
- Deployment or release: None.
