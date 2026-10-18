# Ticket DEV0319: Rehearse coach marketplace websites

- Status: Draft
- Created: 2026-10-17
- Last updated: 2026-10-17
- Milestone: M10 — Coach marketplace websites (planned)
- Coordination: [COR0028 — Coach marketplace cards and personal websites](../organisatory/COR0028-coach-marketplace-cards-and-personal-websites.md)
- Related records: Peer dependencies/consumers: [DEV0320](../../archive/organisatory/DEV0320-adopt-coach-marketplace-website-contract.md), [DEV0321](../../archive/backend/DEV0321-persist-coach-website-content-and-banners.md), [DEV0313](../../archive/backend/DEV0313-manage-coach-starting-prices-and-visibility.md), [DEV0314](../../archive/backend/DEV0314-persist-booking-linked-coach-reviews.md), [DEV0315](../frontend/DEV0315-edit-and-preview-coach-websites.md), [DEV0316](../frontend/DEV0316-redesign-coach-directory-cards.md), [DEV0317](../frontend/DEV0317-build-shareable-personal-coach-websites.md), [DEV0318](../frontend/DEV0318-add-athlete-coach-review-controls.md). External media: [DEV0297](../backend/DEV0297-add-coach-profile-photos-and-mux-video.md). Amendment: [DEV0330](../../archive/organisatory/DEV0330-refine-coach-marketplace-pricing-reviews-and-urls.md); username routing: [DEV0331](../backend/DEV0331-enable-username-based-public-coach-urls.md).

## Objective and context

Prove the combined coach-authoring, discovery, personal-website, private-price and consented-review loop on actual isolated development data. Component screenshots or completed planning must not be treated as persistence/privacy or rollout evidence.

Implement against the [M10 contract](../../../docs/mvp-spec.md#19-coach-marketplace-cards-and-personal-websites), especially [the relevant boundary](../../../docs/mvp-spec.md#197-ownership-and-required-evidence), [milestone](../../../docs/mvp-spec.md#12-delivery-milestones) and [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix). This ticket is future runtime work; the user requested tickets only on 17 October 2026.

## Scope and non-goals

- In scope: actual owner content/banner/starting-rate show-hide editing, completed cards before media decisions, later personal website/photo integration, username/legacy/alias navigation, one-pair-review consent/author/moderation/aggregate behavior, unchanged booking/message/group loop, privacy/concurrency/responsive recovery and exact fixture cleanup.
- Out of scope: replacement peer implementation, fixed-quote/request-price snapshots, production rollout, real coach test ratings, choosing media allowance before cards, username login, payment operations and unrelated Auth/group changes.

## Expected behavior and edge cases

Use tagged disposable development accounts and restricted runtime with preserved unrelated data and exact recovery/cleanup manifests. Prove hidden starting amounts never leave private owner outputs; rate edits cannot change request behavior. Different eligible bookings of one pair yield one review across retry/republication/reconnection/username rename. Public URL claims/aliases cannot expose private accounts or switch coach identity. Record cards complete before any later media decision/delivery; missing full-gallery evidence still blocks full integration, not the finished card slice.

## Assumptions, decisions, and dependencies

Starts after DEV0321, revised DEV0313–DEV0318 and DEV0331 pass, with cards completed before later media review and DEV0297 photo delivery. DEV0292 Storage and existing scheduling/message/group/Auth contracts stay compatible. Username public routing is required; username login and optional video entitlement are not. The documentary amendment is DEV0330; no new runtime work is authorized by this planning turn.

## Implementation plan

1. Define bounded fixture/runtime/migration/cleanup prerequisites and pin source/data-preservation evidence.
2. Verify actual owner content/banner/rate show-hide and public payload privacy, card completion, username/legacy/alias links and retained missing-handle compatibility.
3. After the recorded card milestone and later media decisions/delivery, verify full website/photo/metadata and original request/message/group navigation without price-lock behavior.
4. Exercise one review across multiple pair bookings, competing first submissions, edit/withdraw/republication/moderation, reconnect/rename and independent aggregate calculations.
5. Run all review widths/keyboard/failure/access checks, exact cleanup and specification acceptance mapping; distinguish local proof from rollout.

## Acceptance criteria

- [ ] AC1: Actual owner → card → username website → session/message/group flows use stable IDs, real public content and later authorized media, with recorded card-before-media sequence.
- [ ] AC2: Rate show/hide protects all public payloads and leaves bookings unchanged; multi-booking pair reviews, consent, author/moderator races and aggregate counts remain correct.
- [ ] AC3: Username/legacy/missing-handle/rename/alias takeover and privacy cases pass with phone/desktop keyboard, absent/failed content/media/review/maps and safe guest returns.
- [ ] AC4: Every direct runtime peer/dependency and amended acceptance scenario has actual evidence, exact cleanup preserves unrelated data and no local result is reported as deployment/independent review.

## Validation plan

Record actual source/environment and runnable bounded rehearsal commands during implementation. Use real isolated database/Auth/Storage data for hidden-rate payload inspection, unchanged request/accept flow, competing pair reviews from different eligible bookings, moderation/republication/rename aggregate consistency and username claim/alias races. Review 375/430/768/1024/1440 px with keyboard and failure recovery. Confirm DEV0316 completed before media decisions, then require actual gallery integration for full website proof. Run documented applicable test/lint/typecheck/build/browser commands and exact cleanup. No current new rehearsal command or runtime success is claimed.

## Implementation record

### Changes and rationale

2026-10-17 planning checkpoint: created this bounded Draft peer under COR0028. No feature code, data, provider settings or runtime validation changed. Implementation evidence remains pending.

### Affected files

The following are planned investigation/implementation areas, not a claim that they were edited:

| File or component                         | Planned role                                                          |
| ----------------------------------------- | --------------------------------------------------------------------- |
| [tests/browser](../../../tests/browser)   | Affected and new real browser scenarios selected from M10 criteria.   |
| [tests/database](../../../tests/database) | Meaningful migration/authorization/concurrency integration evidence.  |
| [scripts](../../../scripts)               | Future bounded rehearsal harness and exact cleanup manifest handling. |
| [README.md](../../../README.md)           | Document only actual new validation commands once they exist.         |

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
