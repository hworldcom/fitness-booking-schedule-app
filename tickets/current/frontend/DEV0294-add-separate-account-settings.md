# Ticket DEV0294: Add separate account settings

- Status: In progress
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

- [ ] AC1: Account opens a separate protected settings page for athletes and coaches; Profile photo editing remains separate.
- [ ] AC2: Name/birthdate/gender save, clear and reload with owner isolation, validation, safe retry/stale revision and failure draft retention; no private-field leakage or authority/public-coach changes.
- [ ] AC3: Login & security uses current verified identity/session management; English is current and German Coming soon cannot switch language; no photo editing on Account.
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

- 2026-10-17 commit review, Node 24.21.0: `npm test` passed **219 application + 25 server tests (244 total)**, including the new account validation and route cases. The default sandbox and an equivalent Node invocation initially hit tsx child-process IPC permission errors; the authorized full run passed without changing test behavior.
- `npm run lint` and `npm run format:check` passed. A configuration-free isolated checkout at `/private/tmp/movx-commit-build-nlot34t_` passed `npm run build -- --webpack` (compile, TypeScript and all 17 static pages) and `npm run typecheck`. No populated environment files were copied and the active development build was preserved. A later-added API test was copied into that checkout for the final type-check; source implementation hashes remained unchanged.
- The 30 assertions in `supabase/tests/database/account-settings.test.sql` passed through local Docker PostgreSQL inside a rolled-back transaction. This covered forced row security, denied direct writes/browser execution, input bounds, exact retry versus conflict, optional-field clearing, wrong/forged actor denial and unchanged original identity/coach state. The table was already present at preflight. Before/after checks confirmed the table state and absence of the two exact test Auth IDs were preserved; no persistent database change was made by validation.
- Live account save/reload, interrupted-network recovery and full mobile/desktop/keyboard flow have not been verified in this commit review. Fresh-database migration installation, hosted rollout and a deployed UAT rehearsal were not performed. These remain required evidence; keep the ticket In progress.

| Criterion | Evidence                                                                                                                | Result                     |
| --------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| AC1       | Dedicated route/shell and section rendering checks pass; final live visual review remains.                              | Partial                    |
| AC2       | Contract, API and 30 SQL assertions pass for owner-only save/retry/privacy; real application save/reload proof remains. | Partial                    |
| AC3       | Current email-code security and static English/German Coming soon are covered by rendering tests.                       | Passed by automated review |
| AC4       | Application/static/build checks pass; required live responsive/recovery and rollout evidence remains open.              | Partial                    |

## Risks, limitations, and follow-ups

Password/social authentication remains COR0027. No translation is claimed. Preserve unrelated notes, invitations, migration, provider-recovery and authentication work. Native browser input has been unreliable; any missing required live evidence keeps this record open.

## Completion and review references

- Completed: Not completed.
- Commit: This user-authorized checkpoint: `[DEV0182][DEV0232][DEV0259][DEV0277][DEV0285][DEV0290][DEV0291][DEV0294] Checkpoint account settings and product plans`. Implementation remains In progress with required live evidence open; no hosted rollout/deployment is claimed.
- Review: Proposed scope reviewed as one bounded vertical slice; independent review not performed.
- Deployment or release: Not deployed; hosted migrations not performed.
