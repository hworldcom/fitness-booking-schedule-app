# Ticket DEV0375: Enable UAT gym and place search

- Status: Completed
- Created: 2026-10-19
- Last updated: 2026-10-20
- Milestone: UAT coach onboarding
- Coordination: None — independent development ticket
- Related records: UAT baseline [DEV0372](../organisatory/DEV0372-deploy-reviewed-release-to-uat.md); location module [DEV0174](../frontend/DEV0174-decouple-location-services.md). Independent coach approval DEV0374 does not belong to this ticket.

## Objective and context

The user reports the deployed coach application shows “Gym and place search is not configured.” The existing feature is implemented, but the dedicated Vercel UAT project's four Preview variables omit NEXT_PUBLIC_GEOAPIFY_API_KEY. The ignored local environment contains an existing valid public browser key. Live origin-labelled requests to Geoapify returned HTTP 200 for both Geocoding and Places; the address probe returned a real candidate. Enable the existing feature at https://uat.movx.club in accordance with [location boundaries](../../../docs/mvp-spec.md#6-application-and-infrastructure-boundaries) and [setup guidance](../../../README.md#map-and-location-search-configuration).

## Scope and non-goals

Add only the existing public search key to the dedicated UAT project's Preview settings, rebuild an exact committed application source and move only the UAT alias to the successful hosted-dev Preview. Verify actual public-place and gym search from desktop/phone UI, selection/attribution and configuration/failure fallback. Preserve runtime database/Auth variables, sessions, all user data, staging/production and unrelated worktree edits.

Exclude provider changes, new SDKs, UI redesign, paid plans, key/credential rotation, creating a provider account, modifying the current user's draft or publishing/saving test locations. If actual provider/search behavior fails, investigate before expanding the ticket or claiming the configuration fix complete.

## Expected behavior and edge cases

UAT's coach location picker offers the existing explicit gym/place search and shows real bounded provider results. Selected candidates have valid labels/coordinates and retain Geoapify attribution. Manual entry remains available; no lookup auto-saves a location. A successful deployment must be Preview/hosted-dev, use the exact UAT origin and keep valid TLS/protected routes. Keep the old UAT deployment for alias rollback. Public keys are intentional browser configuration; database/operator credentials must never enter served assets or logs.

## Assumptions, decisions, and dependencies

The reported bug authorizes the configuration repair and necessary UAT redeployment without another publication permission gate. Current exact committed source is 98c546e; runtime application code is unchanged from the previously reviewed 351b5f3 release. Reuse the existing working public Geoapify key for this bounded repair; no provider account/security setting or local key is changed. UAT-labelled requests already succeed. Per-environment key separation/restriction guidance remains in README; no restriction/rotation or paid capability is falsely claimed here. Installed Next.js 16.3.8 bundled environment guide confirms NEXT_PUBLIC values are frozen at build time, so updating Vercel settings alone is insufficient.

## Implementation plan

1. Inspect current code/configuration, local key presence without exposing values, Vercel Preview metadata and actual provider behavior with UAT Origin/Referer.
2. Set only NEXT_PUBLIC_GEOAPIFY_API_KEY for Preview in project prj_CPYcoaAzkLOxWrb6Q9lOaDgtQQPA. Prepare a private exact-source export with the correct UAT project link; preserve the repository's existing staging link and all unrelated edits.
3. Build/deploy with modern Vercel CLI in Preview hosted-runtime mode near Frankfurt. Inspect READY state, source metadata and search-configured build log; assign only uat.movx.club after success.
4. Verify live TLS/public/protected routes, normal desktop/phone authenticated picker searches/selection without saving user data, actual provider responses and manual fallback. Do not expose secrets or impersonate/reset a retained account.
5. Record exact configuration/release/rollback and validation evidence; update operating guidance/index and archive only after criteria pass. Commit only if requested or covered by existing authorization for this change.

## Acceptance criteria

- [x] AC1: UAT Preview contains the valid public search setting, with the existing four runtime settings and environment boundaries preserved.
- [x] AC2: A successful rebuilt hosted-dev Preview is live at the UAT hostname with valid TLS, correct source/origin and search configured.
- [x] AC3: Actual desktop/phone searches return real gym/place candidates and usable selection; manual entry/attribution remain, and no retained user profile/draft/content is saved or overwritten by QA.
- [x] AC4: Evidence, rollback, relevant checks and material limits are recorded; unrelated worktree edits and other deployments remain preserved.

## Validation plan

Use Vercel before/after environment metadata and in-memory value comparisons, real provider probes from the UAT origin, modern hosted Preview build and deployment/alias inspection, direct HTTP checks and native desktop/phone picker interaction. Reuse existing pure location/provider tests for unchanged request/parsing behavior where useful. No new mirror tests or broad database suite is needed for one configuration variable; no migration, seed or account provisioning. Check documentation links/status/whitespace and compare unrelated edits with their existing snapshot.

## Implementation record

### Changes and rationale

Added only the existing public Geoapify key to UAT Preview and rebuilt exact committed source 98c546e. The accepted Frankfurt Preview is live on the UAT alias. Real Chrome desktop Chimosa search/selection and 375×568 phone Alexanderplatz search/selection/manual fallback passed without saving a user profile. All four existing runtime settings remain unchanged; no source, database or production change occurred. Zero results for McFIT/FitX/Holmes Place are provider data outcomes; Chimosa supplies actual gym proof.

### Affected files

This ticket and [index](../../README.md); README now links this completed UAT search operation. Existing [Geoapify adapter](../../../src/location/providers/geoapify.ts), picker and environment validator are reused unchanged unless investigation finds a separate defect. Private configuration/probe/deployment evidence stays under ignored work/dev0375.

### Decisions and deviations

The failure is missing build-time deployment configuration rather than missing implementation. Do not rotate keys, switch providers or add code solely to mask it. Reusing the existing public key shares its existing provider quota with local use; no provider restriction claim is made. Preserve the current UAT alias until the replacement has built successfully.

### Contracts, configuration, and operations

One existing optional variable is enabled for UAT Preview only. No data/schema/dependency/Auth/production configuration change. The old UAT deployment dpl_9iCAdz7gGLhUqU7WHwHPHUvgg5XB remains the rollback target; restoring its alias reverts search availability while preserving current app data.

## Validation results

Initial preflight entries are followed by the final actual deployment/native evidence below.

- Read-only Vercel metadata: exactly four Preview values; no Geoapify setting.
- Local ignored file: populated syntactically valid public key, never printed.
- Actual UAT-origin provider probes: Geocoding 200 with one Alexanderplatz candidate; Places 200 with zero McFIT candidates. Both allow the caller's browser access. Full native gym/place proof remains to run.
- Relevant official references inspected: Next.js bundled environment-variable guide, Geoapify Places/Geocoding documentation and Vercel environment/deployment guidance.
- Configuration, rebuilt final hosted Preview, alias/TLS, real desktop/phone selection/fallback and public/protected-route checks passed as detailed below.

## Risks, limitations, and follow-ups

Provider search uses the existing shared quota and available third-party place data. Do not treat zero matches as a configuration failure or fabricate candidates. The current user's unsaved form must be preserved; use a separate owned browser tab/window and do not save its selection. Native proof used the existing authorized UAT browser session in a temporary window; no test account or credential reset was needed.

## Completion and review references

- Completed: 2026-10-19 — all four configuration/deployment/native/preservation criteria passed.
- Commit: Included with its implementation/validation record in this user-authorized 2026-10-20 checkpoint: `[DEV0375] Record UAT location search activation`. No new hosted operation is implied.
- Review: Self-review of exact environment/source/region/alias, real picker results, route/privacy checks and preservation; no independent review.
- Deployment or release: UAT live on dpl_EaJenFw4MknjYor5RQm2bGmv8WnN (Preview, fra1), exact source 98c546e; no Git source push or app-code change.

### First rebuilt Preview and region correction — before final alias selection

The public key was added only to Preview; all four prior environment IDs/types/targets/updated timestamps are unchanged. Modern CLI built source 98c546e successfully and logged hosted-runtime Preview with Geoapify search configured. The first rebuilt deployment dpl_3VRaNBNRJnC3LzxVAfQgJf6Vn4qg is READY but its actual function region is iad1, whereas the accepted prior release uses fra1. The CLI did not inherit the prior deployment-specific region. Before final acceptance, explicitly deploy the same exact source/settings with --regions fra1, verify the actual region and select that Preview. No app/schema/data change is needed. Twelve existing location/deployment tests passed; actual provider probes also found a real Chimosa gym result.

### Live release and native validation — 19 October 2026

The final rebuilt Preview is dpl_EaJenFw4MknjYor5RQm2bGmv8WnN at movx-club-r38epdmpy-hoangworldcoms-projects.vercel.app, exact source 98c546e04b890d14cfeca44887ff6822ac062e88, READY, target Preview and verified function region fra1. Build logs explicitly confirm hosted-runtime Preview with Geoapify search configured. The earlier same-source iad1 Preview briefly served the alias during validation and was superseded by this Frankfurt build; it is not the accepted final release. Actual alias API confirms UAT points to the final deployment and normal HTTPS works. All four original runtime environment entries preserve exact IDs/types/targets/updated timestamps; only the fifth public search variable was added to Preview.

Native Chrome desktop (1390×775) on the real UAT hostname: Independent place → Gym and place search now shows a search input instead of the missing-configuration message. Actual Chimosa search returns the gym at Linienstraße 127, Berlin (52.526682, 13.389507); selecting it shows the exact label/coordinates, Geoapify source, usable confirmation action and the provider-neutral OpenFreeMap pin/attribution. No Save coach profile action was invoked.

Native Chrome responsive mode verified an actual 375×568 CSS viewport, displayed at 50% only to fit the tool window. After reloading only the temporary validation window onto the final alias, Alexanderplatz Berlin returns the real public-place candidate (52.521981, 13.413636). Selecting it shows the label/coordinates and map pin; Manual coordinates then exposes editable label/latitude/longitude with those values. Initial empty-query validation showed “Enter at least three characters”; the populated retry succeeded. No location was confirmed/saved to the account and no profile field was submitted. The temporary window was closed, discarding only its test selection.

Chrome repeatedly switched to the user's active window during initial attempts, so no failed/unfinished UI attempt was counted as successful. The user confirmed a brief Chrome pause, after which phone search/selection/fallback completed. Native AX activation sometimes focused/scrolled controls without clicking them under touch emulation; screenshot-based clicks completed those actions. No console script, cookie extraction, account impersonation or credential change was used. The user's original profile window was not reloaded or saved by QA.

Seven direct public/protected route checks passed on the final alias: Home/Explore/Events/Sign in 200; guest Coach Profile 307; private times and Messages API 401. Staging remains HTTPS 200. Twelve existing location-services/deployment-validator tests passed, zero failed/skipped. No app runtime source, schema or dependency changed; the Vercel hosted build is the applicable rebuild check. Private logs/metadata/provider results remain under work/dev0375; no populated key is stored in the repository record.

### Final handoff checks

Inspected 4 public HTML pages and 16 referenced Next.js immutable client chunks from the real UAT alias: all served successfully and contained neither the actual runtime database connection nor its password. The Geoapify browser key is intentionally public configuration; its value was never printed in terminal evidence or added to Git. No service-role/operator value was added to Vercel. Evidence: work/dev0375/asset-check.json.

Existing location/deployment tests: `node --import tsx --test tests/location-services.test.ts tests/vercel-deployment.test.ts` passed 12/12. Vercel native hosted-runtime builds passed; the final one explicitly selected fra1 after inspection found iad1 on the first attempt. Global lint/typecheck are not repeated for an unchanged source configuration repair; prior exact-source checks remain recorded in DEV0372. No migration/database fixture or full regression suite is needed for one public environment variable. Documentation links/identifiers/status/whitespace and unrelated-edit preservation were checked. Supporting work files are ignored/private. No new source commit was requested for this operational fix; source is already committed as 98c546e.
