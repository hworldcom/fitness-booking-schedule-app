# Ticket DEV0324: Default authentication return to Home

- Status: Completed
- Created: 2026-10-17
- Last updated: 2026-10-17
- Milestone: Authentication quality before UAT
- Coordination: [COR0027 — Login, registration and social authentication](../../current/organisatory/COR0027-login-registration-and-social-authentication.md)
- Related records: [DEV0286](../../current/backend/DEV0286-implement-password-authentication-and-recovery.md), [DEV0288](DEV0288-redesign-multi-method-login-and-registration.md), [DEV0322](../backend/DEV0322-remove-email-code-login.md).

## Objective and context

After testing registration through local Mailpit, the user requested landing on the main page instead of My sessions. Change the default authentication return to Home (`/`) in the [routes and continuation contract](../../../docs/mvp-spec.md#413-routes-profile-completion-and-returns). Required confirmation and name completion still run before registration finishes.

## Scope and non-goals

In scope: shared server/browser authentication fallback, saved default confirmation/recovery context, current specification and coordination/index alignment, existing regression/rehearsal updates. Out of scope: new interface design, Google/Apple, SMTP, hosted configuration/deployment, account changes and unrelated marketplace work.

## Expected behavior and edge cases

Opening registration or sign-in without a return destination ultimately lands on `/`. Required recovery/verification/profile completion and explicit coach application intent retain priority. Safe explicit internal destinations retain their path/query/fragment. Invalid, missing or lost context falls back to `/`. Existing email flows already issued with a saved explicit `/sessions` destination retain it; newly requested flows use the new default. No booking/message/invitation action is performed by authentication.

## Assumptions, decisions, and dependencies

2026-10-17 confirmed request: use the main page after registration for now. Adopt the same shared default for plain sign-in/recovery continuation so entry links do not reintroduce `/sessions` when switching between Sign in and Create account. Deliberate internal returns and coach intent are preserved. Existing local Auth implementation is available; no provider SDK integration changes or database migration are required. Read installed Next 16.3.8 navigation documentation before editing.

## Implementation plan

1. Replace duplicated `/sessions` defaults with Home in shared Auth route rendering, browser target and server continuation; retain the existing return sanitizer and priority order.
2. Update specification/coordination and existing tests/rehearsal to prove Home after default signup and password login, plus a deliberate internal return.
3. Run focused/full automated checks, real local Mailpit registration and desktop/mobile keyboard login, lint/type/format/build and documentation consistency checks. Record results and archive only after criteria pass.

## Acceptance criteria

- [x] AC1: Default signup, email confirmation and required name completion land on Home; default returning password login also lands on Home.
- [x] AC2: Explicit safe internal returns, coach-intent continuation, confirmation and restricted recovery remain intact; unsafe/missing returns resolve to Home.
- [x] AC3: Existing meaningful automated checks and real local desktop/mobile flows pass, with exact fixture cleanup and no unrelated data changes.
- [x] AC4: Current contract/index/coordination and durable implementation evidence agree; lint/types/format/build and scoped link checks pass.

## Validation plan

Extend existing return-sanitizer and browser navigation assertions and local real Auth rehearsal, using tagged local-only fixtures. Verify registration/confirmation/profile completion to `/`, password login to `/` at desktop/mobile widths with keyboard submission, deliberate return query preservation and existing recovery proof checks. Run npm test, test:auth, scoped Playwright, lint, typecheck, format:check, build and local document links. No schema change, so migration validation is not applicable. Mailpit proof does not demonstrate hosted delivery.

## Implementation record

### Changes and rationale

Changed the shared default from My sessions (`/sessions`) to Home (`/`). The server-rendered Auth route, browser screen and server operation continuation now use the same existing return sanitizer: a missing or invalid destination resolves to Home. Newly issued signup/resend/recovery flows save that destination. Confirmation still requires email ownership and name completion; coach intent retains its existing separate application action. Explicit internal return destinations continue to win after required onboarding.

### Affected files

- [Shared Auth route](../../../src/app/_auth/auth-page.tsx): supplies Home for direct entry and sanitizes explicit return context.
- [Auth screen](../../../src/features/auth/sign-in.tsx): carries Home across registration/sign-in/check-email/profile links and final browser navigation.
- [Server operations](../../../src/server/auth/supabase-operations.ts): stores the Home fallback in new email flows and uses it for password-update continuation when no saved context exists.
- [Return-policy checks](../../../tests/authorization.test.ts), [browser entry checks](../../../tests/browser/auth.spec.ts) and [real local rehearsal](../../../scripts/rehearse-local-email-auth.mjs): missing-return handling, entry-link continuity, default registration/mobile login, explicit My sessions query return and coach-intent destination.
- [Current specification](../../../docs/mvp-spec.md#413-routes-profile-completion-and-returns), direct coordination record, active DEV0286/DEV0288 notes and [index](../../README.md): current default, ownership and validation trail.

### Decisions and deviations

No deviations at start. Shared fallback applies to plain sign-in as well as registration to avoid conflicting default destinations across entry links.

### Contracts, configuration, and operations

Return default changes from `/sessions` to `/`; explicit destinations retain compatibility. No data/schema, dependency, credential or environment change. No migration, service restart or hosted deployment was performed. Previously issued flow context is retained. Reverting the three default-handling locations and the current specification would restore the previous default without data migration.

## Validation results

2026-10-17, local Docker Auth/Mailpit and the running app at localhost:3100; Node 24.21.0 / Next 16.3.8. Read installed App Router useRouter documentation before edits.

- `npm test`: passed the existing 239 unit and 27 server tests (266 total), including missing/unsafe return handling, protected authority and Auth boundaries.
- `npm run test:auth`: all seven real local Auth/Mailpit phases passed. Direct registration and email confirmation carried `returnTo=/`; desktop name completion landed on Home. Phone password login submitted with Enter landed on Home and retained the original profile. A deliberate `/sessions?section=requests` return and explicit coach-intent continuation were preserved. Existing recovery, wrong-browser/purpose/replay denial, two-device revocation, current-password change and passwordless-account/private-data continuity also passed. Exact fixture accounts were removed and existing profiles preserved. Evidence: ignored `tmp/email-auth-rehearsal/dev0286-9486eab3-d012-43d5-a3da-8e0f1d5ecc42/result.json` and desktop/mobile screenshots.
- `npm run lint`, `npm run typecheck`, `npm run format:check` and `git diff --check`: passed.
- `python3 /tmp/dev0324-check-docs.py`: scoped document links/anchors, 236 unique records, next IDs and completed lifecycle/membership verified after archival.
- `env DATABASE_URL= NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= NEXT_PUBLIC_SITE_URL= NEXT_PUBLIC_GEOAPIFY_API_KEY= npm run build`: passed. The first sandboxed compiler stopped making progress and was terminated (143); retry with local compiler process permissions compiled in 3.3 seconds and completed successfully. No source fix was needed.
- With the same empty configuration prefix, `npx playwright test tests/browser/auth.spec.ts tests/browser/authorization.spec.ts`: 6 passed, 2 configured-guest cases intentionally skipped in the configuration-free preview. Desktop 1440×1040 and phone 393×852 entry links carry Home; keyboard navigation, missing/recovery-link states and public browsing pass. Configured authority and real signup/login were exercised by the local Auth rehearsal above.
- No schema/migration check is needed because no database objects changed. No hosted provider settings, Gmail delivery, deployment or independent review was attempted.

| Criterion | Evidence | Result |
| --- | --- | --- |
| AC1 | Real desktop registration/confirmation/name completion and mobile keyboard returning login land on Home. | Passed |
| AC2 | Explicit My sessions query return, coach-intent destination, unsafe/missing returns and all existing recovery/proof checks pass. | Passed |
| AC3 | 266 unit/server tests, 7 real Auth phases, 6 browser checks; exact fixture cleanup and existing-profile preservation. | Passed locally |
| AC4 | Current contract/coordination/index, lint/types/format/build and final link/lifecycle check pass. | Passed |

## Risks, limitations, and follow-ups

Existing email flows keep their original stored destination; request a new confirmation if testing the new default. Google/hosted readiness remains in the linked open tickets. Deployment is separate.

## Completion and review references

- Completed: 2026-10-17 — shared Home fallback implemented and locally verified.
- Commit: User-requested integration checkpoint on 2026-10-18, subject `[DEV0288][DEV0324][DEV0325][DEV0328][DEV0329] Complete registration and authentication frontend`.
- Review: Changed-file and acceptance self-review passed; no independent review.
- Deployment or release: None.
