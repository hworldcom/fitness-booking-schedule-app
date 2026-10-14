# Ticket DEV0035: Track project work records

- Status: Completed
- Created: 2026-09-20
- Last updated: 2026-10-14
- Milestone: Repository workflow
- Coordination: None — independent development ticket
- Related records: corrects the repository state after [DEV0009 — Comprehensive repository ignore rules](DEV0009-comprehensive-gitignore.md); preserves the record system established through [DEV0034 — Explicit coordination membership](DEV0034-explicit-coordination-membership.md); enables the completed [DEV0030 — Frontend screen module boundaries](../frontend/DEV0030-frontend-screen-module-boundaries.md) implementation to be committed with its durable record

> Documentary pruning — 2026-10-14, [DEV0225](DEV0225-remove-blockchain-historical-evidence.md): superseded feature evidence and deleted-reference details were removed at the user’s request. Retained text records the independent outcome at its original date. Code/data fragments are historical excerpts, not complete current contracts; aggregate test totals remain totals of the original runs, not new retained-only validation. Original completion dates remain unchanged. Earlier revisions remain in Git history.

## Objective and context

Make the repository's existing ticket system and historical document archive durable in Git. The first application commit did not include `tickets/`, `docs/archive/` or `.gitignore`; the working-tree `.gitignore` also excludes the two documentation inputs even though README and AGENTS.md link to them and contributor policy requires development-ticket records in implementation commits.

This is a one-time repository baseline correction. Without it, a normal feature commit cannot include its implementation record, ticket-index update or coordination evidence, and a clean checkout contains broken navigation to the missing project history.

## Scope and non-goals

- In scope: stop ignoring `/tickets` and `/docs/archive`; add the existing current/archive records, templates, guides and historical documents to the Git baseline; preserve their current contents; validate ticket/index/coordination/link consistency and remaining ignore coverage; keep the completed DEV0030 source commit separate.
- Out of scope: changing application behavior, product requirements, existing ticket decisions/statuses, rewriting historical records, modifying generated/dependency/secret ignore rules, or including DEV0030 application files in this baseline commit.

## Expected behavior and edge cases

Normal Git status and staging must see existing and future ticket records and archived documents. Generated output, dependencies, secrets, local databases, tool state and editor files remain ignored. The baseline commit may introduce many documentation files because none were present in the first commit; it must not absorb the pending DEV0030 source/README changes.

The existing completed DEV0030 record reflects work already present in the working tree. Its application files and a final completion-reference update remain for the separate `[DEV0030]` commit immediately after this baseline.

## Assumptions, decisions, and dependencies

The ticket and document archives are project inputs, not machine-local output. Removing the two root ignore entries is preferable to force-adding selected files: it makes future tickets visible automatically and avoids a partial ticket tree with unresolved links.

The current `.gitignore` is untracked, so adding it with the corrected rules establishes the repository's first durable ignore contract.

## Implementation plan

1. Create and index DEV0035 before changing `.gitignore`.
2. Remove only the `/tickets` and `/docs/archive` exclusions; preserve every generated, dependency, secret and machine-local ignore rule.
3. Validate all work-record metadata, index entries, coordination membership and repository-local Markdown links.
4. Stage only `.gitignore`, `tickets/` and `docs/archive/`; confirm DEV0030 application/README changes remain unstaged.
5. Complete and archive DEV0035, update the ticket index, revalidate the staged baseline and commit it with a DEV0035 subject.

## Acceptance criteria

- [x] AC1: `/tickets` and `/docs/archive` are no longer ignored, and their complete existing contents are visible to Git.
- [x] AC2: Ticket/index/lifecycle/coordination metadata and all repository-local Markdown links pass validation after the baseline is prepared.
- [x] AC3: Existing generated-output, dependency, secret, local-database, blockchain-state and editor ignore coverage remains intact.
- [x] AC4: The DEV0035 commit contains only the documentation/ignore baseline; pending DEV0030 application and README changes remain separate.

## Validation plan

Run `git check-ignore` for the newly tracked documentation paths and representative still-ignored paths. Run the repository ticket/Markdown validator and Prettier across all ticket and archived-document Markdown. Inspect the staged file list and staged diff summary to confirm only `.gitignore`, `tickets/` and `docs/archive/` are included. Application tests, lint, typecheck and builds do not apply because this ticket changes repository tracking and documentation only; DEV0030 retains its separate runtime evidence.

## Implementation record

Implementation started after this ticket and index entry were created. The ticket moved from Draft through Ready to In progress because the affected paths and validation boundary were explicit and no product decision was involved.

### Changes and rationale

Removed only the `/tickets` and `/docs/archive` entries from the previously untracked root `.gitignore`. This makes the repository's workflow records and superseded document history normal project inputs while retaining every generated, dependency, secret and machine-local exclusion.

Added the complete existing ticket tree and three archived product documents as one baseline because none existed in the first Git commit. DEV0030's application files and root README change remain outside this baseline and will be committed separately.

### Affected files

| File or component                                                       | Change and purpose                                                                                           |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [`.gitignore`](../../../.gitignore)                                     | Establishes the repository's ignore policy without excluding project records or historical documents.        |
| [`tickets/`](../../README.md)                                           | Adds the complete work-record system: index, templates, current records, coordination and completed history. |
| `docs/archive/2026-09-18/` (historical path; absent from this checkout) | Adds the preserved superseded product documents referenced by current navigation and historical records.     |

### Decisions and deviations

No scope deviation occurred. The archived `docs/archive/2026-09-18/implementation-plan.md` does not match current Prettier output, and `fitness_social_hackathon_mvp_summary.md` contains a pre-existing two-space Markdown hard break. Both were deliberately preserved byte-for-byte as historical material rather than rewritten to satisfy current style checks. Current ticket records all pass formatting.

### Contracts, configuration, and operations

Git tracking is the only changed contract: ticket and document archive changes will now appear normally in status/staging and future commits. No runtime dependency, environment variable, application configuration, schema, API, UI, deployment or migration changed. Rollback would remove the newly tracked documentation and restore the two ignore entries, but doing so would again conflict with the contributor workflow.

## Validation results

- **Visibility — passed:** `git check-ignore` produced no matches for `tickets/README.md`, this ticket or `docs/archive/2026-09-18/implementation-plan.md`; all 48 prepared baseline files are visible to Git.
- **Record and link validation — passed:** `python3 /tmp/validate_repx_ticket_structure.py` found 31 unique records—30 DEV and one COR—with correct lifecycle/index/coordination metadata and valid local links across 50 Markdown files before self-archive.
- **Formatting — passed for current records:** `npx prettier --check "tickets/**/*.md"` accepted every ticket document. The archived implementation plan's pre-existing style warning was reviewed and intentionally preserved as historical content.
- **Staged-boundary review — passed:** the staged baseline contains only `.gitignore`, `tickets/` and `docs/archive/`—48 files and no `src/`, root `README.md`, package or test path. The pending tracked DEV0030 application changes and untracked `src/features/` files remain outside the baseline commit.
- **Historical whitespace review — accepted:** `git diff --cached --check` reported only the preserved two-space hard break in the archived MVP summary; no ticket, configuration or runtime file introduced a whitespace error.
- **Final lifecycle validation — passed:** after self-archive, the record validator found 31 unique records—30 DEV and one COR—with 10 current and 21 archived records; all metadata and local links resolved across 50 Markdown files.
- **Application validation — not applicable:** no runtime input or behavior changed. DEV0030's completed unit, lint, type, build and browser evidence remains in its own record.

| Criterion | Evidence                                               | Result |
| --------- | ------------------------------------------------------ | ------ |
| AC1       | Ignore/visibility checks and complete staged inventory | Passed |
| AC2       | Record/link validator and ticket formatting            | Passed |
| AC3       | Representative ignored-path checks                     | Passed |
| AC4       | Staged name/status and source guard                    | Passed |

## Risks, limitations, and follow-ups

The baseline necessarily adds the repository's full pre-existing record history in one commit because the first commit omitted it. Historical contents remain unchanged except for link repairs already required by delivered file moves. DEV0030 must be committed immediately afterward so its source changes and final record reference remain aligned.

## Completion and review references

- Completed: 2026-09-20 — project work records and historical documents prepared as a tracked baseline with existing ignore coverage preserved.
- Commit: This commit — `[DEV0035] Track project work records`.
- Review: Staged-boundary and documentation self-review completed; no independent review or pull request.
- Deployment or release: Not applicable — repository documentation/tracking only.
