# Ticket DEV0114: Persist recurring coach availability

- Status: Completed
- Created: 2026-10-04
- Last updated: 2026-10-04
- Milestone: Coach-first M2 recurring availability
- Coordination: [COR0009 — Coach-first private-class booking MVP](../../current/organisatory/COR0009-coach-first-training-package-mvp.md)
- Related records: extends the explicit-slot foundation from [DEV0104 — Publish weekly coach availability](DEV0104-publish-weekly-coach-availability.md); supplies recurring rules and dated occurrences to [DEV0115 — Add the coach schedule calendar](../../current/frontend/DEV0115-add-coach-schedule-calendar.md) and booking inventory to [DEV0105 — Book private classes with pass credits](../../current/backend/DEV0105-book-private-classes-with-pass-credits.md)

## Objective and context

Replace one-week-at-a-time availability entry with an owner-managed repeating weekly schedule of exact one-hour slots while retaining DEV0104's authoritative capacity-one dated slots. A coach selects the weekday/start-time cells they normally offer once; MovX projects concrete upcoming one-hour occurrences that clients can see and later book. This adopts the user's 2026-10-04 decision that repeating weekly availability is part of P0 and that variable durations/advanced recurrence should wait for later versions, and updates the [weekly-availability contract](../../../docs/mvp-spec.md#42-coach-publishes-weekly-availability).

## Scope and non-goals

- In scope: owner-scoped exact one-hour recurring weekly slots in the coach profile timezone; multiple non-overlapping entries per weekday; deterministic rolling-horizon occurrence generation; durable capacity-one dated occurrences compatible with DEV0104 and DEV0105; stable public-location snapshots; add/remove rule behavior; migration of or compatibility with existing explicit slots; row-level security; idempotent synchronization after mutations and before reads; daylight-saving, overlap, concurrency and authorization tests; specification and service-contract updates.
- Out of scope: the visual calendar/editor and member presentation owned by DEV0115; pass purchase, holds, booking and cancellation owned by DEV0098/DEV0105; variable duration, broad availability windows, automatic window splitting, rule pause/resume, one-occurrence exceptions, cross-midnight slots or advanced recurrence; coach offer controls; external calendar sync; group capacity; several venues per rule; automatic buffers, travel time, waitlists, reminders or production scheduling operations.

## Expected behavior and edge cases

An authorized visible coach creates or removes only their own exact one-hour weekly slots in the profile's reviewed IANA timezone. A recurring slot starts on a whole-hour local boundary and repeats on the selected weekday/time; consecutive availability is represented by multiple one-hour entries. Active rules produce concrete dated occurrences for the rolling public horizon. Every occurrence is capacity one and carries the confirmed provider-neutral public-location snapshot and optional fictional gym identity/name needed by existing profile and future booking views.

Synchronization is idempotent: repeated requests cannot duplicate an occurrence. Overlapping rules or occurrences fail deterministically. Removing a rule withdraws only its future open generated occurrences; it cannot silently move, relocate, reopen or delete a held/booked occurrence. A changed weekly time is represented by removing the old rule and creating a new one. Existing explicit slots remain valid and cannot be discarded during migration.

Local-time expansion must handle week boundaries and daylight-saving transitions without inventing an unintended instant. A nonexistent or ambiguous occurrence is omitted for that date and never shifted silently; advanced exception controls are deferred. Database/service failure returns unavailable data rather than fabricated availability.

## Assumptions, decisions, and dependencies

- Confirmed by the user on 2026-10-04: the coach panel uses a normal repeating weekly calendar of one-hour slots, signed-in MovX clients can see that availability, and advanced scheduling edge cases should wait for later versions.
- The current public guest read boundary remains unchanged unless the user separately restricts it: guests may inspect public open times, while holding or booking requires sign-in.
- DEV0104's explicit dated slots, stable location snapshots, capacity-one status and held/booked immutability are the compatibility baseline. New recurring rules start on whole-hour local boundaries and always have a 60-minute duration; existing one-off rows with other valid historical times/durations remain readable.
- One rule represents one exact weekday/start-time slot, such as Monday 18:00–19:00; a coach may add multiple rules on one day. A broad period such as 18:00–21:00 is represented by three adjacent one-hour rules rather than browser/server auto-splitting.
- Materialize idempotent dated occurrences into the existing slot boundary and identify each by rule plus local occurrence date. Invoke bounded synchronization after owner rule mutations and before owner/public schedule reads, using database locking/uniqueness to handle concurrent requests. This avoids an undeclared background job or best-effort browser-only generation.
- A rule snapshots its IANA timezone. Later profile-timezone changes do not silently shift existing rules or generated occurrences; the coach removes/recreates rules in the new timezone. Generated occurrences snapshot the current confirmed location when first created and never move after later profile/gym edits.
- DEV0115 starts after these read/mutation contracts and responsive occurrence shapes are stable. DEV0105 must book concrete occurrences, never an abstract weekly rule.

## Implementation plan

1. Freeze the exact one-hour recurring-rule, occurrence identity, timezone and rolling-horizon contracts in the specification and domain types.
2. Add an additive weekly-rule table and nullable rule/date identity on existing dated slots, preserving DEV0104 rows, location snapshots and future DEV0105 booking foreign keys.
3. Implement actor-scoped create/remove mutations plus bounded idempotent occurrence synchronization after mutations and before reads. Preserve existing explicit slots and prevent rule removal from mutating held/booked instances.
4. Add schema, row-level-security, service, migration, overlap, race, daylight-saving, compatibility and failure tests. Supply stable contracts to DEV0115 and update DEV0105's dependency record.

## Acceptance criteria

- [x] AC1: An authorized coach can create and remove their own exact repeating one-hour, whole-hour-start slots, with multiple non-overlapping entries per weekday in the reviewed timezone.
- [x] AC2: Active rules deterministically produce exactly one concrete capacity-one occurrence per applicable date in the rolling public horizon, with a stable coach/gym location snapshot and no duplicate after retries or concurrent synchronization.
- [x] AC3: Removing a rule withdraws only its eligible future open occurrences; held/booked occurrences and their time/location remain unchanged, and changing a weekly time uses remove-plus-create rather than mutating history.
- [x] AC4: Malformed, cross-coach, overlapping, daylight-saving-invalid and unauthorized rules or mutations fail without corrupting existing explicit or generated slots.
- [x] AC5: Existing DEV0104 slots remain readable and valid through the additive migration, and DEV0105 receives one durable dated-slot identity rather than an abstract recurrence rule.
- [x] AC6: Migration, row-level-security, database/service integration, concurrency, timezone, unit, lint, typecheck, formatting and production-build checks pass.

## Validation plan

Run clean/repeat and representative-upgrade migrations over the DEV0104 schema. Add pgTAP and database integration coverage for owner isolation, exact 60-minute rules, rule/occurrence uniqueness, overlapping rules, concurrent synchronization, rule removal, held/booked immutability, explicit-slot compatibility and daylight-saving omission. Exercise service failure/unavailable mappings. Run relevant unit, lint, typecheck, formatting and Next.js/Cloudflare production builds. No Solana or Mapbox provider request is required for this backend ticket.

## Implementation record

Implementation started on 2026-10-04 after the user confirmed exact one-hour repeating availability and DEV0116 supplied stable local coach identities for owner-flow validation.

### Changes and rationale

Added an additive `app.coach_availability_rules` table for exact ISO-weekday/whole-hour rules. A rule snapshots the coach timezone, is unique while active for one owner/day/time, and is soft-removed so generated inventory can retain a durable source reference. The existing slot table now has nullable rule/date identity; explicit DEV0104 slots retain null recurrence fields, while one partial unique index guarantees at most one dated occurrence per rule/local date.

Owner create/remove functions derive run/profile/timezone from the verified actor and visible coach profile. Creation serializes per coach, inserts the rule and synchronizes the rolling seven-day horizon in the same transaction. Removal is idempotent, soft-removes the rule and withdraws only future `open` occurrences. `held` and `booked` rows keep their status, time and location. A generated-occurrence trigger prevents the old explicit-slot edit/withdraw functions from moving or withdrawing recurrence history; only rule management and the reserved future booking-management boundary may change lifecycle status.

Synchronization runs after rule creation and before owner/public availability reads. It uses a per-coach transaction advisory lock, stable rule/local-date identity and `ON CONFLICT DO NOTHING`, so retries and concurrent reads cannot duplicate slots. Each new occurrence copies the current confirmed coach/gym location once. Existing occurrences are never refreshed after location edits. Existing rules retain their timezone after profile edits. Local starts and ends must both map to one unambiguous instant and remain exactly one absolute hour, so daylight-saving gaps/overlaps are omitted rather than silently shifted.

Domain, Drizzle, repository and service contracts now expose active weekly rules plus recurrence identity on owned slots. Public projections still expose only the durable dated slot, which is the boundary DEV0105 will hold/book. DEV0115 can consume the new owner rule mutations and schedule data without owning recurrence expansion.

### Affected files

| File or component                                                                                        | Change and purpose                                                                                                                               |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `supabase/migrations/20261004000100_create_recurring_coach_availability.sql`                             | Adds rules, slot occurrence identity, RLS, integrity/protection triggers, synchronization wrappers and owner create/remove functions.            |
| `src/server/db/schema/coaches.ts`                                                                        | Maps the additive rule table, recurrence slot columns, constraints and indexes for typed server use.                                             |
| `src/domain/coaches.ts`                                                                                  | Defines one-hour weekly-rule input/output contracts, validation and recurrence metadata on owned occurrences.                                    |
| `src/server/db/coaches/availability-repository.ts` and `src/server/coaches/service.ts`                   | Synchronize before reads, map rules/occurrences, expose owner create/remove operations and preserve unavailable/conflict behavior.               |
| `supabase/tests/database/*.sql`, `tests/database/coach-availability.test.ts` and `tests/coaches.test.ts` | Cover schema authority, rules, retries, concurrency, overlap, lifecycle protection, compatibility, timezone/location snapshots and DST handling. |
| `README.md`, `docs/mvp-spec.md`, `tickets/README.md`, COR0009 and dependent tickets                      | Keep current delivery status, product behavior and downstream ownership accurate.                                                                |

### Decisions and deviations

- 2026-10-04: Repeating weekly availability replaces the prior P0 decision to require coaches to recreate explicit slots each week. Concrete dated occurrences remain authoritative for capacity, snapshots and future booking.
- 2026-10-04: The user narrowed P0 to exact one-hour calendar slots. Broad windows, variable duration and advanced exceptions are deferred. Request-time/mutation-time idempotent materialization is adopted to avoid new scheduler infrastructure.
- 2026-10-04: ISO weekdays use Monday `1` through Sunday `7`; starts are whole hours from `00:00` through `22:00`. `23:00` is rejected because cross-midnight rules were explicitly deferred.
- 2026-10-04: Public and owner reads invoke bounded synchronization. This creates at most one occurrence per active rule/date and avoids an undeclared Cron dependency; a database/synchronization failure returns the existing unavailable state.
- 2026-10-04: Generated occurrence identity, time, timezone and location are immutable. A narrow trigger reserves status changes for rule removal or future DEV0105 booking management, preventing legacy one-off controls from becoming undeclared occurrence exceptions.
- 2026-10-04: The first clean migration attempt failed on invalid schema qualification of PostgreSQL's `extract` syntax and was corrected before any successful reset. The first protection test then showed that a missing custom setting compares as `NULL`; the trigger was changed to `coalesce(..., '')` so it fails closed. Both corrected paths passed clean/repeat validation.

### Contracts, configuration, and operations

The migration adds `app.coach_availability_rules`, nullable `recurrence_rule_id`/`recurrence_local_date` columns on `app.coach_availability_slots`, and callable functions `app.create_owned_coach_availability_rule`, `app.remove_owned_coach_availability_rule`, `app.synchronize_owned_coach_availability` and `app.synchronize_public_coach_availability`. Internal expansion/DST helpers are not executable by `app_runtime`; direct rule/slot writes remain denied. Existing explicit slot functions and rows remain compatible, including historical 30–180-minute durations, but generated occurrences cannot be edited through those functions.

Server contracts add `CoachAvailabilityRuleInput`, `OwnedCoachAvailabilityRule`, rule validation, active-rule reads and create/remove service functions. Owner slots now disclose nullable recurrence source/date to the forthcoming calendar; public/client slots retain their existing dated-slot shape. Public availability reads may perform a bounded idempotent database write before selecting the seven-day projection.

No environment variable, dependency, credential, provider call, scheduler, data backfill or Solana contract changed. Rollback before downstream bookings may drop the new functions/table/indexes/triggers and recurrence columns; after DEV0105 references occurrences, forward correction is required instead of deleting durable slot history.

## Validation results

- Date and environment: 2026-10-04, local Supabase/PostgreSQL on loopback with Node.js 24.21.0, Next.js 16.3.8 and vinext 1.0.0-beta.9.
- `npm run db:reset` — passed repeatedly from a clean database after the two failed-closed development findings described above; all migrations and deterministic seed applied through `20261004000100`.
- Representative upgrade: `supabase db reset --local --version 20261003000500`, one inserted DEV0104 explicit slot, then `supabase migration up --local` — passed. The original slot remained `open`, 60 minutes, and readable with both recurrence fields null; the temporary row was then deleted.
- `npm run db:test` — passed all 143 pgTAP assertions across 7 files, including the new 14-assertion recurrence schema/RLS/grant/integrity suite and updated foundation counts.
- `npm run test:db` from the untouched seed — passed all 27 database integration tests. The 8 availability tests cover explicit compatibility, owner isolation, concurrent duplicate rule creation, adjacent rules, idempotent read synchronization, location/timezone snapshots, cross-owner removal, old-control protection, booked/held/open removal behavior, retry removal, invalid/cross-midnight hours, DST ambiguity/gaps and explicit-occurrence overlap.
- A deliberately provisioned-account run of `npm run test:db` failed only the foundation fixture-source count (`6` versus `11`) because DEV0116 intentionally converts five local fixtures to user records. A clean reset restored the test precondition and all 27 tests passed; the five accounts were reprovisioned afterward.
- `npm run db:lint` — passed with no schema errors.
- `npm test` — passed all 69 unit/boundary tests, including exact weekly-rule validation.
- `npm run typecheck` — passed after Next.js route type generation and strict TypeScript checking.
- `npm run lint` — passed with no findings.
- `npm run format:check` — passed for all configured implementation files. SQL is not handled by the configured Prettier parser; it passed migration application and database lint instead.
- `npm run build` — passed the optimized Next.js production build and generated all routes.
- `npm run build:vinext` — passed the Cloudflare-targeted production build. Its existing large-client-chunk and static route-classification notices remained warnings, not failures.
- Live local integration: after the final clean validation reset, `npm run auth:provision:coaches` restored all five DEV0116 accounts. A transaction-rolled-back Daniel Park actor rehearsal created exactly one one-hour occurrence at the original Tempelhofer Feld snapshot.
- No browser calendar check was run because DEV0115 owns the new interface. No Mapbox request, Solana transaction, hosted migration or deployment was required or performed.

| Criterion | Evidence                                                                                                                                           | Result |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Owner integration created 06:00/07:00/08:00 adjacent rules; duplicate concurrency produced one success; remove and retry were owner-scoped.        | Passed |
| AC2       | Repeated owner/public reads retained one occurrence per rule/date, exact one-hour duration and stable independent/gym snapshots.                   | Passed |
| AC3       | Removal preserved booked and held occurrences byte-for-byte while withdrawing the future open occurrence; legacy controls rejected generated rows. | Passed |
| AC4       | Invalid hours, `23:00`, cross-owner removal, duplicates, explicit overlap and Berlin DST gap/overlap cases failed or were omitted safely.          | Passed |
| AC5       | Clean and representative-upgrade checks preserved DEV0104 rows with null recurrence identity; public consumers still receive durable slot IDs.     | Passed |
| AC6       | Migration, pgTAP, database, unit, lint, typecheck, formatting, Next.js and vinext checks all passed.                                               | Passed |

## Risks, limitations, and follow-ups

Request-driven synchronization adds a bounded serialized write before owner/public schedule reads; its production latency and lock behavior still need hosted observation under DEV0106. A collision with retained explicit capacity fails the rule transaction rather than silently choosing one source. Rules omit a daylight-saving date when either local endpoint is nonexistent/ambiguous or the absolute duration would not remain one hour. Variable durations, broad windows, pause/resume, one-date exceptions, cross-midnight rules and external calendars remain deferred. DEV0115 must replace the explicit form/card interface with the weekly calendar and client presentation; DEV0105 must use only durable dated occurrences and the reserved booking-management lifecycle boundary.

## Completion and review references

- Completed: 2026-10-04 — delivered owner-scoped one-hour weekly rules, idempotent seven-day dated occurrences, immutable snapshots/history and backward-compatible explicit slots.
- Commit: This commit — `[DEV0114][DEV0116] Add recurring availability and local coach accounts`; planning commit `223f3e7` — `[DEV0114][DEV0115] Plan recurring coach schedules`.
- Review: Implementation self-review against all six acceptance criteria completed; no independent review.
- Deployment or release: Local implementation only. No hosted migration or release was performed.
