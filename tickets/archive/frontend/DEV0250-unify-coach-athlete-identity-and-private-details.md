# Ticket DEV0250: Unify coach athlete identity and private details

- Status: Completed
- Created: 2026-10-15
- Last updated: 2026-10-16
- Milestone: M6 private connections refinement
- Coordination: None — independent development ticket
- Related records: connection authority [DEV0221](../../archive/backend/DEV0221-persist-coach-athlete-connections.md), coach interface [DEV0222](../../archive/frontend/DEV0222-add-coach-my-athletes.md), independent session titles [DEV0248](../../archive/frontend/DEV0248-add-shared-session-titles-and-message-filtering.md)

## Objective and context

The coach sees Max's photo on one of two shared sessions and cannot open athlete details by clicking his identity. Read-only investigation found one completed and one confirmed local booking, both with an accepted coach–athlete connection and an existing athlete avatar. Booking cards use only the confirmed-booking media projection; they ignore independently authorized connection media. Names/photos are plain presentation and there is no athlete detail destination.

The user selected a private athlete detail page with photo, shared sessions and a message shortcut. Implement against the existing [connection boundary](../../../docs/mvp-spec.md#5-scheduling-state-model) and [private identity permissions](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity), without introducing public athlete profiles.

## Scope and non-goals

- In scope: reuse accepted-connection avatar authority consistently across all shared booking statuses; link coach-side athlete photo/name and My athletes identities to one pair-scoped private detail page; show bounded identity, shared bookings and existing Messages shortcut.
- Out of scope: public athlete browsing, personal biography/goals/email disclosure, new media permission grants, session notes, group-session behavior, changing Max's account/bookings/connections, or committing unrelated work.

## Expected behavior and edge cases

The owning coach's accepted connection supplies one current opaque athlete-avatar URL for confirmed/completed/cancelled booking cards. With no accepted connection, retain existing confirmed-booking photo authority and initials elsewhere; a former connection must grant neither its avatar nor a detail-page link. Identity links resolve to `/coach/athletes/<pairId>` for the same coach–athlete pair across sessions and reconnection attempts.

The private page rechecks the owning coach, dataset and current accepted connection. It shows the athlete's name/photo, shared bookings with canonical titles/date/status, and a message link using the exact pair. It offers a back action to coach Bookings. It contains no unrelated sessions or broader personal-profile fields. Guest access goes through sign-in; malformed, unrelated, athlete-side and removed-connection accesses show no athlete data. Unavailable is explicit. Client presentation clears on actor mismatch. Existing connection avatar download revalidation remains in force.

## Assumptions, decisions, and dependencies

Confirmed: private athlete detail destination. Adopted implementation defaults: accepted connection required for that destination; no new private-data fields; reuse booking/title cards and current connection/photo/history authority instead of adding another profile store. Direct booking/request media permissions remain independent after disconnection. Existing scheduling, connections and DEV0248 titles are available. DEV0237/DEV0249 and uncommitted DEV0248 work are independent and must be preserved.

## Implementation plan

1. Update the specification to describe private connected-athlete details and consistent connection-derived booking media.
2. Reuse the current booking connection-context projection in booking reads; parse it once through the existing validated mapper, prefer accepted connection media for coach-side cards and expose a validated private detail URL.
3. Add an exact pair-filtered coach booking read, protected service/page and actor-bound private detail component; reuse the current booking card and Messages route.
4. Link photo/name on eligible booking and accepted My athletes cards, preserving keyboard/fallback behavior.
5. Add focused projection/render/authorization regression tests and real tagged two-account browser proof for mixed booking statuses, actual image loads, navigation, removed/unrelated denial and mobile/desktop/keyboard/error behavior.

Scope review: one athlete-identity/navigation vertical slice. No independent data feature or migration is needed; existing authorization functions own the data.

## Acceptance criteria

- [x] AC1: Accepted-connection photo presentation is identical across a coach's confirmed/completed shared bookings, with a safe initials fallback and current media route checks.
- [x] AC2: Eligible booking and My athletes photo/name links open one private page containing only that pair's name/photo/shared sessions and message shortcut.
- [x] AC3: Guests, unrelated actors, wrong datasets, malformed IDs and removed connections cannot read private details; disconnected cards retain only independent booking media authority.
- [x] AC4: Focused tests, relevant database regressions, lint/type/build and two-role desktop/mobile/keyboard checks pass; unrelated work and manual user data remain intact.

## Validation plan

Use existing rolled-back booking/connection fixtures to verify completed/confirmed identity projection and removal, participant/dataset isolation and private page lookup. Add meaningful rendering tests for link semantics/fallback and actor-bound private detail. Rehearse with DEV0250-only local Auth/Storage fixtures, real photo bytes and multiple booking states at desktop/mobile widths. Verify guest/unrelated/removed reads and provider failure. Run relevant unit/server/database checks, lint/type/build and record independent active-work failures separately. No schema migration/reset or hosted change is expected.

## Implementation record

### Changes and rationale

2026-10-15: Booking reads now include the existing authorized booking connection context once per row. Its projection is rebuilt by the same validated connection mapper used by connection controls. Coach-side accepted pairs prefer their connection avatar URL for every booking status; athlete-side projections retain no coach-only identity link/media. When a connection is absent or removed, existing confirmed-booking photo lookup remains independent. No Storage path or new personal field enters a booking DTO.

The shared AthleteIdentity component makes the photo/name one keyboard-accessible link on eligible coach booking cards and accepted My athletes cards. It reuses the post-hydration private image/fallback component, so cold failures retain initials. All sessions of a pair link to the same `/coach/athletes/<pairId>` destination.

The dynamic private route uses the verified actor, current dataset and exact accepted pair to select only that coach's original shared bookings. It shows bounded current identity, canonical booking title/date/status cards and the existing pair Messages shortcut; no personal biography, email, goals or unrelated requests are added. Actor/dataset presentation keys suppress old props after an account mismatch. Reconnection reuses the pair URL; removal makes its next read unavailable to that coach, while independently authorized booking controls remain on Bookings.

### Affected files

| File/component                                                                                                                                                                                                                                | Role                                                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Booking repository](../../../src/server/db/coaches/booking-repository.ts), [connection repository](../../../src/server/db/connections/repository.ts)                                                                                         | Reuse current connection context/mapper, verify participant IDs, prefer authorized pair photo and filter exact accepted pairs inside the existing booking query. |
| [Booking contract](../../../src/domain/coach-bookings.ts), [connection helpers](../../../src/domain/coach-athlete-connections.ts)                                                                                                             | Optional athleteProfileHref on booking DTOs; UUID-only private pair URL generation.                                                                              |
| [Identity component](../../../src/features/coaches/athlete-identity.tsx), [booking cards](../../../src/features/coaches/coach-client-cards.tsx), [connection list](../../../src/features/connections/connection-lists.tsx)                    | Shared linked coach-side photo/name; initials and plain identity where no detail permission exists.                                                              |
| [Private page](../../../src/app/coach/athletes/[pairId]/page.tsx), [service](../../../src/server/coaches/athlete-detail-service.ts), [view](../../../src/features/coaches/athlete-detail.tsx), [styles](../../../src/app/coach-workspace.css) | Protected pair detail, guest return-to-sign-in, explicit unavailable/not-found states, actor-bound presentation and responsive identity/navigation.              |
| [Identity tests](../../../tests/athlete-identity.test.ts), [connection database proof](../../../tests/database/coach-athlete-connections.test.ts)                                                                                             | Accessible link/fallback/invalid URLs, mixed statuses, exact-pair reads, actor denial and revocation with independent confirmed-booking fallback.                |
| [Booking fixtures](../../../tests/coach-bookings.test.ts), [connection fixtures](../../../tests/coach-connections.test.ts)                                                                                                                    | Extend existing private booking projection examples with the nullable href.                                                                                      |
| [Browser rehearsal](../../../scripts/rehearse-local-athlete-details.ts), [fixture helper](../../../scripts/lib/local-connection-rehearsal.ts)                                                                                                 | DEV0250-tagged local Auth/Storage fixtures, actual private image downloads and navigation/privacy/responsive checks with exact cleanup.                          |
| [Specification](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity), [index](../../README.md)                                                                                                                                       | Private connected-athlete detail and media contract, lifecycle and validation record.                                                                            |

### Decisions and deviations

No product-scope deviations. Next.js 16.3.8 installed; bundled Server/Client Components and route-handler guides reviewed for the protected route and identity links. The private page is scoped to existing shared bookings, rather than inventing a general athlete-profile store. Original booking/request/history and avatar permissions remain in their existing authorities.

An initial fixture edit duplicated one new DTO property; typecheck found it and it was removed. The first browser run proved both actual image downloads, then stopped on an ambiguous heading locator because the page has one athlete heading and two booking-card headings. Using explicit heading levels corrected the harness; no runtime fix was needed for that selector failure.

### Contracts, configuration, and operations

PrivateBookingProjection adds nullable athleteProfileHref. The coach booking repository accepts an optional validated connectedPairId, evaluated against the existing accepted-context projection; ordinary callers remain compatible. The new route is private and dynamic, with generic page metadata, per-read authority and actor-bound client rendering. No account schema, migration, Storage policy, dependency or environment change. No manual account/bookings/connections were edited. Revert the new consumers/projection field to roll back the interface; no data rollback is required.

## Validation results

2026-10-15, Node 24.21.0, existing local Supabase/Auth/Storage and localhost:3100:

- `npm test`: 154 unit tests and 16 server tests passed, including accessible linked identity, invalid pair hrefs, initials and existing avatar read/download/revocation checks.
- `DATABASE_TEST_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres node --import tsx --conditions=react-server --test --test-concurrency=1 tests/database/coach-athlete-connections.test.ts tests/database/coach-bookings.test.ts`: 28 passed. The extended image test reads completed/confirmed pair bookings, verifies one photo/href, excludes athlete/unrelated viewers, then verifies removed-page lookup returns zero and independent confirmed-booking photo authority survives. Existing forged/dataset/booking-lifecycle tests passed.
- `node --import tsx --conditions=react-server scripts/rehearse-local-athlete-details.ts`: all five final phases passed. Two mixed-status cards downloaded actual nonempty private WebP bytes through the same connection URL. Clicking a photo and My athletes name opened the same detail URL; Message athlete opened the exact pair conversation. Guest sign-in return, athlete/unrelated/malformed denial, 1440px desktop and 375px mobile, keyboard Back navigation, 503 image failure/initials, removal 404 for former media/private detail, independent confirmed-booking photo and fresh reconnection to the same pair URL passed. No page errors or mobile horizontal overflow. Inspected desktop/mobile screenshots are ignored under `test-results/athlete-details-rehearsal/`.
- `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build`: passed. The build includes dynamic `/coach/athletes/[pairId]`.
- Read-only application-repository check of the user's existing Max pair: two sessions, statuses confirmed/completed, both have a photo, both use the same photo URL and both link to the same private page. No manual data mutation was used to make this pass.
- Cleanup audit: zero DEV0250 tagged users remain; Max still has his original two sessions. Test-only avatar objects are removed by the tagged fixture helper.

| Criterion | Evidence                                                                                                                          | Result |
| --------- | --------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Mixed-status database projection and browser actual-image loads; image 503 initials fallback                                      | Passed |
| AC2       | Photo/name and My athletes clicks; shared booking count and exact Messages pair                                                   | Passed |
| AC3       | Existing actor/dataset denial plus new exact-pair/athlete/unrelated/guest/malformed/removal tests; confirmed-booking independence | Passed |
| AC4       | 28 database checks, 170 unit/server checks, static/build checks and inspected two-role responsive rehearsal                       | Passed |

No schema validation/reset is applicable because this change has no migration. The aggregate preview `test:e2e` suite was not run; this actual Auth/Storage-backed rehearsal owns the affected private flow. No hosted rollout or independent review is claimed. After the archive move, a Python consistency check passed 230 local Markdown links/anchors across this ticket, specification and index, plus unique DEV0250 identity, Completed status/path, checked acceptance criteria and next-ID allocation. `git diff --check` passed; no staged changes or commit were created.

## Risks, limitations, and follow-ups

Connection removal revokes the detail page and connection avatar on the next read; a previously rendered page/photo is not a promise of remote erasure. Independently authorized confirmed booking media remains available. The page reuses the existing complete coach booking-list query filtered to one pair; this ticket adds no new history store or public user directory. Notes/plans remain separate. At completion on 2026-10-15, independent DEV0248 changes were still uncommitted and required by the shared booking/title projection. The user authorized committing both on 2026-10-16; the combined delivery subject names both tickets and excludes independent DEV0238 planning edits.

## Completion and review references

- Completed: 2026-10-15 — AC1–AC4 delivered and locally validated.
- Commit: User-authorized delivery commit on 2026-10-16, `[DEV0248][DEV0250] Add session labels, filters and athlete details`; see Git history for its hash. The combined subject includes both IDs because the changes share the booking projection and interface files.
- Review: Self-review against scope and acceptance criteria; no independent review.
- Deployment or release: Local only; not deployed.
