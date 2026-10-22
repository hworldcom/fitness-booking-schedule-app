# AGENTS.md instructions for Social Fitness

> **Work tracking is in [Linear, team MOV](https://linear.app/movx/team/MOV/all).** Product requirements are in the [MVP specification](docs/mvp-spec.md).

## Document ownership and project context

This file is the authoritative contributor/workflow policy. It delegates mandatory procedures to [docs/work-records.md](docs/work-records.md#when-these-procedures-apply): read the relevant section **before its triggering action**. References do not weaken obligations; archives/guides cannot override current policy or product requirements.

Use [README](README.md) for setup/commands and the [feature map](docs/architecture/feature-map.md) for discovery. The MVP specification is the single product contract; update it with behavior/design changes. Distinguish confirmed user constraints from proposed defaults; record adopted choices/reasons in the issue. Issues own scope/evidence; coordination projects group peers without authorizing implementation.

## Task-focused discovery

1. Read the live Linear issue and these rules. Start with the relevant feature-map entry, source and tests; consult the overview if needed.
2. Determine whether requested behavior already exists. Distinguish static evidence from runtime proof and verify the map is current.
3. Apply relevant MVP requirements and all applicable security, authorization, data-integrity, acceptance and recovery rules. Expand discovery when risk, uncertainty or dependencies cross the initial capability.
4. Record affected components/contracts, the plan and meaningful validation before editing. Update the affected map entries when entry points, ownership/SQL boundaries, test commands or prerequisites move.

## Ticket before implementation

Every implementation, including documentation/tests/configuration/refactors, needs a live MOV development issue **before the first edit**; read-only investigation may precede it. Use connected Linear tools, verify workspace/team before writing and search by MOV/legacy ID or scope before creating issues. If writes are unavailable, record the blocker and continue only independent read-only work. Chat plans, milestones, commits and PRs are not substitutes.

Before editing, confirm the issue has complete planning metadata, scope/plan and acceptance/validation criteria. Read [issue creation and scope](docs/work-records.md#issue-creation-and-scope) before creating/rescoping issues or filling missing/uncertain planning details. Keep one issue per scope and preserve completed history; later changes need new linked issues. No repository Markdown tickets or new DEV/COR IDs.

### Ticket categories

Choose exactly one primary area by deliverable: `frontend`, `backend`, `database` or `organisatory`. Read the [category definitions](docs/work-records.md#ticket-categories) before classification/reclassification. Before projects, dependency links, splits, conversions or coordination membership changes, follow [coordination and conversion](docs/work-records.md#coordination-and-conversion); project IDs never substitute for development issue IDs.

## Reference triggers

The reading triggers below do not change which rules apply.

| Action                                                                          | Read before the action                                                                                                                                                                                            |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routine start/status or ordinary evidence update                                | Root minimum; detailed guide only for unclear fields/status or nonroutine evidence                                                                                                                                |
| Missing issue, creation, material rescope or missing/uncertain planning         | [Issue creation/scope](docs/work-records.md#issue-creation-and-scope); [conversion](docs/work-records.md#coordination-and-conversion) if splitting work                                                           |
| Every completion or cancellation                                                | [Lifecycle/closure](docs/work-records.md#ticket-lifecycle-and-continuity) and [validation/completion](docs/work-records.md#validation-and-completion)                                                             |
| Projects, dependencies, splits/conversions, coordination or reclassification    | [Coordination](docs/work-records.md#coordination-and-conversion), [categories](docs/work-records.md#ticket-categories) and affected issue metadata                                                                |
| Failed/blocked checks, unclear fields/status, disputed scope or complex handoff | Relevant [record fields](docs/work-records.md#required-implementation-record), [lifecycle](docs/work-records.md#ticket-lifecycle-and-continuity) and [validation](docs/work-records.md#validation-and-completion) |
| Booking/availability/authentication/authorization/privacy/retained data         | Relevant MVP sections linked below and the feature-map/source boundaries; database guidance if SQL/data is affected                                                                                               |
| SQL/migrations, DB fixtures, hosted or destructive operations                   | Applicable [database guide](supabase/README.md) setup/authority/recovery sections and rehearsal target/cleanup instructions                                                                                       |
| Test selection/execution or framework/SDK integration changes                   | README/package scripts and feature-map prerequisites; installed version and relevant bundled documentation before integration edits                                                                               |

## Planning and implementation

Plan, implement, then review against acceptance criteria; the user need not select roles. An implementation request authorizes its ticket and necessary work; do not ask again merely because a ticket exists. Resolve routine choices from context, record significant decisions and clarify material product questions while continuing independent work.

Keep changes within the issue, preserve unrelated edits and prefer existing shared modules/components. Update scope/plan **before** material approach/behavior changes; unrelated work needs linked issues. Use relevant skills; other projects' rules do not automatically apply. Before framework/SDK integration changes, inspect installed versions and relevant documentation, including bundled Next.js guidance below.

Preserve actor/owner/dataset permissions, privacy, transaction/retry/idempotency and recovery contracts from the specification. A failed read is not verified empty data; an uncertain write is not proof of failure. Client state/preview grants no server/database authority.

## Product requirements

Implement against the relevant [scheduling state](docs/mvp-spec.md#5-scheduling-state-model), [booking/recovery](docs/mvp-spec.md#7-requests-booking-and-recovery), [identity/data](docs/mvp-spec.md#8-identity-data-and-demo-integrity) and [permissions](docs/mvp-spec.md#9-scheduling-behavior-and-permissions) requirements. Use the [confirmed decisions](docs/mvp-spec.md#2-confirmed-target-and-decisions), [definition of done](docs/mvp-spec.md#11-definition-of-done) and [acceptance matrix](docs/mvp-spec.md#13-acceptance-matrix). Keep product rules there rather than copying them into navigation or plans.

### Retained demo coach data

- Follow the [retained demo data contract](docs/mvp-spec.md#8-identity-data-and-demo-integrity) when changing startup, provisioning, seeds, migrations or rehearsals.
- Normal startup performs no demo provisioning. Manual demo setup creates missing fresh accounts only; missing/old initialization markers never authorize changing an existing account or filling its cleared/empty content. Use disposable datasets or uniquely tagged temporary accounts for tests.
- A future change to retained demo data requires an explicit user request and a development ticket naming the exact records, intended changes and preservation/validation evidence. Owner-requested edits and individual account recovery remain ordinary product behavior. Do not use a reset or credential rotation to repair a login without that authorization.

## Validation and definition of done

Prove acceptance criteria with meaningful tests for changed logic, state transitions, authorization, concurrency and recovery; avoid implementation-mirroring tests. Run relevant existing tests, lint, type checks and builds as appropriate, using actual README/package commands and prerequisites. Interface changes require mobile/desktop, keyboard and error-state checks; database changes require migration/constraint validation. Documentation-only changes normally need link/consistency checks; explain inapplicable application checks.

Focused checks are a starting point, not permission to omit required final validation. Select actual checks and prerequisites from README/package scripts and the relevant feature-map entry. Before SQL, migrations, DB fixtures, hosted or destructive operations, read the applicable [database setup/fixtures](supabase/README.md#local-development-and-database-tests), [runtime authority](supabase/README.md#runtime-authority) or [hosted recovery](supabase/README.md#hosted-changes-and-recovery) guidance and the rehearsal's target/cleanup instructions. Establish environment/fixture isolation and preserve retained data. Fixture/static checks do not establish live browser/Auth/SQL proof.

## Required implementation record

Update the issue during implementation and finish evidence before reporting completion. For ordinary entries, this root minimum suffices: explain what changed; files and roles; why/decisions; affected contracts, environment/setup, migration/rollback and compatibility; exact checks/commands, prerequisites and observed outcomes; acceptance coverage and remaining risks/work. Use concise justified `Not applicable` fields. Distinguish passed/failed/blocked/skipped/not-run checks, explain omissions, link evidence and omit secrets. Follow-ups cannot satisfy unmet acceptance criteria. Final handoff links the issue and summarizes outcome, validation and limitations.

Detailed [record fields](docs/work-records.md#required-implementation-record) and [validation/completion rules](docs/work-records.md#validation-and-completion) remain binding. Read them for unclear fields, unusual failed/blocked validation, disputed scope or complex handoffs; ordinary evidence updates do not require rereading the guide.

## Ticket lifecycle and continuity

Routine start/status updates use this root minimum: start implementation as In Progress, keep status/dates/labels accurate and remove obsolete Draft/Blocked labels. On pause, record what exists, verified work, remaining work and next action. Preserve historical evidence/links. Read [lifecycle and continuity](docs/work-records.md#ticket-lifecycle-and-continuity) before unclear/nonroutine state changes, blocking or complex handoffs.

**Every closure or cancellation** requires reading [lifecycle and continuity](docs/work-records.md#ticket-lifecycle-and-continuity) and [validation/completion](docs/work-records.md#validation-and-completion), plus the evidence fields if unclear. Done requires all acceptance criteria, required validation and the full implementation record complete. A merge proves neither Done nor deployment/external review. Project completion also requires its own integration criteria and all direct work resolved.

## Commit rule

Commit only when the user asks or existing authorization covers it. Before committing or preparing a PR, read the [commit procedure](docs/work-records.md#commit-procedure). Each subject includes the owning development ID: `[MOV-<number>] Imperative summary`, or existing imported `[DEVNNNN]` scope. Never use project/coordination IDs. Finish issue evidence first, check staged scope and link the issue in the commit body or PR; do not commit/publish solely to fill a reference.

## Writing style

Write concrete notes for readers without this conversation. Define unfamiliar terms/acronyms, separate intent from evidence and facts from assumptions, and give enough context to review/continue work. Explain ambiguous project terms; a `demo run` is an isolated demonstration dataset, not a workout or login session. [Writing guidance](docs/work-records.md#writing-for-developers) supplies detailed examples when terminology/record requirements are unclear.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
