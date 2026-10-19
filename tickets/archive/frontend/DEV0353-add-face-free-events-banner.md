# Ticket DEV0353: Add face-free Events banner

- Status: Completed
- Created: 2026-10-18
- Last updated: 2026-10-19
- Milestone: Public marketplace visual polish
- Coordination: None — independent development ticket
- Related records: [DEV0351 shared public banner](DEV0351-align-explore-banner-and-search-with-home.md), [DEV0350 public theme](DEV0350-soften-public-page-colors-and-replace-home-banner.md), [DEV0240 Events discovery](DEV0240-add-group-event-discovery-and-joining.md).

## Objective and context

Add the user's supplied tug-of-war photograph to Events, using the same banner dimensions as Home/Explore and cropping out every face. Events currently opens with an inset text heading. Follow [public discovery](../../../docs/mvp-spec.md#42-discover-a-coach-and-time) and [group discovery](../../../docs/mvp-spec.md#15-group-training-and-events); preserve filters, event states and registrations.

## Scope and non-goals

- In scope: exact supplied static photograph/provenance, shared optimized hero with a face-excluding crop, full-width Events directory framing, readable existing title/description, retained My group sessions action and bounded directory content, specification and validation evidence.
- Out of scope: event detail/private group-history banners, filters/status/booking changes, edits to retained data, generated/retouched photographs, migrations, commits or deployment.

## Expected behavior and edge cases

The Events directory hero starts directly below the public header and shares Home/Explore's width and height: `clamp(210px, 24vw, 340px)` above 760 px and 160 px on phone. All faces in this particular photograph are above its vertical midpoint. Use an unedited source and CSS framing that always begins at that midpoint or lower, including narrow/tall phone slots; ordinary bottom-aligned cover alone would expose faces at narrow widths.

The crop centers the photograph inside a double-height frame anchored at the banner bottom, with cover scaling. The visible banner then begins at the original photograph's vertical midpoint for any aspect ratio and extends into its lower half. No blur/fade is counted as hiding a face. Keep the rope/hands/legs recognizable when framing allows. The title/description remain selectable HTML with a readable white left fade and fallback. Existing filters, statuses, empty/unavailable/invalid recovery and My group sessions remain reachable beneath the banner. Event details and private surfaces retain their layout.

## Assumptions, decisions, and dependencies

Confirmed: supplied image, equal banner size and no visible faces. Implementation default: a conservative lower-half crop, verified at desktop/tablet/phone widths. The explicitly supplied local source is `amari-shutters-S1Xo-Ygp_q0-unsplash.jpg`, visually matching the attachment at a higher original resolution of 7680 × 5120. Copy unchanged bytes; the UI uses Next.js optimized sources. Installed Next.js 16.3.8 image fill/style/CSS documentation was reviewed. No dependency/configuration/account change is needed. Preserve all unrelated shared worktree changes and never read populated environment files or private coach journals.

## Implementation plan

1. Record the design/index/specification amendment and copy the exact image with dimensions/hash/provenance.
2. Reuse MarketplaceHero on Events and allow its existing image props to receive a route-specific style. Apply the lower-half crop inline so initial rendering uses the same framing.
3. Add an Events-directory-only full-width shell class, retain bounded content and My group sessions, and reuse public hero text/fade styling without changing other event routes.
4. Run existing Events/Home/search/card tests, scoped lint/format, isolated typecheck/build, asset/link checks and crop geometry checks. Verify Events at desktop, 768 px and 375 px, including all faces remaining outside the banner, keyboard filters and relevant empty/error states without data edits.
5. Finish the evidence and archive only after all criteria pass.

### 2026-10-18 image integration adjustment

An explicit development render exposed a Next.js guard rejecting `fill` together with a custom image height. Before continuing implementation, keep the image's generated fill sizing unchanged and put it inside an Events-only, centered double-height frame anchored at the clipped banner bottom. The wrapper supplies the same crop geometry; the image fills that positioned parent normally. Home/Explore retain their original direct image markup. Remove the unsupported style extension and recheck development rendering, regressions and the final build. This replaces plan step 2's inline image-size approach without changing the requested design.

## Acceptance criteria

- [x] AC1: Events shows the exact supplied photograph in the same full-width banner dimensions/position as Home/Explore at desktop/tablet/phone widths.
- [x] AC2: No face is visible at any reviewed width; source bytes are unedited, image is not stretched, and title/description remain readable/selectable.
- [x] AC3: Filters, My group sessions, actual/empty/unavailable/invalid results and event-detail/private layout boundaries remain usable.
- [x] AC4: Relevant tests/lint/format/type/build, native responsive/keyboard/state checks, provenance, specification and links pass.

## Validation plan

Use existing Events, Home marketplace, marketplace search and card tests; no CSS-mirroring tests or mutating database rehearsals. Check source/public SHA-256, image metadata/optimizer and unchanged shared hero height rules. Independently calculate visible source bounds across representative and breakpoint widths and visually inspect actual desktop/768/375 crops. Review keyboard filter submission and existing actual/empty/invalid states; configuration-free production preview may supply unavailable evidence. Run scoped ESLint/Prettier and isolated typecheck/build without changing shared `.next`. Native browser control may overlap another rehearsal; only explicitly verified windows/destinations count.

## Implementation record

Implemented and verified locally on 2026-10-18. No commit or deployment was performed.

### Changes and rationale

Events now opens with the exact supplied tug-of-war photograph directly beneath the public header. It reuses MarketplaceHero and the unchanged Home/Explore height rules: `clamp(210px, 24vw, 340px)` above 760 px and 160 px below. The original title/description remain selectable HTML over the shared white fade. My group sessions is a labelled navigation area below the hero; filters/results remain bounded to 1180 px with the existing responsive gutters.

The image fills a centered frame of twice the hero height, anchored at the bottom and clipped by the hero. For hero height H and cover-rendered image height R, R is at least 2H; the image top is `-H + (2H - R) / 2 = -R / 2`. The visible source therefore starts exactly at the photograph's midpoint, y=2560 of 5120, at every aspect ratio. Every face in the inspected source lies above that line. Desktop keeps the rope, hands and legs; narrow framing keeps lower bodies and field. Face exclusion does not depend on the text fade, blur or altered source bytes.

The unedited asset is 7680 × 5120, 7,166,194 bytes, SHA-256 `aba1e97d807452f71bd6cd8ec999790bd992df5d404e4c8230bdbb8d2ffb3728`. The source filename credits Amari Shutters / Unsplash; the scene is illustrative rather than a claimed MovX event or venue. Existing event query parsing, session-type filter, pagination, statuses, registration authority and detail/history components are unchanged.

### Affected files

| File | Change and purpose |
| --- | --- |
| [Events directory](../../../src/app/events/page.tsx) | Shared photo hero, accessible group-session navigation and bounded existing filters/results. |
| [MarketplaceHero](../../../src/features/public/marketplace-hero.tsx) | Optional image frame class; generated Next.js fill image stays unchanged, and Home/Explore retain their direct image markup. |
| [Public theme](../../../src/app/public-page-theme.css), [shell](../../../src/components/shell.tsx) | Lower-half crop, shared hero contrast and full-width shell limited to exact `/events`; event detail/private history receive no new layout class. |
| [Photograph](../../../public/images/events-tug-of-war.jpg), [provenance](../../../public/images/README.md) | Exact user-supplied bytes and source/hash/crop explanation. |
| [Specification](../../../docs/mvp-spec.md#151-confirmed-choices-and-implementation-defaults), [index](../../README.md) | Adopted banner/face-exclusion behavior and completed work record. |

### Decisions and deviations

The initial inline image-height approach failed an explicit development render because Next.js rejects `fill` together with a custom image height. The adjustment above was recorded before replacing it with the positioned wrapper. The final development render and production build pass. No unsupported style prop remains.

Safari Responsive Design Mode initially produced blank paint and lost its page accessibility subtree in the first review tab. A fresh tab in the same dedicated window rendered correctly at 768 and 375 px, followed by real-app phone checks; blank frames were not counted as evidence. An attempted field click initially left focus in the viewport-width field and changed it to 353 px. The subsequent visible input/button focus and GET submission passed at that width, and 375 px was restored for final real-data checks. The separate coach-editor rehearsal window was preserved.

### Contracts, configuration, and operations

No schema, server API, dependency, environment or migration changes. The shared internal component gains an optional `imageFrameClassName`; existing callers keep their previous markup. Rollback is a code/static-asset revert; no data rollback. No account/coach edits, provisioning, password operations, registrations or mutating rehearsals were performed. Populated environment files and private coach journals were not read. The final build ran in an isolated snapshot and its configuration-free preview used a separate port; shared `.next` and the existing local app were preserved.

## Validation results

2026-10-19 commit verification: the exact staged source passed 51 frontend/domain and 16 backend regressions on Node 24.21.0, scoped ESLint/Prettier, isolated typecheck and production webpack build. Shared contract/index changes exclude unrelated work; 655 local links resolve, with the two intentionally private credential-journal links excluded from version control. DEV0358 records commands, snapshot and remaining native acceptance; committing does not complete DEV0357/DEV0358 or deploy the feature.

Environment: 18 October 2026, Node 24.21.0 (`/Users/hoangdeveloper/.local/node/24.21.0/bin/node`), Next.js 16.3.8. Commands below used that Node runtime.

- `node --import tsx --test tests/events.test.ts tests/home-marketplace.test.ts tests/marketplace-search.test.ts tests/coach-directory-cards.test.ts`: **31 passed**, none skipped/failed; final log `/private/tmp/dev0353-tests.log`. Existing static-render image-quality warnings occur when Next configuration is not loaded; actual configuration permits quality 95.
- `node node_modules/eslint/bin/eslint.js src/app/events/page.tsx src/features/public/marketplace-hero.tsx src/components/shell.tsx`: **passed** after the wrapper correction.
- `node node_modules/prettier/bin/prettier.cjs --check src/app/events/page.tsx src/features/public/marketplace-hero.tsx src/components/shell.tsx src/app/public-page-theme.css public/images/README.md`: **passed**.
- Explicit `NODE_ENV=development node --import tsx --input-type=module` rendering with React `renderToStaticMarkup(MarketplaceHero)` and assertions for the image frame and normal `height:100%`: **passed**, repeated on the final source. The original inline-height render failed the Next.js guard and was corrected; the initial build was terminated and is not counted as a pass.
- Isolated snapshot `/private/tmp/movx-dev0353-l8lgaus4`, without populated environment files/private journals: `npm run typecheck` **passed**; `node node_modules/next/dist/bin/next build --webpack` **passed** sequentially after the correction. Logs `/private/tmp/dev0353-types-final.log` and `/private/tmp/dev0353-build-final.log`. The final Events route, shared hero, shell, public theme and photograph all match the passing snapshot byte-for-byte. No shared build output was overwritten.
- Original/public photograph: **identical bytes and SHA-256**; original metadata 7680 × 5120. Independent cover-crop calculations at widths 320, 375, 430, 560, 640, 760, 761, 768, 1024, 1440, 1920 and 2560 px all start at source y=2560 and end at or before y=5120. Existing hero height stylesheet is unchanged.
- Configuration-free final production preview on port 3159: `/events` **HTTP 200**, 19,768 bytes, with the real unavailable component; `/events?discipline=Unsupported` **HTTP 200**, 19,734 bytes, with the invalid alert/reset. Optimizer request `/_next/image?url=%2Fimages%2Fevents-tug-of-war.jpg&w=1920&q=95` **HTTP 200**, 1,119,361 bytes and 1920 × 1280 JPEG via curl. This measures JPEG delivery, not browser WebP transfer size. Preview server was stopped after review.
- Native Safari final-build desktop at approximately 1233 px, **768 × 844** and **375 × 844**: **passed**. Banner starts below the header at the shared responsive height, no heads/faces appear, the source is not stretched, and title/description, My group sessions and complete filter controls remain readable without horizontal clipping. HTML accessibility includes the title, description and descriptive image alt.
- Native keyboard at 353 px: entering `DEV0353-no-match`, Option-Tab to the visibly outlined Find sessions button and Return reached `/events?discipline=&location=DEV0353-no-match`; **passed**. Unavailable-state Try again preserves the location filter. The final 375 px review was repeated on the real app rather than relying on the earlier blank responsive frames.
- Real app `/events` returned **HTTP 200**, 33,093 bytes. Native 375 px review shows its existing Daniel Park event, date/time, truthful demo label, waiting-for-confirmation status, venue, seats and pay-at-session price. At `/events?location=DEV0353-no-match`, the actual empty message and Show all group sessions/Find a coach recovery controls fit and remain reachable. At `/events?discipline=Unsupported`, the invalid message and Reset search fit; activating Reset search restored the real event. **Passed**, with no data mutation.
- Opening that real event's detail link at 375 px **passed**: the original heading, status and registration eligibility panel remain, with no directory banner. My group sessions retains `/sessions/groups`; private history code is untouched and the new shell class applies only to exact `/events`. No registration or private-history mutation was attempted.
- Final source/scope review, local link/anchor checks and `git diff --check` on owned changes: **passed**. Ticket/index/provenance/specification links were updated on archival. Database/migration tests and broader authentication/editor rehearsals are not applicable to this presentation slice; existing regression suites cover preserved query/state behavior.

| Criterion | Evidence | Result |
| --- | --- | --- |
| AC1 | Exact source, unchanged shared height rules and native desktop/768/375 framing. | Passed locally |
| AC2 | Source/hash, lower-half proof across breakpoints, normal cover aspect ratio and final native crops/text. | Passed locally |
| AC3 | Keyboard GET, real event/empty/invalid/reset, final-build unavailable state, detail navigation and route-specific shell boundary. | Passed locally |
| AC4 | 31 regressions, lint/format/type/final build, development guard check, native review, provenance/specification/links. | Passed locally |

## Risks, limitations, and follow-ups

No unmet acceptance criteria remain. Future image replacement must recheck face positions rather than assuming the same midpoint rule applies to another photo. The unavailable state was reviewed in a configuration-free production preview without interrupting the real database. The high-resolution source is retained for responsive optimization; the recorded JPEG transfer is not a full performance audit. Parallel authentication/editor changes and earlier public-page refinements remain preserved. Hosted deployment and independent review are outside this ticket.

## Completion and review references

- Completed: 2026-10-18 — all acceptance criteria passed locally.
- Commit: Included with this record in the user-authorized DEV0350–DEV0358 public-discovery/Events commit; see Git history for this ticket.
- Review: Scope/implementation self-review and native responsive/keyboard/state checks completed; no independent review.
- Deployment or release: None.
