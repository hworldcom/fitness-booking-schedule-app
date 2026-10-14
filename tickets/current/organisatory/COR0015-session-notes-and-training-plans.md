# Coordination COR0015: Session notes and training plans

- Status: Draft
- Created: 2026-10-10
- Last updated: 2026-10-14
- Milestone: Scheduling-only session collaboration follow-up
- Converted from: Not applicable — created as a coordination record
- Tracked development tickets: draft [DEV0182 — Adopt the session-notes contract](DEV0182-adopt-session-notes-contract.md), [DEV0183 — Persist authorized session notes](../backend/DEV0183-persist-authorized-session-notes.md), [DEV0184 — Add the coach session workspace](../frontend/DEV0184-add-coach-session-workspace.md) and [DEV0185 — Add athlete session collaboration](../frontend/DEV0185-add-client-session-collaboration.md)
- Related records: completed booking-request dependency [COR0016 — Coach-confirmed booking requests](../../archive/organisatory/COR0016-coach-confirmed-booking-requests.md) and completed [DEV0188 — Persist multi-candidate booking requests](../../archive/backend/DEV0188-persist-multi-candidate-booking-requests.md); booking baseline [DEV0141 — Persist direct private bookings](../../archive/backend/DEV0141-persist-direct-private-bookings.md), athlete-history baseline [DEV0144 — Show client booking history](../../archive/frontend/DEV0144-show-client-booking-history.md), coach-bookings baseline [DEV0170 — Separate coach Schedule and Bookings tabs](../../archive/frontend/DEV0170-separate-coach-schedule-and-bookings-tabs.md), account-deletion follow-up [DEV0165 — Implement the account-deletion lifecycle](../backend/DEV0165-implement-account-deletion-lifecycle.md)

## Objective and boundaries

Coordinate a private workspace for each persisted booking request and its eventual direct-session booking. A requesting athlete and coach can exchange isolated shared text notes while approval is pending; when the coach accepts that request, its conversation continues into the confirmed session workspace. The coach can then maintain one shared training plan and clearly separated private notes. The feature must preserve participant-only access, prevent candidate/request content from crossing between athletes and remain useful before and after training.

The first delivery is asynchronous plain-text collaboration rather than chat. It excludes attachments, rich text, live updates, notifications, read receipts, reusable plan templates, cross-booking athlete records, medical analysis and automated coaching advice. This record owns the shared boundaries, sequence and integration evidence only; it does not implement runtime behavior.

## Direct development work

| Implementation part          | Development ticket                                                                                     | Owned deliverable                                                                                                                                          | Start condition or dependency                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Product and privacy contract | [DEV0182 — Adopt the session-notes contract](DEV0182-adopt-session-notes-contract.md)                  | Define request/session-workspace terminology, lifecycle, visibility, mutation, retention and acceptance behavior in the authoritative specification.       | Starts after DEV0186 fixes request semantics.           |
| Persistence and authority    | [DEV0183 — Persist authorized session notes](../backend/DEV0183-persist-authorized-session-notes.md)   | Add request/booking-bound plan/note persistence, participant-scoped projections, bounded mutations, optimistic concurrency and database/application tests. | Starts after DEV0182 and DEV0188.                       |
| Coach interface              | [DEV0184 — Add the coach session workspace](../frontend/DEV0184-add-coach-session-workspace.md)        | Add isolated pending-request threads plus shared-plan, shared-note and clearly separated coach-private-note controls to Bookings.                          | Starts after DEV0183 and DEV0189 establish their views. |
| Athlete interface            | [DEV0185 — Add athlete session collaboration](../frontend/DEV0185-add-client-session-collaboration.md) | Show the isolated pending conversation and accepted session's shared plan/thread without ever returning coach-private metadata.                            | Starts after DEV0183 and DEV0190 establish their views. |

All required implementation parts have direct development tickets. The tickets are flat peers under this coordination record; their dependency order does not create a child development-ticket hierarchy.

## Other relationships

- [COR0020 — Athlete terminology and connections](COR0020-athlete-terminology-and-connections.md) is independent web relationship work. Shared request/session content is authorized by its exact participants regardless of connection state; acceptance/removal never merges content or changes session permissions.

- DEV0141 supplies booking identity, participant authority and terminal lifecycle behavior. Session content belongs to the booking, not its availability occurrence, so a cancellation and later rebooking cannot transfer notes between athletes.
- DEV0144 and DEV0170 supply the two existing surfaces where session collaboration will appear. The new interface extends those views rather than creating a public or unrelated messaging destination.
- COR0016 supplies pending request identity and selection. Each request has an isolated conversation; acceptance links that exact conversation to the confirmed booking, while declined, withdrawn, expired and not-selected conversations become read-only and never merge.
- DEV0165 is a downstream account-lifecycle consumer. It must later decide whether session-content authorship is deleted, anonymized or retained when an account is removed; that future decision does not permit the current feature to expose content beyond booking participants.

## Delivery sequence and completion conditions

1. Complete COR0016's DEV0186 contract first so pending-request identity, statuses and selection semantics are authoritative; then complete DEV0182 for conversation/privacy behavior.
2. Complete COR0016's DEV0188 request persistence before DEV0183 binds notes to requests and accepted bookings.
3. Complete DEV0183 with fresh/upgrade migration coverage, per-request isolation, accepted-booking continuity, plan uniqueness, note bounds and concurrent-edit behavior.
4. DEV0184 and DEV0185 can proceed after their corresponding COR0016 interfaces establish pending-request surfaces.
5. Complete this coordination only when every direct ticket is Completed or explicitly cancelled/replaced; each pending candidate has an isolated shared thread, only the accepted thread continues into one booking, a coach can share/revise one plan, both confirmed participants can add shared notes, only the coach receives private notes, terminal request/cancelled-session threads are read-only, completed sessions accept post-session notes, unrelated actors fail closed, and responsive end-to-end validation passes.

## Progress and integration record

- 2026-10-14: Adopted athlete vocabulary in the current plan and linked COR0020 as independent relationship work. Connected/disconnected state neither gates session notes nor creates a cross-session athlete record. Earlier dated planning history is preserved.
- 2026-10-10: The user requested per-session coach/client note exchange for training plans, post-session thoughts and coach-only comments.
- 2026-10-10: The user accepted the proposed first-version shape: one coach-authored shared plan, a two-way shared note thread and a separately presented coach-private note area, without expanding the feature into real-time messaging.
- 2026-10-10: Created the flat DEV0182-DEV0185 work map. DEV0182 is Ready; runtime tickets remain Draft until the contract is complete.
- 2026-10-10: Coach-confirmed multi-candidate requests added a pre-booking participant state. COR0015 and DEV0182-DEV0185 returned to Draft while COR0016's request contract/persistence establish stable IDs and lifecycle boundaries; conversation ownership remains in COR0015.

## Validation results

- Planning validation completed on 2026-10-10: Prettier accepted the ticket index and all five new records; a targeted checker validated every relative Markdown link; the repository search found exactly one heading for COR0015 and each of DEV0182-DEV0185; reciprocal coordination membership and the next-ID update were confirmed; `git diff --check` passed.
- The same checks were repeated after adding COR0016 and the pending-request integration: all twelve affected files and nine reciprocal DEV memberships passed, with conversation ownership remaining exclusively in DEV0182-DEV0185.
- Runtime validation is owned by DEV0183-DEV0185 and has not started.

## Risks, limitations, and follow-ups

- Session notes may contain sensitive personal or health-related information. Private content must not enter public projections, client responses, browser logs, analytics or error messages.
- Visibility mistakes are higher risk than ordinary interface errors. Coach-private composition must be a separate interface region rather than a shared/private toggle with an unsafe default.
- Account deletion, legal retention and export policy remain owned by DEV0165. This coordination must record its schema relationship without pre-empting that broader lifecycle decision.
- Plain text, bounded entry counts and bounded projection size protect the first release. Attachments, reusable plans and longitudinal client records require later contracts.

## Completion and review references

- Completed: Not completed.
- Direct development tickets: DEV0182-DEV0185 Draft.
- Commit: Not applicable — coordination-record IDs are not used in commit subjects.
- Review: No integration review created.
- Deployment or release: Not deployed or released.
