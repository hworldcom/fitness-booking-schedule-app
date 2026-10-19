# Ticket DEV0317: Build shareable personal coach websites

- Status: Completed
- Created: 2026-10-17
- Last updated: 2026-10-19
- Milestone: M10 — Core public coach websites
- Coordination: [COR0028 — Coach marketplace cards and personal websites](../../current/organisatory/COR0028-coach-marketplace-cards-and-personal-websites.md)
- Related records: Completed foundations [DEV0321](../backend/DEV0321-persist-coach-website-content-and-banners.md), [DEV0313](../backend/DEV0313-manage-coach-starting-prices-and-visibility.md), [DEV0314](../backend/DEV0314-persist-booking-linked-coach-reviews.md), [DEV0331](../backend/DEV0331-enable-username-based-public-coach-urls.md), [DEV0315](DEV0315-edit-and-preview-coach-websites.md), [DEV0316](DEV0316-redesign-coach-directory-cards.md); approved visual example [DEV0338](DEV0338-preview-a-personal-coach-page.md); booking compatibility [COR0029](../organisatory/COR0029-session-types-and-flexible-bookings.md), [DEV0348](../backend/DEV0348-keep-coach-profiles-visible-before-session-type-rollout.md); downstream author integration [DEV0318](../../current/frontend/DEV0318-add-athlete-coach-review-controls.md), combined proof [DEV0319](../../current/backend/DEV0319-rehearse-coach-marketplace-websites.md); independent later media [DEV0297](../../current/backend/DEV0297-add-coach-profile-photos-and-mux-video.md); historical contract [DEV0320](../organisatory/DEV0320-adopt-coach-marketplace-website-contract.md), [DEV0330](../organisatory/DEV0330-refine-coach-marketplace-pricing-reviews-and-urls.md); current planning amendment [DEV0363](../organisatory/DEV0363-refresh-core-coach-website-delivery-plan.md).

## Objective and context

Replace the current public biography/location/booking layout with the agreed shareable personal coach website, using saved public content and the existing banner/portrait. Directory cards are completed separately under DEV0316; the owner editor/preview is completed under DEV0315. This ticket owns the actual public-page composition.

Follow the [M10 contract](../../../docs/mvp-spec.md#19-coach-marketplace-cards-and-personal-websites), [public template](../../../docs/mvp-spec.md#192-public-content-and-template), [session-type booking](../../../docs/mvp-spec.md#186-session-types-and-flexible-bookings), [milestone](../../../docs/mvp-spec.md#12-delivery-milestones) and [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix). On 19 October the user accepted refreshing the plan for core-page delivery before later gallery/video. The planning-only amendment is preserved below; on 19 October the user subsequently requested implementation.

## Scope and non-goals

- In scope: public username/legacy-compatible page; saved banner/portrait/identity/introduction; services, approach, experience/coach-supplied qualifications, locations, FAQs and safe links; optional disclosed Sessions start from rate; actual public pair-review summary/list; existing typed/legacy private booking, Message coach and published group destinations; responsive section/contact navigation; canonical metadata and explicit copy/share controls.
- Out of scope: directory/editor redesign, new content/rate/review persistence, username resolution/alias/claim changes, private review composition, gallery/photo-upload/Mux/video integration or entitlement decisions, new service/pricing/payment rules, custom domains, data provisioning and retained demo-data changes. DEV0297 owns later public gallery/video composition and its authoring/provider pipeline.

## Expected behavior and edge cases

### Page composition

Use the approved DEV0338 structure with the current white/lavender/purple palette: wide saved banner, public portrait/initials, readable coach name/brand, disciplines, primary place and actual rating/count; a main content column and distinct booking/contact card on suitable desktop widths; normal-flow content on phones. Populate sections from verified public projections. The example's fictional copy, price, reviews and times are not application data. Keep the existing bio when optional introduction is absent. Suppress empty optional approach/experience/focus/FAQ/link sections and their navigation entries. Keep a truthful banner fallback, portrait initials and readable identity/actions on media failure; optional data failure must not replace the entire verified coach page.

Display supported services from the actual public catalog and real published group records, including their format and 60/75/90-minute duration where supplied. Profile prose does not create an offer. Coach-supplied qualifications remain distinct from MovX's bounded identity/application verification. All active locations retain primary selection, complete text and existing map/list correspondence and failure fallback.

### Booking and contact compatibility

Reuse the composition in `PublicCoachPage`, `TypeFirstBooking` and `CoachMarketplace`. Preserve server-derived actor/own-profile restrictions, Berlin time, the 30-local-date horizon, venue selection, full-interval availability/conflict checks, pending-request behavior and explicit guest sign-in return without automatic submission. A page visit, section action or share does not book or send a message.

- Enabled catalog: use actual active publicly bookable types and their existing booking controls.
- Enabled empty catalog: show the existing no-offers state; invent no type, duration, price or availability.
- Installed but unavailable/invalid catalog: retain the verified profile and show booking-only unavailable/retry; do not reenable legacy offers.
- Catalog capability absent during rollout: preserve the existing legacy scheduling compatibility from DEV0348; do not migrate or populate an existing coach's catalog.

View available times reaches one stable `#private-schedule` target around the appropriate existing booking renderer. Message coach and group actions retain their existing authority and actual destinations. Upcoming groups must be current public sessions for this coach; empty and failed reads stay distinct, and no global event inventory is presented as theirs.

### Public rates and reviews

Show Sessions start from only from the disclosed public rate. Hidden/missing values are absent from HTML, serialized data, metadata and sharing; zero retains its real Free meaning. The amount remains indicative, independent of type duration and group per-person prices. Do not compute a service minimum or add price gating.

Consume DEV0314 public review summary and bounded 20-item cursor pages. One athlete contributes one currently public review per coach pair. Retain consented attribution and moderation/withdrawal rules; publish no private account/avatar/booking data. Keep a stable `#reviews` destination for DEV0318 even with no public reviews or a failed read; empty and unavailable are different states. Private review creation/editing stays in DEV0318.

### URLs, metadata and sharing

Consume DEV0331's current public-path resolver, including confirmed `/@username`, legacy/missing-handle compatibility and rename aliases. Do not derive a new handle or change publication gates. Metadata and explicit copy/share use the same current public identity/URL and validated public site-origin contract, without private fields or transient query state. Share image/description use public banner/portrait/content only. Copy/share provide success/failure feedback and a usable fallback; they send no invitation, message or session request. Preserve supported date/deep-link returns and safe unavailable/not-found behavior for hidden/ineligible/unknown coaches.

## Assumptions, decisions, and dependencies

Confirmed: core page first using current banner/portrait, current booking behavior, and gallery/video later. Existing privacy, one-review-per-pair, optional price and username decisions remain. Adopted defaults: reuse the approved example's desktop contact-card/mobile normal-flow arrangement, existing public DTOs, native disclosures for FAQs and stable booking/reviews anchors. No new policy, schema or provider is assumed.

DEV0321 public website/banner, DEV0313 optional public rate, DEV0314 public reviews, DEV0331 routing, DEV0315 authored content and DEV0316 cards are Completed locally; their start prerequisites are satisfied. COR0029/DEV0348 supply delivered booking compatibility. DEV0318 public-link completion and DEV0319 combined proof are downstream, so neither blocks page implementation. Gallery/video policy and capability are external DEV0297 follow-ups; they are not this ticket's start/completion conditions.

Scope review: one coherent public-page composition over existing services; no new authoring, media or scheduling engine. If investigation exposes a required independent schema/authority capability, record that boundary and use a separately scoped dependency before implementing it. On 19 October the user requested implementation; delivered prerequisites permit starting this slice.

## Implementation plan

1. Inspect current username/legacy routes, `PublicCoachPage`/`CoachProfileView`, saved preview/content/rate/review contracts, typed booking, location/map, messaging and public-group reads. Read installed Next.js metadata/image/navigation guidance before framework edits; record concrete public-only composition and reuse boundaries.
2. Implement the responsive banner/identity/main-content/contact template with public saved content, truthful legacy/empty/failure fallbacks, safe FAQ/external links and unobstructive section anchors. Retain working directory/card navigation and avoid changing owner editing.
3. Compose existing typed/legacy booking and contact actions; preserve all four catalog states above, original request/guest-return behavior and real locations. Inspect the existing public group query's coach scoping and bounded projection before wiring upcoming groups; add no new group authority or fabricated offers.
4. Add actual public review summary/paging and stable `#reviews`; coordinate the anchor/URL contract with DEV0318. Keep rates and every public output on the public DTOs; never use an owner API to fill missing public values.
5. Add canonical public metadata, public share image/description and explicit copy/share/error feedback through existing validated origin/path contracts. Regress confirmed/unconfirmed/renamed/legacy/hidden URLs and date/anchor continuation without changing the resolver.
6. Validate the matrix below using isolated real authored records, appropriate existing/focused tests, lint, types and production build; review scope/privacy and record exact cleanup. Complete DEV0317 on core criteria only; hand public review integration to DEV0318 and final combined proof to DEV0319. Leave media to DEV0297.

## Acceptance criteria

- [x] AC1: Actual saved public banner/portrait/content forms the approved responsive core template; old profiles and missing/failed media remain usable, and empty optional sections/navigation are suppressed without adding publication prerequisites.
- [x] AC2: Services, locations, actual upcoming groups and original booking/message actions retain authority; enabled, enabled-empty, unavailable/invalid and rollout-legacy catalog states behave as specified with actual 60/75/90-minute types and stable `#private-schedule` navigation.
- [x] AC3: Only disclosed indicative rates and public consented pair reviews appear; hidden amounts/private identity never enter HTML/serialized/share/metadata output, public counts/paging remain correct, and `#reviews` works for populated/empty/unavailable states.
- [x] AC4: Confirmed username, unconfirmed legacy/missing-handle, rename/alias and hidden/ineligible paths retain safe behavior; canonical metadata and explicit copy/share use the correct public URL/content, with safe date/deep-link continuation and actionable failure feedback.
- [x] AC5: Real core author-to-public evidence, 375/430/768/1024/1440 px keyboard/focus/navigation and banner/portrait/map/review/booking/group/guest-return failure cases pass alongside relevant tests/lint/types/build and retained-data preservation/owned-fixture cleanup. Gallery/video is not required evidence for this ticket.

## Validation plan

Use tagged disposable development accounts with real saved website/banner, visible/hidden/missing/zero rates, consented public/withdrawn/moderated reviews, multiple active venues and typed/legacy booking examples. Read-only checks may use existing data, but no startup/provisioning/reset may rewrite retained coaches. Record restricted runtime, fixture ownership, preserved non-target fingerprints and exact cleanup/recovery as required by [data integrity](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity).

Map evidence to AC1–AC5: authored versus legacy/empty optional content; missing/failed banner and portrait; 60/75/90-minute booking/full-fit/venue/horizon and catalog state boundaries; actual versus no/unavailable public groups; hidden-price HTML/props/metadata/share inspection; review aggregate/paging and private author link; canonical/alias/legacy/no-handle/hidden routing; copy/share denial/retry; map list fallback, FAQ/section focus and safe guest return with no implicit submit/send. Exercise all five widths with keyboard and long content. Run relevant existing and meaningful changed-behavior tests, lint, typecheck and production build; no CSS-mirroring tests or new database migration is assumed. Native/mocked presentation alone does not replace real authored/public privacy evidence. Runtime commands/results are recorded when implemented.

## Implementation record

### Changes and rationale

2026-10-17: created the initial Draft full-page plan under COR0028. It included later authorized gallery integration; no feature code or runtime validation was delivered.

2026-10-19 planning amendment under DEV0363: the user accepted core-first delivery using the current banner/portrait. Refreshed sections, public-only contracts, actionable service/contact/review/sharing work, current typed/legacy booking and testable core acceptance. Moved later public gallery/video composition to independent DEV0297; preserved its confirmed selections/open questions. Runtime code remains unchanged and unstarted.

2026-10-19 implementation start: compose a dedicated public website over the existing public DTOs, with isolated public review paging and share controls. Keep optional content/review/group failures local, reuse typed/legacy booking and map components, and use request-scoped metadata reads. No schema, provider, owner editor or retained-data changes are planned. Validation will use owned disposable fixtures and bounded source checks.

### Affected files

- [Public composition](../../../src/app/_coaches/public-coach-page.tsx) retains the existing actor-filtered booking state and all four catalog branches, adds real reviews/groups and wraps typed booking with the stable schedule target. [Discovery exports](../../../src/features/coaches/coach-discovery.tsx) point the existing profile presentation entry point at the new template; unrelated Explore changes were preserved.
- [Public website](../../../src/features/coaches/website/public-coach-website.tsx) and [scoped styles](../../../src/features/coaches/website/public-coach-website.css) compose saved content, media, real services/groups, complete locations, contact card, native FAQs and safe external links. The layout import in [layout](../../../src/app/layout.tsx) loads the scoped stylesheet. The owner editor remains unchanged.
- [Public controls](../../../src/features/coaches/website/public-website-controls.tsx) handle banner failure, explicit copy/share, cancellation/unsupported/error feedback and a selectable canonical-address fallback. [Reviews](../../../src/features/coaches/website/public-coach-reviews.tsx) retain loaded entries on paging failure, retry the same cursor, bound requests to 15 seconds and synchronize the header/list summary after a successful read. [Public model](../../../src/features/coaches/website/public-website-model.ts) re-projects review responses and creates public-only share identity and coach-specific group results.
- [Server page helpers](../../../src/server/coaches/public-website-page.ts) reuse request-scoped profile reads for metadata and content, and consume the existing public group authority. [Site origin](../../../src/server/auth/site-origin.ts) exposes only the existing validated canonical origin. [Username](../../../src/app/[handle]/page.tsx) and [legacy](../../../src/app/coaches/[slug]/page.tsx) routes use dynamic canonical metadata without changing their resolver or redirects.
- [Profile service](../../../src/server/coaches/service.ts) now omits unavailable optional website content instead of hiding the independently verified public profile. It never fills public gaps from an owner API. [Typed booking](../../../src/features/session-types/public-booking.tsx) accepts an optional selected date, checks the existing Berlin horizon and carries the current date/schedule anchor through explicit sign-in; it selects no type/time and submits nothing automatically.
- [Focused tests](../../../tests/public-coach-website.test.ts) cover public composition, rate privacy/zero, identity, real versus absent services, stable empty/unavailable anchors, bounded/private-field-stripping review parsing and exact-coach/bounded group reads. [Real rehearsal](../../../scripts/rehearse-local-public-coach-website.ts) creates tagged disposable identities and authors through the existing owner APIs. [Fixture support](../../../scripts/lib/local-connection-rehearsal.ts) adds DEV0317/port 3117 and exact-owner banner/type/group cleanup while retaining the existing ticket guards.

### Decisions and deviations

2026-10-17 DEV0330 amendment: optional coach-defined starting rates, one review per pair, username public URLs and cards before media decisions superseded the initial defaults.

2026-10-19 DEV0363 amendment: existing banner/portrait suffice for the core public page; later gallery/video composition remains independent DEV0297 work. Current section 18.6 booking replaces the initial one-hour-only assumption. These are preserved planning decisions, not retroactive media completion claims.

2026-10-19 implementation: the existing group authority has no coach filter. Adopted a bounded scan of at most twenty existing 20-item public pages, matching the exact coach slug and showing up to six next groups. Exhaustion without an authoritative end, repeated cursors and failures produce unavailable, never a false empty result. No schema, public-query permission or global inventory masquerading as coach inventory was added. A larger marketplace can later supply a separately scoped indexed coach query.

The existing typed form dropped the selected date at the sign-in boundary. The page slice now preserves a valid date/anchor using the delivered URL/horizon helpers; booking eligibility and mutation authority remain unchanged. Optional website read failure was also incorrectly hiding the whole verified profile; the new composition retains biography and other working sections.

### Contracts, configuration, and operations

No migration, dependency, environment variable, pricing policy, authoring schema, media entitlement or scheduling authority changed. New internal interfaces are the optional typed-form `selectedDate`, public presentation props, a validated site-origin accessor and request-scoped metadata helper. Existing public content/rate/review/catalog/location DTOs remain authoritative; hidden rates, owner revisions, private names/photos, booking references and credentials do not enter share identity or metadata. The public review parser copies only consented public fields, including when a response contains extra fields.

The manual rehearsal permits only the repository's loopback Auth/Storage/database and explicitly allowed preview ports. It does not provision, reset, rotate credentials for or edit retained demo coaches. Its private recovery journals contain only this run's exact temporary identity IDs and hashes, not passwords/tokens. Rollback is reverting this public composition and internal presentation/date interfaces; no data rollback is needed.

## Validation results

All commands used Node 24.21.0. No hosted rollout or independent review is claimed.

- `node --import tsx --test --test-concurrency=2 tests/*.test.ts`: **336 passed**. Initial sandbox run reported the new server helper's prohibited direct Auth-config import and tsx's local-pipe restriction. Moved origin access behind the existing Auth boundary and reran with local IPC permitted; all passed. After the later shared-review-summary adjustment, `node --import tsx --test tests/public-coach-website.test.ts tests/coach-trust.test.ts tests/coach-public-urls.test.ts tests/typed-sessions.test.ts`: **18 passed**, including nine new focused cases.
- `node --import tsx --conditions=react-server --test --test-concurrency=2 tests/server/*.test.ts`: **61 passed**, including installed/absent/null/invalid catalog cases and existing review/URL/privacy routes.
- Focused ESLint across all changed source, fixture and test files: **passed, zero errors/warnings**. Scoped Prettier and `git diff --check`: **passed**.
- Source-only snapshot `tsc --noEmit`: **passed**. The root invocation also scans ignored, incomplete `work/dev0336/commit-files` copies and fails on their missing imports/old interfaces; these were not changed. Isolated current-source snapshots under `/tmp/dev0317/` contain application/config/scripts/tests/public assets and a dependency symlink, with no populated environment or private journals.
- `NODE_OPTIONS=--max-old-space-size=1536 npm run build -- --webpack` in the isolated current-source snapshot: **passed**, including production compilation and Next.js TypeScript checking. Bundled Next.js 16.3.8 metadata/image guidance was read before the framework changes. No database migration is present, so migration tests are not applicable.

- Final documentary validation (`python3 /tmp/dev0317/validate-documents.py`): **15 affected documents, 781 local links, 65 anchors, 279 unique records and 12 reciprocal COR0028 members passed**. DEV0317 is archived once, its index/status links agree, and DEV0318/DEV0319/COR0028 remain open. Only link destinations changed in previously completed records; confirmed media decisions and the pair-review contract remain unchanged.

2026-10-19 commit preparation: verified the standalone 33-file snapshot over `afeec46`, including the current-ticket archival deletion. It excludes pending discovery/Events/How it works/authentication implementation and the shared public theme. The exact snapshot passed 58 server cases, scoped ESLint/Prettier and `npm run build -- --webpack`, including TypeScript. Its unit run passed 324 cases and hit the sandbox-only tsx pipe restriction in one startup case; the separate three-case startup rerun with IPC permitted passed, accounting for all 325 unit cases. Scoped documentary checks passed 16 files, 769 links, 65 anchors, 268 committed records and twelve reciprocal COR0028 members. The preview README's archive link and COR's current status line were corrected. Previously completed records receive only necessary link corrections. No data rehearsal or retained-data mutation was needed for commit preparation.

### Real authored data and privacy

`CONNECTION_TEST_SITE_URL=http://localhost:3117 node --import tsx --conditions=react-server scripts/rehearse-local-public-coach-website.ts` used the local restricted application runtime and newly tagged DEV0317 accounts. Final run: `tmp/dev0317-public/7b400acc/` (ignored local evidence, no credential handoff).

The rehearsal saved actual content/banner/portrait via owner APIs, created two active venues, archived only its own fresh default types to prove enabled-empty behavior, then authored 60/75/90-minute private types, availability and a published 75-minute paid group. Twenty-one newly tagged athletes received isolated past completed booking evidence and published one consented pair review each through the real API. Public API paging returned 20 + 1 entries; public HTML/React payloads excluded private athlete names. Hidden 987654-cent pricing was absent from HTML/payloads/metadata; zero retained `(Free)`; visible €45 remained indicative and separate from €15 group pricing.

Read-only HTTP checks passed for unconfirmed legacy access, canonical username metadata, legacy and rename redirects preserving only the valid date/schedule target, unknown routes, the actual group's public destination and a withdrawn review disappearing from the refreshed 20-review aggregate/list. Hiding the temporary owner returned 404 for current username, old alias, legacy profile and public website API without coach copy/rates. Republish restored the same identity. The fixture was never used to change existing coach content or credentials.

Initial rehearsal attempts exposed fixture-only mistakes: the precise Free label, fresh default types, new-type revision, hour boundaries and exact JSON venue timestamps. These were corrected. One cleanup attempt hit a session-type/venue foreign key; exact journaled recovery removed that temporary account. The banner-cleanup allowlist initially omitted DEV0317; ten objects from these same completed temporary attempts were removed through Storage, with all 61 original hashes unchanged. The harness now verifies zero exact-owner Storage leftovers and cleans types before venues. These failed attempts are not counted as acceptance evidence.

Final cleanup: the rehearsal's `finish` command passed, removing all 22 exact tagged Auth/application accounts, their review/booking/group/type/content/availability rows, both published handle reservations and all exact-owner Storage objects. Zero account/profile/Storage leftovers were verified; **all 61 original application/Auth/Storage row hashes matched the baseline**. A separate exact-coach check before cleanup proved page visits, sharing, guest selection and navigation created zero booking requests, additional bookings or group registrations. The temporary Firefox tab and owned port-3117 server were closed. Existing demo coach data and credentials were never changed.

### Native browser and controlled failure evidence

An isolated Firefox tab used the real authored page on port 3117. Responsive Design Mode confirmed actual widths 375, 430, 768, 1024 and 1440 px. Mobile content/contact stay in normal flow; tablet/desktop columns, long coach name/copy and navigation remain readable. Tab reaches the booking selector at phone width; native FAQ Tab/Enter and visible focus passed at phone, tablet, 1024 and 1440 px. The complete venue list and corresponding marker/list selected state passed.

A direct `?date=2026-10-20#private-schedule` link restored that date. Choosing the actual 75-minute type loaded real Berlin intervals including 10:00–11:15; explicit guest sign-in returned the canonical path with date and schedule anchor. No type/time/request is automatically submitted on return. Public review Load more loaded the 21st entry. Copy link reported success; the manual address omitted date/query state. Firefox lacks Web Share, and its explicit unsupported fallback worked. Platform-native successful sharing/cancellation was not available in this browser; clipboard failure was exercised through an isolated rejected call, with manual-copy feedback.

Controlled faults were applied only to `/tmp/dev0317/validation` source, never shared database permissions or product source: optional website read, catalog read, group read, initial reviews, cursor API 503 and map-style 404. Verified profile/biography/contact stayed visible, empty sections/nav vanished, booking/group/reviews retained distinct retry states and stable anchors, and map failure kept both venue texts. Removing exactly the temporary owner's three media objects produced real banner 404 fallback; a preview-only 404 portrait URL verified initials. Restoring reviews allowed initial retry, updated both header/list summary, and same-cursor retry after a paging 503 loaded the final entry without losing earlier reviews. All preview fault edits were restored before final checks.

| Criterion | Evidence | Result |
| --- | --- | --- |
| AC1 | Saved owner content/media; legacy/empty public composition tests; native optional-content and media failures | Passed |
| AC2 | Existing catalog/typed/legacy regressions; enabled-empty and real 60/75/90 types, venues, group destination; native guest date/time/sign-in flow; booking-only failure | Passed |
| AC3 | Real hidden/zero/visible rates; 21 pair reviews with 20 + 1 paging, withdrawal and private-name exclusion; bounded parser; empty/unavailable/retained-list recovery | Passed |
| AC4 | Public identity tests; real confirmation/legacy/rename/hidden/unknown HTTP checks and canonical metadata; native copy/share fallback/denial and date target | Passed |
| AC5 | Five-width native/keyboard/failure evidence, static/test/build results above; exact cleanup, zero Storage leftovers and 61 original hashes unchanged | Passed |

## Risks, limitations, and follow-ups

The public group scan is deliberately bounded; an incomplete scan reports unavailable rather than inventing inventory. Already viewed public reviews are refreshed by a new page read; this ticket does not add live moderation subscriptions. Native Web Share was unavailable in Firefox; copying and manual address recovery were verified. Retained-image replacement, gallery/video and their policy/provider work remain DEV0297. DEV0318 owns private author controls and their final public-result integration; DEV0319 owns combined core rehearsal and any hosted proof. Existing unrelated working-tree edits were preserved.

## Completion and review references

- Completed: 2026-10-19 — AC1–AC5 and required local validation passed; archived after scope/privacy review.
- Commit: User-requested on 2026-10-19; included in `[DEV0317] Build shareable personal coach websites`.
- Review: Acceptance/privacy/scope self-review; no independent review claimed.
- Deployment or release: Local validation only.
