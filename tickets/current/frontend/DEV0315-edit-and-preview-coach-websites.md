# Ticket DEV0315: Edit and preview coach websites

- Status: In progress
- Created: 2026-10-17
- Last updated: 2026-10-18
- Milestone: M10 — Coach marketplace websites (planned)
- Coordination: [COR0028 — Coach marketplace cards and personal websites](../organisatory/COR0028-coach-marketplace-cards-and-personal-websites.md)
- Related records: Peer dependencies/consumers: [DEV0320](../../archive/organisatory/DEV0320-adopt-coach-marketplace-website-contract.md), [DEV0321](../../archive/backend/DEV0321-persist-coach-website-content-and-banners.md), [DEV0313](../../archive/backend/DEV0313-manage-coach-starting-prices-and-visibility.md), [DEV0317](DEV0317-build-shareable-personal-coach-websites.md), [DEV0319](../backend/DEV0319-rehearse-coach-marketplace-websites.md). External media: [DEV0297](../backend/DEV0297-add-coach-profile-photos-and-mux-video.md). Amendment: [DEV0330](../../archive/organisatory/DEV0330-refine-coach-marketplace-pricing-reviews-and-urls.md); username routing: [DEV0331](../../archive/backend/DEV0331-enable-username-based-public-coach-urls.md).

## Objective and context

Let an authorized coach prepare and preview the structured website without a separate website editor or exposing private account fields. The existing Profile editor does not manage M10 branding, content or a starting rate.

Implement against the [M10 contract](../../../docs/mvp-spec.md#19-coach-marketplace-cards-and-personal-websites), especially [the relevant boundary](../../../docs/mvp-spec.md#195-owner-editing-and-media-sequence), [milestone](../../../docs/mvp-spec.md#12-delivery-milestones) and [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix). The user approved starting runtime work on 18 October 2026 after reviewing DEV0338.

## Scope and non-goals

- In scope: Coach Profile edit/preview for brand/banner/introduction/approach/focus/experience/qualifications/FAQs/links, owner-defined starting rate and explicit public show/hide setting, username-URL preview/claim guidance, save/cancel/draft/conflict recovery; later compose DEV0297 media controls after cards complete and media decisions are revisited.
- Out of scope: content/banner/rate persistence, username resolver/Account rename engine (DEV0331), gallery/Mux implementation or allowance/premium choices now, public website/card layout and private Account identity editing.

## Expected behavior and edge cases

Clearly separate public coach identity/content from private Account fields. Starting amount and disclosure are independent: hidden amounts remain visible only to their owner and absent in public preview. Show the current username URL or honest legacy/claim guidance using DEV0331 results. Preserve explicit save/cancel, retained error drafts, stale-tab recovery, existing locations/portrait and applicant/private publication gates. Optional new fields are not required for old profiles. Text/banner/rate/URL editing does not wait on media allowance; gallery controls are a later integration after cards.

## Assumptions, decisions, and dependencies

DEV0321 provides schema-version-1 content plus private banner preview/mutation APIs and one expected revision shared by text/banner; its content/banner backend prerequisite is delivered locally. Consume its documented contracts and conflict/recovery statuses without another media pipeline. DEV0313 supplies `GET/PUT /api/coach/starting-rate`, schema-1 integer EUR cents, independent `showPublicly` and a separate pricing revision; content/banner saves must not reuse that revision. Use its exact decimal helper, preserve drafts on 400/409/503, and omit hidden rates from public preview. Depends on the revised DEV0313 owner contracts; DEV0331 supplies URL/claim capability and keeps username ownership in Account. Foundations/editor may proceed before cards, but do not ask for or decide gallery/video allowances now. DEV0316 completes before that media review; later media-control composition consumes DEV0297 without duplicating its engine. Coordinate shared preview structure with DEV0317.

## Implementation plan

User steering on 2026-10-18: the user approved the independent [DEV0338 coach-page example](../../archive/frontend/DEV0338-preview-a-personal-coach-page.md) ("looks great, lets try it out"). Use its banner/portrait, quiet section layout and contact-card composition as the owner-preview direction. Its fictional identity, prices, reviews and availability are not real profile data or product decisions. DEV0317 still owns the public page; the example does not satisfy these editor acceptance criteria.

Implementation decisions before runtime edits: add a bounded website section to the existing Profile editor, retaining its identity, location, portrait and URL controls. Content and banner use one serialized revision; pricing has its own form/revision and explicit Save. Never imply a cross-API atomic save. Editing stays in memory and is cleared when verified subject/profile/dataset/access changes. Save errors retain drafts; uncertain mutations and conflicts require loading saved state, then an explicit choice to discard or rebase a draft before another mutation. Banner changes save immediately with clear wording and retain unsaved text. Cancel discards text/rate drafts, not previously saved banner changes. Preview switches between saved and unsaved content, includes only public coach fields, suppresses hidden rates and omits fabricated availability/reviews/gallery. Test with disposable DEV0315 profiles; do not mutate retained demo coaches.

1. Inspect existing owner editor/actions/preview and installed integration docs; record public/private field ownership.
2. Add optional content/banner controls with explicit saved/draft preview and existing publication/location gates.
3. Add coach starting amount plus independent Show publicly control, and current username URL/claim guidance through owning services.
4. Preserve dirty/error drafts, save/cancel, revision conflicts and existing location/portrait behavior. Defer gallery/video choices and integration until cards complete.
5. Validate real owner save/reload/public privacy and desktop/mobile/keyboard recovery; later integrate only delivered authorized media controls.

## Acceptance criteria

- [ ] AC1: Owner can edit/save/cancel all optional public content and independently set/show/hide the starting rate with truthful saved/private preview.
- [ ] AC2: Username URL/claim guidance uses DEV0331 results, private Account names/avatar stay separate and applicant/hidden/unauthorized publication gates remain enforced.
- [ ] AC3: Validation/upload/save failures, stale revisions and concurrent tabs retain/recover drafts without partial publication or false success.
- [ ] AC4: Actual responsive/keyboard text/banner/rate/URL flows pass without media decisions; later gallery-control integration links DEV0297 evidence after cards and invents no allowance/premium rule.

## Validation plan

Use actual isolated owner/applicant/other-account profiles for content/banner save, zero/absent/paid starting rate and private/public toggles, public reload and missing/renamed username guidance. Check public preview excludes hidden rates and private names/avatar. Exercise stale tabs, invalid links, failed uploads/saves, cancel and retained drafts at phone/desktop widths by keyboard. Gallery/video questions do not block these checks; validate later authorized photo integration separately after cards. Run meaningful affected Profile/service tests, lint/typecheck/build during implementation.

## Implementation record

### Changes and rationale

2026-10-17 planning checkpoint: created this bounded Draft peer under COR0028; that checkpoint changed no runtime behavior. On 2026-10-18, after DEV0338 approval, implemented the owner editor slice described below. The required browser proof remains incomplete.

### Affected files

| File                                                                                                                                                                                                  | Resulting role                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [coach-profile-editor.tsx](../../../src/features/coaches/coach-profile-editor.tsx)                                                                                                                    | Mounts website editing inside existing Coach Profile; preserves the unrelated navigation changes already present.                                                                    |
| [coach-website-editor.tsx](../../../src/features/coaches/website/coach-website-editor.tsx) and [CSS](../../../src/features/coaches/website/coach-website-editor.css)                                  | Optional text/FAQ/link controls, immediate banner actions, independent rate form, explicit save/cancel/recovery and preview dialog.                                                  |
| [coach-website-preview.tsx](../../../src/features/coaches/website/coach-website-preview.tsx)                                                                                                          | Public coach identity, banner fallback, content sections and inactive contact-card preview; hidden numeric rates omitted. Distinguishes saved/unsaved/private and unverified states. |
| [revision-editor.ts](../../../src/features/coaches/website/revision-editor.ts)                                                                                                                        | Serialized writes, draft retention, explicit rebase/discard, revocation and late-response disposal.                                                                                  |
| [website-client.ts](../../../src/features/coaches/website/website-client.ts)                                                                                                                          | Validates owner DTOs, expected banner URLs and coherent HTTP statuses; parses exact owner decimal drafts through the existing domain helper.                                         |
| [coach-website-editor.test.ts](../../../tests/coach-website-editor.test.ts)                                                                                                                           | Eight state, transport and rendered-privacy checks; existing domain suites cover optional-content limits and exact decimal rules.                                                    |
| [rehearse-local-coach-website-editor.ts](../../../scripts/rehearse-local-coach-website-editor.ts) and [local-connection-rehearsal.ts](../../../scripts/lib/local-connection-rehearsal.ts)             | Disposable browser-test companion, exact-ID cleanup and retained-data hash journal; no browser automation or retained-user credential changes.                                       |
| [M10 specification](../../../docs/mvp-spec.md#195-owner-editing-and-media-sequence), [index](../../README.md) and [COR0028](../organisatory/COR0028-coach-marketplace-cards-and-personal-websites.md) | Record approved visual direction, active ownership and remaining integration/validation.                                                                                             |

### Decisions and deviations

2026-10-17 user-review amendment (DEV0330): replace fixed private quotes/snapshots with coach-owned optional public starting rates; enforce one review per athlete–coach pair after a session; use username public URLs under DEV0331; finish cards before media-allowance decisions. Current scope/plan/criteria above supersede the initial defaults; runtime has not started.

2026-10-18 implementation: keep existing public coach identity, portrait, locations and DEV0331 URL controls. A new website section owns optional content, serialized banner changes and an independent starting-rate form. Saved/unsaved previews follow the approved DEV0338 composition without its fictional data. Text/rate drafts live only in memory. Verified subject/dataset/profile/access changes unmount the private workspace; 401/403 clears it and late responses are ignored. Failed/uncertain writes require a fresh read and an explicit discard/rebase decision. Banner saves explicitly happen immediately and Cancel does not roll them back. No gallery/video entitlement was chosen.

### Contracts, configuration, and operations

Rehearsal recovery amendment (before the affected helper edit): the second test run reached slow/unverified local banner responses and an Auth-admin cleanup failure after its application rows were removed. Add bounded companion HTTP requests and an ignored, mode-0600 recovery journal containing only exact disposable IDs and retained row hashes. Run retained-data comparisons even if cleanup fails and retain the journal for recovery. Do not reset services, change retained users, or silently treat that failure as passed banner validation.

No database schema, migration, dependency, environment variable or retained demo-data changes. Consume existing schema-1 website/banner/rate APIs. Content and banner share the website revision; rate uses its own revision. Banner upload sends raw JPEG/PNG/WebP bytes with quoted If-Match and the server enforces its existing normalization limits. GETs are no-store; browser requests use same-origin credentials and a 30-second timeout. DTO parsing rejects unexpected banner routes and invalid text/rates. Runtime rollback is removing the new editor integration; existing optional saved data remains compatible. A local manual-test companion creates only newly tagged temporary profiles, refreshes its cookies after fixture password setup, and removes only its exact accounts/banner objects, then compares retained row hashes. It neither resets nor reseeds the database.

## Validation results

- 2026-10-18, Node 24.21.0, Next 16.3.8; existing local app/Auth/Storage/database, no service restart/reset or migrations.
- `node --import tsx --test tests/coach-website-editor.test.ts tests/coach-website.test.ts tests/coach-starting-rate.test.ts`: 14 passed, including eight new state/transport/privacy tests.
- Isolated source snapshot `/private/tmp/movx-dev0315-75hizl78`: `npm test` passed 291 unit + 46 server tests; `npm run typecheck`, `npm run lint`, and `node node_modules/next/dist/bin/next build --webpack` passed. Logs: `/private/tmp/dev0315-{tests,typecheck,lint,build}.log`. No populated environment files copied; public configuration/templates and empty examples included. Initial incomplete snapshot runs failed on missing test inputs; reruns after completing the snapshot passed. No application changes were made to suppress those checks.
- Root `tsc --noEmit` remains blocked by unrelated incomplete `work/dev0336/commit-files` copies (16 missing-module/implicit-any errors); the real source type check above passes. Do not delete or alter that unrelated work.
- Native Safari private-window checks underway: disposable approved hidden owner loads empty optional values and existing portrait/location/URL controls; keyboard editing works; invalid HTTP link retains draft; a real independent API write produces a stale-revision warning with the unsaved draft retained. Hidden owner public website API returns 404. Removing the first exact fixture cleared website UI via the actor/access gate; no private draft reused across identities.
- Fixture-only correction: changing the newly created test password invalidated helper cookies, causing the initial companion API request to return 401. Exact fixture cleanup passed with all 36 retained row hashes unchanged. The companion now signs in again after password setup; its verified read succeeds. No retained account credentials changed.
- Remaining browser evidence and later media composition are recorded below; do not mark this ticket completed yet.

| Criterion | Evidence                                                                                                                                                                                                                                                                                                                     | Result  |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| AC1       | Text save/rebase/read revision 2; independent 6050-cent hidden rate revision 1; desktop saved preview omits its amount. FAQ/link draft controls and HTTP-link validation observed. Valid banner save, full optional-array persistence/cancel browser proof and visible/zero/absent UI variations remain.                     | Partial |
| AC2       | Existing URL guidance and identity/location/portrait controls observed; hidden coach public API 404; deleted fixture clears private editor via actor gate. Applicant/other-account and renamed-URL browser checks remain. Existing owning service tests passed.                                                              | Partial |
| AC3       | Actual stale write, retained draft, load/rebase/save passed; invalid-link draft retained. Eight new tests cover uncertain saves, failed reads, serial banner/text writes and late-response revocation. Actual banner response unverified and fresh read failed; do not count successful upload/removal.                      | Partial |
| AC4       | Desktop Safari at 1232 × 768 and keyboard field entry/save/rebase/preview observed. Mobile, full modal focus/FAQ interaction, error recovery and banner checks remain blocked by native browser pipe failures/local service delays. Later gallery integration remains sequenced after cards and authorized DEV0297 delivery. | Partial |

Additional local-browser evidence and limits on 2026-10-18:

- The second disposable hidden owner saved public text after a real revision conflict: blocked stale write → load saved revision → Keep my draft for review → explicit Save. Companion read observed website revision 2. Its independent comma-decimal `60,50` save produced rate revision 1, 6050 cents and disclosure off. Saved desktop preview showed real public coach fields/location and “Contact the coach for pricing,” with no numeric rate or invented reviews/times.
- Upload of the unchanged repository banner reached an unverified response; subsequent UI read failed. A companion read still reported no banner. Local Supabase containers reported healthy, but API/native UI operations became slow. No successful banner upload/removal, mobile render, final modal focus return, full optional-array save/reload or applicant/other-account browser result is claimed. Native browser control failed with “native pipe closed before response” and “native pipe startup failed”; the created private test window could not be closed through the tool after that loss. Both fixture password-save prompts were dismissed.
- The second companion removed its exact application/Storage records, then Auth-admin removal failed. A fresh exact-identity retry verified that no application profile or Storage object remained and successfully removed that Auth identity; SQL fallback was prepared but not used. Final read-only Auth count was zero for the disposable DEV0315 cohort. Its original whole-run retained-hash comparison was not reached because cleanup threw. The first fixture's 36-row retained-hash comparison passed; do not claim a second whole-run hash proof. The updated companion journals IDs/hashes and checks retained rows even if cleanup fails, but that amended full browser rehearsal has not yet run.
- Final compact-banner sizing, inactive semantic preview buttons and the explicit unverified-preview notice were added after browser control failed; their final visual/focus check remains outstanding, alongside the mobile check.
- Re-run manual companion: `node --import tsx --conditions=react-server scripts/rehearse-local-coach-website-editor.ts` against the existing local app. Use only its newly created fixture in an isolated browser session. Its `conflict`, `verify`, and `finish` terminal commands respectively create a real stale revision, read saved/private state, and clean exact IDs. Bounded reads and mode-0600 recovery evidence under ignored `tmp/dev0315-editor/<run>/` support failure recovery. Never reuse retained coach accounts for writes.

Final static checkpoint: after the preview copy/compact-banner/semantic-button and companion recovery changes, the focused 14 tests, isolated whole-repository lint and webpack production build (including TypeScript) passed again. The earlier full 337-test suite remains the recorded broader regression checkpoint. Final ticket/COR link check found 62 relative links and no missing targets. A native-browser retry after the build still failed with “service startup request failed”; mobile and the final visual polish remain unverified, not product-tested failures. The user requested a checkpoint commit on 2026-10-18; this is an incomplete implementation checkpoint, not ticket completion.

## Risks, limitations, and follow-ups

Runtime text/banner/rate editing is In progress; browser verification continues. Complete DEV0316 cards before revisiting photo/video allowance/premium questions. Later full website media integration still needs the authorized DEV0297 capability; those decisions do not block content/banner/rate/routing/card work. Preserve hidden starting-rate privacy, pair-review identity and safe username/legacy links. Next: restore a working native-browser connection/local service responsiveness, run the companion below, and finish the remaining owner/applicant/other-account, banner, mobile and keyboard/reload checks. Existing service dependencies are already delivered. Do not restart or reset the shared local stack merely to clear these checks.

## Completion and review references

- Completed: Not completed — runtime validation and later scoped media integration remain open.
- Commit: User-requested checkpoint on 2026-10-18, subject `[DEV0315] Add coach website editing and draft previews`. The approved standalone example is committed separately as `a19f768` under DEV0338.
- Review: Commit preflight reran the 14 focused website/editor/rate tests successfully, verified scoped formatting/links and preserved unrelated workspace edits. Self-reviewed runtime changes against the criteria. No independent review; incomplete browser evidence is explicitly retained above.
- Deployment or release: None.

Commit isolation: the staged source contains the website editor and its integration only; unrelated authentication, navigation, session-type and demo-account edits are excluded. The owning DEV0315 index row is kept in Current records (it had been misplaced above that section in the shared HEAD index). No ticket identifier is retired by this correction.

2026-10-18 commit preflight: exported the exact staged source to `/private/tmp/movx-dev0315-staged-y49p89r8` with no populated environment/private journal files. In that snapshot, `npm run typecheck`, `node --import tsx --test tests/coach-website-editor.test.ts tests/coach-website.test.ts tests/coach-starting-rate.test.ts` (14 passed), and scoped ESLint over the editor/integration/test/companion/helper files passed. All 83 relative links in the two owning tickets, COR0028 and preview guide resolve. Preview JavaScript/server syntax and scoped Prettier also passed. No migration, browser mutation or broader reimplementation was needed for this checkpoint. Banner and remaining browser criteria stay open.
