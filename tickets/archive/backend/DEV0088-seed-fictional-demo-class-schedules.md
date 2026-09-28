# Ticket DEV0088: Seed fictional demo class schedules

- Status: Completed
- Created: 2026-09-28
- Last updated: 2026-09-28
- Milestone: M3 reservations and check-ins
- Coordination: [COR0008 — Membership reservations and check-ins](../organisatory/COR0008-membership-reservations-and-checkins.md)
- Related records: supplies schedule and trainer fixtures to completed [DEV0086 — Persist included class reservations](DEV0086-persist-included-class-reservations.md); builds on the seven fictional participating gyms delivered by completed [DEV0078](DEV0078-revise-multigym-catalogue-schema.md)

## Objective and context

Replace the three sparse 2030 foundation classes with a useful two-week demonstration schedule across all seven fictional participating gyms. The user supplied several public Berlin schedules as research input. This ticket transforms only their broad operating patterns—morning, lunch, evening and weekend cadence; 60–90 minute martial-arts sessions; shorter strength sessions; and explicit experience levels—into original MovX fixture content.

No supplied business name, class title, trainer identity, address, price, URL or partnership claim may enter the repository. The resulting schedule is demonstration data for the current fictional catalogue and the reservation work in [the MVP specification](../../../docs/mvp-spec.md#8-reservations-and-member-priced-visits).

## Scope and non-goals

- In scope: original fictional trainer profiles and active demo-run participation; trainer affiliations for all seven gyms; a balanced two-week class/session schedule anchored to the deterministic demo-run date; activity constraints covering the catalogue's existing MMA, grappling, kickboxing, massage and wellness categories; idempotent seed replay; Drizzle parity; and database assertions for the new fixture set.
- Out of scope: copying or periodically scraping external schedules; real gym/trainer identities; public class APIs; reservation mutations; attendance; recurring-schedule administration; live availability; runtime fixture generation; class-pass sales; pricing research; deployment or hosted seed execution.

## Expected behavior and edge cases

The deterministic seed creates six sessions per fictional gym over two weeks, for 42 scheduled sessions total. Each gym has at least one recurring-looking session in each week and the overall set includes early morning, lunchtime, evening and weekend times. Session times derive from the active demo run's fixed `schedule_anchor_date` in the venue's `Europe/Berlin` timezone, so stored UTC instants remain correct across the anchor period.

Every class references an active fictional trainer affiliation at the same venue. One-to-one sports massage is represented as a capacity-one scheduled session; group recovery sessions use larger capacity. The current product does not sell standalone classes, so `price_base_units = 0` means no standalone price in this fixture—it does not make a production retail-price claim. Replaying the seed updates these owned fixture rows to the reviewed values without duplicating them or changing user-created rows.

## Assumptions, decisions, and dependencies

- The seven existing venue identities and their activity tags remain unchanged.
- The active demo run retains its stable ID and slug because authentication and browser rehearsals reference them, but its fixed anchor/window moves to the current hackathon period beginning Monday 2026-09-28.
- Six existing catalogue coach names become actual unclaimed fixture profiles; no login, wallet or staff authority is implied.
- The class and trainer activity constraints should match the already accepted venue taxonomy: `Grappling`, `Kickboxing`, `Massage`, `MMA`, `Muay Thai`, `Running`, `Strength`, `Wellness` and `Yoga`.
- The supplied webpages are research evidence only and are intentionally not recorded in tracked project content, preserving the established no-real-gym-reference fixture policy.

## Implementation plan

1. Add a forward migration widening trainer-affiliation and class-session activity checks to the existing venue taxonomy; mirror it in Drizzle.
2. Extend the deterministic seed with six fictional coach profiles, active operator participation and same-venue trainer affiliations.
3. Move the stable demo run to the fixed 2026-09-28 anchor/window and replace the three sparse sessions with 42 original two-week fixtures derived from that anchor.
4. Update database assertions for profile, trainer, venue, session, timing, capacity and idempotency invariants.
5. Replay migrations and seed twice, run focused database/static checks, and record exact evidence.

## Acceptance criteria

- [x] AC1: A clean seed contains exactly seven fictional participating gyms, eleven unclaimed fixture profiles, nine trainer affiliations and 42 scheduled sessions, with six sessions at each participating gym.
- [x] AC2: Every seeded session references an active same-venue trainer affiliation and uses only the reviewed activity taxonomy; invalid activity values remain database-rejected.
- [x] AC3: The fixture set contains representative morning, lunch, evening and weekend times plus capacity-one massage and group classes, and every session lies inside the fixed demo-run window.
- [x] AC4: Tracked data contains no supplied real gym/trainer name, address, schedule URL, copied class text, real price or partnership implication.
- [x] AC5: Clean migration/seed replay and a second same-database seed run succeed without duplicate rows; Drizzle mappings, SQL tests, database integration tests, lint, typecheck and formatting/whitespace checks pass.

## Validation plan

Use SQL/Drizzle assertions to count fixture profiles, affiliations and sessions; group sessions by venue; check trainer-affiliation joins; verify UTC timestamps against the fixed Berlin-local anchor; assert the capacity-one massage boundary; and attempt invalid trainer/class activity inserts. Run `npm run db:start`, `npm run db:reset`, `npm run db:seed` twice, `npm run db:test`, `npm run test:db`, `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run db:lint` and `git diff --check` as applicable. No browser validation is required because this ticket does not expose the schedule in the UI; that belongs to DEV0087.

## Implementation record

Implementation and validation are complete.

### Changes and rationale

The database seed now represents all seven participating gyms with a balanced two-week schedule instead of three isolated 2030 classes. Six new unclaimed coach profiles participate as demo operators and join the appropriate venues through trainer affiliations; existing fictional coaches remain in place. The 42 sessions cover Muay Thai, strength, yoga, MMA, grappling, kickboxing, wellness and massage, with Berlin-local times calculated from the stable run anchor.

The forward migration aligns trainer and class checks with the already accepted venue activity taxonomy. The stable demo-run ID and `local-foundation-2030` slug remain untouched for authentication compatibility, while its deterministic anchor/window now covers 2026-09-28 through 2026-10-26. Seed-owned run/session upserts update only when reviewed fields differ, so repeat application neither duplicates nor needlessly mutates rows. Standalone class pricing remains out of scope; every session stores zero base units rather than inventing a retail price.

### Affected files

| File or component                                                                                                                     | Change and purpose                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [20260928000100_expand_demo_schedule_activities.sql](../../../supabase/migrations/20260928000100_expand_demo_schedule_activities.sql) | Widens trainer-affiliation and class-session checks to the existing nine-value participating-venue taxonomy.                                                                    |
| [supabase/seed.sql](../../../supabase/seed.sql)                                                                                       | Adds six fictional coaches, active participation, six new affiliations, the current fixed run anchor/window and 42 anchor-derived sessions with conditional idempotent updates. |
| [foundation.ts](../../../src/server/db/schema/foundation.ts)                                                                          | Keeps the typed Drizzle constraint declarations aligned with the forward migration.                                                                                             |
| [foundation.test.sql](../../../supabase/tests/database/foundation.test.sql)                                                           | Verifies counts, six sessions per gym, same-venue trainer integrity, run bounds, time-of-day mix, capacity-one massage, group recovery and invalid-activity rejection.          |
| [foundation.test.ts](../../../tests/database/foundation.test.ts)                                                                      | Verifies Drizzle reads all 42 zero-priced fixture sessions across seven venues and all eleven unclaimed fixture profiles.                                                       |
| [mvp-spec.md](../../../docs/mvp-spec.md), [supabase/README.md](../../../supabase/README.md)                                           | Records the transformed-fictional schedule rule, concrete fixture boundary and fixed-anchor operational limitation.                                                             |

### Decisions and deviations

- 2026-09-28: Created a dedicated fixture ticket instead of expanding DEV0086's reservation persistence scope. This keeps schedule content and seed mechanics independently reviewable while making DEV0088 an explicit prerequisite for reservations.
- 2026-09-28: External schedules are transformed research input only; no source identity or copied catalogue content is persisted.
- 2026-09-28: Retained the stable historical run slug because existing authentication tests and local configuration depend on it, but moved its schedule anchor/window to the current hackathon period.
- 2026-09-28: Used zero class price because standalone class sales are outside the current product. This value is an absence-of-sale marker, not a free-class promise.

### Contracts, configuration, and operations

`trainer_affiliations.activity_tags` and `class_sessions.discipline` now accept the same nine values already supported by participating venues. The seed contract changes from five fixture profiles, three affiliations and three sessions to eleven profiles, nine affiliations and 42 sessions. The stable run anchor changes to `2026-09-28`, with a window ending `2026-10-26T23:00:00Z`. Existing databases require the new forward migration plus an explicit reviewed seed application; deployment and hosted seed execution were not performed. No environment variable, secret, browser contract, runtime mutation permission or external dependency changed.

## Validation results

- Date and environment: 2026-09-28; local Supabase PostgreSQL 17 on `127.0.0.1:55322`, Node.js project toolchain.
- `npm run db:start` passed after permitting the Supabase CLI to update its user-level telemetry cache. `npm run db:reset` applied all migrations including DEV0088 and seeded successfully. `npm run db:seed` then passed twice against the same database; one additional replay passed after conditional no-op updates were added.
- `npm run db:test` passed all 146 pgTAP checks across six files. `npm run db:lint` reported no schema errors.
- The first `npm run test:db` invocation passed the new foundation checks but failed 16 unrelated runtime-role tests because reset had removed the loopback login. After the documented `npm run db:runtime` prerequisite, the rerun passed 25/25.
- `npm test` passed 78/78; `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build` and `git diff --check` passed.
- A case-insensitive repository scan for every supplied business/domain identifier returned no matches outside ignored dependencies and Git metadata. Browser testing was not run because this ticket adds no browser route or interface; DEV0087 owns schedule presentation.

| Criterion | Evidence                                                                                                                         | Result |
| --------- | -------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Clean seed plus pgTAP/Drizzle counts prove 7 participating gyms, 11 profiles, 9 affiliations and 42 sessions, six per gym.       | Passed |
| AC2       | Same-venue active-affiliation join returned no invalid rows; the SQL negative case rejected `Parkour` with a check violation.    | Passed |
| AC3       | pgTAP proved morning/lunch/evening/weekend coverage, run-window bounds, two capacity-one massage slots and group recovery.       | Passed |
| AC4       | Repository source-identity scan returned no matches; all inserted identities and content are fictional and original.             | Passed |
| AC5       | Reset/reseed, 146 SQL checks, 25 integration checks, 78 unit checks, lint/type/build/format/database lint and whitespace passed. | Passed |

## Risks, limitations, and follow-ups

This is a bounded hackathon schedule, not live gym availability and not a recurring-schedule engine. Its fixed dates are intentionally current for the demonstration period; a later environment/run provisioning ticket must create a new anchored dataset instead of silently shifting historical reservations. Hosted staging still needs an explicit reviewed migration/seed operation. DEV0086 remains responsible for actor-scoped reads, capacity and reservation state.

## Completion and review references

- Completed: 2026-09-28 — seeded and validated the fictional seven-gym, two-week schedule plus aligned activity constraints.
- Commit: Not created.
- Review: Implementation self-review completed against AC1–AC5; no independent review.
- Deployment or release: None.
