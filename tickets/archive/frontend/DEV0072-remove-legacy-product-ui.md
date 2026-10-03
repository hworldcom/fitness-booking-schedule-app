# Ticket DEV0072: Remove legacy product UI

- Status: Completed
- Created: 2026-09-25
- Last updated: 2026-09-25
- Milestone: M0 truthful frontend baseline
- Coordination: [COR0007 — Core multi-gym membership MVP](../organisatory/COR0007-core-multigym-membership-mvp.md)
- Related records: follows completed product audit [DEV0071](../organisatory/DEV0071-audit-active-work-after-multigym-pivot.md); precedes completed [DEV0073](DEV0073-rewrite-multigym-public-story.md), completed [DEV0074](DEV0074-preview-multigym-discovery.md) and completed [DEV0075](DEV0075-preview-membership-selection.md); persistent catalogue work remains under [COR0006](../organisatory/COR0006-persistent-access-catalogue.md)

## Objective and context

Remove the visible routes, controls, fixture state and presentation code that describe products no longer in the focused MVP. Establish a small truthful frontend baseline before introducing the new multi-gym membership story.

The current preview still exposes paid-class/pass flows, events and event drafting, transferable membership copy and transfer-specific visuals. Those surfaces contradict the current specification even though they do not create real access. This ticket removes them without pretending the replacement membership is implemented.

## Scope and non-goals

- In scope: remove ordinary/sponsored event routes, event creation and event-specific feature/domain/preview state; remove standalone paid-class/pass discovery and checkout-oriented routes/components; remove transfer controls, diagrams, fee copy and transfer-only styles; remove Passes/Event tickets from My Access; remove outdated metadata/navigation/search/discovery entries; delete orphaned fixtures, persistence actions, tests and styles; leave an honest minimal gym/membership-coming-soon baseline; update affected tests and documentation.
- Out of scope: the new Home/How it works narrative, redesigned gym discovery, four-gym selection, plan activation, membership ownership, database changes, payments, check-ins, allocation, social implementation and deployment.

## Expected behavior and edge cases

Guests can still reach Home, Explore, How it works, sign-in, profiles and the waitlist/coming-soon page. Explore temporarily presents only a neutral gym-discovery baseline; it has no Classes/Events tabs or standalone access purchase affordance. Removed event/class URLs return the normal not-found response and are absent from navigation, search results and internal links.

How it works contains no transferable card, transfer diagram, transfer fee or transfer FAQ. Until DEV0073 replaces the full story, it may show a concise honest interim membership message. My Access shows only a membership-oriented empty state and never lists passes or event tickets. Browser storage migration ignores/drops obsolete event drafts without breaking valid retained preview preferences.

Wallet-authentication challenge identifiers and message-signing challenges are security terminology, not product Challenge mode, and must remain intact. Generic DOM/React event handlers and SQL transfer-of-ownership wording are not product events/transfers and must not be renamed mechanically.

## Assumptions, decisions, and dependencies

- This ticket deletes only frontend/product-preview behavior; historical tickets and forward-only database migrations remain untouched.
- Standalone paid classes are removed. A later gym page may reintroduce class schedules as informational or reservable membership inventory under a dedicated contract.
- The existing Home and guide may be simplified here only enough to remove false claims; DEV0073 owns their final multi-gym presentation.
- Existing email Auth, profile, wallet, club sign-in and waitlist behavior must regress cleanly.

## Implementation plan

1. Trace obsolete routes, components, domain types, fixtures, preview state/storage, styles and tests from their imports and public links.
2. Remove event creation/detail, event draft persistence and standalone paid-class/pass presentation; simplify Explore to a neutral gym-only baseline.
3. Remove transfer/pass/event content from How it works, My Access, metadata, search/navigation and responsive styles.
4. Delete orphaned code and update preview-state migration/reset behavior plus affected unit/browser tests.
5. Run import/term audits, unit tests, lint, typecheck, formatting, production build and responsive keyboard/browser checks for retained routes and removed-route 404 behavior.

## Acceptance criteria

- [x] AC1: No current route, navigation, metadata, search result or visible control promotes an event, sponsored event, standalone class/pass, pass resale or membership transfer.
- [x] AC2: Obsolete event/class purchase routes return not found, and their feature/domain/fixture code plus event-draft storage actions are removed when no longer referenced.
- [x] AC3: Explore has a truthful gym-only interim state; My Access has a membership-only empty state; the guide contains no transfer story while awaiting DEV0073.
- [x] AC4: Authentication challenges, profiles, wallet linking/authority, waitlist behavior and retained browser state continue to work; obsolete stored event drafts cannot break hydration.
- [x] AC5: Targeted term/import audits, unit tests, lint, typecheck, format, production builds and desktop/mobile keyboard/browser checks pass, with the environment-specific Turbopack limitation recorded below.

## Validation plan

Search source and built pages for product uses of `event`, `pass`, `sponsor`, `transfer`, `€69` and removed route paths while excluding authentication challenge terminology and historical records. Exercise Home, Explore, How it works, My Access, Profile, sign-in, club sign-in and Coming Soon at mobile/desktop widths with keyboard navigation. Confirm removed URLs return not found. Run `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build` and focused `npm run test:e2e` coverage.

## Implementation record

Completed the focused-product frontend cleanup and validation on 2026-09-25.

### Changes and rationale

Removed the standalone class and event route trees, their purchase/ticket presentations, event creation, event drafts, event-specific domain validation and the obsolete mixed discovery catalogue. `/classes/*`, `/events/*` and the already-retired `/challenges/*` routes now resolve through the normal not-found screen.

Explore now presents an explicitly temporary gym-only catalogue with activity filtering and accessible gym details. Search indexes only those gym profiles. Home retains the requested minimal social concept through clearly labelled, explicitly shared demo gym check-ins rather than class/event joins. My Access has one honest membership empty state, and the guide plus Coming Soon page use a concise interim four-gym message without transfer, pass, event or sponsorship claims.

Preview persistence advanced to version 3. Existing valid follows migrate from versions 1 and 2, duplicate follows are normalized, and retired challenge/reaction/event-draft fields are ignored rather than hydrated. Account, profile, personal/club wallet, authentication-challenge and waitlist boundaries were preserved.

### Affected files

- `src/app/classes/[id]/page.tsx`, `src/app/events/[id]/page.tsx`, `src/app/events/new/page.tsx`, `src/features/classes/class-detail.tsx`, `src/features/events/events.tsx`, `src/features/discovery/event-list.tsx` and `src/domain/events.ts`: removed obsolete class purchase, event ticket and event-draft routes/code.
- `src/features/discovery/explore.tsx`, `src/features/discovery/search.tsx`, `src/features/discovery/filters.ts`, `src/domain/catalogue.ts`, `src/domain/discovery.ts`, `src/features/preview/catalogue.ts` and `src/features/preview/discovery.ts`: reduced public discovery to an explicit gym-only interim contract and removed class/event inventory shapes.
- `src/features/feed/feed.tsx`, `src/features/access/my-access.tsx`, `src/features/discovery/how-it-works.tsx`, `src/features/waitlist/coming-soon.tsx`, `src/components/shell.tsx`, `src/features/profile/profile.tsx`, `src/app/layout.tsx` and `src/app/how-it-works/page.tsx`: removed obsolete claims and replaced them with truthful interim membership/community states.
- `src/features/preview/state.ts`: migrated browser state to version 3 with follows as the only retained preview mutation; `src/features/preview/store.ts` keeps the existing storage key so older browsers migrate on load.
- `src/app/globals.css`, `src/app/club-theme.css` and `src/app/how-it-works.css`: removed obsolete route/checkout/draft/guide styling and added the small responsive interim guide treatment.
- `tests/demo.test.ts`, `tests/discovery.test.ts`, `tests/explore.test.ts` and the focused browser specifications: replaced obsolete product tests with gym-only discovery, state migration, removed-route, responsive, keyboard and retained-auth coverage. `tests/events.test.ts` and `tests/browser/events.spec.ts` were deleted with their feature.

### Decisions and deviations

- 2026-09-25: The user chose frontend cleanup before database redesign. This first slice removes the previous product rather than adding the replacement in the same review.
- 2026-09-25: The three retained gym fixtures remain an explicitly temporary catalogue for this cleanup. DEV0074 was then planned to own a five-gym fictional dataset and final preview read contracts; its 2026-09-26 implementation record preserves the later user-approved expansion to seven.
- 2026-09-25: Home keeps a minimal visual social preview using explicitly shared demo gym check-ins. It does not claim that the persistent DEV0023 social backend is delivered.

### Contracts, configuration, and operations

The browser-preview contract changed from `{ version: 2, following, eventDrafts }` to `{ version: 3, following }`. Versions 1 and 2 remain readable for follow migration; every retired field is discarded. Public route compatibility intentionally changes because `/classes/*` and `/events/*` now return 404. No database, API, environment variable, package dependency, migration or deployment contract changed.

## Validation results

- `npm test` — passed: 45 unit tests, including version 1/2 preview-state migration and gym-only discovery contracts.
- `npm run lint` — passed.
- `npm run typecheck` — passed after regenerated Next.js route types; the removed class/event routes are absent.
- `npm run format:check` — passed.
- `npm run build` — blocked twice by the execution environment: Turbopack's PostCSS worker could not bind an internal local port (`Operation not permitted`). No source/type/CSS error was reported.
- `./node_modules/.bin/next build --webpack` — passed; the production route table contains the retained routes and no class/event route.
- `npm run build:vinext` — passed all five build phases and emitted only a non-fatal sandbox warning when Wrangler attempted to write its user-level log outside the workspace.
- `npm run test:e2e -- tests/browser/discovery.spec.ts tests/browser/preview.spec.ts tests/browser/redesign.spec.ts tests/browser/clubs.spec.ts tests/browser/waitlist.spec.ts tests/browser/profile.spec.ts tests/browser/authorization.spec.ts` — 30 passed across desktop and mobile; two preview-mode-only browser-state cases skipped because the configured environment used account-backed mode. Equivalent migration behavior passed in the unit suite.
- Browser assertions confirmed 404 responses for class, event and challenge paths; retained Home, Explore, How it works, Search, Coming Soon, My Access/Profile access boundaries and club sign-in remained usable without overflow or page errors.
- Manual screenshot review covered Home, gym-only Explore and the interim guide at desktop and mobile widths. Cards, reading order, fixed mobile navigation and content boundaries remained coherent.
- Targeted import/term audit found no remaining frontend imports, routes, controls or copy for the removed product families. `git diff --check` passed.

## Risks, limitations, and follow-ups

This ticket intentionally left a small interim interface. DEV0073 owns the complete public story, completed DEV0074 owns the final seven-gym plan/discovery preview and DEV0075 owns draft membership selection. The three fixtures retained by this earlier cleanup and its shared check-in cards were labelled preview data and were not persistence, partnership, ownership or payment evidence.

The default Turbopack build could not be exercised in this restricted execution environment because its internal worker attempted a prohibited local-port bind. Webpack and vinext production builds both completed, so no implementation blocker remains for this ticket.

## Completion and review references

- Completed: 2026-09-25.
- Commit: Not created.
- Review: Implementation self-review against AC1–AC5; no independent review.
- Deployment or release: None.
