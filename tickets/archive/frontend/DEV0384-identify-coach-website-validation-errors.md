# Ticket DEV0384: Identify coach website validation errors

- Status: Completed
- Created: 2026-10-20
- Last updated: 2026-10-20
- Milestone: UAT coach website editing usability
- Coordination: None — independent development ticket
- Related records: [DEV0315](../frontend/DEV0315-edit-and-preview-coach-websites.md) (editor baseline); [DEV0383](../frontend/DEV0383-select-and-preview-shared-coach-picture.md) (current UAT baseline)

## Objective and context

An owner added an empty FAQ and received a generic list of possible causes when saving. Identify every actual website-content issue by field and numbered row, let the owner reach the problem directly, and retain their draft. Follow [website content bounds](../../../docs/mvp-spec.md#192-public-content-and-template), [definition of done](../../../docs/mvp-spec.md#11-definition-of-done) and the owner-editor acceptance scenario.

## Scope and non-goals

- In scope: Shared content-validation diagnostics using the existing validation rules; inline field errors, linked/focused error summary, correction/removal behavior; meaningful validator/accessibility regressions; native desktop/mobile checks and an exact-source UAT release.
- Out of scope: Changing accepted field limits, silently dropping blank rows, new API/data/schema contracts, banner/rate validation redesign, publishing/approving coaches, saving real-account test drafts or editing retained data.

## Expected behavior and edge cases

Saving a draft with multiple problems reports all affected fields and row numbers, including blank/partial FAQs, duplicate/empty/overlong focus labels, incomplete/unsafe external links and text limits/invalid characters. An empty added FAQ is invalid until completed or explicitly removed. Show associated field errors and an accessible summary with controls that focus each field. Revalidate after correction/removal once save has been attempted; clear errors when edits are cancelled or saved. Keep unsaved input and existing revision/conflict/access-loss recovery. Optional sections with no rows remain valid.

## Assumptions, decisions, and dependencies

Use the existing domain parser as the single source of validation rules and expose safe field/message diagnostics from the same pass; no input values or arbitrary server messages are injected as HTML. Keep server API responses unchanged. Native QA uses a dedicated window, creates only unsaved invalid rows, and cancels them without saving the owner's content. Prior authorization covers commits and UAT releases. Next 16.3.8 bundled integration guidance was inspected; no framework API change is planned.

## Implementation plan

1. Review existing content parser and editor; expose structured diagnostics while preserving parser output, normalization and rejection rules.
2. Render all current issues beside their fields and in a keyboard-accessible summary; focus the summary on failed save and focus the referenced field from a summary action. Preserve all drafts and recovery controls.
3. Add regression cases for complete/empty rows, multiple issues, Unicode limits, normalized duplicates, unsafe links and successful correction/removal. Update current specification to state the direct-feedback behavior.
4. Run focused/full tests, clean-source lint/types, formatting and build; release exact source to dedicated UAT Preview/fra1 with unchanged environment/staging configuration. Verify desktop/phone/keyboard and unchanged saved content/revision around unsaved QA; complete/archive this record.

## Acceptance criteria

- [x] AC1: Each invalid editable field/numbered FAQ/link/focus line is identified with a concrete correction, using unchanged validation rules.
- [x] AC2: Inline errors and a linked/focused summary are accessible; multiple problems appear together and correction/removal updates them without losing input or altering revision recovery.
- [x] AC3: Regression tests, clean-source lint/types, build and native desktop/mobile/keyboard evidence pass; no actual user content is saved during QA.
- [x] AC4: Exact UAT source/Preview/fra1/alias and unchanged environment/staging/saved-content evidence are recorded; unrelated working changes preserved.

## Validation plan

Extend real domain behavior tests and editor error presentation/accessibility checks. Check an extra empty FAQ with existing valid content, partial FAQ, duplicate labels, malformed/HTTP/credential URL, overlong/invalid text and correcting/removing rows. Run `npm test`, focused tests, clean exported-source `npm run lint`/`npm run typecheck`, scoped Prettier and hosted build. Native desktop and 375×568 phone checks use unsaved QA rows and Cancel. Fingerprint UAT stable app/profile/media rows and exact website revision before/after; no migrations or database writes are required. Test signed-out/visibility behavior only if changed.

## Implementation record

Implemented, released to UAT and verified with retained-data preservation.

### Changes and rationale

The shared domain validator now collects structured field/message issues in the same pass that constructs normalized content. The existing parser delegates to that validator, preserving server/client agreement and rejection rules. A save attempt shows every current problem in a focused alert summary with links that focus the exact field, and beside that field with aria-invalid/describedby. Empty FAQ 2 reports its question and answer independently and tells the owner to complete or remove FAQ 2. Errors revalidate during correction/removal; Cancel discards only the editor draft. Browser URL validation no longer hides other errors behind a native popup; shared validation handles all content fields together. Banner/rate and revision/conflict/access-loss controls remain unchanged.

### Affected files

- [Domain content validator](../../../src/domain/coach-website.ts): typed field/message diagnostics, existing normalization/constraints and parser delegation.
- [Website editor](../../../src/features/coaches/website/coach-website-editor.tsx): failed-save summary focus, live correction feedback, field IDs/ARIA and existing draft/recovery behavior.
- [Error components](../../../src/features/coaches/website/website-content-errors.tsx) and [styles](../../../src/features/coaches/website/coach-website-editor.css): numbered summary links, associated inline messages, wrapping/mobile controls and focus/invalid styling.
- [Validation tests](../../../tests/coach-website.test.ts) and [presentation tests](../../../tests/coach-website-errors.test.ts): multiple blank/partial rows, correction/removal, duplicate/line/Unicode/URL/malformed input, normalization and accessible summary/inline linkage.
- [Specification](../../../docs/mvp-spec.md#192-public-content-and-template) and index: record the direct field/row feedback contract.

### Decisions and deviations

2026-10-20 native review: FAQ field feedback, summary focus, keyboard navigation and correction passed on UAT. The HTTPS field still grouped several URL rules in one message; refine it to report the actual protocol, missing address, length, spaces/backslashes, login-details or domain/parse cause before final release, preserving acceptance rules.

2026-10-20: Preserve every existing acceptance/rejection and normalization rule; do not silently discard empty rows. All diagnostics omit raw input values, including unsafe URL login details. Native QA will cancel every temporary draft without submitting valid content.

### Contracts, configuration, and operations

No migration, new dependency, environment setting or API response change planned. Structured domain diagnostics are an internal client/server shared interface.

## Validation results

- `npx tsx --test tests/coach-website.test.ts tests/coach-website-editor.test.ts tests/coach-website-errors.test.ts`: 17 passed after the URL-cause refinement. Covers the reported empty extra FAQ, four concurrent missing fields, seven individual URL causes, correction/removal without input mutation, exact normalized duplicate line numbers, Unicode character bounds, invalid characters, HTTPS constraints, malformed content and summary/inline ARIA targets. Existing revision/conflict/recovery tests passed unchanged.
- `npm test`: 360 unit and 68 server tests passed after refinement (428 total).
- `npm run lint` passed in a clean tracked-source export with owned overlays; `npm run typecheck` passed there after capturing the narrowed input in a stable record for a nested helper (initial type check caught that narrowing issue). Scoped Prettier and source `git diff --check` passed. Final refined-source clean lint/types and scoped formatting passed again; final hosted build and URL-message verification passed as recorded below.
- Local production build: `npm run prebuild` followed by `npx next build --webpack` passed in the clean-source export before the URL-only refinement. Hosted source `aeca996` also built successfully; its READY Preview/fra1 deployment `dpl_CZ2wtdDiy6WDFT1qYjqxyv9n7LkN` was verified before aliasing UAT. Vercel initially stayed in Initializing for several minutes; one exact-source forced retry `dpl_CUsUisRXNdpq4LsQRytxi6WM54fQ` was created, but the original completed first and was the deployment selected. Final URL-refinement release is verified below.
- Native Chrome desktop 1390×775 and phone emulation 375×568: in a disposable `?qa=DEV0384` tab, added empty FAQ 2 after the owner's valid FAQ 1 and attempted Save. Both actual fields appeared in the summary and inline; desktop summary received focus. Tab twice + Return focused the missing answer. Filling the two temporary fields removed their errors without saving; valid FAQ 1 and all other text remained. Added a blank link, checked simultaneous label/address errors and HTTP rejection. On phone both numbered messages wrapped within the viewport, summary link reached the missing answer, and explicit removal of FAQ 2 cleared the errors. Cancelled every draft, closed DevTools and only the disposable tab; all original tabs remain. Evidence: ignored desktop-summary.png, desktop-inline.png, mobile-summary.png and mobile-inline.png under `work/dev0384/`.
- `node work/dev0384/verify-preservation.mjs`: all 57 complete UAT table fingerprints, website revision 2 and migration version matched exactly before/after unsaved desktop/phone QA. Five environment metadata entries and the root staging project linkage were unchanged.
- Native environment limitation: a new one-tab window showed stale/blank page rendering and focus switched to another window. After the owner confirmed Chrome was free, closed only that blank QA window and used a new disposable tab in the existing working window; this resolved the browser rendering issue. No original draft tab was reloaded or edited.
- No database migration or persistence interface change; database integration mutation tests are not required for this presentation/diagnostics change. Existing server tests and parser-bound tests verify the shared validation path.

| Criterion | Evidence                                                                                   | Result |
| --------- | ------------------------------------------------------------------------------------------ | ------ |
| AC1       | Shared parser diagnostics, 17 focused tests and actual numbered FAQ/link errors            | Passed |
| AC2       | Desktop focused summary/Tab/Return, phone links and live correction/removal/cancel         | Passed |
| AC3       | 428 tests, clean lint/types, scoped formatting, local/hosted builds, desktop/phone         | Passed |
| AC4       | Exact READY Preview/fra1/alias; unchanged five env entries, staging and all 57 data hashes | Passed |

- Final exact source `31e4b79e504f46dc076b1ef358652a2a5ec151a5` was exported with `git archive` outside the checkout, linked explicitly to the dedicated UAT project and deployed with Vercel CLI 64.3.1 `deploy --target preview --regions fra1 --yes --no-wait --meta releaseCommit=... --meta releaseTicket=DEV0384`. `inspect --logs --wait` passed its hosted Next 16.3.8 production build. Vercel API confirmed READY, Preview target, Frankfurt and exact source for `dpl_yzpa1L7xQG8xCqSPvaM78nkyfLxb` (`movx-club-7rb66exxj-hoangworldcoms-projects.vercel.app`) before aliasing `uat.movx.club`. Original first implementation source was `aeca996`; only domain URL diagnostics/tests/record changed for the final source, so the mobile FAQ/editor evidence remains applicable.
- On that exact final alias, a new disposable tab with an empty link label and `http://example.com` produced both specific errors: Link 1 label is empty, and Link 1 address must use HTTPS. No other URL checklist appeared. The summary received focus and all saved text remained intact. Cancelled and closed only the QA tab. Screenshot: ignored `work/dev0384/final-url-summary.png`.
- Final `node work/dev0384/vercel-state.mjs final` comparison: alias points to the exact READY deployment; all five environment metadata entries' IDs, keys, types, targets and update times match the original baseline. Staging project bytes remain unchanged. No environment values or credentials were logged.
- A final explicit-target read-only Supabase snapshot after the last native QA matched all 57 complete table fingerprints, exact website revision 2 and migration `20261019000200`. This includes saved content, banner/avatar/shared-picture references, applications, locations and other accounts. No valid Save was submitted; no database migration, provisioning, approval or publication occurred.
- Scoped Prettier, source/staged `git diff --check`, ticket links and original README/spec/index/browser-test/staging preservation checks passed. Only the owned source/tests/contract/ticket/index changes were staged. No Git push or production release.

## Risks, limitations, and follow-ups

No outstanding acceptance work. Server-only malformed request and banner/rate failures retain their existing bounded recovery messages; the new field diagnostics cover editable website content. Database integration mutation tests/lint were not rerun because schema/persistence/authorization did not change. Mobile evidence uses native Chrome responsive emulation; physical-device testing and independent review were not performed. Rollback can re-alias a previous compatible runtime such as the shared-picture release `5640d9e`, without a database rollback or changing saved content.

## Completion and review references

- Completed: 2026-10-20; all acceptance and release checks passed.
- Commit: `aeca996` initial diagnostics and `31e4b79` specific URL causes; final documentation commit uses DEV0384.
- Review: Self-reviewed validation parity, safe diagnostics, accessibility, draft/revision behavior, source scope, preservation and release evidence; no independent review requested.
- Deployment or release: UAT `https://uat.movx.club`, READY Preview/fra1 deployment `dpl_yzpa1L7xQG8xCqSPvaM78nkyfLxb`, exact source `31e4b79e504f46dc076b1ef358652a2a5ec151a5`.
