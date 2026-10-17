# Ticket DEV0312: Integrate deferred Apple authentication

- Status: Draft
- Created: 2026-10-17
- Last updated: 2026-10-17
- Milestone: Deferred authentication extension
- Coordination: None — independent development ticket
- Related records: Initial-release dependency [COR0027](../organisatory/COR0027-login-registration-and-social-authentication.md); scope amendment [DEV0311](../../archive/organisatory/DEV0311-defer-apple-from-initial-authentication-rollout.md); historical three-method contract [DEV0285](../../archive/organisatory/DEV0285-define-multi-method-authentication-contract.md).

## Objective and context

Preserve future Sign in with Apple work after the user deferred Apple account setup on 2026-10-17. The initial release uses email/password and Google; this record neither blocks COR0027 nor authorizes immediate Apple enrollment/provider administration. Follow the current [authentication contract](../../../docs/mvp-spec.md#41-register-as-an-athlete-or-apply-to-coach) when the work resumes.

## Scope and non-goals

- Future scope: verify Apple Developer eligibility/membership and web App/Services IDs, signing/return configuration, relay email sources, secret renewal ownership, the provider adapter, name/relay/account resolution, visible Apple controls and actual integrated proof.
- Out of scope: Apple work now, changing initial Google/password acceptance, custom identity/password storage, merging accounts by names or guessed addresses, unrelated UI redesign, native app implementation and production publication.

## Expected behavior and edge cases

After a separately resumed implementation, Apple may create or restore a server-verified account using the same application Auth gateway. Missing names collect the existing presentation name without asserting legal identity. Verified same-email linking preserves the original identity/data; a different relay address does not claim another account or exact-recipient invitation. Cancellation, expired callbacks, unavailable setup and repeated login recover truthfully. Initial-release screens do not advertise Apple as available before this outcome is delivered.

## Assumptions, decisions, and dependencies

Apple is explicitly deferred. Start only when the user resumes this work, the shared COR0027 gateway/Google/password baseline is stable, and appropriate Apple account access/configuration can be prepared. Determine actual membership, web eligibility, App/Services IDs, domains, signing credentials and renewal owner without assuming a native app is published or exposing secrets. Recheck current official Apple/Supabase requirements then. This record is an independent deferred follow-up, not a required COR0027 member or a child of another DEV.

## Implementation plan

1. Reconfirm scope/readiness and update the specification before enabling Apple. Review whether this remains one bounded vertical slice; follow repository split/coordination rules if needed.
2. Verify permitted developer-account, website/identifier and callback setup, minimal scopes, relay delivery and non-secret configuration/rollback guidance. Record the real renewal owner and expiry checks.
3. Extend the existing provider adapter/application results and visible login/registration/Account methods without duplicating Auth authority.
4. Prove actual Apple new/returning/cancelled/relay/missing-name/same-email cases, account/data continuity and combined password/Google compatibility; perform exact owned-fixture cleanup.

## Acceptance criteria

- [ ] AC1: Actual Apple web sign-in/registration and repeated login preserve the correct original subject/profile/private data and coach authority through the shared gateway.
- [ ] AC2: Same/different verified emails, relay, missing names, denial, replay/expiry, missing configuration and exact-recipient invitation boundaries follow the adopted contract without arbitrary merging.
- [ ] AC3: Actual developer/provider/return/relay configuration, credential expiry/renewal owner and rollback are documented and verified without secrets; no earlier initial-release Apple readiness is claimed.
- [ ] AC4: Real hosted-dev Apple and combined password/Google flows, desktop/mobile/keyboard/error states, relevant automated/static/build checks and owned cleanup pass; adapter boundaries and existing account/privacy behavior remain intact.

## Validation plan

When resumed, run provider/callback/authorization and boundary regressions, lint/typecheck/build, actual controlled Apple web authorization and final responsive/keyboard checks. Compare original identity/data before/after and test relay delivery, rejected callbacks, secret readiness and rollback. Mocks support failure coverage only. No runtime/provider checks are run while this ticket is deferred.

## Implementation record

### Changes and rationale

2026-10-17: Created this Draft follow-up under DEV0311 so future Apple work remains visible while initial password/Google delivery can complete independently. No provider account/configuration or code changed.

### Affected files

This planning record and the index/coordination/specification references owned by DEV0311. Future provider/UI/test paths must be inventoried against the then-current implementation before edits.

### Decisions and deviations

User-requested deferral from the earlier three-method plan; no runtime deviation or implementation has occurred.

### Contracts, configuration, and operations

None implemented. Apple setup, credentials, mail sources, environment differences and rollback remain future prerequisites; never store private keys or client secrets in tickets.

## Validation results

Planning links/membership/index are checked under DEV0311. All AC1–AC4 runtime checks: Not run — implementation is deferred.

## Risks, limitations, and follow-ups

Next action requires the user to resume Apple work. No Apple membership/access, credentials, callback/relay readiness or real-login capability has been verified. This Draft must not hold the initial COR0027 password/Google rollout open.

## Completion and review references

- Completed: Not completed — deferred Draft.
- Commit: Not created for this request.
- Review: Planning self-review under DEV0311; no independent or runtime review.
- Deployment or release: None.
