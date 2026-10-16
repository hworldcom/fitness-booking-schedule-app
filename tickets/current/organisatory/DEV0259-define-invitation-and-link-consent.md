# Ticket DEV0259: Define invitation and link consent

- Status: Draft
- Created: 2026-10-16
- Last updated: 2026-10-16
- Milestone: Proposed invitation and link onboarding extension
- Coordination: [COR0024 — Email invitations and shareable links](COR0024-email-invitations-and-shareable-links.md)
- Related records: external workspace contract [DEV0258](DEV0258-define-athlete-workspace.md); delivered connections [COR0020](../../archive/organisatory/COR0020-athlete-terminology-and-connections.md); existing message consent [DEV0243](../../archive/organisatory/DEV0243-define-ongoing-messages-and-session-note-boundaries.md); independent calendar [COR0023](COR0023-coach-calendar-and-availability.md).

## Objective and context

Define email invitations and shareable coach invite links as their own delivery stream, separate from the Athletes workspace. The user explicitly requested the separate COR on 16 October 2026, after choosing invitation-based connection before a booking and immediate connection on athlete acceptance without a coach-activation stage.

The existing [connection contract](../../../docs/mvp-spec.md#49-connect-after-a-confirmed-session) requires a confirmed/completed booking for ordinary connection requests. This Draft owns a proposed narrow invitation exception and its delivery map, not a silent removal of the current rule. A coach invitation is an offer; only verified, explicit athlete acceptance establishes the connection. Neither sending an email nor opening a link creates an account, booking or accepted relationship.

## Scope and non-goals

- In scope: adopt an invitation/link contract when ready, including identity/consent, targeted versus reusable links, lifecycle/expiry/revocation/resend, duplicate/race recovery, message/media consequences, email delivery state and privacy; create/maintain COR0024 and its peer planning records; update specification and navigation references in the eventual adoption change.
- Out of scope: runtime code, migrations, actual emails, roster/archive/navigation implementation, calendar/session types, seat limits, manual activation, bulk imports/campaigns, auto-created Auth accounts, payments, deployment or commits.

## Expected behavior and edge cases

Confirmed target choices: a coach can invite someone who has no prior MovX booking; authenticated explicit acceptance connects immediately; email invitations and shareable links belong to this separate coordination. The intended host is the separately planned Coach workspace Athletes tab. There is no Waiting Activation stage.

Proposed operating defaults to settle before adoption:

- Individual email invitations carry a recipient-bound, revocable, expiring link. Only an Auth-verified matching recipient may accept; existing accounts are reused. Opening the URL or completing sign-in is not acceptance. Anonymous/wrong-account responses do not expose private email/profile or account-existence information.
- A reusable coach link presents an explicit connection offer to signed-in athletes. Visitors can register through ordinary Auth; the link never grants coach capability. Public preview/intake respects coach visibility/approval. Direct offers and hidden-coach eligibility must be reconciled with existing private connection rules. No invite accepts through a block/suspension or after revocation/expiry.
- Acceptance preserves the existing exact coach–athlete pair and current recipient authority, serializes with ordinary requests/removal/block, recovers exact retries and does not rewrite old attempts. Already connected pairs recover their current relationship. A removed pair needs a fresh explicit acceptance; replaying an earlier success does not reconnect automatically.
- Acceptance can enable existing connection-scoped identity/media and general messaging without a booking, with that consequence disclosed on review. No booking, session notes, group registration, unrelated history or private data is granted by an unaccepted invitation. Post-booking connections remain available through their ordinary qualifying path.
- Invitation state and delivery state remain separate. Persist creation/outbox atomically; report queued/sent/failed honestly. Resend/rotation have bounded rate/retry and revision rules; define exact defaults before implementation. Revoked/expired tokens never establish identity. No general notification promise or unsolicited reminders are included.

## Assumptions, decisions, and dependencies

Confirmed on 16 October 2026: invitation acceptance may connect before a first booking; no coach activation follows acceptance; email invitations/shareable links must have a separate COR. The user's Athletes-tab placement is an external workspace decision, recorded in DEV0258.

Still to specify for adoption: token expiry/reuse/rotation and exact send bounds; email and share-link visibility/eligibility; connection-attempt reconciliation; return/retry/decline/revocation behavior; the recipient's explicit consent wording; invitation delivery operation/transport setup and affected message/media reads without a booking. These are contract/implementation details to resolve in this ticket, not reasons to invent an activation stage or remove current consent.

This DEV owns documentation and delivery planning only. COR0024's peers own invitation authority, delivery, coach controls, recipient acceptance and integrated proof. DEV0258 owns only the workspace contract; its eventual roster/navigation runtime owners are external consumers, not direct members. No nested COR or child DEV hierarchy is created.

## Implementation plan

1. Preserve the user's separation instruction and confirmed acceptance choices; create the independent COR and five small runtime peers with explicit external workspace dependencies before any implementation.
2. Finalize the operating defaults and affected contracts. Mark In progress before adopting specification changes to connection eligibility/navigation references, account/consent/message/media privacy, delivery bounds, milestone and testable acceptance scenarios. Do not rewrite completed historical tickets.
3. Reconcile peer interfaces, sender/recipient authority, delivery/outbox boundaries and external Athletes host ownership. Assign every implementation part exactly once; update peer plans before material changes.
4. Validate documentation links/anchors, IDs/index/statuses, reciprocal membership and boundaries plus consent/retry/block/no-booking examples. Complete/archive only after adoption and its required documentation checks pass.

## Acceptance criteria

- [ ] AC1: Confirmed choices and adopted defaults are distinct, and invitation/link identity, consent, expiry/revocation/resend and duplicate/race outcomes are fully specified.
- [ ] AC2: The specification consistently adds the narrow pre-booking invitation path while preserving ordinary request eligibility, exact pair history, block/media/message authority and truthful delivery status.
- [ ] AC3: COR0024 maps every invitation authority/delivery/coach/recipient/proof part to one direct peer, with the external Athletes workspace and its required host contract explicit.
- [ ] AC4: Documentation links/anchors/IDs/index/statuses/membership/formatting/whitespace pass; no runtime/email/deployment is claimed by planning completion.

## Validation plan

Review new and existing recipient accounts, wrong-email/foreign/self/revoked/expired invites, link preview without mutation, explicit acceptance, duplicate/crossed pending relationships, removed-pair retries, block/suspension races and general messages/private media before a first booking. Review queued/failed/resend email outcomes and account-enumeration denial. Run targeted installed Prettier, local link/anchor/ID/index/membership checks and git diff --check for this planning-only change. Application/database/email/browser/static/build tests belong to the runtime peers.

## Implementation record

Specification adoption and runtime implementation have not started. The requested separate COR and six direct Draft records exist, and their initial planning validation passed.

### Changes and rationale

Separated invitations from the original combined DEV0258 planning idea before specification adoption. Created a dedicated contract owner and flat work map so a roster/navigation ticket cannot silently implement email delivery, identity or connection permission changes.

### Affected files

| File                                                                                                                                          | Change and purpose                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| This record and [COR0024](COR0024-email-invitations-and-shareable-links.md)                                                                   | Own the invitation contract proposal and independent delivery map.    |
| [DEV0260](../backend/DEV0260-persist-coach-invitations-and-links.md), [DEV0261](../backend/DEV0261-deliver-athlete-invitation-emails.md)      | Plan distinct invitation authority and email delivery boundaries.     |
| [DEV0262](../frontend/DEV0262-manage-coach-invitations-and-links.md), [DEV0263](../frontend/DEV0263-review-and-accept-athlete-invitations.md) | Plan sender controls and recipient verification/consent separately.   |
| [DEV0264](../backend/DEV0264-rehearse-invitation-onboarding.md)                                                                               | Plan integrated local identity/mail/privacy/recovery evidence.        |
| [DEV0258](DEV0258-define-athlete-workspace.md) and [index](../../README.md)                                                                   | Keep workspace scope separate and record the new owners/statuses/IDs. |

### Decisions and deviations

2026-10-16: The user requested a separate COR for email invitations/shareable links while the combined contract was still being prepared. No product specification or runtime had been changed under DEV0258. Preserved its review history, narrowed it to workspace integration, and assigned invitation adoption to this new peer. This is a scope change before implementation, not a DEV-to-COR conversion or renumbering.

### Contracts, configuration, and operations

None changed in the current application/specification. Future adoption and runtime peers must document token/pair/outbox data, narrow actor APIs, transport/environment/setup, migrations/rollback and compatibility. No tokens, recipient addresses or private account data are recorded.

## Validation results

Initial scope-separation planning checks passed on 16 October 2026 in the local repository:

- `python3 /tmp/dev0259-check-separation.py`: passed 9 affected documents, 267 local links, 27 section anchors, 173 unique DEV/COR records, index/status/next-ID checks, six reciprocal/exclusive COR0024 owners, separate Draft DEV0258, explicit missing external host ownership and preserved current connection/specification behavior. Next identifiers are DEV0265/COR0025.
- `./node_modules/.bin/prettier --check tickets/README.md tickets/current/organisatory/DEV0258-*.md tickets/current/organisatory/DEV0259-*.md tickets/current/organisatory/COR0024-*.md tickets/current/{backend,frontend}/DEV026[0-4]-*.md` and `git diff --check`: passed.
- Scope self-review confirmed that the workspace record was narrowed before adoption, the six invitation peers own distinct boundaries, and no runtime/SMTP/provider/account/email/specification changes occurred. All required direct invitation records exist; missing external workspace runtime ownership is explicit rather than implemented under an invitation ticket.
- Application/database/mail/browser/static/build checks were not run: this is a planning-only update. Native reference review belongs to DEV0258's investigation; no invitation was transmitted or accepted. Contract adoption and runtime evidence remain separate future work.

| Criterion | Evidence                                                                          | Result  |
| --------- | --------------------------------------------------------------------------------- | ------- |
| AC1–AC4   | Contract adoption pending; initial planning checks do not prove runtime behavior. | Not run |

## Risks, limitations, and follow-ups

The initial work-map portion of AC3 and planning-integrity portion of AC4 passed the checks above. Their final adopted-contract/implementation prerequisites remain open, so this ticket stays Draft.

Pre-booking acceptance affects message/media paths that may currently infer a shared booking from an accepted connection. Exact token/recipient/pair authority and local email evidence are required. External workspace/runtime host ownership still needs its own records before full web integration. Do not send real third-party invitations as part of this planning task.

## Completion and review references

2026-10-16 commit preparation: the user authorized committing the planning checkpoint and starting the calendar. Include these interlinked plans and the required completed DEV0238 guard; exclude independent session-note adoption/runtime work. Shared specification/index staging uses scoped snapshots. Fresh `npm test` passed 155 application and 16 server tests; `npm run typecheck` passed. Staged links/scope/format/whitespace are checked separately before commit; no new database or deployment claim is made.

- Completed: Not completed — Draft invitation contract.
- Commit: User-authorized checkpoint — `[DEV0238][DEV0251][DEV0257][DEV0258][DEV0259] Checkpoint schedule authority and plans`; runtime delivery status remains as recorded above.
- Review: Planning/reference self-review; no independent/runtime review.
- Deployment or release: None.
