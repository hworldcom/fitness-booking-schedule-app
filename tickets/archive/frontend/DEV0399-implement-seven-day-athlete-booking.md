# Ticket DEV0399: Implement seven-day athlete booking

- Status: Completed
- Created: 2026-10-20
- Last updated: 2026-10-20
- Milestone: M10 coach marketplace booking refinement
- Coordination: None — independent development ticket
- Related records: Approved preview [DEV0397](../../archive/frontend/DEV0397-preview-seven-day-athlete-booking.md); login-only detail/privacy baseline [DEV0366](../../archive/frontend/DEV0366-require-login-for-private-coach-schedules.md). Existing cache-policy work [DEV0393](../../current/backend/DEV0393-control-public-directory-cache-freshness.md) and migration [DEV0396](../../archive/backend/DEV0396-avoid-repeated-timezone-catalog-scans.md) are independent and are not delivered here.

## Objective and context

After sign-in/registration, the public coach schedule switches from seven date cards to a class/venue/native-date form showing only one day's times. On 2026-10-20 the user accepted DEV0397's HTML design and authorized implementation. Retain the seven-day presentation after sign-in, reveal bookable starts under each day and allow Previous/Next 7 days within thirty Berlin dates. Follow [duration-aware booking](../../../docs/mvp-spec.md#186-session-types-and-flexible-bookings), [public presentation and compatibility](../../../docs/mvp-spec.md#196-cards-username-urls-and-scheduling-compatibility), and [booking recovery](../../../docs/mvp-spec.md#7-requests-booking-and-recovery).

## Scope and non-goals

- In scope: shared responsive seven-day time cards/week navigation, real typed availability for the selected class/actual venue, automatic loading, explicit review and pending request feedback; preserve class/place/date return context, guest privacy, own-coach/account boundaries, unknown-result command reuse and conflict recovery. Apply the same day/time presentation to the legacy one-hour path, preserving original slot IDs and request/withdraw/cancel authority. Add a bounded authenticated weekly read using the existing database availability function, with no shared caching. Update product contract and meaningful validation evidence.
- Out of scope: scheduling/capacity/duration/price/approval policy changes, new offers or location provisioning, schema/function migrations, retained demo/account edits, cache-policy work, admin subdomain work, deployment and commits unless requested separately.

## Expected behavior and edge cases

The first actual bookable private class and its actual bound/default/available venue initialize the signed-in display; no time is selected and no request is sent. This applies the approved preview's immediate availability display without inventing offers. Users can change class/place and see the selected week's fitting starts automatically. Show seven today-anchored dates, or the final two dates, with distinct loading, verified empty and unavailable/retry states. Longer classes show only full-fit starts. Calendar/month selection is removed from this flow. Valid guest-return dates open their seven-day group. The database clock bounds weekly reads; expired/outside return context resets explicitly to the current week. Berlin date grouping covers daylight-saving transitions. Class/place/week/account changes clear incompatible selections and cannot surface stale reads or late mutation results. Pending requests remain coach-unconfirmed; ambiguous mutation retries reuse the original command and terms. Own coaches cannot request themselves. Published groups retain their separate authority and links.

## Assumptions, decisions, and dependencies

- Confirmed: the user approved the HTML preview and requested real implementation on 2026-10-20. Adopt its card arrangement (seven desktop columns, wrapping phone cards), today-anchored paging and shorter final page. Preselect actual class/place to reveal times immediately; this supersedes the older form's no-initial-type-selection behavior, while preserving explicit time choice and submission.
- One vertical slice: the weekly server read is necessary support for the same booking interface, not an independent caching/scheduling initiative. Reuse existing SQL full-fit/venue/conflict checks and existing mutation endpoints rather than creating booking logic in the browser.
- Next.js 16.3.8 / React 19.3.0 installed. Read bundled data-fetching and route-handler documentation before integration. Use current client actor boundaries and private no-store route behavior.
- Preserve unrelated concurrent DEV0398 admin-documentation edits and DEV0148 planning; do not stage, revert or otherwise own them.
- Validate with isolated fixtures/disposable databases/users only. Do not start the normal local launcher, migrate retained databases or deploy pending DEV0396 as a side effect.

## Implementation plan

1. Create this ticket/index entry before app edits; finish/archive accepted DEV0397 and update the dated specification target.
2. Add a bounded weekly typed-read contract/repository/service/API branch using one authorization check and one availability-query connection; validate every returned day/time and fail closed as a whole on read errors. Retain the existing single-day API for compatibility.
3. Build shared responsive day cards and paging. Replace typed native-date/manual-load UI with actual class/place selection and automatic cancellable weekly reads; retain explicit review, own-account guards, pending feedback and idempotent retry semantics.
4. Apply shared week cards to legacy booking; load pending-request workspace for the whole visible week, retain original IDs and actual venues and existing withdrawal/cancellation behavior. Align guest sign-in copy and return context.
5. Add meaningful range/DST/malformed-data/authorization/race/recovery tests and a disposable fixture browser flow. Run focused and full relevant tests, lint/typecheck/build and native desktop/phone checks; record omissions or blockers accurately.
6. Review against all criteria, finalize implementation/validation evidence, archive and repair links/index only after required checks pass. No deployment/commit is implied.

## Acceptance criteria

- [x] AC1: Signed-in typed and legacy schedules show seven days with daily times, bounded Previous/Next/This week, final shorter page and valid guest-return date context; no native date picker is needed.
- [x] AC2: Class/place changes automatically load only actual full-fit times; stale/out-of-order/failed reads do not replace the current selection or imply zero. Auth/account/own-coach and guest privacy boundaries remain enforced.
- [x] AC3: Explicit review/submission, coach-pending success, same-command ambiguous retry, conflict recovery, actual venue/original slot IDs and legacy pending/withdraw/cancel behavior pass relevant checks.
- [x] AC4: Desktop/phone, keyboard and relevant error/retry/empty states pass; range/DST/server bounds, authenticated no-store API and malformed results have meaningful test evidence. Relevant tests/lint/typecheck/build pass or an exact blocker keeps this record open.
- [x] AC5: Specification/index/implementation record are current, isolated QA leaves retained data intact, and deployment/commit status is explicit.

## Validation plan

Unit tests for shared range/data parsing and review/recovery state; server repository tests with injected disposable connections proving all-day validation and closure; route authorization/cache checks for guest/preview/invalid inputs; current booking/privacy suites and existing typed-session database regression where applicable. Use isolated production-build fixtures for race, late response, filter/week/auth reset, keyboard review/Escape/focus, pending/conflict/unknown retries and legacy original-ID actions at desktop and phone widths. Run relevant/full application tests, scoped lint plus typecheck/build, and formatting/link/diff checks. Existing SQL authority is reused; no retained DB migration/reset is authorized or necessary. Record environment contamination separately if ignored work copies affect root checks.

## Implementation record

### Changes and rationale

Replaced the signed-in one-date form with seven day cards and start-time buttons for the selected actual class/place. Class/place selection initializes from existing bookable offers, loads automatically and clears incompatible time/review state on changes. Previous/Next 7 days and This week cover exactly thirty Berlin dates, including a shorter final two-date group. Native browser history retains week context, and invalid/repeated/outside dates show the current week with a specific notice.

Both typed and legacy booking use the same responsive cards and explicit review dialog. The legacy path retains original occurrence IDs, actual venues, pending/withdrawal state and existing booking cancellation. Its server workspace now reads pending requests for the whole visible week; typed booking does not fetch unnecessary legacy pending IDs. Guest counts and sign-in destinations retain their existing boundary, while copy now describes hours under each day.

The additive authenticated week read uses the database clock and the existing SQL full-fit/venue/conflict function on a separate ordinary-public connection, preserving the owner-override separation. One bounded availability statement returns all seven dates (or the final two); every day/time is validated and a missing/corrupt day fails the whole read. No partial response is described as a verified empty week.

Availability loads have abort plus independent response fences. Account/catalog/scope changes clear old choices; late mutation results cannot return after concealment. Unknown writes retain exactly the same command UUID and terms, lock incompatible controls and offer the same request retry plus My sessions. Conflicts reload availability and refresh the public catalog so an updated class revision can be selected; successful requests remain explicitly unconfirmed until coach acceptance. Own coaches cannot submit to themselves.

### Affected files

| File | Role |
| --- | --- |
| [Session week contract](../../../src/domain/session-week.ts) | Whole-week validation: canonical database-clock date groups, bounded day/time counts, future ordered starts, 15-minute grid, full duration and correct Berlin day. |
| [Typed repository](../../../src/server/db/coaches/typed-session-repository.ts), [service](../../../src/server/coaches/typed-session-service.ts), [API route](../../../src/app/api/coaches/[slug]/session-types/route.ts) | Add authenticated bounded weekly detail reads without changing single-day reads or mutations. |
| [Shared day cards](../../../src/features/coaches/seven-day-schedule.tsx), [styles](../../../src/features/coaches/seven-day-schedule.css), [time presentation](../../../src/features/coaches/public-schedule-model.ts) | Seven-column desktop/wrapping phone layout, pagination, loading/empty/unavailable, visible selection, readable repeated-hour offsets and low-cost reused clock formatters. Narrow cards use one time column. |
| [Request review](../../../src/features/coaches/session-request-review.tsx), [typed booking](../../../src/features/session-types/public-booking.tsx) | Actual class/place initialization, automatic fenced loads, native review dialog, explicit submit, pending confirmation, identical-command retry, conflict/catalog recovery and account/scope reset. |
| [Legacy marketplace](../../../src/features/coaches/coach-marketplace.tsx), [public page](../../../src/app/_coaches/public-coach-page.tsx), [guest boundary](../../../src/features/coaches/private-schedule-access.tsx) | Shared presentation for legacy original IDs, whole-week pending workspace, defensive concealment and unchanged count-only guest access. Load guest CSS from the page boundary. |
| [Public template](../../../src/features/coaches/website/public-coach-website.tsx), [template styles](../../../src/features/coaches/website/public-coach-website.css) | Booking spans the full profile width below information/contact columns while preserving the section anchor and contact controls. |
| [Domain tests](../../../tests/session-week.test.ts), [server tests](../../../tests/server/session-week.test.ts), [typed DB regressions](../../../tests/database/typed-sessions.test.ts) | Range/DST/malformed-data guards, preview denial/no-store behavior, connection cleanup and actual database-fit/accepted-overlap equivalence. |
| [Interface fixture](../../../tests/fixtures/seven-day-booking-harness.tsx), [UI rehearsal](../../../scripts/rehearse-public-coach-schedule-ui.mjs) | Reproducible disposable source-copy UI tests, including races/retries/history/auth changes, whole profile composition and pre-existing later-day legacy pending state. Only the copy has fixture routes/transports. |
| [README validation setup](../../../README.md#session-type-validation), [specification](../../../docs/mvp-spec.md#196-cards-username-urls-and-scheduling-compatibility), [index](../../README.md) | Actual rehearsal command, current presentation contract and delivery evidence. |

### Decisions and deviations

2026-10-20: DEV0398 was allocated concurrently to admin-hostname documentation, so this implementation uses next-unused DEV0399. No other work is absorbed.

2026-10-20 layout review: the existing public template places booking inside the narrower information column beside a 300-pixel contact card. Move the booking section below those columns so the approved seven-column desktop schedule has the full coach-page width. This is necessary integration of the accepted preview, not a redesign of profile content/contact controls. Preserve the section anchor and all guest/privacy rules.

2026-10-20 integration decisions: initialize only actual bookable classes/eligible catalog venues; refresh catalog revisions on conflict/retry, preserving this week's filters when the catalog is unchanged. Keep loading/unknown distinct from verified empty, preserve same-command ambiguous retries, and reset invalid/repeated/outside date context explicitly. Scoped controls and explicit dialog centering are necessary because the existing profile/global CSS overrides native defaults. Repeated wall-clock starts, if present, get offset labels; offset-changing ranges cannot look like zero-duration sessions.

### Contracts, configuration, and operations

Add `GET /api/coaches/[slug]/session-types?typeId=<uuid>&locationId=<uuid>&weekOf=YYYY-MM-DD`. Ready responses contain `week: { referenceTime, resetToCurrent, days: [{ date, times: [{ startsAt, endsAt }] }] }`. Date groups are anchored to database Berlin today; outside/expired context returns the current bounded week with `resetToCurrent: true`. Each day is present even when empty. Return at most seven dates and 100 validated times per date; reject missing/reordered/corrupt days, duplicate/off-grid/past starts and invalid durations. Conflicting `date`/`weekOf` or repeated `weekOf` parameters are invalid. The existing single-day and catalog branches and booking mutation payloads stay compatible.

The existing authorization wrapper protects weekly detail reads; responses retain `Cache-Control: private, no-store` and `Vary: Cookie`. No schema/function migration, new package, environment variable, production fixture route, account change or cache policy was introduced. Revert this ticket's source changes to roll back the interface/API addition; no data rollback is needed. The pending DEV0396 migration was applied only inside its disposable rehearsal databases, never to retained local/UAT/production.

`node scripts/rehearse-public-coach-schedule-ui.mjs --production --serve` leaves an explicitly labelled fixture server at http://127.0.0.1:3199/coaches/schedule-coach#private-schedule after testing. Enter `cleanup` or send an orderly termination signal to stop only that owned server and remove its exact temporary source copy. The fixture is not a real Auth/booking service. No real dummy accounts were created.

## Validation results

2026-10-20, macOS, Node 24.21.0 / installed Next.js 16.3.8 and React 19.3.0:

- `npm test`: **438 passed** (367 application/domain/interface tests and 71 server tests), zero failed/skipped. This includes four new weekly parsing/DST tests and three new server boundary/connection tests. Final run repeated after the date-query integration correction.
- `node scripts/rehearse-scheduling-timezone-database.mjs`: **62 passed** (31 each in fresh and upgrade scratch databases), zero failed/skipped. The new weekly repository reads exactly match real single-day 75-minute full-fit starts and exclude accepted overlaps. Outside-window reads reset using the real database clock. Existing typed/legacy/availability/concurrency/rescheduling regressions also pass. Both exact scratch databases were removed, with before/after retained-local row fingerprints unchanged. The source database was not migrated.
- `npm run lint`, `npm run typecheck`, `NEXT_TELEMETRY_DISABLED=1 npm run build -- --webpack`: passed in a canonical source snapshot without environment files or ignored work copies. The snapshot was removed afterward. Root globs include ignored historical scratch trees (known DEV0371 issue), so the canonical snapshot proves the project source without modifying the user's unrelated local files. Final changed TypeScript/script files also pass scoped ESLint.
- `node scripts/rehearse-public-coach-schedule-ui.mjs --production --serve`: **12 passed groups total** (one optimized build/type-check group and eleven interface groups), zero page exceptions, at 1440/320/375/430 pixels. Evidence: ignored `test-results/dev0399-schedule/results.json`, `build.log`, `server.log` and `schedule-<width>.png`. Groups cover all thirty dates/final page/Back, class duration/place and selection resets, ignored late reads even when transport ignores abort, catalog revision reset, empty/corrupt/unavailable/retry, keyboard review/Escape/focus, identical-command unknown retries, guarded double submission/late-write concealment, conflict refresh/own coach/guest return, legacy original IDs/pre-existing later-day pending/withdrawal/conflict/week navigation, readable single-line clock labels/44-pixel controls/contained centered dialogs, invalid/repeated/outside dates, and no-JavaScript guest count/login links.
- Native Safari: final real-component fixture reviewed at desktop width and a 375×844 phone viewport. Seven desktop columns and two phone day columns are readable. Selected time leads to the centered, fully fitting review; Escape cancels; explicit send produces the unconfirmed-request panel. Desktop Next 7 days preserves class/place; a failed weekly load is distinct from zero and Try again restores fitting times/selected class/place. Native checks use fixture transports only.
- Scoped Prettier `--check` across the changed source/test/rehearsal TypeScript, JavaScript and CSS files passed. Relative ticket/spec/index/README file links and section anchors were checked; `git diff --check` passed. Archival links were checked again after moving this record.

| Criterion | Evidence | Result |
| --- | --- | --- |
| AC1 | Real-component thirty-date/final-page/Back checks for typed and legacy UI; native desktop/phone cards; no date inputs | Passed |
| AC2 | Database-clock/full-fit repository checks; malformed whole-week rejection; preview denial/no-store; class/place, late-read and identity-change UI checks | Passed |
| AC3 | Explicit review, exact unknown-command reuse, double-submit guard, conflict/catalog recovery, original legacy IDs and later-day pending/withdrawal tests; retained cancellation code and existing booking regressions | Passed |
| AC4 | Production fixture at four widths, keyboard/Escape/focus/centered-dialog checks, native Safari, 438 app/server tests, 62 DB checks, lint/typecheck/build | Passed |
| AC5 | Specification/README/index/record and links reviewed; scratch databases/source snapshots removed; retained-local row fingerprints unchanged; no real dummy users; deployment/commit status explicit | Passed |

Initial checks found a CSS import that Node's static component tests could not load; moved that import to the Next page boundary. Phone visual review found inherited profile button padding wrapped time labels; scoped the schedule controls and added narrow-card/single-line checks. Native review found the application CSS reset removed default dialog centering; explicit margins/insets and containment checks correct it. An early legacy test looked for a global status inside the schedule subregion; corrected the locator without changing status placement. All affected checks were rerun successfully. These were local validation failures, not deployed regressions.

The production fixture replaces only its disposable copy's coach/actor routes and injects local-memory request responses. Its success is interface evidence, not real JWT/Auth or live booking mutation proof. API authorization is covered separately by server tests; availability/request/concurrency authority is covered by real scratch-database regressions. No hosted/UAT deployment or real-account browser writes were performed.

## Risks, limitations, and follow-ups

Seven-day availability evaluates more candidates than a single day. The bounded query reuses authoritative fitting checks, with explicit loading/retry rather than a fake zero. Scratch integration checks passed; no isolated weekly-read or retained/UAT latency benchmark was performed. Hosted rollout and the separate pending DEV0396 migration remain operational work. Public cache planning remains DEV0393.

No independent code review or real-account hosted browser rehearsal was performed. No new dummy users exist to remove. Native Chrome capture/activity issues were avoided by using a stable owned Safari tab; existing user tabs/accounts were preserved. The ignored HTML preview on port 3197 is separate from the implemented-component fixture on port 3199. Implementation, local validation and documentation are complete. Commit/deployment remain separate requested actions.

## Completion and review references

- Completed: 2026-10-20 — approved seven-day private booking implemented locally for typed and legacy paths; acceptance criteria and required local validation passed.
- Commit: `[DEV0397] [DEV0399] Implement seven-day athlete booking`, authorized on 2026-10-20. UAT release evidence is recorded separately when rollout completes.
- Review: Self-review against acceptance criteria and automated/native validation completed; no independent review.
- Deployment or release: Not deployed to UAT/production; local implementation and explicitly labelled fixture review only.
