# Ticket DEV0026: Organize tickets by lifecycle and implementation area

> **Structure update — 2026-09-20:** [Ticket DEV0029](DEV0029-ticket-area-archive-organisation.md) supersedes this ticket's flat-archive decision. Current and archived tickets now share frontend, backend, blockchain, and organisatory areas. The record below remains the evidence for the earlier lifecycle split.

- Status: Completed
- Created: 2026-09-20
- Last updated: 2026-10-14
- Milestone: Repository workflow
- Coordination: None — independent development ticket
- Related tickets: [DEV0001 — Ticket workflow and agent instructions](DEV0001-ticket-workflow-and-agent-instructions.md), [DEV0002 — Ticket number in commit subjects](DEV0002-ticket-number-in-commit-subjects.md), and all ticket records moved by this change

> Documentary pruning — 2026-10-14, [DEV0225](DEV0225-remove-blockchain-historical-evidence.md): superseded feature evidence and deleted-reference details were removed at the user’s request. Retained text records the independent outcome at its original date. Code/data fragments are historical excerpts, not complete current contracts; aggregate test totals remain totals of the original runs, not new retained-only validation. Original completion dates remain unchanged. Earlier revisions remain in Git history.

## Objective and context

Reorganize the flat `tickets/` directory so contributors can distinguish actionable work from historical records and find current work by its primary implementation area. Keep the root ticket index and template as stable entry points while introducing `tickets/current/frontend`, `tickets/current/backend`, `tickets/current/blockchain`, and `tickets/archive`.

This is a repository-navigation change. It must preserve ticket IDs, content, status, dependency history, product authority, and working links throughout the repository.

## Scope and non-goals

- In scope: create the lifecycle/category directories; move Draft, Ready, In progress, and Blocked tickets into the appropriate current category; move Completed and Cancelled tickets into the archive; add concise directory guidance; update `AGENTS.md`, the root ticket index, the ticket template, README, specification, archive documents, and all ticket cross-links; validate ticket uniqueness and Markdown targets.
- Out of scope: changing product behavior, reclassifying implementation status for unrelated tickets, renumbering ticket IDs, creating new frontend/backend/blockchain features, changing commit rules, or splitting one cross-cutting ticket into duplicates.

## Expected behavior and edge cases

The root `tickets/README.md` remains the canonical index and lists both current and archived records with their actual paths and status. Current tickets live under exactly one primary category. Cross-cutting work is classified by its main implementation authority and links related tickets in other areas rather than duplicating records. Category README files keep empty categories visible in Git and explain their scope.

Completed and Cancelled tickets move to the flat archive while retaining all implementation and validation history. Moving a ticket must not break links to `AGENTS.md`, the specification, the template, another ticket, or archived project documents. Ticket numbers remain unique across current and archive directories. New implementation tickets must be created in the correct current category before code changes; a ticket moves to the archive only after its final implementation record, validation, status, and index entry are complete.

## Assumptions, decisions, and dependencies

Use these primary categories:

- `frontend`: Next.js routes, browser behavior, presentation, accessibility, and client-side interaction whose main change is the interface.
- `backend`: Next.js server code, authentication, PostgreSQL/Supabase, application services, persistence, jobs, and repository workflow or infrastructure.

The archive is flat because ticket IDs already provide stable ordering and completed work no longer needs an active implementation queue. Tickets 0015–0018, 0023, and 0025 are current backend work. No current frontend ticket exists after completed frontend work moves to the archive; its category README preserves the intended structure.

This ticket starts under `current/backend` because it changes contributor infrastructure and active-ticket workflow. After its acceptance criteria pass and its record is complete, move 0026 itself to `tickets/archive` in the same change.

## Implementation plan

1. Create the current category directories and archive, including concise README files that define lifecycle and primary-area placement.
2. Move completed tickets 0001–0009, 0014, and 0019–0022 into the archive without changing their historical contents beyond paths required for navigation.
3. Move current tickets 0015–0018, 0023, and 0025 into `current/backend`, and 0024 into `current/blockchain`; retain 0026 in `current/backend` until final validation.
4. Update the contributor policy, root template, root ticket index, repository README, MVP specification, archived documents, and all inter-ticket links for the new paths.
5. Validate directory placement against status, unique IDs, ticket-index coverage, local Markdown files and anchors, and formatting of changed policy/ticket documents. Review the resulting tree manually.
6. Complete the implementation record, mark 0026 Completed, move it to the archive, update its index path, and repeat link/structure validation.

## Acceptance criteria

- [x] AC1: `tickets/current/frontend`, `tickets/current/backend`, `tickets/current/blockchain`, and `tickets/archive` exist with guidance, while `tickets/README.md` and `tickets/TEMPLATE.md` remain the stable root entry points.
- [x] AC2: Every ticket is present exactly once: open statuses are in one current category, Completed/Cancelled statuses are in the archive, and reserved IDs 0010–0013 remain unused.
- [x] AC3: `AGENTS.md` explicitly defines lifecycle movement, category ownership, cross-cutting placement, path conventions, and completion/archive timing without weakening ticket-first implementation or commit rules.
- [x] AC4: All repository-local Markdown file and heading links resolve after the moves, including links from archived tickets, the MVP specification, README, and the root ticket index.
- [x] AC5: No application source, dependency, runtime configuration, product behavior, or ticket implementation status changes as a result of the reorganization, except 0026 progressing to Completed after validation.

## Validation plan

Use a repository script to enumerate ticket headings/IDs/statuses, detect duplicate or missing IDs, compare each status with its lifecycle directory, verify index coverage, and confirm reserved IDs remain absent. Resolve every local Markdown target and heading anchor from its containing file. Run Prettier checks on newly created guidance and ticket records, manually inspect the existing compact Markdown tables in changed navigation/policy files, and inspect `rg --files tickets` for the final tree. Application tests are not required because no runtime file changes; confirm that `src`, package manifests, and runtime configuration remain untouched.

## Implementation record

Completed the lifecycle and area structure requested by the user. Before this change, 21 ticket records shared the root `tickets/` directory. The resulting structure keeps the index and template at the root, adds guidance for each directory, places open work in one primary current category, and keeps completed history in a flat archive ordered by stable ticket ID.

### Changes and rationale

- Moved completed tickets 0001–0009, 0014, and 0019–0022 to `tickets/archive/`. Their implementation and validation history is preserved; only links and a few displayed paths were adjusted for their new location.
- Moved Draft tickets 0015–0018, 0023, and 0025 to `tickets/current/backend/`. These tickets primarily own server, authentication, persistence, data, or application-service work.
- Added current, frontend, backend, blockchain, and archive README files so each category is explicit and the currently empty frontend directory remains represented in Git.
- Split the root index into current and archived sections with actual paths and an area column for current work. Preserved the `#ticket-index` heading used by existing navigation.
- Updated every repository-local Markdown link affected by the moves, including links in the MVP specification, repository README, archived source documents, current/archived tickets, and ticket index.
- Updated `AGENTS.md` and the ticket template so new records start under one current category, completed/cancelled records move only after their final record, IDs remain unique across both lifecycle directories, and cross-cutting work has one primary owner.

### Decisions and deviations

The archive is flat because stable four-digit IDs already provide ordering and completed work no longer needs an active queue. No fourth “operations” category was introduced; repository workflow belongs to backend/infrastructure while active, so 0026 started there. There were no deviations from the prepared move map. Ticket 0026 is moved to the archive only after this record and the initial validation pass are complete.

### Contracts, configuration, and operations

Repository paths are the only changed contract. Internal links now use `tickets/current/<area>/...` or `tickets/archive/...`; external bookmarks to the old flat paths may need manual correction because the filesystem cannot provide redirects. No source code, dependency, environment variable, database/schema, runtime configuration, product behavior, deployment, or rollback operation changed. Rollback would restore the flat ticket paths and reverse the navigation/policy changes, but is unnecessary while all internal links resolve.

## Validation results

- **Structure/link validator — passed before self-archive:** `python3 /tmp/validate_repx_ticket_structure.py` found 22 unique indexed ticket IDs, 8 current records including 0026, 14 archived records, no root ticket files, no reuse of reserved IDs 0010–0013, correct status/directory placement, and valid file/heading targets across all 35 repository Markdown files.
- **Final structure/link validator — passed after self-archive:** the same command found 22 unique indexed ticket IDs, 7 current records, 15 archived records, correct index paths/statuses, and valid file/heading targets across all 35 repository Markdown files.
- **Formatting — passed:** `./node_modules/.bin/prettier --check tickets/TEMPLATE.md tickets/current/README.md tickets/current/frontend/README.md tickets/current/backend/README.md tickets/current/blockchain/README.md tickets/archive/README.md tickets/current/backend/0026-ticket-directory-structure.md` passed after formatting the template. Existing compact tables in policy/navigation files were inspected without introducing table-only churn.
- **Final archived-ticket formatting — passed:** reran the formatting check with `tickets/archive/0026-ticket-directory-structure.md` after the move; all selected files passed.
- **Manual tree/status inspection — passed:** `find tickets -maxdepth 4 -type f -print | sort` showed the requested directories, root index/template, category guidance, and expected records. An `rg` heading/status inspection confirmed every primary ticket heading and status matched its lifecycle placement.
- **Runtime checks — not applicable:** only Markdown records and documentation links were moved or edited. The move script was restricted to `*.md`, and all explicit patches targeted Markdown files. No application test, lint, typecheck, build, database, wallet, or program check was run because runtime inputs and behavior did not change.
- **Repository status limitation:** the enclosing Git worktree currently reports the project files as untracked, so `git status` cannot provide a meaningful before/after file diff for this project. The mutation commands and reviewed tree confirm that this task touched documentation only.

The structure/link validator was rerun after moving 0026 itself to the archive; the final result is recorded below.

## Risks, limitations, and follow-ups

External links to old repository ticket paths may require manual updates because repository file moves do not create redirects. Primary-area classification cannot express every cross-cutting concern; the ticket's related links and scope remain authoritative. No additional repository work is required.

## Completion and review references

- Completed: 2026-09-20 — ticket lifecycle/category structure, moves, navigation, policy, and link validation completed.
- Commit: Not created.
- Review: Self-reviewed against AC1–AC5; no independent review.
- Deployment: Not applicable.
