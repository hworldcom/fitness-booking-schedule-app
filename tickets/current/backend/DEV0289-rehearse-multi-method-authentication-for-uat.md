# Ticket DEV0289: Rehearse multi-method authentication for UAT

- Status: Draft
- Created: 2026-10-17
- Last updated: 2026-10-17
- Milestone: Authentication quality before user acceptance testing (UAT)
- Coordination: [COR0027 — Login, registration and social authentication](../organisatory/COR0027-login-registration-and-social-authentication.md)
- Related records: Direct peer/dependency boundaries and external consumers are mapped by COR0027. Historical identity foundations: [DEV0046](../../archive/backend/DEV0046-email-otp-registration-and-application-profiles.md) and [DEV0147](../../archive/backend/DEV0147-separate-client-onboarding-and-verified-coach-access.md).

## Objective and context

Prove the integrated password and Google experience with real new/returning/existing users before claiming authentication ready for UAT.

Use the current [registration contract](../../../docs/mvp-spec.md#41-register-as-an-athlete-or-apply-to-coach), [identity/privacy rules](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity), [definition of done](../../../docs/mvp-spec.md#11-definition-of-done), [milestones](../../../docs/mvp-spec.md#12-delivery-milestones) and [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix). The delivered application still uses email codes until these runtime peers pass.

## Scope and non-goals

In scope: combined scenario/fixture plan, reusable guarded rehearsal updates, actual local email and hosted-dev Google/password flows, account/data continuity, protected returns, recovery/errors, responsive/keyboard integration evidence and exact cleanup/handoff. Out of scope: deferred Apple setup/live proof and implementing missing peer functionality inside this proof ticket, provider/project provisioning, production deployment or unrelated scheduling changes.

## Expected behavior and edge cases

The integrated application uses one adopted account authority across all selected methods. New users verify/complete the minimal profile, returning users retain it, old code users can set a password, and reviewed identity-linking behavior preserves private data. Different verified Google emails cannot claim a targeted invitation; the deferred Apple/relay case retains the same future address boundary. Auth actions do not themselves accept invitations, book sessions or send messages. Clearly distinguish current local/hosted origins, simulated failure coverage and actual provider evidence.

## Assumptions, decisions, and dependencies

Starts after contract/amendment DEV0285/DEV0311 and runtime DEV0286–DEV0288 meet their own criteria and required dev/UAT origin, SMTP, Google test accounts exist. Those environment/provider prerequisites are external start blockers; no email, account or project action occurs in planning. Runtime defects go to the owning peer with its scope updated first. Fixture creation/deletion is bounded to exact controlled IDs, with credentials/tokens excluded from evidence.

The [adopted contract](../../../docs/mvp-spec.md#411-methods-and-account-resolution) now supplies exact password, linking, recovery/session, name, route and Account behavior. The user's preceding fix-validation/commit sequence remains a runtime hold. Keep the distinction between documenting those decisions and actually proving local/hosted readiness.

This is one direct peer under a flat coordination record. Dependencies do not create child tickets. Record material scope/behavior changes before implementation and split/consolidate through the repository policy if this boundary proves too broad. Ready is not an additional approval gate.

## Implementation plan

1. Define combined new/returning/passwordless-transition and same/different-provider account scenarios against the adopted contract, with exact data fingerprints and cleanup.
2. Run actual loopback confirmation/recovery/password flows and real hosted-dev password/Google login and return flows through the complete UI.
3. Check verification/authorization, duplicate/cancellation/expiry/network recovery, different-email privacy and unsupported-provider handling, responsive/keyboard behavior and public regressions; fix defects in their owners.
4. Record exact commands/settings prerequisites, observed results and remaining limitations; verify cleanup and coordinated UAT handoff without claiming deployment.

## Acceptance criteria

- [ ] AC1: Actual local signup/confirmation/password login/reset and existing-code-account setup preserve original subject/profile/data. The adopted 7/8-character boundaries, no-mixture/space/multibyte cases, unauthorized/unconfirmed/recovery-only gates, single-use/expiry/resend limits, old-password rejection and secondary existing-account-only code entry pass.
- [ ] AC2: Actual hosted-dev password and Google new/returning/cancel/recovery flows, same-email linking in both method orders and distinct Google-email cases pass through final UI; Google is not marked delivered from mocks alone; Apple live proof is not required. The initial UI has no Apple action and a forged Apple request fails safely. Missing names follow the existing presentation-name contract without private legal-name inference.
- [ ] AC3: Default/safe returns and hostile-loop rejection, explicit coach application, focused Account password/method controls, private-data isolation, exact-recipient invitation boundary and no automatic business mutations pass desktop/mobile/keyboard/failure review. Two-browser reset/change/current-device sign-out and the adopted refresh/access-token revocation bound are proven.
- [ ] AC4: Required application/static/build checks, actual hosted confirmation/notification/breached-password/session/provider settings and precise fixture cleanup pass; every other direct peer is Completed or explicitly replaced/cancelled and UAT sign-off records the email-code transition condition. The handoff distinguishes tested environments/configuration from deployment; missing paid/provider capabilities stay blockers.

## Validation plan

Run the updated npm run test:auth and peer real-provider smoke commands on their documented allowed targets, npm test, focused browser suite, npm run lint, npm run typecheck, npm run format:check and npm run build. Record a scenario-to-evidence matrix, identity/data before/after and zero own-fixture leftovers. Use actual email/provider access for success and appropriate deterministic fixtures for otherwise impractical failures. Any missing mandatory provider/environment/browser evidence keeps this record open.

## Implementation record

### Changes and rationale

Not started. No real flow, email, OAuth authorization or fixture mutation has been performed for this plan.

### Affected files

Planned: guarded auth rehearsal helpers/commands, relevant Auth/browser/authorization tests and this evidence record. Peer tickets own runtime Auth services, provider setup and interface changes.

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
| AC1–AC4   | No completed implementation/contract acceptance proof yet. Planning checks do not satisfy runtime criteria. | Not run |

## Risks, limitations, and follow-ups

Need every runtime peer and actual test/provider environments. Do not repair missing implementation or mutate unrelated user records under an integration-only ticket.

## Completion and review references

- Completed: Not completed.
- Commit: Planning record included in the user-authorized workspace checkpoint under DEV0285; no runtime implementation commit or completed acceptance is claimed.
- Review: Planning self-review only; no independent or implementation review.
- Deployment or release: None.
