# Ticket DEV0135: Narrow marketplace MVP to two loops

- Status: Completed
- Created: 2026-10-05
- Last updated: 2026-10-05
- Milestone: Marketplace M0 contract consolidation
- Coordination: [COR0010 — Coach-pass and group-funded marketplace MVP](../../current/organisatory/COR0010-group-funded-coach-marketplace-mvp.md)
- Related records: follows the completed product-contract revision in [DEV0126](DEV0126-adopt-coach-pass-and-group-funding-contract.md) and EURC migration in [DEV0134](../blockchain/DEV0134-adopt-eurc-for-marketplace-payments.md); cancels [DEV0118](../backend/DEV0118-persist-training-requests-and-coach-proposals.md) and [DEV0119](../frontend/DEV0119-present-training-requests-and-coach-proposals.md); narrows [DEV0124](../../current/frontend/DEV0124-present-coach-pass-and-group-funded-story.md) and [DEV0125](../../current/backend/DEV0125-rehearse-hosted-marketplace-loops.md)

## Objective and context

Record the user's decision that the hackathon MVP has exactly two product loops: pass-backed private calendar bookings and coach-created threshold-funded group events. Client-authored training requests and coach proposals add a third workflow without strengthening either demonstration, so remove them from the current product contract and active work map before implementation begins.

## Scope and non-goals

- In scope: revise the current MVP specification, README status language and COR0010 work map; remove request/proposal behavior from current acceptance and demo requirements; cancel and archive unstarted DEV0118/DEV0119; narrow DEV0124 public-story scope and DEV0125 hosted-rehearsal scope to the two retained loops; preserve links and ticket-index accuracy.
- Out of scope: application, database, program or migration changes; deleting already delivered generic group-event fields; removing coach discovery, profiles, locations, schedules, follows or posts; implementing either retained loop; rewriting completed or cancelled history.

## Expected behavior and edge cases

The current specification and open delivery records describe only the pass/booking and group-event loops as MVP product work. DEV0118 and DEV0119 remain readable archived evidence with an explicit cancellation reason and no implementation claims. Completed DEV0120's nullable proposal-origin compatibility field may remain unused; it grants no behavior or authority and does not keep the cancelled workflow in scope. Historical records may continue to mention earlier decisions when clearly dated and superseded.

## Assumptions, decisions, and dependencies

DEV0134 is completed and committed, so its EURC contract remains authoritative and the overlapping product documents are stable. This is a documentation and work-record consolidation; no runtime feature has to be removed because DEV0118/DEV0119 were never implemented. Social and discovery capabilities remain supporting product context rather than a third primary loop.

## Implementation plan

1. Update the MVP specification and README to define exactly the two retained loops and remove request/proposal requirements.
2. Mark DEV0118/DEV0119 Cancelled in COR0010's work map, remove them from active delivery, and keep the remaining sequence coherent.
3. Narrow DEV0124 and DEV0125 to public storytelling and hosted evidence for only the retained loops.
4. Mark DEV0118/DEV0119 Cancelled, record why no runtime cleanup is required, move them to the matching archive directories and update every affected link/index entry.
5. Run targeted terminology/link/status searches, formatting and diff checks, then complete and archive this ticket if every acceptance criterion passes.

## Acceptance criteria

- [x] AC1: The current specification identifies pass-backed private booking and coach-created threshold-funded group events as the only two hackathon MVP product loops.
- [x] AC2: No current acceptance criterion, milestone, judge-demo step, public-story ticket or hosted-rehearsal ticket requires client training requests or coach proposals.
- [x] AC3: DEV0118 and DEV0119 are archived as Cancelled with their non-implementation state and cancellation reason preserved; COR0010 and the ticket index accurately reflect that outcome.
- [x] AC4: Existing completed group-event persistence remains compatible without a destructive schema change, and documentation makes clear that any proposal-origin field is unused and non-authoritative.
- [x] AC5: Markdown formatting, repository links, targeted consistency searches and `git diff --check` pass.

## Validation plan

Search the current specification, README, current COR0010 and retained open marketplace tickets for request/proposal scope; inspect all changed links and lifecycle states; run the repository formatter check for the edited Markdown and `git diff --check`. Application tests and builds are not applicable because the ticket changes product/document ownership only and introduces no runtime code, schema or configuration.

## Implementation record

Completed as documentation and ticket-lifecycle consolidation; no runtime implementation was required.

### Changes and rationale

The authoritative specification now names exactly two hackathon product loops and removes training-request/proposal behavior from actor capabilities, flows, state, completion criteria, milestones and acceptance scenarios. README and COR0010 now match that contract. DEV0124 and DEV0125 explicitly exclude a third request/proposal workflow. DEV0118 and DEV0119 were cancelled and archived before implementation, preserving why they stopped without implying delivery. DEV0120's nullable `source_proposal_id` remains an unused, non-authoritative compatibility field so this product decision requires no destructive migration.

### Affected files

| File or component                                                                                                                                                          | Change and purpose                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `docs/mvp-spec.md`                                                                                                                                                         | Reduced the authoritative actors, flows, state, definition of done, milestones and acceptance matrix to the two retained loops. |
| `README.md`                                                                                                                                                                | Aligned the product summary, current status and server-directory description with the narrowed contract.                        |
| `tickets/current/organisatory/COR0010-group-funded-coach-marketplace-mvp.md`                                                                                               | Recorded the two-loop boundary, retained cancelled peers in the direct work map and removed them from active sequencing.        |
| `tickets/current/frontend/DEV0124-present-coach-pass-and-group-funded-story.md`                                                                                            | Removed client-request/coach-response copy and explicitly excluded a third acquisition workflow.                                |
| `tickets/current/backend/DEV0125-rehearse-hosted-marketplace-loops.md`                                                                                                     | Limited owning runtime prerequisites and hosted evidence to the two retained loops.                                             |
| `tickets/archive/backend/DEV0118-persist-training-requests-and-coach-proposals.md` and `tickets/archive/frontend/DEV0119-present-training-requests-and-coach-proposals.md` | Finalized and archived both records as Cancelled with no implementation claims.                                                 |
| `tickets/archive/backend/DEV0120-persist-group-event-catalogue-and-projections.md`                                                                                         | Added a dated correction explaining that the proposal-origin field remains nullable and unused after DEV0118 cancellation.      |
| `tickets/README.md`                                                                                                                                                        | Advanced the identifier register, moved DEV0118/DEV0119 to archived status and tracked this completed consolidation.            |

### Decisions and deviations

- 2026-10-05: The user limited the hackathon MVP to pass-backed bookings and coach-created group events. Training requests/proposals are cancelled rather than deferred inside the MVP.
- 2026-10-05: Kept DEV0118/DEV0119 in COR0010's direct work map as explicit cancelled outcomes so coordination membership remains auditable, while removing them from active delivery dependencies.
- 2026-10-05: Retained `source_proposal_id` instead of adding a destructive migration because it is nullable, has no proposal foreign key and grants no authority.

### Contracts, configuration, and operations

The product/document contract changes. No code interface, schema, migration, environment variable, secret, dependency or operational setup changes. The completed nullable group-event proposal-origin field remains an unused compatibility field; database deletion is intentionally outside scope.

## Validation results

Passed documentation and lifecycle validation.

- Date and environment: 2026-10-05, local repository documentation on macOS.
- Exact commands and outcomes: targeted `rg` searches found no active training-request/proposal requirement in README, the specification or retained open marketplace tickets; record-location/status searches found DEV0118 and DEV0119 only in their matching archive areas with `Cancelled` status; `npm run format:check` passed for the repository's configured source set; explicit Prettier validation passed for every edited Markdown file after formatting; the relative-link existence check passed for all local Markdown links in changed files; `git diff --check` passed.
- Manual steps and observed outcomes: reviewed specification sections 2–5 and 11–14, COR0010's direct work map/completion conditions, DEV0124/DEV0125 boundaries, archived cancellation records and the DEV0120 compatibility correction. The two retained loops are consistent throughout and cancelled records make no implementation claim.
- Failed, blocked, or not-run checks and reasons: the first explicit Markdown Prettier check identified four files requiring formatting; `npx prettier --write` corrected them and the repeat check passed. Application, database, program, type, build and browser checks were not run because no runtime artifact, schema or configuration changed.

| Criterion | Evidence                                                                                                    | Result |
| --------- | ----------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Specification decisions, actor flows, milestones and judge demo consistently define the two loops.          | Passed |
| AC2       | Targeted requirement search returned no active request/proposal workflow requirement.                       | Passed |
| AC3       | Archive location/status, COR0010 work-map and ticket-index review agree.                                    | Passed |
| AC4       | Specification and dated DEV0120 correction identify `source_proposal_id` as nullable and non-authoritative. | Passed |
| AC5       | Explicit Markdown formatting, local-link, consistency and diff checks passed.                               | Passed |

## Risks, limitations, and follow-ups

Historical archived records will still mention request/proposal concepts; that is intentional history and not current scope. The unused nullable proposal-origin field may be removed later only through a separately reviewed database-retention ticket if the compatibility benefit no longer justifies it.

## Completion and review references

- Completed: 2026-10-05 — narrowed the current contract/work map to two product loops and archived DEV0118/DEV0119 as cancelled before implementation.
- Commit: Not created.
- Review: Self-review completed against every acceptance criterion; no independent review.
- Deployment or release: Not applicable — documentation and ticket consolidation only.
