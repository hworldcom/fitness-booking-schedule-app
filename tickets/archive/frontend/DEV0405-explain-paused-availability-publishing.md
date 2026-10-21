# Ticket DEV0405: Explain paused availability publishing

- Status: Completed
- Created: 2026-10-21
- Last updated: 2026-10-21
- Milestone: M9 — Coach calendar maintenance
- Coordination: None — independent development ticket
- Related records: [DEV0254 — Calendar history and access baseline](../../archive/frontend/DEV0254-add-private-and-group-coach-calendar.md)

## Objective and context

The calendar says “Existing sessions and history are available. Availability publishing is paused.” without explaining that an approved coach's profile must also be public. The user requested a clear explanation. Preserve the existing [calendar access contract](../../../docs/mvp-spec.md#184-calendar-presentation-and-access) while making its restriction actionable.

## Scope and non-goals

- In scope: identify the existing hidden-profile or suspended-coach reason in the calendar response; explain the reason; link eligible hidden coaches directly to Discovery visibility; verify desktop, phone and keyboard behavior using isolated fixtures.
- Out of scope: changing approval/publication permissions, publishing any profile, changing retained accounts or availability, database migrations, deployment and unrelated weekly-loading work.

## Expected behavior and edge cases

An approved/demo hidden coach sees that their profile is hidden and must be public to publish availability, with instructions to choose Visible and save the coach profile. A profile-settings link targets Discovery visibility. Suspended owners see a suspension explanation without a publication-settings action that implies self-service recovery. Existing sessions/history stay available. Eligible visible coaches see no paused notice. Reloads retain the appropriate explanation.

## Assumptions, decisions, and dependencies

- Approval and visibility remain independent; this is a clarification of current behavior, with no product-rule change or specification amendment required.
- Derive a presentation reason from the same server-verified access and visibility already used by the existing permission flag. Suspension takes precedence when the profile is also hidden.
- Use the installed Next.js 16.3.8 Link API and existing isolated calendar browser rehearsal. No new dependency or external account is needed.
- Scope review: one small frontend task with a supporting calendar projection field; no coordination record or split needed.

## Implementation plan

1. Add the paused reason to the calendar model/service and explicit fixture data, keeping the permission calculation unchanged.
2. Replace the generic notice with reason-specific copy and a hidden-profile link; give Discovery visibility a stable focusable anchor and focus/jump to it on profile-editor mount when that fragment is requested.
3. Extend the maintained browser rehearsal for hidden/suspended/visible messages, reload, desktop/phone layout and keyboard profile navigation. Run focused existing calendar tests, scoped lint/format and type checking.
4. Review the diff and acceptance evidence, finish this record, archive it and update the index. Do not commit or deploy.

## Acceptance criteria

- [x] AC1: Hidden approved coaches see why availability publishing is paused, explicit Visible/save instructions and a working link to Discovery visibility.
- [x] AC2: Suspended coaches receive an accurate suspension explanation without a visibility action; visible eligible coaches have no paused notice; existing permission and history behavior remain intact.
- [x] AC3: Desktop and phone notices wrap without overflow, keyboard activation reaches the focusable profile setting, and reload keeps the reason.
- [x] AC4: Relevant calendar tests, scoped lint/format/type checks and final scope/link review pass; the implementation record and index are complete.

## Validation plan

Use the maintained isolated calendar UI rehearsal with explicit hidden/suspended/visible fixtures at 1440, 430 and 375 px, real component rendering, reload and Tab/Enter link navigation to the profile visibility anchor. No real Auth or database mutations. Run existing unit/server calendar tests, scoped ESLint/Prettier and TypeScript validation in the isolated checkout where practical. A database rehearsal is not applicable because SQL and permissions are unchanged. A full production build is not required for copy plus a typed projection field when the Next.js development compile, type check and affected UI checks pass.

## Implementation record

### Changes and rationale

The calendar now explains the reason publishing is unavailable. For a hidden approved/demo profile it says: “Your coach profile is hidden. Make it public to publish availability: choose Visible under Discovery visibility and save your coach profile. Existing sessions and history are still available.” The underlined “Review profile visibility” action opens `/profile/coach#coach-profile-visibility`.

Suspended owners instead see: “Your coach access is suspended, so availability publishing is paused. Existing sessions and history are still available.” They receive no visibility action. Eligible visible coaches receive no paused notice. The existing `mayEditAvailability` permission calculation and history access are unchanged.

Discovery visibility now has a stable, programmatically focusable heading with scroll clearance. The profile editor focuses it and jumps instantly into view once on mount only when that exact URL fragment is present; ordinary renders and saves do not reset focus. This addresses the keyboard failure and smooth-scroll positioning race found during browser validation.

### Affected files

| File | Change and purpose |
| --- | --- |
| [Calendar model](../../../src/features/coaches/coach-calendar-model.ts), [calendar service](../../../src/server/coaches/calendar-service.ts) | Add the server-derived `availabilityPausedReason` presentation field: `profile-hidden`, `coach-suspended` or `null`; suspension takes precedence. |
| [Calendar](../../../src/features/coaches/coach-calendar.tsx), [calendar styles](../../../src/features/coaches/coach-calendar.css) | Reason-specific notice, explicit publication instructions and an underlined settings link. |
| [Coach profile editor](../../../src/features/coaches/coach-profile-editor.tsx) | Fragment target, scroll clearance and one-time keyboard focus on the requested Discovery visibility heading. |
| [Calendar fixture data](../../../tests/fixtures/coach-calendar-data.ts), [harness](../../../tests/fixtures/coach-calendar-harness.tsx), [existing calendar tests](../../../tests/coach-calendar.test.ts) | Represent visible, hidden and suspended projections without real accounts or data writes; retain existing history assertions. |
| [Browser rehearsal](../../../scripts/rehearse-coach-calendar-ui.mjs) | Exercise notices/history, reload, wrapping and actual Tab/Enter navigation to the real profile-editor component at desktop and phone widths, using explicit isolated fixtures. |
| [Ticket index](../../README.md) | Allocate DEV0405 and track its lifecycle without changing unrelated work records. |

### Decisions and deviations

2026-10-21: distinguish suspension from hidden visibility so that making a profile public is never suggested as a suspension workaround.

The first browser rehearsal passed the eight existing calendar checkpoints, then reached the correct profile URL but timed out waiting for keyboard focus at Discovery visibility. A focusable heading alone did not transfer focus in this route transition. Before the repair, extend step 2 to focus that heading once on profile-editor mount when its exact fragment is present; do not steal focus on ordinary saves/rerenders.

The next full run hit an unrelated 30-second navigation `load` timeout after five checkpoints although the server returned the calendar successfully. Before retrying, make the runner's calendar-opening helper wait for DOM content and its existing hydrated Ready marker instead of optional resource loading. Apply the same DOM-ready condition to the new notice reload/profile navigation checks. This changes validation readiness only, not application navigation.

The third run passed the eight existing checkpoints and the complete new desktop notice/focus flow. Its next assertion incorrectly expected desktop per-date edit links in the phone Week agenda, which intentionally omits the timed grid. Limit that positive desktop-grid assertion to 1440 px; continue checking all notice/history/link/navigation behavior at all three widths. No application change is needed for this test assumption.

The fourth full run passed the eight existing checkpoints again, then Chrome reported `net::ERR_NETWORK_IO_SUSPENDED` during the new settings-link navigation. No application error was reported. Run only the maintained new three-width notice checks in a fresh isolated browser by making a temporary runner copy that omits the already-passed broad-check block. Keep this filtering outside the repository source and write its evidence separately under `test-results/dev0405-ui`.

The first focused run successfully focused Discovery visibility but checked its viewport position before the application's existing smooth scroll had settled. Add an observed in-viewport wait after the focus assertion, without manually scrolling in the test; the test must verify the real link/focus behavior rather than force the target into view.

The next focused run passed desktop/430 px but the 375 px target moved between the in-viewport observation and the next position assertion. Make fragment landing deterministic in the application: focus the heading with scrolling prevented, then scroll it instantly into view with its existing header clearance. This applies only to the requested visibility fragment on mount and leaves ordinary page scrolling unchanged.

### Contracts, configuration, and operations

The internal calendar response gains required `availabilityPausedReason: "profile-hidden" | "coach-suspended" | null`, supplied by both runtime and fixture producers. It describes existing authorization rather than granting access. The new profile fragment is an additive navigation target. No database, environment, dependency, credential, setup or migration change. No retained data writes. Rollback is a source revert; no data rollback is needed.

## Validation results

21 October 2026, local Node.js 24.21.0, Next.js 16.3.8 and isolated headless Chrome. No populated environment files, real accounts, migrations or retained-data mutations were used by these checks.

- `node --import tsx --test tests/coach-calendar.test.ts`: **8 passed**, zero failures/skips. Existing date/navigation, paging, history and account-access checks remain intact.
- `node --import tsx --conditions=react-server --test tests/server/coach-calendar-actions.test.ts`: **1 passed**, zero failures/skips; invalid calendar/scope input remains rejected before authorization.
- `node node_modules/eslint/bin/eslint.js src/features/coaches/coach-calendar-model.ts src/server/coaches/calendar-service.ts src/features/coaches/coach-calendar.tsx src/features/coaches/coach-profile-editor.tsx tests/fixtures/coach-calendar-data.ts tests/fixtures/coach-calendar-harness.tsx tests/coach-calendar.test.ts scripts/rehearse-coach-calendar-ui.mjs`: **passed**. The final focus change and runner-readiness change were also checked separately after editing.
- `node node_modules/prettier/bin/prettier.cjs --check src/features/coaches/coach-calendar-model.ts src/server/coaches/calendar-service.ts src/features/coaches/coach-calendar.tsx src/features/coaches/coach-calendar.css src/features/coaches/coach-profile-editor.tsx tests/fixtures/coach-calendar-data.ts tests/fixtures/coach-calendar-harness.tsx tests/coach-calendar.test.ts scripts/rehearse-coach-calendar-ui.mjs`: **passed**; final edited files also checked separately.
- In a newly created temporary source-only checkout, `node node_modules/next/dist/bin/next typegen` followed by `node node_modules/typescript/bin/tsc --noEmit --incremental false`: **passed** on the final application source, including the instant fragment landing. The checkout copied `src`, `tests`, `scripts`, `package.json`, `tsconfig.json`, `next-env.d.ts` and `next.config.ts`, symlinked installed dependencies, excluded populated environment files and removed itself afterward. It did not alter shared `.next` output.
- Local Markdown target validation across this ticket and the index: **355 targets passed** before and after archival. Final scoped `git diff --check` and formatting passed; exactly one DEV0405 record exists in the archive, with no stale current-ticket index link.
- `node scripts/rehearse-coach-calendar-ui.mjs`: the eight existing calendar checkpoints passed in the initial, third and fourth full runs. The final affected flow was then checked separately, avoiding repeated unrelated checks after the Chrome interruption. Failed attempts and their application/test repairs are recorded above; no final full-suite success is claimed.
- Final focused browser command below: **3 checkpoints passed**, zero browser page errors. At **1440/430/375 px**, visible eligible coaches have no notice; hidden/suspended coaches retain history and lack per-date publishing actions; hidden coaches get explicit Visible/save instructions and an underlined settings action; suspended coaches get their distinct explanation without that action. Reload preserves the hidden message. Actual Tab/Enter reaches the real profile-editor heading with focus and the target in the viewport. The Hidden radio remains checked; the test publishes/saves nothing. No horizontal notice overflow was observed. Manual image review confirmed readable wrapping and focused Discovery visibility on the smallest phone layout. Evidence: `test-results/dev0405-ui/results.json` and the nine width/scenario screenshots. The runner stopped its own server/browser and removed its isolated source checkout afterward.
- Full production build and database/migration tests: **not run**, because no SQL, framework configuration, dependency or permission behavior changed; isolated Next.js route compilation, full type validation and affected browser checks supply the necessary proof. No hosted release or real-account mutation rehearsal was requested.

| Criterion | Evidence | Result |
| --- | --- | --- |
| AC1 | Three-width hidden notice, exact instructions, reload and actual profile-setting navigation | Passed |
| AC2 | Three-width visible/hidden/suspended scenarios, retained history and unchanged permission expression; 9 existing unit/server checks | Passed |
| AC3 | 1440/430/375 px wrapping/overflow and actual Tab/Enter focus/viewport proof; phone screenshots reviewed | Passed |
| AC4 | Scoped lint/format, final isolated typegen/TypeScript, scope/link review and completed index/record | Passed |

Reproduce the focused browser checks from the repository root. This executes the maintained runner's setup and notice block without changing repository files or weakening its assertions:

```sh
node --input-type=module <<'NODE'
import { readFile, writeFile, mkdtemp, symlink, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
const root = process.cwd();
const temp = await mkdtemp(path.join(tmpdir(), 'movx-dev0405-focused-'));
try {
  let source = await readFile('scripts/rehearse-coach-calendar-ui.mjs', 'utf8');
  const start = source.indexOf('  await open();', source.indexOf('  const reload = () =>'));
  const end = source.indexOf('  for (const width of [1440, 430, 375]) {', start);
  if (start < 0 || end <= start) throw new Error('Focused rehearsal boundaries changed');
  source = (source.slice(0, start) + source.slice(end)).replace('test-results/dev0254-ui', 'test-results/dev0405-ui');
  const runner = path.join(temp, 'rehearse.mjs');
  await writeFile(runner, source);
  await symlink(path.join(root, 'node_modules'), path.join(temp, 'node_modules'), 'dir');
  await import(pathToFileURL(runner).href);
} finally { await rm(temp, {recursive:true, force:true}); }
NODE
```

## Risks, limitations, and follow-ups

Local presentation/typing validation uses explicit fixtures, not live account/database authorization proof or hosted deployment. Existing authorization calculations are unchanged; no retained accounts/profiles were published or edited. Unrelated worktree changes, including independently completed weekly-availability work, are preserved. No known remaining acceptance gap or follow-up in this slice.

## Completion and review references

- Completed: 2026-10-21 — clear hidden-profile instructions, truthful suspension copy and keyboard-accessible visibility navigation validated locally.
- Commit: This record accompanies `[DEV0405] Clarify paused availability publishing` on `work/dev0405-availability-publishing-message`. The user authorized creating the branch and committing this completed change on 2026-10-21, after the original local-only handoff.
- Review: Self-review against all four acceptance criteria and the scoped diff completed; no independent review or pull request.
- Deployment or release: Not deployed.
