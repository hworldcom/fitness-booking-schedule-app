# Ticket DEV0137: Fix secondary button contrast

- Status: Completed
- Created: 2026-10-05
- Last updated: 2026-10-05
- Milestone: Project maintenance
- Coordination: None — independent development ticket
- Related records: follows the completed coach social interface in [DEV0100](../../archive/backend/DEV0100-coach-follows-and-chronological-posts.md); observed during DEV0130 staging rehearsal

## Objective and context

Restore readable secondary-button text when a control appears inside a dark surface. On the signed-in coach's public profile, `Manage posts` currently renders white text on the shared white secondary-button background because the button does not define a foreground color and inherits white from the profile header. This is an accessibility and staging usability defect under the specification's [definition of done](../../../docs/mvp-spec.md#11-definition-of-done).

## Scope and non-goals

- In scope: define an explicit readable foreground color for shared secondary buttons; verify the `Manage posts` link and representative secondary-button states at desktop and mobile widths.
- Out of scope: changing button labels, navigation, post authorization, coach availability behavior, profile data or staging fixture data. Tom's honest `No open times right now` state is not this defect: hosted inspection found zero active availability rules and zero open seven-day occurrences.

## Expected behavior and edge cases

`Manage posts` uses dark readable text on its white button in the dark coach header, including hover and keyboard focus. Other secondary buttons keep their white surface, border, sizing and existing context-specific overrides. The change must not weaken disabled states or alter dark/lime button variants.

## Assumptions, decisions, and dependencies

The defect is in the shared `.button.secondary` rule, not the owner-only React branch. Defining its default foreground color is preferable to a one-off `Manage posts` override because every white secondary button should remain readable independently of ancestor text color. The more specific coach-workspace header override remains compatible.

## Implementation plan

1. Add the explicit design-system foreground color to `.button.secondary` while retaining its current background, border and hover behavior.
2. Add a focused regression assertion for the shared secondary-button color contract.
3. Run the focused test plus lint, formatting and an appropriate production build; inspect the affected state at desktop and mobile widths when an authenticated coach fixture is available.

## Acceptance criteria

- [x] AC1: `Manage posts` has readable dark text on its white secondary-button background instead of inheriting white from the dark coach header.
- [x] AC2: The shared secondary-button rule preserves its existing white surface, border and hover behavior, and context-specific overrides continue to win.
- [x] AC3: Focused regression, lint, formatting and production-build checks pass; desktop/mobile visual evidence is recorded or an exact environmental blocker is stated.

## Validation plan

Add a focused source contract test that verifies `.button.secondary` owns an explicit foreground color alongside the existing background and border. Run the focused unit test, ESLint, Prettier and the Vinext production build used for staging. Verify computed foreground/background values and keyboard focus on the authenticated coach profile at desktop and mobile widths if the staged signed-in session is available.

## Implementation record

Implementation started after reproducing the staging symptom and tracing it to inherited header text color. The change and required validation are complete; deployment remains a separate release action.

### Changes and rationale

The shared `.button.secondary` rule now declares `color: var(--ink)`. The affected `Manage posts` link therefore computes to dark `rgb(34, 37, 31)` text instead of inheriting white from its dark profile-header ancestor. The existing white surface, border and pale hover surface remain unchanged.

A source-level regression test preserves the shared foreground/background/border contract and the existing, more-specific coach-workspace color override. A browser regression renders the real shared CSS inside a dark ancestor and checks normal, keyboard-focus and hover colors in both configured desktop and mobile projects. The normal-state contrast is 15.53:1 and hover-state contrast is 14.13:1.

### Affected files

| File or component                     | Change and purpose                                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `src/app/globals.css`                 | Give shared white secondary buttons an explicit readable foreground color.                                   |
| `tests/button-styles.test.ts`         | Preserve the shared CSS source contract against future inherited-color regressions.                          |
| `tests/browser/button-styles.spec.ts` | Verify computed normal, keyboard-focus and hover colors inside a dark ancestor at desktop and mobile widths. |

### Decisions and deviations

- 2026-10-05: Treat the hosted availability empty state as correct data-driven behavior rather than bundling an unrelated default-slot change into this contrast fix.

### Contracts, configuration, and operations

No API, database, Solana, environment-variable, dependency or migration contract changed. The change is CSS-only plus regression evidence.

## Validation results

Validation completed on 2026-10-05 from the repository root. The production builds also included unrelated in-progress DEV0122/DEV0136 working-tree changes; the focused source and browser checks isolate this ticket's CSS behavior.

| Criterion | Evidence                                                                                                                                                                                                                                              | Result |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | `npx playwright test tests/browser/button-styles.spec.ts` rendered the shared CSS inside a dark ancestor and observed white background plus dark text in desktop and mobile projects.                                                                 | Passed |
| AC2       | `npx tsx --test tests/button-styles.test.ts` preserved the white background, border, explicit shared foreground and coach-workspace override; the browser test also observed the pale hover background with unchanged dark text.                      | Passed |
| AC3       | `npx prettier --check ...` passed for the four ticket files; `npm run lint` passed; `npm test` passed 111 root and 22 server tests; `npm run build` and `npm run build:vinext` passed; the focused Playwright run passed 2/2 desktop/mobile projects. | Passed |

## Risks, limitations, and follow-ups

The shared rule affects every secondary button, but the focused source check confirms that the more-specific coach-workspace color remains intact. Availability publishing remains an explicit coach action and is not a follow-up code defect from this ticket. The CSS fix has not yet been deployed to staging because the shared working tree contains unrelated uncommitted DEV0122/DEV0136 work; release should use a clean commit rather than mixing those changes.

## Completion and review references

- Completed: 2026-10-05.
- Commit: This commit — `[DEV0137] Fix secondary button contrast`.
- Review: None yet.
- Deployment or release: Not deployed.
