# Ticket DEV0052: Account-backed personal profile

- Status: Completed
- Created: 2026-09-22
- Last updated: 2026-09-22
- Milestone: M0 identity and interface integrity
- Coordination: None — independent development ticket
- Related records: consumes completed [DEV0046 — Email OTP registration and application profiles](../backend/DEV0046-email-otp-registration-and-application-profiles.md) and [DEV0040 — Protected access and database context](../backend/DEV0040-protected-access-and-database-context.md); completes before [COR0006 — Persistent access catalogue](../organisatory/COR0006-persistent-access-catalogue.md), converted from retired DEV0017, which coordinates richer persistent profile, draft, follow and bookmark data

## Objective and context

Remove the hardcoded Anna Klein current-user identity from the shared shell, home experience, personal profile and database seed. A personal profile becomes visible only after a person signs up or returns through the email one-time-passcode flow and has an enrolled application profile. This applies the specification's [Profile screen contract](../../../docs/mvp-spec.md#2-screens-and-actions) and [public browsing/sign-in boundary](../../../docs/mvp-spec.md#public-browsing-and-sign-in-boundaries).

DEV0046 already exposes the authorized actor's server-derived display name and slug. The current interface does not consistently consume that contract: signed-out or configuration-free visitors can still see Anna's name/avatar/profile card, and the protected `/profile` page renders Anna plus illustrative personal history after any user signs in. This contradicts the account-first product model and can make fixture data look like the current person's data.

This ticket is intentionally smaller than DEV0017. It fixes current-person identity presentation using the existing minimal actor contract; DEV0017 later adds richer database-backed catalogue, profiles, drafts, follows and bookmarks.

## Scope and non-goals

- In scope: use the current actor snapshot for the shared shell and owner profile; remove Anna's current-user card/name/avatar and fabricated personal history; remove the unclaimed Anna row and dataset membership from the deterministic seed; replace the Anna registration placeholder with a neutral example; keep `/profile` protected in configured database mode with its safe sign-in return; render an honest non-personal state in configuration-free preview mode; add responsive, keyboard and actor-transition tests.
- Out of scope: editable profile fields or avatar uploads; public people-directory persistence; shared activity, visits, balances, passes, receipts, drafts, follows or bookmarks; changing other clearly labelled catalogue/community fixtures; club workspaces; wallet linking or payments; DEV0017's repository/service work.

## Expected behavior and edge cases

A signed-out visitor may browse public discovery without being assigned a name, avatar or demo profile. The primary Profile navigation may remain as the access point, but it cannot display a current-user identity before authorization. In configured database mode, opening `/profile` while signed out redirects to the shared sign-in route with `/profile` as the safe return destination. In configuration-free preview mode, `/profile` shows an honest explanation that a personal profile appears after account creation rather than inventing a user.

After email verification and successful profile enrollment, the shared shell and `/profile` show the server-derived display name from that actor's current session. A returning sign-in restores the same identity. Sign-out immediately removes personal identity from the shell and prevents stale profile content from remaining visible. Wallet connection, wallet linking and club authority do not create or select the personal profile.

The minimal profile must not claim visits, balances, upcoming sessions, biography text, follows or other personal history that has not been delivered by its owning backend ticket. Existing public community/catalogue fixtures may remain only where visibly labelled as examples and must never be presented as the current person.

## Assumptions, decisions, and dependencies

Confirmed with the user on 2026-09-22:

- remove the hardcoded user from the home/shared interface;
- show a personal profile only after sign-up;
- deliver this cleanup as a separate ticket before DEV0017.

DEV0046 and DEV0040 already provide the required email session, enrollment, protected route and bounded actor snapshot. No new profile endpoint, authentication provider or database table is needed. The public term is `profile`; internal demo-run participation remains implementation detail and grants no club, staff or wallet authority.

Removing Anna from `supabase/seed.sql` is safe because she is an unclaimed fixture with only a dataset-membership row and is not required by the current organization, staff, trainer or catalogue fixtures. Existing disposable local databases require a reset to remove the old seeded row. No hosted cleanup is authorized or expected because the project has not applied this seed as production user data.

## Implementation plan

1. Adapt the shared shell to the current actor snapshot: render the enrolled person's display name/profile link only for an authorized actor and remove personal identity immediately on sign-out or actor mismatch.
2. Adapt the owner `/profile` view to the same actor, showing only delivered minimal identity and honest empty states. Preserve the existing safe signed-out redirect and add a non-fabricated preview/unavailable presentation.
3. Remove Anna's profile/membership rows from the deterministic seed and change the sign-up display-name placeholder to a neutral example. Update database expectations without changing other labelled fixtures.
4. Add focused actor-state/component/source tests and desktop/mobile keyboard browser coverage for guest, enrolled, returning and signed-out transitions. Replay the local database seed and run lint, typecheck, formatting and a production build.

## Acceptance criteria

- [x] AC1: No current runtime source or deterministic seed presents Anna Klein as a current or prepared application user; historical archived records may retain their accurate history.
- [x] AC2: Signed-out and configuration-free preview visitors see no fabricated current-user name, avatar, profile card or personal history. `/profile` preserves a safe sign-in return in configured database mode and an honest unavailable/registration explanation in preview mode.
- [x] AC3: After enrollment, the shell and owner profile show the exact server-derived display name for the current actor; returning sign-in restores it and sign-out removes it without stale-user leakage.
- [x] AC4: The minimal owner profile claims no undelivered visits, balances, sessions, follows, biography, receipts or wallet/club authority. Clearly labelled public catalogue/community fixtures remain separate from current-user identity.
- [x] AC5: Clean database replay, focused actor/profile tests, lint, typecheck, formatting, production build and desktop/mobile keyboard/browser checks pass with exact evidence recorded.

## Validation plan

Use two distinct enrolled email accounts plus a signed-out browser context. Confirm each account sees only its own display name in the shell and owner profile, then sign out and verify the identity disappears before public navigation continues. Directly visit `/profile` while signed out, test the safe return, and verify configuration-free preview mode shows no persona. Check refresh and rapid sign-out/account transitions for stale data. At desktop and 393-pixel widths, verify keyboard access to Profile and sign-in without an unexplained avatar-only control.

Reset the disposable local Supabase database and verify the seed no longer contains Anna while the remaining foundation fixtures and constraints pass. Run focused unit/boundary tests, database tests affected by seed counts, lint, typecheck, formatting, webpack production build and affected Playwright scenarios. Search current runtime source and seed for `Anna Klein`/`anna-klein`; only historical records may match.

## Implementation record

Implemented on 2026-09-22 after the readiness review confirmed that the existing actor snapshot supplies the required identity and that the unclaimed Anna fixture had no organization, staff, trainer or catalogue dependencies.

### Changes and rationale

The shared shell now renders a personal name and avatar only from an `authorized` actor snapshot. Preview, signed-out, forbidden and unavailable actor states cannot reuse stale identity; signing out hides the account profile links immediately. Avatar initials are derived from the enrolled display name, and the shared avatar component no longer has an `AK` default that could silently recreate the old persona.

The owner `/profile` surface now shows only the server-derived display name plus an explicit minimal-account explanation. Configuration-free preview mode explains that no demo person is assigned, configured guests retain the safe `/sign-in?returnTo=/profile` redirect, and unavailable/profile-required states fail without personal content. The fabricated biography, visit count, sessions, following summary and sample balance were removed. Public demo-member profiles remain separately labelled fixtures.

The unclaimed Anna profile and run-membership seed rows were removed, leaving five public fixture profiles required by the catalogue. The sign-up placeholder is neutral, and the email Auth rehearsal now proves two distinct account-backed shell/profile identities, returning sign-in and immediate sign-out cleanup.

### Affected files

| File or component                                                                                                                                                                                                                                                                                                                              | Change and purpose                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`src/components/shell.tsx`](../../../src/components/shell.tsx), [`src/components/ui.tsx`](../../../src/components/ui.tsx), [`src/auth/profile-presentation.ts`](../../../src/auth/profile-presentation.ts)                                                                                                                                    | Render the current profile only for the authorized actor and derive its initials without a hardcoded fallback.                                    |
| [`src/features/profile/profile.tsx`](../../../src/features/profile/profile.tsx), [`src/app/profile/page.tsx`](../../../src/app/profile/page.tsx)                                                                                                                                                                                               | Replace the fabricated owner profile with account-backed minimal identity and honest preview/error/empty states.                                  |
| [`src/features/auth/sign-in.tsx`](../../../src/features/auth/sign-in.tsx), `src/features/feed/feed.tsx` (historical path `src/features/feed/feed.tsx`), [`src/app/globals.css`](../../../src/app/globals.css)                                                                                                                                  | Use a neutral display-name prompt, stop treating the owner profile as a public people directory and style the bounded account-profile content.    |
| [`supabase/seed.sql`](../../../supabase/seed.sql), [`supabase/tests/database/foundation.test.sql`](../../../supabase/tests/database/foundation.test.sql), [`tests/database/foundation.test.ts`](../../../tests/database/foundation.test.ts)                                                                                                    | Remove the prepared current-user rows and validate the remaining five public fixture profiles.                                                    |
| [`scripts/rehearse-local-email-auth.mjs`](../../../scripts/rehearse-local-email-auth.mjs), [`tests/profile-presentation.test.ts`](../../../tests/profile-presentation.test.ts), [`tests/browser/profile.spec.ts`](../../../tests/browser/profile.spec.ts), `tests/browser/redesign.spec.ts` (historical path `tests/browser/redesign.spec.ts`) | Verify initials, guest/preview identity absence, safe profile routing and two real local email-account profile transitions on desktop and mobile. |

### Decisions and deviations

The planned boundary was retained. The existing browser-preview reset remains reachable from the honest preview and authorized profile surfaces, but it is labelled as browser-only and does not claim account persistence. The navigation browser test now accepts the specified configured-mode profile redirect as well as direct configuration-free preview rendering.

### Contracts, configuration, and operations

No endpoint, dependency, secret, environment variable or actor response changed. The existing authorized `ActorSnapshot.profile` (`slug`, `displayName`) remains the only current-user identity input. The disposable local database was reset to remove the old seed row and then repopulated with five public fixture profiles; `.env.local` and hosted data were not changed.

## Validation results

All acceptance criteria passed locally. The first sandboxed `npm test` attempt was blocked by `tsx` IPC permissions; the approved identical retry passed. The first Auth rehearsal used the unchanged hosted values from `.env.local` and therefore could not exercise local Mailpit/database enrollment. Rebuilding and starting with temporary local public Auth values plus the documented restricted loopback `DATABASE_URL` resolved the environment mismatch; no environment file was edited.

| Criterion | Evidence                                                                                                                                                                                                                                                                                                                                                                                             | Result |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | `rg` found no `Anna Klein`, `anna-klein`, `AK`, `Your demo profile` or fabricated owner-history labels in current `src` or `supabase/seed.sql`. Clean seed replay left five required public fixture profiles and no prepared current user.                                                                                                                                                           | Passed |
| AC2       | Configured desktop/mobile browser coverage preserved `/sign-in?returnTo=/profile`; a separate configuration-free build rendered the honest account-creation state at 1440×1040 and 393×852 with no identity/avatar/history or horizontal overflow. Screenshots were visually reviewed.                                                                                                               | Passed |
| AC3       | `npm run test:auth` passed with two independent local email accounts (`Riley Morgan` and `Morgan Lee`), exact server-derived shell/profile names, different slugs, returning login and immediate name/avatar removal on sign-out.                                                                                                                                                                    | Passed |
| AC4       | The account profile renders only display name and derived initials. Source review and browser assertions confirmed there is no biography, visit, balance, session, follow, receipt, wallet or club-authority claim. Public demo people remain visibly labelled.                                                                                                                                      | Passed |
| AC5       | `npm test` passed 46/46; `npm run typecheck`, `npm run lint`, `npm run format:check`, `git diff --check` and `npx --no-install next build --webpack` passed. The focused configured browser set passed 12/12 and the configuration-free profile set passed 2/2. `npm run db:reset`, `npm run db:runtime`, `npm run db:test` (86 assertions), `npm run test:db` (13/13) and `npm run db:lint` passed. | Passed |

The repository Markdown validator passed across 70 Markdown files, 796 local links and 49 unique work records after the completed ticket was archived and all affected links were updated.

## Risks, limitations, and follow-ups

Until DEV0017, the owner profile remains intentionally minimal and does not display shared activity, real visit counts, persistent drafts, follows or bookmarks. Removing Anna did not remove other visibly labelled public demonstration people or catalogue content. Hosted deployment/configuration remains outside this ticket.

## Completion and review references

- Completed: 2026-09-22.
- Commits: planning commit `[DEV0052] Plan account-backed personal profile`; implementation commit `[DEV0052] Use account identity for personal profile` (this change).
- Review: Implementation self-reviewed against AC1–AC5 and the DEV0046/DEV0040/DEV0017 boundaries; no independent review.
- Deployment or release: None.
