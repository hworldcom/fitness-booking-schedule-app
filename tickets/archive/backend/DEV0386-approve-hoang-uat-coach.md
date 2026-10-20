# Ticket DEV0386: Approve Hoang UAT coach

- Status: Completed
- Created: 2026-10-20
- Last updated: 2026-10-20
- Milestone: UAT coach approval and acceptance testing
- Coordination: [COR0033 — Coach approval and disposable UAT testing](../organisatory/COR0033-coach-approval-and-disposable-uat-testing.md)
- Related records: [DEV0387](../frontend/DEV0387-rehearse-and-clean-up-disposable-uat-users.md) (peer UAT/cleanup); [DEV0374](DEV0374-approve-requested-uat-coach.md) (historical bounded review operation)

## Objective and context

The owner explicitly requests approval for the account identified privately as hoangworldcom@gmail.com. Read-only lookup on explicit hosted dev resolves exactly one confirmed active Auth user `30007546-8a56-410c-ae05-08b1be500e83`, profile `016189ee-a53d-44a3-ae59-1a396ab4694c`, pending revision 1 application and complete hidden Hoang coach profile with three disciplines/two active locations. Apply existing [coach review](../../../docs/mvp-spec.md#coach-application-and-review) authority without claiming professional credential verification.

## Scope and non-goals

Approve this exact pending application with an honest platform-owner UAT review reason and immutable audit evidence. No profile/content/image/location/visibility/credential changes, publication, other approvals, schema/runtime changes or production operations. DEV0387 owns dummy users and interaction tests/cleanup.

## Expected behavior and edge cases

Pending revision 1 becomes approved, granting ordinary coach capability. Visibility stays hidden and current identity/application submission fields remain intact. Lock and recheck the exact confirmed identity/application; abort on drift. An already-approved identity is verified rather than re-approved. Use standard owner-only review function; no completion exception is needed.

## Assumptions, decisions, and dependencies

The named user instruction authorizes this administrative action. Use dedicated hosted-dev `mdzidiqosxbghmfyxphb`, current UAT source `137a5b9`, and standard `app.review_coach_application`. Record owner-authorized UAT policy, not an unsupported identity-document/professional qualification review. No production connection or credential rotation.

## Implementation plan

1. Capture exact identity/readiness and row-content preservation baseline.
2. Rehearse a bounded, expected-state owner review transaction with rollback; compare all unrelated rows plus stable application fields and assert exactly one matching review event.
3. Commit the same guarded operation once; reread approval/audit/hidden profile, verify preservation and hand off post-approval baseline to DEV0387.

## Acceptance criteria

- [x] AC1: Exact supplied email uniquely matches the confirmed active pending application/profile.
- [x] AC2: Standard owner-only review approves only revision 1 and creates one truthful immutable review event.
- [x] AC3: Visibility, saved content/images/locations, credentials, other accounts and stable application fields remain unchanged; independent readback and review evidence recorded.

## Validation plan

Explicit-project read-only lookup, rollback rehearsal, guarded commit and independent readback. Compare 57 app/Auth-user/Storage tables excluding only the exact intended application-decision/audit additions; compare normalized target application identity/submission fields. No application build/tests/deploy for unchanged runtime/schema. Check ticket/index/coordination links and preserve unrelated work.

## Implementation record

2026-10-20: Used explicit hosted-dev Management SQL and the existing owner-only review function. A rollback rehearsal passed, followed by one guarded commit and an independent readback. No runtime files or schema changed.

### Changes and rationale

Approved only profile `016189ee-a53d-44a3-ae59-1a396ab4694c`, application revision 1. The owner explicitly requested this UAT access. Approval does not claim professional qualification verification. Audit `5ed7a28d-b6d4-460f-ab09-9099091e7dfc`, decided `2026-10-19T22:56:55.833093Z`, records pending → approved, reviewer `platform-owner-via-codex:DEV0386`, source `owner-command`, policy `movx-owner-authorized-uat-v1`.

### Affected files

This ticket and index/coordination record only; private exact-operation SQL/evidence under ignored work/dev0386.

### Decisions and deviations

None.

### Contracts, configuration, and operations

No runtime/API/schema/environment changes. One owner-only application decision and audit event; existing profile remains hidden.

## Validation results

Commands: `node_modules/.bin/supabase db query --project-ref mdzidiqosxbghmfyxphb --linked --file work/dev0386/{lookup,dry-run,apply,readback}.sql --output json` (run separately). All exited 0. Private operation/results retained under ignored work/dev0386; no secrets in this record. Rollback and commit compared 57 app/Auth-user/Storage table hashes, excluding only the exact intended decision/audit addition, plus normalized target application submission/identity fields. Independent readback confirmed approved revision 1, hidden visibility and exactly one matching audit. Builds, lint and runtime tests not applicable to this administrative operation; DEV0387 owns product interaction testing.

| Criterion | Evidence                                                                           | Result |
| --------- | ---------------------------------------------------------------------------------- | ------ |
| AC1       | Unique confirmed active exact-email lookup                                         | Passed |
| AC2       | Guarded standard function; single committed immutable audit; independent readback  | Passed |
| AC3       | All 57 preservation hashes and stable application fields unchanged; hidden profile | Passed |

## Risks, limitations, and follow-ups

Do not infer approval from UI cache or publish the profile. DEV0387 must preserve this intentional approval and audit event while removing only its own dummy cohort.

## Completion and review references

- Completed: 2026-10-20.
- Commit: Included with its implementation/validation record in this user-authorized 2026-10-20 checkpoint: `[DEV0386][DEV0387] Record coach approval and disposable UAT testing`. No new hosted operation is implied.
- Review: Self-review against all acceptance criteria passed; no independent review requested.
- Deployment or release: Not applicable — owner data operation on existing UAT.
