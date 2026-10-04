# Ticket DEV0133: Normalize availability deadlock conflicts

- Status: Completed
- Created: 2026-10-04
- Last updated: 2026-10-04
- Milestone: Project maintenance
- Coordination: None — independent development ticket
- Related records: discovered while validating [DEV0128](DEV0128-persist-credit-backed-private-bookings.md); preserves the completed availability contract from [DEV0114](DEV0114-persist-recurring-coach-availability.md)

## Objective and context

The existing concurrent-availability database test proves that two requests cannot publish the same capacity-one slot. PostgreSQL may reject the losing request with exclusion-constraint code `23P01` or, when two exclusion checks wait on each other's transactions, deadlock code `40P01`. The repository currently normalizes only the first outcome, leaking a raw database error for the second and making the established test nondeterministic.

Normalize the bounded deadlock outcome into the existing `CoachAvailabilityConflictError` so callers receive one stable domain conflict for either database race result. This is repository error handling only and does not change the availability product contract in [the MVP specification](../../../docs/mvp-spec.md#core-coach-packages).

## Scope and non-goals

- In scope:
  - recognize PostgreSQL `40P01` from an availability mutation as the existing availability conflict;
  - retain the original database error as the cause;
  - validate the existing concurrent-publication scenario in the full database suite.
- Out of scope:
  - changing availability capacity, scheduling, locking or retry policy;
  - changing booking persistence or Solana behavior;
  - converting unrelated database deadlocks outside the availability repository.

## Expected behavior and edge cases

Two concurrent requests for one overlapping availability interval still produce exactly one slot. The losing request raises `CoachAvailabilityConflictError` whether PostgreSQL reports an exclusion violation or detects a deadlock while enforcing the same exclusion constraint. Unexpected database errors continue to propagate unchanged.

## Assumptions, decisions, and dependencies

The existing exclusion constraint remains the source of truth. A deadlock during this bounded create/update mutation means the requested availability could not be established deterministically; surfacing a retryable domain conflict is safer than exposing PostgreSQL internals. No schema or migration change is required.

## Implementation plan

1. Extend the availability repository's PostgreSQL error classifier with `40P01`.
2. Run the focused concurrency test and the full database suite.
3. Record results and archive the ticket if all acceptance criteria pass.

## Acceptance criteria

- [x] AC1: Concurrent overlapping availability publication produces exactly one slot and one `CoachAvailabilityConflictError`, including when PostgreSQL reports `40P01`.
- [x] AC2: The repository retains the rejected database error as the conflict's cause and does not broadly normalize errors outside availability mutations.

## Validation plan

Run the focused `concurrent overlapping publication` database test against the clean local Supabase environment, followed by `npm run test:db`, type checking, lint and formatting checks. Browser checks are not applicable because this ticket changes only server-side error normalization and no interface behavior.

## Implementation record

Implementation started after a clean DEV0128 migration rehearsal exposed the established availability race as PostgreSQL `40P01` in the full database suite.

### Changes and rationale

The availability repository now recognizes PostgreSQL deadlock code `40P01` alongside the existing exclusion, uniqueness, constraint and domain error codes. The existing mutation wrapper converts it to `CoachAvailabilityConflictError` and attaches the original `DrizzleQueryError`/`PostgresError` as its cause. Classification remains private to availability mutations, so unrelated repositories and unexpected database errors are unchanged.

### Affected files

| File or component                                                                                               | Change and purpose                                                                                                                                      |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`src/server/db/coaches/availability-repository.ts`](../../../src/server/db/coaches/availability-repository.ts) | Adds `40P01` to the availability-only PostgreSQL error classifier.                                                                                      |
| [`tests/database/coach-availability.test.ts`](../../../tests/database/coach-availability.test.ts)               | Existing concurrent-publication coverage proved one success and one stable domain conflict under the deadlock outcome; no test-only behavior was added. |

### Decisions and deviations

None. The implementation follows the original one-line classification plan and does not add automatic retries.

### Contracts, configuration, and operations

No schema, environment, dependency, deployment or public interface changed. The existing repository error contract is now deterministic for one additional PostgreSQL concurrency outcome.

## Validation results

Validation ran on 2026-10-04 against the clean local Supabase/PostgreSQL environment:

- The focused `concurrent overlapping publication produces exactly one slot` database test passed and exercised one winning insert plus one normalized conflict.
- `npm run test:db` passed all 29 database tests, including the same race in the full stateful sequence where PostgreSQL had previously emitted `40P01`.
- `npm test` passed 78/78 unit/source-boundary tests.
- `npm run typecheck`, `npm run lint`, `npm run db:lint`, `npm run format:check` and `git diff --check` passed.
- `npm run build` and `npm run build:vinext` passed. Browser checks were not applicable because no route or interface changed.
- A repository-local Markdown link check resolved all links across 97 files after the completed record moved to the archive.

| Criterion | Evidence                                                                                                 | Result |
| --------- | -------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Focused concurrency test and full 29/29 database suite                                                   | Passed |
| AC2       | Repository review confirms normalization is inside `availabilityMutation` and retains `{ cause: error }` | Passed |

## Risks, limitations, and follow-ups

The repository does not automatically retry the mutation; the caller receives the existing conflict and may ask the coach to refresh or retry. This ticket intentionally does not classify deadlocks from unrelated repositories.

## Completion and review references

- Completed: 2026-10-04 — the availability race now returns the existing stable domain conflict for PostgreSQL `40P01`.
- Commit: `f2ece82` — `[DEV0133] Normalize availability deadlock conflicts`.
- Review: Self-review completed; no independent review created.
- Deployment or release: Not applicable — local repository maintenance only.
