# Ticket DEV0318: Add athlete coach review controls

- Status: Draft
- Created: 2026-10-17
- Last updated: 2026-10-17
- Milestone: M10 — Coach marketplace websites (planned)
- Coordination: [COR0028 — Coach marketplace cards and personal websites](../organisatory/COR0028-coach-marketplace-cards-and-personal-websites.md)
- Related records: Peer dependencies/consumers: [DEV0320](../../archive/organisatory/DEV0320-adopt-coach-marketplace-website-contract.md), [DEV0314](../backend/DEV0314-persist-booking-linked-coach-reviews.md), [DEV0317](DEV0317-build-shareable-personal-coach-websites.md), [DEV0319](../backend/DEV0319-rehearse-coach-marketplace-websites.md). External media: [DEV0297](../backend/DEV0297-add-coach-profile-photos-and-mux-video.md). Amendment: [DEV0330](../../archive/organisatory/DEV0330-refine-coach-marketplace-pricing-reviews-and-urls.md); username routing: [DEV0331](../backend/DEV0331-enable-username-based-public-coach-urls.md).

## Objective and context

Let an athlete with at least one eligible session maintain exactly one review of that coach, with explicit public attribution consent. Later sessions do not create more review allowances. Use [section 19.4](../../../docs/mvp-spec.md#194-reviews-consent-and-public-aggregates); future runtime remains Draft.

## Scope and non-goals

- In scope: eligible pair-level review entry from original private session/history, consented compose/preview/publish, edit/withdraw/republication of the same review, retained draft/retry/revision recovery and link to the coach's username-based public review section.
- Out of scope: duplicate entries creating reviews per booking, review service/moderation/aggregate engine (DEV0314), public card/page list layout, public athlete identity, coach replies and group reviews.

## Expected behavior and edge cases

After one eligible session show Write a review only if the pair has no review; every later eligible booking links to Edit/View the same pair review. Withdrawal offers revision/republication of that record, not a fresh allowance. Eligibility stays server-owned. Explicitly preview/consent to attribution/score/comment and never autofill private legal name/avatar. Different booking-entry tabs, uncertain sends, repeated clicks, stale revisions and username changes recover the same pair/review result. No publication changes booking status or sends a message.

## Assumptions, decisions, and dependencies

Depends on revised DEV0314 pair eligibility/review services. Agree the username public-review destination with DEV0331/DEV0317 and preserve private history paging. Saved usernames are not review identity keys. Gallery/video decisions are unrelated and deferred until directory cards complete. Current Auth/session authority remains the compatibility baseline.

## Implementation plan

1. Inspect My sessions/history and agree pair-level eligibility/result navigation across multiple booking entry points.
2. Add one consented rating/comment/attribution compose/preview with correct Write versus Edit/View behavior.
3. Implement stable pair-review publish/edit/withdraw/republication through owning services, preserving drafts on errors/stale/uncertain submits.
4. Use public username destination where eligible, without granting nonparticipants authority or publishing private fields.
5. Verify one review across multiple sessions/tabs/reconnection/rename and real private/public rating refresh with mobile/desktop keyboard recovery.

## Acceptance criteria

- [ ] AC1: One eligible session enables one pair review; later bookings lead to the existing review and cannot enable a second submission for that coach.
- [ ] AC2: Public preview/consent is explicit for publication/republication and private names/avatar/booking data are never silently disclosed.
- [ ] AC3: Multi-booking entry tabs, retry, edit, withdrawal/republication, stale revision, lost access and uncertain send recover one stable pair review with no duplicate or automatic booking/message mutation.
- [ ] AC4: Actual private-history/public-username-result and aggregate refresh flows pass on phone/desktop with keyboard, including all forbidden eligibility cases.

## Validation plan

Use two or more eligible bookings for one pair plus different-coach and forbidden-state fixtures. Open review entry from separate booking pages/tabs and prove one record and Edit/View routing afterward, including withdrawn review, retry, reconnect and username rename. Verify explicit consent, private identity isolation, pair count/mean refresh and public username links. Exercise mobile/desktop keyboard score controls, errors/focus, drafts and older history pages; run focused author/service and lint/typecheck/build checks during implementation.

## Implementation record

### Changes and rationale

2026-10-17 planning checkpoint: created this bounded Draft peer under COR0028. No feature code, data, provider settings or runtime validation changed. Implementation evidence remains pending.

### Affected files

The following are planned investigation/implementation areas, not a claim that they were edited:

| File or component                                                                                   | Planned role                                                                   |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [src/features/coaches/coach-client-cards.tsx](../../../src/features/coaches/coach-client-cards.tsx) | Eligible original booking/history entry integration.                           |
| [src/app/sessions](../../../src/app/sessions)                                                       | Existing My sessions route family and original history navigation.             |
| [src/domain/coach-booking-requests.ts](../../../src/domain/coach-booking-requests.ts)               | Inspect existing identity/result boundaries; review authority remains DEV0314. |

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

Runtime remains Draft. Public consent must remain separate from private account identity and session participation. Public review-list rendering and operator moderation are owned by peers.

Handoff: only the planning record exists. Next action is to satisfy the stated start dependencies, inspect current source/docs, then record concrete contracts/limits and mark In progress when this implementation actually begins.

## Completion and review references

- Completed: Not completed — Draft runtime work.
- Commit: Not created; ticket creation does not authorize a commit.
- Review: Planning scope/ownership self-review under DEV0320 and amended DEV0330 only; no independent or runtime review.
- Deployment or release: None.
