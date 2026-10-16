# Ticket DEV0252: Persist effective coach availability

- Status: Draft
- Created: 2026-10-16
- Last updated: 2026-10-16
- Milestone: M9 — Coach calendar and effective availability
- Coordination: [COR0023 — Coach calendar and availability](../organisatory/COR0023-coach-calendar-and-availability.md)
- Related records: contract owner [DEV0251](../../archive/organisatory/DEV0251-define-coach-calendar-and-availability.md); peer dependencies and external M7 relationships are mapped in COR0023.

## Objective and context

Replace the seven-day recurring-only publication boundary with authoritative 30-local-date effective availability: weekly hours plus whole-date overrides, retained reservations and explicit policy-restoration identities. This is one atomic availability-authority slice; group publication itself remains DEV0238.

Implement against [specification section 18](../../../docs/mvp-spec.md#18-coach-calendar-and-effective-availability), [M9](../../../docs/mvp-spec.md#12-delivery-milestones) and the [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix). Confirmed choices and adopted operating defaults are distinguished in the specification; reference Everfit controls are not additional requirements.

## Scope and non-goals

- In scope: Additive override/revision/closure-provenance and retry persistence; effective-hour projection/materialization; 30-day public/request enforcement; atomic weekly/date save/removal/restoration services; integrate every affected scheduling writer with the existing shared guard and M8 card boundary.
- Out of scope: Calendar-period read projection or calendar UI; coach/public date controls; group lifecycle/roster/publication implementation; variable duration, external synchronization, background job infrastructure or shared-database reset.

## Expected behavior and edge cases

Preserve historical seven-day occurrences and existing bookings; cancellation under a day off must not reopen capacity. Distinguish policy closures from manual closures, withdraw/reassign open hours with atomic request-card closure, and create fresh successor identities only for explicit eligible policy restoration. Future overrides may precede their entry into the horizon. Reconcile public reads/request mutations without a coach visit. Venue deactivation, suspension, groups beyond the horizon, today/29th date/DST edges and late lock waits cannot bypass eligibility.

## Assumptions, decisions, and dependencies

External DEV0238 completed its shared schedule guard/publication boundary and isolated validation on 16 October 2026. Its migration has not been applied to the shared local stack; inspect and integrate that completed baseline in an appropriate disposable target before M9 migration work. DEV0253/DEV0255 consume the stable effective-availability service; DEV0254 owns its separate read-only calendar feed. Preserve independent uncommitted M7 and note work; choose the next unused additive migration version at implementation start.

Scope review: this record owns one delivery boundary under a flat coordination. No runtime implementation has started. Keep Draft until the listed dependencies and concrete interface/validation prerequisites permit starting; Ready is not an extra approval gate. Inspect actual versions/bundled documentation before framework or SDK integration changes and update this plan before material deviations.

## Implementation plan

1. Inspect actual installed database/ORM guidance and inventory private/group/profile/location/request/M8 writer lock order. Record the migration, effective-policy and operation-retry shapes before code edits; keep publication guarded throughout.
2. Add forward-compatible records/constraints and actor-scoped complete weekly/date save/removal operations with expected revision, bounded 31-date batches, exact retry recovery and bounded stale/altered-replay errors.
3. Implement 30-local-date effective generation/public projections/request enforcement and cancellation/venue/coach integration; preserve retained reservations, immutable history and manual closures. Expose narrow services/actions for the UI peers without adding their controls.
4. Prove fresh and preserved-data upgrades plus concurrent effective-save/accept/cancel/materialize/group operations and M8 request-card regressions in disposable databases; finish evidence before runtime consumers rely on this boundary.

## Acceptance criteria

- [ ] AC1: Only current authorized coach owners save valid complete weekly/date drafts; bad venues, overlaps, stale revisions or invalid DST/date batches fail without partial changes.
- [ ] AC2: Effective private publication/request eligibility covers exactly today plus 29 Berlin dates using database time without coach visits; current policy and groups always constrain capacity.
- [ ] AC3: Booked sessions save through overrides unchanged with structured warning data; pending closures/cards commit together, explicit restoration gets fresh identities and manual/terminal history never revives.
- [ ] AC4: Acceptance/cancellation/group/venue/recurrence races, retry recovery and preserved-data migration/authorization checks pass with no overlapping coach time or raw-write bypass.

## Validation plan

Use isolated PostgreSQL with concurrent connections, fresh/preserved-data migration fixtures, exact 30-date/DST boundary cases, actor/dataset/venue denial and original-ID/card checks. Run focused database drivers/pgTAP, relevant existing availability/request/group/mail suites, npm test, npm run lint, npm run typecheck, npm run format:check and npm run build. Use documented disposable targets rather than resetting the shared local stack; record every baseline exclusion. No viewport proof belongs to this backend-only slice.

## Implementation record

Runtime implementation has not started. This is a planning record created by DEV0251.

### Changes and rationale

Allocated one peer with explicit ownership and dependencies so the full extension cannot be implemented under its documentation ticket or overlap existing M7 work.

### Affected files

Planned: src/server/db/coaches/availability-repository.ts and narrow domain/service/schema boundaries, additive supabase/migrations/, tests/database/ and relevant scheduling/M8 tests. Record exact files and their roles during implementation.

### Decisions and deviations

2026-10-16: Created from the confirmed feature scope and section 18 operating defaults. No runtime decisions/deviations or implementation evidence yet.

### Contracts, configuration, and operations

No runtime contract, dependency, environment variable, schema, migration or deployment changed by creating this record. The planned capability boundary is described above; record concrete data/API/setup/migration/rollback changes during implementation. Never record secrets.

## Validation results

Planning-document validation is recorded by DEV0251; it does not satisfy runtime criteria. Application/database/browser/static/build checks for this peer have not run because its runtime implementation has not started.

| Criterion | Evidence                                                      | Result  |
| --------- | ------------------------------------------------------------- | ------- |
| AC1–AC4   | Implementation and required peer-specific validation pending. | Not run |

## Risks, limitations, and follow-ups

Lock order across M7 and M8, closure provenance, successor uniqueness and future-range query cost require real concurrent database evidence; a UI-only warning cannot enforce this contract.

Handoff: the planned scope and validation exist; no runtime code or evidence exists under this record. Next action: satisfy the stated dependencies, inspect the affected current implementation and finalize its interface/migration details before marking In progress.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: Planning self-review only; no independent/runtime review.
- Deployment or release: None.
