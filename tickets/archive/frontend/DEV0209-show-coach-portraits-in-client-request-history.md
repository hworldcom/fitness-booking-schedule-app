# Ticket DEV0209: Show coach portraits in client request history

- Status: Completed
- Created: 2026-10-12
- Last updated: 2026-10-12
- Milestone: Authenticated workspace redesign
- Coordination: None — independent development ticket
- Related records: [DEV0204 — Redesign client My sessions](../../archive/frontend/DEV0204-redesign-client-my-sessions.md)

## Objective and context

Client `My sessions` request cards currently receive only the coach name and public slug, so pending requests and retained Request history render initials even when the coach has a public portrait. Project the coach's current public portrait through the existing client-owned booking-request read boundary and render it in the linked coach identity. This restores the behavior required by [the confirmed image decision](../../../docs/mvp-spec.md#2-confirmed-target-and-decisions), [identity and data integrity](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity), and the [client My sessions acceptance scenario](../../../docs/mvp-spec.md#13-acceptance-matrix).

## Scope and non-goals

- In scope:
  - Add the current public coach-portrait URL to client booking-request projections.
  - Render that portrait in pending and terminal request cards, with initials retained for missing or failed images.
  - Preserve the existing full coach-identity link to the public coach profile.
  - Add focused projection and browser coverage for the portrait and fallback behavior.
- Out of scope:
  - Changing coach-side access to private client avatars.
  - Uploading, copying, or persisting additional image bytes.
  - Changing request lifecycle, status copy, pagination, booking decisions, or public profile behavior.
  - Redesigning Profile or other authenticated workspace surfaces.

## Expected behavior and edge cases

A signed-in client sees a coach's current public portrait beside that coach's name in both awaiting-confirmation requests and Request history. A coach without a public portrait, or a portrait that fails to load, continues to show deterministic initials. The entire visible coach identity remains linked to `/coaches/<slug>`. The client projection must never expose a private account avatar or a Storage object path.

## Assumptions, decisions, and dependencies

- The established public coach-portrait metadata and URL builder are the only image source for this surface.
- Request rows remain client-owned and actor-scoped; the repository may enrich the authorized function output by joining the matching coach profile using its returned run/profile identifiers, as the confirmed-booking repository already does.
- No database migration is required because the public portrait metadata already exists on `app.coach_profiles` and no stored function contract needs to change.
- DEV0204 is completed historical context. This correction does not expand the COR0018 work map or change DEV0207 Profile scope.

## Implementation plan

1. Extend the client booking-request domain projection with a nullable public coach-portrait URL.
2. Enrich all client request repository reads with validated public portrait metadata while leaving coach-owned request projections unchanged.
3. Pass the URL and meaningful alternative text to the shared request-card avatar.
4. Update unit/database fixtures and the client-request browser rehearsal to cover portrait display, profile linkage, and initials fallback.
5. Run focused and repository-wide validation, complete the implementation record, archive the ticket, update the index, and commit the isolated change.

## Acceptance criteria

- [x] AC1: A client sees the coach's current public portrait on pending and retained terminal request cards when a valid portrait exists.
- [x] AC2: Request cards without a valid portrait retain coach initials, and failed image loads degrade to the same fallback.
- [x] AC3: The complete request-card coach identity remains linked to the correct public coach profile and no private avatar or Storage path is exposed.
- [x] AC4: Focused unit/database/browser checks plus applicable lint, type, formatting, build, and regression suites pass.

## Validation plan

- Extend the client-request unit fixture so projection/model regressions must carry the nullable portrait contract.
- Extend the authorized database integration test to prove list, exact and selected pending request reads return the coach's public portrait URL without returning client-private fields.
- Extend `npm run test:client-requests` to verify a portrait image appears in Request history inside the existing coach-profile link and that the workflow remains responsive and error-free.
- Run `npm test`, `npm run test:db`, `npm run test:client-requests`, `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build`, and `git diff --check` with the repository-required Node.js 24 runtime. Inspect affected desktop/mobile browser evidence.

## Implementation record

Completed on 2026-10-12. Client-owned booking-request projections now carry the coach's validated current public portrait URL, and the shared pending/history card renders that portrait inside the existing public-profile link while retaining the shared `Avatar` initials fallback.

### Changes and rationale

Previously, request reads returned the coach's name and public slug but omitted public portrait metadata, so `My sessions` always rendered coach initials for booking requests even when confirmed-session cards and public surfaces could show the portrait. The three client request read paths now enrich the actor-scoped stored-function result with the matching coach profile's public portrait metadata, validate that metadata against the existing fixture/storage ownership rules, and expose only the final public URL. The request card passes that nullable URL to the existing resilient `Avatar` component; missing or failed images continue to become initials.

The repository join follows the already-established confirmed-booking pattern and uses both `run_id` and `coach_profile_id`, preserving demo-run isolation. Coach-owned request reads and their private client-avatar behavior are unchanged.

### Affected files

| File or component | Change and purpose |
| --- | --- |
| [`src/domain/coach-booking-requests.ts`](../../../src/domain/coach-booking-requests.ts) | Adds the nullable `coachPortraitUrl` field to the bounded client request projection. |
| [`src/server/db/coaches/booking-request-repository.ts`](../../../src/server/db/coaches/booking-request-repository.ts) | Resolves, validates and maps current public coach portraits for paginated, exact and selected-pending client request reads. |
| [`src/features/profile/client-booking-requests.tsx`](../../../src/features/profile/client-booking-requests.tsx) | Renders the portrait within the existing linked coach identity and retains initials fallback behavior. |
| [`tests/client-booking-requests.test.ts`](../../../tests/client-booking-requests.test.ts) | Updates the request projection fixture for the new bounded field. |
| [`tests/database/coach-bookings.test.ts`](../../../tests/database/coach-bookings.test.ts) | Proves all three authorized client request reads return the public URL while retaining client-data isolation. |
| [`scripts/rehearse-local-client-booking-requests.mjs`](../../../scripts/rehearse-local-client-booking-requests.mjs) | Verifies Request history portraits and public-profile links in the real signed-in workflow at desktop and mobile widths. |
| [`tickets/README.md`](../../README.md) | Tracks DEV0209 through completion and advances the next DEV identifier. |

### Decisions and deviations

- 2026-10-12: Keep this correction independent from the Profile redesign because it repairs the completed `My sessions` portrait contract and can be implemented and validated as one small vertical slice.
- 2026-10-12: Reuse the existing public portrait URL validation and shared `Avatar` failure fallback rather than create request-specific media storage or proxy behavior.
- No implementation-plan deviations were required.

### Contracts, configuration, and operations

The public `ClientCoachBookingRequestProjection` contract adds `coachPortraitUrl: string | null`. No database schema, stored-function signature, environment variable, dependency, migration or setup step changed. The repository reads existing `app.coach_profiles` portrait columns and returns either a validated fixture/public Storage URL or `null`; raw private avatar references and raw Storage object paths remain outside the browser projection. Rollback is the application-code revert only.

## Validation results

Validated on 2026-10-12 in the local macOS development environment with Node.js 24.21.0, local Supabase PostgreSQL/Auth/Mailpit, and Chrome through Playwright.

- `npm exec -- tsx --test tests/client-booking-requests.test.ts` — passed 2 focused client-request model tests.
- `npm test` — passed 122 unit tests and 9 React-server tests, including the existing shared portrait/initials fallback coverage.
- `npm run test:db` — passed all 47 database integration tests. Added assertions cover the paginated history, exact request and selected-pending projections and retain the absence of client-private identity fields.
- `npm run test:client-requests` — passed the complete signed-in client/coach workflow. The rehearsal observed the portrait and `/coaches/daniel-park` link on the first withdrawn history card, then verified every retained Request history card exposed the same linked portrait.
- `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build`, and `git diff --check` — passed. The production build compiled all routes successfully.
- Inspected the generated 1440×2753 desktop and 430×3616 mobile screenshots. Coach portraits are visible and aligned in all seven request-history cards; the mobile cards remain readable around the fixed bottom navigation.
- An initial focused unit/type smoke check also passed under the shell's unsupported Node.js 20.12.2, but it was not used as completion evidence; the applicable suites were rerun with the repository-required Node.js 24.21.0 runtime.
- Failed, blocked, or not-run checks: none.

| Criterion | Evidence | Result |
| --- | --- | --- |
| AC1 | Database projections returned the public portrait URL; the browser rehearsal and inspected desktop/mobile evidence showed it on every retained history card. | Passed |
| AC2 | Nullable projection plus the shared `Avatar` behavior preserves initials for absent or failed images; the existing portrait/fallback unit test passed in `npm test`. | Passed |
| AC3 | Browser assertions verified every history identity links to `/coaches/daniel-park`; bounded mapping exposes the final public URL only and database tests retained private-client-field isolation. | Passed |
| AC4 | Focused, full unit/server, 47 database, browser, lint, type, format, build and diff checks all passed under Node.js 24.21.0. | Passed |

## Risks, limitations, and follow-ups

- The card intentionally presents the coach's current public portrait rather than snapshotting media at request creation.
- Coaches without a portrait still show initials by design. No follow-up is currently required.

## Completion and review references

- Completed: 2026-10-12 — client pending/history request identities now render the coach's current public portrait with safe initials fallback.
- Commit: This completed record is included with the implementation commit whose subject references DEV0209.
- Review: No review created.
- Deployment or release: Not deployed or released.
