# Ticket DEV0043: Playful club UI redesign

- Status: Completed
- Created: 2026-09-21
- Last updated: 2026-09-21
- Milestone: M0 frontend visual refinement
- Coordination: None — independent development ticket
- Related records: Historical baseline [DEV0008](../../archive/frontend/DEV0008-repx-club-frontend.md); downstream social behavior [DEV0023](../backend/DEV0023-minimal-shared-activity-feed.md)

## Objective and context

Implement the user's preferred first design concept: a polished cream/lime fitness club interface with bold headings, restrained lilac/coral accents, photography and a few small doodles. The second, heavily illustrated concept was rejected. Follow the [MVP contract](../../../docs/mvp-spec.md) and retain current functioning preview and authentication controls.

## Scope and non-goals

- In scope: one coherent presentation slice covering shared typography/colours/cards/navigation and the Feed hero/discovery rail, local visual assets, responsive/accessibility checks and specification alignment.
- Out of scope: backend/auth changes, new social functionality, Cheers, notifications, session-language data, new filters, financial behavior or a new landing-page route. Keep existing feed filtering behavior until DEV0023.

## Expected behavior and edge cases

The home hero uses FIND YOUR PEOPLE. MOVE TOGETHER. and descriptive gym/studio/class/challenge copy with working Explore/Challenges links. Photo-led local discovery links lead to existing venues/classes/events. Existing follows, filtering, booking previews, saved items, wallet and sign-in remain functional. Mobile condenses the hero and preserves navigation without horizontal overflow. Decorative graphics are hidden from assistive technology; motion respects reduced-motion settings, keyboard focus stays visible and content remains readable without images.

## Assumptions, decisions, and dependencies

The accepted first generated image is a visual reference, not authority to implement every pictured feature. Use current seeded content and explicitly illustrative photography; no fake live metrics or inert Cheer buttons. Shared typography and Feed composition are one reviewable visual change. Reuse existing artwork where suitable; a locally served display font and illustrative studio images may be added. Preserve concurrent backend work and do not reset its environment/database.

## Implementation plan

1. Retain the accepted concept in project design references; refine shared tokens and a locally served display font.
2. Replace the small dark Feed hero with a full-width lilac/photo composition, restrained decorative accent and primary discovery links. Add useful compact studio/event discovery to the rail and simplify competing decorative content.
3. Apply the shared visual treatment to cards, headings and navigation; adapt mobile/tablet breakpoints without changing product state or authentication logic.
4. Update the product design description and run lint, types, formatting, production build and relevant browser regressions. Inspect screenshots at desktop/mobile and narrow/tablet widths, keyboard paths and error/modal states.
5. Complete this record, archive it, update links/index and serve the optimized preview at the current local origin.

## Acceptance criteria

- [x] AC1: Home and shared visual elements follow the first restrained concept, with readable slogan, real navigation, locally served assets and explicit fixture boundaries.
- [x] AC2: Feed, Explore, Challenges, Profile and relevant detail/form/modal flows work at desktop/mobile widths; no narrow-screen overflow and keyboard/reduced-motion behavior remains usable.
- [x] AC3: Existing relevant browser regressions, lint/types/build and changed-file formatting pass; no new product/backend/financial behavior is implied.
- [x] AC4: Specification, asset provenance and ticket record reflect actual delivery; optimized local preview serves the updated UI.

## Validation plan

Use existing Playwright flows for navigation, preview booking/privacy, discovery, events and wallet/Auth presentation where affected by shared styling. Add only meaningful coverage for new hero/rail destinations and responsive layout. Capture and inspect desktop/mobile screenshots plus narrow/tablet viewport checks. Run npm lint/typecheck/build and formatting on changed source files; no database reset/migration tests or devnet transaction rehearsal applies to this presentation-only slice.

## Implementation record

### Changes and rationale

Implemented the first restrained concept as a shared visual system and a rebuilt Feed composition. The full-width lilac/photo hero carries the requested slogan, marker underline, small spark and coral sticker. The rail now links to existing studio catalogue results and Run & Coffee instead of the illustrative weekly-goal/membership promotion panels. Existing follows, preview state, discovery and authentication controls remain intact. Shared headings/cards/navigation use the new visual treatment across routes.

### Affected files

| File                                                                                                                                          | Responsibility                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Feed (historical path `src/features/feed/feed.tsx`)                                                                                           | Hero, working discovery links, catalogue-derived studio cards and existing feed/follow controls.                 |
| [Club theme](../../../src/app/club-theme.css)                                                                                                 | Shared typography/surfaces, hero/rail composition, phone/tablet layouts and reduced-motion treatment.            |
| [Global styles](../../../src/app/globals.css)                                                                                                 | Colour/radius tokens; remove obsolete dark-hero rules.                                                           |
| [Layout](../../../src/app/layout.tsx)                                                                                                         | Load the local display font and theme after existing styles, preserving Auth/preview providers.                  |
| [Package manifest](../../../package.json) and [lockfile](../../../package-lock.json)                                                          | Pin Bricolage Grotesque 5.3.0; no unrelated dependency upgrades.                                                 |
| [Asset record](../../../docs/design/DEV0043-assets.md)                                                                                        | Image provenance, final built-in generation prompts, reference and local WebP paths.                             |
| Redesign checks (historical path `tests/browser/redesign.spec.ts`) and preview checks (historical path `tests/browser/preview.spec.ts`)       | Hero/rail destinations, keyboard use, responsive text clipping/image checks and updated home heading assertions. |
| [Specification](../../../docs/mvp-spec.md#visual-design-direction--21-september-2026), [README](../../../README.md), [index](../../README.md) | Accepted visual direction, setup/asset navigation and actual delivery status.                                    |

### Decisions and deviations

The first approved image is a direction reference, not a static page background. Kept the existing branded mark and real Auth/wallet controls, reused the running photograph and added two illustrative studio images. No cartoon mascots or inert Cheer buttons were introduced. The current For you/Following semantics stay in place for DEV0023 to replace with its real social data contract.

Visual review found two issues and corrected them before completion: move the sticker to the bottom of the photograph so it does not obscure faces; use one-column recommendation cards below 600px so facts cannot clip on 320px screens. Strengthened the responsive check for text bounds and loaded studio imagery. Studio names/activities/areas come from the existing catalogue rather than a duplicate data definition. No coordination record or backend changes were necessary.

### Contracts, configuration, and operations

No data/API/schema/authentication/financial changes. Added the exact local font dependency `@fontsource-variable/bricolage-grotesque@5.3.0` (OFL-1.1); Manrope remains the body font. Two WebP interiors total about 208 KiB and are locally served through Next Image; the larger concept PNG is documentation only. No external image/font requests. No environment variables or migrations added. Restarted the existing localhost:3100 production preview without changing the origin, browser storage or database.

## Validation results

21 September 2026, Node 24.21.0, Next.js 16.3.5 and installed Google Chrome:

- `npm run lint` — passed, repeated after the final source adjustments.
- `npm run typecheck` — passed. Final production build also passed TypeScript validation.
- `npx --no-install prettier --check src/app/club-theme.css src/app/globals.css src/app/layout.tsx src/features/feed/feed.tsx tests/browser/preview.spec.ts tests/browser/redesign.spec.ts package.json` — passed; `git diff --check` passed.
- `npm run build` — passed on the final source, compilation 6.8 seconds, TypeScript and all 12 static-generation steps completed. Earlier build attempts failed with a cached Turbopack local-worker port-permission error. An authorized retry initially replayed it; moving only `.next/cache/turbopack` to `/private/tmp/repx-DEV0043-turbopack-cache` and rebuilding with local-process permission resolved it. No production configuration workaround was added.
- `npm run test:e2e` — 38 tests passed in 3.8 minutes on desktop 1440×1040 and mobile 393×852. Covered public discovery, guide/search, event/draft flows, booking/sharing/cancellation/privacy, dialogs/storage errors, wallet guidance, sign-in and the initial redesign.
- After visual corrections, `npm run test:e2e -- tests/browser/redesign.spec.ts tests/browser/preview.spec.ts --grep 'home discovery|club layout|four surfaces|keyboard dialog'` — 8 tests passed in 57 seconds against the final build. Includes 320/600/820/1100px widths, reduced-motion setting, visible keyboard focus, card fact bounds, loaded local photos and filtered studio/event destinations. Four primary routes and blocked/corrupt-storage dialogs remain usable.
- Inspected actual desktop home, challenge discovery, mobile home and narrow/tablet screenshots. Final desktop/mobile screenshots are retained as [desktop](../../../docs/design/DEV0043-desktop.png) and [mobile](../../../docs/design/DEV0043-mobile.png). The corrected sticker leaves faces clear and narrow recommendation cards display full terms/prices.
- `python3 /private/tmp/repx-DEV0043-doc-check.py` — passed 158 local file/anchor links across five documentation records, unique DEV0043 and matching final index status. `git diff --check` passed after archiving.
- Confirmed PID 31792 belonged to this project, stopped it and ran `npm run start` with the existing localhost:3100 origin. A successful `curl --fail --silent http://localhost:3100/` response contained the redesigned slogan and studio image path, with no development client. Browser storage and the database were not reset.
- No new domain logic, migrations or financial paths: domain/database resets and real-Phantom/devnet rehearsals were not repeated. Existing authentication presentation tests passed; this ticket makes no claim of new identity or transaction implementation.

| Criterion | Evidence                                                                                       | Result |
| --------- | ---------------------------------------------------------------------------------------------- | ------ |
| AC1       | Actual desktop/mobile screenshots, local font/assets, hero/rail link checks and fixture labels | Passed |
| AC2       | Full browser suite plus final narrow/tablet, keyboard, modal/error and four-route checks       | Passed |
| AC3       | Lint/type/format/build and 38-test initial + 8-test final affected-flow runs                   | Passed |
| AC4       | Specification/provenance/link checks and verified restarted production response                | Passed |

## Risks, limitations, and follow-ups

The shared social backend and Cheer behavior remain in DEV0023. Concurrent identity work is outside this ticket. The image is a direction reference; responsive implementation may differ to preserve existing functionality and truthful demo labels.

## Completion and review references

- Completed: 2026-09-21; accepted restrained redesign implemented and verified on desktop/mobile, including the optimized local preview.
- Commit: Included in `[DEV0043] [DEV0044] [DEV0045] Refine club design and simplify navigation` under the user’s 2026-09-21 commit/push request.
- Review: Self-reviewed source diff, screenshots and acceptance evidence; no independent review.
- Deployment or release: Restarted the existing localhost:3100 optimized preview; no hosted deployment.

### Commit handoff — 21 September 2026

The user authorized committing and pushing the completed UI work. DEV0043–DEV0045 share successive edits in the theme, shell, specification and browser checks; the final tested state is committed together with all three development IDs. Earlier validation results above remain the implementation evidence. No additional product change is introduced by this handoff.
