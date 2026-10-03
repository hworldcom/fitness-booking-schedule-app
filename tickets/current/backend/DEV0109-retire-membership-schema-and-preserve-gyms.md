# Ticket DEV0109: Retire membership schema and preserve gyms

- Status: In progress
- Created: 2026-10-03
- Last updated: 2026-10-03
- Milestone: Coach-first M0 database cleanup
- Coordination: [COR0009 — Coach-first private-class booking MVP](../organisatory/COR0009-coach-first-training-package-mvp.md)
- Related records: follows completed runtime retirement in [DEV0101 — Retire the multi-gym membership runtime](../../archive/backend/DEV0101-retire-multigym-membership-runtime.md); provides the simplified gym boundary consumed by [DEV0096 — Persist coach profiles and discovery](DEV0096-persist-coach-profiles-and-discovery.md), [DEV0104 — Publish weekly coach availability](DEV0104-publish-weekly-coach-availability.md) and [DEV0108 — Add the Mapbox coach Explore map](../frontend/DEV0108-add-mapbox-coach-explore-map.md); hosted application depends on [DEV0055 — Hosted Supabase staging environment](DEV0055-hosted-supabase-staging-environment.md)

## Objective and context

Remove the dormant PostgreSQL model for multi-gym memberships, gym-managed classes, reservations, access claims, arrivals and check-ins while preserving gyms as simple public training-location records. DEV0101 removed the reachable runtime but deliberately left its applied migration history and hosted tables intact. The coach-first implementation should not be built beside a second obsolete access model or reuse tables whose constraints encode membership plans, group capacity, EURC pricing, venue staff or check-in authority.

The retained gym concept is deliberately narrow. A fictional gym supplies public location information that a coach may optionally select through DEV0096. A gym has no application login, wallet authority, membership catalogue, class schedule, check-in staff or booking authority in this MVP. Independent coaches remain valid without a gym.

## Scope and non-goals

- In scope: read-only hosted/local dependency and row-count preflight; a forward migration creating a simplified `gyms` location table and preserving eligible fictional gym/location records; explicit removal of legacy membership products/versions/eligibility, participating-gym join state, activation operations and gym snapshots, membership periods/core gyms, daily access claims, class reservations, arrival requests, check-ins, group class sessions, trainer affiliations, venue staff and their dedicated functions/triggers/policies/grants; replacement of the old organization/venue hierarchy with the simplified gym model; removal of the unused organization-wallet authority branch while preserving personal wallet linking; updated Drizzle mappings, seeds and database tests; rollback/backup and hosted-application instructions.
- Out of scope: coach profiles or `coach_gym_affiliations` owned by DEV0096; coach availability owned by DEV0104; holds/bookings owned by DEV0105; gym accounts, administrators, branches, memberships, access control, managed classes, check-ins, payments, revenue splitting, public gym discovery UI, real gym data or migration squashing/resetting applied history.

## Expected behavior and edge cases

A clean database reaches one coach-first foundation after applying all historical migrations followed by this cleanup migration. The resulting schema retains application profiles, demo-run isolation and personal wallet proof/binding behavior. It contains simple demo-safe gym locations but no table, policy or callable function that can create or mutate a membership product, membership period, gym class reservation, access claim, arrival request or check-in.

Only fictional gym/venue records that satisfy the new bounded gym-location contract may be copied before legacy tables are dropped. Unexpected active organization wallet authorities, non-demo organization data, unresolved foreign-key dependencies or malformed gym locations abort the migration/preflight rather than being silently discarded. Personal wallet bindings and personal link/replace challenges must survive unchanged.

The `gyms` table stores a stable identifier, demo-run boundary, slug, name, bounded description, public location label, city/area/country, IANA timezone, provider-neutral coordinates and provenance/status fields. It does not store class schedules, prices, membership eligibility or wallet authority. Later coach affiliation is optional and does not make a gym authoritative for a coach's offers, slots, bookings or TrainingPasses.

## Assumptions, decisions, and dependencies

- Confirmed by the user on 2026-10-03: remove every membership, gym-class, reservation, access-claim, arrival and check-in structure; retain gyms because coaches are likely to be associated with them.
- P0 remains coach-first. A coach may select zero or one public gym association through DEV0096 or use an independent confirmed public location. Multiple public venues and gym-operated workflows remain deferred.
- Preserve additive migration files as historical evidence. Use a new explicit forward migration rather than editing applied migrations or using an unbounded `drop ... cascade`.
- Staging is not assumed disposable. Capture safe counts/dependencies and document backup/rollback steps before hosted application. Applying the destructive hosted migration is a separate operational action after local review.
- DEV0096 owns the optional coach-to-gym relationship so this cleanup does not invent a coach schema ahead of its owning ticket.

## Implementation plan

1. Inventory local and hosted legacy tables, functions, triggers, policies, grants, foreign-key dependencies and row counts without exposing user data; classify rows that may populate `gyms`.
2. Freeze the simplified gym-location columns, validation, demo-run isolation, personal-wallet compatibility and explicit legacy-object drop order.
3. Add a forward migration that creates/seeds or migrates `gyms`, removes obsolete functions/policies/triggers before their tables, simplifies organization-only wallet/challenge state, and explicitly drops the legacy hierarchy and membership/class/check-in tables without broad cascade.
4. Replace the current organization/venue/class Drizzle mappings with `gyms`; update deterministic fictional seeds and keep personal wallet repositories/tests working.
5. Validate clean and repeat migration paths, preservation of personal identity/wallet state, absence of every retired object, fictional gym data, row-level security and rollback/hosted runbooks. Apply to staging only through the separately reviewed migration operation.

## Acceptance criteria

- [ ] AC1: A clean migration run retains profiles, demo-run participation and personal wallet linking while exposing one row-level-secured `gyms` location table with only bounded fictional data.
- [ ] AC2: Membership products/versions/eligibility, participating-gym state, activation operations/snapshots, periods/core gyms, daily access claims, class reservations, arrival requests, check-ins, class sessions, trainer affiliations and venue-staff mutation surfaces are absent after migration.
- [ ] AC3: The old organization/venue and organization-wallet authority paths are removed or transformed without deleting or weakening personal wallet bindings and link/replace challenges.
- [ ] AC4: Unexpected non-demo data, active organization authority or unresolved dependencies fail the preflight/migration safely; the implementation does not rely on broad cascade or silently discard unreviewed rows.
- [ ] AC5: DEV0096 can attach a coach optionally to a gym without recreating gym membership, classes, check-ins or gym authority, and independent coaches remain supported.
- [ ] AC6: Clean/repeat migration, schema-drift, RLS, seed, personal-wallet regression, lint, typecheck, formatting and production-build checks pass; hosted application/rollback instructions are complete and secret-safe.

## Validation plan

Run the migration suite against a clean database and a representative pre-cleanup database containing fictional gyms plus personal wallet state. Assert exact retained/dropped relations and callable functions through PostgreSQL catalog queries. Exercise personal wallet link/replace database tests before and after migration, gym RLS/constraint/seed tests, schema export/Drizzle parity and relevant unit, lint, typecheck, format and build commands. Record hosted preflight separately; do not claim staging cleanup until the migration is deliberately applied and post-migration counts are verified.

## Implementation record

Implementation has started locally with a forward-migration and dependency-inventory draft. That unvalidated database implementation is deliberately excluded from the current planning/public-story commit; runtime mappings, seed/test updates, the standalone preflight, migration validation and operational runbook remain in progress.

### Changes and rationale

- Drafted the explicit cleanup direction and the bounded fictional-gym preservation contract before database implementation began.
- A local migration/preflight/schema/test draft now exists for later DEV0109 validation, review and a separate implementation commit. It must not be treated as complete or safe for hosted application yet.

### Affected files

Planned/in local draft: one forward Supabase migration, a read-only preflight script, foundation/identity Drizzle mappings, fictional gym seed/setup paths, database tests and migration/rollback documentation. DEV0096 owns all coach-profile and coach-gym-affiliation implementation.

### Decisions and deviations

- 2026-10-03: The cleanup preserves gyms as informational public locations but removes the membership, group-class, reservation, arrival and check-in model. The old organization/venue abstraction is not retained because the hackathon does not need branches, gym staff, gym wallets or gym administration.

### Contracts, configuration, and operations

The planned migration is destructive to dormant legacy tables and must be backed by explicit preflight evidence. No environment variable or secret is added. Historical migration files remain unchanged; migration squashing is deferred until the coach schema is stable and a disposable reset is separately approved.

## Validation results

Not run for the local implementation draft. No database migration has been applied locally or to staging, and this ticket remains In progress. The current commit records only the reviewed cleanup contract/ticket boundary alongside DEV0095; migration evidence is required before DEV0109 implementation is committed as complete.

## Risks, limitations, and follow-ups

Old migration functions have extensive cross-table dependencies, so incomplete explicit teardown could leave broken policies or callable routines. Hosted data may contain historical evidence worth retaining outside runtime tables; the preflight must distinguish export/archive needs from product state. Gym moderation, real partner onboarding, branch ownership and coach/gym commercial relationships require later tickets.

## Completion and review references

- Completed: Not completed.
- Commit: This commit — `[DEV0095][DEV0109] Present coach story and plan schema cleanup` records the reviewed DEV0109 contract and In-progress boundary only; the local migration/schema draft remains uncommitted pending validation.
- Review: Planning self-review only; no independent review.
- Deployment or release: None.
