# Ticket DEV0383: Select and preview shared coach picture

- Status: In progress
- Created: 2026-10-19
- Last updated: 2026-10-20
- Milestone: UAT coach application image continuity
- Coordination: [COR0032 — Shared account and coach picture](../organisatory/COR0032-shared-account-and-coach-picture.md)
- Related records: [DEV0382](../../archive/backend/DEV0382-support-opt-in-shared-coach-pictures.md) (peer backend dependency); [DEV0381](../../archive/frontend/DEV0381-clarify-editable-coach-application-submission.md) (application editing baseline)

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

- [ ] AC1: Owner can explicitly share their account picture during application and understand where to change it and when it becomes public.
- [ ] AC2: Shared/updated/removed portraits refresh both coach previews without losing unrelated unsaved inputs; existing separate controls and failure states remain correct.
- [ ] AC3: Desktop/mobile/keyboard checks pass; requesting owner's actual account picture appears in private coach previews after selection, with anonymous access still denied while pending.
- [ ] AC4: Exact UAT source/migration/region/alias and preservation evidence are verified; required backend/UI checks and integrated release criteria pass.

## Validation plan

Use native Chrome desktop and 375×568 for settings, preview, keyboard and truthful errors. Test local image result/state propagation and retain existing text edits. Positive/negative real Storage checks depend on DEV0382. Before UAT rollout fingerprint existing application/profile/media references; permit only the user's explicit sharing fields, additive schema and normal release metadata to differ. Verify alias READY Preview/fra1/exact source, HTTP privacy probes, unchanged five environment entries and staging. Leave any original draft tab untouched; use a dedicated QA window. Do not provision or overwrite real account content.

## Implementation record

Pending implementation.

### Changes and rationale

Pending.

### Affected files

Pending.

### Decisions and deviations

2026-10-19: DEV0382 fixed its integration contract: POST/DELETE `/api/coach/portrait/account` accepts strict `{profileId}` JSON to bind the rendered coach owner and returns the existing bounded image-mutation snapshot, and an `account` portrait projects to a versioned `/api/coaches/portraits/PROFILE_ID` route. UI work starts against that contract while backend privacy/Storage validation continues; rollout still waits for it. Successful selection/upload/removal will update only an owner-profile-bound portrait override, keeping unsaved text intact.

### Contracts, configuration, and operations

Consumes DEV0382's opt-in API; rollout and rollback details pending. No new environment variable or credential is planned.

## Validation results

Pending.

| Criterion | Evidence | Result |
| --- | --- | --- |
| AC1 | Pending | Not run |
| AC2 | Pending | Not run |
| AC3 | Pending | Not run |
| AC4 | Pending | Not run |

## Risks, limitations, and follow-ups

Block rollout if migration/byte authorization is unverified. Preserve original unsaved tabs. User-authorized photo sharing does not authorize coach approval, automatic publication or other accounts' image changes.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: Self-review pending; no independent review requested.
- Deployment or release: Pending.
