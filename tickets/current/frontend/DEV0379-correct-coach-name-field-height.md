# Ticket DEV0379: Correct coach name field height

- Status: In progress
- Created: 2026-10-19
- Last updated: 2026-10-19
- Milestone: UAT coach profile polish
- Coordination: None — independent development ticket
- Related records: Current UAT source baseline [DEV0378](../../archive/frontend/DEV0378-broaden-berlin-facility-search.md). No dependency or direct coordination membership.

## Objective and context

The user reports that Public display name looks awkwardly tall beside Biography on desktop, while mobile is already satisfactory. The profile panel is a two-column grid; its name label is itself a grid and stretches to the biography row height, stretching the single-line input. Correct the layout while preserving [coach profile behavior](../../../docs/mvp-spec.md#coach-profile-and-training-locations).

## Scope and non-goals

Add a narrowly scoped alignment rule for direct profile-panel field labels so they retain their intrinsic height and align at the top. Preserve existing widths, the name input's 43 px minimum height, six-row resizable biography, labels, validation, mobile stacking and all saved data. Commit and deploy this correction through the existing UAT Preview/fra1 project.

Exclude field/schema/validation changes, a broader profile redesign, global form styling, catalog/search/Auth/configuration changes and any profile save during QA. Existing unrelated README/specification/index/browser-test edits and independent uncommitted records remain preserved. This restores the existing single-line/multiline design; no overall product-contract amendment is needed.

## Expected behavior and edge cases

At desktop widths, the name field remains a normal single-line control at the top of its column beside the taller biography. Resizing or wrapping biography content does not stretch it. At 375 px the same fields remain stacked and usable. Keyboard focus/order and input requirements remain unchanged, since markup and handlers are untouched.

## Assumptions, decisions, and dependencies

Use `align-self: start` on direct `.coach-editor-panel > .coach-field` labels to stop inherited grid stretching without a fixed textarea/name height or mobile-specific override. Installed Next.js 16.3.8 client guidance and the shared CSS/owner form were inspected. The previous desktop QA screenshots also show the stretched name input. Existing commit/UAT authorization covers this small corrective iteration; the previous release stays available for rollback.

## Implementation plan

1. Create this ticket/index before the CSS edit; add the scoped alignment rule.
2. Verify scoped formatting and clean-source lint; review that this is the only runtime change. No new tests that merely assert a CSS declaration; no broad unit/DB suite or typecheck is needed for an unchanged TypeScript/data contract.
3. Commit/export only owned changes; build a native hosted Preview explicitly in fra1, verify READY/exact source, then switch only the UAT alias. Keep all five environment settings and the repository's staging project link unchanged.
4. Verify desktop name/biography proportions and keyboard focus, plus 375×568 stacked mobile fields in a separate QA window. Never Save/refresh the user's original draft. Record exact results/release/rollback and preservation, then complete/archive and update links/index.

## Acceptance criteria

- [ ] AC1: Actual desktop UAT name input has normal single-line height beside the taller biography, with aligned labels and usable keyboard focus.
- [ ] AC2: Mobile UAT retains its existing stacked, usable controls; markup/requirements/values/persistence behavior are unchanged.
- [ ] AC3: Scoped format, clean-source lint and actual hosted build pass; reviewed diff and unrelated-edit preservation match this small scope.
- [ ] AC4: Exact-source UAT Preview/fra1 is live with unchanged settings and recorded rollback; the user's draft is not submitted or reloaded by QA.

## Validation plan

Scoped Prettier and clean-source lint, actual hosted build, native desktop and 375×568 phone screenshots/keyboard checks, Vercel source/region/alias/environment metadata, direct HTTPS smoke and preservation comparison. No test fixture, DB write/migration, broad regression suite or new implementation-mirroring test applies to one CSS alignment correction. Review unchanged input markup to preserve required/min/max constraints without submitting a real profile.

## Implementation record

### Changes and rationale

Added the scoped direct-label `align-self: start` rule. Field labels no longer stretch to fill the shared desktop grid row, so the name input retains its intrinsic single-line size beside the six-row biography. No widths, mobile breakpoints, markup, validation or handlers changed.

### Affected files

[Coach form CSS](../../../src/app/coach-discovery.css), this record and [ticket index](../../README.md). Existing [owner form](../../../src/features/coaches/coach-profile-editor.tsx) is inspected but unchanged.

### Decisions and deviations

No deviation. Limit the rule to direct panel field labels rather than changing every field or setting a fixed biography height.

### Contracts, configuration, and operations

No schema, dependency, environment, API, Auth, data or input contract change. UAT rebuild only. Alias rollback target: dpl_AhxLs4HkvAD3WQptoTg4ZNu5u7Hw, source bb15aee.

## Validation results

2026-10-19: `prettier --check src/app/coach-discovery.css` passed. `npm run lint` passed in an isolated exact-HEAD export with only the changed CSS overlaid, avoiding known ignored-work evidence interference (DEV0371). `git diff --exit-code -- src/features/coaches/coach-profile-editor.tsx` confirms unchanged markup/requirements. Runtime diff is exactly one four-line CSS rule. No unit/DB/type suite is repeated for unchanged logic, TypeScript, persistence and schema; actual hosted build and native desktop/phone checks remain pending.

| Criterion | Evidence | Result |
| --- | --- | --- |
| AC1 | Pending desktop | Not run |
| AC2 | Pending phone/markup review | Not run |
| AC3 | Pending checks/review | Not run |
| AC4 | Prior release retained | Not run |

## Risks, limitations, and follow-ups

Native mobile evidence uses Chrome responsive emulation, not physical iOS/Android/Safari. No broader profile or mobile layout redesign is part of this correction.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: Planning self-review; acceptance review pending.
- Deployment or release: Pending.
