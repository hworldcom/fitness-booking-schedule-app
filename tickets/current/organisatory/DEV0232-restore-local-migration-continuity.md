# Ticket DEV0232: Restore local migration continuity on main

- Status: Draft
- Created: 2026-10-14
- Last updated: 2026-10-17
- Milestone: Local contributor workflow
- Coordination: None — independent development ticket
- Related records: discovery baseline [DEV0221](../../archive/backend/DEV0221-persist-coach-athlete-connections.md); historical-evidence review [DEV0225](../../archive/organisatory/DEV0225-remove-blockchain-historical-evidence.md); completed baseline [DEV0265](../../archive/backend/DEV0265-baseline-completed-database-migrations.md) and seed repair [DEV0249](../../archive/backend/DEV0249-repair-legacy-seed-location-compatibility.md); pending retained-stack calendar upgrade [DEV0252](../../archive/backend/DEV0252-persist-effective-coach-availability.md); separate hosted environment [DEV0055](../backend/DEV0055-hosted-supabase-staging-environment.md).

## Objective and context

Restore the normal [one-command local development workflow](../../../README.md#run-locally) without losing retained Auth, Storage or scheduling data. During DEV0221 validation the local database ledger contained already-applied versions `20261012000100`, `20261012000200` and `20261012000300`, absent from main. `supabase migration up --local` stopped with MigrationMissingLocalError even after every main migration was applied; dev:local calls that command before starting Next.js.

2026-10-16 review after baseline commit `e372fe8`: active main now contains a fresh-database baseline plus the calendar forward migration. The retained stack still records 54 older migrations, including the three branch-only versions. It lacks group-registration version `20261015000500`, group-time authority `20261016000100` and calendar `20261016000200`. Therefore restoring just the three filenames is no longer a sufficient startup fix; the retained stack also needs an explicit path from its archived history to current scheduling code. The [existing-environment guide](../../../supabase/README.md#existing-databases) deliberately leaves that transition here.

## Scope and non-goals

- In scope: inspect branch/source and actual schema provenance; design a safe local branch/dataset migration strategy; restore documented startup and forward migration continuity; preserve existing accounts, uploaded avatars, bookings and consent history.
- Out of scope: hosted changes, blind history repair, resets/deletions, importing unrelated product features onto main, or executing DEV0225's separate repository pruning.

## Expected behavior and edge cases

Normal startup should reuse retained local data and apply only genuinely pending scheduling migrations. Already-applied branch work must not be falsely marked reverted or silently re-executed. Switching branches, fresh setup and repeated startup need explicit compatibility/rollback behavior. Any chosen data transfer/removal must be concrete and reviewable before an irreversible operation.

## Assumptions, decisions, and dependencies

DEV0221 applies only its own tested additive SQL/ledger entry as a guarded workaround; it does not repair these three records. Source provenance and the safe isolation/reconciliation approach remain unresolved. No reset or deletion is authorised by this draft.

The 16 October review identifies the branch sources and a recorded SQL discrepancy below; complete schema/data equivalence and an operational transition remain unverified. The earlier user target of local application and deployed UAT sharing a new hosted dev project is separate from restoring this retained Docker stack. This ticket does not provision that project, change the default environment or authorize copying existing accounts/files into it. A fresh hosted project can consume the validated baseline/forward stream without first repairing the old local ledger; preserve the local stack independently.

Proposed technical direction, not yet an implemented or user-selected strategy: keep the fresh baseline immutable and give a recognized retained ledger a separate, verified compatibility history assembled from archived originals and its recorded branch evidence. A compatibility runner must refuse unknown/drifted history, never execute a branch-only migration that is absent from the target ledger, exclude the fresh baseline from the retained upgrade, and apply only genuinely missing reviewed scheduling migrations. Rehearse this in an isolated retained-data copy before considering the shared stack. Do not import the hackathon migrations into the normal fresh/main stream or falsely mark them reverted. Whether to retain this local workflow alongside hosted dev is still an operational choice; hosted setup is not silently added to this ticket.

## Implementation plan

1. Inspect the three recorded versions and available branch sources, current schema and the startup helper without changing data. The dated findings below complete the initial source lookup, not the full drift audit.
2. Review actual branch/schema effects and the third migration's SQL discrepancy. Specify the legacy-versus-baseline detection, exact allowed pending versions, isolated backup/restore proof, file-byte preservation and branch-switch behavior before runtime edits. Choose and document the compatible strategy; split implementation peers under a coordination record if needed while preserving this record's committed history.
3. Prove the adopted approach on an isolated copy: original identities, uploaded bytes and scheduling/consent history survive; missing scheduling migrations apply once; fresh baseline setup remains separate; repeat/unknown-history/branch-switch cases fail or succeed as explicitly documented.
4. Only after that proof, make any intended shared-stack operation concrete and reviewable under the user's authorization. Verify normal startup and record forward recovery. No retained database change is part of the current read-only review.

## Acceptance criteria

- [ ] AC1: Normal dev:local and pending migration application work on main with explicit branch compatibility.
- [ ] AC2: Existing identities, uploaded images, scheduling and connection history are preserved; no history row is falsely reverted or unrelated feature imported.
- [ ] AC3: Fresh/repeated/branch-switch and forward recovery validation passes with recorded evidence.

## Validation plan

Use isolated local copies first, then compare exact retained data/image access and normal startup on the existing loopback stack. Never reset or repair hosted data. Final commands and data-transfer/rollback steps must be specified before implementation.

## Implementation record

Runtime implementation has not started. Initial planning came from DEV0221; the user requested the next-work review on 2026-10-16 after baseline/seed cleanup. This review updates only this Draft record and its index summary with read-only findings and a proposed approach. No startup code, migration SQL, ledger, application data, Auth user or Storage object was changed.

### Changes and rationale

The old ticket described only missing branch files. The revised plan accounts for the committed baseline packaging, three missing scheduling upgrades and an observed branch-source discrepancy, so a future implementation cannot treat an ordinary CLI history repair as sufficient.

### Affected files

This record and [the index](../../README.md) record investigation only. Prospective runtime touchpoints are [the startup helper](../../../scripts/start-local-development.ts), a bounded history/upgrade helper and its tests, and database/startup guidance. No runtime file has been selected for implementation yet.

### Decisions and deviations

Preserve current records and data; the CLI's suggested blind reverted-history repair is not an adopted solution.

2026-10-16: Keep the baseline archive/fresh stream separate from retained branch compatibility. No strategy is considered proven from ledger names alone. Preserve the recorded SQL discrepancy rather than replacing the ledger's evidence with a newer Git file.

### Contracts, configuration, and operations

None changed by this draft. Planned local workflow changes require an explicit compatibility and recovery contract. The proposed legacy path must preserve complete audit evidence; it is not permission to relabel the old database as an equivalent baseline or bypass the baseline's existing-schema refusal.

## Validation results

Read-only investigation on 2026-10-16, PostgreSQL 17.11:

- `git log --all --format='%h %s' --name-only -- 'supabase/migrations/20261012000*'` found all three files on `hackathon/solana-group-events`. `git show <revision>:supabase/migrations/<filename>` inspected their recorded source; nothing was checked out or executed.
- `docker exec supabase_db_fitness-booking-social-app psql -X -U supabase_admin -d postgres -qAt -v ON_ERROR_STOP=1 -c "select version,name,cardinality(statements),md5(array_to_string(statements,E'\\n')) from supabase_migrations.schema_migrations order by version; select to_regclass('app.coach_group_sessions'),to_regclass('app.coach_availability_policies');"` returned the 54-version ledger and absent group/calendar tables. This was a metadata read, not an upgrade or a full schema-equivalence check.
- Read the three ledger `statements` arrays through the same read-only connection and compared each stored statement with its historical Git source text. The counts below describe verbatim statement matches, not a completed schema or data audit.

| Version          | Historical source                                | Statement comparison and effect                                                                                                                                                                              |
| ---------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `20261012000100` | `43daeef`, `guard_wallet_event_obligations.sql`  | 25/25 stored statements occur verbatim; adds historical wallet/event liability functions and triggers.                                                                                                       |
| `20261012000200` | `22426c9`, `reconcile_group_event_catalogue.sql` | 35/35 match; changes historical funding-event catalogue fields and management/projection functions.                                                                                                          |
| `20261012000300` | `8f9e8eb`, `bound_group_event_sponsorship.sql`   | 9/10 match. The recorded UPDATE sets only `sponsor_max_lamports = 1` for zero values; Git also updates `prepared_summary.sponsorMaxLamports`. The exact recorded variant is not established by the Git file. |

- [The startup helper](../../../scripts/start-local-development.ts) still invokes `supabase migration up --local` before runtime preparation and Next.js, and deliberately injects loopback-only settings. It does not currently select the new hosted dev environment.
- Documentary review: `python3 /tmp/dev0232-check-review.py` passed 206 local links/anchors across this record and the index, matching Draft status and three outstanding criteria. Scoped `prettier --check` and `git diff --check` passed. No implementation acceptance criterion is marked complete by these checks.
- Application, database-regression and browser checks: not run for this planning review; no implementation changed. All AC1–AC3 runtime/preservation evidence remains outstanding. No reset, migration-up, history repair, source-data copy or hosted operation was performed.

## Risks, limitations, and follow-ups

2026-10-16 subsequent operating decision: [DEV0272](../../archive/backend/DEV0272-restore-isolated-local-supabase-development.md) restores ordinary development in a fresh independent `movx-club-local` stack. The old database/upload volumes remain untouched. This Draft continues to own only their optional retained-history transition and does not block the new default workflow.

Normal retained-stack startup remains unresolved. The baseline packaging mismatch, genuinely missing scheduling migrations and recorded-versus-Git SQL variation require a verified transition, not merely restored filenames. Next action: settle whether the retained local workflow is still needed alongside hosted dev; if so, finish its exact history/schema audit and isolated compatibility rehearsal before runtime/shared-stack changes. Do not delete migration evidence, accounts or files as a shortcut. New hosted dev provisioning and any data transfer need their own bounded ownership; this ticket does not block a fresh-project setup.

## Completion and review references

- Completed: Not completed.
- Commit: User-authorized workspace checkpoint (this commit, subject includes DEV0232) records the read-only findings/proposed continuity plan. Earlier plan remains in `[DEV0221][DEV0231][DEV0232] Add coach-athlete connections and database follow-ups`; runtime remains Draft.
- Review: Read-only source/ledger/startup investigation on 2026-10-16; no independent review or runtime acceptance.
- Deployment or release: Not applicable — planning only.
