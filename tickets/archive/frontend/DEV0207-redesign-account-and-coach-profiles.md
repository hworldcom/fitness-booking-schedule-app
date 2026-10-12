# Ticket DEV0207: Redesign account and coach Profiles

- Status: Completed
- Created: 2026-10-12
- Last updated: 2026-10-12
- Milestone: Scheduling interface authenticated-workspace follow-up
- Coordination: [COR0018 — Authenticated workspace redesign](../../current/organisatory/COR0018-authenticated-workspace-redesign.md)
- Related records: completed contract [DEV0202 — Adopt the authenticated workspace redesign contract](../../archive/organisatory/DEV0202-adopt-authenticated-workspace-redesign-contract.md), completed shell dependency [DEV0203 — Introduce the authenticated workspace shell](../../archive/frontend/DEV0203-introduce-authenticated-workspace-shell.md), completed coach-frame dependency [DEV0205 — Redesign coach Schedule](../../archive/frontend/DEV0205-redesign-coach-schedule.md), image baseline [COR0012 — Profile images](../../archive/organisatory/COR0012-profile-images.md) and location baseline [DEV0178 — Manage coach training locations](../../archive/frontend/DEV0178-manage-coach-training-locations.md)

## Objective and context

Align personal account Profile and coach Profile/location editing with the approved authenticated interface while keeping the two identities and media scopes unmistakably separate.

## Scope and non-goals

- In scope: personal Profile heading/summary/avatar form, coach Profile active-tab frame, public-profile editor/preview, public portrait controls, training-location manager/map and publication/application states.
- Out of scope: identity/schema changes, new profile fields, merging private avatar with public portrait, provider changes or schedule/booking redesign.

## Expected behavior and edge cases

- Account-avatar navigation always opens personal Profile; approved/demo main Profile navigation opens coach Profile.
- Personal avatar remains private account presentation; coach portrait remains explicitly public media with initials fallback.
- Coach Profile is the first stable coach tab and keeps Profile/Schedule/Bookings navigation above the view-specific hero/content.
- Location list/map and primary-location semantics remain complete during map/search failure and on narrow screens.

## Assumptions, decisions, and dependencies

- DEV0203 supplies the shell; DEV0205 supplies shared coach page framing.
- Existing upload normalization, access gates, profile actions and location services remain authoritative.
- The preview's unsourced name/timezone editing and public-preview fields will not be added unless already backed by current contracts.

## Implementation plan

1. Recompose personal Profile as an authenticated account heading plus editor/summary layout using only the existing display identity, private-avatar and coach-entry contracts.
2. Extract the existing Schedule/Bookings workspace heading into a shared coach component, place it before the stable Profile/Schedule/Bookings tabs on every coach view, and remove the Profile-only legacy green hero.
3. Add a truthful read-only public-profile preview from current coach data and recompose portrait, profile-form and location-manager surfaces without changing their actions.
4. Extend media-scope, actor-routing, location-action, provider-failure and responsive browser tests.
5. Run relevant application/static/build validation and inspect desktop/mobile evidence.

## Acceptance criteria

- [x] AC1: Personal and coach Profiles use the authenticated visual system while retaining distinct routes, authority and image privacy.
- [x] AC2: Coach Profile remains the first stable coach tab and profile/location actions keep existing behavior.
- [x] AC3: Missing images, application/suspension, provider failure and mobile layouts retain complete truthful controls/content.
- [x] AC4: Relevant tests, lint, type-check, formatting and build pass.

## Validation plan

- Extend route/component tests for actor-aware Profile destinations and public/private image boundaries.
- Run authenticated client/coach Playwright for profile/avatar/portrait/location ready/failure states at mobile/desktop widths.
- Run application tests and static/build checks.

## Implementation record

Implementation started and completed on 2026-10-12 after DEV0205 established the shared coach frame. Signed-in review confirmed that account Profile and coach Profile/location editing still used the legacy cover/green-heading presentation even though their surrounding authenticated shell had already been redesigned.

### Changes and rationale

- Replaced the account Profile cover and overlapping identity block with an authenticated `Profile.` heading, a private-avatar editor and a dark account summary. The summary derives role, image source and session access from existing actor data and does not pretend that unsupported identity fields are editable.
- Kept the private account avatar and public coach portrait as separate upload contracts. Clear explanatory copy states where each image is used, while the existing fallback order still permits a public portrait or initials to represent an account that has no private avatar.
- Extracted the existing coach workspace heading into one shared component and placed it before the stable `Profile → Schedule → Bookings` navigation on Profile as well as Schedule/Bookings. This removes the Profile-only green heading and keeps the navigation in one consistent coordinate.
- Added a read-only coach profile preview derived only from the current coach projection: actual portrait/initials, publication state, disciplines, bio, primary active location and number of other active places. No concept-only name, email, headline or timezone fields were fabricated.
- Reorganized public portrait controls, profile fields and location management into responsive editor/preview sections. The owner location overview reuses the established color-keyed map/list component and retains the full persisted list when map tiles fail.
- Extended live profile-image rehearsal coverage for the new hierarchy, desktop/mobile overflow and screenshots. The cleanup now mutates and removes only a fixture avatar created by that run, so an existing user-owned avatar is preserved.

### Affected files

| File or component                                                                                            | Change and purpose                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/profile/profile.tsx`                                                                           | Rebuilds personal Profile around the private-avatar editor and bounded account summary; exports the deterministic role-label helper used by tests.             |
| `src/features/coaches/coach-workspace-header.tsx`                                                            | Centralizes the truthful owner greeting, publication state and conditional public-profile link shared by all coach views.                                      |
| `src/features/coaches/coach-profile-preview.tsx`                                                             | Renders a real-data, read-only preview of the coach's public presentation or private draft.                                                                    |
| `src/features/coaches/coach-profile-editor.tsx`                                                              | Reorders shared heading/tabs, composes portrait/form/preview content and adds the existing color-keyed location overview without changing mutations.           |
| `src/features/coaches/coach-availability-panel.tsx`                                                          | Reuses the extracted shared coach heading so Schedule and Profile keep the same page order.                                                                    |
| `src/app/authenticated-workspace.css`                                                                        | Adds responsive account Profile editor/summary styling within the authenticated visual system.                                                                 |
| `src/app/coach-workspace.css`                                                                                | Adds responsive coach Profile, preview and location-overview styling while retaining the fixed mobile workspace navigation.                                    |
| `tests/profile-navigation.test.ts`                                                                           | Verifies every coach-access state receives a truthful account role label without merging account and coach identity.                                           |
| `tests/coach-schedule.test.ts`                                                                               | Verifies the shared coach heading and current-data coach preview, including publication and initials fallbacks.                                                |
| `scripts/rehearse-local-profile-images.mjs`                                                                  | Exercises private/public upload boundaries plus desktop/mobile Account and Coach Profile layout, DOM order, overflow, screenshots and non-destructive cleanup. |
| `scripts/rehearse-local-email-auth.mjs`                                                                      | Aligns the authenticated-account assertion with the redesigned `Email-backed MovX identity` copy.                                                              |
| `tickets/archive/frontend/DEV0207-*.md`, `tickets/current/organisatory/COR0018-*.md` and `tickets/README.md` | Preserve this implementation/validation record, complete DEV0207 and make the final DEV0208 integration pass ready.                                            |

### Decisions and deviations

- 2026-10-12: Do not reproduce the concept's editable first/last name, email, headline or account timezone fields because the current product has no such mutation contracts. Present the existing bounded account identity instead.
- 2026-10-12: Reuse one extracted coach workspace header across Profile, Schedule and Bookings so the stable tabs occupy the same coordinate and order on every coach view.
- 2026-10-12: Reuse `CoachProfileLocations` for the owner overview rather than introducing a second map implementation. Location identity therefore remains text-and-color keyed, and the list remains authoritative if OpenFreeMap tiles are unavailable.
- 2026-10-12: Treat a pre-existing account avatar as user-owned rehearsal state. Upload/removal checks run only when the account begins without an avatar, and cleanup removes only the test-owned fixture.

### Contracts, configuration, and operations

No schema, API, data shape, environment variable, dependency, migration or deployment operation changed. Existing `/api/profile/avatar` and `/api/coach/portrait` boundaries, actor projections, coach profile/location actions and map provider adapter remain authoritative.

## Validation results

- `npm exec -- tsx --test tests/profile-navigation.test.ts tests/coach-schedule.test.ts` passed 12 focused component/domain tests.
- `npm test` passed 124 unit/component tests and 9 React-server tests under Node 24.21.0.
- `npm run test:profile-images` passed against local Supabase Auth/PostgreSQL and the development server. It verified account upload/removal, coach portrait upload/removal, both shell icons, image fallback precedence, Account/Coach Profile hierarchy, heading/tab/content order, desktop/mobile screenshots and no horizontal overflow.
- `npm run test:auth`, `npm run test:coach-locations`, `npm run test:coach-availability` and `npm run test:coach-requests` passed their existing actor, location, schedule, request, keyboard and responsive workflows after the redesign.
- `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres npm exec -- playwright test tests/browser/coach-discovery.spec.ts --grep 'selected coach profile location stays|coach profile keeps its complete'` passed four desktop/mobile map anchoring and provider-failure checks.
- Manual screenshot review passed for `test-results/profile-workspace-rehearsal/account-profile-desktop.png`, `account-profile-mobile.png`, `coach-profile-desktop.png` and `coach-profile-mobile.png`; the persistent mobile navigation remained visible and neither profile overflowed horizontally.
- `npm run lint`, `npm run typecheck`, `npm run format:check`, `git diff --check` and `npm run build` passed. Next.js 16.3.8 generated all application routes successfully.
- The first profile-image rehearsal exposed a destructive assumption in the legacy cleanup: `hoang@users.movx.test` already had a private avatar, the old initial-null assertion failed, and its unconditional cleanup removed that local Storage object. No recoverable local object remained. The rehearsal was hardened before its passing run so pre-existing avatars are no longer changed.
- An exploratory broader public coach-profile selection first failed because `next start` had no `DATABASE_URL`; with the required local database environment, map anchoring and provider-failure cases passed. The unrelated guest CTA assertion still expects pre-redesign public copy and remains part of the final public/integration accessibility work, not this ticket's private Profile behavior.

| Criterion | Evidence                                                                                                                                                                                                        | Result |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Account/coach screenshots, role tests and live upload rehearsal show distinct routes, current actor authority and separate private-avatar/public-portrait handling.                                             | Passed |
| AC2       | Static markup and live DOM-order assertions show one shared heading followed by Profile/Schedule/Bookings, with Profile selected; profile, portrait and location actions completed unchanged.                   | Passed |
| AC3       | Initials and role-state component cases, 393px live layouts, location rehearsal and four desktop/mobile map anchoring/provider-failure checks preserve truthful content and controls.                           | Passed |
| AC4       | 133 application tests, focused tests, five authenticated rehearsals, targeted Playwright, lint, type generation/TypeScript, formatting, diff check and production build passed under the required Node release. | Passed |

## Risks, limitations, and follow-ups

- Visual reuse must not blur the private account-avatar and public coach-portrait boundaries.
- Geoapify search remains optional; manual location entry and persisted lists remain the fallback.
- The account Profile intentionally summarizes the existing verified identity instead of offering unsupported name/email/headline/timezone mutation. New identity fields require a separate data-contract ticket.
- DEV0208 owns the complete cross-route accessibility/browser matrix and any stale assertions left by earlier public/authenticated redesign slices.

## Completion and review references

- Completed: 2026-10-12.
- Commit: Included with the implementation commit whose subject references DEV0207.
- Review: No review created.
- Deployment or release: Not deployed or released.
