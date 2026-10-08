# Ticket DEV0169: Show client avatars in coach bookings

- Status: Completed
- Created: 2026-10-08
- Last updated: 2026-10-08
- Milestone: Scheduling-only M3 interface follow-up
- Coordination: None — independent development ticket
- Related records: extends the owner-scoped coach booking presentation completed by [DEV0145 — Show booking clients to coaches](../../archive/frontend/DEV0145-show-booking-clients-to-coaches.md); depends on the private account-avatar storage boundary completed by [DEV0155 — Store normalized profile images](../../archive/backend/DEV0155-store-normalized-profile-images.md) and shared image fallback presentation completed by [DEV0156 — Upload and present profile images](../../archive/frontend/DEV0156-upload-and-present-profile-images.md)

## Objective and context

Show the booking client's optional profile picture in the protected coach workspace. The current booked-session cards and matching dated occurrence display the client's bounded name but only a generic person icon, even when that client uploaded a private account avatar. The outcome must preserve the private/public distinction in [the profile-image contract](../../../docs/mvp-spec.md#profile-images), the actor-scoped booking rule in [identity and data integrity](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity), and the coach schedule behavior in [the acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix).

## Scope and non-goals

- In scope: expose a versioned booking-scoped avatar URL only for the owning coach of a confirmed direct booking; authorize and stream the client's private canonical avatar through a protected same-origin route; display the image with deterministic initials fallback in active private-session cards and matching booked occurrences; revoke new retrieval after cancellation/completion; update the current specification, migrations, database policies, tests and implementation record.
- Out of scope: making account avatars public; showing client avatars in coach discovery; exposing Storage paths, Auth identifiers or contact details; copying private avatars into public coach media; displaying terminal-history avatars; messaging, notifications or realtime updates.

## Expected behavior and edge cases

- An owning coach opening `/coach` sees the current client's private account avatar beside their name in each confirmed booking card and its matching booked occurrence.
- A client without an avatar, an image that cannot load, or a booking whose avatar is unavailable renders stable initials without hiding the client name or schedule.
- The image byte route returns data only while the signed-in actor owns the confirmed direct booking as its coach. Signed-out users, unrelated accounts, a different coach, malformed identifiers and terminal bookings receive no image bytes.
- Replacing the client's avatar changes the versioned presentation URL after refresh. Removing it returns the coach UI to initials.
- Public discovery and client-facing booking projections receive no new private image access.

## Assumptions, decisions, and dependencies

- The client's private account avatar remains private media. A confirmed booking establishes the minimum bounded relationship needed for its owning coach to recognize that client; cancellation or completion ends this additional read path.
- The browser receives only a booking-scoped application URL and update version. It never receives the private Storage object path.
- Reuse the existing cookie-forwarding `Avatar` component so a failed request falls back to initials and the image optimizer does not make a credential-free server request.
- One additive migration can own both the actor-scoped reference function and the narrow Storage select policy. The feature remains one reviewable vertical slice and does not require a coordination split.

## Implementation plan

1. Update the specification to define confirmed-booking coach access to a client's private avatar and the terminal/public boundaries.
2. Add an actor-scoped database reference function plus an authenticated Storage policy that permits only the confirmed booking's owning coach to read the client's current avatar object.
3. Add the nullable booking-scoped avatar URL to the private booking projection and a dynamic protected route that rechecks booking authority before streaming bytes with private no-store caching.
4. Render the shared avatar with initials fallback in confirmed booking cards and matching dated occurrences; retain names and existing booking actions.
5. Add focused domain, repository, route, database and presentation tests; run migrations, application checks, builds and responsive authenticated browser validation.

## Acceptance criteria

- [x] AC1: The owning coach sees a confirmed booking client's current private avatar in both the booked-session card and its matching dated occurrence, with the client's name still visible.
- [x] AC2: Missing, removed or failed avatar images render deterministic client initials without breaking schedule presentation.
- [x] AC3: Only the owning coach of a confirmed direct booking can retrieve the client avatar; signed-out, unrelated, malformed and terminal-booking requests return no bytes, and no private Storage path enters browser projections.
- [x] AC4: Avatar replacement produces a new presentation URL after refresh, while public discovery and client-facing booking presentation gain no private-avatar access.
- [x] AC5: Focused unit, database, policy, route and responsive browser checks plus lint, type checking, formatting and production build pass.

## Validation plan

Extend projection and presentation tests for image and fallback states. Add database tests proving the reference function returns only the confirmed booking client's current bounded reference to its owning coach, plus Storage policy checks for owner/booking-coach/unrelated access. Add route-service checks for malformed, missing and authorized references. Rehearse a local Hoang booking with an uploaded avatar from Daniel Park's coach workspace at desktop and mobile widths, then cancel or complete a prepared booking and verify retrieval is denied. Run `npm test`, focused database tests, `npm run db:test`, `npm run db:lint`, `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build` and applicable Playwright checks.

## Implementation record

Completed on 2026-10-08. Confirmed direct bookings now carry a nullable, booking-scoped client-avatar URL for their owning coach. The coach workspace renders that image beside the client name in both booking summaries and matching schedule occurrences, while the existing deterministic initials remain the missing-image and failed-load fallback. The application route and Storage policy independently recheck the current confirmed-booking relationship before returning private bytes.

### Changes and rationale

- Added a security-definer database projection that exposes the current private avatar reference only when the active database actor owns the confirmed direct booking as its coach. A separate authenticated Storage policy checks the same relationship and exact current object path, providing defense in depth without making the account-avatar bucket public.
- Added a same-origin `GET /api/coach/bookings/[bookingId]/client-avatar` route. It validates the canonical booking identifier, resolves authority through the actor-scoped repository, downloads with the signed-in user's cookie-bound Storage client, and returns private, no-store image responses. Browser projections contain a versioned application URL, never a Storage object path.
- Extended the private booking projection with `clientAvatarUrl`. Client projections always receive `null`; a coach receives a URL only for their own confirmed direct booking and only while the client has an avatar.
- Replaced the generic person glyph in the two confirmed-booking presentations with the shared `Avatar` component. The client's bounded display name remains visible and deterministic initials take over when no authorized image is present or an image request fails.
- Updated the current product contract and automated coverage for the newly authorized, relationship-bounded private-media use.

### Affected files

| File or component | Change and purpose |
| ----------------- | ------------------ |
| [MVP specification](../../../docs/mvp-spec.md) | Defines owning-coach access during a confirmed direct booking, terminal revocation, no-path disclosure and the associated acceptance scenario. |
| [Booking-avatar migration](../../../supabase/migrations/20261008000700_authorize_booking_client_avatars.sql) | Adds the actor-scoped reference function, exact-object authorization function and authenticated Storage select policy. |
| [Profile-image contracts](../../../src/profile-images/contracts.ts) and [booking domain](../../../src/domain/coach-bookings.ts) | Add the canonical versioned booking image URL helper and nullable private projection field. |
| [Booking repository](../../../src/server/db/coaches/booking-repository.ts) | Joins the authorized reference projection and maps only its update version into the application URL. |
| [Profile-image repository](../../../src/server/db/profile-images/repository.ts) and [service](../../../src/server/profile-images/service.ts) | Resolve the current authorized reference, verify path ownership and retrieve private bytes through the signed-in Storage client. |
| [Protected image route](../../../src/app/api/coach/bookings/%5BbookingId%5D/client-avatar/route.ts) | Streams WebP bytes with private no-store headers and bounded authentication, authorization, missing-reference and availability responses. |
| [Client booking cards](../../../src/features/coaches/coach-client-cards.tsx), [schedule panel](../../../src/features/coaches/coach-availability-panel.tsx) and [workspace styles](../../../src/app/coach-workspace.css) | Present the client image or initials in both coach views without compressing the avatar or changing the existing controls. |
| [Application tests](../../../tests/profile-images.test.ts), [booking tests](../../../tests/coach-bookings.test.ts), [schedule tests](../../../tests/coach-schedule.test.ts) and [database tests](../../../tests/database/coach-bookings.test.ts) | Cover URL bounds, projection privacy, rendered image/fallback states, actor-scoped references, exact-object Storage visibility and revocation after cancellation. |

### Decisions and deviations

- 2026-10-08: Limit the additional private-avatar read capability to the owning coach while a direct booking remains confirmed. Terminal history retains the client's bounded name but returns to initials so booking history does not grant indefinite image access.
- 2026-10-08: Keep the private object path entirely server-side. The UI receives a booking identifier plus avatar-update version, allowing cache invalidation without granting direct or durable Storage addressing.
- 2026-10-08: The migration's initial local rehearsal referenced a nonexistent `profiles.run_id` field and rolled back. The join was corrected to the profile primary key before the migration was successfully applied; no partial schema change remained.
- 2026-10-08: Terminal revocation was verified inside rollback-only database coverage instead of cancelling the existing Hoang/Daniel rehearsal booking. This preserved the user's local data while testing the same authoritative state transition and policy denial.

### Contracts, configuration, and operations

- Data contract: `PrivateBookingProjection` gains nullable `clientAvatarUrl`; it is populated only for the owning coach's confirmed direct booking and remains `null` in client and terminal projections.
- Database contract: migration `20261008000700_authorize_booking_client_avatars.sql` adds `app.current_confirmed_booking_client_avatar_references(uuid)`, `app.current_storage_actor_can_read_confirmed_booking_client_avatar(text)` and policy `account_avatars_confirmed_booking_coach_select`.
- HTTP contract: `GET /api/coach/bookings/{bookingId}/client-avatar` returns private `image/webp` bytes for the authorized coach, `401` without a session, `403` when protected access is unavailable, `404` for malformed, missing or unauthorized current references, and `503` for service unavailability.
- Operations: apply the additive Supabase migration before serving the new route. No dependency, environment variable or setup-command change was introduced. Rollback would require removing the policy and functions together with the route and DTO field; existing avatar objects are unchanged.

## Validation results

| Criterion | Evidence | Result |
| --------- | -------- | ------ |
| AC1 | Authenticated Daniel Park browser rehearsal at `1440x1040` and `393x852` showed Hoang's uploaded avatar and name in the confirmed booking card and matching booked occurrence. Screenshots: `test-results/booking-client-avatar-rehearsal/desktop.png` and `mobile.png` (local, ignored artifacts). | Passed |
| AC2 | `npm test` presentation assertions cover image rendering plus deterministic initials fallback; both responsive rehearsals retained the client name with no overflow or page error. | Passed |
| AC3 | Focused database coverage passed 6/6, including owning-coach reference/object visibility, unrelated denial and post-cancellation revocation. Browser route probes returned `200 image/webp` for Daniel, `401` anonymously and `404` for Hoang using the coach-only URL. Repository tests assert that no object path enters the DTO. | Passed |
| AC4 | URL helper tests verify stable booking scope and timestamp versioning; projection tests keep `clientAvatarUrl` null for the client, and public coach DTOs were not changed. | Passed |
| AC5 | `npm test` passed 81 application tests plus 2 server tests; `npm run test:db` passed 34/34; `npm run db:lint`, `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build` and `git diff --check` passed. | Passed |

Additional database-suite context: `npm run db:test` passed 151 of 152 pgTAP assertions. Its sole failure is an unrelated persistent local-data expectation in `coach-availability.test.sql`: the fixture expected one open public slot but the preserved Daniel schedule currently contains 34. The feature-specific driver and Storage-policy tests all passed, and the local database was deliberately not reset because it contains user-created state.

## Risks, limitations, and follow-ups

Private responses use `Cache-Control: private, no-store`, and Storage independently enforces the same confirmed-booking relationship as the application route. An already rendered browser image is replaced on the next route refresh after a booking/avatar mutation; realtime cross-session avatar or booking updates remain out of scope. The unrelated persistent-data pgTAP fixture mismatch should be addressed without resetting or discarding local user data.

## Completion and review references

- Completed: 2026-10-08; all ticket acceptance criteria passed with the unrelated full pgTAP fixture mismatch documented above.
- Commit: Not created.
- Review: No independent review or pull request created.
- Deployment or release: None.
