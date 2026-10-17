# Ticket DEV0299: Simplify gender and workspace account controls

- Status: Completed
- Created: 2026-10-17
- Last updated: 2026-10-17
- Milestone: M3 — Account settings and authenticated workspace
- Coordination: None — independent development ticket
- Related records: Historical baselines [DEV0294](../../current/frontend/DEV0294-add-separate-account-settings.md), [DEV0295](../../current/frontend/DEV0295-refine-account-names-and-section-navigation.md), [DEV0290](../../current/frontend/DEV0290-add-account-navigation-dropdown.md).

## Objective and context

The user requested Male/Female Gender choices and removal of the duplicate Account status button from athlete/coach workspace headers because the dropdown already provides Account access. Follow the [account/navigation contract](../../../docs/mvp-spec.md#9-scheduling-behavior-and-permissions).

## Scope and non-goals

Replace the optional free-text editor with a native Male/Female select and Not provided (clear). Use mutually exclusive dropdown/authentication controls in ordinary headers. Preserve Messages and private navigation. Update specification and regressions. No authentication, username, localization, profile media or database redesign.

## Expected behavior and edge cases

Gender stays private and optional. Existing save/cancel, revision conflicts and retained error drafts apply. Preserve previous free text through unrelated edits using a disabled current-value option; users can deliberately replace or clear it. Unauthorized actors retain the existing auth recovery control. Authorized athletes/coaches keep dropdown Account/My sessions access.

## Assumptions, decisions, and dependencies

Male/Female choices and one workspace account dropdown are confirmed user choices. Retaining Not provided and legacy values are implementation defaults. The nullable text API/database stays compatible; no migration is needed. Depends on existing DEV0295 editor and DEV0290 dropdown; their outstanding validation is recorded separately. Reviewed before implementation: one small frontend refinement, no split needed.

## Implementation plan

1. Add an accessible native gender field and extend current input styles to selects.
2. Share mutually exclusive menu/auth rendering between public and ordinary workspace headers.
3. Update specification and meaningful rendered-control regressions; run relevant tests, types, lint, format and browser review at desktop/mobile widths with keyboard use.
4. Record evidence and handoff; archive only after required validation passes.

## Acceptance criteria

- [x] AC1: Gender offers Male, Female and clear; existing commands save/reload the choice and preserve legacy values through unrelated edits.
- [x] AC2: Athlete/coach workspace headers contain the dropdown without a duplicate Account status link; unauthorized recovery remains.
- [x] AC3: Desktop/mobile layout, keyboard selection, save/cancel and dropdown access work.

## Validation plan

Rendered-control tests cover selection/legacy compatibility and header actor states. Existing account command/server tests cover persistence shape and field isolation. Run application/server tests, typecheck, focused ESLint/Prettier and production build as appropriate. Use native browser tools for desktop/mobile keyboard and save/cancel review. New database checks are not applicable because persistence is unchanged.

## Implementation record

### Changes and rationale

Gender now uses a native optional select with Male, Female and Not provided. Its controlled value uses the existing Personal details draft and save command. A previous free-text value is a disabled selected compatibility option, so opening the editor or saving other details does not erase it. No new free-text entry is offered.

Ordinary public/workspace headers now share one actor-aware account control: an authorized actor gets the existing avatar/menu dropdown, and other states get the unchanged authentication fallback. This removes the workspace's extra signed-in Account status link while retaining Messages, sidebar/bottom navigation and menu destinations. Dedicated Account/Messages shells keep their existing equivalent behavior.

### Affected files

| File | Role |
| --- | --- |
| [account-gender-field.tsx](../../../src/features/account/account-gender-field.tsx) | Labelled native select, clear behavior and nondestructive legacy option. |
| [account-settings.tsx](../../../src/features/account/account-settings.tsx) | Connects the select to the existing isolated Personal details draft. |
| [account-settings.css](../../../src/app/account-settings.css) | Gives selects the same width, spacing and touch-sized height as other account fields. |
| [header-account-control.tsx](../../../src/components/header-account-control.tsx) | Mutually exclusive authorized dropdown or authentication fallback. |
| [shell.tsx](../../../src/components/shell.tsx) | Uses the shared account control in public and ordinary private headers. |
| [account-controls.test.ts](../../../tests/account-controls.test.ts) | Four regression tests for selection, old values, actor variants and recovery. |
| [MVP specification](../../../docs/mvp-spec.md#9-scheduling-behavior-and-permissions) | Records the user-requested choices and single workspace account control. |

### Decisions and deviations

2026-10-17: Preserve personal data and compatible persistence; the request for UI choices does not require a data migration.

### Contracts, configuration, and operations

No API, schema, dependencies, environment variables or setup changes. Gender remains nullable text for compatibility; new UI choices persist as Male/Female and clear to null. Existing validation, owner-only visibility, revisions and error recovery are unchanged. No migration or rollback data operation is required. The existing DEV0295 forward migration remains a prerequisite for that earlier account feature; this ticket introduces none.

## Validation results

2026-10-17 commit review: `npm test` passed 227 application + 25 server tests (252 total), `npm run typecheck` and focused ESLint passed, all 13 affected implementation files matched the passing DEV0299 isolated production build, the forward migration matched its recorded installed SHA-256, and all 53 immutable-history/baseline checksums plus account ticket links passed. Logs: `/tmp/movx-account-commit-tests.log`, `/tmp/movx-account-commit-types.log`, `/tmp/movx-account-commit-lint.log`. No application or migration source changed during this commit review; earlier unresolved browser criteria remain explicitly open in their own records.

2026-10-17, Node 24.21.0, Next 16.3.8, local running application at localhost:3100 with its existing local test athlete.

- `node --import tsx --test tests/account-controls.test.ts tests/account-settings.test.ts tests/account-menu.test.ts tests/shell-navigation.test.ts`: 25 passed. New four-test suite re-run after correcting the test fixture's coach status from `none` to the domain's `not-applied`: 4 passed.
- `npm test`: 227 application and 25 server tests passed (252 total); output `/tmp/movx-dev0299-tests.log`.
- `npm run typecheck`: passed. First run caught the incorrect test fixture status above; fixed before the passing re-run.
- `npx eslint src/components/header-account-control.tsx src/components/shell.tsx src/features/account/account-gender-field.tsx src/features/account/account-settings.tsx tests/account-controls.test.ts`: passed.
- `npx prettier --check src/components/header-account-control.tsx src/components/shell.tsx src/features/account/account-gender-field.tsx src/features/account/account-settings.tsx src/app/account-settings.css tests/account-controls.test.ts`: passed.
- Isolated production build: `/Users/hoangdeveloper/.local/node/24.21.0/bin/node node_modules/next/dist/bin/next build --webpack` passed in `/var/folders/97/qxdkjfmj0_l4w87jnk_rsq6w0000gq/T/movx-dev0299-build-joih509l`; output `/tmp/movx-dev0299-build.log`. Copied source/config only, symlinked installed dependencies, excluded env files and blanked service configuration; live development output was untouched.
- Native Chrome desktop review at 1390×768: select exposes exactly Not provided/Male/Female. Keyboard Down/Return selects Male; Tab/Return saves, restores Edit focus and displays saved Male. Full reload retained Male. Female draft followed by Cancel restored Male.
- Native Chrome iPhone 16 Pro Max preview at 440×956: stacked account layout, editor and native options work. Selected/saved Female, then cleared via Not provided and saved with keyboard. Original test account gender restored to empty; legal name, preferred-name override and birthdate stayed empty, effective name stayed Max. No real personal details were entered.
- Workspace review at both widths: Messages and one account-menu trigger remain, with no signed-in Account status link. Menu opens Account/My sessions; following My sessions works. Desktop Return opens, Tab reaches Account, Escape hides links and restores trigger focus. Phone menu dismissal also restored focus. Automated header rendering covers athlete, approved/demo/suspended coaches and all four unauthorized actor states; a separate coach sign-in was not needed for this shared actor-aware control.
- Native scroll automation returned `noWindowsAvailable` once; recovered with a fresh local AX observation and completed the same clear/save flow using keyboard. No application error observed. Restored preview scale, disabled device mode and closed only this task's local developer-tools window. User-owned external browser tools were untouched.
- Database migration tests: not applicable; no persistence changes. No deliberate network-failure injection or new auth/database recovery rehearsal; existing account tests and prior records cover unchanged paths.

| Criterion | Evidence | Result |
| --- | --- | --- |
| AC1 | Choice/legacy rendered tests, command regressions and live Male save/reload, Female save and clear | Passed |
| AC2 | Actor-state tests and live My sessions header at desktop/phone widths | Passed |
| AC3 | Native keyboard save/cancel/menu/focus and desktop/440px layout review | Passed |

## Risks, limitations, and follow-ups

Legacy text remains supported by persistence and displayed only to its owner until changed; the UI offers no new free-text entry. No hosted deployment or independent review was performed. Earlier account/dropdown tickets retain their own broader validation scope. No unresolved acceptance criterion remains for this refinement.

## Completion and review references

- Completed: 2026-10-17 — implementation and required local validation passed.
- Commit: User authorized committing on 2026-10-17; included in `[DEV0294][DEV0295][DEV0296][DEV0299] Refine account settings and workspace controls`.
- Review: Self-review against all three criteria passed; no independent review.
- Deployment or release: Not deployed.
