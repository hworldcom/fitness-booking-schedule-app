# AGENTS.md instructions for Social Fitness

## Document ownership and project context

- Read [README.md](README.md) for navigation and [the MVP specification](docs/mvp-spec.md) for the single current product contract, including scope, behavior, architecture, [milestones](docs/mvp-spec.md#12-delivery-milestones), and [acceptance scenarios](docs/mvp-spec.md#13-acceptance-matrix).
- This `AGENTS.md` is the authoritative contributor/workflow policy. The ticket guide links to these rules; the template supplies record fields, not a separate policy.
- The [ticket index](tickets/README.md) tracks development tickets and coordination records. Development tickets record the scope and evidence for individual changes; coordination records group peer development tickets without authorizing implementation. Neither is an alternative product contract. Update the specification in the same change when a development ticket changes overall product behavior or design.
- Keep confirmed user constraints distinct from proposed implementation defaults as described in the specification. Record adopted choices and reasons in the relevant ticket; do not silently treat proposals as user decisions.
- The [document archive](docs/archive/2026-09-18/) and [completed ticket archive](tickets/archive/) are historical context. They may describe superseded decisions and do not override the current specification or workflow. Preserve completed records; use a new current ticket for changes.
- README is navigation and future setup instructions. Link to current requirements instead of copying them into README, agent instructions, or a new plan.

## Ticket before implementation

- Every implementation must have a **development ticket** under `tickets/current/<area>/` **before the first implementation edit**. This includes scaffolding, features, fixes, refactors, dependencies, configuration, migrations, tests, and documentation changes. Read-only investigation may precede a ticket.
- Name an implementable record `# Ticket DEVNNNN: Short title` and use a `DEVNNNN-short-title.md` filename. A development ticket owns one small, reviewable task or vertical slice, its implementation/validation evidence, and the ID used by commits. Copy [the development-ticket template](tickets/TEMPLATE.md) and maintain the [ticket index](tickets/README.md).
- Name a non-implementation umbrella `# Coordination CORNNNN: Short title` and use a `CORNNNN-short-title.md` filename. A coordination record groups work, sequence, boundaries and integration evidence; it does not authorize implementation and its ID is never used in a commit subject. Copy [the coordination template](tickets/COORDINATION_TEMPLATE.md).
- Put a `Coordination` field in the opening metadata of every development ticket. Use one repository-relative COR link when the ticket is direct implementation work for that coordination record; otherwise write `None — independent development ticket`. A DEV ticket belongs directly to at most one COR. Dependencies, downstream consumers, follow-ups and historical baselines go in `Related records` and do not imply coordination membership. The COR work map and each direct DEV member's field must agree.
- Keep work flat by default: at most one coordination-record-to-development-ticket level. Development tickets under a coordination record are peers and may depend on one another, but they do not create child development-ticket hierarchies. Record a concrete reason before using a deeper hierarchy as an exception.
- Review a proposed DEV ticket before implementation. If delivering its outcome requires splitting it into multiple implementation tickets, convert the original planning record into a COR: allocate the next unused COR ID, rename its heading/file/index entry, put the former DEV ID in the COR's `Converted from` field and the retired-ID register, adapt the record to the coordination template without discarding its planning history, and create fresh peer DEV tickets whose `Coordination` fields link to the new COR. Never use the retired DEV ID for later work or commits. If implementation evidence or a commit already exists, preserve the original DEV and its owned scope; create a separate COR and peer DEV records rather than rewriting implementation history.
- A coordination record must map every implementation part, boundary or deliverable to exactly one direct development ticket. Label other links as dependencies, downstream consumers, follow-ups or historical baselines; a flat `Related records` list is insufficient when the relationship affects ownership or delivery. State delivery order, start conditions, independent branches, blockers and coordination-completion conditions. Identify required development tickets that have not been created, and do not implement their scope under the coordination record as a substitute.
- Choose the ticket's primary implementation area: `frontend` for routes, browser behavior and interface work; `backend` for Next.js server code, authentication, data, services and jobs; `blockchain` for Solana programs, wallet transactions, RPC verification and chain-specific integration; or `organisatory` for contributor workflow, repository/document structure and cross-cutting consolidation. Put cross-cutting work in one primary area and link its dependencies rather than duplicating the ticket.
- Use two independent, stable namespaces: `DEVNNNN` for development tickets and `CORNNNN` for coordination records. Allocate the next unused number within the correct prefix after checking every area under `tickets/current/`, `tickets/archive/` and the retired-ID register in `tickets/README.md`; never renumber or reuse a prefixed ID. The same numeric portion may exist once in each namespace because the prefix is part of the ID. DEV-to-COR conversion assigns the next COR ID; it does not carry the DEV number into the COR namespace.
- Before implementation, write the objective, scope, non-goals, expected behavior, edge cases, assumptions, dependencies, implementation plan, testable acceptance criteria, and validation plan. Link the relevant specification section and milestone when applicable.
- An implementation plan in chat, a milestone heading, a commit message, or a pull request is not a substitute for the ticket.
- Update the ticket's scope and plan **before** implementing a material change of approach or behavior. Preserve the reason for the change in the implementation record. Create linked tickets for unrelated work.
- Mark the development ticket `In progress` when implementation starts and maintain the ticket index. Mark a coordination record `In progress` when active coordination begins. Keep an accurate handoff record if work stops partway through.

## Ticket lifecycle and continuity

| Status      | Meaning                                                                                                                                            |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Draft       | Planning is incomplete; implementation has not started.                                                                                            |
| Ready       | Scope and validation are clear, dependencies permit starting, and the work is within the user's authorization. This is not an extra approval gate. |
| In progress | Implementation or required validation is underway.                                                                                                 |
| Blocked     | A specific dependency, decision, or environment issue prevents completion; record the blocker and next action.                                     |
| Completed   | Acceptance criteria and required validation passed; the implementation and review record is complete.                                              |
| Cancelled   | Work will not proceed; preserve the reason and any partial changes or replacement ticket.                                                          |

- Keep status and last-updated dates accurate. Completion does not imply deployment or independent review; record those separately.
- Link coordination records, dependencies, peer tickets and follow-ups with repository-relative paths. Development tickets record their own implementation and validation evidence. Coordination records summarize delivery status and integration evidence without duplicating those records. Keep a coordination record open until every direct development ticket has completed or been explicitly cancelled/replaced and the coordination record's own integration criteria pass. Downstream work blocks coordination only when its work map says that ticket delivers part of the required outcome.
- Keep `Draft`, `Ready`, `In progress`, and `Blocked` development tickets and coordination records under exactly one `tickets/current/<area>/` directory. A status change or cross-cutting scope does not create a duplicate record.
- After all applicable acceptance criteria and validation pass, finish the record, set it to `Completed`, move it from `tickets/current/<area>/` to the matching `tickets/archive/<area>/`, and update the root index and every affected repository link in the same change. Move a `Cancelled` record to its matching archive area after recording its reason and any replacement. Do not archive unfinished work.
- Retain archived tickets as history. Use a new linked current ticket for later behavior changes and dated corrections; do not reopen or silently rewrite an archived record.
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
- **Where it changed:** repository-relative links to the important files, modules, routes, schemas, migrations, or configuration, with each file's role. Explain relevant behavior, not just a list of filenames.
- **Why it changed:** the rationale, significant decisions, tradeoffs, and deviations from the original plan. Do not rewrite earlier decisions to hide a change of direction.
- **What contracts changed:** affected data shapes, interfaces, dependencies, environment variables, setup steps, migration/rollback requirements, and compatibility implications. State when none apply; never record secrets.
- **How it was verified:** exact commands and results, relevant environment or prerequisites, manual steps and observed outcomes, and evidence mapped to acceptance criteria. Distinguish passed, failed, blocked, and not-run checks; explain omissions.
- **What remains:** known risks, limitations, unresolved questions, and linked follow-up tickets. A follow-up does not make an unmet acceptance criterion complete.

Use the development ticket's implementation record and validation results as the durable review trail. Supporting screenshots, logs, commits, and pull requests may be linked, but the ticket itself must explain the result. Avoid entries such as “implemented as discussed,” “fixed issues,” or “tests pass” without specifics. A coordination record links these ticket records and adds only cross-ticket status, decisions and integration evidence.

## Product requirements

Implement against the specification's [marketplace state model](docs/mvp-spec.md#marketplace-state-model), [event funding and recovery](docs/mvp-spec.md#event-funding-and-recovery), [asset, wallet and demo integrity](docs/mvp-spec.md#asset-wallet-and-demo-integrity), and [social behavior and permissions](docs/mvp-spec.md#social-behavior-and-permissions). Use its [confirmed decision register](docs/mvp-spec.md#confirmed-target-and-decisions), [definition of done](docs/mvp-spec.md#11-definition-of-done) and [acceptance matrix](docs/mvp-spec.md#13-acceptance-matrix) to select checks. Keep the requirements in that document rather than restating them here.

## Validation and definition of done

- Choose validation that proves the ticket's acceptance criteria. Add or update meaningful tests for changed logic, state transitions, authorization, concurrency, and recovery; avoid tests that only mirror the implementation.
- Run relevant existing tests, lint, type checks, and builds as appropriate to the affected code. The application foundation ticket must establish actual commands and document them in the README; do not claim scripts exist before they do.
- For interface changes, verify the affected flow at mobile and desktop widths, including keyboard use and relevant error states. For database changes, validate migrations and constraints. Payment simulation tests do not replace the required real devnet rehearsal.
- Documentation-only work normally needs link and consistency checks, not application tests. Record why a check is not applicable.
- Before completion, review the changed files against the ticket, resolve accidental scope expansion, update the implementation record, and account for every acceptance criterion.
- Mark a ticket `Completed` only when its acceptance criteria and required validation have passed and its implementation record is complete. If required evidence is missing, keep it `In progress` or `Blocked` and state the exact remaining work.
- Update the ticket index and relevant project documentation in the same change. Follow the commit rule below, include the development-ticket ID in pull requests when created, and add review references to the development ticket when available. Do not commit or publish solely to fill a reference field.
- Final handoff must link the ticket and summarize the outcome, validation, and material limitations. Do not claim deployment or external review merely because local implementation is complete.

## Commit rule

- Create commits when the user asks to commit or earlier user authorization already covers committing the work.
- **Every commit subject must include the relevant development-ticket ID**, preserving the `DEV` prefix and all four digits. Use `[DEVNNNN] Imperative summary`, for example `[DEV0033] Prefix work-record identifiers`. Mentioning the ticket only in the commit body is insufficient.
- **Never include a coordination-record number in a commit subject.** If a commit updates a coordination record, reference the development ticket that owns the concrete change. A standalone coordination or workflow edit needs its own development ticket before it is committed.
- Prefer one development ticket per commit. If a commit necessarily covers multiple development tickets, include each implemented ticket number in the subject. Do not add dependencies, downstream tickets or coordination records merely because they are linked.
- Include each referenced development ticket's implementation record and validation results with the implementation changes in the commit. Before committing, check that the staged changes match only the referenced development tickets and that the subject contains the correct development-ticket IDs.

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
