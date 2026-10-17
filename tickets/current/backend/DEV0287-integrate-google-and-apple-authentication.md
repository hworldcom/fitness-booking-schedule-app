# Ticket DEV0287: Integrate Google and Apple authentication

- Status: Draft
- Created: 2026-10-17
- Last updated: 2026-10-17
- Milestone: Authentication quality before user acceptance testing (UAT)
- Coordination: [COR0027 — Login, registration and social authentication](../organisatory/COR0027-login-registration-and-social-authentication.md)
- Related records: Direct peer/dependency boundaries and external consumers are mapped by COR0027. Historical identity foundations: [DEV0046](../../archive/backend/DEV0046-email-otp-registration-and-application-profiles.md) and [DEV0147](../../archive/backend/DEV0147-separate-client-onboarding-and-verified-coach-access.md).

## Objective and context

Enable real Google and Apple web authentication through the existing managed Auth boundary, with one authorized MovX identity and compatible onboarding/return behavior.

Use the current [registration contract](../../../docs/mvp-spec.md#41-register-as-an-athlete-or-apply-to-coach), [identity/privacy rules](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity), [definition of done](../../../docs/mvp-spec.md#11-definition-of-done), [milestones](../../../docs/mvp-spec.md#12-delivery-milestones) and [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix). The delivered application still uses email codes until these runtime peers pass.

## Scope and non-goals

Provider-boundary refinement, 17 October 2026: implement Google/Apple operations inside the Auth adapter interface owned by DEV0286. Translate provider errors/results there; do not introduce SDK calls or provider claim types into feature views, business services or the domain layer. Apply the same verified identity-resolution contract across every login method.

In scope: Google/Apple provider configuration, narrowly scoped callback integration using the shared session foundation, provider readiness/results for the UI, same/different verified-email cases, missing-name fallback, denial/cancellation/retry, hosted-dev setup/rotation/rollback guidance and real provider proof. Out of scope: password/recovery implementation, application-profile redesign, custom OAuth/identity storage, arbitrary account merging, extra provider data scopes, native app SDKs, new projects and production deployment.

## Expected behavior and edge cases

Continue with Google/Apple creates or recovers a provider-verified account and then follows ordinary minimal-profile/onboarding/coach authority. Repeated provider login uses the same subject/profile. Provider cancellation and callback failure return useful recovery without false sign-in. Apply DEV0285’s reviewed linking policy; never merge different-email accounts by matching names or treating an Apple relay as the invited address. No provider profile metadata grants coach roles or replaces a private avatar automatically.

## Assumptions, decisions, and dependencies

Depends on DEV0285 account/linking/callback rules and DEV0286 common session interface; may prepare provider requirements independently after contract adoption. Google requires Cloud/Auth client/consent configuration, appropriate test audience and exact allowed origins/redirects. Apple web OAuth requires Developer configuration, App/Services IDs and signing credentials; document client-secret expiry/rotation (Supabase currently documents a six-month maximum cycle). Missing provider credentials/approvals are explicit blockers, not grounds for fake working buttons. Existing Supabase remains recommended pending contract adoption.

This is one direct peer under a flat coordination record. Dependencies do not create child tickets. Record material scope/behavior changes before implementation and split/consolidate through the repository policy if this boundary proves too broad. Ready is not an additional approval gate.

## Implementation plan

1. Inspect official Google/Apple and installed Supabase docs; inventory required owned credentials, test users, origins, callbacks and Apple renewal responsibilities without exposing secrets.
2. Prepare exact local/hosted-dev provider setup and rollback, minimal scopes and tested readiness interface.
3. Implement supported web provider flows/callback integration and ordinary server verification/onboarding; handle absent names and provider errors.
4. Prove Google and Apple new/returning/cancelled flows with controlled accounts, linking/relay/return cases and private-data continuity; record environment gaps accurately.

## Acceptance criteria

- [ ] AC1: Both Google and Apple complete real web sign-in and first-time onboarding through server-verified sessions; repeated login preserves the same subject/profile and existing coach approval.
- [ ] AC2: Provider denial/cancellation, missing display name, invalid callback/session and unavailable configuration recover safely without a false authenticated/ready state.
- [ ] AC3: Adopted same-email/different-email linking rules and Apple relay behavior are proven; no arbitrary merge, invitation acceptance or expanded media/role permission occurs.
- [ ] AC4: Provider-specific settings, dev/prod separation, scopes, Google test/branding state, Apple secret expiry/rotation/owner and rollback are documented; meaningful automated checks and real hosted-dev provider smoke pass.

## Validation plan

Run focused provider/callback/session/authorization tests plus lint/typecheck/build. Rehearse actual Google and Apple with controlled test users on an allowed hosted-dev/UAT origin, including cancellation, repeat login, absent name, same verified email and distinct Apple relay. Compare exact subject/profile/data before/after and distinguish real provider proof from mocked callback/error tests. Missing real Apple or Google evidence keeps the peer open.

## Implementation record

### Changes and rationale

Not started. Provider credentials, Developer accounts and readiness have not been inspected; no external setting or identity changed.

### Affected files

Planned: shared auth client/server callback adapters, provider configuration/readiness contract, ignored credential configuration and non-secret setup documentation, targeted Auth tests. DEV0288 owns the visible controls.

### Decisions and deviations

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

Need contract adoption, callback foundation and actual provider access. Apple name/relay differences and expiring web credentials require explicit handling. No claim of registration, identity linking or provider readiness before evidence.

## Completion and review references

- Completed: Not completed.
- Commit: Planning record included in the user-authorized workspace checkpoint under DEV0285; no runtime implementation commit or completed acceptance is claimed.
- Review: Planning self-review only; no independent or implementation review.
- Deployment or release: None.
