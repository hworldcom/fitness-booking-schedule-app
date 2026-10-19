# Ticket DEV0384: Identify coach website validation errors

- Status: In progress
- Created: 2026-10-20
- Last updated: 2026-10-20
- Milestone: UAT coach website editing usability
- Coordination: None — independent development ticket
- Related records: [DEV0315](../../archive/frontend/DEV0315-edit-and-preview-coach-websites.md) (editor baseline); [DEV0383](../../archive/frontend/DEV0383-select-and-preview-shared-coach-picture.md) (current UAT baseline)

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

- [ ] AC1: Each invalid editable field/numbered FAQ/link/focus line is identified with a concrete correction, using unchanged validation rules.
- [ ] AC2: Inline errors and a linked/focused summary are accessible; multiple problems appear together and correction/removal updates them without losing input or altering revision recovery.
- [ ] AC3: Regression tests, clean-source lint/types, build and native desktop/mobile/keyboard evidence pass; no actual user content is saved during QA.
- [ ] AC4: Exact UAT source/Preview/fra1/alias and unchanged environment/staging/saved-content evidence are recorded; unrelated working changes preserved.

## Validation plan

Extend real domain behavior tests and editor error presentation/accessibility checks. Check an extra empty FAQ with existing valid content, partial FAQ, duplicate labels, malformed/HTTP/credential URL, overlong/invalid text and correcting/removing rows. Run `npm test`, focused tests, clean exported-source `npm run lint`/`npm run typecheck`, scoped Prettier and hosted build. Native desktop and 375×568 phone checks use unsaved QA rows and Cancel. Fingerprint UAT stable app/profile/media rows and exact website revision before/after; no migrations or database writes are required. Test signed-out/visibility behavior only if changed.

## Implementation record

Implemented locally; release and native responsive validation are in progress.

### Changes and rationale

The shared domain validator now collects structured field/message issues in the same pass that constructs normalized content. The existing parser delegates to that validator, preserving server/client agreement and rejection rules. A save attempt shows every current problem in a focused alert summary with links that focus the exact field, and beside that field with aria-invalid/describedby. Empty FAQ 2 reports its question and answer independently and tells the owner to complete or remove FAQ 2. Errors revalidate during correction/removal; Cancel discards only the editor draft. Browser URL validation no longer hides other errors behind a native popup; shared validation handles all content fields together. Banner/rate and revision/conflict/access-loss controls remain unchanged.

### Affected files

- [Domain content validator](../../../src/domain/coach-website.ts): typed field/message diagnostics, existing normalization/constraints and parser delegation.
- [Website editor](../../../src/features/coaches/website/coach-website-editor.tsx): failed-save summary focus, live correction feedback, field IDs/ARIA and existing draft/recovery behavior.
- [Error components](../../../src/features/coaches/website/website-content-errors.tsx) and [styles](../../../src/features/coaches/website/coach-website-editor.css): numbered summary links, associated inline messages, wrapping/mobile controls and focus/invalid styling.
- [Validation tests](../../../tests/coach-website.test.ts) and [presentation tests](../../../tests/coach-website-errors.test.ts): multiple blank/partial rows, correction/removal, duplicate/line/Unicode/URL/malformed input, normalization and accessible summary/inline linkage.
- [Specification](../../../docs/mvp-spec.md#192-public-content-and-template) and index: record the direct field/row feedback contract.

### Decisions and deviations

2026-10-20: Preserve every existing acceptance/rejection and normalization rule; do not silently discard empty rows. All diagnostics omit raw input values, including unsafe URL login details. Native QA will cancel every temporary draft without submitting valid content.

### Contracts, configuration, and operations

No migration, new dependency, environment setting or API response change planned. Structured domain diagnostics are an internal client/server shared interface.

## Validation results

- `npx tsx --test tests/coach-website.test.ts tests/coach-website-editor.test.ts tests/coach-website-errors.test.ts`: 16 passed. Covers the reported empty extra FAQ, four concurrent missing fields, correction/removal without input mutation, exact normalized duplicate line numbers, Unicode character bounds, invalid characters, HTTPS constraints, malformed content and summary/inline ARIA targets. Existing revision/conflict/recovery tests passed unchanged.
- `npm test`: 359 unit and 68 server tests passed (427 total).
- `npm run lint` passed in a clean tracked-source export with owned overlays; `npm run typecheck` passed there after capturing the narrowed input in a stable record for a nested helper (initial type check caught that narrowing issue). Scoped Prettier and source `git diff --check` passed. Hosted build, native responsive/keyboard and release/preservation checks remain in progress.
- No database migration or persistence interface change; database integration mutation tests are not required for this presentation/diagnostics change. Existing server tests and parser-bound tests verify the shared validation path.

| Criterion | Evidence | Result  |
| --------- | -------- | ------- |
| AC1       | Pending  | Not run |
| AC2       | Pending  | Not run |
| AC3       | Pending  | Not run |
| AC4       | Pending  | Not run |

## Risks, limitations, and follow-ups

Do not diverge diagnostic rules from authoritative parsing or remove invalid rows silently. Server-only malformed request failures remain bounded recovery responses; do not claim success on a rejected or uncertain save.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: Self-review pending; no independent review requested.
- Deployment or release: Pending.
