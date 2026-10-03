# Ticket DEV0104: Publish weekly coach availability

- Status: Draft
- Created: 2026-10-03
- Last updated: 2026-10-03
- Milestone: Coach-first M2 private availability
- Coordination: [COR0009 — Coach-first private-class booking MVP](../organisatory/COR0009-coach-first-training-package-mvp.md)
- Related records: depends on persistent coach identity from [DEV0096 — Persist coach profiles and discovery](DEV0096-persist-coach-profiles-and-discovery.md); supplies capacity-one slots to [DEV0105 — Book private classes with pass credits](DEV0105-book-private-classes-with-pass-credits.md)

## Objective and context

Let a coach publish explicit private-class availability for the coming seven days and let guests and clients see only bookable capacity-one slots. Availability is a core product input, not fabricated live data and not an external arrangement outside MovX.

## Scope and non-goals

- In scope: coach-owned timezone-aware capacity-one slots; rolling seven-day public projection; create, update or withdraw open future slots; deterministic conflict prevention; booked/held visibility without leaking client identity; coach and public weekly views; honest empty/loading/error states; responsive keyboard-accessible controls; migration, row-level-security, service and browser tests.
- Out of scope: recurring availability rules, group capacity, waitlists, external calendar sync, staff calendars, client booking, payment, pass eligibility, cancellation of confirmed bookings, reminders or production scheduling operations.

## Expected behavior and edge cases

An authenticated visible coach creates discrete future start/end intervals in the coach profile's reviewed timezone. Intervals must have positive bounded duration, fall within the supported publication horizon and not overlap another active slot for that coach. Guests see only open slots in the coming seven days. Internal holds or confirmed bookings make a slot unavailable without exposing the client's identity.

A coach may edit or withdraw an open future slot. A held or confirmed slot cannot be silently moved or deleted; DEV0105 owns hold expiry and booking cancellation so the client keeps a consistent reservation and credit. Concurrent creation of overlapping slots fails atomically. Database failure produces an unavailable state rather than fixture availability.

## Assumptions, decisions, and dependencies

Availability and bookings are authoritative off-chain because calendar queries and concurrency are application concerns. The MVP uses explicit slots instead of recurring-rule expansion. Each slot represents one private class with capacity one. Store timestamps as instants and retain the coach's IANA timezone for entry and presentation; initial demonstration coaches use `Europe/Berlin`.

DEV0096 must provide the visible coach profile and owner authorization. DEV0105 owns client-facing holds and booking state; this ticket must expose a narrow concurrency-safe slot boundary rather than implementing partial booking behavior.

## Implementation plan

1. Freeze slot duration, rolling-horizon, timezone, overlap and lifecycle contracts.
2. Add additive slot schema, constraints, indexes, forced row-level security and restricted owner/public functions or repositories.
3. Add coach weekly availability controls and guest/client read projections on coach profiles.
4. Validate owner isolation, overlap races, timezone/day-boundary behavior, held/booked immutability and honest failures.

## Acceptance criteria

- [ ] AC1: A visible coach can create, edit and withdraw only their own valid open slots for the supported seven-day horizon.
- [ ] AC2: Overlapping, malformed, past, cross-coach and concurrent conflicting mutations fail without duplicate availability.
- [ ] AC3: Guests see deterministic open capacity-one availability without client, hold or internal lifecycle details.
- [ ] AC4: Held or confirmed slots cannot be silently moved or reopened by availability controls.
- [ ] AC5: Migration, authorization, concurrency, timezone, responsive browser, static and build checks pass.

## Validation plan

Run clean/repeat migration and seed checks, database constraint/RLS/concurrency tests, owner/other/anonymous service integration, timezone and rolling-window unit tests, and desktop/mobile keyboard browser scenarios. Run relevant unit, lint, typecheck, formatting and production-build commands. No Solana or Devnet transaction is applicable.

## Implementation record

Not started.

### Changes and rationale

Pending implementation.

### Affected files

Planned: additive availability migration and Drizzle mappings, repositories/services/routes, coach controls, public weekly projection and focused tests.

### Decisions and deviations

None yet.

### Contracts, configuration, and operations

New off-chain availability contracts are planned. No new secret is expected. Exact slot duration and publication bounds must be adopted before implementation.

## Validation results

Not run — no implementation.

## Risks, limitations, and follow-ups

Daylight-saving transitions and concurrent overlapping writes require database-level enforcement rather than browser checks. Recurring calendars and external calendar synchronization are intentionally deferred.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: Planning self-review only.
- Deployment or release: None.
