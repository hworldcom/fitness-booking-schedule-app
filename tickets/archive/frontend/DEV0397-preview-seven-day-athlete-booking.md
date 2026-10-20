# Ticket DEV0397: Preview seven-day athlete booking

- Status: Completed
- Created: 2026-10-20
- Last updated: 2026-10-20
- Milestone: M10 coach marketplace booking refinement
- Coordination: None — independent development ticket
- Related records: Existing login-only schedule: [DEV0366](../frontend/DEV0366-require-login-for-private-coach-schedules.md). Core public coach booking is defined in the specification links below. Historical preview cleanup: [DEV0390](../organisatory/DEV0390-remove-unneeded-design-previews.md).

## Objective and context

The user reports that private-session booking changes presentation after first registration/login: the public seven-date/count view becomes a class/venue/date form with a native calendar picker and one day's loaded times. They want the public seven-day presentation retained after login, bookable hours visible for every day, and navigation to the following seven days. Prepare an interactive HTML design preview before changing the product implementation. Follow [public coach booking](../../../docs/mvp-spec.md#192-public-content-and-template) and [duration-aware booking](../../../docs/mvp-spec.md#186-session-types-and-flexible-bookings).

## Scope and non-goals

- In scope: a standalone HTML prototype with the current lavender/mint/purple visual language, guest/signed-in comparison, seven-day time cards, class/venue selection, Previous/Next 7 days within the existing thirty-date horizon, time selection/request review/pending example, and clear empty/unavailable states; responsive/keyboard review and a loopback-only review URL. Record the confirmed presentation target separately from preview defaults in the specification.
- Out of scope: editing Next.js booking components/routes, real registration/Auth, live availability/booking APIs, changing scheduling/capacity/price/privacy rules, writing account or database data, deployment and committing artifacts. Preserve retained data and the existing application.

## Expected behavior and edge cases

Default signed-in view shows today plus six Berlin dates with available start-time buttons directly under each day; no month calendar or separate date picker is required. Advance or return in seven-day groups, preserve the thirty-date boundary and show a shorter final group. Selecting an example time opens an explicit review before a local pending-request illustration. Class/venue/week changes clear incompatible selections. Guest view shows dates/counts only and a local sign-in illustration that returns to the selected day's week without choosing/submitting a time. Verified empty, no times on one day, loading failure/retry and selected/request-sent states remain distinct. All prototype times/accounts are fictional; no actual request is sent.

## Assumptions, decisions, and dependencies

- Confirmed by the user on 2026-10-20: retain seven-day presentation after login, show bookable hours for each day, support the next seven days, and prepare HTML for review first.
- Existing contracts remain: private times require login, explicit coach confirmation, actual selected class duration/venue, Berlin dates and thirty-date horizon. This prototype does not prove runtime authorization or booking correctness.
- Proposed preview defaults, not additional confirmed requirements: seven columns on wide desktop and wrapping day cards on small screens; class/venue preselected only to make the sample immediately reviewable; explicit review/pending panel; page ranges anchored to today rather than Monday; shorter final two-date page. Validate these through the prototype before adopting production UI.
- Store the prototype under ignored `work/dev0397/` with an openable single HTML file and a small loopback server. Reuse the existing installed font bytes inline; add no image binaries or restored tracked preview tree. This honors the earlier preview-artifact cleanup while delivering the newly requested example.
- Static HTML/CSS/JavaScript only: no Next.js/framework integration or database setup is needed. Do not start the normal development launcher because it can apply unrelated pending local migrations.

## Implementation plan

1. Create this ticket/index entry before the prototype; inspect current guest/signed-in components, palette and product contracts.
2. Build the self-contained example and loopback-only server with exact routes and disconnected in-memory interactions. Label the sample data/preview; use no API calls, browser storage, account actions or external assets.
3. Record the confirmed presentation amendment as a target in the specification, explicitly retaining existing implemented behavior until a separate implementation change.
4. Verify desktop/phone layouts, week boundaries, duration/place changes, selection/review/pending, guest continuity, empty/failure/retry and keyboard/Escape/focus. Check syntax, exact HTTP allowlist/method rejection and document/fragment links.
5. Finish the preview record with actual checks, review URL and limits; archive only after preview acceptance criteria pass. User design acceptance and runtime implementation remain separate.

## Acceptance criteria

- [x] AC1: A locally openable standalone HTML preview retains seven-day continuity and exposes each signed-in day's times with forward/back week navigation within thirty dates.
- [x] AC2: Responsive and keyboard checks pass for date/time selection, class/place changes, review/pending and guest continuity; no month calendar is introduced.
- [x] AC3: Empty/unavailable/retry states are distinct; examples are clearly fictional and perform no application/API/storage/database writes.
- [x] AC4: Syntax/static/server/link checks pass, original assets/data are preserved, and the durable record distinguishes the preview/confirmed target/proposed defaults from runtime delivery.

## Validation plan

Use syntax checking of the inline interaction code and loopback server, exact-route/method/content checks, document/fragment consistency and native Chrome at desktop and phone widths. Exercise Next/Previous/This week and last-page limits, class duration and venue updates, time review/cancel/Escape/focus return/pending example, public-to-demo-login continuity, empty and unavailable retry. Check no external connections/storage/API mutation code exists and original font bytes are reused unchanged. No app/unit/database/build suite is required for this disconnected artifact because no application/framework/schema code changes. Do not claim a design preview proves real Auth/availability or hosted booking correctness.

## Implementation record

### Changes and rationale

Created a self-contained seven-day booking design in the existing lavender/mint/purple palette. Signed-in examples show daily start buttons, class/place filters, bounded week paging and explicit request review/pending feedback. Public examples show seven date/count buttons and reveal the same week after mock sign-in without selecting a time. Empty-week and failed-read examples have distinct recovery actions. All data is fictional and local memory resets on reload.

The final preview-only toolbar uses explicit availability-state buttons so empty/error examples are discoverable. Native Safari initially rendered compact default select controls; normalizing their appearance gives class/place fields the same readable size across browsers. Selecting a time also clears the temporary guest-return date outline.

### Affected files

- Ignored `work/dev0397/index.html`: single HTML/CSS/JavaScript artifact, including unchanged installed Manrope/Bricolage font bytes; no image files or external resources.
- Ignored `work/dev0397/serve.mjs`: exact-route, GET/HEAD-only HTTP server on `127.0.0.1:3197`, with `no-store` and no directory/file traversal.
- Ignored `work/dev0397/check-static.py`, `interaction-check.js` and `check-interactions.mjs`: reproducible static/syntax and unit interaction checks. The unit check uses a DOM substitute, not browser automation.
- [Specification](../../../docs/mvp-spec.md#196-cards-username-urls-and-scheduling-compatibility): dated presentation target, distinct from the current application.
- This record and the [ticket index](../../README.md): scope, evidence and ownership. No production source/schema or retained assets/data were changed by DEV0397.

### Decisions and deviations

2026-10-20: Preview before runtime changes, as explicitly requested. Keep artifacts outside tracked production/static directories following DEV0390.

### Contracts, configuration, and operations

No runtime/schema/API/environment/dependency changes. A local-only example with in-memory fictional state, reset on reload. Stop its owned server to remove the review URL; no app/data rollback required.

## Validation results

2026-10-20, local macOS. Passed:

- `python3 work/dev0397/check-static.py`: 51 unique IDs; valid label/dialog references; no external URLs, network/storage calls or date picker; both embedded fonts match installed originals byte for byte; exact HTML matches the served response. GET `/` and `/index.html` and HEAD `/` return 200; env/traversal/query routes return 404; POST/PUT/DELETE return 405; every response is `no-store`.
- `node --check work/dev0397/serve.mjs` and `node --check work/dev0397/interaction-check.js`: passed.
- `node work/dev0397/check-interactions.mjs`: seven interaction groups passed: initial 23 starts, all five pages across month boundaries with final two dates, duration/place resets, empty-week recovery, unknown availability/retry, guest continuity and explicit review/pending. These are unit checks with a DOM substitute and do not prove real browser/database behavior.
- Native Firefox at 1280-pixel desktop and 375×568 phone viewport: readable seven-column/two-column cards without horizontal page overflow; real button selection, week boundary, Previous/This week, 90-minute end times, venue reset, guest return, request review and local pending observed. Desktop Escape returned focus to Review request; keyboard class/place selection and mock sign-in passed. The mobile review fits within the short viewport.
- Native Safari at approximately 1230-pixel desktop and 375×844 phone viewport: final toolbar and normalized fields fit; empty week shows verified zero with next-week recovery; loading failure shows unknown availability and an explicit Try again. Retry restores selected class/place. Both messages/actions were visually inspected at both widths.
- `git diff --check`: passed for the preview change. New ticket/spec/index links checked when archiving.

Chrome capture/activity errors and Firefox window switching interrupted some attempts; Safari completed the final availability-state visual checks. No real authentication/availability/booking/database rehearsal, app lint/typecheck/build or deployment was performed for the disconnected prototype because it changes no runtime source or data. Those checks belong to the implementation ticket.

AC1–AC4 passed for the preview. The user accepted the design and requested implementation on 2026-10-20.

## Risks, limitations, and follow-ups

This is a design proposal, not live booking. Actual seven-day detail reads, canonical date continuation, guest privacy, concurrent changes and real request recovery are owned by [DEV0399](DEV0399-implement-seven-day-athlete-booking.md). Prices, availability and fictional identity are illustrative only. Existing DEV0393 cache work and the pending DEV0396 migration are untouched.

## Completion and review references

- Completed: 2026-10-20 — interactive preview prepared, verified and accepted; runtime delivery remains separate.
- Commit: Included with the adopted runtime implementation in `[DEV0397] [DEV0399] Implement seven-day athlete booking`, authorized on 2026-10-20. The ignored HTML artifact is excluded.
- Review: Self-review and native desktop/phone checks passed. User accepted the preview on 2026-10-20; no independent code review.
- Deployment or release: Local preview at http://127.0.0.1:3197/#week-title; open `work/dev0397/index.html` directly or restart with `node work/dev0397/serve.mjs`. The ignored artifact is intentionally absent from Git/static production assets following DEV0390.
