# Ticket DEV0118: Persist training requests and coach proposals

- Status: Ready
- Created: 2026-10-04
- Last updated: 2026-10-04
- Milestone: Marketplace M2 two-sided demand
- Coordination: [COR0010 — Coach-pass and group-funded marketplace MVP](../organisatory/COR0010-group-funded-coach-marketplace-mvp.md)
- Related records: uses completed [DEV0046](../../archive/backend/DEV0046-email-otp-registration-and-application-profiles.md), [DEV0096](../../archive/backend/DEV0096-persist-coach-profiles-and-discovery.md) and [DEV0110](../../archive/backend/DEV0110-activate-coaching-during-account-onboarding.md); supplies browser workflows to [DEV0119](../frontend/DEV0119-present-training-requests-and-coach-proposals.md) and selected-proposal context to [DEV0120](DEV0120-persist-group-event-catalogue-and-projections.md)

## Objective and context

Persist a bounded client training request and authorized coach proposal workflow so marketplace demand exists independently of public coach supply. This is application data, not a payment or on-chain contract.

## Scope and non-goals

- In scope: additive request/proposal schema and enums; owner/coach authorization and row-level security; bounded create/read/close/withdraw/select mutations; public/private projections; expiry; deterministic seeds for fictional demo data; services/actions and focused database tests.
- Out of scope: UI, direct messages, negotiation threads, on-chain funded requests, automatic matching/ranking, notifications, reviews, event funding or payment.

## Expected behavior and edge cases

A signed-in client owns each request and can close it or select at most one valid proposal. An activated coach may propose once per request unless a reviewed replacement rule is adopted. Private proposal details are visible only to request owner and proposing coach. Expired/closed/matched requests reject new proposals. Concurrent selections produce one winner. Public projections exclude contact and private message data.

## Assumptions, decisions, and dependencies

Freeze the exact field bounds from specification section 5 before migration. Proposal selection is off-chain marketplace intent only; it never transfers USDC or authorizes an EventPool. PostgreSQL transactions and constraints, not UI state, enforce lifecycle and single selection.

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

Not started.

### Changes and rationale

Pending implementation.

### Affected files

Planned: additive Supabase migration/seed/tests, server database mappings/repository/services/actions, domain contracts and focused tests.

### Decisions and deviations

None yet.

### Contracts, configuration, and operations

Expected additive request/proposal tables and statuses; no new secret or external provider.

## Validation results

Not run — no implementation.

## Risks, limitations, and follow-ups

Free-form location/messages can leak personal information, so field bounds and public/private projections are security requirements. Matching and messaging remain deferred.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: Planning self-review only.
- Deployment or release: None.
