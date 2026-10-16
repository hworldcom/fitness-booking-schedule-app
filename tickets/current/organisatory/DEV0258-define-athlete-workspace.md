# Ticket DEV0258: Define athlete workspace

- Status: Draft
- Created: 2026-10-16
- Last updated: 2026-10-16
- Milestone: Proposed Athletes workspace extension
- Coordination: None — independent development ticket
- Related records: separate invitation dependency [COR0024](COR0024-email-invitations-and-shareable-links.md) and its contract [DEV0259](DEV0259-define-invitation-and-link-consent.md); current connections [COR0020](../../archive/organisatory/COR0020-athlete-terminology-and-connections.md); existing coach list [DEV0222](../../archive/frontend/DEV0222-add-coach-my-athletes.md); private details [DEV0250](../../archive/frontend/DEV0250-unify-coach-athlete-identity-and-private-details.md); independent calendar [COR0023](../../archive/organisatory/COR0023-coach-calendar-and-availability.md) and proposed session types [DEV0257](DEV0257-define-reusable-session-types.md).

## Objective and context

Define a dedicated Athletes tab inside Coach workspace, moving the existing My athletes capability out of Bookings and organizing the roster with All, Connected, Pending and Archived. A roster is the coach's private organized list, not a new account role or permission grant. Keep MovX's existing athlete terminology.

The user confirmed the Athletes-tab placement on 16 October 2026. The initial combined idea also covered external invitations; the user then explicitly requested **email invitations and shareable links as a separate COR** before specification adoption. This record now owns workspace/navigation/status/archival documentation only. COR0024 and DEV0259 own invitation consent/delivery planning, including the confirmed pre-booking connection on explicit acceptance and no activation step. Those shared facts do not create duplicate ownership here.

The current [connection flow](../../../docs/mvp-spec.md#49-connect-after-a-confirmed-session), [state/privacy model](../../../docs/mvp-spec.md#5-scheduling-state-model) and [message authority](../../../docs/mvp-spec.md#16-private-messages-and-session-notes) remain authoritative until the respective amendments are adopted. No application or specification behavior changed during the scope split.

### Reference review

- Inspected the user's existing authenticated Everfit Clients tab in native Chrome on 16 October 2026. The visible sidebar includes All Clients, Connected, Pending, Offline, Waiting Activation, Need Programming and Archived, with counts; the main list has search, status/category filters and activity/training columns. The viewed Pending list was empty.
- Inspected the already-open Add new client form: names, email, Online/In-Person/Hybrid category, coach assignment and Send email invitation; a reusable invite link is also displayed on the Clients page. No fields were entered and no invitation was sent. Closed the form; direct navigation eventually rendered the Pending list after initially stale browser observations. No actual invite token/address or private client data is recorded here.
- Official [segment definitions](https://help.everfit.io/en/articles/5608080-client-list-how-to-use-segments) distinguish invited/not registered Pending from registered Waiting Activation. The [public invite-link guide](https://help.everfit.io/en/articles/5369004-public-client-invite-link) also supports manual activation or a queue when subscription seats run out. These seat/workout models are not MovX requirements.
- Official [Add a client](https://help.everfit.io/en/articles/2836186-add-a-client) describes email, copyable invitation links and resend. [Archive a client](https://help.everfit.io/en/articles/4166092-how-to-archive-a-client) retains history but restricts new workout use; MovX instead proposes roster-only archival, preserving its existing independent connection/booking permissions.

## Scope and non-goals

- In scope: adopt workspace placement, roster membership/search/section/count semantics, reversible archive/restore versus disconnect/block, original private details/history and legacy Bookings links; consume the separate invitation Pending/result projection when available; create small workspace runtime records and validate documentation/ownership.
- Out of scope: invitation/link/token/acceptance authority, email delivery, recipient onboarding or their UI controls (COR0024 owns those); runtime implementation under this contract ticket; automatic activation/seat billing, offline fake accounts, medical/workout/analytics CRM data, bulk imports, calendar/session types, deployment or commits.

## Expected behavior and edge cases

Proposed defaults for adoption:

- Add Athletes alongside Schedule/Bookings in Coach workspace, with the existing shared heading/capability checks and a canonical roster route. Bookings keeps request/booking actions; existing My athletes/private detail links move without duplicating pair identities, relationship state or history.
- All, Connected, Pending and Archived expose bounded, searchable actor-owned rows and truthful counts. Define exactly what All includes and whether it excludes archived rows before implementation. Pending labels distinguish existing incoming/outgoing connection requests from pending external invitations; booking requests remain separately owned Bookings data.
- Use the separate COR0024 invitation components/projection rather than implementing send/share/accept here. There is no Waiting Activation section under the user's no-activation choice. Pending does not imply a fake registered account or disclose whether an entered invitation email already has one.
- Archive/restore is proposed as reversible coach-private organization. It neither disconnects the relationship nor cancels sessions, blocks messages, deletes an account or revives permission. Show those consequences clearly; Disconnect, Block and Revoke invitation remain distinct actions. Restoring a removed connection cannot restore private media/history beyond its existing independent permissions.
- Reuse original pair-scoped private details, authorized name/photo fallback, shared sessions and Messages. Archived/disconnected/blocked/suspended states retain only existing independently allowed reads/actions. No wider athlete profile, unrelated history or contact directory is added.
- Address new/empty/unavailable/long-list/paging, stale counts/actions, actor changes and mobile/keyboard focus. Do not turn reference workout statistics into fabricated scheduling metrics.

## Assumptions, decisions, and dependencies

Confirmed: dedicated Athletes tab in Coach workspace. The user's reference requested All/Connected/Pending/Waiting Activation/Archived; after review they selected direct invitation acceptance without activation, so All/Connected/Pending/Archived is the proposed matching set. Archive behavior, All membership/counting, search and migration/navigation defaults still need specification before adoption.

External invitation facts: the user permits explicit invitation acceptance before a first booking, no coach activation, and a separate email/link COR. COR0024 owns that future exception to current booking-qualified connections. This ticket must not implement it merely to populate a tab.

The separate invitation stream requires an actual Athletes host for final sender/rehearsal integration. Required workspace runtime owner(s) have not been created yet; this contract must create them before that implementation begins and give COR0024 an explicit host/component contract. Preserve existing connection/media/message authority and independent M7/M9 work.

Scope review: DEV0258 owns one workspace-contract amendment, not the entire feature implementation. If backend roster/archive persistence and frontend navigation/rows need separate peers, create a flat workspace work map; do not make them children of this DEV or absorb COR0024. The initial combined planning was narrowed before specification/runtime implementation, so no DEV-to-COR conversion or identifier retirement is needed.

## Implementation plan

1. Preserve the review and user's scope-separation instruction. Rename this current record to the workspace-only title/path, retain its initial planning history and link the separate invitation COR/contract in the index.
2. Settle roster membership/counting/archive/navigation/private-details and invitation-host contracts. Mark In progress before adopting the corresponding current specification amendment; coordinate invitation references with DEV0259 rather than replacing its authority rules.
3. Create the small runtime owner(s) for actual roster/archive data and the Athletes host/navigation/integration, plus their meaningful validation. Record external COR0024 controls/results and safe sequencing explicitly before implementation.
4. Validate links/anchors/IDs/index/statuses and exclusive reciprocal ownership, formatting and whitespace. Complete/archive only after this contract's adoption/validation criteria pass.

## Acceptance criteria

- [ ] AC1: Workspace placement, All/Connected/Pending/Archived membership/counts/search and archive/restore versus disconnect/block are specified, with confirmed choices separate from defaults.
- [ ] AC2: The specification consistently moves the current coach list/private-detail navigation without broadening identity/history/media or implementing invitation authority under this ticket.
- [ ] AC3: Workspace runtime owners and host/interface dependencies are explicit and separate from COR0024; no required host implementation remains hidden under an invitation peer.
- [ ] AC4: Documentation links/anchors/IDs/index/statuses/ownership/formatting/whitespace pass and the record preserves scope-split history without claiming runtime delivery.

## Validation plan

Review pending versus connected and invitation projections, archived-but-connected/removed/blocked pairs, legacy Bookings/detail links, complete pagination/counts, account/capability changes and empty/unavailable/mobile/keyboard recovery. Run targeted installed Prettier, link/anchor/namespace/index and scope-separation checks plus git diff --check for this planning checkpoint. No application/database/browser/static/build tests apply until runtime changes; future owners must define meaningful real actor/privacy/history and responsive evidence.

## Implementation record

Contract adoption and runtime implementation have not started. This record returned to Draft when the user separated invitations before any specification edit.

### Changes and rationale

Initially opened DEV0258 for a combined Athletes/invitation contract after native/official reference review and three user choices. Before adoption, the user requested a separate invitation COR. Preserved reference/history, narrowed and renamed this current record to Athletes workspace, created DEV0259/COR0024 for invitation planning and updated the index. The former combined title is planning history, not a retired identifier or implemented contract.

### Affected files

| File                                                                                                                   | Change and purpose                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| This record                                                                                                            | Workspace-only scope, confirmed placement, proposed status/archive semantics and required external host ownership. |
| [DEV0259](DEV0259-define-invitation-and-link-consent.md) / [COR0024](COR0024-email-invitations-and-shareable-links.md) | Separate invitation consent/email/link ownership and dependency integration.                                       |
| [Index](../../README.md)                                                                                               | Correct current path/title/Draft status and separate invitation work records.                                      |

### Decisions and deviations

2026-10-16: Material scope change requested by the user before adoption: invitations and shareable links belong to their own COR. The initial In progress status covered preparation, with no specification/runtime edit; the narrowed workspace returns to Draft pending its own roster/host details. No history is discarded and no completed record is rewritten.

### Contracts, configuration, and operations

None changed in the current product. No schema/API/dependency/environment/migration/SMTP setting, invitation transmission or deployment occurred. The future workspace and separate invitation contract each own their eventual adoption.

## Validation results

Scope-split planning checks passed on 16 October 2026 and are recorded with exact commands/results by DEV0259: 9 documents, 267 local links, 27 anchors, 173 unique records, metadata/index/status checks, six separate COR0024 owners, the renamed workspace path and preserved current specification. Targeted Prettier and git diff --check passed. Workspace adoption/runtime criteria remain open. Native reference observations above are investigation, not application validation; no application/database/mail/static/build test or SMTP/account/email action was performed for this planning update.

| Criterion | Evidence                                                                                                                                  | Result             |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| AC1–AC3   | Proposed workspace details, specification adoption and runtime ownership pending.                                                         | Not run            |
| AC4       | Initial scope-split links/anchors/IDs/index/status/formatting/whitespace passed; final adopted workspace ownership checks remain pending. | Partially verified |

## Risks, limitations, and follow-ups

Roster Pending cannot bypass invitation/connection consent, and Archive must not imply cancellation or disconnection. The required actual host and its runtime owner are not created yet, which blocks the invitation stream's final host integration; record them here before starting that work. Next action: settle this bounded workspace contract and create its explicit runtime owners independently of COR0024.

## Completion and review references

2026-10-16 commit preparation: the user authorized committing the planning checkpoint and starting the calendar. Include these interlinked plans and the required completed DEV0238 guard; exclude independent session-note adoption/runtime work. Shared specification/index staging uses scoped snapshots. Fresh `npm test` passed 155 application and 16 server tests; `npm run typecheck` passed. Staged links/scope/format/whitespace are checked separately before commit; no new database or deployment claim is made.

- Completed: Not completed — Draft workspace contract.
- Commit: User-authorized checkpoint — `[DEV0238][DEV0251][DEV0257][DEV0258][DEV0259] Checkpoint schedule authority and plans`; runtime delivery status remains as recorded above.
- Review: Native/reference/planning self-review; no independent/runtime review.
- Deployment or release: None.
