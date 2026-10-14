# Ticket DEV0036: Explicit architecture boundaries

- Status: Completed
- Created: 2026-09-20
- Last updated: 2026-09-20
- Milestone: Cross-cutting application foundation
- Coordination: None — independent development ticket
- Related records: refines [COR0001 — Project structure](COR0001-project-structure.md); preserves completed [DEV0030 — Frontend screen module boundaries](../frontend/DEV0030-frontend-screen-module-boundaries.md); aligns direct draft tickets [DEV0031](../frontend/DEV0031-preview-data-and-domain-boundaries.md), [DEV0015](../backend/DEV0015-supabase-database-foundation.md), [DEV0025](../backend/DEV0025-nextjs-backend-boundary.md), and [DEV0027](../blockchain/DEV0027-phantom-wallet-connection-foundation.md)

## Objective and context

Make COR0001's target architecture unambiguous by separating execution location, source ownership, data authority, dependency direction, and development-ticket ownership. Preserve DEV0030's completed frontend structure as the delivered baseline.

The current coordination record correctly chooses a modular monolith, but it describes frontend, backend, database and blockchain as if they were equivalent directory layers. Some boundaries intentionally cross those labels, while the combined server/database row assigns one structural deliverable to both DEV0015 and DEV0025.

## Scope and non-goals

- In scope: add current-state, runtime/authority, source ownership and allowed-import maps to COR0001; distinguish Next.js page and server adapters; separate browser, server and on-chain Solana responsibilities; assign each structural deliverable to one existing or explicitly missing DEV ticket; update sequencing and progress; align the affected draft tickets with the refined ownership.
- Out of scope: moving application files, changing DEV0030's delivered structure or evidence, creating empty directories, implementing DEV0031/DEV0015/DEV0025/DEV0027, creating the missing Solana tickets, introducing packages/workspaces/services, or changing product behavior.

## Expected behavior and edge cases

The target remains one Next.js/TypeScript package, Supabase PostgreSQL/Auth, and a separate Anchor/Rust program boundary. Folder placement does not imply runtime authority: database access code belongs to the backend while schema history belongs to `supabase`; browser Solana, server verification and the on-chain program use separate paths; `src/domain` is a shared pure dependency with no data authority.

Every direct structural deliverable has exactly one owner. Tickets may start together or validate shared integration points without jointly owning the same files. Required unticketed work is named explicitly and cannot begin under COR0001.

## Assumptions, decisions, and dependencies

DEV0030 is Completed and archived. Its `src/app`, `src/features`, and `src/components` ownership is the current baseline and will not be reopened by this refinement. DEV0031 remains the next frontend structural slice.

DEV0015 owns concrete database artifacts and database-access modules. DEV0025 owns server boundary enforcement and dependency rules around real modules; it does not duplicate DEV0015's implementation evidence. DEV0027 owns browser-safe wallet connection only. Server-side Solana verification and the Anchor/program client foundation still require separate tickets.

## Implementation plan

1. Add this ticket and index entry before changing planning records.
2. Rewrite COR0001's target explanation around execution, authority, source ownership and explicit dependency rules while preserving its current decisions.
3. Replace joint server/database ownership with distinct DEV0015 and DEV0025 deliverables and expose missing server-Solana and Anchor owners.
4. Update the delivery sequence and record DEV0030 as completed baseline rather than future work.
5. Align DEV0031, DEV0015, DEV0025 and DEV0027 where their draft scope or plans otherwise imply overlapping ownership.
6. Validate reciprocal coordination membership, record links, internal consistency and formatting; document results and archive this ticket.

## Acceptance criteria

- [x] AC1: COR0001 separately identifies browser, Next.js server, PostgreSQL and Solana execution/authority boundaries plus the shared pure domain boundary.
- [x] AC2: Every target path has a clear responsibility, allowed dependency direction and prohibited authority/import boundary.
- [x] AC3: DEV0030 is shown as completed baseline; DEV0015 and DEV0025 have distinct ownership; missing server-Solana and Anchor work is explicitly unticketed.
- [x] AC4: The four affected draft tickets agree with COR0001 and do not jointly claim the same implementation files or behavior.
- [x] AC5: Record/link and coordination-membership validation and Markdown formatting pass; no runtime, package, product or deployment file changes.

## Validation plan

Compare the refined COR map against the current source tree and completed DEV0030 evidence. Review each direct draft ticket for ownership contradictions. Run the repository work-record/link validator, search current planning documents for obsolete combined ownership or instructions to implement DEV0030, and run Prettier on changed Markdown. Application tests do not apply.

## Implementation record

### Identifier correction

The ticket index initially advertised DEV0035 as available, but repository history and the archived [DEV0035 work-record baseline](DEV0035-track-project-work-records.md) showed that commit `6198ddf` already uses it. This refinement therefore uses DEV0036, and the index now identifies DEV0037 as the next available development ID. No existing identifier or commit was rewritten.

### COR0001 architecture map

- Replaced the single directory-oriented target with separate delivered-state, runtime/authority, target-source and dependency/import maps. The record now distinguishes browser UI, shared pure domain code, Next.js server workflows, PostgreSQL authority, browser Solana adapters, trusted server Solana verification and on-chain program authority.
- Preserved completed DEV0030 as the current `src/app`/`src/features`/`src/components` baseline. The remaining `src/lib` split stays exclusively in DEV0031; no completed move or evidence was reopened.
- Clarified that `src/app` is a Next.js framework boundary: pages normally compose frontend modules, while Route Handlers are thin backend adapters. Server Components may call explicit query services but never repositories or database drivers directly.
- Defined distinct browser `src/solana/client`, runtime-neutral `src/solana/generated`, trusted `src/server/solana`, and on-chain `programs` responsibilities. Server-Solana verification and the Anchor/program-generated-client foundation remain explicitly unticketed and cannot begin under COR0001.

### Single-owner work map

- DEV0015 now solely owns `supabase` artifacts and concrete `src/server/db` configuration, mappings and repositories.
- DEV0025 now solely owns server-only/import enforcement, dependency-direction checks and thin-adapter rules applied to DEV0015's real modules. The tickets may start together without duplicating files or evidence.
- DEV0031 explicitly treats `src/domain` as shared authority-free code despite the ticket's frontend category. DEV0027 owns `src/solana/client` and wallet UI integration while excluding server verification, generated program bindings and Anchor programs.
- Updated all four draft tickets before their implementation begins, preserving their status and product scope.

Only planning and work-record Markdown changed. No application source, dependency, environment variable, migration, database, wallet, program, product behavior, test or deployment changed.

## Validation results

- **Current-tree comparison — passed:** compared COR0001 with the post-DEV0030 tree. `src/app`, `src/features`, `src/components` and mixed `src/lib` exist; `src/domain`, `src/server`, `src/solana`, `supabase` and `programs` do not. The delivered/pending table reports those states without creating empty paths.
- **Ownership review — passed:** COR0001 and DEV0031, DEV0015, DEV0025 and DEV0027 agree on their exact paths and limits. Searches found no obsolete instruction to implement DEV0030 or jointly assign DEV0015's database files to DEV0025; the only remaining “joint ownership” phrase explicitly prohibits it.
- **Record/link validator before self-archive — passed:** validation found 32 unique records—31 DEV and one COR—with 11 current and 21 archived records. Record type/path/status/index checks, retired IDs, reciprocal COR membership and local links passed across 51 Markdown files.
- **Formatting and whitespace — passed:** Prettier formatted the changed Markdown and `git diff --check` reported no whitespace errors.
- **Final self-archive validation — passed:** after archiving this ticket and updating its index and links, validation found 32 unique records—31 DEV and one COR—with 10 current and 22 archived records; all record and local-link checks passed across 51 Markdown files.
- **Application checks — not run:** the refinement changes planning documents only. DEV0030's recorded application evidence remains valid; new lint, typecheck, build, unit or browser runs would not provide evidence for AC1–AC5.

## Risks, limitations, and follow-ups

Excessive physical separation would add indirection and empty scaffolding. This refinement documents enforceable dependency and authority boundaries while retaining the modular monolith and creating paths only with real implementation. The missing server-Solana and Anchor/program-client tickets must be created before those paths; their exact modules and toolchain remain future decisions.

## Completion and review references

- Completed: 2026-09-20 — COR0001 and its four direct draft tickets now separate runtime, authority, imports and implementation ownership while preserving completed DEV0030.
- Commit: This commit — `[DEV0036] Clarify architecture boundaries`.
- Review: Self-reviewed against AC1–AC5; no independent review or pull request.
- Deployment or release: Not applicable — documentation-only architecture refinement.
