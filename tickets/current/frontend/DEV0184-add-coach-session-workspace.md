# Ticket DEV0184: Add the coach session workspace

- Status: Draft
- Created: 2026-10-10
- Last updated: 2026-10-16
- Milestone: Scheduling-only session collaboration follow-up
- Coordination: [COR0015 — Session notes and training plans](../organisatory/COR0015-session-notes-and-training-plans.md)
- Related records: contract dependency [DEV0182 — Adopt the session-notes contract](../../archive/organisatory/DEV0182-adopt-session-notes-contract.md), backend dependency [DEV0183 — Persist authorized session notes](../backend/DEV0183-persist-authorized-session-notes.md), completed request-interface dependency [DEV0189 — Add the coach booking-request queue](../../archive/frontend/DEV0189-add-coach-booking-request-queue.md), athlete peer [DEV0185 — Add athlete session collaboration](DEV0185-add-client-session-collaboration.md), coach-bookings baseline [DEV0170 — Separate coach Schedule and Bookings tabs](../../archive/frontend/DEV0170-separate-coach-schedule-and-bookings-tabs.md); independent messaging-contract dependency [DEV0243](../../archive/organisatory/DEV0243-define-ongoing-messages-and-session-note-boundaries.md); independent messaging runtime [COR0022](../../archive/organisatory/COR0022-private-messaging-and-booking-context.md)

## Planning boundary revised — 2026-10-15

The user adopted Airbnb-style contact/consent while retaining one ongoing pair conversation and separate booking notes. DEV0243 reconciles this plan; COR0022 owns messages/inquiries/request cards. The earlier proposal for a conversation per pending request is superseded, not an active implementation instruction. The previously accepted shared-plan/shared-note/coach-private intent remains. This revision implements no note runtime.

## Contract adopted — 2026-10-16

[Specification section 17](../../../docs/mvp-spec.md#17-session-training-plans-and-notes) is the implementation contract. Session messages and filtering are already delivered under COR0022/DEV0248; this workspace is a training record with explicit note saves, not another message composer or thread. Reuse existing shared title/date identity and independent Messages authority.

This ticket owns reusable plan/entry display and form components plus `/coach/sessions/[bookingId]`, Coach Bookings/history entry points and coach Messages Details integration. DEV0185 consumes the shared component contract rather than building a duplicate editor. Keep Shared plan, Shared session notes and Coach-private notes clearly labelled; show author/time/edited state and Load earlier. Private composition has its own controls and no visibility conversion. Honor all section 17 text/quota/paging/status/block/suspension rules and explicit Save/Cancel, stale/uncertain retry and authorized draft recovery.

Do not put this route behind the accepted-connection gate of private athlete details. Rehearse disconnected exact-booking access, cancelled history, empty replacement booking, existing-conversation discussion shortcut, no note-created unread activity and coach-private exclusion from athlete serialized output. The athlete-interface peer supplies the combined second-account UI evidence; this ticket still owns its coach-side checks. Runtime remains unimplemented.

## Objective and context

Add coach booking-specific shared plans/notes and a clearly separate private-note area. General conversation and request discussion live in COR0022 Messages; [section 16.6](../../../docs/mvp-spec.md#166-interface-and-session-note-boundary) keeps session details focused on the original booking.

## Scope and non-goals

In scope:

- Open original-booking details from Coach workspace Bookings and integrate the already-delivered Messages Details/history links.
- Present explicit coach-authored shared-plan saves, shared coach/athlete notes and author-owned edits.
- Present coach-private notes in a distinct labelled region, never an ambiguous shared/private toggle.
- Handle confirmed/completed/cancelled, block-window, validation/stale/conflict/authorization/unavailable states with responsive keyboard feedback.

Out of scope: ongoing Messages/inquiry/general-consent/request-card runtime, attachments, rich text, notification delivery, read receipts, reusable templates, cross-booking athlete records and medical analysis. Preserve independent scheduling and media authority.

## Expected behavior and edge cases

- Keep named athlete, original time/venue and booking status visible. A pending request links to its ongoing conversation rather than mounting another note/chat editor.
- The shared plan clearly states athlete visibility; notes show author/timestamp/edited state. Explicit saves and stale-version recovery preserve authorized drafts.
- Private composition is separate from shared controls; no private count/existence leaks to an athlete or shared inbox projection.
- Cancelled notes are read-only; confirmed/completed writes obey DEV0182 and any active M8 shared-write restriction. Private-note permission remains separate.
- Reconnected history opens original booking content, while rebooking has an empty distinct workspace. Failure shows a truthful unavailable result and does not fabricate notes.

## Assumptions, decisions, and dependencies

Start after DEV0183; DEV0182 supplies the adopted contract and DEV0189 is complete. Own the shared note UI used by DEV0185. Integrate current Bookings and delivered Messages entry points without implementing another chat.

Athlete is the existing training-participant capability; internal `client` names remain compatible. No arbitrary athlete directory or group-note access is added. Account deletion/retention remains DEV0165 and must not be invented here.

## Implementation plan

1. Review DEV0183 coach projection/actions and relevant bundled Next.js route/action/cache documentation.
2. Build original-booking details with separate shared plan, shared notes and coach-private forms; preserve scheduling actions.
3. Add bounded explicit saves, author/status/block feedback, stale conflicts and draft/focus recovery.
4. Verify original history links, mobile/desktop/keyboard/error states and negative shared/private rendering.
5. Run appropriate component/browser/static/build checks and a real local coach/athlete booking rehearsal.

## Acceptance criteria

- [ ] AC1: The coach opens the original booking and creates/revises its clearly athlete-visible shared plan without adding per-request chat.
- [ ] AC2: Shared author-owned entries and separately labelled coach-private entries have precise save/edit feedback and no ambiguous visibility toggle.
- [ ] AC3: Cancelled/block-restricted/shared status, original-history/rebooking and stale/unavailable behavior preserve truthful state and authorized drafts.
- [ ] AC4: Keyboard and desktop/mobile flows preserve context, visible controls and separate private visibility copy.
- [ ] AC5: Real local and component/browser/projection checks prove only owned booking content loads and no private metadata reaches shared surfaces.

## Validation plan

Exercise real local original-booking plan/shared/private create/edit, status/block restrictions, stale/error recovery and original history at desktop and 375/430 px with keyboard use. Run focused component/browser tests and npm run lint, npm run typecheck, npm run format:check and npm run build. Inspect athlete/shared serialized output, not only DOM hiding.

## Implementation record

Pending runtime implementation. DEV0182 adopted the detailed contract and updated this plan on 2026-10-16; none of this ticket's runtime acceptance criteria are claimed passed.

### Changes and rationale

No owned implementation yet. The planning revision removes duplicated request chat and keeps original-booking content separate from the ongoing inbox.

### Affected files

Pending implementation; record actual files and roles when work starts.

### Decisions and deviations

- 2026-10-15: Reconcile the active scope with M8/DEV0243. General conversations/request cards move to independent COR0022; original-booking plans/notes remain here. Shared writes must respect M8 block windows, while retained reads and coach-private authority remain separate.

Dated earlier planning history (superseded where it proposes request chat):

- 2026-10-14: Updated planning vocabulary to athlete and made connection-independent session authorization explicit; existing filenames/IDs and earlier history remain intact. Session-content contract adoption still belongs to DEV0182.

- 2026-10-16: DEV0182 adopted section 17, recorded the delivered session-message baseline and assigned shared note UI to DEV0184 before DEV0185 integration. No runtime edit was made under this planning update.

### Contracts, configuration, and operations

Consumes DEV0183 coach actions/projections and adopted M8 restrictions. No new environment value/provider/migration is planned.

## Validation results

Runtime acceptance criteria are not run. DEV0182 records documentation checks for the 2026-10-16 contract/ownership update; DEV0243 retains the earlier boundary-amendment evidence. No browser/database implementation evidence is claimed for this ticket.

## Risks, limitations, and follow-ups

Private data must be excluded by database/server projections, not browser hiding. Notes may be sensitive and must not enter logs, analytics or unrelated responses. Original IDs, author ownership and optimistic versions prevent content transfer/loss. Note/M8 integration needs combined evidence when both are delivered; each coordination retains its own completion boundary.

## Completion and review references

- Completed: Not completed.
- Commit: Earlier planning record retained in Git history; this boundary revision belongs to DEV0243, with no owned runtime commit yet.
- Review: Planning self-review only; no independent implementation review.
- Deployment or release: Not implemented or deployed.
