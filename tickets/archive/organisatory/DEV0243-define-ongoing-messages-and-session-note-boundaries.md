# Ticket DEV0243: Define ongoing messages and session-note boundaries

- Status: Completed
- Created: 2026-10-15
- Last updated: 2026-10-15
- Milestone: M8 private messaging product contract
- Coordination: None — independent development ticket
- Related records: runtime consumer [COR0022](COR0022-private-messaging-and-booking-context.md) and its direct peers [DEV0244](../backend/DEV0244-persist-private-message-authority.md), [DEV0245](../backend/DEV0245-integrate-messages-with-scheduling-and-connections.md), [DEV0246](../frontend/DEV0246-add-private-mailbox-and-coach-contact.md), [DEV0247](../backend/DEV0247-rehearse-private-messaging-loop.md); separate note consumer [COR0015](../../current/organisatory/COR0015-session-notes-and-training-plans.md) with [DEV0182](DEV0182-adopt-session-notes-contract.md), [DEV0183](../../current/backend/DEV0183-persist-authorized-session-notes.md), [DEV0184](../../current/frontend/DEV0184-add-coach-session-workspace.md), [DEV0185](../../current/frontend/DEV0185-add-client-session-collaboration.md); completed request baseline [COR0016](COR0016-coach-confirmed-booking-requests.md); connection baseline [COR0020](COR0020-athlete-terminology-and-connections.md); design reference [DEV0242](../../current/frontend/DEV0242-preview-training-navigation-and-request-badges.md); account lifecycle [DEV0165](../../current/backend/DEV0165-implement-account-deletion-lifecycle.md)

## Objective and context

Adopt the user's ongoing private-mailbox direction in the single [MVP specification](../../../docs/mvp-spec.md#16-private-messages-and-session-notes), with session requests in one coach–athlete conversation and notes inside each original booking. The older COR0015 Draft proposed one conversation per pending request continuing into its accepted booking; reconcile that unfinished plan before runtime.

After reviewing who can initiate Airbnb messages and its distinction between booking communication and social Connections, the user instructed: “airbnb rules sound actually good for our purpose lets just copy it”. This resolves the earlier contact/disconnection discussion by adopting the researched contact/consent pattern, with explicitly labelled MovX defaults and the already-confirmed ongoing conversation retained.

## Scope and non-goals

- In scope: specification decisions/journeys/state/authority/privacy/M8/acceptance amendments; pre-request coach inquiries, independent service communication, general consent/removal/blocking, bounded message/read/recovery defaults; booking-note boundary reconciliation; written responsive interface proposal; COR0022/four peer runtime records and index allocation.
- This ticket implements the product/documentation contract only. No mailbox runtime, migration, environment, real messages, bookings or connections change.
- Out of scope: group messaging, arbitrary account outreach, attachments, typing, recipient-visible read receipts, AI/automated replies, reporting operations, notifications, payment, account retention policy, runtime note editors and deployment. Those Airbnb capabilities are not imported by a contact/consent decision.

## Expected behavior and edge cases

The authoritative behavior is [section 16](../../../docs/mvp-spec.md#16-private-messages-and-session-notes), not this record as a second contract. Concrete review cases:

- Max can ask a visible eligible coach a question before choosing a time. Authentication returns to composition without sending automatically. A subsequent saved request appears once in that same ongoing conversation and later references its original booking.
- Existing accepted connections can start general chat. An eligible unconnected pair instead needs recipient-approved message consent; sending or reading is not acceptance. Message consent accepts neither a connection nor a booking.
- Removing a connection retains history and resets general-message consent. Fresh message-request acceptance can resume general chat without reconnecting. Independent inquiry/request/booking communication remains available; removal is not a ban on all contact.
- Block is separate, removes connection grants and stops new contact/private request/acceptance. Only captured upcoming/active bookings retain their fixed scheduled-end-plus-14-days communication window; cancellation closes that booking's exception immediately. Replays/other contexts cannot extend it.
- Coach/athlete notes and the coach-authored plan remain booking-bound; coach-private notes remain separate. Shared note writes respect active block windows without revoking retained participant reads. No chat is copied into a note thread and no request creates a second note workspace.
- Request/card save and retry are atomic; paging, read-through positions, bounds, actor isolation and visibility-aware freshness prevent duplicate/missing cards, swallowed unread items and undocumented reloads. Other candidates/private note metadata never enter inbox projections.

## Assumptions, decisions, and dependencies

### Confirmed user constraints

- One ongoing private coach–athlete conversation spans sessions; session requests also appear there.
- Individual booking details contain coach/athlete notes. Previously accepted shared-plan and coach-private-note intent remains intact.
- Both saved requests and accepted connections can start communication.
- The subsequent Airbnb adoption adds pre-request coach inquiries and the discussed service-versus-general consent/removal/blocking rules. It does not replace the ongoing pair conversation with Airbnb's per-reservation organization.
- Separate task views are preferred to one long mixed workspace; exact DEV0242 naming remains a separate proposal.

### Adopted defaults and reasons

[Section 16](../../../docs/mvp-spec.md#16-private-messages-and-session-notes) explicitly labels the defaults: directed coach/athlete identity matches current connections; unconnected general-contact eligibility uses shared confirmed/completed bookings; current booking controls own decisions; bounded plain text, idempotent append-only messages, stable paging/rate limits and visible-page refresh establish a reviewable first implementation. Booking-window snapshots and shared-note integration make block behavior enforceable without deleting existing bookings/content. These are implementation choices, not invented user quotations or claims about Airbnb.

COR0016/COR0020 provide delivered scheduling/relationship baselines. COR0022 is a separate runtime consumer. COR0015 remains the separate note work map; DEV0182 still owns detailed note editing/bounds. Existing M7 group and Explore work is independent and preserved. DEV0232's local migration continuity must be inspected before runtime migrations; this documentation change needs no service or database reset.

## Reference review and adaptations

Public first-party sources reviewed on 2026-10-15:

- [Contacting a host without a reservation](https://www.airbnb.com/help/article/1428) and [Contacting hosts](https://www.airbnb.com/help/article/147): a guest may contact a listing's host before booking. For MovX, this is authenticated Message coach before Request session.
- [Managing guest messages](https://www.airbnb.com/help/article/2899): inquiry/reservation communication and contextual Details. MovX preserves exact request/booking references without creating a new chat per session.
- [Message a connection](https://www.airbnb.com/help/article/4246) and [Remove a connection](https://www.airbnb.com/help/article/4247): direct messages for connections; eligible unconnected contact through a recipient-approved request; removal retains history and requires renewed general-message consent.
- [Block an Airbnb user](https://www.airbnb.com/help/article/4046): blocking is distinct and includes an upcoming/active booking communication exception. The adopted MovX contract makes the snapshot, time boundary, cancellation and multiple-booking behavior explicit.
- [Messaging help topic](https://www.airbnb.com/help/topic/1379): reading/sending requires authentication.
- [Messages overview](https://www.airbnb.com/help/article/3558) and [Messages tab resource](https://www.airbnb.com/resources/hosting-homes/a/getting-the-most-out-of-the-messages-tab-678), published 2025-12-05: inbox triage/search/context patterns. The broader overview previously described removed-connection chats remaining open, unlike the dedicated new-request guidance; dedicated connection guides govern this adoption. No universal live behavior was experimentally verified.

The [host inbox](https://www.airbnb.com/hosting/messages) required sign-in. No authenticated inbox, private content or exact current desktop layout was inspected. The written MovX interface uses a list, one conversation and optional Details; mobile drills down/back. Its All/Unread/Message requests filters and context labels serve consent and incoming-work visibility. No visual preview or runtime UI is delivered by this record.

## Implementation plan

1. Record adoption before editing product behavior, distinguishing copied contact rules from MovX defaults and dated earlier proposals.
2. Update specification journeys/state/authority/privacy/navigation, M8 and acceptance scenarios with service/general consent, removal/blocking, request-card recovery and separate notes.
3. Reconcile COR0015 and DEV0182–DEV0185 to booking-only note delivery, retain dated planning history and avoid adopting detailed note bounds under the wrong owner.
4. Create COR0022 and four flat peer runtime tickets with exact work ownership, dependencies/independent branches and required integrated evidence. Preserve this existing committed DEV rather than converting or retiring it.
5. Validate identifiers/reservations/index statuses, all affected links/anchors, reciprocal work maps, semantic acceptance coverage and formatting. Review the diff for accidental runtime/unrelated changes.
6. Finish/archive this documentation ticket and update every affected repository link only after the checks pass. Keep runtime peers open; no extra commit is implied by starting implementation after the earlier commit-first instruction.

## Acceptance criteria

- [x] AC1: The specification adopts the reviewed ongoing-message/request-card/session-note distinction and separates confirmed choices from defaults.
- [x] AC2: Creation/identity, service/general consent, removal/block/unblock/suspension, note integration, limits, unread/freshness and retry rules are explicit/testable without implicitly changing booking/connection authority.
- [x] AC3: COR0015 and DEV0182–DEV0185 no longer direct active implementation of per-request chat; booking-note scope/dependencies agree and dated history is retained.
- [x] AC4: The reference-backed written desktop/mobile proposal supports one active task, incoming requests and original session Details; Airbnb observations and MovX adaptations are distinguished.
- [x] AC5: Runtime work has a reciprocal flat work map with start/completion conditions; identifier/link/status/format/semantic checks pass and no runtime delivery is claimed.

## Validation plan

Use an ignored local documentation checker at work/validate-dev0243-adoption.py to check all affected local links/anchors, unique current/archive/retired/reserved IDs, next allocation, index statuses, both work-map memberships and acceptance traceability. Run explicit Prettier checks on changed Markdown and git diff --check. Inspect source/test diffs to ensure no runtime edit is introduced by this task. Application/unit/database/browser/build checks are not applicable because only documentation/contracts/planning records change; runtime peers record their own evidence.

## Implementation record

### Changes and rationale

The specification now distinguishes ongoing service communication from general-message consent, permits authenticated pre-request coach inquiries and records the discussed removal/blocking behavior. Requests retain original cards/bookings in one pair conversation; booking notes/private notes stay separate. The old note plans are revised so they cannot cause duplicate request chats. COR0022 allocates authority, existing-product integration, UI/freshness and integrated proof to four peers; DEV0244 is the first runtime slice.

### Affected files

| File or component                                                                                                                                                                                                                                                                                                                                                            | Change and purpose                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [MVP specification](../../../docs/mvp-spec.md)                                                                                                                                                                                                                                                                                                                               | Single adopted contract: C35–C38, M8, section 16 and cross-cutting journeys/identity/privacy/recovery/acceptance alignment. Existing Explore/M7 edits are retained. |
| This record and [ticket index](../../README.md)                                                                                                                                                                                                                                                                                                                              | Adoption/history/evidence, lifecycle and allocation through DEV0247/COR0022; next IDs become DEV0248/COR0023.                                                       |
| [COR0015](../../current/organisatory/COR0015-session-notes-and-training-plans.md), [DEV0182](DEV0182-adopt-session-notes-contract.md), [DEV0183](../../current/backend/DEV0183-persist-authorized-session-notes.md), [DEV0184](../../current/frontend/DEV0184-add-coach-session-workspace.md), [DEV0185](../../current/frontend/DEV0185-add-client-session-collaboration.md) | Replace active per-request-chat plans with original-booking note scope; preserve earlier dated decisions. DEV0182 Ready; note runtime remains Draft.                |
| [COR0022](COR0022-private-messaging-and-booking-context.md), [DEV0244](../backend/DEV0244-persist-private-message-authority.md), [DEV0245](../backend/DEV0245-integrate-messages-with-scheduling-and-connections.md), [DEV0246](../frontend/DEV0246-add-private-mailbox-and-coach-contact.md), [DEV0247](../backend/DEV0247-rehearse-private-messaging-loop.md)              | Map independent runtime delivery without pretending a contract ticket implements the mailbox.                                                                       |

### Decisions and deviations

- 2026-10-15, initial planning: created a bounded contract task, researched public Airbnb guides and marked the earlier note plans for revision. The initial scope excluded pre-request contact and left contact/removal policy open. Planning checkpoint `e333f68` also includes the DEV0242 record; its visual remains ignored and its final browser validation remains separate.
- 2026-10-15, preparation after checkpoint: proposed directed identity, current booking links, numeric/text/read/freshness defaults and four runtime boundaries without adopting unanswered permissions.
- 2026-10-15, clarification: the user selected both saved-request and accepted-connection entry paths, then requested Airbnb's removal and initiation rules. The comparison distinguished host–guest communication from social Connections; no decision was inferred merely from those questions.
- 2026-10-15, adoption: the user requested copying the discussed rules. Add pre-request contact; use fresh message consent after removal rather than requiring reconnection or stopping all service communication. Preserve the previously confirmed ongoing pair conversation and session notes. Dedicated official guides resolve the public overview's inconsistent wording for this contract; no authenticated experiment is claimed.
- 2026-10-15: keep DEV0243 independent because it already has implementation/commit history. Create COR0022 and direct peers rather than converting or retiring this DEV. Keep note detail adoption owned by DEV0182; no unrelated preview, group, native or hosted work is implemented.

### Contracts, configuration, and operations

The product target changes to M8 Messages/contact/consent and the booking-note boundary. Numeric defaults are labelled in the specification. No actual route, typed runtime API, schema, dependency, environment variable, service setup, migration/rollback or real dataset changes in this task. Runtime peers must establish and validate their actual interfaces/migrations before delivery. Account deletion/retention and reporting operations remain future scope, not borrowed guarantees.

## Validation results

Initial creation/checkpoint evidence remains historical:

- Initial ignored checker passed six Draft records and 79 local links/anchors; the first seven record files passed Prettier and git diff --check. The staged checkpoint review validated eight documentation files and 246 links/anchors, preserving unrelated index entries.
- Preparation checks passed six records (one In progress, five Draft), 79 links/anchors, reciprocal COR0015 membership and formatting/diff checks. Later clarification/research checks recorded the same applicable documentation results. Those counts describe their original snapshots, not this expanded adoption change.
- Application/runtime, database, browser, build and hosted checks were not run for that planning-only work; no runtime claim is made from them.

Adoption validation on 2026-10-15, local repository:

- `python3 work/validate-dev0243-adoption.py`: passed 13 documentation files, 328 local links/anchors, current/archive uniqueness and reserved/next IDs, 11 index paths/statuses, two reciprocal four-peer work maps, the intact 38-row decision table, M8 acceptance coverage and active note/message ownership. The local checker is ignored; these assertions/results explain its durable evidence.
- `npx --no-install prettier --check docs/mvp-spec.md tickets/README.md tickets/archive/organisatory/DEV0243-define-ongoing-messages-and-session-note-boundaries.md tickets/current/organisatory/COR0022-private-messaging-and-booking-context.md tickets/current/backend/DEV0244-persist-private-message-authority.md tickets/current/backend/DEV0245-integrate-messages-with-scheduling-and-connections.md tickets/current/frontend/DEV0246-add-private-mailbox-and-coach-contact.md tickets/current/backend/DEV0247-rehearse-private-messaging-loop.md tickets/current/organisatory/COR0015-session-notes-and-training-plans.md tickets/current/organisatory/DEV0182-adopt-session-notes-contract.md tickets/current/backend/DEV0183-persist-authorized-session-notes.md tickets/current/frontend/DEV0184-add-coach-session-workspace.md tickets/current/frontend/DEV0185-add-client-session-collaboration.md`: all affected Markdown passed after final archive/link updates.
- `git diff --check`: passed. Reviewed the owned documentation edits against the scope; pre-existing Explore/M7 source, tests, previews and unrelated documentary edits are retained and are not this ticket's implementation. No runtime/test/config/database/environment edit was introduced by this task.
- Manual contract trace: pre-request inquiry needs no booking/connection; a coach cannot cold-contact arbitrary athletes; general consent is recipient-specific and independent of service communication; removal preserves history/service access; block prohibits new requests/acceptance while captured booking windows expire/cancel independently; shared notes cannot bypass the block; private notes/media remain separate; retry/read/refresh races and original-context recovery have explicit acceptance owners. These are document consistency observations, not runtime tests.
- Public-source self-review confirmed the dedicated Airbnb rules and documented their adaptation. Exact authenticated layout/live behavior was not tested. Application tests, lint/type/build, database/browser and hosted checks are not applicable to this documentation-only delivery and were not run.

| Criterion | Evidence                                                                                                    | Result                           |
| --------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------- |
| AC1       | C35–C38, sections 1/2/4/5/16, labelled defaults and explicit target-versus-runtime status.                  | Passed — contract                |
| AC2       | Sections 7–10/16.1–16.6 and M8 acceptance rows; manual state/consent/block/recovery trace.                  | Passed — contract                |
| AC3       | Rewritten active COR0015/DEV0182–DEV0185 scopes with dated earlier decisions retained; reciprocal checker.  | Passed — planning reconciliation |
| AC4       | Written section 16.6 desktop/mobile/context/request proposal and first-party reference/adaptation review.   | Passed — written proposal        |
| AC5       | COR0022/DEV0244–DEV0247 exact work map, statuses/order, 13-file format and link/identifier/semantic checks. | Passed — documentation           |

## Risks, limitations, and follow-ups

No mailbox or note runtime is delivered by this contract. DEV0244 is the next Ready runtime slice; migration continuity must be inspected before applying database work. DEV0245 owns atomic scheduling/connection/block integration; DEV0246 owns UI/freshness; DEV0247 owns actual combined proof. Notes remain separate COR0015 work and must not be fabricated in Details. Preserve concurrent Explore/M7 source changes and user data. Exact Airbnb geometry/live behavior and its reporting/retention/notification systems are not delivered here.

## Completion and review references

- Completed: 2026-10-15 — adopted the messaging/notes contract, reconciled note plans and created the bounded runtime work map; no mailbox runtime claimed.
- Commit: Initial planning checkpoint `e333f68` — `[DEV0242][DEV0243] Checkpoint navigation and mailbox planning`; adoption and runtime delivery are included in the user-authorized DEV0243–DEV0247 delivery commit (see Git history).
- Review: Public-source and documentation self-review; no independent implementation review.
- Deployment or release: Documentation target only; mailbox/note runtime not implemented or deployed.
