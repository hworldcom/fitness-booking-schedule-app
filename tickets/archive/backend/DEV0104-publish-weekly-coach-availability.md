# Ticket DEV0104: Publish weekly coach availability

- Status: Completed
- Created: 2026-10-03
- Last updated: 2026-10-03
- Milestone: Coach-first M2 private availability
- Coordination: [COR0009 — Coach-first private-class booking MVP](../../current/organisatory/COR0009-coach-first-training-package-mvp.md)
- Related records: depends on persistent coach identity, optional gym affiliation and confirmed public location from [DEV0096 — Persist coach profiles and discovery](DEV0096-persist-coach-profiles-and-discovery.md), which consumes the simplified gyms from [DEV0109 — Retire membership schema and preserve gyms](DEV0109-retire-membership-schema-and-preserve-gyms.md); supplies capacity-one slots/location snapshots to [DEV0105 — Book private classes with pass credits](../../current/backend/DEV0105-book-private-classes-with-pass-credits.md) and public projections to [DEV0108 — Add the Mapbox coach Explore map](../../current/frontend/DEV0108-add-mapbox-coach-explore-map.md)

## Objective and context

Let a coach publish explicit private-class availability for the coming seven days and let guests and clients see only bookable capacity-one slots. Availability is a core product input, not fabricated live data and not an external arrangement outside MovX.

## Scope and non-goals

- In scope: a minimal protected coach workspace with Profile and Availability navigation; coach-owned timezone-aware capacity-one slots; immutable provider-neutral snapshot of the coach's confirmed public location—including optional fictional gym identity/name when selected—when each slot is created; rolling seven-day public projection; create, update or withdraw open future slots; deterministic conflict prevention; booked/held visibility without leaking client identity; coach and public weekly views; honest empty/loading/error states; responsive keyboard-accessible controls; migration, row-level-security, service and browser tests.
- Out of scope: speculative Offers or Bookings panels before their owning tickets deliver them; dashboard analytics; Mapbox rendering/geocoding; gym-managed class schedules, memberships, access claims or check-ins, recurring availability rules, multiple/per-slot venue selection, group capacity, waitlists, external calendar sync, staff calendars, client booking, payment, pass eligibility, cancellation of confirmed bookings, reminders or production scheduling operations.

## Expected behavior and edge cases

An authenticated visible coach creates discrete future start/end intervals in the coach profile's reviewed timezone. Intervals must have positive bounded duration, fall within the supported publication horizon and not overlap another active slot for that coach. Guests see only open slots in the coming seven days. Internal holds or confirmed bookings make a slot unavailable without exposing the client's identity.

A coach may edit or withdraw an open future slot, including explicitly updating its location snapshot to the coach's current confirmed public location. When that location comes from a gym affiliation, the snapshot retains the gym identifier/name plus public label and coordinates; later gym or profile edits never rewrite existing slots. A held or confirmed slot cannot be silently moved, relocated or deleted; DEV0105 owns hold expiry and booking cancellation so the client keeps a consistent reservation, place and credit. Concurrent creation of overlapping slots fails atomically. Database failure produces an unavailable state rather than fixture availability.

## Assumptions, decisions, and dependencies

Availability and bookings are authoritative off-chain because calendar queries and concurrency are application concerns. The MVP uses explicit slots instead of recurring-rule expansion. Each slot represents one private class with capacity one. Store timestamps as instants and retain the coach's IANA timezone for entry and presentation; initial demonstration coaches use `Europe/Berlin`.

DEV0096 must provide the visible coach profile, one confirmed public location, optional eligible gym affiliation and owner authorization. A slot copies the bounded public label and coordinates plus optional gym identity/name so Mapbox/provider, gym or profile changes cannot alter a booked class. The gym is descriptive location data only and has no slot authority. DEV0105 owns client-facing holds and booking state; this ticket must expose a narrow concurrency-safe slot boundary rather than implementing partial booking behavior.

The coach workspace uses `/coach` as the durable protected entry point. Its initial navigation exposes only Profile, which links to the existing `/profile/coach` editor, and Availability, owned here; later tickets may add Offers and Bookings when those capabilities are real. Availability remains explicit rather than recurring: slots start on 15-minute boundaries, last 30–180 minutes in 15-minute increments, default to 60 minutes in the interface, start in the future and end within the rolling seven-day publication horizon.

## Implementation plan

1. Establish the minimal coach workspace and freeze slot duration, rolling-horizon, timezone, independent-or-gym location-snapshot, overlap and lifecycle contracts.
2. Add additive slot/location-snapshot schema, constraints, indexes, forced row-level security and restricted owner/public functions or repositories.
3. Add coach weekly availability controls and guest/client read projections on coach profiles.
4. Validate owner isolation, overlap races, timezone/day-boundary behavior, held/booked immutability and honest failures.

## Acceptance criteria

- [x] AC1: A visible coach with a confirmed independent or fictional-gym public location can create, explicitly edit and withdraw only their own valid open slots for the supported seven-day horizon; each slot carries a stable location snapshot with optional gym identity/name.
- [x] AC2: Overlapping, malformed, past, cross-coach and concurrent conflicting mutations fail without duplicate availability.
- [x] AC3: Guests see deterministic open capacity-one availability without client, hold or internal lifecycle details.
- [x] AC4: Profile or gym-location changes do not rewrite existing slots, and held or confirmed slots cannot be silently moved, relocated or reopened by availability controls.
- [x] AC5: Migration, authorization, concurrency, timezone, responsive browser, static and build checks pass.

## Validation plan

Run clean/repeat migration and seed checks, database constraint/RLS/concurrency tests, owner/other/anonymous service integration, timezone and rolling-window unit tests, and desktop/mobile keyboard browser scenarios. Run relevant unit, lint, typecheck, formatting and production-build commands. No Solana or Devnet transaction is applicable.

## Implementation record

Implementation started on 2026-10-03 after the user confirmed that coach operations should live in a dedicated panel. DEV0096's committed coach identity and confirmed-location boundary is available; its final ticket-close validation may proceed independently.

### Changes and rationale

The adopted P0 panel is intentionally small: Profile and Availability only. `/coach` now gives an authorized account an honest profile-required or visible-profile workspace, a slot-publishing form, and owner controls for upcoming slots. `/profile/coach` has reciprocal panel navigation, and the account profile links into the coach workspace. Future offer, booking and analytics sections are not rendered before their owning tickets provide real behavior.

The additive availability table stores instants, the reviewed coach timezone, lifecycle status and a complete provider-neutral public-location snapshot. Restricted security-definer functions interpret local wall time in the coach profile timezone, reject nonexistent or ambiguous daylight-saving times, enforce the rolling horizon and copy the current profile/gym location only at creation or when the owner explicitly requests a refresh. A GiST exclusion constraint serializes overlapping active-slot writes for one coach. Direct runtime writes remain prohibited by forced row-level security.

The owner can create, move or withdraw only their own future `open` slots. `held` and `booked` are reserved lifecycle values for DEV0105 and are visible to the coach without client data but cannot be altered by availability controls. Public coach profiles query a separate projection that returns only open slots inside the exact seven-day horizon and omits internal status. Database or mapping failure produces the existing unavailable profile state; no fixture time is substituted.

### Affected files

- [`docs/mvp-spec.md`](../../../docs/mvp-spec.md) records the adopted 15-minute boundary, 30–180-minute duration and rolling seven-day contract as confirmed decision C21.
- [`supabase/migrations/20261003000300_create_coach_availability.sql`](../../../supabase/migrations/20261003000300_create_coach_availability.sql) adds the slot/location-snapshot schema, active-overlap exclusion, forced row-level security, public/owner reads and three owner-scoped mutation functions. [`src/server/db/schema/coaches.ts`](../../../src/server/db/schema/coaches.ts) mirrors the application-facing table shape.
- [`src/domain/coaches.ts`](../../../src/domain/coaches.ts), [`src/server/db/coaches/availability-repository.ts`](../../../src/server/db/coaches/availability-repository.ts) and [`src/server/coaches/service.ts`](../../../src/server/coaches/service.ts) define bounded inputs/projections, map policy-filtered records, preserve typed conflict outcomes and expose public/owner services.
- [`src/app/coach/page.tsx`](../../../src/app/coach/page.tsx), [`src/app/coach/actions.ts`](../../../src/app/coach/actions.ts), [`src/features/coaches/coach-availability-panel.tsx`](../../../src/features/coaches/coach-availability-panel.tsx) and [`src/app/coach-workspace.css`](../../../src/app/coach-workspace.css) implement the protected responsive coach panel, Server Actions, explicit slot controls and honest profile/visibility gates.
- [`src/features/coaches/coach-discovery.tsx`](../../../src/features/coaches/coach-discovery.tsx) and [`src/app/coach-discovery.css`](../../../src/app/coach-discovery.css) replace the placeholder weekly block with open database-backed slots or an honest empty state. The coach-profile/account components add reciprocal workspace entry points.
- [`supabase/tests/database/coach-availability.test.sql`](../../../supabase/tests/database/coach-availability.test.sql), [`tests/database/coach-availability.test.ts`](../../../tests/database/coach-availability.test.ts), [`tests/coaches.test.ts`](../../../tests/coaches.test.ts) and [`tests/browser/coach-discovery.spec.ts`](../../../tests/browser/coach-discovery.spec.ts) cover schema policy, authorization, races, snapshots, timezone rules and public responsive behavior. [`scripts/rehearse-local-coach-availability.mjs`](../../../scripts/rehearse-local-coach-availability.mjs) provides the authenticated publish/public/edit/withdraw browser rehearsal documented in [`README.md`](../../../README.md).

### Decisions and deviations

The workspace is separate from the public coach profile and reuses the existing `/profile/coach` editor instead of moving DEV0096's route. Slot input accepts 30–180 minutes in 15-minute increments and defaults to 60 minutes; recurring schedules remain deferred. An edit preserves the original location snapshot unless the coach checks the explicit refresh control. Nonexistent and duplicated daylight-saving wall times fail closed rather than silently selecting an unintended instant.

The authenticated rehearsal exposed that the existing coach-profile client imported its `useActionState` initial object from a `"use server"` module. That value became undefined in the browser despite static checks passing. Both coach forms now keep their serializable initial state inside the client module while importing only the Server Action and its type. Visual review also added explicit dark text to white secondary actions inside dark coach headers.

### Contracts, configuration, and operations

`app.coach_availability_slots` is the new authoritative off-chain capacity-one inventory. Active statuses are `open`, `held` and `booked`; `withdrawn` records remain for audit and no delete mutation is exposed. The callable runtime contracts are `app.create_owned_coach_availability(timestamp, integer)`, `app.update_owned_coach_availability(uuid, timestamp, integer, boolean)` and `app.withdraw_owned_coach_availability(uuid)`. Application runtime receives policy-filtered `select` plus execute on those functions, never direct insert/update/delete.

No dependency, Mapbox credential, public environment variable or secret was added. `npm run test:coach-availability` is a new local-only rehearsal command and requires the documented Auth-enabled stack, current local Supabase public values and an application on port 3100. The migration is additive and was applied only to the disposable local database; no hosted schema was changed. Before a hosted apply, use the repository's normal reviewed migration/backup process. A rollback before DEV0105 references slots can remove the three functions and table; after downstream booking references exist, recovery must use a reviewed forward migration instead of dropping inventory.

## Validation results

- `npm run db:reset` — passed from a clean disposable database; all migrations through `20261003000300` and the deterministic seed applied.
- `npm run db:seed` — passed immediately after reset, proving the fixture seed remains repeatable.
- `npm run db:test` — passed all 120 pgTAP checks across five files, including the new table, constraints, overlap exclusion, privileges, row-level-security policies and public filtering.
- `npm run test:db` — passed all 19 integration tests; the five availability cases prove owner/other isolation, public status omission, profile/gym snapshot stability, explicit refresh, concurrent overlap serialization, held/booked immutability, invalid daylight-saving times and past/out-of-horizon rejection.
- `npm run db:lint` — passed with no schema errors.
- `npm test` — passed all 53 unit/boundary tests, including slot input and timezone formatting.
- `npm run lint` — passed with no errors or warnings.
- `npm run typecheck` — passed after Next.js route type generation.
- `npm run format:check` — passed for all configured application, script and test files.
- `npm run build` — passed the Next.js 16.3.5 production build; `/coach` and `/coaches/[slug]` are dynamic routes.
- `npm run test:e2e` — passed all 26 Playwright cases at desktop and mobile widths, including public profile availability and the protected coach-workspace boundary.
- `npm run test:coach-availability` — passed against the local Auth-enabled stack with a new account: created a visible gym-backed coach profile, published one slot, observed the same public slot, edited it, withdrew it, observed the public empty state, focused workspace navigation by keyboard and verified no mobile horizontal overflow. Desktop/mobile screenshots were inspected; the final contrast correction made the public-profile action readable.
- `git diff --check` — passed before record completion.
- Solana/Devnet transaction — not applicable; DEV0104 owns off-chain calendar inventory only.

## Risks, limitations, and follow-ups

Recurring calendars, external calendar synchronization, per-slot locations, client booking, pass/payment eligibility and cancellation remain deferred. DEV0105 may transition slots to `held` or `booked` only through its own reviewed operations; the availability functions deliberately cannot do so. No fixture availability is seeded, so a coach with no published rows shows an honest empty state rather than a staged schedule.

The local `.env.local` public key predated the restarted Supabase Auth stack during validation. The authenticated rehearsal used the current local publishable key returned by `npm run auth:status` without changing or recording the user's ignored environment file. Hosted deployment and independent review were not performed.

## Completion and review references

- Completed: 2026-10-03.
- Commit: Not created.
- Review: Implementation self-review against AC1–AC5; no independent review.
- Deployment or release: None.
