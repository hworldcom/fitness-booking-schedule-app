# Ticket DEV0366: Require login for private coach schedules

- Status: Completed
- Created: 2026-10-19
- Last updated: 2026-10-19
- Milestone: M10 — Coach marketplace websites refinement
- Coordination: None — independent development ticket
- Related records: Historical baseline [DEV0317](../../archive/frontend/DEV0317-build-shareable-personal-coach-websites.md); downstream integration [DEV0319](../../current/backend/DEV0319-rehearse-coach-marketplace-websites.md)

## Objective and context

The public coach website currently lets guests browse individual private-session dates/times. The user requests login before viewing that schedule, retaining a total and seven daily boxes showing open-slot counts for guests. Restyle the calendar using Home’s light purple and soft green mix, replacing the old saturated green. This amends [private scheduling](../../../docs/mvp-spec.md#18-coach-calendar-and-effective-availability) and [public coach websites](../../../docs/mvp-spec.md#19-coach-marketplace-cards-and-personal-websites).

## Scope and non-goals

- In scope: guest aggregate card, seven daily count boxes and sign-in return; server-rendered and session-times API access boundaries; typed and legacy private schedules; session-change concealment; calendar and booking colors on public coach websites; meaningful count/access tests and disposable local UI proof.
- Out of scope: published group/event details, changes to booking authority or capacities, authentication methods, coach workspace calendars, media, retained demo data, unrelated pending workspace changes or deployment.

## Expected behavior and edge cases

- Guests see the total and seven daily boxes with dates and open private-slot counts for the next seven Berlin local dates (today through today + 6), excluding starts at/before database time. A day box leads to sign-in with that date as return context. No individual times, slot IDs, full calendar navigation or time-selection controls are delivered in guest HTML/React payloads or the times API.
- Count distinct start instants across currently bookable private types and active eligible venues; reuse existing duration/full-fit, hours, overrides, days off, 30-day horizon and private/group overlap checks. Multiple types/venues sharing a start count once. These are alternative starts, not guaranteed independent bookings. Legacy inventory counts distinct future requestable starts in the same window. Published group seats are excluded.
- A verified zero says no open slots; failed count/catalog reads show unavailable with retry, never a fabricated zero. Public content/services and published group details remain visible.
- Sign in to view schedule returns to the canonical coach path and #private-schedule; preserve an existing valid date parameter as context without revealing availability or automatically submitting.
- Authorized accounts retain the full 30-day typed/legacy selection and explicit booking flow. Sign-out/account changes immediately conceal schedule controls and prevent new detail reads; failures fail closed.
- Calendar surfaces blend pale lavender and soft mint like Home; purple selected controls/focus and dark readable text replace saturated green panels. Scope styles to the public coach website.

## Assumptions, decisions, and dependencies

- User-confirmed: login requirement, seven-day guest count with daily boxes, and Home’s light purple/green palette (19 October 2026).
- Adopted default: next seven days means seven Berlin calendar dates including today, matching the existing scheduling timezone/horizon; distinct starts avoid multiplying the count by type/venue alternatives. The UI calls these open slots and briefly explains that they are available start times.
- Reuse installed Next.js 16.3.8 server authentication and database availability functions. Read bundled authentication/data-security guides before changes. An additive count-only database function is now required for responsive summaries. It reuses effective hours and full-fit authority, exposes seven date/count pairs only, and grants execution only to the existing restricted application role. Existing functions already exclude anonymous Supabase roles.
- Scope review: one vertical slice with supporting server projection/access and UI; no coordination hierarchy needed. Dependencies permit starting. Do not alter archived baseline behavior records except required link maintenance.

## Implementation plan

1. Add the confirmed access/presentation amendment to the specification and index this ticket.
2. Add a server-only seven-day summary using authoritative typed availability (one bounded database aggregate function) and legacy filtering; validate the minimal seven-day date/count result and handle failures locally.
3. Authenticate detail API calls and render the full schedule only for a verified actor. Exclude schedule arrays from guest client props, retain a safe sign-in return, and conceal already rendered details on session changes.
4. Apply Home-inspired lavender/mint styling to guest summary, public calendar/date navigation and time selections.
5. Add boundary/authorization tests; run focused and relevant regression tests, lint, TypeScript and build. Rehearse actual guest/authenticated flows at desktop/mobile widths with keyboard/failure checks using newly tagged disposable accounts only; clean up exactly owned fixtures.
6. Review criteria and changed-file scope, finish evidence, and archive only after required checks pass.

## Acceptance criteria

- [x] AC1: Guests see the truthful seven-day total, seven daily count boxes and login link, with no individual private schedule data in page payloads; canonical/legacy routes and date links behave consistently.
- [x] AC2: Individual-times API denies unauthenticated/unverified callers; authorized callers retain current availability and booking semantics.
- [x] AC3: Counts deduplicate alternatives, respect type duration/venue/conflicts/future seven-date window (including timezone/DST), exclude groups, and distinguish zero from unavailable.
- [x] AC4: Sign-in returns to the coach schedule; sign-out/account changes hide detail controls; navigation/login does not submit a booking.
- [x] AC5: Public calendar/booking/summary use lavender and soft green with readable selected, disabled and keyboard-focus states, without horizontal overflow on mobile/desktop.
- [x] AC6: Relevant regression, lint, TypeScript, build and real local checks pass; unrelated working-tree content and retained demo data are preserved; durable evidence is complete.

## Validation plan

Unit tests for date/count boundaries, duplicate starts and minimal projections; server tests for API authorization before data reads and malformed summary rejection. Relevant existing public schedule, website and typed booking regressions. Scoped ESLint/Prettier, npm run typecheck, npm run build -- --webpack. Real local fixtures exercise typed/legacy page/API, count equality, zero/failure, guest payload absence, login return, session concealment and keyboard use at 375 and 1440 px (additional widths if layout requires). Validate the additive function against a disposable database and local runtime, including grants, count agreement with existing individual-time authority, retained-row fingerprints and exact fixture cleanup. Preserve original retained-record hashes and exact cleanup proof; never provision/reset retained demo coaches.

## Implementation record

### Changes and rationale

The server page now sends a guest preview instead of either private booking interface until the actor is authorized. Guest preview props contain only seven dates/counts, their total, a canonical return URL and no schedule children. The public website state receives an empty slot array; actual legacy occurrences reach only the authorized booking branch. The client access boundary checks both Auth subject and dataset/role identity, unmounting details when they no longer match.

Individual-times GET now authorizes before calling the existing availability projection and returns 401 signed-out, 403 forbidden/preview or 503 unavailable. Its responses use `private, no-store` and `Vary: Cookie`. Public service catalogs and published groups remain readable. The type-first booking boundary also requires an authorized account. The detail read retains its own public database connection so an owning coach's authorization context cannot enable owner-only overrides in this public booking view.

The guest card shows the total and seven mint daily boxes, each linking to login with its date and `#private-schedule`. Dates follow authoritative Berlin time. The typed summary function chooses the shortest eligible private type at each active venue and enumerates quarter-hour starts within current effective hours, reusing the existing full-fit function for duration, venue, overrides, manual closures, private/group conflicts and horizon/time checks. Longer offers cannot add a start that the shortest cannot fit under the shared-hours contract. PostgreSQL returns date/count rows only. The repository validates seven consecutive dates and bounded nonnegative integer counts and drops any extra fields. Legacy counts deduplicate future requestable starts per date. Failed reads preserve the profile with unavailable/retry instead of a false zero.

The public booking frame, day boxes, time radios and selected/focus states now use Home's lavender/mint gradient, purple emphasis and readable text. Shared date labels moved to the existing pure schedule model so the guest component and navigation use identical labels without importing a stylesheet into unit rendering.

### Affected files

| File or component                                                                                                                                                                                                                                      | Change and purpose                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| [Public page composition](../../../src/app/_coaches/public-coach-page.tsx)                                                                                                                                                                             | Authorized-only schedule branches, minimal guest state and summary composition.                                          |
| [Access boundary and daily preview](../../../src/features/coaches/private-schedule-access.tsx)                                                                                                                                                         | Seven count boxes, safe login/date return and session identity concealment.                                              |
| [Summary model](../../../src/domain/private-schedule-summary.ts)                                                                                                                                                                                       | Berlin legacy counts and seven-day aggregate validation.                                                                 |
| [Summary service](../../../src/server/coaches/private-schedule-summary-service.ts), [repository](../../../src/server/db/coaches/private-schedule-summary-repository.ts)                                                                                | Typed/legacy selection, local failure state and count-only database projection.                                          |
| [Migration](../../../supabase/migrations/20261019000100_private_schedule_preview.sql)                                                                                                                                                                  | Bounded `app.public_private_schedule_preview(text)` with existing availability authority and restricted execute grants.  |
| [Times service](../../../src/server/coaches/typed-session-service.ts), [GET route](../../../src/app/api/coaches/[slug]/session-types/route.ts), [typed booking](../../../src/features/session-types/public-booking.tsx)                                | Verified authorization and private response caching for individual-time reads.                                           |
| [Public website styles](../../../src/features/coaches/website/public-coach-website.css)                                                                                                                                                                | Scoped lavender/mint preview, calendar and time-choice styling.                                                          |
| [Schedule model](../../../src/features/coaches/public-schedule-model.ts), [date navigation](../../../src/features/coaches/public-schedule-navigation.tsx)                                                                                              | Shared date labels; authenticated navigation behavior retained.                                                          |
| [Access tests](../../../tests/private-schedule-access.test.ts), [server tests](../../../tests/server/private-schedule-summary.test.ts)                                                                                                                 | Guest/identity/zero/failure, DST/future/duplicate and minimal response boundaries.                                       |
| [Database rehearsal](../../../scripts/rehearse-private-schedule-preview-database.mjs), [local API/browser rehearsal](../../../scripts/rehearse-local-private-schedule-access.ts), [fixture helper](../../../scripts/lib/local-connection-rehearsal.ts) | Additive function/grants/preservation proof, exact DEV0366 fixtures/cleanup, interactive browser companion on port 3166. |
| [Specification](../../../docs/mvp-spec.md), [index](../../README.md), current DEV0319/COR0028 records                                                                                                                                                  | Updated current guest contract, integration handoff and lifecycle links.                                                 |

### Decisions and deviations

2026-10-19: Count unique starts rather than summing type/venue variants, to avoid overstating available choices. During implementation the user clarified that guests should retain the daily count boxes. The amended plan exposes seven date/count pairs while individual times remain authenticated. The first real aggregate query also exposed PostgreSQL compilation cost; disabling JIT alone did not resolve the all-day/type scan cost. Before implementing the revised approach, adopt an additive count-only security-definer function that enumerates candidates inside effective offered hours, chooses the shortest eligible private offer per venue (all types share venue hours; longer intervals cannot add a start that the shortest cannot fit), and reuses typed_session_fits for every candidate. This changes no data or booking authority.

### Contracts, configuration, and operations

Session-times GET requires verified authorization (401/403/503 fail closed); public catalog GET remains unchanged. Aggregate returns only seven dates/counts and their total. No dependencies, environment variables or retained-data changes. Deploy the additive private-summary function before relying on typed guest counts; missing/failed function reads show unavailable. Migration `20261019000100` was applied locally with `supabase migration up --local`; no other migration was pending. Hosted rollout is not performed. Rollback uses `DROP FUNCTION app.public_private_schedule_preview(text)` after restoring the prior application or accepting unavailable typed counts; no data rollback is required. The rehearsal-only `PRIVATE_SCHEDULE_PREVIEW_PATH` optionally reuses a built temporary preview only after all source TS/TSX/CSS bytes match; it is not an application environment variable.

## Validation results

2026-10-19, Node 24.21.0, Next.js 16.3.8, exact loopback Supabase project, restricted application login, isolated production preview on localhost:3166.

- `node --import tsx --test --test-concurrency=2 tests/*.test.ts` — **342/342 passed** with local IPC allowed; log `/tmp/dev0366/unit-passed.log`. Earlier sandbox runs passed 341 and denied tsx's temporary startup pipe; the final complete run resolves that restriction.
- `node --import tsx --conditions=react-server --test --test-concurrency=2 tests/server/*.test.ts` — **64/64 passed**; log `/tmp/dev0366/server-passed.log`.
- Scoped `eslint` and `prettier --check` over the 16 affected source/style/test/script files — passed, no lint errors/warnings. `git diff --check` passed. Commands used the Node 24 path recorded above; the exact scoped file set is the affected code/test/script table, excluding SQL/Markdown.
- `npm run typecheck` generated route types but failed on obsolete ignored `work/dev0336/commit-files` copies and two initial implementation errors. Those implementation errors were corrected. `node node_modules/typescript/bin/tsc --noEmit --project /tmp/dev0366/tsconfig.json` then passed for every active source, script, test and generated route type, excluding only ignored `work/` and `tmp/` artifacts. The default command's unrelated ignored-copy issue remains; repository configuration was not broadened in this change.
- The local rehearsal runs `next build --webpack` with a 1536 MiB heap in an environment-file-free temporary copy and starts `next start` with loopback runtime settings. Production build/TypeScript passed in `/private/tmp/movx-dev0366-ToriCt/server.log`. Before subsequent API/native runs reused that build, the script checked every source TS/TSX/CSS file byte-for-byte against the working source. The final rehearsal script's later input-close adjustment passed its own lint/types checks.
- `node scripts/rehearse-private-schedule-preview-database.mjs` — fresh empty-schema function and grants passed; seeded upgrade preserved every application-table fingerprint and all prior authority function definitions. Runtime may execute; anonymous and authenticated Supabase roles may not. Its exact disposable database was removed. `supabase migration list --local` showed only the new migration pending; `supabase migration up --local` applied it successfully without provisioning or resetting any account.
- `node --import tsx --conditions=react-server scripts/rehearse-local-private-schedule-access.ts` — actual new typed coach, legacy coach and athlete exercised application Auth/catalog/times/page APIs. The typed total **11** equals the distinct union of actual 60/75/90-minute offers on days +1/+6 with a published group conflict; the legacy total **6** excludes day +7. Guest HTML/React payloads omit private occurrence IDs, time objects, calendars and selection controls; catalog remains public; every guest detail request returns 401; authorized reads retain actual times. Confirmed username page and legacy redirect pass. Guest page timings were about 2.1–2.2 s cold and 0.6 s for the subsequent legacy page; the earlier multi-minute aggregate is gone.
- Native Firefox at **1440 px and 375 px**: actual guest total/seven daily boxes; lavender/mint frames; purple visible keyboard focus; Tab → Tue 20 Oct box → Enter reached login with canonical date/anchor. Normal temporary-account password login returned to that exact date with no selected class/time or booking. Choosing Boxing 60 loaded only 10:00–11:00 and 12:00–13:00 around the published 11:00 group; selecting a radio showed lavender selection and an explicit unsent review. Authenticated legacy calendar showed mint days, lavender current day, disabled previous navigation and actual venues at both widths. Content, date controls and choices wrapped without horizontal overflow.
- Final documentary/self-review: 499 local links, 30 Markdown anchors, unique ID/archive/index/status checks and `git diff --check` passed. All 82 unrelated pre-existing working files remain byte-for-byte unchanged.
- Native sign-out through Account → Login & security returned to login; reopening the coach showed count boxes with no time controls. Setting only the disposable coach's offers non-bookable showed **0 plus seven zero days**, then restoring them showed **11** again while signed out. Unavailable/retry and changed-account/dataset states are covered by real component/server tests; a native database outage was not injected into shared services.
- Exploratory runs exposed a slow aggregate and two fixture issues (password update invalidated its old session; group publication correctly conflicted with already-open legacy hours). The implementation switched to the bounded function; the fixture reauthenticates and publishes its group before saving offered hours, asserting every outcome. First interrupted runs were recovered by exact recorded IDs; later runs and the final native cohort all cleaned up. Final evidence is `tmp/dev0366/b15b28e2/result.json`: three exact identities/profiles removed and all **46** original profile/location/type/content/rate/Auth fingerprints unchanged. No retained demo setup, password rotation, content edit or reset ran. A final independent query across all seven exploratory/final runs found zero DEV0366 Auth users, zero remaining profiles among the 21 exact journaled IDs and zero temporary handles. The preview stopped and fixture credential files were removed.

| Criterion | Evidence                                                                                                                           | Result |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Actual typed/legacy/canonical guest payload checks, seven daily native boxes and safe links                                        | Passed |
| AC2       | Actual 401 vs authorized times, preview 403 test, private/no-store headers                                                         | Passed |
| AC3       | Real three-duration union/group conflict/day +7 exclusion; legacy, DST/future/duplicate/zero/failure tests; bounded SQL projection | Passed |
| AC4       | Native Tab/Enter/login/date return, unsent request review and sign-out; subject/dataset/component tests                            | Passed |
| AC5       | Native 1440/375 guest, typed and legacy surfaces; selected/disabled/focus and wrapping observations                                | Passed |
| AC6       | 342 unit + 64 server, scoped lint/format, active-source types, production build, migration/grants/preservation and exact cleanup   | Passed |

Exact final scoped lint/format commands (run with Node 24 on PATH):

```sh
node node_modules/eslint/bin/eslint.js 'src/domain/private-schedule-summary.ts' \
  'src/server/db/coaches/private-schedule-summary-repository.ts' \
  'src/server/coaches/private-schedule-summary-service.ts' \
  'src/features/coaches/private-schedule-access.tsx' \
  'src/features/coaches/public-schedule-model.ts' \
  'src/features/coaches/public-schedule-navigation.tsx' \
  'src/app/_coaches/public-coach-page.tsx' \
  'src/server/coaches/typed-session-service.ts' \
  'src/app/api/coaches/[slug]/session-types/route.ts' \
  'src/features/session-types/public-booking.tsx' \
  'tests/private-schedule-access.test.ts' \
  'tests/server/private-schedule-summary.test.ts' \
  'scripts/rehearse-local-private-schedule-access.ts' \
  'scripts/rehearse-private-schedule-preview-database.mjs' \
  'scripts/lib/local-connection-rehearsal.ts'
node node_modules/prettier/bin/prettier.cjs --check 'src/domain/private-schedule-summary.ts' \
  'src/server/db/coaches/private-schedule-summary-repository.ts' \
  'src/server/coaches/private-schedule-summary-service.ts' \
  'src/features/coaches/private-schedule-access.tsx' \
  'src/features/coaches/public-schedule-model.ts' \
  'src/features/coaches/public-schedule-navigation.tsx' \
  'src/app/_coaches/public-coach-page.tsx' \
  'src/server/coaches/typed-session-service.ts' \
  'src/app/api/coaches/[slug]/session-types/route.ts' \
  'src/features/session-types/public-booking.tsx' \
  'src/features/coaches/website/public-coach-website.css' \
  'tests/private-schedule-access.test.ts' \
  'tests/server/private-schedule-summary.test.ts' \
  'scripts/rehearse-local-private-schedule-access.ts' \
  'scripts/rehearse-private-schedule-preview-database.mjs' \
  'scripts/lib/local-connection-rehearsal.ts'
```

### Commit preparation — 2026-10-19

The user subsequently requested this checkpoint. Prepared exactly 22 owned paths over `5a31cf3`, excluding pending discovery, Events, How it works and authentication changes. Shared specification/index/rehearsal-helper files contain only DEV0366 deltas in this snapshot; DEV0365 remains explicitly reserved for its separate uncommitted implementation. The specification update date is corrected to 19 October.

The environment-file-free snapshot at `/tmp/dev0366-commit/validation` passed `npm run build -- --webpack` (including TypeScript), the same unit/server commands above with **331/331 unit and 61/61 server checks**, scoped ESLint/Prettier, and 480 local document links/30 anchors plus archive/index/status checks. These counts exclude tests owned by the other pending changes. Logs are `/tmp/dev0366-commit/{build,unit,server}.log`. No database, Auth or retained demo operation ran during commit preparation. The earlier native, database migration/grant and exact fixture cleanup evidence remains above.

## Risks, limitations, and follow-ups

Counts represent alternative start times, not additive capacity. Existing public group times remain public under the separate event contract. Availability is rechecked when requesting/accepting. Hosted rollout requires the new additive migration; local completion does not imply hosted deployment. The shortest-offer optimization depends on the current shared effective venue-hours model; revisit it if type-specific schedules are added. DEV0319 retains combined marketplace integration ownership. No new media, booking authority or auth method was introduced.

## Completion and review references

- Completed: 2026-10-19 — guest daily counts, verified schedule access and lavender/mint public calendar passed all criteria.
- Commit: User-requested checkpoint — `[DEV0366] Require login for private coach schedules`.
- Review: No independent review; acceptance/file-scope self-review completed.
- Deployment or release: Not deployed.
