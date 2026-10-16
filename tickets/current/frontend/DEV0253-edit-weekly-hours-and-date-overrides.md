# Ticket DEV0253: Edit weekly hours and date overrides

- Status: In progress
- Created: 2026-10-16
- Last updated: 2026-10-16
- Milestone: M9 — Coach calendar and effective availability
- Coordination: [COR0023 — Coach calendar and availability](../organisatory/COR0023-coach-calendar-and-availability.md)
- Related records: contract owner [DEV0251](../../archive/organisatory/DEV0251-define-coach-calendar-and-availability.md); peer dependencies and external M7 relationships are mapped in COR0023.

## Objective and context

Replace individual weekly-cell editing with a compact location-aware range editor and whole-date override workflow inside coach Schedule → Availability, consuming DEV0252 authority.

Implement against [specification section 18](../../../docs/mvp-spec.md#18-coach-calendar-and-effective-availability), [M9](../../../docs/mvp-spec.md#12-delivery-milestones) and the [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix). Confirmed choices and adopted operating defaults are distinguished in the specification; reference Everfit controls are not additional requirements.

## Scope and non-goals

- In scope: Weekday switches, multiple location-bound ranges, deliberate copy replacement, local complete drafts and explicit Save; date selection/custom hours/all-day unavailable, override list/edit/removal/restoration preview; saved-result warnings, pending closure counts, retry/conflict and dirty-draft recovery; editor actions using DEV0252.
- Out of scope: Scheduling SQL authority; dated private/group calendar feed or grid; public coach date navigation; booking cancellation/rescheduling, group editing, service templates or changing one-hour private sessions.

## Expected behavior and edge cases

One date off replaces every venue. Retained private bookings and published groups stay visible with warnings even when outside the new hours; an occupied hour cannot appear requestable. Local invalid ranges and server stale/venue errors retain the draft. Restore previews use the current week, preserve manual closures, and never revive old requests. Multi-date batches are all-or-nothing; no automatic stale resubmit. Today edits only future hours; past dates are read-only.

## Assumptions, decisions, and dependencies

DEV0252 must stabilize and validate revision/save/warning/restoration contracts before live mutation integration. DEV0254 owns Schedule view/date navigation and shared calendar styles; agree the secondary Calendar/Availability selection and deep-link contract first. Reuse the existing coach frame and shared venue controls.

Scope review: this record owns one delivery boundary under a flat coordination. Implementation started after DEV0252 completed and the user authorized frontend work while explicitly deferring migrations. Required real persistence checks remain pending until that database work permits them. Inspect actual versions/bundled documentation before framework or SDK integration changes and update this plan before material deviations.

## Implementation plan

1. Inspect installed Next.js form/action/client guidance and existing location-aware draft/save tests; document the agreed DEV0252 action shapes and DEV0254 view/date integration before editing.
2. Build weekly day/range/location controls and accessible copy review as one complete local draft with explicit atomic save and meaningful pending/saved feedback.
3. Add date override selection/editor/list/edit/remove flow with explicit whole-day scope, retained-session warning/detail links and closure/restoration preview; keep booking/group actions in their own destinations.
4. Verify real local coach saves, reload, fresh/uncertain retries, stale baseline and inactive-location recovery plus desktop/mobile/keyboard and dirty-draft behavior; record evidence against each criterion.

### Retained-group owner navigation plan — 2026-10-16

The user authorized the calendar group-link integration. At integration start, DEV0239's `/coach/events/[id]` route existed in the working tree; it was subsequently checkpointed as `228329b` and remains separately owned/In progress. Reuse its `coachEventHref` helper for retained groups before/after save, preserving original IDs, private Bookings anchors and `target="_blank" rel="noopener"` draft protection. Distinguish private/group link accessible names. DEV0254 owns calendar links and the cross-destination isolated fixture rehearsal; this peer owns its warning-link change and explicit draft/new-tab checks. Extend the maintained availability runner's href expectations. No new lifecycle/SQL/Auth grant, migration, group-management implementation or live fixture write belongs to this change; real persistence evidence remains pending.

## Acceptance criteria

- [ ] AC1: The owner composes multiple nonoverlapping venue ranges, day switches and deliberate copies locally and persists the complete week through one explicit save.
- [ ] AC2: Whole-date custom/day-off overrides save across venues and survive reload; edit/removal previews correctly describe retained sessions, pending closures and eligible current-week restoration.
- [ ] AC3: Validation, stale revision, inactive venue, unavailable/lost-response and navigation states preserve the proper draft and provide explicit recovery without false save success.
- [ ] AC4: Real local actions, desktop and 375/430 px layouts, keyboard/focus and relevant regression/static/build checks pass; unauthorised/suspended actors gain no editor authority.

## Validation plan

Extend meaningful existing schedule-draft/component coverage and the authenticated coach availability rehearsal for real range/copy/date saves, retained sessions, pending closures, restoration and conflict/retry. Check desktop and 375/430 px with keyboard, long venues, unavailable actions and dirty navigation. Run relevant tests, npm run test:coach-availability, npm run lint, npm run typecheck, npm run format:check and npm run build against the local stack. DEV0256 owns the final combined two-account rehearsal.

## Implementation record

Implementation began on 16 October 2026. No shared/disposable migration will be applied under this frontend phase; the user explicitly deferred migrations while separate database work proceeds.

### Changes and rationale

Replaced the 161-cell working-week grid and seven-day occurrence list in Schedule with a compact weekly range editor and separate date overrides. Each weekday has an availability switch, multiple venue-bound ranges and a reviewed copy-to-selected-days action. Copy replaces only the deliberately chosen target days in the local draft; the complete week is persisted only after reviewing and confirming Save.

The date editor supports whole-day unavailability, custom venue ranges and removal through “Use normal week”, for up to 31 selected dates. It lists saved overrides by month with canonical selected-date links, marks past dates read-only and previews the current saved week when restoring. Retained private/group sessions and pending-request closure counts appear before and after save. Exact operation IDs and payloads are retained across uncertain save responses; a retry verifies the recorded outcome. Invalid/stale/unavailable responses retain the draft, and no missing policy becomes an empty successful editor.

### Affected files

- [Coach route](../../../src/app/coach/page.tsx) loads a bounded month of owner policy, retains the existing approval/profile gates and mounts the editor at the canonical Schedule URL. [Workspace frame](../../../src/features/coaches/coach-availability-panel.tsx) retains the shared heading/navigation and Bookings content while removing the legacy grid/list.
- [Availability editor](../../../src/features/coaches/availability-editor.tsx), [range/dialog controls](../../../src/features/coaches/availability-editor-controls.tsx) and [scoped styles](../../../src/features/coaches/availability-editor.css) own weekly/date editing, previews, copy/save/navigation dialogs and responsive presentation. Native dialogs include explicit keyboard cycling and restore focus to their triggering control.
- [Editor model](../../../src/features/coaches/availability-editor-model.ts) owns immutable range/copy/confirmed-policy transformations, Berlin month navigation, bounded untrusted command parsing and client actor-access classification.
- [Workspace editor boundary](../../../src/features/coaches/availability-workspace-editor.tsx) binds the private draft to the signed-in subject, profile, dataset and current coach capability. Explicit account/access changes unmount the draft; transient unverifiable access hides it pending verification. Server scope checks remain authoritative.
- [Editor Server Actions](../../../src/app/coach/availability-actions.ts) validate unknown input and bounded date reads; [authorized service](../../../src/server/coaches/availability-editor-service.ts) checks actor scope/current approved or demo coach/visible profile before calling DEV0252 owner policy/preview/save operations. [Existing coach service](../../../src/server/coaches/service.ts) accepts an optional occurrence-read flag so this frame does not unnecessarily materialize the old occurrence list.
- [Model tests](../../../tests/availability-editor.test.ts), [action-input tests](../../../tests/server/availability-editor-actions.test.ts) and [updated frame regressions](../../../tests/coach-schedule.test.ts) verify changed boundaries. [Isolated browser rehearsal](../../../scripts/rehearse-availability-editor-ui.mjs) copies the source into an environment-free temporary checkout and mounts [explicit client fixtures](../../../tests/fixtures/availability-editor-harness.tsx); that route exists only in the temporary copy. Fixtures exercise presentation/recovery, never real SQL/Auth authority.

### Decisions and deviations

2026-10-16: Created from confirmed feature scope and section 18 operating defaults. Implementation began after DEV0252 completed and the user approved this frontend slice while explicitly deferring migrations.

Use `/coach?view=schedule&section=availability&date=YYYY-MM-DD` for selected-date availability. DEV0254 reserves `section=calendar`. Until that peer delivers, Schedule defaults to Availability without an inert Calendar control. Existing Profile/Schedule/Bookings frame and actual venue names are retained. Section/date/navigation changes review dirty drafts with save/discard/stay; browser unload uses the browser's native confirmation, and supported Navigation API history traversal uses the same custom review. Server refreshes announce a newer revision without replacing a dirty draft.

At the initial checkpoint, group warnings opened the public published detail while DEV0239 supplied its future owner destination. On 16 October 2026, the user authorized the group-link integration: before/after-save group warnings now reuse DEV0239’s `coachEventHref` helper to open the original `/coach/events/[id]` in a new tab with `noopener`. Accessible names distinguish private/group sessions. Private warnings retain their original Bookings anchors. No group lifecycle action or athlete identity is copied into availability; real authenticated destination proof remains pending.

An early fixture run found keyboard Tab could leave the native dialog's document focus cycle; explicit first/last-control cycling fixed it. Browser test waits were corrected to wait for hydration and asynchronous review results rather than inspecting before the preview resolved. These are UI/rehearsal corrections, not changes to SQL behavior.

### Contracts, configuration, and operations

New typed, serializable editor data includes the owner policy/revision, active and historical venue projections, authoritative Berlin date, actor scope and a bounded actor identity key. Commands/results reuse DEV0252 unchanged. Actions reject extra keys, invalid IDs/dates/times, duplicate cross-venue hours and oversized payloads before mutation; SQL rechecks current venue/time/owner eligibility. Successful real saves revalidate coach/public-coach paths. No dependency, environment variable, schema or migration is added by this slice.

The new UI requires DEV0252 functions in its target database. If absent, Schedule reports Unavailable instead of fabricating empty hours. No database migration/reset/seed command or auto-migrating `dev:local` was run under this phase. Shared/hosted rollout remains separate. Rolling back this UI change does not remove DEV0252 data or apply a database rollback.

## Validation results

The non-database checks below passed on 16 October 2026. Required authenticated persistence/reload/real retained-session and request-card checks are deferred by the user's migration constraint; fixture save results are not evidence of SQL persistence or live authorization.

| Criterion | Evidence                                                                                                                                                                                                  | Result             |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| AC1       | Unit range/copy conversion and complete-week payload checks; isolated browser save/copy flow. Real persistence remains deferred.                                                                          | Partially verified |
| AC2       | Date custom/day-off/restoration and warning presentation implemented; owner group links and draft-preserving popups pass isolated checks; real retained-session/request-card persistence remains pending. | Partially verified |
| AC3       | Model/action validation and isolated conflict/unavailable/exact-retry/draft navigation checks; real concurrent/authenticated recovery remains pending.                                                    | Partially verified |
| AC4       | Static/regression/isolated browser/build checks passed; required real coach/Auth checks remain deferred.                                                                                                  | Partially verified |

- `npm test` — final run passed **171 application tests and 18 server tests**. Coverage includes current range/copy/version/override transformations, Berlin month boundaries, account/run/suspension draft guards and malformed action inputs. An intermediate full run failed in the concurrently edited Events test because `next/navigation` loaded React client context under the server-only test condition. After those unrelated files changed independently, a fresh full run passed. No Events source or tests were edited under DEV0253. These workspace-wide runs included concurrent Events/environment work that is excluded from this checkpoint; the focused availability checks and isolated browser record describe this ticket's own validation.
- `npx tsx --conditions=react-server --test tests/server/availability-editor-actions.test.ts tests/server/coach-availability-actions.test.ts` — **3 passed**, including current and legacy action input regressions. These malformed-input checks reject before database access; they do not claim live authorization coverage.
- `node scripts/rehearse-availability-editor-ui.mjs` — **6 browser checkpoints passed**, no page runtime errors: multi-venue ranges/overlap; reviewed copy replacement and keyboard focus cycling/restoration; one explicit complete-week save; multi-date day-off/custom saves and restoration; retained private/group warnings and pending-count review; save/discard/stay for section changes, workspace links and browser Back; refreshed props/stale/inactive/unavailable draft preservation; identical operation/payload retry after a simulated committed-but-lost response; denied-action draft clearing; 375/430 px layouts with long venues and no horizontal overflow. Fixture modes explicitly simulate these results and never claim SQL outcomes.
- Manual screenshot review — inspected desktop weekly/review, 375 px weekly/copy and 430 px date views under `test-results/dev0253-ui/`. Corrected dialog centering and kept the mobile save bar in normal flow before changes; the final browser rerun passed after both fixes. These are Chrome desktop and resized phone-width checks, not physical-device coverage.
- Supplemental blank-page Chrome check (`node --input-type=module`, Playwright): show a native dialog, hide its containing owner element, then `locator('dialog').isVisible()` returned `false`. This verifies temporary access hiding also suppresses an open dialog in the tested browser.
- `npm run lint` — passed. `npm run typecheck` — final route generation and TypeScript check passed. `npm run format:check` — final application/script/test formatting check passed.
- `npm run build -- --webpack` — passed in the environment-free temporary source snapshot after removing its fixture route, copied fixture module and generated dev cache. This ran the real map-worker preparation and production compilation/type/page generation. Availability source matches the final tested implementation; the isolated snapshot avoids the local `.env` and shared development cache. Concurrent Events edits after snapshot creation are not claimed as that build's source. No deployment was performed.
- Relative-link/status/membership check — **39** links in this DEV and COR0023 resolved; DEV0253 remains current/In progress with reciprocal COR0023 membership. `git diff --check` passed. `npx prettier --check docs/mvp-spec.md tickets/README.md tickets/current/frontend/DEV0253-edit-weekly-hours-and-date-overrides.md tickets/current/organisatory/COR0023-coach-calendar-and-availability.md` passed after normalizing the changed index table.
- **Not run:** migrations/reset/seeding, database/pgTAP suites, `npm run test:coach-availability`, real authenticated weekly/date save+reload and retained booking/group/request-card proof, real stale/venue/Auth recovery, or the integrated DEV0256 rehearsal. The existing authenticated availability runner still uses legacy cell selectors and historical cleanup; updating it for the current contract is remaining work under this DEV before its live run. Do not execute that legacy runner against current data unchanged.

### Retained-group integration validation — 2026-10-16

- [Retained-session warnings](../../../src/features/coaches/availability-editor.tsx) now link to the owner page through DEV0239's existing helper. Original IDs/private anchors and new-tab/no-opener draft protection are preserved before and after save; private/group accessible names are distinct. No save/lifecycle contract or permission changed.
- `node scripts/rehearse-availability-editor-ui.mjs` passed all **6** existing checkpoints, zero page errors, with new exact owner/private URL, `_blank`/`noopener` and saved-warning assertions. Model checks passed as part of the **14** calendar/availability cases; the full workspace passed **198 application + 20 server tests**, typecheck, lint and formatting.
- DEV0254's extended calendar browser runner supplies the cross-destination UI proof for this peer's link: at desktop/375/430 widths, a keyboard-opened review warning reaches the actual owner route with the exact group ID in an opener-free tab; closing it preserves the draft value, review and empty save audit. After an explicit fixture save, its saved warning opens the same route. Owner terms/roster are rendered only in that separate destination, and group fixture state is unchanged. The runner uses explicit account/service fixtures; this is not persisted availability or real authentication evidence.
- No owner route/service/form, database migration, hosted data, Docker service or email was changed. DEV0239 remains the owner of its management interface and authority proof. Source/build/document review is recorded under DEV0254 for the combined integration slice; this ticket remains In progress for its own missing live persistence cases.

## Risks, limitations, and follow-ups

This ticket stays In progress until its required real persistence/authorization evidence passes. Isolated fixtures do not prove saved SQL policy, actual request closure, a retained real booking/group, server concurrency or a real authenticated reload. Owner group links now work in isolated integration checks; their real Auth/SQL authority and lifecycle remain dependent on DEV0239. DEV0254 owns mixed Day/Week/Month views, selected-date calendar transitions and owner feed/paging; this slice does not claim those views. DEV0255 owns public 30-day navigation and DEV0256 the combined two-account flow.

Handoff: frontend code exists against the validated DEV0252 contract, with no migrations applied. Once database work permits, update the authenticated runner for the new range/date contract and current fixture cleanup, then run the real approved-coach weekly/date/save/reload/conflict/retained-session rehearsal and verify unauthorized/suspended actors. Do not archive or mark completed while these checks remain missing.

## Completion and review references

- Completed: Not completed — required live validation deferred.
- Commit: Initial editor checkpoint `1db71b8`; group-warning integration included in the user-authorized `[DEV0253][DEV0254] Connect calendar groups to coach management` checkpoint. See Git history for its hash. Required live evidence remains open.
- Review: Implementation self-review against AC1–AC4 and the recorded partial/deferred evidence completed; no independent review.
- Deployment or release: None.
