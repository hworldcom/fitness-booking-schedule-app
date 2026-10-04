# Ticket DEV0116: Provision local seeded-coach accounts

- Status: Completed
- Created: 2026-10-04
- Last updated: 2026-10-04
- Milestone: Coach-first local integration support
- Coordination: [COR0009 — Coach-first private-class booking MVP](../../current/organisatory/COR0009-coach-first-training-package-mvp.md)
- Related records: builds on the email-code identity boundary from [DEV0046 — Email OTP registration and application profiles](DEV0046-email-otp-registration-and-application-profiles.md), converts the five fictional profiles delivered by [DEV0096 — Persist coach profiles and discovery](DEV0096-persist-coach-profiles-and-discovery.md) only in the disposable local environment, and supplies stable coach identities for [DEV0114 — Persist recurring coach availability](DEV0114-persist-recurring-coach-availability.md) and [DEV0115 — Add the coach schedule calendar](../../current/frontend/DEV0115-add-coach-schedule-calendar.md) validation

## Objective and context

Create reusable local email-code accounts for the five existing fictional coaches—Daniel Park, Sam Lee, Nora Klein, Idris Malik and Elif Demir—so developers can sign in as those exact profiles while implementing and rehearsing coach-owned features. The checked-in seed currently keeps fictional profiles unclaimed and immutable; creating an ordinary account instead produces a separate profile and duplicate coach. This ticket adds an explicit local-only conversion step without weakening public registration, allowing arbitrary fixture claims or creating hosted accounts.

## Scope and non-goals

- In scope: one idempotent local provisioning command; fixed `.test` email aliases for the five seeded coaches; Supabase Auth users without committed passwords; atomic binding of each Auth subject to its expected profile; conversion of only those profiles, coach profiles and dataset memberships to ordinary owner-managed user records; collision and partial-failure protection; local setup documentation; focused automated and live-local validation.
- Out of scope: hosted staging or production account creation; real email addresses; passwords or committed one-time codes; generic fixture claiming; browser account-selection UI; automatic identity merging; new application roles; changing open self-service registration; additional fictional coaches; recurring schedule persistence owned by DEV0114.

## Expected behavior and edge cases

With the Auth-enabled local Supabase stack running, `npm run auth:provision:coaches` creates or safely reuses five tagged local Auth users, then binds each subject to the matching seeded profile in one database transaction. Each converted profile becomes a claimed `record_source = 'user'` profile with an ordinary `member` dataset role, and its matching coach profile becomes owner-managed while preserving its public slug, content, gym/location, disciplines and posts. The application can resolve each subject through `app.current_application_identity`, and signing in still uses the existing email-code flow captured by local Mailpit.

The command must refuse any non-loopback Auth or database endpoint. It fails before mutation when expected seed data is missing, already bound to a different subject, has an unexpected slug/source/role, or an alias belongs to an untagged Auth user. Re-running after success changes no identity. If Auth creation succeeds but the database transaction fails, newly created users are removed on a best-effort basis and the command reports the failure. A clean `npm run db:reset` remains the supported rollback and removes the local accounts/conversions with the disposable stack.

## Assumptions, decisions, and dependencies

- The user requested accounts for the existing coaches on 2026-10-04 while choosing DEV0114 as the next product implementation. Reusable local coach identities improve authenticated recurrence/calendar validation, but they are integration support rather than production customer provisioning.
- Email OTP remains the only login mechanism. The command supplies or exposes no password and creates no session, wallet or authority metadata consumed by the application; Supabase may keep an inaccessible generated credential hash internally.
- Fixed aliases use the reserved `.test` top-level domain and are documented because they are identifiers, not secrets. Supabase's local Mailpit captures requested codes.
- Conversion is deliberately allowlisted by exact profile ID, slug and email. A generic claim procedure would contradict DEV0046's no-automatic-merging decision and DEV0096's immutable-fixture boundary.
- The seeded coach participants currently mix historical `member` and `operator` dataset roles. Provisioning normalizes them to the ordinary `member` role used by self-service coach accounts; coaching authority continues to come from the claimed profile plus `coaching_activated_at`, not a special login role.
- This ticket is one small operational vertical slice and does not need splitting. DEV0114 remains independently Ready and may proceed after stable local coach identities exist.

## Implementation plan

1. Add a testable local provisioning module with the five-entry allowlist, loopback guards, Auth-user collision checks and database precondition/binding validation.
2. Add the npm command that obtains the local Supabase service-role configuration without printing it, creates missing confirmed passwordless users, atomically converts/binds the matching seeded records and compensates newly created users after a failed bind.
3. Document the command, aliases, Mailpit OTP flow, local-only boundary and reset rollback.
4. Add focused unit coverage, then run the command twice against the disposable local stack and verify five resolvable application identities with preserved coach records.

## Acceptance criteria

- [x] AC1: One documented command provisions exactly the five allowlisted seeded coaches as passwordless local email-code accounts without committing or printing credentials/codes.
- [x] AC2: Each Auth subject resolves to its original profile and coach data as an ordinary active member and can use owner-scoped coach behavior; no duplicate profile or coach is created.
- [x] AC3: Re-running is idempotent, while missing/mismatched seed data, conflicting Auth aliases or identity bindings fail closed without partial database conversion.
- [x] AC4: Non-loopback Auth/database targets are rejected before credentials or data are used; hosted account creation remains unavailable.
- [x] AC5: Focused tests, live-local provisioning/retry verification, lint and formatting checks pass, with exact evidence recorded here.

## Validation plan

Add unit tests for the allowlist shape, loopback URL/database validation, safe environment parsing and collision decisions. Against the Auth-enabled disposable local stack, run the command twice, query the five subject/profile/membership/coach mappings and call `app.current_application_identity` for every subject. Confirm coach slugs and public records are preserved, the provisioner supplies no password, and the command output contains aliases but no service-role value. Run relevant lint and formatting checks. A hosted rehearsal, Solana check, Mapbox request and production build are not required because this ticket changes local tooling/data only.

## Implementation record

Implementation started and completed on 2026-10-04 after read-only review confirmed that seeded profiles are unclaimed fixtures and ordinary registration intentionally cannot claim them.

### Changes and rationale

Added an allowlisted, loopback-only provisioning workflow for the five existing fictional coaches. The command reads the running local Supabase configuration without printing it, rejects non-loopback Auth or PostgreSQL endpoints, validates the expected seed/profile/coach/membership state, and detects Auth ID/email collisions before mutation. It creates only missing, deterministically identified and metadata-tagged confirmed Auth users, supplying no password, then converts all five matching application records in one database transaction.

The conversion binds each Auth subject to the original profile, marks the profile and coach profile as owner-managed `user` records, and normalizes the active dataset participation to the ordinary `member` role. Public slugs, names, biographies, gym/location snapshots, disciplines and posts are not copied or replaced, so no duplicate coach appears. The command verifies all five through `app.current_application_identity` before reporting success. Repeated execution reuses the tagged identities; a failed database bind triggers best-effort deletion of Auth users created by that attempt.

README setup now names the fixed `.test` aliases, existing OTP/Mailpit flow, loopback boundary, idempotence and `db:reset` rollback. Focused tests cover the allowlist, status parsing, hosted-target refusal, Auth collision tags and permitted complete database states.

Final review tightened the reuse and seed preconditions: a tagged Auth user must be confirmed, and every fixture must retain its exact seeded participant role, active public demo run, visible coach profile and at least one discipline before conversion. This prevents a broader but superficially valid local record from being claimed.

### Affected files

| File or component                                                                | Change and purpose                                                                                                                                    |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/lib/local-coach-accounts.ts`                                            | Defines the exact five-account allowlist and pure validation for local status, endpoints, Auth identity reuse and fixture/provisioned database state. |
| `scripts/provision-local-coach-accounts.ts`                                      | Orchestrates guarded Auth creation, atomic database binding, compensation, identity verification and credential-safe output.                          |
| `tests/local-coach-accounts.test.ts`                                             | Covers stable identity uniqueness, `.test` aliases, parsing, loopback enforcement, metadata collision rejection and complete-state checks.            |
| `package.json`                                                                   | Adds `auth:provision:coaches` through the existing local `tsx` development dependency.                                                                |
| `README.md`                                                                      | Documents provisioning, all five aliases, Mailpit login, idempotence, local-only scope and reset rollback.                                            |
| `tickets/README.md`, `tickets/current/organisatory/COR0009-…md`, and this record | Track DEV0116 ownership, delivery state, relationships and validation evidence.                                                                       |

### Decisions and deviations

- 2026-10-04: Use a guarded local conversion rather than creating duplicate user-owned coaches. This preserves the existing coach slugs/content and makes owner-scoped feature validation representative.
- 2026-10-04: Use passwordless `.test` aliases and existing OTP/Mailpit delivery. Passwords and hosted identities are unnecessary for the requested local development workflow.
- 2026-10-04: Initial validation assumed every coach fixture had the historical `operator` dataset role. The first live run failed closed before Auth creation because Daniel Park is already a `member`; the allowlist now records Daniel's exact `member` role and the other four exact `operator` roles while still normalizing every provisioned identity to `member`.
- 2026-10-04: Local GoTrue stores an inaccessible generated credential hash even though `createUser` receives no password. Documentation therefore states the precise contract: the provisioner supplies or exposes no password and the application login remains email OTP.

### Contracts, configuration, and operations

`npm run auth:provision:coaches` is the new local command. It uses local Supabase CLI status for the loopback API, service-role and PostgreSQL values without adding environment variables or printing secrets. Auth users use deterministic IDs plus fixed `.test` aliases and private admin metadata used only for collision detection; application authority still derives from the bound profile and active participation, not Auth metadata. No schema, migration, application route, hosted configuration, wallet or dependency changed. `npm run db:reset` is the rollback for the disposable local environment and the command must be rerun after a reset.

## Validation results

- Date and environment: 2026-10-04, local Auth-enabled Supabase/GoTrue/PostgreSQL/Mailpit stack on loopback ports 55321/55322/55324 with Node.js 24.21.0.
- `npx tsx --test tests/local-coach-accounts.test.ts` — passed 5/5 focused tests.
- First `npm run auth:provision:coaches` — failed closed before creating Auth users because the precondition incorrectly required Daniel Park's existing fixture participation to be `operator`; the seed correctly has Daniel as `member`. Validation was corrected to accept the complete seeded role mix.
- `npm run auth:provision:coaches` after the correction — passed and provisioned Daniel Park, Sam Lee, Nora Klein, Idris Malik and Elif Demir under their fixed `.test` aliases.
- Immediate second `npm run auth:provision:coaches` — passed with the same five identities, proving the live-local retry path is idempotent.
- A read-only PostgreSQL/`tsx` verification found exactly five original slugs mapped to the expected Auth subjects, `record_source = 'user'` profiles and coach profiles, active `member` participation, preserved public slugs and `app.authorized_actor_context_valid(...) = true` for all five.
- A local Supabase OTP request/verify harness with `shouldCreateUser: false` verified all five aliases and returned each deterministic expected Auth subject. Codes, sessions and service credentials were not printed.
- `npm test` — passed all 68 unit/boundary tests, including the 5 new tests.
- `npm run typecheck` — passed after Next.js route type generation and strict TypeScript checking.
- `npm run lint` — passed with no findings.
- `npm run format:check` — passed for all configured implementation files; the affected Markdown records were also formatted with Prettier.
- Final review after concurrent DEV0114 work — focused tests still passed 5/5, the live provisioning command reused all five identities, `npm test` passed 68/68, `npm run typecheck` and `npm run lint` passed, and a targeted Prettier check passed for every DEV0116 file. The repository-wide format check currently reports only `src/server/db/schema/coaches.ts`, an in-progress DEV0114 file outside this ticket.
- Production build, full database migration suites, Mapbox, Solana and hosted checks were not run because this ticket changes only guarded local provisioning/tooling and does not change application runtime, schema or provider integration.

| Criterion | Evidence                                                                                                                           | Result |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | The documented command created the exact five tagged `.test` identities while outputting only names, aliases and Mailpit URL.      | Passed |
| AC2       | Database/identity checks preserved original coach slugs/data and returned valid member actor authority for each expected subject.  | Passed |
| AC3       | The second live run reused all identities; focused tests reject mixed database state and conflicting Auth metadata.                | Passed |
| AC4       | Unit tests reject hosted Auth and database URLs independently; the runner checks endpoints before constructing privileged clients. | Passed |
| AC5       | Focused/full tests, live provisioning/retry, five-account OTP verification, typecheck, lint and formatting all passed.             | Passed |

## Risks, limitations, and follow-ups

These are fictional local demo identities, not real people or deployable production accounts. Resetting the local Supabase database removes them, so the provisioning command must be rerun after a reset. The conversion makes those five records mutable in the disposable database until reset; it deliberately does not alter the checked-in deterministic seed. Hosted test identities require separate reviewed email ownership, SMTP and data-provisioning decisions under the staging/integrated-rehearsal records. DEV0114 can now use these accounts for recurring-availability owner validation.

## Completion and review references

- Completed: 2026-10-04 — five existing fictional coaches now have idempotently provisioned, loopback-only OTP identities bound to their original owner-manageable profiles.
- Commit: This commit — `[DEV0114][DEV0116] Add recurring availability and local coach accounts`.
- Review: Self-review against DEV0116 scope and acceptance criteria completed; no independent review.
- Deployment or release: Local disposable environment only; no hosted account creation authorized or performed.
