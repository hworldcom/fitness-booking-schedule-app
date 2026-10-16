# Ticket DEV0221: Persist coach–athlete connections

- Status: Completed
- Created: 2026-10-14
- Last updated: 2026-10-14
- Milestone: M6 — Athlete terminology and coach–athlete connections
- Coordination: [COR0020 — Athlete terminology and coach–athlete connections](../organisatory/COR0020-athlete-terminology-and-connections.md)
- Related records: independent validation dependency [DEV0231](DEV0231-correct-pgtap-runtime-assumptions.md); local migration/startup follow-up [DEV0232](../../current/organisatory/DEV0232-restore-local-migration-continuity.md); contract dependency [DEV0219 — Adopt athlete terminology and connection contract](../organisatory/DEV0219-adopt-athlete-connections-contract.md); coach consumer [DEV0222](../frontend/DEV0222-add-coach-my-athletes.md); athlete consumer [DEV0223](../frontend/DEV0223-add-athlete-my-coaches.md); account-retention follow-up [DEV0165](../../current/backend/DEV0165-implement-account-deletion-lifecycle.md)

## Objective and context

Add server-authoritative mutual connection requests and accepted relationships for existing coach/athlete pairs, including explicit connection-scoped private athlete-media access. Implement against the [current specification](../../../docs/mvp-spec.md#49-connect-after-a-confirmed-session); the implementation and validation record below describes the delivered backend.

## Scope and non-goals

- In scope: additive persistence, one active relationship per coach/athlete pair, bounded participant projections, send/accept/decline/withdraw/remove actions, qualifying-booking checks, concurrency/retry authority, connection-scoped avatar delivery, complete paginated shared request/booking-history references across reconnection and database/service tests.
- Out of scope: interface implementation, public athlete directory, goals/bio fields, chat, notifications, session-note persistence, account deletion and legacy schema removal.

## Expected behavior and edge cases

- Send and accept derive the actor and recheck one shared confirmed/completed booking; pending requests and cancelled-only history fail. New actions require approved/demo coach authority; existing removal/decline/withdraw/read actions remain bounded after suspension.
- Only the recipient accepts/declines and only the sender withdraws. Either accepted participant disconnects. Repeating the same operation returns its authoritative result; stale old requests cannot accept a newer relationship. Disconnecting never cascades into deleting/resetting shared requests, bookings or conversation content.
- Crossed pending requests return the existing pending state and require explicit recipient acceptance; sending does not silently accept.
- Cancellation racing with acceptance is serialized so the qualifying-booking check and relationship write reflect one authoritative outcome. Existing accepted relationships survive later cancellation/completion.
- Accepted projections show bounded participant presentation and a complete paginated catalogue of shared request/booking references for the exact pair, including pending/accepted/declined/withdrawn/expired/not-selected requests and confirmed/completed/cancelled bookings. The coach receives only the athlete name and a bounded opaque avatar URL. Removal revokes connection-derived media/history access; independent booking/request permissions remain intact.
- A fresh eligible request and explicit acceptance restore that catalogue using original request/booking identifiers and statuses, across repeated disconnect/reconnect cycles. Link an accepted request to its resulting booking without duplicating the continuing conversation. Pagination exposes all retained history; a display page limit cannot silently discard older records.
- COR0015 owns shared conversation/plan/note persistence and rendering. This ticket provides stable authorised history references and never copies or resets content on reconnection; conversation-body recovery is verified jointly after COR0015 delivery. Coach-private content never enters the shared catalogue.
- Self, cross-dataset, unrelated-account and malformed operations fail without mutation; ordinary athletes never receive private coach notes or unrelated sessions.

## Assumptions, decisions, and dependencies

- DEV0219 supplies the contract; inspect existing session verification, actor-scoped repositories, scheduling locks and media routes before design.
- Proposed defaults (not additional user decisions): terminal request attempts, explicit crossed-request acceptance and one active pair identity with request-attempt history.
- The adopted implementation contract below defines schema, action results, pagination and retry/resend semantics before schema edits. No new dependency is required.

### Adopted implementation design (2026-10-14)

- Persistence: additive `coach_athlete_connection_pairs` identifies one `(run_id, coach_profile_id, athlete_profile_id)` forever; `coach_athlete_connection_attempts` retains monotonically numbered pending/accepted/declined/withdrawn/removed attempts. Unique pair identity and a partial unique pending/accepted index enforce one active relationship. Foreign keys restrict deletion of referenced participants; disconnection changes only an attempt, never request/booking/content records. Raw tables enable/force row-level security and expose no runtime or Data API table privileges.
- Send input: an independently authorised direct booking ID, caller-generated canonical UUID operation/attempt ID, and expected previous attempt ID (null for an unseen pair). The server derives the exact pair/sender/recipient. Exact created-operation retries recover that original attempt, even after it becomes terminal. Concurrent/crossed sends recover the existing active attempt without acceptance. A terminal pair needs a fresh operation ID and matching previous-attempt ID; stale sends cannot silently reconnect it.
- Actions: recipient accept/decline, sender withdraw and either-participant disconnect address the exact attempt UUID. Identical decisions recover their authoritative status; contradictory or stale terminal transitions conflict. New send/accept require approved/demo coach authority and a shared confirmed/completed direct booking. Existing reads/decline/withdraw/disconnect remain available after suspension. A pending request has no automatic expiry; a fresh eligible resend may occur immediately after a terminal outcome, with no lifetime quota or implicit/background resend. Bounds are one active pair and explicit operation/previous-attempt identity.
- Lock order: a transaction-scoped advisory lock for the exact dataset/directed pair serialises connection mutations. New-send/accept authority locks the approved application before the coach profile, then one qualifying booking with `FOR SHARE`; booking cancellation's existing `FOR UPDATE` therefore serialises qualification without rewriting scheduling functions. Acceptance that commits first may survive later cancellation; cancellation that commits first cannot supply eligibility. Real ordered race tests must prove both outcomes. See [PostgreSQL 17 row-lock documentation](https://www.postgresql.org/docs/17/explicit-locking.html#LOCKING-ROWS).
- Projections: actor-derived coach/athlete roles, separate incoming/outgoing/accepted/terminal sections, current eligibility/action flags and bounded counterpart name/public-coach presentation. Accepted coach rows supply only opaque attempt-scoped athlete-avatar URLs. Pagination defaults to 20, permits 1–50 and fetches one extra row for a `(created_at,id)` cursor. Shared history is independently keyed by stable request/booking IDs, includes every retained exact-pair request and direct booking, and represents an accepted request/resulting booking once; all older pages remain traversable. Conversation bodies and coach-private notes are excluded.
- Service/action contract: ready/saved data, invalid input, current-state conflict, preview, signed-out, forbidden and unavailable results contain bounded messages; no database or Storage details are serialised. Server Actions validate untrusted inputs and revalidate existing `/coach` and `/sessions` surfaces without adding interface controls.
- Media: authenticated `/api/connections/[connectionId]/athlete-avatar` checks that exact attempt is accepted and the current actor is its coach; a narrow Storage policy grants current-object access for accepted pairs. Successful/error responses use `private, no-store` and `Vary: Cookie`. Recheck the attempt/reference after download so a disconnect or image replacement during provider work cannot return stale connection-derived bytes. Independent request/booking avatar routes retain their permissions.
- Migration/recovery: validate fresh replay and additive upgrade in isolated local databases before applying the additive migration to the existing local stack without reset. Forward recovery disables the new entry points if necessary and preserves pair/attempt history; no destructive rollback or new environment setting is introduced. Full shared-conversation recovery remains dependent on COR0015 runtime.

## Implementation plan

1. Review installed database/Next.js integration versions and documentation; define pair identity, status/attempt versions, grants and lock order shared with booking cancellation.
2. Add forward-safe migrations and exact actor-checked functions for eligibility, requests, acceptance and removal.
3. Add server/domain services, bounded list/history projections and authenticated connection-scoped normalized-avatar delivery with revocable caching. Define cursor-complete request/booking-history references independent of connection-attempt identity; preserve selected-request/booking continuity and terminal status. Conversation persistence/rendering remains COR0015.
4. Add authority, fresh/upgrade migration, concurrency, media and unavailable-provider validation; document forward recovery.

## Acceptance criteria

- [x] AC1: Only either participant in a qualifying confirmed/completed pair can send; only the recipient can accept; sending and acceptance both enforce booking and coach eligibility.
- [x] AC2: Database uniqueness and concurrent/crossed/replayed decisions never create duplicate relationships, implicit consent or stale-request acceptance; cancellation races are authoritative.
- [x] AC3: Accepted relationship/history data is limited to the exact participants and athlete avatar bytes are accepted-coach-scoped; removal immediately revokes connection-derived access while independent permissions survive. Pending/terminal consent lists return only each exact participant's bounded attempt identity/status, counterpart presentation and permitted action flags, with no connection-derived athlete bytes or shared-history access.
- [x] AC4: Decline, withdrawal, either-participant disconnection, accepted-connection survival, empty/unavailable state and pagination behave deterministically without altering scheduling. Fresh accepted reconnection restores all retained shared request/booking references, including unsuccessful/cancelled history and older pages, with original identifiers/statuses, no deletion/reset and no duplicate accepted-request thread.
- [x] AC5: Fresh/upgrade migration, database authorization/concurrency, media/service tests, existing regressions, lint, type-check and build pass with recorded evidence.

## Validation plan

Create multi-page exact-pair history spanning unsuccessful request states and cancelled/completed/confirmed bookings; disconnect from each side and mutually reconnect more than once. Compare retained IDs/statuses and complete cursor traversal, check fresh eligibility after cancelled-only history, selected-request/booking de-duplication, stale attempt denial and unrelated/private-data exclusion. COR0015 owns conversation bytes and author/status permissions; combined conversation recovery is a later integration check rather than fabricated evidence here.

Use pgTAP/runtime-role and service tests for unrelated actors, role states, pending-only/cancelled-only/confirmed/completed bookings, dataset boundaries, self requests, duplicate/crossed sends, stale attempts, retries and acceptance/cancellation/removal races. Test connection-scoped image bytes before acceptance, during acceptance and after removal, including an independently authorized booking route and Storage failure. Validate fresh replay and additive upgrade on disposable local databases; never reset hosted data. Run `npm test`, `npm run test:db`, `npm run db:test`, `npm run db:lint`, lint, type-check, formatting, build and diff checks.

## Implementation record

Implementation started 2026-10-14 after committing the DEV0230 contract amendment as `09033f5`. Reviewed installed Next.js 16.3.8 server-action/route-handler guides, Postgres.js 3.4.9 transaction documentation, PostgreSQL 17 locking documentation and the existing actor, booking, application and avatar boundaries. Schema/action/locking design above is recorded before runtime edits.

### Changes and rationale

Added durable directed pair identity and retained numbered consent attempts. Verified participants can send after a qualifying session, explicitly accept/decline/withdraw, and either participant can disconnect. Operation UUIDs and previous-attempt comparison make exact retries recover the original attempt while stale/crossed sends cannot grant consent or silently reconnect. Application/coach/qualifying-booking locks enforce current authority and serialise cancellation against acceptance without changing scheduling functions.

Actor-scoped incoming/outgoing/accepted/terminal pages return bounded presentation/action flags. Accepted pairs can traverse every retained shared request/direct-booking reference, including unsuccessful, occurrence-closed, expired and cancelled history. Accepted request/booking links produce one history entry; reconnecting reuses original IDs. Cursor creation timestamps preserve PostgreSQL microseconds, preventing tied entries from being skipped.

The authenticated athlete-avatar route adds accepted-coach access and checks the same attempt/reference again after downloading. Removal and stale URLs stop returning connection-derived bytes while independent request/confirmed-booking media permissions remain intact. No interface control or conversation-body persistence was added.

### Affected files

| File or component                                                                                                                                        | Change and purpose                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Migration](../../../supabase/migration-history/20261016000100/20261014000100_create_coach_athlete_connections.sql)                                      | Pair/attempt tables, lifecycle/identity guards, active-pair uniqueness, RLS/grants, eligibility locks, bounded pages/history and narrow Storage permission.                                                     |
| [Domain contracts](../../../src/domain/coach-athlete-connections.ts)                                                                                     | Lifecycle, participant projections, cursor/page/history shapes and untrusted-input checks.                                                                                                                      |
| [Schema](../../../src/server/db/schema/connections.ts) and [schema index](../../../src/server/db/schema/index.ts)                                        | Server-only schema exports for the additive tables and indexes.                                                                                                                                                 |
| [Repository](../../../src/server/db/connections/repository.ts)                                                                                           | Parameterised actor-checked functions, bounded shape validation, conflict translation and precision-preserving cursors.                                                                                         |
| [Service](../../../src/server/connections/service.ts) and [Server Actions](../../../src/app/connections/actions.ts)                                      | Verified-actor reads/mutations, bounded invalid/conflict/unavailable results and revalidation of existing private surfaces.                                                                                     |
| [Avatar service](../../../src/server/connections/avatar.ts) and [route](../../../src/app/api/connections/[connectionId]/athlete-avatar/route.ts)         | Accepted-coach bytes, post-download revocation/reference check and private no-store responses.                                                                                                                  |
| [Database integration tests](../../../tests/database/coach-athlete-connections.test.ts)                                                                  | Both directions, retries/crossed decisions, real ordered lock races, complete tied-timestamp history, directed dual-coach pairs, suspension and media/independent-permission boundaries; exact fixture cleanup. |
| [Server tests](../../../tests/server/coach-athlete-connections.test.ts) and [pgTAP](../../../supabase/tests/database/coach-athlete-connections.test.sql) | Invalid entry points, provider/revocation failures, response privacy and database schema/permission invariants.                                                                                                 |

### Decisions and deviations

- 2026-10-14 final public-presentation review: the existing verified-actor boundary already requires an active public dataset and rejects private-dataset entry before projection. A rollback-only runtime check initially expected a private projection and failed at that boundary; correct the check to prove denial and restore the public result after rollback. The temporary redundant dataset lookup/policy was removed before delivery; no additional read grant is needed.

- 2026-10-14 presentation refinement: the public coach flag/portrait additionally uses the existing publishable-primary-location authority, so retained connection identity cannot imply an unavailable public profile/rebooking shortcut. Refine the uncommitted local projection function and its own new ledger statement only; preserve all user data and prior branch history.

- 2026-10-14 pagination refinement before correction: preserve PostgreSQL creation timestamp strings at full microsecond precision in returned rows/cursors. Reconstructing a cursor with JavaScript Date loses fractional precision and can skip retained entries sharing one database timestamp. Add a multi-page tied-timestamp history fixture and verify every retained ID across reconnection; frontend consumers must forward the provided cursor unchanged.

- 2026-10-14 acceptance wording clarification: minimal incoming/outgoing/terminal consent metadata must be readable by its exact participants before acceptance, as already required by the recorded projection design. Accepted-only history/private-media access remains separate; no permissions were expanded by this clarification.

- 2026-10-14 local migration application adjustment before proceeding: the existing local ledger includes already-applied branch-only versions `20261012000100`, `20261012000200` and `20261012000300`. `supabase migration up --local` stopped with `MigrationMissingLocalError` and made no change. Preserve those rows/schema and the user's existing data; apply only the tested DEV0221 SQL plus its new ledger entry in one guarded owner transaction. Capture hashes/counts of existing bookings, requests and profiles inside that transaction and reject any changed baseline. Fresh/upgrade replay remains independently verified in disposable databases. Normal CLI startup still requires separate branch-history reconciliation; no history repair/reset is performed here.
- 2026-10-14: Existing booking requests also have `occurrence-closed` terminal history. Include it in complete retained history rather than silently omitting that existing outcome. Migration tests add identity/terminal-state guards and prove original accepted request/booking links are preserved.

2026-10-14: [DEV0230](../organisatory/DEV0230-adopt-reconnection-history-recovery.md) records the user-confirmed full shared-history requirement. Reconnection recovers retained request/booking references independently of connection attempt; future conversations remain owned by COR0015 and keep original permissions.

### Contracts, configuration, and operations

Added the two connection tables and actor-checked functions described in the adopted design. The new private GET route and Server Actions use existing Auth/database/Storage settings; no dependency or environment variable changed. Display timestamps remain ISO strings; supplied creation timestamps/cursors preserve full database precision and must be forwarded unchanged. No existing scheduling API/data shape changed.

Fresh/upgrade migration replay passed in task-owned databases. The existing local stack received only DEV0221 SQL plus its own ledger entry in one baseline-checked transaction; its later projection refinement changed only that function/own uncommitted statement. Preserve tables/attempt history during forward recovery; revoke the new entry-point grants/disable new controls if rollback is needed, rather than deleting history. Hosted migration/deployment has not occurred. The existing branch-only CLI-history issue is tracked by DEV0232.

## Validation results

- Environment: 2026-10-14, Node.js 24.21.0, Next.js 16.3.8, Postgres.js 3.4.9, local PostgreSQL 17/Supabase Auth/Storage and localhost:3100. Read relevant installed framework/transaction documentation before edits.
- `node /tmp/movx-dev0221-migrations.mjs --rebuild`: final fresh and upgrade replay passed all 45 previous migrations plus DEV0221. Upgrade preserved the original confirmed booking/accepted-request IDs, status and link. Only task-created disposable databases were rebuilt. Early bootstrap attempts exposed missing default-privilege rights/empty availability; corrected the isolated bootstrap and added a valid pre-migration fixture, without resetting the app database.
- `node /tmp/movx-dev0221-apply-local.mjs`: applied only DEV0221 and its ledger entry; hashes/counts of existing bookings, requests and profiles and all three prior branch-only versions remained unchanged. `node /tmp/movx-dev0221-refresh-projection.mjs` refined only public presentation eligibility/its own statement.
- `DATABASE_TEST_URL=postgresql://postgres:postgres@127.0.0.1:55322/dev0221_upgrade node --import tsx --conditions=react-server --test tests/database/coach-athlete-connections.test.ts`: 12 passed, including 24 exactly tied microsecond timestamps traversed over multiple pages and repeated reconnection. Ordered races used real database lock waits: acceptance first survives later cancellation; cancellation first rejects acceptance. Early fixture failures (backdated time fields, already-suspended cleanup, raw Storage delete protection and cross-run error classification) were corrected; Storage checks are rollback-only and final exact cleanup passed.
- `npm run test:db`: final complete database suite: 59 passed, 0 failed, with fixture cleanup, including the added rollback-only private-dataset denial check. `npm test`: final run: 127 general tests plus 14 server tests passed (141 total), including the five new server/media tests and concurrent Home changes present at that check.
- `npm run db:test`: final complete pgTAP suite: 206 passed across 11 files. The initial nine failures in older assertions were corrected independently under DEV0231; they are not represented as initial passes.
- `npm run db:lint`: exited successfully; all 30 reported function findings were bundled pgTAP extension internals, with no app finding. `node_modules/.bin/supabase db lint --local --schema app`: final result: no schema errors, empty findings.
- `node --import tsx --conditions=react-server /tmp/movx-dev0221-media-rehearsal.mjs`: real local Auth-cookie/canonical image upload/download passed pending/guest/athlete/stranger denial, no-store/Cookie-vary headers, either-side disconnect/reconnect, old URL revocation, original booking history, completed-session connection-only bytes and independent confirmed-booking access. Three new synthetic accounts and their exact image/records were removed. Early temporary-driver runs failed because the app was stopped, cleanup used a SQL array builder incorrectly and a Vary check incorrectly disallowed Next's additional router tokens; corrected the driver and reran. Existing accounts/images were never mutated. No credential/code/private CLI status was printed or persisted.
- `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run build`: passed after final source changes. Initial type issues in byte Response/portrait typing and new fixture types were corrected before those passes.
- Cleanup: exact DEV0221 synthetic-account count was zero after the final suite. Dropped only the task-created `dev0221_fresh` and `dev0221_upgrade` databases; retained the existing local stack and user data. Final `curl` of `http://localhost:3100` returned HTTP 200; the existing guarded local server remains available. Normal dev:local startup still needs DEV0232.
- `python3 /tmp/movx-dev0221-check-docs.py --complete` and `git diff --check`: passed; archive links, index/statuses, unique IDs, reciprocal coordination ownership and consent/recovery/privacy boundaries were reviewed. UI/browser layout and hosted rehearsal are not applicable: no interface or hosted behavior was delivered; DEV0222/DEV0223 and COR0015 own those follow-ups.

| Criterion | Evidence                                                                                                                                                                                  | Result |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Both initiation directions, recipient-only consent, confirmed/completed eligibility, hidden/suspended handling and pending-only/cancelled-only/unrelated/spoofed/cross-run denial passed. | Passed |
| AC2       | Active-pair uniqueness, crossed/duplicate/replayed/stale decisions, immutable attempts and both real cancellation lock orderings passed.                                                  | Passed |
| AC3       | Accepted-coach reference/Storage/HTTP bytes, post-download revocation/provider failure, old URLs and retained independent routes passed.                                                  | Passed |
| AC4       | All retained statuses and exactly tied timestamps traversed every page; repeated either-side disconnect/reconnect retained original IDs and one accepted thread.                          | Passed |
| AC5       | Final fresh/upgrade, 59 database tests, 206 pgTAP checks, 141 app/server tests, app-schema lint and static/build checks passed; documentation/link/index/scope and diff checks passed.    | Passed |

## Risks, limitations, and follow-ups

Consent must not be inferred from a crossed request or button state. Media/cache revocation and lock ordering against booking cancellation require real database tests. Account deletion/retention remains DEV0165; no retention period is invented here. Required runtime and documentation/lifecycle checks passed. DEV0222/DEV0223 still own connection screens; COR0015 still owns conversation bodies/rendering and the combined recovery rehearsal. Normal dev:local startup remains blocked by the pre-existing missing branch versions under DEV0232; localhost was started using the existing guarded environment factory. No hosted deployment or independent review occurred.

## Completion and review references

- Completed: 2026-10-14.
- Commit: Included in `[DEV0221][DEV0231][DEV0232] Add coach-athlete connections and database follow-ups`; user authorised committing all pending work on 2026-10-14.
- Review: Self-review against all acceptance criteria, scoped source/SQL diff and contract boundaries passed; no independent review created.
- Deployment or release: Not deployed or released.
