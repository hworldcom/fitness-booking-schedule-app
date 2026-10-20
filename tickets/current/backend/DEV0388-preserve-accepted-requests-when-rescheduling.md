# Ticket DEV0388: Preserve accepted requests when rescheduling

- Status: Draft
- Created: 2026-10-20
- Last updated: 2026-10-20
- Milestone: UAT booking recovery
- Coordination: None — independent development ticket
- Related records: [DEV0387](../../archive/frontend/DEV0387-rehearse-and-clean-up-disposable-uat-users.md) (discovering UAT rehearsal; this is a follow-up, not a coordination deliverable)

## Objective and context

DEV0387 found a reproducible failure on UAT source `137a5b9`: an athlete requests a typed private class, the coach accepts it, then an otherwise valid coach duration override returns HTTP 400. The accepted request's composite foreign key references the booking's original slot. `app.coach_session_booking` changes that booking slot and violates `coach_booking_requests_booking_fkey` (SQLSTATE 23503). The transaction rolls back and the confirmed original booking remains unchanged. This violates the existing [flexible session behavior](../../../docs/mvp-spec.md#186-session-types-and-flexible-bookings) and [booking/recovery contract](../../../docs/mvp-spec.md#7-requests-booking-and-recovery).

## Scope and non-goals

Fix request-origin booking rescheduling while retaining the original accepted request and auditable booking changes. Add a meaningful regression through request → accept → override. Do not delete request history, rewrite unrelated bookings, reset accounts or weaken actor authorization. DEV0387 records/tests/cleans fixtures; this ticket has no implemented fix or release.

## Expected behavior and edge cases

The owning coach can override a future confirmed request-origin booking to an available 60/75/90-minute time/location. Original request terms remain historical evidence; the booking detail and change history show the revised terms to its athlete. Stale revisions and invalid overlaps fail atomically, exact retries are idempotent, and other actors cannot alter/read the booking. Cancellation/recovery remains consistent with the revised occurrence.

## Assumptions, decisions, and dependencies

The database diagnosis used only a tagged temporary DEV0387 coach/athlete with rollback. The HTTP reproduction used ordinary UAT actor cookies; no direct SQL result was counted as a successful product interaction. The 2026-10-20 source review below confirms the cause and narrows the proposed correction. The final migration design still needs implementation-level validation; no runtime fix is adopted or applied yet.

## Implementation plan

1. Preserve the accepted request's original slot and reviewed terms while linking it to the booking's stable identity. The proposed migration replaces the changing-slot component of the request-to-booking foreign key with stable dataset/booking/coach/athlete linkage, backed by a matching unique constraint. Validate the original slot match when the acceptance link is first established, and preserve that historical binding afterward. Review the complete constraint/trigger behavior before choosing the final SQL; simply removing integrity checks is insufficient.
2. Add an incremental migration and its preserved-data proof. Existing acceptance constructs the booking from the request's exact slot; keep that authority, participant/dataset binding, unique accepted booking and deletion protection. Update repository contracts only if required. Never alter an archived migration as the deployment mechanism.
3. Add a deterministic request → accept → 60-to-75-minute override regression in addition to the existing direct-coach-booking test. Cover repeated moves, venue/time changes, retry/stale/unauthorized/overlap failure and cancellation. Assert the same booking ID, unchanged original request row, current participant/message projections and retained change history. Exercise migration constraints and appropriate existing integration checks.
4. Run desktop/phone edit flow and a bounded disposable UAT rehearsal with exact cleanup after local validation. Record actual release separately.

## Acceptance criteria

- [ ] AC1: A future confirmed booking created by accepting an athlete request can be rescheduled through the ordinary coach API/UI without a foreign-key error.
- [ ] AC2: Original accepted request terms, revised booking terms and change audit all remain accurate; cancellation/recovery uses the correct occurrence.
- [ ] AC3: Stale, unauthorized, overlapping and altered-retry commands remain atomic failures; exact retries reuse their result.
- [ ] AC4: Required migration/integration checks and mobile/desktop interaction evidence pass; any hosted fixtures are removed and existing data preserved.

## Validation plan

Reproduce with two fresh actors, current default private type and contiguous effective hours: request a 60-minute class; coach accepts; POST `/api/session-bookings?coach=true` with `action:"override"`, current revision, same time/type/venue and `durationMinutes:75`. Current outcome is 400; expected outcome is saved with revision +1 and one change-history entry. Test meaningful database/API authorization and invariants, migration constraints, lint/types/build as appropriate. Use no retained accounts as fixtures.

## Implementation record

Pending implementation. This record captures a discovered defect, not a delivered fix.

### Changes and rationale

No product changes. Planned correction must resolve historical request linkage without removing history or weakening integrity.

### Affected files

Likely incremental migration for `app.coach_session_booking`/request linkage, and focused integration tests. Exact files will be recorded after a strategy is selected. Current source: [typed booking migration](../../../supabase/migrations/20261018000800_typed_private_sessions.sql), [typed session API](../../../src/app/api/session-bookings/route.ts).

### Decisions and deviations

2026-10-20: Keep this fix separate from DEV0387's UAT run. A failed expectation is not a successful booking edit.

### Source review: 2026-10-20

- The [original foreign key](../../../supabase/migrations/20261016000100_baseline.sql#L15302) binds an accepted request to `(run_id, booking_id, slot_id, coach_id, athlete_id)`. The [override command](../../../supabase/migrations/20261018000800_typed_private_sessions.sql#L296) deliberately replaces the booking's current slot while retaining its ID. These two rules conflict even when only duration changes, because the changed interval creates a different slot.
- The [acceptance command](../../../supabase/migrations/20261016000100_baseline.sql#L75) already creates the booking from the exact request slot and participants. Original request terms are historical; rewriting them to the new booking terms would lose that distinction. Stable identity linkage must retain the dataset/participant checks and validate origin at acceptance.
- The [current regression](../../../tests/database/typed-sessions.test.ts#L194) accepts an athlete request, but then creates a separate booking with `action: "create"` and overrides that new booking. It never overrides the accepted request's booking. This explains why direct scheduling passed while DEV0387 found this failure.
- Existing booking details and message-context projections read the current booking/current slot by stable booking ID; cancellation also reads the booking's current slot. They are compatible with separating original request terms from current schedule terms, but need regression coverage after the constraint change. No frontend payload change is indicated by this review.
- This review used repository source and the recorded DEV0387 evidence only. It created no accounts, changed no database rows and ran no new hosted operations. The ticket remains Draft, with implementation and fix validation outstanding.

### Contracts, configuration, and operations

No changes applied. Any schema/rollback/compatibility implications remain to be documented before implementation; no secrets are required in this ticket.

## Validation results

Discovery evidence: ordinary authenticated HTTP returned 400 for the valid override; rollback diagnosis reported SQLSTATE 23503 at the booking `slot_id` update and named `coach_booking_requests_booking_fkey`. Subsequent detail stayed confirmed revision 0, 60 minutes, zero changes. Private evidence: ignored `work/dev0387/phase3-results.json`, `diagnose-override.mjs`, `last-query-error.log`. This is failed product validation, not proof of a fix. All fix acceptance criteria remain untested.

2026-10-20 source review: confirmed the conflicting constraint/update, the direct-booking-only override test gap, and downstream use of current booking identity. Documentation link and formatting checks apply to this planning update; application tests are not applicable because product code/schema did not change.

## Risks, limitations, and follow-ups

Rescheduling bookings originating from accepted requests is currently broken. Until fixed, the original confirmed booking remains usable. Review other commands that change slot identity against this historical foreign key. No automatic fix/deployment performed under the rehearsal ticket.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: Diagnosis self-reviewed; no independent review or fix review.
- Deployment or release: None.
