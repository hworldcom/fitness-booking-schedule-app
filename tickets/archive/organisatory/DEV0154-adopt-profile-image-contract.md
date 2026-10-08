# Ticket DEV0154: Adopt the profile-image contract

- Status: Completed
- Created: 2026-10-08
- Last updated: 2026-10-08
- Milestone: Scheduling-only account and coach presentation
- Coordination: [COR0012 — Profile images](COR0012-profile-images.md)
- Related records: [DEV0155 — Store normalized profile images](../backend/DEV0155-store-normalized-profile-images.md), [DEV0156 — Upload and present profile images](../frontend/DEV0156-upload-and-present-profile-images.md), [DEV0157 — Provision the persistent local test user](../backend/DEV0157-provision-persistent-local-test-user.md)

## Objective and context

The current product has initials and palette colors only. Define the product and operational contract for optional account avatars and public coach portraits before storage or interface work begins. Keep the private account surface distinct from public coach discovery, answer the user's compression question concretely and record that only Daniel Park receives a generated fixture portrait.

## Scope and non-goals

- In scope: update the MVP specification with image ownership, visibility, optional fallback, accepted inputs, normalization, replacement and deletion behavior; document why binaries do not belong in PostgreSQL or the Vercel filesystem; define the local persistent test-account boundary.
- Out of scope: migrations, Storage buckets, upload code, UI, generated assets, hosted provisioning and deployment.

## Expected behavior and edge cases

- Account avatars are private account presentation and are not exposed on public discovery merely because an account exists.
- Coach portraits are separately managed public profile media and appear only for public approved/demo coaches; initials remain valid when absent.
- Browser-selected JPEG, PNG or WebP input is normalized to one 512 × 512 WebP, metadata is removed and the original is not retained.
- Replacement uses a new immutable object path before the previous object is removed, avoiding stale content-delivery-network objects.
- The fictional Daniel Park portrait is the only generated seeded example. The other existing coaches intentionally exercise the initials fallback.

## Assumptions, decisions, and dependencies

- Adopted user correction, 2026-10-08: do not add a picture for every coach.
- Account privacy is safer than placing ordinary-user pictures in a public bucket. Public coach portrait upload is an explicit coach-profile action.
- Normalize once at upload rather than depend on paid runtime image transformations. Serve small canonical assets through storage/CDN delivery.
- Proposed bounds: source selection no larger than 8 MiB; client produces a WebP no larger than 512 KiB; server validates and re-encodes to 512 × 512 WebP at quality 82 with metadata stripped.
- Official Supabase guidance supports Storage RLS, small standard uploads and immutable replacement paths; current Supabase runtime transformations require Pro or above. Current Vercel functions cap request bodies at 4.5 MB, so the browser must send the already-normalized sub-megabyte image.

## Implementation plan

1. Update the confirmed decision register, actor descriptions, identity/data rules, definition of done and acceptance matrix.
2. Add a concise storage/compression section with privacy, formats, limits, immutable keys, metadata stripping and fallback behavior.
3. Check specification/ticket links and consistency; do not change runtime files under this ticket.

The proposed scope is one documentation contract and does not require further splitting. Runtime work is owned by the peer tickets under COR0012.

## Acceptance criteria

- [x] AC1: The specification distinguishes private account avatars from public coach portraits and keeps both optional with initials fallback.
- [x] AC2: The specification records one-time 512 × 512 WebP normalization, metadata removal, bounded file sizes and immutable replacements.
- [x] AC3: The specification records Daniel Park as the only generated fixture portrait and `hoang@users.movx.test` as local test data rather than a production account.
- [x] AC4: Documentation does not claim buckets, uploads, generated assets or hosted deployment already exist.

## Validation plan

Run Prettier and relative-link checks on the specification and records. Review the diff against the user's request and current privacy/identity contract. Application tests are not applicable because this ticket changes documentation only.

## Implementation record

The product contract now separates optional private account avatars from separately optional public coach portraits. It defines one canonical upload result, immutable replacements, initials fallback and the bounded fictional/local fixtures before storage or interface implementation begins.

### Changes and rationale

- Added confirmed decision C15 and updated client/coach authority descriptions so media presentation cannot be confused with coach capability or public visibility.
- Added a profile-image state contract: Supabase Storage owns bytes, PostgreSQL stores bounded references, browser preprocessing reduces transfer cost and the server remains authoritative for validation/re-encoding.
- Fixed the first-release media envelope at JPEG/PNG/WebP source, 8 MiB local source selection, canonical 512 × 512 WebP at quality 82 and no more than 512 KiB, with metadata removal and no retained original.
- Recorded immutable replacement paths to avoid stale content-delivery-network objects, plus removal/failure behavior that restores or preserves initials.
- Limited generated fixture imagery to Daniel Park and recorded `hoang@users.movx.test` as a local passwordless ordinary-user fixture rather than hosted product data.

### Affected files

| File or component                                       | Change and purpose                                                                                |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [`docs/mvp-spec.md`](../../../docs/mvp-spec.md)         | Defines image privacy, ownership, normalization, permissions, completion and acceptance behavior. |
| [`tickets/README.md`](../../README.md)                  | Tracks the coordination record and four direct development tickets.                               |
| [`COR0012 — Profile images`](COR0012-profile-images.md) | Maps the contract, backend, frontend and local-test-account delivery boundaries.                  |

### Decisions and deviations

- The user clarified before implementation that pictures are not required for every coach. Daniel Park is the sole generated fixture portrait; all other coaches exercise the supported initials fallback.
- Private account avatar and public coach portrait are intentionally separate. Reusing a private avatar publicly would weaken the established client/coach boundary and surprise ordinary users.
- One-time normalization avoids dependence on Supabase's paid runtime image transformations. [Supabase Storage](https://supabase.com/docs/guides/storage) remains the object store and [Storage RLS](https://supabase.com/docs/guides/storage/security/access-control) provides the policy boundary.
- Browser preprocessing is required before the Vercel function because [Vercel documents a 4.5 MB function request limit](https://vercel.com/docs/functions/limitations). The server still decodes and re-encodes the small canonical payload because browser metadata is untrusted.

### Contracts, configuration, and operations

This ticket changes the product/documentation contract only. It adds no schema, bucket, dependency, environment variable, generated asset, runtime route or deployed resource. DEV0155 owns storage/runtime implementation, DEV0156 owns interface/assets and DEV0157 owns the local account fixture.

## Validation results

- Date and environment: 2026-10-08, repository documentation on macOS with Node.js 24.21.0.
- `/Users/hoangdeveloper/.nvm/nvm-exec npx prettier --write docs/mvp-spec.md tickets/README.md ...`: completed; all seven new/affected records were formatted.
- Custom relative-link checker over the specification, index, coordination record and four DEV records: checked seven Markdown files; every relative target exists.
- `git diff --check`: passed.
- Manual diff review confirmed the specification describes target behavior and does not claim Storage buckets, uploads, generated repository assets or deployment already exist.
- Application/unit/database/browser tests were not run because this ticket makes documentation-only product-contract changes. Runtime validation belongs to DEV0155-DEV0157.

| Criterion | Evidence                                                                                                                    | Result |
| --------- | --------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Confirmed decision C15 plus Client, Coach, profile-image and permission sections distinguish private/public optional media. | Passed |
| AC2       | Profile-image and security sections define formats, bounds, normalization, metadata removal and immutable replacement.      | Passed |
| AC3       | Identity/data integrity records Daniel as the sole generated image and Hoang as local-only ordinary test data.              | Passed |
| AC4       | Status language and implementation boundaries leave storage, UI, assets and local provisioning to peer tickets.             | Passed |

## Risks, limitations, and follow-ups

Provider pricing and transformation availability may change, but the canonical upload format avoids a runtime transformation dependency. DEV0155 and DEV0156 must not weaken the private/public split.

## Completion and review references

- Completed: 2026-10-08 — adopted the optional private/public profile-image and normalization contract.
- Commit: Not created.
- Review: Self-reviewed against the acceptance criteria; no independent review created.
- Deployment or release: Not applicable — documentation contract only.
