# Ticket DEV0245: Integrate messages with scheduling and connections

- Status: Completed
- Created: 2026-10-15
- Last updated: 2026-10-15
- Milestone: M8 private messages
- Coordination: [COR0022 — Private messaging and booking context](../organisatory/COR0022-private-messaging-and-booking-context.md)
- Related records: authority dependency [DEV0244](DEV0244-persist-private-message-authority.md); interface consumer [DEV0246](../frontend/DEV0246-add-private-mailbox-and-coach-contact.md); proof consumer [DEV0247](DEV0247-rehearse-private-messaging-loop.md); completed request baseline [DEV0188](DEV0188-persist-multi-candidate-booking-requests.md); connection baseline [DEV0221](DEV0221-persist-coach-athlete-connections.md)

## Objective and context

Integrate [M8 messaging](../../../docs/mvp-spec.md#165-authority-and-transaction-boundaries) with existing authoritative scheduling/connection mutations. A successful request must have its unique inbox card, and blocking/removal must affect every relevant write atomically rather than relying on a refreshed screen.

## Scope and non-goals

- In scope: request/card atomicity and canonical transition activities, accepted-booking links, safe historical bootstrap, connection general-consent grant/revocation, exposed block/unblock transactions, blocked request/accept/connection guards and exact booking-window exceptions.
- Out of scope: core message storage/ordinary text APIs owned by DEV0244, browser UI owned by DEV0246, group registration, session-note implementation, destructive migration repair and hosted deployment.

## Expected behavior and edge cases

Request save/retry either commits/recovers both the original request and one card or returns failure with neither new record. Each later request is separate within the same conversation. Acceptance/decline/withdrawal/expiry/closure/cancellation/completion expose actual persisted state with deduplicated activities and no other-candidate leakage. Old records bootstrap original identities/timestamps without fictional messages or newly unread history.

Connection acceptance grants general messaging; removal revokes its grant and earlier general consent without deleting history or cutting off independent service communication. Block removes current connections/terminalizes pending consent, prevents new requests and acceptance, and captures only exact upcoming/active confirmed bookings for the fixed end-plus-14-days exception. Cancellation revokes that booking's exception immediately; another captured booking is independent. Replaying block/unblock or reversing teaching roles cannot bypass an active block or extend a window. Existing scheduling capacity/time guards remain authoritative.

## Assumptions, decisions, and dependencies

- Start after DEV0244 primitives/projections and lock order are validated. Review current request/booking/connection SQL plus relevant installed framework/SDK docs before edits.
- This slice owns the exposed cross-product block transaction; DEV0244 supplies internal permission primitives. Maintain deterministic occurrence/pair/booking lock order and prove it with races.
- Existing candidate counts remain uncapped. Text anti-abuse limits never reject an otherwise legitimate system request card.

## Implementation plan

1. Use additive row triggers on requests, bookings and connection attempts. Acquire the canonical mail pair guard with `pg_try_advisory_xact_lock` after existing source locks: contention returns a retryable conflict and rolls back, avoiding a lock inversion. Preserve existing function bodies and grants; add no global lock. Context source IDs are verified by privileged helpers without foreign-key locks into scheduling rows. An earlier proposal to dynamically rewrite entry points/add a global guard was rejected by automatic approval review and abandoned before execution.
2. Retry only the exact database `40001` pair-contention failure up to three times around the whole actor transaction, revalidating actor authority. Unknown outcomes and ordinary product conflicts are never retried. This keeps concurrent independent requests working while retaining non-waiting source guards. Regression tests exposed this need and a missing owner membership-read policy; correct both before completion.
3. Map existing mutations and history reads to DEV0244 stable interfaces; update this plan before a material boundary change.
4. Add additive integration functions/grants and transaction-safe request/card/status persistence plus historical bootstrap.
5. Integrate accepted/removed connections and exposed block/unblock with scheduling guards, original booking snapshots and database-time windows.
6. Update typed results/services without weakening existing scheduling/media authority; keep UI ownership in DEV0246.
7. Prove rollback/idempotency and concurrent request/accept/remove/block/cancel/send outcomes, then run regression checks and record exact evidence.

## Acceptance criteria

- [x] AC1: Saved/retried requests and accepted bookings have exactly their original conversation/card references with atomic rollback and no duplicate acceptance thread.
- [x] AC2: Lifecycle projection/bootstrap is authoritative, paginated and candidate-private, preserving original IDs and neutral terminal statuses without invented unread messages.
- [x] AC3: Connection acceptance/removal and block/unblock obey section 16 consent rules atomically across teaching directions and all protected mutations.
- [x] AC4: Exact end-plus-14-days/cancellation/replay/multiple-booking exceptions and concurrent races are enforced with database time; scheduling capacity rules still pass.
- [x] AC5: Safe upgrade/fresh database, relevant regression/unit/server/integration, lint/type/format/build checks pass and document actual contracts/operations.

## Validation plan

Use isolated local upgrade/fresh datasets and real runtime-role queries. Run affected `npm run db:test`, `npm run db:lint`, `npm run test:db`, targeted unit/server tests and existing request/connection regressions; run `npm run lint`, `npm run typecheck`, `npm run format:check` and `npm run build`. Force integration failure after request creation inside the transaction and confirm no orphan success; race block with request/accept/send/removal and cancel with exception send at exact instants. Real receiving-browser evidence remains DEV0247.

## Implementation record

### Changes and rationale

New requests and their original-ID inbox cards now commit together. Acceptance updates that same context with its original booking; later canonical request/booking transitions append unique status activities. Bootstrap retains original IDs/timestamps without fabricated text or unread history. Removing a connection revokes earlier general consent while keeping service context/history. Blocking applies across both teaching directions, terminalizes connection/message attempts, guards new requests/acceptance and captures only confirmed bookings whose scheduled end is future.

### Affected files

- [Integration migration](../../../supabase/migration-history/20261016000100/20261015000200_integrate_private_messages.sql): additive request/booking/connection triggers, source events, block/unblock and history bootstrap. Existing scheduling function bodies/signatures/grants stay intact.
- [Hardening migration](../../../supabase/migration-history/20261016000100/20261015000300_harden_private_message_integration.sql) supplies owner-trigger membership reads; [final hardening](../../../supabase/migration-history/20261016000100/20261015000400_reserve_message_consent_submissions.sql) makes the internal flag helper's JSON cast explicit for SQL lint.
- [Actor transaction](../../../src/server/db/authorization/repository.ts): at most three retries of the exact aborted `40001` message-pair-contention error, with actor validation on every new transaction. Booking [request](../../../src/server/db/coaches/booking-request-repository.ts), [booking](../../../src/server/db/coaches/booking-repository.ts) and [connection](../../../src/server/db/connections/repository.ts) repositories preserve safe conflict results and causes.
- Existing [booking](../../../tests/database/coach-bookings.test.ts) and [connection](../../../tests/database/coach-athlete-connections.test.ts) tests, plus the [local fixture helper](../../../scripts/lib/local-connection-rehearsal.ts), remove message/block rows only for their exact disposable profiles.

### Decisions and deviations

The first proposal dynamically rewrote many entry points and added a global lock. Automatic approval review rejected that test before execution. It was abandoned. The delivered migration adds no global guard or rewrites of existing scheduling functions.

Source triggers already hold source rows, so they acquire the canonical account-pair advisory guard with `pg_try_advisory_xact_lock`; contention aborts rather than waiting in an inverted lock order. The actor transaction retries only that known rolled-back failure. Unknown outcomes, ordinary product conflicts and unrelated errors are never retried. Request lifecycle states are one-way, so original source ID plus terminal status is its stable activity revision. Trigger helpers restore the caller's management flags.

Regression testing exposed a missing owner membership-read policy during platform-driven closure and spurious conflicts between independent simultaneous requests; both were fixed before completion.

### Contracts, configuration, and operations

Consumes DEV0244's private authority; no new environment setting or change to booking IDs, capacity, deadlines or source interfaces. Block captures an immutable scheduled-end-plus-336-hours bound. Replay does not resnapshot; each active block must allow the exact booking, cancellation revokes its exception and completion never extends it. Neither block nor removal silently cancels sessions. Original local scheduling records passed the upgrade fingerprint check.

## Validation results

- `node --import tsx --test tests/*.test.ts`: 146 passed; `node --import tsx --conditions=react-server --test tests/server/*.test.ts`: 15 passed.
- `DATABASE_TEST_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres node --import tsx --conditions=react-server --test --test-concurrency=1 tests/database/*.test.ts`: 76 passed. The mailbox parent and 16 subtests contribute 17 checks; all fixtures roll back or use exact test-owned cleanup.
- `npm run db:test`: 11 files / 206 pgTAP checks passed. `npm run db:lint`: no schema errors or warnings after the explicit JSON cast.
- `npm run lint`, `npm run typecheck`, `npm run format:check` and `npm run build`: passed in the final standard-command run. `npx next build --webpack` also passed. The first sandboxed Turbopack process stalled and was stopped; the normal build succeeded outside that restriction.

Database evidence includes request/card replay, another candidate's isolation, original accepted booking identity, forced message-card failure rolling back the original request and sequence changes, connection general-consent revocation, crossed/stale/declined consent, multiple blocks, cancellation, ended-booking exclusion, replay, suspension and exact +1-microsecond/equality expiry checks. Existing simultaneous acceptance/cancellation/connection regressions still pass; more than five candidates can request one occurrence.

DEV0247 also ran real independent database connections for duplicate inquiry and block/send races. Final standard unit/server, lint/type/format/build and source review passed on 2026-10-15. Local link/status/membership checks also passed.

`python3 work/validate-dev0247-delivery.py` passed: 14 documentation files, 378 local links/anchors, 11 statuses/index paths, reciprocal flat work maps and reserved IDs. `git diff --check` passed. This local documentation checker is an ignored working artifact; the ticket records its checks/results rather than claiming it is a shipped application command.

## Risks, limitations, and follow-ups

At sustained contention an operation may return a safe retryable conflict after its bounded retries. Owner/operator commands encountering contention must retry the complete command. Profile hiding/public browsing remains governed by the existing public contract; block does not hide public coach pages. Hosted migration/rehearsal remains separate. Notes/plans are COR0015.

## Completion and review references

- Completed: 2026-10-15 — AC1–AC5 passed; implementation, validation and source review complete.
- Commit: Included in the user-authorized DEV0243–DEV0247 delivery commit; see Git history for its hash.
- Review: Self-review, upgrade/fresh tests and existing-product regressions; no independent review.
- Deployment or release: Local database enabled; no hosted release claimed.
