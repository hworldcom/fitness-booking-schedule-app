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

In scope: password operations, common server-rendered session/callback foundation, verified-email profile/actor gates, confirmation/recovery templates and local settings, password-specific hosted-dev setting/rollback plan and actual bounded rollout proof, existing-code-account transition and meaningful tests. Out of scope: Google/Apple provider setup, final branded views, custom password hashing/storage, general account merging, new infrastructure, production rollout and unrelated schema changes.

## Expected behavior and edge cases

New email/password registration requires email proof before an application profile or protected authority is granted. Returning password login sends no routine code. Recovery gives generic request outcomes and accepts only valid provider-issued ownership proof for the exact account; expired/used links recover safely. Existing passwordless users can set a password on their exact Auth subject and retain profile, coach status, bookings, media and messages. Ordinary navigation must not escape recovery before password update. Preserve existing sign-in query/return semantics and server-derived permissions.

## Assumptions, decisions, and dependencies

Starts after DEV0285 adopts password/callback/verification/linking and old-user transition rules. DEV0287 consumes this shared session/callback interface; DEV0288 supplies the views. Local signup confirmation is currently disabled and only a custom magic-link/code template exists: password fields alone do not establish readiness. Keep old verified-email setup usable until actual continuity proof passes; do not reset existing accounts or dataset state.

This is one direct peer under a flat coordination record. Dependencies do not create child tickets. Record material scope/behavior changes before implementation and split/consolidate through the repository policy if this boundary proves too broad. Ready is not an additional approval gate.

## Implementation plan

1. Inspect installed framework/Auth docs and agree common callback/session interfaces with provider/UI peers.
2. Implement narrow password/signup/recovery and verified-email authority gates, preserving stable Auth/profile identifiers.
3. Configure and validate local confirmation/recovery templates, provider password policy and supported redirects; update the guarded email rehearsal.
4. Prove real passwordless-user setup and recovery locally, document exact hosted-dev changes/rollback, then perform bounded authorized dev rollout and record evidence.

## Acceptance criteria

- [ ] AC1: Real new signup remains unauthorized until confirmed email and required profile completion; returning password login restores the same actor and roles.
- [ ] AC2: Forgot/reset password, confirmation resend, password policy, wrong credentials, unknown/duplicate addresses, rate limits, invalid/used/expired proofs and sign-out recover truthfully without account enumeration or secret logging.
- [ ] AC3: An actual existing passwordless fixture sets a password and logs in without changing Auth subject/profile or representative private data; duplicate retries create no replacement account.
- [ ] AC4: Common callback/session and same-origin return contracts pass meaningful Auth/authorization tests; local and exact hosted-dev password settings/templates/rollback are documented and validated.
- [ ] AC5: Auth SDK calls and vendor session/event/error types are confined to documented Auth adapters; feature views consume application-owned operation/session/results. Boundary and behavior tests prove unsupported/unavailable/expired/wrong-identity outcomes remain truthful and protected actors cannot bypass verification.

## Validation plan

Extend and run npm run test:auth against guarded local Supabase/Mailpit with tagged new/existing accounts. Verify email confirmation denial on the server, reset then old-password rejection, identity/data fingerprints and cleanup; identify deterministic expiry/rate-limit fixtures separately. Run relevant unit/server/database authorization checks, lint, typecheck and build. Record actual hosted-dev confirmation/login/recovery smoke; no local result substitutes for required hosted evidence.

## Implementation record

### Changes and rationale

Not started. This peer was created during DEV0285 planning; no runtime, configuration, account or email has changed.

### Affected files

Planned: src/auth/, src/server/auth/, src/app/api/auth/, narrow callback routes, supabase/config.toml and templates, identity/authorization tests and scripts/rehearse-local-email-auth.mjs. Preserve shared provider/UI interfaces.

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

Blocked start condition: adopted DEV0285 contract and concrete local/hosted validation prerequisites. Draft is not implementation evidence. Secrets remain provider-managed and absent from tickets.

## Completion and review references

- Completed: Not completed.
- Commit: Planning record included in the user-authorized workspace checkpoint under DEV0285; no runtime implementation commit or completed acceptance is claimed.
- Review: Planning self-review only; no independent or implementation review.
- Deployment or release: None.
