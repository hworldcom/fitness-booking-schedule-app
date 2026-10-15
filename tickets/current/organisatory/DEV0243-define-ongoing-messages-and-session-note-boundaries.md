# Ticket DEV0243: Define ongoing messages and session-note boundaries

- Status: Draft
- Created: 2026-10-15
- Last updated: 2026-10-15
- Milestone: Private messaging product contract
- Coordination: None — independent development ticket
- Related records: session-note planning consumer [COR0015](COR0015-session-notes-and-training-plans.md) and its contract owner [DEV0182](DEV0182-adopt-session-notes-contract.md); downstream note consumers [DEV0183](../backend/DEV0183-persist-authorized-session-notes.md), [DEV0184](../frontend/DEV0184-add-coach-session-workspace.md), [DEV0185](../frontend/DEV0185-add-client-session-collaboration.md); completed booking-request baseline [COR0016](../../archive/organisatory/COR0016-coach-confirmed-booking-requests.md); completed connection baseline [COR0020](../../archive/organisatory/COR0020-athlete-terminology-and-connections.md); independent navigation proposal [DEV0242](../frontend/DEV0242-preview-training-navigation-and-request-badges.md); account-retention follow-up [DEV0165](../backend/DEV0165-implement-account-deletion-lifecycle.md)

## Objective and context

Define the user's requested ongoing private inbox before implementing it. One coach and athlete should continue a conversation across their sessions, with session requests also appearing in that conversation. Individual session details contain coach/athlete notes about that session. The earlier COR0015 draft instead proposes a separate conversation for every pending request that continues into its accepted booking; it must be reconciled before implementation.

The [MVP specification](../../../docs/mvp-spec.md) remains the single product contract. Its [connection behavior](../../../docs/mvp-spec.md#49-connect-after-a-confirmed-session), [request/booking recovery](../../../docs/mvp-spec.md#7-requests-booking-and-recovery) and [participant privacy](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity) remain authoritative. Creating this Draft does not adopt new messaging permissions or claim a delivered inbox.

## Scope and non-goals

- In scope when this contract ticket is implemented: adopt the reviewed messaging/notes distinction in the specification; define conversation identity, participant permissions, request-card lifecycle, message bounds, unread state and recovery; reconcile COR0015 and DEV0182–DEV0185; describe a bounded interface inspired by the public Airbnb sources below; prepare clear boundaries for subsequent runtime work.
- This creation change records requirements, evidence and open decisions only. Contract adoption has not started.
- Out of scope: schema, migrations, runtime routes/actions, inbox implementation, modifying existing bookings/connections, group messaging, stranger contact, attachments, typing indicators, recipient-visible read receipts, AI replies, payments, email/push delivery and deployment. Session-note persistence/UI remain the separately scoped COR0015 work.

## Expected behavior and edge cases

- A message conversation spans successive requests/sessions between its exact participants. A new request appears as a structured card containing its original request identity, session time, actual venue, status and an authorized route to review it. Acceptance references the resulting original booking without duplicating the conversation or representing a pending request as confirmed.
- Existing request creation, expiry, withdrawal, decline, acceptance, closure and booking cancellation/completion remain the scheduling authority. A message or request card cannot grant capacity, accept a connection or impersonate another participant.
- Request/booking cards retain their own original states as later sessions are requested. Decide explicitly whether one status card updates in place, status events are appended, or both; retries and reloads must not duplicate the same request card or user message.
- Each athlete's conversation is private even when several athletes request the same coach occurrence. No other candidate identity, count or content enters that athlete's inbox. Existing group-event rosters do not become message recipients.
- Individual session notes remain attached to the original booking. They are not copied into the ongoing message history or transferred to another athlete after cancellation/rebooking. Earlier shared-training-plan and coach-private-note intent must be explicitly reconciled rather than silently removed; private notes never enter inbox projections, including their existence/count.
- An unread inbox indicator must reliably lead to the pending item and update after the recipient reads it. Unread tracking for the account owner is distinct from showing the sender a read receipt. Returning to a visible page must have a defined freshness policy rather than relying on an undocumented manual reload.
- Message/read failures show a recoverable state, preserve unsent drafts where authorized and do not report success from an uncertain response. Refresh must not overwrite newer messages, move keyboard focus unexpectedly or retain content after access is revoked.
- Decide message write/read rules after declined/withdrawn/expired requests, cancelled/completed bookings, connection disconnection/reconnection, account suspension and blocking. Terminal scheduling status alone must not silently determine the lifecycle of an ongoing conversation.

## Assumptions, decisions, and dependencies

### Confirmed user direction

- Ongoing private messages span a coach–athlete relationship rather than creating a new chat for each booking.
- Session requests also land in those ongoing messages.
- Individual booking sessions contain notes from the coach and athlete.
- Use Airbnb's messaging organization as a design reference. The user also preferred the separate task views in DEV0242 over a long page combining requests, bookings and connections.
- The user requested a ticket and reference review, not runtime implementation.

### Proposed defaults to review

- Add one Messages destination with a conversation list, active conversation and optional session Details drawer/panel. Mobile moves between those views with a clear back action; it does not squeeze three columns onto a phone. This is a MovX proposal, not a verified reproduction of Airbnb's authenticated desktop layout.
- Start with All and Unread inbox filters. Coaching / My training context can help people who use both roles; a Needs a decision filter should describe pending request cards, not classify an entire ongoing conversation as one booking stage. Search by counterpart name is a candidate first-version scope, not a confirmed requirement for full-text search.
- A first persisted session request can open a conversation before an accepted coach–athlete connection exists. Whether that immediately enables free-text messages, and whether existing connected pairs can start an inbox without a new request, remain decisions below. Submitting a request does not implicitly accept a connection.
- Begin with bounded plain text, explicit send, idempotent retry and paginated history. Numeric limits and the refresh interval/transport must be chosen and recorded before runtime implementation.

### Decisions needed before contract adoption

1. Confirm conversation creation and messaging eligibility: request-first communication, accepted connections, or both; define consent, blocking/reporting and bounded unsolicited-contact behavior.
2. Choose conversation identity when both people also coach: one identity pair per dataset or separate teaching directions. Do not merge existing role-scoped histories accidentally.
3. Decide read/write/retention behavior after terminal bookings, disconnection, suspension and blocking, preserving historical identities and the separately adopted reconnection/history rules. Coordinate future account deletion with DEV0165.
4. Confirm whether booking decisions happen inline in Messages or link to the existing Bookings controls, and how a request-created conversation is recovered if an integration write fails.
5. Reconcile the earlier training-plan/private-note scope and which session-note states remain read-only. Chat history and booking notes need separate rules.
6. Specify owner unread counts, ordering, message edit/delete policy, pagination, size limits, freshness behavior and the minimum abuse controls. Public read receipts and notifications are not implied by an unread badge.

## Airbnb reference review

Reviewed public first-party sources on 2026-10-15:

- [Manage all your Airbnb messages](https://www.airbnb.com/help/article/3558): one inbox combines guest/host contexts, with filters, search and priority/recent/past organization. Borrow the separation of inbox triage from the selected conversation; these are reference patterns, not a requirement to ship every category.
- [Managing guest messages](https://www.airbnb.com/help/article/2899): unread and reservation-stage filters help review work; a thread's Details control exposes reservation context. For MovX, keep request/session facts accessible beside or behind the conversation without filling the session-notes view with general chat.
- [Getting the most out of the Messages tab](https://www.airbnb.com/resources/hosting-homes/a/getting-the-most-out-of-the-messages-tab-678), published 2025-12-05: Airbnb describes a new conversation per reservation. MovX's user explicitly prefers an ongoing pair conversation containing multiple request/session references. Do not copy Airbnb's conversation identity or group participation rules.

The public [Airbnb host inbox](https://www.airbnb.com/hosting/messages) redirected to sign-in. No login, authenticated inbox, private messages or exact current desktop column layout was inspected. The layout above is a proposed adaptation from public documentation. A future MovX preview should use labelled examples and preserve its current visual style.

## Implementation plan

1. Review the confirmed direction and open decisions above; keep this ticket Draft while material permissions/lifecycle choices remain unresolved.
2. Adopt the agreed behavior in specification journeys, state/identity model, privacy rules, delivery sequence and acceptance matrix, clearly separating messages, booking cards, connection consent and session notes.
3. Reconcile COR0015's work map and DEV0182–DEV0185 before any of their request-conversation implementation begins. Preserve their dated planning history; this independent ticket does not become a new direct COR0015 member.
4. Describe a desktop/mobile inbox proposal with visible incoming work, role context, message/request states and a separate session-details/notes entry point. A visual preview may receive its own bounded ticket if requested.
5. Record runtime boundaries for data/authority, reliable request-card integration, inbox/navigation/freshness and integrated two-account validation. Create a separate flat coordination/work map and peer development tickets before that multi-part runtime implementation; do not implement it under this documentation ticket.
6. Validate the adopted contract and all affected links/statuses/ownership; complete/archive this record only after its acceptance criteria pass.

## Acceptance criteria

- [ ] AC1: The specification adopts the reviewed ongoing-message/request-card/session-note distinction and separates confirmed choices from defaults.
- [ ] AC2: Conversation creation/identity, participant permissions, terminal/disconnected/blocked behavior, message bounds, unread state, freshness and retry rules are explicit and testable without changing booking or connection authority implicitly.
- [ ] AC3: COR0015 and DEV0182–DEV0185 no longer direct developers to implement the superseded per-request chat model; their owned session-note scope and dependencies agree.
- [ ] AC4: The reference-backed desktop/mobile proposal supports one task per view, visible incoming work and a clear session-details route; Airbnb observations and MovX proposals are distinguished.
- [ ] AC5: Runtime delivery boundaries and subsequent flat-ticket handoff are clear, and local link/identifier/status/format/consistency checks pass. No runtime capability is claimed from a planning record.

## Validation plan

For ticket creation, validate local links/anchors, unique DEV allocation across current/archive/retired/reserved IDs, reciprocal COR0015 membership, accurate Draft statuses, formatting and git diff --check. Review reference claims against the linked public Airbnb pages. Application tests and database/browser rehearsals are not applicable to this planning-only change.

When adopting the contract, additionally trace every accepted rule into the specification and dependent planning records. Runtime follow-ups must cover two already-open authenticated browser contexts: request/message arrival, correct unread counts, decision feedback, retry/deduplication, actor switching, mobile/keyboard use and private-note/other-candidate isolation without requiring undocumented reloads.

## Implementation record

### Changes and rationale

Planning only: created this bounded contract ticket and index entry after the user's request, researched the public Airbnb references, and added revision notices to the existing Draft session-note records. The notices prevent the old request-conversation proposal from being implemented before the new boundary is reconciled. Product-contract adoption and runtime implementation have not started.

### Affected files

| File or component                                                                                                                                                                                                                                        | Role                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| This ticket and [index](../../README.md)                                                                                                                                                                                                                 | Record the user direction, research, unresolved choices and future contract work; reserve DEV0243.       |
| [COR0015](COR0015-session-notes-and-training-plans.md)                                                                                                                                                                                                   | Mark this independent contract dependency and the pending revision of its earlier conversation proposal. |
| [DEV0182](DEV0182-adopt-session-notes-contract.md), [DEV0183](../backend/DEV0183-persist-authorized-session-notes.md), [DEV0184](../frontend/DEV0184-add-coach-session-workspace.md), [DEV0185](../frontend/DEV0185-add-client-session-collaboration.md) | Keep the unfinished records Draft and point to the new boundary decision before implementation.          |

### Decisions and deviations

2026-10-15: Create one documentation-contract task rather than one oversized inbox implementation ticket. Ongoing messages and session notes need distinct lifecycles; the confirmed direction does not settle first-contact/disconnection permissions. No coordination identifier or runtime ticket is allocated by this planning change.

### Contracts, configuration, and operations

None changed in this creation change. The existing specification remains authoritative until contract adoption. No schema, dependency, environment, setup, migration or runtime rollback change. Historical completed records and existing user data are unchanged.

## Validation results

Ticket-creation checks on 2026-10-15:

- `python3 work/validate-dev0243-planning.py` (ignored local documentation checker): passed six Draft records, 79 repository-relative links/anchors, unique/reserved identifier checks, next DEV/COR IDs, index status, unchanged four-member reciprocal COR0015 membership and clear confirmed/proposed/research boundaries.
- `npx --no-install prettier --check tickets/current/organisatory/DEV0243-define-ongoing-messages-and-session-note-boundaries.md tickets/current/organisatory/COR0015-session-notes-and-training-plans.md tickets/current/organisatory/DEV0182-adopt-session-notes-contract.md tickets/current/backend/DEV0183-persist-authorized-session-notes.md tickets/current/frontend/DEV0184-add-coach-session-workspace.md tickets/current/frontend/DEV0185-add-client-session-collaboration.md`: all six planning records passed.
- `git diff --check`: passed. Reviewed the new record and dated annotations against the requested planning-only scope; existing independent Explore/group-training edits were preserved.
- Commit checkpoint review: `git diff --cached --check` passed. An inline Python review read the eight staged documentation files and their link targets from the Git index, verified 246 local links/anchors, Prettier output and unfinished statuses, and confirmed that unrelated ticket entries were unchanged. Only this planning work and the DEV0242 preview record are included; the visual source remains ignored. The index reserves independently allocated Explore/group-session IDs without staging their implementation.
- Read the three linked official Airbnb guides and followed the public inbox link, which redirected to sign-in. No authenticated inbox access or exact desktop visual inspection is claimed.
- Application tests, lint/type/build, browser rehearsals and database checks were not run because only ticket/index planning documentation changed. No application data or environment was changed.

Contract acceptance criteria remain not run: this is a Draft with unresolved decisions and no adopted specification changes.

## Risks, limitations, and follow-ups

The authenticated Airbnb inbox was unavailable without login; exact interface geometry is not verified. Do not inherit its group access, message retention, payments or read-receipt behavior. The existing navigation preview and its final browser checks remain independently owned by DEV0242. Next action: review the open messaging/lifecycle choices, then adopt the contract and reconcile the old plans before creating runtime delivery peers.

## Completion and review references

- Completed: Not completed — planning only.
- Commit: Planning checkpoint — `[DEV0242][DEV0243] Checkpoint navigation and mailbox planning`; contract adoption and runtime implementation have not started.
- Review: Public-reference and planning self-review; no independent review.
- Deployment or release: Not applicable — no runtime implementation.
