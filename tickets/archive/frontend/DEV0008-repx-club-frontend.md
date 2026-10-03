# Ticket DEV0008: RepX Club frontend foundation

- Status: Completed
- Created: 2026-09-19
- Last updated: 2026-09-19
- Milestone: M0 frontend slice; not completion of M0 or the full MVP
- Coordination: None — independent development ticket
- Related tickets: [DEV0007 — EURC wallet contract](../blockchain/DEV0007-eurc-only-wallet-contract.md)

## Objective and context

Start implementing the agreed frontend-first MVP as **RepX Club**, with the hackathon tagline **Social fitness, onchain.** Build a polished, runnable Next.js application for the [four primary surfaces](../../../docs/mvp-spec.md#2-screens-and-actions), using clearly identified local demonstration data. Establish an implementation foundation without implying real bookings, authenticated permissions or deployed financial flows exist.

## Ticket consolidation — 19 September 2026

The user explicitly requested merging tickets 0010–0013 into 0008 and deleting their separate files. Record this documentation-only work in 0008, as requested; preserve the original implementation and validation history as dated refinements. This scoped exception does not change the general ticket-retention policy.

- Scope: consolidate the profile cleanup, Explore membership cleanup, Classes/Studios discovery, and paid events/explicit challenge prizes; update the current coverage summary, index and specification references.
- Non-goals: application code, product rules, runtime behavior, new implementation tickets, commits or deployment.
- Expected result: one completed frontend ticket containing each refinement's rationale, affected files, acceptance and exact validation evidence; no references to removed ticket files. Original test results remain historical rather than claims of a new run.
- Plan: read all five records; copy each refinement into a stable anchored section of 0008; distinguish current coverage from superseded intermediate UI; redirect links; verify preservation and references; remove the four source files and complete this record.
- Assumptions: the user's explicit consolidation/removal request authorizes modifying completed records. Former IDs remain reserved for historical traceability.
- Validation: compare transferred records with their originals, check local Markdown targets/anchors, confirm only documentation changed and all four source files are removed. Application tests are unnecessary for this documentation-only change.
- Acceptance: complete history, accurate current summary, corrected links/index and removal of all four separate files verified.

### Consolidation implementation and validation

Completed 19 September 2026. This file now contains all four original refinement records, with heading levels adjusted to fit the combined document and cross-references redirected to stable local anchors. The current coverage summary distinguishes the final frontend from historical UI and test counts. [The ticket index](../../README.md) has one frontend entry, and [the specification](../../../docs/mvp-spec.md) links here for paid-event implementation evidence. The four separate 0010–0013 files were removed only after verifying their full transferred bodies. No new ticket was created.

Validation used a Python snapshot/comparison of the original records, SHA-256 hashes for `src/`, `tests/` and `public/`, and local Markdown file/anchor checks across README, AGENTS, the specification and every remaining ticket. All checks passed: each transferred body is present, all four source files are absent, no removed filename or separate index row remains, local links resolve, and application/test/asset hashes are unchanged. Application tests and builds were not rerun because only documentation changed; the test evidence below retains its original dates and outcomes.

Contracts and operations: documentation links now target this ticket and its refinement anchors; no product rules, dependencies, configuration, stored data or runtime operations changed. No unresolved consolidation work or deviations remain. Self-reviewed; no commit, pull request, independent review or deployment was created by this cleanup.

## Current frontend coverage

This ticket now covers the original foundation and all four refinements formerly tracked as 0010–0013. The [MVP specification](../../../docs/mvp-spec.md) remains the product contract; the records below explain implementation and verification at each stage.

- **Profile:** personal identity/activity and private sample balances; membership promotion and business-wallet explanation cards removed. Seeded membership access remains on the class detail page.
- **Explore:** Classes, Events and Studios. Classes/events have independent activity/date/time filters; studios have activity filtering and class links. Catalogue cards show standard test-EURC prices without membership promotion.
- **Events:** Run & Coffee example with a 2 test EURC ticket including a run and coffee for every holder; validated local event drafts, reload/delete and informational checkout. No real tickets or host redemption yet.
- **Challenges and social flows:** community/sponsored local drafts, explicit Show-up Club winner criteria and 10 test EURC award, follows/bookmarks, simulated membership booking and sharing/cancellation/hiding. No actual wallet signing, payments, votes, prizes or gym confirmations.

Latest implementation evidence: 14 domain tests passed; all 18 distinct desktop/mobile browser cases passed across the documented initial and targeted runs; lint/types/format/build passed. Those are preserved implementation results, not new tests performed for this ticket consolidation.

### Implementation history

1. [Initial frontend foundation](#initial-frontend-record).
2. [Profile presentation cleanup — former 0010](#refinement-0010).
3. [Explore membership cleanup — former 0011](#refinement-0011).
4. [Classes and Studios discovery — former 0012](#refinement-0012).
5. [Paid events and explicit challenge prizes — former 0013](#refinement-0013).

The dated records preserve intermediate behavior and test results. Later refinements supersede earlier presentation choices: Events extends the earlier Classes/Studios split, and the profile cleanup removes the original company-wallet explanation. Their original plans and completion statements describe those earlier steps, not additional open tickets.

## Scope and non-goals

- In scope: branding, responsive visual system, Feed/Explore/Challenges/Profile navigation, class/event/challenge details, local event and challenge creation drafts, independent Classes/Events/Studios discovery, profile presentation cleanup, filters/search, profile follows, locally persisted demo interactions, explicit wallet/integration boundary, setup documentation and meaningful automated/UI checks.
- Out of scope: database/server authentication, real wallet signing, funds, deployed programs, actual purchases/claims/votes, real gym operations, production hosting, P2P and other deferred product features. These require later vertical slices. Do not claim M0–M4 completion.

## Expected behavior and edge cases

- Users can inspect seeded classes/challenges, switch filters and navigate directly to detail routes; unknown routes have a useful empty/not-found state.
- Creation validates input and saves a local draft, never a funded on-chain challenge. Financial actions explain the integration boundary and cannot fabricate receipts or success.
- Local demonstration bookings and feed sharing, if exposed, are explicitly simulations. Shared intent is distinct from gym-confirmed attendance. Cancellation/hiding update existing activity without duplicating it.
- Profile balances and roles are fixtures visibly identified as such; no browser-held state is described as server authorization.
- Keyboard navigation, focus-managed dialogs, reduced-motion support and narrow-screen layouts work. Storage corruption/unavailability does not crash the app.

## Assumptions, decisions, and dependencies

- The user approved the brand and requested implementation after discussing a frontend-first approach. Product policy proposals remain proposals; this slice does not freeze financial rules.
- Use Next.js, TypeScript and Tailwind as specified, with minimal dependencies and an npm lockfile. Read installed framework docs before using APIs.
- Visual direction: editorial fitness club, warm neutral surfaces, dark typography, a vivid lime accent and strong photography/graphic composition. No additional main wallet tab.
- User has not requested a production deployment, commit or external service account. Use localhost for review.

## Implementation plan

1. Prepare this ticket/index and update the sole spec with brand and honest implementation status.
2. Install compatible framework dependencies; inspect installed Next.js documentation; establish dev/build/lint/type/test commands.
3. Build reusable layout/components and typed fixture/domain modules, then implement the complete frontend slice and persistence boundaries.
4. Run focused domain tests, lint, typecheck and production build; exercise core interactions and desktop/mobile/keyboard states in the browser.
5. Fix issues, document commands and limitations, update implementation evidence and mark only this slice complete.

## Acceptance criteria

- [x] AC1: RepX Club branding/tagline and all four primary surfaces run locally with responsive navigation and meaningful detail views.
- [x] AC2: Creation, filters and local demo interactions work with validation/persistence/recovery; financial integration boundaries and test/fixture labels are honest.
- [x] AC3: EURC-only labels, company/personal distinction, class-join privacy and separate attendance/financial states match the product contract.
- [x] AC4: Focused tests, lint, typecheck, build and desktop/mobile/keyboard UI checks pass; relevant error/empty states are checked.
- [x] AC5: README contains actual setup commands; the spec and ticket accurately distinguish delivered frontend from outstanding database/wallet/program work.

## Validation plan

Use meaningful domain tests for validation and state transitions; the installed app's lint/typecheck/build commands; browser checks of navigation, filters, draft creation, local booking/share/cancel and dialog keyboard behavior at desktop and phone widths. Check documentation links and preserve historical records. Real devnet rehearsal is not replaced by these checks.

<a id="initial-frontend-record"></a>

## Initial foundation implementation record

- Added the runnable Next.js App Router application in [src/app](../../../src/app), with typed fixture data, four primary surfaces and direct class, challenge and member routes. Unknown IDs show a useful not-found view. The branded [shell](../../../src/components/shell.tsx), [visual styles](../../../src/app/globals.css), local Manrope font, native graphics and generated running-club image establish the warm neutral/lime visual direction. Desktop sidebar and mobile bottom navigation share the same destinations.
- The challenge screens documented here historically supported mode selection, planning fields, semantic date/decimal validation, local save/reload and deletion; they were later removed by [DEV0060](DEV0060-replace-challenge-surfaces-with-access-navigation.md). Entries and paid class checkout exposed previews without registering a participant, moving funds or generating a receipt. Class details (historical path `src/features/classes/class-detail.tsx`) allowed the seeded membership's explicitly simulated booking, with sharing opt-out, cancellation and hiding. Only gym confirmation could eventually create a visit; local bookings did not change the illustrated visit count.
- Demo domain transitions (historical path `src/features/preview/state.ts`) restrict simulated booking to the seeded membership and prevent duplicates. Cancellation changes the same activity and hiding survives cancellation. Browser storage (historical path `src/features/preview/store.ts`) persists follows, bookmarks, drafts and bookings under the versioned `repx-club-preview-v1` key; malformed data resets safely and unavailable storage falls back to memory with a visible warning. Its availability flag is part of the subscribed snapshot so that the warning appears even when initial demo data is unchanged.
- [Shared UI](../../../src/components/ui.tsx) uses labelled native dialogs, explicit Tab/Shift+Tab cycling, Escape dismissal and restored trigger focus. Form errors are descriptions rather than part of field names, focus goes to the first invalid field, and stale errors clear on edit. Secondary copy was enlarged/darkened and the hero crop adjusted after screenshot review. Reduced-motion CSS and a keyboard skip link are included.
- [Profile](../../../src/features/profile/profile.tsx) separates private example available/committed/awaiting amounts and explains the company wallet boundary. Public member pages omit balances. No browser switch grants staff/company authority. Reset affects only local preview data. [README](../../../README.md) contains setup, checks, actual implementation boundaries and image provenance; [the specification](../../../docs/mvp-spec.md) remains the product authority.

### Dependencies and development contracts

- Locked Next.js 16.3.5, React 19.3.0, Tailwind 4.3.3, TypeScript 6.0.3, ESLint/Next config, tsx, Playwright, Prettier, Lucide and the self-hosted font. Initial TypeScript 7 was incompatible with the installed typescript-eslint; pinned 6.0.3 after observing the linter's supported-API error. The installed Next.js bundled documentation was read before implementing routes and client/server boundaries.
- Node >=20.9 and npm; no environment variables, secrets, authentication service, database migrations or external accounts. The lockfile is the dependency installation contract. `npm run dev` and `npm run start` use loopback port 3100. [Playwright](../../../playwright.config.ts) owns a separate server on 3101 with server reuse disabled: the first attempted browser run encountered an unrelated existing application on 3000, was stopped, and prompted this isolation fix. No unrelated server was stopped or modified.
- No product policy was promoted from proposed to confirmed. EURC-only wording, no on-chain badges, business/personal separation and booking-versus-attendance boundaries remain as specified. The shared form is a draft planner; invites, publication eligibility, authoritative balances and all financial actions remain for subsequent tickets.
- No migration is needed. Removing this slice removes a frontend only; local preview data can be cleared from Profile. No chain or server records exist to roll back.

## Initial foundation validation results

Verified on macOS with Node 20.19.1 and the installed Google Chrome browser.

| Check                  | Result and acceptance evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm test`             | **7 passed.** Both draft modes, invalid/rolled-over dates, amount boundaries, duplicate/non-member booking rejection, cancellation/hiding, opt-out persistence, corrupted state recovery and reset immutability. AC2–AC3.                                                                                                                                                                                                                                                                                    |
| `npm run lint`         | **Passed, zero warnings/errors** after fixing the PostCSS export and pinning supported TypeScript. AC4.                                                                                                                                                                                                                                                                                                                                                                                                      |
| `npm run typecheck`    | **Passed** (`next typegen` + `tsc --noEmit`). AC4.                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `npm run format:check` | **Passed.** Source, tests and configs formatted consistently. AC4.                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `npm run build`        | **Passed.** Next.js production compilation, TypeScript and all eight static pages completed; dynamic detail routes generated. AC1/AC4.                                                                                                                                                                                                                                                                                                                                                                       |
| `npm run test:e2e`     | **12 passed in 28 seconds** against the production build: six scenarios at 1440×1040 and the same six at 393×852. Navigation, no horizontal overflow, browser error collection, unknown route, searches/empty states, saved/follow persistence, sponsor draft validation/reload/delete, booking/cancellation/hide, opt-out, unfunded payment/entry boundaries, private balance omission, keyboard skip link/dialog cycling/Escape/focus return, corrupted storage and unavailable-storage fallback. AC1–AC4. |
| Visual self-review     | Inspected generated desktop Feed/Explore/Challenges/Profile and phone Feed/Profile/create screenshots. Improved hero framing, secondary-copy size/contrast and error/label behavior; checked clear test/fixture labels and mobile bottom navigation. Screenshots are regenerated under `test-results/` by the browser suite. AC1–AC3.                                                                                                                                                                        |
| Documentation checks   | README setup matches actual scripts. Checked local Markdown file targets across README, AGENTS, the current spec and all tickets; no missing targets. Current contract remains one spec; tickets 0001–0007/archive preserved. AC5.                                                                                                                                                                                                                                                                           |
| `npm run start`        | **Running for review at http://127.0.0.1:3100.** No production deployment. AC1/AC5.                                                                                                                                                                                                                                                                                                                                                                                                                          |

Earlier failed attempts are accounted for: sandboxed tsx IPC and Turbopack worker-port creation returned EPERM; both passed with explicit execution permission. Initial browser run reached a different local project because Playwright reused port 3000; testing moved to its own non-reused port 3101. Browser tests then found and verified fixes for changing accessible field names, backward dialog focus, and an initial unavailable-storage warning that did not trigger a rerender. The final suite has no skipped tests. The in-app computer-use tool failed to initialize, so visual inspection used Playwright screenshots; opening the finished app was requested through the Codex panel tool.

Not run: real Phantom/devnet transfers, challenge program tests, server auth, database migrations, real check-in, end-to-end financial rehearsal or production deployment. Those capabilities do not exist in this frontend slice and are required in later milestones; the full MVP acceptance matrix remains unfulfilled.

## Risks, limitations, and follow-ups

This initial frontend is a local prototype using fixtures. Future tickets must add server-issued sessions/authorization, database constraints, real Phantom/Devnet signing, challenge program deployment and finalized financial verification before the full MVP acceptance criteria can pass.

## Initial foundation completion and review references

- Completed: 2026-09-19 (frontend slice only).
- Commit: Not created.
- Review: Self-reviewed against AC1–AC5 with automated checks and screenshot inspection; no independent review or PR claimed.
- Deployment: None.

<a id="refinement-0010"></a>

## Profile presentation cleanup — former 0010

Historical implementation record, completed 19 September 2026 and consolidated here at the user’s request.

- Status: Completed
- Created: 2026-09-19
- Last updated: 2026-09-19
- Milestone: M0 frontend refinement
- Related tickets: [DEV0008 — Frontend foundation](DEV0008-repx-club-frontend.md)

### Objective and context

Remove the personal profile's seeded membership promotion and business-wallet explanation after the user's review. Keep the profile focused on personal activity and balance, as described in the [screen contract](../../../docs/mvp-spec.md#2-screens-and-actions).

### Scope and non-goals

- In scope: remove the Kru Tiger membership card and business-wallet callout/modal, unused state/import/styles, and record the profile presentation decision in the current spec.
- Out of scope: removing seeded membership eligibility or its class-booking path, implementing business accounts/dashboard, changing wallet architecture or personal balances.

### Expected behavior and edge cases

The personal profile displays identity, activity tabs, visit/follow/session counts and private sample balances. Neither removed card nor its business dialog remains reachable by keyboard. Public profiles, reset confirmation and membership booking continue to work. Removing presentation must not alter stored demo state.

### Assumptions, decisions, and dependencies

The latest request concerns the displayed membership card. Include the business explanation cleanup discussed immediately beforehand. Separate company permissions/wallets remain the product contract; this task does not choose a new login model. No dependency or migration is needed.

### Implementation plan

1. Record this ticket and index before edits.
2. Remove the two profile cards, company modal/state and exclusively associated CSS; update the specification's profile presentation.
3. Run lint/type/build checks and existing focused browser coverage at desktop/mobile sizes, inspect the profile and keyboard reset dialog, and refresh the local preview.
4. Record results and complete this ticket/index.

### Acceptance criteria

- [x] AC1: Personal profile has neither membership card nor business-wallet callout/modal; identity, personal activity and private balance remain.
- [x] AC2: Existing class membership booking and profile/reset navigation continue to work; no state/schema changes.
- [x] AC3: Desktop/mobile layout and keyboard interaction verified, lint/type/build checks pass, and local preview serves the updated page.

### Validation plan

Use the existing browser scenarios for all primary screens, membership booking and keyboard/recovery flows. Visually inspect desktop/mobile profile screenshots and exercise the existing reset dialog. Run lint, TypeScript and production build. No new permanent tests for this reversible presentation-only deletion; existing coverage and focused inspection are sufficient. No blockchain/database checks apply.

### Implementation record

- [Profile component](../../../src/features/profile/profile.tsx): removed the membership card and company-wallet button/modal, its local state and unused icon import. Reworded the empty sessions prompt around finding a session. Personal balances, follows, activity, reset and public profiles remain available.
- [Styles](../../../src/app/globals.css): removed exclusive card styles and the obsolete two-column tablet aside; the remaining balance card fills the stacked layout.
- [Specification](../../../docs/mvp-spec.md#2-screens-and-actions): recorded the personal profile presentation decision while retaining membership access in discovery/booking and separate authorized company tools.
- No deviations, new dependencies, environment variables, storage/data changes or migrations. Existing membership fixtures and booking logic were not modified. Historical tickets remain unchanged.

### Validation results

19 September 2026, macOS, Node 20.19.1, installed Google Chrome:

- `npm run lint`, `npm run typecheck`, `npm run format:check`: passed.
- `npm run build`: passed production compilation, type validation and static page generation.
- `npm run test:e2e -- --grep 'four surfaces|membership booking|keyboard dialog'`: **6 passed** across desktop and mobile, covering navigation/layout, membership booking/cancellation/feed hiding and keyboard/storage recovery.
- `node /private/tmp/repx-profile-0010.cjs`: focused browser inspection passed at **1440, 900 and 393 pixels**. Both cards absent, private balance visible, no horizontal overflow; reset opens with Enter, closes with Escape and returns focus to its trigger. Temporary browser contexts did not alter the user's local preview data. Desktop and phone screenshots visually inspected; evidence generated as `/private/tmp/repx-profile-0010-{width}.png`.
- `npm run start`: restarted the built preview at `http://127.0.0.1:3100`; browser inspection above used this updated server.
- Source search confirmed no orphan company-preview/membership-card/membership-logo selectors or company-modal state. Current specification and ticket links checked.

AC1–AC3 passed. No new permanent tests were added for this presentation-only removal. Domain, wallet, database and financial tests were not rerun because their code/contracts were unchanged. No failed or blocked required checks remain.

### Risks, limitations, and follow-ups

The app remains a local frontend preview. Business tools and real devnet flows are still outstanding under the specification's milestones.

### Completion and review references

- Completed: 2026-09-19. Both profile cards removed and local preview updated.
- Commit: Not created.
- Review: Self-reviewed source and desktop/mobile screenshots against AC1–AC3; no independent review or PR.
- Deployment: Local preview only; no production deployment.

<a id="refinement-0011"></a>

## Explore membership cleanup — former 0011

Historical implementation record, completed 19 September 2026 and consolidated here at the user’s request.

- Status: Completed
- Created: 2026-09-19
- Last updated: 2026-09-19
- Milestone: M0 frontend refinement
- Related tickets: [0010 — Personal profile cleanup](#refinement-0010), [DEV0008 — Frontend foundation](DEV0008-repx-club-frontend.md)

### Objective and context

The user requests the same membership presentation cleanup on Explore as on the personal profile. Simplify the [discovery screen](../../../docs/mvp-spec.md#2-screens-and-actions) around classes and activities.

### Scope and non-goals

- Remove the “My membership” filter, its state/predicate and exclusive styles/icon. Show standard test-EURC pass prices on all catalogue cards, replacing membership promotional labels there.
- Preserve search, activity filters, class navigation and seeded membership eligibility/booking on the individual class page. No changes to payment rules, fixture data, saved state or account model.

### Expected behavior and edge cases

Explore initially lists all three classes, search and activity chips still combine, and unmatched filters show the existing empty state. Search fills the freed space at desktop/phone widths. Class details remain the place for personal access eligibility; viewing a catalogue pass price does not force a covered member to buy it.

### Assumptions, decisions, and dependencies

Treat this as removing membership UI from discovery, not removing the no-purchase access path from the MVP. No new dependencies or migration.

### Implementation plan

1. Record ticket/index before edits.
2. Simplify Explore and remove obsolete CSS; update the current screen specification and adapt the existing filter browser scenario to use an activity chip.
3. Run lint/type/build and focused desktop/mobile navigation/search/booking checks, inspect Explore and keyboard filtering, then restart the local preview.
4. Record evidence and complete ticket/index.

### Acceptance criteria

- [x] AC1: Explore has no membership filter or membership card copy; cards show their standard test-EURC pass prices.
- [x] AC2: Search/activity/empty states, class links and membership class booking still work.
- [x] AC3: Desktop/mobile layout and keyboard filtering checked; lint/type/build pass and local preview is updated.

### Validation plan

Adapt and run existing navigation, catalogue-filter and membership-booking browser scenarios in both configured viewports. Inspect screenshots and keyboard-operated activity chips. Run lint, typecheck, formatting and production build. Do not add permanent tests for the presentation deletion. Financial/database checks do not apply because their contracts and code are unchanged.

### Implementation record

- Explore (historical path `src/features/discovery/explore.tsx`): removed the membership toggle, local filter state/predicate and unused icons. Every class card now displays its standard test-EURC pass price. Search and discipline chips remain; the search field naturally fills the available row.
- [Styles](../../../src/app/globals.css): removed the obsolete membership-filter and member-price rules, including the phone override.
- Existing browser scenario (historical path `tests/browser/preview.spec.ts`): replaced interaction with the removed filter by clearing search, checking all three results, and keyboard-activating the Muay Thai activity filter. Existing empty-state and persistence checks remain.
- [Current specification](../../../docs/mvp-spec.md#2-screens-and-actions): recorded discovery's membership-free presentation and class-detail access boundary. No fixture, eligibility, booking, wallet, storage, dependency, configuration or schema changes; no migration required. No deviation from plan.

### Validation results

19 September 2026, macOS, Node 20.19.1 and installed Google Chrome:

- `npm run lint`, `npm run typecheck`, `npm run format:check`: passed.
- `npm run build`: passed production compilation, TypeScript and static generation.
- `npm run test:e2e -- --grep 'four surfaces|search, activity|membership booking'`: **6 passed in 16.5 seconds**. Desktop 1440×1040 and mobile 393×852 cover navigation/no overflow, catalogue search and clearing, keyboard activity filtering, empty results, saved/follow persistence and the existing membership booking/cancel/hide flow.
- Visually inspected the generated desktop/mobile Explore screenshots under `test-results/`: no membership button/copy, full-width search, readable activity chips and standard €12/€18/€15 test-EURC prices. No clipping or leftover filter spacing observed.
- Focused source check found no membership-filter state, markup or orphan styles in Explore. Changed Markdown link targets exist.
- `npm run start`: updated production preview running at `http://127.0.0.1:3100`.

AC1–AC3 passed. No new permanent test case was added; the existing filter test was updated to reflect the remaining UI. Domain, database, wallet and financial tests were not rerun because those implementations/contracts were unchanged. No required checks failed or remain blocked.

### Risks, limitations, and follow-ups

Still a local fixture-based frontend; real wallets/bookings and authorized eligibility checks remain future implementation work.

### Completion and review references

- Completed: 2026-09-19. Explore membership UI removed and preview refreshed.
- Commit: Not created.
- Review: Source and desktop/mobile screenshots self-reviewed; no independent review or PR.
- Deployment: Local preview only.

<a id="refinement-0012"></a>

## Classes and Studios discovery — former 0012

Historical implementation record, completed 19 September 2026 and consolidated here at the user’s request.

- Status: Completed
- Created: 2026-09-19
- Last updated: 2026-09-19
- Milestone: M0 frontend discovery refinement
- Related tickets: [0011 — Explore cleanup](#refinement-0011), [DEV0008 — Frontend foundation](DEV0008-repx-club-frontend.md)

### Objective and context

Following the user's [ClassPass search reference](https://classpass.com/search), separate finding a scheduled class from discovering a studio. The user requests Classes with activity/date/time filters and Studios with activity filtering only. Update the sole [screen contract](../../../docs/mvp-spec.md#2-screens-and-actions).

### Scope and non-goals

- In scope: accessible Classes/Studios tabs; activity, date and time-of-day filtering for Classes; independent activity filtering for Studios; typed studio fixtures, explicit ISO class dates, studio information and links to its existing class pages; empty/reset states and responsive layouts.
- Preserve existing global search links as optional search context, rather than adding another Explore filter field. Default to all demo dates/times so the small seeded catalogue is discoverable. No membership filtering/copy returns to Explore.
- Out of scope: live ClassPass data/assets, maps/geolocation, ratings/reviews, new venues, real inventory/booking, a full operator dashboard or new financial behavior.

### Expected behavior and edge cases

- Classes is the default. Its filters combine by intersection; date matches the venue-local ISO date and time is based on the scheduled start in Berlin time. Presets: any time, before 12:00, 12:00–16:59, and 17:00 onward. Clearing class filters restores the catalogue.
- Studios show one card per studio, with location/activity and a details dialog linking to its classes. Class date/time selections must never hide studios. Each tab retains its own activity choice when switching; class date/time choices remain available on return.
- Arrow keys/Home/End and normal keyboard controls operate the tabs/filters. Date/time controls are absent from the accessible Studios panel. Empty states explain the active filter context and allow resetting.
- Seeded September 2026 dates, venues and availability remain visibly demonstration data; no real attendance/payment is implied.

### Assumptions, decisions, and dependencies

Use time-of-day presets for a simple demo rather than an arbitrary time-range editor. Reuse the existing focus-managed studio dialog pattern and class routes. Read the reference via web; its extracted public page supplies venue/activity listings, while the user's request defines the desired two-tab controls. No reference imagery or review claims will be copied. No new dependencies or server services.

### Implementation plan

1. Create this ticket/index before implementation.
2. Add studio fixtures and ISO class dates plus reusable, tested filter functions.
3. Replace Explore's large decorative banner/local search row with Classes/Studios tabs and the requested contextual controls; add studio cards/details using the existing UI system.
4. Update the spec and existing browser scenario, and add meaningful date/time/independent-tab recovery coverage.
5. Run domain tests, lint, typecheck, formatting and production build; exercise desktop/mobile/keyboard flows and visually review both tabs, studio details and empty states. Refresh preview and finish this record.

### Acceptance criteria

- [x] AC1: Explore has accessible Classes and Studios sections with exactly the requested contextual filter categories.
- [x] AC2: Class activity/date/time and studio activity filters return correct results, including time boundaries, combined filters, independent state, empty/reset and existing global search context.
- [x] AC3: Studio details show the correct venue and working class links; membership and financial booking contracts remain unchanged.
- [x] AC4: Desktop/mobile/keyboard and relevant error states verified, automated checks/build pass, spec/ticket updated and localhost preview refreshed.

### Validation plan

Use pure domain cases for date/time boundaries and studio filtering; browser tests for both tabs, filter persistence/isolation, reset/empty states, dialog keyboard behavior and studio-to-class navigation. Adapt existing catalogue search coverage to the new activity select. Run the standard lint/type/format/build commands and focused navigation/catalogue/booking browser coverage at both configured viewports. Inspect generated screenshots. Financial/database checks do not apply to unchanged integration boundaries.

### Implementation record

- Explore component (historical path `src/features/discovery/explore.tsx`): replaced the decorative map banner and local search input with accessible Classes/Studios tabs and contextual controls. Class results intersect activity/date/time/global query. Studios have their own activity state and never inherit date/time filters. Clear/reset and empty states recover to the demo catalogue. Existing global header search arrives as a clearable query context.
- Added one studio card per venue, with area, offered activity and original illustrative descriptions. A studio opens the existing focus-managed dialog pattern with its coach and seeded schedule; class links reuse the existing class routes. Arrow keys/Home/End move between tabs and update selected/focus state. Hidden panel controls are not exposed to the active tab's accessibility tree.
- Fixtures (historical path `src/features/preview/catalogue.ts`): added required `ClubClass.dateISO` values for the three existing September 2026 dates and explicit `ClubStudio` entries. Existing prices, membership coverage, class IDs and booking behavior are unchanged. The filter module (historical path `src/features/discovery/filters.ts`) owns pure class/studio filtering, while shared controls (historical path `src/components/discovery-filters.tsx`) own the time/activity options; comparison uses normalized local date and HH:mm strings, independent of the browser's timezone.
- [Styles](../../../src/app/globals.css): added responsive tab/filter/studio/dialog styles and removed unused decorative banner/search selectors. The desktop class filters share one row; phone layout places activity above date/time. Studio cards use the existing native artwork and visual system.
- Domain tests (historical path `tests/explore.test.ts`) cover intersected filters, calendar year/date matching, noon/17:00 boundaries, query normalization, and a studio with no scheduled classes. Browser tests (historical path `tests/browser/preview.spec.ts`) adapt the existing filter scenario and add independent tab state, keyboard control, empty/reset, hidden date/time fields, studio dialog and class navigation coverage.
- [Specification](../../../docs/mvp-spec.md#2-screens-and-actions) records the new screen contract and local time boundaries. The user's referenced page was read with the web tool; no remote imagery, listings, ratings or reviews were copied. No new dependencies, routes, environment variables or storage/server schemas; no migrations or chain actions. Existing local booking state stays compatible. No scope deviations.

### Validation results

19 September 2026, macOS, Node 20.19.1, installed Google Chrome:

| Check                                                                                                             | Result / acceptance evidence                                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                                                                                                        | **10 passed**, including three new catalogue-filter tests. AC2–AC3.                                                                                                                                                                                                                                                                       |
| `npm run lint`, `npm run typecheck`, `npm run format:check`                                                       | **Passed**; lint/format repeated after correcting the browser test keyboard sequence. AC4.                                                                                                                                                                                                                                                |
| `npm run build`                                                                                                   | **Passed** production compilation, TypeScript and static page generation. AC4.                                                                                                                                                                                                                                                            |
| `npm run test:e2e -- --grep 'four surfaces&#124;search, activity&#124;Explore separates&#124;membership booking'` | Eight selected desktop/mobile cases: seven passed on the initial run, one desktop keyboard test needed the native-select correction described below. Navigation, search, existing membership booking and mobile studio discovery passed. AC1–AC3.                                                                                         |
| `npm run test:e2e -- --grep 'Explore separates'`                                                                  | **2 passed** (desktop and mobile), completing verification of all eight selected cases after the correction. Proves combined date/time empty results, class/studio filter isolation and restoration, keyboard tab navigation and activity selection, studio reset, correct studio data/class link, Escape and focus restoration. AC1–AC4. |
| Visual inspection                                                                                                 | Inspected desktop Classes/Studios, mobile Studios and class empty state, and mobile studio dialog screenshots under `test-results/`. Controls/cards have no horizontal overflow; Studios exposes only activity filtering, and class dates/times remain visible with a demo/Berlin-time label. AC1–AC4.                                    |
| `npm run start`                                                                                                   | Updated preview running at `http://127.0.0.1:3100`. No production deployment.                                                                                                                                                                                                                                                             |

The initial desktop keyboard test assumed ArrowDown immediately selected the next native option. On desktop Chrome/macOS that first key opens the picker; the mobile emulation behaved differently. Replaced the test sequence with native letter type-ahead and Tab, then verified both viewports. No application workaround or native keyboard override was added.

Changed document links verified; historical records preserved. Financial, database and full devnet rehearsal checks were not run because those integrations are outside this frontend change. No required acceptance evidence remains missing.

### Risks, limitations, and follow-ups

The demo catalogue remains three studios/classes on fixed dates. A native date picker can select unseeded dates; the resulting empty state is intentional. Studio summaries are examples, not partnership or live-availability claims.

### Completion and review references

- Completed: 2026-09-19. Classes/Studios split implemented, verified and running locally.
- Commit: Not created.
- Review: Self-reviewed source and desktop/mobile screenshots against AC1–AC4; no independent review or PR.
- Deployment: Local preview only.

<a id="refinement-0013"></a>

## Paid events and explicit challenge prizes — former 0013

Historical implementation record, completed 19 September 2026 and consolidated here at the user’s request.

- Status: Completed
- Created: 2026-09-19
- Last updated: 2026-09-19
- Milestone: M0 frontend discovery and creation
- Related tickets: [DEV0008](DEV0008-repx-club-frontend.md), [0012](#refinement-0012)

### Objective and context

Add the user-approved paid community event format: a café hosts a run for 2 test EURC with one coffee included for every ticket holder. Make an example challenge explicitly describe its winner and award. Follow the [screen contract](../../../docs/mvp-spec.md#2-screens-and-actions) and [demo integrity](../../../docs/mvp-spec.md#8-asset-wallet-and-demo-integrity).

### Scope and non-goals

- In scope: Events tab alongside Classes and Studios, activity/date/time filtering, seeded Run & Coffee details and ticket-purchase preview, validated locally saved event drafts with detail/delete flows, explicit sponsored challenge judging/prize copy, specification updates and tests.
- Out of scope: live event publication, payments, host authorization, real ticket issuance/redemption, on-chain settlement, new dependencies and changes to existing class/challenge financial rules. Those remain integration milestones, as for existing paid class previews.

### Expected behavior and edge cases

Events sell an included experience, have no prize pool or voting, and direct future receipts to the host. The event detail explains one-time host redemption and separates event participation from gym visit counts. No preview interaction grants attendance, creates a ticket or changes balances. Event drafts persist in the existing browser store, survive reload, can be deleted with confirmation, and never become public catalogue inventory. Existing stored profiles migrate without losing bookings/drafts. Invalid prices, dates/times, capacity and missing benefits are rejected. Existing Explore filters remain independent; tab keyboard navigation includes Events. Unknown event IDs get a proper missing state.

### Assumptions, decisions, and dependencies

- User approved paid events and an explicit winning challenge. Add a third Explore tab so Classes and Studios keep their existing meaning.
- Use the existing frontend-preview boundary. Single-use redemption is described as the target, never represented as implemented financial/host authorization.
- Strengthen the existing sponsored Show-up Club example: most gym-confirmed visits during the period (minimum three); creator breaks ties by published community-spirit criteria; one selected winner receives the full 10 test EURC. This is illustrative authored judging policy, not a change to settlement authority/fallback. No invented actual winner or paid receipt.
- Event cancellation/refund deadlines are not yet agreed; disclose that they must be set before paid publication rather than silently extending class policy.

### Implementation plan

1. Add event fixtures, reusable schedule filtering, validated event-draft state and backwards-compatible parsing.
2. Add event discovery/detail/create/draft routes using existing accessible UI primitives; retain independent class/studio filters.
3. Add explicit prize/judging sections to challenge detail and a concise card summary; link noncompetitive event creation from Challenges.
4. Update the single specification and navigation documentation; run domain/browser checks, lint/types/format/build and visual review.

### Acceptance criteria

- [x] AC1: Run & Coffee is discoverable/filterable under Events and displays host, schedule, 2 test EURC price, one coffee per ticket and no prize/voting.
- [x] AC2: Ticket preview clearly issues no payment/ticket/visit; future host redemption is single-use and separate from gym visits.
- [x] AC3: Event drafts validate, save/reload/delete, and migrate old local data without losing existing state; drafts stay private/local.
- [x] AC4: Show-up Club explicitly states criteria, creator selection, one winner and 10 test EURC award while retaining timeout/cancellation rules and unfunded fixture status.
- [x] AC5: Desktop/mobile, keyboard navigation, invalid forms, missing events and empty discovery work; docs reflect current scope and pending integrations.

### Validation plan

Meaningful domain tests for draft validation/storage migration and event-filter intersection. Browser tests on desktop/mobile for Events filters, ticket-preview non-mutation, create/reload/delete and explicit challenge prize. Run existing tests to cover shared store/navigation regressions; lint, typecheck, format, production build and screenshot inspection. No live financial tests because no financial integration changes.

### Implementation record

#### Changes and rationale

Explore now has Classes, Events and Studios tabs. The original class/studio filters are preserved; event activity/date/time filters retain independent state. Run & Coffee links to a detail page displaying the 2 test EURC host-directed ticket, one run and one coffee per ticket, planned single redemption and separation from gym attendance. An informational ticket modal cannot mutate bookings or funds. A Create event form saves validated private browser drafts, with reload, list, missing-draft and confirmed-delete flows. Drafts never appear as published events.

Show-up Club now advertises one 10 test EURC winner in the card and opening description, with a dedicated criteria/judge/prize section. It states the three-visit minimum, most eligible visits, organizer tie-break, no guaranteed prize for completing, and equal fallback when nobody qualifies/no selection occurs. Existing creator authority, timeout and cancellation rules are preserved. Sponsored policy copy no longer describes community voting rules as if they applied to the sponsor.

#### Affected files

| File or component                                                                                                                                                                                                                                                            | Change and purpose                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| event contracts (historical path `src/domain/events.ts`) and preview catalogue (historical path `src/features/preview/catalogue.ts`)                                                                                                                                         | Seed event, typed local drafts, schedule/price/capacity/inclusion validation and display conversion.                                                       |
| demo state (historical path `src/features/preview/state.ts`)                                                                                                                                                                                                                 | Event-draft save/delete/reset and backwards-compatible local-store hydration. Malformed event drafts are cleared without dropping valid existing bookings. |
| Explore filter domain (historical path `src/features/discovery/filters.ts`)                                                                                                                                                                                                  | Event search/activity/date/time intersection, reusing time boundaries.                                                                                     |
| Explore (historical path `src/features/discovery/explore.tsx`), route (historical path `src/app/explore/page.tsx`), filter controls (historical path `src/components/discovery-filters.tsx`)                                                                                 | Three accessible tabs, independent filters and direct Events links; extracted shared controls avoid separate class/event date implementations.             |
| Events catalogue (historical path `src/features/discovery/event-list.tsx`), detail/create UI (historical path `src/features/events/events.tsx`), detail route (historical path `src/app/events/[id]/page.tsx`), create route (historical path `src/app/events/new/page.tsx`) | Catalogue, details, informational checkout and local creation/detail/delete flows using existing modal/form styles.                                        |
| Challenge fixtures (historical path `src/features/preview/catalogue.ts`), [later challenge retirement record](DEV0060-replace-challenge-surfaces-with-access-navigation.md), [shared cards](../../../src/components/ui.tsx)                                                  | Explicit award/rules model and winner explanation, plus link to noncompetitive events.                                                                     |
| [Shell](../../../src/components/shell.tsx), [styles](../../../src/app/globals.css)                                                                                                                                                                                           | Event routes select Explore; mobile tab sizing, benefit panels and event creation callout.                                                                 |
| Domain tests (historical path `tests/events.test.ts`), event browser tests (historical path `tests/browser/events.spec.ts`), existing browser tests (historical path `tests/browser/preview.spec.ts`)                                                                        | Validation/migration/non-mutation, private drafts, filter independence, keyboard flows and prize disclosure; selectors scoped to visible panels.           |
| [Specification](../../../docs/mvp-spec.md), [README](../../../README.md), [ticket index](../../README.md)                                                                                                                                                                    | C16, screen/fixture/evidence/storage/payment boundaries, M3 event integration and A50–A53 acceptance coverage; setup navigation remains in README.         |

#### Decisions and deviations

19 September: adopted a third Explore tab and kept the main navigation unchanged. Reused the existing local state key/version with an optional-to-empty eventDrafts migration, preserving older previews. Event host names are draft descriptions only; authorization and refunds remain future integrations. No plan deviations. Visual review found the new mobile event creation callout squeezed its text; changed only that callout to a two-column layout with its button on the next row. Removed an existing noncompetitive tagline from the now-explicit prize example.

#### Contracts, configuration, and operations

Added ClubEvent/EventDraft types, eventDrafts on DemoState, event-draft/delete-event-draft actions, optional challenge award fields and /events routes. No dependencies, environment variables, backend schema, wallets or signing code changed. Store version/key stays repx-club-preview-v1. Existing data without eventDrafts remains valid; old financial rules were not promoted from proposed to confirmed. Standard build/start commands suffice. Event purchase/redemption have explicit future acceptance requirements, not claims of implementation.

### Validation results

19 September 2026, macOS, Node 20.19.1, installed Chrome; desktop 1440×1040 and mobile 393×852. Domain runner/build/browser commands used permitted local IPC/port access. Playwright owned port 3101; user preview is on 3100.

- `npm test`: 14 passed, including four new event cases for invalid terms, private/idempotent draft transitions, old/malformed-store recovery and schedule/search intersection.
- `npm run typecheck`: passed. Final `npm run build` also passed TypeScript and generated both new event routes.
- `npm run lint` and `npm run format:check`: passed, repeated after final UI/test refinements.
- `npm run build`: passed, repeated after visual refinement.
- Initial `npm run test:e2e`: 14 passed, 4 failed because unscoped label selectors matched controls in hidden tabs. No application failure: adjusted selectors to the visible tab panel/combobox and corrected test price formatting to €2.00.
- `npm run test:e2e -- --grep 'event discovery|Explore separates'`: all 4 previously failing desktop/mobile cases passed.
- After final mobile callout and challenge-copy changes, `npm run test:e2e -- tests/browser/events.spec.ts`: all 4 event/draft/prize cases passed. All 18 distinct suite cases have passed; there was no subsequent single 18-case run.
- Inspected generated desktop/mobile Events, event detail, ticket modal, creation form and winner screenshots in `test-results/`. Corrected cramped mobile callout; final image shows readable text and a separate button row. No horizontal overflow; keyboard tabs, Escape/focus restoration, form-error focus, empty filters and missing routes verified.
- Local Python link/ID check: referenced Markdown file targets exist; C01–C16, P01–P08 and A01–A53 unique. Existing decision/proposal IDs preserved.
- Restarted `npm run start` on port 3100 with final build; ready. No deployment, chain transactions or external review performed. Financial/host-authorization tests do not apply to this frontend slice.

| Criterion | Evidence                                                                                                                                               | Result |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| AC1       | Event intersection domain test; desktop/mobile event discovery and detail checks/screenshots                                                           | Passed |
| AC2       | Ticket modal explicit unconnected state; browser localStorage identical before/after preview; no attendance action                                     | Passed |
| AC3       | Domain validation/migration tests; desktop/mobile save/reload/private list/delete/missing-draft checks                                                 | Passed |
| AC4       | Dedicated Winner and prize region assertions; visual inspection of explicit criteria, judge, award and unfunded status                                 | Passed |
| AC5       | Shared navigation/store regression cases, targeted final browser tests, visual correction, successful build/lint/types/format and documentation checks | Passed |

### Risks, limitations, and follow-ups

Real purchase, authorized redemption and event-specific refund policy remain future work. Draft host names do not establish business authority. Existing P01–P05/P07 proposals remain unresolved.

### Completion and review references

- Completed: 19 September 2026 — all frontend acceptance criteria and required validation passed.
- Commit: Not created.
- Review: Self-reviewed against all five criteria; no independent review or pull request created.
- Deployment or release: Local preview only.
