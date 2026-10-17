# Ticket DEV0263: Review and accept athlete invitations

- Status: Draft
- Created: 2026-10-16
- Last updated: 2026-10-17
- Milestone: Proposed invitation and link onboarding extension
- Coordination: [COR0024 — Email invitations and shareable links](../organisatory/COR0024-email-invitations-and-shareable-links.md)
- Related records: direct contract peer [DEV0259](../organisatory/DEV0259-define-invitation-and-link-consent.md); external workspace contract [DEV0258](../organisatory/DEV0258-define-athlete-workspace.md). Other peer/dependency relationships are mapped by COR0024.

## Objective and context

Let a recipient safely review a coach offer, verify/sign in through ordinary MovX Auth and explicitly accept or decline, including before a first booking and without coach activation.

The current [connection contract](../../../docs/mvp-spec.md#49-connect-after-a-confirmed-session), [identity/privacy](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity) and [Messages authority](../../../docs/mvp-spec.md#16-private-messages-and-session-notes) remain authoritative until DEV0259 adopts the invitation amendment. The user confirmed explicit invitation acceptance before a first booking, no activation step and separate email/link coordination. This Draft records future implementation; it does not adopt unspecified operating details.

## Scope and non-goals

- In scope: Public/recipient invite review, minimal coach/offer presentation, verification/sign-in return, explicit acceptance/decline, wrong-account/expired/revoked/retry states and navigation to the existing accepted My coaches/conversation boundary.
- Out of scope: Auth bypass or coach-created identities, invitation sender/SMTP worker, Athletes roster, booking creation, activation queues, public account lookup or expanded athlete profiles.

## Expected behavior and edge cases

Follow DEV0259's final adopted contract before implementation. Pending invitations are not accounts or accepted relationships, delivery status is not acceptance, and all existing booking/request/history/media/message permissions remain independently checked. Opening/reloading a link must be safe. Actual recipient/pair/coach eligibility is checked on mutation, with bounded stale/expired/revoked/conflict results and exact retry recovery.

Confirmed on 16 October 2026: an individual invitation to `a@gmail.com` requires verified control of that address. A session using another email, including an Apple private-relay address, must receive a safe wrong-account/verification recovery state rather than a remapped invitation or accepted relationship. Reuse the separately adopted Auth account-switch/verification flow; the invitation page cannot invent an identity-linking bypass. Signing in as the eligible recipient still returns to explicit review/acceptance.

Ordinary sign-up remains available with any supported email from the invitation flow. Registering as `b@gmail.com` succeeds as a normal account, while the invitation to `a@gmail.com` grants no coach connection and remains unclaimed. Explain the lack of an invitation-derived connection without blocking ordinary onboarding or forcing an account switch. Recipient matching is required only to claim this targeted invitation; a matching registration still needs explicit acceptance.

## Assumptions, decisions, and dependencies

DEV0259 must adopt exact recipient/consent and eligibility; DEV0260 provides validated target/reusable link review and acceptance APIs. External [COR0027](../organisatory/COR0027-login-registration-and-social-authentication.md) owns the selected email/password, Google and Apple target; consume its adopted verified-identity and safe-return contract when delivered. A password login or provider callback alone never bypasses verified exact-recipient eligibility, and a different Apple relay/email still permits only ordinary unrelated registration. Reuse existing Auth return/account identity, My coaches, connection privacy and Messages. DEV0261 supplies actual local review emails for final integration.

Scope review: this is one peer boundary under a flat invitation coordination, not a parent of other DEV tickets. Keep Draft until contract/dependencies and precise interface/validation requirements permit starting. Ready is not another approval gate. Record material interface/behavior changes before implementation and inspect actual installed framework/SDK documentation when applicable.

## Implementation plan

1. Inspect installed Next.js/Auth docs and existing sign-in return protections; specify sanitized same-origin invitation return and state/result contract before routes/actions.
2. Build read-only preview and normal verified Auth continuation. GET/prefetch, opening an email, registration and sign-in never create an accepted connection. Targeted invitations require the verified target; reusable offers need current coach/link eligibility.
3. Show what connection acceptance permits and provide explicit Accept/Decline with exact retry recovery. Reuse existing pair identity and truthful accepted/removed/block/error outcomes; never display Waiting Activation after success.
4. Verify new/existing accounts and no-booking My coaches/history/message/identity flows, wrong email, self/foreign/expired/revoked links, back/reload and desktop/mobile/keyboard recovery with real local accounts.

## Acceptance criteria

- [ ] AC1: Anonymous preview and ordinary Auth continuation expose only authorized offer details, allow normal registration with any supported email, reuse existing accounts and never auto-accept or create a booking; different-email registration creates no invitation-derived connection and does not consume/remap the invitation.
- [ ] AC2: A verified explicit recipient acceptance connects before a booking with no activation step; decline, duplicate/stale/removed-pair retries and block/coach changes show the actual committed result.
- [ ] AC3: Wrong-account/invalid/revoked/expired/self links reveal no private recipient/account/history data and cannot be used as identity credentials; another verified email or Apple relay cannot claim a targeted invitation without verified control of the exact invited address.
- [ ] AC4: Real two-account Auth/acceptance/My coaches/message/identity and mobile/desktop/keyboard/error/return checks plus relevant regressions/static/build pass.

## Validation plan

Use tagged new/existing Auth recipients and a local approved coach. Open actual Mailpit links and reusable links, verify prefetch/GET/sign-in have no consent mutation, then inspect exact pair identity after explicit acceptance with zero bookings. Rehearse wrong-email, block/revocation/expiry, exact retry after removal, browser back/reload and 375/430 px/desktop/keyboard states; assert private payload absence. Run meaningful Auth/connection/message and route/component tests, lint/typecheck/format:check/build.

## Implementation record

Runtime implementation has not started. This planning record was created under DEV0259.

### Changes and rationale

Assigned one invitation capability boundary to this peer so email/link work stays separate from the roster and calendar work streams and cannot be implemented under a COR alone.

### Affected files

Planned invitation review/return routes and actions, capability-owned recipient UI, existing My coaches/connection/Messages integration where necessary and focused tests. No independent profile or messaging permission store.

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
