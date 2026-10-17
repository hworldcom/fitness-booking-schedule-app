# Ticket DEV0294: Add separate account settings

- Status: Blocked
- Created: 2026-10-17
- Last updated: 2026-10-17
- Milestone: M3 — Account interface refinement
- Coordination: None — independent development ticket
- Related records: [DEV0290](DEV0290-add-account-navigation-dropdown.md) supplies the uncommitted shared dropdown baseline; [COR0027](../organisatory/COR0027-login-registration-and-social-authentication.md) owns future password/social authentication, independently of this page.

## Objective and context

Account currently opens personal Profile, whose main function is photo editing. The user requested a separate Account page: Airbnb account-settings is the long-term layout reference, while Everfit's small personal-settings set defines initial scope. The user explicitly excluded photo editing here and confirmed editable name, optional birthdate and gender now, with password management deferred to planned authentication work. They additionally requested English/German language presentation, with German Coming soon and no switching. Follow [identity privacy](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity) and [account navigation](../../../docs/mvp-spec.md#9-scheduling-behavior-and-permissions).

## Scope and non-goals

- Add protected `/account` with responsive section navigation and divided settings rows for Personal details, Login & security and Language.
- Persist personal display name and optional birthdate/gender through owner-only server/database operations. Keep email read-only and sourced from verified Auth; personal details do not edit the separate public coach profile.
- Account dropdown and signed-in Account status link open `/account`. Personal Profile and existing photo management remain separately accessible through the existing sidebar.
- English is current; German is labelled Coming soon and unavailable. No locale change, preference persistence or translation runtime.
- No photo uploader on Account, email changes, password implementation, deletion, billing, tax, notification, privacy-management or reference-product assets/features. No hosted migration/deployment.

## Expected behavior and edge cases

Every authorized athlete/coach uses the same personal page. Personal details load only for the exact verified actor; unavailable data is never an invented empty/saved record. Optional fields can be cleared. Name follows existing 2–80-character identity bounds; birthdate must be a real past/current date; gender is optional bounded text rather than an eligibility/authority flag. Explicit Edit/Save/Cancel preserve unsaved input on validation, stale-save or temporary failure. Optimistic revision prevents lost updates; exact unchanged retries succeed. Account changes clear former private data/drafts. Saved display name refreshes header identity without changing public coach name, booking snapshots, authority, email or image. Security explains email-code sign-in and links to current session management; it offers no fake password button. German cannot be activated. Desktop/mobile and keyboard layout remain usable with visible focus.

## Assumptions, decisions, and dependencies

Confirmed choices are distinguished above from implementation defaults: `/account` route, three real sections and a dedicated settings shell with a Profile return link; optional free-text gender (80 characters), optional birthdate from 1900 through current UTC date; display name normalization matches enrollment. Private optional details use a separate owner-scoped table, avoiding leakage through existing broad profile projections. A bounded database function changes only the current actor's personal display name; no generic profile UPDATE grant. This is one vertical account-settings slice, with its necessary API/schema/UI/validation; no coordination split is required. Password ownership remains COR0027. Next 16.3.8 bundled pages/layouts and Link docs were reviewed before route integration.

## Implementation plan

1. Add private owner-only personal-details storage/read/save with revision checks, strict input and same-origin bounded request validation; preserve existing identities and projections.
2. Build the separate responsive settings page and editing states, existing email/session navigation and static language presentation, without photo controls.
3. Retarget Account entries and preserve photo Profile. Give `/account` its own compact Home/Messages/account header and settings section navigation, replacing the general workspace sidebar/demo strip/footer/mobile bar on this route so it follows the Airbnb structure without two sidebars. Update specification and index.
4. Verify validation/privacy/revision/actor cases with meaningful tests, isolated migration checks, types/lint/build and native desktop/mobile/keyboard/error review. Record limitations accurately.

## Acceptance criteria

- [x] AC1: Account opens a separate protected settings page for athletes and coaches; Profile photo editing remains separate.
- [ ] AC2: Name/birthdate/gender save, clear and reload with owner isolation, validation, safe retry/stale revision and failure draft retention; no private-field leakage or authority/public-coach changes.
- [x] AC3: Login & security uses current verified identity/session management; English is current and German Coming soon cannot switch language; no photo editing on Account.
- [ ] AC4: Desktop/mobile, keyboard and unavailable states are verified, required automated checks pass, and durable records are complete.

## Validation plan

Use focused input/DTO/render/navigation tests and rollback-only database tests for owner isolation, invalid/forged input, stale/retry behavior and unchanged identities/coach/image fields. Apply the new migration to an isolated transaction before local installation; preserve existing data and never migrate hosted services. Run relevant tests, lint, typecheck, format/diff/link checks and a configuration-free isolated build. Native browser checks cover section navigation, editing/save/cancel/reload, keyboard, unavailable and desktop/phone layouts. No external account form is submitted during reference review.

## Implementation record

### Changes and rationale

Implemented the separate `/account` destination and compact settings shell. The shared account dropdown opens Account rather than the photo-oriented `/profile`; the existing Profile remains available for image editing. Personal details allow validated display-name changes and optional birthdate/gender with revision-based conflict handling. Login/security truthfully describes the current email-code method; English is current and German is labelled Coming soon.

The new owner-scoped database functions resolve identity from the verified actor, return bounded private fields and preserve the account's Auth ID, slug, avatar and coach state. Save operations have exact-retry recovery and reject stale altered submissions; direct browser/runtime table writes remain denied. This is an implementation checkpoint, not completed live validation.

### Affected files

- `src/account/contracts.ts`: bounded input/response validation, calendar-date handling and private field contracts.
- `src/app/account/page.tsx`, `src/features/account/account-settings.tsx`, `src/components/account-shell.tsx` and `src/app/account-settings.css`: protected destination, personal-details editor, truthful security/language sections and dedicated responsive shell.
- `src/app/api/account/route.ts`, `src/server/account/service.ts` and `src/server/db/account/repository.ts`: no-store owner reads, same-origin/size-bounded writes and verified-actor database operations.
- `src/server/db/schema/account.ts`, schema exports and `supabase/migrations/20261017000500_private_account_settings.sql`: forced-private details/revision storage and guarded read/save functions.
- `src/components/account-menu.tsx`, `src/auth/client/auth-status-link.tsx`, shared shell/layout and affected navigation tests: Account routing and integration with existing public/private/Messages navigation.
- `tests/account-settings.test.ts`, `tests/server/account-settings-route.test.ts` and `supabase/tests/database/account-settings.test.sql`: validation/rendering, bounded API behavior and owner/privacy/conflict/retry SQL checks.

### Decisions and deviations

2026-10-17 reference inspection: live Everfit accessibility showed Name, Birthdate, Gender and Password settings, plus the explicitly excluded image control. Airbnb `/account-settings` screenshot showed a left settings-category column, right personal-data rows separated by rules, and row-level actions. Adopt that structure with only the supported MOVX sections. Do not copy private reference account values or assets. User then confirmed personal editing now/passwords later and added static English/German language scope.

### Contracts, configuration, and operations

Adds owner-only optional birthdate/gender/revision data and a bounded display-name mutation, with a private `/api/account` contract and protected `/account` view. No new dependency, environment variable, translation runtime or hosted operation. The migration requires an explicit environment rollout before its functions are available. The local pre-check found its table already installed; this commit's database check did not install or roll back any persistent migration. Removal/rollback must be a reviewed forward change that accounts for saved personal data.

## Validation results

- Environment: 2026-10-17, Node 24.21.0, Next 16.3.8, local Docker Supabase and localhost:3100. No external settings form submitted; no reference private values copied.
- Passed `node --import tsx --test tests/account-settings.test.ts tests/account-menu.test.ts tests/message-shell.test.ts tests/shell-navigation.test.ts tests/profile-navigation.test.ts`: 24 focused checks.
- Passed `npm test`: 219 application + 25 server checks (244 total); output `/tmp/movx-dev0294-tests.log`. This includes API cases for cross-origin, wrong content type, malformed JSON, streamed oversized bodies, invalid UTF-8 and forged target fields, all denied without private-data responses. The first full run found two source-layer violations; moving AccountShell to shared components and SQL to its database repository resolved them. A focused date-format expectation and test children-prop lint issue were also corrected before the passing checks.
- Passed `npm run typecheck`, focused ESLint on all new/changed implementation and tests, focused Prettier and `git diff --check`.
- Passed `node scripts/database-baseline.mjs verify`: 53 original migration hashes and frozen baseline unchanged.
- Passed 30 committed pgTAP checks in [account-settings.test.sql](../../../supabase/tests/database/account-settings.test.sql), first with the new migration inside one rollback-only local transaction and then against the installed local schema. `/tmp/movx-dev0294-database-check.mjs` and `/tmp/movx-dev0294-check-installed.mjs` orchestrated those exact checks. The pre-install rehearsal confirmed all 39 existing app tables were unchanged and the new table absent after rollback. Missing actor, forged profile, other-actor reads, direct writes, invalid/future fields, stale/altered writes, exact retry, clearing/reload and unchanged identity/avatar/coach data passed. Initial rehearsal-harness issues (identifier quoting and test-role access to pgTAP) were corrected; assertions run after restoring the test role while runtime reads/saves remain explicit. Test users/rows were rolled back.
- Local installation: `node /tmp/movx-dev0294-install.mjs`, guarded exact seven-version ledger, atomic migration/ledger insertion and 42 unchanged source table fingerprints; exact installed SQL rechecked. Runtime-role read of the current local review account returned a valid owner-only DTO; only validation booleans/field keys were logged.
- Passed configuration-free isolated production build: explicit Node 24 with `node_modules/next/dist/bin/next build --webpack` in `/var/folders/97/qxdkjfmj0_l4w87jnk_rsq6w0000gq/T/movx-dev0294-build-37sy12g6`; compilation, TypeScript, 17 static pages and traces succeeded. Populated environment files were excluded, required service settings blank and the live development `.next` untouched.
- Local unauthenticated HTTP checks: `/account` returned 307 to `/sign-in?returnTo=%2Faccount`; `/api/account` returned 401 with JSON. No browser cookies or credentials read for these checks.
- Native Chrome desktop at 1390×768: confirmed separate left settings navigation, personal detail rows, compact Home/Messages/account header, read-only current method, English active/German Coming soon and absence of photo editor/general workspace chrome. An initial unavailable details state exposed Try again without invented personal values; a fresh post-migration route render loaded the existing local Max account with both optional fields Not provided. Edit focused Name. Entering `M` and Save displayed the bounds error while retaining `M`; restoring the original `Max` and saving produced Personal details saved, returned display mode and restored Edit focus. This save left original name and absent optional values unchanged; it created the expected first private revision for the local test account.
- Mobile preview: native DevTools confirmed Responsive width 375/height 812, and a screenshot showed the stacked layout; a later observed iPhone 16 Pro Max preset was 440×956 at 25% fit scale. These previews confirm the mobile arrangement, not a complete mobile editing/keyboard/scroll/overflow proof. Native AX inputs intermittently lagged or dropped characters and pointer input failed with `noWindowsAvailable`; no attempted input is counted as a passed transition. Required complete phone interaction, Cancel/Tab/section navigation, conflict/temporary-save draft recovery and actor-change UI checks remain unverified.
- Cleanup: confirmed device toolbar Value 0, restored original undocked DevTools preference, closed only the task's DevTools window and returned to local Account. No external account form, message or credential was submitted; existing browser tabs were preserved. Account remains available for manual review.

| Criterion | Evidence                                                                                                                                                                 | Result  |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| AC1       | Separate route, authorized role render tests, direct desktop Account view, signed-out redirect and shared route integration.                                             | Passed  |
| AC2       | 30 DB checks, strict DTO/API cases, live invalid draft retention and successful save/focus; remaining conflict/temporary-save and actor-change browser evidence pending. | Partial |
| AC3       | Live desktop sections and automated render prove current method/read-only identity and static English/German labels; no photo editor or password/switch control.         | Passed  |
| AC4       | 244 tests, types/lint/format, isolated build and desktop flow passed; phone/complete keyboard/recovery proof pending.                                                    | Partial |

2026-10-17 subsequent refinement: [DEV0295](DEV0295-refine-account-names-and-section-navigation.md) supersedes the original Name editor/stacked anchor sections with private Legal name, preferred chat first name, separately reserved login username and one selected panel. This baseline record retains its earlier scope/evidence and outstanding checks; the follow-up owns its changed behavior and proof.

## Risks, limitations, and follow-ups

Implementation, local migration, 244 application/server checks, 30 database checks, isolated build and desktop edit/validation/save/focus evidence are present. This record remains current/Blocked because native browser input is intermittent and complete required mobile/keyboard/recovery evidence is missing. Next action with reliable input: verify phone editing, Cancel and focus restoration, section links and retained header/scroll bounds; exercise stale-conflict and temporary-save failure with draft retained, and actor/session change clearing. Review Account menu navigation from each header alongside DEV0290's outstanding disclosure evidence. Complete/archive only when these checks pass.

Password/social authentication remains COR0027; German remains a static Coming soon entry. No translation, hosted migration or release is claimed. Preserve independent notes, invitations, provider/recovery and authentication work. A concurrent workspace action created the checkpoint below while validation was continuing; this turn did not alter or recreate it.

## Completion and review references

- Completed: Not completed.
- Commit: This user-authorized checkpoint: `[DEV0182][DEV0232][DEV0259][DEV0277][DEV0285][DEV0290][DEV0291][DEV0294] Checkpoint account settings and product plans`. Implementation remains Blocked with required live evidence open; no hosted rollout/deployment is claimed.
- Commit record update: User-authorized 2026-10-17 checkpoint `[DEV0294][DEV0295][DEV0296][DEV0299] Refine account settings and workspace controls` includes the detailed local validation/handoff above and links to the subsequent DEV0295 refinement; original implementation commit is preserved.
- Review: Self-reviewed against scope/criteria, owner-data and public-coach separation, same-origin/body bounds, revision locking/retry, actor-keyed draft lifetime and current Auth/locale limits. Independent review not performed.
- Deployment or release: Not deployed; hosted migrations not performed.
