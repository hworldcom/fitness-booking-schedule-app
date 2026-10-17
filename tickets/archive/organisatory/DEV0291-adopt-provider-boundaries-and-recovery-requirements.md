# Ticket DEV0291: Adopt provider boundaries and recovery requirements

- Status: Completed
- Created: 2026-10-17
- Last updated: 2026-10-17
- Milestone: Provider boundaries and operational recovery
- Coordination: None — independent development ticket
- Related records: Independent implementation follow-ups [DEV0292](../../current/backend/DEV0292-isolate-profile-image-storage-adapter.md) and [DEV0293](../../current/backend/DEV0293-rehearse-database-auth-and-file-recovery.md); Auth workstream [COR0027](../../current/organisatory/COR0027-login-registration-and-social-authentication.md), with implementation owned by its existing peers; historical boundary baseline [DEV0025](../backend/DEV0025-nextjs-backend-boundary.md).

## Objective and context

Record the user's 17 October 2026 direction: keep the code modular enough for future provider changes and test recovery of the complete application. Audit the existing boundaries and assign concrete acceptance criteria to their implementation owners. This ticket owns the documentation/coordination refinement only; it must not claim that provider portability or disaster recovery has already been implemented.

Use the current [architecture](../../../docs/mvp-spec.md#6-application-and-infrastructure-boundaries), [identity/privacy](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity), [definition of done](../../../docs/mvp-spec.md#11-definition-of-done), [milestones](../../../docs/mvp-spec.md#12-delivery-milestones) and [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix). These are linked independent records, not a child-ticket hierarchy or additional COR0027 members.

## Scope and non-goals

In scope: read-only architecture/import audit, existing boundary-test evidence, confirmed-versus-proposed requirements in the specification, clear ownership across COR0027 and independent Storage/recovery tickets, and index/link consistency. Out of scope: Auth or Storage refactors, identity/schema migrations, backup/restore operations, hosted changes and production deployment.

## Expected behavior and edge cases

MovX profile IDs remain durable business identities; provider credentials resolve to profiles through a verified boundary. Services own application permissions and scheduling semantics; provider-specific Auth/Storage code belongs in narrow adapters and database access stays server-only. PostgreSQL/Auth schema coupling is explicit rather than declared portable by interfaces alone. Recovery means restoring records, identities and file bytes, then proving real authorized application behavior; it is distinct from password recovery.

## Assumptions, decisions, and dependencies

Confirmed: modularity and actual recovery testing. Existing server/db/feature/domain separation and independent profile IDs are useful foundations. The sign-in screen currently calls Supabase Auth directly; the session provider uses a vendor event type, image services call Storage directly and profiles reference auth.users. These are factual audit findings. Keep Supabase for current implementation as previously recommended; no provider migration is requested. The user asked for a sensible starter proposal: UAT up to 24 hours of lost changes, early production up to 1 hour, and a 4-hour recovery objective, with detection/response/restore/verification measured separately. These remain proposed and unproven, not adopted service commitments. No fake provider implementation or broad rewrite is required.

## Implementation plan

1. Inspect existing SDK imports, identity references, repositories, Storage use and boundary checks; distinguish source findings from tested behavior.
2. Add confirmed modularity/recovery requirements to the specification and focused acceptance criteria to COR0027 peers; retain their existing direct memberships.
3. Create independent Storage-adapter and complete-recovery rehearsal records with explicit dependencies and no overlap with retained-volume continuity.
4. Run relevant existing boundary/Auth/authorization/config checks plus documentation/record validation; finish this documentation ticket while keeping runtime implementation peers open.

## Acceptance criteria

- [x] AC1: The specification distinguishes confirmed modularity/recovery goals from proposed operating targets and current implementation limitations.
- [x] AC2: Every required provider-boundary/recovery deliverable has one named implementation owner; current identity/permission rules and original data are preserved.
- [x] AC3: Existing boundary/Auth/authorization/config checks and scoped document/record checks are recorded accurately, including any blocked or not-run restore checks.
- [x] AC4: The handoff distinguishes completed planning/audit from pending refactors and an actual full-stack recovery rehearsal; no deployment/provider swap is implied.

## Validation plan

Run existing tests/boundaries.test.ts, tests/auth.test.ts, tests/authorization.test.ts and tests/database-config.test.ts using the installed tsx runner. Inspect SDK call sites and schema references. Validate changed links/anchors, unique IDs, index/status/membership consistency and Markdown/whitespace. Runtime refactor/build/restore validation is not this documentation ticket's acceptance; the linked implementation tickets own it.

## Implementation record

### Changes and rationale

2026-10-17: Read-only audit confirmed the boundaries and remaining coupling above. Created this ticket before editing the specification/peer plans. No application source, schema, provider setting or data changed. The local Node version is 24.21.0. Initial sandboxed Docker inventory failed on socket permissions; an approved read-only inventory then identified the existing movx-club-local stack. Supabase CLI --version also tried to write telemetry outside the allowed roots and failed. No restore was attempted.

### Affected files

- [Specification](../../../docs/mvp-spec.md#61-provider-boundaries-and-operational-recovery): adds confirmed C42, actual coupling findings, owner boundaries, restore acceptance and clearly proposed recovery objectives.
- [Index](../../README.md): records this completed audit and independent implementation follow-ups, preserving unique IDs and unrelated edits.
- [COR0027](../../current/organisatory/COR0027-login-registration-and-social-authentication.md), [DEV0285](../../current/organisatory/DEV0285-define-multi-method-authentication-contract.md), [DEV0286](../../current/backend/DEV0286-implement-password-authentication-and-recovery.md), [DEV0287](../../current/backend/DEV0287-integrate-google-and-apple-authentication.md) and [DEV0288](../../current/frontend/DEV0288-redesign-multi-method-login-and-registration.md): add concrete Auth gateway/adapter/UI acceptance without changing direct membership or duplicating runtime ownership.
- [DEV0292](../../current/backend/DEV0292-isolate-profile-image-storage-adapter.md) and [DEV0293](../../current/backend/DEV0293-rehearse-database-auth-and-file-recovery.md): create Storage isolation and actual complete restore work as independent tickets.
- Audit-only sources: [database client](../../../src/server/db/client.ts), [profile/Auth references](../../../src/server/db/schema/foundation.ts), [server session verification](../../../src/server/auth/session.ts), [client session events](../../../src/auth/client/session-provider.tsx), [sign-in screen](../../../src/features/auth/sign-in.tsx), [image service](../../../src/server/profile-images/service.ts) and [boundary tests](../../../tests/boundaries.test.ts). No source edits in this ticket.

### Decisions and deviations

2026-10-17: Preserve existing providers and application authority while reducing specific coupling. Keep disaster recovery separate from password reset and retained-volume migration repair. No runtime deviation; implementation choices remain scoped to this record.

### Contracts, configuration, and operations

This planning checkpoint changes documentation only. No runtime interfaces, dependencies, schema, credentials, provider settings, environment values or hosted operations changed. Future interface/configuration/rollback requirements must be recorded before implementation. No passwords, tokens, private data or backup contents belong in tickets.

## Validation results

- Date/environment: 2026-10-17, repository review with Node 24.21.0.
- Passed `node --import tsx --test tests/boundaries.test.ts tests/auth.test.ts tests/authorization.test.ts tests/database-config.test.ts`: 19 tests, zero failures/skips. This proves existing import/server/database boundaries, identity/config normalization, safe returns and actor-generation binding; it does not establish future adapter contracts or disaster recovery.
- Passed `python3 /tmp/dev0291-validate-planning.py`: scoped document links/anchors, unique IDs, independent versus COR membership, index/status/lifecycle/template checks and next IDs DEV0294/COR0028. It also checks that recovery objectives are labelled proposed and current versus target claims remain separate. Final counts are recorded after archival below.
- Passed focused installed Prettier over this ticket, DEV0292/DEV0293 and the five modified Auth records, plus scoped `git diff --check` for these files, the specification and index. Formatting remains limited to owned/modified records to preserve unrelated work.
- Read-only environment observations: Node 24.21.0 and existing local Auth/Storage/database/gateway/mail services. Default sandbox Docker access failed; an approved inventory succeeded. The CLI version attempt failed while writing telemetry outside allowed roots. No backup/restore/app-source command ran, and no provider/account/settings change occurred. Application lint/type/build and new browser/database/restore checks were not run because this ticket changes documentation; future implementation criteria still require them.
- New runtime refactor/recovery checks: not run; planning does not establish these results.
- Final archival validation passed: `python3 /tmp/dev0291-validate-planning.py` resolved 386 local links and 58 anchors across 10 scoped documents, verified 205 unique records and confirmed this ticket is Completed/archived with one index row. Independent DEV0294 was allocated concurrently; next IDs advanced to DEV0295/COR0028 and that unrelated work was preserved. COR0027 still has the same five direct peers; DEV0292/DEV0293 remain independent Draft records.

| Criterion | Evidence                                                                                                                                               | Result |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| AC1       | Specification C42 and section 6.1 record confirmed goals, actual gaps and explicitly proposed RPO/RTO targets.                                         | Passed |
| AC2       | Auth gateway/provider/UI owned by DEV0286/0287/0288; Storage by DEV0292 and restore by DEV0293; independent membership and reciprocal COR map checked. | Passed |
| AC3       | All 19 current tests and scoped document/record checks pass; sandbox/CLI failures and unperformed recovery are recorded accurately.                    | Passed |
| AC4       | Source is unchanged; independent runtime tickets remain Draft and full-system restoration is explicitly unperformed.                                   | Passed |

## Risks, limitations, and follow-ups

This audit/requirement adoption is complete; provider refactors and recovery remain unfinished. Next actions: DEV0285 adopts the concrete Auth boundary before its runtime peers start; DEV0292 inventories and extracts Storage I/O; DEV0293 specifies an isolated target/artifact strategy, then runs the actual full-stack rehearsal. The proposed UAT RPO 24h, production RPO 1h and RTO 4h are not selected commitments or observed results. Existing unrelated changes were preserved.

## Completion and review references

- Completed: 2026-10-17 — documented the audit, concrete ownership and proposed recovery targets; all documentation-ticket acceptance criteria passed. Runtime implementation and actual restore are not completed.
- Commit: This user-authorized workspace checkpoint includes the completed audit/requirements record (subject includes DEV0291); Storage refactor and full restore remain future independent work.
- Review: Source/planning self-review only; no independent review.
- Deployment or release: None.
