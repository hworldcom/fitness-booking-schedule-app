# Ticket DEV0076: Make the Home proposition count-neutral

- Status: Completed
- Created: 2026-09-26
- Last updated: 2026-09-26
- Milestone: M0 truthful positioning refinement
- Coordination: [COR0007 — Core multi-gym membership MVP](../organisatory/COR0007-core-multigym-membership-mvp.md)
- Related records: follows completed public story [DEV0073](DEV0073-rewrite-multigym-public-story.md); preserves the exact-four selection contract delivered by [DEV0075](DEV0075-preview-membership-selection.md)

## Objective and context

Refine Home so its opening proposition leads with a membership built around the member's routine rather than advertising the fixed number of core gyms. The product still requires exactly four core gyms per membership period; that rule remains explicit in How it works and the selection flow.

## Scope and non-goals

- In scope: replace the Home hero eyebrow, headline and description with the user-selected proposition; remove fixed-count language from the Home plan summary and Home-visible shell prompts; align Home/root metadata; update focused browser assertions.
- Out of scope: changing the exactly-four product rule, How it works, plan pricing, gym discovery, selection mechanics, fixtures, database/API behavior, payment or deployment.

## Expected behavior and edge cases

Home says “Your gyms. One membership.” and “A membership built around your routine.” Supporting copy refers to selected core gyms and the core set without naming four. It must not imply access to every participating gym. How it works continues to disclose the exact four-gym rule before a future member reaches selection.

## Assumptions, decisions, and dependencies

- The user explicitly confirmed that membership setup remains fixed at exactly four gyms and requested count-neutral Home positioning only.
- “Selected core gyms” distinguishes included gyms from the separate eligible €15 non-core visit without placing the implementation rule in the Home headline.
- DEV0073 remains unchanged as completed history; this ticket records the later refinement.

## Implementation plan

1. Update Home hero, Home plan summary, Home-visible shell prompts and metadata without altering plan or non-core terms.
2. Update focused browser content assertions to protect both the chosen proposition and the absence of a fixed count on Home.
3. Run formatting, lint, type, build and desktop/mobile browser checks; visually review the revised hero wrapping.

## Acceptance criteria

- [x] AC1: Home displays the selected eyebrow, headline and description without presenting the number four.
- [x] AC2: Home plan/non-core summaries and shared Home framing use selected/core-set language while retaining €80, €150, €15 and the daily rule.
- [x] AC3: How it works and DEV0075 retain the exact-four contract; no data, selection, access or payment behavior changes.
- [x] AC4: Focused content, responsive and keyboard checks plus lint, typecheck, format and a production build pass.

## Validation plan

Assert the selected hero copy, all three illustrative prices, daily rule and absence of fixed-count wording in the Home hero/plan summary. Confirm How it works still says four. Exercise Home at desktop/mobile widths and keyboard navigation. Run `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check`, a production build and the affected Playwright specification.

## Implementation record

Completed on 2026-09-26.

### Changes and rationale

Home now opens with the selected eyebrow “Your gyms. One membership.” and headline “A membership built around your routine.” The supporting description presents selected core gyms, plan fit, participating-gym movement and optional verified sharing without displaying the number four.

The plan summary now says “selected gyms,” “selected core gyms” and “beyond your core set.” Home-visible sidebar prompts and page/root metadata use the same count-neutral framing. Basic €80/ten, Classic €150/unlimited, the one-included-check-in-per-day rule and the separate €15 eligible non-core visit remain unchanged.

### Affected files

- `src/features/feed/feed.tsx`: replaced the fixed-count hero and plan-summary wording with the chosen routine-led proposition and selected/core-set terminology.
- `src/components/shell.tsx`: removed the fixed number from the Home-visible sidebar caption and discovery note.
- `src/app/page.tsx` and `src/app/layout.tsx`: aligned Home and default metadata with the routine-led proposition without changing the product contract.
- `tests/browser/redesign.spec.ts`: asserts the selected copy, preserved prices/daily rule, absence of fixed-count wording and responsive/keyboard behavior.
- `tests/browser/discovery.spec.ts`: explicitly protects “Choose four core gyms” in the detailed guide so the marketing refinement cannot erase the selection rule.

### Decisions and deviations

- 2026-09-26: The exact four-gym product constraint remains unchanged; only Home's marketing hierarchy becomes count-neutral.

### Contracts, configuration, and operations

Presentation-only change. The exact-four product rule, plan and non-core pricing, data shapes, APIs, schemas, dependencies, environment variables, migrations, wallet behavior and deployment contract did not change.

## Validation results

- `npm test` — passed: 45 unit tests.
- `npm run lint` — passed.
- `npm run typecheck` — passed after Next.js route-type generation.
- `npm run format:check` — passed.
- `./node_modules/.bin/next build --webpack` — passed, including TypeScript, page-data collection and all 12 static pages.
- `npm run test:e2e -- tests/browser/redesign.spec.ts tests/browser/discovery.spec.ts` plus the corrected focused Home rerun — final coverage passed across 14 desktop/mobile cases: eight guide/discovery checks and six Home/navigation checks. The initial combined run found only a strict-locator test error for a selector matching two intended shell elements; the assertion was corrected without changing product code.
- Manual full-page screenshot review at desktop and mobile widths confirmed legible headline wrapping, coherent photo balance, count-neutral plan cards and no horizontal overflow.
- Targeted assertions confirm that Home hero, plan summary and shared sidebar framing contain no `four`, while How it works still contains “Choose four core gyms.”

## Risks, limitations, and follow-ups

Home intentionally does not state the count. How it works and the future DEV0075 selection flow remain responsible for explaining and enforcing exactly four core gyms before activation. No discovery or selection UI was added here.

## Completion and review references

- Completed: 2026-09-26.
- Commit: Not created.
- Review: Implementation self-review against AC1–AC4 plus desktop/mobile screenshot review; no independent review.
- Deployment or release: None.
