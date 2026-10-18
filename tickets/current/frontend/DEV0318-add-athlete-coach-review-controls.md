# Ticket DEV0318: Add athlete coach review controls

- Status: In progress
- Created: 2026-10-17
- Last updated: 2026-10-18
- Milestone: M10 — Coach marketplace websites (planned)
- Coordination: [COR0028 — Coach marketplace cards and personal websites](../organisatory/COR0028-coach-marketplace-cards-and-personal-websites.md)
- Related records: Peer dependencies/consumers: [DEV0320](../../archive/organisatory/DEV0320-adopt-coach-marketplace-website-contract.md), [DEV0314](../../archive/backend/DEV0314-persist-booking-linked-coach-reviews.md), [DEV0317](DEV0317-build-shareable-personal-coach-websites.md), [DEV0319](../backend/DEV0319-rehearse-coach-marketplace-websites.md). External media: [DEV0297](../backend/DEV0297-add-coach-profile-photos-and-mux-video.md). Amendment: [DEV0330](../../archive/organisatory/DEV0330-refine-coach-marketplace-pricing-reviews-and-urls.md); username routing: [DEV0331](../backend/DEV0331-enable-username-based-public-coach-urls.md).

## Objective and context

Let an athlete with at least one eligible session maintain exactly one review of that coach, with explicit public attribution consent. Later sessions do not create more review allowances. Use [section 19.4](../../../docs/mvp-spec.md#194-reviews-consent-and-public-aggregates); private controls can start against the completed DEV0314 API. Public-result integration remains dependent on DEV0331/DEV0317.

## Scope and non-goals

- In scope: eligible pair-level review entry from original private session/history, consented compose/preview/publish, edit/withdraw/republication of the same review, retained draft/retry/revision recovery and link to the coach's username-based public review section.
- Out of scope: duplicate entries creating reviews per booking, review service/moderation/aggregate engine (DEV0314), public card/page list layout, public athlete identity, coach replies and group reviews.

## Expected behavior and edge cases

After one eligible session show Write a review only if the pair has no review; every later eligible booking links to Edit/View the same pair review. Withdrawal offers revision/republication of that record, not a fresh allowance. Eligibility stays server-owned. Explicitly preview/consent to attribution/score/comment and never autofill private legal name/avatar. Different booking-entry tabs, uncertain sends, repeated clicks, stale revisions and username changes recover the same pair/review result. No publication changes booking status or sends a message.

## Assumptions, decisions, and dependencies

Depends on revised DEV0314 pair eligibility/review services. Agree the username public-review destination with DEV0331/DEV0317 and preserve private history paging. Saved usernames are not review identity keys. Gallery/video decisions are unrelated and deferred until directory cards complete. Current Auth/session authority remains the compatibility baseline.

## Implementation plan

1. Integrate the athlete `ClientSessions` history with a single actor/session/dataset-scoped review workspace. Use original elapsed non-cancelled bookings only as candidate entry points; GET eligibility remains authoritative. Cache state by coach, not booking; refresh it on reopening/focus.
2. Add one consented rating/comment/attribution compose/preview with correct Write versus Edit/View behavior.
3. Use the existing GET/POST author API with synchronous submit locking, exact-command retries for uncertain saves, explicit latest-revision recovery and draft retention. Reset consent after changes/rebase and clear private memory on identity/access change. Never persist drafts in browser storage.
4. Refresh the real public summary after author changes. Integrate the real `/@username#reviews` destination after DEV0331/DEV0317 deliver it; do not render a dead link or derive a public handle from private identity. This dependency remains an unmet part of AC4, not a reason to claim completion of the private slice.
5. Verify one review across multiple sessions/tabs/reconnection/rename and real private/public rating refresh with mobile/desktop keyboard recovery.

## Acceptance criteria

- [x] AC1: One eligible session enables one pair review; later bookings lead to the existing review and cannot enable a second submission for that coach.
- [x] AC2: Public preview/consent is explicit for publication/republication and private names/avatar/booking data are never silently disclosed.
- [ ] AC3: Multi-booking entry tabs, retry, edit, withdrawal/republication, stale revision, lost access and uncertain send recover one stable pair review with no duplicate or automatic booking/message mutation.
- [ ] AC4: Actual private-history/public-username-result and aggregate refresh flows pass on phone/desktop with keyboard, including all forbidden eligibility cases.

## Validation plan

Use two or more eligible bookings for one pair plus different-coach and forbidden-state fixtures. Open review entry from separate booking pages/tabs and prove one record and Edit/View routing afterward, including withdrawn review, retry, reconnect and username rename. Verify explicit consent, private identity isolation, pair count/mean refresh and public username links. Exercise mobile/desktop keyboard score controls, errors/focus, drafts and older history pages; run focused author/service and lint/typecheck/build checks during implementation.

## Implementation record

### Changes and rationale

2026-10-17 planning checkpoint: created the Draft peer; no runtime changes existed at that checkpoint.

2026-10-18: added review entries to the athlete's elapsed, non-cancelled private-session cards. Each coach has one shared private workspace, so a review published from one booking immediately changes both eligible entries to View/edit. Server eligibility controls actual publication; future/cancelled cards and preview/signed-out actors do not gain review authority.

The dialog provides rating 1–5, optional bounded plain-text comment and a deliberately blank first-publication name. A separate normalized preview shows only the public attribution/rating/comment. Consent starts unchecked and resets on editing, revision recovery and every republication. Saved, withdrawn and platform-hidden states stay distinct; author changes cannot undo moderation. The actual public summary refreshes after saves, and a failed summary read is reported as unavailable rather than zero. Older summary replies cannot overwrite a newer mutation.

Drafts survive dialog close/reopen and ordinary errors within the mounted page. A synchronous per-coach lock prevents repeated submissions. Uncertain writes retain the exact command for retry; conflict recovery fetches the saved version and requires an explicit choice before retaining/rebasing or discarding the draft. A new preview and consent are required after rebase. The clicked original booking is used for the command while review identity stays pair-level. Subject/profile/dataset changes or API access denial clear private workspace memory. No review action invokes booking or messaging commands.

### Affected files

| File | Role |
| --- | --- |
| [review-workspace-model.ts](../../../src/features/reviews/review-workspace-model.ts) | Validated private response mapping, candidate entry filter, in-memory pair controller, submission/recovery and public-summary freshness. |
| [athlete-review-workspace.tsx](../../../src/features/reviews/athlete-review-workspace.tsx) | Actor-bound provider, shared entry buttons, accessible edit/preview/consent/saved controls and recovery presentation. |
| [reviews.css](../../../src/features/reviews/reviews.css) | Scoped responsive dialog, rating/consent controls, focus and bounded content. |
| [client-sessions.tsx](../../../src/features/profile/client-sessions.tsx) | Wraps the existing athlete session list and adds review entries without changing its booking/connection/title behavior. |
| [ui.tsx](../../../src/components/ui.tsx) | Optional dialog eyebrow; existing callers keep their prior default and focus trap. |
| [layout.tsx](../../../src/app/layout.tsx) | Loads scoped review styles through the existing global stylesheet boundary. |
| [athlete-reviews.test.ts](../../../tests/athlete-reviews.test.ts) | Eleven contract/state/markup tests including duplicate clicks, uncertain writes, conflicts, actor loss, withdrawal, consent and stale aggregate responses. |

### Decisions and deviations

2026-10-17 user-review amendment (DEV0330): replace fixed private quotes/snapshots with coach-owned optional public starting rates; enforce one review per athlete–coach pair after a session; use username public URLs under DEV0331; finish cards before media-allowance decisions. Current scope/plan/criteria above supersede the initial defaults; runtime has not started.

2026-10-18 implementation start: DEV0314 is completed. Begin the independent private controls while DEV0331 (now In progress) and DEV0317 (Draft) own public destinations. AC4 remains unchanged and incomplete until those real destinations can be exercised. Adopt an in-memory pair workspace, two-step edit/preview with unchecked consent, normalized Unicode-bounded plain text, explicit stale/uncertain recovery and truthful published/withdrawn/moderation states. Reuse the native dialog focus trap with an optional review-specific eyebrow; preserve existing modal defaults. Review forms never receive legal name, preferred name, avatar or email props. Preserve unrelated shared-tree edits.

### Contracts, configuration, and operations

Consume `GET /api/coach-reviews?coach=slug`, `POST /api/coach-reviews` (publish/withdraw with expected revision), and `GET /api/coaches/[slug]/reviews` summary. No new schema, dependency, environment or provider contract was introduced. Local proof uses the completed DEV0314 migration. Drafts live only in the mounted actor-bound workspace and are discarded when access changes or the page unmounts. Public username destinations are a pending peer integration. No credentials or private data belong in this record.

Local rollout: normal startup stopped because the shared ledger already included `20261018000500` while review migration `20261018000400` was missing. Applied only the frozen DEV0314 SQL (SHA256 `4dda173a29e251ac073acf03992a38e50e09b3518851b31117bc943ad93ba82a`) and its ledger row atomically under a migration-table lock. Counts/content fingerprints of profiles, coaches, private bookings, availability slots, Auth users and Storage objects were unchanged. The unfinished `20261018000600` username migration was deliberately left to its owner. No reset, historical SQL edit or hosted migration occurred. Started Next directly with the existing loopback launcher environment helper so browser checks did not auto-apply that peer migration. No rollback was performed; the local review foundation remains installed. Review UI rollback removes this ticket's interface changes without dropping backend review data.

## Validation results

- Environment: 2026-10-18, Node 24.21.0, Next 16.3.8, local Docker Supabase on repository ports, native Chrome at desktop 1390×768 and emulated iPhone 16 Pro Max 440×956. Installed bundled Next client-component documentation was read before edits.
- `node --import tsx --test tests/athlete-reviews.test.ts`: 11/11 passed; exact-command recovery, duplicate locking, failed conflict reload, consent reset, shared entries, identity loss, private-field stripping and stale aggregates are executable evidence. Focused log: `/tmp/movx-dev0318-focused-final.log`.
- `npm test`: 280 application tests plus 46 server tests passed (326 total), including the eleven new interface/model tests. Log: `/tmp/movx-dev0318-tests-final.log`.
- Focused ESLint and Prettier checks passed for `src/features/reviews`, `src/features/profile/client-sessions.tsx`, `src/components/ui.tsx`, `src/app/layout.tsx` and `tests/athlete-reviews.test.ts`; `git diff --check` passed across the shared tree.
- Isolated `next build --webpack` and `npm run typecheck`: both exited 0 with all seven implementation/test files matching the final workspace bytes. Logs: `/tmp/movx-dev0318-build-final.log`, `/tmp/movx-dev0318-types-isolated.log`; isolated path is retained in `/tmp/movx-dev0318-build-path`. This verifies source/config/scripts/tests/public without the unrelated ignored work copies. Root typecheck's unrelated-work limitation remains explicit below.
- Development-ticket/COR/index/spec links were checked locally; no external/provider review or deployment is claimed.
- Earlier validation limitations: direct `tsx`/the startup subprocess hit sandbox IPC `EPERM`; reran through the supported Node loader and then full suite with IPC permitted. An initial concurrent username test mismatch was corrected by its owning work before the successful suite retry. Root `npm run typecheck` included another session's incomplete copies under `work/dev0336/commit-files`; validation therefore also uses an isolated source/config/scripts/tests/public snapshot without ignored work or populated environment files. Initial isolated Turbopack build rejected the external dependency symlink; the installed `next build --webpack` path validates the snapshot instead. These are reported failures, not passed checks.

Native browser observations:

1. Signed in through the normal password UI as one tagged temporary local athlete; created two elapsed private bookings with the same fictional Daniel Park coach, plus future/cancelled controls. Only the two elapsed cards exposed review entry. The first editor had empty public attribution and no selected rating; no private name/avatar appeared in its public preview.
2. Used radio arrow keys to choose 4 stars, entered an explicitly chosen fictional attribution/comment and used Tab/Return to preview. Publish stayed disabled until the unchecked consent box was selected. Publish saved successfully and the real public read showed `Fictional coach · 4.0/5 · 1 public review`.
3. Escape closed the dialog. Both eligible cards now showed View/edit; the other booking reopened the same saved text and score. Withdrawal retained the saved review and changed the real public summary to `No public reviews`.
4. At 440×956, opened Revise and republish, used keyboard navigation to preview and observed fresh unchecked consent/disabled publication. Explicit consent plus Tab/Return republished successfully and restored `4.0/5 · 1 public review`. The final database inspection found exactly one fixture review at revision 3, published with the same chosen text and score. Phone layout inspection led to displaying the saved version only in view/conflict states so editing/preview do not duplicate it vertically.
5. Restored desktop mode, closed only this task's DevTools window and removed only the tagged temporary athlete, pair review and exact fixture bookings/slots; original coach/profile content was not modified. Temporary Auth removal ended its access; returned the browser to Home. The retained ignored fixture manifest contains IDs only, not credentials.

| Criterion | Evidence | Result |
| --- | --- | --- |
| AC1 | Real two-booking entry, single row at revision 3; shared-state/later-booking tests and completed DEV0314 pair constraint/race evidence. | Passed |
| AC2 | Real blank initial attribution, preview and unchecked consent on publish/republish; contract/markup tests strip private fields and consent resets. | Passed |
| AC3 | Eleven tests cover draft/retry/conflict/access-loss/withdraw/republish; real private lifecycle passes. Separate simultaneous browser tabs, browser network-failure injection and username rename/reconnection proof remain for integration. | Partial |
| AC4 | Actual desktop/phone private history, keyboard consent and real mean/count refresh pass. Full public username page/result and remaining integrated forbidden/error cases await peer delivery and combined proof. | Partial; public destination dependency |

### Commit and local migration check — 2026-10-18

User authorized committing the review checkpoint and applying ready migrations. Read-only inspection found every current local migration already installed through `20261018000600`; no pending local SQL remained. Review migration `20261018000400` exactly matched its stored ledger SQL and the frozen hash above; private read/mutation/public-page functions were present. The username peer had applied its separately owned migration by this later check. No duplicate migration, reset, hosted change or production change was performed. This entry records later operational evidence without rewriting the archived backend's earlier pre-rollout checkpoint.

The commit includes only review implementation, records and directly affected archive/spec/index links. Other pending registration/authentication, navigation and username-routing work stays outside it. The exact staged snapshot passed on Node 24.21.0: `npm test` ran 268 application plus 44 server tests (312 total); `next build --webpack` compiled, typechecked and generated production output successfully; focused ESLint/Prettier, frozen migration hash, `git diff --cached --check` and all 53 historical/baseline checksum checks passed. Snapshot logs: `/tmp/movx-review-staged-tests.log`, `/tmp/movx-review-staged-build.log`, `/tmp/movx-review-staged-static.log`. The initial temporary-directory run selected unsupported Node 20 and failed four environment-sensitive checks; rerunning with the explicit Node 24 PATH passed unchanged source. The staged count differs from the earlier 326-test shared workspace because independent uncommitted feature tests are excluded. All review-added/updated document links resolve in the snapshot; one unrelated pre-existing COR link to the uncommitted DEV0325 archive remains outside this checkpoint. The staged review ticket keeps the existing committed DEV0331 dependency link until its peer archive commit; the newer link in the working tree is preserved unstaged.

## Risks, limitations, and follow-ups

Private controls are In progress; public destination/combined proof is pending. Public consent must remain separate from private account identity and session participation. Public review-list rendering and operator moderation are owned by peers.

Handoff: private controls and the local review foundation are implemented. Keep this ticket In progress. Once DEV0331 and DEV0317 provide the actual public username/review destination, wire that link from the saved result without deriving a handle from private account data. Then complete separate-tab/rename/reconnect/network-error/forbidden UI proof and the real public destination on desktop/phone, update AC3/AC4 and only then archive. DEV0319 owns the wider combined marketplace rehearsal. In-memory drafts intentionally do not survive page navigation/reload; moderation and public review-list layout remain outside this ticket.

## Completion and review references

- Completed: Not completed — implementation and required integration validation underway.
- Commit: User authorized the DEV0314/DEV0318 review checkpoint on 2026-10-18. This commit preserves In progress status and the unmet public-integration criteria; see Git history for its hash.
- Review: Local implementation/acceptance self-review and the recorded tests/browser observations; no independent review.
- Deployment or release: None.
