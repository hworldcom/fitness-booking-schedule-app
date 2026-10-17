# Ticket DEV0260: Persist coach invitations and links

- Status: Draft
- Created: 2026-10-16
- Last updated: 2026-10-16
- Milestone: Proposed invitation and link onboarding extension
- Coordination: [COR0024 — Email invitations and shareable links](../organisatory/COR0024-email-invitations-and-shareable-links.md)
- Related records: direct contract peer [DEV0259](../organisatory/DEV0259-define-invitation-and-link-consent.md); external workspace contract [DEV0258](../organisatory/DEV0258-define-athlete-workspace.md). Other peer/dependency relationships are mapped by COR0024.

## Objective and context

Implement narrow coach invitation and link authority after DEV0259 adopts the contract, preserving the existing coach–athlete pair and adding only the explicit invitation-based pre-booking connection path.

The current [connection contract](../../../docs/mvp-spec.md#49-connect-after-a-confirmed-session), [identity/privacy](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity) and [Messages authority](../../../docs/mvp-spec.md#16-private-messages-and-session-notes) remain authoritative until DEV0259 adopts the invitation amendment. The user confirmed explicit invitation acceptance before a first booking, no activation step and separate email/link coordination. This Draft records future implementation; it does not adopt unspecified operating details.

## Scope and non-goals

- In scope: Invitation/recipient/token/link records and constraints; create/revoke/rotate/claim/accept/decline/resend lifecycle; verified recipient and coach/pair authority; exact retry/stale revision; durable email outbox creation contract; bounded sender/recipient projections and existing connection/message/media integration.
- Out of scope: Email transport/worker/provider, coach/recipient web components, Athletes roster/archive/navigation, calendar/group lifecycle, bulk imports or Auth account creation.

## Expected behavior and edge cases

Follow DEV0259's final adopted contract before implementation. Pending invitations are not accounts or accepted relationships, delivery status is not acceptance, and all existing booking/request/history/media/message permissions remain independently checked. Opening/reloading a link must be safe. Actual recipient/pair/coach eligibility is checked on mutation, with bounded stale/expired/revoked/conflict results and exact retry recovery.

Confirmed on 16 October 2026: an individual invitation to `a@gmail.com` can be claimed only with verified control of that address. Another signed-in email, including an Apple private-relay address, cannot remap the recipient or claim the invitation on the strength of its token. Enforce this at the server/database boundary under the adopted Auth proof contract, not just in the form. Preserve the separate reusable-link flow and existing account/pair identity.

Ordinary registration remains open to any supported email. A person following that invitation can create a normal account as `b@gmail.com`; account creation succeeds independently and does not accept/consume/remap the invitation or establish its coach connection. Validate this separation alongside wrong-recipient claim denial.

## Assumptions, decisions, and dependencies

DEV0259 must adopt identity/consent/lifecycle and bounds first. Stabilize the versioned sender/recipient/outbox result contract with DEV0261–DEV0263. Existing connection, message and block authority is the foundation; inspect current migrations and preserve independent work.

Scope review: this is one peer boundary under a flat invitation coordination, not a parent of other DEV tickets. Keep Draft until contract/dependencies and precise interface/validation requirements permit starting. Ready is not another approval gate. Record material interface/behavior changes before implementation and inspect actual installed framework/SDK documentation when applicable.

## Implementation plan

1. Inventory installed ORM/database guidance and existing pair locks, connection attempts, no-booking message/media reads and Auth verification. Record exact proof/operation/expiry/revision and outbox contracts before migrations.
2. Add forward-compatible narrow invitation/link records and actor-checked operations. Bind targeted claims to verified recipients; public offers require explicit signed-in acceptance. Creation, GET/prefetch and sign-in never accept.
3. Integrate invitation acceptance with existing pair uniqueness and origin evidence without removing ordinary post-booking checks. Serialize crossed/duplicate acceptance, existing connection requests, removal/block/coach changes; exact retries recover their committed state and never revive a removed connection.
4. Prove preserved-data upgrades, raw/foreign/self/wrong-recipient denial, token revocation/expiry, concurrency and no-booking message/media boundaries in isolated PostgreSQL; record migrations/rollback and run relevant regression/static checks.

## Acceptance criteria

- [ ] AC1: Only authorized senders/verified recipients perform the adopted lifecycle; targeted claims require verified control of the exact invited address, including wrong-email/Apple-relay rejection. Token possession or an invite alone grants no private data, booking or connection.
- [ ] AC2: Explicit accepted invitations establish one existing pair before a booking, without activation; ordinary request guards/history, duplicate recovery, block/removal and exact recipient authority remain intact.
- [ ] AC3: Invitation/outbox creation is atomic, resend/rotation/expiry/revision results are bounded and exact/altered retries cannot duplicate connections or email intents.
- [ ] AC4: Fresh/preserved migration, actor/recipient/token/privacy, no-booking message/media and concurrent invitation/connection/block tests plus relevant regressions/static checks pass.

## Validation plan

Use isolated PostgreSQL with multiple connections for invite/accept/revoke/resend/rotate/block/remove and ordinary-request races. Verify first-booking-free acceptance and direct-message/private-avatar scope without inventing shared history. Test exact/altered retry, expired/wrong recipient, reused accounts, raw-role denial, preserved records and outbox atomicity. Run relevant existing connection/mail/auth suites, npm test, lint, typecheck, format:check and build; use documented disposable database targets, never reset shared data.

## Implementation record

Runtime implementation has not started. This planning record was created under DEV0259.

### Changes and rationale

Assigned one invitation capability boundary to this peer so email/link work stays separate from the roster and calendar work streams and cannot be implemented under a COR alone.

### Affected files

Planned capability-owned domain/server/db invitation modules, additive supabase/migrations/, narrow connection/message/media integrations and meaningful database/server tests. No concrete runtime API/schema is adopted by this planning record.

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
