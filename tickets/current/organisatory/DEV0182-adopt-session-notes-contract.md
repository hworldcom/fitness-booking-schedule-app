# Ticket DEV0182: Adopt the session-notes contract

- Status: Draft
- Created: 2026-10-10
- Last updated: 2026-10-10
- Milestone: Scheduling-only session collaboration follow-up
- Coordination: [COR0015 — Session notes and training plans](COR0015-session-notes-and-training-plans.md)
- Related records: booking-request contract dependency [DEV0186 — Adopt booking-request and notice policies](DEV0186-adopt-booking-request-and-notice-policies.md); implementation peers [DEV0183 — Persist authorized session notes](../backend/DEV0183-persist-authorized-session-notes.md), [DEV0184 — Add the coach session workspace](../frontend/DEV0184-add-coach-session-workspace.md) and [DEV0185 — Add client session collaboration](../frontend/DEV0185-add-client-session-collaboration.md); booking baseline [DEV0141 — Persist direct private bookings](../../archive/backend/DEV0141-persist-direct-private-bookings.md)

## Objective and context

Adopt an authoritative product and privacy contract for request/session collaboration before adding schema or interface behavior. The current [MVP specification](../../../docs/mvp-spec.md#private-booking) defines booking participants and lifecycle but intentionally lists messaging outside the scheduling MVP. The user now wants coaches and clients to exchange session-specific notes, share a training plan and retain coach-only comments; COR0016 additionally establishes an isolated participant relationship while a coach-approval request is pending.

This ticket defines the new capability without implementing runtime code. It must distinguish a booking-bound asynchronous workspace from general messaging and give DEV0183-DEV0185 testable visibility and lifecycle rules.

## Scope and non-goals

- In scope:
  - Update the confirmed decision register, product boundary, participant journeys, private-booking state model, authorization rules, definition of done, milestone language and acceptance matrix.
  - Define one coach-authored shared plan per booking, shared note entries by both participants and coach-private note entries.
  - Define request/booking ownership, read/write behavior across pending, accepted/confirmed, completed, cancelled, declined, withdrawn, expired and not-selected states, author editing, bounded plain-text content and unavailable-state behavior.
  - Record that session content belongs to a booking rather than an availability occurrence and cannot cross into a later booking of the same occurrence.
  - Align downstream native and account-deletion planning links where this new contract materially affects them.
- Out of scope:
  - Database migrations, server actions, interface implementation or runtime tests.
  - Attachments, rich text, real-time chat, notifications, read receipts, reusable templates, longitudinal client files, medical analysis or automated advice.

## Expected behavior and edge cases

- The coach owns one shared training plan per booking; the client reads it and responds through shared notes rather than overwriting it.
- A requesting client and coach can create shared plain-text notes only inside their exact pending request. Candidates cannot discover or read another request/thread.
- If the coach accepts a request, that exact shared thread continues into the confirmed/completed booking. The author may revise their own entry with visible edited state; one participant cannot edit the other's content.
- The coach can create and revise private entries in a separately labelled area. The client and all unrelated actors receive neither private content nor metadata revealing its presence or count.
- Declined, withdrawn, expired and not-selected requests plus cancelled bookings retain existing shared content for their exact participants but become read-only. Completed bookings remain writable for post-session feedback.
- A newly created booking for an occurrence that was reopened after cancellation has a separate empty workspace.
- Database or authorization failure presents an unavailable result and must not fall back to cached, fabricated or partially authorized content.

## Assumptions, decisions, and dependencies

- On 2026-10-10 the user accepted the proposed first-version structure after discussing training-plan sharing, post-session feedback and personal coach comments.
- Existing product terminology uses `client`; the feature treats the user's word `student` as that same booked client rather than adding a new identity role.
- A session workspace is asynchronous request/booking content, not general coach/client messaging. There is no inbox or ability to contact a coach without a persisted pending request or confirmed booking.
- Plain text with preserved line breaks is sufficient. Proposed implementation bounds are 8,000 Unicode characters for the shared plan, 2,000 per note, and at most 100 non-deleted note entries returned per booking; DEV0183 must confirm enforceable byte/request bounds before implementation.
- DEV0186 must complete before this ticket becomes Ready. DEV0141 remains the confirmed-booking authority baseline, and DEV0188 must persist request identities before DEV0183 implements request-bound conversations.

## Implementation plan

1. Add the confirmed session-collaboration decision and remove only the now-superseded blanket statement that all messaging is future scope.
2. Extend participant journeys and the request/private-booking model with isolated pending conversations plus shared-plan, shared-note and coach-private-note boundaries.
3. Define request/session status transitions, participant authorization, accepted-thread continuity, editing, content bounds and fail-closed behavior.
4. Add definition-of-done and acceptance scenarios for isolated candidates, accepted continuity, terminal requests, cancelled/completed sessions, rebooking isolation and unrelated actors.
5. Reconcile COR0015 and downstream ticket references, then run formatting, link and consistency checks.

## Acceptance criteria

- [ ] AC1: The specification defines isolated pending-request conversations plus one coach-authored shared plan, two-way session notes and coach-private notes with no public/cross-candidate access.
- [ ] AC2: Pending/accepted/confirmed/completed/cancelled/declined/withdrawn/expired/not-selected behavior, accepted-thread continuity, author-edit ownership, rebooking isolation and unavailable-state behavior are explicit and testable.
- [ ] AC3: First-version text/entry bounds and non-goals prevent the feature from silently becoming chat, file storage or a longitudinal health record.
- [ ] AC4: COR0015, its four direct DEV records and all affected specification/ticket links agree on ownership, sequence and terminology.

## Validation plan

- Run Prettier against every changed Markdown file and `git diff --check`.
- Check every affected relative Markdown link and verify reciprocal COR0015 membership for DEV0182-DEV0185.
- Use targeted text assertions to confirm the decision register, state model, permissions, definition of done and acceptance matrix each contain the adopted behavior and no remaining blanket messaging exclusion contradicts it.
- Application/database tests are not applicable because this ticket changes only the authoritative contract and work records.

## Implementation record

Pending implementation.

### Changes and rationale

Pending implementation.

### Affected files

| File or component | Change and purpose |
| ----------------- | ------------------ |
| Pending           | Pending.           |

### Decisions and deviations

- 2026-10-10: Planned the feature as one session workspace rather than general direct messaging so authorization stays anchored to an existing booking.
- 2026-10-10: Expanded the workspace anchor to an exact pending request or its accepted booking after the user adopted coach-approved multi-candidate requests; arbitrary pre-request contact remains excluded.

### Contracts, configuration, and operations

This ticket will change the product contract but adds no runtime interface, environment variable, dependency or migration.

## Validation results

Pending validation.

- Date and environment: Not run.
- Exact commands and outcomes: Not run.
- Manual steps and observed outcomes: Not run.
- Failed, blocked, or not-run checks: Runtime checks are not applicable to this documentation-only ticket.

| Criterion | Evidence | Result  |
| --------- | -------- | ------- |
| AC1       | Pending  | Not run |
| AC2       | Pending  | Not run |
| AC3       | Pending  | Not run |
| AC4       | Pending  | Not run |

## Risks, limitations, and follow-ups

- The contract must avoid implying that private coach notes are professional medical records or that MovX provides medical advice.
- DEV0183 owns enforceable storage and request-size details; any material change to the proposed bounds must be recorded here before backend implementation.
- Account-deletion retention remains a linked DEV0165 decision and must not be invented in this ticket.

## Completion and review references

- Completed: Not completed.
- Commit: Planning record included in this commit — `[DEV0182][DEV0183][DEV0184][DEV0185][DEV0186][DEV0187][DEV0188][DEV0189][DEV0190] Plan session collaboration and booking requests`; implementation not started.
- Review: No review created.
- Deployment or release: Documentation only; not deployed or released.
