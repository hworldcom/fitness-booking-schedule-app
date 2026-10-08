# Ticket DEV0163: Deliver the native coach schedule

- Status: Draft
- Created: 2026-10-08
- Last updated: 2026-10-08
- Milestone: Native iOS coach scheduling
- Coordination: [COR0013 — Native iOS application](../organisatory/COR0013-native-ios-application.md)
- Related records: depends on [DEV0160 — Expose the mobile scheduling API](../backend/DEV0160-expose-mobile-scheduling-api.md) and [DEV0161 — Establish the Expo iOS foundation](DEV0161-establish-expo-ios-foundation.md); preserves recurring availability from [DEV0114](../../archive/backend/DEV0114-persist-recurring-coach-availability.md), schedule presentation from [DEV0115](../../archive/frontend/DEV0115-add-coach-schedule-calendar.md) and atomic weekly save from [DEV0146](../../archive/frontend/DEV0146-save-weekly-schedule-in-one-action.md)

## Objective and context

Deliver the coach scheduling capability inside the same native iOS application. Approved, demo and bounded suspended coaches receive an app-specific workspace for their own schedule; ordinary clients and pending/rejected applicants cannot gain coach authority from navigation or local state.

## Scope and non-goals

- In scope: coach-specific versioned API routes/contracts needed by this slice; capability-aware native navigation; owned upcoming/elapsed booking views with bounded client presentation; local recurring working-week draft and one atomic save; cancellation of owned future bookings; completion of owned elapsed confirmed bookings; conflict/session-expiry/error handling; accessibility and device tests.
- Out of scope: coach application/profile/location/portrait editing owned by DEV0164, staff review, arbitrary per-occurrence duration, group classes, waitlists, payments, attendance disputes, notification delivery or external calendar synchronization.

## Expected behavior and edge cases

- Only established coach capability exposes and authorizes the workspace. Direct navigation by an ordinary/pending/rejected account fails without revealing schedule/client data.
- The coach sees only bookings attached to their own schedule and only the client fields required by the current product contract.
- Multiple weekly availability selections remain a local draft until one explicit save replaces the active rule set atomically.
- Concurrent/stale schedule edits produce a conflict and retain the unsaved local draft for review; no partial rule set is presented as saved.
- A coach may cancel only their own future confirmed booking and complete only their own elapsed confirmed booking. Terminal actions are idempotent/conflict-bounded.
- Suspended coaches cannot publish new availability or receive new bookings but retain the contract-defined access to existing history and terminal actions.
- Native time presentation preserves the coach timezone and daylight-saving behavior supplied by the server.

## Assumptions, decisions, and dependencies

- DEV0159 must confirm whether the full coach schedule is required before the first public App Store candidate or follows the first client TestFlight slice.
- DEV0160 provides shared mobile auth and client/public primitives; this ticket may add coach-specific route handlers while reusing the same verification/service boundary.
- DEV0161 provides capability state and navigation seams but does not decide coach authority locally.
- The native editor may use platform-specific list/grid controls rather than reproduce the browser calendar, provided the same complete-selection and atomic-save contract remains visible.

## Implementation plan

1. Add bounded coach schedule/booking/availability JSON contracts over existing server services.
2. Add capability-aware Coach navigation and protected workspace entry.
3. Implement owned booking agenda and recurring availability draft/save with timezone explanation.
4. Add future cancellation and elapsed completion actions with stable conflict/unavailable states.
5. Add authorization, stale-draft, timezone/DST, terminal-state and accessibility tests.
6. Rehearse a real local coach save, client booking, coach cancellation and elapsed completion flow, verifying website/native consistency.

The scope is one coach scheduling vertical slice. Coach application/public profile and staff review remain outside it.

## Acceptance criteria

- [ ] AC1: Only approved/demo/suspended capability states receive the contract-defined native Coach destination; direct unauthorized access fails without data disclosure.
- [ ] AC2: An authorized coach can draft multiple recurring selections and save the complete rule set once; conflicts never partially replace availability.
- [ ] AC3: The coach sees only their schedule and bounded client identity, can cancel an owned future booking and complete an owned elapsed booking under existing lifecycle rules.
- [ ] AC4: Suspended, stale-session, concurrent-edit, timezone/DST, unavailable-service and terminal retry behavior is explicit and preserves server authority.
- [ ] AC5: Native tests, local integration, accessibility/device checks and relevant web/backend regressions pass.

## Validation plan

Add server contract/authorization tests and native component/request-state tests. Use local Auth/PostgreSQL accounts for ordinary, pending, approved, suspended and unrelated coach scenarios. Exercise multi-selection atomic save, stale conflict, cross-coach IDs, future cancellation and prepared elapsed completion. Verify compact/current iPhone sizes, dynamic text, VoiceOver and relevant mobile/web/backend command suites.

## Implementation record

Pending implementation.

### Changes and rationale

Pending implementation.

### Affected files

| File or component                 | Change and purpose                                       |
| --------------------------------- | -------------------------------------------------------- |
| Coach mobile API routes/contracts | Planned owner-scoped schedule and mutation boundary.     |
| Native Coach routes/components    | Planned agenda, availability draft and terminal actions. |

### Decisions and deviations

None yet.

### Contracts, configuration, and operations

Consumes the existing recurring-availability and booking services. Any new mobile response fields must be versioned, bounded and recorded; no direct database credentials enter the device.

## Validation results

Pending validation.

| Criterion | Evidence                               | Result  |
| --------- | -------------------------------------- | ------- |
| AC1       | Capability/authorization tests         | Not run |
| AC2       | Atomic save/conflict rehearsal         | Not run |
| AC3       | Owned schedule and lifecycle rehearsal | Not run |
| AC4       | Failure/timezone/state tests           | Not run |
| AC5       | Command and device matrix              | Not run |

## Risks, limitations, and follow-ups

Calendar interfaces can become visually dense on small phones. Prefer an agenda/working-week editor appropriate to iOS rather than compressing the desktop calendar. Notification delivery and calendar export remain separately scoped future features.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: No review created.
- Deployment or release: Not distributed.
