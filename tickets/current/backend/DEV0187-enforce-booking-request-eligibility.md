# Ticket DEV0187: Enforce booking-request eligibility

- Status: Ready
- Created: 2026-10-10
- Last updated: 2026-10-11
- Milestone: Scheduling-only booking-policy follow-up
- Coordination: [COR0016 — Coach-confirmed booking requests](../organisatory/COR0016-coach-confirmed-booking-requests.md)
- Related records: completed contract dependency [DEV0186 — Adopt booking-request and notice policies](../../archive/organisatory/DEV0186-adopt-booking-request-and-notice-policies.md), request consumer [DEV0188 — Persist multi-candidate booking requests](DEV0188-persist-multi-candidate-booking-requests.md), availability baseline [DEV0177 — Bind availability to training locations](../../archive/backend/DEV0177-bind-availability-to-training-locations.md)

## Objective and context

Replace immediate-booking eligibility with one authoritative approval-request boundary. Current open occurrences are directly bookable at any future instant within the seven-day publication horizon. Every coach will instead receive requests only until 24 hours before training, with truthful public eligibility derived from database time.

## Scope and non-goals

- In scope:
  - Add a shared server/database rule for the fixed 24-hour request cutoff.
  - Project request cutoff and eligibility for public coach occurrences without relying on browser time.
  - Replace the current direct-booking entry point with the authoritative eligibility check consumed by DEV0188 request creation.
  - Distinguish an eligible open occurrence from cutoff-passed, booked, withdrawn and provider-unavailable states.
  - Preserve the current seven-day maximum publication horizon and timezone-safe occurrence instants.
- Out of scope:
  - Pending-request persistence and selection owned by DEV0188.
  - Coach/client request interfaces owned by DEV0189/DEV0190.
  - Coach-level policy storage or settings, configurable notice/deadline values, configurable publication horizons, per-location/per-slot policies, notifications or attendance confirmation.

## Expected behavior and edge cases

- Every coach and occurrence uses approval requests; there is no instant mode or coach policy mutation.
- Eligibility compares the database statement timestamp to the occurrence start; browser time cannot authorize a request.
- A request may be created only when the occurrence is open, the coach can receive requests and the start is at least 24 hours away.
- An ineligible public occurrence remains truthful: the projection distinguishes unavailable-by-notice from booked/withdrawn/database-unavailable state.
- Hidden or suspended coaches, self-requests, cross-run actors and malformed identifiers fail without partial changes.

## Assumptions, decisions, and dependencies

- DEV0186 completed on 2026-10-11; this ticket is Ready to implement its authoritative approval-only eligibility contract.
- Keep the seven-day publication horizon unchanged. Maximum-advance configurability is not part of this ticket.
- Avoid adding policy storage for one fixed global rule. Keep the cutoff in one tested domain/database boundary so a later configurability ticket can replace its source without changing request semantics.
- The current service area is Berlin. Occurrence instants remain timezone-safe and public presentation uses `Europe/Berlin`; browser timezone does not change eligibility.

## Implementation plan

1. Review DEV0186 and current coach/availability/direct-booking conventions.
2. Add the shared 24-hour eligibility rule and public occurrence projection.
3. Replace direct-booking action eligibility with the request boundary consumed by DEV0188.
4. Add domain, repository and service results for eligible, cutoff-passed and otherwise unavailable occurrences.
5. Add authorization, boundary-time, projection and compatibility tests; add a migration only if implementation requires stored contract changes.

## Acceptance criteria

- [ ] AC1: Every eligible coach occurrence exposes only the approval-request path, with no coach mode or setting.
- [ ] AC2: The database-derived 24-hour cutoff is inclusive and cannot be bypassed by browser time, stale pages or direct calls.
- [ ] AC3: Public projections distinguish requestable, cutoff-passed, booked, withdrawn and unavailable actions without exposing private request data.
- [ ] AC4: Hidden/suspended coaches, self-requests, elapsed occurrences and unauthorized/cross-run actors fail closed.
- [ ] AC5: Fresh/upgrade migration, database, unit, lint, type and build validation pass.

## Validation plan

- Run fresh and upgrade Supabase migrations plus database lint when schema changes are required; otherwise record why migration checks are unaffected.
- Add database integration checks for exact 24-hour boundaries, actor/coach/occurrence eligibility and stale-page/direct-call bypass attempts.
- Add domain/service tests for Berlin presentation and public eligibility projections.
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

- 2026-10-11: Replanned from persisted coach-selectable modes to one fixed approval-request rule after the user removed instant booking and deferred configurability.

### Contracts, configuration, and operations

Expected changes are bounded eligibility projections and server/database checks. A schema migration is not required merely to store a fixed constant; no external service or environment-variable change is planned.

## Validation results

Pending validation.

- Date and environment: Not run.
- Exact commands and outcomes: Not run.
- Manual steps and observed outcomes: Not run.
- Failed, blocked, or not-run checks: All checks await implementation; the DEV0186 contract dependency is complete.

| Criterion | Evidence | Result  |
| --------- | -------- | ------- |
| AC1       | Pending  | Not run |
| AC2       | Pending  | Not run |
| AC3       | Pending  | Not run |
| AC4       | Pending  | Not run |
| AC5       | Pending  | Not run |

## Risks, limitations, and follow-ups

- Public eligibility is informational; every mutation must repeat the database check to prevent clock drift or stale-page bypass.
- Coach-, location- or slot-configurable timing would materially expand the model and requires a later contract.

## Completion and review references

- Completed: Not completed.
- Commit: Planning record included in this commit — `[DEV0182][DEV0183][DEV0184][DEV0185][DEV0186][DEV0187][DEV0188][DEV0189][DEV0190] Plan session collaboration and booking requests`; implementation not started.
- Review: No review created.
- Deployment or release: Not deployed or released.
