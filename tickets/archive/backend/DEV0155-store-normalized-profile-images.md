# Ticket DEV0155: Store normalized profile images

- Status: Completed
- Created: 2026-10-08
- Last updated: 2026-10-08
- Milestone: Scheduling-only account and coach presentation
- Coordination: [COR0012 — Profile images](../organisatory/COR0012-profile-images.md)
- Related records: depends on completed [DEV0154 — Adopt the profile-image contract](../organisatory/DEV0154-adopt-profile-image-contract.md); supplies [DEV0156 — Upload and present profile images](../frontend/DEV0156-upload-and-present-profile-images.md)

## Objective and context

Add the secure storage/data foundation for optional private account avatars and separately public coach portraits. PostgreSQL stores bounded media references, not image bytes. Supabase Storage owns the objects and access policies, while the application verifies the actor and canonical image before attaching a new immutable path.

## Scope and non-goals

- In scope: additive profile/coach media columns and constraints; private account-avatar and public coach-portrait buckets; owner-scoped Storage policies; local Storage startup; server validation/re-encoding with the installed Sharp version; upload, replacement and removal services/routes; projections needed by the frontend; migrations and focused database/service tests.
- Out of scope: upload controls/layout, generated fixture art, arbitrary galleries, video, SVG/GIF/HEIC, social media, production bucket creation through a dashboard, paid Supabase transformation dependency.

## Expected behavior and edge cases

- A verified account may attach/remove only its own private account avatar.
- Only a coach with current upload authority may attach/remove its own public coach portrait; a public portrait does not grant coach authority.
- The server accepts only a bounded canonical WebP payload, verifies actual dimensions/content, re-encodes it, stores a new immutable path and attaches it atomically enough to avoid pointing at a missing object.
- Replacement removes the prior owned object after the new reference succeeds; failed database attachment cleans up the new object where possible.
- Missing Storage or image-processing capability returns a bounded unavailable result without losing the old image reference.

## Assumptions, decisions, and dependencies

- DEV0154 is the product contract and must complete before implementation begins.
- Use the existing cookie-bound Supabase server client so Storage RLS evaluates the signed-in user; do not introduce a browser-visible service key.
- Add Sharp as a direct pinned dependency before importing it even though Next currently carries it transitively.
- Public fixture art may use a repository asset path with an explicit fixture source; uploaded media uses Storage object paths with an explicit storage source.

## Implementation plan

1. Add migrations/schema contracts for optional image source/path metadata and exact checks.
2. Configure/start local Storage, create constrained buckets and add owner/capability policies with SQL tests.
3. Add canonical WebP validation/re-encoding plus owner-authorized upload/remove services and route handlers.
4. Extend actor/coach projections with bounded presentation references and add unit/database/integration tests.
5. Run migrations, database tests, unit tests, typecheck, lint and production build.

The proposed scope is one backend vertical foundation; the interface and local test account remain independent peer tickets.

## Acceptance criteria

- [x] AC1: Private account-avatar and public coach-portrait objects have distinct bucket/access policies and owner-scoped mutations.
- [x] AC2: Only valid 512 × 512 WebP data within the canonical size bound is stored; metadata is stripped and original uploads are not retained.
- [x] AC3: Replacement/removal uses immutable paths and preserves or safely cleans references across failure cases.
- [x] AC4: Actor and coach projections expose only bounded image presentation data without credentials or arbitrary remote URLs.
- [x] AC5: Local Storage starts through the supported development command, and schema/service/build validation passes.

## Validation plan

Add domain/normalization tests, database constraints/RLS tests and authenticated upload ownership tests. Exercise missing service, malformed media, oversized payload, wrong dimensions, cross-account path, non-coach portrait attempt, replacement and removal. Run the relevant full unit/database suites, lint, typecheck and production build.

## Implementation record

Completed the private-account/public-coach media foundation. The browser sends a canonical candidate, the server independently decodes and re-encodes it, Supabase Storage owns the bytes, and PostgreSQL retains only an owner-bound immutable path plus update time. Account avatars are retrieved through an authenticated application route; coach portraits use a dedicated public bucket and bounded URL projection.

### Changes and rationale

- Added 512 × 512 WebP normalization with a 512 KiB canonical limit, metadata stripping and malformed/animated/non-WebP rejection. The 8 MiB source-file allowance remains a browser concern; the server route never accepts that larger source body.
- Added private `account-avatars` and public `coach-portraits` buckets with WebP-only size limits and authenticated owner-folder insert/select/delete policies. The helpers derive ownership from `auth.uid()` and never accept a caller-supplied owner.
- Added compare-and-swap reference functions so concurrent replacement cannot silently overwrite a newer image. Upload writes a fresh UUID path before attachment; failure cleans the new object when possible, and successful replacement deletes only the prior owned Storage object.
- Added authenticated account-avatar GET/POST/DELETE and coach-portrait POST/DELETE handlers with exact-origin mutation checks, bounded response contracts and no-store mutation responses.
- Extended actor and coach projections with presentation URLs only. Private Storage paths do not enter the actor API; public coach paths are validated against the profile before becoming a URL.
- Enabled Storage in the supported Auth stack and pinned Sharp directly. Supabase CLI moved from 2.117.0 to 2.120.0 because the older local Storage API used a pre-versioning conflict query against the schema it had migrated; the newer v1.79.36 Storage runtime passed real uploads.

### Affected files

| File or component                                                                                                                    | Change and purpose                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/20261008000400_add_profile_images.sql`                                                                          | Adds media references, buckets, Storage policies and owner-authorized compare-and-swap functions.                       |
| `supabase/migrations/20261008000500_fix_profile_image_coach_authority.sql`                                                           | Uses the established trust classifier so forced row-level security recognizes approved coaches.                         |
| `supabase/migrations/20261008000600_allow_claimed_demo_fixture_portrait.sql`                                                         | Keeps a fictional fixture portrait valid when a local demo coach is claimed by its reserved Auth account.               |
| `src/profile-images/contracts.ts`, `src/server/profile-images/image-normalization.ts`                                                | Defines size/path/response contracts and performs the independent Sharp re-encode.                                      |
| `src/server/db/profile-images/repository.ts`, `src/server/profile-images/service.ts`                                                 | Owns actor-scoped references, upload ordering, compare-and-swap attachment and best-effort object cleanup.              |
| `src/app/api/profile/avatar/route.ts`, `src/app/api/coach/portrait/route.ts`                                                         | Exposes bounded same-origin mutation routes and the private account-avatar byte route.                                  |
| `src/server/db/schema/foundation.ts`, `src/server/db/schema/coaches.ts`, `src/server/db/authorization/repository.ts`                 | Maps the additive schema and private actor reference.                                                                   |
| `src/server/db/coaches/repository.ts`, `src/server/authorization/service.ts`, `src/auth/actor-contracts.ts`, `src/domain/coaches.ts` | Produces validated private/public presentation URLs without exposing credentials or arbitrary URLs.                     |
| `supabase/config.toml`, `package.json`, `package-lock.json`                                                                          | Starts local Storage, caps the global local upload at 1 MiB, and pins Sharp 0.35.5 plus Supabase CLI 2.120.0.           |
| `tests/profile-images.test.ts`, `tests/server/profile-image-normalization.test.ts`, `tests/database/profile-images.test.ts`          | Covers path/response bounds, re-encoding, metadata removal, compare-and-swap behavior, coach authority and Storage RLS. |

### Decisions and deviations

- Kept account and coach media in separate buckets even when one person has both roles. This makes the private/public boundary explicit rather than relying on UI presentation.
- Chose immutable object names rather than overwriting a stable path, following Supabase cache guidance and making stale-reference conflicts observable.
- The first coach reference function joined the forced-RLS applications table under `app_owner`, which hid the approval row. The failing database test caused the follow-up migration to reuse `app.coach_trust_kind`, the existing security-definer authority contract.
- Fixture authority is based on `is_demo`, not mutable `record_source`, because local coach provisioning legitimately claims a fictional profile without changing the provenance of its checked-in portrait.

### Contracts, configuration, and operations

- New database columns: `app.profiles.avatar_storage_path`, `avatar_updated_at`, and `app.coach_profiles.portrait_source`, `portrait_path`, `portrait_updated_at`.
- New Storage buckets: private `account-avatars` and public `coach-portraits`; both accept only `image/webp` and objects up to 524,288 bytes.
- New application routes: `GET|POST|DELETE /api/profile/avatar` and `POST|DELETE /api/coach/portrait`.
- Actor snapshots add `profile.avatarUrl`; coach projections add `portraitUrl`. Both remain nullable so initials are a supported state.
- New direct dependency: `sharp@0.35.5`. Updated development dependency: `supabase@2.120.0`.
- No new environment variables or secrets. Hosted Supabase must apply the migrations before hosted authenticated uploads are enabled.

## Validation results

Validated on 2026-10-08 with Node.js 24.21.0, local Supabase CLI 2.120.0/Storage API v1.79.36 and the repository PostgreSQL/Auth/Storage stack.

- `npm test` — passed 79 general tests and 2 server normalization tests.
- `npm run test:db` — passed all 34 serialized database integration tests, including three profile-image tests.
- `npm run db:test` — passed all 152 pgTAP checks.
- `npm run db:lint` — passed with no schema errors.
- `npm run typecheck`, `npm run lint`, `npm run format:check` — passed.
- `npm run build` — passed the Next.js 16.3.8 production build; both media routes were emitted as dynamic routes.
- `PROFILE_IMAGE_TEST_SCOPE=account npm run test:profile-images` — passed real private upload/download/removal through local Storage and verified an anonymous request receives 401.
- `PROFILE_IMAGE_TEST_SCOPE=coach npm run test:profile-images` — passed real public coach upload/removal and public-profile rendering.
- `npm audit --omit=dev --json` — zero production vulnerabilities. The install command reported five development-only advisories; no forced audit rewrite was applied.

| Criterion | Evidence                                                                                                    | Result |
| --------- | ----------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Migration policies plus `Storage policies isolate account and coach object namespaces`.                     | Passed |
| AC2       | Sharp normalization tests and both real browser uploads.                                                    | Passed |
| AC3       | Compare-and-swap database tests plus upload/remove rehearsals and cleanup.                                  | Passed |
| AC4       | Contract tests, actor exact-key validation and public coach render tests.                                   | Passed |
| AC5       | Restarted preserved local stack with Storage; database suites, lint, typecheck and production build passed. | Passed |

## Risks, limitations, and follow-ups

Storage/database changes cannot be one physical transaction. The implementation prevents intentional dangling references, but a process or network failure during best-effort deletion can leave an owner-scoped orphan for later lifecycle cleanup. Hosted bucket/policy rehearsal remains release evidence; local success is not a deployment claim.

## Completion and review references

- Completed: 2026-10-08.
- Commit: Not created.
- Review: No independent review created.
- Deployment or release: Not deployed or released.
