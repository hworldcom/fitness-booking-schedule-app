# Ticket DEV0157: Provision the persistent local test user

- Status: Completed
- Created: 2026-10-08
- Last updated: 2026-10-08
- Milestone: Scheduling-only developer experience
- Coordination: [COR0012 — Profile images](../organisatory/COR0012-profile-images.md)
- Related records: depends on completed [DEV0154 — Adopt the profile-image contract](../organisatory/DEV0154-adopt-profile-image-contract.md); supplies manual validation for [DEV0156 — Upload and present profile images](../frontend/DEV0156-upload-and-present-profile-images.md)

## Objective and context

Preserve one explicit local ordinary-user account, `hoang@users.movx.test`, so the user can sign in through local email capture and manually upload their own avatar. The current local database has no account with that email, and transient browser-test accounts are intentionally deleted after rehearsals.

## Scope and non-goals

- In scope: an idempotent, exact allowlisted local Auth/application-profile provisioner; integration with the supported local startup path or a clearly documented bounded command; conflict detection; README guidance; tests proving retries preserve the same account and no coach authority is granted.
- Out of scope: a password, production/staging user creation, a default picture, staff/operator/coach authority, weakening cleanup for unrelated disposable test accounts.

## Expected behavior and edge cases

- Local provisioning creates or preserves exactly `hoang@users.movx.test` with a completed ordinary-client profile and no coach application/access.
- Repeated startup/provisioning is idempotent and retains the same Auth/profile IDs and any avatar reference added by the user.
- A conflicting existing email/profile mapping fails closed rather than overwriting or taking ownership.
- Database reset may remove local Auth data; the supported provisioning/startup flow recreates the account without a picture and never affects hosted environments.

## Assumptions, decisions, and dependencies

- Use the display name `Hoang` unless the user later requests another value.
- Sign-in remains passwordless email OTP through Mailpit; no password is stored or documented.
- This is local developer fixture data, not a production account or product requirement.

## Implementation plan

1. Add the exact allowlisted client account and conflict/idempotency checks to a focused provisioner or generalized local-account module.
2. Integrate the provisioner with the supported local workflow without resetting data.
3. Add tests and README sign-in instructions, then prove retry stability and absence of coach authority.

The proposed scope is one local-development fixture and does not require splitting.

## Acceptance criteria

- [x] AC1: `hoang@users.movx.test` exists locally with a completed ordinary-client profile and no coach capability.
- [x] AC2: Repeated provisioning preserves identifiers and any user-added avatar reference.
- [x] AC3: Conflicting identity state fails without mutation, and hosted targets are rejected.
- [x] AC4: README documents passwordless login through Mailpit without publishing credentials or secrets.

## Validation plan

Run focused unit tests for allowlist/conflict logic, provision against the local Auth/database stack twice, compare identifiers and query coach-access state. If DEV0155/DEV0156 are complete, upload an avatar manually and prove another provision preserves it. Run lint/typecheck and relevant Auth rehearsals.

## Implementation record

Added one exact, local-only ordinary account for repeatable client testing. `npm run dev:local` now provisions `hoang@users.movx.test` after migrations/runtime-login preparation and before starting Next.js. The operation refuses non-loopback targets, reuses only the reserved Auth ID/email/metadata combination, enrolls one ordinary member profile when missing and otherwise makes no application-data update.

### Changes and rationale

- Reserved Auth ID `90500000-0000-4000-8000-000000000001` and exact email `hoang@users.movx.test`; the ID was chosen outside every SQL/TypeScript integration-test namespace.
- Added strict reusable-Auth and database-state validators. Reuse requires confirmed email plus the local-test metadata marker. The database must resolve to one active member in the active public demo run, with zero coach profiles and zero coach applications.
- Added idempotent provisioning with cleanup of a newly created Auth user if enrollment fails. Existing profiles, identifiers and `avatar_storage_path` are read but never updated.
- Integrated the provisioner into `npm run dev:local` and exposed `npm run auth:provision:test-user` for repair/troubleshooting.
- Documented passwordless Mailpit sign-in and reset behavior in README without adding a password, token or secret.

### Affected files

| File or component                                                                                             | Change and purpose                                                                                                   |
| ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `scripts/lib/local-test-user.ts`                                                                              | Defines the exact allowlist and pure Auth/database state validators.                                                 |
| `scripts/provision-local-test-user.ts`                                                                        | Creates/reuses the loopback-only Auth user, enrolls the ordinary profile and verifies no coach access.               |
| `scripts/start-local-development.ts`                                                                          | Runs the idempotent provisioner in the supported one-command startup.                                                |
| `package.json`, `README.md`                                                                                   | Adds the explicit command and passwordless Mailpit instructions.                                                     |
| `tests/local-test-user.test.ts`                                                                               | Covers exact Auth marker/email checks, ordinary-client state and avatar preservation in validation.                  |
| `tests/database/foundation.test.ts`, `supabase/tests/database/foundation.test.sql`, `coach-profiles.test.sql` | Keeps foundation tests valid after documented demo-coach account provisioning while still checking exact seeded IDs. |

### Decisions and deviations

- The provisioner does not seed the account through `supabase/seed.sql`: Auth owns the user row, and application enrollment remains the same security-definer path used for normal verified accounts.
- The script fails closed on an email/ID/metadata collision and never repairs by overwriting an unknown local identity.
- The ordinary account is integrated into normal startup because the user explicitly asked to keep it. Fictional coach accounts remain an opt-in separate command.
- The initially selected reserved ID overlapped a pgTAP identity-test namespace. It was removed immediately before user data existed and replaced with the collision-free `905…0001` ID; subsequent SQL and TypeScript suites pass together.

### Contracts, configuration, and operations

- New command: `npm run auth:provision:test-user`.
- `npm run dev:local` now starts Storage and provisions the account as well as Auth/PostgreSQL/Mailpit/runtime login.
- The account has no password. Sign-in remains email OTP through local Mailpit.
- A normal restart preserves Auth ID, application profile ID and avatar reference. `npm run db:reset` remains destructive and the next startup recreates a new empty application profile for the reserved Auth identity.
- No hosted account or environment variable is created; loopback Auth and PostgreSQL URLs are mandatory.

## Validation results

Validated on 2026-10-08 against the local Supabase Auth/PostgreSQL stack.

- Ran `npm run auth:provision:test-user` twice: both runs returned profile `hoang-905000000000` with the same profile ID `80f51db2-c1c6-449d-a9d6-7fd1eeaa90ff` and no avatar.
- During `PROFILE_IMAGE_TEST_SCOPE=account npm run test:profile-images`, uploaded a temporary avatar, reran the provisioner, and observed `Existing private avatar preserved`; the actor URL remained attached. The rehearsal then removed it so the user can add their own picture.
- Final database check showed the exact Hoang email with a null avatar reference, active member role, and no coach record/application. Daniel was restored to the fixture portrait separately.
- `npm test` passed 79 general tests plus 2 server tests, including two focused local-test-user assertions.
- `npm run test:db` passed all 34 database integration tests; `npm run db:test` passed 152 pgTAP checks.
- `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build` — passed.

| Criterion | Evidence                                                                                            | Result |
| --------- | --------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Provisioner database-state validation and final query prove one ordinary member with no coach data. | Passed |
| AC2       | Two stable-ID runs plus the live avatar-preservation rehearsal.                                     | Passed |
| AC3       | Pure collision/loopback tests and fail-closed provisioner checks.                                   | Passed |
| AC4       | README local email sign-in section documents the account, Mailpit and reset behavior.               | Passed |

## Risks, limitations, and follow-ups

The account is disposable local data even though it is persistent across normal startup. A deliberate database reset may remove a manually uploaded object/reference; the provisioner restores identity, not deleted media. Hosted targets remain untested because the command deliberately rejects them.

## Completion and review references

- Completed: 2026-10-08.
- Commit: Not created.
- Review: No independent review created.
- Deployment or release: Not applicable — local development only.
