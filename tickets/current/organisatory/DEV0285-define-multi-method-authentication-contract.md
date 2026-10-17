# Ticket DEV0285: Define the multi-method authentication contract

- Status: In progress
- Created: 2026-10-17
- Last updated: 2026-10-17
- Milestone: Authentication quality before user acceptance testing (UAT)
- Coordination: [COR0027 — Login, registration and social authentication](COR0027-login-registration-and-social-authentication.md)
- Related records: Direct peer/dependency boundaries and external consumers are mapped by COR0027. Historical identity foundations: [DEV0046](../../archive/backend/DEV0046-email-otp-registration-and-application-profiles.md) and [DEV0147](../../archive/backend/DEV0147-separate-client-onboarding-and-verified-coach-access.md).

## Objective and context

Define one reviewed account contract for email/password registration and login, Google and Apple sign-in, email verification, recovery and existing-user continuity. The user selected these methods on 17 October 2026 after initially asking for a professional UAT redesign. This ticket owns the planning conversion, confirmed-target specification update and flat work map; it does not implement runtime Auth.

Use the current [registration contract](../../../docs/mvp-spec.md#41-register-as-an-athlete-or-apply-to-coach), [identity/privacy rules](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity), [definition of done](../../../docs/mvp-spec.md#11-definition-of-done), [milestones](../../../docs/mvp-spec.md#12-delivery-milestones) and [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix). The delivered application still uses email codes until these runtime peers pass.

## Scope and non-goals

In scope: product/identity rules, verified-email enrollment, password and callback policies, provider identity resolution/linking, old email-code accounts, safe return/onboarding, invitation-recipient compatibility, environment ownership and peer interface/acceptance requirements. Out of scope: runtime code, actual provider settings/accounts/emails, deployment, native app implementation and custom identity or password storage.

## Expected behavior and edge cases

Normal login uses email/password or Continue with Google/Apple. Social authentication may register a new user or recover an existing user; application enrollment still requires server-verified identity and a valid minimal profile. Coach approval stays separate. Existing account subjects and private data must be preserved. Apple relay addresses must not be treated as another email without verified ownership; targeted invitations still require the exact invited verified address and separate acceptance. No login action submits a booking or sends a message.

## Assumptions, decisions, and dependencies

17 October 2026 modularity/recovery refinement: the user explicitly requested modular code and recovery testing. Adopt narrow application Auth operation/session/event/result interfaces before runtime peers start; DEV0286 owns the gateway/shared verification adapter, DEV0287 provider-specific operations and DEV0288 consumption by the UI. Keep stable MovX profile IDs and record current Auth-table/UUID coupling honestly; a future vendor swap still needs a reviewed identity/schema transition. Independent [DEV0292](../backend/DEV0292-isolate-profile-image-storage-adapter.md) owns Storage isolation, and [DEV0293](../backend/DEV0293-rehearse-database-auth-and-file-recovery.md) owns complete disaster recovery. Neither is a direct COR0027 member or a substitute for its method-specific validation. Password reset and full-system restore are distinct outcomes.

Confirmed: professional UAT quality and all three methods. Recommended implementation default: retain existing Supabase Auth rather than add a second identity system. Existing project contracts prohibit automatic application-account merging; Supabase documents automatic same-email identity linking, so explicitly settle/test that behavior before provider rollout. Do not silently replace the existing rule with a provider default. Password policy, concrete routes/callbacks, existing-user setup and verified-email gates remain to be adopted before runtime peers start. Existing dependencies are Next.js 16.3.8, Supabase JS 2.116.0 and SSR 0.12.7; inspect installed docs before integration changes.

Planning sources reviewed: Supabase [password authentication](https://supabase.com/docs/guides/auth/passwords), [Google](https://supabase.com/docs/guides/auth/social-login/auth-google), [Apple](https://supabase.com/docs/guides/auth/social-login/auth-apple), [identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking) and [redirects](https://supabase.com/docs/guides/auth/redirect-urls), plus Apple's [web configuration requirements](https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web/). Managed alternatives reviewed were [Clerk](https://clerk.com/docs/guides/configure/auth-strategies/social-connections/overview), [Auth0](https://auth0.com/docs/authenticate/identity-providers/social-identity-providers) and [Firebase Authentication](https://firebase.google.com/docs/auth). Keeping Supabase avoids introducing a new identity authority/migration into this existing application; that is a project-specific recommendation, not a claim that one provider is universally best.

This is one direct peer under a flat coordination record. Dependencies do not create child tickets. Record material scope/behavior changes before implementation and split/consolidate through the repository policy if this boundary proves too broad. Ready is not an additional approval gate.

## Implementation plan

1. Review current identity/session/profile authority, current Auth settings and official password/Google/Apple/linking documentation.
2. Record exact password, verification/recovery, callback/return, account-resolution and old-user transition rules in the specification, distinguishing confirmed choices from defaults.
3. Agree ownership/interfaces with the password, social-provider, interface and proof peers; reconcile invitation consumers without weakening their exact-recipient rule.
4. Validate links, unique/retired IDs, reciprocal membership, acceptance coverage and current-versus-target language. Keep the contract open until unresolved operating details are adopted.

## Acceptance criteria

- [ ] AC1: The specification clearly states the three selected methods and current email-code delivery status, plus exact verified-email, recovery and preserved-account rules before runtime starts.
- [ ] AC2: A reviewed identity-linking policy reconciles Supabase same-email linking with the no-automatic-account-merge constraint, Apple relay identities and targeted invitations; no unverified identity grants authority.
- [ ] AC3: Password/routes/callback/return/onboarding and environment interfaces are concrete, with each implementation part assigned once in COR0027 and every direct member linking back.
- [x] AC4: Documentation checks and scope review pass; initial DEV0283 history/validation is preserved, DEV0283 is retired and no runtime/hosted change is claimed.

## Validation plan

Run scoped Markdown formatting, a local-link/anchor and record/index/membership validator and git diff --check. Review the specification against all peer acceptance criteria and invitation exact-email examples. No application/database/provider tests for this documentation ticket; runtime proof belongs to its peers.

## Implementation record

### Changes and rationale

2026-10-17: Started planning reconciliation and pre-implementation conversion of DEV0283 after the user selected email/password, then Google/Apple. The specification target and work map are documentation work only. Detailed linking/password/callback defaults remain incomplete; do not mark the contract Completed or runtime peers Ready yet.

### Affected files

Current specification, ticket index, COR0027 and its five peers; current COR0024/DEV0259/DEV0263 dependency notes. Runtime source and hosted configuration are unchanged.

### Decisions and deviations

2026-10-17: Created as a fresh direct peer when retired DEV0283 expanded from presentation to password and Google/Apple authentication. No runtime implementation deviation; confirmed method choices are distinct from proposed implementation details.

### Contracts, configuration, and operations

Planning only so far: no runtime API/schema, dependencies, secrets, provider accounts/settings, mail sending or deployment changes. Future interfaces and exact configuration/rollback belong to the scope above; no application password store or provider migration is implied. Record any necessary change before applying it and preserve existing identities/data.

## Validation results

- Date/environment: 2026-10-17, repository planning.
- Documentation checks passed on 2026-10-17: scoped Python validation checked 11 documents, 377 local links, 52 anchors and 200 unique records; retirement, five reciprocal direct memberships, index/status/template consistency and next IDs DEV0290/COR0028 passed. Focused Markdown formatting and whitespace checks are recorded under DEV0285; these checks do not establish runtime acceptance.
- Runtime/application/provider/browser checks: not run — this is planning; all runtime criteria remain open.

- Exact planning commands: an inline `python3` standard-library validator produced the counts above; `node_modules/.bin/prettier --check` over COR0027 and DEV0285–DEV0289 and `git diff --check --` over the eleven scoped documents passed. Link checks also verified the specification, index and the three modified invitation records.
- Scope review: edits are documentation only. Initial DEV0283 presentation/validation history is retained in COR0027, its password clarification is recorded before the Google/Apple expansion, and independent DEV0284/concurrent index changes were preserved. No credential, provider account/setting, email, runtime or deployment operation was performed. Application/database/browser/provider tests were not run because this checkpoint changes planning only; they remain required in the runtime peers.

| Criterion | Evidence                                                                                                                               | Result     |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| AC1       | Selected methods/current runtime recorded; exact password/callback/verification operating defaults remain to be adopted.               | Incomplete |
| AC2       | Same-email linking/no-merge and Apple relay constraints identified; final reviewed policy/proof is unfinished.                         | Incomplete |
| AC3       | Complete flat ownership and reciprocal links exist; final routes/interfaces are still contract work.                                   | Incomplete |
| AC4       | Conversion history, retirement, unique IDs/index/membership and target-versus-delivered boundaries passed scoped documentation review. | Passed     |

## Risks, limitations, and follow-ups

Next: adopt the exact operating details in AC1–AC3. Supabase is the recommendation, not a user-selected vendor migration. Provider credentials/Apple Developer access have not been inspected or provisioned.

## Completion and review references

- Completed: Not completed.
- Commit: This user-authorized checkpoint includes the contract/work-map planning and peer records (subject includes DEV0285). Contract details remain In progress; password/social runtime is not implemented.
- Review: Planning self-review only; no independent or implementation review.
- Deployment or release: None.
