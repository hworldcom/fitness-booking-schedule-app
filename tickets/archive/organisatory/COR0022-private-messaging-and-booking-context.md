# Coordination COR0022: Private messaging and booking context

- Status: Completed
- Created: 2026-10-15
- Last updated: 2026-10-15
- Milestone: M8 private messages
- Converted from: Not applicable — independent contract DEV0243 already has commit history
- Tracked development tickets: [DEV0244](../backend/DEV0244-persist-private-message-authority.md), [DEV0245](../backend/DEV0245-integrate-messages-with-scheduling-and-connections.md), [DEV0246](../frontend/DEV0246-add-private-mailbox-and-coach-contact.md), [DEV0247](../backend/DEV0247-rehearse-private-messaging-loop.md)
- Related records: upstream contract [DEV0243](DEV0243-define-ongoing-messages-and-session-note-boundaries.md); independent session-note consumer [COR0015](../../current/organisatory/COR0015-session-notes-and-training-plans.md); completed request baseline [COR0016](COR0016-coach-confirmed-booking-requests.md); connection baseline [COR0020](COR0020-athlete-terminology-and-connections.md); independent group work [COR0021](../../current/organisatory/COR0021-group-training-and-events.md); local migration environment dependency [DEV0232](../../current/organisatory/DEV0232-restore-local-migration-continuity.md)

## Objective and boundaries

Coordinate the [M8 messaging contract](../../../docs/mvp-spec.md#16-private-messages-and-session-notes): pre-request coach inquiries, one ongoing pair conversation with request/booking cards, separate general-message consent, removal/blocking, unread state and reliable receiving-page refresh. This record maps runtime ownership and integration evidence; it implements no runtime or alternative product contract.

Session notes/plans remain COR0015. Group messaging, recipient-visible read receipts, attachments, email/push, reporting operations and account-retention policy are outside this work map. Public coach discovery and M7 group delivery remain independent.

## Direct development work

| Implementation part          | Development ticket                                                                  | Owned deliverable                                                                                                                                                           | Start condition or dependency                                                             |
| ---------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Message authority            | [DEV0244](../backend/DEV0244-persist-private-message-authority.md)                  | Additive schema/functions, pair/context/read/consent authority, inquiry/text persistence, rate/idempotency rules, bounded server projections and internal block primitives. | DEV0243 adopted; inspect actual local migration continuity before applying migrations.    |
| Existing-product integration | [DEV0245](../backend/DEV0245-integrate-messages-with-scheduling-and-connections.md) | Atomic request/card/status integration, historical bootstrap, connection grant/revocation and exposed block/unblock operations with scheduling guards/exceptions.           | DEV0244 stable primitives and shared pair-lock order are validated.                       |
| Mailbox interface            | [DEV0246](../frontend/DEV0246-add-private-mailbox-and-coach-contact.md)             | Protected Messages/contact/navigation, context composer, consent/block controls, original Details links, pagination/unread and visibility-aware refresh.                    | DEV0244 projections stable; integration-dependent controls stay unfinished until DEV0245. |
| Integrated proof             | [DEV0247](../backend/DEV0247-rehearse-private-messaging-loop.md)                    | Real two-account/database race/privacy and already-open receiving-browser proof, responsive/keyboard/failure regression evidence.                                           | DEV0244–DEV0246 delivered locally with safe isolated fixtures and working local services. |

Every required mailbox implementation part has exactly one direct peer. The peers link back here in their Coordination field; there are no nested development tickets. Integrated proof does not take ownership of defects that belong in another peer.

## Other relationships

- DEV0243 is the independent upstream contract; its existing history is preserved, not converted or retired.
- COR0015 is a downstream session-note consumer. Its implementation is not required for mailbox completion: original booking details remain navigable, and unavailable notes must not be fabricated. A later combined note/message rehearsal belongs to that consumer.
- COR0016/COR0020 provide existing request, booking, connection and media authority. DEV0245 owns only the M8 amendments, preserving their historical evidence.
- COR0021/M7 is independent. Its changes in shared navigation/source files must be preserved during integration; no group participation creates message permission.
- DEV0232 concerns already-applied branch-only local migration versions. Read-only audit may precede implementation; no reset or blind ledger repair is part of messaging. Runtime validation is blocked only if a safe migration-capable environment is unavailable.

## Delivery sequence and completion conditions

1. Finish the independent DEV0243 contract and this reciprocal work map; DEV0244 is the first runtime slice.
2. Complete DEV0244 database/domain/server authority and establish deterministic pair/context locking before DEV0245 changes existing mutations.
3. DEV0245 and DEV0246 may progress independently on stable shared contracts; coordinate changes to shared shell/actions and integrate before interface completion. Neither may claim end-to-end block/request behavior from a stub.
4. DEV0247 proves real persistence, two already-open recipients, negative authorization, exact time/consent/block boundaries and mobile/keyboard/error recovery. Fix failures under the responsible peer and rerun affected evidence.
5. Complete this coordination only after every direct peer is Completed or explicitly replaced/cancelled, all M8 acceptance scenarios pass, and the integrated result is recorded. No hosted release or note runtime is implied.

## Progress and integration record

- 2026-10-15: User approved PostgreSQL storage implementation with no five-year purge. DEV0244 implementation started; existing local branch-only migration entries/data are preserved. Runtime was incomplete at that implementation-start checkpoint.

- 2026-10-15: The user adopted the discussed Airbnb rules. DEV0243 established the contract and four-peer map. At contract adoption, DEV0244 was Ready and other peers were Draft; runtime had not started.

- 2026-10-15 completion: DEV0244–DEV0247 delivered all direct work. Protected pre-request contact, ongoing request/booking cards, explicit general consent, connection removal/blocking and visible-page freshness are integrated locally. Source-record fingerprints remained unchanged during upgrade; temporary rehearsal fixtures were removed. The real two-account run verified arrival, uncertain acknowledgement recovery, consent, responsive layouts, hidden/visible behavior and account switching. No hosted or note runtime is implied.

## Validation results

All four direct tickets meet their acceptance criteria. DEV0244/DEV0245 record database authority, fresh/upgrade and rollback/permission/race evidence; DEV0246 records the interface; DEV0247 records integrated two-account proof. Standard unit/server/static/build checks and database/pgTAP/SQL lint passed. Coordination completion conditions are satisfied; see the direct records for exact commands and observations.

## Risks, limitations, and follow-ups

One visible conversation contains distinct service/general permissions; no UI context choice may bypass a block or expose another candidate. Migration continuity and concurrent edits to shared files require inspection before runtime work. Account deletion/retention remains DEV0165, and reporting operations need later scope; neither is silently supplied by an inbox.

## Completion and review references

- Completed: 2026-10-15 — every direct peer and the local integration criteria passed.
- Direct development tickets: DEV0244–DEV0247 Completed.
- Commit: Not applicable — coordination IDs are not used in commit subjects.
- Review: Implementation self-review and integrated local validation; no independent review.
- Deployment or release: Implemented and validated locally; not hosted deployment.
