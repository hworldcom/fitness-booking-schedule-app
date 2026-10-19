# Ticket DEV0365: Implement How it works page

- Status: Completed
- Created: 2026-10-19
- Last updated: 2026-10-19
- Milestone: Public marketplace presentation
- Coordination: None — independent development ticket
- Related records: Historical design baselines [DEV0359](../../archive/frontend/DEV0359-preview-athlete-and-coach-how-it-works.md), [DEV0361](../../archive/frontend/DEV0361-simplify-how-it-works-preview-navigation.md) and [DEV0362](../../archive/frontend/DEV0362-explain-group-minimums-and-invite-friends.md).

## Objective and context

Replace the technical private-session explanation at `/how-it-works` with the user-approved athlete/coach preview. Explain private and group training in plain language, including smaller groups, participant minimums and explicit coach confirmation. Adopt the approved white/purple palette within the existing public application shell. Follow [public discovery](../../../docs/mvp-spec.md#42-discover-a-coach-and-time), [group training](../../../docs/mvp-spec.md#15-group-training-and-events) and the [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix).

## Scope and non-goals

- In scope: Live route, dedicated server-rendered content and scoped responsive styles; real discovery/application links; native section navigation and FAQs; product specification and regression evidence.
- Out of scope: New booking, invitation, authentication or payment behavior; group-size changes; event-card redesign; retained data; replacing the approved preview artifact or unrelated Home work.

## Expected behavior and edge cases

One audience navigation bar links to athletes, coaches and questions. Athletes can explore coaches/private training and group classes; coaches can enter the existing application flow. Joining a group reserves a seat, requires its minimum before coach confirmation and never confirms automatically. Public copy gives no numeric maximum. Empty/unavailable destination pages retain their existing behavior. The page remains useful without JavaScript, uses one main/one h1 and fits phone/desktop widths. The sticky section navigation must not conceal anchor headings beneath the public header.

## Assumptions, decisions, and dependencies

- Confirmed: Adopt the approved preview and colors; remove the numeric limit sentence and duplicate audience controls; explain minimums and encourage inviting friends.
- Implementation choice: Dedicated server component, route stylesheet, native anchors/details and existing internal routes. No new client state or dependency is needed.
- Existing coach entry: `/sign-in?intent=coach&returnTo=%2Fprofile%2Fcoach`. Discovery routes: `/explore` and `/events`.
- Installed Next 16.3.8/React 19.3.0 and bundled CSS, server-component and Link documentation inspected before route work. Node 24.21.0 is required for validation.
- Scope review: One cohesive presentation change; no split needed. Preserve all independent shared-workspace edits.

## Implementation plan

1. Port the approved content/illustrations into a server component, replace preview actions with real links and remove the obsolete live explanation.
2. Add scoped white/purple responsive styling and integrate with the public header, main and footer. Preserve accessible headings, touch targets, focus and anchor offsets.
3. Update the product contract and focused rendering/browser regression scenarios.
4. Run focused tests, lint/format, isolated type/build checks and native desktop/phone/keyboard verification. Complete and archive this record only after required evidence passes.

## Acceptance criteria

- [x] AC1: Live page matches the approved visual/content direction and includes distinct athlete/coach sections, private and group options, FAQs and one audience navigation bar.
- [x] AC2: Group minimum/coach-confirmation, smaller-class and payment explanations remain truthful; no numeric maximum or preview-only dialogs/actions appear.
- [x] AC3: Real athlete/group/coach entry links work; native anchors and FAQs support keyboard use and remain readable at desktop and phone widths.
- [x] AC4: Focused regression tests, lint/format, type/build and specification/link consistency checks pass; unrelated shared work is preserved.

## Validation plan

Render-contract tests check navigation destinations, audience structure and truthful confirmation content. Update the existing browser scenario to the new page contract. Use native Safari for desktop/375/430, keyboard anchors/FAQ, actual route navigation and overflow observations. Run focused Node tests, scoped ESLint/Prettier, `next typegen`, `tsc --noEmit` and an isolated production build with Node 24. Check relative documentation links and diff scope. No database, migration, payment or account-fixture validation applies because this change reads no new persistent state and changes no booking transitions.

## Implementation record

### Changes and rationale

The old page described one-hour scheduling internals and omitted group training. The live page now adopts the approved preview: “Good coaching. More personal.”, decorative private/group illustrations, one audience navigation bar, two athlete training cards, athlete/coach steps, minimum-enrollment callout, five native FAQs and discovery links. Existing public header/footer and the single main landmark remain owned by the application shell.

The server component needs no new client state, authentication read or data query. Preview buttons/dialogs become real coach, Events and coach-application links. Group copy distinguishes a reserved seat, minimum enrollment and an explicit coach decision by the deadline. Smaller classes are an option, not a promise about every group. Public explanatory copy gives no numeric maximum.

### Affected files

| File                                                                                                                                                            | Change and purpose                                                                                                                                                                                                                                                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Live content](../../../src/features/public/how-it-works.tsx)                                                                                                   | Approved athlete/coach sections and decorative Lucide illustrations, actual links, labelled/focusable section targets and native FAQ disclosures. Coach step headings use h3 to preserve the heading hierarchy.                                                                                                 |
| [Scoped stylesheet](../../../src/features/public/how-it-works.css)                                                                                              | Approved white/purple/pale-green palette and existing fonts; responsive cards/art, sticky navigation below the public header, readable anchor offsets, touch targets and purple action focus. Every content selector is scoped to `.how-page`; the main sizing override requires this page as its direct child. |
| [Route](../../../src/app/how-it-works/page.tsx)                                                                                                                 | Imports the new content/styles and updates the description for both audiences and formats.                                                                                                                                                                                                                      |
| [Home story module](../../../src/features/public/coach-story.tsx)                                                                                               | Removes the obsolete How it works export, its unused technical steps and icon. Preserves independent pending Home changes; Home still uses its existing three steps.                                                                                                                                            |
| [Rendering tests](../../../tests/how-it-works.test.ts)                                                                                                          | Four contract regressions cover audience targets, real destinations, minimum/confirmation semantics and native payment/cancellation guidance.                                                                                                                                                                   |
| [Browser scenario](../../../tests/browser/public-story.spec.ts)                                                                                                 | Replaces only the obsolete How it works scenario with audience links, keyboard anchor/FAQ, real destinations and overflow expectations; independent Home scenarios remain.                                                                                                                                      |
| [Product specification](../../../docs/mvp-spec.md#421-how-it-works), [preview guide](../../../previews/how-it-works/README.md), [ticket index](../../README.md) | Record live adoption and maintain navigation/history without changing the standalone preview behavior.                                                                                                                                                                                                          |

### Decisions and deviations

- 2026-10-19: Port approved HTML/CSS composition with installed Lucide icons and fonts. Scope the route stylesheet to avoid affecting other pages after client navigation. No dependency needed.
- 2026-10-19: Use native anchors/details and the existing coach-intent sign-in entry. Preserve account and booking behavior.
- 2026-10-19: Make the sticky section bar opaque white to keep scrolled text from showing through it; suppress the decorative outline on focused section containers while preserving visible action/FAQ focus. Use h3 coach steps rather than the preview’s skipped h4 level.
- No material scope or behavior deviation. This remains one presentation slice; independent shared-workspace changes were not reverted or included as owned work.

### Contracts, configuration, and operations

No data shapes, APIs, schemas, dependencies, environment variables, setup, migrations or retained data changed. Route metadata and explanatory content changed. Existing destinations retain their own authorization, empty/unavailable handling and confirmation rules. Rollback consists of reverting this presentation slice; no data rollback is needed. No account creation, provisioning, email, invitation delivery, payment or deployment occurred.

## Validation results

Date/environment: 2026-10-19, macOS, native Safari 27.0.1, Node 24.21.0, Next 16.3.8, React 19.3.0.

- `node --import tsx --test tests/how-it-works.test.ts tests/shell-navigation.test.ts tests/events.test.ts`: **25 passed**, including four new page regressions and existing minimum/confirmation/navigation boundaries.
- `node node_modules/eslint/bin/eslint.js src/app/how-it-works/page.tsx src/features/public/how-it-works.tsx src/features/public/coach-story.tsx tests/how-it-works.test.ts tests/browser/public-story.spec.ts`: passed.
- `node node_modules/prettier/bin/prettier.cjs --check src/app/how-it-works/page.tsx src/features/public/how-it-works.tsx src/features/public/how-it-works.css src/features/public/coach-story.tsx tests/how-it-works.test.ts tests/browser/public-story.spec.ts`: passed.
- Isolated source snapshot `/private/tmp/dev0365-how-iomFP5` copied application/public/scripts/tests/configuration, linked installed dependencies and loaded no environment files. With `/Users/hoangdeveloper/.local/node/24.21.0/bin/node`, ran `node_modules/next/dist/bin/next typegen`, `node_modules/typescript/bin/tsc --noEmit` and `node_modules/next/dist/bin/next build --webpack`: passed, **27 static pages**, including `/how-it-works`. Rebuilt successfully after the final CSS/icon refinements. Shared `.next` was not rebuilt by this task.
- Read the generated `.next/server/app/how-it-works.html` with Node: exactly **one main, one h1, five details**, correct title and complete server-rendered minimum/confirmation explanation. This verifies server content without requiring client execution.
- Native Safari at `http://localhost:3100/how-it-works`: desktop, 768 px tablet and 375/430 px phone checks showed readable hero/art/cards, stacked phone cards, intact page width, public shell and one section bar. Athlete/coach anchors exposed their headings below the sticky public header/bar. FAQ expansion/collapse worked by Tab/Return with a purple visible focus frame. Option-Tab reached the athlete link and Space activated it using Safari’s native keyboard control. Actual athlete/group links opened Explore/Events; the coach link preserved coach intent and the `/profile/coach` return on the existing sign-in screen.
- Additional isolated production preview on loopback port 3192 showed the guest header, correct page content and native FAQ expansion. Safari’s native capture intermittently returned a blank canvas/stale accessibility tree during responsive resizing/navigation; the stable live-app screenshots above and generated production HTML are the visual/structural evidence. No runtime error was shown in the inspected console. Do not treat those intermittent captures as a passed 1440 px production screenshot check.
- Environment limitations: sandboxed production-server startup and an HTTP `fetch` probe initially returned `EPERM`. Loopback startup succeeded through approved escalation; the HTTP probe was replaced with generated-HTML inspection and native browser access. No remote service or private configuration was used.
- The updated Playwright scenario was type-checked but **not executed**; browser interaction used native Safari. Full unrelated browser/database/auth/payment suites were not run because this static presentation changes none of their logic. No new error state is introduced; linked destinations keep their existing handling.
- Relative Markdown target check across this record, the specification and preview guide: **116 targets passed**. `git diff --check` passed. Final self-review confirmed only this ticket’s page/adoption changes were added; existing shared Home, Events, authentication, media and planning edits were preserved.

### Commit preparation — 2026-10-19

The user requested the commit after implementation. Prepared exactly ten owned files against committed baseline `f3304a1` in `/private/tmp/dev0365-commit-_l1roybp`. The shared Home module, browser scenario, specification and index were reconstructed from that baseline with only DEV0365 changes; unrelated Home, Events, public-theme, media, authentication and planning changes remain in the shared working tree.

- Re-ran the focused Node command above: **25 passed**. Scoped ESLint passed. The isolated formatting check initially found one extra trailing blank line introduced while removing the old export; removed it and the complete scoped Prettier check passed.
- Explicit Node 24.21.0 `next typegen`, `tsc --noEmit` and `next build --webpack` passed against this isolated commit candidate: **27 static pages**. Generated How it works HTML contains one main, one h1 and five native FAQ disclosures.
- Checked relative Markdown targets in the isolated ticket, specification and preview guide: **111 passed**. This excludes the unrelated specification additions present during the earlier 116-target shared-workspace check.
- No product or implementation scope changed during commit preparation. Self-reviewed the isolated patch and retained the original native interface evidence; no deployment or independent review is implied.

| Criterion | Evidence                                                                                      | Result |
| --------- | --------------------------------------------------------------------------------------------- | ------ |
| AC1       | Native desktop/tablet/phone review and server-rendered audience/format tests                  | Passed |
| AC2       | Minimum/confirmation/payment tests, native FAQ text and absence of preview UI/numeric maximum | Passed |
| AC3       | Native section/FAQ keyboard checks and actual Explore, Events and coach-intent destinations   | Passed |
| AC4       | 25 tests, lint/format, isolated type/build, 116 documentation links and scoped diff review    | Passed |

## Risks, limitations, and follow-ups

No required functional work remains. Existing route services and authentication remain outside this presentation scope. Sticky offsets follow the current public header breakpoints; future shell-height changes should recheck anchor positioning. Native production capture was intermittent as described above; no automated browser-suite or hosted rollout claim is made.

## Completion and review references

- Completed: 2026-10-19 — all four acceptance criteria passed; live page, contract and validation record complete.
- Commit: User authorized on 2026-10-19; included with implementation under `[DEV0365] Implement athlete and coach How it works page`.
- Review: Local self-review; no independent review or pull request created.
- Deployment or release: Local implementation only; not deployed.
