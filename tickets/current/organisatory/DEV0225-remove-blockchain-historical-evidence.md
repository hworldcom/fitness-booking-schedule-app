# Ticket DEV0225: Remove blockchain historical evidence

- Status: Draft
- Created: 2026-10-14
- Last updated: 2026-10-14
- Milestone: Scheduling documentation and historical-record pruning
- Coordination: None — independent development ticket
- Related records: backlog-maintenance dependency [DEV0224](../../archive/organisatory/DEV0224-refresh-scheduling-ticket-backlog.md); scheduling contract baseline [DEV0140](../../archive/organisatory/DEV0140-adopt-scheduling-only-contract.md); current relationship work [COR0020](COR0020-athlete-terminology-and-connections.md)

## Objective and context

Remove blockchain-related ticket files and historical documentary evidence from the scheduling repository's working tree. The user explicitly authorized removing archived blockchain evidence on 2026-10-14, then asked for a separate ticket for that work. This instruction overrides the normal archived-record preservation rule for the identified blockchain evidence; independent scheduling, email identity, media, hosted operations and contributor history still need an accurate review trail. Implement against the [current scheduling specification](../../../docs/mvp-spec.md#1-product-status-and-document-authority).

## Scope and non-goals

- In scope:
  - Inventory and remove dedicated blockchain/wallet/payment/group-funding ticket and coordination records, including Completed or Cancelled records.
  - Remove the three superseded documents in `docs/archive/2026-09-18/` and their obsolete navigation references.
  - Remove blockchain-specific narrative/evidence and links from mixed historical records while retaining their reusable scheduling, identity, database, frontend and contributor outcomes. Explain dated pruning where retained evidence changes; do not fabricate replacement implementation or validation.
  - Reconcile the ticket index, removed/retired/reserved ID registers, affected coordination ownership and every repository link to removed records.
  - Update current documentation that promises retained blockchain history or links to deleted documents. Keep the current product's explicit blockchain exclusion.
- Out of scope:
  - Runtime source, dependencies, environment values, SQL migration history, stored data or live services.
  - Rewriting Git history, deleting other branches/repositories, importing hackathon files or reusing their IDs.
  - Removing current athlete terminology/connections, booking requests, notes/plans, native iOS, account deletion, admin review or hosted scheduling work.

## Expected behavior and edge cases

- No dedicated blockchain ticket or archived blockchain product document remains in this checkout. A file's topic and owned outcome determine removal; an incidental word such as wallet in an exclusion does not justify deleting a reusable scheduling or account record.
- A mixed record retains only its relevant independent outcome, exact dated evidence and a dated explanation of documentary pruning. Blockchain proofs, screenshots/log links, contract narratives and obsolete future delivery are removed rather than merely marked inactive.
- Deleted record IDs remain permanently unavailable in a minimal register. The register records removal, not the deleted feature's implementation evidence.
- Retained DEV/COR membership must remain truthful. Removing a direct DEV requires reconciling its retained COR; an archived COR that primarily coordinates removed work can also be removed.
- No dangling Markdown destinations, current-work entries or navigation directories advertise deleted history. Empty archive directories may be removed after navigation is updated.
- Existing app/database behavior and prior unrelated edits remain intact. Ordinary Git history retains earlier revisions; this ticket removes working-tree evidence only.

## Assumptions, decisions, and dependencies

- DEV0224 first cancels/archives COR0001 and refreshes the active backlog. That separate maintenance ticket does not delete historical evidence.
- User authorization covers documentary deletion, including archived records. No additional approval gate is introduced by the ordinary archive-preservation policy.
- Initial inventory below identifies clear dedicated removals and mixed-record review targets. Before the first deletion, record the final exact path/ID manifest and reasons in this ticket; update scope first if the inventory exposes a material additional category.
- This is one documentary pruning task because deletion, reference repair and unavailable-ID preservation must be reviewed together. Runtime retirement or database retention would require independent tickets.

### Initial dedicated removal inventory

| Area                               | Records or documents to inventory for removal                                                                                                   |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Blockchain archive                 | Every DEV record under `tickets/archive/blockchain/`: DEV0027, DEV0097–DEV0099, DEV0121–DEV0122, DEV0127, DEV0130–DEV0132, DEV0134 and DEV0136. |
| Wallet/authentication archive      | DEV0038, DEV0039 and DEV0047 under `tickets/archive/backend/`.                                                                                  |
| Chain-backed booking/event archive | Backend DEV0105, DEV0106, DEV0120, DEV0125 and DEV0128.                                                                                         |
| Chain-product interface archive    | Frontend DEV0095, DEV0123, DEV0124 and DEV0129.                                                                                                 |
| Chain-product contract archive     | Organisatory DEV0094, DEV0103, DEV0117, DEV0126 and DEV0135.                                                                                    |
| Chain-oriented coordination        | COR0001 (archived by DEV0224), COR0003, COR0009 and COR0010.                                                                                    |
| Superseded product documents       | `fitness_social_hackathon_mvp_summary.md`, `implementation-plan.md` and `mvp-review.md` under `docs/archive/2026-09-18/`.                       |

### Mixed-history review boundaries

- Review reusable foundations such as DEV0015, DEV0025, DEV0040, DEV0046 and DEV0055 for chain-specific evidence and references; retain their independent database/server/email/hosted outcomes.
- Review scheduling transition and publication records such as COR0011, DEV0140–DEV0143 and DEV0151. A dedicated retirement record such as DEV0142 can be removed; retain independent scheduling delivery evidence and repair the work map accurately.
- Review old workflow/structure records such as DEV0029–DEV0036 and earlier document-consolidation records for references to removed areas and evidence; retain generic workflow outcomes.
- Inspect legacy marketplace consumers outside the initial set, including DEV0118/DEV0119, using their owned outcome before deciding whether they are dedicated removed-product records or mixed reusable evidence. The final manifest must account for that decision.
- Inspect supporting screenshot/log/media links in retained records and checked-in documentation; remove chain-only evidence artifacts when present. Generated ignored files and other repositories are outside this ticket.

## Implementation plan

1. Audit all repository Markdown and checked-in documentary artifacts; classify exact paths as dedicated removal, mixed-history correction or retained independent evidence. Record the manifest before deletion.
2. Delete the dedicated records/documents and any identified checked-in chain-only evidence, then record every removed prefixed ID in the minimal unavailable-ID register.
3. Correct retained references, dated mixed-history notes, reciprocal coordination ownership, indexes and README/AGENTS/archive navigation without adding false validation claims.
4. Validate no targeted evidence remains, every retained local link resolves, IDs are unique/unavailable, statuses/locations/index sections agree and no runtime/configuration/data file changed.
5. Complete this record only after all criteria pass; archive it and update its affected links/index.

## Acceptance criteria

- [ ] AC1: The final manifest accounts for every dedicated blockchain record/document and mixed-history review target; targeted working-tree evidence is removed rather than simply labelled historical.
- [ ] AC2: Retained scheduling/account/hosted/workflow records keep accurate independent evidence, with dated corrections, truthful memberships and no blockchain-only future handoff.
- [ ] AC3: Every deleted DEV/COR ID remains unavailable; indexes, directory navigation and retained Markdown references resolve without advertising removed history.
- [ ] AC4: Relevant Markdown/link/identifier/consistency checks and `git diff --check` pass, with exact deletion/correction counts and no runtime/configuration/database/Git-history changes.

## Validation plan

- Run installed Prettier over every changed Markdown file and `git diff --check`.
- Use targeted keyword/path searches plus the final manifest to prove dedicated records and evidence are absent while product exclusions remain accurate.
- Validate local Markdown destinations, relevant current specification anchors, unique headings/filenames, all retained reciprocal DEV/COR memberships, one correct index entry per retained record and unavailable-ID completeness.
- Review every deletion and changed mixed record against its original independent outcome; report any pre-existing unrelated broken historical link separately rather than quietly claiming repository-wide validity.
- Compare changed paths with the documentation-only scope. Application, database, browser and build tests are not applicable unless implementation unexpectedly changes runtime scope, which must be split first.

## Implementation record

Planning record created on 2026-10-14 under completed DEV0224. Its formatting, links and ownership were checked during backlog maintenance; the removal acceptance criteria below remain unverified. Historical pruning has not started.

### Changes and rationale

Pending implementation; the initial inventory is planning, not evidence of deletions.

### Affected files

| File or component      | Change and purpose                                                                                             |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| Pending final manifest | Record each deleted path/ID and each corrected mixed record before deletion; explain its documentary boundary. |

### Decisions and deviations

- 2026-10-14: The user explicitly separated historical evidence removal from active-backlog maintenance. DEV0224 preserves history while moving stale work; DEV0225 owns subsequent deletion and reference repair.

### Contracts, configuration, and operations

Documentation/history availability changes only. No runtime data shape, API, dependency, environment variable, migration, live operation or Git-history rewrite is planned.

## Validation results

Not run — this is the separate removal plan; runtime and documentary deletions have not occurred.

| Criterion | Evidence                                     | Result  |
| --------- | -------------------------------------------- | ------- |
| AC1       | Final manifest and removal checks pending    | Not run |
| AC2       | Mixed-history corrections pending            | Not run |
| AC3       | Reference/ID/index checks pending            | Not run |
| AC4       | Implementation review and formatting pending | Not run |

## Risks, limitations, and follow-ups

Keyword-only deletion can destroy useful account or scheduling evidence; inspect ownership and preserve independently relevant results. Historical linked source files may already be retired, so classify pre-existing broken links separately. Next action: finalize the exact removal/correction manifest after DEV0224 completes, then perform pruning within this ticket.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: Planning inventory only; no independent review created.
- Deployment or release: Not applicable — documentary pruning.
