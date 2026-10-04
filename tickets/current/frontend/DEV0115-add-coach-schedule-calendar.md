# Ticket DEV0115: Add the coach schedule calendar

- Status: Draft
- Created: 2026-10-04
- Last updated: 2026-10-04
- Milestone: Coach-first M2 recurring availability
- Coordination: [COR0009 — Coach-first private-class booking MVP](../organisatory/COR0009-coach-first-training-package-mvp.md)
- Related records: depends on recurring rules and dated occurrences from [DEV0114 — Persist recurring coach availability](../backend/DEV0114-persist-recurring-coach-availability.md), replaces the form/list presentation delivered by [DEV0104 — Publish weekly coach availability](../../archive/backend/DEV0104-publish-weekly-coach-availability.md), and supplies client slot selection context to [DEV0105 — Book private classes with pass credits](../backend/DEV0105-book-private-classes-with-pass-credits.md)

## Objective and context

Give a coach an accessible editable weekly calendar for defining repeating availability and give signed-in MovX clients a clear dated schedule on each coach profile. The current `/coach` workspace publishes one explicit date/time at a time and displays editable cards; public profiles show a simple seven-day list. This ticket consumes DEV0114's authoritative recurrence and occurrence contracts without reimplementing scheduling rules in the browser.

## Scope and non-goals

- In scope: protected coach calendar navigation; responsive weekly schedule editor; add/edit/pause/remove repeating entries; withdraw one dated open occurrence when supported by DEV0114; timezone, duration, location-snapshot and recurrence explanations; loading/empty/error/conflict states; public-profile dated availability for guests and signed-in clients; clear sign-in/booking boundary; keyboard and screen-reader-oriented interaction; desktop/mobile browser tests.
- Out of scope: recurrence persistence or occurrence generation owned by DEV0114; holding or booking a time owned by DEV0105; offer purchase owned by DEV0097/DEV0098; held/booked cancellation; drag-and-drop as the only editing path; external calendar sync; month-scale scheduling; group classes, buffers, travel time, reminders, waitlists or client identity exposure.

## Expected behavior and edge cases

An activated coach opens the protected workspace and sees the weekly pattern in the profile timezone. The coach can create and edit repeating entries without manually entering every future date. Multiple entries on one day remain understandable; overlap and stale-write failures return bounded inline feedback. Pausing or removing a rule explains which future open occurrences change and never implies that held/booked classes moved. A coach may withdraw one open dated occurrence without deleting the repeating pattern when DEV0114 permits it.

Each visible coach profile presents actual dated open occurrences for the coming seven days, not abstract weekday promises or fabricated fixtures. Signed-in clients can inspect them; guests retain the current read-only discovery view unless a later confirmed privacy decision changes it. Booking controls remain absent or clearly unavailable until DEV0105 supplies authoritative hold/pass behavior. Empty, database-unavailable and signed-out states remain honest.

The calendar must remain usable without pointer drag-and-drop. Desktop may use a seven-day grid, while narrow screens use ordered day sections or another equivalent responsive presentation without horizontal overflow. Focus order, labels and error association must expose the same operations.

## Assumptions, decisions, and dependencies

- Confirmed by the user on 2026-10-04: coaches manage repeating weekly availability in their panel, and signed-in clients can see the schedule.
- Existing guest access remains a compatibility requirement because the current MVP uses public availability for cold-start discovery; sign-in is required only for later hold/booking actions.
- The calendar displays DEV0114's server-derived rule and occurrence state. Browser time or timezone calculations cannot become scheduling authority.
- Proposed presentation default: retain `/coach` as the Availability entry point and enhance it rather than creating an empty dashboard. Keep reciprocal `/profile/coach` navigation; DEV0097 and DEV0105 add Offers and Bookings only when their behavior exists.
- Proposed interaction default: each rule editor uses weekday, local start and duration fields even if the desktop presentation is calendar-shaped. Drag-and-drop may be progressive enhancement but cannot be required.

## Implementation plan

1. Review DEV0114's finalized rule/mutation/occurrence contracts and adopt the calendar information architecture, responsive fallback and conflict/error copy before editing the interface.
2. Replace the explicit one-off create form/card list with an accessible weekly editor for repeating rules and one-occurrence exceptions, retaining profile/activation/visibility gates.
3. Present dated seven-day occurrences on public coach profiles for guests and signed-in clients, with a truthful sign-in/booking boundary and no fabricated availability.
4. Validate keyboard interaction, error states, timezone/location explanations, desktop/mobile layout, owner authorization boundaries and compatibility with existing discovery/profile behavior.

## Acceptance criteria

- [ ] AC1: An authorized coach can view and manage repeating weekly entries through an accessible calendar/editor without recreating every dated slot.
- [ ] AC2: The interface supports multiple entries per day, bounded conflict feedback, rule pause/removal and one-occurrence withdrawal while clearly protecting held/booked history.
- [ ] AC3: A signed-in client sees the coach's real dated open occurrences for the coming seven days on the coach profile; guest read-only discovery remains usable and no fixture schedule substitutes for database failure.
- [ ] AC4: Timezone, duration, location snapshot and recurring-versus-single-occurrence effects are explained without implying live location or guaranteed availability beyond authoritative occurrences.
- [ ] AC5: The complete editor remains keyboard-operable without drag-and-drop, and desktop/mobile views have no horizontal overflow or inaccessible calendar-only information.
- [ ] AC6: Focused component/browser tests, lint, typecheck, formatting and Next.js/Cloudflare production builds pass against DEV0114's finalized contracts.

## Validation plan

Use deterministic component/domain fixtures only for visual logic; authoritative browser scenarios must use database-backed DEV0114 rules and occurrences. Test coach add/edit/pause/remove, one-occurrence withdrawal, overlap/stale conflict, signed-out and unauthorized access, signed-in client/public profile visibility, honest empty/unavailable states, timezone labels and protected held/booked copy. Run desktop/mobile Playwright checks with keyboard traversal and overflow assertions plus relevant unit, lint, typecheck, formatting and production builds. Booking and Solana transactions are not applicable to this ticket.

## Implementation record

Pending implementation. The record was created after the user confirmed the repeating calendar outcome; no interface edit has started.

### Changes and rationale

Pending implementation.

### Affected files

Planned: coach workspace navigation and calendar components/styles; public coach-profile schedule presentation; adapters for DEV0114 actions/projections; browser/component tests; and relevant navigation/specification records. No schema is owned here.

### Decisions and deviations

- 2026-10-04: The panel should present an editable repeating weekly calendar rather than requiring one-off date/time submission as the primary workflow.
- The exact desktop visual layout remains a design choice, but every operation must have a labelled non-drag keyboard path and an equivalent narrow-screen presentation.

### Contracts, configuration, and operations

DEV0114 owns persistence and server contracts. This ticket should add no secret, provider token, scheduled job or independent availability cache. Route changes are limited to the coach workspace/profile presentation unless review adopts a separate shareable schedule route before implementation.

## Validation results

Not run — planning only.

## Risks, limitations, and follow-ups

Calendar grids can be inaccessible or unusable on mobile if time and controls are conveyed only spatially. Reuse semantic day/time lists beneath any visual grid. Do not expose booking actions before DEV0105 can atomically hold or confirm a dated occurrence. Month views, client rescheduling and external calendar synchronization require separate later decisions.

## Completion and review references

- Completed: Not completed.
- Commit: This commit — `[DEV0114][DEV0115] Plan recurring coach schedules`.
- Review: Planning self-review only; no independent review.
- Deployment or release: None.
