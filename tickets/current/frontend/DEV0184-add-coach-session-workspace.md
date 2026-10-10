# Ticket DEV0184: Add the coach session workspace

- Status: Draft
- Created: 2026-10-10
- Last updated: 2026-10-10
- Milestone: Scheduling-only session collaboration follow-up
- Coordination: [COR0015 — Session notes and training plans](../organisatory/COR0015-session-notes-and-training-plans.md)
- Related records: contract dependency [DEV0182 — Adopt the session-notes contract](../organisatory/DEV0182-adopt-session-notes-contract.md), backend dependency [DEV0183 — Persist authorized session notes](../backend/DEV0183-persist-authorized-session-notes.md), request-interface dependency [DEV0189 — Add coach booking-request controls](DEV0189-add-coach-booking-request-controls.md), client peer [DEV0185 — Add client session collaboration](DEV0185-add-client-session-collaboration.md), coach-bookings baseline [DEV0170 — Separate coach Schedule and Bookings tabs](../../archive/frontend/DEV0170-separate-coach-schedule-and-bookings-tabs.md)

## Objective and context

Extend each coach-owned pending request and booking detail with a usable collaboration workspace. Coaches need isolated request conversations before selection, then a continuing confirmed-session area for a plan, shared guidance and personal comments. The interface must make candidate isolation and shared/private visibility unmistakable before any coach types sensitive content.

## Scope and non-goals

- In scope:
  - Add an expandable or dedicated booking-card workspace in Coach workspace → Bookings.
  - Add an isolated shared thread to each pending request created by DEV0189; accepting one continues only that thread into the booking.
  - Present and edit the one shared training plan with explicit client-visible copy.
  - Present the shared chronological note thread and allow the coach to add/edit their entries.
  - Present coach-private notes in a visually and semantically separate region with no shared/private toggle.
  - Handle pending, declined, withdrawn, expired, not-selected, confirmed, completed, cancelled, stale-edit, validation, authorization and unavailable states responsively and accessibly.
- Out of scope:
  - Client My sessions changes owned by DEV0185.
  - Attachments, rich text, live chat, notifications, read receipts, templates or cross-session client records.
  - Moving booked-session detail back into Schedule.

## Expected behavior and edge cases

- A coach opens notes from the existing Bookings card without losing client, time, location or status context.
- Pending request threads are isolated per client. Terminal unsuccessful request threads are read-only, and only the accepted request's thread continues into the confirmed booking.
- The shared-plan editor states that its content is visible to the named client. Saving is explicit, duplicate submissions are guarded and stale versions preserve the coach's draft while prompting reload/retry.
- Shared notes show author, timestamp and edited state. The coach can add a note and edit only their own shared entries.
- The private section uses distinct heading, explanatory copy and styling. It never reuses a visibility switch that could accidentally publish a private draft.
- Cancelled bookings display retained content read-only. Completed bookings permit post-session shared and private notes.
- Loading/database failure shows no cached or fabricated content and leaves booking-level actions understandable.

## Assumptions, decisions, and dependencies

- DEV0182, DEV0183 and DEV0189 must complete before this ticket becomes Ready.
- Reuse the existing Bookings tab and booking-card component rather than add a fourth coach-workspace tab.
- A disclosure panel is preferred for scanning many bookings, but the final component may use a detail region if keyboard behavior and mobile layout are clearer; record the choice before implementation.
- Plain-text textareas preserve line breaks. Content is rendered as text, not interpreted Markdown/HTML.
- Coach-private note count or existence must not be placed in any component shared with the client projection.

## Implementation plan

1. Review the delivered DEV0183 coach projection/actions and relevant bundled Next.js documentation.
2. Add session-workspace state and components to the coach Bookings surface while preserving existing cancellation/completion behavior.
3. Build separate plan, shared-thread and private-note forms with character counts, explicit saves, pending guards and recoverable conflicts.
4. Add responsive styles and accessible labels, focus order, status/error announcements and read-only terminal presentation.
5. Add unit/component/browser coverage and complete authenticated desktop/mobile rehearsal against a real local booking.

## Acceptance criteria

- [ ] AC1: The owning coach can exchange isolated shared notes in each pending request, continue only the accepted thread and create/revise one clearly client-visible training plan for the booking.
- [ ] AC2: The coach can add/edit shared entries and separately add/edit coach-private entries without an ambiguous visibility toggle.
- [ ] AC3: Terminal unsuccessful request/cancelled content is read-only, completed content accepts post-session notes, and stale/unavailable/validation failures preserve truthful recoverable UI.
- [ ] AC4: Keyboard and responsive desktop/mobile flows keep booking context, private visibility copy and mutation feedback usable.
- [ ] AC5: Browser and negative-projection tests prove the coach view receives only its bookings and the private interface does not affect Schedule or public surfaces.

## Validation plan

- Add focused component/unit tests for section visibility, status rules, local draft preservation and action-result handling.
- Add Playwright coverage for plan save/edit, shared/private note save/edit, cancellation read-only behavior, keyboard operation and unavailable/conflict feedback at desktop and mobile widths.
- Perform an authenticated local rehearsal with a provisioned coach and real client booking; inspect rendered text and network/action results for visibility mistakes.
- Run configured test, lint, type-check, format and production-build commands. Database authority remains primarily evidenced by DEV0183.

## Implementation record

Pending implementation.

### Changes and rationale

Pending implementation.

### Affected files

| File or component | Change and purpose |
| ----------------- | ------------------ |
| Pending           | Pending.           |

### Decisions and deviations

No implementation decisions or deviations recorded yet.

### Contracts, configuration, and operations

This ticket consumes DEV0183's coach projection/actions. No new environment variable, dependency or migration is planned.

## Validation results

Pending validation.

- Date and environment: Not run.
- Exact commands and outcomes: Not run.
- Manual steps and observed outcomes: Not run.
- Failed, blocked, or not-run checks: All checks await DEV0183, DEV0189 and implementation.

| Criterion | Evidence | Result  |
| --------- | -------- | ------- |
| AC1       | Pending  | Not run |
| AC2       | Pending  | Not run |
| AC3       | Pending  | Not run |
| AC4       | Pending  | Not run |
| AC5       | Pending  | Not run |

## Risks, limitations, and follow-ups

- Accidental sharing is the primary interface risk. Private composition must remain visually and structurally separate from the shared plan/thread.
- Large booking histories need lazy/disclosed detail so every session does not render multiple open editors at once.
- No attachment or reusable-template affordance should imply unsupported persistence.

## Completion and review references

- Completed: Not completed.
- Commit: Planning record included in this commit — `[DEV0182][DEV0183][DEV0184][DEV0185][DEV0186][DEV0187][DEV0188][DEV0189][DEV0190] Plan session collaboration and booking requests`; implementation not started.
- Review: No review created.
- Deployment or release: Not deployed or released.
