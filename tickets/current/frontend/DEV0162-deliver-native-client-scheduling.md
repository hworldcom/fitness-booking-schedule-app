# Ticket DEV0162: Deliver native client scheduling

- Status: Draft
- Created: 2026-10-08
- Last updated: 2026-10-08
- Milestone: Native iOS client scheduling
- Coordination: [COR0013 — Native iOS application](../organisatory/COR0013-native-ios-application.md)
- Related records: depends on [DEV0160 — Expose the mobile scheduling API](../backend/DEV0160-expose-mobile-scheduling-api.md) and [DEV0161 — Establish the Expo iOS foundation](DEV0161-establish-expo-ios-foundation.md); preserves booking behavior from [DEV0141](../../archive/backend/DEV0141-persist-direct-private-bookings.md) and client history from [DEV0144](../../archive/frontend/DEV0144-show-client-booking-history.md)

## Objective and context

Deliver the client-facing native scheduling journey in an app-specific design: guest coach discovery, coach detail and open times, email-backed onboarding, direct booking, My sessions, cancellation and account presentation. The experience should prioritize fast native tasks rather than reproduce the website's landing pages, desktop structure or CSS.

## Scope and non-goals

- In scope: native Explore list/search/filter; coach detail, trust label, confirmed location and future open times; booking confirmation and conflict/retry feedback; signed-in My sessions with upcoming/history states and cancellation; Profile presentation and existing private-avatar display/upload if required by DEV0159; pull-to-refresh, loading/empty/offline/error states; deep-linkable internal routes; responsive/accessibility/device tests.
- Out of scope: coach schedule/profile management, staff review, payments, passes, messaging, reviews, push notification delivery, external calendars, background booking, offline mutation queues, or mandatory native Mapbox integration.

## Expected behavior and edge cases

- A guest can browse visible approved/demo coaches and open times without signing in. Private booking/client data never appears in public responses or cached screens.
- Booking from a signed-out state leads through native email-code onboarding and returns to the intended occurrence without mutating early.
- Booking confirmation presents coach, exact local time/timezone and location before mutation. Success appears in My sessions and survives reload/restart.
- Same-client retry returns the existing booking; a competing booking produces a clear conflict and refreshes availability.
- Client cancellation is available only for an owned future confirmed booking and reopens the occurrence when the server succeeds.
- Empty, offline, expired-session and backend-unavailable states are distinguishable. Optimistic UI never fabricates a successful booking.
- Native presentation uses platform navigation, lists, sheets and accessible controls while retaining MovX brand identity.

## Assumptions, decisions, and dependencies

- DEV0160 owns public/client API authority; DEV0161 owns authentication, navigation and HTTP primitives.
- The first useful iOS slice is client scheduling. Coach tickets may complete later without changing this ticket's acceptance criteria.
- List-first discovery is required. A native map remains optional unless DEV0159 makes it part of the first release.
- Reuse canonical timestamps and timezone/location snapshots from the server; the device must not reinterpret availability as a different occurrence.
- Profile-image upload is included only if DEV0159 marks current profile-media editing as first-release parity; displaying the bounded existing avatar remains expected.

## Implementation plan

1. Define native information architecture and components for Explore, coach detail, booking confirmation, Sessions and Profile.
2. Connect public discovery/open-time reads and authenticated booking/session/cancellation requests.
3. Preserve return-to-booking intent through native authentication and handle session expiry safely.
4. Add refresh, conflict, empty, offline and unavailable behavior without optimistic authority.
5. Add unit/component/API-mocking tests plus simulator/device accessibility and supported-width checks.
6. Rehearse a real local client booking/reload/cancellation flow and cross-check the same records on the website.

The scope is one client scheduling vertical slice; coach capability and account deletion remain peer tickets.

## Acceptance criteria

- [ ] AC1: A guest can use native Explore and coach detail/open-time screens without receiving private data or a web-page clone.
- [ ] AC2: A verified client can book one open occurrence, reload/restart into the same confirmed session and see it on the website.
- [ ] AC3: Same-client retry is idempotent, a different-client conflict is explicit, and self/invalid/elapsed/cross-run attempts fail without partial UI or server state.
- [ ] AC4: The client can view only their upcoming/history records and cancel an owned future booking; the reopened time is visible across native and web surfaces.
- [ ] AC5: Supported iPhone sizes, keyboard/VoiceOver/dynamic text, loading/empty/offline/error states and relevant automated/static/build checks pass.

## Validation plan

Add native component and request-state tests. Rehearse guest discovery, sign-in return, booking/reload, second-client conflict, cancellation/reopen and authorization failures against local Auth/PostgreSQL. Check compact/current iPhone sizes, landscape if supported, dynamic type, VoiceOver order and keyboard interaction. Run mobile lint/type/tests/build plus relevant backend and existing web regression checks.

## Implementation record

Pending implementation.

### Changes and rationale

Pending implementation.

### Affected files

| File or component              | Change and purpose                                           |
| ------------------------------ | ------------------------------------------------------------ |
| Native Explore/coach routes    | Planned public discovery and detail experience.              |
| Native Sessions/Profile routes | Planned authenticated client state and account presentation. |
| Native API hooks/state         | Planned bounded reads/mutations and retry behavior.          |

### Decisions and deviations

None yet.

### Contracts, configuration, and operations

Consumes DEV0160's versioned API and DEV0161's public configuration/session storage. No schema or server credential should be introduced by this ticket.

## Validation results

Pending validation.

| Criterion | Evidence                                    | Result  |
| --------- | ------------------------------------------- | ------- |
| AC1       | Guest discovery/device tests                | Not run |
| AC2       | Local cross-surface booking rehearsal       | Not run |
| AC3       | Retry/conflict/negative scenarios           | Not run |
| AC4       | Actor-scoped history/cancellation rehearsal | Not run |
| AC5       | Accessibility, width and command matrix     | Not run |

## Risks, limitations, and follow-ups

Native and web caches can temporarily differ after mutation. Use authoritative refresh/invalidation behavior and document compatibility rather than inventing client-side scheduling state. Native Mapbox or push reminders require separate contract/tickets if later requested.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: No review created.
- Deployment or release: Not distributed.
