# Ticket DEV0115: Add the coach schedule calendar

- Status: Completed
- Created: 2026-10-04
- Last updated: 2026-10-04
- Milestone: Coach-first M2 recurring availability
- Coordination: [COR0009 — Coach-first private-class booking MVP](../organisatory/COR0009-coach-first-training-package-mvp.md)
- Related records: depends on recurring rules and dated occurrences from [DEV0114 — Persist recurring coach availability](../backend/DEV0114-persist-recurring-coach-availability.md), replaces the form/list presentation delivered by [DEV0104 — Publish weekly coach availability](../backend/DEV0104-publish-weekly-coach-availability.md), and historically supplied client slot selection context to cancelled [DEV0105 — Book private classes with pass credits](../backend/DEV0105-book-private-classes-with-pass-credits.md)

## Objective and context

Give a coach an accessible normal weekly calendar for selecting exact repeating one-hour availability and give signed-in MovX clients a clear dated schedule on each coach profile. The current `/coach` workspace publishes one explicit date/time at a time and displays editable cards; public profiles show a simple seven-day list. This ticket consumes DEV0114's authoritative recurrence and occurrence contracts without reimplementing scheduling rules in the browser.

## Scope and non-goals

- In scope: protected coach calendar navigation; responsive weekly grid/editor for adding and removing exact one-hour recurring cells; timezone and location-snapshot explanations; loading/empty/error/conflict states; public-profile dated availability calendar for guests and signed-in clients; clear sign-in/booking boundary; keyboard and screen-reader-oriented interaction; desktop/mobile browser tests.
- Out of scope: recurrence persistence or occurrence generation owned by DEV0114; variable durations, broad windows, pause/resume and one-date exceptions; holding or booking a time owned by DEV0105; offer purchase owned by DEV0097/DEV0098; held/booked cancellation; drag-and-drop as the only editing path; external calendar sync; month-scale scheduling; group classes, buffers, travel time, reminders, waitlists or client identity exposure.

## Expected behavior and edge cases

An activated coach opens the protected workspace and sees one reusable working-week grid in the schedule timezone. Weekday columns and whole-hour rows represent the coach's normal week; choosing a cell toggles that repeating one-hour slot without entering a future date. Selecting adjacent cells creates adjacent one-hour rules rather than one variable-length window. Multiple entries on one day remain understandable, and overlap/stale-write failures return bounded inline feedback. Removing a rule explains that future open occurrences change and never implies that held/booked classes moved.

Each visible coach profile presents actual dated open occurrences for the coming seven days, not abstract weekday promises or fabricated fixtures. Signed-in clients can inspect them; guests retain the current read-only discovery view unless a later confirmed privacy decision changes it. Booking controls remain absent or clearly unavailable until DEV0105 supplies authoritative hold/pass behavior. Empty, database-unavailable and signed-out states remain honest.

The calendar must remain usable without pointer drag-and-drop. Desktop may use a seven-day grid, while narrow screens use ordered day sections or another equivalent responsive presentation without horizontal overflow. Focus order, labels and error association must expose the same operations.

## Assumptions, decisions, and dependencies

- Confirmed by the user on 2026-10-04: coaches manage a normal repeating weekly calendar of one-hour slots in their panel, signed-in clients can see the schedule, and advanced edge cases can wait for later versions.
- Existing guest access remains a compatibility requirement because the current MVP uses public availability for cold-start discovery; sign-in is required only for later hold/booking actions.
- The calendar displays DEV0114's server-derived rule and occurrence state. Browser time or timezone calculations cannot become scheduling authority.
- Proposed presentation default: retain `/coach` as the Availability entry point and enhance it rather than creating an empty dashboard. Keep reciprocal `/profile/coach` navigation; DEV0097 and DEV0105 add Offers and Bookings only when their behavior exists.
- The calendar creates/removes exact one-hour weekday/start-time rules. Drag-and-drop may be progressive enhancement but cannot be required; every cell has a labelled keyboard-operable control.

## Implementation plan

1. Review DEV0114's finalized rule/mutation/occurrence contracts and adopt the calendar information architecture, responsive fallback and conflict/error copy before editing the interface.
2. Replace the explicit one-off create form/card list with an accessible weekly grid/editor for exact one-hour repeating slots, retaining profile/activation/visibility gates.
3. Present dated seven-day occurrences on public coach profiles for guests and signed-in clients, with a truthful sign-in/booking boundary and no fabricated availability.
4. Validate keyboard interaction, error states, timezone/location explanations, desktop/mobile layout, owner authorization boundaries and compatibility with existing discovery/profile behavior.

## Acceptance criteria

- [x] AC1: An authorized coach can view, add and remove exact repeating one-hour entries through an accessible calendar/editor without recreating every dated slot.
- [x] AC2: The interface supports multiple and adjacent entries per day plus bounded conflict feedback while clearly protecting held/booked history.
- [x] AC3: A signed-in client sees the coach's real dated open occurrences for the coming seven days on the coach profile; guest read-only discovery remains usable and no fixture schedule substitutes for database failure.
- [x] AC4: Timezone, fixed one-hour duration, location snapshot and recurrence effects are explained without implying live location or guaranteed availability beyond authoritative occurrences.
- [x] AC5: The complete editor remains keyboard-operable without drag-and-drop, and desktop/mobile views have no horizontal overflow or inaccessible calendar-only information.
- [x] AC6: Focused component/browser tests, lint, typecheck, formatting and Next.js/Cloudflare production builds pass against DEV0114's finalized contracts.

## Validation plan

Use deterministic component/domain fixtures only for visual logic; authoritative browser scenarios must use database-backed DEV0114 rules and occurrences. Test coach add/remove of individual and adjacent one-hour cells, overlap/stale conflict, signed-out and unauthorized access, signed-in client/public profile visibility, honest empty/unavailable states, timezone labels and protected held/booked copy. Run desktop/mobile Playwright checks with keyboard traversal and overflow assertions plus relevant unit, lint, typecheck, formatting and production builds. Booking and Solana transactions are not applicable to this ticket.

## Implementation record

Implementation started and completed locally on 2026-10-04 after DEV0114 supplied recurring-rule mutations and the user clarified that the editor represents one reusable working week.

### Changes and rationale

The `/coach` workspace now presents one week-shaped schedule instead of a date/time form for repeatedly publishing individual future slots. Desktop uses seven weekday columns and whole-hour rows from `00:00` through `22:00`; each labelled button toggles one exact recurring hour. The same controls become one selected-day list behind a native day picker below 760 pixels, avoiding document-level horizontal scrolling and preserving all operations for touch, keyboard and screen-reader use. Two adjacent selected cells remain two independent one-hour rules.

One form and one server action serve the complete grid. Each submitted cell contains a bounded create/remove intent, ISO weekday, whole-hour time and, for removal, the durable rule identifier. The action reuses DEV0114's validation and owner-authorized services, maps stale/overlap failures to bounded feedback, revalidates the workspace and public profile, and explains that removing a rule changes only future open occurrences. A first render duplicated all desktop/mobile controls; review identified the unnecessary markup, so the implementation was consolidated into one 161-button control set with responsive layout rather than parallel forms.

The old editable one-off cards were removed from the primary workflow. A separate read-only “Dated class times” section shows authoritative occurrences for the next seven days, their status, timezone and snapshotted location, and distinguishes working-week occurrences from retained earlier one-offs. Public coach profiles group actual open occurrences into dated day sections with one-hour ranges, timezone/location context and truthful copy that viewing is public while pass-backed booking remains pending DEV0105.

### Affected files

| File                                                                         | Role                                                                                                                                       |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/features/coaches/coach-availability-panel.tsx`                          | Implements the responsive working-week editor, accessible cell labels, profile/visibility gates and read-only dated occurrence list.       |
| `src/app/coach/actions.ts`                                                   | Validates and dispatches recurring cell create/remove actions and returns bounded saved/conflict/unavailable feedback.                     |
| `src/app/coach/page.tsx`                                                     | Supplies server-derived active rules and the server action to the client editor.                                                           |
| `src/app/coach-workspace.css`                                                | Defines the seven-column desktop calendar, sticky time/day labels, mobile day picker/list, focus states and responsive occurrence cards.   |
| `src/features/coaches/coach-discovery.tsx` and `src/app/coach-discovery.css` | Group public open occurrences by dated day and present their exact one-hour ranges without adding booking controls.                        |
| `tests/coach-schedule.test.ts`                                               | Verifies the complete 7×23 control set, adjacent active rules, accessible add/remove labels, single-form boundary and hidden-profile gate. |
| `scripts/rehearse-local-coach-availability.mjs`                              | Rehearses authenticated adjacent rule toggles, public dated projection, removal, keyboard focus, responsive layout and screenshots.        |

### Decisions and deviations

- 2026-10-04: The panel presents an editable repeating weekly calendar of exact one-hour cells rather than one-off date/time submission or variable-duration windows.
- 2026-10-04: The user clarified that this is the coach's reusable working week: the coach chooses cells once across one week-shaped schedule instead of repeatedly adding slots day by day.
- All DEV0114-supported start hours (`00:00`–`22:00`) remain selectable. The desktop calendar scrolls vertically inside its panel; narrow screens choose one weekday at a time and list its hours without horizontal overflow.
- The initial separate desktop/mobile control trees were replaced during self-review with one responsive control tree. This reduces markup and prevents two simultaneously rendered mutation forms from representing the same rule.
- The dated owner and public sections remain read-only because DEV0105, not this ticket, owns holds, bookings and booking lifecycle controls.

### Contracts, configuration, and operations

No database schema, migration, dependency, environment variable, provider credential, cache, scheduled job or route was added. The UI consumes DEV0114's existing `OwnedCoachAvailabilityRule`, owned occurrence and public occurrence shapes. The new server action accepts only a pipe-delimited bounded cell payload produced by a named submit button; create input still passes through `validateCoachAvailabilityRuleInput`, remove input requires a UUID rule identifier, and all authority remains derived server-side from the verified actor.

The public availability contract remains guest-readable for discovery compatibility. Signing in is required by the future booking flow, not for inspecting open times. Resetting the local database removes rehearsal state; final local cleanup reapplied all migrations, restored the restricted runtime login and reprovisioned the five approved fictional coach accounts.

## Validation results

- Environment: 2026-10-04, Node.js 24.21.0, Next.js 16.3.8, vinext 1.0.0-beta.9, local loopback Supabase and Chrome.
- `npx tsx --test tests/coach-schedule.test.ts` — passed 2/2 focused render tests. The visible editor has one form, exactly 161 labelled one-hour controls, adjacent selected rules and no legacy date/duration form; a hidden profile exposes no schedule controls.
- `npm test` — passed 71/71 unit and boundary tests.
- Focused database command using `tests/database/coach-availability.test.ts` — passed 8/8 owner, snapshot, concurrency, lifecycle, recurring-rule, daylight-saving and overlap tests against DEV0114.
- `npm run test:coach-availability` — passed an authenticated browser rehearsal: created a coach profile, selected adjacent 10:00 and 11:00 working-week cells, observed two concrete occurrences and the public dated schedule, verified keyboard focus and 393-pixel layout, then removed both rules and observed empty owner/public states. Desktop, mobile and public-profile screenshots were visually reviewed with no content overlap or document-level horizontal overflow.
- A later repeat rehearsal timed out before submitting email because the long-running development process no longer hydrated the sign-in button after production builds and earlier delete/re-add hot reloads. Restarting `next dev` restored hydration; the same final-code rehearsal passed, and a final read-only Chrome check confirmed the sign-in control enabled on the fresh server.
- `npm run test:e2e` from a clean deterministic database — passed 28/28 desktop/mobile browser cases. The first run passed 26 cases but its two directory-count assertions saw the temporary rehearsal coach (`6` instead of `5`); resetting the disposable database restored the suite precondition and all cases passed.
- `npm run typecheck` and `npm run lint` — passed. The first production-build attempt found an overly widened test-fixture discipline type; the fixture was narrowed to the domain literal before the successful checks.
- `npm run format:check` and `git diff --check` — passed.
- `npm run build` — passed the optimized Next.js production build and route generation.
- `npm run build:vinext` — passed the Cloudflare-targeted build. Existing large-client-chunk and static route-classification notices remained non-failing warnings.
- Final cleanup: `npm run db:reset`, `npm run db:runtime` and `npm run auth:provision:coaches` passed, leaving only the five deterministic local coach accounts and no rehearsal schedule.

| Criterion | Evidence                                                                                                                                            | Result |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Focused render test and authenticated add/remove rehearsal across one reusable week grid.                                                           | Passed |
| AC2       | Adjacent 10:00/11:00 rule rehearsal, DEV0114 conflict tests and bounded action feedback/protected-history copy.                                     | Passed |
| AC3       | Signed-in rehearsal account observed two real public dated occurrences; clean guest profile and unavailable behavior remained in the 28-case suite. | Passed |
| AC4       | Owner/public screenshots and source checks show timezone, one-hour, stable-place and recurrence explanations.                                       | Passed |
| AC5       | Keyboard focus assertion, labelled buttons, mobile day picker and desktop/mobile overflow assertions passed.                                        | Passed |
| AC6       | Focused/full tests, lint, typecheck, formatting and both production builds passed.                                                                  | Passed |

## Risks, limitations, and follow-ups

The editor intentionally exposes 23 possible start hours per weekday, so a coach with an unusual overnight schedule can use the same contract; on mobile this makes each selected day a long but linear list. Rule changes are saved per cell rather than as one batch, preserving simple conflict handling at the cost of one round trip per toggle. The next hosted rehearsal should observe action latency and request-driven synchronization under production-like conditions. Variable durations, broad windows, one-date exceptions, cross-midnight slots, month views, client rescheduling and external calendar synchronization remain deferred. DEV0105 must add atomic hold/booking controls against dated occurrences rather than turning the recurrence rule into bookable inventory.

## Completion and review references

- Completed: 2026-10-04 — delivered the responsive owner working-week editor and dated public/client schedule presentation.
- Commit: This commit — `[DEV0115] Add coach working-week schedule`; planning commit `223f3e7` — `[DEV0114][DEV0115] Plan recurring coach schedules`.
- Review: Implementation self-review and desktop/mobile/public visual review completed; no independent review.
- Deployment or release: Local implementation only. No hosted deployment was performed.
