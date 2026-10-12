# Ticket DEV0198: Build the search-first marketplace home

- Status: Completed
- Created: 2026-10-12
- Last updated: 2026-10-12
- Milestone: Scheduling interface public-marketplace follow-up
- Coordination: [COR0017 — Public marketplace redesign](../../current/organisatory/COR0017-public-marketplace-redesign.md)
- Related records: completed contract dependency [DEV0195 — Adopt the public marketplace redesign contract](../organisatory/DEV0195-adopt-public-marketplace-redesign-contract.md), completed shell dependency [DEV0196 — Introduce the public marketplace shell](DEV0196-introduce-public-marketplace-shell.md), completed search dependency [DEV0197 — Share public marketplace search](DEV0197-share-public-marketplace-search.md), public-story baseline [DEV0095 — Present the coach-first public story](DEV0095-present-coach-first-public-story.md) and completed Explore consumer [DEV0199 — Redesign desktop coach Explore](DEV0199-redesign-desktop-coach-explore.md)

## Objective and context

Recompose `/` from an explanation-first landing page into a search-first marketplace home. Visitors should understand the product, run a real coach search and inspect a bounded set of authentic public coach previews before the longer explanation, while preserving demo labels and the fact that a request still awaits coach confirmation.

## Scope and non-goals

- In scope:
  - Replace the large illustrative scheduling hero with concise positioning and DEV0197 search controls.
  - Add supported discipline chips and a `Discover coaches` preview using the existing server-backed public directory state.
  - Present bounded image/initial coach cards with disciplines, primary confirmed training base, trust/demo label and only authoritative availability.
  - Keep a concise three-step explanation, coach-application CTA, preview limitations and footer below discovery content.
  - Supply an honest empty/unavailable state when public directory data cannot be read.
- Out of scope:
  - `Near you` claims, geolocation, personalized ranking, invented coaches/times, `When`, weekly aggregation, prices, ratings, reviews or map embedding on the homepage.
  - Changes to coach profile, request mutation or private navigation behavior.

## Expected behavior and edge cases

- A visitor can start a supported search above the explanatory content at desktop and mobile widths.
- Coach previews come from the same bounded service as Explore, remain ordered by the service's truthful ordering and link to complete profiles.
- Missing portraits render initials; fictional fixtures remain visibly labelled; absence of upcoming/today availability is explicit rather than filled with a placeholder.
- Configuration/database failure keeps the page explanatory and actionable without inserting fixture fallback data beyond the repository's authoritative demo database.
- The CTA says `request`/`await coach confirmation`, never instant booking or reservation.

## Assumptions, decisions, and dependencies

- DEV0195 adopted real server-backed alphabetical previews; DEV0196 and DEV0197 must be complete before this ticket starts.
- The first preview can show a bounded slice of the existing alphabetical directory; it must not imply proximity or recommendation ranking.
- A reusable compact coach-preview card created here may be consumed by DEV0199, but page-specific layout and long-form homepage sections remain owned here.
- Implementation default: show at most the first three entries returned by the authoritative alphabetical directory. This keeps the homepage concise without introducing a second ordering rule.
- The database-backed preview must execute at request time so a configuration-free build cannot permanently cache its honest unavailable state for a later configured deployment.

## Implementation plan

1. Make the homepage route load the normalized unfiltered public directory through the existing server service and pass bounded state to the public feature.
2. Reorder the page into concise introduction/search, discipline links, coach previews, three-step explanation and coach CTA.
3. Create a reusable compact truthful coach-preview presentation with portrait/initial and availability fallbacks.
4. Add ready/empty/unavailable browser coverage and responsive/keyboard checks.
5. Remove obsolete illustration-only sections/styles only when no longer consumed by `/how-it-works`.

## Acceptance criteria

- [x] AC1: The homepage presents working search and at least one truthful discovery surface or honest empty/unavailable state above `How it works`.
- [x] AC2: Preview coaches, images, locations, trust labels and availability come only from authoritative bounded data and link to public profiles.
- [x] AC3: Copy consistently explains that a session request is pending until coach confirmation.
- [x] AC4: Mobile and desktop layouts have no overflow, dead controls, invented ranking or fabricated marketplace data.

## Validation plan

- Add component/domain coverage for bounded preview selection and truthful ready/empty/unavailable rendering.
- Add Playwright scenarios for homepage search, discipline links, coach profile navigation, missing portrait, database-unavailable state and coach-application CTA.
- Validate approximately 375 px, 430 px, 768 px, 1024 px and 1440 px widths with keyboard operation.
- Run application tests, lint, type-check, format, production build and `git diff --check`.

## Implementation record

Implementation started and completed on 2026-10-12 after confirming DEV0196-DEV0197 completion and reviewing the current Home composition, public directory projection, database boundary and Next.js 16.3.8 request-time data guidance.

### Changes and rationale

- Made `/` a request-time server-rendered route and loaded the normalized unfiltered state through `publicCoachDirectory`, the same bounded service used by Explore. A configuration-free deployment therefore renders an honest unavailable state instead of freezing build-time data.
- Replaced the large illustrative scheduling hero with compact positioning and the working DEV0197 search, followed immediately by the directory preview. Unsupported date, proximity, price, rating and recommendation language remains absent.
- Added a pure first-three preview boundary that preserves the authoritative alphabetical service order without reranking or mutating the complete directory result.
- Added a reusable compact coach card with public portrait/initial fallback, verified/demo label, disciplines, primary training location, actual today availability or explicit absence, and links to the complete public profile.
- Added explicit empty and unavailable discovery states that keep search, explanation and the Explore route usable without hard-coded coach or time fallbacks.
- Reduced the Home explanation to three steps and states twice that a request remains pending until coach acceptance rather than creating an instant booking. Replaced the longer client/coach benefit panels with one focused coach-application call to action; `/how-it-works` retains the detailed lifecycle.
- Reworked responsive styles for the compact hero, horizontally scrollable discipline links, three/two/one-column coach previews, three-step grid and coach call to action. Removed the obsolete illustration and benefit-card styles no longer consumed by Home or How it works.

### Affected files

| File or component                                                                             | Change and purpose                                                                                                                                                |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/page.tsx`                                                                            | Defers Home to request time, reads the existing public directory service and passes its bounded state into the public feature.                                    |
| `src/domain/coaches.ts`                                                                       | Defines the three-entry Home limit and order-preserving preview selector.                                                                                         |
| `src/features/coaches/compact-coach-card.tsx`                                                 | Provides the reusable truthful coach preview presentation intended for Home and later DEV0199 adaptation.                                                         |
| `src/features/coaches/home-coach-discovery.tsx`                                               | Presents ready, empty and unavailable directory states above explanation content.                                                                                 |
| `src/features/public/coach-story.tsx`                                                         | Reorders Home around search/discovery, adds pending-confirmation copy, reduces explanation to three steps and supplies the coach-application call to action.      |
| `src/app/coach-story.css` and `src/app/coach-discovery.css`                                   | Implement the responsive Home composition and compact card while removing obsolete Home-only illustration/benefit styles.                                         |
| `tests/home-marketplace.test.ts`                                                              | Verifies preview bounds/order, ready/empty/unavailable states, portraits/initials, trust/location/availability data, profile links and content order.             |
| `tests/browser/public-story.spec.ts`                                                          | Exercises real search, both directory modes, profile navigation, missing portraits, coach CTA, keyboard/no-JavaScript behavior and all adopted responsive widths. |
| `tickets/README.md` and `tickets/current/organisatory/COR0017-public-marketplace-redesign.md` | Keep lifecycle state, dependencies and the public-marketplace work map synchronized.                                                                              |

### Decisions and deviations

- Chose three as a concise implementation bound and sliced the service result without sorting it again. This preserves the contract's alphabetical authority and avoids implying recommendations.
- Used stable `connection()` from the installed Next.js 16.3.8 API instead of a static page or legacy force-dynamic configuration. The production route report confirms `/` is server-rendered on demand.
- Kept today-only availability because it is already an authoritative directory projection. Weekly aggregation remains excluded.
- Kept database access entirely on the server and reused the existing service failure boundary; no browser endpoint or duplicate client request was introduced.

### Contracts, configuration, and operations

No schema, API, provider, dependency, environment variable or migration changed. Home now consumes the existing `CoachDirectoryState` at request time. Deployments with complete database configuration render up to three current entries; configuration-free or failed reads render the explicit unavailable state. Existing Explore/profile URLs and search parameters remain compatible.

## Validation results

Validation completed on 2026-10-12 with the repository Node.js release and both configuration-free and loopback-database production servers.

| Criterion | Evidence                                                                                                                                                                                                                                                                     | Result |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Component coverage verifies search → preview/state → explanation order and all directory states. Configuration-free Playwright rendered the unavailable state while the loopback database run rendered three cards above `How it works`.                                     | Passed |
| AC2       | Unit coverage verifies the first three unchanged entries, portrait and initials, verified/demo labels, primary location, real today time versus explicit absence and profile URLs. Database-backed desktop/mobile Playwright followed a rendered card to its public profile. | Passed |
| AC3       | Unit and browser checks find the pending-until-accepted and not-instant-booking copy; metadata now describes requesting coach confirmation rather than direct booking.                                                                                                       | Passed |
| AC4       | Playwright exercised 375, 393, 430, 768, 1024 and 1440-pixel views with no horizontal overflow, retained working keyboard/no-JavaScript search, and found no unsupported ranking, proximity, date, price or rating claim.                                                    | Passed |

Additional checks:

- `npm test` passed all 116 unit tests and 9 React-server tests.
- `npm run lint`, `npm run typecheck`, `npm run format:check` and `git diff --check` passed.
- `npm run build` passed in configuration-free public-preview mode and reported `/` as dynamically server-rendered. It emitted only the existing Supabase Node-version and experimental JSON-module warnings.
- `npx playwright test tests/browser/public-story.spec.ts` passed 12 configuration-free desktop/mobile checks and skipped 2 intentional duplicate mobile cases.
- `DATABASE_URL=<loopback runtime URL> npx playwright test tests/browser/public-story.spec.ts --grep 'home presents the focused scheduling loop'` passed both desktop and mobile database-backed checks, including profile navigation and the initials fallback.
- Visual review covered configuration-free and database-backed 1440×1040 and 393×852 full-page screenshots. The search, states/cards, explanation and coach call to action remained readable with no clipping or overflow.
- Database migration/constraint tests were not applicable because persistence and query semantics did not change. `npm run db:runtime` only prepared/reused the documented loopback runtime login for the browser rehearsal.

## Risks, limitations, and follow-ups

- Home now makes one server-side directory read per request; caching or streaming requires a separate performance decision with freshness semantics.
- Preview cards intentionally show today-only availability. Weekly availability remains a future enhancement until aggregation semantics are authoritative.
- DEV0199 may adapt the reusable compact card for complete desktop results, but its list/map composition remains outside this ticket.

## Completion and review references

- Completed: 2026-10-12.
- Commit: `[DEV0198] Build the search-first marketplace home` (this completed change).
- Review: No review created.
- Deployment or release: Not deployed or released.
