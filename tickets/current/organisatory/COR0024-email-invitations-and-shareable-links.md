# Coordination COR0024: Email invitations and shareable links

- Status: In progress
- Created: 2026-10-16
- Last updated: 2026-10-17
- Milestone: Proposed invitation and link onboarding extension
- Converted from: Not applicable — created separately at the user's request; existing DEV0258 remains the workspace contract owner.
- Tracked development tickets: [DEV0259 contract](DEV0259-define-invitation-and-link-consent.md), [DEV0260 authority](../backend/DEV0260-persist-coach-invitations-and-links.md), [DEV0261 email delivery](../backend/DEV0261-deliver-athlete-invitation-emails.md), [DEV0262 coach controls](../frontend/DEV0262-manage-coach-invitations-and-links.md), [DEV0263 recipient acceptance](../frontend/DEV0263-review-and-accept-athlete-invitations.md), [DEV0264 local proof](../backend/DEV0264-rehearse-invitation-onboarding.md).
- Related records: external Athletes workspace contract [DEV0258](DEV0258-define-athlete-workspace.md); delivered connections [COR0020](../../archive/organisatory/COR0020-athlete-terminology-and-connections.md); independent calendar [COR0023](../../archive/organisatory/COR0023-coach-calendar-and-availability.md) and proposed session types [DEV0257](DEV0257-define-reusable-session-types.md).

## Objective and boundaries

Coordinate **email invitations and shareable coach invite links as a separate work stream**, as explicitly requested on 16 October 2026. The confirmed target allows a verified athlete to connect before any booking by explicitly accepting the coach's invitation, with no separate activation step. This record groups peer work and does not implement runtime behavior or change the current specification by itself.

The [current connection contract](../../../docs/mvp-spec.md#49-connect-after-a-confirmed-session) still requires a qualifying booking for ordinary requests. DEV0259 must adopt the narrow invitation exception and operating details first. Existing exact-pair identity, recipient consent, block/removal, messaging/media/history and private booking rules remain authoritative. Invitation creation, delivery, URL opening and account sign-in are distinct from accepted consent.

The separate Athletes workspace owns navigation, roster sections/search, archive/restore and private detail placement. This COR owns invitation authority, email delivery, sender/recipient invitation controls and combined proof only. No seat limits, manual activation, offline accounts, bulk import/campaigns, calendar/session types, workout/health profiles, real external sends or deployment are included in this planning task.

## Direct development work

| Implementation part                      | Development ticket                                                      | Owned deliverable                                                                                                                                                                       | Start condition or dependency                                                                                    |
| ---------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Invitation product contract and work map | [DEV0259](DEV0259-define-invitation-and-link-consent.md)                | Adopt exact invitation/link consent, eligibility/lifecycle/privacy/delivery defaults and specification scenarios; own this independent flat map and record checks.                      | Draft operating details; user acceptance/separation choices already recorded.                                    |
| Invitation/link authority                | [DEV0260](../backend/DEV0260-persist-coach-invitations-and-links.md)    | Narrow records/token/recipient operations, explicit pre-booking acceptance into the existing pair, revision/retry/race/history/message/media boundaries and atomic email outbox intent. | DEV0259 adoption; stable recipient/sender/outbox interfaces agreed with consumers.                               |
| Email transport and delivery             | [DEV0261](../backend/DEV0261-deliver-athlete-invitation-emails.md)      | Controlled outbox dispatch/claim/retry/result, email content/transport configuration, actual loopback SMTP/Mailpit setup and delivery/failure evidence.                                 | DEV0260 outbox/revocation contract; select/document actual transport and dispatch mechanism before edits.        |
| Coach invitation controls                | [DEV0262](../frontend/DEV0262-manage-coach-invitations-and-links.md)    | Reusable invite form/review, Pending invitation/delivery feedback, resend/revoke and share/copy/rotate controls, plus integration with the external workspace host.                     | DEV0260 sender and DEV0261 delivery results; external Athletes host/embedding contract and eventual actual host. |
| Recipient review and acceptance          | [DEV0263](../frontend/DEV0263-review-and-accept-athlete-invitations.md) | Read-only preview, normal verified Auth return, explicit accept/decline and error/retry/privacy states; reuse existing My coaches/message boundary with no booking.                     | DEV0260 adopted recipient operations; final mail-link proof uses DEV0261.                                        |
| Integrated local onboarding proof        | [DEV0264](../backend/DEV0264-rehearse-invitation-onboarding.md)         | Tagged real coach/new/existing recipient accounts, actual local mail/link flows, pair/consent/privacy/race/recovery and mobile/desktop/keyboard proof, command and cleanup.             | All runtime peers meet checks and the required external Athletes host exists.                                    |

All six direct records exist and declare COR0024 membership. They are peers: the contract ticket and backend dependencies are not parents of other development tickets. No invitation implementation part is hidden under the COR or duplicated in the workspace ticket.

## Other relationships

- **External host/consumer:** DEV0258 owns the Athletes workspace contract, not invitation acceptance or email transport. It retains the planned All/Connected/Pending/Archived roster and separate coach tab. Its future workspace runtime record(s) have **not been created**; they must explicitly own the host/navigation/roster integration before DEV0262/DEV0264 can complete the real web flow. This is a required external integration dependency, not permission to implement the entire roster under an invitation peer.
- **Existing foundations:** COR0020 supplies current pair identity and ordinary booking-qualified connection requests; M8 supplies separate message consent/block/media authority. DEV0260 must test accepted invitation pairs with no booking rather than assuming existing request checks already cover them.
- **External environment/authentication:** the requested hosted-dev mapping for local and test/UAT applications and separate hosted production setup require their own work records; historical DEV0055 remains the hosted baseline. Apple/Google/password authentication was initially proposed on 16 October. On 17 October, the user selected all three under external [COR0027](COR0027-login-registration-and-social-authentication.md); its exact account/linking/verification rules remain DEV0285 contract work and the delivered runtime still uses email codes. Settle its verified-recipient/account-recovery contract before DEV0260/DEV0263 integration; COR0024 consumes that authority without implementing an authentication replacement or provider/project migration. Recommended operational order is new UAT foundation, chosen authentication, then invitations; no hosted operation is authorized by this planning note.
- **Independent work:** COR0023 calendar and DEV0257 proposed session types are neither direct members nor prerequisites for invitation planning/authority. Preserve their records and uncommitted implementation work. M7 group lifecycle/registration supplies no invitation or new private-data permission.

## Delivery sequence and completion conditions

1. DEV0259 settles operating details and adopts the current specification amendment. This planning creation itself changes no runtime or specification contract. Keep all implementation peers Draft until their stated start conditions permit work.
2. DEV0260 establishes authority and stable sender/recipient/outbox interfaces first; it must not publish an unguarded consent operation while existing pair/block/message paths still bypass its rules.
3. DEV0261 delivery and DEV0263 recipient UI may proceed independently once their DEV0260 contracts pass. DEV0262 can build against the same stable sender boundary, coordinating actual host work with the separately owned Athletes stream.
4. DEV0261 owns loopback SMTP setup: the current Mailpit UI setting does not expose the commented-out additional SMTP port or prove successful application delivery. Complete real local delivery before claiming end-to-end email onboarding.
5. DEV0262 must integrate into a real external workspace host; a mock host or an inert invitation button is insufficient. Missing external host records/delivery remain explicit prerequisites, not unowned implementation under this COR.
6. DEV0264 runs the final real local flow after runtime and external-host prerequisites pass. Fix missing behavior in its owner instead of implementing it under the proof ticket.
7. Complete this COR only when all six direct peers are Completed or explicitly cancelled/replaced and integrated proof passes for new/existing accounts, email and reusable links, explicit pre-booking consent with no activation, one pair, no permission/history leaks, honest delivery/revocation/resend, block/removal/retry recovery, actual workspace integration, responsive/keyboard use and exact tagged cleanup. Hosted email/provider/domain operations and production sending remain separate.

## Progress and integration record

- 2026-10-16: Everfit Clients/invitation review and the user's three relationship/navigation choices were initially captured by DEV0258. Before specification adoption, the user explicitly requested a separate COR for email invitations/shareable links. Kept the workspace contract separate and created this COR with six direct peers.
- 2026-10-16: Planning coordination is active. DEV0259 and all five runtime peers are Draft; no specification amendment, invitation, mail delivery, account change or runtime implementation has occurred under this stream. The external workspace runtime owner remains to be created under its own planning.
- 2026-10-16: The user confirmed that an individual invitation to `a@gmail.com` can map only to that verified recipient address. DEV0259 records the constraint and DEV0260/DEV0263 carry concrete verification/rejection scenarios. A different Apple/Google email or a forwarded link cannot remap a targeted invitation; explicit acceptance remains required. Shared authentication and new Supabase environment work remain separately owned planning dependencies above.
- 2026-10-16: The user clarified that sign-up may use any supported email. A person opening the `a@gmail.com` invitation may register as `b@gmail.com` normally, without an invitation-derived connection to the sender and without accepting/consuming/remapping the targeted invitation. DEV0259/DEV0260/DEV0263 distinguish successful registration from eligible explicit invitation acceptance; account switching is not mandatory for ordinary onboarding.

## Validation results

Initial record/link/namespace/index, reciprocal/exclusive ownership, explicit external-host gap, current-contract preservation, formatting and whitespace checks passed on 16 October 2026. DEV0259 records exact commands/results. These planning checks do not validate invitation acceptance or email delivery; each peer owns its implementation evidence and DEV0264 owns the combined proof.

## Risks, limitations, and follow-ups

A link is an offer to connect, not identity verification or permission by itself. Pending delivery cannot mean Connected, and accepted connections without bookings require explicit message/media regression coverage. Missing SMTP or the external roster host cannot be counted as a successful invitation flow. User-facing activation/seat mechanics are excluded by the confirmed choice. Keep public-link and targeted-recipient privacy, expiry/revocation, pair races and external workspace ownership explicit before adoption.

## Completion and review references

- Completed: Not completed — contract adoption and runtime/integration proof pending.
- Direct development tickets: DEV0259–DEV0264 Draft.
- Commit: Not applicable — COR identifiers are never commit subjects; the user-authorized planning checkpoint is owned by DEV0259.
- Review: Initial planning self-review only; no independent/runtime review.
- Deployment or release: None.
