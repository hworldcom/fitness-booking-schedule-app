# Ticket DEV0222: Add coach My athletes

- Status: Completed
- Created: 2026-10-14
- Last updated: 2026-10-14
- Milestone: M6 — Athlete terminology and coach–athlete connections
- Coordination: [COR0020 — Athlete terminology and coach–athlete connections](../../current/organisatory/COR0020-athlete-terminology-and-connections.md)
- Related records: independent conflict-recovery dependency [DEV0234](../backend/DEV0234-preserve-connection-conflict-results.md); contract dependency [DEV0219 — Adopt athlete terminology and connection contract](../organisatory/DEV0219-adopt-athlete-connections-contract.md); backend dependency [DEV0221](../backend/DEV0221-persist-coach-athlete-connections.md); terminology dependency [DEV0220](DEV0220-use-athlete-website-terminology.md); athlete peer [DEV0223](../../current/frontend/DEV0223-add-athlete-my-coaches.md)

## Objective and context

Give coaches an accessible My athletes list and connection request controls anchored to confirmed sessions. Implement against the [current specification](../../../docs/mvp-spec.md#49-connect-after-a-confirmed-session). The implementation and validation record below distinguishes delivered coach controls from the planned athlete and conversation interfaces.

## Scope and non-goals

- In scope: coach-side Connect/request status on eligible booking context, incoming/outgoing requests, accepted My athletes list, bounded identity/photo, complete paginated shared request/booking-history navigation, disconnection/reconnection and recoverable action states.
- Out of scope: athlete interface, persistence/media authority, editing athlete profiles, coach-private records across sessions, general messaging and notifications.

## Expected behavior and edge cases

- Either participant can disconnect without deleting/resetting shared history. Fresh mutually accepted reconnection restores a complete paginated history view for the same pair, including unsuccessful booking requests and cancelled sessions. Keep original identifiers/statuses and show the selected request/booking conversation once.
- Shared conversation/plan/note details remain owned by COR0015. History links reopen original contexts when those interfaces are delivered; terminal/cancelled content stays read-only and coach-private content never enters shared recovery. Existing exact-participant access survives disconnection.

- A coach can request, accept, decline or withdraw according to the exact server-derived actor/state permissions; sending never makes the pair connected.
- My athletes shows accepted relationships separately from incoming/outgoing requests and booked sessions. Missing photos retain initials.
- Shared-history links preserve pair scope. Removal clearly explains that sessions and their participant access remain intact.
- Suspended coaches retain permitted existing list/removal actions and receive no create/accept controls. A hidden coach's approved authority and existing sessions, not discovery visibility, determine connection eligibility.
- Cancellation or concurrent decisions can invalidate a pending control; the result refreshes authoritative state without false success.

## Assumptions, decisions, and dependencies

- DEV0219 and DEV0221 must establish requirements/actions; DEV0220 supplies athlete vocabulary.
- Adopted placement: a My athletes section within existing Coach workspace → Bookings, with local links to booking requests, booked sessions and My athletes. Preserve Profile → Schedule → Bookings navigation. Accepted athletes, incoming requests, outgoing requests and terminal connection attempts remain separate.
- Reuse existing shared workspace, Avatar and action-feedback components; inspect bundled Next.js guides before integration edits.

### Adopted implementation design — 2026-10-14

- Start conditions passed: DEV0220/DEV0221 are completed; DEV0228 is completed and committed as `e9e0fe6`; the working tree was clean. This slice changes `/coach` and private coach components, adds a dedicated prefixed stylesheet imported by that route, and leaves Home/Explore routes, components and styles untouched. DEV0223 remains separate athlete-side work; coordinate any later shared connection-action edits.
- Read the installed Next.js 16.3.8 Server Action, CSS and router guides before integration. Server Actions dispatch sequentially in a client; perform a four-section refresh in one server-side wrapper rather than assuming parallel client actions. Existing action revalidation returns an updated server tree, so client overrides must be tied to their original server snapshot and discarded when fresh authority arrives.
- Booked-session cards expose on-demand Connection options. Load the exact booking's existing server-authorised context before rendering send/accept/decline/withdraw/disconnect controls. This avoids an unbounded connection query per historical booking. New requests use one browser-generated operation UUID per retry sequence plus the server's previous-attempt ID; no ambiguous retry silently creates a fresh request. Reconnection is an explicit fresh action.
- My athletes starts with existing 20-row coach-role pages for accepted/incoming/outgoing/terminal sections. Append each supplied tuple cursor unchanged at PostgreSQL microsecond precision, merge overlapping IDs without duplicates and label displayed counts honestly. A manual refresh rechecks current authority; provider/auth errors retain explicit retry states.
- Selecting an accepted athlete loads the existing pair-scoped shared-history page in an inline panel, with every older page accessible. Render original request/booking IDs as stable context attributes, statuses, date/time and retained venue labels; an accepted request and resulting booking appear once. Link retained bookings to their existing coach session cards. Unsuccessful request details are available in this history panel; conversation links/content remain COR0015 until those interfaces exist.
- Use existing Avatar initials/error fallback. Pending/terminal connection rows never receive connection-derived athlete bytes. Disconnect requires an inline confirmation explaining retained sessions/history. After a successful removal or denied history read, hide the accepted identity/photo/history immediately and recheck lists; do not retain previously authorised content as an unavailable fallback. Feedback and confirmation controls provide explicit keyboard focus and status announcements.
- Approved/demo/hidden coaches use server eligibility/action flags. Suspended coaches retain accepted lists, shared history and safe decline/withdraw/disconnect controls, with no send/accept. No schema, eligibility rule, dependency, environment variable or athlete interface is added.
- Scope review: one coach-facing vertical slice over the completed authority contract. Supporting action wrappers, presentation/model tests and a guarded local rehearsal are owned here; no new coordination hierarchy is needed.

## Implementation plan

1. Review delivered coach projections and actor/status matrix.
2. Add eligible booking connection controls, request sections and the accepted relationship list with bounded pagination. Add complete paginated shared request/booking-history navigation using DEV0221 references; original conversation rendering stays DEV0184.
3. Add explicit acceptance/removal feedback, keyboard focus, initials, empty/unavailable/conflict states and mobile layout.
4. Rehearse two-account flows and record code, screenshots and exact validation.
5. Verify default/empty/unavailable, consent/retry, confirmation/focus, overlapping pages, complete terminal/old history and avatar failure with meaningful model/render and browser checks. Finish and archive this ticket with index/specification/coordination link repairs only after all criteria pass.

## Acceptance criteria

- [x] AC1: An owning coach can manage only its authorized incoming/outgoing requests and accepted connections, with truthful pending and eligible-session behavior.
- [x] AC2: My athletes renders bounded athlete identity/photo and complete paginated shared request/booking-history links. Either-participant disconnection preserves records and independent permissions; fresh accepted reconnection restores all retained history, including unsuccessful/cancelled entries, with original context/status and no duplicate accepted-request thread.
- [x] AC3: Approved/demo/suspended/unrelated and missing-image/empty/unavailable/conflict states preserve server permissions and recoverable feedback.
- [x] AC4: Keyboard and desktop/mobile flows plus meaningful browser/regression tests, lint, type-check, formatting and build pass.

## Validation plan

Disconnect from each participant side, mutually reconnect, reload and traverse older history pages. Verify all retained exact-pair requests/bookings return with original status/identifiers, including declined/withdrawn/expired/not-selected requests and cancelled sessions; selected-request/booking continuity appears once. Record conversation-body recovery only after COR0015 interfaces are delivered and a combined two-account rehearsal passes.

Rehearse coach-initiated and athlete-initiated connections using real local persisted bookings and accounts. Verify recipient acceptance, decline, sender withdrawal, crossed requests, cancellation invalidation, removal, pagination, suspended state, Storage failure and unrelated denial at mobile/desktop widths. Tab through actions and verify focus/status announcements. Run relevant existing application/browser/auth checks, lint, type-check, format, build and diff checks; DEV0221 owns database authority.

Create only tagged temporary local Auth/booking fixtures. The coach uses actual browser Server Actions; the counterpart uses existing actor-checked repositories because DEV0223 is not delivered. Traverse more than 20 connection rows and shared-history entries, reconnect from either side, and compare retained IDs/statuses. Exercise mutation conflicts, denied reads, failed image/network responses, reload and 375/1440 px keyboard/overflow; preserve existing accounts/images and remove only exact rehearsal fixtures. Reuse the running guarded local app without repairing DEV0232's independent migration ledger issue. Run `npm test`, relevant browser/rehearsal commands, lint, typecheck, formatting, build, link/index checks and `git diff --check`.

## Implementation record

Implementation started 2026-10-14 after the user's conditional instruction to start when safe. Read-only review confirmed the clean tree, completed DEV0228 and separate private-route scope; the adopted design above precedes implementation edits.

### Changes and rationale

Coach workspace → Bookings now includes My athletes, incoming/outgoing connection requests and previous connection attempts. Booked sessions expose Connection options that load the exact participant context before showing controls. A coach sends a request rather than creating an accepted connection; only the recipient can accept. Either participant can disconnect, and a later request requires fresh acceptance.

Selecting an accepted athlete opens all retained shared booking/request history through bounded older pages. Declined, withdrawn, expired, not-selected, closed, cancelled and completed records keep their original IDs and statuses. An accepted request and its resulting session appear once; View session returns to the original existing booked-session card. Reconnecting restores the same pair history rather than creating a new history collection. This slice delivers references and navigation, not conversation bodies or private coaching records.

Action locks, explicit retry states, stable operation UUIDs, authoritative refreshes and snapshot-bound local pages prevent duplicate sends or obsolete consent/media from reappearing. Pending/terminal connections never display connection-derived private photos. Disconnect/read verification hides previously accepted content until fresh authority is available. Approved hidden coaches retain eligible controls; suspended coaches retain safe removal/history actions without send/accept. Dedicated styles preserve Home and Explore.

### Affected files

| File or component                                                                                                                                                                                                                   | Change and purpose                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Coach route](../../../src/app/coach/page.tsx) and [booked-session cards](../../../src/features/coaches/coach-client-cards.tsx)                                                                                                     | Add private Bookings shortcuts, bounded initial connection pages, a semantic server-snapshot digest and original booking anchor targets. Keep existing schedule/request authority. |
| [Connection actions](../../../src/app/connections/actions.ts)                                                                                                                                                                       | Add one server-side four-section refresh and an exact-booking context wrapper over existing validated services.                                                                    |
| [Workspace controller](../../../src/features/coaches/coach-connections-workspace.tsx) and [booking controls](../../../src/features/coaches/booking-connection-options.tsx)                                                          | Manage serialized actions, retry operation IDs, authoritative refresh, consent-bound caches, conflict recovery and keyboard feedback.                                              |
| [My athletes lists](../../../src/features/coaches/coach-athlete-connections.tsx), [history panel](../../../src/features/coaches/coach-connection-history.tsx) and [model](../../../src/features/coaches/coach-connections-model.ts) | Separate accepted/request/terminal sections, preserve complete server cursors and original history references, merge overlapping IDs and label statuses/counts honestly.           |
| [Disconnect confirmation](../../../src/features/coaches/connection-disconnect-control.tsx), [connection avatar](../../../src/features/coaches/connection-avatar.tsx) and [route stylesheet](../../../src/app/coach/connections.css) | Preserve retained-history wording, focus, cold-load initials fallback, mobile layout and fixed-header anchor spacing without changing shared Avatar or Home styles.                |
| [Model/render tests](../../../tests/coach-connections.test.ts) and [local rehearsal](../../../scripts/rehearse-local-coach-connections.ts)                                                                                          | Add eight meaningful model/render checks and actual local HTTP/browser consent, paging, reconnection, media, permission and accessibility evidence.                                |
| [Package scripts](../../../package.json) and [README](../../../README.md#checks)                                                                                                                                                    | Document the guarded local rehearsal command and its tagged cleanup/prerequisites. No dependency changes.                                                                          |
| [Specification](../../../docs/mvp-spec.md#1-product-status-and-document-authority), [COR0020](../../current/organisatory/COR0020-athlete-terminology-and-connections.md) and [ticket index](../../README.md)                        | Record coach delivery, retain separate athlete/conversation ownership and reconcile completed links/statuses.                                                                      |

### Decisions and deviations

2026-10-14 final rehearsal timing correction: the list retry rendered its 20 rows before the pending action released the disabled Load more control. The keyboard test focused it too early, so Enter did not submit. Wait for the enabled control before keyboard activation; preserve the application's action lock rather than changing consent/pagination behavior.

2026-10-14 viewport review before the final CSS correction: the fixed workspace header clipped the My athletes shortcut target on mobile. Increase the dedicated section/session anchor scroll margin to clear the header; assert the heading remains below it after the mobile shortcut. Keep the correction within this route’s prefixed stylesheet. The Next.js development indicator in screenshots reports an existing CoachAvailabilityPanel child-key warning; the rehearsal reports no browser page errors.

2026-10-14 private-workspace recovery before final verification: a rejected connection action exits before its usual route revalidation. Explicitly refresh the coach route after a confirmed conflict/auth failure so a booking cancelled by the counterpart also updates the booked-session card, not only the connection flags. Preserve ambiguous operation retries; no automatic refresh/resend is introduced for unavailable mutations.

2026-10-14 final accessibility refinement before implementation: focus the first newly loaded athlete/history item when pagination appends or exhausts, so removing Load more does not strand keyboard focus. Announce the displayed count and make action feedback visible when focused. Preserve original identifiers in stable DOM targets. Capture viewport-sized desktop/mobile evidence in addition to full pages, and clarify withdrawn/closed/not-selected booking-request wording.

2026-10-14 cold-load image refinement before implementation: the browser's blocked connection-avatar request could fail before the shared Avatar's client error handler hydrated, leaving a broken image. Add a connection-specific hydration wrapper that renders initials on the server, then loads the existing Avatar after its handlers are ready. Reuse the existing sign-in hydration pattern and [React 19.3 server-snapshot guidance](https://react.dev/reference/react/useSyncExternalStore#adding-support-for-server-rendering); preserve shared Avatar/Home files. The browser check must cover both a real accepted image and failed cold-load fallback.

2026-10-14 dependency correction: the cancellation UI rehearsal reproduced a service transaction-boundary defect that returns unavailable rather than the declared conflict. Independent DEV0234 owns the narrow backend correction; retain the real stale-control regression in this frontend rehearsal. Do not change PostgreSQL eligibility/locks or reopen the completed baseline.

2026-10-14 browser refinement before further implementation: an initial reconnect comparison recovered only the first history page after a server-tree refresh. Track a stable server-generated digest of connection pages, bookings, request page and coach access rather than JavaScript prop-object identity. Equivalent server snapshots must preserve appended client pages; changed consent, booking/request state or access invalidates them. Preserve the operation UUID on ambiguous unavailable/network outcomes and hide accepted content while an unverified disconnect/read is being checked. The first rehearsal also attempted counterpart acceptance before the preceding UI send completed; add authoritative action-result waits and completion checks before evaluating pagination.

2026-10-14: [DEV0230](../organisatory/DEV0230-adopt-reconnection-history-recovery.md) records full shared-history recovery after reconnection. This interface owns history navigation; COR0015 owns request/session conversation rendering and original status/author permissions.

### Contracts, configuration, and operations

Consumes DEV0221's existing projection/action/media shapes, eligibility and participant permissions. The coach workspace adds an internal sourceVersion string; it is a digest of authorised server pages/bookings/request state/access, not an identity token or new API. The added npm run test:coach-connections command requires the already running loopback app at localhost:3100, local Supabase and Chrome; it refuses hosted targets, creates only tagged temporary local accounts, and cleans their exact scheduling/connection/media records. Screenshots are ignored under test-results/coach-connections-rehearsal/; --cleanup removes only owned tagged leftovers.

No schema, migration, dependency, lockfile, environment setting, public inventory or new coach capability changes. Reverting the frontend/action wrappers and script removes this interface; existing persisted relationships and booking/request history remain intact. Independent DEV0234 restores existing conflict classification; DEV0232's local migration-ledger repair is not performed.

## Validation results

Validation performed on 2026-10-14 with Node.js 24, installed Next.js 16.3.8, local Supabase/PostgreSQL/Auth/Storage and headless Chrome. Existing local accounts and images were preserved; the rehearsal coach remained hidden. The counterpart used existing actor-checked repositories because DEV0223's athlete web controls are not implemented.

- npm run test:coach-connections: passed actual coach Server Actions, coach send/withdraw and explicit counterpart acceptance, incoming acceptance/decline, crossed requests remaining pending, both-participant disconnect/fresh reconnection, reload and all 30 original shared history entries across 20-row pages. Accepted request/session continuity appears once; unsuccessful/cancelled/completed entries retain IDs/statuses. Verified 22 accepted athletes through pagination, network retry operation UUID reuse, list-read failure/retry with old private content hidden, real image loading and cold-load image failure initials, cancellation conflict with refreshed booked-session status, safe decline, hidden/suspended permissions and guest/unrelated denial. Desktop 1440 × 1040 and mobile 375 × 812 checks cover keyboard Enter, confirmation/feedback/paging focus, fixed-header shortcut visibility and no horizontal overflow; no browser page errors. Tagged fixture cleanup completed; an independent owner query found zero remaining DEV0222-tagged temporary Auth accounts.
- npm test: passed 135 general/model/render and 14 server checks, zero failures. Eight new checks cover consent sections, full-precision cursor overlap, pair-attempt replacement, media separation, suspended controls, honest empty/unavailable counts, original combined history references and unknown/eligible booking context.
- npm run test:db: passed 59 actual PostgreSQL tests, zero failures. npm run db:test: passed 206 pgTAP assertions across 11 files. Existing consent, authorization, cancellation/concurrency, history and media constraints remain unchanged; no migration replay is required for this UI/code-only change.
- npx --no-install playwright test tests/browser/public-story.spec.ts tests/browser/auth.spec.ts: passed 16 production-preview desktop/mobile regressions; two existing desktop-only scenarios are intentionally skipped in the mobile project. Home filtering, reload, no-JavaScript submission, Explore query search, public navigation, protected routing and sign-in remain intact.
- npm run lint, npm run typecheck, npm run format:check and the configuration-free production npm run build: passed. Build used explicit empty DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SITE_URL and NEXT_PUBLIC_GEOAPIFY_API_KEY overrides; no hosted service was contacted and no environment values were printed.
- Visual review: desktop-viewport.png and mobile-viewport.png plus full-page desktop-history.png, mobile-athletes.png and mobile-suspended-history.png under the ignored rehearsal evidence directory. The mobile header clipping found in this review was corrected and checked by the final rehearsal. Screenshots contain the existing Next.js development child-key warning for CoachAvailabilityPanel, outside this slice; there are no rehearsal page errors.
- Initial rehearsals failed on a premature counterpart acceptance, identity-based cache invalidation, cancellation and keyboard test timing, swallowed SQL conflicts and pre-hydration image failure. These failures led to the dated corrections above; the final real rehearsal passes after explicit completion waits, semantic snapshot tracking, independent DEV0234 and the feature-local avatar wrapper. No failed criterion is deferred as completed.
- Final Markdown formatting and python3 /tmp/dev0222-check-docs.py --complete link/index/ID/ownership/scope checks, plus git diff --check: passed; unique/reserved IDs, reciprocal membership, all affected relative links/anchors, index statuses, completed archive paths and private-route scope were reviewed.

| Criterion | Evidence                                                                                                                                                        | Result |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Real coach consent/withdraw/accept/decline, crossed request and exact actor tests; cancelled-only context cannot send.                                          | Passed |
| AC2       | Both-side removal/reconnection, reload and all 30 original paged references; 22 accepted athletes; one selected-request/session entry; pair/media regressions.  | Passed |
| AC3       | Hidden/suspended/guest/unrelated cases, cold-load image/network failures, stale cancellation conflict and retry/state tests.                                    | Passed |
| AC4       | Desktop/mobile keyboard/focus/overflow rehearsal, public/auth regressions and all app/database/static/build checks. Document/archive consistency checks passed. | Passed |

## Risks, limitations, and follow-ups

DEV0223 still owns athlete My coaches controls. Counterpart repository operations in this rehearsal do not claim both web interfaces are delivered. COR0015 still owns shared conversation/plan/note bodies and coach-private notes; complete shared-content recovery requires its delivery and combined rehearsal. No public athlete profile, notifications or instant rebooking is added.

New connection/history reads are bounded and booking context is on demand; the existing private booked-session list remains the legacy workspace projection. The normal npm run dev:local path has the pre-existing missing-version ledger blocker tracked by DEV0232; this rehearsal reused the already running guarded local app and neither repaired nor reset that ledger. No hosted rehearsal, release or independent review was performed. Next action: review DEV0223 as the remaining peer interface.

## Completion and review references

- Completed: 2026-10-14; applicable acceptance criteria and required local validation passed. No hosted deployment or independent review is claimed.
- Commit: `[DEV0222][DEV0234] Add My athletes and preserve connection conflicts`, requested by the user on 2026-10-14. Both records accompany this commit because the frontend regression exercises the backend correction and their completed archive links are reconciled together; Git history supplies the hash.
- Review: No independent review created.
- Deployment or release: Not deployed or released.
