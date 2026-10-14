# Ticket DEV0226: Remove Home coach or focus search

- Status: Completed
- Created: 2026-10-14
- Last updated: 2026-10-14
- Milestone: M3 — Scheduling interface follow-up
- Coordination: None — independent development ticket
- Related records: future-search follow-up [DEV0227 — Reintroduce Home search after client feedback](../../current/frontend/DEV0227-reintroduce-home-search-after-client-feedback.md); later grid redesign [DEV0228](DEV0228-build-home-coach-grid-with-discipline-filter.md); historical shared-search baseline [DEV0197](DEV0197-share-public-marketplace-search.md) and Home baseline [DEV0198](DEV0198-build-search-first-marketplace-home.md); downstream integration review [DEV0201](../../current/frontend/DEV0201-polish-public-marketplace-accessibility.md) under [COR0017](../../current/organisatory/COR0017-public-marketplace-redesign.md)

## Objective and context

Home previously displayed a `Search coach or focus` text field alongside discipline and location filters. On 2026-10-14 the user requested removing that field for now and revisiting it after talking to more clients. The user initially selected **Create tickets only**. Later the same day they asked to start DEV0226, authorizing this bounded implementation before DEV0228.

The [current discovery contract](../../../docs/mvp-spec.md#42-discover-a-coach-and-time), decision C27 in the [confirmed decision register](../../../docs/mvp-spec.md#2-confirmed-target-and-decisions), [scheduling interface milestone](../../../docs/mvp-spec.md#12-delivery-milestones) and [Home acceptance scenario](../../../docs/mvp-spec.md#13-acceptance-matrix) now distinguish Home’s discipline/location filters from Explore’s retained coach/focus query. The definition-of-done and scheduling-behavior text reflect that same boundary.

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

- Confirmed: temporarily remove the named Home control and preserve the option to revisit it after more client conversations. The initial planning-only instruction was followed in commit `8d61c1b`; the subsequent request to start this ticket authorizes its implementation.
- Confirmed clarification on 2026-10-14: keep a prominent discipline/location search area, remove only coach/focus search, and plan one grid with All disciplines as the default under DEV0228. This ticket retains the current Explore submission; DEV0228 owns any later adopted Home filter-routing change.
- Earlier scoped assumption, now explicitly confirmed: discipline/location search stays and only the named coach/focus field is removed. Explore remains outside the removal scope. Update the ticket before implementing any broader change.
- Adopted implementation default: add an optional `includeQuery` configuration to the shared search component, defaulting to true for Explore. Home passes false. Omit the field and strip query values from Home discipline links/clear-filter state so no invisible coach/focus query is carried into Explore. Reuse the existing two-column/stacked Home layout; adapt its submit-button span only if responsive review shows a gap.
- DEV0197 and DEV0198 are completed foundations. DEV0227 is an independent future follow-up, not a prerequisite or part of this ticket's completion criteria. DEV0201 should review the resulting public flow against the updated specification after removal is delivered.
- No dependency, environment variable, migration or external service is needed for the removal.

## Implementation plan

1. Recheck the installed Next.js version and relevant bundled guidance. Review this bounded scope against the existing Home/Explore shared component and preserve unrelated work.
2. Update the specification's C27, discovery flow, scheduling behavior, definition of done, M3 wording and Home acceptance row to distinguish Home's reduced filters from Explore's retained query search. Record this as temporary, with DEV0227 as the future decision point.
3. Configure [the shared form](../../../src/features/coaches/public-marketplace-search.tsx) to omit the query control only on Home; adapt [Home composition/copy](../../../src/features/public/coach-story.tsx) and relevant styles in `src/app/coach-story.css` and `src/app/coach-discovery.css` without losing the remaining controls or directory states.
4. Update existing [Home tests](../../../tests/home-marketplace.test.ts), [shared-search tests](../../../tests/marketplace-search.test.ts) and [public browser flows](../../../tests/browser/public-story.spec.ts) for Home filtering without `q`, while retaining coverage of Explore query search and JavaScript-free submission.
5. Verify the acceptance criteria, record exact results and reconcile the downstream public integration record with this later change. Complete and archive this ticket only after removal and required validation pass.

## Acceptance criteria

- [x] AC1: Home omits the coach/focus field and any `q` submission, and its copy accurately describes the retained discovery controls.
- [x] AC2: Home's discipline/location form and discipline links reach canonical Explore results with keyboard and JavaScript-free submission; previews, directory/profile links and ready/empty/unavailable states remain usable.
- [x] AC3: Explore still supports coach/focus queries, normalization, bookmarked URLs, clearing filters and filter-preserving list/map navigation.
- [x] AC4: Home is usable at mobile and desktop widths without overflow or awkward empty layout; relevant tests, lint, type checks, formatting and build pass, and the specification and review records describe the delivered distinction.

## Validation plan

- Extend existing component tests to prove Home excludes the query control while Explore's default form retains it; verify retained filters, content and directory states.
- Update the existing public-story browser flow for Home discipline/location submission without `q`; verify direct Explore queries, canonicalization, clear filters and browser history. Keep JavaScript-free checks for Home filtering and Explore query submission.
- Inspect Home at 375, 430, 768, 1024 and 1440 px, tab through all retained controls and links, and inspect unavailable/empty states. Use configuration-free preview for failure state and the existing local database fixtures for real cards.
- Run `npm test`, `npx playwright test tests/browser/public-story.spec.ts`, `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build`, targeted Markdown format/link checks and `git diff --check`.
- Database migration, authorization and payment rehearsals are not applicable: this ticket changes presentation only and preserves their contracts.

## Implementation record

Implementation started on 2026-10-14 after the user's request to begin DEV0226. Reviewed installed Next.js 16.3.8 bundled Form and page/search-parameter documentation, shared native GET form, Home layout and current browser coverage. Keep the existing native GET submission and route/data boundaries; this change adds no Next.js Form component or Home query processing. The separate DEV0221 connection implementation remains untouched.

### Changes and rationale

Created a Ready removal plan and linked a separate Draft future-search ticket so temporary simplification does not silently schedule reintroduction before client feedback.

2026-10-14 implementation: Home uses `PublicMarketplaceSearch` with `includeQuery={false}`. Its form renders only discipline/location fields and a submit button; derived Home search state clears any query before building discipline links or clear-filter state. The shared default remains true for Explore, preserving its query controls and compatible URLs. Home copy now describes discipline/training-place browsing. The existing Home two-column layout receives one scoped full-width submit-button rule, avoiding a half-empty final row after removing the third field; mobile remains stacked. Home directory reads, the three-coach alphabetical preview, cards, data/error states and booking authority remain unchanged.

Reconciled the specification's C27, discovery flow, scheduling behavior, definition of done, M3 wording and Home acceptance row. Linked the future feedback decision and separately planned DEV0228 without importing its grid or 15-coach limit into this delivery. DEV0201/COR0017 receive an independent follow-up handoff, leaving their wider integration criteria open.

### Affected files

| File or component                                                                                                                                                                | Change and purpose                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| This record                                                                                                                                                                      | Defines the bounded Home removal, preserved Explore behavior and required implementation checks.                                |
| [DEV0227](../../current/frontend/DEV0227-reintroduce-home-search-after-client-feedback.md)                                                                                       | Records the future search decision and client-feedback prerequisite.                                                            |
| [Ticket index](../../README.md)                                                                                                                                                  | Lists both plans and advances the next available development identifier.                                                        |
| [Shared search](../../../src/features/coaches/public-marketplace-search.tsx)                                                                                                     | Adds the optional query configuration and removes hidden query propagation for Home while keeping Explore's default.            |
| [Home composition](../../../src/features/public/coach-story.tsx)                                                                                                                 | Selects the reduced form and describes its retained disciplines/training places accurately.                                     |
| [Home styles](../../../src/app/coach-story.css)                                                                                                                                  | Spans the Home submit action across its existing grid without altering Explore layout.                                          |
| [Search tests](../../../tests/marketplace-search.test.ts), [Home tests](../../../tests/home-marketplace.test.ts) and [browser flow](../../../tests/browser/public-story.spec.ts) | Verify the Home/Explore boundary, query-free links/submission, responsive keyboard order, history and JavaScript-free behavior. |
| [Specification](../../../docs/mvp-spec.md)                                                                                                                                       | Distinguishes Home's temporary discipline/location search from Explore's retained query contract.                               |
| [DEV0201](../../current/frontend/DEV0201-polish-public-marketplace-accessibility.md) and [COR0017](../../current/organisatory/COR0017-public-marketplace-redesign.md)            | Record the downstream public integration boundary without changing direct coordination membership.                              |

### Decisions and deviations

2026-10-14: Planning only, following the user's explicit clarification. No application, product-specification or existing completed-ticket edits were made. The runtime plan remains pending.

2026-10-14 follow-up: The user clarified that the search area stays while its coach/focus field is removed. Linked DEV0228 for the separately planned one-grid layout and default All disciplines filter; this ticket's removal scope is unchanged.

### Contracts, configuration, and operations

Home's visible GET-form contract now excludes `q`; its discipline links also exclude that value. Discipline/location submission still targets canonical `/explore` URLs. The shared component adds one optional boolean prop, defaulting to its existing full query behavior. No backend matching, directory data shape, identity/booking permission, dependency, environment setting, setup step or migration changed. Reverting the Home configuration/copy and scoped style restores its former form; Explore needs no migration or rollback.

## Validation results

Planning validation passed on 2026-10-14 in the local repository:

- `python3 /tmp/movx-search-ticket-check.py` checked the ticket index and both new records: 218 relative links, 15 section anchors, 168 unique DEV/COR records, required template fields, open acceptance criteria, reciprocal follow-up links, index statuses and next identifiers all passed.
- `./node_modules/.bin/prettier --check tickets/current/frontend/DEV0226-remove-home-coach-focus-search.md tickets/current/frontend/DEV0227-reintroduce-home-search-after-client-feedback.md` passed for both records.
- `git diff --check` passed. Scope self-review confirmed only these two new tickets and their index entries/next-ID update belong to this change; existing unrelated edits were preserved.

At the initial planning handoff, application tests, browser rehearsals, lint, type checks and build were not run because no runtime change was authorized. That historical omission is superseded by the implementation validation below.

Implementation validation passed on 2026-10-14 in the shared local working tree:

- `npm test` passed 125 unit tests and 14 server tests, including the Home composition/query-free shared-form checks and existing Explore canonical URL coverage. The initial sandbox run was blocked by tsx's local IPC socket; the approved rerun passed. Ongoing DEV0221 files were present for these checks but were not edited by this task; these results do not complete that separate ticket.
- `npm run lint`, `npm run typecheck` and `npm run format:check` passed. Type generation and TypeScript completed without errors.
- `npm run build` passed on installed Next.js 16.3.8, with `/` still rendered dynamically. The sandboxed compiler stalled at compilation and was stopped; the approved rerun compiled in 3.8 seconds and completed type checking/static generation. No framework or dependency workaround was introduced.
- `npx --no-install playwright test tests/browser/public-story.spec.ts` passed 12 browser checks with two intentional mobile skips: the five-width loop and JavaScript-free check run once in desktop, while the remaining Home/Explore flows also run in mobile. Verified absence of visible/hidden Home `q`, Home discipline links and normalized discipline/location submission, retained Explore query matching controls and canonical bookmarked URLs, clear/reload/back/forward behavior, JavaScript-free submission on both routes, navigation and overflow checks at 375/430/768/1024/1440 px.
- The first browser run had 11 passes, two skips and one failure in the new width check: an exact `getByLabel` selector included native select option text. Changed that locator to the actual `combobox` role/name; the full rerun passed. This was a test selector correction, not a product label workaround.
- `node /tmp/dev0226-live-home-check.mjs` passed a read-only check against the already-running local app on port 3100. At 1440 and 393 px, Home retained three database-backed fixture cards starting with Daniel Park, profile links, query-free form, discipline navigation to Explore, keyboard order and no page overflow. No account, booking, connection or directory data was mutated.
- Inspected `/tmp/dev0226-live-home-1440.png` and `/tmp/dev0226-live-home-393.png`: desktop discipline/location fields share a row above the full-width action; mobile controls stack; the action has a visible keyboard focus ring; real fixture cards, initials, confirmation explanation and coach application remain usable. Empty/unavailable and portrait-fallback component tests passed against the unchanged directory boundary.
- `python3 /tmp/dev0226-record-check.py` passed 294 relative-link checks, 19 section-anchor checks, completed/archive/index consistency, uniqueness checks for 173 DEV/COR records and the Home/Explore/specification boundary checks. Targeted `prettier --check` passed for the seven affected documentation records and browser file; `git diff --check` passed. No migration, database mutation, authorization change, deployment or separate independent review is required/claimed for this interface-only delivery.

| Criterion | Evidence                                                                                                                                                      | Result |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Home composition/shared-form tests; browser field absence and updated Home copy.                                                                              | Passed |
| AC2       | Native GET and discipline-link browser flows with/without JavaScript; fixture-backed profile/card checks and honest directory-state tests.                    | Passed |
| AC3       | Existing search-contract tests and browser normalization, bookmarked URL, clear/reload/back/forward checks on Explore.                                        | Passed |
| AC4       | Five-width keyboard/overflow checks, desktop/mobile visual inspection, all unit/static/build/browser checks and reconciled specification/integration handoff. | Passed |

## Risks, limitations, and follow-ups

The shared form retains its full Explore default; Home’s query omission is explicit and reversible. Future reintroduction is owned by [DEV0227](../../current/frontend/DEV0227-reintroduce-home-search-after-client-feedback.md) and requires client feedback plus a confirmed scope. DEV0228 remains independently planned for the grid/filter/15-coach Load more redesign; its runtime implementation and proximity-search proposals were not delivered here. DEV0201 still owes broader public integration review.

Historical planning commit handoff on 2026-10-14: the user authorized committing these interlinked planning records. Include DEV0226, DEV0227, DEV0228 and only their ticket-index entries. Keep all runtime criteria open and retain the existing Ready/Draft statuses. The response previews remain local under the ignored `work/` directory; do not force-add them or include the separate `.gitignore`/connection changes.

Commit-preparation validation: `python3 /tmp/movx-home-plan-commit-check.py` passed 52 relative-link checks, 12 section-anchor checks, metadata/index-status consistency for DEV0226–DEV0228 and uniqueness checks for 171 DEV/COR records. Targeted `prettier --check` for the three tickets and `tickets/README.md` and `git diff --check` passed. Staged whitespace/scope review accompanies the commit; earlier preview validation remains recorded in DEV0228. No application tests/build are needed for committing planning documents without runtime changes.

## Completion and review references

- Completed: 2026-10-14 — local implementation and required validation passed.
- Commit: Planning records are in `8d61c1b`; implementation, validation, archive and link repairs are included in `[DEV0226] Remove Home coach or focus search` (this commit).
- Review: Implementation/acceptance self-review completed; independent public integration remains DEV0201.
- Deployment or release: Local implementation only; not deployed or released.
