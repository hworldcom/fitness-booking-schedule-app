# Ticket DEV0229: Correct browser rehearsal assumptions

- Status: Completed
- Created: 2026-10-14
- Last updated: 2026-10-14
- Milestone: Scheduling browser validation maintenance
- Coordination: None — independent development ticket
- Related records: validation consumer [DEV0220](DEV0220-use-athlete-website-terminology.md); broader public QA [DEV0201](../../current/frontend/DEV0201-polish-public-marketplace-accessibility.md) and private QA [DEV0208](../../current/frontend/DEV0208-polish-authenticated-workspace-accessibility.md)

## Objective and context

Correct existing browser-test assumptions exposed during DEV0220's validation. With the actual local database configured, the suite wrongly requires Daniel Park to have exactly one open time today and only Sam Lee to match Muay Thai, looks for desktop map controls while mobile defaults to its list, and expects guests to enter private workspace chrome even when configured authentication correctly redirects them. These assumptions contradict the [current discovery/navigation contract](../../../docs/mvp-spec.md#9-scheduling-behavior-and-permissions); they are unrelated to athlete wording or runtime regressions.

## Scope and non-goals

- In scope: bounded corrections to `tests/browser/coach-discovery.spec.ts` and `tests/browser/public-story.spec.ts`, preserving public discovery, card/map consistency, mobile-specific failure recovery and guest authorization checks.
- Out of scope: app logic/copy, database/fixtures, Playwright configuration, test-only product fallbacks, new test dependencies, broad accessibility implementation and hosted operations.

## Expected behavior and edge cases

- Discovery accepts a truthful current today summary, including no availability, and verifies the selected map preview agrees with the coach card rather than asserting a fixed count on every calendar day. Discipline filtering validates every returned card and the displayed result count instead of assuming only one current coach offers Muay Thai.
- Side-by-side directory/map comparison and the common map failure panel test run on desktop; existing explicit mobile list/map/filter/history and recovery tests remain the mobile authority. A default mobile list must not be required to expose hidden desktop map controls.
- Private chrome checks validate the sign-in redirect/return destination for configured guests, while configuration-free preview still exercises the private shell. Authenticated private layouts remain covered by actual local rehearsals, not fabricated actor authority.

## Assumptions, decisions, and dependencies

- DEV0220's twelve source files preserve AST structure and technical values; the initial configured suite passed 41, failed 5 and skipped 6 tests. The five failures reduce to the three assumptions above across both projects.
- The user authorized DEV0220 implementation and its required validation. Separate ownership prevents its participant-copy scope from absorbing unrelated test harness changes.
- Reuse the current local stack and existing loopback environment helpers; do not reset or seed the user's data merely to satisfy an assertion.

## Implementation plan

1. Replace fixed today/filter counts with bounded current summaries, compare card/selected-preview presentation and validate the returned discipline cards/count.
2. Scope desktop dual-surface comparison and failure-panel tests to desktop, retaining the existing separate mobile list/map/filter/history and recovery scenarios.
3. Adapt the private-chrome test to verify configured guest redirects before its preview-shell assertions.
4. Run the complete desktop/mobile suite with internal local environment injection, record results and archive this record only when criteria pass.

## Acceptance criteria

- [x] AC1: A coach remains testable with zero or varying open times today, and selected-preview/card status consistency is checked.
- [x] AC2: Desktop map failure and the existing mobile recovery flow pass in their appropriate views without losing mobile coverage.
- [x] AC3: Configured guests are verified as redirected with the correct return path, preview chrome remains checked, and the full relevant browser suite passes without app/configuration/data changes.

## Validation plan

Run installed Prettier, `git diff --check` and the full existing Playwright suite against the built app with the existing loopback helper-derived environment held only in the child process. Validate both configuration-free preview and configured guest behavior using prior results and current runs. App unit/type/lint/build checks are also recorded by DEV0220; no new runtime logic or database migration requires database tests here.

## Implementation record

Started on 2026-10-14 after the configured suite identified these specific expectation failures.

### Changes and rationale

- Replaced the fixed one-open-time expectation with a bounded current today summary and verified the selected coach preview repeats the card's actual label.
- Discipline filtering now checks the actual result count, every returned card's Muay Thai tag and one map marker per filtered coach, retaining Sam's expected presence without falsely excluding another current matching coach.
- Scoped the dual-surface comparison and failure-panel scenarios to desktop, whose list/map are simultaneously visible. Existing mobile view/filter/history, pin-preview and provider-failure-to-list scenarios remain active.
- Private workspace tests now verify the correct sign-in return path and absence of private chrome for configured guests; configuration-free preview retains its full shell/layout/focus checks. Real signed-in account/coach layouts were validated independently by DEV0220's local rehearsals and readonly desktop/mobile review.

### Affected files

| File                                                                                    | Change and purpose                                                                                          |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| [tests/browser/coach-discovery.spec.ts](../../../tests/browser/coach-discovery.spec.ts) | Current today/card/preview and discipline-count consistency, plus explicit desktop versus mobile scenarios. |
| [tests/browser/public-story.spec.ts](../../../tests/browser/public-story.spec.ts)       | Configured guest redirects versus private preview chrome without changing runtime authorization.            |

### Decisions and deviations

- 2026-10-14 allocation correction before any commit: this record was initially drafted with conflicting DEV0226, which belongs to the separately created Home-search removal plan. Corrected this accidental duplicate allocation to the next unused DEV0229 after checking current/archive and unavailable-ID records. Original DEV0226–DEV0228 records and their ownership are preserved; the mistaken draft label does not retire their valid IDs. Implementation/validation history above is retained.
- 2026-10-14 commit isolation: the ticket index reserves DEV0226–DEV0228 for the independently prepared Home records. Their planning files and index entries remain outside this commit; the reservation prevents ID reuse without committing unrelated work.

- No product behavior changes; do not replace actual data or weaken authorization to satisfy tests.
- 2026-10-14 refinement before the final filter assertion edit: the first corrected comparison test reached a second fixed-inventory assumption, that only Sam Lee offers Muay Thai. The current directory includes another matching coach. Validate the actual filtered cards and result count while retaining Sam's expected presence; do not overwrite existing coach profiles or preserve a false exclusion.

### Contracts, configuration, and operations

No app interface, dependency, environment variable, migration or fixture change. Temporary validation setup injects existing local settings internally and does not persist private values.

## Validation results

- Environment: existing local Supabase/Auth/PostgreSQL/Mailpit; no reset, seed or fixture replacement occurred. Node.js 24.21.0/Next.js 16.3.8 production build and existing desktop/mobile Playwright projects.
- Before these fixes, the configured suite passed 41, failed 5 and skipped 6. After the first corrections it passed 43, failed 1 and skipped 8; the remaining failure was the fixed one-coach filter assumption. Those failed results are retained as investigation evidence.
- `npm run lint`, `npm run typecheck`, `npm run format:check` and `git diff --check` passed after the final test changes. Existing application/build/Auth/coach-request and readonly account-layout checks passed under DEV0220.
- `node_modules/.bin/tsx /tmp/movx-dev0220-local-browser-suite.ts --skip-build` runs the existing full suite against the already validated build with the existing loopback parser/environment factory. Configuration values stay internal; no environment file, configuration API or runtime code changed.
- `node_modules/.bin/tsx /tmp/movx-dev0220-local-browser-suite.ts --skip-build`: final full-suite result: 44 passed, 8 project-specific skips, 0 failed. Project-specific skips distinguish desktop dual-surface and mobile presentation scenarios; they do not replace the existing mobile recovery tests.

| Criterion | Evidence                                                                                                                       | Result |
| --------- | ------------------------------------------------------------------------------------------------------------------------------ | ------ |
| AC1       | Current today status, card/preview agreement, discipline result and marker counts pass using existing data.                    | Passed |
| AC2       | Desktop map failure and the existing mobile list/map/history/provider-recovery scenarios passed.                               | Passed |
| AC3       | Guest return-path/private-chrome checks and the full suite passed (44/8 project skips); no runtime/configuration/data changes. | Passed |

The final Markdown/link/identifier/index check passed after archival; no duplicate prefixed ID or stale moved-ticket destination remains. The separate Home DEV0226–DEV0228 records were preserved.

## Risks, limitations, and follow-ups

Broad DEV0201/DEV0208 accessibility matrices remain independent. The suite still requires its standard published five-coach directory; date and discipline results no longer assume an immutable single coach/count. Real signed-in authority is validated through existing local rehearsals. Required validation is complete. No runtime feature, fixture setup, configuration contract or host deployment changed.

## Completion and review references

- Completed: 2026-10-14 — acceptance criteria and required local validation passed.
- Commit: `[DEV0220][DEV0229] Use athlete terminology and align browser checks` — includes both completed records and their validation evidence; independent Home planning and other workspace edits are excluded.
- Review: No independent review created.
- Deployment or release: Not applicable — browser-test maintenance.
