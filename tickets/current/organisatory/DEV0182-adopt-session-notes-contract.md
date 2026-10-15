# Ticket DEV0182: Adopt the session-notes contract

- Status: Ready
- Created: 2026-10-10
- Last updated: 2026-10-15
- Milestone: Scheduling-only session collaboration follow-up
- Coordination: [COR0015 — Session notes and training plans](COR0015-session-notes-and-training-plans.md)
- Related records: completed booking-request contract dependency [DEV0186 — Adopt booking-request and notice policies](../../archive/organisatory/DEV0186-adopt-booking-request-and-notice-policies.md); implementation peers [DEV0183 — Persist authorized session notes](../backend/DEV0183-persist-authorized-session-notes.md), [DEV0184 — Add the coach session workspace](../frontend/DEV0184-add-coach-session-workspace.md) and [DEV0185 — Add athlete session collaboration](../frontend/DEV0185-add-client-session-collaboration.md); booking baseline [DEV0141 — Persist direct private bookings](../../archive/backend/DEV0141-persist-direct-private-bookings.md); independent messaging-contract dependency [DEV0243](../../archive/organisatory/DEV0243-define-ongoing-messages-and-session-note-boundaries.md); independent messaging runtime [COR0022](../../archive/organisatory/COR0022-private-messaging-and-booking-context.md)

## Planning boundary revised — 2026-10-15

The user adopted Airbnb-style contact/consent while retaining one ongoing pair conversation and separate booking notes. DEV0243 reconciles this plan; COR0022 owns messages/inquiries/request cards. The earlier proposal for a conversation per pending request is superseded, not an active implementation instruction. The previously accepted shared-plan/shared-note/coach-private intent remains. This revision implements no note runtime.

## Objective and context

Adopt detailed booking-bound note/plan permissions and bounds after the M8 boundary amendment. The overall distinction is now authoritative in [section 16.6](../../../docs/mvp-spec.md#166-interface-and-session-note-boundary): ongoing messages and request cards belong to COR0022; each original booking has its own notes. This task owns the remaining detailed note contract, not another messaging contract or runtime.

## Scope and non-goals

In scope:

- Adopt one coach-authored shared plan, two-way shared notes and a separately authorized coach-private area per original booking.
- Specify exact participant/author reads/edits, optimistic versions, confirmed/completed/cancelled rules, text/entry/byte bounds and recoverable failures.
- Carry M8 block integration into shared writes while preserving participant history reads and independent coach-private ownership.
- Update applicable specification journeys, note acceptance cases and DEV0183–DEV0185 before runtime.

Out of scope: ongoing Messages/inquiry/general-consent/request-card runtime, attachments, rich text, notification delivery, read receipts, reusable templates, cross-booking athlete records and medical analysis. Preserve independent scheduling and media authority.

## Expected behavior and edge cases

- A pending or unsuccessful request has an original message card in the ongoing conversation, with no separate request-note workspace. Acceptance starts one booking workspace; no chat body is copied into notes.
- The coach owns the shared plan; the athlete reads it and responds through shared notes. Both participants edit only their own shared notes. Only the coach receives private entries or their metadata.
- Cancelled booking content remains readable and read-only. Confirmed/completed bookings permit their authorized note work; blocked shared writes also require the M8 captured-booking window. Disconnection/general-message consent does not gate participant note access.
- A rebooking has a separate empty workspace even for the same occurrence or pair. Reconnection opens original retained booking notes with original authors/timestamps/permissions; request cards route to COR0022 rather than inventing a past note thread.
- Choose enforceable plain-text bounds and edit conflict/error behavior before persistence. Earlier proposed limits (8,000 Unicode characters per plan, 2,000 per note and 100 non-deleted entries per booking) remain proposals for this ticket to finalize, including byte/envelope/paging constraints.

## Assumptions, decisions, and dependencies

DEV0243 supplies the M8 boundary; DEV0186/DEV0188 request authority is already completed. DEV0182 can proceed independently of message runtime; coordinate the shared block/context contract with COR0022 before note runtime integration.

Athlete is the existing training-participant capability; internal `client` names remain compatible. No arbitrary athlete directory or group-note access is added. Account deletion/retention remains DEV0165 and must not be invented here.

## Implementation plan

1. Review M8 section 16.6 and original booking/connection authority; record adopted note lifecycle and bounds as defaults, distinct from user constraints.
2. Extend the specification with the remaining detailed note permissions, status/author/edit conflicts and acceptance cases without restoring per-request chat.
3. Reconcile downstream note projections/interfaces, retention links and M8 block integration; preserve archived history.
4. Validate all changed Markdown links, reciprocal ownership, formatting and semantic consistency, then finish the record.

## Acceptance criteria

- [ ] AC1: The specification explicitly defines booking-only shared plans/notes and coach-private notes, without a second request or booking chat.
- [ ] AC2: Confirmed/completed/cancelled, original-booking rebooking isolation, participant/author/privacy rules and block-window shared writes are testable and consistent with M8.
- [ ] AC3: Plain-text, byte/envelope/entry/paging limits and stale-edit/failure recovery are concrete; no attachment, medical-record or general-message scope is implied.
- [ ] AC4: COR0015 and DEV0183–DEV0185 agree on ownership/sequence and all affected documentation checks pass.

## Validation plan

Documentation-only: check adopted note rules in the specification, all affected links/anchors, unique identifiers, reciprocal COR0015 ownership, Prettier and git diff --check. Runtime/database/browser checks are not applicable to this contract ticket.

## Implementation record

Pending implementation. DEV0243 revised the planning boundary only; the acceptance criteria below still require this ticket's own evidence.

### Changes and rationale

No owned implementation yet. The planning revision removes duplicated request chat and keeps original-booking content separate from the ongoing inbox.

### Affected files

Pending implementation; record actual files and roles when work starts.

### Decisions and deviations

- 2026-10-15: Reconcile the active scope with M8/DEV0243. General conversations/request cards move to independent COR0022; original-booking plans/notes remain here. Shared writes must respect M8 block windows, while retained reads and coach-private authority remain separate.

Dated earlier planning history (superseded where it proposes request chat):

- 2026-10-14: Updated planning vocabulary to athlete and made connection-independent session authorization explicit; existing filenames/IDs and earlier history remain intact. Session-content contract adoption still belongs to DEV0182.

- 2026-10-10: Planned the feature as one session workspace rather than general direct messaging so authorization stays anchored to an existing booking.
- 2026-10-10: Expanded the workspace anchor to an exact pending request or its accepted booking after the user adopted coach-approved multi-candidate requests; arbitrary pre-request contact remains excluded.

### Contracts, configuration, and operations

Planned detailed product contract only; no schema, environment variable, provider, setup or runtime migration is implemented here.

## Validation results

Runtime acceptance criteria are not run. DEV0243 owns link/status/membership and semantic checks of this planning revision. Do not infer implementation or completed browser/database evidence from the contract amendment.

## Risks, limitations, and follow-ups

Private data must be excluded by database/server projections, not browser hiding. Notes may be sensitive and must not enter logs, analytics or unrelated responses. Original IDs, author ownership and optimistic versions prevent content transfer/loss. Note/M8 integration needs combined evidence when both are delivered; each coordination retains its own completion boundary.

## Completion and review references

- Completed: Not completed.
- Commit: Earlier planning record retained in Git history; this boundary revision belongs to DEV0243, with no owned runtime commit yet.
- Review: Planning self-review only; no independent implementation review.
- Deployment or release: Not implemented or deployed.
