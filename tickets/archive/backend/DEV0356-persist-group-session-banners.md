# Ticket DEV0356: Persist group-session banners

- Status: Completed
- Created: 2026-10-18
- Last updated: 2026-10-19
- Milestone: Public group-session discovery
- Coordination: [COR0030 — Events cards, banners and map](../../current/organisatory/COR0030-events-cards-banners-and-map.md)
- Related records: Peer boundaries and historical dependencies are mapped by COR0030; existing group lifecycle remains [DEV0240](../../archive/frontend/DEV0240-add-group-event-discovery-and-joining.md).

## Objective and context

Persist optional, independently revisioned event banners and provide safe public card media without editing frozen session terms. Follow [group discovery](../../../docs/mvp-spec.md#151-confirmed-choices-and-implementation-defaults) and [identity/media boundaries](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity).

## Scope and non-goals

In scope: additive table/Storage policy migration; bounded normalized image upload/replace/remove for the owning active coach and an existing saved draft/future open or confirmed session; separate optimistic media revision; revocable no-store owner/public image routes; public portrait/coach-URL/coach-banner fallback projection; tests and fresh/retained-data upgrade proof. Out of scope: upload interface/cards/map (peer tickets), session terms/lifecycle changes, private account avatars, hosted migrations, resets or provisioning retained accounts.

## Expected behavior and edge cases

A session without an image remains valid. Use the existing coach-banner normalization limits (JPEG/PNG/WebP, at most 4 MiB, single frame, at least 320×120, WebP card/hero variants). Keep a separate media revision, scoped to dataset/session/owner, so image edits do not alter published dates, capacity, price or session revision. Uploading requires a saved session; owner controls follow in DEV0357. Allow edits to saved drafts and future open/confirmed sessions; deny terminal/past sessions, foreign owners/datasets and changed actor/revision. Public image routes require a currently public non-draft session and current exact image revision/path, checked before and after Storage download. Owner image reads remain actor-bound. Remove returns to coach banner, then decorative cover; portraits always use public coach media/initials. Never expose raw storage paths or account avatars in browser projections. Draft deletion must make old public URLs inaccessible; clean obsolete uploads best-effort without deleting a current reference.

## Assumptions, decisions, and dependencies

Confirmed: per-session banner with coach-banner fallback. Defaults: same image limits/variants as coach banners, independent save/revision and editable future published presentation while frozen terms remain intact. New table is empty for existing sessions; no automatic media copying or retained-data mutation. Reuse existing request-scoped Storage/Auth/normalization and public coach URL boundaries. API design must be recorded before implementation and SDK/framework docs inspected. Migration validation uses isolated disposable databases with retained-row fingerprints, not a shared reset or retained account repair. After the preservation proof, apply only this additive migration to the local development database so the requested upload and public cards can work there; fingerprint pre-existing application rows and Storage objects before and after. Hosted rollout remains separate.

## Implementation plan

1. Record adopted behavior in the specification and final API/data contract here. Inspect installed Next.js route/CSS and Storage SDK integration.
2. Add isolated media persistence, revision/ownership functions and private Storage bucket/policies with exact public visibility and reference checks. Add typed schema and narrow repository/service projections.
3. Reuse normalization/Storage workflows with explicit event scope, bounded same-origin owner API and versioned owner/public reads. Preserve all existing coach-banner behavior.
4. Add meaningful validation of input/normalization/revisions, actor/dataset/visibility/race/cleanup/retained-data boundaries and shared Storage compatibility. Run isolated migration proof, relevant tests/lint/type/build.
5. Publish stable interfaces for peers, finish evidence and archive only after required checks pass.

## Acceptance criteria

- [x] AC1: Owner upload/replace/remove and current-reference reads persist across reload with independent revisions; invalid/stale/foreign/terminal actions cannot change the banner.
- [x] AC2: Public projection includes only actual eligible event media/public coach portrait, canonical coach link and coach-banner fallback; drafts/hidden/obsolete/private data remain inaccessible.
- [x] AC3: Fresh and retained-data migration proof, meaningful boundary/normalization/Storage tests and relevant lint/type/build pass; existing scheduling terms/data and coach-banner behavior remain preserved.

## Validation plan

Use isolated local fresh/upgrade databases, synthetic owned sessions/Storage metadata and before/after fingerprints of retained rows. Prove owner/dataset/actor, draft/public/hidden/terminal/past, stale/retry/current-reference cleanup and direct Storage policy isolation. Unit/service tests cover normalization and before/after reads; API tests cover same-origin/body/revision failures without secret logging. Run existing banner/Storage/group regressions, lint/type/build. No real retained accounts, shared reset or hosted mutation; record blockers and keep incomplete evidence open.

## Implementation record

Backend acceptance criteria passed. Frontend native acceptance remains separate under DEV0357/DEV0358.

### Changes and rationale

Added independently revisioned media on existing saved group sessions. Owner APIs normalize source bytes into separate immutable card/hero objects, attach only with current actor/owner/dataset/revision checks, and clean obsolete objects without deleting current references. Public images recheck visibility and exact current reference before and after download. Event media is projected separately from the established GroupSession JSON, preserving lifecycle and registration interfaces. Draft deletion captures old image paths for best-effort cleanup after the existing delete succeeds.

### Affected files

- [Migration](../../../supabase/migrations/20261018001000_group_session_banners.sql) and [schema](../../../src/server/db/schema/group-sessions.ts): media table, actor-checked functions, private bucket/current-reference policies.
- [Event media domain](../../../src/domain/event-banners.ts), [repository](../../../src/server/db/group-sessions/banner-repository.ts) and [service](../../../src/server/group-sessions/banner-service.ts): narrow projections, normalization, mutation and revocable reads.
- [Owner API](../../../src/app/api/coach/events/[id]/banner/route.ts), [owner bytes](../../../src/app/api/coach/events/[id]/banner/[variant]/route.ts), [public bytes](../../../src/app/api/events/[slug]/banner/[variant]/route.ts) and shared owner response helper: bounded same-origin independent-revision contract.
- [Storage contracts](../../../src/server/storage/contracts.ts), [adapter](../../../src/server/storage/supabase-profile-images.ts) and [banner workflow](../../../src/server/coaches/banner-workflow.ts): explicit event-banner scope while preserving coach-banner defaults.
- [Owner lifecycle service](../../../src/server/group-sessions/owner-service.ts): post-delete cleanup; current references remain protected.
- [Database rehearsal](../../../scripts/rehearse-event-banners-database.mjs), [boundary tests](../../../tests/database/event-banners.test.ts) and [service tests](../../../tests/server/event-banners.test.ts): isolated migration, concurrency, visibility and route proof.
- [Specification §15.1](../../../docs/mvp-spec.md#151-confirmed-choices-and-implementation-defaults): confirmed banner fallback and adopted independent-save/editing limits.

### Decisions and deviations

Local rollout was added after isolated preservation proof because the requested feature requires the new functions/bucket in the same local database used by Auth and Storage. No hosted rollout or retained-data repair is included.

### Contracts, configuration, and operations

Recorded before implementation: `EventBanner` is `{schemaVersion:1,eventId,revision,editable,banner:{card:{url,width,height},hero:{url,width,height}}|null}`. Owner result is `{status:'ready'|'saved',eventBanner,cleanupPending?}` or the existing safe invalid/conflict/signed-out/forbidden/not-found/unavailable status. `GET /api/coach/events/[id]/banner` reads it; POST accepts bounded raw JPEG/PNG/WebP bytes and DELETE removes, both same-origin with `If-Match: "<media revision>"`. Owner/public variant bytes are `/api/coach/events/[id]/banner/[card|hero]?v=<revision>` and `/api/events/[slug]/banner/[card|hero]?v=<revision>`, with no-store/nosniff and current-reference checks. Snapshots contain routes/dimensions, never Storage paths. IDs are validated UUIDs and public group slugs retain the existing exact UUID-derived format.

New `app.group_session_banners` is empty for existing sessions, keyed by dataset/session with owner, independent revision and nullable paired card/hero paths. A private `event-banners` bucket reuses normalized coach-banner limits and owner-prefixed immutable object names. Mutations and Storage deletion serialize on an event-banner owner advisory lock so cleanup cannot remove newly attached current bytes. Only actor-checked functions write metadata; current public reference helpers check session/coach/dataset publicity. A narrow bounded public media batch returns current eligible event/coach references internally; the service projects public portrait URL, canonical coach URL, optional event banner and current coach-banner fallback for DEV0358. Existing GroupSession/booking JSON stays compatible. Draft deletion revokes public eligibility and metadata references; cleanup is best effort and cannot delete current references.

2026-10-18 plan update before local rollout: fresh/upgrade proof passed, but the active local application still lacks the new table and bucket. Apply exactly `20261018001000_group_session_banners.sql` to loopback local Supabase with a checked ledger, one transaction and before/after fingerprints of all pre-existing application rows and Storage objects; record the forward version in the ledger. This makes the user-requested feature usable and permits actual Auth/Storage/native integration. Do not apply unrelated pending migrations, reset, seed or alter retained accounts. Hosted rollout remains separate. Rollback stops using the new endpoints/projection first; dropping the unused media table/bucket requires an explicit cleanup operation after confirming no current references. No retained-account changes or shared reset authorized.

## Validation results

2026-10-19 commit verification: the exact staged source passed 51 frontend/domain and 16 backend regressions on Node 24.21.0, scoped ESLint/Prettier, isolated typecheck and production webpack build. Shared contract/index changes exclude unrelated work; 655 local links resolve, with the two intentionally private credential-journal links excluded from version control. DEV0358 records commands, snapshot and remaining native acceptance; committing does not complete DEV0357/DEV0358 or deploy the feature.

- `node scripts/rehearse-event-banners-database.mjs`: passed on fresh and upgrade disposable databases, nine tests each, no skips. Fingerprints of every pre-existing application table and Storage objects remained identical; new media table empty. Tests cover actor/dataset/direct-table denial, private drafts, frozen terms, public fallback/private-avatar exclusion, current replacements/stale/concurrent writes, actual advisory-lock cleanup races, hidden/deadline/past/terminal refusal and draft cascade. Exact disposable databases were removed. Log: `/private/tmp/dev0356-database-final.log`.
- `node --import tsx --conditions=react-server --test tests/server/event-banners.test.ts tests/server/coach-banner.test.ts tests/server/profile-image-storage.test.ts tests/server/coach-website-routes.test.ts`: 16 passed, including real normalization and unchanged coach-banner/Storage behavior. Log: `/private/tmp/dev0356-tests.log`.
- Scoped backend ESLint passed. `npm run typecheck` and `node node_modules/next/dist/bin/next build --webpack` passed in source snapshot `/private/tmp/movx-dev0356-lk5sqvfy`; initial backend logs `dev0356-types-final.log` / `dev0356-build.log`. Final combined checks are owned by DEV0358.
- Local additive rollout: checked ledger at `20261018000900`, applied exactly `20261018001000_group_session_banners.sql` and recorded its version in one transaction. Every prior app-table and Storage-object fingerprint matched; the new table had zero rows. Evidence `/private/tmp/dev0356-local-before.json` and `dev0356-local-after.json`. No reset/seed or retained-account edits. Hosted migration not run.
- Harness corrections: initial Storage-delete emulation lacked the Storage transaction flag; upgrade fixture used a nonexistent discipline column; both corrected before final passing proof. One interrupted disposable run was inventoried and its exact test database removed. Worktree typecheck encountered unrelated ignored `work/dev0336/commit-files` errors; the isolated source check passed without editing them.
- Real local Auth/Storage production-mode API proof passed on an exact tagged disposable coach/session: upload revision 0→1, reload persisted snapshot, private/public bytes 200, replace 1→2, obsolete public URL 404, stale removal 409, invalid image 400, remove 2→3/null, old URL 404 and coach-banner fallback. Hash of the entire original group-session row stayed identical through every mutation. Removing the temporary coach banner then yielded decorative fallback while preserving public portrait. Evidence `/private/tmp/movx-dev0358-ktwyzL/evidence/production-api-proof.json` and `/private/tmp/dev0358-rehearsal.log`; operations were executed via `node --import tsx --input-type=module` using ordinary sign-in and raw image requests on port 3158, never browser session injection.
- Final combined regression rerun: 16 backend tests passed; 22 frontend/domain regressions passed; scoped lint/format and final isolated typecheck/build passed. All 27 owned runtime files matched the production preview source. DEV0358 records environment and native limits.
- Final exact fixture cleanup passed and all 24 retained profile/coach/Storage-row fingerprints matched. Explicit read-only inventory confirmed no DEV0358 Auth users, event rows/media, owned objects or disposable DEV0356 databases remained. No retained-account changes or hosted rollout.

## Risks, limitations, and follow-ups

Frontend acceptance remains open in DEV0357/DEV0358. The 19 October Chrome retry added desktop file-picker/public-card proof; phone/recovery/keyboard/filter cases remain blocked by native control. This does not change the passed backend boundaries. Cleanup is best effort: replacing an image concurrently with draft deletion can leave an unreferenced private object; current references remain protected. Hosted rollout and deployment remain separate; the user authorized committing the preserved local implementation on 19 October.

## Completion and review references

- Completed: 2026-10-18.
- Commit: Included with this record in the user-authorized DEV0350–DEV0358 public-discovery/Events commit; see Git history for this ticket.
- Review: Self-reviewed implementation, authority boundaries, acceptance evidence and owned runtime source equality; independent review not performed.
- Deployment or release: Additive local migration 20261018001000 applied with preserved data; no hosted application/database rollout.
