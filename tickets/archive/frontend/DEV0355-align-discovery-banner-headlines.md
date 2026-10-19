# Ticket DEV0355: Align discovery banner headlines

- Status: Completed
- Created: 2026-10-18
- Last updated: 2026-10-19
- Milestone: Public marketplace visual polish
- Coordination: None — independent development ticket
- Related records: [DEV0354 aligned searches](DEV0354-align-events-search-with-explore.md), [DEV0353 Events banner](DEV0353-add-face-free-events-banner.md), [DEV0351 shared hero](DEV0351-align-explore-banner-and-search-with-home.md).

## Objective and context

Replace Explore's heading/description with “Find your discipline.” and “Meet your coach.”, and Events' heading/description with “Find your small group session.” and “Train together.”. The user requests the same font as the Home banner. Follow [public discovery](../../../docs/mvp-spec.md#42-discover-a-coach-and-time) and [Events discovery](../../../docs/mvp-spec.md#151-confirmed-choices-and-implementation-defaults).

## Scope and non-goals

- In scope: exact two-line banner headlines, Home's shared heading typography, readable responsive wrapping, existing browser assertion labels, specification and validation record.
- Out of scope: image bytes/crops/banner size, Home wording, search/results/navigation behavior, data/schema/auth changes, commits or deployment.

## Expected behavior and edge cases

Each route has one selectable h1 with two block spans, just as Home does. Explore shows only “Find your discipline.” / “Meet your coach.”; Events shows only “Find your small group session.” / “Train together.”. Remove the old heading/description from these heroes. Reuse the exact shared font family, size, weight, line height and tracking rather than new typography. The longer Events first line may use a wider phone copy container to remain two lines without shrinking its font. Preserve readable contrast, the existing photograph/crop/hero heights and 12 px search alignment. Accessible heading names include the full two-sentence text with a separating space. Real and unavailable states retain the same headline.

## Assumptions, decisions, and dependencies

Exact wording and font consistency are confirmed user requirements. Implementation default: use the shared MarketplaceHero children with Home's existing block spans; widen only the Events phone copy area if required. Installed Next.js 16.3.8 CSS ordering/scoping documentation has been reviewed. Existing local DEV0350–DEV0354 changes are the baseline; preserve unrelated work and the separate browser rehearsal. No populated environment files/private coach journals or account data need to be read or changed.

## Implementation plan

1. Record the ticket/index and specification amendment before source edits.
2. Replace the two route hero children with the exact block-span headlines and omit descriptions; keep the existing shared heading styles. Adjust scoped phone text width only as needed to fit the longer Events sentence.
3. Update the two existing Explore heading assertions without broadening their tests or adding CSS-mirroring tests.
4. Run relevant existing Home/search/Events tests, scoped lint/format, isolated typecheck/build and link checks. Native review Home/Explore/Events at desktop and 375 px (320 px if the longest sentence needs it), including keyboard search access and unavailable rendering. Use an independent window and configuration-free build preview as needed; no database mutation or browser-test runner.
5. Record evidence and archive only when criteria pass.

### 2026-10-18 phone contrast adjustment

The wider Events headline fits at 375 px, but its final words cross dark clothing beyond the original left fade. Before continuing implementation, extend the white fade across the Events phone text area only. This keeps Home's font size/weight and exactly two lines while preserving the photograph/crop/hero/search geometry. Repeat phone review and build with the final CSS; no new data behavior is introduced.

## Acceptance criteria

- [x] AC1: Explore and Events show only the exact requested two-sentence headlines, each on two lines, with the same heading typography as Home at reviewed desktop/phone widths.
- [x] AC2: Text remains readable/selectable and correctly named as one h1; Home, banner dimensions/crops and aligned search/navigation remain usable.
- [x] AC3: Relevant tests/lint/format/type/build, native responsive/keyboard/unavailable checks and specification/link/source review pass.

## Validation plan

Use existing Events/Home/marketplace search regressions and update only obsolete browser heading expectations. No new logic, data or CSS-mirroring tests are warranted for this copy/layout slice. Review actual pages at desktop and phone, including the long Events sentence, Home typography comparison, unchanged search placement and keyboard focus. Verify final production CSS/unavailable rendering in an isolated configuration-free preview. Native CUA review replaces executing browser automation; record the browser assertions as updated but not run. Check owned source matches the passing build, relative links and whitespace. Database/migration/auth rehearsals are not applicable.

## Implementation record

Implemented and verified locally on 2026-10-18. No commit or deployment performed.

### Changes and rationale

Explore now shows “Find your discipline.” / “Meet your coach.” and Events shows “Find your small group session.” / “Train together.”. Each shared hero receives two block spans within its existing single h1, with a separating space for its accessible name. Both omit the former title/description combination. Home wording remains unchanged.

All three use the existing shared heading font family, responsive size, weight 650, line height and tracking; no alternate font or size was introduced. Events' phone text area widens to 88%, retaining the same 6% left inset. The scoped phone white fade extends behind the longer sentence so its last words remain readable over dark clothing. This changes decoration behind text, not photo bytes, face-excluding crop, hero dimensions or aligned search position.

### Affected files

| File | Change and purpose |
| --- | --- |
| [Coach discovery](../../../src/features/coaches/coach-discovery.tsx), [Events route](../../../src/app/events/page.tsx) | Exact two-span hero headlines; remove descriptions while retaining shared heading markup and all discovery behavior. |
| [Public theme](../../../src/app/public-page-theme.css) | Events phone copy width and wider white fade for its longer sentence. Shared Home typography and height rules remain untouched. |
| [Directory browser assertions](../../../tests/browser/coach-discovery.spec.ts), [unavailable browser assertions](../../../tests/browser/explore-unavailable.spec.ts) | Replace obsolete Explore heading accessible-name expectations; no unrelated browser test changes. |
| [Specification](../../../docs/mvp-spec.md#42-discover-a-coach-and-time), [Events contract](../../../docs/mvp-spec.md#151-confirmed-choices-and-implementation-defaults), [index](../../README.md) | Adopted exact headlines/typography and completed work tracking. |

### Decisions and deviations

The dated contrast adjustment above was recorded before implementation. Native 375 px review showed the original fade left the longer sentence over dark clothing; widening the fade preserved Home's typography and two lines rather than shrinking the headline. No other material deviation.

Native Safari had initial blank/stale paint and transient capture errors (`-3811`, `-3812`, `cgWindowNotFound`). Fresh app selection and Reload Page From Origin restored the verified dedicated window; final native checks below succeeded. Initial blank/clipped frames were not counted as passes. No browser settings, other windows or data were changed to recover.

### Contracts, configuration, and operations

No schema/API/dependency/environment/migration changes. Heading accessible names change with their copy; both existing Explore browser assertions were updated. Routes, metadata, forms, filters and scheduling authority remain unchanged. Rollback is a code revert; no data rollback. No account/coach/registration mutations, provisioning, resets, passwords or private journals/populated environment files were involved. Shared `.next`, the running app and unrelated work were preserved.

## Validation results

2026-10-19 commit verification: the exact staged source passed 51 frontend/domain and 16 backend regressions on Node 24.21.0, scoped ESLint/Prettier, isolated typecheck and production webpack build. Shared contract/index changes exclude unrelated work; 655 local links resolve, with the two intentionally private credential-journal links excluded from version control. DEV0358 records commands, snapshot and remaining native acceptance; committing does not complete DEV0357/DEV0358 or deploy the feature.

Environment: 18 October 2026; Node 24.21.0 (`/Users/hoangdeveloper/.local/node/24.21.0/bin/node`), Next.js 16.3.8; actual local app port 3100 and separate configuration-free final build on loopback 3159.

- `node --import tsx --test tests/events.test.ts tests/home-marketplace.test.ts tests/marketplace-search.test.ts`: **24 passed**, none skipped/failed. Log `/private/tmp/dev0355-tests.log`. Static rendering retains the existing image-quality warning when Next configuration is absent; actual configuration permits quality 95.
- `node node_modules/eslint/bin/eslint.js src/app/events/page.tsx src/features/coaches/coach-discovery.tsx tests/browser/coach-discovery.spec.ts tests/browser/explore-unavailable.spec.ts`: **passed**. The final later change was CSS only.
- `node node_modules/prettier/bin/prettier.cjs --check src/app/events/page.tsx src/features/coaches/coach-discovery.tsx src/app/public-page-theme.css tests/browser/coach-discovery.spec.ts tests/browser/explore-unavailable.spec.ts`: **passed** on final source.
- Isolated snapshot `/private/tmp/movx-dev0355-sj7ely6v`, excluding populated environment files/private journals: `npm run typecheck` **passed** (`/private/tmp/dev0355-types.log`); `node node_modules/next/dist/bin/next build --webpack` **passed** after typecheck and again after final phone-fade CSS (`/private/tmp/dev0355-build-final.log`). An early build started before typecheck had returned and was stopped; it is not counted as a completed build. The subsequent builds completed successfully. All five owned source/test files match the final passing snapshot byte-for-byte.
- Configuration-free production GET: Home **HTTP 200 / 31,880 bytes**, Explore **HTTP 200 / 26,710 bytes**, Events **HTTP 200 / 20,981 bytes**. HTML parsing confirms exactly one h1/two spans per page and the exact combined heading text, with the former Explore description absent. Final Explore/Events GETs repeated after the phone fade retain those exact headings and their actual unavailable components. No real database interruption was used.
- Native Safari desktop approximately 1233 px: Home, Explore and Events **passed**. The two requested sentence lines match Home's visible font/weight/size and left alignment; no old hero descriptions remain. Search still starts immediately beneath the same banner boundary. Events retains its lower-half photograph with no faces.
- Native **375 × 844**: all three heading styles compared **passed**. Explore and Events show exactly two readable lines. Final production Events review includes the wider phone fade, complete headline, unchanged search geometry, accessible Find sessions action, group navigation and readable unavailable/retry state. Real-app Events at 375 and **320 × 844** also **passed**, with the entire first sentence on one line and the actual existing event beneath. Source review confirms shared Home font/height CSS is unchanged and no crop/image edits.
- Native keyboard: focus Training place, then Option-Tab; the mobile Find sessions icon shows its purple focus ring and retains the Find sessions accessible name. **Passed**. Search behavior itself is unchanged and covered by existing regressions/DEV0354 evidence.
- Existing two browser heading assertions were updated and linted, **not executed with a browser test runner**; native CUA review supplied required responsive/keyboard/unavailable evidence. No new CSS-mirroring tests were added. Database, migrations, authentication and broad map rehearsals are not applicable to this copy/layout slice.
- Final source comparison against DEV0354, relative links/anchors and `git diff --check`: **passed**. Only the exact headline/description replacement, scoped phone readability and two obsolete assertion names changed in implementation. Temporary preview servers were stopped and only the dedicated review window was closed.

| Criterion | Evidence | Result |
| --- | --- | --- |
| AC1 | Exact production h1/two-span text; shared unchanged typography; native desktop/375 and Events 320 px. | Passed locally |
| AC2 | Readable final phone fade, correct single accessible heading, retained Home/photo/crop/search, keyboard focus and unavailable states. | Passed locally |
| AC3 | 24 tests, lint/format/type/final build, native review, source comparison and consistent specification/links. | Passed locally |

## Risks, limitations, and follow-ups

No unmet acceptance criteria remain. The wider fade intentionally softens the Events phone photograph behind the longer headline. Native review encountered transient Safari capture/paint failures but completed on verified destinations; failed frames are not evidence. Browser assertion files were updated but their runner was not executed. Hosted deployment and independent review are outside scope; unrelated shared changes remain preserved.

## Completion and review references

- Completed: 2026-10-18 — all acceptance criteria passed locally.
- Commit: Included with this record in the user-authorized DEV0350–DEV0358 public-discovery/Events commit; see Git history for this ticket.
- Review: Scope/source self-review and native responsive/keyboard/unavailable review completed; no independent review.
- Deployment or release: None.
