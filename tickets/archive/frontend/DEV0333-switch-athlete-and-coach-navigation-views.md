# Ticket DEV0333: Switch athlete and coach navigation views

- Status: Completed
- Created: 2026-10-18
- Last updated: 2026-10-18
- Milestone: Authenticated workspace refinement
- Coordination: None — independent development ticket
- Related records: Independent Profile [DEV0326](DEV0326-separate-profile-from-workspace-navigation.md); My coaches navigation [DEV0327](DEV0327-promote-my-coaches-to-workspace-navigation.md); original workspace baseline [COR0018](../../current/organisatory/COR0018-authenticated-workspace-redesign.md).

## Objective and context

The user requested renaming only the dropdown's My sessions item to Trainings, retaining left-side names, and letting coaches switch between athlete and coach navigation. Athlete view contains My sessions and My coaches; coach view contains Coach workspace; Home remains first. Update the [actor/navigation contract](../../../docs/mvp-spec.md#3-actors-and-authority) and [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix) in this change.

## Scope and non-goals

- In scope: shared account dropdown naming and view switch, mode-specific desktop/mobile workspace navigation, coherent Trainings/Profile/message-return destinations, account-scoped browser-session preference and focused validation.
- Out of scope: account-role mutation, coach approval, new authorization, scheduling/data changes, admin tools, route renames and unrelated pending work.

## Expected behavior and edge cases

Ordinary athletes and pending/rejected applicants have only athlete navigation. Approved/demo coaches can switch from the shared dropdown; suspended coaches retain only their existing limited coach access. Desktop and mobile workspace navigation show Home followed by My sessions/My coaches in athlete view or Coach workspace in coach view. Existing left labels and page headings remain unchanged. Messages/Profile remain available through header controls. The dropdown orders Profile, Trainings, Account settings, then the eligible view switch. Trainings opens the current view's workspace. Profile opens personal Profile in athlete view and coach Profile for approved/demo actors in coach view; suspended actors retain personal Profile. Switching navigates to /sessions or /coach; exact nested workspace routes determine their view, including direct links and browser history. Public coach URLs must never select coach mode. The last view is remembered per account for the current browser session on neutral pages; unavailable storage falls back safely. Mode is presentation only and never grants server authority.

## Assumptions, decisions, and dependencies

Confirmed: dropdown Trainings, unchanged left labels, separate athlete/coach view destinations, Home first. Adopted defaults: place switch in the existing dropdown, let Trainings/Profile/message return follow the active view, start a new browser session in athlete view, and remember the choice in account-scoped session storage. Route identity takes precedence over stored preference. Reuse existing approved/demo/suspended navigation eligibility. Installed Next 16.3.8 usePathname/Link bundled guides reviewed before edits. No dependency/schema/environment change.

## Implementation plan

1. Add small shared view resolution/browser preference helpers with capability and exact route boundaries.
2. Update dropdown, desktop/mobile navigation and message return to consume the same view; retain disclosure keyboard/focus behavior.
3. Update specification and meaningful navigation/render tests; verify real local athlete/coach flow on desktop/phone, keyboard, history/reload and storage failure. The initial six-phase run exercises default Coach workspace and Home. If the known calendar latency blocks repeats, use the existing Events workspace and neutral Account page for focused final preference/history/isolation and cleanup checks; do not change unrelated calendar SQL.
4. Run appropriate tests/lint/type/build, review focused changes, record evidence and archive only after criteria pass.

## Acceptance criteria

- [x] AC1: Dropdown uses Trainings; unchanged left labels/page headings; Home remains first.
- [x] AC2: Eligible coaches switch both ways; desktop/mobile primary navigation contains only the selected view's destinations. Ordinary/unapproved actors cannot acquire coach navigation.
- [x] AC3: Trainings/Profile/message-return destinations, direct nested routes, public URL boundaries, browser history/reload, actor isolation and unavailable storage remain coherent without changing authority.
- [x] AC4: Desktop/phone keyboard/disclosure/error checks and relevant automated checks pass; specification/index/implementation record explain the delivered result and limitations.

## Validation plan

Unit/static-render tests cover all actor statuses, route segment boundaries, invalid preferences, exclusive navigation and menu destinations. Real local browser rehearsal uses Daniel's existing demo account for both modes and an owned ordinary fixture for athlete/unauthorized boundaries without altering existing profiles. Check desktop/393px layouts, visible labels, Escape/focus, switch/Trainings/Profile/message return, Home/reload/back-forward, same-tab account isolation and blocked storage. Preserve credentials outside repository evidence and clean owned test accounts if created. Run npm test, lint, typecheck, format check and an isolated production build. No database migration tests: no persistence schema or authorization changes.

## Implementation record

### Changes and rationale

Renamed only the shared dropdown destination to Trainings. The dropdown now identifies the current view and offers an eligible coach a Switch to coach/athlete view link. Trainings and Profile follow the selected view. Desktop and mobile primary navigation now show Home followed exclusively by My sessions/My coaches or Coach workspace. Messages remains in the header and its independent window returns to the selected workspace. Existing page headings and desktop labels remain unchanged.

A shared capability/route resolver keeps direct and nested workspace links authoritative, while a small client hook remembers the last view in per-account browser-session storage for Home, Account and Messages. Public coach URL segments cannot accidentally select coach mode. Invalid preferences and unavailable storage fall back safely; stored values never grant capability. Existing approved/demo/suspended eligibility and server route/data guards remain intact.

### Affected files

| File | Role |
| --- | --- |
| [workspace-view.ts](../../../src/auth/workspace-view.ts) | Shared capability, exact route, preference-key and destination resolution without provider dependencies. |
| [use-workspace-view.ts](../../../src/auth/client/use-workspace-view.ts) | Hydration-safe browser-session subscription and account-scoped route preference. Storage errors are caught. |
| [account-menu.tsx](../../../src/components/account-menu.tsx) and [account-menu.css](../../../src/app/account-menu.css) | Trainings/Profile destinations, view label/switch and a bounded responsive dropdown retaining existing focus/disclosure handling. |
| [shell.tsx](../../../src/components/shell.tsx) | Exclusive desktop/mobile navigation, view label, public coach shortcut and Messages return. |
| [workspace-view tests](../../../tests/workspace-view.test.ts), [shell navigation tests](../../../tests/shell-navigation.test.ts), [menu tests](../../../tests/account-menu.test.ts), [message-shell tests](../../../tests/message-shell.test.ts) | Actor/route/preference boundaries, unchanged labels, selected destinations, disclosure markup and default rendering. |
| [local availability rehearsal](../../../scripts/rehearse-local-coach-availability.mjs) | Replace the obsolete expectation of simultaneous coach/athlete primary links with coach-view Trainings and athlete-switch checks, including Escape/focus. |
| [MVP specification](../../../docs/mvp-spec.md) and [index](../../README.md) | C47, current navigation/acceptance consistency and ticket lifecycle. |

### Decisions and deviations

2026-10-18: retained native links for switching so route authority, keyboard behavior and browser history remain familiar. A new browser session defaults to athlete view; explicit /coach and /profile/coach routes still select coach view immediately. Storage-disabled browsers retain route-based switching and use athlete view on neutral pages. No server cookie/account-preference column or new permission is needed.

The first typecheck found an inference error in a test fixture; an explicit ActorSnapshot annotation fixed it and the final typecheck passed. The first real rehearsal passed all six navigation phases and removed its exact fixture, then failed its final comparison because the temporary helper excluded null-linked seed profiles only from the initial snapshot. Corrected that helper to compare the same complete profile set. The final focused run passed with complete original-profile fingerprints preserved and exact owned-athlete cleanup. No application defect or profile mutation was inferred from the inconsistent test query.

Further repeat diagnostics: an immediate post-Back assertion read the old menu before React rendered the new pathname, so the helper now waits for visible link destinations. Later navigation timed out while local `app.owned_coach_calendar` reads queued on the existing scheduling advisory lock; read-only database diagnostics identified that dependency, and an unauthenticated Home request also timed out while the Auth endpoint still responded. Existing [DEV0277](../../current/backend/DEV0277-profile-and-reduce-coach-calendar-latency.md) owns calendar latency. Do not restart services, cancel another operation or expand this ticket into SQL optimization. Finish targeted role/history/storage/isolation verification using Events and Account while retaining the earlier actual Home/default-calendar evidence.

### Contracts, configuration, and operations

Presentation-only browser preference; no server identity/authority/schema/configuration change. Existing private routes and authorization stay authoritative.

## Validation results

2026-10-18, local Docker development at localhost:3100; no hosted operation.

- `npm test`: passed 246 application/unit and 34 server tests (280 total), log `/tmp/dev0333-tests.log`.
- Final `node --import tsx --test tests/account-menu.test.ts tests/shell-navigation.test.ts tests/message-shell.test.ts tests/workspace-view.test.ts`: all 18 passed after final test-fixture changes, log `/tmp/dev0333-navigation-final.log`.
- `npm run lint`, final `npm run typecheck` and `npm run format:check`: passed, logs `/tmp/dev0333-lint.log`, `/tmp/dev0333-types-final.log`, `/tmp/dev0333-format.log`.
- `env DATABASE_URL= NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= NEXT_PUBLIC_SITE_URL= NEXT_PUBLIC_GEOAPIFY_API_KEY= npm run build`: passed compile, TypeScript and 24 static pages, log `/tmp/dev0333-build.log`. Hosted settings were explicitly disabled.
- First `node /tmp/dev0333-browser.mjs`: six real navigation phases passed (1440px/393px, switching, actual destinations, keyboard, Home/reload/history, storage failure and same-browser account isolation). Final preservation comparison failed due to the helper filter described above. The owned temporary athlete was already deleted; existing compared profile hashes matched. The final focused run below supplies corrected complete-profile preservation and cleanup evidence.
- Visually inspected desktop and phone screenshots for both views: menu fits the viewport, labels/switch remain legible, Home stays first, and primary navigation contains only the selected destinations. No horizontal overflow observed. Local Next development indicator is present in phone screenshots; it is development-only chrome.
- `node /tmp/dev0333-focused.mjs --remaining`: passed all three focused final phases using actual local Auth, Events and Account: phone neutral-page/reload/Back/Forward, storage-unavailable route switching, and same-browser athlete/coach account isolation despite a forged preference. One exact tagged athlete was created, verified and deleted; complete before/after original-profile fingerprints matched and no page errors occurred. Log `/tmp/dev0333-focused.log`; result `/tmp/dev0333-browser-result.json`. Earlier real phases separately established Home/default-calendar switching, public-coach URL boundaries and both desktop/phone Profile/Trainings/Messages behavior. No calendar/performance fix is claimed. A test-only style hides Next development-tool chrome so its floating control cannot intercept the phone Home target; application markup is unchanged.
- Configuration-free `env DATABASE_URL= NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= NEXT_PUBLIC_SITE_URL= NEXT_PUBLIC_GEOAPIFY_API_KEY= npx --no-install playwright test tests/browser/auth.spec.ts tests/browser/authorization.spec.ts`: 6 passed and 2 configured-Auth guest tests skipped in public-preview mode. Actual signed-in/ordinary-account behavior was separately exercised locally above. Log `/tmp/dev0333-public-browser.log`.
- `python3 /tmp/dev0333-docs.py` and scoped `git diff --check`: passed local links, unique identifiers, next-ID consistency and current navigation wording. No database migration validation applies because no schema/authorization source changed. Temporary Daniel credential file removed; no credentials are stored in tracked evidence.

| Criterion | Evidence | Result |
| --- | --- | --- |
| AC1 | Menu render tests and actual desktop/phone screenshots/links show Trainings, original left labels/headings and Home first. | Passed |
| AC2 | All actor statuses in unit tests; real Daniel switches both ways; ordinary account remains athlete-only with a forged preference. | Passed |
| AC3 | Real default-workspace/Home and focused Events/Account history/reload/storage/isolation checks; exact public-route boundaries and selected Profile/Trainings/Messages destinations. | Passed |
| AC4 | 280 tests, 18 final focused tests, lint/types/format/build, 6 production smoke checks, actual responsive/keyboard checks, corrected fixture cleanup and document consistency. | Passed |

### Commit isolation review — 2026-10-18

Prepared a clean HEAD snapshot containing only DEV0326/DEV0327/DEV0333/DEV0334 and their shared navigation prerequisites, excluding concurrent authentication, coach website, session-type, preview and operational changes. Shared shell/menu/connection modules require one combined prerequisite commit; DEV0339 follows separately. Repository-relative Markdown links resolved in the isolated snapshot, and reserved identifiers for excluded work remain unavailable for reuse.

Fresh validation: `node --import tsx --test --test-concurrency=2 tests/*.test.ts` passed 281 tests; `node --import tsx --conditions=react-server --test --test-concurrency=2 tests/server/*.test.ts` passed 45 tests (326 total). `npm run lint` passed. `npm run typecheck` passed with the temporary copy's compiler process limited by `NODE_OPTIONS=--max-old-space-size=1024`; repository package/compiler configuration is unchanged. Logs: `/tmp/dev0339/commit-prerequisites-{unit-serial,server-serial,lint-serial,types-bounded}.log`. Initial sandboxed `npm test` could not open its local IPC socket; parallel unrestricted retries timed out in four existing startup/rehearsal-runner checks under resource pressure. The two-worker retries all passed. Stopped the stalled unrestricted typechecker and reran with the memory cap successfully. No application source change was needed. Existing recorded browser/build evidence remains applicable; no database, provisioning or mutation rehearsal was rerun for this commit.

## Risks, limitations, and follow-ups

Unrelated account, storage and marketplace changes were preserved. Browser preference is convenience, not a permission or cross-device setting; storage-disabled neutral pages default to athlete view. Known calendar loader latency/advisory-lock queueing remains independently tracked in [DEV0277](../../current/backend/DEV0277-profile-and-reduce-coach-calendar-latency.md); this navigation change does not resolve it. No hosted/UAT deployment or independent review is claimed.

## Completion and review references

- Completed: 2026-10-18 — selected-view navigation, Trainings naming, real responsive/keyboard checks and exact fixture cleanup verified.
- Commit: Included in `[DEV0326][DEV0327][DEV0333][DEV0334] Complete workspace navigation foundations`; these completed prerequisites share the shell, menu and connection-view modules required by DEV0339.
- Review: Scope, capability/route/storage boundaries, responsive disclosure behavior and acceptance evidence self-reviewed; no independent review.
- Deployment or release: None.
