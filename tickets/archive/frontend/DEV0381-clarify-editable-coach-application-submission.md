# Ticket DEV0381: Clarify editable coach application submission

- Status: Completed
- Created: 2026-10-19
- Last updated: 2026-10-19
- Milestone: UAT coach onboarding polish
- Coordination: None — independent development ticket
- Related records: [DEV0147 — Separate client onboarding and verified coach access](../../archive/backend/DEV0147-separate-client-onboarding-and-verified-coach-access.md) (historical authority contract); [DEV0379 — Correct coach name field height](../../archive/frontend/DEV0379-correct-coach-name-field-height.md) (prior editor presentation)

## Objective and context

The owner requested replacing Save coach profile with Submit application while keeping submitted applications editable. The pending-applicant editor already permits repeated owner updates but uses public-profile/draft language and a generic save button. Make the review submission and subsequent editing explicit. See [registration flow](../../../docs/mvp-spec.md#41-register-as-an-athlete-or-apply-to-coach) and [application state](../../../docs/mvp-spec.md#coach-application-and-review).

## Scope and non-goals

- In scope: State-aware applicant heading, button, progress, success and explanatory text; pending-review editability message; current specification; persistence regression assertions proving pending applications can be edited without changing identity/status or becoming public; local checks and desktop/mobile UAT release verification.
- Out of scope: New draft/submitted database states, moving the existing explicit onboarding application action, changing review/approval authority, approved-coach profile behavior, or editing real users' application content during validation.

## Expected behavior and edge cases

A pending applicant without saved coach details sees Submit application and Submitting… during the existing save action. Once details exist, the same editable form uses Save application changes and Saving…. Pending review never disables the form. Approved/demo coaches retain Save coach profile. Rejected applicants save application changes and use the existing separate Resubmit application control to request another review. Errors retain existing validation and entered values. Success text explains editable private application details; applicants receive no public-profile link.

## Assumptions, decisions, and dependencies

Existing onboarding already creates a pending application before profile details are completed. This ticket clarifies the form's role as submitting those details, without inventing a new persisted submission flag. A saved coach projection distinguishes first completion from subsequent edits. Backend owner authorization already permits pending/rejected edits and prevents public visibility before approval. Installed Next.js 16.3.8 bundled mutation documentation was read: preserve useActionState pending handling and existing server revalidation. No new package/configuration/schema dependency.

## Implementation plan

1. Update applicant-only editor labels and explanations, preserving the existing action and approved-profile controls; clarify the pending banner.
2. Document first submission and later editing in the current specification. Strengthen the existing local application integration test to assert private updates preserve the application and pending review state.
3. Run focused local database checks after verifying the test's synthetic accounts are absent, existing unit/server suites, scoped formatting, clean-source lint/types and hosted build. Do not provision or submit a real user's application for QA.
4. Commit only owned changes and release an exact-source Preview build to UAT in Frankfurt; inspect desktop/mobile labels, keyboard and native validation. Record evidence, archive the ticket and commit the final release record.

## Acceptance criteria

- [x] AC1: Initial pending application completion uses Submit application; later applicant edits use Save application changes, with truthful progress/success/help text.
- [x] AC2: Pending applications remain owner-editable, retaining identity and pending review status; publication and approved/rejected controls keep their existing authority.
- [x] AC3: Desktop/mobile UAT controls are readable and keyboard accessible; required-field validation still prevents incomplete submission without modifying real user data.
- [x] AC4: Relevant checks and hosted build pass, exact UAT source/region/alias are verified, and unrelated edits/configuration/data are preserved.

## Validation plan

Extend `tests/database/coach-application.test.ts` to save edited private details while pending and assert stable slug, submitted timestamp, pending state and absence from public reads. Run it only on loopback local Supabase with its two synthetic Auth IDs confirmed absent beforehand; never reset or migrate the shared database for this UI change. Run `npm test`, scoped Prettier, clean tracked-source `npm run lint` / `npm run typecheck`, and Vercel build. Inspect native UAT at desktop and 375×568, including Tab, empty-form native validation and still-enabled fields. Subsequent editing persistence is proved by the isolated local integration test, not fabricated real-account data.

## Implementation record

Implemented and verified locally and on UAT; all acceptance criteria passed.

### Changes and rationale

The initial pending-applicant form now says Submit application (Submitting… during the request), uses a send icon and explains that submission remains editable. Existing applicant profiles use Save application changes (Saving…). Headings and pending banners distinguish incomplete details from review-ready private details and explicitly permit further edits. Success text explains saved review details; pending/rejected applicants no longer receive an unusable public-profile link. Approved/demo coach labels, rejected applicants' separate resubmission control, validation, server actions and database authority remain unchanged.

### Affected files

- [Coach profile editor](../../../src/features/coaches/coach-profile-editor.tsx): state-aware applicant action, progress, success and helper text; keep approved profile action and applicant form editable.
- [Application banner](../../../src/features/coaches/coach-application-gate.tsx): use the existing coach projection to distinguish incomplete application details from a saved application under review, with explicit editability copy.
- [Application integration tests](../../../tests/database/coach-application.test.ts): prove owner updates preserve pending status, original submission time and slug while remaining absent from public discovery.
- [Specification](../../../docs/mvp-spec.md#41-register-as-an-athlete-or-apply-to-coach) and [index](../../README.md): record the current application presentation and delivery evidence.

### Decisions and deviations

None.

### Contracts, configuration, and operations

Presentation clarification and regression evidence only. The internal banner now receives a `hasProfile` boolean derived from the existing owner projection. No database schema, server action interface, review authority, dependency or environment changes. Existing pending application records remain compatible. UAT rollback re-aliases the preceding ready Preview deployment.

## Validation results

2026-10-19, local Node 24 / Next.js 16.3.8:

- `DATABASE_TEST_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres npx tsx --conditions=react-server --test --test-concurrency=1 tests/database/coach-application.test.ts`: 3 passed. A new assertion sequence edits a submitted private application and verifies persisted name/bio, stable slug and submittedAt, pending status and null public read. Existing approved, rejected, resubmitted, suspended and unauthorized review assertions also passed.
- `node work/dev0381/local-state.mjs before` / `after`: both synthetic Auth IDs absent before/after; exact row counts and content fingerprints match across eight existing identity, application, profile, discipline, location and participant tables. No reset/migration, retained-data repair or hosted database write.
- `npm test`: 350 unit and 64 server tests passed (414 total).
- `npm run lint` / `npm run typecheck`: passed in a clean tracked-source export with only DEV0381 source/test overlays, excluding unrelated working-tree edits and ignored scratch files.
- Scoped `npx prettier --check` passed for both changed components, the database test and ticket. `git diff --check` passed for source/test changes.
- Reviewed render conditions: pending review does not disable any form field; only an in-flight action disables submission. Required constraints and existing server action/revalidation remain unchanged. Approved/demo labels and rejected resubmission behavior are preserved.
- `npx --yes vercel@64.3.1 inspect movx-club-l7xylw4d2-hoangworldcoms-projects.vercel.app --logs --wait`: hosted build passed. Deployment API verified READY, Preview target, `fra1` and exact source commit `b146d54569740c88ec8ef1612cfc5e6f43f774ab` before alias assignment.
- Native Chrome desktop 1390×775: Submit your coach application heading, complete-application banner and explicit after-submission editing text rendered. The Submit application button and explanatory footer fit. Coordinate focus on display name followed by Tab moved to Biography. Submitting the untouched incomplete QA form scrolled to and focused required empty Biography without a saved result.
- Native Chrome responsive 375×568: reloaded only the owned single-tab QA page to reset emulation zoom; heading/help text fit, footer stacked and Submit application occupied the available width. Tapping it on the untouched incomplete form returned focus to empty Biography. Existing form fields remained editable. No profile, location or application details were submitted; the original multi-tab draft was not refreshed/changed, and the QA window was closed.
- `node work/dev0381/live-check.mjs`: seven unauthenticated UAT HTTP probes passed; staging returned HTTP 200. Alias verified to the new deployment. Before/after metadata for all five Preview environment entries match exactly.
- Final ticket links and unrelated working-tree preservation checks passed. Successful post-submission editing persistence is proved by the isolated local database test; no real user's application was completed for a live success-state rehearsal.

| Criterion | Evidence                                                                                                                                                                                      | Result |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Desktop/mobile initial action, heading and editability copy observed; state-aware later-edit/progress/success render conditions reviewed.                                                     | Passed |
| AC2       | Three local integration tests pass, including edited name/bio, stable slug/submission time, pending state and null public read; approved/rejected/suspended authority remains correct.        | Passed |
| AC3       | Desktop and phone action/help text fit; name-to-Biography Tab focus and native empty-Biography validation observed; inputs remain editable.                                                   | Passed |
| AC4       | 414 unit/server tests plus three database tests, clean-source lint/types, formatting and hosted build pass; exact UAT source/region/alias, environment metadata and unrelated edits verified. | Passed |

## Risks, limitations, and follow-ups

Live visual checks used the existing pending owner without saved coach details. Later applicant button/success states and approved/rejected controls were reviewed in code; the local integration test proves post-submission editing persistence and preserved authority. No real application was completed or overwritten for QA, and no shared UAT outage was induced. Local synthetic fixtures were removed and the eight recorded table fingerprints match their starting state. No Git push was performed; unrelated edits and independent DEV0374/DEV0375 records remain outside this ticket.

## Completion and review references

- Completed: 2026-10-19 — clear first submission and later-edit actions, persistent editability copy and regression proof delivered.
- Commit: `b146d54` — `[DEV0381] Clarify editable coach application submission`. Final release record commit is documentation only.
- Review: Self-reviewed changed source, tests and staged documentation against all criteria. No independent review or pull request created.
- Deployment or release: Live at `https://uat.movx.club`; alias verified to `dpl_4bgeA5WkZnbVqBeRXJjn4H7qcdzS` (`movx-club-l7xylw4d2-hoangworldcoms-projects.vercel.app`), Preview in Frankfurt (`fra1`), source `b146d54569740c88ec8ef1612cfc5e6f43f774ab`. Rollback re-aliases previous ready deployment `dpl_Cc5aC7X2TvEyb7xHbf7ZwfjcNhf8`.
