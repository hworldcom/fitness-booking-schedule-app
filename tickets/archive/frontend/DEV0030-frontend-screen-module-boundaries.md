# Ticket DEV0030: Frontend screen module boundaries

- Status: Completed
- Created: 2026-09-20
- Last updated: 2026-09-20
- Milestone: Cross-cutting application foundation
- Coordination: [COR0001 — Project structure](../../current/organisatory/COR0001-project-structure.md)
- Related records: direct peer development ticket tracked by [Coordination COR0001 — Project structure](../../current/organisatory/COR0001-project-structure.md); preserves the delivered behavior recorded by DEV0008 — Frontend foundation; precedes feature work that would otherwise expand the current shared component files

## Objective and context

Move the existing user-facing screen modules from the shared component directory into capability-owned `src/features` modules while keeping reusable interface and layout primitives under `src/components`. Thin the substantial Search and How-it-works route files so `src/app` remains the Next.js routing boundary. Preserve every current URL, interaction, accessibility behavior and local-preview result.

The current routes are mostly thin, but `src/components` mixes application-wide primitives with complete Challenges, Events, Explore, Classes, Feed and Profile screens. Search and How it works contain substantial presentation directly in their route files. This structure makes ownership less clear before wallet, authentication and persistence work add more modules.

## Scope and non-goals

- In scope: move complete feature screens into named `src/features/<capability>/` modules; move Search and How-it-works presentation behind thin route adapters; update imports and affected tests; keep shared shell/UI and genuinely shared discovery controls under `src/components`; document the exact final move map.
- Out of scope: splitting preview fixture/domain/storage modules from `src/lib` (owned by DEV0031), redesigning components, changing routes or copy, adding server/database/wallet/program code, replacing local preview behavior, introducing a workspace or adding placeholder directories.

## Expected behavior and edge cases

All existing direct URLs, dynamic route handling, not-found states, navigation, forms, dialogs, keyboard behavior, responsive layouts and preview interactions behave exactly as before. Feature modules may consume shared components and domain/preview modules. Shared components must not import complete feature screens, and route files must not regain large presentation implementations.

Moves should preserve client/server boundaries and avoid broad barrel exports that accidentally make browser-only modules available to server code. Git history should remain reviewable through coherent moves and minimal unrelated formatting changes.

## Assumptions, decisions, and dependencies

The target ownership is recorded in COR0001. `shell.tsx` and `ui.tsx` already represent shared application UI and remain under `src/components`. The discovery filters/extras are reused by several capabilities; they remain shared unless implementation proves a clearer shared subdirectory without introducing feature-to-feature dependencies. Existing global CSS remains under `src/app/globals.css` in this slice.

This ticket can be implemented independently of backend and wallet work. Complete or coordinate it before modifying the same screen modules for a feature ticket to avoid conflicting moves.

## Implementation plan

1. Record the exact before/after path map for every moved screen and route presentation module, including shared modules that intentionally remain in place.
2. Create only the required `src/features` capability directories and move Challenges, Events, discovery/Explore, Classes, Feed and Profile screen implementations with focused exports.
3. Extract Search and How-it-works presentation into discovery feature modules while retaining route parameters, metadata and Next.js routing behavior under `src/app`.
4. Update route, component and test imports without changing product behavior or reformatting unrelated code. Check dependency direction for feature-to-feature or shared-to-feature imports.
5. Run unit tests, lint, typecheck, formatting, production build and the existing desktop/mobile browser suite. Compare key generated screenshots and document the final tree and results.

## Acceptance criteria

- [x] AC1: Complete user-facing screens live under clear `src/features/<capability>` ownership, while `src/components` contains only reusable layout/interface modules and no shared module imports a feature screen.
- [x] AC2: Search and How-it-works route files are thin adapters; all existing static/dynamic URLs and not-found behavior remain stable.
- [x] AC3: No product, fixture, storage, permission, wallet, database or financial behavior changes, and no unused placeholder directory is added.
- [x] AC4: Unit tests, lint, typecheck, formatting, production build and existing desktop/mobile browser coverage pass; the ticket records the exact move map and any intentional exceptions.

## Validation plan

Use import searches to verify route/shared/feature dependency direction and confirm every old path is gone. Run `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build` and `npm run test:e2e`. Inspect representative desktop/mobile screenshots for all primary surfaces, Search and How it works. No database, wallet, program or devnet validation applies because their runtime behavior is outside this structural slice.

## Implementation record

Implementation started on 2026-09-20 after reviewing the scope, dependencies and validation plan. The ticket moved from Draft through Ready to In progress; no unresolved product decision or external dependency blocks this structural slice.

The implementation uses the following exact move map before the first source edit:

| Current path                                                     | Target path                               | Ownership                                                                                                            |
| ---------------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `src/components/challenges.tsx`                                  | `src/features/challenges/challenges.tsx`  | Challenge list, detail, creation and draft screens.                                                                  |
| `src/components/class-detail.tsx`                                | `src/features/classes/class-detail.tsx`   | Class detail and local booking screen.                                                                               |
| Event detail/create/draft exports in `src/components/events.tsx` | `src/features/events/events.tsx`          | Event detail, creation and draft screens.                                                                            |
| `EventList` in `src/components/events.tsx`                       | `src/features/discovery/event-list.tsx`   | Public event catalogue presentation, owned by Discovery rather than imported across feature boundaries.              |
| `src/components/explore.tsx`                                     | `src/features/discovery/explore.tsx`      | Explore tabs and catalogue presentation.                                                                             |
| `src/components/feed.tsx`                                        | `src/features/feed/feed.tsx`              | Feed screen.                                                                                                         |
| `src/components/profile.tsx`                                     | `src/features/profile/profile.tsx`        | Personal and public profile screen; the thin owner route composes its challenge-draft panel.                         |
| Presentation in `src/app/search/page.tsx`                        | `src/features/discovery/search.tsx`       | Search results presentation; the route retains metadata, search-parameter adaptation and its default Next.js export. |
| Presentation in `src/app/how-it-works/page.tsx`                  | `src/features/discovery/how-it-works.tsx` | How-it-works presentation; the route retains metadata and its default Next.js export.                                |

`src/components/shell.tsx`, `src/components/ui.tsx`, `src/components/discovery-filters.tsx` and `src/components/discovery-extras.tsx` intentionally remain shared. `src/app/globals.css` remains application-global styling. Existing `src/lib` modules and their contracts remain unchanged for DEV0031.

The first import audit found that a whole-file move would make Discovery import the Events feature and Profile import the Challenges feature. The map was refined before those boundaries were finalized: the catalogue-specific `EventList` is extracted into Discovery, while the `/profile` route supplies `DraftList` as composed content. Route composition may reference multiple feature exports; feature modules and shared components do not import other feature modules.

The map was then applied without changing exports' behavior or public URLs. All route imports now resolve through the owning feature modules. Search and How it works retain metadata and Next.js request adaptation in route files while their presentation lives under Discovery; their route adapters are 15 and 7 lines respectively. The owner Profile route composes its challenge-draft content, and Explore consumes the event list inside its own Discovery capability. `src/components` now contains only the shell, shared UI primitives and shared discovery controls.

The repository README now describes `src/app` as the route-adapter boundary, `src/features` as screen ownership and `src/components` as shared UI. No dependency, environment variable, data shape, storage key, public route, product behavior, database, wallet or deployment contract changed. DEV0031 still owns the separate `src/lib` domain/preview split; the existing larger feature files remain cohesive moves rather than being behaviorally redesigned in this ticket.

The repository's ticket history was absent from the first Git commit. Baseline commit `6198ddf` (`[DEV0035] Track project work records`) made this completed record and its dependencies durable immediately before the implementation commit. The DEV0030 commit includes this final reference update alongside the source and README changes; it does not mix the DEV0035 baseline into the application diff.

## Validation results

- **Import and tree audit — passed:** all nine delivered feature modules exist under capability directories; the six former complete-screen files are absent from `src/components`; searches found no old screen import paths, no shared-component-to-feature imports and no cross-capability feature imports. Search and How-it-works routes contain only metadata, input adaptation and feature rendering.
- **Unit tests — passed:** `npm test` passed all 18 domain tests. The restricted runner initially denied the `tsx` IPC socket; the required permitted rerun passed with no failures.
- **Lint and types — passed:** `npm run lint` completed with no errors or warnings; `npm run typecheck` generated Next.js route types and completed TypeScript checking.
- **Formatting — passed:** `npm run format:check` accepted application and test files; Prettier also accepted the changed README and ticket records.
- **Production build — passed with environment note:** `npm run build` was attempted twice, including with the available elevated permission, but Turbopack's CSS worker was denied permission to bind its internal local port (`EPERM`). `npm run build -- --webpack` then completed successfully, including TypeScript, page-data collection and generation of every existing route. This is an execution-environment restriction, not a source diagnostic; the default Turbopack command was not reported as passing.
- **Browser regression — passed:** `npm run test:e2e` passed all 28 Playwright scenarios in installed Chrome across desktop and mobile. Coverage includes the four primary surfaces, direct/dynamic routes, Search, How it works, event flows, challenge flows, storage recovery, keyboard dialogs and horizontal-overflow checks.
- **Visual review — passed:** full-page optimized-preview screenshots of desktop Feed, desktop How it works and mobile Search showed intact styling, navigation, content and responsive layout after the moves. Screenshots were temporary validation output, not repository artifacts.
- **Diff hygiene — passed:** `git diff --check` reported no whitespace errors. No test, fixture, storage, product-rule, dependency or runtime-configuration file changed.
- **Record lifecycle and links — passed:** the repository validator found 30 unique records—29 DEV and one COR—with 10 current and 20 archived records after this ticket moved to `tickets/archive/frontend`; all record metadata, index entries, coordination membership and local links resolved across 49 Markdown files.

## Risks, limitations, and follow-ups

The feature modules remain intentionally large because behavior-driven decomposition was outside this ownership-only slice. DEV0031 remains the next frontend structural task and must move `src/lib` contracts, discovery logic and preview storage without changing the boundaries delivered here. The default Turbopack build could not be exercised in this restricted environment; the successful webpack production build and full production-server browser suite provide the implementation evidence for this ticket.

## Completion and review references

- Completed: 2026-09-20.
- Commit: This commit — `[DEV0030] Organize frontend screen modules`.
- Review: Implementation self-review completed; no independent review or pull request.
- Deployment or release: None.
