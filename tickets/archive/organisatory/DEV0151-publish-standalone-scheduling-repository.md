# Ticket DEV0151: Publish standalone scheduling repository

- Status: Completed
- Created: 2026-10-08
- Last updated: 2026-10-08
- Milestone: Standalone scheduling project
- Coordination: None — independent development ticket
- Related records: [DEV0140 — Adopt the scheduling-only contract](DEV0140-adopt-scheduling-only-contract.md), [DEV0147 — Separate client onboarding and verified coach access](../backend/DEV0147-separate-client-onboarding-and-verified-coach-access.md), [DEV0149 — Replace the user Coach tab with My sessions](../frontend/DEV0149-replace-user-coach-tab-with-my-sessions.md), [DEV0150 — Hide My sessions from signed-out navigation](../frontend/DEV0150-hide-my-sessions-from-signed-out-navigation.md)

## Objective and context

Publish the scheduling-only product as an independent GitHub repository at `github.com/hworldcom/fitness-booking-schedule-app`, while retaining `github.com/hworldcom/fitness-booking-social-app` as the separate Solana hackathon project. The new repository is empty and the current `scheduling-only` branch contains the completed scheduling pivot plus uncommitted client/coach separation and navigation work. This ticket owns the safe documentation, checkpoint commit, remote publication and separation evidence; it does not change scheduling behavior.

## Scope and non-goals

- In scope:
  - describe this repository as the standalone scheduling product rather than a temporary branch;
  - preserve historical records while clearly separating them from current runtime scope;
  - verify ignored local/hosted environment files are absent from the commit;
  - commit the completed scheduling work with every applicable development-ticket ID;
  - add the new GitHub repository as a separate remote and publish the scheduling branch as its `main` branch;
  - verify the published head and retain the existing original remote unchanged for the hackathon repository.
- Out of scope:
  - modifying or pushing the Solana hackathon branch/repository;
  - deploying the scheduling application to Vercel or provisioning production Supabase;
  - rewriting shared Git history or deleting archived Solana records/migrations;
  - implementing the planned notification system.

## Expected behavior and edge cases

- The standalone scheduling repository's `main` resolves to the exact reviewed local scheduling commit.
- The original `origin` continues to point to `fitness-booking-social-app`; publication uses a distinct remote so the hackathon project is not overwritten.
- `.env.local`, `.env.staging.local`, generated evidence and other ignored files are not committed or pushed.
- Current runtime/build contains no blockchain surface even though preserved history may describe superseded Solana work.
- An empty or unreachable target remote fails before any original-remote mutation.

## Assumptions, decisions, and dependencies

- Adopted user decision, 2026-10-08: maintain two separate projects—one deployable scheduling platform and one Solana hackathon project.
- Adopted target: `git@github.com:hworldcom/fitness-booking-schedule-app.git` is the scheduling repository; the existing `fitness-booking-social-app` repository remains the hackathon repository.
- Read-only verification on 2026-10-08 found the target repository reachable with no refs, so publishing `scheduling-only:main` will not overwrite existing commits.
- The completed DEV0147, DEV0149 and DEV0150 work shares documentation and implementation files, while DEV0148 is the linked admin-panel planning record. One checkpoint commit must reference every included DEV record to preserve the repository's commit policy.
- Pre-implementation review found one repository-publication task; no coordination split is required.

## Implementation plan

1. Create this ticket and update the work-record index before repository/document changes.
2. Replace temporary branch wording in current navigation documents with standalone scheduling-repository wording and link the separate hackathon repository.
3. Recheck ignored files, diff integrity, validation evidence and staged contents; create one checkpoint commit with all applicable DEV IDs.
4. Add a distinct `schedule` remote, push the local scheduling commit to its `main`, and compare local/remote object IDs.
5. Complete and archive the ticket with the final commit/publication evidence.

## Acceptance criteria

- [x] AC1: README/specification identify this as the standalone scheduling project and distinguish the separate Solana hackathon repository.
- [x] AC2: Local secrets and ignored environment files are absent from the published commit.
- [x] AC3: Completed scheduling work is committed with all relevant DEV identifiers and a clean worktree.
- [x] AC4: `fitness-booking-schedule-app` has a `main` branch at the exact local scheduling commit while the original remote remains unchanged.
- [x] AC5: Relevant unit, type, lint, format, build, browser/Auth and diff checks pass or are linked to exact current-code evidence.

## Validation plan

- Use `git check-ignore`, staged-file review and tracked-file searches without printing secret values.
- Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build` and `git diff --check`; retain the immediately preceding successful desktop/mobile and local Auth evidence because publication changes documentation and Git metadata only.
- Verify commit subject/ticket inclusion, `git status`, `git remote -v`, local `HEAD`, and `git ls-remote schedule refs/heads/main`.
- No database test or migration run applies because repository publication does not alter schema or runtime behavior.

## Implementation record

Publication is complete. Current navigation documents describe this checkout as the standalone scheduling repository and link the separate Solana hackathon repository. The target was verified reachable and empty before the first write. The reviewed scheduling checkpoint was committed as `b8d98815703769669d0cc38fb5c20a78fef42e1e` and pushed as the new repository's `main`; its symbolic `HEAD` also resolves to `main`. The original hackathon remote remains unchanged, and ignored local environment files were excluded.

### Changes and rationale

- Replaced temporary `scheduling-only` branch wording in current product documents with standalone-repository wording while preserving historical ticket terminology.
- Linked `fitness-booking-social-app` as the separate Solana hackathon repository and retained archived history as provenance rather than current runtime scope.
- Verified the new SSH remote has no refs and confirmed `.env.local` plus `.env.staging.local` are ignored by the repository rules.
- Re-ran the repository checks on the complete scheduling changes before staging.
- Created one traceable checkpoint commit covering the already-integrated DEV0147/DEV0149/DEV0150 work, the DEV0148 planning record and this publication task.
- Added `schedule` as a distinct remote, published `scheduling-only:main`, and compared the complete local and remote object IDs before completing the record.

### Affected files

| File or component | Change and purpose |
| ----------------- | ------------------ |
| `README.md` | Identifies this as the standalone scheduling project and links the separate hackathon repository. |
| `docs/mvp-spec.md` | Changes current contract wording from a temporary branch to the standalone scheduling repository without changing product behavior. |
| `tickets/README.md`, this ticket and related records | Track repository publication, validation and the shared checkpoint commit. |
| Local Git configuration and GitHub remote | Retains existing `origin`, adds the distinct `schedule` remote and publishes the reviewed scheduling commit as target `main`. |

### Decisions and deviations

- 2026-10-08: Preserve shared history in the scheduling repository rather than squash it; archived records remain useful provenance and current documents clearly define runtime scope.

### Contracts, configuration, and operations

No application API, database schema, migration, dependency or environment-variable contract changed. Git remote and repository ownership change only.

## Validation results

| Criterion | Evidence | Result |
| --------- | -------- | ------ |
| AC1 | README and specification now identify the standalone scheduling repository and the separate Solana hackathon project; current-document branch wording was reconciled. | Passed |
| AC2 | `git check-ignore -v .env.local .env.staging.local` matched the repository's `.env.*` rule. Neither file appears in the tracked or proposed change list, and their values were not read or printed. | Passed |
| AC3 | `git diff --cached --check` passed before commit; the staged-name audit contained 70 reviewed source/document/ticket files and no local environment or generated evidence file. Commit `b8d9881` uses subject `[DEV0147][DEV0148][DEV0149][DEV0150][DEV0151] Publish standalone scheduling platform`; the worktree was clean immediately afterward. | Passed |
| AC4 | `git push -u schedule scheduling-only:main` created target `main`. Local `HEAD` and `git ls-remote schedule refs/heads/main` both returned `b8d98815703769669d0cc38fb5c20a78fef42e1e`, and the target symbolic `HEAD` is `refs/heads/main`. `origin` still points to `git@github.com:hworldcom/fitness-booking-social-app.git`; local hackathon `main` remains `52b2730` and was not pushed or modified. | Passed |
| AC5 | `npm test` passed 66/66; `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build` and `git diff --check` passed. The immediately preceding final-code `npm run test:e2e` passed 28/28 desktop/mobile tests and `npm run test:auth` passed the complete two-account local email-code rehearsal. | Passed |

`npm run test:db` was not repeated for repository publication. DEV0147's final code already passed 152 pgTAP assertions and 31 runtime integration tests, while DEV0151 changes only documentation and Git metadata.

## Risks, limitations, and follow-ups

- The new scheduling repository preserves earlier commits and archived records containing hackathon history; this is provenance, not reachable scheduling runtime.
- Deployment and notification delivery require separate current development tickets.

## Completion and review references

- Completed: 2026-10-08; standalone scheduling source published and exact remote head verified.
- Commit: `b8d9881` — `[DEV0147][DEV0148][DEV0149][DEV0150][DEV0151] Publish standalone scheduling platform`; completion evidence is recorded in `[DEV0151] Record standalone repository publication`.
- Review: Self-review completed against AC1–AC5; no independent review or pull request created.
- Deployment or release: Source published to GitHub; the application is not deployed.
