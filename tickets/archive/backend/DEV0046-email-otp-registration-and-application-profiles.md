# Ticket DEV0046: Email OTP registration and application profiles

- Status: Completed
- Created: 2026-09-21
- Last updated: 2026-10-14
- Milestone: Prioritized identity and onboarding
- Coordination: None — independent development ticket
- Related records: implements the [account model in the current actors and authority contract](../../../docs/mvp-spec.md#3-actors-and-authority); follows completed DEV0048 — Remove gym membership access

> Documentary pruning — 2026-10-14, [DEV0225](../organisatory/DEV0225-remove-blockchain-historical-evidence.md): superseded feature evidence and deleted-reference details were removed at the user’s request. Retained text records the independent outcome at its original date. Code/data fragments are historical excerpts, not complete current contracts; aggregate test totals remain totals of the original runs, not new retained-only validation. Original completion dates remain unchanged. Earlier revisions remain in Git history.

## Objective and context

Let anyone create and recover a RepX Club application account with a verified email one-time password (OTP). After verification, the person completes a minimal profile and becomes an ordinary participant in the active application dataset. This is application access, not gym membership. Account login and application profile remain separate records.

On 2026-09-21 the user accepted account-first registration as the next priority and selected the defaults recorded below.

## Scope and non-goals

- In scope: open email-OTP registration/sign-in, generic anti-enumeration responses, local Mailpit and hosted SMTP guidance, minimal display-name onboarding, atomic creation of one user-sourced profile and ordinary dataset participant, verified sessions, email recovery, local cutover, tests and documentation.
- Out of scope: passwords, social/phone providers, passkeys, organization/admin/staff/trainer assignment, gym entitlement, automatic account merging and hosted support-assisted recovery.

## Expected behavior and edge cases

A visitor enters an email address and receives a six-digit code. The request response is the same whether the email is new or already registered. A valid code creates or restores the Supabase session. A first-time session remains in a bounded `profile-required` state until the person submits a display name; it has no protected product authority yet.

Profile completion runs once on the server. It creates one `record_source = 'user'` profile, a stable unique server-generated slug and one active ordinary-member participation record for the configured active application dataset. Retries return the same profile. Browser-supplied role, dataset, organization, venue or fixture identifiers are ignored. No signup path grants operator, organization, staff or trainer authority.

After profile completion, DEV0040's protected actor context derives from the verified Auth subject, claimed profile and active dataset participation.

Expired, incorrect, replayed or rate-limited codes fail without creating a profile. Cancelling or losing the browser flow preserves public browsing. Sign-out removes protected access. Email access is the first-release recovery mechanism; loss of both the session and email account has no automated recovery path in this slice.

No generic production account-merging or dual-subject migration system is built for data that has never been deployed.

## Assumptions, decisions, and dependencies

Confirmed by the user on 2026-09-21:

- email OTP is the only initial registration and login method;
- first login creates an ordinary application dataset participant after minimal profile completion;
- no automatic identity or account merging is allowed;
- Google/Apple login and passkeys are later refinements;
- DEV0046 was selected as the next implementation priority.

Use the installed Supabase Auth and server-rendered cookie boundary. Local codes use Supabase's test mail server. Hosted use requires selected project/origin configuration and a real SMTP provider before release; provider selection and deployment are operational follow-ups, not permission to embed credentials.

`demo_run_memberships` remains an internal dataset-participation/role table despite its historical name. It is not a gym membership or paid entitlement. Completed DEV0048 removed the separate gym-membership capability.

This ticket preserves its DEV0046 identity and commit history while narrowing to the first concrete implementation slice.

## Implementation plan

1. Document local email capture and hosted SMTP/origin prerequisites.
2. Preserve cookie refresh, sign-out, expiry and no-store behavior.
3. Add the atomic open-profile enrollment capability and schema adjustments required for user-sourced profiles and ordinary dataset participation. Generate stable unique slugs server-side and accept no authority metadata from the browser.
4. Add email/code/profile UI states, safe return handling, cancellation/retry/rate-limit copy and accessible desktop/mobile behavior.
5. Apply the documented local reset/cutover and add unit, Auth integration, database concurrency, authorization and browser tests with at least two email accounts.

## Acceptance criteria

- [x] AC2: A returning verified email restores the same Auth subject/profile; retries and simultaneous profile completion cannot create duplicates.
- [x] AC3: New, existing, malformed, rate-limited, expired and incorrect-code requests use bounded responses that do not reveal account existence or grant partial application authority.
- [x] AC7: Local email delivery, hosted SMTP/origin requirements, environment variables, rollback/reset behavior are documented without secrets.
- [x] AC8: Database/Auth integration, concurrency, unit/boundary, lint, typecheck, build and responsive keyboard-accessible browser tests pass with exact evidence recorded here.

## Validation plan

Use local Supabase Auth/Mailpit with two new emails, one returning email, invalid/expired/replayed codes and simultaneous profile-completion attempts.

Rehearse signup, code entry, profile completion, reload, sign-out, return navigation and cancellation at desktop and mobile widths. Run focused Auth/database tests plus the full relevant unit, boundary, lint, typecheck, formatting, production build and browser suites.

## Implementation record

Implementation completed on 2026-09-21. The retained changes and validation below describe that original outcome; documentary pruning runs no new application checks.

### Changes and rationale

The personal entry path now requests a six-digit Supabase email code, verifies a confirmed email identity, asks first-time users for a display name and creates a minimal application identity. The signed-in session and application profile are separate contracts. Header/session presentation uses the verified email.

Migration `20260921000400_create_email_application_identity.sql` adds narrow owner-only enrollment policies, creates idempotent `current_application_identity` and `enroll_application_identity` functions. Enrollment selects the sole active public dataset on the server, generates a stable unique profile slug, creates only a `record_source = 'user'` profile and ordinary active `member` participation, and creates no gym entitlement. Existing unique constraints make simultaneous calls converge without a broad update policy.

The verified protected actor now derives from the confirmed email Auth subject, claimed user profile and active dataset participation. It retains DEV0040's transaction-local row-level-security context and fail-closed route behavior with confirmed email identity. The browser identity endpoint accepts only exact bounded JSON containing `displayName`; dataset, profile, role, organization and venue authority remain server-derived.

The local Auth profile now enables the email provider, renders a checked-in six-digit OTP template and starts Mailpit for captured development delivery. A new browser rehearsal creates two distinct accounts, rejects an incorrect and a replayed code, verifies isolated profiles/actors, signs out, restores the first profile and checks mobile overflow. Local runtime-role preparation is restart-safe.

### Affected files

| File or component                                                                                              | Change and purpose                                                                                                             |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `supabase/config.toml`, `supabase/templates/email-otp.html`                                                    | Enables local six-digit email OTP capture and supplies the matching email template.                                            |
| `src/auth/email-otp.ts`, `src/auth/contracts.ts`, `src/server/auth/session.ts`                                 | Normalizes bounded email/code input and verifies a confirmed email identity before exposing the public session snapshot.       |
| `src/features/auth/sign-in.tsx`, `src/app/sign-in/page.tsx`, `src/app/globals.css`                             | Implements request, verify, first-profile, enrolled, retry, failure and sign-out states with labelled forms and mobile layout. |
| `src/app/api/auth/identity/route.ts`, `src/server/identity/service.ts`, `src/server/db/identity/repository.ts` | Provides the same-origin, display-name-only HTTP boundary and server/database identity workflow.                               |
| `src/server/authorization/*`, `src/server/db/authorization/repository.ts`, `src/auth/actor-state.ts`           | Preserves server-derived actor validation, row-level security and session-generation isolation.                                |
| `scripts/rehearse-local-email-auth.mjs`, `scripts/prepare-local-runtime-database.mjs`, `package.json`          | Adds repeatable real local Auth/Mailpit browser evidence and makes runtime-role setup safe to rerun.                           |
| `tests/`, `supabase/tests/database/`                                                                           | Adds email/session/profile/concurrency/isolation checks and keeps seed tests valid after user registration.                    |
| `.env.example`, `README.md`, `supabase/README.md`, `docs/mvp-spec.md`                                          | Documents account-first setup, local captured mail, hosted requirements, reset behavior, current status .                      |

### Decisions and deviations

2026-09-21: the first enrollment function draft used `SELECT ... FOR UPDATE`, but forced row-level security hid rows because no broad update policy exists. The locks were removed before completion; existing unique Auth-subject/profile/participation constraints and conflict-safe inserts provide the required concurrency behavior without expanding runtime update authority.

2026-09-21: foundation seed tests originally counted every profile and failed after the real Auth rehearsal created users. They now count only `record_source = 'fixture'`, preserving deterministic seed evidence while allowing real user profiles to coexist.

### Contracts, configuration, and operations

The signed-in public session shape is `{ status, subject, email, expiresAt }`. The enrolled identity and actor shapes contain the profile, dataset and ordinary role. `POST /api/auth/identity` accepts exactly `{ "displayName": string }`; GET and POST remain private/no-store and return bounded public states.

`PREPARED_PERSONAL_IDENTITIES_JSON` is removed. Local runtime requires only `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `NEXT_PUBLIC_SITE_URL`; `.env.local` stays ignored. `auth:start` now includes Mailpit. Hosted use still needs a selected Supabase project, allowed origins, custom SMTP, abuse controls and deployment secrets; none was provisioned here.

The new migration is forward-only: it removes obsolete prepared enrollment functions/policies and replaces the actor validation function. The checked-in local reset deliberately recreates disposable Auth/application data; no hosted migration or production account merge occurred. A later correction to a deployed environment must use a new migration rather than rewriting this one. No OTP, private key, recovery phrase or private Supabase key was recorded.

## Validation results

Validation completed on 2026-09-21 with Node.js 24.21.0, Supabase CLI 2.117.0, the isolated local stack, Mailpit and installed Google Chrome.

| Criterion        | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Result |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1–AC6          | `npm run db:reset` replayed all five migrations and the seed from a clean disposable database. `npm run db:test` passed 66 pgTAP assertions. `npm run test:db` passed 9 Drizzle/runtime tests, including direct-write denial, simultaneous enrollment, idempotent retry, fixture conflict rollback, ordinary role and alternating-account RLS isolation.                                                                                                                                                                      | Passed |
| AC1–AC3, AC5–AC6 | `npm run test:auth` passed against the configured production app, local Supabase Auth/database and Mailpit: two new emails, one returning email, incorrect-code and used-code replay rejection, one profile per account, email-authorized actors, sign-out denial, desktop plus mobile width and no browser errors/overflow. One cold local Auth request initially exceeded 30 seconds; a bounded direct probe returned HTTP 200, the rehearsal wait was raised to 60 seconds, and two subsequent complete rehearsals passed. | Passed |
| AC3–AC5          | `npm test` passed 38 unit/boundary tests covering bounded error copy, malformed email/code input, verified-email session shape, exact identity input, actor/session generation and import boundaries.                                                                                                                                                                                                                                                                                                                         | Passed |
| AC4–AC5, AC8     | `npm run db:lint` reported no schema errors. `npm run lint`, `npm run typecheck` and `npm run format:check` passed.                                                                                                                                                                                                                                                                                                                                                                                                           | Passed |
| AC5, AC8         | Configuration-free `npm run test:e2e` passed 40 desktop/mobile browser checks; its 4 configured-only authorization cases skipped by design. A configured focused run of `tests/browser/authorization.spec.ts` passed all 4 desktop/mobile cases, including public `/challenges`, private redirects and no guest mutation.                                                                                                                                                                                                     | Passed |
| AC7–AC8          | `NEXT_PUBLIC_*='' DATABASE_URL='' npx next build --webpack` and configured `npx next build --webpack` both passed. Webpack was selected because the restricted environment does not permit Turbopack's internal port; this does not change the production route/type output. All 67 Markdown files had resolvable repository-local links, 45 work records had unique IDs/lifecycle-correct placement/index entries, and `git diff --check` passed.                                                                            | Passed |

## Risks, limitations, and follow-ups

Email delivery failures and mailbox compromise affect account access. Rate limiting and generic responses reduce abuse and enumeration but do not provide production fraud operations. Supabase's local captured mailbox is not a hosted SMTP solution. A local reset is valid only because no hosted users or obligations exist; reassess before any deployment containing real accounts.

## Completion and review references

- Completed: 2026-09-21.
- Commit: Planning commit `4250c8e` used the original DEV0046 scope; the completed implementation remains uncommitted pending the user's commit request.
- Review: Requirements reviewed with the user; no independent implementation review.
- Deployment or release: Local configured build and disposable Supabase stack only; no hosted project or deployment.
