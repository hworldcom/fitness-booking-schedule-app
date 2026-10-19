# Ticket DEV0314: Persist booking-linked coach reviews

- Status: Completed
- Created: 2026-10-17
- Last updated: 2026-10-18
- Milestone: M10 — Coach marketplace websites
- Coordination: [COR0028 — Coach marketplace cards and personal websites](../../current/organisatory/COR0028-coach-marketplace-cards-and-personal-websites.md)
- Related records: Peer dependencies/consumers: [DEV0320](../organisatory/DEV0320-adopt-coach-marketplace-website-contract.md), [DEV0316](../frontend/DEV0316-redesign-coach-directory-cards.md), [DEV0317](../frontend/DEV0317-build-shareable-personal-coach-websites.md), [DEV0318](../../current/frontend/DEV0318-add-athlete-coach-review-controls.md), [DEV0319](../../current/backend/DEV0319-rehearse-coach-marketplace-websites.md). External media: [DEV0297](../../current/backend/DEV0297-add-coach-profile-photos-and-mux-video.md). Retention dependency: [DEV0165](../../current/backend/DEV0165-implement-account-deletion-lifecycle.md). Amendment: [DEV0330](../organisatory/DEV0330-refine-coach-marketplace-pricing-reviews-and-urls.md); username routing: [DEV0331](DEV0331-enable-username-based-public-coach-urls.md).

## Objective and context

Build genuine coach reviews and aggregate ratings with one review per athlete–coach pair after at least one eligible session. The user's later choice supersedes the initial one-review-per-booking default. Use [section 19.4](../../../docs/mvp-spec.md#194-reviews-consent-and-public-aggregates) and the [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix); Implementation started on 18 October 2026.

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
- Commands: publish has bookingId, rating 1–5, comment (plain text, up to 2000 Unicode characters), attribution (2–80), consent=true and expectedRevision. Withdraw has coachSlug/expectedRevision. Operator hide/restore has reviewId/reason (2–500)/expectedRevision. Reject extra/authority fields. Revision zero means absent; exact same-command retry at revision+1 returns the same state; altered/stale writes conflict. Store the last validated command and actor privately: matching field values alone cannot prove an exact retry after another author/moderator operation. This refinement was recorded during pre-completion review before implementing the stronger retry guard.
- `GET/POST /api/coach-reviews` returns exact-actor eligibility/current review or executes author commands. `POST /api/coach-reviews/moderation` is operator-only. `GET /api/coaches/[slug]/reviews` exposes a 20-item page and matching summary (count, one-decimal mean or null, fictional/demo flag); cursor is bounded opaque publication-order position, with stable creation-time/UUID order. Public items contain only attribution/rating/comment/publication timestamps, never actor/booking/pair IDs or private media.
- Add a small application-owned same-origin helper inside the existing server Auth boundary so HTTP code does not import provider configuration directly. All endpoints are no-store; write routes require configured same origin, JSON and actual streamed UTF-8 bytes within 16 KiB. This gives immediate consistent withdrawal/moderation/visibility reads without cached private contributions. New batch summary repository/service exports support the later card/page consumers without conflicting with DEV0313's shared directory edits.
- Hidden-coach private reads require an existing own review or eligible own booking; unrelated reads and withdrawal with no own review return not-found without a hidden-profile existence hint. Reuse current verified actor context, database-time booking eligibility and existing DEV0321 public-coach visibility helper. New forced-row-security tables grant no direct runtime/browser reads/writes; bounded security-definer routines validate actors and exact targets. No frontend, new dependency, identity/provider operation or hosted rollout.
- Validate in rollback/disposable local database fixtures before any rollout. Real browser visual checks are not applicable to these JSON-only APIs; HTTP boundary, database authorization/concurrency/privacy and production build checks are required. Do not mark complete without required database evidence.

## Acceptance criteria

- [x] AC1: Only the exact athlete with at least one eligible session can publish with explicit consent; invalid self/unrelated/future/cancelled-only/group-only/cross-dataset attempts fail.
- [x] AC2: Exactly one review per dataset/coach/athlete pair survives submissions against different bookings, retry, edit, withdrawal/republication, reconnection and username changes without duplicates.
- [x] AC3: Author/operator lifecycle changes produce matching visible pair reviews and mean/count with at most one rating per athlete per coach; coaches cannot filter criticism and unavailable reads stay distinct.
- [x] AC4: Public privacy, score/comment/attribution bounds, migrations, pair/revision races and relevant regressions pass; the qualifying booking and raw author identity remain private.

## Validation plan

Use real isolated database/service fixtures for one/two/many eligible bookings of the same pair, different coaches, elapsed confirmed/completed and forbidden states. Race first submission against different booking IDs, stale edits, withdrawal and moderation; verify one pair row and independently recomputed counts/means. Reconnect and rename the same account without changing its review identity. Check consent/public response privacy, cursor boundaries, operator audit and fresh/preserved-data migrations. Run focused tests, npm test, npm run lint, npm run typecheck and npm run build during implementation; current checkpoint is documentation-only.

## Implementation record

### Changes and rationale

2026-10-17 historical planning: created the bounded backend peer; DEV0330 later amended uniqueness from booking to athlete–coach pair.

2026-10-18: added private pair-review persistence, database-time booking eligibility, explicit consented publication, author edit/withdraw/republish, exact-command retry recovery, operator hide/restore audit and live public summaries/pages. One immutable pair key survives different qualifying bookings and later username changes. The original booking remains private evidence. No review UI or pricing code was added.

All new tables force row security and deny direct runtime/browser access. Narrow security-definer routines use verified actor/dataset/role context, qualified tables and empty search paths. Authors cannot set moderation fields, choose another athlete or restore a hide. Operators cannot rewrite author text. Unrelated hidden-coach reads/withdrawals do not disclose existence. Public projection rebuilds only consented attribution/rating/comment/timestamps and matching mean/count; it never joins private names or media.

### Affected files

| File | Role |
| --- | --- |
| [coach-reviews.ts](../../../src/domain/coach-reviews.ts) | Strict command/text/revision/result types; explicit consent; public DTO reconstruction and summary validation. |
| [review-repository.ts](../../../src/server/db/coaches/review-repository.ts) | Sole SQL boundary, private state mapping, bounded public pages, microsecond-preserving opaque cursors and batch summaries. |
| [review-service.ts](../../../src/server/coaches/review-service.ts) | Existing verified actor authority, operator gate and explicit invalid/not-found/unavailable results. |
| [review migration](../../../supabase/migrations/20261018000400_coach_pair_reviews.sql) | Pair identity, booking proof, permissions, row policies, command/revision serialization, moderation audit and public aggregate functions. |
| [request-origin.ts](../../../src/server/auth/request-origin.ts) and [HTTP helpers](../../../src/server/http/coach-reviews.ts) | Keep provider configuration inside the Auth boundary; bound actual streamed JSON/UTF-8 writes and emit no-store responses. |
| [author route](../../../src/app/api/coach-reviews/route.ts), [moderation route](../../../src/app/api/coach-reviews/moderation/route.ts), [public route](../../../src/app/api/coaches/[slug]/reviews/route.ts) | Backend HTTP entry points; no presentation or side effects outside reviews. |
| [domain tests](../../../tests/coach-reviews.test.ts), [route tests](../../../tests/server/coach-reviews.test.ts), [database tests](../../../tests/database/coach-reviews.test.ts) | Bounds/privacy/HTTP guards, genuine restricted-runtime eligibility/races/lifecycle/visibility/paging and real public handler/database integration. |
| [database rehearsal](../../../scripts/rehearse-coach-reviews-database.mjs) | Local-only schema clone, fresh/upgrade proof, unchanged original-row fingerprints and exact disposable-target cleanup. |
| [MVP specification](../../../docs/mvp-spec.md#194-reviews-consent-and-public-aggregates), [ticket index](../../README.md), coordination and linked peer records | Clarify backend/UI boundaries, record completion/handoff and maintain moved-ticket links; peer implementation is unchanged. |

### Decisions and deviations

- Parallel boundary: DEV0313 owns rates and shared rate integration. This ticket uses separate files; the later cards/pages compose `publicCoachReviewSummaries` and review pages. DEV0318 owns author controls/consent preview.
- Reuse DEV0321's delivered `coach_website_is_public` visibility helper instead of duplicating its trust/primary-venue gates; review migration follows that foundation. Reserve forward version 20261018000400 while DEV0313 uses the preceding starting-rate slot.
- Pre-completion review identified that equal field values do not prove an exact retry after moderation. Store the last validated command/actor privately; the regression reproduces the false success and requires conflict. This changes no adopted product scope.
- API-only work needs HTTP/database authority and static/build evidence; there is no new visual flow to inspect at phone/desktop widths. Existing navigation and later review UI retain their own browser requirements.

### Contracts, configuration, and operations

No dependency, environment variable, auth method or pricing change. New read/write bodies and limits are defined in the implementation contract above and exported domain types. All responses are private/no-store and queries use current public visibility, so withdrawal/moderation do not depend on cache expiry. Mean is null at zero count and rounded to one decimal otherwise. `fictional` follows the coach demo flag; no scores are invented.

Public page order is descending immutable first-publication creation time/UUID, twenty items per page. Cursor keeps the exact PostgreSQL fractional timestamp; no millisecond rounding. Public review IDs are omitted; opaque cursor positions contain only a review-row position, never athlete/pair/booking identity. Batch summaries accept up to 256 validated slugs in 64-item database batches; not-found coaches are omitted, while actual database failures remain unavailable.

Apply the additive forward migration only after the existing content/banner foundation (and in normal migration order). It creates two private tables and four bounded routines plus validation/owner lookup policies; it does not backfill or mutate existing rows. Runtime services require that migration before consumers are enabled. Local rehearsal uses schema-only infrastructure and fictional seed/owned test identities in random `dev0314_` databases; no retained user/token/object data is copied. Shared development, hosted rollout and production are not changed here. Prefer a reviewed forward correction over dropping private review/audit history; withdrawal is not deletion. DEV0165 retains broader deletion/retention ownership.

## Validation results

2026-10-18, Node 24.21.0, Next 16.3.8, local Docker Supabase. No hosted/provider/email operation or retained-data fixture was used.

- `node --import tsx --test tests/coach-reviews.test.ts tests/boundaries.test.ts` and `node --import tsx --conditions=react-server --test tests/server/coach-reviews.test.ts`: passed domain, architecture and HTTP checks, including unsafe origins/types, malformed/oversized/invalid UTF-8 JSON, extra authority fields, consent/text/score bounds, invalid/repeated queries and forged/impossible-date cursors. Final full suite includes all of these cases.
- `npm test`: passed **262 application + 45 server tests (307 total)**, output `/tmp/movx-dev0314-all-tests-final.log`. One earlier broad run hit an existing ten-second development-launcher subprocess timeout under concurrent builds (261/262 application checks passed); the full rerun after build completion passed without changing that test or its launcher. Initial intermediate typechecks also saw concurrent DEV0313/DEV0335 edits; they were not changed under this ticket.
- `npm run typecheck`: passed, including the final full-tree rerun (`/tmp/movx-dev0314-types-final.log`). Focused `npx eslint` and `npx prettier --check` passed on all eight implementation files, the database rehearsal and three new test files. `git diff --check` passed. `node scripts/database-baseline.mjs verify` passed all 53 historical migration checksums and the frozen baseline.
- Production build passed with explicit Node 24: `node_modules/next/dist/bin/next build --webpack` in `/var/folders/97/qxdkjfmj0_l4w87jnk_rsq6w0000gq/T/movx-dev0314-build-cw10kbx4`. Copied source/public/scripts/tests/config only, excluded populated environment files, blanked service settings and symlinked installed dependencies. Compile, full TypeScript, static generation and traces passed; live development output was untouched. Byte comparisons confirm all eight current review implementation files match that passing artifact. Output `/tmp/movx-dev0314-build.log`.
- `node scripts/rehearse-coach-reviews-database.mjs`: final frozen **fresh and preserved-data upgrade** rehearsals passed, 9 checks per mode (18 total), output `/tmp/movx-dev0314-db-final.log`. All original app/Auth/Storage row-count/content fingerprints stayed identical across migration. Schema-only infrastructure copied no retained user/token/object rows. Both exact random `dev0314_314106ce260f_*` targets were dropped after tests.
- Real restricted-runtime checks prove empty versus unavailable/public means, actor/dataset isolation, self/unrelated/future/cancelled/absent/cross-dataset rejection, explicit consent/forged input rejection, one-winner different-booking concurrent first claims, exact versus changed/stale retry, stable pair ID through edits/withdrawal/republishing and username change, separate reviews for another coach, operator-only hide/restore with nonduplicated reason/actor/time audit, author inability to restore a hide, private-field exclusion, bounded 20+3 pages with exact microsecond cursor positions, matching mean/count, live public HTTP response mapping/no-store, hidden-coach public revocation and private author continuity without unrelated enumeration.
- New tables deny direct runtime reads/writes and browser execution of mutation routines; tests retain real foreign keys/triggers. Lookup/row-lock policies are owner-only. A stale-author retry after operator hide reproduces the prior field-equivalence false success and now conflicts through the stored exact command/actor guard.
- Early fixture harness corrections: required registration display names; historical booking creation/hold times; hour-aligned explicit occurrences rather than assuming seed occurrences; and empty portrait references on cloned hidden coaches. Failed attempts removed only their own scratch databases. A run whose migration changes during execution is rejected; only the final frozen run above counts.
- Read-only shared local ledger preflight confirmed `20261018000400` is **not installed**. Migration SHA-256: `4dda173a29e251ac073acf03992a38e50e09b3518851b31117bc943ad93ba82a`. No shared development, hosted or production migration was applied. No credentials/populated env files were read or persisted.
- Browser layout checks are not applicable: this ticket changes backend JSON endpoints, not a visual interface. The public handler was tested with real database data; DEV0318 and the card/page owners retain their own required browser proof.

| Criterion | Evidence | Result |
| --- | --- | --- |
| AC1 | Exact actor/booking/time/self/dataset and forged-input checks in both fresh/upgrade modes | Passed |
| AC2 | Real first-claim race, stable pair ID, exact/stale retry, withdrawal/republish and username tests | Passed |
| AC3 | Audited operator lifecycle, persistent hide across author edits and live matching public count/mean | Passed |
| AC4 | Private/public HTTP mapping, 18 DB checks, 307 application/server tests, boundaries/types/lint/build and fingerprinted migrations | Passed |

## Risks, limitations, and follow-ups

No visual review controls, live card ratings, shared development migration or hosted deployment is claimed. Apply the reviewed forward migration in the normal coordinated order before enabling consumers; its predecessor starting-rate migration is independently owned by DEV0313. DEV0318 consumes author eligibility/state/commands, DEV0316/DEV0317 consume batch summaries and public pages, and DEV0319 owns combined integration proof. Broader account deletion/retention remains DEV0165. No unresolved acceptance criterion remains for this backend slice. No new commit was requested.

## Completion and review references

- Completed: 2026-10-18 — backend implementation and required local proof passed.
- Commit: Not created; no commit requested.
- Review: Self-reviewed exact actor/role/visibility, pair/booking identity, retry/moderation races, publication population, private DTOs, migration order and parallel-file boundaries. No independent review.
- Deployment or release: None.
