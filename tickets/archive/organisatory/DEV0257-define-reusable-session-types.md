# Ticket DEV0257: Define reusable session types

- Status: Completed
- Created: 2026-10-16
- Last updated: 2026-10-18
- Milestone: M11 — Session types and flexible bookings
- Coordination: [COR0029 — Session types and flexible bookings](COR0029-session-types-and-flexible-bookings.md)
- Related records: proposed amendment to [COR0023 — Coach calendar and availability](COR0023-coach-calendar-and-availability.md); historical contract [DEV0251](DEV0251-define-coach-calendar-and-availability.md); existing shared booking titles [DEV0248](../frontend/DEV0248-add-shared-session-titles-and-message-filtering.md); existing group lifecycle [COR0021](../../current/organisatory/COR0021-group-training-and-events.md).

## Objective and context

Define the user's requested session-type extension after the calendar/availability discussion. A **session type** is a reusable coach-owned category or template, such as Boxing technique or BJJ fundamentals, rather than one dated training session. Types could organize calendar labels, colors and filtering and prefill repeated details. Their exact visibility, duration and scheduling effects remain under discussion.

On 16 October 2026, after the Everfit explanation, the user explicitly requested adding a ticket or updating the existing ones. Reuse this Draft as the session-type planning record and link it from COR0023; do not allocate a duplicate ticket. That instruction authorizes recording the proposal, not silently resolving the previously open duration or athlete-selection choices.

The current [calendar contract](../../../docs/mvp-spec.md#18-coach-calendar-and-effective-availability) explicitly excludes service templates and retains one-hour private sessions. This Draft proposes an amendment; it does not silently override that specification or reopen archived DEV0251. Existing private/group format, discipline, actual venue, lifecycle status and optional shared booking title remain distinct concepts. A shared title names one private booking and may be edited by either participant; it is not a reusable coach-owned type.

### Reference evidence

Reviewed Everfit's official [Booking Calendar guide](https://help.everfit.io/en/articles/14075657-booking-calendar) on 16 October 2026. It describes reusable session templates, a selected calendar color, optional selection during booking and archival that preserves already scheduled sessions. MOVX adoption does not include Everfit credits, self-booking, team administration or external synchronization by association.

Follow-up official-source clarification after the user asked how Everfit works:

- [Trainer booking guide](https://help.everfit.io/en/articles/15931737-trainers-manage-your-bookings): a type defines service defaults including name, color, duration, location, description and booking rules. Coaches choose a type or custom session when scheduling. Client self-booking separately requires an enabled type, assigned trainer and client access; credits are additionally required only when configured.
- [Booking Calendar guide](https://help.everfit.io/en/articles/14075657-booking-calendar): documented examples have different durations (60-minute personal training and a 30-minute check-in), so Everfit has no universal one-hour duration. The guide does not establish every allowed numeric duration or increment; those limits were not verified.
- [Availability guide](https://help.everfit.io/en/articles/16245892-booking-availability-trainers): a type can use default availability or one/multiple assigned schedules. Different services can have dedicated hours. Date overrides replace hours within their Everfit schedule; MovX's previously confirmed whole-coach day-off rule remains its own contract.
- [Self-booking guide](https://help.everfit.io/en/articles/15431879-enable-client-self-booking): session length is distinct from start-time spacing, with 15-/30-/60-minute spacing options and separate before/after buffers. Effective hours and existing sessions/calendar conflicts constrain available starts. This older guide phrases credits as required; the trainer/owner guides explicitly make that requirement conditional on the type setting, so do not infer a mandatory-credit MOVX model.
- [Coach mobile guide](https://help.everfit.io/en/articles/17430864-manage-bookings-on-the-coach-mobile-app): duration/location/description can be changed for an individual booking without changing the saved type. [Owner guide](https://help.everfit.io/en/articles/15930159-owners-admins-manage-multi-coach-booking) says template edits affect future bookings while existing scheduled details remain.

These facts describe Everfit, not decisions to add variable durations, service selection or buffers to MovX.

The live Session Types screen was not re-inspected in this turn. Automatic approval review rejected the browser-control documentation refresh as unrelated/unauthorized; used the official guide as the read-only alternative. No session type or account setting was changed in Everfit.

## Adopted continuation — 18 October 2026

The user confirmed type-first athlete booking, 60/75/90-minute offerings, coach scheduling for an existing client and individual-booking overrides. The latest instruction retains default Private session and Group session types while allowing removal. The earlier proposals and pending choices below are historical planning context; the authoritative adopted target is [specification section 18.6](../../../docs/mvp-spec.md#186-session-types-and-flexible-bookings).

Adopted defaults and rationale: 15-minute starts and zero buffers keep duration independent from start spacing; soft archival preserves scheduled history; explicit restoration and an empty catalog avoid forced defaults. Defaults are created only with a new coach profile, with an explicit owner action for existing coaches, so retained/demo data is never backfilled. Type format is immutable; edits are revision-checked; request/booking terms are snapshots. On-behalf scheduling requires an accepted same-dataset athlete connection. New requests/acceptance and group registrations stop when their type is archived; confirmed sessions and existing enrollment remain accessible. No prices, credits, payments, automatic emails or external calendars are added.

[COR0029](COR0029-session-types-and-flexible-bookings.md) assigns every runtime deliverable exactly once to DEV0340–DEV0346. DEV0257 remains the contract owner because its historical planning commit already exists; it is not converted or retired. COR0023 remains a completed baseline. The seven new runtime peers contain their scope, edge cases, dependencies, acceptance and validation before implementation; the COR work table supplies order, parallel branches and completion conditions.

## Scope and non-goals

- In scope for this ticket: confirm the session-type purpose/fields/visibility/duration with the user; review interactions with weekly/date availability, private/group sessions, shared titles and calendar presentation; adopt a specification amendment when settled; assign required runtime work to flat peers under the appropriate coordination and validate ownership/documentation.
- Out of scope: application/schema/migration/dependency changes, runtime delivery, editing Everfit, imports, payment/credit rules, external calendar integration, deployment or commits. Runtime tickets are created or revised only after this contract's unresolved scope is settled.

## Expected behavior and edge cases

Proposals for discussion, not adopted requirements:

- A coach creates reusable types with a name, plain-text description, calendar color and optional default active owned venue. Examples: Boxing technique, BJJ fundamentals or Competition preparation. Decide private/group applicability before implementation; the custom label never grants booking, capacity or group-publication authority.
- An applicable type may prefill a new availability range or group draft, where actual venue/time and required group details are still reviewed. A template default is not itself published availability or a reservation, and an inactive venue requires explicit replacement rather than silent substitution.
- Calendar events can display/filter by type. Keep type name, venue, private/group format and lifecycle status readable independently of color; do not remove current actual-venue text/number cues or represent an Open group as Confirmed.
- Type changes/archival must not silently change existing session terms, identities or snapshots. Archived types disappear from new assignments while retained sessions remain recognizable; decide how explicit relabeling and restoration work before adoption. Existing untyped inventory/bookings retain a truthful fallback rather than invented historical types.
- A session type is distinct from DEV0248's participant-edited shared booking title and from session plans/notes. Template descriptions must not become shared training notes or private medical/athlete content by automatic copying. Type management remains coach-owned even if selected labels are later public.
- Athlete service selection would require a deliberate public catalog/request contract, including which types are offered in each time range and what happens to pending requests when that offering changes. Coach-only organization avoids making a new public selection promise.
- Variable private durations would replace the current one-hour generation, range, request and conflict assumptions. If selected, explicitly define increments, buffers, overlap/reservation, recurrence, override and migration/recovery before runtime implementation; a duration field alone is insufficient.

### Working proposal to review

Start with coach-managed reusable templates and calendar organization: create/edit/archive a type, choose its name/description/color and optional default venue, assign an applicable type deliberately when preparing availability or a new session, and show its name/color in calendar summaries with a type filter. Examples are Boxing technique and Competition preparation. Type management and athlete visibility are separate decisions: a coach-managed type need not be hidden from participants, and displaying its label does not require an athlete service picker.

The 18 October 2026 continuation confirms offered private-session lengths of 60, 75 and 90 minutes. Use 60 minutes as the proposed default and 15-minute possible start intervals as the proposed implementation default. Actual available starts must fit the selected duration and current availability/conflicts. Do not introduce a duration field that changes only its label while still reserving one hour. Athlete service selection, buffers and per-booking duration/venue overrides remain separate choices. These are target requirements; current private booking still enforces one hour until its runtime integration is delivered.

Template edits apply to later selections by default; already scheduled sessions keep the reviewed details they copied. Archiving prevents new selection and preserves existing sessions/history. Existing untyped records retain a fallback. Resolve explicit relabeling, restoration, default-venue deactivation and private/group applicability before implementation. Reuse the existing shared booking title and note permissions independently rather than replacing those fields with the type name/description.

### Potential integration map

This is an impact review, not an adopted runtime work map or new coordination membership. The current owners below retain their existing scope until the amendment is settled.

| Potential part                              | Existing consumer or required future owner                                                                                                                               | Review before adoption                                                                                                                                           |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Coach-owned type persistence and management | New small runtime peer ticket(s), not created yet                                                                                                                        | Define actor scope, fields, revisions/retries, archive/history snapshots and management interface; this documentation ticket implements none of them.            |
| Availability/template assignment            | [DEV0252](../backend/DEV0252-persist-effective-coach-availability.md) and [DEV0253](../frontend/DEV0253-edit-weekly-hours-and-date-overrides.md) are potential consumers | Define whether weekly/date ranges offer a type, how changes affect pending attempts and how type duration interacts with occupied hours and whole-day overrides. |
| Calendar organization                       | [DEV0254](../frontend/DEV0254-add-private-and-group-coach-calendar.md) is the potential consumer                                                                         | Add type labels/filter and color precedence without losing actual-venue cues, private/group format, lifecycle state or complete paging.                          |
| Athlete-facing labels or service selection  | [DEV0255](../frontend/DEV0255-browse-thirty-day-private-availability.md) is a conditional consumer                                                                       | Decide label visibility separately from service selection; retain the current request flow until a public amendment is adopted.                                  |
| Group template use                          | [DEV0239](../frontend/DEV0239-add-coach-group-session-management.md) under external COR0021 is a potential consumer                                                      | Decide group applicability and draft prefilling; preserve publication review, capacity, deadlines, frozen terms and existing group ownership.                    |
| Integrated proof                            | [DEV0256](../backend/DEV0256-rehearse-calendar-and-availability.md) is the potential consumer                                                                            | Once adopted, cover assignment, filtering, type edits/archival, old untyped history, permissions and any selected duration/public changes in real flows.         |

## Assumptions, decisions, and dependencies

Confirmed: on 16 October 2026 the user requested considering Everfit-style session types to help coaches organize the calendar.

Confirmed documentary action: after the explanation, the user asked to add a ticket or update the current records. This Draft and COR0023's proposed-amendment link satisfy that action; it does not add session types to the adopted M9 work map yet.

Historical 16 October follow-up, before the 18 October continuation below:

1. Tentative preference: coach templates and labels first, explicitly subject to understanding Everfit's behavior. Athlete-facing selection and whether labels are visible in session details remain undecided; coach-managed does not necessarily mean hidden from athletes.
2. Duration remains undecided. The user asked how Everfit works rather than selecting one-hour or variable-duration private sessions. Explain duration versus start-time spacing before asking for adoption.

Proposed starting fields: name, description, color and optional default venue. Type assignment, private/group applicability, public visibility and edit/archive snapshots remain proposals. No complete field list or booking interaction is attributed to the user yet.

### 18 October 2026 implementation assessment

The user authorized starting DEV0257 after reviewing Everfit and explicitly selected 60-, 75- and 90-minute offerings. They asked for more context before selecting athlete-facing session types versus coach-only templates. The remaining booking-flow choice is open:

- Public types: coach offers Boxing technique · 75 min or Fitness · 90 min; athlete chooses that offering, then an available time, then requests coach confirmation.
- Duration-first alternative: athlete chooses 60/75/90 minutes and a time; named templates remain internal to the coach.
- Coach-assigned appointment: coach sets each offering's type and length while preparing availability; athlete chooses a published appointment without a separate service picker.

Public type selection is the recommendation, not a confirmed user choice. Pending the answer, no schema or API contract assumes which of these flows will ship. Private/group applicability, buffer defaults and template-snapshot/history rules must be explicitly bounded in the final contract. No billing, credit system or automatic private booking follows from the Everfit reference.

Read-only review found existing one-hour checks in effective availability, request projections and SQL acceptance. Supporting 75/90 minutes therefore requires coordinated inventory, request and reservation/conflict changes. The older generic duration field in availability code is not evidence of a completed variable-duration client flow. Existing cross-venue private/group reservations and whole-day overrides must continue to protect coach time.

Concurrent work modifies coach profile/public routes, availability entry actions and navigation; it is an integration consideration, not a blocker to a separate type-catalog foundation. Preserve those edits. Plan a new flat coordination record with this existing contract ticket and peer owners for persistence/API, coach type management, variable-duration authority, availability assignment, public booking selection, calendar presentation and integrated proof. This ticket already has committed planning evidence and must be preserved rather than converted/retired. Do not reopen completed COR0023 or implement runtime under this contract ticket. Allocate runtime IDs only after rechecking the live index when their boundaries are settled.

Retained demo data follows the current specification and AGENTS.md: no startup provisioning, marker-based resets, fixture edits, broad seed replay or credential rotation. Use disposable datasets or uniquely tagged temporary accounts for future runtime validation.

COR0023's effective availability/editor/calendar/public/rehearsal peers remain separately owned. If adopted as M9 work, add this contract ticket and any new runtime peers to that COR's work map with reciprocal membership; update affected pending peer scope before implementation. Preserve DEV0251 as the completed historical baseline. Existing group capacity/lifecycle and original shared-title/note permissions remain independent. Read actual current IDs/statuses/migrations before allocating runtime records.

Scope review: this DEV owns one documentation amendment and its work-map reconciliation. It does not authorize implementing session-type persistence, management and calendar integration under one broad planning record. Split runtime into small flat peers and update existing owners' integration contracts without duplicating their deliverables.

## Implementation plan

1. Record the user's intent, reference evidence, proposed model and two pending decisions in this Draft; reserve the identifier in the index.
   Maintain this existing ticket for the requested documentary update, add the working proposal/potential-consumer map and label COR0023's link as a proposed amendment outside its direct delivery scope. Do not broaden any runtime peer or the specification before the open choices are settled.
2. Resolve the questions, adopt bounded fields/assignment/privacy/history rules and record defaults separately from user decisions. Mark In progress before adopting the specification amendment.
3. Update section 18 and applicable decisions/state/acceptance/milestone references; map type persistence/management and existing availability/calendar/public/rehearsal integration to explicit peers. If variable durations/public services are selected, review the broader scheduling contract before treating existing one-hour peers as implementable.
4. Validate links/anchors, unique/reserved IDs, metadata/index and reciprocal/exclusive coordination ownership plus concrete type archive/edit/venue/history examples. Complete/archive only after the amendment and work map satisfy this ticket's criteria.

## Acceptance criteria

- [x] AC1: Purpose, fields, assignment, coach/athlete visibility, private/group applicability and private-duration decision are confirmed or explicitly adopted defaults, with no unresolved material behavior.
- [x] AC2: The specification consistently defines types separately from individual shared titles, private/group lifecycle, actual venues and calendar/status cues, including archival/edit/history/retry/access behavior.
- [x] AC3: A flat work map assigns all runtime parts and existing-peer integrations once, with dependency/start conditions and meaningful migration/privacy/scheduling/recovery/visual validation.
- [x] AC4: Documentation links/anchors, IDs/index/statuses, ownership, formatting and whitespace pass; planning evidence never claims runtime delivery.

## Validation plan

For this documentation ticket, review examples of reusable type selection, existing untyped records, changing/archiving a type with future bookings, inactive default venue, unauthorized type management, type versus shared-title edits, private/group capacity and color-independent calendar filtering. If selected, additionally resolve public service eligibility or variable-duration conflicts before adoption.

Run targeted installed Prettier, relative-link/anchor and namespace/metadata/index checks and `git diff --check`. Application tests, database migrations, runtime browser rehearsals, lint/type/build do not apply to this Draft-only change. Runtime peers must own meaningful database/permission/history/concurrency and responsive/keyboard tests for the adopted model.

## Implementation record

Contract adopted on 18 October 2026. Section 18.6 records confirmed choices separately from adopted defaults and current delivery. COR0029 and DEV0340–DEV0346 define exclusive runtime ownership; no runtime changes are implemented by this documentation ticket.

### Changes and rationale

Created a new Draft to capture the session-type request without silently rewriting DEV0251's completed template exclusion or treating a calendar-organization suggestion as consent to new public services or variable durations. Recorded the official-reference evidence and pending decisions. After the user asked for an Everfit explanation, expanded the reference record to cover per-type defaults/duration, assigned availability, optional client self-booking, per-booking overrides and archival. Retained the templates-first answer as tentative and duration as undecided.

Following the user's explicit ticket/update request, expanded this existing record with a concrete template-first working proposal and a potential integration map. Linked the proposal from COR0023 as an independent amendment, preserving the six existing direct owners and their adopted one-hour runtime scope. No duplicate ticket or unrequested feature implementation was created.

### Affected files

| File                                                  | Change and purpose                                                                                                      |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| This ticket                                           | Owns the proposed specification amendment, questions and future delivery planning.                                      |
| [Ticket index](../../README.md)                       | Reserves DEV0257 and exposes its Draft status.                                                                          |
| [COR0023](COR0023-coach-calendar-and-availability.md) | Links the proposed amendment separately from direct delivery ownership, with a scope-review note before integrating it. |

### Decisions and deviations

2026-10-16: The user requested session types for calendar organization after the original calendar plan completed. This is a new proposed amendment, not a correction to what was previously confirmed. The subsequent answers asked for Everfit clarification; no new product choice was promoted to confirmed. No adopted contract or runtime deviation yet.

2026-10-16 documentary update: the user requested a ticket or updates to current ones. Kept DEV0257, added the concrete proposal/integration review and linked it from COR0023 rather than adopting unconfirmed variable durations or creating another planning record. Status stays Draft because material feature choices remain unresolved; this is not an extra permission gate for the authorized documentation work.

### Contracts, configuration, and operations

None changed. No new dependency, environment variable, schema, migration, public service catalog, duration model or deployment was introduced by this Draft.

## Validation results

18 October 2026 decision checkpoint:

- Read-only source review confirmed that public request projection still requires a one-hour interval and effective-availability SQL materializes one-hour occurrences. The generic legacy duration choices alone do not satisfy the new end-to-end requirement.
- Inline Python checks passed: exactly one current DEV0257 record, In progress status and matching index entry, 13 existing repository-relative ticket links, one new specification subsection, explicit confirmed 60/75/90-minute target and pending athlete flow. Existing historical planning and the closed COR0023 record were preserved.
- `node_modules/.bin/prettier --check tickets/current/organisatory/DEV0257-define-reusable-session-types.md` initially found style differences after the additions. Formatted only this ticket and reran the check successfully. Shared specification/index tables were not broadly reformatted. `git diff --check` passed after the final record update.
- Application tests, database operations, browser tests, lint/type/build and runtime peer creation are not applicable to this documentary decision checkpoint. No feature delivery, migration, retained-data mutation, external review or deployment is claimed. AC1–AC3 remain incomplete while athlete selection and the delivery boundaries are being settled; AC4's checkpoint consistency checks pass and final ownership checks await that work map.

Initial Draft documentation checks passed on 16 October 2026 in the local repository:

- `python3 /tmp/dev0257-check-planning.py`: passed 191 local links, 8 section anchors, 165 unique DEV/COR records, template/metadata/index consistency, tentative-decision checks and next IDs DEV0258/COR0024.
- `./node_modules/.bin/prettier --check tickets/current/organisatory/DEV0257-define-reusable-session-types.md tickets/README.md`: passed.
- `git diff --check`: passed. Scope self-review confirmed only this Draft/index addition, unchanged specification behavior, tentative coach-template preference and undecided duration. Archived DEV0251 remains historical; no new runtime record or implementation was created.
- Application tests, migrations, runtime browser rehearsals, lint/type/build were not run because the change is planning documentation only. The official guide/current specification/shared-title/group-model reads are reference investigation, not proposed-feature validation. Live Session Types inspection was not performed; the read-only official-guide fallback completed the behavior research.

Requested ticket-update validation on 16 October 2026:

- `python3 /tmp/dev0257-check-update.py`: passed three affected documents, 217 local links, 9 anchors, 165 unique DEV/COR records, Draft/index/template consistency, tentative duration/visibility checks, six unchanged COR0023 direct owners and next IDs DEV0258/COR0024. Confirmed DEV0257 appears as a proposed amendment outside the direct work map.
- `./node_modules/.bin/prettier --check tickets/current/organisatory/DEV0257-define-reusable-session-types.md tickets/current/organisatory/COR0023-coach-calendar-and-availability.md tickets/README.md` and `git diff --check`: passed.
- Self-review mapped potential consumers without assigning unadopted runtime scope or modifying the specification, application, archived contract or existing six-peer ownership. Application/database/browser/static/build checks remain not run for this documentation-only update; unresolved product choices keep this ticket Draft.

| Criterion | Evidence                                                                                                                     | Result             |
| --------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| AC1–AC3   | User decisions, adopted specification and runtime ownership remain pending.                                                  | Not run            |
| AC4       | Draft links/anchors/IDs/metadata/index/formatting/whitespace passed; adopted contract/ownership validation awaits decisions. | Partially verified |

## Risks, limitations, and follow-ups

Type colors can conflict with existing venue/status cues; use text/shape/legend and preserve actual venues. Applying type edits to existing sessions can change perceived promises, and variable durations affect the whole availability authority. Keep those choices explicit. No live Session Types screen behavior or populated-session interaction was verified.

16 October handoff (historical): the requested documentary update captured the explanation, working proposal and potential integrations, and COR0023 linked it as a proposed amendment. No specification/runtime change or new runtime record existed then; duration and athlete visibility remained open.

18 October handoff: duration options are confirmed; awaiting the athlete booking-flow answer after providing concrete examples. Record that answer, settle the bounded first slice and create a separate coordination/work map with runtime peer tickets. No runtime files, migrations, retained accounts or credentials have changed under this continuation. No external technical dependency currently prevents contract/foundation work; full booking integration depends on resolving the flow and replacing the one-hour scheduling assumptions safely.

## Completion and review references

2026-10-16 commit preparation: the user authorized committing the planning checkpoint and starting the calendar. Include these interlinked plans and the required completed DEV0238 guard; exclude independent session-note adoption/runtime work. Shared specification/index staging uses scoped snapshots. Fresh `npm test` passed 155 application and 16 server tests; `npm run typecheck` passed. Staged links/scope/format/whitespace are checked separately before commit; no new database or deployment claim is made.

- Completed: 2026-10-18 — contract and flat runtime work map adopted; final contract review below owns the evidence. Earlier checkpoint/handoff notes remain historical context.
- Commit: User-authorized checkpoint — `[DEV0238][DEV0251][DEV0257][DEV0258][DEV0259] Checkpoint schedule authority and plans`; runtime delivery status remains as recorded above.
- Review: Official-reference/current-contract self-review; no independent/runtime review.
- Deployment or release: None.

### 18 October adoption record

Changed this ticket, specification section 18.6/milestone M11, the ticket index, COR0029 and seven runtime peer records. The reason is the now-confirmed type-first booking and removable private/group defaults. Contracts change as the target described above; no environment variables, deployed migrations, dependencies or retained-account changes occur in this ticket. Link, identifier, ownership and formatting validation follows before archival.

### Final contract review — 18 October 2026

AC1–AC3: adopted section 18.6 covers fields, type-first selection, immutable format, 60/75/90-minute intervals, archive/edit/history/venue behavior, defaults, permissions, coach overrides and group/calendar integration. COR0029 maps each runtime deliverable once to DEV0340–DEV0346, with prerequisites and combined evidence owned by DEV0346. All eight DEV metadata fields link exclusively to COR0029. No runtime delivery or deployment is claimed by completion of DEV0257.

AC4: targeted Prettier, link/anchor and ID/ownership validation are recorded with the final command results. Application/database/browser tests are not applicable to this contract-only ticket; those checks belong to the runtime peers.

Validation: `python3 work/dev0257/validate.py` passed nine records, 46 relative links/anchors and 259 unique live/archive identifiers; targeted installed Prettier passed. All eight direct DEV metadata fields agree with COR0029. Whitespace is checked with the runtime handoff; no runtime evidence is claimed here.

2026-10-18 documentary consistency correction under DEV0346: synchronized the completion reference with this record's Completed metadata and final contract review. Historical planning notes and runtime ownership are unchanged.

### Authorized commit checkpoint — 18 October 2026

The completed contract/runtime peers and DEV0348 profile compatibility repair share new domain types, public page/service imports and booking projections. They are committed together to keep the checkpoint buildable; each ticket retains its own scope/evidence. Active Auth and directory-card edits are excluded using an isolated Git index and exported candidate tree.

Exact candidate validation under Node 24.21.0: `node --import tsx --test tests/*.test.ts` passed **301 unit tests**; `node --import tsx --conditions=react-server --test tests/server/*.test.ts` passed **51 server tests** (352 total, zero failures/skips). Scoped ESLint and Prettier passed. `NEXT_TELEMETRY_DISABLED=1 node node_modules/next/dist/bin/next build --webpack` passed compilation, TypeScript, page generation and optimized production output. This suite count describes the isolated checkpoint; earlier larger shared-workspace counts include separate pending tests and are retained as historical evidence. Database/browser and preserved-data results above remain the evidence for those acceptance criteria; no code changed after candidate validation. Candidate Markdown review resolved 559 file links, with only the two intentionally untracked private tester journals handled outside Git. Final namespace, archive/index, dependency and whitespace checks passed.

Commit reference: `[DEV0257][DEV0340][DEV0341][DEV0342][DEV0343][DEV0344][DEV0345][DEV0346][DEV0348] Add session types and preserve public profiles` (this checkpoint). No hosted schema rollout, application deployment or independent review is implied.
