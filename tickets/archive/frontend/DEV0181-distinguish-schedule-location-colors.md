# Ticket DEV0181: Distinguish schedule location colors

- Status: Completed
- Created: 2026-10-10
- Last updated: 2026-10-10
- Milestone: Scheduling-only multi-location follow-up
- Coordination: [COR0014 — Multi-location coach scheduling](../../current/organisatory/COR0014-multi-location-coach-scheduling.md)
- Related records: follows completed [DEV0179 — Edit a location-aware working week](DEV0179-edit-location-aware-working-week.md)

## Objective and context

Make the Coach Workspace location legend and assigned schedule cells visibly distinguish different active training locations. DEV0179 introduced six palette entries, but it hashes each location independently, so two active location identifiers can select the same color even when unused colors remain. The user explicitly requested multiple legend colors.

## Scope and non-goals

- In scope: deterministic collision-free palette assignment across the currently ordered active locations; matching legend and calendar-cell colors; a stronger visible swatch; focused regression and authenticated responsive checks.
- Out of scope: changing location order, schedule interactions or persistence; making color the sole location cue; unlimited unique colors; profile/map styling; schema, API or environment changes.

## Expected behavior and edge cases

- Different active locations receive different palette entries while unused entries remain, even when their identifiers have the same preferred hash.
- The legend and every assigned calendar cell use the same color for the same location.
- Assignment remains deterministic for the same ordered active-location list. After the six-color palette is exhausted, colors may repeat; visible and accessible location names remain authoritative.
- Desktop and mobile retain readable text, keyboard behavior and layout.

## Assumptions, decisions, and dependencies

- DEV0179 already supplies ordered active locations, visible names, accessible labels and six contrast-aware palette entries.
- Adopt collision resolution over ordered active locations rather than adding random colors. This preserves deterministic rendering, guarantees distinct colors for the common one-to-six-location case and avoids persisted presentation state.
- The primary-first, coach-defined location order is the stable assignment input. Adding, removing or reordering locations may change collision-resolved colors, which is acceptable because names—not colors—define identity.

## Implementation plan

1. Extract a pure deterministic palette-index allocator that resolves collisions until all palette entries are in use.
2. Build one active-location palette map in the working-week editor and reuse it for legend items and schedule cells.
3. Strengthen the legend swatch so its assigned hue is immediately visible without removing text or accessible names.
4. Add focused collision coverage and extend the authenticated two-location rehearsal to assert distinct computed legend and cell colors at desktop and mobile widths.
5. Run unit, rehearsal, lint, type, format and production-build checks; review the responsive evidence; complete and archive this record only after all criteria pass.

## Acceptance criteria

- [x] AC1: Two active locations with colliding preferred hashes receive different colors while unused palette entries remain.
- [x] AC2: Each location uses one consistent color in both its legend entry and its assigned schedule cells, with visible/accessibility text retained.
- [x] AC3: Multiple colors remain visibly distinct and readable at desktop and mobile widths without changing scheduling behavior or persistence.
- [x] AC4: Focused tests, authenticated rehearsal, lint, type, format and production build pass.

## Validation plan

Add a pure allocator test using two identifiers whose preferred hashes collide, component assertions that palette styles are applied consistently, and browser assertions that two location legend entries and their assigned cells have different computed colors. Run `npm test`, `npm run test:coach-availability`, `npm run lint`, `npm run typecheck`, `npm run format:check`, `git diff --check` and a configured `npm run build`. Review the rehearsal's desktop and mobile screenshots. Database tests are not required because this ticket changes presentation-only palette allocation and no persisted or server contract.

## Implementation record

Completed on 2026-10-10. Active locations now receive palette entries as one ordered set. The allocator keeps each location's preferred deterministic color when available and advances to the next unused palette entry on collision, guaranteeing different colors for the first six unique active locations. The legend and assigned calendar cells consume the same mapping.

### Changes and rationale

- Added a framework-independent palette-index allocator with validation, duplicate-ID handling and deterministic collision resolution. The finite palette still repeats only after every available color has been assigned.
- Replaced independent per-location hashing in the working-week editor with one primary-first active-location palette map. Existing rule locations are appended as fallbacks, so a temporarily unavailable assignment still receives a bounded style without taking a color from an active location.
- Applied the shared palette index to both legend rows and selected calendar cells and exposed bounded data attributes for focused consistency checks. Location names and complete accessible actions remain authoritative.
- Filled each legend swatch with its assigned hue and retained a light inset ring, making the color difference more immediate while preserving the tinted card, border and readable text.
- Extended unit, component and authenticated browser coverage. The rehearsal now proves that two legend entries differ, each assigned cell matches its legend entry and both colors remain visible in a selected mobile day.

### Affected files

| File or component                                     | Change and purpose                                                                                                               |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/coaches/coach-location-palette.ts`      | Assigns deterministic palette indexes and resolves collisions while unused entries remain.                                       |
| `src/features/coaches/coach-availability-panel.tsx`   | Builds one ordered location palette and reuses each index for the matching legend row and schedule cells.                        |
| `src/app/coach-workspace.css`                         | Gives legend swatches their assigned hue with a light inset ring.                                                                |
| `tests/coach-location-palette.test.ts`                | Proves collision resolution, deterministic output, bounded reuse, duplicate handling and invalid-size rejection.                 |
| `tests/coach-schedule.test.ts`                        | Verifies two rendered locations have different legend indexes and that their schedule cells use the same respective indexes.     |
| `scripts/rehearse-local-coach-availability.mjs`       | Checks distinct computed colors and legend/cell consistency at desktop and mobile widths and captures dedicated mobile evidence. |
| `tickets/README.md` and `COR0014` coordination record | Record the focused follow-up's lifecycle, direct coordination membership, outcome and validation evidence.                       |

### Decisions and deviations

- 2026-10-10: Started as a focused DEV0179 presentation follow-up after confirming independent ID hashing can collide despite unused palette entries.
- 2026-10-10: Kept the existing six contrast-aware colors and resolved collisions over primary-first active-location order. This is more predictable and testable than random or persisted presentation state, while names protect profiles with more than six locations.
- 2026-10-10: The first browser rehearsal attempt used an ambiguous `getByLabel("Day")` locator and failed before the mobile color assertion. The test was narrowed to `.coach-week-mobile-picker select`; the complete rehearsal then passed without changing application behavior.

### Contracts, configuration, and operations

No data shape, server interface, persistence, dependency, environment variable, migration or deployment contract changed. The palette map is presentation-only and recalculated from the existing ordered location projection.

## Validation results

All required validation passed on 2026-10-10 under Node.js `24.21.0`, npm `11.19.0`, Next.js `16.3.8`, the configured local Supabase/Auth/Mailpit stack and Chrome.

- `npm test` passed 96 unit/component tests and 7 server tests. Three new allocator tests cover colliding identifiers, deterministic distinct assignment, duplicate identities, six-color exhaustion and invalid palette size; the component test confirms distinct legend indexes and matching cell indexes.
- `npm run test:coach-availability` passed after the locator correction. It asserted different computed background variables for two locations, exact legend-to-cell color consistency, a colored swatch, visible two-color desktop/mobile layouts and all existing save, conflict, keyboard and cleanup behavior.
- `npm run lint`, `npm run typecheck`, `npm run format:check` and `git diff --check` passed.
- A production `npm run build` passed with the canonical configured local database/Auth environment and `NEXT_PUBLIC_SITE_URL=http://localhost:3101`.
- Visual review of `coach-availability-desktop.png` and `coach-availability-multiple-colors-mobile.png` confirmed clearly distinct blue and yellow legend/cell treatments, readable names and no responsive overflow.
- Database suites were not run because no database, server or persistence contract changed. The full public Playwright suite was not rerun because the authenticated two-location rehearsal directly covers the changed workspace on desktop and mobile.

| Criterion | Evidence                                                                                                                 | Result |
| --------- | ------------------------------------------------------------------------------------------------------------------------ | ------ |
| AC1       | Pure tests use colliding IDs and prove distinct deterministic indexes while colors remain unused.                        | Passed |
| AC2       | Component and browser assertions match each cell's palette to its legend and preserve full names/actions.                | Passed |
| AC3       | Computed-color assertions and reviewed desktop/mobile screenshots show distinct blue/yellow treatments without overflow. | Passed |
| AC4       | 103 unit/server tests, authenticated rehearsal, lint, type, format, diff and configured production build all passed.     | Passed |

## Risks, limitations, and follow-ups

The finite six-color palette repeats for a seventh active location. Text and accessible names remain authoritative, and expanding or algorithmically generating the palette is deferred unless real profiles exceed that presentation boundary. Collision resolution follows current primary-first location order, so a later location reorder can change colors; no persisted identity semantics depend on them.

## Completion and review references

- Completed: 2026-10-10 — distinct deterministic location colors and responsive evidence passed all four acceptance criteria.
- Commit: This commit — `[DEV0181] Distinguish schedule location colors`.
- Review: Self-review and desktop/mobile visual review completed; no independent review or pull request created.
- Deployment or release: Not deployed or released.
