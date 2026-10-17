# Ticket DEV0286: Implement password authentication and recovery

- Status: Draft
- Created: 2026-10-17
- Last updated: 2026-10-17
- Milestone: Authentication quality before user acceptance testing (UAT)
- Coordination: [COR0027 — Login, registration and social authentication](../organisatory/COR0027-login-registration-and-social-authentication.md)
- Related records: Direct peer/dependency boundaries and external consumers are mapped by COR0027. Historical identity foundations: [DEV0046](../../archive/backend/DEV0046-email-otp-registration-and-application-profiles.md) and [DEV0147](../../archive/backend/DEV0147-separate-client-onboarding-and-verified-coach-access.md).

## Objective and context

Deliver Supabase-managed email/password signup/login, confirmed-email application enrollment, password reset and verified password setup for existing email-code users while retaining their original application identity.

Use the current [registration contract](../../../docs/mvp-spec.md#41-register-as-an-athlete-or-apply-to-coach), [identity/privacy rules](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity), [definition of done](../../../docs/mvp-spec.md#11-definition-of-done), [milestones](../../../docs/mvp-spec.md#12-delivery-milestones) and [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix). The delivered application still uses email codes until these runtime peers pass.

## Scope and non-goals

Provider-boundary refinement, 17 October 2026: this peer also owns application-defined Auth operation/session/event/result contracts and the concrete Supabase adapter used by the login UI. Screens and business services must not call the SDK directly or depend on vendor session/error/event types. Extend meaningful boundary/contract tests to enforce that separation while preserving server-side verification and existing actor permission checks. This is part of this peer's Auth/session foundation, not an independently duplicated implementation under DEV0291.

In scope: password operations, common server-rendered session/callback foundation, verified-email profile/actor gates, server-enforced recovery-purpose restrictions and any narrow persistence needed for that authority, confirmation/recovery/password-notification templates and local settings, password-specific hosted-dev setting/rollback plan and actual bounded rollout proof, existing-code-account transition, Account password services and meaningful tests. Out of scope: Google provider setup, deferred Apple work, final branded views, custom password hashing/storage, general account merging, new infrastructure, production rollout and unrelated schema changes.

## Expected behavior and edge cases

New email/password registration requires email proof before an application profile or protected authority is granted. Returning password login sends no routine code. Recovery gives generic request outcomes and accepts only valid provider-issued ownership proof for the exact account; expired/used links recover safely. Existing passwordless users can set a password on their exact Auth subject and retain profile, coach status, bookings, media and messages. Ordinary navigation must not escape recovery before password update. Preserve existing sign-in query/return semantics and server-derived permissions.

## Assumptions, decisions, and dependencies

Implement the adopted [password/email policy](../../../docs/mvp-spec.md#412-password-email-verification-and-recovery), [routes/returns](../../../docs/mvp-spec.md#413-routes-profile-completion-and-returns), [sessions/Account settings](../../../docs/mvp-spec.md#414-sessions-account-security-and-environments) and [Auth interfaces](../../../docs/mvp-spec.md#415-application-authentication-interfaces). The user-confirmed minimum is 8 characters with no mandatory mixture; the earlier 15-character proposal is superseded. Supported verified same-email linking preserves the original account; separate-account merging stays excluded.

DEV0287 consumes this peer's shared session/callback interface; DEV0288 supplies the views and small Account security integration. Local signup confirmation is currently disabled and only a custom magic-link/code template exists: configuration/templates and real proof remain required. Check hosted capability for breached-password protection and the 30-day refresh-session time box; document the one-hour issued-token revocation bound and verify current-password/fresh-email-proof requirements. Keep the existing-account-only code path through UAT until continuity proof and combined sign-off pass; do not reset existing accounts or dataset state. Runtime remains Draft/on hold while the user's preceding fix-validation/commit sequence is unfinished; the contract update performs no setting or service operation.

This is one direct peer under a flat coordination record. Dependencies do not create child tickets. Record material scope/behavior changes before implementation and split/consolidate through the repository policy if this boundary proves too broad. Ready is not an additional approval gate.

## Implementation plan

1. Inspect installed framework/Auth docs and agree common callback/session interfaces with provider/UI peers.
2. Implement narrow password/signup/recovery and verified-email authority gates, preserving stable Auth/profile identifiers.
3. Configure and validate local confirmation/recovery templates, provider password policy and supported redirects; update the guarded email rehearsal.
4. Prove real passwordless-user setup and recovery locally, document exact hosted-dev changes/rollback, then perform bounded authorized dev rollout and record evidence.

## Acceptance criteria

- [ ] AC1: Real new signup remains unauthorized until confirmed email and the adopted minimal presentation-name completion; returning password login restores the same actor/roles without copying provider names into private legal-name fields.
- [ ] AC2: All password-setting paths enforce the adopted 8-character/no-mixture rules, including 7/8-character, spaces, Unicode and provider-byte-limit cases. One-hour/single-use proofs, 60-second resend spacing, generic unknown/duplicate/credential outcomes, provider rate limits and expired/used proofs pass without enumeration or secret logging. Recovery is restricted on the server until update; successful reset/change sends notification, revokes global refresh sessions and returns to sign-in, with old-password rejection and the documented access-token denial bound proven on a second session.
- [ ] AC3: Actual existing passwordless and Google-first fixtures set a password on the exact original subject/profile with representative private data unchanged; duplicate retries create no replacement account. The transitional code path refuses account creation and remains available through the adopted UAT transition.
- [ ] AC4: The shared route/callback/session/return interfaces and current-device sign-out pass meaningful authorization tests; local and exact hosted-dev confirmation, password, email notification, breached-password/session capability, timing and rollback settings are documented and validated. A missing hosted capability stays a blocker rather than a false policy pass.
- [ ] AC5: Auth SDK calls and vendor session/event/error types are confined to documented Auth adapters; feature views consume application-owned operation/session/results. Boundary and behavior tests prove unsupported/unavailable/expired/wrong-identity outcomes remain truthful and protected actors cannot bypass verification.

## Validation plan

Extend and run npm run test:auth against guarded local Supabase/Mailpit with tagged new/existing accounts. Verify email confirmation denial on the server, reset then old-password rejection, identity/data fingerprints and cleanup; identify deterministic expiry/rate-limit fixtures separately. Run relevant unit/server/database authorization checks, lint, typecheck and build. Record actual hosted-dev confirmation/login/recovery smoke; no local result substitutes for required hosted evidence.

## Implementation record

### Changes and rationale

Not started. This peer was created during DEV0285 planning; no runtime, configuration, account or email has changed.

### Affected files

Planned: src/auth/, src/server/auth/, src/app/api/auth/, narrow callback routes, supabase/config.toml and templates, identity/authorization tests and scripts/rehearse-local-email-auth.mjs. Preserve shared provider/UI interfaces.

### Decisions and deviations

2026-10-17 scope amendment under DEV0311: Google is the only initial social provider; Apple account/setup/integration is independent deferred DEV0312 and cannot block password/shared-session work. Existing password, verification, identity, recovery/session and provider-boundary requirements remain. Runtime is still Draft.

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

The adopted contract is documented; remaining start conditions are the user's preceding fix-validation/commit sequence and concrete local/hosted validation prerequisites. Draft is not implementation evidence. Any server recovery/session authority helper must remain narrowly scoped and tested; secrets remain provider-managed and absent from tickets.

## Completion and review references

- Completed: Not completed.
- Commit: Planning record included in the user-authorized workspace checkpoint under DEV0285; no runtime implementation commit or completed acceptance is claimed.
- Review: Planning self-review only; no independent or implementation review.
- Deployment or release: None.
