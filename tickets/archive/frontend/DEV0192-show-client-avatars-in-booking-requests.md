# Ticket DEV0192: Show client avatars in booking requests

- Status: Completed
- Created: 2026-10-11
- Last updated: 2026-10-11
- Milestone: Booking-request interface follow-up
- Coordination: None — independent development ticket
- Related records: completed request-queue baseline [DEV0189 — Add the coach booking-request queue](DEV0189-add-coach-booking-request-queue.md), completed confirmed-booking avatar baseline [DEV0169 — Show client avatars in coach bookings](DEV0169-show-client-avatars-in-coach-bookings.md)

## Objective and context

The coach Bookings view shows client names and generated initials in both pending booking requests and `Recent request history`, even when those clients have account avatars. Let the owning coach recognize request participants by their current private account avatars while retaining initials when an avatar is absent or unreadable. This is a dated correction to the narrower confirmed-booking-only image boundary in [the MVP profile-image and privacy requirements](../../../docs/mvp-spec.md#profile-images).

## Scope and non-goals

- In scope:
  - Add an authenticated request-scoped image route for the current avatar of a client who submitted a booking request to the signed-in coach.
  - Project only an opaque application URL and version value to the coach request queue; never expose a private Storage object path.
  - Render the avatar in pending request candidates and terminal recent-request history, with stable initials fallback.
  - Keep reads bounded, coach-owned and valid for every persisted request status while blocking the requesting client, unrelated actors and public callers.
  - Update the current product contract and focused automated coverage.
- Out of scope:
  - Making account avatars public, exposing avatars to competing clients, changing coach portraits or changing request decisions/lifecycle.
  - Avatar snapshots, historical image retention, user profile links, candidate ranking or notification delivery.

## Expected behavior and edge cases

- A coach viewing their own request queue sees each request client's current private avatar in both pending and terminal rows when one exists.
- Missing, removed, malformed or unreadable images fall back to the existing initials without breaking the queue.
- The browser receives a request-scoped `/api/coach/requests/<request-id>/client-avatar` URL, not a Storage path.
- Authorization is reevaluated on every image request. A signed-out caller, the request owner acting as a client, another client or another coach receives no bytes.
- Pagination remains bounded at the existing page size, and avatar metadata does not add per-request database queries.

## Assumptions, decisions, and dependencies

- A client who submits a booking request shares their account identity with that request's owning coach; the coach already retains the name and terminal attempt. The adopted correction extends that same bounded participant presentation to the current avatar.
- Reuse the private no-store application-route pattern from DEV0169 rather than issuing signed Storage URLs. The Storage path remains server-only and Storage row-level security independently checks request ownership.
- Add avatar version metadata to the existing bounded coach-owned request projection so one page remains one database projection rather than an N+1 query.
- A forward Supabase migration is required because the existing security-definer projection and private Storage policy intentionally authorize only confirmed bookings.

## Implementation plan

1. Amend the profile-image/privacy product contract for request-scoped owning-coach avatar access.
2. Add a forward migration that projects avatar version metadata with bounded owned request rows, exposes an exact request-avatar reference to the application role and authorizes Storage reads only for the owning coach.
3. Add the repository/service/route contract and construct opaque request-scoped avatar URLs without exposing Storage paths.
4. Render those URLs through the shared avatar component in pending and terminal request identities.
5. Add focused projection, authorization, privacy and presentation tests; run applicable test, database, lint, type, format and build checks.

## Acceptance criteria

- [x] AC1: Pending and terminal request rows display the requesting client's current avatar when available and initials otherwise.
- [x] AC2: Only the owning coach can retrieve request-client avatar bytes; public, client and unrelated actors receive no private reference or bytes.
- [x] AC3: Coach request pages remain bounded and expose an opaque request-scoped URL/version only, never the private Storage path.
- [x] AC4: Existing booking-request decisions, pagination and confirmed-booking avatar behavior remain unchanged.
- [x] AC5: Focused automated checks plus lint, type-check, formatting, database validation and production build pass.

## Validation plan

- Extend pure tests for request avatar URL construction and initials/image presentation input.
- Extend database integration tests with a client avatar fixture to prove owned request projection, exact reference lookup, terminal-history continuity and unrelated-actor denial.
- Validate the new Storage policy with authenticated coach/client identities inside a rollback fixture.
- Run `npm test`, `npm run test:db`, `npm run db:lint`, `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build` and `git diff --check`.
- Inspect the authenticated coach Bookings view at desktop and mobile widths if local browser prerequisites are available; otherwise keep the ticket open and record the missing evidence.

## Implementation record

The coach-owned booking-request projection now includes only the client's avatar update timestamp and converts it to a versioned, opaque application URL. A new authenticated image route resolves the private Storage object on demand after rechecking that the signed-in coach owns the request. The shared request identity renderer consumes that URL, so both pending candidates and `Recent request history` show the current client picture while retaining the existing initials fallback.

### Changes and rationale

- Extended the bounded request projection instead of loading avatar metadata once per row. This preserves existing pagination and avoids an N+1 query while keeping private Storage paths out of browser data.
- Added a request-specific private image boundary rather than reusing the confirmed-booking endpoint. Booking requests and confirmed bookings have independent authorization lifetimes, and terminal request history remains visible after an explicit decline or accepted booking cancellation.
- Added database authorization at both the exact application lookup and Storage row-level-security layers. Only the request's owning coach can resolve or read the current client avatar; clients, unrelated coaches and signed-out callers cannot.
- Passed the opaque URL to the existing `Avatar` component. Missing, removed or unreadable images therefore continue to fall back to stable initials without a separate presentation path.
- Updated the product contract to record request-participant avatar visibility and distinguish it from confirmed-booking avatar access.

### Affected files

| File or component                                                                                                       | Change and purpose                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `docs/mvp-spec.md`                                                                                                      | Records request-scoped owning-coach avatar access in the identity/privacy contract, definition of done and acceptance matrix.                                      |
| `supabase/migration-history/20261016000100/20261011000400_authorize_booking_request_client_avatars.sql`                 | Adds avatar version metadata to the bounded owned-request projection, an exact coach-owned avatar reference function and the matching private Storage read policy. |
| `src/domain/coach-booking-requests.ts`                                                                                  | Adds the nullable opaque `clientAvatarUrl` field to coach-owned request projections.                                                                               |
| `src/profile-images/contracts.ts`                                                                                       | Constructs and validates versioned request-scoped avatar URLs.                                                                                                     |
| `src/server/db/coaches/booking-request-repository.ts`                                                                   | Selects the avatar update timestamp and maps it to an opaque URL without exposing a Storage path.                                                                  |
| `src/server/db/profile-images/repository.ts` and `src/server/profile-images/service.ts`                                 | Resolve and stream request-client avatar bytes through the owning-coach authorization boundary.                                                                    |
| `src/app/api/coach/requests/[requestId]/client-avatar/route.ts`                                                         | Serves private, no-store image responses and preserves the existing missing/unauthorized fallback behavior.                                                        |
| `src/features/coaches/coach-booking-request-queue.tsx`                                                                  | Supplies the request avatar URL to the shared identity renderer for pending and terminal rows.                                                                     |
| `tests/profile-images.test.ts`, `tests/coach-booking-request-queue.test.ts` and `tests/database/coach-bookings.test.ts` | Cover URL construction, presentation input, bounded projection, exact authorization, Storage policy and terminal-history continuity.                               |

### Decisions and deviations

- The implemented authorization remains valid for every persisted request status, including accepted, declined, withdrawn, expired and superseded records. This follows the existing terminal-history identity contract and the ticket's planned scope.
- The database regression suite initially retained an obsolete assertion that cancellation removed all coach access to the raw avatar object. The confirmed-booking reference is still revoked on cancellation, but the same coach can independently retain access through a persisted booking request. The test now verifies these two authorization relationships separately.

### Contracts, configuration, and operations

The coach-owned request data contract gains nullable `clientAvatarUrl`, containing only a versioned `/api/coach/requests/<request-id>/client-avatar` URL. The new route is dynamic, private and `no-store`; no Storage path enters the browser projection. The forward migration must be applied in each deployed Supabase environment before the updated application is released. It was applied to the local database during validation. No environment variable, dependency, seed-data or manual rollback contract changed.

## Validation results

- Date and environment: 2026-10-11, local Supabase stack and application on macOS, Node.js 24.21.0.
- `npx supabase migration up --local`: passed; `20261011000400_authorize_booking_request_client_avatars.sql` applied.
- `npx supabase migration list --local`: passed; local and tracked migration histories both include `20261011000400`.
- `npm test`: passed, 106 application tests and 9 server tests.
- `npm run test:db`: passed, 47 database integration tests. An initial 46/47 run exposed the obsolete cancellation assertion described above; the corrected authorization-specific assertion passed in the final run.
- `npm run db:lint`: passed with no schema errors.
- `npm run lint`: passed.
- `npm run typecheck`: passed, including generated route types for the new image route.
- `npm run format:check`: passed.
- `npm run build`: passed with Next.js 16.3.8; the production route manifest includes the new dynamic request-avatar route.
- `git diff --check`: passed.
- Manual browser rehearsal: as Daniel Park, opened Coach workspace > Bookings, expanded `Recent request history`, and observed Hoang's picture in both accepted and declined history rows at desktop and narrow mobile widths. Status text and row layout remained readable.
- Failed, blocked, or not-run checks: none remain. The initial database-test failure was resolved and rerun successfully; earlier checks accidentally invoked Node.js 20 and were repeated under the required Node.js 24 runtime for the evidence above.

| Criterion | Evidence                                                                                                                              | Result |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Automated projection/presentation coverage plus desktop and mobile history rehearsal showed pictures with initials fallback retained. | Passed |
| AC2       | Exact-reference and Storage-policy integration tests denied clients and unrelated actors while allowing the owning coach.             | Passed |
| AC3       | Database projection assertions verified the bounded page exposes the opaque URL and no private object path.                           | Passed |
| AC4       | Full application, server and database suites passed, including request decisions and confirmed-booking avatar behavior.               | Passed |
| AC5       | Test, database lint, lint, type-check, formatting, production build and diff checks all passed under Node.js 24.                      | Passed |

## Risks, limitations, and follow-ups

- Request history currently has no retention window, so owning-coach access follows the persisted request row. A future retention/deletion policy must revisit both identity and avatar access together.
- The route returns the current avatar, not a request-time snapshot. Removing or replacing the account avatar immediately changes the initials/image result after refresh.

## Completion and review references

- Completed: 2026-10-11.
- Commit: Included in the implementation commit whose subject references DEV0192, DEV0193 and DEV0194; see repository history.
- Review: No review created.
- Deployment or release: Not deployed or released.
