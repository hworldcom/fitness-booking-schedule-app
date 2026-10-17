# Ticket DEV0292: Isolate the profile image storage adapter

- Status: Draft
- Created: 2026-10-17
- Last updated: 2026-10-17
- Milestone: Provider boundaries and operational recovery
- Coordination: None — independent development ticket
- Related records: Requirements/audit [DEV0291](../../archive/organisatory/DEV0291-adopt-provider-boundaries-and-recovery-requirements.md); independent operational rehearsal [DEV0293](DEV0293-rehearse-database-auth-and-file-recovery.md); Auth boundary dependency [DEV0286](DEV0286-implement-password-authentication-and-recovery.md).

## Objective and context

Contain Supabase Storage integration behind a narrow server-only adapter so future storage-provider changes do not require rewriting image validation, media permissions or profile behavior. This is a focused implementation follow-up to DEV0291's provider-coupling audit.

Use the current [architecture](../../../docs/mvp-spec.md#6-application-and-infrastructure-boundaries), [identity/privacy](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity), [definition of done](../../../docs/mvp-spec.md#11-definition-of-done), [milestones](../../../docs/mvp-spec.md#12-delivery-milestones) and [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix). These are linked independent records, not a child-ticket hierarchy or additional COR0027 members.

## Scope and non-goals

In scope: inventory upload/read/remove/URL handling across profile and authorized message media, define typed application-owned Storage results, extract the concrete Supabase implementation, keep credential/session handling inside it and add meaningful contract/failure/privacy regressions. Out of scope: changing providers, copying buckets, new media/profile features, Auth redesign, rewriting database authority or performing backup/restore.

## Expected behavior and edge cases

Application services retain normalization, private-avatar/public-portrait rules, reference attachment and authorized actor checks. The adapter performs provider I/O and translates failures into bounded application results. Preserve current routes, content types, immutable object naming, cache/privacy headers, missing-image fallback and owner-scoped credentials. An adapter must not bypass Storage row-level security through a privileged key. Failed upload never attaches a missing object; failed cleanup must retain existing truthful behavior.

## Assumptions, decisions, and dependencies

Existing image service calls client.storage directly and receives Auth client configuration; first inventory all related reads before choosing the final interface. Keep request/session scope and existing profile/booking/connection/message media grants. DEV0286 owns Auth gateways; this ticket owns Storage only. Existing provider-specific URL compatibility and SQL policies remain explicit; no claim of a universal interchangeable storage system.

## Implementation plan

1. Inventory all live Storage operations and identify the smallest shared server interface, result/error contracts and concrete provider module.
2. Move provider I/O/configuration into the adapter while services retain validation/authorization/reference semantics and existing outward contracts.
3. Add meaningful upload/read/cleanup failure and privacy tests; extend import checks so new Storage SDK calls stay in the provider boundary.
4. Run relevant image/message/Auth tests, real local private/public image flows, lint/typecheck/build and desktop/mobile recovery where UI/media behavior is affected.

## Acceptance criteria

- [ ] AC1: Live Storage I/O and provider-specific configuration are confined to a documented server adapter; feature/business modules use application-owned contracts.
- [ ] AC2: Upload/read/removal and missing/unavailable responses preserve existing identities, references, media scopes, byte normalization and outward route/cache behavior.
- [ ] AC3: Meaningful failure/authorization checks prove no missing-object attachment, privacy bypass or stale-actor media leak; import boundaries prevent new provider leakage.
- [ ] AC4: Relevant automated/build checks and real local private-avatar/public-portrait/media smoke pass with exact fixture cleanup and a complete implementation record.

## Validation plan

Use existing profile-image/message/authorization tests and the guarded npm run test:profile-images rehearsal where appropriate. Add adapter behavior tests for unavailable storage, rejected bytes/identity, upload-before-reference failure and deletion cleanup. Verify authorized and wrong-actor reads, object bytes, unchanged outward URLs and source privacy controls. Run applicable lint/typecheck/format/build and browser flows; simulated adapters do not replace real local Storage success evidence.

## Implementation record

### Changes and rationale

Not started. Created during DEV0291 planning. No Storage code, object, policy, account or reference has changed.

### Affected files

Planned: src/server/profile-images/service.ts, authorized media readers, a focused server Storage adapter/contract, existing image/message tests and tests/boundaries.test.ts. Final file list follows the inventory; preserve unrelated media/messaging changes.

### Decisions and deviations

2026-10-17: Preserve existing providers and application authority while reducing specific coupling. Keep disaster recovery separate from password reset and retained-volume migration repair. No runtime deviation; implementation choices remain scoped to this record.

### Contracts, configuration, and operations

This planning checkpoint changes documentation only. No runtime interfaces, dependencies, schema, credentials, provider settings, environment values or hosted operations changed. Future interface/configuration/rollback requirements must be recorded before implementation. No passwords, tokens, private data or backup contents belong in tickets.

## Validation results

- Date/environment: 2026-10-17, repository review with Node 24.21.0.
- Planning documentation/link/ID/membership checks passed under archived DEV0291. Existing boundary/Auth/config checks passed 19 tests. This is not implementation evidence for this ticket; its adapter/recovery criteria remain Not run.
- New runtime refactor/recovery checks: not run; planning does not establish these results.

| Criterion | Evidence                                                              | Result  |
| --------- | --------------------------------------------------------------------- | ------- |
| AC1–AC4   | Required work/evidence is recorded above; validation remains pending. | Not run |

## Risks, limitations, and follow-ups

Next: inventory the real read/write paths and specify the narrow adapter before implementation. Do not weaken private-media authority to make provider replacement simpler; do not change current provider or migrate files under this refactor.

## Completion and review references

- Completed: Not completed.
- Commit: Planning record included in the user-authorized workspace checkpoint under DEV0291; no runtime implementation commit or completed acceptance is claimed.
- Review: Source/planning self-review only; no independent review.
- Deployment or release: None.
