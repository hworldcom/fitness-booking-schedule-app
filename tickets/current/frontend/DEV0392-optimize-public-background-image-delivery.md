# Ticket DEV0392: Optimize public background image delivery

- Status: In progress
- Created: 2026-10-20
- Last updated: 2026-10-20
- Milestone: M3 public discovery performance maintenance
- Coordination: None — independent development ticket
- Related records: Historical asset preservation: [DEV0391](../../archive/frontend/DEV0391-remove-unused-public-images.md). Independent server-latency investigation: [DEV0368](../backend/DEV0368-investigate-public-availability-read-latency.md). Independent data-cache policy: [DEV0393](../backend/DEV0393-control-public-directory-cache-freshness.md). UAT Events dependency for complete live-page validation: [DEV0394](../../archive/backend/DEV0394-restore-uat-events-directory-reads.md).

## Objective and context

The user reports slow Home, Explore and Events background photos and requested tickets for smaller downloads and stronger browser caching. These are local public images delivered through Next.js/Vercel image optimization, not image bytes loaded from the database. Preserve the selected photographs and page design while reducing transfer size and repeat-visit requests. Follow [public discovery](../../../docs/mvp-spec.md#42-discover-a-coach-and-time), [Events presentation](../../../docs/mvp-spec.md#151-confirmed-choices-and-implementation-defaults) and the [definition of done](../../../docs/mvp-spec.md#11-definition-of-done).

Read-only UAT probes on 2026-10-20 found quality 95, `sizes="(max-width: 480px) 480px, 100vw"` and browser `Cache-Control: public, max-age=0, must-revalidate`. At 1080 pixels, WebP response bodies were Home 253,250 bytes, Explore 192,414 bytes and Events 435,076 bytes. Diagnostic quality-75 requests produced 69,940 / 45,476 / 196,138 bytes respectively. These demonstrate byte savings, not an established load-time improvement: quality-95 responses were cache hits and the first quality-75 requests were misses. The private probe artifacts are under ignored `work/banner-loading-audit-20261020/`; this record preserves the findings without requiring those artifacts.

## Scope and non-goals

- In scope: hashed static image imports or equivalent versioned URLs; long-lived immutable browser caching for these three backgrounds; appropriate responsive width hints/variants; a visually checked quality setting; delivery measurements and current asset documentation.
- Out of scope: regenerating or replacing photographs, changing source bytes, changing layout/headlines, deleting more images or Git history, migrating storage providers, ISR (Incremental Static Regeneration) for pages, uploaded/profile-image caching, or a site-wide cache policy.

## Expected behavior and edge cases

Repeat visits can reuse unchanged backgrounds without routine network validation while the browser retains a fresh cached copy. Changing image contents produces a new URL so a deployment does not leave the browser displaying the previous image. First visits receive an appropriate optimized width and acceptable visual quality for the actual crop and device pixel ratio.

Keep Home/Explore framing, readable text and image-failure backgrounds. Events must retain its lower-half-only crop with every face excluded at mobile and desktop widths. Its image frame is twice the visible banner height; do not remove the 480 CSS-pixel minimum everywhere without calculating the source width needed for this crop. Width and quality changes must not blur the visible content or introduce layout shifts. Existing privacy/revocation rules for uploaded banners and account pictures remain intact.

## Assumptions, decisions, and dependencies

- Confirmed: the affected pictures are Home / Explore / Events backgrounds. On 2026-10-20 the user accepted three implementation steps within this ticket and authorized starting step 1.
- Adopted step-1 implementation choice: use Next.js content-hashed static imports and its immutable cache behavior. Keep quality 95, existing responsive width hints/variants, eager loading, image bytes and CSS unchanged so caching can be verified independently.
- Later-step proposals: compare quality 75 and intermediate candidates against current 95; tune responsive widths using measured viewport/pixel-density combinations. No lower quality or new width setting has been adopted.
- Inspect installed Next.js 16.3.8 bundled image documentation before implementation. Its behavior on a local production server is not sufficient proof of live Vercel browser headers.
- Keep original JPEG hashes/provenance. [The asset guide](../../../public/images/README.md) currently documents quality 95 and must be updated when delivery changes are adopted. Amend the specification in the same change if an overall design/behavior contract changes.
- Image work can proceed independently of DEV0393 and DEV0368. DEV0394 restored UAT Events reads on 2026-10-20; its completed record supplies the working live-page baseline.

## Implementation plan

1. **Versioned URLs and caching — delivered and verified 2026-10-20.** Capture a healthy-UAT baseline, accept static image data in the shared hero, and import the three original JPEGs in the Next.js routes. Home/Explore presentation components receive the imported data as a required prop; existing Node component tests supply a bounded static-image fixture instead of needing a framework image loader. Verify production source sets, immutable headers, unchanged repeat-visit reuse and content replacement in an isolated copy. Check desktop/mobile rendering, keyboard use and an image-failure scenario; document local versus UAT results. Do not change quality, width hints/variants or crops in this step.
2. **Compression — pending.** Compare quality 85 and 75 with 95 at matching widths and cache states, inspect desktop/mobile crops, adopt a justified quality setting, and record bytes plus cold/warm timings. Change the optimizer quality allowlist only if needed.
3. **Responsive sizing — pending.** Check 375/390 CSS-pixel phones at pixel ratios 2 and 3 and a representative desktop; tune Home/Explore hints and any justified width variants while preserving Events' effective 480 CSS-pixel crop requirement. Complete combined delivery measurements, responsive regressions and final documentation/acceptance review.

Each step has its own measurements and review evidence in this record. The ticket remains open until all three steps and the final acceptance criteria pass; finishing step 1 alone does not establish smaller first-visit downloads.

## Acceptance criteria

- [x] AC1: All three backgrounds use versioned URLs with verified long-lived immutable browser caching; changing image content changes its URL.
- [ ] AC2: Recorded mobile/desktop response sizes are smaller than the corresponding baseline without unacceptable visual loss; unchanged repeat visits demonstrate browser reuse. Cold/warm timings and cache states are reported honestly.
- [ ] AC3: All original source image hashes, layout/headlines, Home/Explore framing and Events face exclusion are preserved at the checked widths and pixel densities.
- [ ] AC4: Keyboard navigation, readable text, image failure recovery and layout stability remain usable; uploaded/private image authorization and cache settings are unchanged.
- [ ] AC5: Relevant tests, lint, type checks, production build and current asset/document links pass; local implementation is distinguished from live deployment verification.

## Validation plan

Map AC1–AC2 to production HTTP headers, generated source sets and actual browser network observations, with controlled cold/warm runs and cache-enabled repeat navigation. Compare image-content replacement in an isolated source copy, not a retained user upload. Map AC3–AC4 to desktop/mobile visual and keyboard checks, source hashes, pixel-density comparisons and an image-failure scenario. Run focused public/Events browser regressions using the projects in `playwright.config.ts`, relevant existing tests, `npm run lint`, `npm run typecheck` and a production build. Account for the unrelated ignored-source check issue under DEV0371 without changing check rules to conceal failures. No database write or test account is needed for static background delivery.

## Implementation record

### Changes and rationale

Step 1 delivered on 2026-10-20. The three routes import the same JPEGs as Next.js static image data. Home/Explore pass that data through required `background` props into the shared hero; Events passes it directly. `MarketplaceHero.image` now requires `StaticImageData`, preventing a plain unversioned string in these callers. Existing component tests receive a small synthetic static-image object rather than executing the framework's file loader.

The old optimized source was `/images/home-battle-ropes.jpg`; UAT now uses `/_next/static/immutable/media/home-battle-ropes.357186m3tq1r6.jpg` inside the optimizer URL. Explore and Events likewise have content hashes. No custom cache-header override, quality setting, responsive hint, CSS, original photograph, account/profile media path or database setting changed. The measured optimized response bodies at 1080 and 1920 pixels are byte-for-byte identical to the old version. Step 1 improves reuse after the first download; it does not make that download smaller.

### Affected files

| File or component                                                                                                                                                           | Change and purpose                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| [Marketplace hero](../../../src/features/public/marketplace-hero.tsx)                                                                                                       | Requires static image data while retaining fill, quality 95, existing sizes, eager loading and high fetch priority.                   |
| [Home route](../../../src/app/page.tsx), [Explore route](../../../src/app/explore/page.tsx), [Events route](../../../src/app/events/page.tsx)                               | Import the original JPEGs at the framework boundary so Next.js generates versioned source URLs.                                       |
| [Home presentation](../../../src/features/public/coach-story.tsx), [Explore presentation](../../../src/features/coaches/coach-discovery.tsx)                                | Forward required imported background data without changing rendering or directory behavior.                                           |
| [Home/Explore component tests](../../../tests/home-marketplace.test.ts)                                                                                                     | Supply static-image data to existing rendering/empty/unavailable checks without adding a global image loader or weakening assertions. |
| [Asset guide](../../../public/images/README.md), [specification section 6](../../../docs/mvp-spec.md#6-application-and-infrastructure-boundaries), [index](../../README.md) | Record the bounded caching contract, actual header differences and staged delivery status.                                            |

`next.config.ts` is unchanged in step 1; quality/width configuration remains for later evidence-based steps.

### Decisions and deviations

2026-10-20: Combine transfer size, responsive sizing and browser caching in one small slice owning the same three backgrounds. The user accepted three sequential steps within this ticket and requested step 1 first. Separating caching from compression/sizing makes each effect reviewable without creating independent tickets for the same shared hero. Do not expand this into public-data caching or privacy-sensitive media work.

2026-10-20 step-1 adjustment: importing JPEGs in the presentation modules compiled correctly, but existing Node component tests cannot execute Next.js' image-file loader (`ERR_UNKNOWN_FILE_EXTENSION`). Move the imports to the framework route boundary and pass static-image data into Home/Explore components; adapt their existing test inputs without adding a global test loader. The first isolated checks also picked up Node 20 from the temporary directory's shell environment; rerun with Node 24.21 explicitly on `PATH`, as required by the repository.

### Contracts, configuration, and operations

Only internal presentation props and public background URLs changed. UAT optimized responses now use `Cache-Control: public,max-age=31536000,immutable` (one year); the local production optimizer returned `public, max-age=315360000, immutable` (ten years). Next.js controls these headers; no TTL override was added. Hash paths differ between the verified webpack local build (`/_next/static/media/`) and Turbopack UAT build (`/_next/static/immutable/media/`), so validation accepts both framework forms.

No schema/migration, dependency, environment-variable, provider, private-media authorization or image-quality/width allowlist change applies. Keep source bytes in `public/images`; do not apply immutable caching to unversioned user media. Revert this step's route imports/props to roll back; older versioned assets may remain cached but are no longer referenced. Operational rollback can select the preceding UAT deployment `dpl_929wUE6CZKSs4yLfbudgkUfQ4Two`.

## Validation results

### Step 1 — 2026-10-20

- Read the installed Next.js 16.3.8 image API documentation (`node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md`), including static imports, cache behavior and `getImageProps`. No image preload/blur placeholder or private-image pipeline change was introduced.
- Healthy UAT baseline: Home, Explore and Events HTML returned 200. Original optimized backgrounds returned `public, max-age=0, must-revalidate`. After deployment, all three pages still returned 200 and all measured optimized variants returned one-year immutable headers. `/api/events` remained 200 / `ready` / `no-store`.
- HTTP probes used the same WebP Accept header, widths and quality before/after. Response-body SHA-256 equality passed for every 1080/1920 pair. Current generated `sizes` and source-set width candidates match the baseline. These measurements intentionally show no compression gain yet.

| Background | 1080 px bytes, before = after | 1920 px bytes, before = after | Observed cold CDN miss total, seconds (1080 / 1920) | Later CDN hit total, seconds (1080 / 1920) |
| ---------- | ----------------------------: | ----------------------------: | --------------------------------------------------- | ------------------------------------------ |
| Home       |                       253,250 |                       803,776 | Not captured (already HIT) / 1.289                  | 0.183 / 2.355                              |
| Explore    |                       192,414 |                       742,172 | 0.823 / 1.675                                       | 0.239 / 0.293                              |
| Events     |                       435,076 |                     1,233,862 | 1.535 / 1.556                                       | 0.304 / 0.170                              |

The original baseline requests were CDN hits. The new Events variants initially returned MISS on both immediate requests; later requests confirmed HIT. The slow Home warm transfer shows network variance, so these isolated timings establish no general first-load speedup. A fresh browser cache avoids that transfer entirely on reuse.

- Native Chrome Incognito QA on UAT, cache enabled (`Disable cache` unchecked), no throttling: Home, Explore and Events ordinary desktop reloads each showed **Served from memory cache**, **0 ms**, **0 B image transfer**, reusing the same URL. At desktop width 1390 with high pixel density, selected 3840 variants were Home/Explore JPEGs and Events WebP; their larger first downloads remain for steps 2–3. iPhone XR 414 × 896 checks loaded all three 1080 variants, preserved readable headlines/framing and showed Events' face-free crop. Events' phone reload also used memory cache.
- Failure/recovery: blocked the exact Events image URL in DevTools Request conditions with cache temporarily disabled. Two image attempts showed `(blocked:devtools)`; the fixed-size pale banner, headline, filter controls and truthful empty results remained usable. Removed all test rules, disabled request blocking, restored cache, and reloaded: the same photograph returned with 200/memory-cache delivery. Keyboard Tab moved from the verified `Training place` input to `Find sessions`; Enter submitted `location=DEV0392-cache-check` and returned the normal empty result. The owned QA window was closed; existing user windows were preserved. No account or database fixture was created.
- Original source SHA-256 values match the asset guide before/after. A second isolated build inserted a valid JPEG comment into copies of all three originals; decoded pixel buffers remained identical while webpack filenames changed: Home `50164305` → `60b4b67d`, Explore `4e613db3` → `7218b7ec`, Events `bf67bce8` → `c701dc49`. The project originals and UAT deployment never received those probe bytes.
- Existing unit/server regressions: `npm test` passed **363 unit + 68 server = 431**, zero failures/skips, under Node 24.21.0. The first attempted run exposed the JPEG-loader issue and an incorrect Node 20 PATH in the temporary directory; the route-boundary adjustment and explicit Node 24 PATH resolved both before the successful run.
- `npm run lint`, `npm run typecheck`, and `NEXT_TELEMETRY_DISABLED=1 npm run build -- --webpack` passed in an isolated Git source snapshot with pending files overlaid and the installed dependencies linked. The snapshot excludes the unrelated ignored `work/`/`tmp/` source copies described by DEV0371. Commands used `PATH=/Users/hoangdeveloper/.local/node/24.21.0/bin:$PATH`; root check configuration was not changed.
- Existing browser regressions: `node_modules/.bin/playwright test tests/browser/public-story.spec.ts tests/browser/explore-unavailable.spec.ts --grep 'home presents the focused|home marketplace remains usable|unavailable Explore retains'` passed **5**, with the existing intentional **1 mobile skip** for the desktop-owned width loop. That loop checked 375, 393, 430, 768, 1024 and 1440 widths; Home flow and Explore unavailable/search/retry passed on both projects. The configuration-free local preview truthfully showed unavailable data; the live UAT checks above used its configured healthy service.
- No new test copies framework hashing logic; actual builds, response hashes/headers, browser cache observations and the existing behavior tests provide the evidence. Database/migration tests are not applicable because no database code or schema changed.
- Planning history: the original ticket/index link consistency checks passed before implementation. Final review passed: Prettier for the changed source/test/asset-guide/ticket files, `git diff --check`, 540 local file/anchor references across the affected documentation, matching In progress/current index placement, and repeated original-image SHA-256 checks. Private HTTP/log artifacts remain ignored under `work/dev0392/`; this record contains the review evidence without requiring them.

| Criterion | Step-1 evidence                                                                             | Overall result                                           |
| --------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| AC1       | Live immutable headers, actual browser reuse, isolated content-replacement build            | Passed                                                   |
| AC2       | Browser reuse verified; original body sizes deliberately unchanged                          | Pending compression/sizing in steps 2–3                  |
| AC3       | Source hashes, response-body equality, unchanged CSS and desktop/phone visual checks        | Step 1 passed; final pixel-density matrix pending step 3 |
| AC4       | Keyboard submission, controlled image failure/recovery, unchanged private-image code/config | Step 1 passed; retain in final review                    |
| AC5       | 431 tests, 5 browser passes/1 existing skip, lint/types/build, live UAT checks              | Step 1 passed; final checks repeat after later changes   |

## Risks, limitations, and follow-ups

Lower quality is not automatically acceptable; smaller files do not alone prove faster loading. High-density devices and Events crop scaling can require larger widths than the visible viewport suggests. Browser eviction and force reload can still cause downloads despite immutable caching. Step 1 is delivered and verified. Next action: step 2's quality comparison when requested; then step 3's viewport/pixel-density tuning and combined review. The ticket stays In progress because AC2 and final combined checks are not complete. On 2026-10-20 the user requested a checkpoint commit before step 2. The checkpoint includes the completed DEV0394 recovery and DEV0393 planning record because the new tickets, specification and index cross-reference them. No merge or push is implied.

## Completion and review references

- Completed: Not completed.
- Commit: Step 1 is included in the checkpoint subject `[DEV0392][DEV0393][DEV0394] Save background caching and UAT recovery`; resolve its exact hash in Git history.
- Review: Step 1 diff reviewed against unchanged quality, sizing, crop, source-byte and privacy constraints; no independent review. Steps 2–3 remain pending.
- Deployment or release: Step 1 is live at [UAT](https://uat.movx.club), deployment `dpl_EYu9vH6HMWHmcvyAojtix5J6RrMi` ([Vercel record](https://vercel.com/hoangworldcoms-projects/movx-club-uat/EYu9vH6HMWHmcvyAojtix5J6RrMi)), READY / Node 24.x, correct project `movx-club-uat` (`prj_CPYcoaAzkLOxWrb6Q9lOaDgtQQPA`). Deployed the verified isolated source snapshot with `vercel --prod --yes --scope hoangworldcoms-projects`; root staging link and real production were untouched. Feature branch remains unmerged; no push occurred.
