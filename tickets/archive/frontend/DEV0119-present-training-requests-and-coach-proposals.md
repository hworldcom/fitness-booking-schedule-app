# Ticket DEV0119: Present training requests and coach proposals

- Status: Cancelled
- Created: 2026-10-04
- Last updated: 2026-10-05
- Milestone: Marketplace M2 two-sided demand
- Coordination: [COR0010 — Coach-pass and group-funded marketplace MVP](../../current/organisatory/COR0010-group-funded-coach-marketplace-mvp.md)
- Related records: cancelled with [DEV0118 — Persist training requests and coach proposals](../backend/DEV0118-persist-training-requests-and-coach-proposals.md); completed [DEV0120](../backend/DEV0120-persist-group-event-catalogue-and-projections.md) retains an unused nullable proposal-origin compatibility field; cancellation is owned by [DEV0135](../organisatory/DEV0135-narrow-marketplace-mvp-to-two-loops.md)

## Objective and context

Expose the two directions of marketplace discovery: clients publish what they want and eligible coaches respond with comparable proposals, without implying that selection is payment.

## Scope and non-goals

- In scope: client request creation/list/detail/close/selection views; coach open-request discovery and proposal create/withdraw views; status/privacy/error/empty states; accessible responsive forms and keyboard behavior; clear handoff to group-event creation when applicable.
- Out of scope: persistence, messaging/chat, automated matching, payment, event funding, notifications or reputation.

## Expected behavior and edge cases

Guests see only public projections. Owners see all owned requests and received proposals. Coaches see requests eligible for response and their own proposal details. Selected/closed/expired state disables invalid actions without hiding durable history. UI copy distinguishes “Select proposal” from payment or confirmed event creation.

## Assumptions, decisions, and dependencies

Use DEV0118 server-derived authority and validation; do not recreate access decisions in the browser. Preserve list-first accessible navigation and existing application identity patterns.

## Implementation plan

1. Consume stable request/proposal actions and projections.
2. Add request owner, coach response and comparison/selection surfaces.
3. Cover loading, unavailable, expired, forbidden and concurrent-update states.
4. Verify desktop/mobile/keyboard behavior and update durable evidence.

## Acceptance criteria

- [ ] AC1: A client can create, inspect, close and select within owned requests through an accessible responsive workflow.
- [ ] AC2: An eligible coach can discover open requests and create/withdraw one proposal without seeing unrelated private proposals.
- [ ] AC3: Selection/expiry/concurrency and unavailable states remain honest and never imply payment or event confirmation.
- [ ] AC4: Focused component/browser, authorization-boundary, lint, typecheck and build checks pass at mobile and desktop widths.

## Validation plan

Run focused component tests, server-boundary tests, Playwright owner/coach/unrelated/guest flows, keyboard and mobile checks, lint, typecheck, formatting and both production builds.

## Implementation record

Cancelled before implementation.

### Changes and rationale

On 2026-10-05 the user limited the hackathon MVP to pass-backed private bookings and coach-created threshold-funded group events. This proposed request/proposal interface was cancelled before any route, component, action integration or browser test was added.

### Affected files

No runtime files changed under this ticket. DEV0135 removes this workflow from the current product story and archives this record.

### Decisions and deviations

- 2026-10-05: Cancelled before implementation together with its backend dependency DEV0118. Public storytelling remains limited to the two retained loops.

### Contracts, configuration, and operations

No interface, route, configuration or operational contract was delivered. DEV0118 supplied no server contract because it was also cancelled before implementation.

## Validation results

No browser or runtime validation was run because implementation never started. DEV0135 validates that current public-story and hosted-rehearsal tickets no longer depend on this workflow.

## Risks, limitations, and follow-ups

Historical records may continue to describe this earlier plan. Any future request/proposal interface requires a new reviewed ticket and backend authority contract; this cancelled ticket must not be reopened.

## Completion and review references

- Completed: Cancelled on 2026-10-05 before implementation; no acceptance criterion is claimed as delivered.
- Commit: Cancellation is recorded by DEV0135; that consolidation is not yet committed, and no DEV0119 implementation commit exists.
- Review: Scope cancellation reviewed through DEV0135; no independent review.
- Deployment or release: Not applicable — no runtime change existed.
