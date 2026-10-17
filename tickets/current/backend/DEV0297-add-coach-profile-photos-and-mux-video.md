# Ticket DEV0297: Add coach profile photos and Mux video

- Status: Draft
- Created: 2026-10-17
- Last updated: 2026-10-17
- Milestone: M3 — Coach profile media extension (planned)
- Coordination: None — independent development ticket
- Related records: Independent Storage boundary work [DEV0292](../../archive/backend/DEV0292-isolate-profile-image-storage-adapter.md); independent recovery rehearsal [DEV0293](DEV0293-rehearse-database-auth-and-file-recovery.md); historical coach Profile interface [DEV0207](../../archive/frontend/DEV0207-redesign-account-and-coach-profiles.md).

## Objective and context

2026-10-17 later user sequence (documented under [DEV0330](../../archive/organisatory/DEV0330-refine-coach-marketplace-pricing-reviews-and-urls.md)): finish [DEV0316 directory profile cards](../frontend/DEV0316-redesign-coach-directory-cards.md) first. Defer clarification of picture/video allowance and premium eligibility until after that card milestone. Preserve the existing confirmed selections and open questions below; none is a start/completion dependency for the separate cards. Revisit them before this affected media implementation, then supply the later website/gallery integration.

Let coaches present themselves and their training through a photo gallery and a short preview video on their coach profile. The delivered profile supports a public portrait, but has no workout-photo gallery or preview-video upload flow. Control storage, visitor data usage and delivery costs while preserving profile visibility and private account media.

Use the [confirmed decisions](../../../docs/mvp-spec.md#2-confirmed-target-and-decisions), [profile image contract](../../../docs/mvp-spec.md#profile-images), [provider boundaries and recovery](../../../docs/mvp-spec.md#61-provider-boundaries-and-operational-recovery), [M3 milestone](../../../docs/mvp-spec.md#12-delivery-milestones) and [definition of done](../../../docs/mvp-spec.md#11-definition-of-done).

The user requested a ticket only on 2026-10-17. This is a planning checkpoint; feature implementation has not started.

## Scope and non-goals

- In scope for the future feature: coach-owned gallery upload, ordering, replacement and removal; bounded image processing and delivery; one Mux preview video with upload/processing/preview/publication/replacement/removal states; responsive owner and public profile presentation; authoritative quotas, ownership and visibility checks; usage monitoring and provider setup documentation.
- Out of scope: implementation during this planning request, a social feed, workout libraries, long-form or live video, changing private-avatar behavior, unrelated profile redesign, subscription billing, checkout or selecting a premium price.

## Expected behavior and edge cases

- A coach may have up to **six photos of themselves/their training** and **one preview video of at most 60 seconds**. These are maximum allowances; adding media is optional. Confirm how the six-photo allowance relates to the existing portrait before implementation.
- Only the authorized coach owner can manage their media. Public delivery follows existing coach approval/profile visibility rules. Private account avatars and unpublished media must not become public through the gallery or provider playback links.
- Enforce media count, duration and upload limits on the server/provider processing path, including concurrent uploads and replacements. A video exactly 60 seconds long is allowed; a processed duration above 60 seconds is rejected. Browser checks alone are insufficient.
- Video progresses through upload, processing and ready/failed states. Publish only a verified ready asset. Failed uploads, invalid duration and interrupted processing provide retry/removal paths. Keep an existing published asset until its replacement is ready; clean up abandoned and replaced provider assets without deleting the current asset after a stale callback.
- Photos need responsive display sizes that preserve their aspect ratio, with metadata stripped and large originals kept off public page delivery. Validate source types, file sizes and decoded image dimensions before processing.
- Proposed data-saving defaults: thumbnail-first click-to-play video, no automatic video preloading on listings, lazy-loaded gallery images and cached immutable image variants. Final encoding, captions/accessibility and measurable data budgets remain planning work.

## Assumptions, decisions, and dependencies

### Confirmed by the user

- Use **Mux** for video processing, storage and streaming.
- Allow up to **six coach photos** and **one video up to 60 seconds** per coach profile.
- **Whether video is a premium feature remains unresolved and must be explicitly clarified.** Provider selection and upload limits do not settle who is entitled to use video.

### Required decisions before the affected implementation

1. **Premium eligibility:** decide whether video is available to all eligible coaches or only coaches with premium access. If premium is selected, define upload, publication, playback and replacement permissions, plus what happens to an existing video when access expires or is downgraded. Record the choice in the specification before implementing video access rules. Identify any separate entitlement/billing work; this ticket does not introduce subscriptions by assumption.
2. **Photo allowance and publication:** confirm whether the six gallery photos are additional to the existing portrait, and define draft/publication behavior within existing coach authority.
3. **Media budgets and retention:** choose accepted formats, source byte/pixel limits, upload rate limits, image sizes/quality, video quality tier/resolution, captions and source/master retention for export and recovery. Proposed starting points are existing Supabase Storage for photos, WebP display variants and 720p video; these are not additional user-confirmed constraints.

Keep provider SDK/configuration and Mux callback handling behind server-only adapters. Application-owned asset identity, quotas, ownership and publication rules belong outside those adapters. Reuse DEV0292's Storage boundary when available; resolve its dependency before changing shared Storage integration. DEV0293 owns the broader disaster-recovery rehearsal; this feature must document and validate its own media export/reference recovery contract.

## Implementation plan

1. Resolve the required decisions above and update the specification, acceptance criteria and scope. Review delivery size before runtime edits; if several independent implementation tickets are needed, follow the repository's DEV-to-COR conversion rule before implementation rather than creating child DEV records.
2. Inspect current owner/public Profile routes, image normalization/storage, database authority and installed integration documentation. Design bounded asset records and server-enforced quotas with safe upload reservations and replacement handling.
3. Add the photo gallery processing/storage flow using the existing Storage provider boundary, preserving portrait/avatar permissions and immutable variant naming.
4. Integrate authenticated direct Mux uploads, verified provider callbacks, authoritative duration/readiness checks, playback access, deletion, retry and orphan cleanup behind a video adapter. Document environment separation and credential setup without recording secrets.
5. Add coach media controls and public gallery/video views with clear progress/failure states, keyboard access, responsive images, thumbnail-first playback and the adopted eligibility behavior.
6. Validate permissions, quota races, processing/replacement recovery, real Mux upload/playback/deletion, data budgets and desktop/mobile behavior. Record setup, export/restore, rollback and usage-monitoring evidence before completion.

## Acceptance criteria

- [ ] AC1: The specification records the resolved video premium decision, relevant access-loss behavior, photo allowance interpretation and processing/retention budgets before the affected implementation begins.
- [ ] AC2: Eligible coach owners can manage up to six photos and one Mux video up to 60 seconds; unauthorized operations, over-limit duration and concurrent quota bypass fail without publishing invalid media.
- [ ] AC3: Public media follows current coach visibility/approval and adopted video eligibility rules; unpublished/private media, account avatars and unrelated owners remain inaccessible.
- [ ] AC4: Real uploads, processing callbacks, retries, replacement and deletion recover truthfully; duplicate or stale callbacks cannot publish an invalid asset, remove the current asset or multiply the allowed media count.
- [ ] AC5: Desktop/mobile and keyboard flows pass, including progress/error states and accessible media presentation; measured image/video delivery meets the adopted quality/data budgets and avoids unnecessary automatic downloads.
- [ ] AC6: Provider integration remains behind the adopted boundaries; environment setup, usage alerts, retention, asset export/reference recovery and cleanup/rollback are documented and verified for this feature.

## Validation plan

- Planning checkpoint: check new ticket/index/specification links, ID allocation, Draft status and consistency of confirmed versus unresolved choices; run scoped whitespace checks. Application tests are not applicable to ticket creation.
- Runtime work later: focused image/video/service/route and database tests for owner/visibility/eligibility checks, six-photo/one-video limits, authoritative duration and quota races, callback authenticity/idempotency and replacement cleanup. Include exact-60-second and over-60-second fixtures.
- Prove a real isolated development Mux upload, processing, playback, failed/rejected upload and deletion; keep production credentials/data separate. Measure delivered media with representative fast-moving workout footage and a throttled mobile connection.
- Exercise desktop/mobile widths, keyboard operation, captions/alternatives, upload interruption, retry and retained current media after replacement failure. Verify exported media and restored references resolve in an isolated target according to the adopted retention contract.
- Run relevant existing tests, lint, type checks and build after implementation; validate migrations and constraints when schema changes exist. Exact commands and results must be recorded then.

## Implementation record

### Changes and rationale

2026-10-17: Created this Draft planning record at the user's request. Recorded Mux, six photos and one video up to 60 seconds as confirmed choices, and highlighted premium eligibility as unresolved. Added the selected future scope to the specification and linked this record from the index. No media feature, provider account or hosted configuration was changed.

### Affected files

| File | Change and purpose |
| ---- | ------------------ |
| [This ticket](DEV0297-add-coach-profile-photos-and-mux-video.md) | Future scope, open product decisions, implementation outline and pending acceptance evidence. |
| [Specification](../../../docs/mvp-spec.md#2-confirmed-target-and-decisions) | Confirmed future media selection/limits and explicit premium decision boundary. |
| [Ticket index](../../README.md) | Draft record and next available DEV ID. |

### Decisions and deviations

2026-10-17: Create planning only. Keep runtime criteria pending and avoid choosing a free/premium entitlement or adding billing implicitly. Compression quality, resolution and photo/portrait allowance interpretation remain proposals or open questions. No deviation from the ticket-only request.

### Contracts, configuration, and operations

This checkpoint changes planning documents only. No runtime interface, schema, migration, dependency, environment variable, secret, storage object, Mux account or deployment changed. Final media records/provider setup and migration/rollback steps remain to be designed before runtime implementation.

## Validation results

- Date/environment: 2026-10-17, repository documentation review.
- Passed scoped `python3 - <<'PY'` documentation checks: three documents, 307 repository-relative links and 27 heading anchors resolved; 208 unique DEV/COR records; next IDs DEV0298/COR0028; this ticket's required sections, independent membership, single Draft index row and confirmed-versus-pending choices agree with specification C43.
- Passed `git diff --check -- docs/mvp-spec.md tickets/README.md tickets/current/backend/DEV0297-add-coach-profile-photos-and-mux-video.md` and a direct Python check of the new untracked ticket's trailing whitespace, final newline, Draft status and unresolved premium decision. Planning content self-review passed; unrelated account settings edits were preserved.
- Commit preparation: include only this Draft record, specification C43 and the corresponding index/ID-allocation metadata. Independently allocated DEV0295–DEV0296 and DEV0298 remain reserved and their work is excluded from this checkpoint; the current next IDs are DEV0299/COR0028. Application tests are not applicable to these documentation-only changes.
- Passed `python3 /tmp/dev0297-validate-staged.py`: the staged snapshot contains exactly three media-planning documents, 305 local links, 27 anchors and 206 unique records; Draft status, pending premium decision, reserved IDs and scope isolation are consistent. Passed `git diff --cached --check`. These commit checks use the staged snapshot rather than the separate account/banner work in the working tree.
- Runtime acceptance checks: Not run — only a Draft ticket was requested; premium eligibility and other required decisions remain open.

| Criterion | Evidence | Result |
| --------- | -------- | ------ |
| AC1 | Confirmed choices and required decisions are separated above; the premium decision is still unresolved. | Pending decision |
| AC2–AC6 | Future validation is specified; no feature implementation or provider setup has started. | Not run |

## Risks, limitations, and follow-ups

**Premium access is not decided.** Next action: after DEV0316 profile cards complete, revisit video eligibility/access-loss, picture allowance, media budgets/retention and scope ownership before affected media implementation. Do not ask for those decisions or block the cards now. Preview-video costs depend on delivered minutes, selected quality and buffering; monitor real usage rather than treating earlier estimates as a spending commitment. This Draft does not establish working uploads, recovery proof or deployment readiness. Preserve unrelated account settings work in the shared workspace.

## Completion and review references

- Completed: Not completed — Draft planning record only.
- Commit: User-authorized planning checkpoint with subject `[DEV0297] Plan coach profile photos and Mux video`; no runtime feature implementation is included.
- Review: Planning self-review only; no independent review.
- Deployment or release: None.
