# Ticket DEV0118: Persist training requests and coach proposals

- Status: Cancelled
- Created: 2026-10-04
- Last updated: 2026-10-05
- Milestone: Marketplace M2 two-sided demand
- Coordination: [COR0010 — Coach-pass and group-funded marketplace MVP](../../archive/organisatory/COR0010-group-funded-coach-marketplace-mvp.md)
- Related records: uses completed [DEV0046](DEV0046-email-otp-registration-and-application-profiles.md), [DEV0096](DEV0096-persist-coach-profiles-and-discovery.md) and [DEV0110](DEV0110-activate-coaching-during-account-onboarding.md); cancelled peer [DEV0119](../frontend/DEV0119-present-training-requests-and-coach-proposals.md); completed [DEV0120](DEV0120-persist-group-event-catalogue-and-projections.md) retains an unused nullable proposal-origin compatibility field; cancellation is owned by [DEV0135](../organisatory/DEV0135-narrow-marketplace-mvp-to-two-loops.md)

## Objective and context

Persist a bounded client training request and authorized coach proposal workflow so marketplace demand exists independently of public coach supply. This is application data, not a payment or on-chain contract.

## Scope and non-goals

- In scope: additive request/proposal schema and enums; owner/coach authorization and row-level security; bounded create/read/close/withdraw/select mutations; public/private projections; expiry; deterministic seeds for fictional demo data; services/actions and focused database tests.
- Out of scope: UI, direct messages, negotiation threads, on-chain funded requests, automatic matching/ranking, notifications, reviews, event funding or payment.

## Expected behavior and edge cases

A signed-in client owns each request and can close it or select at most one valid proposal. An activated coach may propose once per request unless a reviewed replacement rule is adopted. Private proposal details are visible only to request owner and proposing coach. Expired/closed/matched requests reject new proposals. Concurrent selections produce one winner. Public projections exclude contact and private message data.

## Assumptions, decisions, and dependencies

Freeze the exact field bounds from specification section 5 before migration. Proposal selection is off-chain marketplace intent only; it never transfers EURC or authorizes an EventPool. PostgreSQL transactions and constraints, not UI state, enforce lifecycle and single selection.

## Implementation plan

1. Freeze schema, statuses, bounds, visibility and ownership rules.
2. Add additive migration, RLS/policies, mappings and deterministic seed fixtures.
3. Implement protected mutations and public/owner/coach projections.
4. Add concurrency, privacy, authorization and expiry tests.
5. Document contracts and validation evidence.

## Acceptance criteria

- [ ] AC1: A client creates, reads and closes only owned bounded requests; public reads expose only reviewed fields.
- [ ] AC2: An eligible activated coach creates/withdraws only owned proposals for an open request, while unrelated actors cannot read private content.
- [ ] AC3: Exactly one eligible proposal can be selected and concurrent/expired/closed attempts cannot corrupt lifecycle state.
- [ ] AC4: Clean/repeat and representative-upgrade migrations, RLS, database integration, unit/static and build checks pass.

## Validation plan

Run migration reset/repeat/upgrade validation, pgTAP/RLS checks, two-client/two-coach database tests including selection races, service tests, lint, typecheck, formatting and production builds. Browser behavior belongs to DEV0119.

## Implementation record

Cancelled before implementation.

### Changes and rationale

On 2026-10-05 the user limited the hackathon MVP to pass-backed private bookings and coach-created threshold-funded group events. This proposed third workflow was therefore cancelled before any migration, schema, service, seed or test was added. The planning record is retained so the scope decision and original boundary remain reviewable.

### Affected files

No runtime files changed under this ticket. DEV0135 updates the current specification, coordination map and ticket index and archives this record.

### Decisions and deviations

- 2026-10-05: Cancelled before implementation because the focused MVP now contains exactly two product loops. Training requests/proposals may be reconsidered only through a new future product decision and ticket.

### Contracts, configuration, and operations

No contract, schema, migration, configuration, dependency, secret or operational change was delivered. The proposed request/proposal tables and statuses do not exist.

## Validation results

No runtime validation was run because implementation never started. DEV0135 validates removal of this workflow from the current specification, work map and open-ticket index.

## Risks, limitations, and follow-ups

Historical records may continue to describe the proposal as earlier planning. The current contract controls. Any future request/proposal feature requires a new reviewed ticket with privacy and authorization requirements; this cancelled ticket must not be reopened.

## Completion and review references

- Completed: Cancelled on 2026-10-05 before implementation; no acceptance criterion is claimed as delivered.
- Commit: Cancellation is recorded by DEV0135; that consolidation is not yet committed, and no DEV0118 implementation commit exists.
- Review: Scope cancellation reviewed through DEV0135; no independent review.
- Deployment or release: Not applicable — no runtime change existed.
