# Ticket DEV0143: Present the scheduling-only experience

- Status: Completed
- Created: 2026-10-07
- Last updated: 2026-10-14
- Milestone: Scheduling-only interface
- Coordination: [COR0011 — Scheduling-only product branch](../organisatory/COR0011-scheduling-only-product.md)
- Related records: retains coach discovery/availability foundations from DEV0096, DEV0104, DEV0114 and DEV0115

> Documentary pruning — 2026-10-14, [DEV0225](../organisatory/DEV0225-remove-blockchain-historical-evidence.md): superseded feature evidence and deleted-reference details were removed at the user’s request. Retained text records the independent outcome at its original date. Code/data fragments are historical excerpts, not complete current contracts; aggregate test totals remain totals of the original runs, not new retained-only validation. Original completion dates remain unchanged. Earlier revisions remain in Git history.

## Objective and context

Present one coherent scheduling product: discover a coach, inspect real open hours, sign in, book directly, review/cancel personal bookings, and let coaches publish availability and complete elapsed sessions.

## Scope and non-goals

- In scope:
  - Rewrite Home, How it works, Coming soon/sign-in support copy and shared navigation for scheduling.
  - Replace the coach marketplace panel with direct booking and client booking history.

  - Add responsive/keyboard-focused browser coverage for guest, client and coach scheduling states.
- Out of scope:
  - Database mutation rules owned by DEV0141.
  - Calendar-provider integration, payments, messaging, social feeds, group events or waitlists.
  - Visual rebranding beyond copy/layout needed for truthful scheduling behavior.

## Expected behavior and edge cases

- Guests can discover coaches and see open times but are prompted to sign in before booking.
- Signed-in clients can book an open time directly, see only their bookings and cancel eligible future bookings.
- Coaches manage availability and see their booking schedule; only elapsed confirmed sessions expose completion.
- Empty, conflict, signed-out and database-unavailable states are explicit and do not fabricate availability.
- Mobile/desktop layouts and keyboard operation remain usable.

## Assumptions, decisions, and dependencies

- DEV0141 supplies scheduling-only action/service projections.
- Mapbox is enhancement-only and existing list fallback remains primary.

## Implementation plan

1. Simplify shared shell/navigation/providers and public story routes.
2. Rebuild coach-profile booking panel against DEV0141.
3. Rebuild coach workspace booking list/actions and remove obsolete pages/components/styles.
4. Update unit/browser tests and inspect key routes at mobile/desktop widths with keyboard-relevant controls.
5.

## Acceptance criteria

- [x] AC1: Public routes and navigation describe only coach discovery and scheduling; no blockchain/pass/payment/event/social action is reachable.
- [x] AC2: Guest/client booking states and client cancellation are truthful, accessible and responsive.
- [x] AC3: Coach availability and booking-management surfaces enforce the DEV0141 projection/action boundary.
- [x] AC4: Empty/conflict/unavailable states remain explicit without placeholder bookings or times.
- [x] AC5: Relevant unit and browser tests pass at desktop/mobile widths, plus lint/type/format/build checks.

## Validation plan

Run focused presentation tests and Playwright scenarios for public story, discovery, profile booking and coach workspace at mobile/desktop widths. Verify keyboard activation/focus for booking and cancellation controls, then run full repository checks.

## Implementation record

Every current user-facing route now presents one scheduling product. Guests discover coaches and their database-backed hours, email-authenticated clients book/cancel directly, and coaches retain profile/recurring-availability controls plus a private booking schedule with cancel/complete actions.

### Changes and rationale

- Rewrote Home, How it works, Coming soon and sign-in/profile support copy so they make only scheduling claims.
- Rebuilt the coach profile panel around direct booking, personal history and future cancellation. Guest sign-in guidance remains visible even when a coach has no open time.
- Replaced credit/client cards with an actor-scoped coach booking schedule. Future confirmed sessions can be cancelled; elapsed confirmed sessions expose completion; terminal rows remain read-only.
- Removed social data/controls from coach discovery/profile presentation while retaining the list-first Mapbox enhancement and explicit unavailable/empty states.
- Updated desktop/mobile browser tests for the story, discovery, guest booking prompt, protected coach routes, removed URLs, keyboard focus and responsive overflow.

### Affected files

| File or component                                                     | Change and purpose                                                                                    |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `src/components/shell.tsx` and `src/app/layout.tsx`                   | Provide scheduling-only navigation, metadata, disclosure and providers.                               |
| `src/features/public/coach-story.tsx`, waitlist and Auth/profile copy | Present truthful discovery/scheduling onboarding without removed product actions.                     |
| `src/features/coaches/coach-discovery.tsx` and coach profile page     | Show coach/place/open-time context without social or pass data.                                       |
| `src/features/coaches/coach-marketplace.tsx`                          | Provides guest sign-in, direct book, booking history and future cancellation states.                  |
| `src/features/coaches/coach-client-cards.tsx` and coach page          | Presents the owning coach's private schedule with cancel/complete controls.                           |
| `tests/browser/*.spec.ts`                                             | Verifies scheduling story/navigation/discovery/protection/removed routes at desktop and mobile sizes. |

### Decisions and deviations

- 2026-10-07: The scheduling-only interface retains coach discovery and optional map context because users need a coach/location before selecting a time; it removes social behavior because it is not required for the scheduling loop.
- 2026-10-07: Retained the existing `CoachClientCards` file/export name internally to avoid an unrelated component rename across CSS history; its implementation and public copy are now a booking schedule, not a financial client-card model.

### Contracts, configuration, and operations

No new browser environment variable or external provider was added. Components consume only DEV0141's scheduling projection/actions. Optional Mapbox behavior and the server-backed list fallback are unchanged.

## Validation results

| Criterion | Evidence                                                                                                                                                                                                                     | Result |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC2       | Responsive desktop/mobile Playwright covers discovery, coach profile, sign-in guidance and keyboard-reachable controls; DEV0141's database suite covers authenticated booking/cancellation mutations and reload projections. | Passed |
| AC3       | Coach workspace consumes only `coachBookings`; type/build checks and database tests prove coach ownership, cancellation and elapsed completion boundaries.                                                                   | Passed |
| AC4       | Browser tests pass the no-open-time and unavailable/protected states; no fixture booking or placeholder availability fallback was introduced.                                                                                | Passed |
| AC5       | All 28 Playwright scenarios pass in both projects; unit/server tests, formatting, lint, type checking and native/Vercel production builds pass.                                                                              | Passed |

## Risks, limitations, and follow-ups

- Current screenshots and archived design notes may show removed product features; they remain historical and are not current acceptance evidence.
- Authenticated client/coach UI was not rehearsed against hosted Vercel/Supabase in this ticket; database integration proves the mutation contract locally, and the hosted rehearsal remains a release operation rather than a local completion claim.

## Completion and review references

- Completed: 2026-10-07.

- Review: Implementation, responsive-browser and acceptance-criteria self-review completed; no independent review or pull request created.
- Deployment or release: None.
