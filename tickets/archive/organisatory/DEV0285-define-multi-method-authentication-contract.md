# Ticket DEV0285: Define the multi-method authentication contract

- Status: Completed
- Created: 2026-10-17
- Last updated: 2026-10-17
- Milestone: Authentication quality before user acceptance testing (UAT)
- Coordination: [COR0027 — Login, registration and social authentication](../../current/organisatory/COR0027-login-registration-and-social-authentication.md)
- Related records: Direct peer/dependency boundaries and external consumers are mapped by COR0027. Historical identity foundations: [DEV0046](../backend/DEV0046-email-otp-registration-and-application-profiles.md) and [DEV0147](../backend/DEV0147-separate-client-onboarding-and-verified-coach-access.md).

## Objective and context

Define one reviewed account contract for email/password registration and login, Google and Apple sign-in, email verification, recovery and existing-user continuity. The user selected these methods on 17 October 2026 after initially asking for a professional UAT redesign. This ticket owns the planning conversion, confirmed-target specification update and flat work map; it does not implement runtime Auth.

Use the current [registration contract](../../../docs/mvp-spec.md#41-register-as-an-athlete-or-apply-to-coach), [identity/privacy rules](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity), [definition of done](../../../docs/mvp-spec.md#11-definition-of-done), [milestones](../../../docs/mvp-spec.md#12-delivery-milestones) and [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix). The delivered application still uses email codes until these runtime peers pass.

## Scope and non-goals

In scope: product/identity rules, verified-email enrollment, password and callback policies, provider identity resolution/linking, old email-code accounts, safe return/onboarding, invitation-recipient compatibility, environment ownership and peer interface/acceptance requirements. Out of scope: runtime code, actual provider settings/accounts/emails, deployment, native app implementation and custom identity or password storage.

## Expected behavior and edge cases

Normal login uses email/password or Continue with Google/Apple. Social authentication may register a new user or recover an existing user; application enrollment still requires server-verified identity and a valid minimal profile. Coach approval stays separate. Existing account subjects and private data must be preserved. Apple relay addresses must not be treated as another email without verified ownership; targeted invitations still require the exact invited verified address and separate acceptance. No login action submits a booking or sends a message.

2026-10-17 contract update: the user accepted the proposed clarifications, then explicitly selected an **8-character minimum with no mandatory character mixture** instead of the earlier 15-character proposal. Adopt the remaining details as implementation defaults in [specification sections 4.1.1–4.1.5](../../../docs/mvp-spec.md#411-methods-and-account-resolution). This documentation request does not start runtime work; the user's sequence remains finishing/validating and committing the existing fixes before authentication implementation.

## Assumptions, decisions, and dependencies

17 October 2026 modularity/recovery refinement: the user explicitly requested modular code and recovery testing. Adopt narrow application Auth operation/session/event/result interfaces before runtime peers start; DEV0286 owns the gateway/shared verification adapter, DEV0287 provider-specific operations and DEV0288 consumption by the UI. Keep stable MovX profile IDs and record current Auth-table/UUID coupling honestly; a future vendor swap still needs a reviewed identity/schema transition. Independent [DEV0292](../../current/backend/DEV0292-isolate-profile-image-storage-adapter.md) owns Storage isolation, and [DEV0293](../../current/backend/DEV0293-rehearse-database-auth-and-file-recovery.md) owns complete disaster recovery. Neither is a direct COR0027 member or a substitute for its method-specific validation. Password reset and full-system restore are distinct outcomes.

Confirmed: professional UAT quality, email/password plus Google/Apple, modular provider boundaries, recovery testing and the subsequently accepted 8-character minimum without mandatory uppercase/lowercase/digit/symbol combinations. The user requested less restrictive passwords; the earlier 15-character recommendation is superseded, not an adopted requirement.

Adopted implementation defaults: retain Supabase; allow its supported verified same-email identity linking while preserving one original Auth subject/MovX profile; prohibit combining separate MovX accounts and automatic different-email/Apple-relay association; require verified email and minimal presentation-name completion; one-hour single-use email proofs and 60-second email resend spacing; existing-account-only email-code transition through UAT; safe explicit routes/returns; current-device ordinary sign-out, global refresh-session revocation after password reset and a documented one-hour access-token revocation bound; 30-day hosted refresh-session time box; focused Account security controls. Full behavior and examples live in the specification rather than a competing ticket contract.

Names follow the committed DEV0295 account model: signup/onboarding creates only the existing presentation name and never asserts a legal identity or overwrites an existing name from provider metadata. Legal/preferred names, birthdate, gender and reserved username remain optional. Username sign-in/URLs remain independently deferred under [DEV0296](../../current/organisatory/DEV0296-define-username-login-and-profile-url-contract.md).

Environment prerequisites are implementation checks, not missing product choices: DEV0286 must prove confirmation/recovery settings, custom SMTP, password policy, revoked-session timing and paid-plan capabilities for breached-password protection/hosted session limits. DEV0287 must verify actual Google/Apple access, consent/redirect configuration and Apple renewal ownership. Missing capabilities keep the relevant runtime peer open; this ticket neither provisions nor claims those settings. Existing dependencies are Next.js 16.3.8, Supabase JS 2.116.0 and SSR 0.12.7; inspect installed docs before integration changes.

Planning sources reviewed: Supabase [password authentication](https://supabase.com/docs/guides/auth/passwords), [Google](https://supabase.com/docs/guides/auth/social-login/auth-google), [Apple](https://supabase.com/docs/guides/auth/social-login/auth-apple), [identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking) and [redirects](https://supabase.com/docs/guides/auth/redirect-urls), plus Apple's [web configuration requirements](https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web/). Managed alternatives reviewed were [Clerk](https://clerk.com/docs/guides/configure/auth-strategies/social-connections/overview), [Auth0](https://auth0.com/docs/authenticate/identity-providers/social-identity-providers) and [Firebase Authentication](https://firebase.google.com/docs/auth). Keeping Supabase avoids introducing a new identity authority/migration into this existing application; that is a project-specific recommendation, not a claim that one provider is universally best.

This is one direct peer under a flat coordination record. Dependencies do not create child tickets. Record material scope/behavior changes before implementation and split/consolidate through the repository policy if this boundary proves too broad. Ready is not an additional approval gate.

## Implementation plan

1. Review current identity/session/profile authority, current Auth settings and official password/Google/Apple/linking documentation.
2. Record exact password, verification/recovery, callback/return, account-resolution and old-user transition rules in the specification, distinguishing confirmed choices from defaults.
3. Agree ownership/interfaces with the password, social-provider, interface and proof peers; reconcile invitation consumers without weakening their exact-recipient rule.
4. Validate links, unique/retired IDs, reciprocal membership, acceptance coverage and current-versus-target language. Complete/archive this documentation ticket only after the adopted policy and peer responsibilities agree; keep runtime peers Draft while the user's implementation hold and their prerequisites remain.

## Acceptance criteria

- [x] AC1: The specification distinguishes selected targets from delivered email codes and defines the confirmed 8-character/no-mixture password policy, verified enrollment, profile fields, recovery/session timing and preserved-account transition with testable boundaries.
- [x] AC2: A reviewed identity-linking policy permits supported verified same-email linking to the original identity, prohibits separate-account merging/different-email guesses, handles Apple relay/missing names and preserves exact-recipient invitations.
- [x] AC3: Concrete routes/callbacks/returns, onboarding precedence, application-owned Auth operations/results and environment checks have one owner each in COR0027; peers reference the adopted rules and remain honest about runtime prerequisites/hold.
- [x] AC4: Documentation checks and scope review pass; initial DEV0283 history/validation is preserved, DEV0283 is retired and no runtime/hosted change is claimed.

## Validation plan

Run scoped Markdown formatting, a local-link/anchor and record/index/membership validator and git diff --check. Review the specification against all peer acceptance criteria and invitation exact-email examples, including same-email linking in both method orders, Apple relay, 7/8-character passwords, whitespace/multibyte/provider length limits, duplicate signup, expired/used proofs, recovery-session isolation, old-user setup and hostile return paths. No application/database/provider tests for this documentation ticket; runtime proof belongs to its peers.

## Implementation record

### Changes and rationale

2026-10-17 initial checkpoint: Started planning reconciliation and pre-implementation conversion of DEV0283 after the user selected email/password, then Google/Apple. Detailed linking/password/callback defaults were incomplete at that checkpoint; its documentation checks did not establish runtime readiness.

2026-10-17 user-requested update: Adopted the accepted defaults in the specification, explicitly replacing the proposed 15-character minimum with the user-confirmed 8-character minimum/no mandatory mixture. Clarified managed same-email linking versus merging separate application accounts, signup/name ownership, legacy-user setup, recovery limits, session revocation bounds, Account controls, routes and application-owned provider interfaces. Aligned runtime peer acceptance criteria and coordination dependencies without touching source, settings or accounts. Final documentation validation is recorded below.

### Affected files

| File or component                                                                                                 | Change and purpose                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| [Specification](../../../docs/mvp-spec.md#41-register-as-an-athlete-or-apply-to-coach)                            | Single adopted Auth policy, concrete route/interface tables and acceptance scenarios; delivered email-code behavior stays explicit. |
| [COR0027](../../current/organisatory/COR0027-login-registration-and-social-authentication.md) and DEV0286–DEV0289 | Flat ownership, adopted-policy references, exact validation targets and runtime hold/prerequisites.                                 |
| [Ticket index](../../README.md)                                                                                   | Lifecycle/link handoff for this contract record; unrelated preview work is preserved.                                               |
| COR0024, DEV0259 and DEV0263                                                                                      | Downstream invitation notes consume the adopted exact-address contract without treating Auth sign-in as invitation acceptance.      |
| Historical DEV0291 link                                                                                           | Path-only maintenance if this contract is archived; its recorded audit/history is preserved.                                        |

### Decisions and deviations

2026-10-17: Created as a fresh direct peer when retired DEV0283 expanded from presentation to password and Google/Apple authentication. No runtime implementation deviation; confirmed method choices are distinct from proposed implementation details.

2026-10-17 later clarification: the user explicitly relaxed the password proposal to 8 characters without character-mixture requirements. Retain paste/autofill, breached-password checks and rate limits. Adopted timing/route/session/linking defaults are implementation choices, distinct from that explicit user constraint. Configuration/provider support must be proven by the runtime owners, including Supabase's byte-based password ceiling and access-token revocation delay. This is not a claim of conformance to the earlier stricter NIST recommendation.

### Contracts, configuration, and operations

This change adopts a future product/interface contract only. No runtime API/schema, dependencies, secrets, provider accounts/settings, emails, migrations or deployment changed. DEV0286 owns any narrowly required session/recovery authority persistence, password/settings/template rollout and rollback; DEV0287 owns social configuration/renewal; DEV0288 owns views and the small Account security integration; DEV0289 owns combined proof. Preserve original identities/data and current runtime until those owners deliver. No application password store, arbitrary account merge or provider migration is implied.

## Validation results

- Date/environment: 2026-10-17, repository planning.
- Initial conversion checks (historical): on 2026-10-17, scoped Python validation checked 11 documents, 377 local links, 52 anchors and 200 unique records; retirement, five reciprocal direct memberships, index/status/template consistency and next IDs DEV0290/COR0028 passed. Focused Markdown formatting and whitespace checks are recorded under DEV0285; these checks do not establish runtime acceptance.
- Runtime/application/provider/browser checks: not run — this is planning; all runtime criteria remain open.

- Initial conversion commands (historical): an inline `python3` standard-library validator produced the counts above; `node_modules/.bin/prettier --check` over COR0027 and DEV0285–DEV0289 and `git diff --check --` over the eleven scoped documents passed. Link checks also verified the specification, index and the three modified invitation records.
- Initial conversion scope review (historical): edits were documentation only. Initial DEV0283 presentation/validation history is retained in COR0027, its password clarification is recorded before the Google/Apple expansion, and independent DEV0284/concurrent index changes were preserved. No credential, provider account/setting, email, runtime or deployment operation was performed. Application/database/browser/provider tests were not run because this checkpoint changes planning only; they remain required in the runtime peers.

2026-10-17 final contract review:

- Passed `python3 /tmp/dev0285-validate-contract.py` both before and after archival: 12 scoped documents, 452 local links, 74 anchors and 214 unique records; five reciprocal COR0027 members, retired-ID preservation, required sections, adopted policy coverage and Draft/on-hold runtime peers agree. The final pass verifies Completed/archive/index agreement and all affected links, including path-only maintenance in historical DEV0291.
- Passed focused `node_modules/.bin/prettier --check` over archived DEV0285, COR0027 and DEV0286–DEV0289, and `git diff --check` after archival. Shared specification/index tables are reviewed without reformatting unrelated content; the validator directly checks the new untracked archive file's whitespace as well.
- Reviewed provider documentation for supported same-email linking, shared email-proof expiry, password byte limits and Pro/session/revocation constraints. These are policy/setup references, not proof of configured providers or working flows.
- Reviewed the contract against the current Account name/username model, same-email linking in both method orders, exact-address invitation examples, password/expiry/resend/session boundary cases, recovery-only authority, route precedence and unsafe-return handling. Each runtime deliverable retains one owner in COR0027.
- Application, database, browser, email, SMTP/provider administration and actual hosted-flow checks: Not run — this change is documentation only and the runtime hold remains. DEV0286–DEV0289 own that required evidence. Independent Home/banner work in the shared workspace is preserved.

| Criterion | Evidence                                                                                                                                                                                                                                                              | Result |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Specification 4.1.1–4.1.4 and acceptance matrix define confirmed 8-character/no-mixture policy, verified enrollment/name fields, one-hour/60-second email rules, recovery/session bounds and legacy transition; current email-code delivery remains explicit.         | Passed |
| AC2       | Account-resolution cases distinguish supported same-verified-email identity linking from combining accounts, cover unconfirmed/conflicting/different-email/Apple-relay identities and retain exact-recipient consent. Actual provider proof stays with runtime peers. | Passed |
| AC3       | Specification route/interface tables and COR0027 map every part to one peer; updated runtime criteria cover Account compatibility, permissions, recovery and environment prerequisites. Runtime remains Draft/on hold.                                                | Passed |
| AC4       | Initial conversion history/retirement is preserved; link/anchor/ID/member/template/scope checks and final documentation lifecycle review pass without runtime or hosted changes.                                                                                      | Passed |

## Risks, limitations, and follow-ups

Contract documentation is complete. Next: finish/validate and commit the preceding fixes as the user requested, then begin DEV0286 under this adopted contract and record concrete service signatures before dependent UI wiring. Runtime peers remain Draft; all real configuration and flow evidence is still pending. DEV0287 must confirm Google/Apple access and Apple renewal ownership; DEV0286 must verify hosted paid-plan capabilities, password byte handling and the documented revocation bound. Do not report documentation completion as working registration, provider readiness, deployment or recovery proof. Username login/URLs remain DEV0296, and complete-system restoration remains DEV0293.

## Completion and review references

- Completed: 2026-10-17 — adopted authentication contract and documentation/peer/lifecycle review; runtime implementation is not complete.
- Commit: Initial planning was included in `0b19c35` with DEV0285 in its subject. This later contract update is uncommitted; the current request does not ask for a commit. No password/social runtime implementation is included.
- Review: Contract/source-documentation and peer/acceptance self-review only; no independent or runtime implementation review.
- Deployment or release: None.
