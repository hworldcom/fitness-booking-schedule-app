# Ticket DEV0350: Soften public page colors and replace Home banner

- Status: Completed
- Created: 2026-10-18
- Last updated: 2026-10-19
- Milestone: Public marketplace visual polish
- Coordination: None — independent development ticket
- Related records: Current card baseline [DEV0316](DEV0316-redesign-coach-directory-cards.md); historical Home framing [DEV0309](DEV0309-lower-home-banner-slogan-and-expand-framing.md), image quality [DEV0310](DEV0310-improve-home-banner-image-quality.md); public Events [DEV0240](DEV0240-add-group-event-discovery-and-joining.md).

## Objective and context

Continue the user's white public-page direction on Events and How it works, replace Home's collage with their supplied battle-rope photograph, and make both purple and green decoration much milder. Follow the [public discovery contract](../../../docs/mvp-spec.md#42-discover-a-coach-and-time) and [group-training contract](../../../docs/mvp-spec.md#15-group-training-and-events). DEV0316 owns the prior card/navigation delivery and is now archived; this independent ticket owns the new visual amendment only.

## Scope and non-goals

- In scope: white public Events/How it works panels/actions with restrained purple emphasis; softer Home backdrop/card-cover gradients; exact user-selected photograph as Home hero, updated alt/provenance, and a readable existing slogan within the unchanged banner dimensions.
- Out of scope: private workspace redesign, event booking/status semantics, navigation/filter behavior, coach media/profile data, database changes, generated/replacement photography and commits/deployment.

## Expected behavior and edge cases

Events filters/cards/empty or unavailable panels and How it works steps/lifecycle/callout use white surfaces and mild borders. Status text and non-color state cues remain; warnings/errors retain their meaningful distinctions. Public-only selectors avoid changing private group-session/workspace surfaces. Home starts white, with a much softer lower purple/green blend and decorative missing-banner covers. Keep readable text and keyboard focus contrast.

The supplied 4161 × 2779 photo matches the existing local `karsten-winegeart-eGSBVVtVCCw-unsplash.jpg` exactly by visual inspection/dimensions. Copy the source bytes into an application-owned static asset; no generative edit. Keep hero height `clamp(210px, 24vw, 340px)` and its existing 160 px phone rule. Use CSS cover positioning and a restrained left fade so the slogan remains selectable/readable and the athlete remains recognizable. Normal cropping in the same panoramic slot is expected; do not stretch the photo or imply a real MovX coach/venue. Preserve prior collage assets as historical records.

## Assumptions, decisions, and dependencies

Confirmed: white styling on Events/How it works, supplied Home photo, unchanged banner size, much milder purple and green. Defaults: softer gradient opacities/stops and left slogan placement are implementation choices to verify visually. Existing Next.js 16.3.8 image/CSS documentation was reviewed in this continuation; keep the existing responsive `getImageProps` quality/size/fallback pipeline. Existing local services are read-only review targets. No new service, dependency, credential, migration or account change is required. Never read populated environment files or private coach journals.

## Implementation plan

1. Record the design amendment and asset provenance; update the current specification and index.
2. Add scoped public styling for Events/How it works, retaining status/filter/action contracts. Soften existing Home/card gradients.
3. Copy the supplied photo, switch Home's source/alt and adjust only crop/copy contrast/alignment; preserve height and responsive rules.
4. Run existing Home/Events/search checks, scoped lint/format, isolated typecheck/build and link/asset consistency checks. Review Home/Events/How it works at desktop and phone widths, keyboard focus, and existing empty/unavailable/error states without writing data.
5. Review against acceptance criteria and record exact evidence/remaining limits. Archive only if every required check passes.

### 2026-10-18 phone review adjustment

Native 375 px review found How it works retaining its desktop three-column eyebrow/title/description heading, compressing the title into many narrow lines. Before completing the visual amendment, stack that existing heading at phone widths only (640 px and below), preserving all text/actions and desktop layout. This is a small readability repair exposed by the required responsive validation, not a new flow or a user-selected breakpoint. Recheck the phone heading and rerun CSS formatting/build after this change.

## Acceptance criteria

- [x] AC1: Events and How it works use white panels/actions and mild purple emphasis at desktop/phone widths without changing routes, filters, state/status meaning or private workspace styling.
- [x] AC2: Home uses the supplied photo with correct alt text, readable selectable slogan and unchanged desktop/tablet/phone banner heights; no image stretching or historical asset removal.
- [x] AC3: Home backdrop and missing-banner covers have visibly milder purple and green; text/focus remain readable and four-item discovery still works.
- [x] AC4: Affected tests, formatting/lint/type/build and relevant desktop/phone/keyboard/error checks pass, with an accurate record and valid project links.

## Validation plan

Run the existing Home marketplace, search, coach-card and Events tests; avoid tests that mirror static CSS rules. Compare source/public photo hashes and metadata, inspect responsive image URLs and unchanged height rules. Run scoped ESLint/Prettier and clean-copy typecheck/production build to protect the shared app. Native browser review at 375 px and desktop (plus tablet crop if needed) must cover public filters/actions, status/empty/unavailable panels, card/hero clipping and visible keyboard focus. No migrations or write-path rehearsals are applicable to these presentation-only changes.

## Implementation record

### Changes and rationale

Implemented the public visual amendment. Events panels/filters/cards/actions and How it works steps/lifecycle/callout now use white surfaces with mild purple borders/text; the public navigation underline follows that accent. Public-only selectors leave authenticated workspaces outside the change. Confirmed-event badges retain explicit status text on white; amber waiting and red error/cancelled cues remain. No copy, navigation, booking/filter contract or data is changed.

Home now uses the exact 4161 × 2779 source photograph (2,157,917 bytes), SHA-256 `31913577cd4c7a24c3b7d0ba79c77c11f23c75cc785e9a4c984c11e2d5c96b58`. The alt text describes battle-rope training without identifying a MovX coach/place. Existing `getImageProps` quality 95, minimum 480 px size hint and high-priority loading remain. The original hero height rules are unchanged; only image crop (`center 35%`), left copy alignment and white fade were adjusted so the athlete and selectable slogan are readable in the existing panoramic slot. No photo bytes were generated or edited.

Home's lower purple opacity dropped from 28% to 8%, green from 34% to 9%; the base and decorative cover stops are now near-white lavender/mint. Stronger foreground/focus colors remain legible. User clarified that both tints should be milder before these changes; no unilateral color decision was treated as their requirement.

The final phone review also exposed an inherited flex layout squeezing How it works' eyebrow, title and description into three narrow columns. At 640 px and below, the scoped heading now explicitly uses a one-column grid with 12 px gaps. Native 375 px replay confirms readable stacked text; desktop layout and all content remain unchanged. The final CSS was formatted and included in a new passing production build.

### Affected files

| File | Role |
| --- | --- |
| [src/features/public/coach-story.tsx](../../../src/features/public/coach-story.tsx) | Home photo/alt and a unique How it works styling class; existing content/actions preserved. |
| [src/app/public-page-theme.css](../../../src/app/public-page-theme.css), [layout.tsx](../../../src/app/layout.tsx) | Public-only white Events/How it works panels/actions, purple accents and Home photo/copy framing; imported after existing layers. |
| [src/app/coach-directory-cards.css](../../../src/app/coach-directory-cards.css) | Softened both decorative gradient colors; card geometry unchanged. |
| [public/images/home-battle-ropes.jpg](../../../public/images/home-battle-ropes.jpg), [asset record](../../../public/images/README.md) | Unedited user-selected photo and source/hash/framing provenance; historical banners retained. |
| [docs/mvp-spec.md](../../../docs/mvp-spec.md), [ticket index](../../README.md), [DEV0316 follow-up note](DEV0316-redesign-coach-directory-cards.md) | Current design contract, corrected current four-card flow and separate ownership of the visual amendment. |

### Decisions and deviations

No material implementation deviation. The additional request to soften both green and purple was adopted before source edits. Read-only native desktop review showed the exact Home photo, readable slogan and softer card covers, plus white Events/How it works surfaces. Native browser control then overlapped another active MOVX test (including its separate port-3162 map rehearsal); do not change that test's settings/routes. The user confirmed that the competing browser test was paused on 18 October; final phone/keyboard validation then resumed. Firefox was not used beyond its first-launch agreement screen; no setup/terms were accepted and it was closed.

### Contracts, configuration, and operations

No data/schema/API/dependency/environment changes. Rollback is a code/static-asset revert; no data rollback. Existing coach/account content remains untouched.

## Validation results

2026-10-19 commit verification: the exact staged source passed 51 frontend/domain and 16 backend regressions on Node 24.21.0, scoped ESLint/Prettier, isolated typecheck and production webpack build. Shared contract/index changes exclude unrelated work; 655 local links resolve, with the two intentionally private credential-journal links excluded from version control. DEV0358 records commands, snapshot and remaining native acceptance; committing does not complete DEV0357/DEV0358 or deploy the feature.

Date/environment: 2026-10-18, existing local app/Supabase, Node 24.21.0, Next.js 16.3.8. No DB writes, migrations, provisioning, password changes or private-journal/env reads.

- `node --import tsx --test tests/home-marketplace.test.ts tests/marketplace-search.test.ts tests/coach-directory-cards.test.ts tests/events.test.ts`: **31 passed**. Existing static-render image-quality warning occurs without the loaded Next config; actual config retains 75/95 and optimized image serving passes. No implementation-mirroring CSS tests were added.
- `/Users/hoangdeveloper/.local/node/24.21.0/bin/node node_modules/eslint/bin/eslint.js src/features/public/coach-story.tsx src/app/layout.tsx`: **passed**, repeated on the final files.
- `/Users/hoangdeveloper/.local/node/24.21.0/bin/node node_modules/prettier/bin/prettier.cjs --check src/features/public/coach-story.tsx src/app/layout.tsx src/app/coach-directory-cards.css src/app/public-page-theme.css public/images/README.md`: **passed**, including the final phone CSS and archived asset link.
- Clean snapshot `/private/tmp/movx-dev0350-a2cd2z_1`, excluding populated config/work journals and symlinking installed dependencies: `npm run typecheck` then `node node_modules/next/dist/bin/next build --webpack`: **passed**. The production build was repeated after the final phone heading fix and **passed**. Logs `/private/tmp/dev0350-types.log`, `/private/tmp/dev0350-build-final.log`; affected test log `/private/tmp/dev0350-tests.log`. Shared `.next` was not overwritten.
- Source/public-photo SHA-256 comparison: **identical**. The shared Home sizing stylesheet `src/app/coach-story.css` has no diff: desktop/tablet `clamp(210px, 24vw, 340px)` and phone 160 px remain; the new stylesheet adds no hero height rule.
- Read-only HTTP: Home **200 / 59,494 bytes**, four initial cards and correct photo/alt; Events **200 / 28,437 bytes**, one existing card; How it works **200 / 27,692 bytes**, new styling class and retained content. Nonmatching Events location and unsupported discipline return **200** with their existing empty/invalid-alert messages, respectively. Files `/private/tmp/dev0350-{home,events,how,events-empty,events-invalid}.html`.
- Existing image optimizer `/_next/image?url=%2Fimages%2Fhome-battle-ropes.jpg&w=1920&q=95`: **200 / 698,854 bytes** with curl's default JPEG negotiation. This proves serving, not the browser's negotiated WebP transfer size.
- Native Safari desktop: new Home photo at unchanged visual banner height, recognizable athlete, selectable left slogan, white upper page and much milder purple/green covers; Events white filter/card surfaces with purple action/navigation accent and retained amber waiting label; How it works white four-step cards with purple icons and readable content. These desktop observations passed.
- Native Safari Home at **375 × 844** and **768 × 844**: **passed**. Photo and two-line slogan fit the unchanged banner slot without stretching; the athlete remains recognizable. Four initial coach records remain in the accessibility tree, with near-white lavender/mint covers. The final normal desktop Home replay also passed.
- Native Safari Events at **375 px**: **passed**. White single-column filters and existing session card retain readable date/location/price/seats and the amber waiting-for-confirmation label. Keyboard Option-Tab/Return through Skip to content and the location filter showed visible purple focus on both input and Find sessions; submitting `DEV0350-no-matching-venue` reached the native GET result with its expected empty message. The empty panel and `/events?discipline=Unsupported` invalid-filter alert were visually checked, including their readable recovery actions and distinct muted-red alert border.
- Native Safari How it works at **375 px**: **passed** after the scoped heading repair. Heading text stacks readably; step/lifecycle/callout surfaces are white. Keyboard navigation through Skip to content focused Explore coaches with a clear purple outline; Return reached `/explore`. Safari's existing keyboard preference requires Option-Tab to include links/buttons. Initial no-change observations during slow local route loads were not counted as successful navigation; the final destination was verified.
- Native unavailable-state preview at **375 px** and **1440 px**: **passed**. The actual `EventsUnavailable` component was rendered in a temporary isolated local route at `http://localhost:3157/visual-state-check`, with the real CSS and an explicit preview label. Its white bordered panel, complete unavailable message and Try again action remained readable. This checks presentation without simulating a production outage or querying/changing application data. Preview source stayed outside the repository; the temporary server was stopped after review. Safari was returned to normal desktop mode and real Home.
- Link/anchor checks and `git diff --check` on the owned files: **passed**. The completed record was moved to the archive and affected index/asset/historical follow-up links updated.

| Criterion | Evidence | Result |
| --- | --- | --- |
| AC1 | Desktop/375 px Events and How it works; native empty/invalid/unavailable panels, retained status text, scoped selectors and Events tests. | Passed locally |
| AC2 | Exact source hash, correct photo/alt, untouched height stylesheet and desktop/768/375 px crop review. | Passed locally |
| AC3 | Reduced opacity/stops, native soft covers, four-card HTTP/accessibility tree and existing discovery tests. | Passed locally |
| AC4 | 31 tests, lint/format/type/final build/link checks plus native keyboard filter submission and Explore activation. | Passed locally |

## Risks, limitations, and follow-ups

No unmet acceptance criteria remain. The unavailable panel was checked as the actual component in an isolated preview, not as evidence of a real service outage/recovery. Deployment and independent review were not performed. DEV0316's separate card/map/history/provider/no-JavaScript evidence remains in its completed archive record. The supplied photo is illustrative and normal panoramic cropping remains intentional.

## Completion and review references

- Completed: 2026-10-18 — all four acceptance criteria passed locally.
- Commit: Included with this record in the user-authorized DEV0350–DEV0358 public-discovery/Events commit; see Git history for this ticket.
- Review: Implementation/contract self-review and final native responsive/keyboard/state review completed. No independent review.
- Deployment or release: None.
