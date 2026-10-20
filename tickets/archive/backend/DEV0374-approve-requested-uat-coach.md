# Ticket DEV0374: Approve requested UAT coach

- Status: Completed
- Created: 2026-10-19
- Last updated: 2026-10-20
- Milestone: UAT coach onboarding
- Coordination: None — independent development ticket
- Related records: Hosted UAT [DEV0372](../organisatory/DEV0372-deploy-reviewed-release-to-uat.md).

## Objective and context

The platform owner requests coach access for a friend and supplies the exact registered email privately. Read-only UAT lookup resolves exactly one confirmed Auth account, display name Mas, profile `4c07a09b-a322-43ae-bf62-0f007cfe028a`, with a pending revision-1 application. Use the existing [coach application contract](../../../docs/mvp-spec.md#coach-application-and-review) and [operator review](../../../README.md#coach-application-review), preserving all other accounts and owner content.

## Scope and non-goals

Approve only this exact application on hosted dev `mdzidiqosxbghmfyxphb`, which serves UAT, using a bounded owner-only, expected-state guarded transaction under the user-authorized one-account exception recorded below. Record a truthful owner-requested UAT decision and append-only review evidence. Exclude credentials/session changes, profile/content fabrication, publication, demo provisioning, unrelated applications, production and app/schema changes.

## Expected behavior and edge cases

The selected pending application becomes approved and grants normal coach capability. Its profile remains owner-controlled and hidden until the owner publishes it. No existing data or other approval changes. If already approved, verify rather than append a contradictory review; stale/rejected/suspended state requires inspection. The user now explicitly authorizes approval before profile completion for this one UAT account. Keep identity/expected-state/row-lock/audit guards and do not invent profile data or alter the standard approval helper.

## Assumptions, decisions, and dependencies

The user's exact email reply identifies the target and authorizes this bounded coach approval without another permission gate. Email ownership is confirmed by Auth. Record owner-requested UAT access honestly, without claiming identity documents or professional qualifications were reviewed. The current SQL operation requires a non-demo user-owned hidden coach profile, confirmed location and at least one discipline. The initial plan waited for the owner-saved profile; the subsequent explicit user instruction supersedes that prerequisite for this exact account, as recorded below.

## Implementation plan

1. Resolve the supplied email on the explicit UAT project; inspect application, confirmation and hidden-profile readiness without exposing credentials.
2. Inspect readiness and exact identity; apply the user-authorized one-account exception below without fabricating a profile.
3. Capture before-state/preservation evidence. Rehearse the exact owner-only approval/audit maintenance transaction with rollback; then commit it for this UUID and pending revision 1. Retain identity, expected-state, row-lock, transaction and audit guards; keep the shared review helper unchanged.
4. Reread approval and immutable review event; verify profile/visibility/content, other applications and retained identities were preserved. Finish/archive the record and update the index.

## Acceptance criteria

- [x] AC1: Supplied account resolves uniquely to the confirmed UAT identity and exact pending profile/application.
- [x] AC2: A bounded owner-authorized transaction approves only the target and creates matching immutable review evidence.
- [x] AC3: Original profile content/visibility, credentials and other accounts/applications remain unchanged; results and limits are recorded.

## Validation plan

Read actual Auth/application/profile readiness on hosted dev, rehearse the exact exception transaction with rollback, commit once and independently reread status/review evidence. Compare all unrelated rows across application tables, Auth users and Storage plus stable target identity/submission fields inside the same repeatable-read transaction. No new account, email, credential operation or impersonated session. App tests/lint/type/build and deployment are not applicable to unchanged code/schema and this one administrative operation. Check record links/status/whitespace.

## Implementation record

### Changes and rationale

Approved only Mas's exact revision-1 UAT application after the platform owner explicitly waived profile completion for this account. The standard review helper remains unchanged. A bounded owner maintenance transaction changed pending → approved and appended one immutable review event with policy movx-owner-authorized-uat-v1 and an honest owner-exception reason. It created no coach profile/location, changed no credentials and did not publish content. Both rollback-only rehearsal and committed operation preserved all unrelated rows across 57 tables and stable target application fields; an independent read confirms approved status and exactly one matching event.

### Affected files

This record and [ticket index](../../README.md) record the operation and current prerequisite. The existing [review command](../../../scripts/review-coach-application.mjs) and shared SQL review helper remain unchanged; private one-account maintenance SQL records the explicitly authorized exception.

### Decisions and deviations

The later explicit user instruction overrides the original wait-for-profile plan for this UUID only. The profile-completion prerequisite is waived in one owner-only maintenance transaction; no shared helper, trigger, row-security policy or privilege is altered and no placeholder profile is created. Lookup/SQL/evidence stay private under ignored work/dev0374; the ticket contains no email or credential.

### Contracts, configuration, and operations

No app/schema/environment contract changes. The applied operation is one pending → approved transition with append-only owner-command evidence under the distinct owner-authorized UAT policy. Reversal, if requested, uses the existing approved → suspended transition rather than deleting evidence. Production is excluded.

## Initial investigation results

These entries describe the earlier missing-profile blocker; final results below supersede that pending state.

- Actual hosted-dev query: exactly one profile, confirmed email, pending application revision 1, no coach draft. Passed AC1.
- Existing owner-review SQL inspected: requires a hidden user/non-demo profile with a confirmed location and discipline; exact retries are idempotent and stale transitions fail closed.
- Approval and post-write preservation: not run; owner-saved profile prerequisite missing. No data was changed.

## Risks, limitations, and follow-ups

The account is approved, and the owner may complete/publish their coach profile through the existing product flow. No profile or public listing exists yet; ordinary completeness/location/publication rules remain. The exception grants UAT coach access and does not claim completed-profile, document, licensing, background or competence verification. No message was sent to the friend. Reversal, if requested, is an audited approved → suspended transition rather than record deletion.

## Completion and review references

- Completed: 2026-10-19 at 21:57 Europe/Berlin — target approved with audit and preservation proof.
- Commit: Included with its implementation/validation record in this user-authorized 2026-10-20 checkpoint: `[DEV0374] Record requested UAT coach approval`. No new hosted operation is implied.
- Review: Target, explicit exception scope, expected-state transaction, audit and preservation self-reviewed; no independent review.
- Deployment or release: Existing UAT application unchanged; the requested account approval is live in hosted dev. No deployment needed.

### Follow-up progress inspection — 19 October 2026

At the user's request, reread the exact UAT application's persisted state using work/dev0374/readiness.sql. It remains pending revision 1 with no coach-profile row, saved bio, discipline or confirmed profile location. Prior submission time is 19:42 UTC / 21:42 Europe/Berlin. Registration/email confirmation and explicit coach application submission are complete; the next persisted milestone is an owner-saved private Coach Profile. These database records show saved progress and do not establish what the applicant has typed without saving or whether a form is currently open. No approval or other database write occurred; the same prerequisite remains. Private evidence: work/dev0374/progress-current-private.json.

### Explicit owner exception — 19 October 2026, before mutation

After being told twice that the pending application lacks a saved coach profile, the user explicitly asks “can we simply just approve him?” This supersedes this ticket’s earlier proposed wait-for-draft restriction for this exact account. It authorizes one UAT coach-role decision before profile setup, not a global product-policy/schema change, fabricated profile, public listing or credential operation. No further permission is needed.

The unchanged standard owner review helper enforces completed-profile prerequisites. Rather than changing that shared helper or fabricating profile/location data, perform one narrowly scoped owner maintenance transaction equivalent to its approval/audit writes, omitting only that prerequisite for target profile 4c07a09b-a322-43ae-bf62-0f007cfe028a. Lock and verify pending revision 1, exact confirmed Auth identity and user-owned profile; require the allowlisted dev project. Set only transaction-local existing management flags under app_owner, retain existing triggers/RLS/constraints, write the approval and one immutable audit event atomically. Use a distinct movx-owner-authorized-uat-v1 policy and an explicit reason that profile completion was waived by the owner; do not claim a completed-profile/identity-document review under the normal identity policy.

Revised plan: capture before-state hashes for app tables/Auth identities/Storage inside a repeatable-read transaction; perform the exact operation first with ROLLBACK, verify target approval plus audit, unchanged target identity/submission and equality of every unrelated row/table; rerun the same bounded operation with COMMIT, verify it independently and close the ticket. The deterministic event ID and exact reviewer/reason/policy make retry idempotent; any unexpected current state fails closed. No function/permission/migration/application deployment changes. Standard profile completeness/publication and owner setup gates remain unchanged.

## Final operation and validation results

- Explicit target: profile 4c07a09b-a322-43ae-bf62-0f007cfe028a, confirmed Auth identity 09e85b61-8bf9-4233-9fba-01407a7891e9, display name Mas, pending revision 1. Only UAT project mdzidiqosxbghmfyxphb was contacted.
- `supabase db query --linked --project-ref mdzidiqosxbghmfyxphb --file work/dev0374/dry-run.sql -o json` passed the exact approval/audit/preservation assertions and ended with ROLLBACK. It reported approved revision 1, one event, no coach draft and all unrelated rows across 57 tables unchanged; no durable application state remained from the rehearsal.
- The same SQL ending COMMIT (`work/dev0374/apply.sql`) passed at 19:57:15 UTC / 21:57:15 Europe/Berlin. Existing owner-role flags were transaction-local; status/decision metadata and the new audit event are the only intended changes. Target identity/submission fields, all other applications/reviews, profiles/content, Auth credentials and Storage rows matched exactly within the transaction.
- Immutable event d6c43f90-4640-44ca-8f02-e6410539d374 records pending → approved, revision 1, owner-command source, reviewer platform-owner-via-codex:DEV0374 and policy movx-owner-authorized-uat-v1. The reason states the owner explicitly approved before profile completion. No ordinary identity-policy review is falsely claimed. The deterministic event/current-state checks make exact retry idempotent; unexpected existing decisions fail closed.
- Independent `verify-approved.sql` readback passed: one exact confirmed identity, approved revision 1, one matching audit event and no coach profile row created. The existing actor/workspace projection reads current approval on subsequent requests; the owner can refresh UAT. No impersonated login or physical-device flow was performed.
- All three acceptance criteria pass. App tests/lint/type/build and redeployment are not run because no app code/schema/configuration changed. Documentation links, unique identifier/current/archive status, preserved unrelated edits and whitespace were checked at handoff. No commit was requested for this new administrative operation; the durable operation record remains in the worktree.
