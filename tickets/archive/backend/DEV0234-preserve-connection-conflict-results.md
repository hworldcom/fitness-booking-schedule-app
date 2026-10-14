# Ticket DEV0234: Preserve connection conflict results

- Status: Completed
- Created: 2026-10-14
- Last updated: 2026-10-14
- Milestone: M6 — Connection error recovery
- Coordination: None — independent development ticket
- Related records: historical service baseline [DEV0221](DEV0221-persist-coach-athlete-connections.md); validation consumer [DEV0222](../frontend/DEV0222-add-coach-my-athletes.md)

## Objective and context

Preserve the declared connection conflict result after PostgreSQL rejects an ineligible or stale operation. During DEV0222's real browser rehearsal, cancellation made a pending acceptance ineligible, but the service returned unavailable instead of conflict. The repository translated the SQL exception correctly; catching it inside the actor transaction left that transaction failed, and transaction completion replaced the intended result. Implement the existing [connection recovery contract](../../../docs/mvp-spec.md#49-connect-after-a-confirmed-session), not a new permission or behavior.

## Scope and non-goals

- In scope: the connection service's transaction/error boundary and focused regression evidence.
- Out of scope: schemas/migrations, repository eligibility/locks, other feature services, Home, athlete UI, dependencies, environment settings and migration-ledger repair.

## Expected behavior and edge cases

SQL connection conflicts roll back before the service returns conflict. Invalid inputs still fail before actor/database work. Actor rejection remains forbidden; actual Auth/database/provider outages remain unavailable. A rejected acceptance cannot mutate the pair or claim success, and an eligible subsequent operation still works.

## Assumptions, decisions, and dependencies

Use the existing withAuthorizedActor rethrow option for ConnectionConflictError, and catch that error outside the transaction. Reviewed installed Postgres.js 3.4.9 transaction documentation and existing coach-location service patterns. Preserve completed DEV0221 evidence; this is an independently owned dated correction. DEV0222 owns the real HTTP/browser consumer rehearsal.

## Implementation plan

1. Record the reproduced failure and narrow transaction-boundary design before editing the service.
2. Propagate typed conflicts through actor transaction rollback, then map them outside the boundary.
3. Rehearse stale cancellation/acceptance through real Server Actions, confirm unchanged pending state plus safe retry/decline, and run existing app/server/database, static/build and documentation checks.

## Acceptance criteria

- [x] AC1: An ineligible SQL acceptance returns conflict to the browser after rollback, with no accepted relationship or false success.
- [x] AC2: Invalid/forbidden/unavailable boundaries and subsequent eligible/safe operations remain intact.
- [x] AC3: Relevant runtime, regression, static/build and document checks pass with exact evidence.

## Validation plan

Use npm run test:coach-connections to create an eligible pending request, render its enabled coach acceptance control, cancel the only qualifying session from the athlete, then submit the stale control. Expect bounded conflict feedback and a refreshed non-accepting pending row; validate safe decline. The same rehearsal proves later eligible requests/reconnections and unrelated/suspended access. Run npm test, npm run test:db, lint, typecheck, formatting, build and link/index/diff checks. SQL/migration replay is not applicable because no schema or authority function changes.

## Implementation record

Started after the exact local HTTP failure above was reproduced on 2026-10-14. The recorded plan precedes service edits.

### Changes and rationale

The connection service now asks withAuthorizedActor to propagate only ConnectionConflictError, lets the actor transaction roll back, and maps that typed error to the declared conflict result outside the transaction. Previously an ineligible SQL acceptance was caught inside an already failed transaction, whose completion replaced the intended conflict with unavailable. The browser can now explain the stale state and refresh current booking/connection permissions without claiming success.

Invalid inputs still return before actor/database work. The existing actor boundary still maps authentication/authorization/provider failures; unrelated error types are not reclassified as connection conflicts. Repository eligibility, cancellation ordering and database constraints are unchanged.

### Affected files

| File                                                                       | Role                                                                                           |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [Connection service](../../../src/server/connections/service.ts)           | Map typed conflicts after rollback instead of swallowing them inside a failed SQL transaction. |
| [Coach UI rehearsal](../../../scripts/rehearse-local-coach-connections.ts) | Existing DEV0222 consumer evidence; not implementation transferred into this ticket.           |

### Decisions and deviations

Do not relax eligibility or treat unknown provider failures as successful/conflicting mutations. Other service boundaries remain separate scope.

### Contracts, configuration, and operations

No data/API shape, dependency, environment, setup or migration change. Restore the already-declared conflict result. Revert the service edit to undo this code-only change; no data rollback applies.

## Validation results

Validation performed on 2026-10-14 against the existing loopback Auth/PostgreSQL app; no hosted state changed.

- Before the fix, npm run test:coach-connections reproduced an unavailable response after the athlete cancelled the only eligible session and the coach submitted an already-rendered acceptance control.
- Final npm run test:coach-connections: passed the real Server Action stale acceptance. The browser received conflict feedback, the request remained pending with acceptance unavailable, the original booked card refreshed to cancelled, and a subsequent safe coach decline succeeded and was independently read as declined. The same run passed eligible consent/reconnections, network retry handling, guest/unrelated denial and suspended safe access. Its temporary tagged fixtures were removed.
- npm test: 135 general and 14 server checks passed, including malformed connection IDs/actions/cursors rejected before actor/database access and private-media forbidden/unavailable/revocation boundaries. npm run test:db: all 59 tests passed, including consent/eligibility/actor/cancellation/race/history cases. npm run db:test also passed all 206 assertions across 11 files. No SQL functions, schema or migration changed, so migration replay is not applicable.
- npm run lint, npm run typecheck, npm run format:check and configuration-free npm run build: passed. The consumer's public/auth production-preview browser regressions also passed 16 scenarios with two intentional mobile-project skips.
- Final Markdown formatting, python3 /tmp/dev0222-check-docs.py --complete and git diff --check: passed; the completed records, relative links, status/index rows, reciprocal ownership and unchanged authority/schema scope were reviewed. Local source review confirms only the connection service transaction/error boundary changed for this ticket.

| Criterion | Evidence                                                                                                                              | Result |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Real cancelled-only stale acceptance returns conflict after rollback; pending relationship and cancelled booked card are re-read.     | Passed |
| AC2       | Safe subsequent decline succeeds; existing malformed-input, actor, permission, provider/media and eligible mutation regressions pass. | Passed |
| AC3       | Application/database/rehearsal/static/build checks pass; paired archive consistency check passed.                                     | Passed |

## Risks, limitations, and follow-ups

True provider failures remain unavailable; the fix only classifies typed connection conflicts after rollback. Other feature services and DEV0232 local migration continuity remain separate work. No deployment or independent review occurred. No required work remains for this correction; DEV0223 is the remaining athlete interface consumer.

## Completion and review references

- Completed: 2026-10-14; applicable acceptance criteria and required local validation passed. No hosted deployment or independent review is claimed.
- Commit: `[DEV0222][DEV0234] Add My athletes and preserve connection conflicts`, requested by the user on 2026-10-14. Both records accompany this commit because the frontend regression exercises the backend correction and their completed archive links are reconciled together; Git history supplies the hash.
- Review: No independent review created.
- Deployment or release: None.
