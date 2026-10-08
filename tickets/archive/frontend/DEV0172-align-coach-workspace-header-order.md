# Ticket DEV0172: Align coach workspace header order

- Status: Completed
- Created: 2026-10-08
- Last updated: 2026-10-08
- Milestone: Scheduling-only M3 interface follow-up
- Coordination: None — independent development ticket
- Related records: follows [DEV0171 — Unify coach Profile navigation](../../archive/frontend/DEV0171-unify-coach-profile-navigation.md)

## Objective and context

Place the shared Profile, Schedule and Bookings navigation at the same vertical coordinate in every coach view. Coach Profile currently renders the navigation before its green hero, while Schedule and Bookings render their green hero first. The resulting jump makes the shared controls appear inconsistent even though their labels and order now match. This is a narrow responsive-layout correction to the coach workspace behavior in [the MVP specification](../../../docs/mvp-spec.md#9-scheduling-behavior-and-permissions).

## Scope and non-goals

- In scope: render the shared coach navigation before the green hero in Schedule and Bookings so all three views use navigation → hero → content; update the specification, focused structural tests and responsive browser evidence.
- Out of scope: changing tab labels, URLs, selection behavior, content, coach authority, booking/availability logic, hero copy, global navigation or data access.

## Expected behavior and edge cases

- Profile, Schedule and Bookings all place the shared navigation first and the green view-specific hero immediately below it.
- Switching between the three views keeps the navigation at the same top content position at desktop and mobile widths.
- The active item, hero copy/action and view-specific content remain unchanged.
- Profile-required and hidden-profile Schedule gates retain the same ordering and authority behavior.

## Assumptions, decisions, and dependencies

- Match the existing coach Profile layout because it already presents the navigation before the page-specific hero and was the user-identified reference position.
- Reorder existing JSX without introducing offsets or route-specific CSS. The shared navigation's current margins provide the spacing between the row and hero.
- This remains one small presentation ticket and does not require coordination or a schema change.

## Implementation plan

1. Update the specification to record the stable navigation → hero → content structure.
2. Move the shared navigation above the Schedule/Bookings hero without changing either component's contents or conditions.
3. Add structural rendering assertions for Schedule and Bookings, then run focused/full application checks and responsive authenticated browser comparison.

## Acceptance criteria

- [x] AC1: Profile, Schedule and Bookings all render the shared navigation before their green hero.
- [x] AC2: Switching views keeps the navigation in the same top content position at desktop and mobile widths without overflow.
- [x] AC3: Active state, hero copy/action, view content and authorization behavior remain unchanged.
- [x] AC4: Focused tests, lint, type checking, formatting, production build and authenticated browser checks pass.

## Validation plan

Extend coach-workspace static rendering tests to assert the navigation occurs before the Schedule and Bookings hero headings; the existing Profile-first component order provides the Profile baseline. Rehearse Daniel Park across all three views at `1440x1040` and `393x852`, compare navigation bounding coordinates, verify the hero follows it, check active links and horizontal overflow, and capture screenshots. Run `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build` and `git diff --check`. Database tests are not applicable to a JSX-order-only change.

## Implementation record

Completed on 2026-10-08. Schedule and Bookings now use the same navigation → green hero → content order that Profile already used. The shared navigation therefore remains at the same top content coordinate while switching among all three coach views.

### Changes and rationale

- Moved the existing `CoachWorkspaceNavigation` call above the existing `coach-workspace-header` in the shared Schedule/Bookings panel. No element contents, conditions, properties or styles changed.
- Added focused structural assertions for both Schedule and Bookings so the navigation must precede the hero in rendered markup.
- Updated the product contract to state the stable navigation-first structure shared by the three coach views.

### Affected files

| File or component | Change and purpose |
| ----------------- | ------------------ |
| [MVP specification](../../../docs/mvp-spec.md) | Records the navigation → hero → content ordering for coach views. |
| [Coach availability panel](../../../src/features/coaches/coach-availability-panel.tsx) | Moves the shared navigation before the Schedule/Bookings hero. |
| [Coach schedule tests](../../../tests/coach-schedule.test.ts) | Prevents Schedule or Bookings from placing the hero before navigation again. |

### Decisions and deviations

- 2026-10-08: Standardize on navigation first, matching the existing Profile view requested as the visual reference.
- 2026-10-08: Use element order rather than compensating CSS coordinates. All three wrappers already share the same maximum width and page-content origin, so matching markup order produces stable responsive alignment without route-specific offsets.

### Contracts, configuration, and operations

No interface, route, data, dependency, environment or deployment contract changed. Only the Schedule/Bookings rendered element order changed; no migration, setup or rollback operation is required.

## Validation results

| Criterion | Evidence | Result |
| --------- | -------- | ------ |
| AC1 | Focused static-render tests passed 7/7 and assert `.coach-workspace-nav` precedes `.coach-workspace-header` in both Schedule and Bookings. Profile already renders navigation before `.coach-editor-heading`. | Passed |
| AC2 | Authenticated Daniel Park Chrome rehearsal measured identical navigation x/y coordinates and widths across Profile, Schedule and Bookings at `1440x1040` and `393x852`; every hero followed the navigation and neither viewport overflowed horizontally. | Passed |
| AC3 | Existing focused tests retained the correct active link, Schedule/Bookings exclusive content and gate behavior. Browser inspection retained all hero copy/actions and reported no page errors. | Passed |
| AC4 | `npm test` passed 85 application tests and 2 server tests; `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build` and `git diff --check` passed. | Passed |

Manual screenshots were written to the ignored local directory `test-results/coach-header-order/` as `bookings-desktop.png` and `bookings-mobile.png`. Database tests were not run because this ticket changes JSX order only.

## Risks, limitations, and follow-ups

The three heroes intentionally retain different copy, component class names and content-driven heights. Their navigation origin and ordering now match; identical hero height is not part of the requested alignment.

## Completion and review references

- Completed: 2026-10-08; all coach views now keep the shared navigation at one stable position above their green hero.
- Commit: Not created.
- Review: No independent review or pull request created.
- Deployment or release: None.
