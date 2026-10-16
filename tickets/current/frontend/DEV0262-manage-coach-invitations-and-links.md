# Ticket DEV0262: Manage coach invitations and links

- Status: Draft
- Created: 2026-10-16
- Last updated: 2026-10-16
- Milestone: Proposed invitation and link onboarding extension
- Coordination: [COR0024 — Email invitations and shareable links](../organisatory/COR0024-email-invitations-and-shareable-links.md)
- Related records: direct contract peer [DEV0259](../organisatory/DEV0259-define-invitation-and-link-consent.md); external workspace contract [DEV0258](../organisatory/DEV0258-define-athlete-workspace.md). Other peer/dependency relationships are mapped by COR0024.

## Objective and context

Give authorized coaches a reusable invitation-management interface for individual email invitations and shareable links, hosted by the separately owned Athletes workspace.

The current [connection contract](../../../docs/mvp-spec.md#49-connect-after-a-confirmed-session), [identity/privacy](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity) and [Messages authority](../../../docs/mvp-spec.md#16-private-messages-and-session-notes) remain authoritative until DEV0259 adopts the invitation amendment. The user confirmed explicit invitation acceptance before a first booking, no activation step and separate email/link coordination. This Draft records future implementation; it does not adopt unspecified operating details.

## Scope and non-goals

- In scope: Invite form/review/result, pending invitation rows, delivery-state feedback, resend/revoke, share/copy and link rotation controls, narrow sender actions, empty/unavailable/stale/draft recovery and integration with the external workspace host.
- Out of scope: Athletes page/navigation/search/archive implementation, email transport/outbox worker, connection acceptance authority, recipient review/Auth flow, imported contacts, campaigns or account creation.

## Expected behavior and edge cases

Follow DEV0259's final adopted contract before implementation. Pending invitations are not accounts or accepted relationships, delivery status is not acceptance, and all existing booking/request/history/media/message permissions remain independently checked. Opening/reloading a link must be safe. Actual recipient/pair/coach eligibility is checked on mutation, with bounded stale/expired/revoked/conflict results and exact retry recovery.

## Assumptions, decisions, and dependencies

DEV0259 adoption, stable DEV0260 sender APIs and DEV0261 delivery semantics are prerequisites. DEV0258 is the external Athletes contract owner; its actual workspace runtime owner has not been created yet. Agree its host/embedding/Pending projection contract before interface integration. This peer never implements the entire roster as a substitute.

Scope review: this is one peer boundary under a flat invitation coordination, not a parent of other DEV tickets. Keep Draft until contract/dependencies and precise interface/validation requirements permit starting. Ready is not another approval gate. Record material interface/behavior changes before implementation and inspect actual installed framework/SDK documentation when applicable.

## Implementation plan

1. Inspect installed Next.js forms/actions/navigation guidance and define the reusable host/action/results contract with the external Athletes owner; record exact revision/operation/delivery labels before UI edits.
2. Build explicit individual invitation review/send, status rows and retry/resend/revoke controls using real server results. Show invitation state separately from queued/sent/failed delivery, preserving authorized drafts on errors.
3. Add copy/share and explicit link rotate/revoke controls with truthful clipboard/link-expiry feedback. Keep private recipient information and raw tokens out of unrelated views; never send on field entry, copy or page load.
4. Integrate the actual Athletes host and verify real local pending/delivery feedback plus desktop/mobile/keyboard, long addresses, inactive permissions, lost response and stale operation recovery.

## Acceptance criteria

- [ ] AC1: The owning coach can create/review individual invitations and manage active share links through explicit authorized actions; no invite is sent by opening/copying a form.
- [ ] AC2: Pending rows distinguish delivery from relationship state and recover resend/revoke/rotation failures without false success or duplicate submission.
- [ ] AC3: The actual external Athletes host consumes the bounded component/projection without duplicate roster ownership or broader private data access.
- [ ] AC4: Real local server/mail flows, desktop/375/430 px, keyboard/clipboard/error/draft checks and relevant component/static/build regressions pass.

## Validation plan

Test the reusable component with meaningful server outcomes, then rehearse with an approved local coach, DEV0261 Mailpit delivery and the real Athletes host. Cover queued/failed/sent/revoked/expired, wrong actor, exact retry, stale result, clipboard fallback, long labels and mobile/keyboard/focus. Run focused existing connection/coach interface checks plus lint/typecheck/format:check/build. Missing host integration remains an unmet criterion; static mocks do not complete this peer.

## Implementation record

Runtime implementation has not started. This planning record was created under DEV0259.

### Changes and rationale

Assigned one invitation capability boundary to this peer so email/link work stays separate from the roster and calendar work streams and cannot be implemented under a COR alone.

### Affected files

Planned capability-owned coach invitation components/actions/styles and integration with the externally owned Athletes host; meaningful component/browser tests. Exact routes/paths depend on the adopted host contract.

### Decisions and deviations

2026-10-16: Created after the user requested a separate COR for email invitations/shareable links. Final operating details and adoption remain DEV0259 prerequisites; no runtime deviation or implementation evidence yet.

### Contracts, configuration, and operations

None changed by creating this record. Planned runtime interfaces/data/dependencies/settings/migrations/setup/rollback must be recorded during implementation; no secrets or private recipient/token values belong in tickets. No emails, account changes or deployment were performed.

## Validation results

Planning-record validation is recorded by DEV0259. Runtime, migration, mail, browser/static/build checks have not run because implementation has not started.

| Criterion | Evidence                                                | Result  |
| --------- | ------------------------------------------------------- | ------- |
| AC1–AC4   | Runtime implementation and required validation pending. | Not run |

## Risks, limitations, and follow-ups

The invitation contract and external Athletes host are not delivered. Never infer accepted consent from a successful email or generic account sign-in. Keep current post-booking, block/history and recipient privacy regressions explicit. On handoff, inspect the latest records/interfaces/migration versions and satisfy the stated dependencies before marking In progress.

## Completion and review references

- Completed: Not completed.
- Commit: Not created; no commit requested.
- Review: Planning self-review; no independent/runtime review.
- Deployment or release: None.
