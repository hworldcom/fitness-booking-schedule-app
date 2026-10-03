# Ticket DEV0110: Activate coaching during account onboarding

- Status: Completed
- Created: 2026-10-03
- Last updated: 2026-10-03
- Milestone: Coach-first M1 identity and discovery
- Coordination: [COR0009 — Coach-first private-class booking MVP](../../current/organisatory/COR0009-coach-first-training-package-mvp.md)
- Related records: extends completed email registration in [DEV0046 — Email OTP registration and application profiles](DEV0046-email-otp-registration-and-application-profiles.md), refines the self-declared coach boundary in [DEV0096 — Persist coach profiles and discovery](../../current/backend/DEV0096-persist-coach-profiles-and-discovery.md), and gates the coach workspace delivered by [DEV0104 — Publish weekly coach availability](DEV0104-publish-weekly-coach-availability.md)

## Objective and context

Let a newly registered user explicitly choose whether to browse as a client or activate coaching. Activation must be immediate and self-service for the hackathon—there is no administrator approval—but it must be stored as a distinct server-authoritative database capability rather than inferred from authentication metadata, navigation or a partially completed public coach profile.

## Scope and non-goals

- In scope: a post-registration “Find a coach / Offer coaching” choice; an idempotent owner-only coaching activation timestamp; immediate activation without approval; activation gates before coach-profile creation and the coach workspace; migration/backfill for existing coach profiles; honest retry/error states; database, service, browser and authenticated-flow validation.
- Out of scope: separate coach accounts or login methods, mutually exclusive client/coach roles, administrator review, credential verification, moderation, coach deactivation/suspension, wallet linking, offer authority, redesigning general email registration or changing public browsing.

## Expected behavior and edge cases

All users continue to register through the same email one-time-code flow and create one ordinary MovX profile. Immediately after first profile creation, the interface asks whether they want to find a coach or offer coaching. Choosing Find a coach proceeds to Explore without coach activation. Choosing Offer coaching atomically records the current timestamp for the verified owner and proceeds to coach-profile setup.

Activation is one-way and idempotent in P0. A returning unactivated account that visits `/coach` or `/profile/coach` sees an explicit activation explanation and control; it cannot create a coach profile before activation. Existing fixture and user-created coach profiles are backfilled as activated so the migration does not invalidate current coach data. Activation alone does not make a profile public, claim credentials, link a wallet or grant offer/payment authority.

## Assumptions, decisions, and dependencies

Coaching is an additive capability on a normal account because one person may both book and coach. It is represented by nullable `app.profiles.coaching_activated_at`, not by the retained demo-run `member`/`operator` authorization role and not by client-supplied Supabase metadata. The existing `app.coach_profiles` row remains the detailed public coach identity; its visibility still controls discovery.

No approval-state column is added because the user explicitly confirmed immediate activation. A later verification/moderation ticket may add pending, approved or suspended state without redefining email authentication or historical activation time.

## Implementation plan

1. Add the additive activation timestamp, backfill existing coach owners, and expose an idempotent actor-scoped activation function with forced row-level-security and least-privilege grants.
2. Add server repository/service/route contracts for reading and activating only the verified current account, then require activation before coach-profile mutation.
3. Add the post-registration choice and activation gates to the existing sign-in and coach workspace/profile flows.
4. Validate new-account defaults, owner isolation, retry behavior, backfill, client/coach navigation, responsive keyboard use and existing authentication/coach regressions.

## Acceptance criteria

- [x] AC1: First-time email registration presents Find a coach and Offer coaching paths after the ordinary profile is created; selecting Offer coaching activates the verified account and leads to coach-profile setup without admin approval.
- [x] AC2: Coaching activation is persisted server-side, idempotent and owner-scoped; browser input cannot activate another account or manufacture an authentication/dataset role.
- [x] AC3: An unactivated account cannot create a coach profile or manage coach availability, while existing coach records remain activated and usable after migration.
- [x] AC4: Activation remains distinct from public visibility, credential verification, wallet authority and customer capabilities; an activated coach may still use client features.
- [x] AC5: Migration, authorization, service, authenticated browser, responsive, static and production-build checks pass.

## Validation plan

Run a clean database reset and repeat seed, pgTAP schema/grant/policy checks, runtime-role integration tests for default/activate/retry/cross-user behavior, focused unit/browser tests, the real local email-auth rehearsal through both onboarding choices, and relevant lint, typecheck, formatting and production build commands. Solana/Devnet transaction validation is not applicable because activation is an off-chain account capability.

## Implementation record

Implementation started on 2026-10-03 after the user confirmed immediate coach activation without administrator approval.

### Changes and rationale

Registration still creates one ordinary email-backed MovX account. Immediately after the first application profile is created, the sign-in screen now presents two keyboard-accessible starting paths: Find a coach continues to Explore without activation, while Offer coaching calls a same-origin server route, activates the verified owner and opens coach-profile setup. Returning accounts do not repeat the first-registration choice.

An additive nullable `coaching_activated_at` timestamp on the application profile is now the server-authoritative coaching capability. The restricted activation function accepts no profile identifier, derives the exact owner from the verified transaction context and preserves the original timestamp on retries. Existing coach-profile owners and deterministic coach fixtures are activated during migration/seed. Direct runtime updates remain prohibited by forced row-level security.

Both `/coach` and `/profile/coach` show an honest activation gate for an enrolled but unactivated account. The coach-profile service and a database trigger independently prevent profile creation before activation; availability remains unreachable because it requires the activated account and a completed visible coach profile. Activation does not create or publish that profile, claim verification, link a wallet or restrict the same account from booking as a client.

### Affected files

- [`supabase/migrations/20261003000400_activate_self_service_coaching.sql`](../../../supabase/migrations/20261003000400_activate_self_service_coaching.sql) adds/backfills the activation timestamp, the idempotent owner mutation, least-privilege grants/policy and the coach-profile enforcement trigger. [`supabase/seed.sql`](../../../supabase/seed.sql) explicitly activates only the five fictional coach fixtures.
- [`src/server/db/schema/foundation.ts`](../../../src/server/db/schema/foundation.ts), [`src/server/db/authorization/repository.ts`](../../../src/server/db/authorization/repository.ts) and [`src/server/db/coaches/activation-repository.ts`](../../../src/server/db/coaches/activation-repository.ts) map the timestamp, expose only the derived activation boolean to internal services and call the no-argument owner function.
- [`src/server/coaches/service.ts`](../../../src/server/coaches/service.ts) owns self-service activation and fails coach-profile/workspace operations closed until activation. [`src/app/api/auth/coaching/route.ts`](../../../src/app/api/auth/coaching/route.ts) exposes the bounded same-origin POST response defined by [`src/auth/coaching-activation-contracts.ts`](../../../src/auth/coaching-activation-contracts.ts).
- [`src/features/auth/sign-in.tsx`](../../../src/features/auth/sign-in.tsx) adds the first-registration path choice. [`src/features/coaches/coach-activation-gate.tsx`](../../../src/features/coaches/coach-activation-gate.tsx), the coach/profile pages and their CSS provide the reusable returning-account activation state.
- [`supabase/tests/database/coach-activation.test.sql`](../../../supabase/tests/database/coach-activation.test.sql), [`tests/database/coach-activation.test.ts`](../../../tests/database/coach-activation.test.ts) and updated coach/availability tests cover schema, privileges, default state, retries, isolation and bypass prevention. The three local Auth rehearsal scripts now complete the explicit client/coach path before testing their owned flows.
- [`docs/mvp-spec.md`](../../../docs/mvp-spec.md) records confirmed decision C22 and the registration/activation acceptance scenario. [`README.md`](../../../README.md), the COR0009 work map and DEV0096's continuity note distinguish activation from public-profile existence.

### Decisions and deviations

The initial discussion considered deriving coach status solely from the public coach-profile row. The user clarified that coaching must be activated during registration, so the adopted design stores a preceding account capability. It remains additive and one-way for P0; no mutually exclusive account type or approval state was introduced.

The activation timestamp lives on `app.profiles` because it is an account capability independent of the active demo dataset, while coach-profile details remain run-scoped. A client-path selection does not write a redundant permanent “client role”; every ordinary account already has client capabilities. The implementation uses both a service check and database trigger so direct invocation of the existing profile-upsert function cannot bypass activation.

The first database run exposed that `COALESCE` is PostgreSQL syntax rather than a `pg_catalog` namespaced function and that a before-trigger hid existing field-constraint errors. The migration was corrected before completion to use `coalesce` and an after-trigger, preserving both activation enforcement and the earlier constraint behavior. The existing email rehearsal also contained stale profile copy; it was corrected while extending that required flow.

### Contracts, configuration, and operations

The additive contract is `app.profiles.coaching_activated_at timestamptz null` plus `app.activate_owned_coaching() returns timestamptz`. `app_runtime` may execute only the function and retains no direct profile update privilege; `anon`, `authenticated` and `service_role` cannot execute it. `POST /api/auth/coaching` accepts no body or target identifier, requires the configured exact origin and returns only `activated`, `signed-out`, `forbidden` or `unavailable`.

No dependency, environment variable, secret, administrator operation or wallet requirement was added. Clean local replay and repeat seed are supported. The migration is additive and was applied only to the disposable local database; hosted deployment was not attempted. Rollback before downstream use may drop the route/function/trigger/policy/column, but a hosted system with coach activity should use a reviewed forward migration so historical activation timestamps and profile eligibility are not silently removed.

## Validation results

- `npm run db:reset` — passed the full clean migration chain through `20261003000400` and seeded the activation-aware fixtures; repeated after correcting the two issues found by the first database run.
- `npm run db:seed` — passed immediately after reset, proving the updated fixture seed remains repeatable.
- `npm run db:test` — passed all 129 pgTAP assertions across six files, including activation column, backfill/seed state, policy, trigger and exact privilege checks.
- `npm run test:db` — passed all 21 integration tests. New cases prove default-inactive accounts, profile rejection before activation, direct-update denial, idempotent timestamp retention, cross-account isolation and successful profile creation after activation; coach availability/discovery regressions also pass.
- `npm run db:lint` — passed with no schema errors.
- `npm test` — passed all 54 unit/boundary tests, including the exact bounded activation response contract.
- `npm run lint`, `npm run typecheck`, `npm run format:check` and `git diff --check` — passed.
- `npm run build` — passed the Next.js 16.3.5 production build; `/api/auth/coaching`, `/coach` and `/profile/coach` are dynamic routes.
- `npm run test:e2e` — passed all 26 desktop/mobile Playwright scenarios.
- `npm run test:auth` — passed against the real local Auth stack: one new account chose Find a coach and remained gated from coaching, another activated coaching and reached setup immediately, a returning account did not repeat profile/onboarding, invalid/replayed codes recovered correctly, and mobile keyboard/overflow checks passed. Desktop/mobile onboarding screenshots were inspected at `test-results/email-auth-rehearsal/` and showed readable, non-overflowing controls.
- `npm run test:coach-availability` and `npm run test:wallet-auth` — passed after their new-account flows adopted the explicit coach/client choice, proving downstream coach setup/availability and client wallet proof remain usable.
- Solana/Devnet transaction — not applicable; activation changes only off-chain account capability.

| Criterion | Evidence                                                                  | Result |
| --------- | ------------------------------------------------------------------------- | ------ |
| AC1       | Real email-code client/coach onboarding rehearsal                         | Passed |
| AC2       | pgTAP grants plus runtime idempotency/isolation integration tests         | Passed |
| AC3       | Database trigger/service-gate tests and availability regression rehearsal | Passed |
| AC4       | Bounded contracts, UI copy and client wallet regression rehearsal         | Passed |
| AC5       | Database, unit, static, build and desktop/mobile checks above             | Passed |

## Risks, limitations, and follow-ups

Self-service activation is not coach verification. The interface and data contract must not imply that MovX reviewed credentials or safety. Deactivation, suspension and approval remain intentionally absent.

If moderation becomes necessary, a new ticket should add an explicit lifecycle such as pending/approved/suspended without rewriting the immutable owner activation time or the shared email identity. Client-path selection is intentionally not stored as a role because client capability is universal.

## Completion and review references

- Completed: 2026-10-03 — self-service coaching activation and the registration path choice passed all required validation.
- Commit: Not created.
- Review: Implementation self-review against AC1–AC5; no independent review.
- Deployment or release: None.
