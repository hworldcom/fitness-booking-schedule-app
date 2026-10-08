# Ticket DEV0150: Hide My sessions from signed-out navigation

- Status: Completed
- Created: 2026-10-08
- Last updated: 2026-10-08
- Milestone: Scheduling-only client navigation
- Coordination: None — independent development ticket
- Related records: [DEV0149 — Replace the user Coach tab with My sessions](DEV0149-replace-user-coach-tab-with-my-sessions.md)

## Objective and context

DEV0149 made `My sessions` the client-focused schedule destination but exposed the link through the shared shell even when no account is authorized. The confirmed follow-up is that signed-out visitors must not see this personal destination. Render `My sessions` only when the shell's existing server-initialized actor state is authorized, while retaining `/sessions` protection for direct URL access. This clarifies the account-only navigation behavior in the [actor contract](../../../docs/mvp-spec.md#3-actors-and-authority).

## Scope and non-goals

- In scope:
  - hide `My sessions` from desktop and mobile navigation for preview, signed-out, forbidden and unavailable actor states;
  - show it for authorized accounts and update immediately when actor state changes after sign-in or sign-out;
  - keep the mobile navigation balanced with either four or five visible entries;
  - update the product decision and focused browser/Auth validation.
- Out of scope:
  - changing `/sessions` authorization or booking data;
  - hiding public discovery, How it works or Profile navigation;
  - changing coach application/workspace access or adding role-specific shell navigation.

## Expected behavior and edge cases

- A guest in configured or configuration-free preview mode sees no exact `My sessions` navigation link at desktop or mobile widths.
- An authorized account sees exactly one visible `My sessions` item in the active desktop or mobile navigation, linked to `/sessions`.
- Signing out removes the item as actor state clears; a transient unavailable or forbidden state does not reveal it.
- Direct signed-out requests to `/sessions` remain protected by the existing route boundary.

## Assumptions, decisions, and dependencies

- Adopted user decision, 2026-10-08: `My sessions` must not be visible when the user is not logged in.
- The shell already consumes the authoritative bounded actor snapshot, so no additional client request, cookie inspection or database read is needed.
- Profile remains visible because it owns sign-in/setup states; only the personal schedule item is account-only.
- Pre-implementation review found one small shell-presentation slice with focused validation and no need for a coordination record or ticket split.

## Implementation plan

1. Mark `My sessions` as account-only in the shared navigation definition and derive one visible navigation list from authorized actor state.
2. Render that same list in desktop and mobile navigation and make mobile item sizing adapt to the visible count.
3. Update signed-out browser expectations, preserve authenticated rehearsal assertions and refine the specification decision.
4. Run unit checks, type checking, lint, formatting, production build, desktop/mobile Playwright, local Auth rehearsal and `git diff --check`.

## Acceptance criteria

- [x] AC1: Preview, signed-out, forbidden and unavailable shells omit `My sessions` from desktop and mobile navigation.
- [x] AC2: Authorized accounts show `My sessions` linked to `/sessions`, and sign-out removes it without weakening direct-route authorization.
- [x] AC3: Mobile navigation remains usable with four guest items and five authorized items.
- [x] AC4: Relevant automated, authenticated, build and responsive checks pass and the implementation record is complete.

## Validation plan

- Update the public desktop/mobile navigation test to require zero `My sessions` links.
- Keep the configured signed-out `/sessions` redirect assertion and extend the local Auth rehearsal to observe the link while authorized and its removal after sign-out.
- Use existing desktop/mobile Playwright projects for layout/overflow coverage; no database test or migration validation applies because persistence and authorization are unchanged.
- Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`, `npm run test:e2e`, `npm run test:auth` and `git diff --check`.

## Implementation record

The shared shell now marks `My sessions` as account-only and derives one navigation list from the existing bounded actor status. Only `authorized` includes `/sessions`; `preview`, `signed-out`, `forbidden` and `unavailable` all render the public four-item navigation. Both desktop and mobile consume the same list, so sign-in and sign-out state changes cannot leave the two surfaces inconsistent.

### Changes and rationale

- Added an explicit `accountOnly` navigation property and a pure `navigationForActor()` projection instead of inspecting cookies or initiating another identity request.
- Reused the shell's server-initialized/reactive actor state, so the link appears after a verified account becomes authorized and disappears when sign-out clears that state.
- Changed mobile navigation items from a fixed 20% width to equal flex distribution, allowing four public or five authorized items without dead width or overflow.
- Updated the specification and browser/Auth assertions to distinguish public navigation from authorized-account navigation.

### Affected files

| File or component | Change and purpose |
| ----------------- | ------------------ |
| `src/components/shell.tsx` | Marks `My sessions` account-only, filters by actor status and feeds the same resulting list to desktop/mobile navigation. |
| `src/app/globals.css` | Distributes mobile navigation entries equally for either visible item count. |
| `tests/shell-navigation.test.ts` | Proves every non-authorized actor state omits `/sessions` and authorized state includes it in the expected position. |
| `tests/browser/public-story.spec.ts` | Verifies signed-out desktop/mobile public navigation has no exact `My sessions` link. |
| `scripts/rehearse-local-email-auth.mjs` | Retains the authorized link/href check and now verifies immediate removal after real local sign-out. |
| `docs/mvp-spec.md` | Clarifies that `My sessions` belongs to authorized-account navigation and is omitted while signed out. |

### Decisions and deviations

- 2026-10-08: Use the existing actor snapshot as the sole presentation gate so navigation follows the same verified account state as the rest of the shell.
- 2026-10-08: Kept `/sessions` route authorization unchanged; hiding a link is a presentation rule and not a security boundary.

### Contracts, configuration, and operations

The shell presentation contract now returns four public items for every actor state except `authorized`, which receives the fifth `/sessions` item. The protected `/sessions` route and its sign-in return behavior are unchanged.

No data shape, API, database schema, migration, environment variable, dependency, setup step or external integration changed. Reverting the shell/style changes restores the prior visibility without data conversion.

## Validation results

| Criterion | Evidence | Result |
| --------- | -------- | ------ |
| AC1 | `tests/shell-navigation.test.ts` passed for `preview`, `signed-out`, `forbidden` and `unavailable`. `npm run test:e2e` passed the signed-out public-navigation assertion at desktop and mobile widths with zero `My sessions` links. | Passed |
| AC2 | The same unit check includes `/sessions` only for `authorized`. `npm run test:auth` observed `My sessions` with `href="/sessions"` for real authorized accounts, then observed zero matching links after sign-out; existing configured-guest `/sessions` redirect coverage also passed. | Passed |
| AC3 | `npm run test:e2e` passed all 28 desktop/mobile checks with the four-item guest bar. The live Auth rehearsal passed mobile overflow checks while the authorized five-item bar was present. | Passed |
| AC4 | `npm test` passed 66/66; `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build` and `git diff --check` passed. The Next.js 16.3.8 production build retained protected `/sessions`, and the complete local email-code rehearsal passed without page errors. | Passed |

`npm run test:db` was not run because this change does not touch persistence, database queries, authorization functions or migrations.

## Risks, limitations, and follow-ups

- Direct route protection remains necessary even though the link is hidden; navigation visibility is not an authorization mechanism.

## Completion and review references

- Completed: 2026-10-08.
- Commit: Included in `[DEV0147][DEV0148][DEV0149][DEV0150][DEV0151] Publish standalone scheduling platform`.
- Review: Self-review completed against every acceptance criterion; no independent review or pull request created.
- Deployment or release: Not deployed.
