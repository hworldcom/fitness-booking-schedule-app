# Ticket DEV0020: Discovery improvements and How it works

- Status: Completed
- Created: 2026-09-19
- Last updated: 2026-09-19
- Milestone: M0 public frontend refinement; M2 state-aware actions remain dependent on backend
- Coordination: None — independent development ticket
- Related tickets: [DEV0008](DEV0008-repx-club-frontend.md), [DEV0019](DEV0019-public-discovery-access.md), [COR0002](../organisatory/COR0002-phantom-auth-and-demo-access.md), converted from retired DEV0016; [COR0006](../organisatory/COR0006-persistent-access-catalogue.md), converted from retired DEV0017

## Objective and context

Implement the user's accepted discovery recommendations and a prominent public “How it works” guide. Make challenge costs, dates and decision rules easier to compare; help visitors search, share and discover related activities. Follow the [screen and guest access contract](../../../docs/mvp-spec.md#2-screens-and-actions) and preserve honest preview states.

## Scope and non-goals

- In scope: compact challenge introduction; card entry/start/decision metadata; activity/text filtering and starting-soon/newest ordering; global search covering classes, studios, events and challenges; consistent challenge rule summaries; public how-it-works route/navigation; reusable copy-link control with failure recovery; related seeded activities; explicit entry-panel preview/next-step explanation; specification and future integration handoff.
- Out of scope: database/Auth/wallet integration, fabricated live registration/voting/payout states, comments/rankings, changes to proposed financial rules, private draft sharing, external messages, new primary tabs or a second Explore search field.

## Expected behavior and edge cases

Explore/Challenges/search/guide and public detail links work without login or a wallet. Search includes title/activity/organizer/venue fields and has useful empty/reset states. Chronological sorting uses explicit fixture dates, not formatted date text or the computer clock. Bookmark/draft behavior remains local. Community and sponsored rules distinguish proposed defaults from confirmed fallbacks. Events remain benefits-for-every-ticket experiences with no winner. Sharing copies a public detail URL only; denied/unavailable clipboard offers a selectable link without false success. The entry panel explains current preview status; real state-dependent actions remain backend work.

## Assumptions, decisions, and dependencies

Use existing components/styles and installed Next.js 16.3.5. A secondary `/search` route avoids adding another Explore search field; `/how-it-works` is public and readable on desktop/mobile. A compact guide and consistent rules are implemented now. Join/participate/vote/claim controls will become live when verified backend/program states exist, as recommended in the accepted review. This is not approval of unresolved P policies.

## Implementation plan

1. Read relevant bundled Next.js docs, current fixtures/components and browser tests; record this ticket before implementation.
2. Add typed chronological fixture fields and reusable discovery filtering/search helpers; enrich challenge cards and filters while reducing duplicate introductory copy.
3. Add the global search results and How it works routes/navigation, standardized rules summaries and clear preview next-step panel; add public sharing/related seeded activities.
4. Update the single specification and 0016–0017 handoff for public helper routes, search privacy and eventual state-aware actions.
5. Run meaningful filter/order/search and browser tests including clipboard failure, keyboard guide/navigation, responsive layouts and existing regressions; lint/type/format/build, inspect screenshots, complete the ticket and index.

## Acceptance criteria

- [x] AC1: Cards expose entry/date/decision metadata; combined challenge text/activity/mode filters and deterministic chronological sorting work with appropriate empty/reset behavior.
- [x] AC2: Global search finds classes/studios/events/challenges and their public destinations without searching private drafts or adding an Explore search field.
- [x] AC3: Public How it works is easy to reach and explains classes/events/community/sponsored flows and preview limits; every challenge shows a consistent rules summary without silently approving P policies.
- [x] AC4: Public challenge/event links can be copied or manually selected after clipboard failure; related activities are relevant. Entry UI never implies real entry/funding/payout and future live states are recorded as dependent work.
- [x] AC5: Desktop/mobile, keyboard, failure, domain and browser regression checks plus lint/type/format/build pass; documentation and durable evidence are complete.

## Validation plan

Unit tests for combined filters, exact ordering, cross-type search and empty input. Browser flows for guide access, filters/reset, search destinations, rules, share success/failure, related content, public reloads and honest preview state. Existing mobile/desktop projects cover keyboard and overflow; inspect screenshots. Run `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build`, `npm run test:e2e`. Markdown link consistency check. No database migration/devnet rehearsal applies to this frontend-only slice.

## Implementation record

### Changes and rationale

The previous global search only navigated to Explore, challenge cards omitted entry/date/decision information, and guidance lived mainly in preview dialogs and long detail text. Visitors now have a header-level How it works guide, grouped public catalogue search, combined challenge discovery controls and comparable cards. Example: searching “coffee” finds both Run & Coffee and The 5K before coffee; choosing Yoga while searching coffee gives a clear empty/reset state. Newest places The show-up club first by its fixture creation timestamp.

Every challenge has a five-question summary, the sponsored example retains its detailed winner criteria, and full terms can be expanded. The existing sticky panel explicitly says entry is not open, offers save/read-rules actions and explains future participation steps. Public detail links copy without query parameters; denied/unavailable clipboard access reveals a selectable URL. Related content uses actual venue association or matching activity. Private event drafts have no share control.

### Affected files

| File                                                                                                                                                                                                                                                                                       | Change and purpose                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guide route (historical path `src/app/how-it-works/page.tsx`), [shell](../../../src/components/shell.tsx)                                                                                                                                                                                  | Public walkthrough, four participation types, keyboard-friendly FAQs and navigation; mobile search entry point and named icon-only wallet control. |
| Search route (historical path `src/app/search/page.tsx`), search queries (historical path `src/features/discovery/queries.ts`), [challenge retirement record](DEV0060-replace-challenge-surfaces-with-access-navigation.md), related selection (historical path `src/domain/discovery.ts`) | Public-only grouped search, normalized multiword matching, challenge filtering/ordering and deterministic related links.                           |
| Fixtures (historical path `src/features/preview/catalogue.ts`), [challenge retirement record](DEV0060-replace-challenge-surfaces-with-access-navigation.md)                                                                                                                                | Explicit start/end/creation dates and optional venue association; safe query/mode parameters and guide deep links.                                 |
| [Retired challenge screens](DEV0060-replace-challenge-surfaces-with-access-navigation.md), [cards](../../../src/components/ui.tsx)                                                                                                                                                         | Shorter introduction, filters/reset/empty states, entry/date/decision facts, rules summaries and honest preview next step.                         |
| Discovery extras (historical path `src/components/discovery-extras.tsx`), events (historical path `src/features/events/events.tsx`)                                                                                                                                                        | Reusable clean-public-link copying, accessible manual fallback and relevant public activities; draft sharing excluded.                             |
| [Styles](../../../src/app/globals.css)                                                                                                                                                                                                                                                     | Responsive guide/search/cards/summary layouts, narrow header controls, focus-compatible disclosure and live-region helper.                         |
| Domain tests (historical path `tests/discovery.test.ts`), browser tests (historical path `tests/browser/discovery.spec.ts`)                                                                                                                                                                | Filter intersections, chronology, search types, related links, keyboard guide, share success/failure, clean URL, public routes and narrow layouts. |
| [Specification](../../../docs/mvp-spec.md#discovery-and-how-it-works), [README](../../../README.md), [index](../../README.md)                                                                                                                                                              | C18, implemented screen behavior, A56–A57, navigation and delivery status.                                                                         |
| [COR0002](../organisatory/COR0002-phantom-auth-and-demo-access.md), converted from retired DEV0016; [COR0006](../organisatory/COR0006-persistent-access-catalogue.md), converted from retired DEV0017                                                                                      | Future public helper-route access, private search boundaries and preservation of discovery behavior during backend integration.                    |

### Decisions and deviations

- 2026-09-19: Adopted a public secondary guide page rather than a blocking onboarding dialog, so visitors can browse and return at their own pace. No new primary tab.
- Added a secondary search page; Explore keeps its existing activity/date/time structure without another text field.
- Retained the review's sequencing: live join/vote/claim actions remain dependent on verified M2 state. This slice explains that sequence and offers working save/share actions; it does not invent funded/active/voting fixtures. Proposed P policies remain visibly proposed.
- No product-scope deviation. Generated Next.js build output was moved to a temporary backup after a sandbox failure persisted in the cache; the unchanged normal build command then passed outside the sandbox. No build configuration workaround or dependency change was needed.

### Contracts, configuration, and operations

Added public `/search?q=…` and `/how-it-works` routes. `/challenges` accepts optional `q` and `mode=community|sponsored`; invalid/repeated values fall back safely. Fixture challenge records gain `startDate`, `endDate`, `createdAt` and optional `venueId`. These fields are demonstration metadata, not chain deadlines. Browser storage format, financial state and privacy permissions are unchanged. No database migration, service account, credentials, dependency or environment-variable changes. No deployment or commit was made.

## Validation results

Date/environment: 2026-09-19, Node 20.19.1, Next.js 16.3.5, installed Google Chrome. Read the bundled `page.md` and `link.md` docs before implementing route/query behavior. Browser tests use the production build on isolated port 3101.

| Check                                   | Result / evidence                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm test`                              | **Passed: 18 tests**, including four new discovery tests. The first sandboxed attempt failed on the tsx IPC pipe (`EPERM`); the authorized outside-sandbox run passed. AC1/AC2/AC4.                                                                                                                                                                                                  |
| `npm run lint`                          | **Passed**, including final source/test edits. AC5.                                                                                                                                                                                                                                                                                                                                  |
| `npm run typecheck`                     | **Passed** after the new routes/tests were present. AC5.                                                                                                                                                                                                                                                                                                                             |
| `npm run format:check`                  | **Passed**, all configured source/tests/config matched Prettier. AC5.                                                                                                                                                                                                                                                                                                                |
| `npm run build`                         | **Passed**, including TypeScript and generation of `/how-it-works` and dynamic `/search`/`challenges`. Initial sandbox failure occurred when the CSS worker bound a port; one authorized retry replayed the cached failure. `mv .next /private/tmp/repx-next-0020-failed-build` preserved generated output, and the next authorized clean build passed. AC5.                         |
| `npm run test:e2e`                      | **Passed: 28 tests**, 14 each at 1440×1040 desktop and 393×852 mobile; includes five new flows per project and all existing regressions. Additional 320×780 checks cover guide, search, challenge list/detail and event detail without horizontal overflow or page errors. AC1–AC5.                                                                                                  |
| Screenshot review                       | Inspected desktop guide/cards/search and mobile guide/share-failure screenshots. Text, navigation, card facts, FAQ focus and manual-copy input remain readable without clipping. Generated evidence is under `test-results/discovery-*/`; actual observed behavior is recorded here so the review does not depend on retaining generated files. AC3–AC5.                             |
| `python3 -` (inline Markdown validator) | **Passed** local links/anchors and ticket/index status consistency across 21 navigation/spec/ticket documents; C01–C18, P01–P08 and A01–A57 remain unique/current. AC5.                                                                                                                                                                                                              |
| Local preview                           | `curl --silent --show-error --fail --max-time 15 --output /private/tmp/repx-0020-live-guide.html --write-out 'Guide HTTP %{http_code}\n' http://127.0.0.1:3100/how-it-works` returned **HTTP 200** with the new guide content. The old preview PID had already exited when a restart was attempted; the current project dev server was available and verified. No hosted deployment. |

Browser observations: keyboard activation opens the guide; FAQ disclosures work with Enter; guide mode links apply the expected challenge filter; search opens the event detail; filter conflicts produce an empty state and reset restores the examples. Copy success uses a clean public URL, and simulated clipboard denial yields a selected manual-copy field without false success. Existing local booking, draft persistence, sharing privacy, event/award distinction and storage-error flows continue to pass.

Not applicable: database/Auth authorization tests and real devnet rehearsal; this slice introduces neither backend nor signing. Those future requirements remain in their implementation tickets and the specification.

## Risks, limitations, and follow-ups

All catalogue activity remains seeded preview data. Verified auth/public projections depend on 0016–0017; live join/vote/claim depends on M1–M2. No financial policy is resolved by UI copy.

## Completion and review references

- Completed: 2026-09-19 — discovery and public guide implemented and validated.
- Commit: Not created.
- Review: Self-reviewed against AC1–AC5 and screenshots; no independent review.
- Deployment: None.
