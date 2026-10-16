# Ticket DEV0244: Persist private-message authority

- Status: Completed
- Created: 2026-10-15
- Last updated: 2026-10-15
- Milestone: M8 private messages
- Coordination: [COR0022 — Private messaging and booking context](../organisatory/COR0022-private-messaging-and-booking-context.md)
- Related records: upstream contract [DEV0243](../organisatory/DEV0243-define-ongoing-messages-and-session-note-boundaries.md); integration consumer [DEV0245](DEV0245-integrate-messages-with-scheduling-and-connections.md); interface consumer [DEV0246](../frontend/DEV0246-add-private-mailbox-and-coach-contact.md); proof consumer [DEV0247](DEV0247-rehearse-private-messaging-loop.md); local environment [DEV0232](../../current/organisatory/DEV0232-restore-local-migration-continuity.md)

## Objective and context

Establish server/database authority for the [adopted messaging contract](../../../docs/mvp-spec.md#16-private-messages-and-session-notes). Current scheduling and connections have no private inbox data model. This slice owns messages, consent and context permissions; existing scheduling/connection mutations are integrated by DEV0245.

## Scope and non-goals

- In scope: additive conversation/inquiry/message/read-position/general-consent/block records; actor/dataset constraints; context send policy, rate limits, stable paging/idempotency, bounded name/initial projections; internal block/scheduling-context primitives; typed repository/service/action boundaries.
- Out of scope: changing existing request/booking/connection mutations, exposed cross-product block transaction, history backfill, browser routes/navigation, session-note storage, group messaging, attachments, reporting operations and hosted deployment.

## Expected behavior and edge cases

A signed-in athlete can save an inquiry to a currently visible eligible coach, who can reply without a booking/connection. One directed pair conversation retains original contexts. General messages use current accepted connection or exact recipient-approved message consent. Crossed requests never auto-accept; stale attempt IDs cannot decide a replacement. Read markers are owner-bound and cannot consume a racing unseen entry. User text is bounded/rate-limited in PostgreSQL; retries recover one exact immutable body. Self, unrelated, cross-dataset, blocked and invalid-context writes fail closed without private-note/media leakage.

Internal primitives expose the section 16 block/booking policy and deterministic pair/context lock contract for DEV0245. They are not a substitute for its atomic existing-product integration. An initial migration creates no fabricated text/unread history.

## Assumptions, decisions, and dependencies

- DEV0243 supplies the adopted rules and labelled numeric/default choices. Inspect installed database/Drizzle and relevant bundled Next.js documentation before integration code.
- Follow existing actor transaction and privilege patterns; raw tables are not browser-accessible. Reuse existing directed coach/athlete and dataset identity.
- Audit actual migration ledger continuity before applying additive migrations. DEV0232 is environment context, not authority for a reset or blind repair; record a specific blocker if no safe environment is available.
- No product decision remains open for this slice. Any material departure updates this plan/spec before implementation.

## Implementation plan

1. Inspect database functions/grants, installed versions, actual ledger and existing actor-scoped repository patterns.
2. Add normalized conversation, context, entry, read-position, consent-attempt, block and captured-booking tables in the private app schema. Restrict raw access and expose actor-verified database functions. Use canonical account-pair advisory guards, actor text-rate guards, per-conversation sequence numbers and exact submission/revision identities. Keep original request/booking references; no automatic retention/deletion or one-year closure is adopted. Document integration hooks consumed by DEV0245.
3. Implement actor-scoped inquiry/text/consent/read queries and mutations, bounds/rate limits, safe projections and typed recoverable server results.
4. Add meaningful fresh/upgrade migration, privilege, consent/block/context, paging/idempotency/concurrency and read-race coverage.
5. Run affected checks, review against section 16 and record limitations; do not claim integrated request/block behavior before DEV0245.

## Acceptance criteria

- [x] AC1: Additive migrations preserve existing records and enforce one scoped directed conversation with stable inquiry/message/consent identities.
- [x] AC2: Exact participant/context/recipient/read authority, crossed/stale consent decisions, private-data isolation and section 16 bounds/rates are enforced in PostgreSQL.
- [x] AC3: Concurrent/retried sends and read marking recover one truthful outcome without duplicate text, overwritten drafts or unseen-entry consumption.
- [x] AC4: Bounded deterministic repository/service/action projections and internal pair/block/context interfaces support DEV0245/DEV0246 without raw/private-note exposure.
- [x] AC5: Fresh/upgrade migration, database privilege/race, relevant unit/integration, lint/type/format/build validation passes and is recorded.

## Validation plan

Run safe fresh/upgrade paths in an isolated local dataset; do not reset the user's rehearsal data. Use `npm run db:test`, `npm run db:lint`, targeted database integration through `npm run test:db`, focused unit/server tests, `npm run lint`, `npm run typecheck`, `npm run format:check` and `npm run build` as applicable. Record exact commands/results and prerequisites. Exercise limits at boundary instants, duplicate/altered submission IDs, two-recipient isolation, stale consent and overlapping read/send/block decisions. Browser flows remain DEV0246/DEV0247.

## Implementation record

### Changes and rationale

Implemented server-managed, append-only PostgreSQL text storage with no five-year purge or one-year closure. Conversations retain one dataset/coach/athlete identity; inquiries have a saved context, general chat has explicit connection/consent authority, and read markers are actor-owned. Actor/dataset/pair checks, sequence paging, immutable submission recovery, Unicode bounds and rate limits run in PostgreSQL. Only the actor-verified command function is callable by runtime; raw tables/internal helpers remain inaccessible.

### Affected files

- [Authority migration](../../../supabase/migration-history/20261016000100/20261015000100_private_message_authority.sql): conversations, contexts, entries, reads, consent attempts and block snapshots; restrictive row-level security, pair/rate guards and bounded command projections.
- [Owner/Unicode hardening](../../../supabase/migration-history/20261016000100/20261015000300_harden_private_message_integration.sql): explicit owner-only membership reads and nonblank Unicode checks. [Consent reservation](../../../supabase/migration-history/20261016000100/20261015000400_reserve_message_consent_submissions.sql): prevents an ordinary service send from consuming an opening-consent submission ID before acceptance.
- [Message domain](../../../src/domain/private-messages.ts): command/body limits and allowlisted data-transfer objects. [Repository](../../../src/server/db/messages/repository.ts) and [service](../../../src/server/messages/service.ts): verified actor transactions, bounded conflict/rate results and no raw database errors/body logging.
- [Database checks](../../../tests/database/private-messages.test.ts) and [domain checks](../../../tests/private-messages.test.ts): permission, recovery, Unicode, rate and projection evidence.

### Decisions and deviations

Original request/booking IDs are checked by privileged helpers rather than foreign keys that would acquire scheduling-row locks while holding a message-pair lock. Source records remain authoritative. SQL functions are the canonical schema contract; this JSON-command repository does not introduce unused Drizzle table mappings. Accepted consent opening text reserves its submission identity and counts against limits immediately, even while pending.

User-confirmed storage is application-readable under restricted server/database authority, not end-to-end encrypted. No retention duration is inferred from Airbnb; account lifecycle remains DEV0165.

### Contracts, configuration, and operations

Additive migrations `20261015000100`–`20261015000400`, applied locally with exact ledger entries. No new provider or product environment variable. Before upgrade, the local ledger had 46 repository versions and three known branch-only versions; those three were preserved. The first two migrations verified every existing request/booking/connection row was identical before/after, bootstrapping two conversations and three historical cards with zero new unread work. Later migrations add only mailbox policies/constraints/guards.

For a fresh installation, all repository migrations through `003` ran in order against an empty disposable app schema with empty Auth/Storage infrastructure; the normal fictional seed succeeded. The final `004` migration and all 17 mailbox checks then passed in a rolled-back transaction on that fresh installation. The same checks passed on the upgraded local database. No destructive reset or blind ledger repair was used on the application database.

Rollback requires stopping dependent mailbox callers and an owner-reviewed reverse migration; do not drop retained message history as an application rollback. Hosted application remains separate.

## Validation results

- `node --import tsx --test tests/*.test.ts`: 146 passed; `node --import tsx --conditions=react-server --test tests/server/*.test.ts`: 15 passed.
- `DATABASE_TEST_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres node --import tsx --conditions=react-server --test --test-concurrency=1 tests/database/*.test.ts`: 76 passed. The mailbox parent and 16 subtests contribute 17 checks; all fixtures roll back or use exact test-owned cleanup.
- `npm run db:test`: 11 files / 206 pgTAP checks passed. `npm run db:lint`: no schema errors or warnings after the explicit JSON cast.
- `npm run lint`, `npm run typecheck`, `npm run format:check` and `npm run build`: passed in the final standard-command run. `npx next build --webpack` also passed. The first sandboxed Turbopack process stalled and was stopped; the normal build succeeded outside that restriction.

The mailbox checks cover pre-request contact, participant/other-candidate/other-dataset isolation, forbidden raw/helper access, forged actors, exact/altered retries, reserved consent identities, explicit/crossed/stale consent, removal, read/send ordering, 4,000-code-point bounds, 20-per-conversation/100-per-actor limits, 10 new contacts, and paging beyond 50. Exact expiry equality denies while one microsecond before it permits the captured booking. No private email/avatar/note fields enter the allowlisted projections.

AC1–AC5 passed, supported by these checks and the integrated DEV0247 rehearsal. Final standard unit/server, lint/type/format/build and source review passed on 2026-10-15. Local link/status/membership checks also passed.

`python3 work/validate-dev0247-delivery.py` passed: 14 documentation files, 378 local links/anchors, 11 statuses/index paths, reciprocal flat work maps and reserved IDs. `git diff --check` passed. This local documentation checker is an ignored working artifact; the ticket records its checks/results rather than claiming it is a shipped application command.

## Risks, limitations, and follow-ups

Hosted deployment, end-to-end encryption, attachments, notifications, support/reporting operations and account-retention policy are not delivered. DEV0245 owns existing-product integration; DEV0246 owns browser behavior. Notes remain COR0015.

## Completion and review references

- Completed: 2026-10-15 — AC1–AC5 passed; implementation, validation and source review complete.
- Commit: Included in the user-authorized DEV0243–DEV0247 delivery commit; see Git history for its hash.
- Review: Implementation self-review and executable local checks; no independent review.
- Deployment or release: Applied and validated locally; not hosted deployment.
