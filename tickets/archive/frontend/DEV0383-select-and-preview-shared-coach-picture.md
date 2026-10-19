# Ticket DEV0383: Select and preview shared coach picture

- Status: Completed
- Created: 2026-10-19
- Last updated: 2026-10-20
- Milestone: UAT coach application image continuity
- Coordination: [COR0032 — Shared account and coach picture](../organisatory/COR0032-shared-account-and-coach-picture.md)
- Related records: [DEV0382](../backend/DEV0382-support-opt-in-shared-coach-pictures.md) (peer backend dependency); [DEV0381](../frontend/DEV0381-clarify-editable-coach-application-submission.md) (application editing baseline)

## Objective and context

Offer the owner the shared picture they requested, show it immediately in the coach page and both previews, and release the integrated backend/UI change to UAT. Use [profile-image privacy](../../../docs/mvp-spec.md#profile-images) and [owner preview behavior](../../../docs/mvp-spec.md#19-coach-marketplace-cards-and-personal-websites). Do not automatically opt in unrelated accounts.

## Scope and non-goals

- In scope: Explicit shared-picture UI available during application; clear private/published behavior; immediate portrait change propagation to coach/profile website previews without discarding unsaved edits; preserve existing approved separate portrait control; responsive/keyboard/error validation; guarded UAT migration and exact-source release; select sharing for the requesting signed-in owner's existing picture and verify it.
- Out of scope: Backend authorization, migrations and byte route implementation (DEV0382); coach approval or publication; changing account image bytes, banner or unrelated fields; other accounts' photo settings; retained demo provisioning.

## Expected behavior and edge cases

The owner can use the existing account picture and manage it from personal Profile. The private coach preview shows it while pending, and public display follows approval plus explicit publication. Later account-picture replacement/removal stays linked. Success and upload/removal results update both previews immediately while retaining unsaved text. Missing images, failed requests and changed account state show truthful controls and fallback. Existing separate coach portraits remain compatible.

## Assumptions, decisions, and dependencies

DEV0382 establishes the new source and request/response contract before UI integration. The user explicitly selected using the account picture for both on 19 October 2026; applying that choice to the currently signed-in pending owner is authorized, while approval and visibility remain unchanged. UAT migration needs a preserved-data snapshot and the dedicated hosted-dev target. Existing five Preview environment entries and staging project linkage remain intact.

## Implementation plan

1. Once DEV0382's API is stable, add a coach-picture settings panel, explicit sharing action/status and personal-picture edit link, retaining separate approved portrait uploads.
2. Propagate successful portrait changes into both previews locally, bound to the owner; preserve form/website drafts and actor refresh behavior.
3. Run focused UI/state and existing checks, native desktop/mobile keyboard/error validation and relevant integrated image checks.
4. Apply only the additive DEV0382 migration to UAT after preserving original references/data; deploy an exact-source Preview build in Frankfurt; select sharing for the requesting owner and verify private previews/bytes plus anonymous pending denial. Do not approve/publish or replace the real picture.
5. Record exact release, preserved records and limitations; complete/archive both peers and COR only when their respective criteria pass.

## Acceptance criteria

- [x] AC1: Owner can explicitly share their account picture during application and understand where to change it and when it becomes public.
- [x] AC2: Shared/updated/removed portraits refresh both coach previews without losing unrelated unsaved inputs; existing separate controls and failure states remain correct.
- [x] AC3: Desktop/mobile/keyboard checks pass; requesting owner's actual account picture appears in private coach previews after selection, with anonymous access still denied while pending.
- [x] AC4: Exact UAT source/migration/region/alias and preservation evidence are verified; required backend/UI checks and integrated release criteria pass.

## Validation plan

Use native Chrome desktop and 375×568 for settings, preview, keyboard and truthful errors. Test local image result/state propagation and retain existing text edits. Positive/negative real Storage checks depend on DEV0382. Before UAT rollout fingerprint existing application/profile/media references; permit only the user's explicit sharing fields, additive schema and normal release metadata to differ. Verify alias READY Preview/fra1/exact source, HTTP privacy probes, unchanged five environment entries and staging. Leave any original draft tab untouched; use a dedicated QA window. Do not provision or overwrite real account content.

## Implementation record

Implemented, released to UAT and verified on native desktop and phone layouts.

### Changes and rationale

A Coach picture panel is available during application. Owners explicitly choose their current account picture, see private-until-approved/published guidance and use the personal Profile link to change it. Stop sharing preserves account bytes. Approved/demo owners retain separate portrait uploads. Successful selection/upload/removal updates an owner-bound local portrait override used by both profile-card and website previews, without remounting their editors or discarding unsaved text. New server image/owner state expires stale overrides. Account upload/removal copy explains the linked effect and avoids falling back to the same removed shared image.

### Affected files

- [Picture settings](../../../src/features/coaches/coach-picture-settings.tsx): explicit opt-in/revocation, missing-image guidance, pending privacy, changed-account and truthful error states; preserves approved separate uploader.
- [Coach editor](../../../src/features/coaches/coach-profile-editor.tsx), [portrait override](../../../src/features/coaches/coach-portrait-preview.ts) and [tests](../../../tests/coach-portrait-preview.test.ts): update only the matching owner's photo in both previews and preserve other draft properties; discard override when fresh server state differs.
- [Image uploader](../../../src/features/profile/profile-image-uploader.tsx): successful image-change callback and shared-account copy/fallback.
- Ticket/index/coordination records: integrated release, preservation and native evidence.

### Decisions and deviations

2026-10-19: DEV0382 fixed its integration contract: POST/DELETE `/api/coach/portrait/account` accepts strict `{profileId}` JSON to bind the rendered coach owner and returns the existing bounded image-mutation snapshot, and an `account` portrait projects to a versioned `/api/coaches/portraits/PROFILE_ID` route. UI work starts against that contract while backend privacy/Storage validation continues; rollout still waits for it. Successful selection/upload/removal will update only an owner-profile-bound portrait override, keeping unsaved text intact.

### Contracts, configuration, and operations

Consumes DEV0382's opt-in API; migration and exact-source rollout are recorded below. Roll back UI only on a runtime retaining DEV0382 account-source parsers, policy and byte route. The source checkpoint can be rebuilt as Preview/fra1; do not alias the older DEV0381 runtime while account-source rows remain. No new environment variable or credential is planned.

## Validation results

Local integrated source: 422 unit/server tests (354 + 68), clean-source lint/types and scoped Prettier passed. Three preview helper tests prove unchanged unrelated draft references, different-owner isolation and newer-server/removal behavior. DEV0382's fresh production build plus seven real HTTP/Storage groups and six legacy database tests passed; its record discloses pre-existing broad database-lint failures. No original draft tab has been altered.

Hosted migration, release and native desktop/phone checks passed. Chrome initially switched to the original window; stopped input, requested one minute free and resumed after the owner confirmed availability. Selected the verified one-tab QA window through the Window menu; no original-tab content was changed.

- `npx supabase db query --project-ref mdzidiqosxbghmfyxphb --linked --file ... --output json` ran the guarded migration first with rollback, then commit. Both transactions verified expected previous migration `20261019000100`, the exact active Chimosa catalog and no existing account-source choice. New ledger `20261019000200` contains the reviewed migration. All 57 existing app/Auth-user/Storage-bucket/object table fingerprints matched before/after DDL; no data backfill.
- Exact source `5640d9ed4f1ede9ea1dbdc34044c5c376d481319` was exported with `git archive` outside the checkout and linked explicitly to `movx-club-uat`, keeping root staging linkage unchanged. Vercel CLI 64.3.1 `deploy --target preview --regions fra1 --yes --no-wait --meta releaseCommit=... --meta releaseTicket=DEV0383`, followed by `inspect --logs --wait`, produced READY deployment `dpl_9FJQEuEt8phJZkTVfVB6WGujJ89A` at `movx-club-3jhvioq1s-hoangworldcoms-projects.vercel.app`. API verification confirmed exact source, Preview target and Frankfurt before aliasing `uat.movx.club`. Five existing environment entries' IDs/keys/types/targets/update times stayed identical; no environment secret was logged.
- Native Chrome 1390×775, dedicated one-tab QA window: existing account photo rendered in the new panel. Entered `Hoang QA unsaved` in the name field without saving, then selected Use my account picture. Success status appeared; the real face rendered immediately in the private coach card and website preview. The unsaved name remained intact. Escape closed the website modal and restored Preview website focus. Original multi-tab draft window was untouched.
- Before/after opt-in snapshots normalized only coach portrait source/path/version and row update time. All 57 stable table fingerprints matched exactly, including applications, private avatar references, Storage bytes metadata, website/banner content, disciplines and locations. Exactly one coach portrait changed: requesting Hoang profile `016189ee-a53d-44a3-ae59-1a396ab4694c`, marker equals owner UUID, source account; visibility remains hidden. No approval, publication or actual image-byte replacement/removal.
- Anonymous HTTP probes on the alias: home 200; exact versioned shared-picture URL 404 with `private, no-store`; pending coach route 404; same-origin signed-out sharing POST 401. Native owner's rendered actual face proves private authorized access.
- Native phone emulation 375×568 at 50% device zoom: reloaded only the owned QA route to reset viewport scaling and discard the unsaved test name. Shared picture persisted; privacy text and full-width stacked actions fit. Actual face rendered in both private coach card and website hero; modal scroll stayed inside the viewport. Escape restored the Preview website button and Return reopened the modal. The user’s real picture was never replaced/removed. Closed only the one-tab QA window after the check. Screenshots: mobile-settings.png, mobile-website.png, mobile-card.png.
- Scoped source Prettier and `git diff --check` passed; record formatting and repository links checked at final handoff. No independent reviewer was requested.
- Evidence is ignored under `work/dev0383/`: migration dry-run/applied results, preservation before/after/result, deployment/config/HTTP JSON, desktop-card.png and desktop-website.png. `work/dev0383/check-unrelated.py` confirms initial unrelated README/spec/browser-test edits and staging project bytes remain unchanged.

Backend compatible checkpoint: `4649717` (DEV0382). The old DEV0381 runtime is not a safe rollback after new account-source opt-ins; retain the backend checkpoint's parsers/API if rolling back UI.

| Criterion | Evidence                                                                                                            | Result |
| --------- | ------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Explicit choice and privacy copy; actual owner selected successfully                                                | Passed |
| AC2       | Three state tests, actual preserved unsaved name, immediate two previews, real backend transition/error groups      | Passed |
| AC3       | Actual face in desktop and 375×568 phone card/website, stacked controls and Escape/Return; pending anonymous denial | Passed |
| AC4       | Guarded 57-table preservation, READY exact-source Preview/fra1/alias, unchanged environment/staging, privacy probes | Passed |

## Risks, limitations, and follow-ups

Block rollout if migration/byte authorization is unverified. Preserve original unsaved tabs. User-authorized photo sharing does not authorize coach approval, automatic publication or other accounts' image changes.

## Completion and review references

- Completed: 2026-10-20.
- Commit: Source `5640d9e`; backend `4649717`.
- Review: Self-reviewed acceptance evidence, source scope, privacy probes, preservation and release metadata; no independent review requested.
- Deployment or release: READY `dpl_9FJQEuEt8phJZkTVfVB6WGujJ89A`, exact source `5640d9e`, Preview/fra1; `https://uat.movx.club`.
