# Ticket DEV0240: Add group-event discovery and joining

- Status: Completed
- Created: 2026-10-15
- Last updated: 2026-10-16
- Milestone: M7 — Group training and events
- Coordination: [COR0021 — Group training and events](../../current/organisatory/COR0021-group-training-and-events.md)
- Related records: contract owner [DEV0233](../organisatory/DEV0233-define-group-training-and-events-growth-scope.md); peer dependencies and independent visual baselines are listed below and in COR0021

## Objective and context

Add public `/events` and `/events/[slug]`, a public Events navigation destination, and My sessions → Group sessions at `/sessions/groups`. Show authoritative upcoming cards/detail, discipline/place filtering, chronological ordering, aggregate capacity, explicit Free/pay-at-session price, direct joining and own withdrawal/history. Implement against the [group contract](../../../docs/mvp-spec.md#15-group-training-and-events), [M7 milestone](../../../docs/mvp-spec.md#12-delivery-milestones) and [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix). The user confirmed free/pay-at-session pricing and direct joining with manual coach confirmation. Adopted implementation defaults are labelled separately in the contract.

## Scope and non-goals

- In scope: Add public `/events` and `/events/[slug]`, a public Events navigation destination, and My sessions → Group sessions at `/sessions/groups`. Show authoritative upcoming cards/detail, discipline/place filtering, chronological ordering, aggregate capacity, explicit Free/pay-at-session price, direct joining and own withdrawal/history.
- Out of scope: Coach event management, backend/schema, Home/Explore redesign or their coach filters/maps, event map/radius/ranking/price filters, public rosters, private avatars, payments, follows/messages and connection eligibility changes.

## Expected behavior and edge cases

Guests can discover/share events without login. Joining uses the verified email account, reserves one seat and explicitly says the coach has not confirmed while pending. Only own registrations appear privately; other identities are never public. Full, past-deadline, own-coach, hidden/suspended, retry, sign-in-return, unavailable and cancelled states are truthful. Confirmed sessions remain confirmed after withdrawals. Existing private My sessions and Home/Explore filter/map behavior remain intact.

## Assumptions, decisions, and dependencies

DEV0237, DEV0238 and DEV0236 are completed. Implement independently of concurrent DEV0252 availability, DEV0249 seed/baseline and booking/roster work. Shared edits are limited to public Events navigation and one My sessions Group sessions link; preserve private booking components and all unrelated changes. DEV0235's standalone preview checks do not gate this ticket.

This is one peer implementation boundary. The user authorized starting on 2026-10-16. Thin typed server loaders/actions may adapt existing guarded group services/repositories for the interface; no SQL, schema or scheduling/registration business rule changes belong here.

## Implementation plan

Adopted interface defaults, 2026-10-16: dedicated Events styles/components; native GET discipline/place filters with validated stable page cursors; public list/detail plus authenticated own registration history; explicit join/withdraw forms with actor-bound submission/attempt IDs and progressive enhancement. Each submission uses POST/redirect/GET to reread the original session after the committed result; success comes from saved registration state, never a URL success flag. Reuse the existing 20-item backend pages and original frozen venue/time/price/status. Invalid filters/cursors show a recoverable error rather than silently becoming another search. Failed reads never masquerade as empty inventory. Join retries preserve a registration identity; stale withdrawals target only their original attempt. Public cards expose aggregate capacity, never participant records. Keep the existing mobile private-navigation destinations bounded; Events is available in public navigation and the authenticated sidebar.

1. Inspect bundled Next.js guidance and delivered shared discovery components; build dedicated event routes/modules with native GET discipline/place filters and bounded chronological results.
2. Add truthful cards/detail and login-return/direct-join/withdraw controls against guarded services; keep payment and participant identity boundaries visible.
3. Add a distinct authenticated group destination linked from My sessions and public Events navigation without inserting group results into Home/Explore.
4. Add a loopback-only focused rehearsal runner using a disposable database, a temporary app-source snapshot and exact tagged temporary Auth accounts. It must not reset/migrate/seed the shared development database; cleanup owns only its generated database, snapshot and accounts. Run guest/athlete/coach-as-athlete privacy, recovery, URL/history, no-JavaScript and responsive keyboard regressions, including retained DEV0236 flows.

## Acceptance criteria

- [x] AC1: Public event navigation, filtered upcoming list/shareable detail and Free/pay-at-session wording use real published session data without fabricated inventory.
- [x] AC2: Verified eligible athletes join directly once; reservation and manual session confirmation are visibly distinct, and full/deadline/self/unavailable cases recover honestly.
- [x] AC3: Own group registrations/withdrawal/history are private, other participant identities stay absent, and terminal/confirmed states remain stable.
- [x] AC4: Mobile/desktop, keyboard, native GET/auth-return/history and Home/Explore/private-session regressions plus applicable static/build checks pass.

## Validation plan

Use isolated real local group/identity fixtures and a configuration-free unavailable preview; do not reset, migrate or seed the shared development database during concurrent work. Test 375/430/768/1440 widths, guest/auth returns, GET filtering and JavaScript-free recovery, full/duplicate/deadline/terminal flows, keyboard/focus and public/actor privacy. Run focused render/browser tests, `npm test`, lint/type/format/build and affected document checks. DEV0241 owns final combined rehearsal.

## Implementation record

Completed and self-reviewed on 2026-10-16 against AC1–AC4. The public/athlete interface is implemented and locally validated; hosted deployment remains separate.

### Changes and rationale

Previously M7 group data had no public or athlete interface. Added public Events list/detail and private Group sessions history against the delivered scheduling authority. Native GET filters and stable 20-item pages retain discipline/place and complete history. Explicit Reserve a seat/Withdraw my seat forms keep direct registration distinct from coach confirmation, retain exact attempt IDs for retries and reject a form from a different signed-in account. Empty, unavailable, full, expired and cancelled outcomes are presented from authoritative state; public pages expose aggregate counts only. Home/Explore coach inventory and private booking components remain separate.

### Affected files

- [Events list](../../../src/app/events/page.tsx), [detail](../../../src/app/events/[slug]/page.tsx) and [Group sessions](../../../src/app/sessions/groups/page.tsx): thin public/private routes, real data, original links and bounded paging.
- [Event contracts](../../../src/features/events/event-contract.ts), [presentation](../../../src/features/events/event-ui.tsx), [registration form](../../../src/features/events/participation-form.tsx) and [styles](../../../src/features/events/events.css): validated URL/form inputs, truthful price/status/date labels, shared terms and responsive explicit actions.
- [Action routing](../../../src/app/events/actions.ts), [submission adapter](../../../src/server/group-sessions/participation-action.ts) and [athlete interface adapter](../../../src/server/group-sessions/athlete-service.ts): existing exact-actor PostgreSQL authority, actor-change rejection, typed results and affected-route refresh. They add no SQL/business-rule authority.
- [Recovery component](../../../src/features/events/event-error.tsx), [Events boundary](../../../src/app/events/error.tsx) and [history boundary](../../../src/app/sessions/groups/error.tsx): bounded route-error recovery using the installed Next.js `retry` API, without asserting a saved outcome or showing exception details.
- [Shell](../../../src/components/shell.tsx) and [My sessions](../../../src/app/sessions/page.tsx): public/desktop Events navigation and one separate group-history link outside the existing private-session tab row. Mobile private navigation stays bounded.
- [Contract/render tests](../../../tests/events.test.ts), [action tests](../../../tests/server/event-actions.test.ts), [navigation tests](../../../tests/shell-navigation.test.ts) and [retirement guard](../../../tests/boundaries.test.ts): invalid/ambiguous inputs, precise cursors, literal text, privacy and retained navigation. The retirement guard now allows adopted nonfinancial Events while continuing to reject legacy funding/wallet modules.
- [Local rehearsal](../../../scripts/rehearse-local-group-discovery.ts), [package command](../../../package.json) and [README](../../../README.md): repeatable real-actor browser proof using an owned disposable database/app snapshot and exact temporary Auth accounts.
- This record, [COR0021](../../current/organisatory/COR0021-group-training-and-events.md), [index](../../README.md) and [specification delivery status](../../../docs/mvp-spec.md#15-group-training-and-events): owned scope, evidence and truthful delivery boundaries.

### Decisions and deviations

- 2026-10-15: Created as a peer under COR0021.
- 2026-10-16: Use dedicated event modules and CSS, native GET filters and progressively enhanced actions; no new provider or dependency. Add only the group link to existing My sessions, outside its tab row to avoid crowding mobile controls.
- 2026-10-16: Bind mutations to the original rendered actor scope and registration attempt; server authorization remains authoritative. Guest sign-in returns to the original detail and never joins automatically. Show an existing ended registration as recovered history rather than a new reservation.
- 2026-10-16: Concurrent database/calendar work requires isolated validation. The rehearsal snapshots app sources and replays committed migrations/seed only into a generated disposable database. It skips an availability migration when that migration is already committed, avoiding duplicate application after the concurrent DEV0252 commit. Only exact tagged Auth accounts are created/removed in the shared local Auth service.
- 2026-10-16: Browser proof exposed a race between transient action-hook results and refreshed registration props. Replace hook-result-dependent submissions with POST/redirect/GET and authoritative detail readback for both JavaScript and native forms. Fixed issue codes carry only bounded failure copy, never success claims or registration IDs in URLs. On an uncertain outcome, reread before submitting again; the existing one-active-seat and exact-attempt authority recovers duplicate requests even if a new page issued a new nonce.
- 2026-10-16: Final validation also uses an exact DEV0240 overlay on committed `e372fe8` because concurrent DEV0253/DEV0266 work can temporarily break shared-worktree lint/types. Record isolated passes and shared-worktree failures separately; preserve the independent edits. This is validation isolation, not a product or dependency change.
- 2026-10-16: Adapt the old route-retirement assertion to the adopted M7 Events surface. Preserve legacy funding/blockchain/social exclusions; no retired implementation is restored.

- 2026-10-16 pre-commit calendar overlap review: DEV0253 is checkpointed at `1db71b8`; current DEV0254 owns `/coach`, coach calendar components/services and the additive `app.owned_coach_calendar` read function. DEV0240 uses separate public/athlete routes and existing group registration authority, adds no migration and imports no calendar modules. Both consume existing group records without duplicating lifecycle authority. Shared README/specification/index/package entries are staged selectively; unfinished calendar, notes, invitations and hosted-environment work are excluded. DEV0239 remains the owner group-management/detail dependency for DEV0254, not a missing DEV0240 deliverable.

### Contracts, configuration, and operations

No schema, migration, business-rule, dependency, provider or environment-variable contract changed. UI adapters reuse existing group functions and the existing identity/session boundary. New routes and thin Server Actions are the delivered interface contract. `npm run test:group-discovery` requires Docker, repository local Supabase Auth/PostgreSQL with its prepared restricted runtime login (`npm run db:runtime`), Node 24 and Chrome; it owns localhost:3113 only while running and cleans up its database, source snapshot and temporary accounts. No shared-database reset/migration/seed, hosted operation or new secret is required. Removing the new routes/navigation reverts this UI without deleting retained group records.

## Validation results

2026-10-16, Node.js 24.21.0, installed Next.js 16.3.8, loopback Supabase and real headless Chrome:

- `npm run test:group-discovery`: passed the complete real multi-account browser flow against an owned disposable database and app snapshot. It replayed the two committed baseline/effective-availability migrations and current seed, used guarded draft/publication/join/decision operations, then removed its exact temporary Auth accounts, app and database. No shared/hosted database reset, migration or seed was performed.
- Browser proof: real 20-item public pagination, native discipline/place filtering, empty/invalid searches, URL/back recovery, literal script-like description text, guest sign-in return without joining; Free/€15.50 pay-at-session terms; reserve/refresh/manual coach confirmation/withdraw/rejoin; stale old withdrawal preserving the replacement attempt; full/own-coach rejection; separate own/other registration histories and cancelled history; old-account form rejection; an approved coach joining as an athlete; temporary read/write failure with truthful unavailable state and duplicate retry recovery; missed-deadline reconciliation; more than 20 retained attempts; native join/withdraw with JavaScript disabled; hidden/suspended participant history/withdrawal; account-revocation denial and Home/Explore/private-session link regressions. No unexpected browser errors were observed.
- Desktop/mobile/keyboard: 375, 430, 768 and 1440 pixel widths passed overflow checks on list/detail/history. Skip-link and main-content keyboard focus passed; screenshots were captured under `test-results/group-discovery-rehearsal/`. Manually inspected `events-viewport-375.png`, `detail-viewport-375.png` and `events-viewport-1440.png`: navigation, search controls, status/capacity/price and the registration panel are readable without clipping.
- Final application/static validation uses the committed `e372fe8` foundation plus exactly DEV0240's owned source/test/script files, shared shell/My sessions/navigation-test hunks and its one package-script entry. `/tmp/dev0240-validation-snapshot.py` created `/private/tmp/dev0240-validation-3b8jrie0`; no unrelated availability-editor or hosted-environment changes were included. `npm test`: **165 application and 17 server tests passed**. `npm run lint`, `npm run typecheck` and `npm run format:check`: passed in that snapshot.
- Production build: the earlier configuration-free default `env DATABASE_URL= NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= NEXT_PUBLIC_SITE_URL= npm run build` passed. The first sandboxed attempt stalled on local worker permissions and was stopped; the permitted run passed. Final snapshot command is `env DATABASE_URL= NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= NEXT_PUBLIC_SITE_URL= NEXT_PUBLIC_GEOAPIFY_API_KEY= npm run build -- --webpack`; Webpack supports the temporary dependency symlink. It passed with all new Events/Group sessions routes present. The scoped snapshot uses the same pinned application dependencies as the working repository.
- Shared-worktree results are distinct: earlier full tests/lint/types/format/build passed; later `npm run typecheck`/`npm run lint` encountered in-progress DEV0253 errors in `src/features/coaches/availability-editor.tsx`, followed by passing reruns after those independent edits changed. A subsequent shared type run encountered DEV0266's incomplete `ProcessEnv.NODE_ENV` test fixtures in `tests/hosted-environment.test.ts`. Those files were preserved; no claim is made that the concurrently changing whole worktree is validated by the isolated pass.
- Initial owned failures were resolved before the passing browser run: the old runtime-retirement test prohibited adopted Events; the rehearsal reapplied a newly committed availability migration; driver waits/selectors depended on navigation/transient text; and action-hook/page readback could race. The final flow uses authoritative POST/redirect/GET, exact attempts and fixed failure-only issue codes. A temporary diagnostic that waited for a streaming response body was removed; its interrupted run is not counted as evidence.
- Final repeat of `npm run test:group-discovery > /tmp/dev0240-browser-final.log 2>&1`: passed on the final source with native filter/reserve/withdraw buttons activated using Enter, plus all prior multi-account/privacy/recovery/viewport cases and successful exact-fixture cleanup.
- `python3 /tmp/dev0240-check-docs.py`, targeted installed Prettier for the five affected Markdown files, and `git diff --check`: passed after archival: five documents, 311 local links/anchors, 179 unique record IDs, six reciprocal COR0021 members and consistent DEV0240 lifecycle/index/delivery status. The exact formatting command was `npx --no-install prettier --check README.md docs/mvp-spec.md tickets/README.md tickets/current/organisatory/COR0021-group-training-and-events.md tickets/archive/frontend/DEV0240-add-group-event-discovery-and-joining.md`.
- User-authorized pre-commit overlap check, 2026-10-16: created `/private/tmp/dev0240-commit-pnl3riwl` from current committed DEV0253 checkpoint `1db71b8` plus only DEV0240 source and selectively constructed README/specification/index/package changes. Owned product/test/rehearsal source was byte-identical to the previously browser-validated snapshot. In this commit snapshot, `npm test` passed **171 application and 18 server tests**, `npm run lint` and `npm run typecheck` passed, and installed Prettier passed the six changed Markdown/package files. `python3 /tmp/dev0240-check-docs.py` passed five documents, 299 local links/anchors, 175 unique records and six reciprocal COR0021 members. No concurrent calendar migration or hosted/notes/invitation source was included; the prior browser/build proof remains the evidence for unchanged owned product code.
- SQL schema/constraint tests are not rerun as a new migration gate: DEV0240 changes no SQL and consumes the completed DEV0237/DEV0238 authority. Their database proofs remain their own evidence; this browser rehearsal exercises the actual local functions. Coach UI, combined M7 rehearsal and hosted deployment remain separately owned by DEV0239/DEV0241 and operational work.

| Criterion | Evidence                                                                                                                                                                | Result |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Real public inventory/filter/paging/shareable detail, Free/pay-at-session wording and navigation in Chrome; bounded render/URL tests.                                   | Passed |
| AC2       | Actual reserve/confirm/withdraw/rejoin, duplicate/stale recovery, full/owner/coach-as-athlete, account-switch and sign-in-return checks.                                | Passed |
| AC3       | Exact own-versus-other history, terminal/withdrawn attempts across pages, hidden/suspended recovery and account-revocation denial.                                      | Passed |
| AC4       | Real native/no-JavaScript, keyboard and four-width checks, inspected screenshots, retained coach/private navigation, and scoped full application/static/build evidence. | Passed |

## Risks, limitations, and follow-ups

DEV0237, DEV0238 and DEV0236 are completed. Implement independently of concurrent DEV0252 availability, DEV0249 seed/baseline and booking/roster work. Shared edits are limited to public Events navigation and one My sessions Group sessions link; preserve private booking components and all unrelated changes. DEV0235's standalone preview checks do not gate this ticket. Free/pay-at-session registration proves neither payment nor attendance. The full M7 coordinator remains open for DEV0239/DEV0241; neither is an unmet DEV0240 acceptance criterion. No notification delivery, payment verification, attendance claim or new group-to-connection/notes permission is added.

## Completion and review references

- Completed: 2026-10-16 — public/athlete Events and Group sessions interface; all owned acceptance criteria passed.
- Commit: Included with the implementation in the user-authorized `[DEV0240] Add public group events and athlete registration` commit.
- Review: Source/scope self-review, real multi-account browser checks and desktop/mobile screenshot inspection completed; no independent review claimed.
- Deployment or release: Local implementation/validation only. No hosted release; coach management remains DEV0239 and final combined M7 rehearsal remains DEV0241.
