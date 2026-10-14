# Ticket DEV0185: Add athlete session collaboration

- Status: Draft
- Created: 2026-10-10
- Last updated: 2026-10-14
- Milestone: Scheduling-only session collaboration follow-up
- Coordination: [COR0015 — Session notes and training plans](../organisatory/COR0015-session-notes-and-training-plans.md)
- Related records: contract dependency [DEV0182 — Adopt the session-notes contract](../organisatory/DEV0182-adopt-session-notes-contract.md), backend dependency [DEV0183 — Persist authorized session notes](../backend/DEV0183-persist-authorized-session-notes.md), completed request-interface dependency [DEV0190 — Add the client booking-request flow](../../archive/frontend/DEV0190-add-client-booking-request-flow.md), coach peer [DEV0184 — Add the coach session workspace](DEV0184-add-coach-session-workspace.md), athlete-history baseline [DEV0144 — Show client booking history](../../archive/frontend/DEV0144-show-client-booking-history.md)

## Objective and context

Add the athlete-facing collaboration area to My sessions. Athletes need an isolated conversation after submitting an approval request and, if selected, continuity into the confirmed session's training plan and post-session exchange. The interface must expose only the exact athlete's shared content and must not reveal another candidate or whether the coach stored private notes.

## Scope and non-goals

- In scope:
  - Show and compose the exact athlete's isolated shared thread within a pending request created by DEV0190.
  - Continue only an accepted request's thread into the confirmed booking; show unsuccessful terminal request threads read-only.
  - Show a coach-authored shared plan within the athlete's exact booking context.
  - Show the chronological shared thread with author, timestamp and edited state.
  - Let the booked athlete add and edit their own shared notes on confirmed/completed sessions.
  - Present cancelled content read-only and handle empty, stale, validation, authorization and unavailable states.
  - Prove that athlete projections and rendered output contain no coach-private body, identifier, count, timestamps or existence flag.
- Out of scope:
  - Coach interface behavior owned by DEV0184.
  - Athlete edits to the coach-authored plan or the coach's shared entries.
  - General coach messaging, attachments, rich text, notifications, read receipts, templates or cross-session history.

## Expected behavior and edge cases

- Under [DEV0230](../../archive/organisatory/DEV0230-adopt-reconnection-history-recovery.md), disconnection never deletes or resets retained shared conversations/plans/notes. Reconnected history reopens the same original request/booking content, including declined/withdrawn/expired/not-selected request threads and cancelled-session content. Preserve authors, timestamps, edited state and status permissions; terminal/cancelled content stays read-only. Complete pair-history references/navigation belong to DEV0221–DEV0223, and coach-private content never enters shared recovery.

- Athlete is the existing training-participant capability adopted by [DEV0219](../../archive/organisatory/DEV0219-adopt-athlete-connections-contract.md). Pending/accepted/removed coach–athlete connections neither gate exact request/session participant access nor merge content across sessions.

- The athlete opens request/session details from My sessions and keeps coach, time, venue and request/booking status visible.
- Pending shared notes belong only to that request. The athlete receives no other candidate identifiers, counts, statuses or content.
- An absent plan is presented neutrally; the interface does not fabricate starter content or imply the coach failed to act.
- Shared entries identify coach/athlete authors without exposing private profile fields. The athlete can add a valid note and edit only their own note.
- Completed bookings remain writable for follow-up; cancelled bookings retain shared content read-only.
- If a time is cancelled and rebooked, the new booking begins empty even when it uses the same occurrence.
- Database/auth failure shows an unavailable state and no stale or partial session content.

## Assumptions, decisions, and dependencies

- DEV0182, DEV0183 and DEV0190 must complete before this ticket becomes Ready. It may implement in parallel with DEV0184 afterward.
- Reuse the existing My sessions grouping and booking cards instead of adding a global inbox.
- The athlete projection is structurally separate from the coach projection; frontend filtering of a larger object is not an acceptable privacy control.
- Plain-text content is rendered without Markdown/HTML interpretation.
- The user previously used `student`; the website target now uses athlete under DEV0219. Existing internal `client` identifiers remain compatible, with no new identity role.

## Implementation plan

1. Review the delivered DEV0183 athlete projection/actions and relevant bundled Next.js documentation.
2. Add a disclosed session-detail area to My sessions with the shared plan and chronological shared thread. Reuse the original request/booking detail entry points for reconnected history links without rebuilding/copying conversation content; aggregate history navigation stays DEV0223.
3. Add bounded athlete note create/edit forms with pending guards, character feedback and recoverable stale/unavailable results.
4. Add accessible responsive styles and confirmed/completed/cancelled empty/read-only states.
5. Add component/browser privacy assertions and complete an authenticated two-account desktop/mobile exchange rehearsal.

## Acceptance criteria

- [ ] AC1: The requesting/booked athlete can read the exact request thread and accepted booking's shared plan/thread without receiving other-candidate or coach-private content/metadata.
- [ ] AC2: The athlete can add/edit only their own shared notes on confirmed/completed bookings and cannot mutate the plan or coach entries.
- [ ] AC3: Unsuccessful terminal requests and cancelled sessions remain read-only, only the accepted thread continues, rebooked sessions begin empty and empty/unavailable/conflict states remain truthful and recoverable. Original detail links opened from reconnected history render all retained shared content with original identity/status, no reset/duplicate thread and no coach-private metadata.
- [ ] AC4: The session detail remains keyboard-usable and responsive while preserving existing coach identity, time, venue, history and cancellation behavior.
- [ ] AC5: Two-account end-to-end evidence proves that a coach sees the athlete's shared entry, the athlete sees coach-shared content, and the athlete never receives coach-private data.

## Validation plan

Verify retained original request/booking content and stable identifiers across connection-state changes, unsuccessful request states and cancelled sessions; the recovered shared projection excludes coach-private and unrelated content. When COR0020 runtime is delivered, additionally rehearse either-participant disconnection and fresh mutual reconnection through its complete history navigation. This ticket does not implement pair-history navigation or claim that combined runtime result before both deliveries.

- Add focused component/unit tests for shared-only rendering, author ownership, status behavior, draft preservation and action results.
- Add Playwright coverage at desktop/mobile widths for plan/thread reading, athlete note create/edit, completed/cancelled behavior, keyboard use and unavailable/conflict states.
- Perform an authenticated coach/athlete rehearsal on one real booking, including an explicit network/serialized-projection check that private metadata is absent.
- Run configured test, lint, type-check, format and production-build commands. DEV0183 owns database-level authority evidence.

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

This ticket consumes DEV0183's athlete-only projection/actions. No new environment variable, dependency or migration is planned.

## Validation results

Pending validation.

- Date and environment: Not run.
- Exact commands and outcomes: Not run.
- Manual steps and observed outcomes: Not run.
- Failed, blocked, or not-run checks: All checks await DEV0183, DEV0190 and implementation.

| Criterion | Evidence | Result  |
| --------- | -------- | ------- |
| AC1       | Pending  | Not run |
| AC2       | Pending  | Not run |
| AC3       | Pending  | Not run |
| AC4       | Pending  | Not run |
| AC5       | Pending  | Not run |

## Risks, limitations, and follow-ups

- Privacy must be proved at the projection/authorization boundary; DOM hiding or omitted labels are insufficient.
- Long histories should keep detail collapsed until requested to avoid rendering every thread and editor.
- General contact, notifications and cross-session conversation remain separate future work.

## Completion and review references

- Completed: Not completed.
- Commit: Planning record included in this commit — `[DEV0182][DEV0183][DEV0184][DEV0185][DEV0186][DEV0187][DEV0188][DEV0189][DEV0190] Plan session collaboration and booking requests`; implementation not started.
- Review: No review created.
- Deployment or release: Not deployed or released.
