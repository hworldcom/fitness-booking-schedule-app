# Ticket DEV0334: Promote coach sections to primary navigation

- Status: Completed
- Created: 2026-10-18
- Last updated: 2026-10-18
- Milestone: Authenticated workspace refinement
- Coordination: None — independent development ticket
- Related records: Athlete/coach views [DEV0333](DEV0333-switch-athlete-and-coach-navigation-views.md); independent calendar latency [DEV0277](../../current/backend/DEV0277-profile-and-reduce-coach-calendar-latency.md).

## Objective and context

The user wants three separate left-side coach entries: Schedule, Bookings and Events. Replace the single Coach workspace sidebar destination with those existing sections, keeping Home first and the athlete/coach switch from DEV0333. Update the [current navigation contract](../../../docs/mvp-spec.md#9-scheduling-behavior-and-permissions).

## Scope and non-goals

Shared coach destination definitions, desktop/mobile primary links, query-aware selected state, removal of duplicated in-page section tabs, focused tests and specification evidence. No new routes, data/permissions, booking/scheduling behavior, calendar optimization, account changes or unrelated marketplace work.

## Expected behavior and edge cases

Eligible coach view shows Home, Schedule (/coach), Bookings (/coach?view=bookings) and Events (/coach/events). Mobile uses the same entries. Remove the former in-page Schedule/Bookings/Events navigation; Schedule retains Calendar/Availability secondary navigation. Query-only transitions, reload and Back/Forward select exactly the displayed section. Nested Events detail/edit/create pages select Events; coach session/athlete details select Bookings. Invalid/repeated view values match the server's existing Schedule fallback. Public /events and /coaches paths do not select coach sections. Athlete view and existing capability/suspension gates, dropdown Trainings and independent Profile remain intact.

## Assumptions, decisions, and dependencies

Confirmed: three separate coach sections on the left. Adopted defaults: mirror entries in the mobile bottom bar, keep existing URLs and remove duplicate content tabs. Installed Next 16.3.8 Link/useSearchParams documentation reviewed; isolate search-parameter reading inside a narrow Suspense boundary rather than disabling prerendering of the application. Known calendar latency remains DEV0277; validate navigation independently of calendar performance without mocking identity or authority.

## Implementation plan

1. Reuse the existing three coach destinations and add exact pathname/query selection logic matching the server. Keep pure selection below feature/component layers and presentation destinations in shared components, as required by the repository's import-boundary tests; retain feature re-exports for existing consumers.
2. Update primary navigation with a shared desktop/mobile link renderer and narrowly bounded query subscription; remove duplicate section navigation from schedule/bookings/events content.
3. Update meaningful route/actor/render tests and current specification; adapt the existing navigation rehearsal assertion.
4. Verify real local desktop/phone navigation, keyboard, query-only transitions, nested links, history and athlete-view isolation. Run tests, lint/types/format/build, document results and complete/archive only after required evidence passes.

## Acceptance criteria

- [x] AC1: Coach primary navigation shows Home, Schedule, Bookings, Events in order; no duplicate in-page section tabs; Calendar/Availability remain within Schedule.
- [x] AC2: Exactly one correct section is selected across query changes, nested routes, invalid/repeated values, reload and browser history.
- [x] AC3: Athlete navigation, view switch, Trainings/Profile and existing capability/suspension boundaries are preserved on desktop and mobile.
- [x] AC4: Responsive/keyboard/error and relevant automated/build/document checks pass, with durable implementation evidence and explicit limitations.

## Validation plan

Pure route/query tests and component/actor navigation tests; existing coach scheduling/events regression tests. Real local coach browser at 1440px and 393px: all three visible links/destinations, keyboard, active state, Events nested page, athlete switch, reload/history and unchanged Schedule secondary links. Use owned Auth verification sessions; do not alter existing profiles or scheduling records. Existing calendar response latency may require a longer navigation deadline; distinguish data-loading failures from incorrect navigation and record actual omissions. Run npm test, lint, typecheck, format check, isolated configuration-free build and ticket/spec link consistency. No schema changes or migration tests.

## Implementation record

### Changes and rationale

Coach primary navigation now shows Home, Schedule, Bookings and Events in both the desktop sidebar and mobile bottom bar. These reuse the existing /coach, /coach?view=bookings and /coach/events destinations. Schedule/Bookings and Events content no longer render a duplicate section navigation; Schedule still owns Calendar/Availability, and Bookings retains its request/booked-session/My athletes sections.

The selected section uses both pathname and the complete view-query values rather than a /coach prefix match. This distinguishes query-only Bookings navigation, applies the server's strict repeated/invalid-value Schedule fallback, selects Events on its nested pages and Bookings on session/athlete details. A narrow Suspense boundary contains the query subscription; its fallback retains usable links without inventing an active query-dependent destination. Athlete view and dropdown destinations are unchanged.

### Affected files

| File | Role |
| --- | --- |
| [shell.tsx](../../../src/components/shell.tsx) | Replaces the coach primary item with three shared destinations and uses the same desktop/mobile renderer. |
| [coach-workspace-destinations.ts](../../../src/components/coach-workspace-destinations.ts) | Canonical labels, URLs and icons for the existing sections. |
| [workspace-navigation.tsx](../../../src/components/workspace-navigation.tsx) | Query-aware link rendering, active/aria-current state and narrow prerender fallback. |
| [coach-workspace.ts](../../../src/domain/coach-workspace.ts) | Pure strict view/route resolution shared with existing server consumers. |
| [feature view](../../../src/features/coaches/coach-workspace-view.ts) and [feature destinations](../../../src/features/coaches/coach-workspace-navigation.tsx) | Compatibility re-exports preserve existing module paths while respecting import boundaries. |
| [coach-availability-panel.tsx](../../../src/features/coaches/coach-availability-panel.tsx) and [Events screens](../../../src/features/coach-events/screens.tsx) | Remove duplicated in-page section navigation while retaining content and secondary views. |
| [workspace-navigation tests](../../../tests/workspace-navigation.test.ts), [shell tests](../../../tests/shell-navigation.test.ts), [schedule tests](../../../tests/coach-schedule.test.ts) | Route/query/actor/active-state/prerender and no-duplicate schedule/bookings regressions. |
| [local availability rehearsal](../../../scripts/rehearse-local-coach-availability.mjs) | Existing primary-link assertion now expects Schedule rather than Coach workspace. |
| [specification](../../../docs/mvp-spec.md) and [index](../../README.md) | C48 and consistent current navigation/acceptance/lifecycle records. |

### Decisions and deviations

2026-10-18: the first regression run caught shared components importing feature modules. Move the pure route/view resolver to src/domain and presentation destinations to src/components, retaining compatibility re-exports from the existing feature modules. Preserve the architectural check. One initial test attempted importing a stylesheet-bearing Events screen into Node; replace that unsuitable render check with actual browser duplicate-navigation validation. The focused route/menu/scheduling tests pass. The initial repository-wide format check reported unrelated marketplace drafts; those files were left to their owner and the final global check passed.

### Contracts, configuration, and operations

No server, identity, data, route, dependency or environment change. Only navigation presentation and selection are changed.

## Validation results

2026-10-18, existing local Docker app at localhost:3100. No hosted migration/configuration/deployment.

- `node --import tsx --test tests/workspace-navigation.test.ts tests/shell-navigation.test.ts tests/coach-schedule.test.ts`: 22 focused checks passed (`/tmp/dev0334-focused-tests.log`). Includes strict query fallback, nested Events/session/athlete paths, public-prefix exclusion, desktop/mobile one-active-link state, actor bounds and usable prerender links.
- Final `npm test`: 252 application/unit and 41 server tests passed (293 total), including the unchanged import-boundary check (`/tmp/dev0334-tests-final.log`). The first regression run caught feature imports from shared components; the lower-layer extraction fixed that violation.
- Final `npm run lint`, `npm run typecheck`, scoped Prettier and final `npm run format:check` all passed (`/tmp/dev0334-lint-final.log`, `/tmp/dev0334-types-final.log`, `/tmp/dev0334-format-focused.log`, `/tmp/dev0334-format-final.log`). Initial global formatting warnings came from unrelated in-progress marketplace files and were not fixed under this ticket.
- Configuration-free `env DATABASE_URL= NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= NEXT_PUBLIC_SITE_URL= NEXT_PUBLIC_GEOAPIFY_API_KEY= npm run build`: compile, TypeScript and 24 static pages passed (`/tmp/dev0334-build.log`). This proves the query subscription does not require disabling application prerendering.
- `node /tmp/dev0334-browser.mjs` and final `node /tmp/dev0334-browser.mjs --phone`: real Daniel password sign-in exercised 1440px/393px navigation order, keyboard Bookings activation, query-only selection, Back/Forward, reload, Events/new-page selection, no duplicated content tabs, retained Calendar/Availability, Trainings/Profile and switching to athlete-only navigation. Desktop phases passed in the first run; the final phone repeat passed both phone phases. Evidence: `/tmp/dev0334-browser.log`, `/tmp/dev0334-browser-phone.log`, `/tmp/dev0334-browser-result.json` and inspected desktop/phone screenshots. No horizontal overflow observed. Test-only hiding of Next development-tool chrome leaves application markup unchanged.
- The initial browser helper's global preservation assertion was unsuitable while another task created and removed its own profiles. Its finalizer also obscured the first unfinished phone Events attempt; that attempt is not counted as passed. Final phone phases passed. `node /tmp/dev0334-preservation.mjs` verified all four completed phase records and all 15 exact original stable profile fingerprints, ignoring unrelated transient fixtures. No account/fixture/profile/scheduling change was performed by this navigation rehearsal, verification sessions were signed out, and the temporary credential file was removed. No other task's fixtures were deleted.
- Schedule was exercised through its existing Availability subview to avoid repeating DEV0277's slow default calendar loader. The default Schedule href and retained Calendar link were verified; no fresh calendar performance result is claimed.
- Local link/identifier/current-contract validation and scoped `git diff --check` passed. No migration checks apply because no schema or server authority changed.

| Criterion | Evidence | Result |
| --- | --- | --- |
| AC1 | Actual desktop/phone order and screenshots; content tabs absent, Schedule secondary links retained. | Passed |
| AC2 | Pure/query/render tests plus actual query-only Bookings, nested Events, reload and Back/Forward. | Passed |
| AC3 | All actor-status navigation tests; real athlete switch and unchanged Trainings/Profile destinations. Existing suspended gates pass. | Passed |
| AC4 | 293 tests, lint/types/format/build, actual responsive/keyboard/error-boundary checks, profile preservation and document consistency. | Passed |

### Commit isolation review — 2026-10-18

Prepared a clean HEAD snapshot containing only DEV0326/DEV0327/DEV0333/DEV0334 and their shared navigation prerequisites, excluding concurrent authentication, coach website, session-type, preview and operational changes. Shared shell/menu/connection modules require one combined prerequisite commit; DEV0339 follows separately. Repository-relative Markdown links resolved in the isolated snapshot, and reserved identifiers for excluded work remain unavailable for reuse.

Fresh validation: `node --import tsx --test --test-concurrency=2 tests/*.test.ts` passed 281 tests; `node --import tsx --conditions=react-server --test --test-concurrency=2 tests/server/*.test.ts` passed 45 tests (326 total). `npm run lint` passed. `npm run typecheck` passed with the temporary copy's compiler process limited by `NODE_OPTIONS=--max-old-space-size=1024`; repository package/compiler configuration is unchanged. Logs: `/tmp/dev0339/commit-prerequisites-{unit-serial,server-serial,lint-serial,types-bounded}.log`. Initial sandboxed `npm test` could not open its local IPC socket; parallel unrestricted retries timed out in four existing startup/rehearsal-runner checks under resource pressure. The two-worker retries all passed. Stopped the stalled unrestricted typechecker and reran with the memory cap successfully. No application source change was needed. Existing recorded browser/build evidence remains applicable; no database, provisioning or mutation rehearsal was rerun for this commit.

## Risks, limitations, and follow-ups

Unrelated shared marketplace/Auth/Storage changes were preserved. Calendar response-time work remains DEV0277; no calendar SQL or performance claim is included. No deployment, independent review or new authorization is implied.

## Completion and review references

- Completed: 2026-10-18 — separate coach primary entries, correct selected state and real responsive/keyboard checks verified.
- Commit: Included in `[DEV0326][DEV0327][DEV0333][DEV0334] Complete workspace navigation foundations`; these completed prerequisites share the shell, menu and connection-view modules required by DEV0339.
- Review: Scope, import boundaries, strict selection and acceptance evidence self-reviewed; no independent review.
- Deployment or release: None.
