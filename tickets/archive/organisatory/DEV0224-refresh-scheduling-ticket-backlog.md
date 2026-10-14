# Ticket DEV0224: Refresh the scheduling ticket backlog

- Status: Completed
- Created: 2026-10-14
- Last updated: 2026-10-14
- Milestone: Scheduling contributor maintenance
- Coordination: None — independent development ticket
- Related records: affected [COR0001 — Project structure](COR0001-project-structure.md), active hosted follow-up [DEV0055](../../current/backend/DEV0055-hosted-supabase-staging-environment.md), completed misplaced index entry [DEV0209](../frontend/DEV0209-show-coach-portraits-in-client-request-history.md); separate historical pruning [DEV0225](../../current/organisatory/DEV0225-remove-blockchain-historical-evidence.md)

## Objective and context

Apply the user-approved backlog review without expanding it into archived-evidence deletion. COR0001 still waits for obsolete chain/program foundations; DEV0055's current plan and evidence mix old hosting and product contracts; DEV0209 is archived but indexed under current work. Use the [current specification](../../../docs/mvp-spec.md#12-delivery-milestones) for the scheduling-only target.

## Scope and non-goals

- In scope: cancel/archive COR0001 with a dated reason and updated repository links; refresh DEV0055's current requirements, Vercel handoff and dated evidence boundaries; move DEV0209 and the other already archived redesign entries out of the Current index section; create a separate historical-pruning ticket; update index/status/next IDs.
- Out of scope: historical evidence deletion, runtime code/copy, schema/migrations, live hosted verification, deployment, committing or pushing changes.

## Expected behavior and edge cases

- COR0001 leaves the active backlog as Cancelled, preserving delivered foundation history and marking unmet obsolete delivery as cancelled rather than completed.
- Archived direct members keep their original membership and valid links after the COR moves; no ownership is reassigned.
- DEV0055 remains In progress with current specification links, explicit remaining hosted evidence and dated historical results. Editing this record does not establish fresh migration, SMTP, security or scheduling validation.
- DEV0209 has exactly one archived index row. Other accepted app work and prior uncommitted changes are retained.
- Separate DEV0225 defines the explicitly requested blockchain-history removal, the exception to normal archive preservation and removal/reference/ID checks; no pruning occurs under this ticket.

## Assumptions, decisions, and dependencies

- On 2026-10-14 the user approved the backlog cleanup, then requested archived blockchain evidence removal under a separate ticket.
- Documentation-only scope is one coherent backlog maintenance task. Historical deletion is independently owned by DEV0225.
- DEV0224/DEV0225 are the next unused development IDs after checking current/archive, retired and reserved IDs; no coordination record is needed.

## Implementation plan

1. Finish COR0001's dated cancellation record, archive it and repair all affected Markdown destinations.
2. Update DEV0055's current plan against M4, separate historical proofs from required current Vercel/Supabase evidence and remove cancelled marketplace release ownership from its current handoff.
3. Create the independent historical-removal plan in DEV0225; move all already archived rows out of the Current index section and advance next IDs to DEV0226/COR0021.
4. Validate affected links/anchors, unique identifiers, locations/statuses, reciprocal historical membership, index rows, preserved runtime files and Markdown/diff formatting.

## Acceptance criteria

- [x] AC1: COR0001 is Cancelled and archived with a reason, accurate unmet-work disposition and valid repository references.
- [x] AC2: DEV0055 remains open with current specification/Vercel requirements and no old result presented as fresh hosted validation.
- [x] AC3: DEV0209 is indexed only as archived, and a separate implementable DEV0225 owns historical pruning with no evidence deleted here.
- [x] AC4: IDs, locations/statuses, affected links, memberships, formatting and diff checks pass; prior unrelated edits and runtime/configuration files are preserved.

## Validation plan

Use installed Prettier and `git diff --check`; validate affected local Markdown links and current specification anchors, unique work-record IDs, index section/status matches, COR0001's retained five direct memberships and absent old current destinations. Compare the before/after working tree to confirm documentation-only changes. App/browser/database/build checks are not applicable because no runtime change or hosted operation occurs.

## Implementation record

Started and completed on 2026-10-14 after the user approved the review and assigned historical deletion separate ownership.

### Changes and rationale

- Cancelled and archived COR0001 because its outstanding unticketed chain/program deliverables are obsolete for the scheduling product. The five delivered direct members retain their original completed status/membership; unmet AC1/AC4/AC5 remain explicitly unfinished rather than being marked successful. Historical evidence is preserved until DEV0225 performs its separate work.
- Repaired COR0001 destinations in the index and twelve existing archived records, preserving their substantive text, dates, outcomes and ownership. Path changes are the required archive-link maintenance, not a reopening of those completed records.
- Refreshed DEV0055 to M4 and the current native Vercel/Supabase scheduling target. Corrected current specification links and the cancelled marketplace release handoff; initial migration/login/SMTP proofs are explicitly dated baseline evidence. Current migration/grant/Auth, browser privacy, Vercel exposure, account isolation and the two-athlete/coach rehearsal remain required and unverified under AC3/AC5–AC8.
- Moved DEV0209 and eleven other already archived redesign index entries out of Current. COR0001 is indexed as Cancelled in Archived; open work is now confined to the Current section.
- Created independent Draft DEV0225 for user-authorized historical documentary pruning, with an initial dedicated-record inventory, mixed-history retention boundaries, unavailable-ID/reference checks and explicit exclusion of runtime/data/Git-history changes. No historical evidence was deleted by this cleanup.
- Allocated DEV0224/DEV0225 and advanced next IDs to DEV0226/COR0021 while retaining the prior athlete/connections work and existing ID reservations.

### Affected files

| File or component                                                                                                      | Change and purpose                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| [COR0001](COR0001-project-structure.md)                                                                                | Archive move, dated cancellation, cancelled missing deliverables and explicit unfulfilled integration criteria.           |
| [DEV0055](../../current/backend/DEV0055-hosted-supabase-staging-environment.md)                                        | Current hosted plan, specification links, M4 scope and separation of dated setup proofs from required current acceptance. |
| [DEV0225](../../current/organisatory/DEV0225-remove-blockchain-historical-evidence.md)                                 | Separate historical-pruning plan; no removal implementation in this change.                                               |
| [tickets/README.md](../../README.md)                                                                                   | Accurate current/archive sections, statuses, new records and next-ID allocation.                                          |
| Archived DEV0015, DEV0025, DEV0027, DEV0030, DEV0031, COR0011, DEV0029, DEV0032, DEV0033, DEV0034, DEV0036 and DEV0140 | Link-only changes to COR0001's new archive destination; original evidence and metadata dates retained.                    |

### Decisions and deviations

- Historical pruning is a separate ticket at the user's explicit request; the present cancellation/archive preserves the evidence until that work runs.
- 2026-10-14 scope refinement before further index edits: eleven other already archived redesign records also appeared under Current. Include their index-row relocation with DEV0209 so the Current section consistently reflects open work; their underlying status/content does not change.

### Contracts, configuration, and operations

Work-record status/paths and current hosted validation requirements change only. No product behavior, dependency, API, environment variable, migration or live service operation changes.

## Validation results

- Date/environment: 2026-10-14, local main checkout; no hosted access or runtime changes.
- `xargs node_modules/.bin/prettier --write < /tmp/movx-dev0224-markdown-files.txt` and the corresponding `--check` command passed for seventeen affected Markdown documents.
- `python3 /tmp/movx-dev0224-check-docs.py` checked 325 local links and 15 valid anchors, and passed affected local destination/new-anchor checks, 166 unique/indexed records, all current/archive status and section checks, the five retained COR0001 memberships, next-ID allocation, preserved historical files and separate DEV0225/DEV0055 evidence assertions.
- The validator identified two unchanged pre-existing specification-anchor issues in archived DEV0015/DEV0025 (`#6-architecture-and-delivery-boundaries`). They are outside this link-move/current-plan correction and are recorded for DEV0225's mixed-history review; no new broken destination or anchor was introduced.
- `git diff --check` passed. Working-tree scope review found only ticket-document maintenance in this task; prior specification/athlete/connections changes were retained. Historical files remain present except for the required COR0001 move.
- Application, database, browser and build checks were not run because no runtime/source/configuration/dependency change or live hosted operation occurred. Current hosted acceptance remains DEV0055 work; pruning checks remain DEV0225 work.

| Criterion | Evidence                                                                                                        | Result |
| --------- | --------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Archived Cancelled COR0001, explicit obsolete/unmet-work disposition and five retained reciprocal member links. | Passed |
| AC2       | M4/current-specification plan, historical-versus-current evidence labels and unfinished current AC3/AC5–AC8.    | Passed |
| AC3       | Correct archive index sections and separate Draft DEV0225 with intact historical files.                         | Passed |
| AC4       | Seventeen-document formatting, record/link/anchor/status/index/membership assertions, diff and scope review.    | Passed |

## Risks, limitations, and follow-ups

Live hosted acceptance remains DEV0055 work. Archived evidence deletion remains DEV0225 work. The two old specification anchors in reusable historical foundation tickets remain recorded for its mixed-history review. This maintenance ticket has no outstanding acceptance work.

## Completion and review references

- Completed: 2026-10-14 — active backlog and hosted handoff refreshed; historical pruning independently planned.
- Commit: Included in the documentation commit with subject `[DEV0219][DEV0224] Adopt athlete connections and refresh ticket backlog`, authorized by the user on 2026-10-14.
- Review: No independent review created.
- Deployment or release: Not applicable — documentation-only maintenance.
