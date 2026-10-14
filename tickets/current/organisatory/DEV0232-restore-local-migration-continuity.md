# Ticket DEV0232: Restore local migration continuity on main

- Status: Draft
- Created: 2026-10-14
- Last updated: 2026-10-14
- Milestone: Local contributor workflow
- Coordination: None — independent development ticket
- Related records: discovery baseline [DEV0221](../../archive/backend/DEV0221-persist-coach-athlete-connections.md); independent historical-evidence review [DEV0225](../../archive/organisatory/DEV0225-remove-blockchain-historical-evidence.md)

## Objective and context

Restore the normal [one-command local development workflow](../../../README.md#run-locally) without losing retained Auth, Storage or scheduling data. During DEV0221 validation the local database ledger contained already-applied versions `20261012000100`, `20261012000200` and `20261012000300`, absent from main. `supabase migration up --local` stopped with MigrationMissingLocalError even after every main migration was applied; dev:local calls that command before starting Next.js.

## Scope and non-goals

- In scope: inspect branch/source and actual schema provenance; design a safe local branch/dataset migration strategy; restore documented startup and forward migration continuity; preserve existing accounts, uploaded avatars, bookings and consent history.
- Out of scope: hosted changes, blind history repair, resets/deletions, importing unrelated product features onto main, or executing DEV0225's separate repository pruning.

## Expected behavior and edge cases

Normal startup should reuse retained local data and apply only genuinely pending scheduling migrations. Already-applied branch work must not be falsely marked reverted or silently re-executed. Switching branches, fresh setup and repeated startup need explicit compatibility/rollback behavior. Any chosen data transfer/removal must be concrete and reviewable before an irreversible operation.

## Assumptions, decisions, and dependencies

DEV0221 applies only its own tested additive SQL/ledger entry as a guarded workaround; it does not repair these three records. Source provenance and the safe isolation/reconciliation approach remain unresolved. No reset or deletion is authorised by this draft.

## Implementation plan

1. Inspect the three recorded versions and available branch sources, current schema and the startup helper without changing data.
2. Choose and document a compatible branch/dataset strategy, including Auth/Storage preservation and forward recovery; split implementation peers under a coordination record if needed before edits.
3. Implement only the adopted bounded approach and verify retained data plus normal fresh/repeated/branch-switch startup.

## Acceptance criteria

- [ ] AC1: Normal dev:local and pending migration application work on main with explicit branch compatibility.
- [ ] AC2: Existing identities, uploaded images, scheduling and connection history are preserved; no history row is falsely reverted or unrelated feature imported.
- [ ] AC3: Fresh/repeated/branch-switch and forward recovery validation passes with recorded evidence.

## Validation plan

Use isolated local copies first, then compare exact retained data/image access and normal startup on the existing loopback stack. Never reset or repair hosted data. Final commands and data-transfer/rollback steps must be specified before implementation.

## Implementation record

Not started. Only this follow-up plan was created during DEV0221 environment investigation.

### Changes and rationale

Not applicable — pending implementation.

### Affected files

Not applicable — choose after source/schema investigation.

### Decisions and deviations

Preserve current records and data; the CLI's suggested blind reverted-history repair is not an adopted solution.

### Contracts, configuration, and operations

None changed by this draft. Planned local workflow changes require an explicit compatibility and recovery contract.

## Validation results

Not run — Draft, no implementation.

## Risks, limitations, and follow-ups

The existing normal startup/migration command is currently stopped by missing local branch versions. Next action: inspect provenance and design a data-preserving local strategy; do not delete migration evidence or accounts as a shortcut.

## Completion and review references

- Completed: Not completed.
- Commit: Plan included in `[DEV0221][DEV0231][DEV0232] Add coach-athlete connections and database follow-ups`; implementation remains unstarted and Draft.
- Review: No independent review created.
- Deployment or release: Not applicable — planning only.
