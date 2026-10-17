# Ticket DEV0182: Adopt the session-notes contract

- Status: Completed
- Created: 2026-10-10
- Last updated: 2026-10-16
- Milestone: Scheduling-only session collaboration follow-up
- Coordination: [COR0015 — Session notes and training plans](../../current/organisatory/COR0015-session-notes-and-training-plans.md)
- Related records: completed booking-request contract dependency [DEV0186 — Adopt booking-request and notice policies](DEV0186-adopt-booking-request-and-notice-policies.md); implementation peers [DEV0183 — Persist authorized session notes](../../current/backend/DEV0183-persist-authorized-session-notes.md), [DEV0184 — Add the coach session workspace](../../current/frontend/DEV0184-add-coach-session-workspace.md) and [DEV0185 — Add athlete session collaboration](../../current/frontend/DEV0185-add-client-session-collaboration.md); booking baseline [DEV0141 — Persist direct private bookings](../backend/DEV0141-persist-direct-private-bookings.md); independent messaging-contract dependency [DEV0243](DEV0243-define-ongoing-messages-and-session-note-boundaries.md); independent messaging runtime [COR0022](COR0022-private-messaging-and-booking-context.md)

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
- Adopt enforceable plain-text and retry/conflict bounds before persistence: 8,000 code points/32,000 bytes per plan, 2,000/8,000 per nonblank entry, 64 KiB mutation envelopes, separate 100-entry shared/private quotas and 20-entry stable pages. These finalize earlier proposals as implementation defaults; no entry deletion or shared/private conversion is added.

## Assumptions, decisions, and dependencies

DEV0243 supplies the M8 boundary; DEV0186/DEV0188, COR0022 and DEV0248 are delivered. Session-scoped message storage/filtering and shared titles are existing baselines. Note runtime consumes their booking identity and current block/suspension authority without copying message bodies or rebuilding chat.

Athlete is the existing training-participant capability; internal `client` names remain compatible. No arbitrary athlete directory or group-note access is added. Account deletion/retention remains DEV0165 and must not be invented here.

## Implementation plan

Implementation approach adopted on 2026-10-16: session-scoped Messages, shared titles and message filtering are already delivered by COR0022/DEV0248. Define notes as a durable training record, with no copied chat, replies, unread state or second composer. Finalize the previously proposed text limits together with separate shared/private quotas, bounded paging and optimistic retry recovery. Give DEV0184 ownership of reusable note presentation/forms; DEV0185 consumes those components after their contract stabilizes, avoiding two implementations. These are implementation defaults, not new user-confirmed requirements.

1. Review M8 section 16.6 and original booking/connection authority; record adopted note lifecycle and bounds as defaults, distinct from user constraints.
2. Extend the specification with the remaining detailed note permissions, status/author/edit conflicts and acceptance cases without restoring per-request chat.
3. Reconcile downstream note projections/interfaces, retention links and M8 block integration; preserve archived history.
4. Validate all changed Markdown links, reciprocal ownership, formatting and semantic consistency, then finish the record.

## Acceptance criteria

- [x] AC1: The specification explicitly defines booking-only shared plans/notes and coach-private notes, without a second request or booking chat.
- [x] AC2: Confirmed/completed/cancelled, original-booking rebooking isolation, participant/author/privacy rules and block-window shared writes are testable and consistent with M8.
- [x] AC3: Plain-text, byte/envelope/entry/paging limits and stale-edit/failure recovery are concrete; no attachment, medical-record or general-message scope is implied.
- [x] AC4: COR0015 and DEV0183–DEV0185 agree on ownership/sequence and all affected documentation checks pass.

## Validation plan

Documentation-only: check adopted note rules in the specification, all affected links/anchors, unique identifiers, reciprocal COR0015 ownership, Prettier and git diff --check. Runtime/database/browser checks are not applicable to this contract ticket.

## Implementation record

Adopted the documentation contract in specification section 17 on 2026-10-16. Validation is recorded below; note runtime remains owned by DEV0183–DEV0185.

### Changes and rationale

Previously the broad note/message boundary existed but detailed note limits, permissions and recovery were unresolved, and current plans still described message runtime as future work. Section 17 now defines a booking training record with one shared plan, author-owned shared feedback and coach-private entries. It explicitly records implemented session Messages/filtering, reuses shared title/date metadata, and excludes copied chat, message-style replies and unread activity. Role-specific booking routes keep note access independent of the accepted-connection athlete detail page. Updated journeys, state-model and acceptance scenarios make the future runtime testable.

### Affected files

- [MVP specification](../../../docs/mvp-spec.md#17-session-training-plans-and-notes): detailed contract, delivered/target distinction, journey/state-model/acceptance updates and corrected current Messages Details destination.
- [COR0015](../../current/organisatory/COR0015-session-notes-and-training-plans.md): flat ownership, reusable UI sequence and combined note/message integration criteria.
- [DEV0183](../../current/backend/DEV0183-persist-authorized-session-notes.md): backend bounds, independent private projections, operation recovery and existing-conversation reference.
- [DEV0184](../../current/frontend/DEV0184-add-coach-session-workspace.md) and [DEV0185](../../current/frontend/DEV0185-add-client-session-collaboration.md): coach/shared UI ownership, athlete integration, original-booking navigation and evidence requirements.
- [Ticket index](../../README.md): lifecycle/status and archive navigation. Archived [DEV0186](DEV0186-adopt-booking-request-and-notice-policies.md), [DEV0219](DEV0219-adopt-athlete-connections-contract.md), [DEV0230](DEV0230-adopt-reconnection-history-recovery.md) and [DEV0243](DEV0243-define-ongoing-messages-and-session-note-boundaries.md): inbound DEV0182 links moved to the archive; historical claims/command transcripts remain unchanged. The scan also found DEV0186's obsolete section 4.3 anchor and repointed it to the current request heading.

### Decisions and deviations

- 2026-10-16: Session discussion is already implemented. Adopt training records rather than another chat thread; no message-to-note migration or automatic copy. Shared titles/dates remain booking metadata from DEV0248.
- 2026-10-16: Adopt proposed code-point limits plus byte/envelope/paging bounds, and refine the proposed entry cap to 100 shared plus 100 private entries. Separate quotas avoid private-existence leaks. No first-version entry deletion or visibility conversion; coach plan clearing remains versioned.
- 2026-10-16: Preserve original booking/status/author authority; shared writes reuse M8 block/suspension windows and private writes remain owner/status-only. Account revocation still denies access; DEV0165 retains deletion/retention ownership.
- 2026-10-16: Replace independent frontend implementation with DEV0184-owned shared forms/display followed by DEV0185 integration. This avoids duplicate UI/recovery logic while retaining flat peer ownership. Numeric/routes/sequence choices are adopted defaults, not additional user confirmations.

- 2026-10-15: Reconcile the active scope with M8/DEV0243. General conversations/request cards move to independent COR0022; original-booking plans/notes remain here. Shared writes must respect M8 block windows, while retained reads and coach-private authority remain separate.

Dated earlier planning history (superseded where it proposes request chat):

- 2026-10-14: Updated planning vocabulary to athlete and made connection-independent session authorization explicit; existing filenames/IDs and earlier history remain intact. Session-content contract adoption still belongs to DEV0182.

- 2026-10-10: Planned the feature as one session workspace rather than general direct messaging so authorization stays anchored to an existing booking.
- 2026-10-10: Expanded the workspace anchor to an exact pending request or its accepted booking after the user adopted coach-approved multi-candidate requests; arbitrary pre-request contact remains excluded.

### Contracts, configuration, and operations

Adopted a detailed product contract and downstream implementation plan only. Future additive note tables/projections/mutations belong to DEV0183 and role-specific routes to DEV0184/DEV0185. No schema, runtime API, dependency, environment variable, provider, setup command, database migration or deployment changed here; no rollback operation is needed for these documents.

## Validation results

- AC1: Self-review of sections 4.12, 5, 13, 16.6 and 17 confirms original-booking training plans/notes are separate from delivered session Messages; no second chat or copied message bodies.
- AC2: Section 17.2–17.3 defines original-ID isolation, exact participant/author authority, cancelled read-only history, independent private projections, block/suspension limits and connection-independent access. Cross-checked against M8 section 16.3 and DEV0248 identity/status behavior.
- AC3: Section 17.4–17.5 fixes code-point/byte/envelope/entry/page limits, no-delete/plan-clear behavior, optimistic conflicts, exact retry versus altered replay and authorized draft/error recovery. These are explicitly adopted defaults, not user confirmations.
- AC4: Reconciled COR0015's four direct owners and DEV0183–DEV0185's plans. DEV0183 is Ready after this adoption; interfaces remain Draft, with DEV0184 owning shared UI before DEV0185 integration. No runtime acceptance boxes are marked passed in those peers.
- `python3 /tmp/dev0182-check-docs.py`: targeted local documentation checker passed seven active documents, 273 relative links/anchors, five unique record IDs, four reciprocal direct memberships and contract/status assertions before archival. Final post-archive run passed 11 affected documents and 360 relative links/anchors, with all ID, reciprocal-membership, index/status and contract assertions passing. The temporary checker is a read-only verification aid, not a new application dependency or maintained test command.
- `npx --no-install prettier --check docs/mvp-spec.md tickets/README.md tickets/current/organisatory/COR0015-*.md tickets/current/backend/DEV0183-*.md tickets/current/frontend/DEV018{4,5}-*.md tickets/archive/organisatory/DEV{0182,0186,0219,0230,0243}-*.md`: all 11 affected Markdown files passed after formatting and archival/link maintenance. `git diff --check` passed.
- Runtime/database/browser/lint/type/build checks are not applicable to DEV0182: it changes no application code, schema, dependency or configuration. Concurrent DEV0238 implementation is independent and excluded from this record. DEV0183–DEV0185 retain all required note runtime evidence.

## Risks, limitations, and follow-ups

Private data must be excluded by database/server projections, not browser hiding. Notes may be sensitive and must not enter logs, analytics or unrelated responses. Original IDs, author ownership and optimistic versions prevent content transfer/loss. Note/M8 integration needs combined evidence when both are delivered; each coordination retains its own completion boundary.

## Completion and review references

- Completed: 2026-10-16 — detailed documentation contract adopted; no note runtime is claimed.
- Commit: This user-authorized workspace checkpoint includes the adopted documentation contract (subject includes DEV0182). Earlier boundary planning remains under DEV0243; prior DEV0248/DEV0250 runtime remains `a6588ee`. No note runtime is delivered by this contract.
- Review: Contract self-review against AC1–AC4 and M8; no independent review or note runtime review claimed.
- Deployment or release: Documentation contract only; note runtime is not implemented or deployed.
