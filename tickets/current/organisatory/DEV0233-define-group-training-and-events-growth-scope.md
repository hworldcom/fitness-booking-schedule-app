# Ticket DEV0233: Define group training and events growth scope

- Status: Draft
- Created: 2026-10-14
- Last updated: 2026-10-14
- Milestone: Proposed growth extension — not an adopted MVP milestone
- Coordination: None — independent development ticket
- Related records: earlier excluded-product baselines were pruned under [DEV0225](../../archive/organisatory/DEV0225-remove-blockchain-historical-evidence.md); separate-branch references `COR0019` and `DEV0216` on `hackathon/solana-group-events` remain identifier context, not files or dependencies on this branch.

## Objective and context

Define a bounded **Group training & events — Growth** extension before changing the scheduling product. A group session is one coach-led training activity with several participants at a specified time and place. The user proposes coaches creating sessions with a date and minimum/maximum participant counts, and athletes discovering and joining. The user has confirmed that the first version supports free sessions and paid sessions collected by the coach at the session; in-app payment is deferred.

The proposed growth hypothesis is that group sessions connect coach tools with new athlete acquisition and repeat training. This is a hypothesis, not measured demand or a confirmed conversion result.

The [current specification](../../../docs/mvp-spec.md#2-confirmed-target-and-decisions) excludes group-event/payment runtime and defines capacity-one private-session requests. Its [future growth pricing constraint](../../../docs/mvp-spec.md#confirmed-pricing-constraint-for-a-future-growth-extension) records the user's selected starting model without adopting the remaining group lifecycle. The [booking contract](../../../docs/mvp-spec.md#7-requests-booking-and-recovery) must remain distinguishable from any new group registration. The [milestones](../../../docs/mvp-spec.md#12-delivery-milestones) and [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix) do not yet define this extension's delivery.

Existing records cover a different product: COR0019 coordinates Solana threshold-funded events on the separate local hackathon branch; DEV0216 delivered its Events interface, while final integrated rehearsal remains under DEV0217. Archived DEV0123 was cancelled when this branch became scheduling-only. Neither defines a lightweight growth feature here.

This ticket owns only the eventual product-contract/documentation decision. It does not own event runtime implementation.

## Scope and non-goals

- In scope: record the confirmed free/pay-at-session pricing constraint in the specification; refine price disclosure details, participant registration and minimum-count behavior; define the smallest coach-create/athlete-discover/join flow; document authority, privacy, cancellation and scheduling boundaries; amend the full specification and navigation documentation when the remaining extension is adopted; identify separately owned implementation slices.
- Out of scope: application routes/components, APIs, database/schema changes, migrations, tests of new runtime behavior, importing hackathon code, payment processing or wallets, contacting coaches/athletes, analytics instrumentation, and launching events. Runtime delivery needs separate development tickets and a flat coordination record after the contract is settled.

## Expected behavior and edge cases

Confirmed starting pricing: explicitly display `Free` or a fixed per-person price with `Pay at the session`. The coach collects payment at the session. Registration does not establish payment or attendance; in-app collection is deferred.

The remaining flow below is a discussion proposal, not adopted behavior:

- An approved coach creates a session with a title, discipline, intended experience level, location, date/start time, duration, minimum and maximum participants. Public Events discovery and a shareable detail page lead to an email-authenticated join action.
- Proposed minimum interface: upcoming session cards, coach identity, actual venue/time, participant count, capacity and unambiguous price/payment wording; the owner sees a private roster, and an athlete can view and leave their own registration.
- Proposed registration default: joining directly reserves one seat rather than entering the private-session coach-approval queue. One account gets one active registration; concurrent joins cannot exceed maximum capacity. Confirm this distinction before implementation.
- A minimum participant count must have an explicit decision deadline and consequence. Reaching that count, a coach confirming the session, and an athlete reserving a seat must not be presented as equivalent unless the adopted contract makes them equivalent.
- Resolve below-minimum sessions, withdrawals after the minimum is reached, full events, duplicate/retried joins, coach cancellation, past events, coach suspension and important edits after registrations exist.
- Specify conflicts between group sessions and the coach's existing private availability/bookings, including duration and venue. Do not silently reuse capacity-one occurrences or promise a conflict rule that is not implemented.
- Public participant counts need not expose participant identities. Define owner/participant access and retain the current dataset and fictional-demo boundaries. Joining an event must not silently grant a coach–athlete connection or private-session history access.

## Assumptions, decisions, and dependencies

Confirmed by the user on 2026-10-14:

- Explore group training and events as a growth extension.
- Coaches create dated sessions with minimum/maximum participants; athletes discover and join.
- Follow-up confirmation: the first version supports free sessions and paid sessions with coach-collected payment at the session. Display prices before joining and defer in-app collection.

Pricing alternatives considered before the user's selection:

| Alternative                 | What the first version tests                                                                      | Tradeoff                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Free sessions only          | Discovery, registration and attendance for free introductory/community sessions                   | Simplest flow, but provides little evidence about demand for paid coaching                 |
| Free or paid at the session | Discovery and registration with a clear per-person price and coach-collected payment at the venue | Supports paid coaching without checkout; registration does not prove payment or attendance |
| In-app paid registration    | Discovery and willingness to complete payment                                                     | Adds payment confirmation, failure/retry, cancellation/refund and coach-payout contracts   |

Selected starting model: allow an explicit `Free` or a fixed per-person price labelled `Pay at the session`; defer in-app collection. The user adopted this recommendation on 2026-10-14. It allows paid-coaching discovery without adding checkout to the first version. Never label a paid activity free because registration costs nothing. Eventbrite's [offline-payment guidance](https://www.eventbrite.com/help/en-us/articles/283889/) provides an example of registration and organizer-collected payment being separate; it does not establish demand for MovX or select a provider.

Open product decisions before Ready: direct join versus coach-approved registration; deadline/minimum confirmation and cancellation rules; withdrawal cutoff; schedule-conflict behavior; price/time/location changes after joining; minimum participant identity fields and discovery filters. Confirm whether a paid session's displayed price includes all required participation costs. Currency and any future processor remain unselected; the free/pay-at-session starting model is settled.

Existing email accounts, approved coach authority and owned training locations are candidate foundations. Their reuse does not settle group permissions or imply the old event/funding schema is appropriate. Later event runtime work is a downstream consumer, not implementation owned by this ticket.

## Implementation plan

1. Record the user's confirmed free/pay-at-session choice and its reason in this ticket and the specification's separately labelled future growth constraint. Keep in-app collection deferred and preserve the current scheduling runtime scope.
2. Resolve the registration, minimum-count, deadline, cancellation, privacy and conflict decisions; define concrete happy/failure scenarios. Keep this ticket Draft until those decisions permit a complete contract.
3. Update this plan before adoption, then amend the single specification's scope, decision register, state/lifecycle model, permissions, milestones and acceptance matrix. Update README navigation/positioning consistently without duplicating requirements.
4. Create a separate flat coordination record and peer development tickets for event persistence/registration, coach management, public discovery/athlete participation and integrated validation. Review boundaries before assigning implementation; add a payment slice only if in-app collection is adopted.
5. Check links, status/ownership consistency and the changed specification against private-session compatibility; complete/archive this documentation ticket only after its adopted contract and implementation record pass validation.

## Acceptance criteria

- [ ] AC1: Pricing and every material lifecycle/permission question above have a recorded decision, rationale and observable examples; confirmed choices remain distinct from hypotheses.
- [ ] AC2: The specification consistently defines the adopted extension, including group-versus-private scheduling boundaries, participant privacy, minimum/capacity/deadline behavior and cancellation; README links/positioning agree.
- [ ] AC3: A separate coordination record maps every adopted runtime deliverable to exactly one peer development ticket with reciprocal membership, start conditions and integrated completion criteria. This ticket remains limited to contract documentation.
- [ ] AC4: Documentation formatting, relative links/anchors, identifier/status consistency and whitespace checks pass; implementation and validation evidence explain what changed and what remains.

## Validation plan

- Review AC1–AC2 using scenarios for successful joining, concurrent last-seat joins, duplicate retry, below-minimum deadline, withdrawal, cancellation, suspension, schedule conflicts and event edits. These are contract reviews here; later runtime tickets own executable proof.
- Validate AC3 against the future coordination work map and each peer's metadata without treating missing implementation as delivered.
- For AC4, run targeted Prettier, local Markdown link/anchor and DEV/COR identifier/index checks, and `git diff --check`.
- Application lint/type/build, database and browser checks are not applicable to this documentation-only scope. Subsequent runtime tickets must provide their required validation, including mobile/desktop and keyboard flows.

## Implementation record

The pricing constraint has been confirmed and recorded. Full group-lifecycle adoption and runtime implementation have not started. The ticket remains Draft because material registration/minimum-count decisions and the runtime work map remain open.

### Changes and rationale

Created a separate growth-planning ticket because the current branch has no active lightweight group-events scope. Existing hackathon funding work cannot silently override the scheduling-only specification. Recorded three pricing choices and an explicit proposed recommendation so future discussion can proceed without assuming a payment decision.

Following the user's confirmation, recorded free and pay-at-session sessions as the selected starting scope, deferred in-app collection, removed the pricing-choice question from the open decisions, and added a separately labelled future pricing constraint to the specification. This adopts one future design constraint without representing the unfinished group lifecycle as delivered or ready for implementation.

### Affected files

| File or component                                                                                     | Change and purpose                                                                                        |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| This record                                                                                           | Preserves the growth concept, confirmed pricing choice, planning history and remaining contract questions |
| [Specification](../../../docs/mvp-spec.md#confirmed-pricing-constraint-for-a-future-growth-extension) | Records the confirmed future pricing constraint separately from current scheduling behavior               |
| [Ticket index](../../README.md)                                                                       | Lists the Draft and its selected free/pay-at-session scope                                                |

### Decisions and deviations

2026-10-14, initial planning: no product-policy adoption or runtime work occurred. Displaying prices and collecting at the session was a proposal at that checkpoint.

2026-10-14, pricing confirmation: the user selected free and pay-at-session sessions as the first step. The recommendation is now a confirmed future constraint; remaining lifecycle proposals are not user decisions. Updated the plan before recording that constraint in the specification. No deviation from the documentation scope.

### Contracts, configuration, and operations

The specification now records one confirmed pricing constraint for a future group-events extension. Current scheduling behavior, group-event/payment runtime exclusions and private-session contracts remain authoritative until the complete extension contract is adopted. No schema, API, dependency, environment value, migration or deployment changed. The user subsequently authorized committing this planning checkpoint on 2026-10-14.

## Validation results

Initial planning checks passed on 2026-10-14 in the local repository before pricing confirmation. The evidence below preserves that checkpoint. Contract acceptance criteria remain open; creating or refining this Draft does not satisfy them.

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

| Criterion | Evidence                                                                                           | Result  |
| --------- | -------------------------------------------------------------------------------------------------- | ------- |
| AC1       | Pricing selected and recorded; other lifecycle/permission decisions remain open                    | Partial |
| AC2–AC3   | Complete group specification and runtime delivery tickets await remaining decisions                | Not run |
| AC4       | Draft format/link/identifier/whitespace checks pass; final adopted-contract review remains pending | Partial |

## Risks, limitations, and follow-ups

The user selected free/pay-at-session sessions. Registration cannot establish payment or actual attendance and may produce cancellations/no-shows. In-app payment is deferred and would require separate product and delivery decisions. The minimum count is an operating rule, not just a form field. No delivery date, measurement system, currency or payment provider is confirmed.

Handoff: pricing is confirmed in this Draft and the specification's future growth constraint; current application behavior is unchanged. Next action is to settle the minimum-count/registration model, then adopt a bounded group contract and create the runtime coordination/tickets. No runtime delivery tickets exist for this extension yet.

## Completion and review references

- Completed: Not completed — product decisions remain open.
- Commit: User-authorized planning checkpoint with subject `[DEV0233] Record group training and pay-at-session scope`; the full product contract and runtime remain pending.
- Review: Planning self-review only; no independent review.
- Deployment or release: None — Draft documentation only.
