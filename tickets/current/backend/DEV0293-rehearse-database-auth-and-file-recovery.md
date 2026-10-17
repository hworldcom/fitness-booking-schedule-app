# Ticket DEV0293: Rehearse database Auth and file recovery

- Status: Draft
- Created: 2026-10-17
- Last updated: 2026-10-17
- Milestone: Provider boundaries and operational recovery
- Coordination: None — independent development ticket
- Related records: Requirements/audit [DEV0291](../../archive/organisatory/DEV0291-adopt-provider-boundaries-and-recovery-requirements.md); Storage boundary follow-up [DEV0292](DEV0292-isolate-profile-image-storage-adapter.md); future-method consumer [DEV0289](DEV0289-rehearse-multi-method-authentication-for-uat.md); separate retained-volume continuity [DEV0232](../organisatory/DEV0232-restore-local-migration-continuity.md).

## Objective and context

Prove that MovX can be restored from a backup into an isolated target with usable records, identities and uploaded files. The user explicitly agreed to recovery testing on 17 October 2026. This is operational disaster recovery, not the password-reset feature owned by DEV0286.

Use the current [architecture](../../../docs/mvp-spec.md#6-application-and-infrastructure-boundaries), [identity/privacy](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity), [definition of done](../../../docs/mvp-spec.md#11-definition-of-done), [milestones](../../../docs/mvp-spec.md#12-delivery-milestones) and [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix). These are linked independent records, not a child-ticket hierarchy or additional COR0027 members.

## Scope and non-goals

In scope: inventory/recovery plan, protected consistent backup artifacts, a repeatable guarded rehearsal command, isolated source/target fixtures, restoring PostgreSQL schema/data/functions/grants, Auth identities/configuration requirements and Storage metadata plus actual bytes, application verification, measured recovery time/data point and exact cleanup/runbook. Out of scope: resetting shared/local/hosted projects, overwriting production, changing provider, automatically buying backup services or cloud projects, repairing DEV0232's retained history and claiming new password/social behavior before its owners deliver it.

## Expected behavior and edge cases

Recover from exported backup artifacts rather than rebuilding fixtures from seed and calling that recovery. Restore stable profile/Auth references and representative coach/athlete requests, bookings, connections, group activity and messages available in the snapshot. Preserve media file hashes and private/public access rules; missing objects and invalid artifacts fail clearly. A real login to the restored application must recover the original profile/roles and authorized history; another actor must remain denied. Recreate documented provider/redirect/mail/secret prerequisites securely and explicitly determine whether old sessions are invalidated. Never store credentials/tokens or raw private rows in ticket evidence.

## Assumptions, decisions, and dependencies

Start with disposable loopback environments and tagged controlled data, preserving active containers/ports/volumes and existing data. Current runtime proof is email-code based; the new password/Google/Apple methods must be rechecked with COR0027 owners when delivered. Local proof does not certify hosted backup or disaster recovery; a later controlled hosted rehearsal requires an explicitly identified disposable target and records its own result. Maximum data loss, recovery duration, backup frequency/retention, encryption/key custody and operator responsibilities must be adopted before production-readiness claims; user targets are not yet selected. Supabase database backups exclude uploaded object bytes.

Proposed starter objectives requested for discussion: UAT recovery point objective (RPO, maximum acceptable lost changes) up to 24 hours; early production RPO up to 1 hour; recovery time objective (RTO, time to usable service after an incident) up to 4 hours for each. Record detection, response, restore and verification durations separately. These are proposals, not user-adopted commitments or proven capabilities. Select the backup frequency, consistency mechanism and cost after the rehearsal demonstrates feasibility; a successful tiny fixture restore does not establish production-size recovery time.

Official planning sources: Supabase [database backups](https://supabase.com/docs/guides/platform/backups) and [backup/restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore). Daily database backups alone do not meet the proposed one-hour production RPO and exclude uploaded object bytes; review coordinated snapshots or supported point-in-time recovery plus a separate file strategy before choosing the operating plan. Recheck current provider behavior/pricing during implementation. No paid backup add-on or scheduled automation is created by this proposal.

## Implementation plan

1. Inventory database/Auth/files/configuration assets and select a concrete consistent snapshot and disposable target strategy; document commands, guardrails and backup/key handling before operations.
2. Build a repeatable preflight/rehearsal with source/target identity checks, collision refusal, tagged fixtures, protected artifacts and explicit ownership of cleanup; establish its actual command in the database guide.
3. Restore solely from artifacts, including file bytes and Auth prerequisites, then run real verified-login/application/permission/media checks against the restored target.
4. Exercise invalid/missing artifacts and interrupted recovery, record elapsed recovery/data-point timestamps, prove unchanged source fingerprints and remove only owned fixtures/targets.
5. Write the runbook and evidence matrix; distinguish local, hosted and future-auth coverage. Required unperformed recovery keeps the ticket open.

## Acceptance criteria

- [ ] AC1: A documented asset/ownership/configuration inventory and guarded command restore to an isolated target, refusing source/target equality, wrong/remote targets and pre-existing owned-name collisions.
- [ ] AC2: Actual restored database/Auth identity/profile/history and uploaded image bytes match the captured snapshot; no seed recreation substitutes for restoration.
- [ ] AC3: The restored app supports real login, original profile/roles/history, a bounded authorized scheduling action and private/public image access; wrong-account/unauthenticated reads remain denied.
- [ ] AC4: Missing/corrupt artifacts and interrupted restores fail truthfully; observed recovery duration/data point, cleanup and unchanged source evidence are recorded with a usable runbook and explicit local-versus-hosted limitations.

## Validation plan

Use official Supabase backup/restore guidance and installed CLI/Postgres/Auth/Storage versions. Create only isolated disposable environments and tagged records; never reset the ordinary movx-club-local dataset. Capture schema/grant checks, table identity/fingerprints, Auth subject/profile mapping and object byte hashes before/after. Test real loopback email/login plus exact authorized UI/API/database access and one disposable scheduling mutation; distinguish new OAuth/password proof until COR0027 exists. Run meaningful harness guard/failure tests, applicable lint/typecheck/build and cleanup/source-preservation checks. No new recovery command exists yet; implementation must establish and document it before claiming a pass.

## Implementation record

### Changes and rationale

Not started. Planning inventory identified the active local Supabase services after an approved read-only Docker listing. No dump, target creation, data mutation, restore or destructive rehearsal has run. Existing schema-baseline replay does not prove Auth/file/application recovery.

### Affected files

Planned: focused guarded recovery harness/fixtures, relevant tests, supabase/README.md operational runbook and this implementation evidence. Existing database-baseline scripts and DEV0232 are historical/dependency context, not replacement proof.

### Decisions and deviations

2026-10-17: Preserve existing providers and application authority while reducing specific coupling. Keep disaster recovery separate from password reset and retained-volume migration repair. No runtime deviation; implementation choices remain scoped to this record.

### Contracts, configuration, and operations

This planning checkpoint changes documentation only. No runtime interfaces, dependencies, schema, credentials, provider settings, environment values or hosted operations changed. Future interface/configuration/rollback requirements must be recorded before implementation. No passwords, tokens, private data or backup contents belong in tickets.

## Validation results

- Date/environment: 2026-10-17, repository review with Node 24.21.0.
- Planning documentation/link/ID/membership checks passed under archived DEV0291. Existing boundary/Auth/config checks passed 19 tests. This is not implementation evidence for this ticket; its adapter/recovery criteria remain Not run.
- New runtime refactor/recovery checks: not run; planning does not establish these results.

| Criterion | Evidence                                                              | Result  |
| --------- | --------------------------------------------------------------------- | ------- |
| AC1–AC4   | Required work/evidence is recorded above; validation remains pending. | Not run |

## Risks, limitations, and follow-ups

Next: settle concrete isolated target/artifact/cleanup design and proposed recovery objectives, then perform the real rehearsal. A local pass alone must not be called hosted disaster recovery or production readiness. Do not archive with missing Auth/file/login evidence.

## Completion and review references

- Completed: Not completed.
- Commit: Planning record included in the user-authorized workspace checkpoint under DEV0291; no runtime implementation commit or completed acceptance is claimed.
- Review: Source/planning self-review only; no independent review.
- Deployment or release: None.
