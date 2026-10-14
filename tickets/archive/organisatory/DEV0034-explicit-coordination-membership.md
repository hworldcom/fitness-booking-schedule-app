# Ticket DEV0034: Explicit coordination membership

- Status: Completed
- Created: 2026-09-20
- Last updated: 2026-09-20
- Milestone: Repository workflow
- Coordination: None — independent development ticket
- Related records: extends [DEV0032 — Flat coordination record workflow](DEV0032-flat-coordination-record-workflow.md) and [DEV0033 — Prefixed work-record identifiers](DEV0033-prefixed-work-record-identifiers.md); updates membership in [COR0001 — Project structure](COR0001-project-structure.md)

## Objective and context

Make a development ticket's direct coordination ownership explicit at the beginning of the record. Define a safe conversion when pre-implementation review shows that one proposed DEV ticket is actually a coordination umbrella for multiple implementation tickets.

The current workflow distinguishes DEV and COR records and keeps their relationship flat, but individual DEV metadata does not state whether the ticket belongs directly to a COR. The split rule also says to create peer development tickets without defining what happens to the original DEV record.

## Scope and non-goals

- In scope: add a required `Coordination` metadata field to the development-ticket contract and every DEV record; identify the five current direct members of COR0001; mark all other DEV records as independent; define pre-implementation DEV-to-COR conversion, identifier retirement, child-ticket replacement and commit behavior; align AGENTS.md, templates, guides and validation.
- Out of scope: changing runtime or product behavior, creating a second coordination record, changing COR0001's direct work, introducing deeper ticket hierarchies, retroactively changing historical commits, or converting a DEV record that already owns implementation evidence.

## Expected behavior and edge cases

Every DEV record states either one linked direct coordination owner or `None — independent development ticket` in its opening metadata. A DEV ticket can belong directly to at most one COR; dependencies, downstream consumers and historical relationships remain under `Related records` and do not imply membership.

If review before implementation divides one DEV proposal into multiple implementation tickets, convert the original planning record into a new COR record using the next available COR identifier. Retire its old DEV identifier, create fresh peer DEV tickets, and link each new ticket back through its `Coordination` field. If implementation or commit history already exists, preserve the original DEV for the concrete scope/evidence it owns and create a separate COR rather than rewriting implementation history.

## Assumptions, decisions, and dependencies

The current direct members of COR0001 are DEV0015, DEV0025, DEV0027, DEV0030 and DEV0031, matching its `Direct development work` table. DEV0016–DEV0018 and DEV0023–DEV0024 are downstream consumers, so their explicit membership is `None`.

DEV and COR sequences remain independent. Conversion uses the next free COR ID instead of copying the DEV numeric portion; the former DEV ID stays retired and cannot be reused or referenced by a later commit.

## Implementation plan

1. Add this ticket and index entry before changing workflow policy.
2. Add the required coordination-membership rule and pre-implementation conversion procedure to AGENTS.md.
3. Update the development and coordination templates and work-record guide with the same field, membership limit and split behavior.
4. Add explicit coordination metadata to every current and archived DEV record, using COR0001 only for its five direct members.
5. Extend local record validation for required metadata, valid COR targets and reciprocal direct membership; format documents, record results and archive this ticket.

## Acceptance criteria

- [x] AC1: Every DEV record has a `Coordination` field in its opening metadata with exactly one linked COR or an explicit `None` value.
- [x] AC2: COR0001 and its five direct DEV records agree reciprocally; dependencies and downstream consumers are not represented as direct membership.
- [x] AC3: AGENTS.md clearly defines membership, the one-COR limit, DEV-to-COR conversion before implementation, retired DEV IDs and the history-preserving rule after implementation starts.
- [x] AC4: Templates and guides match AGENTS.md, all local links resolve, validation detects missing/invalid membership and formatting passes.
- [x] AC5: No application source, runtime configuration, package, product behavior, deployment or historical commit changes.

## Validation plan

Validate every DEV file for one opening `Coordination` field and ensure linked membership targets a current or archived COR record. Compare COR0001's direct-development table with reciprocal DEV fields. Run the complete record/link validator and Prettier across repository Markdown. Search active policy/templates for contradictory split, child or membership instructions. Application checks do not apply.

## Implementation record

### Coordination membership

- Added a required `Coordination` field directly after `Milestone` in all 29 development records. Five current structural tickets—DEV0015, DEV0025, DEV0027, DEV0030 and DEV0031—link to COR0001 because they appear in its direct-work map. The other 24 records explicitly state `None — independent development ticket`.
- Membership now means direct implementation ownership under one COR. Dependencies, downstream consumers, follow-ups and historical baselines remain in `Related records` and do not grant membership. A DEV can have at most one direct COR, and the COR's tracked-development metadata must name the same DEV.
- Added `Converted from` metadata to the coordination template and COR0001. COR0001 states that it was created as coordination rather than converted from a DEV.

### DEV-to-COR conversion

- [AGENTS.md](../../../AGENTS.md) now requires scope review before implementation. When one proposed DEV must split into several implementation records, its planning record is converted to the next available COR ID, its former DEV ID is added to the retired-ID register, and fresh peer DEV tickets link back through their `Coordination` fields.
- Conversion preserves the planning history while changing the heading, filename, index entry and record structure. The former DEV ID cannot be reused or used in a commit. The DEV numeric portion is not copied into the independent COR sequence.
- A DEV with implementation evidence or commit history is never converted. It keeps the concrete scope and evidence it owns; a separate COR is created for the peer tickets. This prevents an organisational review from rewriting implementation history.

### Templates, guides and compatibility

- Updated the [development-ticket template](../../TEMPLATE.md), [coordination template](../../COORDINATION_TEMPLATE.md), [work-record guide](../../README.md) and current-record guide to match the authoritative AGENTS.md rules.
- Added a structured retired-development-ID register to the work-record guide. DEV0010–DEV0013 remain retired because their records were consolidated into DEV0008; future conversions add rows there.
- The local structural validator now requires exactly one opening coordination field for every DEV, validates a linked COR target, requires `Converted from` on COR records, checks reciprocal tracked membership and rejects reuse of an ID in the retired table.

This change affects contributor documentation and work-record metadata only. It changes no source, dependency, runtime configuration, environment variable, product contract, database, wallet, smart contract, deployment or historical Git commit.

## Validation results

- **Metadata coverage — passed:** all 29 DEV files have exactly one opening `Coordination` field; five link to COR0001 and 24 explicitly identify themselves as independent.
- **Reciprocal membership — passed:** COR0001 tracks DEV0015, DEV0025, DEV0027, DEV0030 and DEV0031, and each of those records links back to COR0001. Its downstream DEV0016–DEV0018 and DEV0023–DEV0024 records remain independent.
- **Policy review — passed:** AGENTS.md, both templates and the work-record guides consistently define direct membership, the one-COR limit, pre-implementation conversion, fresh peer DEV tickets, retired identifiers and the history-preserving rule after implementation begins. The active policy contains no instruction to keep a split DEV as a parent ticket.
- **Record/link validator before self-archive — passed:** validation found 30 unique records—29 DEV and one COR—with 12 current and 18 archived records. It checked record type/path/status/index consistency, retired IDs, coordination metadata, reciprocal membership and local links across 49 Markdown files.
- **Formatting — passed:** Prettier accepted AGENTS.md and every Markdown file under `tickets/`.
- **Final self-archive validation — passed:** after archiving this record and updating the index/links, validation found 30 unique records—29 DEV and one COR—with 11 current and 19 archived records; every membership and local link remained valid across 49 Markdown files.
- **Application checks — not run:** application files and behavior did not change, so lint, typecheck, build and browser tests cannot add evidence for AC1–AC5.

## Risks, limitations, and follow-ups

Archived DEV records predate this field, so their `None` values describe coordination membership under the current record model rather than rewriting historical relationships. A future additional COR must keep its direct-work map reciprocal with member ticket metadata. The structural validator is a local review tool rather than a committed CI check, so AGENTS.md and the templates remain the durable enforcement source.

## Completion and review references

- Completed: 2026-09-20 — explicit coordination membership and safe DEV-to-COR conversion are documented and applied to every work record.
- Commit: Not created.
- Review: Self-reviewed against AC1–AC5; no independent review or pull request.
- Deployment or release: Not applicable — documentation workflow only.
