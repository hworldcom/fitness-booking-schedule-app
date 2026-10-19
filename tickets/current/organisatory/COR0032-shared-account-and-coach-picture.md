# Coordination COR0032: Shared account and coach picture

- Status: In progress
- Created: 2026-10-19
- Last updated: 2026-10-20
- Milestone: UAT coach application image continuity
- Converted from: Not applicable — created as a coordination record
- Tracked development tickets: [DEV0382](../../archive/backend/DEV0382-support-opt-in-shared-coach-pictures.md), [DEV0383](../frontend/DEV0383-select-and-preview-shared-coach-picture.md)
- Related records: [DEV0292](../../archive/backend/DEV0292-isolate-profile-image-storage-adapter.md) (Storage dependency); [DEV0381](../../archive/frontend/DEV0381-clarify-editable-coach-application-submission.md) (application editing baseline)

## Objective and boundaries

The owner uploaded an account picture and expected it on the coach page and preview, then explicitly chose the same picture for account and public coach identity. Coordinate explicit sharing, private pending previews, conditional public reads and coherent replacement/removal. Existing unrelated private account photos and retained coach images remain unchanged. This coordination record implements no runtime behavior.

## Direct development work

| Implementation part | Development ticket | Owned deliverable | Start condition or dependency |
| --- | --- | --- | --- |
| Persisted sharing choice, authorization, image projection, byte access and regression evidence | [DEV0382 — Support opt-in shared coach pictures](../../archive/backend/DEV0382-support-opt-in-shared-coach-pictures.md) | Additive migration; shared-picture reference/source; owner selection API; owner/public image reads with publication/reference checks; existing media projection compatibility; current specification and backend tests | Start immediately after scope review; no other ticket implements these parts |
| Owner controls, immediate previews and integrated UAT rollout | [DEV0383 — Select and preview shared coach picture](../frontend/DEV0383-select-and-preview-shared-coach-picture.md) | Owner choice UI; upload result propagation to both previews; existing separate portrait compatibility; local/native responsive validation; guarded UAT migration/source release; apply this owner's requested choice and verify current picture | UI may start after DEV0382 fixes its API/reference contract; rollout waits for its migration/backend validation |

All required direct tickets exist. The tickets are peers, not nested implementation records.

## Other relationships

DEV0292 supplies the existing request-scoped Storage facade; it is a dependency, not a direct member. DEV0381 supplies editable application behavior and is historical context. No account provisioning, coach approval, visibility publication, banner redesign or unrelated identity migration is included.

## Delivery sequence and completion conditions

Implement and validate DEV0382 first. DEV0383 integrates its API and may proceed once that contract is stable; keep source/migration release coordinated. Work is sequential in this checkout; no independent agent/branch delegation is requested. Complete this record only when both peers are Completed, UAT serves the exact integrated source with the additive migration, the owner's existing account picture appears in private coach/editor website previews, mobile/desktop checks pass, pending anonymous access remains denied, and preservation evidence accounts for the explicit owner picture-choice change only.

## Progress and integration record

2026-10-19: Investigation found separate private account avatars and approved-only public portraits. The owner has a saved pending coach application, no coach portrait and no saved banner; they confirmed the upload was the account picture and chose using it for both. Sharing must be explicit for each owner, with no backfill or automatic publication of other accounts' pictures. Backend and frontend/release slices allocated before implementation.

## Validation results

Pending. Each peer owns detailed implementation and validation evidence; this record will check reciprocal membership, unique ownership, link/status consistency and integrated UAT evidence.

## Risks, limitations, and follow-ups

Current private-avatar Storage access cannot simply be reused for public images without narrowly scoped opt-in/publication authorization. Preserve pending application privacy and recheck references after Storage I/O. New sharing must not alter legacy fixture/storage portraits or existing private avatar references.

## Completion and review references

- Completed: Not completed.
- Direct development tickets: DEV0382 Completed; DEV0383 In progress.
- Commit: Not applicable — coordination IDs are never commit subjects.
- Review: Integration self-review pending; no independent review requested.
- Deployment or release: Pending.
