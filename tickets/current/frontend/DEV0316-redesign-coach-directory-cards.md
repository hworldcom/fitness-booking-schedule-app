# Ticket DEV0316: Redesign coach directory cards

- Status: Draft
- Created: 2026-10-17
- Last updated: 2026-10-18
- Milestone: M10 — Coach marketplace websites (planned)
- Coordination: [COR0028 — Coach marketplace cards and personal websites](../organisatory/COR0028-coach-marketplace-cards-and-personal-websites.md)
- Related records: Peer dependencies/consumers: [DEV0320](../../archive/organisatory/DEV0320-adopt-coach-marketplace-website-contract.md), [DEV0321](../../archive/backend/DEV0321-persist-coach-website-content-and-banners.md), [DEV0313](../../archive/backend/DEV0313-manage-coach-starting-prices-and-visibility.md), [DEV0314](../../archive/backend/DEV0314-persist-booking-linked-coach-reviews.md), [DEV0315](DEV0315-edit-and-preview-coach-websites.md), [DEV0317](DEV0317-build-shareable-personal-coach-websites.md), [DEV0319](../backend/DEV0319-rehearse-coach-marketplace-websites.md). External media: [DEV0297](../backend/DEV0297-add-coach-profile-photos-and-mux-video.md). Amendment: [DEV0330](../../archive/organisatory/DEV0330-refine-coach-marketplace-pricing-reviews-and-urls.md); username routing: [DEV0331](../../archive/backend/DEV0331-enable-username-based-public-coach-urls.md).

## Objective and context

Deliver the first visible M10 slice: richer Home/Explore coach profile cards using the agreed public content, coach starting-rate disclosure, one-per-pair rating/count and username URL. Preserve the selected compact Home framing and discovery behavior. Complete this slice before revisiting photo/video allowance questions. Use [section 19.6](../../../docs/mvp-spec.md#196-cards-username-urls-and-scheduling-compatibility).

## Scope and non-goals

- In scope: shared responsive Home/Explore/map-preview card with optional public banner, portrait/initials, name/trust, primary place, introduction and discipline/format/focus cues, optional disclosed Sessions start from rate, actual pair-review mean/count and canonical username/legacy-safe links.
- Out of scope: full personal page layout (DEV0317), gallery/video capability or allowance/premium clarification, search/filter/sort changes, new service inventory, fixed booking quotes and private account fields.

## Expected behavior and edge cases

Publicly disclosed owner rates use Sessions start from wording; hidden/missing rates expose no numeric value. Ratings reflect one review per athlete–coach pair. Banner/identity use the public username URL when available and safe legacy fallback for older no-handle coaches. Missing/failed banners/portraits/reviews and long labels stay truthful, semantic and accessible. Home first-coach visibility/filter/order/15-card Load more and Explore query/map/List–Map/history/venue fallbacks remain intact. Portrait/banner fallbacks suffice for completion; gallery/video decisions and capability are not start/completion prerequisites.

## Assumptions, decisions, and dependencies

DEV0321 now supplies live `CoachDirectoryEntry.website` version-1 brand/introduction/focus/card-banner projections, with empty compatible defaults and no full experience/FAQ/link payload. The content/banner contract is delivered locally. DEV0313 adds optional `website.startingRate` containing only disclosed amount/currency/private-session context and the exact `Sessions start from …` label; hidden/missing amounts omit the entire field. Use that public DTO for rendering and serialized data, including zero/Free; never load or infer an owner amount. Starts after revised DEV0313/DEV0314 public contracts and the DEV0331 URL contract are available; coordinate real owner-authored evidence with DEV0315. This is the first visible delivery milestone before full website/media integration. It is independent of DEV0317 and DEV0297 photo/video decisions. Complete these cards, then revisit gallery allowance/premium questions before affected media implementation.

## Implementation plan

1. Inspect all shared card consumers, source contracts and installed framework docs; measure current Home initial-view constraints.
2. Build one richer card from real public content, disclosed starting rate, pair-review summary and username/legacy-safe URL.
3. Integrate Home/Explore/map previews without changing filters/order/pagination/selection or preloading gallery/video.
4. Verify absent/hidden/failed/long states, native navigation, keyboard links and map recovery at all five review widths.
5. Complete and record the card-only acceptance evidence before asking for media allowances or starting the full media/page integration.

## Acceptance criteria

- [ ] AC1: Both directory surfaces show the agreed saved public content, optional disclosed Sessions start from rate, real pair-review summary/trust/place and username/legacy-safe coach links.
- [ ] AC2: Hidden/missing starting rates expose no numeric value; absent/failed media, no/unavailable reviews and long content stay truthful/readable/keyboard usable without private data or nested actions.
- [ ] AC3: Home collage/search/initial identities/filter/order/15-card Load more and Explore complete query/map/List–Map/history/provider fallback remain correct.
- [ ] AC4: 375/430/768/1024/1440 px, keyboard/focus/error-state and affected discovery regressions pass; this ticket completes independently before deferred gallery/video allowance decisions.

## Validation plan

Use real authored/legacy profiles with disclosed/hidden/zero/missing starting rates, zero/multiple/unavailable pair reviews, username and no-handle legacy links, failed banners/portraits and long labels. Verify public payloads exclude hidden amounts. Review actual Home/Explore at all five widths, first-view coach identities, no-JavaScript filters/Load more, map/list/history and keyboard focus. Measure card image payload without gallery/video downloads. Run affected component/browser discovery checks and lint/typecheck/build. Do not require or clarify gallery/video allowance to finish this card slice.

## Implementation record

### Changes and rationale

2026-10-17 planning checkpoint: created this bounded Draft peer under COR0028. No feature code, data, provider settings or runtime validation changed. Implementation evidence remains pending.

### Affected files

The following are planned investigation/implementation areas, not a claim that they were edited:

| File or component                                                                                         | Planned role                                                                             |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [src/features/coaches/compact-coach-card.tsx](../../../src/features/coaches/compact-coach-card.tsx)       | Shared directory-card implementation.                                                    |
| [src/features/coaches/home-coach-discovery.tsx](../../../src/features/coaches/home-coach-discovery.tsx)   | Home grid and first-coach/pagination integration.                                        |
| [src/features/coaches/coach-explore-results.tsx](../../../src/features/coaches/coach-explore-results.tsx) | Explore list/map selection integration.                                                  |
| [src/features/coaches/coach-discovery.tsx](../../../src/features/coaches/coach-discovery.tsx)             | Inspect shared discovery/map-preview consumers; public full-page layout remains DEV0317. |

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

Runtime remains Draft. Taller cards must preserve initial coach visibility and existing map anchoring. Shared CSS changes require scoped ownership with DEV0317; no extra price/rating filters are authorized.

Handoff: only the planning record exists. Next action is to satisfy the stated start dependencies, inspect current source/docs, then record concrete contracts/limits and mark In progress when this implementation actually begins.

## Completion and review references

- Completed: Not completed — Draft runtime work.
- Commit: Not created; ticket creation does not authorize a commit.
- Review: Planning scope/ownership self-review under DEV0320 and amended DEV0330 only; no independent or runtime review.
- Deployment or release: None.
