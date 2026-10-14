# Ticket DEV0226: Remove Home coach or focus search

- Status: Ready
- Created: 2026-10-14
- Last updated: 2026-10-14
- Milestone: M3 — Scheduling interface follow-up
- Coordination: None — independent development ticket
- Related records: future-search follow-up [DEV0227 — Reintroduce Home search after client feedback](DEV0227-reintroduce-home-search-after-client-feedback.md); later grid redesign [DEV0228](DEV0228-build-home-coach-grid-with-discipline-filter.md); historical shared-search baseline [DEV0197](../../archive/frontend/DEV0197-share-public-marketplace-search.md) and Home baseline [DEV0198](../../archive/frontend/DEV0198-build-search-first-marketplace-home.md); downstream integration review [DEV0201](DEV0201-polish-public-marketplace-accessibility.md) under [COR0017](../organisatory/COR0017-public-marketplace-redesign.md)

## Objective and context

Home currently displays a `Search coach or focus` text field alongside discipline and location filters. On 2026-10-14 the user requested removing that field for now and revisiting it after talking to more clients. The user then explicitly selected **Create tickets only**; this record plans the removal and does not deliver it.

The [current discovery contract](../../../docs/mvp-spec.md#42-discover-a-coach-and-time), decision C27 in the [confirmed decision register](../../../docs/mvp-spec.md#2-confirmed-target-and-decisions), [scheduling interface milestone](../../../docs/mvp-spec.md#12-delivery-milestones) and [Home acceptance scenario](../../../docs/mvp-spec.md#13-acceptance-matrix) still describe the delivered search-first Home. Reconcile those requirements in the implementation change, including the related definition-of-done and scheduling-behavior text.

## Scope and non-goals

- In scope: remove Home's coach/focus text field and its `q` submission; adapt Home copy and layout; retain discipline/location filtering, discipline links, authoritative coach previews and Explore/profile access; update the specification and affected tests when implemented.
- Out of scope: removing the entire Home filter panel, changing Explore search or its supported URLs, deleting query normalization/backend matching, changing maps or booking authority, collecting client feedback, or reintroducing search under this ticket.

## Expected behavior and edge cases

- Home has no `Search coach or focus` label, query input or hidden `q` control. Remaining discipline/location controls submit to Explore through the existing GET form and work without JavaScript.
- Home's discipline links, full-directory link, coach cards, pending-confirmation explanation and coach application action remain usable. Its bounded alphabetical preview and honest ready/empty/unavailable states retain their existing authority.
- Home copy describes the controls that remain and does not invite typing a coach name or focus into a removed field. The smaller form fits mobile and desktop layouts with logical keyboard order and visible focus.
- Explore retains its coach/focus field, canonical `q` URLs, normalization, clear-filter behavior and filter-preserving list/map navigation. Bookmarked Explore queries continue to work.
- Do not substitute hard-coded coaches or invent new search, availability, proximity, price or rating claims.

## Assumptions, decisions, and dependencies

- Confirmed: temporarily remove the named Home control, preserve the option to revisit it after more client conversations, and create planning records only in this change.
- Confirmed clarification on 2026-10-14: keep a prominent discipline/location search area, remove only coach/focus search, and plan one grid with All disciplines as the default under DEV0228. This ticket retains the current Explore submission; DEV0228 owns any later adopted Home filter-routing change.
- Earlier scoped assumption, now explicitly confirmed: discipline/location search stays and only the named coach/focus field is removed. Explore remains outside the removal scope. Update the ticket before implementing any broader change.
- Proposed implementation default: use an explicit Home configuration of the existing shared search component rather than duplicate its form or remove the field globally. Explore keeps the existing default behavior.
- DEV0197 and DEV0198 are completed foundations. DEV0227 is an independent future follow-up, not a prerequisite or part of this ticket's completion criteria. DEV0201 should review the resulting public flow against the updated specification after removal is delivered.
- No dependency, environment variable, migration or external service is needed for the removal.

## Implementation plan

1. Recheck the installed Next.js version and relevant bundled guidance. Review this bounded scope against the existing Home/Explore shared component and preserve unrelated work.
2. Update the specification's C27, discovery flow, scheduling behavior, definition of done, M3 wording and Home acceptance row to distinguish Home's reduced filters from Explore's retained query search. Record this as temporary, with DEV0227 as the future decision point.
3. Configure [the shared form](../../../src/features/coaches/public-marketplace-search.tsx) to omit the query control only on Home; adapt [Home composition/copy](../../../src/features/public/coach-story.tsx) and relevant styles in `src/app/coach-story.css` and `src/app/coach-discovery.css` without losing the remaining controls or directory states.
4. Update existing [Home tests](../../../tests/home-marketplace.test.ts), [shared-search tests](../../../tests/marketplace-search.test.ts) and [public browser flows](../../../tests/browser/public-story.spec.ts) for Home filtering without `q`, while retaining coverage of Explore query search and JavaScript-free submission.
5. Verify the acceptance criteria, record exact results and reconcile the downstream public integration record with this later change. Complete and archive this ticket only after removal and required validation pass.

## Acceptance criteria

- [ ] AC1: Home omits the coach/focus field and any `q` submission, and its copy accurately describes the retained discovery controls.
- [ ] AC2: Home's discipline/location form and discipline links reach canonical Explore results with keyboard and JavaScript-free submission; previews, directory/profile links and ready/empty/unavailable states remain usable.
- [ ] AC3: Explore still supports coach/focus queries, normalization, bookmarked URLs, clearing filters and filter-preserving list/map navigation.
- [ ] AC4: Home is usable at mobile and desktop widths without overflow or awkward empty layout; relevant tests, lint, type checks, formatting and build pass, and the specification and review records describe the delivered distinction.

## Validation plan

- Extend existing component tests to prove Home excludes the query control while Explore's default form retains it; verify retained filters, content and directory states.
- Update the existing public-story browser flow for Home discipline/location submission without `q`; verify direct Explore queries, canonicalization, clear filters and browser history. Keep JavaScript-free checks for Home filtering and Explore query submission.
- Inspect Home at 375, 430, 768, 1024 and 1440 px, tab through all retained controls and links, and inspect unavailable/empty states. Use configuration-free preview for failure state and the existing local database fixtures for real cards.
- Run `npm test`, `npx playwright test tests/browser/public-story.spec.ts`, `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build`, targeted Markdown format/link checks and `git diff --check`.
- Database migration, authorization and payment rehearsals are not applicable: this ticket changes presentation only and preserves their contracts.

## Implementation record

Application implementation has not started. This is the ticket-only handoff requested on 2026-10-14.

### Changes and rationale

Created a Ready removal plan and linked a separate Draft future-search ticket so temporary simplification does not silently schedule reintroduction before client feedback.

### Affected files

| File or component                                                   | Change and purpose                                                                               |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| This record                                                         | Defines the bounded Home removal, preserved Explore behavior and required implementation checks. |
| [DEV0227](DEV0227-reintroduce-home-search-after-client-feedback.md) | Records the future search decision and client-feedback prerequisite.                             |
| [Ticket index](../../README.md)                                     | Lists both plans and advances the next available development identifier.                         |

### Decisions and deviations

2026-10-14: Planning only, following the user's explicit clarification. No application, product-specification or existing completed-ticket edits were made. The runtime plan remains pending.

2026-10-14 follow-up: The user clarified that the search area stays while its coach/focus field is removed. Linked DEV0228 for the separately planned one-grid layout and default All disciplines filter; this ticket's removal scope is unchanged.

### Contracts, configuration, and operations

No current runtime, URL, data, dependency, environment or setup contract changed. Implementation will change Home's visible/form contract only and reconcile the specification; Explore query compatibility remains required. No migration is planned.

## Validation results

Planning validation passed on 2026-10-14 in the local repository:

- `python3 /tmp/movx-search-ticket-check.py` checked the ticket index and both new records: 218 relative links, 15 section anchors, 168 unique DEV/COR records, required template fields, open acceptance criteria, reciprocal follow-up links, index statuses and next identifiers all passed.
- `./node_modules/.bin/prettier --check tickets/current/frontend/DEV0226-remove-home-coach-focus-search.md tickets/current/frontend/DEV0227-reintroduce-home-search-after-client-feedback.md` passed for both records.
- `git diff --check` passed. Scope self-review confirmed only these two new tickets and their index entries/next-ID update belong to this change; existing unrelated edits were preserved.

Application tests, browser rehearsals, lint, type checks and build were not run because the user requested tickets only and no application/configuration/specification changes were made. All runtime acceptance criteria remain unmet.

| Criterion | Evidence                                                    | Result  |
| --------- | ----------------------------------------------------------- | ------- |
| AC1–AC4   | Pending application implementation and required validation. | Not run |

## Risks, limitations, and follow-ups

The form is shared with Explore, so a global deletion would exceed this scope. The current runtime/specification still require and display Home query search until this ticket is implemented. Future reintroduction is owned by [DEV0227](DEV0227-reintroduce-home-search-after-client-feedback.md) and requires client feedback plus a confirmed scope. Next action: implement the reviewed removal plan when implementation is requested.

Commit handoff on 2026-10-14: the user authorized committing these interlinked planning records. Include DEV0226, DEV0227, DEV0228 and only their ticket-index entries. Keep all runtime criteria open and retain the existing Ready/Draft statuses. The response previews remain local under the ignored `work/` directory; do not force-add them or include the separate `.gitignore`/connection changes.

Commit-preparation validation: `python3 /tmp/movx-home-plan-commit-check.py` passed 52 relative-link checks, 12 section-anchor checks, metadata/index-status consistency for DEV0226–DEV0228 and uniqueness checks for 171 DEV/COR records. Targeted `prettier --check` for the three tickets and `tickets/README.md` and `git diff --check` passed. Staged whitespace/scope review accompanies the commit; earlier preview validation remains recorded in DEV0228. No application tests/build are needed for committing planning documents without runtime changes.

## Completion and review references

- Completed: Not completed — planning only.
- Commit: Planning records included in `[DEV0226] [DEV0227] [DEV0228] Record Home discovery plans`; application implementation remains pending.
- Review: Scope self-review completed; no independent review created.
- Deployment or release: No application change or deployment.
