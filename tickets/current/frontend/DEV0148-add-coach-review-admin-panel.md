# Ticket DEV0148: Add the coach-review admin panel

- Status: Draft
- Created: 2026-10-08
- Last updated: 2026-10-08
- Milestone: Post-separation internal operations
- Coordination: None — independent development ticket
- Related records: depends on completed [DEV0147 — Separate client onboarding and verified coach access](../../archive/backend/DEV0147-separate-client-onboarding-and-verified-coach-access.md); reuses the email identity and protected-access foundations from [DEV0046](../../archive/backend/DEV0046-email-otp-registration-and-application-profiles.md) and [DEV0040](../../archive/backend/DEV0040-protected-access-and-database-context.md)

## Objective and context

Replace DEV0147's guarded manual coach-review operation with a small internal interface for authorized MovX staff. Reviewers need a safe queue and application detail screen that can approve, request changes, reject or suspend a coach while preserving the same server-authoritative lifecycle and immutable audit trail.

This ticket is intentionally lower priority than client/coach separation. DEV0147's application/review contracts are now implemented and stable, but this record remains `Draft` until the user reprioritizes the admin panel and its staff-authorization plan is reviewed.

## Scope and non-goals

- In scope:
  - add a protected `/admin/coaches` queue with bounded filters for pending, approved, rejected and suspended applications;
  - add an application detail screen showing only review-relevant identity, coach draft, submission history and prior decisions;
  - add approve, request-changes, reject and suspend actions with expected-state conflict protection, mandatory bounded reasons and explicit confirmation for consequential actions;
  - introduce or connect a server-authoritative active platform-staff capability that cannot be self-assigned and is checked by server code and PostgreSQL for every admin read/mutation;
  - show decision success, stale/conflict, unauthorized and unavailable states without exposing private database/Auth details;
  - preserve the DEV0147 audit contract and display reviewer/time/policy information appropriate for internal operations;
  - add accessible responsive behavior and focused authorization, transition and browser validation.
- Out of scope:
  - changing the coach application lifecycle or public verified-badge meaning established by DEV0147;
  - general user management, impersonation, account deletion, booking administration, support tooling or analytics;
  - credential-document upload/viewing unless a separately reviewed privacy/storage contract is added first;
  - notification delivery, automated background checks, external verification providers or bulk decisions;
  - allowing administrators to edit a coach's public profile as the coach.

## Expected behavior and edge cases

- A signed-in account without active platform-staff capability receives no queue/application data and cannot call review mutations, even if it guesses an admin URL or identifier.
- Active staff can open the queue, filter by lifecycle state, inspect one bounded application and act only on transitions permitted by DEV0147.
- Approve/reject/request-changes/suspend forms require a bounded reason and show the target plus consequence before submission. Approval also records the verification-policy version used.
- Concurrent reviewers cannot overwrite each other: the second stale decision receives a conflict and refreshes to the authoritative decision/audit history.
- Repeated delivery of the same decision is idempotent when safe; incompatible transitions fail without partial state.
- Staff deactivation takes effect on the next request and prevents further reads/mutations. No navigation-only check grants authority.
- Internal notes, applicant email and review evidence never appear in public coach projections or ordinary client/coach responses.
- Database/Auth unavailability shows a bounded failure and never presents a decision as successful.

## Assumptions, decisions, and dependencies

- Completed DEV0147 remains the owner of lifecycle, approval semantics, badge meaning and suspension effects. This ticket calls those contracts rather than duplicating them.
- Platform staff use the existing email-backed identity system with an additional owner-assigned capability; there is no public admin registration path.
- Bootstrap/rotation of the first staff account remains an owner-controlled operational task. The panel cannot grant or expand staff privileges.
- The first panel is a narrow operational tool, not a general back office. Server-rendered list/detail routes and ordinary form actions are preferred unless implementation evidence shows a richer client state is necessary.
- Sensitive credential documents remain out of scope. If later required, create a separate ticket covering private storage, malware handling, access logging, retention and deletion.
- Priority decision, 2026-10-08: keep this ticket in `Draft` until the user reprioritizes it and DEV0147 supplies the stable backend contract.

## Implementation plan

1. Re-review DEV0147's delivered schema/functions/projections and update this ticket before implementation if the actual review contract differs from the planned dependency.
2. Add the minimum owner-managed platform-staff persistence and transaction-local authorization required for internal review reads/actions, including deactivation and exact grants.
3. Add bounded admin queue/detail repository and service projections that exclude unnecessary Auth/database fields.
4. Implement protected admin routes, filters, decision forms, confirmations, accessible status/error states and stale-decision refresh behavior.
5. Route all decisions through DEV0147's expected-state, atomic audit operations; do not introduce direct browser table mutation or a second lifecycle.
6. Add authorization/database/unit/component/browser coverage and update the internal operations documentation and ticket evidence.

## Acceptance criteria

- [ ] AC1: Only active owner-assigned platform staff can read the coach-review queue or application details; ordinary clients, applicants, approved coaches and guessed URLs fail closed.
- [ ] AC2: Authorized staff can approve, request changes, reject and suspend through explicit confirmed actions that require bounded reasons and use DEV0147's legal transition/audit contract.
- [ ] AC3: Concurrent/stale/replayed decisions cannot overwrite authoritative state or create contradictory audit events, and the interface reports a bounded conflict/unavailable outcome.
- [ ] AC4: Public and ordinary authenticated projections expose no internal notes, reviewer-only identity data or staff capability, and the panel cannot grant staff access or arbitrarily edit coach profiles.
- [ ] AC5: Queue/detail/action flows are keyboard-operable and usable at representative desktop/mobile widths, with meaningful empty, loading, unauthorized, conflict and unavailable states.
- [ ] AC6: Exact database authorization, service, unit, lint, type, build and browser checks pass and the runbook explains staff bootstrap/deactivation without recording secrets.

## Validation plan

- Add pgTAP and runtime-role tests for platform-staff bootstrap boundaries, active/deactivated access, cross-run/application reads, exact grants and decision-function invocation.
- Add concurrency tests with two reviewers acting on the same expected state, plus replay, invalid-transition, missing-reason and unavailable-database cases.
- Add projection tests proving internal notes and staff metadata never enter public or ordinary account responses.
- Add component/browser scenarios for queue filters, detail review, confirmations, each decision outcome, keyboard navigation and responsive desktop/mobile layouts.
- Run `npm test`, `npm run test:db`, `npm run db:test`, `npm run db:lint`, `npm run lint`, `npm run typecheck`, `npm run format:check`, relevant Playwright checks, production build and `git diff --check`.

## Implementation record

Pending implementation. DEV0147's guarded manual review command is the delivered interim approval path.

### Changes and rationale

Not implemented.

### Affected files

| File or component | Change and purpose                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| Pending           | Record concrete staff authorization, repository, route, component and documentation changes during implementation. |

### Decisions and deviations

- 2026-10-08: The user explicitly deprioritized the admin panel. The record remains Draft and downstream of DEV0147 rather than blocking the urgent separation work.
- 2026-10-08: DEV0147 completed with owner-only expected-state decisions and append-only audit events. This removes the backend lifecycle dependency but does not authorize or prioritize panel implementation.

### Contracts, configuration, and operations

Expected contracts are an owner-assigned staff capability plus bounded review queue/detail projections and decision calls into DEV0147. Exact schema and operational changes remain pending dependency review. No secrets or verification documents belong in this record.

## Validation results

Pending validation; no implementation checks have been run for this ticket.

| Criterion | Evidence        | Result  |
| --------- | --------------- | ------- |
| AC1–AC6   | Not implemented | Not run |

## Risks, limitations, and follow-ups

- An admin UI increases the impact of account compromise; staff authentication hardening may require a separate prerequisite before production use.
- This panel is not a substitute for a documented verification policy or reviewer training.
- Document handling, notifications and general support administration remain separate future work.

## Completion and review references

- Completed: Not completed.
- Commit: Planning record included in `[DEV0147][DEV0148][DEV0149][DEV0150][DEV0151] Publish standalone scheduling platform`; implementation has not started.
- Review: Planning review pending DEV0147's delivered contract; no implementation review or pull request exists.
- Deployment or release: Not deployed.
