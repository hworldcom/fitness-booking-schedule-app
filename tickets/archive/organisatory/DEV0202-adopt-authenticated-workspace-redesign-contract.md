# Ticket DEV0202: Adopt the authenticated workspace redesign contract

- Status: Completed
- Created: 2026-10-12
- Last updated: 2026-10-12
- Milestone: Scheduling interface authenticated-workspace follow-up
- Coordination: [COR0018 — Authenticated workspace redesign](../../current/organisatory/COR0018-authenticated-workspace-redesign.md)
- Related records: completed public contract [DEV0195 — Adopt the public marketplace redesign contract](DEV0195-adopt-public-marketplace-redesign-contract.md), completed capability navigation [DEV0153 — Separate client and coach navigation](../frontend/DEV0153-separate-client-and-coach-navigation.md), completed coach tabs [DEV0170 — Separate coach Schedule and Bookings tabs](../frontend/DEV0170-separate-coach-schedule-and-bookings-tabs.md) and [DEV0171 — Unify coach Profile navigation](../frontend/DEV0171-unify-coach-profile-navigation.md)

## Objective and context

Adopt the approved authenticated preview as a visual direction for the real `My sessions`, `Coach workspace` and Profile routes. Close the planning gap that left these routes on the older interface after COR0017 redesigned only public marketplace pages. Translate the concept into the authoritative MVP specification without adopting fabricated content, inactive controls or preview navigation that conflicts with confirmed product behavior.

## Scope and non-goals

- In scope:
  - Define the shared authenticated visual hierarchy, responsive navigation and truthful content boundaries.
  - Preserve capability-aware primary navigation and the existing coach `Profile → Schedule → Bookings` structure.
  - Map shell, client sessions, coach schedule, coach bookings, Profiles and final QA to direct peer tickets under COR0018.
  - Update specification acceptance language and the ticket index.
- Out of scope:
  - Runtime UI implementation, schema/API changes, booking-policy changes, new session notes, fabricated request messages or new routes.
  - Replacing the current coach sub-navigation with the concept preview's illustrative four tabs.

## Expected behavior and edge cases

- The authenticated app will use the approved MovX paper/forest/lime visual language and denser page hierarchy instead of visibly reverting to the legacy layout.
- Ordinary clients, coaches, applicants and suspended coaches retain exactly their current authorized destinations and actions.
- `My sessions` distinguishes the account's pending requests, confirmed upcoming sessions and retained history; a coach sees the same client-owned content and a clear route to separately managed coach work.
- Coach Profile, Schedule and Bookings retain stable ordering and their existing server-derived status, location, request and booking semantics.
- Personal avatar/profile presentation stays private and distinct from public coach portrait/profile presentation.

## Assumptions, decisions, and dependencies

- The authenticated interactive preview is approved visual input, but its sample people, dates, messages, counts, notes controls and four-tab coach navigation are illustrative only.
- Existing C14-C15 and DEV0170-DEV0172 decisions are authoritative when the preview differs.
- COR0017/DEV0201 remain scoped to the public marketplace and are not silently expanded.
- No product decision remains unresolved for contract adoption.

## Implementation plan

1. Add the authenticated visual/presentation boundary to the confirmed decision register, scheduling interface rules, definition of done and acceptance matrix.
2. Create COR0018 and direct peer DEV0203-DEV0208 with exact ownership, order and validation boundaries.
3. Update the ticket index and related public-redesign records to expose the separate follow-up.
4. Validate formatting, links, unique identifiers, reciprocal membership and target-language consistency.

## Acceptance criteria

- [x] AC1: The specification requires coherent authenticated presentation while preserving actor capabilities, routes and authoritative scheduling behavior.
- [x] AC2: Preview-only examples are explicitly non-authoritative, and stable `Profile → Schedule → Bookings` navigation plus personal/coach Profile separation remain intact.
- [x] AC3: Every required implementation area belongs to exactly one direct COR0018 development ticket with clear dependency order and completion conditions.
- [x] AC4: Index IDs/statuses, reciprocal coordination links, Markdown links, formatting and diff checks pass.

## Validation plan

- Run Prettier over every affected specification/work-record file and `git diff --check`.
- Resolve relative Markdown links, verify one heading for COR0018 and DEV0202-DEV0208, confirm reciprocal coordination membership and confirm next IDs are DEV0209/COR0019.
- Search current requirements/tickets for conflicts between the adopted authenticated hierarchy and the preserved public/private or coach-tab contracts.
- Application tests are not applicable because this ticket changes only the authoritative contract and work records.

## Implementation record

Implementation started and completed on 2026-10-12 after confirming that the visible legacy UI is expected under COR0017's public-only boundary and that no current ticket owns the approved authenticated preview.

### Changes and rationale

- Added confirmed decision C29 and matching scheduling, definition-of-done and acceptance language requiring one coherent authenticated presentation across `My sessions`, `Coach workspace` and Profile while retaining current routes, actor permissions, image privacy and scheduling behavior.
- Resolved the approved preview against existing product decisions. Its visual hierarchy and MovX tokens are adopted; sample people, dates, messages, counts, notes controls and its illustrative four-tab coach navigation are not. The real coach workspace continues to use stable `Profile → Schedule → Bookings` navigation.
- Created COR0018 as a separate authenticated redesign workstream because COR0017 and DEV0201 are explicitly public-marketplace work. The direct work map assigns the shared shell, client sessions, coach Schedule, coach Bookings, Profiles and final integration to DEV0203-DEV0208 exactly once.
- Advanced the independent work-record namespaces to DEV0209 and COR0019 and linked the public and authenticated coordination records without changing their membership.

### Affected files

| File or component                               | Change and purpose                                                                                                      |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `docs/mvp-spec.md`                              | Adds the confirmed authenticated visual contract to decisions, behavior, definition of done and acceptance scenarios.   |
| `tickets/current/organisatory/COR0018-*.md`     | Defines the complete flat authenticated redesign work map, dependencies, shared boundaries and completion conditions.   |
| `tickets/current/frontend/DEV0203-DEV0208-*.md` | Assigns private shell, My sessions, Schedule, Bookings, Profiles and final accessibility to small implementation peers. |
| `tickets/README.md`                             | Indexes COR0018/DEV0202-DEV0208 with current statuses and advances both next-ID counters.                               |
| `tickets/current/organisatory/COR0017-*.md`     | Identifies COR0018 as a separate authenticated follow-up rather than public-redesign scope.                             |
| `tickets/current/frontend/DEV0201-*.md`         | Records the separate private-interface follow-up without expanding the reviewed public accessibility ticket.            |

### Decisions and deviations

- Use a separate COR0018 workstream instead of expanding DEV0201, whose reviewed scope is public accessibility/integration polish.
- Preserve the real coach Profile/Schedule/Bookings information architecture rather than adopting the preview's illustrative Schedule/Requests/Profile/Locations tabs.

### Contracts, configuration, and operations

This ticket changes product/interface requirements and work ownership only. It introduces no runtime interface, data shape, dependency, environment variable, migration or deployment step.

## Validation results

- `npx prettier --write` formatted the specification, index, both affected coordination records and DEV0201-DEV0208; `git diff --check` passed.
- A targeted Node.js validator resolved 263 local Markdown links across the twelve affected documents. It confirmed exactly one heading for COR0018 and DEV0202-DEV0208, reciprocal coordination membership for all seven direct DEV records, one index row per new DEV, and next IDs DEV0209/COR0019.
- The same validator confirmed the authoritative specification retains stable `Profile → Schedule → Bookings` navigation, requires one modern authenticated hierarchy and prohibits visual work from changing routes, actor permissions, privacy boundaries or authoritative actions.
- Application, browser, database and build checks were not run because this ticket changes only requirements and work records. Runtime validation is assigned to DEV0203-DEV0208.

| Criterion | Evidence                                                                                                                                          | Result |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | C29 plus scheduling/definition/acceptance updates require coherent private presentation while retaining routes, permissions, privacy and actions. | Passed |
| AC2       | Specification and COR0018 explicitly preserve Profile/Schedule/Bookings and reject preview-only sample content as authority.                      | Passed |
| AC3       | COR0018 maps contract, shell, sessions, Schedule, Bookings, Profiles and polish exactly once to DEV0202-DEV0208 with explicit sequence.           | Passed |
| AC4       | Prettier, diff, 263-link, heading, reciprocal-membership, index-count, next-ID and contract-phrase checks passed.                                 | Passed |

## Risks, limitations, and follow-ups

- Runtime visual parity remains deliberately owned by DEV0203-DEV0208; completing this contract does not change the visible app. DEV0203 is the first ready visible implementation.
- The external preview is not a durable runtime dependency. The specification and direct tickets must be sufficient for implementation without it.

## Completion and review references

- Completed: 2026-10-12.
- Commit: This completed record is included with the documentation commit whose subject references DEV0202.
- Review: Contract interpretation reviewed against the approved preview and current specification; no independent review created.
- Deployment or release: Not applicable — documentation/planning only.
