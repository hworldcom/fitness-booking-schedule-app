# Ticket DEV0205: Redesign coach Schedule

- Status: Completed
- Created: 2026-10-12
- Last updated: 2026-10-12
- Milestone: Scheduling interface authenticated-workspace follow-up
- Coordination: [COR0018 — Authenticated workspace redesign](../organisatory/COR0018-authenticated-workspace-redesign.md)
- Related records: completed contract [DEV0202 — Adopt the authenticated workspace redesign contract](../../archive/organisatory/DEV0202-adopt-authenticated-workspace-redesign-contract.md), completed shell dependency [DEV0203 — Introduce the authenticated workspace shell](../../archive/frontend/DEV0203-introduce-authenticated-workspace-shell.md), schedule baseline [DEV0179 — Edit a location-aware working week](../../archive/frontend/DEV0179-edit-location-aware-working-week.md) and color baseline [DEV0181 — Distinguish schedule location colors](../../archive/frontend/DEV0181-distinguish-schedule-location-colors.md)

## Objective and context

Bring the coach Schedule view into the approved authenticated visual system while retaining the efficient local multi-slot draft and one explicit save. Improve hierarchy around publication state, location legend, working week and dated capacity without changing schedule semantics.

## Scope and non-goals

- In scope: shared coach heading/navigation frame, Profile/Schedule/Bookings tabs, truthful publication summary, schedule instructions/status, location selector/legend, working-week grid, save feedback, dated occurrence summary and the matching specification wording for this shared hierarchy.
- Out of scope: request queue/booking cards, profile/location editing, schedule persistence changes or new calendar behavior.

## Expected behavior and edge cases

- Schedule is the active middle tab in stable `Profile → Schedule → Bookings` navigation.
- Coaches choose location and multiple cells locally, then save once; selected cells retain text plus distinct color cues.
- Occupied, pending-request, closed, unavailable, stale-save and no-location states remain truthful and accessible.
- Suspended/pending/rejected access behavior remains unchanged.

## Assumptions, decisions, and dependencies

- DEV0203 supplies private shell framing.
- Existing schedule draft, palette and server actions remain authoritative.
- Preview dates/counts are illustrative and will not be introduced as fixtures.

## Implementation plan

1. Extract/refine the shared coach page heading/navigation boundary as needed and reconcile the specification's legacy green-hero wording with the already approved paper workspace hierarchy.
2. Recompose schedule controls, legend, grid and states with scoped responsive styles, placing the single save action in the schedule heading without changing submission behavior.
3. Extend static/browser coverage for selection/save, location identity, unavailable/conflict states and breakpoints.
4. Run relevant tests and static/build checks.

## Acceptance criteria

- [x] AC1: Schedule uses the authenticated hierarchy and stable coach navigation without moving Bookings/Profile content into the view.
- [x] AC2: Location-aware multi-selection and one-save semantics remain unchanged and accessible.
- [x] AC3: Occupied/request/closed/error and narrow-screen states retain text identity and usable controls.
- [x] AC4: Relevant tests, lint, type-check, formatting and build pass.

## Validation plan

- Extend schedule component tests and authenticated Playwright at mobile/desktop widths.
- Rehearse select/change/save plus failure/conflict recovery against local runtime data.
- Run application tests and static/build checks.

## Implementation record

Implementation started and completed on 2026-10-12 after DEV0204 completed. Signed-in review showed that Coach workspace inherited the redesigned shell but its internal dark hero, boxed tabs and Schedule panels still used the previous interface.

### Changes and rationale

- Replaced the legacy dark coach hero with the approved paper-background workspace heading, concise cross-view description and truthful published, hidden or not-set-up profile summary. The public-profile link remains available only for a visible coach.
- Kept the real stable `Profile → Schedule → Bookings` destinations and moved that sub-navigation directly below the shared heading. The preview's illustrative Request/Profile/Locations split was not adopted.
- Reworked Schedule as an unboxed workspace section with `Weekly schedule` hierarchy, a prominent selected-hour state, location assignment/legend cards, a cleaner grid and a separate dated-capacity section.
- Moved the only submit control into the schedule heading. Cell interaction still changes a local draft; no mutation occurs until the coach uses `Save schedule`, and the existing explicit keep/move/remove decision remains required before moving a cell across locations.
- Added responsive publication actions, three-column coach tabs, full-width save control, day selector and mobile one-day grid while retaining text labels and keyboard focus.
- Updated the browser rehearsal for the current public-marketplace wording and confirmed the established public lifecycle contract: removed future occurrences remain visible as `Closed by coach`, with no request action, rather than disappearing.
- Clarified the MVP specification's stale green-hero wording so the shared coach hierarchy matches the previously approved authenticated paper workspace and truthful publication summary.

### Affected files

| File or component                                                   | Change and purpose                                                                                                                                                             |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/features/coaches/coach-availability-panel.tsx`                 | Reorganizes the shared coach heading/tabs, publication summary, single-save schedule heading and preserved location-aware editor/dated-capacity content.                       |
| `src/app/coach-workspace.css`                                       | Applies the authenticated paper/forest/lime hierarchy to shared coach framing and Schedule, including desktop/mobile controls, grid, legend, status and occurrence-row styles. |
| `tests/coach-schedule.test.ts`                                      | Verifies the new heading/publication hierarchy, stable tab order, view isolation and unchanged one-form/one-save schedule contract.                                            |
| `scripts/rehearse-local-coach-availability.mjs`                     | Exercises the redesigned heading and current public schedule labels, waits for hydration, and asserts closed occurrences expose no request action.                             |
| `docs/mvp-spec.md`                                                  | Reconciles the shared coach heading/status requirement with the approved authenticated visual contract.                                                                        |
| `tickets/archive/frontend/DEV0205-redesign-coach-schedule.md`       | Records scope, decisions, implementation and validation for this slice.                                                                                                        |
| `tickets/current/organisatory/COR0018-*.md` and `tickets/README.md` | Advance the authenticated redesign workstream from Schedule to Bookings.                                                                                                       |

### Decisions and deviations

- The shared coach heading is intentionally neutral across Schedule and Bookings (`Run your coaching week.`), while each active tab owns its section-specific heading. This avoids the previous heading/tab coordinate shift and supports DEV0206 without changing routes.
- The selected-hour count and single Save control live together at the top of the editor; a separate status line continues to state whether edits are saved. There is no autosave or second submit action.
- The first browser run reached the public-profile portion but failed on wording left behind by the public redesign (`open hours` versus `scheduled hours`). A later legacy empty-state expectation also conflicted with DEV0187's confirmed contract that withdrawn occurrences stay publicly visible as bounded `Closed by coach` rows. The rehearsal was corrected to assert the current wording and absence of request controls; application behavior was not changed.

### Contracts, configuration, and operations

No schema, API, environment variable, dependency or migration changed. The presentation contract changed from a legacy green view-specific hero to the approved paper workspace heading plus truthful status summary. Routes, actor permissions, local-draft submission, recurrence synchronization and public occurrence state contracts are unchanged.

## Validation results

- `npm test` passed with 122 unit/component tests and 9 server tests under Node 24.21.0.
- `npm run lint`, `npm run typecheck`, `npm run format:check` and `git diff --check` passed.
- `npm run build` completed successfully with Next.js 16.3.8 and generated all application routes.
- `npm run test:coach-availability` passed against local Supabase Auth/PostgreSQL and the Node 24 development server. It verified two-location selection/colors, zero per-cell mutations, one mutation per explicit save, keep/move/remove focus behavior, inactive-location conflict recovery, public location projection, retained closed-state truth, keyboard navigation, no horizontal overflow and desktop/393px responsive presentation. The script also asserted no browser page errors.
- Manual screenshot review passed for `test-results/coach-availability-rehearsal/coach-availability-desktop.png`, `coach-availability-multiple-colors-mobile.png` and `coach-availability-mobile.png`.
- Database migration/RLS tests were not run because no schema, query or authorization contract changed.

| Criterion | Evidence                                                                                                                                                                                           | Result |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Static markup tests and screenshot review confirm the shared paper heading followed by exactly Profile/Schedule/Bookings, with Schedule selected and Bookings content absent.                      | Passed |
| AC2       | Component assertions retain 161 local cell buttons plus one submit; the live rehearsal observed zero POSTs while selecting and exactly one per Save, including explicit cross-location decisions.  | Passed |
| AC3       | Occupied Schedule tests hide private booking identity; live conflict/closed-state, keyboard, desktop and 393px checks passed, with location identity carried by both text and color.               | Passed |
| AC4       | 131 automated application tests, lint, type generation/TypeScript, formatting, diff check, production build and the local authenticated schedule rehearsal passed under the required Node release. | Passed |

## Risks, limitations, and follow-ups

- The repeating week intentionally exposes all 23 selectable one-hour starts. Mobile uses one chosen day at a time, but the page remains long; a future calendar interaction must be separately specified rather than silently changing schedule semantics.
- DEV0206 still owns booking/request presentation. Until that peer lands, selecting Bookings shows the new shared coach heading/tabs around its older inner sections.

## Completion and review references

- Completed: 2026-10-12.
- Commit: Included with the implementation commit whose subject references DEV0205.
- Review: No review created.
- Deployment or release: Not deployed or released.
