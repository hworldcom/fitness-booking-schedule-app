# Ticket DEV0183: Persist authorized session notes

- Status: Draft
- Created: 2026-10-10
- Last updated: 2026-10-15
- Milestone: Scheduling-only session collaboration follow-up
- Coordination: [COR0015 — Session notes and training plans](../organisatory/COR0015-session-notes-and-training-plans.md)
- Related records: contract dependency [DEV0182 — Adopt the session-notes contract](../organisatory/DEV0182-adopt-session-notes-contract.md), completed booking-request dependency [DEV0188 — Persist multi-candidate booking requests](../../archive/backend/DEV0188-persist-multi-candidate-booking-requests.md), interface consumers [DEV0184 — Add the coach session workspace](../frontend/DEV0184-add-coach-session-workspace.md) and [DEV0185 — Add athlete session collaboration](../frontend/DEV0185-add-client-session-collaboration.md), booking baseline [DEV0141 — Persist direct private bookings](../../archive/backend/DEV0141-persist-direct-private-bookings.md), account-deletion follow-up [DEV0165 — Implement the account-deletion lifecycle](DEV0165-implement-account-deletion-lifecycle.md); independent messaging-contract dependency [DEV0243](../../archive/organisatory/DEV0243-define-ongoing-messages-and-session-note-boundaries.md); independent messaging runtime [COR0022](../../archive/organisatory/COR0022-private-messaging-and-booking-context.md)

## Planning boundary revised — 2026-10-15

The user adopted Airbnb-style contact/consent while retaining one ongoing pair conversation and separate booking notes. DEV0243 reconciles this plan; COR0022 owns messages/inquiries/request cards. The earlier proposal for a conversation per pending request is superseded, not an active implementation instruction. The previously accepted shared-plan/shared-note/coach-private intent remains. This revision implements no note runtime.

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
- Malformed, empty, oversized, stale, excessive, unrelated and cross-dataset operations fail without partial writes or private metadata leakage.

## Assumptions, decisions, and dependencies

Start after DEV0182 finalizes the detailed note contract. DEV0188 is complete. Consume a stable COR0022 booking-window/block authority when integrating shared writes; no requirement to copy message storage into notes.

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
- [ ] AC4: Cross-booking/cross-dataset/unrelated/malformed/empty/oversized/stale/over-limit operations fail closed without partial writes.
- [ ] AC5: Bounded typed repository/service/action projections support both note interfaces without raw table access or private-data leakage.
- [ ] AC6: Fresh/upgrade migration, pgTAP/database integration, relevant unit, lint/type/format/build checks pass.

## Validation plan

Use safe isolated fresh/upgrade databases, npm run db:test, npm run db:lint and affected npm run test:db coverage. Prove role grants, exact participant/private projection, shared block-window rules, original-booking history, edit races and bounds. Run relevant unit/server tests, npm run lint, npm run typecheck, npm run format:check and npm run build. UI evidence belongs to DEV0184/DEV0185.

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

No implementation decisions or deviations recorded yet.

### Contracts, configuration, and operations

Planned additive note schema and typed server interfaces; no environment/provider change is required. Record actual migration/rollback details before applying migrations.

## Validation results

Runtime acceptance criteria are not run. DEV0243 owns link/status/membership and semantic checks of this planning revision. Do not infer implementation or completed browser/database evidence from the contract amendment.

## Risks, limitations, and follow-ups

Private data must be excluded by database/server projections, not browser hiding. Notes may be sensitive and must not enter logs, analytics or unrelated responses. Original IDs, author ownership and optimistic versions prevent content transfer/loss. Note/M8 integration needs combined evidence when both are delivered; each coordination retains its own completion boundary.

## Completion and review references

- Completed: Not completed.
- Commit: Earlier planning record retained in Git history; this boundary revision belongs to DEV0243, with no owned runtime commit yet.
- Review: Planning self-review only; no independent implementation review.
- Deployment or release: Not implemented or deployed.
