# Ticket DEV0319: Rehearse coach marketplace websites

- Status: Draft
- Created: 2026-10-17
- Last updated: 2026-10-19
- Milestone: M10 — Coach marketplace websites (planned)
- Coordination: [COR0028 — Coach marketplace cards and personal websites](../organisatory/COR0028-coach-marketplace-cards-and-personal-websites.md)
- Related records: Peer dependencies/consumers: [DEV0320](../../archive/organisatory/DEV0320-adopt-coach-marketplace-website-contract.md), [DEV0321](../../archive/backend/DEV0321-persist-coach-website-content-and-banners.md), [DEV0313](../../archive/backend/DEV0313-manage-coach-starting-prices-and-visibility.md), [DEV0314](../../archive/backend/DEV0314-persist-booking-linked-coach-reviews.md), [DEV0315](../../archive/frontend/DEV0315-edit-and-preview-coach-websites.md), [DEV0316](../../archive/frontend/DEV0316-redesign-coach-directory-cards.md), [DEV0317](../frontend/DEV0317-build-shareable-personal-coach-websites.md), [DEV0318](../frontend/DEV0318-add-athlete-coach-review-controls.md). Independent later media follow-up: [DEV0297](../backend/DEV0297-add-coach-profile-photos-and-mux-video.md). Amendment: [DEV0330](../../archive/organisatory/DEV0330-refine-coach-marketplace-pricing-reviews-and-urls.md); username routing: [DEV0331](../../archive/backend/DEV0331-enable-username-based-public-coach-urls.md).

## Objective and context

Prove the combined coach-authoring, discovery, core personal-website, starting-rate privacy and consented-review loop on actual isolated development data. Component screenshots or completed planning must not be treated as persistence/privacy or rollout evidence.

Implement against the [M10 contract](../../../docs/mvp-spec.md#19-coach-marketplace-cards-and-personal-websites), especially [the relevant boundary](../../../docs/mvp-spec.md#197-ownership-and-required-evidence), [milestone](../../../docs/mvp-spec.md#12-delivery-milestones) and [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix). The 19 October 2026 core-first planning amendment is owned by [DEV0363](../../archive/organisatory/DEV0363-refresh-core-coach-website-delivery-plan.md). This request updates planning only; the combined runtime rehearsal remains unstarted.

## Scope and non-goals

- In scope: actual owner content/banner/starting-rate show-hide editing, completed cards and the core personal website using the current banner/portrait, username/legacy/alias navigation, one-pair-review consent/author/moderation/aggregate behavior, delivered typed/legacy booking, messaging and published-group compatibility, privacy/concurrency/responsive recovery and exact fixture cleanup.
- Out of scope: replacement peer implementation, fixed-quote/request-price snapshots, production rollout, real coach test ratings, gallery/video upload/playback/public composition, media-policy decisions, username login, payment operations and unrelated Auth/group changes.

## Expected behavior and edge cases

Use tagged disposable development accounts and restricted runtime with preserved unrelated data and exact recovery/cleanup manifests. Prove hidden starting amounts never leave private owner outputs; rate edits cannot change request behavior. Different eligible bookings of one pair yield one review across retry/republication/reconnection/username rename. Public URL claims/aliases cannot expose private accounts or switch coach identity. Record the completed card milestone and core page evidence. Gallery/video integration and its required policy/provider proof remain later DEV0297 work and do not block this core combined rehearsal. Verify real banner/portrait success and failure rather than treating later gallery evidence as a core criterion.

## Assumptions, decisions, and dependencies

Starts after the eight other COR0028 runtime peers (DEV0321, DEV0313, DEV0314, DEV0331, DEV0315, DEV0316, DEV0317 and DEV0318) have their owned outcomes/evidence delivered. DEV0292 Storage and delivered section 18.6/COR0029/DEV0348 booking compatibility remain authoritative. Public username routing is required; username login, gallery/video capability and media-policy decisions are not core prerequisites. Preserve DEV0330 history and apply the dated DEV0363 core-first amendment. No runtime work is authorized by this plan-update turn.

## Implementation plan

1. Define bounded fixture/runtime/migration/cleanup prerequisites and pin source/data-preservation evidence.
2. Verify actual owner content/banner/rate show-hide and public payload privacy, card completion, username/legacy/alias links and retained missing-handle compatibility.
3. Verify the actual core website/banner/portrait/metadata and existing request/message/group navigation after the card milestone, without price-lock behavior. Exercise enabled typed offers at 60/75/90 minutes, an enabled empty catalog, installed-but-unavailable catalog with booking-only retry and the capability-absent legacy path. Preserve profile visibility, actual venues, full-fit/horizon/overlap authority, safe guest return and existing group confirmation rules.
4. Exercise one review across multiple pair bookings, competing first submissions, edit/withdraw/republication/moderation, reconnect/rename and independent aggregate calculations.
5. Run all five review widths, keyboard/failure/access checks, exact cleanup and core specification acceptance mapping; distinguish local proof from rollout. Public gallery/video and provider/entitlement proof stay with DEV0297.

## Acceptance criteria

- [ ] AC1: Actual owner → card → core username website → session/message/group flows use stable IDs, real saved content/banner/portrait and current typed/empty/unavailable/legacy booking behavior; core services and page visibility remain usable without gallery/video.
- [ ] AC2: Rate show/hide protects all public payloads and leaves bookings unchanged; multi-booking pair reviews, consent, author/moderator races and aggregate counts remain correct.
- [ ] AC3: Username/legacy/missing-handle/rename/alias takeover and privacy cases pass with phone/desktop keyboard, absent/failed content/media/review/maps and safe guest returns.
- [ ] AC4: Every direct core runtime peer/dependency and amended core acceptance scenario has actual evidence, exact cleanup preserves unrelated data and no local result is reported as deployment/independent review.

## Validation plan

Record actual source/environment and runnable bounded rehearsal commands during implementation. Use real isolated database/Auth/Storage data for hidden-rate payload inspection, unchanged request/accept flow, competing pair reviews from different eligible bookings, moderation/republication/rename aggregate consistency and username claim/alias races. Review 375/430/768/1024/1440 px with keyboard and failure recovery. Confirm DEV0316 completion and use the current banner/portrait for core website proof; later gallery/video proof is independently owned by DEV0297. Check typed 60/75/90-minute, empty/unavailable/rollout-legacy catalogs without generating offers or mutating retained catalogs. Run documented applicable test/lint/typecheck/build/browser commands and exact cleanup. No current new rehearsal command or runtime success is claimed.

## Implementation record

### Changes and rationale

2026-10-17 planning checkpoint: created this bounded Draft peer under COR0028. No feature code, data, provider settings or runtime validation changed. Implementation evidence remains pending.

2026-10-19: DEV0363 narrows the required combined rehearsal to the core public-page loop, aligns current typed/legacy booking states and removes later gallery/video as a completion gate. This is documentary evidence only.

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

2026-10-19 DEV0363 amendment: core proof uses existing banner/portrait and delivered session-type booking; gallery/video remains a later independent follow-up. Original media-gated wording is preserved as dated planning history, not passed evidence. Runtime implementation remains unstarted; record concrete rehearsal contracts/environment/cleanup before edits.

### Contracts, configuration, and operations

Planning changes only so far. Runtime interface/schema/dependency/environment, setup, compatibility, migration/rollback and cleanup changes remain to be recorded during implementation. No credentials or private data belong in this record.

## Validation results

- Date/environment: 2026-10-17 planning; documentation consistency only, with the final command evidence recorded in DEV0330.
- 2026-10-19 documentary revision: consistency/link/ownership checks are recorded in DEV0363; this is not a rehearsal result.
- Runtime/application/database/browser/provider checks: Not run — feature implementation has not started.
- Failed/blocked runtime results: None observed; unmet start dependencies above remain prerequisites rather than passed checks.

| Criterion | Evidence                                                                    | Result  |
| --------- | --------------------------------------------------------------------------- | ------- |
| AC1–AC4   | Future runtime proof described above; none executed during ticket creation. | Not run |

## Risks, limitations, and follow-ups

Runtime remains Draft. Core page DEV0317 and remaining DEV0318 public-review integration must pass before this final combined rehearsal. Gallery/video remains separate DEV0297 work with unresolved decisions; it does not block core proof. Preserve hidden-rate privacy, pair-review identity, typed/legacy booking and safe public URLs. Use disposable/tagged fixtures and exact cleanup; no reset or provisioning may rewrite retained coaches.

## Completion and review references

- Completed: Not completed — Draft runtime work.
- Commit: Not created; ticket creation does not authorize a commit.
- Review: Planning scope/ownership self-review under DEV0320 and amended DEV0330 only; no independent or runtime review.
- Deployment or release: None.
