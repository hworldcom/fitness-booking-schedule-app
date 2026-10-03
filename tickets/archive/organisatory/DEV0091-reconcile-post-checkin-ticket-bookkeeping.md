# Ticket DEV0091: Reconcile post-check-in ticket bookkeeping

- Status: Completed
- Created: 2026-09-28
- Last updated: 2026-09-28
- Milestone: Project maintenance after M3 reservations and check-ins
- Coordination: None — independent development ticket
- Related records: corrects the current summary in [COR0007 — Core multi-gym membership MVP](./COR0007-core-multigym-membership-mvp.md), reflects completed [COR0008 — Membership reservations and check-ins](COR0008-membership-reservations-and-checkins.md) and its completed [DEV0085 member interface](../frontend/DEV0085-member-checkin-interface.md), and records the existing planning commit for [DEV0089 — Add a wallet-visible membership card](../blockchain/DEV0089-wallet-visible-membership-card.md)

## Objective and context

The authoritative ticket index correctly archives COR0008 and DEV0085, but COR0007 still describes them as open. DEV0084 and DEV0089 also name their shared planning commit only by subject even though its hash is available. Reconcile those durable records before reviewing DEV0089 so current delivery status is not confused with dated planning history.

## Scope and non-goals

- In scope: update current COR0007 progress, risk and completion summaries; add the known `867bc76` reference to DEV0084/DEV0089; advance the next available DEV ID; validate paths, statuses and formatting.
- Out of scope: rewriting dated historical notes in archived records; completing or testing DEV0081/DEV0082; choosing DEV0089's asset standard; implementing wallet-card runtime, schema or chain behavior; changing the product contract.

## Expected behavior and edge cases

Current summaries must say COR0008 and all five direct tickets are completed. Historical entries that truthfully say DEV0085 was Ready at an earlier date remain unchanged. DEV0081 and DEV0082 remain In progress because their manual rejected-approval evidence is deliberately deferred. DEV0089 remains Draft pending its technical readiness decisions.

## Assumptions, decisions, and dependencies

- Git history identifies `867bc76` as the existing `[DEV0084][DEV0089] Persist check-ins and plan wallet card` commit.
- This is record reconciliation only. The separate DEV0089 architecture review may recommend a compatibility spike, but no proposed standard becomes an adopted decision in this ticket.
- No application, database, dependency, environment or deployment change is required.

## Implementation plan

1. Correct COR0007's current progress, risk and completion language without rewriting dated history.
2. Replace ambiguous “this change” commit references in DEV0084 and DEV0089 with the existing commit hash and subject.
3. Update the ticket index and next available ID, then check links, formatting and patch integrity.

## Acceptance criteria

- [x] AC1: COR0007 consistently reports COR0008 and DEV0084–DEV0088 as completed while DEV0081/DEV0082 remain In progress and DEV0089 remains Draft.
- [x] AC2: DEV0084 and DEV0089 cite `867bc76` as their shared existing commit without implying DEV0089 runtime implementation.
- [x] AC3: The ticket index lists this record accurately, uses DEV0092 as the next available DEV ID and contains no stale current-path links for DEV0085/COR0008.
- [x] AC4: Targeted consistency searches, Markdown formatting and `git diff --check` pass.

## Validation plan

Search current records for stale DEV0085/COR0008 status and current-directory links, confirm the DEV0084/DEV0089 commit through Git history, run Prettier over changed Markdown and run `git diff --check`. Application tests are not applicable because this ticket changes project records only.

## Implementation record

Implementation completed after the stale current summaries and available historical commit hash were confirmed. Runtime and product behavior remain untouched.

### Changes and rationale

- COR0007 now reports completed COR0008 integration and all five completed DEV0084–DEV0088 tickets. It also records completed DEV0090 as an independent follow-up and accurately narrows DEV0081/DEV0082's remaining work to the deferred manual Phantom rejection evidence.
- DEV0084 and DEV0089 now cite the existing `867bc76` commit explicitly. DEV0089 also states that this was planning only and that no runtime implementation commit exists.
- The ticket index advanced the next available identifier to DEV0092 and records this completed maintenance work in the archive.

### Affected files

| File or component                                                                                               | Change and purpose                                                                  |
| --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| [`COR0007-core-multigym-membership-mvp.md`](./COR0007-core-multigym-membership-mvp.md)                          | Reconciles current M3 completion and deferred DEV0081/DEV0082 evidence.             |
| [`DEV0084-persist-included-membership-checkins.md`](../backend/DEV0084-persist-included-membership-checkins.md) | Records the exact implementation/planning commit hash.                              |
| [`DEV0089-wallet-visible-membership-card.md`](../blockchain/DEV0089-wallet-visible-membership-card.md)          | Records the exact planning commit and distinguishes it from runtime implementation. |
| [`tickets/README.md`](../../README.md)                                                                          | Updates the record lifecycle and next available DEV ID.                             |

### Decisions and deviations

- 2026-09-28: Preserve dated archived statements that DEV0085 was Ready; they are accurate history rather than current status.
- 2026-09-28: Keep DEV0089 Draft. The concurrent architecture review found that its asset-standard spike and downstream delivery remain unresolved; this bookkeeping ticket does not adopt Token-2022 or Metaplex Core.

### Contracts, configuration, and operations

No runtime contract, dependency, schema, environment variable, secret, migration or deployment changes.

## Validation results

- Date and environment: 2026-09-28, repository work-record review.
- `git log -1 --format='%h %s' 867bc76` returned the expected `[DEV0084][DEV0089] Persist check-ins and plan wallet card` commit.
- Targeted `rg` checks found no current claim that COR0008 remains In progress, no current claim that DEV0085 remains Ready and no current-directory links for either archived record.
- Prettier passed for all changed Markdown files; `git diff --check` passed.
- Application, database and browser tests were not run because no runtime, schema or product contract changed.

| Criterion | Evidence                                                                                 | Result |
| --------- | ---------------------------------------------------------------------------------------- | ------ |
| AC1       | COR0007 progress, risk and completion summaries were checked against the archived index. | Passed |
| AC2       | Git history and both corrected completion references agree on `867bc76`.                 | Passed |
| AC3       | Index/path/status searches and filesystem checks found no stale current record.          | Passed |
| AC4       | Targeted searches, Prettier and patch-integrity checks passed.                           | Passed |

## Risks, limitations, and follow-ups

DEV0089's asset standard, projection authority, wallet replacement, expiry synchronization and public-display acknowledgement remain separate readiness questions. DEV0081/DEV0082 manual rejection testing remains deferred by user choice.

## Completion and review references

- Completed: 2026-09-28 — current M3 status and DEV0084/DEV0089 commit references reconciled.
- Commit: This change — `[DEV0091] [DEV0092] Reconcile records and plan PDA card lifecycle`.
- Review: Scope self-review completed; no independent review.
- Deployment or release: Not applicable — repository records only.
