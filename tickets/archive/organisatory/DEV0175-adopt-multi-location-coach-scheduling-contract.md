# Ticket DEV0175: Adopt the multi-location coach scheduling contract

- Status: Completed
- Created: 2026-10-09
- Last updated: 2026-10-09
- Milestone: Scheduling-only multi-location follow-up
- Coordination: [COR0014 — Multi-location coach scheduling](../../current/organisatory/COR0014-multi-location-coach-scheduling.md)
- Related records: supplies [DEV0176 — Persist coach training locations](../../current/backend/DEV0176-persist-coach-training-locations.md), [DEV0177 — Bind availability to training locations](../../current/backend/DEV0177-bind-availability-to-training-locations.md), [DEV0178 — Manage coach training locations](../../current/frontend/DEV0178-manage-coach-training-locations.md), [DEV0179 — Edit a location-aware working week](../../current/frontend/DEV0179-edit-location-aware-working-week.md) and [DEV0180 — Pin coaches at primary locations](../../current/frontend/DEV0180-pin-coaches-at-primary-locations.md); extends the scheduling-only contract adopted by [DEV0140](DEV0140-adopt-scheduling-only-contract.md) and the provider-neutral location boundary delivered by [DEV0174](../frontend/DEV0174-decouple-location-services.md)

## Objective and context

The current product contract gives each coach exactly one public location and lets every recurring availability rule inherit that profile location. The user has now confirmed that a coach must be able to maintain multiple training locations, choose one active location as the primary map position, and assign each recurring calendar hour to a particular location. Adopt that behavior in the MVP specification before changing schema or runtime code.

This ticket also fixes the distinction between a primary location and a scheduled location. Explore always pins an approved, visible coach at the coach-selected primary location, regardless of current availability. A dated slot and its booking continue to use the actual location assigned to that availability rule. Neither meaning represents live tracking.

## Scope and non-goals

- In scope: update the confirmed decision register, actors, public discovery/profile behavior, scheduling state model, data authority, permissions, definition of done, milestone language and acceptance matrix for multiple coach-owned training locations, exactly one primary active location, location-bound recurring rules, immutable occurrence snapshots and primary-location map pins; record the initial single coach-scheduling-timezone boundary; update concise README capability wording and affected native-planning records so future clients do not assume a singleton location.
- Out of scope: database migrations, domain or service changes, location-management controls, calendar controls, map changes, mobile implementation, live-location tracking, route optimization, travel-time enforcement, global point-of-interest persistence or a date picker on Explore.

## Expected behavior and edge cases

- An approved or demo coach may keep multiple confirmed active training locations, including reviewed gym references and coach-owned independent/provider-neutral snapshots.
- A visible coach has exactly one active primary location. The primary location is the coach's public map base and is not a claim that the coach is physically present there.
- Explore has no date selector in this slice and shows every approved/demo visible coach at the primary location even when that coach has no open time today.
- Explore may present today's open times or an explicit no-availability-today state, but availability never controls whether an otherwise visible coach has a map marker.
- Every active recurring availability rule belongs to one active owned training location. One calendar hour cannot be assigned to two locations for the same coach.
- The coach selects calendar cells locally, sees their assigned location, and explicitly saves rather than causing one mutation per cell.
- Dated occurrences copy an immutable snapshot of the rule's actual location. Profile, primary-location or location metadata changes never move an existing booked occurrence.
- Deactivating a location stops new availability there and withdraws eligible future open occurrences while preserving booked/terminal history and its snapshots.
- The first delivery retains one coach scheduling timezone. Cross-timezone location calendars, travel-time calculation and automatic buffers require a later contract.

## Assumptions, decisions, and dependencies

- Confirmed user constraint, 2026-10-09: coaches may add multiple gyms and calendar availability depends on the selected location.
- Confirmed user constraint, 2026-10-09: an empty weekly cell is assigned to the currently selected location, multiple selections remain local until explicit save, and a selected cell visibly identifies its location.
- Confirmed user constraint, 2026-10-09: the coach chooses a primary location and Explore pins that coach there continuously rather than moving or removing the marker based on today's availability.
- Confirmed boundary, 2026-10-09: Coach Workspace remains location-aware even though Explore pins only the primary location.
- Adopted product clarification: public language says `primary training location` or `available at`, never that a coach is currently at a place.
- Proposed implementation defaults owned by later tickets: soft-deactivate referenced locations, use stable location colors/short labels in the editor, group marker collisions and retain the existing provider-neutral storage provenance. These defaults must not be presented as separate user requirements.
- The existing `app.gyms` catalogue remains an optional reviewed reference and grants no account authority. A selected external search result becomes bounded coach-owned location data, not a global point-of-interest catalogue.
- DEV0176-DEV0180 depend on the contract adopted here. COR0013's native tickets remain downstream consumers under their existing coordination record and are not direct COR0014 members.

## Implementation plan

1. Replace singleton-location language in the specification with coach-owned training locations and one primary active location.
2. Define the primary-location discovery marker separately from the actual location snapshot carried by rules, occurrences and bookings.
3. Define location-aware coach calendar behavior, explicit draft/save semantics, deactivation/history rules and the single scheduling-timezone boundary.
4. Extend permission, failure, definition-of-done and acceptance scenarios for cross-coach location IDs, primary replacement, overlap rejection, unavailable-today presentation and historical stability.
5. Update affected native planning records as downstream consumers without moving them out of COR0013 or claiming native implementation.

The work is one documentation contract. Runtime delivery remains owned by the peer tickets under COR0014.

## Acceptance criteria

- [x] AC1: The specification permits multiple confirmed coach training locations and requires exactly one active primary location for a visible coach.
- [x] AC2: The specification distinguishes the always-present primary Explore marker from actual location-bound availability and immutable occurrence/booking snapshots.
- [x] AC3: Coach calendar behavior assigns each recurring hour to exactly one owned active location and preserves local draft plus explicit-save behavior.
- [x] AC4: Deactivation, overlap, authorization, history, timezone and no-availability-today behavior are explicit without introducing live tracking or a global point-of-interest catalogue.
- [x] AC5: Definition-of-done, acceptance scenarios and downstream native planning use the multi-location contract without claiming runtime work is complete.

## Validation plan

Run Markdown formatting, repository-relative link/record checks and `git diff --check`. Review the changed specification against the confirmed decision register, scheduling state model, booking recovery, authorization rules, definition of done and acceptance matrix. Application and database tests are not applicable because this ticket changes documentation and planning only.

## Implementation record

The multi-location product contract is adopted. Runtime implementation remains intentionally open under DEV0176-DEV0180.

### Changes and rationale

- Created COR0014 and six flat peer development tickets so the product contract, persistence, availability, profile interface, calendar and discovery marker each have one explicit owner before runtime work begins.
- Added confirmed decisions C16-C18 and reconciled actors, discovery flows, the scheduling state model, infrastructure authority, permissions, security invariants, definition of done, milestone language, acceptance scenarios and demo behavior.
- Defined the primary location as the visible coach's permanent Explore training-base marker while keeping every rule, occurrence and booking tied to its actual assigned venue.
- Preserved one coach scheduling timezone, local multi-cell drafting plus one explicit save, cross-location overlap rejection, safe deactivation/history and provider-neutral/manual fallbacks.
- Updated concise README wording without claiming the singleton runtime has already been replaced, and aligned COR0013/DEV0159/DEV0160/DEV0162-DEV0164 so future native work cannot restore the old singleton contract.

### Affected files

| File or component                                                                                | Change and purpose                                                                                                                                           |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `docs/mvp-spec.md`                                                                               | Adopted decisions C16-C18 and reconciled multi-location discovery, scheduling, authority, completion and acceptance behavior.                                |
| `README.md`                                                                                      | Summarized the target while explicitly retaining the truthful one-location description of the current runtime.                                               |
| `tickets/README.md`                                                                              | Indexed COR0014/DEV0175-DEV0180 and maintained lifecycle status/navigation.                                                                                  |
| `tickets/current/organisatory/COR0014-multi-location-coach-scheduling.md`                        | Coordinates the completed contract and five remaining runtime tickets.                                                                                       |
| `tickets/current/backend/DEV0176-*` and `DEV0177-*`                                              | Own location persistence and location-bound availability without silently extending this documentation ticket.                                               |
| `tickets/current/frontend/DEV0178-*`, `DEV0179-*` and `DEV0180-*`                                | Own profile management, the location-aware calendar and permanent primary marker.                                                                            |
| `tickets/current/organisatory/DEV0159-*` and `COR0013-*`                                         | Aligned the native contract/coordination with the shared multi-location target while preserving COR0013 membership.                                          |
| `tickets/current/backend/DEV0160-*` and `tickets/current/frontend/DEV0162-*` through `DEV0164-*` | Replaced singleton native assumptions with primary-versus-actual location projections, location-aware schedule behavior and multi-location profile planning. |

### Decisions and deviations

- 2026-10-09: Kept Explore marker eligibility independent from availability after the user replaced the earlier availability-driven marker proposal. Today's open times remain presentation data only.
- 2026-10-09: Kept the README's delivered-foundation statement explicitly singular because DEV0176-DEV0180 have not changed runtime behavior; the target paragraph links to COR0014 instead of claiming delivery.
- 2026-10-09: Updated the existing COR0013 native peers as downstream consumers rather than changing their direct coordination membership.

### Contracts, configuration, and operations

The product/documentation contract adds decisions C16-C18 and changes the target coach, discovery, availability and location data shapes described by the specification. It adds no runtime schema, API, dependency, environment variable, credential, setup step or deployed resource. The current application remains singleton-location until DEV0176-DEV0180 implement and validate the new contract.

## Validation results

Validation completed on 2026-10-09 in the local repository:

- `npx prettier --check` passed for the specification, README, ticket index, COR0013/COR0014 and every affected DEV planning record.
- The targeted relative-link checker passed for all 16 affected documents.
- Eight explicit contract assertions passed across C16-C18, primary-versus-actual location behavior, the single-timezone boundary, deactivation/history, acceptance scenarios and removal of the old `one confirmed location` promise.
- The repository-wide work-record check found 125 unique ticket headings and reciprocal COR0014 membership for DEV0175-DEV0180.
- `git diff --check` passed.
- Application, database and browser tests were not run because this ticket changes documentation/planning only and explicitly does not alter runtime behavior.

| Criterion | Evidence                                                                    | Result |
| --------- | --------------------------------------------------------------------------- | ------ |
| AC1       | C16 plus coach-profile/training-location state-model review                 | Passed |
| AC2       | C17, discovery flow, booking projection and acceptance scenarios            | Passed |
| AC3       | C18, location-aware management flow and scheduling-permission review        | Passed |
| AC4       | Deactivation, overlap, authorization, history, timezone and provider review | Passed |
| AC5       | Definition-of-done, matrix, demo, README and COR0013 downstream review      | Passed |

## Risks, limitations, and follow-ups

Runtime remains on the singleton model until DEV0176-DEV0180 complete. Those tickets must keep the primary training base separate from the actual session venue and must not infer delivery from this documentation change. Cross-timezone schedules and travel buffers remain intentionally deferred; if required, create a new product-contract ticket rather than silently expanding this work.

## Completion and review references

- Completed: 2026-10-09 — adopted the multi-location, primary-marker and actual-venue scheduling contract and aligned downstream planning.
- Commit: Not created.
- Review: Self-review against all acceptance criteria completed; no independent review or pull request created.
- Deployment or release: Not applicable — documentation contract only; no runtime was deployed.
