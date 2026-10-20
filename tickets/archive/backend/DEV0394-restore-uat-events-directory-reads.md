# Ticket DEV0394: Restore UAT Events directory reads

- Status: Completed
- Created: 2026-10-20
- Last updated: 2026-10-20
- Milestone: M4 hosted rehearsal / M7 group-training reliability
- Coordination: None — independent development ticket
- Related records: Existing Events interface and remaining QA: [DEV0358](../../current/frontend/DEV0358-redesign-events-cards-and-map.md). Hosted lifecycle rehearsal: [DEV0241](../../current/backend/DEV0241-rehearse-group-training-and-event-loop.md). Consumers of restored UAT reads: [DEV0392](../../current/frontend/DEV0392-optimize-public-background-image-delivery.md), [DEV0393](../../current/backend/DEV0393-control-public-directory-cache-freshness.md).

## Objective and context

During the cache audit on 2026-10-20, two anonymous `GET https://uat.movx.club/api/events` probes returned HTTP 503 with `{"status":"unavailable"}`, `Cache-Control: no-store` and `X-Vercel-Cache: MISS`. Home/Explore/Events HTML returned HTTP 200, which alone does not establish successful directory data. This is an observed service-read failure, not evidence of stale browser caching or a proven database defect.

Find the cause and restore authoritative Events directory reads in UAT, with a focused fix defined after investigation. Follow [group training](../../../docs/mvp-spec.md#15-group-training-and-events), [provider/recovery boundaries](../../../docs/mvp-spec.md#61-provider-boundaries-and-operational-recovery) and the [definition of done](../../../docs/mvp-spec.md#11-definition-of-done).

## Scope and non-goals

- In scope: reproduce the failing anonymous public read, trace its deployed configuration/service/database/media dependencies, identify the failed boundary, apply one bounded repair and verify the live Events list/filter/paging/recovery path.
- Out of scope: caching the 503 response, returning fabricated successful empty results, relaxing public visibility/media permissions, resetting or reseeding UAT, changing retained coaches/sessions/uploads, production-environment changes, unrelated Events redesign or a full athlete/coach rehearsal.

## Expected behavior and edge cases

An available authoritative directory returns HTTP 200 with the current `ready` response contract and matching public data. A real empty result is a verified empty page. Invalid query input remains HTTP 400; actual unavailable dependencies remain truthful HTTP 503 with `no-store` and usable retry recovery. Hidden/draft/ineligible session/media information must not leak while fixing availability.

Filters, cursors, image presentations and loaded-session map data remain associated with the requested batch. Preserve the guard that rejects a batch if a session loses publication between the session and media reads; diagnose unexpected failures rather than disabling that consistency protection. Existing entries remain usable after a Load more failure, with no duplicates on retry.

## Assumptions, decisions, and dependencies

- Confirmed evidence: repeated 503 responses during an anonymous UAT probe. The cause, duration and affected authenticated paths are unknown; do not assert a missing migration, credentials issue or backend outage before checking.
- UAT is `uat.movx.club`, backed by the separate hosted-dev environment. Validate the exact project before any operational action; do not use a stale local linked-project setting as authority. Do not contact or modify production for this repair.
- Investigation starts read-only with deployed runtime/build metadata, sanitized server errors, configuration presence and public-query dependencies. No secrets or personal data belong in logs or this ticket.
- 2026-10-20: The user authorized starting the work on a new branch. Investigation is in progress on `dev0392-0394-public-performance`; establish a cause and small repair scope before repair edits. This does not depend on either new cache ticket. Completing it supplies a working Events baseline for their live validation.

## Implementation plan

### Adopted repair scope — 2026-10-20, before repair edits

Native Vercel inspection identified the live `movx-club-uat` project and deployment `dpl_3gcGZrsTpqpYY9TQoN4E3SdFyaYo` from commit `c96816d`. Its Production environment displays **No Environment Variables Added**. Both coach discovery and Events return unavailable; invalid Events filters still return 400. The same source's actual Drizzle-backed directory query against guarded hosted dev returns `ready` with zero items. Therefore the bounded repair is saved UAT runtime configuration plus build validation that prevents a configuration-free Production deployment from replacing the working application.

The current guard also derives the database target solely from `VERCEL_ENV`, treating every Production deployment as the production Supabase project. UAT is itself a Vercel Production deployment serving `uat.movx.club`, so add an explicit `MOVX_HOSTED_ENVIRONMENT=dev|prod` setting. Retain the existing implicit mapping when absent for compatibility; reject incomplete/missing core variables for Production or an explicit hosted target. Reject a production database on Vercel Preview and reject a dev/prod target mismatch for the known `movx.club` / `uat.movx.club` domains. Ordinary environment-free Preview builds remain supported. No page/data cache, SQL migration, authorization relaxation or schema change is needed.

Repair files: build validator, its deployment/hosted regression tests, specification section 6.1 and hosted setup guidance. Persist the existing restricted dev database/public Auth settings and exact UAT origin in the **movx-club-uat** Vercel project, using its Production environment plus the explicit dev target, and rebuild that project. Preserve optional provider configuration; investigate it without exposing credentials. The ignored local `.vercel/project.json` names the older staging project and must not direct deployment. Validate the actual UAT project before linking/deploying. Roll back a failed deployment through Vercel while retaining the corrected target configuration; do not reset data or switch to production credentials.

Diagnostic correction: the initial standalone postgres.js probe stringified a JSON parameter twice and received `group filters are invalid`. The application uses Drizzle's transparent JSON serializers; its matching diagnostic returned an object parameter and a healthy empty directory. This was a probe artifact, not the application defect, and requires no database or serializer repair. Every direct diagnostic transaction rolled back.

1. Reproduce unfiltered and representative filtered requests, recording time, status, sanitized response and cache state; inspect the actual Events page recovery state at mobile and desktop widths.
2. Trace [the API route](../../../src/app/api/events/route.ts) through directory parsing, group-session query and current public media composition. Correlate sanitized runtime failures with the deployed source/configuration and read-only database checks.
3. Update this record with the proven cause, concrete affected files/configuration, bounded repair, rollback and validation before the first repair edit. Use the repository split workflow if distinct causes require separate implementation tickets.
4. Reproduce the failing condition in isolated fixtures where possible, apply the minimal repair and add a meaningful regression for that boundary. Preserve existing permission and publication-consistency guards.
5. Run targeted tests and necessary static/build or migration checks, deploy only the verified UAT repair within the authorized implementation scope, and repeat public API and desktop/mobile list/filter/paging/retry checks. Record any deployment dependency instead of claiming live repair from local success.

## Acceptance criteria

- [x] AC1: Repeated probes and sanitized diagnostic evidence identify the failed boundary and distinguish runtime/configuration/schema/service failures from legitimate publication races or verified empty data.
- [x] AC2: A bounded repair restores authoritative HTTP 200 `ready` reads for unfiltered and representative valid filtered UAT requests; the specific original failure is covered by a regression or documented operational verification.
- [x] AC3: Invalid input, verified-empty results and actual dependency failures retain distinct 400/200/503 behavior, no-store headers and usable recovery; visibility, media authorization and batch/cursor consistency remain enforced.
- [x] AC4: Desktop/mobile Events browsing, filters, Load more, map/list association and retry pass against restored UAT data, using exact disposable fixtures only if existing public data cannot prove a case.
- [x] AC5: Required tests/checks pass, any operational change and rollback are documented, and retained application/Auth/Storage records are preserved with exact cleanup of introduced fixtures.

## Validation plan

Start with anonymous HTTP probes and sanitized runtime diagnostics. Compare the deployed source/configuration to the current route and group/media contracts. Use existing Events directory/server/database regressions relevant to the proven cause; add a failure-to-recovery check for that cause. Run lint/typecheck/build for code changes, and isolated fresh/upgrade migration and constraint checks only if the repair changes the database. Native desktop/mobile checks must cover keyboard use, ordinary GET filtering, append/retry behavior and truthful unavailable/empty states. UAT proof must distinguish live deployment from local validation. No broad data provisioning, retained-account editing or production access is required.

## Implementation record

### Changes and rationale

2026-10-20: Created `dev0392-0394-public-performance` from `c96816d`, retaining the three pending planning records and index changes. Confirmed the live UAT project had no saved Production variables, so its Git deployment built an environment-free public preview and all database-dependent discovery reads returned unavailable. The guarded hosted-dev database and the same source's Drizzle-backed directory were healthy. No database/serializer repair was needed.

The build guard now accepts the explicit application target, requires complete runtime settings for Production/explicit hosted builds, and checks known origin/target consistency while retaining safe Preview behavior and dev/prod separation. Six variables are now saved in the actual **movx-club-uat** project's Production environment: restricted `DATABASE_URL` (sensitive), public Supabase URL/key, exact UAT site origin, `MOVX_HOSTED_ENVIRONMENT=dev` and the existing public Geoapify key. The latter was recovered individually from the older staging configuration, trimmed of a trailing newline and checked with a bounded Berlin/Chimosa request returning HTTP 200 and one result. No unrelated staging variable, Solana credential, database project setting, password or account was changed or copied.

Rebuilt only UAT from the verified source snapshot. Home/Explore and public coach lookups recovered along with Events. The final deployed guard reports hosted-runtime mode with Geoapify configured; the actual Vercel deployment metadata confirms Next.js on Node 24.x. Runtime page/data/image caching was not changed.

### Affected files

| File or component                                                                                                                                                    | Investigation role                                                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Build validator](../../../scripts/validate-vercel-environment.mjs)                                                                                                  | Selects the guarded application environment independently of the Vercel label and prevents configuration-free Production publishing.                                              |
| [Deployment regressions](../../../tests/vercel-deployment.test.ts)                                                                                                   | Reproduces missing Production settings, explicit-dev UAT success, target/origin mismatches and production-database rejection in Preview, without network access or secret output. |
| [Specification](../../../docs/mvp-spec.md#61-provider-boundaries-and-operational-recovery), [hosted setup](../../../supabase/README.md#separate-hosted-environments) | Define actual target selection, persisted project configuration, build failure behavior and deployment requirements.                                                              |
| Existing Events API/directory/group/banner modules and interface                                                                                                     | Investigated and exercised unchanged; no API, authority, SQL or rendering repair was required.                                                                                    |

### Decisions and deviations

2026-10-20: Track the observed 503 separately from caching improvements so caching cannot conceal an unavailable service. Repair scope remains subject to the read-only diagnosis. No implementation deviation yet.

2026-10-20 implementation: the proven shared runtime-configuration failure expanded the recovery verification to Home/Explore without altering their source. Restored the already-used optional search setting as part of the lost project configuration. No cache changes or migrations were added. One initial temporary fixture setup attempted publication at revision zero; the existing authority correctly rejected it. That attempt was completely cleaned with unchanged retained fingerprints, and the successful fixture used the saved draft's revision one.

### Contracts, configuration, and operations

New optional build setting: `MOVX_HOSTED_ENVIRONMENT=dev|prod`; UAT sets `dev` even on Vercel Production. Known UAT/apex origins must match that target. Existing implicit label mapping remains when unset; a prod database still cannot be used in Preview. Missing/partial core configuration now fails Production or explicit hosted builds. This deliberately stops environment-free Production publishing; non-production public previews remain supported.

No dependency, schema, migration, API shape, permission or media-cache contract changed. Project variables are persisted for future deployments rather than passed only to one CLI invocation. The repository's ignored root `.vercel/project.json` still points to the old staging project and was preserved; operations/deployment used a separate link verified as UAT project `prj_CPYcoaAzkLOxWrb6Q9lOaDgtQQPA`. Production Supabase was not contacted or changed. Vercel project Production means UAT's live deployment category here, not the real production application.

Rollback uses the last known working UAT deployment while preserving the correct saved runtime settings; do not roll back to the confirmed environment-free failed deployment. Keep dev credentials scoped to UAT. The build guard must be integrated from this feature branch before future main deployments can pass with the saved explicit dev target. A failed older main build leaves the current ready UAT deployment serving. No merge, commit or push is implied by the live operational repair.

## Validation results

2026-10-20, live UAT: two anonymous GET probes returned 503/unavailable with no-store and cache MISS. A repeated `curl -sS -i 'https://uat.movx.club/api/events'` response at 10:54:11 UTC (12:54:11 Europe/Berlin) confirmed the failure. HTML endpoints returned 200 but directory rendering was not verified. These observations reproduce the symptom; they do not satisfy the repair criteria.

2026-10-20 planning checks: Python local-link/anchor and record-consistency validation passed for all three new tickets and the index (376 references, unique IDs, required sections and matching Draft entries). `prettier --check` passed for the three new records; `git diff --check` passed. Application tests/build and new live browser checks were not run because this change creates planning documents only.

| Criterion | Evidence                                                                                                                                                                                                                                                      | Result |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Native Vercel environment inventory, repeated live 503/MISS responses and healthy same-source guarded-dev directory comparison identify absent deployment configuration.                                                                                      | Passed |
| AC2       | Unfiltered/Boxing/venue-filtered live Events reads return 200/ready; nonexistent coach lookup returns 404 rather than 503; missing-configuration regression prevents republishing the failure.                                                                | Passed |
| AC3       | Original actual failure was 503/unavailable/no-store; post-repair verified empty is 200/ready with zero items, invalid/repeated malformed query/cursor cases return 400, and all API checks retain no-store. Existing authority/media code remains unchanged. | Passed |
| AC4       | Native Chrome desktop and phone paging, appended map selection, offline retention/recovery and keyboard filtered-empty/reset checks described below.                                                                                                          | Passed |
| AC5       | 431 tests, static/build checks, verified UAT deployment and complete exact fixture cleanup with unchanged retained fingerprints.                                                                                                                              | Passed |

Implementation validation on 2026-10-20, Node 24.21.0 / Next.js 16.3.8:

- `node_modules/.bin/tsx --test tests/vercel-deployment.test.ts tests/hosted-environment.test.ts`: 14 passed, zero failures/skips. These exercise real validator subprocesses using synthetic settings only, including the original configuration-free Production case and the explicit-dev UAT deployment boundary.
- `npm test`: 363 unit plus 68 server tests passed (431 total), zero failures/skips. Scoped ESLint passed for both changed script/test files. Full `npm run lint`, `npm run typecheck` and `NEXT_TELEMETRY_DISABLED=1 npm run build -- --webpack` passed in a fresh git-archive snapshot overlaid with the actual pending changes. The snapshot excludes unrelated ignored work/tmp source copies under DEV0371; project check rules were not changed.
- `node --env-file=.env.development.local --input-type=module -e 'process.env.VERCEL_ENV="production";process.env.MOVX_HOSTED_ENVIRONMENT="dev";process.env.NEXT_PUBLIC_SITE_URL="https://uat.movx.club";await import("./scripts/validate-vercel-environment.mjs");'`: accepted the actual guarded dev configuration without printing values.
- Vercel CLI `project inspect movx-club-uat --scope hoangworldcoms-projects` confirmed the target before mutations. `env ls production` confirmed no saved variables. Six targeted `env add … production` operations persisted only UAT settings; secret values were supplied through stdin and never included in command arguments/output. The CLI refreshed its existing authorization normally; no new access grant was created.
- `vercel --prod --yes --scope hoangworldcoms-projects --cwd <verified-source-snapshot>` rebuilt UAT. The first recovery deployment restored core reads; the second included the recovered optional search setting. Final remote build logged `Validated production Vercel build in hosted-runtime mode (OpenFreeMap enabled; Geoapify search configured)`. Deployment metadata reports READY, Next.js, Node 24.x and the `uat.movx.club` alias. CLI 48.1.6 emitted an outdated local Node-range recognition warning; actual remote metadata and successful build confirmed Node 24.x, with no engine downgrade.
- Private `node work/dev0394/check-live.mjs`: venue and Boxing reads returned 200/ready with the expected first 20 records, nonexistent venue returned verified 200/empty, invalid key/cursor requests returned 400, and nonexistent public coach returned 404. Responses kept no-store. Separate first/next batch requests returned 20+3 unique session IDs and a null final cursor. Public API responses contained only their current matching media presentations.
- Native Chrome Incognito desktop (1390-pixel window): Events showed 20 cards and venue map; Load more appended three and announced the addition, with focus on Class 21. Selecting newly appended Class 22 selected its matching marker and map details while retaining all 23. The same UI showed healthy Home and truthful empty content before the temporary fixture appeared.
- Native phone emulation: iPhone XR 414×896 showed the responsive single-column/List–Map flow. Pagination appended to 23; selecting Class 22 switched to map while retaining 23 loaded sessions and showing the matching Class 22 details. An additional responsive-width offline simulation failed the next-batch fetch, kept all 20 existing card headings, and displayed the explicit retry message; online recovery loaded the final three. Keyboard Tab reached Find sessions from the verified search input; Enter submitted the exact non-personal test filter and displayed 0 loaded/“No upcoming sessions here yet.” Restoring the fixture filter with the keyboard returned the first 20 and removed the empty state. Browser clipboard/context-menu input issues were corrected before submission; no unintended search was submitted.
- `node work/dev0394/cleanup.mjs`: removed the one successfully tested temporary coach/Auth identity and all 23 sessions plus associated temporary records. Guarded cleanup verifies the exact ticket/run/identity ownership and refuses cross-cohort registrations. All 57 retained application/Auth/Storage fingerprints match the baseline; zero DEV0394 Auth users, profiles or sessions remain. No uploaded test objects were needed. The fixture venue query again returns 200 with zero items after cleanup. The earlier failed setup was also fully removed with matching retained fingerprints.
- No database migration/constraint change was made, so a new fresh/upgrade database rehearsal was not applicable. No permanent browser runner was added for an operational configuration repair. Private diagnostics, fixture journals, deployment/build logs and summaries live under ignored `work/dev0394/`; this ticket preserves the reviewable outcomes without requiring those files or exposing credentials.
- Final documentary checks: all 521 local file/anchor references across the three new records, index, changed specification and hosted guide resolve. DEV0392–DEV0394 are unique and the next identifiers remain DEV0395/COR0034. Prettier passed for changed script/test and new records; `git diff --check` passed. Only the completed DEV0394 record moved to the archive; the other two tickets remain Draft. The owned Incognito QA window was closed after networking was restored.

## Risks, limitations, and follow-ups

Existing DEV0358/DEV0241 broader acceptance remains owned by those records. This repair restores UAT and guards the proven deployment failure; it does not optimize background photos, introduce directory caching or claim a full athlete/coach rehearsal. DEV0392/DEV0393 remain separate pending work. Main-branch integration of this verified feature-branch guard remains an operator/development step; no Git merge or push was performed. Retained accounts, content, source photographs, old staging settings and production data remain preserved.

## Completion and review references

- Completed: 2026-10-20 — root cause identified, build guard/configuration repaired, live UAT reads and responsive recovery verified, and all disposable data removed with retained fingerprints unchanged.
- Commit: Included with its implementation and validation in the user-requested checkpoint subject `[DEV0392][DEV0393][DEV0394] Save background caching and UAT recovery`; resolve its exact hash in Git history.
- Review: Changed validator/test/docs and actual UAT target/variable scope self-reviewed against AC1–AC5; no independent review.
- Deployment or release: UAT [dpl_929wUE6CZKSs4yLfbudgkUfQ4Two](https://vercel.com/hoangworldcoms-projects/movx-club-uat/929wUE6CZKSs4yLfbudgkUfQ4Two), serving https://uat.movx.club. No production application deployment or data change.
