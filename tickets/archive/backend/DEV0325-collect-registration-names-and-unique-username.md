# Ticket DEV0325: Collect registration names and unique username

- Status: Completed
- Created: 2026-10-17
- Last updated: 2026-10-18
- Milestone: Authentication quality before UAT
- Coordination: [COR0027 — Login, registration and social authentication](../../current/organisatory/COR0027-login-registration-and-social-authentication.md)
- Related records: [DEV0286](../../current/backend/DEV0286-implement-password-authentication-and-recovery.md), [DEV0288](../../current/frontend/DEV0288-redesign-multi-method-login-and-registration.md), independent account baseline [DEV0295](../../current/frontend/DEV0295-refine-account-names-and-section-navigation.md), deferred username uses [DEV0296](../../current/organisatory/DEV0296-define-username-login-and-profile-url-contract.md), DEV0324 (separate pending commit).

## Objective and context

The user requested username, full name and display name during registration, with usernames stored uniquely. Replace the name-only post-confirmation step in the [registration contract](../../../docs/mvp-spec.md#413-routes-profile-completion-and-returns). Reuse the existing account username column/unique constraint instead of creating a second handle registry.

## Scope and non-goals

One registration slice: required three-field input, shared/server validation, atomic enrollment/private-details storage, bounded username-taken recovery, additive database function, meaningful concurrency/privacy/flow tests and current documentation. Existing profiles retain IDs, names, coach status and private data and are not forced through new enrollment. No username login/profile URLs, public username directory/availability endpoint, provider rollout, general Account redesign, legal-name verification or hosted deployment. Existing optional Account username edits remain compatible.

## Expected behavior and edge cases

Email/password and confirmation remain first. A new confirmed account then chooses username, private full name and display name before a profile is created. Username uses the existing canonical lowercase 3–30 ASCII letters/digits/underscores, starting with a letter; normalize whitespace/case and a leading @. A database unique constraint arbitrates all claims, including Account edits. Taken/invalid names do not leave a partial profile, participation or private-details row. The UI retains drafts and permits retry. Exact repeat/concurrent completion for one identity returns its original profile without rewriting stored names. New completion keeps the Home fallback and explicit return/coach intent.

Full name reuses private `legal_name` storage as self-declared name, with no verification claim. Display name is not unique and remains distinct from full name and username. The confirmed presentation behavior is to initialize the existing preferred chat name with the chosen display name; this does not rewrite existing users or public coach branding. The user confirmed this privacy/presentation setup through the asynchronous clarification.

## Assumptions, decisions, and dependencies

Confirmed: collect all three fields; usernames must be unique. Adopt existing username syntax/normalization, existing 2–80-character name bounds and post-confirmation collection to avoid storing unverified registration drafts. Reuse existing owner-only account storage and database constraint; keep UUIDs as internal identity keys and coach slugs unchanged. Retain historical two-argument enrollment helper for trusted fixtures/compatibility; the public enrollment endpoint requires exactly the three new fields and uses a new atomic function. No browser-side-only uniqueness promise. New signup cannot claim a handle until confirmed enrollment commits. Existing account username edits/release policy remains under DEV0295/DEV0296, without implying username authentication.

## Implementation plan

1. Add strict typed registration-profile input and bounded completion results, including username-taken, without expanding identity read payloads to include private fields.
2. Add one security-definer enrollment overload which serializes same-account retries, uses the original profile enrollment, stores the private names/username atomically, and rolls back the whole operation on conflicting handles. Reuse existing constraints and authorization boundaries.
3. Wire server repository/service/route and browser profile completion form; preserve incomplete/recovery authority gates, Home/explicit returns and submitted drafts.
4. Extend meaningful validation and actual local Auth/Mailpit rehearsal for required fields, taken-name retry, exact persistence/privacy and existing-account continuity. Rehearse additive migration in rollback, apply only to local retained data with ledger/fingerprint checks, then run focused DB/concurrency, automated, desktop/mobile keyboard, lint/types/format/build and documentation checks.

## Acceptance criteria

- [x] AC1: A new confirmed account must provide valid username, full name and display name; completion preserves Home/explicit coach and return behavior. Existing completed accounts remain unchanged.
- [x] AC2: Canonical usernames are globally unique across signup/Account writes; simultaneous claims have one winner and no partial loser profile. Same-account retries return the original identity without overwriting its data.
- [x] AC3: Full name/username stay owner-only; display name is nonunique and other people never receive raw full-name/username fields from identity/actor/chat projections. Recovery/unconfirmed sessions cannot enroll.
- [x] AC4: Real desktop/mobile keyboard completion/error/retry, meaningful parser/API/DB/recovery tests and exact fixture cleanup pass; migration/contract/operations and validation evidence are recorded.

## Validation plan

Existing unit/identity/route checks plus actual database concurrent username claims, rollback/no-partial-state, idempotency, privilege and owner-only reads. Extend the guarded local Auth/Mailpit rehearsal with three-field signup and taken-name retry and check both mobile/desktop form behavior. Run npm test, relevant database suites, test:auth, lint/typecheck/format/build and link/lifecycle checks. No hosted provider/migration operation or real-user edit is implied.

## Implementation record

### Changes and rationale

New confirmed accounts now supply username, private full name and visible display name together. The public operation accepts exactly those fields, canonicalizes the handle using the existing Account policy and does not create an application profile until all fields are valid. A new atomic enrollment overload reuses the original profile/participation helper, saves private full name/handle and initializes the preferred chat-name override from display name. The existing global unique constraint arbitrates registration and Account claims. Conflict rolls back the entire new enrollment; the API returns only `username-taken` (409), and the form keeps all drafts for retry.

An advisory transaction lock serializes completion for the same Auth subject. Retries return the existing profile without rewriting names/private details or public coach branding. The function restores its temporary row-security context on success/failure. GET identity and actor projections remain unchanged and never include private full-name/username fields. Existing enrolled users skip the new form and keep their data; username login and profile URLs remain deferred.

### Affected files

- [Registration input](../../../src/auth/registration-profile.ts) and [identity contracts](../../../src/auth/identity-contracts.ts): required normalized fields, strict keys/controls and separate bounded completion results, without widening identity reads.
- [Migration](../../../supabase/migrations/20261017001000_registration_profile_details.sql) and [identity repository](../../../src/server/db/identity/repository.ts): atomic overload, same-account locking, existing-identity preservation and specific unique-constraint error mapping.
- [Identity service](../../../src/server/identity/service.ts), [API](../../../src/app/api/auth/identity/route.ts), [browser transport](../../../src/auth/client/identity-client.ts) and [profile form](../../../src/features/auth/sign-in.tsx): verified session boundary, three-field POST, private-name explanations, autofill, draft retention/error focus and final continuation.
- [Database tests](../../../tests/database/registration-profile.test.ts), [input tests](../../../tests/identity.test.ts), route tests (`tests/server/registration-profile-route.test.ts`, separate pending Auth-interface commit) and [Auth boundary checks](../../../tests/supabase-auth-config.test.ts): race/rollback/retry/privacy/privilege/input evidence.
- [Local Mailpit rehearsal](../../../scripts/rehearse-local-email-auth.mjs): real desktop/phone fields, missing/taken-name recovery, canonical save, owner-only read, unconfirmed/recovery denial and exact cleanup. Its reserved-handle fixture is included in the bounded interruption-cleanup manifest. [Hosted calendar rehearsal](../../../scripts/rehearse-hosted-coach-calendar.mjs) receives only the necessary request-shape compatibility update; it was not run against hosted services.
- Root README, [database operations guide](../../../supabase/README.md#password-authentication-rollout), [specification](../../../docs/mvp-spec.md#413-routes-profile-completion-and-returns), ticket index, COR0027 and active Auth/Account/username records: adopted behavior, release order and independent follow-up boundaries.

### Decisions and deviations

2026-10-17: initially proceeded with the stated proposed default while awaiting the optional clarification; the user subsequently explicitly confirmed this setup: self-declared full name remains private; new enrollment initializes the existing preferred chat-name override with the chosen display name. Existing users and later explicit Account preferences are preserved. No new public profile/username projection. Preserve unrelated Home-return and marketplace working changes.

### Contracts, configuration, and operations

POST `/api/auth/identity` input is now `{username, fullName, displayName}`; old display-only requests fail without enrollment. GET identity remains private-field-free. Forward migration `20261017001000_registration_profile_details.sql` adds only `app.enroll_application_identity(uuid,text,text,text)`; existing data/columns and username uniqueness constraint are retained. Install the migration before the matching application release. The legacy two-argument helper remains available only through the prior trusted-server/fixture boundary; the public POST no longer supports display-only enrollment. No dependency/environment/credential changes. The migration was installed only on retained local Docker data after rollback rehearsal; no hosted migration/configuration/deployment occurred. Rollback requires compatible frontend/server inputs and reviewed function grants; leave private account data and the existing unique constraint intact.

## Validation results

2026-10-17, Node 24.21.0, Next 16.3.8, existing local Docker/Auth/Mailpit and localhost:3100. Read bundled Route Handler documentation before integration edits.

- `node /tmp/dev0325-install.mjs`: passed rollback-only function creation/removal rehearsal, exact 12-version prior ledger check, local `supabase migration up --local`, new 13-version ledger check and identical original profile/private-account/Auth row fingerprints. Installed SHA-256: `c1c30ce0a20dc9fe886ea7121e5bc0f4d1b8fce106e013a0b1ff02ebf8eda8a7`. No reset/backfill/seed or hosted call.
- `npm test`: 240 unit and 28 server tests passed (268 total). New checks reject old display-only, missing/invalid/authority-bearing input and private details on bounded completion results.
- `DATABASE_TEST_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres node --import tsx --conditions=react-server --test --test-concurrency=1 tests/database/registration-profile.test.ts tests/database/identity.test.ts tests/database/account-settings.test.ts tests/database/application-auth.test.ts`: 25 passed. Actual concurrent canonical claims have one winner; loser has no profile and can retry. Same-account concurrent completion/retries preserve exact profile/private values. Bounds, direct-write denial, private reads, function privileges, pool context restoration, existing Account races/chat-name projections and recovery/session restrictions pass. Exact committed test identities/rows removed; transactional fixtures rolled back.
- `npm run test:auth`: all seven real local Auth/Mailpit phases passed. Unconfirmed/recovery sessions could not enroll. Desktop completion showed all three required fields; missing input failed. A real taken-handle response retained full/display names and left no profile. At 393×852, error focus/no horizontal overflow were verified and keyboard Enter completed the retained draft with a differently cased/@-prefixed available handle. Home remained the final destination. Exact private storage/owner read and private-field absence from identity/actor were checked. Returning login, explicit My sessions/coach returns, reset/change/two-device revocation, existing passwordless/private-data continuity and removed-code denial also pass. Exact Auth/profile/private/Storage fixtures were cleaned and existing profiles preserved. Evidence: ignored `tmp/email-auth-rehearsal/dev0286-4e1ad891-3a5a-4552-ae9f-9c25e8eabec7/result.json` plus desktop/mobile completion/error screenshots, visually inspected with no clipping/overlap in the form.
- Configuration-free `env DATABASE_URL= NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= NEXT_PUBLIC_SITE_URL= NEXT_PUBLIC_GEOAPIFY_API_KEY= npm run build`: passed compile, TypeScript and all 23 static pages with local compiler permissions. With the same empty configuration prefix, `npx playwright test tests/browser/auth.spec.ts tests/browser/authorization.spec.ts`: 6 passed, 2 configured-guest cases intentionally skipped; real configured Auth was checked above.
- `npm run lint`, `npm run typecheck` and the initial `npm run format:check`: passed. Later whole-tree format checks reported concurrent navigation changes under independent DEV0326: `src/components/account-shell.tsx`, `src/features/coaches/coach-workspace-navigation.tsx`, `tests/account-menu.test.ts`, `tests/browser/public-story.spec.ts`, `tests/coach-schedule.test.ts` and `tests/shell-navigation.test.ts`. They were preserved. After that independent work formatted its files, the final `npm run format:check` passed for the whole repository. Focused Prettier on all 13 changed source/test/rehearsal files and `git diff --check` passed. `node scripts/database-baseline.mjs verify`: all 53 original migration checksums and baseline checksum unchanged.
- `python3 /tmp/dev0325-check-docs.py`: 17 scoped documents, local links/anchors, unique IDs, next ID and completed lifecycle/membership checked after archival. Hosted calendar execution, real inbox delivery, provider/Google readiness, deployment and independent review were not run/claimed.

| Criterion | Evidence | Result |
| --- | --- | --- |
| AC1 | Real confirmed three-field signup, required-field/error recovery, Home/explicit returns and returning identity continuity. | Passed locally |
| AC2 | Actual canonical username races, no loser profile, available-handle retry, same-account serialization and existing-value preservation. | Passed |
| AC3 | Exact private storage/owner read, unchanged identity/actor shape, chosen chat projection, raw field isolation and unconfirmed/recovery denial. | Passed |
| AC4 | 268 unit/server tests, 25 DB checks, 7 real Auth phases, 6 browser checks, migration/cleanup/build and scoped static/docs checks; temporary unrelated global-format findings resolved by the owning work; final whole-tree formatting passed. | Passed for this slice |

## Risks, limitations, and follow-ups

The user confirmed full-name privacy and display-name presentation, including chats. Username login, public URL audience and rename/reuse/alias rules remain DEV0296 work. Existing enrolled accounts may still have optional/absent usernames and full names.

## Completion and review references

- Completed: 2026-10-17 — three-field registration and atomic unique username claim implemented and locally verified.
- Commit: Backend prerequisite checkpoint under `[DEV0325] Add atomic registration profile enrollment`; remaining Auth interface changes are separate.
- Review: Changed-file/acceptance self-review passed; no independent review.
- Deployment or release: None.


### 2026-10-18 commit checkpoint

The DEV0331 URL commit needs the existing atomic registration overload and its real database tests. This prerequisite commit includes only the normalized registration input, identity repository overload/error mapping, forward migration and database regression test. It adds no public API/form change: the original two-argument enrollment entry point remains compatible. The already validated three-field API/form and optional picture work remain in the shared working tree for their separate Auth commit. The completion evidence above describes that complete local implementation, not the contents of this backend checkpoint. No navigation/demo-maintenance changes or private configuration are included.


### Commit-tree validation — 2026-10-18

The backend checkpoint and following DEV0331 changes were exported over `d6ba036` (the completed DEV0337 demo-preservation commit), with pending Auth interface/photo/navigation changes excluded. The exact stacked tree passed 273 unit and 45 server tests (318), 77 fresh/upgrade database checks including the registration regression, lint, Prettier, the ordinary `npm run typecheck` and a configuration-free webpack production build under Node 24.21.0. Validation used `npm --prefix /tmp/dev0331-commit-prep/validation ...` from the project runtime; an initial invocation from outside the project selected Node 20 and failed runtime-dependent tests, then the corrected Node 24 run passed. No private environment/credential files or retained demo data were included or changed.
