# Ticket DEV0032: Flat coordination record workflow

- Status: Completed
- Created: 2026-09-20
- Last updated: 2026-10-14
- Milestone: Repository workflow
- Coordination: None — independent development ticket
- Related records: updates the workflow established by [DEV0001 — Ticket workflow](DEV0001-ticket-workflow-and-agent-instructions.md) and [DEV0002 — Commit subjects](DEV0002-ticket-number-in-commit-subjects.md)

Identifier migration note, 2026-09-20: [DEV0033](DEV0033-prefixed-work-record-identifiers.md) later added DEV/COR prefixes. The body below retains the then-current bare IDs and filenames where they are implementation history; live links and this record's heading/path use the new identifiers.

> Documentary pruning — 2026-10-14, [DEV0225](DEV0225-remove-blockchain-historical-evidence.md): superseded feature evidence and deleted-reference details were removed at the user’s request. Retained text records the independent outcome at its original date. Code/data fragments are historical excerpts, not complete current contracts; aggregate test totals remain totals of the original runs, not new retained-only validation. Original completion dates remain unchanged. Earlier revisions remain in Git history.

## Objective and context

Distinguish non-implementation planning records from development tickets so ownership and commit references remain unambiguous. Replace deep parent/child ticket hierarchies with one optional coordination layer whose direct development tickets remain peers.

Coordination 0028 exposed the ambiguity: it coordinates several implementations but does not itself own runtime development, while its number could still be mistaken for the correct commit reference. The contributor rules previously required parent/child mappings but did not assign a different name or commit behavior to non-development parents.

## Scope and non-goals

- In scope: define development tickets versus coordination records in `AGENTS.md`; require commits to reference only development tickets; set a default maximum of one coordination-to-development level; add a coordination template; clarify the development-ticket template and ticket guide; rename 0028 as a coordination record; update live links and relationship wording.
- Out of scope: changing product requirements, source code, ticket numeric IDs, lifecycle statuses, repository category folders, historical implementation evidence, or creating the still-future Anchor development ticket.

## Expected behavior and edge cases

An implementable task uses `# Ticket NNNN`, owns code/configuration/documentation changes and supplies the ID used by commits. A non-implementation umbrella uses `# Coordination NNNN`, groups direct development tickets, and never authorizes implementation or appears in a commit subject.

Development tickets linked by one coordination record are peers. They may express dependencies and follow-ups, but they should not become parents of further implementation tickets. If a development ticket proves too broad, create peer tickets under the same coordination record and update the flat work map before implementation. A deeper hierarchy requires an exceptional, recorded reason.

Coordination records may be updated in a development ticket's commit, but a standalone coordination/policy change needs its own development ticket. Existing numeric IDs remain globally unique across both record types. Current and archived lifecycle rules still apply.

## Assumptions, decisions, and dependencies

Keep both record types in the existing ticket directories and index so no new folder hierarchy is introduced. Use a `-coordination.md` filename suffix and `# Coordination NNNN` heading for clarity. Keep `TEMPLATE.md` as the development-ticket template and add `COORDINATION_TEMPLATE.md` for non-implementation planning.

This ticket is the development owner for the policy and documentation changes. If the work is committed, the subject uses `[0032]`; it does not use coordination number 0028.

## Implementation plan

1. Update `AGENTS.md` with record definitions, flat hierarchy rules, lifecycle ownership and development-ticket-only commit subjects.
2. Clarify `TEMPLATE.md`, add `COORDINATION_TEMPLATE.md`, and update the ticket guide/index terminology.
3. Rename 0028's file/heading/metadata as a coordination record and replace child-ticket language with direct development-ticket language.
4. Update 0030/0031 and every live repository link to the renamed coordination record without rewriting unrelated historical evidence.
5. Validate unique IDs, record headings/types, current/archive placement, index coverage, local links/anchors and formatting. Record exact results and archive this ticket when complete.

## Acceptance criteria

- [x] AC1: Contributor policy and templates clearly distinguish development tickets from coordination records, including naming, ownership, evidence and lifecycle expectations.
- [x] AC2: Commit subjects reference only development ticket IDs; coordination IDs are excluded even when their records are updated in the same commit.
- [x] AC3: The default work hierarchy has at most one coordination-to-development level; development tickets split into peers rather than children of children, with exceptions requiring a recorded reason.
- [x] AC4: Record 0028 is visibly named and indexed as coordination, 0030/0031 are direct peer development tickets, and all affected repository links resolve.
- [x] AC5: Formatting and record/link validation pass; no product or runtime file changes occur.

## Validation plan

Extend the existing repository Markdown validator to accept and distinguish `Ticket` and `Coordination` headings while preserving one numeric namespace, lifecycle placement and index coverage. Run it across all Markdown files. Run Prettier on changed workflow/record documents, search for stale 0028 paths and deep child-language in current records, and manually compare commit and lifecycle rules for contradictions. Application tests do not apply because no runtime files change.

## Implementation record

Not applicable to the retained excerpt — superseded detail in this section was pruned under DEV0225.

### Changes and rationale

- [AGENTS.md](../../../AGENTS.md) now defines two record types. Development tickets use `# Ticket NNNN`, own concrete implementation/evidence and provide commit IDs. Coordination records use `# Coordination NNNN`, own only work maps, sequence and integration evidence, never authorize implementation and never appear in commit subjects.
- The hierarchy defaults to one optional coordination-to-development level. Development tickets are peers; broad work splits into more peers under the same coordination record. Dependencies and follow-ups remain ordinary links rather than a deeper hierarchy. An exception requires a concrete reason recorded before implementation.
- [The development-ticket template](../../TEMPLATE.md) now states its commit-bearing purpose and flat-split rule. The new [coordination template](../../COORDINATION_TEMPLATE.md) provides a direct-development-work map, separate other relationships, delivery/completion conditions and progress/integration evidence without an implementation record.
- The [work-record guide](../../README.md), current/archive guides and category guides now describe both record types. The development and coordination records stay in the existing lifecycle/category directories and share one stable numeric namespace, avoiding another folder level.
- `tickets/current/organisatory/0028-project-structure-organisation.md` became `tickets/current/organisatory/0028-project-structure-coordination.md`, headed `Coordination 0028` and indexed as coordination. Its direct work map treats 0015/0025, 0027, 0030 and 0031 as peer development tickets; downstream tickets and the missing Anchor ticket remain visibly separate.
- [Tickets DEV0030](../frontend/DEV0030-frontend-screen-module-boundaries.md) and [DEV0031](../frontend/DEV0031-preview-data-and-domain-boundaries.md) now link to Coordination 0028 as direct peer development tickets. The [repository README](../../../README.md), [MVP specification](../../../docs/mvp-spec.md) and affected historical 0029 links use the renamed path and record type.

### Decisions and compatibility

Numeric IDs, lifecycle statuses, category directories and ticket areas remain unchanged. Existing development-ticket headings and filenames remain compatible; only coordination records use the new heading and filename suffix. Historical records retain their original parent/child wording and exact command evidence except for live links required by the 0028 rename.

The commit contract changed prospectively: a subject contains only the development-ticket IDs implemented by that commit. Updating a coordination record does not add its ID; a standalone coordination/policy edit first receives a development ticket such as this one. No Git commit or hook was created.

No source, package, environment, database, wallet, program, product behavior or deployment contract changed. There is no runtime migration or rollback. Reverting the documentation would restore the earlier ambiguous naming but would not alter application behavior.

## Validation results

- **Record/link validator — passed before self-archive:** the updated validator accepted `Ticket` and `Coordination` headings, enforced the coordination filename suffix, required both templates, found 28 unique indexed records with correct status/category paths, and resolved local links/anchors across 47 Markdown files.
- **Formatting — passed:** Prettier accepted all changed workflow, guide, template, README, specification and record files.
- **Naming/link search — passed:** the old 0028 path remains only inside 0029's historical literal formatting command; there is no stale live Markdown link. The new file exists, the old file does not, the heading is `Coordination 0028`, and the index labels it as coordination.
- **Flat relationship review — passed:** current records contain no active development-ticket-as-parent relationship. The only parent/child terms in current work are in this ticket's explanation of the superseded model and the rule against deeper trees. Tickets 0030/0031 are labelled peer development tickets.
- **Commit-rule review — passed:** `AGENTS.md` requires development-ticket IDs, explicitly prohibits coordination IDs, and excludes linked dependencies/downstream records from subjects. The development and coordination templates agree.
- **Application checks — not run:** documentation/workflow files and paths changed; application source, tests, packages and runtime configuration did not. Lint, typecheck, build and browser tests cannot add relevant evidence for AC1–AC5.
- **Final self-archive validation — passed:** after moving this record to `tickets/archive/organisatory/` and updating the index/links, the validator found 28 unique records, 11 current and 17 archived, with all local links/anchors valid across 47 Markdown files. The complete changed-document Prettier check passed.

## Risks, limitations, and follow-ups

Archived records retain historical parent/child wording where it describes the policy at that time. Dependencies between peer development tickets remain valid and are not a hierarchy. The workflow relies on contributor review rather than a Git hook; future automation may check commit subjects if the repository later adopts hooks or CI.

## Completion and review references

- Completed: 2026-09-20 — development/coordination naming, flat work mapping and development-ticket-only commit references are documented and applied to Coordination 0028.
- Commit: Not created.
- Review: Self-reviewed against AC1–AC5; no independent review or pull request.
- Deployment or release: Not applicable — documentation workflow only.
