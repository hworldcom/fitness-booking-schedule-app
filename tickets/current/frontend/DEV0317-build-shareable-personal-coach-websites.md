# Ticket DEV0317: Build shareable personal coach websites

- Status: Draft
- Created: 2026-10-17
- Last updated: 2026-10-18
- Milestone: M10 — Coach marketplace websites (planned)
- Coordination: [COR0028 — Coach marketplace cards and personal websites](../organisatory/COR0028-coach-marketplace-cards-and-personal-websites.md)
- Related records: Peer dependencies/consumers: [DEV0320](../../archive/organisatory/DEV0320-adopt-coach-marketplace-website-contract.md), [DEV0321](../../archive/backend/DEV0321-persist-coach-website-content-and-banners.md), [DEV0313](../../archive/backend/DEV0313-manage-coach-starting-prices-and-visibility.md), [DEV0314](../../archive/backend/DEV0314-persist-booking-linked-coach-reviews.md), [DEV0315](DEV0315-edit-and-preview-coach-websites.md), [DEV0316](../../archive/frontend/DEV0316-redesign-coach-directory-cards.md), [DEV0318](DEV0318-add-athlete-coach-review-controls.md), [DEV0319](../backend/DEV0319-rehearse-coach-marketplace-websites.md). External media: [DEV0297](../backend/DEV0297-add-coach-profile-photos-and-mux-video.md). Amendment: [DEV0330](../../archive/organisatory/DEV0330-refine-coach-marketplace-pricing-reviews-and-urls.md); username routing: [DEV0331](../../archive/backend/DEV0331-enable-username-based-public-coach-urls.md).

## Objective and context

Expand the existing public coach biography/location/schedule page into the agreed structured personal website that a coach can share directly. This ticket owns full public pages separately from DEV0316 directory cards.

Implement against the [M10 contract](../../../docs/mvp-spec.md#19-coach-marketplace-cards-and-personal-websites), especially [the relevant boundary](../../../docs/mvp-spec.md#192-public-content-and-template), [milestone](../../../docs/mvp-spec.md#12-delivery-milestones) and [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix). This ticket is future runtime work; the user requested tickets only on 17 October 2026.

## Scope and non-goals

- In scope: personal coach website at the username route with brand/banner/introduction, optional disclosed starting rate, services, approach/experience/qualifications, later authorized gallery components, all locations, one-per-pair public reviews, FAQs/links, accessible section/action navigation and canonical metadata/sharing.
- Out of scope: directory cards, content/rate/review persistence, username resolution/aliases/Account claim engine (DEV0331), author review controls, fixed quotes/request-price history, gallery/Mux pipeline, username login, custom domains and media allowance decisions before cards.

## Expected behavior and edge cases

Visible coaches use the saved username canonical URL; DEV0331 supplies safe legacy/missing-handle/rename/alias behavior. Share previews contain only public fields and omit hidden starting amounts. Rates use Sessions start from wording without locked quotes; group prices and original schedule/message/group actions retain their separate contracts. Public reviews show one contribution per athlete–coach pair. Optional sections/failures, qualifications, all-location fallback and persistent navigation remain truthful and usable. Gallery/video allowance questions follow completed cards before later media integration.

## Assumptions, decisions, and dependencies

DEV0321 now supplies `PublicCoachProfileState.website` version-1 full optional content/banner projections and the public content/image APIs, with visibility/revision checks and truthful unavailable states. Its backend contract is delivered locally. DEV0313 adds optional `website.startingRate` with only disclosed public data and the formatted label. Hidden/missing amounts omit the field; page metadata, share controls and serialized props must consume this same public DTO and never the owner API. Starts after DEV0316 cards complete and DEV0313/DEV0314/DEV0331 public contracts pass; DEV0315 provides real authored content. DEV0331 owns route resolution/legacy/rename behavior, while this ticket owns page layout, canonical metadata and share controls. Revisit media allowance only after cards, then consume DEV0297's delivered authorized photo component for the full gallery outcome. No media-engine duplication, username-login or premium assumption. Existing group routes/data are consumed unchanged.

## Implementation plan

1. After cards complete, inspect route/profile/schedule/map/message/group consumers and installed metadata/image docs; agree public-only template and URL projection.
2. Build responsive website sections and unobstructive navigation from saved branding/content, disclosed starting rate and pair reviews.
3. Compose original schedule/location/group/message actions; after the later media decisions, integrate only delivered authorized photo components.
4. Use DEV0331 canonical username/legacy results for metadata, safe redirects/deep links and copy/share without private values or mutations.
5. Verify authored/legacy/hidden/unavailable/renamed URLs, hidden-price metadata/privacy, full photo integration and all responsive/keyboard/guest recovery cases.

## Acceptance criteria

- [ ] AC1: Saved public content forms the agreed personal website at a username canonical URL with safe legacy/missing-handle recovery and optional empty-section suppression.
- [ ] AC2: Only disclosed Sessions start from rates appear, hidden values stay out of public/share output, pair-review count/mean are correct, and actual group/schedule/message destinations retain authority.
- [ ] AC3: Username metadata/share URLs, rename/legacy navigation, FAQs/anchors and mobile/keyboard focus work without exposing private Account or booking fields.
- [ ] AC4: After cards and later media review, real authored/gallery/review/page evidence plus hidden/unavailable/map/media/guest-return cases pass; no peer pipeline is duplicated.

## Validation plan

After card completion, use actual authored/legacy coaches, public/no-handle/renamed/hidden username states, disclosed/hidden rates, multi-location schedules/groups and consented pair-review paging. Inspect public HTML/props/metadata/share payloads for hidden amounts and private identity. Check canonical/legacy/alias/date links, all five review widths, anchor/FAQ focus, map/media failures, safe guest returns and compose-without-send. Validate authorized gallery integration only after the deferred media decisions and delivered DEV0297 capability. Run affected browser/static/build checks during implementation.

## Implementation record

### Changes and rationale

2026-10-17 planning checkpoint: created this bounded Draft peer under COR0028. No feature code, data, provider settings or runtime validation changed. Implementation evidence remains pending.

### Affected files

The following are planned investigation/implementation areas, not a claim that they were edited:

| File or component                                                                                             | Planned role                                                         |
| ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| [src/app/coaches/[slug]/page.tsx](../../../src/app/coaches/[slug]/page.tsx)                                   | Existing route, public metadata and canonical service composition.   |
| [src/features/coaches/coach-discovery.tsx](../../../src/features/coaches/coach-discovery.tsx)                 | Existing CoachProfileView template extension.                        |
| [src/features/coaches/coach-profile-locations.tsx](../../../src/features/coaches/coach-profile-locations.tsx) | Preserved all-location map/list presentation.                        |
| [src/features/coaches/coach-marketplace.tsx](../../../src/features/coaches/coach-marketplace.tsx)             | Compose the existing schedule; indicative starting rates add no price gating or quote-lock flow. |

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
