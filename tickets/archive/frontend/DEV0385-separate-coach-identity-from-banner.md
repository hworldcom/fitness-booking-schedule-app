# Ticket DEV0385: Separate coach identity from banner

- Status: Completed
- Created: 2026-10-20
- Last updated: 2026-10-20
- Milestone: UAT coach website readability
- Coordination: None — independent development ticket
- Related records: [DEV0317](../frontend/DEV0317-build-shareable-personal-coach-websites.md) (public page); [DEV0315](../frontend/DEV0315-edit-and-preview-coach-websites.md) (owner preview); [DEV0384](../frontend/DEV0384-identify-coach-website-validation-errors.md) (current UAT baseline)

## Objective and context

An uploaded banner makes the owner's name and brand label barely readable. Keep coach identity below the banner on an opaque surface in the public website and private preview. Follow [website content/template](../../../docs/mvp-spec.md#192-public-content-and-template), [definition of done](../../../docs/mvp-spec.md#11-definition-of-done) and the owner/public website acceptance scenarios.

## Scope and non-goals

- In scope: Banner clipping/sizing; non-overlapping portrait/name/brand/introduction layout and contact-card alignment in owner preview; public identity layout on desktop/mobile; specification, visual validation and exact-source UAT release.
- Out of scope: Changing uploaded images, content, portrait sharing, publication/approval, account data, banners' storage/authorization, directory cards or other website sections.

## Expected behavior and edge cases

The banner stays within its allotted region. Identity text and portrait occupy their own opaque area below it with consistent spacing. Long names and brand labels wrap. No-banner/unavailable-banner fallback remains usable; contact actions and keyboard access remain intact. Pending owner's preview remains private. Do not save test content or publish a real profile for QA.

## Assumptions, decisions, and dependencies

Use focused stylesheet changes, retaining existing semantic components and image-failure handling. Remove negative identity/contact offsets rather than relying on a photograph-dependent text overlay. Validate the actual owner's uploaded banner in private UAT preview and a read-only local static render of the real public component with synthetic bright/dark and missing-banner variants. No database fixtures or retained-account edits. Existing commit/UAT authorization continues.

## Implementation plan

1. Constrain the preview banner/image and place preview identity/contact content below it; update desktop and phone rules.
2. Place public identity on an opaque block below the banner; remove the offset/padding compensation while retaining responsive portrait and text sizing. Update the current specification.
3. Run existing website tests, scoped formatting and clean-source lint/build checks. No new CSS-mirroring tests; visual checks prove this layout change. Use isolated static fixture renders for public desktop/mobile/long/missing-banner checks and native UAT owner preview/keyboard checks.
4. Release exact committed source to dedicated UAT Preview/fra1, preserving environment/staging linkage and saved website/media/account data. Record evidence, review criteria and complete/archive.

## Acceptance criteria

- [x] AC1: Banner pixels do not paint behind the portrait/name/brand or contact text; identity uses an opaque surface below the image in preview/public desktop and mobile layouts.
- [x] AC2: Long identity text and missing-banner fallback remain readable without horizontal overflow; preview/contact navigation remains keyboard usable and private.
- [x] AC3: Relevant existing tests, formatting, clean lint/build and actual native desktop/mobile visual evidence pass; no user image/content is changed for testing.
- [x] AC4: Exact READY UAT source/Preview/fra1/alias and unchanged environment/staging/saved-data evidence are recorded; unrelated edits preserved.

## Validation plan

Run existing public-website and website-editor/domain tests. Check source formatting/diff and clean-source lint; production build covers CSS integration and TypeScript without unrelated ignored scratch files. Native Chrome desktop and 375×568 phone: actual owner website preview with uploaded banner, close/open by keyboard; synthetic public component with high-contrast and absent banner plus long name/brand. Static fixture HTML is generated only under ignored work and served on an owned loopback port; never fake public approval. Read-only UAT fingerprint before/after for application/content/media rows and website revision. No migration/database mutation tests are needed for CSS-only behavior.

## Implementation record

Implemented, released to UAT and verified with native desktop/phone visual evidence.

### Changes and rationale

Preview banners now clip their image inside bounded zero-minimum grid tracks. The content region starts 24px below the banner on an opaque background; identity and contact cards use zero negative offsets at every breakpoint. Public identity is a separate white bordered block below the image, with no compensating 60px name offset. Mobile overrides retain the same separation and readable portrait/name spacing. Image sources, semantic components and existing failure/permission behavior are unchanged.

### Affected files

- [Owner preview styles](../../../src/features/coaches/website/coach-website-editor.css): constrain banner/image grid sizing and overflow; space identity/contact content below the image; retain phone padding and remove its negative margin override.
- [Public website styles](../../../src/features/coaches/website/public-coach-website.css): opaque identity block with positive spacing below the banner, aligned desktop name and consistent phone layout.
- [Specification](../../../docs/mvp-spec.md#192-public-content-and-template), ticket and index: record the explicit identity/banner separation and validation evidence.

### Decisions and deviations

2026-10-20: Keep the whole identity block below the image, including the portrait, so no text depends on banner colors. Constrain the preview image grid as well as removing offsets; image overflow could otherwise continue painting behind later content.

### Contracts, configuration, and operations

No API, schema, image bytes, dependencies or environment changes. Rollback uses a prior compatible UAT runtime without data migration.

## Validation results

- `npx tsx --test tests/public-coach-website.test.ts tests/coach-website.test.ts tests/coach-website-editor.test.ts tests/coach-website-errors.test.ts`: 26 passed. Existing public content/fallback, owner validation and revision/recovery behavior remain intact.
- `npm run lint`: passed in an exact tracked-source export with only the two owned stylesheet overlays, excluding unrelated working files and ignored scratch code.
- `npm run prebuild` then `npx next build --webpack`: production build including TypeScript passed in the clean export. No TypeScript source or runtime logic changed; no additional unit tests were added to mirror CSS.
- Native Chrome 1390×775 and 375×568 responsive emulation: real public component rendered with compiled production CSS in isolated static loopback fixtures. A split white/black/pink/yellow banner stays above the separate white identity block. An 80-character unbroken name and brand label wrap within the identity card on desktop and phone; absent-banner fallback remains separate/readable at both widths. Fixtures contain synthetic data only, perform no database writes and do not test live booking/map/review hydration. Evidence: ignored `work/dev0385/public-desktop.png`, `public-long-desktop.png`, `public-long-mobile.png`, `public-no-banner-desktop.png` and `public-no-banner-mobile.png`.
- Exact UAT native owner preview: existing uploaded training photo is clipped above the shared portrait, HOANG'S COACHING brand, Hoang name and introduction, all on the opaque region below it. Contact preview is aligned below the image, and phone controls/content fit within the modal. Escape returns focus to Preview website and Return reopens it. Saved-content/private-draft status remains visible. Evidence: ignored `owner-preview-desktop.png` and `owner-preview-mobile.png`. No upload/removal, content save, approval or visibility action was performed.
- Reset emulation scaling by reloading only the disposable QA route before the phone preview, avoiding Chrome's persisted pan/zoom offset. Original draft tabs were untouched. Closed the preview and DevTools, closed only the disposable QA tab and stopped the owned loopback fixture server via its cleanup command. No existing app process or database was stopped/reset.
- Scoped `npx prettier --check` and source/staged `git diff --check` passed. Ticket links, lifecycle/index placement and original README/spec/index/browser-test edits were checked at completion.
- Exact committed source `137a5b9f1c15bf9992ce6555cf2808cd8d85581a` was exported using `git archive` outside the checkout and linked explicitly to the dedicated UAT project. Vercel CLI 64.3.1 `deploy --target preview --regions fra1 --yes --no-wait --meta releaseCommit=... --meta releaseTicket=DEV0385`, then `inspect --logs --wait`, passed the hosted Next 16.3.8 production build. API verified READY, Preview target, Frankfurt and exact source for `dpl_HqxywNr1UL2UboKsMo9uU6GC6fBp` (`movx-club-h8qrevgy5-hoangworldcoms-projects.vercel.app`) before aliasing `uat.movx.club`.
- `node work/dev0385/vercel-state.mjs before/after`: final alias points to that deployment; all five environment metadata entries' IDs, keys, types, targets and update times are unchanged. Root `.vercel/project.json` still points to staging and is byte-identical. No environment values/credentials were logged; no Git push or production release.
- Explicit hosted-dev target `mdzidiqosxbghmfyxphb`, read-only `supabase db query --project-ref ... --linked --file work/dev0385/preservation.sql --output json` before/after, plus `node work/dev0385/verify-preservation.mjs`: all 57 complete app/Auth-user/Storage-bucket/object table fingerprints match; exact website revision 2 and migration `20261019000200` remain unchanged. Existing account/avatar/shared portrait/banner bytes metadata, application state, locations and other accounts were preserved. No migration/data mutation test was needed for stylesheet-only changes.

| Criterion | Evidence                                                                                               | Result |
| --------- | ------------------------------------------------------------------------------------------------------ | ------ |
| AC1       | Actual owner banner/identity/contact on desktop/phone; real public component with high-contrast banner | Passed |
| AC2       | 80-character unbroken name/brand, no-banner desktop/phone, private preview and Escape/Return           | Passed |
| AC3       | 26 website tests, clean lint, local/hosted production builds, scoped formatting, native visuals        | Passed |
| AC4       | Exact READY Preview/fra1/alias, unchanged five env entries/staging and all 57 data hashes              | Passed |

## Risks, limitations, and follow-ups

No outstanding acceptance work. Mobile evidence uses responsive Chrome emulation; no physical-device test or independent review was performed. Public visual proof uses the actual component and compiled styles with synthetic static fixtures because the requesting owner remains pending/hidden; no live public publication is claimed. Existing runtime image-failure handlers and authorization are unchanged. Rollback can re-alias the prior compatible `31e4b79` runtime without changing data.

## Completion and review references

- Completed: 2026-10-20; acceptance, preservation and release checks passed.
- Commit: `137a5b9` source; final validation documentation commit uses DEV0385.
- Review: Self-reviewed stylesheet scope, mobile overrides, opaque surfaces, actual/synthetic visual evidence and release/preservation metadata; no independent review requested.
- Deployment or release: `https://uat.movx.club`, READY Preview/fra1 `dpl_HqxywNr1UL2UboKsMo9uU6GC6fBp`, exact source `137a5b9f1c15bf9992ce6555cf2808cd8d85581a`.
