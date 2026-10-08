# Ticket DEV0149: Replace the user Coach tab with My sessions

- Status: Completed
- Created: 2026-10-08
- Last updated: 2026-10-08
- Milestone: Scheduling-only client navigation
- Coordination: None — independent development ticket
- Related records: [DEV0144 — Show client booking history](DEV0144-show-client-booking-history.md), [DEV0147 — Separate client onboarding and verified coach access](../backend/DEV0147-separate-client-onboarding-and-verified-coach-access.md)

## Objective and context

The global desktop and mobile navigation currently exposes a `Coach` tab to every visitor and ordinary client. The account profile also promotes the coach workspace to every signed-in user. This conflicts with the delivered separation between default client capability and optional reviewed coach access.

Replace the global `Coach` destination with a client-focused `My sessions` destination showing upcoming private sessions and retained booking history. Keep coach workspace/application access out of ordinary user navigation and show it on the account profile only when the server reports an existing coach application, approval, suspension or explicit demo-coach status. This refines the client and coach roles in the [MVP specification](../../../docs/mvp-spec.md#3-actors-and-authority) without changing scheduling authority.

## Scope and non-goals

- In scope:
  - replace the global desktop/mobile `Coach` item with `My sessions`;
  - add a protected `/sessions` page backed by the existing actor-scoped private-booking projection;
  - keep upcoming sessions first and preserve the existing history, cancellation, empty and unavailable states;
  - remove the generic coach-workspace promotion from ordinary account profiles;
  - show a bounded coach application/workspace entry on Profile only for accounts whose server-derived coach access is not `not-applied`;
  - update focused browser/auth rehearsal coverage and navigation copy.
- Out of scope:
  - changing booking persistence, cancellation rules, coach approval state or public coach discovery;
  - adding group classes, external calendars, reminders, payments or notifications;
  - removing the protected `/coach` workspace for actual applicants/coaches;
  - redesigning the full shell or account profile.

## Expected behavior and edge cases

- Desktop and mobile navigation show `My sessions` and no generic `Coach` tab.
- A configured signed-out visitor opening `/sessions` is redirected through the existing sign-in return boundary. Configuration-free preview shows a truthful account-required state.
- An authorized client sees upcoming confirmed sessions before terminal/history rows; no bookings shows a `Find a coach` action and database failure shows no cached or fabricated schedule.
- Ordinary clients with no coach application see no coach-workspace promotion on Profile.
- Pending, rejected and suspended applicants receive a coach-application entry on Profile; approved/demo coaches receive a coach-workspace entry. This entry is presentation only and does not grant authority.
- Direct `/coach` authorization and application gates remain authoritative if a URL is guessed or revisited.

## Assumptions, decisions, and dependencies

- Adopted user decision, 2026-10-08: ordinary users do not need a `Coach` tab and should instead have navigation related to future classes.
- The product's persisted item is a one-hour private session, so the user-facing label is `My sessions` rather than introducing a new `class` domain term.
- Reuse `ClientSessions` and `currentPrivateBookingWorkspace()` instead of adding a duplicate booking projection or database change.
- Add a narrow server-only `currentCoachAccess()` read around the existing bounded actor projection for conditional Profile presentation; browser actor contracts remain unchanged.
- Pre-implementation review found one small frontend vertical slice. A separate route, navigation replacement and conditional profile entry are cohesive and require no coordination-record split.

## Implementation plan

1. Add the protected `/sessions` page using existing booking state and explicit preview/unavailable handling.
2. Replace the shell's global `Coach` item with `My sessions`, keeping desktop/mobile active-state and icon behavior consistent.
3. Remove the booking list from the account Profile, derive coach access server-side and render coach application/workspace entry only for existing coach-capability states.
4. Update authenticated rehearsal and browser checks for the user-focused navigation, sessions page, ordinary-profile boundary and responsive behavior.
5. Run focused/unit/browser checks, lint, type checking, formatting, production build and `git diff --check`; complete and archive the ticket only if all acceptance criteria pass.

## Acceptance criteria

- [x] AC1: Desktop and mobile global navigation contain `My sessions` linked to `/sessions` and contain no `Coach` tab.
- [x] AC2: `/sessions` is protected and renders actor-scoped upcoming sessions first, retained history, empty state or bounded unavailable state without fabricated data.
- [x] AC3: An ordinary client Profile has no coach-workspace promotion, while an existing applicant/approved/demo coach receives the appropriate bounded entry without gaining new authority.
- [x] AC4: Existing coach workspace/application routes remain reachable for eligible accounts and continue enforcing their server/database authorization.
- [x] AC5: Relevant unit, type, lint, format, build, authenticated-flow and desktop/mobile browser checks pass and the implementation record is complete.

## Validation plan

- Update browser navigation checks for `My sessions`, removal of the global `Coach` label and `/sessions` protected access at desktop/mobile widths.
- Update the real local email-code rehearsal to prove an ordinary account Profile omits coach promotion and its `My sessions` page renders the empty/upcoming contract.
- Preserve existing domain tests for upcoming-first ordering and database tests for actor-scoped private bookings; no migration test is required because schema and database functions do not change.
- Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`, the relevant Playwright/auth rehearsal, and `git diff --check`.

## Implementation record

The shared desktop/mobile shell now presents `My sessions` at `/sessions` instead of exposing the coach workspace as a universal navigation tab. The new protected route reads the existing actor-scoped private-booking workspace and renders the established upcoming-first schedule, retained terminal history, cancellation controls and truthful empty/unavailable states. Booking-result links and mutation cache invalidation now target that route.

Profile remains the account/identity surface. It links to `My sessions` and receives only the server-derived coach-access projection needed to decide whether a secondary coach entry exists. An account that has never applied sees no coach promotion; pending/rejected applicants receive the application destination, approved/demo coaches receive the workspace destination, and suspended coaches receive a bounded status/workspace destination. These links expose no authority that the existing protected routes and database checks do not already enforce.

### Changes and rationale

- Reused the existing `ClientSessions` projection and timeline rather than creating a second schedule model or database query.
- Added a narrow server-side coach-access reader so Profile does not infer eligibility from browser state or editable identity data.
- Extracted the coach-entry presentation mapping as a pure function and covered every access status, keeping ordinary-account omission explicit.
- Moved booking-result and all-session links from the retired Profile anchor to `/sessions#my-sessions`, and revalidated `/sessions` after booking/cancellation.
- Updated the product contract with the confirmed global-navigation and conditional coach-entry decision.

### Affected files

| File or component | Change and purpose |
| ----------------- | ------------------ |
| `src/app/sessions/page.tsx` | Adds the protected schedule route with explicit preview, signed-out, forbidden and unavailable handling around the existing actor-owned booking projection. |
| `src/components/shell.tsx` | Replaces the shared desktop/mobile `Coach` navigation item with `My sessions` and a schedule icon. |
| `src/app/profile/page.tsx`, `src/server/coaches/service.ts` | Replaces the Profile booking read with a narrow server-derived coach-access read used only for conditional presentation. |
| `src/features/profile/profile.tsx` | Keeps account details separate from the schedule, links to `/sessions` and maps each actual coach-access status to the correct application/workspace entry while omitting ordinary accounts. |
| `src/features/profile/client-sessions.tsx`, `src/app/globals.css` | Promotes the standalone schedule title to the page's accessible `h1` without changing booking behavior or layout. |
| `src/features/coaches/coach-marketplace.tsx`, `src/app/coach-marketplace-actions.ts` | Points booking feedback/all-session links and post-mutation route revalidation at the new durable schedule destination. |
| `tests/profile-navigation.test.ts`, `tests/browser/public-story.spec.ts`, `tests/browser/authorization.spec.ts` | Cover every conditional coach entry, the desktop/mobile navigation replacement and configured-guest protection for `/sessions`. |
| `scripts/rehearse-local-email-auth.mjs` | Exercises the ordinary-account omission, pending-applicant exception and `My sessions` empty state with real local Auth accounts at desktop/mobile widths. |
| `docs/mvp-spec.md` | Records `My sessions` as the universal client navigation destination and makes coach Profile entry conditional on an existing application. |

### Decisions and deviations

- 2026-10-08: Used the existing product term `session` for the requested future-class navigation so the interface remains consistent with the private-session state model.
- 2026-10-08: Added a focused coach-access service read instead of loading the complete coach editor workspace on Profile; this avoids unnecessary coach-profile and gym queries while preserving server authority.
- 2026-10-08: Kept `/coach` directly addressable because applicants and coaches still need it, but removed it from universal navigation and retained its existing application/authorization gate.

### Contracts, configuration, and operations

The public route contract adds protected `/sessions` and moves the durable booking schedule from `/profile#my-sessions` to `/sessions#my-sessions`; Profile itself remains valid as the account surface. The internal server service adds `currentCoachAccess()` as a bounded read of the existing `CoachAccessProjection`. Browser actor shapes, booking shapes, authorization rules and persistence are unchanged.

No database schema, migration, environment variable, dependency, setup step or external API changed. There is no database rollback step. Reverting the route/navigation files restores the prior presentation without data conversion.

## Validation results

| Criterion | Evidence | Result |
| --------- | -------- | ------ |
| AC1 | `npm run test:e2e` passed all 28 desktop/mobile checks. The shared-navigation test observed `My sessions` with `href="/sessions"` and zero exact `Coach` navigation links at both widths. | Passed |
| AC2 | `npm test` passed 64/64, including deterministic upcoming-before-history ordering. The configured browser suite verified that guests are redirected from `/sessions` with the exact return path, and the real local Auth rehearsal rendered the actor-owned empty schedule without placeholder history. | Passed |
| AC3 | `tests/profile-navigation.test.ts` passed the ordinary, pending, rejected, suspended, approved and demo mappings. `npm run test:auth` also proved that a new ordinary account has no coach action while a separate pending applicant receives `Open coach application`. | Passed |
| AC4 | Existing Playwright coach workspace/profile application-gate checks passed. The local Auth rehearsal directly opened `/coach` as an ordinary client and observed `Apply before publishing coaching.`, confirming guessed URLs do not bypass the gate. | Passed |
| AC5 | `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build` and `git diff --check` passed. The Next.js 16.3.8 production build included dynamic `/sessions`; the 28 browser checks and complete local email-code rehearsal passed without page errors. | Passed |

`npm run test:db` was not rerun for this frontend slice because no schema, migration, repository query or booking authorization function changed. The existing actor-scoped booking projection is consumed unchanged; its client timeline rule ran in the 64-test unit suite.

## Risks, limitations, and follow-ups

- `My sessions` covers current private coaching sessions only; group classes and calendar integrations remain explicitly outside the MVP.
- Coach access is intentionally absent from global navigation. Eligible applicants/coaches use the conditional Profile entry and the protected coach workspace navigation.

## Completion and review references

- Completed: 2026-10-08.
- Commit: Included in `[DEV0147][DEV0148][DEV0149][DEV0150][DEV0151] Publish standalone scheduling platform`.
- Review: Self-review completed against every acceptance criterion; no independent review or pull request created.
- Deployment or release: Not deployed.
