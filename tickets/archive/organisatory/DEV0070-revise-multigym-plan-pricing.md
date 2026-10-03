# Ticket DEV0070: Revise multi-gym plan pricing

- Status: Completed
- Created: 2026-09-25
- Last updated: 2026-09-25
- Milestone: M0 core product contract
- Coordination: [COR0007 — Core multi-gym membership MVP](./COR0007-core-multigym-membership-mvp.md)
- Related records: amends the contract adopted by completed [DEV0069 — Adopt core multi-gym membership MVP](DEV0069-adopt-core-multigym-membership-mvp.md); affects catalogue coordination [COR0006](./COR0006-persistent-access-catalogue.md)

## Objective and context

Revise the illustrative monthly multi-gym membership offer before runtime implementation: Basic becomes €80 with ten included check-ins per period, and Classic becomes €150 with no numerical monthly check-in cap. Preserve exactly four selected core gyms, the one-included-check-in-per-day rule for both plans, the illustrative €8 non-core member price and every other boundary adopted by DEV0069.

The user selected the higher values as working demo pricing. They remain configurable hypotheses rather than validated production economics.

## Scope and non-goals

- In scope: update the current specification, acceptance examples and current coordination risks/defaults from €50/eight and €80/unlimited to €80/ten and €150/unlimited; keep terminology and ticket links consistent.
- Out of scope: application code, catalogue rows, migrations, membership/payment implementation, non-core visit pricing, core-gym count, settlement formula, renewal/cancellation, market validation, deployment and changes to archived historical decisions.

## Expected behavior and edge cases

Basic costs an illustrative €80 for one monthly demo period and includes ten valid check-ins. Its eleventh valid-looking attempt is rejected after ten uses. Classic costs an illustrative €150 for the same kind of period and has no numerical monthly allowance. Both remain limited to one included check-in per membership per venue-local calendar day; “unlimited” therefore never means multiple included check-ins in one day.

Prices and allowances are versioned plan terms. Later changes must not mutate a period already activated against an earlier version. The €8 direct non-core visit remains separate from both plan allowances and membership-pool allocation.

## Assumptions, decisions, and dependencies

- €80 and €150 are user-confirmed working demo prices, not researched market claims.
- Ten is the confirmed Basic demo allowance; Classic remains daily-uncapped rather than being represented by a large synthetic number.
- DEV0069 stays archived and unchanged as the historical record of the prior €50/eight and €80/unlimited working values.
- COR0006's future additive catalogue-schema ticket must implement the latest values as configurable/versioned data; COR0007's later runtime tickets consume that version.

## Implementation plan

1. Amend C20, P18, the plan contract, definition of done, acceptance matrix and demo example in `docs/mvp-spec.md`.
2. Update COR0006/COR0007 pricing-risk language and register DEV0070 as direct COR0007 contract work.
3. Update the work-record index, run targeted terminology searches, local Markdown link/anchor checks, `git diff --check` and the repository format check.

## Acceptance criteria

- [x] AC1: Every current normative plan reference defines Basic as €80 with ten included period check-ins and Classic as €150 with no numerical monthly cap.
- [x] AC2: Both plans retain the single included check-in per venue-local calendar day rule; the €8 non-core price and four-gym selection are unchanged.
- [x] AC3: Current coordination records and the ticket index reflect DEV0070 without rewriting archived historical records.
- [x] AC4: Targeted terminology, Markdown link/anchor, formatting and whitespace checks pass.

## Validation plan

Search current specification/coordination records for the superseded €50/eight and €80-as-Classic wording. Review the plan fields, limits, acceptance scenario and demo example together. Validate reciprocal COR0007 membership and repository-local Markdown links/anchors; run `git diff --check` and `npm run format:check`. Runtime/database/browser tests are not applicable to this documentation-only amendment.

## Implementation record

Completed the documentation-only plan revision. No application, schema, program or deployment behavior changed.

### Changes and rationale

- Updated the authoritative C20/P18 values, versioned plan example, definition of done, A05 and demo walkthrough to Basic €80/ten and Classic €150/unlimited.
- Preserved the shared maximum of one included check-in per membership per venue-local calendar day, exactly four selected core gyms and the separate illustrative €8 non-core visit.
- Updated COR0006 catalogue assumptions and made DEV0070 a direct COR0007 contract-amendment member. Archived DEV0069 remains the historical record of the previous working values.

### Affected files

| File or component                                                      | Change and purpose                                                                                  |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `docs/mvp-spec.md`                                                     | Sets Basic to €80/ten and Classic to €150/unlimited throughout the normative contract and examples. |
| `tickets/current/organisatory/COR0006-persistent-access-catalogue.md`  | Updates the configurable catalogue hypotheses and links the amendment.                              |
| `tickets/current/organisatory/COR0007-core-multigym-membership-mvp.md` | Registers this direct contract amendment and updates the economics risk/progress record.            |
| `tickets/README.md`                                                    | Registers and archives DEV0070 and advances the next development identifier.                        |

### Decisions and deviations

- 2026-09-25: The user selected €150 for Classic unlimited access and €80 for Basic with ten entries.

### Contracts, configuration, and operations

Documentation contract only. No runtime, schema, dependency, configuration, environment variable, migration or deployment changes are included.

## Validation results

| Criterion                       | Evidence                                                                                                                                                            | Result                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| AC1–AC2                         | Targeted `rg` audit across the current specification and coordination records; remaining €50/eight references occur only in DEV0070's explicit before-state/history | Passed                                                               |
| AC3                             | Manual reciprocal review of DEV0070, COR0006, COR0007 and the ticket index                                                                                          | Passed                                                               |
| AC4 — whitespace                | `git diff --check`                                                                                                                                                  | Passed with no output                                                |
| AC4 — repository formatting     | `npm run format:check`                                                                                                                                              | Passed; all configured application/source files match Prettier style |
| AC4 — Markdown paths            | Node audit over 92 Markdown files                                                                                                                                   | Passed; all repository-local targets resolve                         |
| AC4 — Markdown fragments        | Node heading/explicit-anchor audit                                                                                                                                  | Passed; all local fragments resolve                                  |
| Runtime/database/browser checks | Not run — no executable or database artifact changed                                                                                                                | Not applicable                                                       |

## Risks, limitations, and follow-ups

The higher prices improve nominal pool funding but do not resolve allocation scope, unused value, high-frequency Classic economics, refunds, reserves, taxes or final payout timing. These values still need member and gym validation before production use.

## Completion and review references

- Completed: 2026-09-25 — Basic is now €80/ten and Classic is €150/unlimited in the current contract.
- Commit: Not created.
- Review: Self-reviewed against AC1–AC4; no independent review.
- Deployment or release: Documentation only; none.
