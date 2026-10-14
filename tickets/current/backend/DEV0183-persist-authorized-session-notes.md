# Ticket DEV0183: Persist authorized session notes

- Status: Draft
- Created: 2026-10-10
- Last updated: 2026-10-14
- Milestone: Scheduling-only session collaboration follow-up
- Coordination: [COR0015 — Session notes and training plans](../organisatory/COR0015-session-notes-and-training-plans.md)
- Related records: contract dependency [DEV0182 — Adopt the session-notes contract](../organisatory/DEV0182-adopt-session-notes-contract.md), completed booking-request dependency [DEV0188 — Persist multi-candidate booking requests](../../archive/backend/DEV0188-persist-multi-candidate-booking-requests.md), interface consumers [DEV0184 — Add the coach session workspace](../frontend/DEV0184-add-coach-session-workspace.md) and [DEV0185 — Add athlete session collaboration](../frontend/DEV0185-add-client-session-collaboration.md), booking baseline [DEV0141 — Persist direct private bookings](../../archive/backend/DEV0141-persist-direct-private-bookings.md), account-deletion follow-up [DEV0165 — Implement the account-deletion lifecycle](DEV0165-implement-account-deletion-lifecycle.md)

## Objective and context

Persist the request/session-workspace contract adopted by DEV0182 with actor-scoped PostgreSQL authority and bounded server projections. Pending booking requests and confirmed bookings expose schedule/participant context but have no isolated conversation that can continue for the selected athlete or support later shared/private session content. This ticket adds that data boundary without creating a public messaging system.

## Scope and non-goals

- In scope:
  - Add an additive migration for request/booking-bound shared notes plus booking-bound shared plans and coach-private notes with stable identifiers, author identity, timestamps and optimistic versions.
  - Enforce isolated request threads, accepted-request continuity, one active shared plan per booking, participant-only shared reads, coach-only private reads/writes, author-owned edits, status-aware mutations and rebooking isolation.
  - Add bounded domain projections, repository/service mutations and server-action results needed by both participant interfaces.
  - Add fresh/upgrade migration, PostgreSQL authorization/concurrency and application integration tests.
- Out of scope:
  - Coach/athlete presentation owned by DEV0184/DEV0185.
  - Attachments, rich text, live subscriptions, notification delivery, read receipts, templates, cross-booking records or automated analysis.
  - Resolving the future account-deletion retention policy owned by DEV0165.

## Expected behavior and edge cases

- Athlete is the existing training-participant capability adopted by [DEV0219](../../archive/organisatory/DEV0219-adopt-athlete-connections-contract.md). Pending/accepted/removed coach–athlete connections neither gate exact request/session participant access nor merge content across sessions.

- Content always resolves through the exact request or booking UUID and current actor context. Slot or occurrence identity alone never grants access.
- Pending request participants can exchange shared notes only inside that request. Other candidates for the same occurrence receive no content or metadata.
- Acceptance links the selected request workspace to the confirmed booking without copying/merging another candidate's thread. Declined, withdrawn, expired and not-selected request threads become read-only.
- The coach can upsert the shared plan with optimistic conflict detection. The athlete cannot mutate the plan.
- Either participant can add a bounded shared note and edit only their own note. Only the owning coach can add/edit coach-private notes.
- Confirmed and completed bookings accept valid mutations; cancelled bookings return a conflict and preserve existing content read-only.
- A different athlete, unrelated coach, guest, cross-run actor, malformed identifier, oversized body, empty body, stale version or excessive entry count fails without partial mutation or private metadata leakage.
- Queries return a bounded deterministic order and exclude private rows entirely from athlete projections.

## Assumptions, decisions, and dependencies

- DEV0182 and DEV0188 must complete before this ticket becomes Ready.
- Prefer one normalized session-content table with constrained `plan`, `shared_note` and `coach_private_note` kinds if database constraints can express the uniqueness and visibility rules clearly; otherwise split the single plan from note entries and record the reason before implementation.
- Store plain text in PostgreSQL. React renders it as text; no HTML or Markdown interpretation is needed.
- The migration is additive. Existing bookings begin with an empty workspace, and cancelled/history bookings receive no fabricated rows.
- Raw tables remain inaccessible to browser roles. Actor-aware database functions and transaction-local authorization remain the mutation/query authority.

## Implementation plan

1. Review the completed DEV0182 contract, DEV0188 request identity/lifecycle, installed PostgreSQL/Drizzle patterns and current booking functions.
2. Add schema, constraints, indexes, grants and actor-aware functions for bounded projection and mutation.
3. Extend domain, repository and service contracts with separate coach and athlete projections so private metadata cannot be accidentally serialized to athletes.
4. Add server actions with canonical identifier/body/version validation and precise saved/conflict/forbidden/unavailable results.
5. Test fresh and upgrade migrations, cross-candidate isolation, accepted-request continuity, booking-state behavior, plan uniqueness, note limits, stale edits and rebooking separation.

## Acceptance criteria

- [ ] AC1: Pending requests and existing bookings gain additive isolated workspaces, and each booking can hold at most one active coach-authored shared plan.
- [ ] AC2: Shared content is readable only by the exact request/booking participants; private content and its metadata are returned only to the owning coach.
- [ ] AC3: Pending request exchange, accepted-thread continuity, terminal-request/cancelled read-only behavior, confirmed/completed mutations, author-owned editing and optimistic conflicts are enforced atomically in PostgreSQL.
- [ ] AC4: Cross-booking, cross-run, unrelated, malformed, empty, oversized, stale and over-limit requests fail closed without partial writes.
- [ ] AC5: Bounded repository/service/server-action projections support DEV0184/DEV0185 without exposing raw table access or private content through the athlete contract.
- [ ] AC6: Fresh/upgrade migration, pgTAP, database integration, unit, lint, type and production-build validation pass for the affected boundary.

## Validation plan

- Run fresh and upgrade Supabase migration paths plus database lint.
- Add pgTAP assertions for constraints, grants, participant reads, private-note isolation, status transitions, edit ownership and concurrency/version behavior.
- Add database integration tests proving pending/accepted/removed connection state cannot widen or remove exact session participant permissions, and for coach/athlete projections, rebooking isolation, bounds and rollback on failure.
- Add domain/server-action unit tests and run the configured test, lint, type-check, format and production-build commands.
- Interface browser validation is owned by DEV0184 and DEV0185.

## Implementation record

Pending implementation.

### Changes and rationale

Pending implementation.

### Affected files

| File or component | Change and purpose |
| ----------------- | ------------------ |
| Pending           | Pending.           |

### Decisions and deviations

- 2026-10-14: Updated planning vocabulary to athlete and made connection-independent session authorization explicit; existing filenames/IDs and earlier history remain intact. Session-content contract adoption still belongs to DEV0182.

No implementation decisions or deviations recorded yet.

### Contracts, configuration, and operations

Expected contract changes are one additive database migration and new bounded domain/server interfaces. No environment-variable or external-service change is planned.

## Validation results

Pending validation.

- Date and environment: Not run.
- Exact commands and outcomes: Not run.
- Manual steps and observed outcomes: Not run.
- Failed, blocked, or not-run checks: All implementation checks await DEV0182, DEV0188 and implementation.

| Criterion | Evidence | Result  |
| --------- | -------- | ------- |
| AC1       | Pending  | Not run |
| AC2       | Pending  | Not run |
| AC3       | Pending  | Not run |
| AC4       | Pending  | Not run |
| AC5       | Pending  | Not run |
| AC6       | Pending  | Not run |

## Risks, limitations, and follow-ups

- A projection mistake could leak coach-private content. Separate return types and negative authorization tests are required rather than relying on UI filtering.
- Concurrent plan/note edits need explicit versions; last-write-wins would silently discard participant content.
- Text may contain sensitive information. Do not include bodies in structured logs, thrown errors, analytics or test snapshots containing personal fixtures.
- DEV0165 must later integrate the new authorship/content tables into account deletion and retention behavior.

## Completion and review references

- Completed: Not completed.
- Commit: Planning record included in this commit — `[DEV0182][DEV0183][DEV0184][DEV0185][DEV0186][DEV0187][DEV0188][DEV0189][DEV0190] Plan session collaboration and booking requests`; implementation not started.
- Review: No review created.
- Deployment or release: Not deployed or released.
