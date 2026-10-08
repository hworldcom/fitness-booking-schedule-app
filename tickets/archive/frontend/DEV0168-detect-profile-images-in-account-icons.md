# Ticket DEV0168: Detect profile images in account icons

- Status: Completed
- Created: 2026-10-08
- Last updated: 2026-10-08
- Milestone: Account and coach presentation follow-up
- Coordination: None — independent development ticket
- Related records: follows completed [DEV0167 — Detect coach portrait on account Profile](DEV0167-detect-coach-portrait-on-account-profile.md) and the profile-image delivery under [COR0012 — Profile images](../organisatory/COR0012-profile-images.md)

## Objective and context

The signed-in account Profile can now display an owned public coach portrait when no private account avatar exists, but the bottom-left desktop account control and upper-right header control still read only the private avatar URL. Extend the same image precedence to both navigation icons. Regular accounts must show their uploaded private avatar in both positions and retain initials when no avatar exists. See [the profile-image contract](../../../docs/mvp-spec.md#profile-images).

## Scope and non-goals

- In scope: add a separately named coach-portrait URL to the bounded actor snapshot; derive it from the authenticated owner projection; use shared private-avatar, coach-portrait and initials precedence in both shell icons and Profile; verify regular-user and coach behavior in unit and real browser flows.
- Out of scope: changing upload/removal endpoints, copying portrait data into the account-avatar field, exposing private avatars publicly, changing coach discovery, adding pictures, schema/migration work, native iOS implementation, or redesigning navigation.

## Expected behavior and edge cases

Both bottom-left and upper-right account icons show a private account avatar whenever one exists. If an authorized coach lacks that private avatar but owns a valid public coach portrait, both show the portrait. Removing a private coach-account avatar reveals the public portrait. A regular account has no coach portrait fallback, so removing its avatar restores initials. Missing, malformed or unavailable media must not grant authority or expose storage paths.

## Assumptions, decisions, and dependencies

- The actor snapshot will preserve `avatarUrl` and `coachPortraitUrl` as distinct nullable presentation fields rather than collapse them into one ambiguous URL.
- Existing authenticated actor projection and public-portrait URL validation remain authoritative; shell code only chooses between already-bounded URLs.
- The shared precedence helper belongs in the cross-feature `profile-images` module so Profile and Shell do not depend on one another.
- This is one small presentation vertical slice with a bounded actor projection update and does not require coordination or further splitting.

## Implementation plan

1. Project a validated owned coach portrait alongside the current actor and expose its URL as a separate bounded actor-profile field.
2. Move the shared image-precedence helper to the profile-image module and use it in Profile, the uploader preview and Shell.
3. Extend unit fixtures/contracts and the real local browser rehearsal for both regular-user and coach navigation icons.
4. Update the product specification, run focused/full validation, complete the implementation record and archive the ticket when all criteria pass.

## Acceptance criteria

- [x] AC1: A regular user with a private avatar sees it in the bottom-left and upper-right account icons; removing it restores initials.
- [x] AC2: A coach without a private avatar sees the owned public coach portrait in both icons; a private avatar overrides it and removal restores the portrait.
- [x] AC3: Actor data keeps the private avatar and public coach portrait distinct and rejects extra or malformed presentation fields.
- [x] AC4: Profile and Shell use one shared precedence rule, and the specification describes the behavior without weakening image privacy or authority.

## Validation plan

Extend actor-contract and presentation tests, then update the existing Chrome profile-image rehearsal to inspect `.sidebar-profile` and `.header-avatar` image state for Hoang and Daniel before/after upload and removal. Run `npm run test:profile-images`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`, and `git diff --check` under the repository-required Node.js 24 runtime. No database migration suite is required because persisted contracts do not change.

## Implementation record

Completed the shared signed-in image precedence across Profile and both desktop shell account controls.

### Changes and rationale

The actor response previously carried only the private `avatarUrl`, so the shell could not detect a public coach portrait. The authenticated actor projection now validates the owner's optional coach portrait source/path/version and exposes only a bounded `coachPortraitUrl` beside the still-separate private `avatarUrl`. Storage paths remain server-side.

Profile, its uploader preview and Shell now call one shared presentation helper that selects private avatar first, public coach portrait second and initials last. Both bottom-left and upper-right shell avatars consume that result. Account and coach uploads/removals refresh the actor snapshot, so both icons update immediately: a regular user's removal returns to initials, while a coach's private-avatar removal reveals the public portrait.

### Affected files

| File or component                                                                                                 | Change and purpose                                                                                               |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `src/server/db/authorization/repository.ts`, `src/server/authorization/service.ts`                                | Validates the owned portrait with the existing actor query and projects its bounded public URL.                  |
| `src/auth/actor-contracts.ts`, `src/profile-images/contracts.ts`                                                  | Adds the separate nullable `coachPortraitUrl` actor field and strict fixture/Storage URL validation.             |
| `src/profile-images/presentation.ts`                                                                              | Centralizes private-avatar, coach-portrait and initials precedence for all signed-in presentation.               |
| `src/components/shell.tsx`, `src/features/profile/profile.tsx`, `src/features/profile/profile-image-uploader.tsx` | Uses the shared image result in both shell icons and Profile, and refreshes actor state after either image kind. |
| `src/app/profile/page.tsx`, `src/server/coaches/service.ts`                                                       | Removes the now-redundant Profile-only portrait prop/query result introduced by DEV0167.                         |
| `tests/authorization.test.ts`, `tests/profile-images.test.ts`, `tests/shell-navigation.test.ts`                   | Updates actor fixtures and verifies bounded URLs, exact shape and shared precedence.                             |
| `scripts/rehearse-local-profile-images.mjs`                                                                       | Verifies visible desktop icons and live transitions for Hoang and Daniel, plus existing mobile/profile flows.    |
| `docs/mvp-spec.md`, `tickets/README.md`                                                                           | Records the signed-in surface precedence and this completed work record.                                         |

### Decisions and deviations

- 2026-10-08: Replaced DEV0167's route-specific portrait prop with the actor snapshot field so Profile and Shell share one authenticated source rather than issue or maintain separate presentation paths.
- 2026-10-08: Kept `avatarUrl` and `coachPortraitUrl` separate instead of exposing one ambiguous effective URL; this preserves privacy semantics and lets the UI apply explicit precedence.
- 2026-10-08: Left the existing mobile breakpoint unchanged. The upper-right avatar is intentionally hidden below 760 px; the browser rehearsal proves both requested controls visibly at desktop width and separately preserves mobile overflow behavior.

### Contracts, configuration, and operations

The authorized actor response's exact `profile` object now contains `slug`, `displayName`, nullable private `avatarUrl` and nullable public `coachPortraitUrl`. Existing consumers and fixtures must include the new field. Only validated fixture URLs or public `coach-portraits` Storage URLs are accepted. No schema, Storage policy, bucket, dependency, environment variable, migration or deployment operation changed.

## Validation results

Validated locally on 2026-10-08 with Node.js 24.21.0, Chrome and the running Next.js/Auth/PostgreSQL/Storage/Mailpit stack.

- `npm run test:profile-images` — passed the complete real browser rehearsal. Hoang's private avatar was present in both visible desktop icons and removal restored `HO`; Daniel's fixture portrait appeared in both, a private avatar overrode it, private removal restored it, public replacement updated both icons and public removal restored `DP`. Existing privacy, profile, mobile overflow and cleanup/reseed checks also passed.
- `npm test` — passed 80 general tests and 2 server image-normalization tests, including exact actor shape, malformed coach URL rejection and presentation precedence.
- `npm run test:db` — passed all 34 serialized database integration tests, including actor context and profile-image ownership coverage.
- `npm run typecheck` — passed after Next.js route-type generation.
- `npm run lint` — passed.
- `npm run format:check` — passed.
- `npm run build` — passed with Next.js 16.3.8 and all application routes emitted.
- `git diff --check` — passed.
- One interim browser assertion incorrectly expected the mobile-hidden header avatar to be visible at 393 px. The assertion was corrected to verify both requested controls at 1440 px while retaining the separate 393 px overflow check; the complete rehearsal then passed.

| Criterion | Evidence                                                                                                                              | Result |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Real Hoang upload showed the private `/api/profile/avatar` image in both visible desktop controls; removal restored `HO`.             | Passed |
| AC2       | Real Daniel flow proved fixture, private override, restored fixture, Storage replacement and final `DP` transitions in both controls. | Passed |
| AC3       | Actor unit tests and server projection validation preserve separate fields and reject malformed URLs; no storage path is serialized.  | Passed |
| AC4       | Profile and Shell call the same helper, while the updated specification retains separate storage and mutation contracts.              | Passed |

## Risks, limitations, and follow-ups

The actor endpoint carries only bounded presentation URLs, never storage references. A broken public image URL still falls back visually through the shared Avatar component. The mobile layout continues to use the labelled Profile navigation item rather than the desktop header avatar.

## Completion and review references

- Completed: 2026-10-08 — both desktop account icons now detect regular-user private avatars and coach portrait fallbacks with live precedence updates.
- Commit: Not created.
- Review: No independent review created.
- Deployment or release: Not deployed or released.
