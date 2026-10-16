# Ticket DEV0239: Add coach group-session management

- Status: In progress
- Created: 2026-10-15
- Last updated: 2026-10-16
- Milestone: M7 — Group training and events
- Coordination: [COR0021 — Group training and events](../organisatory/COR0021-group-training-and-events.md)
- Related records: contract owner [DEV0233](../../archive/organisatory/DEV0233-define-group-training-and-events-growth-scope.md); peer dependencies and independent visual baselines are listed below and in COR0021

## Objective and context

Add Coach workspace → Events at `/coach/events`: owner drafts, actual venue/date/start/end/deadline, minimum/maximum, Free or EUR per-person pay-at-session price, explicit publication review, private roster, manual confirmation and cancellation. Implement against the [group contract](../../../docs/mvp-spec.md#15-group-training-and-events), [M7 milestone](../../../docs/mvp-spec.md#12-delivery-milestones) and [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix). The user confirmed free/pay-at-session pricing and direct joining with manual coach confirmation. Adopted implementation defaults are labelled separately in the contract.

## Scope and non-goals

- In scope: Add Coach workspace → Events at `/coach/events`: owner drafts, actual venue/date/start/end/deadline, minimum/maximum, Free or EUR per-person pay-at-session price, explicit publication review, private roster, manual confirmation and cancellation.
- Out of scope: Group backend/migrations, public Events/athlete UI, changing Home/Explore or private booking policy, new calendar overlay, notifications, payments, waitlists and private avatar exposure.

## Expected behavior and edge cases

The owner sees clear Draft, Waiting for coach confirmation, Confirmed, Cancelled, Not confirmed and elapsed presentation. Publishing freezes terms and reports scheduling conflicts with recovery to the existing Bookings/Schedule tools. Reaching the minimum never confirms automatically. Confirm requires minimum and deadline eligibility; retry/stale/unauthorized/expired actions show the winning state. Suspended coaches may read/cancel existing sessions but cannot publish or confirm.

## Assumptions, decisions, and dependencies

DEV0237 and DEV0238 completed with stable guarded services. Preserve independent DEV0236 styling work; this ticket owns coach event navigation and screens only.

This is one peer implementation boundary. The user authorized implementation on 2026-10-16 after the DEV0240 commit and an overlap review. DEV0254 is now checkpointed at `e16c06f`; DEV0255 public private-date work remains independent. Keep owner routes/modules separate from their source files. Reuse existing guarded group commands; no SQL, migration, hosted configuration or retained local infrastructure change belongs here.

## Implementation plan

Adopted interface defaults before implementation, 2026-10-16: `/coach/events` lists 20 owned records per existing cursor page; `/coach/events/new` creates a stable draft identity; `/coach/events/[id]` is the original owner review/roster/decision destination, with `/edit` for drafts. Saved draft detail is the explicit publication review; publication requires an acknowledgement of frozen terms. Cancellation/deletion likewise require explicit acknowledgement. Save forms retain authorized input on validation/conflict; successful commands redirect to freshly read original detail and never claim success from a URL flag. Bind every mutation to the rendered account/dataset scope, validate exact IDs/revisions, reject ambiguous/nonexistent Berlin local times and accept exact EUR cents only. Owner detail is authorized using the owner-only roster command before exposing any session data. Reuse shared event terms/status presentation, not public rosters or athlete media. Add Events to the existing coach workspace navigation without editing `/coach` or calendar source; DEV0254 retains its calendar-link integration.

Validation environment change: DEV0270 intentionally removed local Supabase containers/images after hosted-dev adoption. Do not recreate that stack, apply pending migrations or mutate hosted data to make a check pass. Implement a maintained isolated browser fixture rehearsal that exercises actual UI/actions through explicit narrow service fixtures, plus real service-boundary rejection tests and static/build checks. Required live SQL/Auth multi-account proof remains pending until an authorized test environment is available; fixture evidence must not be labelled real persistence. Keep the ticket In progress when that required evidence remains missing.

1. Inspect installed Next.js documentation and current capability-aware coach shell; add thin routes and event feature modules using the stable services.
2. Build accessible draft fields and a review/publish flow with immutable published terms, actual venue, truthful payment wording and bounded conflict recovery.
3. Build paginated private roster/counts and explicit manual confirm/cancel controls; keep private athlete media/email absent.
4. Verify mobile/desktop, keyboard, no-JavaScript mutation recovery and meaningful service-backed browser flows; record exact evidence.

## Acceptance criteria

- [ ] AC1: Approved/demo owners can draft/review/publish only their valid sessions; applicant/unrelated actors cannot operate them.
- [ ] AC2: Free/paid-at-session terms, location/date/deadline/minimum/capacity and frozen published terms are clear at review and afterward.
- [ ] AC3: Roster privacy, manual minimum/deadline decisions, cancel/retry/stale/conflict/unavailable/suspended states reflect actual backend results.
- [ ] AC4: Representative mobile/desktop and keyboard flows, meaningful browser tests and applicable test/lint/type/format/build checks pass.

## Validation plan

Use real local approved/demo owner and unrelated/applicant/athlete fixtures. Verify 375/430/768/1440 widths, keyboard/focus, invalid fields, publication conflicts, stale decision/deadline and unavailable states. Run focused component/browser tests, `npm test`, lint/type/format/build and affected document checks. DEV0241 owns final cross-interface rehearsal.

## Implementation record

Runtime interface implemented on 2026-10-16. Keep **In progress**: required live authenticated database/browser proof is pending after the user-authorized retirement of the local Supabase services. No deployment or independent review is claimed.

### Changes and rationale

Added dedicated owner Events routes, preserving the independently developed coach calendar and public private-date work. Coaches can save/edit/delete stable private drafts, review frozen terms before publication, page through owned sessions and participant attempts, and explicitly confirm or cancel eligible published sessions. Registration counts never auto-confirm a session. Only fresh server reads describe success; issue URLs contain fixed failure codes, never success claims. Existing group functions remain the only scheduling/lifecycle authority.

Draft input uses Berlin local times with explicit rejection of daylight-saving gaps/folds, exact EUR cents, owned active venues and existing discipline/capacity/length bounds. Stable draft IDs and optimistic revisions preserve retry identity. Failed saves retain authorized proposed fields and link to the original saved draft; account/permission changes clear the editor. Publication, cancellation and deletion require explicit acknowledgements. Published terms cannot be edited.

The owner-only roster command runs before the detail read in one authorized transaction, so public access to a session can never grant owner detail/roster access. Every mutation checks the rendered account/dataset scope against the verified current actor. Approved/demo coaches can draft; publication and confirmation additionally require a visible profile. Suspended owners retain their own history and eligible cancellation. Participant rows contain names/initials and retained status, with no email, private photo, connection or note shortcut.

### Affected files

- [Owned list](../../../src/app/coach/events/page.tsx), [new draft](../../../src/app/coach/events/new/page.tsx), [owner detail](../../../src/app/coach/events/[id]/page.tsx), [edit draft](../../../src/app/coach/events/[id]/edit/page.tsx) and [error boundary](../../../src/app/coach/events/error.tsx): canonical thin routes, first/next pages, sign-in return, current-state decisions and bounded retry messages. Draft creation uses a stable `draftId` URL; roster/list cursors retain database microseconds.
- [Owner service](../../../src/server/group-sessions/owner-service.ts): narrow existing-command adapters, fresh coach access, exact actor scope, owner-first roster/detail reads and real repository conflict translation. No new SQL or lifecycle rule.
- [Server Actions](../../../src/app/coach/events/actions.ts): validated explicit commands, current-state revalidation and POST/redirect/GET after success. Failed draft saves return bounded field state; successful operations never rely on a transient action message.
- [Contracts](../../../src/features/coach-events/contract.ts), [forms](../../../src/features/coach-events/forms.tsx), [account guard](../../../src/features/coach-events/access.tsx), [screens](../../../src/features/coach-events/screens.tsx) and [styles](../../../src/features/coach-events/coach-events.css): local-time/currency parsing, field retention, scoped mutation metadata, client account-change hiding, truthful owner terms/actions and responsive layout.
- [Coach navigation](../../../src/features/coaches/coach-workspace-navigation.tsx) and its [regression test](../../../tests/coach-schedule.test.ts): add Events after Bookings while preserving the original Profile/Schedule/Bookings links. No `/coach` page, calendar projection/component/action or public private-date source is edited by DEV0239.
- [Shared event terms](../../../src/features/events/event-ui.tsx) and [presentation regression](../../../tests/events.test.ts): reuse actual terms once, show an overnight end date, retain payment wording and avoid inviting confirmation on a closed session. [Retirement guard](../../../tests/boundaries.test.ts) permits adopted nonfinancial coach Events while retaining retired funding/blockchain/social exclusions.
- [Contract tests](../../../tests/coach-events.test.ts) and [server rejection tests](../../../tests/server/coach-event-actions.test.ts): exact cents, Berlin DST, original identity/revision, ambiguous/forged fields, acknowledgements, precise paging and denial of malformed/athlete commands before authorization/database entry.
- [Maintained browser runner](../../../scripts/rehearse-coach-events-ui.mjs), [explicit account fixture](../../../tests/fixtures/coach-events-auth.ts), [explicit owner-service fixture](../../../tests/fixtures/coach-events-owner-service.ts), [package command](../../../package.json) and [README](../../../README.md): isolated UI/action proof with visible fixture labelling, no environment files, no Docker/database creation and no hosted calls.

### Decisions and deviations

- 2026-10-15: Created as one peer under COR0021. DEV0237/DEV0238 own backend authority; DEV0240 owns public/athlete screens; DEV0241 owns combined proof.
- 2026-10-16: User authorized implementation after DEV0240 commit `73364d5` and the overlap review. DEV0254 checkpoint `e16c06f` makes existing coach navigation available; add only its Events destination. DEV0255 public-date work remains independent. Calendar-to-owner-detail wiring remains DEV0254's integration; this ticket supplies `/coach/events/[id]`.
- 2026-10-16: Adopt stable `/new?draftId=UUID` creation, `/[id]` review/roster/decisions and `/[id]/edit` for private drafts. Publication is a distinct reviewed operation; creating/saving a draft never reserves time. No provider/dependency or scheduling-state extension.
- 2026-10-16: DEV0270 intentionally removed local Supabase containers/images. Do not recreate that stack or change hosted/shared data for a test. Replace the planned local browser environment with an explicitly labelled fixture checkpoint, retaining live SQL/Auth proof as **not run**, not waived. The record stays current and unfinished.
- 2026-10-16: Self-review found duplicate capacity/deadline/payment/discipline copy around the reused EventTerms component. Removed it; made shared minimum wording reflect open versus draft/closed state and showed the actual end date across Berlin date boundaries. This is a presentation correction; no lifecycle or pricing authority changed.
- Implementation failures were resolved before final checking: a TypeScript extraction omitted grouped confirm/cancel command variants; it is now an explicit narrow owner mutation union. Browser field selection exposed helper text being included in accessible names; concise names now reference separate helper descriptions. These failed attempts are not counted as passing validation.

### Contracts, configuration, and operations

Adds owner routes, a thin Server Action contract and `npm run test:coach-events-ui`. No schema, migration, runtime environment variable, dependency, payment, notification, connection or note contract changes. Existing group database functions and immutable venue/price/time/revision rules remain authoritative. `DEV0239_FIXTURE_STORE` is internal to the temporary rehearsal process only; it is not an application/deployment setting. The runner requires Node 24, installed Chrome and free loopback port 3139; it archives committed HEAD, overlays only DEV0239 sources, replaces narrow account/service boundaries inside that temporary snapshot, and removes its own process/source/fixture file afterward. Screenshots are ignored under `test-results/dev0239-ui/`.

Rollback is removal of the new routes/modules and Events navigation; retained group rows are not deleted. No secret/environment file was read/copied/printed, no Auth email was sent and no hosted/development database was reset, migrated or seeded. Removing local services under DEV0270 remains effective.

## Validation results

2026-10-16, Node 24.21.0 and installed Next.js 16.3.8. Relevant bundled forms, page/search-parameter, redirect and error-boundary documentation was inspected; the error boundary uses the installed `retry` API.

- `npm run test:coach-events-ui > /tmp/dev0239-ui-final.log 2>&1`: passed on the final deduplicated presentation, including native validation/deletion/cancellation and successful owned-process/snapshot cleanup. It executes the actual routes, forms, Server Actions, redirects, revalidation and client account guard with explicit fixture account/service boundaries. It proves UI behavior, **not real Supabase/PostgreSQL authorization or persistence**.
- Observed fixture cases: 20-item owner inventory/paging; invalid minimum with retained fields; exact EUR 15.50 and Free/Berlin terms; draft save/edit/review/publication; save-conflict field retention; schedule/venue publication conflicts; frozen published edits; explicit confirmation; retained confirmation after withdrawals; 50+1 private roster pages without photos/email; suspended cancellation and terminal roster; minimum/deadline/other-owner/applicant denial; unavailable distinct from empty; old-account submission rejection and editor clearing; acknowledged deletion; native no-JavaScript validation retention, draft, review, publication and cancellation using Enter.
- Desktop/mobile/keyboard: 375, 430, 768 and 1440 widths for owner list/new/detail had no horizontal overflow; keyboard skip-link focused main content. Screenshot inspection covered the desktop draft and 375/1440 detail views; final deduplicated 375/1440 detail screenshots were also inspected: terms appear once, closed sessions offer no confirmation invitation, and navigation/roster stay readable without horizontal clipping. Fixtures are visibly labelled.
- Scoped full checks use `/private/tmp/dev0239-validation-o658mon5`, an exact overlay of DEV0239 files on committed `e16c06f`. No concurrent DEV0255 public-schedule source or ignored environment file is included. On the final source, `npm test` passed **193 application and 20 server tests**; `npm run lint` passed with no warnings, `npm run typecheck` and `npm run format:check` passed, and the configuration-free Webpack production build passed with `/coach/events`, `/coach/events/new`, `/coach/events/[id]` and `/coach/events/[id]/edit` present. A temporary earlier lint warning about relative location navigation was resolved with a current-document reload before this final pass.
- Production command: `env DATABASE_URL= NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= NEXT_PUBLIC_SITE_URL= NEXT_PUBLIC_GEOAPIFY_API_KEY= npm run build -- --webpack`. The temporary snapshot uses the pinned installed dependencies via a symlink; Webpack supports that layout. The build includes all new coach Events routes without database/Auth configuration.
- Documentation/link/index/ownership review uses `python3 /tmp/dev0239-check-docs.py`; targeted installed Prettier checks the README/specification/index/COR0021/current DEV0239 record, and `git diff --check` checks whitespace. Passed after the final record update: five documents, 312 local links/anchors, 181 unique records, six reciprocal COR0021 members and consistent In progress/index/remaining-live-proof status. The exact formatting command is `npx --no-install prettier --check README.md docs/mvp-spec.md tickets/README.md tickets/current/organisatory/COR0021-group-training-and-events.md tickets/current/frontend/DEV0239-add-coach-group-session-management.md`. Whitespace checks also passed.
- Pre-commit scope check, 2026-10-16: an exact DEV0239 commit candidate on `e16c06f` retained byte-identical validated application/test/rehearsal/package files and only the owned README/specification/index/coordination/ticket changes. Its documentation check passed five documents, 307 local links/anchors, 180 unique committed records and six reciprocal members. Targeted Prettier and whitespace checks passed. No application tests were repeated solely for committing unchanged source; their results above remain the validation evidence. Independent public-schedule, note/invitation and calendar/hosted-operation changes are excluded.
- **Not run — required live validation:** real approved/demo owner and unrelated/applicant/athlete Supabase sessions; save/reload persistence, current venue/approval races, shared private-time publication conflict, actual minimum/deadline/confirm-versus-withdraw/cancel recovery and real owner/other-account roster privacy. Prior DEV0237/DEV0238 backend evidence is a prerequisite, not a substitute for this ticket's service-backed UI proof. DEV0241 also remains a separate combined gate. No new migration/constraint suite is required for DEV0239 itself because it changes no SQL.

| Criterion | Evidence                                                                                                                                       | Result  |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| AC1       | Owner routes/actions, account-bound commands and fixture owner/applicant/other-account checks; actual authenticated persistence not run.       | Partial |
| AC2       | Exact cents/DST/input tests, actual form/review rendering, Free/paid/frozen-term fixture flows; real saved terms still need live verification. | Partial |
| AC3       | Fixture roster/decision/conflict/deadline/suspension/retry cases plus server malformed-command rejection; actual authority/races not run.      | Partial |
| AC4       | Fixture desktop/mobile/native/keyboard and scoped application/static/build checks; required live browser flow not run.                         | Partial |

## Risks, limitations, and follow-ups

Required live proof is the remaining DEV0239 acceptance work, not delegated to DEV0241. Next action: prepare an explicitly approved tagged hosted-dev fixture run or another dedicated authorized Auth/PostgreSQL test environment without restoring retired shared Docker services, then run and record the live cases above, exact cleanup and final regressions. Only then check AC1–AC4, archive this record and claim completion. The current runner intentionally cannot stand in for those checks.

DEV0254 can integrate its original owner group links with `/coach/events/[id]`; its own SQL/Auth/detail-flow acceptance remains in its ticket. No calendar implementation was overwritten. DEV0255 public private-date work, calendar database work, session-note/invitation planning and hosted infrastructure edits remain outside this change. Free/pay-at-session registration proves neither payment nor attendance.

## Completion and review references

- Completed: Not completed — runtime interface exists; required live SQL/Auth/browser evidence remains pending.
- Commit: Included with its implementation and validation record in the user-authorized `[DEV0239] Add coach group-session management checkpoint` commit. Status remains In progress; committing does not satisfy the pending live criteria.
- Review: Source/scope self-review and fixture browser/screenshot inspection; no independent or live authorization review claimed.
- Deployment or release: None. No hosted write, local stack recreation or pending migration application.
