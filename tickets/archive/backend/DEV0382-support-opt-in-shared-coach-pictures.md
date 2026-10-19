# Ticket DEV0382: Support opt-in shared coach pictures

- Status: Completed
- Created: 2026-10-19
- Last updated: 2026-10-20
- Milestone: UAT coach application image continuity
- Coordination: [COR0032 — Shared account and coach picture](../organisatory/COR0032-shared-account-and-coach-picture.md)
- Related records: [DEV0383](../frontend/DEV0383-select-and-preview-shared-coach-picture.md) (peer consumer and rollout); [DEV0292](../backend/DEV0292-isolate-profile-image-storage-adapter.md) (Storage dependency)

## Objective and context

The owner explicitly chose the same account picture for coach identity after their private account upload did not appear in coach previews. Provide a per-owner sharing choice and conditional image access without publishing unrelated users' private avatars. Contract: [profile images](../../../docs/mvp-spec.md#profile-images), [coach application](../../../docs/mvp-spec.md#coach-application-and-review), and [website owner previews](../../../docs/mvp-spec.md#19-coach-marketplace-cards-and-personal-websites).

## Scope and non-goals

- In scope: Additive migration, opt-in shared portrait reference, synchronized account replacement/removal version, owner selection/revocation API, conditional owner/public byte route, compatible image projections/URL validation across existing consumers, current specification and backend regression tests.
- Out of scope: Frontend controls, UAT rollout (DEV0383); automatic opt-in/backfill; account/coach approval or visibility changes; public access to other avatars; banner/media-gallery work; retained demo provisioning.

## Expected behavior and edge cases

Pending/rejected/approved/demo owners with a coach profile may choose their account picture. A shared portrait points to the account identity rather than duplicating private bytes. Its owner can view it while private; others receive bytes only when the coach is currently approved/demo, visible, in an active public dataset and has a publishable primary location. Missing account pictures show initials; replacement/removal invalidates old image versions while preserving the choice. Unsharing removes coach use without deleting the account picture. Separate approved portrait uploads may replace sharing without deleting private account bytes. Actor changes, stale writes, hidden/suspended profiles, stale image URLs and revocation during download fail closed.

## Assumptions, decisions, and dependencies

Use a new `account` portrait source with an owner-profile UUID marker and version, retaining existing fixture/storage references. An owner action explicitly opts in; migration changes no existing row's picture choice. The shared API route returns no-store bytes, reveals no private object path and rechecks the current grant/reference after download. Narrow Storage select policy permits only the current opted-in and publishable account object; no privileged Storage credential is introduced. DEV0383 consumes the stable selection API and owns exact UAT migration/release operations.

## Implementation plan

1. Add the next unused forward migration for the source constraint, compare-and-swap owner sharing function, account-image version synchronization, conditional public reference function and narrowly scoped Storage select policy. Keep existing rows and grants otherwise intact.
2. Extend semantic portrait projection/validation and Storage URL projection; integrate existing actor, discovery, booking, connections, messaging and group-media readers so opting in cannot break their bounded identity shapes.
3. Implement same-origin owner sharing API and owner/public image reads using existing request-scoped Storage, without elevated credentials; recheck authorization/version after I/O and keep cleanup restricted to superseded separate coach objects.
4. Update the current product contract. Validate the migration and private/public/ownership/replacement/removal/concurrency boundaries with isolated local data and real local Storage where needed; run unit/server, lint/types and build as appropriate. Record compatible rollback and rollout prerequisites for DEV0383.

## Acceptance criteria

- [x] AC1: Explicit owner sharing/revocation preserves private avatar bytes, existing identities, application/visibility state and all non-opted-in picture references.
- [x] AC2: Owner private reads work; anonymous/other reads require current publication and opt-in, with no private path disclosure and reference/version recheck after I/O.
- [x] AC3: Account replacement/removal and sharing/separate-portrait transitions remain coherent and do not delete current/shared account bytes; legacy media projections still work.
- [x] AC4: Migration, authorization/reference tests and required checks pass with preserved pre-existing local records and a documented frontend/rollout handoff.

## Validation plan

Inspect installed Next.js route-handler docs before API integration. Test migration constraints and owner-only SQL grants; pending/hidden/suspended/unshared denial; eligible public bytes; wrong-owner/stale commands; old-version denial and grant changes during download. Include real request-scoped Storage success, not only mocked adapters. Use uniquely tagged temporary local records and compare original records before/after; no reset or demo provisioning. Run relevant unit/server and database tests, clean-source lint/type checks, scoped formatting and an application build, coordinating the final hosted build with DEV0383.

## Implementation record

Implemented and validated; peer DEV0383 owns hosted migration, release and native visual checks.

### Changes and rationale

An explicit owner choice now stores portrait source `account`, the owner UUID marker and a millisecond version. No existing account opts in during migration. Pending owners can read the picture privately; anonymous/other readers need the existing approved/demo, visible, active-dataset and publishable-location gate. The image route checks the current reference before and after ordinary request-scoped Storage download, returns private/no-store bytes and exposes no private object path. Account replacement/removal advances the shared version while keeping the choice. Unsharing and separate-portrait replacement never delete private account bytes.

### Affected files

- [Migration](../../../supabase/migrations/20261019000200_shared_coach_account_picture.sql): strict source constraint, owner compare-and-swap function, replacement/removal trigger, public reference function and narrow current-object Storage read policy.
- [Profile image repository](../../../src/server/db/profile-images/repository.ts), [sharing service](../../../src/server/profile-images/shared-coach-picture.ts) and [download guard](../../../src/server/profile-images/shared-picture-workflow.ts): isolate SQL, bind writes to fresh owner identity, recheck references around I/O and restrict cleanup to separate portrait objects.
- [Owner selection API](../../../src/app/api/coach/portrait/account/route.ts) and [byte API](../../../src/app/api/coaches/portraits/[profileId]/route.ts): bounded same-origin POST/DELETE selection and versioned owner/public image reads.
- [Contracts](../../../src/profile-images/contracts.ts), [URL validation](../../../src/domain/profile-images.ts), [Storage projection](../../../src/server/storage/supabase-profile-images.ts) and repository readers under `src/server/db/{authorization,coaches,connections,messages,group-sessions}`: accept only account markers matching the expected coach UUID; preserve fixture/storage behavior.
- [Real Storage rehearsal](../../../scripts/rehearse-local-shared-coach-picture.ts), [local rehearsal helper](../../../scripts/lib/local-connection-rehearsal.ts), [reference tests](../../../tests/profile-images.test.ts) and [download tests](../../../tests/server/shared-picture-workflow.test.ts): isolated HTTP/Storage, race, privacy and cleanup evidence. Package/README expose `test:shared-coach-picture`; the specification records the explicit owner choice.

### Decisions and deviations

2026-10-19: Bind the owner choice to the coach profile rendered on the page using a strict `{profileId}` JSON body, checked against the freshly authorized actor before any mutation. This preserves the planned changed-account failure boundary even if another account signs in between page load and a click. The response remains the existing bounded image mutation snapshot. Local migration rehearsal also required the scoped application-management read flag to inspect pending/rejected status under forced row-level security; caller flags are restored.

### Contracts, configuration, and operations

New opt-in source and additive migration; no automatic data backfill. Owner POST/DELETE `/api/coach/portrait/account` accepts exactly `{profileId}` JSON and returns the existing bounded mutation snapshot. GET `/api/coaches/portraits/[profileId]?v=ISO_TIMESTAMP` uses only the UUID/version. New SQL functions use explicit grants; runtime receives no service key. No dependency/environment changes. Apply migration before code enables opt-in. After account-source rows exist, rollback must retain account-source parsers and byte API (this ticket provides a compatible backend checkpoint); older source requires revoking those exact sharing choices first, without deleting avatars. No secrets recorded.

## Validation results

2026-10-20, local Node 24.21 / Next 16.3.8 / Supabase CLI 2.120:

- `npm test`: 354 unit and 68 server tests passed (422 total), including strict shared URLs, post-download revocation/reference races and the peer preview-state tests. An initial boundary test correctly rejected SQL in a service; moved that query into the repository and reran successfully.
- `npm run lint` and `npm run typecheck`: passed in a clean tracked-source export with owned source/test overlays, excluding unrelated dirty files and ignored scratch code. Installed Next route-handler docs were read before integration.
- `npx supabase db push --local --dry-run` identified only the new migration; `npx supabase db push --local` applied it. All 56 existing app/Auth-user/Storage-object table fingerprints matched immediately after migration. During rehearsal the uncommitted function needed a scoped application-management read flag under forced row security; its local definition and new ledger statement were corrected to final source before validation.
- `npm run test:shared-coach-picture`: fresh production webpack build and all seven real HTTP/Storage scenario groups passed. Pending private owner bytes; anonymous/other/direct Storage denial; signed-out/origin/noncoach/changed-actor denial; published public bytes; hide/replacement/old-version denial; removal and subsequent replacement; unshare and separate portrait preservation; stale-write conflict and suspension. Exact tagged fixture cleanup and original profile/coach/application/Storage/Auth row hashes matched the rehearsal baseline. Evidence: ignored `test-results/dev0382-shared-picture/ab4c571a-e9c6-4a6b-ad43-7645423fc648/result.json`; build/log `work/dev0382/storage-rehearsal-release.log`.
- `DATABASE_TEST_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres npx tsx --conditions=react-server --test --test-concurrency=1 tests/database/profile-images.test.ts tests/database/coach-application.test.ts`: 6 passed, covering legacy portrait CAS, Storage namespace isolation and editable pending applications. All 55 non-Auth tables still match the pre-migration baseline after these tests; Auth-user count remains 11 but its content fingerprint differs from that earlier baseline; the cause is not established. The rehearsal's own before/after original Auth hashes passed; no retained account was edited by these tests.
- `npm run db:lint`: fails on pre-existing functions `accept_coach_booking_request` / `session_booking_detail` requiring actor settings, plus existing type/shadow/unused warnings in `public_session_type_times`, `public_private_schedule_preview` and `mail_rate`. No new function is reported. This broad diagnostic is recorded, not treated as a passed check or expanded into unrelated repairs.
- Production build passed in the isolated rehearsal source copy (`/private/tmp/movx-dev0382-j1WMRA`). No hosted write, approval, publication, seed/reset or retained-account repair occurred in this ticket. DEV0383 owns native responsive and hosted integration evidence.

| Criterion | Evidence                                                                                                              | Result |
| --------- | --------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Real Storage groups 1, 5–7; exact original-row preservation                                                           | Passed |
| AC2       | Groups 1–4, 7; four reference/I/O tests                                                                               | Passed |
| AC3       | Groups 4–7; legacy database and URL tests                                                                             | Passed |
| AC4       | Migration, 422 tests, 6 database tests, clean lint/types, production build; existing broad DB lint findings disclosed | Passed |

## Risks, limitations, and follow-ups

Portrait consumers validate discriminants independently today; account-source compatibility must be complete before opt-in is enabled. UAT application and publication state must remain unchanged. Required real Storage and privacy evidence cannot be replaced by screenshots alone.

## Completion and review references

- Completed: 2026-10-20.
- Commit: Backend source checkpoint `4649717`; integrated release `5640d9e` is recorded by peer DEV0383.
- Review: Self-reviewed source, grants, CAS/cleanup, acceptance evidence and ticket ownership; no independent review requested.
- Deployment or release: Owned by peer DEV0383; integrated UAT source `5640d9e` and migration `20261019000200` verified in its completed record.
