# Ticket DEV0198: Build the search-first marketplace home

- Status: Draft
- Created: 2026-10-12
- Last updated: 2026-10-12
- Milestone: Scheduling interface public-marketplace follow-up
- Coordination: [COR0017 — Public marketplace redesign](../organisatory/COR0017-public-marketplace-redesign.md)
- Related records: contract dependency [DEV0195 — Adopt the public marketplace redesign contract](../organisatory/DEV0195-adopt-public-marketplace-redesign-contract.md), shell dependency [DEV0196 — Introduce the public marketplace shell](DEV0196-introduce-public-marketplace-shell.md), search dependency [DEV0197 — Share public marketplace search](DEV0197-share-public-marketplace-search.md), public-story baseline [DEV0095 — Present the coach-first public story](../../archive/frontend/DEV0095-present-coach-first-public-story.md) and Explore consumer [DEV0199 — Redesign desktop coach Explore](DEV0199-redesign-desktop-coach-explore.md)

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

- DEV0195 must adopt real server-backed previews; DEV0196 and DEV0197 must be complete before this ticket starts.
- The first preview can show a bounded slice of the existing alphabetical directory; it must not imply proximity or recommendation ranking.
- A reusable compact coach-preview card created here may be consumed by DEV0199, but page-specific layout and long-form homepage sections remain owned here.

## Implementation plan

1. Make the homepage route load the normalized unfiltered public directory through the existing server service and pass bounded state to the public feature.
2. Reorder the page into concise introduction/search, discipline links, coach previews, three-step explanation and coach CTA.
3. Create a reusable compact truthful coach-preview presentation with portrait/initial and availability fallbacks.
4. Add ready/empty/unavailable browser coverage and responsive/keyboard checks.
5. Remove obsolete illustration-only sections/styles only when no longer consumed by `/how-it-works`.

## Acceptance criteria

- [ ] AC1: The homepage presents working search and at least one truthful discovery surface or honest empty/unavailable state above `How it works`.
- [ ] AC2: Preview coaches, images, locations, trust labels and availability come only from authoritative bounded data and link to public profiles.
- [ ] AC3: Copy consistently explains that a session request is pending until coach confirmation.
- [ ] AC4: Mobile and desktop layouts have no overflow, dead controls, invented ranking or fabricated marketplace data.

## Validation plan

- Add component/domain coverage for bounded preview selection and truthful ready/empty/unavailable rendering.
- Add Playwright scenarios for homepage search, discipline links, coach profile navigation, missing portrait, database-unavailable state and coach-application CTA.
- Validate approximately 375 px, 430 px, 768 px, 1024 px and 1440 px widths with keyboard operation.
- Run application tests, lint, type-check, format, production build and `git diff --check`.

## Implementation record

Pending implementation.

### Changes and rationale

Pending implementation.

### Affected files

| File or component | Change and purpose |
| ----------------- | ------------------ |
| Pending           | Pending.           |

### Decisions and deviations

None yet.

### Contracts, configuration, and operations

No schema, API, provider, environment or migration change is planned. The homepage becomes a consumer of the existing public directory service.

## Validation results

Pending validation.

| Criterion | Evidence | Result  |
| --------- | -------- | ------- |
| AC1       | Pending  | Not run |
| AC2       | Pending  | Not run |
| AC3       | Pending  | Not run |
| AC4       | Pending  | Not run |

## Risks, limitations, and follow-ups

- Loading public data on `/` must retain configuration-free/unavailable build behavior and avoid duplicating Explore's service calls in the browser.
- Weekly availability remains a future enhancement until aggregation semantics are authoritative.

## Completion and review references

- Completed: Not completed.
- Commit: Planning record included in the commit whose subject references DEV0195-DEV0201; implementation not started.
- Review: No review created.
- Deployment or release: Not deployed or released.
