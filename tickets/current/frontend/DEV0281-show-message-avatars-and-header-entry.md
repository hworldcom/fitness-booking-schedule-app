# Ticket DEV0281: Show message avatars and header entry

- Status: Blocked
- Created: 2026-10-17
- Last updated: 2026-10-17
- Milestone: M8 private messaging refinement
- Coordination: None — independent development ticket
- Related records: Historical baselines [DEV0280](../../archive/backend/DEV0280-retire-message-request-approvals.md), [DEV0279](DEV0279-open-dedicated-messaging-workspace.md), [DEV0192](../../archive/frontend/DEV0192-show-client-avatars-in-booking-requests.md).

## Objective and context

Messages currently displays initials even when an independently authorized picture exists. The user requested profile pictures in messages and an upper-right Messages entry instead of the left workspace tab for athletes and coaches. Follow [message presentation/privacy](../../../docs/mvp-spec.md#16-private-messages-and-session-notes) and the actor-aware navigation contract.

## Scope and non-goals

- Show counterpart pictures in conversation rows and the selected conversation header, retaining initials when absent, forbidden or broken.
- Move desktop private Messages navigation from the sidebar to the upper-right header with its existing unread/unavailable badge. Preserve public-header and mobile-bottom access.
- Add only bounded authorized media references to the message projection with a forward migration. Reuse existing image URLs and private image endpoints.
- Exclude new uploads, attachments, per-message bubble images, new messaging permissions, first-contact profile redesign and unrelated DEV0279 validation.

## Expected behavior and edge cases

Athletes see a coach's public portrait. Coaches see an athlete avatar only through an existing accepted connection or their own booking request; a plain message does not grant private media. Use the existing connection/request endpoint, including its authorization/revocation behavior. Fresh conversation reads clear a no-longer-authorized image reference. Empty/broken images retain readable initials; pictures do not add redundant screen-reader names. Header access is authenticated and keyboard reachable for both capabilities, including pending/suspended account states. No duplicate desktop sidebar Messages entry remains; mobile access remains available.

## Assumptions, decisions, and dependencies

Confirmed: counterpart photos, upper-right Messages, no left Messages tab. Defaults: list/header photos rather than every bubble; preserve mobile bottom navigation because the request concerns the left panel; retain existing media privacy. Existing local message migrations DEV0276/0278/0280 are prerequisites. No new approval, private-media permission, environment variable or dependency is authorized. Scope review: this is one small presentation slice with a supporting projection change, suitable for one frontend ticket.

## Implementation plan

1. Add a bounded counterpart media projection without private paths; map public portrait references and scoped private endpoints server-side and whitelist the resulting URL in the DTO.
2. Reuse the shared Avatar component for list/header photos and initials/error fallback.
3. Move private desktop entry to the header, preserving badge/capability checks and mobile/public navigation.
4. Update the current specification. Verify migration idempotency, media isolation/revocation, parser/navigation behavior, lint/types/build and desktop/mobile keyboard/error presentation. Record exact evidence before completion.

## Acceptance criteria

- [ ] AC1: Authorized photos appear in conversation list/header; missing/broken photos use initials.
- [x] AC2: Messages never grants private athlete media; plain contacts/outsiders/different datasets receive none, and accepted-connection loss is reflected by fresh reads. Existing private byte endpoints retain their guards.
- [x] AC3: Athlete/coach private headers expose Messages with badge; desktop sidebars omit it; mobile/public access and capability restrictions remain correct.
- [ ] AC4: Desktop/mobile, keyboard, relevant error behavior and automated checks pass; record/spec/index agree.

## Validation plan

Use meaningful projection/DTO privacy tests, existing private image endpoint revocation tests, navigation tests and the rollback-only local message database suite with fictional actors. Check forward migration twice without rewriting data or prior SQL. Run npm test, focused ESLint/Prettier, typecheck and an isolated configuration-free production build. Use native browser control for desktop, phone-width presentation, keyboard entry and image fallback. Planned exact 375/430px emulation could not be enabled reliably. As a fallback, browser zoom at 300%/400% on the measured 1390px window exercises approximately 463px/348px CSS viewports; record this as responsive desktop emulation rather than a physical-phone or virtual-keyboard test. Never send test messages to existing users. Hosted deployment is separate.

## Implementation record

### Changes and rationale

Conversation rows and selected thread headers now use the shared Avatar component. The SQL projection selects public coach portrait references or an independently authorized accepted connection/request reference, never an athlete Storage path. The server converts these references into existing image URLs before the shared DTO parser rebuilds the browser response. Missing references and image failures use the existing initials fallback. Desktop private navigation puts Messages in the upper-right header, with the existing unread/unavailable badge; the sidebar omits it for every authenticated capability. Public and mobile account destinations remain.

### Affected files

| File                                                                                                                                                                                                                                                  | Purpose                                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Forward migration](../../../supabase/migrations/20261017000400_message_counterpart_media.sql)                                                                                                                                                        | Extends the existing conversation projection with independently authorized media references. No table, Storage policy or grant changes.                                             |
| [Server media mapper](../../../src/server/db/messages/media.ts), [repository](../../../src/server/db/messages/repository.ts)                                                                                                                          | Converts internal media references before serializing a bounded DTO; rejects invalid kinds/ownership/URLs.                                                                          |
| [Message DTO](../../../src/domain/private-messages.ts)                                                                                                                                                                                                | Adds nullable counterpartImageUrl and validates only public portraits or existing private connection/request routes. Missing fields remain compatible with the previous projection. |
| [Shared validator](../../../src/domain/profile-images.ts), [contracts](../../../src/profile-images/contracts.ts)                                                                                                                                      | Moves the existing pure public-portrait URL validator to the domain and re-exports it to preserve imports while respecting architecture boundaries.                                 |
| [Mailbox](../../../src/features/messages/mailbox.tsx), [styles](../../../src/features/messages/messages.css)                                                                                                                                          | Reuses Avatar in list/header at 44px; styles header navigation and mobile icon text.                                                                                                |
| [Shell](../../../src/components/shell.tsx)                                                                                                                                                                                                            | Separates desktop sidebar from mobile navigation, adds authenticated upper-right Messages with badge.                                                                               |
| [Database suite](../../../tests/database/private-messages.test.ts), [media tests](../../../tests/server/message-media.test.ts), [message tests](../../../tests/private-messages.test.ts), [navigation tests](../../../tests/shell-navigation.test.ts) | Verify grants/privacy/revocation, bounded mapping, compatibility and actor/navigation restrictions.                                                                                 |
| [Specification](../../../docs/mvp-spec.md), [index](../../README.md)                                                                                                                                                                                  | Adopt the requested presentation and track delivery/evidence.                                                                                                                       |

### Decisions and deviations

2026-10-17: Preserve the independently authorized connection/request media boundary; ordinary chat alone continues to show athlete initials. After disconnection an independent owned request may still authorize its own avatar endpoint, matching existing request-view permission. A fresh read removes the old connection reference and uses that request, or initials when no independent reference remains.

Responsive validation approach update: the native DevTools device control did not change from Value 0 after repeated keyboard/AX actions. Use browser zoom for narrow CSS viewport verification if available; restore zoom afterward. Exact device emulation is not required for these fixed photo/navigation changes, and no virtual-keyboard claim is made.

An initial app boundary check caught the URL validator import from outside the domain. The existing pure validator was moved and re-exported; no boundary exception was added. The first database fixture used day 13, outside the legacy fixture helper’s publication window; corrected to day 4 at a non-overlapping hour. Both failures were corrected before installation.

### Contracts, configuration, and operations

Additive nullable counterpartImageUrl DTO field. The browser receives no raw counterpartMedia or private Storage path. Existing private image endpoints and Storage policies remain authoritative, including post-download connection reauthorization. Missing media fields from an older database safely yield initials. No new setup, dependencies or environment variables.

Apply migrations in order; DEV0276/0278/0280 precede 20261017000400_message_counterpart_media.sql. SHA-256: 1031fa9105535210e4f91bdcb7cfc6ccf8bf6e1d2e4c3e376ddd508ab9dfbe26. Installed only on loopback Supabase in a repeatable-read transaction with exact six-version ledger precondition, before/after fingerprints for 42 app/Auth/Storage tables, unchanged function owner/ACL/security/search_path, and atomic ledger entry. Final ledger has seven versions through 20261017000400. No reset, seed or hosted operation. To roll the presentation projection back, restore mail_conversation_projection from the preceding DEV0280 migration through an explicit forward migration; there are no data changes to reverse.

## Validation results

- Date/environment: 2026-10-17, Node 24.21.0, Next 16.3.8, local Docker Supabase on loopback only.
- `npm test`: 211 application + 23 server tests passed after correcting the architecture import and fixture date. A later explicit `node --import tsx --conditions=react-server --test tests/server/*.test.ts` passed all 24 server tests after adding the configured uploaded-portrait case: 235 current application/server cases passed across these runs. An intermediate sandbox-only attempt failed with tsx IPC `EPERM`; the authorized rerun with IPC permission passed. No test exclusion or assertion weakening.
- `DATABASE_TEST_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres node --import tsx --conditions=react-server --test --test-concurrency=1 tests/database/private-messages.test.ts`: 22 checks passed before and after local installation, rollback-only. The media migration is applied twice inside the test transaction. Fixtures prove plain-contact exclusion despite an uploaded athlete avatar, public portrait reference, pending-request authority, pending-versus-accepted connection selection, disconnection fallback to the independent request, image removal, outsider denial and wrong-dataset denial. Existing byte-service tests prove connection revocation/replacement during download never releases bytes.
- `npm run typecheck`: passed after final source changes. Focused `npx eslint` and `npx prettier --check` passed on changed implementation/tests. `git diff --check` passed. `git diff --name-only -- supabase/migration-history` was empty; immutable history is untouched.
- Isolated production build: `/Users/hoangdeveloper/.local/node/24.21.0/bin/node node_modules/next/dist/bin/next build --webpack`, with database/Auth/site/map settings blank and telemetry disabled in `/var/folders/97/qxdkjfmj0_l4w87jnk_rsq6w0000gq/T/movx-dev0281-build-2weufyw1`: passed compilation, TypeScript, all 16 static pages and traces. No populated environment files copied, running development build left untouched.
- Native Chrome desktop at 1390×768: observed the real fictional Daniel Park portrait in both the conversation row and selected thread header. Observed My sessions with one upper-right Messages icon/text entry and no sidebar Messages. Initial pre-migration list showed initials without broken image layout, then a full reload showed the photo after installation. Conversation still showed its existing message, original booking-request card and normal composer. Personal account initials remained intact. No messages, booking decisions, blocks, invitations or uploads were submitted.
- **Blocked/not run:** final phone-width, keyboard activation/focus and deliberate image-failure browser checks could not be completed. Native device-toolbar toggle remained Value 0 after keyboard/AX actions; screenshot calls produced ScreenCaptureKit -3811/-3812, then coordinate input produced `noWindowsAvailable`. Browser zoom fallback also failed to produce a verifiable layout change. A CUA session reset/reconnect still returned only empty menu containers. Do not interpret these attempts as responsive evidence. Coach-specific live UI was not reauthenticated; capability/navigation restrictions are automated evidence only.

| Criterion | Evidence                                                                                                                                                                 | Result                          |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| AC1       | Real desktop row/header photos observed; optional media and invalid references tested; shared Avatar error handler reused. Deliberate browser image-error check remains. | Partial                         |
| AC2       | 22 database checks and server media/connection revocation tests; DTO strips raw references/private paths.                                                                | Passed                          |
| AC3       | Desktop athlete header/sidebar observed; all actor-state sidebar/public/mobile navigation tests passed. Coach live view not separately observed.                         | Passed with noted browser limit |
| AC4       | Types/lint/format/build/tests passed; required responsive/keyboard/error UI evidence remains unavailable.                                                                | Blocked                         |

### 2026-10-17 commit verification

`npm test` passed all 211 application and 24 server cases. `node scripts/database-baseline.mjs verify` confirmed all 53 immutable originals and generated baseline unchanged. Previously recorded checks and explicit validation limits remain applicable; no implementation or SQL changed during commit preparation. The integrated acceptance matrix was aligned with the already-delivered approval-free mailbox under DEV0279. The seven fixes share shell/mailbox/specification/test hunks and are committed together with every owning DEV ID. Independent note, invitation, calendar and authentication-planning edits are excluded. This commit does not complete missing UI evidence or deploy hosted migrations.

## Risks, limitations, and follow-ups

Implementation and local migration are present; this record stays current/Blocked because required UI evidence is missing. Next action: with functioning native browser control, verify list/thread photos and upper-right Messages on a phone-width viewport, Tab/Enter activation, initials after a failed image, and coach workspace header/sidebar. Re-run automated checks only if those checks require code changes. DEV0279 retains its independent outstanding focus/layout work.

Cleanup: task DevTools was closed after confirming device-toolbar Value 0; the temporary Safari sign-in tab was closed without authentication. The task-owned final Chrome My sessions tab remains open with no unsent draft. Final native menu/zoom cleanup could not be verified after the browser-control failure; original tabs/accounts were not intentionally closed or changed. Browser zoom reset was attempted but not claimed successful. Hosted migration/deployment remains separate.

## Completion and review references

- Completed: Not completed.
- Commit: `[DEV0275][DEV0276][DEV0278][DEV0279][DEV0280][DEV0281][DEV0282] Refine workspace navigation and messaging` — user-authorized local commit on 2026-10-17.
- Review: Self-reviewed scope, changed source, projection privacy/authority and acceptance evidence. No independent review; missing UI checks prevent completion.
- Deployment or release: Not deployed.
