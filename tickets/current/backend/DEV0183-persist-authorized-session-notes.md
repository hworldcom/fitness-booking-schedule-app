# Ticket DEV0183: Persist authorized session notes

- Status: Ready
- Created: 2026-10-10
- Last updated: 2026-10-16
- Milestone: Scheduling-only session collaboration follow-up
- Coordination: [COR0015 — Session notes and training plans](../organisatory/COR0015-session-notes-and-training-plans.md)
- Related records: contract dependency [DEV0182 — Adopt the session-notes contract](../../archive/organisatory/DEV0182-adopt-session-notes-contract.md), completed booking-request dependency [DEV0188 — Persist multi-candidate booking requests](../../archive/backend/DEV0188-persist-multi-candidate-booking-requests.md), interface consumers [DEV0184 — Add the coach session workspace](../frontend/DEV0184-add-coach-session-workspace.md) and [DEV0185 — Add athlete session collaboration](../frontend/DEV0185-add-client-session-collaboration.md), booking baseline [DEV0141 — Persist direct private bookings](../../archive/backend/DEV0141-persist-direct-private-bookings.md), account-deletion follow-up [DEV0165 — Implement the account-deletion lifecycle](DEV0165-implement-account-deletion-lifecycle.md); independent messaging-contract dependency [DEV0243](../../archive/organisatory/DEV0243-define-ongoing-messages-and-session-note-boundaries.md); independent messaging runtime [COR0022](../../archive/organisatory/COR0022-private-messaging-and-booking-context.md)

## Planning boundary revised — 2026-10-15

The user adopted Airbnb-style contact/consent while retaining one ongoing pair conversation and separate booking notes. DEV0243 reconciles this plan; COR0022 owns messages/inquiries/request cards. The earlier proposal for a conversation per pending request is superseded, not an active implementation instruction. The previously accepted shared-plan/shared-note/coach-private intent remains. This revision implements no note runtime.

## Contract adopted — 2026-10-16

[Specification section 17](../../../docs/mvp-spec.md#17-session-training-plans-and-notes) is the implementation contract. Session messages and session-filtered history are already delivered under COR0022/DEV0248; this ticket must not duplicate or migrate chat. Reuse the existing booking title/date metadata.

Backend ownership includes exact-booking plan/shared/private authority, independently bounded projections and separate quotas/cursors; optimistic versions and actor/booking/kind-scoped operation UUID recovery; cancellation/block/suspension serialization using existing M8 authority; and a server-authorized reference to the existing conversation for the UI shortcut. That reference grants neither connection/media access nor message consent. Enforce the adopted 8,000/32,000 plan and 2,000/8,000 entry code-point/byte limits, 64 KiB envelope, separate 100-entry quotas, 20-entry pages and no-delete first version. An empty plan clear is valid and versioned; blank entries fail.

Required evidence additionally covers exact retry versus altered replay, simultaneous final-quota entry creates, private counts/capacity excluded from athlete results, full paging after edits, coach-as-athlete direction, account revocation, suspension and exact M8 window boundaries. Coach-private writes remain owner/status-only, while cancelled content is read-only. This is planning readiness, not persistence delivery; actual schema/actions and migration evidence remain this ticket's implementation.

## Separate session-notes follow-up — 2026-10-16

The user requested session notes be tracked in a separate ticket. This existing ticket owns their backend implementation: the booking's shared training plan, coach/athlete training notes and coach-private entries. DEV0184 and DEV0185 remain the separate interface consumers under COR0015. DEV0182 completed the contract only; it did not implement notes.

Session Messages and filtering are already delivered under COR0022/DEV0248. Keep their ongoing conversation and per-session discussion intact. Note implementation does not reopen messaging delivery, copy chat into notes or add another chat thread. This scope clarification starts no note runtime work; DEV0183 remains Ready and the interface tickets remain Draft.

## Objective and context

Persist the booking-note contract adopted by DEV0182 with actor-scoped PostgreSQL authority and bounded coach/athlete projections. Ongoing messages, inquiries and request cards are independently owned by COR0022 under [section 16](../../../docs/mvp-spec.md#16-private-messages-and-session-notes). This slice adds only original-booking plans and notes.

## Scope and non-goals

In scope:

- Add additive booking-bound shared-plan, shared-note and coach-private-note data with stable IDs, authors, timestamps and optimistic versions.
- Enforce one active shared plan per booking, exact participant reads, coach-only private metadata, author-owned edits, status/block-aware shared writes, bounds and rebooking isolation.
- Add typed bounded domain/repository/service/action projections and fresh/upgrade/privilege/concurrency/integration tests.

Out of scope: ongoing Messages/inquiry/general-consent/request-card runtime, attachments, rich text, notification delivery, read receipts, reusable templates, cross-booking athlete records and medical analysis. Preserve independent scheduling and media authority.

## Expected behavior and edge cases

- Resolve through the exact original booking UUID and current actor/dataset, never occurrence identity alone. Pending requests have no note rows; their cards/messages remain COR0022.
- Coach upserts the shared plan with conflict detection. Participants add/edit only their own shared entries; only the coach accesses private entries and metadata. Queries exclude private rows structurally from athlete results.
- Cancelled bookings retain read-only notes; confirmed/completed work follows DEV0182 rules. For blocked pairs, shared writes also require the M8 booking-window permission; coach-private entries remain separately authorized.
- Rebooking starts empty and never transfers another athlete's or prior booking's notes. Connection removal/reconnection preserves original content and author/status rules.
- Malformed, blank-entry, oversized, stale, excessive, unrelated and cross-dataset operations fail without partial writes or private metadata leakage.

## Assumptions, decisions, and dependencies

DEV0182 now supplies the detailed contract; DEV0188 and COR0022/DEV0248 are delivered. Ready to start persistence using the existing M8 booking-window/block authority; no requirement to copy message storage into notes.

Athlete is the existing training-participant capability; internal `client` names remain compatible. No arbitrary athlete directory or group-note access is added. Account deletion/retention remains DEV0165 and must not be invented here.

## Implementation plan

1. Review the completed note contract, installed PostgreSQL/Drizzle/Next.js documentation and current actor/booking patterns; confirm M8 block integration.
2. Implement additive constrained schema, grants/functions, original-booking authorization and optimistic/bounded mutations.
3. Expose separate typed coach/athlete projections and recoverable server results; exclude coach-private metadata at the source.
4. Test safe fresh/upgrade migrations, isolation, status/block/author permissions, plan uniqueness, bounds, retries/conflicts and rebooking separation.
5. Run relevant test/static/build checks and record exact changed paths, migration/rollback and acceptance evidence.

## Acceptance criteria

- [ ] AC1: Existing bookings gain additive bounded workspaces with at most one active coach-authored plan; pending requests gain no note workspace.
- [ ] AC2: Shared reads are exact-booking-participant only and private content/metadata is coach-only in PostgreSQL and serialized projections.
- [ ] AC3: Status/block/author mutations and optimistic conflicts are atomic; removal/reconnection preserves original retained notes and permissions.
- [ ] AC4: Cross-booking/cross-dataset/unrelated/malformed/blank-entry/oversized/stale/over-limit operations fail closed without partial writes.
- [ ] AC5: Bounded typed repository/service/action projections support both note interfaces without raw table access or private-data leakage.
- [ ] AC6: Fresh/upgrade migration, pgTAP/database integration, relevant unit, lint/type/format/build checks pass.

## Validation plan

Use safe isolated fresh/upgrade databases, npm run db:test, npm run db:lint and affected npm run test:db coverage. Prove role grants, exact participant/private projection, shared block-window rules, original-booking history, edit races and bounds. Run relevant unit/server tests, npm run lint, npm run typecheck, npm run format:check and npm run build. UI evidence belongs to DEV0184/DEV0185.

## Implementation record

Pending runtime implementation. DEV0182 adopted the detailed contract and updated this plan on 2026-10-16; none of this ticket's runtime acceptance criteria are claimed passed.

### Changes and rationale

No runtime implementation yet. The planning revision removes duplicated request chat and keeps original-booking content separate from the ongoing inbox. The user's later scope clarification explicitly identifies this existing ticket as the separate session-notes backend follow-up, with its existing interface peers retaining their ownership.

### Affected files

Planning-only changes on 2026-10-16: this ticket records the separate follow-up boundary; [COR0015](../organisatory/COR0015-session-notes-and-training-plans.md) records the user's scope clarification; the [ticket index](../../README.md) labels the dedicated follow-up. No application files or product requirements changed. Record actual runtime files and roles when implementation starts.

### Decisions and deviations

- 2026-10-16: At the user's request, keep session notes as separate follow-up work using DEV0183 and its existing interface peers. Backend/interface ownership and section 17 behavior remain unchanged; implemented session Messages remain the independent delivered baseline.

- 2026-10-15: Reconcile the active scope with M8/DEV0243. General conversations/request cards move to independent COR0022; original-booking plans/notes remain here. Shared writes must respect M8 block windows, while retained reads and coach-private authority remain separate.

Dated earlier planning history (superseded where it proposes request chat):

- 2026-10-14: Updated planning vocabulary to athlete and made connection-independent session authorization explicit; existing filenames/IDs and earlier history remain intact. Session-content contract adoption still belongs to DEV0182.

- 2026-10-16: DEV0182 adopted section 17, recorded the delivered session-message baseline and assigned shared note UI to DEV0184 before DEV0185 integration. No runtime edit was made under this planning update.

### Contracts, configuration, and operations

Planned additive note schema and typed server interfaces; no environment/provider change is required. Record actual migration/rollback details before applying migrations.

## Validation results

Runtime acceptance criteria are not run. DEV0182 records documentation checks for the 2026-10-16 contract/ownership update; DEV0243 retains the earlier boundary-amendment evidence. No browser/database implementation evidence is claimed for this ticket.

Separate-follow-up planning validation on 2026-10-16:

- `python3 /tmp/dev0182-check-docs.py`: passed 11 documents and 363 relative links/anchors, five unique IDs, four reciprocal COR0015 members, index/status consistency and contract assertions. This temporary read-only checker was reused from DEV0182; it is not an application test dependency.
- `npx --no-install prettier --check tickets/README.md tickets/current/backend/DEV0183-persist-authorized-session-notes.md tickets/current/organisatory/COR0015-session-notes-and-training-plans.md`: all three planning documents passed.
- `git diff --check`: passed. Application/database/browser tests are not applicable to this planning-only clarification; runtime acceptance criteria above remain unchecked.

## Risks, limitations, and follow-ups

Private data must be excluded by database/server projections, not browser hiding. Notes may be sensitive and must not enter logs, analytics or unrelated responses. Original IDs, author ownership and optimistic versions prevent content transfer/loss. Note/M8 integration needs combined evidence when both are delivered; each coordination retains its own completion boundary.

## Completion and review references

- Completed: Not completed.
- Commit: Earlier planning record retained in Git history; this boundary revision belongs to DEV0243, with no owned runtime commit yet.
- Review: Planning self-review only; no independent implementation review.
- Deployment or release: Not implemented or deployed.
