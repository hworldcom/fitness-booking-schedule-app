# Ticket DEV0187: Persist coach booking policies

- Status: Draft
- Created: 2026-10-10
- Last updated: 2026-10-10
- Milestone: Scheduling-only booking-policy follow-up
- Coordination: [COR0016 — Coach-confirmed booking requests](../organisatory/COR0016-coach-confirmed-booking-requests.md)
- Related records: contract dependency [DEV0186 — Adopt booking-request and notice policies](../organisatory/DEV0186-adopt-booking-request-and-notice-policies.md), request consumer [DEV0188 — Persist multi-candidate booking requests](DEV0188-persist-multi-candidate-booking-requests.md), availability baseline [DEV0177 — Bind availability to training locations](../../archive/backend/DEV0177-bind-availability-to-training-locations.md)

## Objective and context

Persist an owner-controlled booking policy and make public occurrence eligibility truthful. Current open occurrences are immediately bookable at any future instant within the seven-day publication horizon. Coaches need an explicit instant/approval mode and a minimum-notice cutoff enforced by the same database authority that protects capacity.

## Scope and non-goals

- In scope:
  - Add additive, versioned coach policy storage for confirmation mode and minimum-notice duration.
  - Backfill every existing coach to instant booking with zero notice.
  - Add owner-authorized policy mutation with optimistic conflict detection and bounded allowed values.
  - Project policy-aware action mode, cutoff and eligibility for public coach occurrences.
  - Enforce current policy atomically during instant booking and provide the authoritative check used by DEV0188 requests.
- Out of scope:
  - Pending-request persistence and selection owned by DEV0188.
  - Coach/client policy interfaces owned by DEV0189/DEV0190.
  - Configurable publication horizons, per-location/per-slot policies, notifications or attendance confirmation.

## Expected behavior and edge cases

- Existing behavior remains unchanged after migration until a coach explicitly changes policy.
- Only the approved/demo coach owner can update policy; pending, rejected, suspended and unrelated actors fail closed.
- Eligibility compares the database statement timestamp to the occurrence start and stored policy; browser time cannot authorize a booking/request.
- Policy changes affect new actions only. Existing confirmed bookings and pending requests retain their recorded policy/deadline snapshots.
- An ineligible public occurrence remains truthful: the projection distinguishes unavailable-by-notice from booked/withdrawn/database-unavailable state.
- Stale versions, unsupported durations, cross-run actors and malformed payloads fail without partial changes.

## Assumptions, decisions, and dependencies

- DEV0186 must complete before this ticket becomes Ready.
- Prefer a one-row-per-coach policy relation with a version and timestamps so future booking rules do not inflate the public profile table; record a different choice before implementation.
- Keep the seven-day publication horizon unchanged. Maximum-advance configurability is not part of this ticket.
- Policy checks must be reusable by the existing instant-booking mutation and DEV0188's request mutation without duplicating eligibility logic.

## Implementation plan

1. Review DEV0186 and current coach/availability/booking migration conventions.
2. Add policy schema, constraints, default backfill, grants and owner mutation/query functions.
3. Add domain validation and coach/public repository/service projections.
4. Integrate the eligibility check into instant booking and expose it for request creation.
5. Add fresh/upgrade migration, authorization, concurrency, projection and compatibility tests.

## Acceptance criteria

- [ ] AC1: Every existing coach receives versioned instant/zero-notice behavior without changing current bookability.
- [ ] AC2: Authorized coaches can save supported modes/notices with optimistic conflicts; unauthorized or malformed requests fail closed.
- [ ] AC3: Public projections distinguish instant, request and notice-ineligible actions using server-derived cutoffs.
- [ ] AC4: Instant booking rechecks policy atomically and policy edits do not mutate prior requests/bookings.
- [ ] AC5: Fresh/upgrade migration, database, unit, lint, type and build validation pass.

## Validation plan

- Run fresh and upgrade Supabase migrations plus database lint.
- Add pgTAP/database integration checks for backfill, constraints, owner authorization, stale versions, policy snapshots and atomic instant-booking cutoffs.
- Add domain/service tests for supported values and public eligibility projections.
- Run configured test, lint, type-check, format and production-build commands.

## Implementation record

Pending implementation.

### Changes and rationale

Pending implementation.

### Affected files

| File or component | Change and purpose |
| ----------------- | ------------------ |
| Pending           | Pending.           |

### Decisions and deviations

No implementation decisions or deviations recorded yet.

### Contracts, configuration, and operations

Expected changes are one additive migration and bounded policy projections/actions. No external service or environment-variable change is planned.

## Validation results

Pending validation.

- Date and environment: Not run.
- Exact commands and outcomes: Not run.
- Manual steps and observed outcomes: Not run.
- Failed, blocked, or not-run checks: All checks await DEV0186 and implementation.

| Criterion | Evidence | Result  |
| --------- | -------- | ------- |
| AC1       | Pending  | Not run |
| AC2       | Pending  | Not run |
| AC3       | Pending  | Not run |
| AC4       | Pending  | Not run |
| AC5       | Pending  | Not run |

## Risks, limitations, and follow-ups

- Public eligibility is informational; every mutation must repeat the database check to prevent clock drift or stale-page bypass.
- Per-location and per-slot policies would materially expand the model and require a later contract.

## Completion and review references

- Completed: Not completed.
- Commit: Planning record included in this commit — `[DEV0182][DEV0183][DEV0184][DEV0185][DEV0186][DEV0187][DEV0188][DEV0189][DEV0190] Plan session collaboration and booking requests`; implementation not started.
- Review: No review created.
- Deployment or release: Not deployed or released.
