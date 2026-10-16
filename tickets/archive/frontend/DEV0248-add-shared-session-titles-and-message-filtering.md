# Ticket DEV0248: Add shared session titles and message filtering

- Status: Completed
- Created: 2026-10-15
- Last updated: 2026-10-16
- Milestone: M8 private messages refinement
- Coordination: None — independent development ticket
- Related records: completed mailbox [DEV0246](../../archive/frontend/DEV0246-add-private-mailbox-and-coach-contact.md), authority [DEV0244](../../archive/backend/DEV0244-persist-private-message-authority.md), integration [DEV0245](../../archive/backend/DEV0245-integrate-messages-with-scheduling-and-connections.md); independent notes [COR0015](../../current/organisatory/COR0015-session-notes-and-training-plans.md)

## Objective and context

The mailbox labels outgoing messages with a session but cannot display only that session's history. Sessions also lack a recognizable name. Deliver one focused session-identification flow across Messages and existing booking cards, following [specification section 16](../../../docs/mvp-spec.md#16-private-messages-and-session-notes) and M8. The user approved date/time plus an optional shared title editable by either participant, and session-message filtering. Notes remain separate future work.

## Scope and non-goals

- In scope: optional private-booking title, participant-authorized optimistic edits, consistent title/date presentation, server-side complete-context message paging, session-card filter shortcut and clear filter/composer state.
- Out of scope: notes/plans implementation, group sessions, public title search, booking rescheduling, new conversations, notification delivery, automatic commits or hosted rollout.

## Expected behavior and edge cases

Every booked session displays its actual scheduled date/time and optional shared title; untitled bookings use “Training session”. Either exact participant may edit the same title through booking cards and mailbox Details. Empty input clears it. Existing bookings need no backfill. Proposed implementation defaults: trim a single-line plain-text title of at most 100 Unicode code points / 400 UTF-8 bytes; explicit Save/Cancel; revision checks prevent lost edits; cancelled bookings are read-only. Edits are shared communication and respect current coach/account and block-window restrictions, independently of connection/general-message consent. Never expose a title to another candidate or public listing.

Messages starts with All messages. Selecting a dated session/request or using its card's shortcut loads only its matching entries from the server, including older pages and the original accepted-request context. Session scope remains visible above the composer; switching cannot silently reassign a typed or uncertain-send draft. Return to All messages preserves the conversation. Filtered reads must not mark hidden unrelated entries read. Context choices retain loaded historical contexts, reachable through All messages paging; no new unlimited session-list response is introduced.

## Assumptions, decisions, and dependencies

Confirmed: separate notes, optional shared session title/date, either participant edits, consistent presentation and session filtering. The title bounds, revision conflicts, cancellation read-only behavior and conservative filtered read handling are implementation defaults, not additional user decisions. Existing mailbox/booking authority is delivered. DEV0237 group work is active independently; use an additive migration and preserve its files. Scope review: this is one reviewable session-identification vertical slice; no separate implementation work package is required.

## Implementation plan

1. Amend the product specification with the title/filter contract and notes boundary.
2. Add private-booking metadata with restricted reads/writes, optimistic revisions and canonical mailbox context projection; add filtered thread paging through existing authorized APIs.
3. Extend bounded domain contracts and booking projections. Reuse one title editor on athlete/coach booking cards and mailbox Details.
4. Add All/session filtering, session-card shortcuts, clear composer context and filter-safe freshness/read behavior.
5. Prove authorization, title races/bounds, accepted-request identity, complete filtered paging and unread isolation in database/domain tests; rehearse both roles at desktop/mobile with keyboard and unavailable/conflict recovery.

## Acceptance criteria

- [x] AC1: Both participants see the same optional title and actual date/time in mailbox cards/filter/Details and their booking cards; clear restores the fallback.
- [x] AC2: Both may save authorized titles; unrelated/dataset/raw writes, invalid text, stale revisions and blocked/cancelled writes fail without losing the draft or altering scheduling.
- [x] AC3: All/session filter and card shortcut return only matching history, including more than 50 entries, accepted-request messages and truthful older/newer paging.
- [x] AC4: Filter changes/polling preserve drafts and exact retry contexts, ignore stale responses and never acknowledge hidden unrelated entries.
- [x] AC5: Focused tests, database migration/lint, lint/type/build and two-role responsive/keyboard/error checks pass; notes remain separate and unfinished group work is preserved.

## Validation plan

Use rolled-back local database fixtures for title privacy, bounds, revision conflict, status/block restrictions and filtered history/paging/read isolation. Extend meaningful domain tests for command/DTO bounds. Use tagged local Auth fixtures and Playwright against the actual app for both participants, 375px mobile and 1440px desktop, keyboard edit/filter controls, failure/conflict draft recovery and scheduling invariance. Run relevant existing scheduling/message regressions, lint, typecheck, formatting and build. Apply only the new migration locally without resetting data; hosted operations are outside scope.

2026-10-15 validation adjustment: independent DEV0237 files were created/changed during this work. After the initial full checks, their incomplete database/format/type checks require scoped regression and diagnostic results. Validate all DEV0248 code plus existing application tests, report every wider failure separately and preserve the group files. Do not make mailbox completion depend on implementing DEV0237.

## Implementation record

### Changes and rationale

2026-10-15: The mailbox now offers All messages plus dated session/request choices and a card shortcut. Filtering is performed before the database's 50-entry page limit; it includes the original request and any context for its exact accepted booking. Explicit older/newer flags describe matching pages rather than gaps in global sequence numbers. Polling and queued refreshes carry the current filter and reject earlier revisions. Changing scope is refused while a typed or uncertain-send draft exists; a filtered composer stays attached to that scope.

An additive private metadata table stores one title/revision per original booking. Either exact participant saves through current actor/booking authority, pair locking and an expected revision. Matching retries recover the saved value; stale different edits fail. Existing block-window and coach eligibility checks apply. Cancelled bookings are read-only. Title edits change neither booking lifecycle nor message entries. One editor is reused by mailbox Details and both booking views; cards and filter labels use the same canonical title/date. Empty titles use Training session.

Filtered views deliberately do not advance the conversation-wide read position, preserving unread unrelated entries. All messages retains ordinary read acknowledgement. Older session choices remain reachable through historical All messages pages. Notes/plans remain unfinished COR0015 work.

### Affected files

| File/component                                                                                                                                                                                                    | Change and purpose                                                                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Migration](../../../supabase/migrations/20261015000600_session_titles_and_message_filter.sql)                                                                                                                    | Restricted title metadata, participant read/edit authority, optimistic revisions and complete filtered thread pages; retains original dispatcher for unchanged actions. |
| [Title domain](../../../src/domain/session-titles.ts), [message domain](../../../src/domain/private-messages.ts), [booking domain](../../../src/domain/coach-bookings.ts)                                         | Optional plain-text title bounds, shared title details, validated edit/filter commands and whitelisted page/context projections.                                        |
| [Booking repository](../../../src/server/db/coaches/booking-repository.ts), [message API](../../../src/app/api/messages/route.ts)                                                                                 | Read title/edit authority through the participant-only function and forward validated context filters.                                                                  |
| [Mailbox](../../../src/features/messages/mailbox.tsx), [styles](../../../src/features/messages/messages.css)                                                                                                      | Session filtering, matching page navigation, visible send scope, filter-safe drafts/refreshes/read state and responsive controls.                                       |
| [Shared editor](../../../src/features/messages/session-title-editor.tsx), [athlete cards](../../../src/features/profile/client-sessions.tsx), [coach cards](../../../src/features/coaches/coach-client-cards.tsx) | Explicit shared Save/Cancel, clear/fallback, conflict/failure draft recovery and consistent booking presentation.                                                       |
| [Database tests](../../../tests/database/private-messages.test.ts), [domain tests](../../../tests/private-messages.test.ts)                                                                                       | Title authorization/bounds/revisions/block status; actual pre-acceptance history, 64 matching entries across pages, dataset denial and unread isolation.                |
| [Booking tests](../../../tests/coach-bookings.test.ts), [connection fixtures](../../../tests/coach-connections.test.ts)                                                                                           | Extend existing booking fixtures/projection contract with shared title fields.                                                                                          |
| [Browser rehearsal](../../../scripts/rehearse-local-session-titles.ts), [fixture helper](../../../scripts/lib/local-connection-rehearsal.ts)                                                                      | DEV0248-only local accounts and exact cleanup; two-role title/filter, lost acknowledgement and responsive/error checks.                                                 |
| [Specification](../../../docs/mvp-spec.md#166-interface-and-session-note-boundary), [index](../../README.md)                                                                                                      | Adopted behavior/defaults, independent notes boundary and lifecycle evidence.                                                                                           |

### Decisions and deviations

Installed Next.js is 16.3.8; bundled route-handler documentation was read before API changes. Numeric title bounds, cancellation read-only and conservative filtered read handling remain labelled defaults. No notes, notification, public search or group behavior was added.

The new migration was initially applied locally as 20261015000500 before concurrent DEV0237 created that same number. Before committing either change, moved only this new file and its exact local ledger row to unused 20261015000600. The independent group migration and existing historical versions/data were preserved.

An expanded dataset test exposed that its historical fixed “other” run could equal the enrollment dataset. Replaced it with a fresh rolled-back private dataset; that context is denied by the application authorization boundary, including title edits. Initial empty-schema validation needed provider-role-free application schema restore, btree_gist and original app_owner schema privileges. These were disposable fixture setup corrections; no provider schema or live role changes were made.

### Contracts, configuration, and operations

Migration 20261015000600 adds private_session_titles and helper/read functions, extends canonical context projections, and wraps the unchanged legacy dispatcher for title/thread actions. Booking/context DTOs add title, titleRevision and canEditTitle; thread DTOs add hasOlder/hasNewer. GET accepts optional contextId; POST session-title accepts bookingId/title/expectedRevision through existing authorization and same-origin/no-store APIs. Apply the migration before new consumers. No dependency/environment additions; local migration is applied without resetting data. Hosted migration is not performed.

Rollback requires reverting consumers, restoring the former dispatcher/context projection and removing the new helper/table. Preserve or export titles before a deliberate table removal; original bookings, requests and message identities are untouched. The title table is forced-RLS and has no raw runtime grants.

## Validation results

2026-10-15, Node 24.21.0, local Supabase PostgreSQL/Auth and the existing restricted app on localhost:3100:

- `npm test`: 147 unit and 15 server tests passed.
- `DATABASE_TEST_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres node --import tsx --conditions=react-server --test --test-concurrency=1 tests/database/*.test.ts`: 78 passed before independent group tests were added. After the final pre-acceptance/dataset fixture additions, the same command restricted to `tests/database/private-messages.test.ts` passed 19/19.
- `node --import tsx --conditions=react-server scripts/rehearse-local-session-titles.ts`: all six final phases passed. Two authenticated browsers exercised coach save/athlete refresh, athlete save versus stale coach draft, clear/fallback, a forced 503, matching history/card shortcut, draft scope protection, a lost send acknowledgement with exactly one saved message in the original context, hidden unrelated incoming work, soft-read failure/recovery, All return, both original booking surfaces and mobile title/filter keyboard use. No page errors; no horizontal overflow at 375px. Desktop was 1440px. Loaded screenshots under ignored `test-results/session-titles-rehearsal/{desktop,mobile}.png` were visually inspected.
- `npm run lint`, `npm run typecheck`, `npm run build`: passed after runtime implementation. Final targeted ESLint on all 15 affected TypeScript files passed after rehearsal additions.
- Final full `npm run typecheck` later reported only active DEV0237 group files. `node work/validate-dev0248-types.mjs` passed application/scripts/existing and mailbox test diagnostics, explicitly separating diagnostics from the seven independent group source/test files; last run had three independent diagnostics. This ignored checker uses the unchanged tsconfig and TypeScript compiler API and fails any diagnostic outside that explicit set. No DEV0248 type error remains.
- `npm run format:check`: later reported only six independently edited group files. `node node_modules/prettier/bin/prettier.cjs --check src/domain/session-titles.ts src/domain/coach-bookings.ts src/domain/private-messages.ts src/app/api/messages/route.ts src/features/messages/mailbox.tsx src/features/messages/messages.css src/features/messages/session-title-editor.tsx src/features/coaches/coach-client-cards.tsx src/features/profile/client-sessions.tsx src/server/db/coaches/booking-repository.ts scripts/lib/local-connection-rehearsal.ts scripts/rehearse-local-session-titles.ts tests/coach-bookings.test.ts tests/coach-connections.test.ts tests/private-messages.test.ts tests/database/private-messages.test.ts`: passed. The two final fixture/harness additions were formatted afterward.
- `npm run db:lint`: no schema errors or warnings.
- `npm run db:test`: its new independent group-session test failed because that table was not yet migrated. Re-running `node_modules/.bin/supabase test db --local` with the sorted existing `supabase/tests/database/*.test.sql` paths excluding `group-sessions.test.sql` passed 11 files / 206 checks. Group implementation is outside this ticket.
- `node work/validate-dev0248-schema.mjs`: the exact migration applied successfully on an empty-data copy of the pre-change application schema, with minimal empty Auth and existing required extensions; forced RLS verified. No application data was copied. The disposable database was removed. This ignored local checker is supporting evidence, not a shipped application command or a claim of full fresh Supabase deployment.
- Final read-only cleanup audit: zero DEV0248 tagged users, zero disposable schema databases, one applied 00600 migration, and the original three requests / one private booking retained.

| Criterion | Evidence                                                                                                                                           | Result                                                  |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| AC1       | Both-role browser edits, title clear, canonical context and both booking card reads                                                                | Passed                                                  |
| AC2       | Database authority/bounds/stale/block/cancel tests; browser stale/503 draft recovery                                                               | Passed                                                  |
| AC3       | 64 matching entries, original pre-acceptance text, page reversal, card shortcut and All return                                                     | Passed                                                  |
| AC4       | Filtered read-through unchanged, unrelated incoming remains unread, draft scope refusal and exactly-once lost-reply retry; revision guard reviewed | Passed                                                  |
| AC5       | Source static/build checks, scoped regressions, migration/lint and inspected responsive two-role rehearsal                                         | Passed, independent group check failures recorded above |

Aggregate preview `test:e2e` and hosted rehearsal were not run; the targeted actual Auth-backed browser rehearsal owns these flows. No new note runtime exists. After archive movement, a Python consistency check passed 227 local Markdown links/anchors across this ticket, the specification and index, plus unique DEV0248 identity, Completed status/index path, all checked criteria and next-ID allocation. `git diff --check` passed. Independent group files remain outside this change.

## Risks, limitations, and follow-ups

Notes/plans remain COR0015. A session title is shared, not coach-private. Filter choices cover contexts loaded from current/historical pages; pagination remains bounded. A filtered view keeps the conversation unread until its broader history is viewed through All messages. Full repository checks currently also include active independent DEV0237 changes; their failures are not hidden or repaired under this ticket. No deployment or independent review is claimed.

2026-10-16 commit handoff: reviewed the combined DEV0248/DEV0250 scope; later full lint, typecheck, formatting and production-build checks passed as recorded by DEV0250. Independent DEV0238 planning edits are excluded from this delivery commit.

## Completion and review references

- Completed: 2026-10-15 — AC1–AC5 delivered and locally validated; independent group-work check failures explicitly scoped above.
- Commit: User-authorized delivery commit on 2026-10-16, `[DEV0248][DEV0250] Add session labels, filters and athlete details`; see Git history for its hash. The combined subject includes both IDs because the changes share the booking projection and interface files.
- Review: Self-review against all acceptance criteria; no independent review.
- Deployment or release: Local implementation/validation only.
