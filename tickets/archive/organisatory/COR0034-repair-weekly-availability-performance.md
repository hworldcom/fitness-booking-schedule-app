# Coordination COR0034: Repair weekly availability performance

- Status: Completed
- Created: 2026-10-21
- Last updated: 2026-10-21
- Milestone: M10 UAT booking recovery
- Converted from: Not applicable — created as a coordination record
- Tracked development tickets: [DEV0402](../backend/DEV0402-prune-private-time-candidates.md), [DEV0403](../frontend/DEV0403-bound-weekly-availability-loading.md), [DEV0404](../backend/DEV0404-release-weekly-availability-repair-to-uat.md)
- Related records: Diagnosis [DEV0401](../backend/DEV0401-investigate-slow-empty-week-availability.md); existing migration dependency [DEV0396](../backend/DEV0396-avoid-repeated-timezone-catalog-scans.md); release baseline [DEV0400](DEV0400-deploy-seven-day-booking-to-uat.md).

## Objective and boundaries

The user authorized fixing DEV0401's 30.7-second empty-week UAT read and unbounded checking state on 2026-10-21. Coordinate query pruning, finite loading/recovery and the guarded UAT schema/application rollout. This record owns coordination only; each concrete deliverable has one peer development ticket. Preserve scheduling/privacy/retained data and the [weekly booking contract](../../../docs/mvp-spec.md#196-cards-username-urls-and-scheduling-compatibility).

## Direct development work

| Implementation part | Development ticket | Owned deliverable | Start condition |
| --- | --- | --- | --- |
| Database query and server budget | [DEV0402](../backend/DEV0402-prune-private-time-candidates.md) | Forward migration, actual-hours candidates, database deadline, equivalence/preservation/performance regression | Start now; diagnosis complete |
| Browser loading and recovery | [DEV0403](../frontend/DEV0403-bound-weekly-availability-loading.md) | 15-second read deadline, stale-result fence, Retry, fixture/native responsive proof and current contract | Independent of SQL work; after ticket creation |
| UAT integration and release | [DEV0404](../backend/DEV0404-release-weekly-availability-repair-to-uat.md) | Apply exact DEV0396/DEV0402 migrations, preserve data/contracts, deploy validated app and prove actual authenticated weekly read/cleanup | Local DEV0402/DEV0403 acceptance passes |

No required implementation ticket is missing. Work stays on the current branch; edits are sequential, with no parallel agents or independent deployment branch.

## Other relationships

DEV0396 is an external dependency, not a direct member: its completed local migration is rolled out by DEV0404. DEV0401 is diagnosis history and DEV0400 the prior app release, not implementation members. DEV0393 public cache planning is independent and receives no cache policy from this repair.

## Delivery sequence and completion conditions

Implement/validate DEV0402, then DEV0403; integration release waits for both. Do not deploy a candidate that changes booking authority or overwrites a newer UAT source. Complete only when all three direct tickets pass their acceptance criteria, UAT reports fast truthful empty/populated reads with no endless loading and any disposable Auth/booking fixtures are exactly removed. A blocked live dependency leaves coordination open with exact next action.

## Progress and integration record

2026-10-21: User authorized the repair. Plans reviewed as three bounded peers because SQL/migration, client lifecycle and live rollout have distinct validation/rollback boundaries. No product policy/cache changes. DEV0402 and DEV0403 passed local acceptance before DEV0404 applied both exact migrations and promoted the isolated validated source. Concurrent independent DEV0405 edits were preserved and excluded from that source. Integrated UAT read/guest/privacy/native smoke and exact fixture cleanup passed; the empty week now resolves promptly and stalled reads have finite recovery.

## Validation results

All three direct tickets completed on 2026-10-21. DEV0402 records 68 DB checks, original/new equivalence and preservation; DEV0403 records 13 UI groups and native deadline/retry proof. DEV0404 records exact UAT migrations, verified source/candidate promotion, real authenticated empty (484–541 ms)/populated (510 ms) API checks and complete cleanup with all 57 retained fingerprints unchanged. Links, statuses, direct membership, scope boundaries and integrated outcome were reviewed; no outstanding implementation part remains.

## Risks, limitations, and follow-ups

Do not treat local SQL completion as hosted rollout. Do not make timeout failures look like zero or leak private times. Preserve retained users and original function owners/privileges. Production is outside this UAT repair.

## Completion and review references

- Completed: 2026-10-21 — SQL optimization, bounded weekly loading and actual UAT integration/cleanup criteria passed.
- Direct development tickets: DEV0402, DEV0403 and DEV0404 Completed; each owns its evidence.
- Commit: Not applicable — coordination IDs are not commit subjects.
- Review: Plan and integration/acceptance self-review complete; independent review not performed.
- Deployment or release: DEV0404 release `dpl_BqxHG6Zs7onqzCSvfWHeD25fdNZm` serves https://uat.movx.club, with both intended hosted-dev function migrations installed. No production release.
