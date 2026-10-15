# Ticket DEV0247: Rehearse the private-messaging loop

- Status: Completed
- Created: 2026-10-15
- Last updated: 2026-10-15
- Milestone: M8 private messages
- Coordination: [COR0022 — Private messaging and booking context](../organisatory/COR0022-private-messaging-and-booking-context.md)
- Related records: delivery dependencies [DEV0244](DEV0244-persist-private-message-authority.md), [DEV0245](DEV0245-integrate-messages-with-scheduling-and-connections.md), [DEV0246](../frontend/DEV0246-add-private-mailbox-and-coach-contact.md); separate later note consumer [COR0015](../../current/organisatory/COR0015-session-notes-and-training-plans.md); local environment [DEV0232](../../current/organisatory/DEV0232-restore-local-migration-continuity.md)

## Objective and context

Prove [M8's integrated contract](../../../docs/mvp-spec.md#167-delivery-and-verification) with real PostgreSQL authority and two already-open receiving browsers. Previous manual testing needed assistance to find requests; persistence/unit checks alone do not prove arrival, triage or correct context.

## Scope and non-goals

- In scope: repeatable isolated fixtures, integration/browser test evidence, request/card rollback and retry, consent/removal/block/window races, candidate/actor/dataset/privacy checks, paging/unread/freshness and mobile/desktop/keyboard/failure rehearsals.
- Out of scope: delivering another peer's runtime, modifying real user requests/connections for a test, hosted deployment, full session-note implementation or M7 group proof.

## Expected behavior and edge cases

An athlete can ask a question before requesting; the coach sees it without manual reload. A saved request enters that same ongoing conversation, one decision references its original booking, and another candidate sees no pair content. Connected/general-consent entry paths, crossed/stale attempts, removal with preserved service communication and fresh message consent behave separately. Block/unblock never invents booking cancellation, leaks note metadata, admits a new blocked request or extends an expired captured-booking window.

Exact recipient read positions cannot swallow racing messages. Failed/uncertain sends preserve drafts and recover one saved message. Invalid cursors/identifiers and database unavailability fail truthfully. Retained older history remains reachable. Session Details opens original bookings; note runtime is tested only when actually delivered, with a separately recorded COR0015 combined result.

## Assumptions, decisions, and dependencies

- Start after DEV0244–DEV0246 have actual local delivery. Inspect services/ledger and create a safe isolated dataset; DEV0232 may need to establish the environment first.
- No destructive reset/ledger repair or real account actions are authorized merely to complete rehearsal.
- Fix discovered runtime defects under their owning peer; update scope before unrelated additions.

## Implementation plan

1. Define deterministic clock/boundary fixtures plus real local coach, athlete, other candidate and unrelated/cross-dataset actors.
2. Add integration coverage for transaction rollback, idempotency, paging, context/consent/block authorization and concurrent race winners.
3. Exercise two already-open browsers for arrival, request triage, general consent, removal/block/unblock, read marking, drafts and focus restoration.
4. Rehearse mobile/desktop/keyboard, signed-out return composition, unavailable services and actor switching; record observed outcomes and omissions exactly.
5. Review all M8 acceptance scenarios and coordinate final status through COR0022 only after required evidence passes.

## Acceptance criteria

- [x] AC1: Real local pre-request inquiry → ongoing request card → original confirmed booking flow works in two open browsers without undocumented reloads.
- [x] AC2: Consent/removal/block/unblock/window/cancellation/retry/rollback/rate/read race scenarios produce one authoritative scoped outcome.
- [x] AC3: Other candidates, unrelated/cross-dataset actors, private note metadata and unauthorized media are absent from database/server/browser projections.
- [x] AC4: Older history, mobile/desktop/keyboard, hidden-tab/focus freshness, failure/draft recovery and actor switching are demonstrated with exact observations.
- [x] AC5: All applicable M8 scenario evidence and actual test/static/build results are recorded; no note/hosted/group implementation is falsely claimed.

## Validation plan

Run focused database/pgTAP and integration tests with safe fixtures, `npm test`, affected `npm run test:e2e`, relevant existing request/connection rehearsals, `npm run lint`, `npm run typecheck`, `npm run format:check` and `npm run build`. Include exact last-instant/boundary-instant messages at end-plus-14-days and concurrent cancel/block/send. Capture real receiving-page observations and serialized privacy checks, not only mocked component tests. Record every blocked/not-run prerequisite rather than marking completion.

## Implementation record

### Changes and rationale

Added a reproducible real two-account mailbox rehearsal and completed upgrade/fresh, privilege, rate, rollback and concurrency checks. This specifically proves that new work reaches an already-open receiving page without an undocumented reload. Failures found during validation were fixed under DEV0244–DEV0246 and rerun.

### Affected files

- [Rehearsal](../../../scripts/rehearse-local-private-messages.ts): real local Auth/browser/API/database flows and independent concurrent connections; logs phase labels, never bodies/cookies/keys.
- [Fixture helper](../../../scripts/lib/local-connection-rehearsal.ts): explicitly supports DEV0247 and removes only tagged local Auth/profile/message/booking/connection fixtures.
- [Package commands](../../../package.json) and [README checks](../../../README.md#checks): `npm run test:private-messages`, prerequisites, evidence location and `--cleanup` recovery.
- [Database suite](../../../tests/database/private-messages.test.ts): 15 focused subtests plus its parent, all rolled back; [domain suite](../../../tests/private-messages.test.ts): Unicode and DTO/privacy bounds.

### Decisions and deviations

The disposable database `movx_dev0247_messages` was removed after its checks passed. It used empty service schemas, complete repository migrations, fictional seed and rolled-back mailbox fixtures. The application database was never reset. Its three known branch-only migration versions remained intact. Upgrade source fingerprints were equal and historical bootstrap marked no old cards newly unread.

The early broad migration proposal was rejected by automatic review and removed before execution. Delivered code uses additive scoped triggers and narrow retries. An initial sandboxed build stalled; standard build outside that restriction and webpack build passed. Tests initially exposed the owner-read policy, source-lock retry and consent-submission reservation issues; their fixes are documented by the owning peers. A simulated clock/visibility test hit a test-harness error; the final visibility check uses normal elapsed time instead.

### Contracts, configuration, and operations

No new product requirements/provider/environment value. The rehearsal requires the existing Auth-enabled app on localhost:3100. It provisions fresh tagged `.test` identities and removes only those exact records in `finally`; `--cleanup` handles its own leftovers. Screenshots are ignored local evidence, not public/user profile assets. No message drafts or private CLI values are written to disk.

## Validation results

`node --import tsx --conditions=react-server scripts/rehearse-local-private-messages.ts` passed against the running local app. The documented `npm run test:private-messages` alias now invokes that exact command.

- `node --import tsx --test tests/*.test.ts`: 146 passed; `node --import tsx --conditions=react-server --test tests/server/*.test.ts`: 15 passed.
- `DATABASE_TEST_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres node --import tsx --conditions=react-server --test --test-concurrency=1 tests/database/*.test.ts`: 76 passed. The mailbox parent and 16 subtests contribute 17 checks; all fixtures roll back or use exact test-owned cleanup.
- `npm run db:test`: 11 files / 206 pgTAP checks passed. `npm run db:lint`: no schema errors or warnings after the explicit JSON cast.
- `npm run lint`, `npm run typecheck`, `npm run format:check` and `npm run build`: passed in the final standard-command run. `npx next build --webpack` also passed. The first sandboxed Turbopack process stalled and was stopped; the normal build succeeded outside that restriction.

Fresh and upgraded mailbox suites: 17/17 passed. Fresh migration infrastructure initially lacked Storage primary keys; adding those normal keys to the disposable service fixture allowed the complete migration/seed path to pass. This was test setup, not a change to the application database.

Browser evidence already passed inquiry/reply before requests, focus/30-second arrival, retained draft/focus, deliberately lost acknowledgement with exactly one saved message, explicit read failure/recovery, general-message acceptance, original request/booking cards, unrelated/Origin denial, mobile/desktop, block/unblock and real duplicate-inquiry/block-send concurrency. Final hidden-page/account-switch/mobile-coach checks and standard static/build review passed.

Database proof includes forced card failure rolling back the request; no candidate leakage; raw/helper/forged/dataset denial; exact and altered retries; pending submission reservation; crossed/stale/declined consent; removal retaining service context; future/ended/cancelled/multiple-block snapshots; +1µs and exact equality at the 336-hour boundary; replay and suspension; 50-entry pagination; 20/100 text and 10-new-contact limits; read/send race behavior. Existing scheduling/connection races remain green in the full suite.

Final read-only cleanup audit: 53 migration versions (50 repository plus all three preserved branch-only versions), zero tagged DEV0247 users, and the original three requests/one private booking/two conversations/three historical cards remain.

No hosted rehearsal, notes/plans runtime, group/runtime delivery or independent review is claimed. The aggregate preview `npm run test:e2e` was not run: this ticket uses the targeted real authenticated Playwright rehearsal rather than that separate preview server; existing affected scheduling/connection/database regressions passed.

`python3 work/validate-dev0247-delivery.py` passed: 14 documentation files, 378 local links/anchors, 11 statuses/index paths, reciprocal flat work maps and reserved IDs. `git diff --check` passed. This local documentation checker is an ignored working artifact; the ticket records its checks/results rather than claiming it is a shipped application command.

## Risks, limitations, and follow-ups

Hosted rollout and session notes remain separate records. Numeric/time boundaries are tested deterministically in SQL; real timing races return a valid serialized success or conflict. Browser hidden state is emulated through its visibility property/event while the application’s actual polling and server remain real. Account switching is demonstrated by replacing the browser context's cookies and navigating as the unrelated actor, alongside the actor-bound component/navigation checks.

## Completion and review references

- Completed: 2026-10-15 — AC1–AC5 passed; implementation, validation and source review complete.
- Commit: Included in the user-authorized DEV0243–DEV0247 delivery commit; see Git history for its hash.
- Review: Self-review and executable local checks; no independent review.
- Deployment or release: Local validation only; not hosted deployment.
