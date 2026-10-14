# Ticket DEV0003: Consolidate project documentation

- Status: Completed
- Created: 2026-09-18
- Last updated: 2026-10-14
- Milestone: Project maintenance, before M0
- Coordination: None — independent development ticket
- Related tickets: [DEV0001](DEV0001-ticket-workflow-and-agent-instructions.md), [DEV0002](DEV0002-ticket-number-in-commit-subjects.md)

> Documentary pruning — 2026-10-14, [DEV0225](DEV0225-remove-blockchain-historical-evidence.md): superseded feature evidence and deleted-reference details were removed at the user’s request. Retained text records the independent outcome at its original date. Code/data fragments are historical excerpts, not complete current contracts; aggregate test totals remain totals of the original runs, not new retained-only validation. Original completion dates remain unchanged. Earlier revisions remain in Git history.

## Objective and context

The user requested a folder cleanup and a single source of truth. Product requirements currently overlap across the original summary, review, build specification, implementation plan, README, and agent instructions. Contributor and commit rules are also repeated in the ticket guide and template.

Make [docs/mvp-spec.md](../../../docs/mvp-spec.md) the only current product/design/delivery contract, with clear ownership for workflow and execution evidence. Preserve historical inputs without leaving them in the active reading path.

## Scope and non-goals

- In scope: consolidate product requirements, rationale, milestones, validation scenarios, and demo script; archive superseded documents with explicit notices; simplify navigation and duplicate workflow guidance; repair links; record validation.
- Out of scope: changing product behavior, approving every proposed technical choice, application implementation, dependencies, Git initialization, commits, deployment, or deleting historical content.

## Expected behavior and edge cases

- A new contributor starts at README and finds one current specification, not several competing product briefs.
- Product changes update the specification; workflow changes update AGENTS; tickets explain a change and its evidence without overriding either current contract.
- Archived drafts are labelled historical and link to the current specification. Their existing technical content is preserved even where superseded.
- Completed tickets remain historical implementation evidence; their original claims/results are not rewritten to appear current.
- Confirmed user constraints remain distinct from recommended implementation defaults. The cleanup adds no application behavior or approval gate.

## Assumptions, decisions, and dependencies

- Retain the stable `docs/mvp-spec.md` path to minimize link churn.
- Merge the implementation plan into the specification rather than keeping a second active plan.
- Move the original summary, review, and former implementation plan into `docs/archive/2026-09-18/`; preserve their bodies apart from navigation repairs and archive notices.
- AGENTS remains authoritative for contributor rules, including ticket-before-implementation and ticket numbers in commit subjects. The ticket index remains authoritative for ticket status.
- No application or Git repository exists in this folder; documentation checks are appropriate.

## Implementation plan

1. Create this ticket and index entry before editing implementation documents.
2. Consolidate the specification with the plan, acceptance matrix, demo script, retained business context, and a clear authority/maintenance policy.
3. Archive superseded source documents with provenance notices and repaired links.
4. Reduce README to navigation. Replace repeated product/workflow rules with links in AGENTS, the ticket guide, and template while preserving all mandatory rules in their owning document.
5. Check relative links and heading anchors, code fences, archive preservation, coverage of all former plan sections, and current/historical authority wording.
6. Review scope, finish this record, and complete the ticket/index.

## Acceptance criteria

- [x] AC1: One active specification contains current product scope, design, milestones, acceptance checks, and demo instructions.
- [x] AC2: Superseded documents are archived with explicit notices and preserved historical content.
- [x] AC3: README, AGENTS, ticket guide, and template agree on document ownership; workflow requirements and commit conventions are preserved in AGENTS.
- [x] AC4: Local Markdown file/anchor links and code fences validate; no active navigation depends on a superseded plan.
- [x] AC5: No product behavior or application code changes; this ticket and index document actual changes and verification.

## Validation plan

- Snapshot the original documents in temporary storage for preservation checks.
- Run a standard-library Python check of Markdown file links, heading anchors, and balanced code fences across all project documents.
- Compare archived bodies to their original versions, allowing only the planned navigation changes/notices.
- Check that the specification retains M0–M4, every acceptance-matrix row, the demo script, and current behavior sections; manually review context and authority wording.
- Application lint, build, and runtime tests do not apply to a documentation-only cleanup before scaffolding.

## Implementation record

Consolidation completed on 2026-09-18. Product scope and planned behavior are unchanged.

### Changes and rationale

Previously, a contributor had to reconcile four product documents and repeated workflow policies. There is now one active product file, `docs/mvp-spec.md`, containing the original reviewed behavior plus the delivery milestones, acceptance matrix, and demo script. The review's customer/economic assumptions were also retained there so business context is available without reading the archive.

README now directs readers to the owning document instead of restating requirements. AGENTS owns contributor policy, including the ticket lifecycle moved out of the ticket guide. The guide and template link to that policy rather than repeat the commit convention. Tickets remain implementation evidence, and product changes must update the specification in the same change.

The earlier summary, review, and implementation plan were moved to a dated archive. Each has a conspicuous superseded notice, original-path provenance, and a working link to the current specification. No historical body content was removed, and completed tickets 0001 and 0002 were left byte-for-byte unchanged.

### Affected files

| File or component                                              | Change and purpose                                                                                                                              |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| [README.md](../../../README.md)                                | Replaced overlapping summaries and reading lists with concise document ownership/navigation.                                                    |
| [docs/mvp-spec.md](../../../docs/mvp-spec.md)                  | Became the sole active product contract; added navigation, authority/update rules, business context, M0–M4, acceptance matrix, and demo script. |
| [AGENTS.md](../../../AGENTS.md)                                | Centralized workflow/status rules and replaced duplicated product rules with specification links.                                               |
| [tickets/README.md](../../README.md)                           | Reduced the guide to policy references and the ticket index; recorded this completed task.                                                      |
| [tickets/TEMPLATE.md](../../TEMPLATE.md)                       | Clarified that the template is a record form and linked to the authoritative commit rule.                                                       |
| [Ticket DEV0003](DEV0003-consolidate-project-documentation.md) | Recorded the cleanup plan before edits and retained the implementation/validation trail.                                                        |

### Decisions and deviations

2026-09-18: Preserve superseded material in a dated archive, consolidate into the existing spec path, and keep workflow and ticket history separate from product requirements. No product change is intended.

No material deviation from the plan. The existing responsiveness/accessibility rule was transferred from AGENTS into the specification, preserving it as a product requirement. The proposed-versus-confirmed decision distinction remains explicit.

### Contracts, configuration, and operations

Documentation ownership and three file paths changed. The stable `docs/mvp-spec.md` path remains valid. All repository-local navigation was repaired; links in previous chat messages or external bookmarks to moved files cannot be rewritten by this cleanup. The dated archive preserves those files for lookup.

No application interfaces, schemas, dependencies, environment variables, migrations, or external operations changed. This folder is not a Git repository; no Git initialization or commit was performed. Temporary snapshots/checking scripts were created outside the project for validation only; the project has no new tooling dependency.

## Validation results

Validated locally on 2026-09-18 using Python 3, ripgrep, and manual review.

Commands and observed results:

- `python3 /private/tmp/fitness-docs-cleanup-fMlb72/validate_cleanup.py` — passed. The checker resolves local Markdown files/directories and heading fragments, checks fenced blocks, compares archived bodies with their pre-edit snapshots after allowing only notices/link repairs, verifies retained requirements, and checks document ownership. It also checks that the three mandatory commit/record/validation policy sections are unchanged and that completed tickets 0001 and 0002 are byte-for-byte unchanged.
- Coverage comparison passed for all three archived bodies, all five milestones and their work/exit requirements, all 21 acceptance scenarios, the demo script, and every pre-existing substantive line in the specification's behavior sections.
- `rg --files --hidden -g '!.git' -g '!node_modules' .` — the folder contains 11 Markdown files, including the new ticket and three relocated historical documents. There is one active Markdown file directly under `docs/` and no application code.
- `rg -n 'implementation-plan\.md|mvp-review\.md|fitness_social_hackathon_mvp_summary\.md' README.md AGENTS.md tickets/README.md tickets/TEMPLATE.md` — no matches, confirming active navigation no longer points to the superseded files.
- Manually read README, AGENTS, the ticket guide/template, the merged specification, and archive headers together. Confirmed one active product contract, one contributor policy, preserved authorization/commit rules, and no product-scope changes.

The first preservation-check run reported a mismatch because the temporary validator removed the original blank line after each title while stripping archive notices. Corrected that normalizer and reran successfully; no historical content needed correction. Temporary snapshots and the one-off validator are not project dependencies or permanent test infrastructure.

Application lint, build, and runtime tests were not run: this task only restructures documentation, and application tooling does not exist. No required validation remains failed or blocked.

| Criterion | Evidence                                                                                                                    | Result |
| --------- | --------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Only `docs/mvp-spec.md` remains active under `docs/`; all milestone/acceptance/demo coverage checks passed.                 | Passed |
| AC2       | Three archive notices/provenance links present; normalized archived bodies match originals.                                 | Passed |
| AC3       | Manual ownership review and unchanged mandatory-policy checks; all six ticket statuses retained in AGENTS.                  | Passed |
| AC4       | Local file/directory/anchor links and fenced blocks pass; active-navigation scan has no superseded paths.                   | Passed |
| AC5       | Markdown-only inventory, unchanged original product requirements, completed ticket/index, and unchanged historical tickets. | Passed |

## Risks, limitations, and follow-ups

Archived content intentionally preserves superseded proposals and is explicitly labelled historical. Previous chat links or external bookmarks to the moved files may be stale; current folder navigation points to their new locations. This is documentation organization, not automated enforcement of future contributor behavior. No follow-up is required for this cleanup.

## Completion and review references

- Completed: 2026-09-18. One current MVP specification, a clearly separated archive, and centralized workflow references are in place.
- Review: Self-reviewed against all five acceptance criteria. No independent review, commit, or pull request.
- Deployment or release: Not applicable; documentation only.
