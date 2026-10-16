# Ticket DEV0254: Add the private and group coach calendar

- Status: In progress
- Created: 2026-10-16
- Last updated: 2026-10-16
- Milestone: M9 — Coach calendar and effective availability
- Coordination: [COR0023 — Coach calendar and availability](../organisatory/COR0023-coach-calendar-and-availability.md)
- Related records: contract owner [DEV0251](../../archive/organisatory/DEV0251-define-coach-calendar-and-availability.md); peer dependencies and external M7 relationships are mapped in COR0023.

## Objective and context

Deliver the coach-facing Day/Week/Month calendar with Week as default, combining truthful dated private and published group records and linking their original authorized detail workflows.

Implement against [specification section 18](../../../docs/mvp-spec.md#18-coach-calendar-and-effective-availability), [M9](../../../docs/mvp-spec.md#12-delivery-milestones) and the [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix). Confirmed choices and adopted operating defaults are distinguished in the specification; reference Everfit controls are not additional requirements.

## Scope and non-goals

- In scope: Actor-scoped read-only period projection/service and cursor paging for at most 42 local dates; Calendar/Availability secondary view and canonical period/filter state; Day/Week/Month and agenda, navigation/current-time marker, venue/type/history filters, month overflow and original-ID detail links. This ticket owns calendar-read integration as part of its frontend vertical slice.
- Out of scope: Effective availability or write SQL owned by DEV0252; weekly/date editor owned by DEV0253; private/group booking decisions, group publication/roster/editor, athlete-wide conflict guarantees, public date controls or external synchronization.

## Expected behavior and edge cases

Open groups reserve time but are not Confirmed; group drafts are absent. A pending private request is a coach-only count rather than a reserved event. Confirmed past private bookings do not auto-complete. Keep actual snapshot venues through primary changes/deactivation. Cancelled/withdrawn history cannot appear as free capacity. Outside-horizon cells show no invented private availability, while real future groups remain visible. All paged results remain reachable without exposing athlete identities/photos or private notes in the calendar feed.

## Assumptions, decisions, and dependencies

DEV0252 provides effective dated inventory; DEV0238 externally provides stable group reservation/lifecycle behavior. Coordinate existing/planned DEV0239 owner group-detail links without implementing that ticket. Final actionable group links require its authorized destination to exist; do not claim a complete mixed flow with an inert placeholder. DEV0253 shares view/date integration and styles.

Scope review: this record owns one delivery boundary under a flat coordination. Implementation started after the user requested committing DEV0253 and starting this peer. DEV0252 contracts and the DEV0253 checkpoint are available. The user’s migration deferral remains active; prepare the calendar read migration without applying it, and use explicit isolated fixtures for UI checks. Required live SQL/Auth proof and the DEV0239 group-owner destination remain completion prerequisites. Inspect actual versions/bundled documentation before framework or SDK integration changes and update this plan before material deviations.

## Implementation plan

1. Inspect installed Next.js server-data/navigation docs and inventory existing request/booking/group projections and original-ID destinations. Specify a bounded owner period DTO and canonical date/view/type/venue/history parameters before implementing the feed.
2. Implement the read-only actor/dataset-scoped period projection, complete cursor traversal and truthful lifecycle summaries using DEV0252 inventory and existing group authority; recheck current access on each page.
3. Build Day/Week/Month, default Week, Today/previous/next, filters, current-time marker and complete agenda. Month shows three summaries plus exact More count opening a full day agenda; preserve URL/back/reload/focus.
4. Integrate selected-date availability links with DEV0253 and original private/group details without creating implicit sessions. Verify real mixed data, paging/overflow, history, mobile/keyboard, access failures and existing private-workspace regressions.

## Acceptance criteria

- [ ] AC1: All three views show real actor-scoped private/group dates, kinds, actual venues and states; Week is default and request counts remain coach-only.
- [ ] AC2: Period queries are bounded/paged and every result remains reachable; filters, More/day agenda, browser navigation and dates beyond the private horizon behave truthfully.
- [ ] AC3: Selections reach real authorized original details/editor contexts; no implicit booking, request decision, group publication or athlete-data grant occurs.
- [ ] AC4: Desktop/375/430 px, keyboard, crowded-month, long venue/history, dirty-editor transition and unavailable/access-state checks plus relevant projection/privacy/static/build tests pass.

## Validation plan

Use meaningful period projection tests for actor/dataset isolation, mixed lifecycle, exact venue snapshots, 42-date bounds, paging and private-field absence. Run real local coach browser checks through Day/Week/Month/agenda, type/venue/history filters, selected-date editor and existing private/group details with back/reload. Cover month overflow, groups beyond 30 dates, 375/430 px, keyboard, suspended/hidden/unavailable states; run relevant tests, lint, typecheck, format:check and build. DEV0256 owns final combined closure/restoration/public recovery proof.

## Implementation record

Implementation started on 16 October 2026 after user-authorized DEV0253 checkpoint `1db71b8`. No database migration is applied by this phase.

### Changes and rationale

The coach Schedule route now defaults to a combined Week calendar, with Day and Month links and an adjacent Availability view. Calendar data distinguishes available private hours, original private bookings and published groups. Exact status text accompanies color; pending requests remain counts on open hours, past private bookings remain Confirmed, ended confirmed groups display Ended, and cancelled/withdrawn records require the history filter.

The calendar includes Today/previous/next, type/venue/history filters, inactive snapshot labels, timed desktop Day/Week blocks and a complete paged agenda at every width. Month uses 42 Monday-first dates, at most three previews per date and exact More counts that open the full Day agenda. Each date's previews/counts are independent of the loaded agenda page. Overnight groups display explicit dates in the agenda/detail and clipped daily times in the grid.

Added a bounded owner read contract and prepared its additive migration. The group schema intentionally permits no direct runtime SELECT, so the narrow function derives coach/dataset from verified actor context and returns only original source IDs, times, titles, venue snapshots, states and counts. It delegates inventory reconciliation to existing DEV0252 authority. A content version detects changes between pages and requires a fresh period read rather than combining inconsistent pages. No athlete name/ID, media, messages, notes or roster enters the calendar DTO.

### Affected files

- [Calendar domain](../../../src/domain/coach-calendar.ts) owns canonical URL/query normalization, Monday-first date periods, bounded/cursor validation, redacted result parsing, half-open local-date membership and stable original-ID merging. [Presentation model](../../../src/features/coaches/coach-calendar-model.ts) owns permission classification, original detail URLs, overnight range labels and overlapping-history lanes.
- [Prepared migration](../../../supabase/migrations/20261016000300_owner_coach_calendar.sql) adds `app.owned_coach_calendar(jsonb)` with explicit owner/dataset conditions in all three source branches, a maximum 42-date period, 50-item keyset pages, exact filtered per-day summaries and a content version. It grants only the restricted runtime entry point and restores internal flags. It has **not been applied or SQL-runtime validated**.
- [Calendar repository](../../../src/server/db/coaches/calendar-repository.ts), [authorized service](../../../src/server/coaches/calendar-service.ts) and [Server Action](../../../src/app/coach/calendar-actions.ts) validate inputs and current account/scope/coach access on every page; missing/unverified reads report Unavailable, never a successful empty calendar.
- [Calendar component](../../../src/features/coaches/coach-calendar.tsx), [styles](../../../src/features/coaches/coach-calendar.css), [client permission boundary](../../../src/features/coaches/coach-calendar-workspace.tsx) and [secondary navigation](../../../src/features/coaches/coach-schedule-navigation.tsx) own views, agenda, dialogs, filters, recovery and actor changes. Identity/access changes clear unauthorized data; a newly suspended actor must reload an earlier editable snapshot before history-only reading.
- [Coach route](../../../src/app/coach/page.tsx) selects Calendar/Availability, loads the appropriate projection, preserves canonical sign-in destinations and permits suspended/hidden history without publishing controls. [Workspace frame](../../../src/features/coaches/coach-availability-panel.tsx) explicitly permits the calendar's read-only hidden-coach context while preserving the Availability publication gate.
- [Existing request queue](../../../src/features/coaches/coach-booking-request-queue.tsx) retains an original occurrence selection in Bookings, highlights/focuses it when its pending/history page is loaded and keeps normal queue pagination. No request decision or identity authority changed. Bookings still owns those operations.
- [Calendar tests](../../../tests/coach-calendar.test.ts) and [action tests](../../../tests/server/coach-calendar-actions.test.ts) cover projection/navigation/privacy boundaries. [Prepared pgTAP checks](../../../supabase/tests/database/coach-calendar.test.sql) cover entry-point privileges and unauthenticated/forged context rejection after migration. [Browser rehearsal](../../../scripts/rehearse-coach-calendar-ui.mjs) uses [explicit fixture data](../../../tests/fixtures/coach-calendar-data.ts) and [a test harness](../../../tests/fixtures/coach-calendar-harness.tsx) in an environment-free temporary checkout; its replacement coach route never exists in production source. The Availability fixture accepts the real secondary navigation for dirty-transition integration tests.

### Decisions and deviations

2026-10-16: Created from confirmed scope and section 18 defaults. Implementation decisions adopted before code:

- `/coach` opens Schedule → Calendar in Week. Canonical calendar links use `view=schedule&section=calendar&date=YYYY-MM-DD&calendarView=day|week|month&type=all|private|group`, optional owned `venue=UUID` and `history=1`. Availability retains DEV0253’s `section=availability` selected-date URL. Calendar navigation uses links so editor dirty-draft protection also covers these transitions.
- Use a narrow owner/dataset-checked JSON read function because group tables deliberately have no runtime SELECT grant. Prepare an additive migration without applying it. It may delegate dated-inventory maintenance to DEV0252’s existing synchronization authority; it introduces no availability policy write or booking/group action. Validate at most 42 local dates and return 50 items plus a keyset cursor, exact filtered per-date counts and at most three previews per date from the same query.
- Return only source/original ID, actual timestamps/venue snapshot, kind/state/title and bounded pending counts. Never select athlete names/IDs/photos, notes, messages or roster data. Keep cursor timestamps at PostgreSQL precision and bind cursors to period/filter context. Booked private records and availability records have distinct sources, so a cancelled booking cannot become a free event and multiple history records retain their IDs.
- Calendar labels and groups use Berlin local dates, Monday-first weeks and 42-cell month grids. Desktop Day/Week show timed blocks alongside a complete paged agenda; phone widths use that agenda with all view/navigation/filter controls. Month previews use the server’s exact per-day totals independently of agenda pagination.
- Approved/demo coaches get current capacity and existing history; hidden/suspended owners retain bounded historical/commitment reads without publication actions. Pending/rejected/unapproved callers get no calendar authority. Client identity/access checks hide unverifiable data and clear revoked actor data; every next page repeats server authorization.
- Private bookings link to the existing original Bookings anchor. Private occurrence links retain their original ID in Bookings and expose normal queue pagination if the target is older. Group selection shows its real published details and explicitly identifies owner-management availability as a DEV0239 dependency; do not present a missing owner route as a working action.
- Reuse the existing workspace frame and venue projections. Add a fixture-only temporary route for desktop/375/430 px, crowded month, paging, back/reload, keyboard, unavailable and revoked-access checks. These checks do not prove live SQL or replace missing owner-group navigation.

### Contracts, configuration, and operations

The calendar query is `{from, through, type, venueId, history, after}`. A cursor retains the exact PostgreSQL timestamp, source, UUID and period/filter key. Results include a maximum 50 items, optional next cursor, exact total, at most three previews per local date, database time and a content version. Different sources retain different IDs even at the same instant. Availability writes and private/group lifecycle functions are unchanged. No dependency or application environment variable was added.

`20261016000300_owner_coach_calendar.sql` requires DEV0252's effective-availability migration and existing M7 authority. It is prepared only. Apply and validate in the agreed database environment only when migrations are allowed, then run its pgTAP checks and real coach/other-account/dataset/hidden/suspended, crowded-page and original-detail rehearsals. Before application, the actual Schedule Calendar read correctly reports Unavailable. Removing this interface/read-function change requires no deletion of availability, booking or group data; no rollback migration is executed here.

## Validation results

Non-database validation is recorded below. Fixtures exercise the actual components and typed projection handling; they do not prove SQL execution, persisted inventory, live RLS/authorization or owner-group management.

| Criterion | Evidence                                                                                                                                                                                       | Result             |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| AC1       | Week/Day/Month and mixed-state fixture/browser/model checks pass; real actor-scoped SQL feed remains unvalidated.                                                                              | Partially verified |
| AC2       | 42-date bounds, stable cursors, exact summaries/More, complete pagination, filters, back/reload and beyond-horizon fixtures pass. Live SQL counts/cursors and isolation remain pending.        | Partially verified |
| AC3       | Original private booking/occurrence links and selected-date editor navigation implemented; independently owned group management destination remains unavailable.                               | Partially verified |
| AC4       | Desktop/375/430 px, keyboard, unavailable/stale/access, dirty editor and regression/static checks pass as recorded below; live SQL/permission and owner-group navigation proof remain pending. | Partially verified |

- `npm test` — **184 application and 19 server tests passed**. Includes 8 calendar model/projection cases plus one new server-action case. Coverage checks leap/DST/Monday-first periods, 42-date maximum, malformed/extra input, period/filter-bound cursors with microseconds, complete multi-page traversal, previews on later dates independently of agenda paging, private-field stripping, invalid lifecycle combinations, unchanged private confirmation, real groups beyond the private horizon, overnight half-open dates/lanes and account/run/suspension classification. Other simultaneous hosted/Events tests are included in this workspace-wide run; their implementation remains separately owned.
- `node scripts/rehearse-coach-calendar-ui.mjs` — **6 final browser checkpoints passed**, no page runtime errors: Week default/mixed states/type filters/Back; 42-cell Month/exact three previews and More/full pagination/Day/reload; inactive snapshot/history/past-private/beyond-horizon group presentation; unavailable and changed-page/revoked-access recovery; actual Calendar/Availability keep/discard behavior; desktop and 375/430 px agenda/month/detail layouts, long venues and keyboard dialog focus/Escape. The final run includes corrected overnight time labels. An early run used an incorrect comma in its locale-dependent date selector; the selector was corrected without changing product dates.
- Manual visual review inspected desktop Week and 375/430 px Week/Month/detail screenshots in `test-results/dev0254-ui/`. The desktop grid has a complete agenda, mobile uses that agenda, venue/status text remains present, and horizontal overflow checks pass. These are Chrome desktop/phone-width checks, not physical-device or cross-browser proof.
- `npm run typecheck` — final normal route generation and TypeScript check passed. An earlier run included an independently created stale source snapshot under `test-results/`; an explicit source-only temporary tsconfig passed, then the normal command passed once that external snapshot was no longer included. No repository TypeScript configuration or another task's snapshot was changed.
- Focused `npx eslint` across changed calendar/route/service/model/fixture/script files — passed. `npm run lint` passed. `npm run format:check` passed for application/script/test sources.
- Prepared, **not run**: eight pgTAP boundary assertions. No migration/reset/seed, database driver/pgTAP run, live calendar/Auth check or actual owner-group workflow was executed under this phase.

- `npm run build -- --webpack` — passed in the environment-free temporary checkout after restoring the actual production `/coach` page, removing copied fixture modules and the dev cache, and running real map-worker preparation. Production compilation, TypeScript, static generation and trace collection passed. The build does not execute or validate the prepared SQL migration, and no deployment occurred.
- Final Python link/status check — **43** record/source links resolve, DEV0254 has one current record and its In progress status agrees with the index/COR0023. `git diff --check` passed. `npx prettier --check docs/mvp-spec.md tickets/README.md tickets/current/frontend/DEV0254-add-private-and-group-coach-calendar.md tickets/current/organisatory/COR0023-coach-calendar-and-availability.md` passed after normalizing the concurrently changed index table.

## Risks, limitations, and follow-ups

Keep this ticket In progress. The new SQL function is not applied or runtime validated; required same/other-coach/dataset/actor isolation, real pending counts, group deadline reconciliation, exact paging under real data and existing-horizon inventory proof remain this ticket's own acceptance work. Extend driver/browser checks against the migrated target rather than treating fixtures as database evidence. Prepared pgTAP privilege checks do not replace those cases.

DEV0239 still owns actionable original owner group-management details; the current calendar can open published session details without inventing an owner action. That missing owner destination blocks AC3/final mixed-flow completion. Private occurrence selection preserves the original ID but uses existing queue pages; requests older than the first page require its normal Load more control. The owning queue's current authority governs identities and decisions.

Handoff: DEV0253 was committed as `1db71b8`; DEV0254 code and the unapplied read migration now exist. When migrations are allowed, validate SQL/privileges and real owner/other-account/history/pagination/detail flows. DEV0253's separate live persistence proof remains pending; DEV0255 owns public date navigation and DEV0256 the combined rehearsal. No migration application, hosted release or independent review is claimed.

## Completion and review references

- Completed: Not completed — required database/Auth and owner-group detail evidence pending.
- Commit: User-authorized `[DEV0254] Add mixed coach calendar checkpoint`; see Git history for the hash. This checkpoint retains the In progress status and the unapplied migration/live-validation limitations above. Earlier DEV0253 checkpoint is `1db71b8`.
- Review: Implementation self-review and recorded non-database validation; no independent review.
- Deployment or release: None.
