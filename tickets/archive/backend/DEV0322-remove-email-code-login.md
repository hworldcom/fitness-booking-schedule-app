# Ticket DEV0322: Remove email-code login

- Status: Completed
- Created: 2026-10-17
- Last updated: 2026-10-17
- Milestone: Authentication quality before UAT
- Coordination: [COR0027 — Login, registration and social authentication](../../current/organisatory/COR0027-login-registration-and-social-authentication.md)
- Related records: [DEV0286](../../current/backend/DEV0286-implement-password-authentication-and-recovery.md), [DEV0288](../../current/frontend/DEV0288-redesign-multi-method-login-and-registration.md), [DEV0289](../../current/backend/DEV0289-rehearse-multi-method-authentication-for-uat.md); independent [DEV0323 account inventory](DEV0323-remove-requested-registration-test-account.md).

## Objective and context

The user explicitly requested removing email-code login before testing email/password registration. Retire the previously adopted existing-account code fallback throughout the application while preserving confirmation/reset email links and exact account identities. Update the [current authentication contract](../../../docs/mvp-spec.md#41-register-as-an-athlete-or-apply-to-coach).

## Scope and non-goals

In scope: remove visible code entry and request/verify command/gateway/adapter/server support, reject old login-purpose proof flows, update method readiness, tests, local rehearsal/setup guidance and current planning. Existing passwordless accounts use verified password setup through Forgot password. Retain historical migration/archived evidence unchanged. No Google/Apple setup, hosted Auth policy change, production deployment or general account deletion. Requested account inventory/removal belongs to independent DEV0323; the account was absent and the user confirmed no deletion needed.

## Expected behavior and edge cases

Sign in accepts email/password. Registration, resend confirmation, forgot/reset/set password and current-password change continue working. Google remains truthfully unavailable pending DEV0287. Crafted request-code/verify-code/magiclink commands cannot create an application session. Old server-stored login flows cannot be accepted. Existing passwordless identities retain the same subject/profile/private data when setting a password. Invalid request bodies use generic input copy rather than prompting for a removed code feature.

## Assumptions, decisions, and dependencies

2026-10-17 confirmed user choice supersedes the previous through-UAT fallback requirement. Removing application login support does not require replacing Supabase's managed email proof API, which still verifies signup/recovery token hashes. Provider-issued raw tokens cannot acquire application authority without the existing session registry. Historical login-purpose table values may remain inert; avoid destructive migration/history edits. Local Docker is the current running application target; real SMTP versus captured Mailpit delivery must be described accurately.

## Implementation plan

1. Remove code UI/state and public command/gateway methods; narrow email proof acceptance to signup/recovery, rejecting persisted legacy login purposes.
2. Remove obsolete code-only utilities/templates where unused; retain normal email normalization and required recovery verification.
3. Update real rehearsal to prove passwordless setup directly through recovery, old-command/proof rejection and preserved private data; update active contract/peers/guides.
4. Run meaningful parser/route/gateway tests, actual local Auth/Mailpit registration/reset/setup, desktop/mobile keyboard checks, lint/types/format/build and document exact results.

## Acceptance criteria

- [x] AC1: No code-login action/input is shown; old code and magiclink commands/proofs are rejected server-side without application authority.
- [x] AC2: Password registration/confirmation/login/reset/change and passwordless setup preserve existing subject/profile/private data in real local Auth checks.
- [x] AC3: Current specification, direct coordination map, active peers, method status and setup/test guidance consistently describe the removed fallback; historical records/migrations remain intact.
- [x] AC4: Focused/full regression checks, desktop/mobile keyboard flow, lint/types/format/build and durable implementation record pass.

## Validation plan

Closed-command/parser and API tests for removed operations; local real Auth/Mailpit rehearsal with exact fixture cleanup; desktop/mobile sign-in UI and keyboard recovery assertions. Existing SQL session/recovery checks, npm test, lint, typecheck, format:check and production public-preview build. No hosted SMTP/provider delivery claim from Mailpit proof.

## Implementation record

### Changes and rationale

Removed the email-code button/form/state, request/verify commands, gateway/adapter methods, server credential calls and method-readiness flag. Signup/recovery token-hash verification remains. Both parser and server purpose checks reject retired magiclink/code flows, including a server-stored legacy login flow. Error copy no longer prompts for a removed six-digit code. Shared email normalization moved to `src/auth/email.ts`; obsolete OTP input/error utilities were removed.

Existing passwordless users now use Forgot password to prove ownership and set a password on the same identity. The real rehearsal prepares existing private data without relying on the retired login path, then verifies exact subject/profile/private details/avatar bytes/message continuity through recovery setup. Current requirements, coordination, open peers and developer startup guidance reflect the explicit user change.

The local legacy-provider email template now gives password/reset guidance without including a code or login proof. It prevents an older/direct provider client request from sending a misleading working-code message; it does not disable password signup or recovery. The previous unreferenced template is retained only for historical evidence, with no active configuration reference. A real raw managed magiclink session was also denied application session/enrollment authority by the existing registry.

### Affected files

- [Auth view](../../../src/features/auth/sign-in.tsx), [gateway](../../../src/auth/gateway.ts), [commands](../../../src/auth/operations.ts), [browser adapter](../../../src/auth/client/supabase-auth-adapter.ts), [server operations](../../../src/server/auth/supabase-operations.ts) and [repository](../../../src/server/db/auth/repository.ts): removal and purpose restrictions.
- [Methods endpoint](../../../src/app/api/auth/methods/route.ts), [operation endpoint](../../../src/app/api/auth/operations/route.ts), [email normalizer](../../../src/auth/email.ts) and [session verifier](../../../src/server/auth/session.ts): no code readiness, generic invalid input and retained email/session verification. Two archived tickets receive path-only link maintenance for the moved normalizer; their historical evidence is preserved.
- [Local config](../../../supabase/config.toml), [password guidance template](../../../supabase/templates/password-sign-in.html), root README, [database guide](../../../supabase/README.md), test-user/coach provisioner messages and current Auth planning: correct setup/compatibility guidance.
- [Real rehearsal](../../../scripts/rehearse-local-email-auth.mjs), [browser checks](../../../tests/browser/auth.spec.ts), parser/gateway/adapter/route/config tests: rejection of removed behavior while retaining registration/recovery.

### Decisions and deviations

2026-10-17: the user explicitly removed the fallback before UAT, so the former through-UAT retention condition is superseded. Historical SQL migration values remain; the application rejects their login purpose. The old template remains an unreferenced historical asset rather than rewriting its evidence. Independent account inventory found no match; the user confirmed no deletion needed under DEV0323.

### Contracts, configuration, and operations

Removed request-code/verify-code/magiclink from application commands, corresponding gateway methods and the emailCode readiness field; invalid input now uses the generic input result. Existing callers must use password login or verified setup. No dependency, credential, environment variable or schema/migration change. No accounts or private data were reset. Local services were stopped/restarted with retained data to load the updated legacy-request template; Auth health returned 200. Hosted provider settings/SMTP/production were not changed. Rolling back would intentionally reintroduce the withdrawn feature and requires a reviewed product decision; password/recovery authority must remain intact.

## Validation results

2026-10-17, Node 24.21.0 / Next 16.3.8 / Supabase JS 2.116.0 and SSR 0.12.7. Read installed Next route/cookie guidance and relevant SDK proof/admin entry points before integration edits.

- `npm test`: **239 unit + 27 server tests passed (266 total)**. Removed request/verify/magiclink commands receive 400 before credentials/database work; ordinary password/gateway verification, bounded failures and source boundaries pass. Two obsolete OTP-only tests were removed rather than pretending the removed feature still works.
- `npm run test:auth`: **all seven real local Auth/Mailpit phases passed**, including new registration/confirmation, returning password login, recovery restriction and two-device revocation, change-password current-secret checking, direct password setup for an existing passwordless account with exact private-data continuity, generic unknown recovery/duplicate signup, removed-command rejection and persisted legacy login-purpose denial. Exact fixtures were removed and pre-existing profile fingerprints preserved. Evidence: ignored `tmp/email-auth-rehearsal/dev0286-9bc0e2e3-2984-4343-9520-14982053fdf5/result.json` and screenshots.
- `node /tmp/dev0322-retired-provider-check.mjs`: actual older/direct provider email request delivered the new password guidance with no code/token/login-proof link. A real managed magiclink session remained signed-out at the application session endpoint and could not enroll (401). Exact temporary local account removed. The first probe used an unsupported direct SSR module import and failed before creating a fixture; using the installed package entry point resolved it.
- `npx playwright test tests/browser/auth.spec.ts tests/browser/authorization.spec.ts`: **6 passed, 2 configured-guest cases intentionally skipped** in the configuration-free production preview. Desktop 1440 px and phone 393 px prove absence of code controls, password/registration/recovery navigation and keyboard access. Configured authorization is exercised by the actual local rehearsal above.
- `npm run lint`, `npm run typecheck`, `npm run format:check` and `git diff --check` passed. `env DATABASE_URL= NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= NEXT_PUBLIC_SITE_URL= NEXT_PUBLIC_GEOAPIFY_API_KEY= npm run build` passed without hosted access. `DATABASE_TEST_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres node --import tsx --conditions=react-server --test tests/database/application-auth.test.ts`: 5 passed. `python3 /tmp/dev0322-check-docs.py`: 13 scoped documents, 550 local links/anchors and 235 unique records passed, including completed archival, reciprocal coordination membership and next IDs DEV0324/COR0029.
- Real Gmail delivery was not attempted: the running app targets local Docker and captures email in Mailpit. The user will test registration; real inbox delivery needs an explicitly configured SMTP/hosted target. Google/hosted readiness remains outside this removal ticket.

| Criterion | Evidence | Result |
| --- | --- | --- |
| AC1 | No UI/commands; parser/route, persisted legacy purpose and real provider-only session denial pass. | Passed |
| AC2 | All seven real registration/recovery/setup/change/continuity phases pass with exact cleanup. | Passed locally |
| AC3 | Active contract/coordination/peers/guides updated; migration history untouched and prior evidence retained. | Passed |
| AC4 | Unit/server/live/browser/lint/types/format/build and documented checks pass. | Passed |

## Risks, limitations, and follow-ups

Google and hosted readiness remain independently owned; this ticket does not complete DEV0286–DEV0289. Local Mailpit proof is not Gmail delivery. Independent DEV0323 verified the requested account absent; the user confirmed no deletion needed.

## Completion and review references

- Completed: 2026-10-17 — email-code login retired; verified password flows retained and tested.
- Commit: Included in this DEV0322/DEV0323 task change; no deployment implied.
- Review: Implementation/acceptance self-review with actual local/provider/browser validation; no independent review.
- Deployment or release: None.
