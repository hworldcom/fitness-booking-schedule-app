# Ticket DEV0367: Audit athlete and coach responsive journeys

- Status: Completed
- Created: 2026-10-19
- Last updated: 2026-10-19
- Milestone: Cross-feature local quality assurance
- Coordination: None — independent development ticket
- Related records: Historical baselines: [COR0016](../../archive/organisatory/COR0016-coach-confirmed-booking-requests.md), [COR0020](../../archive/organisatory/COR0020-athlete-terminology-and-connections.md), [COR0022](../../archive/organisatory/COR0022-private-messaging-and-booking-context.md), [COR0023](../../archive/organisatory/COR0023-coach-calendar-and-availability.md), [COR0029](../../archive/organisatory/COR0029-session-types-and-flexible-bookings.md). Downstream delivery: [COR0021](../../current/organisatory/COR0021-group-training-and-events.md), [COR0027](../../current/organisatory/COR0027-login-registration-and-social-authentication.md), [COR0028](../../current/organisatory/COR0028-coach-marketplace-cards-and-personal-websites.md). Independent follow-ups: [DEV0368](../../current/backend/DEV0368-investigate-public-availability-read-latency.md), [DEV0369](../../current/frontend/DEV0369-refresh-public-and-availability-qa-baselines.md), [DEV0370](../../current/backend/DEV0370-investigate-group-scheduling-contention-proof.md), [DEV0371](../../current/backend/DEV0371-isolate-quality-checks-from-local-evidence.md). This audit does not complete those delivery records.

## Objective and context

Run a broad quality assurance (QA) audit of implemented athlete and coach features, including their interaction at desktop and phone widths. Use the [current product contract](../../../docs/mvp-spec.md), especially [acceptance scenarios](../../../docs/mvp-spec.md#13-acceptance-matrix), to distinguish implemented behavior, defects, and planned features. The user requested this audit on 19 October 2026.

## Audit outcome

The local audit is complete. Core athlete–coach interactions passed on desktop and phone layouts, but the application does **not** have an all-green QA sign-off: the configured public browser suite has 35 failures, public reads remain slow, and intermittent scheduling contention requires follow-up. Failures, coverage gaps and planned features are distinguished below. All temporary accounts, application records and images were removed; the complete original/current 55-record fingerprint sets match exactly. No retained data, application runtime source, environment file, commit or deployment changed.

## Scope and non-goals

- In scope: existing unit/server/database/browser checks; public discovery; authentication and recovery; account/profile; coach setup, locations, availability and session types; two-athlete private requests and coach decisions; cancellation/rebooking/completion; connections and messages; implemented group events, website/rates/reviews/URLs; desktop and phone layout, keyboard, errors and privacy. Add an isolated, reusable interaction rehearsal where existing coverage is insufficient and record reproducible defects.
- Out of scope: implementing unfinished product features, redesign, retained-data changes, hosted deployment, external provider setup, native iOS/Android apps, commits. Defect fixes require separately scoped development tickets.

## Expected behavior and edge cases

Athletes and coaches see consistent persisted outcomes across separate browser sessions. Requests do not confirm bookings; one coach acceptance closes competing requests atomically. Cancellation, reconnection, messaging, publication and group participation respect current permissions. Guests and unrelated accounts cannot read private data. Mobile means the responsive web application, tested with touch/phone viewport settings; real-device and additional browser-engine coverage will be reported separately.

## Assumptions, decisions, and dependencies

- Use the running local Supabase and local application, plus isolated preview/build processes as needed. Never reset or seed the retained database or change existing credentials.
- Create uniquely tagged temporary users; clean only exact owned IDs and verify retained-data fingerprints. Use existing fixture helpers and actual application authentication.
- Preserve the pre-existing edits in docs/mvp-spec.md, tests/browser/public-story.spec.ts and tickets/README.md. The current working tree is the audit target.
- Session notes/plans, gallery/video and live Google activation have separately tracked delivery boundaries; do not claim them tested as implemented.
- Review: one bounded audit/evidence task; individual product repairs are outside this ticket and need no planning conversion.

## Implementation plan

1. Inventory delivered routes, existing tests and safe rehearsal helpers; create an explicit coverage matrix.
2. Run unit/server, lint, type/build and isolated database checks. Review harness safety before execution.
3. Prepare tagged coach, two athletes and unrelated-user fixtures. Exercise complete private, connection, message and group interactions at desktop and phone widths, with public/account/editor coverage.
4. Inspect screenshots and keyboard/error/privacy states; capture exact failures and their impact. Separate harness failures from product defects.
5. Clean owned fixtures, check preservation, finish results and index; retain an accurate open record if required audit evidence is blocked.

## Acceptance criteria

- [x] AC1: Every implemented feature area is mapped to passed, failed, blocked or not-run evidence, with planned features identified separately.
- [x] AC2: Real separate athlete/coach sessions exercise private booking and recovery interactions at desktop and phone widths, including a competing athlete and unrelated-user privacy checks.
- [x] AC3: Implemented connection, message, group, profile/account and public/editor journeys have responsive evidence or specific blockers.
- [x] AC4: Automated checks and reproducible defects are recorded honestly; owned fixture cleanup and retained-data preservation are verified.

## Validation plan

Run npm test, npm run lint, npm run typecheck, a production build, existing public Playwright projects and safe database/rehearsal suites. Browser interaction checks use Chrome desktop 1440 px and phone 393 px, with additional 375/430/768/1024 px layout checks as appropriate. Capture screenshots and application errors. Use local Mailpit for confirmation/recovery only with new QA identities. No hosted/provider or physical-device result will be inferred from local evidence.

## Implementation record

### Changes and rationale

Added two guarded QA runners and DEV0367-only exact fixture cleanup/recovery support. Ran existing regression suites, isolated database and UI rehearsals, actual local HTTP checks and native Chrome/Firefox role interactions. Recorded four independent repair/investigation tickets. No application behavior changed.

### Affected files

| File | Role |
| --- | --- |
| This ticket | Coverage, exact commands, observed results, limitations and chronological investigation/recovery evidence. |
| [Full local QA companion](../../../scripts/rehearse-local-full-qa.ts) | Creates four uniquely tagged local identities, publishes only a temporary coach's inventory, exposes bounded interactive HTTP checks and records original fingerprints/owned UUIDs. `--cleanup` verifies every recovery identity's metadata before removing exact test records and checking preservation. |
| [Disposable database runner](../../../scripts/rehearse-full-qa-database.mjs) | Replays current migrations/seed only into newly created local databases, applies app migrations as postgres, selects each suite's guarded database namespace, runs all tests and drops only databases it actually created. QA_GROUP/QA_TESTS are test-only bounded selectors. |
| [Shared local fixture helper](../../../scripts/lib/local-connection-rehearsal.ts) | Adds DEV0367 ownership scope, explicit recovery UUID validation and exact registration/typed-command child cleanup; existing callers keep their default behavior. |
| [Ticket index](../../README.md) | Archives this completed audit and tracks its four Draft follow-ups. |
| [DEV0357](../../current/frontend/DEV0357-manage-group-session-banners.md), [DEV0358](../../current/frontend/DEV0358-redesign-events-cards-and-map.md), [COR0030](../../current/organisatory/COR0030-events-cards-banners-and-map.md) | Link supplemental native phone/media/map evidence without claiming their remaining Chrome/failure/recovery acceptance complete. |

### Decisions and deviations

2026-10-19: Use disposable identities rather than retained demo accounts. Existing dirty files are preserved.

### Contracts, configuration, and operations

No retained product/schema/dependency/environment contract changed. The new runners require the existing local stack and Node 24.21.0. Recovery reads fixed ignored journals under work/dev0367 and refuses mixed/missing ownership markers; it does not reinitialize accounts. No new application environment variable exists. Disposable schemas, temporary identities and ignored logs/screenshots are test operations only. The original app remains on port 3100; isolated QA servers were stopped.

## Validation results

2026-10-19, local Supabase Auth/Storage/PostgreSQL/Mailpit, Node v24.21.0, Next.js 16.3.8. Chrome automated projects used 1440×1040 and 393×852; native Chrome/Firefox exercised desktop and 375/393/430 px phone layouts. Final results and evidence are below; historical failed setup attempts remain explicitly labelled in the journal.

| Check and exact command | Final result and local evidence |
| --- | --- |
| `npm test` | 342 unit + 64 server passed; `work/dev0367/final-unit-server.log`. |
| `node scripts/rehearse-full-qa-database.mjs` | 208 passed, zero failed, one intentional pre-migration-only skip; `work/dev0367/final-database.log`. Earlier intermittent contention failures remain below. |
| `npm run test:e2e` in the configured production source copy | 17 passed, 35 failed, 10 skipped; `work/dev0367/configured-e2e.log` and retained failure artifacts. These are failed checks, not 35 independently established product defects. |
| `npm run test:auth` | Eight real local Auth/Mailpit stages passed; `work/dev0367/auth-rehearsal.log`. |
| `node scripts/rehearse-coach-calendar-ui.mjs` | Eight isolated UI scenario groups passed; `work/dev0367/calendar-ui.log`. |
| `node scripts/rehearse-availability-editor-ui.mjs` | First two scenario groups passed, then obsolete fixture navigation failed; later scenarios not run. |
| `node work/dev0367/run-typed-ui.mjs` | QA-only current-migration wrapper: 14 real Auth/database/UI checks passed; `work/dev0367/typed-ui-current.log`, `work/dev0346/1aa7ef1b/results.json`. Maintained wrapper repair belongs to DEV0369. |
| `npm run lint`, `npm run typecheck` | Clean source copy passed both; `work/dev0367/clean-lint.log`, `clean-typecheck.log`. Root workspace failed only on the ignored scratch trees described below; DEV0371 remains open. |
| `npm run build -- --webpack` | Clean/configured production builds passed; `work/dev0367/clean-build.log`, `configured-build.log`. Configured build received the existing loopback Auth/database settings at build time; no environment file changed. |

The isolated configured source copy was `/private/tmp/movx-dev0367-TzhHzF`. Evidence under ignored `work/` is local supporting material; the results and limitations in this ticket are the durable review record.

| Criterion | Evidence | Result |
| --- | --- | --- |
| AC1 | Coverage matrix and classified suite failures/planned-feature boundaries | Passed — audit accounted for every area |
| AC2 | Native desktop/phone request, acceptance, cancellation/re-request/withdraw/close; separate A/B/coach sessions; exact HTTP/privacy and SQL outcomes | Passed |
| AC3 | Auth 8-stage, typed 14-check and calendar 8-group rehearsals; native messages/connections/groups/reviews/profile/locations/media; explicit remaining harness/provider gaps | Passed — coverage/evidence recorded |
| AC4 | Exact commands/results, four follow-ups, ownership guard checks and complete 55-record fingerprint equality with zero owned residue | Passed |


## Risks, limitations, and follow-ups

The audit targets the original dirty working tree; its pre-existing specification, public-story test and ticket-index edits were preserved. Follow-ups remain open: DEV0368 public-read latency, DEV0369 stale assertions/fixture capability and pending-navigation timing, DEV0370 intermittent contention proof/recovery, DEV0371 ignored-evidence contamination of root lint/typecheck. No double booking or retained-data loss was observed. Public accessibility is not fully certified while its browser cases stop early. The availability rehearsal's later cases require its fixture-navigation repair; current calendar and typed phone coverage is recorded separately. Live Google, hosted migration/UAT/production, physical devices and Safari/WebKit were not tested. Adopted notes/plans, later gallery/video, invitations and other unfinished product targets were not treated as implemented features.

## Completion and review references

- Completed: 2026-10-19 — audit, evidence classification, exact cleanup and self-review completed. Product findings remain open in the linked Draft tickets; this is not an all-green product certification.
- Commit: User authorized the QA checkpoint on 19 October 2026, after audit completion. Subject: `[DEV0367] Record athlete and coach responsive QA`. Includes the audit scripts, cleanup support, evidence records and four unimplemented follow-up plans; unrelated pre-existing specification, browser-test and index edits remain outside this commit.
- Review: Self-review completed against AC1–AC4, changed-file scope, ownership constraints, link consistency and preservation. No independent review.
- Deployment or release: Not performed.

## Audit journal — 19 October 2026

### Automated evidence collected so far

- `npm test`: **342/342 unit and 64/64 server tests passed**. Logs: `work/dev0367/unit-server.log`.
- `npm run lint`: failed on six `no-explicit-any` errors in pre-existing ignored `tmp/dev0366/recover-first.ts` and `recover-second.ts`. No application lint error was reported. A clean source copy passed lint.
- `npm run typecheck`: root workspace failed because ignored `work/dev0336/commit-files/` contains partial copied TypeScript files. Clean-copy `npm run typecheck` passed.
- Clean-copy `npm run build -- --webpack`: passed. A first Turbopack attempt rejected the isolated copy's external node_modules symlink; this is a rehearsal setup limitation. A second production build with the actual local Auth/database build environment also passed, producing dynamic private routes.
- Initial isolated database run: **209 tests, 207 passed, 1 failed, 1 skipped**. The failure was the credential-fence helper owner (`supabase_admin` instead of expected `postgres`) because the first custom runner applied migrations as the infrastructure administrator. Rebuilding with migrations executed as postgres fixed that assertion. The documented skip is a pre-migration-only retirement scenario on an already migrated schema.
- Correct-owner broad rerun: **151 tests, 143 passed, 8 failed**. Seven group/private scheduling subtests plus their parent failed after overlapping publication rejected with SQLSTATE `40001`, `coach schedule changed; retry operation`. Subsequent subtests inherited uncleared state (including a duplicate recurrence key). A focused correct-owner `application-auth,group-scheduling` rerun reproduced **21 tests, 13 passed, 8 failed**. The guard rejected contention; no duplicate booking or overlapping successful publication was observed. Product conflict recovery versus test expectations remains an unresolved investigation, not a proven corruption defect.
- Unconfigured public Playwright run: **62 cases, 25 passed, 23 failed, 14 skipped**. Several selectors assert obsolete titles, five fictional coaches, the removed demonstration strip, old empty-schedule copy and old How it works content. Do not interpret those as product failures. The complete configured run is pending. Two interim configured attempts were stopped because the rehearsal used an invalid 127.0.0.1 site origin and then a configuration-free build; they are not valid product results. The final attempt uses a localhost origin and a build made with local Auth/database settings.

### Native interaction evidence collected so far

Temporary coach `QA Coach 03f9f1`, athletes A/B and an unrelated account were created with DEV0367 metadata. The stable fixture journal is `work/dev0367/owned-ids.json`; credentials remain only in the ignored private fixture file.

1. Chrome desktop: guest coach page showed seven daily counts and no individual time selector. Selecting 20 October preserved the date and `#private-schedule` through password sign-in. Athlete A selected **QA Boxing 75**, saw actual **09:00–10:15 Europe/Berlin**, reviewed the venue/duration and saved a pending request. My sessions showed the concrete deadline, non-confirmed wording and no competing athlete.
2. Athlete B submitted the same interval through the actual `/api/session-bookings` HTTP endpoint with its separate session. Firefox desktop coach Bookings showed two candidates. Accepting A produced one confirmed booking, an accepted A request and a not-selected B request, verified by exact-owner SQL. The athlete then saw the persisted confirmed booking and shared title.
3. Firefox coach responsive mode: 375 px Bookings, shared-title editing, connection request, and group draft/publication were operable. Coach saved **QA Footwork & balance**; athlete saw the same title. Athlete explicitly accepted the connection; phone My coaches showed one accepted coach.
4. Separate Firefox normal/private windows kept coach/athlete cookies independent. At athlete 393 px with touch simulation and coach 430 px, the athlete sent `Can we focus on footwork? <script>literal</script>` using keyboard Tab/Return. Coach saw literal text, replied, and the already-open athlete thread received the reply without a manual reload. Request/update cards retained the confirmed booking/title.
5. Coach phone created **QA group footwork**, 23 October 18:00–19:00 Berlin, deadline 16:00, minimum 2, maximum 3, Free. Saved review showed the actual terms. Explicit publication left the class waiting for coach confirmation with no confirmation action below minimum. Athlete A reserved one seat and saw 1/3, waiting status and withdrawal control.
6. Athlete phone Account saved synthetic private details, then Login & security showed password status and a current-device sign-out. Signing out returned to Sign in and cleared private content. Actor-B sign-in is being checked next.
7. Direct HTTP privacy: both unrelated account and non-selected B received 403 for A's booking detail; A received the exact 75-minute confirmed detail. An unrelated conversation read returned 409 without conversation content. A guest detailed-time request returned 401 `{status:"signed-out"}`.

Native screenshots were inspected in tool output for desktop FAQs, 375 px coach booking editor, 393 px chat, group detail and Account. Chrome's native accessibility/screenshot binding became empty after opening developer tools; further phone interaction uses Firefox responsive mode. Existing Playwright Chrome projects remain separate automated evidence.

### Performance observation

Sequential `curl --max-time 90 --silent --output /dev/null --write-out ...` requests against the running development server returned Home 200 in **31.339 s**, Explore 200 in **41.459 s**, and the QA coach page 200 in **36.716 s** during concurrent QA. PostgreSQL showed availability synchronization work and about 130% container CPU at one sample. These are observed response times, not a settled root cause; repeat against the configured production preview after background tests finish. No latency target is invented by this audit.

### Additional completed evidence

- `npm run test:auth` passed all eight real local Auth/Mailpit stages: signup/password bounds; wrong-browser/purpose confirmation; optional normalized private avatar and coach continuation; desktop/phone login and current-device sign-out; restricted single-use recovery/rate limits/two-device revocation; current-password changes; passwordless-account continuity; removed-code rejection and generic unknown/duplicate outcomes. Its exact owned Auth/media cleanup and existing-profile preservation assertions passed. This does not prove Google activation.
- `node scripts/rehearse-coach-calendar-ui.mjs` passed all eight UI scenario groups, including mixed Week/Month and 42-cell overflow, paging, role/access changes, unavailable/reload handling, availability draft retention, independent group detail links and 375/430 px keyboard dialog/focus behavior. These use explicit isolated UI/service fixtures, not a second real-database integration claim.
- `node scripts/rehearse-availability-editor-ui.mjs` passed weekly ranges/overlap/copy/atomic review/keyboard behavior and multi-date overrides/retained-session warnings/request-closure previews/restoration. It then failed at line 303 because its isolated shell has no exact Bookings link. The remaining scenarios in that script did not run; DEV0369 owns baseline repair.
- Final production Chrome suite: **62 cases: 17 passed, 35 failed, 10 skipped**. Configured guest protection, retired routes, secondary contrast, global auth recovery keyboard access, truthful guest identity, fictional-profile dialog focus, phone map-failure list recovery and Coming soon passed. Failed assertions include obsolete titles/five-coach counts/old URLs/removed demo strip/old schedule copy/ambiguous selectors, an old two-cards-above-fold assumption on one-column phone cards, and slow or competing navigations. Failure snapshots/traces are retained under ignored `work/dev0367/browser-configured/`; `browser-failures.json` classifies their first assertions. No complete public accessibility pass is claimed because stale assertions stop some scenarios before later checks.
- The final full isolated database run using the maintained runner passed **208 of 209 tests, zero failures, one intentional pre-migration-only skip**. Correct-owner credential-fence and all group/private race scenarios passed on this run. The earlier twice-reproduced contention failures remain recorded as intermittent stress/recovery evidence under DEV0370; a later pass does not erase them.
- Final `npm test` rerun again passed **342 unit + 64 server tests**. Clean-source lint and typecheck, including the new QA scripts, passed. Application source was unchanged after the successful production builds.
- Sequential configured production preview requests with background browser tests stopped: Home **7.608 s**, Explore **7.694 s**, QA coach **11.135 s**, all HTTP 200. DEV0368 owns profiling; the earlier development samples remain valid concurrent-QA observations.

The native coach completed a separately labelled, artificially elapsed temporary B booking, then cancelled A's future booking. A's HTTP detail became cancelled; its accepted connection remained independently available. On a 375 px phone B chose the released 09:00–10:15 interval, saved a new request, and withdrew it from My sessions. Another fresh B HTTP request was closed through the coach's explicit Close occurrence confirmation. Exact-owner SQL then showed one accepted, one not-selected, one withdrawn and one occurrence-closed request; one cancelled and one completed booking. A detailed-time read excluded the closed interval and its overlapping alternatives, with availability resuming at 10:15 Berlin. No earlier attempt revived.

B published a four-star review of the artificially elapsed private booking from the phone dialog. Keyboard Left/Right changed its rating; publication required chosen attribution and an unchecked-by-default consent preview. Guest API output exposed only public review fields and mean 4/count 1. The desktop dialog rendered correctly; withdrawal changed the guest result to mean null/count 0. This is a test fixture, not a claimed attended session.

The owner editor saved a brand label/introduction/approach independently from profile details. It accepted `60,50` as 6050 EUR cents, disclosed the exact public label, and then omitted the entire amount from the guest API after disclosure was disabled. A valid synthetic 640×480 PNG uploaded through the native file picker and produced Public coach portrait saved; it is separate from the Auth rehearsal's private account avatar. File-picker activation required waiting for the native Open control; no retained image was used.

For Events, 24 more published group fixtures were created only for the exact QA coach using restricted actor-scoped repository commands. At 375 px, the filtered page initially loaded 20, Load more appended four without duplicates and focused the first new card, and a newly loaded card opened Map while preserving all 24 loaded sessions and the venue filter. Keyboard Shift+Tab reached coincident map markers; Enter selected another session and focused its correct preview. An empty venue filter cleared all old results/markers (0 loaded). Browser Back restored the Northside filter and its bounded first page. Desktop inspection showed cards beside the venue map. These observations supplement DEV0358; they do not silently complete its remaining failure/retry or banner criteria.

A native rapid Explore sequence (click Boxing then immediately submit the still-rendered search form) retained the old query without the new discipline. Waiting for Boxing navigation, then submitting, preserved query/discipline/location/map state. This distinguishes a pending-navigation interaction from a failed stable filter contract; DEV0369 must separate its racy test from any desired product recovery improvement.

Location management additionally passed real desktop and phone checks: the owner added Fabrik Training from the reviewed-gym snapshot list, selected it as the primary base, and deactivated Northside Combat. SQL and the phone interface showed Fabrik active/primary and Northside inactive/retained. Both the completed and cancelled private bookings still named Northside Combat; the primary change did not move their saved venue. The only active primary could not be deactivated without another active location. The inactive-location disclosure retained the old venue label. All records were owned by the disposable coach.

The historical typed-session UI runner initially stopped at its group-directory assertion because its database preparation freezes migrations at `20261018000900`, before the current Events media/preview capabilities. Before that stop it passed owner type editing to 75 minutes, real athlete typed requesting, lost-successful-response retry without duplicate requests, coach acceptance/original terms, and coach-created 90-minute booking changed to 75 minutes with retained history. Screenshots are under ignored `work/dev0346/a10652ca/`. A QA-only wrapper now repeats that same maintained UI scenario against a fresh database including the current migration set; the original SQL upgrade rehearsal and application code are unchanged. This is a fixture-capability correction, not a product repair or weakened assertion. Its final result is the 14-check pass described below.

2026-10-19 cleanup deviation: the first full fixture cleanup correctly failed because cascading session deletion runs the registration-history guard as app_owner. Its database transaction rolled back; only the temporary portrait bytes and temporary withdrawn review had already been removed. Before retrying, extend the QA helper to delete exact owned registrations directly as the local administrator before their parent sessions, and add DEV0367-only manifest recovery that verifies every Auth UUID still has the expected temporary ticket metadata. Preserve the original fingerprint file and compare it after recovery. No trigger disabling, global reset or retained-history deletion is authorized or required.

The current-migration typed UI repeat passed **14 checks** with exit 0 (`work/dev0346/1aa7ef1b/results.json`): owner type edits, athlete full-duration requests, exact recovery after a lost successful response, coach acceptance, coach-created 90-minute session changed to 75 minutes with one history entry, group-type prefilling/publication/filtering, original type-based calendar filtering, wrong-role/origin rejection, stale-draft retention, unavailable/retry, 375/430 px forms/time controls without horizontal overflow, explicit restoration, keyboard type removal with retained confirmed terms, private type-draft isolation and retained demo fingerprints. Both temporary Auth identities and its disposable database were removed.

Cleanup recovery also exposed typed booking command records that intentionally restrict participant deletion. The DEV0367-only cleanup now removes exact owned booking-change/command records before bookings/participants. Recovery then passed: **55 original fingerprinted records unchanged, zero remaining audit Auth identities**. An independent final comparison matched the complete original/current 55-record fingerprint sets and found zero owned profiles, bookings, requests, group sessions, booking commands or media objects. A live guard check with two additional temporary identities proved mixed absent/wrong-marker recovery UUID sets fail before deleting any valid identity; those guard fixtures were then removed exactly. Commands: `node --import tsx --conditions=react-server scripts/rehearse-local-full-qa.ts --cleanup`, `node --import tsx --conditions=react-server work/dev0367/recovery-guard.mjs`, and `node work/dev0367/final-preservation.mjs`.

The final source cleanup code passed clean-copy TypeScript and focused ESLint. The final existing unit/server suites remained 342/64 passed. The maintained database runner's final safety change (unknown-group rejection, created-database ownership tracking and a bounded child-process deadline) passed its five-test application-auth smoke. No application runtime source, schema, dependency, environment file, retained account or credential was changed.

After removing the large QA dataset, configured production Home/Explore remained **5.226 s / 4.733 s** with the six retained coaches. The removed QA coach URL returned 404 in **0.029 s**. This narrows, but does not eliminate, the performance concern; see DEV0368.


## Final coverage matrix

“Passed” identifies observed checks, not an independent review or deployment. “Partial” means the stated passed checks coexist with failed or unexecuted cases; historical evidence is never silently upgraded.

| Feature area | Desktop and phone evidence | Outcome |
| --- | --- | --- |
| Registration, confirmation, password login/recovery/security | Real local Auth/Mailpit eight-stage rehearsal, normalized private picture, wrong-browser/purpose, two-device revocation, passwordless identity preservation; native actor switch | Passed |
| Personal Profile and Account | Real avatar/onboarding/security rehearsal; native phone private details/save/sign-out; unit/server/database privacy and panel controls | Passed for recorded cases; no claim every cosmetic panel permutation was manually repeated |
| Coach eligibility and permissions | Native approved coach/athlete shells; configured Chrome guest protection on both projects; database applicant/suspension/foreign/dataset and role boundaries | Passed |
| Home, Explore and public navigation | Native desktop/phone presentation and stable query/discipline/location/map submission; Chrome phone provider-failure list fallback/dialog focus | Partial — stale/racy browser assertions, slow reads and incomplete global accessibility proof tracked in DEV0368/DEV0369 |
| Public coach page and guest schedule privacy | Native guest seven-day counts; selected-date sign-in return; authenticated 75-minute picker on desktop and phone; guest time API 401 and unrelated booking reads 403 | Passed for delivered scheduling/content surfaces |
| Owner website, pricing and public portrait | Native desktop content save, comma-decimal rate show/hide with actual public JSON omission, separate normalized public portrait; phone owner framing and private avatar rehearsal | Passed for recorded core controls |
| Locations and primary base | Native desktop add/select-primary/deactivate, phone retained inactive disclosure, exact saved booking-venue SQL and complete DB location/availability checks | Passed |
| Weekly hours and whole-date overrides | Two isolated editor scenario groups; real editor/calendar draft integration and 375/430 px warnings/navigation; comprehensive database override/history/concurrency checks | Partial — standalone editor script stops at obsolete Bookings fixture navigation; later cases not counted |
| Coach calendar | Eight isolated UI scenario groups, mixed private/group Week/Month/Day navigation, overflow/paging, access/unavailable changes, 375/430 px keyboard and retained-draft links | Passed for isolated UI proof; actual private/group authority separately passed DB/native checks |
| Reusable types and individual booking changes | Current-migration 14-check real Auth/database UI rehearsal at desktop/375/430, including type editing/removal, lost-response retry, coach-created 90→75-minute change, original history and stale/unavailable recovery | Passed |
| Private requests and booking lifecycle | Separate A/B/coach sessions: same 75-minute candidate, one acceptance/non-selection, shared title, cancellation, phone new request/withdrawal, explicit occurrence closure; elapsed completion and privacy | Passed |
| Connections and private messages | Native mutual send/accept, shared title, phone inquiry/reply with literal text and arrival in an already-open thread; full database disconnect/reconnect/block/history/unread/race/retry cases | Passed for recorded native and database cases |
| Reviews | Native phone keyboard score/attribution/unchecked consent preview/publication; desktop withdrawal; public count/mean and field privacy; full DB editing/moderation/paging/races | Passed |
| Groups, Events directory and banners | Native draft/review/publish, A/B reserve, explicit confirm, withdraw below minimum, coach cancel; 20→24 phone paging/focus/map/keyboard/empty-filter/Back and desktop list/map; phone banner upload/reload/remove/public byte revocation | Passed for recorded lifecycle/media flows; peer-specific remaining Chrome/stale/unavailable/replacement acceptance is not closed here |
| Canonical username URLs and aliases | Current public username links browsed; isolated public-URL namespace/privacy/rename/alias/concurrent-claim database suite passed | Passed for automated authority; no claim every owner URL edit was manually repeated on both widths |
| Google/live providers, hosted release and physical devices | Google is explicitly disabled locally; hosted/provider operation and physical devices were outside the chosen local environment | Not run — no readiness claim |
| Notes/plans, gallery/video, invitations and deferred targets | Current specification identifies separate undelivered work | Not applicable to implemented-feature QA |

## Final media and preservation checkpoint

A final fresh single-coach/single-group fixture covered the remaining phone banner path without reusing retained records. Native Firefox at 375 px uploaded the synthetic PNG, displayed the saved 8:3 preview and retained it after a full reload. An unauthenticated read returned a real 800×300 WebP with HTTP 200. Native removal restored fallback wording and revoked the same public version URL (404); the group remained open, Free and capacity 1–2. Its exact Auth/profile/group/media records were then removed. The independent full fingerprint comparison was repeated afterward: **55 original = 55 current records, exact equality**, with zero owned Auth identities, profiles, requests, bookings, group sessions, commands and Storage objects. Auth/typed/guard fixture cleanup also completed. The isolated port-3101 production server stopped; the user's original port-3100 process remained running.

At audit completion, no product repair, commit, deployment, external review or retained-data change had been performed. The subsequent user-authorized QA checkpoint is recorded above; UAT publication is a separate operational ticket.

Final repository review: 367 relative links across this audit, its four follow-ups, the index and the three supplemental Events records resolved. `git diff --check` passed. The pre-existing specification and public-story test exactly matched the initial source snapshot; normalizing only DEV0367–DEV0371 rows and the next-ID sentence proved unrelated index content unchanged. Runtime source, migrations and package files had no diff. Both frontend Events peers remain Blocked and their coordination record remains In progress. Only the original port-3100 listener (PID 3551) remained on the checked application/rehearsal ports.
