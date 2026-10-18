# Ticket DEV0329: Remove requested registration account again

- Status: Completed
- Created: 2026-10-17
- Last updated: 2026-10-17
- Milestone: Registration test preparation
- Coordination: None — independent development ticket
- Related records: prior absence-only [DEV0323](DEV0323-remove-requested-registration-test-account.md); independent optional-photo [DEV0328](../frontend/DEV0328-offer-optional-registration-profile-picture.md).

## Objective and context

The user again explicitly requested removing `hoangworldcom@gmail.com` after registration testing. Re-inventory development state rather than assuming the earlier absence persists. Follow [identity/data rules](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity).

## Scope and non-goals

Exact-email account inventory/deletion in the running local target; read-only hosted-dev inventory only if absent locally. Include safe account-owned profile/private/session/Storage records after dependency review. No production/older-staging operation, reset, broad cleanup, other-user deletion, SMTP change or external email.

## Expected behavior and edge cases

Identify the exact subject/profile and dependencies first. Remove an unused registration account with stale-ID/email guards and non-target preservation checks. If it owns substantive shared bookings/messages/coach history, describe that concrete consequence and clarify before deletion. If absent, report a no-op accurately. Verify account/profile/session/image absence and released username after actual deletion; preserve unrelated data.

## Assumptions, decisions, and dependencies

Exact removal is user-authorized. Local Docker is the current app target. Prior DEV0323 found absence and did not delete. Administration credentials stay in memory; no production mutation is authorized.

## Implementation plan

1. Exact local email/profile/dependency/Storage inventory; hosted dev lookup only if absent locally.
2. Preserve non-target fingerprints and remove only the unused target with stale-ID/email guards. Clarify substantive shared-history impact if found.
3. Verify absence, username release and non-target preservation; record operations without credentials/private content.

## Acceptance criteria

- [x] AC1: Exact subject/environment and related-data impact identified before deletion.
- [x] AC2: Requested unused account absent afterward; unrelated users/history/Storage preserved; no-op accurately reported if applicable.
- [x] AC3: Actual guards, operations, verification and limitations recorded.

## Validation plan

Exact queries/related counts before and after, scoped Auth administration, non-target data/Storage metadata fingerprints and exact object verification where applicable. Application tests do not apply to an operational deletion; DEV0328 owns feature checks.

## Implementation record

### Changes and rationale

Removed exactly the requested account from local `movx-club-local`. The target had one ordinary profile, one participant record and one pending coach application at revision 1, with no review events, coach profile, bookings, messages or owned Storage images. Deleted only its pending application/profile-owned rows and hashed email flows, then used the local managed Auth admin API to delete its exact subject and cascade its managed/application sessions. No username reservation was present; no other account/image/history was changed.

### Affected files

This record/index only. Private one-use helper stays outside repository source.

### Decisions and deviations

2026-10-17: local inventory found the account, so no hosted-dev lookup was needed. Its unreviewed pending application belonged only to the requested account and had no shared-history dependency. A first read-only probe assumed an application `id` column; it failed before mutation and was corrected to the actual `profile_id` key before deletion.

### Contracts, configuration, and operations

No product/schema/dependency/environment change. Exact requested deletion is permanent; no other identity action is authorized.

## Validation results

2026-10-17, existing local Docker only. Used installed Supabase JS 2.116.0 through the project-scoped admin interface; credentials stayed in memory.

- `node /tmp/dev0329-inventory.mjs`: exact case-insensitive email matched Auth subject `6a7b107d-4d7c-405b-bcb7-453565a0ded0` and ordinary profile `c350c687-537a-44f3-ac4c-4dabd4be1f20`. Foreign-key inventory found only the pending application and dataset participation; no private-details row or avatar reference.
- Corrected `node /tmp/dev0329-dependencies.mjs`: application pending/revision 1, zero review-event dependencies and zero account/coach Storage objects. The initial wrong-column read-only probe failed with 42703 and made no change.
- `node /tmp/dev0329-delete.mjs`: passed exact subject/email/profile/source guards, row locks, repeated dependency/status/review checks, targeted profile/application/participation/email-flow deletion and managed Auth `getUserById`/`deleteUser` identity verification. Verified zero target Auth/profile/application-session/managed-session rows. No Storage deletion was necessary.
- Before/after counts and ordered row fingerprints matched for all non-target rows across 46 tables covering application data, Auth users and Storage object metadata. Username reservation was absent. No hosted, production, older-staging, reset, seed, mail send or broad deletion occurred. Application tests are not applicable to this operational action; feature checks belong to DEV0328.

| Criterion | Evidence | Result |
| --- | --- | --- |
| AC1 | Exact local Auth/profile and pending-only dependency inventory before deletion. | Passed |
| AC2 | Target account/profile/sessions absent; non-target fingerprints across 46 tables unchanged; no images existed. | Passed |
| AC3 | Guarded local operations/probe correction and untouched hosted/production scope recorded. | Passed |

## Risks, limitations, and follow-ups

Do not destroy shared history under a fresh-registration assumption. This operation does not configure real inbox delivery or deploy Auth changes.

## Completion and review references

- Completed: 2026-10-17 — exact local account and pending application removed; unrelated data preserved.
- Commit: User-requested integration checkpoint on 2026-10-18, subject `[DEV0288][DEV0324][DEV0325][DEV0328][DEV0329] Complete registration and authentication frontend`.
- Review: Exact-target/dependency/guard/preservation self-review passed; no independent review.
- Deployment or release: None.
