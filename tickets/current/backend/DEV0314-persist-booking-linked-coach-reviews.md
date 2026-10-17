# Ticket DEV0314: Persist booking-linked coach reviews

- Status: In progress
- Created: 2026-10-17
- Last updated: 2026-10-18
- Milestone: M10 — Coach marketplace websites (planned)
- Coordination: [COR0028 — Coach marketplace cards and personal websites](../organisatory/COR0028-coach-marketplace-cards-and-personal-websites.md)
- Related records: Peer dependencies/consumers: [DEV0320](../../archive/organisatory/DEV0320-adopt-coach-marketplace-website-contract.md), [DEV0316](../frontend/DEV0316-redesign-coach-directory-cards.md), [DEV0317](../frontend/DEV0317-build-shareable-personal-coach-websites.md), [DEV0318](../frontend/DEV0318-add-athlete-coach-review-controls.md), [DEV0319](DEV0319-rehearse-coach-marketplace-websites.md). External media: [DEV0297](../backend/DEV0297-add-coach-profile-photos-and-mux-video.md). Retention dependency: [DEV0165](../backend/DEV0165-implement-account-deletion-lifecycle.md). Amendment: [DEV0330](../../archive/organisatory/DEV0330-refine-coach-marketplace-pricing-reviews-and-urls.md); username routing: [DEV0331](../backend/DEV0331-enable-username-based-public-coach-urls.md).

## Objective and context

Build genuine coach reviews and aggregate ratings with one review per athlete–coach pair after at least one eligible session. The user's later choice supersedes the initial one-review-per-booking default. Use [section 19.4](../../../docs/mvp-spec.md#194-reviews-consent-and-public-aggregates) and the [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix); implementation starts on 18 October 2026.

## Scope and non-goals

- In scope: dataset/coach/athlete pair review uniqueness, private qualifying-booking evidence, consented publication, revisioned author edit/withdraw/republication, operator hide/restore audit, bounded public paging and matching mean/count.
- Out of scope: multiple reviews for later bookings, review-author/public layouts, group reviews, imported testimonials, incentives, attendance certification, coach suppression/replies and independent account deletion policy.

## Expected behavior and edge cases

An exact athlete becomes eligible after one elapsed non-cancelled confirmed/completed private booking with that coach. Database time/original participation are required; coach completion is not the sole gate and eligibility is not attendance proof. Persist one review per dataset/coach/athlete pair with one private qualifying booking reference. Concurrent first submissions using different eligible bookings still have one winner. More sessions, reconnecting, username changes, exact retries and withdrawal/republication reuse that same review. Self, unrelated, future, cancelled-only, request/connection/group-only and cross-dataset cases fail.

Consent, 1–5 integer rating, comment/attribution bounds, author revision recovery, operator audit and public privacy follow section 19.4. Count each athlete at most once per coach. No public response includes internal pair/booking IDs, venue/time, private names or avatar. Empty versus unavailable and fiction versus real ratings remain distinct.

## Assumptions, decisions, and dependencies

Confirmed: one review of a coach after a session, interpreted as one per athlete–coach pair. Adopted details: current private-booking eligibility, one stable pair/review identity, authors may revise/withdraw that review and consent is explicit. Do not revert to a per-booking uniqueness key.

Depends on DEV0330's amended contract and current booking/time/retention authority. Can proceed independently of pricing/content/username routing; DEV0331 must preserve pair identity during rename. DEV0318 owns composition, DEV0316/DEV0317 consume public projections. DEV0165 remains the independent retention policy owner.

## Implementation plan

1. Define pair uniqueness, private qualifying-booking evidence, lifecycle/revision/retry and public/participant DTOs against the actual current booking contract.
2. Add compatible guarded review persistence, proof of one eligible session and one stable pair review across all bookings.
3. Implement author publish/edit/withdraw/republication and audited operator hide/restore without coach suppression.
4. Implement deterministic paging (20) and matching mean/count with invalidation and current public visibility checks.
5. Prove multi-booking first-submission races, retry/reconnect/rename/withdraw identity stability, eligibility/consent/privacy and preserved-data migrations.

### 2026-10-18 implementation contract and parallel boundary

The user authorized another ticket in parallel with DEV0313. This peer uses new review domain/service/repository/API/test files and `20261018000400_coach_pair_reviews.sql` (reserved here; leaves the adjacent starting-rate migration slot free). Do not edit pricing or its owner interface. Shared specification/index/COR edits are additive. New public summary/page APIs are consumed by DEV0316/DEV0317; do not rewrite their directory/card layouts here.

- Persist one row per dataset/coach/athlete with a private original qualifying booking, immutable pair identity, integer revision, consented publication state and independent operator-hidden state. Author publish/edit/republish requires explicit consent each time; withdrawal preserves identity and content privately. Moderation updates the same revision and appends immutable reason/operator/time audit; authors cannot restore a moderation hide.
- Commands: publish has bookingId, rating 1–5, comment (plain text, up to 2000 Unicode characters), attribution (2–80), consent=true and expectedRevision. Withdraw has coachSlug/expectedRevision. Operator hide/restore has reviewId/reason (2–500)/expectedRevision. Reject extra/authority fields. Revision zero means absent; exact same-command retry at revision+1 returns the same state; altered/stale writes conflict.
- `GET/POST /api/coach-reviews` returns exact-actor eligibility/current review or executes author commands. `POST /api/coach-reviews/moderation` is operator-only. `GET /api/coaches/[slug]/reviews` exposes a 20-item page and matching summary (count, one-decimal mean or null, fictional/demo flag); cursor is bounded opaque publication-order position, with stable creation-time/UUID order. Public items contain only attribution/rating/comment/publication timestamps, never actor/booking/pair IDs or private media.
- All endpoints are no-store; write routes require configured same origin, JSON and actual streamed UTF-8 bytes within 16 KiB. This gives immediate consistent withdrawal/moderation/visibility reads without cached private contributions. New batch summary repository/service exports support the later card/page consumers without conflicting with DEV0313's shared directory edits.
- Reuse current verified actor context, database-time booking eligibility and existing DEV0321 public-coach visibility helper. New forced-row-security tables grant no direct runtime/browser reads/writes; bounded security-definer routines validate actors and exact targets. No frontend, new dependency, identity/provider operation or hosted rollout.
- Validate in rollback/disposable local database fixtures before any rollout. Real browser visual checks are not applicable to these JSON-only APIs; HTTP boundary, database authorization/concurrency/privacy and production build checks are required. Do not mark complete without required database evidence.

## Acceptance criteria

- [ ] AC1: Only the exact athlete with at least one eligible session can publish with explicit consent; invalid self/unrelated/future/cancelled-only/group-only/cross-dataset attempts fail.
- [ ] AC2: Exactly one review per dataset/coach/athlete pair survives submissions against different bookings, retry, edit, withdrawal/republication, reconnection and username changes without duplicates.
- [ ] AC3: Author/operator lifecycle changes produce matching visible pair reviews and mean/count with at most one rating per athlete per coach; coaches cannot filter criticism and unavailable reads stay distinct.
- [ ] AC4: Public privacy, score/comment/attribution bounds, migrations, pair/revision races and relevant regressions pass; the qualifying booking and raw author identity remain private.

## Validation plan

Use real isolated database/service fixtures for one/two/many eligible bookings of the same pair, different coaches, elapsed confirmed/completed and forbidden states. Race first submission against different booking IDs, stale edits, withdrawal and moderation; verify one pair row and independently recomputed counts/means. Reconnect and rename the same account without changing its review identity. Check consent/public response privacy, cursor boundaries, operator audit and fresh/preserved-data migrations. Run focused tests, npm test, npm run lint, npm run typecheck and npm run build during implementation; current checkpoint is documentation-only.

## Implementation record

### Changes and rationale

2026-10-17 planning checkpoint: created this bounded Draft peer under COR0028. No feature code, data, provider settings or runtime validation changed. Implementation evidence remains pending.

### Affected files

The following are planned investigation/implementation areas, not a claim that they were edited:

| File or component                                                                       | Planned role                                                        |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| [src/server/db/schema/bookings.ts](../../../src/server/db/schema/bookings.ts)           | Existing booking identity/eligibility source.                       |
| [src/server/coaches/booking-service.ts](../../../src/server/coaches/booking-service.ts) | Inspect actor/status/time authority before adding a review service. |
| [src/server/coaches/service.ts](../../../src/server/coaches/service.ts)                 | Bounded public review summary integration.                          |
| [src/server/db/coaches/repository.ts](../../../src/server/db/coaches/repository.ts)     | Public directory/profile aggregate projection integration.          |
| [supabase/migrations](../../../supabase/migrations)                                     | Additive review schema/constraints and guarded operations.          |

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

Implementation is underway. Enforce pair-level uniqueness across every eligible booking and preserve one review through withdrawal/republication or username changes. Consent/moderation and current retention boundaries remain required; private qualifying booking references never enter public output.

## Completion and review references

- Completed: Not completed — Draft runtime work.
- Commit: Not created; ticket creation does not authorize a commit.
- Review: Planning scope/ownership self-review under DEV0320 and amended DEV0330 only; no independent or runtime review.
- Deployment or release: None.
