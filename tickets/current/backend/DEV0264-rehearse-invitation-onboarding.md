# Ticket DEV0264: Rehearse invitation onboarding

- Status: Draft
- Created: 2026-10-16
- Last updated: 2026-10-16
- Milestone: Proposed invitation and link onboarding extension
- Coordination: [COR0024 — Email invitations and shareable links](../organisatory/COR0024-email-invitations-and-shareable-links.md)
- Related records: direct contract peer [DEV0259](../organisatory/DEV0259-define-invitation-and-link-consent.md); external workspace contract [DEV0258](../organisatory/DEV0258-define-athlete-workspace.md). Other peer/dependency relationships are mapped by COR0024.

## Objective and context

Prove separate email/link onboarding through the real local coach/athlete application, actual loopback mail delivery, existing/new identities and no-booking connection/privacy recovery.

The current [connection contract](../../../docs/mvp-spec.md#49-connect-after-a-confirmed-session), [identity/privacy](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity) and [Messages authority](../../../docs/mvp-spec.md#16-private-messages-and-session-notes) remain authoritative until DEV0259 adopts the invitation amendment. The user confirmed explicit invitation acceptance before a first booking, no activation step and separate email/link coordination. This Draft records future implementation; it does not adopt unspecified operating details.

## Scope and non-goals

- In scope: Tagged local fixtures and cleanup, a reproducible rehearsal command, actual email/share-link sender/recipient flows, no-booking consent/message/media/pair assertions, revoked/expired/duplicate/race/error behavior and responsive/keyboard evidence.
- Out of scope: Implementing missing peer features or the external Athletes host, production email/provider/domain operations, shared database resets, bulk real invitations, calendar/session types or hosted deployment.

## Expected behavior and edge cases

Follow DEV0259's final adopted contract before implementation. Pending invitations are not accounts or accepted relationships, delivery status is not acceptance, and all existing booking/request/history/media/message permissions remain independently checked. Opening/reloading a link must be safe. Actual recipient/pair/coach eligibility is checked on mutation, with bounded stale/expired/revoked/conflict results and exact retry recovery.

## Assumptions, decisions, and dependencies

DEV0260–DEV0263 must complete their own checks and the external Athletes runtime host required by DEV0262 must exist. DEV0258 owns that separate workspace contract; its runtime owner is not created yet. Actual loopback SMTP/Mailpit configuration from DEV0261 is required; fake delivery callbacks cannot satisfy this proof.

Scope review: this is one peer boundary under a flat invitation coordination, not a parent of other DEV tickets. Keep Draft until contract/dependencies and precise interface/validation requirements permit starting. Ready is not another approval gate. Record material interface/behavior changes before implementation and inspect actual installed framework/SDK documentation when applicable.

## Implementation plan

1. Map adopted invitation/link scenarios and external host prerequisites to exact evidence; define unique tagged local identities/records, an explicit loopback target and non-destructive cleanup.
2. Run individual email creation/delivery/review and reusable link review/acceptance using new and existing accounts without any booking; validate one pair, no activation, existing My coaches/general-message/private-media scope and no unrelated history.
3. Exercise duplicate/crossed invitation/request acceptance, resend/revoke/rotation/expiry, wrong recipient, removal/block and transport/uncertain response recovery; link real database race evidence from its owner.
4. Review coach/recipient mobile/desktop/keyboard states and actual external Athletes Pending integration, document the real command and verify exact cleanup. Keep missing host/runtime evidence open rather than implementing it here.

## Acceptance criteria

- [ ] AC1: A documented loopback-only command prepares its own fixtures, exercises real app/mail flows and cleans only its exact records/accounts.
- [ ] AC2: Email and reusable-link onboarding connect new/existing verified recipients before any booking only after explicit acceptance, without activation or duplicate pair/account creation.
- [ ] AC3: Recipient/token/actor/history/media/message privacy, ordinary post-booking guards and revoked/expired/block/remove/resend/retry/race behavior pass with actual database/mail evidence.
- [ ] AC4: External Athletes integration, desktop/375/430 px, keyboard, unavailable/error recovery, relevant regression/static/build results and cleanup are recorded; no mock/production send substitutes for local proof.

## Validation plan

Use the real Auth-enabled loopback application and DEV0261 SMTP/Mailpit path, tagged coach/recipient accounts and the actual Athletes host. Assert zero prior bookings, one accepted pair, no fake identity, proper message/media history scope and exact failure/retry results. Reuse owner migration/race proof and run appropriate auth/connection/message plus focused invitation suites, lint/typecheck/format:check/build. Inspect final rendered states at desktop and 375/430 px with keyboard; record failed/blocked/not-run checks honestly.

## Implementation record

Runtime implementation has not started. This planning record was created under DEV0259.

### Changes and rationale

Assigned one invitation capability boundary to this peer so email/link work stays separate from the roster and calendar work streams and cannot be implemented under a COR alone.

### Affected files

Planned scripts/rehearse-local invitation command, tagged fixture/cleanup helpers, appropriate tests and README command/prerequisite navigation. Screenshots/logs stay ignored unless separately authorized for durable inclusion.

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
