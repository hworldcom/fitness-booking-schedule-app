# Ticket DEV0249: Repair legacy seed location compatibility

- Status: Completed
- Created: 2026-10-15
- Last updated: 2026-10-16
- Milestone: Database maintenance
- Coordination: [COR0025 — Migration baseline and seed cleanup](../organisatory/COR0025-migration-baseline-and-seed-cleanup.md)
- Related records: Found during [DEV0237](DEV0237-persist-group-session-registration.md) validation; excluded products remain governed by [the specification](../../../docs/mvp-spec.md).

## Objective and context

The checked-in `supabase/seed.sql` fails against the current schema at its historical `app.group_events` fixture: `coach_training_location_id` is required but omitted. Reproduced on 2026-10-15 in a disposable PostgreSQL 17.11 schema-only copy before applying DEV0237. The new nonfinancial group-session tables do not use this fixture or table.

## Scope and non-goals

- In scope: review the historical fixture's retention obligation and make the seed compatible with the current schema; prove a complete fresh migration/seed and safe repeated seeding.
- Out of scope: restoring excluded funding behavior, changing the new group-session contract, resetting existing user data, or rewriting archived migrations.

## Expected behavior and edge cases

The full seed completes after all migrations and can be repeated without changing user-owned rows. Preserve historical fixtures required by existing checks. Determine whether to remove the obsolete fixture or bind it to its correct fixture-owned location before implementation; do not revive it as current group inventory.

## Assumptions, decisions, and dependencies

2026-10-16 adopted repair after the user authorized baseline/seed cleanup: no runtime, script or test consumes historical fixture `83000000-0000-4000-8000-000000000001`; foundation checks require the retained table, not that row. Remove only its obsolete seed insert/upsert rather than fabricating a current training location or reviving excluded funding inventory. Preserve existing rows when seeding retained databases. Verify claimed demo accounts and user-owned coach/venue/discipline/media records remain untouched by repeated seeding; add narrow ownership guards if the preservation rehearsal exposes a failure. This is a pre-existing seed defect, not a DEV0237 runtime dependency. No existing local or hosted database reset is authorized. Baseline packaging belongs to peer DEV0265 under COR0025.

2026-10-16 preservation refinement before the guard edit: a real transactional rehearsal proved that the unconditional discipline values reinsert a removed Boxing assignment for a claimed Daniel fixture; the portrait seed also lacks an unclaimed-owner condition. Restrict discipline insertion/update and fixture portrait restoration to unclaimed fixture-owned coach/profile rows. A normal account and a claimed coach with a custom discipline, biography and explicitly cleared portrait must retain identical app-row hashes across two complete seed repetitions. This is AC2, not new product behavior.

## Implementation plan

1. Identify fixture consumers, location ownership and retention requirements.
2. Record the selected repair here before editing the seed.
3. Validate migrations plus the full seed in a disposable database, repeat seeding, and run database regressions.

## Acceptance criteria

- [x] AC1: Migrations followed by the complete seed succeed in a disposable database without filtering statements.
- [x] AC2: Repeated seeding preserves user-owned data and relevant database regressions pass.

## Validation plan

Use a disposable local database, per-migration transactions, the complete seed, preservation checks, pgTAP and driver tests. No browser checks apply unless scope expands beyond fixtures.

## Implementation record

### Changes, files, and rationale

Implementation started on 2026-10-16 after the user authorized baseline/seed cleanup. [The complete seed](../../../supabase/seed.sql) no longer inserts/upserts the unused historical funding-event fixture that violated the required-location constraint. It does not delete the table or any existing row. Current nonfinancial group sessions use separate tables and gain no demonstration event from this repair.

The same seed now restores Daniel's fixture portrait and inserts/updates fixture disciplines only when both coach and profile are fixture-owned and the profile is unclaimed. Previously, reseeding a claimed coach reinserted a removed Boxing discipline and could restore an intentionally cleared portrait. These guards preserve user choices while still initializing unclaimed demonstration coaches.

[The seed regression](../../../tests/database/seed.test.ts) runs the full file in a transaction, enrolls an ordinary account and claims a demonstration coach using the existing provisioning shape. It customizes the biography/disciplines and clears the portrait, hashes retained rows in every app table, then runs the complete seed twice and compares every hash. The deliberate final exception rolls the test transaction back, including its Auth fixtures.

### Contracts, configuration, and compatibility

No schema, runtime API, dependency, environment variable or authentication contract changes. Demo fixture creation is narrower; existing historical event rows are retained. No new hosted project, shared-database seed/reset, account transfer or Storage-file change occurred. Peer [DEV0265](DEV0265-baseline-completed-database-migrations.md) owns migration packaging, its rehearsal helper and legacy-ledger limitations.

### Decisions and deviations

The original `23502` reproduction and consumer review justified removing the obsolete insert rather than inventing a location. The first meaningful preservation rehearsal failed with `Repeated seed changed coach_profile_disciplines`; the ownership guards fix that observed failure. An initial test fixture used invalid discipline sort order 7; it was corrected to valid sort order 3 before evaluating preservation. No product behavior was added to resolve either failure.

## Validation results

All checks below passed on PostgreSQL 17.11 in explicitly owned disposable databases. The completed-source suite uses revision `3890d243225badb5f0de91a8a654429b72915a03` plus these seed/baseline changes, isolated from concurrent calendar/interface edits.

| Criterion           | Command or proof                                                                                                                                                                                        | Result                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| AC1                 | `BASELINE_KEEP_DATABASES=1 node scripts/rehearse-database-baseline.mjs`                                                                                                                                 | All 53 original migrations replayed in transactions; independent baseline restored; complete unfiltered seed succeeded on both. |
| AC2                 | `DATABASE_TEST_URL=postgresql://postgres:postgres@127.0.0.1:55322/dev0265_fresh node --import tsx --conditions=react-server --test tests/database/seed.test.ts`                                         | 1/1 passed; ordinary/claimed accounts and all retained app-table row hashes unchanged across two complete repeats.              |
| AC1–AC2             | Same URL with `node --import tsx --conditions=react-server --test --test-concurrency=1 tests/database/*.test.ts`                                                                                        | 115/115 passed at the completed cutoff, including current profile, location, discipline, media and group authority.             |
| AC1–AC2             | `./node_modules/.bin/supabase test db --db-url postgresql://postgres:postgres@127.0.0.1:55322/dev0265_fresh` followed by `supabase db lint --db-url <same-loopback-url> --schema app --fail-on warning` | 225/225 assertions across 13 files; no schema errors or warnings.                                                               |
| Scope/static checks | `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check` in the isolated completed-source checkout                                                                                       | 155 application and 16 server tests passed; lint, types and formatting passed.                                                  |

DEV0237's earlier filtered fixture checks were not reused as full-seed evidence. No browser/build check applies: this ticket changes fixture SQL and a database test, with no interface or application bundle changes. Documentation/link review and the final forward-calendar compatibility result are recorded with DEV0265/COR0025.

## Risks, limitations, and follow-ups

The complete seed is repaired and verified in disposable databases. It remains demonstration data; production fixture selection and new hosted setup are separate work. The shared retained local database was not reset or reseeded, and its migration-ledger continuity remains DEV0232. The obsolete historical event table is deliberately retained; pruning it would need a separate retention review.

## Completion and review references

- Completed: 2026-10-16 — acceptance criteria and required validation passed; archived with the delivery handoff.
- Commit: User authorized committing on 2026-10-16; included with DEV0265 in `[DEV0249][DEV0265] Baseline migrations and repair repeatable seeding`.
- Review: Consumer, implementation and acceptance self-review; no independent review.
- Deployment or release: None.
