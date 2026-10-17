# Ticket DEV0280: Retire message-request approvals

- Status: Completed
- Created: 2026-10-17
- Last updated: 2026-10-17
- Milestone: M8 messaging refinement
- Coordination: None — independent development ticket
- Related records: [DEV0276 normal chat](../../archive/backend/DEV0276-unify-established-coach-conversations.md), [DEV0278 unlimited messaging](../../archive/backend/DEV0278-allow-unlimited-coach-messages.md) are dependencies; [DEV0279 dedicated window](../../current/frontend/DEV0279-open-dedicated-messaging-workspace.md) is an independently owned interface integration.

## Objective and context

The user confirmed that Message requests is unnecessary now that coach conversations do not require approval. Remove the remaining request tab, labels, approval controls and request-only composer fallback. Retire public request/decision commands and the pending-approval unread flag, preserving existing contact text and access protections under the [current M8 contract](../../../docs/mvp-spec.md#16-private-messages-and-session-notes).

## Scope and non-goals

- In scope: All/Unread inbox only; normal Send/retry only; passive display of previously visible pending contact text; public rejection of obsolete request commands/filter; a two-helper forward migration for legacy-pair normal chat and actual-entry unread state; focused API/domain/render/database and desktop/mobile validation; specification and operations evidence.
- Out of scope: deleting consent audit rows, rewriting old messages, automatic connection acceptance, wider athlete discovery, changes to blocks/suspension/session authority, notifications, quotas, unrelated workspace edits or hosted rollout.

## Expected behavior and edge cases

No Message requests tab, pending-request list badge, Accept/Decline/Withdraw messages action or request-only composer remains. The app accepts only All/Unread inbox filters and rejects public `request-consent`/`consent` commands before authorization/database work. Genuine booking-request cards and their separate coach decisions remain unchanged.

Existing pending opening text stays readable as passive Earlier contact in All messages, outside session-filtered history. It cannot keep a conversation permanently unread just because an approval is pending. Existing legacy contact pairs may continue normal chat without approval while the coach is enabled and the pair unblocked. Empty/unrelated pairs still gain no outreach. Original consent rows/statuses and message/read/context identities are retained; private database compatibility routines remain for history/upgrade checks, not as current app features.

## Assumptions, decisions, and dependencies

- Confirmed 2026-10-17: remove message-request approvals as redundant with normal messaging. This supersedes the earlier legacy request UI/compatibility choices in DEV0276/DEV0278.
- Adopted: preserve previously visible pending text without turning an old decision into acceptance or fabricating a timed message entry. Actual message entries alone drive unread. Retain the compatible projection fields while suppressing request authority and removing all app entry points.
- Use one backend-primary vertical slice because the API, helper and interface removals deliver one behavior. Inspect the local five-version ledger and apply only the reviewed forward migration after rollback-only verification. Preserve unrelated changes and archived records.

## Implementation plan

1. Update the current M8 decision/interface/compatibility contract before runtime edits.
2. Remove approval/filter commands from app validation and normal composer/list controls; preserve pending contact text as a read-only historical item and current message retry payloads.
3. Add a forward migration preserving data/privileges: an existing historical contact grants normal chat under existing outer checks, `canRequestGeneral` becomes false, and unread depends on actual incoming message entries.
4. Prove API rejection, historical-body presentation, empty/pair/block privacy, pending-request unread retirement and retained-data/helper privilege upgrade. Run relevant tests, lint/type/format and an isolated production build.
5. Install the local migration atomically after exact-ledger/fingerprint checks; verify desktop/mobile/keyboard and normal send draft/filter behavior without messaging existing users. Finish evidence/index/links and archive only after acceptance passes.

## Acceptance criteria

- [x] AC1: Only All/Unread and normal messaging remain; public obsolete approval/filter commands fail and booking-request actions remain distinct.
- [x] AC2: Legacy contact text/history/statuses remain, old pending approvals do not force unread or pause eligible chat, and blocks/suspension/empty/unrelated access and exact retries remain enforced.
- [x] AC3: Migration, API/domain/render/database and relevant application checks pass; desktop/mobile/keyboard review and local/hosted operations are accurately recorded.

## Validation plan

Extend existing rollback-only messaging database tests with a historical-contact-only pair and upgrade checks: old pending unread/chat behavior, preserved rows/read positions/privileges, new ordinary replies/read clearing and blocked/unrelated denials. Add meaningful public command validation and passive-history render tests, retaining existing body/DTO and application checks. Run `npm test`, focused lint/format/type, immutable-baseline verification and an isolated production build without populated environment files. Native desktop/mobile inspection verifies the request UI is gone while history, drafts, session cards and Back remain. No message to an existing user, reset/reseed, external communication or hosted operation is needed.

## Implementation record

Implemented and installed locally. Automated checks, preserved-data migration and desktop/375 px interface review passed. No commit or hosted operation was performed.

### Changes and rationale

The inbox now has only All and Unread. Removed the pending-request row suffix, approval banner/actions and request-only composer fallback. Normal sends and uncertain retries always use `send` with their original body/context/submission identity; blocking and explicit session association remain. A passive Earlier contact item preserves text previously displayed by a pending approval banner, only in All messages. Accepted openings already stored as text are not duplicated.

App validation rejects `request-consent`, `consent` and requests filtering before authorization/database access. The migration changes two private helpers: historical contact independently grants normal chat under the existing enabled-coach/unblocked checks, and only actual incoming message entries drive unread. The compatible `canRequestGeneral` field is false. No audit row or message was accepted, deleted, copied or rewritten.

### Affected files

- [Mailbox](../../../src/features/messages/mailbox.tsx): All/Unread, normal exact-send retry, no approval controls/badges/fallback; session booking cards remain.
- [Historical contact](../../../src/features/messages/historical-contact.tsx): escaped passive pending text, without approval actions or invented timestamps. [CSS](../../../src/features/messages/messages.css) drops obsolete approval-banner selectors.
- [Message domain](../../../src/domain/private-messages.ts): retires obsolete public commands/filter and response handling while retaining compatible history fields.
- [Forward migration](../../../supabase/migrations/20261017000300_retire_message_requests.sql): replaces permission/projection helpers while preserving privileges and data.
- [Domain/render tests](../../../tests/private-messages.test.ts), [server tests](../../../tests/server/private-message-actions.test.ts) and [database suite](../../../tests/database/private-messages.test.ts): public rejection, passive text/escaping, historical-only upgrade, retained rows/privileges, actual unread/count/read behavior and authority/retries.
- [Existing rehearsal](../../../scripts/rehearse-local-private-messages.ts): adds absence assertions for obsolete controls; statically checked, not executed through its browser automation.
- [Specification](../../../docs/mvp-spec.md#16-private-messages-and-session-notes), [database guide](../../../supabase/README.md#retired-message-approvals-dev0280) and [index](../../README.md): current contract, rollout/rollback and lifecycle. DEV0279 received a dated browser cleanup handoff without claiming its remaining checks complete.

### Decisions and deviations

2026-10-17: Retained audit tables, compatible fields and private database routines for historical integrity. Retired the feature at the app boundary and current projection/permission semantics. Historical contact never accepts a connection or bypasses blocks/suspension. The passive opening is not fabricated as a new timestamped/sequence-bearing message.

Native browser access recovered intermittently after DEV0279's failures. Observed this retirement at desktop and 375 px; responsive pointer/stepper controls remained unreliable. Disabled emulation and closed only the task-owned DevTools/test tab, discarding its final unsent draft. Physical phone software-keyboard behavior is not claimed. No scope deviation from this ticket's desktop/mobile checks.

### Contracts, configuration, and operations

Migration `20261017000300` has SHA-256 `e02de0b9bcfc59f313315497987a1031458536bb41466d1457d4d014a42753e2`. The exact local ledger advanced from `20261016000100`, `20261016000200`, `20261016000300`, `20261017000100`, `20261017000200` to those five versions plus this sixth version in one repeatable-read transaction with the exact SQL ledger entry. Before/after fingerprints matched for 39 app tables, Auth users and Storage objects/buckets (42 total). Both helpers retained owner, ACL (access-control list), security mode and search path.

Obsolete app commands/filter now return invalid. Ordinary payloads and compatible history fields remain; `canRequestGeneral` is false. No dependencies, environment variables, table shapes or account-access grants changed. Install after DEV0276/DEV0278 before publishing this UI/API. Hosted rollout is separate. Rollback requires compatible app behavior and a reviewed forward helper correction, without deleting history.

## Validation results

- Date/environment: 2026-10-17, Node.js 24.21.0, Next.js 16.3.8, isolated loopback PostgreSQL/Auth and native Chrome. No populated environment file or secret was read or printed.
- Passed: `npm test` — 211 application plus 21 server tests (232 total), zero failures. Includes public command/filter rejection, passive history/render escaping and existing body/DTO/privacy checks.
- Passed before and after installation: `DATABASE_TEST_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres node --import tsx --conditions=react-server --test --test-concurrency=1 tests/database/private-messages.test.ts` — 21 checks each time; all fictional fixtures rolled back. New regression restores old helpers, proves pending-only unread and denied chat, applies the migration twice and compares audit/history/read positions and helper privileges. Normal replies/retries succeed; incoming text becomes unread and clears after reading while pending audit stays unchanged. Unread count/filter excludes pending-only contact and All retains it. Suspension, block, outsider and empty-conversation denials remain. Existing scheduling-card atomicity, block windows, paging, privacy and unlimited-message checks pass.
- Passed: focused ESLint on changed domain/mailbox/history, domain/server/database tests and rehearsal; `npm run typecheck`; focused Prettier and `git diff --check`. `node scripts/database-baseline.mjs verify` verified 53 immutable migration checksums and the generated baseline unchanged.
- Passed: isolated production build using explicit Node 24 and `node_modules/next/dist/bin/next build --webpack` in `/var/folders/97/qxdkjfmj0_l4w87jnk_rsq6w0000gq/T/movx-dev0280-build-7cqx90vc`. Copied source/public/scripts/build configuration only, symlinked dependencies and explicitly emptied database/Auth/site/Geoapify settings. Compilation, TypeScript, 16 static pages and tracing passed; the running `.next` was untouched.
- Passed: owner installation on `127.0.0.1:55322`, guarded by the exact prior ledger and migration hash. Compared 42 table fingerprints and both helper metadata records before/after, then inserted exact SQL/version atomically. Post-commit ledger matched all six versions. No reset, reseed, existing-user message or hosted operation occurred.
- Native 375 × 829 px: All/Unread only, existing conversation and separate booking card, normal composition/session association and no visible horizontal overflow or approval controls. Native desktop: Unread empty state showed You’re all caught up; All restored the conversation. Keyboard Tab moved All → Unread → conversation, with Enter opening it. An unsent draft enabled normal Send; the session card/Details/Review original request stayed separate. No Send, block, connection or consent decision was invoked. Closing the task test tab discarded its draft; task DevTools was closed and original user tabs retained. Normal displayed-history read acknowledgments may advance.
- Not run: full legacy Playwright rehearsal or a new two-account browser send. This session uses native computer control, transaction-local DB sends and an unsent existing-conversation draft. Physical phone/430 px and other dedicated-window follow-ups remain DEV0279's separate scope. Hosted rollout and independent review were not performed.

| Criterion | Evidence                                                                                                                                              | Result |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Public command/filter rejection; desktop/mobile All/Unread, normal composer and booking-card review                                                   | Passed |
| AC2       | Passive text rendering, retained-data/helper upgrade, actual unread/count/read and retry/block/suspension/privacy tests                               | Passed |
| AC3       | 232 application/server tests, 21 DB checks before/after installation, lint/type/format/baseline/build, preserved-data local install and native review | Passed |

### 2026-10-17 commit verification

`npm test` passed all 211 application and 24 server cases. `node scripts/database-baseline.mjs verify` confirmed all 53 immutable originals and generated baseline unchanged. Previously recorded checks and explicit validation limits remain applicable; no implementation or SQL changed during commit preparation. The integrated acceptance matrix was aligned with the already-delivered approval-free mailbox under DEV0279. The seven fixes share shell/mailbox/specification/test hunks and are committed together with every owning DEV ID. Independent note, invitation, calendar and authentication-planning edits are excluded. This commit does not complete missing UI evidence or deploy hosted migrations.

## Risks, limitations, and follow-ups

Retained consent rows are historical compatibility data, not an active app approval feature. No local acceptance work remains for this retirement. DEV0279's remaining dedicated-window checks stay separately owned and incomplete. Hosted environments need all applicable messaging migrations before release. Unrelated navigation, invitations, notes and calendar edits were preserved and not staged or committed.

## Completion and review references

- Completed: 2026-10-17 — local implementation/migration, required validation and final contract/index/link review passed.
- Commit: `[DEV0275][DEV0276][DEV0278][DEV0279][DEV0280][DEV0281][DEV0282] Refine workspace navigation and messaging` — user-authorized local commit on 2026-10-17.
- Review: Self-review confirms no app approval/send fallback, separate booking-request actions and retained history/outer permissions. Independent review not performed.
- Deployment or release: Local migration installed and running source updated; no hosted rollout or commit.
