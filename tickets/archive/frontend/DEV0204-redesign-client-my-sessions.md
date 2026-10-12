# Ticket DEV0204: Redesign client My sessions

- Status: Completed
- Created: 2026-10-12
- Last updated: 2026-10-12
- Milestone: Scheduling interface authenticated-workspace follow-up
- Coordination: [COR0018 — Authenticated workspace redesign](../../current/organisatory/COR0018-authenticated-workspace-redesign.md)
- Related records: completed contract [DEV0202 — Adopt the authenticated workspace redesign contract](../organisatory/DEV0202-adopt-authenticated-workspace-redesign-contract.md), completed shell dependency [DEV0203 — Introduce the authenticated workspace shell](DEV0203-introduce-authenticated-workspace-shell.md), client request baseline [DEV0190 — Add the client booking-request flow](DEV0190-add-client-booking-request-flow.md) and portrait baseline [DEV0173 — Show coach portraits in client sessions](DEV0173-show-coach-portraits-in-client-sessions.md)

## Objective and context

Recompose `/sessions` using the approved authenticated design so pending requests, confirmed upcoming sessions and retained history are easy to scan and no longer look like the legacy interface. Keep every projection and action actor-scoped and truthful.

## Scope and non-goals

- In scope: page heading/summary, pending request hierarchy, upcoming/history grouping, coach identity, status/date/location presentation, cancellation/withdrawal actions and empty/unavailable states.
- Out of scope: coach-owned requests/bookings, session notes, new data fields, fabricated training titles/messages, route or policy changes.

## Expected behavior and edge cases

- Client-owned pending requests and confirmed sessions are visually distinct; pending never reads as booked or reserved.
- Coach portrait/initial and full identity remain linked to the public coach profile.
- Coach actors receive a concise explanation that these are sessions requested as a client and can reach Coach workspace separately.
- Empty, terminal, unavailable and busy/action-result states remain complete at desktop/mobile widths.

## Assumptions, decisions, and dependencies

- DEV0203 supplies the authenticated frame.
- Existing request and booking projections remain authoritative; the concept's training titles, messages and notes controls are not available data.
- Current action semantics and Berlin time presentation remain unchanged.

## Implementation plan

1. Build one client-session page hierarchy around existing request and booking components.
2. Adapt cards/groups/statuses to the approved authenticated visual language without merging request and booking state.
3. Add ordinary-client and coach-as-client browser coverage for ready/empty/unavailable/action states.
4. Validate responsiveness, keyboard actions and all relevant static/build checks.

## Acceptance criteria

- [x] AC1: Pending, upcoming confirmed and history content is clearly separated and uses only authoritative actor-scoped data.
- [x] AC2: Coach identity/profile navigation, withdrawal/cancellation and pending-versus-confirmed language remain correct.
- [x] AC3: Empty/unavailable/busy/result states remain actionable and responsive for client and coach actors.
- [x] AC4: Relevant tests, lint, type-check, formatting and build pass.

## Validation plan

- Extend component tests for hierarchy/status and coach-as-client explanation.
- Run authenticated Playwright at 375, 430 and desktop widths for populated, empty and failure states plus keyboard actions.
- Run application tests and static/build checks.

## Implementation record

Implementation started on 2026-10-12 after DEV0203 completed and browser review confirmed that the shared shell now matches the approved direction while the My sessions interior still uses the previous stacked-panel composition.

### Changes and rationale

- Added one `My sessions` page heading and anchored section navigation so booking requests, confirmed training and retained history read as one authenticated workflow instead of two unrelated legacy panels.
- Reworked request and booking cards into responsive full-width rows with coach-local date tiles, linked coach identity, explicit status, time, location and a separate action area. Pending request copy remains explicit that no session exists until coach acceptance; terminal request attempts remain history rather than being presented as completed training.
- Preserved the optional public coach portrait on confirmed bookings and added a stable initials identity for request cards, whose existing private projection intentionally does not expose a portrait URL. No title, message or note data was fabricated from the approved visual concept.
- Added a capability-derived coach-as-client explanation linking to Coach workspace. It uses the existing coach access read service only to decide whether the explanatory affordance is relevant; it grants no access and changes no route policy.
- Added a shared, coach-timezone date presentation helper and tests across a UTC date boundary. Full accessible timestamps remain present in each card's facts; the compact tile is decorative.
- Strengthened the authenticated rehearsals for the new hierarchy, real ordinary-client lifecycle, coach-as-client boundary, 375/430-pixel overflow and 44-pixel actions. The populated rehearsal now waits for page network idle before mutation clicks so it cannot click server-rendered controls before React attaches the existing action handlers.

### Affected files

| File or component | Change and purpose |
| ----------------- | ------------------ |
| `src/app/sessions/page.tsx` | Adds the unified page heading, section navigation and capability-derived coach-as-client context. |
| `src/features/profile/client-booking-requests.tsx` | Rebuilds pending and terminal request cards around truthful status, linked coach initials, date, location, deadline and withdrawal action. |
| `src/features/profile/client-sessions.tsx` | Presents upcoming/history booking rows while retaining the established coach portrait/initial and public-profile navigation component. |
| `src/features/profile/client-session-date-tile.tsx` | Provides the shared decorative coach-timezone day/month/weekday tile. |
| `src/app/client-sessions-workspace.css` and `src/app/layout.tsx` | Add scoped page/card responsive presentation after the authenticated shell styles. |
| `tests/coach-bookings.test.ts` | Proves coach-timezone date identity across a UTC day boundary and the rendered timestamp contract. |
| `scripts/rehearse-local-email-auth.mjs` | Extends the empty ordinary-client rehearsal with the unified heading and page-section navigation. |
| `scripts/rehearse-local-client-booking-requests.mjs` | Exercises populated request/booking cards, coach-as-client context, responsive dimensions and reliably hydrated actions. |
| `tickets/README.md` and `tickets/current/organisatory/COR0018-authenticated-workspace-redesign.md` | Track ticket and workstream lifecycle. |

### Decisions and deviations

- The section controls are anchored in-page navigation, not tabs that hide content. This keeps pending, upcoming and historical records discoverable together and does not add client state or change URL query contracts; the current target receives the selected treatment.
- Request cards use an initials avatar because the authoritative client request projection does not contain a coach portrait. Confirmed sessions continue to use the optional public portrait. Expanding the private projection was unnecessary for this visual ticket.
- Existing accepted request history remains visible alongside its confirmed booking. The request is the historical decision attempt; the booking is the authoritative session, and the copy explicitly distinguishes them.

### Contracts, configuration, and operations

No data shape, action, API, schema, environment variable, dependency, setup, migration or rollback contract changed. `/sessions` additionally calls the existing coach-access read service to render explanatory copy for coach-capable accounts. Scheduling actions, actor scoping, pagination and Berlin/coach-timezone semantics remain unchanged.

## Validation results

Validated locally on 2026-10-12 with the required Node.js 24.21.0 runtime, the Auth-enabled local Supabase/PostgreSQL/Mailpit stack and Chrome.

| Criterion | Evidence | Result |
| --------- | -------- | ------ |
| AC1 | The authenticated lifecycle rehearsal rendered separate pending/request-history and upcoming/session-history groups after withdrawal, decline, acceptance, closure and expiry. Accepted request copy names the separate Upcoming booking. | Passed |
| AC2 | The rehearsal retained public coach links and confirmed-booking portrait, exercised withdrawal/cancellation controls and never exposed the competing client's identity. Unit rendering retains portrait and initials fallbacks. | Passed |
| AC3 | Empty client and pending-applicant Auth rehearsal passed. The populated rehearsal covered action results, coach-as-client context, 375/430-pixel overflow and 44-pixel actions; inspected desktop/mobile screenshots remained readable. | Passed |
| AC4 | `npm test`, lint, type-check, formatting, Node 24 production build, focused shell regression, both authenticated rehearsals and `git diff --check` passed. | Passed |

- `npm test` — passed: 122 unit tests and 9 React-server tests.
- `npm run test:auth` — passed the empty ordinary-client and pending-coach-application paths with the new hierarchy.
- `npm run test:client-requests` — passed on a fresh Node 24 development server and again against a Node 24 production build. It covered persistence, withdrawal/retry, decline/retry, acceptance, closure, expiry, booking continuity, candidate privacy, keyboard use, coach-as-client context and responsive layout.
- `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build` and `git diff --check` — passed. The production build used the repository-required Node.js 24.21.0 runtime.
- Focused configuration-free Playwright public/private shell regression — passed in desktop and mobile projects after the new scoped stylesheet was added.
- Desktop 1440-pixel and mobile 430-pixel populated screenshots were inspected. Cards retain date, status, coach identity, time, place and actions without horizontal overflow; the fixed bottom navigation has reserved page space.
- Two early development-server rehearsal attempts timed out at different mutations because the script could click server-rendered controls before hydration. Waiting for network idle at mutation pages made the flow deterministic; development and production reruns passed.
- An exploratory production rehearsal under the unsupported Node 20 runtime completed all actions but reported recoverable React text hydration errors. Rebuilding and rerunning under the repository-required Node 24.21.0 runtime passed with no page errors; Node 20 evidence was not used for completion.

## Risks, limitations, and follow-ups

- Request and booking records must remain separate even when presented on one page.
- Session collaboration remains owned by COR0015.

## Completion and review references

- Completed: 2026-10-12.
- Commit: This completed record is included with the implementation commit whose subject references DEV0204.
- Review: No review created.
- Deployment or release: Not deployed or released.
