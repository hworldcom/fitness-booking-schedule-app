# Ticket DEV0360: Align Explore controls with public colors

- Status: Completed
- Created: 2026-10-19
- Last updated: 2026-10-19
- Milestone: M3 — Public discovery visual polish
- Coordination: None — independent development ticket
- Related records: Committed card baseline [DEV0316](DEV0316-redesign-coach-directory-cards.md). Independent shared-workspace visual references: DEV0350 (public palette), DEV0351 (Explore banner/search) and DEV0358 (Events formatting). Their uncommitted records and implementation are excluded; this CSS slice has no runtime dependency on them.

## Objective and context

At smaller widths, Explore retains an old green List/Map control and a green selected-coach frame. The user prefers Events' button formatting and requests colors matching the current white/lavender/purple public palette. Follow [public discovery](../../../docs/mvp-spec.md#42-discover-a-coach-and-time), [card presentation](../../../docs/mvp-spec.md#196-cards-username-urls-and-scheduling-compatibility) and [M3](../../../docs/mvp-spec.md#12-delivery-milestones).

## Scope and non-goals

- In scope: Explore's responsive List/Map appearance, count/disabled state and selected/focused coach frame, mobile map-preview focus and Back to list control; current specification and focused validation.
- Out of scope: redesigning cards/search/map, changing Events' already suitable appearance, route/filter/history/selection logic, new media, packages, API/schema/data changes, private workspaces, retained demo accounts or commits/deployment.

## Expected behavior and edge cases

At 980 px and below, Explore uses Events' compact white rounded segmented links, purple text, a pale lavender current segment and a visible purple border. Keep List's count readable. Map unavailable remains clearly labelled, disabled and usable beside List at narrow widths. Keyboard focus remains stronger than ordinary selection. Selected coach cards use a purple frame following their existing rounded corners; no inherited green outline returns on focus. Mobile map-preview focus and Back to list use the same purple/white treatment. Desktop retains list/map side by side and no mobile switch. Existing canonical GET URLs, supported filters, browser history, card/profile links, list fallback and selection behavior remain.

## Assumptions, decisions, and dependencies

Confirmed: replace the green control/frame and adopt Events' formatting. Adopted default: retain Events unchanged and match its existing white/lavender/purple control in Explore; use current public purple for keyboard focus. This is one small CSS slice, not a coordination record. Shared working-tree palette/card/Event work is preserved; no provider, database, credential or setup operation is needed. Responsive browser evidence may use an isolated presentation snapshot with explicitly labelled fixture data if no local application is running; this is interface proof, not database proof.

## Implementation plan

1. Record this ticket/index before implementation and inspect installed Next.js 16.3.8 CSS guidance, stylesheet order and existing Events/Explore states.
2. Update only the existing Explore mobile-control and selected/focus CSS rules; reuse the Events visual values and current palette.
3. Amend the current specification with this visual refinement, preserving behavior and historical decisions.
4. Run focused existing discovery/Events tests, CSS formatting/whitespace/link checks and appropriate isolated compilation. Verify desktop and small phone/tablet widths, List/Map selection, keyboard focus, disabled/empty/unavailable presentation and absence of clipping using native browser controls. No new CSS-mirroring tests or database/mutation rehearsals.
5. Review all criteria, document actual evidence/limits, and archive only after required validation passes.

### 2026-10-19 responsive review adjustment

The first production-preview phone check passed List/Map Tab/Enter and exposed two adjacent inherited green states: the programmatically focused selected-coach map preview and Back to list. Include those existing rules in this same visual slice before completion, then rebuild/recheck the final CSS. No selection or navigation logic changes.

### 2026-10-19 commit isolation review

Commit only the two Explore stylesheets, this implementation record and the owned specification/index slices. The existing CSS color fallbacks make the change independent of the pending public-theme implementation. Review found that the previously observed purple keyboard ring on List/Map and Back to list came from that uncommitted theme, so add explicit Explore-scoped focus rules using the same already verified purple/3 px ring and offset. This preserves the reviewed appearance on a clean checkout. Validate the isolated commit snapshot and retain unrelated ticket allocations. The independent visual reference records are named above without unresolved repository links until their own commits exist; the committed baseline and current specification remain linked.

## Acceptance criteria

- [x] AC1: Explore's mobile List/Map control matches Events' compact white/lavender/purple formatting, with readable count/current/disabled states and no clipping at small widths.
- [x] AC2: Selected and focused Explore coach cards use rounded purple frames; keyboard focus stays visible and public profile links still work.
- [x] AC3: Desktop/mobile navigation, filtering/history and map-unavailable list recovery remain intact; Events/private styles and retained data are preserved.
- [x] AC4: Applicable existing tests, CSS compilation/formatting, responsive/keyboard/state review, specification and ticket/index evidence are complete.

## Validation plan

Run existing marketplace/search/fitness/Events checks relevant to rendering and canonical list/map URLs. Check both CSS files with the installed Prettier and compile the actual app CSS in an isolated source snapshot so shared Next output is untouched. Native desktop, 375 px phone and tablet review covers current List and Map links, selected coach/focus frame, keyboard Tab/Enter and unavailable/empty states. Inspect browser-history/filter logic via existing tests and source review because no behavior code changes. No migrations or database checks apply. Record failed, blocked and not-run checks accurately.

## Implementation record

Scope reviewed: one bounded visual slice. The existing Explore mobile-control and selected/focus CSS rules now match the current public palette and Events reference. Implementation, responsive/keyboard/state review and acceptance self-review are complete.

### Changes and rationale

Replaced the full-width green mobile List/Map grid with Events' compact white rounded segmented links. The current segment has a lavender background and inset purple border; both links have purple text, a minimum 44 px height and 14 px labels. The List count has its own readable pale badge. Map unavailable retains its disabled text/icon with opaque muted text, rather than reducing the entire control's contrast.

Selected coach cards now have a purple border/outline and 20 px rounded corners matching the card, with a 3 px outline offset. A focused card receives the stronger public-purple 3 px ring. The phone review exposed a second green outline on the focused map-preview container and a green Back to list pill; those now use purple focus and a white bordered purple-text button. Existing selection, focus transfer, profile URLs, filtering/history and provider recovery code are unchanged. Events already supplies the desired appearance and was not edited under this ticket.

### Affected files

| File | Role |
| --- | --- |
| [Explore base styles](../../../src/app/coach-discovery.css) | Responsive switch/current/count/disabled rules and mobile Back to list/map-preview focus. |
| [Explore overrides](../../../src/app/explore-discovery.css) | Rounded purple selected-card and stronger focused-card frames. |
| [Specification](../../../docs/mvp-spec.md#196-cards-username-urls-and-scheduling-compatibility), [index](../../README.md) | Current visual contract and completed ticket lifecycle. |

### Decisions and deviations

2026-10-19: keep Events' existing formatting; align Explore with it. The dated responsive-review adjustment above added the adjacent map-preview focus and Back to list rules after observing their remaining green appearance. Native review used an isolated production snapshot after the initial loopback check could not reach port 3100. No other deviation.

### Contracts, configuration, and operations

CSS-only presentation amendment. No route, API, data, package, environment, credential or migration change. No retained data setup/mutation is authorized or needed.

## Validation results

19 October 2026; Node 24.21.0, Next.js 16.3.8. Read the installed CSS/global-style ordering and production-chunking guide before implementation.

- `/Users/hoangdeveloper/.local/node/24.21.0/bin/node --import tsx --test --test-concurrency=2 tests/marketplace-search.test.ts tests/coach-directory.test.ts tests/coach-directory-cards.test.ts tests/fitness.test.ts tests/events.test.ts tests/event-directory.test.ts`: **32 passed**, zero failures/skips; `/tmp/dev0360/tests.log`. These existing checks cover canonical filters/view/history URLs, public card links/content and Events contracts. No new CSS-mirroring tests.
- `/Users/hoangdeveloper/.local/node/24.21.0/bin/node node_modules/prettier/bin/prettier.cjs --check src/app/coach-discovery.css src/app/explore-discovery.css`: **passed** on final CSS. Scoped `git diff --check` passed. ESLint does not lint these CSS files; no JavaScript/TypeScript application code changed, so a full application lint rerun is not applicable.
- `PATH="/Users/hoangdeveloper/.local/node/24.21.0/bin:$PATH" NODE_OPTIONS=--max-old-space-size=1536 npm run build -- --webpack` in `/tmp/dev0360/validation`: **passed**, including CSS compilation, full TypeScript validation and page generation. Initial build `/tmp/dev0360/build.log`, final application-CSS build `/tmp/dev0360/build-final.log`, and final controlled-provider-state preview build `/tmp/dev0360/build-states.log` all passed. At initial completion, both changed application CSS files matched that preview byte-for-byte; the later explicit focus-rule isolation is validated separately below. No shared `.next` output or repository build/compiler settings were changed.
- Preview boundaries: the isolated copy excludes populated environment files and private journals. Its Explore data function uses three explicitly named Preview fixture coaches from the existing directory fixture factory, plus empty/unavailable query cases. The final preview uses a local empty MapLibre style and a `location=map-unavailable` fixture returning HTTP 503 from a temporary style endpoint. This exercises the real map-error callback/list recovery/disabled control without touching a database. These harness files exist only under `/tmp/dev0360/validation`; they are not application changes. The first desktop/phone checks also loaded the actual OpenFreeMap provider successfully.
- Native Firefox desktop: two-column coach cards and side-by-side map remain, with the mobile switch hidden. Selecting the first coach produces a purple rounded frame and the matching map preview. Native responsive mode at **375 px**, **320×568** and **768×568**: compact white/lavender List/Map controls, readable count, unchanged responsive layout and no control/frame clipping. At 320 px, the disabled Map unavailable label also fits beside List; the controlled outage changes `view=map` to `view=list`, retains the location query and exposes all three cards with a status message.
- Native keyboard: focus List, press Tab to Map and Enter; observed strong purple focus and the canonical Map URL/visible map. Selecting a coach transfers focus to its map preview; its frame is now purple, and Tab reaches the independent public profile link. Back to list has the new white/purple formatting. Opening the profile link reaches `/coaches/preview-amina`; that configuration-free route truthfully shows profile unavailable because the fixture is not a persisted coach. Real profile content/authorization is not claimed.
- Native tablet state/history: empty results and discovery-unavailable messages retain Clear filters/Try again; clearing returns the ready list. Selecting Boxing, opening Map and using browser Back restores `discipline=Boxing&view=list`; filters and view remain intact. Existing card/query tests and source review cover the unchanged behavior contracts.
- Text/focus contrast against white: public purple **8.23:1**, muted disabled text **6.45:1**, selected-card border **5.01:1**; purple text on the lavender current segment **7.23:1**. The decorative lighter selection outline is supplemented by the darker border and stronger keyboard ring.
- Initial Chrome/Safari bindings were unstable, so validation used an independent Firefox window. Firefox's welcome dialog was dismissed without accepting its Continue/terms action. Native viewport/address input needed explicit focus/confirmation; only the subsequently observed viewport and URL states count as passed checks. A first preview startup failed with sandbox `listen EPERM`; retry with loopback-listen permission succeeded. No application fix was required for these tool/environment limits.
- No database/migration, authentication, provisioning, retained-data or mutating rehearsal was run. This is presentation proof, not a hosted rollout or real-account rehearsal. Relative-link checks passed 398 local targets across the ticket, specification and index; archive/index lifecycle and final CSS source-scope review passed. Cleanup stopped only the verified `/tmp/dev0360/validation` server on port 3160 and closed its Firefox tab/window; other browsers and shared output remain untouched.

| Criterion | Evidence | Result |
| --- | --- | --- |
| AC1 | Native 375/320/768 px current/count/disabled controls; contrast and final production CSS | Passed |
| AC2 | Desktop rounded selected frame; mobile map-preview focus, Tab/Enter and public-profile destination | Passed |
| AC3 | Native filter/List/Map/browser Back and controlled outage recovery; existing tests; CSS-only scope | Passed |
| AC4 | 32 tests, final CSS formatting/build/types, responsive/keyboard/state review and completed documents | Passed |

### Commit snapshot validation — 2026-10-19

Prepared a clean committed-source checkout with only the five DEV0360 files. `node --import tsx --test --test-concurrency=2 tests/marketplace-search.test.ts tests/coach-directory.test.ts tests/coach-directory-cards.test.ts tests/fitness.test.ts tests/events.test.ts` passed **28 tests**, zero failures/skips (`/tmp/dev0360/commit-tests.log`). The working-tree Events-directory test is excluded with its independent feature. `PATH="/Users/hoangdeveloper/.local/node/24.21.0/bin:$PATH" NODE_OPTIONS=--max-old-space-size=1536 npm run build -- --webpack` in `/tmp/dev0360/commit-validation` passed production compilation, full TypeScript validation and page generation (`/tmp/dev0360/commit-build.log`). Final two-file Prettier and whitespace checks passed; both committed stylesheets match this passing snapshot exactly.

The explicit List/Map and Back to list keyboard rules repeat the purple color, 3 px ring and 3 px offset already observed in native review. Their Explore-qualified selectors override the older generic green public focus rule on a clean checkout; browser interaction/DOM code remains unchanged. No additional browser or database rehearsal was run merely to commit. All **377** repository-relative Markdown targets in the isolated ticket/specification/index resolve without uncommitted reference records. Only DEV0360 is implemented; allocated IDs for excluded work remain reserved. The shared worktree and credentials are preserved.

## Risks, limitations, and follow-ups

Native review used explicit presentation fixtures and a controlled provider outage, with no live account/database proof or deployment. Existing Events integration remains independently tracked under DEV0358; this styling change does not resolve its unrelated integration blockers. Current browser behavior/authority code and retained data are unchanged. No other known limitation in this visual slice.

## Completion and review references

- Completed: 2026-10-19 — Explore controls and selected/focused frames match the public white/lavender/purple palette; responsive, keyboard and state checks passed.
- Commit: This record accompanies `[DEV0360] Align Explore controls with public colors`, created at the user’s explicit request with unrelated work excluded.
- Review: Scope/acceptance self-review passed; no independent review.
- Deployment or release: None.
