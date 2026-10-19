# Ticket DEV0379: Correct coach name field height

- Status: Completed
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

- [x] AC1: Actual desktop UAT name input has normal single-line height beside the taller biography, with aligned labels and usable keyboard focus.
- [x] AC2: Mobile UAT retains its existing stacked, usable controls; markup/requirements/values/persistence behavior are unchanged.
- [x] AC3: Scoped format, clean-source lint and actual hosted build pass; reviewed diff and unrelated-edit preservation match this small scope.
- [x] AC4: Exact-source UAT Preview/fra1 is live with unchanged settings and recorded rollback; the user's draft is not submitted or reloaded by QA.

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

2026-10-19: `prettier --check src/app/coach-discovery.css` passed. `npm run lint` passed in an isolated exact-HEAD export with only the changed CSS overlaid, avoiding known ignored-work evidence interference (DEV0371). `git diff --exit-code -- src/features/coaches/coach-profile-editor.tsx` confirms unchanged markup/requirements. Runtime diff is exactly one four-line CSS rule. No unit/DB/type suite is repeated for unchanged logic, TypeScript, persistence and schema; actual hosted build and native desktop/phone checks passed as detailed below.

| Criterion | Evidence | Result |
| --- | --- | --- |
| AC1 | Real 1390×775 UAT screenshot shows a normal single-line name field aligned beside taller biography; Tab focuses biography | Passed |
| AC2 | Real 375×568 responsive screenshot retains stacked name/biography; form markup/requirements unchanged | Passed |
| AC3 | Scoped Prettier, clean-source lint, actual hosted build, four-line runtime diff, link/whitespace/preservation checks | Passed |
| AC4 | Exact-source READY fra1 Preview/alias, five unchanged settings, 7 HTTPS probes, separate unsaved QA window closed | Passed |

## Risks, limitations, and follow-ups

Native mobile evidence uses Chrome responsive emulation, not physical iOS/Android/Safari. No broader profile or mobile layout redesign is part of this correction.

## Completion and review references

- Completed: 2026-10-19 — all four acceptance criteria passed.
- Commit: d129a8d90087b583273a069bdd00ebbbdf11f1b3 — `[DEV0379] Keep coach name field at single-line height`; final evidence/archive follows in a documentation checkpoint.
- Review: Self-review of scoped CSS/unchanged markup, actual desktop/phone presentation and exact release/preservation; no independent review.
- Deployment or release: Live at https://uat.movx.club on dpl_7LStTVzwo6LfNX6Giv9MFDAQ8Hxd, Preview/fra1, source d129a8d.

### Actual hosted release and responsive evidence

An isolated `git archive` of d129a8d90087b583273a069bdd00ebbbdf11f1b3 was deployed to the dedicated UAT project with `npx --yes vercel@64.3.1 deploy --yes --no-wait --target preview --regions fra1 --meta releaseCommit=d129a8d90087b583273a069bdd00ebbbdf11f1b3 --meta releaseTicket=DEV0379`. `vercel inspect ... --logs --wait` passed the actual native Next.js 16.3.8/Turbopack hosted build. API readback confirmed READY, Preview/fra1 and exact source before `vercel alias set ... uat.movx.club`. Accepted deployment is dpl_7LStTVzwo6LfNX6Giv9MFDAQ8Hxd at https://movx-club-78mzhyb4p-hoangworldcoms-projects.vercel.app. All five Preview settings retain exact IDs/types/targets/update timestamps, the repository's staging link is preserved, and no Git push or production change was performed.

Native Chrome desktop screenshot at 1390×775 shows Public display name as a normal single-line input beside a taller six-row biography, with labels and control tops aligned. The old oversized name box is gone. Clicking the name and pressing Tab puts focus in Biography, confirming normal keyboard order. No text was changed and no form was submitted.

Native Chrome responsive toolbar explicitly shows Width 375 and Height 568 (50% display zoom only to fit the tool window). A screenshot of the identity panel shows the same stacked name then biography controls, the normal name height, multiline biography and existing explanatory text/discipline controls. No mobile width, spacing or breakpoint rule was edited. Input limits/required attributes, values, textarea resizing and save behavior remain unchanged by exact markup review.

The user was active in Chrome before validation, so the original multi-tab window was not refreshed or edited. After the user confirmed a one-minute pause, the previously created single-tab QA window was selected explicitly. The visual/keyboard checks completed there and that window was closed without saving; original draft/tab data was preserved. Failed/stale native activation was not counted as evidence. Native phone proof is Chrome responsive emulation, not physical-device/Safari coverage.

`node work/dev0379/live-check.mjs` passed 7/7 expected HTTPS outcomes: Home/Explore/Events/Sign in 200, guest Coach Profile 307, private times/Messages APIs 401; staging remains 200. A separate served-CSS check inspected five referenced CSS files and found the exact minified scoped alignment rule on UAT. This proves the alias serves the changed stylesheet. Private logs/metadata stay under ignored work/dev0379; no credential value was printed or committed.

`prettier --check src/app/coach-discovery.css`, clean-source `npm run lint`, hosted build, staged whitespace/local-link review and exact unrelated-edit comparison passed. README, specification and existing browser-test bytes are unchanged from this task's starting snapshots; the ticket index differs only by this ticket/next ID. No new implementation-mirroring tests or repeated unit/database/type suite is justified for a single CSS alignment rule with unchanged markup/logic/data. No database write, seed, fixture, configuration or API change belongs to this correction. Rollback remains an alias reassignment to dpl_AhxLs4HkvAD3WQptoTg4ZNu5u7Hw.
