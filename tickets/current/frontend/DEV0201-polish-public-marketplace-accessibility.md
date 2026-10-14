# Ticket DEV0201: Polish public marketplace accessibility

- Status: Draft
- Created: 2026-10-12
- Last updated: 2026-10-14
- Milestone: Scheduling interface public-marketplace follow-up
- Coordination: [COR0017 — Public marketplace redesign](../organisatory/COR0017-public-marketplace-redesign.md)
- Related records: completed integration dependencies [DEV0196 — Introduce the public marketplace shell](../../archive/frontend/DEV0196-introduce-public-marketplace-shell.md), [DEV0197 — Share public marketplace search](../../archive/frontend/DEV0197-share-public-marketplace-search.md), [DEV0198 — Build the search-first marketplace home](../../archive/frontend/DEV0198-build-search-first-marketplace-home.md), [DEV0199 — Redesign desktop coach Explore](../../archive/frontend/DEV0199-redesign-desktop-coach-explore.md) and [DEV0200 — Add mobile Explore map/list state](../../archive/frontend/DEV0200-add-mobile-explore-map-list-state.md); separate private-interface follow-up [COR0018 — Authenticated workspace redesign](../organisatory/COR0018-authenticated-workspace-redesign.md)

## Objective and context

Perform the final cross-surface accessibility, responsive and failure-state pass after the public shell, homepage and Explore redesign tickets satisfy their own acceptance criteria. This ticket owns integration-level corrections and final browser evidence, not deferred implementation from incomplete peer tickets.

## Scope and non-goals

- In scope:
  - Review semantic headings/regions, labels, alt behavior, visible focus, focus order, reduced motion and live/status announcements across public routes.
  - Resolve cross-surface overflow, sticky-header/map obstruction, tap-target, long-text and breakpoint defects.
  - Verify ready, empty, unavailable, map-loading/failure, missing-image and signed-out/signed-in states.
  - Consolidate redundant public marketplace styles only where behavior and ticket ownership are already stable.
- Out of scope:
  - New search/data features, analytics, visual rebranding, backend behavior or product-policy changes.
  - Repairing unmet peer acceptance criteria under a different ticket; those return to the owning peer first.

## Expected behavior and edge cases

- Public Home, Explore, coach profiles, How it works and sign-in have one logical heading/focus structure and no duplicate navigation landmarks.
- Keyboard users can search, use chips, select coach cards/pins, switch mobile view and reach profile/request destinations with visible focus.
- Approximately 375 px, 430 px, 768 px, 1024 px and 1440 px layouts have no horizontal overflow, clipped controls, obscured content or unusable sticky elements.
- Reduced-motion users do not receive forced smooth scrolling or nonessential movement.
- Failure/empty states preserve the next truthful action and never expose fabricated data.

## Assumptions, decisions, and dependencies

- DEV0195 supplies the adopted public/private navigation, search-first data and responsive Explore acceptance contract.
- DEV0196-DEV0200 must each meet their own acceptance criteria before this ticket starts.
- Later independent Home follow-up [DEV0226](../../archive/frontend/DEV0226-remove-home-coach-focus-search.md) removes only Home's coach/focus field. Review the retained Home discipline/location controls and Explore's full query search against the current specification; this follow-up does not transfer its implementation scope into integration polish.
- Existing MovX tokens, Bricolage Grotesque display type and Manrope body type remain the visual foundation.
- Automated accessibility checks assist but do not replace manual keyboard, responsive and screen-reader-oriented semantic review.

## Implementation plan

1. Build a public-route/state/viewport validation matrix and audit semantic/navigation duplication.
2. Run automated accessibility and responsive browser checks, then manually verify keyboard/focus and reduced-motion behavior.
3. Apply only integration-level CSS/markup/test corrections and route peer-owned regressions back to their ticket records.
4. Run the complete relevant unit/browser/build suite and record cross-ticket evidence in COR0017.

## Acceptance criteria

- [ ] AC1: All public redesign routes pass the documented keyboard, landmark, label, focus and reduced-motion review.
- [ ] AC2: The five target viewport widths pass without horizontal overflow, sticky obstruction, clipped text or undersized primary controls.
- [ ] AC3: Ready, empty, unavailable, map-failure, missing-image and representative actor states preserve truthful usable actions.
- [ ] AC4: Relevant application/browser checks, lint, type-check, formatting and production build pass, and COR0017 receives final integration evidence.

## Validation plan

- Add or extend Playwright coverage for the public route/state/viewport matrix and use automated accessibility tooling already present in the repository, if any.
- Manually tab through the complete guest search-to-profile/request-entry path and representative signed-in public/private transitions.
- Emulate `prefers-reduced-motion`, map failure, missing images and narrow/long-content cases.
- Run `npm test`, the complete relevant Playwright projects, `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build` and `git diff --check`.

## Implementation record

Pending implementation.

2026-10-14 downstream handoff from DEV0226: Home now has an explicit shared-form configuration that omits coach/focus input and query-bearing links, while Explore retains its default query contract. DEV0226 owns focused keyboard/responsive/submission validation. This ticket remains Draft and still owes the broader public integration review.

### Changes and rationale

Pending implementation.

### Affected files

| File or component | Change and purpose |
| ----------------- | ------------------ |
| Pending           | Pending.           |

### Decisions and deviations

None yet.

### Contracts, configuration, and operations

No data, API, schema, provider, dependency, environment or migration change is planned. Any newly required accessibility dependency would require updating this ticket before implementation.

## Validation results

Pending validation.

| Criterion | Evidence | Result  |
| --------- | -------- | ------- |
| AC1       | Pending  | Not run |
| AC2       | Pending  | Not run |
| AC3       | Pending  | Not run |
| AC4       | Pending  | Not run |

## Risks, limitations, and follow-ups

- This ticket must not become a catch-all for missing behavior. Integration fixes should remain small and explicitly traced to the affected route/state.
- Legal footer content remains limited to routes/content that actually exist; this ticket does not invent legal policies.

## Completion and review references

- Completed: Not completed.
- Commit: Planning record included in the commit whose subject references DEV0195-DEV0201; implementation not started.
- Review: No review created.
- Deployment or release: Not deployed or released.
