# Ticket DEV0046: Email OTP registration and application profiles

- Status: Completed
- Created: 2026-09-21
- Last updated: 2026-09-21
- Milestone: Prioritized identity and onboarding
- Coordination: [COR0003 — Account-first identity and wallet linking](../../archive/organisatory/COR0003-account-first-identity-and-wallet-linking.md)
- Related records: implements the [account model in the current actors and authority contract](../../../docs/mvp-spec.md#3-actors-and-authority); replaces the wallet-as-login model delivered by [DEV0038 — Phantom Supabase Web3 authentication](DEV0038-phantom-supabase-web3-authentication.md), the prepared-only enrollment delivered by [DEV0039 — Prepared identity and wallet bindings](DEV0039-prepared-identity-and-wallet-bindings.md), and the wallet-dependent actor resolution in [DEV0040 — Protected access and database context](DEV0040-protected-access-and-database-context.md); follows completed DEV0048 — Remove gym membership access; enables peer [DEV0047 — Personal wallet linking and replacement](../../archive/backend/DEV0047-personal-wallet-linking-and-replacement.md)

## Objective and context

Let anyone create and recover a RepX Club application account with a verified email one-time password (OTP) before connecting a cryptocurrency wallet. After verification, the person completes a minimal profile and becomes an ordinary participant in the active application dataset. This is application access, not gym membership. Account login, application profile and wallet ownership remain separate records.

The preceding implementation required a Phantom message signature, a prepared server allowlist and an existing fixture profile. That was suitable for the prepared-wallet demonstration but made ordinary application access depend on Phantom. On 2026-09-21 the user accepted account-first registration as the next priority and selected the defaults recorded below.

## Scope and non-goals

- In scope: open email-OTP registration and sign-in; generic anti-enumeration responses; local Mailpit delivery and documented hosted custom-SMTP requirement; minimal display-name onboarding; atomic creation of one user-sourced profile plus one active ordinary dataset-participation record; wallet-independent verified session and protected actor context; email-based sign-in recovery; removal of the prepared personal roster and Web3-first enrollment path; a deliberate local-data reset/cutover for the existing Anna test account; tests and current product/setup documentation.
- Out of scope: passwords, magic-link-only UX, Google/Apple or other social providers, experimental passkeys, phone login, organization/admin/staff/trainer assignment, gym membership or gym entitlement, wallet connection/proof/linking owned by DEV0047, company wallets owned by DEV0041, automatic account merging, production support-assisted recovery, payments or transactions.

## Expected behavior and edge cases

A visitor enters an email address and receives a six-digit code. The request response is the same whether the email is new or already registered. A valid code creates or restores the Supabase session. A first-time session remains in a bounded `profile-required` state until the person submits a display name; it has no protected product authority yet.

Profile completion runs once on the server. It creates one `record_source = 'user'` profile, a stable unique server-generated slug and one active ordinary-member participation record for the configured active application dataset. Retries return the same profile. Browser-supplied role, dataset, organization, venue, wallet or fixture identifiers are ignored. No signup path grants operator, organization, staff or trainer authority.

After profile completion, DEV0040's protected actor context derives from the verified Auth subject, claimed profile and active dataset participation without requiring a wallet binding. A wallet is absent by default and wallet-required actions remain unavailable until DEV0047 explicitly links one.

Expired, incorrect, replayed or rate-limited codes fail without creating a profile. Cancelling or losing the browser flow preserves public browsing. Sign-out removes protected access. Email access is the first-release recovery mechanism; loss of both the session and email account has no automated recovery path in this slice.

The existing local Web3 Auth user, Anna claim and wallet binding are disposable development data. The cutover resets local Auth/application data, then Anna can register with email, create a fresh profile and later link the same Phantom wallet through DEV0047. No generic production account-merging or dual-subject migration system is built for data that has never been deployed.

## Assumptions, decisions, and dependencies

Confirmed by the user on 2026-09-21:

- email OTP is the only initial registration and login method;
- registration is open rather than restricted to the prepared-wallet roster;
- first login creates an ordinary application dataset participant after minimal profile completion;
- wallets are optional and cannot be used as the new-user login method;
- no automatic identity or account merging is allowed;
- the one existing local wallet-first account may be reset and re-enrolled rather than receiving a production migration framework;
- Google/Apple login and passkeys are later refinements;
- DEV0046 was selected as the next implementation priority.

Use the installed Supabase Auth and server-rendered cookie boundary. Local codes use Supabase's test mail server. Hosted use requires selected project/origin configuration and a real SMTP provider before release; provider selection and deployment are operational follow-ups, not permission to embed credentials.

`demo_run_memberships` remains an internal dataset-participation/role table despite its historical name. It is not a gym membership or paid entitlement. Completed DEV0048 removed the separate gym-membership capability.

This ticket preserves its DEV0046 identity and commit history while narrowing to the first concrete implementation slice. COR0003 and DEV0047 were created because account registration and wallet-proof lifecycle are independently reviewable security boundaries.

## Implementation plan

1. Update the specification from wallet-first application authentication to email-OTP account authentication with optional later wallet linking. Document local email capture and hosted SMTP/origin prerequisites.
2. Configure email OTP and replace the Web3-only verified-session contract with a provider-bounded email subject/session contract. Preserve cookie refresh, sign-out, expiry and no-store behavior.
3. Add the atomic open-profile enrollment capability and schema adjustments required for user-sourced profiles and ordinary dataset participation. Generate stable unique slugs server-side and accept no authority metadata from the browser.
4. Remove the prepared personal roster, automatic Anna enrollment and wallet requirement from base actor authorization. Keep wallet-required authority unavailable when no link exists.
5. Add email/code/profile UI states, safe return handling, cancellation/retry/rate-limit copy and accessible desktop/mobile behavior.
6. Apply the documented local reset/cutover and add unit, Auth integration, database concurrency, authorization and browser tests with at least two email accounts.

## Acceptance criteria

- [x] AC1: A new email can request and verify an OTP, complete a display name and receive exactly one user profile plus one ordinary active dataset-participation record without connecting a wallet.
- [x] AC2: A returning verified email restores the same Auth subject/profile; retries and simultaneous profile completion cannot create duplicates.
- [x] AC3: New, existing, malformed, rate-limited, expired and incorrect-code requests use bounded responses that do not reveal account existence or grant partial application authority.
- [x] AC4: Browser-supplied profile/run/role/organization/venue/wallet metadata cannot grant authority. Signup never creates gym membership, organization, operator, staff or trainer access.
- [x] AC5: Protected actor access derives from subject/profile/active dataset participation without a wallet. Sign-out/expiry removes access, while public browsing remains available.
- [x] AC6: Web3-first login, the prepared personal roster and automatic Anna enrollment are removed from the ordinary account path; the local reset/re-enrollment procedure is documented and rehearsed without claiming production migration.
- [x] AC7: Local email delivery, hosted SMTP/origin requirements, environment variables, rollback/reset behavior and the DEV0047 handoff are documented without secrets.
- [x] AC8: Database/Auth integration, concurrency, unit/boundary, lint, typecheck, build and responsive keyboard-accessible browser tests pass with exact evidence recorded here.

## Validation plan

Use local Supabase Auth/Mailpit with two new emails, one returning email, invalid/expired/replayed codes and simultaneous profile-completion attempts. Verify one subject/profile/participation tuple per account, ordinary role only, no wallet binding, no gym entitlement and isolation through DEV0040's transaction-local actor context.

Rehearse signup, code entry, profile completion, reload, sign-out, return navigation and cancellation at desktop and mobile widths. Reset the disposable local environment, re-enrol Anna by email and prove protected non-wallet access. Run focused Auth/database tests plus the full relevant unit, boundary, lint, typecheck, formatting, production build and browser suites.

## Implementation record

Implementation started and completed on 2026-09-21 after confirming the DEV0048 prerequisite, account/profile boundary and DEV0047 handoff. The planning record was narrowed on 2026-09-21 after the user accepted email OTP, open registration, minimal profile creation, wallet-optional access and local reset instead of production migration.

### Changes and rationale

The personal entry path now requests a six-digit Supabase email code, verifies a confirmed email identity, asks first-time users for a display name and creates a minimal application identity. The signed-in session, application profile and future wallet binding are separate contracts. Header/session presentation uses the verified email; Phantom remains a standalone connection control and is neither login nor enrollment.

Migration `20260921000400_create_email_application_identity.sql` removes the prepared-wallet enrollment functions and policies, adds narrow owner-only enrollment policies, and creates idempotent `current_application_identity` and `enroll_application_identity` functions. Enrollment selects the sole active public dataset on the server, generates a stable unique profile slug, creates only a `record_source = 'user'` profile and ordinary active `member` participation, and creates no wallet or gym entitlement. Existing unique constraints make simultaneous calls converge without a broad update policy.

The verified protected actor now derives from the confirmed email Auth subject, claimed user profile and active dataset participation. It retains DEV0040's transaction-local row-level-security context and fail-closed route behavior but no longer requires a prepared roster or wallet binding. The browser identity endpoint accepts only exact bounded JSON containing `displayName`; dataset, profile, role, organization, venue and wallet authority remain server-derived.

The local Auth profile now enables the email provider, disables Solana Web3 Auth, renders a checked-in six-digit OTP template and starts Mailpit for captured development delivery. A new browser rehearsal creates two distinct accounts, rejects an incorrect and a replayed code, verifies isolated profiles/actors, signs out, restores the first profile and checks mobile overflow. Local runtime-role preparation is restart-safe.

### Affected files

| File or component                                                                                              | Change and purpose                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/20260921000400_create_email_application_identity.sql`                                     | Replaces prepared-wallet enrollment with atomic email-subject profile lookup/enrollment and wallet-independent actor validation.             |
| `supabase/config.toml`, `supabase/templates/email-otp.html`                                                    | Enables local six-digit email OTP capture, disables Solana Web3 login and supplies the matching email template.                              |
| `src/auth/email-otp.ts`, `src/auth/contracts.ts`, `src/server/auth/session.ts`                                 | Normalizes bounded email/code input and verifies a confirmed email identity before exposing the public session snapshot.                     |
| `src/features/auth/sign-in.tsx`, `src/app/sign-in/page.tsx`, `src/app/globals.css`                             | Implements request, verify, first-profile, enrolled, retry, failure and sign-out states with labelled forms and mobile layout.               |
| `src/app/api/auth/identity/route.ts`, `src/server/identity/service.ts`, `src/server/db/identity/repository.ts` | Provides the same-origin, display-name-only HTTP boundary and server/database identity workflow.                                             |
| `src/server/authorization/*`, `src/server/db/authorization/repository.ts`, `src/auth/actor-state.ts`           | Removes the wallet/roster prerequisite while preserving server-derived actor validation, RLS and session-generation isolation.               |
| Removed Web3/personal-roster modules under `src/auth/` and `src/server/identity/`                              | Eliminates wallet-first ordinary login and automatic Anna enrollment; wallet connection remains in its DEV0027-owned module.                 |
| `scripts/rehearse-local-email-auth.mjs`, `scripts/prepare-local-runtime-database.mjs`, `package.json`          | Adds repeatable real local Auth/Mailpit browser evidence and makes runtime-role setup safe to rerun.                                         |
| `tests/`, `supabase/tests/database/`                                                                           | Replaces wallet-first assertions with email/session/profile/concurrency/isolation checks and keeps seed tests valid after user registration. |
| `.env.example`, `README.md`, `supabase/README.md`, `docs/mvp-spec.md`                                          | Documents account-first setup, local captured mail, hosted requirements, reset behavior, current status and the DEV0047 handoff.             |

### Decisions and deviations

2026-09-21: DEV0046 originally combined account registration and the complete personal-wallet lifecycle. Because a planning commit already references DEV0046, it was preserved as the email-account/profile slice and grouped under new COR0003 with peer DEV0047 rather than converted or retired.

2026-09-21: the first enrollment function draft used `SELECT ... FOR UPDATE`, but forced row-level security hid rows because no broad update policy exists. The locks were removed before completion; existing unique Auth-subject/profile/participation constraints and conflict-safe inserts provide the required concurrency behavior without expanding runtime update authority.

2026-09-21: foundation seed tests originally counted every profile and failed after the real Auth rehearsal created users. They now count only `record_source = 'fixture'`, preserving deterministic seed evidence while allowing real user profiles to coexist.

### Contracts, configuration, and operations

The signed-in public session shape is `{ status, subject, email, expiresAt }`; it no longer contains `walletAddress`. The enrolled identity shape contains the profile, dataset and ordinary role but no wallet. The actor contract remains subject/profile/dataset/role and has no wallet prerequisite. `POST /api/auth/identity` accepts exactly `{ "displayName": string }`; GET and POST remain private/no-store and return bounded public states.

`PREPARED_PERSONAL_IDENTITIES_JSON` is removed. Local runtime requires only `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `NEXT_PUBLIC_SITE_URL`; `.env.local` stays ignored. `auth:start` now includes Mailpit. Hosted use still needs a selected Supabase project, allowed origins, custom SMTP, abuse controls and deployment secrets; none was provisioned here.

The new migration is forward-only: it removes obsolete prepared enrollment functions/policies and replaces the actor validation function. The checked-in local reset deliberately recreates disposable Auth/application data; no hosted migration or production account merge occurred. A later correction to a deployed environment must use a new migration rather than rewriting this one. No OTP, private key, recovery phrase or private Supabase key was recorded.

## Validation results

Validation completed on 2026-09-21 with Node.js 24.21.0, Supabase CLI 2.117.0, the isolated local stack, Mailpit and installed Google Chrome.

| Criterion        | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Result |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1–AC6          | `npm run db:reset` replayed all five migrations and the seed from a clean disposable database. `npm run db:test` passed 66 pgTAP assertions. `npm run test:db` passed 9 Drizzle/runtime tests, including direct-write denial, simultaneous enrollment, idempotent retry, fixture conflict rollback, no wallet row, ordinary role and alternating-account RLS isolation.                                                                                                                                                             | Passed |
| AC1–AC3, AC5–AC6 | `npm run test:auth` passed against the configured production app, local Supabase Auth/database and Mailpit: two new emails, one returning email, incorrect-code and used-code replay rejection, one profile per account, wallet-free authorized actors, sign-out denial, desktop plus mobile width and no browser errors/overflow. One cold local Auth request initially exceeded 30 seconds; a bounded direct probe returned HTTP 200, the rehearsal wait was raised to 60 seconds, and two subsequent complete rehearsals passed. | Passed |
| AC3–AC5          | `npm test` passed 38 unit/boundary tests covering bounded error copy, malformed email/code input, verified-email session shape, exact identity input, actor/session generation and import boundaries.                                                                                                                                                                                                                                                                                                                               | Passed |
| AC4–AC5, AC8     | `npm run db:lint` reported no schema errors. `npm run lint`, `npm run typecheck` and `npm run format:check` passed.                                                                                                                                                                                                                                                                                                                                                                                                                 | Passed |
| AC5, AC8         | Configuration-free `npm run test:e2e` passed 40 desktop/mobile browser checks; its 4 configured-only authorization cases skipped by design. A configured focused run of `tests/browser/authorization.spec.ts` passed all 4 desktop/mobile cases, including public `/challenges`, private redirects and no guest mutation.                                                                                                                                                                                                           | Passed |
| AC7–AC8          | `NEXT_PUBLIC_*='' DATABASE_URL='' npx next build --webpack` and configured `npx next build --webpack` both passed. Webpack was selected because the restricted environment does not permit Turbopack's internal port; this does not change the production route/type output. All 67 Markdown files had resolvable repository-local links, 45 work records had unique IDs/lifecycle-correct placement/index entries, and `git diff --check` passed.                                                                                  | Passed |

## Risks, limitations, and follow-ups

Email delivery failures and mailbox compromise affect account access. Rate limiting and generic responses reduce abuse and enumeration but do not provide production fraud operations. Supabase's local captured mailbox is not a hosted SMTP solution. A local reset is valid only because no hosted users or obligations exist; reassess before any deployment containing real accounts.

DEV0047 adds optional personal-wallet ownership. DEV0037 may later add embedded wallet creation, and separate future tickets may add Google/Apple identities or stable passkeys after provider contracts are reviewed.

Next action: implement DEV0047's optional wallet proof/link/unlink/replace lifecycle against this delivered email-account contract.

## Completion and review references

- Completed: 2026-09-21.
- Commit: Planning commit `4250c8e` used the original DEV0046 scope; the completed implementation remains uncommitted pending the user's commit request.
- Review: Requirements reviewed with the user; no independent implementation review.
- Deployment or release: Local configured build and disposable Supabase stack only; no hosted project or deployment.
