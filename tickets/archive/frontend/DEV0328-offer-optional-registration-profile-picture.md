# Ticket DEV0328: Offer optional registration profile picture

- Status: Completed
- Created: 2026-10-17
- Last updated: 2026-10-17
- Milestone: Authentication quality before UAT
- Coordination: [COR0027 — Login, registration and social authentication](../../current/organisatory/COR0027-login-registration-and-social-authentication.md)
- Related records: [DEV0325](../../archive/backend/DEV0325-collect-registration-names-and-unique-username.md), [DEV0324](../../archive/frontend/DEV0324-default-authentication-return-to-home.md), [DEV0288](DEV0288-redesign-multi-method-login-and-registration.md); independent account operation [DEV0329](../../archive/backend/DEV0329-remove-requested-registration-account-again.md).

## Objective and context

The user requested a profile-picture invitation during registration with an explicit option to do it later. Extend [registration continuation](../../../docs/mvp-spec.md#413-routes-profile-completion-and-returns) after the required username/full-name/display-name save, reusing private account-avatar upload and compression.

## Scope and non-goals

Optional post-details picture view, shared normalized upload/replace/remove, clear Do this later/Continue, truthful privacy/size guidance, responsive/keyboard/error checks, reliable successful Auth navigation and current contract/rehearsal updates. No new storage provider, public coach media, coach approval, schema, SMTP/provider/hosted rollout or unrelated navigation redesign. Exact account removal is independent DEV0329.

## Expected behavior and edge cases

New confirmed users save the three required fields, then may upload a private account picture or choose Do this later without a file. Existing JPEG/PNG/WebP limits and 512-square WebP normalization apply. Failed/invalid uploads retain continuation and initials; explicit continuation waits only during active file work. Athlete completion keeps Home/explicit return; coach intent proceeds to the separate explicit application action. Refresh/lost optional state cannot block an already-created account; personal Profile supports adding/editing the picture later. Returning sign-in does not force a photo. Private avatars remain separate from public coach portraits.

## Assumptions, decisions, and dependencies

Confirmed: invite upload and allow deferral. Adopt a separate optional view after required details commit because upload needs an authorized profile. Reuse the existing component, private bucket, normalization and owner guards. Keep transient presentation state inside `/complete-profile`; no persisted required-photo flag. Existing identities/data remain intact. IDs DEV0328/DEV0329 were allocated after concurrent navigation work took DEV0327; no existing record was renumbered.

## Implementation plan

1. Show the shared uploader after successful new profile save. Add only an optional busy callback so explicit continuation cannot race an active upload/remove.
2. Keep Skip independent of upload success; preserve return/coach continuation and keyboard heading focus. Add scoped Auth-card layout if needed. After intermittent old-route results in actual signup/Skip checks, replace the existing competing router.replace + immediate router.refresh pair with one document replacement for successful Auth transitions, preserving replace-history behavior and fresh server session rendering.
3. Update spec/coordination and actual local Auth rehearsal for skip, invalid-file recovery, real upload/private bytes, mobile/desktop keyboard and cleanup. Run meaningful automated/image/authorization checks, lint/types/format/build and document checks.

## Acceptance criteria

- [x] AC1: New signup offers an optional private picture; Do this later works without a file and later Profile editing remains available.
- [x] AC2: Normalized upload/remove/error/initials work; continuation waits only during active work and works after failure.
- [x] AC3: Home/explicit return/coach intent, existing-user/image authority and mobile/desktop keyboard/overflow behavior remain correct.
- [x] AC4: Durable implementation, validation, contract/index/coordination and exact fixture cleanup are complete; relevant static/build/document checks pass.

## Validation plan

Extend guarded local Auth/Mailpit rehearsal for skip, invalid-file recovery, real image upload/canonical private bytes and continuation. Reuse existing image/authority tests; run npm test, scoped browser checks, lint/types/format/build and links. No schema change, so no migration check; no real-user image or hosted operation.

## Implementation record

### Changes and rationale

Successful three-field registration now opens an optional private-picture view instead of navigating immediately. Successful Auth redirects now use one document replacement rather than a client route replacement immediately competing with refresh; this preserves replacement history and renders the destination with current cookies/session state. Users can choose a file, Continue or Do this later. The shared avatar component keeps its existing browser/server normalization, private endpoint, upload/replace/remove behavior and initials fallback. One optional busy callback keeps the explicit continue/skip and sign-out controls disabled only during active work; errors release them. The new heading receives keyboard focus, and a scoped single-column layout fits the existing Auth card at desktop/phone widths.

Athlete skip/continue preserves Home or the sanitized return destination. Coach intent first leaves the picture view, then shows the existing explicit Apply to coach action; adding a photo never submits an application. The optional view uses transient state, so refresh does not create a mandatory completion flag. Returning sign-in continues to skip completed onboarding, and personal Profile remains the later photo editor.

### Affected files

- [Auth screen](../../../src/features/auth/sign-in.tsx): optional state/view, heading focus, shared uploader, busy-aware continuation and existing athlete/coach branch.
- [Shared uploader](../../../src/features/profile/profile-image-uploader.tsx): optional `onBusyChange` callback, released on upload/remove success and failure; existing consumers remain compatible.
- [Auth styles](../../../src/app/authentication.css): bounded single-column image controls inside the Auth card without changing normal Profile/coach layouts.
- [Real Auth rehearsal](../../../scripts/rehearse-local-email-auth.mjs): mobile no-file skip, invalid-file recovery, delayed real upload/button guards, canonical/private bytes, removal/re-upload, later Profile editing and explicit coach/return checks. Added one exact tagged picture fixture and cleanup discovery for the four permitted run-owned addresses when a request commits before a navigation timeout.
- Root README, [specification](../../../docs/mvp-spec.md#413-routes-profile-completion-and-returns), COR0027, active Auth UI ticket and root index: optional behavior, delivery ownership and evidence. Independent DEV0329 records the user-requested account removal.

### Decisions and deviations

2026-10-17: reused the existing `/complete-profile` route and avatar component rather than adding another required route/schema flag. The user confirmed deferral, so refresh/lost state cannot block a completed profile. The test setup required a specific uploader error locator (Next also has a route-announcer alert) and explicit sign-out before reusing its browser for guest recovery checks. Cleanup now recovers only the run's four exact permitted fixture emails if a request commits before its ID is written. Later real checks intermittently remained on signup/complete-profile despite completing the action. The existing helper issued router.replace and immediately refreshed the current route; bundled Next guidance distinguishes these operations. Adopt one document replacement at Auth boundaries so the destination renders with current cookies and no competing client refresh. This is an adopted implementation fix for reliable Skip/Continue, not a claimed proof of a framework defect. Preserve unrelated/prior working changes.

### Contracts, configuration, and operations

Auth success/continuation now performs a full document replacement, with the same bounded/sanitized destinations and replacement-history semantics. This trades a page load at Auth boundaries for fresh server rendering without competing refresh. Added optional `onBusyChange(working: boolean)` to the shared uploader; existing consumers need no changes. Existing endpoints, buckets, source/canonical limits and identity/authority contracts remain unchanged. No dependency/environment/schema/migration/service restart or hosted deployment. Reverting the invitation restores immediate post-details navigation; preserve already uploaded private avatars.

## Validation results

2026-10-17, Node 24.21.0 / Next 16.3.8 / existing local Docker Auth/Storage/Mailpit and localhost:3100. Read installed App Router navigation documentation before UI integration edits.

- `npm test`: final sequential retry passed 243 unit + 28 server tests (271 total), including image source/canonical validation, private media authority and Auth boundaries. Initial sandbox execution failed before tests because tsx could not create its local IPC pipe (EPERM). The first permitted run overlapped compilation and timed out in an unrelated five-second hosted-preflight child process; the subsequent run and final-source rerun passed. Final log: `/tmp/dev0328-final-tests.log`.
- `npm run lint`, `npm run typecheck` and focused ESLint passed, including final-source sequential checks logged in `/tmp/dev0328-final-lint.log` and `/tmp/dev0328-final-types.log`. Formatting initially caught the edited rehearsal; Prettier fixed it and final `npm run format:check`/`git diff --check` passed.
- Configuration-free `env DATABASE_URL= NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= NEXT_PUBLIC_SITE_URL= NEXT_PUBLIC_GEOAPIFY_API_KEY= npm run build`: final-source build passed compile, TypeScript and 24 static pages (log `/tmp/dev0328-final-build.log`), including concurrent navigation work; no hosted settings/access. No database schema changed, so migration validation is not applicable.
- `npm run test:auth`: final complete run passed all eight real local phases after the navigation fix. The photo phase proved mobile no-file skip, invalid-file error, real upload with active-work continuation disabled, 512×512 WebP/no EXIF/≤512 KB bytes, guest 401, removal/re-upload, later Profile editor, no automatic coach application and retained explicit sessions query. Screenshots were visually inspected at 393×852 and 1440×1040 with no form clipping/overlap. Confirmation/name/username recovery, ordinary desktop/mobile login, explicit return/coach intent, restricted recovery, password change/two-device revocation, existing passwordless/private-data continuity and retired-code denial also passed. Exact tagged Auth/profile/account/Storage fixtures were removed and all prior profile fingerprints preserved. Final evidence: ignored `tmp/email-auth-rehearsal/dev0286-44948419-602f-4955-9171-2f16f3723a63/result.json`, screenshots and recovery manifest; log `/tmp/dev0328-auth-navigation.log`.
- Resolved rehearsal issues: the first signup navigation timed out while compilation/checks overlapped; exact old fixture cleanup passed using its recovery manifest. A later generic alert locator also matched Next's route announcer; it was narrowed to the uploader. The new picture browser was explicitly signed out before subsequent guest checks. A further old-route Skip timeout led to the documented single-navigation fix, followed by the complete eight-phase pass. These failed runs are not counted as passed full rehearsals; their exact fixtures/images were cleaned.
- With the same empty environment prefix, `npx playwright test tests/browser/auth.spec.ts tests/browser/authorization.spec.ts`: 6 passed, 2 configured-guest cases intentionally skipped in the configuration-free preview; real configured authority is covered by the eight-phase rehearsal. Log: `/tmp/dev0328-browser.log`. `python3 /tmp/dev0328-check-docs.py` checks the 19 scoped documents, local links/anchors, unique IDs, next IDs and completed lifecycle/membership after archival. Hosted email/Google/provider readiness, production and independent review are outside this slice.

| Criterion | Evidence | Result |
| --- | --- | --- |
| AC1 | Real mobile signup/no-file keyboard Do this later to Home; later personal Profile editor confirmed. | Passed locally |
| AC2 | Invalid-file recovery, delayed upload/disabled continuation, 512-square private WebP bytes, remove/re-upload and guest denial pass. | Passed |
| AC3 | New/returning identity, explicit query return, separate coach action, full recovery and mobile/desktop keyboard/visual checks pass after single-navigation fix. | Passed locally |
| AC4 | 271 unit/server tests, 8 real Auth phases, 6 browser checks, final static/build/docs and exact Auth/Storage fixture cleanup pass. | Passed |

## Risks, limitations, and follow-ups

Optional state is transient; refresh may bypass the invitation and the user can add a picture later. Google/hosted readiness remains in existing Auth peers.

## Completion and review references

- Completed: 2026-10-17 — optional private registration picture, reliable continuation and preserved existing Auth flows locally verified.
- Commit: User-requested integration checkpoint on 2026-10-18, subject `[DEV0288][DEV0324][DEV0325][DEV0328][DEV0329] Complete registration and authentication frontend`.
- Review: Changed-file/acceptance and screenshot self-review passed; no independent review.
- Deployment or release: None.
