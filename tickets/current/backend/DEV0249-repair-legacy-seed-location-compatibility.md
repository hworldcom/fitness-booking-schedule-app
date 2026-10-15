# Ticket DEV0249: Repair legacy seed location compatibility

- Status: Draft
- Created: 2026-10-15
- Last updated: 2026-10-15
- Milestone: Database maintenance
- Coordination: None — independent development ticket
- Related records: Found during [DEV0237](../../archive/backend/DEV0237-persist-group-session-registration.md) validation; excluded products remain governed by [the specification](../../../docs/mvp-spec.md).

## Objective and context

The checked-in `supabase/seed.sql` fails against the current schema at its historical `app.group_events` fixture: `coach_training_location_id` is required but omitted. Reproduced on 2026-10-15 in a disposable PostgreSQL 17.11 schema-only copy before applying DEV0237. The new nonfinancial group-session tables do not use this fixture or table.

## Scope and non-goals

- In scope: review the historical fixture's retention obligation and make the seed compatible with the current schema; prove a complete fresh migration/seed and safe repeated seeding.
- Out of scope: restoring excluded funding behavior, changing the new group-session contract, resetting existing user data, or rewriting archived migrations.

## Expected behavior and edge cases

The full seed completes after all migrations and can be repeated without changing user-owned rows. Preserve historical fixtures required by existing checks. Determine whether to remove the obsolete fixture or bind it to its correct fixture-owned location before implementation; do not revive it as current group inventory.

## Assumptions, decisions, and dependencies

No implementation choice adopted yet. Inspect retention requirements and seed consumers first. This is a pre-existing seed defect, not a DEV0237 runtime dependency. No existing local or hosted database reset is authorized by this record.

## Implementation plan

1. Identify fixture consumers, location ownership and retention requirements.
2. Record the selected repair here before editing the seed.
3. Validate migrations plus the full seed in a disposable database, repeat seeding, and run database regressions.

## Acceptance criteria

- [ ] AC1: Migrations followed by the complete seed succeed in a disposable database without filtering statements.
- [ ] AC2: Repeated seeding preserves user-owned data and relevant database regressions pass.

## Validation plan

Use a disposable local database, per-migration transactions, the complete seed, preservation checks, pgTAP and driver tests. No browser checks apply unless scope expands beyond fixtures.

## Implementation record

Not implemented. Only the failure and follow-up scope are recorded. The reproduction emitted PostgreSQL `23502` for historical fixture `83000000-0000-4000-8000-000000000001`. No repository seed or existing local data was modified during diagnosis.

## Validation results

Reproduced using `psql -v ON_ERROR_STOP=1 -f - < supabase/seed.sql` against `dev0237_upgrade` before adding group tables. DEV0237's isolated current-fixture checks explicitly exclude this obsolete seed statement and do not satisfy this ticket's acceptance criteria.

## Risks, limitations, and follow-ups

The complete seed/reset path remains broken until repaired. This ticket remains Draft pending fixture-retention review.

## Completion and review references

- Completed: Not completed.
- Commit: None.
- Review: Investigation only.
- Deployment or release: None.
