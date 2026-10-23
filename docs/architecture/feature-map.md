# Feature map

Use one relevant entry, verify its source and follow additional dependencies only as needed. Booking, availability and Events have detailed paths; the other entries are starting references, not complete impact analyses. Requirements remain in the linked MVP specification.

For import ownership changes, consult the [enforced dependency rules and exact exception owners](overview.md#dependencies-enforced-rules-and-current-exceptions), then run the [source boundary suite](../../tests/boundaries.test.ts) and [isolated graph cases](../../tests/dependency-graph.test.ts). The capability's extraction issue owns removal of its temporary entries.

| Capability                         | Entry                                                         |
| ---------------------------------- | ------------------------------------------------------------- |
| Private booking and session types  | [Detailed path](#private-booking-and-session-types)           |
| Coach availability and calendar    | [Detailed path](#coach-availability-and-calendar)             |
| Events and group sessions          | [Detailed path](#events-and-group-sessions)                   |
| Coach profiles and public websites | [Starting references](#coach-profiles-and-public-websites)    |
| Authentication and authorization   | [Cross-cutting references](#authentication-and-authorization) |
| Messaging                          | [Starting references](#messaging)                             |
| Notifications                      | [Message stage and delivery](#notifications)                  |
| Connections and reviews            | [Starting references](#connections-and-reviews)               |

## Private booking and session types

**Start:** [PublicCoachPage](../../src/app/_coaches/public-coach-page.tsx) composes username/legacy coach routes. It selects [typed booking](../../src/features/session-types/public-booking.tsx), [legacy marketplace](../../src/features/coaches/coach-marketplace.tsx), or booking-unavailable state according to catalog capability. [PrivateScheduleAccess](../../src/features/coaches/private-schedule-access.tsx) separates guest count previews from authenticated individual times. An enabled empty catalog is not legacy fallback.

**Trace:** typed week transport → [session-types GET handler](../../src/app/api/coaches/[slug]/session-types/route.ts) → `publicSessionWeek` in [typed-session-service](../../src/server/coaches/typed-session-service.ts) → `withAuthorizedActor` → [typed-session-repository](../../src/server/db/coaches/typed-session-repository.ts). The repository reads on a separate public-projection connection, outside owner override context. [Actor transactions](../../src/server/db/authorization/repository.ts) validate identity/dataset authority; client state alone grants no access. [Session-booking commands](../../src/app/api/session-bookings/route.ts) use a separate authorized mutation path; legacy requests enter through [marketplace actions](../../src/app/coach-marketplace-actions.ts).

**Contracts/data:** [week parser](../../src/domain/session-week.ts), [date/page selection](../../src/domain/public-coach-schedule.ts), [typed commands](../../src/domain/typed-sessions.ts). Retry, response fences and deliberate transient-state resets already live in the typed UI; inspect them before proposing changes. SQL `public_session_type_times` is currently replaced by [candidate optimization](../../supabase/migrations/20261021000100_prune_private_session_time_candidates.sql); its full-fit authority remains `typed_session_fits` from [typed sessions](../../supabase/migrations/20261018000800_typed_private_sessions.sql). Venue hours, duration, horizon and private/group conflicts cross these boundaries. [Guest summary repository](../../src/server/db/coaches/private-schedule-summary-repository.ts) aggregates without exposing individual starts.

**Product contract:** [§19.6 privacy, seven-day presentation and recovery](../mvp-spec.md#196-cards-username-urls-and-scheduling-compatibility), [§18.6 session types](../mvp-spec.md#186-session-types-and-flexible-bookings), [§7 requests/recovery](../mvp-spec.md#7-requests-booking-and-recovery). Auth/catalog changes can remount the form; retaining class/place/week during retry does not mean retaining a selected time or review dialog.

**First checks** (installed dependencies required):

```sh
node --import tsx --test tests/public-coach-schedule.test.ts tests/session-week.test.ts tests/private-schedule-access.test.ts
node --import tsx --conditions=react-server --test tests/server/session-week.test.ts
```

The existing [component/browser rehearsal](../../scripts/rehearse-public-coach-schedule-ui.mjs) contains relevant fixture assertions, but its intended command, `node scripts/rehearse-public-coach-schedule-ui.mjs --production`, is currently blocked in a clean checkout: its unconditional copy list still requires the removed `tickets/` directory. Dependencies, Chrome and an available build/port do not resolve that prerequisite; the script needs a separately scoped repair before execution. Its fixtures would still provide no real Auth/SQL proof. For current fresh/upgrade database checks use `node scripts/rehearse-session-week-database.mjs` ([script](../../scripts/rehearse-session-week-database.mjs)), requiring the local Docker database and its owned scratch databases. [Typed database tests](../../tests/database/typed-sessions.test.ts) skip outside a `/dev0342_…` target; default `test:db` does not establish their coverage. See [setup](../../README.md#session-type-validation).

## Coach availability and calendar

**Start:** [coach page](../../src/app/coach/page.tsx), Schedule → Availability, wires [actor-bound editor](../../src/features/coaches/availability-workspace-editor.tsx) and [AvailabilityEditor](../../src/features/coaches/availability-editor.tsx). The sibling [calendar workspace](../../src/features/coaches/coach-calendar-workspace.tsx) uses [calendar actions](../../src/app/coach/calendar-actions.ts), [service](../../src/server/coaches/calendar-service.ts) and [repository](../../src/server/db/coaches/calendar-repository.ts).

Calendar data/results/loader types belong to [shared Calendar contracts](../../src/calendar/contracts.ts), consumed directly by its service, action and UI. The [calendar feature model](../../src/features/coaches/coach-calendar-model.ts) retains actor presentation gates, links, Berlin time labels and overlap lanes. Server/SQL owner and dataset checks remain authoritative.

**Trace:** editor preview/save → [availability actions](../../src/app/coach/availability-actions.ts) → [availability-editor-service](../../src/server/coaches/availability-editor-service.ts) → authorized actor/scope and approved/demo visible-owner checks → [effective-availability repository](../../src/server/db/coaches/effective-availability-repository.ts). Preview and save share command validation but select different SQL entry points. Review is explicit in the UI; it is not a persisted server preview token.

**Contracts/data:** [shared availability contracts](../../src/availability/contracts.ts) own service/editor data, results and action signatures. The [effective-availability domain](../../src/domain/effective-availability.ts) owns weekly/date commands, revisions, impact results and the Berlin-date helper. The [editor model](../../src/features/coaches/availability-editor-model.ts) retains draft transformations, access checks and the payload parser used by Server Actions; the service has no feature dependency. [Effective-availability SQL](../../supabase/migrations/20261016000200_effective_coach_availability.sql) owns `save_owned_effective_coach_availability` and its rollback-only `preview_owned_effective_coach_availability`; preview calls the actual save in a rolled-back subtransaction. Follow later [typed-session reconciliation](../../supabase/migrations/20261018000800_typed_private_sessions.sql) when requests span longer durations. SQL rechecks actor/dataset, locking, revisions, venues and exact retries; impact includes pending closures and retained confirmed sessions. The preview count is not a reservation against subsequent request changes.

**Product contract:** [§18.2 whole-date overrides](../mvp-spec.md#182-weekly-hours-and-whole-date-overrides), [§18.3 restoration/concurrency](../mvp-spec.md#183-horizon-restoration-and-concurrency), [§18.4 calendar/access](../mvp-spec.md#184-calendar-presentation-and-access), [§18.6 typed integration](../mvp-spec.md#186-session-types-and-flexible-bookings). Availability changes intersect requests, public counts, mixed private/group time and restoration; do not infer booking cancellation from changed hours.

**First checks:**

```sh
node --import tsx --test tests/availability-editor.test.ts tests/effective-availability.test.ts tests/boundaries.test.ts
node --import tsx --conditions=react-server --test tests/server/availability-editor-actions.test.ts
```

For Calendar contract/access/layout work, also run:

```sh
node --import tsx --test tests/coach-calendar.test.ts tests/boundaries.test.ts
node --import tsx --conditions=react-server --test tests/server/coach-calendar-actions.test.ts
```

`node scripts/rehearse-availability-editor-ui.mjs` ([script](../../scripts/rehearse-availability-editor-ui.mjs)) checks fixture preview/review/recovery; it needs dependencies, Chrome and port 3137. [Database assertions](../../tests/database/effective-availability.test.ts) require an explicit loopback `DATABASE_TEST_URL`, migrations and runtime role; the current [weekly scratch rehearsal](../../scripts/rehearse-session-week-database.mjs) includes them. Use it for isolated database coverage rather than assuming a fixture proves rollback/authority. [README checks](../../README.md#checks) distinguish hosted `--check` readiness from `--run` rehearsal and describe exact fixture cleanup. Keep retained data under [§8](../mvp-spec.md#8-identity-data-and-demo-integrity).

## Events and group sessions

**Start:** [Events page](../../src/app/events/page.tsx) → [EventResults](../../src/features/events/event-results.tsx); directory [UI helpers](../../src/features/events/directory-contract.ts) compose view links, fetch/append pages and derive venue pins. Shared [query helpers](../../src/events/queries.ts) encode filters/cursors and query identity; [parsers](../../src/events/parsers.ts) validate directory queries, public pages and participation forms. The existing failed-load branch retains results and allows retry; map-provider recovery is a separate flow. Owner/participation work starts in [coach Events](../../src/app/coach/events/) and [athlete group sessions](../../src/app/sessions/groups/), respectively.

**Trace:** `fetchEventPage` → [events GET handler](../../src/app/api/events/route.ts) → [directory service](../../src/server/group-sessions/directory-service.ts) → public session and media projections. [Group service](../../src/server/group-sessions/service.ts) separates public discovery from actor-authorized commands; [group repository](../../src/server/db/group-sessions/repository.ts) calls SQL. Discovery does not require sign-in; owner/participation mutations do. Public SQL/media projection checks protect visibility and participant privacy independently of browser filters.

**Contracts/data:** [shared Events contracts](../../src/events/contracts.ts) own filters, directory pages and owner context/mutation types; the parsers enforce query-key, cursor and media consistency using the [group domain](../../src/domain/group-sessions.ts), which remains lifecycle/command/result authority. The [coach form model](../../src/features/coach-events/contract.ts) retains draft and local-time/EUR conversion; services revalidate domain commands and actor/owner scope. Current `public_group_sessions` is in [group/calendar integration](../../supabase/migrations/20261018000900_group_and_calendar_session_types.sql), replacing the baseline definition; it can reconcile expired Open sessions while serving public data. [Banner SQL](../../supabase/migrations/20261018001000_group_session_banners.sql) guards public media. Loaded cards/pins remain snapshots; a failed read is not verified empty inventory. Private/group conflicts and registration authority remain separate from pagination state.

**Product contract:** [§15.1 paging/map behavior](../mvp-spec.md#151-confirmed-choices-and-implementation-defaults), [§15.3 privacy](../mvp-spec.md#153-joining-leaving-and-privacy), [§15.4 atomic lifecycle](../mvp-spec.md#154-data-and-atomic-lifecycle), [§15.6 surfaces/ownership](../mvp-spec.md#156-surfaces-and-ownership), [§18.6 type compatibility](../mvp-spec.md#186-session-types-and-flexible-bookings).

**First checks:**

```sh
node --import tsx --test tests/event-directory.test.ts tests/events.test.ts tests/coach-events.test.ts tests/boundaries.test.ts
node --import tsx --conditions=react-server --test tests/server/event-actions.test.ts tests/server/coach-event-actions.test.ts tests/server/event-banners.test.ts
```

For real directory fixtures/manual browser checks use `node --import tsx --conditions=react-server scripts/rehearse-local-event-directory.ts` ([script](../../scripts/rehearse-local-event-directory.ts)); it needs migrated local Supabase, dependencies, Chrome for browser checks and port 3158. Follow [README setup/cleanup](../../README.md#events-banners-and-directory-validation). [Banner database rehearsal](../../scripts/rehearse-event-banners-database.mjs) covers owned fresh/upgrade databases. The older [group-discovery rehearsal](../../scripts/rehearse-local-group-discovery.ts) still asserts page replacement/“Next sessions”; its existence does not prove the current appended-results interaction. Helper tests likewise do not replace mounted-control, keyboard/mobile, race or real privacy evidence.

## Coach profiles and public websites

Start with the [owner profile route](../../src/app/profile/coach/page.tsx) and [public page composition](../../src/app/_coaches/public-coach-page.tsx). [Website service](../../src/server/coaches/website-service.ts) owns content operations; [§19](../mvp-spec.md#19-coach-marketplace-cards-and-personal-websites) supplies publication, username, media and disclosure contracts. Booking composition is detailed above.

[Shared website identity and group result types](../../src/coaches/public-website.ts) have a neutral owner used by [website rendering](../../src/features/coaches/website/public-coach-website.tsx) and [metadata/page orchestration](../../src/server/coaches/public-website-page.ts). The latter adapts existing public group-service reads into the [server-only bounded loader](../../src/server/coaches/public-website-groups.ts), preserving exact coach matching, deduplication, six results and a twenty-page scan limit. Failed/incomplete optional group reads remain unavailable without hiding a verified profile. [Review-response parsing](../../src/features/coaches/website/public-website-model.ts) stays frontend-owned and strips private/extra fields.

**First checks:**

```sh
node --import tsx --test tests/public-coach-website.test.ts tests/boundaries.test.ts
node --import tsx --conditions=react-server --test tests/server/coach-website-routes.test.ts tests/server/public-coach-website-groups.test.ts
```

These are rendering/contract, route-rejection and isolated group-read checks; they do not prove live Auth/SQL/Storage behavior. Website database and real-service rehearsals have separate prerequisites and cleanup rules in [README](../../README.md#checks).

## Authentication and authorization

[Application Auth contracts](../../src/auth/contracts.ts), [server session verification](../../src/server/auth/session.ts), [authorization service](../../src/server/authorization/service.ts) and [§4.1](../mvp-spec.md#41-register-as-an-athlete-or-apply-to-coach) are starting points. Each detailed flow above also identifies its actual session/actor/public-projection boundary; a client identity projection grants no server permission.

## Messaging

Start with the [Messages page](../../src/app/messages/page.tsx), [mailbox](../../src/features/messages/mailbox.tsx) and [message service](../../src/server/messages/service.ts). [§16](../mvp-spec.md#16-private-messages-and-session-notes) defines conversation authority, consent, recovery and scheduling context. This entry does not map the full messaging implementation.

## Notifications

**Start:** [shared bell](../../src/components/notification-bell.tsx) in the public/workspace/Messages [shell](../../src/components/shell.tsx) and [Account/Profile shell](../../src/components/account-shell.tsx). [Client requests](../../src/notifications/client.ts) use the [notification API](../../src/app/api/notifications/route.ts), validated [contracts](../../src/notifications/contracts.ts), [actor service](../../src/server/notifications/service.ts) and [repository](../../src/server/db/notifications/repository.ts). Native dialog focus/dismissal is shared with [Modal](../../src/components/ui.tsx). Styles live in [notifications.css](../../src/app/notifications.css).

**Authority/data:** [message-notification migration](../../supabase/migrations/20261023000100_message_notifications.sql) captures only newly inserted user text and maintains email unread periods from authoritative message read-through. Recipient notification read state is independent. Ordinary app logins may execute only the actor-validated command; the separate worker role has only bounded claim/prepare/finish functions. A private Auth-email helper returns only an eligible outbox recipient. No historical backfill, booking events or message bodies in notification payloads.

**Delivery:** [worker](../../src/server/notifications/worker.ts) → [restricted worker repository](../../src/server/db/notifications/worker.ts) → [delivery/transport](../../src/server/notifications/delivery.ts). The [cron route](../../src/app/api/internal/notifications/dispatch/route.ts) requires CRON_SECRET and explicit delivery configuration; [local CLI](../../scripts/dispatch-notifications.ts) uses the same worker. Claims, eligibility and results use short separate transactions; no provider I/O holds a transaction. Five-minute eligibility, suppression/re-arm, attempt leases and Unknown handling are defined in [§20](../mvp-spec.md#20-email-and-in-app-notifications). Credentials and migration/deployment requirements are in [setup](../../supabase/README.md#message-notification-runtime).

**Private booking stage (MOV-85):** [forward SQL](../../supabase/migrations/20261023000200_private_booking_notifications.sql) captures canonical request status, confirmed/cancelled booking and typed booking-change audit inserts into separate event/recipient-receipt tables. Each committed event has two email recipients; only non-acting coaches receive booking bell items. Request acceptance uses the confirmed booking event once. New `notification_command_v2` merges booking/text history. New clients opt in with `X-MovX-Notification-Version: 2`; absent/1 keeps message-only lists/reads for old browser bundles, and unsupported versions fail before actor work. Old message APIs/worker commands remain compatible. `claim_all_notification_emails` bounds mixed claims while guaranteeing booking capacity; immediate booking receipts have no message read/delay suppression. [Typed booking metadata/allowlisted links](../../src/notifications/bookings.ts) are shared by the parser, bell and email renderer. No status card becomes a duplicate generic message alert. Group approval/lifecycle capture is MOV-86 after MOV-77.

**Booking checks:** `npm run test:booking-notifications-db` ([rehearsal](../../scripts/rehearse-booking-notifications-database.mjs)) requires installed dependencies, retained local Docker PostgreSQL and Mailpit55324. It creates only unique fresh/upgrade scratch databases/restricted logins, proves canonical lifecycle/retry/race/two-party local capture/source privacy/mixed cursor/lease fencing, then removes exact captures/targets and verifies retained hashes. Run SQL rehearsals sequentially. `node --import tsx --test tests/booking-notifications.test.ts tests/notifications.test.ts` and server notification tests cover typed contracts/escaping/idempotency. Mounted bell rehearsal includes booking labels, links and explicit read with desktop/mobile/keyboard/error/actor fences; it supplies fixture UI proof, separate from real SQL/provider proof. SQL must be installed before new API/worker source; no hosted installation is implied.

**Checks:** `node --import tsx --test tests/notifications.test.ts tests/message-shell.test.ts` and `node --import tsx --conditions=react-server --test tests/server/notifications.test.ts` cover parsing/header gates, HTTP and worker behavior. `npm run test:notifications-db` needs local Docker/PostgreSQL and Mailpit at 55324; it creates fresh/upgrade scratch databases and temporary restricted worker logins, proves real SQL and local capture, then cleans its own fixtures and verifies retained data. `npm run test:notifications-ui` needs dependencies, local Chrome and free port 3168; it runs actual headers/bell against explicit isolated Auth/API fixtures, covering desktop/mobile/keyboard, errors/paging and actor races. Fixture UI evidence does not prove real browser Auth/SQL or external recipient delivery. Screenshots are ignored under test-results/notifications. Group event coverage remains MOV-86/MOV-77; private booking checks are listed above.

**Combined acceptance:** `npm run test:notifications-integration` requires the retained local Docker stack for read-only preservation checks, local Chrome, dependencies and free ports 55420–55429/3169. Its [integration rehearsal](../../scripts/rehearse-notifications-integration.mjs) starts a uniquely named disposable Supabase project, builds unchanged production source, signs in three real browser sessions and exercises actual recipient APIs/SQL/worker with local Mailpit. It waits the real five-minute message delay and verifies suppression/re-arm, privacy, paging, read independence and recovery. It then posts/retries a booking using real browser cookies, verifies coach-only bell and legacy/v2 list/read isolation, and captures both immediately eligible booking receipts. Only its new stack receives migrations/seed/test accounts; exact project containers/volumes and temporary source are removed. Evidence is ignored under test-results/notifications-integration. This establishes local integrated behavior, not hosted or external inbox delivery.

## Connections and reviews

[My coaches](../../src/app/my-coaches/page.tsx) leads to the [connection service](../../src/server/connections/service.ts); pair reviews have a distinct [review service](../../src/server/coaches/review-service.ts). Consult [§19.4 reviews](../mvp-spec.md#194-reviews-consent-and-public-aggregates) and the specification's connection flows; do not infer review eligibility from a current connection alone.
