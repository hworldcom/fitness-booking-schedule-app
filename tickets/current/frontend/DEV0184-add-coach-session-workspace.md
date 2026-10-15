# Ticket DEV0184: Add the coach session workspace

- Status: Draft
- Created: 2026-10-10
- Last updated: 2026-10-15
- Milestone: Scheduling-only session collaboration follow-up
- Coordination: [COR0015 — Session notes and training plans](../organisatory/COR0015-session-notes-and-training-plans.md)
- Related records: contract dependency [DEV0182 — Adopt the session-notes contract](../organisatory/DEV0182-adopt-session-notes-contract.md), backend dependency [DEV0183 — Persist authorized session notes](../backend/DEV0183-persist-authorized-session-notes.md), completed request-interface dependency [DEV0189 — Add the coach booking-request queue](../../archive/frontend/DEV0189-add-coach-booking-request-queue.md), athlete peer [DEV0185 — Add athlete session collaboration](DEV0185-add-client-session-collaboration.md), coach-bookings baseline [DEV0170 — Separate coach Schedule and Bookings tabs](../../archive/frontend/DEV0170-separate-coach-schedule-and-bookings-tabs.md); independent messaging-contract dependency [DEV0243](../organisatory/DEV0243-define-ongoing-messages-and-session-note-boundaries.md)

## Planning revision pending — 2026-10-15

The user now wants one ongoing coach–athlete message conversation containing session requests, while individual booking sessions contain coach/athlete notes. [DEV0243](../organisatory/DEV0243-define-ongoing-messages-and-session-note-boundaries.md) owns the new contract and its reconciliation with these earlier Draft plans. The per-request conversation model below is the earlier proposal and must be revised before implementation; it is not an adopted messaging contract. Existing session-note, shared-plan and coach-private-note intentions remain subject to that review rather than being silently removed.

## Objective and context

Extend each coach-owned pending request and booking detail with a usable collaboration workspace. Coaches need isolated request conversations before selection, then a continuing confirmed-session area for a plan, shared guidance and personal comments. The interface must make candidate isolation and shared/private visibility unmistakable before any coach types sensitive content.

## Scope and non-goals

- In scope:
  - Add an expandable or dedicated booking-card workspace in Coach workspace → Bookings.
  - Add an isolated shared thread to each pending request created by DEV0189; accepting one continues only that thread into the booking.
  - Present and edit the one shared training plan with explicit athlete-visible copy.
  - Present the shared chronological note thread and allow the coach to add/edit their entries.
  - Present coach-private notes in a visually and semantically separate region with no shared/private toggle.
  - Handle pending, declined, withdrawn, expired, not-selected, confirmed, completed, cancelled, stale-edit, validation, authorization and unavailable states responsively and accessibly.
- Out of scope:
  - Athlete My sessions changes owned by DEV0185.
  - Attachments, rich text, live chat, notifications, read receipts, templates or cross-session athlete records.
  - Moving booked-session detail back into Schedule.

## Expected behavior and edge cases

- Under [DEV0230](../../archive/organisatory/DEV0230-adopt-reconnection-history-recovery.md), disconnection never deletes or resets retained shared conversations/plans/notes. Reconnected history reopens the same original request/booking content, including declined/withdrawn/expired/not-selected request threads and cancelled-session content. Preserve authors, timestamps, edited state and status permissions; terminal/cancelled content stays read-only. Complete pair-history references/navigation belong to DEV0221–DEV0223, and coach-private content never enters shared recovery.

- Athlete is the existing training-participant capability adopted by [DEV0219](../../archive/organisatory/DEV0219-adopt-athlete-connections-contract.md). Pending/accepted/removed coach–athlete connections neither gate exact request/session participant access nor merge content across sessions.

- A coach opens notes from the existing Bookings card without losing athlete, time, location or status context.
- Pending request threads are isolated per athlete. Terminal unsuccessful request threads are read-only, and only the accepted request's thread continues into the confirmed booking.
- The shared-plan editor states that its content is visible to the named athlete. Saving is explicit, duplicate submissions are guarded and stale versions preserve the coach's draft while prompting reload/retry.
- Shared notes show author, timestamp and edited state. The coach can add a note and edit only their own shared entries.
- The private section uses distinct heading, explanatory copy and styling. It never reuses a visibility switch that could accidentally publish a private draft.
- Cancelled bookings display retained content read-only. Completed bookings permit post-session shared and private notes.
- Loading/database failure shows no cached or fabricated content and leaves booking-level actions understandable.

## Assumptions, decisions, and dependencies

- DEV0182 and DEV0183 must complete before this ticket becomes Ready; DEV0189 is complete.
- Reuse the existing Bookings tab and booking-card component rather than add a fourth coach-workspace tab.
- A disclosure panel is preferred for scanning many bookings, but the final component may use a detail region if keyboard behavior and mobile layout are clearer; record the choice before implementation.
- Plain-text textareas preserve line breaks. Content is rendered as text, not interpreted Markdown/HTML.
- Coach-private note count or existence must not be placed in any component shared with the athlete projection.

## Implementation plan

1. Review the delivered DEV0183 coach projection/actions and relevant bundled Next.js documentation.
2. Add session-workspace state and components to the coach Bookings surface while preserving existing cancellation/completion behavior.
3. Build separate plan, shared-thread and private-note forms with character counts, explicit saves, pending guards and recoverable conflicts.
4. Add responsive styles and accessible labels, focus order, status/error announcements and read-only terminal presentation. Reuse original request/booking detail entry points for reconnected history links without rebuilding/copying conversation content; aggregate history navigation stays DEV0222.
5. Add unit/component/browser coverage and complete authenticated desktop/mobile rehearsal against a real local booking.

## Acceptance criteria

- [ ] AC1: The owning coach can exchange isolated shared notes in each pending request, continue only the accepted thread and create/revise one clearly athlete-visible training plan for the booking.
- [ ] AC2: The coach can add/edit shared entries and separately add/edit coach-private entries without an ambiguous visibility toggle.
- [ ] AC3: Terminal unsuccessful request/cancelled content is read-only, completed content accepts post-session notes, and stale/unavailable/validation failures preserve truthful recoverable UI. Original detail links opened from reconnected history render retained shared content with its original identity/status and no reset or duplicate accepted thread; coach-private material remains separately authorised.
- [ ] AC4: Keyboard and responsive desktop/mobile flows keep booking context, private visibility copy and mutation feedback usable.
- [ ] AC5: Browser and negative-projection tests prove the coach view receives only its bookings and the private interface does not affect Schedule or public surfaces.

## Validation plan

Verify retained original request/booking content and stable identifiers across connection-state changes, unsuccessful request states and cancelled sessions; the recovered shared projection excludes coach-private and unrelated content. When COR0020 runtime is delivered, additionally rehearse either-participant disconnection and fresh mutual reconnection through its complete history navigation. This ticket does not implement pair-history navigation or claim that combined runtime result before both deliveries.

- Add focused component/unit tests for section visibility, status rules, local draft preservation and action-result handling.
- Add Playwright coverage for plan save/edit, shared/private note save/edit, cancellation read-only behavior, keyboard operation and unavailable/conflict feedback at desktop and mobile widths.
- Perform an authenticated local rehearsal with a provisioned coach and real athlete booking; inspect rendered text and network/action results for visibility mistakes.
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

- 2026-10-14: Updated planning vocabulary to athlete and made connection-independent session authorization explicit; existing filenames/IDs and earlier history remain intact. Session-content contract adoption still belongs to DEV0182.

No implementation decisions or deviations recorded yet.

### Contracts, configuration, and operations

This ticket consumes DEV0183's coach projection/actions. No new environment variable, dependency or migration is planned.

## Validation results

Pending validation.

- Date and environment: Not run.
- Exact commands and outcomes: Not run.
- Manual steps and observed outcomes: Not run.
- Failed, blocked, or not-run checks: All checks await DEV0183 and implementation; DEV0189 is complete.

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
