# Ticket DEV0031: Preview data and domain boundaries

- Status: Completed
- Created: 2026-09-20
- Last updated: 2026-09-20
- Milestone: Cross-cutting application foundation
- Coordination: [COR0001 — Project structure](../../current/organisatory/COR0001-project-structure.md)
- Related records: direct peer development ticket tracked by [Coordination COR0001 — Project structure](../../current/organisatory/COR0001-project-structure.md); follows completed peer [DEV0030 — Frontend screen module boundaries](DEV0030-frontend-screen-module-boundaries.md); prepares clean contracts for [DEV0015 — Database foundation](../backend/DEV0015-supabase-database-foundation.md) and COR0006 — Persistent access catalogue, converted from retired DEV0017

## Objective and context

Separate the mixed modules currently under `src/lib` into framework-independent domain contracts/rules, feature-owned discovery logic, and an explicitly browser-only local-preview boundary. Make later persistence work able to replace preview adapters without treating fixture records, browser storage or database rows as shared business contracts.

Today `fixtures.ts` and `events.ts` combine types, validation and seeded records; `demo.ts` combines preview state transitions with those records; `discovery.ts` and `explore.ts` contain feature query logic; and `store.ts` owns React/browser persistence. Their behavior is tested, but the generic directory does not communicate these different dependency and authority boundaries.

## Scope and non-goals

- In scope: extract shared catalogue/event contracts and reusable deterministic rules under `src/domain`; move discovery-owned search/filter logic under `src/features/discovery`; move seeded fixture data, derived preview discovery data, local state and the React/localStorage adapter under `src/features/preview`; separate shared presentation formatting from fixture data; remove feature dependencies from shared components; update all imports and tests; remove the obsolete `src/lib` modules; and add automated boundary checks.
- Out of scope: changing fixture values or IDs, storage schema/key, filtering/search semantics, event/challenge validation, UI layout, adding database repositories or network calls, migrating localStorage, implementing authentication/wallet behavior, or deleting the explicit local preview.

## Expected behavior and edge cases

Framework-independent domain modules import neither React, Next.js, browser APIs, fixture data nor server/database modules. Preview adapters may depend on domain contracts but remain visibly non-authoritative. Discovery operations consume domain contracts and supplied records; only the preview boundary acquires seeded records. Shared components consume domain types, values and callback/data props without importing a feature module. Browser storage continues using `repx-club-preview-v1`, resets malformed state safely, falls back to memory when unavailable and preserves current subscriptions.

Every seeded identifier, date, amount, label and relationship remains unchanged. Existing validation, filtering, search, booking, cancellation, sharing, hiding and draft transitions return the same results. Database work can later map rows into domain/view contracts without importing preview fixtures.

## Assumptions, decisions, and dependencies

This is a dependency-boundary refactor, not a domain redesign. Prefer explicit cohesive modules over another generic `lib` or catch-all types file. DEV0030 is complete: preserve its delivered route, feature-screen and shared-component locations rather than reopening those moves. Updating a shared component's props to remove feature ownership is in scope; moving a completed screen is not.

This ticket is categorized as frontend because it moves current preview modules. The resulting `src/domain` boundary is shared pure code with no browser, server, database or chain authority. `Draft`, `DraftInput` and their validation are challenge-domain contracts. `DemoState`, `DemoAction`, `Booking`, the reducer/parser and initial state describe the local preview implementation and therefore remain under `src/features/preview`; the reducer may read the preview class catalogue to preserve the existing membership-booking guard. Event records and validation are domain contracts, while the seeded `events` array is preview data. Currency and date formatting are presentation helpers rather than domain rules.

Discovery data dependencies become explicit. The preview boundary exports a derived `previewDiscoveryCatalogue` built from its seeded classes, studios, events and challenges. `searchCatalogue` and `relatedActivities` accept that catalogue as their first argument instead of importing fixtures. Filters continue accepting their record collections. No old `src/lib` compatibility barrels or re-exports will remain: this private application can update every source and test import atomically, and retaining aliases would hide boundary violations.

DEV0030 is the only prerequisite and is completed. DEV0015 and DEV0017 consume the resulting contracts later and do not block this refactor. There are no unresolved product or architecture decisions preventing implementation.

## Planned file and export map

| Current source/export                                                                                                              | Target                                                           | Planned contract                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/fixtures.ts`: `Discipline`, `ChallengeMode`, `ClubChallenge`, `ClubClass`, `ClubStudio`                                   | `src/domain/catalogue.ts`                                        | Preserve the existing record shapes and literal unions. Preview records and persistence rows depend on these contracts rather than defining replacements.                                |
| `src/lib/fixtures.ts`: `challenges`, `classes`, `studios`, `people`; `src/lib/events.ts`: `events`                                 | `src/features/preview/catalogue.ts`                              | Preserve every seeded value, identifier, date, amount, label, order and relationship. These records remain explicitly non-authoritative preview data.                                    |
| `src/lib/fixtures.ts`: `formatEurc`; `src/lib/discovery.ts`: `challengeDate`; `src/lib/events.ts`: `eventDate`                     | `src/components/format.ts`                                       | Keep the current locale, currency, timezone and rendered output. These are shared presentation helpers and perform no data acquisition.                                                  |
| `src/lib/events.ts`: `ClubEvent`, `EventDraftInput`, `EventDraft`, `validateEventDraft`, `isEventDraft`, `eventFromDraft`          | `src/domain/events.ts`                                           | Preserve all input/output shapes, validation messages, limits and mapping behavior.                                                                                                      |
| `src/lib/demo.ts`: `Draft`, `DraftInput`, `validateDraft`; `src/lib/discovery.ts`: `ChallengeSort`, `discoverChallenges`           | `src/domain/challenges.ts`                                       | Keep challenge draft validation and deterministic challenge selection/sorting reusable by later adapters. `discoverChallenges` continues accepting the candidate collection explicitly.  |
| `src/lib/explore.ts`: `ActivityFilter`, `TimeFilter`, `ClassFilters`; `src/lib/discovery.ts`: `DiscoveryItem`, `relatedActivities` | `src/domain/discovery.ts`                                        | Keep shared discovery contracts and the reusable related-item selector pure. Change `relatedActivities` to `(catalogue, activity, excludeHref, venueId?)`; it must not acquire fixtures. |
| `src/lib/explore.ts`: `ACTIVITIES`, `TIME_OPTIONS`                                                                                 | `src/components/discovery-filters.tsx`                           | Keep the current option values, labels and order beside the controls that render them; export them only if a current consumer or test still requires the export.                         |
| `src/lib/explore.ts`: `filterClasses`, `filterStudios`, `filterEvents`                                                             | `src/features/discovery/filters.ts`                              | Preserve query trimming, activity/date/time boundaries, ordering and case-insensitive matching. Inputs remain explicit collections plus filter values.                                   |
| `src/lib/discovery.ts`: `searchCatalogue`                                                                                          | `src/features/discovery/queries.ts`                              | Change the signature to `(catalogue, query)`. Preserve Unicode normalization, all-terms matching, blank-query behavior and result order.                                                 |
| `src/lib/discovery.ts`: `publicCatalogue` and its fixture mapping                                                                  | `src/features/preview/discovery.ts`: `previewDiscoveryCatalogue` | Replace the zero-argument fixture-acquiring function with a derived preview value. Preserve item kinds, text, URLs, venue relationships and exclusion of private browser drafts.         |
| `src/lib/demo.ts`: `Booking`, `DemoState`, `INITIAL_STATE`, `DemoAction`, `reduceDemo`, `parseDemo`, `visibleBookings`             | `src/features/preview/state.ts`                                  | Preserve reducer transitions, validation/recovery, serialized version `1`, initial following state, visibility rules and the membership-class booking guard.                             |
| `src/lib/store.ts`: `dispatch`, `useDemo`, storage key and subscription implementation                                             | `src/features/preview/store.ts`                                  | Preserve the `repx-club-preview-v1` key, same-tab notifications, cross-tab storage handling, server snapshot and in-memory fallback. Keep the module browser-only.                       |
| Preview-aware root-shell composition                                                                                               | `src/features/preview/preview-shell.tsx`                         | Read preview storage state and pass `storageUnavailable` into the shared `Shell`; `src/app/layout.tsx` composes this adapter.                                                            |

After every importer moves, delete all six former modules under `src/lib`; do not leave compatibility files.

## Shared-component integration changes

- Keep `ChallengeCard` in `src/components/ui.tsx`, but make it presentational: accept `saved` and `onToggleSaved` props and remove its `useDemo` import. Existing Feed, Profile and Challenge feature owners already read preview state and will pass those values.
- Keep `Shell` in `src/components/shell.tsx`, add a `storageUnavailable` prop and remove its `useDemo` import. `PreviewShell` owns the preview hook and root composition.
- Keep `RelatedActivities` and `CopyLink` in `src/components/discovery-extras.tsx`. `RelatedActivities` receives already-selected `DiscoveryItem` records; Event and Challenge features select them with the pure domain helper and `previewDiscoveryCatalogue`. It neither acquires fixtures nor imports discovery/preview features.
- Keep the shared discovery controls in `src/components/discovery-filters.tsx`. Their option lists remain presentation data and their prop types come from `src/domain/discovery`.
- Update route adapters to import seeded records from the explicit preview catalogue. Do not move any completed DEV0030 screen or introduce feature-to-feature imports.

## Implementation plan

1. Mark this ticket `In progress`, run the existing unit suite as a behavioral baseline, and confirm the current export/import inventory against the map above before editing source.
2. Create the pure catalogue, challenge, event and discovery domain modules. Move only the listed contracts and deterministic rules, preserving names and behavior except for the documented explicit-catalogue parameter.
3. Create the preview catalogue, derived discovery catalogue, state, store and root-shell adapter. Preserve fixture data and the complete localStorage/state contract.
4. Move discovery filters and search into their planned feature modules. Update them to receive record collections explicitly and keep preview acquisition outside discovery operations.
5. Move presentation formatters and refactor `ChallengeCard`, `Shell`, `RelatedActivities` and discovery-filter imports as described above. Update feature callers and thin route adapters without moving completed screens or changing rendered behavior.
6. Update unit tests to import the owning modules and add `tests/boundaries.test.ts`. The boundary test must resolve relative and `@/` imports and reject: imports from outside `src/domain` by domain modules; `src/components` imports from `src/features` or `src/server`; and feature imports from `src/server` or a sibling feature, with `src/features/preview` as COR0001's explicit adapter exception. Add an ESLint `src/domain` override that rejects `window`, `document`, `navigator`, `localStorage`, `sessionStorage` and `fetch` so browser/network access cannot enter through globals.
7. Delete `src/lib`, prove that no source/test import still references it, run the complete validation plan and replace the planning record with exact implementation and acceptance evidence.

## Acceptance criteria

- [x] AC1: Every former `src/lib` export has the owner and contract recorded in the planned map; all source/test imports use those owners; `src/lib` and compatibility re-exports no longer exist.
- [x] AC2: `src/domain` contains only framework-independent contracts and pure deterministic rules. Automated import and restricted-global checks reject framework, component, feature, preview, server, browser and network dependencies from this boundary.
- [x] AC3: Seeded records and browser storage live under `src/features/preview` and retain every value and ID, serialized version `1`, the `repx-club-preview-v1` key, corruption recovery, server snapshot, same/cross-tab subscription behavior, memory fallback and reset behavior.
- [x] AC4: Discovery filters/search and shared related-item selection receive their collections explicitly and preserve current Unicode query normalization, all-term matching, blank-query behavior, activity/date/time boundaries, sorting, related-result semantics and exclusion of private drafts.
- [x] AC5: Shared components import no feature module. Feed, Profile, Challenge, Event and root-layout composition supply preview state/data through the documented props/adapters, with no feature-to-feature import other than the explicit preview adapter exception and no moved DEV0030 screen.
- [x] AC6: Existing unit and browser behavior, lint, typecheck, formatting and a production build pass. The implementation record documents every affected file, signature change, boundary rule, command result and material limitation.

## Validation plan

Run the current `npm test` before source edits and record its result as the behavioral baseline. During implementation, update the existing demo, discovery, event and explore tests to use the new owners without weakening assertions; add the focused import-boundary test; and retain coverage of invalid dates/amounts, booking guards, corrupted state, hidden/cancelled bookings, query normalization, time boundaries and related results.

After the move, verify the file/export map with `rg --files src/domain src/features/preview src/features/discovery src/components`, confirm `src/lib` no longer exists, and confirm `rg -n '@/lib/|src/lib' src tests` returns no stale source/test reference. Review the fixture move with Git's rename/diff output and compare the seeded counts, IDs, order and representative serialized preview state before and after.

Run `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build` and `npm run test:e2e`. Exercise malformed/unavailable storage and reset behavior through the existing browser suite and review representative desktop/mobile routes for unchanged content and interactions. Run the standard build first; if the already-observed restricted-environment Turbopack IPC error recurs, record that exact failure and also run `npm run build -- --webpack` as the production-build check rather than describing the standard command as passed. Database, wallet, program and devnet checks do not apply because no external authority is introduced.

## Implementation record

Planning created from COR0001's reviewed inventory. [DEV0036](../organisatory/DEV0036-explicit-architecture-boundaries.md) clarified that this ticket owns the exact `src/lib` move while `src/domain` becomes a shared authority-free dependency rather than a frontend runtime layer. Completed DEV0030 remains unchanged.

Implementation started on 2026-09-20 after DEV0036 was committed as `0ba2fa3`. The ticket moved from Ready to In progress with the planned file/export map, shared-component integration and boundary rules unchanged. The required pre-edit unit baseline passed before the first source move.

### Delivered ownership and behavior

- `src/domain/catalogue.ts` now owns the catalogue record shapes and literal unions. `src/domain/events.ts` owns event/draft contracts, validation and draft mapping. `src/domain/challenges.ts` owns challenge-draft validation and deterministic challenge discovery/sorting. `src/domain/discovery.ts` owns filter/result contracts and pure related-item selection. These modules import only other domain modules and perform no browser, network, persistence or framework work.
- `src/features/preview/catalogue.ts` owns the three challenges, three classes, three studios, three people and one event in their original order with unchanged identifiers and values. `src/features/preview/discovery.ts` derives the same public search/related catalogue and continues excluding private drafts. `state.ts` owns the complete local reducer/parser contract; `store.ts` remains a client-only React/localStorage adapter; and `preview-shell.tsx` supplies the storage warning state to the shared shell.
- `src/features/discovery/filters.ts` now owns class/studio/event filtering and `queries.ts` owns normalized public search. Both consume explicit collections. `src/components/format.ts` owns the unchanged currency/challenge/event presentation formatters. Discovery filter labels remain beside their controls.
- `ChallengeCard`, `Shell` and `RelatedActivities` remain shared components but no longer acquire preview or feature state. Their feature/adapter owners pass saved state and callbacks, storage availability, and selected discovery records. Feed, Profile, Challenge, Event and root-layout composition were updated without moving any DEV0030 screen or changing public routes.
- `tests/boundaries.test.ts` resolves relative and `@/` imports and rejects domain imports outside `src/domain`, shared-component imports from features/server, and feature imports from server or sibling capabilities other than the explicit Preview adapter. ESLint additionally rejects `window`, `document`, `navigator`, `localStorage`, `sessionStorage` and `fetch` globals in `src/domain`.
- All six former `src/lib` files were removed after every source and test importer moved. The README and COR0001 now describe the delivered tree instead of the obsolete mixed boundary.

### Contract changes and rationale

`searchCatalogue` now accepts `(catalogue, query)` and `relatedActivities` accepts `(catalogue, activity, excludeHref, venueId?)`; this removes hidden fixture acquisition while retaining result order and matching semantics. `ChallengeCard` accepts `saved` and `onToggleSaved`, `Shell` accepts `storageUnavailable`, and `RelatedActivities` accepts selected `DiscoveryItem` records plus the presentation-only venue heading flag. `PreviewShell` is the root browser-state adapter.

The serialized preview contract did not change: version remains `1`, the key remains `repx-club-preview-v1`, and initial state, legacy event-draft recovery, invalid-state fallback, membership booking guard, same-tab notification, cross-tab subscription, unavailable-storage fallback and reset values are unchanged. No dependency, environment variable, setup step, database shape, migration, wallet/program interface, public route or product behavior changed. Rollback is a source-level revert; there is no data migration.

The implementation followed the planned map without a material change of approach. The only intentionally changed public TypeScript signatures are the explicit data/component inputs above. Later persistence work must map authoritative rows into these domain/view contracts and must not import preview fixtures or treat `DemoState` as a server contract.

## Validation results

- **Pre-edit unit baseline — passed:** `npm test` passed all 18 existing tests before the first source move. The suite covered challenge/event validation, local booking transitions, sharing/privacy, corrupted storage recovery, search/filter ordering and date/time boundaries.
- **Unit and boundary suite — passed:** the permitted `npm test` rerun passed 19/19 checks after implementation. Existing assertions were retained under their new owners, and the added import-boundary test passed. The first sandboxed invocation was denied because `tsx` could not create its IPC socket (`EPERM`); no source failure occurred.
- **Ownership/stale-import audit — passed:** `rg -n '@/lib/|src/lib' src tests` returned no matches; `src/lib` contains no files; the new domain, discovery, preview and formatter modules match the recorded export map. Seed counts and ID order remain 3 challenges, 3 classes, 3 studios, 3 people and 1 event, and existing state serialization/recovery assertions passed unchanged.
- **Lint and types — passed:** `npm run lint` completed without errors or warnings, including the restricted `src/domain` globals; `npm run typecheck` generated route types and completed TypeScript checking.
- **Formatting and diff hygiene — passed:** after formatting the moved modules and tests, `npm run format:check` passed and `git diff --check` reported no whitespace errors.
- **Production build — passed with environment note:** the standard `npm run build` reached Turbopack but its CSS worker was denied permission to bind an internal local port (`EPERM`). The planned fallback `npm run build -- --webpack` compiled successfully, completed TypeScript and page-data collection, and generated all 14 application routes. The restricted Turbopack command is not reported as passing.
- **Browser regression — passed:** `npm run test:e2e` passed all 28 Playwright scenarios in installed Chrome across desktop and mobile. It exercised primary/dynamic routes, saving/following, search and filters, related navigation, private challenge/event drafts, membership booking/cancellation/hiding, reset, keyboard dialogs, malformed and unavailable storage, responsive overflow checks and console-error checks.
- **Record/tree consistency — passed:** README and COR0001 describe the delivered domain/discovery/preview split; the index contains 32 unique records—9 current and 23 archived—and lists DEV0031 once as Completed; all local Markdown targets resolve across 51 Markdown files after self-archive.

## Risks, limitations, and follow-ups

The standard Turbopack build remains unverified in this restricted environment because its internal worker cannot bind a local port; the successful webpack production build and complete production-server browser suite provide the runtime evidence. Preview fixtures and browser state remain intentionally non-authoritative. Later database tickets must map persisted records into the domain/view contracts instead of exposing Drizzle row types or replacing preview data silently.

## Completion and review references

- Completed: 2026-09-20 — pure domain, discovery and browser-only preview ownership is explicit; behavior and storage contracts are preserved.
- Commit: This commit — `[DEV0031] Separate preview and domain boundaries`.
- Review: Implementation self-review completed against AC1–AC6; no independent review or pull request.
- Deployment or release: None.
