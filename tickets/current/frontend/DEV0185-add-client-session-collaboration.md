# Ticket DEV0185: Add athlete session collaboration

- Status: Draft
- Created: 2026-10-10
- Last updated: 2026-10-15
- Milestone: Scheduling-only session collaboration follow-up
- Coordination: [COR0015 — Session notes and training plans](../organisatory/COR0015-session-notes-and-training-plans.md)
- Related records: contract dependency [DEV0182 — Adopt the session-notes contract](../organisatory/DEV0182-adopt-session-notes-contract.md), backend dependency [DEV0183 — Persist authorized session notes](../backend/DEV0183-persist-authorized-session-notes.md), completed request-interface dependency [DEV0190 — Add the client booking-request flow](../../archive/frontend/DEV0190-add-client-booking-request-flow.md), coach peer [DEV0184 — Add the coach session workspace](DEV0184-add-coach-session-workspace.md), athlete-history baseline [DEV0144 — Show client booking history](../../archive/frontend/DEV0144-show-client-booking-history.md); independent messaging-contract dependency [DEV0243](../../archive/organisatory/DEV0243-define-ongoing-messages-and-session-note-boundaries.md); independent messaging runtime [COR0022](../../archive/organisatory/COR0022-private-messaging-and-booking-context.md)

## Planning boundary revised — 2026-10-15

The user adopted Airbnb-style contact/consent while retaining one ongoing pair conversation and separate booking notes. DEV0243 reconciles this plan; COR0022 owns messages/inquiries/request cards. The earlier proposal for a conversation per pending request is superseded, not an active implementation instruction. The previously accepted shared-plan/shared-note/coach-private intent remains. This revision implements no note runtime.

## Objective and context

Add athlete booking-specific shared plan/note reading and author-owned note exchange in My sessions. Ongoing chat and pending request discussion are COR0022 work; [section 16.6](../../../docs/mvp-spec.md#166-interface-and-session-note-boundary) keeps the original booking detail separate.

## Scope and non-goals

In scope:

- Open original-booking details from My sessions and delivered Messages/history links, keeping coach/time/venue/status visible.
- Read the coach-authored shared plan and shared notes; add/edit only the athlete's own entries.
- Handle confirmed/completed/cancelled, active shared-write block restrictions, empty/stale/validation/authorization/unavailable states.
- Prove athlete responses contain no coach-private bodies, identifiers, counts, timestamps or existence flags.

Out of scope: ongoing Messages/inquiry/general-consent/request-card runtime, attachments, rich text, notification delivery, read receipts, reusable templates, cross-booking athlete records and medical analysis. Preserve independent scheduling and media authority.

## Expected behavior and edge cases

- Pending requests have original message cards and ongoing chat under COR0022, with no second request-note thread. Acceptance creates one booking workspace without copying conversation text.
- An absent plan/note list is presented neutrally. Shared entries identify authors without exposing unrelated profile fields; the athlete cannot edit the coach's plan or entries.
- Cancelled notes remain readable/read-only. Confirmed/completed writes follow DEV0182 and M8 block-window restrictions; connection removal or general-message consent does not gate reads.
- Rebooking has a distinct empty workspace. Reconnection/history opens original retained booking content with original permissions.
- Access failure presents unavailable, clears unauthorized cached content and preserves drafts only while the actor/context remains authorized.

## Assumptions, decisions, and dependencies

Start after DEV0182/DEV0183; DEV0190 is complete. May proceed alongside DEV0184 on stable projections. Reuse My sessions details and delivered message links without implementing a global inbox under this ticket.

Athlete is the existing training-participant capability; internal `client` names remain compatible. No arbitrary athlete directory or group-note access is added. Account deletion/retention remains DEV0165 and must not be invented here.

## Implementation plan

1. Review DEV0183 athlete projections/actions and relevant bundled Next.js documentation.
2. Build original-booking shared-plan/note detail and original-history entry points; preserve scheduling status/actions.
3. Add bounded author-owned note saves/edits, status/block restrictions and stale/unavailable draft recovery.
4. Add responsive accessible context, focus and status feedback without private metadata.
5. Run focused privacy/component/browser/static/build checks and a real two-account booking-note rehearsal.

## Acceptance criteria

- [ ] AC1: The athlete reads only the original booking's shared plan/notes with no coach-private/other-candidate data and no per-request note workspace.
- [ ] AC2: The athlete adds/edits only their own valid shared notes and cannot mutate the coach plan/entries.
- [ ] AC3: Cancelled/block-restricted/status, rebooking/history and empty/stale/unavailable cases preserve truthful state, original identities and authorized drafts.
- [ ] AC4: Keyboard and desktop/mobile detail retain coach/time/venue/status and existing history/cancellation behavior.
- [ ] AC5: Two-account and serialized-projection evidence proves both participants see shared entries and athletes never receive private metadata.

## Validation plan

Rehearse one real local original booking with two actors, shared plan/note visibility, author edits, status/block restrictions, rebooking/history and unavailable conflicts. Verify serialized athlete payloads contain no private metadata. Exercise desktop/375/430 px and keyboard; run focused component/browser tests, npm run lint, npm run typecheck, npm run format:check and npm run build.

## Implementation record

Pending implementation. DEV0243 revised the planning boundary only; the acceptance criteria below still require this ticket's own evidence.

### Changes and rationale

No owned implementation yet. The planning revision removes duplicated request chat and keeps original-booking content separate from the ongoing inbox.

### Affected files

Pending implementation; record actual files and roles when work starts.

### Decisions and deviations

- 2026-10-15: Reconcile the active scope with M8/DEV0243. General conversations/request cards move to independent COR0022; original-booking plans/notes remain here. Shared writes must respect M8 block windows, while retained reads and coach-private authority remain separate.

Dated earlier planning history (superseded where it proposes request chat):

- 2026-10-14: Updated planning vocabulary to athlete and made connection-independent session authorization explicit; existing filenames/IDs and earlier history remain intact. Session-content contract adoption still belongs to DEV0182.

No implementation decisions or deviations recorded yet.

### Contracts, configuration, and operations

Consumes DEV0183 athlete-only projections/actions and adopted M8 restrictions. No environment/provider/migration change is planned.

## Validation results

Runtime acceptance criteria are not run. DEV0243 owns link/status/membership and semantic checks of this planning revision. Do not infer implementation or completed browser/database evidence from the contract amendment.

## Risks, limitations, and follow-ups

Private data must be excluded by database/server projections, not browser hiding. Notes may be sensitive and must not enter logs, analytics or unrelated responses. Original IDs, author ownership and optimistic versions prevent content transfer/loss. Note/M8 integration needs combined evidence when both are delivered; each coordination retains its own completion boundary.

## Completion and review references

- Completed: Not completed.
- Commit: Earlier planning record retained in Git history; this boundary revision belongs to DEV0243, with no owned runtime commit yet.
- Review: Planning self-review only; no independent implementation review.
- Deployment or release: Not implemented or deployed.
