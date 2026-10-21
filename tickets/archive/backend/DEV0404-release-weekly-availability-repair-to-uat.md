# Ticket DEV0404: Release weekly availability repair to uat

- Status: Completed
- Created: 2026-10-21
- Last updated: 2026-10-21
- Milestone: M10 UAT booking recovery
- Coordination: [COR0034](../organisatory/COR0034-repair-weekly-availability-performance.md)
- Related records: Diagnosis [DEV0401](DEV0401-investigate-slow-empty-week-availability.md); external SQL dependency [DEV0396](DEV0396-avoid-repeated-timezone-catalog-scans.md). Peer ownership and release order are mapped in COR0034.

## Objective and context

Install the missing DEV0396 optimization and new DEV0402 repair on guarded hosted dev, deploy DEV0403, and prove the actual UAT weekly read is fast and recovers correctly. Follow the [weekly booking contract](../../../docs/mvp-spec.md#196-cards-username-urls-and-scheduling-compatibility), [duration-aware availability](../../../docs/mvp-spec.md#186-session-types-and-flexible-bookings) and retained-data boundary. The user authorized this repair on 2026-10-21.

## Scope and non-goals

- In scope: verify exact hosted-dev project/ledger/source/alias, owner-scoped migration rollout of only DEV0396 and DEV0402, preserved-data/function contracts, UAT candidate build/promotion, actual authenticated empty/populated reads, read-only native desktop/phone smoke and exact disposable-user cleanup if needed.
- Out of scope: real production/staging/DNS/provider changes, broad migration pushes/resets/seeds, retained account edits, Git push/merge.

## Expected behavior and edge cases

UAT on Frankfurt keeps all retained account/content/scheduling data. The same actual Mas week returns seven verified empty days quickly. Authenticated UAT API remains private/no-store and guest details are denied. A uniquely tagged temporary account may authenticate without emails; only exact owned test rows/Auth users are removed. Preserve unrelated live edits; stop/reconcile an alias or migration-ledger race before promotion.

## Assumptions, decisions, and dependencies

- User repair request covers making the identified UAT problem concrete and fixed, including the previously omitted SQL rollout; no additional permission gate is inferred.
- Root ignored Vercel link selects old staging. Use UAT project `prj_CPYcoaAzkLOxWrb6Q9lOaDgtQQPA`, team `team_nyqiT81rIoWAGMpA5SnTvtSm`, explicit temporary link and preserve `MOVX_HOSTED_ENVIRONMENT=dev`.
- Migration rollback is reviewed forward restoration of original function bodies/metadata, without row rollback; prior READY UAT app is deployment rollback. Source commits are not required solely to fill a record; preserve hashes of exact deployed pending source if no new commit authorization.

## Implementation plan

1. Wait for DEV0402/DEV0403 local acceptance; verify current alias/source, project/region and dev-only runtime/owner access. Read existing hosted operation helpers/official API docs.
2. Capture row fingerprints/function metadata/ledger, confirm only the exact two missing forward migrations, apply them transactionally through existing owner channel, record ledger without broad db push; compare preservation and same-week timing.
3. Prepare an isolated validated source snapshot with explicit UAT link and no env/work/preview files; build with skip-domain, verify READY/source/region/build guard and smoke, recheck alias then promote.
4. Verify actual authenticated UAT empty/populated reads and guest denial, native desktop/phone/retry return, environment/other-project preservation and exact temporary-fixture cleanup. Keep failure recovery manifests private.
5. Record actual release/source/rollback/timings and limitations; archive when all criteria and coordination integration pass.

## Acceptance criteria

- [x] AC1: Exact two intended migrations applied to guarded hosted dev with preserved row/function contracts and correct migration ledger; no production operation.
- [x] AC2: Verified UAT candidate promoted without overwriting newer independent source, preserving Frankfurt and configuration.
- [x] AC3: Real authenticated empty/populated UAT reads and guest denial pass, with material improvement over 30.7 seconds and all exact test fixtures removed.
- [x] AC4: Native desktop/phone smoke and accurate release/rollback/integration evidence are complete.

## Validation plan

Reuse DEV0402/DEV0403 local tests; additionally require actual guarded dev-only owner metadata/preservation before/after migration, real restricted runtime timing, real authenticated HTTP to UAT using a uniquely tagged temporary account if needed, API caching/privacy checks, native desktop/phone smoke, candidate/live alias assertions and exact cleanup/final fingerprints. Build failure never activates the candidate.

## Implementation record

### Changes and operational components

Applied exactly `20261020000200_fast_scheduling_timezone_validation.sql` (existing DEV0396) and `20261021000100_prune_private_session_time_candidates.sql` (DEV0402) to guarded hosted dev, then deployed the validated DEV0402/DEV0403 application snapshot to UAT. No other migration, seed, reset or retained account edit ran.

The owner operation used one repeatable-read transaction with 30-second statement/three-second lock limits. It rechecked the exact migration ledger, captured all 57 application/Auth-user/Storage table fingerprints and both function catalog records, ran only the two intended forward migrations, compared rows/function metadata and inserted the two normal migration-ledger entries. Any preservation/ledger mismatch would raise and roll back the whole operation. OIDs, owners, ACLs, security, configuration and signatures match; only intended bodies changed. Original full function definitions were saved privately for reviewed forward rollback.

The live application previously came from main merge `bea0aa4`, deployment `dpl_Abzpd2L6V1kWjEgp8ca7kgqNE4cP`. `git fetch origin` and a full-tree comparison confirmed it matches pre-repair local HEAD `983d75946757a62cd1fd27c5b3e5af462e2ed845`. A separate source copy contains the validated pending repair, no populated env/work/preview files and an explicit UAT Vercel link. Its source manifest SHA-256 is `0bd3e9393674a6ec0701e8e0280a331d14d0c54de3dd54a356d9280fa8fd06c7`; candidate metadata records this digest. Only two deployed app files differ from that base: `src/features/session-types/public-booking.tsx` and `src/server/db/coaches/typed-session-repository.ts`. Concurrent independent DEV0405 calendar edits appeared later in the shared tree; source-manifest comparison proves they are excluded from this release and they were preserved locally.

Built candidate `dpl_BqxHG6Zs7onqzCSvfWHeD25fdNZm` without custom-domain activation. Verified READY/Node 24.x/Frankfurt/build guard/source digest and eight candidate route/privacy checks. Rechecked unchanged UAT alias and saved environment metadata immediately before promoting. https://uat.movx.club now serves this verified candidate. Saved variables, other projects' production deployment IDs, root old-staging Vercel link and root old Supabase link were not changed.

### Evidence and affected files

| Component or file | Role |
| --- | --- |
| Hosted-dev database and migration ledger | Two exact forward function repairs, atomic row/function-contract preservation and truthful installed versions. |
| UAT Vercel deployment/custom domain | Validated snapshot and source digest, candidate validation, race check and Frankfurt promotion. |
| [DEV0402](DEV0402-prune-private-time-candidates.md), [DEV0403](../frontend/DEV0403-bound-weekly-availability-loading.md) | Source implementation and local test evidence; no extra app code introduced by rollout. |
| This record, [coordination](../organisatory/COR0034-repair-weekly-availability-performance.md), [index](../../README.md) and [current contract](../../../docs/mvp-spec.md#196-cards-username-urls-and-scheduling-compatibility) | Exact delivery boundary, integrated proof and completion references. |
| Ignored `work/dev0404/` | Dev-only owner/query guards, private fixture manifest/cleanup, SQL operation/rollback definitions, source manifest, logs and safe timing/metadata summaries. These tools are not app runtime dependencies or production routes. |

### Decisions, deviations and contracts

The initial Vercel metadata API call encountered expired operator authorization; the existing official CLI refreshed normal authorization and metadata queries then succeeded. The latest alias was a newer main merge than DEV0400's initial CLI release, so compared its fetched source before preparing/promotion; runtime trees matched. A separate ignored owner workdir linked only to dev prevented the repository's old Supabase link selecting staging. No permissions, auth provider settings or credentials were changed.

No additional payload/dependency/env/schema-table/booking policy change is owned here. Function-only migrations are backward compatible with the prior application. At release time no new Git commit, merge or push was performed; the deployed source is precisely identified by base commit/file manifest/digest. On 2026-10-21 the user subsequently authorized a new branch and commits; the completed repair and records are committed on `work/weekly-availability-repair`, excluding independent DEV0405 work. This does not change the deployed artifact or imply a push or merge.

Rollback: promote previous READY UAT deployment `dpl_Abzpd2L6V1kWjEgp8ca7kgqNE4cP` (`https://movx-club-m2zg33ir2-hoangworldcoms-projects.vercel.app`) using the verified UAT project/scope, then repeat smoke. It can continue using the optimized compatible SQL functions. If SQL rollback is necessary, restore the saved original definitions/settings through a reviewed new forward migration, preserving owner/ACL and recording a new ledger version; do not delete migration history or restore application rows. No row rollback is needed. The exact owned source copy and local UI fixture server/copy were removed after checks.


## Validation results

2026-10-21, UAT/hosted dev only:

- Local prerequisite evidence: DEV0402 **68 database tests** (fresh/upgrade), original/new thirty-date/DST/duration/venue equivalence and unchanged rows/function contracts; DEV0403 **13 production UI groups** and native desktop/375×844 timeout/Retry checks. **438 app/server tests**, canonical lint/typecheck/optimized build and immutable migration history checks passed. Details belong to the peer tickets.
- Dev target guard: `hostedRuntimeConfiguration(process.env, "dev")` confirmed the expected dedicated runtime/project. Installed Supabase CLI `db query --help` was inspected. `supabase db query --workdir <private-dev-owner-dir> --project-ref mdzidiqosxbghmfyxphb --linked --file <private-sql-file> --output json` returned executor `postgres` and exactly the two expected missing local versions. Root linked project was preserved. No prod connection or key was obtained.
- `node --env-file=.env.development.local work/dev0404/migrate.mjs`: passed. One guarded transaction applied both exact function migrations plus corresponding ledger entries; **57 table fingerprints and both complete function metadata records preserved**. Evidence: ignored `database-preflight.json`, `migration-operation.sql`, `migration-result.json`, `rollback-functions.json`. No secret values were printed.
- Actual restricted-runtime `typedSessionWeekRecord` against Mas after rollout: **530.3 / 448.0 / 448.6 ms**, each seven dates with zero starts. DEV0401's exact pre-repair SQL statement took **30,689 ms**. The new repository timings include new connection/transaction overhead; these samples establish this empty-case improvement, not a load-test guarantee.
- `npx --offline vercel@64.3.1 --scope hoangworldcoms-projects --cwd <validated-source-copy> deploy --prod --skip-domain --yes --meta releaseTicket=DEV0404 --meta sourceDigest=<manifest-digest>`: passed. Remote guarded build accepted hosted-runtime/Geoapify settings and compiled Next.js 16.3.8. Candidate READY on Node 24.x in `fra1`; the custom-domain alias stayed on the previous deployment during candidate validation. The CLI emitted structured deployment JSON; parsed its deployment ID rather than assuming plain URL stdout.
- Official CLI `curl` using existing deployment-protection access: **eight candidate checks passed** (Home, Explore, Events, ready Events API, actual coach, actor denial, protected-workspace redirect and weekly-detail denial). Existing protection was preserved. Candidate HTML has no fixture controls; private detail denial keeps no-store/Cookie variance. Source-scope hash comparison excludes concurrent DEV0405 runtime edits.
- Before promotion, rechecked alias, candidate READY/project/region and unchanged saved environment metadata. `vercel@64.3.1 --scope hoangworldcoms-projects promote <candidate> --yes --timeout 60s`: passed. Post-promotion metadata, actual coach HTML deployment ID and **seven live route checks** passed; environment metadata and other projects' production deployments exactly match the before capture. Headers confirm `fra1::fra1`. Evidence: `candidate.json`, `candidate-smoke.json`, `promote.log`, `vercel-after.json`, `live-smoke.json`.
- `node work/dev0404/authenticated-check.mjs`: passed using **two uniquely tagged temporary accounts** through the real UAT password sign-in/identity enrollment and real authorized actor checks. No emails or booking requests were sent. Authenticated real Mas week returned seven empty days in **541.4 / 492.2 / 483.7 ms**, with private/no-store and `Vary: Cookie`. A separate exact temporary approved coach with three actual consecutive venue hours returned **nine full-fit 60-minute starts in 510.0 ms** through the real authenticated weekly API. Anonymous callers were denied both actual detail endpoints with 401. Actual JWT/Auth/API evidence is separate from local fixture tests.
- Full exact-cohort cleanup was first exercised as a rollback dry run, then performed in `finally` with exact UUID/email/ticket/run ownership and cross-account relationship guards. Both temporary Auth users and their exact application/Storage rows were removed. **All 57 retained table fingerprints exactly match the post-migration pre-fixture snapshot**. Private manifest records `cleanedAt` and retains no passwords/cookies; no cleanup failure remains. Evidence: `authenticated-results.json`, `authenticated.log`, private before/after fingerprint summaries and the private cleaned manifest. No real user's profile, hours, role, requests or content changed.
- Native Safari UAT actual Mas page at desktop (~1230px) and 375×844: seven current date/count cards show verified zero, no stuck status or page overflow, and sign-in stays available. Restored desktop mode and preserved unrelated tabs. Native authenticated timeout/retry/error layout was exercised through the actual components in local controlled fixtures; real hosted Auth/empty/populated reads were exercised through HTTP, not a new native login or live booking write.
- Exact deployment source copy removed. The local fixture runner's non-TTY stdin had closed, so stopped only its listener's verified parent runner via its orderly SIGTERM cleanup handler. Fixture port/source copy removed. Final record/link/index/status/coordination, changed-source scope and `git diff --check` checks passed. No broad process kill or retained launcher ran.

| Criterion | Evidence | Result |
| --- | --- | --- |
| AC1 | Exact dev/ledger guard, two transactional migrations, 57 row fingerprints and full function metadata equality | Passed |
| AC2 | Validated source digest, unchanged-base proof, protected candidate checks, alias race check and verified Frankfurt promotion | Passed |
| AC3 | Actual real-password Auth and weekly API checks for real empty/temporary populated profiles, guest denials, exact cleanup and retained hashes | Passed |
| AC4 | Native actual UAT desktop/phone public smoke, local native deadline/Retry, complete release/rollback/coordination evidence | Passed |


## Risks, limitations, and follow-ups

The reported empty-week failure is repaired and hosted evidence passes. These samples are not a populated high-concurrency load test or a full coach/athlete booking rehearsal. No independent review or production rollout. Connection/Auth setup is outside the eight-second SQL timer; the client still bounds visible read waiting at fifteen seconds. Independent DEV0405 work is preserved outside the repair commits. No temporary users or pending cleanup remain.

## Completion and review references

- Completed: 2026-10-21 — exact SQL/application repair live on UAT, real authenticated performance/privacy and cleanup evidence passed.
- Commit: Release and integration records committed on `work/weekly-availability-repair`, as authorized by the user on 2026-10-21; subject `[DEV0404] Record weekly availability UAT release and integration`.
- Review: Source/operation/acceptance self-review complete; no independent review.
- Deployment or release: [dpl_BqxHG6Zs7onqzCSvfWHeD25fdNZm](https://vercel.com/hoangworldcoms-projects/movx-club-uat/BqxHG6Zs7onqzCSvfWHeD25fdNZm), serving https://uat.movx.club; both exact SQL migrations installed on hosted dev. No production release.
