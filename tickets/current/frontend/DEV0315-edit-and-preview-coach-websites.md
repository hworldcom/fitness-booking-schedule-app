# Ticket DEV0315: Edit and preview coach websites

- Status: Draft
- Created: 2026-10-17
- Last updated: 2026-10-18
- Milestone: M10 — Coach marketplace websites (planned)
- Coordination: [COR0028 — Coach marketplace cards and personal websites](../organisatory/COR0028-coach-marketplace-cards-and-personal-websites.md)
- Related records: Peer dependencies/consumers: [DEV0320](../../archive/organisatory/DEV0320-adopt-coach-marketplace-website-contract.md), [DEV0321](../../archive/backend/DEV0321-persist-coach-website-content-and-banners.md), [DEV0313](../backend/DEV0313-manage-coach-starting-prices-and-visibility.md), [DEV0317](DEV0317-build-shareable-personal-coach-websites.md), [DEV0319](../backend/DEV0319-rehearse-coach-marketplace-websites.md). External media: [DEV0297](../backend/DEV0297-add-coach-profile-photos-and-mux-video.md). Amendment: [DEV0330](../../archive/organisatory/DEV0330-refine-coach-marketplace-pricing-reviews-and-urls.md); username routing: [DEV0331](../backend/DEV0331-enable-username-based-public-coach-urls.md).

## Objective and context

Let an authorized coach prepare and preview the structured website without a separate website editor or exposing private account fields. The existing Profile editor does not manage M10 branding, content or a private offer.

Implement against the [M10 contract](../../../docs/mvp-spec.md#19-coach-marketplace-cards-and-personal-websites), especially [the relevant boundary](../../../docs/mvp-spec.md#195-owner-editing-and-media-sequence), [milestone](../../../docs/mvp-spec.md#12-delivery-milestones) and [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix). This ticket is future runtime work; the user requested tickets only on 17 October 2026.

## Scope and non-goals

- In scope: Coach Profile edit/preview for brand/banner/introduction/approach/focus/experience/qualifications/FAQs/links, owner-defined starting rate and explicit public show/hide setting, username-URL preview/claim guidance, save/cancel/draft/conflict recovery; later compose DEV0297 media controls after cards complete and media decisions are revisited.
- Out of scope: content/banner/rate persistence, username resolver/Account rename engine (DEV0331), gallery/Mux implementation or allowance/premium choices now, public website/card layout and private Account identity editing.

## Expected behavior and edge cases

Clearly separate public coach identity/content from private Account fields. Starting amount and disclosure are independent: hidden amounts remain visible only to their owner and absent in public preview. Show the current username URL or honest legacy/claim guidance using DEV0331 results. Preserve explicit save/cancel, retained error drafts, stale-tab recovery, existing locations/portrait and applicant/private publication gates. Optional new fields are not required for old profiles. Text/banner/rate/URL editing does not wait on media allowance; gallery controls are a later integration after cards.

## Assumptions, decisions, and dependencies

DEV0321 provides schema-version-1 content plus private banner preview/mutation APIs and one expected revision shared by text/banner; its content/banner backend prerequisite is delivered locally. Consume its documented contracts and conflict/recovery statuses without another media pipeline. Depends on the revised DEV0313 owner contracts; DEV0331 supplies URL/claim capability and keeps username ownership in Account. Foundations/editor may proceed before cards, but do not ask for or decide gallery/video allowances now. DEV0316 completes before that media review; later media-control composition consumes DEV0297 without duplicating its engine. Coordinate shared preview structure with DEV0317.

## Implementation plan

1. Inspect existing owner editor/actions/preview and installed integration docs; record public/private field ownership.
2. Add optional content/banner controls with explicit saved/draft preview and existing publication/location gates.
3. Add coach starting amount plus independent Show publicly control, and current username URL/claim guidance through owning services.
4. Preserve dirty/error drafts, save/cancel, revision conflicts and existing location/portrait behavior. Defer gallery/video choices and integration until cards complete.
5. Validate real owner save/reload/public privacy and desktop/mobile/keyboard recovery; later integrate only delivered authorized media controls.

## Acceptance criteria

- [ ] AC1: Owner can edit/save/cancel all optional public content and independently set/show/hide the starting rate with truthful saved/private preview.
- [ ] AC2: Username URL/claim guidance uses DEV0331 results, private Account names/avatar stay separate and applicant/hidden/unauthorized publication gates remain enforced.
- [ ] AC3: Validation/upload/save failures, stale revisions and concurrent tabs retain/recover drafts without partial publication or false success.
- [ ] AC4: Actual responsive/keyboard text/banner/rate/URL flows pass without media decisions; later gallery-control integration links DEV0297 evidence after cards and invents no allowance/premium rule.

## Validation plan

Use actual isolated owner/applicant/other-account profiles for content/banner save, zero/absent/paid starting rate and private/public toggles, public reload and missing/renamed username guidance. Check public preview excludes hidden rates and private names/avatar. Exercise stale tabs, invalid links, failed uploads/saves, cancel and retained drafts at phone/desktop widths by keyboard. Gallery/video questions do not block these checks; validate later authorized photo integration separately after cards. Run meaningful affected Profile/service tests, lint/typecheck/build during implementation.

## Implementation record

### Changes and rationale

2026-10-17 planning checkpoint: created this bounded Draft peer under COR0028. No feature code, data, provider settings or runtime validation changed. Implementation evidence remains pending.

### Affected files

The following are planned investigation/implementation areas, not a claim that they were edited:

| File or component                                                                                                             | Planned role                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [src/features/coaches/coach-profile-editor.tsx](../../../src/features/coaches/coach-profile-editor.tsx)                       | Existing public coach editor extension.                                       |
| [src/features/coaches/coach-profile-preview.tsx](../../../src/features/coaches/coach-profile-preview.tsx)                     | Truthful saved/draft preview composition.                                     |
| [src/features/coaches/coach-training-location-manager.tsx](../../../src/features/coaches/coach-training-location-manager.tsx) | Existing independent location editing must remain usable.                     |
| [src/app/profile/coach](../../../src/app/profile/coach)                                                                       | Coach Profile route family; inspect exact action entry points before editing. |

### Decisions and deviations

2026-10-17 user-review amendment (DEV0330): replace fixed private quotes/snapshots with coach-owned optional public starting rates; enforce one review per athlete–coach pair after a session; use username public URLs under DEV0331; finish cards before media-allowance decisions. Current scope/plan/criteria above supersede the initial defaults; runtime has not started.

No runtime decisions/deviations yet. Record exact contracts, concrete limits, migration/rollout order and any material scope change here before the affected implementation edit. Preserve unrelated work.

### Contracts, configuration, and operations

Planning changes only so far. Runtime interface/schema/dependency/environment, setup, compatibility, migration/rollback and cleanup changes remain to be recorded during implementation. No credentials or private data belong in this record.

## Validation results

- Date/environment: 2026-10-17 planning; documentation consistency only, with the final command evidence recorded in DEV0330.
- Runtime/application/database/browser/provider checks: Not run — feature implementation has not started.
- Failed/blocked runtime results: None observed; unmet start dependencies above remain prerequisites rather than passed checks.

| Criterion | Evidence                                                                    | Result  |
| --------- | --------------------------------------------------------------------------- | ------- |
| AC1–AC4   | Future runtime proof described above; none executed during ticket creation. | Not run |

## Risks, limitations, and follow-ups

Runtime remains Draft. Complete DEV0316 cards before revisiting photo/video allowance/premium questions. Later full website media integration still needs the authorized DEV0297 capability; those decisions do not block content/banner/rate/routing/card work. Preserve hidden starting-rate privacy, pair-review identity and safe username/legacy links. Next: satisfy stated service dependencies, inspect current docs and record concrete contracts before runtime edits.

## Completion and review references

- Completed: Not completed — Draft runtime work.
- Commit: Not created; ticket creation does not authorize a commit.
- Review: Planning scope/ownership self-review under DEV0320 and amended DEV0330 only; no independent or runtime review.
- Deployment or release: None.
