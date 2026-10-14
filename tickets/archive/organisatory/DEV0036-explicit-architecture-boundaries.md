# Ticket DEV0036: Explicit architecture boundaries

- Status: Completed
- Created: 2026-09-20
- Last updated: 2026-10-14
- Milestone: Cross-cutting application foundation
- Coordination: None — independent development ticket
- Related records: preserves completed [DEV0030 — Frontend screen module boundaries](../frontend/DEV0030-frontend-screen-module-boundaries.md)

> Documentary pruning — 2026-10-14, [DEV0225](DEV0225-remove-blockchain-historical-evidence.md): superseded feature evidence and deleted-reference details were removed at the user’s request. Retained text records the independent outcome at its original date. Code/data fragments are historical excerpts, not complete current contracts; aggregate test totals remain totals of the original runs, not new retained-only validation. Original completion dates remain unchanged. Earlier revisions remain in Git history.

## Objective and context

Preserve DEV0030's completed frontend structure as the delivered baseline.

The current coordination record correctly chooses a modular monolith, but it describes frontend, backend, database and blockchain as if they were equivalent directory layers. Some boundaries intentionally cross those labels, while the combined server/database row assigns one structural deliverable to both DEV0015 and DEV0025.

## Scope and non-goals

- Retained scope: distinguish browser, shared pure domain, Next.js server and PostgreSQL authority/import boundaries; clarify separate ownership for database foundation and server adapters; retain completed frontend module boundaries and validate documentation links/membership.
- Non-goals: runtime implementation, placeholder modules, dependencies, product-policy changes or deployment.

## Expected behavior and edge cases

Every direct structural deliverable has exactly one owner. Tickets may start together or validate shared integration points without jointly owning the same files.

## Assumptions, decisions, and dependencies

DEV0030 is Completed and archived. Its `src/app`, `src/features`, and `src/components` ownership is the current baseline and will not be reopened by this refinement. DEV0031 remains the next frontend structural slice.

DEV0015 owns concrete database artifacts and database-access modules. DEV0025 owns server boundary enforcement and dependency rules around real modules; it does not duplicate DEV0015's implementation evidence.

## Implementation plan

1. Add this ticket and index entry before changing planning records.
2.
3. Update the delivery sequence and record DEV0030 as completed baseline rather than future work.
4.
5. Validate reciprocal coordination membership, record links, internal consistency and formatting; document results and archive this ticket.

## Acceptance criteria

- [x] AC2: Every target path has a clear responsibility, allowed dependency direction and prohibited authority/import boundary.

- [x] AC5: Record/link and coordination-membership validation and Markdown formatting pass; no runtime, package, product or deployment file changes.

## Validation plan

Compare the refined COR map against the current source tree and completed DEV0030 evidence. Review each direct draft ticket for ownership contradictions. Run the repository work-record/link validator, search current planning documents for obsolete combined ownership or instructions to implement DEV0030, and run Prettier on changed Markdown. Application tests do not apply.

## Implementation record

Not applicable to the retained excerpt — superseded detail in this section was pruned under DEV0225.

### Identifier correction

The ticket index initially advertised DEV0035 as available, but repository history and the archived [DEV0035 work-record baseline](DEV0035-track-project-work-records.md) showed that commit `6198ddf` already uses it. This refinement therefore uses DEV0036, and the index now identifies DEV0037 as the next available development ID. No existing identifier or commit was rewritten.

- Preserved completed DEV0030 as the current `src/app`/`src/features`/`src/components` baseline. The remaining `src/lib` split stays exclusively in DEV0031; no completed move or evidence was reopened.
- Clarified that `src/app` is a Next.js framework boundary: pages normally compose frontend modules, while Route Handlers are thin backend adapters. Server Components may call explicit query services but never repositories or database drivers directly.

### Single-owner work map

- DEV0015 now solely owns `supabase` artifacts and concrete `src/server/db` configuration, mappings and repositories.
- DEV0025 now solely owns server-only/import enforcement, dependency-direction checks and thin-adapter rules applied to DEV0015's real modules. The tickets may start together without duplicating files or evidence.
- Updated all four draft tickets before their implementation begins, preserving their status and product scope.

Only planning and work-record Markdown changed. No application source, dependency, environment variable, migration, database, wallet, program, product behavior, test or deployment changed.

## Validation results

Searches found no obsolete instruction to implement DEV0030 or jointly assign DEV0015's database files to DEV0025; the only remaining “joint ownership” phrase explicitly prohibits it.

- **Record/link validator before self-archive — passed:** validation found 32 unique records—31 DEV and one COR—with 11 current and 21 archived records. Record type/path/status/index checks, retired IDs, reciprocal COR membership and local links passed across 51 Markdown files.
- **Formatting and whitespace — passed:** Prettier formatted the changed Markdown and `git diff --check` reported no whitespace errors.
- **Final self-archive validation — passed:** after archiving this ticket and updating its index and links, validation found 32 unique records—31 DEV and one COR—with 10 current and 22 archived records; all record and local-link checks passed across 51 Markdown files.
- **Application checks — not run:** the refinement changes planning documents only. DEV0030's recorded application evidence remains valid; new lint, typecheck, build, unit or browser runs would not provide evidence for AC1–AC5.

## Risks, limitations, and follow-ups

Excessive physical separation would add indirection and empty scaffolding. This refinement documents enforceable dependency and authority boundaries while retaining the modular monolith and creating paths only with real implementation.

## Completion and review references

- Completed: 2026-09-20 — original completion date; superseded details pruned under DEV0225.

- Commit: This commit — `[DEV0036] Clarify architecture boundaries`.
- Review: Self-reviewed against AC1–AC5; no independent review or pull request.
- Deployment or release: Not applicable — documentation-only architecture refinement.
