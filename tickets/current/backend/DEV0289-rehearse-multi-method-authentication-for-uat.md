# Ticket DEV0289: Rehearse multi-method authentication for UAT

- Status: Blocked
- Created: 2026-10-17
- Last updated: 2026-10-19
- Milestone: Authentication quality before user acceptance testing (UAT)
- Coordination: [COR0027 — Login, registration and social authentication](../organisatory/COR0027-login-registration-and-social-authentication.md)
- Related records: Direct peer/dependency boundaries and external consumers are mapped by COR0027. Historical identity foundations: [DEV0046](../../archive/backend/DEV0046-email-otp-registration-and-application-profiles.md) and [DEV0147](../../archive/backend/DEV0147-separate-client-onboarding-and-verified-coach-access.md).

## Objective and context

Prove the integrated password and Google experience with real new/returning/existing users before claiming authentication ready for UAT.

Use the current [registration contract](../../../docs/mvp-spec.md#41-register-as-an-athlete-or-apply-to-coach), [identity/privacy rules](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity), [definition of done](../../../docs/mvp-spec.md#11-definition-of-done), [milestones](../../../docs/mvp-spec.md#12-delivery-milestones) and [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix). The local password-first flow is implemented; DEV0322 removes the former email-code fallback at the user’s request. Real Google and hosted/combined UAT readiness remain pending.

## Scope and non-goals

In scope: combined scenario/fixture plan, reusable guarded rehearsal updates, actual local email and hosted-dev Google/password flows, account/data continuity, protected returns, recovery/errors, responsive/keyboard integration evidence and exact cleanup/handoff. Out of scope: deferred Apple setup/live proof and implementing missing peer functionality inside this proof ticket, provider/project provisioning, production deployment or unrelated scheduling changes.

2026-10-18 start boundary: after committing the completed frontend, the user requested moving to this ticket. Prepare the scenario/evidence matrix and inspect prerequisites now. The actual combined rehearsal still requires DEV0286 hosted readiness and DEV0287 real Google integration; the user's decision to close DEV0288 with Google unavailable did not waive those conditions. Do not recreate local fixtures merely to repeat the freshly recorded frontend evidence while the required provider path is absent.

## Expected behavior and edge cases

The integrated application uses one adopted account authority across all selected methods. New users verify email, choose a unique username/private full name/visible display name, then may add or defer a private picture; returning enrolled users retain their data and skip required entry. Existing passwordless accounts can set a password, and reviewed identity-linking behavior preserves private data. The shared default return is Home, with required recovery/verification/profile and explicit coach/internal returns taking precedence. Different verified Google emails cannot claim a targeted invitation; the deferred Apple/relay case retains the same future address boundary. Auth actions do not themselves accept invitations, book sessions or send messages. Clearly distinguish current local/hosted origins, simulated failure coverage and actual provider evidence.

## Assumptions, decisions, and dependencies

Starts after contract/amendment DEV0285/DEV0311 and runtime DEV0286–DEV0288 meet their own criteria and required dev/UAT origin, SMTP, Google test accounts exist. Those environment/provider prerequisites are external start blockers; no email, account or project action occurs in planning. Runtime defects go to the owning peer with its scope updated first. Fixture creation/deletion is bounded to exact controlled IDs, with credentials/tokens excluded from evidence.

The [adopted contract](../../../docs/mvp-spec.md#411-methods-and-account-resolution) supplies password, linking, recovery/session, current registration-field, route and Account behavior. The user authorized implementation after checkpoint `1314f20`. Completed [DEV0288](../../archive/frontend/DEV0288-redesign-multi-method-login-and-registration.md) and [DEV0324](../../archive/frontend/DEV0324-default-authentication-return-to-home.md)/[DEV0325](../../archive/backend/DEV0325-collect-registration-names-and-unique-username.md)/[DEV0328](../../archive/frontend/DEV0328-offer-optional-registration-profile-picture.md) supply the local frontend/profile baseline, committed together as `002a1c4`. [DEV0286](DEV0286-implement-password-authentication-and-recovery.md) remains In progress for hosted readiness and provider-order continuity; [DEV0287](DEV0287-integrate-google-authentication.md) is Blocked: its runtime checkpoint `ebc36af` is committed on an isolated branch, with shared-checkout integration, actual Google setup/live proof and mobile review still open. This proof peer is Blocked at preflight, not a completed or failed UAT rehearsal.

This is one direct peer under a flat coordination record. Dependencies do not create child tickets. Record material scope/behavior changes before implementation and split/consolidate through the repository policy if this boundary proves too broad. Ready is not an additional approval gate.

## Implementation plan

1. Define combined new/returning/passwordless-transition and same/different-provider account scenarios against the adopted contract, with exact data fingerprints and cleanup.
2. Run actual loopback confirmation/recovery/password flows and real hosted-dev password/Google login and return flows through the complete UI.
3. Check verification/authorization, duplicate/cancellation/expiry/network recovery, different-email privacy and unsupported-provider handling, responsive/keyboard behavior and public regressions; fix defects in their owners.
4. Record exact commands/settings prerequisites, observed results and remaining limitations; verify cleanup and coordinated UAT handoff without claiming deployment.

### Scenario and start checklist — 18 October 2026

| Scenario group                          | Evidence to capture in the combined run                                                                                                                                                                    | Current evidence and prerequisite owner                                                                                                                                                  |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Verified new registration               | Actual local/hosted confirmation, no early actor, unique-handle conflict/retry, private full name, chosen display/chat name, optional picture/skip and default Home.                                       | Local baseline: DEV0325/DEV0328/DEV0288; hosted readiness: DEV0286. Repeat on the final integrated release, not against a fake provider.                                                 |
| Returning identity and private data     | Original Auth subject/profile, username/names, avatar bytes and representative coach approval/request/booking/message data retained across repeat login.                                                   | Local baseline exists; choose newly tagged controlled fixtures for broader continuity. No retained coach/account/password edits or provisioning.                                         |
| Password boundaries and recovery        | Seven/eight characters, spaces/paste/multibyte limits, proof purpose/browser/expiry/replay, resend spacing, generic unknown/duplicate outcomes, old-password failure and current-password checks.          | Real local baseline: DEV0286 and registration peers. Hosted SMTP/templates, notification, breached-password/session capability and rollback evidence remain DEV0286.                     |
| Device/session authority                | Ordinary current-device sign-out; two-browser reset/change, restricted recovery before update, failed old refresh and protected-request denial within the adopted bound.                                   | Existing local evidence is supporting baseline; final hosted/device evidence is required after DEV0286 readiness. Do not infer instant provider-token expiry from local UI.              |
| Google new/returning and cancellation   | Actual enabled control/start/callback, confirmed server identity, denied/cancelled/expired/missing-state recovery, required registration fields and repeat identity.                                       | Blocked by DEV0287 implementation/configuration and controlled Google access. Disabled controls or mocked callbacks cannot pass this group.                                              |
| Method order and conflicting addresses  | Password-first/same verified Google email; Google-first/verified password setup; different/unconfirmed/conflicting addresses; unchanged private data and no arbitrary account merge.                       | Blocked by DEV0287 real provider flow, then shared DEV0286 interfaces. Use controlled provider accounts; remove only newly created MovX fixtures, not Google accounts or retained users. |
| Returns, coach intent and privacy       | Home/explicit internal/hostile-loop returns, explicit pending application without approval, no automatic booking/message/invitation, exact verified-address boundary and Account method/password controls. | Local frontend baseline completed in DEV0288. Integrate real provider returns after DEV0287; downstream invitation implementation remains COR0024.                                       |
| Responsive/recovery and release handoff | Final mobile/desktop/keyboard/error review, actual configuration and origin ledger, exact-ID cleanup, preserved-data hashes, static/build results and remaining limitations.                               | DEV0288 baseline: five widths/native 200%/keyboard and 370 checks. This ticket must gather final combined evidence after all required peers pass. No deployment is implied.              |

Next actions in order: (1) DEV0287 implements and proves real Google readiness/start/callback using the existing gateway and branded controls; identify the owned Google web client, consent/test audience, exact allowed origins/callbacks and controlled same/distinct-email accounts without recording secrets. (2) DEV0286 completes actual hosted ledger/settings/SMTP/template/session/breach/rollback evidence. (3) Recheck every direct peer and run the combined matrix on the final allowed local/hosted-dev origins, with an exact fixture/cleanup journal written before mutations. Missing or uninspected configuration stays unverified rather than being described as absent or working.

## Acceptance criteria

- [ ] AC1: Actual local signup/confirmation/password login/reset and existing-code-account setup preserve original subject/profile/data. The adopted 7/8-character boundaries, no-mixture/space/multibyte cases, unauthorized/unconfirmed/recovery-only gates, single-use/expiry/resend limits, old-password rejection pass, and removed code-login commands/proofs cannot confer application authority.
- [ ] AC2: Actual hosted-dev password and Google new/returning/cancel/recovery flows, same-email linking in both method orders and distinct Google-email cases pass through final UI; Google is not marked delivered from mocks alone; Apple live proof is not required. The initial UI has no Apple action and a forged Apple request fails safely. New profiles follow the required username/private full name/display name and optional-picture contract without a verified-legal-name claim or silently populated private name/username.
- [ ] AC3: Default/safe returns and hostile-loop rejection, explicit coach application, focused Account password/method controls, private-data isolation, exact-recipient invitation boundary and no automatic business mutations pass desktop/mobile/keyboard/failure review. Two-browser reset/change/current-device sign-out and the adopted refresh/access-token revocation bound are proven.
- [ ] AC4: Required application/static/build checks, actual hosted confirmation/notification/breached-password/session/provider settings and precise fixture cleanup pass; every other direct peer is Completed or explicitly replaced/cancelled and UAT sign-off confirms the user-directed code-login removal and verified password setup for legacy users. The handoff distinguishes tested environments/configuration from deployment; missing paid/provider capabilities stay blockers.

## Validation plan

Run the updated npm run test:auth and peer real-provider smoke commands on their documented allowed targets, npm test, focused browser suite, npm run lint, npm run typecheck, npm run format:check and npm run build. Record a scenario-to-evidence matrix, identity/data before/after and zero own-fixture leftovers. Use actual email/provider access for success and appropriate deterministic fixtures for otherwise impractical failures. Any missing mandatory provider/environment/browser evidence keeps this record open.

## Implementation record

### Changes and rationale

2026-10-19 commit handoff: the provider core has been reconstructed and committed as `ebc36af` on isolated branch `dev0287-google-auth`. It is not integrated into the shared app or enabled. This makes its code durable while leaving the original Google configuration/live identity tests, mobile review and DEV0286 hosted readiness prerequisites open. No combined UAT rehearsal or hosted/account operation occurred; this remains a documentation-only preflight.

2026-10-18: prepared the combined scenario/start matrix and audited the committed local implementation. DEV0288's accepted completion boundary is frontend-only with Google unavailable. The application command union/parser currently has no provider-start/callback action, `src/app/auth/` contains only email confirmation, and login/register keep Google disabled. DEV0287 therefore needs implementation, not merely a real-login test. DEV0286 explicitly records remaining hosted settings/capability/rollback and provider-order gaps. Marked this ticket Blocked at preflight and retained all four acceptance criteria as open. No new real flow, email, OAuth authorization, fixture mutation, provider administration or hosted access occurred in this preflight.

### Affected files

This record, the root ticket index and COR0027: current registration/continuation criteria, scenario-to-owner matrix, explicit blockers and next actions. No runtime/helper/test implementation change yet. Peer tickets retain Auth services/provider setup; future rehearsal changes stay within this ticket's existing plan.

### Decisions and deviations

2026-10-17 later user decision: remove email-code login now, superseding the previously planned through-UAT fallback. [DEV0322](../../archive/backend/DEV0322-remove-email-code-login.md) owns this application/contract change. Earlier code-login evidence below remains historical; confirmation and recovery email links remain required.

2026-10-17 later scope change under DEV0311: initial delivery is email/password and Google; the user deferred Apple account/setup. Apple controls and live provider proof are excluded from this peer and preserved in independent DEV0312. Earlier three-method planning history below is retained. Runtime remains Draft; no implementation/provider operation occurred.

2026-10-17 contract alignment under DEV0285: updated this peer's scope/criteria to consume the adopted specification, including the confirmed 8-character/no-mixture policy and its relevant linking, profile, recovery/session, route and Account boundaries. This is documentation alignment only; runtime remains Draft/on hold and all implementation acceptance evidence is pending.

2026-10-17: Created as a fresh direct peer when retired DEV0283 expanded from presentation to password and Google/Apple authentication. No runtime implementation deviation; confirmed method choices are distinct from proposed implementation details.

### Contracts, configuration, and operations

Planning only so far: no runtime API/schema, dependencies, secrets, provider accounts/settings, mail sending or deployment changes. Future interfaces and exact configuration/rollback belong to the scope above; no application password store or provider migration is implied. Record any necessary change before applying it and preserve existing identities/data.

## Validation results

19 October primary-checkout documentation checkpoint: four Auth/setup/coordination documents pass scoped formatting and **80 local link checks**; both current/index statuses are Blocked and all eight acceptance criteria remain open. `git diff --check` passes. The commit is restricted to seven Auth documentation paths; application checks are the separately validated isolated DEV0287 checkpoint, with no new main runtime change.

- 2026-10-18 preflight: read the current specification, completed frontend/profile records and DEV0286/DEV0287 criteria. Inspected `src/auth/operations.ts`, `src/features/auth/sign-in.tsx`, `rg --files src/app/auth src/auth src/server/auth` and the local provider configuration in `supabase/config.toml`: no implemented Google start/callback flow, disabled UI and no configured local Google section. This says nothing about uninspected hosted settings or privately held Google credentials.
- Supporting committed baseline, not a new combined pass: DEV0288 records real local confirmation/login/returns/explicit coach application, native five-width/200%/keyboard review and 370 unit/server checks; DEV0286/DEV0325/DEV0328 record local password/recovery/profile/picture continuity. These do not satisfy AC2 or hosted AC4.
- This continuation is documentation/preflight only. Application/browser/database tests were not rerun because no runtime changed and the absent provider path prevents the required combined run. No retained data, credentials or provider/hosted settings were read or changed. Local link/status/ownership checks are required before handoff.
- Preflight document validation passed: scoped Python audit checked **339 repository-relative links** across this ticket, COR0027 and the index, one Blocked current DEV0289/index entry, four still-open criteria and an empty staging area. Scoped Prettier and `git diff --check` passed. Result: ignored `tmp/auth-presentation/dev0289-preflight-docs-result.json`. That 18 October preflight was uncommitted at the time; the user requested preserving it in the 19 October documentation checkpoint.

- Date/environment: 2026-10-17, repository planning.
- Documentation checks passed on 2026-10-17: scoped Python validation checked 11 documents, 377 local links, 52 anchors and 200 unique records; retirement, five reciprocal direct memberships, index/status/template consistency and next IDs DEV0290/COR0028 passed. Focused Markdown formatting and whitespace checks are recorded under DEV0285; these checks do not establish runtime acceptance.
- Runtime/application/provider/browser checks: not run — this is planning; all runtime criteria remain open.

| Criterion | Evidence                                                                                                    | Result  |
| --------- | ----------------------------------------------------------------------------------------------------------- | ------- |
| AC1–AC4   | No completed implementation/contract acceptance proof yet. Planning checks do not satisfy runtime criteria. | Not run |

## Risks, limitations, and follow-ups

Blocked by DEV0287's pending shared-checkout integration and real Google configuration/proof, plus DEV0286's unverified hosted readiness. Complete those owners, then resume this matrix. Keep the already accepted frontend boundary intact; this ticket must not enable Google cosmetically, waive hosted/security requirements, implement downstream invitations or mutate retained coach/account data to manufacture acceptance evidence.

## Completion and review references

- Completed: Not completed.
- Commit: 19 October documentation checkpoint subject `[DEV0287][DEV0289] Record Google setup and authentication handoff`; the separate DEV0287 runtime is `ebc36af`. This ticket has no rehearsal implementation commit or completed acceptance.
- Review: Planning/preflight self-review on 2026-10-18; scenario ownership and concrete implementation blockers identified. The updated preflight is included in the user-requested 19 October checkpoint; no independent review or completed UAT claim.
- Deployment or release: None.
