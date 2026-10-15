# Ticket DEV0242: Preview training navigation and request badges

- Status: Blocked
- Created: 2026-10-15
- Last updated: 2026-10-15
- Milestone: Authenticated workspace design exploration
- Coordination: None — independent development ticket
- Related records: private-shell baseline [DEV0203](../../archive/frontend/DEV0203-introduce-authenticated-workspace-shell.md); coach connections baseline [DEV0222](../../archive/frontend/DEV0222-add-coach-my-athletes.md); athlete connections baseline [DEV0223](../../archive/frontend/DEV0223-add-athlete-my-coaches.md)

## Objective and context

Present the two proposed discoverability improvements after manual testing required help finding coach bookings and an incoming connection request: distinguish sessions attended as an athlete from sessions taught as a coach, and draw attention to incoming requests. The user requested a visual proposal, not application implementation. The [current navigation contract](../../../docs/mvp-spec.md#9-scheduling-behavior-and-permissions) and [connection contract](../../../docs/mvp-spec.md#49-connect-after-a-confirmed-session) remain authoritative.

## Scope and non-goals

- In scope: one interactive in-conversation interface proposal, with coach/athlete example views, desktop/mobile navigation, explicit training/coaching labels, incoming-request badges and prominent review links. Persist only local preview selections when the host supports it.
- Out of scope: modifying application routes, labels, server queries, counts, polling, consent, bookings, migrations, Auth, environment settings or deployment. Automatic refresh and stale booking-list fixes are separate possible follow-ups. The user's later commit request authorizes a checkpoint of this record; the ignored visual source is not included in that documentation checkpoint.

## Expected behavior and edge cases

The coach example opens Schedule with a visible booking-request alert and badge leading to Bookings. My training clearly means sessions attended. The athlete example exposes a coach connection request through My training and My coaches. Pending connection requests remain separate from accepted connections. All people, counts and future session times in the visual are labelled examples and never fetched from private records. Local navigation, review links, example decisions and optional design alternatives work with mouse and keyboard. Layout fits desktop and 375-pixel mobile widths without clipped controls.

## Assumptions, decisions, and dependencies

- Confirmed: the user asked to see proposals 1 and 2, covering role clarity and request visibility.
- Confirmed design preference, 2026-10-15: the user reviewed the proposal and found its separate views substantially more readable than the previous long page. Preserve one active task view at a time: personal training apart from coaching, and Booking requests / Booked sessions / My athletes as separate coach Bookings views. Request indicators keep pending work discoverable across views. This feedback establishes the preferred direction; it does not claim runtime implementation or completed browser validation.
- Proposed, not adopted: My training replaces My sessions in the example; attention badges and review prompts identify the destination containing pending work. Existing Profile / Schedule / Bookings order is retained.
- Use an HTML fragment in the ignored repository work directory, following the visualization skill. No external resources or private account information are needed.
- Scope review: one bounded design artifact; no coordination split or specification change is required.

## Implementation plan

1. Reserve this identifier and record scope before creating the visual.
2. Build a responsive fragment at work/previews/training-navigation-and-request-badges.html with local view/section controls and optional wording/attention alternatives.
3. Validate syntax, bounded/self-contained content, local interactions, desktop/mobile rendering and keyboard use; retain exact observations and limitations.
4. Finish and archive this preview record only if its checks pass, update affected links/index, and present the proposal for review without changing the product contract.

## Acceptance criteria

- [ ] AC1: The coach and athlete examples distinguish personal training from teaching and expose pending work through consistent labels, badges and review links.
- [ ] AC2: Local navigation and example request interactions update the correct view/counts; pending requests never appear as accepted relationships before an explicit example acceptance.
- [ ] AC3: JavaScript syntax, desktop/mobile/keyboard review, self-containment, affected links and formatting checks pass; limitations are recorded.

## Validation plan

Inspect the visual with native browser controls at desktop and a 375-pixel preview width. Exercise role/navigation/review controls and keyboard activation. Check extracted JavaScript with node --check, verify no network/data APIs or secret content, format the fragment and ticket and check local Markdown links plus git diff --check. Application tests, lint, type checks, builds and database rehearsals are not applicable because no runtime code or data changes.

## Implementation record

The interactive visual is delivered for user review. Source-runtime/static checks and desktop/phone observations passed as recorded below; final keyboard and complete recipient browser checks remain blocked by the native browser-control session.

### Changes and rationale

Created the requested role-navigation and pending-work proposal. Daniel’s example separates My training (sessions attended) from Coach workspace (sessions taught), preserves Profile / Schedule / Bookings order and shows two incoming booking requests in navigation badges and a review banner on Schedule. The review link opens the queue. Max’s example omits coaching navigation, draws attention to a coach connection request through My training / My coaches and keeps incoming requests separate from accepted coaches. Example acceptance clears only the corresponding pending count. Mobile presents the destinations in a bottom navigation row. These are illustrative local states, not private application data.

The view offers coach/athlete and desktop/mobile selections. Optional host design controls compare My training with My sessions · as athlete, and a banner with a compact attention prompt. A host state-save echo initially rebuilt the preview and could remove keyboard focus; equivalent echoed snapshots are now ignored before final source-runtime validation.

### Affected files

| File or component                                         | Change and purpose                                                                           |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| This ticket and [index](../../README.md)                  | Own the preview scope, evidence and identifier.                                              |
| work/previews/training-navigation-and-request-badges.html | Ignored in-conversation proposal; source remains local and contains only illustrative state. |

Supporting files under ignored work/previews/: check-workspace-proposal.mjs exercises actual fragment event handlers with a minimal document stand-in; workspace-proposal-check.js is the extracted syntax-check input; training-navigation-and-request-badges-standalone.html is a generated local browser-review wrapper. They are not application code or permanent application tests.

### Decisions and deviations

2026-10-15 user review: the previous single-page arrangement required too much effort to follow. Carry the preview’s task separation into a future runtime ticket, preserving visibility of incoming work through badges and review links. Exact naming and badge implementation remain proposals until the runtime scope and specification are updated.

2026-10-15: Restrict this change to proposals 1 and 2. No automatic refresh, runtime badges, naming adoption or backend repair is implemented by a design preview.

### Contracts, configuration, and operations

None changed. Preview state is local; no application, Auth, database or provider calls occur. The source is ignored under work/ and is not a published site or committed product asset.

## Validation results

2026-10-15, Node.js 24.21.0 and native Chrome/Safari:

- `node work/previews/check-workspace-proposal.mjs`: 20 source-runtime interaction, equivalent host-state echo and boundary assertions passed. Exercised coach queue navigation, example booking acceptance/count changes/booked section, distinct personal training, athlete navigation, incoming connection review/acceptance, cleared badges, mobile selection and restored alternate wording/state. This diagnostic uses a minimal document stand-in and does not claim actual focus, visual layout or browser interaction coverage.
- `node --check work/previews/workspace-proposal-check.js`: passed for the extracted final script. Fragment checks confirm under 1 MB, no document wrapper, literal markup and no network/data API calls.
- `npx --no-install prettier --ignore-path /dev/null --check work/previews/training-navigation-and-request-badges.html work/previews/check-workspace-proposal.mjs` and `npx --no-install prettier --check tickets/current/frontend/DEV0242-preview-training-navigation-and-request-badges.md`: passed after formatting. The explicit ignore override is needed because work/ is intentionally ignored.
- The visualization skill’s render.py created an ignored standalone review wrapper. Chrome initially rendered the desktop proposal: role labels, badges, Schedule review banner and teaching times were visible. Clicking Review requests visibly opened the two pending Amina/Lina example cards and Bookings navigation. This observation precedes the final equivalent-state-echo focus correction.
- A later Chrome screenshot recovered by raising the window showed device mode at 393 × 830 and 75% zoom. The wrapper leaves horizontal padding, so this is not claimed as an exact 375-pixel viewport check. The final coach view visibly reflowed to a phone: readable request banner, vertically arranged teaching schedule and bottom My training / Coach workspace navigation with badge. No clipping was visible in that observed view.
- Browser limitations: after reload, native observations repeatedly showed a blank document or stale tree despite successful local HTTP delivery; an action encountered a user-changed window, one read took about 65 seconds, and a later read returned cgWindowNotFound. Safari did not yield a reliable document observation. A separate loopback-only preview server on port 3114 returned HTTP 200 but did not resolve all observation issues; that review server was stopped afterward. Final keyboard/focus behavior, exact 375-pixel layout and complete athlete acceptance/decline controls in a real browser remain unverified. No application controls or data were changed for this preview.
- Local Markdown links, unique identifier/index reservation and `git diff --check`: passed. The current specification is unchanged because the visual is a proposal.
- Application tests/lint/type/build, database rehearsals and hosted checks were not run: no runtime code, dependencies, environment or application data changed.

| Criterion | Evidence                                                                                                                                        | Result             |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| AC1       | Coach desktop/phone observations; athlete semantics/navigation exercised by the source-runtime diagnostic. Final athlete visual review pending. | Partially verified |
| AC2       | 20 source-runtime assertions; actual desktop Review requests navigation observed. Final browser decision/focus review pending.                  | Partially verified |
| AC3       | Final syntax/self-containment/format/link checks passed; exact mobile and keyboard browser review remains blocked.                              | Partially verified |

## Risks, limitations, and follow-ups

Runtime adoption needs its own scoped development ticket and specification review. Counts require authoritative actor-scoped reads; this proposal supplies no count API and promises no automatic updates. Handoff: the source is presented for review with the checks above. Next action is to finish coach/athlete acceptance/decline and keyboard focus checks in a reliable browser at desktop and exactly 375 pixels, then complete/archive only after the outstanding criteria pass.

## Completion and review references

- Completed: Not completed.
- Commit: Documentation checkpoint — `[DEV0242][DEV0243] Checkpoint navigation and mailbox planning`; preview source remains ignored and final browser checks remain outstanding.
- Review: Source/static and partial native visual self-review; final manual checks pending. No independent review.
- Deployment or release: Not applicable — local design proposal only.
