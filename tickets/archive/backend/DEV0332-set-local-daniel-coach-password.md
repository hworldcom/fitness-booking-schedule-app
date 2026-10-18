# Ticket DEV0332: Set local Daniel coach password

- Status: Completed
- Created: 2026-10-17
- Last updated: 2026-10-17
- Milestone: Local coach testing
- Coordination: None — independent development ticket
- Related records: Password/recovery implementation [DEV0286](../../current/backend/DEV0286-implement-password-authentication-and-recovery.md); deferred review panel [DEV0148](../../current/frontend/DEV0148-add-coach-review-admin-panel.md).

## Objective and context

The user requested a usable password for the fictional Daniel Park coach and an explanation of current coach-application approval. Preserve the existing local identity, coach authority and scheduling history under the [identity/data contract](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity). Follow the delivered [local sign-in and operator review guidance](../../../README.md#local-registration-and-sign-in).

## Scope and non-goals

- In scope: exact local Daniel account inventory, verified password setup through the existing recovery flow, actual application sign-in and coach-access verification, and explanation of the current review command.
- Out of scope: hosted/production changes, other accounts, application approval, demo-to-verified promotion, admin panel implementation, source/schema changes and broad fixture provisioning.

## Expected behavior and edge cases

Target only `daniel.park@coaches.movx.test`, Auth subject `90000000-0000-4000-8000-000000000002`, profile `10000000-0000-4000-8000-000000000002`, coach slug `daniel-park`. Verify exact fixture metadata and existing profile linkage before changing credentials. Stop on a conflicting identity. Use a fresh local Mailpit recovery message in the same browser; resetting a password ends existing Daniel sessions as designed. Subsequent ordinary password login must resolve the same profile and Demo coach authority. Preserve application profile/scheduling rows and all other Auth users. Deliver the local test password to the requesting user without recording it in repository files.

## Assumptions, decisions, and dependencies

Local Docker `movx-club-local` is the running application target. Exact Daniel password setup is user-authorized. Existing recovery is preferable to an administrative password overwrite because it exercises the application's credential tracking and session revocation. Only loopback Auth/database/Mailpit/application endpoints are permitted. Credentials remain outside repository source. No product decision or specification change is needed.

## Implementation plan

1. Guard local endpoints and verify Daniel's exact existing Auth metadata/profile/coach linkage; capture application and non-target Auth fingerprints.
2. Generate a private local test password, request recovery, consume only the fresh exact-recipient Mailpit link and save through the ordinary reset form.
3. Sign in through the application, verify exact subject/profile and Demo coach authority, sign out the verification browser and compare preserved records.
4. Record evidence and explain the existing dry-run/apply coach-review workflow, with the planned admin panel as a separate follow-up.

## Acceptance criteria

- [x] AC1: Exact local Daniel identity is verified and receives a usable password through verified recovery.
- [x] AC2: Ordinary application login resolves the same coach profile and Demo coach authority; other users and application history remain unchanged.
- [x] AC3: Password is prepared for direct handoff to the requesting user, not saved in tracked files; current approval procedure and its limitations are explained.

## Validation plan

Use a guarded one-use Node/Playwright helper against local services, checking exact Auth/profile fixture metadata before mutation, real recovery/reset/sign-in responses, and before/after application/non-target Auth fingerprints. Review README/operator CLI for approval guidance without applying any approval. Check ticket links/index consistency. Application lint/types/build/responsive checks are not applicable to an operational credential setup with no source/interface/schema changes.

## Implementation record

### Changes and rationale

Verified the exact pre-existing Daniel Auth subject, confirmed email, local-demo metadata, profile linkage, active public dataset participation and visible fictional coach record. Used the real Forgot password form and a fresh exact-recipient local Mailpit message in the same browser. Continued through the verified recovery screen, saved a generated password through Set a new password, then signed in through the ordinary form. Login returned Home with the same subject/profile and `coachAccessStatus: demo`; `/coach` loaded successfully. Signed out the verification browser afterward. No fixture provisioning, approval or promotion was performed.

The current approval workflow was checked against README and `scripts/review-coach-application.mjs`: an operator uses a separately configured owner-privileged database connection, reviews account/identity/profile evidence, previews one exact profile decision, then repeats with `--apply --confirm <same-profile-uuid>`. Approval permits coach publication/availability management; it does not automatically publish. DEV0148 remains the separate Draft admin-panel work.

### Affected files

This ticket and [work-record index](../../README.md) only. One-use operational helper and private password remain outside repository source.

### Decisions and deviations

2026-10-17: no product/implementation deviation. The first sandboxed read-only CLI status attempt failed because Supabase tried to write user-level telemetry outside the workspace; no account operation occurred. The same guarded inventory succeeded with execution permission, before recovery was requested.

### Contracts, configuration, and operations

No product/schema/dependency/environment change. Local password reset revokes prior Daniel application/refresh sessions as designed. No hosted or coach-approval operation is authorized by this ticket.

## Validation results

2026-10-17, existing local Docker only; application `localhost:3100`, Auth `127.0.0.1:55321`, database `127.0.0.1:55322`, Mailpit `127.0.0.1:55324`.

- `node /tmp/dev0332-daniel.mjs`: exact identity/metadata/profile/dataset checks passed after the initial sandbox-only CLI failure; no mutation in this inventory mode.
- `node /tmp/dev0332-daniel.mjs --apply`: passed fresh exact-recipient recovery, same-browser confirmation, restricted recovery session, actual reset form and ordinary browser password sign-in. `/api/auth/session` returned `signed-in` with the exact expected subject. `/api/auth/actor` returned the original profile and `demo` coach authority; `/coach` loaded. Verification sign-out returned `signed-out`.
- Before/after counts and ordered fingerprints matched across 46 tables covering all application profile/scheduling/history records, Storage object metadata and non-target Auth users. Only Daniel's expected credential/session/password-method/email-flow records were excluded from preservation comparison. His original Auth/profile identifiers and Demo status were separately rechecked after the operation. No hosted/production target or other account was changed.
- Generated password stayed in a mode-0600 temporary file outside the repository for direct user handoff; the temporary credential file was then removed; no password, session proof or private administrative key is recorded here. No real inbox email was sent; only local Mailpit captured messages.
- Ticket/index validation passed all 269 local links, unique DEV IDs, archived status and next-ID consistency. `node scripts/review-coach-application.mjs --help` confirmed the documented preview/apply command without connecting to a database. Application tests/lint/types/build/mobile checks not run: no application, interface or schema source changed; actual local recovery/login and preservation checks establish the operational criteria.

| Criterion | Evidence | Result |
| --- | --- | --- |
| AC1 | Exact fixture guards and fresh real recovery/reset. | Passed |
| AC2 | Actual sign-in, exact subject/profile, Demo authority, coach route and 46-table preservation. | Passed |
| AC3 | Private temporary credential handoff; README/CLI approval procedure reviewed and explained. | Passed |

## Risks, limitations, and follow-ups

The password applies only to this preserved local Docker account; a deliberate database reset removes it. Daniel remains a fictional Demo coach. DEV0148 owns the future review panel.

## Completion and review references

- Completed: 2026-10-17 — exact local Daniel password set and real coach login verified; unrelated records preserved.
- Commit: User-requested checkpoint on 2026-10-18, subject `[DEV0332] Record verified local coach login setup`.
- Review: Exact target, recovery, login and preservation self-review passed; no independent review.
- Deployment or release: None.
