# Ticket DEV0278: Allow unlimited coach messages

- Status: Completed
- Created: 2026-10-17
- Last updated: 2026-10-17
- Milestone: M8 messaging refinement
- Coordination: None — independent development ticket
- Related records: [DEV0276 normal conversations](../../archive/backend/DEV0276-unify-established-coach-conversations.md) is the delivered dependency and historical baseline; [COR0022](../../archive/organisatory/COR0022-private-messaging-and-booking-context.md) records original mailbox delivery.

## Objective and context

The user confirmed unlimited messages for now, without separate coach approval, after reviewing Everfit first contact. DEV0276 already lets authenticated athlete contact establish a normal conversation and both participants reply without a booking, connection or message acceptance. Older database defaults still restrict sends to 20 per minute in a conversation, 100 per minute across conversations and first contact with 10 new counterparts per day. Remove those quotas from current messaging and record the confirmed decision in the [M8 contract](../../../docs/mvp-spec.md#16-private-messages-and-session-notes).

## Scope and non-goals

- In scope: unlimited eligible first-contact and ongoing messages; one additive private-helper migration; retained-data/authority/retry regressions; specification, database guidance and ticket index.
- Out of scope: arbitrary coach-to-athlete discovery, new account/relationship access, changes to blocking or suspension, message editing/resending, notifications, attachments, deleting legacy consent history, hosted rollout or unrelated workspace edits.

## Expected behavior and edge cases

An authenticated athlete may contact an eligible visible coach, then either participant may continue ordinary chat without message approval, a single-inquiry allowance, a follow-up cooldown or a send-count quota. Optional session association remains available. Normal chat is independent of legacy pending/declined consent attempts. Existing authentication, exact pair/dataset scope, body-size bounds, blocking, suspension and booking exceptions still apply. Exact retries recover one original message; changed retries fail. Legacy consent decisions and their existing retry rules remain compatibility behavior and do not gate established chat. Pagination is a response bound, not a total-history limit.

## Assumptions, decisions, and dependencies

- Confirmed 2026-10-17: allow unlimited messages for now; no additional chat approval. This supersedes earlier adopted numeric send/first-contact quotas.
- Adopted implementation: retain the private `app.mail_rate` signature as a compatibility no-op, so existing validated entry points retain their authorization and transaction boundaries. Do not rewrite the baseline or archived migrations/tickets.
- DEV0276's normal-conversation migration precedes this migration. The local database already has DEV0276; inspect its exact ledger before applying only this forward migration. Hosted installation remains separate.
- Review: one small backend slice owns this policy, helper and regression change; no coordination split is needed. No unresolved product question blocks implementation.

## Implementation plan

1. Update confirmed decision/acceptance examples and message bounds, retaining historical decisions as dated history.
2. Add a forward migration that removes message-count/new-counterpart quotas without changing stored data, helper privileges or send authorization.
3. Prove old-to-new quota removal, both-participant ordinary replies without consent, more than 10 new contacts and more than 100 sends; retain block/privacy/retry/body validation coverage.
4. Run focused database/unit/server, lint/type/format and immutable-baseline checks. Apply only the reviewed migration and its ledger entry atomically to loopback after verifying preserved table fingerprints and function metadata.
5. Record results, local/hosted boundaries and self-review; archive only after all criteria pass. No interface edit is planned, so no new layout/browser rehearsal is required.

## Acceptance criteria

- [x] AC1: Eligible first contact and ongoing chat have no approval step, send quota or ordinary follow-up cooldown; more than 20 conversation sends, 100 actor sends and 10 new contacts succeed.
- [x] AC2: Exact retries, original history, read/consent records, helper privileges, body bounds and existing block/account/pair/dataset permissions are preserved.
- [x] AC3: Forward migration and focused checks pass; specification/index/guidance distinguish confirmed behavior, legacy compatibility and local versus hosted rollout.

## Validation plan

Extend the existing rollback-only database suite with an old-helper upgrade comparison and sends across the former boundaries, including both participants with no accepted consent. Keep existing negative authority/block/suspension/source/read tests and domain payload validation. Run `npm test`, focused ESLint/Prettier, `npm run typecheck`, `node scripts/database-baseline.mjs verify` and `git diff --check`. Use only transaction-local fictional accounts; send no messages to existing users. Before local installation compare every app table, Auth users and Storage objects/buckets plus private helper metadata, then verify the exact ledger. No framework/runtime interface edit or new build dependency is planned; a production build and browser layout repetition are unnecessary for this SQL-policy refinement.

## Implementation record

Implemented and installed on the isolated local database. Hosted environments remain unchanged; no commit was created.

### Changes and rationale

The previous private quota helper rejected eligible text after 20 sends per actor/conversation per minute, 100 actor sends across the dataset per minute or contact with 10 new counterparts per day. The forward migration replaces only that helper with a compatibility no-op. The existing send/contact entry points still perform authorization, block/context/body checks and exact-retry handling before appending text. DEV0276 already supplies normal chat without additional approval; no interface rewrite was needed.

Database regressions restore the frozen old helper inside a rollback-only transaction, demonstrate the old rejection, apply the new helper and compare the complete visible thread and function privileges. Both participants then send 25 ordinary messages each, with exact retries saved once and changed retries rejected. Eleven additional coach contacts accept first messages, coach replies and athlete follow-ups without any message consent; total athlete sends exceed 100 within one minute. A separate assertion proves a declined legacy request does not stop either participant's ordinary replies or silently change the declined record.

### Affected files

| File                                                                                          | Change and purpose                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Forward migration](../../../supabase/migrations/20261017000200_unlimited_coach_messages.sql) | Removes message-count/new-counterpart quotas while retaining the private helper signature and privileges.                                                                                                                                                                                            |
| [Database tests](../../../tests/database/private-messages.test.ts)                            | Applies the new migration in the test transaction and verifies upgrade preservation, both actors beyond former quotas, no-approval first contact/replies and legacy-decline independence. Existing authorization, body bounds, block/suspension, paging/read and scheduling atomicity checks remain. |
| [Specification](../../../docs/mvp-spec.md#16-private-messages-and-session-notes)              | Records unlimited messaging as the confirmed choice, supersedes earlier numeric defaults and distinguishes retained legacy consent compatibility and Everfit evidence.                                                                                                                               |
| [Database guide](../../../supabase/README.md#unlimited-coach-messages-dev0278)                | Records ordering, local installation, preserved data, pending hosted rollout and forward-correction rollback.                                                                                                                                                                                        |
| [Ticket index](../../README.md)                                                               | Allocates this independent ticket and records its final archive location.                                                                                                                                                                                                                            |

### Decisions and deviations

2026-10-17: Implemented the user's explicit unlimited-volume decision by removing both ongoing-send and new-counterpart quotas. Kept authentication/body bounds and existing access rules because unlimited volume grants no additional participants or content access. Kept the private helper signature to avoid replacing the large public command function or disturbing transaction guards. The legacy consent-request decline delay remains compatibility behavior, independently verified not to restrict normal chat. No deviations from the scoped plan.

### Contracts, configuration, and operations

Migration `20261017000200` has SHA-256 `84fb066f19368f55fefaab848dceb2bfbcee3b1c230f07b0a1eccf138de80f3e`. The local ledger advanced atomically from `20261016000100`, `20261016000200`, `20261016000300`, `20261017000100` to those exact four versions plus `20261017000200`. Before/after fingerprints matched for all 39 application tables, Auth users and Storage objects/buckets (42 tables total). Function owner, ACL (access-control list), security mode and search path were identical. No new columns, environment variables, dependencies, payloads or account access grants.

Install after DEV0276 before claiming unlimited messaging on an environment. Hosted dev/production were not migrated or deployed. Rollback requires a reviewed forward correction restoring the quota helper, without deleting messages. The frozen baseline and original archived migrations remain unchanged.

## Validation results

- Date/environment: 2026-10-17, Node.js 24.21.0, isolated loopback PostgreSQL on port 55322. No populated environment file or secret was read or printed.
- Passed before and after installation: `DATABASE_TEST_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres node --import tsx --conditions=react-server --test --test-concurrency=1 tests/database/private-messages.test.ts` — 20 checks each time, zero failures; fictional account/message fixtures roll back. Covers old quota rejection, preserved-data/helper-metadata upgrade, 25 unscoped sends per participant, exact/changed retries, 11 new contacts with immediate normal replies and at least 101 athlete sends within a minute. Existing tests cover body bounds, participant/dataset isolation, forged/raw/helper denial, block/suspension exceptions, read/paging and booking-card atomicity. Legacy declined consent stays declined while ordinary replies succeed.
- Passed: `npm test` — 206 application plus 20 server tests, zero failures. Includes Unicode/body/envelope validation and existing server authorization/input checks.
- Passed: `node_modules/.bin/eslint tests/database/private-messages.test.ts`, `npm run typecheck`, focused Prettier and `git diff --check`. `node scripts/database-baseline.mjs verify` verified all 53 original migration checksums and the generated baseline checksum unchanged.
- Passed: exact-ledger local migration installation using a one-off owner connection restricted to `127.0.0.1:55322`, in one repeatable-read transaction. Compared all 42 table fingerprints and private function metadata before/after, then inserted the exact SQL into the migration ledger. Post-commit verification matched the five expected versions. No reset, seed, existing-user message or hosted operation was performed.
- Passed: final documentary self-review, eight local ticket links, all acceptance records, current unlimited-volume contract and next-ID allocation; archive/status/index/reference consistency checked after moving the completed record. No unrelated edits were staged or committed.
- Not run: production build or additional browser layout rehearsal, because this follow-up changes only a private SQL quota helper, tests and documentation; the no-approval composer was already validated under DEV0276. No new framework/dependency/interface code was changed. Hosted rollout and independent review remain separate.

| Criterion | Evidence                                                                                                                                   | Result |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| AC1       | Both-participant ordinary replies, 25 sends each, 11 new contacts and 101+ actor sends without consent                                     | Passed |
| AC2       | Old-to-new thread/privilege comparison; exact/changed retry, legacy-decline, body/access/block/read tests; 42 local table fingerprints     | Passed |
| AC3       | 226 application/server tests, 20 database checks before/after installation, lint/type/baseline/format checks and atomic local installation | Passed |

### 2026-10-17 commit verification

`npm test` passed all 211 application and 24 server cases. `node scripts/database-baseline.mjs verify` confirmed all 53 immutable originals and generated baseline unchanged. Previously recorded checks and explicit validation limits remain applicable; no implementation or SQL changed during commit preparation. The integrated acceptance matrix was aligned with the already-delivered approval-free mailbox under DEV0279. The seven fixes share shell/mailbox/specification/test hunks and are committed together with every owning DEV ID. Independent note, invitation, calendar and authentication-planning edits are excluded. This commit does not complete missing UI evidence or deploy hosted migrations.

## Risks, limitations, and follow-ups

Unlimited volume is an explicit current product decision. Any future quota/cooldown needs a separately scoped ticket and contract change. Hosted rollout is separate and must apply both messaging forward migrations before publishing the simplified composer. Existing unrelated navigation, invitations, notes and calendar-performance work remain separately owned. No local acceptance work remains.

## Completion and review references

- Completed: 2026-10-17 — local migration, all acceptance checks and durable review record passed.
- Commit: `[DEV0275][DEV0276][DEV0278][DEV0279][DEV0280][DEV0281][DEV0282] Refine workspace navigation and messaging` — user-authorized local commit on 2026-10-17.
- Review: Self-review confirms only quota policy/tests/current documentation changed; independent review not performed.
- Deployment or release: Local migration installed; hosted rollout/deployment not performed.
