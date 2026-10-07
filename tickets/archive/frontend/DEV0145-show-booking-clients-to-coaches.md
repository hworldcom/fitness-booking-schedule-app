# Ticket DEV0145: Show booking clients to coaches

- Status: Completed
- Created: 2026-10-08
- Last updated: 2026-10-08
- Milestone: Scheduling-only M3 interface follow-up
- Coordination: None — independent development ticket
- Related records: follows the coach-owned booking projection delivered by [DEV0141](../../archive/backend/DEV0141-persist-direct-private-bookings.md), the scheduling workspace delivered by [DEV0143](../../archive/frontend/DEV0143-present-scheduling-only-experience.md), and the client-history correction in [DEV0144](../../archive/frontend/DEV0144-show-client-booking-history.md)

## Objective and context

Make the client behind a booked session immediately visible to the owning coach. The protected coach projection already includes the booking client's bounded display name, and a `Private sessions` panel renders it, but that panel sits below the full weekly editor and dated schedule. The dated occurrence that coaches see first says only `BOOKED`, so the practical experience is that the coach cannot tell who reserved the hour. This change completes the coach behavior required by [the coach actor contract](../../../docs/mvp-spec.md#coach) and the coach-booking acceptance flow.

## Scope and non-goals

- In scope:
  - Move the actor-scoped booked-session panel ahead of schedule editing for coaches with a profile.
  - Show the confirmed client's display name directly on each matching booked dated occurrence.
  - Preserve truthful unavailable, empty and terminal-history states without exposing unrelated clients.
  - Add focused presentation/domain coverage and desktop/mobile validation.
- Out of scope:
  - Database queries, schema, authorization, client identity fields or lifecycle changes.
  - Contact details, messaging, notifications, payments or realtime subscriptions.
  - Redesigning the recurring weekly editor.

## Expected behavior and edge cases

- A coach opening `/coach` sees `Private sessions` before the recurring schedule, with client name, time, place and booking status.
- A future occurrence whose confirmed booking belongs to this coach shows `Booked by <display name>` in the dated schedule.
- Cancelled or completed history remains in the private-session panel but is not attached to an open occurrence.
- If the private booking projection is unavailable, the workspace shows no cached client name and describes the unavailable state.
- Client names remain owner-scoped and never appear on public coach pages or another coach's workspace.

## Assumptions, decisions, and dependencies

- `currentPrivateBookingWorkspace()` remains the authority and already scopes `coachBookings` to the owning coach.
- The persisted application display name is the only client identity shown; email and other private account data remain excluded.
- Matching a confirmed booking to its immutable `slotId` is sufficient for the coach's dated occurrence label; no new contract is needed.

## Implementation plan

1. Pass the existing owner-scoped coach bookings into the coach availability presentation alongside the private-session cards.
2. Place the private-session panel directly below coach navigation and annotate matching booked occurrences with the client display name.
3. Add a pure confirmed-booking-by-slot helper and focused tests for confirmed versus terminal history.
4. Run application, build and responsive browser validation and record exact evidence.

Pre-implementation review confirms this is one small frontend slice over an existing authorized projection; no coordination split is required.

## Acceptance criteria

- [x] AC1: The coach's `Private sessions` panel appears before schedule editing and identifies the booking client with time, place and status.
- [x] AC2: Each upcoming booked occurrence with an authorized confirmed booking displays `Booked by <client display name>`.
- [x] AC3: Terminal or unavailable booking state does not attach a stale/fabricated client name to an occurrence, and public/other-coach data boundaries remain unchanged.
- [x] AC4: Focused tests, lint, type checking, formatting, production build and desktop/mobile browser checks pass.

## Validation plan

Run the booking/domain tests and database integration suite to preserve owner-scoping evidence. Exercise a local Auth client booking and inspect the owning coach workspace at desktop and mobile widths, including the prominent panel and matching occurrence label. Run `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build:vercel` and Playwright. Record environment-limited checks explicitly.

## Implementation record

The protected coach workspace now places its existing actor-scoped `Private sessions` panel immediately below coach navigation, before the large recurring-schedule editor. Each card identifies the client, snapshotted training place, coach-local time and lifecycle status. The dated occurrence list also matches each booked slot to its confirmed owner-scoped booking and renders `Booked by <client display name>` beside the hour.

### Changes and rationale

- Reordered the existing private-session panel instead of adding a duplicate route or query, making client identity visible when the workspace opens.
- Passed the same authorized coach-booking projection into the dated schedule and matched by immutable slot ID.
- Added a confirmed-only matching rule so cancelled/completed history remains in the private panel but can never label an open or terminal occurrence as currently booked.
- Kept explicit `Client unavailable`/`Booking unavailable` fallbacks for an inconsistent or unavailable projection instead of showing cached or guessed identity.

### Affected files

| File or component                                              | Change and purpose                                                                                                               |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/coach/page.tsx`                                       | Reuses one owner-scoped coach-booking value for both the private-session cards and occurrence labels.                            |
| `src/features/coaches/coach-availability-panel.tsx`            | Places booked clients before schedule editing and renders confirmed client names on matching booked occurrences.                 |
| `src/features/coaches/coach-client-cards.tsx`                  | Clarifies that this first panel identifies who booked each private session.                                                      |
| `src/domain/coach-bookings.ts`                                 | Adds the confirmed-only immutable-slot matching rule.                                                                            |
| `src/app/coach-workspace.css`                                  | Styles the booked-client occurrence label at desktop and mobile widths.                                                          |
| `tests/coach-bookings.test.ts`, `tests/coach-schedule.test.ts` | Prove terminal bookings are ignored, the panel precedes the editor, and confirmed client identity appears beside the occurrence. |

### Decisions and deviations

- 2026-10-08: Reuse the current private-session panel and owner-scoped projection instead of adding another coach route or duplicate query.
- 2026-10-08: Attach identity to dated occurrences only for `confirmed` bookings; terminal history stays visible solely in the private-session panel.

### Contracts, configuration, and operations

No schema, dependency, environment variable, migration or provider contract changed. Client display names come from the existing owner-scoped `PrivateBookingProjection`; email and other private identity fields remain absent.

## Validation results

| Criterion | Evidence                                                                                                                                                                                                                                                                                                      | Result |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | The live authenticated Daniel Park workspace showed `Private sessions` immediately after navigation and before `Your working week`. It displayed two Hoang bookings with place, coach-local hour, confirmed status and coach cancellation controls. The static presentation test also asserts panel ordering. | Passed |
| AC2       | The same live workspace rendered `BOOKED BY Hoang` on both matching booked dated occurrences. The focused static test renders a confirmed `Booking Client` beside its booked slot.                                                                                                                            | Passed |
| AC3       | `confirmedBookingForSlot` returns only confirmed rows; focused tests prove cancelled history does not match. `npm run test:db` passed every direct-booking authorization/capacity/cancellation/completion scenario, and public browser tests remained unchanged.                                              | Passed |
| AC4       | `npm test` passed 58/58; `npm run lint`, `npm run typecheck`, `npm run format:check` and `git diff --check` passed. `npm run build:vercel` completed the Next.js 16.3.8 production build. `npm run test:e2e` passed 28/28 across desktop and mobile projects.                                                 | Passed |

`npm run test:db` reported 27/28 overall because the already-provisioned local database contains five seeded coach profiles converted from `fixture` to `user`, while the foundation-only fixture count still expects eleven fixture profiles. All direct-booking cases passed, and the database was not reset because it contains the user's local schedule and sessions.

## Risks, limitations, and follow-ups

- The coach sees the updated schedule on navigation, refresh or completed mutation; realtime push notifications remain out of scope.
- Only the bounded application display name is shown; contact details and messaging remain intentionally unavailable.

## Completion and review references

- Completed: 2026-10-08.
- Commit: Included in `[DEV0140][DEV0141][DEV0142][DEV0143][DEV0144][DEV0145] Adopt scheduling-only product`.
- Review: No independent review or pull request created.
- Deployment or release: None.
