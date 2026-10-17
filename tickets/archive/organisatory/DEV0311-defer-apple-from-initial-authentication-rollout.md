# Ticket DEV0311: Defer Apple from the initial authentication rollout

- Status: Completed
- Created: 2026-10-17
- Last updated: 2026-10-17
- Milestone: Authentication quality before UAT
- Coordination: [COR0027 — Login, registration and social authentication](../../current/organisatory/COR0027-login-registration-and-social-authentication.md)
- Related records: Historical contract [DEV0285](DEV0285-define-multi-method-authentication-contract.md); direct Google integration peer [DEV0287](../../current/backend/DEV0287-integrate-google-authentication.md); independent deferred Apple follow-up [DEV0312](../../current/backend/DEV0312-integrate-deferred-apple-authentication.md).

## Objective and context

The user decided on 2026-10-17 to wait with the Apple account and focus on Google. Amend the [authentication contract](../../../docs/mvp-spec.md#41-register-as-an-athlete-or-apply-to-coach) so the initial COR0027 delivery requires email/password and Google. Preserve the completed DEV0285 record as the earlier three-method decision; this new dated amendment owns the changed scope.

## Scope and non-goals

- In scope: specification, COR0027 ownership/completion conditions, Google peer name/scope, login UI and combined UAT criteria, downstream invitation notes, ticket index and a separate deferred Apple record.
- Out of scope: runtime code, enabling providers, opening developer accounts, credentials, emails, changes to the accepted 8-character password/recovery/name/session rules, deployment or lifting the existing runtime start hold.

## Expected behavior and edge cases

Initial login/registration will offer email/password and Google. Apple has no active button, provider operation or mandatory live test in this release. A forged request for the deferred provider must receive a safe unsupported/unavailable result. Missing Apple membership/keys/renewal ownership never blocks initial COR0027 completion. Different-address/relay privacy remains a future constraint, not a claim of working Apple login.

## Assumptions, decisions, and dependencies

Confirmed: Apple is deferred, not cancelled; Google is the only initial social provider. Password authentication stays in scope. DEV0286 owns shared Auth/password foundations, DEV0287 Google, DEV0288 views/Account controls and DEV0289 integrated evidence. DEV0312 is independent deferred work, not a required COR0027 member or child of DEV0287. Existing fix-validation/commit sequencing remains separate from this provider-scope choice.

## Implementation plan

1. Record the narrower current target and dated supersession of DEV0285's Apple delivery requirement in the specification.
2. Narrow/rename DEV0287 to Google without reusing its ID or discarding its planning history; update current links and peer UI/proof criteria.
3. Map this amendment as a direct COR0027 member and Apple as the explicitly non-blocking independent follow-up DEV0312.
4. Check links, ID/membership/lifecycle consistency and current versus historical Apple references; complete/archive this documentation ticket after checks pass.

## Acceptance criteria

- [x] AC1: The specification clearly requires email/password plus Google initially, with Apple deferred and the existing password/recovery/privacy contract preserved.
- [x] AC2: COR0027 has one direct owner per current deliverable; DEV0312 owns deferred Apple outside initial completion conditions.
- [x] AC3: Google integration, UI and UAT criteria no longer require Apple setup/buttons/live proof, while preserving truthful unavailable-provider and exact-recipient privacy behavior.
- [x] AC4: Documentation/link/ID/lifecycle/format checks pass, prior completed records remain historical, and no runtime/provider operation occurs.

## Validation plan

Use a scoped Python link/anchor/record/member and provider-scope validator, focused Markdown formatting and git diff --check. Review current requirements against the initial Google-only social target and pending runtime evidence. Application/database/browser/provider tests are not applicable to this documentation-only amendment.

## Implementation record

### Changes and rationale

2026-10-17: Amended the current target from three required authentication methods to email/password and Google. DEV0287 keeps its existing ID with a Google-only title/file/scope; DEV0288 and DEV0289 no longer require Apple controls or live Apple proof. Independent Draft DEV0312 preserves future Apple work, including account/signing/relay/renewal prerequisites. COR0027 can complete without that follow-up. The prior DEV0285 contract remains unchanged completed history, with this dated supersession in the specification and current records.

### Affected files

- [Specification](../../../docs/mvp-spec.md#41-register-as-an-athlete-or-apply-to-coach): C41, methods/routes/interfaces, identity, definition of done, milestone and acceptance scenarios now distinguish the initial Google/password target from deferred Apple. The 8-character password, verification, recovery, session and data-continuity rules remain.
- [COR0027](../../current/organisatory/COR0027-login-registration-and-social-authentication.md): six reciprocal direct members, unique deliverable ownership and Google-only completion, with independent Apple explicitly non-blocking.
- [DEV0286](../../current/backend/DEV0286-implement-password-authentication-and-recovery.md), [DEV0287](../../current/backend/DEV0287-integrate-google-authentication.md), [DEV0288](../../current/frontend/DEV0288-redesign-multi-method-login-and-registration.md) and [DEV0289](../../current/backend/DEV0289-rehearse-multi-method-authentication-for-uat.md): matching initial scope, Google-only live proof/UI and safe unsupported-provider handling; runtime remains Draft/on hold.
- [DEV0312](../../current/backend/DEV0312-integrate-deferred-apple-authentication.md): independent deferred Apple scope, prerequisites and future acceptance plan; no Apple account operation is authorized now.
- [COR0024](../../current/organisatory/COR0024-email-invitations-and-shareable-links.md), [DEV0259](../../current/organisatory/DEV0259-define-invitation-and-link-consent.md) and [DEV0263](../../current/frontend/DEV0263-review-and-accept-athlete-invitations.md): downstream identity notes follow the narrower current target while retaining exact-recipient privacy. [DEV0291](DEV0291-adopt-provider-boundaries-and-recovery-requirements.md) receives path maintenance only for the renamed Google peer; its historical evidence remains intact.
- [Ticket index](../../README.md): current/archived status and renamed/new record links. Runtime source/configuration and independent Home/banner/marketplace work remain outside this ticket.

### Decisions and deviations

2026-10-17: User explicitly postponed Apple account work and selected Google as the initial social provider. Retain accepted email/password behavior and move future Apple ownership out of the initial release rather than leaving a mandatory unsatisfied provider criterion.

Concurrent marketplace drafting temporarily reused DEV0311/DEV0312. That task corrected its own draft allocations to DEV0320/DEV0321; this amendment and the Apple follow-up retained their original IDs. Final unique-ID validation passed. No Auth ID exception or renumbering was applied.

### Contracts, configuration, and operations

Future contract amendment only. No schema/API implementation, dependencies, environment values, secrets, external account/provider setting, email, migration or deployment changed. Apple return/relay/renewal requirements must be reviewed when DEV0312 resumes.

## Validation results

2026-10-17, repository documentation review:

- `python3 /tmp/dev0311-validate-deferral.py` passed: scoped Markdown links/anchors, unique DEV/COR records, index/lifecycle, six reciprocal COR0027 members, Google-only current criteria and independent deferred Apple. SHA-256 comparison confirms completed DEV0285 is unchanged by this amendment. Repeated after archival/link maintenance.
- `node_modules/.bin/prettier --check` passed for this record, DEV0312, COR0027 and DEV0286–DEV0289. Scoped `git diff --check` passed for the changed authentication/consumer/specification/index documents.
- Manual review separated historical three-method statements and future relay privacy constraints from current required methods, controls and live proof. Google configuration and runtime evidence remain pending, with no Apple requirement hidden in initial completion.
- Application, database, browser and provider checks: Not run — documentation only; no runtime/configuration/provider/account operation was performed. Unrelated workspace changes were preserved. No commit or deployment occurred.

| Criterion | Evidence                                                                                                                         | Result |
| --------- | -------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Current specification methods/routes/interfaces and unchanged password/recovery/session rules; scoped provider-scope assertions. | Passed |
| AC2       | COR0027 ownership/completion map, six reciprocal members and independent Draft DEV0312; unique-ID/index checks.                  | Passed |
| AC3       | DEV0287–DEV0289 current criteria and invitation consumer review; no initial Apple controls or live-proof requirement.            | Passed |
| AC4       | Link/anchor/lifecycle/format/whitespace checks and unchanged DEV0285 hash; documentation-only diff review.                       | Passed |

## Risks, limitations, and follow-ups

Google still requires its own actual configuration and real sign-in proof under DEV0287/DEV0289; deferring Apple does not establish Google readiness. DEV0312 remains Draft until the user resumes Apple. Current fixes and the existing runtime start sequence are separate. This completed documentation amendment does not complete COR0027 or deliver new authentication behavior.

## Completion and review references

- Completed: 2026-10-17 — documentation amendment and scoped review passed; archived with link/index maintenance.
- Commit: Not created for this request.
- Review: Documentation self-review against AC1–AC4; no independent or runtime review.
- Deployment or release: None.
