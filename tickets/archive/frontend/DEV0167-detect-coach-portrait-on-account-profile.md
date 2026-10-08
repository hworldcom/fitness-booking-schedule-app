# Ticket DEV0167: Detect coach portrait on account Profile

- Status: Completed
- Created: 2026-10-08
- Last updated: 2026-10-08
- Milestone: Account and coach presentation follow-up
- Coordination: None — independent development ticket
- Related records: follows completed [DEV0154 — Adopt the profile-image contract](../organisatory/DEV0154-adopt-profile-image-contract.md), [DEV0155 — Store normalized profile images](../backend/DEV0155-store-normalized-profile-images.md), and [DEV0156 — Upload and present profile images](DEV0156-upload-and-present-profile-images.md)

## Objective and context

The public Explore card correctly renders Daniel Park's seeded coach portrait, but the signed-in `/profile` route shows initials when that coach account has no separate private account avatar. Make the account Profile detect an owned coach portrait and use it as a display fallback without turning that public image into a private account-avatar record. This refines the optional/private/public behavior in [the profile-image contract](../../../docs/mvp-spec.md#profile-images).

## Scope and non-goals

- In scope: project the signed-in owner's coach portrait to `/profile`; prefer a private account avatar when one exists; otherwise render the public coach portrait in the Profile heading and account-image preview; explain that the detected portrait is a fallback; retain initials when neither image exists; add focused tests and local browser evidence.
- Out of scope: copying image bytes or references between buckets/columns, changing public discovery, making pictures mandatory, changing upload authority, generating more portraits, changing header/sidebar avatar behavior, database migrations, deployment, or unrelated profile redesign.

## Expected behavior and edge cases

An authorized coach with an account avatar sees that private avatar on Profile. Without one, an owned public coach portrait is detected and displayed there. The private account-avatar control continues to create only a private avatar and must not offer to remove the public portrait. A non-coach, a coach without a portrait, or an unavailable coach projection retains initials. Removing a private avatar reveals the public portrait fallback when available. Removing the public portrait from the coach editor leaves the private avatar unchanged, or initials when no private avatar exists.

## Assumptions, decisions, and dependencies

- Showing an already-public owned coach portrait on the owner's private Profile does not expose private account media or weaken the separate mutation/storage contracts.
- The existing owner-scoped coach projection is the authoritative source; the browser must not infer coach identity from a public slug.
- The Profile heading and uploader preview may share the display fallback, while account-avatar mutation state remains based only on the private avatar.
- The scope is one reviewable frontend presentation fix with a small server projection change and does not require coordination or ticket splitting.

## Implementation plan

1. Extend the current coach account summary used by `/profile` with the owner-scoped portrait URL.
2. Pass the portrait fallback to Profile and teach the account uploader to distinguish its owned current image from a display-only fallback.
3. Update the product contract with the fallback precedence and add focused component/service/browser assertions.
4. Run relevant tests, typecheck, lint, formatting and a production build; archive this ticket only if all acceptance criteria pass.

## Acceptance criteria

- [x] AC1: Daniel's signed-in Profile displays the same detected public coach portrait shown in Explore when he has no private account avatar.
- [x] AC2: A private account avatar takes precedence, and the account control removes/replaces only that private avatar rather than the public portrait.
- [x] AC3: Accounts without either image keep the initials fallback, and unavailable or absent coach data does not break Profile.
- [x] AC4: The specification and interface copy clearly preserve the separate private account-avatar and public coach-portrait contracts.

## Validation plan

Add focused rendering assertions for fallback precedence and mutation controls, then extend the existing local profile-image browser rehearsal to open Daniel's signed-in `/profile`. Run the focused tests and rehearsal plus `npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`, and `git diff --check`. No database migration checks are required because the schema and Storage policies do not change.

## Implementation record

Completed the Profile-only fallback while retaining independent account-avatar and coach-portrait ownership and mutation behavior.

### Changes and rationale

`/profile` previously received only coach-access status and rendered `actor.profile.avatarUrl`, so Daniel's seeded public portrait was invisible unless he uploaded the same image again as a private avatar. The route now receives the authenticated owner's coach portrait from the existing owner-scoped projection. One pure presentation rule selects the private account avatar first, the public coach portrait second and initials last.

The account uploader preview uses the same precedence but keeps its mutation state tied to the private avatar. When only the coach fallback is visible, the interface says that it was detected, offers `Choose image` rather than `Replace image`, and exposes no `Remove` button. Uploading a private avatar overrides the fallback; removing that private avatar reveals the public portrait again.

### Affected files

| File or component                                                                     | Change and purpose                                                                                              |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `src/server/coaches/service.ts`, `src/app/profile/page.tsx`                           | Projects and passes the authenticated owner's existing coach portrait to the account Profile.                   |
| `src/features/profile/profile-image-presentation.ts`                                  | Defines the testable account-avatar, coach-portrait and initials precedence.                                    |
| `src/features/profile/profile.tsx`, `src/features/profile/profile-image-uploader.tsx` | Renders the detected fallback with explicit copy while keeping private-avatar upload/removal state independent. |
| `docs/mvp-spec.md`                                                                    | Records the confirmed Profile fallback without changing the private/public storage boundary.                    |
| `tests/profile-images.test.ts`, `scripts/rehearse-local-profile-images.mjs`           | Covers all precedence states and the real signed-in Daniel upload/remove/fallback flow.                         |
| `tickets/README.md`                                                                   | Tracks this completed development record and the next unused identifiers.                                       |

### Decisions and deviations

- 2026-10-08: Kept the header/sidebar unchanged because the request concerned the account Profile and those navigation surfaces intentionally represent only the private account avatar.
- 2026-10-08: Renumbered this uncommitted ticket after concurrent native-iOS planning finalized DEV0159-DEV0166. The completed record now uses the next free ID, DEV0167; no implementation or commit history used either transient conflicting identifier.

### Contracts, configuration, and operations

The server result consumed by `/profile` adds nullable `coachPortraitUrl`; it comes from the existing owner-scoped coach projection and is not added to the public actor snapshot. No schema, Storage policy, environment variable, dependency, bucket, migration or deployment operation changed.

## Validation results

Validated locally on 2026-10-08 with Node.js 24.21.0, Chrome and the running Next.js/Auth/PostgreSQL/Storage/Mailpit stack.

- `npm run test:profile-images` — passed the complete real browser rehearsal: Hoang's private upload/removal, Daniel's detected coach fallback, no removal action for fallback-only state, private-avatar precedence, private-avatar removal revealing the portrait, separate public portrait upload/removal, mobile overflow and cleanup/reseed.
- `npm test` — passed 80 general tests and 2 server image-normalization tests.
- `npm run typecheck` — passed after Next.js route-type generation.
- `npm run lint` — passed.
- `npm run format:check` — passed.
- `npm run build` — passed with Next.js 16.3.8 and all application routes emitted.
- `git diff --check` — passed.
- The first combined browser rehearsal attempt under the shell's unsupported Node.js 20.12.2 failed while constructing the current Supabase client because that runtime lacked native WebSocket support. The exact rehearsal passed after prepending the repository-required Node.js 24.21.0 binary; this was an environment correction, not an application change.

| Criterion | Evidence                                                                                                                                        | Result |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Signed-in Daniel browser flow found `Daniel Park public coach portrait` on `/profile` before any private upload.                                | Passed |
| AC2       | Browser flow proved private-avatar precedence, private-only removal and automatic restoration of the coach fallback; unit test covers ordering. | Passed |
| AC3       | Unit test covers the null/null initials state; browser rehearsal and full tests retained Hoang and other fallback behavior.                     | Passed |
| AC4       | Specification, detected-fallback copy and browser assertion preserve and explain separate mutation/storage behavior.                            | Passed |

## Risks, limitations, and follow-ups

The fallback is deliberately limited to the signed-in account Profile; header and sidebar continue to represent the private account avatar and otherwise use initials. Hosted deployment was not part of this local fix.

## Completion and review references

- Completed: 2026-10-08 — the account Profile detects the owner's coach portrait as a display-only fallback with private-avatar precedence.
- Commit: Not created.
- Review: No independent review created.
- Deployment or release: Not deployed or released.
