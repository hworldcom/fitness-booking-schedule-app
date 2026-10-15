# Coordination COR0015: Session notes and training plans

- Status: Draft
- Created: 2026-10-10
- Last updated: 2026-10-15
- Milestone: Scheduling-only session collaboration follow-up
- Converted from: Not applicable — created as a coordination record
- Tracked development tickets: ready [DEV0182 — Adopt the session-notes contract](DEV0182-adopt-session-notes-contract.md), [DEV0183 — Persist authorized session notes](../backend/DEV0183-persist-authorized-session-notes.md), [DEV0184 — Add the coach session workspace](../frontend/DEV0184-add-coach-session-workspace.md) and [DEV0185 — Add athlete session collaboration](../frontend/DEV0185-add-client-session-collaboration.md)
- Related records: completed booking-request dependency [COR0016 — Coach-confirmed booking requests](../../archive/organisatory/COR0016-coach-confirmed-booking-requests.md) and completed [DEV0188 — Persist multi-candidate booking requests](../../archive/backend/DEV0188-persist-multi-candidate-booking-requests.md); booking baseline [DEV0141 — Persist direct private bookings](../../archive/backend/DEV0141-persist-direct-private-bookings.md), athlete-history baseline [DEV0144 — Show client booking history](../../archive/frontend/DEV0144-show-client-booking-history.md), coach-bookings baseline [DEV0170 — Separate coach Schedule and Bookings tabs](../../archive/frontend/DEV0170-separate-coach-schedule-and-bookings-tabs.md), account-deletion follow-up [DEV0165 — Implement the account-deletion lifecycle](../backend/DEV0165-implement-account-deletion-lifecycle.md); independent messaging-contract dependency [DEV0243](../../archive/organisatory/DEV0243-define-ongoing-messages-and-session-note-boundaries.md); independent messaging runtime [COR0022](../../archive/organisatory/COR0022-private-messaging-and-booking-context.md)

## Objective and boundaries

Coordinate original-booking shared plans, coach/athlete notes and separately authorized coach-private notes. The [M8 boundary](../../../docs/mvp-spec.md#166-interface-and-session-note-boundary) places ongoing conversations, inquiries and request cards in independent COR0022. A pending request has no second note/chat workspace; accepting it creates one booking workspace without copying messages into notes.

This record maps note delivery and integration evidence only. It does not implement runtime or replace the specification. Attachments, rich text, notifications, read receipts, reusable templates, longitudinal athlete records and automated/medical advice remain outside this note scope.

## Direct development work

| Implementation part    | Development ticket                                                 | Owned deliverable                                                                                    | Start condition or dependency                                                         |
| ---------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Detailed note contract | [DEV0182](DEV0182-adopt-session-notes-contract.md)                 | Adopt detailed booking-only privacy/status/author/edit/bounds and block-window shared-write rules.   | Ready after the DEV0243 boundary amendment; request baseline is completed.            |
| Note persistence       | [DEV0183](../backend/DEV0183-persist-authorized-session-notes.md)  | Additive original-booking plans/notes, private projections, optimistic mutations and database tests. | DEV0182 complete; stable M8 block-window authority agreed before runtime integration. |
| Coach note interface   | [DEV0184](../frontend/DEV0184-add-coach-session-workspace.md)      | Booking-specific shared-plan/shared-note and distinct coach-private controls.                        | DEV0183 delivered; existing DEV0189 request UI is complete.                           |
| Athlete note interface | [DEV0185](../frontend/DEV0185-add-client-session-collaboration.md) | Original-booking shared-only plan/note reading and author-owned edits, never private metadata.       | DEV0183 delivered; existing DEV0190 is complete.                                      |

The four peers remain direct members only of COR0015. Every required note part has one owner. DEV0243/COR0022 are independent upstream/interface consumers, not direct members or another hierarchy level.

## Other relationships

- COR0016 supplies original request/booking identities and participant authority. Requests/unsuccessful attempts route to COR0022 cards; they do not gain note rows.
- COR0020 supplies existing shared-history navigation and connection/media boundaries. Its historical conversation proposal is superseded by DEV0243/M8; original identities and retained participant content remain intact.
- COR0022 owns the ongoing inbox and service/general consent. Connection removal or lack of general consent does not revoke booking-note reads/writes; an active block restricts shared writes to its captured booking window, preventing notes from bypassing contact restrictions. Coach-private content stays separately authorized.
- DEV0141/DEV0144/DEV0170 supply booking authority and existing session detail surfaces. A later rebooking has a distinct empty workspace even for the same occurrence or athlete.
- DEV0165 remains the account deletion/retention consumer; this coordination invents no deletion or retention schedule.

## Delivery sequence and completion conditions

1. Complete DEV0182's detailed note contract. The broad messaging/notes boundary is already adopted through independent DEV0243; it does not complete DEV0182's remaining work.
2. Complete DEV0183 with safe fresh/upgrade migration, original-booking isolation, shared/private status/block authority, bounds and edit-race evidence.
3. DEV0184 and DEV0185 may proceed independently on stable projections, preserving separate shared/private interfaces and current booking actions.
4. Prove original-booking history/rebooking, connection removal/reconnection, shared/private visibility, status/block restrictions and mobile/desktop/keyboard/error recovery. When messaging is delivered, record a combined Details-to-notes rehearsal without making mailbox completion depend on unfinished notes.
5. Complete COR0015 only after every direct peer completes or is explicitly replaced/cancelled and its own integrated note criteria pass. Message delivery, group runtime and hosted release remain separate.

## Progress and integration record

- 2026-10-15: DEV0243 reconciled the work map after the user adopted Airbnb-style message contact/consent and retained one ongoing conversation. Active note plans are booking-only; DEV0182 is Ready and runtime peers remain Draft. Detailed note adoption/runtime and combined evidence have not started.

Dated earlier planning history below is retained; request-chat organization and historical status statements are superseded by the revision above:

- 2026-10-14: DEV0230 clarified that disconnection never deletes shared content and reconnection restores navigation to every retained shared thread/plan/note, including unsuccessful requests and cancelled bookings. Preserve original request/booking IDs, authors, timestamps and status permissions; terminal/cancelled content remains read-only and coach-private content stays separate. Combined recovery evidence requires both COR0015 and COR0020 delivery.

- 2026-10-14: Adopted athlete vocabulary in the current plan and linked COR0020 as independent relationship work. Connected/disconnected state neither gates session notes nor creates a cross-session athlete record. Earlier dated planning history is preserved.
- 2026-10-10: The user requested per-session coach/client note exchange for training plans, post-session thoughts and coach-only comments.
- 2026-10-10: The user accepted the proposed first-version shape: one coach-authored shared plan, a two-way shared note thread and a separately presented coach-private note area, without expanding the feature into real-time messaging.
- 2026-10-10: Created the flat DEV0182-DEV0185 work map. DEV0182 is Ready; runtime tickets remain Draft until the contract is complete.
- 2026-10-10: Coach-confirmed multi-candidate requests added a pre-booking participant state. COR0015 and DEV0182-DEV0185 returned to Draft while COR0016's request contract/persistence establish stable IDs and lifecycle boundaries; conversation ownership remains in COR0015.

## Validation results

DEV0243 owns current link/status/membership/semantic checks of this revision. Runtime acceptance remains not run and owned by DEV0183–DEV0185. Historical planning evidence:

- Planning validation completed on 2026-10-10: Prettier accepted the ticket index and all five new records; a targeted checker validated every relative Markdown link; the repository search found exactly one heading for COR0015 and each of DEV0182-DEV0185; reciprocal coordination membership and the next-ID update were confirmed; `git diff --check` passed.
- The same checks were repeated after adding COR0016 and the pending-request integration: all twelve affected files and nine reciprocal DEV memberships passed, with conversation ownership remaining exclusively in DEV0182-DEV0185.
- Runtime validation is owned by DEV0183-DEV0185 and has not started.

## Risks, limitations, and follow-ups

Coach-private content or metadata must never enter an athlete response or inbox. Shared writes require both original note authority and any active M8 block-window permission; retained reads remain independent. Account lifecycle remains DEV0165. No per-request chat or cross-session athlete record may be reintroduced under this note coordination.

## Completion and review references

- Completed: Not completed.
- Direct development tickets: DEV0182 Ready; DEV0183–DEV0185 Draft.
- Commit: Not applicable — coordination IDs are not used in commit subjects; this boundary revision belongs to DEV0243.
- Review: Planning self-review only; no runtime integration review.
- Deployment or release: Not implemented or deployed.
