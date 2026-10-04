# Ticket DEV0119: Present training requests and coach proposals

- Status: Draft
- Created: 2026-10-04
- Last updated: 2026-10-04
- Milestone: Marketplace M2 two-sided demand
- Coordination: [COR0010 — Coach-pass and group-funded marketplace MVP](../organisatory/COR0010-group-funded-coach-marketplace-mvp.md)
- Related records: depends on [DEV0118 — Persist training requests and coach proposals](../backend/DEV0118-persist-training-requests-and-coach-proposals.md); selected group proposals may seed coach event creation under DEV0120/DEV0123

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

Not started.

### Changes and rationale

Pending implementation.

### Affected files

Planned: request/proposal routes, feature components, styles, actions integration and browser tests.

### Decisions and deviations

None yet.

### Contracts, configuration, and operations

No new configuration expected; consumes DEV0118 contracts.

## Validation results

Not run — dependency incomplete.

## Risks, limitations, and follow-ups

Do not overstate proposal selection as acceptance of financial terms. Messaging and notifications remain future work.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: Planning self-review only.
- Deployment or release: None.
