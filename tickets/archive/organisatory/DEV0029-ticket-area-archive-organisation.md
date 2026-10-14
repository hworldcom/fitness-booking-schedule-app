# Ticket DEV0029: Organise current and archived tickets by area

- Status: Completed
- Created: 2026-09-20
- Last updated: 2026-09-20
- Milestone: Repository workflow
- Coordination: None — independent development ticket
- Related tickets: follows [DEV0026 — Ticket directory structure](DEV0026-ticket-directory-structure.md); creates the area for the record now named [Coordination COR0001 — Project structure](COR0001-project-structure.md); affects every archived ticket path

## Objective and context

Extend the ticket structure introduced by 0026 so current and archived work use the same four primary areas: `frontend`, `backend`, `blockchain`, and `organisatory`. Add the missing project-structure organisation ticket under the new current area, classify completed records by their primary ownership, and preserve the root index as the authoritative map.

## Scope and non-goals

- In scope: add `tickets/current/organisatory`; add frontend/backend/blockchain/organisatory subdirectories under `tickets/archive`; classify and move all completed records; update contributor policy, template, directory guides, root index, README, specification, archived documents and all ticket links; validate IDs, statuses, areas and Markdown targets; complete and archive this ticket under `archive/organisatory`.
- Out of scope: changing product or application behavior, changing unrelated ticket statuses/content, renumbering IDs, implementing ticket 0028, creating additional ticket areas, or splitting cross-cutting records into duplicates.

## Expected behavior and edge cases

Open tickets live at `tickets/current/<area>/NNNN-slug.md`; Completed and Cancelled records live at `tickets/archive/<area>/NNNN-slug.md`. Both lifecycle trees contain the same four area directories and README guidance. The root `tickets/README.md` lists actual paths and status. IDs remain unique across every category and reserved IDs remain unused.

Classify each ticket by its primary implementation or decision ownership. Cross-cutting tickets use `organisatory` when their main result is contributor workflow, repository/document structure, or consolidation rather than an application layer. Historical content remains intact apart from path/navigation corrections and explicit move notes where needed. A completed ticket's category can differ from one affected runtime area when its delivered work was primarily planning/organisation.

## Assumptions, decisions, and dependencies

Use this archive map:

- `frontend`: 0008, 0019, 0020, 0021.
- `backend`: 0014, 0022.
- `blockchain`: 0006, 0007.
- `organisatory`: 0001–0005, 0009, 0026, and 0029 after completion.

Ticket 0004 belongs to `organisatory` because it records product-scope consolidation and removes a badge requirement without implementing a program. Ticket 0019 belongs to `frontend` because its delivered review centers on public route/discovery behavior. Ticket 0022 belongs to `backend` because its durable output is the social data/delivery contract consumed by backend tickets. These classifications do not change their milestone, status, or historical evidence.

## Implementation plan

1. Create the four archive area directories and their README guidance; add the current organisatory guide.
2. Move every archived ticket according to the recorded map, preserving filenames and IDs.
3. Update `AGENTS.md`, the root ticket template/index, current/archive guides, repository README, specification, archived documents, current tickets and cross-ticket links for the new paths.
4. Update the ticket validator for four current/archive areas; verify unique IDs, status/lifecycle placement, category paths, index coverage, reserved IDs and all local Markdown files/anchors.
5. Record the exact result and formatting checks, mark this ticket Completed, move it to `archive/organisatory`, and rerun validation.

## Acceptance criteria

- [x] AC1: Current and archive each contain `frontend`, `backend`, `blockchain`, and `organisatory` directories with concise ownership guidance; root index/template remain stable.
- [x] AC2: Every ticket appears exactly once at its indexed path; open statuses are current, Completed/Cancelled statuses are archived, and IDs/statuses/content remain intact.
- [x] AC3: Contributor policy and template define the same four areas and archive-to-matching-area lifecycle rule, including cross-cutting classification and link updates.
- [x] AC4: Every repository-local Markdown file and heading link resolves after the moves, including historical tickets, the specification, README and current dependencies.
- [x] AC5: Only Markdown organisation/navigation changes occur; application source, dependencies, runtime configuration and product behavior remain unchanged.

## Validation plan

Use the repository ticket/Markdown validator updated for four areas to check headings, IDs, statuses, directory placement, index paths/statuses, reserved IDs, files and anchors. Run Prettier on new guidance and this ticket, inspect the final tree/status map, and search for stale flat archive paths. Application tests are not applicable because runtime inputs do not change; confirm every mutation is limited to Markdown files.

## Implementation record

Completed the four-area lifecycle structure and created the missing project-structure coordination record.

### Changes and rationale

- Added `tickets/current/organisatory/` and the record now named [Coordination COR0001 — Project structure](COR0001-project-structure.md). Ticket 0028 originally recorded the target modular-monolith layout, incremental migration rule, dependency direction, child-ticket requirement and validation expectations without creating empty application directories; ticket 0032 later renamed its record type without changing this historical delivery.
- Added frontend/backend/blockchain/organisatory subdirectories and guidance under `tickets/archive/`.
- Moved archived tickets without renumbering: frontend 0008/0019/0020/0021; backend 0014/0022; blockchain 0006/0007; organisatory 0001–0005/0009/0026. This ticket moves to archive/organisatory after its record is complete.
- Updated every affected repository-local Markdown target after the moves, including current/archived ticket dependencies, historical records, README, the MVP specification and the root ticket index.
- Updated `AGENTS.md` and the template so four areas apply to new current work and Completed/Cancelled records move to the matching archive area. Cross-cutting work has one primary category and links dependencies instead of being copied.
- Added an explicit dated note to 0026 explaining that 0029 supersedes its earlier flat-archive decision while preserving 0026's historical evidence.
- Added an Area column to archived index rows and extended the validator to compare the indexed area with the physical directory.

### Decisions and deviations

The recorded classification map was applied without deviation. Product-scope/contributor-document consolidation lives in `organisatory`; user-facing route/discovery results live in `frontend`; database/data-delivery planning lives in `backend`; wallet/token choices live in `blockchain`. The spelling `organisatory` follows the user's requested directory name and is used consistently in policy, navigation and paths.

### Contracts, configuration, and operations

Repository-local ticket paths and contributor workflow are the only changed contracts. Open records use `tickets/current/<area>/`; closed records use the matching `tickets/archive/<area>/`. External bookmarks to older flat paths may need manual correction because filesystem moves do not create redirects. No application source, dependency, environment variable, runtime configuration, database/schema, wallet/program behavior, product requirement, deployment or migration changed. Every explicit mutation in this task targets Markdown files.

## Validation results

- **Pre-archive structure/link validation — passed:** `python3 /tmp/validate_repx_ticket_structure.py` found 25 unique indexed tickets, 10 current records including 0029, 15 archived records, correct lifecycle/category/index-area placement, no root/flat lifecycle tickets, reserved IDs 0010–0013 unused, and valid file/heading targets across all 43 repository Markdown files.
- **Final structure/link validation — passed:** after archiving 0029, the same validator found 25 unique indexed tickets, 9 current records, 16 archived records, correct lifecycle/category/index-area placement, and valid file/heading targets across all 43 repository Markdown files.
- **Formatting — passed:** `./node_modules/.bin/prettier --check tickets/current/organisatory/0028-project-structure-organisation.md tickets/current/organisatory/0029-ticket-area-archive-organisation.md tickets/current/organisatory/README.md tickets/archive/README.md tickets/archive/frontend/README.md tickets/archive/backend/README.md tickets/archive/blockchain/README.md tickets/archive/organisatory/README.md tickets/TEMPLATE.md` passed.
- **Final archived-ticket formatting — passed:** reran the formatting check with `tickets/archive/organisatory/0029-ticket-area-archive-organisation.md` after the move; all selected files passed.
- **Tree/status review — passed:** `find tickets -maxdepth 4 -type f -print | sort` and an `rg` ticket-heading/status review showed every existing record under one lifecycle/area path with the expected status. The stale-flat-path search found no live Markdown link to an old flat ticket path; the remaining literal path in 0026 is historical command evidence and is explicitly superseded by its dated note.
- **Runtime checks — not applicable:** no application file or runtime input changed, so tests, lint, typecheck, build, database, wallet and program checks were not run.
- **Repository status limitation:** the enclosing Git worktree reports this project as untracked, so `git status` cannot provide a meaningful task diff. The move script was restricted to ticket Markdown files, and all patches in this task targeted Markdown documentation.

The validator was rerun after moving 0029 to `archive/organisatory`; the final result is recorded below.

## Risks, limitations, and follow-ups

External bookmarks to earlier flat archive paths cannot be redirected by the filesystem. Category assignment expresses primary ownership and cannot encode every cross-cutting concern; ticket scope and related links remain authoritative. No additional migration work remains.

## Completion and review references

- Completed: 2026-09-20 — current/archive area taxonomy, project-structure ticket, moves, policy, navigation and link validation completed.
- Commit: Not created.
- Review: Self-reviewed against AC1–AC5; no independent review.
- Deployment: Not applicable.
