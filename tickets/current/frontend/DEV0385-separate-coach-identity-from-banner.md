# Ticket DEV0385: Separate coach identity from banner

- Status: In progress
- Created: 2026-10-20
- Last updated: 2026-10-20
- Milestone: UAT coach website readability
- Coordination: None — independent development ticket
- Related records: [DEV0317](../../archive/frontend/DEV0317-build-shareable-personal-coach-websites.md) (public page); [DEV0315](../../archive/frontend/DEV0315-edit-and-preview-coach-websites.md) (owner preview); [DEV0384](../../archive/frontend/DEV0384-identify-coach-website-validation-errors.md) (current UAT baseline)

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

- [ ] AC1: Banner pixels do not paint behind the portrait/name/brand or contact text; identity uses an opaque surface below the image in preview/public desktop and mobile layouts.
- [ ] AC2: Long identity text and missing-banner fallback remain readable without horizontal overflow; preview/contact navigation remains keyboard usable and private.
- [ ] AC3: Relevant existing tests, formatting, clean lint/build and actual native desktop/mobile visual evidence pass; no user image/content is changed for testing.
- [ ] AC4: Exact READY UAT source/Preview/fra1/alias and unchanged environment/staging/saved-data evidence are recorded; unrelated edits preserved.

## Validation plan

Run existing public-website and website-editor/domain tests. Check source formatting/diff and clean-source lint; production build covers CSS integration and TypeScript without unrelated ignored scratch files. Native Chrome desktop and 375×568 phone: actual owner website preview with uploaded banner, close/open by keyboard; synthetic public component with high-contrast and absent banner plus long name/brand. Static fixture HTML is generated only under ignored work and served on an owned loopback port; never fake public approval. Read-only UAT fingerprint before/after for application/content/media rows and website revision. No migration/database mutation tests are needed for CSS-only behavior.

## Implementation record

Implemented locally; native visual proof and UAT release are in progress.

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
- Read-only UAT baseline captured; native public synthetic/owner real-banner desktop/phone checks, hosted release and final preservation evidence remain in progress.

| Criterion | Evidence | Result  |
| --------- | -------- | ------- |
| AC1       | Pending  | Not run |
| AC2       | Pending  | Not run |
| AC3       | Pending  | Not run |
| AC4       | Pending  | Not run |

## Risks, limitations, and follow-ups

Keep image containment and mobile overrides consistent; preserve the original draft tabs and never publish the pending owner's profile to test the public layout.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: Self-review pending; no independent review requested.
- Deployment or release: Pending.
