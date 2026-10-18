# Ticket DEV0339: Promote My athletes to coach navigation

- Status: Completed
- Created: 2026-10-18
- Last updated: 2026-10-18
- Milestone: Coach workspace navigation
- Coordination: None — independent development ticket
- Related records: Navigation baseline [DEV0334](../../archive/frontend/DEV0334-promote-coach-sections-to-primary-navigation.md), connection interface [DEV0222](../../archive/frontend/DEV0222-add-coach-my-athletes.md), athlete-view counterpart [DEV0327](../../archive/frontend/DEV0327-promote-my-coaches-to-workspace-navigation.md), data preservation [DEV0337](../../archive/backend/DEV0337-preserve-existing-demo-coach-data.md).

## Objective and context

The user sees My athletes inside Coach workspace → Bookings and wants a separate entry in the left panel. Bookings should contain booking requests and booked sessions; My athletes should own the existing private connection lists and shared history. Follow [connection behavior](../../../docs/mvp-spec.md#49-connect-after-a-confirmed-session), [identity/data integrity](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity) and [permission rules](../../../docs/mvp-spec.md#9-scheduling-behavior-and-permissions).

## Scope and non-goals

- In scope: dedicated My athletes route, coach desktop/mobile navigation and active selection, separate Bookings/connection views, internal destination/back links, relevant invalidation, current specification and focused validation.
- Out of scope: connection eligibility/consent/data changes, coach approval changes, public athlete profiles, redesigning cards or connection actions, migrations, demo data edits, account setup, unrelated pending authentication/username/preview work and commits.

## Expected behavior and edge cases

Coach navigation is Home, Schedule, Bookings, My athletes, Events. `/coach/athletes` shows accepted athletes, incoming/outgoing/previous connection requests and existing private shared-history actions, without the booking queue or full bookings list. The nested pair detail route remains unchanged and selects My athletes. Bookings remains `/coach?view=bookings`, showing requests and sessions with existing per-booking connection options but no embedded My athletes lists. Those options and athlete-detail return links target the new page.

Only eligible approved/demo/suspended coach views expose the navigation entry. The page verifies the existing server-derived actor/coach access before loading private lists. Pending/rejected/not-applied users get the existing application gate; signed-out/unavailable/preview states expose no private records. Suspended coaches keep existing history and permitted removal/withdraw/decline actions, without new send/accept authority. Athlete view remains unchanged. Existing query parsing and private pair URLs retain their behavior; old private Bookings fragments are no longer generated.

## Assumptions, decisions, and dependencies

Confirmed: promote My athletes to coach left navigation. Adopt `/coach/athletes` because private athlete details already live under that route, and put it between Bookings and Events. Mirror it on mobile for equivalent access. Reuse `ConnectionWorkspace`'s existing `sessions`/`connections` views and existing server services instead of introducing a second connection implementation. No data/schema/package/environment changes or unresolved product question. Preserve retained demo data and all unrelated working-tree changes.

## Implementation plan

1. Record this bounded ticket/index entry before source edits; inspect installed Next 16.3.8 routing/navigation guidance and existing coach authorization.
2. Add the guarded connections-only route and My athletes destination; select it for its root and pair detail pages while keeping booking details under Bookings.
3. Render sessions-only content in Bookings; update connection/back links and invalidate the new page after relevant mutations.
4. Update the current specification; validate navigation/links/permissions, desktop/mobile/keyboard and empty/error states with read-only local browsing, plus applicable tests/lint/types/build. Do not modify fixture content or credentials for testing.
5. Review against acceptance criteria, finish the implementation record and archive only after required checks pass.

## Acceptance criteria

- [x] AC1: Coach desktop/mobile navigation includes My athletes as a separate destination; its root/detail routes select only that destination and booking details still select Bookings.
- [x] AC2: The dedicated page contains the existing connection lists/history; Bookings contains requests/sessions without duplicated lists, and all internal My athletes links reach the new destination.
- [x] AC3: Existing actor/coach/suspension boundaries, errors/empty states and connection permissions remain; relevant mutations refresh the new destination. No retained demo data/credentials are changed.
- [x] AC4: Responsive and keyboard checks, focused automated regressions, relevant project checks and the specification/ticket/index record are complete.

## Validation plan

Extend existing navigation tests for root/detail, strict prefix/query selection and desktop/mobile output; verify accepted-booking connection links. Run existing shell, workspace and connection regressions, lint/types and a production build for the new route. Use the already signed-in local coach browser for read-only desktop/mobile navigation, keyboard focus and Bookings/My athletes separation; inspect signed-out/empty/unavailable handling without creating/editing retained fixtures. Record exact commands, results and any environmental limitations. Database/migration checks are not applicable: no data contract, schema or database logic changes.

## Implementation record

Scope reviewed before source edits: one navigation/route slice, no separate coordination needed. Implementation, validation and self-review completed.

### Changes and rationale

Added `/coach/athletes` using the existing coach actor/access service and connections-only workspace. Approved/demo coaches retain their existing controls; suspended coaches receive the existing gate with their history, and other application states receive the gate before private connection queries. The route includes the existing four accepted/request/history sections, refresh/pagination and pair-history behavior.

Added My athletes between Bookings and Events in the shared desktop/mobile destination list. Its root and nested pair detail routes select My athletes; booking details still select Bookings. Bookings now uses the existing sessions-only workspace and no longer loads/renders the embedded connection lists. Per-booking connection options link to the new page; athlete-detail Back to My athletes does too. Shared-history View session links use the complete Bookings URL because their session cards are now on another page. Connection and scheduling mutations invalidate the new route.

Extended the existing navigation and connection-link regressions. Adapted the three tagged connection/detail rehearsal scripts to move between Bookings and My athletes explicitly; their fixture logic is unchanged and no mutating rehearsal was run for this change. Recorded the requested navigation refinement as C50 and updated the current connection/navigation contract.

### Affected files

| Files                                                                                                                                                                                                                                            | Role                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| [New route](../../../src/app/coach/athletes/page.tsx), [Bookings](../../../src/app/coach/page.tsx)                                                                                                                                               | Guarded connections-only page and sessions-only Bookings.                                                                                    |
| [Destinations](../../../src/components/coach-workspace-destinations.ts), [selection](../../../src/domain/coach-workspace.ts)                                                                                                                     | Shared desktop/mobile entry and unambiguous root/detail selection.                                                                           |
| [Booking options](../../../src/features/connections/booking-connection-options.tsx), [athlete detail](../../../src/features/coaches/athlete-detail.tsx), [shared history](../../../src/features/connections/connection-history.tsx)              | Correct cross-page connection, return and session links.                                                                                     |
| [Connection actions](../../../src/app/connections/actions.ts), [scheduling actions](../../../src/app/coach-marketplace-actions.ts)                                                                                                               | Refresh the new page after relevant successful changes.                                                                                      |
| [Navigation tests](../../../tests/workspace-navigation.test.ts), [shell tests](../../../tests/shell-navigation.test.ts), [schedule tests](../../../tests/coach-schedule.test.ts), [connection tests](../../../tests/coach-connections.test.ts)   | Coach eligibility, root/detail/prefix/query selection, mobile/desktop ordering, role-specific connection links and cross-page history links. |
| [Coach connection rehearsal](../../../scripts/rehearse-local-coach-connections.ts), [combined rehearsal](../../../scripts/rehearse-local-athlete-connections.ts), [athlete-detail rehearsal](../../../scripts/rehearse-local-athlete-details.ts) | Preserve existing tagged workflows after navigation separates lists and booking cards.                                                       |
| [Specification](../../../docs/mvp-spec.md), [index](../../README.md)                                                                                                                                                                             | C50, current behavior and ticket lifecycle.                                                                                                  |

### Decisions and deviations

2026-10-18: adopted route/order above. Shared-history links require the complete Bookings URL to avoid dead anchors after the page split. The existing development server appeared blank temporarily through native browser automation, so read-only browser validation used an isolated copy on loopback port 3191 with the same guarded local runtime. That instance ran no setup, migrations or provisioning. Source/build validation excludes ignored operational snapshots without deleting or changing them. Native keyboard automation could not deliver the required page input; the user verified the final Tab/Enter flow directly instead.

### Contracts, configuration, and operations

New private page `/coach/athletes`; existing `/coach/athletes/[pairId]` and booking routes remain. Old private Bookings fragments are no longer generated. No migration, package, environment variable, public API, credential change or data setup. Rollback is presentation-only: restore the embedded lists and original links together; retain connection/history data. Shared pending Auth/navigation/username edits are preserved.

## Validation results

2026-10-18; Node 24.21.0, Next.js 16.3.8. Read the installed layouts/pages and linking/navigation guides before source edits.

- `npm test`: 283 unit/development and 46 server tests passed (329 total, zero failures).
- `npm run lint`: passed; scoped lint of the new page and three adapted rehearsal scripts also passed.
- `npm run typecheck`: route generation passed; root TypeScript scanning failed only on previously incomplete ignored copies under `work/dev0336/commit-files/`. No actual source error was reported. `npx tsc --noEmit -p /tmp/dev0339/tsconfig-validation.json` passed for real root/source/scripts/tests/generated route types with the same compiler options, excluding ignored work/tmp copies. No repository TypeScript configuration was changed.
- `npm run build -- --webpack` in `/tmp/dev0339/build-validation`: passed compilation, full TypeScript validation and page generation, including `/coach/athletes` and its nested detail route. The source snapshot excludes private environment/work files and uses existing dependencies; the active development server output is untouched.
- Scoped `npx prettier --check` passed all 16 changed implementation/test/rehearsal TypeScript files. Repository link checking passed all 382 current targets across the ticket, specification and index at final handoff; whitespace and archived/indexed lifecycle checks passed at handoff.
- Signed-out HTTP request to `/coach/athletes` returned 307 to `/sign-in?returnTo=%2Fcoach%2Fathletes`. Safari desktop and 390×844 responsive checks on the isolated local instance passed: My athletes is selected separately, accepted/incoming/history empty states and the existing outgoing request render, Bookings shows booking requests and booked sessions with no embedded connection lists, and all five mobile destinations fit without clipping. The existing pending request and booking were only viewed; no connection/session controls were changed. Refresh connections was exercised as a read-only operation. Existing unavailable/paging and suspended-control regressions passed in `npm test`; server guard branches were reviewed against the existing actor/coach services.
- Keyboard: native automation could not reliably focus the page, and coordinate input reported `noWindowsAvailable`; browser-level controls were unavailable. After reviewing the implemented page, the user explicitly confirmed on 18 October: “Tab and Enter work.” This verifies the final sidebar keyboard flow without claiming a successful automated keystroke check.
- Ordinary local sign-in used the existing saved credential. The first native accessibility-value attempt failed; native typing succeeded, and the password-save prompt was dismissed with Not Now. No password/profile/connection data was changed and no credential was saved to the browser password manager. Only normal Auth session/password-method bookkeeping occurred. No rehearsal fixtures, migration, reset or provisioning was run.
- Database/migration checks not applicable: no database logic/schema/data changes. The three adapted tagged mutating rehearsals were not executed; their navigation changes are covered by lint/types and source review, with the affected destination flows checked read-only in the browser.
- Cleanup: stopped only the temporary server on port 3191 after verifying its exact `/tmp/dev0339/build-validation` working directory. The original application on port 3100 remains running. No browser password was saved and no retained data was reset. Final link/ID checks preserve the independently allocated DEV0340–DEV0346/COR0029 planning records.

| Criterion | Evidence                                                                                                                                             | Result |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Strict root/detail/prefix/query selection tests, coach eligibility/order tests and desktop/mobile visual checks.                                     | Passed |
| AC2       | Sessions-only Bookings and connections-only page observed; role-specific links and cross-page history regressions passed.                            | Passed |
| AC3       | Existing actor/coach guard and suspended-control review/tests, signed-out redirect, actual empty states and unchanged retained fixture content.      | Passed |
| AC4       | 329 tests, lint, scoped types, isolated full production build/types, formatting/links/whitespace, responsive checks and user Tab/Enter confirmation. | Passed |

### Commit isolation review — 2026-10-18

Committed the completed DEV0326/DEV0327/DEV0333/DEV0334 navigation foundations separately first because DEV0339 imports their shared navigation and connection-view modules. This commit contains only the My athletes route/navigation/link/invalidation changes, focused regressions, three adapted rehearsal scripts, and its specification/ticket/index updates. Later concurrent coach-page/session-type and website-editor changes are excluded. Review also aligned remaining current specification navigation/connection summaries with C50 while preserving the historical C47/C48 decisions.

A clean HEAD snapshot plus those prerequisites and DEV0339 passed `node --import tsx --test --test-concurrency=2 tests/*.test.ts` (282 tests), `node --import tsx --conditions=react-server --test --test-concurrency=2 tests/server/*.test.ts` (45 tests), `npm run lint` and `npm run typecheck` (327 tests total, zero failures). TypeScript used `NODE_OPTIONS=--max-old-space-size=1024` only in the temporary validation copy; repository package/compiler configuration is unchanged. Logs: `/tmp/dev0339/commit-my-athletes-{unit-serial,server-serial,lint-serial,types-serial}.log`. Initial sandboxed `npm test` could not open its IPC socket; parallel retries hit the same four existing startup/rehearsal-runner timeouts as the prerequisite snapshot under resource pressure. The two-worker retries passed. Unbounded concurrent typechecks were stopped before the passing memory-limited run. All 368 local Markdown targets in the owned commit documents resolved. Existing recorded production-build, responsive and user keyboard evidence remains applicable; no database, provisioning or mutating rehearsal was rerun for committing.

## Risks, limitations, and follow-ups

The shared navigation/connection prerequisites are committed separately under DEV0326/DEV0327/DEV0333/DEV0334. Concurrent authentication, session-type, website-editing, preview and operational changes remain excluded. Historical private Bookings fragment links remain Bookings URLs, but new internal links use the dedicated page. Root TypeScript scanning still encounters unrelated ignored snapshots; real-source checking and the isolated production build passed. Full tagged mutation rehearsals were adapted but not rerun; no connection mutation logic changed. No deployment is included; commits follow the user’s explicit request.

## Completion and review references

- Completed: 2026-10-18 — My athletes is a separate private coach destination on desktop/mobile; Bookings retains requests/sessions, with existing data and permissions preserved.
- Commit: Included in `[DEV0339] Move My athletes into coach navigation`, after the separately committed DEV0326/DEV0327/DEV0333/DEV0334 prerequisites. Authentication, session types, website editing and private credentials are excluded.
- Review: Scope/implementation/acceptance self-review and direct user keyboard confirmation passed; no independent code review.
- Deployment or release: None.
