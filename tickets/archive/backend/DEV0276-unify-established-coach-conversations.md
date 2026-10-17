# Ticket DEV0276: Unify established coach conversations

- Status: Completed
- Created: 2026-10-17
- Last updated: 2026-10-17
- Milestone: M8 messaging refinement
- Coordination: None — independent development ticket
- Related records: [DEV0243](../../archive/organisatory/DEV0243-define-ongoing-messages-and-session-note-boundaries.md), [DEV0244](../../archive/backend/DEV0244-persist-private-message-authority.md), [DEV0246](../../archive/frontend/DEV0246-add-private-mailbox-and-coach-contact.md) and [DEV0247](../../archive/backend/DEV0247-rehearse-private-messaging-loop.md) are historical contract/runtime baselines; [current specification](../../../docs/mvp-spec.md#16-private-messages-and-session-notes) owns the amended behavior.

## Objective and context

The user can freely type in a coach inquiry but cannot select general messages in the same conversation. On 17 October 2026 they confirmed: “One normal chat”, removing the Inquiry/General choice while retaining optional session links and blocking. Deliver this one vertical fix across the existing permission helper and composer.

## Scope and non-goals

- In scope: allow ordinary conversation text once a genuine inquiry/request/booking has established that exact coach–athlete conversation; replace the Inquiry/General distinction with a normal composer and optional session association; retain historical contexts, exact retries, session filters and legacy recipient consent decisions; add a forward migration, specification amendment and focused authority/UI validation.
- Out of scope: arbitrary coach-to-athlete outreach, new connections/profile/media access, booking authority, group chat, attachments, notifications, session notes/types, hosted rollout, destructive resets and commits.

## Expected behavior and edge cases

After an athlete contacts an eligible visible coach, either participant can exchange ordinary messages in the same chat without a booking, connection or second message request. A saved private request/booking likewise establishes that conversation. Normal text has no session attachment; choosing an actual request/booking explicitly attaches it. Inquiry remains a stable historical contact record, not a selectable sending mode.

Existing accepted connections/consents still qualify independently. Merely creating an empty conversation, discovering an account, being an unrelated participant or crossing datasets grants nothing. Existing message-request eligibility and exact-recipient decisions remain for legacy/no-service cases; pending attempts are retained without automatic acceptance or deletion. A pending legacy request does not pause an independently open conversation. Connection removal preserves an established service conversation, consistent with the former inquiry-channel permission.

Either participant's block stops ordinary chat. Only the existing captured-booking exception permits explicitly session-attached communication; suspension retains its existing bounded booking-only exception. Terminal sessions do not erase established chat/history. Existing rate limits, actor checks, retry identities and read isolation remain authoritative. Draft or uncertain sends cannot silently switch session attachment; returning from a session filter to All messages returns composition to normal chat after the existing draft guard.

## Assumptions, decisions, and dependencies

- Confirmed: one normal chat without the Inquiry/General choice; optional session context and blocking remain.
- Adopted implementation default: an existing server-validated sendable service context opens ordinary unscoped text while the coach is enabled and the pair unblocked. This removes a redundant distinction in capabilities the pair already held. Keep the legacy `canSendGeneral` response field for compatibility; it now includes this ordinary conversation grant.
- Use one backend-primary development ticket because the small policy/composer changes and their validation deliver the same inseparable behavior. No coordination split is needed.
- Never edit the frozen migration baseline or archived implementation records. Inspect the local ledger and apply only this forward migration to the running loopback database after rollback-only verification. Preserve unrelated edits; hosted migration/deployment remains separate.

## Implementation plan

1. Amend the current messaging contract, decision/acceptance examples and composer semantics before runtime changes.
2. Add `20261017000100_normal_coach_conversations.sql`, replacing only the private conversation-permission helper while retaining owner/ACL and existing outer block/capability checks. Do not rewrite message/consent data.
3. Simplify the composer to normal chat plus optional real session association, remove inquiry/general labels, keep pending retry bodies/contexts stable, and guard draft context changes. Keep first contact explicit and unsent on navigation/sign-in.
4. Update focused domain/database coverage and existing rehearsal expectations affected by the adopted rule. Prove existing-conversation upgrade without changing history, both-participant sends, unauthorized/empty-conversation denial, retained consent decisions, disconnect/cancellation, blocks/suspension, retry/paging/session/read/privacy behavior.
5. Run appropriate unit/server/database, lint/type/format/build checks and desktop/mobile/keyboard inspection. Apply only the reviewed local forward migration after checking the exact ledger and preserved data; record hosted rollout separately. Review all acceptance criteria before archiving.

## Acceptance criteria

- [x] AC1: Established pre-booking coach contact supports ordinary messages and coach replies without extra consent or an Inquiry/General sending choice.
- [x] AC2: Optional session attachment/filtering, original history/cards, exact retries and draft protection remain correct; normal messages remain unscoped.
- [x] AC3: Empty/unrelated/cross-dataset/forged access fails; blocks, suspension, rate limits, privacy and legacy recipient decisions remain enforced.
- [x] AC4: Forward upgrade preserves original data/owner/ACL; focused automated checks and desktop/mobile/keyboard proof pass, with accurate local/hosted status.

## Validation plan

Use existing message domain/database tests plus an isolated rollback-only upgrade regression. Verify the old inquiry/general mismatch, apply the new function in the test transaction, send ordinary replies from both participants, and compare retained records and function privileges. Keep existing authority/retry/rate/read/block/session tests meaningful under the amendment. Run relevant unit/server tests, lint, type checking, formatting and build. Inspect the real local mailbox without sending messages to existing users; persisted test messages must belong only to transaction-local fictional test accounts. Check normal composition, optional session contexts, mobile/keyboard and paused/error presentation. Do not use browser automation outside the enabled computer-use tool. Record limitations rather than claiming an unrun legacy browser rehearsal passed.

## Implementation record

Delivered the normal-chat permission and composer refinement locally. The migration is installed on the loopback database; hosted environments are unchanged. Application changes and this ticket remain uncommitted.

### Changes and rationale

The former general-message gate required a connection or accepted message consent even though the pair could already exchange arbitrary inquiry text. The private permission helper now also accepts a genuine sendable inquiry/request/booking context, under its existing coach-enabled and unblocked checks. It reuses original conversation identity and permits ordinary text with `contextId: null`; it does not fabricate an inquiry, accept consent or create a connection.

The mailbox starts in normal Conversation mode and removes inquiry choices. It exposes optional actual session association only when session contexts exist, retains legacy request decisions without pretending they pause an already open chat, prevents a typed draft switching attachment and restores normal composition when returning from a session filter to All messages. Existing uncertain-send payload capture and exact retry identities remain unchanged.

### Affected files

- [Forward migration](../../../supabase/migrations/20261017000100_normal_coach_conversations.sql): replaces only `app.mail_general_allowed`, preserving owner/privileges and existing outer block/capability checks. No stored message, context or consent changes.
- [Mailbox](../../../src/features/messages/mailbox.tsx): normal first-contact/chat wording, default composition and optional session association with draft protection.
- [Database regressions](../../../tests/database/private-messages.test.ts): simulates the old permission on an existing inquiry, verifies the new upgrade and both unscoped replies/retries, checks empty/unrelated outreach denial and preserves rate/block/suspension/session/history/privacy coverage.
- [Existing local rehearsal](../../../scripts/rehearse-local-private-messages.ts): aligns labels and expected ordinary-chat behavior with the amendment. Updated and statically checked; this legacy Playwright script was not executed in this computer-use session.
- [Current specification](../../../docs/mvp-spec.md#16-private-messages-and-session-notes): updates the decision, journeys, acceptance examples, permission/compose/removal/unblock rules and reference boundaries.
- [Database guidance](../../../supabase/README.md#established-coach-conversations-dev0276): migration ordering, preserved-data local evidence and pending hosted rollout. This shared section was included by the concurrent independent DEV0272 commit, as recorded below.
- [Ticket index](../../README.md): tracks DEV0276 and its completed archive location.

### Decisions and deviations

2026-10-17: The user additionally offered one editable inquiry with a resend cooldown if easier. Retain the already confirmed normal-chat choice: immutable message history already supports ongoing text, while editing/resending would introduce separate mutation, revision and cooldown rules.

At the user's request, inspected Everfit's already-open Safari Inbox (an existing demo conversation with one ordinary message box and no Inquiry/General selector). The Compose inspection subsequently failed with a native browser `noWindowsAvailable` error; no Everfit message or setting was changed. Official [Inbox & Messaging](https://help.everfit.io/en/articles/2972174-inbox-messaging) and [client onboarding](https://help.everfit.io/en/articles/5555389-onboarding-walkthrough-for-clients) guides describe normal coach/client messaging. The first guide documents editing one's own text within 60 minutes and fewer than five previous edits, and per-client messaging controls. Neither reviewed guide establishes a single initial inquiry or resend cooldown. These are reference observations, not authorization to add editing, client feature switches or other Everfit capabilities to MOVX. Everfit's existing-client messaging does not settle public-marketplace first-contact eligibility; retain MOVX's explicit athlete-to-visible-coach initiation.

Also reviewed the separate [Everfit Marketplace Opportunities guide](https://help-marketplace.everfit.io/en/articles/10357220-manage-opportunities): intro-call/waitlist leads are managed as opportunities with coach offer/decline actions; intro calls may carry a message. That is a separate lead workflow and does not establish an inquiry-to-inbox unlock or client resend cooldown. The public marketplace page advertises coach chat, but its exact first-contact chat gate was not verified. Keep these observations distinct from the adopted MOVX behavior.

2026-10-17 continuity: independent local-development work committed as `bbcf844` (`[DEV0272] Restore isolated local Supabase development`) during implementation and included the shared Supabase README section written here. Preserved that commit and other workers' changes. The new migration, mailbox, regressions and this record were not committed by this task.

### Contracts, configuration, and operations

Migration `20261017000100` has SHA-256 `d8d28fec84d392c29d85283d9c7c7edb01bfcfbba5f8a855494c94766af8c733`. The loopback ledger is exactly `20261016000100`, `20261016000200`, `20261016000300`, `20261017000100`. The migration and exact ledger entry were applied in one repeatable-read transaction after checking the original three-version ledger, data fingerprints and private function metadata. All 39 app tables, Auth users and Storage objects/buckets (42 tables total) were identical before/after the migration; owner, ACL, security mode and search path were unchanged. No schema columns, environment variables, dependencies or account access grants changed.

Install the migration before deploying the simplified composer. The existing `canSendGeneral` response field is retained for compatibility and now includes the established-conversation grant. Hosted dev/production rollout was not performed. Application rollback needs compatible compose behavior plus a reviewed forward correction restoring the earlier function; never delete retained messages or revive terminal consent attempts.

## Validation results

- Date/environment: 2026-10-17, local PostgreSQL/Auth on repository loopback ports, Next.js 16.3.8, Node.js 24.21.0 and native Chrome. No populated environment file or secret was read or printed for this task.
- Passed: `npm test` — 206 application tests and 20 server tests, zero failures.
- Passed before and after local installation: `DATABASE_TEST_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres node --import tsx --conditions=react-server --test --test-concurrency=1 tests/database/private-messages.test.ts` — 20 checks each time. All test accounts/messages rolled back. The new upgrade check proves the old inquiry/general mismatch, unchanged original entries/contexts/read position/consent/privileges, ordinary replies by both participants without session attachment, exact/changed retry handling and empty/unrelated conversation denial. Existing tests prove private request/card rollback, complete session/history paging, source identities, legacy recipient/crossed/stale decisions, cancellation/disconnection, multiple blocks and exact expiry/cancellation boundaries, suspension, raw/helper/forged/dataset denial and rate limits.
- Passed: `node_modules/.bin/eslint src/features/messages/mailbox.tsx tests/database/private-messages.test.ts scripts/rehearse-local-private-messages.ts` and `npm run typecheck` — no lint or TypeScript errors. Focused Prettier, ticket/specification links/status/index checks and `git diff --check` passed.
- Passed: `node scripts/database-baseline.mjs verify` — all 53 archived migration checksums and generated baseline checksum unchanged.
- Passed: local owner migration transaction, guarded by the exact prior ledger, compared fingerprints of all 42 data tables and private function metadata before/after, then inserted the new ledger entry atomically. Post-commit ledger verification matched all four versions. An initial sandbox loopback connection was denied with EPERM; the reviewed local-only connection succeeded with escalation.
- Passed: isolated production build using `/Users/hoangdeveloper/.local/node/24.21.0/bin/node node_modules/next/dist/bin/next build --webpack` with the database/Auth/site/Geoapify variables explicitly empty and telemetry disabled. Copied current source into `/var/folders/97/qxdkjfmj0_l4w87jnk_rsq6w0000gq/T/movx-dev0276-build-efmphdxt`, excluded every `.env*` file and symlinked installed dependencies so the running app's `.next` was untouched. Compilation, TypeScript, all 16 static pages and route tracing passed. The first build inherited unsupported Node 20 from the temporary directory despite passing; reran explicitly with required Node 24 and no related warnings.
- AC1/AC2 browser proof: in a dedicated local tab, opened the existing athlete/coach conversation and observed a normal writable message box, Conversation selected and only actual session choices. An unsent `Draft check` enabled Send without a message request. Attempting to select a session kept Conversation and the draft while showing the explicit draft guard. Cleared the draft, selected a session filter and observed its exact request association, then returned to All messages and verified Conversation was restored. No message was sent to the existing athlete or coach; normal read acknowledgments may advance when displayed history is viewed.
- AC4 responsive/keyboard proof: desktop and 375-/430-pixel mobile layouts kept the conversation, optional session selector, message box and Send control readable without visible horizontal overflow. Keyboard Tab reached session Details, session filtering, optional association and the message box with visible focus and automatic scrolling above mobile navigation. Empty body correctly disabled Send. Restored 1412-by-829 responsive dimensions, closed only the test tab/tools and returned to the original Everfit Marketplace tab. Everfit review itself changed no messages or account settings.
- Not run: legacy full Playwright browser rehearsal, hosted migration/deployment and new external-account messaging. The enabled computer-use policy requires native browser control; focused rollback-only two-actor database proof and actual native UI/draft/mobile checks supplied this refinement's evidence without sending to existing users. No whole-database reset or reseed was used.
- Self-review: the contract, one-function migration and composer agree on ordinary unscoped versus explicit session messages. Existing private scopes/locks/rates are reused; blocked/suspended cases do not gain an automatic session fallback. No unrelated My sessions sidebar, invitations, notes or local-development changes are owned here.

| Criterion | Evidence                                                                                                                                           | Result |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Old-to-new inquiry regression, two participant ordinary sends and native writable composer                                                         | Passed |
| AC2       | Unscoped/retry/history/filter/title checks plus native draft guard and All messages transition                                                     | Passed |
| AC3       | Database negative, legacy consent, block/suspension, rate/privacy and source-isolation checks                                                      | Passed |
| AC4       | Atomic preserved-data local upgrade, baseline checksums, 226 unit/server tests, 20 DB checks, lint/type/format/build and responsive/keyboard proof | Passed |

### 2026-10-17 commit verification

`npm test` passed all 211 application and 24 server cases. `node scripts/database-baseline.mjs verify` confirmed all 53 immutable originals and generated baseline unchanged. Previously recorded checks and explicit validation limits remain applicable; no implementation or SQL changed during commit preparation. The integrated acceptance matrix was aligned with the already-delivered approval-free mailbox under DEV0279. The seven fixes share shell/mailbox/specification/test hunks and are committed together with every owning DEV ID. Independent note, invitation, calendar and authentication-planning edits are excluded. This commit does not complete missing UI evidence or deploy hosted migrations.

## Risks, limitations, and follow-ups

No remaining local acceptance work. Hosted migration/deployment remains separate and must precede publishing the simplified composer. No new edit/resend cooldown, notification, media, group chat or independent review is claimed. Pending invitations, notes, session types and the uncommitted My sessions sidebar fix remain separately owned.

## Completion and review references

- Completed: 2026-10-17 — local acceptance and evidence passed.
- Commit: `[DEV0275][DEV0276][DEV0278][DEV0279][DEV0280][DEV0281][DEV0282] Refine workspace navigation and messaging` — user-authorized local commit on 2026-10-17. Earlier shared database guidance landed independently in `bbcf844` (DEV0272).
- Review: Self-review against all four criteria passed; no independent review.
- Deployment or release: Local migration installed; no hosted rollout or publication.
