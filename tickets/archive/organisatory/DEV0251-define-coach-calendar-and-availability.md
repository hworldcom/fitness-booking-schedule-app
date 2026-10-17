# Ticket DEV0251: Define coach calendar and availability

- Status: Completed
- Created: 2026-10-16
- Last updated: 2026-10-16
- Milestone: M9 — Coach calendar and effective availability
- Coordination: [COR0023 — Coach calendar and availability](COR0023-coach-calendar-and-availability.md)
- Related records: historical Schedule presentation [DEV0205](../frontend/DEV0205-redesign-coach-schedule.md); historical location-aware availability [DEV0177](../backend/DEV0177-bind-availability-to-training-locations.md); external runtime prerequisites [DEV0238](../backend/DEV0238-integrate-group-session-scheduling-conflicts.md) and [DEV0239](../frontend/DEV0239-add-coach-group-session-management.md) under [COR0021](../../current/organisatory/COR0021-group-training-and-events.md); independent workspace accessibility [DEV0208](../../current/frontend/DEV0208-polish-authenticated-workspace-accessibility.md).

## Objective and context

Define the MovX coach-calendar and availability extension after the user's review of Everfit, then map its runtime delivery to small peers. The delivered application edits location-assigned one-hour weekly cells and lists dated private times over seven days. The adopted target supplies mixed private/group Day/Week/Month calendar views, easier weekly ranges, whole-date availability replacements and a 30-day private publication horizon. A **dated occurrence** is an actual private-session time, distinct from its weekly template, an athlete's request and a confirmed booking.

The [single specification, section 18](../../../docs/mvp-spec.md#18-coach-calendar-and-effective-availability), owns the target behavior, [M9](../../../docs/mvp-spec.md#12-delivery-milestones) and [acceptance scenarios](../../../docs/mvp-spec.md#13-acceptance-matrix). This ticket owns documentation and delivery planning only. Runtime, schema, migrations, dependencies and deployment are not delivered by it.

### Reference inspection

On 16 October 2026, inspected the user's existing authenticated Everfit tab in native Chrome:

- Calendar: dated weekly time grid, Today/previous/next navigation, Day/Week/Month selector, timezone, current-time marker, trainer/client filters and Add/Customize/Connect Calendar controls. The displayed calendar was empty; populated event interaction, drag/reschedule behavior and external synchronization were not tested.
- Availability: a dated week overview with colored availability blocks and a schedules panel. Opening Workspace Hours displayed weekday switches, start/end fields, add-range and copy controls, timezone and an explicit Save action.
- Date overrides: inspected the Add dialog with date selection, custom hours, all-day unavailability and Cancel/Save. Cancelled without saving; no Everfit schedule was changed. Initial navigation stalled; direct navigation/reload later rendered the Availability overview, editor and dialog successfully.
- Cross-checked Everfit's official [Booking Calendar](https://help.everfit.io/en/articles/14075657-booking-calendar) and [Booking Availability: Trainers](https://help.everfit.io/en/articles/16245892-booking-availability-trainers) guides. The latter documents date-specific replacement hours, days off and preservation of existing bookings. Reference behavior is design input, not automatic adoption of Everfit's product model.

## Scope and non-goals

- In scope: preserve inspected findings and confirmed choices; adopt clearly labelled operating defaults; reconcile the specification's state/permissions/cancellation/recovery, horizon, group overlay, milestone and acceptance matrix; add README target navigation; create COR0023 and five peer runtime tickets; validate documentation and ownership.
- Out of scope: application/schema/migration/dependency changes; real calendar/editor/public-date runtime; implementing existing M7 work; external calendar integration, variable-duration services, credits/payments, team administration, notifications, booking drag/reschedule and deployment. No commit was requested.

## Expected behavior and edge cases

The authoritative [section 18](../../../docs/mvp-spec.md#18-coach-calendar-and-effective-availability) defines the adopted contract. Coach Schedule separates Calendar and Availability inside the existing frame. One-hour, coach-approved private sessions retain actual venues and original authorized detail workflows. Calendar combines actual private occurrences/bookings and published group sessions; requests remain owner-only counts on open times and groups retain their distinct lifecycle.

Weekly/date saves are explicit and versioned. Whole-date replacements cover every venue. A day off or changed range saves while booked private/group sessions remain occupied with clear warnings; it never silently cancels or moves them. Removed/reassigned open hours close affected requests/cards atomically. Explicit restoration can create fresh eligible policy-successor occurrences while old occurrences/attempts and manual closures stay terminal. Cancellation cannot reopen a retained booking's obsolete venue or overridden day-off capacity. The 30-local-date horizon is authoritative without coach visits; month navigation never invents private inventory beyond it. All venue/time/actor/revision/group conflict checks remain server/database authority.

Examples reviewed for adoption:

- Monday 09:00–12:00 at venue A can be replaced for one date by 10:00–12:00 at venue B; other Mondays retain the normal week. A whole day off leaves neither venue's open private hours available.
- A 09:00–12:00 venue-B override with an existing 10:00–11:00 venue-A booking saves and warns; only eligible 09:00 and 11:00 venue-B private times publish. The booking keeps its original venue/identity. Cancelling it does not reopen venue A when current policy disallows that venue.
- Removing an override explicitly previews the current weekly hours; eligible policy-closed time returns through fresh occurrence identities. Old request cards remain terminal, manual closures remain closed and unrelated dates are unchanged.
- An Open published group beyond the old seven-day window remains an occupied group block with its true status; later private materialization cannot overlap it. An uncreated private hour may become eligible after group release; withdrawn history does not revive.
- The private horizon is today plus 29 Berlin local dates, not a fixed 720-hour interval. Public reads/request mutations reconcile it without opening Schedule. Month overflow opens a complete day agenda and late-window dates remain publicly reachable.

## Assumptions, decisions, and dependencies

### Confirmed by the user on 16 October 2026

1. Include a calendar, easier weekly editing and date-specific hours/days off; a visual-only redesign is insufficient.
2. Athletes may see and request private-session availability 30 days ahead, replacing the current seven-day target.
3. Include Day, Week and Month views, with Week as the default.
4. Show the coach's private sessions and coach-led group sessions together on the calendar.
5. A date override replaces the entire day's availability across all venues, rather than affecting only one selected venue.
6. Save an override even when existing booked sessions fall outside its hours; retain those sessions and show a clear warning instead of requiring their cancellation or rescheduling first.

### Adopted operating defaults

These are implementation choices, not additional user confirmations: retain existing one-hour starts and Berlin timezone; use local-date horizon boundaries; whole weekly/date local drafts with expected revision and exact retry; at most 31 dates per atomic override batch; preserve bookings/groups with warning data while withholding occupied private capacity; close affected pending requests/cards; distinguish manual/policy closure and use fresh explicit policy-restoration identities; recheck effective hours/venue/horizon on cancellation; period-limited/paged calendar reads, type/venue/history filters, three month summaries plus More/full agenda, mobile grouped agenda and dirty-draft save/discard/cancel. They make the confirmed model testable without copying Everfit's self-booking or team/credit features.

DEV0238 is an external shared-guard prerequisite, and DEV0239 owns the actionable group management destination. COR0021 retains M7 publication/lifecycle/roster/discovery; M8 Messages and COR0015 notes retain separate authority. Independent workspace edits are preserved. No unresolved product question remains for this contract; runtime peers still inspect actual installed versions, code, lock order and migrations before implementation.

Scope review: the complete runtime needs several peers, so DEV0251 owns only contract/planning and is not a runtime umbrella. COR0023 directly groups this documentation ticket and five runtime peers. Backend effective-policy mutations remain one atomic authority slice because publishing one writer before the others honor overrides/restoration would leave a request/reopen bypass. Calendar read projection is owned by its frontend vertical slice; public 30-day navigation has its own owner so it cannot be omitted. No DEV-to-COR conversion or retired ID is needed.

## Implementation plan

1. Preserve the initial Draft reference findings and confirm feature choices in conversation; keep proposals separate from confirmations.
2. Mark In progress before adopting section 18 and reconcile existing horizon/cancellation/state/permissions/group-overlay/definition-of-done/milestone/scenario references without altering independent M7/note content.
3. Create COR0023 and peers DEV0252 backend effective availability, DEV0253 coach editor, DEV0254 mixed calendar/read projection, DEV0255 public date navigation and DEV0256 integrated proof. Assign every deliverable once and record external prerequisites, independent starts and completion gates.
4. Validate documentation links/anchors, IDs/reservations/index/status, reciprocal membership, exclusive work-map boundaries and concrete recovery examples. Complete/archive this record only when those documentation criteria pass; keep runtime records open.

## Acceptance criteria

- [x] AC1: Six confirmed choices and adopted defaults are distinguished; date/range/retained-booking/request-closure/restoration/horizon examples have unambiguous results.
- [x] AC2: The single specification consistently defines the adopted 30-day Day/Week/Month private/group calendar and weekly/date editing contract, truthful delivery status and preserved authority/history/privacy.
- [x] AC3: A flat COR maps the complete outcome to small peer tickets with exclusive ownership, external M7 dependencies, independent starts and final integration gates.
- [x] AC4: Documentation formatting, links/anchors, namespaces/index/statuses, reciprocal ownership and whitespace checks pass with exact evidence; no runtime completion is claimed.

## Validation plan

Review the examples above against specification sections 5/7/9/15/18, including the consequential cancellation/effective-hours change. Validate every relative link/anchor in affected Markdown, unique DEV/COR records, next IDs/reservations, metadata/index statuses, reciprocal direct membership and complete ownership. Run targeted installed Prettier and git diff --check; inspect scope for accidental edits. Application tests/lint/type/build, migrations and runtime responsive rehearsals do not apply to documentation-only adoption; the runtime peers own those checks and DEV0256 owns combined real local proof.

## Implementation record

Contract adoption and delivery planning completed on 16 October 2026. Documentation checks passed; no M9 runtime implementation occurred.

### Changes and rationale

The initial Draft preserved Everfit findings and four choices. Subsequent conversation confirmed whole-day overrides across venues and saving with retained-session warnings, bringing the total to six. Those choices now appear in specification section 18 with operating defaults labelled separately. Reconciled C07/C18/C20/C39, request eligibility/cancellation, weekly/date publishing, scheduling model/permissions, definition of done, M9 and acceptance scenarios. In particular, cancellation now respects effective policy so a retained booking on a day off cannot accidentally publish new capacity.

Separated five runtime deliverables instead of implementing the broad extension under a documentation ticket. Added a dedicated public-navigation peer because a larger backend horizon alone would leave dates unreachable. Preserved M7 guard/publication ownership and made real group-detail links an explicit final calendar/rehearsal prerequisite. No application files or existing operational data were changed by DEV0251.

### Affected files

| File                                                                                    | Change and purpose                                                                                                                |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| [Specification](../../../docs/mvp-spec.md#18-coach-calendar-and-effective-availability) | Single adopted target, state/recovery/cancellation/horizon/permissions, M9 and acceptance scenarios with explicit runtime status. |
| [README](../../../README.md)                                                            | Navigation to the target and COR, without duplicating requirements.                                                               |
| [COR0023](COR0023-coach-calendar-and-availability.md)        | Flat ownership, external M7 dependencies, sequence/independent starts and integrated completion gates.                            |
| [DEV0252](../backend/DEV0252-persist-effective-coach-availability.md)                   | Effective-policy persistence/mutations, 30-day authority and migration/retry/concurrency proof.                                   |
| [DEV0253](../frontend/DEV0253-edit-weekly-hours-and-date-overrides.md)       | Coach range/copy/date editing, warning/closure/restoration previews and draft/error recovery.                                     |
| [DEV0254](../frontend/DEV0254-add-private-and-group-coach-calendar.md)                  | Bounded mixed calendar read/display/navigation, overflow/agenda and authorized detail links.                                      |
| [DEV0255](../frontend/DEV0255-browse-thirty-day-private-availability.md)     | Complete public 30-day date navigation and eligible request selection/recovery.                                                   |
| [DEV0256](../backend/DEV0256-rehearse-calendar-and-availability.md)          | Real local integrated command/fixtures/privacy/race/responsive/cleanup evidence.                                                  |
| [Ticket index](../../README.md)                                                         | Tracks every new record/status and reserves next IDs DEV0257/COR0024.                                                             |

### Decisions and deviations

2026-10-16: Draft → contract adoption after six explicit user choices. Whole-day override scope and retained-session save/warning were initially open and are now confirmed. Other mechanics were adopted using existing one-hour/venue/history/guard conventions and labelled as defaults, not retroactively attributed to the user. Added explicit cancellation-policy integration and a separate public navigation peer after scope review identified those otherwise missing deliverables. This remains documentation/planning scope; no runtime implementation was added. Final handoff also observed independent DEV0238 complete isolated validation and move to its archive; current plan links/dependency notes reflect that completed baseline while retaining its pending shared-stack rollout. Its runtime evidence is not attributed to DEV0251.

### Contracts, configuration, and operations

Product target changes from seven-day recurring-only private inventory to 30-local-date effective inventory and adds whole-date overrides plus a private/group coach calendar. API/data/revision/closure-provenance changes and migration/rollback requirements are planned under DEV0252/DEV0254, not implemented here. No installed dependency, environment variable, schema, migration, live account setting, deployment or secret changed. The current weekly-cell/seven-day application is explicitly documented as the delivered baseline.

## Validation results

Final adoption validation passed on 16 October 2026 in the local repository:

- `python3 /tmp/dev0251-check-adoption.py`: passed 10 affected documents, 302 local links, 44 anchors, 164 unique DEV/COR records, six reciprocal COR0023 owners, six confirmed choices, 39 specification decisions and next identifiers DEV0257/COR0024. Re-run after archival verified final links and Completed/Draft/index states.
- `./node_modules/.bin/prettier --check README.md docs/mvp-spec.md tickets/README.md tickets/archive/organisatory/DEV0251-*.md tickets/current/organisatory/COR0023-*.md tickets/current/{backend,frontend}/DEV025[2-6]-*.md`: passed for the final ten documents.
- `git diff --check`: passed. Scope/contract self-review traced every deliverable to one owner and checked horizon/DST, venue replacement, retained-session save warnings, cancellation on a day off, fresh policy restoration/manual closure, group release, public reachability and calendar privacy/overflow examples. Remaining seven-day references describe the delivered baseline, not the adopted target.
- Application tests, database migration/race tests, runtime browser rehearsals, lint, type checks and build were not run: DEV0251 changes documentation/planning only. Existing independently modified application files were not edited or validated as part of this ticket. Every runtime peer remains Draft with unchecked acceptance criteria, and COR0023 remains open.
- Earlier Draft checks passed 189 local links, 11 anchors and 158 records; those are historical checkpoints before adoption, not runtime evidence.

| Criterion | Evidence                                                                                                                                                                         | Result |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Six explicit choices, labelled defaults and concrete date/range/booking/closure/restoration/horizon examples reviewed.                                                           | Passed |
| AC2       | Specification section 18 plus C07/C18/C20/C39, flows/state/permissions/cancellation, M9, definition of done and acceptance scenarios agree; README links the undelivered target. | Passed |
| AC3       | COR0023 maps all six direct peers exactly once and records external M7 dependencies, independent starts, shared-file sequencing and final integration gates.                     | Passed |
| AC4       | Final link/anchor/namespace/metadata/index/membership/formatting/whitespace and scope checks passed; archived contract and open runtime status are explicit.                     | Passed |

## Risks, limitations, and follow-ups

All runtime acceptance work remains open under COR0023. Shared-stack rollout of the completed external M7 guard and separate group-detail delivery remain prerequisites for final mixed-runtime proof; they do not block this documentation task or independent later public-date work. Closure provenance/successor uniqueness, M7/M8 lock order, horizon rollover, calendar completeness and privacy require meaningful database/browser evidence in their owners. Planning completion implies no runtime release or hosted deployment.

## Completion and review references

2026-10-16 commit preparation: the user authorized committing the planning checkpoint and starting the calendar. Include these interlinked plans and the required completed DEV0238 guard; exclude independent session-note adoption/runtime work. Shared specification/index staging uses scoped snapshots. Fresh `npm test` passed 155 application and 16 server tests; `npm run typecheck` passed. Staged links/scope/format/whitespace are checked separately before commit; no new database or deployment claim is made.

- Completed: 2026-10-16 — adopted the calendar/effective-availability contract and complete flat runtime delivery plan; documentation checks passed.
- Commit: User-authorized checkpoint — `[DEV0238][DEV0251][DEV0257][DEV0258][DEV0259] Checkpoint schedule authority and plans`; runtime delivery status remains as recorded above.
- Review: Reference/source/contract planning self-review; no independent/runtime review.
- Deployment or release: None.
