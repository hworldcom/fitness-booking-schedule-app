# Ticket DEV0191: Reconcile no-minimum-notice documentation

- Status: Completed
- Created: 2026-10-11
- Last updated: 2026-10-11
- Milestone: Booking-policy documentation consistency
- Coordination: None — independent development ticket
- Related records: completed implementation [DEV0187 — Enforce booking-request eligibility](../backend/DEV0187-enforce-booking-request-eligibility.md), current coordination [COR0016 — Coach-confirmed booking requests](../../current/organisatory/COR0016-coach-confirmed-booking-requests.md), superseded historical contract [DEV0186 — Adopt booking-request and notice policies](DEV0186-adopt-booking-request-and-notice-policies.md)

## Objective and context

Make every current product, planning and navigation document unambiguous that clients may request any open future occurrence until it starts; there is no fixed 24-hour minimum notice. DEV0187 already delivered and validated this behavior, but a repository-wide audit found residual current summaries that still describe fixed notice and an archived contract whose historical 24-hour decision lacks a prominent supersession notice.

## Scope and non-goals

- In scope:
  - Replace residual current “fixed notice” summaries with the delivered future-start rule and start-capped 12-hour decision deadline.
  - Label superseded historical 24-hour decisions explicitly without rewriting their original evidence.
  - Verify current application copy, code, tests, specification and open work records contain no contradictory 24-hour booking-request rule.
- Out of scope:
  - Runtime, database or interface behavior changes already completed by DEV0187.
  - Unrelated historical 24-hour cancellation policies from retired blockchain/credit booking work.
  - Removing historical validation commands or decisions whose purpose is to document what was true at that earlier point.

## Expected behavior and edge cases

- The current contract says an open occurrence is requestable until its authoritative database start instant.
- A late request's decision deadline is the earlier of 12 hours after submission or occurrence start.
- Current summaries never imply a fixed request cutoff or minimum notice.
- DEV0186 remains immutable historical evidence, but a reader sees its dated supersession before encountering the old 24-hour policy.
- Tests may mention `24 hours` only to prove that obsolete public copy is absent; unrelated archived cancellation policy remains untouched.

## Assumptions, decisions, and dependencies

- DEV0187 is the completed authority for the corrected runtime and contract.
- This is documentation consistency, not a new product decision or runtime change.
- Archive history must remain reviewable, so the correction is additive and dated rather than a rewrite of DEV0186's original decisions or evidence.

## Implementation plan

1. Audit the full repository for minimum-notice, cutoff and 24-hour booking-request language.
2. Correct current specification, index and coordination summaries.
3. Add a prominent dated supersession notice to DEV0186 while preserving its historical body.
4. Re-run targeted searches, Markdown formatting, relative-link checks and `git diff --check`.

## Acceptance criteria

- [x] AC1: Every current authoritative or planning document describes no fixed minimum notice and request eligibility until occurrence start.
- [x] AC2: Historical 24-hour request-policy text is clearly labelled superseded, while unrelated cancellation history and negative-copy tests remain intact.
- [x] AC3: Markdown formatting, relative links, targeted consistency searches and diff checks pass.

## Validation plan

- Search the repository for `24-hour`, `24 hours`, `minimum notice`, `fixed notice`, `request cutoff` and related terms; classify every retained result.
- Run Prettier over changed Markdown files, a relative-link checker and `git diff --check`.
- Application tests are not applicable because this follow-up changes documentation only; DEV0187 owns runtime validation.

## Implementation record

Implementation started on 2026-10-11.

### Changes and rationale

- Replaced the MVP M5 “fixed notice” summary with request eligibility until occurrence start and the start-capped 12-hour decision deadline.
- Changed the root ticket index's DEV0186 summary so it no longer presents the archived 24-hour rule as current behavior.
- Labelled both earlier minimum-notice decisions in COR0016 as historical and superseded while retaining the sequence of user decisions.
- Added a prominent dated notice at the top of archived DEV0186. It links to completed DEV0187 and the current specification, states the authoritative request-until-start rule and leaves the original archived plan/evidence intact below it.
- Audited source, migrations, tests, README, the specification and all current/archive work records. Retained 24-hour references are either explicitly superseded request-policy history, DEV0187 proof of its removal, a browser assertion that obsolete copy is absent, or unrelated retired cancellation policy.

### Affected files

| File or component                                                                   | Change and purpose                                                                                                    |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `docs/mvp-spec.md`                                                                  | Makes the delivery milestone match C20 and the implemented future-start boundary.                                     |
| `tickets/README.md`                                                                 | Corrects the archive summary, records DEV0191 and advances the next available DEV identifier.                         |
| `tickets/current/organisatory/COR0016-coach-confirmed-booking-requests.md`          | Labels earlier minimum-notice choices as superseded and keeps the final no-minimum rule explicit.                     |
| `tickets/archive/organisatory/DEV0186-adopt-booking-request-and-notice-policies.md` | Adds a dated supersession notice without rewriting the historical plan, implementation evidence or validation record. |
| `tickets/archive/organisatory/DEV0191-reconcile-no-minimum-notice-documentation.md` | Preserves this follow-up's scope, implementation decisions and validation evidence.                                   |

### Decisions and deviations

- 2026-10-11: Preserve original archived policy/evidence and add a dated supersession notice rather than silently rewriting history.
- 2026-10-11: Commit this documentation reconciliation with DEV0187 because both completed tickets change the same authoritative specification, index and coordination record; the combined subject carries both development-ticket IDs.

### Contracts, configuration, and operations

No runtime contract, schema, dependency, environment variable, setup step or deployment operation changes. This record reconciles documentation with the already-delivered DEV0187 contract.

## Validation results

- Date and environment: 2026-10-11, repository documentation audit in the local workspace.
- A repository-wide `rg` audit covered `24-hour`, `24 hours`, `minimum notice`, `minimum-notice`, `request cutoff`, `cutoff-passed`, `before the cutoff`, `fixed notice`, `notice rules`, `advance`, `request window` and “hours before training” variants.
- A targeted prohibited-current-rule search returned no unlabelled statement that requests close 24 hours before training, require a start at least 24 hours away, or use a fixed 24-hour minimum/cutoff.
- An eight-assertion contract checker passed C20, M5, the start-capped deadline, ticket-index supersession, both COR0016 historical labels, the placement of the archive notice and its authoritative future-start wording.
- `npx prettier --write` completed for all five changed documentation files; a filesystem checker resolved their relative Markdown links; `git diff --check` passed.
- Application/database tests were not run because this follow-up changes documentation only. DEV0187's archived record contains the already-passed runtime, database, migration, build and responsive-browser evidence for the behavior.

| Criterion | Evidence                                                                                                                             | Result |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| AC1       | Targeted current-document search returned no unlabelled 24-hour rule; eight contract assertions passed.                              | Passed |
| AC2       | DEV0186 begins with a dated supersession notice; all other retained results were classified as history, negative proof or unrelated. | Passed |
| AC3       | Prettier, five-file relative-link validation, eight contract assertions and `git diff --check` passed.                               | Passed |

## Risks, limitations, and follow-ups

- Historical search results intentionally continue to contain `24 hours`; each retained occurrence is recognizably superseded, unrelated or a negative assertion.

## Completion and review references

- Completed: 2026-10-11. Current documentation is consistent with DEV0187's no-minimum-notice behavior and archived 24-hour request policy is explicitly superseded.
- Commit: Included with DEV0187 in `[DEV0187][DEV0191] Enforce request eligibility and reconcile notice policy`.
- Review: No review created.
- Deployment or release: Documentation-only; not deployed or released.
