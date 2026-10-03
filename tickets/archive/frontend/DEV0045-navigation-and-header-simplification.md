# Ticket DEV0045: Navigation and header simplification

- Status: Completed
- Created: 2026-09-21
- Last updated: 2026-09-21
- Milestone: M0 visual refinement
- Coordination: None — independent development ticket
- Related records: Historical baseline [DEV0044](DEV0044-club-illustration-and-brand-polish.md)

## Objective and context

Match the navigation in the [accepted first concept](../../../docs/design/DEV0043-preferred-concept.png) and remove header search as requested. See the [visual contract](../../../docs/mvp-spec.md#visual-design-direction--21-september-2026).

## Scope and non-goals

Scope: shared desktop/mobile navigation icons and active styling, removal of header search field/mobile search shortcut and unused handler, specification and relevant browser checks. No changes to catalogue filters, public search route, authentication, payments or feed behavior.

## Expected behavior and edge cases

Feed uses a home icon, Explore a dumbbell, Challenges a trophy and Profile a person outline. Desktop navigation uses compact rounded lime selected links, charcoal labels and no trailing active dot. Carry the same icons and clear selected state to mobile. All destinations, aria-current, keyboard focus and nested route selection remain functional. Header retains location, guide, sign-in and wallet controls. No header search at any viewport width; existing /search links continue to work when opened directly.

## Assumptions, decisions, and dependencies

Treat removal as shared header UI removal, preserving existing catalogue search/filter behavior and direct URLs. Use installed Lucide icons and existing theme; no dependency required. User authorized design change. One bounded task; no split needed.

## Implementation plan

1. Update shared shell navigation icons and remove global search controls/handler.
2. Refine shared navigation styling and header spacing to match the reference.
3. Update specification and existing search entry tests; verify navigation and responsive header at desktop/mobile widths.
4. Record evidence and archive the completed ticket.

## Acceptance criteria

- [x] AC1: Desktop/mobile navigation matches reference icon language and selected styling while all four destinations work.
- [x] AC2: Header search and mobile shortcut are absent; guide, sign-in and wallet remain usable.
- [x] AC3: No narrow layout overflow; keyboard/nested-route navigation and direct search/filter behavior continue to work.
- [x] AC4: Specification and implementation evidence are current.

## Validation plan

Lint, types, formatting, production build; browser navigation/discovery and shared auth/wallet checks; desktop/mobile screenshots and narrow layouts. Database/devnet checks do not apply to UI-only change.

## Implementation record

### Changes, files and rationale

- [Shared shell](../../../src/components/shell.tsx): switched navigation to House/Dumbbell/Trophy/UserRound, filled the selected home icon, removed trailing active dots, header search form/mobile shortcut and unused router/form handler. Existing route matching and accessible link names remain intact.
- [Club theme](../../../src/app/club-theme.css): compact 44px desktop links, charcoal labels and a soft lime selected treatment; mobile uses matching icons and rounded lime selection. Existing keyboard focus rings are retained.
- [Base styles](../../../src/app/globals.css): removed unused global-search, mobile-search and active-dot selectors. Header right controls continue to align using existing auto margin.
- Discovery checks (historical path `tests/browser/discovery.spec.ts`): exercise retained catalogue search through its direct URL rather than deleted header controls.
- Redesign checks (historical path `tests/browser/redesign.spec.ts`): keyboard navigation through all four destinations, selected nested event route and absence of header search on desktop/mobile.
- [Specification](../../../docs/mvp-spec.md#visual-design-direction--21-september-2026): records icon/selection direction, removed header search and retained direct search contract; A56 updated consistently.

### Decisions and deviations

No scope deviations. Existing catalogue filters and direct search remain functional to preserve URLs while simplifying the shared header. No new packages or framework integration.

### Contracts and operations

Presentation and entry-point changes only. No data, API, environment, authentication or payment changes; no migration. Restarted the workspace's production preview after the build. No external deployment.

## Validation results

2026-09-21, local Node 24.21.0 / Next.js 16.3.5 production build, Chrome desktop/mobile:

- `npm run lint && npm run typecheck && npm run format:check` — passed.
- `npm run build` — passed.
- `npm run test:e2e -- tests/browser/redesign.spec.ts tests/browser/discovery.spec.ts tests/browser/auth.spec.ts tests/browser/wallet.spec.ts` — 22 passed in 1.7m. Includes keyboard navigation, nested selected state, no header search, 320/600/820/1100px layout checks, guide, filters, direct search, empty/malformed queries, clipboard failure and wallet/sign-in guidance.
- Inspected [desktop screenshot](../../../docs/design/DEV0045-desktop.png) and [mobile screenshot](../../../docs/design/DEV0045-mobile.png): expected reference icons, readable labels, lime selection, visible keyboard focus, no header search, retained guide/auth/wallet controls.
- `curl --fail --silent http://localhost:3100/ -o /private/tmp/repx-DEV0045-served.html` — successful; checked served markup for new icons and absence of removed search controls.
- `git diff --check` and local Markdown link checks — passed.
- Database and real devnet tests not applicable: no changes to those contracts.

| Criterion | Evidence                                              | Result |
| --------- | ----------------------------------------------------- | ------ |
| AC1       | Navigation keyboard test, desktop/mobile screenshots  | Passed |
| AC2       | Header absence assertions and guide/auth/wallet tests | Passed |
| AC3       | Responsive, nested route and direct-search checks     | Passed |
| AC4       | Updated specification and record, local link checks   | Passed |

## Risks, limitations, and follow-ups

Direct /search remains available for existing links but has no header entry point. No new feature work.

## Completion and review references

- Completed: 2026-09-21; all criteria verified.
- Commit: Included in `[DEV0043] [DEV0044] [DEV0045] Refine club design and simplify navigation` under the user’s 2026-09-21 commit/push request.
- Review: Self-reviewed code, screenshots and acceptance evidence; no independent review.
- Deployment or release: Local preview only.

### Commit handoff — 21 September 2026

The user authorized committing and pushing the completed UI work. DEV0043–DEV0045 share successive edits in the theme, shell, specification and browser checks; the final tested state is committed together with all three development IDs. Earlier validation results above remain the implementation evidence. No additional product change is introduced by this handoff.
