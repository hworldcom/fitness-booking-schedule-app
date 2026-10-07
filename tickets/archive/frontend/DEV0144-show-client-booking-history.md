# Ticket DEV0144: Show client booking history

- Status: Completed
- Created: 2026-10-07
- Last updated: 2026-10-08
- Milestone: Scheduling-only M3 interface follow-up
- Coordination: None — independent development ticket
- Related records: follows the direct booking projection delivered by [DEV0141](../../archive/backend/DEV0141-persist-direct-private-bookings.md) and corrects the incomplete client-history presentation recorded by [DEV0143](../../archive/frontend/DEV0143-present-scheduling-only-experience.md)

## Objective and context

Make a successful private-session booking immediately visible and give every signed-in client one durable place to review their own sessions. The database already persists and actor-scopes client bookings, but the interface shows history only at the bottom of the booked coach's profile and the account Profile merely claims that history is loaded without rendering it. This leaves a client unsure whether booking succeeded and unable to find the session later. The change implements the client-history behavior required by [the actor contract](../../../docs/mvp-spec.md#client), [booking flow](../../../docs/mvp-spec.md#43-book-a-private-session), M3 and the definition of done.

## Scope and non-goals

- In scope:
  - Add a `My sessions` panel to the signed-in account Profile using the existing actor-scoped booking projection.
  - Show coach, date/time, location, status and eligible future cancellation without exposing unrelated client data.
  - Move booking feedback and the current coach's booked-session summary ahead of the remaining open-slot list, with a link to the durable Profile panel.
  - Revalidate the Profile after booking/cancellation and add focused presentation plus responsive browser validation.
- Out of scope:
  - Database schema, booking lifecycle or authorization changes.
  - Notifications, messaging, payments, calendar export or hosted deployment.
  - Redesigning the coach-owned schedule panel.

## Expected behavior and edge cases

- A successful booking displays an immediate success message near the booking controls and the confirmed session appears without a full-page reload.
- The signed-in client's Profile shows all and only their persisted bookings, including terminal history; future confirmed sessions expose cancellation.
- Empty, unavailable and signed-out states are explicit and do not fabricate sessions.
- Cancelling from either client surface refreshes both the coach page and Profile projection and leaves terminal history visible.
- Dates render in the coach timezone and the layout remains usable at desktop and mobile widths.

## Assumptions, decisions, and dependencies

- `currentPrivateBookingWorkspace()` and DEV0141's bounded database function remain the authority; no new query or data contract is needed.
- The existing `/profile` route is the durable client destination because it is already protected, globally linked and described as the account's booking-history boundary.
- The coach-specific summary remains useful context, but it must not be the only discoverable client-history surface.

## Implementation plan

1. Pass the authorized client-booking projection and a stable reference time from the Profile server page into the profile interface.
2. Add an accessible `My sessions` panel with upcoming/history ordering, status, coach/location details and future cancellation.
3. Reorder coach-profile booking feedback/history ahead of open inventory and link successful results to the Profile panel.
4. Revalidate `/profile`, add focused tests, and inspect the booking/profile flow at desktop and mobile widths.

Pre-implementation review confirms this is one small frontend slice using an existing persistence/service contract; no coordination split is required.

## Acceptance criteria

- [x] AC1: A successful booking is acknowledged near the action and the confirmed session appears on the coach page after the action refresh.
- [x] AC2: `/profile#my-sessions` shows the signed-in client's actor-scoped booking history with coach, time, location and status.
- [x] AC3: Future confirmed sessions can be cancelled from the Profile panel; empty, terminal and unavailable states remain truthful.
- [x] AC4: Relevant tests, lint, type checking, formatting, production build and desktop/mobile browser checks pass.

## Validation plan

Run focused booking/domain tests and the database integration suite to preserve projection/authorization evidence. Exercise a real local Auth booking, reload Profile, cancel from the panel and confirm the slot reopens. Run `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build:vercel` and Playwright at desktop/mobile sizes. Record any environment-limited check explicitly.

## Implementation record

The signed-in account Profile now renders the existing actor-scoped private-booking projection in a dedicated `My sessions` panel. Future confirmed sessions are ordered chronologically under Upcoming, while past, cancelled and completed sessions remain visible under History. Each card identifies the coach, renders the hour in the coach timezone, shows the snapshotted training place and lifecycle status, and exposes cancellation only while the session is still future and confirmed.

The coach profile now acknowledges a successful booking beside the scheduling controls, links directly to `/profile#my-sessions`, and places the current coach's booking summary before the remaining open inventory. Booking and cancellation refresh the Profile projection as well as the coach surfaces, so the new durable panel reflects the latest database state.

### Changes and rationale

- Added one reusable timeline rule so both coach and account surfaces agree on whether a booking is future, confirmed and cancellable.
- Added truthful empty and unavailable states instead of fabricating history when the actor-scoped read cannot be verified.
- Kept cancelled sessions in history so a completed action does not make the user's record disappear.
- Changed the local Auth rehearsal helper to click the enabled submit control instead of invoking `requestSubmit()` before hydration; this removes a mobile timing race in validation without changing application behavior.

### Affected files

| File or component                                    | Change and purpose                                                                                                            |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `src/app/profile/page.tsx`                           | Loads the authorized booking workspace for the protected Profile and passes a stable reference time to presentation.          |
| `src/features/profile/profile.tsx`                   | Places the durable client-session panel in the signed-in account Profile.                                                     |
| `src/features/profile/client-sessions.tsx`           | Renders upcoming/history cards, explicit empty/unavailable states and future cancellation through the existing server action. |
| `src/domain/coach-bookings.ts`                       | Defines the shared future-confirmed predicate and deterministic client timeline ordering.                                     |
| `src/features/coaches/coach-marketplace.tsx`         | Moves result feedback and the current coach's bookings ahead of open inventory and links successful bookings to Profile.      |
| `src/app/globals.css`, `src/app/coach-discovery.css` | Adds responsive session-card, state, feedback and link styling.                                                               |
| `tests/coach-bookings.test.ts`                       | Proves upcoming/history ordering and cancellation eligibility across confirmed, cancelled and completed states.               |
| `scripts/rehearse-local-email-auth.mjs`              | Verifies the new Profile empty state and waits for hydrated submit controls in the desktop/mobile Auth rehearsal.             |

### Decisions and deviations

- 2026-10-07: Use the existing protected Profile as the durable client-history destination instead of adding a parallel route and navigation item.
- 2026-10-08: Keep the coach-specific summary as immediate context, but make Profile the only all-coach history destination and retain terminal rows there.

### Contracts, configuration, and operations

No schema, dependency, environment variable, migration or external-provider contract changed. The UI consumes the existing actor-scoped `PrivateBookingProjection` and the existing booking/cancellation server actions. The only operational adjustment is a more reliable local Auth rehearsal submit helper.

## Validation results

| Criterion | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                   | Result |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| AC1       | A disposable local Auth account booked Daniel Park's next open hour through the rendered coach page. The browser observed `Session booked. It now appears in your schedule.`, the `View my sessions` link and the refreshed coach booking summary.                                                                                                                                                                                         | Passed |
| AC2       | The same browser followed `/profile#my-sessions` and observed the `Your private-session schedule` panel, Daniel Park, the confirmed status, coach-local time and snapshotted location. The normal local Auth rehearsal also passed the signed-in empty-state assertions for a new account.                                                                                                                                                 | Passed |
| AC3       | The focused browser rehearsal cancelled from Profile, observed `Booking cancelled. The future time is open again.`, retained `Cancelled by client` under history and confirmed that the cancellation control disappeared. The disposable account's Auth cleanup was blocked by the intentional profile foreign key, so its booking/profile/Auth rows were removed explicitly in dependency order; zero DEV0144 disposable accounts remain. | Passed |
| AC4       | `npm test` passed 57/57; `npm run lint`, `npm run typecheck`, `npm run format:check` and `git diff --check` passed. `npm run build:vercel` completed the Next.js 16.3.8 production build. `npm run test:e2e` passed 28/28 across desktop and mobile projects.                                                                                                                                                                              | Passed |

Additional integration evidence:

- `npm run test:db` passed all direct-booking scenarios, including actor-scoped client history, capacity conflict, cancellation and coach completion. The suite reported 27/28 overall because the already-provisioned local database has five seeded coach profiles converted from `fixture` to `user`, while the foundation-only count expects all eleven profiles to remain fixtures; no booking assertion failed and the database was not reset because it contains the user's local schedule and sessions.
- A complete `npm run test:auth` run passed the client/coach onboarding, returning-account, Profile isolation, mobile overflow/keyboard and sign-out checks during implementation. Repeated post-build runs later exhausted the local email-request allowance before the second account; the first authenticated Profile path still completed, and the focused password-backed disposable-account rehearsal provided the required booked/cancelled session evidence without consuming another email.

## Risks, limitations, and follow-ups

- Hosted Vercel/Supabase rehearsal remains separate M4 work.
- The Profile panel intentionally has no reschedule, notification, payment or calendar-export behavior; those remain outside the scheduling-only contract.

## Completion and review references

- Completed: 2026-10-08.
- Commit: Included in `[DEV0140][DEV0141][DEV0142][DEV0143][DEV0144][DEV0145] Adopt scheduling-only product`.
- Review: No independent review or pull request created.
- Deployment or release: None.
