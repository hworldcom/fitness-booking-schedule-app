# Ticket DEV0395: Pin UAT functions to Frankfurt

- Status: Completed
- Created: 2026-10-20
- Last updated: 2026-10-20
- Milestone: Hosted UAT performance maintenance
- Coordination: None — independent development ticket
- Related records: Investigation: [DEV0368](../../current/backend/DEV0368-investigate-public-availability-read-latency.md). Independent image delivery: [DEV0392](../../current/frontend/DEV0392-optimize-public-background-image-delivery.md). Independent cache policy: [DEV0393](../../current/backend/DEV0393-control-public-directory-cache-freshness.md). Hosted target guard: [DEV0394](DEV0394-restore-uat-events-directory-reads.md).

## Objective and context

The user authorized the isolated region fix and UAT deployment after DEV0368 found US application functions querying the Frankfurt hosted-dev database. Restore colocated execution and persist the setting for future deployments. Follow the [infrastructure boundary](../../../docs/mvp-spec.md#6-application-and-infrastructure-boundaries), [hosted target guard](../../../docs/mvp-spec.md#61-provider-boundaries-and-operational-recovery) and [definition of done](../../../docs/mvp-spec.md#11-definition-of-done).

At the start of this change, the live alias pointed to the independently delivered image-sizing release `dpl_DMM5dL59ytFjmFwqqFigDXmoft1d` (Node 24.x, `iad1`). Use that source as the comparison baseline; do not roll back its image work to the preceding release. The UAT project defaulted to `iad1`; repository configuration had no explicit region. Read-only Supabase project metadata confirms both configured dev and prod databases are in `eu-central-1` (Frankfurt).

## Scope and non-goals

- In scope: pin `fra1` in `vercel.json`; align only the actual UAT project's function default; capture a current same-source baseline; build an isolated region-only release preserving the current image delivery; deploy/verify UAT; record timings, rollback and contributor guidance; make a separate scoped commit as proposed and accepted in chat.
- Out of scope: cache logic/freshness/TTL, database connection reuse, Auth behavior, UI changes, migrations, data edits, fixture creation, production/staging project changes, Git merge or push.

## Expected behavior and edge cases

The aliased UAT application executes functions in `fra1` against the existing guarded dev database. Core variables, Auth/site origin, image URLs/widths/quality/cache headers, public empty/unavailable distinctions and private access denials remain unchanged. The repository pin applies to future deployments using this configuration; it does not move any other live project. Both configured database regions support this choice.

Protect concurrent work: preserve unrelated working-tree edits, prepare a separate source copy, inspect the live alias immediately before deployment, and do not replace a newer independent release with an older source. If the alias changes during preparation, refresh the source/baseline or rebuild before activation. A failed candidate must not replace a healthy live deployment. Existing ready UAT release is rollback; no database rollback is needed.

## Assumptions, decisions, and dependencies

- Confirmed 2026-10-20: user accepted doing the region fix alongside cache work, with its own ticket/commit and serialized UAT deployment/comparison.
- Adopted: repository `regions: ["fra1"]` plus the matching UAT project default makes both source-based and default-based subsequent deployments choose Frankfurt. Only UAT is deployed here.
- Installed Next.js is 16.3.8. Its bundled `preferredRegion` guide delegates placement to the platform; use Vercel configuration without changing route code. Official [function-region](https://vercel.com/docs/functions/configuring-functions/region) and [project update](https://vercel.com/docs/rest-api/projects/update-an-existing-project) documentation were inspected.
- The ignored root Vercel link selects old staging. Use a separate link and assert UAT project ID `prj_CPYcoaAzkLOxWrb6Q9lOaDgtQQPA`, team `team_nyqiT81rIoWAGMpA5SnTvtSm`, before any mutation. Preserve restricted dev settings and `MOVX_HOSTED_ENVIRONMENT=dev`.
- A region improvement is expected, not promised. Record cold/warm samples and actual navigation separately. No authenticated timing claim is required for this placement-only change.

## Implementation plan

1. Snapshot current UAT alias/region, safe project/configuration metadata, six-route HTTP timings and desktop/phone navigation. Verify both database regions through project metadata without contacting either database.
2. Add the one-region repository pin and concise hosted-operating guidance. Copy the latest deployed source into an isolated directory, excluding populated environment files/build outputs, and change only its Vercel region configuration. Record source comparisons against the baseline copy.
3. Run focused existing deployment/hosted-environment tests, configuration format checks and the isolated production build/static checks appropriate to the unchanged application source. Do not add a test that merely repeats the JSON literal.
4. Patch only UAT function-region settings, preserve other settings, and build a candidate without activating its aliases. Verify READY/region/build guard, recheck the current alias, then promote only the verified candidate.
5. Repeat HTTP/privacy smoke, desktop/phone navigation and representative image/source/header comparisons. Record measured before/after, exact scope and rollback. Finish/archive this record, update index/links and create a scoped DEV0395 commit without unrelated edits or a push.

## Acceptance criteria

- [x] AC1: Repository and verified UAT project explicitly select Frankfurt; other live projects and saved environment settings are unchanged.
- [x] AC2: The READY UAT alias/deployment and live response headers confirm `fra1` execution on Node 24.x with the existing guarded dev target.
- [x] AC3: The deployed application/image source is the current baseline plus region configuration only; concurrent image/cache work is preserved.
- [x] AC4: Repeated public HTTP, private signed-out denial, desktop/phone navigation and image delivery checks pass with recorded comparable timing results.
- [x] AC5: Relevant tests/static/build/document checks and scoped review pass; implementation, rollback and completion evidence are recorded, archived and committed independently.

## Validation plan

Use three rounds of the six routes from DEV0368 (Home, Explore, Events, public Events API, How it works, Sign in), at most two parallel HTTP reads, recording time to first byte, total time, region and cache status. Run fresh Chrome contexts at desktop/phone widths, then click Explore/Events and measure route completion. Check protected pages/APIs remain redirected/401 signed out. Compare hero attributes/source URLs and optimized response bytes/headers against the same-source baseline; retain truthful empty states. Inspect Vercel API deployment metadata and project settings before/after. Run existing deployment/hosted tests and static/build checks on the isolated source. No database writes, fixtures or migrations are needed; database mutation tests and authenticated account creation are not applicable. Review changed files and preserve unrelated dirty changes. Check local documentation targets, unique ticket/index lifecycle and whitespace before the scoped commit.

## Implementation record

### Changes and rationale

Added `regions: ["fra1"]` to repository Vercel configuration and operating guidance for checking actual function placement and serializing independent UAT releases. The verified UAT project's Fluid compute default is now Frankfurt; its legacy region field follows automatically. All other resource settings matched the captured before state.

Prepared a separate source copy from the latest live image-sizing release. Vercel's deployed source-file SHA-1 identifiers match 1,081 copied files; the only application/configuration difference is `vercel.json`. Excluded generated Next.js/TypeScript files and browser-test result artifacts are listed in ignored `work/dev0395/deployed-source-verification.json`; there are no source mismatches. No populated environment file was copied. Built a candidate with automatic UAT-domain assignment disabled, verified its Frankfurt execution and hosted guard, rechecked the live alias/environment, then promoted it. UAT now serves `dpl_HWfJF4upA9FVCxk3CS8mfhZivero` in `fra1` on Node 24.x.

### Affected files

| File or component                                                              | Change and purpose                                                                 |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| [Vercel configuration](../../../vercel.json)                                   | Pins Frankfurt for subsequent source-based deployments.                            |
| [Hosted setup guide](../../../supabase/README.md#separate-hosted-environments) | Explains region checks, separate source copies and candidate promotion safeguards. |
| This record and [index](../../README.md)                                       | Own this region-only scope, status, measurements and release evidence.             |

No application/cache code is owned by this ticket. Supporting scripts/logs remain ignored under `work/dev0395/`.

### Decisions and deviations

2026-10-20: Adopt the newly deployed DEV0392 step-3 release as the baseline rather than the older image-compression release. This prevents the region fix reverting independent image work.

The initial project PATCH supplied both legacy and Fluid compute region fields and returned HTTP 400 without applying a change. A narrow PATCH of only `resourceConfig.functionDefaultRegions` succeeded; Vercel synchronized the legacy field to `fra1`. The API result was compared against all previous resource settings. Source comparison initially included four transient browser screenshots removed by the independent test run; restricting comparison to source/configuration and explicitly listing excluded generated/test artifacts established the exact baseline without changing runtime files.

The first signed-out smoke harness guessed `/my-sessions`, which correctly returned 404. Source inspection confirmed the actual route is `/sessions`; the corrected full smoke passed. The first post-promotion desktop Explore navigation and one HTTP Explore sample remained slow, so an additional idle browser run was recorded rather than discarding those samples. All measurements below retain that distinction.

### Contracts, configuration, and operations

Region-only configuration change. No API/schema/data/dependency or environment-value change. UAT-only `PATCH /v9/projects/prj_CPYcoaAzkLOxWrb6Q9lOaDgtQQPA` sets `resourceConfig.functionDefaultRegions` to `["fra1"]`; all other resource settings are preserved. Rollback can promote baseline deployment `dpl_DMM5dL59ytFjmFwqqFigDXmoft1d` with `npx --yes vercel@64.3.1 promote movx-club-pm89an0hk-hoangworldcoms-projects.vercel.app --yes --scope hoangworldcoms-projects` from the isolated UAT link, restoring its existing Washington execution. If rolling back the default itself is necessary, restore the exact former UAT region setting `["iad1"]`; no database rollback or other project change is needed. Root `.vercel/project.json` remains the old staging link and is not used by this task.

## Validation results

2026-10-20, Node 24.21.0, installed Next.js 16.3.8. Isolated-source commands ran with the supported Node binary first on PATH:

- `node_modules/.bin/tsx --test tests/vercel-deployment.test.ts tests/hosted-environment.test.ts`: 14 passed, zero failures/skips.
- `npm run lint`, `npm run typecheck`, `NEXT_TELEMETRY_DISABLED=1 npm run build -- --webpack`: all passed in the isolated release copy. No repository lint/typecheck configuration was changed.
- `node_modules/.bin/prettier --check vercel.json`: passed. No test duplicating the JSON region literal was added; actual deployment metadata/HTTP checks validate placement.
- `node work/dev0395/vercel-api.mjs before`: captured the exact baseline, UAT project region, safe environment-variable metadata and other-project regions/production-deployment IDs. Tokens/values are not printed or saved in this record.
- `python3 work/dev0395/measure-http.py before`: 18/18 public requests returned 200/MISS, `fra1::iad1`; median first-byte seconds: Home 1.439, Explore 1.328, Events 1.364, Events API 1.297, How it works 0.210, Sign in 0.230. Later TCP/TLS costs were approximately 0.04–0.06 s; all directory responses remained no-store.
- `node work/dev0395/measure-browser.mjs before`: actual desktop/phone Chrome clicks to Explore/Events took 1.330/1.436 s at 1440×1000 and 1.815/1.571 s at 393×852. These are fresh signed-out browser contexts, not authenticated or physical-device evidence.
- `python3 work/dev0395/measure-images.py before`: all three hero attributes and optimized 1080-pixel WebP body hashes captured; Home 113,038 bytes, Explore 79,154 and Events 273,902, each one-year immutable. This baseline already includes DEV0392 responsive sizing.
- Read-only source comparison against `GET /v6/deployments/<baseline-id>/files`: 1,081 source files match; only candidate `vercel.json` differs. Generated/test artifacts were excluded explicitly.

- Candidate creation from the isolated source: `npx --yes vercel@64.3.1 deploy --prod --skip-domain --no-wait --yes --scope hoangworldcoms-projects --meta workTicket=DEV0395 --meta baselineDeploymentId=dpl_DMM5dL59ytFjmFwqqFigDXmoft1d`. READY deployment `dpl_HWfJF4upA9FVCxk3CS8mfhZivero` reports `["fra1"]`, Node 24.x. Build events include `Validated production Vercel build in hosted-runtime mode (OpenFreeMap enabled; Geoapify search configured)` and `Build Completed in /vercel/output [11s]`. UAT remained on the baseline before activation.
- Before activation, `npx --yes vercel@64.3.1 curl <path> --deployment https://movx-club-3gyny8cxu-hoangworldcoms-projects.vercel.app -- <curl-options>` used existing CLI protection access without changing protection settings. Home returned 200, Events API 200/ready/empty, private session-type API 401; all headers confirm `fra1::fra1`.
- Immediately rechecked the original UAT alias, candidate READY/region, correct UAT project and unchanged saved environment metadata. `npx --yes vercel@64.3.1 promote https://movx-club-3gyny8cxu-hoangworldcoms-projects.vercel.app --yes --scope hoangworldcoms-projects --timeout 60s` passed. Alias lookup and actual hostname responses confirm the new candidate.
- `node work/dev0395/vercel-api.mjs after`: UAT alias selects the READY candidate, project/default region is Frankfurt, saved variable IDs/targets/types/updated timestamps are unchanged, and every other project's regions/production-deployment IDs match the before capture.
- Deployed before/after file-tree comparison: 1,082 non-generated source entries in each deployment; exactly one difference, `src/vercel.json`. The other 1,081 entries match SHA-1 identifiers, including image configuration and app source. No cache/image edits were introduced or reverted by this release.
- `python3 work/dev0395/measure-http.py after`: 18/18 public requests returned 200/MISS and `fra1::fra1`; page/API no-store headers remain unchanged. All three samples per route are preserved in ignored before/after JSON, with medians below. First post-promotion samples were Home 0.420, Explore 0.480, Events 0.509 and Events API 0.373 s. Explore round 2 was 0.947 s; this is included in its median. This is a small controlled same-source comparison, not a production percentile or guaranteed latency target.

| Route        | Before median first byte (s) | After median first byte (s) | Reduction |
| ------------ | ---------------------------: | --------------------------: | --------: |
| Home         |                        1.439 |                       0.217 |     84.9% |
| Explore      |                        1.328 |                       0.480 |     63.8% |
| Events       |                        1.364 |                       0.234 |     82.8% |
| Events API   |                        1.297 |                       0.204 |     84.3% |
| How it works |                        0.210 |                       0.159 |     24.3% |
| Sign in      |                        0.230 |                       0.163 |     29.1% |

- `node work/dev0395/measure-browser.mjs after`: first post-promotion desktop/phone Explore/Events clicks took 1.316/1.042 s and 0.309/0.303 s. Because desktop still had a slow sample, `node work/dev0395/measure-browser.mjs after-warm` repeated the same fresh-context flow under idle conditions: desktop 0.269/0.308 s, phone 0.249/0.276 s. Do not describe all desktop first navigations as sub-second; this follow-up records observed variability.
- `python3 work/dev0395/measure-images.py after`: all three hero source/srcset/sizes/style/loading attributes, 1080-pixel optimized body hashes/lengths/content types and immutable headers exactly match baseline. No source photograph/crop/image setting changed here.
- `node work/dev0395/check-live.mjs`: Account, Coach, actual My sessions `/sessions` and Messages redirect 307 to sign-in with return context; actor, owner session types, Messages and a valid individual-private-times query return 401 with private/no-store. Events API stays 200/ready with zero items and no-store, distinct from unavailable. All region headers confirm Frankfurt. No account credentials or fixture were used.

No database test is applicable because this task changes no database logic/schema and performs no data mutation. Full unit/browser suites are not repeated because unchanged application behavior is covered by the focused existing tests, build and actual live route/navigation/image/privacy checks. Authenticated timing and populated-calendar performance are outside this placement-only acceptance.

Final self-review covers the one-region configuration, hosted guidance, complete evidence and archive/index references. Python validation passed 344 local targets/anchors, unique archived/completed DEV0395 placement, matching index/next-ID status, supported JSON and the preserved root staging-link hash. Prettier passed for the new record/configuration and `git diff --check` passed. The separate completion commit contains only `vercel.json`, hosted guidance, this record and its own index changes; unrelated DEV0368/DEV0392 changes remain outside it. Commit subject is `[DEV0395] Pin UAT functions to Frankfurt`; its unique subject is the durable Git reference for this self-containing record.

| Criterion | Evidence                                                                                                       | Result |
| --------- | -------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Repository pin, narrow project PATCH, preserved resource settings/environment metadata/other projects          | Passed |
| AC2       | READY candidate, hosted-runtime build guard, live UAT alias and `fra1::fra1` headers                           | Passed |
| AC3       | 1,082 deployed-source entries compared, only Vercel config differs; identical image bodies/presentation        | Passed |
| AC4       | 36 public timing requests, candidate/live private denials, desktop/phone clicks, image checks                  | Passed |
| AC5       | 14 tests, lint/types/build, documentary/archive/index/whitespace checks and four-file scoped completion commit | Passed |

## Risks, limitations, and follow-ups

Concurrent UAT releases were checked before activation. Region placement does not resolve repeated connections, populated-calendar computation or cache freshness; DEV0368/DEV0393 retain those independent boundaries. Signed-out response/navigation improvement is measured; no authenticated/physical-device or long-running traffic percentile is claimed. One first desktop navigation remained slow, with later idle runs faster. Independent cache/image edits remain outside this commit.

## Completion and review references

- Completed: 2026-10-20 — UAT colocated with Frankfurt database, durable placement settings and same-source comparison verified.
- Commit: `[DEV0395] Pin UAT functions to Frankfurt` (standalone completion commit; find with `git log --all --fixed-strings --grep='[DEV0395] Pin UAT functions to Frankfurt'`). No push performed.
- Review: Scope, changed files and acceptance evidence self-reviewed; no independent review.
- Deployment or release: [UAT](https://uat.movx.club) serves READY [dpl_HWfJF4upA9FVCxk3CS8mfhZivero](https://vercel.com/hoangworldcoms-projects/movx-club-uat/HWfJF4upA9FVCxk3CS8mfhZivero), `fra1`, Node 24.x. Actual production and old staging were not deployed.
