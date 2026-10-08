# Ticket DEV0156: Upload and present profile images

- Status: Completed
- Created: 2026-10-08
- Last updated: 2026-10-08
- Milestone: Scheduling-only account and coach presentation
- Coordination: [COR0012 — Profile images](../organisatory/COR0012-profile-images.md)
- Related records: depends on completed [DEV0154 — Adopt the profile-image contract](../organisatory/DEV0154-adopt-profile-image-contract.md) and [DEV0155 — Store normalized profile images](../backend/DEV0155-store-normalized-profile-images.md); uses [DEV0157 — Provision the persistent local test user](../backend/DEV0157-provision-persistent-local-test-user.md) for manual account-avatar validation

## Objective and context

Allow ordinary users to upload/remove a private account avatar and approved coaches to separately upload/remove a public coach portrait. Render available images across their intended surfaces while preserving the existing initials fallback. Add one generated fictional portrait for Daniel Park; do not generate or require portraits for the other coaches.

## Scope and non-goals

- In scope: accessible file controls and preview/error states; browser-side orientation/crop/resize/WebP encoding before upload; account avatar rendering in header/Profile; coach portrait rendering in discovery/public coach/editor; responsive image sizing; removal/replacement; Daniel Park fixture asset; focused unit/browser tests.
- Out of scope: mandatory images, a gallery, filters/retouching, camera capture, social feeds, pictures for every coach, account-avatar public exposure, or implementation of storage contracts owned by DEV0155.

## Expected behavior and edge cases

- Missing image always renders initials with the existing color treatment.
- Account Profile clearly describes its avatar as private account presentation; Coach Profile clearly describes its portrait as public when the coach is visible.
- The browser rejects unsupported/oversized sources, corrects orientation, center-crops to square, downsizes to 512 × 512 and encodes WebP before sending a sub-megabyte payload.
- Upload/replacement/removal has progress, success and bounded failure feedback; a failed change leaves the prior image visible.
- Daniel Park uses the generated fixture portrait. Sam Lee, Nora Klein, Idris Malik and Elif Demir continue to exercise the initials fallback.

## Assumptions, decisions, and dependencies

- The generated Daniel portrait is an entirely fictional person and must not imply a real verified professional.
- Use the shared Avatar component with explicit image/fallback variants rather than duplicate rendering per surface.
- Client processing improves bandwidth and avoids Vercel's request limit; DEV0155 still treats browser output as untrusted and revalidates it.

## Implementation plan

1. Move the selected generated Daniel portrait into a versioned project asset and normalize it to the adopted size/format.
2. Add reusable client image normalization and upload controls for account and coach contexts.
3. Extend Avatar and coach/profile surfaces with correct privacy copy, sizes, loading and fallback behavior.
4. Add focused tests and desktop/mobile keyboard/browser rehearsals for upload, replacement, removal and initials fallback.

The proposed scope is one frontend vertical slice supplied by DEV0155; no additional implementation split is required.

## Acceptance criteria

- [x] AC1: A signed-in ordinary user can upload, replace and remove a private account avatar with accessible feedback and unchanged fallback on failure.
- [x] AC2: An authorized coach can separately upload, replace and remove a public portrait with explicit public-use copy.
- [x] AC3: Daniel Park shows the single generated fixture portrait; the other four visible demo coaches render initials without broken-image UI.
- [x] AC4: Browser processing outputs a 512 × 512 WebP within the agreed bound and rejects unsupported/oversized input.
- [x] AC5: Header, Profile, Explore and public coach pages render correctly at desktop/mobile widths with keyboard access, useful alt text where appropriate and no layout overflow.

## Validation plan

Add pure browser-normalization tests where practical and component/contract tests for image/fallback selection. Use the persistent Hoang account for real private-avatar upload/replacement/removal and Daniel for public portrait/fallback comparison. Run focused/full tests, lint, typecheck, build and responsive browser checks.

## Implementation record

Delivered optional profile-image controls and presentation while retaining initials as the first-class fallback. Account avatar controls live on the account Profile and explicitly describe the image as private. Approved/demo coaches receive a separate public portrait control in the coach-profile editor. Only Daniel Park has checked-in generated art; the other four discoverable demo coaches continue to exercise the no-image state.

### Changes and rationale

- Added browser validation for JPEG/PNG/WebP sources up to 8 MiB, orientation-aware decode, centered square crop, 512 × 512 canvas resize and WebP quality 82 encoding before upload. The browser also enforces the 512 KiB canonical bound before making the request.
- Added a reusable uploader with keyboard-focusable native file input, progress/success/error live regions, replace/remove actions, unchanged prior image on failure and distinct private/public explanatory copy.
- Extended the shared Avatar to render a supplied image with object-fit cropping, meaningful alt text on profile surfaces, decorative treatment inside already-labelled links/cards and an initials fallback if the URL is absent or fails.
- Wired private avatars into the account Profile, sidebar and header. Wired public portraits into Explore cards, the public coach page and the coach editor.
- Generated one entirely fictional Daniel Park portrait, retained the original image-generation output, and normalized the selected project asset to a 27,726-byte 512 × 512 WebP. No art was generated for Sam Lee, Nora Klein, Idris Malik or Elif Demir.

### Affected files

| File or component                                                                                        | Change and purpose                                                                                  |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `src/profile-images/browser-normalization.ts`                                                            | Validates, decodes, orientation-corrects, center-crops and compresses the browser upload.           |
| `src/features/profile/profile-image-uploader.tsx`                                                        | Reusable accessible account/coach chooser, replacement, removal and feedback UI.                    |
| `src/components/ui.tsx`, `src/components/shell.tsx`                                                      | Adds resilient shared image/fallback rendering in account navigation surfaces.                      |
| `src/features/profile/profile.tsx`                                                                       | Presents the private account-avatar control and current image.                                      |
| `src/features/coaches/coach-profile-editor.tsx`                                                          | Presents the separate public coach-portrait control only to coaches with upload authority.          |
| `src/features/coaches/coach-discovery.tsx`, `coach-explore-results.tsx`                                  | Renders public portrait/fallback state in directory and public profile surfaces.                    |
| `src/app/globals.css`                                                                                    | Adds responsive uploader, avatar image, focus, status and progress styles.                          |
| `public/images/coaches/daniel-park.webp`, `supabase/seed.sql`                                            | Adds and references the sole generated fictional coach portrait.                                    |
| `scripts/rehearse-local-profile-images.mjs`, `tests/profile-images.test.ts`, `tests/coach-trust.test.ts` | Covers real uploads/removals, privacy, mobile overflow, source bounds and image/fallback rendering. |

### Decisions and deviations

- Used one shared visual component but did not merge the account and coach mutations: their routes, buckets, copy and visibility remain separate.
- Used a regular image element inside Avatar rather than the Next.js optimizer for private account bytes. The installed Next.js guide notes that the optimizer does not forward authentication headers; the same rendering path also handles local fixture and public Storage URLs consistently.
- The generated art is deliberately limited to Daniel Park per the user's correction. Missing coach portraits are not treated as incomplete data.
- The image-generation source remains outside the repository at `/Users/hoangdeveloper/.codex/generated_images/01a116c8-89e7-7e62-8106-2bcada4ded41/exec-0aa87d52-7b0c-4b62-a7d5-6475825ff426.png`; only the normalized WebP ships with the app.

### Contracts, configuration, and operations

- Browser source contract: JPEG, PNG or WebP; non-empty and at most 8 MiB.
- Canonical browser output: 512 × 512 WebP, quality 82, at most 512 KiB. The server repeats validation/re-encoding under DEV0155.
- No new environment variables. Uploader endpoints are the DEV0155 account-avatar and coach-portrait routes.
- Image generation used the built-in image-generation mode with a square, photorealistic fictional boxing-coach portrait prompt: “Create a square editorial head-and-shoulders portrait of Daniel Park, an entirely fictional Korean male boxing coach in his early 30s, athletic build, calm approachable expression, short dark hair, wearing a simple dark training top in a modern Berlin boxing gym. Natural window light, subtle warm neutral palette, realistic skin texture, uncluttered softly blurred background, centered composition suitable for a circular profile crop. No logos, text, celebrity resemblance, violence or real-person identity.”

## Validation results

Validated on 2026-10-08 in Chrome against the local Next.js/Auth/PostgreSQL/Storage stack, plus repository unit/build checks.

- `PROFILE_IMAGE_TEST_SCOPE=account npm run test:profile-images` — passed real Hoang upload, authenticated byte serving, anonymous 401, keyboard focus, mobile no-overflow, provisioner preservation and removal back to initials.
- `PROFILE_IMAGE_TEST_SCOPE=coach npm run test:profile-images` — passed Daniel fixture replacement with Storage, public-profile rendering and removal; cleanup reseeded the fixture afterward.
- Direct `/explore` HTML check showed Daniel's WebP and the `SL`, `NK`, `IM`, and `ED` fallback initials with no broken image requests.
- `npm test` — passed 79 general tests plus 2 server normalization tests, including source validation and portrait/fallback rendering.
- `npm run typecheck`, `npm run lint`, `npm run format:check` — passed.
- `npm run build` — passed with the profile and coach surfaces included.

| Criterion | Evidence                                                                                                    | Result |
| --------- | ----------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Account-scoped browser rehearsal covered upload, authenticated retrieval, replacement state and removal.    | Passed |
| AC2       | Coach-scoped browser rehearsal covered separate public upload, public rendering and removal.                | Passed |
| AC3       | Seed/HTML/component checks show Daniel image and four initials fallbacks.                                   | Passed |
| AC4       | Source-contract and server-normalization tests plus real 512 × 512 WebP uploads.                            | Passed |
| AC5       | Mobile account and desktop coach rehearsals, focus assertion, alt/fallback tests and no-overflow assertion. | Passed |

## Risks, limitations, and follow-ups

Animated images, HEIC/high-efficiency phone formats, manual crop positioning and galleries remain outside this slice. Browser decode support can still vary; failures are bounded and leave the working image unchanged.

## Completion and review references

- Completed: 2026-10-08.
- Commit: Not created.
- Review: No independent review created.
- Deployment or release: Not deployed or released.
