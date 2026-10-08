# Ticket DEV0165: Implement the account-deletion lifecycle

- Status: Draft
- Created: 2026-10-08
- Last updated: 2026-10-08
- Milestone: Native iOS account lifecycle and App Store compliance
- Coordination: [COR0013 — Native iOS application](../organisatory/COR0013-native-ios-application.md)
- Related records: depends on the retention decision in [DEV0159 — Adopt the native iOS contract](../organisatory/DEV0159-adopt-native-ios-contract.md), the bearer boundary in [DEV0160 — Expose the mobile scheduling API](DEV0160-expose-mobile-scheduling-api.md) and the authenticated app foundation in [DEV0161 — Establish the Expo iOS foundation](../frontend/DEV0161-establish-expo-ios-foundation.md); blocks [DEV0166 — Prepare iOS distribution](../frontend/DEV0166-prepare-ios-distribution.md)

## Objective and context

Allow a person who creates a MovX account to initiate deletion from inside the iOS app and receive a clear, secure outcome. Reconcile Supabase Auth identity, application profiles, private/public images, coach authority, future bookings and retained scheduling/review evidence according to the contract adopted by DEV0159.

This is a product data-lifecycle capability, not a UI-only compliance checkbox. It must avoid orphaned authority, dangling private media, unexpected publication or historical records that still identify a deleted person contrary to the adopted policy.

## Scope and non-goals

- In scope: confirmed deletion/retention contract implementation; recent-auth or email-code confirmation; cancellation/handling of future bookings; transactional profile/capability cleanup or anonymization; Supabase Auth deletion through a server-only privileged boundary; Storage cleanup; idempotent retry/recovery; audit-safe status; native initiation/confirmation/result UI; website path or documentation if the contract requires cross-surface access; database/service tests and operator recovery guidance.
- Out of scope: inventing legal retention periods, bulk staff user administration, account suspension, exporting personal data, deleting immutable evidence contrary to the adopted contract, hiding a deactivation behind “delete,” or exposing a service-role credential to either client.

## Expected behavior and edge cases

- The deletion option is discoverable in the signed-in native account settings and clearly describes immediate and retained effects before confirmation.
- A stale or stolen session cannot delete the account without the contract-defined recent verification.
- Future confirmed bookings and public coach availability/profile state are resolved in the specified order so other users are not left with misleading active commitments.
- Private avatar/public portrait objects and references are removed or retained only as the contract permits; failure does not leave an active public coach with a deleted identity.
- Historical booking/review rows are deleted, anonymized or retained exactly as DEV0159 specifies, with no undocumented personal identifiers.
- Retrying after network/process failure is safe and reports pending/completed/manual-recovery status without re-creating identity.
- Completion signs the device out and prevents the deleted account from continuing to call authenticated APIs.

## Assumptions, decisions, and dependencies

- DEV0159 must resolve what happens to historical bookings, coach-review evidence and future commitments. Until then this ticket is not Ready.
- Supabase Auth administrative deletion requires a server-only privileged capability and must be isolated from the ordinary runtime database login and mobile bundle.
- Prefer an idempotent staged workflow with durable status over pretending Auth, PostgreSQL and Storage can commit in one physical transaction.
- Deletion must work for ordinary clients, applicants, approved/suspended coaches and local/demo distinctions without deleting shared fictional fixture data incorrectly.
- Public release remains blocked until this flow has physical-device and hosted evidence.

## Implementation plan

1. Translate DEV0159's retention matrix into explicit database/service transitions and recovery states.
2. Add a recent-verification and deletion-initiation API that derives the actor from the verified bearer session.
3. Resolve future bookings/public coach state, clean or anonymize application data and media, then delete/revoke the Auth identity through the server-only boundary.
4. Add native settings, warning, confirmation, pending/failure/completion and sign-out states.
5. Add idempotency, cross-account, partial-provider-failure, role-state and data-retention tests.
6. Rehearse local and hosted deletion for representative client and coach accounts and document operator recovery without recording personal data or credentials.

The proposed scope is one cross-system lifecycle vertical slice. If the adopted contract requires a separately scheduled export or long-running retention job, update/split this ticket before implementation.

## Acceptance criteria

- [ ] AC1: Every account type can initiate deletion in-app after the required verification and receives accurate consequences/status.
- [ ] AC2: Future bookings, public coach state, application/profile data, images, Auth identity and historical records follow the adopted retention matrix without unauthorized cross-account effects.
- [ ] AC3: Retries and failures across PostgreSQL, Storage and Auth are idempotent, observable and recoverable without restoring deleted authority.
- [ ] AC4: Completed deletion revokes/signs out the device and blocks further authenticated access; stale tokens cannot mutate data.
- [ ] AC5: Database/service/native tests plus local and hosted physical-device rehearsals pass, with recovery and privacy implications documented.

## Validation plan

Add database and service tests for ordinary client, pending/rejected applicant, approved/suspended coach, unrelated actor, future/terminal bookings, images, retry and each simulated provider failure point. Add native accessibility/request-state tests for confirmation and completion. Rehearse representative local accounts, then hosted disposable accounts with explicit operator approval. Run relevant database, Auth, API, mobile, web regression, lint, type and build checks.

## Implementation record

Pending implementation.

### Changes and rationale

Pending implementation.

### Affected files

| File or component                   | Change and purpose                                    |
| ----------------------------------- | ----------------------------------------------------- |
| Product/database deletion contracts | Planned explicit retention/anonymization transitions. |
| Server deletion service/API         | Planned privileged, idempotent orchestration.         |
| Native account settings             | Planned initiation, verification and outcome UI.      |

### Decisions and deviations

Historical-retention and future-booking decisions are intentionally unresolved until DEV0159. No default is silently adopted here.

### Contracts, configuration, and operations

This work may require a new server-only Auth administration secret or provider credential in Vercel. If so, record the exact name, least-privilege handling, local substitute, rotation and rollback behavior without ever recording its value. Database migrations must be additive and recovery-safe.

## Validation results

Pending validation.

| Criterion | Evidence                                   | Result  |
| --------- | ------------------------------------------ | ------- |
| AC1       | Role-state native/API tests                | Not run |
| AC2       | Retention and cross-account database tests | Not run |
| AC3       | Retry/provider-failure tests               | Not run |
| AC4       | Revocation/stale-session tests             | Not run |
| AC5       | Local/hosted physical-device matrix        | Not run |

## Risks, limitations, and follow-ups

Auth, database and Storage cannot share one transaction, so interruption recovery is a core requirement. Legal retention policy may require owner input outside engineering; keep the ticket Draft until that policy is bounded. Never test hosted deletion against irreplaceable accounts.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: No review created.
- Deployment or release: Not deployed or rehearsed.
