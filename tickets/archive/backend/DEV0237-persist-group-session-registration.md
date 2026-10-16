# Ticket DEV0237: Persist group sessions and registration

- Status: Completed
- Created: 2026-10-15
- Last updated: 2026-10-15
- Milestone: M7 — Group training and events
- Coordination: [COR0021 — Group training and events](../../current/organisatory/COR0021-group-training-and-events.md)
- Related records: contract owner [DEV0233](../../archive/organisatory/DEV0233-define-group-training-and-events-growth-scope.md); peer dependencies and independent visual baselines are listed below and in COR0021

## Objective and context

Persist the new nonfinancial group-session and registration domain, approved owner drafts, bounded public/participant/roster projections, direct one-seat joins, withdrawal, manual confirmation, cancellation and deadline reconciliation. Published terms and venue snapshots are immutable. Publication and cross-product schedule reservations are owned by DEV0238. Implement against the [group contract](../../../docs/mvp-spec.md#15-group-training-and-events), [M7 milestone](../../../docs/mvp-spec.md#12-delivery-milestones) and [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix). The user confirmed free/pay-at-session pricing and direct joining with manual coach confirmation. Adopted implementation defaults are labelled separately in the contract.

## Scope and non-goals

- In scope: Persist the new nonfinancial group-session and registration domain, approved owner drafts, bounded public/participant/roster projections, direct one-seat joins, withdrawal, manual confirmation, cancellation and deadline reconciliation. Published terms and venue snapshots are immutable. Publication and cross-product schedule reservations are owned by DEV0238.
- Out of scope: Publication/scheduling conflict integration, frontend routes, payment collection/tracking, wallets, recurring events, waitlists, notifications, connections, attendance and legacy-event restoration.

## Expected behavior and edge cases

A join reserves one seat and recovers exact retries; one active registration per account/session and database locking prevent oversubscription. Only the owner confirms, only with the minimum met before the deadline. No decision expires to Not confirmed, never automatic confirmation. Withdrawal before start preserves registration history and never reverses confirmed status. Coach cancellation releases active registrations once. Guests receive aggregate counts only; the owner gets a paginated name/initials roster without email/private-avatar access.

## Assumptions, decisions, and dependencies

The adopted DEV0233 contract. This ticket exposes no unguarded publication path; published fixture records are isolated test data until DEV0238 provides the publication boundary.

This is one peer implementation boundary, not a parent of other development tickets. Implementation started on 2026-10-15. Next.js 16.3.8's bundled data-security guide and installed Drizzle 0.45.2 conventions were inspected. Significant implementation choices and deviations are recorded below before implementation.

Implementation choices before edits: add new `coach_group_sessions`/`coach_group_registrations` tables, actor-checked JSON command functions and separate public reads, with forced row-level security and no raw runtime table grants. Use stable UUID draft/registration identities, optimistic draft revisions, session-row locking for capacity/lifecycle, database time checked after locking, frozen reviewed terms/venue, bounded keyset pages (20 sessions/50 roster entries), and explicit typed parsers at the server boundary. No HTTP route or publication operation is exposed. Application-owner publication is explicitly denied until DEV0238; database-administrator fixtures alone may represent published sessions for tests. Local migration validation preserves the existing stack and uses separate disposable databases for clean replay/races where practical; no reset of existing user data is authorized or required.

## Implementation plan

1. Inspect installed database/server conventions; add additive new scheduling-owned tables and actor-checked functions without reading legacy funding tables.
2. Implement draft and registration/lifecycle repositories, domain validation and services. Leave publication inaccessible until DEV0238 completes; do not ship a bypass for testing.
3. Add meaningful SQL/driver/server tests for exact actors, privacy, retries, concurrent last-seat joins, confirm/withdraw/deadline races, terminal history and demo-dataset isolation.
4. Validate fresh and preserved-data migrations, constraints and current private scheduling regressions; finish the record before archival.

## Acceptance criteria

- [x] AC1: New session/registration records follow the specification, preserve venue/price terms and reveal only authorized projections; old funding tables remain unused.
- [x] AC2: Concurrent joins cannot exceed capacity, duplicate retries recover one registration, and withdrawal/rejoin history is stable.
- [x] AC3: Manual minimum/deadline confirmation, owner cancellation and missed-deadline reconciliation return one atomic outcome; no automatic confirmation exists.
- [x] AC4: Migrations, meaningful database/server/private-session regression tests and applicable static/build checks pass; publication remains protected by DEV0238.

## Validation plan

Run focused pgTAP and database integration/server tests, then `npm test`, `npm run db:test`, `npm run test:db`, `npm run db:lint`, `npm run lint`, `npm run typecheck`, `npm run format:check` and `npm run build` as applicable. Use only isolated local fixtures; validate clean and preserved-data migration paths. Browser validation belongs to the UI peers and DEV0241.

## Implementation record

### Changes and rationale

Delivered the new nonfinancial group-session data layer. Approved/demo owners can save private drafts with stable UUIDs and optimistic revisions. Free is zero cents; pay-at-session uses fixed nonnegative EUR integer cents. Owned active locations are copied into bounded venue snapshots. Published terms cannot be edited, terminal decisions cannot be reopened, and registration attempts remain historical records.

Direct joining locks the session row and reserves one seat without confirming the activity. Exact submission retries recover the original attempt; a different submission while already active recovers that active seat. Withdrawal/rejoin creates a new attempt, and a stale withdrawal cannot remove its replacement. Only the owner can manually confirm with the current minimum met before the deadline. Confirmation remains after subsequent withdrawals. Cancellation and missed-deadline reconciliation resolve all active attempts once. Database time is checked after the session lock, including when a confirmation began before the deadline and waited beyond it.

Public reads expose current eligible coach/session presentation and aggregate counts. Exact participants retain their own history for hidden/suspended coaches; only the owner reads the paginated names/initials roster. No participant account/authentication IDs, email, private avatar references or private-session data enter public projections. Group participation creates no booking, connection or messaging entitlement. Cross-dataset actors and forged publication operations fail closed.

### Affected files

| File                                                                                                                                                                                                                        | Role                                                                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Additive migration](../../../supabase/migration-history/20261016000100/20261015000500_create_group_session_registration.sql)                                                                                               | New tables, constraints, forced row-level security (RLS), internal guards/locks/projections and the two restricted-runtime JSON entry points. Existing private scheduling, mail and legacy funding functions are unchanged. |
| [Domain contracts](../../../src/domain/group-sessions.ts)                                                                                                                                                                   | Typed commands, session/registration/page projections, bounded input/output parsers, calendar-date checks and lossless microsecond cursors.                                                                                 |
| [Schema mappings](../../../src/server/db/schema/group-sessions.ts), [schema index](../../../src/server/db/schema/index.ts)                                                                                                  | Drizzle mappings for the new tables and their relationships/indexes. SQL remains the authority for database guards and RLS.                                                                                                 |
| [Repository](../../../src/server/db/group-sessions/repository.ts), [service](../../../src/server/group-sessions/service.ts)                                                                                                 | Parameterized actor-context database calls, strict result parsing, bounded conflicts and invalid/unavailable handling before any future route is exposed.                                                                   |
| [Domain tests](../../../tests/group-sessions.test.ts), [server boundary tests](../../../tests/server/group-session-boundaries.test.ts)                                                                                      | Price/time/input bounds, private-field rejection, cursor precision and rejection before authentication/database access.                                                                                                     |
| [Driver integration tests](../../../tests/database/group-sessions.test.ts), [pgTAP tests](../../../supabase/tests/database/group-sessions.test.sql)                                                                         | Real restricted-role privacy, identity/history, capacity/decision races, deadline waits, fifty-entry roster paging, elapsed sessions and database permissions/guards.                                                       |
| [Specification](../../../docs/mvp-spec.md), [COR0021](../../current/organisatory/COR0021-group-training-and-events.md), [ticket index](../../README.md), [DEV0238](DEV0238-integrate-group-session-scheduling-conflicts.md) | Accurate partial-delivery status and the next peer's backend dependency handoff.                                                                                                                                            |
| [DEV0249](DEV0249-repair-legacy-seed-location-compatibility.md)                                                                                                                                                             | Separately records the pre-existing incompatible legacy seed fixture found during validation; no seed repair is included here.                                                                                              |

### Decisions and deviations

- 2026-10-15: Preserved the adopted contract and flat COR0021 ownership. No public/server action/HTTP route or runtime publication operation is exposed. The database guard rejects application-owner draft publication until DEV0238 adds schedule authority. Only database administrators (superusers or roles with database/role creation and RLS bypass capabilities) may seed published integration fixtures; the application owner/runtime roles have none of those capabilities.
- RLS lookup policies are SELECT-only. Coach/application/location row locks additionally require UPDATE visibility, so narrow UPDATE policies use the internal flag with `WITH CHECK (false)`: they permit locking without authorizing group commands to mutate those records. An initial integration failure exposed this requirement and was resolved before final validation.
- Keyset cursor timestamps preserve PostgreSQL microseconds instead of rounding through JavaScript milliseconds; 52 real attempts and owner/public paging verify history traversal without repeats/skips. Owner/participant list reconciliation covers the requested bounded page, avoiding stale status behind an unrelated expiry backlog.
- Validation used disposable databases to preserve existing local accounts, media, mail, migration history and the running development server. A clean migration replay uses one transaction per file because an older migration relies on transaction-scoped temporary tables. The complete existing seed fails independently of DEV0237 at its legacy funding-event fixture; this is recorded under DEV0249. Current deterministic fixtures were loaded by excluding only that obsolete INSERT block, without editing the repository seed. This is not evidence that the full seed/reset path works.

### Contracts, configuration, and operations

Apply `20261015000500_create_group_session_registration.sql` transactionally after the existing identity, coach/location and messaging foundation. It adds `app.coach_group_sessions` and `app.coach_group_registrations` and grants `app_runtime` only `app.group_session_command(text,jsonb)` and `app.public_group_sessions(text,jsonb)`. The actor command derives identity/dataset from the verified transaction context; public reads choose the active public dataset. All helper functions and raw table privileges remain unavailable to browser/Data API/runtime roles.

Session statuses are Draft/Open/Confirmed/Cancelled/Not confirmed, with Ended derived for elapsed confirmed history. Registration attempts are Active/Withdrawn/Session cancelled/Session not confirmed. Session pages contain at most 20 entries and the owner roster at most 50, with stable keyset continuation. Session slug is `group-` plus the UUID without hyphens. Confirmed minimum/maximum, EUR price, Berlin date/time/deadline and venue terms follow section 15.

No dependency, environment variable, setup credential or existing data-shape change is required. No payment/attendance ledger, legacy funding import or private-session mutation is added. No migration was applied to the existing shared local database, and no hosted deployment occurred. Keep the additive migration/history if reverting application code; do not drop retained group history as an application rollback. DEV0238 must replace the publication deny guard with coach-wide scheduling authority before adding a publication entry point.

## Validation results

Validation completed on 2026-10-15 with Node.js 24.21.0, Next.js 16.3.8, Drizzle 0.45.2, PostgreSQL 17.11 and Supabase CLI 2.120.0. Tests use generated local-only actors, exact-ID cleanup and disposable databases, never a reset of the shared stack. Final self-review checked scope, privacy, lock ordering, retry/terminal semantics and every criterion below; no independent review is claimed.

- Clean migration replay: concatenated all 52 checked-in migrations, each wrapped in its own `BEGIN`/`COMMIT`, then ran `docker exec -i supabase_db_fitness-booking-social-app psql -U supabase_admin -d dev0237_clean -v ON_ERROR_STOP=1 -f - < /tmp/dev0237-clean-replay.sql`: passed. Log: `/tmp/dev0237-clean-replay.log`.
- Preserved-data upgrade: restored `pg_dump --schema-only` into `dev0237_preserved`, loaded current deterministic fixtures, enrolled a generated user-owned actor and applied the final group migration with `psql -U postgres`. Transactional before/after hashes of profiles, runs, gyms, coach profiles, private bookings and legacy event rows matched exactly. Log: `/tmp/dev0237-preserve.log`. No private user data was copied/exported from the shared database.
- `DATABASE_TEST_URL=postgresql://postgres:postgres@127.0.0.1:55322/dev0237_preserved node --import tsx --conditions=react-server --test --test-concurrency=1 tests/database/group-sessions.test.ts`: 20 tests passed, zero failures. Covers actual last-seat competition, duplicate decisions, confirm/withdraw race, a lock wait across deadline, immutable terms, visibility/suspension, cross-dataset denial, full roster/own-history paging and absent booking/connection/mail side effects. Log: `/tmp/dev0237-final-group-database.log`.
- `DATABASE_TEST_URL=postgresql://postgres:postgres@127.0.0.1:55322/dev0237_clean node --import tsx --conditions=react-server --test --test-concurrency=1 tests/database/*.test.ts`: 98 tests passed, zero failures, including current private scheduling, connections, messaging, identity and media regressions. Log: `/tmp/dev0237-final-all-database.log`.
- `npx supabase test db --db-url postgresql://postgres:postgres@127.0.0.1:55322/dev0237_clean`: all 12 files / 217 pgTAP assertions passed. Log: `/tmp/dev0237-final-pgtap.log`.
- `npx supabase db lint --db-url postgresql://postgres:postgres@127.0.0.1:55322/dev0237_clean --schema app --fail-on warning`: passed with no warnings/errors. Log: `/tmp/dev0237-final-sql-lint.log`. Explicit disposable targets replace the default shared-database npm wrappers deliberately.
- `npm test`: 152 application/model/render tests plus 16 server tests, 168 total, passed. Log: `/tmp/dev0237-unit-server.log`.
- `npm run lint`, `npm run typecheck`, `npm run format:check`: passed. Logs: `/tmp/dev0237-{eslint,types,format}.log`.
- `npm run build`: passed in an ignored source snapshot without environment files and with database/Supabase/site/map environment values empty. All snapshot `src` files were compared byte-for-byte with the workspace. Log: `/tmp/dev0237-build.log`. Next.js emitted the snapshot workspace-root warning and existing Node JSON-module experimental warnings; compilation, typechecking and prerendering succeeded. The owned snapshot was removed afterward, preserving the root development build.
- Browser/viewport/keyboard checks: not applicable to this backend-only change; no route, markup or browser behavior changed. DEV0239/DEV0240 and integrated DEV0241 own that evidence.
- Documentation link/status/ID/coordination consistency, formatting and `git diff --check`: passed after archival. Disposable validation databases were removed after their checks.

| Criterion | Evidence                                                                                                                                                                    | Result |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | New tables/constraints, strict public/participant/owner projections, frozen-venue/price tests, forged-actor and cross-dataset denial, unchanged legacy/private records.     | Passed |
| AC2       | Concurrent last-seat joins, exact/new-submission retries, withdrawal/rejoin and stale-attempt recovery, 52 retained attempts paged without loss.                            | Passed |
| AC3       | Explicit minimum-qualified confirmation, post-confirmation withdrawal, decision/withdrawal and cancellation races, missed-decision expiry after lock wait, elapsed history. | Passed |
| AC4       | Clean/preserved migrations, 98 driver cases, 217 pgTAP assertions, 168 application/server cases, SQL lint, lint/type/format/build and publication-denial tests.             | Passed |

## Risks, limitations, and follow-ups

Publication and group/private time reservations remain [DEV0238](DEV0238-integrate-group-session-scheduling-conflicts.md); coach and public/athlete interfaces remain DEV0239/DEV0240, followed by DEV0241's integrated rehearsal. No externally usable Events feature, notification, payment or attendance proof is claimed by this backend slice. Reconciliation is bounded and demand-driven; no background scheduler is introduced. The unrelated complete-seed failure remains Draft [DEV0249](DEV0249-repair-legacy-seed-location-compatibility.md), not a repaired or passing reset path. Existing local migration continuity remains separately owned by DEV0232.

Concurrent DEV0248 session-title/mail-filter edits were preserved; this ticket does not own those changes. All validation reports describe the combined workspace where relevant, with group-specific ownership and evidence above.

2026-10-15 commit preparation: the user requested committing DEV0237. The exact staged snapshot, excluding the independent DEV0248 mailbox/title changes, passed `npm test` (151 application/model/render plus 16 server tests, 167 total), `npm run lint`, `npm run typecheck` and `npm run format:check`; logs are `/tmp/dev0237-commit-{tests,lint,types,format}.log`. Its document check passed 250 relative links/anchors and 155 unique indexed/statused records. DEV0248 remains reserved in the index and its runtime, migration, ticket and specification amendments remain unstaged. Earlier combined-workspace database/build evidence above remains applicable to the unchanged DEV0237 source.

## Completion and review references

- Completed: 2026-10-15 — all DEV0237 acceptance criteria passed.
- Commit: Included in the implementation commit `[DEV0237] Persist group sessions and registration`, requested by the user after completion.
- Review: Acceptance-criteria self-review completed; no independent review.
- Deployment or release: None; existing shared local/hosted databases unchanged by this ticket.
