# AGENTS.md instructions for Social Fitness

## Document ownership and project context

- Read [README.md](README.md) for navigation and [the MVP specification](docs/mvp-spec.md) for the single current product contract, including scope, behavior, architecture, [milestones](docs/mvp-spec.md#12-delivery-milestones), and [acceptance scenarios](docs/mvp-spec.md#13-acceptance-matrix).
- This `AGENTS.md` is the authoritative contributor/workflow policy. The [work-record guide](docs/work-records.md) links to these rules; archived templates supply record fields, not a separate policy.
- The [work-record guide](docs/work-records.md) links to live Linear development issues/coordination projects and the preserved Markdown archive. Development issues record the scope and evidence for individual changes; projects group peers without authorizing implementation. Neither is an alternative product contract. Update the specification in the same change when a development ticket changes overall product behavior or design.
- Keep confirmed user constraints distinct from proposed implementation defaults as described in the specification. Record adopted choices and reasons in the relevant ticket; do not silently treat proposals as user decisions.
- The [completed ticket archive](https://github.com/hworldcom/movx-work-records/tree/b49f60b2454b3de9345c395acbc08f324bcdabb3/originals/tickets/archive) is historical context and does not override the current specification or workflow. Preserve completed records; use a new current ticket for changes. The user-authorized documentary pruning in [DEV0225](https://github.com/hworldcom/movx-work-records/blob/b49f60b2454b3de9345c395acbc08f324bcdabb3/originals/tickets/archive/organisatory/DEV0225-remove-blockchain-historical-evidence.md) is a specific exception for its recorded removal manifest; removed IDs remain permanently unavailable.
- README is navigation and future setup instructions. Link to current requirements instead of copying them into README, agent instructions, or a new plan.

## Ticket before implementation

- Every implementation must have a **development issue** in the [movx Linear team](https://linear.app/movx/team/MOV/all) **before the first implementation edit**. This includes scaffolding, features, fixes, refactors, dependencies, configuration, migrations, tests, and documentation changes. Read-only investigation may precede an issue. Use the connected Linear tools to search, read, create and update records; verify the workspace/team before writing. If write access is unavailable, record the blocker and continue only independent read-only work.
- Search for an existing issue by its MOV identifier, legacy DEV identifier or scope before creating one. A development issue owns one small, reviewable task or vertical slice, its implementation/validation evidence and commit reference. New work uses Linear's native `MOV-<number>` identifier. Do not create new repository Markdown tickets or allocate new DEV/COR numbers; see [work-record navigation and ID continuity](docs/work-records.md).
- Use a **Linear project** for non-implementation coordination. It groups peer development issues, maps work and records integration evidence; it does not authorize implementation independently and its identifier is never used in commit subjects. Existing imported coordination projects retain their COR IDs in their titles.
- Put a `Coordination` field in the opening issue metadata: one linked Linear project when the issue directly implements that project, otherwise `None — independent development issue`. Set the native project membership to the same project. An issue belongs directly to at most one project. Dependencies, downstream consumers, follow-ups and historical baselines go in `Related records` and do not imply membership. The project's work map and each direct issue's field must agree.
- Keep work flat by default: at most one coordination-project-to-development-issue level. Peer issues may depend on one another; avoid child implementation hierarchies. Record a concrete reason before using a deeper hierarchy as an exception.
- Review a proposed development issue before implementation. If delivering its outcome requires several implementation issues, preserve its planning history, create a coordination project with a `Converted from` issue link and fresh peer issues, then cancel the unimplemented original with its replacement links. Never reuse its identifier. If implementation evidence or a commit already exists, preserve the original issue and its owned scope; create a separate project and peers instead of rewriting implementation history.
- A coordination project must map every implementation part, boundary or deliverable to exactly one direct development issue. Label other links as dependencies, downstream consumers, follow-ups or historical baselines; a flat `Related records` list is insufficient when the relationship affects ownership or delivery. State delivery order, start conditions, independent branches, blockers and completion conditions. Identify required issues not yet created; do not implement their scope under the project as a substitute.
- Choose one primary implementation-area label: `frontend` for routes, browser behavior and interface work; `backend` for server code, authentication, data, services and jobs; `organisatory` for contributor workflow, repository/document structure and cross-cutting consolidation. Use `blockchain` only for separately authorized chain-specific work. Link cross-cutting dependencies instead of duplicating issues.
- Before implementation, write the objective, scope, non-goals, expected behavior, edge cases, assumptions, dependencies, implementation plan, testable acceptance criteria, and validation plan. Include status, dates, milestone, Coordination and Related records metadata. Link the relevant specification section and milestone when applicable. The [preserved templates](https://github.com/hworldcom/movx-work-records/tree/main/originals/tickets) supply record fields; adapt their old filesystem/ID examples to this external workflow.
- An implementation plan in chat, a milestone heading, a commit message, or a pull request is not a substitute for the issue.
- Update the issue's scope and plan **before** implementing a material change of approach or behavior. Preserve the reason in its implementation record. Create linked issues for unrelated work.
- Mark the issue `In Progress` when implementation starts. Mark a project `In Progress` when active coordination begins. Keep an accurate handoff record if work stops partway through.

## Ticket lifecycle and continuity

| Workflow meaning | Linear representation              | Completion boundary                                                                                                       |
| ---------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Draft            | Backlog + `Draft` label            | Planning is incomplete; implementation has not started.                                                                   |
| Ready            | Todo, without Draft/Blocked labels | Scope and validation are clear, dependencies permit starting, and work is authorized. This is not an extra approval gate. |
| In progress      | In Progress                        | Implementation or required validation is underway.                                                                        |
| Blocked          | Todo + `Blocked` label             | Record the specific dependency/decision/environment blocker and next action in the issue.                                 |
| Completed        | Done                               | All acceptance criteria and required validation passed; implementation/review evidence is complete.                       |
| Cancelled        | Canceled                           | Preserve the reason, partial changes and replacement links.                                                               |

- Keep the status, workflow labels and last-updated metadata accurate. Remove Draft/Blocked labels when they no longer apply. Keep projects Planned until coordination begins and In Progress until their integration criteria pass. Completion does not imply deployment or independent review; record those separately. A merge alone never establishes Done.
- Link projects, dependencies, peers and follow-ups with stable Linear URLs; link historical Markdown records through the private archive. Development issues own their implementation/validation evidence. Projects summarize status, decisions and integration evidence without duplicating issue records. Keep a project open until every direct issue is Done or explicitly Canceled/replaced and the project's own integration criteria pass. Downstream work blocks coordination only when its work map assigns part of the required outcome to it.
- Maintain one live Linear issue per development scope. Do not copy or recreate it because its status or primary area changes. Finished records stay accessible in Linear; completed pre-migration Markdown remains in the private archive. Do not delete old issues to manage the Free-plan quota. Archiving/plan changes require an explicit follow-up if needed.
- Retain completed evidence as history. Use a new linked issue for later behavior changes and dated corrections; do not reopen or silently rewrite completed historical records. The user-authorized external preservation under DEV0406–DEV0408 relocates the Markdown; it does not discard its evidence.
- When work pauses, record what exists, what was verified, what is incomplete, and the next action.
- For a small task, concise entries are enough. Use `Not applicable — <reason>` for irrelevant fields; never omit what changed and how it was verified.

## Planning and implementation

- Plan first, implement second, and review against acceptance criteria last. These are responsibilities, not separate roles the user must select.
- Work within the user's requested outcome. A request to implement a change authorizes writing its ticket and performing the necessary work; do not ask again merely because a ticket was created.
- Resolve routine implementation choices using project context and record significant decisions. If an unresolved product question materially affects behavior or scope, clarify that point while continuing independent work.
- Keep changes focused on the active ticket. Preserve unrelated edits and prefer existing shared modules and components over duplicated logic.
- Before changing framework or SDK integration code, inspect the installed version and its documentation. Once Next.js is installed, read relevant bundled documentation when available; verify current Solana APIs when implementing the payment adapter.
- Use relevant available skills for their intended tasks. Other projects' skills and architecture rules do not automatically apply here.

## Required implementation record

Update the development ticket during implementation and finish its record before reporting completion. A developer who has not seen the conversation must be able to determine:

- **What changed:** the previous behavior or missing capability and the resulting behavior, with concrete examples when useful.
- **Where it changed:** repository-relative links (or stable GitHub links in Linear) to the important files, modules, routes, schemas, migrations, or configuration, with each file's role. Explain relevant behavior, not just a list of filenames.
- **Why it changed:** the rationale, significant decisions, tradeoffs, and deviations from the original plan. Do not rewrite earlier decisions to hide a change of direction.
- **What contracts changed:** affected data shapes, interfaces, dependencies, environment variables, setup steps, migration/rollback requirements, and compatibility implications. State when none apply; never record secrets.
- **How it was verified:** exact commands and results, relevant environment or prerequisites, manual steps and observed outcomes, and evidence mapped to acceptance criteria. Distinguish passed, failed, blocked, and not-run checks; explain omissions.
- **What remains:** known risks, limitations, unresolved questions, and linked follow-up tickets. A follow-up does not make an unmet acceptance criterion complete.

Use the development ticket's implementation record and validation results as the durable review trail. Supporting screenshots, logs, commits, and pull requests may be linked, but the ticket itself must explain the result. Avoid entries such as “implemented as discussed,” “fixed issues,” or “tests pass” without specifics. A coordination record links these ticket records and adds only cross-ticket status, decisions and integration evidence.

## Product requirements

### Retained demo coach data

- Follow the [retained demo data contract](docs/mvp-spec.md#8-identity-data-and-demo-integrity) when changing startup, provisioning, seeds, migrations or rehearsals.
- Normal startup performs no demo provisioning. Manual demo setup creates missing fresh accounts only; missing/old initialization markers never authorize changing an existing account or filling its cleared/empty content. Use disposable datasets or uniquely tagged temporary accounts for tests.
- A future change to retained demo data requires an explicit user request and a development ticket naming the exact records, intended changes and preservation/validation evidence. Owner-requested edits and individual account recovery remain ordinary product behavior. Do not use a reset or credential rotation to repair a login without that authorization.

Implement against the specification's [scheduling state model](docs/mvp-spec.md#5-scheduling-state-model), [booking and recovery](docs/mvp-spec.md#7-requests-booking-and-recovery), [identity, data and demo integrity](docs/mvp-spec.md#8-identity-data-and-demo-integrity), and [scheduling behavior and permissions](docs/mvp-spec.md#9-scheduling-behavior-and-permissions). Use its [confirmed decision register](docs/mvp-spec.md#2-confirmed-target-and-decisions), [definition of done](docs/mvp-spec.md#11-definition-of-done) and [acceptance matrix](docs/mvp-spec.md#13-acceptance-matrix) to select checks. Keep the requirements in that document rather than restating them here.

## Validation and definition of done

- Choose validation that proves the ticket's acceptance criteria. Add or update meaningful tests for changed logic, state transitions, authorization, concurrency, and recovery; avoid tests that only mirror the implementation.
- Run relevant existing tests, lint, type checks, and builds as appropriate to the affected code. The application foundation ticket must establish actual commands and document them in the README; do not claim scripts exist before they do.
- For interface changes, verify the affected flow at mobile and desktop widths, including keyboard use and relevant error states. For database changes, validate migrations and constraints. Payment simulation tests do not replace the required real devnet rehearsal.
- Documentation-only work normally needs link and consistency checks, not application tests. Record why a check is not applicable.
- Before completion, review the changed files against the ticket, resolve accidental scope expansion, update the implementation record, and account for every acceptance criterion.
- Mark a ticket Done (Completed) only when its acceptance criteria and required validation have passed and its implementation record is complete. If required evidence is missing, keep it In Progress or mark it Blocked and state the exact remaining work.
- Update the Linear issue/project and relevant project documentation in the same change. Follow the commit rule below, include the development-ticket ID in pull requests when created, and add review references to the development ticket when available. Do not commit or publish solely to fill a reference field.
- Final handoff must link the ticket and summarize the outcome, validation, and material limitations. Do not claim deployment or external review merely because local implementation is complete.

## Commit rule

- Create commits when the user asks to commit or earlier user authorization already covers committing the work.
- **Every commit subject must include the relevant development issue ID.** New issues use `[MOV-<number>] Imperative summary`. Existing imported DEV work keeps `[DEVNNNN] Imperative summary`, preserving the prefix and four digits; also link its MOV issue in the pull request. Mentioning the ID only in the commit body is insufficient. Do not assign a new MOV issue merely to rename existing DEV scope.
- **Never include a coordination/project identifier in a commit subject.** If a commit updates a coordination record, reference the development ticket that owns the concrete change. A standalone coordination or workflow edit needs its own development ticket before it is committed.
- Prefer one development ticket per commit. If a commit necessarily covers multiple development tickets, include each implemented ticket number in the subject. Do not add dependencies, downstream tickets or coordination records merely because they are linked.
- Finish each referenced Linear issue's implementation record and validation results before committing; include the issue URL in the commit body or pull request so its external evidence is reviewable. Before committing, check that the staged changes match only the referenced development tickets and that the subject contains the correct development-ticket IDs.

## Writing style

- Write direct, concrete notes for future developers. Explain necessary acronyms on first use.
- Write for readers who have not seen the conversation and do not assume they already know project-specific terminology. Define an unfamiliar term in plain language at first use and distinguish it from likely everyday or technical meanings when confusion is possible; for example, explain that a `demo run` is an isolated demonstration dataset, not a fitness activity or login session. Established code or schema identifiers may remain unchanged when the surrounding text explains them clearly.
- Keep planning intent distinct from implementation evidence and distinguish facts from assumptions.
- Maintain enough detail to review or continue the work without reconstructing conversation history.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
