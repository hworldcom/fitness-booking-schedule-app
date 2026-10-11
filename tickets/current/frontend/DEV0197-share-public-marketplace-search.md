# Ticket DEV0197: Share public marketplace search

- Status: Draft
- Created: 2026-10-12
- Last updated: 2026-10-12
- Milestone: Scheduling interface public-marketplace follow-up
- Coordination: [COR0017 — Public marketplace redesign](../organisatory/COR0017-public-marketplace-redesign.md)
- Related records: contract dependency [DEV0195 — Adopt the public marketplace redesign contract](../organisatory/DEV0195-adopt-public-marketplace-redesign-contract.md); homepage consumer [DEV0198 — Build the search-first marketplace home](DEV0198-build-search-first-marketplace-home.md); Explore consumer [DEV0199 — Redesign desktop coach Explore](DEV0199-redesign-desktop-coach-explore.md)

## Objective and context

Extract one reusable, accessible public search surface for the filters the application already supports end to end: coach/focus query, discipline and location. The current controls live inside `CoachDirectory`, while the proposed homepage needs to submit the same normalized URL contract without copying validation or introducing decorative `When` controls.

## Scope and non-goals

- In scope:
  - Reuse `CoachDirectoryFilters`, `COACH_DISCIPLINES` and the current `/explore` GET-query contract.
  - Provide responsive labelled search controls usable on both `/` and `/explore`.
  - Add discipline-chip links/actions backed by the exact supported discipline values.
  - Preserve supported filters through search submission and canonicalize invalid/blank values through the existing domain normalizer.
- Out of scope:
  - Date/time, availability range, distance, geolocation, map viewport, prices, ratings, autocomplete or provider place search.
  - Changing database query semantics or adding a new API.

## Expected behavior and edge cases

- Submitting homepage search navigates to `/explore` with only bounded supported parameters.
- Explore renders current values after reload and browser navigation; clearing values returns the unfiltered directory.
- A discipline chip has an understandable selected state and produces the same result as choosing that discipline in the form.
- Invalid, repeated, overlong or unknown query values fail into the existing bounded normalization rather than reaching UI/state unchecked.
- Controls remain useful without client JavaScript because the primary path is a GET form or ordinary links.

## Assumptions, decisions, and dependencies

- DEV0195 must confirm that the first delivery exposes only `q`, `discipline` and `location`.
- Existing server normalization and directory service remain authoritative; UI components must not reimplement matching logic.
- `service=private-training` may be retained for compatibility only if it has current bounded meaning; otherwise the implementation record must explain its removal.

## Implementation plan

1. Extract the current filter form into a public marketplace search component with explicit compact/full presentation variants only if needed.
2. Add discipline-chip navigation using the domain discipline set and shared URL construction.
3. Use the component on Explore without changing current results behavior; expose it for DEV0198 homepage composition.
4. Add domain/component/browser tests for URL retention, clearing, invalid values, keyboard operation and no-JavaScript submission.

## Acceptance criteria

- [ ] AC1: Homepage and Explore can share one working `q`/discipline/location search contract without duplicated filter logic.
- [ ] AC2: Discipline chips use only supported domain values and preserve other applicable filters.
- [ ] AC3: Reload, back/forward, clear and malformed-query behavior remain bounded and deterministic.
- [ ] AC4: No unsupported `When`, proximity, price, rating or availability control is rendered.

## Validation plan

- Extend coach-filter domain tests for URL construction/normalization boundaries where needed.
- Add browser checks for homepage-to-Explore submission, discipline chips, clearing and keyboard operation at mobile/desktop widths.
- Run application tests, lint, type-check, format, build and `git diff --check`.
- Database tests are not applicable unless implementation changes repository query semantics, which is outside this ticket.

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

No new API, schema, provider, environment variable or migration is planned. Existing public query parameters remain backward compatible.

## Validation results

Pending validation.

| Criterion | Evidence | Result  |
| --------- | -------- | ------- |
| AC1       | Pending  | Not run |
| AC2       | Pending  | Not run |
| AC3       | Pending  | Not run |
| AC4       | Pending  | Not run |

## Risks, limitations, and follow-ups

- Visually compact variants must not fork labels, parameter names or filtering behavior.
- Date/time search requires a future contract and must not be smuggled into generic search state.

## Completion and review references

- Completed: Not completed.
- Commit: Planning record included in the commit whose subject references DEV0195-DEV0201; implementation not started.
- Review: No review created.
- Deployment or release: Not deployed or released.
