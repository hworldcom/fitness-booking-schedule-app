# Ticket DEV0261: Deliver athlete invitation emails

- Status: Draft
- Created: 2026-10-16
- Last updated: 2026-10-16
- Milestone: Proposed invitation and link onboarding extension
- Coordination: [COR0024 — Email invitations and shareable links](../organisatory/COR0024-email-invitations-and-shareable-links.md)
- Related records: direct contract peer [DEV0259](../organisatory/DEV0259-define-invitation-and-link-consent.md); external workspace contract [DEV0258](../organisatory/DEV0258-define-athlete-workspace.md). Other peer/dependency relationships are mapped by COR0024.

## Objective and context

Deliver explicitly requested individual invitation emails through a durable, retryable outbox after invitation creation, with honest queued/sent/failed states and a reproducible local mail path.

The current [connection contract](../../../docs/mvp-spec.md#49-connect-after-a-confirmed-session), [identity/privacy](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity) and [Messages authority](../../../docs/mvp-spec.md#16-private-messages-and-session-notes) remain authoritative until DEV0259 adopts the invitation amendment. The user confirmed explicit invitation acceptance before a first booking, no activation step and separate email/link coordination. This Draft records future implementation; it does not adopt unspecified operating details.

## Scope and non-goals

- In scope: Provider-neutral delivery boundary, controlled outbox dispatch/claim/retry/result updates, invitation email content/links, configured sender/transport, local SMTP/Mailpit setup and actual delivery/retry proof; document operations, bounded resend/deduplication and failure recovery.
- Out of scope: Invitation identity/connection authority owned by DEV0260, campaign/bulk/reminder mail, generic booking notifications, roster navigation, production recipient sends or provider-account/domain changes.

## Expected behavior and edge cases

Follow DEV0259's final adopted contract before implementation. Pending invitations are not accounts or accepted relationships, delivery status is not acceptance, and all existing booking/request/history/media/message permissions remain independently checked. Opening/reloading a link must be safe. Actual recipient/pair/coach eligibility is checked on mutation, with bounded stale/expired/revoked/conflict results and exact retry recovery.

## Assumptions, decisions, and dependencies

DEV0259 must adopt delivery semantics and DEV0260 must provide a stable outbox/revocation contract. Inspect installed transport/framework docs before integration. The current local Supabase config exposes Mailpit UI but comments out additional SMTP exposure: a visible inbox alone does not prove the application can deliver mail. This ticket owns required safe local SMTP configuration/setup.

Scope review: this is one peer boundary under a flat invitation coordination, not a parent of other DEV tickets. Keep Draft until contract/dependencies and precise interface/validation requirements permit starting. Ready is not another approval gate. Record material interface/behavior changes before implementation and inspect actual installed framework/SDK documentation when applicable.

## Implementation plan

1. Choose and record actual transport/provider configuration and worker/dispatch mechanism using installed/current official documentation. Define exact claim/retry/idempotency, missing-config behavior and local-only prerequisites before code edits.
2. Implement versioned outbox claim/delivery/result handling with no browser authority, bounded retries and honest accepted/failed states. Never mark email sent just because an invitation row exists; do not send obsolete revoked/expired attempts.
3. Create minimal email content linking to DEV0263 review; keep recipient data server-scoped and verification in Auth. Expose narrow delivery feedback to DEV0262 without leaking recipient account existence or transport secrets.
4. Enable and verify the actual loopback SMTP path, capture messages in local Mailpit and test delivery failure, uncertain acknowledgements, resend/revocation and worker retries. Document exact command/environment/operations and relevant static checks.

## Acceptance criteria

- [ ] AC1: Committed invitation intents are deliverable through a controlled outbox, with bounded claim/retry and queued/sent/failed evidence; invitation creation is never reported as sent by itself.
- [ ] AC2: Messages contain the correct invitation review link and bounded sender/recipient information; credentials/private transport errors never reach browser responses or logs.
- [ ] AC3: Missing configuration, transport failure/uncertain acknowledgement, revoked/expired attempts and resend races have explicit recovery without unbounded or misleading delivery.
- [ ] AC4: Real loopback SMTP-to-Mailpit proof, content/privacy/retry tests, documented setup/operations and relevant existing auth/mail/static checks pass; no external email send is used as local proof.

## Validation plan

Use the real configured loopback SMTP endpoint and Mailpit capture with tagged local recipients. Inspect actual email body/link and queued-to-sent transition; inject refused/delayed delivery, exact/altered retries, concurrent claims and revocation before dispatch. Do not assume exactly-once remote delivery unless the chosen provider supports it; record uncertainty/deduplication limits. Run focused tests and relevant auth/mail regressions, lint/typecheck/format:check/build. SMTP configuration changes require a preserved-data local stack rehearsal, not a reset.

## Implementation record

Runtime implementation has not started. This planning record was created under DEV0259.

### Changes and rationale

Assigned one invitation capability boundary to this peer so email/link work stays separate from the roster and calendar work streams and cannot be implemented under a COR alone.

### Affected files

Planned server-only delivery/outbox modules and controlled dispatch entry, transport configuration/dependency if needed, supabase/config.toml and local startup documentation/helpers where actually required, plus delivery tests. Record exact settings and migration/rollback/operational steps before implementation; no secrets.

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
