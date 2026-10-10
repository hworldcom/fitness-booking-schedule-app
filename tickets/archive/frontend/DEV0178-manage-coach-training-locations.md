# Ticket DEV0178: Manage coach training locations

- Status: Completed
- Created: 2026-10-09
- Last updated: 2026-10-10
- Milestone: Scheduling-only multi-location follow-up
- Coordination: [COR0014 — Multi-location coach scheduling](../../current/organisatory/COR0014-multi-location-coach-scheduling.md)
- Related records: depends on completed [DEV0175 — Adopt the multi-location coach scheduling contract](../organisatory/DEV0175-adopt-multi-location-coach-scheduling-contract.md), [DEV0176 — Persist coach training locations](../backend/DEV0176-persist-coach-training-locations.md) and [DEV0177 — Bind availability to training locations](../backend/DEV0177-bind-availability-to-training-locations.md); supplies [DEV0179 — Edit a location-aware working week](../../current/frontend/DEV0179-edit-location-aware-working-week.md) and [DEV0180 — Pin coaches at primary locations](../../current/frontend/DEV0180-pin-coaches-at-primary-locations.md); reuses the provider-neutral location interface from [DEV0174](DEV0174-decouple-location-services.md)

## Objective and context

Replace the coach Profile's single training-place field with an accessible location manager. Approved/demo coaches and eligible applicants can add multiple gym or independent locations, inspect their status, edit bounded public metadata, select one active primary location and safely deactivate locations. Public profiles show all active training locations without implying live presence.

## Scope and non-goals

- In scope: owner Profile location list/cards; add/search/manual-confirm flow through the existing provider-neutral module; explicit edit/save; primary selection; safe deactivate/replacement interaction; ordering and status feedback; publication gating; all-active-locations public profile section; pending/rejected/approved/suspended capability handling; responsive, keyboard and failure-state tests.
- Out of scope: persistence and mutation authority (DEV0176), schedule assignment (DEV0179), Explore map rendering (DEV0180), global point-of-interest administration, gym ownership, live location, image changes, travel times or native UI.

## Expected behavior and edge cases

- The owner sees every active location and any inactive location needed for bounded historical context, with one unambiguous Primary badge.
- Adding a location uses a reviewed gym choice, storage-permitted provider result or manual confirmation through the provider-neutral boundary; map/search failure leaves manual entry usable.
- Location edits remain local until an explicit save. Loading, conflict, validation and unavailable states do not present unsaved input as persisted.
- Selecting a new primary saves atomically and updates the badge. The interface never allows two primaries.
- Deactivating a non-primary location explains the effect on future open availability. A primary requires selecting a replacement in the same flow.
- The interface does not offer destructive deletion for referenced locations and does not expose database/provider identifiers as authority.
- A visible profile cannot be published without one confirmed active primary location. Pending/rejected applicants may prepare only the contract-approved private draft; suspended coaches cannot publish location changes.
- The public coach profile lists all active locations and clearly labels the primary one. It does not expose inactive locations or claim the coach is presently there.

## Assumptions, decisions, and dependencies

- DEV0176 provides authorized location mutations and multi-location projections; the browser never writes tables directly.
- DEV0177 provides the atomic deactivation behavior used by the interface: future open availability is withdrawn, booked history retains its immutable actual-location snapshot and a primary replacement is selected in the same mutation.
- Reuse `src/location/` contracts and components. UI code may depend on the provider-neutral boundary but not directly on Geoapify, OpenFreeMap or MapLibre implementations.
- Adopted: present compact location cards ordered primary first and then stable coach order, with separate `Set as primary`, `Edit` and `Deactivate` actions. Progressive disclosure keeps the default mobile view concise and native buttons/fields preserve keyboard order.
- Adopted: pending and rejected applicants may manage confirmed locations only inside their private draft; approved/demo coaches may expose active locations by publishing the profile. Suspended and unrelated accounts receive no location editor or mutation authority.
- Adopted: an existing profile's identity/visibility form no longer exposes the singleton location field. Its compatibility payload preserves the current primary snapshot so profile edits do not select a different location; all visible location changes go through the versioned DEV0176 mutations.
- Adopted: a coach-owned external search selection stores a bounded snapshot only; it does not add a shared `app.gyms` catalogue record.
- One coach scheduling timezone remains visible at profile level. This ticket does not provide a separate recurrence timezone per location.

## Implementation plan

1. Keep the initial profile bootstrap capable of creating its first confirmed primary location, then replace the singleton editor for existing profiles with a list/manager using stable location IDs and explicit action states.
2. Reuse the existing search/map/manual picker in independent create/edit forms and reviewed-gym select in gym forms.
3. Add validated server actions for create, edit, primary replacement and deactivate flows, with optimistic-version conflicts, unavailable states and truthful schedule-impact copy.
4. Preserve the current primary snapshot when the separate profile identity/visibility form saves, and keep publication gating tied to approval plus a confirmed active primary.
5. Present all active locations on the public coach profile with primary labeling and explicit primary-base/not-live-presence copy.
6. Add focused domain/component/action-boundary and browser coverage plus desktop/mobile/keyboard evidence, then run database regression, lint, type, format and build checks.

## Acceptance criteria

- [x] AC1: An authorized coach can add and edit multiple confirmed locations through provider-neutral search or manual fallback, with no mutation before explicit save.
- [x] AC2: The coach can choose exactly one primary location and cannot deactivate it without a valid replacement; conflicts preserve recoverable input.
- [x] AC3: Capability and publication gates prevent unauthorized, suspended or incomplete profiles from publishing location changes.
- [x] AC4: The public profile shows all and only active locations, labels the primary location and never implies live presence or global gym ownership.
- [x] AC5: Responsive desktop/mobile, keyboard, error-state, component/action, lint, type and build checks pass.

## Validation plan

Add focused validation/action/component tests and browser scenarios for approved, pending, rejected, suspended and unrelated accounts. Rehearse add via search, manual fallback, edit, set-primary, attempted primary deactivation, replacement plus deactivation, stale conflict, service failure and reload. Verify desktop and mobile widths, labels/focus order, keyboard-only control and public-profile output. Run relevant unit, lint, type and build commands.

## Implementation record

Completed on 2026-10-10. Existing coaches now manage a primary-first list of active and inactive training locations below the separate profile-details form. The owner can add a reviewed gym or explicitly confirmed provider-neutral place, edit it locally before saving, atomically select a different primary, and deactivate a location with the required primary replacement. Public profiles list only active locations and distinguish the primary training base from live presence or an actual session venue.

### Changes and rationale

- Replaced the existing coach's singleton training-place editor with a progressive-disclosure location manager. The initial profile-creation form still collects one confirmed primary location because the owner-scoped location entity cannot exist before its coach profile; after bootstrap, all visible location changes use DEV0176's stable ID and optimistic-version mutations.
- Kept public identity, disciplines, one scheduling timezone and visibility in the profile-details form. Its hidden compatibility payload reflects the current primary snapshot, preventing profile edits from implicitly selecting a different location while the legacy profile columns remain synchronized during COR0014.
- Added independent add/edit forms that reuse the existing provider-neutral search, attribution, draggable confirmation and manual-coordinate fallback. Reviewed-gym forms store the reviewed snapshot and make no ownership claim. All fields remain local until the form's explicit Add or Save action.
- Added bounded server actions for create, edit, set-primary and deactivate intents. IDs, timestamps, confirmation and provider-neutral inputs are validated before service calls; current route, Explore and public profile data are revalidated only after a saved mutation.
- Corrected conflict propagation across the authorized transaction boundary. PostgreSQL errors abort the transaction before commit, so the authorization wrapper now has an opt-in predicate that rethrows only a recognized domain conflict after rollback. Training-location service code catches that error outside the transaction and returns `conflict`, allowing the UI to preserve controlled input instead of misreporting a generic outage. All other authorization errors retain the existing fail-closed mapping.
- Lifted deactivation feedback to the manager level because the successful mutation removes the active card that originally owned the message. The manager retains success/conflict feedback after the refreshed location list is rendered.
- Added public active-location cards and truthful copy. The header names the primary training base as not live, the section labels exactly one `Primary base`, and inactive owner history never renders publicly.
- Added a repeatable local browser rehearsal for add, edit, a genuine two-page stale edit, primary selection, public presentation, mobile overflow, keyboard focus and safe deactivation. It removes only unreferenced local records with the exact `DEV0178 …` prefix after restoring the fixture primary, so database suites retain their deterministic five-location baseline.

### Affected files

| File or component                                                          | Change and purpose                                                                                                                                                            |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/coaches/coach-profile-editor.tsx`                            | Separates profile details from location management, retains the initial-primary bootstrap and supplies current primary compatibility values for later profile-only saves.     |
| `src/features/coaches/coach-training-location-manager.tsx`                 | Implements primary-first owner cards, provider-neutral add/edit forms, atomic primary selection, safe deactivation/replacement and collapsed inactive history.                |
| `src/app/profile/coach/actions.ts`                                         | Validates and dispatches the four location mutation intents with bounded saved, invalid, conflict and unavailable states plus targeted route revalidation.                    |
| `src/server/coaches/service.ts`                                            | Returns the owner slug for revalidation and maps a rolled-back training-location conflict to a recoverable authorized outcome.                                                |
| `src/server/authorization/service.ts`                                      | Adds an internal opt-in error predicate so a caller can preserve a recognized domain error after the actor transaction rolls back; default fail-closed behavior is unchanged. |
| `src/features/coaches/coach-discovery.tsx`                                 | Presents all active public locations, identifies the primary base and explains that locations are not live presence.                                                          |
| `src/app/coach-discovery.css`                                              | Adds responsive manager, card, form, status, inactive-history and public-location styles with visible keyboard focus.                                                         |
| `tests/coach-trust.test.ts`, `tests/server/coach-location-actions.test.ts` | Covers active-only public projection and bounded action rejection for unconfirmed, malformed and forged inputs.                                                               |
| `tests/browser/coach-discovery.spec.ts`                                    | Scopes repeated location text to the primary header and location region and verifies the new primary public label.                                                            |
| `scripts/rehearse-local-coach-locations.mjs`, `package.json`, `README.md`  | Adds and documents `npm run test:coach-locations`, its local-only prerequisites, responsive evidence and bounded cleanup.                                                     |

### Decisions and deviations

- 2026-10-10: Kept first-profile location collection in the bootstrap form rather than presenting an unusable empty manager before a coach profile exists. Existing profiles receive only the manager. This preserves onboarding while removing the singleton field from ongoing location management.
- 2026-10-10: Used stable primary-first ordering rather than adding manual drag/reorder controls. The product contract requires one primary and truthful stable presentation but does not define coach-controlled arbitrary order; manual ordering would introduce an unplanned persistence contract.
- 2026-10-10: Kept pending/rejected management as private-draft preparation. The same actions are authorized for eligible applicants, but visibility remains hidden and public queries expose only approved/demo visible profiles. Suspended users remain on the existing gate and the service rejects direct mutation attempts.
- 2026-10-10: Added the narrow authorization error pass-through after the stale-browser rehearsal proved that an expected PostgreSQL conflict was being converted to `unavailable` at transaction commit. The pass-through is caller-selected and recognizes only `CoachTrainingLocationConflictError`; unrelated failures remain unavailable.
- 2026-10-10: No schema migration was needed. DEV0176/DEV0177 already owned lifecycle, primary replacement, schedule withdrawal and immutable history, so this ticket stayed one reviewable interface/action slice.

### Contracts, configuration, and operations

Consumes DEV0176's `CoachTrainingLocation`/mutation contracts, DEV0177's deactivation behavior and the existing optional Geoapify configuration. The new server-action state is `idle | saved | invalid | conflict | unavailable`; optimistic mutations carry stable location IDs and `updatedAt` timestamps. `withAuthorizedActor` and `withAuthorizedSession` gained an optional internal `rethrow(error)` predicate, with no change for existing callers. `npm run test:coach-locations` is a new local-only validation command and accepts optional `COACH_LOCATION_TEST_SITE_URL`, `COACH_LOCATION_TEST_MAILPIT_URL` and `COACH_LOCATION_TEST_DATABASE_URL`; its cleanup rejects non-loopback databases and port values other than `55322`. No database schema, environment variable required by the application, provider key, browser secret or deployment operation changed.

## Validation results

- Date and environment: 2026-10-10, macOS local workspace, required Node.js `24.21.0`, npm `11.19.0`, Next.js `16.3.8`, local Supabase PostgreSQL/Auth/Storage/Mailpit and Chrome through Playwright.
- `npm run test:coach-locations` passed. It signed in as the provisioned Daniel Park demo owner; keyboard-opened Add; added and edited a manually confirmed provider-neutral place; produced a real two-page stale edit; observed recoverable conflict copy and the retained unsaved name; changed primary; verified both public locations and primary/not-live copy; checked desktop and 393 × 852 mobile overflow; deactivated with an atomic fixture replacement; verified public omission; and removed all unreferenced `DEV0178 …` rehearsal rows. Evidence is under ignored `test-results/coach-location-rehearsal/`.
- `npm test` passed 90 unit/component tests plus 5 server tests. This includes active-only public location presentation and create/update/primary/deactivate action-boundary coverage.
- `npm run test:db` passed 37 serialized database integration tests, including cross-owner isolation, stale optimistic versions, atomic primary replacement, soft deactivation and location-aware availability/history.
- `npm run db:test` passed all 184 pgTAP assertions after the rehearsal cleanup restored the deterministic fixture count; `npm run db:lint` reported no schema errors.
- `npm run lint`, `npm run typecheck`, `npm run format:check` and `git diff --check` passed.
- A fully configured local `npm run build` passed under Node.js 24.21.0. The configuration supplied the loopback database/Auth values only to the command and used canonical `NEXT_PUBLIC_SITE_URL=http://localhost:3101`; no value was written or logged into the ticket.
- The same configured production build passed `npm run test:e2e`: 28/28 browser tests at desktop and mobile widths. The profile test now scopes the duplicated gym name to the primary header and the all-active-locations region.
- Visual review of `owner-desktop.png`, `owner-mobile.png` and `public-mobile.png` confirmed primary/status visibility, progressive disclosure, mobile single-column layout, public active-location cards and no horizontal overflow.
- Earlier browser attempts were intentionally not counted as final evidence: configuration-free execution correctly failed closed for database-backed coach expectations; a database-only run exposed partial Auth configuration; and the first full-config attempt used `127.0.0.1` as the site URL, which the existing canonical Auth policy rejects. Rebuilding with literal `localhost` produced the final 28/28 pass.

| Criterion | Evidence                                                                                                                                                            | Result |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Authenticated add/edit/manual-confirm rehearsal; validation tests; explicit action buttons; no per-field action requests                                            | Passed |
| AC2       | Two-page stale-conflict rehearsal with retained input; atomic primary/deactivation browser flow; DEV0176/DEV0177 database tests                                     | Passed |
| AC3       | Existing application/suspension gates, service capability check, hidden applicant copy, configured guest/authorization browser suite                                | Passed |
| AC4       | Public component test omits inactive history; public browser rehearsal and desktop/mobile E2E show every active location and exactly labelled primary/not-live copy | Passed |
| AC5       | Keyboard focus and responsive rehearsal, 28 browser tests, 95 unit/server tests, lint, type, format and production build                                            | Passed |

## Risks, limitations, and follow-ups

The manager deliberately does not restore inactive locations or provide arbitrary manual ordering; inactive rows remain collapsed historical context, while primary-first plus stable coach order controls active presentation. A long inactive history may eventually need pagination. Profile-detail saves retain the synchronized legacy primary snapshot until COR0014 removes that compatibility boundary. DEV0179 remains responsible for assigning calendar cells to active locations and showing schedule consequences; DEV0180 remains responsible for moving Explore to the selected primary entity rather than the compatibility alias. Search-provider attribution and manual fallback remain governed by DEV0174.

## Completion and review references

- Completed: 2026-10-10 — multi-location owner management, public active-location presentation, recoverable conflicts and responsive validation passed.
- Commit: Created with subject `[DEV0178] Manage coach training locations` after the user requested the completed implementation be committed.
- Review: Self-review against all five acceptance criteria completed; no independent review or pull request created.
- Deployment or release: Not deployed or released.
