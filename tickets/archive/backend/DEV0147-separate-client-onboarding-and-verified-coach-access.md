# Ticket DEV0147: Separate client onboarding and verified coach access

- Status: Completed
- Created: 2026-10-08
- Last updated: 2026-10-08
- Milestone: Scheduling-only identity and trust
- Coordination: None — independent development ticket
- Related records: replaces the self-service approval boundary delivered by [DEV0110 — Activate coaching during account onboarding](DEV0110-activate-coaching-during-account-onboarding.md); extends [DEV0046 — Email OTP registration and application profiles](DEV0046-email-otp-registration-and-application-profiles.md) and [DEV0096 — Persist coach profiles and discovery](DEV0096-persist-coach-profiles-and-discovery.md); required foundation for [DEV0148 — Add the coach-review admin panel](../../current/frontend/DEV0148-add-coach-review-admin-panel.md)

## Objective and context

Separate ordinary client onboarding from coach access without creating incompatible account systems. Every person continues to own one email-authenticated MovX account and may book as a client. A person who wants to offer coaching follows an explicit coach-application path and cannot publish, manage availability or receive new bookings until MovX has approved the application.

The current contract permits immediate self-service coaching activation and explicitly says that activation is not credential verification. The user has now confirmed that coach access must be platform-approved and that approved public coaches should carry a verified badge. Update the confirmed decisions, roles, registration flow, identity integrity rules, definition of done and acceptance matrix in [the MVP specification](../../../docs/mvp-spec.md) as part of implementation.

In this project, a **client** is the default booking capability of any enrolled account; a **coach** is an additional platform-approved capability on that same account. “Verified coach” means MovX reviewed the account holder's identity and coach application under a recorded policy version. It must not claim guaranteed competence, safety, licensing or endorsement.

## Scope and non-goals

- In scope:
  - retain one Supabase Auth identity and one application profile per person while presenting distinct `Find a coach` and `Become a coach` registration/onboarding entry paths;
  - replace self-service coach authorization with a server-authoritative application lifecycle: absence means not applied, followed by `pending`, `approved`, `rejected` or `suspended`;
  - let an applicant prepare a private coach-profile draft while pending, but prevent public visibility, availability management and new coach bookings until approval;
  - add an owner-controlled, non-browser operational approval command or equivalent restricted database operation so the separation can ship before an admin panel;
  - record every approval, rejection and suspension with the decision time, bounded reason, review source and verification-policy version;
  - derive coach authorization and the public verified badge from current approved state rather than browser input, editable Auth metadata, profile existence or the historical activation timestamp;
  - preserve client booking capability for pending, rejected, approved and suspended applicants;
  - migrate current coach data without silently representing fictional fixtures or previously self-activated accounts as platform-verified;
  - update public/protected copy, database/service authorization, tests, specification and operational documentation.
- Out of scope:
  - the browser-based staff review queue and decision interface owned by DEV0148;
  - separate authentication providers, separate coach credentials or mutually exclusive client/coach accounts;
  - in-app credential/document upload, background checks, licensing guarantees or automated verification-provider integrations;
  - general user administration, support impersonation, payments, messaging or notifications;
  - deleting historical activation data or booking history.

## Expected behavior and edge cases

- A visitor choosing `Find a coach` completes the existing email-code registration and can browse/book without a coach application.
- A visitor choosing `Become a coach` uses the same email-code identity, completes the common profile, enters the coach-application path and receives a truthful pending state after submission.
- A pending applicant may edit a private draft but cannot make it visible, publish availability, receive new bookings or manufacture approval through submitted fields, URLs or Auth metadata.
- A restricted platform operation may approve, reject or suspend an exact application. It must require the expected current state, a bounded reason, reviewer identity/source and verification-policy version, and must append immutable audit evidence atomically with the state change.
- An approved coach may publish a completed profile and manage availability. Public projections show a `Verified coach` badge with accessible explanatory copy only while approval is current.
- Rejection retains the private application and review history and allows a clearly defined resubmission path without granting coach authority.
- Suspension removes the coach from discovery and prevents new availability/publication/booking activity while preserving historical bookings and permitting the existing parties to see and safely resolve already-confirmed sessions under an explicitly tested transition policy.
- A coach remains a client and cannot book their own occurrence. Approval never grants access to another coach's profile, availability or bookings.
- Concurrent/replayed decisions are idempotent or return a conflict; they never produce contradictory current state and audit history.
- Database/Auth unavailability returns a bounded unavailable state and never displays approval or a verified badge optimistically.
- Fictional seed coaches remain clearly labelled demonstration data and never receive the real platform-verification badge solely through seed/backfill.

## Assumptions, decisions, and dependencies

- Adopted user decision, 2026-10-08: client and coach registration should be visibly separated, coach access requires platform approval, and approved coaches receive a verified badge.
- One account remains authoritative because a coach may also book as a client. Separation is implemented as onboarding intent plus an additive approved capability, not as two Auth populations or a permanent client role.
- `app.profiles.coaching_activated_at` may remain as historical evidence of self-declared intent, but it must stop granting coach authority after this migration. The new application/review state is authoritative.
- Approval is initially performed through a documented owner-controlled operational command or restricted database function. DEV0148 later replaces that operational inconvenience with an authenticated staff interface without redefining the lifecycle.
- The initial badge claim is narrowly bounded to identity and application review under a named/versioned MovX policy. The implementation must publish the exact explanatory copy and document the review checklist before any real account can be marked approved.
- Review evidence may be checked out of band for this ticket. Only the decision, policy version, reviewer/source and bounded notes belong in the application database; sensitive identity documents are not accepted or stored by this scope.
- Existing production-like user-created coach profiles must not be grandfathered into verified status. Migration and rollout behavior must be explicit, preserve data and fail closed. Fixture coaches require a separate demo presentation path.
- DEV0148 is downstream and does not block this ticket. This ticket must expose a stable, least-privilege review contract that the later panel can call.
- The forward schema uses global `app.coach_applications` current-state rows keyed by application profile and append-only `app.coach_application_review_events` rows. Applicant submission is exposed only through `app.submit_owned_coach_application()` under verified actor context; operational decisions use owner-only `app.review_coach_application(...)`, which is not executable by `app_runtime` or browser-facing roles.
- The initial verification policy identifier is `movx-identity-application-v1`. An approving operator attests that the email-backed account identity was checked out of band and that the completed coach application/profile was reviewed. Public copy is `Verified coach` with the explanation `MovX reviewed this coach's identity and application.` It does not claim licensing, background checks, guaranteed competence or safety.
- Fictional seed coaches remain operational demonstration profiles through an explicit fixture boundary and display `Demo coach`, never `Verified coach`. User-created public discovery, availability mutation and new booking eligibility require current `approved` application state.
- The interim review command requires a privileged `COACH_REVIEW_DATABASE_URL`, defaults to dry-run, requires explicit apply/target confirmation and must never print the connection string. This operational secret is not a Vercel/runtime application variable.

## Implementation plan

1. Update the MVP specification before behavior changes, replacing immediate self-service coach authorization with the shared-account application/approval contract and defining the exact public verification claim.
2. Add forward-only schema for current coach application state and immutable review events, with constraints for legal transitions, reviewer/source evidence, policy versioning and owner/read boundaries. Preserve but de-authorize historical `coaching_activated_at` state.
3. Add restricted database operations for applicant submission/resubmission and owner-operated approve/reject/suspend decisions. Make decisions atomic, expected-state guarded and auditable; expose no runtime role capability to self-approve.
4. Replace activation gates and mutations with separate client/coach onboarding intent, pending/rejected/suspended states and approved-only coach publication/availability authorization. Keep private draft editing explicitly bounded.
5. Add approved-state fields to bounded public coach projections and render the accessible verified badge/explanation only for real current approvals; keep fictional fixtures explicitly marked as demo content.
6. Provide a guarded manual review command/runbook for the interim period before DEV0148, including dry-run/target confirmation, no secret logging and rollback/forward-correction guidance.
7. Add migration, authorization, transition, projection, onboarding, badge and responsive browser coverage; rehearse client registration, pending application, manual approval, publication, suspension and retained client behavior.

## Acceptance criteria

- [x] AC1: Client and coach onboarding are visibly separate entry paths but resolve to one email-backed account model in which every approved coach retains ordinary client capability.
- [x] AC2: A coach application has a constrained, server-authoritative lifecycle with atomic immutable review evidence; browser input and ordinary runtime roles cannot approve, reject or suspend any account.
- [x] AC3: Pending/rejected/suspended applicants cannot publish, manage availability or receive new bookings, while approved owners can and unrelated accounts remain denied.
- [x] AC4: A public verified badge appears only for current, real platform approvals and explains the bounded review claim; fictional fixtures and legacy self-activation never silently receive it.
- [x] AC5: A guarded owner-operated approval workflow is documented and rehearsed so coach approval works before the admin panel, including conflict/retry and no-secret-output behavior.
- [x] AC6: Forward migration preserves profiles, applications and booking history, defines suspension behavior for existing confirmed sessions, and passes focused database, authorization, unit, build and desktop/mobile flow validation.
- [x] AC7: The MVP specification, README/runbook and ticket implementation record describe the new identity, approval, badge and operational contracts without presenting proposed checks as completed verification.

## Validation plan

- Replay the complete migration chain and repeat seed; verify constraints, row-level security, grants, application transitions, immutable review events and non-grandfathering of fixture/legacy coach records with pgTAP and runtime-role integration tests.
- Add concurrency and authorization tests for duplicate submission, stale approval, replayed approval, cross-account access, rejection/resubmission, suspension and attempts to mutate verification state through profile/Auth fields.
- Add service/domain tests proving client capability remains universal while coach publication, availability and new booking eligibility require current approval.
- Add projection/component tests proving the badge and its explanatory copy appear only for current real approvals and demo coaches remain explicitly labelled.
- Rehearse separate client and coach email-code entry paths, pending draft behavior, the guarded manual approval operation, approved publication and suspension at desktop and mobile widths with keyboard use and relevant failure states.
- Run `npm test`, `npm run test:db`, `npm run db:test`, `npm run db:lint`, `npm run lint`, `npm run typecheck`, `npm run format:check`, the relevant authenticated/browser suites, production build and `git diff --check`.

## Implementation record

Completed the shared-account coach-application boundary. Ordinary enrollment remains sufficient for client booking. `Become a coach` now submits an application, allows only a hidden profile draft before approval and leaves publication, availability and new coach bookings unavailable until an owner-controlled review approves the exact pending revision.

### Changes and rationale

- Added current application state plus append-only review events. Applicant submission is idempotent, rejection can be resubmitted as a new revision and owner decisions require an expected current state, bounded reason, reviewer reference and policy version.
- Removed runtime access to historical self-activation. Existing non-demo user coach profiles migrate to hidden pending state; no legacy timestamp or profile field grants approval.
- Kept one account model and added onboarding intent instead of separate Auth populations. Approved and suspended coaches retain ordinary client capability.
- Restricted pending/rejected applicants to hidden draft editing. Approved and explicit demo coaches may publish and manage schedules; suspension atomically hides the profile, blocks new activity and preserves existing booking visibility/cancellation/completion.
- Added `Verified coach` only for current real approval, with the exact bounded explanation. The five fictional fixtures are explicit `Demo coach` records and never inherit platform verification.
- Added a dry-run-first owner command for approval/rejection/suspension. Exact target confirmation is required for apply; output is bounded and excludes the database URL.

### Affected files

| File or component                                                                                                                                                                                               | Change and purpose                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`supabase/migrations/20261008000300_require_verified_coach_access.sql`](../../../supabase/migrations/20261008000300_require_verified_coach_access.sql)                                                         | Adds application/review persistence, grants, row-level security, submission/review/trust functions, migration handling and approved-only profile enforcement.              |
| [`src/server/db/schema/coach-applications.ts`](../../../src/server/db/schema/coach-applications.ts) and [`src/server/db/authorization/repository.ts`](../../../src/server/db/authorization/repository.ts)       | Mirror application state and derive the actor's bounded `not-applied`/lifecycle/demo access projection.                                                                    |
| [`src/server/coaches/service.ts`](../../../src/server/coaches/service.ts) and coach repositories                                                                                                                | Replace activation with application submission and enforce approval for publication and schedule mutation while preserving private drafts and existing-booking recovery.   |
| [`src/features/auth/sign-in.tsx`](../../../src/features/auth/sign-in.tsx), [`src/features/coaches/coach-application-gate.tsx`](../../../src/features/coaches/coach-application-gate.tsx) and coach pages        | Present separate client/coach entry intent, truthful pending/rejected/suspended states and approved-only workspace access.                                                 |
| [`src/features/coaches/coach-discovery.tsx`](../../../src/features/coaches/coach-discovery.tsx) and [`src/features/coaches/coach-explore-results.tsx`](../../../src/features/coaches/coach-explore-results.tsx) | Render accessible verified/demo labels and explain the deliberately narrow verification claim.                                                                             |
| [`scripts/review-coach-application.mjs`](../../../scripts/review-coach-application.mjs) and [`README.md`](../../../README.md)                                                                                   | Provide and document the guarded interim review workflow and policy checklist without making the owner credential a runtime variable.                                      |
| Database, unit, component and browser tests under [`supabase/tests/`](../../../supabase/tests/) and [`tests/`](../../../tests/)                                                                                 | Cover privileges, migration invariants, submission/decision concurrency, approval isolation, suspension/recovery, trust labels and responsive onboarding/scheduling flows. |
| [`docs/mvp-spec.md`](../../../docs/mvp-spec.md)                                                                                                                                                                 | Replaces immediate self-activation with the confirmed platform-review lifecycle, badge semantics and acceptance behavior.                                                  |

### Decisions and deviations

- 2026-10-08: The user prioritized client/coach separation now and deferred the admin panel. The ticket therefore includes a guarded manual approval path and makes DEV0148 a non-blocking downstream interface.
- 2026-10-08: Pre-implementation review confirmed one cohesive vertical slice. Splitting schema authority, onboarding gates or the badge would create a misleading/self-approved intermediate state, while the independent staff interface remains correctly isolated in DEV0148.
- 2026-10-08: Adopted `app.coach_applications`, `app.coach_application_review_events`, `app.submit_owned_coach_application()` and owner-only `app.review_coach_application(...)` as the concrete persistence/mutation boundary. Adopted policy `movx-identity-application-v1` and the bounded public claim recorded above.
- 2026-10-08: Explicit `is_demo` state, rather than fixture provenance alone, preserves local provisioned fictional profiles as operational demo coaches without presenting them as verified. User-created legacy coach profiles fail closed as hidden pending applications.
- 2026-10-08: Suspended coaches may read and resolve already-confirmed sessions but cannot publish, add availability or receive a new booking. This preserves both parties' recovery path without retaining public coach authority.

### Contracts, configuration, and operations

Added `app.coach_applications`, append-only `app.coach_application_review_events`, `coach_profiles.is_demo`, actor-scoped submission, owner-only expected-state review and the `demo`/`verified` trust projection. Removed `app_runtime` execution of `app.activate_owned_coaching()`; `coaching_activated_at` remains historical only. The review command uses a separate operator-only `COACH_REVIEW_DATABASE_URL`, which is neither an application nor Vercel runtime variable. The forward migration preserves profile and booking rows; rollback after decisions requires a reviewed forward correction rather than deleting review evidence. No credential documents are stored.

## Validation results

| Criterion | Evidence                                                                                                                                                                                                                                                                                                       | Result |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | `npm run test:auth` completed real local email-code client and coach-intent onboarding at desktop/mobile widths; both paths produced one ordinary profile/account and the coach path reached pending private-draft state.                                                                                      | Passed |
| AC2       | `npm run db:test` passed 152 pgTAP assertions; `npm run test:db` passed 31 runtime integration tests including direct-write denial, runtime review denial, idempotent replay, stale conflict and competing expected-state decisions.                                                                           | Passed |
| AC3       | Runtime integration tests proved pending visibility rejection, approved publication/scheduling, cross-account isolation and suspension blocking new availability/bookings while allowing existing-session cancellation and ordinary client-booking reads.                                                      | Passed |
| AC4       | `npm test` passed 61 unit/component tests including exact verified/demo copy; migration/seed checks prove five fixtures are demo records with no approval application, while public database projection returns `verified` only after owner approval.                                                          | Passed |
| AC5       | `npm run test:coach-availability` exercised the command's dry run, asserted no connection URL in output, applied an exact confirmed approval, published the coach and completed desktop/mobile schedule interaction. `npm run coach:review -- --help` also passed.                                             | Passed |
| AC6       | Full `npm run db:reset` replay and repeat seed passed. `npm run build`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `git diff --check` and clean-baseline `npm run test:e2e` (28/28 desktop/mobile tests) passed. `npm run db:lint` exited successfully with only existing pgTAP diagnostics. | Passed |
| AC7       | Specification, root/database runbooks, schema/service comments and this implementation record now describe the delivered contract, operator policy, migration behavior and limitations.                                                                                                                        | Passed |

## Risks, limitations, and follow-ups

- Verification creates a trust claim. Copy, review policy and operational practice must remain aligned; approval must not imply guarantees that MovX did not actually assess.
- Manual review is intentionally less convenient than DEV0148; the delivered command is exact-target, dry-run-first, attributable and auditable.
- Collecting or storing verification documents later requires a separate privacy, access-control and retention review.
- [DEV0148](../../current/frontend/DEV0148-add-coach-review-admin-panel.md) adds the lower-priority staff interface after this lifecycle is stable.

## Completion and review references

- Completed: 2026-10-08.
- Commit: Included in `[DEV0147][DEV0148][DEV0149][DEV0150][DEV0151] Publish standalone scheduling platform`.
- Review: Self-review against AC1–AC7 completed; no external review or pull request exists.
- Deployment or release: Not deployed.
