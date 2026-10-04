# Ticket DEV0112: Prune superseded product tickets

- Status: Completed
- Created: 2026-10-03
- Last updated: 2026-10-03
- Milestone: Coach-marketplace repository consolidation
- Coordination: None — independent development ticket
- Related records: coach-first delivery was coordinated by [COR0009 — Coach-first private-class booking MVP](COR0009-coach-first-training-package-mvp.md); [DEV0094 — Adopt the coach-first training-package MVP](DEV0094-adopt-coach-first-training-package-mvp.md) established that historical replacement contract

## Objective and context

Remove ticket files that belong only to the superseded challenge/community-fitness, club/access, and multi-gym/membership product directions. Keep the current user-and-coach marketplace queue, its coach-first delivery history, and reusable database, authentication, wallet, runtime, frontend-boundary, staging, and contributor-workflow foundations that the current product still uses.

The user explicitly requested this cleanup on 2026-10-03. It is a deliberate exception to the repository's normal instruction to retain archived records. Git history remains the recovery path; deleted identifiers remain permanently reserved so no future ticket or commit can reuse them.

## Scope and non-goals

- In scope: delete the 61 superseded ticket/coordination files listed below; remove their index rows; preserve their identifiers in a compact pruned-record register; replace or remove inbound links from retained records and current documentation; validate that retained Markdown has no broken local links or stale current-work claims.
- Out of scope: application behavior, source code, schemas, migrations, dependencies, product requirements, current coach-first tickets, reusable platform/workflow foundations, commits, deployment, and removal of design assets still used by the current interface.

### Records selected for deletion

- Backend: DEV0014, DEV0018, DEV0022, DEV0023, DEV0041, DEV0048, DEV0067, DEV0078, DEV0079, DEV0080, DEV0083, DEV0084, DEV0086, DEV0088, DEV0090.
- Blockchain: DEV0006, DEV0007, DEV0024, DEV0037, DEV0081, DEV0082, DEV0089, DEV0092.
- Frontend: DEV0008, DEV0019, DEV0020, DEV0043, DEV0044, DEV0045, DEV0049, DEV0051, DEV0053, DEV0057, DEV0059, DEV0060, DEV0061, DEV0062, DEV0063, DEV0064, DEV0072, DEV0073, DEV0074, DEV0075, DEV0076, DEV0085, DEV0087.
- Organisatory: COR0002, COR0005, COR0006, COR0007, COR0008, DEV0004, DEV0005, DEV0058, DEV0066, DEV0068, DEV0069, DEV0070, DEV0071, DEV0077, DEV0091.

## Expected behavior and edge cases

The work-record index lists only current coach-marketplace work, directly relevant coach-first history, and foundations the current implementation still consumes. No retained Markdown link resolves to a deleted file. Deleted DEV and COR identifiers remain unavailable for reuse, including retired DEV0010–DEV0013, DEV0016, and DEV0017 whose former consolidation targets may be pruned.

Current records may retain short factual statements that the coach-first product replaced a legacy direction, but must not depend on deleted records for scope or evidence. Historical implementation evidence for reusable foundations remains intact. This cleanup does not rewrite Git history or delete current runtime assets merely because their original design ticket is pruned.

## Assumptions, decisions, and dependencies

- A ticket is product-specific when its objective and acceptance criteria deliver the superseded challenge, gym/club-access, multi-gym membership, check-in, reservation, or membership-card product rather than a reusable capability consumed by the current marketplace.
- Coach-first cleanup tickets DEV0101 and DEV0109 remain because they delivered the current runtime/database baseline, even though their titles name the legacy capability they removed.
- DEV0015, DEV0021, DEV0025, DEV0027, DEV0030–DEV0040, DEV0042, DEV0046, DEV0050, DEV0052, DEV0054, DEV0065 and the workflow records remain because current marketplace work still uses their delivered boundaries or repository policy.
- The current uncommitted DEV0111 dependency update and record are unrelated and must be preserved.

## Implementation plan

1. Register DEV0112 and reserve DEV0113 as the next development identifier.
2. Delete the exact 61 files above and replace the archived index rows with a compact non-reusable identifier register.
3. Reconcile retained current/archived records and documentation so links and descriptions no longer depend on deleted product history.
4. Run repository Markdown link, record-ID, status/index, and stale-reference checks plus formatting/diff checks.
5. Record exact evidence, complete and archive DEV0112 only after every acceptance criterion passes.

## Acceptance criteria

- [x] AC1: The 61 selected legacy product records are absent while every current coach-marketplace record and identified reusable foundation remains present.
- [x] AC2: Every removed DEV/COR identifier remains explicitly reserved, existing retired IDs remain reserved, and the next available identifiers are DEV0113 and COR0010.
- [x] AC3: Retained Markdown contains no broken local links or live dependency on a removed record; current record statuses and index rows agree.
- [x] AC4: No application, test, schema, migration, dependency, environment, or deployment file changes as part of DEV0112; the unrelated DEV0111 changes remain intact.

## Validation plan

Compare exact before/after record inventories and assert every keep/remove decision. Parse retained Markdown links and anchors, check unique DEV/COR filenames/headings, verify index/status agreement, scan current records for removed identifiers outside this implementation record, and run `npm run format:check`, focused Markdown formatting, and `git diff --check`. Application, database, browser, blockchain, and build tests are not applicable because this ticket changes work-record documentation only.

## Implementation record

Resolved all 113 pre-existing record files into a 61-record legacy product set and a 52-record current/foundation set. Added this cleanup record as DEV0112, deleted the selected legacy set, and retained 53 indexed records before archiving DEV0112: 14 ongoing records, 38 pre-existing archived records and this completed record.

### Changes and rationale

Removed the challenge/community-fitness, club/access and multi-gym/membership ticket lineages. Preserved the coach-marketplace work map, coach-first delivery evidence, current runtime/database cleanup records and reusable database, authentication, authorization, wallet, runtime, frontend-boundary, staging and workflow foundations.

Replaced 61 verbose archive rows with a compact permanent identifier register. Reconciled retained inbound links, removed legacy ticket references from every active record, changed three reusable authentication/identity foundations whose former coordination record was pruned to explicit independent-foundation status, and corrected retained specification anchors to the current coach-first sections. The application and retained design assets were not changed.

### Affected files

| File or component                                             | Change and purpose                                                                                                                       |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `tickets/archive/**`                                          | Removed only the explicitly listed 61 superseded product records and retained current/foundation history.                                |
| [Work-record index](../../README.md)                          | Removed deleted rows, reserved every pruned identifier, set DEV0113/COR0010 as next, and kept current/archive navigation accurate.       |
| Retained work records and current documentation               | Removed broken historical links, legacy active-queue dependencies and obsolete specification anchors while retaining factual provenance. |
| [Contributor policy](../../../AGENTS.md#product-requirements) | Corrected product-contract anchors to the current specification's stable explicit anchors; no workflow rule changed.                     |

### Decisions and deviations

- 2026-10-03: The user explicitly authorized removal of old-project tickets. This overrides normal archive retention for the listed legacy product records only; Git history provides recovery.
- 2026-10-03: Retained reusable foundations even when their implementation history predates the coach pivot, because current coach, identity, wallet, database, staging and contributor records still consume those boundaries.
- 2026-10-03: Preserved DEV0101 and DEV0109 because removing legacy runtime/schema is part of the current coach-marketplace baseline, not an active legacy-product plan.

### Contracts, configuration, and operations

No application contract, schema, dependency, environment variable, setup, migration, or deployment changes. The documentation contract changes by removing the selected ticket files and making their identifiers permanently non-reusable. The existing uncommitted DEV0111 `package.json`, `package-lock.json`, ticket-index and archived-ticket changes were present before DEV0112 and were preserved without modification by this cleanup except for the shared index's required DEV0112 additions.

## Validation results

Validated locally on 2026-10-03.

- Read-only inline Python record/link validator — passed: `RECORDS=53 CURRENT=15 ARCHIVED=38`, `PRUNED_DEV=56 PRUNED_COR=5`, `INDEXED=53 BROKEN_LINKS=0 ACTIVE_LEGACY_ID_REFS=0`, `VALIDATION=PASS` before final archival. The final run after archival reported 14 current and 39 archived with the same 53 indexed records and zero failures.
- Read-only inline Python anchor validator — passed after archival: `ANCHORS_CHECKED=31 MISSING=0`.
- The first abbreviated final inventory check incorrectly counted the narrative DEV0112 link in the pruned-ID section as an index table row and reported `INDEXED=54`. Restricting the parser to `|` table rows corrected the checker; the rerun passed with `RECORDS=53 CURRENT=14 ARCHIVED=39 INDEXED_ROWS=53`, `LOCAL_PATH_LINKS=607 ANCHOR_LINKS=31 ERRORS=0`.
- `git diff --name-only --diff-filter=D -- tickets/archive | wc -l` — returned `61` deleted archive records.
- `npm run format:check` — passed for application/configuration files.
- `{ git diff --name-only --diff-filter=ACM -- '*.md'; find tickets/current tickets/archive -type f -name 'DEV011*.md' -print; } | sort -u | xargs npx prettier --check` — passed for every changed or newly created retained Markdown file after formatting.
- `git diff --check` — passed with no whitespace errors.
- Scoped path review — no DEV0112 application, test, schema, migration, environment or deployment files. `package.json`, `package-lock.json` and DEV0111 are the preserved pre-existing security-patch work.
- Application, database, browser, blockchain and production-build tests — not run for DEV0112 because it removes and reconciles Markdown work records only; DEV0111's separate implementation record contains its own runtime validation.

| Criterion | Evidence                                                                                                                                | Result |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Exact inventory found all 61 selected paths absent and 53 retained records before archival: 14 original current, 38 archived, DEV0112.  | Passed |
| AC2       | Index validator matched 56 pruned DEV IDs, five pruned COR IDs, six older retired DEV IDs and next IDs DEV0113/COR0010.                 | Passed |
| AC3       | All 53 records were indexed once with matching status; local path and anchor audits found zero failures; active legacy references zero. | Passed |
| AC4       | Scoped diff, format and whitespace checks passed; only work-record/current-document edits belong to DEV0112.                            | Passed |

## Risks, limitations, and follow-ups

Deleted records remain recoverable from Git history but are no longer browsable in the working tree. The compact identifier register intentionally preserves IDs without preserving the superseded product plans. No follow-up is currently required.

## Completion and review references

- Completed: 2026-10-03 — removed 61 superseded product records, reserved their identifiers and reconciled the retained coach-marketplace/foundation record set.
- Commit: This commit — `[DEV0112] Prune superseded product tickets`.
- Review: Self-reviewed against AC1–AC4; no independent review.
- Deployment or release: Not applicable.
