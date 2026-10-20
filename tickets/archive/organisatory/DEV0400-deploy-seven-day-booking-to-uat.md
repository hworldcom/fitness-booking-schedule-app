# Ticket DEV0400: Deploy seven-day booking to UAT

- Status: Completed
- Created: 2026-10-20
- Last updated: 2026-10-20
- Milestone: M10 coach marketplace UAT release
- Coordination: None — independent development ticket
- Related records: Source delivery [DEV0399](../../archive/frontend/DEV0399-implement-seven-day-athlete-booking.md), accepted preview [DEV0397](../../archive/frontend/DEV0397-preview-seven-day-athlete-booking.md), separate documentation [DEV0398](../../archive/organisatory/DEV0398-record-admin-subdomain-target.md), hosting baseline [DEV0395](../../archive/backend/DEV0395-pin-uat-functions-to-frankfurt.md). Independent pending migration [DEV0396](../../archive/backend/DEV0396-avoid-repeated-timezone-catalog-scans.md) is outside this release.

## Objective and context

The user requested committing and deploying the completed seven-day booking change on 2026-10-20. Release the exact committed source to https://uat.movx.club and verify availability/privacy and responsive presentation. Follow the [hosted target boundary](../../../docs/mvp-spec.md#61-provider-boundaries-and-operational-recovery) and [seven-day booking contract](../../../docs/mvp-spec.md#196-cards-username-urls-and-scheduling-compatibility).

## Scope and non-goals

- In scope: exact committed-source snapshot, explicit UAT Vercel link, candidate build without alias promotion, read-only smoke, alias recheck and promotion, live smoke/native desktop and phone review, rollback and evidence.
- Out of scope: production/staging releases, Git merge/push, DNS/environment changes, database migrations, account/retained data edits, dummy users and live request mutations. The separate admin hostname remains documentation only.

## Expected behavior and edge cases

UAT runs the completed seven-day booking source against its existing guarded hosted-dev configuration in Frankfurt. Signed-in booking uses daily times and bounded weekly navigation; guest counts/sign-in and private detail denial remain. Build failure leaves the ready UAT alias unchanged. If another release changes that alias during preparation, investigate/reconcile before promotion. Use the initial READY deployment as rollback; no data rollback is needed.

## Assumptions, decisions, and dependencies

- Authorized: user requested commit and deploy. Implementation/local checks are complete under DEV0399. Booking/preview commit is `79acab4`; separate DEV0398 documentation commit is `fe74512` and supplies the exact source snapshot.
- Actual UAT project is `prj_CPYcoaAzkLOxWrb6Q9lOaDgtQQPA`, team `team_nyqiT81rIoWAGMpA5SnTvtSm`. Root ignored Vercel link selects old staging and must remain untouched. A temporary source copy gets an explicit UAT link.
- Initial UAT alias is READY `dpl_6BAG82GfyKEYg7kedtJ6WBFi1MfE`, source `07d09891b6ff3743ddeb3d2618c642ebedeba4ff`, Frankfurt. Its source tree equals our pre-change HEAD despite the merge commit; no newer runtime changes are being overwritten.
- Vercel Production deployment category belongs to the UAT project, not the real production product/database. Preserve saved configuration and `MOVX_HOSTED_ENVIRONMENT=dev`.
- No fixture accounts or real booking writes are necessary for release smoke; signed-in local fixture evidence remains distinct from live hosted Auth proof. No pending migration is applied as a side effect.

## Implementation plan

1. Review changes/records and make ticket-scoped implementation/documentation commits. Confirm current alias/source, project identity, Frankfurt and saved environment metadata.
2. Export exact committed source without populated env/build/work/preview artifacts; create only its ignored UAT project link. Build using saved UAT settings with `--prod --skip-domain`.
3. Require READY, correct project/region/build guard, candidate HTTP/API privacy checks and unchanged alias before promotion.
4. Promote only that verified candidate; inspect custom-domain deployment, public/guest/API smoke and native desktop/phone layout. Do not create users or write retained data.
5. Record exact commands/results, source/release/rollback and limitations; complete/archive/index and commit this operational record. Remove the exact temporary source copy after deployment.

## Acceptance criteria

- [x] AC1: Exact source commits are recorded; no ignored previews/env/work files enter Git or release, and target/region/configuration boundaries are preserved.
- [x] AC2: Candidate remote build succeeds and READY UAT promotion points the custom domain to the verified deployment.
- [x] AC3: Live public/guest and private-access smoke plus desktop/phone checks pass; no retained account/data or migration changes are made.
- [x] AC4: Rollback, actual evidence, remaining limits and source/release references are recorded with index/links consistent.

## Validation plan

Use Git staged/source inspection and existing DEV0399 local validation (438 application/server tests, 62 scratch DB checks, production responsive rehearsal, lint/type/build). Read Vercel metadata without printing secrets; run the remote guarded Next build and require Frankfurt. Probe Home/Explore/Events and a real public coach, authenticated-detail denial and protected redirects; inspect the public profile at desktop/mobile in an owned Safari tab. Compare environment metadata and other project deployment IDs before/after, confirm the alias has not raced, and check record links/whitespace. This rollout changes no source logic, so repeating all local suites is unnecessary unless a build or smoke failure requires changes. Real-account authenticated writes and database migration tests are not applicable to a read-only deployment smoke.

## Implementation record

### Changes and rationale

Committed the adopted preview/runtime booking delivery as `79acab4` (`[DEV0397] [DEV0399] Implement seven-day athlete booking`) and the unrelated completed admin-hostname documentation separately as `fe74512` (`[DEV0398] Record the admin subdomain target`). Shared specification/index edits were staged separately; ignored previews, work copies, credentials and image binaries were excluded.

Exported exact source `fe745129cbcc633cd16919101efe03d75559a6f9` with `git archive` to an owned temporary directory. Its 1,098 tracked files contain no populated env file, ignored preview/work tree or old Vercel link. Added an ignored link to the verified UAT project only in this copy. The fetched main merge `07d0989` has the same source tree as our pre-change HEAD, proving the current UAT runtime baseline is preserved.

Built candidate `dpl_HipsAuJgJiQFFPtTG558VmgJHKCZ` without domain activation, verified READY/Node 24.x/Frankfurt/source metadata and eight read-only HTTP checks, then rechecked the initial alias and unchanged environment metadata immediately before promotion. Promoted only this verified candidate to https://uat.movx.club. Live metadata and HTML deployment identity confirm the same release. Root staging linkage, saved UAT variables and every other project's production deployment remain unchanged. No Git push or merge was performed.

### Affected files and operational components

| File or component | Role |
| --- | --- |
| UAT Vercel project `movx-club-uat` | New immutable deployment and custom-domain promotion, retaining Frankfurt and saved guarded-dev settings. |
| [Specification](../../../docs/mvp-spec.md#196-cards-username-urls-and-scheduling-compatibility) | Dated UAT rollout reference, distinct from implementation/local and real-account rehearsal evidence. |
| This record and [ticket index](../../README.md) | Commit/source/release/rollback evidence and accurate completion ownership. |
| Ignored `work/dev0400/` | Safe source/metadata summaries, build and promotion logs, candidate/live smoke evidence. No evidence artifacts are required in production. |

### Decisions and deviations

2026-10-20: The deployment URL enforces existing Vercel protection (anonymous probe returned 302). Use the already cached official CLI 64.3.1 `curl` with the operator's existing access; no protection settings or access grants changed. CLI global options must precede its `curl` command: the initial placement after `--deployment` reached native curl and failed before an application request. Corrected and reran all eight candidate checks. Installed CLI 48.1.6 performed the remote upload/build; its obsolete Node-range warning did not affect the actual Node 24.x build.

An initial live copy assertion omitted the word “the” from the expected sentence. The HTML already identified the correct deployment; corrected the assertion to the actual source copy and all eight live checks passed. Safari service/AX refresh errors interrupted initial navigation; reconnecting and using the address bar/reload completed desktop, phone and selected-day sign-in checks. These are tooling/probe failures, not application regressions. No runtime source/configuration changes were needed.

### Contracts, configuration, and operations

No additional API/schema/dependency/env contracts changed by this rollout. Source contracts remain DEV0399. The UAT project's Vercel Production category uses its existing hosted-dev data target; real production/staging were not deployed. No SQL migration/reset/startup, provisioning, user creation, credential change or booking mutation ran.

Rollback: promote previous READY UAT deployment `dpl_6BAG82GfyKEYg7kedtJ6WBFi1MfE` (`https://movx-club-pnzbtgizw-hoangworldcoms-projects.vercel.app`) using the verified UAT link/scope, then repeat live smoke. No data rollback is necessary. Saved UAT settings must remain in place. The owned deployment source copy was removed after successful release; the source commit and immutable deployment remain available.

## Validation results

2026-10-20, Node 24.21.0 local / Node 24.x remote, Next.js 16.3.8:

- `git diff --cached --check` and staged/source file review passed before each source commit. `git fetch origin` and `git diff 07d0989 HEAD` before new commits confirmed the old source matches the live main merge. No ignored preview/env/work files were staged. Local DEV0399 validation remains 438 application/server tests, 62 disposable DB tests, lint/typecheck/build and production/native responsive QA; no implementation changed during release.
- `vercel project inspect movx-club-uat --scope hoangworldcoms-projects` and Vercel read-only project/alias/deployment metadata confirmed the exact UAT IDs, baseline/source and Frankfurt. Safe environment metadata includes IDs/keys/targets/types/update times only; no secret values were printed.
- `vercel deploy --prod --skip-domain --yes --scope hoangworldcoms-projects --cwd <exact-source-copy> --meta sourceCommit=fe745129cbcc633cd16919101efe03d75559a6f9 --meta releaseTicket=DEV0400`: passed. Remote `npm run build:vercel` logged guarded hosted-runtime acceptance with configured Geoapify, Next.js 16.3.8 compilation and successful completion. Metadata: READY, Node 24.x, `fra1`, matching source commit. Initial live alias remained unchanged during candidate validation.
- `vercel@64.3.1 --scope hoangworldcoms-projects curl <path> --deployment <candidate> -- <curl-options>` from the verified copy: eight candidate checks passed. Home, Explore, Events, ready Events API and actual public coach returned 200; anonymous actor and new weekly-detail API returned 401; coach workspace returned 307 to sign-in. Weekly detail denied private times with `private, no-store` and `Vary: Cookie`. No fixture controls appeared in public HTML.
- Immediately before promotion, API assertions passed for the initial alias, candidate READY/project/region and unchanged environment metadata. `vercel@64.3.1 --scope hoangworldcoms-projects promote https://movx-club-mj7rp2ktn-hoangworldcoms-projects.vercel.app --yes --timeout 60s`: passed. Custom-domain alias now selects `dpl_HipsAuJgJiQFFPtTG558VmgJHKCZ`.
- Eight equivalent direct checks against `https://uat.movx.club` passed after promotion. Public coach HTML includes this deployment ID, seven guest date/count links and new daily-times sign-in copy. Every response confirms `fra1::fra1`; protected redirects/private no-store denial remain intact. Events API reports ready. Individual warm observed reads were 85–782 ms; these samples are smoke evidence, not a benchmark of authenticated weekly availability.
- Native Safari at approximately 1230-pixel desktop and 375×844 phone viewport: public schedule spans the full page on desktop with seven date cards; phone wraps all seven cards within the viewport, with readable copy and sign-in control. The actual coach had a verified zero schedule; no availability was invented. Selecting Thursday 22 October opened the real sign-in page with canonical coach/date/`#private-schedule` return context intact. No credentials were entered or requests submitted. Restored desktop mode; unrelated tabs were preserved.
- Post-promotion API comparison passed: saved UAT environment metadata and other projects' production deployment IDs exactly match the before snapshot; UAT function default remains Frankfurt. No application/database operation or migration command ran. The exact temporary release directory was removed; no real dummy users were created to clean up.
- Final relative-link/record-index/unique-ID and `git diff --check` checks passed. Logs and summaries are ignored under `work/dev0400/`: `source.json`, `before.json`, `candidate.json`, `build.log`, `candidate-smoke.json`, `promote.log`, `after.json` and `live-smoke.json`.

| Criterion | Evidence | Result |
| --- | --- | --- |
| AC1 | Scoped commits, exact git-archive source, target/region assertions, unchanged env/other-project comparison and preserved root link | Passed |
| AC2 | Guarded remote build, READY candidate, eight candidate checks, alias race check, successful promotion and live deployment ID | Passed |
| AC3 | Eight live public/privacy checks; desktop/phone actual profile and selected-day sign-in return; no user/DB mutation commands | Passed |
| AC4 | This release/source/rollback record, specification/index/link checks, exact temporary-copy cleanup and scoped release-record commit | Passed |

## Risks, limitations, and follow-ups

The weekly read evaluates more candidates than the former daily request; production latency has not been benchmarked. DEV0396 remains unapplied to retained/UAT databases. Native live checks covered the anonymous public profile; local production fixtures and server/database tests supply the signed-in booking evidence, not a new real-account hosted mutation rehearsal.

## Completion and review references

- Completed: 2026-10-20 — committed source deployed to UAT with candidate/live/read-only responsive smoke passed.
- Commit: Source `79acab4` and documentation `fe74512`; operational record included in `[DEV0400] Record seven-day booking UAT release`.
- Review: Self-review; no independent review.
- Deployment or release: [dpl_HipsAuJgJiQFFPtTG558VmgJHKCZ](https://vercel.com/hoangworldcoms-projects/movx-club-uat/HipsAuJgJiQFFPtTG558VmgJHKCZ), serving https://uat.movx.club in Frankfurt. Previous READY UAT release above is rollback. No real production deployment.
