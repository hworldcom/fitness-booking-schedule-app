# Ticket DEV0113: Reconcile current project status

- Status: Completed
- Created: 2026-10-04
- Last updated: 2026-10-14
- Milestone: Project documentation maintenance
- Coordination: None — independent development ticket
- Related records: follows the legacy-record cleanup in [DEV0112 — Prune superseded product tickets](DEV0112-prune-superseded-product-tickets.md); reflects completed delivery from [DEV0100 — Add coach follows and chronological posts](../backend/DEV0100-coach-follows-and-chronological-posts.md) and [DEV0104 — Publish weekly coach availability](../backend/DEV0104-publish-weekly-coach-availability.md)

> Documentary pruning — 2026-10-14, [DEV0225](DEV0225-remove-blockchain-historical-evidence.md): superseded feature evidence and deleted-reference details were removed at the user’s request. Retained text records the independent outcome at its original date. Code/data fragments are historical excerpts, not complete current contracts; aggregate test totals remain totals of the original runs, not new retained-only validation. Original completion dates remain unchanged. Earlier revisions remain in Git history.

## Objective and context

Correct the repository overview and the current [MVP specification](../../../docs/mvp-spec.md#1-product-status-and-document-authority) so their project-status summaries agree with the ticket index. The specification repeats the stale claim that completed weekly availability and coach posts remain planned.

This is a factual documentation correction after DEV0100, DEV0104 and DEV0112. It does not change the product contract or application behavior.

## Scope and non-goals

- Retained scope: align README/specification status with recorded independent implementation and validation evidence, distinguish delivered behavior from incomplete work, and repair documentation consistency.
- Non-goals: application implementation, new product decisions or claiming unperformed validation.

## Expected behavior and edge cases

Readers should be able to distinguish implemented-and-completed capabilities, implemented work that still lacks required completion evidence and work that remains planned. The legacy-history statement should not imply that the 61 ticket records deliberately pruned by DEV0112 are still present, while still explaining that relevant retained records, additive migrations, the reserved-ID register and Git history preserve necessary evidence.

## Assumptions, decisions, and dependencies

- DEV0100 and DEV0104 are authoritative for completed coach social and weekly-availability delivery.

- The specification's target behavior remains unchanged. Only its repository-state summary and last-updated date require correction.

## Implementation plan

1. Register DEV0113 in the ticket index and reserve DEV0114 as the next development identifier.
2. Correct the README's legacy-evidence and delivered/planned capability summaries.
3. Correct the specification's matching repository-state summary and date without changing target requirements.
4. Check local Markdown links, index/status agreement, focused formatting and whitespace.
5. Record exact results, complete DEV0113 and move it to the organisational archive only after all acceptance criteria pass.

## Acceptance criteria

- [x] AC1: The README accurately describes retained records, pruned identifiers and Git history without claiming that all old archived tickets remain in the working tree.

- [x] AC4: DEV0113 is indexed exactly once with matching status, all changed local Markdown links resolve, focused formatting passes and `git diff --check` reports no errors.

## Validation plan

Run a local Markdown-link check over every changed document, verify the ticket index and ticket status agree, run Prettier over the changed Markdown files and run `git diff --check`. Application, database, browser, blockchain, type, lint and build checks are not applicable because the ticket changes project-status documentation only.

## Implementation record

Reconciled the two public project-status summaries with the authoritative work records. The documentation now separates completed coach-marketplace slices, incomplete capabilities, locally implemented work awaiting manual evidence and recoverable history whose legacy ticket files were deliberately pruned.

### Changes and rationale

Replaced the README's claim that archived tickets remain with the narrower DEV0112 evidence boundary: retained reusable foundation and cleanup records, additive migrations, the reserved-identifier register and Git history. Added a direct DEV0112 link and kept the DEV0101 runtime-removal boundary explicit.

Moved weekly availability and the coach social loop into the completed README and specification summaries, linking their archived delivery records from the README.

This preserves the distinction between available code and a completed work record.

### Affected files

| File or component                                                                      | Change and purpose                                                                                                                     |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| [MVP specification](../../../docs/mvp-spec.md#1-product-status-and-document-authority) | Corrected the matching repository-state summary and document date without changing target product behavior.                            |
| [Work-record index](../../README.md)                                                   | Registered DEV0113, advanced the next available development ID to DEV0114 and moved the completed ticket entry into the archive table. |
| This development ticket                                                                | Recorded scope, rationale, affected contracts, validation evidence and completion status for the correction.                           |

### Decisions and deviations

- 2026-10-04: Included the specification's repository-state paragraph because it repeated the same stale availability and coach-post claims as the README. This is a consistency correction, not a product-contract change.
  The documentation does not collapse "implemented locally" into "Completed."
- No deviation from the planned implementation scope.

### Contracts, configuration, and operations

No application contract, schema, dependency, environment variable, setup step, migration, compatibility boundary or deployment operation changed. The specification's target behavior remains unchanged; only its description of repository delivery status and last-updated date changed. Rollback consists solely of reverting these documentation edits.

## Validation results

Validated locally on 2026-10-04.

- A read-only Node Markdown audit checked local links and anchors across the README, specification, ticket index and DEV0113. Its first pre-archive run found the new ticket's abbreviated specification anchor; after correcting it to `#1-product-status-and-document-authority`, that run reported `FILES=4 LOCAL_LINKS=96 ERRORS=0`. The final archived-record audit reported `FILES=4 LOCAL_LINKS=99 ERRORS=0`.
- A focused stale-phrase scan returned no old claim that archived tickets remain, coach posts are incomplete or weekly availability and coach posts remain planned.
- `npx prettier --check README.md docs/mvp-spec.md tickets/README.md tickets/current/organisatory/DEV0113-reconcile-current-project-status.md` initially identified only ticket-index table alignment. After the mechanical format pass, the same focused check passed for all files. The final archived-path check also passed.
- `git diff --check` passed with no whitespace errors before archival and again after the final record/index update.
- Application, database, browser, blockchain, type, lint and build checks were not run because this ticket changes status documentation only and no executable or configuration file.

| Criterion | Evidence                                                                                                                                            | Result |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | README names retained records, migrations, the reserved-ID register and Git history, and links the 61-record DEV0112 prune explicitly.              | Passed |
| AC4       | Final index/status review, 99-link audit, focused Prettier check and whitespace check passed; DEV0114 is the next available development identifier. | Passed |

## Risks, limitations, and follow-ups

The overall MVP remains incomplete. No follow-up is required for this documentation correction.

## Completion and review references

- Completed: 2026-10-04 — original completion date; superseded details pruned under DEV0225.

- Commit: Not created.
- Review: Self-reviewed against AC1–AC4; no independent review.
- Deployment or release: Not applicable.
