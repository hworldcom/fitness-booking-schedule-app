# Ticket DEV0233: Define group training and events growth scope

- Status: Completed
- Created: 2026-10-14
- Last updated: 2026-10-15
- Milestone: M7 — Group training and events
- Coordination: [COR0021 — Group training and events](../../current/organisatory/COR0021-group-training-and-events.md)
- Related records: independent Explore preview [DEV0235](../../current/frontend/DEV0235-preview-home-aligned-explore.md) and Explore implementation [DEV0236](../frontend/DEV0236-align-explore-with-home-discovery.md); peer runtime tickets DEV0237–DEV0241 are mapped by COR0021; excluded-product documentary pruning [DEV0225](DEV0225-remove-blockchain-historical-evidence.md)

## Objective and context

Adopt the smallest complete **Group training & events — Growth** product contract and split its implementation into reviewable peers. A group session is one dated coach-led activity with several participant seats. It is separate from a capacity-one private booking, recurring availability and a coach–athlete connection.

The user confirmed Free/pay-at-session pricing and direct joining with manual coach confirmation/cancellation. The [single specification](../../../docs/mvp-spec.md#15-group-training-and-events) defines the resulting target, [M7 milestone](../../../docs/mvp-spec.md#12-delivery-milestones) and [acceptance scenarios](../../../docs/mvp-spec.md#13-acceptance-matrix); runtime is not delivered by this ticket. The growth hypothesis remains unmeasured.

### Overlap review

| Record                                                                    | Owned outcome                                                                    | Relationship to group events                                                                                          |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| [DEV0235](../../current/frontend/DEV0235-preview-home-aligned-explore.md) | Offline illustrative Explore preview and its own browser validation              | Independent; incomplete preview checks do not block the group backend                                                 |
| [DEV0236](../frontend/DEV0236-align-explore-with-home-discovery.md)       | Home-aligned Explore coach discovery, shared controls and existing real map/URLs | Independent visual baseline; group pages may reuse stable components but never change its owned Home/Explore behavior |
| DEV0233                                                                   | Adopted group contract and flat delivery work map                                | Documentation only; runtime and its new Events navigation belong to the mapped peers                                  |

The outcomes do not overlap. Sequence public group UI changes after active DEV0236 edits where shared components/styles/navigation are involved. Backend and coach management can proceed independently. No group entries or price filters are added to Home/Explore, and no Explore acceptance evidence is claimed by this ticket.

## Scope and non-goals

- In scope: adopt the confirmed choices and explicit operating defaults; define lifecycle/capacity/deadline/privacy/history and private-scheduling compatibility; reconcile specification scope/permissions/definition of done/M7/scenarios and README navigation; create COR0021 and peer runtime records; validate documentation and ownership.
- Out of scope: application routes/components/services, schema/migrations, runtime tests or feature delivery, importing legacy funding data/code, payments/wallets, recurring events, waitlists, notifications, attendance proof, connection eligibility changes, Home/Explore implementation and deployment.

## Expected behavior and edge cases

The [group contract](../../../docs/mvp-spec.md#15-group-training-and-events) is authoritative. A direct join reserves one seat; only an explicit owner decision before the deadline, with the minimum met, confirms that the session will run. Merely reaching the minimum never confirms it. Free or fixed EUR per-person pay-at-session pricing is visible before joining and never implies payment was collected.

Contract review covers last-seat races, duplicate retry/withdraw/rejoin, under-minimum confirmation, missed decisions, post-confirmation withdrawal, cancellation, immutable published terms/venue, hidden/suspended owners, public count versus private roster, exact actor/dataset scope, group/private time conflicts and recurring occurrence recovery. The existing private request/booking and connection contracts remain distinct.

## Assumptions, decisions, and dependencies

Confirmed user choices:

- 2026-10-14: coaches create dated sessions with minimum/maximum participants; athletes discover and join; initial pricing is Free or pay at the session, with in-app payment deferred.
- 2026-10-15: joining is direct, while the coach confirms or cancels the group manually. The user selected this over the proposed automatic threshold-confirmation model.

Adopted implementation defaults, separately labelled in the specification: a coach-set future decision/registration deadline with terminal Not confirmed if missed; confirmation requires the minimum and does not reverse after later withdrawals; withdrawal until start; fixed EUR terms/actual venue frozen at publication; bounded private roster and public counts; single-date activities; guarded coach-wide time reservations and explicit private conflict recovery; in-app-only status. These defaults make the chosen model implementable without representing them as additional user decisions.

Existing approved/demo coach identity, owned active locations and email accounts are foundations. Group registration grants no private booking, connection or private-avatar access. Historical funding tables/branch records remain excluded and are not runtime dependencies.

DEV0233 already has planning commit `12f439e`; preserve its identifier and scope. COR0021 is a separate new coordination record, not a conversion/renumbering. Runtime peers own all code and runtime evidence, including private-scheduling integration. DEV0235/DEV0236 are independent baselines, not direct members.

## Implementation plan

1. Record the overlap review and user's direct-join/manual-decision choice before specification adoption. Resolve remaining operating details as explicit implementation defaults.
2. Amend the single specification's overall scope, state/authority references, M7, definition of done and acceptance matrix, with the detailed group contract in section 15. Update README navigation without duplicating requirements; preserve active Explore edits.
3. Create COR0021 with six direct peers: this contract ticket, DEV0237 group data/registration, DEV0238 scheduling guards/publication, DEV0239 coach UI, DEV0240 public/athlete UI and DEV0241 integrated proof. State sequence, safe start conditions and completion gates.
4. Check relative links/anchors, identifiers/reservations/statuses, reciprocal membership, exclusive deliverable ownership and meaningful contract scenarios. Application checks are not applicable to documentation-only work.
5. Finish the implementation record, complete/archive this ticket and update every active link/index entry only when its documentation criteria pass. Leave COR0021 and runtime tickets open, with no code/deployment claim.

## Acceptance criteria

- [x] AC1: The pricing and direct-join/manual-decision choices are recorded, implementation defaults are distinct, and lifecycle/privacy/conflict scenarios have unambiguous outcomes.
- [x] AC2: The specification consistently defines the complete adopted extension, retaining private scheduling and excluding funding/payment collection; README navigation/positioning agree.
- [x] AC3: A separate flat COR maps every deliverable to exactly one direct peer, including runtime dependencies/start conditions and integrated completion gates. DEV0235/DEV0236 retain their independent ownership.
- [x] AC4: Documentation formatting, links/anchors, identifiers/index/statuses, reciprocal ownership and whitespace checks pass, with exact validation and review evidence recorded.

## Validation plan

- Review concrete contract examples: four reserved seats do not confirm automatically; explicit confirmation of four succeeds before deadline; a withdrawal to three preserves confirmed status; an undecided session expires even with four; concurrent last-seat joins produce one winner; publication/private creation cannot reserve overlapping coach time.
- Validate every relative link/anchor in affected Markdown, unique DEV/COR IDs across current/archive/reserved registers, metadata/index statuses, reciprocal COR membership and exactly one owner for each implementation part.
- Run targeted Prettier/document consistency checks and `git diff --check`; compare changes with the overlap review and preserve concurrent DEV0235/DEV0236 content.
- Application/database/browser/lint/type/build checks are not applicable here: no runtime code changes. Each runtime peer defines its own meaningful tests, and DEV0241 owns the final real local integrated rehearsal.

## Implementation record

The group contract and flat delivery map are complete and documentation checks passed on 2026-10-15. Group runtime implementation has not started. DEV0235/DEV0236 remain independent work.

### Changes and rationale

Created a separate growth-planning ticket because the current branch has no active lightweight group-events scope. Existing hackathon funding work cannot silently override the scheduling-only specification. Recorded three pricing choices and an explicit proposed recommendation so future discussion can proceed without assuming a payment decision.

Following the user's confirmation, recorded free and pay-at-session sessions as the selected starting scope, deferred in-app collection, removed the pricing-choice question from the open decisions, and added a separately labelled future pricing constraint to the specification. This adopts one future design constraint without representing the unfinished group lifecycle as delivered or ready for implementation.

2026-10-15: Finished the target contract after the user selected direct joining with manual coach decisions. Added explicit operating defaults and scenarios, reconciled former group exclusions with the adopted M7 target, retained private-session/connection authority, and created one flat coordination with separate data, scheduling-guard, coach UI, public/athlete UI and integrated-proof peers. Compared DEV0235/DEV0236 and kept their preview/Explore outcomes independent. No runtime capability was implemented.

### Affected files

| File or component                                                          | Change and purpose                                                                                   |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| This record                                                                | Preserves the choices, defaults, overlap review, planning history and completed contract evidence    |
| [Specification](../../../docs/mvp-spec.md#15-group-training-and-events)    | Owns the adopted target, M7 and acceptance scenarios while distinguishing pending runtime            |
| [Ticket index](../../README.md)                                            | Tracks the contract outcome and all open group runtime/coordination records                          |
| [README](../../../README.md)                                               | Navigates to the adopted contract/coordination while stating that group runtime is not delivered     |
| [COR0021](../../current/organisatory/COR0021-group-training-and-events.md) | Maps every implementation part, dependency, independent Explore baseline and integration gate        |
| DEV0237–DEV0241 linked by COR0021                                          | Define bounded peer implementation and validation ownership; no code is delivered by ticket creation |
| DEV0225 archived evidence record                                           | Repair only its growth-plan link after this ticket moved; preserve its completed historical content  |

### Decisions and deviations

2026-10-14, initial planning: no product-policy adoption or runtime work occurred. Displaying prices and collecting at the session was a proposal at that checkpoint.

2026-10-14, pricing confirmation: the user selected free and pay-at-session sessions as the first step. The recommendation is now a confirmed future constraint; remaining lifecycle proposals are not user decisions. Updated the plan before recording that constraint in the specification. No deviation from the documentation scope.

2026-10-15: The user selected manual coach confirmation/cancellation over the suggested automatic threshold-confirmation model. Direct joining still reserves capacity. Adopted and labelled the other operating defaults rather than treating them as user decisions. Kept the committed DEV0233 identity and added COR0021 instead of converting/retiring this ticket. Reviewed the scope/plan before specification changes; no runtime scope expansion.

### Contracts, configuration, and operations

The 2026-10-14 checkpoint recorded one future pricing constraint and was committed as `12f439e`. On 2026-10-15 the specification adopts M7's complete nonfinancial group-session target, including distinct registration/confirmation states, EUR display terms, deadline expiry, private roster/public counts, immutable snapshots and coach time-conflict authority. Private capacity-one booking, identity/approval and connection contracts remain intact. New runtime data/services/routes are planned under DEV0237–DEV0241, not implemented here. No schema, API implementation, dependency, environment value, migration or deployment changed; no additional commit is created by this contract-completion turn.

## Validation results

Initial planning checks passed on 2026-10-14 in the local repository before pricing confirmation. The evidence below preserves that checkpoint; contract criteria remained open at that time. The 2026-10-15 completion evidence follows those historical checkpoints.

- `python3 /tmp/movx-dev0233-ticket-check.py` passed 202 relative-link checks, 11 anchor checks and uniqueness checks for 174 work records, plus this ticket's template/metadata and index status/next-identifier consistency.
- The first link check caught an outdated section-7 anchor in the new ticket. Corrected it to the existing `Requests, booking and recovery` heading and repeated the checks successfully. No existing specification heading was changed.
- `./node_modules/.bin/prettier --check tickets/current/organisatory/DEV0233-define-group-training-and-events-growth-scope.md tickets/README.md` passed.
- `git diff --check` passed. Planning self-review confirmed the recommendation remains proposed, the current specification is unchanged by this ticket, and event runtime has separate future ownership.
- Application tests, lint, type checks, build, database and browser checks were not run: only Draft documentation/index entries changed. No new runtime behavior exists to validate.

Pricing-confirmation update on 2026-10-14:

- `python3 /tmp/movx-dev0233-ticket-check.py` passed 216 relative-link checks, 13 anchors and 174 unique record identifiers, ticket/index metadata checks and assertions that pricing is confirmed in the ticket, specification and index. The script also passed a scoped Prettier stdin check of the new specification subsection.
- `./node_modules/.bin/prettier --check tickets/current/organisatory/DEV0233-define-group-training-and-events-growth-scope.md tickets/README.md` and `git diff --check` passed.
- Self-review confirmed that free/pay-at-session pricing is settled, in-app collection is deferred, and registration/minimum-count decisions remain open. Preserved unrelated specification edits and its existing acceptance-table padding; the specification's formatting check is scoped to the new subsection.
- Application/database/browser/static build checks remain not applicable: this update records a future pricing constraint without changing runtime code.

Commit handoff on 2026-10-14: the user authorized committing this planning checkpoint. Include this Draft, only its future-pricing subsection in the specification, and only its index entry/next identifier plus reservations for the independently allocated DEV0231–DEV0232. Leave the Home, connections, database-validation and local-migration work outside this commit. The ticket remains Draft and no runtime acceptance criterion is claimed complete.

Commit-preparation validation: `python3 /tmp/movx-dev0233-commit-check.py` passed 213 relative-link checks, 13 anchors and uniqueness checks for 172 work records against the prepared committed snapshot, rather than relying on unrelated working-tree files. Full Prettier stdin checks passed for all three prepared files; Draft metadata, index reservations and the exact three-file scope agree. Application checks are not applicable to this documentation checkpoint. Required final gates are the same script with `--staged` and `git diff --cached --check` before committing.

Final staged validation: `python3 /tmp/movx-dev0233-commit-check.py --staged` passed the same 213 links, 13 anchors, 172-record uniqueness and three-file formatting/scope checks. `git diff --cached --check` passed; staged review confirmed that the specification adds only the pricing subsection and the index adds only this Draft, its next identifier and the independent-ID reservation.

Contract-completion validation on 2026-10-15:

- `python3 /tmp/dev0233-check-growth-contract.py` passed 257 relative-link checks, 33 anchors, uniqueness for 147 work records, six reciprocal direct DEV memberships, exclusive work-map rows, metadata/index agreement and next-ID reservations. The same checker is repeated after archival/link updates. It also confirms the existing C27–C29 Home/Explore decisions are unchanged from the pre-edit snapshot.
- `./node_modules/.bin/prettier --check` passed for README, the specification, ticket index, this ticket, COR0021 and DEV0237–DEV0241 (the ten affected Markdown files). `git diff --check` passed.
- Contract self-review: four reservations never confirm automatically; only the owner with the minimum met before deadline can confirm. A later withdrawal to three keeps confirmation; no owner decision expires even with four. Concurrent last-seat joins must yield one winner, and group/private time writes share one schedule guard. These are reviewed contract outcomes, not executed runtime tests.
- Confirmed choices versus adopted defaults, public count/private roster, frozen terms/venue, missed decisions, explicit cancellation, withdrawn-history preservation, self/dataset/coach eligibility and recurrence-release boundaries are accounted for by the specification scenarios and peer acceptance criteria. No implementation part is assigned to DEV0235/DEV0236.
- Application unit/database/browser tests, lint/type/build and real payment/attendance checks are not run: this ticket changes documentation only. Runtime tests/rehearsal remain required in the open peers; deployment and independent review are not claimed.

Post-archive validation: `python3 /tmp/dev0233-check-growth-contract.py` passed 270 relative links, 34 anchors and the same 147-record/six-member ownership checks across all eleven affected Markdown files, including the link-only DEV0225 repair. Targeted Prettier and `git diff --check` passed after relocation. All current links now point to this completed archive record; no archived historical decision was reopened or changed.

| Criterion | Evidence                                                                                                                                           | Result |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | User choices and explicit defaults; complete reviewed lifecycle/privacy/conflict scenarios                                                         | Passed |
| AC2       | Adopted section 15, reconciled scope/M7/definition of done/scenarios and README navigation                                                         | Passed |
| AC3       | COR0021 maps this completed contract and five runtime peers with reciprocal membership, sequence and completion gates; Explore remains independent | Passed |
| AC4       | Targeted document/ownership/format/whitespace checks and self-review above                                                                         | Passed |

## Risks, limitations, and follow-ups

The user selected free/pay-at-session sessions and manual coach decisions. Registration cannot establish payment or actual attendance and may produce cancellations/no-shows. Confirmed sessions can lose participants; the coach remains responsible for an explicit cancellation. EUR is an adopted first-version implementation default, not a separately confirmed user choice. In-app payment, reminders, recurring events and attendance tracking are deferred. No delivery date, measurement system or payment provider is confirmed.

Handoff: the complete contract and COR0021/DEV0237–DEV0241 work map exist; group runtime has not started. Next implementation is DEV0237, followed by DEV0238's mandatory publication/conflict guard, then the frontend peers and final DEV0241 proof. DEV0235/DEV0236 remain independent active work. No group publication may bypass the scheduling guard, and documentation completion does not satisfy runtime acceptance criteria.

## Completion and review references

2026-10-15 commit handoff: the user requested committing all current changes before event runtime begins. This checkpoint owns group contract adoption/archival, COR0021 and the five peer plans, README/index updates and reference-only repairs in DEV0225/COR0022. The separate DEV0235 preview and DEV0236 implementation are committed first under their own IDs. Current group-document checks pass with the later messaging identifiers allocated; runtime acceptance remains unrun and owned by the open peers. No event runtime or deployment is added by the commit.

- Completed: 2026-10-15 — adopted and validated the group-training contract and flat implementation plan; no runtime delivered.
- Commit: Earlier pricing checkpoint `12f439e` — `[DEV0233] Record group training and pay-at-session scope`; user-authorized contract completion checkpoint — `[DEV0233] Adopt the group-training contract and delivery plan`.
- Review: Contract/ownership/documentation self-review passed; no independent review.
- Deployment or release: None — documentation contract only.
