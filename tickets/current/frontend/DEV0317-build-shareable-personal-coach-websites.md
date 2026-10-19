# Ticket DEV0317: Build shareable personal coach websites

- Status: Draft
- Created: 2026-10-17
- Last updated: 2026-10-19
- Milestone: M10 — Core public coach websites
- Coordination: [COR0028 — Coach marketplace cards and personal websites](../organisatory/COR0028-coach-marketplace-cards-and-personal-websites.md)
- Related records: Completed foundations [DEV0321](../../archive/backend/DEV0321-persist-coach-website-content-and-banners.md), [DEV0313](../../archive/backend/DEV0313-manage-coach-starting-prices-and-visibility.md), [DEV0314](../../archive/backend/DEV0314-persist-booking-linked-coach-reviews.md), [DEV0331](../../archive/backend/DEV0331-enable-username-based-public-coach-urls.md), [DEV0315](../../archive/frontend/DEV0315-edit-and-preview-coach-websites.md), [DEV0316](../../archive/frontend/DEV0316-redesign-coach-directory-cards.md); approved visual example [DEV0338](../../archive/frontend/DEV0338-preview-a-personal-coach-page.md); booking compatibility [COR0029](../../archive/organisatory/COR0029-session-types-and-flexible-bookings.md), [DEV0348](../../archive/backend/DEV0348-keep-coach-profiles-visible-before-session-type-rollout.md); downstream author integration [DEV0318](DEV0318-add-athlete-coach-review-controls.md), combined proof [DEV0319](../backend/DEV0319-rehearse-coach-marketplace-websites.md); independent later media [DEV0297](../backend/DEV0297-add-coach-profile-photos-and-mux-video.md); historical contract [DEV0320](../../archive/organisatory/DEV0320-adopt-coach-marketplace-website-contract.md), [DEV0330](../../archive/organisatory/DEV0330-refine-coach-marketplace-pricing-reviews-and-urls.md); current planning amendment [DEV0363](../../archive/organisatory/DEV0363-refresh-core-coach-website-delivery-plan.md).

## Objective and context

Replace the current public biography/location/booking layout with the agreed shareable personal coach website, using saved public content and the existing banner/portrait. Directory cards are completed separately under DEV0316; the owner editor/preview is completed under DEV0315. This ticket owns the actual public-page composition.

Follow the [M10 contract](../../../docs/mvp-spec.md#19-coach-marketplace-cards-and-personal-websites), [public template](../../../docs/mvp-spec.md#192-public-content-and-template), [session-type booking](../../../docs/mvp-spec.md#186-session-types-and-flexible-bookings), [milestone](../../../docs/mvp-spec.md#12-delivery-milestones) and [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix). On 19 October the user accepted refreshing the plan for core-page delivery before later gallery/video. This request updates planning only; runtime implementation has not started.

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

Scope review: one coherent public-page composition over existing services; no new authoring, media or scheduling engine. If investigation exposes a required independent schema/authority capability, record that boundary and use a separately scoped dependency before implementing it. Draft is retained because this turn requests planning only, not runtime work; the refreshed plan is actionable when implementation is requested.

## Implementation plan

1. Inspect current username/legacy routes, `PublicCoachPage`/`CoachProfileView`, saved preview/content/rate/review contracts, typed booking, location/map, messaging and public-group reads. Read installed Next.js metadata/image/navigation guidance before framework edits; record concrete public-only composition and reuse boundaries.
2. Implement the responsive banner/identity/main-content/contact template with public saved content, truthful legacy/empty/failure fallbacks, safe FAQ/external links and unobstructive section anchors. Retain working directory/card navigation and avoid changing owner editing.
3. Compose existing typed/legacy booking and contact actions; preserve all four catalog states above, original request/guest-return behavior and real locations. Inspect the existing public group query's coach scoping and bounded projection before wiring upcoming groups; add no new group authority or fabricated offers.
4. Add actual public review summary/paging and stable `#reviews`; coordinate the anchor/URL contract with DEV0318. Keep rates and every public output on the public DTOs; never use an owner API to fill missing public values.
5. Add canonical public metadata, public share image/description and explicit copy/share/error feedback through existing validated origin/path contracts. Regress confirmed/unconfirmed/renamed/legacy/hidden URLs and date/anchor continuation without changing the resolver.
6. Validate the matrix below using isolated real authored records, appropriate existing/focused tests, lint, types and production build; review scope/privacy and record exact cleanup. Complete DEV0317 on core criteria only; hand public review integration to DEV0318 and final combined proof to DEV0319. Leave media to DEV0297.

## Acceptance criteria

- [ ] AC1: Actual saved public banner/portrait/content forms the approved responsive core template; old profiles and missing/failed media remain usable, and empty optional sections/navigation are suppressed without adding publication prerequisites.
- [ ] AC2: Services, locations, actual upcoming groups and original booking/message actions retain authority; enabled, enabled-empty, unavailable/invalid and rollout-legacy catalog states behave as specified with actual 60/75/90-minute types and stable `#private-schedule` navigation.
- [ ] AC3: Only disclosed indicative rates and public consented pair reviews appear; hidden amounts/private identity never enter HTML/serialized/share/metadata output, public counts/paging remain correct, and `#reviews` works for populated/empty/unavailable states.
- [ ] AC4: Confirmed username, unconfirmed legacy/missing-handle, rename/alias and hidden/ineligible paths retain safe behavior; canonical metadata and explicit copy/share use the correct public URL/content, with safe date/deep-link continuation and actionable failure feedback.
- [ ] AC5: Real core author-to-public evidence, 375/430/768/1024/1440 px keyboard/focus/navigation and banner/portrait/map/review/booking/group/guest-return failure cases pass alongside relevant tests/lint/types/build and retained-data preservation/owned-fixture cleanup. Gallery/video is not required evidence for this ticket.

## Validation plan

Use tagged disposable development accounts with real saved website/banner, visible/hidden/missing/zero rates, consented public/withdrawn/moderated reviews, multiple active venues and typed/legacy booking examples. Read-only checks may use existing data, but no startup/provisioning/reset may rewrite retained coaches. Record restricted runtime, fixture ownership, preserved non-target fingerprints and exact cleanup/recovery as required by [data integrity](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity).

Map evidence to AC1–AC5: authored versus legacy/empty optional content; missing/failed banner and portrait; 60/75/90-minute booking/full-fit/venue/horizon and catalog state boundaries; actual versus no/unavailable public groups; hidden-price HTML/props/metadata/share inspection; review aggregate/paging and private author link; canonical/alias/legacy/no-handle/hidden routing; copy/share denial/retry; map list fallback, FAQ/section focus and safe guest return with no implicit submit/send. Exercise all five widths with keyboard and long content. Run relevant existing and meaningful changed-behavior tests, lint, typecheck and production build; no CSS-mirroring tests or new database migration is assumed. Native/mocked presentation alone does not replace real authored/public privacy evidence. Runtime commands/results are recorded when implemented.

## Implementation record

### Changes and rationale

2026-10-17: created the initial Draft full-page plan under COR0028. It included later authorized gallery integration; no feature code or runtime validation was delivered.

2026-10-19 planning amendment under DEV0363: the user accepted core-first delivery using the current banner/portrait. Refreshed sections, public-only contracts, actionable service/contact/review/sharing work, current typed/legacy booking and testable core acceptance. Moved later public gallery/video composition to independent DEV0297; preserved its confirmed selections/open questions. Runtime code remains unchanged and unstarted.

### Affected files

Planning updated this record, the current specification, COR0028, DEV0319, DEV0297 and index under DEV0363. Future runtime investigation areas are [public route composition](../../../src/app/_coaches/public-coach-page.tsx), [username route](../../../src/app/[handle]/page.tsx), [legacy route](../../../src/app/coaches/[slug]/page.tsx), [current template](../../../src/features/coaches/coach-discovery.tsx), [saved preview](../../../src/features/coaches/website/coach-website-preview.tsx), [locations](../../../src/features/coaches/coach-profile-locations.tsx), [typed booking](../../../src/features/session-types/public-booking.tsx) and [legacy booking](../../../src/features/coaches/coach-marketplace.tsx). These are not claims of runtime edits.

### Decisions and deviations

2026-10-17 DEV0330 amendment: optional coach-defined starting rates, one review per pair, username public URLs and cards before media decisions superseded the initial defaults.

2026-10-19 DEV0363 amendment: completed cards now permit the core public-page slice. Existing banner/portrait suffice; public gallery/video composition and its required policy review remain later DEV0297 work, without blocking DEV0317/COR0028 core completion. Current section 18.6 booking replaces the original one-hour-only assumption; no new scheduling behavior is selected. Preserve these dated changes rather than treating the original gallery gate as completed evidence.

### Contracts, configuration, and operations

This revision changes delivery planning only. Runtime contract/configuration/schema/dependency/migration changes: none implemented. Future page composition consumes existing public contracts; no new API, environment variable or migration is presumed. Never record credentials or modify retained demo data for the page.

## Validation results

- 2026-10-17: original planning consistency checks recorded under DEV0330.
- 2026-10-19: current documentary checks are owned by DEV0363; refreshed ownership, dependencies, criteria and booking/media boundaries reviewed.
- Runtime tests/build/browser/database/provider checks: Not run — implementation has not started. AC1–AC5 remain unchecked.

| Criterion | Evidence | Result |
| --- | --- | --- |
| AC1–AC5 | Future runtime matrix above; documentary review does not satisfy feature acceptance | Not run |

## Risks, limitations, and follow-ups

The live public page still uses the older template until this ticket is implemented. Core prerequisites are delivered locally; deployed service/schema availability must be checked in the implementation environment. DEV0297's media policy/capability remains separate. DEV0318 needs the actual public `#reviews` destination; DEV0319 proves the combined core outcome. Neither this refreshed plan nor the approved example is runtime/deployment evidence.

## Completion and review references

- Completed: Not completed — core runtime work remains Draft.
- Commit: No runtime commit; this plan revision belongs to DEV0363, with no commit requested.
- Review: Planning scope/ownership self-review; runtime/independent review pending.
- Deployment or release: None.
