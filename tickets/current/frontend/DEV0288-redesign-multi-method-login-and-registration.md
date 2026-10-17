# Ticket DEV0288: Redesign multi-method login and registration

- Status: Draft
- Created: 2026-10-17
- Last updated: 2026-10-17
- Milestone: Authentication quality before user acceptance testing (UAT)
- Coordination: [COR0027 — Login, registration and social authentication](../organisatory/COR0027-login-registration-and-social-authentication.md)
- Related records: Direct peer/dependency boundaries and external consumers are mapped by COR0027. Historical identity foundations: [DEV0046](../../archive/backend/DEV0046-email-otp-registration-and-application-profiles.md) and [DEV0147](../../archive/backend/DEV0147-separate-client-onboarding-and-verified-coach-access.md).

## Objective and context

Build professional MovX login and registration views with email/password and Continue with Google, plus confirmation, recovery, existing-user setup and onboarding suitable for UAT.

Use the current [registration contract](../../../docs/mvp-spec.md#41-register-as-an-athlete-or-apply-to-coach), [identity/privacy rules](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity), [definition of done](../../../docs/mvp-spec.md#11-definition-of-done), [milestones](../../../docs/mvp-spec.md#12-delivery-milestones) and [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix). The delivered application still uses email codes until these runtime peers pass.

## Scope and non-goals

Provider-boundary refinement, 17 October 2026: the finished screens consume DEV0286's typed application Auth gateway and DEV0287's provider operations. Remove the current sign-in screen's direct browser Auth client/SDK calls as part of wiring these views. UI tests use the gateway's application results rather than Supabase-specific errors or event types; authorization remains server-derived.

In scope: separate login/registration presentation, password manager/autofill and show/hide controls, provider controls, verification/resend, forgot/set password, existing-user setup, profile/coach continuation, accessible loading/error/ready states, public navigation/return integration and the focused Account → Login & security method/password/sign-out controls. Out of scope: owning provider credentials or Auth policy, duplicating password/callback services, new profile fields, deferred Apple controls/setup/proof, broader private-workspace/Account redesign, editable email, manual provider connect/disconnect, username login/URLs, invitations, fictitious endorsements and deployment.

## Expected behavior and edge cases

Login offers email/password plus Google. Registration offers email/password plus the same provider choices; social choices can create or recover the account through the managed provider and collect only any missing minimal profile. Returning users skip completed onboarding. Ordinary password login sends no code; verification/recovery and transitional password setup have distinct explanations. Existing /sign-in entries and sanitized return/coach intent remain compatible. Keep public browsing available and preserve explicit coach review. All states use product language, without terminal commands or environment/database instructions.

## Assumptions, decisions, and dependencies

Use the adopted [password/email policy](../../../docs/mvp-spec.md#412-password-email-verification-and-recovery), [route/name/return table](../../../docs/mvp-spec.md#413-routes-profile-completion-and-returns) and [Account/session interfaces](../../../docs/mvp-spec.md#414-sessions-account-security-and-environments), DEV0286 services and DEV0287 provider readiness. Labels describe the user-confirmed 8-character minimum without mandatory character mixtures. Signup requires no legal name, birthdate, gender or username; the existing presentation-name step remains separate and repeat logins preserve completed data. The committed DEV0295 Account model is the compatibility baseline, not a reason to reimplement name/username persistence here.

Adopt existing MovX brand, one focused primary form, quiet desktop support and a single-column phone layout; final visual/copy details stay within that contract. Email/password and Google are required for initial UAT; Apple is deferred and absent from active sign-in controls; unavailable provider states stay truthful. The user authorized implementation after checkpoint `1314f20`; this UI peer remains Draft pending DEV0286's working password/recovery interfaces and DEV0287 provider readiness. Screens cannot substitute a browser flag for DEV0286's recovery/verification gates.

This is one direct peer under a flat coordination record. Dependencies do not create child tickets. Record material scope/behavior changes before implementation and split/consolidate through the repository policy if this boundary proves too broad. Ready is not an additional approval gate.

## Implementation plan

1. Map final routes and every login/registration/confirmation/recovery/onboarding/error state to the adopted service contracts; update the specification for adopted presentation details.
2. Build shared branded forms and provider controls with narrow styles, password-manager support, clear pending/recovery and safe state clearing on identity changes.
3. Wire real services and return/onboarding transitions without duplicating authority or sending any scheduling/message/invitation mutation.
4. Review desktop/mobile/keyboard/zoom/error behavior and update meaningful UI/browser regressions; record screenshots and real-flow boundaries.

## Acceptance criteria

- [ ] AC1: The adopted routes expose distinct branded login/registration, truthful Google readiness with no active Apple entry, confirmation/resend, recovery and existing-user setup with the 8-character/no-mixture guidance and generic account-safe outcomes. Focused Account security controls use the same services and preserve current optional username/name settings.
- [ ] AC2: New/returning/missing-name, `intent=client|coach`, default My sessions and protected-return flows follow the adopted precedence and services. Recovery cannot navigate into protected behavior before update; hostile/looping returns fail safely. No duplicate profile, legal-name assertion, automatic booking/message/invitation action or coach approval is introduced.
- [ ] AC3: All in-scope steps work at 375/430/768/1024/1440 px with keyboard, password-manager/autofill/paste, 200% zoom, reduced motion, long text, visible focus, announced errors, contrast and at least 44 px primary controls.
- [ ] AC4: Normal/error/unavailable copy is concise and user-facing; relevant component/browser regressions, lint/typecheck/format/build and visual review pass without public/private shell regressions.
- [ ] AC5: Authentication views use only application-owned Auth operation/result contracts and contain no direct provider SDK/client calls or vendor-specific session/error types; the strengthened boundary checks pass.

## Validation plan

Use meaningful component/browser state checks and actual local password/confirmation/recovery flows. Inspect login, registration, provider return/cancel, missing-profile, coach continuation and unavailable states at all five widths with keyboard/zoom. Run npm test, relevant tests/browser/auth.spec.ts, authorization.spec.ts and public-story.spec.ts, lint, typecheck, format:check and build. Mocked provider/failure states support UI coverage only; real social proof belongs to DEV0287 and combined proof to DEV0289.

## Implementation record

### Changes and rationale

Not started. This peer replaces the visible-interface part of retired DEV0283; no screens or source files have changed under this stream.

### Affected files

Planned: src/features/auth/sign-in.tsx and focused Auth components/routes, src/app/globals.css or scoped Auth styles, shared UI controls, Auth/browser tests and current presentation specification.

### Decisions and deviations

2026-10-17 later scope change under DEV0311: initial delivery is email/password and Google; the user deferred Apple account/setup. Apple controls and live provider proof are excluded from this peer and preserved in independent DEV0312. Earlier three-method planning history below is retained. Runtime remains Draft; no implementation/provider operation occurred.

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
| AC1–AC5   | No completed implementation/contract acceptance proof yet. Planning checks do not satisfy runtime criteria. | Not run |

## Risks, limitations, and follow-ups

Routes/contracts are adopted; working service/provider interfaces and actual proof remain. Existing browser-control/rendering failures in adjacent tickets may affect later proof and must be reported rather than treated as passes. Preserve DEV0295's private name/username contracts when adding the small Account security controls.

## Completion and review references

- Completed: Not completed.
- Commit: Planning record included in the user-authorized workspace checkpoint under DEV0285; no runtime implementation commit or completed acceptance is claimed.
- Review: Planning self-review only; no independent or implementation review.
- Deployment or release: None.
