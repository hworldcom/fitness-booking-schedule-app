# Ticket DEV0187: Enforce booking-request eligibility

- Status: Completed
- Created: 2026-10-10
- Last updated: 2026-10-11
- Milestone: Scheduling-only booking-policy follow-up
- Coordination: [COR0016 — Coach-confirmed booking requests](../../current/organisatory/COR0016-coach-confirmed-booking-requests.md)
- Related records: completed contract dependency [DEV0186 — Adopt booking-request and notice policies](../organisatory/DEV0186-adopt-booking-request-and-notice-policies.md), request consumer [DEV0188 — Persist multi-candidate booking requests](../../current/backend/DEV0188-persist-multi-candidate-booking-requests.md), availability baseline [DEV0177 — Bind availability to training locations](DEV0177-bind-availability-to-training-locations.md)

## Objective and context

Replace immediate-booking eligibility with one authoritative approval-request boundary. Current open occurrences are directly bookable at any future instant within the seven-day publication horizon. Every coach will instead receive approval requests for an open occurrence until that occurrence starts, with truthful public eligibility derived from database time.

## Scope and non-goals

- In scope:
  - Add a shared server/database rule that keeps an open occurrence requestable only while its start remains in the future.
  - Project request eligibility for public coach occurrences without relying on browser time.
  - Replace the current direct-booking entry point with the authoritative eligibility check consumed by DEV0188 request creation.
  - Distinguish an eligible open occurrence from booked, withdrawn, elapsed and provider-unavailable states.
  - Preserve the current seven-day maximum publication horizon and timezone-safe occurrence instants.
- Out of scope:
  - Pending-request persistence and selection owned by DEV0188.
  - Coach/client request interfaces owned by DEV0189/DEV0190.
  - Coach-level policy storage or settings, configurable notice/deadline values, configurable publication horizons, per-location/per-slot policies, notifications or attendance confirmation.

## Expected behavior and edge cases

- Every coach and occurrence uses approval requests; there is no instant mode or coach policy mutation.
- Eligibility compares the database statement timestamp to the occurrence start; browser time cannot authorize a request.
- A request may be created only when the occurrence is open, the coach can receive requests and the start is later than the authoritative database statement time.
- There is no fixed minimum-notice interval. A future open occurrence remains requestable even when fewer than 24 hours remain because coach acceptance, not request creation, assigns capacity.
- An ineligible public occurrence remains truthful: the projection distinguishes booked, withdrawn, elapsed and database-unavailable state.
- Hidden or suspended coaches, self-requests, cross-run actors and malformed identifiers fail without partial changes.

## Assumptions, decisions, and dependencies

- DEV0186 completed on 2026-10-11. Its original fixed-notice decision is superseded by the user's 2026-10-11 direction recorded in this current ticket and the MVP specification; the archived record remains unchanged as historical evidence.
- Keep the seven-day publication horizon unchanged. Maximum-advance configurability is not part of this ticket.
- Avoid adding policy storage when the only lower time boundary is the occurrence start. Keep eligibility in one tested domain/database boundary so a later configurability ticket can introduce notice policy without changing request persistence semantics.
- The current service area is Berlin. Occurrence instants remain timezone-safe and public presentation uses `Europe/Berlin`; browser timezone does not change eligibility.
- DEV0188 will cap a request's decision deadline at the earlier of 12 hours after submission or occurrence start, so late requests cannot remain pending after training begins.

## Implementation plan

1. Review DEV0186 and current coach/availability/direct-booking conventions.
2. Add the shared future-occurrence eligibility rule and public occurrence projection.
3. Replace direct-booking action eligibility with the request boundary consumed by DEV0188.
4. Add domain, repository and service results for eligible and otherwise unavailable occurrences.
5. Add authorization, boundary-time, projection and compatibility tests; add a migration only if implementation requires stored contract changes.

## Acceptance criteria

- [x] AC1: Every eligible coach occurrence exposes only the approval-request path, with no coach mode or setting.
- [x] AC2: PostgreSQL keeps a future open occurrence requestable with no fixed minimum-notice interval and rejects it at or after its start; browser time, stale pages and direct calls cannot bypass that boundary.
- [x] AC3: Public projections distinguish requestable, booked, withdrawn and unavailable actions without exposing private request data.
- [x] AC4: Hidden/suspended coaches, self-requests, elapsed occurrences and unauthorized/cross-run actors fail closed.
- [x] AC5: Fresh/upgrade migration, database, unit, lint, type and build validation pass.

## Validation plan

- Run fresh and upgrade Supabase migrations plus database lint when schema changes are required; otherwise record why migration checks are unaffected.
- Add database integration checks immediately before, exactly at and after the occurrence start plus actor/coach/occurrence eligibility and stale-page/direct-call bypass attempts.
- Add domain/service tests for Berlin presentation and public eligibility projections.
- Run configured test, lint, type-check, format and production-build commands.

## Implementation record

Implementation started on 2026-10-11.

### Changes and rationale

- Added one PostgreSQL-owned occurrence classifier and one actor-safe eligibility projection. An open occurrence is requestable only while its start is later than PostgreSQL `statement_timestamp()` and its end remains inside the existing seven-day horizon.
- Replaced the direct-booking repository/service path with a read-only eligibility boundary for the later request-persistence ticket. The historical `app.book_direct_private_session(uuid)` signature remains present but always raises a bounded error, so a stale application instance cannot bypass coach approval.
- Added bounded public request state to each future occurrence. Public schedule reads may now return `requestable`, `booked`, `withdrawn` or `unavailable` without returning private booking/request identity.
- Changed the coach-profile schedule from direct Book controls to truthful request-oriented presentation. Signed-out users can proceed to sign-in; signed-in users see the future request action as coming in DEV0190, and no UI reports a booking that the current phase cannot persist.
- Updated the product contract and current COR0016 work records for the user's removal of minimum notice. Requests remain eligible until training starts; DEV0188 will set each deadline to the earlier of submission plus 12 hours or occurrence start.

### Affected files

| File or component                                                                                                   | Change and purpose                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/20261011000100_enforce_booking_request_eligibility.sql`                                        | Adds the database-time eligibility functions, permits bounded public reads of future occurrence status and makes the historical direct-booking function fail closed.                                          |
| `src/domain/coaches.ts`                                                                                             | Defines the bounded eligibility enum and public/actor-safe projections without a notice-cutoff timestamp.                                                                                                     |
| `src/server/db/coaches/availability-repository.ts`, `src/server/db/coaches/repository.ts`                           | Classifies public future occurrences in PostgreSQL and maps only the bounded public eligibility value.                                                                                                        |
| `src/server/db/coaches/booking-repository.ts`, `src/server/coaches/booking-service.ts`                              | Replaces direct booking creation with actor-safe eligibility lookup while retaining existing confirmed-booking cancellation/completion reads and mutations.                                                   |
| `src/app/coach-marketplace-actions.ts`, `src/features/coaches/coach-marketplace.tsx`                                | Removes active direct booking, presents coach-confirmation state and leaves request submission visibly unavailable until DEV0188/DEV0190 deliver persistence and client controls.                             |
| Public story, metadata and shell files under `src/app/`, `src/components/` and `src/features/public/`               | Replaces direct/immediate-booking promises with coach-confirmed request terminology, including the no-minimum-notice statement.                                                                               |
| `tests/database/coach-bookings.test.ts`, `tests/database/coach-availability.test.ts` and related unit/browser tests | Covers the exact future/start boundary, actor isolation, hidden/self/stale direct-call failure, public non-open states, compatibility of confirmed-booking history, updated copy and responsive public flows. |
| `docs/mvp-spec.md`, `tickets/README.md`, COR0016/downstream request records and affected COR0013 native plans       | Records the corrected no-minimum-notice rule, start-capped downstream deadline and approval-only mobile dependency while preserving archived direct-booking/DEV0186 records as historical evidence.           |

### Decisions and deviations

- 2026-10-11: Replanned from persisted coach-selectable modes to one fixed approval-request rule after the user removed instant booking and deferred configurability.
- 2026-10-11: Removed the planned 24-hour minimum notice before completing implementation. The user decided approval already protects the coach, so any open future occurrence remains requestable. The later persistence ticket caps the 12-hour decision window at occurrence start for late requests.

### Contracts, configuration, and operations

The public occurrence contract adds `requestEligibility` with four allowed values: `requestable`, `booked`, `withdrawn` and `unavailable`. The actor-safe lookup returns the occurrence ID, eligibility and authoritative database time. There is no cutoff timestamp because there is no minimum-notice policy.

The migration adds `app.coach_booking_request_eligibility(text, timestamptz, timestamptz)` and `app.current_coach_booking_request_eligibility(uuid)`. It replaces the behavior—but not the signature—of `app.book_direct_private_session(uuid)` with a fail-closed compatibility boundary. It also expands the existing public occurrence row-level security policy from open-only rows to bounded future rows for visible trusted coaches so the application can distinguish booked/withdrawn/unavailable state. No private booking or candidate identity is exposed.

No environment variable, external service or notice-policy storage was added. The migration has no data backfill or destructive rollback requirement. Restoring direct booking would be a product rollback rather than a safe schema rollback and must not happen while approval-only booking remains authoritative.

## Validation results

- Date and environment: 2026-10-11 on the local Supabase stack at PostgreSQL port 55322 and Next.js production server port 3101. The shell provided Node.js 20, so Next/Supabase printed the repository's known Node 24 upgrade warning; commands still completed successfully.
- `npm test`: passed 100 domain/unit tests and 7 server-action tests.
- `npm run test:db`: passed all 39 database integration tests, including exact pre-start/start eligibility, one-hour-late requestability, actor/coach isolation, public state projection and stale direct-booking rejection.
- `npm run db:lint`: passed with no schema errors.
- `npm run lint`, `npm run typecheck`, `npm run format:check` and `git diff --check`: passed.
- A targeted filesystem checker resolved every relative Markdown link in the twelve changed specification/current/archive work-record files.
- `npm run build`: passed. A second build with complete local-shaped database/Auth public configuration also passed for database-backed browser validation.
- `npm run test:e2e -- tests/browser/public-story.spec.ts`: passed 6/6 desktop/mobile checks, including the new before-start language and absence of 24-hour copy.
- `DATABASE_URL=<local-runtime-url> NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test-only NEXT_PUBLIC_SITE_URL=http://localhost:3101 npm run test:e2e -- tests/browser/coach-discovery.spec.ts`: passed 8/8 desktop/mobile discovery, profile and protected-workspace checks. An earlier database-only run failed four signed-out expectations because that deliberately incomplete Auth configuration selects the application's unavailable state; rerunning with the complete non-secret test configuration passed.
- Upgrade migration: passed. The migration was reapplied transactionally to the existing local database without resetting data, followed by database lint and the complete integration suite.
- Fresh migration: passed in an isolated Supabase-shaped database. `npx supabase migration up --db-url postgresql://postgres:postgres@127.0.0.1:55322/movx_dev0187_fresh_20261011b --include-all` applied all 42 migrations from an empty application schema. A direct query confirmed `requestable` immediately before start, `unavailable` exactly at start and the fail-closed direct-booking definition. The disposable database was then removed. An earlier `supabase db reset` attempt hung in the local Docker control path before applying anything; direct migration validation avoided that path without touching working data.

| Criterion | Evidence                                                                                                                                                                                    | Result |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Direct database entry point fails closed; repository/service direct creation is absent; UI and public copy expose coach confirmation only.                                                  | Passed |
| AC2       | Database tests prove an open occurrence one microsecond in the future is requestable and the same occurrence is unavailable exactly at start, using PostgreSQL statement time.              | Passed |
| AC3       | Database availability tests project only requestable/booked/withdrawn/unavailable and no private booking/request identity.                                                                  | Passed |
| AC4       | Database tests cover self, hidden, suspended, missing, malformed and cross-actor cases plus stale direct calls without partial booking creation.                                            | Passed |
| AC5       | All 42 migrations applied in an isolated fresh database; upgrade migration, database suite/lint, application tests, lint, type, format, build and focused responsive browser checks passed. | Passed |

## Risks, limitations, and follow-ups

- Public eligibility is informational; every mutation must repeat the database check to prevent clock drift or stale-page bypass.
- Coach-, location- or slot-configurable timing would materially expand the model and requires a later contract.
- This phase intentionally disables direct booking before DEV0188 persists approval requests and DEV0190 enables the signed-in Request action. The disabled `Coach request coming soon` control is truthful transitional behavior, not the completed COR0016 client flow.

## Completion and review references

- Completed: 2026-10-11.
- Commit: Implementation and the overlapping DEV0191 documentation reconciliation are included in `[DEV0187][DEV0191] Enforce request eligibility and reconcile notice policy`.
- Review: No review created.
- Deployment or release: Not deployed or released.
