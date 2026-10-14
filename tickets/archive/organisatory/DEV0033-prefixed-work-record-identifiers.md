# Ticket DEV0033: Prefixed work-record identifiers

- Status: Completed
- Created: 2026-09-20
- Last updated: 2026-10-14
- Milestone: Repository workflow
- Coordination: None — independent development ticket
- Related records: follows [DEV0032 — Flat coordination record workflow](DEV0032-flat-coordination-record-workflow.md)

> Documentary pruning — 2026-10-14, [DEV0225](DEV0225-remove-blockchain-historical-evidence.md): superseded feature evidence and deleted-reference details were removed at the user’s request. Retained text records the independent outcome at its original date. Code/data fragments are historical excerpts, not complete current contracts; aggregate test totals remain totals of the original runs, not new retained-only validation. Original completion dates remain unchanged. Earlier revisions remain in Git history.

## Objective and context

Give development tickets and coordination records visibly different identifiers rather than relying only on headings and filename suffixes. Use `DEVNNNN` for development and `CORNNNN` for coordination so ownership and valid commit references are recognizable wherever an ID appears.

The flat workflow in ticket DEV0032 distinguishes record types, but both still use a bare four-digit namespace. The user selected explicit `DEV` and `COR` prefixes and separate sequences.

## Scope and non-goals

- Out of scope: changing ticket content unrelated to identifiers, changing lifecycle status or category ownership, creating another folder layer, changing product/runtime behavior, rewriting exact historical command/commit evidence, or creating additional coordination records.

## Expected behavior and edge cases

Development records use `# Ticket DEVNNNN: Title` and `DEVNNNN-slug.md`. Their commits use `[DEVNNNN]`. Coordination records use `# Coordination CORNNNN: Title` and `CORNNNN-slug.md`; their IDs never appear in commit subjects.

The DEV and COR sequences are independent. Existing development records preserve their legacy numeric portions to keep migration traceable: ticket 0015 becomes DEV0015, for example. Legacy bare numeric references inside preserved historical prose or literal past commands may remain when rewriting them would falsify evidence; all current policy, navigation, filenames and live links use prefixed IDs.

## Assumptions, decisions, and dependencies

Reserve DEV0010–DEV0013 because their prior numeric records were consolidated into DEV0008. DEV0033 owns this migration and becomes the next development record. The next new development record is DEV0034; the next coordination record is COR0002.

No Git commit exists for this migration.

## Implementation plan

1. Add this development ticket and index entry under the pre-migration convention before renaming any existing record.
2.
3. Update `AGENTS.md`, both templates, work-record guides, README/specification navigation, current ticket relationships and commit examples for the prefixed namespaces.
4. Preserve exact historical command/commit evidence while documenting the legacy-to-prefixed mapping and searching for stale live paths or ambiguous current identifiers.
5. Extend validation for DEV/COR headings, filenames, namespace uniqueness, lifecycle/category placement and index coverage; format changed documents, complete this ticket and archive it under its DEV ID.

## Acceptance criteria

- [x] AC2: Contributor policy/templates define independent DEV/COR namespaces, allocation, filenames and flat relationships; commits accept only `[DEVNNNN]` IDs.
- [x] AC3: Current documentation and record relationships use prefixed IDs, every live local link resolves, and legacy unprefixed text remains only where preserving historical evidence is intentional.
- [x] AC4: The validator detects type/filename/index/namespace mismatches and passes after final self-archive; formatting passes for changed documents.
- [x] AC5: No application source, runtime configuration, package, product behavior or deployment changes.

## Validation plan

Use a deterministic migration map and verify every source file has exactly one resulting path. Extend the repository validator to enumerate `DEV[0-9]{4}` and `COR[0-9]{4}` records, enforce heading/filename type, namespace uniqueness, lifecycle status/category, index path/status/type and local Markdown links. Search current policy/navigation/current records for old filenames, unprefixed ticket-link labels, old commit examples and obsolete coordination suffix rules. Run Prettier on changed Markdown. Application tests do not apply.

## Implementation record

Not applicable to the retained excerpt — superseded detail in this section was pruned under DEV0225.

### Identifier and file migration

- Created this development ticket and indexed it before changing the repository convention, so the migration itself has a reviewable owner.
- Renamed 28 development-record files and headings from their legacy four-digit form to `DEVNNNN`, retaining each numeric portion. For example, legacy ticket 0015 is now `DEV0015`.
- Updated the [work-record index](../../README.md), current project documentation and record relationships to use the prefixed labels and paths. Repaired links into renamed archived records as well as links among current records.
- Preserved `DEV0010`–`DEV0013` as unavailable because those former records were consolidated into `DEV0008`. The next available identifiers are `DEV0034` and `COR0002`.

### Workflow contract

- [AGENTS.md](../../../AGENTS.md) now defines `# Ticket DEVNNNN` / `DEVNNNN-short-title.md` for implementation and `# Coordination CORNNNN` / `CORNNNN-short-title.md` for non-implementation coordination. It states that the namespaces are independent and that allocation checks current and archived records within the relevant prefix.
- The [development template](../../TEMPLATE.md), [coordination template](../../COORDINATION_TEMPLATE.md), root work-record guide, lifecycle guides and area guides use the same naming contract.
- Commit subjects now require `[DEVNNNN]`; a COR identifier is never a commit reference. The example for this migration is `[DEV0033] Prefix work-record identifiers`.

### History, compatibility and scope

Archived prose and literal historical commands retain bare identifiers where changing them would falsely imply that the prefixed convention existed at the time. A dated note in [DEV0032](DEV0032-flat-coordination-record-workflow.md) explains that distinction. Current policy, filenames, index entries and live link labels all use prefixed identifiers.

The migration changes only repository documentation and work-record paths. No source file, dependency, runtime configuration, environment variable, database, wallet, smart contract, product behavior or deployment changed. There is no runtime migration or rollback; reverting would restore the previous ambiguous record naming.

## Validation results

- **Migration completeness — passed:** the deterministic migration renamed 28 development records and one coordination record and updated 48 Markdown files. Every source record produced exactly one prefixed destination.
- **Record/link validator before self-archive — passed:** the updated validator found 29 unique records: 28 DEV and one COR, with 12 current and 17 archived. It verified heading/filename identity and type, independent namespace uniqueness, status/category placement, index coverage, reserved DEV IDs, both templates and all local links/anchors across 48 Markdown files.
- **Current-document search — passed:** active policy, navigation and current records contain no stale unprefixed record paths or headings. Bare legacy examples remain only in this migration record where they document the mapping. No current commit example contains a COR identifier.
- **Formatting — passed:** Prettier formatted all repository Markdown and the final check accepted every file.
- **Final self-archive validation — passed:** after archiving this completed record and updating its links/index entry, the validator found 29 unique records: 28 DEV and one COR, with 11 current and 18 archived; all local links and anchors remained valid across 48 Markdown files.
- **Application checks — not run:** this is a documentation/workflow migration. No application, package, test, runtime or deployment file changed, so lint, typecheck, build and browser tests do not provide evidence for AC1–AC5.

## Risks, limitations, and follow-ups

Renaming archived files produces a large documentation-only path change. Do not rewrite past commands or claimed commit subjects as though the new convention existed earlier.

## Completion and review references

- Completed: 2026-09-20 — original completion date; superseded details pruned under DEV0225.

- Commit: Not created.
- Review: Self-reviewed against AC1–AC5; no independent review or pull request.
- Deployment or release: Not applicable — documentation workflow only.
