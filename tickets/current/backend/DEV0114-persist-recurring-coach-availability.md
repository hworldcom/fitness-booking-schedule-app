# Ticket DEV0114: Persist recurring coach availability

- Status: Draft
- Created: 2026-10-04
- Last updated: 2026-10-04
- Milestone: Coach-first M2 recurring availability
- Coordination: [COR0009 — Coach-first private-class booking MVP](../organisatory/COR0009-coach-first-training-package-mvp.md)
- Related records: extends the explicit-slot foundation from [DEV0104 — Publish weekly coach availability](../../archive/backend/DEV0104-publish-weekly-coach-availability.md); supplies recurring rules and dated occurrences to [DEV0115 — Add the coach schedule calendar](../frontend/DEV0115-add-coach-schedule-calendar.md) and booking inventory to [DEV0105 — Book private classes with pass credits](DEV0105-book-private-classes-with-pass-credits.md)

## Objective and context

Replace one-week-at-a-time availability entry with an owner-managed repeating weekly schedule while retaining DEV0104's authoritative capacity-one dated slots. A coach should state the weekdays and local hours they normally offer private classes once; MovX should project concrete upcoming occurrences that clients can see and later book. This adopts the user's 2026-10-04 decision that repeating weekly availability is part of P0 rather than a later stretch goal and updates the [weekly-availability contract](../../../docs/mvp-spec.md#42-coach-publishes-weekly-availability).

## Scope and non-goals

- In scope: owner-scoped recurring weekly availability rules in the coach profile timezone; multiple non-overlapping rules per weekday; deterministic rolling-horizon occurrence generation; durable capacity-one dated occurrences compatible with DEV0104 and DEV0105; stable public-location snapshots; one-occurrence withdrawal exceptions; rule edit/pause/removal behavior; migration of or compatibility with existing explicit slots; row-level security; idempotent synchronization; daylight-saving, overlap, concurrency and authorization tests; specification and service-contract updates.
- Out of scope: the visual calendar/editor and member presentation owned by DEV0115; pass purchase, holds, booking and cancellation owned by DEV0098/DEV0105; coach offer controls; external calendar sync; arbitrary recurrence expressions; group capacity; several venues per rule; automatic buffers, travel time, waitlists, reminders or production scheduling operations.

## Expected behavior and edge cases

An authorized visible coach creates, changes, pauses or removes only their own weekly availability rules in the profile's reviewed IANA timezone. Rules produce concrete dated occurrences for the rolling public horizon. Every occurrence is capacity one and carries the confirmed provider-neutral public-location snapshot and optional fictional gym identity/name needed by existing profile and future booking views.

Synchronization is idempotent: repeated requests cannot duplicate an occurrence. Overlapping rules or occurrences fail deterministically. Editing, pausing or removing a rule may replace or withdraw only future open generated occurrences; it cannot silently move, relocate, reopen or delete a held/booked occurrence. Withdrawing one open occurrence creates a durable exception so synchronization does not regenerate it while the weekly rule remains active. Existing explicit slots remain valid and cannot be discarded during migration.

Local-time expansion must handle week boundaries and daylight-saving transitions without inventing an unintended instant. Nonexistent or ambiguous local starts fail closed or are skipped with an explicit bounded result adopted before implementation. Database/service failure returns unavailable data rather than fabricated availability.

## Assumptions, decisions, and dependencies

- Confirmed by the user on 2026-10-04: the coach panel uses a repeating weekly schedule, and signed-in MovX clients can see that availability.
- The current public guest read boundary remains unchanged unless the user separately restricts it: guests may inspect public open times, while holding or booking requires sign-in.
- DEV0104's explicit dated slots, stable location snapshots, 15-minute boundaries, 30–180-minute duration limits, capacity-one status and held/booked immutability are the compatibility baseline.
- Proposed implementation default, not yet a confirmed product decision: one rule represents one exact weekly class start and duration, such as Monday 18:00 for 60 minutes; a coach may add multiple rules on one day. This avoids automatically splitting broad windows or inventing buffers. Review and adopt or replace this choice before implementation.
- Proposed implementation default: materialize idempotent dated occurrences into the existing slot boundary and identify each by rule plus local occurrence date. This gives DEV0105 durable rows for holds/bookings and preserves withdrawn exceptions. Review the migration, synchronization trigger and rolling-horizon mechanism before implementation; no background job is silently assumed.
- DEV0115 starts after these read/mutation contracts and responsive occurrence shapes are stable. DEV0105 must book concrete occurrences, never an abstract weekly rule.

## Implementation plan

1. Reconcile the specification and freeze the recurring-rule, occurrence identity, exception, timezone, duration and rolling-horizon contracts. Decide how occurrences are synchronized without requiring an undeclared scheduler.
2. Add an additive recurring-rule/exception schema and the minimum references or constraints needed to preserve DEV0104 dated slots, location snapshots and future DEV0105 booking foreign keys.
3. Implement actor-scoped rule mutations plus idempotent occurrence synchronization/read services. Preserve existing explicit slots and prevent rule changes from mutating held/booked instances.
4. Add schema, row-level-security, service, migration, overlap, race, daylight-saving, compatibility and failure tests. Supply stable contracts to DEV0115 and update DEV0105's dependency record.

## Acceptance criteria

- [ ] AC1: An authorized coach can create, edit, pause and remove their own valid repeating weekly availability, with multiple non-overlapping entries per weekday in the reviewed timezone.
- [ ] AC2: Active rules deterministically produce exactly one concrete capacity-one occurrence per applicable date in the rolling public horizon, with a stable coach/gym location snapshot and no duplicate after retries or concurrent synchronization.
- [ ] AC3: Rule edits/removal affect only eligible future open occurrences; held/booked occurrences and their time/location remain unchanged, and a withdrawn single occurrence is not regenerated.
- [ ] AC4: Malformed, cross-coach, overlapping, daylight-saving-invalid and unauthorized rules or mutations fail without corrupting existing explicit or generated slots.
- [ ] AC5: Existing DEV0104 slots remain readable and valid through the additive migration, and DEV0105 receives one durable dated-slot identity rather than an abstract recurrence rule.
- [ ] AC6: Migration, row-level-security, database/service integration, concurrency, timezone, unit, lint, typecheck, formatting and production-build checks pass.

## Validation plan

Run clean/repeat and representative-upgrade migrations over the DEV0104 schema. Add pgTAP and database integration coverage for owner isolation, rule/occurrence uniqueness, overlapping rules, concurrent synchronization, single-occurrence withdrawal, rule edit/pause/removal, held/booked immutability, explicit-slot compatibility and daylight-saving boundaries. Exercise service failure/unavailable mappings. Run relevant unit, lint, typecheck, formatting and Next.js/Cloudflare production builds. No Solana or Mapbox provider request is required for this backend ticket.

## Implementation record

Pending implementation. The record was created after the user confirmed repeating weekly availability; no schema or runtime edit has started.

### Changes and rationale

Pending implementation.

### Affected files

Planned: the MVP specification; an additive Supabase migration; coach schema/domain/repository/service contracts; database and unit tests; and the COR0009/DEV0105 dependency records. DEV0115 owns the visual calendar and member-facing schedule presentation.

### Decisions and deviations

- 2026-10-04: Repeating weekly availability replaces the prior P0 decision to require coaches to recreate explicit slots each week. Concrete dated occurrences remain authoritative for capacity, snapshots and future booking.
- The exact rule granularity and occurrence-synchronization mechanism remain proposed defaults and must be reviewed before implementation.

### Contracts, configuration, and operations

An additive recurring-rule and exception/occurrence-link contract is expected. Existing `app.coach_availability_slots` rows and callable owner/public boundaries must remain compatible until a reviewed forward migration changes them. No new environment variable, provider credential or Solana contract is planned. Any scheduler or Cloudflare Cron dependency would be a material approach change and must be recorded before implementation.

## Validation results

Not run — planning only.

## Risks, limitations, and follow-ups

Recurrence expansion can duplicate inventory, mishandle daylight-saving time or mutate booked history if occurrence identity is not stable. The design must preserve one-off exceptions and existing slots without relying on a best-effort browser visit. Broad availability windows, buffers and variable booking duration remain unresolved alternatives; DEV0114 must adopt one bounded P0 rule shape before implementation. DEV0115 and DEV0105 remain downstream.

## Completion and review references

- Completed: Not completed.
- Commit: This commit — `[DEV0114][DEV0115] Plan recurring coach schedules`.
- Review: Planning self-review only; no independent review.
- Deployment or release: None.
