# Ticket DEV0288: Redesign multi-method login and registration

- Status: Draft
- Created: 2026-10-17
- Last updated: 2026-10-17
- Milestone: Authentication quality before user acceptance testing (UAT)
- Coordination: [COR0027 — Login, registration and social authentication](../organisatory/COR0027-login-registration-and-social-authentication.md)
- Related records: Direct peer/dependency boundaries and external consumers are mapped by COR0027. Historical identity foundations: [DEV0046](../../archive/backend/DEV0046-email-otp-registration-and-application-profiles.md) and [DEV0147](../../archive/backend/DEV0147-separate-client-onboarding-and-verified-coach-access.md).

## Objective and context

Build professional MovX login and registration views with email/password, Continue with Google and Continue with Apple, plus confirmation, recovery, existing-user setup and onboarding suitable for UAT.

Use the current [registration contract](../../../docs/mvp-spec.md#41-register-as-an-athlete-or-apply-to-coach), [identity/privacy rules](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity), [definition of done](../../../docs/mvp-spec.md#11-definition-of-done), [milestones](../../../docs/mvp-spec.md#12-delivery-milestones) and [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix). The delivered application still uses email codes until these runtime peers pass.

## Scope and non-goals

Provider-boundary refinement, 17 October 2026: the finished screens consume DEV0286's typed application Auth gateway and DEV0287's provider operations. Remove the current sign-in screen's direct browser Auth client/SDK calls as part of wiring these views. UI tests use the gateway's application results rather than Supabase-specific errors or event types; authorization remains server-derived.

In scope: separate login/registration presentation, password manager/autofill and show/hide controls, provider controls, verification/resend, forgot/set password, existing-user setup, profile/coach continuation, accessible loading/error/ready states and public navigation/return integration. Out of scope: owning provider credentials or Auth policy, duplicating password/callback services, new profile fields, private-workspace redesign, invitations, fictitious endorsements and deployment.

## Expected behavior and edge cases

Login offers email/password plus Google/Apple. Registration offers email/password plus the same provider choices; social choices can create or recover the account through the managed provider and collect only any missing minimal profile. Returning users skip completed onboarding. Ordinary password login sends no code; verification/recovery and transitional password setup have distinct explanations. Existing /sign-in entries and sanitized return/coach intent remain compatible. Keep public browsing available and preserve explicit coach review. All states use product language, without terminal commands or environment/database instructions.

## Assumptions, decisions, and dependencies

Uses adopted DEV0285 contracts, DEV0286 password/recovery services and DEV0287 provider results/readiness. Proposed composition: existing MovX brand, one focused primary form, quiet desktop support and single-column phone layout; exact routes/copy remain implementation defaults. All three methods are required for the requested UAT outcome; incomplete provider readiness must be truthful and cannot be counted as delivered integration.

This is one direct peer under a flat coordination record. Dependencies do not create child tickets. Record material scope/behavior changes before implementation and split/consolidate through the repository policy if this boundary proves too broad. Ready is not an additional approval gate.

## Implementation plan

1. Map final routes and every login/registration/confirmation/recovery/onboarding/error state to the adopted service contracts; update the specification for adopted presentation details.
2. Build shared branded forms and provider controls with narrow styles, password-manager support, clear pending/recovery and safe state clearing on identity changes.
3. Wire real services and return/onboarding transitions without duplicating authority or sending any scheduling/message/invitation mutation.
4. Review desktop/mobile/keyboard/zoom/error behavior and update meaningful UI/browser regressions; record screenshots and real-flow boundaries.

## Acceptance criteria

- [ ] AC1: Distinct polished login and registration expose email/password, Google and Apple, with coherent confirmation/recovery and existing-user setup views and truthful provider readiness.
- [ ] AC2: New/returning/coach-intent and protected-return flows use the adopted services; no duplicate profile, auto booking/message/invitation action or coach approval is introduced.
- [ ] AC3: All steps work at 375/430/768/1024/1440 px with keyboard, password-manager/autofill/paste, 200% zoom, reduced motion, long text, visible focus, announced errors, contrast and at least 44 px primary controls.
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

Need adopted routes/contracts and working service/provider interfaces. Existing browser-control/rendering failures in adjacent tickets may affect later proof and must be reported rather than treated as passes.

## Completion and review references

- Completed: Not completed.
- Commit: Planning record included in the user-authorized workspace checkpoint under DEV0285; no runtime implementation commit or completed acceptance is claimed.
- Review: Planning self-review only; no independent or implementation review.
- Deployment or release: None.
