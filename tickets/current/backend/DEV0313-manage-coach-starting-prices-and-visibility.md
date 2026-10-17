# Ticket DEV0313: Manage coach starting prices and visibility

- Status: Draft
- Created: 2026-10-17
- Last updated: 2026-10-17
- Milestone: M10 — Coach marketplace websites (planned)
- Coordination: [COR0028 — Coach marketplace cards and personal websites](../organisatory/COR0028-coach-marketplace-cards-and-personal-websites.md)
- Related records: Peer dependencies/consumers: [DEV0320](../../archive/organisatory/DEV0320-adopt-coach-marketplace-website-contract.md), [DEV0321](../../archive/backend/DEV0321-persist-coach-website-content-and-banners.md), [DEV0315](../frontend/DEV0315-edit-and-preview-coach-websites.md), [DEV0316](../frontend/DEV0316-redesign-coach-directory-cards.md), [DEV0317](../frontend/DEV0317-build-shareable-personal-coach-websites.md), [DEV0319](DEV0319-rehearse-coach-marketplace-websites.md). External media: [DEV0297](../backend/DEV0297-add-coach-profile-photos-and-mux-video.md). Amendment: [DEV0330](../../archive/organisatory/DEV0330-refine-coach-marketplace-pricing-reviews-and-urls.md); username routing: [DEV0331](../backend/DEV0331-enable-username-based-public-coach-urls.md).

## Objective and context

Let the coach define an indicative `Sessions start from …` rate and choose whether it is public. The user's later review simplified the original fixed-price/snapshot plan; this ticket owns the starting amount, disclosure and safe public/owner projections, not booking-price terms.

Use [section 19.3](../../../docs/mvp-spec.md#193-starting-prices-and-public-disclosure), the [M10 milestones](../../../docs/mvp-spec.md#12-delivery-milestones) and [acceptance scenarios](../../../docs/mvp-spec.md#13-acceptance-matrix). Runtime remains Draft.

## Scope and non-goals

- In scope: optional owner-entered EUR starting amount, independent public-display setting, versioned save/edit/clear/show/hide, money bounds, owner versus public projection and cache invalidation. Provide tested contracts to the editor/cards/website.
- Out of scope: fixed quotes, price snapshots on requests/bookings/messages, changed-price request gates, multiple services/durations, group-price changes, payment collection, the owner/public layouts and media decisions.

## Expected behavior and edge cases

The owner chooses the amount; MovX neither selects nor derives a minimum price. Public output says `Sessions start from €60` for an actual disclosed rate (example only), with private-session context. An absent amount is unknown and zero is explicit Free/zero. Adopt initially hidden disclosure. Hiding retains the owner value but removes it from public projections, HTML/props, metadata/share output and current caches; visual hiding alone fails the contract. A missing/hidden amount omits the numeric line and can lead to Message coach. Concurrent owner edits use revisions and retain error drafts. Amount/disclosure changes never mutate a booking/request or claim a locked quote. Existing group per-person terms remain separate.

## Assumptions, decisions, and dependencies

Confirmed: coach-defined starting-price wording and an option not to disclose it publicly. Adopted defaults: EUR integer cents, a single indicative private-session rate and initial disclosure off. This supersedes the initial fixed-price/snapshot default before runtime implementation.

Depends on DEV0330's amended contract. Coordinate presentation DTOs with DEV0321; they can be implemented independently. DEV0315 owns owner forms, DEV0316/DEV0317 own public rendering. No gallery/video decision or booking-state change is a prerequisite.

## Implementation plan

1. Inspect current coach/public projections and record amount, publicity, revision and owner/public result contracts; inspect installed integration docs before changes.
2. Add compatible optional starting amount/disclosure persistence and guarded owner save/clear/show/hide with current authority.
3. Filter hidden/missing values out of public query/response/metadata/cache contracts and invalidate disclosure changes.
4. Prove owner revisions/amount bounds, absent/zero/paid/hidden values, privacy across all public payloads and unchanged booking/request behavior.
5. Hand tested contracts to editor/cards/pages; record migration, rollout/rollback and exact validation commands.

## Acceptance criteria

- [ ] AC1: The authorized coach independently sets/edits/clears their starting rate and public disclosure; invalid money/currency/fraction/overflow input fails with retained drafts and versioned conflict recovery.
- [ ] AC2: Disclosed rates provide Sessions start from wording and correct currency/context; absent and zero differ and no platform-computed/private/group minimum is invented.
- [ ] AC3: Hidden rates stay owner-only and are absent from public projections, serialized markup, metadata/share output and current caches; hide/show transitions and failures are tested.
- [ ] AC4: Existing request/booking/message/group behavior remains unchanged with no price-lock or stale-rate request gate; migrations, privacy/revision and relevant static/regression checks pass.

## Validation plan

Use isolated fresh/retained-data migrations, real owner/dataset/visibility checks and concurrent rate/disclosure revisions. Cover absent/zero/paid/hidden amounts, clear/hide/show, invalid money bounds and unavailable results. Inspect every public response/HTML/metadata/share boundary and cache after hiding; private owner reads must retain the amount. Regress the unchanged request/accept/history/group flows without price fields or request resubmission. Run meaningful focused tests, npm test, npm run lint, npm run typecheck and npm run build after implementation; record exact environment/commands then. This checkpoint runs documentation checks only.

## Implementation record

### Changes and rationale

2026-10-17 planning checkpoint: created this bounded Draft peer under COR0028. No feature code, data, provider settings or runtime validation changed. Implementation evidence remains pending.

### Affected files

Planned areas, not runtime edits:

| File or component                                                      | Planned role                                                  |
| ---------------------------------------------------------------------- | ------------------------------------------------------------- |
| [Coach domain](../../../src/domain/coaches.ts)                         | Owner/private and public starting-rate contracts.             |
| [Coach service](../../../src/server/coaches/service.ts)                | Guarded owner save and public disclosure projection.          |
| [Coach repository](../../../src/server/db/coaches/repository.ts)       | Optional rate/disclosure/revision persistence.                |
| [Coach editor](../../../src/features/coaches/coach-profile-editor.tsx) | DEV0315 consumes the owning service; form/layout stays there. |

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

Runtime remains Draft. Starting rates are informational; final arrangements remain between athlete/coach. Protect hidden values in server output rather than CSS. The earlier booking-price snapshot plan is superseded, not an unfinished acceptance requirement. Next: define narrow DTO/migration contracts and begin only under a later implementation request.

## Completion and review references

- Completed: Not completed — Draft runtime work.
- Commit: Not created; ticket creation does not authorize a commit.
- Review: Planning scope/ownership self-review under DEV0320 and amended DEV0330 only; no independent or runtime review.
- Deployment or release: None.
