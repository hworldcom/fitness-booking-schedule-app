# Ticket DEV0323: Remove requested registration test account

- Status: Completed
- Created: 2026-10-17
- Last updated: 2026-10-17
- Milestone: Registration test preparation
- Coordination: None — independent development ticket
- Related records: [DEV0322](DEV0322-remove-email-code-login.md), [DEV0286](../../current/backend/DEV0286-implement-password-authentication-and-recovery.md).

## Objective and context

Remove the exact account named by the user so they can test fresh registration. This is an explicitly requested operational deletion, separate from removing email-code login. Follow the [identity/data contract](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity); do not reset datasets or other accounts.

## Scope and non-goals

Inventory the exact address in the running local environment and, if absent there, the existing hosted dev project. Determine related profile/private records before deletion; record the selected target and verified result. No production operation, broad email-pattern cleanup, account merge, SMTP change or unsolicited registration/email send.

## Expected behavior and edge cases

Delete only the exact identified development/test account and its safe account-owned records, preserving other users and shared history. If substantial shared booking/message/coach data would be destroyed, prepare the concrete inventory and clarify that consequence rather than deleting unrelated history. Verify the exact email is absent after deletion. Absence locally does not establish absence in hosted dev.

## Assumptions, decisions, and dependencies

The user explicitly authorized deleting their named account. Current app bundles identify local Docker; read-only local inventory found no matching Auth account. Hosted-dev inventory is next. Do not infer production authorization. Keep credentials/proofs private and only use project-scoped administration.

## Implementation plan

1. Inventory exact account/linked profile/Storage and dependent records in the intended development target.
2. Resolve any environment/shared-data ambiguity, then perform only the requested exact deletion with stale-identity guards.
3. Verify account/profile/session removal and preserve non-target counts/fingerprints; record environment and outcome without credentials/private content.

## Acceptance criteria

- [x] AC1: Exact intended account and environment are identified, with related-data impact checked before deletion.
- [x] AC2: Requested account is absent afterward and no other account/shared history is removed.
- [x] AC3: Actual operations, verification and remaining limitations are recorded; no false claim of live-email registration or production changes.

## Validation plan

Read-only exact-email and dependency queries before/after; account API exact-ID lookup; pre/post counts/fingerprints of unaffected data where available. Application tests are not applicable to a one-account operational action; DEV0322 owns application behavior tests.

## Implementation record

### Changes and rationale

Read-only exact-address inventory returned zero matches in local Docker and hosted movx-dev. The user then explicitly selected “No deletion needed.” No account, profile, session, Storage object or other data was changed.

### Affected files

This operational record and ticket index. Private temporary inventory only if required; no general deletion API is added.

### Decisions and deviations

2026-10-17: user confirmed no deletion was needed after both development lookups found no account. No production or older-staging search/change occurred.

### Contracts, configuration, and operations

No product/schema/dependency/environment contract changes. Requested deletion is permanent; no other account operation is authorized here.

## Validation results

AC1: current app bundle identifies local Docker; local exact-email SQL returned zero, then a project-scoped hosted-dev listUsers lookup (bounded paging, exact case-insensitive filter) returned zero. AC2: no mutation occurred; no non-target data could be deleted. AC3: the user explicitly chose no deletion, completing this operational request. Application tests/fingerprints are not applicable because all actions were read-only.

2026-10-17: current app public bundles identify local movx-club-local Auth; exact local Auth lookup returned zero matches. The hosted movx-dev Auth admin API also returned zero exact-email matches. Credentials remained in memory, and no other user details were printed. The user confirmed “No deletion needed.”

## Risks, limitations, and follow-ups

No deletion was performed or needed; absence was verified in both current development targets. The current local app captures email in Mailpit; actual inbox registration delivery is a separate environment/setup concern.

## Completion and review references

- Completed: 2026-10-17 — verified absence in both development targets; user confirmed no deletion needed.
- Commit: Not created.
- Review: Self-review of exact-email queries/API paging and the explicit user response. No independent review.
- Deployment or release: None.
