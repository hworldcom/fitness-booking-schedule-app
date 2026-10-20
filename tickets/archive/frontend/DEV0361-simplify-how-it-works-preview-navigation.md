# Ticket DEV0361: Simplify How it works preview navigation

2026-10-20 artifact retirement: the owner removed standalone design previews under [DEV0390](../../current/organisatory/DEV0390-remove-unneeded-design-previews.md). The record below preserves the original design/validation history; backticked preview paths identify retired artifacts. Runtime images/code are retained, with banner source/prompt provenance in public/images/retained-banner-provenance.json.

- Status: Completed
- Created: 2026-10-19
- Last updated: 2026-10-20
- Milestone: Public marketplace design review
- Coordination: None — independent development ticket
- Related records: Historical preview [DEV0359](../../archive/frontend/DEV0359-preview-athlete-and-coach-how-it-works.md).

## Objective and context

The user likes the standalone How it works direction but requests removal of the sentence “Each coach sets a participant limit, up to 100 people” and the repeated audience navigation. Simplify the existing preview (retired artifact: `previews/how-it-works/README.md`) while following the current [public presentation](../../../docs/mvp-spec.md#42-discover-a-coach-and-time) and [group behavior](../../../docs/mvp-spec.md#15-group-training-and-events). This is a preview refinement, not live-page adoption.

## Scope and non-goals

- In scope: remove the specified FAQ sentence; remove the duplicate introduction buttons; keep one sticky section bar with For athletes, For coaches and Common questions; remove unused button styles and update the preview guide.
- Out of scope: product routes, group capacity/confirmation logic, palette changes, database/demo edits, dependencies, deployment or commits.

## Expected behavior and edge cases

The introduction contains the headline, description and illustrations. One section-navigation bar reaches the athlete/coach/FAQ sections at desktop and phone widths, including keyboard use. The group-size answer reads: “Class sizes vary. If you’re looking for more individual attention, choose a smaller class and check its maximum group size before joining.” No numeric maximum appears in public preview copy. Other action dialogs and native FAQs retain their behavior.

## Assumptions, decisions, and dependencies

User-confirmed: remove the sentence and repeated audience controls; preserve the overall direction and colors. Adopted implementation choice: retain the sticky bar because it stays useful while reading the page, and remove the hero buttons serving the same destinations. The existing 100-person product cap remains unchanged. Reuse the loopback preview server and local assets from DEV0359.

## Implementation plan

1. Allocate this ticket and index entry before source edits.
2. Remove the hero action markup and its now-unused CSS; shorten the FAQ answer and update the guide with this follow-up.
3. Check formatting, valid section targets and absence of duplicate controls/specified sentence. Inspect desktop and phone layout, remaining section links and keyboard FAQ use.
4. Record actual evidence, archive on completion and deliver the updated preview link.

## Acceptance criteria

- [x] AC1: The specified FAQ sentence is absent, and the remaining answer reads naturally without changing group behavior.
- [x] AC2: One audience section bar remains, with no duplicate hero role buttons or unused hero-action styles.
- [x] AC3: Desktop and phone remain readable; remaining section links and keyboard FAQ interactions work. Scoped format/link checks pass.

## Validation plan

Inspect the served preview at desktop and 375 px. Use the retained section links and native keyboard FAQ control. Run scoped Prettier and whitespace checks plus one-off HTML fragment/content assertions. No new permanent tests, app lint/type/build/database checks are needed for this static copy/control removal; the unchanged server/action JavaScript retains DEV0359 evidence.

## Implementation record

### Changes and rationale

Removed the two introductory audience buttons, leaving one sticky For athletes / For coaches / Common questions bar. Removed all five unused hero-action CSS blocks, including responsive overrides. The existing headline, description, illustrations, palette and audience explanations remain the proposed design.

Shortened the group-size FAQ to the planned answer beginning “Class sizes vary.” It encourages checking a class’s size without stating a numeric maximum. Updated the preview guide to explain the single navigation bar, user-directed copy choice and this follow-up record. No runtime or group-capacity behavior changed.

### Affected files

| File                                                      | Role                                                            |
| --------------------------------------------------------- | --------------------------------------------------------------- |
| index.html (retired artifact: `previews/how-it-works/index.html`)   | Removed duplicate hero links and the specified FAQ sentence.    |
| styles.css (retired artifact: `previews/how-it-works/styles.css`)   | Removed unused hero-action rules at every breakpoint.           |
| Preview guide (retired artifact: `previews/how-it-works/README.md`) | Updated navigation/copy description and linked this refinement. |
| This record and [index](../../README.md)                  | Scope, evidence and completed archive entry.                    |

### Decisions and deviations

2026-10-19 commit annotation: the user subsequently authorized the local checkpoint. [DEV0364](DEV0364-isolate-group-minimum-styles-for-commit.md) records focused staging and exact-tree verification; this record retains the original refinement evidence.

2026-10-19: keep the sticky audience bar and remove the hero buttons; no material scope deviation.

### Contracts, configuration, and operations

No product/data/dependency/environment/setup/migration changes. Existing local preview URL and server command remain valid.

## Validation results

- 2026-10-19, native Safari normal desktop window and Responsive Design Mode at 375×844: the introduction showed no role buttons, and one complete section bar remained visible without observed clipping or horizontal overflow.
- Desktop For coaches and Common questions links updated the URL to `#coaches` and `#questions`. Opened the group-size FAQ and observed exactly the shortened answer without the removed sentence. Return closed the focused native disclosure, as confirmed by its subsequent off state. Phone For athletes reached `#athletes`; the card layout remained readable.
- `npx prettier --check previews/how-it-works` and task-scoped `git diff --check`: passed. Final scoped record formatting and repository-relative links checked after archiving.
- One-off `python3` HTMLParser/content/fragment validation: passed. Visible copy has neither the specified sentence nor a numeric maximum nor the removed role-button labels; the exact replacement paragraph is present. There is exactly one anchor to each of `#athletes`, `#coaches` and `#questions`; all HTML/SVG fragment references resolve, IDs are unique, and CSS has no `hero-actions` rules.
- Application/build/database and repeated server/dialog suites not run: only static copy/duplicate controls and their unused styles changed. Existing server, action JavaScript and product behavior retain DEV0359 evidence. No permanent tests were added for this reversible presentation edit.

| Criterion | Evidence                                                                                                                     | Result |
| --------- | ---------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Native rendered FAQ and exact replacement-copy assertions; no product code edits.                                            | Passed |
| AC2       | Desktop/phone introduction and source checks for one anchor per destination and zero unused action styles.                   | Passed |
| AC3       | Native desktop/375 px inspection, retained anchor navigation, Return FAQ closure and scoped formatting/fragment/link checks. | Passed |

## Risks, limitations, and follow-ups

Standalone design proposal only; live integration needs its own user-directed ticket. The underlying 100-person maximum remains in the specification and is intentionally omitted from public preview copy. Native checks used Safari; no new Chrome rendering claim is made. The local preview remains available at port 3191.

## Completion and review references

- Completed: 2026-10-19 — requested copy/navigation refinement and scoped validation passed.
- Commit: User-authorized checkpoint with subject `[DEV0359][DEV0361][DEV0362][DEV0364] Add How it works preview and group minimums`.
- Review: Scope/source/content/visual/keyboard self-review complete; no independent review.
- Deployment or release: None; local preview only.
