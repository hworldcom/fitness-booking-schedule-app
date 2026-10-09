# Ticket DEV0173: Show coach portraits in client sessions

- Status: Completed
- Created: 2026-10-08
- Last updated: 2026-10-08
- Milestone: Scheduling-only M3 interface follow-up
- Coordination: None — independent development ticket
- Related records: extends [DEV0144 — Show client booking history](../../archive/frontend/DEV0144-show-client-booking-history.md) and depends on the public coach-portrait contract completed by [DEV0155 — Store normalized profile images](../../archive/backend/DEV0155-store-normalized-profile-images.md) and [DEV0156 — Upload and present profile images](../../archive/frontend/DEV0156-upload-and-present-profile-images.md)

## Objective and context

Make the coach identity in the signed-in client's `My sessions` cards consistent with coach discovery. Booking cards currently show only the coach name; although that text is already linked, it has no portrait or initials fallback and the small link target is easy to miss. The requested outcome is to show the coach's current public portrait when available and make the complete portrait/name identity lead to the public coach profile. This extends the [client actor behavior](../../../docs/mvp-spec.md#client), [profile-image contract](../../../docs/mvp-spec.md#profile-images) and `My sessions` acceptance scenario.

## Scope and non-goals

- In scope:
  - add a nullable, bounded public coach-portrait URL to the actor-scoped booking projection;
  - render the current public portrait or stable initials in every upcoming/history client booking card;
  - make the portrait/initials and coach name one keyboard-accessible link to `/coaches/<slug>`;
  - preserve booking privacy, status, cancellation, responsive layout and image-failure fallback;
  - update the specification and focused application/database tests.
- Out of scope:
  - changing coach portrait upload/storage ownership, booking lifecycle or authorization;
  - exposing private account avatars to clients;
  - snapshotting portrait bytes or metadata into bookings;
  - redesigning coach-owned Bookings cards.

## Expected behavior and edge cases

- A booking for a coach with a valid public portrait shows that portrait beside the coach name in `My sessions`.
- A coach without a portrait, or an image that fails to load, shows deterministic initials without broken-image UI.
- The whole visible coach identity is a link with an accessible label and visible keyboard focus; activation opens the existing public coach-profile route.
- Upcoming and retained-history cards behave consistently. Missing or unavailable booking data keeps its existing truthful state.
- Only the current public coach portrait is projected. The client's private avatar is never reused, and no image bytes or private Storage path are copied into booking data.

## Assumptions, decisions, and dependencies

- The booking record already carries the stable coach profile ID, slug and display-name snapshot. The repository can join the current coach profile under existing row-level security and reuse the public portrait URL contract.
- Portraits remain optional and current rather than booking-time snapshots. Removing or replacing a portrait updates subsequent `My sessions` reads; initials remain the fallback.
- If a coach is no longer publicly readable, the portrait is omitted by row-level security. The existing name/slug snapshot remains in the booking card, while the public route continues to decide whether a profile is available.
- The existing shared `Avatar` component supplies image-error fallback, so no new image loader or dependency is required.

## Implementation plan

1. Extend the booking projection and repository query with validated public coach-portrait metadata and a nullable URL.
2. Present the shared avatar and coach name inside one descriptive profile link, with responsive focus/hover styling.
3. Update the product contract and focused unit/database/component evidence for portrait, initials and destination behavior.
4. Run relevant tests, lint, type checking, formatting, production build and desktop/mobile browser checks.

Pre-implementation review confirms this is one bounded vertical slice. It reuses existing media and booking authority without a schema migration or coordination split.

## Acceptance criteria

- [x] AC1: `My sessions` shows the booked coach's current public portrait when available and stable initials otherwise, including image-load failure fallback.
- [x] AC2: The portrait/initials and coach name form one keyboard-accessible link to that coach's existing public profile route.
- [x] AC3: The booking projection exposes only a validated public coach-portrait URL and does not expose private avatar paths or weaken actor-scoped booking reads.
- [x] AC4: Relevant tests, lint, type checking, formatting, build and responsive browser checks pass.

## Validation plan

Add focused projection and static-render tests for portrait/fallback/link markup, and extend the booking database integration test to prove a client receives a valid current public fixture portrait while client-avatar privacy remains unchanged. Run `npm test`, the focused database booking test, `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build`, and inspect `My sessions` at desktop/mobile widths with keyboard focus. Record environment-limited checks explicitly.

## Implementation record

Client booking cards now present the booked coach with the same optional public portrait used by coach discovery. The portrait or initials and the coach name share one descriptive Next.js link to the existing public profile. The booking repository resolves only validated public coach media under existing row-level security; it does not reuse the client's private avatar or return a Storage reference separately.

### Changes and rationale

- Extended `PrivateBookingProjection` with nullable `coachPortraitUrl` so client and coach booking consumers retain one explicit public-media field alongside the existing separately protected `clientAvatarUrl`.
- Joined the current coach profile during actor-scoped booking reads. Complete fixture or owner-bound Storage metadata becomes the existing bounded public URL; missing or row-level-security-hidden metadata becomes `null`, while inconsistent partial metadata fails closed.
- Added a focused coach-identity component that wraps the shared image/initials avatar and display name in one link labelled `View <name>'s coach profile`. The existing avatar component removes a failed image and restores initials.
- Added visible hover/focus presentation and retained a compact wrapping layout on desktop and mobile booking cards.
- Updated the specification so the client-session portrait/link behavior and its private/public boundary are part of the current product contract.

### Affected files

| File or component                                                                                                           | Change and purpose                                                                                                                      |
| --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| [`src/domain/coach-bookings.ts`](../../../src/domain/coach-bookings.ts)                                                     | Adds the nullable public `coachPortraitUrl` field without changing the protected client-avatar field.                                   |
| [`src/server/db/coaches/booking-repository.ts`](../../../src/server/db/coaches/booking-repository.ts)                       | Reads current coach portrait metadata under existing row-level security, validates its source/path/version and projects the public URL. |
| [`src/features/profile/client-session-coach-identity.tsx`](../../../src/features/profile/client-session-coach-identity.tsx) | Renders portrait/initials and name as one accessible public-profile link.                                                               |
| [`src/features/profile/client-sessions.tsx`](../../../src/features/profile/client-sessions.tsx)                             | Uses the shared identity link in every upcoming and history booking card.                                                               |
| [`src/app/globals.css`](../../../src/app/globals.css)                                                                       | Styles the compact identity, visible keyboard focus and name hover state without changing card actions.                                 |
| [`docs/mvp-spec.md`](../../../docs/mvp-spec.md)                                                                             | Records public coach identity presentation in `My sessions`, including initials fallback and profile navigation.                        |
| [`tests/coach-bookings.test.ts`](../../../tests/coach-bookings.test.ts)                                                     | Covers the projection field plus portrait and initials link markup.                                                                     |
| [`tests/database/coach-bookings.test.ts`](../../../tests/database/coach-bookings.test.ts)                                   | Proves an authorized client receives a valid current public portrait URL while private client-avatar authorization remains unchanged.   |

### Decisions and deviations

2026-10-08: Reused the shared `Avatar` rather than adding booking-specific image state. This preserves the established image-error fallback and prevents the client schedule from inventing a second media contract.

2026-10-08: Used the current public portrait rather than a booking-time snapshot. A replacement or removal is reflected on the next booking read, and hidden coach rows fall back to initials under existing row-level security.

### Contracts, configuration, and operations

`PrivateBookingProjection` now has `coachPortraitUrl: string | null`. It contains only the same bounded public fixture or Supabase Storage URL already used by discovery; raw media metadata stays server-side. Existing `clientAvatarUrl` authorization is unchanged. No environment variable, dependency, database schema/migration, setup or rollback operation changed. Reverting the projection, repository join and card presentation restores the previous name-only UI.

## Validation results

Validation completed on 2026-10-08 with Node.js 24.21.0, the running local Supabase/Auth/Storage/Mailpit stack and Chrome through Playwright.

- `npm test` passed 86 application tests and 2 server image-normalization tests (88/88), including the new projection and static identity-link coverage.
- `DATABASE_TEST_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres npx tsx --conditions=react-server --test --test-concurrency=1 tests/database/coach-bookings.test.ts` passed 6/6 actor-scoped booking/database cases. The first client received the coach's validated public Storage URL while unrelated/private client-avatar assertions continued to pass.
- `npm run lint`, `npm run typecheck`, `npm run format:check`, `git diff --check` and `npm run build` passed. The production build compiled all application/API routes with Next.js 16.3.8.
- A real local Chrome flow signed in as the existing Hoang account, opened its Daniel Park booking and verified the portrait, `/coaches/daniel-park` destination, keyboard focus, successful navigation, no page errors and no horizontal overflow at 1440 × 1040 and 393 × 852. Screenshots were written to ignored `test-results/dev0173-client-sessions/` evidence.
- A second real-browser check dispatched an image error on Daniel's portrait and observed the image detach, `DP` initials appear and the same accessible profile link remain.
- The initial focused unit run failed only because the expected sorted key list placed `coachProfileId` before `coachPortraitUrl`; the expectation was corrected to actual lexical order and every subsequent focused/full run passed.
- The embedded conversation browser was unavailable, so responsive checks used the repository's installed Playwright/Chrome path instead. The complete database suite was not run because there is no schema/policy change; the affected six-case booking integration file passed in full.

| Criterion | Evidence                                                                                                                                                                 | Result |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| AC1       | Static portrait/initials cases passed; real Daniel portrait rendered and an induced image error restored `DP` without broken UI.                                         | Passed |
| AC2       | Static and real-browser checks found one descriptive `/coaches/daniel-park` link, visible keyboard focus and successful profile navigation at both viewport widths.      | Passed |
| AC3       | The six-case booking database test returned only the public coach URL to the booking client while existing booking-scoped private client-avatar restrictions all passed. | Passed |
| AC4       | 88/88 application/server tests, 6/6 focused database tests, lint, types, formatting, build and desktop/mobile Chrome checks passed.                                      | Passed |

## Risks, limitations, and follow-ups

Current public portrait metadata is intentionally not snapshotted into a booking. A removed/hidden portrait falls back to initials, and a profile that is no longer public may remain unavailable at its historical slug.

## Completion and review references

- Completed: 2026-10-08 — client booking cards now show and link the coach's public portrait or initials without crossing the private-avatar boundary.
- Commit: Not created.
- Review: Self-reviewed against all acceptance criteria; no independent review or pull request created.
- Deployment or release: Not deployed.
